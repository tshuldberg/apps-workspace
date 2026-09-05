import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateWeightedWilsonScore, castTapVote } from '../voting-engine';
import type { Vote, VoteTier } from '../types';
import { VoteTier as VT } from '../types';

// ── Test helpers ──────────────────────────────────────────────────────

function makeVote(tier: VoteTier, i = 0): Vote {
  return {
    id: `vote-${i}`,
    submissionId: 'sub-1',
    voterProfileId: `voter-${i}`,
    tier,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeVotes(tiers: VoteTier[]): Vote[] {
  return tiers.map((t, i) => makeVote(t, i));
}

// ── calculateWeightedWilsonScore ──────────────────────────────────────

describe('calculateWeightedWilsonScore', () => {
  it('returns 0 for empty votes', () => {
    expect(calculateWeightedWilsonScore([])).toBe(0);
  });

  it('returns 0 for a single "Not for me" vote', () => {
    const score = calculateWeightedWilsonScore(makeVotes([VT.NOT_FOR_ME]));
    expect(score).toBe(0);
  });

  it('returns 0 for all "Not for me" votes', () => {
    const score = calculateWeightedWilsonScore(
      makeVotes([VT.NOT_FOR_ME, VT.NOT_FOR_ME, VT.NOT_FOR_ME]),
    );
    expect(score).toBe(0);
  });

  it('returns a positive score for a single "Best Chef" vote', () => {
    const score = calculateWeightedWilsonScore(makeVotes([VT.BEST_CHEF]));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns a positive score for a single "I\'d eat that" vote', () => {
    const score = calculateWeightedWilsonScore(makeVotes([VT.ID_EAT_THAT]));
    expect(score).toBeGreaterThan(0);
  });

  it('returns a positive score for a single "As good as momma\'s" vote', () => {
    const score = calculateWeightedWilsonScore(
      makeVotes([VT.AS_GOOD_AS_MOMMAS]),
    );
    expect(score).toBeGreaterThan(0);
  });

  it('all "Best Chef" scores higher than all "I\'d eat that"', () => {
    const bestChef = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.BEST_CHEF, VT.BEST_CHEF]),
    );
    const idEatThat = calculateWeightedWilsonScore(
      makeVotes([VT.ID_EAT_THAT, VT.ID_EAT_THAT, VT.ID_EAT_THAT]),
    );
    expect(bestChef).toBeGreaterThan(idEatThat);
  });

  it('all "Best Chef" scores higher than all "As good as momma\'s"', () => {
    const bestChef = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.BEST_CHEF, VT.BEST_CHEF]),
    );
    const mommas = calculateWeightedWilsonScore(
      makeVotes([VT.AS_GOOD_AS_MOMMAS, VT.AS_GOOD_AS_MOMMAS, VT.AS_GOOD_AS_MOMMAS]),
    );
    expect(bestChef).toBeGreaterThan(mommas);
  });

  it('"As good as momma\'s" scores higher than "I\'d eat that"', () => {
    const mommas = calculateWeightedWilsonScore(
      makeVotes([VT.AS_GOOD_AS_MOMMAS, VT.AS_GOOD_AS_MOMMAS, VT.AS_GOOD_AS_MOMMAS]),
    );
    const idEatThat = calculateWeightedWilsonScore(
      makeVotes([VT.ID_EAT_THAT, VT.ID_EAT_THAT, VT.ID_EAT_THAT]),
    );
    expect(mommas).toBeGreaterThan(idEatThat);
  });

  it('"Not for me" votes reduce the score', () => {
    const pure = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.BEST_CHEF]),
    );
    const withNeg = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.BEST_CHEF, VT.NOT_FOR_ME]),
    );
    expect(withNeg).toBeLessThan(pure);
  });

  it('more votes of the same tier produce a higher score (confidence grows)', () => {
    const few = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF]),
    );
    const many = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.BEST_CHEF, VT.BEST_CHEF, VT.BEST_CHEF, VT.BEST_CHEF]),
    );
    expect(many).toBeGreaterThan(few);
  });

  it('score is always in [0, 1]', () => {
    const cases: VoteTier[][] = [
      [VT.BEST_CHEF],
      [VT.NOT_FOR_ME],
      [VT.ID_EAT_THAT, VT.AS_GOOD_AS_MOMMAS, VT.BEST_CHEF, VT.NOT_FOR_ME],
      Array(100).fill(VT.BEST_CHEF),
      Array(100).fill(VT.NOT_FOR_ME),
    ];

    for (const tiers of cases) {
      const score = calculateWeightedWilsonScore(makeVotes(tiers));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('mixed votes produce intermediate scores', () => {
    const mixed = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.ID_EAT_THAT, VT.NOT_FOR_ME]),
    );
    const allBest = calculateWeightedWilsonScore(
      makeVotes([VT.BEST_CHEF, VT.BEST_CHEF, VT.BEST_CHEF]),
    );
    expect(mixed).toBeGreaterThan(0);
    expect(mixed).toBeLessThan(allBest);
  });

  it('tier ordering is strictly monotonic for uniform vote sets', () => {
    const count = 10;
    const scores = [VT.NOT_FOR_ME, VT.ID_EAT_THAT, VT.AS_GOOD_AS_MOMMAS, VT.BEST_CHEF].map(
      (tier) => calculateWeightedWilsonScore(makeVotes(Array(count).fill(tier))),
    );

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });
});

