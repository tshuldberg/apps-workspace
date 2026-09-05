import type { Gift, GiftBudget } from '../models/schemas';

/**
 * Returns the user's effective spend for a gift in cents.
 * For group gifts, we count my_share_cents (falling back to amount_cents
 * when not provided). For individual gifts, we count amount_cents.
 */
export function getMyShare(
  gift: Pick<Gift, 'isGroupGift' | 'amountCents' | 'myShareCents' | 'groupTotalCents'>,
): number {
  if (gift.isGroupGift && typeof gift.myShareCents === 'number') {
    return gift.myShareCents;
  }
  return gift.amountCents;
}

/**
 * Compute remaining budget given a budget and the gifts that count against it.
 * Returns budget - sum(myShare). If no budget is set, returns 0.
 */
export function getRemainingBudget(
  budget: GiftBudget | null,
  gifts: Gift[],
): number {
  if (!budget) return 0;
  let spent = 0;
  for (const g of gifts) spent += getMyShare(g);
  return budget.amountCents - spent;
}

export interface OverBudgetWarning {
  overBudget: boolean;
  overAmount: number;
  percentage: number;
}

/**
 * Compute over-budget state. percentage is spent/budget * 100 (0-N).
 * If no budget is set, returns 0/0/false.
 */
export function getOverBudgetWarning(
  budget: GiftBudget | null,
  gifts: Gift[],
): OverBudgetWarning {
  if (!budget || budget.amountCents <= 0) {
    return { overBudget: false, overAmount: 0, percentage: 0 };
  }
  let spent = 0;
  for (const g of gifts) spent += getMyShare(g);
  const overAmount = Math.max(0, spent - budget.amountCents);
  const percentage = Math.round((spent / budget.amountCents) * 100);
  return {
    overBudget: spent > budget.amountCents,
    overAmount,
    percentage,
  };
}

export interface PersonSpendingSummary {
  totalMyShare: number;
  totalFaceValue: number;
  count: number;
  byOccasion: Record<string, number>;
}

/**
 * Aggregate one person's gift history into spend totals.
 * - totalMyShare: what the user actually paid (group-aware).
 * - totalFaceValue: sum of all amount_cents (gift face value).
 * - byOccasion: my-share total per occasion key.
 */
export function summarizePersonSpending(gifts: Gift[]): PersonSpendingSummary {
  let totalMyShare = 0;
  let totalFaceValue = 0;
  const byOccasion: Record<string, number> = {};
  for (const g of gifts) {
    const share = getMyShare(g);
    totalMyShare += share;
    totalFaceValue += g.amountCents;
    byOccasion[g.occasion] = (byOccasion[g.occasion] ?? 0) + share;
  }
  return {
    totalMyShare,
    totalFaceValue,
    count: gifts.length,
    byOccasion,
  };
}
