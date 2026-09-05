import type { CurrencyCode, PaymentStatus } from '../types';

export const PAYMENTS_PROVIDER_PROFILES = [
  'fake',
  'unit',
  'stripe_treasury',
  'synctera',
] as const;

export type PaymentsProviderProfile =
  (typeof PAYMENTS_PROVIDER_PROFILES)[number];

export const PAYMENTS_PROVIDER_BUNDLE_KINDS = [
  'fake',
  'sandbox',
  'live',
] as const;

export type PaymentsProviderBundleKind =
  (typeof PAYMENTS_PROVIDER_BUNDLE_KINDS)[number];

export const PAYMENTS_PROVIDER_FAILURE_CODES = [
  'provider_timeout',
  'temporarily_unavailable',
  'invalid_account',
  'account_not_linked',
  'insufficient_funds',
  'compliance_hold',
  'risk_review',
  'duplicate_event',
  'webhook_signature_invalid',
  'notification_rejected',
  'not_supported',
  'not_configured',
] as const;

export type PaymentsProviderFailureCode =
  (typeof PAYMENTS_PROVIDER_FAILURE_CODES)[number];

export type PaymentsWebhookSource =
  | PaymentsProviderProfile
  | 'future_remittance_partner';

export type PaymentsRemittanceProviderName =
  | 'fake'
  | 'sandbox'
  | 'future_remittance_partner';

export type PaymentsNotificationProviderName =
  | 'fake'
  | 'sandbox'
  | 'noop';

export interface PaymentsProviderContext {
  actorUserId: string;
  requestId: string;
  now: () => Date;
}

export interface PaymentsProviderSuccess<TData> {
  ok: true;
  providerName: string;
  data: TData;
}

