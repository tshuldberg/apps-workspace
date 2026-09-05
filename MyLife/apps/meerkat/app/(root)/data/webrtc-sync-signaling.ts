import {
  CallSignalTransport,
  bytesToHex,
  createWebRTCSyncSignal,
  decryptWebRTCSyncPayload,
  deriveWebRTCSyncInviteListenTokens,
  deriveWebRTCSyncInviteToken,
  deriveWebRTCSyncSessionToken,
  encryptWebRTCSyncPayload,
  generateSessionKey,
  hexToBytes,
  msUntilNextDayBucket,
  openWebRTCSyncSignalFrame,
  relayTokenDayBucket,
  sealWebRTCSyncSignalFrame,
  verifyWebRTCSyncSignal,
  type DeviceIdentity,
  type NativeWebRTCOffer,
  type NativeWebRTCSignaling,
  type PairedDevice,
  type WebRTCSyncSignal,
  type WebRTCSyncSignalKind,
} from '@mylife/sync';

type WebRTCSignalingFn = NonNullable<ReturnType<NativeWebRTCSignaling['createSignaling']>>;

interface SignalingPeer {
  peer: PairedDevice;
  sharedSecretHex: string;
}

export interface WebRTCSyncSignalingDeps {
  /** This device's identity: signs every outbound signal (Ed25519). */
  identity: DeviceIdentity;
  transport: CallSignalTransport;
  listPeers: () => SignalingPeer[];
  resolvePeer: (deviceId: string) => SignalingPeer | null;
  /**
   * DB-persisted replay floor (call_signal_nonces): a captured signal cannot
   * replay across an app relaunch. Read-only check + explicit record, exactly
   * like the call path.
   */
  hasSeenNonce: (nonce: string) => boolean;
  recordNonce: (nonce: string, expiresAtMs: number) => void;
  /** Opportunistic expiry prune for the nonce table. */
  pruneNonces?: (nowMs: number) => void;
  now?: () => number;
  randomHex?: (bytes: number) => string;
}

interface SessionChannel {
  token: string;
  stop: () => void;
  handlers: Set<(data: string) => void>;
  buffered: string[];
  idleTimer?: ReturnType<typeof setTimeout>;
}

interface InviteListenerSet {
  /** The UTC day bucket the tokens were derived for. */
  bucket: number;
  stops: (() => void)[];
}

const SIGNAL_TTL_MS = 30_000;
/** Margin past a signal's own expiry before its nonce row may be pruned. */
const NONCE_RETENTION_MARGIN_MS = 60_000;
// A relay listener is opened per in-flight session. Bound the live set and tear
// down a channel that never attaches a message handler, so an inbound-offer flood
// cannot accumulate unbounded WebSockets + ICE timers.
const MAX_SESSION_CHANNELS = 64;
// Invite listeners cost TWO sockets per peer (current + previous day bucket).
// Cap how many peers hold open invite listeners so a large paired-device roster
// cannot exhaust the relay's per-client connection budget (64 by default) before
// any session channel opens; most-recently-seen peers win the slots, and a peer
// beyond the cap can still be dialed outbound or reached over the relay rung.
const MAX_INVITE_PEERS = 12;
const CHANNEL_IDLE_MS = 2 * SIGNAL_TTL_MS;
const HEX_64 = /^[0-9a-f]{64}$/u;

const encoder = new TextEncoder();

function signalingKind(data: string): WebRTCSyncSignalKind | null {
  try {
    const parsed = JSON.parse(data) as { type?: unknown };
    if (parsed.type === 'offer') return 'offer';
    if (parsed.type === 'answer') return 'answer';
    if (parsed.type === 'ice-candidate') return 'ice';
    return null;
  } catch {
    return null;
  }
}

function signalExpiryMs(signal: WebRTCSyncSignal, nowMs: number): number {
  const parsed = Date.parse(signal.expiresAt);
  return (Number.isFinite(parsed) ? parsed : nowMs + SIGNAL_TTL_MS) + NONCE_RETENTION_MARGIN_MS;
}

