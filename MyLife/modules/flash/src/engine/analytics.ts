import type { Flashcard, ReviewLog } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface RetentionStats {
  totalReviews: number;
  correctReviews: number;
  retentionRate: number;
}

export interface ReviewForecastDay {
  date: string;
  dueCount: number;
}

export interface StudyTimeEstimate {
  totalMinutes: number;
  sessionCount: number;
  avgSessionMinutes: number;
}

export interface AccuracyTrendPoint {
  date: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface DifficultyBucket {
  label: string;
  minEase: number;
  maxEase: number;
  count: number;
}

export type MaturityLevel = 'new' | 'young' | 'mature';

export interface MaturityBucket {
  level: MaturityLevel;
  count: number;
}

// ── Constants ────────────────────────────────────────────────────────

const CORRECT_RATINGS: ReadonlySet<string> = new Set<string>(['good', 'easy']);
const SESSION_GAP_MINUTES = 5;
const AVG_SECONDS_PER_CARD = 8;

// ── Pure Functions ───────────────────────────────────────────────────

/**
 * Compute retention rate from review logs over a given period.
 * Retention = reviews rated 'good' or 'easy' / total reviews.
 */
export function calculateRetentionRate(
  logs: ReadonlyArray<Pick<ReviewLog, 'rating' | 'reviewedAt'>>,
  startDate?: string,
  endDate?: string,
): RetentionStats {
  const filtered = logs.filter((log) => {
    if (startDate && log.reviewedAt < startDate) return false;
    if (endDate && log.reviewedAt > endDate) return false;
    return true;
  });

  if (filtered.length === 0) {
    return { totalReviews: 0, correctReviews: 0, retentionRate: 0 };
  }

  const correct = filtered.filter((log) => CORRECT_RATINGS.has(log.rating)).length;
  return {
    totalReviews: filtered.length,
    correctReviews: correct,
    retentionRate: correct / filtered.length,
  };
}

/**
 * Predict due cards for the next N days based on current card intervals and due dates.
 * Groups cards by their scheduled due date.
 */
export function buildReviewForecast(
  cards: ReadonlyArray<Pick<Flashcard, 'queue' | 'dueAt'>>,
  referenceDate: string,
  days: number,
): ReviewForecastDay[] {
  const refDate = new Date(`${referenceDate.slice(0, 10)}T00:00:00Z`);
  const forecast: ReviewForecastDay[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(refDate);
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().slice(0, 10);

    const dueCount = cards.filter((card) => {
      if (card.queue === 'suspended' || card.queue === 'buried') return false;
      if (!card.dueAt) return i === 0 && card.queue === 'new';
      const cardDate = card.dueAt.slice(0, 10);
      if (i === 0) return cardDate <= dateStr;
      return cardDate === dateStr;
    }).length;

    forecast.push({ date: dateStr, dueCount });
  }

  return forecast;
}

/**
 * Estimate study time from review log timestamps.
 * Groups reviews into sessions (gap > 5 minutes = new session).
 * Estimates time per card at ~8 seconds for cards within a session.
 */
export function calculateStudyTime(
  logs: ReadonlyArray<Pick<ReviewLog, 'reviewedAt'>>,
): StudyTimeEstimate {
  if (logs.length === 0) {
    return { totalMinutes: 0, sessionCount: 0, avgSessionMinutes: 0 };
  }

  const sorted = [...logs].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  let sessionCount = 1;
  let totalSeconds = AVG_SECONDS_PER_CARD;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].reviewedAt).getTime();
    const curr = new Date(sorted[i].reviewedAt).getTime();
    const gapMinutes = (curr - prev) / 60_000;

    if (gapMinutes > SESSION_GAP_MINUTES) {
      sessionCount++;
      totalSeconds += AVG_SECONDS_PER_CARD;
    } else {
      totalSeconds += Math.min(gapMinutes * 60, AVG_SECONDS_PER_CARD * 3);
    }
  }

  const totalMinutes = Math.round((totalSeconds / 60) * 10) / 10;
  return {
    totalMinutes,
    sessionCount,
    avgSessionMinutes: Math.round((totalMinutes / sessionCount) * 10) / 10,
  };
}

/**
 * Compute daily accuracy trend from review logs.
 * Returns one data point per day with total reviews, correct reviews, and accuracy %.
 */
export function getAccuracyTrend(
  logs: ReadonlyArray<Pick<ReviewLog, 'rating' | 'reviewedAt'>>,
): AccuracyTrendPoint[] {
  const byDay = new Map<string, { total: number; correct: number }>();

  for (const log of logs) {
    const date = log.reviewedAt.slice(0, 10);
    const entry = byDay.get(date) ?? { total: 0, correct: 0 };
    entry.total++;
    if (CORRECT_RATINGS.has(log.rating)) {
      entry.correct++;
    }
    byDay.set(date, entry);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, correct }]) => ({
      date,
      total,
      correct,
      accuracy: total > 0 ? correct / total : 0,
    }));
}

/**
 * Break down cards by ease factor into difficulty buckets.
 *   Hard:   1.3 - 1.8
 *   Medium: 1.8 - 2.3
 *   Normal: 2.3 - 2.7
 *   Easy:   2.7+
 */
export function getDifficultyDistribution(
  cards: ReadonlyArray<Pick<Flashcard, 'ease' | 'queue'>>,
): DifficultyBucket[] {
  const active = cards.filter((c) => c.queue !== 'suspended' && c.queue !== 'buried');

  const buckets: DifficultyBucket[] = [
    { label: 'Hard', minEase: 1.3, maxEase: 1.8, count: 0 },
    { label: 'Medium', minEase: 1.8, maxEase: 2.3, count: 0 },
    { label: 'Normal', minEase: 2.3, maxEase: 2.7, count: 0 },
    { label: 'Easy', minEase: 2.7, maxEase: Infinity, count: 0 },
  ];

  for (const card of active) {
    for (const bucket of buckets) {
      if (card.ease >= bucket.minEase && card.ease < bucket.maxEase) {
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}

/**
 * Break down cards by interval length into maturity levels.
 *   New:    intervalDays === 0 (unseen or relearning)
 *   Young:  intervalDays 1-21
 *   Mature: intervalDays > 21
 */
export function getMaturityDistribution(
  cards: ReadonlyArray<Pick<Flashcard, 'intervalDays' | 'queue'>>,
): MaturityBucket[] {
  const active = cards.filter((c) => c.queue !== 'suspended' && c.queue !== 'buried');

  let newCount = 0;
  let youngCount = 0;
  let matureCount = 0;

  for (const card of active) {
    if (card.intervalDays === 0 || card.queue === 'new' || card.queue === 'learning') {
      newCount++;
    } else if (card.intervalDays <= 21) {
      youngCount++;
    } else {
      matureCount++;
    }
  }

  return [
    { level: 'new', count: newCount },
    { level: 'young', count: youngCount },
    { level: 'mature', count: matureCount },
  ];
}
