/**
 * The Meerkat relay WebSocket server.
 *
 * Thin bridge from `ws` sockets to RelayHub. Enforces hello-first, frame size,
 * and heartbeat liveness. Forwards ciphertext only. Logs counts and errors,
 * never envelope contents.
 */

import http from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { RelayHub, type RelayHubOptions } from './hub';
import { RELAY_LIMITS, parseClientFrame, resolveRelayLimits, type RelayLimits, type ServerFrame } from './protocol';
import { deriveClientAddress } from './client-address';

// Re-exported so embedders reach the env-cap resolver from the same module as
// startRelayServer (Plan 20, Phase 2). The slim bin does not import it: it runs
// startRelayServer, which reads process.env itself when no limits are injected.
export { resolveRelayLimits } from './protocol';
// Re-exported so the SLIM production entrypoint (bin/meerkat-relay-server.mjs)
// can reach the orphan watchdog through the one import the Dockerfile rewrites
// to '../dist/server.js'. It deliberately does NOT go through the src/index.ts
// barrel, which would drag the seeder and hosted node into the slim image.
export { installOrphanWatchdog } from './orphan-watchdog';
export type { OrphanWatchdogEvent } from './orphan-watchdog';
export type { RelayLimits } from './protocol';

export type RelayHostedEntitlementFailureReason =
  | 'missing'
  | 'malformed'
  | 'wrong_app'
  | 'inactive'
  | 'missing_feature'
  | 'expired'
  | 'revoked'
  | 'invalid_signature';

export type RelayHostedEntitlementCheck =
  | { ok: true }
  | { ok: false; reason: RelayHostedEntitlementFailureReason };

export interface RelayHostedEntitlementVerificationOptions {
  appId?: string;
  revokedSignatures?: readonly string[];
  isRevoked?: (signature: string) => boolean | Promise<boolean>;
}

export interface RelayHostedEntitlementOptions extends RelayHostedEntitlementVerificationOptions {
  /** Disabled by default so self-host relays remain open. */
  required?: boolean;
  /** Required when `required` is true. */
  secret?: string;
  /** Defaults to meerkat:hosted-relay. */
  feature?: string;
  /** Injectable clock for tests. */
  nowMs?: () => number;
}

export interface RelayServerOptions extends RelayHubOptions {
  port?: number;
  host?: string;
  /** Heartbeat interval; connections that miss a pong are dropped. */
  heartbeatMs?: number;
  /** Mailbox sweep interval. */
  sweepMs?: number;
  /** Optional structured logger. Never receives envelope contents. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
  /** Opt-in hosted entitlement gate for first-party relay deployments. */
  hostedEntitlement?: RelayHostedEntitlementOptions;
  /** Exact number of reverse-proxy hops controlled by this deployment. */
  trustedProxyHops?: number;
}

export interface RelayServer {
  readonly hub: RelayHub;
  readonly port: number;
  close(): Promise<void>;
}

interface HostedEntitlementModule {
  MEERKAT_HOSTED_RELAY_FEATURE: string;
  verifyHostedFeatureEntitlement(
    token: string | null | undefined,
    secret: string,
    feature: string,
    options?: RelayHostedEntitlementVerificationOptions & { nowMs?: number },
  ): Promise<RelayHostedEntitlementCheck>;
}

const HOSTED_ENTITLEMENTS_MODULE = '@mylife/entitlements/server';
let hostedEntitlementModule: Promise<HostedEntitlementModule> | null = null;
let connSeq = 0;

interface LiveSocket extends WebSocket {
  _connId?: string;
  _joined?: boolean;
  _alive?: boolean;
  _messageQueue?: Promise<void>;
  /** Client IP, used by the hub for per-client rate + admission limits. */
  _clientKey?: string;
}

function isHostedEntitlementModule(value: unknown): value is HostedEntitlementModule {
  const candidate = value as Partial<HostedEntitlementModule>;
  return (
    typeof candidate.MEERKAT_HOSTED_RELAY_FEATURE === 'string'
    && typeof candidate.verifyHostedFeatureEntitlement === 'function'
  );
}

async function importHostedEntitlementModule(): Promise<HostedEntitlementModule> {
  const loaded = await import(HOSTED_ENTITLEMENTS_MODULE) as unknown;
  if (!isHostedEntitlementModule(loaded)) {
    throw new Error('Hosted entitlement verifier module has an invalid shape.');
  }
  return loaded;
}

