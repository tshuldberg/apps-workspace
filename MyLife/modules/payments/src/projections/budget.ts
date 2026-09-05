import type {
  PaymentsProjectionEvent,
  PaymentsProjectionSourceBadge,
} from './types';

export type PaymentsBudgetCategory =
  | 'transfer'
  | 'shopping'
  | 'dining_entertainment'
  | 'remittance'
  | 'funding'
  | 'payout'
  | 'card_purchase'
  | 'adjustment';

export interface PaymentsBudgetProjectionRow {
  projectionId: string;
  transferId: string;
  amountCents: number;
  feeCents: number;
  currency: string;
  occurredAt: string;
  category: PaymentsBudgetCategory;
  pending: boolean;
  reversed: boolean;
  failed: boolean;
  merchantOrCounterparty: string | null;
  sourceBadge: PaymentsProjectionSourceBadge;
  recategorizationOwner: 'budget';
}

export function mapPaymentsEventToBudgetCategory(
  event: PaymentsProjectionEvent,
): PaymentsBudgetCategory {
  switch (event.transferKind) {
    case 'card_authorization':
    case 'card_capture':
    case 'card_refund':
      return 'card_purchase';
    case 'merchant_charge':
    case 'merchant_refund':
    case 'escrow_hold':
    case 'escrow_release':
      return 'shopping';
    case 'remittance_send':
    case 'remittance_refund':
      return 'remittance';
    case 'fund_wallet':
      return 'funding';
    case 'withdraw_wallet':
      return 'payout';
    case 'adjustment':
    case 'reversal':
      return 'adjustment';
    case 'p2p':
    case 'request_payment':
      return event.metadata?.context === 'dining' || event.metadata?.context === 'rsvp'
        ? 'dining_entertainment'
        : 'transfer';
  }
}

export function projectMyPayEventToBudget(
  event: PaymentsProjectionEvent,
): PaymentsBudgetProjectionRow | null {
  if (event.eventType !== 'completed' && event.eventType !== 'reversed' && event.eventType !== 'failed') {
    return null;
  }

  return {
    projectionId: `budget:${event.transferId}`,
    transferId: event.transferId,
    amountCents: event.direction === 'outgoing' ? -event.amountCents : event.amountCents,
    feeCents: event.feeCents,
    currency: event.currency,
    occurredAt: event.occurredAt,
    category: mapPaymentsEventToBudgetCategory(event),
    pending: false,
    reversed: event.eventType === 'reversed',
    failed: event.eventType === 'failed',
    merchantOrCounterparty: event.counterpartyLabel,
    sourceBadge: {
      label: 'MyPay',
      detail: event.status,
      deepLink: event.deepLink,
    },
    recategorizationOwner: 'budget',
  };
}
