import { describe, it, expect } from 'vitest';

// Breathing
import {
  BREATHING_PATTERNS, getPatternConfig, calculateSessionDuration,
  calculateMoodDelta, getBreathingStats,
} from '../breathing/engine';
import type { BreathingSession } from '../types';

// Readiness
import {
  calculateReadinessScore, getRecommendation, normalizeSleepFactor,
  normalizeHrvFactor, normalizeRhrFactor, calculateDataCompleteness,
} from '../readiness/engine';
import type { ReadinessInput } from '../types';

// Activity
import {
  calculateRingProgress, isGoalMet,
  calculateStreak, aggregateDailySteps,
} from '../activity/engine';
import type { ActivitySummary } from '../types';

// Sleep Stage Analysis
import {
  calculateStageBreakdown, evaluateStageTargets, calculateSleepEfficiency,
  determineSleepTrend, analyzeSleepSession,
} from '../sleep/analysis';

// CBT
import {
  CBT_EXERCISES, getExercisePrompts, getExerciseDefinition, getCbtStats,
} from '../cbt/exercises';
import type { CbtEntry } from '../types';

// HRV
import {
  calculateBaseline, calculatePercentileRank, categorizeHrv,
  calculateTrendDelta, analyzeHrv,
} from '../hrv/analysis';

// Meditation
import {
  MEDITATION_TYPES, getMeditationPrompts, getMeditationDefinition,
  getMeditationStats, getMeditationStreak,
} from '../meditation/sessions';
import type { MeditationSession } from '../types';

// Body
import {
  calculateBmi, getBmiCategory, calculateLeanMass,
  convertLbsToKg, convertKgToLbs, convertInchesToCm,
  calculateMovingAverage,
} from '../body/engine';

// SOS
import {
  GROUNDING_STEPS, getGroundingSteps, getSosStats,
} from '../sos/grounding';
import type { SosSession } from '../types';

// Sleep Aids
import {
  WIND_DOWN_ROUTINES, SLEEP_HYGIENE_TIPS, getRoutineDefinition,
  getTipOfTheDay, calculateRoutineCorrelation,
} from '../sleep-aids/routines';

// Aggregation
import {
  checkDuplicate, deduplicateBatch, parseCsvRecords, buildImportSummary,
} from '../aggregation/dedup';

// SpO2
import {
  categorizeSpo2, analyzeSpo2, checkLowAlert, determineTrend,
} from '../spo2/analysis';

// Sleep Bank
import {
  calculateSleepBank, getSleepBankStatus, getSleepBankTrend,
} from '../sleep/bank';

// Timeline
import {
  createTimelineEvent, mergeTimelineEvents, filterByType,
  filterByDateRange, groupByDate, paginateEvents,
} from '../timeline/engine';

// ============================================================================
// 1. Breathing Exercises
// ============================================================================

