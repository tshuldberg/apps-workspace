/**
 * Voting engine -- weighted Wilson score ranking.
 *
 * Tiers (text values after P1-B migration):
 *   'like'     = "Not for me"           (weight  0)
 *   'bronze'   = "I'd eat that"         (weight  1)
 *   'silver'   = "As good as momma's"   (weight  3)
 *   'gold'     = "Best Chef"            (weight  5)
 *   'tap_up'   = right swipe (no proof) (weight  1)
 *   'tap_down' = left swipe  (no proof) (weight -1)
 *
 * Uses the Wilson score interval lower bound (95% confidence) to rank
 * submissions fairly regardless of sample size.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Vote, VoteTier } from './types';
import { VOTE_TIER_WEIGHTS } from './types';

/** Fire-and-forget notification fanout after a successful vote. Never throws. */
async function fireVoteNotification(
  submissionId: string,
  actorId: string,
  tier: VoteTier,
): Promise<void> {
  try {
    const client = getBestChefClient();
    if (tier === 'gold' || tier === 'silver' || tier === 'bronze') {
      await client.rpc('bc_notify_reviewed_vote', {
        submission_id: submissionId,
        actor_id: actorId,
        tier,
      });
    } else {
      await client.rpc('bc_notify_upvote', {
        submission_id: submissionId,
        actor_id: actorId,
        tier,
      });
    }
  } catch {
    // fanout is additive; never block the primary path
  }
}

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mapper ────────────────────────────────────────────────────────

function mapVote(row: Record<string, unknown>): Vote {
  return {
    id: row.id as string,
    submissionId: row.submission_id as string,
    voterProfileId: row.voter_profile_id as string,
    tier: row.tier as VoteTier,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ── Wilson score ──────────────────────────────────────────────────────

const Z = 1.96; // 95% confidence
const MAX_WEIGHT = 5; // weight of "Best Chef" tier

/**
 * Pure function: weighted Wilson score interval lower bound.
 *
 * Maps each vote tier to its weight, computes a weighted proportion,
 * then applies the Wilson confidence interval to get a conservative
 * lower-bound score. Returns 0 for empty input.
 */
export function calculateWeightedWilsonScore(votes: Vote[]): number {
  const n = votes.length;
  if (n === 0) return 0;

  const weightedPositiveSum = votes.reduce(
    (sum, v) => sum + (VOTE_TIER_WEIGHTS[v.tier as VoteTier] ?? 0),
    0,
  );

  const totalWeightCapacity = n * MAX_WEIGHT;
  const pHat = weightedPositiveSum / totalWeightCapacity;

  const zSquared = Z * Z;
  const denominator = 1 + zSquared / n;
  const center = pHat + zSquared / (2 * n);
  const spread = Z * Math.sqrt((pHat * (1 - pHat) + zSquared / (4 * n)) / n);

  const lowerBound = (center - spread) / denominator;

  // Clamp to [0, 1] to avoid floating-point edge cases
  return Math.max(0, Math.min(1, lowerBound));
}

// ── Cast vote ─────────────────────────────────────────────────────────

/**
 * Insert or update a vote (upsert on submissionId + voterProfileId).
 * Recalculates the submission's vote_score after each vote.
 */
export async function castVote(
  submissionId: string,
  voterProfileId: string,
  tier: VoteTier,
): Promise<BestChefResult<Vote>> {
  const { data, error: dbErr } = await getBestChefClient().rpc('bc_submit_vote', {
    p_submission_id: submissionId,
    p_voter_profile_id: voterProfileId,
    p_tier: tier,
  });

  if (dbErr) return err(dbErr.message);

  // Fanout notification -- fire-and-forget
  void fireVoteNotification(submissionId, voterProfileId, tier);

  return ok(mapVote(data));
}

// ── Tap vote ──────────────────────────────────────────────────────────

export interface CastTapVoteInput {
  submissionId: string;
  direction: 'up' | 'down';
  /** Voter's profile id. Must be fetched from the auth session by the caller. */
  voterProfileId: string;
  /** Pass the Supabase client from the caller's session for RLS. */
  supabase?: SupabaseClient;
}

export interface CastTapVoteResult {
  ok: boolean;
  message: string;
  /** Tier of a previous tap vote that was toggled off, if any. */
  supersedes?: 'tap_up' | 'tap_down' | null;
}

/**
 * Cast a lightweight tap vote (right = tap_up, left = tap_down).
 *
 * Rules:
 * - Self-vote is rejected.
 * - If a CookProof vote (gold/silver/bronze/like) already exists, the tap is
 *   ignored -- CookProof always takes precedence.
 * - Tapping the same direction again toggles the vote off (delete).
 * - Tapping the opposite direction replaces the existing tap.
 */
export async function castTapVote(input: CastTapVoteInput): Promise<CastTapVoteResult> {
  const client = (input.supabase ?? getBestChefClient()) as ReturnType<typeof getBestChefClient>;
  const tier: VoteTier = input.direction === 'up' ? 'tap_up' : 'tap_down';

  // Reject self-vote: fetch the submission author.
  const { data: submission, error: subErr } = await client
    .from('bc_submissions')
    .select('profile_id')
    .eq('id', input.submissionId)
    .maybeSingle();

  if (subErr) return { ok: false, message: subErr.message };
  if (!submission) return { ok: false, message: 'Submission not found.' };
  if (submission.profile_id === input.voterProfileId) {
    return { ok: false, message: 'You cannot vote on your own submission.' };
  }

  // Check for an existing vote using the injected client (avoids global singleton in tests).
  const { data: prevRow, error: prevErr } = await client
    .from('bc_votes')
    .select('*')
    .eq('submission_id', input.submissionId)
    .eq('voter_profile_id', input.voterProfileId)
    .maybeSingle();
  if (prevErr) return { ok: false, message: prevErr.message };

  const prev: Vote | null = prevRow ? mapVote(prevRow as Record<string, unknown>) : null;

  if (prev) {
    const isCookProof = prev.tier === 'gold' || prev.tier === 'silver' || prev.tier === 'bronze' || prev.tier === 'like';
    if (isCookProof) {
      // CookProof wins -- tap is silently ignored.
      return { ok: true, message: 'CookProof vote is already in place.', supersedes: null };
    }

    const prevTapTier = prev.tier as 'tap_up' | 'tap_down';

    if (prev.tier === tier) {
      // Same direction -- toggle off.
      const { error: delErr } = await client
        .from('bc_votes')
        .delete()
        .eq('id', prev.id);
      if (delErr) return { ok: false, message: delErr.message };
      return { ok: true, message: 'Tap vote removed.', supersedes: prevTapTier };
    }

    // Opposite direction -- replace.
    const { error: delErr } = await client
      .from('bc_votes')
      .delete()
      .eq('id', prev.id);
    if (delErr) return { ok: false, message: delErr.message };

    const { error: insErr } = await client
      .from('bc_votes')
      .insert({ submission_id: input.submissionId, voter_profile_id: input.voterProfileId, tier });
    if (insErr) return { ok: false, message: insErr.message };

    return { ok: true, message: 'Tap vote updated.', supersedes: prevTapTier };
  }

  // No existing vote -- insert.
  const { error: insErr } = await client
    .from('bc_votes')
    .insert({ submission_id: input.submissionId, voter_profile_id: input.voterProfileId, tier });
  if (insErr) return { ok: false, message: insErr.message };

  // Fanout notification for tap_up only (tap_down is not surfaced)
  if (tier === 'tap_up') {
    void fireVoteNotification(input.submissionId, input.voterProfileId, tier);
  }

  return { ok: true, message: 'Tap vote recorded.', supersedes: null };
}

// ── Read votes ────────────────────────────────────────────────────────

export async function getMyVote(
  submissionId: string,
  voterProfileId: string,
): Promise<BestChefResult<Vote | null>> {
  const { data, error: dbErr } = await from('bc_votes')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('voter_profile_id', voterProfileId)
    .maybeSingle();

  if (dbErr) return err(dbErr.message);
  return ok(data ? mapVote(data) : null);
}

export async function getVotesForSubmission(
  submissionId: string,
): Promise<BestChefResult<Vote[]>> {
  const { data, error: dbErr } = await from('bc_votes')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapVote));
}

