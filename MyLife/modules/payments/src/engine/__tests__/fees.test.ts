import { describe, expect, it } from 'vitest';

import {
  calculatePaymentsFee,
  resolvePaymentsFeeProfile,
} from '../index';

describe('payments fees', () => {
  it('charges zero for default p2p wallet transfers', () => {
    const quote = calculatePaymentsFee({
      kind: 'p2p',
      amountCents: 2_500,
      sourceRail: 'wallet',
      destinationRail: 'wallet',
    });

    expect(quote.profile).toBe('p2p');
    expect(quote.feeCents).toBe(0);
    expect(quote.totalDebitCents).toBe(2_500);
    expect(quote.adjusted).toBe(false);
  });

  it('applies the instant-payout minimum fee floor', () => {
    const quote = calculatePaymentsFee({
      kind: 'withdraw_wallet',
      amountCents: 1_000,
      sourceRail: 'wallet',
      destinationRail: 'bank',
      speed: 'instant',
    });

    expect(quote.profile).toBe('instant_payout');
    expect(quote.feeCents).toBe(50);
    expect(quote.totalDebitCents).toBe(1_050);
    expect(quote.adjusted).toBe(true);
  });

  it('charges the merchant schedule with basis points plus fixed fee', () => {
    const quote = calculatePaymentsFee({
      kind: 'merchant_charge',
      amountCents: 20_000,
      sourceRail: 'wallet',
      destinationRail: 'merchant',
    });

    expect(resolvePaymentsFeeProfile({
      kind: 'merchant_charge',
      amountCents: 20_000,
      sourceRail: 'wallet',
      destinationRail: 'merchant',
    })).toBe('merchant');
    expect(quote.feeCents).toBe(610);
    expect(quote.totalDebitCents).toBe(20_610);
  });

  it('caps remittance fees at the configured maximum', () => {
    const quote = calculatePaymentsFee({
      kind: 'remittance_send',
      amountCents: 400_000,
      sourceRail: 'wallet',
      destinationRail: 'remittance',
    });

    expect(quote.profile).toBe('remittance');
    expect(quote.feeCents).toBe(2_499);
    expect(quote.totalDebitCents).toBe(402_499);
    expect(quote.adjusted).toBe(true);
  });
});

