import type { PetExpense, WeightEntry, WeightTrend } from '../types';

export function calculatePetAgeYears(
  birthDate: string | null,
  referenceDate = new Date().toISOString().slice(0, 10),
): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  const reference = new Date(`${referenceDate.slice(0, 10)}T00:00:00Z`);
  return Math.round((((reference.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) * 10)) / 10;
}

export function calculateWeightTrend(entries: WeightEntry[]): WeightTrend {
  const sorted = [...entries].sort((left, right) => left.loggedAt.localeCompare(right.loggedAt));
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.length > 1 ? sorted.at(-2)! : null;

  if (!latest || !previous) {
    return {
      direction: 'stable',
      deltaGrams: 0,
      deltaPercent: 0,
      latestWeightGrams: latest?.weightGrams ?? null,
      previousWeightGrams: previous?.weightGrams ?? null,
    };
  }

  const deltaGrams = latest.weightGrams - previous.weightGrams;
  const deltaPercent = previous.weightGrams > 0
    ? Math.round((deltaGrams / previous.weightGrams) * 1000) / 10
    : 0;

  const direction = Math.abs(deltaPercent) < 2
    ? 'stable'
    : deltaGrams > 0
      ? 'gaining'
      : 'losing';

  return {
    direction,
    deltaGrams,
    deltaPercent,
    latestWeightGrams: latest.weightGrams,
    previousWeightGrams: previous.weightGrams,
  };
}

export function calculateOwnershipCost(expenses: PetExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}

export function calculateAverageMonthlyCost(
  expenses: PetExpense[],
  adoptionDate: string | null,
  referenceDate = new Date().toISOString().slice(0, 10),
): number {
  const total = calculateOwnershipCost(expenses);
  if (!adoptionDate) {
    return total;
  }

  const adopted = new Date(`${adoptionDate.slice(0, 10)}T00:00:00Z`);
  const reference = new Date(`${referenceDate.slice(0, 10)}T00:00:00Z`);
  const monthsOwned = Math.max(
    1,
    Math.ceil((reference.getTime() - adopted.getTime()) / (30 * 24 * 60 * 60 * 1000)),
  );

  return Math.round(total / monthsOwned);
}
