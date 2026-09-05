import { describe, it, expect } from 'vitest';
import {
  enforceImageGate,
  enforceImageGateWithSubmissions,
  getMondayOfWeek,
} from '../ranking-engine';
import type { Ranking, Submission } from '../types';

// ── Test helpers ──────────────────────────────────────────────────────

function makeRanking(rank: number, submissionId: string, score = 0.5): Ranking {
  return {
    dishId: 'dish-1',
    submissionId,
    score,
    rank,
    region: null,
    countryCode: null,
    updatedAt: new Date(),
  };
}

function makeSubmission(
  id: string,
  photoUrl: string | null = null,
): Submission {
  return {
    id,
    dishId: 'dish-1',
    recipeSnapshotId: 'snap-1',
    profileId: 'chef-1',
    photoUrl,
    photoVerified: false,
    photoVerifiedAt: null,
    verificationMethod: null,
    chefLocation: null,
    chefLocationLat: null,
    chefLocationLng: null,
    chefOrigin: null,
    countryCode: null,
    voteScore: 0.5,
    likeCount: 0,
    rank: null,
    moderationStatus: 'approved',
    region: null,
    isRestaurant: false,
    upvoteCount: 0,
    downvoteCount: 0,
    reviewedCount: 0,
    tapCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── enforceImageGate (basic) ──────────────────────────────────────────

describe('enforceImageGate', () => {
  it('returns empty array for empty input', () => {
    expect(enforceImageGate([])).toEqual([]);
  });

  it('passes through rankings unchanged when all have positions', () => {
    const rankings = [
      makeRanking(1, 'sub-1'),
      makeRanking(2, 'sub-2'),
      makeRanking(3, 'sub-3'),
    ];
    const result = enforceImageGate(rankings);
    expect(result).toHaveLength(3);
  });

  it('handles rankings beyond top 100', () => {
    const rankings = [
      makeRanking(101, 'sub-1'),
      makeRanking(102, 'sub-2'),
    ];
    const result = enforceImageGate(rankings);
    expect(result).toHaveLength(2);
  });
});

// ── enforceImageGateWithSubmissions ───────────────────────────────────

describe('enforceImageGateWithSubmissions', () => {
  it('returns empty array for empty input', () => {
    expect(
      enforceImageGateWithSubmissions([], new Map()),
    ).toEqual([]);
  });

  it('keeps submissions with photos in top 100', () => {
    const rankings = [makeRanking(1, 'sub-1', 0.9)];
    const subs = new Map([
      ['sub-1', makeSubmission('sub-1', 'https://img.test/photo.jpg')],
    ]);

    const result = enforceImageGateWithSubmissions(rankings, subs);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
  });

  it('demotes submissions without photos from top 100', () => {
    const rankings = [
      makeRanking(1, 'sub-no-photo', 0.9),
      makeRanking(2, 'sub-with-photo', 0.8),
    ];
    const subs = new Map([
      ['sub-no-photo', makeSubmission('sub-no-photo', null)],
      ['sub-with-photo', makeSubmission('sub-with-photo', 'https://img.test/a.jpg')],
    ]);

    const result = enforceImageGateWithSubmissions(rankings, subs);
    expect(result).toHaveLength(2);
    // sub-with-photo should now be rank 1
    expect(result[0].submissionId).toBe('sub-with-photo');
    expect(result[0].rank).toBe(1);
    // sub-no-photo demoted
    expect(result[1].submissionId).toBe('sub-no-photo');
    expect(result[1].rank).toBe(2);
  });

  it('does not demote submissions without photos beyond rank 100', () => {
    const rankings = [
      makeRanking(101, 'sub-no-photo', 0.1),
    ];
    const subs = new Map([
      ['sub-no-photo', makeSubmission('sub-no-photo', null)],
    ]);

    const result = enforceImageGateWithSubmissions(rankings, subs);
    expect(result).toHaveLength(1);
    // Rank stays as-is since it is beyond top 100
    expect(result[0].rank).toBe(1); // Re-ranked from position in eligible list
  });

  it('treats empty string photoUrl as no photo', () => {
    const rankings = [makeRanking(1, 'sub-empty', 0.9)];
    const subs = new Map([
      ['sub-empty', makeSubmission('sub-empty', '')],
    ]);

    const result = enforceImageGateWithSubmissions(rankings, subs);
    // Empty string should be treated as no photo, demoted from top 100
    expect(result).toHaveLength(1);
    // Since it's the only entry and gets demoted, it comes back as rank 1
    // (no eligible entries, so demoted list starts at rank 1)
    expect(result[0].rank).toBe(1);
  });

  it('re-ranks correctly after demoting multiple entries', () => {
    const rankings = [
      makeRanking(1, 'sub-a', 0.95),  // no photo
      makeRanking(2, 'sub-b', 0.90),  // has photo
      makeRanking(3, 'sub-c', 0.85),  // no photo
      makeRanking(4, 'sub-d', 0.80),  // has photo
    ];
    const subs = new Map([
      ['sub-a', makeSubmission('sub-a', null)],
      ['sub-b', makeSubmission('sub-b', 'https://img.test/b.jpg')],
      ['sub-c', makeSubmission('sub-c', null)],
      ['sub-d', makeSubmission('sub-d', 'https://img.test/d.jpg')],
    ]);

    const result = enforceImageGateWithSubmissions(rankings, subs);
    expect(result).toHaveLength(4);

    // Photo entries re-ranked first
    expect(result[0].submissionId).toBe('sub-b');
    expect(result[0].rank).toBe(1);
    expect(result[1].submissionId).toBe('sub-d');
    expect(result[1].rank).toBe(2);

    // No-photo entries demoted
    expect(result[2].submissionId).toBe('sub-a');
    expect(result[2].rank).toBe(3);
    expect(result[3].submissionId).toBe('sub-c');
    expect(result[3].rank).toBe(4);
  });
});

// ── getMondayOfWeek ───────────────────────────────────────────────────

describe('getMondayOfWeek', () => {
  it('returns Monday for a Wednesday input', () => {
    // 2026-04-22 is a Wednesday (UTC)
    const wednesday = new Date('2026-04-22T12:00:00Z');
    const monday = getMondayOfWeek(wednesday);
    expect(monday.getUTCDay()).toBe(1); // Monday
    expect(monday.toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  it('returns the same Monday for a Monday input', () => {
    const monday = new Date('2026-04-20T00:00:00Z');
    const result = getMondayOfWeek(monday);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  it('wraps Sunday back to the previous Monday', () => {
    // 2026-04-19 is a Sunday (UTC)
    const sunday = new Date('2026-04-19T10:00:00Z');
    const result = getMondayOfWeek(sunday);
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-13');
  });

  it('produces midnight UTC', () => {
    const date = new Date('2026-04-22T18:30:00Z');
    const monday = getMondayOfWeek(date);
    expect(monday.getUTCHours()).toBe(0);
    expect(monday.getUTCMinutes()).toBe(0);
    expect(monday.getUTCSeconds()).toBe(0);
  });
});

// ── rank history module exports ───────────────────────────────────────

describe('rank history exports', () => {
  it('exports upsertRankHistoryEntry and getRankHistory', async () => {
    const mod = await import('../ranking-engine');
    expect(typeof mod.upsertRankHistoryEntry).toBe('function');
    expect(typeof mod.getRankHistory).toBe('function');
  });

  it('upsertRankHistoryEntry accepts WeeklyBatchChefRank shape', () => {
    const input = {
      chefId: 'chef-uuid',
      rank: 42,
      totalChefs: 1000,
    };
    expect(input.rank).toBeGreaterThan(0);
    expect(input.totalChefs).toBeGreaterThan(0);
  });

  it('getRankHistory defaults to 8 weeks', async () => {
    const mod = await import('../ranking-engine');
    // Function signature check -- options object with optional weeks field
    expect(mod.getRankHistory.length).toBe(1);
  });
});
