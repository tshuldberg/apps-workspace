// Pure timezone math for the device-calendar bridge, kept free of expo
// imports so it stays node-testable. The production eval flagged this logic
// as the riskiest untested path in the app; the tests pin EST/EDT behavior
// and the DST spring-forward edge.

/** Offset (ms) of `timeZone` at the given instant, via Intl. Positive east of UTC. */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  const hour = map.hour === '24' ? '00' : map.hour;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/**
 * Interpret a floating wall-clock ISO string ('YYYY-MM-DDTHH:mm[:ss]') as a time
 * in `timeZone` and return the correct absolute instant, independent of the
 * device locale. Falls back to naive parsing if Intl is unavailable at runtime.
 */
export function zonedWallTimeToInstant(localIso: string, timeZone: string): Date {
  try {
    const m = localIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return new Date(localIso);
    const asUtc = Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      m[6] ? Number(m[6]) : 0,
    );
    const offset = zoneOffsetMs(new Date(asUtc), timeZone);
    return new Date(asUtc - offset);
  } catch {
    return new Date(localIso);
  }
}

/**
 * All-day events care about the calendar date, not the time. Anchor at local
 * noon so a UTC parse never shifts the date across a day boundary.
 */
export function allDayDate(value: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}
