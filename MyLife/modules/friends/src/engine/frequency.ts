// ── Frequency Tracking Engine ────────────────────────────────────────
// Pure functions for computing how often you see people vs your goals.
// No DB calls, no side effects. Takes data in, returns computed results.

export type FrequencyStatus = 'on-track' | 'approaching' | 'overdue' | 'no-goal';

const MS_PER_DAY = 86_400_000;

/**
 * Calculate the number of whole days between a date string and now.
 * Returns null if lastHangoutDate is null (never seen).
 */
export function calculateDaysSinceLastSeen(
  lastHangoutDate: string | null,
  now: Date = new Date(),
): number | null {
  if (lastHangoutDate === null) return null;
  const last = new Date(lastHangoutDate);
  const diff = now.getTime() - last.getTime();
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Determine frequency status based on days since last seen and goal.
 *
 * Rules:
 * - goalDays null          -> 'no-goal'
 * - daysSince null (never) -> 'overdue' (has goal but never seen)
 * - daysSince < goal * 0.7 -> 'on-track'
 * - daysSince < goal       -> 'approaching'
 * - daysSince >= goal      -> 'overdue'
 */
export function getFrequencyStatus(
  daysSince: number | null,
  goalDays: number | null,
): FrequencyStatus {
  if (goalDays === null) return 'no-goal';
  if (daysSince === null) return 'overdue';
  if (daysSince < goalDays * 0.7) return 'on-track';
  if (daysSince < goalDays) return 'approaching';
  return 'overdue';
}

/**
 * Human-readable label for how long since last seen.
 */
export function generateLastSeenLabel(daysSince: number | null): string {
  if (daysSince === null) return 'Never hung out';
  if (daysSince === 0) return 'Today';
  if (daysSince === 1) return 'Yesterday';
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return '1 week ago';
  if (daysSince < 28) return `${Math.floor(daysSince / 7)} weeks ago`;
  if (daysSince < 60) return '1 month ago';
  if (daysSince < 365) return `${Math.floor(daysSince / 30)} months ago`;
  return 'Over a year ago';
}

/**
 * Color token for a frequency status (for UI rendering).
 */
export function getFrequencyColor(status: FrequencyStatus): string {
  switch (status) {
    case 'on-track':
      return '#10B981';
    case 'approaching':
      return '#F59E0B';
    case 'overdue':
      return '#EF4444';
    case 'no-goal':
      return '#9F8E81';
  }
}

// ── Batch helpers ───────────────────────────────────────────────────

interface PersonFrequencyInput {
  id: string;
  frequency_goal_days: number | null;
  lastHangoutDate: string | null;
}

interface PersonFrequencyResult {
  id: string;
  daysSince: number | null;
  goalDays: number;
}

/**
 * Return people who are overdue (daysSince >= goalDays, or never seen with a goal).
 * People with no goal are excluded.
 */
export function getOverduePeople(
  people: PersonFrequencyInput[],
  now: Date = new Date(),
): PersonFrequencyResult[] {
  const results: PersonFrequencyResult[] = [];
  for (const p of people) {
    if (p.frequency_goal_days === null) continue;
    const daysSince = calculateDaysSinceLastSeen(p.lastHangoutDate, now);
    const status = getFrequencyStatus(daysSince, p.frequency_goal_days);
    if (status === 'overdue') {
      results.push({ id: p.id, daysSince, goalDays: p.frequency_goal_days });
    }
  }
  return results;
}

/**
 * Return people who are approaching their goal (within 70-100% of goal days).
 * People with no goal are excluded.
 */
export function getApproachingPeople(
  people: PersonFrequencyInput[],
  now: Date = new Date(),
): PersonFrequencyResult[] {
  const results: PersonFrequencyResult[] = [];
  for (const p of people) {
    if (p.frequency_goal_days === null) continue;
    const daysSince = calculateDaysSinceLastSeen(p.lastHangoutDate, now);
    const status = getFrequencyStatus(daysSince, p.frequency_goal_days);
    if (status === 'approaching') {
      results.push({ id: p.id, daysSince, goalDays: p.frequency_goal_days });
    }
  }
  return results;
}
