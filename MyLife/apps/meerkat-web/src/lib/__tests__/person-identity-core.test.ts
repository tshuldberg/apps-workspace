/**
 * Plan 52 P1/P2 app core (WEB twin of apps/meerkat person-identity-core.test.ts): the attestation exchange, auto-alignment, and the
 * receiver-side link materialization, driven end to end between two simulated
 * devices over a fake mailbox (no relay, no network).
 *
 * Pins AC-1 (two linked devices converge on one presentation profile and both
 * re-sign their community profiles to it) and the trust floor the protocol
 * cannot enforce for us: a merely-PAIRED peer is never co-signed for.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyMailboxEnvelope,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createCommunity,
  createCommunityInvite,
  encodeMailboxEnvelope,
  ensureSyncBootstrap,
  joinCommunityFromLink,
  acceptPersonGroupRevision,
  assemblePersonGroupDoc,
  buildPersonGroupRevision,
  canonicalPersonGroupBytes,
  signPersonCanonicalBytes,
  type DeviceIdentity,
  type MailboxEnvelope,
} from '@mylife/sync';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import { listCommunityProfileEvents, saveIdentityRow } from '../meerkat-data';
import {
  alignPersonIdentity,
  buildPersonGroupMailboxHandlers,
  DM_PERSON_LINKS_SCOPE,
  ensurePersonIdentityTables,
  proposePersonGroupRevision,
  readPersonGroup,
  readPersonLinks,
  readPresentationProfile,
  savePresentationProfile,
  setPresentationOverride,
  cancelPersonProposal,
  listPendingPersonProposals,
  sweepStalePersonProposals,
  removeDevicesFromPerson,
  PERSON_PROPOSALS_TABLE,
  type PersonCeremonyDeps,
} from '../person-identity-core';

interface Device {
  test: InMemoryTestDatabase;
  db: InMemoryTestDatabase['adapter'];
  identity: DeviceIdentity;
}

/** A shared in-memory mailbox: token -> queued envelopes. */
class FakeMailbox {
  private readonly queues = new Map<string, MailboxEnvelope[]>();

  park(token: string, envelope: MailboxEnvelope): boolean {
    const queue = this.queues.get(token) ?? [];
    queue.push(envelope);
    this.queues.set(token, queue);
    return true;
  }

  take(token: string): MailboxEnvelope[] {
    const queue = this.queues.get(token) ?? [];
    this.queues.set(token, []);
    return queue;
  }
}

function makeDevice(name: string): Device {
  const test = createInMemoryTestDatabase();
  ensureMeerkatTables(test.adapter);
  ensureSyncSchema(test.adapter);
  ensurePersonIdentityTables(test.adapter);
  const boot = ensureSyncBootstrap(test.adapter, { deviceDisplayName: name });
  // The app's identity row (mk_identity) is what alignment renames; the sync
  // bootstrap only seeds the sync_ tables.
  saveIdentityRow(test.adapter, {
    public_key: boot.identity.publicKey,
    dh_public_key: boot.identity.dhPublicKey,
    private_key_ref: boot.identity.privateKeyRef,
    display_name: name,
    created_at: '2026-07-29T12:00:00.000Z',
  });
  return { test, db: test.adapter, identity: boot.identity };
}

