import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { BILLING_SKUS, MEERKAT_HOSTED_MONTHLY_PRODUCT } from '@mylife/billing-config';
import {
  MEERKAT_HOSTED_RELAY_FEATURE,
  verifyHostedFeatureEntitlement,
} from '@mylife/entitlements/server';
import {
  createMeerkatHostedApiHandler,
  type MeerkatHostedApiOptions,
  type MeerkatHostedBillingClient,
  type MeerkatHostedBillingEvent,
  type MeerkatHostedBillingStore,
  type MeerkatHostedCheckoutInput,
  type MeerkatHostedPortalInput,
  type MeerkatHostedSubject,
  type MeerkatHostedSubscription,
  type MeerkatUsageSource,
} from '../hosted-api';

const SECRET = 'meerkat-hosted-api-secret';
const WEBHOOK_SECRET = 'meerkat-webhook-secret';
const NOW = Date.parse('2026-06-20T12:00:00.000Z');

class MemoryHostedStore implements MeerkatHostedBillingStore {
  readonly subscriptions = new Map<string, MeerkatHostedSubscription>();

  async getSubscription(subjectId: string): Promise<MeerkatHostedSubscription | null> {
    return this.subscriptions.get(subjectId) ?? null;
  }

  async upsertSubscription(subscription: MeerkatHostedSubscription): Promise<void> {
    this.subscriptions.set(subscription.subjectId, subscription);
  }

  async applySubscriptionEvent(subscription: MeerkatHostedSubscription): Promise<'applied'> {
    this.subscriptions.set(subscription.subjectId, subscription);
    return 'applied';
  }
}

class FakeBillingClient implements MeerkatHostedBillingClient {
  checkout: MeerkatHostedCheckoutInput | null = null;
  portal: MeerkatHostedPortalInput | null = null;

  async createCheckoutSession(input: MeerkatHostedCheckoutInput): Promise<{ url: string }> {
    this.checkout = input;
    return { url: `https://billing.example/checkout/${input.subject.subjectId}` };
  }

  async createPortalSession(input: MeerkatHostedPortalInput): Promise<{ url: string }> {
    this.portal = input;
    return { url: `https://billing.example/portal/${input.subject.subjectId}` };
  }

  async parseWebhook(input: {
    payload: string;
    signature: string | null;
    webhookSecret: string;
  }): Promise<MeerkatHostedBillingEvent> {
    if (input.webhookSecret !== WEBHOOK_SECRET || input.signature !== 'sig-valid') {
      throw new Error('Invalid webhook signature.');
    }
    const parsed = JSON.parse(input.payload) as MeerkatHostedBillingEvent;
    return parsed;
  }
}

interface TestServer {
  url: string;
  close(): Promise<void>;
}

const servers: TestServer[] = [];

afterEach(async () => {
  const open = servers.splice(0, servers.length);
  await Promise.all(open.map((server) => server.close()));
});

describe('Meerkat hosted API', () => {
  it('returns payment_required for authenticated web users without an active subscription', async () => {
    const store = new MemoryHostedStore();
    const billing = new FakeBillingClient();
    const server = await startTestApi(store, billing);

    const response = await fetch(`${server.url}/api/entitlements/meerkat`, {
      headers: { Authorization: 'Bearer unpaid' },
    });
    const body = await response.json() as { error: string; sku: string; price: number };

    expect(response.status).toBe(402);
    expect(body).toEqual({
      error: 'payment_required',
      sku: BILLING_SKUS.meerkatHostedMonthly,
      price: MEERKAT_HOSTED_MONTHLY_PRODUCT.price,
    });
  });

  it('creates a checkout session for the $4.99 Meerkat hosted monthly SKU', async () => {
    const store = new MemoryHostedStore();
    const billing = new FakeBillingClient();
    const server = await startTestApi(store, billing);

    const response = await fetch(`${server.url}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer paid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        successUrl: 'https://meerkat.example/success',
        cancelUrl: 'https://meerkat.example/cancel',
      }),
    });
    const body = await response.json() as { url: string };

    expect(response.status).toBe(200);
    expect(body.url).toBe('https://billing.example/checkout/paid');
    expect(billing.checkout).toMatchObject({
      sku: BILLING_SKUS.meerkatHostedMonthly,
      price: 4.99,
      successUrl: 'https://meerkat.example/success',
      cancelUrl: 'https://meerkat.example/cancel',
    });
  });

  it('activates subscription state from a verified webhook and issues a short-lived entitlement', async () => {
    const store = new MemoryHostedStore();
    const billing = new FakeBillingClient();
    const server = await startTestApi(store, billing);

    const webhook = await fetch(`${server.url}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'sig-valid',
      },
      body: JSON.stringify({
        eventId: 'evt_1',
        occurredAt: '2026-06-20T11:59:59.000Z',
        subjectId: 'paid',
        status: 'active',
        customerId: 'cus_1',
        subscriptionId: 'sub_1',
        currentPeriodEnd: '2026-06-27T12:00:00.000Z',
      } satisfies MeerkatHostedBillingEvent),
    });

    expect(webhook.status).toBe(200);
    expect(await store.getSubscription('paid')).toMatchObject({
      status: 'active',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });

    const response = await fetch(`${server.url}/api/entitlements/meerkat`, {
      headers: { Authorization: 'Bearer paid' },
    });
    const body = await response.json() as { token: string; entitlements: { expiresAt: string } };

    expect(response.status).toBe(200);
    expect(body.entitlements.expiresAt).toBe('2026-06-20T12:15:00.000Z');
    await expect(
      verifyHostedFeatureEntitlement(body.token, SECRET, MEERKAT_HOSTED_RELAY_FEATURE, {
        nowMs: NOW + 1,
      }),
    ).resolves.toMatchObject({ ok: true });
  });
});

