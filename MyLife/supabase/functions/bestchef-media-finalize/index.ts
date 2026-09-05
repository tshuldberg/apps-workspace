/**
 * BestChef media finalize Edge Function.
 *
 * Marks a pending upload as uploaded after the client completes the signed
 * Storage upload. It does not approve public delivery. Moderation and HTTPS
 * public URL promotion stay server-side follow-up steps.
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export interface MediaAssetForFinalize {
  id: string;
  owner_profile_id: string;
  metadata: Record<string, unknown>;
}

export interface FinalizedMediaAsset {
  id: string;
  upload_status: string;
  moderation_status: string;
  visibility: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface MediaFinalizeStore {
  getProfileId(userId: string): Promise<string | null>;
  getAssetForProfile(assetId: string, profileId: string): Promise<MediaAssetForFinalize | null>;
  finalizeAsset(input: {
    asset: MediaAssetForFinalize;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    byteSize: number | null;
    contentHash: string | null;
    now: string;
  }): Promise<FinalizedMediaAsset>;
}

export interface MediaFinalizeDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: MediaFinalizeStore;
}

interface FinalizeInput {
  assetId: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  byteSize: number | null;
  contentHash: string | null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jsonError(kind: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: { kind, message } }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function intOrNull(value: unknown): number | null {
  const n = numberOrNull(value);
  return n === null ? null : Math.max(0, Math.floor(n));
}

// Sane server-side upper bounds so a malicious/broken client cannot persist
// absurd media dimensions (audit M2). Anything over the cap is dropped to
// null rather than rejecting the whole finalize (the dimension is advisory
// metadata, not integrity-critical).
const MAX_DIMENSION_PX = 8192; // generous 8K ceiling for width/height
const MAX_DURATION_MS = 6 * 60 * 60 * 1000; // 6h; far above any real clip

function boundedIntOrNull(value: unknown, max: number): number | null {
  const n = intOrNull(value);
  return n === null || n > max ? null : n;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function ensureServiceConfig(env: MediaFinalizeDeps['env']): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

async function parseFinalizeInput(req: Request): Promise<FinalizeInput | { error: string }> {
  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return { error: 'Request body must be valid JSON.' };
  }

  if (stringOrNull(body.remoteUrl) || stringOrNull(body.localUri)) {
    return { error: 'Finalize payload must not include local or remote media URLs.' };
  }

  const assetId = stringOrNull(body.assetId ?? body.asset_id);
  if (!assetId) return { error: 'Media asset id is required.' };

  const width = boundedIntOrNull(body.width, MAX_DIMENSION_PX);
  const height = boundedIntOrNull(body.height, MAX_DIMENSION_PX);
  const durationMs = boundedIntOrNull(body.durationMs ?? body.duration_ms, MAX_DURATION_MS);
  const byteSize = intOrNull(body.byteSize ?? body.byte_size);
  const contentHash = stringOrNull(body.contentHash ?? body.content_hash);

  return { assetId, width, height, durationMs, byteSize, contentHash };
}

export async function handleMediaFinalizeRequest(
  req: Request,
  deps: MediaFinalizeDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST for media finalize.', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return jsonError('auth', 'Missing or invalid Authorization header.', 401);
  }

  const input = await parseFinalizeInput(req);
  if ('error' in input) {
    return jsonError('invalid_input', input.error, 400);
  }

  const profileId = await deps.store.getProfileId(userId);
  if (!profileId) {
    return jsonError('auth', 'BestChef profile is required before finalizing media.', 403);
  }

  const asset = await deps.store.getAssetForProfile(input.assetId, profileId);
  if (!asset) {
    return jsonError('not_found', 'Media asset was not found for this profile.', 404);
  }

  const finalized = await deps.store.finalizeAsset({
    asset,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    byteSize: input.byteSize,
    contentHash: input.contentHash,
    now: deps.now(),
  });

  return jsonResponse({
    ok: true,
    assetId: finalized.id,
    uploadStatus: finalized.upload_status,
    moderationStatus: finalized.moderation_status,
    visibility: finalized.visibility,
  });
}

class SupabaseMediaFinalizeStore implements MediaFinalizeStore {
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

  async getAssetForProfile(assetId: string, profileId: string): Promise<MediaAssetForFinalize | null> {
    const rows = await this.restJson<MediaAssetForFinalize[]>(
      `/rest/v1/bc_media_assets?select=id,owner_profile_id,metadata&id=eq.${encodeURIComponent(assetId)}&owner_profile_id=eq.${encodeURIComponent(profileId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async finalizeAsset(input: {
    asset: MediaAssetForFinalize;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    byteSize: number | null;
    contentHash: string | null;
    now: string;
  }): Promise<FinalizedMediaAsset> {
    const metadata = {
      ...objectRecord(input.asset.metadata),
      finalized_by: 'bestchef-media-finalize',
      finalized_at: input.now,
    };
    // Guarded on moderation_status: without it, re-calling finalize after a
    // moderator decision would reset the asset to pending/private and erase
    // the decision trail (console review 2026-07-04). Only never-decided
    // assets can (re)finalize.
    const rows = await this.restJson<FinalizedMediaAsset[]>(
      `/rest/v1/bc_media_assets?id=eq.${encodeURIComponent(input.asset.id)}&moderation_status=eq.pending`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          width: input.width,
          height: input.height,
          duration_ms: input.durationMs,
          byte_size: input.byteSize,
          content_hash: input.contentHash,
          upload_status: 'uploaded',
          moderation_status: 'pending',
          visibility: 'private',
          metadata,
          updated_at: input.now,
        }),
      },
      [200],
    );
    const asset = rows[0];
    if (!asset) throw new Error('Media asset was not finalized (already moderated or missing).');
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

export function createSupabaseMediaFinalizeStore(
  env: MediaFinalizeDeps['env'],
  fetchImpl: typeof fetch,
): MediaFinalizeStore {
  return new SupabaseMediaFinalizeStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno.env.get(key);
    let store: MediaFinalizeStore;
    try {
      store = createSupabaseMediaFinalizeStore(env, fetch);
    } catch (err) {
      return jsonError('config', err instanceof Error ? err.message : String(err), 503);
    }

    return handleMediaFinalizeRequest(req, {
      env,
      now: () => new Date().toISOString(),
      store,
    });
  });
}