// ── castTapVote ───────────────────────────────────────────────────────

function makeSupabaseMock(opts: {
  submissionAuthorId?: string;
  existingVote?: Vote | null;
  insertError?: string;
  deleteError?: string;
}) {
  const { submissionAuthorId = 'author-1', existingVote = null, insertError, deleteError } = opts;

  const votes: Vote[] = existingVote ? [existingVote] : [];

  const insertMock = vi.fn().mockResolvedValue({ error: insertError ? { message: insertError } : null });
  const deleteMock = vi.fn().mockResolvedValue({ error: deleteError ? { message: deleteError } : null });

  // Track inserts/deletes to simulate db state in multi-op tests
  let localVotes = [...votes];

  const fromMock = vi.fn((table: string) => {
    if (table === 'bc_submissions') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { profile_id: submissionAuthorId }, error: null }),
          }),
        }),
      };
    }
    if (table === 'bc_votes') {
      return {
        select: () => ({
          eq: (_col1: string, _val1: string) => ({
            eq: (_col2: string, _val2: string) => ({
              maybeSingle: () => Promise.resolve({ data: localVotes[0] ?? null, error: null }),
            }),
          }),
        }),
        insert: (_row: Record<string, unknown>) => {
          localVotes = [{ id: 'new-vote', submissionId: _row.submission_id as string, voterProfileId: _row.voter_profile_id as string, tier: _row.tier as VoteTier, createdAt: new Date(), updatedAt: new Date() }];
          return insertMock();
        },
        delete: () => ({
          eq: () => {
            localVotes = [];
            return deleteMock();
          },
        }),
      };
    }
    return {};
  });

  return { from: fromMock, rpc: vi.fn(), insertMock, deleteMock };
}

describe('castTapVote', () => {
  const SUB = 'sub-abc';
  const VOTER = 'voter-xyz';

  it('inserts a tap_up vote when no prior vote exists', async () => {
    const client = makeSupabaseMock({ submissionAuthorId: 'author-1' });
    const result = await castTapVote({
      submissionId: SUB,
      direction: 'up',
      voterProfileId: VOTER,
      supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    });
    expect(result.ok).toBe(true);
    expect(result.supersedes).toBeNull();
    expect(client.insertMock).toHaveBeenCalledOnce();
  });

  it('inserts a tap_down vote when no prior vote exists', async () => {
    const client = makeSupabaseMock({ submissionAuthorId: 'author-1' });
    const result = await castTapVote({
      submissionId: SUB,
      direction: 'down',
      voterProfileId: VOTER,
      supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    });
    expect(result.ok).toBe(true);
    expect(result.supersedes).toBeNull();
  });

  it('rejects self-vote', async () => {
    const client = makeSupabaseMock({ submissionAuthorId: VOTER });
    const result = await castTapVote({
      submissionId: SUB,
      direction: 'up',
      voterProfileId: VOTER,
      supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/own submission/i);
  });

  it('is a no-op when a CookProof vote already exists', async () => {
    const existing = makeVote('gold', 0);
    existing.submissionId = SUB;
    existing.voterProfileId = VOTER;
    const client = makeSupabaseMock({ submissionAuthorId: 'author-1', existingVote: existing });
    const result = await castTapVote({
      submissionId: SUB,
      direction: 'up',
      voterProfileId: VOTER,
      supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    });
    expect(result.ok).toBe(true);
    expect(result.supersedes).toBeNull();
    expect(client.insertMock).not.toHaveBeenCalled();
    expect(client.deleteMock).not.toHaveBeenCalled();
  });

  it('toggles tap_up off when tapping the same direction again', async () => {
    const existing = makeVote('tap_up', 0);
    existing.submissionId = SUB;
    existing.voterProfileId = VOTER;
    const client = makeSupabaseMock({ submissionAuthorId: 'author-1', existingVote: existing });
    const result = await castTapVote({
      submissionId: SUB,
      direction: 'up',
      voterProfileId: VOTER,
      supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    });
    expect(result.ok).toBe(true);
    expect(result.supersedes).toBe('tap_up');
    expect(client.deleteMock).toHaveBeenCalledOnce();
    expect(client.insertMock).not.toHaveBeenCalled();
  });

  it('replaces tap_up with tap_down (opposite direction)', async () => {
    const existing = makeVote('tap_up', 0);
    existing.submissionId = SUB;
    existing.voterProfileId = VOTER;
    const client = makeSupabaseMock({ submissionAuthorId: 'author-1', existingVote: existing });
    const result = await castTapVote({
      submissionId: SUB,
      direction: 'down',
      voterProfileId: VOTER,
      supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    });
    expect(result.ok).toBe(true);
    expect(result.supersedes).toBe('tap_up');
    expect(client.deleteMock).toHaveBeenCalledOnce();
    expect(client.insertMock).toHaveBeenCalledOnce();
  });
});
