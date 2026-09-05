/**
 * MailboxListenEngine (live-wake, founder direction 2026-08-01).
 *
 * The engine holds persistent listeners on this device's inbound mailbox
 * tokens. Because a connected session CONSUMES envelopes (the relay forwards
 * instead of parking), the listener must itself apply every frame through the
 * one fail-closed dispatcher; these tests prove delivery, catch-up on
 * reconnect (no loss), fail-closed rejection, token diffing, the listener cap,
 * honest statuses, and that a stale in-flight connect cannot resurrect a
 * stopped engine.
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createChannelMessage, type ChannelMessageEvent } from '../protocol/channel-message';
import { deriveMailboxToken, encodeMailboxEnvelope } from '../protocol/mailbox';
import { sealChannelMessageMailboxDelta } from '../protocol/channel-mailbox';
import type { RelayBackend, RelayConnectOptions, RelaySession } from '../transport/relay-transport';
import { MailboxListenEngine, type MailboxListenStatus } from '../protocol/mailbox-listen';
import type { ApplyChannelEvents, MailboxDrainPeer } from '../protocol/mailbox-drain';

const PAIR_SECRET = 'ab'.repeat(32);

/** A live relay double: per-token mailbox + immediate forward to open listeners. */
class ListenRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  private readonly open = new Map<string, LiveSession[]>();
  connects = 0;
  failNextConnects = 0;

  park(token: string, bytes: Uint8Array): void {
    const listeners = this.open.get(token) ?? [];
    if (listeners.length > 0) {
      for (const l of listeners) l.deliver(bytes);
      return;
    }
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  /** Server-side drop of every session on a token (fires client onClose). */
  dropToken(token: string): void {
    for (const l of [...(this.open.get(token) ?? [])]) l.drop();
  }

  openCount(token: string): number {
    return (this.open.get(token) ?? []).length;
  }

  async connect(_url: string, token: string, _o?: RelayConnectOptions): Promise<RelaySession> {
    this.connects += 1;
    if (this.failNextConnects > 0) {
      this.failNextConnects -= 1;
      throw new Error('connect refused');
    }
    const session = new LiveSession(token, this);
    const list = this.open.get(token) ?? [];
    list.push(session);
    this.open.set(token, list);
    const parked = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    queueMicrotask(() => {
      for (const bytes of parked) session.deliver(bytes);
    });
    return session;
  }

  remove(session: LiveSession): void {
    const list = this.open.get(session.token) ?? [];
    this.open.set(session.token, list.filter((s) => s !== session));
  }

  destroy(): void {
    for (const list of this.open.values()) {
      for (const session of [...list]) session.drop();
    }
    this.open.clear();
    this.mailbox.clear();
  }
}

