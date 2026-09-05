import type { BPReading, BPCategory, BPCategoryDistribution } from '../models/bp-reading';
import { calculateBPAverages, getCategoryDistribution } from './engine';

export interface BPTrendPoint {
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  category: BPCategory;
}

export interface BPPeriodStats {
  avgSystolic: number;
  avgDiastolic: number;
  avgPulse: number | null;
  minSystolic: number;
  maxSystolic: number;
  minDiastolic: number;
  maxDiastolic: number;
  readingCount: number;
  categoryDistribution: BPCategoryDistribution;
  trendDirection: 'improving' | 'stable' | 'worsening';
}

export interface BPPeriodComparison {
  current: BPPeriodStats;
  previous: BPPeriodStats;
  systolicDelta: number;
  diastolicDelta: number;
  categoryShift: string;
}

/**
 * Convert readings into sorted trend points.
 */
export function getBPTrendData(readings: BPReading[]): BPTrendPoint[] {
  return [...readings]
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .map((r) => ({
      date: r.measuredAt,
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      category: r.category,
    }));
}

/**
 * Calculate period statistics from a set of readings.
 */
export function getBPPeriodStats(readings: BPReading[]): BPPeriodStats {
  if (readings.length === 0) {
    return {
      avgSystolic: 0, avgDiastolic: 0, avgPulse: null,
      minSystolic: 0, maxSystolic: 0, minDiastolic: 0, maxDiastolic: 0,
      readingCount: 0,
      categoryDistribution: { normal: 0, elevated: 0, hypertension_1: 0, hypertension_2: 0, crisis: 0 },
      trendDirection: 'stable',
    };
  }

  const avg = calculateBPAverages(readings);
  const dist = getCategoryDistribution(readings);

  let minSys = Infinity, maxSys = -Infinity;
  let minDia = Infinity, maxDia = -Infinity;
  for (const r of readings) {
    if (r.systolic < minSys) minSys = r.systolic;
    if (r.systolic > maxSys) maxSys = r.systolic;
    if (r.diastolic < minDia) minDia = r.diastolic;
    if (r.diastolic > maxDia) maxDia = r.diastolic;
  }

  const direction = calculateTrendDirection(readings);

  return {
    avgSystolic: avg.systolic,
    avgDiastolic: avg.diastolic,
    avgPulse: avg.pulse,
    minSystolic: minSys,
    maxSystolic: maxSys,
    minDiastolic: minDia,
    maxDiastolic: maxDia,
    readingCount: readings.length,
    categoryDistribution: dist,
    trendDirection: direction,
  };
}

/**
 * Determine trend direction by comparing first-half to second-half averages.
 */
export function calculateTrendDirection(
  readings: BPReading[],
): 'improving' | 'stable' | 'worsening' {
  if (readings.length < 4) return 'stable';

  const sorted = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const avgFirst = calculateBPAverages(firstHalf);
  const avgSecond = calculateBPAverages(secondHalf);

  const delta = avgSecond.systolic - avgFirst.systolic;
  if (delta < -5) return 'improving';
  if (delta > 5) return 'worsening';
  return 'stable';
}

/**
 * Compare two periods of BP readings.
 */
export function comparePeriods(
  current: BPReading[],
  previous: BPReading[],
): BPPeriodComparison | null {
  if (current.length === 0 || previous.length === 0) return null;

  const currentStats = getBPPeriodStats(current);
  const previousStats = getBPPeriodStats(previous);

  return {
    current: currentStats,
    previous: previousStats,
    systolicDelta: currentStats.avgSystolic - previousStats.avgSystolic,
    diastolicDelta: currentStats.avgDiastolic - previousStats.avgDiastolic,
    categoryShift: describeCategoryShift(previousStats, currentStats),
  };
}

function describeCategoryShift(prev: BPPeriodStats, curr: BPPeriodStats): string {
  const prevTop = getTopCategory(prev.categoryDistribution);
  const currTop = getTopCategory(curr.categoryDistribution);
  if (prevTop === currTop) return `Stable at ${formatCategory(currTop)}`;
  return `${formatCategory(prevTop)} to ${formatCategory(currTop)}`;
}

function getTopCategory(dist: BPCategoryDistribution): BPCategory {
  let top: BPCategory = 'normal';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(dist)) {
    if (count > maxCount) { maxCount = count; top = cat as BPCategory; }
  }
  return top;
}

function formatCategory(cat: BPCategory): string {
  const labels: Record<BPCategory, string> = {
    normal: 'Normal', elevated: 'Elevated', hypertension_1: 'Stage 1',
    hypertension_2: 'Stage 2', crisis: 'Crisis',
  };
  return labels[cat];
}

/**
 * Aggregate daily readings to weekly averages for long time periods.
 */
export function aggregateToWeekly(
  readings: BPReading[],
): BPTrendPoint[] {
  if (readings.length === 0) return [];

  const sorted = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const weeks: Map<string, BPReading[]> = new Map();

  for (const r of sorted) {
    const d = new Date(r.measuredAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split('T')[0];
    const existing = weeks.get(key) ?? [];
    existing.push(r);
    weeks.set(key, existing);
  }

  const result: BPTrendPoint[] = [];
  for (const [weekKey, weekReadings] of weeks) {
    const avg = calculateBPAverages(weekReadings);
    result.push({
      date: weekKey,
      systolic: avg.systolic,
      diastolic: avg.diastolic,
      pulse: avg.pulse,
      category: weekReadings[Math.floor(weekReadings.length / 2)].category,
    });
  }
  return result;
}
