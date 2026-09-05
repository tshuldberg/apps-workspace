import type {
  PaymentsBalanceBucket,
  PaymentsRail,
  PaymentsTransferKind,
} from '../cloud/rpc';
import type { CurrencyCode } from '../types';

export const PAYMENTS_TRANSFER_STATUSES = [
  'pending_review',
  'pending_provider',
  'processing',
  'completed',
  'failed',
  'reversed',
  'canceled',
  'disputed',
] as const;

export type PaymentsTransferStatus =
  (typeof PAYMENTS_TRANSFER_STATUSES)[number];

export type PaymentsPostableTransferStatus = Extract<
  PaymentsTransferStatus,
  'pending_review' | 'pending_provider' | 'processing' | 'completed'
>;

export const PAYMENTS_REQUEST_STATUSES = [
  'open',
  'approved',
  'declined',
  'expired',
  'canceled',
  'paid',
] as const;

export type PaymentsRequestStatus = (typeof PAYMENTS_REQUEST_STATUSES)[number];

export const PAYMENTS_TRANSFER_EVENT_TYPES = [
  'posted',
  'provider_update',
  'failed',
  'canceled',
  'reversed',
  'dispute_opened',
  'dispute_closed',
  'hold_applied',
  'hold_released',
] as const;

export type PaymentsTransferEventType =
  (typeof PAYMENTS_TRANSFER_EVENT_TYPES)[number];

export const PAYMENTS_WALLET_STATUSES = [
  'pending',
  'active',
  'restricted',
  'frozen',
  'closed',
] as const;

export type PaymentsWalletStatus = (typeof PAYMENTS_WALLET_STATUSES)[number];

export const PAYMENTS_COMPLIANCE_HOLD_EFFECTS = [
  'none',
  'send_only',
  'receive_only',
  'freeze',
] as const;

export type PaymentsComplianceHoldEffect =
  (typeof PAYMENTS_COMPLIANCE_HOLD_EFFECTS)[number];

export const PAYMENTS_TRANSFER_SPEEDS = ['standard', 'instant'] as const;
export type PaymentsTransferSpeed = (typeof PAYMENTS_TRANSFER_SPEEDS)[number];

export const PAYMENTS_FEE_PROFILES = [
  'p2p',
  'instant_payout',
  'merchant',
  'card',
  'remittance',
] as const;

export type PaymentsFeeProfile = (typeof PAYMENTS_FEE_PROFILES)[number];

export const PAYMENTS_LEDGER_DIRECTIONS = ['debit', 'credit'] as const;
export type PaymentsLedgerDirection =
  (typeof PAYMENTS_LEDGER_DIRECTIONS)[number];

export const PAYMENTS_LEDGER_KINDS = [
  'principal',
  'fee',
  'reserve',
  'hold',
  'release',
  'reversal',
  'adjustment',
  'fx',
  'chargeback',
] as const;

export type PaymentsLedgerKind = (typeof PAYMENTS_LEDGER_KINDS)[number];

export interface PaymentsWalletSnapshot {
  walletId: string;
  ownerUserId?: string | null;
  status: PaymentsWalletStatus;
  defaultCurrency: CurrencyCode;
  balances: Partial<Record<PaymentsBalanceBucket, number>>;
  complianceHold?: PaymentsComplianceHoldEffect;
  sendLimitRemainingCents?: number | null;
  receiveLimitRemainingCents?: number | null;
}

export interface PaymentsFeeQuote {
  profile: PaymentsFeeProfile;
  rateBasisPoints: number;
  fixedFeeCents: number;
  minimumFeeCents: number;
  maximumFeeCents: number | null;
  feeCents: number;
  totalDebitCents: number;
  destinationAmountCents: number;
  adjusted: boolean;
}

export interface PaymentsLedgerEntry {
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
  direction: PaymentsLedgerDirection;
  entryKind: PaymentsLedgerKind;
  amountCents: number;
  currency: CurrencyCode;
  memo?: string | null;
  metadata: Record<string, unknown>;
}

export interface PaymentsLedgerPlan {
  postingGroupId: string;
  entries: PaymentsLedgerEntry[];
  perCurrencyNet: Record<string, number>;
  balanced: boolean;
}

export interface PaymentsTransferRecord {
  transferId: string;
  idempotencyKey: string;
  kind: PaymentsTransferKind;
  status: PaymentsTransferStatus;
  sourceWalletId: string | null;
  destinationWalletId: string | null;
  sourceBalanceBucket: PaymentsBalanceBucket;
  destinationBalanceBucket: PaymentsBalanceBucket;
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationAmountCents: number | null;
  destinationCurrency: CurrencyCode | null;
  feeAmountCents: number;
  feeWalletId: string | null;
  sourceRail: PaymentsRail;
  destinationRail: PaymentsRail;
  memo?: string | null;
  externalReference?: string | null;
  metadata: Record<string, unknown>;
}

