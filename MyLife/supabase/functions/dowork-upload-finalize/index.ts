/**
 * DoWork signed upload + finalize Edge Function.
 *
 * Two-step contract (mirrors bestchef-media-upload/-finalize, collapsed
 * into one function because DoWork's metadata rows ARE the domain rows):
 *
 *   POST { action: 'sign', kind, contentType, contentLength }
 *     -> validates auth, kind caps, and (for trainer kinds) that the
 *        caller owns a dw_trainers row; returns an absolute signed
 *        Storage upload URL plus the server-chosen object key.
 *
 *   POST { action: 'finalize', kind: 'trainer_video', key, exerciseSlug, ... }
 *     -> verifies the object exists and belongs to the caller's folder,
 *        then inserts the dw_trainer_videos row server-side with the
 *        bucket key as storage_path. The client never writes that row,
 *        which is what guarantees device-local paths can't leak into it.
 *
 *   POST { action: 'finalize', kind: 'avatar', key }
 *     -> verifies the object, updates dw_user_profiles.avatar_url.
 *
 *   POST { action: 'finalize', kind: 'share_hero' | 'share_video', key }
 *     -> verifies the object, returns the public URL; the client updates
 *        its own dw_workout_shares row under owner RLS.
 *
 * Object keys are always `<user_id>/<kind-dir>/<upload_id>.<ext>` so the
 * storage owner-folder policies and delete-account prefix cleanup hold.
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export type DoWorkUploadKind =
  | 'trainer_video'
  | 'trainer_thumbnail'
  | 'share_hero'
  | 'share_video'
  | 'avatar'
  | 'form_check';

export const DOWORK_UPLOAD_RULES: Record<
  DoWorkUploadKind,
  {
    bucket: string;
    dir: string;
    maxBytes: number;
    mimes: Record<string, string>;
    requiresTrainer: boolean;
    publicRead: boolean;
  }
> = {
  trainer_video: {
    bucket: 'dowork-trainer-videos',
    dir: 'videos',
    maxBytes: 500_000_000,
    mimes: { 'video/mp4': 'mp4', 'video/quicktime': 'mov' },
    requiresTrainer: true,
    publicRead: false,
  },
  trainer_thumbnail: {
    bucket: 'dowork-share-media',
    dir: 'trainer-thumbs',
    maxBytes: 2_000_000,
    mimes: { 'image/jpeg': 'jpg', 'image/webp': 'webp' },
    requiresTrainer: true,
    publicRead: true,
  },
  share_hero: {
    bucket: 'dowork-share-media',
    dir: 'share-heroes',
    maxBytes: 5_000_000,
    mimes: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    requiresTrainer: false,
    publicRead: true,
  },
  share_video: {
    bucket: 'dowork-share-media',
    dir: 'share-videos',
    maxBytes: 250_000_000,
    mimes: { 'video/mp4': 'mp4', 'video/quicktime': 'mov' },
    requiresTrainer: false,
    publicRead: true,
  },
  avatar: {
    bucket: 'dowork-avatars',
    dir: 'avatars',
    maxBytes: 2_000_000,
    mimes: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    requiresTrainer: false,
    publicRead: true,
  },
  // form_check keys are `<client_link_id>/<uuid>.<ext>` (not user-folder
  // scoped); participation is enforced through the client link, not the folder.
  form_check: {
    bucket: 'dowork-form-checks',
    dir: 'form-checks',
    maxBytes: 500_000_000,
    mimes: { 'video/mp4': 'mp4', 'video/quicktime': 'mov' },
    requiresTrainer: false,
    publicRead: false,
  },
};

const TRAINER_VIDEO_ANGLES = ['front', 'side', 'three_quarter', 'overhead', 'back'];

export interface DoWorkTrainerVideoRow {
  id: string;
  trainer_id: string;
  exercise_slug: string;
  storage_path: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  angle: string | null;
  is_primary: boolean;
  is_hidden: boolean;
  sort_order: number;
  title: string | null;
  description: string | null;
  is_premium: boolean;
}

export interface DoWorkFormCheckRow {
  id: string;
  client_link_id: string;
  author_user_id: string;
  exercise_slug: string | null;
  storage_path: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  note: string | null;
  status: string;
  created_at: string;
}

export interface TrainerUploadStatus {
  id: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface DoWorkUploadStore {
  getTrainerForUser(userId: string): Promise<TrainerUploadStatus | null>;
  createSignedUploadUrl(bucket: string, key: string): Promise<{ signedUrl: string; token: string | null }>;
  objectExists(bucket: string, key: string): Promise<boolean>;
  insertTrainerVideo(input: {
    trainerId: string;
    exerciseSlug: string;
    storagePath: string;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    angle: string | null;
    isPrimary: boolean;
    sortOrder: number;
    title: string | null;
    description: string | null;
    isPremium: boolean;
  }): Promise<DoWorkTrainerVideoRow>;
  setProfileAvatar(userId: string, publicUrl: string): Promise<void>;
  publicUrl(bucket: string, key: string): string;
  /**
   * Whether the caller participates in a client link, and whether that link is
   * currently active. Returns null when the link does not exist.
   */
  getClientLinkParticipation(
    userId: string,
    clientLinkId: string,
  ): Promise<{ isParticipant: boolean; isActive: boolean } | null>;
  insertFormCheck(input: {
    clientLinkId: string;
    authorUserId: string;
    exerciseSlug: string | null;
    storagePath: string;
    thumbnailPath: string | null;
    durationSeconds: number | null;
    note: string | null;
  }): Promise<DoWorkFormCheckRow>;
}

