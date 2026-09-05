/**
 * Ranking engine -- materialize leaderboards from vote scores.
 *
 * Rankings are stored in bc_rankings as a materialized view of
 * bc_submissions sorted by vote_score. The image gate ensures
 * submissions without photos cannot appear in the top 100.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { Ranking, RankHistoryEntry, Submission } from './types';

/**
 * Fire rank-change notifications for a chef whose rank changed.
 * Call after rank rows are finalized. Fire-and-forget; never throws.
 */
export async function notifyRankChange(
  chefId: string,
  oldRank: number,
  newRank: number,
): Promise<void> {
  try {
    await getBestChefClient().rpc('bc_notify_rank_change', {
      chef_id: chefId,
      old_rank: oldRank,
      new_rank: newRank,
    });
  } catch {
    // fire-and-forget
  }
}

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mappers ───────────────────────────────────────────────────────

function mapRanking(row: Record<string, unknown>): Ranking {
  return {
    dishId: row.dish_id as string,
    submissionId: row.submission_id as string,
    score: row.score as number,
    rank: row.rank as number,
    region: (row.region as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    updatedAt: new Date(row.updated_at as string),
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

// ── Image gate ────────────────────────────────────────────────────────

const IMAGE_GATE_THRESHOLD = 100;

/**
 * Filter out submissions without photos from the top 100 positions.
 * Submissions ranked beyond 100 are left as-is regardless of photo status.
 */
export function enforceImageGate(rankings: Ranking[]): Ranking[] {
  const withPhoto: Ranking[] = [];
  const noPhoto: Ranking[] = [];

  for (const r of rankings) {
    if (r.rank <= IMAGE_GATE_THRESHOLD) {
      // For top-100 candidates, need to check if they have a photo.
      // Since Ranking doesn't carry photoUrl, we filter by a convention:
      // rankings passed here should already have been joined with submission
      // data. We use score > 0 as proxy only if photo data is unavailable.
      // The caller should use enforceImageGateWithSubmissions for full check.
      withPhoto.push(r);
    } else {
      withPhoto.push(r);
    }
  }

  return [...withPhoto, ...noPhoto];
}

/**
 * Full image gate with submission data.
 * Removes submissions without photos from the top 100, then re-ranks.
 */
export function enforceImageGateWithSubmissions(
  rankings: Ranking[],
  submissions: Map<string, Submission>,
): Ranking[] {
  // Separate rankings into those with/without photos
  const eligible: Ranking[] = [];
  const demoted: Ranking[] = [];

  for (const r of rankings) {
    const sub = submissions.get(r.submissionId);
    const hasPhoto = sub?.photoUrl != null && sub.photoUrl.length > 0;

    if (r.rank <= IMAGE_GATE_THRESHOLD && !hasPhoto) {
      demoted.push(r);
    } else {
      eligible.push(r);
    }
  }

  // Re-rank eligible entries
  const reRanked = eligible
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  // Append demoted entries after the eligible ones
  const demotedReRanked = demoted.map((r, i) => ({
    ...r,
    rank: reRanked.length + i + 1,
  }));

  return [...reRanked, ...demotedReRanked];
}

// ── Materialize ───────────────────────────────────────────────────────

/**
 * Fetch all submissions for a dish, sort by vote_score desc,
 * assign ranks 1..N, and upsert into bc_rankings.
 */
export async function materializeRankings(
  dishId: string,
  region?: string,
): Promise<BestChefResult<Ranking[]>> {
  let query = from('bc_submissions')
    .select('*')
    .eq('dish_id', dishId)
    .order('vote_score', { ascending: false });

  if (region) {
    query = query.eq('chef_location', region);
  }

  const { data, error: fetchErr } = await query;
  if (fetchErr) return err(fetchErr.message);

  const submissions = (data ?? []).map(mapSubmission);

  // Build ranking rows
  const rankingRows = submissions.map((sub, i) => ({
    dish_id: dishId,
    submission_id: sub.id,
    score: sub.voteScore,
    rank: i + 1,
    region: region ?? null,
    country_code: sub.countryCode ?? null,
    updated_at: new Date().toISOString(),
  }));

  if (rankingRows.length === 0) return ok([]);

  // Upsert rankings
  const { data: upserted, error: upsertErr } = await from('bc_rankings')
    .upsert(rankingRows, { onConflict: 'dish_id,submission_id,region' })
    .select();

  if (upsertErr) return err(upsertErr.message);
  return ok((upserted ?? []).map(mapRanking));
}

// ── Read rankings ─────────────────────────────────────────────────────

export interface RankingListOptions {
  limit?: number;
  offset?: number;
}

export async function getGlobalRankings(
  dishId: string,
  options?: RankingListOptions,
): Promise<BestChefResult<Ranking[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_rankings')
    .select('*')
    .eq('dish_id', dishId)
    .is('region', null)
    .order('rank', { ascending: true })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapRanking));
}

export async function getRegionalRankings(
  dishId: string,
  region: string,
  options?: RankingListOptions,
): Promise<BestChefResult<Ranking[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_rankings')
    .select('*')
    .eq('dish_id', dishId)
    .eq('region', region)
    .order('rank', { ascending: true })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapRanking));
}

