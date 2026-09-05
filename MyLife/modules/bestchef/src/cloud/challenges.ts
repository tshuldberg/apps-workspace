/**
 * Seasonal challenge templates for BestChef.
 *
 * Uses @mylife/social Challenge system for creation and tracking.
 * Templates define reusable challenge blueprints tied to cooking seasons.
 */

import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Challenge,
  ChallengeGoal,
  ChallengeStatus,
} from '@mylife/social';
import { getBestChefClient, ok, err, type BestChefResult } from './client';

// ── Types ─────────────────────────────────────────────────────────────

export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'any';

export type ChallengeMetricType =
  | 'submissions'
  | 'votes_received'
  | 'cuisines_tried'
  | 'dishes_cooked'
  | 'recipes_shared';

export interface ChallengeGoalTemplate {
  description: string;
  targetCount: number;
  metricType: ChallengeMetricType;
}

export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  season: Season;
  durationDays: number;
  goals: ChallengeGoalTemplate[];
  badgeReward: string;
  icon: string;
}

// ── 5 Seasonal Templates ──────────────────────────────────────────────

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'summer_grill_master',
    name: 'Summer Grill Master',
    description:
      'Fire up the grill and prove your outdoor cooking chops. Submit grilled dishes, earn votes, and explore new cuisines.',
    season: 'summer',
    durationDays: 30,
    goals: [
      { description: 'Submit 5 grilled dishes', targetCount: 5, metricType: 'submissions' },
      { description: 'Receive 50 total votes', targetCount: 50, metricType: 'votes_received' },
      { description: 'Try 3 different cuisines', targetCount: 3, metricType: 'cuisines_tried' },
    ],
    badgeReward: 'grill_master',
    icon: '\u{1F525}',
  },
  {
    id: 'holiday_baker',
    name: 'Holiday Baker',
    description:
      'Celebrate the season with baked goods, shared recipes, and home cooking. Spread the warmth through your kitchen.',
    season: 'winter',
    durationDays: 21,
    goals: [
      { description: 'Submit 3 baked goods', targetCount: 3, metricType: 'submissions' },
      { description: 'Share 5 recipes', targetCount: 5, metricType: 'recipes_shared' },
      { description: 'Cook 10 dishes', targetCount: 10, metricType: 'dishes_cooked' },
    ],
    badgeReward: 'holiday_baker',
    icon: '\u{1F36A}',
  },
  {
    id: 'world_cuisine_explorer',
    name: 'World Cuisine Explorer',
    description:
      'Broaden your culinary horizons. Cook recipes from 10 different cuisines and try 20 dishes from around the world.',
    season: 'any',
    durationDays: 30,
    goals: [
      {
        description: 'Submit recipes from 10 different cuisines',
        targetCount: 10,
        metricType: 'cuisines_tried',
      },
      { description: 'Try 20 dishes', targetCount: 20, metricType: 'dishes_cooked' },
    ],
    badgeReward: 'world_explorer',
    icon: '\u{1F30D}',
  },
  {
    id: 'farm_to_table',
    name: 'Farm to Table',
    description:
      'Cook with fresh, seasonal ingredients. Submit dishes that celebrate local produce and earn community votes.',
    season: 'spring',
    durationDays: 14,
    goals: [
      {
        description: 'Submit 5 dishes with fresh/seasonal ingredients',
        targetCount: 5,
        metricType: 'submissions',
      },
      { description: 'Receive 25 votes', targetCount: 25, metricType: 'votes_received' },
    ],
    badgeReward: 'farm_to_table',
    icon: '\u{1F33F}',
  },
  {
    id: 'comfort_food_championship',
    name: 'Comfort Food Championship',
    description:
      'Bring your best comfort food to the table. Submit hearty dishes, rack up votes, and aim for a Best Chef nod.',
    season: 'fall',
    durationDays: 21,
    goals: [
      { description: 'Submit 7 comfort food dishes', targetCount: 7, metricType: 'submissions' },
      { description: 'Receive 100 total votes', targetCount: 100, metricType: 'votes_received' },
      {
        description: 'Get 1 Best Chef vote',
        targetCount: 1,
        metricType: 'votes_received',
      },
    ],
    badgeReward: 'comfort_champion',
    icon: '\u{1F372}',
  },
];

