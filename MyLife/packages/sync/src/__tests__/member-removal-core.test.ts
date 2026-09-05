/**
 * Community member removal, P2 dispatch + apply (Plan 28): the memberRemoval
 * dispatcher slot + the applyMemberRemoval handler a survivor's drain runs.
 *
 * Proves the P2 contract:
 *  1. A full drain of the survivor's own removal token applies the removal for
 *     real: descriptor revision adopted, the removed device's roster row closed
 *     (getWorkspaceMembers -- the SAME predicate resolveInboundAuth and the
 *     outbound session gate use -- no longer lists it), and the survivor's
 *     epoch key advanced (so an old-epoch session from the removed device hits
 *     the groupEpoch-mismatch refusal, never a pairwise fallback).
 *  2. A replayed envelope is rejected (monotonic revision guard).
 *  3. A non-owner sender cannot apply a removal, even carrying the owner-signed
 *     descriptor (sender/owner binding).
 *  4. A stale (older-revision) descriptor cannot reopen membership (AC-5).
 *  5. An unknown community is dropped fail-closed (a removal never introduces
 *     a community).
 *  6. The removed device is never a recipient: its own drain applies nothing,
 *     and a misdelivered survivor envelope cannot be opened by it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyMemberRemoval,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  removeCommunityMember,
  republishCommunityDescriptor,
  revokeFromWorkspace,
  rotateWorkspaceKey,
} from '../index';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import {
  addWorkspaceMember,
  createWorkspace,
  getKeyWraps,
  getWorkspaceMembers,
} from '../db/queries';
import {
  createCommunity,
  getCommunity,
  removeMemberRevision,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import {
  commitMemberRemoval,
  createGroupCommit,
  getCurrentEpochKey,
  storeReceivedKeyWrap,
  type GroupMemberKey,
} from '../protocol/group-keys';
import { createSignedIdentityBundle } from '../protocol/identity-bundle';
import {
  deriveCommunityRemovalToken,
  sealMemberRemovalFanOut,
  type SealedMemberRemoval,
} from '../protocol/member-removal-mailbox';
import { encodeMailboxEnvelope } from '../protocol/mailbox';
import { applyMailboxEnvelope } from '../protocol/mailbox-dispatch';
import { runMailboxDrainJob } from '../protocol/mailbox-drain';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';

const NOW = '2026-07-02T00:00:00.000Z';
const LATER = '2026-07-02T01:00:00.000Z';

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

type Identity = ReturnType<typeof generateDeviceIdentity>;

/** Store-and-forward mailbox backend (mirrors mailbox-drain.test.ts). */
class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;

  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
    if (!token.trim()) throw new Error('Relay token is required.');
    const drained = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    return {
      async send(): Promise<void> {},
      onMessage: (handler) => {
        for (const bytes of drained) handler(new Uint8Array(bytes));
      },
      close: async () => {},
    };
  }

  destroy(): void { this.destroyed = true; }
}

const noWait = (): Promise<void> => Promise.resolve();

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

const asMember = (id: Identity) => ({ deviceId: id.publicKey, role: 'member' as const, dhPublicKey: id.dhPublicKey });
const asKey = (id: Identity): GroupMemberKey => ({ deviceId: id.publicKey, dhPublicKey: id.dhPublicKey });

/** Mirror the app's stored-community shape on one device (descriptor + workspace + roster). */
function storeCommunityOn(db: InMemoryTestDatabase, me: Identity, signed: SignedCommunityDescriptor): void {
  const d = signed.descriptor;
  upsertCommunity(db.adapter, signed, me.publicKey, NOW);
  createWorkspace(db.adapter, {
    id: d.communityId,
    displayName: d.name,
    workspaceType: 'community',
    createdByDeviceId: d.ownerDeviceId,
    createdAt: NOW,
    rotatedAt: null,
    currentKeyVersion: 0,
    archivedAt: null,
  });
  for (const member of d.members) {
    addWorkspaceMember(db.adapter, {
      workspaceId: d.communityId,
      deviceId: member.deviceId,
      role: member.role,
      invitedByDeviceId: d.ownerDeviceId,
      invitedAt: NOW,
      removedAt: null,
    });
  }
}

