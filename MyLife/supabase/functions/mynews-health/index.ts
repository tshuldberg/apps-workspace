// MyNews service health (plan 48 WP11, audit findings C11/C13).
//
// Two audiences, two payloads, one truth:
//
//   SHALLOW (no credential): { status, checkedAt }. Enough for an uptime probe
//   and for scripts/mynews-smoke.sh to fail a deploy, and nothing else. Queue
//   depths and ages are operational intelligence about a safety pipeline: an
//   attacker who can watch the NCII queue drain learns when moderation is
//   understaffed, and a public "12 reports pending, oldest 9 hours" is a
//   targeting signal. So the public payload carries no component internals at
//   all, not even component names.
//
//   DETAILED (worker secret): the full typed component list with ages, depths,
//   and the reason each level was chosen. The secret is checked in constant time
//   against MYNEWS_HEALTH_SECRET.
//
// Fail-closed posture throughout:
//   * A database read failure is status 'down' on HTTP 503. It is never reported
//     as 'ok' because zero rows came back.
//   * A detailed request with a wrong or missing secret gets 401, NOT a silent
//     downgrade to the shallow payload. A caller who asked for detail and was
//     refused must know they were refused.
//   * When MYNEWS_HEALTH_SECRET is unset, detail is UNAVAILABLE rather than
//     open: an unset secret must never mean "no authentication required".
//   * The shallow payload still tells the truth. It reports 'degraded' when a
//     queue is past threshold even though it will not say which queue.
//
// verify_jwt is OFF for this function (supabase/config.toml) because an uptime
// probe has no user session. The worker-secret gate, not the gateway, is what
// protects the detailed payload.

import { jsonError, jsonOk, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  classifyHealthSnapshot,
  type HealthReport,
  type HealthSnapshot,
} from '../_shared/mynews-health.ts';

export interface HealthDeps {
  /** Reads nw_health_snapshot(). Throws when the database is unreachable. */
  readSnapshot: () => Promise<HealthSnapshot>;
  /** Configured detail secret, or null when detail is unavailable. */
  detailSecret: string | null;
}

/** Header carrying the detail credential. Mirrors the worker-secret header. */
export const HEALTH_SECRET_HEADER = 'X-MyNews-Worker-Secret';

export interface ShallowHealthPayload {
  status: HealthReport['status'];
  checkedAt: string;
  /** True when this deployment can serve the detailed payload at all. */
  detailAvailable: boolean;
}

export type DetailedHealthPayload = HealthReport & { detail: true };

/**
 * Length-independent comparison. The secret is a shared static string, so a
 * timing oracle here is a real (if slow) way to learn it.
 */
export function secretMatches(supplied: string | null, expected: string | null): boolean {
  if (!expected || !supplied) return false;
  const a = new TextEncoder().encode(supplied);
  const b = new TextEncoder().encode(expected);
  // Compare over a fixed length so a wrong-length guess costs the same as a
  // right-length one.
  const width = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < width; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function suppliedSecret(req: Request): string | null {
  const explicit = req.headers.get(HEALTH_SECRET_HEADER)?.trim();
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1]?.trim() ?? null;
}

/** True when the caller asked for the detailed payload. */
export function wantsDetail(req: Request): boolean {
  const url = new URL(req.url);
  const flag = url.searchParams.get('detail');
  return flag === '1' || flag === 'true' || suppliedSecret(req) !== null;
}

export async function handleHealthRequest(req: Request, deps: HealthDeps): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError('bad-payload', 405, 'GET or POST only');
  }

  const detailRequested = wantsDetail(req);
  annotateRequestLog(req, { action: detailRequested ? 'health_detail' : 'health_shallow' });

  if (detailRequested) {
    if (!deps.detailSecret) {
      // Unset secret means the detailed payload is not available on this
      // deployment. It must never mean "unauthenticated detail is fine".
      return jsonError(
        'detail-unavailable',
        503,
        'MYNEWS_HEALTH_SECRET is not configured, so the detailed payload cannot be served',
      );
    }
    if (!secretMatches(suppliedSecret(req), deps.detailSecret)) {
      return jsonError('unauthorized', 401, 'the detailed payload requires the health secret');
    }
  }

  let snapshot: HealthSnapshot;
  try {
    snapshot = await deps.readSnapshot();
  } catch (error) {
    console.error('mynews health snapshot read failed', error);
    // A failed read is 'down' on a 5xx. Anything else would let a probe report a
    // healthy service while the database is unreachable.
    return jsonError('health-unavailable', 503, 'the health snapshot could not be read');
  }

  const report = classifyHealthSnapshot(snapshot);

  if (detailRequested) {
    const payload: DetailedHealthPayload = { ...report, detail: true };
    return jsonOk(payload);
  }

  const shallow: ShallowHealthPayload = {
    status: report.status,
    checkedAt: report.checkedAt,
    detailAvailable: deps.detailSecret !== null,
  };
  return jsonOk(shallow);
}

/**
 * PostgREST reader for nw_health_snapshot(). Kept here rather than in
 * mynews-store.ts on purpose: the store interface is implemented by fakes across
 * many test files, and health is telemetry rather than domain state.
 */
export function createSnapshotReader(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): () => Promise<HealthSnapshot> {
  return async () => {
    const url = env('SUPABASE_URL')?.trim();
    const key = env('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/nw_health_snapshot`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!response.ok) {
      throw new Error(`nw_health_snapshot returned HTTP ${response.status}`);
    }
    return (await response.json()) as HealthSnapshot;
  };
}

declare const Deno:
  | {
      serve: (h: (req: Request) => Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const detailSecret = env('MYNEWS_HEALTH_SECRET')?.trim() || null;
  Deno.serve(
    serveEnvelope(
      (req) =>
        handleHealthRequest(req, {
          readSnapshot: createSnapshotReader(env, fetch),
          detailSecret,
        }),
      { fn: 'mynews-health', action: 'health_shallow' },
      // The caller is an uptime probe or an operator, not a signed-in user.
      { hashSubject: false },
    ),
  );
}
