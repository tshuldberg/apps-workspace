/**
 * DM message + receipt, cross-client, over a LIVE relay (Plan 21 Phase 2).
 *
 * The dispatcher/drain routing is proven with an in-memory store-and-forward
 * backend in @mylife/sync's mailbox-dispatch / mailbox-drain unit tests; this
 * test proves the real bytes cross a REAL relay WebSocket server, mirroring the
 * neighboring live-relay e2e files here (friend-rendezvous-e2e /
 * mailbox-mode-e2e / join-handoff-e2e): startRelayServer on an ephemeral port,
 * WebSocketRelayBackend with Node `ws` injected for both the park (send) and
 * the drain (receive) sides. This package already depends on @mylife/sync, so
 * the live-relay engine e2e lives here (cycle-free), not in @mylife/sync.
 *
 * Two real device identities, A and B:
 *   1. A seals a DM message to B with sealDmDirect and parks the sealed
 *      envelope on the relay under its token (a send by an absent recipient --
 *      the relay's TTL mailbox buffers it).
 *   2. B drains via runMailboxDrainJob + a real dmMessage handler over the SAME
 *      live relay -- no simulated backend anywhere in this file.
 *   3. B seals a 'delivered' receipt back to A with sealDmReceipt and parks it.
 *   4. A drains the receipt with a dmReceipt handler.
 *
 * Every assertion is on values the dispatcher itself verified (verifyDmMessage,
 * dmConversationId, receipt state), not on values the test fabricated.
 */

import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  WebSocketRelayBackend,
  createDmMessage,
  createDmReceipt,
  dmConversationId,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  runMailboxDrainJob,
  sealDmDirect,
  sealDmReceipt,
  verifyDmMessage,
  type DmMessageEvent,
  type DmReceiptEvent,
  type MailboxDrainPeer,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

const PAIR_SECRET = 'de'.repeat(32);

function nodeWsBackend(): WebSocketRelayBackend {
  return new WebSocketRelayBackend({
    webSocketImpl: WebSocket as unknown as new (url: string) => WebSocket,
  });
}

/** Start a real relay on an ephemeral port, run fn(url), always close it. */
async function withRelay<T>(fn: (url: string) => Promise<T>): Promise<T> {
  const server: RelayServer = await startRelayServer({ port: 0, host: '127.0.0.1' });
  try {
    return await fn(`ws://127.0.0.1:${server.port}`);
  } finally {
    await server.close();
  }
}

/** Park one sealed mailbox envelope on a token over the live relay (a send by an absent sender). */
async function parkEnvelope(url: string, token: string, bytes: Uint8Array): Promise<void> {
  const backend = nodeWsBackend();
  try {
    const session = await backend.connect(url, token);
    try {
      await session.send(bytes);
    } finally {
      await session.close();
    }
  } finally {
    backend.destroy();
  }
}

function peer(deviceId: string, pairSharedSecretHex: string): MailboxDrainPeer {
  return { deviceId, pairSharedSecretHex, revoked: false, isActive: true };
}