// ── Pure helpers ──────────────────────────────────────────────────────

/** Returns the current season based on month (Northern Hemisphere). */
export function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring';   // Mar-May
  if (month >= 5 && month <= 7) return 'summer';    // Jun-Aug
  if (month >= 8 && month <= 10) return 'fall';     // Sep-Nov
  return 'winter';                                   // Dec-Feb
}

/** Returns the season for a specific month (0-11). */
export function getSeasonForMonth(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

// ── Template accessors ────────────────────────────────────────────────

/** Returns all 5 challenge templates. */
export function getChallengeTemplates(): ChallengeTemplate[] {
  return CHALLENGE_TEMPLATES;
}

/**
 * Returns templates matching the given season (or the current season if none specified).
 * Templates with season 'any' always match.
 */
export function getSeasonalChallenges(season?: Season): ChallengeTemplate[] {
  const target = season ?? getCurrentSeason();
  return CHALLENGE_TEMPLATES.filter(
    (t) => t.season === target || t.season === 'any',
  );
}

/** Find a template by ID. */
export function getTemplateById(templateId: string): ChallengeTemplate | undefined {
  return CHALLENGE_TEMPLATES.find((t) => t.id === templateId);
}

// ── Challenge creation ────────────────────────────────────────────────

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

/**
 * Creates an actual @mylife/social Challenge from a template.
 * Calculates start/end dates based on the template's duration.
 */
export async function createChallengeFromTemplate(
  templateId: string,
  creatorProfileId: string,
): Promise<BestChefResult<Challenge>> {
  const template = getTemplateById(templateId);
  if (!template) {
    return err(`Unknown challenge template: ${templateId}`);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + template.durationDays * 24 * 60 * 60 * 1000);

  const challengeId = uuidv4();
  const goals: ChallengeGoal[] = template.goals.map((g) => ({
    id: uuidv4(),
    challengeId,
    moduleId: 'recipes' as const,
    activityType: 'recipes_cooked' as const,
    targetCount: g.targetCount,
    unit: g.metricType.replace(/_/g, ' '),
    description: g.description,
  }));

  const challenge: Challenge = {
    id: challengeId,
    title: template.name,
    description: template.description,
    creatorId: creatorProfileId,
    status: 'active',
    startsAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    goals,
    memberCount: 1,
    visibility: 'public',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  try {
    const { error } = await from('social_challenges').insert({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      creator_id: creatorProfileId,
      status: 'active',
      starts_at: challenge.startsAt,
      ends_at: challenge.endsAt,
      member_count: 1,
      visibility: 'public',
      metadata: { templateId, badgeReward: template.badgeReward, icon: template.icon },
    });

    if (error) return err(error.message);

    // Insert goals
    const goalRows = goals.map((g) => ({
      id: g.id,
      challenge_id: challengeId,
      module_id: 'recipes',
      activity_type: 'recipes_cooked',
      target_count: g.targetCount,
      unit: g.unit,
      description: g.description,
    }));

    const { error: goalsError } = await from('social_challenge_goals').insert(goalRows);
    if (goalsError) return err(goalsError.message);

    // Auto-join the creator
    const { error: joinError } = await from('social_challenge_members').insert({
      id: uuidv4(),
      challenge_id: challengeId,
      profile_id: creatorProfileId,
      status: 'joined',
      progress: {},
      joined_at: now.toISOString(),
      completed_at: null,
    });
    if (joinError) return err(joinError.message);

    return ok(challenge);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create challenge');
  }
}

// ── Progress tracking ─────────────────────────────────────────────────

export interface ChallengeProgress {
  challengeId: string;
  profileId: string;
  goals: GoalProgress[];
  overallPercent: number;
  isComplete: boolean;
}

export interface GoalProgress {
  goalId: string;
  description: string;
  targetCount: number;
  currentCount: number;
  percent: number;
  isComplete: boolean;
}

/**
 * Check progress against goals using BestChef submission/vote data.
 */
export async function getChallengeProgress(
  challengeId: string,
  profileId: string,
): Promise<BestChefResult<ChallengeProgress>> {
  try {
    // Fetch challenge membership
    const { data: member, error: memberError } = await from('social_challenge_members')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('profile_id', profileId)
      .single();

    if (memberError || !member) {
      return err('Not a member of this challenge');
    }

    // Fetch goals
    const { data: goals, error: goalsError } = await from('social_challenge_goals')
      .select('*')
      .eq('challenge_id', challengeId);

    if (goalsError || !goals) {
      return err('Failed to fetch challenge goals');
    }

    const progressMap = (member.progress ?? {}) as Record<string, number>;

    const goalProgress: GoalProgress[] = goals.map((g: Record<string, unknown>) => {
      const currentCount = progressMap[g.id as string] ?? 0;
      const targetCount = g.target_count as number;
      const percent = targetCount > 0 ? Math.min(100, Math.round((currentCount / targetCount) * 100)) : 0;
      return {
        goalId: g.id as string,
        description: g.description as string,
        targetCount,
        currentCount,
        percent,
        isComplete: currentCount >= targetCount,
      };
    });

    const overallPercent =
      goalProgress.length > 0
        ? Math.round(goalProgress.reduce((sum, g) => sum + g.percent, 0) / goalProgress.length)
        : 0;

    return ok({
      challengeId,
      profileId,
      goals: goalProgress,
      overallPercent,
      isComplete: goalProgress.every((g) => g.isComplete),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to get challenge progress');
  }
}

/**
 * Get all active challenges for a user.
 */
export async function getActiveChallenges(
  profileId: string,
): Promise<BestChefResult<Challenge[]>> {
  try {
    const { data: memberships, error: memberError } = await from('social_challenge_members')
      .select('challenge_id')
      .eq('profile_id', profileId)
      .eq('status', 'joined');

    if (memberError) return err(memberError.message);
    if (!memberships || memberships.length === 0) return ok([]);

    const challengeIds = memberships.map((m: Record<string, unknown>) => m.challenge_id as string);

    const { data: challenges, error: challengeError } = await from('social_challenges')
      .select('*, social_challenge_goals(*)')
      .in('id', challengeIds)
      .eq('status', 'active');

    if (challengeError) return err(challengeError.message);
    if (!challenges) return ok([]);

    const mapped: Challenge[] = challenges.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      title: c.title as string,
      description: (c.description as string) ?? null,
      creatorId: c.creator_id as string,
      status: c.status as ChallengeStatus,
      startsAt: c.starts_at as string,
      endsAt: c.ends_at as string,
      goals: ((c.social_challenge_goals as Record<string, unknown>[]) ?? []).map(
        (g: Record<string, unknown>) => ({
          id: g.id as string,
          challengeId: g.challenge_id as string,
          moduleId: (g.module_id as string) as 'recipes',
          activityType: g.activity_type as 'recipes_cooked',
          targetCount: g.target_count as number,
          unit: g.unit as string,
          description: g.description as string,
        }),
      ),
      memberCount: c.member_count as number,
      visibility: (c.visibility as 'public' | 'followers' | 'private') ?? 'public',
      createdAt: c.created_at as string,
      updatedAt: c.updated_at as string,
    }));

    return ok(mapped);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to get active challenges');
  }
}

// ── Live challenges (P13-E: F-012, F-013, B-009) ──────────────────────
//
// These helpers talk to the bc_challenges + bc_challenge_enrollments tables
// added in migrations/014__challenge_enrollments.sql. They replace the
// hard-coded DEMO_CHALLENGES fixture used by the standalone Challenges
// screen and provide the join/leave/progress/claim API needed by the
// detail route.

export type ChallengeMetric = ChallengeMetricType;

export interface ChallengeRecord {
  id: string;
  templateId: string;
  title: string;
  description: string;
  reward: string;
  badgeId: string | null;
  metric: ChallengeMetric;
  targetCount: number;
  startsAt: string;
  endsAt: string | null;
  claimDeadline: string | null;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
}

export interface ChallengeEnrollment {
  challengeId: string;
  userId: string;
  joinedAt: string;
  completedAt: string | null;
  rewardClaimedAt: string | null;
}

export interface ChallengeListItem {
  challenge: ChallengeRecord;
  enrollment: ChallengeEnrollment | null;
  currentCount: number;
}

export interface ChallengeDetailView {
  challenge: ChallengeRecord;
  enrollment: ChallengeEnrollment | null;
  currentCount: number;
  isComplete: boolean;
}

export type ChallengeListStatus = 'active' | 'joined' | 'completed' | 'all';

function mapChallengeRow(row: Record<string, unknown>): ChallengeRecord {
  const metric = (row.metric as ChallengeMetric | null) ?? 'submissions';
  return {
    id: row.id as string,
    templateId: (row.template_id as string) ?? '',
    title: (row.title as string) ?? '',
    description: (row.description as string) ?? '',
    reward: (row.reward as string) ?? '',
    badgeId: (row.badge_id as string | null) ?? null,
    metric,
    targetCount: Number(row.target_count ?? 1),
    startsAt: (row.starts_at as string) ?? new Date(0).toISOString(),
    endsAt: (row.ends_at as string | null) ?? null,
    claimDeadline: (row.claim_deadline as string | null) ?? null,
    status: ((row.status as ChallengeRecord['status']) ?? 'active'),
    createdAt: (row.created_at as string) ?? new Date(0).toISOString(),
  };
}

function mapEnrollmentRow(row: Record<string, unknown> | null | undefined): ChallengeEnrollment | null {
  if (!row) return null;
  return {
    challengeId: row.challenge_id as string,
    userId: row.user_id as string,
    joinedAt: (row.joined_at as string) ?? new Date(0).toISOString(),
    completedAt: (row.completed_at as string | null) ?? null,
    rewardClaimedAt: (row.reward_claimed_at as string | null) ?? null,
  };
}

async function getCurrentUserId(supabase: SupabaseClient): Promise<BestChefResult<string | null>> {
  const { data, error: authErr } = await supabase.auth.getUser();
  if (authErr) return err(authErr.message);
  return ok(data.user?.id ?? null);
}

/**
 * Count submissions for the caller that satisfy the challenge metric.
 * Pure SQL count (no scoring) -- enough for progress display + completion.
 *
 * Returns a BestChefResult: a swallowed PostgREST error (e.g. a query
 * against a column that does not exist) previously froze progress at 0
 * silently instead of surfacing (audit C12). Every query error now
 * propagates to the caller.
 */
async function countMetricForUser(
  supabase: SupabaseClient,
  userId: string,
  challenge: ChallengeRecord,
): Promise<BestChefResult<number>> {
  // Resolve profile once -- bc_submissions is keyed by profile_id.
  const { data: profile, error: profileErr } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileErr) return err(profileErr.message);
  const profileId = profile?.id as string | undefined;
  if (!profileId) return ok(0);

  // Restrict to submissions made after the challenge started so older
  // submissions cannot retroactively credit progress.
  const startedAt = challenge.startsAt;

  switch (challenge.metric) {
    case 'votes_received': {
      // upvote_count is the honest "votes received" tally: it is
      // incremented per positive vote (bc_submission_likes backfill),
      // unlike vote_score which is a weighted Wilson ranking score.
      const { data, error: votesErr } = await supabase
        .from('bc_submissions')
        .select('upvote_count')
        .eq('profile_id', profileId)
        .gte('created_at', startedAt);
      if (votesErr) return err(votesErr.message);
      const rows = (data ?? []) as Array<{ upvote_count: number | null }>;
      return ok(rows.reduce((sum, r) => sum + (r.upvote_count ?? 0), 0));
    }
    case 'cuisines_tried': {
      const { data, error: dishRowsErr } = await supabase
        .from('bc_submissions')
        .select('dish_id')
        .eq('profile_id', profileId)
        .gte('created_at', startedAt);
      if (dishRowsErr) return err(dishRowsErr.message);
      const dishIds = [...new Set(((data ?? []) as Array<{ dish_id: string }>).map((r) => r.dish_id))];
      if (dishIds.length === 0) return ok(0);
      const { data: dishes, error: dishesErr } = await supabase
        .from('bc_dishes')
        .select('cuisine')
        .in('id', dishIds);
      if (dishesErr) return err(dishesErr.message);
      return ok(new Set(((dishes ?? []) as Array<{ cuisine: string | null }>)
        .map((d) => d.cuisine)
        .filter((c): c is string => Boolean(c))).size);
    }
    case 'recipes_shared':
    case 'dishes_cooked':
    case 'submissions':
    default: {
      const { count, error: countErr } = await supabase
        .from('bc_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .gte('created_at', startedAt);
      if (countErr) return err(countErr.message);
      return ok(count ?? 0);
    }
  }
}

/**
 * List live challenges. Replaces DEMO_CHALLENGES on the Challenges screen.
 * Each item carries the caller's enrollment (or null) and current progress.
 */
export async function getChallenges(
  supabase: SupabaseClient,
  options: { status?: ChallengeListStatus; limit?: number } = {},
): Promise<BestChefResult<ChallengeListItem[]>> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const status: ChallengeListStatus = options.status ?? 'all';

  let query = supabase
    .from('bc_challenges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'active') {
    query = query.eq('status', 'active');
  } else if (status === 'completed') {
    query = query.eq('status', 'completed');
  }

  const { data, error: listErr } = await query;
  if (listErr) return err(listErr.message);

  const challenges = (data ?? []).map((row) => mapChallengeRow(row as Record<string, unknown>));
  if (challenges.length === 0) return ok([]);

  const userResult = await getCurrentUserId(supabase);
  if (!userResult.ok) return err(userResult.error);
  const userId = userResult.data;

  if (!userId) {
    return ok(challenges.map((c) => ({ challenge: c, enrollment: null, currentCount: 0 })));
  }

  const challengeIds = challenges.map((c) => c.id);
  const { data: enrollments, error: enrollErr } = await supabase
    .from('bc_challenge_enrollments')
    .select('*')
    .eq('user_id', userId)
    .in('challenge_id', challengeIds);
  if (enrollErr) return err(enrollErr.message);

  const enrollmentMap = new Map<string, ChallengeEnrollment>();
  for (const row of (enrollments ?? []) as Array<Record<string, unknown>>) {
    const mapped = mapEnrollmentRow(row);
    if (mapped) enrollmentMap.set(mapped.challengeId, mapped);
  }

  const items: ChallengeListItem[] = [];
  for (const challenge of challenges) {
    const enrollment = enrollmentMap.get(challenge.id) ?? null;
    let currentCount = 0;
    if (enrollment) {
      const countResult = await countMetricForUser(supabase, userId, challenge);
      if (!countResult.ok) return err(countResult.error);
      currentCount = countResult.data;
    }
    items.push({ challenge, enrollment, currentCount });
  }

  if (status === 'joined') {
    return ok(items.filter((i) => i.enrollment !== null && i.enrollment.completedAt === null));
  }
  if (status === 'completed') {
    return ok(items.filter((i) => i.enrollment?.completedAt != null));
  }

  return ok(items);
}

