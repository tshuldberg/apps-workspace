// DoWork cloud trainer-video helpers.
//
// CRUD against the `dw_trainer_videos` table. Storage objects (the
// actual video files) live in a separate Supabase Storage bucket and
// are uploaded via the `dowork-upload-finalize` edge function — this
// module owns the metadata registry only.
//
// Schema lives in 20260428000003_dowork_trainer_videos.sql and is extended
// by the Plan 36 schema-v2 migration (title, description, is_premium,
// view_count, published_at). The entitlement to actually WATCH a premium
// video is enforced server-side (RLS + dowork-playback-url); the is_premium
// flag here is a UX mirror only.

import type { SupabaseClient } from '@supabase/supabase-js';

const VIDEOS_TABLE = 'dw_trainer_videos';

export type TrainerVideoAngle =
  | 'front'
  | 'side'
  | 'three_quarter'
  | 'overhead'
  | 'back';

export type CloudTrainerVideoResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export interface TrainerVideoInput {
  trainerId: string;
  storagePath: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  angle?: TrainerVideoAngle;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface TrainerVideoRow {
  id: string;
  trainerId: string;
  exerciseSlug: string;
  storagePath: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  angle: TrainerVideoAngle | null;
  isPrimary: boolean;
  isHidden: boolean;
  sortOrder: number;
  title: string | null;
  description: string | null;
  isPremium: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// A trainer video enriched with its trainer's display attribution, used by the
// exercise-detail trainer rail so cards can link to the trainer profile.
export interface TrainerRailVideo extends TrainerVideoRow {
  trainerName: string | null;
  trainerHandle: string | null;
  trainerUserId: string | null;
}

export interface RawTrainerVideoRow {
  id: string;
  trainer_id: string;
  exercise_slug: string;
  storage_path: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  angle: TrainerVideoAngle | null;
  is_primary: boolean;
  is_hidden: boolean;
  sort_order: number;
  title: string | null;
  description: string | null;
  is_premium: boolean | null;
  view_count: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawRailRow extends RawTrainerVideoRow {
  trainer?: {
    user_id: string | null;
    display_name: string | null;
    handle: string | null;
    is_active: boolean | null;
    is_verified: boolean | null;
  } | null;
}

function nowIso(): string {
  return new Date().toISOString();
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

export function mapRawTrainerVideoRow(raw: RawTrainerVideoRow): TrainerVideoRow {
  return toRow(raw);
}

function toRow(raw: RawTrainerVideoRow): TrainerVideoRow {
  return {
    id: raw.id,
    trainerId: raw.trainer_id,
    exerciseSlug: raw.exercise_slug,
    storagePath: raw.storage_path,
    thumbnailUrl: raw.thumbnail_url,
    durationSeconds: raw.duration_seconds,
    angle: raw.angle,
    isPrimary: raw.is_primary,
    isHidden: raw.is_hidden,
    sortOrder: raw.sort_order,
    title: raw.title ?? null,
    description: raw.description ?? null,
    isPremium: raw.is_premium === true,
    viewCount: typeof raw.view_count === 'number' ? raw.view_count : 0,
    publishedAt: raw.published_at ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function uploadTrainerVideo(
  supabase: SupabaseClient,
  exerciseSlug: string,
  input: TrainerVideoInput,
): Promise<CloudTrainerVideoResult<{ video: TrainerVideoRow }>> {
  if (!exerciseSlug.trim()) {
    return { ok: false, error: 'exerciseSlug is required.' };
  }
  if (!input.trainerId || !input.storagePath) {
    return { ok: false, error: 'trainerId and storagePath are required.' };
  }

  try {
    const insert = await supabase
      .from(VIDEOS_TABLE)
      .insert({
        trainer_id: input.trainerId,
        exercise_slug: exerciseSlug,
        storage_path: input.storagePath,
        thumbnail_url: input.thumbnailUrl ?? null,
        duration_seconds: input.durationSeconds ?? null,
        angle: input.angle ?? null,
        is_primary: input.isPrimary ?? false,
        sort_order: input.sortOrder ?? 0,
      })
      .select('*')
      .single();

    if (insert.error || !insert.data) {
      return { ok: false, error: errMessage(insert.error) };
    }

    return { ok: true, video: toRow(insert.data as RawTrainerVideoRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Public listing for an exercise (visitor view): non-hidden videos, primary
// first. Premium rows the caller is not entitled to are hidden by RLS.
export async function listTrainerVideosForExercise(
  supabase: SupabaseClient,
  exerciseSlug: string,
): Promise<CloudTrainerVideoResult<{ videos: TrainerVideoRow[] }>> {
  try {
    const result = await supabase
      .from(VIDEOS_TABLE)
      .select('*')
      .eq('exercise_slug', exerciseSlug)
      .eq('is_hidden', false)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (result.error) return { ok: false, error: errMessage(result.error) };

    const raw = (result.data ?? []) as RawTrainerVideoRow[];
    return { ok: true, videos: raw.map(toRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Exercise-detail trainer rail: non-hidden videos for the exercise with the
// trainer's display name + handle for attribution, primary demo first. Rows
// whose trainer is missing / inactive / unverified are dropped as a belt.
export async function listExerciseTrainerRail(
  supabase: SupabaseClient,
  exerciseSlug: string,
): Promise<CloudTrainerVideoResult<{ videos: TrainerRailVideo[] }>> {
  try {
    const result = await supabase
      .from(VIDEOS_TABLE)
      .select('*, trainer:dw_trainers(user_id,display_name,handle,is_active,is_verified)')
      .eq('exercise_slug', exerciseSlug)
      .eq('is_hidden', false)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };

    const raw = (result.data ?? []) as RawRailRow[];
    const videos = raw
      .filter((row) => row.trainer && row.trainer.is_active && row.trainer.is_verified)
      .map((row) => ({
        ...toRow(row),
        trainerName: row.trainer?.display_name ?? null,
        trainerHandle: row.trainer?.handle ?? null,
        trainerUserId: row.trainer?.user_id ?? null,
      }));
    return { ok: true, videos };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Every video for a trainer (Studio manage grid). The owner sees all rows,
// including hidden ones, via the dw_trainer_videos_trainer_modify policy.
export async function listTrainerVideos(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<CloudTrainerVideoResult<{ videos: TrainerVideoRow[] }>> {
  if (!trainerId) return { ok: false, error: 'A trainer id is required.' };
  try {
    const result = await supabase
      .from(VIDEOS_TABLE)
      .select('*')
      .eq('trainer_id', trainerId)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const raw = (result.data ?? []) as RawTrainerVideoRow[];
    return { ok: true, videos: raw.map(toRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Non-hidden videos for a trainer (public profile library). Premium rows the
// caller is not entitled to are hidden by RLS.
export async function listPublicTrainerVideos(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<CloudTrainerVideoResult<{ videos: TrainerVideoRow[] }>> {
  if (!trainerId) return { ok: false, error: 'A trainer id is required.' };
  try {
    const result = await supabase
      .from(VIDEOS_TABLE)
      .select('*')
      .eq('trainer_id', trainerId)
      .eq('is_hidden', false)
      .order('is_premium', { ascending: true })
      .order('published_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const raw = (result.data ?? []) as RawTrainerVideoRow[];
    return { ok: true, videos: raw.map(toRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface TrainerVideoMetaPatch {
  title?: string | null;
  description?: string | null;
  isPremium?: boolean;
  angle?: TrainerVideoAngle | null;
  exerciseSlug?: string;
}

// Owner metadata edit (Studio manage grid). Storage path is never touched;
// only the descriptive fields the trainer controls.
export async function updateTrainerVideoMeta(
  supabase: SupabaseClient,
  videoId: string,
  patch: TrainerVideoMetaPatch,
): Promise<CloudTrainerVideoResult<{ video: TrainerVideoRow }>> {
  if (!videoId) return { ok: false, error: 'A video id is required.' };

  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) update.title = patch.title?.trim() || null;
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.isPremium !== undefined) update.is_premium = patch.isPremium;
  if (patch.angle !== undefined) update.angle = patch.angle;
  if (patch.exerciseSlug !== undefined) {
    if (!patch.exerciseSlug.trim()) return { ok: false, error: 'exerciseSlug cannot be empty.' };
    update.exercise_slug = patch.exerciseSlug.trim();
  }

  try {
    const result = await supabase
      .from(VIDEOS_TABLE)
      .update(update)
      .eq('id', videoId)
      .select('*')
      .single();

    if (result.error || !result.data) {
      return { ok: false, error: errMessage(result.error) };
    }
    return { ok: true, video: toRow(result.data as RawTrainerVideoRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function setTrainerVideoHidden(
  supabase: SupabaseClient,
  videoId: string,
  hidden: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!videoId) return { ok: false, error: 'A video id is required.' };
  try {
    const result = await supabase
      .from(VIDEOS_TABLE)
      .update({ is_hidden: hidden, updated_at: nowIso() })
      .eq('id', videoId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function deleteTrainerVideo(
  supabase: SupabaseClient,
  videoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await supabase.from(VIDEOS_TABLE).delete().eq('id', videoId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Locked-teaser metadata for premium videos a viewer is not entitled to
// watch (CG-8). dw_trainer_videos_select_entitled hides the whole row for a
// non-entitled caller, so listPublicTrainerVideos alone cannot show what a
// premium library contains. This calls dw_list_premium_video_teasers, a
// security-definer RPC that returns ONLY title/thumbnail/duration/sort_order
// for a trainer's non-hidden premium videos — never storage_path, so the
// teaser can never be played, only shown as a locked row routing to the
// Subscribe paywall.
export interface PremiumVideoTeaser {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
}

interface RawPremiumVideoTeaser {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
}

export async function listPremiumVideoTeasers(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<CloudTrainerVideoResult<{ teasers: PremiumVideoTeaser[] }>> {
  if (!trainerId) return { ok: false, error: 'A trainer id is required.' };
  try {
    const result = await supabase.rpc('dw_list_premium_video_teasers', {
      p_trainer_id: trainerId,
    });
    if (result.error) return { ok: false, error: errMessage(result.error) };
    const raw = (result.data ?? []) as RawPremiumVideoTeaser[];
    return {
      ok: true,
      teasers: raw.map((row) => ({
        id: row.id,
        title: row.title,
        thumbnailUrl: row.thumbnail_url,
        durationSeconds: row.duration_seconds,
        sortOrder: row.sort_order,
      })),
    };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function setPrimaryTrainerVideo(
  supabase: SupabaseClient,
  exerciseSlug: string,
  videoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Demote any existing primary for this exercise.
    const demote = await supabase
      .from(VIDEOS_TABLE)
      .update({ is_primary: false, updated_at: nowIso() })
      .eq('exercise_slug', exerciseSlug)
      .eq('is_primary', true);

    if (demote.error) {
      return { ok: false, error: errMessage(demote.error) };
    }

    const promote = await supabase
      .from(VIDEOS_TABLE)
      .update({ is_primary: true, updated_at: nowIso() })
      .eq('id', videoId);

    if (promote.error) {
      return { ok: false, error: errMessage(promote.error) };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
