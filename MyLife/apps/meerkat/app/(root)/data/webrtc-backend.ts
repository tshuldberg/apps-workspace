// Real WebRTC DataChannel backend (Plan 20, Phase 11) over the
// @livekit/react-native-webrtc runtime (Plan 25 Phase 0 migration: direct data,
// direct call media, and LiveKit rooms share ONE native WebRTC runtime).
//
// Implements @mylife/sync's WebRTCBackend over a real RTCPeerConnection +
// RTCDataChannel. Loaded lazily and returns null when the WebRTC runtime is
// absent (Expo Go / web / the node test env), EXACTLY like lan-backend.ts, so
// Expo Go still boots and the relay/LAN flows keep working. When present, the
// backend carries isReal:true so the WebRTC rung reports available; when absent
// the rung stays "Not available on this build" and is never offered or dialed.
//
// HONESTY (NC-11 / WebRTC state):
//   - The connection state ('connecting' | 'connected' | 'failed' | 'closed') is
//     forwarded ONLY from the real RTCPeerConnection connectionstatechange /
//     iceconnectionstatechange events. There is NO timer and NO optimistic flip:
//     a peer that never fires a 'connected' event never reports connected.
//   - This file only MOVES BYTES over the data channel. The @mylife/sync Noise
//     handshake / SAS / frame envelope / sealed shares run UNCHANGED on top of
//     those bytes; no crypto is reimplemented here.
//   - The WebRTC runtime has no built-in peer discovery or signaling, so the
//     simple connectToPeer() path fails honestly (the manager falls through);
//     the working path is the signaling-driven createPeerConnection() surface.

import type { WebRTCBackendFactory } from '@mylife/sync';

// The app resolves @mylife/sync to its pure barrel (index.ts), which exports the
// factory types but NOT the backend interface NAMES (those live on the native
// barrel; web stays relay-only). Derive the contract we implement from the public
// factory type so we stay on the public @mylife/sync surface with no deep import.
type WebRTCBackend = NonNullable<ReturnType<WebRTCBackendFactory>>;
type WebRTCPeerSession = ReturnType<WebRTCBackend['createPeerConnection']>;
type WebRTCDataChannel = ReturnType<WebRTCPeerSession['createDataChannel']>;
type RTCConfigLike = NonNullable<Parameters<WebRTCBackend['createPeerConnection']>[0]>;

// --- Minimal @livekit/react-native-webrtc surface (only what this adapter uses) -------

interface RNDataChannel {
  send(data: ArrayBuffer | ArrayBufferView | string): void;
  close(): void;
  readyState: string;
  binaryType?: string;
  addEventListener(type: 'open' | 'close', handler: () => void): void;
  addEventListener(type: 'message', handler: (event: { data: unknown }) => void): void;
}

interface RNSessionDescription {
  type: string;
  sdp: string;
}

interface RNPeerConnection {
  createDataChannel(label: string): RNDataChannel;
  createOffer(options?: unknown): Promise<RNSessionDescription>;
  createAnswer(options?: unknown): Promise<RNSessionDescription>;
  setLocalDescription(description: RNSessionDescription): Promise<void>;
  setRemoteDescription(description: RNSessionDescription): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  close(): void;
  connectionState?: string;
  iceConnectionState?: string;
  addEventListener(type: string, handler: (event: { candidate?: unknown; channel?: RNDataChannel }) => void): void;
}

interface RNWebRTCModule {
  RTCPeerConnection: new (config?: unknown) => RNPeerConnection;
  RTCIceCandidate: new (init: unknown) => unknown;
  RTCSessionDescription: new (init: { type: string; sdp: string }) => RNSessionDescription;
}

/** Load the native @livekit/react-native-webrtc module, or null when absent. */
function loadWebRTCModule(): RNWebRTCModule | null {
  try {
    // The package emits a native invariant before our catch in Expo Go.
    // Probe the registered runtime before evaluating its JavaScript entry.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as { NativeModules?: { WebRTCModule?: unknown } };
    if (!NativeModules?.WebRTCModule) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@livekit/react-native-webrtc') as RNWebRTCModule;
    return mod?.RTCPeerConnection ? mod : null;
  } catch {
    return null;
  }
}

/** Read the app.config ICE/STUN/TURN servers (extra.iceServers), lazily. */
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

const DEFAULT_ICE_SERVERS: RTCConfigLike['iceServers'] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (typeof data === 'string') return new TextEncoder().encode(data);
  return new Uint8Array(0);
}

/** Wrap a native RTCDataChannel into @mylife/sync's WebRTCDataChannel. */
function wrapDataChannel(channel: RNDataChannel): WebRTCDataChannel {
  try {
    channel.binaryType = 'arraybuffer';
  } catch {
    // Some platforms lock binaryType; message decoding tolerates either shape.
  }
  return {
    get readyState() {
      return channel.readyState;
    },
    send(data: Uint8Array) {
      channel.send(data);
    },
    onMessage(handler: (data: Uint8Array) => void) {
      channel.addEventListener('message', (event) => handler(toBytes(event.data)));
    },
    onOpen(handler: () => void) {
      if (channel.readyState === 'open') {
        handler();
        return;
      }
      channel.addEventListener('open', handler);
    },
    onClose(handler: () => void) {
      channel.addEventListener('close', handler);
    },
    close() {
      channel.close();
    },
  };
}