/** Detail view for a single challenge (used by the [id] route). */
export async function getChallengeDetail(
  supabase: SupabaseClient,
  { challengeId }: { challengeId: string },
): Promise<BestChefResult<ChallengeDetailView>> {
  const { data, error: getErr } = await supabase
    .from('bc_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  if (getErr) return err(getErr.message);
  if (!data) return err('Challenge not found');

  const challenge = mapChallengeRow(data as Record<string, unknown>);

  const userResult = await getCurrentUserId(supabase);
  if (!userResult.ok) return err(userResult.error);
  const userId = userResult.data;

  if (!userId) {
    return ok({ challenge, enrollment: null, currentCount: 0, isComplete: false });
  }

  const { data: enrollmentRow, error: enrollErr } = await supabase
    .from('bc_challenge_enrollments')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (enrollErr) return err(enrollErr.message);

  const enrollment = mapEnrollmentRow(enrollmentRow as Record<string, unknown> | null);
  let currentCount = 0;
  if (enrollment) {
    const countResult = await countMetricForUser(supabase, userId, challenge);
    if (!countResult.ok) return err(countResult.error);
    currentCount = countResult.data;
  }
  const isComplete = currentCount >= challenge.targetCount;

  // Auto-stamp completed_at when the threshold is hit.
  if (enrollment && isComplete && enrollment.completedAt == null) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('bc_challenge_enrollments')
      .update({ completed_at: nowIso })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);
    enrollment.completedAt = nowIso;
  }

  return ok({ challenge, enrollment, currentCount, isComplete });
}

