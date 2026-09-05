import { describe, expect, it } from 'vitest';
import { mapCustomerInfoToActiveProducts } from '../(root)/data/revenuecat-mapping';

describe('mapCustomerInfoToActiveProducts', () => {
  it('maps active RevenueCat entitlements', () => {
    const info = {
      entitlements: {
        active: {
          mynews: {
            productIdentifier: 'mylife_mynews_unlock',
            originalPurchaseDate: '2026-07-01T00:00:00.000Z',
            latestPurchaseDate: '2026-07-02T00:00:00.000Z',
          },
        },
      },
      nonSubscriptionTransactions: [],
    };
    expect(mapCustomerInfoToActiveProducts(info as never)).toEqual([
      {
        productId: 'mylife_mynews_unlock',
        purchaseDate: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  it('restores durable one-time transactions even without an active entitlement', () => {
    const info = {
      entitlements: { active: {} },
      nonSubscriptionTransactions: [
        {
          productIdentifier: 'mylife_mynews_unlock',
          purchaseDate: '2026-07-01T00:00:00.000Z',
        },
      ],
    };
    expect(mapCustomerInfoToActiveProducts(info as never)).toEqual([
      {
        productId: 'mylife_mynews_unlock',
        purchaseDate: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  it('deduplicates a product seen through both RevenueCat collections', () => {
    const info = {
      entitlements: {
        active: {
          mynews: {
            productIdentifier: 'mylife_mynews_unlock',
            originalPurchaseDate: '2026-07-01T00:00:00.000Z',
            latestPurchaseDate: '2026-07-02T00:00:00.000Z',
          },
        },
      },
      nonSubscriptionTransactions: [
        {
          productIdentifier: 'mylife_mynews_unlock',
          purchaseDate: '2026-07-03T00:00:00.000Z',
        },
      ],
    };
    expect(mapCustomerInfoToActiveProducts(info as never)).toHaveLength(1);
  });
});

