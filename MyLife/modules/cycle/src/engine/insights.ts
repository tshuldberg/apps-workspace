import type { CyclePhase, CycleStats, CyclePrediction } from '../types';

// ── Symptom Pattern Analysis ─────────────────────────────────────────

export interface SymptomPhaseEntry {
  symptom: string;
  category: string;
  phase: CyclePhase;
}

export interface SymptomPhasePattern {
  symptom: string;
  category: string;
  /** Which phase this symptom appears most in */
  dominantPhase: CyclePhase;
  /** How many times it appeared in the dominant phase */
  dominantCount: number;
  /** Total occurrences across all phases */
  totalCount: number;
  /** Fraction of occurrences in the dominant phase (0-1) */
  phaseConcentration: number;
  /** Breakdown by phase */
  byPhase: Record<CyclePhase, number>;
}

/**
 * Analyze which symptoms cluster in which cycle phases.
 * Returns patterns sorted by total count (most frequent first).
 *
 * Only includes symptoms with at least `minOccurrences` total appearances.
 *
 * @param entries - Flat list of (symptom, category, phase) tuples from logged cycle days.
 * @param minOccurrences - Minimum total occurrences to include (default 3).
 */
export function analyzeSymptomsByPhase(
  entries: SymptomPhaseEntry[],
  minOccurrences = 3,
): SymptomPhasePattern[] {
  if (entries.length === 0) return [];

  const map = new Map<string, { category: string; byPhase: Record<CyclePhase, number> }>();

  for (const { symptom, category, phase } of entries) {
    let rec = map.get(symptom);
    if (!rec) {
      rec = { category, byPhase: { menstrual: 0, follicular: 0, ovulation: 0, luteal: 0 } };
      map.set(symptom, rec);
    }
    rec.byPhase[phase]++;
  }

  const patterns: SymptomPhasePattern[] = [];

  for (const [symptom, { category, byPhase }] of map) {
    const totalCount = byPhase.menstrual + byPhase.follicular + byPhase.ovulation + byPhase.luteal;
    if (totalCount < minOccurrences) continue;

    let dominantPhase: CyclePhase = 'menstrual';
    let dominantCount = 0;
    for (const phase of ['menstrual', 'follicular', 'ovulation', 'luteal'] as CyclePhase[]) {
      if (byPhase[phase] > dominantCount) {
        dominantCount = byPhase[phase];
        dominantPhase = phase;
      }
    }

    patterns.push({
      symptom,
      category,
      dominantPhase,
      dominantCount,
      totalCount,
      phaseConcentration: Math.round((dominantCount / totalCount) * 100) / 100,
      byPhase: { ...byPhase },
    });
  }

  return patterns.sort((a, b) => b.totalCount - a.totalCount);
}

// ── Cycle Length Trend Detection ─────────────────────────────────────

export type CycleTrendDirection = 'lengthening' | 'shortening' | 'stable' | 'insufficient_data';

export interface CycleTrend {
  direction: CycleTrendDirection;
  /** Average change per cycle (positive = lengthening) */
  slopePerCycle: number;
  /** Standard deviation of cycle lengths */
  stdDev: number;
  /** Regularity score 0-1 (1 = perfectly regular) */
  regularity: number;
  /** Whether cycles are becoming more or less regular */
  regularityTrend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
}

/**
 * Detect cycle length trends using simple linear regression.
 * Requires at least 4 completed cycles for meaningful analysis.
 *
 * @param cycleLengths - Completed cycle lengths in chronological order (oldest first).
 */
