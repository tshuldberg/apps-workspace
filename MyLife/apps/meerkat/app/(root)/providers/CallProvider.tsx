import { createMeerkatRelayBackend } from '../data/hosted-relay';
// Plan 25 WP-25G: the live direct-call coordinator.
//
// UNVERIFIED - pending dev build / live QA for the media + native surfaces.
// Wires the tested cores together and adds NO state logic of its own:
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
//   - The WP-25F native bridge (CallKit/Telecom) is honest-null off a dev
//     build: capability reports unavailable and no call action is enabled
//     (NC-25.8); native events, when present, drive the same session methods
//     as the on-screen buttons.

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
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import {
  CallSession,
  CallSignalTransport,
  bytesToHex,
  deriveCallInviteToken,
  deriveCallSignalToken,
  hexToBytes,
  sealCallSignalFrame,
  createCallSignal,
  type CallMediaBackend,
  type CallMediaPeerSession,
  type CallSignal,
  type CallState,
  type OutboundCallSignal,
} from '@mylife/sync';
import {
  NativeCallClient,
  loadNativeCallModule,
  type NativeAudioRoute,
  type NativeCallCapability,
  type NativeCallEndReason,
} from '@mylife/meerkat-call-native';
import { useMeerkatDatabase } from './DatabaseProvider';
import { useIdentity } from './IdentityProvider';
import { useSync } from './SyncProvider';
import { effectiveRelayUrl } from '../data/effective-relay';
import { loadCallMediaBackend } from '../data/call-media-backend';
import { foldCallLog, type CallLogRow } from '../data/call-log-core';
import {
  clearCallActive,
  hasSeenCallNonce,
  pruneCallNonces,
  recordCallNonce,
  recordCallReport,
  upsertCallActive,
  upsertCallLogRow,
} from '../data/call-store';
import {
  makeCallId,
  peekInboundCallSignal,
  planOutboundCallSignalTokens,
  shouldRingForInvite,
} from '../data/call-provider-core';

export type StartCallFailure =
  | 'busy'
  | 'no_media_backend'
  | 'no_relay'
  | 'not_paired'
  | 'signal_failed';

