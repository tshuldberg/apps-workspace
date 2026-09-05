/**
 * DoWork RevenueCat webhook Edge Function.
 *
 * RevenueCat POSTs subscription lifecycle events here. Authentication is the
 * shared secret configured in the RevenueCat dashboard, sent verbatim as the
 * Authorization header and compared against RC_WEBHOOK_SECRET.
 *
 * Idempotency: every event is written to dw_purchase_events keyed on the RC
 * event id (insert-or-ignore). A replayed event returns 200 { duplicate: true }
 * without reapplying any state.
 *
 * Trainer resolution is intentionally explicit, never guessed: the app sets a
 * RevenueCat subscriber attribute `trainer_id` at purchase time, and this
 * function reads it from event.subscriber_attributes.trainer_id. If it is
 * absent or names an unknown trainer, the event is stored but no subscription
 * row is written ({ unmatched: true }).
 *
 * Event -> status map: INITIAL_PURCHASE / RENEWAL / UNCANCELLATION -> active,
 * EXPIRATION -> expired, BILLING_ISSUE -> billing_issue. CANCELLATION does NOT
 * change status: RevenueCat sends it when auto-renew is turned off, but the
 * paid period is still running, so the subscription stays 'active' (the
 * entitlement policy checks status='active') and access lapses naturally when
 * current_period_end passes. Refund-style cancellations carry
 * expiration_at_ms <= now, so storing that period end revokes immediately
 * without a special case. The purchase_event row is still recorded either way
 * for the audit trail. Any other type is stored and ignored for subscription
 * state.
 *
 * After an upsert, the trainer's subscriber_count is recomputed as the number
 * of paying subscribers: active unexpired rows plus cancelled rows still
 * inside their paid period.
 */

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'billing_issue';
export type SubscriptionStore = 'app_store' | 'play_store';

const STATUS_BY_EVENT: Record<string, SubscriptionStatus> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  // CANCELLATION fires when auto-renew is turned off, but the current paid
  // period is still running. Mapping it to 'active' (not 'cancelled') keeps
  // the entitlement policy's status='active' check satisfied and lets
  // current_period_end (still written below from the event payload) expire
  // access naturally at the end of the period the user already paid for.
  CANCELLATION: 'active',
  EXPIRATION: 'expired',
  BILLING_ISSUE: 'billing_issue',
};

export interface PurchaseEventInput {
  rcEventId: string;
  eventType: string;
  userId: string | null;
  trainerId: string | null;
  productId: string | null;
  priceUsd: number | null;
  raw: unknown;
}

export interface SubscriptionUpsertInput {
  userId: string;
  trainerId: string;
  productId: string;
  store: SubscriptionStore;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  rcAppUserId: string;
  nowIso: string;
}

export interface RcWebhookStore {
  insertPurchaseEvent(input: PurchaseEventInput): Promise<{ inserted: boolean }>;
  trainerExists(trainerId: string): Promise<boolean>;
  upsertSubscription(input: SubscriptionUpsertInput): Promise<void>;
  countActiveSubscribers(trainerId: string, nowIso: string): Promise<number>;
  updateSubscriberCount(trainerId: string, count: number, nowIso: string): Promise<void>;
}

