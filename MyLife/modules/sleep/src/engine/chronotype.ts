import type { SleepEntry } from '../models/schemas';
import {
  formatClockMinutes,
  getClockMinutes,
  normalizeBedtimeMinutes,
  roundNumber,
} from './analytics';

export type Chronotype =
  | 'early_bird'
  | 'moderate_morning'
  | 'intermediate'
  | 'moderate_evening'
  | 'night_owl';

export type ChronotypeAssessmentStatus = 'insufficient_data' | 'assessed';

export interface ChronotypeAssessmentResult {
  status: ChronotypeAssessmentStatus;
  chronotype: Chronotype | null;
  freeDaySampleSize: number;
  requiredFreeDayEntries: number;
  medianBedtime: string | null;
  medianWakeTime: string | null;
  midpoint: string | null;
  confidence: 'insufficient_data' | 'medium' | 'high';
  description: string;
}

export type CircadianProfilePhase =
  | 'sleep_pressure'
  | 'morning_rise'
  | 'peak'
  | 'dip'
  | 'secondary_peak'
  | 'wind_down';

export interface CircadianProfilePoint {
  hour: number;
  clockTime: string;
  hoursAfterWake: number;
  alertness: number;
  phase: CircadianProfilePhase;
  label: string;
}

export interface CircadianProfile {
  recommendedWakeTime: string;
  sampleSize: number;
  points: CircadianProfilePoint[];
}

interface FreeDayTiming {
  bedtimeMinutes: number;
  wakeMinutes: number;
  wakeTimelineMinutes: number;
  midpointMinutes: number;
}

const REQUIRED_FREE_DAY_ENTRIES = 14;
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_WAKE_TIME_MINUTES = 7 * 60;

