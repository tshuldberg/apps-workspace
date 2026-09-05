import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import nacl from 'tweetnacl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';
import { appUnlockBindingMessage, verifyMeerkatAppUnlockToken } from '@mylife/entitlements/server';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createRevenueCatAppUserId,
  generateDeviceIdentity,
} from '@mylife/sync';
import {
  AppUnlockPersonaInUseError,
  createMeerkatHostedApiHandler,
  createDeviceSignedAuthorizer,
  signHostedAuthBearer,
  verifyHostedAuthBearer,
  FileMeerkatBillingStore,
  StripeMeerkatBillingClient,
  failClosedStoreReceiptValidator,
  type MeerkatAppBillingClient,
  type MeerkatAppBillingStore,
  type MeerkatAppCheckoutInput,
  type MeerkatAppLink,
  type MeerkatAppPurchase,
  type MeerkatBillingWebhookEvent,
  type MeerkatHostedApiOptions,
  type MeerkatHostedBillingClient,
  type MeerkatHostedBillingStore,
  type MeerkatHostedSubject,
  type MeerkatHostedSubscription,
} from '../index';

const SECRET = 'app-unlock-secret';
const WEBHOOK_SECRET = 'app-unlock-webhook-secret';
const NOW = Date.parse('2026-07-06T12:00:00.000Z');

// --- device-signed authorizer (authorize(), Plan 22 Phase 2) ----------------

describe('device-signed authorizer', () => {
  const kp = nacl.sign.keyPair();
  const subjectId = Buffer.from(kp.publicKey).toString('hex');

  it('verifies a real device-signed bearer to its own subject', () => {
    const bearer = signHostedAuthBearer(subjectId, NOW + 60_000, kp.secretKey);
    expect(verifyHostedAuthBearer(bearer, NOW)).toEqual({ subjectId });
  });

  it('fails closed on an expired bearer', () => {
    const bearer = signHostedAuthBearer(subjectId, NOW - 1, kp.secretKey);
    expect(verifyHostedAuthBearer(bearer, NOW)).toBeNull();
  });

  it('fails closed on a tampered subject id (signature no longer verifies)', () => {
    const other = nacl.sign.keyPair();
    const otherSubject = Buffer.from(other.publicKey).toString('hex');
    // Sign for our subject but claim someone else's id.
    const bearer = signHostedAuthBearer(subjectId, NOW + 60_000, kp.secretKey);
    const forged = bearer.replace(subjectId, otherSubject);
    expect(verifyHostedAuthBearer(forged, NOW)).toBeNull();
  });

  it('authorize() maps a bearer header to the subject, else null', () => {
    const authorize = createDeviceSignedAuthorizer(() => NOW);
    const bearer = signHostedAuthBearer(subjectId, NOW + 60_000, kp.secretKey);
    const req = { headers: { authorization: `Bearer ${bearer}` } } as unknown as http.IncomingMessage;
    expect(authorize(req)).toEqual({ subjectId });
    expect(authorize({ headers: {} } as http.IncomingMessage)).toBeNull();
  });
});

// --- durable file store ------------------------------------------------------

