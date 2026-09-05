/**
 * Payment orchestrator: high-level flows that coordinate between
 * the Stripe adapter, dispute engine, and shipping engine.
 *
 * Each flow operates on our internal Payment/Escrow models and
 * delegates to stripe-connect.ts for Stripe API calls.
 */

import type { DisputeResolutionType, EscrowStatus, PaymentStatus } from '../types';
import { calculateRefundAmount, AUTO_RELEASE_DAYS } from '../disputes/engine';
import type { StripeClient, StripeConnectConfig } from './stripe-connect';
import {
  createPaymentIntent,
  capturePaymentIntent,
  createRefund,
  calculateFeeSplit,
  DEFAULT_CONFIG,
} from './stripe-connect';

// ── Result Type ─────────────────────────────────────────────────────

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Payment Lifecycle ───────────────────────────────────────────────

export interface InitiatePaymentParams {
  listingId: string;
  buyerId: string;
  sellerId: string;
  sellerStripeAccountId: string;
  amountCents: number;
  currency?: string;
  feePayer: 'buyer' | 'seller';
  offerId?: string;
}

export interface InitiatePaymentResult {
  paymentIntentId: string;
  clientSecret: string;
  platformFeeCents: number;
  processingFeeCents: number;
  escrowHoldUntil: string;
}

/**
 * Initiate a marketplace payment. Creates a Stripe PaymentIntent with
 * manual capture and returns the client secret for frontend confirmation.
 * The escrow hold period begins when the payment is captured (after delivery).
 */
export async function initiatePayment(
  stripe: StripeClient,
  params: InitiatePaymentParams,
  config: StripeConnectConfig = DEFAULT_CONFIG,
): Promise<Result<InitiatePaymentResult>> {
  try {
    const result = await createPaymentIntent(stripe, {
      amountCents: params.amountCents,
      currency: params.currency,
      sellerStripeAccountId: params.sellerStripeAccountId,
      feePayer: params.feePayer,
      listingId: params.listingId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      offerId: params.offerId,
    }, config);

    const holdUntil = new Date();
    holdUntil.setDate(holdUntil.getDate() + AUTO_RELEASE_DAYS);

    return {
      ok: true,
      data: {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        platformFeeCents: result.platformFeeCents,
        processingFeeCents: result.processingFeeCents,
        escrowHoldUntil: holdUntil.toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Capture a held payment after buyer confirms receipt or the
 * auto-release window passes. This moves funds into escrow.
 */
export async function captureAndHold(
  stripe: StripeClient,
  paymentIntentId: string,
): Promise<Result<{ paymentIntentId: string; status: string }>> {
  try {
    const result = await capturePaymentIntent(stripe, paymentIntentId);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Escrow Operations ───────────────────────────────────────────────

export interface EscrowState {
  status: EscrowStatus;
  holdUntil: string;
  canRelease: boolean;
  canRefund: boolean;
}

/**
 * Evaluate escrow state based on delivery confirmation and time.
 * Funds release automatically AUTO_RELEASE_DAYS after delivery.
 */
export function evaluateEscrowState(
  escrowStatus: EscrowStatus,
  holdUntil: string,
  deliveredAt: string | null,
  hasActiveDispute: boolean,
): EscrowState {
  const now = new Date();
  const holdDate = new Date(holdUntil);

  if (hasActiveDispute) {
    return {
      status: 'disputed',
      holdUntil,
      canRelease: false,
      canRefund: false,
    };
  }

  if (escrowStatus === 'released' || escrowStatus === 'refunded') {
    return {
      status: escrowStatus,
      holdUntil,
      canRelease: false,
      canRefund: false,
    };
  }

  const pastHoldDate = now > holdDate;
  const delivered = deliveredAt !== null;

  return {
    status: escrowStatus,
    holdUntil,
    canRelease: delivered && pastHoldDate && !hasActiveDispute,
    canRefund: escrowStatus === 'holding',
  };
}

/**
 * Calculate the auto-release date from delivery confirmation.
 * Funds release AUTO_RELEASE_DAYS after the item is delivered.
 */
export function calculateAutoReleaseDate(deliveredAt: string): string {
  const date = new Date(deliveredAt);
  date.setDate(date.getDate() + AUTO_RELEASE_DAYS);
  return date.toISOString();
}

// ── Refund Operations ───────────────────────────────────────────────

export interface ProcessRefundParams {
  paymentIntentId: string;
  amountCents?: number;
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
}

/**
 * Process a refund for a payment. Reverses the transfer to the
 * connected account and refunds the application fee.
 */
export async function processRefund(
  stripe: StripeClient,
  params: ProcessRefundParams,
): Promise<Result<{ refundId: string; amountCents: number }>> {
  try {
    const result = await createRefund(stripe, {
      paymentIntentId: params.paymentIntentId,
      amountCents: params.amountCents,
      reason: params.reason,
      reverseTransfer: true,
      refundApplicationFee: true,
    });
    return { ok: true, data: { refundId: result.refundId, amountCents: result.amountCents } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Dispute-Triggered Refund ────────────────────────────────────────

export interface DisputeRefundParams {
  paymentIntentId: string;
  paymentAmountCents: number;
  resolutionType: DisputeResolutionType;
  proposedPartialCents?: number;
}

/**
 * Process a refund triggered by dispute resolution. Uses the dispute
 * engine's calculateRefundAmount to determine the refund amount, then
 * issues the refund via Stripe.
 */
export async function handleDisputeRefund(
  stripe: StripeClient,
  params: DisputeRefundParams,
): Promise<Result<{ refundId: string; refundAmountCents: number; isFullRefund: boolean }>> {
  const refundAmountCents = calculateRefundAmount(
    params.resolutionType,
    params.paymentAmountCents,
    params.proposedPartialCents,
  );

  if (refundAmountCents <= 0) {
    return { ok: true, data: { refundId: '', refundAmountCents: 0, isFullRefund: false } };
  }

  try {
    const result = await createRefund(stripe, {
      paymentIntentId: params.paymentIntentId,
      amountCents: refundAmountCents,
      reverseTransfer: true,
      refundApplicationFee: true,
    });

    return {
      ok: true,
      data: {
        refundId: result.refundId,
        refundAmountCents: result.amountCents,
        isFullRefund: refundAmountCents === params.paymentAmountCents,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Fee Estimation ──────────────────────────────────────────────────

export interface FeeEstimate {
  amountCents: number;
  processingFeeCents: number;
  platformFeeCents: number;
  applicationFeeCents: number;
  sellerReceivesCents: number;
  buyerPaysCents: number;
}

/**
 * Estimate fees for a transaction before payment is created.
 * Useful for displaying fee breakdown to buyer/seller.
 */
export function estimateFees(
  amountCents: number,
  feePayer: 'buyer' | 'seller',
  config: StripeConnectConfig = DEFAULT_CONFIG,
): FeeEstimate {
  const split = calculateFeeSplit(amountCents, feePayer, config.platformFeePercent);

  return {
    amountCents,
    processingFeeCents: split.processingFeeCents,
    platformFeeCents: split.platformFeeCents,
    applicationFeeCents: split.applicationFeeCents,
    sellerReceivesCents: split.sellerReceivesCents,
    buyerPaysCents: feePayer === 'buyer'
      ? amountCents + split.processingFeeCents
      : amountCents,
  };
}

// ── Payment Status Mapping ──────────────────────────────────────────

/** Map a Stripe PaymentIntent status to our internal PaymentStatus. */
export function mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'requires_capture':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'failed';
    default:
      return 'pending';
  }
}