/**
 * Pair-authenticated WebRTC SDP/ICE exchange over the existing opaque relay,
 * on the SHARED @mylife/sync signed-signal machinery (2026-08-25): every frame
 * is an Ed25519-SIGNED WebRTCSyncSignal (domain-separated from call signals)
 * whose SDP/ICE payload is pair-encrypted, sealed inside a pair-derived frame,
 * with a DB-persisted replay floor. The relay sees only tokens, ciphertext
 * sizes, and timing -- and the per-pair INVITE token now rotates daily
 * (day-bucketed), so the relay cannot track a static pair pseudonym across
 * days; listeners hold the current + previous bucket and re-derive at the UTC
 * boundary.
 */
export class WebRTCSyncSignaling implements NativeWebRTCSignaling {
  private readonly now: () => number;
  private readonly randomHex: (bytes: number) => string;
  private readonly inviteListeners = new Map<string, InviteListenerSet>();
  private readonly channels = new Map<string, SessionChannel>();
  private dayRollTimer: ReturnType<typeof setTimeout> | null = null;
  private offerHandler: ((offer: NativeWebRTCOffer) => void) | null = null;
  private destroyed = false;

  constructor(private readonly deps: WebRTCSyncSignalingDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.randomHex = deps.randomHex ?? ((bytes) => bytesToHex(generateSessionKey().slice(0, bytes)));
  }

  isAvailable(): boolean {
    return !this.destroyed;
  }

  listenForOffers(handler: (offer: NativeWebRTCOffer) => void): () => void {
    if (this.destroyed) return () => undefined;
    this.offerHandler = handler;
    this.refreshPeerListeners();
    return () => {
      if (this.offerHandler === handler) this.offerHandler = null;
      this.stopInviteListeners();
    };
  }

  refreshPeerListeners(): void {
    if (this.destroyed || !this.offerHandler) return;
    const nowMs = this.now();
    const bucket = relayTokenDayBucket(nowMs);
    this.armDayRollTimer(nowMs);
    const activeIds = new Set<string>();
    const rankedPeers = [...this.deps.listPeers()]
      .sort((a, b) => {
        const aSeen = a.peer.lastSeenAt ? Date.parse(a.peer.lastSeenAt) : 0;
        const bSeen = b.peer.lastSeenAt ? Date.parse(b.peer.lastSeenAt) : 0;
        return (Number.isFinite(bSeen) ? bSeen : 0) - (Number.isFinite(aSeen) ? aSeen : 0);
      })
      .slice(0, MAX_INVITE_PEERS);
    for (const resolved of rankedPeers) {
      const peerId = resolved.peer.deviceId;
      activeIds.add(peerId);
      const existing = this.inviteListeners.get(peerId);
      if (existing && existing.bucket === bucket) continue;
      if (existing) {
        for (const stop of existing.stops) stop();
        this.inviteListeners.delete(peerId);
      }
      const stops = deriveWebRTCSyncInviteListenTokens(resolved.sharedSecretHex, nowMs)
        .map((token) => this.deps.transport.listen(token, (frame) => {
          this.handleInviteFrame(peerId, resolved.sharedSecretHex, frame);
        }).stop);
      this.inviteListeners.set(peerId, { bucket, stops });
    }
    for (const [peerId, entry] of this.inviteListeners) {
      if (activeIds.has(peerId)) continue;
      for (const stop of entry.stops) stop();
      this.inviteListeners.delete(peerId);
    }
  }

  createSignaling(peerDeviceId: string): WebRTCSignalingFn | null {
    if (this.destroyed) return null;
    const resolved = this.deps.resolvePeer(peerDeviceId);
    if (!resolved) return null;
    const sessionId = this.randomHex(32);
    if (!HEX_64.test(sessionId)) return null;
    return this.createSessionSignaling(peerDeviceId, resolved.sharedSecretHex, sessionId);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.offerHandler = null;
    this.stopInviteListeners();
    if (this.dayRollTimer) {
      clearTimeout(this.dayRollTimer);
      this.dayRollTimer = null;
    }
    for (const channel of this.channels.values()) {
      if (channel.idleTimer) clearTimeout(channel.idleTimer);
      channel.stop();
    }
    this.channels.clear();
    this.deps.transport.destroy();
  }