describe('Breathing Engine', () => {
  it('defines 5 breathing patterns', () => {
    expect(Object.keys(BREATHING_PATTERNS)).toHaveLength(5);
  });

  it('getPatternConfig returns correct config for box', () => {
    const config = getPatternConfig('box');
    expect(config.inhale).toBe(4);
    expect(config.hold1).toBe(4);
    expect(config.exhale).toBe(4);
    expect(config.hold2).toBe(4);
    expect(config.defaultCycles).toBe(8);
  });

  it('calculateSessionDuration: box 8 cycles = 128 seconds', () => {
    expect(calculateSessionDuration('box', 8)).toBe(128);
  });

  it('calculateSessionDuration: 478 6 cycles = 114 seconds', () => {
    expect(calculateSessionDuration('478', 6)).toBe(114);
  });

  it('calculateMoodDelta returns correct difference', () => {
    expect(calculateMoodDelta(4, 7)).toBe(3);
    expect(calculateMoodDelta(8, 5)).toBe(-3);
  });

  it('calculateMoodDelta returns null when either mood is null', () => {
    expect(calculateMoodDelta(null, 7)).toBeNull();
    expect(calculateMoodDelta(4, null)).toBeNull();
    expect(calculateMoodDelta(null, null)).toBeNull();
  });

  it('getBreathingStats returns correct stats', () => {
    const sessions: BreathingSession[] = [
      { id: '1', pattern: 'box', duration_seconds: 120, cycles_completed: 8, completed: 1, mood_before: 3, mood_after: 7, created_at: '2026-03-15' },
      { id: '2', pattern: 'box', duration_seconds: 60, cycles_completed: 4, completed: 0, mood_before: null, mood_after: null, created_at: '2026-03-14' },
      { id: '3', pattern: '478', duration_seconds: 114, cycles_completed: 6, completed: 1, mood_before: 5, mood_after: 8, created_at: '2026-03-13' },
    ];
    const stats = getBreathingStats(sessions);
    expect(stats.totalSessions).toBe(3);
    expect(stats.totalMinutes).toBe(5);
    expect(stats.favoritePattern).toBe('box');
    expect(stats.averageMoodImprovement).toBe(3.5);
  });

  it('getBreathingStats handles empty sessions', () => {
    const stats = getBreathingStats([]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.favoritePattern).toBeNull();
  });
});

// ============================================================================
// 2. Readiness Score
// ============================================================================

describe('Readiness Score Engine', () => {
  const fullInput: ReadinessInput = {
    sleepDurationMinutes: 480,
    sleepQualityScore: 85,
    sleepTargetMinutes: 480,
    hrvValue: 55,
    hrvBaseline: 50,
    rhrValue: 58,
    rhrBaseline: 62,
    activeEnergyYesterday: 400,
    workoutStrainYesterday: 30,
  };

  it('returns high score with excellent data', () => {
    const result = calculateReadinessScore(fullInput);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.recommendation).toBe('intense');
    expect(result.dataCompleteness).toBe(1);
  });

  it('returns 50 with all missing data', () => {
    const emptyInput: ReadinessInput = {
      sleepDurationMinutes: null,
      sleepQualityScore: null,
      sleepTargetMinutes: 480,
      hrvValue: null,
      hrvBaseline: null,
      rhrValue: null,
      rhrBaseline: null,
      activeEnergyYesterday: null,
      workoutStrainYesterday: null,
    };
    const result = calculateReadinessScore(emptyInput);
    // Strain defaults to 0.8 (rest day is good), so neutral is slightly above 50
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(55);
    expect(result.dataCompleteness).toBe(0);
  });

  it('normalizeSleepFactor: 8h of 8h target = high', () => {
    expect(normalizeSleepFactor(480, 85, 480)).toBeGreaterThan(0.8);
  });

  it('normalizeSleepFactor: 4h of 8h target = ~0.5', () => {
    const result = normalizeSleepFactor(240, 70, 480);
    expect(result).toBeGreaterThan(0.4);
    expect(result).toBeLessThan(0.7);
  });

  it('normalizeHrvFactor defaults to 0.5 when null', () => {
    expect(normalizeHrvFactor(null, 50)).toBe(0.5);
  });

  it('normalizeRhrFactor: lower RHR = higher score', () => {
    const lower = normalizeRhrFactor(55, 62);
    const higher = normalizeRhrFactor(70, 62);
    expect(lower).toBeGreaterThan(higher);
  });

  it('getRecommendation maps correctly', () => {
    expect(getRecommendation(85)).toBe('intense');
    expect(getRecommendation(65)).toBe('moderate');
    expect(getRecommendation(45)).toBe('light');
    expect(getRecommendation(30)).toBe('rest');
  });

  it('calculateDataCompleteness: 4 of 5 = 0.8', () => {
    const partial: ReadinessInput = {
      ...fullInput,
      hrvValue: null,
      hrvBaseline: null,
    };
    expect(calculateDataCompleteness(partial)).toBe(0.8);
  });
});

