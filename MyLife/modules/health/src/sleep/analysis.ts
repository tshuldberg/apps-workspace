/**
 * Sleep stage analysis engine.
 * Analyzes existing sleep session data for stage breakdown, targets, and trends.
 */

import type { SleepStageBreakdown, SleepStageTarget, SleepAnalysis } from '../types';

// Target ranges (percent of total sleep time)
const TARGETS = {
  deep:  { min: 13, max: 23 },
  rem:   { min: 20, max: 25 },
  light: { min: 45, max: 55 },
};

export interface SleepSessionInput {
  duration_minutes: number;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
}

function safePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function calculateStageBreakdown(session: SleepSessionInput): SleepStageBreakdown | null {
  const deep = session.deep_minutes ?? 0;
  const rem = session.rem_minutes ?? 0;
  const light = session.light_minutes ?? 0;
  const awake = session.awake_minutes ?? 0;

  // If no stage data at all, return null
  if (deep === 0 && rem === 0 && light === 0 && awake === 0 &&
      session.deep_minutes === null && session.rem_minutes === null) {
    return null;
  }

  const total = deep + rem + light + awake;
  const totalSleep = total - awake;

  return {
    deepPercent: safePercent(deep, total),
    remPercent: safePercent(rem, total),
    lightPercent: safePercent(light, total),
    awakePercent: safePercent(awake, total),
    deepMinutes: deep,
    remMinutes: rem,
    lightMinutes: light,
    awakeMinutes: awake,
    totalSleepMinutes: Math.max(totalSleep, 0),
  };
}

function getTargetStatus(actual: number, min: number, max: number): 'low' | 'normal' | 'high' {
  if (actual < min) return 'low';
  if (actual > max) return 'high';
  return 'normal';
}

export function evaluateStageTargets(breakdown: SleepStageBreakdown): SleepStageTarget[] {
  return [
    {
      stage: 'deep',
      targetMinPercent: TARGETS.deep.min,
      targetMaxPercent: TARGETS.deep.max,
      actualPercent: breakdown.deepPercent,
      status: getTargetStatus(breakdown.deepPercent, TARGETS.deep.min, TARGETS.deep.max),
    },
    {
      stage: 'rem',
      targetMinPercent: TARGETS.rem.min,
      targetMaxPercent: TARGETS.rem.max,
      actualPercent: breakdown.remPercent,
      status: getTargetStatus(breakdown.remPercent, TARGETS.rem.min, TARGETS.rem.max),
    },
    {
      stage: 'light',
      targetMinPercent: TARGETS.light.min,
      targetMaxPercent: TARGETS.light.max,
      actualPercent: breakdown.lightPercent,
      status: getTargetStatus(breakdown.lightPercent, TARGETS.light.min, TARGETS.light.max),
    },
  ];
}

export function calculateSleepEfficiency(totalMinutes: number, awakeMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return Math.round(((totalMinutes - awakeMinutes) / totalMinutes) * 100);
}

/**
 * Determine trend from a series of efficiency values (oldest to newest).
 */
export function determineSleepTrend(
  efficiencies: number[],
): 'improving' | 'stable' | 'declining' {
  if (efficiencies.length < 3) return 'stable';
  const mid = Math.floor(efficiencies.length / 2);
  const firstHalf = efficiencies.slice(0, mid);
  const secondHalf = efficiencies.slice(mid);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;
  if (diff > 3) return 'improving';
  if (diff < -3) return 'declining';
  return 'stable';
}

export function analyzeSleepSession(
  session: SleepSessionInput,
  recentEfficiencies?: number[],
): SleepAnalysis | null {
  const breakdown = calculateStageBreakdown(session);
  if (!breakdown) return null;

  const targets = evaluateStageTargets(breakdown);
  const awake = session.awake_minutes ?? 0;
  const total = session.duration_minutes;
  const sleepEfficiency = calculateSleepEfficiency(total, awake);
  const trend = recentEfficiencies
    ? determineSleepTrend(recentEfficiencies)
    : 'stable';

  return { breakdown, targets, sleepEfficiency, trend };
}
