import { describe, expect, it } from 'vitest';

import {
  buildPaymentsInternationalQuoteViewModel,
  buildPaymentsRemittanceTrackingViewModel,
} from '../remittance';

describe('payments remittance helpers', () => {
  it('builds quote and tracking states without exposing crypto terminology', () => {
    const recipient = {
      recipientId: 'recipient_1',
      displayName: 'Sam',
      countryCode: 'MX',
      payoutMethod: 'bank' as const,
      favorite: true,
      sanctionsScreenedAt: null,
    };
    const quote = buildPaymentsInternationalQuoteViewModel({
      recipient,
      quote: {
        providerName: 'Provider',
        corridor: 'US-MX',
        sourceAmountCents: 10000,
        sourceCurrency: 'USD',
        destinationAmountCents: 171200,
        destinationCurrency: 'MXN',
        exchangeRate: '17.120000',
        feeCents: 300,
        expiresAt: '2026-04-24T17:00:00.000Z',
      },
    });
    const tracking = buildPaymentsRemittanceTrackingViewModel({
      remittanceId: 'remit_1',
      recipient,
      status: 'sent',
      createdAt: '2026-04-24T16:00:00.000Z',
    });

    expect(quote.reQuoteRequired).toBe(false);
    expect(JSON.stringify(quote).toLowerCase()).not.toContain('crypto');
    expect(tracking.reusedTransactionShell).toBe(true);
  });
});
