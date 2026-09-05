/**
 * BestChef media purge worker (TS-04, plan 33 Phase 4.1 item).
 *
 * Moderation rejection and upload deletion flip DATABASE rows; the storage
 * objects themselves linger until this worker removes them. It scans
 * bc_media_assets for purgeable rows (rejected, or marked deleted with a
 * storage pointer still present), deletes the objects, and stamps the rows
 * so a purge never repeats.
 *
 * Server-only per OPS-04: deployed with --no-verify-jwt and gated by a
 * private worker secret (gateway JWT verification would 401 cron/operator
 * calls before the secret check runs). Invoked by pg_net cron or an
 * operator; never by the app.
 */

import { timingSafeEqual } from '../_shared/worker-secret.ts';
import { captureError } from '../_shared/observability.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export interface PurgeCandidateRow {
  id: string;
  storage_bucket: string | null;
  storage_key: string | null;
  moderation_status: string;
  upload_status: string;
  metadata: Record<string, unknown> | null;
}

export interface MediaPurgeStore {
  listPurgeCandidates(limit: number): Promise<PurgeCandidateRow[]>;
  deleteStorageObject(ref: { bucket: string; key: string }): Promise<void>;
  markPurged(assetId: string, metadata: Record<string, unknown>): Promise<boolean>;
}

export interface MediaPurgeDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: MediaPurgeStore;
}

export interface MediaPurgeResult {
  ok: boolean;
  scanned: number;
  purgedObjects: number;
  markedRows: number;
  failures: { assetId: string; error: string }[];
}

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

/**
 * Rejected media is APPEALABLE evidence (DSA Art. 20 guarantees at least
 * six months to lodge a complaint), so rejections are only purged after
 * this window. User/account deletions (upload_status = deleted) purge
 * immediately - nothing appealable about your own delete. Appeal
 * resolution SLAs must sit well inside this window.
 */
export const REJECTED_RETENTION_DAYS = 183;

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

function expectedWorkerSecret(env: MediaPurgeDeps['env']): string | null {
  return stringOrNull(env('BESTCHEF_MEDIA_PURGE_WORKER_SECRET'));
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-BestChef-Worker-Secret'));
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

export async function runMediaPurge(
  deps: MediaPurgeDeps,
  limit: number = DEFAULT_BATCH_LIMIT,
): Promise<MediaPurgeResult> {
  const batch = Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(limit)));
  const candidates = await deps.store.listPurgeCandidates(batch);

  const result: MediaPurgeResult = {
    ok: true,
    scanned: candidates.length,
    purgedObjects: 0,
    markedRows: 0,
    failures: [],
  };

  for (const row of candidates) {
    try {
      if (row.storage_bucket && row.storage_key) {
        await deps.store.deleteStorageObject({ bucket: row.storage_bucket, key: row.storage_key });
        result.purgedObjects += 1;
      }
      const marked = await deps.store.markPurged(row.id, {
        ...(row.metadata ?? {}),
        purged_at: deps.now(),
        purge_worker: 'bestchef-media-purge',
      });
      if (marked) result.markedRows += 1;
    } catch (err) {
      // One bad object must not stop the batch; the row stays unpurged and
      // the next run retries it.
      result.failures.push({ assetId: row.id, error: errorMessage(err) });
    }
  }

  if (result.failures.length > 0) result.ok = false;
  return result;
}

export async function handleMediaPurgeRequest(
  req: Request,
  deps: MediaPurgeDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'POST only.', 405);
  }

  const expected = expectedWorkerSecret(deps.env);
  if (!expected) {
    return jsonError('config', 'BESTCHEF_MEDIA_PURGE_WORKER_SECRET is not configured.', 503);
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
    const result = await runMediaPurge(deps, limit);
    return jsonResponse(result as unknown as Record<string, unknown>, result.ok ? 200 : 207);
  } catch (err) {
    captureError({ fn: 'bestchef-media-purge', op: 'runMediaPurge' }, err);
    return jsonError('purge_failed', errorMessage(err), 500);
  }
}

// ── Candidate filter (exported for tests) ─────────────────────────────

export function buildPurgeCandidatesFilter(nowIso: string, limit: number): string {
  const cutoff = new Date(
    new Date(nowIso).getTime() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const select = 'id,storage_bucket,storage_key,moderation_status,upload_status,metadata';
  return (
    `select=${select}` +
    '&storage_key=not.is.null' +
    '&metadata->>purged_at=is.null' +
    // Child-safety evidence retention (audit C5): a confirmed hash hit forces
    // moderation_status='quarantined' (bc_record_child_safety_hit) and files an
    // open bc_child_safety_reports row. Never purge the underlying bytes while
    // quarantined, even if the owner later deletes their account
    // (upload_status='deleted'). Fail-safe: when in doubt, exclude. Nothing
    // un-quarantines an asset, so this can never orphan a legitimate purge.
    '&moderation_status=not.eq.quarantined' +
    `&or=(upload_status.eq.deleted,and(moderation_status.eq.rejected,updated_at.lt.${cutoff}))` +
    `&order=updated_at.asc&limit=${limit}`
  );
}

// ── Supabase REST store ───────────────────────────────────────────────

function encodeObjectPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function createSupabaseMediaPurgeStore(
  env: MediaPurgeDeps['env'],
  fetchImpl: typeof fetch,
  now: () => string,
): MediaPurgeStore {
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
    async listPurgeCandidates(limit: number): Promise<PurgeCandidateRow[]> {
      const text = await rest(
        `/rest/v1/bc_media_assets?${buildPurgeCandidatesFilter(now(), limit)}`,
        { method: 'GET' },
        [200],
      );
      return JSON.parse(text) as PurgeCandidateRow[];
    },

    async deleteStorageObject(ref: { bucket: string; key: string }): Promise<void> {
      // 404 is success: the object is already gone.
      await rest(
        `/storage/v1/object/${encodeURIComponent(ref.bucket)}/${encodeObjectPath(ref.key)}`,
        { method: 'DELETE' },
        [200, 204, 404],
      );
    },

    async markPurged(assetId: string, metadata: Record<string, unknown>): Promise<boolean> {
      const text = await rest(
        `/rest/v1/bc_media_assets?id=eq.${encodeURIComponent(assetId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            storage_bucket: null,
            storage_key: null,
            remote_url: null,
            upload_status: 'deleted',
            visibility: 'private',
            metadata,
            updated_at: now(),
          }),
        },
        [200],
      );
      return (JSON.parse(text) as unknown[]).length === 1;
    },
  };
}

// ── Deno entrypoint ───────────────────────────────────────────────────

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req) => {
    const env = (key: string) => Deno!.env.get(key);
    const now = () => new Date().toISOString();

    let store: MediaPurgeStore;
    try {
      store = createSupabaseMediaPurgeStore(env, fetch, now);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    return handleMediaPurgeRequest(req, { env, now, store });
  });
}
