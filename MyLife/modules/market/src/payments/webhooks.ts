/**
 * Stripe webhook handler for marketplace payment events.
 *
 * Verifies webhook signatures and maps Stripe events to internal
 * status updates. The caller (API route) is responsible for persisting
 * the status changes to the database.
 */

import type { PaymentStatus, EscrowStatus, ConnectAccountStatus } from '../types';
import type { StripeClient, StripeWebhookEvent } from './stripe-connect';
// mapStripeStatusToPaymentStatus available via orchestrator for callers
// that need to map arbitrary Stripe statuses outside webhook flow

// ── Webhook Event Types ─────────────────────────────────────────────

export type WebhookAction =
  | { type: 'payment_status_update'; paymentIntentId: string; status: PaymentStatus; stripeEventId: string }
  | { type: 'escrow_status_update'; paymentIntentId: string; status: EscrowStatus; stripeEventId: string }
  | { type: 'dispute_opened'; paymentIntentId: string; stripeDisputeId: string; reason: string; stripeEventId: string }
  | { type: 'dispute_closed'; paymentIntentId: string; stripeDisputeId: string; outcome: string; stripeEventId: string }
  | { type: 'refund_completed'; paymentIntentId: string; refundId: string; amountCents: number; stripeEventId: string }
  | { type: 'account_updated'; stripeAccountId: string; status: ConnectAccountStatus; chargesEnabled: boolean; payoutsEnabled: boolean; stripeEventId: string }
  | { type: 'unhandled'; eventType: string; stripeEventId: string };

// ── Webhook Verification ────────────────────────────────────────────

/**
 * Verify and parse a Stripe webhook event.
 * Returns null if signature verification fails.
 */
export function verifyWebhookEvent(
  stripe: StripeClient,
  payload: string,
  signature: string,
  webhookSecret: string,
): StripeWebhookEvent | null {
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return null;
  }
}

// ── Event Processing ────────────────────────────────────────────────

/** Process a verified Stripe webhook event into an internal action. */
export function processWebhookEvent(event: StripeWebhookEvent): WebhookAction {
  const obj = event.data.object;

  switch (event.type) {
    case 'payment_intent.succeeded':
      return {
        type: 'payment_status_update',
        paymentIntentId: obj.id as string,
        status: 'succeeded',
        stripeEventId: event.id,
      };

    case 'payment_intent.payment_failed':
      return {
        type: 'payment_status_update',
        paymentIntentId: obj.id as string,
        status: 'failed',
        stripeEventId: event.id,
      };

    case 'charge.dispute.created':
      return {
        type: 'dispute_opened',
        paymentIntentId: obj.payment_intent as string,
        stripeDisputeId: obj.id as string,
        reason: (obj.reason as string) ?? 'unknown',
        stripeEventId: event.id,
      };

    case 'charge.dispute.closed':
      return {
        type: 'dispute_closed',
        paymentIntentId: obj.payment_intent as string,
        stripeDisputeId: obj.id as string,
        outcome: (obj.status as string) ?? 'unknown',
        stripeEventId: event.id,
      };

    case 'charge.refunded': {
      const refunds = obj.refunds as { data?: Array<{ id: string; amount: number }> } | undefined;
      const latestRefund = refunds?.data?.[0];
      return {
        type: 'refund_completed',
        paymentIntentId: obj.payment_intent as string,
        refundId: latestRefund?.id ?? '',
        amountCents: latestRefund?.amount ?? 0,
        stripeEventId: event.id,
      };
    }

    case 'account.updated':
      return {
        type: 'account_updated',
        stripeAccountId: obj.id as string,
        status: deriveAccountStatus(obj),
        chargesEnabled: (obj.charges_enabled as boolean) ?? false,
        payoutsEnabled: (obj.payouts_enabled as boolean) ?? false,
        stripeEventId: event.id,
      };

    default:
      return { type: 'unhandled', eventType: event.type, stripeEventId: event.id };
  }
}

/**
 * Full webhook handler: verify signature, parse event, return action.
 * Returns null if verification fails.
 */
export function handleWebhook(
  stripe: StripeClient,
  payload: string,
  signature: string,
  webhookSecret: string,
): WebhookAction | null {
  const event = verifyWebhookEvent(stripe, payload, signature, webhookSecret);
  if (!event) return null;
  return processWebhookEvent(event);
}

// ── Helpers ─────────────────────────────────────────────────────────

function deriveAccountStatus(accountObj: Record<string, unknown>): ConnectAccountStatus {
  const chargesEnabled = accountObj.charges_enabled as boolean;
  const payoutsEnabled = accountObj.payouts_enabled as boolean;
  const requirements = accountObj.requirements as { currently_due?: string[]; disabled_reason?: string } | undefined;

  if (requirements?.disabled_reason) return 'disabled';
  if (!chargesEnabled && !payoutsEnabled) {
    if (requirements?.currently_due?.length) return 'onboarding';
    return 'pending_verification';
  }
  if (chargesEnabled && payoutsEnabled) return 'active';
  return 'restricted';
}

/** List of webhook event types this handler processes. */
export const HANDLED_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.dispute.created',
  'charge.dispute.closed',
  'charge.refunded',
  'account.updated',
] as const;
