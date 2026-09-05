// Meerkat app-unlock RevenueCat wrapper (Plan 22 Part 1, mobile IAP rail).
//
// This is the ONLY module that imports react-native-purchases, so the native SDK
// stays out of the rest of the test graph (screens import this wrapper; its own test
// mocks react-native-purchases), mirroring apps/dowork/app/(root)/data/purchases.ts
// and the lazy lan-backend.ts idiom.
//
// HONESTY CONTRACT (Plan 22 L2 / NC-2):
//   - The one-time unlock is a LOCAL gate derived from a REAL StoreKit/Play receipt
//     via `deriveMeerkatAppUnlock` (the pure @mylife/entitlements derivation). No
//     path ever fakes a purchase or an unlocked state.
//   - Without a configured RevenueCat key (EXPO_PUBLIC_MEERKAT_RC_KEY_IOS/_ANDROID),
//     or in Expo Go / no native module, the wrapper reports "unavailable" and the
//     gate STAYS LOCKED (fail closed). Public browsing still works.
//   - The displayed price comes from the STORE offering; it falls back to the
//     billing-config figure (never a hardcoded "$4.99" string literal).

import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesStoreProduct,
  type PurchasesStoreTransaction,
} from 'react-native-purchases';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';
import {
  createHostedAuthBearer,
  createRevenueCatAppUserId,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  deriveMeerkatAppUnlock,
  MEERKAT_APP_UNLOCK_PRODUCT_ID,
  type MeerkatAppUnlockState,
} from '@mylife/entitlements';

export type PurchasePlatform = 'ios' | 'android';

const RC_KEY_PREFIX: Record<PurchasePlatform, 'appl_' | 'goog_'> = {
  ios: 'appl_',
  android: 'goog_',
};

const NOT_CONFIGURED_COPY = 'The in-app purchase is not available in this build.';

// EXPO_PUBLIC_ values exist in a release bundle ONLY where the source has a
// literal `process.env.EXPO_PUBLIC_NAME` member expression (babel-preset-expo
// inline-env-vars rewrites exactly that pattern). Reading them off a captured
// process.env object works in dev and Vitest but is undefined in every
// TestFlight/production bundle, so the key must be read here, at call time,
// through direct member expressions.
export function publicPurchaseEnv(): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS,
    EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID: process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID,
  };
}

/** billing-config is the source-of-truth fallback price; never hardcode a dollar string. */
export const FALLBACK_UNLOCK_PRICE_LABEL = `$${MEERKAT_APP_UNLOCK_PRODUCT.price.toFixed(2)}`;

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function currentPlatform(): PurchasePlatform {
  return Platform.OS === 'android' ? 'android' : 'ios';
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

// RevenueCat surfaces user cancellation as a flag on the thrown error; treat it as a
// soft dismissal, never an error toast.
function isUserCancelled(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { userCancelled?: boolean }).userCancelled);
}

export type RcKeyResult = { ok: true; apiKey: string } | { ok: false; error: string };

// Resolve the per-platform public SDK key. Missing key -> honest unavailable (the
// unlock just is not wired for this build); wrong-store prefix -> a real misconfig.
export function resolveRevenueCatKey(
  env: Record<string, string | undefined>,
  platform: PurchasePlatform,
): RcKeyResult {
  const key =
    platform === 'ios'
      ? env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS?.trim()
      : env.EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID?.trim();
  if (!key) return { ok: false, error: NOT_CONFIGURED_COPY };
  const expected = RC_KEY_PREFIX[platform];
  if (!key.startsWith(expected)) {
    return { ok: false, error: `RevenueCat key does not match the ${platform} build; expected a ${expected} key.` };
  }
  return { ok: true, apiKey: key };
}

interface PurchasesState {
  configured: boolean;
  reason: string | null;
  subjectId: string | null;
}

const state: PurchasesState = { configured: false, reason: null, subjectId: null };

export function __resetAppUnlockStateForTest(): void {
  state.configured = false;
  state.reason = null;
  state.subjectId = null;
}

export function isPurchasesConfigured(): boolean {
  return state.configured;
}

