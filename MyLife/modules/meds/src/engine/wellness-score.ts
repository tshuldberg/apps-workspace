/**
 * Wellness Score Engine
 *
 * Composite health management score (0-100) combining adherence, vitals,
 * mood stability, and symptom burden. Like a credit score for your health.
 * Pure function: takes DB adapter, returns WellnessScore object.
 */

import type { DatabaseAdapter } from '@mylife/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface ScoreComponent {
  /** Component name */
  name: string;
  /** Score 0-100 */
  score: number;
  /** Weight used in composite calculation */
  weight: number;
  /** Data points used to calculate this score */
  dataPoints: number;
  /** Human-readable explanation */
  explanation: string;
}

export interface WellnessScore {
  /** Composite score 0-100 */
  composite: number;
  /** 7-day trend direction */
  trend: TrendDirection;
  /** Individual component scores */
  components: ScoreComponent[];
  /** ISO date when score was calculated */
  calculatedAt: string;
  /** Minimum data points needed for a confident score */
  isConfident: boolean;
}

// ── Default weights ──────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  adherence: 0.40,
  vitals: 0.25,
  mood: 0.20,
  symptoms: 0.15,
};

// ── Component calculators ────────────────────────────────────────────────────

/**
 * Adherence score: 7-day medication compliance rate.
 * 100 = perfect adherence, 0 = no doses taken.
 */
