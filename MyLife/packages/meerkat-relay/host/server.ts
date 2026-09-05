/**
 * Host control-panel server (Plan 20, Phase 4.1 + 5.1 + 5.3 + 6.2 + 6.4).
 *
 * A 127.0.0.1-ONLY node:http admin surface that drives the HostSupervisor over
 * the REAL bins, exposes the running services (tunnel / LAN / BYO domain), and
 * surfaces the connection card + QR members adopt. It owns no cryptography: it
 * reuses `@mylife/sync`'s connection-card codec and the tested host/* leaves.
 *
 * HONESTY (load-bearing, encoded not just documented):
 *   - The panel binds 127.0.0.1 ONLY. It is an admin surface, never a public
 *     listener; `listen()` hardcodes the loopback host.
 *   - /api/status counts come ONLY from the real /healthz {ok, connections}
 *     field. The relay publishes a real count; the community node + seeder
 *     publish liveness only, so their count is reported null (never a fabricated
 *     0). No field is ever added to /healthz.
 *   - A service is 'live' ONLY after its real {event:'listening',port} stdout
 *     line arrives (the supervisor enforces this); the panel never reports live
 *     early.
 *   - /api/card returns the MKSERVER1 card + QR ONLY when the relay is live AND
 *     (public exposure verified reachable from a REAL off-host round-trip, OR a
 *     same-network LAN rung honestly labeled same-network). A tunnel/domain URL
 *     is a CANDIDATE until gateReachability === 'reachable'; before that the card
 *     is WITHHELD (never surfaced for a down/unverified URL).
 *   - Public reachability is CURRENT, not a one-time boot fact. A verified
 *     'reachable' is trusted only for a short TTL; past it /api/card lazily
 *     re-runs the off-host probe before deciding. And if the tunnel child EXITS
 *     mid-session the card resets to unverified AT ONCE. A stale 'reachable'
 *     never persists: a silently-dead public URL stops surfacing a card even if
 *     the relay process stays alive. (/api/status never blocks on the re-probe.)
 *   - A desktop host is reachable ONLY while this app is open and the computer is
 *     awake; the card response carries that banner. This companion is not the
 *     always-on first-party node.
 *
 * The spawn, healthz fetch, exposure starter, and reachability verifier are all
 * injectable so the lifecycle is deterministic in tests (no real bins, no
 * internet, sidestepping the sandbox tsx-IO gotcha).
 */

import http from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildHostConnectionCard,
  DEFAULT_HOST_CONFIG,
  loadHostConfig,
  type HostConfig,
} from './host-config';
import {
  HostSupervisor,
  type HostServiceName,
  type ServiceStatus,
  type SpawnFn,
} from './process-supervisor';
import { makeRealSpawn } from './spawn';
import {
  buildServiceSpecs,
  DEFAULT_HOST_DATA_DIR,
  type BuildServiceSpecsDeps,
} from './service-specs';
import { gateReachability, type ReachabilityState } from './reachability';
import { createOffHostProbe, type ProbeFetch } from './off-host-probe';
import { generateDomainConfig } from './domain';
import { startTunnel } from './tunnel';
import { lanDialUrl } from './lan';
import { encodeConnectionCardQr } from './qr';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The loopback host the control panel binds. Never overridable (admin surface). */
export const CONTROL_PANEL_HOST = '127.0.0.1' as const;

/** Reachable-only-while-open banner every card response carries (never always-on). */
export const HOST_LIFECYCLE_BANNER =
  'This server is reachable only while this app is open and the computer is awake. ' +
  'It is not an always-on node.';

/**
 * How long a verified public 'reachable' is trusted before /api/card lazily
 * re-runs the off-host probe. A silently-dead public URL (connectivity dropped,
 * edge stopped forwarding) stops surfacing a card within this window even if the
 * relay process never noticed. Kept short + cheap; the status route never blocks
 * on it. Overridable via {@link HostServerDeps.reachabilityTtlMs} for tests.
 */
export const DEFAULT_REACHABILITY_TTL_MS = 30_000;

// ---------------------------------------------------------------------------
// Health probe (counts ONLY from the real /healthz field)
// ---------------------------------------------------------------------------

/** Honest health snapshot: liveness + the REAL connection count (null when the endpoint omits it). */
export interface HealthProbeResult {
  ok: boolean;
  connections: number | null;
}

/** Probe `/healthz`; connections is a real number only when the body publishes one. */
export type HealthProbe = (url: string) => Promise<HealthProbeResult>;

