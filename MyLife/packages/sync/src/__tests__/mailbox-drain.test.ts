/**
 * runMailboxDrainJob (Task 3): the honest asymmetric background win.
 *
 * A sender parks a sealed channel-message delta in the recipient's pair-private
 * mailbox while the recipient is offline; on wake the drain job joins the
 * mailbox token, opens+verifies with the recipient identity, and applies the
 * events into local storage. This works with NO peer online (the mailbox host
 * buffered the delta). Fail-closed: a tampered signature / wrong recipient /
 * corrupted ciphertext is dropped and counted as rejected, writing NOTHING.
 * Revoked / secret-missing peers are skipped entirely (no token, no join).
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createChannelMessage, verifyChannelMessage, type ChannelMessageEvent } from '../protocol/channel-message';
import {
  deriveMailboxToken,
  encodeMailboxEnvelope,
  type MailboxEnvelope,
} from '../protocol/mailbox';
import { sealChannelMessageMailboxDelta } from '../protocol/channel-mailbox';
import { createDmMessage, dmConversationId, type DmMessageEvent } from '../protocol/dm-message';
import { sealDmDirect } from '../protocol/dm-mailbox';
import { createDmReceipt, sealDmReceipt } from '../protocol/dm-receipt';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';
import {
  runMailboxDrainJob,
  type ApplyChannelEvents,
  type MailboxDrainPeer,
} from '../protocol/mailbox-drain';

const PAIR_SECRET = 'ef'.repeat(32);

/**
 * A store-and-forward mailbox backend: a join with envelopes already parked on
 * the token receives them immediately on the next onMessage handler (mirrors
 * the real relay draining its TTL mailbox on join). Parking is just a send by a
 * connector with no peer present.
 */
class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  private readonly live = new Set<string>();
  destroyed = false;

  /** Pre-park a sealed envelope into a token's mailbox (the offline sender). */
  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
    if (this.destroyed) throw new Error('destroyed');
    if (!token.trim()) throw new Error('Relay token is required.');
    this.live.add(token);
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

function instantWait(): Promise<void> {
  return Promise.resolve();
}

function activePeer(deviceId: string): MailboxDrainPeer {
  return { deviceId, pairSharedSecretHex: PAIR_SECRET, revoked: false, isActive: true };
}

