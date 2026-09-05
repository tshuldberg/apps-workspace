import { describe, expect, it } from 'vitest';

import {
  buildPaymentsFxConversionPreview,
  buildPaymentsFxRateAlert,
  filterNonZeroForeignBalances,
} from '..';

describe('payments FX index helpers', () => {
  it('keeps conversion previews non-instant and exposes reusable rate alerts', () => {
    const preview = buildPaymentsFxConversionPreview({
      sourceAmountCents: 2_500,
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      rate: '0.9100',
      expiresAt: '2026-04-24T18:00:00.000Z',
    });
    const alert = buildPaymentsFxRateAlert({
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      thresholdRate: '0.9300',
      direction: 'above',
      enabled: true,
    });
    const balances = filterNonZeroForeignBalances(
      [
        { currency: 'USD', availableCents: 10_000, pendingCents: 0, spendable: true },
        { currency: 'EUR', availableCents: 0, pendingCents: 500, spendable: false },
        { currency: 'MXN', availableCents: 0, pendingCents: 0, spendable: false },
      ],
      'USD',
    );

    expect(preview.destinationAmountCents).toBe(2_275);
    expect(preview.spendableImmediately).toBe(false);
    expect(alert.alertId).toMatch(/^fx_alert_/);
    expect(balances).toEqual([
      { currency: 'EUR', availableCents: 0, pendingCents: 500, spendable: false },
    ]);
  });
});
