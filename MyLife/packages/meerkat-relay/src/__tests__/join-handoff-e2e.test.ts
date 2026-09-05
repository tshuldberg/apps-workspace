/**
 * Community feed P7 acceptance: the OWNER-side invite -> join KEY HANDOFF over a
 * REAL relay mailbox, with NO community node.
 *
 * The one honest gap P0-P6 left: joinCommunityFromLink stores the link's
 * descriptor but never tells the OWNER who joined, so a normal invite -> join
 * never minted an epoch key for the newcomer nor added it to the descriptor
 * membership. This test proves the close-the-gap exchange end to end:
 *
 * Everything is real: two fully independent @mylife/sync nodes (the multi-node
 * harness: real Ed25519/X25519 identities, a real owner-only signed
 * CommunityDescriptor with a real epoch 1, a real authored + snapshotted feed), a
 * real loopback RelayServer with the long mailbox TTL, the real community-derived
 * join tokens + pair-private mailbox seal/open primitives (buildJoinRequest /
 * processJoinRequest / applyJoinGrant), and the REAL drain (runMailboxDrainJob
 * with extraTokens) routing every envelope through the REAL dispatcher
 * (applyMailboxEnvelope). No stubs; every assertion is on real sync_ rows + real
 * drain counts + a real decrypted snapshot.
 *
 * Acceptance proven here:
 *  1. Owner founds a community (owner-only), mints epoch 1, posts a message, and
 *     builds a snapshot under epoch 1. B joins via a REAL invite link
 *     (joinCommunityFromLink): B's stored descriptor does NOT list B yet, and
 *     communityRole(B) === null (the gap).
 *  2. B builds + parks a join-request on the OWNER's join token. The owner drains
 *     its join-request token -> processJoinRequest adds B (descriptor now lists B,
 *     epoch advanced, B paired) -> parks a join-grant on B's join token.
 *  3. B drains its join-grant token -> applyJoinGrant -> B's descriptor lists B,
 *     B holds a current epoch key, B and the owner are now paired, and B can
 *     import + parse the owner's epoch-1 snapshot (FULL history).
 *  4. Negatives: a join-request with an EXPIRED or WRONG-community invite is
 *     dropped (no grant parked, communityRole(B) stays null); and a join-grant
 *     whose descriptor ownerDeviceId is a stranger is dropped by B.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorkspaceMember,
  applyJoinGrant,
  buildCommunitySnapshots,
  buildJoinRequest,
  communityRole,
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  createGroupCommit,
  createWorkspace,
  deriveCommunityJoinToken,
  encodeMailboxEnvelope,
  getCommunity,
  getCurrentEpochKey,
  getPairedDevices,
  importSnapshotFromPieces,
  joinCommunityFromLink,
  parseCommunityInviteLink,
  processJoinRequest,
  resolveChannelMessages,
  runMailboxDrainJob,
  unwrapEpochSecret,
  upsertCommunity,
  type ContentManifest,
  type DeviceIdentity,
  type GroupMemberKey,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type SealJoinGrantResult,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { WebSocketRelayBackend } from '@mylife/sync';
import { startRelayServer } from '../server';
import { InMemorySeederPieceStore } from '../index';
import {
  buildNode,
  destroyNode,
  recordChannelMessageOnNode,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

const CHANNEL = 'general';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = '2026-06-16T00:00:00.000Z';

function memberKey(identity: DeviceIdentity): GroupMemberKey {
  return { deviceId: identity.publicKey, dhPublicKey: identity.dhPublicKey };
}

/**
 * Found an OWNER-ONLY community on the owner node with a REAL epoch 1, mirroring
 * the app's storeOwnedCommunity: store the signed descriptor, create the
 * workspace (currentKeyVersion 0), add the owner member, then mint epoch 1
 * wrapped to the owner. The harness installCommunityOnNode is NOT used here
 * because it hard-codes currentKeyVersion: 1 with no real wrap, which would make
 * createGroupCommit mint epoch 2 and leave epoch 1 keyless.
 */
