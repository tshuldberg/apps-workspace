import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { Badge } from '../../db/badges';
import type { BadgeStats } from '../types';
import { getBadgeProgress, evaluateBadges, computeStreak, gatherBadgeStats } from '../badge-engine';

// ── Mock Database ──

function createMockDb(queryResults: Record<string, any[]> = {}) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  return {
    db: {
      query: <T>(sql: string, params?: unknown[]): T[] => {
        for (const [pattern, result] of Object.entries(queryResults)) {
          if (sql.includes(pattern)) return result as T[];
        }
        return [] as T[];
      },
      execute: (sql: string, params?: unknown[]) => {
        executed.push({ sql, params: params ?? [] });
      },
      transaction: (fn: () => void) => fn(),
    } as DatabaseAdapter,
    executed,
  };
}

// ── Badge factory ──

function makeBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: 'volume_10',
    category: 'volume',
    name: 'First Steps',
    description: 'Finish 10 books',
    tier: 'bronze',
    threshold: 10,
    icon: '📖',
    earned_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStats(overrides: Partial<BadgeStats> = {}): BadgeStats {
  return {
    totalBooks: 0,
    totalPages: 0,
    genreCount: 0,
    authorCount: 0,
    currentStreak: 0,
    completedChallenges: 0,
    reviewCount: 0,
    journalCount: 0,
    fastestBookDays: null,
    ...overrides,
  };
}

// ── Tests ──