export function getUnavailableReason(): string | null {
  return state.reason;
}

// Idempotent configure. Missing/invalid key leaves configured=false with an honest
// reason the screen surfaces instead of a Buy button (fail closed).
export function ensurePurchasesConfigured(
  env: Record<string, string | undefined> = publicPurchaseEnv(),
  platform: PurchasePlatform = currentPlatform(),
  identity?: DeviceIdentity,
): { configured: boolean; reason: string | null } {
  if (!identity) {
    state.reason = 'The device identity is not ready for purchase verification.';
    return { configured: false, reason: state.reason };
  }
  const subject = createRevenueCatAppUserId(identity);
  if (state.configured) {
    if (state.subjectId !== subject) {
      state.reason = 'The purchase identity changed. Restart Meerkat before purchasing.';
      return { configured: false, reason: state.reason };
    }
    return { configured: true, reason: null };
  }
  const keyResult = resolveRevenueCatKey(env, platform);
  if (!keyResult.ok) {
    state.reason = keyResult.error;
    return { configured: false, reason: state.reason };
  }
  try {
    Purchases.configure({ apiKey: keyResult.apiKey, appUserID: subject });
    void Purchases.setLogLevel(LOG_LEVEL.WARN);
    state.configured = true;
    state.reason = null;
    state.subjectId = subject;
    return { configured: true, reason: null };
  } catch (error) {
    state.reason = errMessage(error);
    return { configured: false, reason: state.reason };
  }
}

/**
 * Map a RevenueCat CustomerInfo to the honest unlock state. A one-time
 * non-consumable appears in `nonSubscriptionTransactions`; RevenueCat removes a
 * refunded transaction, so presence == a real, non-reversed purchase. The
 * derivation is the shared pure function, so mobile and the server agree.
 */
export function unlockFromCustomerInfo(info: CustomerInfo): MeerkatAppUnlockState {
  const transactions = Array.isArray(info?.nonSubscriptionTransactions)
    ? info.nonSubscriptionTransactions
    : [];
  const purchases = transactions
    .filter((t: PurchasesStoreTransaction) => t.productIdentifier === MEERKAT_APP_UNLOCK_PRODUCT_ID)
    .map((t: PurchasesStoreTransaction) => ({
      productId: MEERKAT_APP_UNLOCK_PRODUCT_ID,
      purchaseDate: t.purchaseDate,
      isActive: true,
    }));
  return deriveMeerkatAppUnlock(purchases);
}

// Fetch the store product for the unlock, returning its localized price string.
export async function getUnlockPriceLabel(identity: DeviceIdentity): Promise<Result<{ priceLabel: string }>> {
  const cfg = ensurePurchasesConfigured(undefined, undefined, identity);
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };
  try {
    const products: PurchasesStoreProduct[] = await Purchases.getProducts([MEERKAT_APP_UNLOCK_PRODUCT_ID]);
    const product = products.find((p) => p.identifier === MEERKAT_APP_UNLOCK_PRODUCT_ID);
    if (!product) return { ok: false, error: 'This purchase is not available from the store yet.' };
    return { ok: true, priceLabel: product.priceString ?? FALLBACK_UNLOCK_PRICE_LABEL };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export type PurchaseOutcome =
  | { ok: true; unlock: MeerkatAppUnlockState }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: string };

// Drive the native purchase, then derive the unlock from the returned CustomerInfo.
export async function purchaseAppUnlock(identity: DeviceIdentity): Promise<PurchaseOutcome> {
  const cfg = ensurePurchasesConfigured(undefined, undefined, identity);
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };
  let products: PurchasesStoreProduct[];
  try {
    products = await Purchases.getProducts([MEERKAT_APP_UNLOCK_PRODUCT_ID]);
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
  const product = products.find((p) => p.identifier === MEERKAT_APP_UNLOCK_PRODUCT_ID);
  if (!product) return { ok: false, error: 'This purchase is not available from the store yet.' };
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    return { ok: true, unlock: unlockFromCustomerInfo(customerInfo) };
  } catch (error) {
    if (isUserCancelled(error)) return { ok: false, cancelled: true };
    return { ok: false, error: errMessage(error) };
  }
}