export interface CallCapability {
  /** True only when the real WebRTC media runtime is compiled into this build. */
  mediaAvailable: boolean;
  /** The real native CallKit/Telecom capability probe result. */
  native: NativeCallCapability | null;
}

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
  switchCamera: () => Promise<void>;
  /** Request an audio route via the native module; false = honestly unavailable. */
  setAudioRoute: (route: NativeAudioRoute) => Promise<boolean>;
  reportCallPeer: (reason: string) => void;
  /** RTCView URLs from the REAL media streams; null until they exist. */
  getStreamUrls: () => { local: string | null; remote: string | null };
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
  mediaSession: CallMediaPeerSession | null;
  nativeReported: boolean;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { pairedDevices, resolvePairSecret, isPeerRevoked } = useSync();
  const router = useRouter();

  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [nativeCapability, setNativeCapability] = useState<NativeCallCapability | null>(null);

  const liveRef = useRef<LiveCall | null>(null);
  const mediaSessionRef = useRef<CallMediaPeerSession | null>(null);

  // The real media backend, or null (Expo Go / node): calls honestly off.
  const baseMediaBackend = useMemo(() => loadCallMediaBackend(), []);
  const mediaBackend = useMemo<CallMediaBackend | null>(() => {
    if (!baseMediaBackend) return null;
    return {
      async startPeerConnection(input) {
        const session = await baseMediaBackend.startPeerConnection(input);
        mediaSessionRef.current = session;
        return session;
      },
    };
  }, [baseMediaBackend]);

  const nativeClient = useMemo(() => new NativeCallClient(loadNativeCallModule()), []);

  useEffect(() => {
    let cancelled = false;
    void nativeClient.getCapability().then((cap) => {
      if (!cancelled) setNativeCapability(cap);
    });
    return () => {
      cancelled = true;
    };
  }, [nativeClient]);

  // One transport for the provider's lifetime; every dial goes through the
  // health-gated effectiveRelayUrl choke point.
  const transport = useMemo(
    () => new CallSignalTransport({
      backend: createMeerkatRelayBackend(identity),
      relayUrl: () => effectiveRelayUrl(db),
    }),
    [db, identity],
  );
  useEffect(() => () => transport.destroy(), [transport]);

  useEffect(() => {
    pruneCallNonces(db, Date.now());
  }, [db]);

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

  // Tear the live call machinery down with the provider (app teardown): the
  // tick timer and channel listener must not outlive the React tree.
  useEffect(() => () => {
    const live = liveRef.current;
    if (live) teardownLive(live);
  }, [teardownLive]);

  const reportNativeTerminal = useCallback((live: LiveCall, state: CallState) => {
    if (!live.nativeReported) return;
    live.nativeReported = false;
    const reason: NativeCallEndReason = state.phase === 'ended'
      ? (state.endReason === 'local_hangup' ? 'localEnded' : 'remoteEnded')
      : state.phase === 'declined'
        ? 'rejected'
        : state.phase === 'missed'
          ? 'missed'
          : state.phase === 'busy'
            ? 'busy'
            : state.phase === 'cancelled'
              ? 'cancelled'
              : 'failed';
    void nativeClient.reportCallEnded(live.callId, reason).catch(() => undefined);
    void nativeClient.disconnect(live.callId, reason).catch(() => undefined);
  }, [nativeClient]);

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
      if (state.phase === 'connected' && live.direction === 'outgoing' && live.nativeReported) {
        void nativeClient.reportOutgoingCallConnected(live.callId).catch(() => undefined);
      }
      if (terminal) {
        reportNativeTerminal(live, state);
        teardownLive(live);
      }
    });
    live.tickTimer = setInterval(() => {
      void live.session.tick();
    }, TICK_INTERVAL_MS);
    (live.tickTimer as unknown as { unref?: () => void }).unref?.();
  }, [nativeClient, persistState, reportNativeTerminal, teardownLive, openCallChannel]);

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
      createNonce: () => bytesToHex(Crypto.getRandomBytes(24)),
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
    if (isPeerRevoked(peerDeviceId)) return;
    if (!mediaBackend) {
      // No media runtime in this build: never ring a call we cannot take.
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
      mediaSession: null,
      nativeReported: false,
    };
    attachSession(newLive);
    openCallChannel(newLive);
    // The session verifies and records the invite nonce, then rings (NC-25.2).
    void session.handleInboundSignal(peeked.raw).then(() => {
      if (session.getState().phase !== 'ringing') return;
      // Android in-app ring can also surface the system call UI when the
      // owned Telecom module is compiled in; iOS terminated/background rings
      // arrive via PushKit -> CallKit natively (WP-25F).
      void nativeClient.getCapability().then((cap) => {
        if (cap.available && cap.platform === 'android') {
          newLive.nativeReported = true;
          void nativeClient
            .addIncomingCall({ callId: signal.callId, hasVideo: signal.media === 'video' })
            .catch(() => {
              newLive.nativeReported = false;
            });
        }
      });
      router.push('/call');
    });

    async function respondBusy(secretHex: string, invite: CallSignal): Promise<void> {
      const built = createCallSignal({
        sender: identity,
        callId: invite.callId,
        kind: 'busy',
        toDeviceId: invite.fromDeviceId,
        media: invite.media,
        nowMs: Date.now(),
        nonce: bytesToHex(Crypto.getRandomBytes(24)),
      });
      if (!built.ok) return;
      const busyFrame = sealCallSignalFrame(hexToBytes(secretHex), built.signal);
      await transport.sendFrame(deriveCallSignalToken(secretHex, invite.callId), busyFrame);
    }
  }, [db, identity, isPeerRevoked, mediaBackend, buildSession, attachSession, openCallChannel, nativeClient, router, transport]);

  // Maintain one invite-channel listener per active, unrevoked pairing. Off a
  // configured relay the listeners honestly sit 'unavailable' and retry.
  useEffect(() => {
    if (!mediaBackend) return undefined;
    const stops: Array<() => void> = [];
    for (const device of pairedDevices) {
      if (!device.isActive || isPeerRevoked(device.deviceId)) continue;
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
  }, [pairedDevices, isPeerRevoked, resolvePairSecret, transport, handleInviteFrame, mediaBackend]);

  // --- native bridge events drive the same session methods as the UI --------

  useEffect(() => {
    const subs = [
      nativeClient.on('callAnswered', ({ callId }) => {
        const live = liveRef.current;
        if (live && live.callId === callId) void live.session.acceptIncoming();
      }),
      nativeClient.on('callEnded', ({ callId }) => {
        const live = liveRef.current;
        if (!live || live.callId !== callId) return;
        const phase = live.session.getState().phase;
        if (phase === 'ringing' && live.direction === 'incoming') void live.session.decline();
        else if (phase === 'inviting' || phase === 'ringing') void live.session.cancel();
        else void live.session.hangup();
      }),
      nativeClient.on('muteChanged', ({ callId, muted }) => {
        const live = liveRef.current;
        if (live && live.callId === callId) void live.session.setMicrophoneEnabled(!muted);
      }),
    ];
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, [nativeClient]);

  // --- context API -----------------------------------------------------------

  const startCall = useCallback(async (
    peerDeviceId: string,
    media: 'voice' | 'video',
  ): Promise<{ ok: true } | { ok: false; reason: StartCallFailure }> => {
    if (liveRef.current) return { ok: false, reason: 'busy' };
    if (!mediaBackend) return { ok: false, reason: 'no_media_backend' };
    const relay = effectiveRelayUrl(db);
    if (!relay?.startsWith('ws')) return { ok: false, reason: 'no_relay' };
    const pairSecretHex = resolvePairSecret(peerDeviceId);
    if (!pairSecretHex || !/^[0-9a-f]{64}$/u.test(pairSecretHex) || isPeerRevoked(peerDeviceId)) {
      return { ok: false, reason: 'not_paired' };
    }
    pruneCallNonces(db, Date.now());
    const callId = makeCallId(bytesToHex(Crypto.getRandomBytes(16)));
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
      mediaSession: null,
      nativeReported: false,
    };
    attachSession(live);
    openCallChannel(live);
    router.push('/call');
    await session.start();
    const phase = session.getState().phase;
    if (phase === 'failed') return { ok: false, reason: 'signal_failed' };
    // Surface the outgoing call to the OS call UI when the module is present.
    void nativeClient.getCapability().then((cap) => {
      if (!cap.available) return;
      live.nativeReported = true;
      const surface = cap.platform === 'ios'
        ? nativeClient.startOutgoingCall({ callUUID: callId, hasVideo: media === 'video' })
        : nativeClient.addOutgoingCall({ callId, hasVideo: media === 'video' });
      void surface.catch(() => {
        live.nativeReported = false;
      });
    });
    return { ok: true };
  }, [db, mediaBackend, resolvePairSecret, isPeerRevoked, buildSession, attachSession, openCallChannel, router, nativeClient]);

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
    const changed = await live.session.setMicrophoneEnabled(next);
    if (changed && live.nativeReported) {
      void nativeClient.setMuted(live.callId, !next).catch(() => undefined);
    }
  }, [nativeClient]);

  const toggleCamera = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    await live.session.setCameraEnabled(!live.session.getState().localCamOn);
  }, []);

  const switchCamera = useCallback(async () => {
    const session = mediaSessionRef.current as (CallMediaPeerSession & { switchCamera?: () => Promise<void> }) | null;
    await session?.switchCamera?.();
  }, []);

  const setAudioRoute = useCallback(async (route: NativeAudioRoute): Promise<boolean> => {
    const live = liveRef.current;
    if (!live) return false;
    try {
      await nativeClient.setAudioRoute({ callId: live.callId, route });
      return true;
    } catch {
      return false;
    }
  }, [nativeClient]);

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
  }, [db, activeCall]);

  const getStreamUrls = useCallback(() => {
    const session = mediaSessionRef.current as (CallMediaPeerSession & {
      localStreamUrl?: () => string | null;
      remoteStreamUrl?: () => string | null;
    }) | null;
    return {
      local: session?.localStreamUrl?.() ?? null,
      remote: session?.remoteStreamUrl?.() ?? null,
    };
  }, []);

  const canCallPeer = useCallback((peerDeviceId: string): boolean => {
    if (!mediaBackend || isPeerRevoked(peerDeviceId)) return false;
    const secret = resolvePairSecret(peerDeviceId);
    return Boolean(secret && /^[0-9a-f]{64}$/u.test(secret));
  }, [mediaBackend, isPeerRevoked, resolvePairSecret]);

  const capability = useMemo<CallCapability>(() => ({
    mediaAvailable: mediaBackend !== null,
    native: nativeCapability,
  }), [mediaBackend, nativeCapability]);

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
    switchCamera,
    setAudioRoute,
    reportCallPeer,
    getStreamUrls,
    historyRevision,
    canCallPeer,
  }), [
    capability, activeCall, startCall, acceptCall, declineCall, hangupCall, cancelCall,
    toggleMic, toggleCamera, switchCamera, setAudioRoute, reportCallPeer, getStreamUrls,
    historyRevision, canCallPeer,
  ]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
