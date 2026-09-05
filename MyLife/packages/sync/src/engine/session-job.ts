/**
 * Headless sync-session runner (Task 3, background sync).
 *
 * `runSyncSessionJob` is the dependency-injected twin of the app's manual
 * relay session: it joins a relay on the rendezvous token, wraps the relay
 * session as a TransportConnection, and drives the REAL engine
 * (`syncWithConnection` as initiator, `handleIncomingConnection` as
 * responder). Because it calls the same engine the UI uses, every session it
 * runs writes the same real `sync_sessions` rows -- there is nothing synthetic
 * here. A background initiate with no listener present hits the initiator
 * handshake timeout and the engine records a real `failed` session row; this
 * function NEVER fabricates a `completed` status.
 *
 * RN-safe: zero expo/native imports. The relay backend, the engine, the
 * connection adapter, and the clock are all injected so the same code runs in
 * the UI (manual), in a headless background task (best-effort), and in Vitest
 * (in-memory backend + fake clock).
 */

import type { SyncSession, TransportConnection } from '../types';
import type { RelayBackend } from '../transport/relay-transport';

/** The minimal engine surface the job drives (matches NativeSyncEngine). */
export interface SyncSessionEngine {
  syncWithConnection(conn: TransportConnection): Promise<SyncSession>;
  handleIncomingConnection(conn: TransportConnection): Promise<SyncSession | void>;
}

export type SyncSessionJobRole = 'initiate' | 'listen';

export interface RunSyncSessionJobOptions {
  /** Relay backend (real WebSocket backend in app, simulated/in-memory in tests). */
  backend: RelayBackend;
  /** Relay WebSocket URL, e.g. ws://host:8787 */
  relayUrl: string;
  /** Rendezvous token already derived from the shared phrase. */
  token: string;
  /** Device id we expect on the other end (Ed25519 pubkey hex). */
  peerDeviceId: string;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
  /** Initiator dials and syncs; listener accepts one inbound session. */
  role: SyncSessionJobRole;
  /** The initialized engine to drive (already pointed at the headless db). */
  engine: SyncSessionEngine;
  /**
   * Adapt a relay session into a TransportConnection. Defaults to
   * connectRelayPeer; injected in tests that wire a connection pair directly.
   */
  connect?: (input: {
    backend: RelayBackend;
    url: string;
    token: string;
    remoteDeviceId: string;
    entitlementToken?: string;
  }) => Promise<TransportConnection>;
  /** Injectable clock for honest timing in tests. Defaults to Date.now. */
  now?: () => number;
}

export interface SyncSessionJobResult {
  /** True only if a connection was established and a session was driven. */
  ran: boolean;
  /** The real recorded session returned by either role. */
  session?: SyncSession;
  /** A connection/transport error, when one occurred. Never hides a failure. */
  error?: string;
}

/**
 * Run one headless sync session over a relay. Mirrors the manual relay path
 * exactly so the manual and background flows cannot drift. Always closes the
 * connection and destroys the backend; returns whatever the engine actually
 * recorded (or the error that stopped it) -- it invents no status of its own.
 */
export async function runSyncSessionJob(
  options: RunSyncSessionJobOptions,
): Promise<SyncSessionJobResult> {
  const connectFn = options.connect ?? defaultConnectRelayPeer;
  const url = options.relayUrl.trim();
  if (!url) return { ran: false, error: 'No relay URL configured.' };
  if (!options.token.trim()) return { ran: false, error: 'No rendezvous token.' };

  let conn: TransportConnection | null = null;
  try {
    conn = await connectFn({
      backend: options.backend,
      url,
      token: options.token,
      remoteDeviceId: options.peerDeviceId,
      entitlementToken: options.entitlementToken,
    });
    if (options.role === 'initiate') {
      const session = await options.engine.syncWithConnection(conn);
      return { ran: true, session };
    }
    const session = await options.engine.handleIncomingConnection(conn);
    return session
      ? { ran: true, session }
      : { ran: true, error: 'Incoming session did not return a recorded outcome.' };
  } catch (error) {
    return {
      ran: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        // closing a half-open connection must not mask the real outcome
      }
    }
    options.backend.destroy();
  }
}

// Lazy import to keep the relay-peer-connection module out of this file's
// static graph (it is RN-safe, but the indirection keeps the job's deps
// fully injectable and the import surface minimal).
async function defaultConnectRelayPeer(input: {
  backend: RelayBackend;
  url: string;
  token: string;
  remoteDeviceId: string;
  entitlementToken?: string;
}): Promise<TransportConnection> {
  const { connectRelayPeer } = await import('../transport/relay-peer-connection');
  return connectRelayPeer(input);
}
