import type { SleepEntry } from '../models/schemas';
import { formatClockMinutes, roundNumber } from './analytics';

export interface ShiftBlock {
  startTime: string;
  endTime: string;
  daysOfWeek: readonly number[];
  sleepWindowOffsetMinutes?: number;
  sleepDurationMinutes?: number;
}

export interface ShiftPattern {
  blocks: ShiftBlock[];
}

export interface ExpectedSleepWindow {
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  sleepStart: string;
  sleepEnd: string;
  sleepStartTime: string;
  sleepEndTime: string;
  sleepDurationMinutes: number;
  sourceShift: ShiftBlock;
}

export type ShiftSleepRating = 'aligned' | 'partial' | 'off_schedule';

export interface ShiftSleepEvaluation {
  score: number;
  matched: boolean;
  rating: ShiftSleepRating;
  overlapMinutes: number;
  expectedDurationMinutes: number;
  actualDurationMinutes: number;
  bedtimeDeltaMinutes: number;
  wakeDeltaMinutes: number;
}

const CLOCK_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 24 * 60;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_SLEEP_OFFSET_MINUTES = 90;
const DEFAULT_SLEEP_DURATION_MINUTES = 8 * 60;
const DEFAULT_DAY_SHIFT_SLEEP_START = (22 * 60) + 30;

function parseClockTime(value: string): number {
  const match = CLOCK_TIME_RE.exec(value);
  if (!match) {
    throw new Error('Shift times must use HH:MM format.');
  }

  return (Number(match[1]) * 60) + Number(match[2]);
}

