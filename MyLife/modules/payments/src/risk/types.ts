import type { PaymentsWalletType } from '../cloud/rpc';
import type {
  PaymentsTierAssessment,
} from '../compliance/types';
import type { PaymentsDomainErrorCode } from '../engine/errors';
import type {
  PaymentsComplianceHoldEffect,
  PaymentsFeeQuote,
  PaymentsPostableTransferStatus,
  PaymentsSendCommand,
  PaymentsTransferEventType,
  PaymentsTransferStatus,
  PaymentsWalletSnapshot,
  PaymentsWithdrawCommand,
  PaymentsFundCommand,
} from '../engine/types';

export const PAYMENTS_RISK_PAYMENT_TYPES = [
  'p2p',
  'funding',
  'withdrawal',
  'merchant',
  'remittance',
] as const;

export type PaymentsRiskPaymentType =
  (typeof PAYMENTS_RISK_PAYMENT_TYPES)[number];

export const PAYMENTS_RISK_CATEGORIES = [
  'sanctions',
  'velocity',
  'behavior',
] as const;

export type PaymentsRiskCategory =
  (typeof PAYMENTS_RISK_CATEGORIES)[number];

export const PAYMENTS_RISK_ACTIONS = [
  'approve',
  'hold',
  'reject',
] as const;

export type PaymentsRiskAction = (typeof PAYMENTS_RISK_ACTIONS)[number];

export const PAYMENTS_RISK_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type PaymentsRiskSeverity =
  (typeof PAYMENTS_RISK_SEVERITIES)[number];

export const PAYMENTS_RISK_REASON_CODES = [
  'sanctions.potential_match',
  'sanctions.confirmed_match',
  'sanctions.blocked_country',
  'sanctions.screening_unavailable',
  'velocity.single_limit_exceeded',
  'velocity.rolling_24h_exceeded',
  'velocity.rolling_7d_exceeded',
  'velocity.counterparty_burst',
  'velocity.transaction_count_burst',
  'velocity.review_backlog',
  'behavior.new_device_high_value',
  'behavior.country_mismatch',
  'behavior.password_reset_recent',
  'behavior.repeat_rejections',
] as const;

export type PaymentsRiskReasonCode =
  (typeof PAYMENTS_RISK_REASON_CODES)[number];

export const PAYMENTS_SANCTIONS_SCREENING_STATES = [
  'clear',
  'potential_match',
  'confirmed_match',
  'blocked_country',
  'provider_error',
] as const;

export type PaymentsSanctionsScreeningState =
  (typeof PAYMENTS_SANCTIONS_SCREENING_STATES)[number];

export const PAYMENTS_RISK_PARTY_ROLES = [
  'sender',
  'recipient',
  'merchant',
  'remittance_sender',
  'remittance_recipient',
] as const;

export type PaymentsRiskPartyRole =
  (typeof PAYMENTS_RISK_PARTY_ROLES)[number];

export const PAYMENTS_RISK_CASE_TYPES = [
  'aml_review',
  'ofac_screening',
  'fraud_review',
  'manual_hold',
] as const;

export type PaymentsRiskCaseType =
  (typeof PAYMENTS_RISK_CASE_TYPES)[number];

export const PAYMENTS_RISK_CASE_STATUSES = [
  'open',
  'under_review',
  'awaiting_user',
  'cleared',
  'reported',
  'closed',
] as const;

export type PaymentsRiskCaseStatus =
  (typeof PAYMENTS_RISK_CASE_STATUSES)[number];

export const PAYMENTS_RISK_WORKFLOW_TAGS = [
  'sar_candidate',
  'ofac_screening',
  'manual_hold',
] as const;

export type PaymentsRiskWorkflowTag =
  (typeof PAYMENTS_RISK_WORKFLOW_TAGS)[number];

export interface PaymentsRiskActorProfile {
  ownerUserId: string;
  walletId?: string | null;
  identityId?: string | null;
  countryCode: string;
  walletType?: PaymentsWalletType | null;
  tierAssessment: PaymentsTierAssessment;
}

export interface PaymentsRiskParty {
  partyId: string;
  role: PaymentsRiskPartyRole;
  ownerUserId?: string | null;
  walletId?: string | null;
  identityId?: string | null;
  walletType?: PaymentsWalletType | null;
  displayName?: string | null;
  handle?: string | null;
  countryCode?: string | null;
  screeningState?: PaymentsSanctionsScreeningState;
  screeningReference?: string | null;
  providerReference?: string | null;
  matchedListName?: string | null;
  matchedTerm?: string | null;
}

export interface PaymentsSanctionsWatchlistEntry {
  entryId: string;
  label: string;
  aliases: string[];
  countryCodes?: string[];
}

export interface PaymentsVelocityWindowSnapshot {
  approvedAmountCents: number;
  approvedCount: number;
  distinctCounterpartyCount: number;
  pendingReviewCount: number;
}

export interface PaymentsVelocityHistory {
  rolling24h: PaymentsVelocityWindowSnapshot;
  rolling7d?: PaymentsVelocityWindowSnapshot;
}

export interface PaymentsVelocityPolicy {
  paymentType: PaymentsRiskPaymentType;
  tier: PaymentsTierAssessment['approvedTier'];
  singleMaxCents: number;
  rolling24hMaxCents: number;
  rolling7dMaxCents: number | null;
  count24hMax: number;
  distinctCounterparty24hMax: number;
  pendingReview24hMax: number;
}

