/**
 * Loan planner engine.
 *
 * Amortization calculations, payment splitting (principal vs interest),
 * extra payment modeling, and scenario comparison. Interest rates stored
 * as basis points (e.g., 650 = 6.50%). All monetary values integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoanInput {
  principal: number;      // cents
  interestRate: number;   // basis points (650 = 6.50%)
  termMonths: number;
  extraPayment?: number;  // cents per month
  compounding?: 'monthly' | 'daily';
}

export interface AmortizationEntry {
  month: number;
  payment: number;           // cents
  principalPortion: number;  // cents
  interestPortion: number;   // cents
  extraPortion: number;      // cents
  remainingBalance: number;  // cents
  cumulativeInterest: number; // cents
}

export interface LoanSummary {
  monthlyPayment: number;    // cents
  totalPayments: number;     // cents
  totalInterest: number;     // cents
  payoffMonths: number;
}

export interface ScenarioComparison {
  original: LoanSummary;
  modified: LoanSummary;
  interestSaved: number;     // cents
  monthsSaved: number;
}

export interface PaymentSplit {
  principalAmount: number;   // cents
  interestAmount: number;    // cents
}

// ---------------------------------------------------------------------------
// Core calculations
// ---------------------------------------------------------------------------

/**
 * Calculate monthly payment using standard amortization formula:
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * where r = monthly rate, n = term months
 */
export function calculateMonthlyPayment(input: LoanInput): number {
  const { principal, interestRate, termMonths } = input;
  if (principal <= 0 || termMonths <= 0) return 0;
  if (interestRate === 0) {
    // Zero-interest: simple division
    return Math.round(principal / termMonths);
  }

  // Convert basis points to monthly decimal rate
  const monthlyRate = interestRate / 10000 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = (principal * monthlyRate * factor) / (factor - 1);
  return Math.round(payment);
}

/**
 * Generate a full amortization schedule.
 */
export function generateLoanAmortization(input: LoanInput): AmortizationEntry[] {
  const monthlyPayment = calculateMonthlyPayment(input);
  const extra = input.extraPayment ?? 0;
  const schedule: AmortizationEntry[] = [];
  let balance = input.principal;
  let cumulativeInterest = 0;

  if (balance <= 0 || monthlyPayment <= 0) return [];

  const monthlyRate = input.interestRate / 10000 / 12;

  for (let month = 1; month <= input.termMonths * 2 && balance > 0; month++) {
    const interestPortion = input.interestRate === 0 ? 0 : Math.round(balance * monthlyRate);
    let principalPortion = monthlyPayment - interestPortion;
    let extraPortion = extra;

    // Don't overpay
    if (principalPortion + extraPortion > balance) {
      const totalPrincipal = balance;
      extraPortion = Math.max(0, totalPrincipal - principalPortion);
      principalPortion = totalPrincipal - extraPortion;
    }

    const totalPayment = interestPortion + principalPortion + extraPortion;
    balance = Math.max(0, balance - principalPortion - extraPortion);
    cumulativeInterest += interestPortion;

    schedule.push({
      month,
      payment: totalPayment,
      principalPortion,
      interestPortion,
      extraPortion,
      remainingBalance: balance,
      cumulativeInterest,
    });

    if (balance <= 0) break;
  }

  return schedule;
}

/**
 * Get loan summary from amortization schedule.
 */
export function getLoanSummary(input: LoanInput): LoanSummary {
  const monthlyPayment = calculateMonthlyPayment(input);
  const schedule = generateLoanAmortization(input);

  if (schedule.length === 0) {
    return { monthlyPayment: 0, totalPayments: 0, totalInterest: 0, payoffMonths: 0 };
  }

  const totalPayments = schedule.reduce((sum, e) => sum + e.payment, 0);
  const totalInterest = schedule[schedule.length - 1].cumulativeInterest;

  return {
    monthlyPayment,
    totalPayments,
    totalInterest,
    payoffMonths: schedule.length,
  };
}

/**
 * Compare two loan scenarios side by side.
 */
export function compareScenarios(
  original: LoanInput,
  modified: LoanInput,
): ScenarioComparison {
  const origSummary = getLoanSummary(original);
  const modSummary = getLoanSummary(modified);

  return {
    original: origSummary,
    modified: modSummary,
    interestSaved: origSummary.totalInterest - modSummary.totalInterest,
    monthsSaved: origSummary.payoffMonths - modSummary.payoffMonths,
  };
}

/**
 * Split a payment into principal and interest for a specific month in the schedule.
 */
export function splitPayment(
  balance: number,
  interestRate: number,
  payment: number,
): PaymentSplit {
  if (interestRate === 0) {
    return { principalAmount: Math.min(payment, balance), interestAmount: 0 };
  }
  const monthlyRate = interestRate / 10000 / 12;
  const interestAmount = Math.round(balance * monthlyRate);
  const principalAmount = Math.min(payment - interestAmount, balance);
  return { principalAmount: Math.max(0, principalAmount), interestAmount };
}

/**
 * Calculate total interest paid over the life of the loan.
 */
export function calculateTotalInterest(input: LoanInput): number {
  return getLoanSummary(input).totalInterest;
}