// Restore replays the store's receipts; the unlock re-derives from CustomerInfo.
export async function restoreAppUnlock(identity: DeviceIdentity): Promise<Result<{ unlock: MeerkatAppUnlockState }>> {
  const cfg = ensurePurchasesConfigured(undefined, undefined, identity);
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, unlock: unlockFromCustomerInfo(info) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Refresh the current RevenueCat customer without launching the OS restore flow.
// RevenueCat documents restorePurchases as a user-initiated action because it can
// trigger an account-transfer prompt. Cold-start validation therefore uses this
// non-interactive customer-info read and leaves Restore behind its explicit button.
export async function refreshAppUnlock(identity: DeviceIdentity): Promise<Result<{ unlock: MeerkatAppUnlockState }>> {
  const cfg = ensurePurchasesConfigured(undefined, undefined, identity);
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };
  try {
    const info = await Purchases.getCustomerInfo();
    return { ok: true, unlock: unlockFromCustomerInfo(info) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

/** Revalidate a server-issued cross-rail grant against its source purchase. */
export async function validateLinkedAppUnlock(
  identity: DeviceIdentity,
  apiUrl: string,
  grant: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<{ unlock: MeerkatAppUnlockState; grant: string }>> {
  const base = apiUrl.trim().replace(/\/+$/u, '');
  if (!base || !grant) return { ok: false, error: 'The cross-rail purchase grant is not configured.' };
  try {
    const response = await fetchImpl(
      `${base}/api/entitlements/meerkat-app?grant=${encodeURIComponent(grant)}`,
      { headers: { Authorization: `Bearer ${createHostedAuthBearer(identity)}` } },
    );
    if (!response.ok) return { ok: false, error: `Purchase validation failed with ${response.status}.` };
    const state = await response.json() as MeerkatAppUnlockState & { grant?: unknown };
    return {
      ok: true,
      unlock: { unlocked: state.unlocked === true, purchaseDate: state.purchaseDate ?? null },
      grant,
    };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface AppUnlockLinkCode {
  code: string;
  expiresAt: string;
}

/**
 * Ask the hosted service to validate this device's RevenueCat customer and mint
 * a single-use cross-rail code. The RevenueCat app user id must equal the
 * device-signed hosted subject, so a caller cannot submit another customer's id.
 */
export async function mintMobileAppUnlockLink(
  identity: DeviceIdentity,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<AppUnlockLinkCode>> {
  const base = apiUrl.trim().replace(/\/+$/u, '');
  if (!base) return { ok: false, error: 'A connection server is not configured.' };
  const cfg = ensurePurchasesConfigured(undefined, undefined, identity);
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };
  try {
    const appUserId = await Purchases.getAppUserID();
    if (appUserId !== createRevenueCatAppUserId(identity)) {
      return { ok: false, error: 'The store purchase identity does not match this device.' };
    }
    const response = await fetchImpl(`${base}/api/link/meerkat-app`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${createHostedAuthBearer(identity)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rail: currentPlatform() === 'ios' ? 'storekit' : 'play', receipt: appUserId }),
    });
    const body = (await response.json().catch(() => null)) as {
      code?: unknown;
      expiresAt?: unknown;
      reason?: unknown;
      error?: unknown;
    } | null;
    if (!response.ok) {
      const reason = typeof body?.reason === 'string'
        ? body.reason
        : typeof body?.error === 'string' ? body.error : `status_${response.status}`;
      return { ok: false, error: `Purchase link failed: ${reason}.` };
    }
    if (typeof body?.code !== 'string' || typeof body.expiresAt !== 'string') {
      return { ok: false, error: 'The connection server returned an invalid link code.' };
    }
    return { ok: true, code: body.code, expiresAt: body.expiresAt };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// mk_settings keys the screen caches the unlock into (device-local, never synced).
// Defined in app-unlock-keys.ts (RN-free) and re-exported here for existing callers.
export { APP_UNLOCK_GRANT_KEY, APP_UNLOCK_PURCHASED_AT_KEY, APP_UNLOCK_RECEIPT_KEY } from './app-unlock-keys';
