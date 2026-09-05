/**
 * Nearby peer transport for ad-hoc Wi-Fi connections.
 *
 * Manages peer-to-peer connections using platform-specific nearby
 * communication APIs: MultipeerConnectivity (MCSession, MCNearbyServiceAdvertiser,
 * MCNearbyServiceBrowser) on iOS, WifiP2pManager + WifiAwareSession on Android.
 *
 * Since native bridge code requires platform-specific binaries, the TypeScript
 * side defines the interface and delegates to an injectable backend (same pattern
 * as LANDiscovery's DiscoveryBackend). Real native modules are injected at
 * runtime; a SimulatedNearbyBackend is used for testing.
 *
 * Each connection implements TransportConnection with `transport: 'nearby'`.
 *
 * Noise_XK handshake works identically across LAN and nearby (transport-agnostic).
 * Handshake integration is deferred until the encryption package API is finalized.
 */

import type { TransportConnection, DiscoveredPeer } from '../types';
import type { RealTransportBackendMarker } from './data-transport-backend';
import { isRealBackend } from './data-transport-backend';

// ---------------------------------------------------------------------------
// Nearby Backend Interface
// ---------------------------------------------------------------------------

/** A bidirectional session with a nearby peer. */
export interface NearbySession {
  peerId: string;
  send(data: Uint8Array): Promise<void>;
  onData(handler: (data: Uint8Array) => void): void;
  close(): Promise<void>;
}

/**
 * Platform-agnostic backend for nearby peer communication.
 *
 * Implementations:
 * - iOS: wraps MultipeerConnectivity (MCNearbyServiceAdvertiser + MCNearbyServiceBrowser)
 * - Android: wraps WifiP2pManager + WifiAwareSession
 * - Test: SimulatedNearbyBackend (in-memory, no network, `isReal` false)
 *
 * Extends RealTransportBackendMarker: only a real native backend sets
 * `isReal: true`, flipping `NearbyTransport.isAvailable` on so the selector may
 * offer/dial the rung. A Simulated backend keeps it false ("Not available on
 * this build").
 */
export interface NearbyPeerBackend extends RealTransportBackendMarker {
  advertise(serviceType: string, displayName: string): void;
  browse(serviceType: string): void;
  stopAdvertising(): void;
  stopBrowsing(): void;
  connectToPeer(peerId: string): Promise<NearbySession>;
  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void;
  onPeerLost(handler: (peerId: string) => void): void;
  onIncomingSession(handler: (session: NearbySession) => void): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Simulated Backend (testing / development)
// ---------------------------------------------------------------------------

/**
 * In-memory nearby backend for testing and development.
 *
 * Does not touch the network. Peers and sessions are injected via helper
 * methods so tests can drive discovery and connections deterministically.
 */
export class SimulatedNearbyBackend implements NearbyPeerBackend {
  /** In-memory backend: never a live rung. Real adapters set `isReal: true`. */
  readonly isReal = false;

  private _peerFoundHandler: ((peer: { id: string; displayName: string }) => void) | null = null;
  private _peerLostHandler: ((peerId: string) => void) | null = null;
  private _incomingSessionHandler: ((session: NearbySession) => void) | null = null;
  private _destroyed = false;

  advertise(_serviceType: string, _displayName: string): void {
    // No-op in simulation mode.
  }

  browse(_serviceType: string): void {
    // No-op in simulation mode.
  }

  stopAdvertising(): void {
    // No-op in simulation mode.
  }

  stopBrowsing(): void {
    // No-op in simulation mode.
  }

  async connectToPeer(peerId: string): Promise<NearbySession> {
    return createMockNearbySession(peerId);
  }

  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void {
    this._peerFoundHandler = handler;
  }

  onPeerLost(handler: (peerId: string) => void): void {
    this._peerLostHandler = handler;
  }

  onIncomingSession(handler: (session: NearbySession) => void): void {
    this._incomingSessionHandler = handler;
  }

  destroy(): void {
    this._peerFoundHandler = null;
    this._peerLostHandler = null;
    this._incomingSessionHandler = null;
    this._destroyed = true;
  }

