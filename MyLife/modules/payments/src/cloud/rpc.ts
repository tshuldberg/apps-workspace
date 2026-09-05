import type { CurrencyCode } from '../types';

export type PaymentsBalanceBucket = 'available' | 'pending' | 'reserved' | 'escrow';
export type PaymentsTransferKind =
  | 'p2p'
  | 'request_payment'
  | 'fund_wallet'
  | 'withdraw_wallet'
  | 'merchant_charge'
  | 'merchant_refund'
  | 'card_authorization'
  | 'card_capture'
  | 'card_refund'
  | 'escrow_hold'
  | 'escrow_release'
  | 'remittance_send'
  | 'remittance_refund'
  | 'adjustment'
  | 'reversal';

export type PaymentsTransferWriteStatus =
  | 'pending_review'
  | 'pending_provider'
  | 'processing'
  | 'completed';

export type PaymentsWalletType = 'consumer' | 'merchant' | 'treasury' | 'escrow';
export type PaymentsRail =
  | 'wallet'
  | 'bank'
  | 'card'
  | 'internal'
  | 'remittance'
  | 'ach'
  | 'wire'
  | 'merchant';

export interface CreatePaymentsWalletInput {
  ownerUserId: string;
  walletType?: PaymentsWalletType;
  defaultCurrency?: CurrencyCode;
  countryCode?: string;
  displayName?: string;
  handle?: string;
  metadata?: Record<string, unknown>;
}

export interface PostPaymentsTransferInput {
  idempotencyKey: string;
  kind: PaymentsTransferKind;
  status?: PaymentsTransferWriteStatus;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationAmountCents?: number | null;
  destinationCurrency?: CurrencyCode | null;
  sourceBalanceBucket?: PaymentsBalanceBucket;
  destinationBalanceBucket?: PaymentsBalanceBucket;
  feeAmountCents?: number;
  feeWalletId?: string | null;
  initiatorUserId?: string | null;
  counterpartyUserId?: string | null;
  sourceRail?: PaymentsRail;
  destinationRail?: PaymentsRail;
  paymentRequestId?: string | null;
  quoteId?: string | null;
  providerName?: string | null;
  providerTransferId?: string | null;
  externalReference?: string | null;
  description?: string | null;
  holdExpiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ReversePaymentsTransferInput {
  transferId: string;
  idempotencyKey: string;
  reason?: string | null;
  operatorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordPaymentsProviderEventInput {
  providerName: string;
  providerEventId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  objectType?: string | null;
  objectReference?: string | null;
  ownerUserId?: string | null;
  walletId?: string | null;
  transferId?: string | null;
  remittanceId?: string | null;
  occurredAt?: string | null;
  metadata?: Record<string, unknown>;
}

export const PAYMENTS_WRITE_RPC = {
  createWallet: 'pay_create_wallet',
  postTransfer: 'pay_post_transfer',
  reverseTransfer: 'pay_reverse_transfer',
  recordProviderEvent: 'pay_record_provider_event',
} as const;

export type PaymentsWriteRpcName =
  (typeof PAYMENTS_WRITE_RPC)[keyof typeof PAYMENTS_WRITE_RPC];
