/**
 * WebRTC DataChannel transport for WAN peer-to-peer connections.
 *
 * Extracted from providers/p2p.ts into a standalone transport that follows
 * the same connection patterns as LANTransport and NearbyTransport. The P2P
 * provider delegates to this transport instead of managing WebRTC internals.
 *
 * Each connection implements TransportConnection with `transport: 'wan_webrtc'`.
 *
 * Two connection modes:
 * - Simple: `connect(deviceId)` delegates to the backend's `connectToPeer`.
 *   Suitable for backends that manage signaling internally. Used by the
 *   TransportManager for ranked-ladder fallthrough.
 * - Signaling-driven: `connectToPeer(deviceId, signalingFn)` and
 *   `acceptConnection(...)` use SDP/ICE exchange via a caller-provided
 *   signaling function. Production path for explicit signaling control.
 *
 * ICE gathering timeout: 5 seconds (per architecture doc).
 */

import type { TransportConnection } from '../types';
import type { RealTransportBackendMarker } from './data-transport-backend';
import { isRealBackend } from './data-transport-backend';

// ---------------------------------------------------------------------------
// WebRTC Backend Interfaces
// ---------------------------------------------------------------------------

/** Configuration for ICE servers (STUN/TURN). */
export interface RTCConfigLike {
  iceServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

/** A bidirectional data channel on a WebRTC peer session. */
export interface WebRTCDataChannel {
  send(data: Uint8Array): void;
  onMessage(handler: (data: Uint8Array) => void): void;
  onOpen(handler: () => void): void;
  onClose(handler: () => void): void;
  close(): void;
  readyState: string;
}

/**
 * A WebRTC peer session returned by both the simple and signaling paths.
 *
 * The base fields (`peerId`, `send`, `onData`, `close`) are used by the
 * simple `connect()` path. The signaling methods (`createDataChannel`,
 * `createOffer`, etc.) are used by the `connectToPeer`/`acceptConnection`
 * signaling-driven paths.
 */
export interface WebRTCPeerSession {
  /** Remote peer identifier. */
  peerId: string;
  /** Send binary data to the remote peer. */
  send(data: Uint8Array): Promise<void>;
  /** Register handler for incoming data. */
  onData(handler: (data: Uint8Array) => void): void;
  /** Close the session. */
  close(): Promise<void>;

