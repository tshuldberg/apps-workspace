/**
 * Concrete Stripe billing client for the deployable hosted service (Plan 22 Phase 2,
 * TC-3). It drives the Stripe REST API directly over `fetch` (the same
 * dependency-free idiom as TurnstileVerifier) so the images pull in no Stripe SDK.
 *
 * It creates a subscription Checkout (hosted $4.99/mo), a one-time Checkout (app
 * unlock $4.99), a billing portal session, and verifies + maps Stripe webhooks into
 * the API's `MeerkatBillingWebhookEvent` union. Webhook signature verification is
 * the real Stripe scheme (HMAC-SHA256 over `${t}.${payload}`, constant-time compare,
 * timestamp tolerance): an unsigned or mis-signed body is rejected fail-closed.
 *
 * The subject id is carried end-to-end in Checkout `client_reference_id` + the
 * subscription `metadata.subjectId`, so a webhook always resolves back to the same
 * device subject with no account join.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  MeerkatAppBillingClient,
  MeerkatAppCheckoutInput,
  MeerkatBillingWebhookEvent,
  MeerkatHostedBillingClient,
  MeerkatHostedCheckoutInput,
  MeerkatHostedPortalInput,
  MeerkatHostedSubscriptionStatus,
  ParseHostedWebhookInput,
} from './hosted-api';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
/** Reject a signature whose timestamp is older/newer than this (replay guard). */
const DEFAULT_SIGNATURE_TOLERANCE_S = 5 * 60;

export interface StripeMeerkatBillingClientOptions {
  /** Stripe secret key (env only, never shipped to a client). */
  secretKey: string;
  /** Stripe Price id for the $4.99/mo hosted subscription SKU. */
  monthlyPriceId: string;
  /** Stripe Price id for the $4.99 one-time app unlock. */
  appUnlockPriceId: string;
  /**
   * Resolve a subject's existing Stripe customer id (for the billing portal).
   * Wired to the billing store's subscription row; returns null if unknown.
   */
  getCustomerId?: (subjectId: string) => Promise<string | null> | string | null;
  signatureToleranceS?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function statusFromStripe(status: string): MeerkatHostedSubscriptionStatus {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'unpaid':
    case 'paused':
      return status;
    case 'incomplete_expired':
      return 'incomplete';
    default:
      return 'canceled';
  }
}

export class StripeMeerkatBillingClient implements MeerkatHostedBillingClient, MeerkatAppBillingClient {
  private readonly options: StripeMeerkatBillingClientOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(options: StripeMeerkatBillingClientOptions) {
    if (!options.secretKey) throw new Error('STRIPE_SECRET_KEY is required.');
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
  }

  private async stripePost(path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
    const body = new URLSearchParams(form).toString();
    const response = await this.fetchImpl(`${STRIPE_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        (json.error as { message?: string } | undefined)?.message ?? `Stripe ${response.status}`;
      throw new Error(`Stripe request failed: ${message}`);
    }
    return json;
  }

  private async stripeGet(path: string): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${STRIPE_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.options.secretKey}` },
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(`Stripe lookup failed with ${response.status}.`);
    return json;
  }

  private async resolveAppPurchaseBinding(object: Record<string, unknown>): Promise<{
    subjectId: string;
    productId: string;
  } | null> {
    let candidate = object;
    const embeddedCharge = object.charge;
    if (embeddedCharge && typeof embeddedCharge === 'object' && !Array.isArray(embeddedCharge)) {
      candidate = embeddedCharge as Record<string, unknown>;
    } else if (typeof embeddedCharge === 'string') {
      candidate = await this.stripeGet(`/charges/${encodeURIComponent(embeddedCharge)}`);
    }
    let subjectId = metadataField(candidate, 'subjectId');
    let productId = metadataField(candidate, 'productId');
    const paymentIntent = candidate.payment_intent;
    if ((!subjectId || !productId) && typeof paymentIntent === 'string') {
      const intent = await this.stripeGet(`/payment_intents/${encodeURIComponent(paymentIntent)}`);
      subjectId = metadataField(intent, 'subjectId');
      productId = metadataField(intent, 'productId');
    } else if ((!subjectId || !productId) && paymentIntent && typeof paymentIntent === 'object'
      && !Array.isArray(paymentIntent)) {
      subjectId = metadataField(paymentIntent as Record<string, unknown>, 'subjectId');
      productId = metadataField(paymentIntent as Record<string, unknown>, 'productId');
    }
    return subjectId && productId ? { subjectId, productId } : null;
  }

