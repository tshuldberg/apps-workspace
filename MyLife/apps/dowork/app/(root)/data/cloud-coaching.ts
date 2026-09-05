// DoWork coaching-loop cloud client.
//
// Every cloud read/write for the private trainer-client coaching loop lives
// here: client links (roster + invites), form checks, timestamped feedback,
// the form-check / feedback-reply upload pipeline, and the trainer's video
// library as seen by an entitled client. Every function returns the house
// result shape ({ ok: true, ... } | { ok: false, error }) and never throws to
// a screen.
//
// Security model (enforced by the database, mirrored here for honest UI):
//   * A client joins ONLY through the security-definer RPC
//     dw_redeem_client_invite(code). Client code never selects
//     dw_client_links by invite_code (codes are non-enumerable).
//   * Form checks and feedback are participants-only. Queries are written so
//     RLS does the enforcement; a 0-row response for a non-participant is the
//     correct empty state, not an error to work around.
//   * dw_trainers is never written from the client.
//   * dw_trainer_invites / dw_purchase_events / dw_video_view_marks are never
//     read here (service-role only).
//
// cloud-media is imported dynamically inside the upload helpers so this
// module's static import graph stays free of expo-file-system (keeps the
// pending-queues test and the cloud provider light).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SignedUpload } from './cloud-media';
import { isTransientCloudWriteFailure } from './cloud-failures';
import { getPublicProfiles } from './cloud-profiles';

const CLIENT_LINKS_TABLE = 'dw_client_links';
const FORM_CHECKS_TABLE = 'dw_form_checks';
const FORM_FEEDBACK_TABLE = 'dw_form_feedback';
const TRAINER_VIDEOS_TABLE = 'dw_trainer_videos';
const REDEEM_RPC = 'dw_redeem_client_invite';
const UPLOAD_FUNCTION = 'dowork-upload-finalize';

const INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'; // A-Z2-9, no 0/1/O/I
const INVITE_CODE_LENGTH = 12;
export const MAX_FEEDBACK_BODY = 1000;

export type CoachingResult<T> = ({ ok: true } & T) | { ok: false; error: string };

// For mutations with no payload beyond success/failure.
export type CoachingVoid = { ok: true } | { ok: false; error: string };

export type ClientLinkStatus = 'invited' | 'active' | 'ended';

export interface ClientLink {
  id: string;
  trainerId: string;
  clientUserId: string | null;
  inviteCode: string;
  status: ClientLinkStatus;
  createdAt: string;
  activatedAt: string | null;
  endedAt: string | null;
}

// A roster entry as the trainer sees it: the link plus the client's public
// identity (handle / display name) when the invite has been claimed.
export interface ClientLinkRosterEntry extends ClientLink {
  clientHandle: string | null;
  clientDisplayName: string | null;
}

// The trainer identity a client sees on their side of an active link.
export interface ClientLinkTrainer {
  id: string;
  displayName: string;
  handle: string | null;
  headline: string | null;
  specialties: string[];
  heroImagePath: string | null;
  subscriberCount: number;
  isVerified: boolean;
}

export interface ClientLinkWithTrainer extends ClientLink {
  trainer: ClientLinkTrainer | null;
}

export type FormCheckStatus = 'pending' | 'reviewed';

export interface FormCheck {
  id: string;
  clientLinkId: string;
  authorUserId: string;
  exerciseSlug: string | null;
  storagePath: string;
  thumbnailPath: string | null;
  durationSeconds: number | null;
  note: string | null;
  status: FormCheckStatus;
  createdAt: string;
  reviewedAt: string | null;
  feedbackCount: number;
}

export interface FormFeedback {
  id: string;
  formCheckId: string;
  authorUserId: string;
  body: string | null;
  videoTimestampSeconds: number | null;
  replyStoragePath: string | null;
  createdAt: string;
}

