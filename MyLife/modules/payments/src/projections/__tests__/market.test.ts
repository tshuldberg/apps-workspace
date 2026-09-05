import { describe, expect, it } from 'vitest';

import { buildMarketMyPayCheckoutState } from '../market';

describe('payments market projection', () => {
  it('keeps Market financial truth in MyPay escrow state', () => {
    const state = buildMarketMyPayCheckoutState({
      orderId: 'order_1',
      listingId: 'listing_1',
      buyerWalletId: 'wallet_buyer',
      sellerWalletId: 'wallet_seller',
      amountCents: 5000,
      currency: 'USD',
      escrowTransferId: 'escrow_1',
      deepLink: '/payments/escrow_1',
    });

    expect(state.entryPointLabel).toBe('Buy with MyPay');
    expect(state.marketOwnsFinancialTruth).toBe(false);
  });
});
