// Plan 21 Phase 9 (TC-7, web): a real 1:1 DM crosses a REAL @mylife/meerkat-relay
// server between two independent web nodes (real browser storage adapters), and
// the honest signed-proof receipt travels back. This is the web twin of the sync
// package's DM cross-client suite and the anti-"dead transport" proof: real bytes
// move, and node A only reads "Delivered" after node B's verified signed receipt
// arrives (never a timer). Uses the shared harness mailbox park/drain over the
// live relay (support/web-node-harness.ts), the exact rails MeerkatProvider's send
// + runForegroundDrain compose.

import { afterEach, describe, expect, it } from 'vitest';
import {
  dmConversationId,
  encodeMailboxEnvelope,
  getPairedDevice,
  type MailboxEnvelopeHandlers,
} from '@mylife/sync';
import {
  buildWebNode,
  drainMailboxes,
  pairNodes,
  parkEnvelope,
  resolvePairSecretHex,
  teardownNode,
  withRelay,
  type WebNode,
} from './support/web-node-harness';
import { ensureDmTables, getDmDelivery, listDmMessages } from '../dm-core';
import { buildDmMailboxHandlers, queueDmMessageCore } from '../dm-provider-core';
import { ensureDirectConversation } from '../dm-view-core';

let nodeA: WebNode | null = null;
let nodeB: WebNode | null = null;

afterEach(async () => {
  await teardownNode(nodeA);
  await teardownNode(nodeB);
  nodeA = null;
  nodeB = null;
});

function dmHandlers(url: string, node: WebNode, peer: WebNode): MailboxEnvelopeHandlers {
  return buildDmMailboxHandlers({
    db: node.db,
    identity: node.identity,
    resolvePeerDhKey: (id) => (id === peer.identity.publicKey ? peer.identity.dhPublicKey : null),
    resolvePairSecret: (id) => resolvePairSecretHex(getPairedDevice(node.db, id)?.sharedSecretRef),
    parkEnvelope: (token, envelope) => parkEnvelope(url, token, encodeMailboxEnvelope(envelope)),
  }) as MailboxEnvelopeHandlers;
}

describe('web DM 1:1 over a real relay (browser adapters end to end, TC-7)', () => {
  it('a DM sent on web node A lands on web node B, and B\'s signed receipt converges A to Delivered', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Web A');
      nodeB = await buildWebNode('Web B');
      pairNodes(nodeA, nodeB);
      // The real web boot creates the device-local dm_ tables (browser-sync-init);
      // buildWebNode does not, so create them here to mirror a booted node.
      ensureDmTables(nodeA.db);
      ensureDmTables(nodeB.db);

      const conversationId = dmConversationId(nodeA.identity.publicKey, nodeB.identity.publicKey);
      ensureDirectConversation(nodeA.db, nodeA.identity, {
        deviceId: nodeB.identity.publicKey,
        dhPublicKey: nodeB.identity.dhPublicKey,
      });

      // A sends: the local echo is written, and the sealed envelope really parks on
      // the live relay (parked === true only on a real park).
      const send = await queueDmMessageCore({
        db: nodeA.db,
        identity: nodeA.identity,
        conversationId,
        body: 'hello over the wire',
        relayAvailable: true,
        resolvePairSecret: (id) => resolvePairSecretHex(getPairedDevice(nodeA!.db, id)?.sharedSecretRef),
        parkEnvelope: (token, envelope) => parkEnvelope(url, token, encodeMailboxEnvelope(envelope)),
      });
      expect(send.recipients).toEqual([{ deviceId: nodeB.identity.publicKey, parked: true }]);
      expect(getDmDelivery(nodeA.db, send.event.id)[0]!.state).toBe('parked');

      // B has nothing yet, then drains the real relay mailbox and gets the message.
      expect(listDmMessages(nodeB.db, conversationId)).toHaveLength(0);
      const drainB = await drainMailboxes(url, nodeB, dmHandlers(url, nodeB, nodeA));
      expect(drainB.dmMessages).toBe(1);
      const bMessages = listDmMessages(nodeB.db, conversationId);
      expect(bMessages).toHaveLength(1);
      expect(bMessages[0]!.body).toBe('hello over the wire');

      // B's drain emitted a REAL signed delivered receipt back to A's mailbox
      // (delivered-on-drain). A drains and converges to 'delivered' with the
      // verifiable receipt signature stored -- never a fabricated state.
      const drainA = await drainMailboxes(url, nodeA, dmHandlers(url, nodeA, nodeB));
      expect(drainA.dmReceipts).toBe(1);
      const converged = getDmDelivery(nodeA.db, send.event.id)[0]!;
      expect(converged.state).toBe('delivered');
      expect(converged.receipt_sig).not.toBeNull();
    });
  });
});