export interface TrainerLibraryVideo {
  id: string;
  trainerId: string;
  exerciseSlug: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  isPremium: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
}

// ── Raw row shapes (snake_case from PostgREST) ─────────────────────────────

interface RawClientLink {
  id: string;
  trainer_id: string;
  client_user_id: string | null;
  invite_code: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  ended_at: string | null;
}

interface RawTrainerEmbed {
  id: string;
  display_name: string;
  handle: string | null;
  headline: string | null;
  specialties: string[] | null;
  hero_image_path: string | null;
  subscriber_count: number | null;
  is_verified: boolean | null;
}

interface RawClientLinkWithTrainer extends RawClientLink {
  trainer: RawTrainerEmbed | RawTrainerEmbed[] | null;
}

interface RawFormCheck {
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
  reviewed_at: string | null;
  dw_form_feedback?: Array<{ count: number }> | null;
}

interface RawFormFeedback {
  id: string;
  form_check_id: string;
  author_user_id: string;
  body: string | null;
  video_timestamp_seconds: number | null;
  reply_storage_path: string | null;
  created_at: string;
}

interface RawLibraryVideo {
  id: string;
  trainer_id: string;
  exercise_slug: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_premium: boolean | null;
  view_count: number | null;
  published_at: string | null;
  created_at: string;
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

function nowIso(): string {
  return new Date().toISOString();
}

function asStatus(value: string): ClientLinkStatus {
  return value === 'active' || value === 'ended' ? value : 'invited';
}

function toClientLink(raw: RawClientLink): ClientLink {
  return {
    id: raw.id,
    trainerId: raw.trainer_id,
    clientUserId: raw.client_user_id,
    inviteCode: raw.invite_code,
    status: asStatus(raw.status),
    createdAt: raw.created_at,
    activatedAt: raw.activated_at,
    endedAt: raw.ended_at,
  };
}

function toTrainer(raw: RawTrainerEmbed | RawTrainerEmbed[] | null): ClientLinkTrainer | null {
  const t = Array.isArray(raw) ? raw[0] : raw;
  if (!t) return null;
  return {
    id: t.id,
    displayName: t.display_name,
    handle: t.handle ?? null,
    headline: t.headline ?? null,
    specialties: Array.isArray(t.specialties) ? t.specialties : [],
    heroImagePath: t.hero_image_path ?? null,
    subscriberCount: typeof t.subscriber_count === 'number' ? t.subscriber_count : 0,
    isVerified: t.is_verified === true,
  };
}

function toFormCheck(raw: RawFormCheck): FormCheck {
  const count = Array.isArray(raw.dw_form_feedback) ? raw.dw_form_feedback[0]?.count ?? 0 : 0;
  return {
    id: raw.id,
    clientLinkId: raw.client_link_id,
    authorUserId: raw.author_user_id,
    exerciseSlug: raw.exercise_slug,
    storagePath: raw.storage_path,
    thumbnailPath: raw.thumbnail_path,
    durationSeconds: raw.duration_seconds,
    note: raw.note,
    status: raw.status === 'reviewed' ? 'reviewed' : 'pending',
    createdAt: raw.created_at,
    reviewedAt: raw.reviewed_at ?? null,
    feedbackCount: typeof count === 'number' ? count : 0,
  };
}

function toFeedback(raw: RawFormFeedback): FormFeedback {
  return {
    id: raw.id,
    formCheckId: raw.form_check_id,
    authorUserId: raw.author_user_id,
    body: raw.body,
    videoTimestampSeconds:
      typeof raw.video_timestamp_seconds === 'number' ? raw.video_timestamp_seconds : null,
    replyStoragePath: raw.reply_storage_path,
    createdAt: raw.created_at,
  };
}

function toLibraryVideo(raw: RawLibraryVideo): TrainerLibraryVideo {
  return {
    id: raw.id,
    trainerId: raw.trainer_id,
    exerciseSlug: raw.exercise_slug,
    title: raw.title ?? null,
    description: raw.description ?? null,
    thumbnailUrl: raw.thumbnail_url ?? null,
    durationSeconds: raw.duration_seconds,
    isPremium: raw.is_premium === true,
    viewCount: typeof raw.view_count === 'number' ? raw.view_count : 0,
    publishedAt: raw.published_at ?? null,
    createdAt: raw.created_at,
  };
}

// Crypto-random 12-char A-Z2-9 code. Uses Web Crypto getRandomValues, which
// Hermes exposes on the RN runtime (see shims/crypto.js) and Node exposes
// natively, so it works on device and under test. The random source is
// injectable for deterministic tests.
export function generateInviteCode(
  fill: (bytes: Uint8Array) => Uint8Array = defaultRandomFill,
): string {
  const bytes = fill(new Uint8Array(INVITE_CODE_LENGTH));
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

function defaultRandomFill(bytes: Uint8Array): Uint8Array {
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } })
    .crypto;
  if (!webCrypto?.getRandomValues) {
    // Invite codes gate premium access; never degrade to predictable randomness.
    // Callers wrap in try/catch and surface an honest error.
    throw new Error('Secure random bytes are unavailable in this runtime.');
  }
  webCrypto.getRandomValues(bytes);
  return bytes;
}

