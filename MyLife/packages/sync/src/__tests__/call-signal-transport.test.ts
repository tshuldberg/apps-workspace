// Plan 25 WP-25G: sealed call-signal frames + near-real-time relay transport.
//
// The fake relay backend here models the REAL @mylife/meerkat-relay hub
// semantics: token-grouped sessions, immediate forward to joined peers, and a
// TTL mailbox that parks frames for an absent peer and drains them on join.
// The transport must never fabricate delivery (sendFrame true only on a real
// send) and never fabricate connectivity (status from real events only).

import { describe, expect, it, vi } from 'vitest';
import {
  CALL_INVITE_CHANNEL_ID,
  createCallSignal,
  deriveCallInviteToken,
  deriveCallSignalToken,
  openCallSignalFrame,
  sealCallSignalFrame,
  verifyCallSignal,
  type CallSignal,
} from '../protocol/call-signal';
import {
  CallSignalTransport,
} from '../transport/call-signal-channel';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';
import { generateDeviceIdentity } from '../identity/device-identity';

const PAIR_SECRET = 'ab'.repeat(32);
const PAIR_SECRET_BYTES = new Uint8Array(32).fill(0xab);

function makeSignal(overrides: Partial<Parameters<typeof createCallSignal>[0]> = {}): CallSignal {
  const sender = generateDeviceIdentity('call-transport-test');
  const result = createCallSignal({
    sender,
    callId: 'call-1',
    kind: 'invite',
    toDeviceId: 'cd'.repeat(32),
    media: 'voice',
    nowMs: 1_000_000,
    ...overrides,
  });
  if (!result.ok) throw new Error(`createCallSignal failed: ${result.reason}`);
  return result.signal;
}

// --- Fake relay: token groups + park/drain mailbox, mirroring hub.ts. -------

class FakeRelaySession implements RelaySession {
  handlers: Array<(envelope: Uint8Array) => void> = [];
  closeHandlers: Array<() => void> = [];
  closed = false;

  constructor(
    private readonly relay: FakeRelay,
    readonly token: string,
    readonly failSend = false,
  ) {}

  async send(envelope: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('closed');
    if (this.failSend) throw new Error('send failed');
    this.relay.forward(this, envelope);
  }

  // Buffer frames that arrive before a handler attaches, exactly like the
  // real WebSocketRelaySession (the relay drains its mailbox on join, before
  // the app can call onMessage).
  private pending: Uint8Array[] = [];

  onMessage(handler: (envelope: Uint8Array) => void): void {
    this.handlers.push(handler);
    const queued = this.pending.splice(0, this.pending.length);
    for (const envelope of queued) handler(envelope);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.relay.leave(this);
  }

  /** Simulate a network drop (server side): notify close handlers. */
  drop(): void {
    this.closed = true;
    this.relay.leave(this);
    for (const h of this.closeHandlers) h();
  }

  deliver(envelope: Uint8Array): void {
    if (this.handlers.length === 0) {
      this.pending.push(envelope);
      return;
    }
    for (const h of this.handlers) h(envelope);
  }
}

class FakeRelay implements RelayBackend {
  sessions = new Map<string, Set<FakeRelaySession>>();
  mailbox = new Map<string, Uint8Array[]>();
  connectCount = 0;
  failNextConnects = 0;
  failSends = false;

  async connect(_url: string, token: string): Promise<RelaySession> {
    this.connectCount += 1;
    if (this.failNextConnects > 0) {
      this.failNextConnects -= 1;
      throw new Error('connect failed');
    }
    const session = new FakeRelaySession(this, token, this.failSends);
    const group = this.sessions.get(token) ?? new Set();
    group.add(session);
    this.sessions.set(token, group);
    // Drain the parked mailbox to the joining peer, like the real hub.
    const queued = this.mailbox.get(token);
    if (queued && queued.length > 0) {
      this.mailbox.delete(token);
      queueMicrotask(() => {
        for (const envelope of queued) session.deliver(envelope);
      });
    }
    return session;
  }

  forward(from: FakeRelaySession, envelope: Uint8Array): void {
    const group = this.sessions.get(from.token);
    const others = [...(group ?? [])].filter((s) => s !== from && !s.closed);
    if (others.length === 0) {
      const queued = this.mailbox.get(from.token) ?? [];
      queued.push(envelope);
      this.mailbox.set(from.token, queued);
      return;
    }
    for (const other of others) other.deliver(envelope);
  }

  leave(session: FakeRelaySession): void {
    this.sessions.get(session.token)?.delete(session);
  }

  destroy(): void {
    this.sessions.clear();
  }
}

const relayUrl = () => 'wss://relay.test';

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