  async createCheckoutSession(input: MeerkatHostedCheckoutInput): Promise<{ url: string }> {
    const json = await this.stripePost('/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': this.options.monthlyPriceId,
      'line_items[0][quantity]': '1',
      client_reference_id: input.subject.subjectId,
      'subscription_data[metadata][subjectId]': input.subject.subjectId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.subject.email ? { customer_email: input.subject.email } : {}),
    });
    return { url: String(json.url ?? '') };
  }

  async createAppCheckoutSession(input: MeerkatAppCheckoutInput): Promise<{ url: string }> {
    const json = await this.stripePost('/checkout/sessions', {
      mode: 'payment',
      'line_items[0][price]': this.options.appUnlockPriceId,
      'line_items[0][quantity]': '1',
      client_reference_id: input.subject.subjectId,
      'payment_intent_data[metadata][subjectId]': input.subject.subjectId,
      'payment_intent_data[metadata][productId]': MEERKAT_APP_UNLOCK_PRODUCT.id,
      // Also stamp the session metadata so the checkout.session.completed webhook resolves it.
      'metadata[subjectId]': input.subject.subjectId,
      'metadata[productId]': MEERKAT_APP_UNLOCK_PRODUCT.id,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.subject.email ? { customer_email: input.subject.email } : {}),
    });
    return { url: String(json.url ?? '') };
  }

  async createPortalSession(input: MeerkatHostedPortalInput): Promise<{ url: string }> {
    const customerId = await this.options.getCustomerId?.(input.subject.subjectId);
    if (!customerId) {
      throw new Error('No Stripe customer for this subject; a purchase must exist before managing billing.');
    }
    const json = await this.stripePost('/billing_portal/sessions', {
      customer: customerId,
      return_url: input.returnUrl,
    });
    return { url: String(json.url ?? '') };
  }

  /** Verify the Stripe signature over the raw payload, fail-closed. */
  private verifySignature(payload: string, signatureHeader: string | null, secret: string): void {
    if (!signatureHeader) throw new Error('Missing Stripe signature.');
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k?.trim(), v?.trim()];
      }),
    ) as Record<string, string>;
    const timestamp = Number(parts.t);
    const provided = parts.v1;
    if (!Number.isFinite(timestamp) || !provided) throw new Error('Malformed Stripe signature.');
    const tolerance = this.options.signatureToleranceS ?? DEFAULT_SIGNATURE_TOLERANCE_S;
    if (Math.abs(Math.floor(this.now() / 1000) - timestamp) > tolerance) {
      throw new Error('Stripe signature timestamp outside tolerance.');
    }
    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Stripe signature mismatch.');
    }
  }

  async parseWebhook(input: ParseHostedWebhookInput): Promise<MeerkatBillingWebhookEvent> {
    this.verifySignature(input.payload, input.signature, input.webhookSecret);
    const event = JSON.parse(input.payload) as {
      id: string;
      type: string;
      created: number;
      data: { object: Record<string, unknown> };
    };
    const object = event.data.object;
    const eventId = event.id;
    if (!eventId || !Number.isFinite(event.created) || event.created <= 0) {
      throw new Error('Stripe event is missing a valid id or created timestamp.');
    }
    const occurredAt = new Date(event.created * 1000).toISOString();

    // One-time app-unlock: a completed payment-mode Checkout, or a refunded charge.
    if (event.type === 'checkout.session.completed' && object.mode === 'payment') {
      // The client is the product-identity boundary: only a checkout we stamped with
      // the Meerkat unlock productId counts. This prevents a DIFFERENT one-time product
      // sold on the same Stripe account from being misclassified as an app unlock.
      if (metadataField(object, 'productId') !== MEERKAT_APP_UNLOCK_PRODUCT.id) {
        return { kind: 'ignored', eventId };
      }
      const subjectId = String(object.client_reference_id ?? metadataField(object, 'subjectId') ?? '');
      if (!subjectId) return { kind: 'ignored', eventId };
      // Only a fully-PAID session unlocks. A $0/`no_payment_required` session is not a
      // real one-time purchase and must not grant the unlock.
      if (object.payment_status !== 'paid') return { kind: 'ignored', eventId };
      return {
        kind: 'app_purchase',
        event: {
          eventId,
          occurredAt,
          subjectId,
          productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
          rail: 'stripe',
          purchaseDate: occurredAt,
          isActive: true,
        },
      };
    }
    const disputeEvent = event.type.startsWith('charge.dispute.');
    if (event.type === 'charge.refunded' || disputeEvent) {
      const binding = await this.resolveAppPurchaseBinding(object);
      if (!binding || binding.productId !== MEERKAT_APP_UNLOCK_PRODUCT.id) {
        return { kind: 'ignored', eventId };
      }
      const disputeWon = disputeEvent
        && (event.type === 'charge.dispute.funds_reinstated'
          || (event.type === 'charge.dispute.closed' && object.status === 'won'));
      return {
        kind: 'app_purchase',
        event: {
          eventId,
          occurredAt,
          subjectId: binding.subjectId,
          productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
          rail: 'stripe',
          purchaseDate: occurredAt,
          isActive: disputeWon,
        },
      };
    }

    // Hosted subscription lifecycle.
    if (event.type.startsWith('customer.subscription.')) {
      const subjectId = String(metadataField(object, 'subjectId') ?? '');
      if (!subjectId) return { kind: 'ignored', eventId };
      const currentPeriodEnd = typeof object.current_period_end === 'number'
        ? new Date(object.current_period_end * 1000).toISOString()
        : undefined;
      return {
        kind: 'subscription',
        eventId,
        occurredAt,
        subjectId,
        status: event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : statusFromStripe(String(object.status ?? 'active')),
        customerId: object.customer ? String(object.customer) : undefined,
        subscriptionId: object.id ? String(object.id) : undefined,
        currentPeriodEnd,
      };
    }

    return { kind: 'ignored', eventId };
  }
}

function metadataField(object: Record<string, unknown>, key: string): string | undefined {
  const metadata = object.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}