interface Fixture {
  owner: Identity;
  alice: Identity; // the surviving member whose drain we exercise
  bo: Identity;    // the removed member
  community: SignedCommunityDescriptor; // revision 1, lists all three
  revised: SignedCommunityDescriptor;   // revision 2, bo dropped
  communityId: string;
  genesisNonce: string;
  ownerDb: InMemoryTestDatabase;
  aliceDb: InMemoryTestDatabase;
  /** The single fan-out envelope, addressed to alice, carrying her epoch-2 wrap. */
  sealed: SealedMemberRemoval[];
}

/**
 * Owner founds a 3-member community with a REAL epoch 1 wrapped for everyone,
 * alice imports her epoch-1 wrap (a converged member), then the owner removes
 * bo: removal revision + commitMemberRemoval (epoch 2, survivors only) + the
 * per-survivor mailbox fan-out.
 */
function removalFixture(): Fixture {
  const owner = generateDeviceIdentity('Owner');
  const alice = generateDeviceIdentity('Alice');
  const bo = generateDeviceIdentity('Bo');

  const community = createCommunity(owner, {
    name: 'Surf Club',
    channels: [{ id: 'general', name: 'general' }],
    members: [asMember(alice), asMember(bo)],
    now: NOW,
  });
  const { communityId, genesisNonce } = community.descriptor;

  const ownerDb = freshDb();
  storeCommunityOn(ownerDb, owner, community);
  createGroupCommit(ownerDb.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [asKey(owner), asKey(alice), asKey(bo)],
    now: NOW,
  });

  const aliceDb = freshDb();
  storeCommunityOn(aliceDb, alice, community);
  const aliceWrap1 = getKeyWraps(ownerDb.adapter, communityId, 1)
    .find((w) => w.wrappedForDeviceId === alice.publicKey)!;
  storeReceivedKeyWrap(aliceDb.adapter, aliceWrap1, alice);
  expect(getCurrentEpochKey(aliceDb.adapter, communityId, alice)?.epoch).toBe(1);

  // The owner removes bo: signed revision + real epoch rotation (survivors only).
  const revised = removeMemberRevision(owner, community, bo.publicKey, LATER);
  upsertCommunity(ownerDb.adapter, revised, owner.publicKey, LATER);
  commitMemberRemoval(ownerDb.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [asKey(owner), asKey(alice), asKey(bo)],
    removedDeviceId: bo.publicKey,
    now: LATER,
  });
  const aliceWraps2 = getKeyWraps(ownerDb.adapter, communityId, 2)
    .filter((w) => w.wrappedForDeviceId === alice.publicKey);
  expect(aliceWraps2.length).toBeGreaterThan(0);

  const sealed = sealMemberRemovalFanOut({
    owner,
    communityId,
    communitySecret: genesisNonce,
    descriptor: revised,
    removedDeviceId: bo.publicKey,
    ownerBundle: createSignedIdentityBundle(owner),
    recipients: [{ deviceId: alice.publicKey, dhPublicKey: alice.dhPublicKey, keyWraps: aliceWraps2 }],
    now: LATER,
  });

  return { owner, alice, bo, community, revised, communityId, genesisNonce, ownerDb, aliceDb, sealed };
}

