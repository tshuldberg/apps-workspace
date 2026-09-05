/**
 * Expense splitting engine.
 *
 * Calculates equal, unequal, percentage, and shares-based splits.
 * Tracks running balances per contact. All monetary values integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SplitParticipant {
  contactId: string | null; // null for 'self'
  isSelf: boolean;
  shareValue?: number;      // For percentage (0-1) or shares count
}

export interface SplitResult {
  contactId: string | null;
  isSelf: boolean;
  shareAmount: number;      // cents
}

export interface BalanceEntry {
  contactId: string;
  contactName: string;
  netBalance: number;       // cents: positive = they owe you, negative = you owe them
}

export interface BalanceSummary {
  totalOwedToYou: number;   // cents
  totalYouOwe: number;      // cents
  netBalance: number;       // cents
  entries: BalanceEntry[];
}

// ---------------------------------------------------------------------------
// Split calculations
// ---------------------------------------------------------------------------

/**
 * Calculate equal split. Remainder cent(s) go to the first participant (payer).
 */
export function calculateEqualSplit(
  totalAmount: number,
  participants: SplitParticipant[],
): SplitResult[] {
  if (participants.length === 0) return [];

  const perPerson = Math.floor(totalAmount / participants.length);
  const remainder = totalAmount - perPerson * participants.length;

  return participants.map((p, i) => ({
    contactId: p.contactId,
    isSelf: p.isSelf,
    shareAmount: perPerson + (i === 0 ? remainder : 0),
  }));
}

/**
 * Calculate percentage-based split.
 * Percentages should sum to 1.0 (within tolerance).
 */
export function calculatePercentageSplit(
  totalAmount: number,
  participants: Array<SplitParticipant & { shareValue: number }>,
): SplitResult[] {
  if (participants.length === 0) return [];

  const results: SplitResult[] = [];
  let allocated = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const isLast = i === participants.length - 1;
    const shareAmount = isLast
      ? totalAmount - allocated
      : Math.round(totalAmount * p.shareValue);

    allocated += shareAmount;
    results.push({ contactId: p.contactId, isSelf: p.isSelf, shareAmount });
  }

  return results;
}

/**
 * Calculate shares-based split. Each person gets proportional to their share count.
 */
export function calculateSharesSplit(
  totalAmount: number,
  participants: Array<SplitParticipant & { shareValue: number }>,
): SplitResult[] {
  if (participants.length === 0) return [];

  const totalShares = participants.reduce((sum, p) => sum + p.shareValue, 0);
  if (totalShares <= 0) return [];

  const results: SplitResult[] = [];
  let allocated = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const isLast = i === participants.length - 1;
    const shareAmount = isLast
      ? totalAmount - allocated
      : Math.round((totalAmount * p.shareValue) / totalShares);

    allocated += shareAmount;
    results.push({ contactId: p.contactId, isSelf: p.isSelf, shareAmount });
  }

  return results;
}

/**
 * Validate that split amounts sum to the total.
 */
export function validateSplitAmounts(
  amounts: number[],
  expectedTotal: number,
): { valid: boolean; difference: number } {
  const sum = amounts.reduce((s, a) => s + a, 0);
  return { valid: sum === expectedTotal, difference: expectedTotal - sum };
}

/**
 * Validate that percentages sum to 100% (within 0.01 tolerance).
 */
export function validatePercentages(percentages: number[]): {
  valid: boolean;
  sum: number;
} {
  const sum = percentages.reduce((s, p) => s + p, 0);
  return { valid: Math.abs(sum - 1.0) < 0.01, sum };
}

// ---------------------------------------------------------------------------
// Balance calculation
// ---------------------------------------------------------------------------

/**
 * Calculate net balance per contact from splits and settlements.
 *
 * @param splits - All expense splits with participants
 * @param settlements - All settlements
 * @param contactNames - Map of contactId to display name
 */
export function calculateBalances(
  splits: Array<{
    paidBy: string;        // 'self' or contactId
    participants: Array<{ contactId: string | null; isSelf: boolean; shareAmount: number }>;
    isSettled: boolean;
  }>,
  settlements: Array<{ contactId: string; amount: number }>,
  contactNames: Map<string, string>,
): BalanceSummary {
  const balances = new Map<string, number>();

  for (const split of splits) {
    if (split.isSettled) continue;

    if (split.paidBy === 'self') {
      // I paid. Others owe me their share.
      for (const p of split.participants) {
        if (p.isSelf || !p.contactId) continue;
        balances.set(p.contactId, (balances.get(p.contactId) ?? 0) + p.shareAmount);
      }
    } else {
      // Someone else paid. I owe them my share.
      const myShare = split.participants.find(p => p.isSelf);
      if (myShare) {
        balances.set(split.paidBy, (balances.get(split.paidBy) ?? 0) - myShare.shareAmount);
      }
    }
  }

  // Apply settlements
  for (const s of settlements) {
    // Positive settlement amount = they paid you
    balances.set(s.contactId, (balances.get(s.contactId) ?? 0) + s.amount);
  }

  let totalOwedToYou = 0;
  let totalYouOwe = 0;
  const entries: BalanceEntry[] = [];

  for (const [contactId, net] of balances) {
    if (net === 0) continue;
    if (net > 0) totalOwedToYou += net;
    else totalYouOwe += Math.abs(net);
    entries.push({
      contactId,
      contactName: contactNames.get(contactId) ?? 'Unknown',
      netBalance: net,
    });
  }

  entries.sort((a, b) => b.netBalance - a.netBalance);

  return {
    totalOwedToYou,
    totalYouOwe,
    netBalance: totalOwedToYou - totalYouOwe,
    entries,
  };
}
