/**
 * Plan 52 P0: apply-time validators for the person-identity tables. A forged,
 * stale, spliced, or mis-addressed row must be rejected AT APPLY (never lands),
 * mirroring the cm_community_identity posture. Read-time verification stays the
 * rendering floor.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createCommunity, createCommunityInvite, joinCommunityFromLink } from '../protocol/community';
import {
  assemblePersonGroupAnnounce,
  assemblePersonGroupDoc,
  buildPersonGroupAnnounce,
  canonicalPersonAnnounceBytes,
  buildPersonGroupRevision,
  canonicalPersonGroupBytes,
  communityDerivationContext,
  createPresentationProfile,
  signPersonGroupAnnounce,
  signPersonCanonicalBytes,
  type PersonGroupDoc,
} from '../protocol/person-group';
import {
  PERSON_ANNOUNCE_TABLE,
  PERSON_GROUP_TABLE,
  PERSON_SELF_ROW_ID,
  PRESENTATION_PROFILE_TABLE,
  personAnnounceRowFromAnnounce,
  personGroupRowFromDoc,
  presentationProfileRowFromProfile,
  validatePersonAnnounceRow,
  validatePersonGroupRow,
  validatePresentationProfileRow,
} from '../protocol/person-group-rows';
import { validateSignedInboundRow } from '../protocol/inbound-row-validators';

type Identity = ReturnType<typeof generateDeviceIdentity>;

const NOW = '2026-07-29T12:00:00.000Z';
const LATER = '2026-07-29T13:00:00.000Z';

const PERSON_DDL = [
  `CREATE TABLE IF NOT EXISTS ${PERSON_GROUP_TABLE} (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    doc_json TEXT NOT NULL,
    secret_hex TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${PRESENTATION_PROFILE_TABLE} (
    id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL,
    profile_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${PERSON_ANNOUNCE_TABLE} (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    derived_group_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    announce_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

const SECRET = 'a'.repeat(64);

function signedGroup(identities: Identity[], previous: PersonGroupDoc | null, opts?: {
  remove?: string[];
  now?: string;
  secretHex?: string;
}): PersonGroupDoc {
  const built = buildPersonGroupRevision({
    previous,
    secretHex: opts?.secretHex ?? SECRET,
    add: previous ? [] : identities.map((identity, i) => ({ deviceId: identity.publicKey, label: `D${i}` })),
    remove: opts?.remove,
    now: opts?.now ?? NOW,
  });
  if (!built.ok) throw new Error(`build failed: ${built.reason}`);
  const signatures: Record<string, string> = {};
  const listed = new Set(built.doc.devices.map((d) => d.deviceId));
  const canonical = canonicalPersonGroupBytes(built.doc);
  for (const identity of identities) {
    if (listed.has(identity.publicKey)) {
      signatures[identity.publicKey] = signPersonCanonicalBytes(identity, canonical);
    }
  }
  return assemblePersonGroupDoc(built.doc, signatures);
}

describe('person-identity apply-time validators', () => {
  let db: InMemoryTestDatabase;
  let a: Identity;
  let b: Identity;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    for (const ddl of PERSON_DDL) db.adapter.execute(ddl);
    a = generateDeviceIdentity('Device A');
    b = generateDeviceIdentity('Device B');
  });

  afterEach(() => db.close());

  function storeGroupRow(doc: PersonGroupDoc, secret: string): void {
    const row = personGroupRowFromDoc(doc, secret);
    db.adapter.execute(
      `INSERT OR REPLACE INTO ${PERSON_GROUP_TABLE} (id, group_id, revision, doc_json, secret_hex, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.group_id, row.revision, row.doc_json, row.secret_hex, row.updated_at],
    );
  }

  describe('pi_person_group', () => {
    it('accepts a fully attested doc and rejects the stale replay after a removal', () => {
      const secret = SECRET;
      const r1 = signedGroup([a, b], null);
      const r1Row = personGroupRowFromDoc(r1, secret);
      expect(validatePersonGroupRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'INSERT',
        data: r1Row as unknown as Record<string, unknown>,
      })).toEqual({ ok: true });
      storeGroupRow(r1, secret);

      // r2 removes B; secret rotates.
      const rotated = 'b'.repeat(64);
      const r2 = signedGroup([a], r1, { remove: [b.publicKey], now: LATER, secretHex: rotated });
      expect(validatePersonGroupRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'UPDATE',
        data: personGroupRowFromDoc(r2, rotated) as unknown as Record<string, unknown>,
      })).toEqual({ ok: true });
      storeGroupRow(r2, rotated);

      // Replaying r1 (which resurrects B) is rejected at apply.
      const replay = validatePersonGroupRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'UPDATE',
        data: r1Row as unknown as Record<string, unknown>,
      });
      expect(replay).toEqual({ ok: false, reason: 'person_group_stale_revision' });
    });

    it('rejects a doc missing a member signature (unilateral claim)', () => {
      const built = buildPersonGroupRevision({
        previous: null,
        secretHex: SECRET,
        add: [
          { deviceId: a.publicKey, label: 'A' },
          { deviceId: b.publicKey, label: 'B' },
        ],
        now: NOW,
      });
      if (!built.ok) throw new Error('build failed');
      const partial = assemblePersonGroupDoc(built.doc, {
        [a.publicKey]: signPersonCanonicalBytes(a, canonicalPersonGroupBytes(built.doc)),
      });
      const verdict = validatePersonGroupRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'INSERT',
        data: personGroupRowFromDoc(partial, SECRET) as unknown as Record<string, unknown>,
      });
      expect(verdict).toEqual({ ok: false, reason: 'person_group_invalid' });
    });

    it('rejects a malformed secret and mismatched row denorm columns', () => {
      const doc = signedGroup([a], null);
      const row = personGroupRowFromDoc(doc, SECRET);
      expect(validatePersonGroupRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'INSERT',
        data: { ...row, secret_hex: 'not-hex' } as unknown as Record<string, unknown>,
      })).toEqual({ ok: false, reason: 'person_group_bad_secret' });
      expect(validatePersonGroupRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'INSERT',
        data: { ...row, revision: 99 } as unknown as Record<string, unknown>,
      })).toEqual({ ok: false, reason: 'person_group_row_mismatch' });
    });

    it('registry: raw DELETE of a person-group row is rejected', () => {
      expect(validateSignedInboundRow(db.adapter, {
        table: PERSON_GROUP_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'DELETE',
        data: null,
      })).toEqual({ ok: false, reason: 'signed_row_delete_rejected' });
    });
  });

  describe('pi_presentation_profile', () => {
    it('accepts a winning profile, rejects an older or identical one', () => {
      const v1 = createPresentationProfile({ revision: 1, displayName: 'River', updatedAt: NOW });
      const v2 = createPresentationProfile({ revision: 2, displayName: 'River P', updatedAt: LATER });
      const change = (profile: typeof v1, op = 'INSERT') => ({
        table: PRESENTATION_PROFILE_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: op,
        data: presentationProfileRowFromProfile(profile) as unknown as Record<string, unknown>,
      });
      expect(validatePresentationProfileRow(db.adapter, change(v1))).toEqual({ ok: true });
      const row = presentationProfileRowFromProfile(v2);
      db.adapter.execute(
        `INSERT OR REPLACE INTO ${PRESENTATION_PROFILE_TABLE} (id, revision, profile_json, updated_at)
         VALUES (?, ?, ?, ?)`,
        [row.id, row.revision, row.profile_json, row.updated_at],
      );
      expect(validatePresentationProfileRow(db.adapter, change(v1, 'UPDATE'))).toEqual({
        ok: false,
        reason: 'presentation_profile_not_newer',
      });
      expect(validatePresentationProfileRow(db.adapter, change(v2, 'UPDATE'))).toEqual({
        ok: false,
        reason: 'presentation_profile_not_newer',
      });
    });

    it('rejects a structurally invalid profile', () => {
      expect(validatePresentationProfileRow(db.adapter, {
        table: PRESENTATION_PROFILE_TABLE,
        rowId: PERSON_SELF_ROW_ID,
        operation: 'INSERT',
        data: { id: PERSON_SELF_ROW_ID, revision: 1, profile_json: '{"nope":true}', updated_at: NOW },
      })).toEqual({ ok: false, reason: 'presentation_profile_malformed' });
    });
  });

  describe('cm_person_announces', () => {
    function joinedCommunity(owner: Identity, memberIds: Identity[]): string {
      const signed = createCommunity(owner, {
        name: 'Person Club',
        channels: [{ id: 'general', name: 'General' }],
        members: memberIds.map((m) => ({ deviceId: m.publicKey, role: 'member' as const })),
      });
      const { link } = createCommunityInvite(owner, signed, 60_000, new Date(NOW));
      const joined = joinCommunityFromLink(db.adapter, memberIds[0]!, link, new Date(NOW));
      expect(joined.ok).toBe(true);
      return signed.descriptor.communityId;
    }

    function announceFor(ids: Identity[], communityId: string) {
      const doc = signedGroup(ids, null);
      const secret = SECRET;
      const unsigned = buildPersonGroupAnnounce(doc, secret, communityDerivationContext(communityId), NOW);
      const signatures: Record<string, string> = {};
      for (const identity of ids) {
        signatures[identity.publicKey] = signPersonGroupAnnounce(identity, unsigned);
      }
      return assemblePersonGroupAnnounce(unsigned, signatures);
    }

    it('accepts a verified announce whose devices are all community members', () => {
      const owner = generateDeviceIdentity('Owner');
      const communityId = joinedCommunity(owner, [a, b]);
      const announce = announceFor([a, b], communityId);
      const row = personAnnounceRowFromAnnounce(announce, communityId);
      expect(validatePersonAnnounceRow(db.adapter, {
        table: PERSON_ANNOUNCE_TABLE,
        rowId: row.id,
        operation: 'INSERT',
        data: row as unknown as Record<string, unknown>,
      })).toEqual({ ok: true });
    });

    it('rejects an announce listing a non-member device (fail-closed)', () => {
      const owner = generateDeviceIdentity('Owner');
      const stranger = generateDeviceIdentity('Stranger');
      const communityId = joinedCommunity(owner, [a]);
      const announce = announceFor([a, stranger], communityId);
      const row = personAnnounceRowFromAnnounce(announce, communityId);
      expect(validatePersonAnnounceRow(db.adapter, {
        table: PERSON_ANNOUNCE_TABLE,
        rowId: row.id,
        operation: 'INSERT',
        data: row as unknown as Record<string, unknown>,
      })).toEqual({ ok: false, reason: 'person_announce_member_unknown' });
    });

    it('rejects an announce derived for a DIFFERENT community (context transplant)', () => {
      const owner = generateDeviceIdentity('Owner');
      const communityId = joinedCommunity(owner, [a, b]);
      const announce = announceFor([a, b], 'some-other-community');
      // Carried under communityId but signed for another context.
      const row = { ...personAnnounceRowFromAnnounce(announce, communityId) };
      expect(validatePersonAnnounceRow(db.adapter, {
        table: PERSON_ANNOUNCE_TABLE,
        rowId: row.id,
        operation: 'INSERT',
        data: row as unknown as Record<string, unknown>,
      })).toEqual({ ok: false, reason: 'person_announce_context_mismatch' });
    });

    it('rejects a stale announce revision for the same derived id', () => {
      const owner = generateDeviceIdentity('Owner');
      const communityId = joinedCommunity(owner, [a, b]);
      const doc1 = signedGroup([a, b], null);
      const secret = SECRET;
      const context = communityDerivationContext(communityId);
      const mkAnnounce = (doc: PersonGroupDoc, when: string) => {
        const unsigned = buildPersonGroupAnnounce(doc, secret, context, when);
        const signatures: Record<string, string> = {};
        const listed = new Set(doc.devices.map((d) => d.deviceId));
        for (const identity of [a, b]) {
          if (listed.has(identity.publicKey)) {
            signatures[identity.publicKey] = signPersonGroupAnnounce(identity, unsigned);
          }
        }
        return assemblePersonGroupAnnounce(unsigned, signatures);
      };
      const announce1 = mkAnnounce(doc1, NOW);
      // Revision 2 keeps the same secret (no removal) so the derived id -- and
      // therefore the row id -- stays stable, which is what makes replaying the
      // OLD announce against the same row meaningful.
      const built2 = buildPersonGroupRevision({ previous: doc1, secretHex: SECRET, add: [], now: LATER });
      if (!built2.ok) throw new Error('build failed');
      const doc2 = assemblePersonGroupDoc(built2.doc, {
        [a.publicKey]: signPersonCanonicalBytes(a, canonicalPersonGroupBytes(built2.doc)),
        [b.publicKey]: signPersonCanonicalBytes(b, canonicalPersonGroupBytes(built2.doc)),
      });
      const announce2 = mkAnnounce(doc2, LATER);
      const row2 = personAnnounceRowFromAnnounce(announce2, communityId);
      db.adapter.execute(
        `INSERT OR REPLACE INTO ${PERSON_ANNOUNCE_TABLE}
           (id, community_id, derived_group_id, revision, announce_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row2.id, row2.community_id, row2.derived_group_id, row2.revision, row2.announce_json, row2.updated_at],
      );
      const row1 = personAnnounceRowFromAnnounce(announce1, communityId);
      expect(validatePersonAnnounceRow(db.adapter, {
        table: PERSON_ANNOUNCE_TABLE,
        rowId: row1.id,
        operation: 'UPDATE',
        data: row1 as unknown as Record<string, unknown>,
      })).toEqual({ ok: false, reason: 'person_announce_stale_revision' });
    });

    it('rejects an announce for a community this device does not hold', () => {
      const announce = announceFor([a, b], 'unknown-community');
      const row = personAnnounceRowFromAnnounce(announce, 'unknown-community');
      expect(validatePersonAnnounceRow(db.adapter, {
        table: PERSON_ANNOUNCE_TABLE,
        rowId: row.id,
        operation: 'INSERT',
        data: row as unknown as Record<string, unknown>,
      })).toEqual({ ok: false, reason: 'person_announce_community_unknown' });
    });
  });
});

// ---------------------------------------------------------------------------
// Adversarial-review regressions at the ROW layer (2026-07-29). HIGH-1 is the
// headline: the engine's generic LWW guard string-compares the raw updated_at
// COLUMN after this validator and silently skips the write, so an unbound
// column let a poisoned far-future timestamp freeze a person's device list.
// ---------------------------------------------------------------------------

describe('adversarial row regressions', () => {
  let db2: InMemoryTestDatabase;
  let a2: Identity;
  let b2: Identity;

  beforeEach(() => {
    db2 = createInMemoryTestDatabase();
    createSyncTables(db2.adapter);
    for (const ddl of PERSON_DDL) db2.adapter.execute(ddl);
    a2 = generateDeviceIdentity('A2');
    b2 = generateDeviceIdentity('B2');
  });

  afterEach(() => db2.close());

  it('HIGH-1: a person-group row whose updated_at does not match the signed doc is rejected', () => {
    const doc = signedGroup([a2, b2], null);
    const row = personGroupRowFromDoc(doc, SECRET);
    const poisoned = { ...row, updated_at: '9999-12-31T23:59:59.999Z' };
    expect(validatePersonGroupRow(db2.adapter, {
      table: PERSON_GROUP_TABLE,
      rowId: PERSON_SELF_ROW_ID,
      operation: 'INSERT',
      data: poisoned as unknown as Record<string, unknown>,
    })).toEqual({ ok: false, reason: 'person_group_row_mismatch' });
    // The honest row still passes.
    expect(validatePersonGroupRow(db2.adapter, {
      table: PERSON_GROUP_TABLE,
      rowId: PERSON_SELF_ROW_ID,
      operation: 'INSERT',
      data: row as unknown as Record<string, unknown>,
    })).toEqual({ ok: true });
  });

  it('HIGH-1: a presentation-profile row with a mismatched ordering column is rejected', () => {
    const profile = createPresentationProfile({ revision: 1, displayName: 'River', updatedAt: NOW });
    const row = presentationProfileRowFromProfile(profile);
    expect(validatePresentationProfileRow(db2.adapter, {
      table: PRESENTATION_PROFILE_TABLE,
      rowId: PERSON_SELF_ROW_ID,
      operation: 'INSERT',
      data: { ...row, updated_at: '9999-12-31T23:59:59.999Z' } as unknown as Record<string, unknown>,
    })).toEqual({ ok: false, reason: 'presentation_profile_row_mismatch' });
    expect(validatePresentationProfileRow(db2.adapter, {
      table: PRESENTATION_PROFILE_TABLE,
      rowId: PERSON_SELF_ROW_ID,
      operation: 'INSERT',
      data: { ...row, revision: 77 } as unknown as Record<string, unknown>,
    })).toEqual({ ok: false, reason: 'presentation_profile_row_mismatch' });
  });

  it('HIGH-1 variant B: a hostile member cannot replay a verified announce with a poisoned timestamp', () => {
    const owner = generateDeviceIdentity('Owner2');
    const signed = createCommunity(owner, {
      name: 'Poison Club',
      channels: [{ id: 'general', name: 'General' }],
      members: [
        { deviceId: a2.publicKey, role: 'member' as const },
        { deviceId: b2.publicKey, role: 'member' as const },
      ],
    });
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date(NOW));
    expect(joinCommunityFromLink(db2.adapter, a2, link, new Date(NOW)).ok).toBe(true);
    const communityId = signed.descriptor.communityId;

    const doc = signedGroup([a2, b2], null);
    const unsigned = buildPersonGroupAnnounce(doc, SECRET, communityDerivationContext(communityId), NOW);
    const signatures: Record<string, string> = {};
    const canonical = canonicalPersonAnnounceBytes(unsigned);
    for (const identity of [a2, b2]) {
      signatures[identity.publicKey] = signPersonCanonicalBytes(identity, canonical);
    }
    const announce = assemblePersonGroupAnnounce(unsigned, signatures);
    const row = personAnnounceRowFromAnnounce(announce, communityId);

    // The byte-identical, fully verified announce replayed with a far-future
    // column is rejected: the column is bound to the signed timestamp.
    expect(validatePersonAnnounceRow(db2.adapter, {
      table: PERSON_ANNOUNCE_TABLE,
      rowId: row.id,
      operation: 'INSERT',
      data: { ...row, updated_at: '9999-12-31T23:59:59.999Z' } as unknown as Record<string, unknown>,
    })).toEqual({ ok: false, reason: 'person_announce_row_mismatch' });
  });

  it('LOW-5: an equal-revision announce replay is rejected, not silently re-landed', () => {
    const owner = generateDeviceIdentity('Owner3');
    const signed = createCommunity(owner, {
      name: 'Replay Club',
      channels: [{ id: 'general', name: 'General' }],
      members: [{ deviceId: a2.publicKey, role: 'member' as const }],
    });
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date(NOW));
    expect(joinCommunityFromLink(db2.adapter, a2, link, new Date(NOW)).ok).toBe(true);
    const communityId = signed.descriptor.communityId;

    const doc = signedGroup([a2], null);
    const unsigned = buildPersonGroupAnnounce(doc, SECRET, communityDerivationContext(communityId), NOW);
    const announce = assemblePersonGroupAnnounce(unsigned, {
      [a2.publicKey]: signPersonCanonicalBytes(a2, canonicalPersonAnnounceBytes(unsigned)),
    });
    const row = personAnnounceRowFromAnnounce(announce, communityId);
    db2.adapter.execute(
      `INSERT OR REPLACE INTO ${PERSON_ANNOUNCE_TABLE}
         (id, community_id, derived_group_id, revision, announce_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.community_id, row.derived_group_id, row.revision, row.announce_json, row.updated_at],
    );
    expect(validatePersonAnnounceRow(db2.adapter, {
      table: PERSON_ANNOUNCE_TABLE,
      rowId: row.id,
      operation: 'UPDATE',
      data: row as unknown as Record<string, unknown>,
    })).toEqual({ ok: false, reason: 'person_announce_stale_revision' });
  });
});

// ---------------------------------------------------------------------------
// App-layer adversarial review (2026-07-29, second reviewer): CRITICAL-1.
// The announce row key WAS the attacker-choosable derivedGroupId, so any
// ordinary community member could self-sign a single-device announce carrying
// a victim's derived id at a huge revision, collide on the primary key, and
// permanently overwrite the victim's proof. The key is now derived from the
// signature-covered device set.
// ---------------------------------------------------------------------------

describe('CRITICAL-1: derived-group-id squatting', () => {
  let db3: InMemoryTestDatabase;
  let alice1: Identity;
  let alice2: Identity;
  let mallory: Identity;
  let owner: Identity;
  let communityId: string;

  beforeEach(() => {
    db3 = createInMemoryTestDatabase();
    createSyncTables(db3.adapter);
    for (const ddl of PERSON_DDL) db3.adapter.execute(ddl);
    alice1 = generateDeviceIdentity('Alice laptop');
    alice2 = generateDeviceIdentity('Alice phone');
    mallory = generateDeviceIdentity('Mallory');
    owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, {
      name: 'Squat Club',
      channels: [{ id: 'general', name: 'General' }],
      members: [
        { deviceId: alice1.publicKey, role: 'member' as const },
        { deviceId: alice2.publicKey, role: 'member' as const },
        { deviceId: mallory.publicKey, role: 'member' as const },
      ],
    });
    communityId = signed.descriptor.communityId;
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date(NOW));
    expect(joinCommunityFromLink(db3.adapter, alice1, link, new Date(NOW)).ok).toBe(true);
  });

  afterEach(() => db3.close());

  function announceFor(members: Identity[], derivedOverride?: string, revision?: number) {
    const doc = signedGroup(members, null);
    const base = buildPersonGroupAnnounce(doc, SECRET, communityDerivationContext(communityId), NOW);
    const unsigned = {
      ...base,
      ...(derivedOverride ? { derivedGroupId: derivedOverride } : {}),
      ...(revision ? { revision } : {}),
    };
    const canonical = canonicalPersonAnnounceBytes(unsigned);
    const signatures: Record<string, string> = {};
    for (const identity of members) {
      signatures[identity.publicKey] = signPersonCanonicalBytes(identity, canonical);
    }
    return assemblePersonGroupAnnounce(unsigned, signatures);
  }

  it('a squatter claiming the victim derived id CANNOT collide on the row key', () => {
    const alice = announceFor([alice1, alice2]);
    const aliceRow = personAnnounceRowFromAnnounce(alice, communityId);

    // Mallory self-signs a single-device announce carrying Alice's derived id
    // at a huge revision. It verifies (one listed device, her signature).
    const squat = announceFor([mallory], alice.derivedGroupId, 9_999_999);
    const squatRow = personAnnounceRowFromAnnounce(squat, communityId);

    // The row keys differ, so the squat lands on its OWN row and displaces
    // nothing. This is the whole fix.
    expect(squatRow.id).not.toBe(aliceRow.id);
  });

  it('a squatted row id that does NOT match its device set is rejected at apply', () => {
    const alice = announceFor([alice1, alice2]);
    const squat = announceFor([mallory], alice.derivedGroupId, 9_999_999);
    const aliceRow = personAnnounceRowFromAnnounce(alice, communityId);
    // Hand-forge the row so it claims Alice's row id while carrying Mallory's
    // announce: the validator recomputes the key from the signed device set.
    const forged = { ...personAnnounceRowFromAnnounce(squat, communityId), id: aliceRow.id };
    expect(validatePersonAnnounceRow(db3.adapter, {
      table: PERSON_ANNOUNCE_TABLE,
      rowId: aliceRow.id,
      operation: 'UPDATE',
      data: forged as unknown as Record<string, unknown>,
    })).toEqual({ ok: false, reason: 'person_announce_row_mismatch' });
  });

  it('the honest announce still supersedes ITS OWN earlier revision', () => {
    const first = announceFor([alice1, alice2], undefined, 1);
    const row1 = personAnnounceRowFromAnnounce(first, communityId);
    db3.adapter.execute(
      `INSERT OR REPLACE INTO ${PERSON_ANNOUNCE_TABLE}
         (id, community_id, derived_group_id, revision, announce_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row1.id, row1.community_id, row1.derived_group_id, row1.revision, row1.announce_json, row1.updated_at],
    );
    const second = announceFor([alice1, alice2], undefined, 2);
    const row2 = personAnnounceRowFromAnnounce(second, communityId);
    expect(row2.id).toBe(row1.id); // same device set -> same row
    expect(validatePersonAnnounceRow(db3.adapter, {
      table: PERSON_ANNOUNCE_TABLE,
      rowId: row2.id,
      operation: 'UPDATE',
      data: row2 as unknown as Record<string, unknown>,
    })).toEqual({ ok: true });
  });
});
