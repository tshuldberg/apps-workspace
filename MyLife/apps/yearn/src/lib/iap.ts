// Yearn StoreKit client (plan 47 Phase 5).
//
// The ONLY module that imports expo-iap. Purchases run through StoreKit 2
// with appAccountToken bound to the authenticated user id, and the signed
// transaction JWS (purchase.purchaseToken on iOS) is handed to the
// server-side validators (yearn-boost-activate / yearn-membership-activate).
// The server is the source of truth: nothing here grants an entitlement,
// and finishTransaction runs only AFTER server validation succeeds so an
// unvalidated purchase re-surfaces on the next launch instead of vanishing.

import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';

export const YEARN_BOOST_SKU = 'com.mylife.yearn.boost';
export const YEARN_MEMBERSHIP_SKU = 'com.mylife.yearn.membership';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type YearnIapKind = 'boost' | 'membership';

export interface IapPurchase {
  productId?: string;
  purchaseToken?: string | null;
}

export interface IapProduct {
  id?: string;
  displayPrice?: string;
  title?: string;
}

export interface IapRuntime {
  initConnection(): Promise<boolean>;
  fetchProducts(params: {
    skus: string[];
    type: 'in-app' | 'subs';
  }): Promise<IapProduct[]>;
  requestPurchase(params: unknown): Promise<unknown>;
  purchaseUpdatedListener(listener: (purchase: IapPurchase) => void): { remove(): void };
  purchaseErrorListener(
    listener: (error: { code?: string; message?: string }) => void,
  ): { remove(): void };
  finishTransaction(params: {
    purchase: IapPurchase;
    isConsumable?: boolean;
  }): Promise<unknown>;
  getAvailablePurchases(): Promise<IapPurchase[]>;
}

export type IapUnavailableReason =
  | 'cancelled' // the user dismissed the payment sheet; show nothing
  | 'unavailable' // store not reachable / product not configured
  | 'invalid_user' // caller passed a non-UUID user id
  | 'error';

export type YearnPurchaseResult =
  | { ok: true; jws: string; purchase: IapPurchase }
  | { ok: false; reason: IapUnavailableReason; error: string };

const defaultRuntime: IapRuntime = {
  initConnection,
  fetchProducts: async (params) =>
    ((await fetchProducts(params as never)) ?? []) as unknown as IapProduct[],
  requestPurchase: (params) => requestPurchase(params as never),
  purchaseUpdatedListener: (listener) => purchaseUpdatedListener(listener),
  purchaseErrorListener: (listener) => purchaseErrorListener(listener),
  finishTransaction: (params) => finishTransaction(params as never),
  getAvailablePurchases: () => getAvailablePurchases(),
};