export function detectCycleTrend(cycleLengths: number[]): CycleTrend {
  // Filter tracking gaps (>90 days)
  const filtered = cycleLengths.filter((l) => l > 0 && l <= 90);

  if (filtered.length < 4) {
    return {
      direction: 'insufficient_data',
      slopePerCycle: 0,
      stdDev: 0,
      regularity: 0,
      regularityTrend: 'insufficient_data',
    };
  }

  // Linear regression: y = mx + b
  const n = filtered.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += filtered[i];
    sumXY += i * filtered[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const slopePerCycle = Math.round(slope * 100) / 100;

  // Standard deviation
  const mean = sumY / n;
  const variance = filtered.reduce((s, l) => s + (l - mean) ** 2, 0) / n;
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

  // Regularity score: 1 - (stdDev / mean), clamped to [0, 1]
  const regularity = Math.max(0, Math.min(1, Math.round((1 - stdDev / mean) * 100) / 100));

  // Direction: slope threshold of 0.3 days/cycle to count as trending
  let direction: CycleTrendDirection = 'stable';
  if (slopePerCycle > 0.3) direction = 'lengthening';
  else if (slopePerCycle < -0.3) direction = 'shortening';

  // Regularity trend: compare stddev of first half vs second half
  let regularityTrend: CycleTrend['regularityTrend'] = 'stable';
  if (filtered.length >= 6) {
    const mid = Math.floor(filtered.length / 2);
    const firstHalf = filtered.slice(0, mid);
    const secondHalf = filtered.slice(mid);

    const stdDevOf = (arr: number[]): number => {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      const v = arr.reduce((s, l) => s + (l - m) ** 2, 0) / arr.length;
      return Math.sqrt(v);
    };

    const firstStd = stdDevOf(firstHalf);
    const secondStd = stdDevOf(secondHalf);
    const diff = secondStd - firstStd;

    if (diff < -0.5) regularityTrend = 'improving';
    else if (diff > 0.5) regularityTrend = 'worsening';
  }

  return { direction, slopePerCycle, stdDev, regularity, regularityTrend };
}

// ── Cycle Insight Generator ──────────────────────────────────────────

export interface CycleInsight {
  key: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate human-readable insights from cycle statistics, predictions, and trends.
 * Returns insights sorted by priority (high first).
 *
 * @param stats - Cycle statistics from getCycleStats.
 * @param prediction - Current prediction (or null if insufficient data).
 * @param trend - Cycle trend analysis (or null if insufficient data).
 * @param symptomPatterns - Symptom phase patterns (or empty array).
 * @param today - Today's date as ISO string.
 */
export function generateCycleInsights(
  stats: CycleStats,
  prediction: CyclePrediction | null,
  trend: CycleTrend | null,
  symptomPatterns: SymptomPhasePattern[],
  today: string,
): CycleInsight[] {
  const insights: CycleInsight[] = [];

  // Insufficient data insight
  if (stats.totalCycles < 2) {
    insights.push({
      key: 'needs_data',
      text: 'Log at least 2 complete cycles to unlock predictions and insights.',
      priority: 'high',
    });
    return insights;
  }

  // Prediction insight
  if (prediction) {
    if (prediction.daysUntilNextPeriod <= 0) {
      insights.push({
        key: 'period_expected',
        text: 'Your period is expected today or is late. Log your flow when it starts.',
        priority: 'high',
      });
    } else if (prediction.daysUntilNextPeriod <= 3) {
      insights.push({
        key: 'period_soon',
        text: `Your period is predicted in ${prediction.daysUntilNextPeriod} day${prediction.daysUntilNextPeriod === 1 ? '' : 's'}.`,
        priority: 'high',
      });
    } else {
      insights.push({
        key: 'next_period',
        text: `Next period predicted ${prediction.predictedStartDate} (${prediction.daysUntilNextPeriod} days). Confidence: ${Math.round(prediction.confidence * 100)}%.`,
        priority: 'medium',
      });
    }

    // Fertile window insight
    if (prediction.fertileWindowStart && prediction.fertileWindowEnd) {
      const fertileStart = new Date(prediction.fertileWindowStart + 'T00:00:00Z');
      const todayDate = new Date(today + 'T00:00:00Z');
      const fertileEnd = new Date(prediction.fertileWindowEnd + 'T00:00:00Z');

      if (todayDate >= fertileStart && todayDate <= fertileEnd) {
        insights.push({
          key: 'fertile_now',
          text: 'You are in your estimated fertile window.',
          priority: 'high',
        });
      } else if (fertileStart > todayDate) {
        const daysUntil = Math.round((fertileStart.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 5) {
          insights.push({
            key: 'fertile_soon',
            text: `Estimated fertile window starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${prediction.fertileWindowStart}).`,
            priority: 'medium',
          });
        }
      }
    }
  }

  // Regularity insight
  if (stats.averageCycleLength !== null && stats.cycleLengthStdDev !== null) {
    const cv = stats.cycleLengthStdDev / stats.averageCycleLength;
    if (cv < 0.05) {
      insights.push({
        key: 'very_regular',
        text: `Your cycles are very regular: ${stats.averageCycleLength} days on average with only ${stats.cycleLengthStdDev} days variation.`,
        priority: 'low',
      });
    } else if (cv > 0.15) {
      insights.push({
        key: 'irregular',
        text: `Your cycle length varies significantly (${stats.shortestCycle}-${stats.longestCycle} days, std dev ${stats.cycleLengthStdDev}). This is normal but may affect prediction accuracy.`,
        priority: 'medium',
      });
    }
  }

  // Trend insight
  if (trend && trend.direction !== 'insufficient_data') {
    if (trend.direction === 'lengthening') {
      insights.push({
        key: 'trend_lengthening',
        text: `Your cycles are trending longer (${trend.slopePerCycle > 0 ? '+' : ''}${trend.slopePerCycle} days per cycle).`,
        priority: 'medium',
      });
    } else if (trend.direction === 'shortening') {
      insights.push({
        key: 'trend_shortening',
        text: `Your cycles are trending shorter (${trend.slopePerCycle} days per cycle).`,
        priority: 'medium',
      });
    }

    if (trend.regularityTrend === 'improving') {
      insights.push({
        key: 'regularity_improving',
        text: 'Your cycle regularity has been improving recently.',
        priority: 'low',
      });
    } else if (trend.regularityTrend === 'worsening') {
      insights.push({
        key: 'regularity_worsening',
        text: 'Your cycle regularity has decreased recently. Stress, diet, or lifestyle changes can affect this.',
        priority: 'medium',
      });
    }
  }

  // Symptom pattern insights (top 3)
  const strongPatterns = symptomPatterns.filter((p) => p.phaseConcentration >= 0.6);
  for (const pattern of strongPatterns.slice(0, 3)) {
    const phaseName = pattern.dominantPhase;
    const pct = Math.round(pattern.phaseConcentration * 100);
    insights.push({
      key: `symptom_pattern_${pattern.symptom}`,
      text: `${formatSymptomName(pattern.symptom)} appears during your ${phaseName} phase ${pct}% of the time (${pattern.dominantCount} of ${pattern.totalCount} occurrences).`,
      priority: 'low',
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ── Phase Signal (cross-module) ──────────────────────────────────────

export interface PhaseSignal {
  phase: CyclePhase;
  dayOfCycle: number;
  cycleLength: number;
  daysUntilNextPeriod: number | null;
  isInFertileWindow: boolean;
}

/**
 * Produce a lightweight phase signal that other modules can consume.
 * This is a pure function -- the caller provides all data.
 *
 * @param cycleStartDate - Start date of current cycle (ISO string).
 * @param today - Today's date (ISO string).
 * @param avgCycleLength - User's average cycle length.
 * @param prediction - Current prediction (or null).
 */
export function getPhaseSignal(
  cycleStartDate: string,
  today: string,
  avgCycleLength: number,
  prediction: CyclePrediction | null,
): PhaseSignal {
  const start = new Date(cycleStartDate + 'T00:00:00Z');
  const now = new Date(today + 'T00:00:00Z');
  const dayOfCycle = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Phase boundaries (same logic as getCurrentPhase in prediction.ts)
  const menstrualEnd = Math.round(avgCycleLength * 0.18);
  const follicularEnd = Math.round(avgCycleLength * 0.46);
  const ovulationEnd = Math.round(avgCycleLength * 0.57);

  let phase: CyclePhase;
  if (dayOfCycle <= menstrualEnd) phase = 'menstrual';
  else if (dayOfCycle <= follicularEnd) phase = 'follicular';
  else if (dayOfCycle <= ovulationEnd) phase = 'ovulation';
  else phase = 'luteal';

  let isInFertileWindow = false;
  if (prediction?.fertileWindowStart && prediction?.fertileWindowEnd) {
    const fStart = new Date(prediction.fertileWindowStart + 'T00:00:00Z');
    const fEnd = new Date(prediction.fertileWindowEnd + 'T00:00:00Z');
    isInFertileWindow = now >= fStart && now <= fEnd;
  }

  return {
    phase,
    dayOfCycle: Math.max(1, dayOfCycle),
    cycleLength: avgCycleLength,
    daysUntilNextPeriod: prediction?.daysUntilNextPeriod ?? null,
    isInFertileWindow,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatSymptomName(symptom: string): string {
  return symptom
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
