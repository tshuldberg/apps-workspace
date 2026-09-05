/**
 * Opt-in peer-validated presence beacons (Plan 29 Phase 6, T6.4 red-team).
 *
 * Presence counts must come only from real verified signed rows validated
 * against the SIGNED roster, sealed so the relay learns nothing. These tests
 * prove the honesty boundary: a forged beacon is not counted, a replayed/expired
 * beacon drops at TTL, a non-member or removed-member beacon is ignored, only the
 * beacon's own device can park it, and opting out sends nothing to count.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { extractSigningPrivateKeyHex, signMessage } from '../identity/device-identity';
import { bytesToHex } from '../encryption/keys';
import { applyMailboxEnvelope } from '../protocol/mailbox-dispatch';
import { encodeMailboxEnvelope } from '../protocol/mailbox';
import { createSyncTables } from '../db/schema';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
} from '../index';
import {
  createCommunity,
  removeMemberRevision,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import {
  PRESENCE_MAX_TTL_SECONDS,
  ensurePresenceBeaconTable,
  openPresenceBeaconMailbox,
  presenceCounts,
  prunePresenceBeacons,
  recordPresenceBeacon,
  sealPresenceBeacon,
  signPresenceBeacon,
  verifyPresenceBeacon,
  type PresenceBeacon,
} from '../protocol/presence-beacon';

const NOW = Date.UTC(2026, 6, 6, 12, 0, 0);
const PAIR_SECRET = 'ab'.repeat(32);

type Identity = ReturnType<typeof generateDeviceIdentity>;

/** DeviceIdentity uses `publicKey`; the seal recipient wants `{ deviceId, dhPublicKey }`. */
function asRecipient(id: Identity): { deviceId: string; dhPublicKey: string } {
  return { deviceId: id.publicKey, dhPublicKey: id.dhPublicKey };
}

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensurePresenceBeaconTable(db.adapter);
  return db;
}

/** A community whose roster lists the owner plus each extra member. */
function foundWith(owner: Identity, extras: Identity[]): SignedCommunityDescriptor {
  return createCommunity(owner, {
    name: 'Block Club',
    channels: [{ id: 'general', name: 'general' }],
    members: extras.map((m) => ({
      deviceId: m.publicKey,
      role: 'member' as const,
      displayName: m.displayName,
      dhPublicKey: m.dhPublicKey,
    })),
    now: new Date(NOW).toISOString(),
  });
}

