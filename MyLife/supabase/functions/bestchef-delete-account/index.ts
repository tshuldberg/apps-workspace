/**
 * BestChef service-role account deletion worker.
 *
 * This Edge Function is intentionally server-only. The Expo app requests
 * deletion through `bc_request_account_deletion`; this worker is invoked by
 * an operator, cron, or server job with a private worker secret. Service-role
 * credentials are read only from Edge Function environment variables.
 */

import { timingSafeEqual } from '../_shared/worker-secret.ts';
import { captureError } from '../_shared/observability.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export type AccountDeletionStatus =
  | 'requested'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'failed';

export interface AccountDeletionRequestRow {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  status: AccountDeletionStatus;
  reason: string | null;
  metadata: Record<string, unknown>;
  requested_at: string | null;
  completed_at: string | null;
}

export interface StorageObjectRef {
  bucket: string;
  key: string;
}

export interface AccountDeletionStore {
  listOpenRequests(limit: number): Promise<AccountDeletionRequestRow[]>;
  getRequest(requestId: string): Promise<AccountDeletionRequestRow | null>;
  markProcessing(
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow>;
  markCompleted(
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow>;
  markFailed(
    request: AccountDeletionRequestRow,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow>;
  listStorageObjects(profileId: string): Promise<StorageObjectRef[]>;
  markProfileMediaDeleted(profileId: string, metadata: Record<string, unknown>): Promise<number>;
  deleteStorageObject(ref: StorageObjectRef): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
}

export interface AccountDeletionDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: AccountDeletionStore;
}

export interface AccountDeletionWorkerResult {
  ok: boolean;
  requestId: string;
  status: 'completed' | 'failed' | 'skipped';
  userId: string | null;
  profileId: string | null;
  deletedStorageObjects: number;
  mediaRowsMarkedDeleted: number;
  error?: string;
}

interface WorkerBody {
  requestId?: string;
  request_id?: string;
  limit?: number;
}

interface MediaAssetRow {
  id?: unknown;
  storage_bucket?: unknown;
  storage_key?: unknown;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 25;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function jsonError(kind: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: { kind, message } }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}

function normalizeStorageObjects(refs: StorageObjectRef[]): StorageObjectRef[] {
  const seen = new Set<string>();
  const normalized: StorageObjectRef[] = [];

  for (const ref of refs) {
    const bucket = ref.bucket.trim();
    const key = ref.key.trim().replace(/^\/+/, '');
    if (!bucket || !key) continue;
    const id = `${bucket}/${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push({ bucket, key });
  }

  return normalized;
}

function mergeMetadata(
  request: AccountDeletionRequestRow,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...objectRecord(request.metadata),
    original_user_id: request.user_id ?? objectRecord(request.metadata).original_user_id ?? null,
    original_profile_id: request.profile_id ?? objectRecord(request.metadata).original_profile_id ?? null,
    ...patch,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function expectedWorkerSecret(env: AccountDeletionDeps['env']): string | null {
  return (
    stringOrNull(env('BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET')) ??
    stringOrNull(env('BESTCHEF_DELETION_WORKER_SECRET'))
  );
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-BestChef-Worker-Secret'));
  if (explicit) return explicit;

  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

async function workerAuthorizationError(req: Request, env: AccountDeletionDeps['env']): Promise<Response | null> {
  const expected = expectedWorkerSecret(env);
  if (!expected) {
    return jsonError(
      'config',
      'BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET is not configured.',
      503,
    );
  }

  if (!(await timingSafeEqual(suppliedWorkerSecret(req), expected))) {
    return jsonError('auth', 'Missing or invalid worker secret.', 401);
  }

  return null;
}

async function readWorkerBody(req: Request): Promise<WorkerBody> {
  if (!req.body) return {};
  const text = await req.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as WorkerBody;
}

export async function processAccountDeletionRequest(
  request: AccountDeletionRequestRow,
  deps: AccountDeletionDeps,
): Promise<AccountDeletionWorkerResult> {
  const metadata = objectRecord(request.metadata);
  const userId = request.user_id ?? stringOrNull(metadata.original_user_id);
  const profileId = request.profile_id ?? stringOrNull(metadata.original_profile_id);

  if (request.status === 'completed') {
    return {
      ok: true,
      requestId: request.id,
      status: 'skipped',
      userId,
      profileId,
      deletedStorageObjects: 0,
      mediaRowsMarkedDeleted: 0,
    };
  }

  let processingRequest = request;
  try {
    processingRequest = await deps.store.markProcessing(
      request,
      mergeMetadata(request, {
        worker: 'bestchef-delete-account',
        processing_started_at: deps.now(),
      }),
    );

    const storageObjects = profileId
      ? normalizeStorageObjects(await deps.store.listStorageObjects(profileId))
      : [];

    let deletedStorageObjects = 0;
    for (const ref of storageObjects) {
      await deps.store.deleteStorageObject(ref);
      deletedStorageObjects += 1;
    }

    const mediaRowsMarkedDeleted = profileId
      ? await deps.store.markProfileMediaDeleted(profileId, {
          deleted_by: 'bestchef-delete-account',
          deleted_at: deps.now(),
          deletion_request_id: request.id,
        })
      : 0;

    if (userId) {
      await deps.store.deleteAuthUser(userId);
    }

    await deps.store.markCompleted(
      processingRequest,
      mergeMetadata(processingRequest, {
        worker: 'bestchef-delete-account',
        completed_at: deps.now(),
        deleted_storage_objects: deletedStorageObjects,
        media_rows_marked_deleted: mediaRowsMarkedDeleted,
        auth_user_deleted: Boolean(userId),
      }),
    );

    return {
      ok: true,
      requestId: request.id,
      status: 'completed',
      userId,
      profileId,
      deletedStorageObjects,
      mediaRowsMarkedDeleted,
    };
  } catch (err) {
    const message = errorMessage(err);
    captureError(
      { fn: 'bestchef-delete-account', op: 'processDeletion', extra: { requestId: request.id } },
      err,
    );
    await deps.store.markFailed(
      processingRequest,
      message,
      mergeMetadata(processingRequest, {
        worker: 'bestchef-delete-account',
        failed_at: deps.now(),
        last_error: message,
      }),
    );

    return {
      ok: false,
      requestId: request.id,
      status: 'failed',
      userId,
      profileId,
      deletedStorageObjects: 0,
      mediaRowsMarkedDeleted: 0,
      error: message,
    };
  }
}

export async function handleAccountDeletionWorkerRequest(
  req: Request,
  deps: AccountDeletionDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST for the deletion worker.', 405);
  }

  const authError = await workerAuthorizationError(req, deps.env);
  if (authError) return authError;

  let body: WorkerBody;
  try {
    body = await readWorkerBody(req);
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const requestId = stringOrNull(body.requestId ?? body.request_id);
  const requests = requestId
    ? [await deps.store.getRequest(requestId)].filter((row): row is AccountDeletionRequestRow => Boolean(row))
    : await deps.store.listOpenRequests(normalizeLimit(body.limit));

  if (requestId && requests.length === 0) {
    return jsonError('not_found', 'Deletion request not found.', 404);
  }

  const results: AccountDeletionWorkerResult[] = [];
  for (const request of requests) {
    results.push(await processAccountDeletionRequest(request, deps));
  }

  const failed = results.filter((result) => !result.ok).length;
  return jsonResponse({
    ok: failed === 0,
    processed: results.length,
    completed: results.filter((result) => result.status === 'completed').length,
    failed,
    results,
  });
}

function encodeObjectPath(key: string): string {
  return key
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function toStorageObjectRef(row: MediaAssetRow): StorageObjectRef | null {
  const bucket = stringOrNull(row.storage_bucket);
  const key = stringOrNull(row.storage_key);
  return bucket && key ? { bucket, key } : null;
}

function ensureServiceConfig(env: AccountDeletionDeps['env']): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

class SupabaseDeletionStore implements AccountDeletionStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
    private readonly now: () => string,
  ) {}

  async listOpenRequests(limit: number): Promise<AccountDeletionRequestRow[]> {
    return this.restJson<AccountDeletionRequestRow[]>(
      `/rest/v1/bc_account_deletion_requests?select=*&status=in.(requested,failed)&order=requested_at.asc&limit=${limit}`,
    );
  }

  async getRequest(requestId: string): Promise<AccountDeletionRequestRow | null> {
    const rows = await this.restJson<AccountDeletionRequestRow[]>(
      `/rest/v1/bc_account_deletion_requests?select=*&id=eq.${encodeURIComponent(requestId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async markProcessing(
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    const saved = await this.patchRequest(request, {
      status: 'processing',
      metadata,
      updated_at: this.now(),
    });
    await this.insertLifecycleEvent('account deletion processing started', saved, metadata);
    return saved;
  }

  async markCompleted(
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    const saved = await this.patchRequest(request, {
      status: 'completed',
      completed_at: this.now(),
      metadata,
      updated_at: this.now(),
    });
    await this.insertLifecycleEvent('account deletion completed', saved, metadata);
    return saved;
  }

  async markFailed(
    request: AccountDeletionRequestRow,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    const saved = await this.patchRequest(request, {
      status: 'failed',
      metadata: { ...metadata, last_error: message },
      updated_at: this.now(),
    });
    await this.insertLifecycleEvent('account deletion failed', saved, {
      ...metadata,
      last_error: message,
    });
    return saved;
  }

  async listStorageObjects(profileId: string): Promise<StorageObjectRef[]> {
    const assets = await this.listMediaAssets(profileId);
    const assetIds = assets
      .map((row) => stringOrNull(row.id))
      .filter((id): id is string => Boolean(id));
    const refs = assets
      .map(toStorageObjectRef)
      .filter((ref): ref is StorageObjectRef => Boolean(ref));

    if (assetIds.length > 0) {
      const ids = assetIds.map((id) => encodeURIComponent(id)).join(',');
      const variants = await this.restJson<MediaAssetRow[]>(
        `/rest/v1/bc_media_variants?select=storage_bucket,storage_key&asset_id=in.(${ids})`,
      );
      refs.push(...variants.map(toStorageObjectRef).filter((ref): ref is StorageObjectRef => Boolean(ref)));
    }

    return normalizeStorageObjects(refs);
  }

  async markProfileMediaDeleted(profileId: string, metadata: Record<string, unknown>): Promise<number> {
    const assets = await this.listMediaAssets(profileId);
    const assetIds = assets
      .map((row) => stringOrNull(row.id))
      .filter((id): id is string => Boolean(id));

    if (assetIds.length > 0) {
      const ids = assetIds.map((id) => encodeURIComponent(id)).join(',');
      await this.restText(`/rest/v1/bc_media_variants?asset_id=in.(${ids})`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    }

    const rows = await this.restJson<unknown[]>(
      `/rest/v1/bc_media_assets?owner_profile_id=eq.${encodeURIComponent(profileId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          storage_bucket: null,
          storage_key: null,
          remote_url: null,
          upload_status: 'deleted',
          moderation_status: 'rejected',
          visibility: 'private',
          metadata,
          updated_at: this.now(),
        }),
      },
    );
    return rows.length;
  }

  async deleteStorageObject(ref: StorageObjectRef): Promise<void> {
    await this.restText(
      `/storage/v1/object/${encodeURIComponent(ref.bucket)}/${encodeObjectPath(ref.key)}`,
      { method: 'DELETE' },
      [200, 204, 404],
    );
  }

  async deleteAuthUser(userId: string): Promise<void> {
    await this.restText(
      `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
      [200, 204, 404],
    );
  }

  private async listMediaAssets(profileId: string): Promise<MediaAssetRow[]> {
    return this.restJson<MediaAssetRow[]>(
      `/rest/v1/bc_media_assets?select=id,storage_bucket,storage_key&owner_profile_id=eq.${encodeURIComponent(profileId)}`,
    );
  }

  private async patchRequest(
    request: AccountDeletionRequestRow,
    body: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    const rows = await this.restJson<AccountDeletionRequestRow[]>(
      `/rest/v1/bc_account_deletion_requests?id=eq.${encodeURIComponent(request.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      },
    );
    return rows[0] ?? { ...request, ...body } as AccountDeletionRequestRow;
  }

  private async insertLifecycleEvent(
    reason: string,
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.restText('/rest/v1/bc_account_lifecycle_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_profile_id: null,
        target_profile_id: null,
        target_user_id: null,
        event_type: 'account_deletion_status_changed',
        reason,
        metadata: {
          ...metadata,
          request_id: request.id,
          request_user_id: request.user_id,
          request_profile_id: request.profile_id,
        },
      }),
    }, [200, 201, 204]);
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
    const text = await this.restText(path, init, okStatuses);
    return text ? JSON.parse(text) as T : ([] as T);
  }

  private async restText(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201, 204],
  ): Promise<string> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.config.key,
        Authorization: `Bearer ${this.config.key}`,
        ...JSON_HEADERS,
        ...(init.headers ?? {}),
      },
    });

    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }

    return res.text();
  }
}

export function createSupabaseDeletionStore(
  env: AccountDeletionDeps['env'],
  fetchImpl: typeof fetch,
  now: () => string,
): AccountDeletionStore {
  return new SupabaseDeletionStore(ensureServiceConfig(env), fetchImpl, now);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno.env.get(key);
    const now = () => new Date().toISOString();

    let store: AccountDeletionStore;
    try {
      store = createSupabaseDeletionStore(env, fetch, now);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    return handleAccountDeletionWorkerRequest(req, { env, now, store });
  });
}
