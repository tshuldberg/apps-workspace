import { describe, expect, it } from 'vitest';

import {
  buildPaymentsLegalCopyBlocks,
  buildPaymentsReceiptPayload,
  buildPaymentsRemittanceQuotePayload,
  buildPaymentsTransferDetailPayload,
} from '../index';
import type {
  PaymentsTransferRecord,
} from '../../../engine/types';

function makeTransfer(
  overrides: Partial<PaymentsTransferRecord> = {},
): PaymentsTransferRecord {
  return {
    transferId: 'pay_transfer_1',
    idempotencyKey: 'idemp_1',
    kind: 'p2p',
    status: 'completed',
    sourceWalletId: 'wallet_sender',
    destinationWalletId: 'wallet_receiver',
    sourceBalanceBucket: 'available',
    destinationBalanceBucket: 'available',
    sourceAmountCents: 25_000,
    sourceCurrency: 'USD',
    destinationAmountCents: 25_000,
    destinationCurrency: 'USD',
    feeAmountCents: 0,
    feeWalletId: null,
    sourceRail: 'wallet',
    destinationRail: 'wallet',
    memo: 'Test transfer',
    externalReference: null,
    metadata: {},
    ...overrides,
  };
}

describe('payments disclosures and receipts', () => {
  it('builds a remittance quote payload with reusable legal blocks and rate breakdowns', () => {
    const payload = buildPaymentsRemittanceQuotePayload({
      quoteId: 'quote_1',
      providerName: 'future_remittance_partner',
      corridor: 'US-MX',
      sourceAmountCents: 50_000,
      sourceCurrency: 'USD',
      destinationAmountCents: 9_250_00,
      destinationCurrency: 'MXN',
      exchangeRate: '18.5000',
      feeCents: 499,
      expiresAt: '2026-04-22T18:00:00.000Z',
      corridorAvailability: {
        status: 'limited',
        corridor: 'US-MX',
        reason: 'Cash pickup is unavailable for this quote, but bank payout remains available.',
        availablePayoutMethods: ['bank'],
        checkedAt: '2026-04-22T12:00:00.000Z',
      },
      deliveryEstimate: {
        label: 'Estimated delivery',
        estimatedAt: '2026-04-22T21:00:00.000Z',
        earliestAt: null,
        latestAt: null,
      },
      cancellationWindow: {
        cancelable: true,
        cancelBy: '2026-04-22T17:30:00.000Z',
      },
      recordkeeping: {
        requirement: 'prepared',
        reference: 'travel_rule_case_1',
        originator: {
          fullName: 'Sender Example',
          countryCode: 'US',
        },
        recipient: {
          fullName: 'Recipient Example',
          countryCode: 'MX',
        },
      },
      partnerBankName: 'Thread Bank',
      custodialEntityName: 'Acme Custody',
      supportContact: 'support@mylife.app',
      stablecoinRailEnabled: true,
      generatedAt: '2026-04-22T12:00:00.000Z',
    });

    expect(payload.kind).toBe('remittance_quote');
    expect(payload.breakdown.map((line) => line.label)).toEqual([
      'Sender amount',
      'Fee',
      'Exchange rate',
      'Recipient amount',
      'Total debit',
    ]);
    expect(payload.disclosureBundle.callouts.map((callout) => callout.id)).toEqual(
      expect.arrayContaining([
        'remittance_quote_rate',
        'remittance_quote_corridor',
        'remittance_quote_delivery',
        'remittance_quote_cancellation',
        'remittance_quote_error_resolution',
      ]),
    );
    expect(
      payload.disclosureBundle.legalCopyBlocks.map((block) => block.blockId),
    ).toEqual(
      expect.arrayContaining([
        'stored_balance',
        'partner_bank',
        'custodial_account',
        'remittance_cancellation',
        'error_resolution',
        'stablecoin_rail',
      ]),
    );
    expect(payload.recordkeeping.reference).toBe('travel_rule_case_1');
  });

  it('builds normalized receipt payloads for remittance, refund, and reversal flows', () => {
    const remittanceReceipt = buildPaymentsReceiptPayload({
      transfer: makeTransfer({
        transferId: 'pay_transfer_remit',
        kind: 'remittance_send',
        sourceRail: 'wallet',
        destinationRail: 'remittance',
        destinationAmountCents: 92_500,
        destinationCurrency: 'MXN',
        feeAmountCents: 499,
      }),
      occurredAt: '2026-04-22T12:00:00.000Z',
      quoteId: 'quote_1',
      providerReference: 'provider_remit_1',
      remittance: {
        remittanceId: 'remit_1',
        corridor: 'US-MX',
        recipientName: 'Recipient Example',
        recipientCountryCode: 'MX',
        payoutMethod: 'bank',
        exchangeRate: '18.5000',
        estimatedDeliveryAt: '2026-04-22T21:00:00.000Z',
      },
      stablecoinRailEnabled: true,
    });

    const refundReceipt = buildPaymentsReceiptPayload({
      transfer: makeTransfer({
        transferId: 'pay_transfer_refund',
        kind: 'merchant_refund',
        sourceRail: 'merchant',
        destinationRail: 'wallet',
        status: 'completed',
      }),
      occurredAt: '2026-04-22T12:00:00.000Z',
      counterparty: {
        id: 'merchant_1',
        displayName: 'Sample Merchant',
        descriptor: 'STORE 1234',
        verification: 'verified',
      },
    });

    const reversalReceipt = buildPaymentsReceiptPayload({
      transfer: makeTransfer({
        transferId: 'pay_transfer_reversal',
        kind: 'reversal',
        status: 'reversed',
      }),
      occurredAt: '2026-04-22T12:00:00.000Z',
      relatedTransferId: 'pay_transfer_original',
    });

    expect(remittanceReceipt.receiptKind).toBe('remittance');
    expect(remittanceReceipt.references.map((reference) => reference.key)).toEqual(
      expect.arrayContaining([
        'transfer_id',
        'provider_reference',
        'quote_id',
        'remittance_id',
      ]),
    );
    expect(remittanceReceipt.legalCopyBlocks.map((block) => block.blockId)).toEqual(
      expect.arrayContaining(['partner_bank', 'error_resolution', 'stablecoin_rail']),
    );

    expect(refundReceipt.receiptKind).toBe('refund');
    expect(reversalReceipt.receiptKind).toBe('reversal');
  });

  it('builds transfer detail payloads by rail and status without ad hoc copy', () => {
    const detail = buildPaymentsTransferDetailPayload({
      transfer: makeTransfer({
        transferId: 'pay_transfer_detail',
        kind: 'remittance_send',
        status: 'pending_provider',
        sourceRail: 'wallet',
        destinationRail: 'remittance',
        feeAmountCents: 499,
        destinationAmountCents: 92_500,
        destinationCurrency: 'MXN',
        metadata: {
          risk: {
            userSafeExplanation:
              'This remittance is waiting on a partner confirmation before payout.',
          },
        },
      }),
      occurredAt: '2026-04-22T12:00:00.000Z',
      quoteId: 'quote_detail_1',
      remittance: {
        remittanceId: 'remit_detail_1',
        corridor: 'US-MX',
        recipientName: 'Recipient Example',
        recipientCountryCode: 'MX',
        payoutMethod: 'bank',
        exchangeRate: '18.5000',
      },
      remittanceQuote: {
        quoteId: 'quote_detail_1',
        providerName: 'future_remittance_partner',
        corridor: 'US-MX',
        sourceAmountCents: 50_000,
        sourceCurrency: 'USD',
        destinationAmountCents: 92_500,
        destinationCurrency: 'MXN',
        exchangeRate: '18.5000',
        feeCents: 499,
        expiresAt: '2026-04-22T18:00:00.000Z',
        cancellationWindow: {
          cancelable: true,
          cancelBy: '2026-04-22T17:30:00.000Z',
        },
      },
      stablecoinRailEnabled: true,
    });

    expect(detail.rail).toBe('remittance');
    expect(detail.status).toBe('pending_provider');
    expect(detail.disclosureBundle.callouts.map((callout) => callout.id)).toEqual(
      expect.arrayContaining([
        'transfer_status_pending_provider',
        'remittance_quote_rate',
        'remittance_quote_cancellation',
      ]),
    );
    expect(detail.disclosureBundle.legalCopyBlocks.map((block) => block.blockId)).toEqual(
      expect.arrayContaining([
        'partner_bank',
        'custodial_account',
        'remittance_cancellation',
        'error_resolution',
      ]),
    );
    expect(detail.receipt.receiptKind).toBe('remittance');
  });

  it('builds standalone legal-copy blocks for wallet and card surfaces', () => {
    const blocks = buildPaymentsLegalCopyBlocks({
      blockIds: [
        'stored_balance',
        'partner_bank',
        'custodial_account',
        'debit_card',
      ],
      partnerBankName: 'Thread Bank',
      custodialEntityName: 'Acme Custody',
      cardProgramName: 'MyPay Debit',
    });

    expect(blocks).toHaveLength(4);
    expect(blocks.every((block) => block.version.includes('2026-04-22'))).toBe(
      true,
    );
  });
});
