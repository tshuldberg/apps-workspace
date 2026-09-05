// DoWork cloud user profile helpers.
//
// dw_user_profiles holds the public identity (handle, display name,
// avatar) behind every share, like, and comment. A row is created lazily
// at first session via ensureUserProfile, so cloud content is never
// authorless. Public reads go through the dw_public_profiles view.

import type { SupabaseClient } from '@supabase/supabase-js';

const PROFILES_TABLE = 'dw_user_profiles';
const PUBLIC_PROFILES_VIEW = 'dw_public_profiles';

export interface CloudUserProfile {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export type CloudProfilesResult<T> = ({ ok: true } & T) | { ok: false; error: string };

interface RawProfileRow {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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

function toProfile(raw: RawProfileRow): CloudUserProfile {
  return {
    userId: raw.user_id,
    handle: raw.handle,
    displayName: raw.display_name,
    avatarUrl: raw.avatar_url,
    bio: raw.bio,
  };
}

function randomSuffix(length: number): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

// Deterministic first attempt (stable across reinstalls for the same auth
// user), random retry on handle collision.
export function generateHandle(userId: string, attempt: number): string {
  if (attempt === 0) {
    const stable = userId.replace(/-/g, '').slice(0, 6).toLowerCase();
    return `lifter_${stable}`;
  }
  return `lifter_${randomSuffix(8)}`;
}

export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CloudProfilesResult<{ profile: CloudUserProfile | null }>> {
  try {
    const result = await supabase
      .from(PROFILES_TABLE)
      .select('user_id, handle, display_name, avatar_url, bio')
      .eq('user_id', userId)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: true, profile: null };
    return { ok: true, profile: toProfile(result.data as RawProfileRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Idempotent: returns the existing profile or creates one with a generated
// handle. Called from the cloud provider once a session exists.
export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CloudProfilesResult<{ profile: CloudUserProfile }>> {
  if (!userId) return { ok: false, error: 'userId is required.' };

  const existing = await getMyProfile(supabase, userId);
  if (!existing.ok) return existing;
  if (existing.profile) return { ok: true, profile: existing.profile };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const handle = generateHandle(userId, attempt);
    try {
      const insert = await supabase
        .from(PROFILES_TABLE)
        .insert({ user_id: userId, handle })
        .select('user_id, handle, display_name, avatar_url, bio')
        .single();

      if (!insert.error && insert.data) {
        return { ok: true, profile: toProfile(insert.data as RawProfileRow) };
      }

      const message = errMessage(insert.error);
      const isUniqueViolation =
        message.includes('duplicate key') || message.includes('23505');
      // user_id conflict means a parallel device won the race: re-read.
      if (isUniqueViolation && message.includes('user_id')) {
        const reread = await getMyProfile(supabase, userId);
        if (reread.ok && reread.profile) return { ok: true, profile: reread.profile };
      }
      if (!isUniqueViolation) return { ok: false, error: message };
      // handle collision: loop with a random handle.
    } catch (error) {
      return { ok: false, error: errMessage(error) };
    }
  }

  return { ok: false, error: 'Could not allocate a unique handle.' };
}

export async function updateMyProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: { displayName?: string | null; bio?: string | null },
): Promise<CloudProfilesResult<{ profile: CloudUserProfile }>> {
  try {
    const result = await supabase
      .from(PROFILES_TABLE)
      .update({
        ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
        ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('user_id, handle, display_name, avatar_url, bio')
      .single();

    if (result.error || !result.data) return { ok: false, error: errMessage(result.error) };
    return { ok: true, profile: toProfile(result.data as RawProfileRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Public identities for feed enrichment (anon-readable view).
export async function getPublicProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<CloudProfilesResult<{ profiles: Map<string, CloudUserProfile> }>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return { ok: true, profiles: new Map() };
  try {
    const result = await supabase
      .from(PUBLIC_PROFILES_VIEW)
      .select('user_id, handle, display_name, avatar_url, bio')
      .in('user_id', unique);

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const profiles = new Map<string, CloudUserProfile>();
    for (const raw of (result.data ?? []) as RawProfileRow[]) {
      profiles.set(raw.user_id, toProfile(raw));
    }
    return { ok: true, profiles };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
