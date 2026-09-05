import type { Flashcard, ReviewLog } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface RetentionDataPoint {
  intervalDays: number;
  totalCards: number;
  successfulRecalls: number;
  retentionRate: number;
}

export interface HalfLifeEstimate {
  easeRange: string;
  halfLifeDays: number;
  sampleSize: number;
}

export interface RetentionPrediction {
  cardId: string;
  daysSinceReview: number;
  predictedRetention: number;
}

export type RetentionLevel = 'critical' | 'low' | 'moderate' | 'strong';

export interface RetentionBucket {
  level: RetentionLevel;
  minRetention: number;
  maxRetention: number;
  count: number;
}

// ── Constants ────────────────────────────────────────────────────────

const CORRECT_RATINGS = new Set(['good', 'easy']);

/**
 * Interval buckets for grouping reviews when computing retention.
 * Each boundary marks the upper limit of a bucket (exclusive).
 */
const INTERVAL_BUCKETS = [1, 3, 7, 14, 30, 60, 120, 365] as const;

// ── Pure Functions ───────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.abs(msB - msA) / 86_400_000;
}

function bucketForInterval(interval: number): number {
  for (const boundary of INTERVAL_BUCKETS) {
    if (interval < boundary) return boundary;
  }
  return INTERVAL_BUCKETS[INTERVAL_BUCKETS.length - 1];
}

/**
 * Compute the user's actual retention rate at various interval lengths.
 * Groups reviews by the interval since the previous review, then calculates
 * success rate per bucket.
 *
 * reviewsWithInterval: each review paired with the interval (in days)
 * since the card was last reviewed. For first reviews, interval = 0.
 */
export function calculatePersonalRetention(
  logs: ReadonlyArray<Pick<ReviewLog, 'rating' | 'reviewedAt' | 'cardId'>>,
): RetentionDataPoint[] {
  // Group logs by card, sorted by time
  const byCard = new Map<string, Array<Pick<ReviewLog, 'rating' | 'reviewedAt'>>>();
  for (const log of logs) {
    const list = byCard.get(log.cardId) ?? [];
    list.push(log);
    byCard.set(log.cardId, list);
  }

  // Build interval-bucketed retention data
  const bucketData = new Map<number, { total: number; correct: number }>();

  for (const cardLogs of byCard.values()) {
    const sorted = [...cardLogs].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
    for (let i = 1; i < sorted.length; i++) {
      const interval = daysBetween(sorted[i - 1].reviewedAt, sorted[i].reviewedAt);
      const bucket = bucketForInterval(interval);
      const entry = bucketData.get(bucket) ?? { total: 0, correct: 0 };
      entry.total++;
      if (CORRECT_RATINGS.has(sorted[i].rating)) {
        entry.correct++;
      }
      bucketData.set(bucket, entry);
    }
  }

  return [...bucketData.entries()]
    .sort(([a], [b]) => a - b)
    .map(([intervalDays, { total, correct }]) => ({
      intervalDays,
      totalCards: total,
      successfulRecalls: correct,
      retentionRate: total > 0 ? correct / total : 0,
    }));
}

/**
 * Estimate memory half-life for different card difficulty levels.
 * Half-life = interval at which retention drops to ~50%.
 * Uses exponential decay model: R(t) = e^(-t/S) where S is stability.
 * Half-life = S * ln(2).
 */
