/**
 * DoWork playback-url Edge Function.
 *
 * Mints a short-lived (60 min) signed Storage URL after re-checking
 * entitlement server-side. The database paywall already gates row reads; this
 * function mirrors that policy so a signed URL is never handed out for content
 * the caller cannot see, and so form-check media (private, no select policy)
 * is reachable only by the two participants of the client link.
 *
 *   POST { videoId } with user JWT
 *     -> entitled when the video is free, owned by the caller, covered by a
 *        paid subscription (active unexpired, or cancelled with paid time
 *        remaining), or covered by an active client link. Every non-owner
 *        path additionally requires the trainer to be active and verified:
 *        moderation deactivation stops serving that trainer's content
 *        immediately. Owner preview is the one explicit exception, so a
 *        deactivated trainer can still review their own uploads.
 *
 *   POST { formCheckId, feedbackId? } with user JWT
 *     -> allowed only for the client link's client or the trainer's user.
 *        feedbackId signs a feedback reply video instead of the form check.
 *
 * 200 { url, expiresAt, kind, title, durationSeconds }.
 *
 * Trainer-video reads bump dw_trainer_videos.view_count, deduped to once per
 * user per video per hour via dw_video_view_marks. View accounting is strictly
 * best-effort and never blocks playback.
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export const SIGN_TTL_SECONDS = 3600;
const TRAINER_VIDEO_BUCKET = 'dowork-trainer-videos';
const FORM_CHECK_BUCKET = 'dowork-form-checks';

export interface TrainerVideoRow {
  id: string;
  trainer_id: string;
  storage_path: string;
  is_premium: boolean;
  is_hidden: boolean;
  title: string | null;
  duration_seconds: number | null;
}

export interface FormCheckRow {
  id: string;
  client_link_id: string;
  storage_path: string;
  duration_seconds: number | null;
  note: string | null;
}

export interface ClientLinkRow {
  id: string;
  trainer_id: string;
  client_user_id: string | null;
  status: string;
}

export interface FormFeedbackRow {
  id: string;
  form_check_id: string;
  reply_storage_path: string | null;
}

export interface TrainerStatusRow {
  user_id: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface PlaybackStore {
  getTrainerVideo(videoId: string): Promise<TrainerVideoRow | null>;
  getTrainerStatus(trainerId: string): Promise<TrainerStatusRow | null>;
  /** Active unexpired, or cancelled with paid time remaining. */
  hasPaidSubscription(userId: string, trainerId: string, nowIso: string): Promise<boolean>;
  hasActiveClientLink(userId: string, trainerId: string): Promise<boolean>;
  getFormCheck(formCheckId: string): Promise<FormCheckRow | null>;
  getClientLink(clientLinkId: string): Promise<ClientLinkRow | null>;
  getFormFeedback(feedbackId: string): Promise<FormFeedbackRow | null>;
  createSignedUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string>;
  markView(userId: string, videoId: string, hourBucketIso: string): Promise<boolean>;
  incrementViewCount(videoId: string): Promise<void>;
}

