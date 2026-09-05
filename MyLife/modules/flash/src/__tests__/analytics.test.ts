import { describe, it, expect } from 'vitest';
import {
  calculateRetentionRate,
  buildReviewForecast,
  calculateStudyTime,
  getAccuracyTrend,
  getDifficultyDistribution,
  getMaturityDistribution,
} from '../engine/analytics';

describe('calculateRetentionRate', () => {
  it('returns zero for empty logs', () => {
    const result = calculateRetentionRate([]);
    expect(result).toEqual({ totalReviews: 0, correctReviews: 0, retentionRate: 0 });
  });

  it('counts good and easy as correct', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'easy' as const, reviewedAt: '2026-03-20T10:01:00Z' },
      { rating: 'hard' as const, reviewedAt: '2026-03-20T10:02:00Z' },
      { rating: 'again' as const, reviewedAt: '2026-03-20T10:03:00Z' },
    ];
    const result = calculateRetentionRate(logs);
    expect(result.totalReviews).toBe(4);
    expect(result.correctReviews).toBe(2);
    expect(result.retentionRate).toBe(0.5);
  });

  it('filters by date range', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-18T10:00:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'again' as const, reviewedAt: '2026-03-22T10:00:00Z' },
    ];
    const result = calculateRetentionRate(logs, '2026-03-19', '2026-03-21');
    expect(result.totalReviews).toBe(1);
    expect(result.retentionRate).toBe(1);
  });

  it('returns 100% when all reviews are correct', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'easy' as const, reviewedAt: '2026-03-20T10:01:00Z' },
    ];
    expect(calculateRetentionRate(logs).retentionRate).toBe(1);
  });
});

describe('buildReviewForecast', () => {
  it('returns empty forecast for no days', () => {
    expect(buildReviewForecast([], '2026-03-20', 0)).toEqual([]);
  });

  it('counts new cards as due on day 0', () => {
    const cards = [
      { queue: 'new' as const, dueAt: null },
      { queue: 'new' as const, dueAt: null },
    ];
    const forecast = buildReviewForecast(cards, '2026-03-20', 3);
    expect(forecast[0].dueCount).toBe(2);
    expect(forecast[1].dueCount).toBe(0);
  });

  it('places review cards on their due date', () => {
    const cards = [
      { queue: 'review' as const, dueAt: '2026-03-22T00:00:00Z' },
    ];
    const forecast = buildReviewForecast(cards, '2026-03-20', 5);
    expect(forecast[0].dueCount).toBe(0); // day 0
    expect(forecast[2].dueCount).toBe(1); // day 2 = March 22
  });

  it('includes overdue cards on day 0', () => {
    const cards = [
      { queue: 'review' as const, dueAt: '2026-03-15T00:00:00Z' },
    ];
    const forecast = buildReviewForecast(cards, '2026-03-20', 3);
    expect(forecast[0].dueCount).toBe(1);
  });

  it('excludes suspended and buried cards', () => {
    const cards = [
      { queue: 'suspended' as const, dueAt: '2026-03-20T00:00:00Z' },
      { queue: 'buried' as const, dueAt: '2026-03-20T00:00:00Z' },
    ];
    const forecast = buildReviewForecast(cards, '2026-03-20', 3);
    expect(forecast[0].dueCount).toBe(0);
  });
});

describe('calculateStudyTime', () => {
  it('returns zero for empty logs', () => {
    const result = calculateStudyTime([]);
    expect(result).toEqual({ totalMinutes: 0, sessionCount: 0, avgSessionMinutes: 0 });
  });

  it('counts single review as one session', () => {
    const logs = [{ reviewedAt: '2026-03-20T10:00:00Z' }];
    const result = calculateStudyTime(logs);
    expect(result.sessionCount).toBe(1);
    expect(result.totalMinutes).toBeGreaterThan(0);
  });

  it('detects session breaks at 5+ minute gaps', () => {
    const logs = [
      { reviewedAt: '2026-03-20T10:00:00Z' },
      { reviewedAt: '2026-03-20T10:01:00Z' },
      { reviewedAt: '2026-03-20T10:10:00Z' }, // 9 min gap = new session
      { reviewedAt: '2026-03-20T10:11:00Z' },
    ];
    const result = calculateStudyTime(logs);
    expect(result.sessionCount).toBe(2);
  });
});

describe('getAccuracyTrend', () => {
  it('returns empty array for no logs', () => {
    expect(getAccuracyTrend([])).toEqual([]);
  });

  it('groups by day and calculates accuracy', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'again' as const, reviewedAt: '2026-03-20T10:01:00Z' },
      { rating: 'easy' as const, reviewedAt: '2026-03-21T10:00:00Z' },
    ];
    const trend = getAccuracyTrend(logs);
    expect(trend).toHaveLength(2);
    expect(trend[0].date).toBe('2026-03-20');
    expect(trend[0].accuracy).toBe(0.5);
    expect(trend[1].date).toBe('2026-03-21');
    expect(trend[1].accuracy).toBe(1);
  });

  it('returns days sorted chronologically', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-22T10:00:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-21T10:00:00Z' },
    ];
    const trend = getAccuracyTrend(logs);
    expect(trend.map((t) => t.date)).toEqual(['2026-03-20', '2026-03-21', '2026-03-22']);
  });
});

describe('getDifficultyDistribution', () => {
  it('distributes cards into ease factor buckets', () => {
    const cards = [
      { ease: 1.5, queue: 'review' as const },
      { ease: 2.0, queue: 'review' as const },
      { ease: 2.5, queue: 'review' as const },
      { ease: 3.0, queue: 'review' as const },
    ];
    const dist = getDifficultyDistribution(cards);
    expect(dist.find((b) => b.label === 'Hard')!.count).toBe(1);
    expect(dist.find((b) => b.label === 'Medium')!.count).toBe(1);
    expect(dist.find((b) => b.label === 'Normal')!.count).toBe(1);
    expect(dist.find((b) => b.label === 'Easy')!.count).toBe(1);
  });

  it('excludes suspended and buried cards', () => {
    const cards = [
      { ease: 2.5, queue: 'suspended' as const },
      { ease: 2.5, queue: 'buried' as const },
      { ease: 2.5, queue: 'review' as const },
    ];
    const dist = getDifficultyDistribution(cards);
    const total = dist.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(1);
  });
});

describe('getMaturityDistribution', () => {
  it('classifies by interval length', () => {
    const cards = [
      { intervalDays: 0, queue: 'new' as const },
      { intervalDays: 5, queue: 'review' as const },
      { intervalDays: 30, queue: 'review' as const },
    ];
    const dist = getMaturityDistribution(cards);
    expect(dist.find((b) => b.level === 'new')!.count).toBe(1);
    expect(dist.find((b) => b.level === 'young')!.count).toBe(1);
    expect(dist.find((b) => b.level === 'mature')!.count).toBe(1);
  });

  it('classifies learning cards as new', () => {
    const cards = [{ intervalDays: 0, queue: 'learning' as const }];
    const dist = getMaturityDistribution(cards);
    expect(dist.find((b) => b.level === 'new')!.count).toBe(1);
  });

  it('excludes suspended cards', () => {
    const cards = [{ intervalDays: 30, queue: 'suspended' as const }];
    const dist = getMaturityDistribution(cards);
    const total = dist.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(0);
  });
});
