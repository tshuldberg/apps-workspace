import {
  createStableFingerprint,
} from '../idempotency';
import type {
  CurrencyCode,
} from '../../types';

export interface PaymentsFxRatePoint {
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  rate: string;
  observedAt: string;
  providerReference?: string | null;
}

export interface PaymentsFxConversionPreview {
  previewId: string;
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationAmountCents: number;
  destinationCurrency: CurrencyCode;
  rate: string;
  expiresAt: string;
  spendableImmediately: false;
}

export interface PaymentsFxRateAlert {
  alertId: string;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  thresholdRate: string;
  direction: 'above' | 'below';
  enabled: boolean;
}

export interface PaymentsMultiCurrencyBalance {
  currency: CurrencyCode;
  availableCents: number;
  pendingCents: number;
  spendable: boolean;
}

export function buildPaymentsFxConversionPreview(input: {
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  rate: string;
  expiresAt: string;
}): PaymentsFxConversionPreview {
  const parsedRate = Number.parseFloat(input.rate);
  const destinationAmountCents = Number.isFinite(parsedRate)
    ? Math.round(input.sourceAmountCents * parsedRate)
    : 0;
  const fingerprint = createStableFingerprint(input);

  return {
    previewId: `fx_preview_${fingerprint.length}`,
    sourceAmountCents: input.sourceAmountCents,
    sourceCurrency: input.sourceCurrency,
    destinationAmountCents,
    destinationCurrency: input.destinationCurrency,
    rate: input.rate,
    expiresAt: input.expiresAt,
    spendableImmediately: false,
  };
}

export function buildPaymentsFxRateAlert(input: Omit<PaymentsFxRateAlert, 'alertId'>): PaymentsFxRateAlert {
  return {
    ...input,
    alertId: `fx_alert_${createStableFingerprint(input).length}`,
  };
}

export function filterNonZeroForeignBalances(
  balances: PaymentsMultiCurrencyBalance[],
  primaryCurrency: CurrencyCode,
): PaymentsMultiCurrencyBalance[] {
  return balances.filter((balance) => (
    balance.currency !== primaryCurrency &&
    (balance.availableCents > 0 || balance.pendingCents > 0)
  ));
}