describe('Plan 29 P6 presence beacons -- sign + verify', () => {
  it('signs a fresh beacon that its own device verifies', () => {
    const dev = generateDeviceIdentity('A');
    const beacon = signPresenceBeacon(dev, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    expect(beacon.deviceId).toBe(dev.publicKey);
    expect(verifyPresenceBeacon(beacon, dev.publicKey, NOW)).toBe('fresh');
    expect(verifyPresenceBeacon(beacon, null, NOW + 299_000)).toBe('fresh');
  });

  it('reports expired past the TTL window', () => {
    const dev = generateDeviceIdentity('A');
    const beacon = signPresenceBeacon(dev, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 60 });
    expect(verifyPresenceBeacon(beacon, dev.publicKey, NOW + 60_000)).toBe('expired');
    expect(verifyPresenceBeacon(beacon, dev.publicKey, NOW + 61_000)).toBe('expired');
  });

  it('rejects a forged beacon (mutated field breaks the signature)', () => {
    const dev = generateDeviceIdentity('A');
    const beacon = signPresenceBeacon(dev, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    const forged: PresenceBeacon = { ...beacon, ttlSeconds: PRESENCE_MAX_TTL_SECONDS };
    expect(verifyPresenceBeacon(forged, dev.publicKey, NOW)).toBe('invalid');
  });

  it('rejects a beacon whose deviceId does not match the expected signer', () => {
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const beacon = signPresenceBeacon(a, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    // Signature is valid under A, but B's row key was expected: bound-mismatch.
    expect(verifyPresenceBeacon(beacon, b.publicKey, NOW)).toBe('invalid');
  });

  it('rejects a future-dated beacon beyond the skew tolerance', () => {
    const dev = generateDeviceIdentity('A');
    const beacon = signPresenceBeacon(dev, { communityId: 'c1', issuedAt: NOW + 60 * 60_000, ttlSeconds: 300 });
    expect(verifyPresenceBeacon(beacon, dev.publicKey, NOW)).toBe('invalid');
  });

  it('rejects an over-long TTL as dishonest', () => {
    const dev = generateDeviceIdentity('A');
    const beacon = signPresenceBeacon(dev, {
      communityId: 'c1',
      issuedAt: NOW,
      ttlSeconds: PRESENCE_MAX_TTL_SECONDS + 1,
    });
    expect(verifyPresenceBeacon(beacon, dev.publicKey, NOW)).toBe('invalid');
  });

  it('cross-domain: a signature over a different domain string never verifies as a beacon', () => {
    const dev = generateDeviceIdentity('A');
    const unsigned = { version: 1 as const, communityId: 'c1', deviceId: dev.publicKey, issuedAt: NOW, ttlSeconds: 300 };
    // Sign the SAME tuple under a foreign domain (mimicking a DM/channel signer).
    const foreign = new TextEncoder().encode(JSON.stringify([
      'meerkat-dm-shred-v1', unsigned.version, unsigned.communityId, unsigned.deviceId, unsigned.issuedAt, unsigned.ttlSeconds,
    ]));
    const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(dev.privateKeyRef), foreign));
    expect(verifyPresenceBeacon({ ...unsigned, signature }, dev.publicKey, NOW)).toBe('invalid');
  });
});

