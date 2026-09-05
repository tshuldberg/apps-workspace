import type {
  SleepGoal,
  SleepGoalProgress,
  SleepGoalType,
  SleepStreak,
  SleepStreakHistoryPoint,
  SleepStreakType,
} from '../models/goal-schemas';
import type { SleepEntry } from '../models/schemas';
import { addCalendarDays, getClockMinutes } from './analytics';
import { evaluateEntry } from './progress';

export interface SleepGoalWeekDot {
  date: string;
  label: string;
  status: 'met' | 'missed' | 'empty';
}

const GOAL_TYPE_LABELS: Record<SleepGoalType, string> = {
  duration: 'Target hours',
  bedtime: 'Bedtime',
  wake_time: 'Wake time',
  consistency: 'Consistency',
};

const STREAK_TYPE_LABELS: Record<SleepStreakType, string> = {
  quality_above_3: 'Quality 4+',
  on_time_bed: 'On-time bedtime',
  target_hours: 'Target hours',
  no_snooze: 'No snooze',
};

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
});

function dateLabel(date: string): string {
  return DAY_LABEL_FORMATTER.format(new Date(`${date}T12:00:00.000Z`));
}

function formatClockTarget(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return value;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatGoalTypeLabel(type: SleepGoalType): string {
  return GOAL_TYPE_LABELS[type];
}

export function formatStreakTypeLabel(type: SleepStreakType): string {
  return STREAK_TYPE_LABELS[type];
}

export function getDefaultGoalTarget(
  type: SleepGoalType,
  targetHours = 8,
): string {
  if (type === 'duration') {
    return String(targetHours);
  }
  if (type === 'bedtime') {
    return '22:30';
  }
  if (type === 'wake_time') {
    return '06:30';
  }
  return '30';
}

export function getGoalTargetPlaceholder(type: SleepGoalType): string {
  if (type === 'duration') {
    return '8';
  }
  if (type === 'bedtime') {
    return '22:30';
  }
  if (type === 'wake_time') {
    return '06:30';
  }
  return '30';
}

export function formatGoalTarget(
  type: SleepGoalType,
  targetValue: string,
): string {
  if (type === 'duration') {
    return `${targetValue}h`;
  }
  if (type === 'consistency') {
    return `within ${targetValue} min`;
  }
  return formatClockTarget(targetValue);
}

export function formatGoalProgress(progress: SleepGoalProgress): string {
  if (progress.totalEvaluated === 0) {
    return 'No nights evaluated yet';
  }
  return `${progress.met} of ${progress.totalEvaluated} nights on target`;
}

export function isNewLongestStreak(streak: SleepStreak): boolean {
  return streak.current_count > 0 && streak.current_count === streak.longest_count;
}

export function buildWeeklyGoalDots(
  entries: readonly SleepEntry[],
  goals: readonly SleepGoal[],
  weekStart: string,
): SleepGoalWeekDot[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(weekStart, index);
    const entry = entries.find((candidate) => candidate.date === date);
    if (!entry) {
      return { date, label: dateLabel(date), status: 'empty' };
    }

    const evaluation = evaluateEntry(entry, goals, entries);
    if (evaluation.results.length === 0) {
      return { date, label: dateLabel(date), status: 'empty' };
    }

    return {
      date,
      label: dateLabel(date),
      status: evaluation.results.every((result) => result.met)
        ? 'met'
        : 'missed',
    };
  });
}

export function compactStreakHistory(
  history: readonly SleepStreakHistoryPoint[],
  limit = 21,
): SleepStreakHistoryPoint[] {
  return history.slice(Math.max(0, history.length - limit));
}

export function calculateReminderFireDate(
  targetBedtime: string,
  minutesBefore: number,
  now = new Date(),
): Date {
  const targetMinutes = getClockMinutes(`1970-01-01T${targetBedtime}:00.000Z`);
  if (targetMinutes === null) {
    throw new Error('targetBedtime must use HH:MM');
  }

  const fireMinutes =
    (targetMinutes - minutesBefore + 24 * 60) % (24 * 60);
  const fireDate = new Date(now);
  fireDate.setHours(Math.floor(fireMinutes / 60), fireMinutes % 60, 0, 0);

  if (fireDate.getTime() <= now.getTime()) {
    fireDate.setDate(fireDate.getDate() + 1);
  }

  return fireDate;
}

export function formatReminderSummary(
  enabled: boolean,
  targetBedtime: string,
  minutesBefore: number,
): string {
  if (!enabled) {
    return 'Bedtime reminder is off.';
  }

  return `Wind-down reminder ${minutesBefore} minutes before ${formatClockTarget(targetBedtime)}.`;
}
