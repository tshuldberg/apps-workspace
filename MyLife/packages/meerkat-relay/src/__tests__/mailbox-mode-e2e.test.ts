/**
 * MK-033 mailbox mode over the real relay (the Briar pattern). The AC:
 * a phone that was offline receives its queued changes on wake from the
 * mailbox (its own node or a long-TTL relay), and the mailbox TTL purge is
 * verified. Only sealed ciphertext ever touches the relay.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  WebSocketRelayBackend,
  generateDeviceIdentity,
  deriveMailboxToken,
  sealMailboxDelta,
  openMailboxDelta,
  encodeMailboxEnvelope,
  decodeMailboxEnvelope,
  createChannelMessage,
  openChannelMessageMailboxDelta,
  sealChannelMessageMailboxDelta,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';
import { RelayHub } from '../hub';

const PAIR_SECRET = 'ef'.repeat(32);
const DAY_MS = 24 * 60 * 60 * 1000;

let server: RelayServer | null = null;
let backend: WebSocketRelayBackend | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  if (server) {
    await server.close();
    server = null;
  }
});

describe('mailbox mode e2e (MK-033 acceptance)', () => {
  it('an offline phone wakes to its queued, sealed deltas; the sender is long gone', async () => {
    // A mailbox-mode relay: long TTL, sized for a day of offline deltas.
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 },
    });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const token = deriveMailboxToken(PAIR_SECRET, phone.publicKey, Date.now());

    // The phone is OFFLINE. The desktop parks three sealed deltas and leaves.
    const sender = await backend.connect(url, token);
    const bodies = ['change one', 'change two', 'change three'];
    for (const body of bodies) {
      const envelope = sealMailboxDelta(desktop, { deviceId: phone.publicKey, dhPublicKey: phone.dhPublicKey }, { body });
      await sender.send(encodeMailboxEnvelope(envelope));
    }
    await new Promise((r) => setTimeout(r, 100)); // let the frames land in the mailbox
    await sender.close();

    // Store-and-forward proof: the queue outlives the sender's connection.
    expect(server.hub.stats().mailboxedEnvelopes).toBe(3);

    // "24h later": the phone wakes, joins its pair-private mailbox, drains it.
    const received: Uint8Array[] = [];
    const receiver = await backend.connect(url, token);
    receiver.onMessage((bytes) => received.push(bytes));
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(3);
    const opened = received
      .map((bytes) => decodeMailboxEnvelope(bytes))
      .map((env) => (env ? openMailboxDelta<{ body: string }>(phone, env) : null));
    expect(opened.every((o) => o?.ok)).toBe(true);
    expect(opened.map((o) => (o && o.ok ? o.payload.body : null))).toEqual(bodies);
    expect(opened.every((o) => o && o.ok && o.senderDeviceId === desktop.publicKey)).toBe(true);
    await receiver.close();
  });

  it('delivers an offline channel-message burst in order through the mailbox', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 },
    });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const communityId = 'cm_mailbox_channel';
    const first = createChannelMessage(desktop, {
      communityId,
      channelId: 'general',
      body: 'burst one',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const second = createChannelMessage(desktop, {
      communityId,
      channelId: 'general',
      body: 'burst two',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
    });
    const third = createChannelMessage(desktop, {
      communityId,
      channelId: 'general',
      body: 'burst three',
      hlc: { wall: '2026-06-13T00:00:03.000Z', counter: 0 },
    });
    const sealed = sealChannelMessageMailboxDelta({
      sender: desktop,
      recipient: { deviceId: phone.publicKey, dhPublicKey: phone.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      communityId,
      channelId: 'general',
      events: [third, first, second],
      now: '2026-06-13T00:00:04.000Z',
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const wireText = new TextDecoder().decode(encodeMailboxEnvelope(sealed.envelope));
    expect(wireText).not.toContain(desktop.publicKey);
    expect(wireText).not.toContain(phone.publicKey);
    expect(wireText).not.toContain(communityId);
    expect(wireText).not.toContain('burst one');

    const sender = await backend.connect(url, sealed.token);
    await sender.send(encodeMailboxEnvelope(sealed.envelope));
    await new Promise((r) => setTimeout(r, 100));
    await sender.close();
    expect(server.hub.stats().mailboxedEnvelopes).toBe(1);

    const received: Uint8Array[] = [];
    const receiver = await backend.connect(url, sealed.token);
    receiver.onMessage((bytes) => received.push(bytes));
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(1);
    const decoded = decodeMailboxEnvelope(received[0]!);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    const opened = openChannelMessageMailboxDelta(phone, decoded);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(desktop.publicKey);
    expect(opened.events.map((event) => event.body)).toEqual(['burst one', 'burst two', 'burst three']);
    await receiver.close();
  });

  it('relay mailbox TTL purges queued deltas after the window (injected clock)', () => {
    let nowMs = 1_000_000;
    const hub = new RelayHub({ now: () => nowMs, limits: { mailboxTtlMs: DAY_MS } });
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const token = deriveMailboxToken(PAIR_SECRET, phone.publicKey, nowMs);
    const event = createChannelMessage(desktop, {
      communityId: 'cm_ttl_channel',
      channelId: 'general',
      body: 'expires if the phone stays offline',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const sealed = sealChannelMessageMailboxDelta({
      sender: desktop,
      recipient: { deviceId: phone.publicKey, dhPublicKey: phone.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      communityId: 'cm_ttl_channel',
      channelId: 'general',
      events: [event],
      now: '2026-06-13T00:00:02.000Z',
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const envelopeText = new TextDecoder().decode(encodeMailboxEnvelope(sealed.envelope));

    // A sender parks a delta with no receiver present -> mailboxed.
    hub.join('sender', token, () => {});
    hub.relay('sender', envelopeText);
    hub.leave('sender');
    expect(hub.stats().mailboxedEnvelopes).toBe(1);

    // 23h: still queued. 25h: the sweep purges it.
    nowMs += 23 * 60 * 60 * 1000;
    hub.sweep();
    expect(hub.stats().mailboxedEnvelopes).toBe(1);
    nowMs += 2 * 60 * 60 * 1000;
    hub.sweep();
    expect(hub.stats().mailboxedEnvelopes).toBe(0);

    // A late receiver gets nothing: the window is honest.
    const frames: unknown[] = [];
    hub.join('receiver', token, (f) => frames.push(f));
    expect(frames.filter((f) => (f as { t?: string }).t === 'env')).toHaveLength(0);
  });
});