describe('FileMeerkatBillingStore', () => {
  async function tmpStore(): Promise<FileMeerkatBillingStore> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-billing-'));
    return new FileMeerkatBillingStore(dir);
  }

  it('round-trips subscriptions and app purchases', async () => {
    const store = await tmpStore();
    const sub: MeerkatHostedSubscription = {
      subjectId: 'subj-1', status: 'active', customerId: 'cus_1', updatedAt: new Date(NOW).toISOString(),
    };
    await store.upsertSubscription(sub);
    expect(await store.getSubscription('subj-1')).toEqual(sub);

    const purchase: MeerkatAppPurchase = {
      subjectId: 'subj-1', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(), isActive: true,
    };
    await store.upsertAppPurchase(purchase);
    expect(await store.getAppPurchase('subj-1')).toEqual(purchase);
  });

  it('rejects duplicate and out-of-order provider events and lets same-second denial win', async () => {
    const store = await tmpStore();
    const base = {
      subjectId: 'ordered-subject',
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
      rail: 'stripe' as const,
      purchaseDate: '2026-07-06T12:00:00.000Z',
    };
    await expect(store.applyAppPurchaseEvent({
      ...base, isActive: false, lastProviderEventId: 'evt_refund',
      lastProviderEventAt: '2026-07-06T12:00:02.000Z',
    })).resolves.toBe('applied');
    await expect(store.applyAppPurchaseEvent({
      ...base, isActive: true, lastProviderEventId: 'evt_old_active',
      lastProviderEventAt: '2026-07-06T12:00:01.000Z',
    })).resolves.toBe('stale');
    await expect(store.applyAppPurchaseEvent({
      ...base, isActive: true, lastProviderEventId: 'evt_refund',
      lastProviderEventAt: '2026-07-06T12:00:03.000Z',
    })).resolves.toBe('duplicate');
    expect((await store.getAppPurchase('ordered-subject'))?.isActive).toBe(false);

    await expect(store.applySubscriptionEvent({
      subjectId: 'same-second', status: 'active', updatedAt: new Date(NOW).toISOString(),
      lastProviderEventId: 'evt_active', lastProviderEventAt: '2026-07-06T12:00:03.000Z',
    })).resolves.toBe('applied');
    await expect(store.applySubscriptionEvent({
      subjectId: 'same-second', status: 'canceled', updatedAt: new Date(NOW).toISOString(),
      lastProviderEventId: 'evt_cancel', lastProviderEventAt: '2026-07-06T12:00:03.000Z',
    })).resolves.toBe('applied');
    expect((await store.getSubscription('same-second'))?.status).toBe('canceled');
  });

  it('serializes concurrent provider updates for one subject', async () => {
    const store = await tmpStore();
    const purchase = {
      subjectId: 'race-subject', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe' as const,
      purchaseDate: '2026-07-06T12:00:00.000Z',
    };
    await Promise.all([
      store.applyAppPurchaseEvent({
        ...purchase, isActive: true, lastProviderEventId: 'evt_old',
        lastProviderEventAt: '2026-07-06T12:00:01.000Z',
      }),
      store.applyAppPurchaseEvent({
        ...purchase, isActive: false, lastProviderEventId: 'evt_new',
        lastProviderEventAt: '2026-07-06T12:00:02.000Z',
      }),
    ]);
    expect((await store.getAppPurchase('race-subject'))?.isActive).toBe(false);
  });

  it('redeems a link exactly once (single-use, atomic)', async () => {
    const store = await tmpStore();
    await store.upsertAppPurchase({
      subjectId: 'subj-1', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(), isActive: true,
    });
    const link: MeerkatAppLink = {
      code: 'code-abc', subjectId: 'subj-1', createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(), consumedAt: null,
    };
    await store.createLink(link);
    expect(await store.redeemLink('code-abc', NOW)).toEqual({ subjectId: 'subj-1' });
    // Second redeem fails closed.
    expect(await store.redeemLink('code-abc', NOW)).toBeNull();
  });

  it('fails closed on an expired code, a forged code, and a refunded purchase', async () => {
    const store = await tmpStore();
    await store.upsertAppPurchase({
      subjectId: 'subj-1', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(), isActive: true,
    });
    await store.createLink({
      code: 'expired', subjectId: 'subj-1', createdAt: new Date(NOW - 120_000).toISOString(),
      expiresAt: new Date(NOW - 60_000).toISOString(), consumedAt: null,
    });
    expect(await store.redeemLink('expired', NOW)).toBeNull();
    expect(await store.redeemLink('../etc/passwd', NOW)).toBeNull();

    // A refund between mint and redeem must not unlock the other rail.
    await store.upsertAppPurchase({
      subjectId: 'subj-2', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(), isActive: false,
    });
    await store.createLink({
      code: 'refunded', subjectId: 'subj-2', createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(), consumedAt: null,
    });
    expect(await store.redeemLink('refunded', NOW)).toBeNull();
  });

  it('persona bindings: first-bind-wins, reverse lookup, and reverse-index self-repair', async () => {
    const store = await tmpStore();
    const hashA = 'ab'.repeat(32);
    const hashB = 'cd'.repeat(32);
    expect(await store.getAppUnlockPersona('subj-1')).toBeNull();
    expect(await store.bindAppUnlockPersona('subj-1', hashA)).toBe(hashA);
    // A second bind to a different persona returns the STANDING binding.
    expect(await store.bindAppUnlockPersona('subj-1', hashB)).toBe(hashA);
    expect(await store.getAppUnlockPersona('subj-1')).toBe(hashA);
    expect(await store.getSubjectByAppUnlockPersona(hashA)).toBe('subj-1');
    expect(await store.getSubjectByAppUnlockPersona(hashB)).toBeNull();
    // Re-binding the SAME persona repairs a missing reverse index (crash between
    // the two writes): simulate by binding again after the reverse entry exists;
    // the call is idempotent and the reverse lookup still resolves.
    expect(await store.bindAppUnlockPersona('subj-1', hashA)).toBe(hashA);
    expect(await store.getSubjectByAppUnlockPersona(hashA)).toBe('subj-1');
    await expect(store.bindAppUnlockPersona('subj-2', hashA))
      .rejects.toBeInstanceOf(AppUnlockPersonaInUseError);
  });
});

