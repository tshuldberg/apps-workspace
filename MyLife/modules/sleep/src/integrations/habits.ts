import type { DatabaseAdapter } from '@mylife/db';

export type SleepHabitAdherenceStatus =
  | 'disabled'
  | 'no_routine_habits'
  | 'insufficient_data'
  | 'reportable';

export type SleepHabitHintConfidence = 'high' | 'medium' | 'low';
export type SleepHabitHintSource = 'sleep_factor' | 'hygiene_check';

export interface SleepHabitAdherenceDateRange {
  startDate?: string;
  endDate?: string;
  minSampleSize?: number;
}

export interface SleepRoutineHabit {
  id: string;
  name: string;
  timeOfDay: string;
  habitType: string;
  targetCount: number;
}

export interface SleepHabitAdherenceDay {
  sleepDate: string;
  routineDate: string;
  sleepQuality: number;
  completedHabitCount: number;
  routineHabitCount: number;
  completionRate: number;
}

export interface SleepHabitAdherenceSummary {
  status: SleepHabitAdherenceStatus;
  insight: string;
  sampleSize: number;
  routineHabitCount: number;
  completedRoutineDays: number;
  adherenceRate: number | null;
  averageQualityAfterRoutine: number | null;
  averageQualityWithoutRoutine: number | null;
  qualityDelta: number | null;
  routineHabits: SleepRoutineHabit[];
  daily: SleepHabitAdherenceDay[];
}

export interface SleepHabitSuggestion {
  name: string;
  description: string;
  timeOfDay: 'evening';
  habitType: 'standard';
  icon: string;
  color: string;
  sourcePracticeId?: string;
}

export interface HabitCompletionHint {
  suggestedHabitName: string;
  practiceId: string;
  completed: true;
  confidence: SleepHabitHintConfidence;
  source: SleepHabitHintSource;
  reason: string;
}

interface RoutineHabitRow {
  id: string;
  name: string;
  time_of_day: string | null;
  habit_type: string | null;
  target_count: number | null;
}

interface RoutineAdherenceRow {
  sleep_date: string;
  routine_date: string;
  sleep_quality: number;
  completed_habit_count: number;
}

interface SleepEntryRow {
  id: string;
  date: string;
  bedtime: string | null;
}

interface FactorRow {
  last_caffeine_time: string | null;
  last_meal_time: string | null;
  alcohol_drinks: number | null;
  exercise_today: number | null;
  exercise_time: string | null;
  screen_cutoff_time: string | null;
  pre_sleep_activities: string | null;
}

interface HygieneCheckRow {
  practice_id: string;
  met: number;
  source: string;
}

const DEFAULT_MIN_SAMPLE_SIZE = 7;
const ROUTINE_COMPLETION_THRESHOLD = 50;
const ROUTINE_NAME_PATTERNS = [
  '%wind%down%',
  '%screen%',
  '%bed%',
  '%sleep%',
  '%read%',
  '%journal%',
  '%meditat%',
  '%stretch%',
  '%relax%',
  '%routine%',
];
const RELAXATION_ACTIVITIES = new Set([
  'reading',
  'meditation',
  'journaling',
  'shower',
  'bath',
  'music',
]);
const SCREEN_ACTIVITIES = new Set([
  'screen_time',
  'social_media',
  'gaming',
  'tv_show',
  'movie',
]);

const STARTER_SLEEP_HABITS: SleepHabitSuggestion[] = [
  {
    name: 'Wind down routine',
    description: 'A 10-minute quiet routine before bed.',
    timeOfDay: 'evening',
    habitType: 'standard',
    icon: 'nightlight',
    color: '#A78BFA',
    sourcePracticeId: 'relaxation_routine',
  },
  {
    name: 'No screens before bed',
    description: 'Stop bright screens at least 1 hour before sleep.',
    timeOfDay: 'evening',
    habitType: 'standard',
    icon: 'block',
    color: '#8BCFF0',
    sourcePracticeId: 'no_screens_1h',
  },
  {
    name: 'Consistent bedtime',
    description: 'Start the same bedtime window each night.',
    timeOfDay: 'evening',
    habitType: 'standard',
    icon: 'schedule',
    color: '#30D158',
    sourcePracticeId: 'consistent_bedtime_30m',
  },
  {
    name: 'Read before bed',
    description: 'Read a few pages as a low-stimulation closeout.',
    timeOfDay: 'evening',
    habitType: 'standard',
    icon: 'menu_book',
    color: '#C4B5FD',
    sourcePracticeId: 'relaxation_routine',
  },
  {
    name: 'Prep tomorrow',
    description: "Write down tomorrow's first task before lights out.",
    timeOfDay: 'evening',
    habitType: 'standard',
    icon: 'edit_note',
    color: '#FFB877',
  },
];

