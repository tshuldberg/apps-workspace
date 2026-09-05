/**
 * Shared helpers for BestChef provider broker Edge Functions.
 *
 * This module is consumed both by Deno (Supabase Edge Function runtime)
 * and Vitest (in-repo unit tests). It does not import Deno globals.
 * The Deno entry points read `Deno.env` / `Deno.serve` themselves and
 * pass dependencies into the handler.
 */

export type BrokerErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'provider_outage'
  | 'invalid_input'
  | 'unknown';

export interface BrokerEnvelope<T> {
  ok: boolean;
  provider?: string;
  source?: string;
  confidence?: number | null;
  data?: T;
  error?: { kind: BrokerErrorKind; message: string };
}

export interface BrokerDeps {
  env: (key: string) => string | undefined;
  fetch: typeof fetch;
  now: () => number;
  rateLimit: RateLimiter;
  /** Durable cross-instance quota check (bc_consume_provider_quota). Fail closed. */
  quota: ProviderQuotaCheck;
}

export type ProviderQuotaCheck = (
  userId: string,
  fn: string,
  max: number,
  windowMs: number,
) => Promise<ProviderQuotaResult>;

export interface RateLimiter {
  consume(userId: string, fn: string, max: number, windowMs: number): boolean;
}

export function envelopeOk<T>(
  body: { provider: string; source: string; confidence?: number | null; data: T },
): Response {
  const payload: BrokerEnvelope<T> = {
    ok: true,
    provider: body.provider,
    source: body.source,
    confidence: body.confidence ?? null,
    data: body.data,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function envelopeError(
  kind: BrokerErrorKind,
  message: string,
  status: number,
  provider?: string,
): Response {
  const payload: BrokerEnvelope<never> = {
    ok: false,
    provider,
    error: { kind, message },
  };
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createInMemoryRateLimiter(): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    consume(userId, fn, max, windowMs) {
      const key = `${userId}:${fn}`;
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= max) return false;
      bucket.count += 1;
      return true;
    },
  };
}

/** True when the manual provider kill switch is set (fail-closed cost control, N-28). */
export function isProviderKillSwitchEnabled(env: (key: string) => string | undefined): boolean {
  return env('BESTCHEF_PROVIDER_KILL_SWITCH') === '1';
}

export interface ProviderQuotaResult {
  allowed: boolean;
  reason: 'ok' | 'kill_switch' | 'user_rate_limit' | 'global_daily_cap' | 'quota_error' | 'unknown';
}

/**
 * Durable, cross-instance provider quota check backed by Postgres (N-28 / OPS-09). Unlike
 * the per-isolate in-memory limiter, this enforces a per-user-per-fn window AND a global
 * daily cap, and honors the kill switch. Fails CLOSED on any quota-system error so a broken
 * ledger can never authorize unbounded paid provider spend.
 *
 * `rpc` is the service-role Supabase client's `rpc` method (passed in to keep this file free
 * of Deno/Supabase imports). Wire this into the vision/nutrition/product-identity entry
 * points before the provider call, alongside isProviderKillSwitchEnabled().
 */