// --- app-unlock API routes ---------------------------------------------------

class MemoryHostedStore implements MeerkatHostedBillingStore {
  readonly subscriptions = new Map<string, MeerkatHostedSubscription>();
  async getSubscription(id: string): Promise<MeerkatHostedSubscription | null> {
    return this.subscriptions.get(id) ?? null;
  }
  async upsertSubscription(s: MeerkatHostedSubscription): Promise<void> { this.subscriptions.set(s.subjectId, s); }
  async applySubscriptionEvent(s: MeerkatHostedSubscription): Promise<'applied'> {
    this.subscriptions.set(s.subjectId, s);
    return 'applied';
  }
}

class MemoryAppStore implements MeerkatAppBillingStore {
  readonly purchases = new Map<string, MeerkatAppPurchase>();
  readonly links = new Map<string, MeerkatAppLink>();
  readonly personaBindings = new Map<string, string>();
  async getAppPurchase(id: string): Promise<MeerkatAppPurchase | null> { return this.purchases.get(id) ?? null; }
  async upsertAppPurchase(p: MeerkatAppPurchase): Promise<void> { this.purchases.set(p.subjectId, p); }
  async applyAppPurchaseEvent(p: MeerkatAppPurchase): Promise<'applied'> {
    this.purchases.set(p.subjectId, p);
    return 'applied';
  }
  async createLink(l: MeerkatAppLink): Promise<void> { this.links.set(l.code, l); }
  async redeemLink(code: string, nowMs: number): Promise<{ subjectId: string } | null> {
    const link = this.links.get(code);
    if (!link || link.consumedAt || Date.parse(link.expiresAt) <= nowMs) return null;
    const purchase = this.purchases.get(link.subjectId);
    if (!purchase?.isActive) return null;
    this.links.set(code, { ...link, consumedAt: new Date(nowMs).toISOString() });
    return { subjectId: link.subjectId };
  }
  async getAppUnlockPersona(subjectId: string): Promise<string | null> {
    return this.personaBindings.get(subjectId) ?? null;
  }
  async bindAppUnlockPersona(subjectId: string, personaHash: string): Promise<string> {
    const existing = this.personaBindings.get(subjectId);
    if (existing) return existing;
    this.personaBindings.set(subjectId, personaHash.toLowerCase());
    return personaHash.toLowerCase();
  }
  async getSubjectByAppUnlockPersona(personaHash: string): Promise<string | null> {
    for (const [subjectId, hash] of this.personaBindings) {
      if (hash === personaHash.toLowerCase()) return subjectId;
    }
    return null;
  }
  async releaseAppUnlockPersona(subjectId: string): Promise<{ released: boolean; personaHash: string | null }> {
    const personaHash = this.personaBindings.get(subjectId) ?? null;
    if (!personaHash) return { released: false, personaHash: null };
    this.personaBindings.delete(subjectId);
    return { released: true, personaHash };
  }
}