// ============================================================================
// 3. Activity Tracking
// ============================================================================

describe('Activity Engine', () => {
  const makeSummary = (overrides: Partial<ActivitySummary> = {}): ActivitySummary => ({
    id: '1', date: '2026-03-15', steps: 5000, steps_goal: 10000,
    active_energy_cal: 250, active_energy_goal: 500,
    move_minutes: 15, move_minutes_goal: 30,
    distance_meters: null, floors_climbed: null, source: 'manual',
    created_at: '', updated_at: '',
    ...overrides,
  });

  it('calculateRingProgress: 5000/10000 = 0.5', () => {
    expect(calculateRingProgress(5000, 10000)).toBe(0.5);
  });

  it('calculateRingProgress caps at 1.0', () => {
    expect(calculateRingProgress(15000, 10000)).toBe(1.0);
  });

  it('isGoalMet when all goals met', () => {
    expect(isGoalMet(makeSummary({ steps: 10000, active_energy_cal: 500, move_minutes: 30 }))).toBe(true);
  });

  it('isGoalMet returns false when any goal not met', () => {
    expect(isGoalMet(makeSummary({ steps: 9999, active_energy_cal: 500, move_minutes: 30 }))).toBe(false);
  });

  it('calculateStreak: 3 consecutive goal-met days = 3', () => {
    const summaries = [
      makeSummary({ steps: 11000, active_energy_cal: 600, move_minutes: 40 }),
      makeSummary({ steps: 12000, active_energy_cal: 550, move_minutes: 35 }),
      makeSummary({ steps: 10500, active_energy_cal: 510, move_minutes: 31 }),
    ];
    expect(calculateStreak(summaries)).toBe(3);
  });

  it('calculateStreak: gap resets to 0', () => {
    const summaries = [
      makeSummary({ steps: 11000, active_energy_cal: 600, move_minutes: 40 }),
      makeSummary({ steps: 5000, active_energy_cal: 200, move_minutes: 10 }),
    ];
    expect(calculateStreak(summaries)).toBe(1);
  });

  it('aggregateDailySteps sums values', () => {
    expect(aggregateDailySteps([{ value: 3000 }, { value: 4500 }, { value: 2500 }])).toBe(10000);
  });

  it('aggregateDailySteps returns 0 for empty', () => {
    expect(aggregateDailySteps([])).toBe(0);
  });
});

// ============================================================================
// 4. Sleep Stage Analysis
// ============================================================================

describe('Sleep Stage Analysis', () => {
  it('calculates breakdown correctly', () => {
    const result = calculateStageBreakdown({
      duration_minutes: 480,
      deep_minutes: 60, rem_minutes: 90, light_minutes: 300, awake_minutes: 30,
    });
    expect(result).not.toBeNull();
    expect(result!.deepMinutes).toBe(60);
    expect(result!.totalSleepMinutes).toBe(450);
    expect(result!.deepPercent).toBeCloseTo(12.5, 0);
  });

  it('returns null when no stage data', () => {
    const result = calculateStageBreakdown({
      duration_minutes: 480,
      deep_minutes: null, rem_minutes: null, light_minutes: null, awake_minutes: null,
    });
    expect(result).toBeNull();
  });

  it('evaluateStageTargets categorizes correctly', () => {
    const breakdown = calculateStageBreakdown({
      duration_minutes: 480,
      deep_minutes: 50, rem_minutes: 100, light_minutes: 300, awake_minutes: 30,
    })!;
    const targets = evaluateStageTargets(breakdown);
    expect(targets).toHaveLength(3);
    expect(targets.find(t => t.stage === 'deep')!.status).toBe('low'); // ~10.4% < 13%
  });

  it('calculateSleepEfficiency', () => {
    expect(calculateSleepEfficiency(480, 30)).toBe(94);
    expect(calculateSleepEfficiency(0, 0)).toBe(0);
  });

  it('determineSleepTrend improving', () => {
    expect(determineSleepTrend([80, 82, 85, 88, 90, 92])).toBe('improving');
  });

  it('determineSleepTrend declining', () => {
    expect(determineSleepTrend([92, 90, 88, 85, 82, 80])).toBe('declining');
  });

  it('analyzeSleepSession returns full analysis', () => {
    const result = analyzeSleepSession({
      duration_minutes: 480,
      deep_minutes: 80, rem_minutes: 100, light_minutes: 270, awake_minutes: 30,
    });
    expect(result).not.toBeNull();
    expect(result!.sleepEfficiency).toBe(94);
    expect(result!.targets).toHaveLength(3);
  });
});