/**
 * A real WebRTC peer session backed by an RTCPeerConnection.
 *
 * Offer/answer role is tracked so setRemoteDescription can reconstruct the SDP
 * type (the transport's signaling only carries the raw SDP string): an initiator
 * that called createOffer() receives an answer; a responder that has not created
 * an answer yet is receiving an offer.
 */
class RNWebRTCSession implements WebRTCPeerSession {
  readonly peerId: string;
  private readonly pc: RNPeerConnection;
  private readonly mod: RNWebRTCModule;
  private localRole: 'offer' | 'answer' | null = null;

  constructor(mod: RNWebRTCModule, config: RTCConfigLike | undefined, peerId = '') {
    this.mod = mod;
    this.peerId = peerId;
    this.pc = new mod.RTCPeerConnection(config);
  }

  // Simple-path methods are unused: the WebRTC runtime needs signaling.
  async send(_data: Uint8Array): Promise<void> {
    throw new Error('WebRTC uses the data channel; the simple session path is unavailable.');
  }

  onData(_handler: (data: Uint8Array) => void): void {
    // No-op: bytes flow over the data channel, not the session object.
  }

  async close(): Promise<void> {
    this.pc.close();
  }

  createDataChannel(label: string): WebRTCDataChannel {
    return wrapDataChannel(this.pc.createDataChannel(label));
  }

  onDataChannel(handler: (channel: WebRTCDataChannel) => void): void {
    this.pc.addEventListener('datachannel', (event) => {
      if (event.channel) handler(wrapDataChannel(event.channel));
    });
  }

  async createOffer(): Promise<string> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.localRole = 'offer';
    return offer.sdp;
  }

  async createAnswer(_remoteSdp: string): Promise<string> {
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.localRole = 'answer';
    return answer.sdp;
  }

  async setRemoteDescription(sdp: string): Promise<void> {
    const type = this.localRole === 'offer' ? 'answer' : 'offer';
    await this.pc.setRemoteDescription(new this.mod.RTCSessionDescription({ type, sdp }));
  }

  onIceCandidate(handler: (candidate: string) => void): void {
    this.pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) handler(JSON.stringify(event.candidate));
    });
  }

  async addIceCandidate(candidate: string): Promise<void> {
    const init = JSON.parse(candidate) as unknown;
    await this.pc.addIceCandidate(new this.mod.RTCIceCandidate(init));
  }

  onConnectionStateChange(handler: (state: string) => void): void {
    // Forward ONLY the real connection/ICE state. Never a timer, never optimistic.
    const emit = () => {
      const state = this.pc.connectionState ?? this.pc.iceConnectionState ?? '';
      if (state) handler(state);
    };
    this.pc.addEventListener('connectionstatechange', emit);
    this.pc.addEventListener('iceconnectionstatechange', emit);
  }
}

/** The real @livekit/react-native-webrtc backend (isReal:true). */
class RNWebRTCBackend implements WebRTCBackend {
  readonly isReal = true;
  readonly signalingMode = 'external' as const;
  private readonly mod: RNWebRTCModule;
  private readonly defaultConfig: RTCConfigLike;

  constructor(mod: RNWebRTCModule, iceServers: RTCConfigLike['iceServers']) {
    this.mod = mod;
    this.defaultConfig = { iceServers };
  }

  async connectToPeer(_peerId: string): Promise<WebRTCPeerSession> {
    // No built-in discovery/signaling in the WebRTC runtime: the simple path
    // cannot fabricate a connection. Fail honestly so the manager falls through
    // to the signaling-driven path (or the next transport rung).
    throw new Error('WebRTC requires a signaling channel; use the signaling-driven connect path.');
  }

  createPeerConnection(config?: RTCConfigLike): WebRTCPeerSession {
    return new RNWebRTCSession(this.mod, config ?? this.defaultConfig);
  }

  onPeerFound(_handler: (peer: { id: string; displayName: string }) => void): void {
    // The WebRTC runtime broadcasts no peers; discovery is out of band.
  }

  onIncomingSession(_handler: (session: WebRTCPeerSession) => void): void {
    // Inbound sessions arrive via the signaling channel, not this backend.
  }

  destroy(): void {
    // No shared native resource to release; each session owns its RTCPeerConnection.
  }
}

/** Test-only injection: pass a fake WebRTC runtime module + ICE servers. */
export interface LoadWebRTCBackendOptions {
  iceServers?: RTCConfigLike['iceServers'];
  /** @internal Inject a fake native module for unit tests. */
  module?: RNWebRTCModule;
}

/**
 * Load the real WebRTC backend, or null when @livekit/react-native-webrtc is absent.
 *
 * Matches the WebRTCBackendFactory shape ( () => WebRTCBackend | null ): the
 * optional options are used only for ICE overrides and test injection.
 */
export function loadWebRTCBackend(options: LoadWebRTCBackendOptions = {}): WebRTCBackend | null {
  const mod = options.module ?? loadWebRTCModule();
  if (!mod?.RTCPeerConnection) return null;
  const iceServers =
    options.iceServers ?? readConfiguredIceServers() ?? DEFAULT_ICE_SERVERS;
  return new RNWebRTCBackend(mod, iceServers);
}
