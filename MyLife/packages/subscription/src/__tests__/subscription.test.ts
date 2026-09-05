import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { RevenueCatSDK, StripeSDK } from '../types';
import { createPaymentService } from '../service';
import {
  initRevenueCat,
  purchaseHubUnlock,
  purchaseStandaloneModule,
  purchaseAnnualUpdate,
  restorePurchases,
  getActivePurchases as rcGetActive,
  hasPurchased,
  onPurchaseUpdated as rcOnUpdated,
} from '../revenuecat';
import {
  initStripe,
  createCheckoutSession,
  purchaseViaStripe,
  handleStripeWebhook,
} from '../stripe';
import {
  initStorageBilling,
  upgradeStorageTier,
  downgradeStorageTier,
  getStorageSubscription,
} from '../storage';
import { resolveEntitlements } from '@mylife/entitlements';
import { PRODUCTS } from '@mylife/billing-config';

// ---------------------------------------------------------------------------
// Mock RevenueCat SDK
// ---------------------------------------------------------------------------

function createMockRevenueCat(): RevenueCatSDK {
  const products: Map<string, { productId: string; purchaseDate: string }> = new Map();
  const listeners: Array<(info: { activeProducts: Array<{ productId: string; purchaseDate: string }> }) => void> = [];

  return {
    configure: vi.fn(),
    purchaseProduct: vi.fn(async (productId: string) => {
      const record = { productId, transactionDate: new Date().toISOString() };
      products.set(productId, { productId, purchaseDate: record.transactionDate });
      const activeProducts = Array.from(products.values());
      for (const listener of listeners) {
        listener({ activeProducts });
      }
      return record;
    }),
    restorePurchases: vi.fn(async () => {
      return Array.from(products.values()).map((p) => ({
        productId: p.productId,
        transactionDate: p.purchaseDate,
      }));
    }),
    getCustomerInfo: vi.fn(async () => ({
      activeProducts: Array.from(products.values()),
    })),
    addPurchaseListener: vi.fn((callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Mock Stripe SDK
// ---------------------------------------------------------------------------

const VALID_WEBHOOK_SECRET = 'whsec_test_secret_123';
const VALID_SIGNATURE = 'valid_test_signature';

function createMockStripe(): StripeSDK {
  const subscriptions: Map<string, {
    subscriptionId: string;
    priceId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    status: string;
  }> = new Map();

  let subCounter = 0;

  return {
    createCheckoutSession: vi.fn(async (params) => ({
      url: `https://checkout.stripe.com/test?product=${params.productId}`,
    })),
    createPortalSession: vi.fn(async () => ({
      url: 'https://billing.stripe.com/test/portal',
    })),
    createSubscription: vi.fn(async (params) => {
      const id = `sub_test_${++subCounter}`;
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);
      const sub = {
        subscriptionId: id,
        priceId: params.priceId,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
        cancelAtPeriodEnd: false,
        status: 'active',
      };
      subscriptions.set(id, sub);
      return {
        subscriptionId: id,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
      };
    }),
    cancelSubscription: vi.fn(async (subscriptionId: string) => {
      const sub = subscriptions.get(subscriptionId);
      if (sub) {
        sub.cancelAtPeriodEnd = true;
      }
    }),
    getSubscription: vi.fn(async (subscriptionId: string) => {
      return subscriptions.get(subscriptionId) ?? null;
    }),
    listActiveSubscriptions: vi.fn(async () => {
      return Array.from(subscriptions.values()).filter((s) => s.status === 'active');
    }),
    constructWebhookEvent: vi.fn((payload: string, signature: string, secret: string) => {
      if (signature !== VALID_SIGNATURE || secret !== VALID_WEBHOOK_SECRET) {
        throw new Error('Webhook signature verification failed.');
      }
      return JSON.parse(payload);
    }),
  };
}

// ---------------------------------------------------------------------------
// RevenueCat purchase tests
// ---------------------------------------------------------------------------

describe('RevenueCat mobile IAP', () => {
  let mockRC: RevenueCatSDK;

  beforeEach(() => {
    mockRC = createMockRevenueCat();
    initRevenueCat(mockRC, 'test_api_key');
  });

  it('configures RevenueCat SDK', () => {
    expect(mockRC.configure).toHaveBeenCalledWith('test_api_key');
  });

  it('purchases hub unlock ($19.99)', async () => {
    const result = await purchaseHubUnlock();
    expect(result.success).toBe(true);
    expect(result.purchase).not.toBeNull();
    expect(result.purchase!.productId).toBe('mylife_hub_unlock');
    expect(result.purchase!.isActive).toBe(true);
    expect(mockRC.purchaseProduct).toHaveBeenCalledWith('mylife_hub_unlock');
  });

  it('purchases standalone module unlock ($4.99)', async () => {
    const result = await purchaseStandaloneModule('books');
    expect(result.success).toBe(true);
    expect(result.purchase!.productId).toBe('mylife_books_unlock');
    expect(mockRC.purchaseProduct).toHaveBeenCalledWith('mylife_books_unlock');
  });

  it('rejects purchase of free module (MyFast)', async () => {
    const result = await purchaseStandaloneModule('fast');
    expect(result.success).toBe(false);
    expect(result.error).toContain('free');
  });

  it('purchases annual update ($9.99/yr)', async () => {
    const result = await purchaseAnnualUpdate();
    expect(result.success).toBe(true);
    expect(result.purchase!.productId).toBe('mylife_annual_update');
  });

  it('restores previous purchases', async () => {
    await purchaseHubUnlock();
    await purchaseStandaloneModule('workouts');

    const restored = await restorePurchases();
    expect(restored).toHaveLength(2);
    const ids = restored.map((p) => p.productId);
    expect(ids).toContain('mylife_hub_unlock');
    expect(ids).toContain('mylife_workouts_unlock');
  });

  it('gets active purchases', async () => {
    await purchaseHubUnlock();
    const active = await rcGetActive();
    expect(active).toHaveLength(1);
    expect(active[0].productId).toBe('mylife_hub_unlock');
  });

  it('checks if product has been purchased', async () => {
    expect(await hasPurchased('mylife_hub_unlock')).toBe(false);
    await purchaseHubUnlock();
    expect(await hasPurchased('mylife_hub_unlock')).toBe(true);
  });

  it('notifies listeners on purchase', async () => {
    const listener = vi.fn();
    const unsub = rcOnUpdated(listener);

    await purchaseHubUnlock();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toHaveLength(1);

    unsub();
    await purchaseStandaloneModule('books');
    expect(listener).toHaveBeenCalledTimes(1); // not called after unsubscribe
  });

  it('handles purchase failure gracefully', async () => {
    const failingRC = createMockRevenueCat();
    (failingRC.purchaseProduct as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('User canceled'),
    );
    initRevenueCat(failingRC, 'test_key');

    const result = await purchaseHubUnlock();
    expect(result.success).toBe(false);
    expect(result.error).toContain('User canceled');
    expect(result.purchase).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Stripe web purchase tests
// ---------------------------------------------------------------------------

describe('Stripe web purchases', () => {
  let mockStripe: StripeSDK;

  beforeEach(() => {
    mockStripe = createMockStripe();
    initStripe(mockStripe, {
      successUrl: '/success',
      cancelUrl: '/cancel',
      webhookSecret: VALID_WEBHOOK_SECRET,
    });
  });

  it('creates checkout session for hub unlock', async () => {
    const session = await createCheckoutSession('mylife_hub_unlock');
    expect(session.url).toContain('mylife_hub_unlock');
    expect(mockStripe.createCheckoutSession).toHaveBeenCalledWith({
      productId: 'mylife_hub_unlock',
      successUrl: '/success',
      cancelUrl: '/cancel',
    });
  });

  it('creates checkout session for standalone module', async () => {
    const session = await createCheckoutSession('mylife_books_unlock');
    expect(session.url).toContain('mylife_books_unlock');
  });

  it('purchases product via Stripe', async () => {
    const result = await purchaseViaStripe('mylife_hub_unlock');
    expect(result.success).toBe(true);
    expect(result.purchase).not.toBeNull();
    expect(result.purchase!.productId).toBe('mylife_hub_unlock');
  });

  it('verifies signature and handles valid webhook payload', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      productId: 'mylife_hub_unlock',
      purchaseDate: '2026-06-01T00:00:00.000Z',
      isActive: true,
    });
    const purchases = await handleStripeWebhook(payload, VALID_SIGNATURE);
    expect(purchases).toHaveLength(1);
    expect(purchases[0].productId).toBe('mylife_hub_unlock');
    expect(purchases[0].isActive).toBe(true);
    expect(mockStripe.constructWebhookEvent).toHaveBeenCalledWith(
      payload,
      VALID_SIGNATURE,
      VALID_WEBHOOK_SECRET,
    );
  });

  it('rejects webhook with invalid signature', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      productId: 'mylife_hub_unlock',
      purchaseDate: '2026-06-01T00:00:00.000Z',
      isActive: true,
    });
    await expect(handleStripeWebhook(payload, 'forged_signature'))
      .rejects.toThrow('Webhook signature verification failed');
  });

  it('rejects webhook when webhook secret is not configured', async () => {
    initStripe(mockStripe, {
      successUrl: '/success',
      cancelUrl: '/cancel',
      // no webhookSecret
    });
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      productId: 'mylife_hub_unlock',
      purchaseDate: '2026-06-01T00:00:00.000Z',
      isActive: true,
    });
    await expect(handleStripeWebhook(payload, VALID_SIGNATURE))
      .rejects.toThrow('Webhook secret not configured');
  });

  it('rejects webhook with malformed JSON payload', async () => {
    await expect(handleStripeWebhook('not-json{{{', VALID_SIGNATURE))
      .rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Storage billing tests
// ---------------------------------------------------------------------------

describe('Stripe storage billing', () => {
  let mockStripe: StripeSDK;

  beforeEach(() => {
    mockStripe = createMockStripe();
    initStorageBilling(mockStripe);
  });

  it('upgrades to starter storage tier', async () => {
    await upgradeStorageTier('starter');
    expect(mockStripe.createSubscription).toHaveBeenCalledWith({
      priceId: 'mylife_storage_starter',
    });
  });

  it('upgrades to power storage tier', async () => {
    await upgradeStorageTier('power');
    expect(mockStripe.createSubscription).toHaveBeenCalledWith({
      priceId: 'mylife_storage_power',
    });
  });

  it('gets active storage subscription', async () => {
    await upgradeStorageTier('starter');
    const sub = await getStorageSubscription();
    expect(sub).not.toBeNull();
    expect(sub!.tier).toBe('starter');
    expect(sub!.productId).toBe('mylife_storage_starter');
    expect(sub!.cancelAtPeriodEnd).toBe(false);
  });

  it('downgrades storage (cancels subscription)', async () => {
    await upgradeStorageTier('power');
    await downgradeStorageTier();

    // After cancel, subscription should have cancelAtPeriodEnd = true
    const sub = await getStorageSubscription();
    expect(sub).not.toBeNull();
    expect(sub!.cancelAtPeriodEnd).toBe(true);
  });

  it('returns null when no storage subscription exists', async () => {
    const sub = await getStorageSubscription();
    expect(sub).toBeNull();
  });

  it('replaces existing subscription on tier upgrade', async () => {
    await upgradeStorageTier('starter');
    await upgradeStorageTier('power');

    // Should have canceled the old one first
    expect(mockStripe.cancelSubscription).toHaveBeenCalled();
    expect(mockStripe.createSubscription).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Cross-platform PaymentService routing
// ---------------------------------------------------------------------------

describe('PaymentService (unified)', () => {
  let mockRC: RevenueCatSDK;
  let mockStripe: StripeSDK;

  beforeEach(() => {
    mockRC = createMockRevenueCat();
    mockStripe = createMockStripe();
  });

  it('routes mobile purchases to RevenueCat', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    const result = await service.purchase('mylife_hub_unlock');
    expect(result.success).toBe(true);
    expect(mockRC.purchaseProduct).toHaveBeenCalledWith('mylife_hub_unlock');
    expect(mockStripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('routes web purchases to Stripe', async () => {
    const service = createPaymentService({
      platform: 'web',
      stripeSdk: mockStripe,
    });

    const result = await service.purchase('mylife_hub_unlock');
    expect(result.success).toBe(true);
    expect(mockStripe.createCheckoutSession).toHaveBeenCalled();
  });

  it('routes mobile standalone module purchase to RevenueCat', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    const result = await service.purchase('mylife_books_unlock');
    expect(result.success).toBe(true);
    expect(mockRC.purchaseProduct).toHaveBeenCalledWith('mylife_books_unlock');
  });

  it('routes mobile annual update to RevenueCat', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    const result = await service.purchase('mylife_annual_update');
    expect(result.success).toBe(true);
    expect(mockRC.purchaseProduct).toHaveBeenCalledWith('mylife_annual_update');
  });

  it('rejects storage tier purchase via purchase() on mobile', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    const result = await service.purchase('mylife_storage_starter');
    expect(result.success).toBe(false);
    expect(result.error).toContain('upgradeStorage');
  });

  it('storage operations always use Stripe', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    await service.upgradeStorage('starter');
    expect(mockStripe.createSubscription).toHaveBeenCalledWith({
      priceId: 'mylife_storage_starter',
    });
  });

  it('mobile restore calls RevenueCat', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    // Make a purchase first
    await service.purchase('mylife_hub_unlock');
    const restored = await service.restore();
    expect(restored).toHaveLength(1);
    expect(mockRC.restorePurchases).toHaveBeenCalled();
  });

  it('web restore calls purchase store', async () => {
    const storePurchases = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const service = createPaymentService({
      platform: 'web',
      stripeSdk: mockStripe,
      purchaseStore: async () => storePurchases,
    });

    const restored = await service.restore();
    expect(restored).toEqual(storePurchases);
  });

  it('getActivePurchases routes by platform', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    await service.purchase('mylife_hub_unlock');
    const active = await service.getActivePurchases();
    expect(active).toHaveLength(1);
    expect(mockRC.getCustomerInfo).toHaveBeenCalled();
  });

  it('onPurchaseUpdated subscribes on mobile via RevenueCat', async () => {
    const service = createPaymentService({
      platform: 'mobile',
      revenueCatSdk: mockRC,
      revenueCatApiKey: 'test_rc_key',
      stripeSdk: mockStripe,
    });

    const callback = vi.fn();
    const unsub = service.onPurchaseUpdated(callback);
    expect(mockRC.addPurchaseListener).toHaveBeenCalled();
    unsub();
  });
});

// ---------------------------------------------------------------------------
// Purchase -> entitlement resolution integration
// ---------------------------------------------------------------------------

describe('purchase -> entitlement integration', () => {
  let mockRC: RevenueCatSDK;

  beforeEach(() => {
    mockRC = createMockRevenueCat();
    initRevenueCat(mockRC, 'test_key');
  });

  it('hub unlock resolves to hubUnlocked entitlement', async () => {
    await purchaseHubUnlock();
    const purchases = await rcGetActive();
    const state = resolveEntitlements(purchases);
    expect(state.hubUnlocked).toBe(true);
  });

  it('standalone module unlock resolves to module entitlement', async () => {
    await purchaseStandaloneModule('workouts');
    const purchases = await rcGetActive();
    const state = resolveEntitlements(purchases);
    expect(state.unlockedModules.has('workouts')).toBe(true);
    expect(state.hubUnlocked).toBe(false);
  });

  it('annual update resolves to updateEntitled', async () => {
    await purchaseAnnualUpdate();
    const purchases = await rcGetActive();
    const state = resolveEntitlements(purchases);
    expect(state.updateEntitled).toBe(true);
  });

  it('multiple purchases resolve correctly together', async () => {
    await purchaseHubUnlock();
    await purchaseStandaloneModule('books');
    await purchaseAnnualUpdate();

    const purchases = await rcGetActive();
    const state = resolveEntitlements(purchases);
    expect(state.hubUnlocked).toBe(true);
    expect(state.unlockedModules.has('books')).toBe(true);
    expect(state.updateEntitled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Restore purchases flow
// ---------------------------------------------------------------------------

describe('restore purchases flow', () => {
  let mockRC: RevenueCatSDK;

  beforeEach(() => {
    mockRC = createMockRevenueCat();
    initRevenueCat(mockRC, 'test_key');
  });

  it('restores and resolves entitlements end-to-end', async () => {
    // Simulate purchases that already exist
    await purchaseHubUnlock();
    await purchaseStandaloneModule('workouts');

    // Now "restore" them
    const restored = await restorePurchases();
    expect(restored).toHaveLength(2);

    // Resolve entitlements from restored purchases
    const state = resolveEntitlements(restored);
    expect(state.hubUnlocked).toBe(true);
    expect(state.unlockedModules.has('workouts')).toBe(true);
  });
});