class LiveSession implements RelaySession {
  readonly token: string;
  private readonly backend: ListenRelayBackend;
  private messageHandler: ((bytes: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private readonly buffered: Uint8Array[] = [];
  closed = false;

  constructor(token: string, backend: ListenRelayBackend) {
    this.token = token;
    this.backend = backend;
  }

  deliver(bytes: Uint8Array): void {
    if (this.closed) return;
    if (this.messageHandler) this.messageHandler(new Uint8Array(bytes));
    else this.buffered.push(new Uint8Array(bytes));
  }

  drop(): void {
    if (this.closed) return;
    this.closed = true;
    this.backend.remove(this);
    this.closeHandler?.();
  }

  async send(): Promise<void> {}

  onMessage(handler: (bytes: Uint8Array) => void): void {
    this.messageHandler = handler;
    for (const bytes of this.buffered.splice(0)) handler(bytes);
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.backend.remove(this);
  }
}

function activePeer(deviceId: string, secret: string = PAIR_SECRET): MailboxDrainPeer {
  return { deviceId, pairSharedSecretHex: secret, revoked: false, isActive: true };
}

function makeStore(): { stored: ChannelMessageEvent[]; apply: ApplyChannelEvents } {
  const stored: ChannelMessageEvent[] = [];
  const apply: ApplyChannelEvents = (events) => {
    let inserted = 0;
    for (const e of events) {
      if (stored.some((s) => s.id === e.id)) continue;
      stored.push(e);
      inserted += 1;
    }
    return { inserted, skipped: events.length - inserted, invalid: 0 };
  };
  return { stored, apply };
}

function sealFor(
  sender: ReturnType<typeof generateDeviceIdentity>,
  recipient: ReturnType<typeof generateDeviceIdentity>,
  body: string,
  secret: string = PAIR_SECRET,
): { token: string; bytes: Uint8Array } {
  const event = createChannelMessage(sender, {
    communityId: 'cm_listen',
    channelId: 'general',
    body,
    hlc: { wall: '2026-08-01T00:00:01.000Z', counter: 0 },
  });
  const sealed = sealChannelMessageMailboxDelta({
    sender,
    recipient: { deviceId: recipient.publicKey, dhPublicKey: recipient.dhPublicKey },
    pairSharedSecretHex: secret,
    communityId: 'cm_listen',
    channelId: 'general',
    events: [event],
  });
  if (!sealed.ok) throw new Error('seal failed');
  return { token: sealed.token, bytes: encodeMailboxEnvelope(sealed.envelope) };
}

const instantTimer = (fn: () => void, _ms: number): unknown => {
  const handle = setTimeout(fn, 0);
  return handle;
};

async function settle(rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('MailboxListenEngine', () => {
  it('applies a live-forwarded envelope immediately while listening', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { stored, apply } = makeStore();
    const appliedLabels: string[] = [];

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      onApplied: (_outcome, label) => appliedLabels.push(label),
      setTimer: instantTimer,
    });
    engine.start();
    await settle();
    expect(engine.status()).toBe('listening');

    const { token, bytes } = sealFor(sender, me, 'instant');
    backend.park(token, bytes);
    await settle();

    expect(stored).toHaveLength(1);
    expect(stored[0]!.body).toBe('instant');
    expect(engine.counts()).toEqual({ received: 1, applied: 1, rejected: 0 });
    expect(appliedLabels).toEqual([`peer:${sender.publicKey}`]);
    engine.stop();
  });

  it('drains envelopes parked before start (catch-up is the same path)', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { stored, apply } = makeStore();
    const { token, bytes } = sealFor(sender, me, 'parked earlier');
    backend.park(token, bytes);

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      setTimer: instantTimer,
    });
    engine.start();
    await settle();

