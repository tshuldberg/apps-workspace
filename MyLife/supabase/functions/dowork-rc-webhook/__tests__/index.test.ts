import { describe, expect, it } from 'vitest';
import {
  extractTrainerId,
  handleDoWorkRcWebhookRequest,
  mapStore,
  type PurchaseEventInput,
  type RcWebhookStore,
  type SubscriptionUpsertInput,
} from '../index.ts';

const SECRET = 'rc-secret-token';
const NOW = Date.parse('2026-07-03T12:00:00.000Z');

function makeRequest(
  body: unknown,
  opts: { auth?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? SECRET : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/dowork-rc-webhook', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: {
      id: 'evt-1',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'user-1',
      product_id: 'dowork_trainer_tier_1',
      store: 'APP_STORE',
      price: 4.99,
      expiration_at_ms: NOW + 30 * 86_400_000,
      subscriber_attributes: { trainer_id: { value: 'trainer-1' } },
      ...overrides,
    },
  };
}

class FakeRcStore implements RcWebhookStore {
  seenEventIds = new Set<string>();
  events: PurchaseEventInput[] = [];
  knownTrainers = new Set<string>(['trainer-1']);
  upserts: SubscriptionUpsertInput[] = [];
  activeCount = 3;
  subscriberCountUpdates: Array<{ trainerId: string; count: number }> = [];

  async insertPurchaseEvent(input: PurchaseEventInput): Promise<{ inserted: boolean }> {
    this.events.push(input);
    if (this.seenEventIds.has(input.rcEventId)) return { inserted: false };
    this.seenEventIds.add(input.rcEventId);
    return { inserted: true };
  }

  async trainerExists(trainerId: string): Promise<boolean> {
    return this.knownTrainers.has(trainerId);
  }

  async upsertSubscription(input: SubscriptionUpsertInput): Promise<void> {
    this.upserts.push(input);
  }

  async countActiveSubscribers(): Promise<number> {
    return this.activeCount;
  }

  async updateSubscriberCount(trainerId: string, count: number): Promise<void> {
    this.subscriberCountUpdates.push({ trainerId, count });
  }
}

function deps(store: FakeRcStore) {
  return { store, webhookSecret: SECRET, now: () => NOW };
}

describe('mapStore', () => {
  it('maps RC store codes to the allowed enum', () => {
    expect(mapStore('APP_STORE')).toBe('app_store');
    expect(mapStore('MAC_APP_STORE')).toBe('app_store');
    expect(mapStore('PLAY_STORE')).toBe('play_store');
    expect(mapStore('AMAZON')).toBe('play_store');
    expect(mapStore(undefined)).toBe('app_store');
  });
});

describe('extractTrainerId', () => {
  it('reads the RC subscriber attribute value object', () => {
    expect(extractTrainerId({ subscriber_attributes: { trainer_id: { value: 'trainer-9' } } })).toBe(
      'trainer-9',
    );
  });

  it('accepts a plain string attribute and returns null when absent', () => {
    expect(extractTrainerId({ subscriber_attributes: { trainer_id: 'trainer-7' } })).toBe('trainer-7');
    expect(extractTrainerId({ subscriber_attributes: {} })).toBeNull();
  });
});

describe('dowork-rc-webhook auth', () => {
  it('rejects a wrong secret', async () => {
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event(), { auth: 'nope' }),
      deps(new FakeRcStore()),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a missing Authorization header', async () => {
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event(), { auth: null }),
      deps(new FakeRcStore()),
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-POST', async () => {
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event(), { method: 'GET' }),
      deps(new FakeRcStore()),
    );
    expect(res.status).toBe(405);
  });

  it('rejects a body without event.id', async () => {
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest({ event: { type: 'RENEWAL' } }),
      deps(new FakeRcStore()),
    );
    expect(res.status).toBe(400);
  });
});

