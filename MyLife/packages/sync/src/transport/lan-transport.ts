/**
 * Direct TCP/WebSocket transport for LAN connections.
 *
 * Manages peer-to-peer connections between devices on the same local
 * network. Real TCP sockets require react-native-tcp-socket on mobile
 * or the net module on Node. This implementation provides the interface
 * with a mock/stub that can be swapped for real sockets at runtime.
 *
 * Each connection implements TransportConnection with `transport: 'lan'`.
 *
 * Noise_XK handshake integration is deferred. The handshake module exists
 * at `packages/sync/src/encryption/noise-handshake.ts` and will be wired
 * into this transport layer once the encryption package API is finalized.
 * Until then, connections are plaintext mock streams.
 */

import type { TransportConnection, DiscoveredPeer } from '../types';

export interface LANTransportOptions {
  /** Port to listen on for incoming connections. */
  listenPort?: number;
  /** Callback when a connection is established (inbound or outbound). */
  onConnection?: (connection: TransportConnection) => void;
}

const DEFAULT_LAN_PORT = 42420;

let connectionCounter = 0;

/** Generate a unique connection ID. */
function nextConnectionId(): string {
  return `lan-conn-${++connectionCounter}-${Date.now()}`;
}

/**
 * Creates a mock TransportConnection backed by in-memory buffers.
 *
 * In production, this would wrap a TCP socket or WebSocket sealed with
 * a workspace-key derived symmetric cipher. The mock version stores a
 * data handler and enables send/receive for testing.
 */
function createMockConnection(
  remoteDeviceId: string,
): TransportConnection & { _dataHandlers: Array<(data: Uint8Array) => void> } {
  const handlers: Array<(data: Uint8Array) => void> = [];
  let closed = false;

  return {
    id: nextConnectionId(),
    remoteDeviceId,
    transport: 'lan' as const,
    _dataHandlers: handlers,

    async send(data: Uint8Array): Promise<void> {
      if (closed) throw new Error('Connection is closed.');
      // In a real implementation, this would write to the socket.
      // For testing, the test harness can wire two connections together.
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

/**
 * LAN transport layer for direct device-to-device connections.
 *
 * This is a stub implementation. In production, `startListening` would
 * bind a TCP server socket, and `connect` would open a TCP client
 * connection to the discovered peer's host:port.
 *
 * The listener accepts incoming connections even when the engine is idle.
 * This symmetric responder pattern ensures peers can initiate sync at
 * any time without requiring coordinated startup.
 */
export class LANTransport {
  private readonly _port: number;
  private readonly _onConnection?: (connection: TransportConnection) => void;
  private readonly _connections: Map<string, TransportConnection> = new Map();
  private _listening = false;
  private _destroyed = false;

  constructor(options: LANTransportOptions = {}) {
    this._port = options.listenPort ?? DEFAULT_LAN_PORT;
    this._onConnection = options.onConnection;
  }

  /** Whether the transport is listening for incoming connections. */
  get isListening(): boolean {
    return this._listening;
  }

  /** The port this transport listens on. */
  get port(): number {
    return this._port;
  }

  /**
   * Start listening for incoming connections.
   *
   * Stub: in production, this would bind a TCP server on `this._port`.
   * The server accepts connections regardless of engine state so that
   * remote peers can initiate sync at any time.
   */
  async startListening(): Promise<void> {
    this._assertNotDestroyed();
    if (this._listening) return;
    this._listening = true;
    // Stub: real TCP server bind would happen here.
    // e.g. net.createServer().listen(this._port)
  }

  /** Stop listening for incoming connections. */
  async stopListening(): Promise<void> {
    if (!this._listening) return;
    this._listening = false;
    // Stub: real TCP server close would happen here.
  }

  /**
   * Connect to a discovered peer.
   *
   * Creates a TransportConnection to the peer at peer.host:peer.port.
   * Stub: returns a mock connection. In production, this would open
   * a TCP socket or WebSocket to the peer and perform a Noise_XK
   * handshake before returning the sealed connection.
   *
   * @returns The established connection, or null if the connection failed.
   */
  async connect(peer: DiscoveredPeer): Promise<TransportConnection> {
    this._assertNotDestroyed();

    try {
      const connection = createMockConnection(peer.deviceId);
      this._connections.set(peer.deviceId, connection);

      this._onConnection?.(connection);
      return connection;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new LANTransportError(
        `Failed to connect to peer ${peer.deviceId} at ${peer.host}:${peer.port}: ${message}`,
      );
    }
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

    await this.stopListening();

    const closePromises = Array.from(this._connections.values()).map((conn) =>
      conn.close(),
    );
    await Promise.all(closePromises);
    this._connections.clear();

    this._destroyed = true;
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('LANTransport has been destroyed.');
    }
  }
}

/** Typed error for LAN transport failures. */
export class LANTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LANTransportError';
  }
}