export async function consumeProviderQuota(
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>,
  userId: string,
  fn: string,
  max: number,
  windowMs: number,
): Promise<ProviderQuotaResult> {
  try {
    const { data, error } = await rpc('bc_consume_provider_quota', {
      p_user_id: userId,
      p_fn: fn,
      p_max: max,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) {
      return { allowed: false, reason: 'quota_error' };
    }
    const result = data as { allowed?: boolean; reason?: ProviderQuotaResult['reason'] } | null;
    return {
      allowed: result?.allowed === true,
      reason: result?.reason ?? 'unknown',
    };
  } catch {
    return { allowed: false, reason: 'quota_error' };
  }
}

/**
 * Extract a stable user id from the Authorization header.
 *
 * For local tests and scaffold the function only inspects the JWT `sub`
 * claim without verifying the signature. Production deployments rely on
 * Supabase Edge Function gateway to verify the JWT before invoking the
 * function (the gateway populates the user context). If no header is
 * present, the request is rejected.
 */
export function getUserIdFromAuth(authHeader: string | null): string | null {
  const claims = decodeAuthClaims(authHeader);
  return typeof claims?.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
}

/**
 * True when the bearer token carries Supabase's anonymous-session claim.
 * Anonymous sessions get stricter provider quotas: they are free to create,
 * so a farm of them is the cheapest path to paid-provider abuse.
 */
export function isAnonymousAuth(authHeader: string | null): boolean {
  return decodeAuthClaims(authHeader)?.is_anonymous === true;
}

function decodeAuthClaims(
  authHeader: string | null,
): { sub?: string; is_anonymous?: boolean } | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const token = match[1] ?? '';
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1]!.padEnd(parts[1]!.length + (4 - (parts[1]!.length % 4)) % 4, '=');
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as { sub?: string; is_anonymous?: boolean };
  } catch {
    return null;
  }
}

/**
 * Production ProviderQuotaCheck: calls bc_consume_provider_quota over PostgREST
 * with the service-role key (the house pattern; no supabase-js dependency).
 * Fails CLOSED when config is missing or the request errors, so a broken
 * ledger can never authorize unbounded paid provider spend.
 */
export function createServiceQuotaCheck(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): ProviderQuotaCheck {
  return (userId, fn, max, windowMs) =>
    consumeProviderQuota(
      async (rpcFn, args) => {
        const url = (env('SUPABASE_URL') ?? '').replace(/\/+$/, '');
        const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (!url || !key) {
          return { data: null, error: { message: 'service config missing' } };
        }
        try {
          const res = await fetchImpl(`${url}/rest/v1/rpc/${rpcFn}`, {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(args),
          });
          if (!res.ok) {
            return { data: null, error: { message: `HTTP ${res.status}` } };
          }
          const data = (await res.json().catch(() => null)) as unknown;
          return { data, error: null };
        } catch (err) {
          return {
            data: null,
            error: { message: err instanceof Error ? err.message : 'fetch failed' },
          };
        }
      },
      userId,
      fn,
      max,
      windowMs,
    );
}

const PAYMENT_PATTERNS: Array<RegExp> = [
  /\b(?:credit|debit|visa|mastercard|amex|american express|discover)\b[^\n]*/gi,
  /\b(?:card|acct|account)\s*(?:number|#|no\.?)\s*[:#]?\s*[\d\s*-]{4,}/gi,
  /\b\d{4}\s*\*+\s*\d{4}\b/g,
  /\b\*{4,}\s*\d{4}\b/g,
  /\b(?:auth|approval|ref)\s*(?:code|#|no\.?)\s*[:#]?\s*[\w-]{4,}/gi,
];

/** Redact card numbers, auth codes, and payment tender lines from text. */
export function redactPaymentText(text: string): string {
  let redacted = text;
  for (const pattern of PAYMENT_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

export interface UpstreamResult<T> {
  ok: true;
  body: T;
}

export interface UpstreamFailure {
  ok: false;
  errorKind: BrokerErrorKind;
  message: string;
  status: number;
}

/** Translate an upstream HTTP error into a typed broker failure. */
export function classifyUpstreamStatus(status: number): UpstreamFailure {
  if (status === 401 || status === 403) {
    return { ok: false, errorKind: 'auth', message: `Upstream returned ${status}.`, status: 502 };
  }
  if (status === 429) {
    return { ok: false, errorKind: 'rate_limit', message: 'Upstream rate-limited.', status: 429 };
  }
  if (status === 400 || status === 422) {
    return { ok: false, errorKind: 'invalid_input', message: `Upstream returned ${status}.`, status: 400 };
  }
  if (status >= 500) {
    return { ok: false, errorKind: 'provider_outage', message: `Upstream returned ${status}.`, status: 502 };
  }
  return { ok: false, errorKind: 'unknown', message: `Upstream returned ${status}.`, status: 502 };
}