function emptySummary(status: SleepHabitAdherenceStatus): SleepHabitAdherenceSummary {
  return {
    status,
    insight: '',
    sampleSize: 0,
    routineHabitCount: 0,
    completedRoutineDays: 0,
    adherenceRate: null,
    averageQualityAfterRoutine: null,
    averageQualityWithoutRoutine: null,
    qualityDelta: null,
    routineHabits: [],
    daily: [],
  };
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function areBridgeModulesEnabled(db: DatabaseAdapter): boolean {
  try {
    const rows = db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT module_id) as count
       FROM hub_enabled_modules
       WHERE module_id IN (?, ?)`,
      ['sleep', 'habits'],
    );

    return (rows[0]?.count ?? 0) === 2;
  } catch {
    return false;
  }
}

function routineHabitPredicate(): string {
  const nameChecks = ROUTINE_NAME_PATTERNS
    .map(() => `LOWER(name) LIKE ?`)
    .join(' OR ');
  return `(time_of_day = 'evening' OR ${nameChecks})`;
}

function routineHabitPredicateParams(): string[] {
  return [...ROUTINE_NAME_PATTERNS];
}

function readRoutineHabits(db: DatabaseAdapter): SleepRoutineHabit[] | null {
  try {
    const rows = db.query<RoutineHabitRow>(
      `SELECT id, name, time_of_day, habit_type, target_count
       FROM hb_habits
       WHERE is_archived = 0
         AND ${routineHabitPredicate()}
       ORDER BY sort_order ASC, name ASC
       LIMIT 100`,
      routineHabitPredicateParams(),
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      timeOfDay: row.time_of_day ?? 'anytime',
      habitType: row.habit_type ?? 'standard',
      targetCount: Number(row.target_count ?? 1),
    }));
  } catch {
    return null;
  }
}

function readDailyAdherence(
  db: DatabaseAdapter,
  dateRange: SleepHabitAdherenceDateRange,
  routineHabitIds: readonly string[],
): SleepHabitAdherenceDay[] | null {
  if (routineHabitIds.length === 0) {
    return [];
  }

  const sleepWhere = ['e.quality_rating IS NOT NULL'];
  const sleepParams: unknown[] = [];
  if (dateRange.startDate) {
    sleepWhere.push('e.date >= ?');
    sleepParams.push(dateRange.startDate);
  }
  if (dateRange.endDate) {
    sleepWhere.push('e.date <= ?');
    sleepParams.push(dateRange.endDate);
  }

  const habitPlaceholders = routineHabitIds.map(() => '?').join(', ');

  try {
    const rows = db.query<RoutineAdherenceRow>(
      `SELECT
         e.date as sleep_date,
         COALESCE(substr(e.bedtime, 1, 10), e.date) as routine_date,
         e.quality_rating as sleep_quality,
         COUNT(DISTINCT c.habit_id) as completed_habit_count
       FROM sl_sleep_entries e
       LEFT JOIN hb_completions c
         ON DATE(c.completed_at) = COALESCE(substr(e.bedtime, 1, 10), e.date)
        AND c.habit_id IN (${habitPlaceholders})
       WHERE ${sleepWhere.join(' AND ')}
       GROUP BY e.id, e.date, e.bedtime, e.quality_rating
       ORDER BY e.date ASC
       LIMIT 1000`,
      [...routineHabitIds, ...sleepParams],
    );

    return rows
      .map((row) => {
        const sleepQuality = Number(row.sleep_quality);
        const completedHabitCount = Number(row.completed_habit_count ?? 0);
        return {
          sleepDate: row.sleep_date,
          routineDate: row.routine_date,
          sleepQuality,
          completedHabitCount,
          routineHabitCount: routineHabitIds.length,
          completionRate: round(
            (completedHabitCount / routineHabitIds.length) * 100,
          ),
        };
      })
      .filter((day) => Number.isFinite(day.sleepQuality));
  } catch {
    return null;
  }
}

function buildInsight(
  sampleSize: number,
  adherenceRate: number,
  averageQualityAfterRoutine: number | null,
  averageQualityWithoutRoutine: number | null,
  qualityDelta: number | null,
): string {
  if (
    averageQualityAfterRoutine !== null &&
    averageQualityWithoutRoutine !== null &&
    qualityDelta !== null
  ) {
    const direction = qualityDelta >= 0 ? 'higher' : 'lower';
    return `After bedtime routine completions, sleep quality averages ${averageQualityAfterRoutine.toFixed(1)}/5 vs ${averageQualityWithoutRoutine.toFixed(1)}/5 without them, a ${Math.abs(qualityDelta).toFixed(1)} point ${direction} pattern across ${sampleSize} nights.`;
  }

  return `Your bedtime routine adherence averages ${Math.round(adherenceRate)}% across ${sampleSize} sleep nights.`;
}

function parseJsonStringArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function clockToMinutes(value: string | null | undefined): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function dateTimeToClockMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return (date.getUTCHours() * 60) + date.getUTCMinutes();
}

function minutesBeforeBed(
  clockTime: string | null | undefined,
  bedtime: string | null | undefined,
): number | null {
  const clockMinutes = clockToMinutes(clockTime);
  const bedtimeMinutes = dateTimeToClockMinutes(bedtime);
  if (clockMinutes === null || bedtimeMinutes === null) {
    return null;
  }

  let delta = bedtimeMinutes - clockMinutes;
  if (delta < 0) {
    delta += 24 * 60;
  }
  return delta;
}

function readEntry(db: DatabaseAdapter, entryId: string): SleepEntryRow | null {
  try {
    return db.query<SleepEntryRow>(
      `SELECT id, date, bedtime
       FROM sl_sleep_entries
       WHERE id = ?
       LIMIT 1`,
      [entryId],
    )[0] ?? null;
  } catch {
    return null;
  }
}

function readFactor(
  db: DatabaseAdapter,
  entryId: string,
  date: string,
): FactorRow | null {
  try {
    return db.query<FactorRow>(
      `SELECT
         last_caffeine_time,
         last_meal_time,
         alcohol_drinks,
         exercise_today,
         exercise_time,
         screen_cutoff_time,
         pre_sleep_activities
       FROM sl_factors
       WHERE sleep_entry_id = ? OR date = ?
       ORDER BY CASE WHEN sleep_entry_id = ? THEN 0 ELSE 1 END, created_at DESC
       LIMIT 1`,
      [entryId, date, entryId],
    )[0] ?? null;
  } catch {
    return null;
  }
}

function readHygieneChecks(
  db: DatabaseAdapter,
  date: string,
): Map<string, HygieneCheckRow> {
  try {
    const rows = db.query<HygieneCheckRow>(
      `SELECT practice_id, met, source
       FROM sl_hygiene_checks
       WHERE date = ?`,
      [date],
    );
    return new Map(rows.map((row) => [row.practice_id, row]));
  } catch {
    return new Map();
  }
}

function addHint(
  hints: HabitCompletionHint[],
  hint: HabitCompletionHint,
): void {
  if (!hints.some((existing) => existing.practiceId === hint.practiceId)) {
    hints.push(hint);
  }
}

function addHygieneHints(
  hints: HabitCompletionHint[],
  checks: ReadonlyMap<string, HygieneCheckRow>,
): void {
  const mapping: Record<string, Omit<HabitCompletionHint, 'completed' | 'source'>> = {
    relaxation_routine: {
      suggestedHabitName: 'Wind down routine',
      practiceId: 'relaxation_routine',
      confidence: 'high',
      reason: 'Sleep hygiene marked a relaxation routine complete.',
    },
    no_screens_1h: {
      suggestedHabitName: 'No screens before bed',
      practiceId: 'no_screens_1h',
      confidence: 'high',
      reason: 'Sleep hygiene marked screen cutoff complete.',
    },
    consistent_bedtime_30m: {
      suggestedHabitName: 'Consistent bedtime',
      practiceId: 'consistent_bedtime_30m',
      confidence: 'high',
      reason: 'Sleep hygiene marked bedtime consistency complete.',
    },
  };

  for (const [practiceId, partial] of Object.entries(mapping)) {
    const check = checks.get(practiceId);
    if (check?.met === 1) {
      addHint(hints, {
        ...partial,
        completed: true,
        source: 'hygiene_check',
      });
    }
  }
}

export function suggestSleepHabits(): SleepHabitSuggestion[] {
  return STARTER_SLEEP_HABITS.map((habit) => ({ ...habit }));
}

export function getSleepHabitAdherence(
  db: DatabaseAdapter,
  dateRange: SleepHabitAdherenceDateRange = {},
): SleepHabitAdherenceSummary {
  if (!areBridgeModulesEnabled(db)) {
    return emptySummary('disabled');
  }

  const routineHabits = readRoutineHabits(db);
  if (!routineHabits) {
    return emptySummary('disabled');
  }
  if (routineHabits.length === 0) {
    return emptySummary('no_routine_habits');
  }

  const daily = readDailyAdherence(
    db,
    dateRange,
    routineHabits.map((habit) => habit.id),
  );
  if (!daily) {
    return emptySummary('disabled');
  }

  const minSampleSize = dateRange.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
  const completedRoutineDays = daily.filter(
    (day) => day.completionRate >= ROUTINE_COMPLETION_THRESHOLD,
  ).length;
  const adherenceRate = average(daily.map((day) => day.completionRate));

  if (daily.length < minSampleSize) {
    return {
      ...emptySummary('insufficient_data'),
      sampleSize: daily.length,
      routineHabitCount: routineHabits.length,
      completedRoutineDays,
      adherenceRate,
      routineHabits,
      daily,
    };
  }

  const routineDays = daily.filter(
    (day) => day.completionRate >= ROUTINE_COMPLETION_THRESHOLD,
  );
  const missedRoutineDays = daily.filter(
    (day) => day.completionRate < ROUTINE_COMPLETION_THRESHOLD,
  );
  const averageQualityAfterRoutine = average(
    routineDays.map((day) => day.sleepQuality),
  );
  const averageQualityWithoutRoutine = average(
    missedRoutineDays.map((day) => day.sleepQuality),
  );
  const qualityDelta =
    averageQualityAfterRoutine !== null && averageQualityWithoutRoutine !== null
      ? round(averageQualityAfterRoutine - averageQualityWithoutRoutine)
      : null;
  const safeAdherenceRate = adherenceRate ?? 0;

  return {
    status: 'reportable',
    insight: buildInsight(
      daily.length,
      safeAdherenceRate,
      averageQualityAfterRoutine,
      averageQualityWithoutRoutine,
      qualityDelta,
    ),
    sampleSize: daily.length,
    routineHabitCount: routineHabits.length,
    completedRoutineDays,
    adherenceRate,
    averageQualityAfterRoutine,
    averageQualityWithoutRoutine,
    qualityDelta,
    routineHabits,
    daily,
  };
}

export function buildHabitCompletionHints(
  db: DatabaseAdapter,
  entryId: string,
): HabitCompletionHint[] {
  if (!areBridgeModulesEnabled(db)) {
    return [];
  }

  const entry = readEntry(db, entryId);
  if (!entry) {
    return [];
  }

  const factor = readFactor(db, entryId, entry.date);
  const checks = readHygieneChecks(db, entry.date);
  const hints: HabitCompletionHint[] = [];
  addHygieneHints(hints, checks);

  if (!factor) {
    return hints;
  }

  const activities = parseJsonStringArray(factor.pre_sleep_activities);
  if (activities.some((activity) => RELAXATION_ACTIVITIES.has(activity))) {
    addHint(hints, {
      suggestedHabitName: 'Wind down routine',
      practiceId: 'relaxation_routine',
      completed: true,
      confidence: 'high',
      source: 'sleep_factor',
      reason: 'A relaxation activity was logged before bed.',
    });
  }

  const screenCutoffMinutes = minutesBeforeBed(
    factor.screen_cutoff_time,
    entry.bedtime,
  );
  if (
    screenCutoffMinutes !== null &&
    screenCutoffMinutes >= 60 &&
    !activities.some((activity) => SCREEN_ACTIVITIES.has(activity))
  ) {
    addHint(hints, {
      suggestedHabitName: 'No screens before bed',
      practiceId: 'no_screens_1h',
      completed: true,
      confidence: 'high',
      source: 'sleep_factor',
      reason: 'Screen cutoff was at least 1 hour before bedtime.',
    });
  }

  const caffeineMinutes = clockToMinutes(factor.last_caffeine_time);
  if (caffeineMinutes !== null && caffeineMinutes <= 14 * 60) {
    addHint(hints, {
      suggestedHabitName: 'No caffeine after 2pm',
      practiceId: 'no_caffeine_after_2pm',
      completed: true,
      confidence: 'high',
      source: 'sleep_factor',
      reason: 'Last caffeine was logged at or before 2pm.',
    });
  }

  if ((factor.alcohol_drinks ?? 0) === 0) {
    addHint(hints, {
      suggestedHabitName: 'No alcohol near bedtime',
      practiceId: 'no_alcohol_3h',
      completed: true,
      confidence: 'medium',
      source: 'sleep_factor',
      reason: 'No alcohol drinks were logged for the night.',
    });
  }

  const exerciseMinutes = minutesBeforeBed(
    factor.exercise_time,
    entry.bedtime,
  );
  if (factor.exercise_today === 1 && exerciseMinutes !== null && exerciseMinutes >= 120) {
    addHint(hints, {
      suggestedHabitName: 'Exercise earlier in the day',
      practiceId: 'exercise_timing',
      completed: true,
      confidence: 'medium',
      source: 'sleep_factor',
      reason: 'Exercise was logged at least 2 hours before bedtime.',
    });
  }

  const mealMinutes = minutesBeforeBed(factor.last_meal_time, entry.bedtime);
  if (mealMinutes !== null && mealMinutes >= 120) {
    addHint(hints, {
      suggestedHabitName: 'No heavy meals before bed',
      practiceId: 'no_heavy_meals_2h',
      completed: true,
      confidence: 'medium',
      source: 'sleep_factor',
      reason: 'Last meal was logged at least 2 hours before bedtime.',
    });
  }

  return hints;
}
