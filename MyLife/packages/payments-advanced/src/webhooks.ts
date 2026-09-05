import Stripe from 'stripe';
import type { WebhookEvent, WebhookEventType, WebhookProcessResult } from './types';

export function constructWebhookEvent(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export interface IdempotencyStore {
  hasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, eventType: string, payload: Record<string, unknown>): Promise<void>;
  markFailed(eventId: string, error: string): Promise<void>;
}

export type WebhookHandler = (event: WebhookEvent) => Promise<void>;

export async function processWebhook(
  event: WebhookEvent,
  store: IdempotencyStore,
  handlers: Partial<Record<WebhookEventType, WebhookHandler>>,
): Promise<WebhookProcessResult> {
  // Idempotency check
  const alreadyProcessed = await store.hasProcessed(event.id);
  if (alreadyProcessed) {
    return { processed: false, skipped: true };
  }

  const handler = handlers[event.type];
  if (!handler) {
    return { processed: false, skipped: true };
  }

  try {
    await handler(event);
    await store.markProcessed(event.id, event.type, event.data);
    return { processed: true, skipped: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await store.markFailed(event.id, errorMsg);
    return { processed: false, skipped: false, error: errorMsg };
  }
}

export const SUPPORTED_EVENTS: WebhookEventType[] = [
  'account.updated',
  'account.application.deauthorized',
  'payment_intent.succeeded',
  'payment_intent.amount_capturable_updated',
  'payment_intent.canceled',
  'charge.captured',
  'charge.refunded',
  'charge.dispute.created',
  'transfer.created',
  'payout.paid',
];
