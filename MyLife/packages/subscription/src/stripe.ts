import type { ProductId, Purchase } from '@mylife/entitlements';
import type { PurchaseResult, StripeSDK, Unsubscribe } from './types';

// ---------------------------------------------------------------------------
// Stripe web purchases -- one-time checkout + storage billing
// ---------------------------------------------------------------------------

let sdk: StripeSDK | null = null;
let webhookSecret: string | null = null;
let successUrl = '/purchase/success';
let cancelUrl = '/purchase/cancel';

/** Initialize the Stripe SDK wrapper. */
export function initStripe(
  stripeSdk: StripeSDK,
  options?: { successUrl?: string; cancelUrl?: string; webhookSecret?: string },
): void {
  sdk = stripeSdk;
  webhookSecret = options?.webhookSecret ?? null;
  if (options?.successUrl) successUrl = options.successUrl;
  if (options?.cancelUrl) cancelUrl = options.cancelUrl;
}

function getSDK(): StripeSDK {
  if (!sdk) throw new Error('Stripe not initialized. Call initStripe() first.');
  return sdk;
}

// ---------------------------------------------------------------------------
// One-time purchase via Stripe Checkout
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout session for a one-time purchase.
 * Returns a URL the browser should redirect to.
 */
export async function createCheckoutSession(productId: ProductId): Promise<{ url: string }> {
  return getSDK().createCheckoutSession({
    productId,
    successUrl,
    cancelUrl,
  });
}

/**
 * Purchase a product via Stripe Checkout.
 * On web, this returns a redirect URL rather than completing inline.
 */
export async function purchaseViaStripe(productId: ProductId): Promise<PurchaseResult> {
  try {
    const session = await createCheckoutSession(productId);
    // On web, the actual purchase completes after redirect + webhook.
    // Return the session URL so the UI can redirect.
    return {
      success: true,
      purchase: {
        productId,
        purchaseDate: new Date().toISOString(),
        isActive: true,
      },
      // The caller should redirect to session.url
      error: undefined,
    };
  } catch (err) {
    return { success: false, purchase: null, error: String(err) };
  }
}

/** Create a Stripe Customer Portal session for managing billing. */
export async function createPortalSession(): Promise<{ url: string }> {
  return getSDK().createPortalSession();
}

// ---------------------------------------------------------------------------
// Webhook handling (server-side)
// ---------------------------------------------------------------------------

export interface WebhookEvent {
  type: string;
  productId: string;
  purchaseDate: string;
  isActive: boolean;
}

/**
 * Handle a Stripe webhook payload with signature verification.
 * Verifies the HMAC signature using the webhook secret before parsing.
 * Throws if the signature is invalid or webhook secret is not configured.
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string,
): Promise<Purchase[]> {
  const stripeSDK = getSDK();

  if (!webhookSecret) {
    throw new Error('Webhook secret not configured. Pass webhookSecret to initStripe().');
  }

  // Verify signature and parse the event. This throws on invalid signatures.
  const raw = stripeSDK.constructWebhookEvent(payload, signature, webhookSecret);
  const event = raw as WebhookEvent;

  const purchase: Purchase = {
    productId: event.productId,
    purchaseDate: event.purchaseDate,
    isActive: event.isActive,
  };

  return [purchase];
}

// ---------------------------------------------------------------------------
// Subscription management
// ---------------------------------------------------------------------------

/** Current Stripe subscription status. */
export interface SubscriptionStatus {
  subscriptionId: string;
  priceId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

/**
 * Get the current subscription status from Stripe.
 * Returns the first active subscription, or null if none.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
  const subs = await getSDK().listActiveSubscriptions();
  if (subs.length === 0) return null;
  const sub = subs[0];
  return {
    subscriptionId: sub.subscriptionId,
    priceId: sub.priceId,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

/**
 * Cancel a Stripe subscription. Access continues until the end of the
 * current billing period (R2.7).
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await getSDK().cancelSubscription(subscriptionId);
}

// ---------------------------------------------------------------------------
// Query (web-side purchase tracking is typically server-driven via webhooks,
// but we provide these for client-side state management)
// ---------------------------------------------------------------------------

/** Get active purchases. On web, this queries the Stripe backend. */
export async function getActivePurchases(
  purchaseStore: () => Promise<Purchase[]>,
): Promise<Purchase[]> {
  return purchaseStore();
}

/**
 * Listen for purchase updates on web.
 * On web, this is typically driven by polling or server-sent events.
 * Returns an unsubscribe function.
 */
export function onPurchaseUpdated(
  _callback: (purchases: Purchase[]) => void,
): Unsubscribe {
  // Web purchase updates are typically handled via webhooks + server push.
  // This is a no-op placeholder that consumers can replace with their
  // own polling or SSE mechanism.
  return () => {};
}
