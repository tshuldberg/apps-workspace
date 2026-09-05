/**
 * Stripe Connect adapter for marketplace split payments.
 *
 * All functions accept a StripeClient interface for dependency injection,
 * making them testable without a real Stripe account. Configure with
 * environment variables:
 *   STRIPE_SECRET_KEY       - Platform secret key
 *   STRIPE_WEBHOOK_SECRET   - Webhook endpoint signing secret
 */

import type { FeePayer } from '../types';
import { calculateProcessingFee } from '../shipping/tracking';

// ── Stripe Client Interface (DI) ───────────────────────────────────

export interface StripeClient {
  accounts: {
    create(params: Record<string, unknown>): Promise<{ id: string; charges_enabled: boolean; payouts_enabled: boolean }>;
    retrieve(id: string): Promise<{ id: string; charges_enabled: boolean; payouts_enabled: boolean; requirements?: { currently_due?: string[] } }>;
    createLoginLink(id: string): Promise<{ url: string }>;
  };
  accountLinks: {
    create(params: Record<string, unknown>): Promise<{ url: string }>;
  };
  paymentIntents: {
    create(params: Record<string, unknown>): Promise<{ id: string; client_secret: string; status: string }>;
    retrieve(id: string): Promise<{ id: string; status: string; amount: number; latest_charge?: string }>;
    capture(id: string): Promise<{ id: string; status: string }>;
    cancel(id: string): Promise<{ id: string; status: string }>;
  };
  refunds: {
    create(params: Record<string, unknown>): Promise<{ id: string; status: string; amount: number }>;
  };
  transfers: {
    create(params: Record<string, unknown>): Promise<{ id: string; amount: number }>;
  };
  webhooks: {
    constructEvent(payload: string, signature: string, secret: string): StripeWebhookEvent;
  };
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
}

// ── Config ──────────────────────────────────────────────────────────

export interface StripeConnectConfig {
  platformFeePercent: number;
  currency: string;
  statementDescriptor: string;
  captureMethod: 'automatic' | 'manual';
}

export const DEFAULT_CONFIG: StripeConnectConfig = {
  platformFeePercent: 0,
  currency: 'usd',
  statementDescriptor: 'MyMarket',
  captureMethod: 'manual',
};

// ── Connected Account Operations ────────────────────────────────────

export interface OnboardingResult {
  stripeAccountId: string;
  onboardingUrl: string;
}

/**
 * Create a new Stripe Connect Express account and generate an onboarding link.
 * The seller completes onboarding via the returned URL.
 */