export interface PaymentsPostedTransfer extends PaymentsTransferRecord {
  ledgerPlan: PaymentsLedgerPlan;
}

export interface PaymentsPaymentRequestRecord {
  requestId: string;
  idempotencyKey: string;
  status: PaymentsRequestStatus;
  requesterWalletId: string;
  payerWalletId: string | null;
  amountCents: number;
  currency: CurrencyCode;
  expiresAt: string | null;
  memo?: string | null;
  metadata: Record<string, unknown>;
}

export interface PaymentsCommandBase {
  idempotencyKey: string;
  memo?: string | null;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentsSendCommand extends PaymentsCommandBase {
  type: 'send';
  sourceWalletId: string;
  destinationWalletId: string;
  amountCents: number;
  currency: CurrencyCode;
  desiredStatus?: PaymentsPostableTransferStatus;
  speed?: PaymentsTransferSpeed;
  sourceRail?: PaymentsRail;
  destinationRail?: PaymentsRail;
  feeProfile?: PaymentsFeeProfile;
  feeWalletId?: string | null;
  quoteExpiresAt?: string | null;
  providerDeadlineAt?: string | null;
}

export interface PaymentsRequestCommand extends PaymentsCommandBase {
  type: 'request';
  requestId?: string;
  requesterWalletId: string;
  payerWalletId?: string | null;
  amountCents: number;
  currency: CurrencyCode;
  expiresAt?: string | null;
}

export interface PaymentsFundCommand extends PaymentsCommandBase {
  type: 'fund';
  settlementWalletId: string;
  destinationWalletId: string;
  amountCents: number;
  currency: CurrencyCode;
  desiredStatus?: PaymentsPostableTransferStatus;
  speed?: PaymentsTransferSpeed;
  sourceRail?: Exclude<PaymentsRail, 'wallet'>;
  destinationRail?: 'wallet';
  feeProfile?: PaymentsFeeProfile;
  feeWalletId?: string | null;
  quoteExpiresAt?: string | null;
  providerDeadlineAt?: string | null;
}

export interface PaymentsWithdrawCommand extends PaymentsCommandBase {
  type: 'withdraw';
  sourceWalletId: string;
  settlementWalletId: string;
  amountCents: number;
  currency: CurrencyCode;
  desiredStatus?: PaymentsPostableTransferStatus;
  speed?: PaymentsTransferSpeed;
  sourceRail?: 'wallet';
  destinationRail?: Exclude<PaymentsRail, 'wallet'>;
  feeProfile?: PaymentsFeeProfile;
  feeWalletId?: string | null;
  quoteExpiresAt?: string | null;
  providerDeadlineAt?: string | null;
}

export interface PaymentsReverseTransferCommand extends PaymentsCommandBase {
  type: 'reverse';
  transfer: PaymentsPostedTransfer;
  reason?: string | null;
  operatorUserId?: string | null;
}

export interface PaymentsOpenDisputeCommand extends PaymentsCommandBase {
  type: 'dispute_open';
  transfer: PaymentsTransferRecord;
  reason: string;
}

export interface PaymentsCloseDisputeCommand extends PaymentsCommandBase {
  type: 'dispute_close';
  transfer: PaymentsTransferRecord;
  resolution: 'cleared' | 'reversed';
  reason?: string | null;
}

export type PaymentsCommand =
  | PaymentsSendCommand
  | PaymentsRequestCommand
  | PaymentsFundCommand
  | PaymentsWithdrawCommand
  | PaymentsReverseTransferCommand
  | PaymentsOpenDisputeCommand
  | PaymentsCloseDisputeCommand;

export interface PaymentsExecutionContext {
  wallets: Record<string, PaymentsWalletSnapshot>;
}

export interface PaymentsTransferCommandResult {
  kind: 'transfer';
  replayed: boolean;
  eventType: PaymentsTransferEventType;
  transfer: PaymentsPostedTransfer;
  feeQuote: PaymentsFeeQuote;
  ledgerPlan: PaymentsLedgerPlan;
}

export interface PaymentsRequestCommandResult {
  kind: 'request';
  replayed: boolean;
  request: PaymentsPaymentRequestRecord;
}

export interface PaymentsTransferStatusCommandResult {
  kind: 'transfer_status';
  replayed: boolean;
  eventType: PaymentsTransferEventType;
  transfer: PaymentsTransferRecord;
  note?: string | null;
}

export type PaymentsCommandResult =
  | PaymentsTransferCommandResult
  | PaymentsRequestCommandResult
  | PaymentsTransferStatusCommandResult;

