/**
 * Breathing exercise engine.
 * Defines 5 breathing patterns and session utility functions.
 */

import type { BreathingPattern, BreathingPatternConfig, BreathingStats, BreathingSession } from '../types';

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

export const BREATHING_PATTERNS: Record<BreathingPattern, BreathingPatternConfig> = {
  box: {
    name: 'Box Breathing',
    description: 'Calm and focus',
    inhale: 4, hold1: 4, exhale: 4, hold2: 4,
    defaultCycles: 8,
  },
  '478': {
    name: '4-7-8 Breathing',
    description: 'Deep relaxation',
    inhale: 4, hold1: 7, exhale: 8, hold2: 0,
    defaultCycles: 6,
  },
  relaxing: {
    name: 'Relaxing Breath',
    description: 'Gentle wind-down',
    inhale: 4, hold1: 7, exhale: 8, hold2: 0,
    defaultCycles: 8,
  },
  energizing: {
    name: 'Energizing Breath',
    description: 'Wake up and energize',
    inhale: 2, hold1: 2, exhale: 4, hold2: 2,
    defaultCycles: 10,
  },
  sleep: {
    name: 'Sleep Breath',
    description: 'Fall asleep',
    inhale: 4, hold1: 7, exhale: 8, hold2: 0,
    defaultCycles: 10,
  },
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export function getPatternConfig(pattern: BreathingPattern): BreathingPatternConfig {
  return BREATHING_PATTERNS[pattern];
}

export function calculateSessionDuration(pattern: BreathingPattern, cycles: number): number {
  const config = BREATHING_PATTERNS[pattern];
  const cycleDuration = config.inhale + config.hold1 + config.exhale + config.hold2;
  return cycleDuration * cycles;
}

export function calculateMoodDelta(
  moodBefore: number | null,
  moodAfter: number | null,
): number | null {
  if (moodBefore === null || moodAfter === null) return null;
  return moodAfter - moodBefore;
}

export function getBreathingStats(sessions: BreathingSession[]): BreathingStats {
  if (sessions.length === 0) {
    return { totalSessions: 0, totalMinutes: 0, favoritePattern: null, averageMoodImprovement: null };
  }

  const totalMinutes = Math.round(sessions.reduce((s, e) => s + e.duration_seconds, 0) / 60);

  // Favorite pattern
  const counts = new Map<BreathingPattern, number>();
  for (const s of sessions) {
    counts.set(s.pattern, (counts.get(s.pattern) ?? 0) + 1);
  }
  let favoritePattern: BreathingPattern | null = null;
  let maxCount = 0;
  for (const [p, c] of counts) {
    if (c > maxCount) { maxCount = c; favoritePattern = p; }
  }

  // Average mood improvement
  const deltas: number[] = [];
  for (const s of sessions) {
    const d = calculateMoodDelta(s.mood_before, s.mood_after);
    if (d !== null) deltas.push(d);
  }
  const averageMoodImprovement = deltas.length > 0
    ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
    : null;

  return { totalSessions: sessions.length, totalMinutes, favoritePattern, averageMoodImprovement };
}
