/**
 * Workout Intelligence Engine -- 6 insight detectors, all pure functions.
 * No database access inside detectors. The orchestrator prepares data and passes it in.
 * No network calls. No external AI/ML. Pure TypeScript algorithmic detection.
 *
 * Pattern: follows nutrition/engine/insight.ts (6 detectors, pure functions, orchestrator).
 */

import type {
  WorkoutInsight,
  WorkoutInsightType,
  WorkoutInsightSeverity,
  DayWorkoutData,
  DayMoodData,
  DayNutritionData,
  DayFastingData,
  InsightInput,
} from './types';
import { MIN_DAYS_INTERNAL, MIN_DAYS_CROSS_MODULE } from './types';

// ── Math Utilities ────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(n: number): number {
  return Math.round(n * 100);
}

function insightId(type: WorkoutInsightType, key: string): string {
  return `workout:${type}:${key}`;
}

function makeInsight(
  type: WorkoutInsightType,
  severity: WorkoutInsightSeverity,
  title: string,
  body: string,
  metric: string,
  recommendation: string,
  key: string,
  data?: Record<string, unknown>,
): WorkoutInsight {
  return {
    id: insightId(type, key),
    type,
    severity,
    title,
    body,
    metric,
    recommendation,
    data,
    generatedAt: new Date().toISOString(),
  };
}

// ── Detector 1: Mood Lift Correlation (cross-module, 10 days) ────────
// "Your mood is 18% higher on days you work out."

export function detectMoodLiftCorrelation(
  workoutDays: DayWorkoutData[],
  moodDays: DayMoodData[],
): WorkoutInsight[] {
  if (workoutDays.length < MIN_DAYS_CROSS_MODULE || moodDays.length < MIN_DAYS_CROSS_MODULE) {
    return [];
  }

  const moodMap = new Map(moodDays.map((d) => [d.date, d.avgScore]));
  const workoutDayMoods: number[] = [];
  const restDayMoods: number[] = [];

  for (const day of workoutDays) {
    const mood = moodMap.get(day.date);
    if (mood == null) continue;
    if (day.didWorkout) {
      workoutDayMoods.push(mood);
    } else {
      restDayMoods.push(mood);
    }
  }

  if (workoutDayMoods.length < 3 || restDayMoods.length < 3) return [];

  const workoutAvg = average(workoutDayMoods);
  const restAvg = average(restDayMoods);
  const deltaPercent = restAvg > 0 ? ((workoutAvg - restAvg) / restAvg) * 100 : 0;

  if (Math.abs(deltaPercent) < 5) return [];

  const positive = deltaPercent > 0;
  return [makeInsight(
    'mood_lift_correlation',
    positive ? 'positive' : 'neutral',
    positive
      ? `Mood is ${pct(deltaPercent / 100)}% higher on workout days`
      : `Mood dips slightly on workout days`,
    positive
      ? `Over the last ${workoutDays.length} days, your average mood score is ${round1(workoutAvg)} on workout days vs ${round1(restAvg)} on rest days.`
      : `Your average mood is ${round1(workoutAvg)} on workout days vs ${round1(restAvg)} on rest days. This could be overtraining or timing.`,
    `${round1(workoutAvg)} vs ${round1(restAvg)}`,
    positive
      ? 'Keep it up. Consistent training correlates with better mood.'
      : 'Consider adjusting workout intensity or timing.',
    `${workoutDays.length}d`,
    { workoutAvgMood: round1(workoutAvg), restAvgMood: round1(restAvg), deltaPercent: round1(deltaPercent) },
  )];
}

// ── Detector 2: Fasting Performance (cross-module, 10 days) ──────────
// "You lift 8% less volume on fasting days."

