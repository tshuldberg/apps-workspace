import { describe, expect, it } from 'vitest';

import {
  buildPaymentsFxConversionPreview,
  filterNonZeroForeignBalances,
} from '..';

describe('payments FX helpers', () => {
  it('previews conversion and filters non-primary balances', () => {
    const preview = buildPaymentsFxConversionPreview({
      sourceAmountCents: 1000,
      sourceCurrency: 'USD',
      destinationCurrency: 'MXN',
      rate: '17.12',
      expiresAt: '2026-04-24T17:00:00.000Z',
    });
    const balances = filterNonZeroForeignBalances(
      [
        { currency: 'USD', availableCents: 1000, pendingCents: 0, spendable: true },
        { currency: 'MXN', availableCents: 0, pendingCents: 1200, spendable: false },
      ],
      'USD',
    );

    expect(preview.destinationAmountCents).toBe(17120);
    expect(preview.spendableImmediately).toBe(false);
    expect(balances).toHaveLength(1);
  });
});
