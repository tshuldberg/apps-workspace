/**
 * Payday detection and prediction engine.
 *
 * Analyzes income transaction patterns to identify paycheck schedules
 * (weekly, biweekly, semi-monthly, monthly) and predict the next payday.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaydayFrequency = 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly';

export interface PaydayPattern {
  payee: string;
  frequency: PaydayFrequency;
  dayOfWeek: number | null;  // 0=Sun..6=Sat, null for monthly
  dayOfMonth: number | null; // 1-31, null for weekly/biweekly
  secondDayOfMonth: number | null; // for semi-monthly (e.g., 15th and last)
  averageAmount: number;     // cents
  confidence: number;        // 0-1
  lastDate: string;          // YYYY-MM-DD
  occurrences: number;
}

export interface PaydayPrediction {
  payee: string;
  predictedDate: string; // YYYY-MM-DD
  expectedAmount: number; // cents
  confidence: number;
}

interface IncomeTransaction {
  amount: number; // cents (positive)
  payee: string;
  date: string;   // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

function mode(values: number[]): number {
  const freq = new Map<number, number>();
  let maxCount = 0;
  let modeVal = values[0];
  for (const v of values) {
    const count = (freq.get(v) ?? 0) + 1;
    freq.set(v, count);
    if (count > maxCount) {
      maxCount = count;
      modeVal = v;
    }
  }
  return modeVal;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Detect payday patterns from income transactions.
 * Groups by payee, analyzes date gaps, and classifies frequency.
 */
export function detectPaydays(transactions: IncomeTransaction[]): PaydayPattern[] {
  // Group positive transactions by payee
  const byPayee = new Map<string, IncomeTransaction[]>();
  for (const txn of transactions) {
    if (txn.amount <= 0) continue;
    const key = txn.payee.toLowerCase().trim();
    if (!key) continue;
    const list = byPayee.get(key) ?? [];
    list.push(txn);
    byPayee.set(key, list);
  }

  const patterns: PaydayPattern[] = [];

  for (const [, txns] of byPayee) {
    if (txns.length < 3) continue; // need at least 3 for pattern detection

    const sorted = txns.sort((a, b) => a.date.localeCompare(b.date));
    const dates = sorted.map((t) => t.date);
    const amounts = sorted.map((t) => t.amount);

    // Calculate gaps between consecutive dates
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push(daysBetween(dates[i - 1], dates[i]));
    }

    const medianGap = median(gaps);
    const avgAmount = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    const lastTxn = sorted[sorted.length - 1];

    // Classify frequency
    let frequency: PaydayFrequency;
    let dayOfWeek: number | null = null;
    let dayOfMonth: number | null = null;
    let secondDayOfMonth: number | null = null;
    let confidence: number;

    if (medianGap <= 9) {
      frequency = 'weekly';
      dayOfWeek = mode(dates.map((d) => parseDate(d).getDay()));
      const dayConsistency = dates.filter((d) => parseDate(d).getDay() === dayOfWeek).length / dates.length;
      confidence = dayConsistency > 0.8 ? 0.95 : dayConsistency > 0.6 ? 0.8 : 0.65;
    } else if (medianGap <= 17) {
      frequency = 'biweekly';
      dayOfWeek = mode(dates.map((d) => parseDate(d).getDay()));
      const dayConsistency = dates.filter((d) => parseDate(d).getDay() === dayOfWeek).length / dates.length;
      confidence = dayConsistency > 0.8 ? 0.95 : dayConsistency > 0.6 ? 0.8 : 0.65;
    } else if (medianGap <= 20) {
      // Semi-monthly: typically 1st+15th or 15th+last
      frequency = 'semi_monthly';
      const daysOfMonth = dates.map((d) => parseDate(d).getDate());
      // Find two most common day-of-month values
      const freqMap = new Map<number, number>();
      for (const dom of daysOfMonth) {
        freqMap.set(dom, (freqMap.get(dom) ?? 0) + 1);
      }
      const sortedDays = [...freqMap.entries()].sort((a, b) => b[1] - a[1]);
      dayOfMonth = sortedDays[0]?.[0] ?? 1;
      secondDayOfMonth = sortedDays[1]?.[0] ?? 15;
      if (dayOfMonth > secondDayOfMonth) {
        [dayOfMonth, secondDayOfMonth] = [secondDayOfMonth, dayOfMonth];
      }
      confidence = 0.8;
    } else if (medianGap <= 35) {
      frequency = 'monthly';
      const daysOfMonth = dates.map((d) => parseDate(d).getDate());
      dayOfMonth = mode(daysOfMonth);
      const dayConsistency = daysOfMonth.filter((d) => Math.abs(d - dayOfMonth!) <= 2).length / daysOfMonth.length;
      confidence = dayConsistency > 0.8 ? 0.95 : dayConsistency > 0.6 ? 0.8 : 0.65;
    } else {
      continue; // too infrequent to be a payday
    }

    // Boost confidence with more data
    if (txns.length >= 6) confidence = Math.min(1, confidence + 0.03);
    if (txns.length >= 12) confidence = Math.min(1, confidence + 0.02);

    patterns.push({
      payee: sorted[0].payee,
      frequency,
      dayOfWeek,
      dayOfMonth,
      secondDayOfMonth,
      averageAmount: avgAmount,
      confidence,
      lastDate: lastTxn.date,
      occurrences: sorted.length,
    });
  }

  patterns.sort((a, b) => b.averageAmount - a.averageAmount);
  return patterns;
}

