import type { SleepEntry } from '../models/schemas';
import {
  formatClockMinutes,
  getClockMinutes,
  roundNumber,
} from './analytics';

export type JetLagDirection = 'eastward' | 'westward' | 'none';

export interface JetLagTracker {
  id: string;
  originTimeZone: string;
  destinationTimeZone: string;
  arrivalDate: string;
  originOffsetMinutes: number;
  destinationOffsetMinutes: number;
  timeZoneDifferenceHours: number;
  direction: JetLagDirection;
  targetBedtime: string;
  bodyAlignedBedtime: string;
  dailyAdjustmentHours: number;
  estimatedAdjustmentDays: number;
}

const DEFAULT_TARGET_BEDTIME = '23:00';
const MINUTES_PER_DAY = 24 * 60;
const CLOCK_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeCalendarDate(value: string | Date): string {
  const rawValue = value instanceof Date ? value.toISOString() : value;
  const calendarDate = rawValue.slice(0, 10);
  const parsed = new Date(`${calendarDate}T12:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(calendarDate) ||
    Number.isNaN(parsed.getTime())
  ) {
    throw new Error('arrivalDate must be a valid calendar date or Date.');
  }

  return calendarDate;
}

function parseClockTime(value: string): number {
  const match = CLOCK_TIME_RE.exec(value);
  if (!match) {
    throw new Error('targetBedtime must use HH:MM format.');
  }

  return (Number(match[1]) * 60) + Number(match[2]);
}

function normalizeMinutes(value: number): number {
  return ((Math.round(value) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
}

function normalizeDifferenceHours(value: number): number {
  let normalized = value;
  while (normalized > 12) {
    normalized -= 24;
  }
  while (normalized <= -12) {
    normalized += 24;
  }
  return normalized;
}

function getDirection(differenceHours: number): JetLagDirection {
  if (differenceHours > 0) {
    return 'eastward';
  }
  if (differenceHours < 0) {
    return 'westward';
  }
  return 'none';
}

function getDailyAdjustmentHours(direction: JetLagDirection): number {
  if (direction === 'eastward') {
    return 1;
  }
  if (direction === 'westward') {
    return 1.5;
  }
  return 0;
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  if (!timeZoneName || timeZoneName === 'GMT' || timeZoneName === 'UTC') {
    return 0;
  }

  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(timeZoneName);
  if (!match) {
    throw new Error(`Unable to resolve timezone offset for ${timeZone}.`);
  }

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? '0');
  return sign * ((hours * 60) + minutes);
}

function createTrackerId(
  originTimeZone: string,
  destinationTimeZone: string,
  arrivalDate: string,
): string {
  return `jetlag-${originTimeZone}-${destinationTimeZone}-${arrivalDate}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function circularDistanceMinutes(a: number, b: number): number {
  const delta = Math.abs(normalizeMinutes(a) - normalizeMinutes(b));
  return Math.min(delta, MINUTES_PER_DAY - delta);
}

function getBedtimeMedian(entries: readonly SleepEntry[]): number | null {
  const bedtimes = entries
    .map((entry) => getClockMinutes(entry.bedtime))
    .filter((value): value is number => value !== null);

  if (bedtimes.length === 0) {
    return null;
  }

  const sorted = [...bedtimes].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

export function createJetLagTracker(
  originTimeZone: string,
  destinationTimeZone: string,
  arrivalDate: string | Date,
  targetBedtime = DEFAULT_TARGET_BEDTIME,
): JetLagTracker {
  const normalizedArrivalDate = normalizeCalendarDate(arrivalDate);
  const arrivalInstant = new Date(`${normalizedArrivalDate}T12:00:00.000Z`);
  const originOffsetMinutes = getTimeZoneOffsetMinutes(
    originTimeZone,
    arrivalInstant,
  );
  const destinationOffsetMinutes = getTimeZoneOffsetMinutes(
    destinationTimeZone,
    arrivalInstant,
  );
  const differenceHours = normalizeDifferenceHours(
    (destinationOffsetMinutes - originOffsetMinutes) / 60,
  );
  const direction = getDirection(differenceHours);
  const dailyAdjustmentHours = getDailyAdjustmentHours(direction);
  const targetBedtimeMinutes = parseClockTime(targetBedtime);
  const bodyAlignedBedtimeMinutes = normalizeMinutes(
    targetBedtimeMinutes + (differenceHours * 60),
  );

  return {
    id: createTrackerId(
      originTimeZone,
      destinationTimeZone,
      normalizedArrivalDate,
    ),
    originTimeZone,
    destinationTimeZone,
    arrivalDate: normalizedArrivalDate,
    originOffsetMinutes,
    destinationOffsetMinutes,
    timeZoneDifferenceHours: roundNumber(differenceHours, 2),
    direction,
    targetBedtime: formatClockMinutes(targetBedtimeMinutes),
    bodyAlignedBedtime: formatClockMinutes(bodyAlignedBedtimeMinutes),
    dailyAdjustmentHours,
    estimatedAdjustmentDays:
      dailyAdjustmentHours === 0
        ? 0
        : Math.ceil(Math.abs(differenceHours) / dailyAdjustmentHours),
  };
}

export function getRecommendedSleepTime(
  tracker: JetLagTracker,
  day: number,
): string {
  const targetMinutes = parseClockTime(tracker.targetBedtime);
  const bodyMinutes = parseClockTime(tracker.bodyAlignedBedtime);
  const dayIndex = Math.max(0, Math.floor(day));
  const shiftMinutes = Math.min(
    Math.abs(tracker.timeZoneDifferenceHours) * 60,
    tracker.dailyAdjustmentHours * 60 * dayIndex,
  );
  const adjustmentDirection = tracker.direction === 'eastward' ? -1 : 1;

  if (tracker.direction === 'none') {
    return formatClockMinutes(targetMinutes);
  }

  return formatClockMinutes(bodyMinutes + (adjustmentDirection * shiftMinutes));
}

export function getRecommendation(
  tracker: JetLagTracker,
  day: number,
): string {
  return `Try to sleep at ${getRecommendedSleepTime(tracker, day)} local time tonight.`;
}

export function getAdjustmentProgress(
  tracker: JetLagTracker,
  currentEntries: readonly SleepEntry[],
): number {
  if (tracker.direction === 'none') {
    return 100;
  }

  const entriesSinceArrival = currentEntries.filter(
    (entry) => entry.date >= tracker.arrivalDate,
  );
  const currentBedtime = getBedtimeMedian(entriesSinceArrival);
  if (currentBedtime === null) {
    return 0;
  }

  const targetMinutes = parseClockTime(tracker.targetBedtime);
  const bodyMinutes = parseClockTime(tracker.bodyAlignedBedtime);
  const startingDistance = circularDistanceMinutes(bodyMinutes, targetMinutes);
  if (startingDistance === 0) {
    return 100;
  }

  const currentDistance = circularDistanceMinutes(currentBedtime, targetMinutes);
  const adjustedPercent =
    ((startingDistance - currentDistance) / startingDistance) * 100;
  return Math.max(0, Math.min(100, roundNumber(adjustedPercent, 1)));
}
