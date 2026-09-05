/**
 * Edge-function error parsing (plan 33 Phase 2.2).
 *
 * All 7 BestChef edge functions return `{ ok: false, error: { kind, message,
 * params? } }` envelopes, but supabase-js surfaces non-2xx responses as a
 * FunctionsHttpError whose `message` is a generic English sentence; the real
 * machine contract is only reachable through `error.context` (the Response).
 * This module reads it so callers get `kind` + `params` instead of prose.
 */

export interface EdgeErrorEnvelope {
  kind: string;
  message: string | null;
  params: Record<string, unknown>;
}

export interface ParsedEdgeError {
  /** Machine kind from the function body, or null when unreadable. */
  kind: string | null;
  /** Ops/debug message from the body (never for user display). */
  message: string | null;
  params: Record<string, unknown>;
  /** HTTP status when the error carried a Response context. */
  status: number | null;
  /** True when the request never reached the function (fetch failure). */
  network: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Pure: pull `{ error: { kind, message, params } }` out of a parsed body. */
export function extractEdgeErrorEnvelope(body: unknown): EdgeErrorEnvelope | null {
  const root = record(body);
  if (!root) return null;
  const error = record(root.error);
  if (!error) return null;
  const kind = typeof error.kind === 'string' && error.kind.trim().length > 0
    ? error.kind.trim()
    : null;
  if (!kind) return null;
  return {
    kind,
    message: typeof error.message === 'string' ? error.message : null,
    params: record(error.params) ?? {},
  };
}

/** Pure: coarse fallback classification when the body is unreadable. */
export function classifyEdgeStatus(
  status: number | null,
): 'auth' | 'rate_limited' | 'invalid_input' | 'not_found' | 'service_unavailable' | 'unknown' {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status === 404) return 'not_found';
  // 413/415 can come from a gateway BEFORE the function runs (no parsable
  // envelope); they are permanent rejections and must never classify as a
  // retryable unknown.
  if (
    status === 400 ||
    status === 405 ||
    status === 409 ||
    status === 413 ||
    status === 415 ||
    status === 422
  ) {
    return 'invalid_input';
  }
  if (status !== null && status >= 500 && status < 600) return 'service_unavailable';
  return 'unknown';
}

interface ResponseLike {
  status: number;
  clone?: () => ResponseLike;
  json: () => Promise<unknown>;
}

function responseLike(value: unknown): ResponseLike | null {
  const candidate = record(value);
  if (!candidate) return null;
  if (typeof candidate.status !== 'number' || typeof candidate.json !== 'function') return null;
  return candidate as unknown as ResponseLike;
}

/**
 * Parse a supabase-js functions.invoke error (FunctionsHttpError,
 * FunctionsRelayError, FunctionsFetchError, or anything thrown). Never
 * throws; degrades to status classification, then to network/unknown.
 */
export async function parseEdgeFunctionError(error: unknown): Promise<ParsedEdgeError> {
  const errorRecord = record(error);
  const context = errorRecord ? responseLike(errorRecord.context) : null;

  if (context) {
    let body: unknown = null;
    try {
      const source = typeof context.clone === 'function' ? context.clone() : context;
      body = await source.json();
    } catch {
      body = null;
    }
    const envelope = extractEdgeErrorEnvelope(body);
    return {
      kind: envelope?.kind ?? null,
      message: envelope?.message ?? null,
      params: envelope?.params ?? {},
      status: context.status,
      network: false,
    };
  }

  const name = errorRecord && typeof errorRecord.name === 'string' ? errorRecord.name : '';
  const message = errorRecord && typeof errorRecord.message === 'string' ? errorRecord.message : '';
  // TypeError alone is too broad (it would turn programming bugs into
  // "you're offline" + a draft that can never succeed); require a known
  // fetch-failure message for the TypeError path.
  const network =
    name === 'FunctionsFetchError' ||
    (name === 'TypeError' && /network request failed|failed to fetch|load failed/i.test(message));
  return { kind: null, message: null, params: {}, status: null, network };
}
