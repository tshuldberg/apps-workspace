// Plan 25 WP-25H: the live web direct-call coordinator (twin of
// apps/meerkat/app/(root)/providers/CallProvider.tsx, minus the native
// CallKit/Telecom bridge which is mobile-only).
//
// UNVERIFIED - pending live browser QA for the media surface. Wires the tested
// cores together and adds NO state logic of its own:
//   - CallSession (@mylife/sync, WP-25D) owns every phase transition; NC-25.1
//     'connected' comes only from a real RTCPeerConnection event through
//     call-media-backend, never a timer here.
//   - CallSignalTransport (@mylife/sync, WP-25G) parks/drains sealed WP-25B
//     frames over the live relay by pair-private tokens; the relay is an
//     opaque carrier and this provider dials only through effectiveRelayUrl.
//   - Every inbound frame passes peekInboundCallSignal (openCallSignalFrame +
//     verifyCallSignal, NC-25.2) before it can ring, and the session re-verifies
//     + records the nonce (persisted in call_signal_nonces) before advancing.
//   - Call history persists through foldCallLog into the device-local call_
//     tables only (NC-25.7).
//   - Web has no OS call surface: an incoming ring is IN-APP ONLY. There is no
//     native module; capability.mediaAvailable is the sole gate (NC-25.8): when
//     the browser cannot place a call, no call action is enabled.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CallSession,
  CallSignalTransport,
  WebSocketRelayBackend,
  bytesToHex,
  deriveCallInviteToken,
  deriveCallSignalToken,
  getPairedDevice,
  getSharedSecretHex,
  hexToBytes,
  isDeviceRevoked,
  sealCallSignalFrame,
  createCallSignal,
  type CallMediaBackend,
  type CallMediaPeerSession,
  type CallSignal,
  type CallState,
  type OutboundCallSignal,
} from '@mylife/sync';
import { useMeerkat } from './MeerkatProvider';
import { effectiveRelayUrl, ensureEffectiveRelayUrl } from './effective-relay';
import { loadCallMediaBackend } from './call-media-backend';
import { foldCallLog, type CallLogRow } from './call-log-core';
import {
  clearCallActive,
  ensureCallTables,
  hasSeenCallNonce,
  pruneCallNonces,
  recordCallNonce,
  recordCallReport,
  upsertCallActive,
  upsertCallLogRow,
} from './call-store';
import {
  makeCallId,
  peekInboundCallSignal,
  planOutboundCallSignalTokens,
  shouldRingForInvite,
} from './call-provider-core';

export type StartCallFailure =
  | 'busy'
  | 'no_media_backend'
  | 'no_relay'
  | 'not_paired'
  | 'signal_failed';

export interface CallCapability {
  /** True only when the browser exposes a usable WebRTC media runtime. */
  mediaAvailable: boolean;
}

/** A media session that also exposes the real local/remote MediaStreams for <video>. */
type StreamingSession = CallMediaPeerSession & {
  localStream?: () => MediaStream | null;
  remoteStream?: () => MediaStream | null;
};

interface CallContextValue {
  capability: CallCapability;
  /** The live call's honest state, or null when no call exists. */
  activeCall: CallState | null;
  startCall: (
    peerDeviceId: string,
    media: 'voice' | 'video',
  ) => Promise<{ ok: true } | { ok: false; reason: StartCallFailure }>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  hangupCall: () => Promise<void>;
  cancelCall: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  reportCallPeer: (reason: string) => void;
  /** The REAL local/remote MediaStreams for a <video> element; null until they exist. */
  getStreams: () => { local: MediaStream | null; remote: MediaStream | null };
  /** Bumps whenever a call_log row is written, so history lists re-read. */
  historyRevision: number;
  /** Whether calls can be offered to this peer right now (paired + media). */
  canCallPeer: (peerDeviceId: string) => boolean;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

const NONCE_RETENTION_MS = 10 * 60_000;
const TICK_INTERVAL_MS = 1_000;

interface LiveCall {
  session: CallSession;
  callId: string;
  peerDeviceId: string;
  pairSecretHex: string;
  direction: 'incoming' | 'outgoing';
  createdAtMs: number;
  logRow: CallLogRow | undefined;
  stopChannel: (() => void) | null;
  tickTimer: ReturnType<typeof setInterval> | null;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const m = useMeerkat();
  const { db, identity } = m;

  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);

  const liveRef = useRef<LiveCall | null>(null);
  const mediaSessionRef = useRef<StreamingSession | null>(null);

  // The real media backend, or null (no browser WebRTC): calls honestly off.
  const baseMediaBackend = useMemo(() => loadCallMediaBackend(), []);
  const mediaBackend = useMemo<CallMediaBackend | null>(() => {
    if (!baseMediaBackend) return null;
    return {
      async startPeerConnection(input) {
        const session = await baseMediaBackend.startPeerConnection(input);
        mediaSessionRef.current = session as StreamingSession;
        return session;
      },
    };
  }, [baseMediaBackend]);

