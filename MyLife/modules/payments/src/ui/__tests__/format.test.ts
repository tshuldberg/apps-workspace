import { describe, expect, it } from 'vitest';
import {
  formatCounterpartyLabel,
  formatPaymentAmount,
  toSignedPaymentAmount,
} from '../format';

describe('payments amount formatting', () => {
  it('applies incoming and outgoing sign conventions centrally', () => {
    expect(toSignedPaymentAmount(1234, 'incoming')).toBe(1234);
    expect(toSignedPaymentAmount(1234, 'outgoing')).toBe(-1234);
    expect(toSignedPaymentAmount(-1234, 'incoming')).toBe(1234);
  });

  it('formats signed currency amounts', () => {
    expect(
      formatPaymentAmount(
        { amountCents: 1234, currency: 'USD' },
        { direction: 'incoming', includeSign: true },
      ),
    ).toBe('+$12.34');

    expect(
      formatPaymentAmount(
        { amountCents: 1234, currency: 'USD' },
        { direction: 'outgoing', includeSign: true },
      ),
    ).toBe('-$12.34');
  });

  it('supports pending and currency-code display', () => {
    expect(
      formatPaymentAmount(
        { amountCents: 2250, currency: 'USD' },
        { direction: 'incoming', includeSign: true, pending: true, currencyDisplay: 'code' },
      ),
    ).toBe('Pending +USD 22.50');
  });

  it('formats counterparty labels with handle fallback', () => {
    expect(
      formatCounterpartyLabel({
        id: 'user_1',
        displayName: 'Jordan Lee',
        handle: '@jordan',
        verification: 'verified',
      }),
    ).toBe('Jordan Lee · @jordan');
  });
});