/** Idempotent join. Returns the enrollment row. */
export async function joinChallenge(
  supabase: SupabaseClient,
  { challengeId }: { challengeId: string },
): Promise<BestChefResult<ChallengeEnrollment>> {
  const userResult = await getCurrentUserId(supabase);
  if (!userResult.ok) return err(userResult.error);
  if (!userResult.data) return err('Not authenticated');
  const userId = userResult.data;

  const { data, error: insertErr } = await supabase
    .from('bc_challenge_enrollments')
    .upsert(
      { challenge_id: challengeId, user_id: userId },
      { onConflict: 'challenge_id,user_id', ignoreDuplicates: false },
    )
    .select()
    .single();
  if (insertErr) return err(insertErr.message);

  const enrollment = mapEnrollmentRow(data as Record<string, unknown>);
  if (!enrollment) return err('Failed to join challenge');
  return ok(enrollment);
}

/** Leave a challenge. No-op if the user is not enrolled. */
export async function leaveChallenge(
  supabase: SupabaseClient,
  { challengeId }: { challengeId: string },
): Promise<BestChefResult<{ challengeId: string }>> {
  const userResult = await getCurrentUserId(supabase);
  if (!userResult.ok) return err(userResult.error);
  if (!userResult.data) return err('Not authenticated');

  const { error: deleteErr } = await supabase
    .from('bc_challenge_enrollments')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', userResult.data);
  if (deleteErr) return err(deleteErr.message);
  return ok({ challengeId });
}