  /**
   * Re-derive invite listeners just after each UTC day boundary. The callback
   * acts only when the bucket really rolled and never re-arms on an early
   * fire, so fake test timers cannot recurse; refreshPeerListeners re-arms.
   */
  private armDayRollTimer(armedAtMs: number): void {
    if (this.destroyed || this.dayRollTimer !== null) return;
    this.dayRollTimer = setTimeout(() => {
      this.dayRollTimer = null;
      if (this.destroyed) return;
      if (relayTokenDayBucket(this.now()) !== relayTokenDayBucket(armedAtMs)) {
        this.refreshPeerListeners();
      }
    }, msUntilNextDayBucket(armedAtMs) + 1_000);
  }

  /** Stop a session channel's relay listener, cancel its idle timer, and drop it. */
  private teardownChannel(channelKey: string): void {
    const channel = this.channels.get(channelKey);
    if (!channel) return;
    if (channel.idleTimer) clearTimeout(channel.idleTimer);
    channel.stop();
    this.channels.delete(channelKey);
  }

  private stopInviteListeners(): void {
    for (const entry of this.inviteListeners.values()) {
      for (const stop of entry.stops) stop();
    }
    this.inviteListeners.clear();
  }

  private handleInviteFrame(peerDeviceId: string, pairSecretHex: string, frame: Uint8Array): void {
    const opened = this.openVerifiedSignal(peerDeviceId, pairSecretHex, frame);
    if (!opened || opened.signal.kind !== 'offer') return;
    // Validate the inner offer BEFORE opening a session channel. A verified
    // envelope can still carry a non-offer / malformed payload; creating the
    // relay listener first (and only bailing after) leaked one WebSocket per
    // bad frame, which a paired-but-hostile peer could drive without bound.
    let parsed: { type?: unknown; sdp?: unknown };
    try {
      parsed = JSON.parse(opened.payload) as typeof parsed;
    } catch {
      return;
    }
    if (parsed.type !== 'offer' || typeof parsed.sdp !== 'string' || parsed.sdp.length === 0) return;
    const signaling = this.createSessionSignaling(peerDeviceId, pairSecretHex, opened.signal.callId);
    this.offerHandler?.({ peerDeviceId, offerSdp: parsed.sdp, signaling });
  }

