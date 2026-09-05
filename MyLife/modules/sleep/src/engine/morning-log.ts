import { calculateDuration } from './duration';
import type { SleepEntryCreateInput, SleepEntry } from '../models/schemas';
import type { SleepWakeFeeling } from '../types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface MorningLogDraft {
  bedtimeTime: string;
  wakeTime: string;
  qualityRating: number | null;
  wakeFeeling: SleepWakeFeeling | null;
  wakeCount: number;
  notesMd?: string;
}

export interface MorningLogSummary {
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  durationLabel: string;
  qualityRating: number;
  wakeFeeling: SleepWakeFeeling;
  wakeCount: number;
  notesMd: string | null;
}

interface ParsedTime {
  hours: number;
  minutes: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseTime(value: string): ParsedTime {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid time value: ${value}`);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function parseCalendarDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date value: ${value}`);
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
    throw new Error(`Invalid date value: ${value}`);
  }

  return parsed;
}

function withLocalTime(reference: Date, time: string): Date {
  const { hours, minutes } = parseTime(time);
  const next = new Date(reference);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function withCalendarDateAndTime(date: string, time: string): Date {
  return withLocalTime(parseCalendarDate(date), time);
}

function minutesFromTimeString(time: string): number {
  const { hours, minutes } = parseTime(time);
  return (hours * 60) + minutes;
}

function resolveWakeDate(now: Date, wakeTime: string): Date {
  const wakeDate = withLocalTime(now, wakeTime);
  if (wakeDate.getTime() > now.getTime()) {
    wakeDate.setDate(wakeDate.getDate() - 1);
  }
  return wakeDate;
}

function resolveBedtimeDate(wakeDate: Date, bedtimeTime: string, wakeTime: string): Date {
  const bedtimeDate = withLocalTime(wakeDate, bedtimeTime);
  if (minutesFromTimeString(bedtimeTime) > minutesFromTimeString(wakeTime)) {
    bedtimeDate.setDate(bedtimeDate.getDate() - 1);
  }
  return bedtimeDate;
}

function normalizeNotes(notesMd?: string): string | undefined {
  const trimmed = notesMd?.trim();
  return trimmed ? trimmed : undefined;
}

export function formatDurationLabel(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function buildMorningLogEntryInput(
  draft: MorningLogDraft,
  now = new Date(),
): SleepEntryCreateInput {
  const wakeDate = resolveWakeDate(now, draft.wakeTime);
  return buildMorningLogEntryInputForDate(draft, formatLocalDate(wakeDate));
}

export function buildMorningLogEntryInputForDate(
  draft: MorningLogDraft,
  wakeDate: string,
): SleepEntryCreateInput {
  if (draft.qualityRating == null) {
    throw new Error('qualityRating is required');
  }
  if (draft.wakeFeeling == null) {
    throw new Error('wakeFeeling is required');
  }

  const wakeDateTime = withCalendarDateAndTime(wakeDate, draft.wakeTime);
  const bedtimeDate = resolveBedtimeDate(
    wakeDateTime,
    draft.bedtimeTime,
    draft.wakeTime,
  );

  return {
    bedtime: bedtimeDate.toISOString(),
    wake_time: wakeDateTime.toISOString(),
    quality_rating: draft.qualityRating,
    wake_count: draft.wakeCount,
    wake_feeling: draft.wakeFeeling,
    notes_md: normalizeNotes(draft.notesMd),
  };
}

export function getMorningLogSummary(
  draft: MorningLogDraft,
  now = new Date(),
): MorningLogSummary {
  const wakeDate = resolveWakeDate(now, draft.wakeTime);
  return getMorningLogSummaryForDate(draft, formatLocalDate(wakeDate));
}

export function getMorningLogSummaryForDate(
  draft: MorningLogDraft,
  wakeDate: string,
): MorningLogSummary {
  const input = buildMorningLogEntryInputForDate(draft, wakeDate);
  const durationMinutes = calculateDuration(input.bedtime, input.wake_time);

  return {
    bedtime: input.bedtime,
    wakeTime: input.wake_time,
    durationMinutes,
    durationLabel: formatDurationLabel(durationMinutes),
    qualityRating: input.quality_rating,
    wakeFeeling: input.wake_feeling,
    wakeCount: input.wake_count ?? 0,
    notesMd: input.notes_md ?? null,
  };
}

export function getMorningLogDraftFromEntry(entry: SleepEntry): MorningLogDraft {
  return {
    bedtimeTime: entry.bedtime.slice(11, 16),
    wakeTime: entry.wake_time.slice(11, 16),
    qualityRating: entry.quality_rating,
    wakeFeeling: entry.wake_feeling,
    wakeCount: entry.wake_count,
    notesMd: entry.notes_md ?? '',
  };
}