export interface VoteDistribution {
  like: number;
  bronze: number;
  silver: number;
  gold: number;
  tap_up: number;
  tap_down: number;
  total: number;
}

export async function getVoteDistribution(
  submissionId: string,
): Promise<BestChefResult<VoteDistribution>> {
  const { data, error: dbErr } = await from('bc_votes')
    .select('tier')
    .eq('submission_id', submissionId);

  if (dbErr) return err(dbErr.message);

  const dist: VoteDistribution = { like: 0, bronze: 0, silver: 0, gold: 0, tap_up: 0, tap_down: 0, total: 0 };
  for (const row of data ?? []) {
    const t = row.tier as VoteTier;
    if (t === 'like') dist.like++;
    else if (t === 'bronze') dist.bronze++;
    else if (t === 'silver') dist.silver++;
    else if (t === 'gold') dist.gold++;
    else if (t === 'tap_up') dist.tap_up++;
    else if (t === 'tap_down') dist.tap_down++;
    dist.total++;
  }

  return ok(dist);
}

// ── Score recalculation ───────────────────────────────────────────────

/**
 * Fetch all votes for a submission, recalculate the weighted Wilson
 * score, and update bc_submissions.vote_score.
 */
export async function recalculateSubmissionScore(
  submissionId: string,
): Promise<BestChefResult<number>> {
  const votesResult = await getVotesForSubmission(submissionId);
  if (!votesResult.ok) return err(votesResult.error);

  const score = calculateWeightedWilsonScore(votesResult.data);

  const { error: updateErr } = await from('bc_submissions')
    .update({ vote_score: score, updated_at: new Date().toISOString() })
    .eq('id', submissionId);

  if (updateErr) return err(updateErr.message);
  return ok(score);
}
