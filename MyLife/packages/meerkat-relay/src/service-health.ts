/**
 * SHARED OBSERVABILITY SURFACE for the stateful Meerkat services (Plan 44 WP-4A).
 *
 * Two independent, self-contained pieces with NO runtime dependencies beyond
 * node:http (the Prometheus format is trivial; a client library would only widen
 * the supply chain we are hardening):
 *
 *   1. createHealthEndpoints({ service, checks }) -> `/livez` + `/readyz` handlers.
 *      `/livez` proves the process is up and the event loop is responsive.
 *      `/readyz` runs each registered dependency check under a bounded timeout and
 *      reports an HONEST per-dependency verdict. A check reports only `{ name, ok,
 *      detailClass }`; NEVER a free-form string, identity, address, or token.
 *      Overall ready is the AND of every REQUIRED check for this service's mode.
 *
 *   2. createMetricsRegistry() + startMetricsListener() -> an opt-in private
 *      Prometheus text endpoint. Counters and gauges carry STATIC label sets only
 *      (service, store, outcome class); a label value is never an identity, token,
 *      pubkey, tenant/publication/community id, content hash, URL, or free-form
 *      string. A per-tenant counter would be a metadata leak, so callers aggregate.
 *
 * The relay (src/server.ts) is deliberately NOT a consumer: its two-field
 * `/healthz` is the entire zero-knowledge surface and stays untouched.
 */

import http from 'node:http';

/**
 * The bounded set of readiness detail classes. A detail class is a fixed enum, not
 * a message: it says WHAT is wrong in a machine-readable way without ever carrying a
 * connection string, a schema version query result, an object key, or an error text.
 */
export type ReadinessDetailClass =
  | 'ok'
  | 'unavailable' // the dependency answered that it is not usable
  | 'timeout' // the check did not resolve within its bounded budget
  | 'faulted' // the check threw; the error text is deliberately discarded
  | 'not_configured'; // an OPTIONAL dependency is absent (never fails a required AND)

export interface ReadinessProbeResult {
  ok: boolean;
  detailClass: ReadinessDetailClass;
}

export interface ReadinessCheck {
  /** Static, non-identifying dependency name, e.g. 'postgres', 'object_store'. */
  name: string;
  /**
   * Whether a false result fails overall readiness. Optional dependencies (a
   * humanity verifier that is honestly OFF) report their state but never gate.
   */
  required: boolean;
  /** Per-check timeout budget in ms. Falls back to the endpoint default. */
  timeoutMs?: number;
  /**
   * The bounded probe. MUST resolve a machine-readable class only. It must never
   * return, log, or throw a value that carries an identity, token, address, or
   * free-form detail; a throw is caught and reported as `faulted` with no text.
   */
  probe: () => Promise<ReadinessProbeResult> | ReadinessProbeResult;
}

export interface ReadinessCheckReport {
  name: string;
  ok: boolean;
  detailClass: ReadinessDetailClass;
}

export interface ReadinessReport {
  ready: boolean;
  checks: ReadinessCheckReport[];
}

export interface CreateHealthEndpointsOptions {
  /** Static service label, e.g. 'community', 'persona'. Used in the livez body. */
  service: string;
  checks: readonly ReadinessCheck[];
  /** Default per-check timeout budget (ms). Clamped to [10, 30_000]. */
  defaultTimeoutMs?: number;
  now?: () => number;
}

export interface HealthEndpoints {
  /** Compute the readiness report (used by tests and the readyz handler). */
  evaluateReadiness(): Promise<ReadinessReport>;
  /**
   * Try to answer `/livez` or `/readyz` for the given request. Returns true when it
   * handled the request (wrote a response); false when the path is not a health
   * path, so the caller's own router can take over.
   */
  handle(req: http.IncomingMessage, res: http.ServerResponse): boolean;
}

const LIVEZ_PATH = '/livez';
const READYZ_PATH = '/readyz';

function clampTimeout(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(30_000, Math.max(10, Math.floor(value)));
}

