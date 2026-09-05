// DoWork RevenueCat wrapper.
//
// This is the ONLY module that imports react-native-purchases, so the native
// SDK stays out of the test graph (screens import this wrapper; its own test
// mocks react-native-purchases). Everything returns the house result shape
// ({ ok: true, ... } | { ok: false, error }); no path ever fakes a purchase or
// a "subscribed" state.
//
// Entitlement truth is the SERVER, never the local receipt. The purchase flow:
//   1. configure with the per-platform public SDK key (prefix-validated),
//   2. logIn with the Supabase user id so the webhook's app_user_id matches,
//   3. set the RevenueCat subscriber attribute `trainer_id` BEFORE purchasing
//      (locked contract: dowork-rc-webhook reads event.subscriber_attributes
//      .trainer_id; if unset the event is unmatched and no subscription row is
//      written),
//   4. drive the store purchase,
//   5. poll dw_trainer_subscriptions (self-read RLS) until the webhook writes the
//      active row (server truth). The UI flips to subscribed only on that row; a
//      timeout is an honest "confirming" pending state, not a failure.

import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTrainerPriceTier } from './cloud-trainers';
import {
  waitForActiveSubscription,
  type MyTrainerSubscription,
  type WaitForSubscriptionOptions,
} from './cloud-subscriptions';

export type PurchasePlatform = 'ios' | 'android';

const RC_KEY_PREFIX: Record<PurchasePlatform, 'appl_' | 'goog_'> = {
  ios: 'appl_',
  android: 'goog_',
};

const NOT_CONFIGURED_COPY = 'Trainer subscriptions are not available in this build yet.';

export type PurchaseResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export type RcKeyResult =
  | { ok: true; apiKey: string }
  | { ok: false; error: string };

// Resolves the per-platform public SDK key. Missing key -> honest unavailable
// (no error to shout about, subscriptions just are not wired for this build);
// wrong-store prefix -> a real misconfiguration error.
export function resolveRevenueCatKey(
  env: Record<string, string | undefined>,
  platform: PurchasePlatform,
): RcKeyResult {
  const key =
    platform === 'ios'
      ? env.EXPO_PUBLIC_DOWORK_RC_KEY_IOS?.trim()
      : env.EXPO_PUBLIC_DOWORK_RC_KEY_ANDROID?.trim();

  if (!key) {
    return { ok: false, error: NOT_CONFIGURED_COPY };
  }
  const expected = RC_KEY_PREFIX[platform];
  if (!key.startsWith(expected)) {
    const actual = key.startsWith('appl_') ? 'appl_*' : key.startsWith('goog_') ? 'goog_*' : 'this key';
    return {
      ok: false,
      error: `RevenueCat key ${actual} does not match the ${platform} build; expected a ${expected} key.`,
    };
  }
  return { ok: true, apiKey: key };
}

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

// RevenueCat surfaces user cancellation as a flag on the thrown error rather
// than a distinct outcome; treat it as a soft dismissal, never an error toast.
function isUserCancelled(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { userCancelled?: boolean }).userCancelled);
}

interface PurchasesState {
  configured: boolean;
  reason: string | null;
  loggedInUserId: string | null;
}

const state: PurchasesState = { configured: false, reason: null, loggedInUserId: null };

// Test-only: reset the module-level singleton state between cases.
export function __resetPurchasesStateForTest(): void {
  state.configured = false;
  state.reason = null;
  state.loggedInUserId = null;
}

export interface ConfigureResult {
  configured: boolean;
  reason: string | null;
}

export function isPurchasesConfigured(): boolean {
  return state.configured;
}

export function getPurchasesUnavailableReason(): string | null {
  return state.reason;
}

// Idempotent configure. RevenueCat.configure must run once; subsequent calls are
// no-ops. Missing/invalid key leaves configured=false with an honest reason that
// screens surface instead of a purchase button.
export function ensurePurchasesConfigured(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  platform: PurchasePlatform = currentPlatform(),
): ConfigureResult {
  if (state.configured) return { configured: true, reason: null };

  const keyResult = resolveRevenueCatKey(env, platform);
  if (!keyResult.ok) {
    state.reason = keyResult.error;
    return { configured: false, reason: state.reason };
  }

  try {
    Purchases.configure({ apiKey: keyResult.apiKey });
    void Purchases.setLogLevel(LOG_LEVEL.WARN);
    state.configured = true;
    state.reason = null;
    return { configured: true, reason: null };
  } catch (error) {
    state.reason = errMessage(error);
    return { configured: false, reason: state.reason };
  }
}