  // -- Signaling-path methods (used by connectToPeer / acceptConnection) --
  // These are required on the interface so that createPeerConnection callers
  // can use them without null checks. Simple-path sessions provide no-ops.
  createDataChannel(label: string): WebRTCDataChannel;
  onDataChannel(handler: (channel: WebRTCDataChannel) => void): void;
  createOffer(): Promise<string>;
  createAnswer(remoteSdp: string): Promise<string>;
  setRemoteDescription(sdp: string): Promise<void>;
  onIceCandidate(handler: (candidate: string) => void): void;
  addIceCandidate(candidate: string): Promise<void>;
  onConnectionStateChange(handler: (state: string) => void): void;
}

/**
 * Platform-agnostic backend for WebRTC connections.
 *
 * Provides two connection surfaces:
 * - `connectToPeer(peerId)`: simple path, returns a ready session.
 * - `createPeerConnection(config?)`: signaling path, returns a session
 *   with signaling methods for SDP/ICE exchange.
 *
 * Also supports peer discovery and incoming session injection for testing.
 *
 * Implementations:
 * - Browser: wraps native RTCPeerConnection + RTCDataChannel
 * - React Native: wraps react-native-webrtc (real, `isReal: true`)
 * - Test: SimulatedWebRTCBackend (in-memory, no network, `isReal` false)
 *
 * Extends RealTransportBackendMarker: only a real native backend sets
 * `isReal: true`, which flips `WebRTCTransport.isAvailable` on and lets the
 * selector offer/dial the rung. A Simulated backend keeps it false.
 */
export interface WebRTCBackend extends RealTransportBackendMarker {
  /** External means the caller must provide SDP/ICE signaling. Default is managed. */
  readonly signalingMode?: 'managed' | 'external';
  /** Simple connect: returns a ready-to-use session. */
  connectToPeer(peerId: string): Promise<WebRTCPeerSession>;
  /** Signaling connect: returns a session with signaling methods. */
  createPeerConnection(config?: RTCConfigLike): WebRTCPeerSession;
  /** Register handler for discovered peers. */
  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void;
  /** Register handler for incoming sessions. */
  onIncomingSession(handler: (session: WebRTCPeerSession) => void): void;
  /** Shut down the backend. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Signaling Function Type
// ---------------------------------------------------------------------------

/**
 * Signaling function provided by the caller for SDP/ICE exchange.
 *
 * The transport calls this to send signaling data to the remote peer and
 * registers a handler for incoming signaling data. Returns an unsubscribe
 * function to clean up the signaling listener.
 */
export interface SignalingFn {
  send(data: string): Promise<void>;
  onMessage(handler: (data: string) => void): () => void;
}

// ---------------------------------------------------------------------------
// Transport Options
// ---------------------------------------------------------------------------

/**
 * Live connection state, derived ONLY from a real onConnectionStateChange / ICE
 * signal the backend forwards. It is NEVER flipped to 'connected' by a timer or
 * optimistically on connect(); a Simulated backend that forwards no ICE event
 * stays 'connecting' forever (it cannot masquerade as connected-for-data).
 */
export type WebRTCConnectionState = 'connecting' | 'connected' | 'failed' | 'closed';

export interface WebRTCTransportOptions {
  /** Injectable WebRTC backend. Falls back to SimulatedWebRTCBackend. */
  backend?: WebRTCBackend;
  /** ICE servers for STUN/TURN. Defaults to Google STUN. */
  iceServers?: RTCConfigLike['iceServers'];
  /** Called when a new connection is established (inbound or outbound). */
  onConnection?: (conn: TransportConnection) => void;
  /** Called only for a connection initiated by the remote peer. */
  onIncomingConnection?: (conn: TransportConnection) => void;
  /**
   * Called when a peer's live connection state changes. The 'connected' state
   * is emitted ONLY from the backend's real ICE / connection-state callback.
   */
  onConnectionState?: (deviceId: string, state: WebRTCConnectionState) => void;
}

/** Normalize a raw backend connection-state string into WebRTCConnectionState. */
function normalizeConnectionState(raw: string): WebRTCConnectionState {
  switch (raw) {
    case 'connected':
    case 'completed':
      return 'connected';
    case 'failed':
      return 'failed';
    case 'closed':
    case 'disconnected':
      return 'closed';
    default:
      return 'connecting';
  }
}

const DEFAULT_ICE_SERVERS: RTCConfigLike['iceServers'] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const DATA_CHANNEL_LABEL = 'mylife-sync';
const ICE_TIMEOUT_MS = 5_000;

let connectionCounter = 0;

function nextConnectionId(): string {
  return `webrtc-conn-${++connectionCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Simulated Backend (testing / development)
// ---------------------------------------------------------------------------

/** In-memory data channel for testing. Pairs can be wired together. */
class SimulatedDataChannel implements WebRTCDataChannel {
  readyState = 'connecting';
  private _messageHandlers: Array<(data: Uint8Array) => void> = [];
  private _openHandlers: Array<() => void> = [];
  private _closeHandlers: Array<() => void> = [];
  /** Linked remote channel for two-way communication in tests. */
  _remote: SimulatedDataChannel | null = null;

  send(data: Uint8Array): void {
    if (this.readyState !== 'open') {
      throw new Error('DataChannel is not open.');
    }
    if (this._remote) {
      const remote = this._remote;
      const copy = new Uint8Array(data);
      queueMicrotask(() => {
        for (const h of remote._messageHandlers) h(copy);
      });
    }
  }

  onMessage(handler: (data: Uint8Array) => void): void {
    this._messageHandlers.push(handler);
  }

  onOpen(handler: () => void): void {
    this._openHandlers.push(handler);
    if (this.readyState === 'open') {
      queueMicrotask(() => handler());
    }
  }

  onClose(handler: () => void): void {
    this._closeHandlers.push(handler);
  }

  close(): void {
    this.readyState = 'closed';
    for (const h of this._closeHandlers) h();
    this._messageHandlers.length = 0;
    this._openHandlers.length = 0;
    this._closeHandlers.length = 0;
  }

  /** Simulate the channel opening. */
  _open(): void {
    this.readyState = 'open';
    for (const h of this._openHandlers) h();
  }
}

/** In-memory peer session with signaling support for testing. */
class SimulatedSignalingSession implements WebRTCPeerSession {
  readonly peerId = '';
  private _dataChannelHandler: ((channel: WebRTCDataChannel) => void) | null = null;
  private _connectionStateHandler: ((state: string) => void) | null = null;
  _localChannel: SimulatedDataChannel | null = null;

  async send(_data: Uint8Array): Promise<void> { /* no-op for signaling sessions */ }
  onData(_handler: (data: Uint8Array) => void): void { /* no-op */ }
  async close(): Promise<void> {
    this._localChannel?.close();
    this._localChannel = null;
  }

  createDataChannel(_label: string): WebRTCDataChannel {
    this._localChannel = new SimulatedDataChannel();
    return this._localChannel;
  }

  onDataChannel(handler: (channel: WebRTCDataChannel) => void): void {
    this._dataChannelHandler = handler;
  }

  async createOffer(): Promise<string> {
    return JSON.stringify({ type: 'offer', sdp: `sim-offer-${Date.now()}` });
  }

  async createAnswer(_remoteSdp: string): Promise<string> {
    return JSON.stringify({ type: 'answer', sdp: `sim-answer-${Date.now()}` });
  }

  async setRemoteDescription(_sdp: string): Promise<void> { /* no-op */ }

  onIceCandidate(handler: (candidate: string) => void): void {
    queueMicrotask(() => {
      handler(JSON.stringify({ candidate: 'simulated', sdpMid: '0' }));
    });
  }

  async addIceCandidate(_candidate: string): Promise<void> { /* no-op */ }

  onConnectionStateChange(handler: (state: string) => void): void {
    this._connectionStateHandler = handler;
  }

  /** Simulate a successful connection. */
  _simulateConnected(): void {
    this._connectionStateHandler?.('connected');
  }

  /**
   * Deliver an incoming data channel (responder side).
   * Called by SimulatedWebRTCBackend when the offerer's channel is ready.
   */
  _deliverRemoteChannel(channel: SimulatedDataChannel): void {
    const local = new SimulatedDataChannel();
    local._remote = channel;
    channel._remote = local;
    this._dataChannelHandler?.(local);
    local._open();
    channel._open();
    this._connectionStateHandler?.('connected');
  }
}

/** No-op data channel returned by mock sessions for the simple path. */
const noopChannel: WebRTCDataChannel = {
  readyState: 'closed',
  send() { /* no-op */ },
  onMessage() { /* no-op */ },
  onOpen() { /* no-op */ },
  onClose() { /* no-op */ },
  close() { /* no-op */ },
};

/**
 * Mock WebRTCPeerSession for the simple connect path.
 *
 * It stores the connection-state handler so a test (or the SimulatedWebRTCBackend
 * helper) can fire a real 'connected'/'failed' ICE event through `_fireState`.
 * It does NOT flip to connected on its own: the simple path only reports
 * 'connected' when the ICE event is explicitly delivered, so the Simulated
 * backend never masquerades as connected-for-data.
 */
class SimulatedSimpleSession implements WebRTCPeerSession {
  private readonly _dataHandlers: Array<(data: Uint8Array) => void> = [];
  private _connectionStateHandler: ((state: string) => void) | null = null;
  private _closed = false;

  constructor(readonly peerId: string) {}

  async send(data: Uint8Array): Promise<void> {
    if (this._closed) throw new Error('WebRTCPeerSession is closed.');
    void data;
  }

  onData(handler: (data: Uint8Array) => void): void {
    this._dataHandlers.push(handler);
  }

  async close(): Promise<void> {
    this._closed = true;
    this._dataHandlers.length = 0;
  }

  // Signaling no-ops (simple path does not use these).
  createDataChannel(): WebRTCDataChannel { return noopChannel; }
  onDataChannel(): void { /* no-op */ }
  async createOffer(): Promise<string> { return ''; }
  async createAnswer(): Promise<string> { return ''; }
  async setRemoteDescription(): Promise<void> { /* no-op */ }
  onIceCandidate(): void { /* no-op */ }
  async addIceCandidate(): Promise<void> { /* no-op */ }
  onConnectionStateChange(handler: (state: string) => void): void {
    this._connectionStateHandler = handler;
  }

  /** Deliver a real ICE / connection-state event (test helper). */
  _fireState(state: string): void {
    this._connectionStateHandler?.(state);
  }
}

/**
 * In-memory WebRTC backend for testing and development.
 *
 * Supports both connection surfaces:
 * - Simple: `connectToPeer(peerId)` returns a mock session.
 * - Signaling: `createPeerConnection()` returns a session with full
 *   signaling methods. Use `wireSessionPair()` to connect two sessions.
 *
 * Also provides test helpers for peer injection and delay simulation.
 */
export class SimulatedWebRTCBackend implements WebRTCBackend {
  /** In-memory backend: never a live rung. Real adapters set `isReal: true`. */
  readonly isReal = false;

  private _peerFoundHandler: ((peer: { id: string; displayName: string }) => void) | null = null;
  private _incomingSessionHandler: ((session: WebRTCPeerSession) => void) | null = null;
  private readonly _signalingSessionsList: SimulatedSignalingSession[] = [];
  private readonly _simpleSessions: Map<string, SimulatedSimpleSession> = new Map();
  private _connectDelayMs = 0;
  private _destroyed = false;

  /** Simple connect: returns a ready mock session. */
  async connectToPeer(peerId: string): Promise<WebRTCPeerSession> {
    if (this._destroyed) throw new Error('Backend is destroyed.');
    if (this._connectDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this._connectDelayMs));
    }
    const session = new SimulatedSimpleSession(peerId);
    this._simpleSessions.set(peerId, session);
    return session;
  }

  /** Signaling connect: returns a session with full signaling methods. */
  createPeerConnection(_config?: RTCConfigLike): WebRTCPeerSession {
    if (this._destroyed) throw new Error('Backend is destroyed.');
    const session = new SimulatedSignalingSession();
    this._signalingSessionsList.push(session);
    return session;
  }

  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void {
    this._peerFoundHandler = handler;
  }

  onIncomingSession(handler: (session: WebRTCPeerSession) => void): void {
    this._incomingSessionHandler = handler;
  }

  destroy(): void {
    for (const s of this._signalingSessionsList) void s.close();
    this._signalingSessionsList.length = 0;
    this._simpleSessions.clear();
    this._peerFoundHandler = null;
    this._incomingSessionHandler = null;
    this._destroyed = true;
  }

  // -- Test helpers --

  /**
   * Deliver a real ICE 'connected' event to a simple-path peer session, so
   * tests can prove the transport reports 'connected' ONLY from a real ICE
   * signal (never a timer). No-op if the peer was never connected.
   */
  simulateIceConnected(peerId: string): void {
    if (this._destroyed) return;
    this._simpleSessions.get(peerId)?._fireState('connected');
  }

  /** Deliver a real ICE 'failed' event to a simple-path peer session. */
  simulateIceFailed(peerId: string): void {
    if (this._destroyed) return;
    this._simpleSessions.get(peerId)?._fireState('failed');
  }

  /** Inject a discovered peer into the simulated network. */
  injectPeer(peer: { id: string; displayName: string }): void {
    if (this._destroyed) return;
    this._peerFoundHandler?.(peer);
  }

  /** Inject an incoming session (simulates a remote peer connecting to us). */
  injectIncomingSession(session: WebRTCPeerSession): void {
    if (this._destroyed) return;
    this._incomingSessionHandler?.(session);
  }

  /** Set a delay before `connectToPeer` resolves (simulates slow connection). */
  setConnectDelay(ms: number): void {
    this._connectDelayMs = ms;
  }

  /**
   * Wire two signaling sessions together to simulate a real WebRTC connection.
   * Call after both sessions have been created via `createPeerConnection`.
   */
  wireSessionPair(offerer: WebRTCPeerSession, answerer: WebRTCPeerSession): void {
    const o = offerer as SimulatedSignalingSession;
    const a = answerer as SimulatedSignalingSession;
    if (o._localChannel) {
      a._deliverRemoteChannel(o._localChannel);
    } else {
      o._simulateConnected();
      a._simulateConnected();
    }
  }
}

// ---------------------------------------------------------------------------
// WebRTCTransport
// ---------------------------------------------------------------------------

/**
 * WebRTC DataChannel transport layer for WAN peer-to-peer connections.
 *
 * Wraps a WebRTCBackend to create peer connections and establish
 * bidirectional data channels. Each channel is wrapped into a
 * TransportConnection for uniform handling by the TransportManager.
 *
 * When no backend is provided, a SimulatedWebRTCBackend is used so the
 * class works in tests and on platforms without native WebRTC APIs.
 */
export class WebRTCTransport {
  private readonly _backend: WebRTCBackend;
  private readonly _available: boolean;
  private readonly _iceServers: RTCConfigLike['iceServers'];
  private readonly _onConnection?: (conn: TransportConnection) => void;
  private readonly _onIncomingConnection?: (conn: TransportConnection) => void;
  private readonly _onConnectionState?: (deviceId: string, state: WebRTCConnectionState) => void;
  private readonly _connections: Map<string, TransportConnection> = new Map();
  private readonly _sessions: Map<string, WebRTCPeerSession> = new Map();
  private readonly _connectionStates: Map<string, WebRTCConnectionState> = new Map();
  private _destroyed = false;

  constructor(options: WebRTCTransportOptions = {}) {
    // Availability is derived from the injected backend BEFORE the Simulated
    // fallback, so a missing/absent native module reports unavailable.
    this._available = isRealBackend(options.backend);
    this._backend = options.backend ?? new SimulatedWebRTCBackend();
    this._iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
    this._onConnection = options.onConnection;
    this._onIncomingConnection = options.onIncomingConnection;
    this._onConnectionState = options.onConnectionState;

    // Wire backend incoming session callback.
    this._backend.onIncomingSession((session) => this._handleIncomingSession(session));
  }

  /**
   * Whether a real native WebRTC backend is present on this build. False when
   * only the Simulated backend is available (Expo Go / native module absent):
   * the selector must not offer or dial the rung in that case.
   */
  get isAvailable(): boolean {
    return this._available;
  }

  /** Whether this backend needs the caller to exchange SDP/ICE messages. */
  get requiresExternalSignaling(): boolean {
    return this._backend.signalingMode === 'external';
  }

  /** The live connection state for a peer, or undefined if never dialed. */
  getConnectionState(deviceId: string): WebRTCConnectionState | undefined {
    return this._connectionStates.get(deviceId);
  }

  /**
   * Record a peer connection-state transition. 'connected' is only ever passed
   * here from a real backend ICE / connection-state callback, never a timer.
   */
  private _setConnectionState(deviceId: string, state: WebRTCConnectionState): void {
    this._connectionStates.set(deviceId, state);
    this._onConnectionState?.(deviceId, state);
  }

  // -------------------------------------------------------------------------
  // Simple connect (backend-driven, NearbyTransport pattern)
  // -------------------------------------------------------------------------

  /**
   * Connect to a peer by device ID via the backend.
   *
   * The backend handles signaling internally. This is the simple path
   * matching the NearbyTransport pattern. Returns a TransportConnection
   * with `transport: 'wan_webrtc'`.
   *
   * ICE gathering times out after 5 seconds.
   */
  async connect(deviceId: string): Promise<TransportConnection> {
    this._assertNotDestroyed();

    const iceTimeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new WebRTCTransportError(
          `ICE gathering timed out after ${ICE_TIMEOUT_MS}ms for peer ${deviceId}`,
        ));
      }, ICE_TIMEOUT_MS);
    });

    try {
      const session = await Promise.race([
        this._backend.connectToPeer(deviceId),
        iceTimeout,
      ]);
      const connection = this._wrapSession(session);
      this._connections.set(deviceId, connection);
      this._sessions.set(deviceId, session);
      // Live state stays 'connecting' until the backend forwards a real ICE
      // 'connected' event. It is never flipped optimistically here.
      this._setConnectionState(deviceId, 'connecting');
      session.onConnectionStateChange((state) => {
        this._setConnectionState(deviceId, normalizeConnectionState(state));
      });
      this._onConnection?.(connection);
      return connection;
    } catch (err: unknown) {
      if (err instanceof WebRTCTransportError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new WebRTCTransportError(
        `Failed to connect to peer ${deviceId}: ${message}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Signaling-driven connect (production WebRTC path)
  // -------------------------------------------------------------------------

  /**
   * Connect to a remote peer as the initiator (offerer) using explicit
   * signaling.
   *
   * Creates a WebRTC offer, sends it via the signaling function, waits for
   * the answer and ICE candidates, and establishes a DataChannel. Returns
   * a TransportConnection with `transport: 'wan_webrtc'`.
   *
   * ICE gathering times out after 5 seconds.
   */
  async connectToPeer(
    deviceId: string,
    signalingFn: SignalingFn,
  ): Promise<TransportConnection> {
    this._assertNotDestroyed();

    this._closeExistingPeer(deviceId);
    const session = this._backend.createPeerConnection({
      iceServers: this._iceServers,
    });
    this._sessions.set(deviceId, session);
    this._setConnectionState(deviceId, 'connecting');

    return new Promise<TransportConnection>((resolve, reject) => {
      let settled = false;
      const cleanup: Array<() => void> = [];

      const iceTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          void session.close();
          this._sessions.delete(deviceId);
          for (const fn of cleanup) fn();
          reject(new WebRTCTransportError(
            `ICE gathering timed out after ${ICE_TIMEOUT_MS}ms for peer ${deviceId}`,
          ));
        }
      }, ICE_TIMEOUT_MS);

      // Forward ICE candidates to the remote peer via signaling.
      session.onIceCandidate((candidate) => {
        void signalingFn.send(JSON.stringify({ type: 'ice-candidate', candidate }));
      });

      // Listen for signaling messages from the remote peer.
      const unsub = signalingFn.onMessage((data) => {
        try {
          const msg = JSON.parse(data) as { type: string; sdp?: string; candidate?: string };
          if (msg.type === 'answer' && msg.sdp) {
            void session.setRemoteDescription(msg.sdp);
          } else if (msg.type === 'ice-candidate' && msg.candidate) {
            void session.addIceCandidate(msg.candidate);
          }
        } catch {
          // Ignore malformed signaling messages.
        }
      });
      cleanup.push(unsub);

      // Create data channel and wait for it to open.
      const channel = session.createDataChannel(DATA_CHANNEL_LABEL);

      channel.onOpen(() => {
        if (settled) return;
        settled = true;
        clearTimeout(iceTimer);
        for (const fn of cleanup) fn();

        const connection = this._wrapChannel(deviceId, channel);
        this._connections.set(deviceId, connection);
        this._onConnection?.(connection);
        resolve(connection);
      });

      channel.onClose(() => {
        if (!settled) {
          settled = true;
          clearTimeout(iceTimer);
          for (const fn of cleanup) fn();
          void session.close();
          this._sessions.delete(deviceId);
          reject(new WebRTCTransportError(
            `DataChannel closed before opening for peer ${deviceId}`,
          ));
        }
      });

      session.onConnectionStateChange((state) => {
        // Record the live state from the real ICE / connection-state signal.
        this._setConnectionState(deviceId, normalizeConnectionState(state));
        if (state === 'failed' && !settled) {
          settled = true;
          clearTimeout(iceTimer);
          for (const fn of cleanup) fn();
          void session.close();
          this._sessions.delete(deviceId);
          reject(new WebRTCTransportError(
            `WebRTC connection failed for peer ${deviceId}`,
          ));
        }
      });

      // Create and send the offer.
      void session.createOffer().then((offerSdp) => {
        return signalingFn.send(JSON.stringify({ type: 'offer', sdp: offerSdp }));
      }).catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(iceTimer);
          for (const fn of cleanup) fn();
          void session.close();
          this._sessions.delete(deviceId);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  }