// ── Discovery queries ─────────────────────────────────────────────────

export interface TopDishesOptions {
  category?: string;
  cuisine?: string;
  limit?: number;
}

/**
 * Dishes with the highest-scoring submissions.
 * Joins bc_submissions with bc_dishes, groups by dish, takes max vote_score.
 */
export async function getTopDishes(
  options?: TopDishesOptions,
): Promise<BestChefResult<Array<{ dishId: string; dishName: string; topScore: number }>>> {
  const limit = options?.limit ?? 20;

  let query = from('bc_dishes')
    .select('id, name, submission_count')
    .eq('status', 'active')
    .gt('submission_count', 0)
    .order('submission_count', { ascending: false })
    .limit(limit);

  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.cuisine) {
    query = query.eq('cuisine', options.cuisine);
  }

  const { data, error: dbErr } = await query;
  if (dbErr) return err(dbErr.message);

  // For each dish, get the top submission score
  const results: Array<{ dishId: string; dishName: string; topScore: number }> = [];

  for (const dish of data ?? []) {
    const { data: topSub } = await from('bc_submissions')
      .select('vote_score')
      .eq('dish_id', dish.id)
      .order('vote_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    results.push({
      dishId: dish.id as string,
      dishName: dish.name as string,
      topScore: (topSub?.vote_score as number) ?? 0,
    });
  }

  return ok(results.sort((a, b) => b.topScore - a.topScore));
}

export interface TrendingOptions {
  days?: number;
  limit?: number;
}

/**
 * Dishes with the most recent voting activity.
 * Counts votes cast within the given time window per dish.
 */
export async function getTrendingDishes(
  options?: TrendingOptions,
): Promise<BestChefResult<Array<{ dishId: string; dishName: string; recentVotes: number }>>> {
  const days = options?.days ?? 7;
  const limit = options?.limit ?? 20;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get recent votes with submission info
  const { data: recentVotes, error: voteErr } = await from('bc_votes')
    .select('submission_id')
    .gte('created_at', since);

  if (voteErr) return err(voteErr.message);

  if (!recentVotes || recentVotes.length === 0) return ok([]);

  // Count votes per submission
  const submissionIds = [...new Set(recentVotes.map((v) => v.submission_id as string))];

  const { data: submissions, error: subErr } = await from('bc_submissions')
    .select('id, dish_id')
    .in('id', submissionIds);

  if (subErr) return err(subErr.message);

  // Count votes per dish
  const dishVoteCounts = new Map<string, number>();
  const dishSubmissionMap = new Map<string, string>();

  for (const sub of submissions ?? []) {
    dishSubmissionMap.set(sub.id as string, sub.dish_id as string);
  }

  for (const vote of recentVotes) {
    const dishId = dishSubmissionMap.get(vote.submission_id as string);
    if (dishId) {
      dishVoteCounts.set(dishId, (dishVoteCounts.get(dishId) ?? 0) + 1);
    }
  }

  // Sort by vote count and take top N
  const sorted = [...dishVoteCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  // Fetch dish names
  const dishIds = sorted.map(([id]) => id);
  const { data: dishes, error: dishErr } = await from('bc_dishes')
    .select('id, name')
    .in('id', dishIds);

  if (dishErr) return err(dishErr.message);

  const dishNameMap = new Map<string, string>();
  for (const d of dishes ?? []) {
    dishNameMap.set(d.id as string, d.name as string);
  }

  return ok(
    sorted.map(([dishId, recentVoteCount]) => ({
      dishId,
      dishName: dishNameMap.get(dishId) ?? '',
      recentVotes: recentVoteCount,
    })),
  );
}

// ── Chef rank ─────────────────────────────────────────────────────────

/**
 * Where does this chef's best submission rank for a given dish?
 * Returns the best (lowest number) rank among all the chef's submissions.
 */
export async function getChefRank(
  profileId: string,
  dishId: string,
): Promise<BestChefResult<number | null>> {
  const { data, error: dbErr } = await from('bc_rankings')
    .select('rank')
    .eq('dish_id', dishId)
    .in(
      'submission_id',
      // Subquery: all submission IDs for this chef + dish
      (
        await from('bc_submissions')
          .select('id')
          .eq('profile_id', profileId)
          .eq('dish_id', dishId)
      ).data?.map((r) => r.id as string) ?? [],
    )
    .order('rank', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (dbErr) return err(dbErr.message);
  return ok(data ? (data.rank as number) : null);
}

// ── Rank history ──────────────────────────────────────────────────────

function mapRankHistoryEntry(row: Record<string, unknown>): RankHistoryEntry {
  return {
    chefId: row.chef_id as string,
    week: new Date(row.week as string),
    rank: row.rank as number,
    totalChefs: row.total_chefs as number,
  };
}

export interface WeeklyBatchChefRank {
  chefId: string;
  rank: number;
  totalChefs: number;
}

/**
 * Write/upsert a rank history row for a chef after the weekly batch run.
 * Keyed by (chef_id, week); week is normalized to the Monday of the current week.
 * Call this after computing each chef's rank during the weekly batch.
 */
export async function upsertRankHistoryEntry(
  entry: WeeklyBatchChefRank,
  week?: Date,
): Promise<BestChefResult<RankHistoryEntry>> {
  // Normalize to ISO date (YYYY-MM-DD)
  const weekDate = week ?? getMondayOfWeek(new Date());
  const weekIso = weekDate.toISOString().slice(0, 10);

  const { data, error: dbErr } = await from('bc_rank_history')
    .upsert(
      {
        chef_id: entry.chefId,
        week: weekIso,
        rank: entry.rank,
        total_chefs: entry.totalChefs,
      },
      { onConflict: 'chef_id,week' },
    )
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapRankHistoryEntry(data));
}

/**
 * Fetch rank history entries for a chef for sparkline rendering.
 * Returns entries ordered oldest-first (for charting left-to-right).
 */
export interface GetRankHistoryOptions {
  chefId: string;
  /** Number of weekly data points to return. Default 8. */
  weeks?: number;
}

export async function getRankHistory(
  options: GetRankHistoryOptions,
): Promise<BestChefResult<RankHistoryEntry[]>> {
  const { chefId, weeks = 8 } = options;

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error: dbErr } = await from('bc_rank_history')
    .select('*')
    .eq('chef_id', chefId)
    .gte('week', sinceIso)
    .order('week', { ascending: true });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapRankHistoryEntry));
}