    expect(stored.map((e) => e.body)).toEqual(['parked earlier']);
    engine.stop();
  });

  it('reconnects after a server drop and loses nothing parked during the gap', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { stored, apply } = makeStore();

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      setTimer: instantTimer,
    });
    engine.start();
    await settle();
    const { token } = sealFor(sender, me, 'ignored');

    backend.dropToken(token);
    // Parked while the listener is down: must arrive after the reconnect.
    const gap = sealFor(sender, me, 'sent during the gap');
    backend.park(gap.token, gap.bytes);
    await settle(10);

    expect(engine.status()).toBe('listening');
    expect(stored.map((e) => e.body)).toContain('sent during the gap');
    expect(backend.connects).toBeGreaterThanOrEqual(2);
    engine.stop();
  });

  it('counts a tampered envelope rejected and never fires onApplied for it', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { stored, apply } = makeStore();
    let appliedCalls = 0;

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      onApplied: () => { appliedCalls += 1; },
      setTimer: instantTimer,
    });
    engine.start();
    await settle();

    const { token, bytes } = sealFor(sender, me, 'tampered');
    const corrupted = new Uint8Array(bytes);
    corrupted[corrupted.length - 8] ^= 0xff;
    backend.park(token, corrupted);
    await settle();

    expect(stored).toHaveLength(0);
    expect(engine.counts().rejected).toBe(1);
    expect(appliedCalls).toBe(0);
    engine.stop();
  });

  it('refreshTokens closes a revoked peer listener and opens a new peer listener', async () => {
    const first = generateDeviceIdentity('First');
    const second = generateDeviceIdentity('Second');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { apply } = makeStore();

    const FIRST_SECRET = 'a1'.repeat(32);
    const SECOND_SECRET = 'b2'.repeat(32);
    let peers: MailboxDrainPeer[] = [activePeer(first.publicKey, FIRST_SECRET)];
    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => peers,
      handlers: { channelMessage: apply },
      setTimer: instantTimer,
    });
    engine.start();
    await settle();
    // Two listeners per peer: the current and previous day-bucket tokens.
    expect(engine.listenerCount()).toBe(2);

    peers = [
      { ...activePeer(first.publicKey, FIRST_SECRET), revoked: true },
      activePeer(second.publicKey, SECOND_SECRET),
    ];
    engine.refreshTokens();
    await settle();

    expect(engine.listenerCount()).toBe(2);
    const firstToken = sealFor(first, me, 'x', FIRST_SECRET).token;
    expect(backend.openCount(firstToken)).toBe(0);
    engine.stop();
  });

  it('re-derives the token window when the UTC day bucket rolls', async () => {
    const peer = generateDeviceIdentity('Peer');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { apply } = makeStore();
    const SECRET = 'c3'.repeat(32);
    let nowMs = Date.parse('2026-08-25T23:59:00.000Z');
    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => [activePeer(peer.publicKey, SECRET)],
      handlers: { channelMessage: apply },
      setTimer: instantTimer,
      now: () => nowMs,
    });
    engine.start();
    await settle();
    const beforeToken = deriveMailboxToken(SECRET, me.publicKey, nowMs);
    expect(backend.openCount(beforeToken)).toBe(1);

    // Roll past midnight UTC: a host-driven refresh re-derives the window, so
    // the NEW current bucket is held and the two-day-old token is released.
    nowMs = Date.parse('2026-08-26T00:01:00.000Z');
    engine.refreshTokens();
    await settle();
    const afterToken = deriveMailboxToken(SECRET, me.publicKey, nowMs);
    expect(backend.openCount(afterToken)).toBe(1);
    // Yesterday's token (= beforeToken's bucket) stays in the window.
    expect(backend.openCount(beforeToken)).toBe(1);
    expect(engine.listenerCount()).toBe(2);
    engine.stop();
  });

  it('enforces the listener cap with peer tokens first', async () => {
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { apply } = makeStore();
    const peers = [generateDeviceIdentity('A'), generateDeviceIdentity('B')]
      .map((d, i) => activePeer(d.publicKey, (i === 0 ? 'e1' : 'e2').repeat(32)));

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => peers,
      extraTokens: () => [
        { token: 'cc'.repeat(32), label: 'extra:one' },
        { token: 'dd'.repeat(32), label: 'extra:two' },
      ],
      handlers: { channelMessage: apply },
      maxListeners: 3,
      setTimer: instantTimer,
    });
    engine.start();
    await settle();

    expect(engine.listenerCount()).toBe(3);
    expect(backend.openCount('dd'.repeat(32))).toBe(0);
    engine.stop();
  });

  it('reports unavailable with no relay URL and connects once one appears', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { apply } = makeStore();
    const statuses: MailboxListenStatus[] = [];
    let url: string | null = null;

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => url,
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      onStatus: (s) => statuses.push(s),
      setTimer: instantTimer,
    });
    engine.start();
    await settle();
    expect(engine.status()).toBe('unavailable');

    url = 'ws://relay';
    await settle(12);
    expect(engine.status()).toBe('listening');
    expect(statuses).toContain('unavailable');
    expect(statuses[statuses.length - 1]).toBe('listening');
    engine.stop();
  });

  it('a stale in-flight connect cannot resurrect a stopped engine', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { apply } = makeStore();

    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slowRelayUrl = async (): Promise<string> => {
      await gate;
      return 'ws://relay';
    };

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: slowRelayUrl,
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      setTimer: instantTimer,
    });
    engine.start();
    engine.stop();
    release!();
    await settle();

    const token = sealFor(sender, me, 'x').token;
    expect(backend.openCount(token)).toBe(0);
    expect(engine.status()).toBe('stopped');
  });

  it('an all-duplicate channel delta counts rejected, mirroring the drain', async () => {
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const backend = new ListenRelayBackend();
    const { stored, apply } = makeStore();
    let appliedCalls = 0;

    const engine = new MailboxListenEngine({
      identity: me,
      backend,
      relayUrl: () => 'ws://relay',
      peers: () => [activePeer(sender.publicKey)],
      handlers: { channelMessage: apply },
      onApplied: () => { appliedCalls += 1; },
      setTimer: instantTimer,
    });
    engine.start();
    await settle();

    const { token, bytes } = sealFor(sender, me, 'dup');
    backend.park(token, bytes);
    await settle();
    backend.park(token, bytes);
    await settle();

    expect(stored).toHaveLength(1);
    expect(appliedCalls).toBe(1);
    expect(engine.counts()).toEqual({ received: 2, applied: 1, rejected: 1 });
    engine.stop();
  });
});