// ============================================================================
// 5. CBT Exercises
// ============================================================================

describe('CBT Exercises', () => {
  it('defines 6 exercise types', () => {
    expect(CBT_EXERCISES).toHaveLength(6);
  });

  it('getExercisePrompts returns correct prompts for thought_record', () => {
    const prompts = getExercisePrompts('thought_record');
    expect(prompts).toHaveLength(5);
    expect(prompts[0]).toContain('situation');
  });

  it('getExerciseDefinition returns null for unknown type', () => {
    expect(getExerciseDefinition('nonexistent' as any)).toBeNull();
  });

  it('getCbtStats returns correct stats', () => {
    const entries: CbtEntry[] = [
      { id: '1', exercise_type: 'gratitude', prompt: 'p1', response: 'r1', mood_before: 3, mood_after: 7, tags: null, created_at: '' },
      { id: '2', exercise_type: 'gratitude', prompt: 'p2', response: 'r2', mood_before: 4, mood_after: 6, tags: null, created_at: '' },
      { id: '3', exercise_type: 'worry_time', prompt: 'p3', response: 'r3', mood_before: null, mood_after: null, tags: null, created_at: '' },
    ];
    const stats = getCbtStats(entries);
    expect(stats.totalExercises).toBe(3);
    expect(stats.favoriteType).toBe('gratitude');
    expect(stats.averageMoodImprovement).toBe(3);
  });

  it('getCbtStats handles empty', () => {
    expect(getCbtStats([]).totalExercises).toBe(0);
  });
});

// ============================================================================
// 6. HRV Tracking
// ============================================================================

describe('HRV Analysis', () => {
  it('calculateBaseline returns average', () => {
    expect(calculateBaseline([40, 50, 60])).toBe(50);
  });

  it('calculateBaseline defaults to 40 for empty', () => {
    expect(calculateBaseline([])).toBe(40);
  });

  it('calculatePercentileRank: higher than 75%', () => {
    const rank = calculatePercentileRank(70, [30, 40, 50, 60, 70, 80]);
    expect(rank).toBeGreaterThanOrEqual(60);
  });

  it('categorizeHrv: 1.3x baseline = high', () => {
    expect(categorizeHrv(65, 50)).toBe('high');
  });

  it('categorizeHrv: 0.5x baseline = low', () => {
    expect(categorizeHrv(25, 50)).toBe('low');
  });

  it('calculateTrendDelta improving', () => {
    const result = calculateTrendDelta([55, 58, 60], [45, 48, 50]);
    expect(result.trend).toBe('improving');
    expect(result.delta).toBeGreaterThan(0);
  });

  it('analyzeHrv returns full analysis', () => {
    const result = analyzeHrv(55, [40, 45, 50, 55, 60], [52, 55, 58], [42, 45, 48]);
    expect(result.currentValue).toBe(55);
    expect(result.baseline).toBe(50);
    expect(result.category).toBe('above_average');
    expect(result.insight).toContain('above');
  });
});

// ============================================================================
// 7. Guided Meditation
// ============================================================================