const realHealthProbe: HealthProbe = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, connections: null };
    const body: unknown = await res.json();
    if (!body || typeof body !== 'object' || (body as { ok?: unknown }).ok !== true) {
      return { ok: false, connections: null };
    }
    const c = (body as { connections?: unknown }).connections;
    return { ok: true, connections: typeof c === 'number' && Number.isFinite(c) ? c : null };
  } catch {
    return { ok: false, connections: null };
  }
};

// ---------------------------------------------------------------------------
// Exposure (tunnel / LAN / domain) -> a CANDIDATE URL until proven reachable
// ---------------------------------------------------------------------------

export interface ExposureCandidate {
  kind: HostConfig['exposure'];
  /** 'public' (tunnel/domain, needs off-host verification) or 'same-network' (LAN). */
  scope: 'public' | 'same-network';
  /** The ws(s):// relay dial URL the connection card would carry. */
  relayUrl: string;
  /** Optional https community-node URL (tunnel can front it too). */
  communityNodeUrl?: string;
  /** Ordered human setup steps (BYO domain). */
  steps?: { title: string; detail: string }[];
  /** Tear the exposure down (kills the tunnel child, etc.). */
  stop?: () => void;
  /**
   * Register a callback fired if the underlying transport DIES mid-session (the
   * tunnel child exits). The server resets a public exposure's reachability to
   * unverified the instant this fires, so the card is withheld at once instead
   * of waiting out the re-verify TTL. Same-network (LAN) exposures have no child
   * and omit this.
   */
  onExit?: (cb: () => void) => void;
}

/** Begin exposing the running relay; returns a CANDIDATE URL (never a verified one). */
export type StartExposureFn = (
  config: HostConfig,
  ctx: { relayPort: number },
) => Promise<ExposureCandidate | null>;

/** Verify a public candidate URL from OFF-HOST. Never called for same-network LAN. */
export type VerifyReachabilityFn = (publicUrl: string) => Promise<ReachabilityState>;