  // The device-local call_ tables (NC-25.7). Ensured once per db.
  useEffect(() => {
    ensureCallTables(db);
    pruneCallNonces(db, Date.now());
  }, [db]);

  // A paired peer's shared secret, applying the same revocation + secret-store
  // checks the DM path uses (mirror of MeerkatProvider's private resolvePairedSecret).
  const resolvePairSecret = useCallback((deviceId: string): string | null => {
    if (isDeviceRevoked(db, deviceId)) return null;
    const peer = getPairedDevice(db, deviceId);
    if (!peer || !peer.isActive || !peer.dhPublicKey || !peer.sharedSecretRef) return null;
    return getSharedSecretHex(peer.sharedSecretRef) ?? null;
  }, [db]);

  // One transport for the provider's lifetime; every dial goes through the
  // health-gated effectiveRelayUrl choke point.
  const transport = useMemo(
    () => new CallSignalTransport({
      backend: new WebSocketRelayBackend(),
      relayUrl: () => effectiveRelayUrl(db),
    }),
    [db],
  );
  useEffect(() => () => transport.destroy(), [transport]);

  const persistState = useCallback((live: LiveCall, state: CallState) => {
    const nowMs = Date.now();
    live.logRow = foldCallLog(
      { callId: live.callId, createdAtMs: live.createdAtMs, direction: live.direction },
      state,
      nowMs,
      live.logRow,
    );
    upsertCallLogRow(db, live.logRow);
    setHistoryRevision((r) => r + 1);
    const terminal = live.logRow.outcome !== null;
    if (terminal) {
      clearCallActive(db, live.callId);
    } else if (state.phase !== 'idle') {
      upsertCallActive(db, {
        callId: live.callId,
        engine: 'direct',
        engineState: state.phase,
        iceState: state.iceState,
        localMicOn: state.localMicOn,
        localCamOn: state.localCamOn,
        securityMode: state.securityMode,
        updatedAtMs: nowMs,
      });
    }
    void db.flush?.();
  }, [db]);

  const teardownLive = useCallback((live: LiveCall) => {
    if (live.tickTimer) {
      clearInterval(live.tickTimer);
      live.tickTimer = null;
    }
    live.stopChannel?.();
    live.stopChannel = null;
    mediaSessionRef.current = null;
    if (liveRef.current === live) liveRef.current = null;
  }, []);

  // Tear the live call machinery down with the provider (page teardown): the
  // tick timer and channel listener must not outlive the React tree.
  useEffect(() => () => {
    const live = liveRef.current;
    if (live) teardownLive(live);
  }, [teardownLive]);

  // Build the sendSignal seam: seal the signed signal and send it on every
  // token the routing plan requires. Resolves only when at least one real
  // send succeeded; the session maps a rejection to signal_send_failed.
  const makeSendSignal = useCallback(
    (pairSecretHex: string) => async (outbound: OutboundCallSignal): Promise<void> => {
      const secretBytes = hexToBytes(pairSecretHex);
      const frame = sealCallSignalFrame(secretBytes, outbound.signal);
      const tokens = planOutboundCallSignalTokens(pairSecretHex, outbound);
      let sent = false;
      for (const token of tokens) {
        if (await transport.sendFrame(token, frame)) sent = true;
      }
      if (!sent) throw new Error('call signal send failed');
    },
    [transport],
  );

  const openCallChannel = useCallback((live: LiveCall) => {
    const callToken = deriveCallSignalToken(live.pairSecretHex, live.callId);
    const secretBytes = hexToBytes(live.pairSecretHex);
    const handle = transport.listen(callToken, (frame) => {
      const peeked = peekInboundCallSignal({
        pairSecretBytes: secretBytes,
        frame,
        peerDeviceId: live.peerDeviceId,
        selfDeviceId: identity.publicKey,
        nowMs: Date.now(),
        hasSeenNonce: (nonce) => hasSeenCallNonce(db, nonce),
      });
      if (!peeked.ok) return;
      void live.session.handleInboundSignal(peeked.raw);
    });
    live.stopChannel = handle.stop;
  }, [transport, identity.publicKey, db]);

  const attachSession = useCallback((live: LiveCall) => {
    liveRef.current = live;
    live.session.subscribe((state) => {
      if (state.callId !== live.callId) {
        // Glare adoption: the session replaced the losing call with the winning
        // incoming one. Move the per-call channel to the new call token and
        // restart the history fold for the new call id.
        live.callId = state.callId;
        live.direction = state.direction;
        live.createdAtMs = Date.now();
        live.logRow = undefined;
        live.stopChannel?.();
        openCallChannel(live);
      }
      setActiveCall({ ...state });
      persistState(live, state);
      const terminal = live.logRow?.outcome != null;
      if (terminal) {
        teardownLive(live);
      }
    });
    live.tickTimer = setInterval(() => {
      void live.session.tick();
    }, TICK_INTERVAL_MS);
  }, [persistState, teardownLive, openCallChannel]);

