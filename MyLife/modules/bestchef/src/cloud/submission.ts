/**
 * Submission engine -- publish local recipes to BestChef cloud.
 *
 * A submission links a frozen RecipeSnapshot to a dish for ranking.
 * Each user may submit up to MAX_SUBMISSIONS_PER_DISH per dish.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { Submission, RecipeSnapshot } from './types';
import { getRecipeWithDetails } from '../db/crud';
import { calculateRecipeNutrition } from '../nutrition/recipe-nutrition';
import { resolveSubmissionImageUrls } from './submission-image-url';

export const MAX_SUBMISSIONS_PER_DISH = 3;

export interface SubmissionProfileSummary {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
}

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mappers ───────────────────────────────────────────────────────

function mapSnapshot(row: Record<string, unknown>): RecipeSnapshot {
  return {
    id: row.id as string,
    originalLocalRecipeId: (row.original_local_recipe_id as string) ?? null,
    profileId: row.profile_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    servings: (row.servings as number) ?? null,
    prepTimeMins: (row.prep_time_mins as number) ?? null,
    cookTimeMins: (row.cook_time_mins as number) ?? null,
    totalTimeMins: (row.total_time_mins as number) ?? null,
    difficulty: (row.difficulty as string) ?? null,
    ingredientsJson: row.ingredients_json ?? null,
    stepsJson: row.steps_json ?? null,
    tags: (row.tags as string[]) ?? null,
    nutritionJson: row.nutrition_json ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    sourceAttribution: (row.source_attribution as string) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

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
    // P1-A fields
    region: (row.region as string) ?? null,
    isRestaurant: (row.is_restaurant as boolean) ?? false,
    upvoteCount: (row.upvote_count as number) ?? 0,
    downvoteCount: (row.downvote_count as number) ?? 0,
    reviewedCount: (row.reviewed_count as number) ?? 0,
    tapCount: (row.tap_count as number) ?? 0,
    language: (row.language as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Rewrite each submission's photoUrl to a freshly-minted, short-lived signed
 * URL (audit C1: the submission-images bucket is private, so a stored public
 * URL no longer resolves). Only content the viewer may see is signed:
 *   - approved submissions (public), or
 *   - the owner's own rows when `includeOwnedPending` is true.
 * Anything else has its photoUrl nulled so a pending/rejected image cannot leak.
 * Mutates in place and returns the same array for call-site convenience.
 */
async function attachSignedPhotoUrls<T extends Submission>(
  submissions: T[],
  options: { includeOwnedPending?: boolean } = {},
): Promise<T[]> {
  if (submissions.length === 0) return submissions;
  const includeOwnedPending = options.includeOwnedPending ?? false;

  const signed = await resolveSubmissionImageUrls(
    submissions.map((submission, index) => ({
      id: String(index),
      storedValue: submission.photoUrl,
      approved: submission.moderationStatus === 'approved' || includeOwnedPending,
    })),
  );

  submissions.forEach((submission, index) => {
    submission.photoUrl = signed.get(String(index)) ?? null;
  });
  return submissions;
}

/** Normalize an app language to the stored lowercase tag shape, else null. */
export function normalizeUgcLanguage(language: string | null | undefined): string | null {
  const lowered = (language ?? '').trim().toLowerCase();
  return /^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(lowered) ? lowered : null;
}

function mapSubmissionProfile(row: Record<string, unknown>): SubmissionProfileSummary {
  return {
    id: row.id as string,
    displayName: (row.display_name as string) ?? 'BestChef Cook',
    handle: (row.handle as string) ?? 'bestchef',
    avatarUrl: (row.avatar_url as string) ?? null,
  };
}

// ── Count check ───────────────────────────────────────────────────────

