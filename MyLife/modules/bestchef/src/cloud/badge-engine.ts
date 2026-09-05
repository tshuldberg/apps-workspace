/**
 * Badge engine -- definitions and auto-awarding for chef achievements.
 *
 * 10 initial badges across bronze/silver/gold/platinum tiers.
 * evaluateBadges() checks all criteria and awards newly earned badges.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { BadgeDefinition, ChefBadge } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Badge criteria types ─────────────────────────────────────────────

export interface BadgeCriteria {
  /** Type of check to perform. */
  type:
    | 'submission_count'
    | 'votes_on_single'
    | 'score_threshold'
    | 'rank_threshold'
    | 'cuisine_count'
    | 'consistent_score'
    | 'photo_verified'
    | 'helpful_notes'
    | 'rank_count';
  /** Numeric threshold for the check. */
  threshold: number;
  /** For score_threshold: minimum score each qualifying submission needs. */
  minScore?: number;
}

// ── 10 initial badge definitions ─────────────────────────────────────

export interface BadgeDefinitionSeed {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  criteria: BadgeCriteria;
}

export const BADGE_DEFINITIONS: BadgeDefinitionSeed[] = [
  {
    id: 'first_submission',
    name: 'First Dish',
    description: 'Submit your first recipe to BestChef.',
    icon: 'plate',
    tier: 'bronze',
    criteria: { type: 'submission_count', threshold: 1 },
  },
  {
    id: 'five_submissions',
    name: 'Kitchen Regular',
    description: 'Submit 5 recipes to BestChef.',
    icon: 'chef_hat',
    tier: 'silver',
    criteria: { type: 'submission_count', threshold: 5 },
  },
  {
    id: 'crowd_favorite',
    name: 'Crowd Favorite',
    description: 'Receive 50 or more votes on a single submission.',
    icon: 'star',
    tier: 'silver',
    criteria: { type: 'votes_on_single', threshold: 50 },
  },
  {
    id: 'rising_chef',
    name: 'Rising Chef',
    description: 'Have 3 dishes with a score above 0.5.',
    icon: 'trending_up',
    tier: 'bronze',
    criteria: { type: 'score_threshold', threshold: 3, minScore: 0.5 },
  },
  {
    id: 'best_in_class',
    name: 'Best in Class',
    description: 'Achieve rank #1 for any dish.',
    icon: 'trophy',
    tier: 'gold',
    criteria: { type: 'rank_threshold', threshold: 1 },
  },
  {
    id: 'world_cuisine',
    name: 'World Cuisine',
    description: 'Submit recipes in 5 or more different cuisines.',
    icon: 'globe',
    tier: 'silver',
    criteria: { type: 'cuisine_count', threshold: 5 },
  },
  {
    id: 'consistent_chef',
    name: 'Consistent Chef',
    description: 'Submit 10 recipes that all score above 0.3.',
    icon: 'check_circle',
    tier: 'silver',
    criteria: { type: 'consistent_score', threshold: 10, minScore: 0.3 },
  },
  {
    id: 'photo_verified',
    name: 'Verified Chef',
    description: 'Pass photo verification on a submission.',
    icon: 'camera',
    tier: 'bronze',
    criteria: { type: 'photo_verified', threshold: 1 },
  },
  {
    id: 'community_helper',
    name: 'Community Helper',
    description: 'Write 10 Community Notes rated as helpful.',
    icon: 'handshake',
    tier: 'bronze',
    criteria: { type: 'helpful_notes', threshold: 10 },
  },
  {
    id: 'legendary_chef',
    name: 'Legendary Chef',
    description: 'Achieve rank #1 for 10 or more dishes.',
    icon: 'crown',
    tier: 'platinum',
    criteria: { type: 'rank_count', threshold: 10 },
  },
];

// ── Pure helpers (exported for testing) ──────────────────────────────

/**
 * Validate that a badge definition seed has all required fields.
 */
export function isValidBadgeDefinition(def: BadgeDefinitionSeed): boolean {
  return (
    def.id.length > 0 &&
    def.name.length > 0 &&
    def.description.length > 0 &&
    def.icon.length > 0 &&
    ['bronze', 'silver', 'gold', 'platinum'].includes(def.tier) &&
    def.criteria != null &&
    typeof def.criteria.type === 'string' &&
    typeof def.criteria.threshold === 'number' &&
    def.criteria.threshold > 0
  );
}

