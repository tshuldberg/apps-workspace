/**
 * Real community member removal, end to end, over a LIVE relay + a LIVE hosted
 * community node (Plan 28 P3).
 *
 * The @mylife/sync unit tests prove the protocol (P0 fan-out), the gossip (P1),
 * the dispatcher + apply (P2), and the owner orchestration (P3 core) with
 * in-memory backends. This test proves the whole removal boundary with REAL
 * bytes: three fully independent nodes, a real loopback relay WebSocket server,
 * a real community-node HTTP server, and the ONE owner action
 * (removeCommunityMember) driving all of it. This package already depends on
 * @mylife/sync, so the live e2e lives here (cycle-free), like dm-group-e2e.
 *
 * Owner O, survivor A, removed B:
 *   1. O founds the community (hosts = the live node's url), everyone holds
 *      revision 1 + a real epoch-1 wrap; O bootstraps the node and B (a member)
 *      pulls the hosted feed successfully (positive control).
 *   2. O runs removeCommunityMember(B): signed revision 2 + epoch 2 wrapped for
 *      survivors only + A's sealed envelope parked on the LIVE relay + the
 *      revised descriptor republished to the LIVE node -- one action.
 *   3. A drains its removal token over the LIVE relay through the REAL
 *      dispatcher: B's roster row closes on A (a) and A advances to epoch 2 (b).
 *   4. B (still believing it is a member) initiates a real workspace session to
 *      A over the LIVE relay: REFUSED -- no pairwise fallback (c).
 *   5. B's next hosted feed pull returns not_member while A still pulls fine (d).
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import {
  ChangeTracker,
  LwwDocumentManager,
  applyMemberRemoval,
  connectRelayPeer,
  createCommunity,
  createGroupCommit,
  createSignedIdentityBundle,
  deriveCommunityRemovalToken,
  encodeMailboxEnvelope,
  getCurrentEpochKey,
  getKeyWraps,
  getPairedDevices,
  getWorkspaceMembers,
  pullCommunityFeed,
  removeCommunityMember,
  republishCommunityDescriptor,
  runInitiatorSession,
  runMailboxDrainJob,
  runResponderSession,
  storeReceivedKeyWrap,
  type DeviceIdentity,
  type DocumentManager,
  type GroupMemberKey,
} from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';
import {
  HARNESS_MEERKAT_SYNC_POLICIES,
  HARNESS_MEERKAT_SYNC_PREFIXES,
  buildNode,
  destroyNode,
  installCommunityOnNode,
  pairNodes,
  startRelayHarness,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

let harness: RelayHarness | null = null;
let server: SeederHttpServer | null = null;
const nodes: MeerkatNode[] = [];

afterEach(async () => {
  await Promise.all(nodes.splice(0).map((n) => destroyNode(n)));
  await stopRelayHarness(harness);
  harness = null;
  await server?.close();
  server = null;
});

/** node:http fetch shim (json + POST), mirroring community-node-e2e.test.ts. */
const httpFetch = ((input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) =>
  new Promise((resolve, reject) => {
    const req = http.request(String(input), { method: init?.method ?? 'GET', headers: init?.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
          status: res.statusCode ?? 500,
          json: async () => JSON.parse(body.toString('utf8')),
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
    req.on('error', reject);
    if (init?.body) req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;

/** Park one sealed envelope on a token over the live relay. */
async function park(h: RelayHarness, token: string, bytes: Uint8Array): Promise<void> {
  const session = await h.backend.connect(h.url, token);
  try {
    await session.send(bytes);
  } finally {
    await session.close();
  }
}

const asKey = (identity: DeviceIdentity): GroupMemberKey =>
  ({ deviceId: identity.publicKey, dhPublicKey: identity.dhPublicKey });

const asMember = (identity: DeviceIdentity) =>
  ({ deviceId: identity.publicKey, role: 'member' as const, dhPublicKey: identity.dhPublicKey });

const HARNESS_ENABLED = ['meerkatpad', 'community', 'communitykeys'];

/** Raw workspace-scoped session options for one node (group-keys-session shape). */
function sessionOptions(node: MeerkatNode, workspaceId: string) {
  return {
    db: node.db,
    identity: node.identity,
    pairedDevices: getPairedDevices(node.db),
    documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    changeTracker: new ChangeTracker({
      db: node.db,
      deviceId: node.identity.publicKey,
      modulePrefixes: HARNESS_MEERKAT_SYNC_PREFIXES,
      modulePolicies: HARNESS_MEERKAT_SYNC_POLICIES,
    }),
    enabledModules: HARNESS_ENABLED,
    modulePolicies: HARNESS_MEERKAT_SYNC_POLICIES,
    transport: 'wan_relay' as const,
    workspaceId,
  };
}

describe('member removal e2e over a LIVE relay + LIVE community node (Plan 28 P3)', () => {
  it('one owner action: survivor converges, sessions with the removed device refuse, hosted node rejects it', async () => {
    harness = await startRelayHarness();
    const owner = await buildNode('Owner');
    const a = await buildNode('Alice');
    const b = await buildNode('Bo');
    nodes.push(owner, a, b);
    pairNodes(owner, a);
    pairNodes(owner, b);
    pairNodes(a, b);

    // A REAL hosted community node, booted first so its url rides the descriptor.
    const communityNode = new CommunityNode({ pieceStore: new InMemorySeederPieceStore() });
    server = await startCommunityNodeHttp({ node: communityNode, host: '127.0.0.1' });

    // --- Step 1: found + converge on revision 1 / epoch 1 ---
    const signed = createCommunity(owner.identity, {
      name: 'Surf Club',
      channels: [{ id: 'general', name: 'general' }],
      members: [asMember(a.identity), asMember(b.identity)],
      hosts: [server.url],
    });
    const cid = signed.descriptor.communityId;
    for (const node of [owner, a, b]) installCommunityOnNode(node, signed);
    // The harness workspace starts at currentKeyVersion 1, so the first real
    // commit mints the NEXT epoch -- keep every later assertion relative to it.
    const genesis = createGroupCommit(owner.db, {
      workspaceId: cid,
      committer: owner.identity,
      members: [asKey(owner.identity), asKey(a.identity), asKey(b.identity)],
    });
    for (const node of [a, b]) {
      const wrap = getKeyWraps(owner.db, cid, genesis.epoch)
        .find((w) => w.wrappedForDeviceId === node.identity.publicKey)!;
      storeReceivedKeyWrap(node.db, wrap, node.identity);
      expect(getCurrentEpochKey(node.db, cid, node.identity)?.epoch).toBe(genesis.epoch);
    }

    // Owner bootstraps the node with revision 1 over REAL HTTP.
    const boot = await republishCommunityDescriptor({
      baseUrl: server.url,
      identity: owner.identity,
      descriptor: signed,
      fetchFn: httpFetch,
    });
    expect(boot.ok).toBe(true);

    // Positive control: B is a member, so its hosted feed pull succeeds.
    const bPullBefore = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: cid,
      identity: b.identity,
      fetchFn: httpFetch,
      getEpochKey: () => getCurrentEpochKey(b.db, cid, b.identity),
    });
    expect(bPullBefore.ok).toBe(true);

    // --- Step 2: THE ONE OWNER ACTION ---
    const h = harness;
    const result = await removeCommunityMember(
      {
        db: owner.db,
        owner: owner.identity,
        parkEnvelope: async (token, envelope) => {
          await park(h, token, encodeMailboxEnvelope(envelope));
          return true;
        },
        republishDescriptor: async (nodeUrl, descriptor) =>
          (await republishCommunityDescriptor({
            baseUrl: nodeUrl,
            identity: owner.identity,
            descriptor,
            fetchFn: httpFetch,
          })).ok,
      },
      cid,
      b.identity.publicKey,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision).toBe(signed.descriptor.revision + 1);
    expect(result.epoch).toBe(genesis.epoch + 1);
    expect(result.envelopesParked).toBe(1);
    expect(result.nodesAttempted).toBe(1);
    expect(result.nodesRepublished).toBe(1);
    // The new epoch was never wrapped for B on the owner's device.
    expect(getKeyWraps(owner.db, cid, result.epoch).some((w) => w.wrappedForDeviceId === b.identity.publicKey))
      .toBe(false);

    // --- Step 3: A drains its removal token over the LIVE relay (a) + (b) ---
    const drainA = await runMailboxDrainJob({
      identity: a.identity,
      backend: harness.backend,
      relayUrl: harness.url,
      peers: [],
      handlers: applyMemberRemoval({ db: a.db, self: a.identity }),
      extraTokens: [{
        token: deriveCommunityRemovalToken(signed.descriptor.genesisNonce, cid, a.identity.publicKey),
        label: `member-removal:${cid}`,
      }],
    });
    expect(drainA.memberRemovals).toBe(1);
    expect(drainA.rejected).toBe(0);
    expect(getWorkspaceMembers(a.db, cid).map((m) => m.deviceId))
      .not.toContain(b.identity.publicKey); // (a) roster row closed on A
    expect(getCurrentEpochKey(a.db, cid, a.identity)?.epoch).toBe(genesis.epoch + 1); // (b) epoch advanced

    // --- Step 4: B initiates a REAL workspace session to A over the LIVE relay (c) ---
    // B still believes it is a member (it never saw the removal) and still holds
    // the pairwise key with A. The session must REFUSE, never fall back pairwise.
    const token = 'member-removal-e2e-session';
    const connB = await connectRelayPeer({
      backend: harness.backend,
      url: harness.url,
      token,
      remoteDeviceId: a.identity.publicKey,
    });
    const connA = await connectRelayPeer({
      backend: harness.backend,
      url: harness.url,
      token,
      remoteDeviceId: b.identity.publicKey,
    });
    try {
      const [initiatorB, responderA] = await Promise.all([
        runInitiatorSession(connB, sessionOptions(b, cid)),
        runResponderSession(connA, sessionOptions(a, cid)),
      ]);
      expect(initiatorB.session.status).toBe('failed');
      expect(responderA.session.status).toBe('failed');
      const errors = `${initiatorB.session.error ?? ''} | ${responderA.session.error ?? ''}`;
      expect(errors).toMatch(/group-epoch mismatch|not an active member|membership/i);
    } finally {
      await connB.close();
      await connA.close();
    }

    // --- Step 5: hosted enforcement converged in the SAME owner action (d) ---
    const bPullAfter = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: cid,
      identity: b.identity,
      fetchFn: httpFetch,
      getEpochKey: () => getCurrentEpochKey(b.db, cid, b.identity),
    });
    expect(bPullAfter.ok).toBe(false);
    if (!bPullAfter.ok) expect(bPullAfter.reason).toBe('not_member');

    const aPullAfter = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: cid,
      identity: a.identity,
      fetchFn: httpFetch,
      getEpochKey: () => getCurrentEpochKey(a.db, cid, a.identity),
    });
    expect(aPullAfter.ok).toBe(true);

    // The removal payload the survivor applied was owner-signed and carried the
    // owner bundle; keep a sanity anchor that the bundle helper stayed exported.
    expect(createSignedIdentityBundle(owner.identity).bundle.deviceId).toBe(owner.identity.publicKey);
  }, 30_000);
});