/** Progress snapshot (count + target). */
export async function getMyChallengeProgress(
  supabase: SupabaseClient,
  { challengeId }: { challengeId: string },
): Promise<BestChefResult<{ currentCount: number; targetCount: number; isComplete: boolean }>> {
  const detail = await getChallengeDetail(supabase, { challengeId });
  if (!detail.ok) return err(detail.error);
  return ok({
    currentCount: detail.data.currentCount,
    targetCount: detail.data.challenge.targetCount,
    isComplete: detail.data.isComplete,
  });
}

/**
 * Idempotent reward claim. Calls the bc_claim_challenge_reward RPC which
 * stamps reward_claimed_at and inserts the badge into bc_chef_badges.
 * Subsequent calls return the existing claim timestamp without awarding
 * a duplicate badge.
 */
export async function claimReward(
  supabase: SupabaseClient,
  { challengeId }: { challengeId: string },
): Promise<BestChefResult<{ rewardClaimedAt: string; badgeId: string | null; newlyAwarded: boolean }>> {
  const { data, error: rpcErr } = await supabase.rpc('bc_claim_challenge_reward', {
    p_challenge_id: challengeId,
  });
  if (rpcErr) return err(rpcErr.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return err('Claim failed');
  return ok({
    rewardClaimedAt: row.reward_claimed_at as string,
    badgeId: (row.badge_id as string | null) ?? null,
    newlyAwarded: Boolean(row.newly_awarded),
  });
}