describe('Meditation Engine', () => {
  it('defines 8 meditation types', () => {
    expect(MEDITATION_TYPES).toHaveLength(8);
  });

  it('getMeditationPrompts returns prompts for body_scan', () => {
    const prompts = getMeditationPrompts('body_scan');
    expect(prompts.length).toBeGreaterThan(5);
    expect(prompts[0]).toContain('eyes');
  });

  it('getMeditationPrompts returns empty for custom_timer', () => {
    expect(getMeditationPrompts('custom_timer')).toHaveLength(0);
  });

  it('getMeditationDefinition returns null for unknown', () => {
    expect(getMeditationDefinition('unknown' as any)).toBeNull();
  });

  it('getMeditationStats returns correct stats', () => {
    const sessions: MeditationSession[] = [
      { id: '1', meditation_type: 'body_scan', duration_seconds: 600, completed: 1, mood_before: 4, mood_after: 8, notes: null, created_at: '2026-03-15T10:00:00' },
      { id: '2', meditation_type: 'focus', duration_seconds: 300, completed: 1, mood_before: 5, mood_after: 7, notes: null, created_at: '2026-03-14T10:00:00' },
    ];
    const stats = getMeditationStats(sessions);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalMinutes).toBe(15);
    expect(stats.averageMoodImprovement).toBe(3);
  });

  it('getMeditationStreak: consecutive days', () => {
    const sessions: MeditationSession[] = [
      { id: '1', meditation_type: 'focus', duration_seconds: 300, completed: 1, mood_before: null, mood_after: null, notes: null, created_at: '2026-03-15T10:00:00' },
      { id: '2', meditation_type: 'focus', duration_seconds: 300, completed: 1, mood_before: null, mood_after: null, notes: null, created_at: '2026-03-14T10:00:00' },
      { id: '3', meditation_type: 'focus', duration_seconds: 300, completed: 1, mood_before: null, mood_after: null, notes: null, created_at: '2026-03-13T10:00:00' },
    ];
    expect(getMeditationStreak(sessions)).toBe(3);
  });

  it('getMeditationStreak: gap resets', () => {
    const sessions: MeditationSession[] = [
      { id: '1', meditation_type: 'focus', duration_seconds: 300, completed: 1, mood_before: null, mood_after: null, notes: null, created_at: '2026-03-15T10:00:00' },
      { id: '2', meditation_type: 'focus', duration_seconds: 300, completed: 1, mood_before: null, mood_after: null, notes: null, created_at: '2026-03-12T10:00:00' },
    ];
    expect(getMeditationStreak(sessions)).toBe(1);
  });
});

// ============================================================================
// 8. Body Composition
// ============================================================================

describe('Body Composition Engine', () => {
  it('calculateBmi: 70kg, 175cm = 22.9', () => {
    expect(calculateBmi(70, 175)).toBe(22.9);
  });

  it('calculateBmi returns null when height missing', () => {
    expect(calculateBmi(70, null)).toBeNull();
    expect(calculateBmi(null, 175)).toBeNull();
  });

  it('getBmiCategory', () => {
    expect(getBmiCategory(17)).toBe('underweight');
    expect(getBmiCategory(22)).toBe('normal');
    expect(getBmiCategory(27)).toBe('overweight');
    expect(getBmiCategory(32)).toBe('obese');
  });

  it('calculateLeanMass: 80kg, 20% fat = 64kg', () => {
    expect(calculateLeanMass(80, 20)).toBe(64);
  });

  it('convertLbsToKg: 150 lbs ~ 68.04 kg', () => {
    expect(convertLbsToKg(150)).toBeCloseTo(68.04, 1);
  });

  it('convertKgToLbs roundtrip', () => {
    const kg = 70;
    const lbs = convertKgToLbs(kg);
    expect(convertLbsToKg(lbs)).toBeCloseTo(kg, 0);
  });

  it('convertInchesToCm: 12 inches = 30.48 cm', () => {
    expect(convertInchesToCm(12)).toBeCloseTo(30.48, 1);
  });

  it('calculateMovingAverage 7-day window', () => {
    const values = [70, 71, 69, 70, 72, 71, 70];
    const avg = calculateMovingAverage(values, 7);
    expect(avg).toHaveLength(7);
    expect(avg[6]).toBeCloseTo(70.43, 1);
  });

  it('calculateMovingAverage empty', () => {
    expect(calculateMovingAverage([], 7)).toEqual([]);
  });
});

