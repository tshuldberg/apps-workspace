// ── Birthday & Anniversary Engine ───────────────────────────────────
// Pure functions for computing upcoming birthdays, ages, and reminder triggers.
// No DB calls, no side effects. Takes data in, returns computed results.

const MS_PER_DAY = 86_400_000;

/**
 * Parse a birthday string that is either "YYYY-MM-DD" or "MM-DD".
 * Returns { month (1-12), day, year: number | null }.
 */
function parseBirthdayParts(birthday: string): {
  month: number;
  day: number;
  year: number | null;
} {
  const parts = birthday.split('-').map(Number);
  if (parts.length === 3) {
    return { year: parts[0], month: parts[1], day: parts[2] };
  }
  // MM-DD format
  return { year: null, month: parts[0], day: parts[1] };
}

/**
 * Calculate days until the next occurrence of a birthday from a reference date.
 * Handles year wrapping (e.g. Dec birthday checked in Nov returns small number,
 * not negative).
 *
 * Returns 0 if the birthday is today.
 */
export function getDaysUntilBirthday(
  birthday: string,
  referenceDate: Date = new Date(),
): number {
  const { month, day } = parseBirthdayParts(birthday);
  const refYear = referenceDate.getFullYear();

  // Build this year's birthday occurrence
  const thisYear = new Date(refYear, month - 1, day);
  // Strip time from reference
  const refStart = new Date(
    refYear,
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  const diffMs = thisYear.getTime() - refStart.getTime();
  const diffDays = Math.round(diffMs / MS_PER_DAY);

  if (diffDays >= 0) return diffDays;

  // Birthday already passed this year; compute next year's occurrence
  const nextYear = new Date(refYear + 1, month - 1, day);
  const nextDiffMs = nextYear.getTime() - refStart.getTime();
  return Math.round(nextDiffMs / MS_PER_DAY);
}

/**
 * Return the person's age (how old they are turning or currently are)
 * based on a full YYYY-MM-DD birthday string.
 *
 * Returns null if the birthday has no year component (MM-DD format).
 * Age is calculated as of the reference date.
 */
export function getAge(
  birthday: string,
  referenceDate: Date = new Date(),
): number | null {
  const { year, month, day } = parseBirthdayParts(birthday);
  if (year === null) return null;

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const refDay = referenceDate.getDate();

  let age = refYear - year;
  // If birthday hasn't happened yet this year, subtract 1
  if (refMonth < month || (refMonth === month && refDay < day)) {
    age -= 1;
  }
  return age;
}

/**
 * Return the age the person will be turning on their next birthday.
 * Returns null if no year in the birthday string.
 */
export function getTurningAge(
  birthday: string,
  referenceDate: Date = new Date(),
): number | null {
  const currentAge = getAge(birthday, referenceDate);
  if (currentAge === null) return null;
  return currentAge + 1;
}

// ── Batch helpers ───────────────────────────────────────────────────

export interface BirthdayPersonInput {
  id: string;
  display_name: string;
  birthday: string | null;
}

export interface UpcomingBirthday {
  id: string;
  display_name: string;
  birthday: string;
  daysUntil: number;
  age: number | null;
}

/**
 * Filter people who have birthdays, compute days until, and sort by proximity.
 * Only includes people whose next birthday is within `daysAhead` days.
 * Defaults to 90 days.
 */
export function getUpcomingBirthdays(
  people: BirthdayPersonInput[],
  daysAhead: number = 90,
  referenceDate: Date = new Date(),
): UpcomingBirthday[] {
  const results: UpcomingBirthday[] = [];

  for (const p of people) {
    if (!p.birthday) continue;
    const daysUntil = getDaysUntilBirthday(p.birthday, referenceDate);
    if (daysUntil > daysAhead) continue;
    results.push({
      id: p.id,
      display_name: p.display_name,
      birthday: p.birthday,
      daysUntil,
      age: getTurningAge(p.birthday, referenceDate),
    });
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

// ── Friendship anniversaries ────────────────────────────────────────

export interface AnniversaryPersonInput {
  id: string;
  display_name: string;
  when_met: string | null;
}

export interface UpcomingAnniversary {
  id: string;
  display_name: string;
  when_met: string;
  daysUntil: number;
  years: number | null;
}

/**
 * Filter people who have a when_met date and return upcoming friendship anniversaries.
 */
export function getFriendshipAnniversaries(
  people: AnniversaryPersonInput[],
  daysAhead: number = 90,
  referenceDate: Date = new Date(),
): UpcomingAnniversary[] {
  const results: UpcomingAnniversary[] = [];

  for (const p of people) {
    if (!p.when_met) continue;
    const daysUntil = getDaysUntilBirthday(p.when_met, referenceDate);
    if (daysUntil > daysAhead) continue;

    const parts = p.when_met.split('-').map(Number);
    let years: number | null = null;
    if (parts.length === 3) {
      years = referenceDate.getFullYear() - parts[0];
      // If the anniversary hasn't happened yet this year, subtract 1
      const refMonth = referenceDate.getMonth() + 1;
      const refDay = referenceDate.getDate();
      if (refMonth < parts[1] || (refMonth === parts[1] && refDay < parts[2])) {
        years -= 1;
      }
      // We want the upcoming year count
      years += 1;
    }

    results.push({
      id: p.id,
      display_name: p.display_name,
      when_met: p.when_met,
      daysUntil,
      years,
    });
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

// ── Reminder trigger ────────────────────────────────────────────────

/**
 * Check if today (reference date) is exactly one of the `reminderDaysBefore`
 * thresholds before the birthday. Used by the nudge/reminder engine.
 */
export function shouldTriggerReminder(
  birthday: string,
  reminderDaysBefore: number[],
  referenceDate: Date = new Date(),
): { trigger: boolean; daysUntil: number } {
  const daysUntil = getDaysUntilBirthday(birthday, referenceDate);
  return {
    trigger: reminderDaysBefore.includes(daysUntil),
    daysUntil,
  };
}

// ── Calendar month filter ───────────────────────────────────────────

/**
 * Filter people whose birthday falls in the given month (1-12).
 */
export function getBirthdayMonth<T extends { birthday: string | null }>(
  people: T[],
  month: number,
): T[] {
  return people.filter((p) => {
    if (!p.birthday) return false;
    const { month: bMonth } = parseBirthdayParts(p.birthday);
    return bMonth === month;
  });
}

// ── Display helpers ─────────────────────────────────────────────────

/**
 * Human-readable label for days until a birthday.
 */
export function generateDaysUntilLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today!';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 7) return `In ${daysUntil} days`;
  if (daysUntil < 14) return 'Next week';
  if (daysUntil < 30) return `In ${Math.floor(daysUntil / 7)} weeks`;
  if (daysUntil < 60) return 'Next month';
  return `In ${Math.floor(daysUntil / 30)} months`;
}

/**
 * Format a birthday date string for display.
 * "1990-06-15" -> "June 15"
 * "06-15" -> "June 15"
 */
export function formatBirthdayDate(birthday: string): string {
  const { month, day } = parseBirthdayParts(birthday);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${monthNames[month - 1]} ${day}`;
}
