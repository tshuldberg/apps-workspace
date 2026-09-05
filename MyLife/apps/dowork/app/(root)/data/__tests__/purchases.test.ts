import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeSupabase, type MockConfig, type MockResult } from './_supabase-mock';

// react-native-purchases is native; mock it so purchases.ts stays testable and
// no other module drags the native SDK into the test graph.
const rc = vi.hoisted(() => ({
  configure: vi.fn(),
  setLogLevel: vi.fn(),
  logIn: vi.fn(async () => ({ customerInfo: {}, created: false })),
  setAttributes: vi.fn(async () => {}),
  getProducts: vi.fn(async () => [] as Array<{ identifier: string; priceString: string }>),
  purchaseStoreProduct: vi.fn(async () => ({ customerInfo: {}, productIdentifier: 'x', transaction: {} })),
  restorePurchases: vi.fn(async () => ({ activeSubscriptions: [] as string[] })),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: rc.configure,
    setLogLevel: rc.setLogLevel,
    logIn: rc.logIn,
    setAttributes: rc.setAttributes,
    getProducts: rc.getProducts,
    purchaseStoreProduct: rc.purchaseStoreProduct,
    restorePurchases: rc.restorePurchases,
  },
  LOG_LEVEL: { WARN: 'WARN' },
  PRODUCT_CATEGORY: { SUBSCRIPTION: 'SUBSCRIPTION', NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
}));

import {
  __resetPurchasesStateForTest,
  ensurePurchasesConfigured,
  getProductForTier,
  identifyPurchaser,
  isPurchasesConfigured,
  purchaseTrainerSubscription,
  resolveRevenueCatKey,
  restoreTrainerPurchases,
} from '../purchases';

const RAW_ACTIVE = {
  id: 'sub-1',
  user_id: 'user-1',
  trainer_id: 'trainer-1',
  product_id: 'dowork_trainer_tier_1',
  store: 'app_store',
  status: 'active',
  current_period_end: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

function makeSubsSupabase(responses: MockConfig['responses'] = {}): SupabaseClient {
  const base = makeSupabase({ responses }, { userId: 'user-1' });
  return { ...(base as unknown as Record<string, unknown>) } as unknown as SupabaseClient;
}

const NO_WAIT: MockResult = { data: RAW_ACTIVE, error: null };

beforeEach(() => {
  __resetPurchasesStateForTest();
  vi.clearAllMocks();
  rc.logIn.mockResolvedValue({ customerInfo: {}, created: false });
  rc.setAttributes.mockResolvedValue(undefined);
  rc.getProducts.mockResolvedValue([{ identifier: 'dowork_trainer_tier_1', priceString: '$4.99' }]);
  rc.purchaseStoreProduct.mockResolvedValue({ customerInfo: {}, productIdentifier: 'x', transaction: {} });
  rc.restorePurchases.mockResolvedValue({ activeSubscriptions: [] });
  vi.stubEnv('EXPO_PUBLIC_DOWORK_RC_KEY_IOS', 'appl_testkey');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveRevenueCatKey', () => {
  it('accepts a matching iOS key', () => {
    expect(resolveRevenueCatKey({ EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'appl_abc' }, 'ios')).toEqual({
      ok: true,
      apiKey: 'appl_abc',
    });
  });

  it('accepts a matching Android key', () => {
    expect(resolveRevenueCatKey({ EXPO_PUBLIC_DOWORK_RC_KEY_ANDROID: 'goog_abc' }, 'android')).toEqual({
      ok: true,
      apiKey: 'goog_abc',
    });
  });

  it('reports a missing key as an honest unavailable, not a crash', () => {
    const result = resolveRevenueCatKey({}, 'ios');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not available/i);
  });

  it('rejects a wrong-store prefix', () => {
    const result = resolveRevenueCatKey({ EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'goog_abc' }, 'ios');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expected a appl_/i);
  });
});

describe('ensurePurchasesConfigured', () => {
  it('configures once with a valid key', () => {
    const first = ensurePurchasesConfigured({ EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'appl_x' }, 'ios');
    expect(first).toEqual({ configured: true, reason: null });
    expect(isPurchasesConfigured()).toBe(true);
    const second = ensurePurchasesConfigured({ EXPO_PUBLIC_DOWORK_RC_KEY_IOS: 'appl_x' }, 'ios');
    expect(second.configured).toBe(true);
    expect(rc.configure).toHaveBeenCalledTimes(1);
  });

  it('stays unconfigured with an honest reason when no key is set', () => {
    const result = ensurePurchasesConfigured({}, 'ios');
    expect(result.configured).toBe(false);
    expect(result.reason).toMatch(/not available/i);
    expect(rc.configure).not.toHaveBeenCalled();
  });
});

describe('identifyPurchaser', () => {
  it('logs in with the Supabase user id and is idempotent', async () => {
    const first = await identifyPurchaser('user-1');
    expect(first).toEqual({ ok: true, userId: 'user-1' });
    expect(rc.logIn).toHaveBeenCalledWith('user-1');
    await identifyPurchaser('user-1');
    expect(rc.logIn).toHaveBeenCalledTimes(1);
  });

  it('requires a user id', async () => {
    const result = await identifyPurchaser('');
    expect(result.ok).toBe(false);
  });
});

