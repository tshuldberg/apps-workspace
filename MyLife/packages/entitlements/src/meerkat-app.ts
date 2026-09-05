import type { Purchase } from './types';

/**
 * The one-time IAP product id that unlocks the standalone Meerkat app.
 *
 * FOUNDER-LOCKED PRICING (2026-07-05): the Meerkat app is a $4.99 ONE-TIME
 * unlock. The price lives in `@mylife/billing-config`
 * (`MEERKAT_APP_UNLOCK_PRODUCT`); this constant is the product id the derivation
 * keys off. There is NO subscription, metered, or yearly app SKU. Keep the two
 * literals in sync (each package locks it with a test).
 */
export const MEERKAT_APP_UNLOCK_PRODUCT_ID = 'meerkat_app_unlock';

/** The derived Meerkat app-unlock state (Plan 22 Phase 0, pure). */
export interface MeerkatAppUnlockState {
  /** true iff a non-refunded `meerkat_app_unlock` one-time purchase is present. */
  unlocked: boolean;
  /** ISO-8601 date of the (earliest) unlock purchase, or null when not unlocked. */
  purchaseDate: string | null;
}

/**
 * Pure derivation of the Meerkat app-unlock state from a purchase list.
 *
 * The unlock is a one-time non-consumable: any ACTIVE `meerkat_app_unlock`
 * purchase unlocks the app permanently. It fails closed on a refund/dispute
 * (the provider flips `isActive` to false) and ignores every unrelated product,
 * so a MyLife hub or module unlock never leaks into the Meerkat app gate. No IO,
 * no clock: given the same purchases it always returns the same result.
 */
export function deriveMeerkatAppUnlock(purchases: readonly Purchase[]): MeerkatAppUnlockState {
  let unlocked = false;
  let earliestMs: number | null = null;
  for (const purchase of purchases) {
    if (purchase.productId !== MEERKAT_APP_UNLOCK_PRODUCT_ID) continue;
    // A refunded/disputed one-time purchase arrives with isActive:false and must
    // NOT unlock the app: the gate is honest about a reversed payment.
    if (!purchase.isActive) continue;
    unlocked = true;
    const purchasedMs = Date.parse(purchase.purchaseDate);
    if (!Number.isNaN(purchasedMs) && (earliestMs === null || purchasedMs < earliestMs)) {
      earliestMs = purchasedMs;
    }
  }
  return {
    unlocked,
    purchaseDate: earliestMs !== null ? new Date(earliestMs).toISOString() : null,
  };
}
