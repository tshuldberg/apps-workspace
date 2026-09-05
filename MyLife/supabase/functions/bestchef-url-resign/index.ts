/**
 * BestChef signed playback URL re-sign worker (audit H6).
 *
 * apps/bestchef-console/lib/media-promotion.ts signs a 365-day playback URL
 * (PROMOTED_URL_TTL_SECONDS) when a submission video is approved (or an
 * overturned rejection is re-promoted). Nothing re-signs it before it
 * expires, so every approved video breaks in one silent expiry cohort about
 * a year after launch. This worker scans bc_media_assets for approved videos
 * whose playback_url_expires_at falls within a rolling window, re-signs the
 * URL for the standard duration, and stamps the new expiry.
 *
 * The CDN/streaming-provider migration is founder item F4 and out of scope;
 * this job is needed regardless of when F4 lands.
 *
 * Server-only per OPS-04: deployed with --no-verify-jwt and gated by a
 * private worker secret (gateway JWT verification would 401 cron/operator
 * calls before the secret check runs). Structurally mirrors
 * bestchef-media-purge: invoked by pg_net cron or an operator; never by the
 * app.
 */

import { timingSafeEqual } from '../_shared/worker-secret.ts';
import { captureError } from '../_shared/observability.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

/** Matches apps/bestchef-console/lib/media-promotion.ts PROMOTED_URL_TTL_SECONDS. */
export const PLAYBACK_URL_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Re-sign anything expiring within this many days, so a missed run or two never orphans a row. */
export const RESIGN_WINDOW_DAYS = 30;

export interface ResignCandidateRow {
  id: string;
  storage_bucket: string | null;
  storage_key: string | null;
  metadata: Record<string, unknown> | null;
}

export interface UrlResignStore {
  listExpiringAssets(limit: number): Promise<ResignCandidateRow[]>;
  signPlaybackUrl(ref: { bucket: string; key: string }): Promise<string | null>;
  updatePlaybackUrl(
    assetId: string,
    patch: { remoteUrl: string; expiresAt: string; metadata: Record<string, unknown> },
  ): Promise<boolean>;
}

export interface UrlResignDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: UrlResignStore;
}

export interface UrlResignResult {
  ok: boolean;
  scanned: number;
  resigned: number;
  failures: { assetId: string; error: string }[];
}

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(code: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: code, message }, status);
}

function expectedWorkerSecret(env: UrlResignDeps['env']): string | null {
  return stringOrNull(env('BESTCHEF_URL_RESIGN_WORKER_SECRET'));
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-BestChef-Worker-Secret'));
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

/**
 * Every candidate is re-signed independently. One storage/signing failure
 * must not stop the batch: the row's stale expiry stays untouched and the
 * next run retries it.
 */
export async function runUrlResign(
  deps: UrlResignDeps,
  limit: number = DEFAULT_BATCH_LIMIT,
): Promise<UrlResignResult> {
  const batch = Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(limit)));
  const candidates = await deps.store.listExpiringAssets(batch);

  const result: UrlResignResult = { ok: true, scanned: candidates.length, resigned: 0, failures: [] };

  for (const row of candidates) {
    try {
      if (!row.storage_bucket || !row.storage_key) {
        // Storage pointers gone (purge worker beat us to it, or purged
        // between the scan and this iteration): nothing to re-sign.
        continue;
      }
      const signedUrl = await deps.store.signPlaybackUrl({
        bucket: row.storage_bucket,
        key: row.storage_key,
      });
      if (!signedUrl) {
        throw new Error('signing_failed');
      }
      const expiresAt = new Date(
        new Date(deps.now()).getTime() + PLAYBACK_URL_TTL_SECONDS * 1000,
      ).toISOString();
      const metadata = {
        ...(row.metadata ?? {}),
        promotion_delivery: 'signed_url_v1',
        resigned_at: deps.now(),
        resign_worker: 'bestchef-url-resign',
      };
      const updated = await deps.store.updatePlaybackUrl(row.id, {
        remoteUrl: signedUrl,
        expiresAt,
        metadata,
      });
      if (!updated) {
        throw new Error('update_failed');
      }
      result.resigned += 1;
    } catch (err) {
      result.failures.push({ assetId: row.id, error: errorMessage(err) });
    }
  }

  if (result.failures.length > 0) result.ok = false;
  return result;
}