/**
 * Check if a criteria is met given the relevant stat value.
 * Pure function for testable criteria evaluation.
 */
export function isCriteriaMet(
  criteria: BadgeCriteria,
  stats: BadgeEvalStats,
): boolean {
  switch (criteria.type) {
    case 'submission_count':
      return stats.totalSubmissions >= criteria.threshold;

    case 'votes_on_single':
      return stats.maxVotesOnSingle >= criteria.threshold;

    case 'score_threshold':
      return stats.submissionsAboveScore(criteria.minScore ?? 0) >= criteria.threshold;

    case 'rank_threshold':
      return stats.bestRank !== null && stats.bestRank <= criteria.threshold;

    case 'cuisine_count':
      return stats.uniqueCuisines >= criteria.threshold;

    case 'consistent_score': {
      const minScore = criteria.minScore ?? 0;
      const aboveCount = stats.submissionsAboveScore(minScore);
      // All counted submissions must be above the min score,
      // and the total must meet the threshold
      return (
        stats.totalSubmissions >= criteria.threshold &&
        aboveCount >= criteria.threshold
      );
    }

    case 'photo_verified':
      return stats.photoVerifiedCount >= criteria.threshold;

    case 'helpful_notes':
      return stats.helpfulNoteCount >= criteria.threshold;

    case 'rank_count':
      return stats.rank1Count >= criteria.threshold;

    default:
      return false;
  }
}

/**
 * Stats bundle passed to criteria evaluation.
 * Built from Supabase queries, but the evaluation itself is pure.
 */
export interface BadgeEvalStats {
  totalSubmissions: number;
  maxVotesOnSingle: number;
  /** Returns count of submissions with score >= minScore. */
  submissionsAboveScore: (minScore: number) => number;
  bestRank: number | null;
  uniqueCuisines: number;
  photoVerifiedCount: number;
  helpfulNoteCount: number;
  rank1Count: number;
}

/**
 * Build a BadgeEvalStats from raw data arrays. Pure, testable.
 */
export function buildEvalStats(data: {
  submissionScores: number[];
  voteCounts: number[];
  ranks: number[];
  cuisines: string[];
  photoVerifiedCount: number;
  helpfulNoteCount: number;
}): BadgeEvalStats {
  const sortedRanks = [...data.ranks].sort((a, b) => a - b);

  return {
    totalSubmissions: data.submissionScores.length,
    maxVotesOnSingle:
      data.voteCounts.length > 0 ? Math.max(...data.voteCounts) : 0,
    submissionsAboveScore: (minScore: number) =>
      data.submissionScores.filter((s) => s >= minScore).length,
    bestRank: sortedRanks.length > 0 ? sortedRanks[0] : null,
    uniqueCuisines: new Set(data.cuisines).size,
    photoVerifiedCount: data.photoVerifiedCount,
    helpfulNoteCount: data.helpfulNoteCount,
    rank1Count: data.ranks.filter((r) => r === 1).length,
  };
}

// ── Row mappers ──────────────────────────────────────────────────────

function mapBadgeDefinition(row: Record<string, unknown>): BadgeDefinition {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    icon: row.icon as string,
    criteriaJson: row.criteria_json,
    tier: row.tier as BadgeDefinition['tier'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapChefBadge(row: Record<string, unknown>): ChefBadge {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    badgeId: row.badge_id as string,
    earnedAt: new Date(row.earned_at as string),
  };
}

// ── Cloud functions ──────────────────────────────────────────────────

/**
 * Seed (upsert) the 10 badge definitions into bc_badge_definitions.
 */
export async function seedBadgeDefinitions(): Promise<
  BestChefResult<BadgeDefinition[]>
> {
  const rows = BADGE_DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    criteria_json: JSON.stringify(def.criteria),
    tier: def.tier,
  }));

  const { data, error: dbErr } = await from('bc_badge_definitions')
    .upsert(rows, { onConflict: 'id' })
    .select();

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapBadgeDefinition));
}

/**
 * List all badge definitions.
 */
export async function getBadgeDefinitions(): Promise<
  BestChefResult<BadgeDefinition[]>
> {
  const { data, error: dbErr } = await from('bc_badge_definitions')
    .select('*')
    .order('tier', { ascending: true });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapBadgeDefinition));
}

