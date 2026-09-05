// Plan 25 WP-25H: the browser direct-call WebRTC media backend.
//
// UNVERIFIED - pending live browser QA. Implements @mylife/sync's CallMediaBackend (WP-25D)
// over a real window.RTCPeerConnection + navigator.mediaDevices.getUserMedia audio/video
// tracks. The web twin of apps/meerkat call-media-backend.ts: same honesty rules, native
// browser WebRTC APIs instead of the mobile SDK. loadCallMediaBackend() returns null when
// RTCPeerConnection or mediaDevices is absent (SSR / an old browser / a locked-down context),
// so the call surface states itself honestly unavailable (NC-25.8). Connection state is
// forwarded ONLY from real connectionstatechange / iceconnectionstatechange events: WP-25D
// sets a call 'connected' solely on the connectionState:'connected' event this emits, never
// a timer. Remote video is captured only from the real 'track' event (NC-25.1).

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

// --- Minimal browser WebRTC surface (only what this adapter uses). Kept as a local
// interface so the file does not hard-depend on lib.dom RTC types being present. ---

interface DomMediaStreamTrack {
  kind: string;
  enabled: boolean;
  stop(): void;
}

interface DomMediaStream {
  getTracks(): DomMediaStreamTrack[];
  getAudioTracks(): DomMediaStreamTrack[];
  getVideoTracks(): DomMediaStreamTrack[];
}

interface DomRtcSessionDescription {
  type: string;
  sdp?: string;
}

interface DomRtcStatsReport {
  forEach(cb: (value: Record<string, unknown>) => void): void;
}

interface DomRtcPeerConnection {
  addTrack(track: DomMediaStreamTrack, stream: DomMediaStream): unknown;
  createOffer(options?: unknown): Promise<DomRtcSessionDescription>;
  createAnswer(options?: unknown): Promise<DomRtcSessionDescription>;
  setLocalDescription(description: DomRtcSessionDescription): Promise<void>;
  setRemoteDescription(description: DomRtcSessionDescription): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  getStats(): Promise<DomRtcStatsReport>;
  close(): void;
  connectionState?: string;
  iceConnectionState?: string;
  addEventListener(
    type: string,
    handler: (event: { candidate?: unknown; streams?: unknown; track?: unknown }) => void,
  ): void;
  removeEventListener?(type: string, handler: (event: { candidate?: unknown; streams?: unknown; track?: unknown }) => void): void;
}

interface CallMediaModule {
  RTCPeerConnection: new (config?: unknown) => DomRtcPeerConnection;
  RTCIceCandidate: new (init: unknown) => unknown;
  RTCSessionDescription: new (init: { type: string; sdp: string }) => DomRtcSessionDescription;
  MediaStream: new () => DomMediaStream & { addTrack(track: DomMediaStreamTrack): void };
  mediaDevices: { getUserMedia(constraints: unknown): Promise<DomMediaStream> };
}

interface RTCConfigLike {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

/** Read the browser globals into the module surface, or null when unavailable. */
function loadCallMediaModule(): CallMediaModule | null {
  const g = globalThis as unknown as {
    RTCPeerConnection?: CallMediaModule['RTCPeerConnection'];
    RTCIceCandidate?: CallMediaModule['RTCIceCandidate'];
    RTCSessionDescription?: CallMediaModule['RTCSessionDescription'];
    MediaStream?: CallMediaModule['MediaStream'];
    navigator?: { mediaDevices?: CallMediaModule['mediaDevices'] };
  };
  if (!g.RTCPeerConnection || !g.RTCIceCandidate || !g.RTCSessionDescription) return null;
  if (!g.MediaStream) return null;
  const mediaDevices = g.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) return null;
  return {
    RTCPeerConnection: g.RTCPeerConnection,
    RTCIceCandidate: g.RTCIceCandidate,
    RTCSessionDescription: g.RTCSessionDescription,
    MediaStream: g.MediaStream,
    mediaDevices,
  };
}

