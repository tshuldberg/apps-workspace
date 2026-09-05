/**
 * Chef profile engine -- social profiles enriched with BestChef stats.
 *
 * Extends @mylife/social SocialProfile with submission counts, vote totals,
 * badge collections, cuisine breakdowns, and signature dishes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { Submission } from './types';
import { resolveSubmissionImageUrls } from './submission-image-url';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Types ────────────────────────────────────────────────────────────

export interface SignatureDish {
  submissionId: string;
  dishId: string;
  dishName: string;
  cuisine: string;
  voteScore: number;
  rank: number | null;
  photoUrl: string | null;
}

export interface ChefBadgeWithDef {
  id: string;
  badgeId: string;
  earnedAt: Date;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface CuisineBreakdownEntry {
  cuisine: string;
  count: number;
  avgScore: number;
}

export interface ChefProfileData {
  profileId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  totalSubmissions: number;
  totalVotesReceived: number;
  dishesWon: number;
  avgScore: number;
  topCuisine: string | null;
  signatureDishes: SignatureDish[];
  badges: ChefBadgeWithDef[];
  activeSince: string;
}

export interface ChefStats {
  totalSubmissions: number;
  totalVotesReceived: number;
  dishesWon: number;
  avgScore: number;
  topCuisine: string | null;
  activeSince: string;
}

export interface ChefSearchOptions {
  cuisine?: string;
  limit?: number;
}

export interface ChefSubmissionListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'vote_score' | 'created_at';
}

// ── Row mappers ──────────────────────────────────────────────────────

function mapSubmission(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    dishId: row.dish_id as string,
    recipeSnapshotId: row.recipe_snapshot_id as string,
    profileId: row.profile_id as string,
    photoUrl: (row.photo_url as string) ?? null,
    photoVerified: (row.photo_verified as boolean) ?? false,
    photoVerifiedAt: row.photo_verified_at
      ? new Date(row.photo_verified_at as string)
      : null,
    verificationMethod:
      (row.verification_method as Submission['verificationMethod']) ?? null,
    chefLocation: (row.chef_location as string) ?? null,
    chefLocationLat: (row.chef_location_lat as number) ?? null,
    chefLocationLng: (row.chef_location_lng as number) ?? null,
    chefOrigin: (row.chef_origin as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    voteScore: (row.vote_score as number) ?? 0,
    likeCount: (row.like_count as number) ?? 0,
    rank: (row.rank as number) ?? null,
    moderationStatus:
      (row.moderation_status as Submission['moderationStatus']) ?? 'approved',
    region: (row.region as string) ?? null,
    isRestaurant: (row.is_restaurant as boolean) ?? false,
    upvoteCount: (row.upvote_count as number) ?? 0,
    downvoteCount: (row.downvote_count as number) ?? 0,
    reviewedCount: (row.reviewed_count as number) ?? 0,
    tapCount: (row.tap_count as number) ?? 0,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}


// ── Pure helpers (exported for testing) ──────────────────────────────

/**
 * Aggregate cuisine breakdown from a flat list of submissions joined
 * with dish cuisine data.
 */