/**
 * All badges earned by a chef.
 */
export async function getChefBadges(
  profileId: string,
): Promise<BestChefResult<ChefBadge[]>> {
  const { data, error: dbErr } = await from('bc_chef_badges')
    .select('*')
    .eq('profile_id', profileId)
    .order('earned_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapChefBadge));
}

/**
 * Check if a chef has a specific badge.
 */
export async function hasBadge(
  profileId: string,
  badgeId: string,
): Promise<BestChefResult<boolean>> {
  const { count, error: dbErr } = await from('bc_chef_badges')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('badge_id', badgeId);

  if (dbErr) return err(dbErr.message);
  return ok((count ?? 0) > 0);
}

/**
 * Manually award a badge to a chef. No-ops if already earned.
 */
export async function awardBadge(
  profileId: string,
  badgeId: string,
): Promise<BestChefResult<ChefBadge | null>> {
  // Check if already earned
  const hasIt = await hasBadge(profileId, badgeId);
  if (!hasIt.ok) return err(hasIt.error);
  if (hasIt.data) return ok(null); // Already earned

  const { data, error: dbErr } = await from('bc_chef_badges')
    .insert({
      profile_id: profileId,
      badge_id: badgeId,
      earned_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapChefBadge(data));
}

/**
 * Evaluate all badge criteria for a chef and auto-award newly earned badges.
 * Returns only the badges that were newly awarded in this call.
 */
export async function evaluateBadges(
  profileId: string,
): Promise<BestChefResult<ChefBadge[]>> {
  // 1. Get current badges
  const currentResult = await getChefBadges(profileId);
  if (!currentResult.ok) return err(currentResult.error);
  const earnedIds = new Set(currentResult.data.map((b) => b.badgeId));

  // 2. Gather stats from Supabase
  const statsResult = await gatherBadgeEvalData(profileId);
  if (!statsResult.ok) return err(statsResult.error);
  const stats = statsResult.data;

  // 3. Check each badge definition
  const newlyAwarded: ChefBadge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    if (earnedIds.has(def.id)) continue; // Already earned

    if (isCriteriaMet(def.criteria, stats)) {
      const awardResult = await awardBadge(profileId, def.id);
      if (awardResult.ok && awardResult.data) {
        newlyAwarded.push(awardResult.data);
        // Fanout badge notification -- fire-and-forget
        const _badgeId = def.id;
        void (async () => {
          try {
            await getBestChefClient().rpc('bc_notify_badge', { chef_id: profileId, badge_id: _badgeId });
          } catch { /* never block the primary path */ }
        })();
      }
    }
  }

  return ok(newlyAwarded);
}

// ── Profile badge queries ─────────────────────────────────────────────

export interface EarnedBadge {
  id: string;
  icon: string;
  name: string;
  description: string;
  tint: string;
  earnedAt: string;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
  tint: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned: boolean;
  earnedAt: string | null;
}

/** Map badge tier to a hex tint colour matching the are-blaze BadgesSection. */
function tierTint(tier: string): string {
  switch (tier) {
    case 'platinum': return '#E2E8F0';
    case 'gold':     return '#EAB308';
    case 'silver':   return '#94A3B8';
    default:         return '#F97316'; // bronze -> orange
  }
}

/**
 * Earned badges for a chef with full display metadata.
 * Returns only badges the chef has earned, newest-first.
 */
export async function getEarnedBadges(
  supabase: ReturnType<typeof getBestChefClient>,
  chefId: string,
): Promise<BestChefResult<EarnedBadge[]>> {
  const { data: earned, error: earnedErr } = await supabase
    .from('bc_chef_badges')
    .select('id, badge_id, earned_at')
    .eq('profile_id', chefId)
    .order('earned_at', { ascending: false });

  if (earnedErr) return err(earnedErr.message);
  if (!earned || earned.length === 0) return ok([]);

  const badgeIds = earned.map((b) => b.badge_id as string);
  const { data: defs, error: defErr } = await supabase
    .from('bc_badge_definitions')
    .select('id, name, description, icon, tier')
    .in('id', badgeIds);

  if (defErr) return err(defErr.message);

  const defMap = new Map<string, { name: string; description: string; icon: string; tier: string }>();
  for (const d of defs ?? []) {
    defMap.set(d.id as string, {
      name: d.name as string,
      description: d.description as string,
      icon: d.icon as string,
      tier: d.tier as string,
    });
  }

  return ok(
    earned.map((b) => {
      const def = defMap.get(b.badge_id as string);
      return {
        id: b.id as string,
        icon: def?.icon ?? 'rosette',
        name: def?.name ?? '',
        description: def?.description ?? '',
        tint: tierTint(def?.tier ?? 'bronze'),
        earnedAt: b.earned_at as string,
      };
    }),
  );
}

/**
 * All defined badges for a chef with earned/locked status.
 * Earned badges include earnedAt; locked badges have earnedAt: null.
 * Earned badges appear before locked badges; within each group sorted by tier weight.
 */
export async function getAllBadgesForChef(
  supabase: ReturnType<typeof getBestChefClient>,
  chefId: string,
): Promise<BestChefResult<Badge[]>> {
  const { data: defs, error: defErr } = await supabase
    .from('bc_badge_definitions')
    .select('id, name, description, icon, tier');

  if (defErr) return err(defErr.message);

  const { data: earned, error: earnedErr } = await supabase
    .from('bc_chef_badges')
    .select('badge_id, earned_at')
    .eq('profile_id', chefId);

  if (earnedErr) return err(earnedErr.message);

  const earnedMap = new Map<string, string>();
  for (const e of earned ?? []) {
    earnedMap.set(e.badge_id as string, e.earned_at as string);
  }

  const tierOrder = { bronze: 0, silver: 1, gold: 2, platinum: 3 } as const;

  const badges: Badge[] = (defs ?? []).map((d) => {
    const tier = (d.tier as Badge['tier']) ?? 'bronze';
    const earnedAt = earnedMap.get(d.id as string) ?? null;
    return {
      id: d.id as string,
      icon: d.icon as string,
      name: d.name as string,
      description: d.description as string,
      tint: tierTint(tier),
      tier,
      earned: earnedAt !== null,
      earnedAt,
    };
  });

  badges.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned && b.earned) {
      return new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime();
    }
    return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
  });

  return ok(badges);
}

