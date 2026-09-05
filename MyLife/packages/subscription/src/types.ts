import type { ProductId, StorageTier, Purchase } from '@mylife/entitlements';
import type { ErrorCategory } from '@mylife/errors';

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

export type Platform = 'mobile' | 'web';

// ---------------------------------------------------------------------------
// Purchase results
// ---------------------------------------------------------------------------

export interface PurchaseResult {
  success: boolean;
  purchase: Purchase | null;
  error?: string;
  /**
   * Classified category. `billing` covers payment-declined / entitlement-lapsed
   * outcomes; `network` / `timeout` are retryable; `auth` means the caller
   * must re-authenticate before retrying. See `@mylife/errors`.
   */
  category?: ErrorCategory;
}

// ---------------------------------------------------------------------------
// Storage subscription state
// ---------------------------------------------------------------------------

export interface StorageSubscription {
  tier: Exclude<StorageTier, 'free'>;
  productId: string;
  /** ISO-8601 timestamp when the current billing period started. */
  currentPeriodStart: string;
  /** ISO-8601 timestamp when the current billing period ends. */
  currentPeriodEnd: string;
  /** Whether the subscription will cancel at end of current period. */
  cancelAtPeriodEnd: boolean;
}

// ---------------------------------------------------------------------------
// Unsubscribe callback
// ---------------------------------------------------------------------------

export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// RevenueCat SDK interface (abstract so we can mock)
// ---------------------------------------------------------------------------

export interface RevenueCatSDK {
  configure(apiKey: string): void;
  purchaseProduct(productId: string): Promise<{
    productId: string;
    transactionDate: string;
  }>;
  restorePurchases(): Promise<Array<{
    productId: string;
    transactionDate: string;
  }>>;
  getCustomerInfo(): Promise<{
    activeProducts: Array<{
      productId: string;
      purchaseDate: string;
    }>;
  }>;
  addPurchaseListener(
    callback: (info: {
      activeProducts: Array<{
        productId: string;
        purchaseDate: string;
      }>;
    }) => void,
  ): Unsubscribe;
}

// ---------------------------------------------------------------------------
// Stripe SDK interface (abstract so we can mock)
// ---------------------------------------------------------------------------

export interface StripeSDK {
  createCheckoutSession(params: {
    productId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createPortalSession(): Promise<{ url: string }>;
  createSubscription(params: {
    priceId: string;
  }): Promise<{
    subscriptionId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<{
    subscriptionId: string;
    priceId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    status: string;
  } | null>;
  listActiveSubscriptions(): Promise<Array<{
    subscriptionId: string;
    priceId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    status: string;
  }>>;
  /** Verify a webhook payload signature and return the parsed event. Throws on invalid signature. */
  constructWebhookEvent(payload: string, signature: string, webhookSecret: string): unknown;
}

// ---------------------------------------------------------------------------
// Unified PaymentService interface
// ---------------------------------------------------------------------------

export interface PaymentService {
  /** Detects platform and routes to RevenueCat (mobile) or Stripe (web). */
  purchase(productId: ProductId): Promise<PurchaseResult>;

  /** Restore previously completed purchases (mobile: RevenueCat, web: Stripe). */
  restore(): Promise<Purchase[]>;

  /** Query all currently active purchases. */
  getActivePurchases(): Promise<Purchase[]>;

  /** Upgrade to a cloud storage tier (always Stripe, both platforms). */
  upgradeStorage(tier: Exclude<StorageTier, 'free'>): Promise<void>;

  /** Downgrade / cancel cloud storage tier. */
  downgradeStorage(): Promise<void>;

  /** Get current storage subscription details, if any. */
  getStorageSubscription(): Promise<StorageSubscription | null>;

  /** Listen for purchase updates. */
  onPurchaseUpdated(callback: (purchases: Purchase[]) => void): Unsubscribe;
}