function foundOwnerCommunity(owner: MeerkatNode, signed: SignedCommunityDescriptor): void {
  const communityId = signed.descriptor.communityId;
  upsertCommunity(owner.db, signed, owner.identity.publicKey, NOW);
  createWorkspace(owner.db, {
    id: communityId,
    displayName: signed.descriptor.name,
    workspaceType: 'community',
    createdByDeviceId: signed.descriptor.ownerDeviceId,
    createdAt: NOW,
    rotatedAt: null,
    currentKeyVersion: 0,
    archivedAt: null,
  });
  for (const member of signed.descriptor.members) {
    addWorkspaceMember(owner.db, {
      workspaceId: communityId,
      deviceId: member.deviceId,
      role: member.role,
      invitedByDeviceId: signed.descriptor.ownerDeviceId,
      invitedAt: NOW,
      removedAt: null,
    });
  }
  // Mint epoch 1 wrapped to the owner only (owner-only community at create).
  createGroupCommit(owner.db, {
    workspaceId: communityId,
    committer: owner.identity,
    members: [memberKey(owner.identity)],
    now: NOW,
  });
}

/** Build the owner's rolling snapshot for a channel under the current epoch key. */
async function buildOwnerSnapshot(
  owner: MeerkatNode,
  communityId: string,
  events: ReturnType<typeof createChannelMessage>[],
): Promise<{ manifest: ContentManifest; pieces: Uint8Array[]; epoch: number }> {
  const store = new InMemorySeederPieceStore();
  const built = await buildCommunitySnapshots({
    db: owner.db,
    identity: owner.identity,
    communityId,
    channels: [{ channelId: CHANNEL, events }],
    pieceStore: store,
    now: NOW,
  });
  expect(built.records).toHaveLength(1);
  const record = built.records[0]!;
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) {
    pieces.push(store.get(manifest.infoHash, i) as Uint8Array);
  }
  return { manifest, pieces, epoch: record.epoch };
}

/** Park a sealed envelope on the relay (a fresh backend per park, like the app). */
async function parkOnRelay(harness: RelayHarness, token: string, envelope: MailboxEnvelope): Promise<boolean> {
  try {
    const session = await harness.backend.connect(harness.url, token);
    try {
      await session.send(encodeMailboxEnvelope(envelope));
      return true;
    } finally {
      await session.close();
    }
  } catch {
    return false;
  }
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let harness: RelayHarness | null = null;
const nodes: MeerkatNode[] = [];

afterEach(async () => {
  for (const node of nodes.splice(0)) await destroyNode(node);
  await stopRelayHarness(harness);
  harness = null;
});

async function startHarness(): Promise<RelayHarness> {
  const server = await startRelayServer({
    port: 0,
    host: '127.0.0.1',
    limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 },
  });
  return { server, backend: new WebSocketRelayBackend(), url: `ws://127.0.0.1:${server.port}` };
}