export function detectFastingPerformance(
  workoutDays: DayWorkoutData[],
  fastingDays: DayFastingData[],
): WorkoutInsight[] {
  if (workoutDays.length < MIN_DAYS_CROSS_MODULE || fastingDays.length < MIN_DAYS_CROSS_MODULE) {
    return [];
  }

  const fastSet = new Set(fastingDays.filter((d) => d.didFast).map((d) => d.date));
  const fastedWorkouts = workoutDays.filter((d) => d.didWorkout && fastSet.has(d.date));
  const fedWorkouts = workoutDays.filter((d) => d.didWorkout && !fastSet.has(d.date));

  if (fastedWorkouts.length < 2 || fedWorkouts.length < 3) return [];

  const fastedVolume = average(fastedWorkouts.map((d) => d.totalVolumeLbs));
  const fedVolume = average(fedWorkouts.map((d) => d.totalVolumeLbs));
  const deltaPercent = fedVolume > 0 ? ((fastedVolume - fedVolume) / fedVolume) * 100 : 0;

  if (Math.abs(deltaPercent) < 5) return [];

  const fasted = deltaPercent < 0;
  return [makeInsight(
    'fasting_performance',
    fasted ? 'neutral' : 'positive',
    fasted
      ? `Volume drops ${pct(Math.abs(deltaPercent) / 100)}% on fasting days`
      : `You lift more on fasting days`,
    fasted
      ? `Average volume is ${Math.round(fastedVolume)} lbs on fasted workouts vs ${Math.round(fedVolume)} lbs when fed. This is common and may be acceptable if you're fasting for other benefits.`
      : `Average volume is ${Math.round(fastedVolume)} lbs fasted vs ${Math.round(fedVolume)} lbs fed. You perform well in a fasted state.`,
    `${Math.round(fastedVolume)} vs ${Math.round(fedVolume)} lbs`,
    fasted
      ? 'Consider scheduling heavy compound lifts on fed days.'
      : 'Fasted training works for you. Keep your current schedule.',
    `${fastingDays.length}d`,
    { fastedVolume: Math.round(fastedVolume), fedVolume: Math.round(fedVolume), deltaPercent: round1(deltaPercent) },
  )];
}

// ── Detector 3: Protein-Recovery Correlation (cross-module, 10 days) ─
// "Days with 120g+ protein show 15% more volume the next session."

export function detectProteinRecovery(
  workoutDays: DayWorkoutData[],
  nutritionDays: DayNutritionData[],
): WorkoutInsight[] {
  if (workoutDays.length < MIN_DAYS_CROSS_MODULE || nutritionDays.length < 3) return [];

  const proteinMap = new Map(nutritionDays.map((d) => [d.date, d.proteinG]));
  const workoutOnly = workoutDays.filter((d) => d.didWorkout && d.totalVolumeLbs > 0);

  if (workoutOnly.length < 4) return [];

  // For each workout, check the previous day's protein intake
  const highProteinVolumes: number[] = [];
  const lowProteinVolumes: number[] = [];
  const medianProtein = average(nutritionDays.map((d) => d.proteinG));
  const threshold = medianProtein > 0 ? medianProtein : 100;

  for (let i = 1; i < workoutOnly.length; i++) {
    const workout = workoutOnly[i];
    // Find the day before this workout
    const workoutDate = new Date(workout.date);
    workoutDate.setDate(workoutDate.getDate() - 1);
    const prevDateStr = workoutDate.toISOString().slice(0, 10);
    const prevProtein = proteinMap.get(prevDateStr);

    if (prevProtein == null) continue;

    if (prevProtein >= threshold) {
      highProteinVolumes.push(workout.totalVolumeLbs);
    } else {
      lowProteinVolumes.push(workout.totalVolumeLbs);
    }
  }

  if (highProteinVolumes.length < 2 || lowProteinVolumes.length < 2) return [];

  const highAvg = average(highProteinVolumes);
  const lowAvg = average(lowProteinVolumes);
  const deltaPercent = lowAvg > 0 ? ((highAvg - lowAvg) / lowAvg) * 100 : 0;

  if (Math.abs(deltaPercent) < 5) return [];

  const positive = deltaPercent > 0;
  return [makeInsight(
    'protein_recovery',
    positive ? 'positive' : 'neutral',
    positive
      ? `${pct(deltaPercent / 100)}% more volume after high-protein days`
      : 'Protein intake doesn\'t appear to affect your volume',
    positive
      ? `When you eat ${Math.round(threshold)}g+ protein the day before, your next workout averages ${Math.round(highAvg)} lbs total volume vs ${Math.round(lowAvg)} lbs after lower protein days.`
      : `No significant volume difference based on prior-day protein intake.`,
    `${Math.round(highAvg)} vs ${Math.round(lowAvg)} lbs`,
    positive
      ? `Aim for ${Math.round(threshold)}g+ protein on rest days before heavy training.`
      : 'Your current protein intake is consistent enough that it doesn\'t create performance swings.',
    `${nutritionDays.length}d`,
    { highProteinAvg: Math.round(highAvg), lowProteinAvg: Math.round(lowAvg), threshold: Math.round(threshold) },
  )];
}

