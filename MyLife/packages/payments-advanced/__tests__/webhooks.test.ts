import { describe, it, expect, vi } from 'vitest';
import { processWebhook } from '../src/webhooks';
import type { IdempotencyStore, WebhookHandler } from '../src/webhooks';
import type { WebhookEvent, WebhookEventType } from '../src/types';

function createMockStore(processedIds: Set<string> = new Set()): IdempotencyStore {
  return {
    hasProcessed: vi.fn(async (id: string) => processedIds.has(id)),
    markProcessed: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
  };
}

function createEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: 'evt_test_123',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_123' } },
    created: Date.now(),
    livemode: false,
    ...overrides,
  };
}

describe('processWebhook', () => {
  it('processes event when handler exists', async () => {
    const store = createMockStore();
    const handler: WebhookHandler = vi.fn(async () => {});
    const handlers: Partial<Record<WebhookEventType, WebhookHandler>> = {
      'payment_intent.succeeded': handler,
    };

    const event = createEvent();
    const result = await processWebhook(event, store, handlers);

    expect(result).toEqual({ processed: true, skipped: false });
    expect(handler).toHaveBeenCalledWith(event);
    expect(store.markProcessed).toHaveBeenCalledWith('evt_test_123', 'payment_intent.succeeded', event.data);
  });

  it('skips when already processed (idempotency)', async () => {
    const store = createMockStore(new Set(['evt_test_123']));
    const handler: WebhookHandler = vi.fn(async () => {});
    const handlers: Partial<Record<WebhookEventType, WebhookHandler>> = {
      'payment_intent.succeeded': handler,
    };

    const event = createEvent();
    const result = await processWebhook(event, store, handlers);

    expect(result).toEqual({ processed: false, skipped: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips when no handler for event type', async () => {
    const store = createMockStore();
    const handlers: Partial<Record<WebhookEventType, WebhookHandler>> = {};

    const event = createEvent({ type: 'payout.paid' });
    const result = await processWebhook(event, store, handlers);

    expect(result).toEqual({ processed: false, skipped: true });
  });

  it('marks failed when handler throws', async () => {
    const store = createMockStore();
    const handler: WebhookHandler = vi.fn(async () => {
      throw new Error('Database connection lost');
    });
    const handlers: Partial<Record<WebhookEventType, WebhookHandler>> = {
      'payment_intent.succeeded': handler,
    };

    const event = createEvent();
    const result = await processWebhook(event, store, handlers);

    expect(result).toEqual({ processed: false, skipped: false, error: 'Database connection lost' });
    expect(store.markFailed).toHaveBeenCalledWith('evt_test_123', 'Database connection lost');
  });
});
