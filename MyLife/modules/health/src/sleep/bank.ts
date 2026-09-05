/**
 * Sleep bank (debt) calculation engine.
 * Calculates cumulative sleep surplus/deficit against target hours.
 * Pure functions, no side effects.
 */

import type { SleepBank, SleepBankStatus } from '../types';

const MAX_DEBT_HOURS = 20;

export function getSleepBankStatus(debtHours: number): SleepBankStatus {
  if (debtHours <= 0) return 'well_rested';
  if (debtHours <= 3) return 'slight_debt';
  if (debtHours <= 8) return 'moderate_debt';
  return 'significant_debt';
}

export function getSleepBankTrend(
  sevenDayBalance: number[],
): 'paying_off' | 'stable' | 'accumulating' {
  if (sevenDayBalance.length < 3) return 'stable';
  const mid = Math.floor(sevenDayBalance.length / 2);
  const firstHalf = sevenDayBalance.slice(0, mid);
  const secondHalf = sevenDayBalance.slice(mid);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  // Second half more positive (surplus) means paying off
  if (avgSecond - avgFirst > 15) return 'paying_off';
  if (avgFirst - avgSecond > 15) return 'accumulating';
  return 'stable';
}

/**
 * Calculate sleep bank from daily sleep totals.
 * @param dailySleepMinutes Array of daily sleep totals (oldest to newest), length 7 or 30
 * @param targetHours Target sleep hours per night (default 8)
 */
export function calculateSleepBank(
  dailySleepMinutes: number[],
  targetHours: number = 8,
): SleepBank {
  const targetMinutes = targetHours * 60;

  // 7-day balance: surplus (+) or deficit (-) per day
  const last7 = dailySleepMinutes.slice(-7);
  const sevenDayBalance = last7.map((m) => m - targetMinutes);

  // Current debt = sum of 7-day balances (negative = debt)
  const sevenDaySum = sevenDayBalance.reduce((a, b) => a + b, 0);
  // Positive sevenDaySum means surplus, negative means debt
  // currentDebtMinutes: positive = debt, negative = surplus
  const rawDebt = -sevenDaySum;
  const currentDebtMinutes = Math.min(rawDebt, MAX_DEBT_HOURS * 60) || 0;
  const currentDebtHours = Math.round(currentDebtMinutes / 60 * 10) / 10;

  // 30-day debt
  const thirtyDaySum = dailySleepMinutes.reduce((a, b) => a + b, 0);
  const thirtyDayTarget = dailySleepMinutes.length * targetMinutes;
  const thirtyDayDebt = Math.min(-(thirtyDaySum - thirtyDayTarget), MAX_DEBT_HOURS * 60);

  // Average sleep
  const averageSleepHours = dailySleepMinutes.length > 0
    ? Math.round((dailySleepMinutes.reduce((a, b) => a + b, 0) / dailySleepMinutes.length / 60) * 10) / 10
    : 0;

  const status = getSleepBankStatus(Math.max(currentDebtHours, 0));
  const trend = getSleepBankTrend(sevenDayBalance);

  return {
    currentDebtMinutes,
    currentDebtHours,
    sevenDayBalance,
    thirtyDayDebt,
    averageSleepHours,
    targetHours,
    status,
    trend,
  };
}
