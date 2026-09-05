/**
 * Debt payoff calculator engine.
 *
 * Implements snowball (smallest balance first) and avalanche (highest interest
 * first) repayment strategies. Projects payoff dates and generates
 * amortization schedules.
 *
 * Interest rates stored as basis points (1800 = 18.00% APR).
 * All monetary amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DebtInput {
  id: string;
  name: string;
  balance: number;       // cents (positive = amount owed)
  minimumPayment: number; // cents per month
  interestRate: number;  // basis points (1800 = 18%)
}

export type PayoffStrategy = 'snowball' | 'avalanche';

export interface PayoffScheduleEntry {
  month: number;        // 1-based month count
  debtId: string;
  debtName: string;
  payment: number;      // cents
  principal: number;    // cents going to principal
  interest: number;     // cents going to interest
  remainingBalance: number; // cents
}

export interface DebtPayoffResult {
  strategy: PayoffStrategy;
  totalMonths: number;
  totalPaid: number;       // cents
  totalInterest: number;   // cents
  schedule: PayoffScheduleEntry[];
  payoffOrder: string[];   // debt IDs in payoff order
}

export interface AmortizationEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MONTHS = 600; // 50-year safety cap
const BASIS_POINT_DIVISOR = 10000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateMonthlyInterest(balance: number, annualRateBps: number): number {
  const monthlyRate = annualRateBps / BASIS_POINT_DIVISOR / 12;
  return Math.round(balance * monthlyRate);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate debt payoff using the snowball strategy (smallest balance first).
 * Extra money freed from paid-off debts cascades to the next smallest.
 */
export function calculateSnowball(
  debts: DebtInput[],
  extraPayment: number,
): DebtPayoffResult {
  return calculatePayoff(debts, extraPayment, 'snowball');
}

/**
 * Calculate debt payoff using the avalanche strategy (highest interest first).
 * Mathematically optimal -- minimizes total interest paid.
 */
export function calculateAvalanche(
  debts: DebtInput[],
  extraPayment: number,
): DebtPayoffResult {
  return calculatePayoff(debts, extraPayment, 'avalanche');
}

function calculatePayoff(
  debts: DebtInput[],
  extraPayment: number,
  strategy: PayoffStrategy,
): DebtPayoffResult {
  if (debts.length === 0) {
    return { strategy, totalMonths: 0, totalPaid: 0, totalInterest: 0, schedule: [], payoffOrder: [] };
  }

  // Sort debts by strategy
  const sorted = [...debts].sort((a, b) => {
    if (strategy === 'snowball') return a.balance - b.balance;
    return b.interestRate - a.interestRate; // avalanche: highest rate first
  });

  // Working state
  const balances = new Map<string, number>();
  for (const d of sorted) {
    balances.set(d.id, d.balance);
  }

  const schedule: PayoffScheduleEntry[] = [];
  const payoffOrder: string[] = [];
  let totalPaid = 0;
  let totalInterest = 0;
  let month = 0;
  let freedPayment = 0; // payment freed from paid-off debts

  while (month < MAX_MONTHS) {
    // Check if all debts are paid
    let anyRemaining = false;
    for (const [, bal] of balances) {
      if (bal > 0) { anyRemaining = true; break; }
    }
    if (!anyRemaining) break;

    month++;
    let extraAvailable = extraPayment + freedPayment;

    for (const debt of sorted) {
      const balance = balances.get(debt.id)!;
      if (balance <= 0) continue;

      const interest = calculateMonthlyInterest(balance, debt.interestRate);
      totalInterest += interest;

      let payment = debt.minimumPayment + interest;

      // Apply extra payment to the target debt (first unpaid in order)
      const isTarget = !payoffOrder.includes(debt.id) &&
        sorted.find((d) => balances.get(d.id)! > 0 && !payoffOrder.includes(d.id))?.id === debt.id;

      if (isTarget && extraAvailable > 0) {
        payment += extraAvailable;
        extraAvailable = 0;
      }

      // Don't overpay
      const totalOwed = balance + interest;
      if (payment > totalOwed) payment = totalOwed;

      const principal = payment - interest;
      const remaining = Math.max(0, balance - principal);
      balances.set(debt.id, remaining);

      totalPaid += payment;

      schedule.push({
        month,
        debtId: debt.id,
        debtName: debt.name,
        payment,
        principal,
        interest,
        remainingBalance: remaining,
      });

      if (remaining <= 0 && !payoffOrder.includes(debt.id)) {
        payoffOrder.push(debt.id);
        freedPayment += debt.minimumPayment;
      }
    }
  }

  return {
    strategy,
    totalMonths: month,
    totalPaid,
    totalInterest,
    schedule,
    payoffOrder,
  };
}

/**
 * Generate a simple amortization schedule for a single debt.
 */
export function generateAmortizationSchedule(
  balance: number,
  monthlyPayment: number,
  annualRateBps: number,
): AmortizationEntry[] {
  const entries: AmortizationEntry[] = [];
  let remaining = balance;
  let month = 0;

  while (remaining > 0 && month < MAX_MONTHS) {
    month++;
    const interest = calculateMonthlyInterest(remaining, annualRateBps);
    let payment = Math.min(monthlyPayment, remaining + interest);
    const principal = payment - interest;
    remaining = Math.max(0, remaining - principal);

    entries.push({
      month,
      payment,
      principal,
      interest,
      balance: remaining,
    });
  }

  return entries;
}

/**
 * Project the payoff date for a debt given current payment.
 */
export function projectPayoffDate(
  balance: number,
  monthlyPayment: number,
  annualRateBps: number,
  startDate?: string,
): { date: string; months: number; totalInterest: number } {
  const schedule = generateAmortizationSchedule(balance, monthlyPayment, annualRateBps);
  const months = schedule.length;
  const totalInterest = schedule.reduce((s, e) => s + e.interest, 0);

  const start = startDate ? new Date(startDate) : new Date();
  const payoffDate = new Date(start);
  payoffDate.setMonth(payoffDate.getMonth() + months);

  const y = payoffDate.getFullYear();
  const m = String(payoffDate.getMonth() + 1).padStart(2, '0');
  const d = String(payoffDate.getDate()).padStart(2, '0');

  return {
    date: `${y}-${m}-${d}`,
    months,
    totalInterest,
  };
}
