import type { BankTransactionRecord } from './types';
import {
  detectRecurringCharges,
  normalizePayeeName,
  type CatalogEntryLike,
  type DetectedSubscription,
} from './recurring-detector';

export { normalizePayeeName } from './recurring-detector';

/**
 * Get subscription suggestions filtered by dismissed payees.
 * Wraps detectRecurringCharges and removes any payees the user
 * has previously dismissed.
 */
export function getSubscriptionSuggestions(
  transactions: BankTransactionRecord[],
  existingSubscriptions: Array<{ name: string; catalog_id: string | null }>,
  catalog: CatalogEntryLike[],
  dismissedPayees: string[],
): DetectedSubscription[] {
  const dismissed = new Set(dismissedPayees.map(normalizePayeeName));
  const suggestions = detectRecurringCharges(
    transactions,
    existingSubscriptions,
    catalog,
  );
  return suggestions.filter((s) => !dismissed.has(s.normalizedPayee));
}