export function aggregateCuisineBreakdown(
  entries: Array<{ cuisine: string; voteScore: number }>,
): CuisineBreakdownEntry[] {
  const map = new Map<string, { count: number; totalScore: number }>();

  for (const entry of entries) {
    const existing = map.get(entry.cuisine);
    if (existing) {
      existing.count += 1;
      existing.totalScore += entry.voteScore;
    } else {
      map.set(entry.cuisine, { count: 1, totalScore: entry.voteScore });
    }
  }

  return [...map.entries()]
    .map(([cuisine, { count, totalScore }]) => ({
      cuisine,
      count,
      avgScore: count > 0 ? totalScore / count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute the top cuisine from a cuisine breakdown.
 */
export function findTopCuisine(
  breakdown: CuisineBreakdownEntry[],
): string | null {
  if (breakdown.length === 0) return null;
  return breakdown[0].cuisine;
}

/**
 * Compute average score from a list of vote scores.
 */
export function computeAvgScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return sum / scores.length;
}

// ── Handle uniqueness (F-025) ─────────────────────────────────────────

export type HandleAvailability = 'available' | 'taken' | 'invalid' | 'cooldown';

export interface CheckHandleAvailabilityInput {
  handle: string;
  /** Optional: skip the "taken" check when the handle already belongs to this profile id. */
  currentProfileId?: string;
}

/** 30-day cooldown window for recently released handles. */
export const HANDLE_COOLDOWN_DAYS = 30;

const HANDLE_REGEX = /^[A-Za-z0-9_]{2,30}$/;

/**
 * Check whether a handle is available for the current chef.
 *
 * Returns:
 *  - `'invalid'`    when the handle fails the 2-30 alphanum/underscore regex.
 *  - `'taken'`      when another chef already owns the handle (case-insensitive).
 *  - `'cooldown'`   when the handle was released within the last 30 days.
 *  - `'available'`  otherwise.
 *
 * The check is informational; the unique index on
 * `social_profiles (lower(handle))` enforces correctness on write.
 */
export async function checkHandleAvailability(
  supabase: SupabaseClient,
  input: CheckHandleAvailabilityInput,
): Promise<BestChefResult<HandleAvailability>> {
  const handle = (input.handle ?? '').trim();
  if (!HANDLE_REGEX.test(handle)) return ok('invalid');

  const lower = handle.toLowerCase();

  // 1. Taken: another profile already owns this handle (case-insensitive).
  const { data: takenRows, error: takenErr } = await supabase
    .from('social_profiles')
    .select('id, handle')
    .ilike('handle', lower)
    .limit(2);

  if (takenErr) return err(takenErr.message);

  const conflicts = (takenRows ?? []).filter((row) => {
    const rowHandle = ((row.handle as string) ?? '').toLowerCase();
    if (rowHandle !== lower) return false;
    if (input.currentProfileId && (row.id as string) === input.currentProfileId) return false;
    return true;
  });

  if (conflicts.length > 0) return ok('taken');

  // 2. Cooldown: handle was released within the last 30 days.
  const cutoff = new Date(Date.now() - HANDLE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: histRows, error: histErr } = await supabase
    .from('bc_handle_history')
    .select('handle, released_at')
    .eq('handle', lower)
    .gte('released_at', cutoff)
    .limit(1);

  if (histErr) return err(histErr.message);
  if ((histRows ?? []).length > 0) return ok('cooldown');

  return ok('available');
}

// ── Avatar upload (F-026) ─────────────────────────────────────────────

export interface UploadAvatarInput {
  /** Local file URI (file:// or data:) or a fetched Blob. */
  uri: string;
  /** Owner profile id; the storage path is keyed by user id, not profile id. */
  userId: string;
  /** Optional MIME type override (defaults to image/jpeg). */
  contentType?: string;
  /** Optional progress callback (0-100). Reported in coarse buckets. */
  onProgress?: (percent: number) => void;
}

export interface UploadAvatarResult {
  publicUrl: string;
  storagePath: string;
}

/** Storage bucket for chef avatars. Created via Supabase dashboard, public read. */
export const AVATAR_BUCKET = 'bc-avatars';

/** Maximum avatar dimension. Larger images must be downscaled before upload. */
export const AVATAR_MAX_DIMENSION = 512;

/**
 * Upload an avatar image to Supabase Storage and write the public URL to
 * `social_profiles.avatar_url`.
 *
 * Caller is responsible for client-side resizing to {@link AVATAR_MAX_DIMENSION};
 * this helper does NOT resize. The bucket is expected to exist and to allow
 * authenticated writes scoped by the owner's user id.
 *
 * On failure the existing `avatar_url` is left untouched so the previous
 * avatar continues to render and the caller can surface a retry CTA.
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  input: UploadAvatarInput,
): Promise<BestChefResult<UploadAvatarResult>> {
  const { uri, userId, contentType = 'image/jpeg', onProgress } = input;
  if (!uri || !userId) return err('Missing avatar uri or user id.');

  onProgress?.(0);

  let blob: Blob;
  try {
    const response = await fetch(uri);
    blob = await response.blob();
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to read avatar file.');
  }

  onProgress?.(20);

  // Content hash suffix avoids stale CDN caches when the user replaces the
  // same logical avatar with new bytes. Use a coarse timestamp bucket here so
  // the path stays stable across retries within the same upload attempt.
  const suffix = Math.floor(Date.now() / 1000).toString(36);
  const storagePath = `${userId}/avatar-${suffix}.jpg`;

  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: '3600',
      contentType,
      upsert: true,
    });

  if (uploadErr) return err(uploadErr.message);

  onProgress?.(80);

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) return err('Failed to resolve avatar public URL.');

  const { error: updateErr } = await supabase
    .from('social_profiles')
    .update({ avatar_url: publicUrl })
    .eq('user_id', userId);

  if (updateErr) return err(updateErr.message);

  onProgress?.(100);

  return ok({ publicUrl, storagePath });
}

// ── Cloud functions ──────────────────────────────────────────────────

/**
 * Fetch the full chef profile: social profile + BestChef stats + badges
 * + signature dishes.
 */
export async function getChefProfile(
  profileId: string,
): Promise<BestChefResult<ChefProfileData>> {
  // 1. Fetch social profile
  const { data: profile, error: profileErr } = await from('social_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (profileErr) return err(profileErr.message);

  // 2. Gather stats, badges, and signature dishes in parallel
  const [statsResult, badgesResult, sigResult] = await Promise.all([
    getChefStats(profileId),
    getChefBadgesWithDefs(profileId),
    getSignatureDishes(getBestChefClient(), { chefId: profileId }),
  ]);

  if (!statsResult.ok) return err(statsResult.error);
  if (!badgesResult.ok) return err(badgesResult.error);
  if (!sigResult.ok) return err(sigResult.error);

  const stats = statsResult.data;

  return ok({
    profileId,
    handle: profile.handle as string,
    displayName: profile.display_name as string,
    bio: (profile.bio as string) ?? null,
    avatarUrl: (profile.avatar_url as string) ?? null,
    followerCount: (profile.follower_count as number) ?? 0,
    followingCount: (profile.following_count as number) ?? 0,
    totalSubmissions: stats.totalSubmissions,
    totalVotesReceived: stats.totalVotesReceived,
    dishesWon: stats.dishesWon,
    avgScore: stats.avgScore,
    topCuisine: stats.topCuisine,
    signatureDishes: sigResult.data,
    badges: badgesResult.data,
    activeSince: stats.activeSince,
  });
}

/**
 * Look up a chef profile by handle instead of profileId.
 */
export async function getChefProfileByHandle(
  handle: string,
): Promise<BestChefResult<ChefProfileData>> {
  const { data: profile, error: profileErr } = await from('social_profiles')
    .select('id')
    .eq('handle', handle)
    .single();

  if (profileErr) return err(profileErr.message);
  return getChefProfile(profile.id as string);
}

/**
 * All submissions by a chef, sorted by score or date.
 */
export async function getChefSubmissions(
  profileId: string,
  options?: ChefSubmissionListOptions,
): Promise<BestChefResult<Submission[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const sortBy = options?.sortBy ?? 'vote_score';

  const { data, error: dbErr } = await from('bc_submissions')
    .select('*')
    .eq('profile_id', profileId)
    .order(sortBy, { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);

  const submissions = (data ?? []).map(mapSubmission);
  // Sign submission images (audit C1: private bucket). Only approved rows resolve;
  // a chef's own pending rows show through RLS but are not publicly linkable here.
  const signed = await resolveSubmissionImageUrls(
    submissions.map((submission, index) => ({
      id: String(index),
      storedValue: submission.photoUrl,
      approved: submission.moderationStatus === 'approved',
    })),
  );
  submissions.forEach((submission, index) => {
    submission.photoUrl = signed.get(String(index)) ?? null;
  });
  return ok(submissions);
}

/**
 * Compute aggregated stats for a chef.
 */
export async function getChefStats(
  profileId: string,
): Promise<BestChefResult<ChefStats>> {
  // Fetch all submissions for this chef
  const { data: subs, error: subErr } = await from('bc_submissions')
    .select('id, vote_score, created_at, dish_id')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });

  if (subErr) return err(subErr.message);

  const submissions = subs ?? [];
  const totalSubmissions = submissions.length;

  if (totalSubmissions === 0) {
    return ok({
      totalSubmissions: 0,
      totalVotesReceived: 0,
      dishesWon: 0,
      avgScore: 0,
      topCuisine: null,
      activeSince: new Date().toISOString(),
    });
  }

  // Count total votes received across all submissions
  const submissionIds = submissions.map((s) => s.id as string);
  const { count: voteCount, error: voteErr } = await from('bc_votes')
    .select('*', { count: 'exact', head: true })
    .in('submission_id', submissionIds);

  if (voteErr) return err(voteErr.message);

  // Count dishes won (rank #1)
  const { count: winsCount, error: winsErr } = await from('bc_rankings')
    .select('*', { count: 'exact', head: true })
    .in('submission_id', submissionIds)
    .eq('rank', 1);

  if (winsErr) return err(winsErr.message);

  // Compute average score
  const scores = submissions.map((s) => (s.vote_score as number) ?? 0);
  const avgScore = computeAvgScore(scores);

  // Get cuisine breakdown for top cuisine
  const dishIds = [...new Set(submissions.map((s) => s.dish_id as string))];
  const { data: dishes, error: dishErr } = await from('bc_dishes')
    .select('id, cuisine')
    .in('id', dishIds);

  if (dishErr) return err(dishErr.message);

  const dishCuisineMap = new Map<string, string>();
  for (const d of dishes ?? []) {
    dishCuisineMap.set(d.id as string, d.cuisine as string);
  }

  const cuisineEntries = submissions.map((s) => ({
    cuisine: dishCuisineMap.get(s.dish_id as string) ?? 'unknown',
    voteScore: (s.vote_score as number) ?? 0,
  }));

  const breakdown = aggregateCuisineBreakdown(cuisineEntries);
  const topCuisine = findTopCuisine(breakdown);

  const activeSince = (submissions[0].created_at as string) ?? new Date().toISOString();

  return ok({
    totalSubmissions,
    totalVotesReceived: voteCount ?? 0,
    dishesWon: winsCount ?? 0,
    avgScore,
    topCuisine,
    activeSince: typeof activeSince === 'string' ? activeSince : new Date(activeSince).toISOString(),
  });
}

export interface GetSignatureDishesInput {
  chefId: string;
}

export interface SetSignatureDishesInput {
  submissionIds: string[];
}

export const SIGNATURE_DISHES_MAX = 3;

/**
 * Fetch the chef's curated signature dishes in stored order.
 *
 * Reads `social_profiles.signature_submission_ids` (set by `setSignatureDishes`)
 * and joins to the corresponding submissions and dishes. Returns an empty
 * array when the chef has not picked any signatures yet, when the stored
 * array references missing submissions, or when the row is absent.
 */
export async function getSignatureDishes(
  supabase: SupabaseClient,
  input: GetSignatureDishesInput,
): Promise<BestChefResult<SignatureDish[]>> {
  const { data: profileRow, error: profileErr } = await supabase
    .from('social_profiles')
    .select('signature_submission_ids')
    .eq('id', input.chefId)
    .maybeSingle();

  if (profileErr) return err(profileErr.message);

  const ids = ((profileRow?.signature_submission_ids as string[] | null) ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (ids.length === 0) return ok([]);

  const { data: subs, error: subErr } = await supabase
    .from('bc_submissions')
    .select('id, dish_id, vote_score, rank, photo_url, moderation_status')
    .in('id', ids);

  if (subErr) return err(subErr.message);

  const subRows = subs ?? [];
  if (subRows.length === 0) return ok([]);

  const dishIds = [...new Set(subRows.map((s) => s.dish_id as string))];
  const { data: dishes, error: dishErr } = await supabase
    .from('bc_dishes')
    .select('id, name, cuisine')
    .in('id', dishIds);

  if (dishErr) return err(dishErr.message);

  const dishMap = new Map<string, { name: string; cuisine: string }>();
  for (const d of dishes ?? []) {
    dishMap.set(d.id as string, {
      name: d.name as string,
      cuisine: d.cuisine as string,
    });
  }

  const subMap = new Map<string, Record<string, unknown>>();
  for (const s of subRows) {
    subMap.set(s.id as string, s);
  }

  // Sign submission images (audit C1: private bucket). Signature dishes appear
  // on a public profile, so only approved rows resolve to a URL.
  const signedPhotos = await resolveSubmissionImageUrls(
    subRows.map((sub) => ({
      id: sub.id as string,
      storedValue: (sub.photo_url as string) ?? null,
      approved: (sub.moderation_status as string) === 'approved',
    })),
    supabase,
  );

  // Preserve stored order; drop ids whose submission is missing.
  const ordered: SignatureDish[] = [];
  for (const id of ids) {
    const sub = subMap.get(id);
    if (!sub) continue;
    const dish = dishMap.get(sub.dish_id as string);
    ordered.push({
      submissionId: sub.id as string,
      dishId: sub.dish_id as string,
      dishName: dish?.name ?? '',
      cuisine: dish?.cuisine ?? '',
      voteScore: (sub.vote_score as number) ?? 0,
      rank: (sub.rank as number) ?? null,
      photoUrl: signedPhotos.get(sub.id as string) ?? null,
    });
  }
  return ok(ordered);
}

/**
 * Persist the caller's signature dish picks.
 *
 * Validates length (≤ SIGNATURE_DISHES_MAX) and rejects ids the caller does
 * not own. Ownership is enforced by resolving the caller's social profile and
 * selecting from `bc_submissions.profile_id`; ids that do not return are
 * treated as a forbidden write.
 */
export async function setSignatureDishes(
  supabase: SupabaseClient,
  input: SetSignatureDishesInput,
): Promise<BestChefResult<SignatureDish[]>> {
  if (input.submissionIds.length > SIGNATURE_DISHES_MAX) {
    return err(`At most ${SIGNATURE_DISHES_MAX} signature dishes are allowed.`);
  }

  // Deduplicate but preserve first-seen order.
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of input.submissionIds) {
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return err(userErr.message);
  const userId = userData?.user?.id;
  if (!userId) return err('Not authenticated.');

  const { data: profileRow, error: profileErr } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileErr) return err(profileErr.message);
  const profileId = profileRow?.id as string | undefined;
  if (!profileId) return err('Social profile not found.');

  if (ids.length > 0) {
    const { data: ownedRows, error: ownErr } = await supabase
      .from('bc_submissions')
      .select('id')
      .eq('profile_id', profileId)
      .in('id', ids);

    if (ownErr) return err(ownErr.message);

    const ownedSet = new Set((ownedRows ?? []).map((r) => r.id as string));
    const unauthorized = ids.filter((id) => !ownedSet.has(id));
    if (unauthorized.length > 0) {
      return err('One or more submissions do not belong to the current chef.');
    }
  }

  const { error: updateErr } = await supabase
    .from('social_profiles')
    .update({ signature_submission_ids: ids })
    .eq('id', profileId);

  if (updateErr) return err(updateErr.message);

  return getSignatureDishes(supabase, { chefId: profileId });
}

interface SearchChefsRpcRow {
  id: string;
}

/**
 * Search chef profiles by name or handle, optionally filtered by cuisine.
 *
 * Uses the bc_search_chefs RPC. Fully parameterized: the previous
 * implementation interpolated the raw query into a PostgREST `.or(ilike)`
 * filter string, which could be broken or repurposed by input containing
 * `,`, `(`, or `)` (filter injection). Same fix pattern as searchDishes.
 */
export async function searchChefs(
  query: string,
  options?: ChefSearchOptions,
): Promise<BestChefResult<ChefProfileData[]>> {
  const limit = options?.limit ?? 20;

  const { data, error: rpcErr } = await getBestChefClient().rpc('bc_search_chefs', {
    p_query: query ?? '',
    p_cuisine: options?.cuisine ?? null,
    p_limit: limit,
  });

  if (rpcErr) return err(rpcErr.message);

  const rows = (data ?? []) as unknown as SearchChefsRpcRow[];
  if (rows.length === 0) return ok([]);

  // Build full profiles
  const results: ChefProfileData[] = [];
  for (const row of rows) {
    const result = await getChefProfile(row.id);
    if (result.ok) {
      results.push(result.data);
    }
  }

  return ok(results);
}

/**
 * Top chefs ranked by total vote score across all submissions.
 */
export async function getTopChefs(
  options?: ChefSearchOptions,
): Promise<BestChefResult<ChefProfileData[]>> {
  const limit = options?.limit ?? 20;

  // Build the query for submissions, optionally filtering by cuisine
  let subQuery = from('bc_submissions').select('profile_id, vote_score, dish_id');

  if (options?.cuisine) {
    // Get dish IDs for this cuisine first
    const { data: dishes, error: dishErr } = await from('bc_dishes')
      .select('id')
      .eq('cuisine', options.cuisine);

    if (dishErr) return err(dishErr.message);

    const dishIds = (dishes ?? []).map((d) => d.id as string);
    if (dishIds.length === 0) return ok([]);

    subQuery = subQuery.in('dish_id', dishIds);
  }

  const { data: subs, error: subErr } = await subQuery;
  if (subErr) return err(subErr.message);

  if (!subs || subs.length === 0) return ok([]);

  // Aggregate total score per chef
  const chefScores = new Map<string, number>();
  for (const sub of subs) {
    const pid = sub.profile_id as string;
    const score = (sub.vote_score as number) ?? 0;
    chefScores.set(pid, (chefScores.get(pid) ?? 0) + score);
  }

  // Sort by total score and take top N
  const topChefIds = [...chefScores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id);

  // Build full profiles
  const results: ChefProfileData[] = [];
  for (const pid of topChefIds) {
    const result = await getChefProfile(pid);
    if (result.ok) {
      results.push(result.data);
    }
  }

  return ok(results);
}

/**
 * Cuisine breakdown for a chef: count and average score per cuisine.
 */
export async function getCuisineBreakdown(
  profileId: string,
): Promise<BestChefResult<CuisineBreakdownEntry[]>> {
  // Get all submissions with dish info
  const { data: subs, error: subErr } = await from('bc_submissions')
    .select('dish_id, vote_score')
    .eq('profile_id', profileId);

  if (subErr) return err(subErr.message);

  if (!subs || subs.length === 0) return ok([]);

  // Fetch dish cuisines
  const dishIds = [...new Set(subs.map((s) => s.dish_id as string))];
  const { data: dishes, error: dishErr } = await from('bc_dishes')
    .select('id, cuisine')
    .in('id', dishIds);

  if (dishErr) return err(dishErr.message);

  const dishCuisineMap = new Map<string, string>();
  for (const d of dishes ?? []) {
    dishCuisineMap.set(d.id as string, d.cuisine as string);
  }

  const entries = subs.map((s) => ({
    cuisine: dishCuisineMap.get(s.dish_id as string) ?? 'unknown',
    voteScore: (s.vote_score as number) ?? 0,
  }));

  return ok(aggregateCuisineBreakdown(entries));
}

/**
 * Lightweight aggregate stats for the Chef Stats Card: totals across all of a
 * chef's submissions without counting dish-wins or firing extra RPC calls.
 */
export interface ChefAggregateStats {
  totalUpvotes: number;
  totalReviewed: number;
  avgScore: number;
  totalSubmissions: number;
}

export async function getChefAggregateStats(
  profileId: string,
): Promise<BestChefResult<ChefAggregateStats>> {
  const { data, error: dbErr } = await from('bc_submissions')
    .select('vote_score, upvote_count, reviewed_count')
    .eq('profile_id', profileId);

  if (dbErr) return err(dbErr.message);

  const rows = data ?? [];
  if (rows.length === 0) {
    return ok({ totalUpvotes: 0, totalReviewed: 0, avgScore: 0, totalSubmissions: 0 });
  }

  let totalUpvotes = 0;
  let totalReviewed = 0;
  let scoreSum = 0;

  for (const row of rows) {
    totalUpvotes += (row.upvote_count as number) ?? 0;
    totalReviewed += (row.reviewed_count as number) ?? 0;
    scoreSum += (row.vote_score as number) ?? 0;
  }

  return ok({
    totalUpvotes,
    totalReviewed,
    avgScore: parseFloat((scoreSum / rows.length).toFixed(1)),
    totalSubmissions: rows.length,
  });
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Fetch a chef's badges joined with badge definitions.
 */
async function getChefBadgesWithDefs(
  profileId: string,
): Promise<BestChefResult<ChefBadgeWithDef[]>> {
  // Get badges for this chef
  const { data: badges, error: badgeErr } = await from('bc_chef_badges')
    .select('id, badge_id, earned_at')
    .eq('profile_id', profileId);

  if (badgeErr) return err(badgeErr.message);

  if (!badges || badges.length === 0) return ok([]);

  // Fetch badge definitions
  const badgeIds = badges.map((b) => b.badge_id as string);
  const { data: defs, error: defErr } = await from('bc_badge_definitions')
    .select('id, name, description, icon, tier')
    .in('id', badgeIds);

  if (defErr) return err(defErr.message);

  const defMap = new Map<
    string,
    { name: string; description: string; icon: string; tier: string }
  >();
  for (const d of defs ?? []) {
    defMap.set(d.id as string, {
      name: d.name as string,
      description: d.description as string,
      icon: d.icon as string,
      tier: d.tier as string,
    });
  }

  return ok(
    badges.map((b) => {
      const def = defMap.get(b.badge_id as string);
      return {
        id: b.id as string,
        badgeId: b.badge_id as string,
        earnedAt: new Date(b.earned_at as string),
        name: def?.name ?? '',
        description: def?.description ?? '',
        icon: def?.icon ?? '',
        tier: (def?.tier as ChefBadgeWithDef['tier']) ?? 'bronze',
      };
    }),
  );
}