  private createSessionSignaling(
    peerDeviceId: string,
    pairSecretHex: string,
    sessionId: string,
  ): WebRTCSignalingFn {
    const channelKey = `${peerDeviceId}:${sessionId}`;
    let channel = this.channels.get(channelKey);
    if (!channel) {
      // Bound the live channel set: evict the oldest idle channel (insertion order)
      // before opening another, so a flood of distinct-session offers cannot pin
      // unbounded relay listeners.
      while (this.channels.size >= MAX_SESSION_CHANNELS) {
        const oldestKey = this.channels.keys().next().value as string | undefined;
        if (!oldestKey) break;
        this.teardownChannel(oldestKey);
      }
      const token = deriveWebRTCSyncSessionToken(pairSecretHex, sessionId);
      const handlers = new Set<(data: string) => void>();
      const buffered: string[] = [];
      const handle = this.deps.transport.listen(token, (frame) => {
        const opened = this.openVerifiedSignal(peerDeviceId, pairSecretHex, frame);
        if (!opened || opened.signal.callId !== sessionId || opened.signal.kind === 'offer') return;
        if (handlers.size === 0) {
          if (buffered.length < 64) buffered.push(opened.payload);
          return;
        }
        for (const handler of handlers) handler(opened.payload);
      });
      channel = { token, stop: handle.stop, handlers, buffered };
      // Arm an idle teardown: if no message handler attaches (e.g. acceptConnection
      // threw before onMessage, or the offer never becomes a live session), the
      // listener is reclaimed instead of leaking.
      channel.idleTimer = setTimeout(() => {
        const live = this.channels.get(channelKey);
        if (live && live.handlers.size === 0) this.teardownChannel(channelKey);
      }, CHANNEL_IDLE_MS);
      this.channels.set(channelKey, channel);
    }

    return {
      send: async (data: string) => {
        const kind = signalingKind(data);
        if (!kind) throw new Error('Invalid WebRTC signaling message.');
        const nowMs = this.now();
        const pairSecretBytes = hexToBytes(pairSecretHex);
        const created = createWebRTCSyncSignal({
          sender: this.deps.identity,
          sessionId,
          kind,
          toDeviceId: peerDeviceId,
          payloadCiphertext: encryptWebRTCSyncPayload(pairSecretBytes, sessionId, data),
          nowMs,
          ttlMs: SIGNAL_TTL_MS,
        });
        if (!created.ok) throw new Error(`WebRTC signaling build failed: ${created.reason}.`);
        const token = kind === 'offer'
          ? deriveWebRTCSyncInviteToken(pairSecretHex, nowMs)
          : channel!.token;
        const frame = sealWebRTCSyncSignalFrame(pairSecretBytes, created.signal);
        const sent = await this.deps.transport.sendFrame(token, frame);
        if (!sent) throw new Error('WebRTC signaling relay unavailable.');
      },
      onMessage: (handler: (data: string) => void) => {
        // A real consumer attached: cancel the idle-reclaim timer.
        if (channel!.idleTimer) {
          clearTimeout(channel!.idleTimer);
          channel!.idleTimer = undefined;
        }
        channel!.handlers.add(handler);
        for (const data of channel!.buffered.splice(0)) handler(data);
        return () => {
          channel!.handlers.delete(handler);
          if (channel!.handlers.size > 0) return;
          this.teardownChannel(channelKey);
        };
      },
    };
  }

  /**
   * Open a sealed frame, verify it as a signed sync signal from exactly this
   * peer to exactly this device (Ed25519 under the sync domain, strict fields,
   * TTL + skew, DB replay floor), record the nonce, and decrypt the payload.
   * Any failure is a silent fail-closed drop.
   */
  private openVerifiedSignal(
    peerDeviceId: string,
    pairSecretHex: string,
    frame: Uint8Array,
  ): { signal: WebRTCSyncSignal; payload: string } | null {
    const nowMs = this.now();
    const pairSecretBytes = hexToBytes(pairSecretHex);
    const raw = openWebRTCSyncSignalFrame(pairSecretBytes, frame);
    if (raw === null) return null;
    const verified = verifyWebRTCSyncSignal(raw, {
      senderPublicKey: peerDeviceId,
      expectedRecipientDeviceId: this.deps.identity.publicKey,
      nowMs,
      hasSeenNonce: this.deps.hasSeenNonce,
    });
    if (!verified.ok) return null;
    const signal = verified.signal;
    if (!HEX_64.test(signal.callId)) return null;
    // Record BEFORE dispatch so a duplicate delivered mid-handling cannot race
    // past the floor; each outbound signal carries a fresh random nonce, so
    // recording never suppresses a legitimate retransmit.
    try {
      this.deps.recordNonce(signal.nonce, signalExpiryMs(signal, nowMs));
    } catch {
      // A replay floor that cannot persist must not admit the frame.
      return null;
    }
    try {
      this.deps.pruneNonces?.(nowMs);
    } catch {
      // Pruning is best-effort hygiene.
    }
    if (signal.payloadCiphertext === undefined) return null;
    const payload = decryptWebRTCSyncPayload<unknown>(
      pairSecretBytes,
      signal.callId,
      signal.payloadCiphertext,
    );
    if (typeof payload !== 'string' || encoder.encode(payload).length === 0) return null;
    return { signal, payload };
  }
}