export async function countUserSubmissionsForDish(
  profileId: string,
  dishId: string,
): Promise<BestChefResult<number>> {
  const { count, error: dbErr } = await from('bc_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('dish_id', dishId);

  if (dbErr) return err(dbErr.message);
  return ok(count ?? 0);
}

// ── Publish ───────────────────────────────────────────────────────────

export interface PublishLocation {
  chefLocation?: string;
  lat?: number;
  lng?: number;
  countryCode?: string;
}

/**
 * Create a RecipeSnapshot from local recipe data and publish it as a
 * BestChef submission for the given dish.
 *
 * Enforces the MAX_SUBMISSIONS_PER_DISH limit per user per dish.
 *
 * `photoUrl` must be an https URL already resolved by the caller (e.g. via
 * {@link uploadSubmissionPhoto}). Local file:// URIs are rejected because
 * `bc_submissions.photo_url` is constrained to https URLs only by
 * `bc_submissions_photo_url_https`.
 */
export async function publishRecipeToCloud(
  db: DatabaseAdapter,
  recipeId: string,
  dishId: string,
  profileId: string,
  location?: PublishLocation,
  photoUrl?: string | null,
  /** Author's app language; tags the snapshot + submission (Phase 2.5). */
  language?: string | null,
): Promise<BestChefResult<Submission>> {
  const ugcLanguage = normalizeUgcLanguage(language);
  // 0. Defense-in-depth: never let a non-https URL reach bc_submissions.
  let resolvedPhotoUrl: string | null = null;
  if (typeof photoUrl === 'string' && photoUrl.length > 0) {
    if (!photoUrl.startsWith('https://')) {
      return err('photo_url must be an https:// URL.');
    }
    resolvedPhotoUrl = photoUrl;
  }

  // 1. Check submission limit
  const countResult = await countUserSubmissionsForDish(profileId, dishId);
  if (!countResult.ok) return err(countResult.error);
  if (countResult.data >= MAX_SUBMISSIONS_PER_DISH) {
    return err(
      `Maximum ${MAX_SUBMISSIONS_PER_DISH} submissions per dish reached. ` +
        `Use swapSubmission to replace an existing entry.`,
    );
  }

  // 2. Read local recipe
  const details = getRecipeWithDetails(db, recipeId);
  if (!details) {
    return err(`Local recipe ${recipeId} not found`);
  }

  const { recipe, ingredients, steps, tags } = details;
  const nutritionSummary = calculateRecipeNutrition(db, recipeId);
  const nutritionJson = nutritionSummary.coverage > 0 ? nutritionSummary.perServing : null;

  // If no caller-provided photoUrl, fall back to the local recipe image only
  // when it already looks like an https URL. file:// or content:// URIs are
  // dropped to null so the row passes the bc_submissions_photo_url_https
  // constraint.
  if (resolvedPhotoUrl === null && typeof recipe.image_uri === 'string') {
    if (recipe.image_uri.startsWith('https://')) {
      resolvedPhotoUrl = recipe.image_uri;
    }
  }

  // 3. Create snapshot
  const { data: snapRow, error: snapErr } = await from('bc_recipe_snapshots')
    .insert({
      original_local_recipe_id: recipeId,
      profile_id: profileId,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prep_time_mins: recipe.prep_time_mins,
      cook_time_mins: recipe.cook_time_mins,
      total_time_mins: recipe.total_time_mins,
      difficulty: recipe.difficulty,
      ingredients_json: JSON.stringify(ingredients),
      steps_json: JSON.stringify(steps),
      tags: tags.map((t) => t.tag),
      nutrition_json: nutritionJson,
      source_url: recipe.source_url,
      language: ugcLanguage,
    })
    .select()
    .single();

  if (snapErr) return err(snapErr.message);

  // 4. Create submission
  const { data: subRow, error: subErr } = await from('bc_submissions')
    .insert({
      dish_id: dishId,
      recipe_snapshot_id: snapRow.id,
      profile_id: profileId,
      photo_url: resolvedPhotoUrl,
      chef_location: location?.chefLocation ?? null,
      chef_location_lat: location?.lat ?? null,
      chef_location_lng: location?.lng ?? null,
      country_code: location?.countryCode ?? null,
      language: ugcLanguage,
    })
    .select()
    .single();

  if (subErr) return err(subErr.message);
  return ok(mapSubmission(subRow));
}

// ── Read ──────────────────────────────────────────────────────────────

export async function getMySubmissions(
  profileId: string,
): Promise<BestChefResult<Submission[]>> {
  const { data, error: dbErr } = await from('bc_submissions')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  // Owner-scoped: the caller sees their own pending rows too, so sign those.
  return ok(await attachSignedPhotoUrls((data ?? []).map(mapSubmission), { includeOwnedPending: true }));
}

export interface SubmissionListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'vote_score' | 'created_at';
}