// ── Internal: gather evaluation data ─────────────────────────────────

async function gatherBadgeEvalData(
  profileId: string,
): Promise<BestChefResult<BadgeEvalStats>> {
  // Fetch submissions
  const { data: subs, error: subErr } = await from('bc_submissions')
    .select('id, vote_score, photo_verified, dish_id')
    .eq('profile_id', profileId);

  if (subErr) return err(subErr.message);

  const submissions = subs ?? [];
  const submissionIds = submissions.map((s) => s.id as string);
  const submissionScores = submissions.map((s) => (s.vote_score as number) ?? 0);

  // Vote counts per submission
  let voteCounts: number[] = [];
  if (submissionIds.length > 0) {
    // Get vote counts grouped by submission
    const voteCountPromises = submissionIds.map(async (sid) => {
      const { count } = await from('bc_votes')
        .select('*', { count: 'exact', head: true })
        .eq('submission_id', sid);
      return count ?? 0;
    });
    voteCounts = await Promise.all(voteCountPromises);
  }

  // Rankings for this chef's submissions
  let ranks: number[] = [];
  if (submissionIds.length > 0) {
    const { data: rankData } = await from('bc_rankings')
      .select('rank')
      .in('submission_id', submissionIds);
    ranks = (rankData ?? []).map((r) => r.rank as number);
  }

  // Unique cuisines
  const dishIds = [...new Set(submissions.map((s) => s.dish_id as string))];
  let cuisines: string[] = [];
  if (dishIds.length > 0) {
    const { data: dishes } = await from('bc_dishes')
      .select('cuisine')
      .in('id', dishIds);
    cuisines = (dishes ?? []).map((d) => d.cuisine as string);
  }

  // Photo verified count
  const photoVerifiedCount = submissions.filter(
    (s) => (s.photo_verified as boolean) === true,
  ).length;

  // Helpful notes count
  const { count: helpfulNoteCount, error: noteErr } = await from('bc_notes')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', profileId)
    .eq('status', 'shown');

  if (noteErr) return err(noteErr.message);

  return ok(
    buildEvalStats({
      submissionScores,
      voteCounts,
      ranks,
      cuisines,
      photoVerifiedCount,
      helpfulNoteCount: helpfulNoteCount ?? 0,
    }),
  );
}
