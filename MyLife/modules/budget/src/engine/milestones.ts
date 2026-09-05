/**
 * Net worth milestone detection engine.
 *
 * Detects financial milestones: first positive net worth, round number
 * thresholds, all-time highs, and debt-free status. Pure functions.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MilestoneType =
  | 'first_positive'
  | 'round_number'
  | 'all_time_high'
  | 'debt_free'
  | 'custom';

export interface DetectedMilestone {
  milestoneType: MilestoneType;
  value: number;          // cents
  achievedAt: string;     // YYYY-MM-DD or datetime
}

export interface MilestoneRecord {
  id: string;
  milestoneType: MilestoneType;
  value: number;
  achievedAt: string;
  dismissed: number;      // 0 or 1
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Round-number thresholds in cents: $1K to $1M */
export const ROUND_NUMBER_THRESHOLDS = [
  100_000,      // $1,000
  500_000,      // $5,000
  1_000_000,    // $10,000
  2_500_000,    // $25,000
  5_000_000,    // $50,000
  10_000_000,   // $100,000
  25_000_000,   // $250,000
  50_000_000,   // $500,000
  100_000_000,  // $1,000,000
] as const;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Detect all milestones achieved by the current net worth state.
 *
 * @param currentNetWorth Current net worth in cents
 * @param currentLiabilities Current total liabilities in cents
 * @param previousSnapshots Previous net worth values in cents (for comparison)
 * @param existingMilestones Already-achieved milestone types + values
 * @param achievedAt Date string for new milestones
 */
export function detectMilestones(
  currentNetWorth: number,
  currentLiabilities: number,
  previousSnapshots: number[],
  existingMilestones: { milestoneType: MilestoneType; value: number }[],
  achievedAt: string,
): DetectedMilestone[] {
  const detected: DetectedMilestone[] = [];

  const existingSet = new Set(
    existingMilestones.map((m) => `${m.milestoneType}:${m.value}`),
  );
  const hasExisting = (type: MilestoneType, value: number) =>
    existingSet.has(`${type}:${value}`);

  // First positive: net worth crossed from negative/zero to positive
  if (currentNetWorth > 0 && !hasExisting('first_positive', 0)) {
    const wasPreviouslyPositive = previousSnapshots.some((s) => s > 0);
    if (!wasPreviouslyPositive) {
      detected.push({ milestoneType: 'first_positive', value: 0, achievedAt });
    }
  }

  // Round number thresholds
  for (const threshold of ROUND_NUMBER_THRESHOLDS) {
    if (currentNetWorth >= threshold && !hasExisting('round_number', threshold)) {
      detected.push({ milestoneType: 'round_number', value: threshold, achievedAt });
    }
  }

  // All-time high
  if (previousSnapshots.length > 0) {
    const previousMax = Math.max(...previousSnapshots);
    if (currentNetWorth > previousMax && currentNetWorth > 0) {
      if (!hasExisting('all_time_high', currentNetWorth)) {
        detected.push({
          milestoneType: 'all_time_high',
          value: currentNetWorth,
          achievedAt,
        });
      }
    }
  }

  // Debt free: liabilities reach $0
  if (currentLiabilities === 0 && !hasExisting('debt_free', 0)) {
    // Only trigger if there were liabilities before
    detected.push({ milestoneType: 'debt_free', value: 0, achievedAt });
  }

  return detected;
}
