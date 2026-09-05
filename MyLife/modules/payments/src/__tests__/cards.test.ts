import { describe, expect, it } from 'vitest';

import {
  buildPaymentsCardActivityRows,
  buildPaymentsCardManagementViewModel,
  buildPaymentsMerchantQrPayload,
} from '../cards';

describe('payments card helpers', () => {
  it('keeps card data token-first and maps card transactions', () => {
    const card = buildPaymentsCardManagementViewModel({
      card: {
        cardId: 'card_1',
        form: 'virtual',
        status: 'active',
        maskedLabel: 'Virtual card ending 4242',
        holderName: 'Trey',
        spendLimitCents: 50000,
        currency: 'USD',
        physicalOrderStatus: 'not_ordered',
        provisioningProviders: ['apple_pay'],
      },
    });
    const rows = buildPaymentsCardActivityRows({
      transactions: [
        {
          transactionId: 'txn_1',
          cardId: 'card_1',
          merchantName: 'Market',
          merchantCategoryCode: '5411',
          amountCents: 1000,
          currency: 'USD',
          status: 'completed',
          authorizedAt: '2026-04-24T16:00:00.000Z',
          transferId: 'transfer_1',
        },
      ],
    });
    const qr = buildPaymentsMerchantQrPayload({
      mode: 'merchant',
      payeeWalletId: 'merchant_1',
      amountCents: 1000,
      currency: 'USD',
      expiresAt: '2026-04-24T17:00:00.000Z',
      nonce: 'nonce',
    });

    expect(card.sensitiveDataStoredByMyLife).toBe(false);
    expect(rows[0]?.budgetCategory).toBe('Groceries and dining');
    expect(qr.version).toBe(1);
  });
});