describe('GET /api/usage/meerkat (Plan 22 S0.2)', () => {
  it('401s without authorization', async () => {
    const { url } = await startTestApi(new MemoryHostedStore(), new FakeBillingClient());
    const res = await fetch(`${url}/api/usage/meerkat`);
    expect(res.status).toBe(401);
  });

  it('reports "Not connected" (never a fabricated meter) when the subject has no tenant', async () => {
    const usage: MeerkatUsageSource = { usageForSubject: () => null };
    const { url } = await startTestApi(new MemoryHostedStore(), new FakeBillingClient(), usage);
    const res = await fetch(`${url}/api/usage/meerkat`, { headers: { authorization: 'Bearer paid' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false });
  });

  it('returns the subject OWN real usage from the source (own-only, keyed by subject)', async () => {
    const calls: string[] = [];
    const usage: MeerkatUsageSource = {
      usageForSubject: (subjectId) => {
        calls.push(subjectId);
        return {
          tenantId: subjectId,
          tier: 'free',
          retentionTier: 'rolling30',
          startedAt: '2026-06-20T00:00:00.000Z',
          uptimeMs: 0,
          pinnedContent: 1,
          activeContent: 1,
          storageBytes: 4096,
          storageCapBytes: 1024 * 1024 * 1024,
          bytesServed: 200,
          peersServed: 3,
        };
      },
    };
    const { url } = await startTestApi(new MemoryHostedStore(), new FakeBillingClient(), usage);
    const res = await fetch(`${url}/api/usage/meerkat`, { headers: { authorization: 'Bearer paid' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      connected: true,
      tier: 'free',
      // S0.5 storage breakdown: real used/cap, overage 0 (within the free cap),
      // and the real retention tier -- never a fabricated number.
      storage: { usedBytes: 4096, capBytes: 1024 * 1024 * 1024, overageGb: 0, retentionTier: 'rolling30' },
      bytesServed: 200,
      peersServed: 3,
    });
    expect(calls).toEqual(['paid']);
  });

  it('405s a non-GET method', async () => {
    const { url } = await startTestApi(new MemoryHostedStore(), new FakeBillingClient());
    const res = await fetch(`${url}/api/usage/meerkat`, {
      method: 'POST',
      headers: { authorization: 'Bearer paid' },
    });
    expect(res.status).toBe(405);
  });
});

async function startTestApi(
  store: MemoryHostedStore,
  billing: FakeBillingClient,
  usage?: MeerkatUsageSource,
): Promise<TestServer> {
  const options: MeerkatHostedApiOptions = {
    entitlementSecret: SECRET,
    webhookSecret: WEBHOOK_SECRET,
    store,
    billing,
    usage,
    now: () => NOW,
    authorize: (req) => subjectFromAuth(req.headers.authorization),
  };
  const server = http.createServer(createMeerkatHostedApiHandler(options));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('Server did not bind.');
  const testServer = {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  servers.push(testServer);
  return testServer;
}

function subjectFromAuth(header: string | undefined): MeerkatHostedSubject | null {
  if (header === 'Bearer paid') return { subjectId: 'paid', email: 'paid@example.test' };
  if (header === 'Bearer unpaid') return { subjectId: 'unpaid', email: 'unpaid@example.test' };
  return null;
}