describe('getProductForTier', () => {
  it('maps a tier to its store product', async () => {
    const result = await getProductForTier(1);
    expect(rc.getProducts).toHaveBeenCalledWith(['dowork_trainer_tier_1'], 'SUBSCRIPTION');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.productId).toBe('dowork_trainer_tier_1');
      expect(result.product.priceString).toBe('$4.99');
    }
  });

  it('is an honest error when the store has no such product', async () => {
    rc.getProducts.mockResolvedValueOnce([]);
    const result = await getProductForTier(1);
    expect(result.ok).toBe(false);
  });

  it('is an honest error when the store product carries no localized price', async () => {
    // Never fall back to the hardcoded USD tier label: wrong-currency and
    // wrong-price display at the point of purchase.
    rc.getProducts.mockResolvedValueOnce([
      { identifier: 'dowork_trainer_tier_1', priceString: '' },
    ]);
    const result = await getProductForTier(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not available');
  });

  it('is unavailable when purchases are not configured', async () => {
    vi.unstubAllEnvs();
    const result = await getProductForTier(1);
    expect(result.ok).toBe(false);
  });
});

describe('purchaseTrainerSubscription', () => {
  const baseParams = (supabase: SupabaseClient) => ({
    supabase,
    userId: 'user-1',
    trainerId: 'trainer-1',
    priceTier: 1,
  });

  it('sets the trainer_id attribute BEFORE purchasing and confirms server-side', async () => {
    const supabase = makeSubsSupabase({ 'dw_trainer_subscriptions:select': NO_WAIT });
    const outcome = await purchaseTrainerSubscription(baseParams(supabase), {
      now: () => 0,
      sleep: async () => {},
    });

    expect(rc.logIn).toHaveBeenCalledWith('user-1');
    expect(rc.setAttributes).toHaveBeenCalledWith({ trainer_id: 'trainer-1' });
    // Attribute must be set before the purchase call (webhook contract).
    expect(rc.setAttributes.mock.invocationCallOrder[0]).toBeLessThan(
      rc.purchaseStoreProduct.mock.invocationCallOrder[0],
    );
    expect(outcome).toMatchObject({ ok: true, confirmed: true });
    if (outcome.ok && outcome.confirmed) {
      expect(outcome.subscription.trainerId).toBe('trainer-1');
    }
  });

  it('returns a pending (confirmed:false) outcome when the server row has not landed', async () => {
    const supabase = makeSubsSupabase({
      'dw_trainer_subscriptions:select': { data: null, error: null },
    });
    let clock = 0;
    const outcome = await purchaseTrainerSubscription(baseParams(supabase), {
      timeoutMs: 1_000,
      now: () => clock,
      sleep: async () => { clock += 2_000; },
    });
    expect(outcome).toEqual({ ok: true, confirmed: false });
  });

  it('treats a user cancellation as a soft dismissal, not an error', async () => {
    rc.purchaseStoreProduct.mockRejectedValueOnce({ userCancelled: true });
    const supabase = makeSubsSupabase();
    const outcome = await purchaseTrainerSubscription(baseParams(supabase));
    expect(outcome).toEqual({ ok: false, cancelled: true });
  });

  it('surfaces a real purchase error', async () => {
    rc.purchaseStoreProduct.mockRejectedValueOnce(new Error('store down'));
    const supabase = makeSubsSupabase();
    const outcome = await purchaseTrainerSubscription(baseParams(supabase));
    expect(outcome).toEqual({ ok: false, error: 'store down' });
    // Never confirms without the server row.
    expect('confirmed' in outcome).toBe(false);
  });

  it('never purchases when RevenueCat is not configured', async () => {
    vi.unstubAllEnvs();
    const supabase = makeSubsSupabase();
    const outcome = await purchaseTrainerSubscription(baseParams(supabase));
    expect(outcome.ok).toBe(false);
    expect(rc.purchaseStoreProduct).not.toHaveBeenCalled();
  });
});

describe('restoreTrainerPurchases', () => {
  it('returns the active product ids RevenueCat reports', async () => {
    rc.restorePurchases.mockResolvedValueOnce({ activeSubscriptions: ['dowork_trainer_tier_1'] });
    const result = await restoreTrainerPurchases('user-1');
    expect(result).toEqual({ ok: true, restoredProductIds: ['dowork_trainer_tier_1'] });
  });

  it('is an honest error when not configured', async () => {
    vi.unstubAllEnvs();
    const result = await restoreTrainerPurchases('user-1');
    expect(result.ok).toBe(false);
    expect(rc.restorePurchases).not.toHaveBeenCalled();
  });

  it('surfaces a restore failure', async () => {
    rc.restorePurchases.mockRejectedValueOnce(new Error('no network'));
    const result = await restoreTrainerPurchases('user-1');
    expect(result).toEqual({ ok: false, error: 'no network' });
  });
});