describe('Plan 29 P6 presence beacons -- seal + open', () => {
  it('round-trips a sealed beacon to a co-member', () => {
    const sender = generateDeviceIdentity('A');
    const recipient = generateDeviceIdentity('B');
    const beacon = signPresenceBeacon(sender, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    const sealed = sealPresenceBeacon({ sender, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });
    const opened = openPresenceBeaconMailbox(recipient, sealed.envelope, NOW);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.senderDeviceId).toBe(sender.publicKey);
      expect(opened.beacon.communityId).toBe('c1');
      expect(opened.verdict).toBe('fresh');
    }
  });

  it('wrong_sender: a member cannot relay another device beacon as its own park', () => {
    const author = generateDeviceIdentity('A');
    const relayer = generateDeviceIdentity('R');
    const recipient = generateDeviceIdentity('B');
    // relayer seals AUTHOR's beacon (self-assertion is violated: envelope signer != beacon device).
    const beacon = signPresenceBeacon(author, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    const sealed = sealPresenceBeacon({ sender: relayer, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });
    const opened = openPresenceBeaconMailbox(recipient, sealed.envelope, NOW);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toBe('wrong_sender');
  });

  it('invalid_beacon: a forged sealed beacon is rejected on open', () => {
    const sender = generateDeviceIdentity('A');
    const recipient = generateDeviceIdentity('B');
    const beacon = signPresenceBeacon(sender, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    // Tamper AFTER signing but keep deviceId so the seal binding passes; only the
    // beacon signature is now wrong.
    const sealed = sealPresenceBeacon({
      sender,
      recipient: asRecipient(recipient),
      pairSharedSecretHex: PAIR_SECRET,
      beacon: { ...beacon, communityId: 'c2' },
    });
    const opened = openPresenceBeaconMailbox(recipient, sealed.envelope, NOW);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toBe('invalid_beacon');
  });

  it('wrong_recipient: a beacon addressed to another device does not open', () => {
    const sender = generateDeviceIdentity('A');
    const recipient = generateDeviceIdentity('B');
    const eavesdropper = generateDeviceIdentity('E');
    const beacon = signPresenceBeacon(sender, { communityId: 'c1', issuedAt: NOW, ttlSeconds: 300 });
    const sealed = sealPresenceBeacon({ sender, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });
    const opened = openPresenceBeaconMailbox(eavesdropper, sealed.envelope, NOW);
    expect(opened.ok).toBe(false);
  });
});

describe('Plan 29 P6 presence beacons -- drain dispatch routing', () => {
  it('routes a sealed fresh beacon to the presenceBeacon handler', async () => {
    const sender = generateDeviceIdentity('A');
    const recipient = generateDeviceIdentity('B');
    // The dispatcher judges freshness against the real clock (Date.now), so the
    // beacon must be issued now, not at the fixed test epoch.
    const beacon = signPresenceBeacon(sender, { communityId: 'c1', issuedAt: Date.now(), ttlSeconds: 300 });
    const sealed = sealPresenceBeacon({ sender, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });

    let seen: { sender: string; communityId: string } | null = null;
    const outcome = await applyMailboxEnvelope(recipient, encodeMailboxEnvelope(sealed.envelope), {
      presenceBeacon: (s, b) => { seen = { sender: s, communityId: b.communityId }; return true; },
    });
    expect(outcome.kind).toBe('presence-beacon');
    expect(seen).toEqual({ sender: sender.publicKey, communityId: 'c1' });
  });

  it('rejects fail-closed when no presenceBeacon handler is registered', async () => {
    const sender = generateDeviceIdentity('A');
    const recipient = generateDeviceIdentity('B');
    const beacon = signPresenceBeacon(sender, { communityId: 'c1', issuedAt: Date.now(), ttlSeconds: 300 });
    const sealed = sealPresenceBeacon({ sender, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });
    const outcome = await applyMailboxEnvelope(recipient, encodeMailboxEnvelope(sealed.envelope), {});
    expect(outcome.kind).toBe('rejected');
  });

  it('drops an EXPIRED beacon at the drain (never forwarded to the handler)', async () => {
    const sender = generateDeviceIdentity('A');
    const recipient = generateDeviceIdentity('B');
    const beacon = signPresenceBeacon(sender, { communityId: 'c1', issuedAt: NOW - 600_000, ttlSeconds: 60 });
    const sealed = sealPresenceBeacon({ sender, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });
    let called = false;
    const outcome = await applyMailboxEnvelope(recipient, encodeMailboxEnvelope(sealed.envelope), {
      presenceBeacon: () => { called = true; return true; },
    });
    expect(outcome.kind).toBe('rejected');
    expect(called).toBe(false);
  });

  it('rejects a relayed beacon (envelope signer != beacon device)', async () => {
    const author = generateDeviceIdentity('A');
    const relayer = generateDeviceIdentity('R');
    const recipient = generateDeviceIdentity('B');
    const beacon = signPresenceBeacon(author, { communityId: 'c1', issuedAt: Date.now(), ttlSeconds: 300 });
    const sealed = sealPresenceBeacon({ sender: relayer, recipient: asRecipient(recipient), pairSharedSecretHex: PAIR_SECRET, beacon });
    let called = false;
    const outcome = await applyMailboxEnvelope(recipient, encodeMailboxEnvelope(sealed.envelope), {
      presenceBeacon: () => { called = true; return true; },
    });
    expect(outcome.kind).toBe('rejected');
    expect(called).toBe(false);
  });
});

describe('Plan 29 P6 presence counts -- roster-validated, fail-closed', () => {
  it('counts a fresh beacon from a listed member', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 300 }), NOW);
    const result = presenceCounts(db.adapter, cid, NOW);
    expect(result.count).toBe(1);
    expect(result.members[0]?.deviceId).toBe(member.publicKey);
    expect(result.members[0]?.expiresAt).toBe(NOW + 300_000);
    db.close();
  });

  it('does NOT count a non-member beacon (forged membership)', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const outsider = generateDeviceIdentity('outsider');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    // A validly-signed beacon from a device not in the roster: dropped.
    recordPresenceBeacon(db.adapter, signPresenceBeacon(outsider, { communityId: cid, issuedAt: NOW, ttlSeconds: 300 }), NOW);
    expect(presenceCounts(db.adapter, cid, NOW).count).toBe(0);
    db.close();
  });

  it('drops an expired beacon from the count at TTL', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 60 }), NOW);
    expect(presenceCounts(db.adapter, cid, NOW + 30_000).count).toBe(1);
    expect(presenceCounts(db.adapter, cid, NOW + 60_000).count).toBe(0);
    db.close();
  });

  it('does NOT count a removed member (roster revision drops them)', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 300 }), NOW);
    expect(presenceCounts(db.adapter, cid, NOW).count).toBe(1);

    // Owner removes the member; the new signed revision replaces the roster.
    const revised = removeMemberRevision(owner, signed, member.publicKey, new Date(NOW + 1000).toISOString());
    upsertCommunity(db.adapter, revised, owner.publicKey);
    expect(presenceCounts(db.adapter, cid, NOW).count).toBe(0);
    db.close();
  });

  it('re-verifies from bytes: a tampered stored row is not counted', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    const beacon = signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 60 });
    // Directly poison the stored beacon_json with a lengthened TTL (bypassing record()).
    const poisoned = JSON.stringify({ ...beacon, ttlSeconds: 3600 });
    db.adapter.execute(
      `INSERT INTO cm_presence_beacons (community_id, device_id, issued_at, ttl_seconds, beacon_json, received_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [cid, member.publicKey, NOW, 3600, poisoned, NOW],
    );
    // The stored TTL claims 1h but the SIGNED ttl is 60s: re-verify fails, drops.
    expect(presenceCounts(db.adapter, cid, NOW + 120_000).count).toBe(0);
    db.close();
  });

  it('opt-out sends nothing: an empty store counts zero', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    expect(presenceCounts(db.adapter, signed.descriptor.communityId, NOW).count).toBe(0);
    db.close();
  });

  it('does NOT count when the stored descriptor signature is tampered (fail-closed roster)', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;
    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 300 }), NOW);
    expect(presenceCounts(db.adapter, cid, NOW).count).toBe(1);

    // Corrupt the stored owner signature: the roster is no longer authoritative.
    db.adapter.execute('UPDATE sync_communities SET signature = ? WHERE community_id = ?', ['00'.repeat(64), cid]);
    expect(presenceCounts(db.adapter, cid, NOW).count).toBe(0);
    db.close();
  });

  it('unknown community counts zero (no roster to validate against)', () => {
    const db = freshDb();
    expect(presenceCounts(db.adapter, 'no-such-community', NOW).count).toBe(0);
    db.close();
  });

  it('prune deletes expired rows', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 60 }), NOW);
    prunePresenceBeacons(db.adapter, NOW + 60_000);
    const rows = db.adapter.query('SELECT * FROM cm_presence_beacons', []);
    expect(rows.length).toBe(0);
    db.close();
  });

  it('record keeps only the newest beacon per device', () => {
    const owner = generateDeviceIdentity('owner');
    const member = generateDeviceIdentity('member');
    const signed = foundWith(owner, [member]);
    const db = freshDb();
    upsertCommunity(db.adapter, signed, owner.publicKey);
    const cid = signed.descriptor.communityId;

    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW, ttlSeconds: 60 }), NOW);
    // A newer beacon supersedes; an older one never overwrites.
    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW + 120_000, ttlSeconds: 300 }), NOW + 120_000);
    recordPresenceBeacon(db.adapter, signPresenceBeacon(member, { communityId: cid, issuedAt: NOW - 60_000, ttlSeconds: 300 }), NOW);

    const result = presenceCounts(db.adapter, cid, NOW + 120_000);
    expect(result.count).toBe(1);
    expect(result.members[0]?.issuedAt).toBe(NOW + 120_000);
    db.close();
  });
});
