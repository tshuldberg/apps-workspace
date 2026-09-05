// MyNews edge observability: one structured JSON line per request, emitted by
// every mynews-* function (plan 48 WP11, audit findings C11/C13).
//
// Why a MyNews-specific module rather than _shared/observability.ts: that file is
// BestChef's error-capture sink (`service: 'bestchef-edge'`, error paths only,
// optional Sentry forwarding). WP11 needs request-scoped success AND failure
// telemetry with duration, action, and outcome, on a MyNews service tag. The two
// coexist; nothing here forwards to a third party.
//
// PRIVACY CONTRACT (enforced by a canary test, not just by review):
//   * The line carries a fixed, closed set of fields. Nothing is spread in from
//     a request, a header, a body, or a database row.
//   * `extra` values must be numbers or booleans. Free-form strings are the way
//     PII leaks into logs, so the type system and a runtime scrub both refuse
//     them.
//   * Identity appears only as `subjectHash`: SHA-256 over the JWT subject,
//     truncated to 16 hex chars. It correlates one user's requests across
//     functions without storing the user id, and the preimage (a v4 UUID) is not
//     enumerable.
//   * No email, no token, no request body, no IP, no user agent, no URL query.
//     The request path is NOT logged either: MyNews function URLs can carry
//     handles and slugs.
//
// Outcome tagging: `tagLogOutcome` stamps the typed envelope code onto the
// Response object via a non-enumerable Symbol property. The serialized response
// bytes, status, and headers are untouched, so adding telemetry cannot change
// what a client sees.

/** Symbol-keyed outcome tag. Non-enumerable, so it never serializes. */
const OUTCOME_TAG = Symbol.for('mylife.mynews.logOutcome');

/**
 * Stamp the typed outcome code (the envelope's `error` string, or 'ok') onto a
 * Response. Returns the same Response so call sites stay one-liners.
 */