// ── Trainer side: roster + invite management ───────────────────────────────

// Every client link the trainer owns, newest first, resolved with the client's
// public identity where the invite has been claimed. RLS
// (dw_client_links_trainer_select) already scopes this to the caller's trainer
// row; the trainer_id filter is belt-and-suspenders.
export async function listClientLinks(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<CoachingResult<{ links: ClientLinkRosterEntry[] }>> {
  if (!trainerId) return { ok: false, error: 'A trainer profile is required.' };
  try {
    const result = await supabase
      .from(CLIENT_LINKS_TABLE)
      .select('*')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as RawClientLink[];
    const links = rows.map(toClientLink);

    const clientIds = links
      .map((l) => l.clientUserId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    let profiles = new Map<string, { handle: string; displayName: string | null }>();
    if (clientIds.length > 0) {
      const profileResult = await getPublicProfiles(supabase, clientIds);
      if (profileResult.ok) profiles = profileResult.profiles;
    }

    const entries: ClientLinkRosterEntry[] = links.map((link) => {
      const profile = link.clientUserId ? profiles.get(link.clientUserId) : undefined;
      return {
        ...link,
        clientHandle: profile?.handle ?? null,
        clientDisplayName: profile?.displayName ?? null,
      };
    });

    return { ok: true, links: entries };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Create a new per-client invite. The code is generated on-device and inserted
// under the trainer insert policy (status invited, client_user_id null). On the
// rare code collision (invite_code is unique) the insert fails; the caller can
// retry.
export async function createClientLink(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<CoachingResult<{ link: ClientLink }>> {
  if (!trainerId) return { ok: false, error: 'A trainer profile is required.' };
  try {
    const insert = await supabase
      .from(CLIENT_LINKS_TABLE)
      .insert({
        trainer_id: trainerId,
        invite_code: generateInviteCode(),
        status: 'invited',
        client_user_id: null,
      })
      .select('*')
      .single();

    if (insert.error || !insert.data) {
      return { ok: false, error: errMessage(insert.error) };
    }
    return { ok: true, link: toClientLink(insert.data as RawClientLink) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// End an active or invited link. Data is preserved; the client simply loses
// entitlement (the paywall policy only grants ACTIVE links).
export async function endClientLink(
  supabase: SupabaseClient,
  linkId: string,
): Promise<CoachingVoid> {
  try {
    const result = await supabase
      .from(CLIENT_LINKS_TABLE)
      .update({ status: 'ended', ended_at: nowIso() })
      .eq('id', linkId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Reactivate an ended link. A link that was already claimed returns to active;
// one that was never claimed returns to invited so the code can be shared again.
export async function reactivateClientLink(
  supabase: SupabaseClient,
  link: Pick<ClientLink, 'id' | 'clientUserId'>,
): Promise<CoachingVoid> {
  const claimed = Boolean(link.clientUserId);
  try {
    const result = await supabase
      .from(CLIENT_LINKS_TABLE)
      .update(
        claimed
          ? { status: 'active', ended_at: null, activated_at: nowIso() }
          : { status: 'invited', ended_at: null },
      )
      .eq('id', link.id);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// ── Client side: my links + join ───────────────────────────────────────────

// The client's own links (any status), newest first, each with the trainer's
// public identity embedded. RLS (dw_client_links_client_select) scopes this to
// links where client_user_id = auth.uid().
export async function listMyClientLinks(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoachingResult<{ links: ClientLinkWithTrainer[] }>> {
  if (!userId) return { ok: true, links: [] };
  try {
    const result = await supabase
      .from(CLIENT_LINKS_TABLE)
      .select(
        'id,trainer_id,client_user_id,invite_code,status,created_at,activated_at,ended_at,' +
          'trainer:dw_trainers(id,display_name,handle,headline,specialties,hero_image_path,subscriber_count,is_verified)',
      )
      .eq('client_user_id', userId)
      .order('created_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as unknown as RawClientLinkWithTrainer[];
    const links = rows.map((raw) => ({
      ...toClientLink(raw),
      trainer: toTrainer(raw.trainer),
    }));
    return { ok: true, links };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Redeem a per-client invite code. The security-definer RPC validates the code,
// requires status invited, flips it to active for the caller, and returns the
// link id. This is the ONLY end-user path that reads dw_client_links by code.
export async function redeemClientInvite(
  supabase: SupabaseClient,
  code: string,
): Promise<CoachingResult<{ linkId: string }>> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'Enter an invite code.' };
  try {
    const { data, error } = await supabase.rpc(REDEEM_RPC, { p_code: trimmed });
    if (error) return { ok: false, error: errMessage(error) };
    if (typeof data !== 'string' || data.length === 0) {
      return { ok: false, error: 'That invite could not be redeemed.' };
    }
    return { ok: true, linkId: data };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// ── Form checks + feedback ─────────────────────────────────────────────────

// Form checks on a link, newest first, with a feedback count per check.
// Participants-only via RLS; a non-participant sees an empty list.
export async function listFormChecks(
  supabase: SupabaseClient,
  clientLinkId: string,
): Promise<CoachingResult<{ formChecks: FormCheck[] }>> {
  try {
    const result = await supabase
      .from(FORM_CHECKS_TABLE)
      .select('*, dw_form_feedback(count)')
      .eq('client_link_id', clientLinkId)
      .order('created_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as RawFormCheck[];
    return { ok: true, formChecks: rows.map(toFormCheck) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function getFormCheck(
  supabase: SupabaseClient,
  formCheckId: string,
): Promise<CoachingResult<{ formCheck: FormCheck }>> {
  try {
    const result = await supabase
      .from(FORM_CHECKS_TABLE)
      .select('*')
      .eq('id', formCheckId)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: false, error: 'Form check not found.' };
    return { ok: true, formCheck: toFormCheck(result.data as RawFormCheck) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function getClientLink(
  supabase: SupabaseClient,
  linkId: string,
): Promise<CoachingResult<{ link: ClientLink }>> {
  try {
    const result = await supabase
      .from(CLIENT_LINKS_TABLE)
      .select('*')
      .eq('id', linkId)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: false, error: 'Client link not found.' };
    return { ok: true, link: toClientLink(result.data as RawClientLink) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Feedback for a form check, oldest first so it reads as a conversation and the
// timestamped notes stay in playback order.
export async function listFormFeedback(
  supabase: SupabaseClient,
  formCheckId: string,
): Promise<CoachingResult<{ feedback: FormFeedback[] }>> {
  try {
    const result = await supabase
      .from(FORM_FEEDBACK_TABLE)
      .select('*')
      .eq('form_check_id', formCheckId)
      .order('created_at', { ascending: true });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as RawFormFeedback[];
    return { ok: true, feedback: rows.map(toFeedback) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface PostFeedbackParams {
  formCheckId: string;
  authorUserId: string;
  body?: string | null;
  videoTimestampSeconds?: number | null;
  replyStoragePath?: string | null;
  // When the trainer posts, also flip the form check to reviewed.
  markReviewed?: boolean;
}

// Insert a feedback row (RLS: author must be a participant of the link). Marks
// the parent form check reviewed when asked. Pure insert with no offline
// queueing, so the flush path can reuse it without double-enqueuing.
async function insertFeedback(
  supabase: SupabaseClient,
  params: PostFeedbackParams,
): Promise<CoachingResult<{ feedback: FormFeedback }>> {
  const body = typeof params.body === 'string' ? params.body.trim() : null;
  const reply = params.replyStoragePath ?? null;
  if (!body && !reply) {
    return { ok: false, error: 'Add a note or a video reply.' };
  }
  if (body && body.length > MAX_FEEDBACK_BODY) {
    return { ok: false, error: `Feedback is limited to ${MAX_FEEDBACK_BODY} characters.` };
  }
  try {
    const insert = await supabase
      .from(FORM_FEEDBACK_TABLE)
      .insert({
        form_check_id: params.formCheckId,
        author_user_id: params.authorUserId,
        body: body && body.length > 0 ? body : null,
        video_timestamp_seconds:
          typeof params.videoTimestampSeconds === 'number' ? params.videoTimestampSeconds : null,
        reply_storage_path: reply,
      })
      .select('*')
      .single();

    if (insert.error || !insert.data) {
      return { ok: false, error: errMessage(insert.error) };
    }

    if (params.markReviewed) {
      // Best-effort: a failed status flip must not lose the posted feedback.
      await markFormCheckReviewed(supabase, params.formCheckId);
    }

    return { ok: true, feedback: toFeedback(insert.data as RawFormFeedback) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Transport-shaped failures (offline, DNS, timeouts, aborted requests) are
// worth retrying later; anything else is a server verdict (RLS reject on an
// ended link, revoked participant, deleted form check, validation) that would
// fail identically on every flush and must NOT become a queued poison item.
export function isTransientCoachingError(message: string): boolean {
  return isTransientCloudWriteFailure(message);
}

export type PostFeedbackOutcome =
  | ({ ok: true } & { feedback: FormFeedback })
  | { ok: false; error: string; queued: boolean };

// Public feedback post. Text-only feedback that fails on a TRANSIENT error is
// queued for offline retry (queued: true so the UI can say "saved offline"
// honestly). Permanent server rejects return queued: false: the UI keeps the
// draft and shows the real reason. A video reply (reply_storage_path set) is
// online-only and never queues.
export async function postFormFeedback(
  supabase: SupabaseClient,
  params: PostFeedbackParams,
): Promise<PostFeedbackOutcome> {
  const result = await insertFeedback(supabase, params);
  if (result.ok) return result;
  if (!params.replyStoragePath) {
    const body = typeof params.body === 'string' ? params.body.trim() : '';
    if (body && body.length <= MAX_FEEDBACK_BODY && isTransientCoachingError(result.error)) {
      enqueuePendingFeedback({
        formCheckId: params.formCheckId,
        authorUserId: params.authorUserId,
        body,
        videoTimestampSeconds:
          typeof params.videoTimestampSeconds === 'number' ? params.videoTimestampSeconds : null,
        markReviewed: params.markReviewed === true,
        error: result.error,
      });
      return { ok: false, error: result.error, queued: true };
    }
  }
  return { ok: false, error: result.error, queued: false };
}

// Flip a form check to reviewed. RLS (dw_form_checks_trainer_update +
// column-protect trigger) only allows the trainer to touch status / reviewed_at.
export async function markFormCheckReviewed(
  supabase: SupabaseClient,
  formCheckId: string,
): Promise<CoachingVoid> {
  try {
    const result = await supabase
      .from(FORM_CHECKS_TABLE)
      .update({ status: 'reviewed', reviewed_at: nowIso() })
      .eq('id', formCheckId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// ── Trainer library (client, entitled via active link) ─────────────────────

// The trainer's published videos as an entitled client sees them. The
// dw_trainer_videos entitlement policy returns free + premium once the client
// has an active link, so this is a straight select; the server is the
// enforcement.
export async function listTrainerLibrary(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<CoachingResult<{ videos: TrainerLibraryVideo[] }>> {
  if (!trainerId) return { ok: true, videos: [] };
  try {
    const result = await supabase
      .from(TRAINER_VIDEOS_TABLE)
      .select(
        'id,trainer_id,exercise_slug,title,description,thumbnail_url,duration_seconds,is_premium,view_count,published_at,created_at',
      )
      .eq('trainer_id', trainerId)
      .eq('is_hidden', false)
      .order('published_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as RawLibraryVideo[];
    return { ok: true, videos: rows.map(toLibraryVideo) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// ── Form-check / feedback-reply upload pipeline ────────────────────────────

function invokeErrMessage(record: Record<string, unknown>): string {
  const err = record.error as { message?: unknown } | undefined;
  if (typeof err?.message === 'string') return err.message;
  if (typeof record.error === 'string') return record.error;
  return 'Upload service error.';
}

// Client half of the dowork-upload-finalize contract for the form_check kind.
// Signs into dowork-form-checks/<clientLinkId>/ after the server re-checks that
// the caller participates in the ACTIVE link.
async function invokeUpload(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<CoachingResult<{ data: Record<string, unknown> }>> {
  try {
    const { data, error } = await supabase.functions.invoke(UPLOAD_FUNCTION, { body });
    if (error) return { ok: false, error: errMessage(error) };
    const record = (data ?? {}) as Record<string, unknown>;
    if (record.ok !== true) return { ok: false, error: invokeErrMessage(record) };
    return { ok: true, data: record };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function signFormCheckUpload(
  supabase: SupabaseClient,
  params: { clientLinkId: string; contentType: string; contentLength: number },
): Promise<CoachingResult<{ signed: SignedUpload }>> {
  const result = await invokeUpload(supabase, { action: 'sign', kind: 'form_check', ...params });
  if (!result.ok) return result;
  const d = result.data;
  if (typeof d.uploadUrl !== 'string' || typeof d.key !== 'string' || typeof d.bucket !== 'string') {
    return { ok: false, error: 'Upload service returned an invalid sign response.' };
  }
  return {
    ok: true,
    signed: {
      bucket: d.bucket,
      key: d.key,
      uploadUrl: d.uploadUrl,
      token: typeof d.token === 'string' ? d.token : null,
      maxBytes: typeof d.maxBytes === 'number' ? d.maxBytes : 0,
    },
  };
}

export interface FinalizeFormCheckParams {
  clientLinkId: string;
  key: string;
  exerciseSlug?: string | null;
  durationSeconds?: number | null;
  note?: string | null;
  thumbnailKey?: string | null;
}

export async function finalizeFormCheckUpload(
  supabase: SupabaseClient,
  params: FinalizeFormCheckParams,
): Promise<CoachingResult<{ formCheck: FormCheck }>> {
  const result = await invokeUpload(supabase, {
    action: 'finalize',
    kind: 'form_check',
    clientLinkId: params.clientLinkId,
    key: params.key,
    exerciseSlug: params.exerciseSlug ?? undefined,
    durationSeconds: params.durationSeconds ?? undefined,
    note: params.note ?? undefined,
    thumbnailKey: params.thumbnailKey ?? undefined,
  });
  if (!result.ok) return result;
  const raw = result.data.formCheck;
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Upload service returned an invalid finalize response.' };
  }
  return { ok: true, formCheck: toFormCheck(raw as RawFormCheck) };
}

export interface UploadFormCheckParams {
  clientLinkId: string;
  fileUri: string;
  contentType: string;
  contentLength: number;
  exerciseSlug?: string | null;
  durationSeconds?: number | null;
  note?: string | null;
  onProgress?: (fraction: number) => void;
}

// Client sends a form check: sign -> stream upload -> finalize. The server
// writes the dw_form_checks row and fans out a push to the trainer.
export async function uploadFormCheck(
  supabase: SupabaseClient,
  params: UploadFormCheckParams,
): Promise<CoachingResult<{ formCheck: FormCheck }>> {
  const signed = await signFormCheckUpload(supabase, {
    clientLinkId: params.clientLinkId,
    contentType: params.contentType,
    contentLength: params.contentLength,
  });
  if (!signed.ok) return signed;

  const uploaded = await putSignedFile(
    signed.signed,
    params.fileUri,
    params.contentType,
    params.onProgress,
  );
  if (!uploaded.ok) return uploaded;

  return finalizeFormCheckUpload(supabase, {
    clientLinkId: params.clientLinkId,
    key: signed.signed.key,
    exerciseSlug: params.exerciseSlug,
    durationSeconds: params.durationSeconds,
    note: params.note,
  });
}

export interface UploadFeedbackReplyParams {
  clientLinkId: string;
  formCheckId: string;
  authorUserId: string;
  fileUri: string;
  contentType: string;
  contentLength: number;
  body?: string | null;
  videoTimestampSeconds?: number | null;
  markReviewed?: boolean;
  onProgress?: (fraction: number) => void;
}

// Participant sends a video reply: sign into the same link folder -> stream
// upload -> insert a dw_form_feedback row with reply_storage_path (NOT finalize,
// which would create a spurious form check). The DB insert webhook notifies the
// other participant. Online-only; no offline queue for video replies.
export async function uploadFeedbackReply(
  supabase: SupabaseClient,
  params: UploadFeedbackReplyParams,
): Promise<CoachingResult<{ feedback: FormFeedback }>> {
  const signed = await signFormCheckUpload(supabase, {
    clientLinkId: params.clientLinkId,
    contentType: params.contentType,
    contentLength: params.contentLength,
  });
  if (!signed.ok) return signed;

  const uploaded = await putSignedFile(
    signed.signed,
    params.fileUri,
    params.contentType,
    params.onProgress,
  );
  if (!uploaded.ok) return uploaded;

  return postFormFeedback(supabase, {
    formCheckId: params.formCheckId,
    authorUserId: params.authorUserId,
    body: params.body,
    videoTimestampSeconds: params.videoTimestampSeconds,
    replyStoragePath: signed.signed.key,
    markReviewed: params.markReviewed,
  });
}

// Dynamic import keeps expo-file-system out of this module's static graph.
async function putSignedFile(
  signed: SignedUpload,
  fileUri: string,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<CoachingResult<object>> {
  const { uploadFileToSignedUrl } = await import('./cloud-media');
  return uploadFileToSignedUrl(signed, fileUri, contentType, onProgress);
}

// ── Offline text-feedback queue ────────────────────────────────────────────
//
// Text feedback composed offline is queued and flushed on reconnect (wired
// through data/pending-queues.ts alongside the shares/likes/comments queues).
// Video replies are never queued.

export interface PendingFeedbackItem {
  id: string;
  formCheckId: string;
  authorUserId: string;
  body: string;
  videoTimestampSeconds: number | null;
  markReviewed: boolean;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

const pendingFeedbackQueue: PendingFeedbackItem[] = [];

// Registered by pending-queues.ts at hydrate time; a no-op until then. Fired
// after every queue mutation so an enqueue-then-force-quit does not lose the
// op (the AppState background handler is not guaranteed on a hard kill). Before
// this hook the feedback queue only reached the KV on flush or AppState
// background, so a text feedback composed offline and then force-quit was lost
// the same way the share/like/comment queues were. Best-effort: a persist
// failure must never break the user-facing op.
let persistHook: (() => void) | null = null;

export function setPendingFeedbackPersistHook(hook: (() => void) | null): void {
  persistHook = hook;
}

function firePersistHook(): void {
  if (!persistHook) return;
  try {
    persistHook();
  } catch {
    // Best-effort persistence; never surface to the calling op.
  }
}

// Same cap as the share/comment/like queues: a feedback row the server keeps
// rejecting (ended link, revoked participant) must not retry for the life of
// the install. Only permanent-looking failures count against the cap (DL-4); a
// transient network blip re-queues with attempts unchanged. MAX_QUEUE_AGE_MS is
// the backstop for an item that stays transient forever.
const MAX_QUEUE_ATTEMPTS = 5;
const MAX_QUEUE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function enqueuePendingFeedback(input: {
  formCheckId: string;
  authorUserId: string;
  body: string;
  videoTimestampSeconds: number | null;
  markReviewed: boolean;
  error: string;
}): string {
  const id = `pending-feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  pendingFeedbackQueue.push({
    id,
    formCheckId: input.formCheckId,
    authorUserId: input.authorUserId,
    body: input.body,
    videoTimestampSeconds: input.videoTimestampSeconds,
    markReviewed: input.markReviewed,
    createdAt: nowIso(),
    attempts: 0,
    lastError: input.error,
  });
  firePersistHook();
  return id;
}

// Replace the in-memory queue with items hydrated from local storage (dedupes
// by id; used by pending-queues at app start).
export function restorePendingFeedbackQueue(items: PendingFeedbackItem[]): void {
  const seen = new Set<string>();
  pendingFeedbackQueue.length = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    seen.add(item.id);
    pendingFeedbackQueue.push(item);
  }
}

export function getPendingFeedbackQueue(): readonly PendingFeedbackItem[] {
  return pendingFeedbackQueue;
}

export function clearPendingFeedbackQueue(): void {
  pendingFeedbackQueue.length = 0;
}

export async function flushPendingFeedback(
  supabase: SupabaseClient,
): Promise<{ flushed: number; failed: number }> {
  if (pendingFeedbackQueue.length === 0) return { flushed: 0, failed: 0 };

  const items = [...pendingFeedbackQueue];
  pendingFeedbackQueue.length = 0;
  const remaining: PendingFeedbackItem[] = [];
  let flushed = 0;
  let failed = 0;

  for (const item of items) {
    // insertFeedback (not postFormFeedback) so failures re-queue exactly once.
    const result = await insertFeedback(supabase, {
      formCheckId: item.formCheckId,
      authorUserId: item.authorUserId,
      body: item.body,
      videoTimestampSeconds: item.videoTimestampSeconds,
      markReviewed: item.markReviewed,
    });
    if (result.ok) {
      flushed += 1;
    } else {
      failed += 1;
      const transient = isTransientCoachingError(result.error);
      const attempts = transient ? item.attempts : item.attempts + 1;
      const age = Date.now() - Date.parse(item.createdAt);
      const expired = Number.isFinite(age) && age > MAX_QUEUE_AGE_MS;
      if (attempts < MAX_QUEUE_ATTEMPTS && !expired) {
        remaining.push({ ...item, attempts, lastError: result.error });
      }
    }
  }

  pendingFeedbackQueue.push(...remaining);
  // Retained failures shrank the queue; persist so a force-quit before the
  // flushAllPendingQueues caller's final persist does not resurrect a
  // just-succeeded item.
  firePersistHook();
  return { flushed, failed };
}
