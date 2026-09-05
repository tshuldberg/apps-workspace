/**
 * Smart Water Reminder Engine
 *
 * Pure TypeScript logic for personalized water targets and reminder scheduling.
 * No notification API calls here -- those live in the mobile hook.
 */

// ── Personalized Target ──

const MIN_GLASSES = 4;
const MAX_GLASSES = 30;
const OZ_PER_GLASS = 8;
const ML_PER_OZ = 29.5735;

/**
 * Calculate a personalized daily water target in glasses based on body weight.
 *
 * Formula:
 * - lbs: weight * 0.5 oz / 8 oz per glass
 * - kg: weight * 33 ml / 29.5735 ml per oz / 8 oz per glass
 *
 * Result clamped to [4, 30] glasses.
 */
export function calculatePersonalizedTarget(
  weight: number,
  unit: 'lbs' | 'kg',
): number {
  if (weight <= 0) return MIN_GLASSES;

  let glasses: number;
  if (unit === 'lbs') {
    glasses = (weight * 0.5) / OZ_PER_GLASS;
  } else {
    // kg: weight * 33ml, convert to oz, then to glasses
    glasses = (weight * 33) / ML_PER_OZ / OZ_PER_GLASS;
  }

  return Math.max(MIN_GLASSES, Math.min(MAX_GLASSES, Math.round(glasses)));
}

// ── Reminder Scheduling ──

/** Parse an "HH:MM" string into { hour, minute } */
function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m };
}

/** Convert { hour, minute } to minutes since midnight */
function toMinutes(h: number, m: number): number {
  return h * 60 + m;
}

/**
 * Calculate the next reminder time from the current time.
 *
 * Rounds up to the next interval boundary within waking hours.
 * If current time is past wakeEnd, returns tomorrow's wakeStart.
 * If current time is before wakeStart, returns wakeStart.
 */
export function calculateNextReminderTime(
  now: Date,
  intervalMinutes: number,
  wakeStart: string,
  wakeEnd: string,
): Date {
  const ws = parseTime(wakeStart);
  const we = parseTime(wakeEnd);
  const wsMin = toMinutes(ws.hour, ws.minute);
  const weMin = toMinutes(we.hour, we.minute);
  const nowMin = toMinutes(now.getHours(), now.getMinutes());

  const spansMiddnight = weMin <= wsMin;

  // Check if we're within waking hours
  let inWakingHours: boolean;
  if (spansMiddnight) {
    inWakingHours = nowMin >= wsMin || nowMin < weMin;
  } else {
    inWakingHours = nowMin >= wsMin && nowMin < weMin;
  }

  if (!inWakingHours) {
    // Before wake start or after wake end
    if (!spansMiddnight && nowMin < wsMin) {
      // Before wake start today: return wake start today
      const result = new Date(now);
      result.setHours(ws.hour, ws.minute, 0, 0);
      return result;
    }
    // After wake end: return wake start tomorrow
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    result.setHours(ws.hour, ws.minute, 0, 0);
    return result;
  }

  // We're within waking hours. Round up to next interval boundary from wakeStart.
  let effectiveNowMin = nowMin;
  if (spansMiddnight && nowMin < wsMin) {
    effectiveNowMin += 24 * 60; // Wrap to next day for calculation
  }

  let effectiveWsMin = wsMin;
  const elapsed = effectiveNowMin - effectiveWsMin;
  const nextBoundary = (Math.floor(elapsed / intervalMinutes) + 1) * intervalMinutes;
  let nextMin = effectiveWsMin + nextBoundary;

  // Check if the next boundary is still within waking hours
  let effectiveWeMin = weMin;
  if (spansMiddnight) {
    effectiveWeMin += 24 * 60;
  }

  if (nextMin >= effectiveWeMin) {
    // Past waking hours: return tomorrow's wakeStart
    const result = new Date(now);
    if (spansMiddnight && nowMin < wsMin) {
      // We're already past midnight, tomorrow from current perspective
      result.setDate(result.getDate() + 1);
    } else if (!spansMiddnight) {
      result.setDate(result.getDate() + 1);
    } else {
      result.setDate(result.getDate() + 1);
    }
    result.setHours(ws.hour, ws.minute, 0, 0);
    return result;
  }

  // Normalize minutes back to 24h
  nextMin = nextMin % (24 * 60);

  const result = new Date(now);
  const nextHour = Math.floor(nextMin / 60);
  const nextMinute = nextMin % 60;

  // If the next time is before current time (wrapped past midnight)
  if (nextHour * 60 + nextMinute <= nowMin && !spansMiddnight) {
    result.setDate(result.getDate() + 1);
  }

  result.setHours(nextHour, nextMinute, 0, 0);
  return result;
}

// ── Should Send Reminder ──

/**
 * Determine whether a water reminder should be sent right now.
 */
export function shouldSendReminder(input: {
  enabled: boolean;
  currentCount: number;
  target: number;
  pauseDuringDryFast: boolean;
  isFastActive: boolean;
}): boolean {
  if (!input.enabled) return false;
  if (input.currentCount >= input.target) return false;
  if (input.pauseDuringDryFast && input.isFastActive) return false;
  return true;
}

// ── Slot Generation ──

/**
 * Generate all reminder time slots for a given day within waking hours.
 * Returns an array of { hour, minute } for each reminder.
 */
export function generateReminderSlots(
  intervalMinutes: number,
  wakeStart: string,
  wakeEnd: string,
): { hour: number; minute: number }[] {
  const ws = parseTime(wakeStart);
  const we = parseTime(wakeEnd);
  const wsMin = toMinutes(ws.hour, ws.minute);
  const weMin = toMinutes(we.hour, we.minute);

  const slots: { hour: number; minute: number }[] = [];

  if (weMin <= wsMin) {
    // Spans midnight: wakeStart to midnight, then midnight to wakeEnd
    const totalMinutes = (24 * 60 - wsMin) + weMin;
    for (let offset = 0; offset < totalMinutes; offset += intervalMinutes) {
      const absMin = (wsMin + offset) % (24 * 60);
      slots.push({ hour: Math.floor(absMin / 60), minute: absMin % 60 });
    }
  } else {
    // Normal day range
    for (let min = wsMin; min < weMin; min += intervalMinutes) {
      slots.push({ hour: Math.floor(min / 60), minute: min % 60 });
    }
  }

  return slots;
}
