import { describe, expect, it } from 'vitest';

import type {
  PaymentsTransferRecord,
} from '../../engine/types';
import type {
  PaymentCounterparty,
} from '../../types';
import {
  buildPaymentsActivityFeedViewModel,
  buildPaymentsTransactionDetailViewModel,
} from '../activity';
import type {
  PaymentsActivityFeedSnapshot,
} from '../activity';
import type {
  PaymentsRequestRecord,
} from '../request';

const NOW = '2026-04-24T16:00:00.000Z';
const WALLET_ID = 'wallet_owner';
const OWNER_USER_ID = 'user_owner';

const AVERY: PaymentCounterparty = {
  id: 'user_avery',
  displayName: 'Avery Stone',
  handle: '@avery',
  verification: 'verified',
};

const MARKET: PaymentCounterparty = {
  id: 'merchant_market',
  displayName: 'Westside Market',
  descriptor: 'Merchant',
  verification: 'verified',
};

function makeTransfer(
  overrides: Partial<PaymentsTransferRecord> = {},
): PaymentsTransferRecord {
  return {
    transferId: 'transfer_p2p_1',
    idempotencyKey: 'key_transfer_p2p_1',
    kind: 'p2p',
    status: 'completed',
    sourceWalletId: WALLET_ID,
    destinationWalletId: 'wallet_avery',
    sourceBalanceBucket: 'available',
    destinationBalanceBucket: 'available',
    sourceAmountCents: 2_450,
    sourceCurrency: 'USD',
    destinationAmountCents: 2_450,
    destinationCurrency: 'USD',
    feeAmountCents: 25,
    feeWalletId: WALLET_ID,
    sourceRail: 'wallet',
    destinationRail: 'wallet',
    memo: 'Dinner split',
    externalReference: 'provider_txn_123',
    metadata: {},
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<PaymentsRequestRecord> = {},
): PaymentsRequestRecord {
  return {
    requestId: 'request_coffee_1',
    idempotencyKey: 'key_request_coffee_1',
    status: 'open',
    requesterWalletId: WALLET_ID,
    payerWalletId: 'wallet_avery',
    amountCents: 1_250,
    currency: 'USD',
    expiresAt: '2026-04-25T16:00:00.000Z',
    memo: 'Coffee',
    metadata: {},
    createdAt: '2026-04-24T14:00:00.000Z',
    requesterDisplayName: 'Trey',
    payerDisplayName: 'Avery Stone',
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<PaymentsActivityFeedSnapshot> = {},
): PaymentsActivityFeedSnapshot {
  return {
    ownerUserId: OWNER_USER_ID,
    walletId: WALLET_ID,
    now: NOW,
    locale: 'en-US',
    items: [
      {
        source: 'transfer',
        occurredAt: '2026-04-24T15:00:00.000Z',
        counterparty: AVERY,
        sourceDisplayName: 'Trey',
        destinationDisplayName: 'Avery Stone',
        providerName: 'Unit Test Provider',
        providerReference: 'provider_txn_123',
        transfer: makeTransfer(),
      },
      {
        source: 'transfer',
        occurredAt: '2026-04-24T13:00:00.000Z',
        counterparty: MARKET,
        sourceDisplayName: 'Trey',
        destinationDisplayName: 'Westside Market',
        providerName: 'Card Network',
        providerReference: 'card_auth_123',
        cardTransactionId: 'card_txn_123',
        transfer: makeTransfer({
          transferId: 'transfer_card_1',
          idempotencyKey: 'key_transfer_card_1',
          kind: 'card_capture',
          sourceAmountCents: 3_280,
          destinationAmountCents: 3_280,
          feeAmountCents: 0,
          sourceRail: 'card',
          destinationRail: 'merchant',
          memo: 'Groceries',
          externalReference: 'card_auth_123',
        }),
      },
      {
        source: 'transfer',
        occurredAt: '2026-04-23T20:00:00.000Z',
        counterparty: {
          id: 'beneficiary_1',
          displayName: 'Sam Rivera',
          verification: 'verified',
        },
        sourceDisplayName: 'Trey',
        destinationDisplayName: 'Sam Rivera',
        providerName: 'Remit Partner',
        providerReference: 'remit_123',
        remittance: {
          remittanceId: 'remit_123',
          corridor: 'US-MX',
          recipientName: 'Sam Rivera',
          recipientCountryCode: 'MX',
          payoutMethod: 'Bank deposit',
          exchangeRate: '17.120000',
        },
        transfer: makeTransfer({
          transferId: 'transfer_remittance_1',
          idempotencyKey: 'key_transfer_remittance_1',
          kind: 'remittance_send',
          sourceAmountCents: 10_000,
          destinationAmountCents: 171_200,
          destinationCurrency: 'MXN',
          feeAmountCents: 300,
          sourceRail: 'wallet',
          destinationRail: 'remittance',
          memo: 'Family support',
          externalReference: 'remit_123',
        }),
      },
      {
        source: 'transfer',
        occurredAt: '2026-04-24T12:30:00.000Z',
        counterparty: MARKET,
        sourceDisplayName: 'Trey',
        destinationDisplayName: 'Westside Market',
        transfer: makeTransfer({
          transferId: 'transfer_escrow_1',
          idempotencyKey: 'key_transfer_escrow_1',
          kind: 'escrow_hold',
          status: 'pending_review',
          sourceAmountCents: 5_000,
          destinationAmountCents: 5_000,
          sourceBalanceBucket: 'available',
          destinationBalanceBucket: 'escrow',
          sourceRail: 'wallet',
          destinationRail: 'merchant',
          memo: 'Marketplace hold',
        }),
      },
      {
        source: 'request',
        request: makeRequest(),
        counterparty: AVERY,
      },
    ],
    ...overrides,
  };
}

describe('payments activity feed view model', () => {
  it('groups feed rows and applies mission-control filters', () => {
    const all = buildPaymentsActivityFeedViewModel(makeSnapshot());
    const card = buildPaymentsActivityFeedViewModel(makeSnapshot({ filter: 'card' }));
    const remittance = buildPaymentsActivityFeedViewModel(
      makeSnapshot({ filter: 'remittance' }),
    );
    const pending = buildPaymentsActivityFeedViewModel(makeSnapshot({ filter: 'pending' }));
    const requests = buildPaymentsActivityFeedViewModel(makeSnapshot({ filter: 'requests' }));

    expect(all.rows).toHaveLength(5);
    expect(all.groups.map((group) => group.title)).toEqual(['Today', 'Yesterday']);
    expect(all.filters.find((filter) => filter.id === 'card')?.count).toBe(1);
    expect(card.rows).toHaveLength(1);
    expect(card.rows[0]?.kind).toBe('card_purchase');
    expect(remittance.rows[0]?.railLabel).toBe('Remittance');
    expect(pending.rows.map((row) => row.id).sort()).toEqual([
      'request_coffee_1',
      'transfer_escrow_1',
    ]);
    expect(requests.rows[0]?.source).toBe('request');
  });

  it('builds a consistent transfer detail shell with receipt and issue reporting', () => {
    const detail = buildPaymentsTransactionDetailViewModel(
      makeSnapshot({ selectedActivityId: 'transfer_p2p_1' }),
    );

    expect(detail?.source).toBe('transfer');
    expect(detail?.kind).toBe('wallet_transfer');
    expect(detail?.receipt?.transferId).toBe('transfer_p2p_1');
    expect(detail?.feeBreakdown.map((line) => line.id)).toEqual([
      'amount',
      'fee',
      'total',
    ]);
    expect(detail?.references.some((reference) => (
      reference.id === 'provider_reference' &&
      reference.value === 'provider_txn_123'
    ))).toBe(true);
    expect(detail?.issueEntryPoint.enabled).toBe(true);
    expect(detail?.issueEntryPoint.draft?.transferId).toBe('transfer_p2p_1');
    expect(detail?.legalCopyBlocks.some((block) => (
      block.blockId === 'error_resolution'
    ))).toBe(true);
  });

  it('keeps requests visibly pending until an accepted transfer moves funds', () => {
    const detail = buildPaymentsTransactionDetailViewModel(
      makeSnapshot({ selectedActivityId: 'request_coffee_1' }),
    );

    expect(detail?.source).toBe('request');
    expect(detail?.receipt).toBeNull();
    expect(detail?.requestDetail?.acceptanceCommand).toMatchObject({
      type: 'send',
      sourceWalletId: 'wallet_avery',
      destinationWalletId: WALLET_ID,
      amountCents: 1_250,
    });
    expect(detail?.issueEntryPoint.enabled).toBe(false);
    expect(detail?.issueEntryPoint.reason).toContain('not guaranteed receivables');
    expect(detail?.disclosures.some((disclosure) => (
      disclosure.id === 'activity_request_not_receivable'
    ))).toBe(true);
  });
});