export interface RcWebhookDeps {
  store: RcWebhookStore;
  webhookSecret: string;
  now: () => number;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorJson(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function msToIso(value: unknown): string | null {
  const ms = numberOrNull(value);
  if (ms === null) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function mapStore(value: unknown): SubscriptionStore {
  const store = String(value ?? '').toUpperCase();
  return store.includes('PLAY') || store.includes('AMAZON') ? 'play_store' : 'app_store';
}

export function extractTrainerId(event: Record<string, unknown>): string | null {
  const attrs = objectRecord(event.subscriber_attributes);
  const raw = attrs.trainer_id;
  if (typeof raw === 'string') return stringOrNull(raw);
  return stringOrNull(objectRecord(raw).value);
}

export async function handleDoWorkRcWebhookRequest(
  req: Request,
  deps: RcWebhookDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return errorJson('method_not_allowed', 405);
  }

  const auth = req.headers.get('Authorization');
  if (!deps.webhookSecret || auth !== deps.webhookSecret) {
    return errorJson('unauthorized', 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = objectRecord(await req.json());
  } catch {
    return errorJson('invalid_input', 400);
  }

  const event = objectRecord(payload.event);
  const rcEventId = stringOrNull(event.id);
  if (!rcEventId) {
    return errorJson('invalid_input', 400);
  }

  const eventType = stringOrNull(event.type) ?? 'UNKNOWN';
  const appUserId = stringOrNull(event.app_user_id);
  const productId = stringOrNull(event.product_id);
  const store = mapStore(event.store);
  const priceUsd = numberOrNull(event.price);
  const currentPeriodEnd = msToIso(event.expiration_at_ms);

  const trainerAttr = extractTrainerId(event);
  const resolvedTrainerId =
    trainerAttr && (await deps.store.trainerExists(trainerAttr)) ? trainerAttr : null;

  const { inserted } = await deps.store.insertPurchaseEvent({
    rcEventId,
    eventType,
    userId: appUserId,
    trainerId: resolvedTrainerId,
    productId,
    priceUsd,
    raw: payload,
  });
  if (!inserted) {
    return jsonResponse({ ok: true, duplicate: true });
  }

  const status = STATUS_BY_EVENT[eventType];
  if (!status) {
    return jsonResponse({ ok: true, ignored: true });
  }
  if (!appUserId || !resolvedTrainerId) {
    return jsonResponse({ ok: true, unmatched: true });
  }

  const nowIso = new Date(deps.now()).toISOString();
  await deps.store.upsertSubscription({
    userId: appUserId,
    trainerId: resolvedTrainerId,
    productId: productId ?? 'unknown',
    store,
    status,
    currentPeriodEnd,
    rcAppUserId: appUserId,
    nowIso,
  });

  const subscriberCount = await deps.store.countActiveSubscribers(resolvedTrainerId, nowIso);
  await deps.store.updateSubscriberCount(resolvedTrainerId, subscriberCount, nowIso);

  return jsonResponse({ ok: true, status, subscriberCount });
}

// ── Supabase-backed store (service role, REST) ─────────────────────────────

function ensureServiceConfig(env: (key: string) => string | undefined): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

class SupabaseRcWebhookStore implements RcWebhookStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async insertPurchaseEvent(input: PurchaseEventInput): Promise<{ inserted: boolean }> {
    const rows = await this.restJson<Array<Record<string, unknown>>>(
      '/rest/v1/dw_purchase_events?on_conflict=rc_event_id',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({
          rc_event_id: input.rcEventId,
          event_type: input.eventType,
          user_id: input.userId,
          trainer_id: input.trainerId,
          product_id: input.productId,
          price_usd: input.priceUsd,
          raw: input.raw,
        }),
      },
      [200, 201],
    );
    return { inserted: rows.length > 0 };
  }

  async trainerExists(trainerId: string): Promise<boolean> {
    const rows = await this.restJson<Array<{ id: string }>>(
      `/rest/v1/dw_trainers?select=id&id=eq.${encodeURIComponent(trainerId)}&limit=1`,
    );
    return rows.length > 0;
  }

  async upsertSubscription(input: SubscriptionUpsertInput): Promise<void> {
    await this.restJson<unknown>(
      '/rest/v1/dw_trainer_subscriptions?on_conflict=user_id,trainer_id',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: input.userId,
          trainer_id: input.trainerId,
          product_id: input.productId,
          store: input.store,
          status: input.status,
          current_period_end: input.currentPeriodEnd,
          rc_app_user_id: input.rcAppUserId,
          updated_at: input.nowIso,
        }),
      },
      [200, 201, 204],
    );
  }

  async countActiveSubscribers(trainerId: string, nowIso: string): Promise<number> {
    // Paying subscribers: active unexpired rows, plus cancelled rows whose
    // paid period is still running (paid-through access).
    const now = encodeURIComponent(nowIso);
    const res = await this.fetchImpl(
      `${this.config.url}/rest/v1/dw_trainer_subscriptions?select=id&trainer_id=eq.${encodeURIComponent(trainerId)}` +
        `&or=(and(status.eq.active,or(current_period_end.is.null,current_period_end.gt.${now})),and(status.eq.cancelled,current_period_end.gt.${now}))`,
      {
        method: 'GET',
        headers: { ...this.authHeaders(), ...JSON_HEADERS, Prefer: 'count=exact', Range: '0-0' },
      },
    );
    if (res.status !== 200 && res.status !== 206) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase count failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }
    await res.text().catch(() => '');
    const range = res.headers.get('content-range');
    const total = range ? Number(range.split('/')[1]) : NaN;
    return Number.isFinite(total) ? total : 0;
  }

  async updateSubscriberCount(trainerId: string, count: number, nowIso: string): Promise<void> {
    await this.restJson<unknown>(
      `/rest/v1/dw_trainers?id=eq.${encodeURIComponent(trainerId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ subscriber_count: count, updated_at: nowIso }),
      },
      [200, 204],
    );
  }

  private authHeaders(): Record<string, string> {
    return { apikey: this.config.key, Authorization: `Bearer ${this.config.key}` };
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: { ...this.authHeaders(), ...JSON_HEADERS, ...(init.headers ?? {}) },
    });
    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

export function createSupabaseRcWebhookStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): RcWebhookStore {
  return new SupabaseRcWebhookStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno!.env.get(key);
    const webhookSecret = stringOrNull(env('RC_WEBHOOK_SECRET'));
    if (!webhookSecret) {
      return errorJson('config_error', 503);
    }
    let store: RcWebhookStore;
    try {
      store = createSupabaseRcWebhookStore(env, fetch);
    } catch {
      return errorJson('config_error', 503);
    }
    return handleDoWorkRcWebhookRequest(req, { store, webhookSecret, now: () => Date.now() });
  });
}