describe('applyMemberRemoval over a full drain (survivor converges)', () => {
  it('drains the removal token, adopts the revision, closes the roster row, and advances the epoch', async () => {
    const f = removalFixture();
    const backend = new MailboxRelayBackend();
    backend.park(f.sealed[0]!.token, encodeMailboxEnvelope(f.sealed[0]!.envelope));

    const drain = await runMailboxDrainJob({
      identity: f.alice,
      backend,
      relayUrl: 'ws://test',
      peers: [],
      handlers: { ...applyMemberRemoval({ db: f.aliceDb.adapter, self: f.alice, now: () => LATER }) },
      // The FF3 lesson: the survivor drains its OWN removal token, re-derived
      // from persisted community state (a token nobody polls never delivers).
      extraTokens: [{
        token: deriveCommunityRemovalToken(f.genesisNonce, f.communityId, f.alice.publicKey),
        label: `member-removal:${f.communityId}`,
      }],
      waitForDrain: noWait,
    });

    expect(drain.memberRemovals).toBe(1);

    // The signed revision took effect: bo is out of the stored descriptor.
    const stored = getCommunity(f.aliceDb.adapter, f.communityId)!;
    expect(stored.descriptor.revision).toBe(f.revised.descriptor.revision);
    expect(stored.descriptor.members.some((m) => m.deviceId === f.bo.publicKey)).toBe(false);

    // The roster row is closed on the SURVIVOR's device: getWorkspaceMembers is
    // the exact predicate resolveInboundAuth + the outbound session gate use.
    const active = getWorkspaceMembers(f.aliceDb.adapter, f.communityId).map((m) => m.deviceId);
    expect(active).not.toContain(f.bo.publicKey);
    expect(active).toContain(f.alice.publicKey);
    expect(active).toContain(f.owner.publicKey);

    // The wrap applied: alice now holds epoch 2, so a session from bo (stuck on
    // epoch 1) hits the groupEpoch-mismatch refusal instead of a pairwise fallback.
    expect(getCurrentEpochKey(f.aliceDb.adapter, f.communityId, f.alice)?.epoch).toBe(2);
  });

  it('rejects a replay of the same envelope (monotonic revision guard)', async () => {
    const f = removalFixture();
    const handlers = { ...applyMemberRemoval({ db: f.aliceDb.adapter, self: f.alice, now: () => LATER }) };
    const bytes = encodeMailboxEnvelope(f.sealed[0]!.envelope);

    const first = await applyMailboxEnvelope(f.alice, bytes, handlers);
    expect(first.kind).toBe('member-removal');

    const replay = await applyMailboxEnvelope(f.alice, bytes, handlers);
    expect(replay.kind).toBe('rejected');
    expect(getCommunity(f.aliceDb.adapter, f.communityId)!.descriptor.revision)
      .toBe(f.revised.descriptor.revision);
  });

  it('drops the envelope when no memberRemoval handler is composed (fail-closed)', async () => {
    const f = removalFixture();
    const outcome = await applyMailboxEnvelope(f.alice, encodeMailboxEnvelope(f.sealed[0]!.envelope), {});
    expect(outcome.kind).toBe('rejected');
  });
});

