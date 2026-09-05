import type {
  BuildPaymentsRemittanceQuoteDisclosureInput,
  PaymentsRemittanceRecipientProfile,
} from '@mylife/payments';

export const REMITTANCE_RECIPIENT: PaymentsRemittanceRecipientProfile = {
  recipientId: 'recipient_sam',
  displayName: 'Sam Rivera',
  countryCode: 'MX',
  payoutMethod: 'bank',
  favorite: true,
  sanctionsScreenedAt: '2026-04-24T15:30:00.000Z',
};

export const REMITTANCE_QUOTE: BuildPaymentsRemittanceQuoteDisclosureInput = {
  quoteId: 'quote_us_mx_0424',
  providerName: 'Remit Partner',
  corridor: 'US-MX',
  sourceAmountCents: 10_000,
  sourceCurrency: 'USD',
  destinationAmountCents: 171_200,
  destinationCurrency: 'MXN',
  exchangeRate: '17.120000',
  feeCents: 300,
  expiresAt: '2026-04-24T16:05:00.000Z',
  locale: 'en-US',
  generatedAt: '2026-04-24T16:00:00.000Z',
  deliveryEstimate: {
    label: 'Usually by tomorrow',
    estimatedAt: '2026-04-25T18:00:00.000Z',
    earliestAt: '2026-04-25T12:00:00.000Z',
    latestAt: '2026-04-26T00:00:00.000Z',
  },
  corridorAvailability: {
    status: 'available',
    corridor: 'US-MX',
    reason: null,
    availablePayoutMethods: ['bank', 'cash_pickup'],
    checkedAt: '2026-04-24T15:58:00.000Z',
  },
  cancellationWindow: {
    cancelable: true,
    cancelBy: '2026-04-24T18:00:00.000Z',
    reason: 'Cancelable before provider payout completion.',
  },
  recordkeeping: {
    requirement: 'prepared',
    reference: 'record_us_mx_0424',
    originator: {
      fullName: 'Trey Example',
      countryCode: 'US',
      walletHandle: '@trey',
    },
    recipient: {
      fullName: 'Sam Rivera',
      countryCode: 'MX',
      accountReference: 'Bank ending 7712',
    },
    notes: ['Recordkeeping prepared before settlement.'],
  },
  partnerBankName: 'Thread Bank',
  custodialEntityName: 'MyPay Custody Partner',
  supportContact: 'support@mylife.app',
};