export interface PaymentsRiskBehaviorContext {
  trustedDevice?: boolean;
  deviceAgeHours?: number | null;
  accountAgeDays?: number | null;
  newCounterparty?: boolean;
  expectedCountryCode?: string | null;
  sessionCountryCode?: string | null;
  recentPasswordResetHours?: number | null;
  priorRejectedTransfers30d?: number;
}

export interface PaymentsRiskReason {
  code: PaymentsRiskReasonCode;
  category: PaymentsRiskCategory;
  action: Exclude<PaymentsRiskAction, 'approve'>;
  severity: PaymentsRiskSeverity;
  machineExplanation: string;
  userSafeTitle: string;
  userSafeExplanation: string;
  metadata: Record<string, unknown>;
}

export interface PaymentsRiskCaseReference {
  caseId: string;
  caseType: PaymentsRiskCaseType;
  status: PaymentsRiskCaseStatus;
  severity: PaymentsRiskSeverity;
  holdEffect: PaymentsComplianceHoldEffect;
  assignedQueue: string;
  openedReason: string;
  machineReasonCodes: PaymentsRiskReasonCode[];
  userSafeExplanation: string;
  workflowTags: PaymentsRiskWorkflowTag[];
  walletId: string | null;
  transferId: string | null;
  identityIds: string[];
  providerReferences: string[];
  metadata: Record<string, unknown>;
}

export interface PaymentsRiskReviewQueueItem {
  queue: string;
  transferId: string;
  caseIds: string[];
  identityIds: string[];
  providerReferences: string[];
  machineReasonCodes: PaymentsRiskReasonCode[];
  holdEffect: PaymentsComplianceHoldEffect;
  userSafeExplanation: string;
}

export interface PaymentsRiskMetadata {
  outcome: PaymentsRiskAction;
  paymentType: PaymentsRiskPaymentType;
  reviewedTier: PaymentsTierAssessment['approvedTier'];
  machineReasonCodes: PaymentsRiskReasonCode[];
  userSafeExplanation: string | null;
  caseIds: string[];
  workflowTags: PaymentsRiskWorkflowTag[];
}

export interface PaymentsRiskAssessment {
  outcome: PaymentsRiskAction;
  paymentType: PaymentsRiskPaymentType;
  reviewedTier: PaymentsTierAssessment['approvedTier'];
  recommendedTransferStatus: PaymentsTransferStatus | null;
  domainErrorCode: PaymentsDomainErrorCode | null;
  holdEffect: PaymentsComplianceHoldEffect;
  machineReasons: PaymentsRiskReason[];
  userSafeExplanation: string | null;
  caseReferences: PaymentsRiskCaseReference[];
  reviewQueueItem: PaymentsRiskReviewQueueItem | null;
  metadata: PaymentsRiskMetadata;
}

export interface PaymentsTransferRiskInput {
  transferId?: string | null;
  command: PaymentsSendCommand | PaymentsFundCommand | PaymentsWithdrawCommand;
  requestedStatus: PaymentsPostableTransferStatus;
  sourceWallet: PaymentsWalletSnapshot;
  destinationWallet: PaymentsWalletSnapshot;
  feeQuote: PaymentsFeeQuote;
  sourceProfile?: PaymentsRiskActorProfile | null;
  destinationProfile?: PaymentsRiskActorProfile | null;
  merchantProfile?: PaymentsRiskActorProfile | null;
  sanctionsParties?: PaymentsRiskParty[];
  watchlist?: PaymentsSanctionsWatchlistEntry[];
  blockedCountryCodes?: string[];
  velocityHistory?: PaymentsVelocityHistory;
  behaviorContext?: PaymentsRiskBehaviorContext;
  now: Date;
  createId?: (prefix: string) => string;
}

export type PaymentsRiskGuardInput = PaymentsTransferRiskInput;
export type PaymentsRiskGuard = (
  input: PaymentsRiskGuardInput,
) => PaymentsRiskAssessment;

export const PAYMENTS_RISK_CASE_DECISION_ACTIONS = [
  'release',
  'reject',
] as const;

export type PaymentsRiskCaseDecisionAction =
  (typeof PAYMENTS_RISK_CASE_DECISION_ACTIONS)[number];

export interface PaymentsRiskCaseDecisionInput {
  caseReference: Pick<
    PaymentsRiskCaseReference,
    'caseId' | 'caseType' | 'holdEffect' | 'workflowTags'
  >;
  currentTransferStatus: PaymentsTransferStatus;
  action: PaymentsRiskCaseDecisionAction;
  releaseToStatus?: PaymentsPostableTransferStatus;
  note?: string | null;
  reportingDisposition?: 'none' | 'report';
}

export interface PaymentsRiskCaseDecisionResult {
  action: PaymentsRiskCaseDecisionAction;
  caseId: string;
  caseStatus: Extract<
    PaymentsRiskCaseStatus,
    'cleared' | 'reported' | 'closed'
  >;
  holdEffect: PaymentsComplianceHoldEffect;
  nextTransferStatus: PaymentsTransferStatus;
  eventType: PaymentsTransferEventType;
  userSafeExplanation: string;
  metadata: Record<string, unknown>;
}
