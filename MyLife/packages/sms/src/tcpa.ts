/**
 * TCPA send-window enforcement.
 * Federal rule: 8am-9pm recipient local time.
 * Florida exception: 8am-8pm.
 */

const DEFAULT_START_HOUR = 8;  // 8:00 AM
const DEFAULT_END_HOUR = 21;   // 9:00 PM
const FL_END_HOUR = 20;        // 8:00 PM (Florida)

const FLORIDA_CODES = ['fl', 'florida'];

function getEndHour(state?: string): number {
  if (state && FLORIDA_CODES.includes(state.toLowerCase())) {
    return FL_END_HOUR;
  }
  return DEFAULT_END_HOUR;
}

/**
 * Returns the current hour in the given IANA timezone.
 */
function getCurrentHourInTimezone(timezone: string, now?: Date): number {
  const date = now ?? new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    minute: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour');
  const minutePart = parts.find((p) => p.type === 'minute');
  const hour = parseInt(hourPart?.value ?? '0', 10);
  const minute = parseInt(minutePart?.value ?? '0', 10);
  return hour + minute / 60;
}

/**
 * Check if the current time is within the TCPA-allowed send window
 * for a given timezone and optional state.
 *
 * @param timezone - IANA timezone (e.g., 'America/New_York')
 * @param state - Optional US state code or name (for FL exception)
 * @param now - Optional current time override (for testing)
 */
export function isWithinSendWindow(timezone: string, state?: string, now?: Date): boolean {
  const currentHour = getCurrentHourInTimezone(timezone, now);
  const endHour = getEndHour(state);
  return currentHour >= DEFAULT_START_HOUR && currentHour < endHour;
}

/**
 * Returns the next time the send window opens for a given timezone.
 * If the window is currently open, returns the current time.
 *
 * @param timezone - IANA timezone (e.g., 'America/New_York')
 * @param state - Optional US state code or name
 * @param now - Optional current time override (for testing)
 */
export function getNextSendWindow(timezone: string, state?: string, now?: Date): Date {
  const date = now ?? new Date();

  if (isWithinSendWindow(timezone, state, date)) {
    return date;
  }

  // Find the next 8am in the recipient's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);

  // If we're past the end of window today, next window is tomorrow at 8am
  // If we're before start of window today, next window is today at 8am
  const endHour = getEndHour(state);
  const isPastWindow = hour >= endHour;

  // Calculate offset to next 8am in recipient timezone
  const targetDate = new Date(date);
  if (isPastWindow) {
    // Move to tomorrow
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Set to 8am in UTC, then adjust for timezone offset
  // Use a simpler approach: iterate forward in 15-min increments until we hit the window
  const result = new Date(date);
  // Jump ahead to approximate next window (avoid long loops)
  if (isPastWindow) {
    // Skip ahead ~hours until next morning
    const hoursToSkip = 24 - hour + DEFAULT_START_HOUR;
    result.setTime(result.getTime() + hoursToSkip * 60 * 60 * 1000);
  } else {
    // Before window today, skip ahead to 8am
    const hoursToSkip = DEFAULT_START_HOUR - hour;
    result.setTime(result.getTime() + hoursToSkip * 60 * 60 * 1000);
  }

  // Fine-tune: step back 1 hour then forward in 1-min increments
  result.setTime(result.getTime() - 60 * 60 * 1000);
  for (let i = 0; i < 120; i++) {
    result.setTime(result.getTime() + 60 * 1000);
    if (isWithinSendWindow(timezone, state, result)) {
      return result;
    }
  }

  return result;
}
