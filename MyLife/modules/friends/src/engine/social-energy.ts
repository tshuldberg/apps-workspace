// ── Social Energy Tracking Engine ─────────────────────────────────────
// Pure functions for analyzing social time patterns and energy levels.
// Non-prescriptive: observes and describes, never prescribes.
// No DB calls, no side effects. Takes data in, returns computed results.

// ── Types ──────────────────────────────────────────────────────────

export interface WeeklySummary {
  weekStart: string; // ISO Monday
  totalMinutes: number;
  hangoutCount: number;
  uniquePeople: number;
  averageQuality: number | null;
  topPerson: { id: string; name: string; minutes: number } | null;
}

export type SocialPattern =
  | 'consistent'
  | 'increasing'
  | 'decreasing'
  | 'variable'
  | 'insufficient_data';

// ── Input types (loosely coupled to DB row shapes) ─────────────────

interface HangoutInput {
  happened_at: string;
  duration_minutes: number | null;
  people_ids: string[];
  quality_rating: number | null;
}

interface PersonInput {
  id: string;
  display_name: string;
}

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_HANGOUT_MINUTES = 60;

// ── Core Functions ─────────────────────────────────────────────────

/**
 * Get the Monday (start of week) for a given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Sunday = 0, Monday = 1, etc. Shift so Monday = 0.
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Calculate social time metrics for a single week.
 */
export function calculateWeeklySocialTime(
  hangouts: HangoutInput[],
  weekStart: Date,
): { totalMinutes: number; hangoutCount: number; uniquePeople: number; averageQuality: number | null } {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const inWeek = hangouts.filter((h) => {
    const d = h.happened_at.slice(0, 10);
    return d >= weekStartStr && d < weekEndStr;
  });

  let totalMinutes = 0;
  const peopleSet = new Set<string>();
  const ratings: number[] = [];

  for (const h of inWeek) {
    totalMinutes += h.duration_minutes ?? DEFAULT_HANGOUT_MINUTES;
    for (const pid of h.people_ids) {
      peopleSet.add(pid);
    }
    if (h.quality_rating !== null) {
      ratings.push(h.quality_rating);
    }
  }

  const averageQuality = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  return {
    totalMinutes,
    hangoutCount: inWeek.length,
    uniquePeople: peopleSet.size,
    averageQuality,
  };
}

/**
 * Generate a full weekly summary including top person.
 */
export function generateWeeklySummary(
  hangouts: HangoutInput[],
  people: PersonInput[],
  weekStart: Date,
): WeeklySummary {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const inWeek = hangouts.filter((h) => {
    const d = h.happened_at.slice(0, 10);
    return d >= weekStartStr && d < weekEndStr;
  });

  const { totalMinutes, hangoutCount, uniquePeople, averageQuality } =
    calculateWeeklySocialTime(hangouts, weekStart);

  // Calculate top person by minutes
  const personMinutes = new Map<string, number>();
  for (const h of inWeek) {
    const minutes = h.duration_minutes ?? DEFAULT_HANGOUT_MINUTES;
    // Distribute time equally among all people in the hangout
    const perPerson = minutes / Math.max(h.people_ids.length, 1);
    for (const pid of h.people_ids) {
      personMinutes.set(pid, (personMinutes.get(pid) ?? 0) + perPerson);
    }
  }

  let topPerson: WeeklySummary['topPerson'] = null;
  if (personMinutes.size > 0) {
    let maxId = '';
    let maxMinutes = 0;
    for (const [pid, mins] of Array.from(personMinutes.entries())) {
      if (mins > maxMinutes) {
        maxId = pid;
        maxMinutes = mins;
      }
    }
    const person = people.find((p) => p.id === maxId);
    if (person) {
      topPerson = { id: maxId, name: person.display_name, minutes: Math.round(maxMinutes) };
    }
  }

  return {
    weekStart: weekStartStr,
    totalMinutes,
    hangoutCount,
    uniquePeople,
    averageQuality,
    topPerson,
  };
}

/**
 * Calculate the average weekly social hours from a list of weekly summaries.
 */
export function getAverageWeeklySocialHours(weeklySummaries: WeeklySummary[]): number {
  if (weeklySummaries.length === 0) return 0;
  const totalMinutes = weeklySummaries.reduce((sum, w) => sum + w.totalMinutes, 0);
  return Math.round((totalMinutes / weeklySummaries.length / 60) * 10) / 10;
}

/**
 * Detect the social pattern from weekly summaries.
 *
 * Rules:
 * - insufficient_data: fewer than minWeeks summaries
 * - increasing: last 3 weeks trend upward
 * - decreasing: last 3 weeks trend downward
 * - consistent: standard deviation < 30% of mean
 * - variable: standard deviation >= 30% of mean
 */
export function getSocialPattern(
  weeklySummaries: WeeklySummary[],
  minWeeks: number = 4,
): SocialPattern {
  if (weeklySummaries.length < minWeeks) return 'insufficient_data';

  const minutes = weeklySummaries.map((w) => w.totalMinutes);

  // Check trend in last 3 weeks
  if (minutes.length >= 3) {
    const last3 = minutes.slice(-3);
    const isIncreasing = last3[0] < last3[1] && last3[1] < last3[2];
    const isDecreasing = last3[0] > last3[1] && last3[1] > last3[2];

    if (isIncreasing) return 'increasing';
    if (isDecreasing) return 'decreasing';
  }

  // Calculate variance
  const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  if (mean === 0) return 'consistent'; // all zeros = consistent at zero

  const variance = minutes.reduce((sum, m) => sum + (m - mean) ** 2, 0) / minutes.length;
  const stdDev = Math.sqrt(variance);
  const coeffOfVariation = stdDev / mean;

  if (coeffOfVariation < 0.3) return 'consistent';
  return 'variable';
}

/**
 * Detect over-socializing: current week is more than 2x average.
 */
export function detectOverSocializing(
  currentWeekMinutes: number,
  averageMinutes: number,
): boolean {
  if (averageMinutes <= 0) return false;
  return currentWeekMinutes > 2 * averageMinutes;
}

/**
 * Detect under-socializing: current week is less than 0.3x average.
 */
export function detectUnderSocializing(
  currentWeekMinutes: number,
  averageMinutes: number,
): boolean {
  if (averageMinutes <= 0) return false;
  return currentWeekMinutes < 0.3 * averageMinutes;
}

/**
 * Generate a non-prescriptive insight string about the user's social pattern.
 */
export function generatePatternInsight(pattern: SocialPattern, avgHours: number): string {
  switch (pattern) {
    case 'consistent':
      return `Your social time is consistent at about ${avgHours} hours per week`;
    case 'increasing':
      return `Your social time has been increasing over recent weeks`;
    case 'decreasing':
      return `Your social time has been tapering off recently`;
    case 'variable':
      return `Your social schedule varies from week to week, averaging ${avgHours} hours`;
    case 'insufficient_data':
      return `Not enough data yet to identify a pattern`;
  }
}