describe('runMailboxDrainJob (offline channel-message drain)', () => {
  it('drains, verifies, and applies a sealed channel event with no peer online', async () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const communityId = 'cm_drain';
    const event = createChannelMessage(desktop, {
      communityId, channelId: 'general', body: 'parked while offline',
      hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 },
    });
    const sealed = sealChannelMessageMailboxDelta({
      sender: desktop,
      recipient: { deviceId: phone.publicKey, dhPublicKey: phone.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      communityId, channelId: 'general', events: [event],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const backend = new MailboxRelayBackend();
    backend.park(sealed.token, encodeMailboxEnvelope(sealed.envelope));

    const stored: ChannelMessageEvent[] = [];
    const applyEvents: ApplyChannelEvents = (events) => {
      let inserted = 0;
      for (const e of events) {
        if (stored.some((s) => s.id === e.id)) continue;
        stored.push(e); inserted += 1;
      }
      return { inserted, skipped: events.length - inserted, invalid: 0 };
    };

    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [activePeer(desktop.publicKey)], applyEvents, waitForDrain: instantWait,
    });

    expect(result.attempted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.drained).toBe(1);
    expect(result.applied).toBe(1);
    expect(result.rejected).toBe(0);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.body).toBe('parked while offline');
    expect(verifyChannelMessage(stored[0]!)).toBe(true);
  });

  it('drains a multi-event burst in HLC order', async () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const communityId = 'cm_burst';
    const first = createChannelMessage(desktop, { communityId, channelId: 'general', body: 'one', hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 } });
    const second = createChannelMessage(desktop, { communityId, channelId: 'general', body: 'two', hlc: { wall: '2026-06-14T00:00:02.000Z', counter: 0 } });
    const sealed = sealChannelMessageMailboxDelta({
      sender: desktop, recipient: { deviceId: phone.publicKey, dhPublicKey: phone.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET, communityId, channelId: 'general', events: [second, first],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const backend = new MailboxRelayBackend();
    backend.park(sealed.token, encodeMailboxEnvelope(sealed.envelope));

    const stored: ChannelMessageEvent[] = [];
    const applyEvents: ApplyChannelEvents = (events) => {
      for (const e of events) stored.push(e);
      return { inserted: events.length, skipped: 0, invalid: 0 };
    };

    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [activePeer(desktop.publicKey)], applyEvents, waitForDrain: instantWait,
    });
    expect(result.applied).toBe(2);
    expect(stored.map((e) => e.body)).toEqual(['one', 'two']);
  });

  it('fail-closed: a tampered signature is dropped and nothing is written', async () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const event = createChannelMessage(desktop, { communityId: 'cm_x', channelId: 'general', body: 'x', hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 } });
    const sealed = sealChannelMessageMailboxDelta({
      sender: desktop, recipient: { deviceId: phone.publicKey, dhPublicKey: phone.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET, communityId: 'cm_x', channelId: 'general', events: [event],
    });
    if (!sealed.ok) return;

    const tampered: MailboxEnvelope = { ...sealed.envelope, signature: '00'.repeat(64) };
    const backend = new MailboxRelayBackend();
    backend.park(sealed.token, encodeMailboxEnvelope(tampered));

    const stored: ChannelMessageEvent[] = [];
    const applyEvents: ApplyChannelEvents = (events) => {
      for (const e of events) stored.push(e);
      return { inserted: events.length, skipped: 0, invalid: 0 };
    };

    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [activePeer(desktop.publicKey)], applyEvents, waitForDrain: instantWait,
    });
    expect(result.drained).toBe(1);
    expect(result.applied).toBe(0);
    expect(result.rejected).toBe(1);
    expect(stored).toHaveLength(0);
  });

  it('fail-closed: an envelope for a different recipient is dropped', async () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const other = generateDeviceIdentity('Other');
    const event = createChannelMessage(desktop, { communityId: 'cm_y', channelId: 'general', body: 'y', hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 } });
    // Seal to OTHER, not phone, but park it under phone's mailbox token.
    const sealed = sealChannelMessageMailboxDelta({
      sender: desktop, recipient: { deviceId: other.publicKey, dhPublicKey: other.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET, communityId: 'cm_y', channelId: 'general', events: [event],
    });
    if (!sealed.ok) return;

    const phoneToken = deriveMailboxToken(PAIR_SECRET, phone.publicKey, Date.now());
    const backend = new MailboxRelayBackend();
    backend.park(phoneToken, encodeMailboxEnvelope(sealed.envelope));

    const stored: ChannelMessageEvent[] = [];
    const applyEvents: ApplyChannelEvents = (events) => {
      for (const e of events) stored.push(e);
      return { inserted: events.length, skipped: 0, invalid: 0 };
    };

    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [activePeer(desktop.publicKey)], applyEvents, waitForDrain: instantWait,
    });
    expect(result.applied).toBe(0);
    expect(result.rejected).toBe(1);
    expect(stored).toHaveLength(0);
  });

  it('fail-closed: corrupted ciphertext is dropped', async () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const backend = new MailboxRelayBackend();
    const phoneToken = deriveMailboxToken(PAIR_SECRET, phone.publicKey, Date.now());
    backend.park(phoneToken, new TextEncoder().encode('this is not a valid envelope'));

    const stored: ChannelMessageEvent[] = [];
    const applyEvents: ApplyChannelEvents = (events) => {
      for (const e of events) stored.push(e);
      return { inserted: events.length, skipped: 0, invalid: 0 };
    };

    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [activePeer(desktop.publicKey)], applyEvents, waitForDrain: instantWait,
    });
    expect(result.drained).toBe(1);
    expect(result.applied).toBe(0);
    expect(result.rejected).toBe(1);
    expect(stored).toHaveLength(0);
  });

  it('skips revoked / inactive / secret-missing peers without deriving a token or joining', async () => {
    const phone = generateDeviceIdentity('Phone');
    let connectCount = 0;
    const backend: RelayBackend = {
      async connect(): Promise<RelaySession> {
        connectCount += 1;
        return { async send() {}, onMessage() {}, async close() {} };
      },
      destroy() {},
    };
    const applyEvents: ApplyChannelEvents = () => { throw new Error('should not apply'); };

    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [
        { deviceId: 'revoked', pairSharedSecretHex: PAIR_SECRET, revoked: true, isActive: true },
        { deviceId: 'inactive', pairSharedSecretHex: PAIR_SECRET, revoked: false, isActive: false },
        { deviceId: 'nosecret', pairSharedSecretHex: null, revoked: false, isActive: true },
      ],
      applyEvents, waitForDrain: instantWait,
    });

    expect(result.attempted).toBe(0);
    expect(result.skipped).toBe(3);
    expect(connectCount).toBe(0);
  });

  it('no relay URL: every peer skipped, no attempt, no write', async () => {
    const phone = generateDeviceIdentity('Phone');
    let connectCount = 0;
    const backend: RelayBackend = {
      async connect(): Promise<RelaySession> { connectCount += 1; return { async send() {}, onMessage() {}, async close() {} }; },
      destroy() {},
    };
    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: '   ',
      peers: [activePeer('peer')], applyEvents: () => ({ inserted: 0, skipped: 0, invalid: 0 }),
      waitForDrain: instantWait,
    });
    expect(result.attempted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(connectCount).toBe(0);
  });
});

