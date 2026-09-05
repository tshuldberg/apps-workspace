import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-iap', () => ({
  initConnection: vi.fn(),
  fetchProducts: vi.fn(),
  requestPurchase: vi.fn(),
  purchaseUpdatedListener: vi.fn(),
  purchaseErrorListener: vi.fn(),
  finishTransaction: vi.fn(),
  getAvailablePurchases: vi.fn(),
}));

import {
  YEARN_BOOST_SKU,
  YEARN_MEMBERSHIP_SKU,
  fetchYearnProductPrices,
  purchaseYearnProduct,
  restoreYearnMembershipJws,
  type IapPurchase,
  type IapRuntime,
} from '../iap';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const JWS = 'signed.jws.value';

interface RuntimeOptions {
  connect?: boolean;
  onRequest?: 'purchase' | 'error' | 'cancel' | 'throw' | 'none';
  purchase?: IapPurchase;
  products?: Array<{ id: string; displayPrice: string }>;
  subscriptions?: Array<{ id: string; displayPrice: string }>;
  available?: IapPurchase[];
}

function makeRuntime(options: RuntimeOptions = {}) {
  let purchaseListener: ((purchase: IapPurchase) => void) | null = null;
  let errorListener: ((error: { code?: string; message?: string }) => void) | null = null;

  const runtime: IapRuntime = {
    initConnection: vi.fn().mockResolvedValue(options.connect ?? true),
    fetchProducts: vi.fn().mockImplementation(({ type }: { type: string }) =>
      Promise.resolve(type === 'subs' ? options.subscriptions ?? [] : options.products ?? []),
    ),
    requestPurchase: vi.fn().mockImplementation(() => {
      const mode = options.onRequest ?? 'purchase';
      if (mode === 'throw') return Promise.reject(new Error('store exploded'));
      queueMicrotask(() => {
        if (mode === 'purchase') {
          purchaseListener?.(
            options.purchase ?? { productId: YEARN_BOOST_SKU, purchaseToken: JWS },
          );
        } else if (mode === 'error') {
          errorListener?.({ code: 'purchase-error', message: 'It broke' });
        } else if (mode === 'cancel') {
          errorListener?.({ code: 'user-cancelled', message: 'Cancelled by user' });
        }
      });
      return Promise.resolve();
    }),
    purchaseUpdatedListener: vi.fn().mockImplementation((listener) => {
      purchaseListener = listener;
      return { remove: vi.fn() };
    }),
    purchaseErrorListener: vi.fn().mockImplementation((listener) => {
      errorListener = listener;
      return { remove: vi.fn() };
    }),
    finishTransaction: vi.fn().mockResolvedValue(undefined),
    getAvailablePurchases: vi.fn().mockResolvedValue(options.available ?? []),
  };
  return runtime;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('purchaseYearnProduct', () => {
  it('rejects a non-UUID user before touching the store', async () => {
    const runtime = makeRuntime();
    const result = await purchaseYearnProduct('boost', 'not-a-uuid', runtime);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_user' });
    expect(runtime.requestPurchase).not.toHaveBeenCalled();
  });

  it('fails honestly when the store connection is unavailable', async () => {
    const runtime = makeRuntime({ connect: false });
    const result = await purchaseYearnProduct('boost', USER_ID, runtime);
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(runtime.requestPurchase).not.toHaveBeenCalled();
  });

  it('binds the purchase to the user (lowercased UUID) and resolves with the JWS', async () => {
    const runtime = makeRuntime();
    // Mixed-case letters so a missing toLowerCase() cannot slip through.
    const result = await purchaseYearnProduct(
      'boost',
      'AB111111-1111-4111-8111-11111111111A',
      runtime,
    );
    expect(result).toMatchObject({ ok: true, jws: JWS });
    expect(runtime.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: {
          sku: YEARN_BOOST_SKU,
          quantity: 1,
          appAccountToken: 'ab111111-1111-4111-8111-11111111111a',
        },
      },
      type: 'in-app',
    });
    expect(runtime.finishTransaction).not.toHaveBeenCalled();
  });

  it('purchases the membership as a subscription without quantity', async () => {
    const runtime = makeRuntime({
      purchase: { productId: YEARN_MEMBERSHIP_SKU, purchaseToken: JWS },
    });
    const result = await purchaseYearnProduct('membership', USER_ID, runtime);
    expect(result).toMatchObject({ ok: true, jws: JWS });
    expect(runtime.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: {
          sku: YEARN_MEMBERSHIP_SKU,
          appAccountToken: USER_ID,
        },
      },
      type: 'subs',
    });
  });

  it('reports cancellation silently distinguishable from errors', async () => {
    const runtime = makeRuntime({ onRequest: 'cancel' });
    const result = await purchaseYearnProduct('boost', USER_ID, runtime);
    expect(result).toMatchObject({ ok: false, reason: 'cancelled' });
  });

  it('surfaces store errors', async () => {
    const runtime = makeRuntime({ onRequest: 'error' });
    const result = await purchaseYearnProduct('boost', USER_ID, runtime);
    expect(result).toMatchObject({ ok: false, reason: 'error', error: 'It broke' });
  });

  it('fails when the purchase completes without a signed transaction (never fakes)', async () => {
    const runtime = makeRuntime({
      purchase: { productId: YEARN_BOOST_SKU, purchaseToken: null },
    });
    const result = await purchaseYearnProduct('boost', USER_ID, runtime);
    expect(result).toMatchObject({ ok: false, reason: 'error' });
  });

  it('maps a thrown requestPurchase to an error result', async () => {
    const runtime = makeRuntime({ onRequest: 'throw' });
    const result = await purchaseYearnProduct('boost', USER_ID, runtime);
    expect(result).toMatchObject({ ok: false, reason: 'error', error: 'store exploded' });
  });
});

describe('fetchYearnProductPrices', () => {
  it('returns store-localized prices per product', async () => {
    const runtime = makeRuntime({
      products: [{ id: YEARN_BOOST_SKU, displayPrice: '$1.99' }],
      subscriptions: [{ id: YEARN_MEMBERSHIP_SKU, displayPrice: '$4.99' }],
    });
    await expect(fetchYearnProductPrices(runtime)).resolves.toEqual({
      boost: '$1.99',
      membership: '$4.99',
    });
  });

  it('returns an empty map when the store is unreachable (no hardcoded prices)', async () => {
    const runtime = makeRuntime({ connect: false });
    await expect(fetchYearnProductPrices(runtime)).resolves.toEqual({});
  });
});

describe('restoreYearnMembershipJws', () => {
  it('returns the membership JWS from available purchases', async () => {
    const runtime = makeRuntime({
      available: [
        { productId: YEARN_BOOST_SKU, purchaseToken: 'boost-jws' },
        { productId: YEARN_MEMBERSHIP_SKU, purchaseToken: ` ${JWS} ` },
      ],
    });
    await expect(restoreYearnMembershipJws(runtime)).resolves.toBe(JWS);
  });

  it('returns null when nothing restorable exists', async () => {
    const runtime = makeRuntime({ available: [] });
    await expect(restoreYearnMembershipJws(runtime)).resolves.toBeNull();
  });
});
