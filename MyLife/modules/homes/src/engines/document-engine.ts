import type { HomeDocument } from '../types';

export interface DocumentStats {
  total: number;
  byCategory: Record<string, number>;
  expiringCount: number;
}

/**
 * Return documents whose expiryDate falls within `withinDays` from `today`.
 * Documents without an expiryDate are excluded.
 */
export function getExpiringDocuments(
  docs: HomeDocument[],
  withinDays: number,
  today?: string,
): HomeDocument[] {
  const todayDate = today ? new Date(today) : new Date();
  const cutoff = new Date(todayDate);
  cutoff.setDate(cutoff.getDate() + withinDays);

  return docs.filter((doc) => {
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    return expiry >= todayDate && expiry <= cutoff;
  });
}

/**
 * Search documents by matching `query` (case-insensitive) against title, category, tags, and notes.
 */
export function searchDocuments(
  docs: HomeDocument[],
  query: string,
): HomeDocument[] {
  const q = query.toLowerCase();

  return docs.filter((doc) => {
    const fields = [doc.title, doc.category, doc.tags, doc.notes];
    return fields.some((field) => field && field.toLowerCase().includes(q));
  });
}

/**
 * Compute stats: total documents, count per category, and how many have an expiry date set.
 */
export function getDocumentStats(docs: HomeDocument[]): DocumentStats {
  const byCategory: Record<string, number> = {};
  let expiringCount = 0;

  for (const doc of docs) {
    byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
    if (doc.expiryDate) expiringCount++;
  }

  return { total: docs.length, byCategory, expiringCount };
}