export function estimateHalfLife(
  cards: ReadonlyArray<Pick<Flashcard, 'ease' | 'intervalDays' | 'queue'>>,
  logs: ReadonlyArray<Pick<ReviewLog, 'rating' | 'reviewedAt' | 'cardId'>>,
): HalfLifeEstimate[] {
  // Group cards by ease range
  const easeRanges: Array<{ label: string; min: number; max: number }> = [
    { label: 'Hard (1.3-1.8)', min: 1.3, max: 1.8 },
    { label: 'Medium (1.8-2.3)', min: 1.8, max: 2.3 },
    { label: 'Easy (2.3+)', min: 2.3, max: Infinity },
  ];

  const cardEaseMap = new Map<string, number>();
  for (const card of cards) {
    if (card.queue !== 'suspended' && card.queue !== 'buried') {
      // Use card ID placeholder since we only have ease
      cardEaseMap.set(`ease-${card.ease}-${card.intervalDays}`, card.ease);
    }
  }

  // For each ease range, compute average interval of successful reviews
  const byCard = new Map<string, Array<Pick<ReviewLog, 'rating' | 'reviewedAt'>>>();
  for (const log of logs) {
    const list = byCard.get(log.cardId) ?? [];
    list.push(log);
    byCard.set(log.cardId, list);
  }

  return easeRanges.map(({ label, min, max }) => {
    const rangeCards = cards.filter(
      (c) => c.ease >= min && c.ease < max && c.queue !== 'suspended' && c.queue !== 'buried',
    );

    if (rangeCards.length === 0) {
      return { easeRange: label, halfLifeDays: 0, sampleSize: 0 };
    }

    // Estimate stability from average ease factor
    // In FSRS, stability ~ interval at desired retention
    // For ease 2.5 with 90% target retention, stability ~ interval * 0.9
    const avgEase =
      rangeCards.reduce((sum, c) => sum + c.ease, 0) / rangeCards.length;
    const avgInterval =
      rangeCards.reduce((sum, c) => sum + c.intervalDays, 0) / rangeCards.length;

    // Half-life approximation: S * ln(2) where S = avgInterval / -ln(targetRetention)
    // For 90% target: S = avgInterval / 0.10536
    const stability = avgInterval > 0 ? avgInterval / 0.10536 : avgEase * 2;
    const halfLifeDays = Math.round(stability * Math.LN2 * 10) / 10;

    return { easeRange: label, halfLifeDays, sampleSize: rangeCards.length };
  });
}

/**
 * Predict current retention probability for a card given time since last review.
 * Uses exponential decay: R(t) = e^(-t/S)
 * where S (stability) is approximated from the card's interval and ease.
 */
export function predictRetention(
  card: Pick<Flashcard, 'id' | 'ease' | 'intervalDays' | 'lastReviewAt'>,
  referenceDate: string,
): RetentionPrediction {
  if (!card.lastReviewAt) {
    return { cardId: card.id, daysSinceReview: 0, predictedRetention: 0 };
  }

  const daysSince = daysBetween(card.lastReviewAt, referenceDate);

  // Stability approximation: interval / -ln(0.9) for 90% desired retention
  const stability = card.intervalDays > 0 ? card.intervalDays / 0.10536 : card.ease * 2;
  const retention = Math.exp(-daysSince / stability);

  return {
    cardId: card.id,
    daysSinceReview: Math.round(daysSince * 10) / 10,
    predictedRetention: Math.round(Math.max(0, Math.min(1, retention)) * 1000) / 1000,
  };
}

/**
 * Group cards into retention probability buckets based on predicted retention.
 *   Critical: 0-60%
 *   Low:      60-80%
 *   Moderate: 80-90%
 *   Strong:   90%+
 */
export function getRetentionBuckets(
  cards: ReadonlyArray<Pick<Flashcard, 'id' | 'ease' | 'intervalDays' | 'lastReviewAt' | 'queue'>>,
  referenceDate: string,
): RetentionBucket[] {
  const active = cards.filter(
    (c) => c.queue !== 'suspended' && c.queue !== 'buried' && c.queue !== 'new',
  );

  const buckets: RetentionBucket[] = [
    { level: 'critical', minRetention: 0, maxRetention: 0.6, count: 0 },
    { level: 'low', minRetention: 0.6, maxRetention: 0.8, count: 0 },
    { level: 'moderate', minRetention: 0.8, maxRetention: 0.9, count: 0 },
    { level: 'strong', minRetention: 0.9, maxRetention: 1.01, count: 0 },
  ];

  for (const card of active) {
    const { predictedRetention } = predictRetention(card, referenceDate);
    for (const bucket of buckets) {
      if (predictedRetention >= bucket.minRetention && predictedRetention < bucket.maxRetention) {
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}