export interface DoWorkUploadDeps {
  randomId: () => string;
  store: DoWorkUploadStore;
  /**
   * Best-effort push fan-out (dowork-notify). Never allowed to fail a finalize;
   * optional so tests can omit it.
   */
  notify?: (type: 'new_video' | 'form_check', record: Record<string, unknown>) => Promise<void>;
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

function intOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function handleSign(
  body: Record<string, unknown>,
  userId: string,
  deps: DoWorkUploadDeps,
): Promise<Response> {
  const kind = stringOrNull(body.kind) as DoWorkUploadKind | null;
  const rule = kind ? DOWORK_UPLOAD_RULES[kind] : undefined;
  if (!kind || !rule) {
    return jsonError('invalid_input', 'Unknown upload kind.', 400);
  }

  if (kind === 'form_check') {
    return handleSignFormCheck(body, userId, deps);
  }

  const contentType = stringOrNull(body.contentType);
  if (!contentType || !rule.mimes[contentType]) {
    return jsonError('invalid_input', `Unsupported content type for ${kind}.`, 415);
  }

  const contentLength = intOrNull(body.contentLength);
  if (!contentLength || contentLength <= 0) {
    return jsonError('invalid_input', 'contentLength is required.', 400);
  }
  if (contentLength > rule.maxBytes) {
    return jsonError('too_large', `Max ${rule.maxBytes} bytes for ${kind}.`, 413);
  }

  if (rule.requiresTrainer) {
    const trainer = await deps.store.getTrainerForUser(userId);
    if (!trainer) {
      return jsonError('auth', 'A trainer profile is required for this upload.', 403);
    }
    // Moderation truth: deactivated or unverified trainers cannot stage new
    // trainer content, only serve nothing and preview what already exists.
    if (!trainer.is_active || !trainer.is_verified) {
      return jsonError('auth', 'This trainer profile is not currently active and verified.', 403);
    }
  }

  const key = `${userId}/${rule.dir}/${deps.randomId()}.${rule.mimes[contentType]}`;
  const signed = await deps.store.createSignedUploadUrl(rule.bucket, key);

  return jsonResponse({
    ok: true,
    bucket: rule.bucket,
    key,
    uploadUrl: signed.signedUrl,
    token: signed.token,
    maxBytes: rule.maxBytes,
  });
}

async function handleSignFormCheck(
  body: Record<string, unknown>,
  userId: string,
  deps: DoWorkUploadDeps,
): Promise<Response> {
  const rule = DOWORK_UPLOAD_RULES.form_check;

  const clientLinkId = stringOrNull(body.clientLinkId);
  if (!clientLinkId) {
    return jsonError('invalid_input', 'clientLinkId is required for form checks.', 400);
  }

  const contentType = stringOrNull(body.contentType);
  if (!contentType || !rule.mimes[contentType]) {
    return jsonError('invalid_input', 'Unsupported content type for form_check.', 415);
  }

  const contentLength = intOrNull(body.contentLength);
  if (!contentLength || contentLength <= 0) {
    return jsonError('invalid_input', 'contentLength is required.', 400);
  }
  if (contentLength > rule.maxBytes) {
    return jsonError('too_large', `Max ${rule.maxBytes} bytes for form_check.`, 413);
  }

  const participation = await deps.store.getClientLinkParticipation(userId, clientLinkId);
  if (!participation || !participation.isParticipant || !participation.isActive) {
    return jsonError('auth', 'An active client link is required for this upload.', 403);
  }

  const key = `${clientLinkId}/${deps.randomId()}.${rule.mimes[contentType]}`;
  const signed = await deps.store.createSignedUploadUrl(rule.bucket, key);

  return jsonResponse({
    ok: true,
    bucket: rule.bucket,
    key,
    uploadUrl: signed.signedUrl,
    token: signed.token,
    maxBytes: rule.maxBytes,
  });
}

async function handleFinalizeFormCheck(
  body: Record<string, unknown>,
  userId: string,
  deps: DoWorkUploadDeps,
): Promise<Response> {
  const rule = DOWORK_UPLOAD_RULES.form_check;

  const clientLinkId = stringOrNull(body.clientLinkId);
  if (!clientLinkId) {
    return jsonError('invalid_input', 'clientLinkId is required for form checks.', 400);
  }

  const key = stringOrNull(body.key);
  if (!key) {
    return jsonError('invalid_input', 'Storage key is required.', 400);
  }
  if (!key.startsWith(`${clientLinkId}/`)) {
    return jsonError('auth', 'Storage key does not belong to this client link.', 403);
  }
  if (key.includes('..')) {
    return jsonError('invalid_input', 'Invalid storage key.', 400);
  }

  const participation = await deps.store.getClientLinkParticipation(userId, clientLinkId);
  if (!participation || !participation.isParticipant || !participation.isActive) {
    return jsonError('auth', 'An active client link is required for this upload.', 403);
  }

  const exists = await deps.store.objectExists(rule.bucket, key);
  if (!exists) {
    return jsonError('not_found', 'Uploaded object was not found; upload before finalizing.', 409);
  }

  const thumbnailKey = stringOrNull(body.thumbnailKey);
  if (thumbnailKey && !thumbnailKey.startsWith(`${clientLinkId}/`)) {
    return jsonError('auth', 'Thumbnail key does not belong to this client link.', 403);
  }

  const formCheck = await deps.store.insertFormCheck({
    clientLinkId,
    authorUserId: userId,
    exerciseSlug: stringOrNull(body.exerciseSlug),
    storagePath: key,
    thumbnailPath: thumbnailKey,
    durationSeconds: intOrNull(body.durationSeconds),
    note: stringOrNull(body.note),
  });

  if (deps.notify) {
    try {
      await deps.notify('form_check', formCheck as unknown as Record<string, unknown>);
    } catch {
      // best-effort: notification failure must not fail the finalize.
    }
  }

  return jsonResponse({ ok: true, formCheck });
}

async function handleFinalize(
  body: Record<string, unknown>,
  userId: string,
  deps: DoWorkUploadDeps,
): Promise<Response> {
  const kind = stringOrNull(body.kind) as DoWorkUploadKind | null;
  const rule = kind ? DOWORK_UPLOAD_RULES[kind] : undefined;
  if (!kind || !rule) {
    return jsonError('invalid_input', 'Unknown upload kind.', 400);
  }

  if (kind === 'form_check') {
    return handleFinalizeFormCheck(body, userId, deps);
  }

  const key = stringOrNull(body.key);
  if (!key) {
    return jsonError('invalid_input', 'Storage key is required.', 400);
  }
  if (!key.startsWith(`${userId}/`)) {
    return jsonError('auth', 'Storage key does not belong to this user.', 403);
  }
  if (key.includes('..')) {
    return jsonError('invalid_input', 'Invalid storage key.', 400);
  }

  const exists = await deps.store.objectExists(rule.bucket, key);
  if (!exists) {
    return jsonError('not_found', 'Uploaded object was not found; upload before finalizing.', 409);
  }

  if (kind === 'trainer_video') {
    const trainer = await deps.store.getTrainerForUser(userId);
    if (!trainer) {
      return jsonError('auth', 'A trainer profile is required for this upload.', 403);
    }
    if (!trainer.is_active || !trainer.is_verified) {
      return jsonError('auth', 'This trainer profile is not currently active and verified.', 403);
    }
    const trainerId = trainer.id;

    const exerciseSlug = stringOrNull(body.exerciseSlug);
    if (!exerciseSlug) {
      return jsonError('invalid_input', 'exerciseSlug is required for trainer videos.', 400);
    }

    const angle = stringOrNull(body.angle);
    if (angle && !TRAINER_VIDEO_ANGLES.includes(angle)) {
      return jsonError('invalid_input', `angle must be one of ${TRAINER_VIDEO_ANGLES.join(', ')}.`, 400);
    }

    const thumbnailKey = stringOrNull(body.thumbnailKey);
    if (thumbnailKey && !thumbnailKey.startsWith(`${userId}/`)) {
      return jsonError('auth', 'Thumbnail key does not belong to this user.', 403);
    }

    const video = await deps.store.insertTrainerVideo({
      trainerId,
      exerciseSlug,
      storagePath: key,
      thumbnailUrl: thumbnailKey
        ? deps.store.publicUrl(DOWORK_UPLOAD_RULES.trainer_thumbnail.bucket, thumbnailKey)
        : null,
      durationSeconds: intOrNull(body.durationSeconds),
      angle,
      isPrimary: body.isPrimary === true,
      sortOrder: intOrNull(body.sortOrder) ?? 0,
      title: stringOrNull(body.title),
      description: stringOrNull(body.description),
      isPremium: body.isPremium === true,
    });

    if (deps.notify && video.is_hidden === false) {
      try {
        await deps.notify('new_video', video as unknown as Record<string, unknown>);
      } catch {
        // best-effort: notification failure must not fail the finalize.
      }
    }

    return jsonResponse({ ok: true, video });
  }

  if (kind === 'avatar') {
    const publicUrl = deps.store.publicUrl(rule.bucket, key);
    await deps.store.setProfileAvatar(userId, publicUrl);
    return jsonResponse({ ok: true, avatarUrl: publicUrl });
  }

  // share_hero / share_video / trainer_thumbnail: object verified; the
  // owner-RLS row update happens client-side with this URL.
  return jsonResponse({
    ok: true,
    key,
    publicUrl: rule.publicRead ? deps.store.publicUrl(rule.bucket, key) : null,
  });
}

export async function handleDoWorkUploadRequest(
  req: Request,
  deps: DoWorkUploadDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST.', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return jsonError('auth', 'Missing or invalid Authorization header.', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const action = stringOrNull(body.action);
  if (action === 'sign') return handleSign(body, userId, deps);
  if (action === 'finalize') return handleFinalize(body, userId, deps);
  return jsonError('invalid_input', "action must be 'sign' or 'finalize'.", 400);
}

// ── Supabase-backed store (service role, REST) ─────────────────────────────

function ensureServiceConfig(env: (key: string) => string | undefined): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

function encodeObjectPath(key: string): string {
  return key
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

class SupabaseDoWorkUploadStore implements DoWorkUploadStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async getTrainerForUser(userId: string): Promise<TrainerUploadStatus | null> {
    const rows = await this.restJson<TrainerUploadStatus[]>(
      `/rest/v1/dw_trainers?select=id,is_active,is_verified&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async createSignedUploadUrl(bucket: string, key: string): Promise<{ signedUrl: string; token: string | null }> {
    const body = await this.restJson<Record<string, unknown>>(
      `/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`,
      { method: 'POST', body: '{}' },
    );
    const raw = stringOrNull(body.signedURL) ?? stringOrNull(body.signedUrl) ?? stringOrNull(body.url);
    if (!raw) throw new Error('Storage did not return a signed upload URL.');
    const absolute = raw.startsWith('http') ? raw : `${this.config.url}/storage/v1${raw}`;
    return { signedUrl: absolute, token: stringOrNull(body.token) };
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    const res = await this.fetchImpl(
      `${this.config.url}/storage/v1/object/info/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`,
      { headers: this.authHeaders() },
    );
    return res.ok;
  }

  async insertTrainerVideo(input: {
    trainerId: string;
    exerciseSlug: string;
    storagePath: string;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    angle: string | null;
    isPrimary: boolean;
    sortOrder: number;
    title: string | null;
    description: string | null;
    isPremium: boolean;
  }): Promise<DoWorkTrainerVideoRow> {
    const rows = await this.restJson<DoWorkTrainerVideoRow[]>(
      '/rest/v1/dw_trainer_videos',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          trainer_id: input.trainerId,
          exercise_slug: input.exerciseSlug,
          storage_path: input.storagePath,
          thumbnail_url: input.thumbnailUrl,
          duration_seconds: input.durationSeconds,
          angle: input.angle,
          is_primary: input.isPrimary,
          sort_order: input.sortOrder,
          title: input.title,
          description: input.description,
          is_premium: input.isPremium,
        }),
      },
      [200, 201],
    );
    const video = rows[0];
    if (!video) throw new Error('Trainer video row was not created.');
    return video;
  }

  async getClientLinkParticipation(
    userId: string,
    clientLinkId: string,
  ): Promise<{ isParticipant: boolean; isActive: boolean } | null> {
    const links = await this.restJson<
      Array<{ trainer_id: string; client_user_id: string | null; status: string }>
    >(
      `/rest/v1/dw_client_links?select=trainer_id,client_user_id,status&id=eq.${encodeURIComponent(clientLinkId)}&limit=1`,
    );
    const link = links[0];
    if (!link) return null;
    const isActive = link.status === 'active';
    if (link.client_user_id === userId) {
      return { isParticipant: true, isActive };
    }
    const trainers = await this.restJson<Array<{ user_id: string }>>(
      `/rest/v1/dw_trainers?select=user_id&id=eq.${encodeURIComponent(link.trainer_id)}&limit=1`,
    );
    const isParticipant = trainers[0]?.user_id === userId;
    return { isParticipant, isActive };
  }

  async insertFormCheck(input: {
    clientLinkId: string;
    authorUserId: string;
    exerciseSlug: string | null;
    storagePath: string;
    thumbnailPath: string | null;
    durationSeconds: number | null;
    note: string | null;
  }): Promise<DoWorkFormCheckRow> {
    const rows = await this.restJson<DoWorkFormCheckRow[]>(
      '/rest/v1/dw_form_checks',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          client_link_id: input.clientLinkId,
          author_user_id: input.authorUserId,
          exercise_slug: input.exerciseSlug,
          storage_path: input.storagePath,
          thumbnail_path: input.thumbnailPath,
          duration_seconds: input.durationSeconds,
          note: input.note,
        }),
      },
      [200, 201],
    );
    const formCheck = rows[0];
    if (!formCheck) throw new Error('Form check row was not created.');
    return formCheck;
  }

  async setProfileAvatar(userId: string, publicUrl: string): Promise<void> {
    await this.restJson<unknown>(
      `/rest/v1/dw_user_profiles?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ avatar_url: publicUrl, updated_at: new Date().toISOString() }),
      },
      [200, 204],
    );
  }

  publicUrl(bucket: string, key: string): string {
    return `${this.config.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`;
  }

  private authHeaders(): Record<string, string> {
    return {
      apikey: this.config.key,
      Authorization: `Bearer ${this.config.key}`,
    };
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: {
        ...this.authHeaders(),
        ...JSON_HEADERS,
        ...(init.headers ?? {}),
      },
    });

    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }

    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

export function createSupabaseDoWorkUploadStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): DoWorkUploadStore {
  return new SupabaseDoWorkUploadStore(ensureServiceConfig(env), fetchImpl);
}

/**
 * Best-effort caller for the internal dowork-notify function. Posts the row to
 * the notify endpoint with the shared internal secret header. Returns a no-op
 * when the secret or URL is unset (local/dev), and every network error is
 * swallowed by the caller so finalize never fails on notification.
 */
function createNotifyInvoker(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): DoWorkUploadDeps['notify'] {
  const url = env('SUPABASE_URL')?.replace(/\/+$/, '');
  const secret = env('DOWORK_INTERNAL_SECRET');
  if (!url || !secret) return undefined;
  return async (type, record) => {
    await fetchImpl(`${url}/functions/v1/dowork-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dowork-internal': secret },
      body: JSON.stringify({ type, record }),
    });
  };
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno!.env.get(key);
    let store: DoWorkUploadStore;
    try {
      store = createSupabaseDoWorkUploadStore(env, fetch);
    } catch (err) {
      return jsonError('config', err instanceof Error ? err.message : String(err), 503);
    }
    return handleDoWorkUploadRequest(req, {
      randomId: () => crypto.randomUUID(),
      store,
      notify: createNotifyInvoker(env, fetch),
    });
  });
}