describe('badge evaluation', () => {
  it('awards badge when threshold is met', () => {
    const badge = makeBadge({ id: 'volume_10', threshold: 10, category: 'volume' });
    const unearnedBadges = [badge];

    const { db, executed } = createMockDb({
      'earned_at IS NULL': unearnedBadges,
      // gatherBadgeStats queries:
      'COUNT(DISTINCT book_id)': [{ count: 10 }],
      'SUM(b.page_count)': [{ total: 3000 }],
      'COUNT(DISTINCT value)': [{ count: 2 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      // getAllBadges for progress:
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);

    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('volume_10');
    expect(executed.some(e => e.sql.includes('UPDATE bk_badges SET earned_at'))).toBe(true);
  });

  it('does not award badge below threshold', () => {
    const badge = makeBadge({ id: 'volume_10', threshold: 10, category: 'volume' });

    const { db, executed } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 9 }],
      'SUM(b.page_count)': [{ total: 2700 }],
      'COUNT(DISTINCT value)': [{ count: 1 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [badge],
    });

    const result = evaluateBadges(db);

    expect(result.newlyEarned).toHaveLength(0);
    expect(executed.every(e => !e.sql.includes('UPDATE bk_badges'))).toBe(true);
  });

  it('skips already earned badges', () => {
    // No unearned badges returned, so nothing to evaluate
    const { db, executed } = createMockDb({
      'earned_at IS NULL': [],
      'COUNT(DISTINCT book_id)': [{ count: 100 }],
      'SUM(b.page_count)': [{ total: 30000 }],
      'COUNT(DISTINCT value)': [{ count: 10 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 5 }],
      'bk_reviews WHERE review_text': [{ count: 20 }],
      'bk_journal_entries': [{ count: 15 }],
      'julianday': [{ min_days: 1 }],
      'ORDER BY category, threshold': [],
    });

    const result = evaluateBadges(db);

    expect(result.newlyEarned).toHaveLength(0);
    expect(executed.every(e => !e.sql.includes('UPDATE bk_badges'))).toBe(true);
  });

  it('awards multiple badges simultaneously', () => {
    const badges = [
      makeBadge({ id: 'volume_10', threshold: 10, category: 'volume' }),
      makeBadge({ id: 'volume_25', threshold: 25, category: 'volume', name: 'Bookworm', tier: 'silver' }),
      makeBadge({ id: 'volume_50', threshold: 50, category: 'volume', name: 'Avid Reader', tier: 'gold' }),
    ];

    const { db } = createMockDb({
      'earned_at IS NULL': badges,
      'COUNT(DISTINCT book_id)': [{ count: 50 }],
      'SUM(b.page_count)': [{ total: 15000 }],
      'COUNT(DISTINCT value)': [{ count: 3 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': badges.map(b => ({ ...b, earned_at: new Date().toISOString() })),
    });

    const result = evaluateBadges(db);

    expect(result.newlyEarned).toHaveLength(3);
    expect(result.newlyEarned.map(b => b.id)).toContain('volume_10');
    expect(result.newlyEarned.map(b => b.id)).toContain('volume_25');
    expect(result.newlyEarned.map(b => b.id)).toContain('volume_50');
  });

  it('awards streak badge at threshold', () => {
    const badge = makeBadge({
      id: 'streak_7',
      threshold: 7,
      category: 'streak',
      name: 'Week Warrior',
    });

    // Create 7 consecutive days of activity
    const today = new Date();
    const days: { day: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ day: d.toISOString().slice(0, 10) });
    }

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 0 }],
      'SUM(b.page_count)': [{ total: 0 }],
      'COUNT(DISTINCT value)': [{ count: 0 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': days,
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('streak_7');
  });

  it('awards speed badge for 1-day finish', () => {
    const badge = makeBadge({
      id: 'speed_1day',
      threshold: 1,
      category: 'speed',
      name: 'Speed Reader',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 1 }],
      'SUM(b.page_count)': [{ total: 300 }],
      'COUNT(DISTINCT value)': [{ count: 0 }],
      'DISTINCT b.authors': [{ authors: '["Author A"]' }],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: 1 }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('speed_1day');
  });

  it('awards genre badge at 5 distinct genres', () => {
    const badge = makeBadge({
      id: 'genre_5',
      threshold: 5,
      category: 'genre',
      name: 'Genre Explorer',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 10 }],
      'SUM(b.page_count)': [{ total: 3000 }],
      'COUNT(DISTINCT value)': [{ count: 5 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('genre_5');
  });

  it('awards author badge at 10 unique authors', () => {
    const badge = makeBadge({
      id: 'author_10',
      threshold: 10,
      category: 'author',
      name: 'Author Explorer',
    });

    // 10 unique author rows
    const authorRows = Array.from({ length: 10 }, (_, i) => ({
      authors: `["Author ${i}"]`,
    }));

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 10 }],
      'SUM(b.page_count)': [{ total: 3000 }],
      'COUNT(DISTINCT value)': [{ count: 2 }],
      'DISTINCT b.authors': authorRows,
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('author_10');
  });

  it('awards review badge at 10 reviews', () => {
    const badge = makeBadge({
      id: 'review_10',
      threshold: 10,
      category: 'review',
      name: 'Critic',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 10 }],
      'SUM(b.page_count)': [{ total: 3000 }],
      'COUNT(DISTINCT value)': [{ count: 2 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 10 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('review_10');
  });

  it('awards journal badge at 10 entries', () => {
    const badge = makeBadge({
      id: 'journal_10',
      threshold: 10,
      category: 'journal',
      name: 'Reflective Reader',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 0 }],
      'SUM(b.page_count)': [{ total: 0 }],
      'COUNT(DISTINCT value)': [{ count: 0 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 10 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('journal_10');
  });

  it('awards challenge badge at 1 completed challenge', () => {
    const badge = makeBadge({
      id: 'challenge_1',
      threshold: 1,
      category: 'challenge',
      name: 'Challenger',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 0 }],
      'SUM(b.page_count)': [{ total: 0 }],
      'COUNT(DISTINCT value)': [{ count: 0 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 1 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [{ ...badge, earned_at: new Date().toISOString() }],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(1);
    expect(result.newlyEarned[0].id).toBe('challenge_1');
  });

  it('does not count star-only ratings toward review badge', () => {
    const badge = makeBadge({
      id: 'review_5',
      threshold: 5,
      category: 'review',
      name: 'Thoughtful Reader',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [badge],
      'COUNT(DISTINCT book_id)': [{ count: 0 }],
      'SUM(b.page_count)': [{ total: 0 }],
      'COUNT(DISTINCT value)': [{ count: 0 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }], // 0 written reviews even though star ratings exist
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [badge],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(0);
  });

  it('badge stays earned even if stats decrease (never revoked)', () => {
    // Already earned badge is not in unearned list, so won't be revoked
    const earnedBadge = makeBadge({
      id: 'volume_10',
      threshold: 10,
      earned_at: '2026-01-15T00:00:00.000Z',
    });

    const { db } = createMockDb({
      'earned_at IS NULL': [], // no unearned badges
      'COUNT(DISTINCT book_id)': [{ count: 5 }], // stats below threshold
      'SUM(b.page_count)': [{ total: 1500 }],
      'COUNT(DISTINCT value)': [{ count: 1 }],
      'DISTINCT b.authors': [],
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
      'bk_challenges WHERE is_active = 0': [{ count: 0 }],
      'bk_reviews WHERE review_text': [{ count: 0 }],
      'bk_journal_entries': [{ count: 0 }],
      'julianday': [{ min_days: null }],
      'ORDER BY category, threshold': [earnedBadge],
    });

    const result = evaluateBadges(db);
    expect(result.newlyEarned).toHaveLength(0);
    // The earned badge should still show as earned in progress
    expect(result.allProgress).toHaveLength(1);
    expect(result.allProgress[0].isEarned).toBe(true);
  });
});

describe('getBadgeProgress', () => {
  it('calculates progress text correctly', () => {
    const badge = makeBadge({ id: 'volume_10', threshold: 10, category: 'volume' });
    const stats = makeStats({ totalBooks: 7 });

    const progress = getBadgeProgress(badge, stats);

    expect(progress.currentValue).toBe(7);
    expect(progress.progressText).toBe('7/10');
    expect(progress.isEarned).toBe(false);
  });

  it('shows earned state for earned badge', () => {
    const badge = makeBadge({
      id: 'volume_10',
      threshold: 10,
      earned_at: '2026-01-15T00:00:00.000Z',
    });
    const stats = makeStats({ totalBooks: 15 });

    const progress = getBadgeProgress(badge, stats);

    expect(progress.isEarned).toBe(true);
    expect(progress.currentValue).toBe(15);
    expect(progress.progressText).toBe('15/10');
  });
});

describe('computeStreak', () => {
  it('returns 0 when no activity exists', () => {
    const { db } = createMockDb({
      'DATE(started_at)': [],
      'DATE(created_at) as day': [],
    });

    const streak = computeStreak(db);
    expect(streak).toBe(0);
  });

  it('counts consecutive days correctly', () => {
    const today = new Date();
    const days: { day: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ day: d.toISOString().slice(0, 10) });
    }

    const { db } = createMockDb({
      'DATE(started_at)': days,
      'DATE(created_at) as day': [],
    });

    const streak = computeStreak(db);
    expect(streak).toBe(5);
  });

  it('returns 0 when most recent activity is more than 1 day ago', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 3);

    const { db } = createMockDb({
      'DATE(started_at)': [{ day: oldDate.toISOString().slice(0, 10) }],
      'DATE(created_at) as day': [],
    });

    const streak = computeStreak(db);
    expect(streak).toBe(0);
  });

  it('merges timed sessions and progress updates for streak', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { db } = createMockDb({
      'DATE(started_at)': [
        { day: today.toISOString().slice(0, 10) },
        { day: twoDaysAgo.toISOString().slice(0, 10) },
      ],
      'DATE(created_at) as day': [
        { day: yesterday.toISOString().slice(0, 10) },
      ],
    });

    const streak = computeStreak(db);
    expect(streak).toBe(3);
  });
});
