import type { ReviewLog } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface StudySession {
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  cardsReviewed: number;
  newCards: number;
  reviewCards: number;
  lapseCards: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
}

export interface SessionDurationEstimate {
  estimatedMinutes: number;
  dueCards: number;
  avgSecondsPerCard: number;
}

export interface OptimalStudyTime {
  hour: number;
  avgAccuracy: number;
  sessionCount: number;
}

export interface SessionXP {
  cardsReviewed: number;
  correctBonus: number;
  streakBonus: number;
  totalXP: number;
}

// ── Constants ────────────────────────────────────────────────────────

/** Gap in minutes between reviews that signals a new session */
const SESSION_GAP_MINUTES = 5;
const CORRECT_RATINGS = new Set(['good', 'easy']);
const DEFAULT_SECONDS_PER_CARD = 8;

// XP constants
const XP_PER_CARD = 10;
const XP_CORRECT_BONUS = 5;
const XP_STREAK_MULTIPLIER = 0.1;

// ── Pure Functions ───────────────────────────────────────────────────

/**
 * Detect study sessions from review logs using gap detection.
 * A gap of >5 minutes between consecutive reviews starts a new session.
 */
export function detectSessions(
  logs: ReadonlyArray<Pick<ReviewLog, 'rating' | 'reviewedAt'>>,
): StudySession[] {
  if (logs.length === 0) return [];

  const sorted = [...logs].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  const sessions: StudySession[] = [];
  let sessionLogs: Array<Pick<ReviewLog, 'rating' | 'reviewedAt'>> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].reviewedAt).getTime();
    const curr = new Date(sorted[i].reviewedAt).getTime();
    const gapMinutes = (curr - prev) / 60_000;

    if (gapMinutes > SESSION_GAP_MINUTES) {
      sessions.push(buildSession(sessionLogs));
      sessionLogs = [sorted[i]];
    } else {
      sessionLogs.push(sorted[i]);
    }
  }

  if (sessionLogs.length > 0) {
    sessions.push(buildSession(sessionLogs));
  }

  return sessions;
}

/**
 * Create a session summary from a list of review logs within one session.
 */
export function createSessionSummary(
  logs: ReadonlyArray<Pick<ReviewLog, 'rating' | 'reviewedAt'>>,
): StudySession {
  return buildSession([...logs].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt)));
}

/**
 * Estimate how long a study session will take based on due card count
 * and the user's historical pace.
 */
export function estimateSessionDuration(
  dueCardCount: number,
  pastSessions: ReadonlyArray<StudySession>,
): SessionDurationEstimate {
  let avgSeconds = DEFAULT_SECONDS_PER_CARD;

  if (pastSessions.length > 0) {
    const totalCards = pastSessions.reduce((sum, s) => sum + s.cardsReviewed, 0);
    const totalMinutes = pastSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    if (totalCards > 0 && totalMinutes > 0) {
      avgSeconds = (totalMinutes * 60) / totalCards;
    }
  }

  return {
    estimatedMinutes: Math.round((dueCardCount * avgSeconds) / 60 * 10) / 10,
    dueCards: dueCardCount,
    avgSecondsPerCard: Math.round(avgSeconds * 10) / 10,
  };
}

/**
 * Analyze past sessions to find the optimal study time of day.
 * Groups sessions by hour, returns hours ranked by average accuracy.
 */
export function getOptimalStudyTime(
  sessions: ReadonlyArray<StudySession>,
): OptimalStudyTime[] {
  const byHour = new Map<number, { totalAccuracy: number; count: number }>();

  for (const session of sessions) {
    if (session.cardsReviewed < 3) continue; // Skip trivial sessions
    const hour = new Date(session.startedAt).getUTCHours();
    const entry = byHour.get(hour) ?? { totalAccuracy: 0, count: 0 };
    entry.totalAccuracy += session.accuracy;
    entry.count++;
    byHour.set(hour, entry);
  }

  return [...byHour.entries()]
    .map(([hour, { totalAccuracy, count }]) => ({
      hour,
      avgAccuracy: Math.round((totalAccuracy / count) * 1000) / 1000,
      sessionCount: count,
    }))
    .sort((a, b) => b.avgAccuracy - a.avgAccuracy);
}

/**
 * Calculate XP earned from a study session.
 * Feeds into the competitive leagues system.
 *
 * XP formula:
 *   Base: 10 XP per card reviewed
 *   Correct bonus: +5 XP per correct answer
 *   Streak multiplier: +10% per streak day (capped at 100%)
 */
export function calculateSessionXP(
  session: StudySession,
  currentStreakDays: number,
): SessionXP {
  const baseXP = session.cardsReviewed * XP_PER_CARD;
  const correctBonus = session.correctCount * XP_CORRECT_BONUS;
  const streakMultiplier = Math.min(1, currentStreakDays * XP_STREAK_MULTIPLIER);
  const streakBonus = Math.round((baseXP + correctBonus) * streakMultiplier);

  return {
    cardsReviewed: baseXP,
    correctBonus,
    streakBonus,
    totalXP: baseXP + correctBonus + streakBonus,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────────

function buildSession(
  sorted: Array<Pick<ReviewLog, 'rating' | 'reviewedAt'>>,
): StudySession {
  const startedAt = sorted[0].reviewedAt;
  const endedAt = sorted[sorted.length - 1].reviewedAt;

  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const durationMinutes = Math.max(0.1, Math.round(((endMs - startMs) / 60_000) * 10) / 10);

  const correctCount = sorted.filter((l) => CORRECT_RATINGS.has(l.rating)).length;
  const incorrectCount = sorted.length - correctCount;
  const lapseCards = sorted.filter((l) => l.rating === 'again').length;

  return {
    startedAt,
    endedAt,
    durationMinutes,
    cardsReviewed: sorted.length,
    newCards: 0, // Determined by card queue at review time, not available from logs alone
    reviewCards: sorted.length,
    lapseCards,
    correctCount,
    incorrectCount,
    accuracy: sorted.length > 0 ? correctCount / sorted.length : 0,
  };
}
