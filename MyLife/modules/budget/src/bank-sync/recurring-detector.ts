import type { BankTransactionRecord } from './types';

/**
 * Minimal catalog entry shape used for matching. Matches the full
 * CatalogEntry from the standalone catalog package.
 */
export interface CatalogEntryLike {
  id: string;
  name: string;
}

export interface DetectedSubscription {
  payee: string;
  normalizedPayee: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'annual' | 'unknown';
  confidence: number;
  matchedCatalogId: string | null;
  transactionDates: string[];
  isAlreadyTracked: boolean;
}

/**
 * Normalize a payee name for grouping and matching. Strips common billing
 * suffixes, extra whitespace, and lowercases the result.
 */
export function normalizePayeeName(payee: string): string {
  return payee
    .toLowerCase()
    .replace(
      /\s*(\*|#)\s*(monthly|recurring|subscription|payment|bill|auto[\s-]?pay|membership|renewal|charge|debit)\s*/gi,
      '',
    )
    .replace(
      /\b(monthly|recurring|subscription|payment|bill|auto[\s-]?pay|membership|renewal|charge|debit)\b/gi,
      '',
    )
    .replace(/[*#]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface TransactionGroup {
  rawPayee: string;
  normalizedPayee: string;
  transactions: BankTransactionRecord[];
}

function groupByPayee(
  transactions: BankTransactionRecord[],
): TransactionGroup[] {
  const groups = new Map<
    string,
    { rawPayee: string; transactions: BankTransactionRecord[] }
  >();

  for (const txn of transactions) {
    if (!txn.payee) continue;
    // Skip refunds/credits (negative amounts represent inflows)
    if (txn.amount < 0) continue;
    // Skip pending transactions
    if (txn.isPending) continue;

    const normalized = normalizePayeeName(txn.payee);
    if (!normalized) continue;

    const existing = groups.get(normalized);
    if (existing) {
      existing.transactions.push(txn);
    } else {
      groups.set(normalized, { rawPayee: txn.payee, transactions: [txn] });
    }
  }

  return Array.from(groups.entries()).map(([key, val]) => ({
    rawPayee: val.rawPayee,
    normalizedPayee: key,
    transactions: val.transactions.sort(
      (a, b) =>
        new Date(a.datePosted).getTime() - new Date(b.datePosted).getTime(),
    ),
  }));
}

function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / msPerDay,
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

interface FrequencyResult {
  frequency: 'weekly' | 'monthly' | 'annual' | 'unknown';
  intervalConsistency: number;
}

function detectFrequency(dates: string[]): FrequencyResult {
  if (dates.length < 2) {
    return { frequency: 'unknown', intervalConsistency: 0 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push(daysBetween(dates[i - 1]!, dates[i]!));
  }

  const med = median(intervals);

  const bands: Array<{
    name: 'weekly' | 'monthly' | 'annual';
    target: number;
    tolerance: number;
  }> = [
    { name: 'weekly', target: 7, tolerance: 2 },
    { name: 'monthly', target: 30, tolerance: 5 },
    { name: 'annual', target: 365, tolerance: 15 },
  ];

  for (const band of bands) {
    if (Math.abs(med - band.target) <= band.tolerance) {
      const inBand = intervals.filter(
        (iv) => Math.abs(iv - band.target) <= band.tolerance,
      ).length;
      const consistency = inBand / intervals.length;
      return { frequency: band.name, intervalConsistency: consistency };
    }
  }

  return { frequency: 'unknown', intervalConsistency: 0 };
}

function amountConsistencyScore(transactions: BankTransactionRecord[]): number {
  if (transactions.length < 2) return 0;
  const amounts = transactions.map((t) => t.amount);
  const mode = amounts
    .sort(
      (a, b) =>
        amounts.filter((v) => v === b).length -
        amounts.filter((v) => v === a).length,
    )[0]!;
  const matching = amounts.filter((a) => a === mode).length;
  return matching / amounts.length;
}

function fuzzyMatch(normalized: string, catalogName: string): boolean {
  const normCatalog = catalogName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normPayee = normalized.replace(/[^a-z0-9]/g, '');
  return normCatalog === normPayee || normPayee.includes(normCatalog) || normCatalog.includes(normPayee);
}

function findCatalogMatch(
  normalizedPayee: string,
  catalog: CatalogEntryLike[],
): string | null {
  for (const entry of catalog) {
    if (fuzzyMatch(normalizedPayee, entry.name)) {
      return entry.id;
    }
  }
  return null;
}

function isAlreadyTracked(
  normalizedPayee: string,
  matchedCatalogId: string | null,
  existingSubscriptions: Array<{ name: string; catalog_id: string | null }>,
): boolean {
  for (const sub of existingSubscriptions) {
    if (matchedCatalogId && sub.catalog_id === matchedCatalogId) return true;
    if (normalizePayeeName(sub.name) === normalizedPayee) return true;
  }
  return false;
}

/**
 * Analyze bank transactions to detect recurring charges that may be
 * subscriptions. Returns suggestions sorted by confidence (highest first).
 *
 * This function is pure: no database access, no side effects.
 */
export function detectRecurringCharges(
  transactions: BankTransactionRecord[],
  existingSubscriptions: Array<{ name: string; catalog_id: string | null }>,
  catalog: CatalogEntryLike[],
): DetectedSubscription[] {
  const groups = groupByPayee(transactions);
  const results: DetectedSubscription[] = [];

  for (const group of groups) {
    if (group.transactions.length < 2) continue;

    const dates = group.transactions.map((t) => t.datePosted);
    const { frequency, intervalConsistency } = detectFrequency(dates);

    if (frequency === 'unknown') continue;

    const amountScore = amountConsistencyScore(group.transactions);
    const dataPointBonus = Math.min(group.transactions.length / 12, 1) * 0.2;
    const catalogId = findCatalogMatch(group.normalizedPayee, catalog);
    const catalogBonus = catalogId ? 0.2 : 0;

    let confidence =
      intervalConsistency * 0.4 + amountScore * 0.2 + dataPointBonus + catalogBonus;
    confidence = Math.min(Math.round(confidence * 100) / 100, 1);

    const mostRecent = group.transactions[group.transactions.length - 1]!;

    results.push({
      payee: group.rawPayee,
      normalizedPayee: group.normalizedPayee,
      amount: mostRecent.amount,
      frequency,
      confidence,
      matchedCatalogId: catalogId,
      transactionDates: dates,
      isAlreadyTracked: isAlreadyTracked(
        group.normalizedPayee,
        catalogId,
        existingSubscriptions,
      ),
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
