// Plan 25 WP-25G: the direct-call WebRTC media backend.
//
// UNVERIFIED - pending dev build. Implements @mylife/sync's CallMediaBackend (WP-25D) over
// a real RTCPeerConnection + getUserMedia audio/video tracks from @livekit/react-native-webrtc.
// Lazy-loaded and null when the runtime is absent (Expo Go / node), so the call rung stays
// honestly unavailable off a dev build. Like webrtc-backend.ts, connection state is forwarded
// ONLY from real RTCPeerConnection events: WP-25D sets a call 'connected' solely on the
// connectionState:'connected' event this emits, never a timer.

import { selectedWebRtcTransport } from '@mylife/sync';

import type {
  CallIceCandidate,
  CallMediaBackend,
  CallMediaConnectionEvent,
  CallMediaConnectionState,
  CallMediaPeerSession,
  CallSessionDescription,
  StartCallPeerConnectionInput,
} from '@mylife/sync';

// --- Minimal @livekit/react-native-webrtc media surface (only what this adapter uses). ---

interface RNMediaStreamTrack {
  kind: string;
  enabled: boolean;
  stop(): void;
  /** react-native-webrtc camera flip (front/back); absent on non-camera tracks. */
  _switchCamera?(): void;
}

interface RNMediaStream {
  getTracks(): RNMediaStreamTrack[];
  getAudioTracks(): RNMediaStreamTrack[];
  getVideoTracks(): RNMediaStreamTrack[];
  /** react-native-webrtc: a URL for RTCView. Absent in tests/other runtimes. */
  toURL?(): string;
}

interface RNRtcSessionDescription {
  type: string;
  sdp: string;
}

interface RNRtcStatsReport {
  forEach(cb: (value: Record<string, unknown>) => void): void;
}

interface RNRtcPeerConnection {
  addTrack(track: RNMediaStreamTrack, stream: RNMediaStream): unknown;
  getSenders(): Array<{ track?: RNMediaStreamTrack | null }>;
  createOffer(options?: unknown): Promise<RNRtcSessionDescription>;
  createAnswer(options?: unknown): Promise<RNRtcSessionDescription>;
  setLocalDescription(description: RNRtcSessionDescription): Promise<void>;
  setRemoteDescription(description: RNRtcSessionDescription): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  getStats(): Promise<RNRtcStatsReport>;
  close(): void;
  connectionState?: string;
  iceConnectionState?: string;
  addEventListener(
    type: string,
    handler: (event: { candidate?: unknown; streams?: unknown }) => void,
  ): void;
  removeEventListener?(type: string, handler: (event: { candidate?: unknown; streams?: unknown }) => void): void;
}

interface RNCallMediaModule {
  RTCPeerConnection: new (config?: unknown) => RNRtcPeerConnection;
  RTCIceCandidate: new (init: unknown) => unknown;
  RTCSessionDescription: new (init: { type: string; sdp: string }) => RNRtcSessionDescription;
  mediaDevices: { getUserMedia(constraints: unknown): Promise<RNMediaStream> };
}

interface RTCConfigLike {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

function loadCallMediaModule(): RNCallMediaModule | null {
  try {
    // Check the bridge before package evaluation can emit an Expo Go invariant.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as { NativeModules?: { WebRTCModule?: unknown } };
    if (!NativeModules?.WebRTCModule) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@livekit/react-native-webrtc') as RNCallMediaModule;
    return mod?.RTCPeerConnection && mod?.mediaDevices ? mod : null;
  } catch {
    return null;
  }
}

function readConfiguredIceServers(): RTCConfigLike['iceServers'] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { iceServers?: unknown } };
    };
    const raw = Constants?.expoConfig?.extra?.iceServers;
    return Array.isArray(raw) ? (raw as RTCConfigLike['iceServers']) : undefined;
  } catch {
    return undefined;
  }
}

const DEFAULT_ICE_SERVERS: RTCConfigLike['iceServers'] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** Map the SDK connection/ICE state strings onto the WP-25D CallMediaConnectionState. */
function mapConnectionState(state: string | undefined): CallMediaConnectionState {
  switch (String(state)) {
    case 'connected':
    case 'completed':
      return 'connected';
    case 'connecting':
    case 'checking':
      return 'connecting';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
    default:
      return 'new';
  }
}

class RNCallMediaSession implements CallMediaPeerSession {
  private readonly pc: RNRtcPeerConnection;
  private readonly mod: RNCallMediaModule;
  private localStream: RNMediaStream | null = null;
  private remoteStream: RNMediaStream | null = null;
  private closed = false;
  private readonly stopListeners = new Set<() => void>();

  constructor(mod: RNCallMediaModule, pc: RNRtcPeerConnection, stream: RNMediaStream | null) {
    this.mod = mod;
    this.pc = pc;
    this.localStream = stream;
    // Capture the REAL remote stream from the track event; the screen renders
    // video only from a stream the peer connection actually delivered.
    pc.addEventListener('track', (event) => {
      if (this.closed) return;
      const streams = event.streams as RNMediaStream[] | undefined;
      if (Array.isArray(streams) && streams.length > 0) this.remoteStream = streams[0] ?? null;
    });
  }

  /** RTCView source URLs from the real streams; null until they exist. */
  localStreamUrl(): string | null {
    return this.localStream?.toURL?.() ?? null;
  }

  remoteStreamUrl(): string | null {
    return this.remoteStream?.toURL?.() ?? null;
  }

  async createOffer(options?: { iceRestart?: boolean }): Promise<CallSessionDescription> {
    const offer = await this.pc.createOffer(options?.iceRestart ? { iceRestart: true } : undefined);
    await this.pc.setLocalDescription(offer);
    return { type: 'offer', sdp: offer.sdp };
  }

