/**
 * Training activity summary engine for MySports.
 *
 * Pure TypeScript -- zero DB access, zero React imports, zero `Date.now()`.
 * Mirrors the pure-engine precedent set by `generateYearInReview` in
 * year-in-review.ts and `computePredictionAccuracy` in prediction-accuracy.ts.
 *
 * Design decisions:
 *   1. The caller supplies the time window (`TrainingWindow`). Same inputs
 *      always produce the same output; no clock reads.
 *   2. Filtering uses half-open intervals `[startMs, endMs)`. A row at
 *      `endMs` is excluded.
 *   3. `bySport` is grouped by `session.sport` (case-sensitive as stored).
 *      `sessionCount` is count of in-window sessions, `totalMinutes` sums
 *      `duration_minutes` (null treated as 0), `lastSessionAt` is the max
 *      `started_at`, `personalBestCount` counts rows where `personal_best`
 *      is truthy. Sort is `sessionCount` desc then `sport` asc for
 *      determinism.
 *   4. `byWeek` buckets by the Monday-00:00:00-UTC preceding each
 *      `started_at`. Weeks with zero included sessions are omitted. Sort
 *      is ascending by `weekStartMs`.
 *   5. `sportsPracticed` is the distinct count of `sport` values across
 *      in-window sessions.
 *   6. This is data layer only. No UI, no Workouts or Health edits, no
 *      injury schema -- those are separate follow-up cards.
 */

import type { ParticipationSession } from '../types';

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

/** Half-open time window `[startMs, endMs)`. */
export interface TrainingWindow {
  startMs: number;
  endMs: number;
}

export interface TrainingSummaryInput {
  window: TrainingWindow;
  sessions: readonly ParticipationSession[];
}

export interface TrainingBySport {
  sport: string;
  sessionCount: number;
  totalMinutes: number;
  personalBestCount: number;
  lastSessionAt: number | null;
}

export interface TrainingByWeek {
  weekStartMs: number;
  sessionCount: number;
  totalMinutes: number;
}

export interface TrainingSummary {
  window: TrainingWindow;
  totalSessions: number;
  totalMinutes: number;
  sportsPracticed: number;
  bySport: ReadonlyArray<TrainingBySport>;
  byWeek: ReadonlyArray<TrainingByWeek>;
  lastSessionAt: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function inWindow(ts: number, window: TrainingWindow): boolean {
  return ts >= window.startMs && ts < window.endMs;
}

/**
 * Return the epoch ms for the Monday 00:00:00 UTC that is the start of the
 * ISO-week containing `ts`. JavaScript's `Date.prototype.getUTCDay` returns
 * 0 for Sunday through 6 for Saturday. Monday has index 1, so the offset to
 * the preceding Monday is `(day + 6) % 7` days -- Monday yields 0, Tuesday
 * yields 1, ... Sunday yields 6.
 */
function mondayStartUtc(ts: number): number {
  const d = new Date(ts);
  const utcYear = d.getUTCFullYear();
  const utcMonth = d.getUTCMonth();
  const utcDate = d.getUTCDate();
  const utcDay = d.getUTCDay(); // 0..6 with Sunday = 0
  const midnightUtc = Date.UTC(utcYear, utcMonth, utcDate, 0, 0, 0, 0);
  const daysSinceMonday = (utcDay + 6) % 7;
  return midnightUtc - daysSinceMonday * DAY_MS;
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

/**
 * Compute a training activity summary from the supplied input.
 * Deterministic: same inputs produce the same output. No network, no clock
 * reads, no mutation of input arrays.
 */
export function summarizeTraining(
  input: TrainingSummaryInput,
): TrainingSummary {
  const { window } = input;
  const sessionsInWindow = input.sessions.filter((s) =>
    inWindow(s.started_at, window),
  );

  const totalSessions = sessionsInWindow.length;
  const totalMinutes = sessionsInWindow.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0,
  );

  // ─ bySport ────────────────────────────────────────────────────────────
  const bySportMap = new Map<string, TrainingBySport>();
  for (const s of sessionsInWindow) {
    const existing = bySportMap.get(s.sport);
    if (existing) {
      existing.sessionCount += 1;
      existing.totalMinutes += s.duration_minutes ?? 0;
      if (s.personal_best) existing.personalBestCount += 1;
      if (
        existing.lastSessionAt === null ||
        s.started_at > existing.lastSessionAt
      ) {
        existing.lastSessionAt = s.started_at;
      }
    } else {
      bySportMap.set(s.sport, {
        sport: s.sport,
        sessionCount: 1,
        totalMinutes: s.duration_minutes ?? 0,
        personalBestCount: s.personal_best ? 1 : 0,
        lastSessionAt: s.started_at,
      });
    }
  }
  const bySport: TrainingBySport[] = Array.from(bySportMap.values()).sort(
    (a, b) => {
      if (b.sessionCount !== a.sessionCount) {
        return b.sessionCount - a.sessionCount;
      }
      if (a.sport < b.sport) return -1;
      if (a.sport > b.sport) return 1;
      return 0;
    },
  );

  const sportsPracticed = bySportMap.size;

  // ─ byWeek ─────────────────────────────────────────────────────────────
  const byWeekMap = new Map<number, TrainingByWeek>();
  for (const s of sessionsInWindow) {
    const weekStartMs = mondayStartUtc(s.started_at);
    const existing = byWeekMap.get(weekStartMs);
    if (existing) {
      existing.sessionCount += 1;
      existing.totalMinutes += s.duration_minutes ?? 0;
    } else {
      byWeekMap.set(weekStartMs, {
        weekStartMs,
        sessionCount: 1,
        totalMinutes: s.duration_minutes ?? 0,
      });
    }
  }
  const byWeek: TrainingByWeek[] = Array.from(byWeekMap.values()).sort(
    (a, b) => a.weekStartMs - b.weekStartMs,
  );

  // ─ lastSessionAt (across all sports) ──────────────────────────────────
  let lastSessionAt: number | null = null;
  for (const s of sessionsInWindow) {
    if (lastSessionAt === null || s.started_at > lastSessionAt) {
      lastSessionAt = s.started_at;
    }
  }

  return {
    window,
    totalSessions,
    totalMinutes,
    sportsPracticed,
    bySport,
    byWeek,
    lastSessionAt,
  };
}

// WEEK_MS is exported only for test introspection; the aggregator does not
// use it directly (the bucketing math relies on day offsets from the UTC
// midnight of the session day).
export { WEEK_MS };