export async function getSubmissionsForDish(
  dishId: string,
  options?: SubmissionListOptions,
): Promise<BestChefResult<Submission[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const sortBy = options?.sortBy ?? 'vote_score';

  const { data, error: dbErr } = await from('bc_submissions')
    .select('*')
    .eq('dish_id', dishId)
    .order(sortBy, { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok(await attachSignedPhotoUrls((data ?? []).map(mapSubmission)));
}

export async function getSubmissionById(
  id: string,
): Promise<
  BestChefResult<{
    submission: Submission;
    snapshot: RecipeSnapshot;
    profile: SubmissionProfileSummary | null;
  }>
> {
  const { data: subRow, error: subErr } = await from('bc_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (subErr) return err(subErr.message);

  const { data: snapRow, error: snapErr } = await from('bc_recipe_snapshots')
    .select('*')
    .eq('id', subRow.recipe_snapshot_id)
    .single();

  if (snapErr) return err(snapErr.message);

  const { data: profileRow, error: profileErr } = await from('social_profiles')
    .select('id, display_name, handle, avatar_url')
    .eq('id', subRow.profile_id)
    .maybeSingle();

  if (profileErr) return err(profileErr.message);

  // RLS only returns this row when it is approved OR owned by the caller, so a
  // pending row here means the viewer is the owner: sign it either way.
  const [submission] = await attachSignedPhotoUrls([mapSubmission(subRow)], {
    includeOwnedPending: true,
  });

  return ok({
    submission,
    snapshot: mapSnapshot(snapRow),
    profile: profileRow ? mapSubmissionProfile(profileRow) : null,
  });
}

// ── Swap ──────────────────────────────────────────────────────────────

/**
 * Replace an existing submission with a new recipe.
 * Deletes the old submission and its snapshot, then publishes the new one.
 */
export async function swapSubmission(
  profileId: string,
  dishId: string,
  oldSubmissionId: string,
  newRecipeId: string,
  db: DatabaseAdapter,
  /** Author's app language; falls back to the replaced row's tag (Phase 2.5). */
  language?: string | null,
): Promise<BestChefResult<Submission>> {
  // Verify ownership
  const { data: existing, error: fetchErr } = await from('bc_submissions')
    .select('id, profile_id, recipe_snapshot_id, language')
    .eq('id', oldSubmissionId)
    .eq('profile_id', profileId)
    .eq('dish_id', dishId)
    .single();

  if (fetchErr) return err(fetchErr.message);
  if (!existing) return err('Submission not found or not owned by user');

  // Delete old submission (snapshot can be kept or cleaned up later)
  const { error: delErr } = await from('bc_submissions')
    .delete()
    .eq('id', oldSubmissionId);

  if (delErr) return err(delErr.message);

  // Delete old snapshot
  await from('bc_recipe_snapshots')
    .delete()
    .eq('id', existing.recipe_snapshot_id);

  // Publish replacement (count check will pass since we just deleted one).
  // Carry the language tag: an untagged replacement would silently drop out
  // of every language-filtered feed (review finding, Phase 2.5).
  return publishRecipeToCloud(
    db,
    newRecipeId,
    dishId,
    profileId,
    undefined,
    undefined,
    normalizeUgcLanguage(language) ?? ((existing.language as string | null) ?? null),
  );
}

// ── Discovery: top this week ──────────────────────────────────────────

export interface TopSubmissionsOptions {
  limit?: number;
  /** When true, restrict to restaurant submissions only. */
  isRestaurant?: boolean;
  /** When provided, restrict to submissions whose profile_id is in this list. */
  followerIds?: string[];
  /** When provided, restrict to submissions in this region string. */
  region?: string;
}

/**
 * Top submissions by vote_score created or updated in the past 7 days.
 * Used for the Home hero card and TopThisWeek carousel.
 *
 * Supports optional filter params for HomeFilterChips integration:
 * - isRestaurant: restaurants filter
 * - followerIds: following filter (intersect with followed profile IDs)
 * - region: nearby filter (coarse region string)
 */
export async function getTopSubmissionsThisWeek(
  options?: TopSubmissionsOptions,
): Promise<BestChefResult<Submission[]>> {
  const limit = options?.limit ?? 10;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = from('bc_submissions')
    .select('*')
    .eq('moderation_status', 'approved')
    .gte('updated_at', since)
    .order('vote_score', { ascending: false })
    .limit(limit);

  if (options?.isRestaurant === true) {
    query = query.eq('is_restaurant', true);
  }
  if (options?.followerIds && options.followerIds.length > 0) {
    query = query.in('profile_id', options.followerIds);
  }
  if (options?.region) {
    query = query.eq('region', options.region);
  }

  const { data, error: dbErr } = await query;
  if (dbErr) return err(dbErr.message);
  return ok(await attachSignedPhotoUrls((data ?? []).map(mapSubmission)));
}

// ── Vote feed ─────────────────────────────────────────────────────────

export interface VoteFeedOptions {
  /**
   * Supabase client with a valid auth session. Must be provided so that
   * the already-voted exclusion check uses the authenticated user's profile.
   */
  supabase?: ReturnType<typeof getBestChefClient>;
  /** Total items to return per page. Default: 20. */
  limit?: number;
  /** Profile ID of the current viewer, used to exclude their own submissions. */
  viewerProfileId?: string;
  /**
   * Restrict to submissions tagged with this lowercase language (Phase 2.5).
   * Untagged (null-language) rows are excluded when set; omit for all.
   */
  language?: string | null;
}

export type VoteFeedSubmission = Submission & {
  chefDisplayName: string | null;
  chefAvatarUrl: string | null;
  chefHandle: string | null;
  comment_count: number;
  is_restaurant: boolean;
  dishName?: string;
  cuisine?: string | null;
  dishRegion?: string | null;
  recipeTitle?: string | null;
  topIngredients?: string[];
  gradientFrom?: string | null;
  gradientTo?: string | null;
  emoji?: string | null;
};

const SUBMISSION_DISPLAY_SELECT = `
  *,
  social_profiles!bc_submissions_profile_id_fkey (display_name, handle, avatar_url),
  bc_dishes!bc_submissions_dish_id_fkey (name, cuisine, region),
  bc_recipe_snapshots!bc_submissions_recipe_snapshot_id_fkey (title, ingredients_json),
  bc_comments (count)
`;

type JoinValue<T> = T | T[] | null | undefined;

function firstJoin<T>(value: JoinValue<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseJsonish(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function recipeIngredientLines(value: unknown): string[] {
  const parsed = parseJsonish(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item) => {
    if (typeof item === 'string') {
      const line = item.trim();
      return line ? [line] : [];
    }
    if (!item || typeof item !== 'object') return [];

    const row = item as {
      name?: unknown;
      item?: unknown;
      quantity?: unknown;
      unit?: unknown;
    };
    if (typeof row.name === 'string' && row.name.trim()) {
      return [row.name.trim()];
    }

    const parts = [row.quantity, row.unit, row.item]
      .filter((part): part is string | number => (
        typeof part === 'string' || typeof part === 'number'
      ))
      .map((part) => String(part).trim())
      .filter(Boolean);
    return parts.length > 0 ? [parts.join(' ')] : [];
  });
}

type RowWithSubmissionDisplayJoins = Record<string, unknown> & {
  social_profiles?: JoinValue<{
    display_name?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
  }>;
  bc_dishes?: JoinValue<{
    name?: string | null;
    cuisine?: string | null;
    region?: string | null;
    gradient_from?: string | null;
    gradient_to?: string | null;
    emoji?: string | null;
  }>;
  bc_recipe_snapshots?: JoinValue<{
    title?: string | null;
    ingredients_json?: unknown;
  }>;
  bc_comments?: JoinValue<{ count: number }>;
};

function mapSubmissionDisplayRow(rawRow: unknown): VoteFeedSubmission {
  const row = rawRow as RowWithSubmissionDisplayJoins;
  const profile = firstJoin(row.social_profiles);
  const dish = firstJoin(row.bc_dishes);
  const snapshot = firstJoin(row.bc_recipe_snapshots);
  const base = mapSubmission({
    ...row,
    region: row.region ?? dish?.region ?? null,
  } as Record<string, unknown>);
  const commentJoin = firstJoin(row.bc_comments);
  const commentCount =
    typeof commentJoin?.count === 'number' ? commentJoin.count : 0;

  return {
    ...base,
    chefDisplayName: profile?.display_name ?? null,
    chefAvatarUrl: profile?.avatar_url ?? null,
    chefHandle: profile?.handle ?? null,
    comment_count: commentCount,
    is_restaurant: (row.is_restaurant as boolean) ?? false,
    dishName: dish?.name ?? undefined,
    cuisine: dish?.cuisine ?? null,
    dishRegion: dish?.region ?? null,
    recipeTitle: snapshot?.title ?? null,
    topIngredients: recipeIngredientLines(snapshot?.ingredients_json).slice(0, 8),
    gradientFrom: dish?.gradient_from ?? null,
    gradientTo: dish?.gradient_to ?? null,
    emoji: dish?.emoji ?? null,
  };
}

/**
 * Paginated feed of approved submissions for the Vote tab.
 *
 * Excludes submissions the viewer has already voted on and their own submissions.
 * Returns a freshness × score blend: first half ordered by created_at desc,
 * second half ordered by vote_score desc, interleaved for variety.
 *
 * Returned rows include denormalised chef snapshot and interaction counts.
 */
export async function getVoteFeed(
  options?: VoteFeedOptions,
): Promise<BestChefResult<VoteFeedSubmission[]>> {
  const client = options?.supabase ?? getBestChefClient();
  const limit = options?.limit ?? 20;

  // Fetch already-voted submission IDs so we can exclude them
  let excludedIds: string[] = [];
  if (options?.viewerProfileId) {
    const { data: voted } = await client
      .from('bc_votes')
      .select('submission_id')
      .eq('voter_profile_id', options.viewerProfileId);
    excludedIds = (voted ?? []).map((r: Record<string, unknown>) => r.submission_id as string);
  }

  async function fetchHalf(orderCol: string, ascending: boolean, count: number) {
    let q = client
      .from('bc_submissions')
      .select(SUBMISSION_DISPLAY_SELECT)
      .eq('moderation_status', 'approved')
      .order(orderCol, { ascending })
      .limit(count);

    if (options?.viewerProfileId) {
      q = q.neq('profile_id', options.viewerProfileId);
    }
    // Normalized-only: junk language input never reaches the query (it
    // would silently match nothing); it is skipped like the write side
    // maps junk to null.
    const feedLanguage = options?.language ? normalizeUgcLanguage(options.language) : null;
    if (feedLanguage) {
      q = q.eq('language', feedLanguage);
    }
    if (excludedIds.length > 0) {
      q = q.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    return q;
  }

  const [freshRes, topRes] = await Promise.all([
    fetchHalf('created_at', false, limit),
    fetchHalf('vote_score', false, limit),
  ]);

  if (freshRes.error) return err(freshRes.error.message);
  if (topRes.error) return err(topRes.error.message);

  // Interleave: fresh[0], top[0], fresh[1], top[1], …
  const fresh = freshRes.data ?? [];
  const top = topRes.data ?? [];
  const seenIds = new Set<string>();
  const merged: typeof fresh = [];

  const maxLen = Math.max(fresh.length, top.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < fresh.length) {
      const row = fresh[i] as Record<string, unknown>;
      const id = row.id as string;
      if (!seenIds.has(id)) { seenIds.add(id); merged.push(fresh[i]); }
    }
    if (i < top.length) {
      const row = top[i] as Record<string, unknown>;
      const id = row.id as string;
      if (!seenIds.has(id)) { seenIds.add(id); merged.push(top[i]); }
    }
  }

  const results = merged.slice(0, limit).map(mapSubmissionDisplayRow);

  return ok(await attachSignedPhotoUrls(results));
}

// ── Discovery: verified restaurants ──────────────────────────────────

export interface VerifiedRestaurantSubmissionsOptions {
  limit?: number;
}

/**
 * Top approved submissions from restaurant accounts (is_restaurant=true),
 * ordered by vote_score desc. Used for the Home RestaurantSpotlight section.
 */
export async function getVerifiedRestaurantSubmissions(
  options?: VerifiedRestaurantSubmissionsOptions,
): Promise<BestChefResult<Submission[]>> {
  const limit = options?.limit ?? 3;

  const { data, error: dbErr } = await from('bc_submissions')
    .select('*')
    .eq('is_restaurant', true)
    .eq('moderation_status', 'approved')
    .order('vote_score', { ascending: false })
    .limit(limit);

  if (dbErr) return err(dbErr.message);
  return ok(await attachSignedPhotoUrls((data ?? []).map(mapSubmission)));
}

// ── Leaderboard ───────────────────────────────────────────────────────

export type LeaderboardKind = 'allTime' | 'dish' | 'cuisine' | 'region';

/**
 * Time window for leaderboard rankings.
 * Filters bc_submissions by created_at >= now() - interval.
 */
export type LeaderboardRange = 'today' | 'week' | 'month' | 'all';

export interface LeaderboardSubmissionsOptions {
  kind: LeaderboardKind;
  /** Required when kind is 'dish' (dish_id) or 'region' (region string). */
  subFilter?: string | null;
  limit?: number;
  /** Time window. Defaults to 'all'. */
  range?: LeaderboardRange;
  /**
   * Restrict to submissions tagged with this lowercase language (Phase
   * 2.5); composes with kind (e.g. region + language = per-market boards).
   */
  language?: string | null;
}

/** ms-per-day. Exposed for testing. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve the cutoff Date for a given range, or null for 'all'.
 * 'today' = last 24h, 'week' = last 7d, 'month' = last 30d.
 */
export function resolveLeaderboardRangeCutoff(
  range: LeaderboardRange,
  now: Date = new Date(),
): Date | null {
  switch (range) {
    case 'today':
      return new Date(now.getTime() - DAY_MS);
    case 'week':
      return new Date(now.getTime() - 7 * DAY_MS);
    case 'month':
      return new Date(now.getTime() - 30 * DAY_MS);
    case 'all':
    default:
      return null;
  }
}

/**
 * Top-100 leaderboard query. Ordered by vote_score desc.
 *
 * - allTime: no extra filter.
 * - dish: filter by bc_submissions.dish_id = subFilter.
 * - cuisine: join bc_dishes and filter by bc_dishes.cuisine = subFilter.
 * - region: filter by bc_submissions.region = subFilter.
 */
export async function getLeaderboardSubmissions(
  options: LeaderboardSubmissionsOptions,
): Promise<BestChefResult<Submission[]>> {
  const { kind, subFilter, limit = 100, range = 'all' } = options;
  const cutoff = resolveLeaderboardRangeCutoff(range);
  const cutoffIso = cutoff ? cutoff.toISOString() : null;
  // Normalized-only (see getVoteFeed): junk input skips the filter.
  const language = options.language ? normalizeUgcLanguage(options.language) : null;

  if (kind === 'cuisine') {
    if (!subFilter) {
      // No cuisine selected -- return empty
      return ok([]);
    }
    // Resolve dish IDs for the cuisine, then filter submissions
    const { data: dishRows, error: dishErr } = await getBestChefClient()
      .from('bc_dishes')
      .select('id')
      .eq('cuisine', subFilter)
      .eq('status', 'active');

    if (dishErr) return err(dishErr.message);
    const dishIds = (dishRows ?? []).map((r: Record<string, unknown>) => r.id as string);

    if (dishIds.length === 0) return ok([]);

    let cq = from('bc_submissions')
      .select(SUBMISSION_DISPLAY_SELECT)
      .in('dish_id', dishIds)
      .eq('moderation_status', 'approved')
      .order('vote_score', { ascending: false })
      .limit(limit);

    if (cutoffIso) {
      cq = cq.gte('created_at', cutoffIso);
    }
    if (language) {
      cq = cq.eq('language', language);
    }

    const { data, error: dbErr } = await cq;

    if (dbErr) return err(dbErr.message);
    return ok(await attachSignedPhotoUrls((data ?? []).map(mapSubmissionDisplayRow)));
  }

  let q = from('bc_submissions')
    .select(SUBMISSION_DISPLAY_SELECT)
    .eq('moderation_status', 'approved')
    .order('vote_score', { ascending: false })
    .limit(limit);

  if (kind === 'dish' && subFilter) {
    q = q.eq('dish_id', subFilter);
  } else if (kind === 'region' && subFilter) {
    q = q.eq('region', subFilter);
  }

  if (cutoffIso) {
    q = q.gte('created_at', cutoffIso);
  }
  if (language) {
    q = q.eq('language', language);
  }

  const { data, error: dbErr } = await q;
  if (dbErr) return err(dbErr.message);
  return ok(await attachSignedPhotoUrls((data ?? []).map(mapSubmissionDisplayRow)));
}

/**
 * Distinct non-null region values from bc_submissions, sorted alphabetically.
 * Used to populate the By Region sub-picker on the Leaderboard tab.
 */
export async function getAllRegions(): Promise<BestChefResult<string[]>> {
  const { data, error: dbErr } = await from('bc_submissions')
    .select('region')
    .not('region', 'is', null)
    .eq('moderation_status', 'approved');

  if (dbErr) return err(dbErr.message);

  const regions = [
    ...new Set(
      (data ?? [])
        .map((r: Record<string, unknown>) => r.region as string)
        .filter(Boolean),
    ),
  ].sort();

  return ok(regions);
}
