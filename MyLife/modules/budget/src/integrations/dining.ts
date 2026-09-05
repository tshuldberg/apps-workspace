export interface DiningTransactionContext {
  restaurantName: string;
  totalCostCents: number | null;
  visitDate: string;
  partySize: number | null;
}

export function buildBudgetTransaction(context: DiningTransactionContext): {
  prefillCategory: string;
  prefillDescription: string;
  prefillAmountCents: number | null;
  prefillDate: string;
  sourceModule: 'dining';
} {
  const perPerson =
    context.totalCostCents && context.partySize && context.partySize > 1
      ? ` ($${(context.totalCostCents / context.partySize / 100).toFixed(2)}/person)`
      : '';
  return {
    prefillCategory: 'Dining Out',
    prefillDescription: `${context.restaurantName}${perPerson}`,
    prefillAmountCents: context.totalCostCents,
    prefillDate: context.visitDate,
    sourceModule: 'dining',
  };
}