  /**
   * Accept an incoming connection as the responder (answerer) using
   * explicit signaling.
   *
   * Receives an offer SDP, creates an answer, sends it via the signaling
   * function, and waits for the DataChannel to be delivered by the offerer.
   * Returns a TransportConnection with `transport: 'wan_webrtc'`.
   *
   * ICE gathering times out after 5 seconds.
   */
  async acceptConnection(
    deviceId: string,
    offerSdp: string,
    signalingFn: SignalingFn,
  ): Promise<TransportConnection> {
    this._assertNotDestroyed();

    this._closeExistingPeer(deviceId);
    const session = this._backend.createPeerConnection({
      iceServers: this._iceServers,
    });
    this._sessions.set(deviceId, session);
    this._setConnectionState(deviceId, 'connecting');

    return new Promise<TransportConnection>((resolve, reject) => {
      let settled = false;
      const cleanup: Array<() => void> = [];

      const iceTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          void session.close();
          this._sessions.delete(deviceId);
          for (const fn of cleanup) fn();
          reject(new WebRTCTransportError(
            `ICE gathering timed out after ${ICE_TIMEOUT_MS}ms for peer ${deviceId}`,
          ));
        }
      }, ICE_TIMEOUT_MS);

      // Forward ICE candidates via signaling.
      session.onIceCandidate((candidate) => {
        void signalingFn.send(JSON.stringify({ type: 'ice-candidate', candidate }));
      });

