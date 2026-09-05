// ── Budget Integration ──────────────────────────────────────────────
// Summarizes gift spending from the friends gift tracker for budget context.

/** Summary of gift spending for a person. */
export interface GiftSpendingSummary {
  /** Total amount given to this person (in dollars). */
  totalGiven: number;
  /** Total amount received from this person (in dollars). */
  totalReceived: number;
  /** Net spent (given - received). */
  netSpent: number;
}

/**
 * Calculate gift spending summary for a person.
 *
 * Pure function: takes gift records, returns spending totals.
 * Handles null amounts gracefully (treated as $0).
 */
export function getGiftSpendingSummary(
  gifts: Array<{ direction: string; amount_cents: number | null }>,
): GiftSpendingSummary {
  let totalGivenCents = 0;
  let totalReceivedCents = 0;

  for (const gift of gifts) {
    const amount = gift.amount_cents ?? 0;
    if (gift.direction === 'given') {
      totalGivenCents += amount;
    } else if (gift.direction === 'received') {
      totalReceivedCents += amount;
    }
  }

  const totalGiven = Math.round(totalGivenCents) / 100;
  const totalReceived = Math.round(totalReceivedCents) / 100;
  const netSpent = Math.round((totalGivenCents - totalReceivedCents)) / 100;

  return { totalGiven, totalReceived, netSpent };
}