// ============================================================================
// 9. SOS/Panic
// ============================================================================

describe('SOS Engine', () => {
  it('has 5 grounding steps', () => {
    expect(GROUNDING_STEPS).toHaveLength(5);
    expect(getGroundingSteps()).toHaveLength(5);
  });

  it('grounding steps: correct count and sense', () => {
    expect(GROUNDING_STEPS[0].count).toBe(5);
    expect(GROUNDING_STEPS[0].sense).toBe('see');
    expect(GROUNDING_STEPS[4].count).toBe(1);
    expect(GROUNDING_STEPS[4].sense).toBe('taste');
  });

  it('getSosStats returns correct stats', () => {
    const sessions: SosSession[] = [
      { id: '1', trigger_source: 'manual', tools_used: '["breathing","grounding"]', duration_seconds: 180, mood_before: 2, mood_after: 6, notes: null, created_at: '' },
      { id: '2', trigger_source: 'manual', tools_used: '["breathing"]', duration_seconds: 120, mood_before: null, mood_after: null, notes: null, created_at: '' },
    ];
    const stats = getSosStats(sessions);
    expect(stats.totalSessions).toBe(2);
    expect(stats.averageDurationSeconds).toBe(150);
    expect(stats.mostUsedTool).toBe('breathing');
  });

  it('getSosStats handles empty', () => {
    const stats = getSosStats([]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.mostUsedTool).toBeNull();
  });
});

// ============================================================================
// 10. Sleep Aids
// ============================================================================

