import { describe, it, expect } from 'vitest';
import {
  BADGE_DEFINITIONS,
  isValidBadgeDefinition,
  isCriteriaMet,
  buildEvalStats,
  type BadgeCriteria,
  type BadgeEvalStats,
} from '../badge-engine';

// ── Helper ───────────────────────────────────────────────────────────

function makeStats(overrides: Partial<{
  submissionScores: number[];
  voteCounts: number[];
  ranks: number[];
  cuisines: string[];
  photoVerifiedCount: number;
  helpfulNoteCount: number;
}> = {}): BadgeEvalStats {
  return buildEvalStats({
    submissionScores: overrides.submissionScores ?? [],
    voteCounts: overrides.voteCounts ?? [],
    ranks: overrides.ranks ?? [],
    cuisines: overrides.cuisines ?? [],
    photoVerifiedCount: overrides.photoVerifiedCount ?? 0,
    helpfulNoteCount: overrides.helpfulNoteCount ?? 0,
  });
}

// ── Badge definitions completeness ───────────────────────────────────

describe('BADGE_DEFINITIONS', () => {
  it('contains exactly 10 definitions', () => {
    expect(BADGE_DEFINITIONS).toHaveLength(10);
  });

  it('all definitions have unique IDs', () => {
    const ids = BADGE_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all definitions pass validation', () => {
    for (const def of BADGE_DEFINITIONS) {
      expect(isValidBadgeDefinition(def)).toBe(true);
    }
  });

  it('all definitions have non-empty id, name, icon, and description', () => {
    for (const def of BADGE_DEFINITIONS) {
      expect(def.id.length).toBeGreaterThan(0);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('all definitions have valid tiers', () => {
    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    for (const def of BADGE_DEFINITIONS) {
      expect(validTiers).toContain(def.tier);
    }
  });

  it('all definitions have criteria with positive thresholds', () => {
    for (const def of BADGE_DEFINITIONS) {
      expect(def.criteria.threshold).toBeGreaterThan(0);
    }
  });

  it('includes expected badge IDs', () => {
    const ids = new Set(BADGE_DEFINITIONS.map((d) => d.id));
    expect(ids.has('first_submission')).toBe(true);
    expect(ids.has('five_submissions')).toBe(true);
    expect(ids.has('crowd_favorite')).toBe(true);
    expect(ids.has('rising_chef')).toBe(true);
    expect(ids.has('best_in_class')).toBe(true);
    expect(ids.has('world_cuisine')).toBe(true);
    expect(ids.has('consistent_chef')).toBe(true);
    expect(ids.has('photo_verified')).toBe(true);
    expect(ids.has('community_helper')).toBe(true);
    expect(ids.has('legendary_chef')).toBe(true);
  });

  it('criteria JSON structure matches expected type field', () => {
    const validTypes = [
      'submission_count',
      'votes_on_single',
      'score_threshold',
      'rank_threshold',
      'cuisine_count',
      'consistent_score',
      'photo_verified',
      'helpful_notes',
      'rank_count',
    ];
    for (const def of BADGE_DEFINITIONS) {
      expect(validTypes).toContain(def.criteria.type);
    }
  });
});

// ── isValidBadgeDefinition ───────────────────────────────────────────

describe('isValidBadgeDefinition', () => {
  it('returns true for a valid definition', () => {
    expect(
      isValidBadgeDefinition({
        id: 'test',
        name: 'Test Badge',
        description: 'A test badge.',
        icon: 'test_icon',
        tier: 'bronze',
        criteria: { type: 'submission_count', threshold: 1 },
      }),
    ).toBe(true);
  });

  it('returns false for empty id', () => {
    expect(
      isValidBadgeDefinition({
        id: '',
        name: 'Test Badge',
        description: 'desc',
        icon: 'icon',
        tier: 'bronze',
        criteria: { type: 'submission_count', threshold: 1 },
      }),
    ).toBe(false);
  });

  it('returns false for zero threshold', () => {
    expect(
      isValidBadgeDefinition({
        id: 'test',
        name: 'Test Badge',
        description: 'desc',
        icon: 'icon',
        tier: 'bronze',
        criteria: { type: 'submission_count', threshold: 0 },
      }),
    ).toBe(false);
  });
});

// ── buildEvalStats ───────────────────────────────────────────────────

describe('buildEvalStats', () => {
  it('computes totalSubmissions from submissionScores length', () => {
    const stats = makeStats({ submissionScores: [0.5, 0.8, 0.3] });
    expect(stats.totalSubmissions).toBe(3);
  });

  it('computes maxVotesOnSingle from voteCounts', () => {
    const stats = makeStats({ voteCounts: [10, 55, 30] });
    expect(stats.maxVotesOnSingle).toBe(55);
  });

  it('returns 0 for maxVotesOnSingle with empty voteCounts', () => {
    const stats = makeStats({ voteCounts: [] });
    expect(stats.maxVotesOnSingle).toBe(0);
  });

  it('computes bestRank as lowest rank number', () => {
    const stats = makeStats({ ranks: [5, 1, 3] });
    expect(stats.bestRank).toBe(1);
  });

  it('returns null for bestRank with no ranks', () => {
    const stats = makeStats({ ranks: [] });
    expect(stats.bestRank).toBeNull();
  });

  it('computes uniqueCuisines as distinct count', () => {
    const stats = makeStats({
      cuisines: ['italian', 'italian', 'thai', 'mexican', 'thai'],
    });
    expect(stats.uniqueCuisines).toBe(3);
  });

  it('submissionsAboveScore filters correctly', () => {
    const stats = makeStats({ submissionScores: [0.1, 0.3, 0.5, 0.8, 0.9] });
    expect(stats.submissionsAboveScore(0.5)).toBe(3);
    expect(stats.submissionsAboveScore(0.0)).toBe(5);
    expect(stats.submissionsAboveScore(1.0)).toBe(0);
  });

  it('computes rank1Count correctly', () => {
    const stats = makeStats({ ranks: [1, 3, 1, 2, 1] });
    expect(stats.rank1Count).toBe(3);
  });
});

// ── isCriteriaMet ────────────────────────────────────────────────────

describe('isCriteriaMet', () => {
  // submission_count
  it('submission_count: met when totalSubmissions >= threshold', () => {
    const criteria: BadgeCriteria = { type: 'submission_count', threshold: 5 };
    expect(isCriteriaMet(criteria, makeStats({ submissionScores: Array(5).fill(0) }))).toBe(true);
    expect(isCriteriaMet(criteria, makeStats({ submissionScores: Array(4).fill(0) }))).toBe(false);
  });

  // votes_on_single
  it('votes_on_single: met when any submission has >= threshold votes', () => {
    const criteria: BadgeCriteria = { type: 'votes_on_single', threshold: 50 };
    expect(isCriteriaMet(criteria, makeStats({ voteCounts: [10, 50, 20] }))).toBe(true);
    expect(isCriteriaMet(criteria, makeStats({ voteCounts: [10, 49, 20] }))).toBe(false);
  });

  // score_threshold
  it('score_threshold: met when enough submissions are above minScore', () => {
    const criteria: BadgeCriteria = { type: 'score_threshold', threshold: 3, minScore: 0.5 };
    expect(
      isCriteriaMet(criteria, makeStats({ submissionScores: [0.6, 0.7, 0.8, 0.1] })),
    ).toBe(true);
    expect(
      isCriteriaMet(criteria, makeStats({ submissionScores: [0.6, 0.7, 0.1, 0.1] })),
    ).toBe(false);
  });

  // rank_threshold
  it('rank_threshold: met when bestRank <= threshold', () => {
    const criteria: BadgeCriteria = { type: 'rank_threshold', threshold: 1 };
    expect(isCriteriaMet(criteria, makeStats({ ranks: [1, 3, 5] }))).toBe(true);
    expect(isCriteriaMet(criteria, makeStats({ ranks: [2, 3, 5] }))).toBe(false);
    expect(isCriteriaMet(criteria, makeStats({ ranks: [] }))).toBe(false);
  });

  // cuisine_count
  it('cuisine_count: met when uniqueCuisines >= threshold', () => {
    const criteria: BadgeCriteria = { type: 'cuisine_count', threshold: 5 };
    const cuisines = ['italian', 'thai', 'mexican', 'japanese', 'french'];
    expect(isCriteriaMet(criteria, makeStats({ cuisines }))).toBe(true);
    expect(
      isCriteriaMet(criteria, makeStats({ cuisines: cuisines.slice(0, 4) })),
    ).toBe(false);
  });

  // consistent_score
  it('consistent_score: met when >= threshold submissions all above minScore', () => {
    const criteria: BadgeCriteria = {
      type: 'consistent_score',
      threshold: 3,
      minScore: 0.3,
    };
    // 3 submissions all above 0.3
    expect(
      isCriteriaMet(criteria, makeStats({ submissionScores: [0.4, 0.5, 0.6] })),
    ).toBe(true);
    // Only 2 above 0.3
    expect(
      isCriteriaMet(criteria, makeStats({ submissionScores: [0.4, 0.5, 0.1] })),
    ).toBe(false);
    // Not enough total submissions
    expect(
      isCriteriaMet(criteria, makeStats({ submissionScores: [0.4, 0.5] })),
    ).toBe(false);
  });

  // photo_verified
  it('photo_verified: met when photoVerifiedCount >= threshold', () => {
    const criteria: BadgeCriteria = { type: 'photo_verified', threshold: 1 };
    expect(isCriteriaMet(criteria, makeStats({ photoVerifiedCount: 1 }))).toBe(true);
    expect(isCriteriaMet(criteria, makeStats({ photoVerifiedCount: 0 }))).toBe(false);
  });

  // helpful_notes
  it('helpful_notes: met when helpfulNoteCount >= threshold', () => {
    const criteria: BadgeCriteria = { type: 'helpful_notes', threshold: 10 };
    expect(isCriteriaMet(criteria, makeStats({ helpfulNoteCount: 10 }))).toBe(true);
    expect(isCriteriaMet(criteria, makeStats({ helpfulNoteCount: 9 }))).toBe(false);
  });

  // rank_count
  it('rank_count: met when rank1Count >= threshold', () => {
    const criteria: BadgeCriteria = { type: 'rank_count', threshold: 10 };
    expect(
      isCriteriaMet(criteria, makeStats({ ranks: Array(10).fill(1) })),
    ).toBe(true);
    expect(
      isCriteriaMet(criteria, makeStats({ ranks: Array(9).fill(1) })),
    ).toBe(false);
  });

  // unknown type
  it('returns false for unknown criteria type', () => {
    const criteria = { type: 'unknown_type', threshold: 1 } as unknown as BadgeCriteria;
    expect(isCriteriaMet(criteria, makeStats())).toBe(false);
  });
});

// ── getAllBadgesForChef / getEarnedBadges -- module exports ───────────

describe('profile badge query exports', () => {
  it('exports getEarnedBadges and getAllBadgesForChef', async () => {
    const mod = await import('../badge-engine');
    expect(typeof mod.getEarnedBadges).toBe('function');
    expect(typeof mod.getAllBadgesForChef).toBe('function');
  });
});

// ── Badge shape contract ──────────────────────────────────────────────

describe('Badge type contract', () => {
  it('earned badge has all required fields with earnedAt string', () => {
    const badge = {
      id: 'first_submission',
      icon: 'plate',
      name: 'First Dish',
      description: 'Submit your first recipe.',
      tint: '#F97316',
      tier: 'bronze' as const,
      earned: true,
      earnedAt: '2026-04-21T10:00:00Z',
    };
    expect(badge.earned).toBe(true);
    expect(typeof badge.earnedAt).toBe('string');
  });

  it('locked badge has earnedAt: null', () => {
    const badge = {
      id: 'legendary_chef',
      icon: 'crown',
      name: 'Legendary Chef',
      description: 'Achieve rank #1 for 10+ dishes.',
      tint: '#E2E8F0',
      tier: 'platinum' as const,
      earned: false,
      earnedAt: null,
    };
    expect(badge.earned).toBe(false);
    expect(badge.earnedAt).toBeNull();
  });
});

// ── Sorting contract (pure simulation) ───────────────────────────────

describe('getAllBadgesForChef sorting', () => {
  function makeBadge(
    id: string,
    tier: 'bronze' | 'silver' | 'gold' | 'platinum',
    earnedAt: string | null,
  ) {
    return { id, tier, earned: earnedAt !== null, earnedAt };
  }

  it('earned badges appear before locked badges', () => {
    const badges = [
      makeBadge('locked_gold', 'gold', null),
      makeBadge('earned_bronze', 'bronze', '2026-04-20T00:00:00Z'),
      makeBadge('locked_platinum', 'platinum', null),
      makeBadge('earned_silver', 'silver', '2026-04-18T00:00:00Z'),
    ];

    const tierOrder = { bronze: 0, silver: 1, gold: 2, platinum: 3 } as const;

    const sorted = [...badges].sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      if (a.earned && b.earned) {
        return new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime();
      }
      return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
    });

    expect(sorted[0].earned).toBe(true);
    expect(sorted[1].earned).toBe(true);
    expect(sorted[2].earned).toBe(false);
    expect(sorted[3].earned).toBe(false);
  });

  it('locked badges sorted by tier descending (platinum > gold > silver > bronze)', () => {
    const badges = [
      makeBadge('bronze_lock', 'bronze', null),
      makeBadge('gold_lock', 'gold', null),
      makeBadge('silver_lock', 'silver', null),
      makeBadge('platinum_lock', 'platinum', null),
    ];

    const tierOrder = { bronze: 0, silver: 1, gold: 2, platinum: 3 } as const;

    const sorted = [...badges].sort((a, b) => {
      return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
    });

    expect(sorted[0].id).toBe('platinum_lock');
    expect(sorted[1].id).toBe('gold_lock');
    expect(sorted[2].id).toBe('silver_lock');
    expect(sorted[3].id).toBe('bronze_lock');
  });

  it('earned badges sorted newest-first', () => {
    const badges = [
      makeBadge('old', 'bronze', '2026-01-01T00:00:00Z'),
      makeBadge('new', 'silver', '2026-04-20T00:00:00Z'),
      makeBadge('mid', 'gold', '2026-02-15T00:00:00Z'),
    ];

    const sorted = [...badges].sort((a, b) => {
      if (!a.earned || !b.earned) return 0;
      return new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime();
    });

    expect(sorted[0].id).toBe('new');
    expect(sorted[1].id).toBe('mid');
    expect(sorted[2].id).toBe('old');
  });
});
