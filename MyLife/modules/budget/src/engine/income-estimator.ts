/**
 * Income stream detection and estimation engine.
 *
 * Analyzes transaction history to detect recurring income patterns (salary,
 * freelance, etc.), classifies their frequency, and estimates total monthly
 * income with confidence scoring.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncomeFrequency =
  | 'weekly'
  | 'biweekly'
  | 'semi_monthly'
  | 'monthly'
  | 'irregular';

export interface IncomePattern {
  payee: string;
  amounts: number[];
  dates: string[];
  frequency: IncomeFrequency;
  confidence: number; // 0-1
}

export interface IncomeStream {
  payee: string;
  frequency: IncomeFrequency;
  averageAmount: number; // cents
  lastAmount: number;    // cents
  lastDate: string;      // YYYY-MM-DD
  monthlyEstimate: number; // cents, normalized to monthly
  confidence: number;    // 0-1
  occurrenceCount: number;
}

export interface IncomeEstimate {
  totalMonthlyIncome: number; // cents
  streams: IncomeStream[];
  confidence: number; // 0-1, weighted average
}

interface Transaction {
  amount: number; // cents (positive = income)
  payee: string;
  date: string;   // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round(Math.abs(db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Classify the frequency of a set of income dates.
 */
export function classifyIncomePattern(dates: string[]): { frequency: IncomeFrequency; confidence: number } {
  if (dates.length < 2) return { frequency: 'irregular', confidence: 0.3 };

  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  const medianGap = median(gaps);
  const avgGap = average(gaps);
  const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);
  const cv = avgGap > 0 ? stdDev / avgGap : 1; // coefficient of variation

  // Lower CV = more regular pattern
  let frequency: IncomeFrequency;
  let confidence: number;

  if (medianGap <= 9) {
    frequency = 'weekly';
    confidence = cv < 0.3 ? 0.9 : cv < 0.5 ? 0.7 : 0.5;
  } else if (medianGap <= 17) {
    frequency = 'biweekly';
    confidence = cv < 0.2 ? 0.95 : cv < 0.4 ? 0.8 : 0.6;
  } else if (medianGap <= 20) {
    frequency = 'semi_monthly';
    confidence = cv < 0.3 ? 0.85 : cv < 0.5 ? 0.7 : 0.5;
  } else if (medianGap <= 35) {
    frequency = 'monthly';
    confidence = cv < 0.15 ? 0.95 : cv < 0.3 ? 0.85 : 0.65;
  } else {
    frequency = 'irregular';
    confidence = 0.4;
  }

  // Boost confidence with more data points
  if (dates.length >= 6) confidence = Math.min(1, confidence + 0.05);
  if (dates.length >= 12) confidence = Math.min(1, confidence + 0.05);

  return { frequency, confidence };
}

/**
 * Detect income streams by grouping positive-amount transactions by payee
 * and analyzing their frequency.
 */
export function detectIncomeStreams(transactions: Transaction[]): IncomeStream[] {
  // Group positive transactions by payee
  const byPayee = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (txn.amount <= 0) continue;
    const key = txn.payee.toLowerCase().trim();
    if (!key) continue;
    const list = byPayee.get(key) ?? [];
    list.push(txn);
    byPayee.set(key, list);
  }

  const streams: IncomeStream[] = [];

  for (const [, txns] of byPayee) {
    if (txns.length < 2) continue; // need at least 2 occurrences

    const sorted = txns.sort((a, b) => a.date.localeCompare(b.date));
    const dates = sorted.map((t) => t.date);
    const amounts = sorted.map((t) => t.amount);
    const { frequency, confidence } = classifyIncomePattern(dates);

    if (frequency === 'irregular' && confidence < 0.5) continue;

    const avgAmount = average(amounts);
    const lastTxn = sorted[sorted.length - 1];

    // Normalize to monthly estimate
    let monthlyEstimate: number;
    switch (frequency) {
      case 'weekly':
        monthlyEstimate = Math.round(avgAmount * 4.33);
        break;
      case 'biweekly':
        monthlyEstimate = Math.round(avgAmount * 2.17);
        break;
      case 'semi_monthly':
        monthlyEstimate = avgAmount * 2;
        break;
      case 'monthly':
        monthlyEstimate = avgAmount;
        break;
      case 'irregular': {
        const totalDays = daysBetween(sorted[0].date, lastTxn.date);
        monthlyEstimate = totalDays > 0 ? Math.round((amounts.reduce((s, a) => s + a, 0) / totalDays) * 30) : avgAmount;
        break;
      }
    }

    streams.push({
      payee: sorted[0].payee, // use original casing from first occurrence
      frequency,
      averageAmount: avgAmount,
      lastAmount: lastTxn.amount,
      lastDate: lastTxn.date,
      monthlyEstimate,
      confidence,
      occurrenceCount: sorted.length,
    });
  }

  // Sort by monthly estimate descending
  streams.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
  return streams;
}

/**
 * Estimate total monthly income from detected streams.
 */
export function estimateMonthlyIncome(transactions: Transaction[]): IncomeEstimate {
  const streams = detectIncomeStreams(transactions);

  let totalMonthlyIncome = 0;
  let weightedConfidence = 0;
  let totalWeight = 0;

  for (const stream of streams) {
    totalMonthlyIncome += stream.monthlyEstimate;
    weightedConfidence += stream.confidence * stream.monthlyEstimate;
    totalWeight += stream.monthlyEstimate;
  }

  return {
    totalMonthlyIncome,
    streams,
    confidence: totalWeight > 0 ? weightedConfidence / totalWeight : 0,
  };
}