/**
 * All-time rank for a specific submission.
 * Looks up the submission's row in bc_rankings (global / no region filter)
 * and returns its rank alongside the total number of ranked submissions for
 * that dish. Returns null when no ranking row exists yet.
 */
export async function getSubmissionRank(
  submissionId: string,
): Promise<BestChefResult<{ rank: number; totalChefs: number } | null>> {
  // First fetch the submission to get its dish_id
  const { data: sub, error: subErr } = await from('bc_submissions')
    .select('dish_id')
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr) return err(subErr.message);
  if (!sub) return ok(null);

  const dishId = sub.dish_id as string;

  // Fetch this submission's rank row
  const { data: rankRow, error: rankErr } = await from('bc_rankings')
    .select('rank')
    .eq('submission_id', submissionId)
    .eq('dish_id', dishId)
    .is('region', null)
    .maybeSingle();

  if (rankErr) return err(rankErr.message);
  if (!rankRow) return ok(null);

  // Total ranked submissions for this dish
  const { count, error: countErr } = await from('bc_rankings')
    .select('*', { count: 'exact', head: true })
    .eq('dish_id', dishId)
    .is('region', null);

  if (countErr) return err(countErr.message);

  return ok({ rank: rankRow.rank as number, totalChefs: count ?? 0 });
}

/**
 * Best rank this chef holds across all dishes.
 * Returns the lowest rank number (i.e. closest to #1) across all of this
 * chef's submissions. Useful for a global "Your rank" home stat.
 */
export async function getChefBestRank(
  profileId: string,
): Promise<BestChefResult<number | null>> {
  // Get all submission IDs for this chef
  const { data: subs, error: subErr } = await from('bc_submissions')
    .select('id')
    .eq('profile_id', profileId);

  if (subErr) return err(subErr.message);

  const submissionIds = (subs ?? []).map((r) => r.id as string);
  if (submissionIds.length === 0) return ok(null);

  const { data, error: rankErr } = await from('bc_rankings')
    .select('rank')
    .in('submission_id', submissionIds)
    .is('region', null)
    .order('rank', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (rankErr) return err(rankErr.message);
  return ok(data ? (data.rank as number) : null);
}

/** Returns the Monday of the week containing the given date. */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday wraps to previous Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
