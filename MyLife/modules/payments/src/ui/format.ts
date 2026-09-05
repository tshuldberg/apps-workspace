import type { PaymentActivityItem, PaymentAmount, PaymentCounterparty, PaymentDirection } from '../types';

export interface FormatPaymentAmountOptions {
  locale?: string;
  compact?: boolean;
  includeSign?: boolean;
  pending?: boolean;
  currencyDisplay?: 'symbol' | 'code' | 'narrowSymbol';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function toSignedPaymentAmount(amountCents: number, direction: PaymentDirection): number {
  switch (direction) {
    case 'incoming':
      return Math.abs(amountCents);
    case 'outgoing':
      return -Math.abs(amountCents);
    case 'neutral':
      return amountCents;
  }
}

export function formatPaymentAmount(
  amount: PaymentAmount | Pick<PaymentActivityItem, 'amountCents' | 'currency'>,
  options: FormatPaymentAmountOptions & { direction?: PaymentDirection } = {},
): string {
  const {
    locale = 'en-US',
    compact = false,
    includeSign = false,
    pending = false,
    currencyDisplay = 'symbol',
    minimumFractionDigits,
    maximumFractionDigits,
    direction = 'neutral',
  } = options;

  const signedAmount = toSignedPaymentAmount(amount.amountCents, direction) / 100;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    currencyDisplay,
    notation: compact ? 'compact' : 'standard',
    signDisplay: includeSign ? 'always' : 'auto',
    minimumFractionDigits,
    maximumFractionDigits,
  });

  const value = formatter.format(signedAmount);
  return pending ? `Pending ${value}` : value;
}

export function formatPaymentTimestamp(
  isoLike: string,
  locale = 'en-US',
): string {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    return isoLike;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatCounterpartyLabel(counterparty?: PaymentCounterparty): string {
  if (!counterparty) return 'Direct transfer';
  if (counterparty.handle) return `${counterparty.displayName} · ${counterparty.handle}`;
  if (counterparty.descriptor) return `${counterparty.displayName} · ${counterparty.descriptor}`;
  return counterparty.displayName;
}
