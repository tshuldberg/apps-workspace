/**
 * Group DM epoch backing + per-member handoff, cross-client, over a LIVE relay
 * (Plan 21 Phase 6).
 *
 * The @mylife/sync unit tests prove the dispatcher/drain routing + the NC-9
 * no-leak invariant with an in-memory store-and-forward backend. This test proves
 * the real bytes cross a REAL relay WebSocket server (like the neighboring
 * dm-1to1-e2e / join-handoff-e2e files): three fully independent nodes (own
 * identity + own db), a real loopback relay, the real per-member DM_GROUP_COMMIT
 * handoff drained through the REAL dispatcher (applyMailboxEnvelope via
 * runMailboxDrainJob + applyDmGroupCommit). This package already depends on
 * @mylife/sync, so the live-relay engine e2e lives here (cycle-free), NOT in
 * @mylife/sync.
 *
 * Three engines, A (admin), B, C:
 *   1. A creates a group (A + B + C), mints epoch 1, and seals a DM_GROUP_COMMIT
 *      handoff to B and to C. B and C drain their handoff and converge on epoch 1.
 *   2. A removes C (real epoch 2 wrapped for everyone EXCEPT C) and seals the new
 *      epoch handoff to the remaining member B. B drains and converges on epoch 2.
 *   3. A sends a group message under epoch 2. B reads it (holds the epoch 2 key);
 *      C, handed the SAME ciphertext, CANNOT read it (no wrap for epoch 2). Real
 *      bytes, a real signature, a real forward-secrecy boundary.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  applyDmGroupCommit,
  createDmGroup,
  createDmMessage,
  createSignedIdentityBundle,
  decryptDmGroupEvents,
  deriveDmGroupCommitToken,
  dmGroupRemove,
  encodeMailboxEnvelope,
  getCurrentEpochKey,
  getKeyWraps,
  runMailboxDrainJob,
  sealDmGroup,
  sealDmGroupCommit,
  unwrapEpochSecret,
  verifyDmMessage,
  type DmGroupCommitRecipient,
  type DmMessageEvent,
  type MailboxDrainPeer,
  type MailboxEnvelopeHandlers,
  type SignedDmGroupDescriptor,
  type SyncWorkspaceKeyWrap,
} from '@mylife/sync';
import {
  buildNode,
  destroyNode,
  pairNodes,
  startRelayHarness,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

let harness: RelayHarness | null = null;
const nodes: MeerkatNode[] = [];

afterEach(async () => {
  await Promise.all(nodes.splice(0).map((n) => destroyNode(n)));
  await stopRelayHarness(harness);
  harness = null;
});

/** Park one sealed envelope on a token over the live relay (a send by an absent recipient). */
async function park(h: RelayHarness, token: string, bytes: Uint8Array): Promise<void> {
  const session = await h.backend.connect(h.url, token);
  try {
    await session.send(bytes);
  } finally {
    await session.close();
  }
}

const peer = (deviceId: string, pairSharedSecretHex: string): MailboxDrainPeer =>
  ({ deviceId, pairSharedSecretHex, revoked: false, isActive: true });

/** The wrap rows addressed to `deviceId` for `epoch` on the admin's db. */
function wrapsFor(admin: MeerkatNode, cid: string, epoch: number, deviceId: string): SyncWorkspaceKeyWrap[] {
  return getKeyWraps(admin.db, cid, epoch).filter((w) => w.wrappedForDeviceId === deviceId);
}

/** Build the per-recipient handoff for a set of members + park each over the relay. */
async function handoffEpoch(
  h: RelayHarness,
  admin: MeerkatNode,
  cid: string,
  descriptor: SignedDmGroupDescriptor,
  epoch: number,
  recipients: MeerkatNode[],
): Promise<void> {
  const list: DmGroupCommitRecipient[] = recipients.map((r) => ({
    deviceId: r.identity.publicKey,
    dhPublicKey: r.identity.dhPublicKey,
    keyWraps: wrapsFor(admin, cid, epoch, r.identity.publicKey),
  }));
  const sealed = sealDmGroupCommit({
    admin: admin.identity,
    conversationId: cid,
    descriptor,
    adminBundle: createSignedIdentityBundle(admin.identity),
    recipients: list,
  });
  for (const s of sealed) {
    await park(h, s.token, encodeMailboxEnvelope(s.envelope));
  }
}

/** Drain a member's DM_GROUP_COMMIT token + apply it (converge on the epoch). */
async function drainCommit(h: RelayHarness, node: MeerkatNode, cid: string) {
  const handlers: MailboxEnvelopeHandlers = applyDmGroupCommit({ db: node.db, self: node.identity });
  return runMailboxDrainJob({
    identity: node.identity,
    backend: h.backend,
    relayUrl: h.url,
    peers: [],
    handlers,
    extraTokens: [{ token: deriveDmGroupCommitToken(cid, node.identity.publicKey), label: 'dm-group' }],
  });
}