async function runProbe(check: ReadinessCheck, timeoutMs: number): Promise<ReadinessProbeResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ReadinessProbeResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, detailClass: 'timeout' }), timeoutMs);
    timer.unref?.();
  });
  try {
    const result = await Promise.race([Promise.resolve().then(() => check.probe()), timeout]);
    return result;
  } catch {
    // The error text is intentionally discarded: a thrown detail could carry a
    // connection string or an identity. Only the machine-readable class escapes.
    return { ok: false, detailClass: 'faulted' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

export function createHealthEndpoints(options: CreateHealthEndpointsOptions): HealthEndpoints {
  const defaultTimeoutMs = clampTimeout(options.defaultTimeoutMs, 2_000);
  const now = options.now ?? (() => Date.now());
  const checks = [...options.checks];

  async function evaluateReadiness(): Promise<ReadinessReport> {
    const reports = await Promise.all(
      checks.map(async (check): Promise<{ report: ReadinessCheckReport; required: boolean }> => {
        const budget = clampTimeout(check.timeoutMs, defaultTimeoutMs);
        const result = await runProbe(check, budget);
        return {
          required: check.required,
          report: { name: check.name, ok: result.ok, detailClass: result.detailClass },
        };
      }),
    );
    // Overall ready is the AND of every REQUIRED check. An optional dependency that
    // is not_configured (or otherwise down) is surfaced but never blocks readiness.
    const ready = reports.every((entry) => !entry.required || entry.report.ok);
    return { ready, checks: reports.map((entry) => entry.report) };
  }

  function handle(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const method = req.method ?? 'GET';
    const pathname = (req.url ?? '/').split('?')[0];

    if (pathname === LIVEZ_PATH) {
      if (method !== 'GET') {
        writeJson(res, 405, { ok: false });
        return true;
      }
      // Liveness is intentionally dependency-free: a healthy event loop returning
      // 200 is the whole signal. `now()` proves we can execute and read the clock.
      writeJson(res, 200, { ok: true, service: options.service, at: now() });
      return true;
    }

    if (pathname === READYZ_PATH) {
      if (method !== 'GET') {
        writeJson(res, 405, { ok: false });
        return true;
      }
      void evaluateReadiness()
        .then((report) => writeJson(res, report.ready ? 200 : 503, report))
        .catch(() => {
          if (!res.headersSent) writeJson(res, 503, { ready: false, checks: [] });
        });
      return true;
    }

    return false;
  }

  return { evaluateReadiness, handle };
}

// ---------------------------------------------------------------------------
// Prometheus text exposition (hand-rolled; static labels only).
// ---------------------------------------------------------------------------

export type MetricLabels = Readonly<Record<string, string>>;

/** Prometheus metric/label name rule. Enforced so we never emit invalid output. */
const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertMetricName(name: string): void {
  if (!METRIC_NAME.test(name)) throw new Error(`invalid metric name: ${name}`);
}

function assertLabels(labels: MetricLabels): void {
  for (const key of Object.keys(labels)) {
    if (!LABEL_NAME.test(key)) throw new Error(`invalid label name: ${key}`);
  }
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function serializeLabels(labels: MetricLabels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  const inner = keys.map((key) => `${key}="${escapeLabelValue(labels[key] ?? '')}"`).join(',');
  return `{${inner}}`;
}

function labelKey(labels: MetricLabels): string {
  return serializeLabels(labels);
}

interface MetricSample {
  labels: MetricLabels;
  value: number;
}

interface MetricFamily {
  name: string;
  help: string;
  type: 'counter' | 'gauge';
  samples: Map<string, MetricSample>;
}

export interface Counter {
  /** Increment the series for the given static labels (default step 1). */
  inc(labels?: MetricLabels, amount?: number): void;
}

export interface Gauge {
  /** Set the series for the given static labels to an absolute value. */
  set(labels: MetricLabels, value: number): void;
  /** Convenience: set with no labels. */
  setValue(value: number): void;
}

export interface MetricsRegistry {
  counter(name: string, help: string): Counter;
  gauge(name: string, help: string): Gauge;
  /**
   * Register a gauge whose value is pulled lazily at render time from a callback.
   * Used for pool/queue depths that are cheap to read on demand and would be stale
   * if pushed. The callback returns (or resolves) a list of {labels, value} samples;
   * an async callback lets a service surface a store's own async `stats()`.
   */
  collect(
    name: string,
    help: string,
    collector: () =>
      | Array<{ labels?: MetricLabels; value: number }>
      | Promise<Array<{ labels?: MetricLabels; value: number }>>,
  ): void;
  render(): Promise<string>;
}

export function createMetricsRegistry(): MetricsRegistry {
  const families = new Map<string, MetricFamily>();
  const collectors = new Map<
    string,
    {
      help: string;
      run: () =>
        | Array<{ labels?: MetricLabels; value: number }>
        | Promise<Array<{ labels?: MetricLabels; value: number }>>;
    }
  >();

  function family(name: string, help: string, type: 'counter' | 'gauge'): MetricFamily {
    assertMetricName(name);
    const existing = families.get(name);
    if (existing) {
      if (existing.type !== type) throw new Error(`metric ${name} redeclared with a different type`);
      return existing;
    }
    const created: MetricFamily = { name, help, type, samples: new Map() };
    families.set(name, created);
    return created;
  }

  function counter(name: string, help: string): Counter {
    const fam = family(name, help, 'counter');
    return {
      inc(labels: MetricLabels = {}, amount = 1): void {
        assertLabels(labels);
        if (!Number.isFinite(amount) || amount < 0) return;
        const key = labelKey(labels);
        const sample = fam.samples.get(key);
        if (sample) sample.value += amount;
        else fam.samples.set(key, { labels, value: amount });
      },
    };
  }

  function gauge(name: string, help: string): Gauge {
    const fam = family(name, help, 'gauge');
    const write = (labels: MetricLabels, value: number): void => {
      assertLabels(labels);
      if (!Number.isFinite(value)) return;
      fam.samples.set(labelKey(labels), { labels, value });
    };
    return {
      set: write,
      setValue: (value: number) => write({}, value),
    };
  }

  function collect(
    name: string,
    help: string,
    collector: () =>
      | Array<{ labels?: MetricLabels; value: number }>
      | Promise<Array<{ labels?: MetricLabels; value: number }>>,
  ): void {
    assertMetricName(name);
    if (families.has(name) || collectors.has(name)) {
      throw new Error(`metric ${name} redeclared`);
    }
    collectors.set(name, { help, run: collector });
  }

  async function render(): Promise<string> {
    const lines: string[] = [];
    const emit = (name: string, help: string, type: 'gauge' | 'counter', samples: MetricSample[]): void => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      const ordered = [...samples].sort((a, b) => labelKey(a.labels).localeCompare(labelKey(b.labels)));
      for (const sample of ordered) {
        lines.push(`${name}${serializeLabels(sample.labels)} ${sample.value}`);
      }
    };

    for (const fam of families.values()) {
      emit(fam.name, fam.help, fam.type, [...fam.samples.values()]);
    }
    for (const [name, entry] of collectors) {
      let collected: Array<{ labels?: MetricLabels; value: number }> = [];
      try {
        collected = await entry.run();
      } catch {
        // A collector that throws contributes nothing rather than 500-ing the scrape.
        collected = [];
      }
      const samples: MetricSample[] = [];
      for (const item of collected) {
        const labels = item.labels ?? {};
        assertLabels(labels);
        if (Number.isFinite(item.value)) samples.push({ labels, value: item.value });
      }
      emit(name, entry.help, 'gauge', samples);
    }
    return lines.join('\n') + '\n';
  }

  return { counter, gauge, collect, render };
}

export interface MetricsListener {
  host: string;
  port: number;
  close(): Promise<void>;
}

export interface MetricsListenerConfig {
  host: string;
  port: number;
}

/**
 * Resolve the OPT-IN private metrics listener config. Metrics are OFF unless
 * MEERKAT_METRICS_PORT is set to a valid port; there is no implicit listener. The
 * host defaults to loopback (127.0.0.1) and MUST NOT be the public service port.
 * Returns null when metrics are disabled (the caller states 'disabled' in its ready
 * log). Returns a config otherwise. Throws on a malformed explicit port.
 */
export function resolveMetricsListenerConfig(env: NodeJS.ProcessEnv): MetricsListenerConfig | null {
  const rawPort = (env.MEERKAT_METRICS_PORT ?? '').trim();
  if (!rawPort) return null;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('MEERKAT_METRICS_PORT must be an integer port between 1 and 65535');
  }
  const host = (env.MEERKAT_METRICS_HOST ?? '').trim() || '127.0.0.1';
  return { host, port };
}

const METRICS_PATH = '/metrics';

/**
 * Start the private Prometheus listener. It serves ONLY GET /metrics and binds the
 * given host (loopback by default) on a port that is NEVER the public service port.
 * Optionally also answers /livez + /readyz on the same private listener so an
 * operator or a compose healthcheck can reach readiness without touching the public
 * port. Resolves once listening.
 */
export function startMetricsListener(options: {
  registry: MetricsRegistry;
  config: MetricsListenerConfig;
  health?: HealthEndpoints;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}): Promise<MetricsListener> {
  const { registry, config } = options;
  const log = options.log ?? (() => {});

  const server = http.createServer((req, res) => {
    const method = req.method ?? 'GET';
    const pathname = (req.url ?? '/').split('?')[0];
    if (options.health && options.health.handle(req, res)) return;
    if (pathname === METRICS_PATH) {
      if (method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      void registry
        .render()
        .then((body) => {
          res.writeHead(200, {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Content-Length': Buffer.byteLength(body),
            'Cache-Control': 'no-store',
          });
          res.end(body);
        })
        .catch(() => {
          if (!res.headersSent) res.writeHead(500).end();
        });
      return;
    }
    res.writeHead(404).end();
  });

  return new Promise<MetricsListener>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : config.port;
      log('metrics_listening', { host: config.host, port });
      resolve({
        host: config.host,
        port,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(config.port, config.host);
  });
}

// ---------------------------------------------------------------------------
// Reusable dependency probes (bounded, non-identifying).
// ---------------------------------------------------------------------------

/** Minimal shape of a pg.Pool needed for a bounded readiness probe. */
export interface ReadinessPoolLike {
  query(sql: string): Promise<unknown>;
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
  ended?: boolean;
}

/**
 * PostgreSQL readiness probe: a bounded `SELECT 1`. A closed or unreachable pool
 * rejects, which the caller's timeout/faulted classing captures. No query result,
 * schema version, or connection detail is surfaced.
 */
export function postgresReadyProbe(pool: ReadinessPoolLike): () => Promise<ReadinessProbeResult> {
  return async () => {
    try {
      await pool.query('SELECT 1');
      return { ok: true, detailClass: 'ok' };
    } catch {
      return { ok: false, detailClass: 'unavailable' };
    }
  };
}

/** Minimal object-store shape for a bounded availability probe. */
export interface ReadinessObjectStoreLike {
  observe(key: string): Promise<unknown>;
}

/**
 * Object-store readiness probe: a bounded `observe` of a fixed, non-existent probe
 * key. A reachable store resolves (null for the absent key); an unavailable store
 * throws. The key is a constant, never a real object identity.
 */
export function objectStoreReadyProbe(
  store: ReadinessObjectStoreLike,
  probeKey = 'readyz/probe',
): () => Promise<ReadinessProbeResult> {
  return async () => {
    try {
      await store.observe(probeKey);
      return { ok: true, detailClass: 'ok' };
    } catch {
      return { ok: false, detailClass: 'unavailable' };
    }
  };
}

import { promises as fsPromises, constants as fsConstants } from 'node:fs';

/**
 * File-mode readiness probe: the data directory is writable. Uses fs.access(W_OK).
 * The path itself is never surfaced; only ok/unavailable escapes.
 */
export function dataDirWritableProbe(dataDir: string): () => Promise<ReadinessProbeResult> {
  return async () => {
    try {
      await fsPromises.access(dataDir, fsConstants.W_OK);
      return { ok: true, detailClass: 'ok' };
    } catch {
      return { ok: false, detailClass: 'unavailable' };
    }
  };
}
