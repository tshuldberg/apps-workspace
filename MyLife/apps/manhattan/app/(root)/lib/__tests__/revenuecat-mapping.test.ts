import { describe, expect, it } from 'vitest';
import { mapCustomerInfoToActiveProducts } from '../revenuecat-mapping';

describe('mapCustomerInfoToActiveProducts', () => {
  it('maps active entitlements to purchases', () => {
    const info = {
      entitlements: {
        active: {
          manhattan: {
            productIdentifier: 'mylife_manhattan_unlock',
            originalPurchaseDate: '2026-06-01T00:00:00.000Z',
            latestPurchaseDate: '2026-06-02T00:00:00.000Z',
          },
        },
      },
    };

    expect(mapCustomerInfoToActiveProducts(info as never)).toEqual([
      {
        productId: 'mylife_manhattan_unlock',
        purchaseDate: '2026-06-01T00:00:00.000Z',
      },
    ]);
  });

  it('ignores non-subscription transactions that are not active entitlements', () => {
    const info = {
      entitlements: {
        active: {},
      },
      nonSubscriptionTransactions: [
        {
          productIdentifier: 'mylife_manhattan_unlock',
          purchaseDate: '2026-06-01T00:00:00.000Z',
        },
      ],
    };

    expect(mapCustomerInfoToActiveProducts(info as never)).toEqual([]);
  });
});
