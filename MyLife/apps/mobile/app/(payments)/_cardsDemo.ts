import type {
  PaymentsCardRecord,
  PaymentsCardTransaction,
} from '@mylife/payments';

export const DEMO_CARD: PaymentsCardRecord = {
  cardId: 'card_virtual_001',
  form: 'virtual',
  status: 'active',
  maskedLabel: 'Virtual card ending 4242',
  holderName: 'Trey Example',
  spendLimitCents: 50_000,
  currency: 'USD',
  physicalOrderStatus: 'not_ordered',
  provisioningProviders: ['apple_pay', 'google_pay'],
};

export const DEMO_CARD_TRANSACTIONS: PaymentsCardTransaction[] = [
  {
    transactionId: 'card_txn_market',
    cardId: DEMO_CARD.cardId,
    merchantName: 'Westside Market',
    merchantCategoryCode: '5411',
    amountCents: 3_280,
    currency: 'USD',
    status: 'completed',
    authorizedAt: '2026-04-24T13:10:00.000Z',
    postedAt: '2026-04-24T13:11:00.000Z',
    transferId: 'transfer_card_market',
  },
  {
    transactionId: 'card_txn_hotel',
    cardId: DEMO_CARD.cardId,
    merchantName: 'Harbor Hotel',
    merchantCategoryCode: '7011',
    amountCents: 18_400,
    currency: 'USD',
    status: 'pending_provider',
    authorizedAt: '2026-04-24T11:10:00.000Z',
    postedAt: null,
    transferId: null,
  },
];