function readConfiguredIceServers(): RTCConfigLike['iceServers'] | undefined {
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_MEERKAT_ICE_SERVERS;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RTCConfigLike['iceServers']) : undefined;
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

class BrowserCallMediaSession implements CallMediaPeerSession {
  private readonly pc: DomRtcPeerConnection;
  private readonly mod: CallMediaModule;
  private local: DomMediaStream | null = null;
  private remote: DomMediaStream | null = null;
  private closed = false;
  private readonly stopListeners = new Set<() => void>();

  constructor(mod: CallMediaModule, pc: DomRtcPeerConnection, stream: DomMediaStream | null) {
    this.mod = mod;
    this.pc = pc;
    this.local = stream;
    // Capture the REAL remote stream from the track event; the <video> renders only
    // from a stream the peer connection actually delivered (NC-25.1).
    pc.addEventListener('track', (event) => {
      if (this.closed) return;
      const streams = event.streams as DomMediaStream[] | undefined;
      if (Array.isArray(streams) && streams.length > 0) {
        this.remote = streams[0] ?? null;
        return;
      }
      const track = event.track as DomMediaStreamTrack | undefined;
      if (track) {
        const next = (this.remote as (DomMediaStream & { addTrack?(t: DomMediaStreamTrack): void }) | null)
          ?? new this.mod.MediaStream();
        next.addTrack?.(track);
        this.remote = next;
      }
    });
  }

  /** The real local MediaStream for a <video> element; null until it exists. */
  localStream(): DomMediaStream | null {
    return this.local;
  }

  remoteStream(): DomMediaStream | null {
    return this.remote;
  }

  async createOffer(options?: { iceRestart?: boolean }): Promise<CallSessionDescription> {
    const offer = await this.pc.createOffer(options?.iceRestart ? { iceRestart: true } : undefined);
    await this.pc.setLocalDescription(offer);
    return { type: 'offer', sdp: offer.sdp ?? '' };
  }

  async createAnswer(): Promise<CallSessionDescription> {
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return { type: 'answer', sdp: answer.sdp ?? '' };
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
    this.local?.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    this.local?.getVideoTracks().forEach((t) => { t.enabled = enabled; });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const stop of this.stopListeners) stop();
    try {
      this.local?.getTracks().forEach((track) => { try { track.stop(); } catch { /* stop remaining tracks */ } });
    } finally {
      this.local = null;
      this.remote = null;
      this.pc.close();
    }
  }
}

class BrowserCallMediaBackend implements CallMediaBackend {
  constructor(
    private readonly mod: CallMediaModule,
    private readonly iceServers: RTCConfigLike['iceServers'],
  ) {}

  async startPeerConnection(input: StartCallPeerConnectionInput): Promise<CallMediaPeerSession> {
    const pc = new this.mod.RTCPeerConnection({ iceServers: this.iceServers });
    let stream: DomMediaStream | null = null;
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
    return new BrowserCallMediaSession(this.mod, pc, stream);
  }
}

function normalizeIceState(state: string | undefined): CallMediaConnectionEvent['iceState'] {
  const known = ['new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed'];
  return (known.includes(String(state)) ? state : 'new') as CallMediaConnectionEvent['iceState'];
}

export interface LoadCallMediaBackendOptions {
  iceServers?: RTCConfigLike['iceServers'];
  /** @internal Inject a fake browser media module for unit tests. */
  module?: CallMediaModule;
}

/** Load the real call media backend, or null when the browser WebRTC surface is absent. */
export function loadCallMediaBackend(options: LoadCallMediaBackendOptions = {}): CallMediaBackend | null {
  const mod = options.module ?? loadCallMediaModule();
  if (!mod?.RTCPeerConnection || !mod?.mediaDevices) return null;
  const iceServers = options.iceServers ?? readConfiguredIceServers() ?? DEFAULT_ICE_SERVERS;
  return new BrowserCallMediaBackend(mod, iceServers);
}
