// Sync wiring tests (MK-008): the pure core behind SyncProvider, against a
// real in-memory SQLite. Schema bootstrap, the pad bellwether's LWW rows, the
// relay rendezvous token, pairing payload parsing, and the policy map that
// keeps the app's mk_ tables out of sync entirely.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ChangeTracker, createPairingPayload, generateDeviceIdentity, getBlobPolicy } from '@mylife/sync';
import {
  COMMUNITY_MODULE_ID,
  COMMUNITY_PREFIX,
  COMMUNITY_SYNC_POLICY,
} from '../(root)/data/community-core';
import {
  KEYS_SYNC_POLICY,
  MEERKAT_KEYS_MODULE_ID,
  MEERKAT_SYNC_MODULE_ID,
  MEERKAT_SYNC_PREFIXES,
  MEERKAT_SYNC_POLICIES,
  buildRendezvousToken,
  buildSignedPairingPayload,
  ensureSyncSchema,
  getPadRow,
  pairingDataFromBundle,
  pairingDataFromSignedPayload,
  parsePairingPayloadJson,
  parseSignedPairingPayload,
  savePadRow,
} from '../(root)/data/sync-core';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
});

afterEach(() => {
  db.close();
});

describe('sync schema bootstrap', () => {
  it('creates the sync_ tables and the pad table, idempotently', () => {
    ensureSyncSchema(db.adapter);
    ensureSyncSchema(db.adapter); // second run must not throw

    const tables = db.adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((r) => r.name);
    expect(tables).toContain('mp_pad');
    expect(tables).toContain('cm_messages');
    expect(tables).toContain('cm_message_attachments');
    expect(tables).toContain('cm_read_state');
    expect(tables).toContain('sync_blob_policy');
    expect(tables).toContain('sync_sessions');
    expect(tables).toContain('sync_paired_devices');
    expect(tables).toContain('sync_inbound_audit');
    expect(getBlobPolicy(db.adapter, COMMUNITY_MODULE_ID)?.policy).toBe('wifi_only');
  });
});

describe('sync pad (bellwether entity)', () => {
  beforeEach(() => {
    ensureSyncSchema(db.adapter);
  });

  it('returns null before the first save, then round-trips the body', () => {
    expect(getPadRow(db.adapter)).toBeNull();
    savePadRow(db.adapter, 'hello from this device', '2026-06-11T00:00:00.000Z');
    expect(getPadRow(db.adapter)).toEqual({
      id: 'pad',
      body: 'hello from this device',
      updated_at: '2026-06-11T00:00:00.000Z',
    });
  });

  it('each save advances the LWW timestamp', () => {
    savePadRow(db.adapter, 'v1', '2026-06-11T00:00:00.000Z');
    savePadRow(db.adapter, 'v2', '2026-06-11T01:00:00.000Z');
    const row = getPadRow(db.adapter)!;
    expect(row.body).toBe('v2');
    expect(row.updated_at).toBe('2026-06-11T01:00:00.000Z');
  });
});

describe('relay rendezvous token', () => {
  it('derives a deterministic 64-hex token from a phrase', () => {
    const token = buildRendezvousToken('our shared phrase');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(buildRendezvousToken('our shared phrase')).toBe(token);
    expect(buildRendezvousToken('  our shared phrase  ')).toBe(token); // trimmed
    expect(buildRendezvousToken('a different phrase')).not.toBe(token);
  });
});

describe('pairing payload parsing', () => {
  it('round-trips a real pairing payload', () => {
    const identity = generateDeviceIdentity('Test Device');
    const { pairingData } = createPairingPayload(identity);
    const parsed = parsePairingPayloadJson(JSON.stringify(pairingData));
    expect(parsed).toEqual(pairingData);
  });

  it('rejects malformed payloads', () => {
    expect(parsePairingPayloadJson('not json')).toBeNull();
    expect(parsePairingPayloadJson('{}')).toBeNull();
    expect(parsePairingPayloadJson(JSON.stringify({ publicKey: 'short' }))).toBeNull();
  });
});

describe('authenticated pairing payload (MK-015)', () => {
  it('round-trips build -> parse and yields the right PairingData', () => {
    const identity = generateDeviceIdentity('Signed Device');
    const json = JSON.stringify(buildSignedPairingPayload(identity, ['ws://relay.example:8787']));
    const parsed = parseSignedPairingPayload(json);
    expect(parsed).not.toBeNull();
    const data = pairingDataFromSignedPayload(parsed!);
    expect(data.publicKey).toBe(identity.publicKey);
    expect(data.dhPublicKey).toBe(identity.dhPublicKey);
    expect(data.displayName).toBe('Signed Device');
  });

  it('rejects a payload whose DH key was swapped on the wire (MITM)', () => {
    const identity = generateDeviceIdentity('Alice');
    const eve = generateDeviceIdentity('Eve');
    const payload = buildSignedPairingPayload(identity);
    // Eve swaps in her DH key but cannot re-sign as Alice's deviceId.
    payload.bundle.bundle.dhPublicKey = eve.dhPublicKey;
    expect(parseSignedPairingPayload(JSON.stringify(payload))).toBeNull();
  });

  it('rejects the legacy unsigned payload (authentication is now required)', () => {
    const identity = generateDeviceIdentity('Legacy');
    const { pairingData } = createPairingPayload(identity);
    expect(parseSignedPairingPayload(JSON.stringify(pairingData))).toBeNull();
  });

  it('pairingDataFromBundle derives stable PairingData from a bare bundle (MK-016 friend-code path)', () => {
    const identity = generateDeviceIdentity('Friend');
    const payload = buildSignedPairingPayload(identity);
    const data = pairingDataFromBundle(payload.bundle);
    expect(data.publicKey).toBe(identity.publicKey);
    expect(data.dhPublicKey).toBe(identity.dhPublicKey);
    expect(data.displayName).toBe('Friend');
    // Deterministic nonce: same bundle -> same PairingData (no Math.random).
    expect(pairingDataFromBundle(payload.bundle)).toEqual(data);
  });
});