      // Listen for signaling messages from the remote peer.
      const unsub = signalingFn.onMessage((data) => {
        try {
          const msg = JSON.parse(data) as { type: string; candidate?: string };
          if (msg.type === 'ice-candidate' && msg.candidate) {
            void session.addIceCandidate(msg.candidate);
          }
        } catch {
          // Ignore malformed signaling messages.
        }
      });
      cleanup.push(unsub);

      // Listen for the data channel created by the offerer.
      session.onDataChannel((channel) => {
        channel.onOpen(() => {
          if (settled) return;
          settled = true;
          clearTimeout(iceTimer);
          for (const fn of cleanup) fn();

          const connection = this._wrapChannel(deviceId, channel);
          this._connections.set(deviceId, connection);
          this._onConnection?.(connection);
          this._onIncomingConnection?.(connection);
          resolve(connection);
        });

        channel.onClose(() => {
          if (!settled) {
            settled = true;
            clearTimeout(iceTimer);
            for (const fn of cleanup) fn();
            void session.close();
            this._sessions.delete(deviceId);
            reject(new WebRTCTransportError(
              `DataChannel closed before opening for peer ${deviceId}`,
            ));
          }
        });
      });

      session.onConnectionStateChange((state) => {
        // Record the live state from the real ICE / connection-state signal.
        this._setConnectionState(deviceId, normalizeConnectionState(state));
        if (state === 'failed' && !settled) {
          settled = true;
          clearTimeout(iceTimer);
          for (const fn of cleanup) fn();
          void session.close();
          this._sessions.delete(deviceId);
          reject(new WebRTCTransportError(
            `WebRTC connection failed for peer ${deviceId}`,
          ));
        }
      });