function parseCalendarDate(value: string): Date | null {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWeekendDate(value: string): boolean {
  const parsed = parseCalendarDate(value);
  if (!parsed) {
    return false;
  }

  const day = parsed.getUTCDay();
  return day === 0 || day === 6;
}

function getMedian(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function normalizeWakeTimeline(
  bedtimeMinutes: number,
  wakeMinutes: number,
): number {
  let wakeTimelineMinutes = wakeMinutes;
  while (wakeTimelineMinutes <= bedtimeMinutes) {
    wakeTimelineMinutes += MINUTES_PER_DAY;
  }
  return wakeTimelineMinutes;
}

function getEntryTiming(entry: SleepEntry): FreeDayTiming | null {
  const rawBedtime = getClockMinutes(entry.bedtime);
  const rawWakeTime = getClockMinutes(entry.wake_time);

  if (rawBedtime === null || rawWakeTime === null) {
    return null;
  }

  const bedtimeMinutes = normalizeBedtimeMinutes(rawBedtime);
  const wakeTimelineMinutes = normalizeWakeTimeline(
    bedtimeMinutes,
    rawWakeTime,
  );
  const midpointMinutes =
    (bedtimeMinutes + ((wakeTimelineMinutes - bedtimeMinutes) / 2)) %
    MINUTES_PER_DAY;

  return {
    bedtimeMinutes,
    wakeMinutes: rawWakeTime,
    wakeTimelineMinutes,
    midpointMinutes,
  };
}

function getFreeDayTimings(entries: readonly SleepEntry[]): FreeDayTiming[] {
  return entries
    .filter((entry) => isWeekendDate(entry.date))
    .map(getEntryTiming)
    .filter((value): value is FreeDayTiming => value !== null);
}

function classifyChronotype(midpointMinutes: number): Chronotype {
  if (midpointMinutes < (3 * 60) + 30) {
    return 'early_bird';
  }
  if (midpointMinutes < (4 * 60) + 30) {
    return 'moderate_morning';
  }
  if (midpointMinutes < (5 * 60) + 30) {
    return 'intermediate';
  }
  if (midpointMinutes < (6 * 60) + 30) {
    return 'moderate_evening';
  }
  return 'night_owl';
}

function getChronotypeDescription(chronotype: Chronotype | null): string {
  switch (chronotype) {
    case 'early_bird':
      return 'Your free-day midpoint is early, which points to a naturally morning-leaning rhythm.';
    case 'moderate_morning':
      return 'Your free-day sleep timing leans morning, but not at an extreme.';
    case 'intermediate':
      return 'Your free-day sleep timing sits near the middle of the chronotype range.';
    case 'moderate_evening':
      return 'Your free-day sleep timing leans evening, suggesting a later natural rhythm.';
    case 'night_owl':
      return 'Your free-day midpoint is late, which points to a naturally evening-leaning rhythm.';
    default:
      return 'Log more weekend or free-day sleep to estimate your chronotype.';
  }
}

function getTypicalWakeTime(entries: readonly SleepEntry[]): number {
  const wakeTimes = entries
    .map((entry) => getClockMinutes(entry.wake_time))
    .filter((value): value is number => value !== null);

  return getMedian(wakeTimes) ?? DEFAULT_WAKE_TIME_MINUTES;
}

function getCircadianPoint(
  hour: number,
  wakeMinutes: number,
): CircadianProfilePoint {
  const clockMinutes = hour * 60;
  const minutesAfterWake =
    (clockMinutes - wakeMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hoursAfterWake = roundNumber(minutesAfterWake / 60, 1);

  if (hoursAfterWake >= 2 && hoursAfterWake <= 4) {
    return {
      hour,
      clockTime: formatClockMinutes(clockMinutes),
      hoursAfterWake,
      alertness: 92,
      phase: 'peak',
      label: 'Peak alertness',
    };
  }

  if (hoursAfterWake >= 6 && hoursAfterWake <= 8) {
    return {
      hour,
      clockTime: formatClockMinutes(clockMinutes),
      hoursAfterWake,
      alertness: 58,
      phase: 'dip',
      label: 'Afternoon dip',
    };
  }

  if (hoursAfterWake >= 9 && hoursAfterWake <= 11) {
    return {
      hour,
      clockTime: formatClockMinutes(clockMinutes),
      hoursAfterWake,
      alertness: 82,
      phase: 'secondary_peak',
      label: 'Second wind',
    };
  }

  if (hoursAfterWake < 2) {
    return {
      hour,
      clockTime: formatClockMinutes(clockMinutes),
      hoursAfterWake,
      alertness: 48 + Math.round(hoursAfterWake * 14),
      phase: 'morning_rise',
      label: 'Waking up',
    };
  }

  if (hoursAfterWake >= 16 && hoursAfterWake < 20) {
    return {
      hour,
      clockTime: formatClockMinutes(clockMinutes),
      hoursAfterWake,
      alertness: 54 - Math.round((hoursAfterWake - 16) * 6),
      phase: 'wind_down',
      label: 'Winding down',
    };
  }

  if (hoursAfterWake >= 20 || hoursAfterWake < 0) {
    return {
      hour,
      clockTime: formatClockMinutes(clockMinutes),
      hoursAfterWake,
      alertness: 28,
      phase: 'sleep_pressure',
      label: 'Sleep pressure',
    };
  }

  return {
    hour,
    clockTime: formatClockMinutes(clockMinutes),
    hoursAfterWake,
    alertness: 72,
    phase: 'morning_rise',
    label: 'Steady alertness',
  };
}

export function getChronotypeAssessment(
  entries: readonly SleepEntry[],
): ChronotypeAssessmentResult {
  const timings = getFreeDayTimings(entries);
  const medianBedtime = getMedian(
    timings.map((timing) => timing.bedtimeMinutes),
  );
  const medianWakeTime = getMedian(timings.map((timing) => timing.wakeMinutes));
  const medianMidpoint = getMedian(
    timings.map((timing) => timing.midpointMinutes),
  );

  if (timings.length < REQUIRED_FREE_DAY_ENTRIES || medianMidpoint === null) {
    return {
      status: 'insufficient_data',
      chronotype: null,
      freeDaySampleSize: timings.length,
      requiredFreeDayEntries: REQUIRED_FREE_DAY_ENTRIES,
      medianBedtime:
        medianBedtime === null ? null : formatClockMinutes(medianBedtime),
      medianWakeTime:
        medianWakeTime === null ? null : formatClockMinutes(medianWakeTime),
      midpoint: null,
      confidence: 'insufficient_data',
      description: getChronotypeDescription(null),
    };
  }

  const chronotype = classifyChronotype(medianMidpoint);
  return {
    status: 'assessed',
    chronotype,
    freeDaySampleSize: timings.length,
    requiredFreeDayEntries: REQUIRED_FREE_DAY_ENTRIES,
    medianBedtime:
      medianBedtime === null ? null : formatClockMinutes(medianBedtime),
    medianWakeTime:
      medianWakeTime === null ? null : formatClockMinutes(medianWakeTime),
    midpoint: formatClockMinutes(medianMidpoint),
    confidence: timings.length >= 24 ? 'high' : 'medium',
    description: getChronotypeDescription(chronotype),
  };
}

export function assessChronotype(entries: readonly SleepEntry[]): Chronotype {
  const result = getChronotypeAssessment(entries);
  if (result.status === 'insufficient_data' || result.chronotype === null) {
    throw new Error('Chronotype assessment requires 14 free-day entries.');
  }

  return result.chronotype;
}

export function getCircadianProfile(
  entries: readonly SleepEntry[],
): CircadianProfile {
  const wakeMinutes = getTypicalWakeTime(entries);

  return {
    recommendedWakeTime: formatClockMinutes(wakeMinutes),
    sampleSize: entries.length,
    points: Array.from({ length: 24 }, (_, hour) =>
      getCircadianPoint(hour, wakeMinutes),
    ),
  };
}