describe('DM 1:1 e2e over a LIVE relay (Plan 21 Phase 2)', () => {
  it('A sends a real DM message to B over the relay TTL mailbox, and B sends a real receipt back', async () => {
    await withRelay(async (url) => {
      const deviceA = generateDeviceIdentity('Device A');
      const deviceB = generateDeviceIdentity('Device B');
      const conversationId = dmConversationId(deviceA.publicKey, deviceB.publicKey);

      // --- Step 1: A creates + seals a real DM message, parks it to B's mailbox ---
      const message = createDmMessage(deviceA, {
        conversationId,
        body: 'hey, are you free tonight?',
        hlc: { wall: '2026-07-01T12:00:00.000Z', counter: 0 },
      });
      expect(verifyDmMessage(message)).toBe(true);

      const sealedMessage = sealDmDirect({
        sender: deviceA,
        conversationId,
        events: [message],
        recipients: [{ deviceId: deviceB.publicKey, dhPublicKey: deviceB.dhPublicKey, pairSecret: PAIR_SECRET }],
      });
      expect(sealedMessage.ok).toBe(true);
      if (!sealedMessage.ok) return;

      await parkEnvelope(
        url,
        sealedMessage.sealed[0]!.token,
        encodeMailboxEnvelope(sealedMessage.sealed[0]!.envelope),
      );

      // --- Step 2: B drains its mailbox over the SAME live relay, real dispatcher ---
      const receivedByB: { senderDeviceId: string; conversationId: string; events: DmMessageEvent[] }[] = [];
      const drainBackend = nodeWsBackend();
      const drainB = await runMailboxDrainJob({
        identity: deviceB,
        backend: drainBackend,
        relayUrl: url,
        peers: [peer(deviceA.publicKey, PAIR_SECRET)],
        handlers: {
          dmMessage: (senderDeviceId, opened) => {
            receivedByB.push({ senderDeviceId, conversationId: opened.conversationId, events: opened.events });
            return true;
          },
        },
      });
      drainBackend.destroy();

      expect(drainB.dmMessages).toBe(1);
      expect(drainB.rejected).toBe(0);
      expect(receivedByB).toHaveLength(1);
      expect(receivedByB[0]!.senderDeviceId).toBe(deviceA.publicKey);
      expect(receivedByB[0]!.conversationId).toBe(conversationId);
      expect(receivedByB[0]!.events).toHaveLength(1);
      const deliveredMessage = receivedByB[0]!.events[0]!;
      expect(deliveredMessage.id).toBe(message.id);
      expect(deliveredMessage.body).toBe('hey, are you free tonight?');
      // The delivered event is re-verified independently by the test (not just
      // trusted because the dispatcher said so): real bytes, a real signature.
      expect(verifyDmMessage(deliveredMessage)).toBe(true);
      expect(dmConversationId(deviceA.publicKey, deviceB.publicKey)).toBe(conversationId);

      // --- Step 3: B creates + seals a real 'delivered' receipt back to A ---
      const receipt = createDmReceipt(deviceB, {
        conversationId,
        messageId: deliveredMessage.id,
        state: 'delivered',
        at: '2026-07-01T12:00:05.000Z',
      });
      const sealedReceipt = sealDmReceipt({
        sender: deviceB,
        recipient: { deviceId: deviceA.publicKey, dhPublicKey: deviceA.dhPublicKey },
        pairSharedSecretHex: PAIR_SECRET,
        receipt,
      });
      await parkEnvelope(url, sealedReceipt.token, encodeMailboxEnvelope(sealedReceipt.envelope));

      // --- Step 4: A drains the receipt over the SAME live relay ---
      const receivedByA: DmReceiptEvent[] = [];
      let receiptSender: string | null = null;
      const drainBackend2 = nodeWsBackend();
      const drainA = await runMailboxDrainJob({
        identity: deviceA,
        backend: drainBackend2,
        relayUrl: url,
        peers: [peer(deviceB.publicKey, PAIR_SECRET)],
        handlers: {
          dmReceipt: (senderDeviceId, opened) => {
            receiptSender = senderDeviceId;
            receivedByA.push(opened.receipt);
            return true;
          },
        },
      });
      drainBackend2.destroy();

      expect(drainA.dmReceipts).toBe(1);
      expect(drainA.rejected).toBe(0);
      expect(receiptSender).toBe(deviceB.publicKey);
      expect(receivedByA).toHaveLength(1);
      expect(receivedByA[0]!.messageId).toBe(deliveredMessage.id);
      expect(receivedByA[0]!.state).toBe('delivered');
      expect(receivedByA[0]!.recipientDeviceId).toBe(deviceB.publicKey);
    });
  }, 20_000);

  it('a stranger draining with a DIFFERENT pair secret gets nothing (mailbox is pair-private)', async () => {
    await withRelay(async (url) => {
      const deviceA = generateDeviceIdentity('Device A2');
      const deviceB = generateDeviceIdentity('Device B2');
      const stranger = generateDeviceIdentity('Stranger');
      const conversationId = dmConversationId(deviceA.publicKey, deviceB.publicKey);

      const message = createDmMessage(deviceA, {
        conversationId, body: 'secret plans', hlc: { wall: '2026-07-01T12:00:00.000Z', counter: 0 },
      });
      const sealedMessage = sealDmDirect({
        sender: deviceA, conversationId, events: [message],
        recipients: [{ deviceId: deviceB.publicKey, dhPublicKey: deviceB.dhPublicKey, pairSecret: PAIR_SECRET }],
      });
      if (!sealedMessage.ok) throw new Error('seal failed');
      await parkEnvelope(url, sealedMessage.sealed[0]!.token, encodeMailboxEnvelope(sealedMessage.sealed[0]!.envelope));

      // The stranger does not know the real pair secret between A and B, so it
      // derives a DIFFERENT token and its drain joins an empty mailbox.
      const wrongSecret = 'ff'.repeat(32);
      const drainBackend = nodeWsBackend();
      const strangerDrain = await runMailboxDrainJob({
        identity: stranger,
        backend: drainBackend,
        relayUrl: url,
        peers: [peer(deviceA.publicKey, wrongSecret)],
        handlers: { dmMessage: () => true },
      });
      drainBackend.destroy();

      expect(strangerDrain.drained).toBe(0);
      expect(strangerDrain.dmMessages).toBe(0);
    });
  }, 20_000);
});
