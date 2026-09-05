import { describe, expect, it } from 'vitest';
import {
  CallSignalTransport,
  createWebRTCSyncSignal,
  deriveWebRTCSyncInviteToken,
  encryptWebRTCSyncPayload,
  generateDeviceIdentity,
  hexToBytes,
  sealWebRTCSyncSignalFrame,
  type DeviceIdentity,
  type PairedDevice,
  type RelayBackend,
  type RelaySession,
} from '@mylife/sync';
import { WebRTCSyncSignaling, type WebRTCSyncSignalingDeps } from '../webrtc-sync-signaling';

class FakeRelaySession implements RelaySession {
  private readonly handlers: Array<(frame: Uint8Array) => void> = [];
  private readonly pending: Uint8Array[] = [];
  closed = false;

  constructor(private readonly relay: FakeRelay, readonly token: string) {}

  async send(frame: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('closed');
    this.relay.forward(this, frame);
  }

  onMessage(handler: (frame: Uint8Array) => void): void {
    this.handlers.push(handler);
    for (const frame of this.pending.splice(0)) handler(frame);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.relay.leave(this);
  }

  deliver(frame: Uint8Array): void {
    if (this.handlers.length === 0) this.pending.push(frame);
    else for (const handler of this.handlers) handler(frame);
  }
}

class FakeRelay implements RelayBackend {
  readonly sessions = new Map<string, Set<FakeRelaySession>>();
  readonly mailbox = new Map<string, Uint8Array[]>();
  readonly frames: Uint8Array[] = [];

  async connect(_url: string, token: string): Promise<RelaySession> {
    const session = new FakeRelaySession(this, token);
    const group = this.sessions.get(token) ?? new Set<FakeRelaySession>();
    group.add(session);
    this.sessions.set(token, group);
    const queued = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    queueMicrotask(() => {
      for (const frame of queued) session.deliver(frame);
    });
    return session;
  }

  forward(from: FakeRelaySession, frame: Uint8Array): void {
    this.frames.push(new Uint8Array(frame));
    const recipients = [...(this.sessions.get(from.token) ?? [])]
      .filter((session) => session !== from && !session.closed);
    if (recipients.length === 0) {
      const queued = this.mailbox.get(from.token) ?? [];
      queued.push(new Uint8Array(frame));
      this.mailbox.set(from.token, queued);
      return;
    }
    for (const recipient of recipients) recipient.deliver(new Uint8Array(frame));
  }

  leave(session: FakeRelaySession): void {
    this.sessions.get(session.token)?.delete(session);
  }

  destroy(): void {}
}

const idA = generateDeviceIdentity('A');
const idB = generateDeviceIdentity('B');
const SECRET = 'cc'.repeat(32);
const NOW = 1_800_000_000_000;
const DAY_MS = 86_400_000;

function peer(identity: DeviceIdentity): PairedDevice {
  return {
    deviceId: identity.publicKey,
    displayName: identity.publicKey === idA.publicKey ? 'A' : 'B',
    dhPublicKey: identity.dhPublicKey,
    sharedSecretRef: `secret:${identity.publicKey}`,
    lastSeenAt: null,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: new Date(NOW).toISOString(),
  };
}

function counterHex(): (bytes: number) => string {
  let counter = 0;
  return (bytes) => (++counter).toString(16).padStart(bytes * 2, '0').slice(-bytes * 2);
}

/** A shared, DB-shaped replay floor: survives a manager "restart" in tests. */
function nonceStore(): Pick<WebRTCSyncSignalingDeps, 'hasSeenNonce' | 'recordNonce' | 'pruneNonces'> {
  const seen = new Map<string, number>();
  return {
    hasSeenNonce: (nonce) => seen.has(nonce),
    recordNonce: (nonce, expiresAtMs) => {
      seen.set(nonce, expiresAtMs);
    },
    pruneNonces: (nowMs) => {
      for (const [nonce, expiresAtMs] of seen) {
        if (expiresAtMs <= nowMs) seen.delete(nonce);
      }
    },
  };
}

