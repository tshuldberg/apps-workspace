import type { ModuleId } from '@mylife/module-registry';
import type { ProductId, Purchase, StorageTier } from '@mylife/entitlements';
import { PRODUCTS } from '@mylife/billing-config';
import type {
  PaymentService,
  Platform,
  PurchaseResult,
  RevenueCatSDK,
  StorageSubscription,
  StripeSDK,
  Unsubscribe,
} from './types';
import {
  initRevenueCat,
  purchaseHubUnlock as rcPurchaseHub,
  purchaseStandaloneModule as rcPurchaseStandalone,
  purchaseAnnualUpdate as rcPurchaseUpdate,
  restorePurchases as rcRestore,
  getActivePurchases as rcGetActive,
  onPurchaseUpdated as rcOnUpdated,
} from './revenuecat';
import {
  initStripe,
  purchaseViaStripe,
  getActivePurchases as stripeGetActive,
  onPurchaseUpdated as stripeOnUpdated,
} from './stripe';
import {
  initStorageBilling,
  upgradeStorageTier,
  downgradeStorageTier,
  getStorageSubscription,
} from './storage';

// ---------------------------------------------------------------------------
// Factory configuration
// ---------------------------------------------------------------------------

export interface PaymentServiceConfig {
  platform: Platform;
  /** RevenueCat API key (required for mobile). */
  revenueCatApiKey?: string;
  /** RevenueCat SDK instance (required for mobile). */
  revenueCatSdk?: RevenueCatSDK;
  /** Stripe SDK instance (required for web, optional for mobile storage billing). */
  stripeSdk?: StripeSDK;
  /** Stripe Checkout redirect URLs (web only). */
  stripeUrls?: { successUrl?: string; cancelUrl?: string };
  /** Purchase store for web-side active purchase queries. */
  purchaseStore?: () => Promise<Purchase[]>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a PaymentService that routes to the correct provider.
 *
 * - Mobile: RevenueCat for IAP, Stripe for storage billing
 * - Web: Stripe for everything
 */
export function createPaymentService(config: PaymentServiceConfig): PaymentService {
  const { platform } = config;

  // Initialize RevenueCat for mobile
  if (platform === 'mobile' && config.revenueCatSdk && config.revenueCatApiKey) {
    initRevenueCat(config.revenueCatSdk, config.revenueCatApiKey);
  }

  // Initialize Stripe for web purchases (and storage billing on both platforms)
  if (config.stripeSdk) {
    initStripe(config.stripeSdk, config.stripeUrls);
    initStorageBilling(config.stripeSdk);
  }

  // Default purchase store returns empty array
  const purchaseStore = config.purchaseStore ?? (() => Promise.resolve([]));

  return {
    async purchase(productId: ProductId): Promise<PurchaseResult> {
      if (platform === 'mobile') {
        return routeMobilePurchase(productId);
      }
      return purchaseViaStripe(productId);
    },

    async restore(): Promise<Purchase[]> {
      if (platform === 'mobile') {
        return rcRestore();
      }
      // Web: purchases are tracked server-side via webhooks
      return purchaseStore();
    },

    async getActivePurchases(): Promise<Purchase[]> {
      if (platform === 'mobile') {
        return rcGetActive();
      }
      return stripeGetActive(purchaseStore);
    },

    async upgradeStorage(tier: Exclude<StorageTier, 'free'>): Promise<void> {
      return upgradeStorageTier(tier);
    },

    async downgradeStorage(): Promise<void> {
      return downgradeStorageTier();
    },

    async getStorageSubscription(): Promise<StorageSubscription | null> {
      return getStorageSubscription();
    },

    onPurchaseUpdated(callback: (purchases: Purchase[]) => void): Unsubscribe {
      if (platform === 'mobile') {
        return rcOnUpdated(callback);
      }
      return stripeOnUpdated(callback);
    },
  };
}

// ---------------------------------------------------------------------------
// Mobile purchase routing
// ---------------------------------------------------------------------------

async function routeMobilePurchase(productId: ProductId): Promise<PurchaseResult> {
  if (productId === 'mylife_hub_unlock') {
    return rcPurchaseHub();
  }
  if (productId === 'mylife_annual_update') {
    return rcPurchaseUpdate();
  }
  // Storage tiers are Stripe subscriptions, not IAP
  if (productId === 'mylife_storage_starter' || productId === 'mylife_storage_power') {
    return {
      success: false,
      purchase: null,
      error: 'Storage tier purchases use upgradeStorage(), not purchase().',
    };
  }
  // Standalone module unlock
  const match = productId.match(/^mylife_(.+)_unlock$/);
  if (match && match[1] !== 'hub') {
    return rcPurchaseStandalone(match[1] as ModuleId);
  }
  return { success: false, purchase: null, error: `Unknown product: ${productId}` };
}
