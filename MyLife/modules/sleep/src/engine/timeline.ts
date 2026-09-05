import type { SleepEntry } from '../models/schemas';
import type { SleepWakeFeeling } from '../types';

export type SleepDurationTone = 'success' | 'warning' | 'danger';

export interface SleepTimelineSection {
  id: string;
  label: string;
  weekStart: string;
  entries: SleepEntry[];
}

const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const FEELING_META: Record<SleepWakeFeeling, { emoji: string; label: string }> =
  {
    refreshed: { emoji: '🌤️', label: 'Refreshed' },
    groggy: { emoji: '🥱', label: 'Groggy' },
    exhausted: { emoji: '😵', label: 'Exhausted' },
    energized: { emoji: '⚡', label: 'Energized' },
  };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseCalendarDate(value: string): Date {
  const match = CALENDAR_DATE_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return parsed;
}

function formatCalendarDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function calendarDateFromNow(now: Date): string {
  return formatCalendarDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0),
  );
}

function addDays(date: string, days: number): string {
  const next = parseCalendarDate(date);
  next.setDate(next.getDate() + days);
  return formatCalendarDate(next);
}

export function getSleepWakeFeelingMeta(feeling: SleepWakeFeeling): {
  emoji: string;
  label: string;
} {
  return FEELING_META[feeling];
}

export function renderSleepQualityStars(rating: number): string {
  return `${'★'.repeat(rating)}${'☆'.repeat(Math.max(0, 5 - rating))}`;
}

export function formatSleepEntryDateLabel(date: string): string {
  return parseCalendarDate(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatSleepWeekLabel(weekStart: string, now = new Date()): string {
  const currentWeekStart = getSleepWeekStart(calendarDateFromNow(now));
  if (weekStart === currentWeekStart) {
    return 'This Week';
  }
  if (weekStart === addDays(currentWeekStart, -7)) {
    return 'Last Week';
  }

  return `Week of ${parseCalendarDate(weekStart).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function formatSleepTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime string: ${value}`);
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getSleepWeekStart(date: string): string {
  const weekStart = parseCalendarDate(date);
  const mondayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  return formatCalendarDate(weekStart);
}

export function getSleepDurationTone(
  durationMinutes: number,
  targetHours: number,
): SleepDurationTone {
  const fallbackTargetHours = Number.isFinite(targetHours) ? targetHours : 8;
  const targetMinutes = Math.max(60, Math.round(fallbackTargetHours * 60));
  const deficit = targetMinutes - durationMinutes;

  if (deficit <= 0) {
    return 'success';
  }
  if (deficit <= 60) {
    return 'warning';
  }
  return 'danger';
}

export function buildSleepTimelineSections(
  entries: SleepEntry[],
  now = new Date(),
): SleepTimelineSection[] {
  const sections: SleepTimelineSection[] = [];

  for (const entry of entries) {
    const weekStart = getSleepWeekStart(entry.date);
    const lastSection = sections[sections.length - 1];

    if (lastSection && lastSection.weekStart === weekStart) {
      lastSection.entries.push(entry);
      continue;
    }

    sections.push({
      id: weekStart,
      label: formatSleepWeekLabel(weekStart, now),
      weekStart,
      entries: [entry],
    });
  }

  return sections;
}