function calculateAdherenceScore(db: DatabaseAdapter): ScoreComponent {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND status != 'snoozed'`,
    [sevenDaysAgo.toISOString()],
  );

  const total = rows[0]?.total ?? 0;
  const taken = rows[0]?.taken ?? 0;
  const score = total === 0 ? 100 : Math.round((taken / total) * 100);

  let explanation: string;
  if (total === 0) explanation = 'No scheduled doses in the past 7 days';
  else if (score >= 90) explanation = `Excellent: ${taken}/${total} doses taken`;
  else if (score >= 70) explanation = `Good: ${taken}/${total} doses taken, room for improvement`;
  else explanation = `Needs attention: only ${taken}/${total} doses taken`;

  return {
    name: 'Adherence',
    score,
    weight: DEFAULT_WEIGHTS.adherence,
    dataPoints: total,
    explanation,
  };
}

/**
 * Vitals score: how many readings are in normal/target range.
 * Combines BP and glucose if available.
 */
function calculateVitalsScore(db: DatabaseAdapter): ScoreComponent {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sinceISO = sevenDaysAgo.toISOString();

  let totalReadings = 0;
  let inRangeReadings = 0;

  // BP readings
  const bpRows = db.query<{ category: string }>(
    `SELECT category FROM md_bp_readings WHERE measured_at >= ?`,
    [sinceISO],
  );
  for (const row of bpRows) {
    totalReadings++;
    if (row.category === 'normal' || row.category === 'elevated') {
      inRangeReadings++;
    }
  }

  // Glucose readings
  const glucoseRows = db.query<{ range_status: string }>(
    `SELECT range_status FROM md_glucose_readings WHERE measured_at >= ?`,
    [sinceISO],
  );
  for (const row of glucoseRows) {
    totalReadings++;
    if (row.range_status === 'in_range') {
      inRangeReadings++;
    }
  }

  const score = totalReadings === 0 ? 50 : Math.round((inRangeReadings / totalReadings) * 100);

  let explanation: string;
  if (totalReadings === 0) explanation = 'No vitals recorded in the past 7 days';
  else if (score >= 90) explanation = `${inRangeReadings}/${totalReadings} readings in normal range`;
  else if (score >= 70) explanation = `${inRangeReadings}/${totalReadings} readings in range, some elevated`;
  else explanation = `Only ${inRangeReadings}/${totalReadings} readings in range, needs attention`;

  return {
    name: 'Vitals',
    score,
    weight: DEFAULT_WEIGHTS.vitals,
    dataPoints: totalReadings,
    explanation,
  };
}

/**
 * Mood stability score: inverse of mood variance over 7 days.
 * High score = stable mood, low score = volatile mood.
 */
function calculateMoodScore(db: DatabaseAdapter): ScoreComponent {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = db.query<{ pleasantness: string; intensity: number }>(
    `SELECT pleasantness, intensity FROM md_mood_entries WHERE recorded_at >= ?`,
    [sevenDaysAgo.toISOString()],
  );

  if (rows.length === 0) {
    return {
      name: 'Mood Stability',
      score: 50,
      weight: DEFAULT_WEIGHTS.mood,
      dataPoints: 0,
      explanation: 'No mood entries in the past 7 days',
    };
  }

  // Convert to numeric values: pleasant=1, unpleasant=-1
  const values = rows.map((r) => {
    const base = r.pleasantness === 'pleasant' ? 1 : r.pleasantness === 'unpleasant' ? -1 : 0;
    return base * (r.intensity / 5);
  });

  // Calculate variance
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

  // Convert variance to score: low variance = high score
  // Variance range: 0 (perfectly stable) to ~1 (extreme volatility)
  const stabilityScore = Math.round(Math.max(0, Math.min(100, (1 - variance) * 100)));

  // Also factor in overall positivity
  const positivityRate = values.filter((v) => v > 0).length / values.length;
  const positivityScore = Math.round(positivityRate * 100);

  // Blend: 60% stability, 40% positivity
  const score = Math.round(stabilityScore * 0.6 + positivityScore * 0.4);

  let explanation: string;
  if (score >= 80) explanation = `Stable and positive mood across ${rows.length} entries`;
  else if (score >= 60) explanation = `Mostly stable mood, some fluctuation in ${rows.length} entries`;
  else explanation = `Mood volatility detected across ${rows.length} entries`;

  return {
    name: 'Mood Stability',
    score,
    weight: DEFAULT_WEIGHTS.mood,
    dataPoints: rows.length,
    explanation,
  };
}

/**
 * Symptom burden score: inverse of symptom frequency and severity.
 * High score = few/mild symptoms, low score = many/severe symptoms.
 */
function calculateSymptomScore(db: DatabaseAdapter): ScoreComponent {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = db.query<{ severity: number }>(
    `SELECT severity FROM md_symptom_logs WHERE logged_at >= ?`,
    [sevenDaysAgo.toISOString()],
  );

  if (rows.length === 0) {
    return {
      name: 'Symptom Burden',
      score: 90,
      weight: DEFAULT_WEIGHTS.symptoms,
      dataPoints: 0,
      explanation: 'No symptoms logged in the past 7 days',
    };
  }

  // Average severity (1-5 scale)
  const avgSeverity = rows.reduce((s, r) => s + r.severity, 0) / rows.length;

  // Frequency penalty: more symptoms = lower score
  // Baseline: 0 symptoms/week = 100, 21+ symptoms/week = 0
  const frequencyScore = Math.max(0, Math.round(100 - (rows.length / 21) * 100));

  // Severity score: avg 1 = 100, avg 5 = 0
  const severityScore = Math.round(((5 - avgSeverity) / 4) * 100);

  // Blend: 50% frequency, 50% severity
  const score = Math.round(frequencyScore * 0.5 + severityScore * 0.5);

  let explanation: string;
  if (score >= 80) explanation = `Low symptom burden: ${rows.length} logs, avg severity ${avgSeverity.toFixed(1)}/5`;
  else if (score >= 50) explanation = `Moderate symptoms: ${rows.length} logs, avg severity ${avgSeverity.toFixed(1)}/5`;
  else explanation = `High symptom burden: ${rows.length} logs, avg severity ${avgSeverity.toFixed(1)}/5`;

  return {
    name: 'Symptom Burden',
    score,
    weight: DEFAULT_WEIGHTS.symptoms,
    dataPoints: rows.length,
    explanation,
  };
}

// ── Trend calculation ────────────────────────────────────────────────────────

function calculateTrend(db: DatabaseAdapter): TrendDirection {
  // Compare this week's adherence to last week's
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const thisWeek = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND status != 'snoozed'`,
    [sevenDaysAgo.toISOString()],
  );

  const lastWeek = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND scheduled_time < ? AND status != 'snoozed'`,
    [fourteenDaysAgo.toISOString(), sevenDaysAgo.toISOString()],
  );

  const thisRate = thisWeek[0].total > 0 ? thisWeek[0].taken / thisWeek[0].total : 1;
  const lastRate = lastWeek[0].total > 0 ? lastWeek[0].taken / lastWeek[0].total : 1;

  const diff = thisRate - lastRate;
  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Calculate the composite wellness score.
 */
export function getWellnessScore(db: DatabaseAdapter): WellnessScore {
  const components = [
    calculateAdherenceScore(db),
    calculateVitalsScore(db),
    calculateMoodScore(db),
    calculateSymptomScore(db),
  ];

  // Weighted composite
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const composite = Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight,
  );

  // Confidence: need at least 7 dose logs + 1 vitals reading
  const totalDataPoints = components.reduce((s, c) => s + c.dataPoints, 0);
  const isConfident = totalDataPoints >= 8;

  return {
    composite,
    trend: calculateTrend(db),
    components,
    calculatedAt: new Date().toISOString(),
    isConfident,
  };
}
