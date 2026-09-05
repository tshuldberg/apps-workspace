/**
 * Cloud followers graph -- bc_followers table operations.
 *
 * Manages the social graph between chefs in Supabase.
 * Notification fanout (bc_notify_follow) is handled by P1-C; this
 * module only reads/writes bc_followers rows.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { FollowerEdge } from './types';

function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Types ─────────────────────────────────────────────────────────────

export interface FollowerProfile {
  profileId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  followedAt: Date;
}

export interface FollowersPage {
  items: FollowerProfile[];
  hasMore: boolean;
}

export interface FollowChefInput {
  supabase?: ReturnType<typeof getBestChefClient>;
  chefId: string;
}

export interface UnfollowChefInput {
  supabase?: ReturnType<typeof getBestChefClient>;
  chefId: string;
}

export interface IsFollowingInput {
  supabase?: ReturnType<typeof getBestChefClient>;
  chefId: string;
}

export interface GetFollowersInput {
  supabase?: ReturnType<typeof getBestChefClient>;
  chefId: string;
  limit?: number;
  before?: string; // ISO timestamp cursor
}

export interface GetFollowingInput {
  supabase?: ReturnType<typeof getBestChefClient>;
  userId: string;
  limit?: number;
  before?: string;
}

// ── Write operations ──────────────────────────────────────────────────

/**
 * Follow a chef. Idempotent -- re-following returns ok without error.
 * P1-C adds the bc_notify_follow fanout separately; do not call it here.
 */
export async function followChef({
  chefId,
}: FollowChefInput): Promise<BestChefResult<FollowerEdge>> {
  const supabase = getBestChefClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return err('Not authenticated');
  if (user.id === chefId) return err('Cannot follow yourself');

  // Get the caller's social_profile id
  const { data: profile, error: profileErr } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (profileErr) return err(profileErr.message);
  const followerId = profile.id as string;

  // Upsert -- idempotent on primary key (follower_id, chef_id)
  const { data, error: insertErr } = await from('bc_followers')
    .upsert(
      { follower_id: followerId, chef_id: chefId },
      { onConflict: 'follower_id,chef_id' },
    )
    .select()
    .single();

  if (insertErr) return err(insertErr.message);

  return ok({
    followerId: data.follower_id as string,
    chefId: data.chef_id as string,
    createdAt: new Date(data.created_at as string),
  });
}

/**
 * Unfollow a chef. No-ops if not following.
 */
export async function unfollowChef({
  chefId,
}: UnfollowChefInput): Promise<BestChefResult<void>> {
  const supabase = getBestChefClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return err('Not authenticated');

  const { data: profile, error: profileErr } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (profileErr) return err(profileErr.message);
  const followerId = profile.id as string;

  const { error: deleteErr } = await from('bc_followers')
    .delete()
    .eq('follower_id', followerId)
    .eq('chef_id', chefId);

  if (deleteErr) return err(deleteErr.message);
  return ok(undefined);
}

/**
 * Check whether the current user follows a given chef.
 */
export async function isFollowingChef({
  chefId,
}: IsFollowingInput): Promise<BestChefResult<boolean>> {
  const supabase = getBestChefClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return ok(false);

  const { data: profile, error: profileErr } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (profileErr) return ok(false);
  const followerId = profile.id as string;

  const { count, error: countErr } = await from('bc_followers')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', followerId)
    .eq('chef_id', chefId);

  if (countErr) return err(countErr.message);
  return ok((count ?? 0) > 0);
}

// ── Read operations ───────────────────────────────────────────────────

/**
 * List followers of a chef with profile snapshots, newest first.
 */
export async function getFollowers({
  chefId,
  limit = 30,
  before,
}: GetFollowersInput): Promise<BestChefResult<FollowerProfile[]>> {
  let query = from('bc_followers')
    .select('follower_id, created_at')
    .eq('chef_id', chefId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data: edges, error: edgeErr } = await query;
  if (edgeErr) return err(edgeErr.message);
  if (!edges || edges.length === 0) return ok([]);

  const followerIds = edges.map((e) => e.follower_id as string);
  const { data: profiles, error: profileErr } = await getBestChefClient()
    .from('social_profiles')
    .select('id, handle, display_name, avatar_url')
    .in('id', followerIds);

  if (profileErr) return err(profileErr.message);

  const profileMap = new Map<string, { handle: string; displayName: string; avatarUrl: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      handle: p.handle as string,
      displayName: p.display_name as string,
      avatarUrl: (p.avatar_url as string) ?? null,
    });
  }

  return ok(
    edges.map((e) => {
      const p = profileMap.get(e.follower_id as string);
      return {
        profileId: e.follower_id as string,
        handle: p?.handle ?? '',
        displayName: p?.displayName ?? '',
        avatarUrl: p?.avatarUrl ?? null,
        followedAt: new Date(e.created_at as string),
      };
    }),
  );
}

/**
 * List chefs a user is following, newest first.
 */
export async function getFollowing({
  userId,
  limit = 30,
  before,
}: GetFollowingInput): Promise<BestChefResult<FollowerProfile[]>> {
  // Resolve the social profile id for userId
  const { data: profile, error: profileErr } = await getBestChefClient()
    .from('social_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (profileErr) return err(profileErr.message);
  const profileId = profile.id as string;

  let query = from('bc_followers')
    .select('chef_id, created_at')
    .eq('follower_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data: edges, error: edgeErr } = await query;
  if (edgeErr) return err(edgeErr.message);
  if (!edges || edges.length === 0) return ok([]);

  const chefIds = edges.map((e) => e.chef_id as string);
  const { data: profiles, error: chefsErr } = await getBestChefClient()
    .from('social_profiles')
    .select('id, handle, display_name, avatar_url')
    .in('id', chefIds);

  if (chefsErr) return err(chefsErr.message);

  const profileMap = new Map<string, { handle: string; displayName: string; avatarUrl: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      handle: p.handle as string,
      displayName: p.display_name as string,
      avatarUrl: (p.avatar_url as string) ?? null,
    });
  }

  return ok(
    edges.map((e) => {
      const p = profileMap.get(e.chef_id as string);
      return {
        profileId: e.chef_id as string,
        handle: p?.handle ?? '',
        displayName: p?.displayName ?? '',
        avatarUrl: p?.avatarUrl ?? null,
        followedAt: new Date(e.created_at as string),
      };
    }),
  );
}

/**
 * Follower count for a chef.
 */
export async function getFollowerCount(
  chefId: string,
): Promise<BestChefResult<number>> {
  const { count, error: countErr } = await from('bc_followers')
    .select('*', { count: 'exact', head: true })
    .eq('chef_id', chefId);

  if (countErr) return err(countErr.message);
  return ok(count ?? 0);
}

/**
 * Following count for a user (by social profile id).
 */
export async function getFollowingCount(
  userId: string,
): Promise<BestChefResult<number>> {
  const { count, error: countErr } = await from('bc_followers')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);

  if (countErr) return err(countErr.message);
  return ok(count ?? 0);
}