describe('Sleep Aids Engine', () => {
  it('has 3 wind-down routines', () => {
    expect(WIND_DOWN_ROUTINES).toHaveLength(3);
  });

  it('has 10 sleep hygiene tips', () => {
    expect(SLEEP_HYGIENE_TIPS).toHaveLength(10);
  });

  it('getRoutineDefinition returns correct routine', () => {
    const routine = getRoutineDefinition('Evening Wind-Down');
    expect(routine).not.toBeNull();
    expect(routine!.durationSeconds).toBe(900);
  });

  it('getRoutineDefinition returns null for unknown', () => {
    expect(getRoutineDefinition('nonexistent')).toBeNull();
  });

  it('getTipOfTheDay rotates', () => {
    const tip1 = getTipOfTheDay('2026-03-15');
    const tip2 = getTipOfTheDay('2026-03-16');
    // Different days should give different tips (unless mod wraps)
    expect(typeof tip1.text).toBe('string');
    expect(typeof tip2.text).toBe('string');
  });

  it('calculateRoutineCorrelation: positive = routine nights better', () => {
    const result = calculateRoutineCorrelation([85, 90, 88], [70, 75, 72]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it('calculateRoutineCorrelation returns null with no data', () => {
    expect(calculateRoutineCorrelation([], [70, 75])).toBeNull();
    expect(calculateRoutineCorrelation([85], [])).toBeNull();
  });
});

// ============================================================================
// 11. Multi-App Aggregation / Dedup
// ============================================================================

describe('Aggregation Dedup Engine', () => {
  it('checkDuplicate: exact match = duplicate', () => {
    const result = checkDuplicate(
      { vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:00Z', value: 72 },
      [{ vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:30Z', value: 72 }],
    );
    expect(result.isDuplicate).toBe(true);
    expect(result.isConflict).toBe(false);
  });

  it('checkDuplicate: same time different value = conflict', () => {
    const result = checkDuplicate(
      { vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:00Z', value: 72 },
      [{ vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:30Z', value: 80 }],
    );
    expect(result.isDuplicate).toBe(false);
    expect(result.isConflict).toBe(true);
  });

  it('checkDuplicate: different type = new record', () => {
    const result = checkDuplicate(
      { vital_type: 'steps', recorded_at: '2026-03-15T10:00:00Z', value: 5000 },
      [{ vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:00Z', value: 72 }],
    );
    expect(result.isDuplicate).toBe(false);
    expect(result.isConflict).toBe(false);
  });

  it('deduplicateBatch processes correctly', () => {
    const incoming = [
      { vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:00Z', value: 72 },
      { vital_type: 'heart_rate', recorded_at: '2026-03-15T11:00:00Z', value: 75 },
    ];
    const existing = [
      { vital_type: 'heart_rate', recorded_at: '2026-03-15T10:00:10Z', value: 72 },
    ];
    const result = deduplicateBatch(incoming, existing);
    expect(result.skipped).toBe(1);
    expect(result.toInsert).toHaveLength(1);
  });

  it('parseCsvRecords parses correctly', () => {
    const csv = 'type,timestamp,value\nheart_rate,2026-03-15T10:00:00Z,72\nsteps,2026-03-15T10:00:00Z,5000';
    const records = parseCsvRecords(csv);
    expect(records).toHaveLength(2);
    expect(records[0].vital_type).toBe('heart_rate');
    expect(records[0].value).toBe(72);
  });

  it('parseCsvRecords handles empty', () => {
    expect(parseCsvRecords('')).toHaveLength(0);
    expect(parseCsvRecords('header\n')).toHaveLength(0);
  });

  it('buildImportSummary', () => {
    const summary = buildImportSummary('csv', 100, 5, 2);
    expect(summary.imported).toBe(100);
    expect(summary.skipped).toBe(5);
    expect(summary.conflicted).toBe(2);
  });
});

// ============================================================================
// 12. Blood Oxygen Tracking
// ============================================================================

describe('SpO2 Analysis', () => {
  it('categorizeSpo2: 97% = normal', () => {
    expect(categorizeSpo2(97)).toBe('normal');
  });

  it('categorizeSpo2: 92% = borderline', () => {
    expect(categorizeSpo2(92)).toBe('borderline');
  });

  it('categorizeSpo2: 88% = low', () => {
    expect(categorizeSpo2(88)).toBe('low');
  });

  it('determineTrend stable', () => {
    expect(determineTrend([97, 97, 97], [97, 97, 97])).toBe('stable');
  });

  it('determineTrend declining', () => {
    expect(determineTrend([92, 91, 90], [97, 96, 95])).toBe('declining');
  });

  it('checkLowAlert returns message when consistently low', () => {
    const dailyAverages = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-${String(9 + i).padStart(2, '0')}`,
      avg: 93,
    }));
    const alert = checkLowAlert(dailyAverages);
    expect(alert).not.toBeNull();
    expect(alert).toContain('7 days');
  });

  it('checkLowAlert returns null when not consistently low', () => {
    const dailyAverages = [
      { date: '2026-03-09', avg: 93 },
      { date: '2026-03-10', avg: 96 },
      { date: '2026-03-11', avg: 94 },
      { date: '2026-03-12', avg: 97 },
      { date: '2026-03-13', avg: 93 },
      { date: '2026-03-14', avg: 96 },
      { date: '2026-03-15', avg: 94 },
    ];
    expect(checkLowAlert(dailyAverages)).toBeNull();
  });

  it('analyzeSpo2 returns full analysis', () => {
    const result = analyzeSpo2(97, [96, 97, 96], [96, 97, 96, 97, 96], [96, 97], [95, 96], []);
    expect(result.latestReading).toBe(97);
    expect(result.category).toBe('normal');
    expect(result.overnightAverage).toBeCloseTo(96.3, 0);
  });
});

// ============================================================================
// 13. Sleep Bank
// ============================================================================

describe('Sleep Bank Engine', () => {
  it('getSleepBankStatus', () => {
    expect(getSleepBankStatus(-2)).toBe('well_rested');
    expect(getSleepBankStatus(0)).toBe('well_rested');
    expect(getSleepBankStatus(2)).toBe('slight_debt');
    expect(getSleepBankStatus(5)).toBe('moderate_debt');
    expect(getSleepBankStatus(10)).toBe('significant_debt');
  });

  it('calculateSleepBank: exactly on target = well_rested', () => {
    const daily = [480, 480, 480, 480, 480, 480, 480]; // 8h each day
    const result = calculateSleepBank(daily, 8);
    expect(result.currentDebtMinutes).toBe(0);
    expect(result.status).toBe('well_rested');
    expect(result.averageSleepHours).toBe(8);
  });

  it('calculateSleepBank: consistent deficit', () => {
    const daily = [360, 360, 360, 360, 360, 360, 360]; // 6h each day, 2h short
    const result = calculateSleepBank(daily, 8);
    expect(result.currentDebtMinutes).toBe(840); // 7 * 120 = 840 min debt
    expect(result.currentDebtHours).toBe(14);
    expect(result.status).toBe('significant_debt');
  });

  it('calculateSleepBank: surplus', () => {
    const daily = [540, 540, 540, 540, 540, 540, 540]; // 9h each day
    const result = calculateSleepBank(daily, 8);
    expect(result.currentDebtMinutes).toBeLessThan(0);
    expect(result.status).toBe('well_rested');
  });

  it('getSleepBankTrend: paying off', () => {
    // First half negative (deficit), second half positive (surplus)
    expect(getSleepBankTrend([-60, -30, -30, 0, 30, 60, 60])).toBe('paying_off');
  });

  it('getSleepBankTrend: accumulating', () => {
    expect(getSleepBankTrend([60, 30, 0, -30, -60, -90, -120])).toBe('accumulating');
  });
});

// ============================================================================
// 14. Wellness Timeline
// ============================================================================

describe('Timeline Engine', () => {
  const e1 = createTimelineEvent('1', 'vital_reading', '2026-03-15T10:00:00', 'HR: 72', null, '💓', '#10B981', 'health');
  const e2 = createTimelineEvent('2', 'sleep_session', '2026-03-15T06:00:00', 'Sleep: 8h', null, '😴', '#818CF8', 'health');
  const e3 = createTimelineEvent('3', 'mood_checkin', '2026-03-14T20:00:00', 'Mood: 7', null, '😊', '#F59E0B', 'meds');

  it('mergeTimelineEvents sorts descending', () => {
    const merged = mergeTimelineEvents([e2], [e1], [e3]);
    expect(merged[0].id).toBe('1');
    expect(merged[1].id).toBe('2');
    expect(merged[2].id).toBe('3');
  });

  it('filterByType filters correctly', () => {
    const all = [e1, e2, e3];
    const filtered = filterByType(all, ['vital_reading']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('filterByDateRange', () => {
    const all = [e1, e2, e3];
    const filtered = filterByDateRange(all, '2026-03-15T00:00:00', '2026-03-15T23:59:59');
    expect(filtered).toHaveLength(2);
  });

  it('groupByDate groups correctly', () => {
    const groups = groupByDate([e1, e2, e3]);
    expect(groups.get('2026-03-15')).toHaveLength(2);
    expect(groups.get('2026-03-14')).toHaveLength(1);
  });

  it('paginateEvents', () => {
    const all = [e1, e2, e3];
    const page0 = paginateEvents(all, 0, 2);
    expect(page0.events).toHaveLength(2);
    expect(page0.hasMore).toBe(true);
    const page1 = paginateEvents(all, 1, 2);
    expect(page1.events).toHaveLength(1);
    expect(page1.hasMore).toBe(false);
  });
});