describe('runMailboxDrainJob DM counters (Plan 21 Phase 2)', () => {
  it('initializes dmMessages/dmReceipts to 0 when nothing is parked', async () => {
    const phone = generateDeviceIdentity('Phone');
    const backend = new MailboxRelayBackend();
    const result = await runMailboxDrainJob({
      identity: phone, backend, relayUrl: 'ws://relay',
      peers: [], waitForDrain: instantWait, handlers: {},
    });
    expect(result.dmMessages).toBe(0);
    expect(result.dmReceipts).toBe(0);
  });

  it('drains a parked DM message and increments dmMessages only', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const event = createDmMessage(alice, {
      conversationId: cid, body: 'hi bob', hlc: { wall: '2026-07-01T00:00:01.000Z', counter: 0 },
    });
    const sealed = sealDmDirect({
      sender: alice, conversationId: cid, events: [event],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: PAIR_SECRET }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const backend = new MailboxRelayBackend();
    backend.park(sealed.sealed[0]!.token, encodeMailboxEnvelope(sealed.sealed[0]!.envelope));

    const received: DmMessageEvent[] = [];
    const result = await runMailboxDrainJob({
      identity: bob, backend, relayUrl: 'ws://relay',
      peers: [activePeer(alice.publicKey)], waitForDrain: instantWait,
      handlers: {
        dmMessage: (sender, opened) => {
          expect(sender).toBe(alice.publicKey);
          received.push(...opened.events);
          return true;
        },
      },
    });

    expect(result.dmMessages).toBe(1);
    expect(result.dmReceipts).toBe(0);
    expect(result.applied).toBe(0);
    expect(result.fileRequests).toBe(0);
    expect(result.fileGrants).toBe(0);
    expect(result.rejected).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0]!.id).toBe(event.id);
  });

  it('drains a parked DM receipt and increments dmReceipts only', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const receipt = createDmReceipt(bob, {
      conversationId: cid, messageId: 'm1', state: 'delivered', at: '2026-07-01T00:00:02.000Z',
    });
    const sealed = sealDmReceipt({
      sender: bob,
      recipient: { deviceId: alice.publicKey, dhPublicKey: alice.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      receipt,
    });

    const backend = new MailboxRelayBackend();
    backend.park(sealed.token, encodeMailboxEnvelope(sealed.envelope));

    let recordedState: string | null = null;
    const result = await runMailboxDrainJob({
      identity: alice, backend, relayUrl: 'ws://relay',
      peers: [activePeer(bob.publicKey)], waitForDrain: instantWait,
      handlers: {
        dmReceipt: (sender, opened) => {
          expect(sender).toBe(bob.publicKey);
          recordedState = opened.receipt.state;
          return true;
        },
      },
    });

    expect(result.dmReceipts).toBe(1);
    expect(result.dmMessages).toBe(0);
    expect(result.rejected).toBe(0);
    expect(recordedState).toBe('delivered');
  });

  it('a missing dmMessage handler is counted rejected, not dmMessages', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const event = createDmMessage(alice, {
      conversationId: cid, body: 'hi', hlc: { wall: '2026-07-01T00:00:01.000Z', counter: 0 },
    });
    const sealed = sealDmDirect({
      sender: alice, conversationId: cid, events: [event],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: PAIR_SECRET }],
    });
    if (!sealed.ok) throw new Error('seal failed');

    const backend = new MailboxRelayBackend();
    backend.park(sealed.sealed[0]!.token, encodeMailboxEnvelope(sealed.sealed[0]!.envelope));

    const result = await runMailboxDrainJob({
      identity: bob, backend, relayUrl: 'ws://relay',
      peers: [activePeer(alice.publicKey)], waitForDrain: instantWait,
      handlers: {},
    });

    expect(result.dmMessages).toBe(0);
    expect(result.rejected).toBe(1);
  });

  it('folds dmMessages + dmReceipts across multiple peers, existing counters untouched', async () => {
    const bob = generateDeviceIdentity('Bob');
    const alice = generateDeviceIdentity('Alice');
    const carol = generateDeviceIdentity('Carol');
    const aliceSecret = 'aa'.repeat(32);
    const carolSecret = 'cc'.repeat(32);
    const cidAlice = dmConversationId(alice.publicKey, bob.publicKey);
    const cidCarol = dmConversationId(carol.publicKey, bob.publicKey);

    const eventFromAlice = createDmMessage(alice, {
      conversationId: cidAlice, body: 'from alice', hlc: { wall: '2026-07-01T00:00:01.000Z', counter: 0 },
    });
    const sealedFromAlice = sealDmDirect({
      sender: alice, conversationId: cidAlice, events: [eventFromAlice],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: aliceSecret }],
    });
    if (!sealedFromAlice.ok) throw new Error('seal failed');

    const receiptFromCarol = createDmReceipt(carol, {
      conversationId: cidCarol, messageId: 'm-carol', state: 'read', at: '2026-07-01T00:00:03.000Z',
    });
    const sealedReceiptFromCarol = sealDmReceipt({
      sender: carol,
      recipient: { deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey },
      pairSharedSecretHex: carolSecret,
      receipt: receiptFromCarol,
    });

    const backend = new MailboxRelayBackend();
    backend.park(sealedFromAlice.sealed[0]!.token, encodeMailboxEnvelope(sealedFromAlice.sealed[0]!.envelope));
    backend.park(sealedReceiptFromCarol.token, encodeMailboxEnvelope(sealedReceiptFromCarol.envelope));

    const result = await runMailboxDrainJob({
      identity: bob, backend, relayUrl: 'ws://relay',
      peers: [
        { deviceId: alice.publicKey, pairSharedSecretHex: aliceSecret, revoked: false, isActive: true },
        { deviceId: carol.publicKey, pairSharedSecretHex: carolSecret, revoked: false, isActive: true },
      ],
      waitForDrain: instantWait,
      handlers: {
        dmMessage: () => true,
        dmReceipt: () => true,
      },
    });

    expect(result.dmMessages).toBe(1);
    expect(result.dmReceipts).toBe(1);
    expect(result.rejected).toBe(0);
    expect(result.attempted).toBe(2);
    // Existing counters stay at their zero baseline: nothing else was parked.
    expect(result.applied).toBe(0);
    expect(result.fileRequests).toBe(0);
    expect(result.fileGrants).toBe(0);
    expect(result.historyRequests).toBe(0);
    expect(result.historyGrants).toBe(0);
    expect(result.joinRequests).toBe(0);
    expect(result.joinGrants).toBe(0);
    expect(result.publicJoinRequests).toBe(0);
  });
});
