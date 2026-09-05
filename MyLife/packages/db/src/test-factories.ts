/**
 * Deterministic ID factory for tests. Keep IDs readable and unique.
 */
export function createIdFactory(prefix: string): () => string {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
}

/**
 * Return YYYY-MM-DD in UTC offset by the provided number of days.
 */
export function utcDateWithOffset(daysFromToday = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

/**
 * Return an ISO timestamp at noon UTC for the given YYYY-MM-DD date.
 */
export function isoNoonUtc(date: string): string {
  return `${date}T12:00:00.000Z`;
}