/** Best-effort first non-internal IPv4 for the LAN dial URL (null when none). */
function firstLanIpv4(): string | null {
  const nets = networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export interface HostServerDeps {
  /** Injected spawn for the supervisor. Default {@link makeRealSpawn}. */
  spawn?: SpawnFn;
  /** Injected /healthz probe. Default a real fetch-based probe. */
  healthProbe?: HealthProbe;
  /** Where the on-disk config lives. Default ~/.meerkat-host/config.json. */
  configDir?: string;
  /** Directory of static UI assets. Default host/ui/. */
  uiDir?: string;
  /** Extra spec-builder deps (binDir, dataDir, runner, ...). */
  serviceSpecsDeps?: BuildServiceSpecsDeps;
  /** Injected exposure starter. Default: real tunnel/LAN/domain wiring. */
  startExposure?: StartExposureFn;
  /** Injected reachability verifier. Default: off-host probe -> gateReachability. */
  verifyReachability?: VerifyReachabilityFn;
  /**
   * The deployed external reachability service the default verifier dials. When
   * absent, the default verifier returns 'unverified' (honest: we cannot prove
   * reachability, so the card stays WITHHELD). Founder-ops deploys the endpoint.
   */
  reachabilityServiceUrl?: string;
  /** Injected fetch for the off-host probe (default global fetch). */
  probeFetch?: ProbeFetch;
  /** Per-service start timeout. Default 15s. */
  startTimeoutMs?: number;
  /**
   * How long a verified public reachability result stays fresh before /api/card
   * lazily re-probes off-host. Default {@link DEFAULT_REACHABILITY_TTL_MS} (30s).
   */
  reachabilityTtlMs?: number;
  /** Injected clock (ms epoch) so the re-verify TTL is deterministic in tests. Default Date.now. */
  now?: () => number;
}

export interface BoundAddress {
  host: typeof CONTROL_PANEL_HOST;
  port: number;
}

export interface HostServer {
  /** The underlying node:http server (127.0.0.1 only). */
  readonly httpServer: http.Server;
  /** The supervisor driving the real bins (exposed for tests/introspection). */
  readonly supervisor: HostSupervisor;
  /** Bind to 127.0.0.1 on `port` (0 = ephemeral). Resolves with the bound address. */
  listen(port?: number): Promise<BoundAddress>;
  /** Close the http server AND stop every supervised service + exposure. */
  close(): Promise<void>;
}

interface ExposureRuntime {
  candidate: ExposureCandidate;
  /** Last decided reachability. For public exposures it is only CURRENT within the TTL. */
  reachable: ReachabilityState;
  /** ms epoch of the last reachability decision (verify, LAN start, or exit reset). */
  verifiedAt: number;
  /** In-flight lazy re-verify (public only), so concurrent callers join instead of racing. */
  reverify: Promise<void> | null;
}

export function createHostServer(deps: HostServerDeps = {}): HostServer {
  const configDir = deps.configDir ?? DEFAULT_HOST_DATA_DIR;
  const configPath = join(configDir, 'config.json');
  const uiDir = deps.uiDir ?? join(HERE, 'ui');
  const healthProbe = deps.healthProbe ?? realHealthProbe;
  const startTimeoutMs = deps.startTimeoutMs ?? 15_000;
  const reachabilityTtlMs = deps.reachabilityTtlMs ?? DEFAULT_REACHABILITY_TTL_MS;
  const now = deps.now ?? (() => Date.now());

  let config: HostConfig = loadConfigFromDisk(configPath);
  let exposure: ExposureRuntime | null = null;

  // The supervisor's fetchHealthz adapts our honest probe (counts stay real; the
  // supervisor's number is only used for its own state, the panel reads the map).
  const realConnections = new Map<HostServiceName, number | null>();
  let supervisor: HostSupervisor;
  const fetchHealthz = async (
    url: string,
  ): Promise<{ ok: boolean; connections: number } | null> => {
    const h = await healthProbe(url);
    const port = Number(new URL(url).port);
    const name = supervisor.statuses().find((s) => s.port === port)?.name;
    if (name) realConnections.set(name, h.ok ? h.connections : null);
    return h.ok ? { ok: true, connections: h.connections ?? 0 } : null;
  };
  supervisor = new HostSupervisor({ spawn: deps.spawn ?? makeRealSpawn(), fetchHealthz });

  const startExposure = deps.startExposure ?? defaultStartExposure;
  const verifyReachability = deps.verifyReachability ?? defaultVerifyReachability;

  function defaultVerifyReachability(publicUrl: string): Promise<ReachabilityState> {
    if (!deps.reachabilityServiceUrl) return Promise.resolve('unverified');
    const offHostProbe = createOffHostProbe({
      publicUrl,
      serviceUrl: deps.reachabilityServiceUrl,
      fetchImpl: deps.probeFetch,
    });
    return gateReachability({ publicUrl, offHostProbe }).then((r) => r.state);
  }

  async function defaultStartExposure(
    cfg: HostConfig,
    ctx: { relayPort: number },
  ): Promise<ExposureCandidate | null> {
    if (cfg.exposure === 'tunnel') {
      const handle = startTunnel({ localUrl: `http://127.0.0.1:${ctx.relayPort}` });
      const r = await handle.ready;
      if (!r.ok) return null;
      // A tunnel URL is a CANDIDATE (r.verified === false); the off-host probe
      // proves reachability before any card is surfaced. onExit lets the server
      // drop a live card the instant the tunnel child dies.
      return {
        kind: 'tunnel',
        scope: 'public',
        relayUrl: r.relayUrl,
        stop: handle.stop,
        onExit: (cb) => handle.onExit(cb),
      };
    }
    if (cfg.exposure === 'lan') {
      const ip = firstLanIpv4();
      if (!ip) return null;
      return {
        kind: 'lan',
        scope: 'same-network',
        relayUrl: lanDialUrl({ boundPort: ctx.relayPort, address: ip }),
      };
    }
    // domain: generate the Caddyfile + steps; the wss://<domain> URL is a
    // CANDIDATE only (a provisioned cert is not proof inbound 443 is reachable).
    if (!cfg.domain) return null;
    const dc = generateDomainConfig({ domain: cfg.domain, relayPort: ctx.relayPort });
    return {
      kind: 'domain',
      scope: 'public',
      relayUrl: dc.candidatePublicUrl,
      steps: dc.steps,
    };
  }

  // ----- lifecycle -----

  async function startAll(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const built = buildServiceSpecs(config, deps.serviceSpecsDeps);
    if (!built.ok) return built;
    for (const spec of built.specs) {
      await supervisor.start(spec, { timeoutMs: startTimeoutMs });
    }
    const relay = supervisor.statuses().find((s) => s.name === 'relay');
    if (relay?.state === 'live' && relay.port != null) {
      const candidate = await startExposure(config, { relayPort: relay.port });
      if (candidate) {
        const reachable: ReachabilityState =
          candidate.scope === 'same-network'
            ? 'reachable' // honestly reachable on the LAN (no off-host claim)
            : await verifyReachability(candidate.relayUrl);
        const runtime: ExposureRuntime = {
          candidate,
          reachable,
          verifiedAt: now(),
          reverify: null,
        };
        exposure = runtime;
        // The instant the transport dies (tunnel child exit), a still-live relay
        // is NOT proof the public URL round-trips. Reset to unverified so the
        // card is withheld at once, without waiting out the re-verify TTL.
        candidate.onExit?.(() => {
          if (exposure === runtime) {
            runtime.reachable = 'unverified';
            runtime.verifiedAt = now();
          }
        });
      }
    }
    return { ok: true };
  }

  /**
   * The CURRENT reachability, not the boot-time fact. Same-network stays reachable
   * while the relay runs (no off-host claim). A public 'reachable' is only trusted
   * inside the TTL: past it (or after an exit reset) it reads as unverified, so a
   * stale 'reachable' never surfaces a card.
   */
  function currentReachability(exp: ExposureRuntime): ReachabilityState {
    if (exp.candidate.scope === 'same-network') return exp.reachable;
    if (exp.reachable === 'reachable' && now() - exp.verifiedAt <= reachabilityTtlMs) {
      return 'reachable';
    }
    return 'unverified';
  }

  /**
   * Lazily re-run the off-host probe for a public exposure whose last check aged
   * out of the TTL. Cheap: at most one probe in flight (concurrent callers join),
   * and it is a no-op when fresh, same-network, or unexposed. The status route
   * fires this without awaiting; the card route awaits it before deciding.
   */
  function reverifyIfStale(): Promise<void> {
    const exp = exposure;
    if (!exp || exp.candidate.scope !== 'public') return Promise.resolve();
    if (exp.reverify) return exp.reverify;
    if (now() - exp.verifiedAt <= reachabilityTtlMs) return Promise.resolve();
    const p = (async () => {
      let state: ReachabilityState;
      try {
        state = await verifyReachability(exp.candidate.relayUrl);
      } catch {
        state = 'unverified'; // a throwing probe is not proof of reachability
      }
      if (exposure === exp) {
        exp.reachable = state;
        exp.verifiedAt = now();
      }
    })().finally(() => {
      if (exp.reverify === p) exp.reverify = null;
    });
    exp.reverify = p;
    return p;
  }

  async function stopAll(): Promise<void> {
    supervisor.stopAll();
    exposure?.candidate.stop?.();
    exposure = null;
    realConnections.clear();
  }

  // ----- status / card serialization -----

  async function statusView(): Promise<unknown> {
    // Refresh liveness from the real /healthz for every service with a port.
    await Promise.all(
      supervisor
        .statuses()
        .filter((s) => s.port != null)
        .map((s) => supervisor.checkHealth(s.name)),
    );
    // Keep public reachability current WITHOUT blocking the status route: kick a
    // lazy re-probe when stale (fire-and-forget) and report the stale-downgraded
    // value now. A stale 'reachable' is honestly shown as unverified here too.
    void reverifyIfStale();
    const services = supervisor.statuses().map((s: ServiceStatus) => ({
      name: s.name,
      state: s.state,
      port: s.port,
      // Real count from /healthz for services that publish it (the relay); null
      // for the community node + seeder, which publish liveness only.
      connections: realConnections.has(s.name) ? realConnections.get(s.name)! : s.connections,
      error: s.error,
    }));
    return {
      services,
      exposure: exposure
        ? {
            kind: exposure.candidate.kind,
            scope: exposure.candidate.scope,
            candidateUrl: exposure.candidate.relayUrl,
            reachable: currentReachability(exposure),
            steps: exposure.candidate.steps,
          }
        : null,
      config,
      lifecycle: HOST_LIFECYCLE_BANNER,
    };
  }

  async function cardView(): Promise<unknown> {
    const relay = supervisor.statuses().find((s) => s.name === 'relay');
    if (!relay || relay.state !== 'live') {
      return { available: false, state: 'relay-down', reason: 'The relay is not live yet.', lifecycle: HOST_LIFECYCLE_BANNER };
    }
    if (!exposure) {
      return { available: false, state: 'unexposed', reason: 'No exposure is running yet.', lifecycle: HOST_LIFECYCLE_BANNER };
    }
    // Re-verify a public exposure whose last off-host check aged out before we
    // decide, so a silently-dead URL cannot ride a stale 'reachable' into a card.
    await reverifyIfStale();
    if (!exposure) {
      return { available: false, state: 'unexposed', reason: 'No exposure is running yet.', lifecycle: HOST_LIFECYCLE_BANNER };
    }
    // Public exposure MUST be CURRENTLY verified reachable from a real off-host
    // round-trip before ANY card/QR is surfaced (the L3 false-positive trap). A
    // stale/reset 'reachable' reads as unverified -- withhold the card entirely,
    // surface only the candidate URL as unverified.
    if (exposure.candidate.scope === 'public' && currentReachability(exposure) !== 'reachable') {
      return {
        available: false,
        state: 'unverified',
        reason:
          'The public address is not yet verified reachable from off-host. ' +
          'A tunnel/cert printing a URL is not proof of reachability.',
        candidateUrl: exposure.candidate.relayUrl,
        steps: exposure.candidate.steps,
        lifecycle: HOST_LIFECYCLE_BANNER,
      };
    }
    // relay live AND (public verified reachable) OR (same-network LAN rung).
    const card = buildHostConnectionCard({
      relayUrl: exposure.candidate.relayUrl,
      communityNodeUrl: exposure.candidate.communityNodeUrl,
    });
    const qr = encodeConnectionCardQr(card);
    return {
      available: true,
      scope: exposure.candidate.scope,
      card,
      qr: { svg: qr.svg, version: qr.version, size: qr.size },
      lifecycle: HOST_LIFECYCLE_BANNER,
    };
  }

  // ----- HTTP routing -----

  const httpServer = http.createServer((req, res) => {
    void handle(req, res).catch((err) => {
      sendJson(res, 500, { ok: false, reason: err instanceof Error ? err.message : String(err) });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = (req.url ?? '/').split('?')[0];

    if (method === 'GET' && url === '/api/status') {
      sendJson(res, 200, await statusView());
      return;
    }
    if (method === 'POST' && url === '/api/start') {
      const result = await startAll();
      if (!result.ok) {
        sendJson(res, 400, { ok: false, reason: result.reason });
        return;
      }
      sendJson(res, 200, await statusView());
      return;
    }
    if (method === 'POST' && url === '/api/stop') {
      await stopAll();
      sendJson(res, 200, await statusView());
      return;
    }
    if (method === 'POST' && url === '/api/config') {
      const raw = await readBody(req);
      const parsed = loadHostConfig(raw);
      if (!parsed.ok) {
        sendJson(res, 400, { ok: false, reason: parsed.reason });
        return;
      }
      config = parsed.config;
      persistConfig(configPath, config);
      sendJson(res, 200, { ok: true, config });
      return;
    }
    if (method === 'GET' && url === '/api/card') {
      sendJson(res, 200, await cardView());
      return;
    }

    // Static UI assets (the wizard/dashboard HTML/JS lands in the next wave).
    if (method === 'GET') {
      serveStatic(uiDir, url, res);
      return;
    }

    sendJson(res, 404, { ok: false, reason: 'not found' });
  }

  return {
    httpServer,
    get supervisor() {
      return supervisor;
    },
    listen(port = 0): Promise<BoundAddress> {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        // 127.0.0.1 ONLY: an admin surface, never a public listener.
        httpServer.listen(port, CONTROL_PANEL_HOST, () => {
          const addr = httpServer.address();
          const boundPort = typeof addr === 'object' && addr ? addr.port : port;
          httpServer.off('error', reject);
          resolve({ host: CONTROL_PANEL_HOST, port: boundPort });
        });
      });
    },
    async close(): Promise<void> {
      await stopAll();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function loadConfigFromDisk(configPath: string): HostConfig {
  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = loadHostConfig(raw);
    if (parsed.ok) return parsed.config;
  } catch {
    // no config yet -> default
  }
  return DEFAULT_HOST_CONFIG;
}

function persistConfig(configPath: string, config: HostConfig): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 256 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(json);
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(uiDir: string, urlPath: string, res: http.ServerResponse): void {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  // Path-traversal guard: resolve under uiDir and refuse anything that escapes.
  const resolved = normalize(join(uiDir, rel));
  if (resolved !== uiDir && !resolved.startsWith(uiDir + sep)) {
    sendJson(res, 403, { ok: false, reason: 'forbidden' });
    return;
  }
  try {
    const data = readFileSync(resolved);
    const ext = resolved.slice(resolved.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { ok: false, reason: 'not found' });
  }
}
