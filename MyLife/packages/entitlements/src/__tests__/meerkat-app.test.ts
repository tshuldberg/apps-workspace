import { describe, expect, it } from 'vitest';
import {
  MEERKAT_APP_UNLOCK_PRODUCT_ID,
  deriveMeerkatAppUnlock,
} from '../index';
import type { Purchase } from '../types';

function purchase(overrides: Partial<Purchase> & Pick<Purchase, 'productId'>): Purchase {
  return {
    purchaseDate: '2026-07-06T00:00:00.000Z',
    isActive: true,
    ...overrides,
  };
}

describe('deriveMeerkatAppUnlock', () => {
  it('locks the product id to the founder-set one-time unlock SKU', () => {
    expect(MEERKAT_APP_UNLOCK_PRODUCT_ID).toBe('meerkat_app_unlock');
  });

  it('is locked when no purchases are present', () => {
    expect(deriveMeerkatAppUnlock([])).toEqual({ unlocked: false, purchaseDate: null });
  });

  it('unlocks on an active one-time purchase and reports its date', () => {
    const state = deriveMeerkatAppUnlock([
      purchase({ productId: 'meerkat_app_unlock', purchaseDate: '2026-07-06T12:00:00.000Z' }),
    ]);
    expect(state).toEqual({ unlocked: true, purchaseDate: '2026-07-06T12:00:00.000Z' });
  });

  it('fails closed on a refunded/disputed purchase (isActive:false)', () => {
    const state = deriveMeerkatAppUnlock([
      purchase({ productId: 'meerkat_app_unlock', isActive: false }),
    ]);
    expect(state).toEqual({ unlocked: false, purchaseDate: null });
  });

  it('ignores unrelated products (hub, module, hosted subscription)', () => {
    const state = deriveMeerkatAppUnlock([
      purchase({ productId: 'mylife_hub_unlock' }),
      purchase({ productId: 'mylife_recipes_unlock' }),
      purchase({ productId: 'meerkat_hosted_monthly' }),
    ]);
    expect(state).toEqual({ unlocked: false, purchaseDate: null });
  });

  it('reports the EARLIEST active unlock date when several exist (restore/re-buy)', () => {
    const state = deriveMeerkatAppUnlock([
      purchase({ productId: 'meerkat_app_unlock', purchaseDate: '2026-08-01T00:00:00.000Z' }),
      purchase({ productId: 'meerkat_app_unlock', purchaseDate: '2026-07-06T00:00:00.000Z' }),
    ]);
    expect(state).toEqual({ unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' });
  });

  it('is deterministic: same purchases in, same result out', () => {
    const purchases = [purchase({ productId: 'meerkat_app_unlock' })];
    expect(deriveMeerkatAppUnlock(purchases)).toEqual(deriveMeerkatAppUnlock(purchases));
  });
});
