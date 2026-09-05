const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateTime(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be a valid datetime string`);
  }
  return parsed;
}

function calendarDateKey(value: string): string {
  return value.includes('T') ? value.slice(0, 10) : value;
}

function minutesBetween(
  startValue: string,
  endValue: string,
  startField: string,
  endField: string,
): number {
  const start = parseDateTime(startValue, startField);
  const end = parseDateTime(endValue, endField);
  let diff = end - start;

  if (diff <= 0) {
    if (calendarDateKey(startValue) !== calendarDateKey(endValue)) {
      throw new Error(`${endField} must be after ${startField}`);
    }
    diff += DAY_MS;
  }

  const minutes = Math.round(diff / MINUTE_MS);
  if (minutes <= 0) {
    throw new Error(`${endField} must be after ${startField}`);
  }

  return minutes;
}

export function calculateDuration(bedtime: string, wakeTime: string): number {
  return minutesBetween(bedtime, wakeTime, 'bedtime', 'wakeTime');
}

export function calculateSleepLatency(
  bedtime: string,
  sleepOnset: string,
): number {
  return minutesBetween(bedtime, sleepOnset, 'bedtime', 'sleepOnset');
}