describe('person identity core (P1/P2)', () => {
  let a: Device;
  let b: Device;
  let mailbox: FakeMailbox;
  const SHARED_SECRET = 'c'.repeat(64);

  function depsFor(self: Device, peer: Device, opts?: { linked?: boolean }): PersonCeremonyDeps {
    return {
      db: self.db,
      identity: self.identity,
      listOwnDeviceIds: () => (opts?.linked === false ? [] : [peer.identity.publicKey]),
      listDmPeerIds: () => [],
      resolvePairedDevice: (deviceId) => (
        deviceId === peer.identity.publicKey
          ? { dhPublicKey: peer.identity.dhPublicKey, sharedSecretHex: SHARED_SECRET }
          : null
      ),
      parkEnvelope: async (token, envelope) => mailbox.park(token, envelope),
    };
  }

  /** Deliver everything queued for `to` and run its handlers. */
  async function deliver(to: Device, from: Device, opts?: { linked?: boolean }): Promise<number> {
    const { deriveMailboxToken } = await import('@mylife/sync');
    const token = deriveMailboxToken(SHARED_SECRET, to.identity.publicKey, Date.now());
    const handlers = buildPersonGroupMailboxHandlers(depsFor(to, from, opts));
    let applied = 0;
    for (const envelope of mailbox.take(token)) {
      const outcome = await applyMailboxEnvelope(
        to.identity,
        encodeMailboxEnvelope(envelope),
        handlers,
      );
      if (outcome.kind !== 'rejected') applied += 1;
    }
    return applied;
  }

  beforeEach(() => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    mailbox = new FakeMailbox();
    a = makeDevice('Device A');
    b = makeDevice('Device B');
  });

  it('forms a mutually attested two-device group over the mailbox', async () => {
    const proposed = await proposePersonGroupRevision(depsFor(a, b), {
      add: [
        { deviceId: a.identity.publicKey, label: 'Laptop' },
        { deviceId: b.identity.publicKey, label: 'Phone' },
      ],
    });
    expect(proposed).toMatchObject({ ok: true, assembled: false, parked: 1 });
    // A has not stored anything yet: nothing is a group until B attests.
    expect(readPersonGroup(a.db, a.identity.publicKey)).toBeNull();

    // B receives the proposal and parks an accept.
    expect(await deliver(b, a)).toBe(1);
    // A receives the accept, assembles, and stores.
    expect(await deliver(a, b)).toBe(1);

    const stored = readPersonGroup(a.db, a.identity.publicKey);
    expect(stored).not.toBeNull();
    expect(stored!.doc.revision).toBe(1);
    expect(stored!.doc.devices.map((d) => d.deviceId).sort()).toEqual(
      [a.identity.publicKey, b.identity.publicKey].sort(),
    );
  });

  it('NC-1 trust floor: a merely-PAIRED peer is never co-signed for', async () => {
    await proposePersonGroupRevision(depsFor(a, b), {
      add: [
        { deviceId: a.identity.publicKey, label: 'Laptop' },
        { deviceId: b.identity.publicKey, label: 'Phone' },
      ],
    });
    // B is paired with A but has NOT linked A as its own device.
    expect(await deliver(b, a, { linked: false })).toBe(0);
    expect(readPersonGroup(a.db, a.identity.publicKey)).toBeNull();
  });

  it('refuses to add a device that is not own-device-linked', async () => {
    const stranger = makeDevice('Stranger');
    const result = await proposePersonGroupRevision(depsFor(a, b), {
      add: [{ deviceId: stranger.identity.publicKey, label: 'Not mine' }],
    });
    expect(result).toEqual({ ok: false, reason: 'not_linked' });
    stranger.test.close();
  });

  it('rotates the group secret when a device is removed', async () => {
    await proposePersonGroupRevision(depsFor(a, b), {
      add: [
        { deviceId: a.identity.publicKey, label: 'Laptop' },
        { deviceId: b.identity.publicKey, label: 'Phone' },
      ],
    });
    await deliver(b, a);
    await deliver(a, b);
    const before = readPersonGroup(a.db, a.identity.publicKey)!;

    const removed = await proposePersonGroupRevision(depsFor(a, b), {
      remove: [b.identity.publicKey],
    });
    expect(removed).toMatchObject({ ok: true, assembled: true });
    const after = readPersonGroup(a.db, a.identity.publicKey)!;
    expect(after.doc.revision).toBe(before.doc.revision + 1);
    expect(after.doc.devices).toHaveLength(1);
    // The expelled device cannot derive future per-context ids.
    expect(after.secretHex).not.toBe(before.secretHex);
  });

  it('AC-1: a saved presentation profile renames the identity and re-signs community profiles', () => {
    // A owns a community and is a member of it.
    const signed = createCommunity(a.identity, {
      name: 'Align Club',
      channels: [{ id: 'general', name: 'General' }],
    });
    const { storeOwnedCommunityForTest } = {
      storeOwnedCommunityForTest: () => {
        const { link } = createCommunityInvite(a.identity, signed, 60_000);
        return link;
      },
    };
    const link = storeOwnedCommunityForTest();
    expect(joinCommunityFromLink(a.db, a.identity, link).ok).toBe(true);
    const communityId = signed.descriptor.communityId;

    savePresentationProfile(a.db, { displayName: 'River Person' });
    const result = alignPersonIdentity(a.db, a.identity);
    expect(result.renamedIdentity).toBe(true);
    expect(result.updatedCommunities).toContain(communityId);

    const mine = listCommunityProfileEvents(a.db, communityId)
      .filter((e) => e.memberDeviceId === a.identity.publicKey);
    expect(mine[mine.length - 1]!.displayName).toBe('River Person');

    // Idempotent: a second pass changes nothing.
    expect(alignPersonIdentity(a.db, a.identity).changed).toBe(false);
  });

  it('a per-community override beats the global name and is applied on alignment', () => {
    const signed = createCommunity(a.identity, {
      name: 'Pseudonym Club',
      channels: [{ id: 'general', name: 'General' }],
    });
    const { link } = createCommunityInvite(a.identity, signed, 60_000);
    expect(joinCommunityFromLink(a.db, a.identity, link).ok).toBe(true);
    const communityId = signed.descriptor.communityId;

    savePresentationProfile(a.db, { displayName: 'River Person' });
    setPresentationOverride(a.db, communityId, 'Anon Otter');
    alignPersonIdentity(a.db, a.identity);

    const mine = listCommunityProfileEvents(a.db, communityId)
      .filter((e) => e.memberDeviceId === a.identity.publicKey);
    expect(mine[mine.length - 1]!.displayName).toBe('Anon Otter');
    // The global name is untouched.
    expect(readPresentationProfile(a.db)!.displayName).toBe('River Person');

    // Clearing the override falls back to the global name.
    setPresentationOverride(a.db, communityId, null);
    alignPersonIdentity(a.db, a.identity);
    const after = listCommunityProfileEvents(a.db, communityId)
      .filter((e) => e.memberDeviceId === a.identity.publicKey);
    expect(after[after.length - 1]!.displayName).toBe('River Person');
  });

  it('alignment is a no-op with no presentation profile', () => {
    expect(alignPersonIdentity(a.db, a.identity)).toEqual({
      changed: false,
      renamedIdentity: false,
      updatedCommunities: [],
    });
  });

  it('readPersonLinks starts empty and the @dm scope is separate', () => {
    expect(readPersonLinks(a.db, 'nope')).toEqual([]);
    expect(readPersonLinks(a.db, DM_PERSON_LINKS_SCOPE)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// App-layer adversarial review (2026-07-29, second reviewer). Each block pins
// a defect that WAS exploitable or feature-breaking before the fix.
// ---------------------------------------------------------------------------

describe('adversarial app regressions', () => {
  let a: Device;
  let b: Device;
  let c: Device;
  let mailbox: FakeMailbox;
  const SHARED = 'c'.repeat(64);

  function deps(self: Device, peers: Device[]): PersonCeremonyDeps {
    return {
      db: self.db,
      identity: self.identity,
      listOwnDeviceIds: () => peers.map((p) => p.identity.publicKey),
      listDmPeerIds: () => [],
      resolvePairedDevice: (deviceId) => {
        const peer = peers.find((p) => p.identity.publicKey === deviceId);
        return peer
          ? { dhPublicKey: peer.identity.dhPublicKey, sharedSecretHex: SHARED }
          : null;
      },
      parkEnvelope: async (token, envelope) => mailbox.park(token, envelope),
    };
  }

  async function deliverTo(to: Device, peers: Device[]): Promise<number> {
    const { deriveMailboxToken } = await import('@mylife/sync');
    const token = deriveMailboxToken(SHARED, to.identity.publicKey, Date.now());
    const handlers = buildPersonGroupMailboxHandlers(deps(to, peers));
    let applied = 0;
    for (const envelope of mailbox.take(token)) {
      const outcome = await applyMailboxEnvelope(to.identity, encodeMailboxEnvelope(envelope), handlers);
      if (outcome.kind !== 'rejected') applied += 1;
    }
    return applied;
  }

  beforeEach(() => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    mailbox = new FakeMailbox();
    a = makeDevice('A');
    b = makeDevice('B');
    c = makeDevice('C');
  });

  it('HIGH-2: a device CAN be added to an existing group (the invite path)', async () => {
    // Genesis [A, B].
    await proposePersonGroupRevision(deps(a, [b, c]), {
      add: [
        { deviceId: a.identity.publicKey, label: 'A' },
        { deviceId: b.identity.publicKey, label: 'B' },
      ],
    });
    await deliverTo(b, [a]);
    await deliverTo(a, [b]);
    expect(readPersonGroup(a.db, a.identity.publicKey)!.doc.revision).toBe(1);

    // Now ADD C. C holds no group, so it must attest revision 2 as an invitee.
    const added = await proposePersonGroupRevision(deps(a, [b, c]), {
      add: [{ deviceId: c.identity.publicKey, label: 'C' }],
    });
    expect(added.ok).toBe(true);
    // Both existing members and the invitee co-sign.
    expect(await deliverTo(b, [a])).toBe(1);
    expect(await deliverTo(c, [a])).toBe(1);
    await deliverTo(a, [b, c]);

    const stored = readPersonGroup(a.db, a.identity.publicKey)!;
    expect(stored.doc.revision).toBe(2);
    expect(stored.doc.devices).toHaveLength(3);
    expect(stored.doc.devices.map((d) => d.deviceId).sort())
      .toEqual([a, b, c].map((d) => d.identity.publicKey).sort());
  });

  it('HIGH-3: a second proposal is refused while one is pending', async () => {
    await proposePersonGroupRevision(deps(a, [b, c]), {
      add: [
        { deviceId: a.identity.publicKey, label: 'A' },
        { deviceId: b.identity.publicKey, label: 'B' },
      ],
    });
    // The first ceremony has not completed (B has not co-signed yet).
    const second = await proposePersonGroupRevision(deps(a, [b, c]), {
      add: [{ deviceId: c.identity.publicKey, label: 'C' }],
    });
    expect(second).toEqual({ ok: false, reason: 'proposal_pending' });
    // Cancelling frees the lane.
    const pending = listPendingPersonProposals(a.db);
    expect(pending).toHaveLength(1);
    cancelPersonProposal(a.db, pending[0]!.id);
    const third = await proposePersonGroupRevision(deps(a, [b, c]), {
      add: [
        { deviceId: a.identity.publicKey, label: 'A' },
        { deviceId: b.identity.publicKey, label: 'B' },
      ],
    });
    expect(third.ok).toBe(true);
  });

  it('M-2: a stale pending proposal is swept and stops blocking new ones', async () => {
    await proposePersonGroupRevision(deps(a, [b, c]), {
      add: [
        { deviceId: a.identity.publicKey, label: 'A' },
        { deviceId: b.identity.publicKey, label: 'B' },
      ],
      // Authored a week ago.
    });
    const rows = listPendingPersonProposals(a.db);
    expect(rows).toHaveLength(1);
    a.db.execute(
      `UPDATE ${PERSON_PROPOSALS_TABLE} SET created_at = ? WHERE id = ?`,
      ['2026-07-01T00:00:00.000Z', rows[0]!.id],
    );
    expect(sweepStalePersonProposals(a.db, Date.parse('2026-07-29T12:00:00.000Z'))).toBe(1);
    expect(listPendingPersonProposals(a.db)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Round-2 app review: the resurrection class. HIGH-A (an expelled device
// re-admits itself because its own-device link survived) and HIGH-B (two
// coordinators building concurrent successors resurrect each other's
// expulsions via the ordering tie-break) are the SAME defect: a removal was
// not durable. Tombstones make it durable.
// ---------------------------------------------------------------------------

describe('removal durability (round-2 regressions)', () => {
  let a: Device;
  let b: Device;
  let mailbox: FakeMailbox;
  const SHARED = 'c'.repeat(64);
  let unlinked: string[];

  function deps(self: Device, peers: Device[], ownIds?: string[]): PersonCeremonyDeps {
    return {
      db: self.db,
      identity: self.identity,
      listOwnDeviceIds: () => ownIds ?? peers.map((p) => p.identity.publicKey),
      listDmPeerIds: () => [],
      resolvePairedDevice: (deviceId) => {
        const peer = peers.find((p) => p.identity.publicKey === deviceId);
        return peer ? { dhPublicKey: peer.identity.dhPublicKey, sharedSecretHex: SHARED } : null;
      },
      parkEnvelope: async (token, envelope) => mailbox.park(token, envelope),
      revokeOwnDeviceLink: (deviceId) => { unlinked.push(deviceId); },
    };
  }

  async function deliverTo(to: Device, peers: Device[], ownIds?: string[]): Promise<number> {
    const { deriveMailboxToken } = await import('@mylife/sync');
    const token = deriveMailboxToken(SHARED, to.identity.publicKey, Date.now());
    const handlers = buildPersonGroupMailboxHandlers(deps(to, peers, ownIds));
    let applied = 0;
    for (const envelope of mailbox.take(token)) {
      const outcome = await applyMailboxEnvelope(to.identity, encodeMailboxEnvelope(envelope), handlers);
      if (outcome.kind !== 'rejected') applied += 1;
    }
    return applied;
  }

  beforeEach(() => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    mailbox = new FakeMailbox();
    unlinked = [];
    a = makeDevice('A');
    b = makeDevice('B');
  });

  async function formAB(): Promise<void> {
    await proposePersonGroupRevision(deps(a, [b]), {
      add: [
        { deviceId: a.identity.publicKey, label: 'A' },
        { deviceId: b.identity.publicKey, label: 'B' },
      ],
    });
    await deliverTo(b, [a]);
    await deliverTo(a, [b]);
  }

  it('HIGH-A: removing a device revokes its own-device link', async () => {
    await formAB();
    const removed = await removeDevicesFromPerson(deps(a, [b]), [b.identity.publicKey]);
    expect(removed.ok).toBe(true);
    // The link revocation is what stops the expelled device passing the
    // propose-side trust gate forever.
    expect(unlinked).toEqual([b.identity.publicKey]);
  });

  it('HIGH-A: an expelled device cannot propose itself back in', async () => {
    await formAB();
    const before = readPersonGroup(a.db, a.identity.publicKey)!;
    await removeDevicesFromPerson(deps(a, [b]), [b.identity.publicKey]);
    const afterRemoval = readPersonGroup(a.db, a.identity.publicKey)!;
    expect(afterRemoval.doc.devices).toHaveLength(1);
    expect(afterRemoval.doc.removed).toContain(b.identity.publicKey);
    expect(afterRemoval.secretHex).not.toBe(before.secretHex);

    // B (expelled) tries to re-capture: it proposes a revision re-listing both.
    // Even if its own-device link somehow survived on A, the doc must drop B
    // from the tombstone set to list it, which the signer gate refuses.
    mailbox.take(await (async () => {
      const { deriveMailboxToken } = await import('@mylife/sync');
      return deriveMailboxToken(SHARED, a.identity.publicKey, Date.now());
    })());
    const recapture = await proposePersonGroupRevision(
      // B still believes it is linked to A.
      deps(b, [a], [a.identity.publicKey]),
      { add: [{ deviceId: a.identity.publicKey, label: 'A' }] },
    );
    // Whatever B manages to park, A must not adopt a doc that forgets its own
    // removal of B.
    await deliverTo(a, [b], [b.identity.publicKey]);
    const final = readPersonGroup(a.db, a.identity.publicKey)!;
    expect(final.doc.devices.map((d) => d.deviceId)).toEqual([a.identity.publicKey]);
    expect(final.doc.removed).toContain(b.identity.publicKey);
    void recapture;
  });

  it('HIGH-B: a doc that FORGETS a removal is never acceptable, whatever its timestamp', async () => {
    await formAB();
    const rev1 = readPersonGroup(a.db, a.identity.publicKey)!.doc;
    await removeDevicesFromPerson(deps(a, [b]), [b.identity.publicKey]);
    const rev2 = readPersonGroup(a.db, a.identity.publicKey)!.doc;

    // A concurrent coordinator builds its own revision 2 against rev1 -- it
    // never learned about the removal, so its `removed` set is empty. Even at
    // a LATER updatedAt (which used to win the tie-break), it is rejected.
    const built = buildPersonGroupRevision({
      previous: rev1,
      secretHex: 'd'.repeat(64),
      add: [],
      now: '2026-07-29T23:59:59.999Z',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.doc.removed).not.toContain(b.identity.publicKey);
    const canonical = canonicalPersonGroupBytes(built.doc);
    const forked = assemblePersonGroupDoc(built.doc, {
      [a.identity.publicKey]: signPersonCanonicalBytes(a.identity, canonical),
      [b.identity.publicKey]: signPersonCanonicalBytes(b.identity, canonical),
    });
    expect(acceptPersonGroupRevision(rev2, forked)).toEqual({
      accepted: false,
      reason: 'forgets_removal',
    });
  });

  it('a deliberate RE-ADD is still possible (the tombstone is not a life sentence)', async () => {
    await formAB();
    await removeDevicesFromPerson(deps(a, [b]), [b.identity.publicKey]);
    // Explicitly re-adding B clears its tombstone, because the re-add is
    // visible in the signed bytes every sibling co-signs.
    const readd = await proposePersonGroupRevision(deps(a, [b]), {
      add: [{ deviceId: b.identity.publicKey, label: 'B again' }],
    });
    expect(readd.ok).toBe(true);
    await deliverTo(b, [a]);
    await deliverTo(a, [b]);
    const final = readPersonGroup(a.db, a.identity.publicKey)!;
    expect(final.doc.devices.map((d) => d.deviceId).sort())
      .toEqual([a.identity.publicKey, b.identity.publicKey].sort());
    expect(final.doc.removed).not.toContain(b.identity.publicKey);
  });
});