export interface PaymentsProviderFailure {
  ok: false;
  providerName: string;
  code: PaymentsProviderFailureCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type PaymentsProviderResult<TData> =
  | PaymentsProviderSuccess<TData>
  | PaymentsProviderFailure;

export interface DomesticTransferRequest {
  ledgerTransactionId: string;
  transferType:
    | 'wallet_to_wallet'
    | 'ach_debit'
    | 'ach_credit'
    | 'payout';
  amountCents: number;
  currency: CurrencyCode;
  sourceAccountId: string;
  destinationAccountId: string;
  memo?: string;
  idempotencyKey: string;
}

export interface DomesticTransferResult {
  providerReference: string;
  state:
    | 'pending_provider'
    | 'pending_review'
    | 'processing'
    | 'completed'
    | 'failed';
  submittedAt: string;
  estimatedCompletionAt?: string | null;
}

export interface DomesticPayoutRequest {
  payoutId: string;
  walletId: string;
  externalAccountId: string;
  amountCents: number;
  currency: CurrencyCode;
  speed: 'standard' | 'instant';
  idempotencyKey: string;
  memo?: string;
}

export interface DomesticPayoutResult {
  providerPayoutId: string;
  state:
    | 'pending_provider'
    | 'pending_review'
    | 'processing'
    | 'completed'
    | 'failed';
  submittedAt: string;
  estimatedArrivalAt?: string | null;
}

export interface BankLinkSessionRequest {
  ownerUserId: string;
  redirectUrl?: string;
}

export interface BankLinkSessionResult {
  linkSessionId: string;
  linkToken: string;
  expiresAt: string;
}

export interface FundingIntentRequest {
  walletId: string;
  linkedAccountId: string;
  amountCents: number;
  currency: CurrencyCode;
  idempotencyKey: string;
}

export interface FundingIntentResult {
  providerFundingId: string;
  state:
    | 'pending_provider'
    | 'pending_review'
    | 'processing'
    | 'completed'
    | 'failed';
  submittedAt: string;
  expectedPostAt?: string | null;
}

export interface CardIssuanceRequest {
  walletId: string;
  ownerUserId: string;
  cardholderName: string;
  cardType: 'virtual' | 'physical';
  currency: CurrencyCode;
  spendLimitCents?: number | null;
}

export interface CardIssuanceResult {
  providerCardId: string;
  status: 'pending' | 'active';
  network: string;
  last4: string;
  issuedAt: string;
}

export interface ProviderDisputeRequest {
  ledgerTransactionId: string;
  reason: string;
  description?: string;
}

export interface ProviderDisputeResult {
  disputeReference: string;
  status: 'submitted' | 'review';
  createdAt: string;
}

export interface RemittanceQuoteRequest {
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  corridor: string;
  recipientCountryCode: string;
}

export interface RemittanceQuoteResult {
  quoteId: string;
  exchangeRate: string;
  feeCents: number;
  destinationAmountCents: number;
  expiresAt: string;
}

export interface RemittanceSettlementRequest {
  remittanceId: string;
  quoteId: string;
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationAmountCents: number;
  destinationCurrency: CurrencyCode;
  recipientCountryCode: string;
  idempotencyKey: string;
}

export interface RemittanceSettlementResult {
  providerRemittanceId: string;
  state:
    | 'pending_provider'
    | 'pending_review'
    | 'processing'
    | 'completed'
    | 'failed';
  submittedAt: string;
  expectedPayoutAt?: string | null;
}

export interface NormalizedProviderEvent {
  providerName: PaymentsWebhookSource;
  providerEventId: string;
  eventType: string;
  objectType?: string | null;
  objectReference?: string | null;
  ownerUserId?: string | null;
  walletId?: string | null;
  transferId?: string | null;
  remittanceId?: string | null;
  occurredAt?: string | null;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WebhookVerificationRequest {
  providerName: PaymentsWebhookSource;
  signature?: string | null;
  headers?: Record<string, string | undefined>;
  rawBody: string;
}

export interface WebhookVerificationResult {
  normalizedEvent: NormalizedProviderEvent;
  acceptedAt: string;
}

export interface NotificationDeliveryRequest {
  channel: 'email' | 'push' | 'sms' | 'in_app';
  template:
    | 'transfer_pending'
    | 'transfer_completed'
    | 'transfer_failed'
    | 'card_issued'
    | 'remittance_update'
    | 'compliance_hold';
  recipientUserId: string;
  locale?: string;
  transferId?: string | null;
  remittanceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationDeliveryResult {
  deliveryId: string;
  status: 'queued' | 'sent' | 'suppressed';
  providerReference?: string | null;
  deliveredAt?: string | null;
}

export interface DomesticWalletRail {
  readonly providerName: PaymentsProviderProfile;
  createTransfer(
    request: DomesticTransferRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<DomesticTransferResult>>;
  createPayout(
    request: DomesticPayoutRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<DomesticPayoutResult>>;
}

export interface BankLinkFundingRail {
  readonly providerName: PaymentsProviderProfile;
  createLinkSession(
    request: BankLinkSessionRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<BankLinkSessionResult>>;
  createFundingIntent(
    request: FundingIntentRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<FundingIntentResult>>;
}

export interface CardIssuingRail {
  readonly providerName: PaymentsProviderProfile;
  issueCard(
    request: CardIssuanceRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<CardIssuanceResult>>;
  openDispute(
    request: ProviderDisputeRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<ProviderDisputeResult>>;
}

export interface RemittanceSettlementRail {
  readonly providerName: PaymentsRemittanceProviderName;
  quote(
    request: RemittanceQuoteRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<RemittanceQuoteResult>>;
  settle(
    request: RemittanceSettlementRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
}

export interface WebhookVerificationRail {
  readonly providerName: PaymentsWebhookSource;
  verifyAndNormalize(
    request: WebhookVerificationRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<WebhookVerificationResult>>;
}

export interface NotificationDeliveryHook {
  readonly providerName: PaymentsNotificationProviderName;
  deliver(
    request: NotificationDeliveryRequest,
    context: PaymentsProviderContext,
  ): Promise<PaymentsProviderResult<NotificationDeliveryResult>>;
}

export interface PaymentsProviderBundle {
  kind: PaymentsProviderBundleKind;
  profile: PaymentsProviderProfile;
  domesticWallets: DomesticWalletRail;
  bankLinkFunding: BankLinkFundingRail;
  cardIssuing: CardIssuingRail;
  remittances: RemittanceSettlementRail;
  webhooks: WebhookVerificationRail;
  notifications: NotificationDeliveryHook;
}

export type LegacyProviderTransferStatus = Extract<
  PaymentStatus,
  'pending' | 'posted' | 'held' | 'failed'
>;