function loadHostedEntitlementModule(): Promise<HostedEntitlementModule> {
  hostedEntitlementModule ??= importHostedEntitlementModule();
  return hostedEntitlementModule;
}

/**
 * Start a relay server. Resolves once it is listening.
 */
export function startRelayServer(options: RelayServerOptions = {}): Promise<RelayServer> {
  const log = options.log ?? (() => {});
  // Resolve the effective fair-use caps ONCE (Plan 20, Phase 2). Explicit
  // options.limits (tests, embedders) win and are trusted as-is; otherwise read
  // the CLAMPED env overrides -- the slim bin runs in an env that may carry
  // RELAY_* caps, so this is how a deployment tunes per-IP budgets without a code
  // edit. Unset env reproduces today's RELAY_LIMITS exactly.
  const limits: RelayLimits = options.limits
    ? { ...RELAY_LIMITS, ...options.limits }
    : resolveRelayLimits(process.env);
  const hub = new RelayHub({ ...options, limits });
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  const sweepMs = options.sweepMs ?? 60_000;
  const trustedProxyHops = Number.isFinite(options.trustedProxyHops)
    ? Math.max(0, Math.floor(options.trustedProxyHops ?? 0))
    : 0;
  // Operational caps only (counts, never envelopes/tokens/IPs); lets ops confirm
  // env overrides actually applied.
  log('limits', {
    maxConnections: limits.maxConnections,
    maxConnectionsPerClient: limits.maxConnectionsPerClient,
    maxPeersPerToken: limits.maxPeersPerToken,
    rateMaxPerWindow: limits.rateMaxPerWindow,
    rateWindowMs: limits.rateWindowMs,
    rendezvousMaxPerWindow: limits.rendezvousMaxPerWindow,
    mailboxMax: limits.mailboxMax,
    mailboxTtlMs: limits.mailboxTtlMs,
  });

  // Host the WS server on an HTTP server so we can also answer GET /healthz --
  // the cheap target latency-based relay selection probes (MK-036). Plain GETs
  // hit this handler; WebSocket upgrades go to the attached WSS untouched.
  const httpServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      // Expose only what the relay selector consumes (MK-036): liveness + a
      // coarse load signal. The token-group count was gratuitous metadata and
      // is no longer published.
      const stats = hub.stats();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        // The web client probes this bounded, public liveness endpoint from a
        // different origin before it opens a WebSocket. No credentials or
        // tenant data are accepted here, so a wildcard is the correct policy.
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ ok: true, connections: stats.connections }));
      return;
    }
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('meerkat-relay: WebSocket only');
  });

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: limits.maxFrameBytes,
  });
  // The hub enforces the global + per-client connection caps (with proper err
  // frames) on join; this ws-layer guard rejects sockets that connect but never
  // hello, before they can accumulate.
  let liveSockets = 0;

  function send(socket: WebSocket, frame: ServerFrame): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame));
    }
  }

  async function verifyHostedAccess(socket: WebSocket, entitlement?: string): Promise<boolean> {
    const hosted = options.hostedEntitlement;
    if (!hosted?.required) return true;
    if (!hosted.secret) {
      send(socket, {
        t: 'err',
        code: 'entitlement_invalid',
        msg: 'hosted entitlement secret is not configured',
      });
      return false;
    }
    let verifier: HostedEntitlementModule;
    try {
      verifier = await loadHostedEntitlementModule();
    } catch {
      send(socket, {
        t: 'err',
        code: 'entitlement_invalid',
        msg: 'hosted entitlement verifier is not available',
      });
      return false;
    }
    const verdict = await verifier.verifyHostedFeatureEntitlement(
      entitlement,
      hosted.secret,
      hosted.feature ?? verifier.MEERKAT_HOSTED_RELAY_FEATURE,
      {
        appId: hosted.appId,
        nowMs: hosted.nowMs?.(),
        revokedSignatures: hosted.revokedSignatures,
        isRevoked: hosted.isRevoked,
      },
    );
    if (verdict.ok === true) return true;
    send(socket, {
      t: 'err',
      code: verdict.reason === 'missing' ? 'entitlement_required' : 'entitlement_invalid',
      msg: 'valid hosted entitlement required',
    });
    return false;
  }

  wss.on('connection', (socket: LiveSocket, req) => {
    // Reject sockets beyond the global cap before they can accumulate (covers
    // connect-but-never-hello floods the hub does not yet see).
    if (liveSockets >= limits.maxConnections) {
      try { send(socket, { t: 'err', code: 'server_full', msg: 'relay at capacity' }); } catch { /* ignore */ }
      socket.close(1013, 'server full');
      return;
    }
    liveSockets++;
    socket._connId = `c${++connSeq}`;
    socket._joined = false;
    socket._alive = true;
    // Caller-controlled forwarding headers are ignored unless this deployment
    // explicitly declares the number of proxy hops it controls.
    socket._clientKey = deriveClientAddress(req, trustedProxyHops, socket._connId);

    socket.on('pong', () => {
      socket._alive = true;
    });

    async function handleMessage(raw: RawData): Promise<void> {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const frame = parseClientFrame(text);
      if (!frame) {
        send(socket, { t: 'err', code: 'bad_frame', msg: 'malformed frame' });
        return;
      }

      if (frame.t === 'hello') {
        if (socket._joined) {
          send(socket, { t: 'err', code: 'already_joined', msg: 'already joined' });
          return;
        }
        if (!await verifyHostedAccess(socket, frame.entitlement)) return;
        const ok = hub.join(socket._connId!, frame.token, (f) => send(socket, f), socket._clientKey);
        if (ok) {
          socket._joined = true;
          log('join', { conn: socket._connId });
        }
        return;
      }

      if (frame.t === 'env') {
        if (!socket._joined) {
          send(socket, { t: 'err', code: 'not_joined', msg: 'send hello first' });
          return;
        }
        // env is opaque: forwarded verbatim, never decoded or logged.
        hub.relay(socket._connId!, frame.env);
        return;
      }

      if (frame.t === 'pub') {
        // Rendezvous publish (MK-016): rec is opaque, stored verbatim, never logged.
        if (!await verifyHostedAccess(socket, frame.entitlement)) return;
        hub.publish(socket._connId!, frame.rid, frame.rec, (f) => send(socket, f), frame.ttlMs, socket._clientKey);
        return;
      }

      if (frame.t === 'res') {
        if (!await verifyHostedAccess(socket, frame.entitlement)) return;
        hub.resolve(socket._connId!, frame.rid, (f) => send(socket, f), socket._clientKey);
        return;
      }

      if (frame.t === 'ann') {
        // Content-host registry announce: rec is opaque, stored verbatim, never logged.
        if (!await verifyHostedAccess(socket, frame.entitlement)) return;
        hub.announce(socket._connId!, frame.rid, frame.rec, (f) => send(socket, f), frame.ttlMs, socket._clientKey);
        return;
      }

      if (frame.t === 'lk') {
        if (!await verifyHostedAccess(socket, frame.entitlement)) return;
        hub.lookup(socket._connId!, frame.rid, (f) => send(socket, f), socket._clientKey);
        return;
      }

      if (frame.t === 'bye') {
        socket.close(1000, 'bye');
      }
    }

    socket._messageQueue = Promise.resolve();
    socket.on('message', (raw: RawData) => {
      socket._messageQueue = socket._messageQueue
        ?.then(() => handleMessage(raw))
        .catch(() => {
          send(socket, { t: 'err', code: 'bad_frame', msg: 'failed to handle frame' });
        });
    });

    socket.on('close', () => {
      liveSockets--;
      hub.leave(socket._connId!);
      log('leave', { conn: socket._connId });
    });

    socket.on('error', () => {
      hub.leave(socket._connId!);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const s = client as LiveSocket;
      if (s._alive === false) {
        s.terminate();
        continue;
      }
      s._alive = false;
      s.ping();
    }
  }, heartbeatMs);
  heartbeat.unref?.();

  const sweepTimer = setInterval(() => hub.sweep(), sweepMs);
  sweepTimer.unref?.();

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port ?? 0, options.host, () => {
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      log('listening', { port });
      resolve({
        hub,
        port,
        close: () =>
          new Promise<void>((res) => {
            clearInterval(heartbeat);
            clearInterval(sweepTimer);
            for (const client of wss.clients) client.terminate();
            wss.close(() => httpServer.close(() => res()));
          }),
      });
    });
  });
}
