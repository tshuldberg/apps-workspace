/**
 * Craving analysis engine.
 * Pure functions for analyzing craving patterns and trigger frequency.
 */

import type {
  Craving,
  CravingTrigger,
  TriggerFrequency,
  IntensityTrendPoint,
  PeakTimeSlot,
  CopingEffectiveness,
  TriggerCategory,
} from '../types';

/** Preset trigger catalog organized by category. */
export const PRESET_TRIGGERS: Array<{ name: string; category: TriggerCategory }> = [
  // Emotional
  { name: 'Stress', category: 'emotional' },
  { name: 'Anxiety', category: 'emotional' },
  { name: 'Boredom', category: 'emotional' },
  { name: 'Sadness', category: 'emotional' },
  { name: 'Anger', category: 'emotional' },
  { name: 'Loneliness', category: 'emotional' },
  // Social
  { name: 'Party', category: 'social' },
  { name: 'Friends drinking', category: 'social' },
  { name: 'Peer pressure', category: 'social' },
  { name: 'Celebration', category: 'social' },
  // Environmental
  { name: 'Walking past a bar', category: 'environmental' },
  { name: 'Smell', category: 'environmental' },
  { name: 'TV ad', category: 'environmental' },
  { name: 'Store', category: 'environmental' },
  // Physical
  { name: 'Hunger', category: 'physical' },
  { name: 'Fatigue', category: 'physical' },
  { name: 'Pain', category: 'physical' },
  { name: 'Withdrawal', category: 'physical' },
  // Routine
  { name: 'After meal', category: 'routine' },
  { name: 'Morning coffee', category: 'routine' },
  { name: 'Driving', category: 'routine' },
  { name: 'Work break', category: 'routine' },
];

/** Coping strategy presets. */
export const PRESET_COPING_STRATEGIES = [
  'Deep breathing',
  'Walked away',
  'Called someone',
  'Drank water',
  'Waited it out',
  'Exercise',
  'Meditation',
];

/**
 * Analyze trigger frequency from craving triggers.
 * Returns triggers sorted by frequency descending.
 */
export function analyzeTriggerFrequency(triggers: CravingTrigger[]): TriggerFrequency[] {
  if (triggers.length === 0) return [];

  const countMap = new Map<string, { category: TriggerCategory; count: number }>();
  for (const t of triggers) {
    const key = t.triggerName.toLowerCase().trim();
    const existing = countMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      countMap.set(key, { category: t.triggerCategory, count: 1 });
    }
  }

  return Array.from(countMap.entries())
    .map(([name, data]) => ({
      triggerName: name,
      category: data.category,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze intensity trends over time.
 * Groups cravings by week and returns average intensity per week.
 */
export function analyzeIntensityTrend(cravings: Craving[]): IntensityTrendPoint[] {
  if (cravings.length === 0) return [];

  const weekMap = new Map<string, { total: number; count: number }>();
  for (const c of cravings) {
    const date = new Date(c.loggedAt);
    // Get Monday of the week
    const dayOfWeek = date.getUTCDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - diff);
    const weekKey = monday.toISOString().slice(0, 10);

    const existing = weekMap.get(weekKey);
    if (existing) {
      existing.total += c.intensity;
      existing.count++;
    } else {
      weekMap.set(weekKey, { total: c.intensity, count: 1 });
    }
  }

  return Array.from(weekMap.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      averageIntensity: Math.round((data.total / data.count) * 10) / 10,
      count: data.count,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Analyze peak craving times by hour of day.
 * Returns 24 buckets (0-23) with craving counts.
 */
export function analyzePeakTimes(cravings: Craving[]): PeakTimeSlot[] {
  const hourCounts = new Array(24).fill(0) as number[];
  for (const c of cravings) {
    const hour = new Date(c.loggedAt).getUTCHours();
    hourCounts[hour]++;
  }
  return hourCounts.map((count, hour) => ({ hour, count }));
}

/**
 * Analyze coping strategy effectiveness.
 * Returns outcome counts and resist rate.
 */
export function analyzeCopingEffectiveness(cravings: Craving[]): CopingEffectiveness {
  const result: CopingEffectiveness = {
    resisted: 0,
    gaveIn: 0,
    distracted: 0,
    delayed: 0,
    total: 0,
    resistRate: 0,
  };

  for (const c of cravings) {
    if (!c.outcome) continue;
    result.total++;
    switch (c.outcome) {
      case 'resisted': result.resisted++; break;
      case 'gave_in': result.gaveIn++; break;
      case 'distracted': result.distracted++; break;
      case 'delayed': result.delayed++; break;
    }
  }

  result.resistRate = result.total > 0
    ? Math.round((result.resisted / result.total) * 100)
    : 0;

  return result;
}

/** Normalize a trigger name for deduplication. */
export function normalizeTriggerName(name: string): string {
  return name.toLowerCase().trim();
}