describe('dowork-rc-webhook event mapping', () => {
  it('activates a subscription on INITIAL_PURCHASE and recomputes subscriber_count', async () => {
    const store = new FakeRcStore();
    const res = await handleDoWorkRcWebhookRequest(makeRequest(event()), deps(store));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('active');
    expect(body.subscriberCount).toBe(3);
    expect(store.upserts[0]?.status).toBe('active');
    expect(store.upserts[0]?.store).toBe('app_store');
    expect(store.upserts[0]?.currentPeriodEnd).toBe(
      new Date(NOW + 30 * 86_400_000).toISOString(),
    );
    expect(store.subscriberCountUpdates[0]).toEqual({ trainerId: 'trainer-1', count: 3 });
  });

  it.each([
    ['RENEWAL', 'active'],
    ['UNCANCELLATION', 'active'],
    ['CANCELLATION', 'active'],
    ['EXPIRATION', 'expired'],
    ['BILLING_ISSUE', 'billing_issue'],
  ])('maps %s to status %s', async (type, expected) => {
    const store = new FakeRcStore();
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event({ id: `evt-${type}`, type })),
      deps(store),
    );
    const body = await res.json();
    expect(body.status).toBe(expected);
    expect(store.upserts[0]?.status).toBe(expected);
  });

  it('CANCELLATION keeps the subscription active and still refreshes current_period_end, until a later EXPIRATION revokes it', async () => {
    const store = new FakeRcStore();
    const periodEnd = NOW + 15 * 86_400_000;

    const cancelRes = await handleDoWorkRcWebhookRequest(
      makeRequest(
        event({ id: 'evt-cancel', type: 'CANCELLATION', expiration_at_ms: periodEnd }),
      ),
      deps(store),
    );
    const cancelBody = await cancelRes.json();
    expect(cancelBody.status).toBe('active');
    expect(store.upserts[0]?.status).toBe('active');
    expect(store.upserts[0]?.currentPeriodEnd).toBe(new Date(periodEnd).toISOString());
    // Purchase event is still recorded for the audit trail.
    expect(store.events.some((e) => e.rcEventId === 'evt-cancel')).toBe(true);

    const expireRes = await handleDoWorkRcWebhookRequest(
      makeRequest(event({ id: 'evt-expire', type: 'EXPIRATION' })),
      deps(store),
    );
    const expireBody = await expireRes.json();
    expect(expireBody.status).toBe('expired');
    expect(store.upserts[1]?.status).toBe('expired');
  });

  it('ignores unmapped event types but still records them', async () => {
    const store = new FakeRcStore();
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event({ id: 'evt-transfer', type: 'TRANSFER' })),
      deps(store),
    );
    const body = await res.json();
    expect(body.ignored).toBe(true);
    expect(store.upserts).toHaveLength(0);
    expect(store.events).toHaveLength(1);
  });

  it('returns unmatched (no subscription write) when the trainer attribute is absent', async () => {
    const store = new FakeRcStore();
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event({ id: 'evt-unmatched', subscriber_attributes: {} })),
      deps(store),
    );
    const body = await res.json();
    expect(body.unmatched).toBe(true);
    expect(store.upserts).toHaveLength(0);
    // Event is still stored, with a null trainer.
    expect(store.events[0]?.trainerId).toBeNull();
  });

  it('returns unmatched when the trainer attribute names an unknown trainer', async () => {
    const store = new FakeRcStore();
    const res = await handleDoWorkRcWebhookRequest(
      makeRequest(event({ id: 'evt-badtrainer', subscriber_attributes: { trainer_id: { value: 'ghost' } } })),
      deps(store),
    );
    const body = await res.json();
    expect(body.unmatched).toBe(true);
    expect(store.upserts).toHaveLength(0);
  });

  it('is idempotent: a replayed event does not reapply state', async () => {
    const store = new FakeRcStore();
    const first = await handleDoWorkRcWebhookRequest(makeRequest(event()), deps(store));
    expect((await first.json()).status).toBe('active');

    const replay = await handleDoWorkRcWebhookRequest(makeRequest(event()), deps(store));
    const body = await replay.json();
    expect(body.duplicate).toBe(true);
    // Only the first delivery wrote a subscription.
    expect(store.upserts).toHaveLength(1);
  });
});
