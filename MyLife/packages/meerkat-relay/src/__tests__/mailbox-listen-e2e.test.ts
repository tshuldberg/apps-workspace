/**
 * Live-wake e2e: the real MailboxListenEngine holding a real WebSocket open to
 * the real relay server, receiving a real sealed channel-message envelope the
 * moment a sender parks it (no polling), catching up on envelopes parked while
 * it was away, and reconnecting through a full server restart. In-memory-only
 * proofs have historically hidden dead transports; this is the live proof.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  createChannelMessage,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  MailboxListenEngine,
  sealChannelMessageMailboxDelta,
  WebSocketRelayBackend,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

const PAIR_SECRET = 'cd'.repeat(32);

let server: RelayServer | null = null;
const backends: WebSocketRelayBackend[] = [];
let engine: MailboxListenEngine | null = null;

afterEach(async () => {
  engine?.stop();
  engine = null;
  for (const backend of backends.splice(0)) backend.destroy();
  if (server) {
    await server.close();
    server = null;
  }
});

function makeBackend(): WebSocketRelayBackend {
  const backend = new WebSocketRelayBackend();
  backends.push(backend);
  return backend;
}

function sealFor(
  sender: ReturnType<typeof generateDeviceIdentity>,
  recipient: ReturnType<typeof generateDeviceIdentity>,
  body: string,
): { token: string; bytes: Uint8Array } {
  const event = createChannelMessage(sender, {
    communityId: 'cm_live_wake',
    channelId: 'general',
    body,
    hlc: { wall: '2026-08-01T00:00:01.000Z', counter: 0 },
  });
  const sealed = sealChannelMessageMailboxDelta({
    sender,
    recipient: { deviceId: recipient.publicKey, dhPublicKey: recipient.dhPublicKey },
    pairSharedSecretHex: PAIR_SECRET,
    communityId: 'cm_live_wake',
    channelId: 'general',
    events: [event],
  });
  if (!sealed.ok) throw new Error('seal failed');
  return { token: sealed.token, bytes: encodeMailboxEnvelope(sealed.envelope) };
}

async function waitFor(check: () => boolean, timeoutMs = 8_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function makeStore(): { stored: ChannelMessageEvent[]; handlers: { channelMessage: (events: ChannelMessageEvent[]) => { inserted: number; skipped: number; invalid: number } } } {
  const stored: ChannelMessageEvent[] = [];
  return {
    stored,
    handlers: {
      channelMessage: (events: ChannelMessageEvent[]) => {
        let inserted = 0;
        for (const e of events) {
          if (stored.some((s) => s.id === e.id)) continue;
          stored.push(e);
          inserted += 1;
        }
        return { inserted, skipped: events.length - inserted, invalid: 0 };
      },
    },
  };
}

describe('mailbox listen live e2e (real relay, real WebSocket)', () => {
  it('delivers a parked envelope to the live listener with no polling', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const { stored, handlers } = makeStore();

    engine = new MailboxListenEngine({
      identity: me,
      backend: makeBackend(),
      relayUrl: () => url,
      peers: () => [{ deviceId: sender.publicKey, pairSharedSecretHex: PAIR_SECRET, revoked: false, isActive: true }],
      handlers,
    });
    engine.start();
    await waitFor(() => engine!.status() === 'listening');

    const { token, bytes } = sealFor(sender, me, 'live over the wire');
    const senderSession = await makeBackend().connect(url, token);
    await senderSession.send(bytes);

    await waitFor(() => stored.length === 1);
    expect(stored[0]!.body).toBe('live over the wire');
    expect(engine.counts().applied).toBe(1);
    await senderSession.close();
  });

  it('catches up on an envelope parked while it was away, on the same path', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const { stored, handlers } = makeStore();

    const { token, bytes } = sealFor(sender, me, 'parked while away');
    const senderSession = await makeBackend().connect(url, token);
    await senderSession.send(bytes);
    await senderSession.close();

    engine = new MailboxListenEngine({
      identity: me,
      backend: makeBackend(),
      relayUrl: () => url,
      peers: () => [{ deviceId: sender.publicKey, pairSharedSecretHex: PAIR_SECRET, revoked: false, isActive: true }],
      handlers,
    });
    engine.start();

    await waitFor(() => stored.length === 1);
    expect(stored[0]!.body).toBe('parked while away');
  });

  it('reconnects through a full relay restart and receives what is parked after it', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const port = server.port;
    const url = `ws://127.0.0.1:${port}`;
    const sender = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const { stored, handlers } = makeStore();

    engine = new MailboxListenEngine({
      identity: me,
      backend: makeBackend(),
      relayUrl: () => url,
      peers: () => [{ deviceId: sender.publicKey, pairSharedSecretHex: PAIR_SECRET, revoked: false, isActive: true }],
      handlers,
      reconnectDelaysMs: [100, 200, 400],
    });
    engine.start();
    await waitFor(() => engine!.status() === 'listening');

    await server.close();
    server = await startRelayServer({ port, host: '127.0.0.1' });
    await waitFor(() => engine!.status() === 'listening');

    const { token, bytes } = sealFor(sender, me, 'after the restart');
    const senderSession = await makeBackend().connect(url, token);
    await senderSession.send(bytes);

    await waitFor(() => stored.length === 1);
    expect(stored[0]!.body).toBe('after the restart');
    await senderSession.close();
  });
});
