import type { SleepEntry } from '../models/schemas';
import {
  parseGoalTargetNumber,
  type SleepGoal,
  type SleepGoalType,
  type SleepStreak,
  type SleepStreakType,
} from '../models/goal-schemas';
import {
  addCalendarDays,
  getClockMinutes,
  normalizeBedtimeMinutes,
  roundNumber,
} from './analytics';

export interface SleepGoalEvaluationResult {
  goalId: string;
  type: SleepGoalType;
  met: boolean;
  targetValue: string;
  actualValue: number | null;
}

export interface SleepEntryGoalEvaluation {
  entryId: string;
  date: string;
  goalsMet: SleepGoal[];
  goalsMissed: SleepGoal[];
  results: SleepGoalEvaluationResult[];
}

export interface SleepWeeklyProgressSummary {
  weekStart: string;
  weekEnd: string;
  daysOnTarget: number;
  evaluatedDays: number;
  avgQuality: number | null;
  longestStreak: number;
  goalAdherencePercentage: number;
  goalsMet: number;
  goalsMissed: number;
}

export interface SleepStreakEvaluationOptions {
  targetHours?: number;
  targetBedtime?: string;
  goals?: readonly SleepGoal[];
}

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_CONSISTENCY_TOLERANCE_MINUTES = 30;

function sortEntriesOldestFirst(entries: readonly SleepEntry[]): SleepEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    if (a.wake_time !== b.wake_time) {
      return a.wake_time < b.wake_time ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}

