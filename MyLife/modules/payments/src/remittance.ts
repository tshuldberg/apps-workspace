import {
  buildPaymentsRemittanceQuotePayload,
} from './compliance/disclosures/remittance';
import type {
  BuildPaymentsRemittanceQuoteDisclosureInput,
  PaymentsRemittanceQuotePayload,
} from './compliance/disclosures/types';
import {
  createPaymentsDisclosureCallout,
  formatPaymentsMoney,
} from './compliance/disclosures/content';
import type {
  CurrencyCode,
  PaymentDisclosure,
  PaymentTimelineStep,
} from './types';

export type PaymentsRemittanceQuoteState =
  | 'ready'
  | 'stale'
  | 'unsupported_corridor'
  | 'provider_timeout';

export type PaymentsRemittanceTrackingStatus =
  | 'quoted'
  | 'locked'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'refunded'
  | 'canceled';

export interface PaymentsRemittanceRecipientProfile {
  recipientId: string;
  displayName: string;
  countryCode: string;
  payoutMethod: 'bank' | 'wallet' | 'mobile_money' | 'cash_pickup';
  favorite: boolean;
  sanctionsScreenedAt: string | null;
}

export interface PaymentsRemittanceQuoteViewModel {
  state: PaymentsRemittanceQuoteState;
  corridor: string;
  recipientMethodLabel: string;
  senderAmountLabel: string;
  feeLabel: string;
  exchangeRate: string;
  recipientAmountLabel: string;
  etaLabel: string;
  reQuoteRequired: boolean;
  disclosure: PaymentDisclosure;
  quotePayload: PaymentsRemittanceQuotePayload | null;
}

export interface PaymentsRemittanceTrackingViewModel {
  remittanceId: string;
  recipient: PaymentsRemittanceRecipientProfile;
  status: PaymentsRemittanceTrackingStatus;
  headline: string;
  timeline: PaymentTimelineStep[];
  disclosure: PaymentDisclosure;
  reusedTransactionShell: true;
}

function methodLabel(method: PaymentsRemittanceRecipientProfile['payoutMethod']): string {
  switch (method) {
    case 'bank':
      return 'Bank deposit';
    case 'wallet':
      return 'Partner wallet';
    case 'mobile_money':
      return 'Mobile money';
    case 'cash_pickup':
      return 'Cash pickup';
  }
}

export function buildPaymentsInternationalQuoteViewModel(input: {
  quote: BuildPaymentsRemittanceQuoteDisclosureInput;
  recipient: PaymentsRemittanceRecipientProfile;
  state?: PaymentsRemittanceQuoteState;
}): PaymentsRemittanceQuoteViewModel {
  const state = input.state ?? 'ready';
  const payload = state === 'ready'
    ? buildPaymentsRemittanceQuotePayload(input.quote)
    : null;

  return {
    state,
    corridor: input.quote.corridor,
    recipientMethodLabel: methodLabel(input.recipient.payoutMethod),
    senderAmountLabel: formatPaymentsMoney(
      input.quote.sourceAmountCents,
      input.quote.sourceCurrency,
      input.quote.locale,
    ),
    feeLabel: formatPaymentsMoney(input.quote.feeCents, input.quote.sourceCurrency, input.quote.locale),
    exchangeRate: `1 ${input.quote.sourceCurrency} = ${input.quote.exchangeRate} ${input.quote.destinationCurrency}`,
    recipientAmountLabel: formatPaymentsMoney(
      input.quote.destinationAmountCents,
      input.quote.destinationCurrency,
      input.quote.locale,
    ),
    etaLabel: input.quote.deliveryEstimate?.label ?? 'Provider estimate pending',
    reQuoteRequired: state === 'stale' || state === 'provider_timeout',
    disclosure:
      payload?.disclosureBundle.callouts[0] ??
      createPaymentsDisclosureCallout({
        id: `remittance_quote_${state}`,
        tone: state === 'ready' ? 'info' : 'warning',
        title: state === 'unsupported_corridor' ? 'Corridor unavailable' : 'Quote unavailable',
        body:
          state === 'unsupported_corridor'
            ? 'This corridor is not supported by the current provider set.'
            : 'Refresh the quote before confirming this transfer.',
      }),
    quotePayload: payload,
  };
}

export function buildPaymentsRemittanceTrackingViewModel(input: {
  remittanceId: string;
  recipient: PaymentsRemittanceRecipientProfile;
  status: PaymentsRemittanceTrackingStatus;
  createdAt: string;
  lockedAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
}): PaymentsRemittanceTrackingViewModel {
  const delivered = input.status === 'delivered';
  const failed =
    input.status === 'failed' ||
    input.status === 'refunded' ||
    input.status === 'canceled';

  return {
    remittanceId: input.remittanceId,
    recipient: input.recipient,
    status: input.status,
    headline: delivered
      ? 'Delivered'
      : failed
        ? input.status
        : 'In progress',
    timeline: [
      {
        id: 'created',
        title: 'Quote created',
        detail: 'Fees, rate, recipient amount, and delivery estimate were disclosed.',
        timestamp: input.createdAt,
        state: 'complete',
      },
      {
        id: 'locked',
        title: 'Quote locked',
        detail: 'Provider accepted the quote lock.',
        timestamp: input.lockedAt ?? undefined,
        state: input.lockedAt ? 'complete' : 'current',
      },
      {
        id: 'delivered',
        title: delivered ? 'Delivered' : failed ? 'Closed' : 'Delivery pending',
        detail: input.failureReason ?? 'Provider delivery update has not arrived yet.',
        timestamp: input.deliveredAt ?? undefined,
        state: failed ? 'blocked' : delivered ? 'complete' : 'upcoming',
      },
    ],
    disclosure: createPaymentsDisclosureCallout({
      id: 'remittance_tracking_shell',
      tone: failed ? 'danger' : delivered ? 'success' : 'info',
      title: delivered ? 'Recipient paid out' : failed ? 'Remittance closed' : 'Tracking provider delivery',
      body: input.failureReason ?? 'Tracking explains where the transfer is instead of showing a generic pending label.',
    }),
    reusedTransactionShell: true,
  };
}