  const buildSession = useCallback((input: {
    callId: string;
    peerDeviceId: string;
    pairSecretHex: string;
    media: 'voice' | 'video';
    role: 'caller' | 'callee';
  }): CallSession | null => {
    if (!mediaBackend) return null;
    return new CallSession({
      identity,
      localDeviceId: identity.publicKey,
      remoteDeviceId: input.peerDeviceId,
      media: input.media,
      callId: input.callId,
      role: input.role,
      pairSecretHex: input.pairSecretHex,
      mediaBackend,
      sendSignal: makeSendSignal(input.pairSecretHex),
      now: () => Date.now(),
      createNonce: () => bytesToHex(randomBytes(24)),
      hasSeenNonce: (nonce) => hasSeenCallNonce(db, nonce),
      recordNonce: (nonce) => recordCallNonce(db, nonce, Date.now() + NONCE_RETENTION_MS),
    });
  }, [db, identity, mediaBackend, makeSendSignal]);

  // --- incoming invites: one listener per active trusted pairing ------------

  const handleInviteFrame = useCallback((peerDeviceId: string, pairSecretHex: string, frame: Uint8Array) => {
    const secretBytes = hexToBytes(pairSecretHex);
    const peeked = peekInboundCallSignal({
      pairSecretBytes: secretBytes,
      frame,
      peerDeviceId,
      selfDeviceId: identity.publicKey,
      nowMs: Date.now(),
      hasSeenNonce: (nonce) => hasSeenCallNonce(db, nonce),
    });
    if (!peeked.ok) return;
    const signal = peeked.signal;

    const live = liveRef.current;
    if (live && signal.fromDeviceId === live.peerDeviceId) {
      // Any signal from the live call's peer routes to the session: duplicates
      // are replay-dropped there, and a cross-invite with a different callId is
      // the GLARE case the session resolves deterministically (it may adopt the
      // winning incoming call, which re-points the per-call channel below).
      void live.session.handleInboundSignal(peeked.raw);
      return;
    }

    if (!shouldRingForInvite(signal, live !== null)) {
      if (signal.kind === 'invite' && live !== null) {
        // Busy (a second caller while another call is live): consume the nonce
        // and answer honestly on the per-call channel.
        recordCallNonce(db, signal.nonce, Date.now() + NONCE_RETENTION_MS);
        void respondBusy(pairSecretHex, signal);
      }
      return;
    }
    if (isDeviceRevoked(db, peerDeviceId)) return;
    if (!mediaBackend) {
      // No media runtime in this browser: never ring a call we cannot take.
      return;
    }

    const session = buildSession({
      callId: signal.callId,
      peerDeviceId,
      pairSecretHex,
      media: signal.media,
      role: 'callee',
    });
    if (!session) return;
    const newLive: LiveCall = {
      session,
      callId: signal.callId,
      peerDeviceId,
      pairSecretHex,
      direction: 'incoming',
      createdAtMs: Date.now(),
      logRow: undefined,
      stopChannel: null,
      tickTimer: null,
    };
    attachSession(newLive);
    openCallChannel(newLive);
    // The session verifies and records the invite nonce, then rings (NC-25.2).
    // Web has no OS call surface: the in-app ring is the active-call overlay.
    void session.handleInboundSignal(peeked.raw);

    async function respondBusy(secretHex: string, invite: CallSignal): Promise<void> {
      const built = createCallSignal({
        sender: identity,
        callId: invite.callId,
        kind: 'busy',
        toDeviceId: invite.fromDeviceId,
        media: invite.media,
        nowMs: Date.now(),
        nonce: bytesToHex(randomBytes(24)),
      });
      if (!built.ok) return;
      const busyFrame = sealCallSignalFrame(hexToBytes(secretHex), built.signal);
      await transport.sendFrame(deriveCallSignalToken(secretHex, invite.callId), busyFrame);
    }
  }, [db, identity, mediaBackend, buildSession, attachSession, openCallChannel, transport]);

