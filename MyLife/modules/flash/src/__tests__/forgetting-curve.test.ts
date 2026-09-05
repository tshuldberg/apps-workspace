import { describe, it, expect } from 'vitest';
import {
  calculatePersonalRetention,
  estimateHalfLife,
  predictRetention,
  getRetentionBuckets,
} from '../engine/forgetting-curve';

describe('calculatePersonalRetention', () => {
  it('returns empty array for no logs', () => {
    expect(calculatePersonalRetention([])).toEqual([]);
  });

  it('groups reviews by interval bucket', () => {
    const logs = [
      { cardId: 'c1', rating: 'good' as const, reviewedAt: '2026-03-10T10:00:00Z' },
      { cardId: 'c1', rating: 'good' as const, reviewedAt: '2026-03-11T10:00:00Z' }, // 1 day interval
      { cardId: 'c1', rating: 'again' as const, reviewedAt: '2026-03-18T10:00:00Z' }, // 7 day interval
    ];
    const result = calculatePersonalRetention(logs);
    expect(result.length).toBeGreaterThan(0);
    // First bucket (1 day) should show 100% retention
    expect(result[0].retentionRate).toBe(1);
  });

  it('calculates retention across multiple cards', () => {
    const logs = [
      { cardId: 'c1', rating: 'good' as const, reviewedAt: '2026-03-10T10:00:00Z' },
      { cardId: 'c1', rating: 'good' as const, reviewedAt: '2026-03-11T10:00:00Z' },
      { cardId: 'c2', rating: 'again' as const, reviewedAt: '2026-03-10T10:00:00Z' },
      { cardId: 'c2', rating: 'again' as const, reviewedAt: '2026-03-11T10:00:00Z' },
    ];
    const result = calculatePersonalRetention(logs);
    // Both cards have 1-day intervals: one good (correct), one again (incorrect)
    expect(result[0].totalCards).toBe(2);
    expect(result[0].retentionRate).toBe(0.5);
  });

  it('skips first review per card (no prior interval)', () => {
    const logs = [
      { cardId: 'c1', rating: 'good' as const, reviewedAt: '2026-03-10T10:00:00Z' },
    ];
    // Single review = no interval to compute
    expect(calculatePersonalRetention(logs)).toEqual([]);
  });
});

describe('estimateHalfLife', () => {
  it('returns zero half-life for empty cards', () => {
    const result = estimateHalfLife([], []);
    expect(result.every((r) => r.halfLifeDays === 0)).toBe(true);
    expect(result.every((r) => r.sampleSize === 0)).toBe(true);
  });

  it('returns higher half-life for easier cards', () => {
    const cards = [
      { ease: 1.5, intervalDays: 3, queue: 'review' as const },
      { ease: 2.8, intervalDays: 30, queue: 'review' as const },
    ];
    const result = estimateHalfLife(cards, []);
    const hard = result.find((r) => r.easeRange.includes('Hard'));
    const easy = result.find((r) => r.easeRange.includes('Easy'));
    expect(hard!.halfLifeDays).toBeLessThan(easy!.halfLifeDays);
  });

  it('excludes suspended cards', () => {
    const cards = [
      { ease: 2.5, intervalDays: 10, queue: 'suspended' as const },
    ];
    const result = estimateHalfLife(cards, []);
    expect(result.every((r) => r.sampleSize === 0)).toBe(true);
  });
});

describe('predictRetention', () => {
  it('returns 0 for cards never reviewed', () => {
    const result = predictRetention(
      { id: 'c1', ease: 2.5, intervalDays: 0, lastReviewAt: null },
      '2026-03-20',
    );
    expect(result.predictedRetention).toBe(0);
    expect(result.daysSinceReview).toBe(0);
  });

  it('returns high retention for recently reviewed cards', () => {
    const result = predictRetention(
      { id: 'c1', ease: 2.5, intervalDays: 10, lastReviewAt: '2026-03-19T10:00:00Z' },
      '2026-03-20T10:00:00Z',
    );
    expect(result.predictedRetention).toBeGreaterThan(0.95);
    expect(result.daysSinceReview).toBeCloseTo(1, 0);
  });

  it('returns lower retention for overdue cards', () => {
    const recent = predictRetention(
      { id: 'c1', ease: 2.5, intervalDays: 5, lastReviewAt: '2026-03-19T10:00:00Z' },
      '2026-03-20T10:00:00Z',
    );
    const overdue = predictRetention(
      { id: 'c1', ease: 2.5, intervalDays: 5, lastReviewAt: '2026-03-01T10:00:00Z' },
      '2026-03-20T10:00:00Z',
    );
    expect(recent.predictedRetention).toBeGreaterThan(overdue.predictedRetention);
  });

  it('clamps retention between 0 and 1', () => {
    const result = predictRetention(
      { id: 'c1', ease: 2.5, intervalDays: 10, lastReviewAt: '2026-03-19T10:00:00Z' },
      '2026-03-19T10:00:00Z', // Same time = 0 days
    );
    expect(result.predictedRetention).toBeLessThanOrEqual(1);
    expect(result.predictedRetention).toBeGreaterThanOrEqual(0);
  });
});

describe('getRetentionBuckets', () => {
  it('returns all zero counts for empty cards', () => {
    const result = getRetentionBuckets([], '2026-03-20');
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it('excludes new, suspended, and buried cards', () => {
    const cards = [
      { id: 'c1', ease: 2.5, intervalDays: 10, lastReviewAt: '2026-03-19T10:00:00Z', queue: 'new' as const },
      { id: 'c2', ease: 2.5, intervalDays: 10, lastReviewAt: '2026-03-19T10:00:00Z', queue: 'suspended' as const },
      { id: 'c3', ease: 2.5, intervalDays: 10, lastReviewAt: '2026-03-19T10:00:00Z', queue: 'buried' as const },
    ];
    const result = getRetentionBuckets(cards, '2026-03-20');
    const total = result.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(0);
  });

  it('puts recently reviewed cards in strong bucket', () => {
    const cards = [
      { id: 'c1', ease: 2.5, intervalDays: 30, lastReviewAt: '2026-03-19T10:00:00Z', queue: 'review' as const },
    ];
    const result = getRetentionBuckets(cards, '2026-03-20T10:00:00Z');
    expect(result.find((b) => b.level === 'strong')!.count).toBe(1);
  });

  it('puts very overdue cards in critical bucket', () => {
    const cards = [
      { id: 'c1', ease: 2.5, intervalDays: 1, lastReviewAt: '2026-01-01T10:00:00Z', queue: 'review' as const },
    ];
    const result = getRetentionBuckets(cards, '2026-03-20T10:00:00Z');
    expect(result.find((b) => b.level === 'critical')!.count).toBe(1);
  });
});