describe('Group DM epoch handoff e2e over a LIVE relay (Plan 21 Phase 6)', () => {
  it('members converge on the epoch, a removed member cannot read the next message', async () => {
    harness = await startRelayHarness();
    const admin = await buildNode('Admin');
    const b = await buildNode('Bea');
    const c = await buildNode('Cal');
    nodes.push(admin, b, c);

    // Pairwise pairing so group MESSAGES can fan out over each pair-private mailbox.
    const secretAB = pairNodes(admin, b);
    const secretAC = pairNodes(admin, c);

    // --- Step 1: A creates the group + hands off epoch 1 to B and C ---
    const created = createDmGroup(admin.db, {
      admin: admin.identity,
      title: 'Trip crew',
      members: [
        { deviceId: b.identity.publicKey, dhPublicKey: b.identity.dhPublicKey, role: 'member' },
        { deviceId: c.identity.publicKey, dhPublicKey: c.identity.dhPublicKey, role: 'member' },
      ],
    });
    const cid = created.conversationId;
    expect(created.commit.epoch).toBe(1);

    await handoffEpoch(harness, admin, cid, created.descriptor, 1, [b, c]);

    const drainB1 = await drainCommit(harness, b, cid);
    const drainC1 = await drainCommit(harness, c, cid);
    expect(drainB1.dmGroupCommits).toBe(1);
    expect(drainC1.dmGroupCommits).toBe(1);
    expect(drainB1.rejected).toBe(0);
    expect(drainC1.rejected).toBe(0);

    // Both converge on epoch 1: same secret A minted.
    expect(getCurrentEpochKey(b.db, cid, b.identity)?.epoch).toBe(1);
    expect(getCurrentEpochKey(c.db, cid, c.identity)?.epoch).toBe(1);
    expect(getCurrentEpochKey(b.db, cid, b.identity)?.secret).toEqual(created.commit.secret);
    expect(getCurrentEpochKey(c.db, cid, c.identity)?.secret).toEqual(created.commit.secret);

    // --- Step 2: A removes C (epoch 2 for everyone but C), hands off to B only ---
    const removed = dmGroupRemove(admin.db, {
      admin: admin.identity,
      descriptor: created.descriptor,
      removedDeviceId: c.identity.publicKey,
    });
    expect(removed.commit.epoch).toBe(2);
    expect(removed.commit.secret).not.toEqual(created.commit.secret);

    await handoffEpoch(harness, admin, cid, removed.descriptor, 2, [b]);

    const drainB2 = await drainCommit(harness, b, cid);
    expect(drainB2.dmGroupCommits).toBe(1);
    expect(getCurrentEpochKey(b.db, cid, b.identity)?.epoch).toBe(2);
    // C was never handed epoch 2: it holds NO wrap for it.
    expect(unwrapEpochSecret(c.db, cid, 2, c.identity)).toBeNull();

    // --- Step 3: A posts a group message under epoch 2, fanned to BOTH B and C ---
    const epoch2 = getCurrentEpochKey(admin.db, cid, admin.identity)!;
    expect(epoch2.epoch).toBe(2);
    const message = createDmMessage(admin.identity, {
      conversationId: cid,
      body: 'new plan, C is out',
      hlc: { wall: '2026-07-02T00:00:00.000Z', counter: 0 },
    });
    const sealedMsg = sealDmGroup({
      sender: admin.identity,
      conversationId: cid,
      epoch: epoch2.epoch,
      epochSecret: epoch2.secret,
      events: [message],
      recipients: [
        { deviceId: b.identity.publicKey, dhPublicKey: b.identity.dhPublicKey, pairSecret: secretAB },
        { deviceId: c.identity.publicKey, dhPublicKey: c.identity.dhPublicKey, pairSecret: secretAC },
      ],
    });
    expect(sealedMsg.ok).toBe(true);
    if (!sealedMsg.ok) return;
    for (const s of sealedMsg.sealed) {
      await park(harness, s.token, encodeMailboxEnvelope(s.envelope));
    }

    // --- Step 4: B reads the message; C (removed) cannot ---
    const readBy = (_node: MeerkatNode): { received: DmMessageEvent[] } => ({ received: [] });
    const bInbox = readBy(b);
    const drainMsgB = await runMailboxDrainJob({
      identity: b.identity,
      backend: harness.backend,
      relayUrl: harness.url,
      peers: [peer(admin.identity.publicKey, secretAB)],
      handlers: {
        dmMessage: (_sender, opened) => {
          if (opened.mode !== 'group' || opened.epoch == null || !opened.sealedEvents) return false;
          const secret = unwrapEpochSecret(b.db, opened.conversationId, opened.epoch, b.identity);
          if (!secret) return false;
          const events = decryptDmGroupEvents(
            { conversationId: opened.conversationId, epoch: opened.epoch, sealedEvents: opened.sealedEvents },
            secret,
          );
          if (!events || events.length === 0) return false;
          bInbox.received.push(...events);
          return true;
        },
      },
    });
    expect(drainMsgB.dmMessages).toBe(1);
    expect(bInbox.received).toHaveLength(1);
    expect(bInbox.received[0]!.body).toBe('new plan, C is out');
    expect(verifyDmMessage(bInbox.received[0]!)).toBe(true);

    const cInbox = readBy(c);
    let cCouldDecrypt = false;
    const drainMsgC = await runMailboxDrainJob({
      identity: c.identity,
      backend: harness.backend,
      relayUrl: harness.url,
      peers: [peer(admin.identity.publicKey, secretAC)],
      handlers: {
        dmMessage: (_sender, opened) => {
          if (opened.mode !== 'group' || opened.epoch == null || !opened.sealedEvents) return false;
          // C holds NO wrap for epoch 2: it cannot even derive the epoch secret.
          const secret = unwrapEpochSecret(c.db, opened.conversationId, opened.epoch, c.identity);
          if (!secret) return false;
          const events = decryptDmGroupEvents(
            { conversationId: opened.conversationId, epoch: opened.epoch, sealedEvents: opened.sealedEvents },
            secret,
          );
          if (events && events.length > 0) {
            cCouldDecrypt = true;
            cInbox.received.push(...events);
          }
          return false;
        },
      },
    });
    // The removed device drained the ciphertext but could not read it: fail-closed.
    expect(drainMsgC.drained).toBeGreaterThan(0);
    expect(drainMsgC.dmMessages).toBe(0);
    expect(cCouldDecrypt).toBe(false);
    expect(cInbox.received).toHaveLength(0);
  }, 30_000);
});
