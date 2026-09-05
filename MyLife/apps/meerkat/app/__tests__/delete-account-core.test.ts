import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureMeerkatTables, setSetting, getSetting, FRIEND_CODE_KEY } from '../(root)/data/db';
import { ensureSyncSchema } from '../(root)/data/sync-core';
import { ensureCommunityTables } from '../(root)/data/community-core';
import { reportCommunityContent } from '../(root)/data/community-safety';
import {
  collectSecretRefs,
  hasPublicPersonaRecord,
  listMeerkatDataTables,
  runDeleteMyData,
  wipeMeerkatDeviceData,
  MEERKAT_DATA_TABLE_PREFIXES,
} from '../(root)/data/delete-account-core';

let testDb: InMemoryTestDatabase;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  db = testDb.adapter;
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  ensureCommunityTables(db);
});

afterEach(() => {
  testDb.close();
});

describe('delete-account-core (B.2 wipe)', () => {
  it('lists only Meerkat-prefixed tables', () => {
    const tables = listMeerkatDataTables(db);
    expect(tables.length).toBeGreaterThan(0);
    for (const name of tables) {
      expect(MEERKAT_DATA_TABLE_PREFIXES.some((p) => name.startsWith(p))).toBe(true);
    }
  });

  it('wipes every row across settings and community tables, leaving a clean first-run', () => {
    setSetting(db, FRIEND_CODE_KEY, 'MEER-A1B2-C3D4-E5F6-G7H8');
    reportCommunityContent(db, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'message',
      targetId: 'msg-1',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'x',
    });
    expect(getSetting(db, FRIEND_CODE_KEY)).not.toBeNull();
    expect(db.query('SELECT * FROM cm_safety_actions').length).toBe(1);

    const result = wipeMeerkatDeviceData(db);
    expect(result.tablesCleared.length).toBeGreaterThan(0);

    // Clean first-run: settings gone, community moderation gone, schema intact.
    expect(getSetting(db, FRIEND_CODE_KEY)).toBeNull();
    expect(db.query('SELECT * FROM cm_safety_actions').length).toBe(0);
    expect(db.query('SELECT * FROM mk_settings').length).toBe(0);
    // The table itself still exists (schema preserved) so the app boots clean.
    expect(listMeerkatDataTables(db)).toContain('cm_safety_actions');
  });

  it('collects the identity ref AND every paired shared-secret ref before wipe (finding #2)', () => {
    db.execute(
      `INSERT OR REPLACE INTO mk_identity (id, public_key, dh_public_key, private_key_ref, display_name, created_at)
       VALUES ('self', 'pk', 'dh', 'id-secret-ref', 'Me', '2026-07-06T00:00:00.000Z')`,
    );
    db.execute(
      `INSERT INTO sync_paired_devices (device_id, display_name, dh_public_key, shared_secret_ref, last_seen_at, last_sync_at, last_sync_module, bytes_sent, bytes_received, is_active, paired_at)
       VALUES ('peer-a', 'A', 'dhA', 'pair-secret-ref-a', NULL, NULL, NULL, 0, 0, 1, '2026-07-06T00:00:00.000Z')`,
    );
    const refs = collectSecretRefs(db, 'id-secret-ref');
    expect(refs).toContain('id-secret-ref');
    expect(refs).toContain('pair-secret-ref-a');
  });

  it('treats a malformed non-empty persona row as remote state that must not be skipped', () => {
    setSetting(db, 'public_persona', '{malformed');
    expect(hasPublicPersonaRecord(db)).toBe(true);
  });

  it('is idempotent (a second wipe clears nothing new and does not throw)', () => {
    wipeMeerkatDeviceData(db);
    expect(() => wipeMeerkatDeviceData(db)).not.toThrow();
    expect(db.query('SELECT * FROM mk_settings').length).toBe(0);
  });

  it('keeps every local row, byte store, and signing key when remote persona deletion fails', async () => {
    setSetting(db, FRIEND_CODE_KEY, 'KEEP-ME');
    setSetting(db, 'public_persona', JSON.stringify({
      personaPubkey: 'aa'.repeat(32), privateKeyRef: 'persona-secret', alias: 'keeper',
    }));
    const calls: string[] = [];
    const result = await runDeleteMyData({
      db,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: true,
      deleteRemotePersona: async () => { calls.push('remote'); return { ok: false, reason: 'unreachable' }; },
      deleteStorageData: async () => { calls.push('storage'); return { complete: true, failures: [] }; },
      clearNodeBytes: async () => { calls.push('node'); },
      clearBlobBytes: async () => { calls.push('blobs'); },
      deleteSecret: (ref) => { calls.push(`secret:${ref}`); },
      createFreshIdentity: () => { calls.push('fresh'); },
    });
    expect(result).toEqual({ ok: false, reason: 'public_account_delete_failed:unreachable' });
    expect(calls).toEqual(['remote']);
    expect(getSetting(db, FRIEND_CODE_KEY)).toBe('KEEP-ME');
    expect(getSetting(db, 'public_persona')).not.toBeNull();
  });

  it('deletes remote first, then both byte stores, secrets, database rows, and creates a fresh identity', async () => {
    setSetting(db, FRIEND_CODE_KEY, 'DELETE-ME');
    setSetting(db, 'public_persona', JSON.stringify({
      personaPubkey: 'aa'.repeat(32), privateKeyRef: 'persona-secret', alias: 'delete-me',
    }));
    const calls: string[] = [];
    const result = await runDeleteMyData({
      db,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: true,
      deleteRemotePersona: async () => { calls.push('remote'); return { ok: true }; },
      deleteStorageData: async () => { calls.push('storage'); return { complete: true, failures: [] }; },
      clearNodeBytes: async () => { calls.push('node'); },
      clearBlobBytes: async () => { calls.push('blobs'); },
      deleteSecret: (ref) => { calls.push(`secret:${ref}`); },
      createFreshIdentity: () => { calls.push('fresh'); },
    });
    expect(result).toEqual({ ok: true });
    expect(calls[0]).toBe('remote');
    expect(calls.slice(1, 4)).toEqual(['storage', 'node', 'blobs']);
    expect(calls).toContain('secret:persona-secret');
    expect(calls.at(-1)).toBe('fresh');
    expect(getSetting(db, FRIEND_CODE_KEY)).toBeNull();
  });

  it('does not wipe database references or report success when secure secret deletion rejects', async () => {
    setSetting(db, FRIEND_CODE_KEY, 'RETRY-ME');
    const result = await runDeleteMyData({
      db,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: false,
      deleteRemotePersona: async () => ({ ok: true }),
      deleteStorageData: async () => ({ complete: true, failures: [] }),
      clearNodeBytes: async () => {},
      clearBlobBytes: async () => {},
      deleteSecret: async () => { throw new Error('keychain unavailable'); },
      createFreshIdentity: () => { throw new Error('must not run'); },
    });
    expect(result).toEqual({ ok: false, reason: 'keychain unavailable' });
    expect(getSetting(db, FRIEND_CODE_KEY)).toBe('RETRY-ME');
  });

  it('keeps local rows and keys when storage account deletion is incomplete', async () => {
    setSetting(db, FRIEND_CODE_KEY, 'STORAGE-RETRY');
    const calls: string[] = [];
    const result = await runDeleteMyData({
      db,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: false,
      deleteRemotePersona: async () => ({ ok: true }),
      deleteStorageData: async () => ({
        complete: false,
        failures: [{ destinationId: 'webdav-1', step: 'adapter_revoke' }],
      }),
      clearNodeBytes: async () => { calls.push('node'); },
      clearBlobBytes: async () => { calls.push('blobs'); },
      deleteSecret: () => { calls.push('secret'); },
      createFreshIdentity: () => { calls.push('fresh'); },
    });
    expect(result).toEqual({
      ok: false,
      reason: 'storage_account_delete_failed:webdav-1:adapter_revoke',
    });
    expect(calls).toEqual([]);
    expect(getSetting(db, FRIEND_CODE_KEY)).toBe('STORAGE-RETRY');
  });
});
