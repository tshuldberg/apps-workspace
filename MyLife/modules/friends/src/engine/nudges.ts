// ── Nudge / Drift Detection Engine ──────────────────────────────────
// Pure functions for detecting relationship drift and generating nudges.
// No DB calls, no side effects. Takes data in, returns computed results.

const MS_PER_DAY = 86_400_000;

// ── Types ──────────────────────────────────────────────────────────

export interface DriftInfo {
  personId: string;
  historicalAvgDays: number;
  currentGapDays: number;
  driftRatio: number; // currentGap / historicalAvg
  message: string;
}

export interface NudgeSettings {
  nudgeEnabled: boolean;
  driftDetectionEnabled: boolean;
  defaultThresholdDays: number; // default 30
}

export type NudgeType = 'havent_seen' | 'birthday_coming' | 'anniversary';
export type NudgeUrgency = 'low' | 'medium' | 'high';

export interface PendingNudge {
  personId: string;
  personName: string;
  type: NudgeType;
  message: string;
  urgency: NudgeUrgency;
}

// ── Drift Detection ────────────────────────────────────────────────

/**
 * Detect drift for a single person based on their hangout history.
 *
 * Algorithm:
 * - Need at least 3 hangouts to detect patterns
 * - Only considers hangouts within the last 6 months
 * - Calculate average gap between consecutive hangouts
 * - If current gap (days since most recent hangout) > 2x average gap, return drift info
 * - Returns null when insufficient data or no drift detected
 */
export function detectDrift(
  personName: string,
  personId: string,
  hangoutDates: string[], // ISO dates, sorted desc (most recent first)
  now: Date = new Date(),
): DriftInfo | null {
  if (hangoutDates.length < 3) return null;

  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Filter to hangouts within last 6 months, parse to timestamps
  const recentTimestamps = hangoutDates
    .map((d) => new Date(d).getTime())
    .filter((ts) => ts >= sixMonthsAgo.getTime())
    .sort((a, b) => b - a); // desc

  if (recentTimestamps.length < 3) return null;

  // Calculate gaps between consecutive hangouts (in days)
  const gaps: number[] = [];
  for (let i = 0; i < recentTimestamps.length - 1; i++) {
    const gapMs = recentTimestamps[i] - recentTimestamps[i + 1];
    gaps.push(Math.floor(gapMs / MS_PER_DAY));
  }

  const avgGapDays = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  if (avgGapDays === 0) return null;

  const currentGapDays = Math.floor(
    (now.getTime() - recentTimestamps[0]) / MS_PER_DAY,
  );
  const driftRatio = currentGapDays / avgGapDays;

  if (driftRatio <= 2) return null;

  return {
    personId,
    historicalAvgDays: Math.round(avgGapDays),
    currentGapDays,
    driftRatio: Math.round(driftRatio * 100) / 100,
    message: generateDriftMessage(personName, Math.round(avgGapDays), currentGapDays),
  };
}

// ── Nudge Decision ─────────────────────────────────────────────────

/**
 * Determine if a person should receive a nudge.
 * True if: daysSince >= (goalDays ?? defaultThresholdDays).
 * Returns false if daysSince is null (never seen, handled separately).
 */
export function shouldNudge(
  daysSinceLastSeen: number | null,
  frequencyGoalDays: number | null,
  defaultThresholdDays: number,
): boolean {
  if (daysSinceLastSeen === null) return false;
  const threshold = frequencyGoalDays ?? defaultThresholdDays;
  return daysSinceLastSeen >= threshold;
}

// ── Message Generation ────────────────────────────────────────────

/**
 * Generate a human-friendly drift message.
 */
export function generateDriftMessage(
  name: string,
  avgDays: number,
  currentDays: number,
): string {
  const avgLabel = formatDayRange(avgDays);
  return `You used to see ${name} every ~${avgLabel}. It's been ${currentDays} days.`;
}

/**
 * Format a number of days into a human-readable range label.
 */
function formatDayRange(days: number): string {
  if (days < 7) return `${days} days`;
  if (days < 14) return '1 week';
  if (days < 28) return `${Math.round(days / 7)} weeks`;
  if (days < 60) return '1 month';
  return `${Math.round(days / 30)} months`;
}

// ── Urgency ────────────────────────────────────────────────────────

/**
 * Determine nudge urgency based on how far past the goal we are.
 *
 * - high:   > 2x goal
 * - medium: 1x - 2x goal (inclusive of exactly 1x)
 * - low:    0.7x - 1x goal (exclusive of 1x)
 */
export function getNudgeUrgency(
  daysSince: number,
  goalDays: number,
): NudgeUrgency {
  const ratio = daysSince / goalDays;
  if (ratio > 2) return 'high';
  if (ratio >= 1) return 'medium';
  return 'low';
}