function skuForKind(kind: YearnIapKind): string {
  return kind === 'boost' ? YEARN_BOOST_SKU : YEARN_MEMBERSHIP_SKU;
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

function isCancellation(code: string | undefined, message: string): boolean {
  return /cancel/i.test(code ?? '') || /cancel/i.test(message);
}

let connectionReady: Promise<boolean> | null = null;

async function ensureConnection(runtime: IapRuntime): Promise<boolean> {
  if (runtime !== defaultRuntime) {
    // Injected runtimes (tests) manage their own connection state.
    try {
      return await runtime.initConnection();
    } catch {
      return false;
    }
  }
  if (!connectionReady) {
    connectionReady = runtime.initConnection().catch(() => {
      connectionReady = null;
      return false;
    });
  }
  return connectionReady;
}

/**
 * Fetches localized store pricing for honest paywall copy. Returns an empty
 * map when the store is unreachable (simulator, no products configured);
 * callers must render an unavailable state, never a hardcoded price.
 */
export async function fetchYearnProductPrices(
  runtime: IapRuntime = defaultRuntime,
): Promise<Partial<Record<YearnIapKind, string>>> {
  const prices: Partial<Record<YearnIapKind, string>> = {};
  if (!(await ensureConnection(runtime))) return prices;
  try {
    const [products, subscriptions] = await Promise.all([
      runtime.fetchProducts({ skus: [YEARN_BOOST_SKU], type: 'in-app' }),
      runtime.fetchProducts({ skus: [YEARN_MEMBERSHIP_SKU], type: 'subs' }),
    ]);
    const boost = products.find((product) => product.id === YEARN_BOOST_SKU);
    const membership = subscriptions.find((product) => product.id === YEARN_MEMBERSHIP_SKU);
    if (boost?.displayPrice) prices.boost = boost.displayPrice;
    if (membership?.displayPrice) prices.membership = membership.displayPrice;
  } catch {
    // Store unreachable: leave prices empty, the UI shows an honest state.
  }
  return prices;
}

/**
 * Runs one StoreKit purchase bound to the authenticated user and resolves
 * with the signed transaction JWS. The caller MUST validate server-side and
 * then call finishYearnPurchase; this function never finishes transactions.
 */
export async function purchaseYearnProduct(
  kind: YearnIapKind,
  userId: string,
  runtime: IapRuntime = defaultRuntime,
): Promise<YearnPurchaseResult> {
  if (!UUID_PATTERN.test(userId)) {
    return {
      ok: false,
      reason: 'invalid_user',
      error: 'A signed-in account is required to purchase.',
    };
  }
  if (!(await ensureConnection(runtime))) {
    return {
      ok: false,
      reason: 'unavailable',
      error: 'The App Store is not available right now.',
    };
  }

  const sku = skuForKind(kind);
  return await new Promise<YearnPurchaseResult>((resolve) => {
    let settled = false;
    const settle = (result: YearnPurchaseResult) => {
      if (settled) return;
      settled = true;
      updateSub.remove();
      errorSub.remove();
      resolve(result);
    };

    const updateSub = runtime.purchaseUpdatedListener((purchase) => {
      if (purchase.productId && purchase.productId !== sku) return;
      const jws = typeof purchase.purchaseToken === 'string' ? purchase.purchaseToken.trim() : '';
      if (!jws) {
        settle({
          ok: false,
          reason: 'error',
          error: 'The purchase completed but no signed transaction was returned.',
        });
        return;
      }
      settle({ ok: true, jws, purchase });
    });

    const errorSub = runtime.purchaseErrorListener((error) => {
      const message = errMessage(error);
      if (isCancellation(error.code, message)) {
        settle({ ok: false, reason: 'cancelled', error: 'Purchase cancelled.' });
        return;
      }
      settle({ ok: false, reason: 'error', error: message });
    });

    void Promise.resolve(
      runtime.requestPurchase({
        request: {
          apple: {
            sku,
            ...(kind === 'boost' ? { quantity: 1 } : {}),
            appAccountToken: userId.toLowerCase(),
          },
        },
        type: kind === 'boost' ? 'in-app' : 'subs',
      }),
    ).catch((error: unknown) => {
      const message = errMessage(error);
      if (isCancellation((error as { code?: string })?.code, message)) {
        settle({ ok: false, reason: 'cancelled', error: 'Purchase cancelled.' });
        return;
      }
      settle({ ok: false, reason: 'error', error: message });
    });
  });
}

/**
 * Finishes a server-validated purchase so StoreKit stops re-delivering it.
 * Only call after the server accepted the JWS.
 */
export async function finishYearnPurchase(
  purchase: IapPurchase,
  kind: YearnIapKind,
  runtime: IapRuntime = defaultRuntime,
): Promise<void> {
  try {
    await runtime.finishTransaction({ purchase, isConsumable: kind === 'boost' });
  } catch {
    // Non-fatal: StoreKit re-delivers unfinished transactions on next launch
    // and the server-side dedup makes revalidation idempotent.
  }
}

/**
 * Restore: returns the signed JWS of the newest membership purchase on this
 * Apple account, for server re-validation. Null when none exists.
 */
export async function restoreYearnMembershipJws(
  runtime: IapRuntime = defaultRuntime,
): Promise<string | null> {
  if (!(await ensureConnection(runtime))) return null;
  try {
    const purchases = await runtime.getAvailablePurchases();
    const membership = purchases.find(
      (purchase) =>
        purchase.productId === YEARN_MEMBERSHIP_SKU &&
        typeof purchase.purchaseToken === 'string' &&
        purchase.purchaseToken.trim().length > 0,
    );
    return membership ? (membership.purchaseToken as string).trim() : null;
  } catch {
    return null;
  }
}
