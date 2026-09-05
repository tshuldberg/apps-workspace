import type {
  PaymentsTransferKind,
} from '../cloud/rpc';
import type {
  PaymentsRequestCommand,
  PaymentsTransferStatus,
} from '../engine/types';
import type {
  CurrencyCode,
} from '../types';

export type PaymentsProjectionEventType =
  | 'completed'
  | 'reversed'
  | 'failed'
  | 'pending';

export interface PaymentsProjectionEvent {
  eventId: string;
  transferId: string;
  eventType: PaymentsProjectionEventType;
  transferKind: PaymentsTransferKind;
  status: PaymentsTransferStatus;
  amountCents: number;
  feeCents: number;
  currency: CurrencyCode;
  occurredAt: string;
  direction: 'incoming' | 'outgoing' | 'neutral';
  counterpartyLabel: string | null;
  note?: string | null;
  deepLink: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentsProjectionSourceBadge {
  label: 'MyPay';
  detail: string;
  deepLink: string;
}

export interface PaymentsContextualRequestDraft {
  idempotencyKey: string;
  contextId: string;
  payerWalletId: string | null;
  payerLabel: string;
  amountCents: number;
  currency: CurrencyCode;
  memo: string;
  command: PaymentsRequestCommand;
}
