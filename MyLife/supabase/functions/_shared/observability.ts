// Structured error capture for BestChef edge functions (audit H14: the edge
// tier previously had no error capture beyond bare console.error, so worker
// failures were invisible until someone read raw function logs).
//
// Two sinks, both fail-silent so capturing an error never becomes a second
// error on the response path:
//   1. A single structured JSON line to console.error. Supabase captures
//      function stdout/stderr natively and makes it queryable in the dashboard
//      Logs Explorer, so a JSON line is filterable by function and context
//      without any external service. This is always emitted.
//   2. Optional Sentry forwarding when SENTRY_DSN is set in the function's env.
//      Uses Sentry's plain HTTP store endpoint (no SDK, no bundle weight) and
//      is fire-and-forget: a failed or slow send is swallowed.
//
// PRIVACY: the message/stack are passed through as-is. Edge callers own not
// putting PII into error messages; the structured payload never adds user id,
// email, IP, or headers on its own. Sentry forwarding sends only the function
// name, context label, message, and stack, with no user scope.

export interface CaptureContext {
  // The edge function name, e.g. 'bestchef-media-purge'. Required so logs can
  // be filtered per worker.
  fn: string;
  // A short label for WHERE in the function this fired, e.g. 'runMediaPurge'
  // or 'handler'. Optional but recommended.
  op?: string;
  // Extra non-PII structured fields (ids, counts, status). Optional.
  extra?: Record<string, unknown>;
}

type EnvReader = (key: string) => string | undefined;

function defaultEnv(key: string): string | undefined {
  // Deno is present at runtime; guard so this module is importable under vitest
  // (node) where the tests inject an env reader explicitly.
  const g = globalThis as { Deno?: { env: { get(k: string): string | undefined } } };
  return g.Deno?.env.get(key);
}

// Serialize the structured line without ever throwing back into the caller: a
// non-serializable extra (circular reference, BigInt) must not turn error
// capture into a second error on the response path. Falls back to a minimal
// line that drops only the offending extra.
function safeStringify(line: StructuredErrorLine): string {
  try {
    return JSON.stringify(line);
  } catch {
    try {
      return JSON.stringify({ ...line, extra: '[unserializable]' });
    } catch {
      return `{"level":"error","service":"bestchef-edge","fn":${JSON.stringify(line.fn)},"message":"[unserializable log line]"}`;
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error && typeof error.stack === 'string' ? error.stack : undefined;
}

// The structured line shape. Exported so the test can assert against it.
export interface StructuredErrorLine {
  level: 'error';
  service: 'bestchef-edge';
  fn: string;
  op?: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
  timestamp: string;
}

export function buildStructuredLine(
  context: CaptureContext,
  error: unknown,
  now: () => Date = () => new Date(),
): StructuredErrorLine {
  return {
    level: 'error',
    service: 'bestchef-edge',
    fn: context.fn,
    ...(context.op ? { op: context.op } : {}),
    message: errorMessage(error),
    ...(errorStack(error) ? { stack: errorStack(error) } : {}),
    ...(context.extra ? { extra: context.extra } : {}),
    timestamp: now().toISOString(),
  };
}

// Parse a Sentry DSN into the store endpoint + auth header. Returns null for a
// malformed or absent DSN so forwarding is simply skipped.
export function parseSentryDsn(
  dsn: string | undefined,
): { url: string; publicKey: string } | null {
  if (!dsn) return null;
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    const url = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`;
    return { url, publicKey };
  } catch {
    return null;
  }
}

async function forwardToSentry(
  line: StructuredErrorLine,
  env: EnvReader,
  fetchImpl: typeof fetch,
): Promise<void> {
  const dsn = parseSentryDsn(env('SENTRY_DSN'));
  if (!dsn) return;
  try {
    const body = JSON.stringify({
      level: 'error',
      platform: 'other',
      timestamp: line.timestamp,
      logger: line.fn,
      transaction: line.op,
      message: { formatted: line.message },
      exception: line.stack
        ? { values: [{ type: line.fn, value: line.message, stacktrace: { frames: [] } }] }
        : undefined,
      extra: line.extra,
      tags: { fn: line.fn, service: line.service },
      // No user scope: identity is never forwarded from the edge tier.
    });
    await fetchImpl(dsn.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=bestchef-edge/1.0`,
      },
      body,
    });
  } catch {
    // Fail silent: forwarding must never block or throw on the response path.
  }
}

// Capture an error from an edge function catch block WITHOUT changing control
// flow. Always emits the structured console.error line; additionally forwards
// to Sentry when SENTRY_DSN is configured. Returns a promise for the optional
// forward, but callers in synchronous catch blocks can (and do) ignore it,
// since the structured line is written synchronously first.
export function captureError(
  context: CaptureContext,
  error: unknown,
  deps: { env?: EnvReader; fetch?: typeof fetch; now?: () => Date } = {},
): Promise<void> {
  const env = deps.env ?? defaultEnv;
  const now = deps.now ?? (() => new Date());
  const line = buildStructuredLine(context, error, now);

  // Structured line first, synchronously. Supabase captures this natively.
  console.error(safeStringify(line));

  const fetchImpl = deps.fetch ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) return Promise.resolve();
  // Fire-and-forget; the returned promise is for tests, not the response path.
  return forwardToSentry(line, env, fetchImpl);
}
