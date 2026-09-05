import { describe, expect, it } from 'vitest';
import {
  connectAccountRef,
  handleMyNewsPaymentsWebhook,
  needsAccountAttribution,
  normalizePaymentEventType,
  stripeHmacSignatureProvider,
} from '../index.ts';
import {
  createInMemoryMyNewsPaymentsStore,
  type MyNewsPaymentsStore,
} from '../../_shared/mynews-payments-store.ts';

const SECRET = 'whsec_test_secret';
const NOW_MS = Date.parse('2026-07-12T12:00:00.000Z');
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

async function signature(payload: string, timestamp = NOW_SECONDS): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const digest = Array.from(new Uint8Array(signed), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `t=${timestamp},v1=${digest}`;
}

async function post(
  event: unknown,
  options: { timestamp?: number; raw?: string; signature?: string | null } = {},
): Promise<Request> {
  const body = options.raw ?? JSON.stringify(event);
  const header =
    options.signature === undefined
      ? await signature(body, options.timestamp)
      : options.signature;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (header) headers.set('Stripe-Signature', header);
  return new Request('http://local/mynews-payments-webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function deps(store: MyNewsPaymentsStore | null, webhookSecret: string | null = SECRET) {
  return {
    store,
    signatureProvider: stripeHmacSignatureProvider,
    webhookSecret,
    now: () => NOW_MS,
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

const paymentEvent = (id = 'evt_payment_1') => ({
  id,
  type: 'payment_intent.succeeded',
  created: NOW_SECONDS,
  data: {
    object: {
      id: 'pi_1',
      amount_received: 1000,
      currency: 'usd',
      metadata: {
        supporter_profile_id: '11111111-1111-1111-1111-111111111111',
        journalist_profile_id: '22222222-2222-2222-2222-222222222222',
      },
    },
  },
});

const JOURNALIST_ID = '22222222-2222-2222-2222-222222222222';

/**
 * A real Stripe Connect automatic payout: the object carries NO metadata, and
 * the journalist is identifiable only from the envelope's `account` field.
 */
const payoutEvent = (id = 'evt_payout_1') => ({
  id,
  type: 'payout.paid',
  created: NOW_SECONDS,
  account: 'acct_journalist1',
  data: { object: { id: 'po_1', amount: 4900, currency: 'usd', metadata: {} } },
});

describe('Stripe-style signature verification', () => {
  it('accepts an exact HMAC within the tolerance window', async () => {
    const payload = JSON.stringify(paymentEvent());
    expect(
      await stripeHmacSignatureProvider.verify({
        payload,
        signatureHeader: await signature(payload),
        secret: SECRET,
        nowMs: NOW_MS,
        toleranceSeconds: 300,
      }),
    ).toBe(true);
  });

  it('rejects a wrong secret, malformed header, and stale timestamp', async () => {
    const payload = JSON.stringify(paymentEvent());
    expect(
      await stripeHmacSignatureProvider.verify({
        payload,
        signatureHeader: await signature(payload),
        secret: 'wrong',
        nowMs: NOW_MS,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
    expect(
      await stripeHmacSignatureProvider.verify({
        payload,
        signatureHeader: 'garbage',
        secret: SECRET,
        nowMs: NOW_MS,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
    const stale = NOW_SECONDS - 301;
    expect(
      await stripeHmacSignatureProvider.verify({
        payload,
        signatureHeader: await signature(payload, stale),
        secret: SECRET,
        nowMs: NOW_MS,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
  });
});

describe('handleMyNewsPaymentsWebhook', () => {
  it('returns a typed 503 and writes nothing when the secret is unconfigured', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const response = await handleMyNewsPaymentsWebhook(await post(paymentEvent()), deps(store, null));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe('payments-unconfigured');
    expect(state.events).toHaveLength(0);
  });

  it('rejects unsigned and invalid signatures before the store', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const unsigned = await handleMyNewsPaymentsWebhook(
      await post(paymentEvent(), { signature: null }),
      deps(store),
    );
    expect(unsigned.status).toBe(401);
    expect((await json(unsigned)).error).toBe('invalid-signature');

    const invalid = await handleMyNewsPaymentsWebhook(
      await post(paymentEvent(), { signature: `t=${NOW_SECONDS},v1=${'0'.repeat(64)}` }),
      deps(store),
    );
    expect(invalid.status).toBe(401);
    expect(state.events).toHaveLength(0);
  });

  it('rejects a correctly signed event outside the timestamp window', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const response = await handleMyNewsPaymentsWebhook(
      await post(paymentEvent(), { timestamp: NOW_SECONDS - 301 }),
      deps(store),
    );
    expect(response.status).toBe(401);
    expect(state.events).toHaveLength(0);
  });

  it('maps and applies a verified payment exactly once per provider event id', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const first = await handleMyNewsPaymentsWebhook(await post(paymentEvent()), deps(store));
    expect(first.status).toBe(200);
    expect((await json(first)).data).toEqual({ status: 'applied' });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      provider: 'stripe',
      providerEventId: 'evt_payment_1',
      eventType: 'payment_succeeded',
      occurredAt: '2026-07-12T12:00:00.000Z',
    });

    const replay = await handleMyNewsPaymentsWebhook(await post(paymentEvent()), deps(store));
    expect((await json(replay)).data).toEqual({ status: 'duplicate' });
    expect(state.events).toHaveLength(1);
  });

  it.each([
    ['payment.succeeded', 'payment_succeeded'],
    ['payment_intent.succeeded', 'payment_succeeded'],
    ['payment.refunded', 'payment_refunded'],
    ['charge.refunded', 'payment_refunded'],
    ['dispute.created', 'dispute_created'],
    ['charge.dispute.created', 'dispute_created'],
    ['dispute.resolved', 'dispute_resolved'],
    ['charge.dispute.closed', 'dispute_resolved'],
    ['payout.paid', 'payout_paid'],
    ['payout.failed', 'payout_failed'],
    ['account.updated', 'payout_account_updated'],
  ])('maps %s to %s', (providerType, normalized) => {
    expect(normalizePaymentEventType(providerType)).toBe(normalized);
  });

  it('stores an unknown verified event for an idempotent ignored RPC outcome', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const event = { ...paymentEvent('evt_unknown'), type: 'customer.created' };
    const response = await handleMyNewsPaymentsWebhook(await post(event), deps(store));
    expect(response.status).toBe(200);
    expect(state.events[0]?.eventType).toBe('customer.created');
  });

  it('rejects signed malformed JSON and missing event coordinates', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const malformed = await handleMyNewsPaymentsWebhook(
      await post(null, { raw: '{not-json' }),
      deps(store),
    );
    expect(malformed.status).toBe(400);

    const missing = await handleMyNewsPaymentsWebhook(
      await post({ id: 'evt_only' }),
      deps(store),
    );
    expect(missing.status).toBe(400);
    expect(state.events).toHaveLength(0);
  });

  it('fails closed when the transactional store call fails', async () => {
    const { store: base } = createInMemoryMyNewsPaymentsStore();
    const store: MyNewsPaymentsStore = {
      ...base,
      applyPaymentEvent: async () => {
        throw new Error('database unavailable');
      },
    };
    const response = await handleMyNewsPaymentsWebhook(await post(paymentEvent()), deps(store));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe('payments-unavailable');
  });

  it('resolves payout attribution from the event envelope account, not the object metadata', async () => {
    // A real Stripe automatic payout on an Express account: empty metadata, and
    // the only attribution signal is the top-level `account` field.
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      payoutAccounts: [
        {
          journalistProfileId: JOURNALIST_ID,
          onboardingState: 'verified',
          provider: 'stripe',
          providerAccountRef: 'acct_journalist1',
          statusReason: null,
        },
      ],
    });
    const response = await handleMyNewsPaymentsWebhook(await post(payoutEvent()), deps(store));
    expect(response.status).toBe(200);
    expect(state.events[0]).toMatchObject({
      eventType: 'payout_paid',
      providerAccountRef: 'acct_journalist1',
      resolvedJournalistProfileId: JOURNALIST_ID,
    });
  });

  it('passes an unknown Connect account through unresolved instead of guessing', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore();
    const response = await handleMyNewsPaymentsWebhook(await post(payoutEvent()), deps(store));
    expect(response.status).toBe(200);
    expect(state.events[0]).toMatchObject({
      providerAccountRef: 'acct_journalist1',
      resolvedJournalistProfileId: null,
    });
  });

  it('does not resolve an account for non-payout events', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      payoutAccounts: [
        {
          journalistProfileId: JOURNALIST_ID,
          onboardingState: 'verified',
          provider: 'stripe',
          providerAccountRef: 'acct_journalist1',
          statusReason: null,
        },
      ],
    });
    await handleMyNewsPaymentsWebhook(
      await post({ ...paymentEvent('evt_connected_charge'), account: 'acct_journalist1' }),
      deps(store),
    );
    expect(state.events[0]).toMatchObject({
      eventType: 'payment_succeeded',
      providerAccountRef: 'acct_journalist1',
      resolvedJournalistProfileId: null,
    });
  });

  it('reads only a well-formed Connect account reference from the envelope', () => {
    expect(connectAccountRef({ account: 'acct_1A2b3C' })).toBe('acct_1A2b3C');
    expect(connectAccountRef({ account: '  acct_1A2b3C  ' })).toBe('acct_1A2b3C');
    expect(connectAccountRef({})).toBeNull();
    expect(connectAccountRef({ account: '' })).toBeNull();
    expect(connectAccountRef({ account: 'cus_1A2b3C' })).toBeNull();
    expect(connectAccountRef({ account: 'acct_' })).toBeNull();
    expect(connectAccountRef({ account: 'acct_bad;drop' })).toBeNull();
    expect(connectAccountRef({ account: 42 })).toBeNull();
  });

  it('requires account attribution for exactly the payout event types', () => {
    expect(needsAccountAttribution('payout_paid')).toBe(true);
    expect(needsAccountAttribution('payout_failed')).toBe(true);
    for (const type of [
      'payment_succeeded',
      'payment_refunded',
      'dispute_created',
      'dispute_resolved',
      'payout_account_updated',
      'customer.created',
    ]) {
      expect(needsAccountAttribution(type)).toBe(false);
    }
  });

  it('fails closed when the account resolution read fails', async () => {
    const { store: base } = createInMemoryMyNewsPaymentsStore();
    const store: MyNewsPaymentsStore = {
      ...base,
      getJournalistProfileIdByAccountRef: async () => {
        throw new Error('database unavailable');
      },
    };
    const response = await handleMyNewsPaymentsWebhook(await post(payoutEvent()), deps(store));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe('payments-unavailable');
  });

  it('rejects non-POST methods', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore();
    const response = await handleMyNewsPaymentsWebhook(
      new Request('http://local/mynews-payments-webhook', { method: 'GET' }),
      deps(store),
    );
    expect(response.status).toBe(405);
  });
});

