/**
 * Encrypted relay transport for WAN connections via WebSocket.
 *
 * Forwards ciphertext envelopes through a relay server. The relay routes
 * messages by ephemeral session tokens, never by device identity. Tokens
 * are opaque to the relay; the relay stores nothing and sees only ciphertext.
 *
 * Each connection implements TransportConnection with `transport: 'wan_relay'`.
 *
 * Token lifecycle:
 * - New token minted per session (HKDF-derived from initiator ephemeral secret
 *   and relay public key, stored in sync_relay_tokens table).
 * - Default TTL: 24 hours (configurable via tokenTtlMs).
 * - Tokens are rotated on each new session; expired tokens are rejected by relay.
 *
 * Relay server contract:
 * - Protocol: JSON over WebSocket
 * - Envelope format: { token: string, ciphertext: base64-encoded Uint8Array }
 * - Size cap: configurable (default 64 KB)
 * - Relay routes by token, not by device identity
 */

import type { TransportConnection, SyncRelayToken } from '../types';
import { bytesToHex, deriveKey, generateSessionKey } from '../encryption/keys';

// Re-export the SyncRelayToken type for convenience.
export type { SyncRelayToken };

// ---------------------------------------------------------------------------
// Relay Backend Interface
// ---------------------------------------------------------------------------

/** A live session with the relay server. */
export interface RelaySession {
  send(envelope: Uint8Array): Promise<void>;
  onMessage(handler: (envelope: Uint8Array) => void): void;
  /**
   * Optional: notify when the underlying connection drops (server close,
   * network loss). Long-lived listeners (call signaling, WP-25G) use this to
   * schedule an honest reconnect; a backend without it simply cannot report
   * drops and the listener stays until stopped.
   */
  onClose?(handler: () => void): void;
  close(): Promise<void>;
}

export interface RelayConnectOptions {
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
}

/**
 * Platform-agnostic backend for WebSocket relay connections.
 *
 * Implementations:
 * - Browser/Node: wraps native WebSocket
 * - React Native: wraps react-native WebSocket
 * - Test: SimulatedRelayBackend (in-memory, no network)
 */
export interface RelayBackend {
  connect(url: string, token: string, options?: RelayConnectOptions): Promise<RelaySession>;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Relay Transport Options
// ---------------------------------------------------------------------------

export interface RelayTransportOptions {
  /** Injectable relay backend. Falls back to SimulatedRelayBackend. */
  backend?: RelayBackend;
  /** WebSocket URL of the relay server. */
  relayUrl?: string;
  /** Token time-to-live in milliseconds. Default: 24 hours. */
  tokenTtlMs?: number;
  /** Maximum envelope size in bytes. Default: 64 KB. */
  maxEnvelopeBytes?: number;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
  /** Called when a new connection is established. */
  onConnection?: (conn: TransportConnection) => void;
}

const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_ENVELOPE_BYTES = 64 * 1024; // 64 KB

let connectionCounter = 0;

function nextConnectionId(): string {
  return `relay-conn-${++connectionCounter}-${Date.now()}`;
}

function isNonEmptyRelayToken(token: string): boolean {
  return token.trim().length > 0;
}

export function deriveRelayEphemeralToken(
  workspaceId: string,
  peerDeviceId: string,
  seed: Uint8Array = generateSessionKey(),
): string {
  return bytesToHex(deriveKey(
    seed,
    `mylife-sync-relay-token:${workspaceId}:${peerDeviceId}:${Date.now()}`,
    32,
  ));
}

// ---------------------------------------------------------------------------
// Simulated Backend (testing / development)
// ---------------------------------------------------------------------------

/** In-memory relay session for testing. */
class SimulatedRelaySession implements RelaySession {
  private _messageHandlers: Array<(envelope: Uint8Array) => void> = [];
  private _closed = false;
  /** Linked remote session for two-way communication in tests. */
  _remote: SimulatedRelaySession | null = null;
  /** The token this session was opened with. */
  readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async send(envelope: Uint8Array): Promise<void> {
    if (this._closed) throw new Error('RelaySession is closed.');
    // Deliver to remote side asynchronously.
    if (this._remote) {
      const remote = this._remote;
      const copy = new Uint8Array(envelope);
      queueMicrotask(() => {
        for (const h of remote._messageHandlers) h(copy);
      });
    }
  }

  onMessage(handler: (envelope: Uint8Array) => void): void {
    this._messageHandlers.push(handler);
  }

  async close(): Promise<void> {
    this._closed = true;
    this._messageHandlers.length = 0;
  }
}

/**
 * In-memory relay backend for testing and development.
 *
 * Does not touch the network. Sessions are routed by token: when two
 * sessions connect with the same token, they are wired together for
 * bidirectional communication.
 */
export class SimulatedRelayBackend implements RelayBackend {
  private readonly _sessions: Map<string, SimulatedRelaySession> = new Map();
  private _destroyed = false;

  async connect(_url: string, token: string, _options?: RelayConnectOptions): Promise<RelaySession> {
    if (this._destroyed) throw new Error('Backend is destroyed.');
    if (!isNonEmptyRelayToken(token)) throw new Error('Relay token is required.');

    const session = new SimulatedRelaySession(token);

    // If another session is already connected with the same token, wire them.
    const existing = this._sessions.get(token);
    if (existing) {
      session._remote = existing;
      existing._remote = session;
    }

    this._sessions.set(token, session);
    return session;
  }