  // Maintain one invite-channel listener per active, unrevoked pairing. Off a
  // configured relay the listeners honestly sit 'unavailable' and retry. Re-runs
  // on m.revision so a newly paired device gets a listener.
  useEffect(() => {
    if (!mediaBackend) return undefined;
    const stops: Array<() => void> = [];
    for (const device of m.pairedDevices()) {
      if (!device.isActive || isDeviceRevoked(db, device.deviceId)) continue;
      const pairSecretHex = resolvePairSecret(device.deviceId);
      if (!pairSecretHex || !/^[0-9a-f]{64}$/u.test(pairSecretHex)) continue;
      const token = deriveCallInviteToken(pairSecretHex);
      const handle = transport.listen(token, (frame) => {
        handleInviteFrame(device.deviceId, pairSecretHex, frame);
      });
      stops.push(handle.stop);
    }
    return () => {
      for (const stop of stops) stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, transport, handleInviteFrame, mediaBackend, resolvePairSecret, m.revision]);

  // --- context API -----------------------------------------------------------

  const startCall = useCallback(async (
    peerDeviceId: string,
    media: 'voice' | 'video',
  ): Promise<{ ok: true } | { ok: false; reason: StartCallFailure }> => {
    if (liveRef.current) return { ok: false, reason: 'busy' };
    if (!mediaBackend) return { ok: false, reason: 'no_media_backend' };
    const relay = await ensureEffectiveRelayUrl(db);
    if (!relay?.startsWith('ws')) return { ok: false, reason: 'no_relay' };
    const pairSecretHex = resolvePairSecret(peerDeviceId);
    if (!pairSecretHex || !/^[0-9a-f]{64}$/u.test(pairSecretHex) || isDeviceRevoked(db, peerDeviceId)) {
      return { ok: false, reason: 'not_paired' };
    }
    pruneCallNonces(db, Date.now());
    const callId = makeCallId(bytesToHex(randomBytes(16)));
    const session = buildSession({ callId, peerDeviceId, pairSecretHex, media, role: 'caller' });
    if (!session) return { ok: false, reason: 'no_media_backend' };
    const live: LiveCall = {
      session,
      callId,
      peerDeviceId,
      pairSecretHex,
      direction: 'outgoing',
      createdAtMs: Date.now(),
      logRow: undefined,
      stopChannel: null,
      tickTimer: null,
    };
    attachSession(live);
    openCallChannel(live);
    await session.start();
    const phase = session.getState().phase;
    if (phase === 'failed') return { ok: false, reason: 'signal_failed' };
    return { ok: true };
  }, [db, mediaBackend, resolvePairSecret, buildSession, attachSession, openCallChannel]);

  const acceptCall = useCallback(async () => {
    await liveRef.current?.session.acceptIncoming();
  }, []);
  const declineCall = useCallback(async () => {
    await liveRef.current?.session.decline();
  }, []);
  const hangupCall = useCallback(async () => {
    await liveRef.current?.session.hangup();
  }, []);
  const cancelCall = useCallback(async () => {
    await liveRef.current?.session.cancel();
  }, []);

  const toggleMic = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    const next = !live.session.getState().localMicOn;
    await live.session.setMicrophoneEnabled(next);
  }, []);

  const toggleCamera = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    await live.session.setCameraEnabled(!live.session.getState().localCamOn);
  }, []);

  const reportCallPeer = useCallback((reason: string) => {
    const live = liveRef.current;
    const state = live?.session.getState() ?? activeCall;
    if (!state) return;
    recordCallReport(db, {
      callId: state.callId,
      reportedDeviceId: state.remoteDeviceId,
      reason,
      nowMs: Date.now(),
    });
    void db.flush?.();
  }, [db, activeCall]);

  const getStreams = useCallback(() => {
    const session = mediaSessionRef.current;
    return {
      local: (session?.localStream?.() ?? null) as MediaStream | null,
      remote: (session?.remoteStream?.() ?? null) as MediaStream | null,
    };
  }, []);

  const canCallPeer = useCallback((peerDeviceId: string): boolean => {
    if (!mediaBackend || isDeviceRevoked(db, peerDeviceId)) return false;
    const secret = resolvePairSecret(peerDeviceId);
    return Boolean(secret && /^[0-9a-f]{64}$/u.test(secret));
  }, [mediaBackend, db, resolvePairSecret]);

  const capability = useMemo<CallCapability>(() => ({
    mediaAvailable: mediaBackend !== null,
  }), [mediaBackend]);

  const value = useMemo<CallContextValue>(() => ({
    capability,
    activeCall,
    startCall,
    acceptCall,
    declineCall,
    hangupCall,
    cancelCall,
    toggleMic,
    toggleCamera,
    reportCallPeer,
    getStreams,
    historyRevision,
    canCallPeer,
  }), [
    capability, activeCall, startCall, acceptCall, declineCall, hangupCall, cancelCall,
    toggleMic, toggleCamera, reportCallPeer, getStreams, historyRevision, canCallPeer,
  ]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

/** Cryptographically-strong random bytes from the browser (call nonces + ids). */
function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  (globalThis.crypto ?? (globalThis as unknown as { msCrypto?: Crypto }).msCrypto)?.getRandomValues(out);
  return out;
}
