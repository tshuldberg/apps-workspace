import type { StorageTier } from '@mylife/entitlements';
import { PRODUCTS } from '@mylife/billing-config';
import type { StorageSubscription, StripeSDK } from './types';

// ---------------------------------------------------------------------------
// Cloud storage tier management (Stripe metered billing)
// ---------------------------------------------------------------------------

/** Map storage tier to Stripe product/price ID. */
const STORAGE_PRICE_MAP: Record<Exclude<StorageTier, 'free'>, string> = {
  starter: PRODUCTS.storageTiers.starter.id,
  power: PRODUCTS.storageTiers.power.id,
};

/** Reverse lookup: product ID to storage tier. */
const PRICE_TO_TIER: Record<string, Exclude<StorageTier, 'free'>> = {
  [PRODUCTS.storageTiers.starter.id]: 'starter',
  [PRODUCTS.storageTiers.power.id]: 'power',
};

let sdk: StripeSDK | null = null;

/** Initialize with a Stripe SDK instance (shares the same one from stripe.ts). */
export function initStorageBilling(stripeSdk: StripeSDK): void {
  sdk = stripeSdk;
}

function getSDK(): StripeSDK {
  if (!sdk) throw new Error('Storage billing not initialized. Call initStorageBilling() first.');
  return sdk;
}

/**
 * Upgrade to a paid storage tier.
 * Creates a Stripe subscription for the selected tier.
 * If user already has a storage subscription, it should be canceled first.
 */
export async function upgradeStorageTier(
  tier: Exclude<StorageTier, 'free'>,
): Promise<void> {
  const priceId = STORAGE_PRICE_MAP[tier];
  // Cancel existing storage subscription if any
  const existing = await getStorageSubscription();
  if (existing) {
    await cancelStorageTier();
  }
  await getSDK().createSubscription({ priceId });
}

/** Cancel the current storage subscription (downgrades to free at period end). */
export async function cancelStorageTier(): Promise<void> {
  const sub = await findStorageSubscription();
  if (sub) {
    await getSDK().cancelSubscription(sub.subscriptionId);
  }
}

/** Downgrade storage (alias for cancel -- reverts to free tier). */
export async function downgradeStorageTier(): Promise<void> {
  await cancelStorageTier();
}

/** Get the current active storage subscription, if any. */
export async function getStorageSubscription(): Promise<StorageSubscription | null> {
  const sub = await findStorageSubscription();
  if (!sub) return null;

  const tier = PRICE_TO_TIER[sub.priceId];
  if (!tier) return null;

  return {
    tier,
    productId: sub.priceId,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

async function findStorageSubscription() {
  const subs = await getSDK().listActiveSubscriptions();
  return subs.find((s) =>
    s.priceId === PRODUCTS.storageTiers.starter.id ||
    s.priceId === PRODUCTS.storageTiers.power.id,
  ) ?? null;
}