/**
 * Predict the next payday for a given pattern.
 */
export function predictNextPayday(pattern: PaydayPattern, today?: string): PaydayPrediction {
  const todayDate = today ? parseDate(today) : new Date();
  const last = parseDate(pattern.lastDate);
  let predicted: Date;

  switch (pattern.frequency) {
    case 'weekly': {
      predicted = new Date(last);
      predicted.setDate(predicted.getDate() + 7);
      while (predicted <= todayDate) {
        predicted.setDate(predicted.getDate() + 7);
      }
      break;
    }
    case 'biweekly': {
      predicted = new Date(last);
      predicted.setDate(predicted.getDate() + 14);
      while (predicted <= todayDate) {
        predicted.setDate(predicted.getDate() + 14);
      }
      break;
    }
    case 'semi_monthly': {
      const day1 = pattern.dayOfMonth ?? 1;
      const day2 = pattern.secondDayOfMonth ?? 15;
      const candidates: Date[] = [];

      // Check current and next month
      for (let offset = 0; offset <= 1; offset++) {
        const m = new Date(todayDate);
        m.setMonth(m.getMonth() + offset);
        const dim = daysInMonth(m.getFullYear(), m.getMonth());
        candidates.push(new Date(m.getFullYear(), m.getMonth(), Math.min(day1, dim)));
        candidates.push(new Date(m.getFullYear(), m.getMonth(), Math.min(day2, dim)));
      }

      const future = candidates.filter((d) => d > todayDate).sort((a, b) => a.getTime() - b.getTime());
      predicted = future[0] ?? candidates[candidates.length - 1];
      break;
    }
    case 'monthly': {
      const dom = pattern.dayOfMonth ?? 1;
      predicted = new Date(todayDate.getFullYear(), todayDate.getMonth(), Math.min(dom, daysInMonth(todayDate.getFullYear(), todayDate.getMonth())));
      if (predicted <= todayDate) {
        predicted.setMonth(predicted.getMonth() + 1);
        const dim = daysInMonth(predicted.getFullYear(), predicted.getMonth());
        predicted.setDate(Math.min(dom, dim));
      }
      break;
    }
  }

  return {
    payee: pattern.payee,
    predictedDate: formatDate(predicted),
    expectedAmount: pattern.averageAmount,
    confidence: pattern.confidence,
  };
}

/**
 * Get a schedule of next N paydays for all detected patterns.
 */
export function getPaydaySchedule(
  patterns: PaydayPattern[],
  count: number,
  today?: string,
): PaydayPrediction[] {
  const allPredictions: PaydayPrediction[] = [];

  for (const pattern of patterns) {
    let currentToday = today;
    for (let i = 0; i < count; i++) {
      const prediction = predictNextPayday(
        i === 0 ? pattern : { ...pattern, lastDate: allPredictions[allPredictions.length - 1].predictedDate },
        currentToday,
      );
      allPredictions.push(prediction);
      currentToday = prediction.predictedDate;
    }
  }

  allPredictions.sort((a, b) => a.predictedDate.localeCompare(b.predictedDate));
  return allPredictions;
}