  /** Inject a discovered peer into the simulated network. */
  injectPeer(peer: { id: string; displayName: string }): void {
    if (this._destroyed) return;
    this._peerFoundHandler?.(peer);
  }

  /** Remove a peer from the simulated network. */
  removePeer(peerId: string): void {
    if (this._destroyed) return;
    this._peerLostHandler?.(peerId);
  }

  /** Inject an incoming session (simulates a remote peer connecting to us). */
  injectIncomingSession(session: NearbySession): void {
    if (this._destroyed) return;
    this._incomingSessionHandler?.(session);
  }
}

// ---------------------------------------------------------------------------
// Mock Session Helper
// ---------------------------------------------------------------------------

/** Creates a mock NearbySession backed by in-memory buffers for testing. */
export function createMockNearbySession(peerId: string): NearbySession {
  const handlers: Array<(data: Uint8Array) => void> = [];
  let closed = false;

  return {
    peerId,

    async send(data: Uint8Array): Promise<void> {
      if (closed) throw new Error('NearbySession is closed.');
      // In production, this would write to the native session.
      void data;
    },

    onData(handler: (data: Uint8Array) => void): void {
      handlers.push(handler);
    },

    async close(): Promise<void> {
      closed = true;
      handlers.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// NearbyTransport Options
// ---------------------------------------------------------------------------

export interface NearbyTransportOptions {
  /** Injectable nearby backend. Falls back to SimulatedNearbyBackend. */
  backend?: NearbyPeerBackend;
  /** Service type for advertising and browsing. */
  serviceType?: string;
  /** Called when a new connection is established (inbound or outbound). */
  onConnection?: (connection: TransportConnection) => void;
  /** Called only for a session initiated by the remote peer. */
  onIncomingConnection?: (connection: TransportConnection) => void;
}

const DEFAULT_SERVICE_TYPE = '_mylife-sync._tcp';

let connectionCounter = 0;

/** Generate a unique connection ID. */
function nextConnectionId(): string {
  return `nearby-conn-${++connectionCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// NearbyTransport
// ---------------------------------------------------------------------------

/**
 * Nearby peer transport layer for ad-hoc Wi-Fi connections.
 *
 * Wraps a NearbyPeerBackend to advertise this device, browse for nearby
 * peers, and establish bidirectional sessions. Each session is wrapped
 * into a TransportConnection for uniform handling by the TransportManager.
 *
 * When no backend is provided, a SimulatedNearbyBackend is used so the
 * class works in tests and on platforms without native nearby APIs.
 */
export class NearbyTransport {
  private readonly _backend: NearbyPeerBackend;
  private readonly _available: boolean;
  private readonly _serviceType: string;
  private readonly _onConnection?: (connection: TransportConnection) => void;
  private readonly _onIncomingConnection?: (connection: TransportConnection) => void;
  private readonly _connections: Map<string, TransportConnection> = new Map();
  private readonly _discoveredPeers: Map<string, DiscoveredPeer> = new Map();
  private _advertising = false;
  private _browsing = false;
  private _destroyed = false;

  constructor(options: NearbyTransportOptions = {}) {
    // Availability is derived from the injected backend BEFORE the Simulated
    // fallback, so a missing/absent native module reports unavailable.
    this._available = isRealBackend(options.backend);
    this._backend = options.backend ?? new SimulatedNearbyBackend();
    this._serviceType = options.serviceType ?? DEFAULT_SERVICE_TYPE;
    this._onConnection = options.onConnection;
    this._onIncomingConnection = options.onIncomingConnection;

    // Wire backend callbacks.
    this._backend.onPeerFound((peer) => this._handlePeerFound(peer));
    this._backend.onPeerLost((peerId) => this._handlePeerLost(peerId));
    this._backend.onIncomingSession((session) => this._handleIncomingSession(session));
  }

  /**
   * Whether a real native Nearby backend is present on this build. False when
   * only the Simulated backend is available (Expo Go / native module absent):
   * the selector must not offer or dial the rung in that case.
   */
  get isAvailable(): boolean {
    return this._available;
  }

  /** Whether the transport is currently advertising. */
  get isAdvertising(): boolean {
    return this._advertising;
  }

  /** Whether the transport is currently browsing for peers. */
  get isBrowsing(): boolean {
    return this._browsing;
  }

  /**
   * Start advertising this device for nearby peer discovery.
   *
   * On iOS this registers an MCNearbyServiceAdvertiser. On Android
   * this starts Wi-Fi P2P group creation.
   */
  startAdvertising(displayName: string): void {
    this._assertNotDestroyed();
    if (this._advertising) return;
    this._advertising = true;
    // The second argument is the ADVERTISED HANDLE, not a label: since plan 53
    // the native side uses it as the peer id other devices see. The sync rung
    // passes NOTHING, which keeps the per-process random handle the native
    // module mints for itself. `displayName` was never advertised (the old
    // native code accepted and dropped it), and it must not start being now --
    // broadcasting a user's device name is exactly the tracking surface the
    // ceremony's ephemeral ids exist to avoid.
    void displayName;
    this._backend.advertise(this._serviceType, '');
  }

  /** Stop advertising. */
  stopAdvertising(): void {
    if (!this._advertising) return;
    this._advertising = false;
    this._backend.stopAdvertising();
  }

  /**
   * Start browsing for nearby peers.
   *
   * On iOS this starts an MCNearbyServiceBrowser. On Android this
   * initiates Wi-Fi P2P peer discovery.
   */
  startBrowsing(): void {
    this._assertNotDestroyed();
    if (this._browsing) return;
    this._browsing = true;
    this._backend.browse(this._serviceType);
  }

  /** Stop browsing. */
  stopBrowsing(): void {
    if (!this._browsing) return;
    this._browsing = false;
    this._backend.stopBrowsing();
  }

  /**
   * Connect to a discovered nearby peer.
   *
   * Opens a NearbySession to the peer and wraps it in a
   * TransportConnection. Fires the onConnection callback.
   */
  async connect(peerId: string): Promise<TransportConnection> {
    this._assertNotDestroyed();

    try {
      const session = await this._backend.connectToPeer(peerId);
      const connection = this._wrapSession(session);
      this._connections.set(peerId, connection);
      this._onConnection?.(connection);
      return connection;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new NearbyTransportError(
        `Failed to connect to nearby peer ${peerId}: ${message}`,
      );
    }
  }

  /** Get all discovered nearby peers. */
  getDiscoveredPeers(): DiscoveredPeer[] {
    return Array.from(this._discoveredPeers.values());
  }

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
  }

  /** Close all connections and clean up. */
  async destroy(): Promise<void> {
    if (this._destroyed) return;

    this.stopAdvertising();
    this.stopBrowsing();

    const closePromises = Array.from(this._connections.values()).map((conn) =>
      conn.close(),
    );
    await Promise.all(closePromises);
    this._connections.clear();
    this._discoveredPeers.clear();

    this._backend.destroy();
    this._destroyed = true;
  }

  // -------------------------------------------------------------------------
  // Private: Backend event handlers
  // -------------------------------------------------------------------------

  private _handlePeerFound(peer: { id: string; displayName: string }): void {
    if (this._destroyed) return;

    const discovered: DiscoveredPeer = {
      deviceId: peer.id,
      displayName: peer.displayName,
      // Nearby peers don't have host:port (not TCP). Use empty/zero placeholders
      // since the connection is established through the native session API.
      host: '',
      port: 0,
      discoveredAt: Date.now(),
    };

    this._discoveredPeers.set(peer.id, discovered);
  }

  private _handlePeerLost(peerId: string): void {
    if (this._destroyed) return;
    this._discoveredPeers.delete(peerId);
  }

  private _handleIncomingSession(session: NearbySession): void {
    if (this._destroyed) return;

    const connection = this._wrapSession(session);
    this._connections.set(session.peerId, connection);
    this._onConnection?.(connection);
    this._onIncomingConnection?.(connection);
  }

  /** Wrap a NearbySession in a TransportConnection. */
  private _wrapSession(session: NearbySession): TransportConnection {
    return {
      id: nextConnectionId(),
      remoteDeviceId: session.peerId,
      transport: 'nearby' as const,

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

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('NearbyTransport has been destroyed.');
    }
  }
}

/** Typed error for nearby transport failures. */
export class NearbyTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NearbyTransportError';
  }
}