function clockDistanceMinutes(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return Math.min(delta, MINUTES_PER_DAY - delta);
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getEntryBedtimeMinutes(entry: SleepEntry): number | null {
  const minutes = getClockMinutes(entry.sleep_onset_time ?? entry.bedtime);
  return minutes === null ? null : normalizeBedtimeMinutes(minutes);
}

function getEntryWakeMinutes(entry: SleepEntry): number | null {
  return getClockMinutes(entry.wake_time);
}

function getTargetClockMinutes(goal: SleepGoal): number {
  const minutes = getClockMinutes(`1970-01-01T${goal.target_value}:00.000Z`);
  if (minutes === null) {
    throw new Error(`${goal.type} goal target must use HH:MM`);
  }
  return minutes;
}

function getRelevantHistory(
  entry: SleepEntry,
  entries: readonly SleepEntry[],
): SleepEntry[] {
  const startDate = addCalendarDays(entry.date, -7);
  const recent = entries.filter(
    (candidate) =>
      candidate.id !== entry.id &&
      candidate.date >= startDate &&
      candidate.date < entry.date,
  );

  if (recent.length > 0) {
    return recent;
  }

  return entries.filter(
    (candidate) => candidate.id !== entry.id && candidate.date < entry.date,
  );
}

function evaluateDurationGoal(entry: SleepEntry, goal: SleepGoal): boolean {
  return entry.duration_minutes >= parseGoalTargetNumber(goal) * 60;
}

function evaluateBedtimeGoal(entry: SleepEntry, goal: SleepGoal): boolean {
  const actual = getEntryBedtimeMinutes(entry);
  if (actual === null) {
    return false;
  }

  const target = normalizeBedtimeMinutes(getTargetClockMinutes(goal));
  return actual <= target + 30;
}

function evaluateWakeTimeGoal(entry: SleepEntry, goal: SleepGoal): boolean {
  const actual = getEntryWakeMinutes(entry);
  if (actual === null) {
    return false;
  }

  return actual <= getTargetClockMinutes(goal) + 30;
}

function evaluateConsistencyGoal(
  entry: SleepEntry,
  goal: SleepGoal,
  entries: readonly SleepEntry[],
): boolean {
  const history = getRelevantHistory(entry, entries);
  const bedtimeSamples = history
    .map(getEntryBedtimeMinutes)
    .filter((value): value is number => value !== null);
  const wakeSamples = history
    .map(getEntryWakeMinutes)
    .filter((value): value is number => value !== null);
  const avgBedtime = average(bedtimeSamples);
  const avgWake = average(wakeSamples);
  const actualBedtime = getEntryBedtimeMinutes(entry);
  const actualWake = getEntryWakeMinutes(entry);

  if (
    avgBedtime === null ||
    avgWake === null ||
    actualBedtime === null ||
    actualWake === null
  ) {
    return false;
  }

  const tolerance =
    goal.target_value === ''
      ? DEFAULT_CONSISTENCY_TOLERANCE_MINUTES
      : parseGoalTargetNumber(goal);

  return (
    Math.abs(actualBedtime - avgBedtime) <= tolerance &&
    clockDistanceMinutes(actualWake, avgWake) <= tolerance
  );
}

function evaluateGoal(
  entry: SleepEntry,
  goal: SleepGoal,
  entries: readonly SleepEntry[],
): boolean {
  if (goal.type === 'duration') {
    return evaluateDurationGoal(entry, goal);
  }
  if (goal.type === 'bedtime') {
    return evaluateBedtimeGoal(entry, goal);
  }
  if (goal.type === 'wake_time') {
    return evaluateWakeTimeGoal(entry, goal);
  }

  return evaluateConsistencyGoal(entry, goal, entries);
}

function getActualValue(entry: SleepEntry, type: SleepGoalType): number | null {
  if (type === 'duration') {
    return roundNumber(entry.duration_minutes / 60, 2);
  }
  if (type === 'bedtime') {
    const bedtime = getEntryBedtimeMinutes(entry);
    return bedtime === null ? null : bedtime;
  }
  if (type === 'wake_time') {
    return getEntryWakeMinutes(entry);
  }

  return null;
}

function getActiveGoals(goals: readonly SleepGoal[], entryDate: string): SleepGoal[] {
  return goals.filter(
    (goal) =>
      goal.is_active &&
      (!goal.start_date || goal.start_date <= entryDate) &&
      (!goal.end_date || goal.end_date >= entryDate),
  );
}

export function evaluateEntry(
  entry: SleepEntry,
  goals: readonly SleepGoal[],
  entries: readonly SleepEntry[] = [entry],
): SleepEntryGoalEvaluation {
  const activeGoals = getActiveGoals(goals, entry.date);
  const goalsMet: SleepGoal[] = [];
  const goalsMissed: SleepGoal[] = [];
  const results: SleepGoalEvaluationResult[] = [];

  for (const goal of activeGoals) {
    const met = evaluateGoal(entry, goal, entries);
    if (met) {
      goalsMet.push(goal);
    } else {
      goalsMissed.push(goal);
    }
    results.push({
      goalId: goal.id,
      type: goal.type,
      met,
      targetValue: goal.target_value,
      actualValue: getActualValue(entry, goal.type),
    });
  }

  return {
    entryId: entry.id,
    date: entry.date,
    goalsMet,
    goalsMissed,
    results,
  };
}

function deriveLongestAllGoalStreak(
  entries: readonly SleepEntry[],
  goals: readonly SleepGoal[],
): number {
  let current = 0;
  let longest = 0;

  for (const entry of sortEntriesOldestFirst(entries)) {
    const evaluation = evaluateEntry(entry, goals, entries);
    if (
      evaluation.results.length > 0 &&
      evaluation.results.every((result) => result.met)
    ) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

export function getWeeklySummary(
  entries: readonly SleepEntry[],
  goals: readonly SleepGoal[],
  weekStart: string,
  streaks: readonly SleepStreak[] = [],
): SleepWeeklyProgressSummary {
  const weekEnd = addCalendarDays(weekStart, 6);
  const weekEntries = sortEntriesOldestFirst(
    entries.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd),
  );
  const qualityRatings = weekEntries.map((entry) => entry.quality_rating);
  const evaluations = weekEntries.map((entry) =>
    evaluateEntry(entry, goals, entries),
  );
  const results = evaluations.flatMap((evaluation) => evaluation.results);
  const metCount = results.filter((result) => result.met).length;
  const missedCount = results.length - metCount;
  const daysOnTarget = evaluations.filter(
    (evaluation) =>
      evaluation.results.length > 0 &&
      evaluation.results.every((result) => result.met),
  ).length;
  const recordedLongest = streaks.reduce(
    (max, streak) => Math.max(max, streak.longest_count),
    0,
  );

  return {
    weekStart,
    weekEnd,
    daysOnTarget,
    evaluatedDays: weekEntries.length,
    avgQuality:
      qualityRatings.length === 0
        ? null
        : roundNumber(
            qualityRatings.reduce((sum, value) => sum + value, 0) /
              qualityRatings.length,
            2,
          ),
    longestStreak: Math.max(
      recordedLongest,
      deriveLongestAllGoalStreak(entries, goals),
    ),
    goalAdherencePercentage:
      results.length === 0 ? 0 : roundNumber((metCount / results.length) * 100, 1),
    goalsMet: metCount,
    goalsMissed: missedCount,
  };
}

export function generateAccountabilityMessage(
  summary: SleepWeeklyProgressSummary,
): string {
  if (summary.evaluatedDays === 0) {
    return 'Log a few nights this week and MySleep will turn them into a gentle progress check-in.';
  }

  if (summary.goalsMet + summary.goalsMissed === 0) {
    return `You logged ${summary.evaluatedDays} nights this week. Add a sleep goal when you want a simple target to track.`;
  }

  if (summary.daysOnTarget === summary.evaluatedDays) {
    return `You hit your sleep goals all ${summary.evaluatedDays} logged nights this week. Nice consistency.`;
  }

  return `You hit your sleep goals ${summary.daysOnTarget} of ${summary.evaluatedDays} logged nights this week. Keep an eye on the routines that helped.`;
}

function findGoal(
  goals: readonly SleepGoal[] | undefined,
  type: SleepGoalType,
): SleepGoal | null {
  return goals?.find((goal) => goal.type === type && goal.is_active) ?? null;
}

export function evaluateStreakType(
  entry: SleepEntry,
  type: SleepStreakType,
  options: SleepStreakEvaluationOptions = {},
): boolean {
  if (type === 'quality_above_3') {
    return entry.quality_rating >= 4;
  }
  if (type === 'no_snooze') {
    return entry.snooze_count === 0;
  }
  if (type === 'target_hours') {
    const durationGoal = findGoal(options.goals, 'duration');
    const targetHours = durationGoal
      ? parseGoalTargetNumber(durationGoal)
      : (options.targetHours ?? 8);
    return entry.duration_minutes >= targetHours * 60;
  }

  const bedtimeGoal = findGoal(options.goals, 'bedtime');
  const targetBedtime = bedtimeGoal?.target_value ?? options.targetBedtime;
  if (!targetBedtime) {
    return false;
  }

  return evaluateBedtimeGoal(entry, {
    id: 'streak-bedtime-target',
    type: 'bedtime',
    target_value: targetBedtime,
    start_date: null,
    end_date: null,
    is_active: true,
    notes: null,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  });
}