export interface PlaybackDeps {
  store: PlaybackStore;
  now: () => number;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorJson(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hourBucketIso(ms: number): string {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export async function handleDoWorkPlaybackUrlRequest(
  req: Request,
  deps: PlaybackDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return errorJson('method_not_allowed', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return errorJson('unauthorized', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return errorJson('invalid_input', 400);
  }

  const videoId = stringOrNull(body.videoId);
  const formCheckId = stringOrNull(body.formCheckId);
  if (Boolean(videoId) === Boolean(formCheckId)) {
    // Neither or both provided.
    return errorJson('invalid_input', 400);
  }

  const nowMs = deps.now();
  const expiresAt = new Date(nowMs + SIGN_TTL_SECONDS * 1000).toISOString();

  if (videoId) {
    const video = await deps.store.getTrainerVideo(videoId);
    if (!video || video.is_hidden) {
      return errorJson('not_found', 404);
    }

    const trainer = await deps.store.getTrainerStatus(video.trainer_id);
    if (!trainer) {
      return errorJson('not_found', 404);
    }
    const nowIso = new Date(nowMs).toISOString();
    const isOwner = trainer.user_id === userId;
    // Owner preview is the only path that survives deactivation; everyone
    // else needs the trainer active and verified before any entitlement math.
    const trainerServing = trainer.is_active && trainer.is_verified;
    const entitled =
      isOwner ||
      (trainerServing &&
        (video.is_premium === false ||
          (await deps.store.hasPaidSubscription(userId, video.trainer_id, nowIso)) ||
          (await deps.store.hasActiveClientLink(userId, video.trainer_id))));
    if (!entitled) {
      return errorJson('not_entitled', 403);
    }

    const url = await deps.store.createSignedUrl(TRAINER_VIDEO_BUCKET, video.storage_path, SIGN_TTL_SECONDS);

    // Best-effort deduped view count; never let this break playback.
    try {
      const isNew = await deps.store.markView(userId, video.id, hourBucketIso(nowMs));
      if (isNew) {
        await deps.store.incrementViewCount(video.id);
      }
    } catch {
      // ignore view accounting failures
    }

    return jsonResponse({
      url,
      expiresAt,
      kind: 'trainer_video',
      title: video.title ?? null,
      durationSeconds: video.duration_seconds ?? null,
    });
  }

  // form-check path
  const formCheck = await deps.store.getFormCheck(formCheckId!);
  if (!formCheck) {
    return errorJson('not_found', 404);
  }
  const link = await deps.store.getClientLink(formCheck.client_link_id);
  if (!link) {
    return errorJson('not_found', 404);
  }
  // Participation is identity, not serving status: a deactivated trainer can
  // still open their own private coaching threads.
  const linkTrainer = await deps.store.getTrainerStatus(link.trainer_id);
  const isParticipant =
    (link.client_user_id !== null && link.client_user_id === userId) ||
    (linkTrainer !== null && linkTrainer.user_id === userId);
  if (!isParticipant) {
    return errorJson('not_entitled', 403);
  }

  let path = formCheck.storage_path;
  let durationSeconds: number | null = formCheck.duration_seconds ?? null;
  let title: string | null = formCheck.note ?? null;

  const feedbackId = stringOrNull(body.feedbackId);
  if (feedbackId) {
    const feedback = await deps.store.getFormFeedback(feedbackId);
    if (!feedback || feedback.form_check_id !== formCheck.id || !feedback.reply_storage_path) {
      return errorJson('not_found', 404);
    }
    path = feedback.reply_storage_path;
    durationSeconds = null;
    title = null;
  }

  const url = await deps.store.createSignedUrl(FORM_CHECK_BUCKET, path, SIGN_TTL_SECONDS);
  return jsonResponse({
    url,
    expiresAt,
    kind: 'form_check',
    title,
    durationSeconds,
  });
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

class SupabasePlaybackStore implements PlaybackStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async getTrainerVideo(videoId: string): Promise<TrainerVideoRow | null> {
    const rows = await this.restJson<TrainerVideoRow[]>(
      `/rest/v1/dw_trainer_videos?select=id,trainer_id,storage_path,is_premium,is_hidden,title,duration_seconds&id=eq.${encodeURIComponent(videoId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getTrainerStatus(trainerId: string): Promise<TrainerStatusRow | null> {
    const rows = await this.restJson<TrainerStatusRow[]>(
      `/rest/v1/dw_trainers?select=user_id,is_active,is_verified&id=eq.${encodeURIComponent(trainerId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async hasPaidSubscription(userId: string, trainerId: string, nowIso: string): Promise<boolean> {
    const now = encodeURIComponent(nowIso);
    const rows = await this.restJson<Array<{ id: string }>>(
      `/rest/v1/dw_trainer_subscriptions?select=id&user_id=eq.${encodeURIComponent(userId)}` +
        `&trainer_id=eq.${encodeURIComponent(trainerId)}` +
        `&or=(and(status.eq.active,or(current_period_end.is.null,current_period_end.gt.${now})),and(status.eq.cancelled,current_period_end.gt.${now}))&limit=1`,
    );
    return rows.length > 0;
  }

  async hasActiveClientLink(userId: string, trainerId: string): Promise<boolean> {
    const rows = await this.restJson<Array<{ id: string }>>(
      `/rest/v1/dw_client_links?select=id&client_user_id=eq.${encodeURIComponent(userId)}` +
        `&trainer_id=eq.${encodeURIComponent(trainerId)}&status=eq.active&limit=1`,
    );
    return rows.length > 0;
  }

  async getFormCheck(formCheckId: string): Promise<FormCheckRow | null> {
    const rows = await this.restJson<FormCheckRow[]>(
      `/rest/v1/dw_form_checks?select=id,client_link_id,storage_path,duration_seconds,note&id=eq.${encodeURIComponent(formCheckId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getClientLink(clientLinkId: string): Promise<ClientLinkRow | null> {
    const rows = await this.restJson<ClientLinkRow[]>(
      `/rest/v1/dw_client_links?select=id,trainer_id,client_user_id,status&id=eq.${encodeURIComponent(clientLinkId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getFormFeedback(feedbackId: string): Promise<FormFeedbackRow | null> {
    const rows = await this.restJson<FormFeedbackRow[]>(
      `/rest/v1/dw_form_feedback?select=id,form_check_id,reply_storage_path&id=eq.${encodeURIComponent(feedbackId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async createSignedUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const body = await this.restJson<Record<string, unknown>>(
      `/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`,
      { method: 'POST', body: JSON.stringify({ expiresIn: expiresInSeconds }) },
    );
    const raw = stringOrNull(body.signedURL) ?? stringOrNull(body.signedUrl) ?? stringOrNull(body.url);
    if (!raw) throw new Error('Storage did not return a signed URL.');
    return raw.startsWith('http') ? raw : `${this.config.url}/storage/v1${raw}`;
  }

  async markView(userId: string, videoId: string, hourBucketIso: string): Promise<boolean> {
    const rows = await this.restJson<Array<Record<string, unknown>>>(
      '/rest/v1/dw_video_view_marks?on_conflict=user_id,video_id,hour_bucket',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ user_id: userId, video_id: videoId, hour_bucket: hourBucketIso }),
      },
      [200, 201],
    );
    return rows.length > 0;
  }

  async incrementViewCount(videoId: string): Promise<void> {
    // PostgREST has no atomic increment without an RPC; the per-hour view mark
    // dedup makes a read-modify-write acceptable for this vanity counter.
    const rows = await this.restJson<Array<{ view_count: number | null }>>(
      `/rest/v1/dw_trainer_videos?select=view_count&id=eq.${encodeURIComponent(videoId)}&limit=1`,
    );
    const current = rows[0]?.view_count ?? 0;
    await this.restJson<unknown>(
      `/rest/v1/dw_trainer_videos?id=eq.${encodeURIComponent(videoId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ view_count: current + 1 }),
      },
      [200, 204],
    );
  }

  private authHeaders(): Record<string, string> {
    return { apikey: this.config.key, Authorization: `Bearer ${this.config.key}` };
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: { ...this.authHeaders(), ...JSON_HEADERS, ...(init.headers ?? {}) },
    });
    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

export function createSupabasePlaybackStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): PlaybackStore {
  return new SupabasePlaybackStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    let store: PlaybackStore;
    try {
      store = createSupabasePlaybackStore((key) => Deno!.env.get(key), fetch);
    } catch {
      return errorJson('config_error', 503);
    }
    return handleDoWorkPlaybackUrlRequest(req, { store, now: () => Date.now() });
  });
}