function normalizeCalendarDate(value: string | Date): string {
  const rawValue = value instanceof Date ? value.toISOString() : value;
  const calendarDate = rawValue.slice(0, 10);
  const parsed = new Date(`${calendarDate}T12:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(calendarDate) ||
    Number.isNaN(parsed.getTime())
  ) {
    throw new Error('date must be a valid calendar date or Date.');
  }

  return calendarDate;
}

function getDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function normalizeDayOfWeek(day: number): number {
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw new Error('daysOfWeek values must be integers from 0 to 6.');
  }

  return day;
}

function normalizeDurationMinutes(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return DEFAULT_SLEEP_DURATION_MINUTES;
  }

  return Math.round(value);
}

function buildDateTime(date: string, minutesFromStartOfDate: number): string {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(start + (minutesFromStartOfDate * MINUTE_MS)).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + (minutes * MINUTE_MS)).toISOString();
}

function getIntervalMinutes(start: string, end: string): number {
  let startMs = Date.parse(start);
  let endMs = Date.parse(end);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error('Sleep interval values must be valid datetimes.');
  }

  if (endMs <= startMs) {
    endMs += 24 * HOUR_MS;
  }

  return Math.round((endMs - startMs) / MINUTE_MS);
}

function getOverlapMinutes(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): number {
  let firstStartMs = Date.parse(firstStart);
  let firstEndMs = Date.parse(firstEnd);
  let secondStartMs = Date.parse(secondStart);
  let secondEndMs = Date.parse(secondEnd);

  if (firstEndMs <= firstStartMs) {
    firstEndMs += 24 * HOUR_MS;
  }
  if (secondEndMs <= secondStartMs) {
    secondEndMs += 24 * HOUR_MS;
  }

  const overlapMs =
    Math.min(firstEndMs, secondEndMs) - Math.max(firstStartMs, secondStartMs);
  return Math.max(0, Math.round(overlapMs / MINUTE_MS));
}

function isNightOrLateShift(startMinutes: number, endMinutes: number): boolean {
  return (
    endMinutes <= startMinutes ||
    startMinutes >= 18 * 60 ||
    endMinutes <= 9 * 60 ||
    endMinutes >= 21 * 60
  );
}

function normalizeBlock(block: ShiftBlock): ShiftBlock {
  parseClockTime(block.startTime);
  parseClockTime(block.endTime);
  const daysOfWeek = [...new Set(block.daysOfWeek.map(normalizeDayOfWeek))]
    .sort((a, b) => a - b);

  if (daysOfWeek.length === 0) {
    throw new Error('A shift block must include at least one day of week.');
  }

  return {
    startTime: block.startTime,
    endTime: block.endTime,
    daysOfWeek,
    sleepWindowOffsetMinutes: block.sleepWindowOffsetMinutes,
    sleepDurationMinutes: block.sleepDurationMinutes,
  };
}

function resolveBlocks(pattern: ShiftPattern | readonly ShiftBlock[]): ShiftBlock[] {
  return 'blocks' in pattern ? pattern.blocks : [...pattern];
}

function getMatchingShiftBlock(
  date: string,
  pattern: ShiftPattern | readonly ShiftBlock[],
): ShiftBlock | null {
  const dayOfWeek = getDayOfWeek(date);

  for (const rawBlock of resolveBlocks(pattern)) {
    const block = normalizeBlock(rawBlock);
    if (block.daysOfWeek.includes(dayOfWeek)) {
      return block;
    }
  }

  return null;
}

function getShiftEndMinutes(startMinutes: number, endMinutes: number): number {
  return endMinutes <= startMinutes ? endMinutes + MINUTES_PER_DAY : endMinutes;
}

export function setShiftPattern(pattern: readonly ShiftBlock[]): ShiftPattern {
  return {
    blocks: pattern.map(normalizeBlock),
  };
}

export function getExpectedSleepWindow(
  date: string | Date,
  pattern: ShiftPattern | readonly ShiftBlock[],
): ExpectedSleepWindow | null {
  const shiftDate = normalizeCalendarDate(date);
  const shift = getMatchingShiftBlock(shiftDate, pattern);
  if (!shift) {
    return null;
  }

  const startMinutes = parseClockTime(shift.startTime);
  const endMinutes = parseClockTime(shift.endTime);
  const shiftEndMinutes = getShiftEndMinutes(startMinutes, endMinutes);
  const sleepDurationMinutes = normalizeDurationMinutes(
    shift.sleepDurationMinutes,
  );
  const offsetMinutes =
    shift.sleepWindowOffsetMinutes ?? DEFAULT_SLEEP_OFFSET_MINUTES;
  const sleepStartMinutes = isNightOrLateShift(startMinutes, endMinutes)
    ? shiftEndMinutes + offsetMinutes
    : DEFAULT_DAY_SHIFT_SLEEP_START;
  const shiftStart = buildDateTime(shiftDate, startMinutes);
  const shiftEnd = buildDateTime(shiftDate, shiftEndMinutes);
  const sleepStart = buildDateTime(shiftDate, sleepStartMinutes);
  const sleepEnd = addMinutes(sleepStart, sleepDurationMinutes);

  return {
    shiftDate,
    shiftStart,
    shiftEnd,
    sleepStart,
    sleepEnd,
    sleepStartTime: formatClockMinutes(sleepStartMinutes),
    sleepEndTime: formatClockMinutes(
      sleepStartMinutes + sleepDurationMinutes,
    ),
    sleepDurationMinutes,
    sourceShift: shift,
  };
}

export function evaluateShiftSleep(
  entry: SleepEntry,
  expectedWindow: ExpectedSleepWindow | null,
): ShiftSleepEvaluation {
  if (!expectedWindow) {
    return {
      score: 0,
      matched: false,
      rating: 'off_schedule',
      overlapMinutes: 0,
      expectedDurationMinutes: 0,
      actualDurationMinutes: entry.duration_minutes,
      bedtimeDeltaMinutes: 0,
      wakeDeltaMinutes: 0,
    };
  }

  const actualDurationMinutes = getIntervalMinutes(
    entry.bedtime,
    entry.wake_time,
  );
  const expectedDurationMinutes = getIntervalMinutes(
    expectedWindow.sleepStart,
    expectedWindow.sleepEnd,
  );
  const overlapMinutes = getOverlapMinutes(
    entry.bedtime,
    entry.wake_time,
    expectedWindow.sleepStart,
    expectedWindow.sleepEnd,
  );
  const bedtimeDeltaMinutes = Math.abs(
    Math.round(
      (Date.parse(entry.bedtime) - Date.parse(expectedWindow.sleepStart)) /
        MINUTE_MS,
    ),
  );
  const wakeDeltaMinutes = Math.abs(
    Math.round(
      (Date.parse(entry.wake_time) - Date.parse(expectedWindow.sleepEnd)) /
        MINUTE_MS,
    ),
  );
  const overlapScore =
    expectedDurationMinutes === 0
      ? 0
      : (overlapMinutes / expectedDurationMinutes) * 100;
  const timingPenalty = Math.min(25, (bedtimeDeltaMinutes + wakeDeltaMinutes) / 24);
  const score = Math.max(0, Math.min(100, roundNumber(overlapScore - timingPenalty, 1)));
  const rating: ShiftSleepRating =
    score >= 85 ? 'aligned' : score >= 50 ? 'partial' : 'off_schedule';

  return {
    score,
    matched: score >= 70,
    rating,
    overlapMinutes,
    expectedDurationMinutes,
    actualDurationMinutes,
    bedtimeDeltaMinutes,
    wakeDeltaMinutes,
  };
}
