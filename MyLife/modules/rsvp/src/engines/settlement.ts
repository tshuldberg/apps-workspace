/**
 * Expense settlement engine for RSVP events.
 * Calculates equal splits with penny rounding and minimizes settlement transactions.
 */

export interface ExpenseSplit {
  participantName: string;
  amountCents: number;
}

export interface Settlement {
  from: string;
  to: string;
  amountCents: number;
}

/**
 * Calculate equal split amounts for an expense among participants.
 * Applies penny rounding to the first participant to ensure amounts sum exactly to totalCents.
 */
export function calculateEqualSplit(
  totalCents: number,
  participants: string[],
): ExpenseSplit[] {
  if (participants.length === 0) return [];
  if (participants.length === 1) {
    return [{ participantName: participants[0], amountCents: totalCents }];
  }

  const baseAmount = Math.floor(totalCents / participants.length);
  const remainder = totalCents - baseAmount * participants.length;

  return participants.map((name, i) => ({
    participantName: name,
    amountCents: i < remainder ? baseAmount + 1 : baseAmount,
  }));
}

/**
 * Validate that custom split amounts sum exactly to the total.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateCustomSplit(
  totalCents: number,
  splits: ExpenseSplit[],
): string | null {
  for (const split of splits) {
    if (split.amountCents < 0) {
      return `Amount for ${split.participantName} cannot be negative`;
    }
  }

  const sum = splits.reduce((acc, s) => acc + s.amountCents, 0);
  if (sum !== totalCents) {
    const totalStr = (totalCents / 100).toFixed(2);
    const sumStr = (sum / 100).toFixed(2);
    return `Amounts must add up to $${totalStr}. Currently $${sumStr}.`;
  }

  return null;
}

interface Balance {
  name: string;
  netCents: number;
}

/**
 * Calculate the minimum set of settlements to resolve all debts.
 * Uses a greedy algorithm: match largest debtor with largest creditor.
 *
 * @param expenses Array of { paidByName, amountCents, splits: { participantName, amountCents }[] }
 */
export function calculateSettlements(
  expenses: Array<{
    paidByName: string;
    amountCents: number;
    splits: ExpenseSplit[];
  }>,
): Settlement[] {
  // Calculate net balance per person
  const balanceMap = new Map<string, number>();

  for (const expense of expenses) {
    // Person who paid gets credited
    const current = balanceMap.get(expense.paidByName) ?? 0;
    balanceMap.set(expense.paidByName, current + expense.amountCents);

    // Each participant owes their share
    for (const split of expense.splits) {
      const existing = balanceMap.get(split.participantName) ?? 0;
      balanceMap.set(split.participantName, existing - split.amountCents);
    }
  }

  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: Balance[] = [];
  const debtors: Balance[] = [];

  for (const [name, netCents] of balanceMap) {
    if (netCents > 0) {
      creditors.push({ name, netCents });
    } else if (netCents < 0) {
      debtors.push({ name, netCents: -netCents }); // store as positive for easier math
    }
  }

  // Sort: largest creditor first, largest debtor first
  creditors.sort((a, b) => b.netCents - a.netCents);
  debtors.sort((a, b) => b.netCents - a.netCents);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].netCents, debtors[di].netCents);
    if (amount > 0) {
      settlements.push({
        from: debtors[di].name,
        to: creditors[ci].name,
        amountCents: amount,
      });
    }

    creditors[ci].netCents -= amount;
    debtors[di].netCents -= amount;

    if (creditors[ci].netCents === 0) ci++;
    if (debtors[di].netCents === 0) di++;
  }

  return settlements;
}
