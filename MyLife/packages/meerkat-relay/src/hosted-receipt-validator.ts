/**
 * Server-side store-receipt validation for the cross-rail app-unlock Link flow
 * (Plan 22 F1 / TC-10).
 *
 * When a user who bought on the STORE rail (StoreKit / Play) wants to link that
 * purchase to the web (Stripe) rail, the hosted service must NOT self-certify the
 * receipt: it validates the identified RevenueCat customer through RevenueCat's
 * server API. RevenueCat, in turn, verifies the StoreKit or Play transaction. The
 * app user id is an unguessable device signature, so the provider record is
 * cryptographically bound to the hosted subject. Missing provider credentials
 * still fail closed.
 */

import { verifyRevenueCatAppUserId } from '@mylife/sync';

export type MeerkatPurchaseRail = 'stripe' | 'storekit' | 'play';
export type MeerkatStoreRail = Extract<MeerkatPurchaseRail, 'storekit' | 'play'>;

export interface MeerkatStoreReceiptInput {
  rail: MeerkatStoreRail;
  /** RevenueCat app user id submitted by the mobile client. */
  receipt: string;
  /** Device-signed hosted subject that must verify the app user id. */
  subjectId: string;
  /** The product the receipt must be for (always `meerkat_app_unlock`). */
  productId: string;
}

export type MeerkatStoreReceiptResult =
  | { valid: true; purchaseDate: string }
  | { valid: false; reason: 'not_configured' | 'invalid_receipt' | 'wrong_product' | 'refunded' };

export interface MeerkatStoreReceiptValidator {
  validate(input: MeerkatStoreReceiptInput): Promise<MeerkatStoreReceiptResult>;
}

export interface RevenueCatStoreReceiptValidatorOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

interface RevenueCatNonSubscription {
  purchase_date?: unknown;
  store?: unknown;
  refunded_at?: unknown;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    original_app_user_id?: unknown;
    non_subscriptions?: Record<string, RevenueCatNonSubscription[]>;
  };
}

/**
 * Validate the native non-consumable through RevenueCat's server API. Mobile
 * configures RevenueCat with the device public key as appUserID, and this
 * validator requires that id to match the already verified hosted subject before
 * it asks RevenueCat for purchase history.
 */
export function createRevenueCatStoreReceiptValidator(
  options: RevenueCatStoreReceiptValidatorOptions,
): MeerkatStoreReceiptValidator {
  const apiKey = options.apiKey.trim();
  if (!apiKey) return failClosedStoreReceiptValidator();
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = (options.apiBaseUrl ?? 'https://api.revenuecat.com/v1').replace(/\/+$/u, '');
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    async validate(input): Promise<MeerkatStoreReceiptResult> {
      if (!verifyRevenueCatAppUserId(input.subjectId, input.receipt)) {
        return { valid: false, reason: 'invalid_receipt' };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(
          `${apiBase}/subscribers/${encodeURIComponent(input.receipt)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'X-Platform': input.rail === 'storekit' ? 'ios' : 'android',
            },
            signal: controller.signal,
          },
        );
        if (!response.ok) return { valid: false, reason: 'invalid_receipt' };
        const body = (await response.json()) as RevenueCatSubscriberResponse;
        const subscriber = body.subscriber;
        // A restore can transfer a purchase to a new app user id while the
        // provider retains the earlier original_app_user_id. The endpoint was
        // queried by the verified device-bound id, which is the ownership check.
        if (!subscriber) {
          return { valid: false, reason: 'invalid_receipt' };
        }
        const transactions = subscriber.non_subscriptions?.[input.productId];
        if (!Array.isArray(transactions) || transactions.length === 0) {
          return { valid: false, reason: 'wrong_product' };
        }
        const expectedStore = input.rail === 'storekit' ? 'app_store' : 'play_store';
        const matching = transactions
          .filter((transaction) => transaction.store === expectedStore)
          .sort((a, b) => Date.parse(String(b.purchase_date ?? '')) - Date.parse(String(a.purchase_date ?? '')));
        if (matching.length === 0) return { valid: false, reason: 'invalid_receipt' };
        const latest = matching[0]!;
        if (typeof latest.refunded_at === 'string' && latest.refunded_at.length > 0) {
          return { valid: false, reason: 'refunded' };
        }
        const purchaseMs = Date.parse(String(latest.purchase_date ?? ''));
        if (!Number.isFinite(purchaseMs)) return { valid: false, reason: 'invalid_receipt' };
        return { valid: true, purchaseDate: new Date(purchaseMs).toISOString() };
      } catch {
        return { valid: false, reason: 'invalid_receipt' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * The default validator: it can verify NOBODY, so it refuses everything. A hosted
 * service that has not provisioned Apple/Google credentials uses this, and the Link
 * route then honestly reports that store-receipt linking is unavailable (fail
 * closed) rather than minting an unlock for an unverifiable receipt.
 */
export function failClosedStoreReceiptValidator(): MeerkatStoreReceiptValidator {
  return {
    async validate(): Promise<MeerkatStoreReceiptResult> {
      return { valid: false, reason: 'not_configured' };
    },
  };
}