// ── Detector 4: Consistency Momentum (internal, 7 days) ──────────────
// "You've worked out 4 of the last 7 days. Streak: 3 days."

export function detectConsistencyMomentum(
  workoutDays: DayWorkoutData[],
): WorkoutInsight[] {
  if (workoutDays.length < MIN_DAYS_INTERNAL) return [];

  const last7 = workoutDays.slice(-7);
  const last14 = workoutDays.slice(-14);
  const count7 = last7.filter((d) => d.didWorkout).length;
  const count14 = last14.filter((d) => d.didWorkout).length;

  // Calculate current streak
  let streak = 0;
  for (let i = workoutDays.length - 1; i >= 0; i--) {
    if (workoutDays[i].didWorkout) {
      streak++;
    } else {
      break;
    }
  }

  // Compare week-over-week
  const prev7 = last14.slice(0, 7);
  const prev7Count = prev7.filter((d) => d.didWorkout).length;
  const weekDelta = count7 - prev7Count;

  if (count7 === 0) {
    return [makeInsight(
      'consistency_momentum',
      'negative',
      'No workouts in the last 7 days',
      'Getting back in the gym after a break is the hardest part. Start with a light session to rebuild the habit.',
      `0 of 7 days`,
      'Schedule one workout this week. Just showing up counts.',
      'zero-week',
      { count7, streak },
    )];
  }

  let severity: WorkoutInsightSeverity = 'neutral';
  let title: string;
  if (weekDelta > 0) {
    severity = 'positive';
    title = `Momentum building: ${count7} workouts this week (up ${weekDelta})`;
  } else if (weekDelta < 0) {
    severity = 'negative';
    title = `${count7} workouts this week (down ${Math.abs(weekDelta)} from last week)`;
  } else {
    title = `Consistent: ${count7} workouts this week`;
  }

  return [makeInsight(
    'consistency_momentum',
    severity,
    title,
    streak > 0
      ? `Current streak: ${streak} day${streak > 1 ? 's' : ''}. ${count7} of last 7 days.`
      : `${count7} of last 7 days.`,
    `${count7}/7 days, streak: ${streak}`,
    count7 >= 4
      ? 'Great consistency. Make sure you\'re getting enough rest days for recovery.'
      : 'Try to hit 3-4 sessions this week for optimal progress.',
    `week-${count7}`,
    { count7, count14, streak, weekDelta },
  )];
}

// ── Detector 5: Time-of-Day Performance (internal, 7 days) ──────────
// "Your morning workouts average 12% more volume than evening ones."

export function detectTimeOfDayPerformance(
  workoutDays: DayWorkoutData[],
): WorkoutInsight[] {
  if (workoutDays.length < MIN_DAYS_INTERNAL) return [];

  const workoutOnly = workoutDays.filter((d) => d.didWorkout && d.startHour != null && d.totalVolumeLbs > 0);
  if (workoutOnly.length < 5) return [];

  // Morning = before noon, afternoon/evening = noon or later
  const morning = workoutOnly.filter((d) => d.startHour! < 12);
  const evening = workoutOnly.filter((d) => d.startHour! >= 12);

  if (morning.length < 2 || evening.length < 2) return [];

  const morningVolume = average(morning.map((d) => d.totalVolumeLbs));
  const eveningVolume = average(evening.map((d) => d.totalVolumeLbs));
  const deltaPercent = eveningVolume > 0 ? ((morningVolume - eveningVolume) / eveningVolume) * 100 : 0;

  if (Math.abs(deltaPercent) < 8) return [];

  const morningBetter = deltaPercent > 0;
  const betterTime = morningBetter ? 'morning' : 'evening';
  const betterVolume = morningBetter ? morningVolume : eveningVolume;
  const worseVolume = morningBetter ? eveningVolume : morningVolume;

  return [makeInsight(
    'time_of_day_performance',
    'positive',
    `You lift ${pct(Math.abs(deltaPercent) / 100)}% more volume in the ${betterTime}`,
    `Average volume: ${Math.round(betterVolume)} lbs (${betterTime}) vs ${Math.round(worseVolume)} lbs (${morningBetter ? 'evening' : 'morning'}). Based on ${workoutOnly.length} sessions.`,
    `${Math.round(betterVolume)} vs ${Math.round(worseVolume)} lbs`,
    `Schedule your heaviest compound lifts in the ${betterTime} when possible.`,
    `tod-${betterTime}`,
    { morningVolume: Math.round(morningVolume), eveningVolume: Math.round(eveningVolume), morningCount: morning.length, eveningCount: evening.length },
  )];
}