// Alias the RevenueCat identity to the Supabase user id so the webhook's
// event.app_user_id equals the DoWork user_id (required to write the
// subscription row against the right account).
export async function identifyPurchaser(userId: string): Promise<PurchaseResult<{ userId: string }>> {
  if (!userId) return { ok: false, error: 'Sign in before subscribing to a trainer.' };
  const cfg = ensurePurchasesConfigured();
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };
  if (state.loggedInUserId === userId) return { ok: true, userId };
  try {
    await Purchases.logIn(userId);
    state.loggedInUserId = userId;
    return { ok: true, userId };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface PurchaseProduct {
  productId: string;
  tier: number;
  priceString: string;
}

// Resolves the store product for a trainer's price tier (dowork_trainer_tier_N).
// Returns the localized price string plus the underlying store product used to
// drive the purchase.
export async function getProductForTier(
  priceTier: number,
): Promise<PurchaseResult<{ product: PurchaseProduct; storeProduct: PurchasesStoreProduct }>> {
  const cfg = ensurePurchasesConfigured();
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };

  const tier = getTrainerPriceTier(priceTier);
  try {
    const products = await Purchases.getProducts([tier.productId], PRODUCT_CATEGORY.SUBSCRIPTION);
    const storeProduct = products.find((item) => item.identifier === tier.productId);
    if (!storeProduct) {
      return { ok: false, error: 'This subscription is not available from the store yet.' };
    }
    // Price truth: only the store's own localized price may be shown at the
    // point of purchase. A product without one is not sellable yet; never
    // fall back to the hardcoded USD tier label (wrong currency/price risk).
    if (!storeProduct.priceString) {
      return { ok: false, error: 'This subscription is not available from the store yet.' };
    }
    return {
      ok: true,
      product: {
        productId: tier.productId,
        tier: tier.tier,
        priceString: storeProduct.priceString,
      },
      storeProduct,
    };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface PurchaseTrainerParams {
  supabase: SupabaseClient;
  userId: string;
  trainerId: string;
  priceTier: number;
}

export type PurchaseTrainerOutcome =
  // Store purchase confirmed server-side: the webhook wrote the active row.
  | { ok: true; confirmed: true; subscription: MyTrainerSubscription }
  // Store purchase succeeded but the server row has not landed yet (honest
  // "confirming your subscription" pending state; keep polling / re-fetch).
  | { ok: true; confirmed: false }
  // User dismissed the store sheet: nothing to report.
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: string };

// The full subscribe flow. See the module header for the ordered contract. The
// poll options are injectable for tests.
export async function purchaseTrainerSubscription(
  params: PurchaseTrainerParams,
  waitOptions: WaitForSubscriptionOptions = {},
): Promise<PurchaseTrainerOutcome> {
  const { supabase, userId, trainerId, priceTier } = params;
  if (!userId) return { ok: false, error: 'Sign in before subscribing to a trainer.' };
  if (!trainerId) return { ok: false, error: 'A trainer is required to subscribe.' };

  const cfg = ensurePurchasesConfigured();
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };

  const identified = await identifyPurchaser(userId);
  if (!identified.ok) return { ok: false, error: identified.error };

  // Locked contract: set trainer_id BEFORE the purchase so the webhook can
  // resolve it from the event's subscriber attributes.
  try {
    await Purchases.setAttributes({ trainer_id: trainerId });
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }

  const productResult = await getProductForTier(priceTier);
  if (!productResult.ok) return { ok: false, error: productResult.error };

  try {
    await Purchases.purchaseStoreProduct(productResult.storeProduct);
  } catch (error) {
    if (isUserCancelled(error)) return { ok: false, cancelled: true };
    return { ok: false, error: errMessage(error) };
  }

  // Server truth. The local receipt is never enough on its own.
  const confirm = await waitForActiveSubscription(supabase, { userId, trainerId }, waitOptions);
  if (!confirm.ok) return { ok: true, confirmed: false };
  if (confirm.active && confirm.subscription) {
    return { ok: true, confirmed: true, subscription: confirm.subscription };
  }
  return { ok: true, confirmed: false };
}

export interface RestoreResult {
  restoredProductIds: string[];
}

// Restore replays the store's receipts to RevenueCat, which re-fires webhooks
// that (re)write the server rows. Returns the active subscription product ids
// RevenueCat knows about; the caller re-fetches server entitlement to flip UI.
export async function restoreTrainerPurchases(
  userId: string,
): Promise<PurchaseResult<RestoreResult>> {
  const cfg = ensurePurchasesConfigured();
  if (!cfg.configured) return { ok: false, error: cfg.reason ?? NOT_CONFIGURED_COPY };

  if (userId) {
    const identified = await identifyPurchaser(userId);
    if (!identified.ok) return { ok: false, error: identified.error };
  }

  try {
    const info = await Purchases.restorePurchases();
    const active = Array.isArray(info?.activeSubscriptions) ? info.activeSubscriptions : [];
    return { ok: true, restoredProductIds: active };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