function manager(
  relay: FakeRelay,
  local: DeviceIdentity,
  remote: DeviceIdentity,
  overrides: Partial<WebRTCSyncSignalingDeps> = {},
): WebRTCSyncSignaling {
  const resolved = { peer: peer(remote), sharedSecretHex: SECRET };
  return new WebRTCSyncSignaling({
    identity: local,
    transport: new CallSignalTransport({ backend: relay, relayUrl: () => 'wss://relay.test' }),
    listPeers: () => [resolved],
    resolvePeer: (deviceId) => deviceId === remote.publicKey ? resolved : null,
    now: () => NOW,
    randomHex: counterHex(),
    ...nonceStore(),
    ...overrides,
  });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

describe('WebRTCSyncSignaling', () => {
  it('exchanges a signed sealed offer, answer, and ICE candidate over pair-private channels', async () => {
    const relay = new FakeRelay();
    const a = manager(relay, idA, idB);
    const b = manager(relay, idB, idA);
    const receivedByA: string[] = [];
    const receivedByB: string[] = [];

    b.listenForOffers((offer) => {
      expect(offer.peerDeviceId).toBe(idA.publicKey);
      expect(offer.offerSdp).toBe('private-offer-sdp');
      offer.signaling.onMessage((data) => receivedByB.push(data));
      void offer.signaling.send(JSON.stringify({ type: 'answer', sdp: 'private-answer-sdp' }));
    });
    await flush();

    const outbound = a.createSignaling(idB.publicKey);
    expect(outbound).not.toBeNull();
    outbound!.onMessage((data) => receivedByA.push(data));
    await outbound!.send(JSON.stringify({ type: 'offer', sdp: 'private-offer-sdp' }));
    await flush();
    await outbound!.send(JSON.stringify({ type: 'ice-candidate', candidate: 'candidate-a' }));
    await flush();

    expect(receivedByA).toContain(JSON.stringify({ type: 'answer', sdp: 'private-answer-sdp' }));
    expect(receivedByB).toContain(JSON.stringify({ type: 'ice-candidate', candidate: 'candidate-a' }));
    expect(relay.sessions.size).toBeGreaterThanOrEqual(2);

    const wireText = relay.frames.map((frame) => new TextDecoder().decode(frame)).join('\n');
    expect(wireText).not.toContain(idA.publicKey);
    expect(wireText).not.toContain(idB.publicKey);
    expect(wireText).not.toContain('private-offer-sdp');
    expect(wireText).not.toContain('answer');
    a.destroy();
    b.destroy();
  });

  it('does not offer a signaling channel for an unpaired device', () => {
    const relay = new FakeRelay();
    const signaling = manager(relay, idA, idB);
    expect(signaling.createSignaling('ee'.repeat(32))).toBeNull();
    signaling.destroy();
  });

  it('replay floor persists across a manager restart: a captured offer cannot re-ring', async () => {
    const relay = new FakeRelay();
    const store = nonceStore();
    const a = manager(relay, idA, idB);
    const b1 = manager(relay, idB, idA, store);
    let offers = 0;

    b1.listenForOffers(() => {
      offers += 1;
    });
    await flush();
    const outbound = a.createSignaling(idB.publicKey);
    await outbound!.send(JSON.stringify({ type: 'offer', sdp: 'replayable-sdp' }));
    await flush();
    expect(offers).toBe(1);
    const captured = relay.frames[0]!;
    b1.destroy();

    // "Relaunch": a fresh manager over the SAME persisted nonce store. The
    // attacker replays the captured frame inside its 30s TTL.
    const b2 = manager(relay, idB, idA, store);
    b2.listenForOffers(() => {
      offers += 1;
    });
    await flush();
    const inviteToken = deriveWebRTCSyncInviteToken(SECRET, NOW);
    const attacker = await relay.connect('wss://relay.test', inviteToken);
    await attacker.send(captured);
    await flush();
    expect(offers).toBe(1);
    a.destroy();
    b2.destroy();
  });

  it('drops a signal signed by a non-paired identity even inside a valid pair frame', async () => {
    const relay = new FakeRelay();
    const mallory = generateDeviceIdentity('Mallory');
    const b = manager(relay, idB, idA);
    let offers = 0;
    b.listenForOffers(() => {
      offers += 1;
    });
    await flush();

    // Mallory somehow knows the pair secret's frame key but signs with her own
    // identity: the Ed25519 sender binding must reject the signal.
    const sessionId = 'ab'.repeat(32);
    const created = createWebRTCSyncSignal({
      sender: mallory,
      sessionId,
      kind: 'offer',
      toDeviceId: idB.publicKey,
      payloadCiphertext: encryptWebRTCSyncPayload(
        hexToBytes(SECRET),
        sessionId,
        JSON.stringify({ type: 'offer', sdp: 'forged' }),
      ),
      nowMs: NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const frame = sealWebRTCSyncSignalFrame(hexToBytes(SECRET), created.signal);
    const attacker = await relay.connect('wss://relay.test', deriveWebRTCSyncInviteToken(SECRET, NOW));
    await attacker.send(frame);
    await flush();
    expect(offers).toBe(0);
    b.destroy();
  });

  it('caps invite listeners to the most-recently-seen peers (relay socket budget)', async () => {
    const relay = new FakeRelay();
    const peers = Array.from({ length: 15 }, (_, i) => {
      const identity = generateDeviceIdentity(`P${i}`);
      const secret = (i % 2 ? 'a' : 'b') + i.toString(16).padStart(1, '0');
      return {
        peer: {
          ...peer(identity),
          deviceId: identity.publicKey,
          // Peer 0 is the most recently seen; peer 14 the stalest.
          lastSeenAt: new Date(NOW - i * 60_000).toISOString(),
        },
        sharedSecretHex: secret.repeat(32).slice(0, 64),
      };
    });
    const signaling = new WebRTCSyncSignaling({
      identity: idB,
      transport: new CallSignalTransport({ backend: relay, relayUrl: () => 'wss://relay.test' }),
      listPeers: () => peers,
      resolvePeer: () => null,
      now: () => NOW,
      randomHex: counterHex(),
      ...nonceStore(),
    });
    signaling.listenForOffers(() => undefined);
    await flush();
    // 12 peers x 2 bucket tokens; the 3 stalest peers hold no listener.
    expect(relay.sessions.size).toBe(24);
    expect(relay.sessions.has(deriveWebRTCSyncInviteToken(peers[0]!.sharedSecretHex, NOW))).toBe(true);
    expect(relay.sessions.has(deriveWebRTCSyncInviteToken(peers[14]!.sharedSecretHex, NOW))).toBe(false);
    signaling.destroy();
  });

  it('re-derives invite listeners when the UTC day bucket rolls', async () => {
    const relay = new FakeRelay();
    let nowMs = NOW;
    const b = manager(relay, idB, idA, { now: () => nowMs });
    b.listenForOffers(() => undefined);
    await flush();
    expect(relay.sessions.has(deriveWebRTCSyncInviteToken(SECRET, NOW))).toBe(true);

    nowMs = NOW + DAY_MS;
    b.refreshPeerListeners();
    await flush();
    // The new current bucket is held, and yesterday's token stays in the
    // two-bucket window for the boundary race.
    const today = relay.sessions.get(deriveWebRTCSyncInviteToken(SECRET, nowMs));
    const yesterday = relay.sessions.get(deriveWebRTCSyncInviteToken(SECRET, NOW));
    expect([...(today ?? [])].some((s) => !s.closed)).toBe(true);
    expect([...(yesterday ?? [])].some((s) => !s.closed)).toBe(true);
    b.destroy();
  });
});