      // Set remote offer, create answer, send it.
      void (async () => {
        try {
          await session.setRemoteDescription(offerSdp);
          const answerSdp = await session.createAnswer(offerSdp);
          await signalingFn.send(JSON.stringify({ type: 'answer', sdp: answerSdp }));
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(iceTimer);
            for (const fn of cleanup) fn();
            void session.close();
            this._sessions.delete(deviceId);
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        }
      })();
    });
  }

  // -------------------------------------------------------------------------
  // Connection management
  // -------------------------------------------------------------------------

  /** Get all active connections. */
  getConnections(): TransportConnection[] {
    return Array.from(this._connections.values());
  }

  /** Get a connection by remote device ID. */
  getConnection(deviceId: string): TransportConnection | undefined {
    return this._connections.get(deviceId);
  }

  /** Close a specific connection by device ID. */
  async closeConnection(deviceId: string): Promise<void> {
    const connection = this._connections.get(deviceId);
    if (connection) {
      await connection.close();
      this._connections.delete(deviceId);
    }
    const session = this._sessions.get(deviceId);
    if (session) {
      await session.close();
      this._sessions.delete(deviceId);
    }
    if (this._connectionStates.has(deviceId)) {
      this._setConnectionState(deviceId, 'closed');
      this._connectionStates.delete(deviceId);
    }
  }

  /** Close all connections and clean up. */
  async destroy(): Promise<void> {
    if (this._destroyed) return;

    const closePromises = Array.from(this._connections.values()).map((conn) =>
      conn.close(),
    );
    await Promise.all(closePromises);
    this._connections.clear();

    for (const session of this._sessions.values()) {
      await session.close();
    }
    this._sessions.clear();
    this._connectionStates.clear();

    this._backend.destroy();
    this._destroyed = true;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Close and drop any existing session/connection for a peer before a new one
   * replaces it. Without this, a second dial (glare, or a repeated inbound offer)
   * overwrote the map entry and orphaned the prior RTCPeerConnection unreachably,
   * so a paired peer could spawn unbounded live connections keeping only the last.
   */
  private _closeExistingPeer(deviceId: string): void {
    const priorSession = this._sessions.get(deviceId);
    if (priorSession) {
      void Promise.resolve(priorSession.close()).catch(() => undefined);
      this._sessions.delete(deviceId);
    }
    const priorConnection = this._connections.get(deviceId);
    if (priorConnection) {
      void Promise.resolve(priorConnection.close()).catch(() => undefined);
      this._connections.delete(deviceId);
    }
  }

  /** Handle an incoming session from the backend (remote peer initiated). */
  private _handleIncomingSession(session: WebRTCPeerSession): void {
    if (this._destroyed) return;

    this._closeExistingPeer(session.peerId);
    const connection = this._wrapSession(session);
    this._connections.set(session.peerId, connection);
    this._sessions.set(session.peerId, session);
    this._setConnectionState(session.peerId, 'connecting');
    session.onConnectionStateChange((state) => {
      this._setConnectionState(session.peerId, normalizeConnectionState(state));
    });
    this._onConnection?.(connection);
    this._onIncomingConnection?.(connection);
  }

  /** Wrap a WebRTCPeerSession (simple path) into a TransportConnection. */
  private _wrapSession(session: WebRTCPeerSession): TransportConnection {
    return {
      id: nextConnectionId(),
      remoteDeviceId: session.peerId,
      transport: 'wan_webrtc' as const,

      async send(data: Uint8Array): Promise<void> {
        return session.send(data);
      },

      onData(handler: (data: Uint8Array) => void): void {
        session.onData(handler);
      },

      async close(): Promise<void> {
        return session.close();
      },
    };
  }

  /** Wrap a WebRTCDataChannel (signaling path) into a TransportConnection. */
  private _wrapChannel(
    remoteDeviceId: string,
    channel: WebRTCDataChannel,
  ): TransportConnection {
    return {
      id: nextConnectionId(),
      remoteDeviceId,
      transport: 'wan_webrtc' as const,

      async send(data: Uint8Array): Promise<void> {
        channel.send(data);
      },

      onData(handler: (data: Uint8Array) => void): void {
        channel.onMessage(handler);
      },

      async close(): Promise<void> {
        channel.close();
      },
    };
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('WebRTCTransport has been destroyed.');
    }
  }
}

/** Typed error for WebRTC transport failures. */
export class WebRTCTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebRTCTransportError';
  }
}