class FakeBilling implements MeerkatHostedBillingClient, MeerkatAppBillingClient {
  appCheckout: MeerkatAppCheckoutInput | null = null;
  async createCheckoutSession(): Promise<{ url: string }> { return { url: 'https://x/sub' }; }
  async createPortalSession(): Promise<{ url: string }> { return { url: 'https://x/portal' }; }
  async createAppCheckoutSession(input: MeerkatAppCheckoutInput): Promise<{ url: string }> {
    this.appCheckout = input;
    return { url: `https://x/app/${input.subject.subjectId}` };
  }
  async parseWebhook(input: { payload: string }): Promise<MeerkatBillingWebhookEvent> {
    return JSON.parse(input.payload) as MeerkatBillingWebhookEvent;
  }
}

interface TestServer { url: string; close(): Promise<void>; }
const servers: TestServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => s.close())); });

async function startApi(app: MemoryAppStore, billing: FakeBilling, extra: Partial<MeerkatHostedApiOptions> = {}): Promise<TestServer> {
  const options: MeerkatHostedApiOptions = {
    entitlementSecret: SECRET,
    webhookSecret: WEBHOOK_SECRET,
    store: new MemoryHostedStore(),
    billing,
    now: () => NOW,
    authorize: (req) => subjectFromAuth(req.headers.authorization),
    appUnlock: { billing, store: app, receiptValidator: failClosedStoreReceiptValidator() },
    ...extra,
  };
  const server = http.createServer(createMeerkatHostedApiHandler(options));
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('no bind');
  const ts = { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
  servers.push(ts);
  return ts;
}

function subjectFromAuth(header: string | undefined): MeerkatHostedSubject | null {
  if (header === 'Bearer alice') return { subjectId: 'alice' };
  if (header === 'Bearer bob') return { subjectId: 'bob' };
  if (header === 'Bearer mallory') return { subjectId: 'mallory' };
  return null;
}

describe('app-unlock API', () => {
  it('creates a one-time checkout with the config price (never hardcoded)', async () => {
    const app = new MemoryAppStore();
    const billing = new FakeBilling();
    const { url } = await startApi(app, billing);
    const res = await fetch(`${url}/api/billing/app-checkout`, {
      method: 'POST',
      headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' },
      body: JSON.stringify({ successUrl: 'https://m/ok', cancelUrl: 'https://m/no' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://x/app/alice' });
    expect(billing.appCheckout).toMatchObject({
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
      price: MEERKAT_APP_UNLOCK_PRODUCT.price,
    });
  });

  it('restores locked for no purchase, unlocked for a real active purchase', async () => {
    const app = new MemoryAppStore();
    const { url } = await startApi(app, new FakeBilling());
    let res = await fetch(`${url}/api/entitlements/meerkat-app`, { headers: { Authorization: 'Bearer alice' } });
    expect(await res.json()).toEqual({ unlocked: false, purchaseDate: null });

    app.purchases.set('alice', {
      subjectId: 'alice', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: '2026-07-06T00:00:00.000Z', isActive: true,
    });
    res = await fetch(`${url}/api/entitlements/meerkat-app`, { headers: { Authorization: 'Bearer alice' } });
    expect(await res.json()).toEqual({ unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' });
  });

  it('a verified app_purchase webhook unlocks web restore', async () => {
    const app = new MemoryAppStore();
    const { url } = await startApi(app, new FakeBilling());
    const webhook = await fetch(`${url}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'app_purchase',
        event: { eventId: 'evt_a', occurredAt: '2026-07-06T00:00:00.000Z', subjectId: 'alice', productId: 'meerkat_app_unlock', rail: 'stripe', purchaseDate: '2026-07-06T00:00:00.000Z', isActive: true },
      } satisfies MeerkatBillingWebhookEvent),
    });
    expect(webhook.status).toBe(200);
    const res = await fetch(`${url}/api/entitlements/meerkat-app`, { headers: { Authorization: 'Bearer alice' } });
    expect(await res.json()).toMatchObject({ unlocked: true });
  });

  it('mints a Stripe-rail link, redeems it once, then fails closed', async () => {
    const app = new MemoryAppStore();
    app.purchases.set('alice', {
      subjectId: 'alice', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: '2026-07-06T00:00:00.000Z', isActive: true,
    });
    const { url } = await startApi(app, new FakeBilling());
    const mint = await fetch(`${url}/api/link/meerkat-app`, {
      method: 'POST',
      headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: 'stripe' }),
    });
    expect(mint.status).toBe(200);
    const { code } = await mint.json() as { code: string };
    expect(code).toBeTruthy();

    const redeem = await fetch(`${url}/api/entitlements/meerkat-app?link=${encodeURIComponent(code)}`, {
      headers: { Authorization: 'Bearer bob' },
    });
    const redeemed = await redeem.json() as { unlocked: boolean; purchaseDate: string; grant: string };
    expect(redeemed).toMatchObject({ unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' });
    expect(redeemed.grant).toBeTruthy();

    const validated = await fetch(`${url}/api/entitlements/meerkat-app?grant=${encodeURIComponent(redeemed.grant)}`, {
      headers: { Authorization: 'Bearer bob' },
    });
    expect(await validated.json()).toMatchObject({ unlocked: true, grant: redeemed.grant });
    const stolen = await fetch(`${url}/api/entitlements/meerkat-app?grant=${encodeURIComponent(redeemed.grant)}`, {
      headers: { Authorization: 'Bearer mallory' },
    });
    expect(await stolen.json()).toEqual({ unlocked: false, purchaseDate: null });

    const replay = await fetch(`${url}/api/entitlements/meerkat-app?link=${encodeURIComponent(code)}`, {
      headers: { Authorization: 'Bearer bob' },
    });
    expect(await replay.json()).toEqual({ unlocked: false });

    const forged = await fetch(`${url}/api/entitlements/meerkat-app?link=nope`, {
      headers: { Authorization: 'Bearer bob' },
    });
    expect(await forged.json()).toEqual({ unlocked: false });
  });

  it('refuses a stripe-rail link with no active purchase (402)', async () => {
    const app = new MemoryAppStore();
    const { url } = await startApi(app, new FakeBilling());
    const res = await fetch(`${url}/api/link/meerkat-app`, {
      method: 'POST',
      headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: 'stripe' }),
    });
    expect(res.status).toBe(402);
  });

  it('fails closed (501) on a store-receipt link when no validator is configured', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    const identity = generateDeviceIdentity('Store-link test');
    const receipt = createRevenueCatAppUserId(identity);
    const app = new MemoryAppStore();
    const { url } = await startApi(app, new FakeBilling(), {
      authorize: (req) => req.headers.authorization === 'Bearer device'
        ? { subjectId: identity.publicKey }
        : null,
    });
    const res = await fetch(`${url}/api/link/meerkat-app`, {
      method: 'POST',
      headers: { Authorization: 'Bearer device', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: 'storekit', receipt }),
    });
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({ reason: 'not_configured' });
  });

  it('rejects a RevenueCat id that is not signed by the authenticated device', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    const identity = generateDeviceIdentity('Authenticated device');
    const other = generateDeviceIdentity('Other device');
    const app = new MemoryAppStore();
    const { url } = await startApi(app, new FakeBilling(), {
      authorize: () => ({ subjectId: identity.publicKey }),
    });
    const res = await fetch(`${url}/api/link/meerkat-app`, {
      method: 'POST',
      headers: { Authorization: 'Bearer device', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: 'play', receipt: createRevenueCatAppUserId(other) }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'receipt_subject_mismatch' });
  });

  it('401s app routes without authorization', async () => {
    const { url } = await startApi(new MemoryAppStore(), new FakeBilling());
    const res = await fetch(`${url}/api/link/meerkat-app`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rail: 'stripe' }),
    });
    expect(res.status).toBe(401);
  });
});

// --- Stripe client webhook mapping ------------------------------------------

describe('StripeMeerkatBillingClient.parseWebhook', () => {
  function signed(payload: string, secret: string, tSec: number): string {
    // Mirror Stripe's scheme so the client's verify accepts it.
    const { createHmac } = require('node:crypto') as typeof import('node:crypto');
    const sig = createHmac('sha256', secret).update(`${tSec}.${payload}`).digest('hex');
    return `t=${tSec},v1=${sig}`;
  }

  const client = new StripeMeerkatBillingClient({
    secretKey: 'sk_test_x',
    monthlyPriceId: 'price_month',
    appUnlockPriceId: 'price_app',
    now: () => NOW,
  });
  const tSec = Math.floor(NOW / 1000);

  it('maps a paid payment-mode checkout for the unlock product to an app_purchase', async () => {
    const payload = JSON.stringify({
      id: 'evt_1', type: 'checkout.session.completed', created: tSec,
      data: { object: { mode: 'payment', payment_status: 'paid', client_reference_id: 'alice', metadata: { productId: 'meerkat_app_unlock' } } },
    });
    const event = await client.parseWebhook({ payload, signature: signed(payload, WEBHOOK_SECRET, tSec), webhookSecret: WEBHOOK_SECRET });
    expect(event).toMatchObject({ kind: 'app_purchase', event: { subjectId: 'alice', rail: 'stripe', isActive: true } });
  });

  it('ignores a payment-mode checkout for a DIFFERENT product (identity boundary)', async () => {
    const payload = JSON.stringify({
      id: 'evt_1b', type: 'checkout.session.completed', created: tSec,
      data: { object: { mode: 'payment', payment_status: 'paid', client_reference_id: 'alice', metadata: { productId: 'some_other_product' } } },
    });
    const event = await client.parseWebhook({ payload, signature: signed(payload, WEBHOOK_SECRET, tSec), webhookSecret: WEBHOOK_SECRET });
    expect(event).toEqual({ kind: 'ignored', eventId: 'evt_1b' });
  });

  it('maps a subscription event and ignores unrelated types', async () => {
    const subPayload = JSON.stringify({
      id: 'evt_2', type: 'customer.subscription.updated', created: tSec,
      data: { object: { status: 'active', customer: 'cus_1', id: 'sub_1', current_period_end: tSec + 1000, metadata: { subjectId: 'alice' } } },
    });
    const sub = await client.parseWebhook({ payload: subPayload, signature: signed(subPayload, WEBHOOK_SECRET, tSec), webhookSecret: WEBHOOK_SECRET });
    expect(sub).toMatchObject({ kind: 'subscription', subjectId: 'alice', status: 'active', subscriptionId: 'sub_1' });

    const otherPayload = JSON.stringify({ id: 'evt_3', type: 'payment_intent.created', created: tSec, data: { object: {} } });
    const other = await client.parseWebhook({ payload: otherPayload, signature: signed(otherPayload, WEBHOOK_SECRET, tSec), webhookSecret: WEBHOOK_SECRET });
    expect(other).toEqual({ kind: 'ignored', eventId: 'evt_3' });
  });

  it('revokes on a dispute and restores only when Stripe closes it as won', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('/charges/ch_1');
      return new Response(JSON.stringify({
        id: 'ch_1',
        metadata: { subjectId: 'alice', productId: 'meerkat_app_unlock' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    const disputeClient = new StripeMeerkatBillingClient({
      secretKey: 'sk_test_x', monthlyPriceId: 'price_month', appUnlockPriceId: 'price_app',
      now: () => NOW, fetchImpl,
    });
    const createdPayload = JSON.stringify({
      id: 'evt_dispute', type: 'charge.dispute.created', created: tSec,
      data: { object: { charge: 'ch_1', status: 'needs_response' } },
    });
    await expect(disputeClient.parseWebhook({
      payload: createdPayload,
      signature: signed(createdPayload, WEBHOOK_SECRET, tSec),
      webhookSecret: WEBHOOK_SECRET,
    })).resolves.toMatchObject({ kind: 'app_purchase', event: { subjectId: 'alice', isActive: false } });

    const wonPayload = JSON.stringify({
      id: 'evt_won', type: 'charge.dispute.closed', created: tSec,
      data: { object: { charge: 'ch_1', status: 'won' } },
    });
    await expect(disputeClient.parseWebhook({
      payload: wonPayload,
      signature: signed(wonPayload, WEBHOOK_SECRET, tSec),
      webhookSecret: WEBHOOK_SECRET,
    })).resolves.toMatchObject({ kind: 'app_purchase', event: { subjectId: 'alice', isActive: true } });
  });

  it('rejects a bad signature fail-closed', async () => {
    const payload = JSON.stringify({ id: 'evt_4', type: 'payment_intent.created', created: tSec, data: { object: {} } });
    await expect(
      client.parseWebhook({ payload, signature: 't=1,v1=deadbeef', webhookSecret: WEBHOOK_SECRET }),
    ).rejects.toThrow();
    await expect(
      client.parseWebhook({ payload, signature: null, webhookSecret: WEBHOOK_SECRET }),
    ).rejects.toThrow();
  });
});

// --- app-unlock PROOF token mint route (Plan 39 P6) --------------------------

describe('POST /api/entitlements/meerkat-app-token', () => {
  const TOKEN_SECRET = 'shared-proof-secret';

  interface PersonaKeys { publicKeyHex: string; secretKey: Uint8Array }
  function makePersona(): PersonaKeys {
    const kp = nacl.sign.keyPair();
    return { publicKeyHex: Buffer.from(kp.publicKey).toString('hex'), secretKey: kp.secretKey };
  }
  function personaHashOf(p: PersonaKeys): string {
    return createHash('sha256').update(p.publicKeyHex.toLowerCase(), 'utf8').digest('hex');
  }
  function proofBody(p: PersonaKeys, extra: Record<string, unknown> = {}, ts = new Date(NOW).toISOString()): Record<string, unknown> {
    const sig = nacl.sign.detached(
      new TextEncoder().encode(appUnlockBindingMessage(p.publicKeyHex, ts)),
      p.secretKey,
    );
    return { personaPubkey: p.publicKeyHex, ts, personaSig: Buffer.from(sig).toString('hex'), ...extra };
  }

  async function mint(url: string, body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await fetch(`${url}/api/entitlements/meerkat-app-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> };
  }

  async function appWithPurchaseAndLink(code = 'link-1'): Promise<MemoryAppStore> {
    const app = new MemoryAppStore();
    await app.upsertAppPurchase({
      subjectId: 'alice', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(), isActive: true,
    });
    await app.createLink({
      code, subjectId: 'alice', createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(), consumedAt: null,
    });
    return app;
  }

  it('mints a persona-bound proof via a single-use link code + persona proof-of-possession (no device credential)', async () => {
    const app = await appWithPurchaseAndLink();
    const personaA = makePersona();
    const { url } = await startApi(app, new FakeBilling(), { appUnlockTokenSecret: TOKEN_SECRET });
    const { status, body } = await mint(url, proofBody(personaA, { link: 'link-1' }));
    expect(status).toBe(200);
    const check = await verifyMeerkatAppUnlockToken(body.token as string, TOKEN_SECRET, {
      nowMs: NOW, requireBinding: true, expectedBindingHash: personaHashOf(personaA),
    });
    expect(check.ok).toBe(true);
    // Not against a different secret, not for a different persona.
    expect((await verifyMeerkatAppUnlockToken(body.token as string, 'other-secret', { nowMs: NOW })).ok).toBe(false);
    expect((await verifyMeerkatAppUnlockToken(body.token as string, TOKEN_SECRET, {
      nowMs: NOW, requireBinding: true, expectedBindingHash: 'cd'.repeat(32),
    })).ok).toBe(false);
    // Re-mint (proof refresh) works with the persona proof ALONE (reverse lookup).
    const refresh = await mint(url, proofBody(personaA));
    expect(refresh.status).toBe(200);
  });

  it('ONE purchase, ONE persona: a second persona on the same purchase is 409 (no unlock reselling)', async () => {
    const app = await appWithPurchaseAndLink('link-1');
    await app.createLink({
      code: 'link-2', subjectId: 'alice', createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(), consumedAt: null,
    });
    const personaA = makePersona();
    const personaB = makePersona();
    const { url } = await startApi(app, new FakeBilling(), { appUnlockTokenSecret: TOKEN_SECRET });
    expect((await mint(url, proofBody(personaA, { link: 'link-1' }))).status).toBe(200);
    const second = await mint(url, proofBody(personaB, { link: 'link-2' }));
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('purchase_already_bound');
  });

  it('rejects a mint WITHOUT persona proof-of-possession: forged sig, someone else\'s persona, stale ts', async () => {
    const app = await appWithPurchaseAndLink();
    const personaA = makePersona();
    const personaB = makePersona();
    const { url } = await startApi(app, new FakeBilling(), { appUnlockTokenSecret: TOKEN_SECRET });
    // Claiming persona B while signing with persona A's key: 401.
    const forged = proofBody(personaA, { link: 'link-1' });
    forged.personaPubkey = personaB.publicKeyHex;
    expect((await mint(url, forged)).status).toBe(401);
    // Missing fields: 400.
    expect((await mint(url, { link: 'link-1' })).status).toBe(400);
    // Stale ts outside the 5-minute window: 401.
    const stale = proofBody(personaA, { link: 'link-1' }, new Date(NOW - 10 * 60_000).toISOString());
    expect((await mint(url, stale)).status).toBe(401);
  });

  it('402 with no/consumed link and no prior binding; refund kills re-mints; single-use link', async () => {
    const app = await appWithPurchaseAndLink();
    const personaA = makePersona();
    const personaB = makePersona();
    const { url } = await startApi(app, new FakeBilling(), { appUnlockTokenSecret: TOKEN_SECRET });
    // No link, never bound: 402.
    expect((await mint(url, proofBody(personaB))).status).toBe(402);
    // Bind persona A.
    expect((await mint(url, proofBody(personaA, { link: 'link-1' }))).status).toBe(200);
    // The link is single-use: replaying it (even for the same persona) is 402.
    expect((await mint(url, proofBody(personaA, { link: 'link-1' }))).status).toBe(402);
    // Refund: re-mint by reverse lookup now fails.
    await app.upsertAppPurchase({
      subjectId: 'alice', productId: MEERKAT_APP_UNLOCK_PRODUCT.id, rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(), isActive: false,
    });
    expect((await mint(url, proofBody(personaA))).status).toBe(402);
  });

  it('501 when no signing secret is configured (fail-closed)', async () => {
    const app = await appWithPurchaseAndLink();
    const personaA = makePersona();
    const withoutSecret = await startApi(app, new FakeBilling());
    expect((await mint(withoutSecret.url, proofBody(personaA, { link: 'link-1' }))).status).toBe(501);
  });
});