describe('community feed P7: owner-side invite -> join key handoff over a real relay mailbox', () => {
  it('B joins via an invite link, requests, the owner serves a grant, B gets the epoch key + full history', async () => {
    harness = await startHarness();
    const h = harness;

    const owner = await buildNode('Owner');
    const b = await buildNode('NodeB');
    nodes.push(owner, b);

    // 1. Owner founds an OWNER-ONLY community with a real epoch 1, posts a
    //    message, and builds a snapshot under epoch 1.
    const signed = createCommunity(owner.identity, {
      name: 'Feed Club P7',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(owner, signed);

    const m1 = createChannelMessage(owner.identity, {
      communityId, channelId: CHANNEL, body: 'welcome to the burrow',
      hlc: { wall: '2026-06-16T00:00:01.000Z', counter: 0 },
    });
    recordChannelMessageOnNode(owner, m1);
    const snapshot = await buildOwnerSnapshot(owner, communityId, [m1]);
    expect(snapshot.epoch).toBe(1);

    // The owner can read its own epoch-1 key (sanity).
    expect(getCurrentEpochKey(owner.db, communityId, owner.identity)).not.toBeNull();

    // 2. B joins via a REAL invite link. The link carries the OWNER-ONLY
    //    descriptor, so after join B's stored descriptor does NOT list B.
    const { link } = createCommunityInvite(
      owner.identity,
      { descriptor: signed.descriptor, signature: signed.signature },
      DAY_MS,
      new Date(NOW),
    );
    const joinResult = joinCommunityFromLink(b.db, b.identity, link, new Date(NOW));
    expect(joinResult.ok).toBe(true);

    const bStoredAfterJoin = getCommunity(b.db, communityId);
    expect(bStoredAfterJoin).not.toBeNull();
    expect(communityRole(bStoredAfterJoin!.descriptor, b.identity.publicKey)).toBeNull();
    expect(getCurrentEpochKey(b.db, communityId, b.identity)).toBeNull();

    // 3. B builds + parks a join-request on the OWNER's join token.
    const parsedInvite = parseCommunityInviteLink(link)!;
    const request = buildJoinRequest(b.identity, parsedInvite, NOW);
    expect(request).not.toBeNull();
    expect(request!.token).toBe(
      deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, owner.identity.publicKey),
    );
    expect(await parkOnRelay(h, request!.token, request!.envelope)).toBe(true);
    await waitMs(100);

    // 4. The owner drains ITS join-request token (an extraToken addressed to the
    //    owner). processJoinRequest adds B, mints a new epoch, pairs B, and parks
    //    a join-grant on B's join token.
    const ownerJoinToken = deriveCommunityJoinToken(
      signed.descriptor.genesisNonce, communityId, owner.identity.publicKey,
    );
    const ownerHandlers: MailboxEnvelopeHandlers = processJoinRequest({
      db: owner.db,
      owner: owner.identity,
      parkEnvelope: (token, env) => parkOnRelay(h, token, env),
      recordChange: (table, op, rowId, data) => owner.engine.recordChange(table, op, rowId, data),
      now: () => NOW,
    });
    const ownerDrain = await runMailboxDrainJobLocal(owner, h, ownerHandlers, [
      { token: ownerJoinToken, label: `join-request:${communityId}` },
    ]);
    expect(ownerDrain.joinRequests).toBe(1);
    expect(ownerDrain.joinGrants).toBe(0);

    // The owner's descriptor now lists B and the epoch advanced past 1.
    const ownerStored = getCommunity(owner.db, communityId)!;
    expect(communityRole(ownerStored.descriptor, b.identity.publicKey)).toBe('member');
    expect(getPairedDevices(owner.db).map((p) => p.deviceId)).toContain(b.identity.publicKey);
    await waitMs(100);

    // 5. B drains ITS join-grant token (an extraToken addressed to B).
    //    applyJoinGrant stores the new descriptor, the wraps, and pairs the owner.
    const bJoinToken = deriveCommunityJoinToken(
      signed.descriptor.genesisNonce, communityId, b.identity.publicKey,
    );
    const bHandlers: MailboxEnvelopeHandlers = applyJoinGrant({
      db: b.db,
      self: b.identity,
      now: () => NOW,
    });
    const bDrain = await runMailboxDrainJobLocal(b, h, bHandlers, [
      { token: bJoinToken, label: `join-grant:${communityId}` },
    ]);
    expect(bDrain.joinGrants).toBe(1);
    expect(bDrain.joinRequests).toBe(0);

    // 6. ASSERT on REAL rows: B's descriptor now lists B, B holds a current epoch
    //    key, and B + owner are paired.
    const bStored = getCommunity(b.db, communityId)!;
    expect(communityRole(bStored.descriptor, b.identity.publicKey)).toBe('member');
    const bEpochKey = getCurrentEpochKey(b.db, communityId, b.identity);
    expect(bEpochKey).not.toBeNull();
    expect(getPairedDevices(b.db).map((p) => p.deviceId)).toContain(owner.identity.publicKey);

    // 7. FULL HISTORY: B can decrypt the owner's epoch-1 snapshot. Under the
    //    default 'full' historyScope the owner back-wrapped epoch 1 to B, so B
    //    holds the epoch-1 secret and parses the snapshot's events.
    const epoch1Secret = unwrapEpochSecret(b.db, communityId, snapshot.epoch, b.identity);
    expect(epoch1Secret).not.toBeNull();
    const store = new InMemorySeederPieceStore();
    for (let i = 0; i < snapshot.pieces.length; i += 1) store.put(snapshot.manifest.infoHash, i, snapshot.pieces[i]!);
    const imported = await importSnapshotFromPieces({
      communityId,
      channelId: CHANNEL,
      epoch: snapshot.epoch,
      manifest: snapshot.manifest,
      pieceStore: store,
      groupKey: epoch1Secret!,
    });
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(resolveChannelMessages(imported.events).map((e) => e.body)).toEqual(['welcome to the burrow']);
    }
  });

  it('a join-request with an expired or wrong-community invite is dropped (no grant, B stays out)', async () => {
    harness = await startHarness();
    const h = harness;

    const owner = await buildNode('Owner');
    const b = await buildNode('NodeB');
    nodes.push(owner, b);

    const signed = createCommunity(owner.identity, {
      name: 'Feed Club P7 neg',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(owner, signed);

    // B "joins" the descriptor locally so it has the genesisNonce to derive tokens.
    const { link } = createCommunityInvite(
      owner.identity,
      { descriptor: signed.descriptor, signature: signed.signature },
      DAY_MS,
      new Date(NOW),
    );
    joinCommunityFromLink(b.db, b.identity, link, new Date(NOW));

    // --- EXPIRED invite: mint an invite that already expired, build a request
    //     from it, park it, owner drains -> processJoinRequest drops it.
    const past = new Date(Date.parse(NOW) - 2 * DAY_MS);
    const { invite: expiredInvite } = createCommunityInvite(
      owner.identity,
      { descriptor: signed.descriptor, signature: signed.signature },
      1, // 1ms TTL: already in the past relative to NOW
      past,
    );
    const parsedExpired = {
      invite: expiredInvite,
      descriptor: { descriptor: signed.descriptor, signature: signed.signature },
    };
    const expiredRequest = buildJoinRequest(b.identity, parsedExpired, NOW)!;
    expect(await parkOnRelay(h, expiredRequest.token, expiredRequest.envelope)).toBe(true);
    await waitMs(100);

    const ownerJoinToken = deriveCommunityJoinToken(
      signed.descriptor.genesisNonce, communityId, owner.identity.publicKey,
    );
    const ownerHandlers: MailboxEnvelopeHandlers = processJoinRequest({
      db: owner.db,
      owner: owner.identity,
      parkEnvelope: (token, env) => parkOnRelay(h, token, env),
      now: () => NOW,
    });
    const expiredDrain = await runMailboxDrainJobLocal(owner, h, ownerHandlers, [
      { token: ownerJoinToken, label: `join-request:${communityId}` },
    ]);
    // The expired invite was opened+verified at the envelope layer but the invite
    // re-verification failed -> dropped, NOT served.
    expect(expiredDrain.joinRequests).toBe(0);
    expect(expiredDrain.joinGrants).toBe(0);
    expect(communityRole(getCommunity(owner.db, communityId)!.descriptor, b.identity.publicKey)).toBeNull();

    // --- WRONG community: an invite for a DIFFERENT community parked on THIS
    //     community's owner token. processJoinRequest binds to its own descriptor
    //     and drops it (invite.communityId !== this community).
    const other = createCommunity(owner.identity, { name: 'Other Club', channels: [{ id: CHANNEL, name: CHANNEL }], now: NOW });
    const { invite: otherInvite } = createCommunityInvite(
      owner.identity,
      { descriptor: other.descriptor, signature: other.signature },
      DAY_MS,
      new Date(NOW),
    );
    // Craft a request payload that NAMES this community but carries the other
    // invite (a cross-community confusion attempt), sealed to this owner's token.
    const wrongRequest = buildJoinRequest(b.identity, {
      invite: otherInvite,
      // Carry THIS community's descriptor so buildJoinRequest seals to this owner
      // and derives this community's token, but the inner invite is for `other`.
      descriptor: { descriptor: signed.descriptor, signature: signed.signature },
    }, NOW)!;
    expect(await parkOnRelay(h, wrongRequest.token, wrongRequest.envelope)).toBe(true);
    await waitMs(100);

    const wrongDrain = await runMailboxDrainJobLocal(owner, h, ownerHandlers, [
      { token: ownerJoinToken, label: `join-request:${communityId}` },
    ]);
    expect(wrongDrain.joinRequests).toBe(0);
    expect(communityRole(getCommunity(owner.db, communityId)!.descriptor, b.identity.publicKey)).toBeNull();
  });

  it('a SECOND joiner reuses the SAME invite link after the first join revised the descriptor', async () => {
    harness = await startHarness();
    const h = harness;
    const owner = await buildNode('Owner');
    const b = await buildNode('NodeB');
    const c = await buildNode('NodeC');
    nodes.push(owner, b, c);

    const signed = createCommunity(owner.identity, {
      name: 'Feed Club P7 multi',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(owner, signed);

    // ONE multi-use invite link, shared by BOTH joiners.
    const { link } = createCommunityInvite(
      owner.identity,
      { descriptor: signed.descriptor, signature: signed.signature },
      DAY_MS,
      new Date(NOW),
    );
    const ownerJoinToken = deriveCommunityJoinToken(
      signed.descriptor.genesisNonce, communityId, owner.identity.publicKey,
    );
    const ownerHandlers: MailboxEnvelopeHandlers = processJoinRequest({
      db: owner.db,
      owner: owner.identity,
      parkEnvelope: (token, env) => parkOnRelay(h, token, env),
      recordChange: (table, op, rowId, data) => owner.engine.recordChange(table, op, rowId, data),
      now: () => NOW,
    });

    const runJoin = async (joiner: MeerkatNode): Promise<{ joinRequests: number; joinGrants: number }> => {
      joinCommunityFromLink(joiner.db, joiner.identity, link, new Date(NOW));
      const parsed = parseCommunityInviteLink(link)!;
      const req = buildJoinRequest(joiner.identity, parsed, NOW)!;
      expect(await parkOnRelay(h, req.token, req.envelope)).toBe(true);
      await waitMs(80);
      const od = await runMailboxDrainJobLocal(owner, h, ownerHandlers, [
        { token: ownerJoinToken, label: `join-request:${communityId}` },
      ]);
      await waitMs(80);
      const jt = deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, joiner.identity.publicKey);
      const jh: MailboxEnvelopeHandlers = applyJoinGrant({ db: joiner.db, self: joiner.identity, now: () => NOW });
      const jd = await runMailboxDrainJobLocal(joiner, h, jh, [{ token: jt, label: `join-grant:${communityId}` }]);
      return { joinRequests: od.joinRequests, joinGrants: jd.joinGrants };
    };

    // First joiner B: succeeds AND revises the descriptor (revision++ -> hash moves).
    const bResult = await runJoin(b);
    expect(bResult.joinRequests).toBe(1);
    expect(bResult.joinGrants).toBe(1);
    expect(communityRole(getCommunity(b.db, communityId)!.descriptor, b.identity.publicKey)).toBe('member');
    expect(getCurrentEpochKey(b.db, communityId, b.identity)).not.toBeNull();

    // Second joiner C reuses the SAME invite link. Before the P0-1 fix the owner
    // rejected C because the invite's descriptorHash no longer matched the
    // (B-revised) current descriptor. Now C is admitted too.
    const cResult = await runJoin(c);
    expect(cResult.joinRequests).toBe(1);
    expect(cResult.joinGrants).toBe(1);
    expect(communityRole(getCommunity(c.db, communityId)!.descriptor, c.identity.publicKey)).toBe('member');
    expect(getCurrentEpochKey(c.db, communityId, c.identity)).not.toBeNull();

    // The owner's descriptor lists BOTH joiners; no duplicate rows.
    const ownerDesc = getCommunity(owner.db, communityId)!.descriptor;
    expect(communityRole(ownerDesc, b.identity.publicKey)).toBe('member');
    expect(communityRole(ownerDesc, c.identity.publicKey)).toBe('member');
    const ids = ownerDesc.members.map((m) => m.deviceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a join-grant whose descriptor names a different owner is dropped by B', async () => {
    harness = await startHarness();
    const h = harness;

    const owner = await buildNode('Owner');
    const b = await buildNode('NodeB');
    const stranger = await buildNode('Stranger');
    nodes.push(owner, b, stranger);

    // B already holds a community owned by `owner`.
    const signed = createCommunity(owner.identity, {
      name: 'Feed Club P7 owner-bind',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(owner, signed);
    const { link } = createCommunityInvite(
      owner.identity,
      { descriptor: signed.descriptor, signature: signed.signature },
      DAY_MS,
      new Date(NOW),
    );
    joinCommunityFromLink(b.db, b.identity, link, new Date(NOW));

    // The stranger crafts a community under the SAME id is impossible (id derives
    // from genesis content under the stranger's key). Instead the stranger forges
    // a NEW community that lists B, mints an epoch, and seals a grant to B on B's
    // join token for the REAL community id. applyJoinGrant must drop it because
    // the grant's descriptor ownerDeviceId (stranger) != B's stored ownerDeviceId.
    const forged = createCommunity(stranger.identity, {
      name: 'Forged',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      members: [{ deviceId: b.identity.publicKey, role: 'member', displayName: b.displayName, dhPublicKey: b.identity.dhPublicKey }],
      now: NOW,
    });
    foundOwnerCommunity(stranger, forged);

    // Build a grant by hand: the stranger seals a join-grant addressed to B on the
    // REAL community's join token, but the descriptor inside is the FORGED one.
    const { sealJoinGrantMailbox, createSignedIdentityBundle, getKeyWraps, keyWrapToSyncedRow } = await import('@mylife/sync');
    const forgedWraps = getKeyWraps(stranger.db, forged.descriptor.communityId, 1)
      .filter((w) => w.wrappedForDeviceId === b.identity.publicKey)
      .map(keyWrapToSyncedRow);
    const bJoinToken = deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, b.identity.publicKey);
    const grant: SealJoinGrantResult = sealJoinGrantMailbox({
      sender: stranger.identity,
      recipient: { deviceId: b.identity.publicKey, dhPublicKey: b.identity.dhPublicKey },
      token: bJoinToken,
      payload: {
        kind: 'meerkat.join-grant-v1',
        version: 1,
        // Name the REAL community id so it routes to B's join handler for it...
        communityId,
        // ...but carry the FORGED descriptor (owned by the stranger).
        descriptor: { descriptor: forged.descriptor, signature: forged.signature },
        keyWraps: forgedWraps,
        ownerBundle: createSignedIdentityBundle(stranger.identity),
      },
    });
    expect(await parkOnRelay(h, grant.token, grant.envelope)).toBe(true);
    await waitMs(100);

    const bHandlers: MailboxEnvelopeHandlers = applyJoinGrant({ db: b.db, self: b.identity, now: () => NOW });
    const bDrain = await runMailboxDrainJobLocal(b, h, bHandlers, [
      { token: bJoinToken, label: `join-grant:${communityId}` },
    ]);
    // The grant opened+verified at the envelope layer, but its descriptor's
    // communityId (the forged id) != the named community, AND even bound to its
    // own id the owner-binding check would fail; either way: dropped, nothing
    // applied, B still has no epoch key for the real community.
    expect(bDrain.joinGrants).toBe(0);
    expect(getCurrentEpochKey(b.db, communityId, b.identity)).toBeNull();
    expect(communityRole(getCommunity(b.db, communityId)!.descriptor, b.identity.publicKey)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Run a real foreground-style drain over the relay with ONLY community-derived
// extraTokens (no peer mailbox tokens). Mirrors the app's runForegroundDrain
// shape: a fresh backend, the real runMailboxDrainJob, the SAME dispatcher.
// ---------------------------------------------------------------------------

async function runMailboxDrainJobLocal(
  node: MeerkatNode,
  harnessRef: RelayHarness,
  handlers: MailboxEnvelopeHandlers,
  extraTokens: { token: string; label: string }[],
): ReturnType<typeof runMailboxDrainJob> {
  return runMailboxDrainJob({
    identity: node.identity,
    backend: harnessRef.backend,
    relayUrl: harnessRef.url,
    peers: [],
    handlers,
    extraTokens,
    waitForDrain: () => waitMs(150),
  });
}