export async function createConnectedAccount(
  stripe: StripeClient,
  params: {
    userId: string;
    email: string;
    country?: string;
    returnUrl: string;
    refreshUrl: string;
  },
): Promise<OnboardingResult> {
  const account = await stripe.accounts.create({
    type: 'express',
    country: params.country ?? 'US',
    email: params.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { mylife_user_id: params.userId },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    type: 'account_onboarding',
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });

  return {
    stripeAccountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

export interface AccountStatus {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresAction: boolean;
  pendingRequirements: string[];
}

/** Retrieve the current status of a connected account. */
export async function getAccountStatus(
  stripe: StripeClient,
  stripeAccountId: string,
): Promise<AccountStatus> {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const pending = account.requirements?.currently_due ?? [];
  return {
    stripeAccountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requiresAction: pending.length > 0,
    pendingRequirements: pending,
  };
}

/** Generate a Stripe Express dashboard login link for the seller. */
export async function createDashboardLink(
  stripe: StripeClient,
  stripeAccountId: string,
): Promise<string> {
  const link = await stripe.accounts.createLoginLink(stripeAccountId);
  return link.url;
}

// ── Payment Intent Operations ───────────────────────────────────────

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
  platformFeeCents: number;
  processingFeeCents: number;
}

/**
 * Calculate the fee split for a marketplace payment.
 *
 * - Processing fee (Stripe rate): 2.9% + $0.30
 * - Platform fee: configurable percentage of sale amount
 * - Fee payer determines who absorbs the processing fee
 */
export function calculateFeeSplit(
  amountCents: number,
  feePayer: FeePayer,
  platformFeePercent: number,
): { platformFeeCents: number; processingFeeCents: number; applicationFeeCents: number; sellerReceivesCents: number } {
  const processingFeeCents = calculateProcessingFee(amountCents);
  const platformFeeCents = Math.ceil(amountCents * (platformFeePercent / 100));

  // Application fee = platform fee + processing fee (if seller pays)
  const applicationFeeCents = feePayer === 'seller'
    ? platformFeeCents + processingFeeCents
    : platformFeeCents;

  const sellerReceivesCents = amountCents - applicationFeeCents;

  return { platformFeeCents, processingFeeCents, applicationFeeCents, sellerReceivesCents };
}

/**
 * Create a PaymentIntent with Stripe Connect split payment.
 *
 * Uses destination charges: payment goes to platform, automatic transfer
 * to connected account minus the application fee.
 */
export async function createPaymentIntent(
  stripe: StripeClient,
  params: {
    amountCents: number;
    currency?: string;
    sellerStripeAccountId: string;
    feePayer: FeePayer;
    listingId: string;
    buyerId: string;
    sellerId: string;
    offerId?: string;
    metadata?: Record<string, string>;
  },
  config: StripeConnectConfig = DEFAULT_CONFIG,
): Promise<PaymentIntentResult> {
  const { applicationFeeCents, platformFeeCents, processingFeeCents } = calculateFeeSplit(
    params.amountCents,
    params.feePayer,
    config.platformFeePercent,
  );

  const intent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency ?? config.currency,
    capture_method: config.captureMethod,
    statement_descriptor: config.statementDescriptor,
    application_fee_amount: applicationFeeCents,
    transfer_data: {
      destination: params.sellerStripeAccountId,
    },
    metadata: {
      mylife_listing_id: params.listingId,
      mylife_buyer_id: params.buyerId,
      mylife_seller_id: params.sellerId,
      ...(params.offerId ? { mylife_offer_id: params.offerId } : {}),
      ...(params.metadata ?? {}),
    },
  });

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
    platformFeeCents,
    processingFeeCents,
  };
}

/** Capture a previously authorized (manual capture) payment intent. */
export async function capturePaymentIntent(
  stripe: StripeClient,
  paymentIntentId: string,
): Promise<{ paymentIntentId: string; status: string }> {
  const result = await stripe.paymentIntents.capture(paymentIntentId);
  return { paymentIntentId: result.id, status: result.status };
}

/** Cancel an uncaptured payment intent (releases the hold). */
export async function cancelPaymentIntent(
  stripe: StripeClient,
  paymentIntentId: string,
): Promise<{ paymentIntentId: string; status: string }> {
  const result = await stripe.paymentIntents.cancel(paymentIntentId);
  return { paymentIntentId: result.id, status: result.status };
}

// ── Refund Operations ───────────────────────────────────────────────

export interface RefundResult {
  refundId: string;
  status: string;
  amountCents: number;
}

/** Create a refund (full or partial) for a payment intent. */
export async function createRefund(
  stripe: StripeClient,
  params: {
    paymentIntentId: string;
    amountCents?: number;
    reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
    reverseTransfer?: boolean;
    refundApplicationFee?: boolean;
  },
): Promise<RefundResult> {
  const refund = await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    ...(params.amountCents ? { amount: params.amountCents } : {}),
    ...(params.reason ? { reason: params.reason } : {}),
    reverse_transfer: params.reverseTransfer ?? true,
    refund_application_fee: params.refundApplicationFee ?? true,
  });

  return {
    refundId: refund.id,
    status: refund.status,
    amountCents: refund.amount,
  };
}

/** Retrieve the current status of a payment intent. */
export async function getPaymentIntentStatus(
  stripe: StripeClient,
  paymentIntentId: string,
): Promise<{ paymentIntentId: string; status: string; amountCents: number }> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return {
    paymentIntentId: intent.id,
    status: intent.status,
    amountCents: intent.amount,
  };
}