export function tagLogOutcome<T extends Response>(response: T, outcome: string): T {
  try {
    Object.defineProperty(response, OUTCOME_TAG, {
      value: outcome,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } catch {
    // A frozen Response would be unusual; telemetry must never break a response.
  }
  return response;
}

/** Read a tagged outcome, falling back to a status-derived label. */
export function readLogOutcome(response: Response): string {
  const tagged = (response as unknown as Record<symbol, unknown>)[OUTCOME_TAG];
  if (typeof tagged === 'string' && tagged.length > 0) return tagged;
  return response.ok ? 'ok' : `http-${response.status}`;
}

/**
 * Per-request log annotations a handler can attach. Keyed by the Request object
 * in a WeakMap, so concurrent requests never share state and nothing is retained
 * after the request is collected.
 */
interface RequestAnnotation {
  action?: string;
  extra?: Record<string, number | boolean>;
}

const annotations = new WeakMap<Request, RequestAnnotation>();

/**
 * Record the resolved action (and optional numeric/boolean counters) for the
 * request currently being handled. Multi-action functions call this at their
 * dispatch point; single-purpose functions declare a static action at the
 * serve-wrapper instead.
 *
 * Action strings are constrained to a conservative charset and length because
 * they end up in a log line: a body-supplied value that failed validation must
 * not be able to smuggle content into the log.
 */
export function annotateRequestLog(
  req: Request,
  annotation: RequestAnnotation,
): void {
  const current = annotations.get(req) ?? {};
  if (annotation.action !== undefined) {
    const safe = sanitizeAction(annotation.action);
    if (safe) current.action = safe;
  }
  if (annotation.extra) {
    current.extra = { ...(current.extra ?? {}), ...scrubExtra(annotation.extra) };
  }
  annotations.set(req, current);
}

/** Read and drop the annotation for a request. */
function takeAnnotation(req: Request): RequestAnnotation {
  const value = annotations.get(req) ?? {};
  annotations.delete(req);
  return value;
}

const ACTION_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

/** Lowercase snake/kebab identifiers only. Anything else is dropped. */
export function sanitizeAction(action: string): string | null {
  const trimmed = action.trim().toLowerCase();
  return ACTION_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Keep only numeric and boolean counters, and only under identifier-shaped keys.
 * Strings are dropped outright: a caller cannot accidentally log a headline, an
 * email, or an error body through `extra`.
 */
export function scrubExtra(
  extra: Record<string, unknown>,
): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (!ACTION_PATTERN.test(key)) continue;
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

/**
 * Request-id passthrough. Accepts a caller-supplied id only when it is short and
 * strictly alphanumeric/dash, which rules out a header carrying a sentence, an
 * email, or an injected newline. Anything else is replaced by a fresh UUID.
 */
export function normalizeRequestId(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(trimmed) ? trimmed : null;
}

function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Deterministic-length fallback; only reachable in exotic runtimes.
  return `rid-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Truncated SHA-256, for correlating a subject without storing it. */
export async function hashForLog(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || value.length === 0) return null;
  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/**
 * Extract the JWT subject WITHOUT verifying it (the gateway already did) purely
 * so it can be hashed. Returns null when there is no bearer token.
 */
export function unverifiedSubject(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const parts = auth.slice(7).split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

/** The complete, closed shape of a MyNews edge log line. */
export interface MyNewsLogLine {
  level: 'info' | 'warn' | 'error';
  service: 'mynews-edge';
  fn: string;
  action: string;
  outcome: string;
  status: number;
  durationMs: number;
  requestId: string;
  method: string;
  timestamp: string;
  subjectHash?: string;
  extra?: Record<string, number | boolean>;
}

/**
 * Every field name the line may contain. The canary test asserts that an emitted
 * line has no key outside this set, which is what makes "no PII" checkable
 * rather than aspirational.
 */
export const ALLOWED_LOG_FIELDS: readonly string[] = [
  'level',
  'service',
  'fn',
  'action',
  'outcome',
  'status',
  'durationMs',
  'requestId',
  'method',
  'timestamp',
  'subjectHash',
  'extra',
];

/**
 * Field names that must never appear anywhere in a line (top level or inside
 * `extra`). Used by the canary test and by the runtime scrub in
 * `buildLogLine`, so a future edit that adds one of these fails loudly.
 */
export const FORBIDDEN_LOG_FIELDS: readonly string[] = [
  'email',
  'emails',
  'ip',
  'ipAddress',
  'remoteAddr',
  'userAgent',
  'authorization',
  'token',
  'accessToken',
  'jwt',
  'body',
  'payload',
  'headline',
  'dek',
  'text',
  'url',
  'path',
  'query',
  'handle',
  'displayName',
  'userId',
  'sub',
  'phone',
  'address',
  'name',
  'cookie',
  'secret',
  'password',
  'pubkey',
  'privateKey',
];

const FORBIDDEN = new Set(FORBIDDEN_LOG_FIELDS.map((f) => f.toLowerCase()));

/** Report any field name in a line that violates the privacy contract. */
export function findForbiddenLogFields(line: Record<string, unknown>): string[] {
  const offenders: string[] = [];
  for (const key of Object.keys(line)) {
    if (FORBIDDEN.has(key.toLowerCase())) offenders.push(key);
    if (!ALLOWED_LOG_FIELDS.includes(key)) offenders.push(key);
  }
  const extra = line.extra;
  if (extra && typeof extra === 'object') {
    for (const key of Object.keys(extra as Record<string, unknown>)) {
      if (FORBIDDEN.has(key.toLowerCase())) offenders.push(`extra.${key}`);
    }
  }
  return [...new Set(offenders)];
}

export interface BuildLogLineInput {
  fn: string;
  action: string;
  outcome: string;
  status: number;
  durationMs: number;
  requestId: string;
  method: string;
  subjectHash?: string | null;
  extra?: Record<string, number | boolean>;
  now?: () => Date;
}

export function buildLogLine(input: BuildLogLineInput): MyNewsLogLine {
  const level: MyNewsLogLine['level'] =
    input.status >= 500 ? 'error' : input.status >= 400 ? 'warn' : 'info';
  const extra = input.extra ? scrubExtra(input.extra) : undefined;
  return {
    level,
    service: 'mynews-edge',
    fn: input.fn,
    action: sanitizeAction(input.action) ?? 'unknown',
    // The outcome is a typed envelope code produced in our own source, never a
    // caller string, but it is length-clamped anyway so a future typed code
    // cannot bloat a log line.
    outcome: input.outcome.slice(0, 64),
    status: input.status,
    durationMs: input.durationMs,
    requestId: input.requestId,
    method: input.method === 'POST' || /^[A-Z]{3,7}$/.test(input.method) ? input.method : 'OTHER',
    timestamp: (input.now ?? (() => new Date()))().toISOString(),
    ...(input.subjectHash ? { subjectHash: input.subjectHash } : {}),
    ...(extra && Object.keys(extra).length > 0 ? { extra } : {}),
  };
}

/** Serialize without ever throwing back onto the response path. */
export function serializeLogLine(line: MyNewsLogLine): string {
  try {
    return JSON.stringify(line);
  } catch {
    return JSON.stringify({
      level: 'error',
      service: 'mynews-edge',
      fn: line.fn,
      action: 'unknown',
      outcome: 'log-serialize-failed',
      status: line.status,
      durationMs: line.durationMs,
      requestId: line.requestId,
      method: line.method,
      timestamp: line.timestamp,
    });
  }
}

export interface EmitDeps {
  log?: (line: string) => void;
  now?: () => Date;
}

/** Emit one line. Errors and warnings go to stderr so they are filterable. */
export function emitLogLine(line: MyNewsLogLine, deps: EmitDeps = {}): void {
  const serialized = serializeLogLine(line);
  if (deps.log) {
    deps.log(serialized);
    return;
  }
  if (line.level === 'info') console.log(serialized);
  else console.error(serialized);
}

export interface RequestLogOptions {
  /** The function name, e.g. 'mynews-publish'. */
  fn: string;
  /**
   * Static action for single-purpose functions. Multi-action functions pass
   * their default here and call `annotateRequestLog` once the action is parsed.
   */
  action: string;
}

export interface RequestLogDeps extends EmitDeps {
  /** Monotonic clock in ms. Injected in tests. */
  clock?: () => number;
  /** Skip the subject hash (used by worker endpoints, which have no user). */
  hashSubject?: boolean;
}

function monotonic(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

/**
 * Wrap a request handler so exactly one structured line is emitted per request,
 * on both the success and the failure path. The handler's Response is returned
 * unchanged; a logging failure is swallowed.
 *
 * A handler that throws is re-thrown after logging `outcome: 'threw'`, so the
 * caller (serveEnvelope, or a worker's own catch) still owns the response.
 */
export function withRequestLog(
  options: RequestLogOptions,
  handler: (req: Request) => Promise<Response>,
  deps: RequestLogDeps = {},
): (req: Request) => Promise<Response> {
  const clock = deps.clock ?? monotonic;
  return async (req) => {
    const startedAt = clock();
    const requestId = normalizeRequestId(req.headers.get('x-request-id')) ?? newRequestId();
    let response: Response | null = null;
    let threw: unknown = null;
    try {
      response = await handler(req);
      return response;
    } catch (error) {
      threw = error;
      throw error;
    } finally {
      const durationMs = Math.max(0, Math.round(clock() - startedAt));
      const annotation = takeAnnotation(req);
      const status = response ? response.status : 500;
      const outcome = threw ? 'threw' : response ? readLogOutcome(response) : 'no-response';
      // Awaited, not fire-and-forget. A background task started here races the
      // edge isolate's teardown once the response is returned, and a log line
      // that MIGHT be written is not observability. The cost is one WebCrypto
      // digest over a 36-byte subject, which is far cheaper than an outage
      // debugged without logs.
      try {
        const subject = deps.hashSubject === false ? null : unverifiedSubject(req);
        const subjectHash = subject ? await hashForLog(subject) : null;
        emitLogLine(
          buildLogLine({
            fn: options.fn,
            action: annotation.action ?? options.action,
            outcome,
            status,
            durationMs,
            requestId,
            method: req.method,
            subjectHash,
            extra: annotation.extra,
            now: deps.now,
          }),
          deps,
        );
      } catch {
        // Telemetry must never become a second failure.
      }
    }
  };
}

/**
 * Worker heartbeat row. Written by the three mynews worker endpoints at the end
 * of every pass so `mynews-health` can report whether a worker is actually
 * running, instead of inferring liveness from queue depth.
 *
 * Standalone postgrest insert rather than a MyNewsStore method: the store
 * interface is implemented by fakes across ~20 test files, and a heartbeat is
 * telemetry, not domain state.
 */
export interface WorkerRunRecord {
  worker: string;
  ok: boolean;
  startedAt: string;
  processed: number;
  failures: number;
  detail?: string;
}

export async function recordWorkerRun(
  record: WorkerRunRecord,
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): Promise<'recorded' | 'skipped-unconfigured' | 'failed'> {
  const url = env('SUPABASE_URL')?.trim();
  const key = env('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) return 'skipped-unconfigured';
  try {
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/nw_worker_runs`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        worker: record.worker,
        ok: record.ok,
        started_at: record.startedAt,
        processed: Math.max(0, Math.trunc(record.processed)),
        failures: Math.max(0, Math.trunc(record.failures)),
        // Bounded, and only ever a code-authored summary string.
        detail: record.detail ? record.detail.slice(0, 500) : null,
      }),
    });
    return response.ok ? 'recorded' : 'failed';
  } catch {
    return 'failed';
  }
}