describe('applyMemberRemoval fail-closed guards', () => {
  it('rejects a removal sealed by a non-owner, even carrying the owner-signed descriptor', async () => {
    const f = removalFixture();
    // bo (the target) forges a fan-out as SENDER, reusing the legit revision.
    const forged = sealMemberRemovalFanOut({
      owner: f.bo,
      communityId: f.communityId,
      communitySecret: f.genesisNonce,
      descriptor: f.revised,
      removedDeviceId: f.owner.publicKey, // tries to evict the owner instead
      ownerBundle: createSignedIdentityBundle(f.bo),
      recipients: [{ deviceId: f.alice.publicKey, dhPublicKey: f.alice.dhPublicKey, keyWraps: [] }],
      now: LATER,
    });

    const outcome = await applyMailboxEnvelope(
      f.alice,
      encodeMailboxEnvelope(forged[0]!.envelope),
      { ...applyMemberRemoval({ db: f.aliceDb.adapter, self: f.alice, now: () => LATER }) },
    );
    expect(outcome.kind).toBe('rejected');

    // Nothing moved: revision 1 kept, owner + bo still active on alice's device.
    expect(getCommunity(f.aliceDb.adapter, f.communityId)!.descriptor.revision)
      .toBe(f.community.descriptor.revision);
    const active = getWorkspaceMembers(f.aliceDb.adapter, f.communityId).map((m) => m.deviceId);
    expect(active).toContain(f.owner.publicKey);
    expect(active).toContain(f.bo.publicKey);
  });

  it('rejects a stale (older-revision) descriptor: membership cannot be reopened (AC-5)', async () => {
    const f = removalFixture();
    const handlers = { ...applyMemberRemoval({ db: f.aliceDb.adapter, self: f.alice, now: () => LATER }) };

    // Converge first (revision 2, bo removed).
    const first = await applyMailboxEnvelope(f.alice, encodeMailboxEnvelope(f.sealed[0]!.envelope), handlers);
    expect(first.kind).toBe('member-removal');

    // A replayed OWNER-sealed envelope carrying the OLD revision-1 descriptor
    // (which still lists bo) must not roll membership back.
    const stale = sealMemberRemovalFanOut({
      owner: f.owner,
      communityId: f.communityId,
      communitySecret: f.genesisNonce,
      descriptor: f.community,
      removedDeviceId: f.bo.publicKey,
      ownerBundle: createSignedIdentityBundle(f.owner),
      recipients: [{ deviceId: f.alice.publicKey, dhPublicKey: f.alice.dhPublicKey, keyWraps: [] }],
      now: LATER,
    });
    const outcome = await applyMailboxEnvelope(f.alice, encodeMailboxEnvelope(stale[0]!.envelope), handlers);
    expect(outcome.kind).toBe('rejected');

    const stored = getCommunity(f.aliceDb.adapter, f.communityId)!;
    expect(stored.descriptor.revision).toBe(f.revised.descriptor.revision);
    expect(stored.descriptor.members.some((m) => m.deviceId === f.bo.publicKey)).toBe(false);
    expect(getWorkspaceMembers(f.aliceDb.adapter, f.communityId).map((m) => m.deviceId))
      .not.toContain(f.bo.publicKey);
  });

  it('rejects a removal for a community this device does not hold (never introduces one)', async () => {
    const f = removalFixture();
    const strangerDb = freshDb(); // alice's identity, but no stored community
    const outcome = await applyMailboxEnvelope(
      f.alice,
      encodeMailboxEnvelope(f.sealed[0]!.envelope),
      { ...applyMemberRemoval({ db: strangerDb.adapter, self: f.alice, now: () => LATER }) },
    );
    expect(outcome.kind).toBe('rejected');
    expect(getCommunity(strangerDb.adapter, f.communityId)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P3: removeCommunityMember (the OWNER-side end-to-end orchestration).
// ---------------------------------------------------------------------------

interface OrchestrationHarness {
  owner: Identity;
  alice: Identity;
  bo: Identity;
  community: SignedCommunityDescriptor;
  communityId: string;
  genesisNonce: string;
  ownerDb: InMemoryTestDatabase;
  parked: { token: string; envelope: Parameters<typeof encodeMailboxEnvelope>[0] }[];
  republished: { url: string; revision: number }[];
  deps: Parameters<typeof removeCommunityMember>[0];
}

/** Owner db with a 3-member community (one https node host) + a real epoch 1. */
function orchestrationHarness(options: { keylessBo?: boolean; parkOk?: boolean } = {}): OrchestrationHarness {
  const owner = generateDeviceIdentity('Owner');
  const alice = generateDeviceIdentity('Alice');
  const bo = generateDeviceIdentity('Bo');
  const boMember = options.keylessBo
    ? { deviceId: bo.publicKey, role: 'member' as const } // FF3 roster-only joiner: no key material
    : asMember(bo);
  const community = createCommunity(owner, {
    name: 'Surf Club',
    channels: [{ id: 'general', name: 'general' }],
    members: [asMember(alice), boMember],
    hosts: ['https://node.example'],
    now: NOW,
  });
  const ownerDb = freshDb();
  storeCommunityOn(ownerDb, owner, community);
  createGroupCommit(ownerDb.adapter, {
    workspaceId: community.descriptor.communityId,
    committer: owner,
    members: options.keylessBo
      ? [asKey(owner), asKey(alice)]
      : [asKey(owner), asKey(alice), asKey(bo)],
    now: NOW,
  });

  const parked: OrchestrationHarness['parked'] = [];
  const republished: OrchestrationHarness['republished'] = [];
  return {
    owner,
    alice,
    bo,
    community,
    communityId: community.descriptor.communityId,
    genesisNonce: community.descriptor.genesisNonce,
    ownerDb,
    parked,
    republished,
    deps: {
      db: ownerDb.adapter,
      owner,
      parkEnvelope: (token, envelope) => {
        if (options.parkOk === false) return false;
        parked.push({ token, envelope });
        return true;
      },
      republishDescriptor: (url, signed) => {
        republished.push({ url, revision: signed.descriptor.revision });
        return true;
      },
      now: () => LATER,
    },
  };
}

describe('removeCommunityMember (owner orchestration end to end)', () => {
  it('revises, rotates, fans out one envelope per keyed survivor, and republishes to every node host', async () => {
    const h = orchestrationHarness();
    const result = await removeCommunityMember(h.deps, h.communityId, h.bo.publicKey);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision).toBe(h.community.descriptor.revision + 1);
    expect(result.epoch).toBe(2);
    expect(result.envelopesParked).toBe(1); // alice only: never the removed device, never self
    expect(result.nodesAttempted).toBe(1);
    expect(result.nodesRepublished).toBe(1);

    // Local truth on the OWNER device: revision adopted, roster closed, epoch advanced,
    // and the new epoch holds NO wrap for the removed device.
    const stored = getCommunity(h.ownerDb.adapter, h.communityId)!;
    expect(stored.descriptor.revision).toBe(h.community.descriptor.revision + 1);
    expect(stored.descriptor.members.some((m) => m.deviceId === h.bo.publicKey)).toBe(false);
    expect(getWorkspaceMembers(h.ownerDb.adapter, h.communityId).map((m) => m.deviceId))
      .not.toContain(h.bo.publicKey);
    expect(getCurrentEpochKey(h.ownerDb.adapter, h.communityId, h.owner)?.epoch).toBe(2);
    expect(getKeyWraps(h.ownerDb.adapter, h.communityId, 2)
      .some((w) => w.wrappedForDeviceId === h.bo.publicKey)).toBe(false);

    // The single parked envelope is addressed to alice's removal token and is
    // EXACTLY what her P2 drain applies: she converges end to end.
    expect(h.parked[0]!.token)
      .toBe(deriveCommunityRemovalToken(h.genesisNonce, h.communityId, h.alice.publicKey));
    const aliceDb = freshDb();
    storeCommunityOn(aliceDb, h.alice, h.community);
    const outcome = await applyMailboxEnvelope(
      h.alice,
      encodeMailboxEnvelope(h.parked[0]!.envelope),
      { ...applyMemberRemoval({ db: aliceDb.adapter, self: h.alice, now: () => LATER }) },
    );
    expect(outcome.kind).toBe('member-removal');
    expect(getCurrentEpochKey(aliceDb.adapter, h.communityId, h.alice)?.epoch).toBe(2);
    expect(getWorkspaceMembers(aliceDb.adapter, h.communityId).map((m) => m.deviceId))
      .not.toContain(h.bo.publicKey);

    // Republish went to the descriptor's http(s) host with the REVISED descriptor.
    expect(h.republished).toEqual([{ url: 'https://node.example', revision: h.community.descriptor.revision + 1 }]);
  });

  it('is owner-only: a non-owner caller changes nothing (AC-4)', async () => {
    const h = orchestrationHarness();
    const result = await removeCommunityMember(
      { ...h.deps, owner: h.alice },
      h.communityId,
      h.bo.publicKey,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not_owner');
    expect(h.parked).toHaveLength(0);
    expect(h.republished).toHaveLength(0);
    expect(getCommunity(h.ownerDb.adapter, h.communityId)!.descriptor.revision)
      .toBe(h.community.descriptor.revision);
    expect(getWorkspaceMembers(h.ownerDb.adapter, h.communityId).map((m) => m.deviceId))
      .toContain(h.bo.publicKey);
  });

  it('rejects unknown community, non-member target, and owner self-removal', async () => {
    const h = orchestrationHarness();
    const unknown = await removeCommunityMember(h.deps, 'not-a-community', h.bo.publicKey);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe('unknown_community');

    const stranger = generateDeviceIdentity('Stranger');
    const notMember = await removeCommunityMember(h.deps, h.communityId, stranger.publicKey);
    expect(notMember.ok).toBe(false);
    if (!notMember.ok) expect(notMember.reason).toBe('not_a_member');

    const self = await removeCommunityMember(h.deps, h.communityId, h.owner.publicKey);
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.reason).toBe('cannot_remove_owner');

    expect(h.parked).toHaveLength(0);
  });

  it('removes an FF3 roster-only (keyless) member without wrap errors (AC-7)', async () => {
    const h = orchestrationHarness({ keylessBo: true });
    const result = await removeCommunityMember(h.deps, h.communityId, h.bo.publicKey);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.epoch).toBe(2);
    expect(result.envelopesParked).toBe(1); // alice; the keyless member could never be sealed to anyway
    expect(getCommunity(h.ownerDb.adapter, h.communityId)!.descriptor.members
      .some((m) => m.deviceId === h.bo.publicKey)).toBe(false);
  });

  it('reports honest counts when the relay park fails (local rotation still lands)', async () => {
    const h = orchestrationHarness({ parkOk: false });
    const result = await removeCommunityMember(h.deps, h.communityId, h.bo.publicKey);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelopesParked).toBe(0);
    expect(result.survivorsToNotify).toBe(1);
    expect(getCurrentEpochKey(h.ownerDb.adapter, h.communityId, h.owner)?.epoch).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// P3: republishCommunityDescriptor (the descriptor-only node publish client).
// ---------------------------------------------------------------------------

describe('republishCommunityDescriptor (community-node client)', () => {
  function nodeStub(publishStatus = 200) {
    const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
    const fetchFn = (async (url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      const target = String(url);
      calls.push({
        url: target,
        method: init?.method ?? 'GET',
        headers: init?.headers ?? {},
        body: init?.body ? JSON.parse(init.body) : null,
      });
      if (target.endsWith('/challenge')) {
        return { ok: true, status: 200, json: async () => ({ nonce: 'n-1' }) };
      }
      if (target.endsWith('/publish')) {
        return {
          ok: publishStatus === 200,
          status: publishStatus,
          json: async () => (publishStatus === 200 ? { ok: true } : { reason: 'not_owner' }),
        };
      }
      return { ok: false, status: 404, json: async () => null };
    }) as unknown as typeof fetch;
    return { calls, fetchFn };
  }

  it('challenges, signs as the owner, and POSTs a descriptor-only publish body', async () => {
    const owner = generateDeviceIdentity('Owner');
    const community = createCommunity(owner, { name: 'Club', channels: [], now: NOW });
    const { calls, fetchFn } = nodeStub();

    const result = await republishCommunityDescriptor({
      baseUrl: 'https://node.example/',
      identity: owner,
      descriptor: community,
      fetchFn,
      now: LATER,
    });
    expect(result.ok).toBe(true);

    const cid = encodeURIComponent(community.descriptor.communityId);
    expect(calls[0]!.url).toBe(`https://node.example/community/${cid}/challenge`);
    const publish = calls[1]!;
    expect(publish.url).toBe(`https://node.example/community/${cid}/publish`);
    expect(publish.method).toBe('POST');
    expect(publish.headers['x-mk-device']).toBe(owner.publicKey);
    expect(publish.headers['x-mk-nonce']).toBe('n-1');
    expect(typeof publish.headers['x-mk-sig']).toBe('string');
    const body = publish.body as { descriptor: SignedCommunityDescriptor; snapshots: unknown[] };
    expect(body.snapshots).toEqual([]);
    expect(body.descriptor.descriptor.communityId).toBe(community.descriptor.communityId);
    expect(body.descriptor.signature).toBe(community.signature);
  });

  it('surfaces a node rejection honestly (never claims a republish that failed)', async () => {
    const owner = generateDeviceIdentity('Owner');
    const community = createCommunity(owner, { name: 'Club', channels: [], now: NOW });
    const { fetchFn } = nodeStub(401);
    const result = await republishCommunityDescriptor({
      baseUrl: 'https://node.example',
      identity: owner,
      descriptor: community,
      fetchFn,
      now: LATER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_owner');
  });
});

describe('red-team: wrap withholding (P5)', () => {
  it('a removal without wraps still closes membership but leaves the survivor safe-locked, never silently downgraded', async () => {
    const f = removalFixture();
    // A (compromised or buggy) owner path withholds the survivor's new-epoch
    // wrap: the envelope carries ONLY the signed revision.
    const withheld = sealMemberRemovalFanOut({
      owner: f.owner,
      communityId: f.communityId,
      communitySecret: f.genesisNonce,
      descriptor: f.revised,
      removedDeviceId: f.bo.publicKey,
      ownerBundle: createSignedIdentityBundle(f.owner),
      recipients: [{ deviceId: f.alice.publicKey, dhPublicKey: f.alice.dhPublicKey, keyWraps: [] }],
      now: LATER,
    });
    const outcome = await applyMailboxEnvelope(
      f.alice,
      encodeMailboxEnvelope(withheld[0]!.envelope),
      { ...applyMemberRemoval({ db: f.aliceDb.adapter, self: f.alice, now: () => LATER }) },
    );

    // The owner-signed revision is the membership authority: it applies.
    expect(outcome.kind).toBe('member-removal');
    expect(getWorkspaceMembers(f.aliceDb.adapter, f.communityId).map((m) => m.deviceId))
      .not.toContain(f.bo.publicKey);

    // But withholding the wrap can NEVER silently downgrade: alice stays on the
    // old epoch, locked out of new content (a session with a converged peer hits
    // the groupEpoch-mismatch refusal) until a real wrap arrives -- fail-closed,
    // not fail-open.
    expect(getCurrentEpochKey(f.aliceDb.adapter, f.communityId, f.alice)?.epoch).toBe(1);
  });
});

describe('legacy fake rotation is deprecated (NC-2, P5)', () => {
  it('revokeFromWorkspace and rotateWorkspaceKey throw without an explicit legacyOk', () => {
    const h = orchestrationHarness();
    expect(() => revokeFromWorkspace(h.ownerDb.adapter, h.communityId, h.bo.publicKey, h.owner.publicKey))
      .toThrow(/removeCommunityMember|commitMemberRemoval/);
    expect(() => rotateWorkspaceKey(h.ownerDb.adapter, h.communityId, 9))
      .toThrow(/commitMember/);
    // Nothing moved: bo is still an active member and the epoch is untouched.
    expect(getWorkspaceMembers(h.ownerDb.adapter, h.communityId).map((m) => m.deviceId))
      .toContain(h.bo.publicKey);
  });

  it('legacyOk: true keeps the pre-group-key compatibility behavior', () => {
    const h = orchestrationHarness();
    revokeFromWorkspace(h.ownerDb.adapter, h.communityId, h.bo.publicKey, h.owner.publicKey, { legacyOk: true });
    expect(getWorkspaceMembers(h.ownerDb.adapter, h.communityId).map((m) => m.deviceId))
      .not.toContain(h.bo.publicKey);
    rotateWorkspaceKey(h.ownerDb.adapter, h.communityId, 9, { legacyOk: true });
    const ws = h.ownerDb.adapter.query<{ current_key_version: number }>(
      'SELECT current_key_version FROM sync_workspaces WHERE id = ?',
      [h.communityId],
    );
    expect(ws[0]!.current_key_version).toBe(9);
  });
});

describe('the removed device gets nothing', () => {
  it('is never a fan-out recipient, and its own drain of a misdelivered envelope applies nothing', async () => {
    const f = removalFixture();
    expect(f.sealed.some((s) => s.recipientDeviceId === f.bo.publicKey)).toBe(false);

    // Even if a hostile relay re-parks alice's envelope on bo's OWN removal
    // token, bo cannot open it (sealed to alice's DH key): the drain rejects
    // and bo's local state does not move.
    const backend = new MailboxRelayBackend();
    const boToken = deriveCommunityRemovalToken(f.genesisNonce, f.communityId, f.bo.publicKey);
    backend.park(boToken, encodeMailboxEnvelope(f.sealed[0]!.envelope));

    const boDb = freshDb();
    storeCommunityOn(boDb, f.bo, f.community);
    const drain = await runMailboxDrainJob({
      identity: f.bo,
      backend,
      relayUrl: 'ws://test',
      peers: [],
      handlers: { ...applyMemberRemoval({ db: boDb.adapter, self: f.bo, now: () => LATER }) },
      extraTokens: [{ token: boToken, label: `member-removal:${f.communityId}` }],
      waitForDrain: noWait,
    });

    expect(drain.memberRemovals).toBe(0);
    expect(getCommunity(boDb.adapter, f.communityId)!.descriptor.revision)
      .toBe(f.community.descriptor.revision);
  });
});
