export interface MonthlySpending {
  category: string;
  totalCents: number;
}

export interface BudgetProgress {
  category: string;
  spentCents: number;
  budgetCents: number;
  progressPct: number;
  isOverBudget: boolean;
  isWarning: boolean;
}

export interface CostBreakdownItem {
  category: string;
  totalCents: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: string;
  totalCents: number;
}

export function calculateMonthlySpending(
  expenses: Array<{ category: string; amountCents: number }>,
): MonthlySpending[] {
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents);
  }
  return Array.from(byCategory.entries())
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function calculateBudgetProgress(
  spending: MonthlySpending[],
  budgets: Array<{ category: string; monthlyBudgetCents: number }>,
): BudgetProgress[] {
  return budgets.map((budget) => {
    const spent = spending.find((s) => s.category === budget.category);
    const spentCents = spent?.totalCents ?? 0;
    const progressPct = Math.round((spentCents / budget.monthlyBudgetCents) * 100);
    return {
      category: budget.category,
      spentCents,
      budgetCents: budget.monthlyBudgetCents,
      progressPct,
      isOverBudget: spentCents > budget.monthlyBudgetCents,
      isWarning: progressPct >= 80 && spentCents <= budget.monthlyBudgetCents,
    };
  });
}

export function getCostOfOwnershipBreakdown(
  expenses: Array<{ category: string; amountCents: number }>,
): CostBreakdownItem[] {
  const spending = calculateMonthlySpending(expenses);
  const total = spending.reduce((sum, s) => sum + s.totalCents, 0);
  if (total === 0) return [];
  return spending.map((s) => ({
    category: s.category,
    totalCents: s.totalCents,
    percentage: Math.round((s.totalCents / total) * 100),
  }));
}

export function getExpenseTrend(
  expenses: Array<{ amountCents: number; spentOn: string }>,
  months: number = 12,
  referenceDate: string = new Date().toISOString().slice(0, 10),
): MonthlyTrendItem[] {
  const result: MonthlyTrendItem[] = [];
  const byMonth = new Map<string, number>();

  for (const e of expenses) {
    const month = e.spentOn.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + e.amountCents);
  }

  const refDate = new Date(referenceDate + 'T00:00:00Z');
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(refDate);
    d.setUTCMonth(d.getUTCMonth() - i);
    const month = d.toISOString().slice(0, 7);
    result.push({ month, totalCents: byMonth.get(month) ?? 0 });
  }

  return result;
}