// ── Detector 6: Volume-Mood Feedback (cross-module, 10 days) ─────────
// "Higher workout volume correlates with better mood the next day."

export function detectVolumeMoodFeedback(
  workoutDays: DayWorkoutData[],
  moodDays: DayMoodData[],
): WorkoutInsight[] {
  if (workoutDays.length < MIN_DAYS_CROSS_MODULE || moodDays.length < MIN_DAYS_CROSS_MODULE) {
    return [];
  }

  const moodMap = new Map(moodDays.map((d) => [d.date, d.avgScore]));
  const workoutOnly = workoutDays.filter((d) => d.didWorkout && d.totalVolumeLbs > 0);

  if (workoutOnly.length < 4) return [];

  const medianVolume = average(workoutOnly.map((d) => d.totalVolumeLbs));

  // Check mood the DAY AFTER high-volume vs low-volume workouts
  const highVolumeMoods: number[] = [];
  const lowVolumeMoods: number[] = [];

  for (const workout of workoutOnly) {
    const nextDate = new Date(workout.date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const nextMood = moodMap.get(nextDateStr);

    if (nextMood == null) continue;

    if (workout.totalVolumeLbs >= medianVolume) {
      highVolumeMoods.push(nextMood);
    } else {
      lowVolumeMoods.push(nextMood);
    }
  }

  if (highVolumeMoods.length < 2 || lowVolumeMoods.length < 2) return [];

  const highAvg = average(highVolumeMoods);
  const lowAvg = average(lowVolumeMoods);
  const delta = highAvg - lowAvg;

  if (Math.abs(delta) < 0.3) return [];

  const positive = delta > 0;
  return [makeInsight(
    'volume_mood_feedback',
    positive ? 'positive' : 'neutral',
    positive
      ? 'Higher volume workouts correlate with better next-day mood'
      : 'Heavy workouts may be dragging your next-day mood',
    positive
      ? `After high-volume sessions (${Math.round(medianVolume)}+ lbs), your next-day mood averages ${round1(highAvg)} vs ${round1(lowAvg)} after lighter sessions.`
      : `After heavy sessions, your next-day mood averages ${round1(highAvg)} vs ${round1(lowAvg)} after lighter ones. You might benefit from more moderate volume.`,
    `${round1(highAvg)} vs ${round1(lowAvg)}`,
    positive
      ? 'Push hard when you can. The mood benefits compound with consistency.'
      : 'Consider scaling back volume on days you need a mood boost the next day.',
    `volume-mood`,
    { highAvgMood: round1(highAvg), lowAvgMood: round1(lowAvg), medianVolume: Math.round(medianVolume) },
  )];
}

// ── Orchestrator ─────────────────────────────────────────────────────

/**
 * Run all 6 insight detectors and return combined results.
 * Pure function: takes prepared data, returns insights.
 */
export function generateWorkoutInsights(input: InsightInput): WorkoutInsight[] {
  const insights: WorkoutInsight[] = [];

  // Internal detectors (workout data only)
  insights.push(...detectConsistencyMomentum(input.workoutDays));
  insights.push(...detectTimeOfDayPerformance(input.workoutDays));

  // Cross-module detectors
  insights.push(...detectMoodLiftCorrelation(input.workoutDays, input.moodDays));
  insights.push(...detectFastingPerformance(input.workoutDays, input.fastingDays));
  insights.push(...detectProteinRecovery(input.workoutDays, input.nutritionDays));
  insights.push(...detectVolumeMoodFeedback(input.workoutDays, input.moodDays));

  return insights;
}