describe('sealed call-signal frames', () => {
  it('round-trips a signal through seal + open', () => {
    const signal = makeSignal();
    const frame = sealCallSignalFrame(PAIR_SECRET_BYTES, signal);
    const opened = openCallSignalFrame(PAIR_SECRET_BYTES, frame);
    expect(opened).toEqual(signal);
  });

  it('the sealed frame never exposes device ids or kind in cleartext', () => {
    const signal = makeSignal();
    const frame = sealCallSignalFrame(PAIR_SECRET_BYTES, signal);
    const text = new TextDecoder().decode(frame);
    expect(text).not.toContain(signal.fromDeviceId);
    expect(text).not.toContain(signal.toDeviceId);
    expect(text).not.toContain('invite');
    expect(text).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/u);
  });

  it('rejects a tampered frame (fail-closed null)', () => {
    const frame = sealCallSignalFrame(PAIR_SECRET_BYTES, makeSignal());
    const text = new TextDecoder().decode(frame);
    const flipped = text.slice(0, -1) + (text.endsWith('0') ? '1' : '0');
    expect(openCallSignalFrame(PAIR_SECRET_BYTES, new TextEncoder().encode(flipped))).toBeNull();
  });

  it('rejects a frame sealed under a different pair secret', () => {
    const frame = sealCallSignalFrame(PAIR_SECRET_BYTES, makeSignal());
    const otherSecret = new Uint8Array(32).fill(0xcd);
    expect(openCallSignalFrame(otherSecret, frame)).toBeNull();
  });

  it('rejects malformed, oversized, and garbage frames without throwing', () => {
    expect(openCallSignalFrame(PAIR_SECRET_BYTES, new TextEncoder().encode('not-a-frame'))).toBeNull();
    expect(openCallSignalFrame(PAIR_SECRET_BYTES, new TextEncoder().encode('zz.zz'))).toBeNull();
    expect(openCallSignalFrame(PAIR_SECRET_BYTES, new Uint8Array(0))).toBeNull();
    expect(openCallSignalFrame(PAIR_SECRET_BYTES, new Uint8Array(300_000).fill(0x61))).toBeNull();
  });

  it('an opened frame still requires verifyCallSignal to pass (NC-25.2)', () => {
    const sender = generateDeviceIdentity('call-transport-test');
    const recipient = 'cd'.repeat(32);
    const created = createCallSignal({
      sender,
      callId: 'call-verify',
      kind: 'invite',
      toDeviceId: recipient,
      media: 'video',
      nowMs: 1_000_000,
    });
    if (!created.ok) throw new Error('create failed');
    const opened = openCallSignalFrame(
      PAIR_SECRET_BYTES,
      sealCallSignalFrame(PAIR_SECRET_BYTES, created.signal),
    );
    const verified = verifyCallSignal(opened, {
      senderPublicKey: sender.publicKey,
      expectedRecipientDeviceId: recipient,
      nowMs: 1_001_000,
      hasSeenNonce: () => false,
    });
    expect(verified.ok).toBe(true);
    const wrongRecipient = verifyCallSignal(opened, {
      senderPublicKey: sender.publicKey,
      expectedRecipientDeviceId: 'ef'.repeat(32),
      nowMs: 1_001_000,
      hasSeenNonce: () => false,
    });
    expect(wrongRecipient.ok).toBe(false);
  });
});

describe('invite channel token', () => {
  it('derives a stable pair-private invite token distinct from call tokens', () => {
    const inviteToken = deriveCallInviteToken(PAIR_SECRET);
    expect(inviteToken).toBe(deriveCallInviteToken(PAIR_SECRET));
    expect(inviteToken).toBe(deriveCallSignalToken(PAIR_SECRET, CALL_INVITE_CHANNEL_ID));
    expect(inviteToken).not.toBe(deriveCallSignalToken(PAIR_SECRET, 'call-1'));
    expect(inviteToken).toMatch(/^[0-9a-f]{64}$/u);
    // A different pair derives a different channel: the relay cannot correlate.
    expect(deriveCallInviteToken('cd'.repeat(32))).not.toBe(inviteToken);
  });
});

