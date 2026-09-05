import type { SupabaseClient } from '@supabase/supabase-js';
import type { SurfProfile, SharedSession, Follow, Crew } from '../types';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  home_spot_id: string | null;
  skill_level: string;
  board_quiver: string[] | null;
  session_count: number;
  total_waves: number;
  total_hours: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface SharedSessionRow {
  id: string;
  session_id: string;
  user_id: string;
  spot_id: string;
  caption: string | null;
  wave_count: number | null;
  best_wave_duration_s: number | null;
  conditions_summary: string | null;
  photo_urls: string[] | null;
  stoke_level: number;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

function mapProfile(row: ProfileRow): SurfProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    homeSpotId: row.home_spot_id ?? undefined,
    skillLevel: row.skill_level as SurfProfile['skillLevel'],
    boardQuiver: row.board_quiver ?? [],
    sessionCount: row.session_count,
    totalWaves: row.total_waves,
    totalHours: row.total_hours,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSharedSession(row: SharedSessionRow): SharedSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    spotId: row.spot_id,
    caption: row.caption ?? undefined,
    waveCount: row.wave_count ?? undefined,
    bestWaveDurationS: row.best_wave_duration_s ?? undefined,
    conditionsSummary: row.conditions_summary ?? undefined,
    photoUrls: row.photo_urls ?? [],
    stokeLevel: row.stoke_level,
    isPublic: row.is_public,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function cloudGetSurfProfile(
  client: SupabaseClient,
  userId: string,
): Promise<SurfProfile | null> {
  const { data, error } = await client
    .from('surf_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function cloudUpdateSurfProfile(
  client: SupabaseClient,
  userId: string,
  input: { displayName?: string; avatarUrl?: string; bio?: string; homeSpotId?: string; skillLevel?: string; isPublic?: boolean },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.homeSpotId !== undefined) updates.home_spot_id = input.homeSpotId;
  if (input.skillLevel !== undefined) updates.skill_level = input.skillLevel;
  if (input.isPublic !== undefined) updates.is_public = input.isPublic;

  if (Object.keys(updates).length === 0) return;

  const { error } = await client
    .from('surf_profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Follow
// ---------------------------------------------------------------------------

export async function cloudFollow(
  client: SupabaseClient,
  followerId: string,
  followingId: string,
): Promise<void> {
  const { error } = await client
    .from('surf_follows')
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' });

  if (error) throw error;
}

export async function cloudUnfollow(
  client: SupabaseClient,
  followerId: string,
  followingId: string,
): Promise<void> {
  const { error } = await client
    .from('surf_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) throw error;
}

export async function cloudGetFollowers(
  client: SupabaseClient,
  userId: string,
): Promise<Follow[]> {
  const { data, error } = await client
    .from('surf_follows')
    .select('*')
    .eq('following_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    followerId: row.follower_id as string,
    followingId: row.following_id as string,
    createdAt: row.created_at as string,
  }));
}

export async function cloudGetFollowing(
  client: SupabaseClient,
  userId: string,
): Promise<Follow[]> {
  const { data, error } = await client
    .from('surf_follows')
    .select('*')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    followerId: row.follower_id as string,
    followingId: row.following_id as string,
    createdAt: row.created_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Shared Sessions + Feed
// ---------------------------------------------------------------------------

export async function cloudShareSession(
  client: SupabaseClient,
  input: {
    sessionId: string;
    userId: string;
    spotId: string;
    caption?: string;
    waveCount?: number;
    stokeLevel?: number;
    photoUrls?: string[];
    isPublic?: boolean;
  },
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('shared_sessions')
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      spot_id: input.spotId,
      caption: input.caption ?? null,
      wave_count: input.waveCount ?? null,
      stoke_level: input.stokeLevel ?? 3,
      photo_urls: input.photoUrls ?? [],
      is_public: input.isPublic !== false,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id as string };
}

export async function cloudGetFeed(
  client: SupabaseClient,
  userId: string,
  limit: number = 30,
): Promise<SharedSession[]> {
  // Get sessions from users this person follows
  const { data: followData, error: followError } = await client
    .from('surf_follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followError) throw followError;
  const followingIds = (followData ?? []).map((r: Record<string, unknown>) => r.following_id as string);
  if (followingIds.length === 0) return [];

  const { data, error } = await client
    .from('shared_sessions')
    .select('*')
    .in('user_id', followingIds)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SharedSessionRow[]).map(mapSharedSession);
}

// ---------------------------------------------------------------------------
// Crews
// ---------------------------------------------------------------------------

export async function cloudCreateCrew(
  client: SupabaseClient,
  input: { name: string; creatorId: string; description?: string; homeSpotId?: string },
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('surf_crews')
    .insert({
      name: input.name,
      creator_id: input.creatorId,
      description: input.description ?? null,
      home_spot_id: input.homeSpotId ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id as string };
}

export async function cloudGetUserCrews(
  client: SupabaseClient,
  userId: string,
): Promise<Crew[]> {
  const { data, error } = await client
    .from('surf_crew_members')
    .select('crew:surf_crews(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const c = row.crew as Record<string, unknown>;
    return {
      id: c.id as string,
      name: c.name as string,
      creatorId: c.creator_id as string,
      description: (c.description as string) ?? undefined,
      homeSpotId: (c.home_spot_id as string) ?? undefined,
      memberCount: c.member_count as number,
      createdAt: c.created_at as string,
      updatedAt: c.updated_at as string,
    };
  });
}