  destroy(): void {
    for (const session of this._sessions.values()) {
      void session.close();
    }
    this._sessions.clear();
    this._destroyed = true;
  }

  /** Get the number of active sessions (for test assertions). */
  get sessionCount(): number {
    return this._sessions.size;
  }
}

// ---------------------------------------------------------------------------
// RelayTransport
// ---------------------------------------------------------------------------

/**
 * Encrypted relay transport layer for WAN connections.
 *
 * Opens WebSocket sessions to a relay server using ephemeral tokens.
 * The relay forwards ciphertext envelopes between peers identified by
 * matching tokens. The relay never sees device identity or plaintext.
 *
 * When no backend is provided, a SimulatedRelayBackend is used so the
 * class works in tests and on platforms without WebSocket support.
 */
export class RelayTransport {
  private readonly _backend: RelayBackend;
  private readonly _relayUrl: string;
  private readonly _tokenTtlMs: number;
  private readonly _maxEnvelopeBytes: number;
  private readonly _entitlementToken?: string;
  private readonly _onConnection?: (conn: TransportConnection) => void;
  private readonly _connections: Map<string, TransportConnection> = new Map();
  private readonly _sessions: Map<string, RelaySession> = new Map();
  private _destroyed = false;

  constructor(options: RelayTransportOptions = {}) {
    this._backend = options.backend ?? new SimulatedRelayBackend();
    this._relayUrl = options.relayUrl ?? 'wss://relay.mylife.app';
    this._tokenTtlMs = options.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS;
    this._maxEnvelopeBytes = options.maxEnvelopeBytes ?? DEFAULT_MAX_ENVELOPE_BYTES;
    this._entitlementToken = options.entitlementToken;
    this._onConnection = options.onConnection;
  }

  /** Default token TTL in milliseconds. */
  get tokenTtlMs(): number {
    return this._tokenTtlMs;
  }

  /** Maximum envelope size in bytes. */
  get maxEnvelopeBytes(): number {
    return this._maxEnvelopeBytes;
  }

  /**
   * Connect to a remote peer via the relay using an ephemeral token.
   *
   * Opens a WebSocket to the relay server, authenticates with the token,
   * and returns a TransportConnection with `transport: 'wan_relay'`.
   *
   * The token is opaque to the relay. The relay matches peers by token
   * and forwards ciphertext envelopes between them.
   */
  async connectToPeer(
    deviceId: string,
    token: string,
  ): Promise<TransportConnection> {
    this._assertNotDestroyed();
    if (!isNonEmptyRelayToken(token)) {
      throw new RelayTransportError('Relay token is required.');
    }

    try {
      const session = await this._backend.connect(this._relayUrl, token, {
        entitlementToken: this._entitlementToken,
      });
      this._sessions.set(deviceId, session);

      const maxEnvelopeBytes = this._maxEnvelopeBytes;
      const connection: TransportConnection = {
        id: nextConnectionId(),
        remoteDeviceId: deviceId,
        transport: 'wan_relay' as const,

        async send(data: Uint8Array): Promise<void> {
          if (data.byteLength > maxEnvelopeBytes) {
            throw new RelayTransportError(
              `Envelope size ${data.byteLength} exceeds max ${maxEnvelopeBytes} bytes`,
            );
          }
          return session.send(data);
        },

        onData(handler: (data: Uint8Array) => void): void {
          session.onMessage(handler);
        },

        async close(): Promise<void> {
          return session.close();
        },
      };

      this._connections.set(deviceId, connection);
      this._onConnection?.(connection);
      return connection;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayTransportError(
        `Failed to connect to relay for peer ${deviceId}: ${message}`,
      );
    }
  }

  /**
   * Create a relay token metadata object for storage in sync_relay_tokens.
   *
   * The actual token derivation (HKDF from initiator ephemeral secret and
   * relay public key) is handled by the encryption layer. This helper
   * creates the metadata wrapper with TTL enforcement.
   */
  createTokenMetadata(
    workspaceId: string,
    peerDeviceId: string,
    ephemeralToken: string = deriveRelayEphemeralToken(workspaceId, peerDeviceId),
  ): SyncRelayToken {
    if (!isNonEmptyRelayToken(ephemeralToken)) {
      throw new RelayTransportError('Relay token is required.');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this._tokenTtlMs);
    return {
      workspaceId,
      peerDeviceId,
      ephemeralToken,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Check whether a token has expired. */
  isTokenExpired(token: SyncRelayToken): boolean {
    return new Date(token.expiresAt).getTime() <= Date.now();
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
    const session = this._sessions.get(deviceId);
    if (session) {
      await session.close();
      this._sessions.delete(deviceId);
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

    const sessionCloses = Array.from(this._sessions.values()).map((s) =>
      s.close(),
    );
    await Promise.all(sessionCloses);
    this._sessions.clear();

    this._backend.destroy();
    this._destroyed = true;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('RelayTransport has been destroyed.');
    }
  }
}

/** Typed error for relay transport failures. */
export class RelayTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RelayTransportError';
  }
}