export async function handleUrlResignRequest(req: Request, deps: UrlResignDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'POST only.', 405);
  }

  const expected = expectedWorkerSecret(deps.env);
  if (!expected) {
    return jsonError('config', 'BESTCHEF_URL_RESIGN_WORKER_SECRET is not configured.', 503);
  }
  if (!(await timingSafeEqual(suppliedWorkerSecret(req), expected))) {
    return jsonError('auth', 'Missing or invalid worker secret.', 401);
  }

  let limit = DEFAULT_BATCH_LIMIT;
  try {
    if (req.body) {
      const text = await req.text();
      if (text.trim()) {
        const body = JSON.parse(text) as { limit?: unknown };
        if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
          limit = body.limit;
        }
      }
    }
  } catch {
    return jsonError('invalid_body', 'Body must be JSON.', 400);
  }

  try {
    const result = await runUrlResign(deps, limit);
    return jsonResponse(result as unknown as Record<string, unknown>, result.ok ? 200 : 207);
  } catch (err) {
    captureError({ fn: 'bestchef-url-resign', op: 'runUrlResign' }, err);
    return jsonError('resign_failed', errorMessage(err), 500);
  }
}

// ── Candidate filter (exported for tests) ──────────────────────────────

export function buildResignCandidatesFilter(nowIso: string, limit: number): string {
  const horizon = new Date(
    new Date(nowIso).getTime() + RESIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const select = 'id,storage_bucket,storage_key,metadata';
  return (
    `select=${select}` +
    '&owner_kind=eq.submission' +
    '&media_kind=eq.video' +
    '&moderation_status=eq.approved' +
    '&remote_url=not.is.null' +
    '&storage_bucket=not.is.null' +
    '&storage_key=not.is.null' +
    '&playback_url_expires_at=not.is.null' +
    `&playback_url_expires_at=lt.${horizon}` +
    `&order=playback_url_expires_at.asc&limit=${limit}`
  );
}

// ── Supabase REST + Storage store ───────────────────────────────────────

function encodeObjectPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function createSupabaseUrlResignStore(
  env: UrlResignDeps['env'],
  fetchImpl: typeof fetch,
  now: () => string,
): UrlResignStore {
  const baseUrl = stringOrNull(env('SUPABASE_URL'));
  const serviceKey = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!baseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  async function rest(path: string, init: RequestInit, okStatuses: number[]): Promise<string> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: serviceKey!,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!okStatuses.includes(response.status)) {
      throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status}: ${text.slice(0, 200)}`);
    }
    return text;
  }

  return {
    async listExpiringAssets(limit: number): Promise<ResignCandidateRow[]> {
      const text = await rest(
        `/rest/v1/bc_media_assets?${buildResignCandidatesFilter(now(), limit)}`,
        { method: 'GET' },
        [200],
      );
      return JSON.parse(text) as ResignCandidateRow[];
    },

    async signPlaybackUrl(ref: { bucket: string; key: string }): Promise<string | null> {
      const text = await rest(
        `/storage/v1/object/sign/${encodeURIComponent(ref.bucket)}/${encodeObjectPath(ref.key)}`,
        {
          method: 'POST',
          body: JSON.stringify({ expiresIn: PLAYBACK_URL_TTL_SECONDS }),
        },
        [200],
      );
      const parsed = JSON.parse(text) as { signedURL?: string; signedUrl?: string };
      const signedPath = parsed.signedURL ?? parsed.signedUrl;
      if (!signedPath) return null;
      const absolute = signedPath.startsWith('http')
        ? signedPath
        : `${baseUrl}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
      return absolute.startsWith('https://') ? absolute : null;
    },

    async updatePlaybackUrl(
      assetId: string,
      patch: { remoteUrl: string; expiresAt: string; metadata: Record<string, unknown> },
    ): Promise<boolean> {
      const text = await rest(
        // moderation_status guard: never re-publish a row a moderator
        // rejected/hid between the scan and this write.
        `/rest/v1/bc_media_assets?id=eq.${encodeURIComponent(assetId)}&moderation_status=eq.approved`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            remote_url: patch.remoteUrl,
            playback_url_expires_at: patch.expiresAt,
            metadata: patch.metadata,
            updated_at: now(),
          }),
        },
        [200],
      );
      return (JSON.parse(text) as unknown[]).length === 1;
    },
  };
}

// ── Deno entrypoint ──────────────────────────────────────────────────────

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req) => {
    const env = (key: string) => Deno!.env.get(key);
    const now = () => new Date().toISOString();

    let store: UrlResignStore;
    try {
      store = createSupabaseUrlResignStore(env, fetch, now);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    return handleUrlResignRequest(req, { env, now, store });
  });
}