  async createAnswer(): Promise<CallSessionDescription> {
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return { type: 'answer', sdp: answer.sdp };
  }

  async applyRemoteSdp(description: CallSessionDescription): Promise<void> {
    await this.pc.setRemoteDescription(new this.mod.RTCSessionDescription({ type: description.type, sdp: description.sdp }));
  }

  async addIceCandidate(candidate: CallIceCandidate): Promise<void> {
    await this.pc.addIceCandidate(new this.mod.RTCIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? undefined,
      sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
    }));
  }

  onIceCandidate(listener: (candidate: CallIceCandidate | null) => void): () => void {
    let active = true;
    const handler = (event: { candidate?: unknown }) => {
      if (!active || this.closed) return;
      const raw = event.candidate as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | null;
      if (!raw || !raw.candidate) { listener(null); return; }
      listener({ candidate: raw.candidate, sdpMid: raw.sdpMid ?? null, sdpMLineIndex: raw.sdpMLineIndex ?? null });
    };
    this.pc.addEventListener('icecandidate', handler);
    const stop = () => { active = false; this.pc.removeEventListener?.('icecandidate', handler); this.stopListeners.delete(stop); };
    this.stopListeners.add(stop);
    return stop;
  }

  onConnectionStateChange(listener: (event: CallMediaConnectionEvent) => void): () => void {
    let active = true;
    let revision = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const retryDelays = [100, 250, 500, 1000];
    const emit = () => {
      clearTimeout(retryTimer);
      if (!active || this.closed) return;
      const current = ++revision;
      const connectionState = mapConnectionState(this.pc.connectionState ?? this.pc.iceConnectionState);
      const iceState = normalizeIceState(this.pc.iceConnectionState);
      listener({ connectionState, iceState });
      if (!active || this.closed || current !== revision) return;
      const report = (attempt: number) => {
        void this.transportKind().then((transport) => {
          if (!active || this.closed || current !== revision) return;
          if (transport) listener({ connectionState, iceState, transport });
          // Statistics can lag the real connection event. Never infer a route from elapsed time.
          if (!transport && connectionState === 'connected' && attempt < retryDelays.length
            && active && !this.closed && current === revision) {
            retryTimer = setTimeout(() => report(attempt + 1), retryDelays[attempt]);
          }
        });
      };
      report(0);
    };
    this.pc.addEventListener('connectionstatechange', emit);
    this.pc.addEventListener('iceconnectionstatechange', emit);
    const stop = () => {
      active = false;
      clearTimeout(retryTimer);
      this.pc.removeEventListener?.('connectionstatechange', emit);
      this.pc.removeEventListener?.('iceconnectionstatechange', emit);
      this.stopListeners.delete(stop);
    };
    this.stopListeners.add(stop);
    return stop;
  }

  /** Report 'turn' only when the selected candidate pair actually relays through TURN. */
  private async transportKind(): Promise<'direct' | 'turn' | undefined> {
    try {
      const stats = await this.pc.getStats();
      const reports: Record<string, unknown>[] = [];
      stats.forEach((report) => reports.push(report));
      return selectedWebRtcTransport(reports);
    } catch {
      return undefined;
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    this.localStream?.getVideoTracks().forEach((t) => { t.enabled = enabled; });
  }

  /** Flip front/back camera via the real track API; a no-op without a video track. */
  async switchCamera(): Promise<void> {
    this.localStream?.getVideoTracks().forEach((t) => { t._switchCamera?.(); });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const stop of this.stopListeners) stop();
    try {
      this.localStream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* stop remaining tracks */ } });
    } finally {
      this.localStream = null;
      this.remoteStream = null;
      this.pc.close();
    }
  }
}

class RNCallMediaBackend implements CallMediaBackend {
  constructor(
    private readonly mod: RNCallMediaModule,
    private readonly iceServers: RTCConfigLike['iceServers'],
  ) {}

  async startPeerConnection(input: StartCallPeerConnectionInput): Promise<CallMediaPeerSession> {
    const pc = new this.mod.RTCPeerConnection({ iceServers: this.iceServers });
    let stream: RNMediaStream | null = null;
    try {
      stream = await this.mod.mediaDevices.getUserMedia({
        audio: true,
        video: input.media === 'video',
      });
      for (const track of stream.getTracks()) {
        if (track.kind === 'audio') track.enabled = input.localMicOn;
        if (track.kind === 'video') track.enabled = input.localCamOn;
        pc.addTrack(track, stream);
      }
    } catch (error) {
      // No media permission / no device: tear the pc down and fail honestly upward.
      stream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* stop remaining tracks */ } });
      try { pc.close(); } catch { /* preserve the media failure */ }
      throw error instanceof Error ? error : new Error('getUserMedia_failed');
    }
    return new RNCallMediaSession(this.mod, pc, stream);
  }
}

function normalizeIceState(state: string | undefined): CallMediaConnectionEvent['iceState'] {
  const known = ['new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed'];
  return (known.includes(String(state)) ? state : 'new') as CallMediaConnectionEvent['iceState'];
}

export interface LoadCallMediaBackendOptions {
  iceServers?: RTCConfigLike['iceServers'];
  /** @internal Inject a fake native media module for unit tests. */
  module?: RNCallMediaModule;
}

/** Load the real call media backend, or null when @livekit/react-native-webrtc is absent. */
export function loadCallMediaBackend(options: LoadCallMediaBackendOptions = {}): CallMediaBackend | null {
  const mod = options.module ?? loadCallMediaModule();
  if (!mod?.RTCPeerConnection || !mod?.mediaDevices) return null;
  const iceServers = options.iceServers ?? readConfiguredIceServers() ?? DEFAULT_ICE_SERVERS;
  return new RNCallMediaBackend(mod, iceServers);
}
