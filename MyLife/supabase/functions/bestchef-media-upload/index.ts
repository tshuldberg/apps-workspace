/**
 * BestChef signed media upload Edge Function.
 *
 * Creates a server-approved Storage key and pending `bc_media_assets` row.
 * The client receives only a short-lived signed upload URL. Service-role
 * credentials remain server-side.
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';
import {
  buildMediaStorageKey,
  validateMediaUploadIntent,
  type MediaUploadIntent,
} from '../_shared/media.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export interface MediaUploadAsset {
  id: string;
  owner_profile_id: string;
  owner_kind: string;
  owner_id: string;
  media_kind: string;
  storage_bucket: string;
  storage_key: string;
  upload_status: string;
  moderation_status: string;
  visibility: string;
}

export interface SignedUploadResult {
  signedUrl: string;
  token: string | null;
}

export interface ActionQuotaResult {
  allowed: boolean;
  reason: string;
}

export interface MediaUploadStore {
  getProfileId(userId: string): Promise<string | null>;
  /** Durable per-user upload quota (bc_consume_action_quota, 'media_upload'). */
  consumeActionQuota(profileId: string): Promise<ActionQuotaResult>;
  createSignedUploadUrl(bucket: string, key: string): Promise<SignedUploadResult>;
  createPendingAsset(input: {
    profileId: string;
    intent: MediaUploadIntent;
    bucket: string;
    key: string;
    uploadId: string;
  }): Promise<MediaUploadAsset>;
}

export interface MediaUploadDeps {
  env: (key: string) => string | undefined;
  randomId: () => string;
  store: MediaUploadStore;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jsonError(
  kind: string,
  message: string,
  status: number,
  params?: Record<string, unknown>,
): Response {
  // `kind` (+ `params`) is the client contract; `message` is ops detail and
  // the pre-2.2 client fallback, never for user display (plan 33 Phase 2.2).
  return jsonResponse(
    { ok: false, error: params ? { kind, message, params } : { kind, message } },
    status,
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function ensureServiceConfig(env: MediaUploadDeps['env']): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json();
  return objectRecord(body);
}

export async function handleMediaUploadRequest(
  req: Request,
  deps: MediaUploadDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST for media upload intents.', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return jsonError('auth', 'Missing or invalid Authorization header.', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const validation = validateMediaUploadIntent(body);
  if (!validation.ok) {
    return jsonError(validation.code, validation.message, 400, validation.params);
  }

  const profileId = await deps.store.getProfileId(userId);
  if (!profileId) {
    return jsonError('auth', 'BestChef profile is required before uploading media.', 403);
  }

  // Durable rate limit (plan 33 Phase 1.2). The Postgres ledger survives Edge
  // isolate recycling, unlike an in-memory counter.
  const quota = await deps.store.consumeActionQuota(profileId);
  if (!quota.allowed) {
    return jsonError('rate_limited', 'Upload limit reached. Try again later.', 429);
  }

  const uploadId = deps.randomId();
  const storageKey = buildMediaStorageKey({
    userId,
    ownerKind: validation.intent.ownerKind,
    ownerId: validation.intent.ownerId,
    uploadId,
    extension: validation.extension,
  });

  const signedUpload = await deps.store.createSignedUploadUrl(validation.bucket, storageKey);
  const asset = await deps.store.createPendingAsset({
    profileId,
    intent: validation.intent,
    bucket: validation.bucket,
    key: storageKey,
    uploadId,
  });

  return jsonResponse({
    ok: true,
    assetId: asset.id,
    bucket: validation.bucket,
    key: storageKey,
    signedUploadUrl: signedUpload.signedUrl,
    token: signedUpload.token,
    maxBytes: validation.maxBytes,
    uploadStatus: asset.upload_status,
    moderationStatus: asset.moderation_status,
  });
}

class SupabaseMediaUploadStore implements MediaUploadStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async getProfileId(userId: string): Promise<string | null> {
    const rows = await this.restJson<Array<{ id?: string }>>(
      `/rest/v1/social_profiles?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    return rows[0]?.id ?? null;
  }

  async consumeActionQuota(profileId: string): Promise<ActionQuotaResult> {
    const result = await this.restJson<{ allowed?: boolean; reason?: string }>(
      '/rest/v1/rpc/bc_consume_action_quota',
      {
        method: 'POST',
        body: JSON.stringify({
          p_profile_id: profileId,
          p_action: 'media_upload',
          p_context: null,
        }),
      },
    );
    return {
      allowed: result?.allowed === true,
      reason: typeof result?.reason === 'string' ? result.reason : 'unknown',
    };
  }

  async createSignedUploadUrl(bucket: string, key: string): Promise<SignedUploadResult> {
    const body = await this.restJson<Record<string, unknown>>(
      `/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`,
      { method: 'POST', body: '{}' },
    );
    const signedUrl = stringOrNull(body.signedURL) ??
      stringOrNull(body.signedUrl) ??
      stringOrNull(body.url);
    if (!signedUrl) throw new Error('Storage did not return a signed upload URL.');
    return {
      signedUrl,
      token: stringOrNull(body.token),
    };
  }

  async createPendingAsset(input: {
    profileId: string;
    intent: MediaUploadIntent;
    bucket: string;
    key: string;
    uploadId: string;
  }): Promise<MediaUploadAsset> {
    const rows = await this.restJson<MediaUploadAsset[]>(
      '/rest/v1/bc_media_assets',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          owner_profile_id: input.profileId,
          owner_kind: input.intent.ownerKind,
          owner_id: input.intent.ownerId,
          media_kind: input.intent.mediaKind,
          storage_bucket: input.bucket,
          storage_key: input.key,
          remote_url: null,
          content_hash: input.intent.contentHash,
          byte_size: input.intent.byteSize,
          upload_status: 'pending',
          moderation_status: 'pending',
          visibility: 'private',
          metadata: {
            upload_id: input.uploadId,
            mime_type: input.intent.mimeType,
            evidence_kind: input.intent.evidenceKind,
            created_by: 'bestchef-media-upload',
          },
        }),
      },
      [200, 201],
    );
    const asset = rows[0];
    if (!asset) throw new Error('Media asset row was not created.');
    return asset;
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
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

    const text = await res.text();
    return text ? JSON.parse(text) as T : ([] as T);
  }
}

function encodeObjectPath(key: string): string {
  return key
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function createSupabaseMediaUploadStore(
  env: MediaUploadDeps['env'],
  fetchImpl: typeof fetch,
): MediaUploadStore {
  return new SupabaseMediaUploadStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno.env.get(key);
    let store: MediaUploadStore;
    try {
      store = createSupabaseMediaUploadStore(env, fetch);
    } catch (err) {
      return jsonError('config', err instanceof Error ? err.message : String(err), 503);
    }

    return handleMediaUploadRequest(req, {
      env,
      randomId: () => crypto.randomUUID(),
      store,
    });
  });
}