describe('CallSignalTransport', () => {
  it('delivers frames in near-real time between two live listeners', async () => {
    const relay = new FakeRelay();
    const a = new CallSignalTransport({ backend: relay, relayUrl });
    const b = new CallSignalTransport({ backend: relay, relayUrl });
    const token = deriveCallInviteToken(PAIR_SECRET);

    const received: Uint8Array[] = [];
    b.listen(token, (frame) => received.push(frame));
    await flush();

    const frame = sealCallSignalFrame(PAIR_SECRET_BYTES, makeSignal());
    const sent = await a.sendFrame(token, frame);
    await flush();

    expect(sent).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(frame);
    a.destroy();
    b.destroy();
  });

  it('parks a frame when no listener is joined and drains it on join', async () => {
    const relay = new FakeRelay();
    const a = new CallSignalTransport({ backend: relay, relayUrl });
    const token = deriveCallSignalToken(PAIR_SECRET, 'call-park');
    const frame = sealCallSignalFrame(PAIR_SECRET_BYTES, makeSignal({ callId: 'call-park' }));

    expect(await a.sendFrame(token, frame)).toBe(true);
    expect(relay.mailbox.get(token)).toHaveLength(1);

    const b = new CallSignalTransport({ backend: relay, relayUrl });
    const received: Uint8Array[] = [];
    b.listen(token, (f) => received.push(f));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(frame);
    a.destroy();
    b.destroy();
  });

  it('sendFrame is false when the relay is honestly absent (no fake delivery)', async () => {
    const relay = new FakeRelay();
    const transport = new CallSignalTransport({ backend: relay, relayUrl: () => null });
    const sent = await transport.sendFrame('a'.repeat(64), new Uint8Array([1]));
    expect(sent).toBe(false);
    expect(relay.connectCount).toBe(0);
    transport.destroy();
  });

  it('sendFrame is false when the connection fails', async () => {
    const relay = new FakeRelay();
    relay.failNextConnects = 1;
    const transport = new CallSignalTransport({ backend: relay, relayUrl });
    expect(await transport.sendFrame('a'.repeat(64), new Uint8Array([1]))).toBe(false);
    transport.destroy();
  });

  it('reports listener status from real events and reconnects after a drop', async () => {
    vi.useFakeTimers();
    try {
      const relay = new FakeRelay();
      const transport = new CallSignalTransport({
        backend: relay,
        relayUrl,
        reconnectDelaysMs: [10],
      });
      const token = deriveCallInviteToken(PAIR_SECRET);
      const statuses: string[] = [];
      transport.listen(token, () => undefined, (s) => statuses.push(s));
      await vi.runOnlyPendingTimersAsync();
      expect(statuses).toEqual(['connecting', 'listening']);
      expect(transport.isListening(token)).toBe(true);

      // Server-side drop: the listener honestly reports unavailable, then
      // reconnects on the bounded schedule.
      const session = [...relay.sessions.get(token)!][0]!;
      session.drop();
      expect(statuses).toContain('unavailable');
      expect(transport.isListening(token)).toBe(false);

      await vi.advanceTimersByTimeAsync(20);
      expect(statuses[statuses.length - 1]).toBe('listening');
      expect(transport.isListening(token)).toBe(true);
      transport.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries while the relay is unavailable and stops cleanly', async () => {
    vi.useFakeTimers();
    try {
      const relay = new FakeRelay();
      let url: string | null = null;
      const transport = new CallSignalTransport({
        backend: relay,
        relayUrl: () => url,
        reconnectDelaysMs: [10, 10],
      });
      const statuses: string[] = [];
      const handle = transport.listen('b'.repeat(64), () => undefined, (s) => statuses.push(s));
      await vi.runOnlyPendingTimersAsync();
      expect(handle.status()).toBe('unavailable');
      expect(relay.connectCount).toBe(0);

      // The relay appears (health gate passes): the next retry connects.
      url = 'wss://relay.test';
      await vi.advanceTimersByTimeAsync(20);
      expect(handle.status()).toBe('listening');

      handle.stop();
      expect(handle.status()).toBe('stopped');
      // A stopped listener never reconnects.
      await vi.advanceTimersByTimeAsync(100);
      expect(transport.isListening('b'.repeat(64))).toBe(false);
      transport.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses the open listener session to send on the same token', async () => {
    const relay = new FakeRelay();
    const transport = new CallSignalTransport({ backend: relay, relayUrl });
    const token = deriveCallSignalToken(PAIR_SECRET, 'call-reuse');
    transport.listen(token, () => undefined);
    await flush();
    const before = relay.connectCount;
    expect(await transport.sendFrame(token, new Uint8Array([7]))).toBe(true);
    expect(relay.connectCount).toBe(before);
    transport.destroy();
  });

  it('destroy closes every listener and blocks further sends', async () => {
    const relay = new FakeRelay();
    const transport = new CallSignalTransport({ backend: relay, relayUrl });
    const token = deriveCallInviteToken(PAIR_SECRET);
    transport.listen(token, () => undefined);
    await flush();
    transport.destroy();
    expect(transport.isListening(token)).toBe(false);
    expect(await transport.sendFrame(token, new Uint8Array([1]))).toBe(false);
  });
});
