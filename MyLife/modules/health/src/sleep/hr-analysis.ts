/**
 * Heart rate during sleep analysis engine.
 * Correlates HR vitals from hl_vitals with sleep sessions from hl_sleep_sessions.
 * Pure functions, no side effects.
 */

import type { SleepHeartRatePoint, SleepHeartRateAnalysis, SleepStage } from '../types';

export interface HrReading {
  value: number;
  recorded_at: string;
}

export interface SleepWindow {
  start_time: string;
  end_time: string;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  duration_minutes: number;
}

/**
 * Filter HR readings that fall within a sleep session window.
 */
export function getSleepHeartRateData(
  hrReadings: HrReading[],
  sleepWindow: SleepWindow,
): SleepHeartRatePoint[] {
  const start = new Date(sleepWindow.start_time).getTime();
  const end = new Date(sleepWindow.end_time).getTime();

  return hrReadings
    .filter((r) => {
      const t = new Date(r.recorded_at).getTime();
      return t >= start && t <= end;
    })
    .map((r) => ({
      timestamp: r.recorded_at,
      bpm: r.value,
      stage: mapTimestampToStage(r.recorded_at, sleepWindow),
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Approximate which sleep stage a timestamp falls into by distributing
 * stage durations proportionally across the sleep window.
 * Order: deep -> rem -> light -> awake (typical sleep cycle structure).
 */
export function mapTimestampToStage(
  timestamp: string,
  window: SleepWindow,
): SleepStage | null {
  const deep = window.deep_minutes ?? 0;
  const rem = window.rem_minutes ?? 0;
  const light = window.light_minutes ?? 0;
  const awake = window.awake_minutes ?? 0;

  if (deep === 0 && rem === 0 && light === 0 && awake === 0) return null;

  const total = deep + rem + light + awake;
  if (total <= 0) return null;

  const start = new Date(window.start_time).getTime();
  const end = new Date(window.end_time).getTime();
  const t = new Date(timestamp).getTime();

  const elapsed = (t - start) / (end - start);

  const deepEnd = deep / total;
  const remEnd = deepEnd + rem / total;
  const lightEnd = remEnd + light / total;

  if (elapsed < deepEnd) return 'deep';
  if (elapsed < remEnd) return 'rem';
  if (elapsed < lightEnd) return 'light';
  return 'awake';
}

/**
 * Get per-stage average HR from data points.
 */
export function getStageAverages(
  dataPoints: SleepHeartRatePoint[],
): { deep: number | null; rem: number | null; light: number | null; awake: number | null } {
  const stages: Record<SleepStage, number[]> = {
    deep: [],
    rem: [],
    light: [],
    awake: [],
  };

  for (const p of dataPoints) {
    if (p.stage) stages[p.stage].push(p.bpm);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    deep: avg(stages.deep),
    rem: avg(stages.rem),
    light: avg(stages.light),
    awake: avg(stages.awake),
  };
}

/**
 * Calculate the HR dip: percentage drop from daytime average to sleep average.
 * Typical healthy dip is 10-20%.
 */
export function calculateHrDip(daytimeAvgBpm: number, sleepAvgBpm: number): number {
  if (daytimeAvgBpm <= 0) return 0;
  return Math.round(((daytimeAvgBpm - sleepAvgBpm) / daytimeAvgBpm) * 1000) / 10;
}

/**
 * Full sleep HR analysis from raw data.
 */
export function calculateSleepHrAnalysis(
  hrReadings: HrReading[],
  sleepWindow: SleepWindow,
  daytimeAvgBpm: number | null,
  restingBpm: number | null,
): SleepHeartRateAnalysis | null {
  const dataPoints = getSleepHeartRateData(hrReadings, sleepWindow);

  if (dataPoints.length === 0) return null;

  const bpmValues = dataPoints.map((p) => p.bpm);
  const averageBpm = Math.round((bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length) * 10) / 10;
  const lowestBpm = Math.min(...bpmValues);
  const highestBpm = Math.max(...bpmValues);

  const lowestPoint = dataPoints.find((p) => p.bpm === lowestBpm)!;

  const hrDip = daytimeAvgBpm != null ? calculateHrDip(daytimeAvgBpm, averageBpm) : 0;

  return {
    averageBpm,
    lowestBpm,
    lowestBpmAt: lowestPoint.timestamp,
    highestBpm,
    restingBpm,
    hrDip,
    dataPoints,
    stageAverages: getStageAverages(dataPoints),
  };
}