describe('sync policy map', () => {
  it('syncs mp_, cm_, pi_, and the key-wrap table; the app\'s mk_ tables stay device-local', () => {
    expect(Array.from(MEERKAT_SYNC_PREFIXES.entries())).toEqual([
      [MEERKAT_SYNC_MODULE_ID, 'mp_'],
      [COMMUNITY_MODULE_ID, COMMUNITY_PREFIX],
      [MEERKAT_KEYS_MODULE_ID, 'sync_workspace_keys'],
      ['personidentity', 'pi_'],
    ]);
    const padPolicy = MEERKAT_SYNC_POLICIES.get(MEERKAT_SYNC_MODULE_ID)!;
    expect(padPolicy.defaultScope).toBe('personal_replica');
    expect(padPolicy.entityRules.map((r) => r.tableName)).toEqual(['mp_pad']);
    expect(MEERKAT_SYNC_POLICIES.get(COMMUNITY_MODULE_ID)).toBe(COMMUNITY_SYNC_POLICY);
    // Community feed P0: epoch key wraps replicate as shared_workspace.
    expect(MEERKAT_SYNC_POLICIES.get(MEERKAT_KEYS_MODULE_ID)).toBe(KEYS_SYNC_POLICY);
    expect(KEYS_SYNC_POLICY.defaultScope).toBe('shared_workspace');
    expect(KEYS_SYNC_POLICY.entityRules.map((r) => r.tableName)).toEqual(['sync_workspace_keys']);
    // Plan 52: person-identity rows replicate ONLY between own devices. The
    // module is non-shareable AND both rules cap at personal_replica, so the
    // engine's scope cap can never let them reach a shared workspace.
    const personPolicy = MEERKAT_SYNC_POLICIES.get('personidentity')!;
    expect(personPolicy.shareable).toBe(false);
    // FAIL CLOSED: a pi_ table added later without an explicit rule must
    // replicate NOTHING rather than inherit personal_replica by accident. The
    // two real tables below still carry their own personal_replica rules.
    expect(personPolicy.defaultScope).toBe('device_local');
    expect(personPolicy.entityRules.map((r) => [r.tableName, r.defaultScope, r.maxScope])).toEqual([
      ['pi_person_group', 'personal_replica', 'personal_replica'],
      ['pi_presentation_profile', 'personal_replica', 'personal_replica'],
    ]);
  });

  it('Plan 19 P0: the REAL MEERKAT_SYNC_PREFIXES resolve cm_publications to the community module', () => {
    const db = createInMemoryTestDatabase();
    try {
      const tracker = new ChangeTracker({
        db: db.adapter,
        deviceId: 'device-a',
        modulePrefixes: MEERKAT_SYNC_PREFIXES,
        modulePolicies: MEERKAT_SYNC_POLICIES,
      });
      // cm_publications must resolve to the community module under the real prefix
      // map, or the published_blob cap is inert (a cp_ prefix resolved to null).
      expect(tracker.resolveModule('cm_publications')).toBe(COMMUNITY_MODULE_ID);
      expect(tracker.resolveModule('cm_messages')).toBe(COMMUNITY_MODULE_ID);
      // A cp_ table resolves to NO module and would be rejected as unknown_table.
      expect(tracker.resolveModule('cp_publications')).toBeNull();
    } finally {
      db.close();
    }
  });

  it('Plan 22 S0.8: hosted-storage keys are device_local and never synced (extends TC-8)', () => {
    // These are mk_settings keys (device_local k/v, prefix mk_, OUTSIDE the sync
    // prefix map). They are caches/drafts for the resumable upload + usage meter and
    // must NEVER replicate: a replicated upload manifest or usage snapshot would leak
    // state across the mesh. This guard locks that in so a future agent cannot
    // "helpfully" add a sync policy to a storage key.
    const STORAGE_KEYS = [
      'storage_upload_manifest_json',
      'storage_upload_target',
      'storage_retention_pref',
      'storage_usage_snapshot_json',
      'storage_usage_fetched_at',
    ];
    const syncedPrefixes = Array.from(MEERKAT_SYNC_PREFIXES.values());
    const db = createInMemoryTestDatabase();
    try {
      const tracker = new ChangeTracker({
        db: db.adapter,
        deviceId: 'device-a',
        modulePrefixes: MEERKAT_SYNC_PREFIXES,
        modulePolicies: MEERKAT_SYNC_POLICIES,
      });
      for (const key of STORAGE_KEYS) {
        // No synced prefix (mp_ / cm_ / sync_workspace_keys) matches the key.
        expect(syncedPrefixes.some((p) => key.startsWith(p))).toBe(false);
        // The key resolves to NO synced module -> unknown_table -> never replicated.
        expect(tracker.resolveModule(key)).toBeNull();
      }
    } finally {
      db.close();
    }
  });
});
