import type { PaymentsBalanceBucket } from '../../cloud/rpc';
import type {
  PaymentsLedgerPlan,
  PaymentsPostedTransfer,
  PaymentsTransferRecord,
  PaymentsTransferStatus,
} from '../../engine/types';
import type {
  CurrencyCode,
  PaymentCounterparty,
} from '../../types';

export const PAYMENTS_DISPUTE_CASE_TYPES = [
  'reg_e_error',
  'chargeback',
] as const;

export type PaymentsDisputeCaseType =
  (typeof PAYMENTS_DISPUTE_CASE_TYPES)[number];

export const PAYMENTS_DISPUTE_CASE_SUBTYPES = [
  'unauthorized_transfer',
  'card_dispute',
  'market_escrow',
] as const;

export type PaymentsDisputeCaseSubtype =
  (typeof PAYMENTS_DISPUTE_CASE_SUBTYPES)[number];

export const PAYMENTS_DISPUTE_CASE_STATUSES = [
  'draft',
  'open',
  'awaiting_customer',
  'under_review',
  'submitted_to_provider',
  'provisional_credit_issued',
  'resolved',
  'closed',
] as const;

export type PaymentsDisputeCaseStatus =
  (typeof PAYMENTS_DISPUTE_CASE_STATUSES)[number];

export const PAYMENTS_DISPUTE_REASON_CODES = [
  'unauthorized_transfer',
  'account_takeover',
  'card_not_present_fraud',
  'duplicate_charge',
  'merchant_credit_not_processed',
  'service_not_received',
  'item_not_received',
  'item_not_as_described',
  'item_damaged',
  'wrong_item',
  'counterfeit',
  'other',
] as const;

export type PaymentsDisputeReasonCode =
  (typeof PAYMENTS_DISPUTE_REASON_CODES)[number];

export const PAYMENTS_DISPUTE_EVIDENCE_SLOT_STATUSES = [
  'optional',
  'required',
  'submitted',
  'waived',
] as const;

export type PaymentsDisputeEvidenceSlotStatus =
  (typeof PAYMENTS_DISPUTE_EVIDENCE_SLOT_STATUSES)[number];

export const PAYMENTS_DISPUTE_DEADLINE_KINDS = [
  'report_by',
  'evidence_by',
  'provider_response_by',
  'provisional_credit_by',
] as const;

export type PaymentsDisputeDeadlineKind =
  (typeof PAYMENTS_DISPUTE_DEADLINE_KINDS)[number];

export const PAYMENTS_DISPUTE_DEADLINE_STATUSES = [
  'pending',
  'met',
  'missed',
] as const;

export type PaymentsDisputeDeadlineStatus =
  (typeof PAYMENTS_DISPUTE_DEADLINE_STATUSES)[number];

export const PAYMENTS_DISPUTE_TIMELINE_ACTORS = [
  'customer',
  'operator',
  'provider',
  'system',
  'merchant',
] as const;

export type PaymentsDisputeTimelineActor =
  (typeof PAYMENTS_DISPUTE_TIMELINE_ACTORS)[number];

export const PAYMENTS_DISPUTE_PROVIDER_OUTCOMES = [
  'none',
  'submitted',
  'review',
  'won',
  'lost',
  'chargeback_debit',
  'chargeback_reversal',
  'refund_posted',
] as const;

export type PaymentsDisputeProviderOutcome =
  (typeof PAYMENTS_DISPUTE_PROVIDER_OUTCOMES)[number];

export const PAYMENTS_DISPUTE_OPERATOR_ACTION_TYPES = [
  'request_evidence',
  'submit_to_provider',
  'issue_provisional_credit',
  'record_provider_outcome',
  'resolve_with_reversal',
  'resolve_with_refund',
  'deny_claim',
  'close_case',
] as const;

export type PaymentsDisputeOperatorActionType =
  (typeof PAYMENTS_DISPUTE_OPERATOR_ACTION_TYPES)[number];

export const PAYMENTS_DISPUTE_LEDGER_DECISION_TYPES = [
  'none',
  'reversal',
  'refund',
  'provisional_credit',
] as const;

export type PaymentsDisputeLedgerDecisionType =
  (typeof PAYMENTS_DISPUTE_LEDGER_DECISION_TYPES)[number];

export interface PaymentsMarketDisputeContext {
  orderId: string;
  escrowId?: string | null;
  listingId?: string | null;
  itemTitle?: string | null;
  sellerUserId?: string | null;
  buyerUserId?: string | null;
}

export interface PaymentsDisputeReasonOption {
  code: PaymentsDisputeReasonCode;
  label: string;
  description: string;
}

export interface PaymentsDisputeEvidenceSlot {
  slotId: string;
  key: string;
  label: string;
  description: string;
  status: PaymentsDisputeEvidenceSlotStatus;
  dueAt: string | null;
  attachmentIds: string[];
  note: string | null;
}

export interface PaymentsDisputeDeadline {
  deadlineId: string;
  kind: PaymentsDisputeDeadlineKind;
  label: string;
  description: string;
  dueAt: string;
  status: PaymentsDisputeDeadlineStatus;
  completedAt: string | null;
}

export interface PaymentsDisputeTimelineItem {
  timelineId: string;
  occurredAt: string;
  actor: PaymentsDisputeTimelineActor;
  eventType: string;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown>;
}

export interface PaymentsDisputeNote {
  noteId: string;
  createdAt: string;
  authorRole: Exclude<PaymentsDisputeTimelineActor, 'system'>;
  authorUserId: string | null;
  visibility: 'customer' | 'internal';
  body: string;
}

export interface PaymentsDisputeOperatorAction {
  actionType: PaymentsDisputeOperatorActionType;
  label: string;
  description: string;
  recommendedLedgerDecision: PaymentsDisputeLedgerDecisionType | null;
}

export interface PaymentsDisputeLedgerState {
  recommendedDecision: PaymentsDisputeLedgerDecisionType | null;
  ledgerActionPending: boolean;
  appliedDecision: PaymentsDisputeLedgerDecisionType | null;
  appliedAt: string | null;
}

export interface PaymentsTransferDisputeSummary {
  transferId: string | null;
  caseId: string | null;
  caseSubtype: PaymentsDisputeCaseSubtype | null;
  status: PaymentsDisputeCaseStatus | null;
  hasActiveCase: boolean;
  headline: string;
  nextStep: string;
  deadlineAt: string | null;
}

export interface PaymentsIssueReportInput {
  ownerUserId: string;
  walletId: string;
  transfer: PaymentsTransferRecord;
  transferOccurredAt: string;
  now: Date;
  counterparty?: PaymentCounterparty | null;
  existingCases?: PaymentsDisputeCase[];
  cardTransactionId?: string | null;
  providerName?: string | null;
  market?: PaymentsMarketDisputeContext | null;
}

export interface PaymentsIssueReportDraft {
  ownerUserId: string;
  walletId: string;
  transferId: string | null;
  caseType: PaymentsDisputeCaseType | null;
  caseSubtype: PaymentsDisputeCaseSubtype | null;
  reportable: boolean;
  reasonOptions: PaymentsDisputeReasonOption[];
  evidenceSlots: PaymentsDisputeEvidenceSlot[];
  deadlines: PaymentsDisputeDeadline[];
  currentCaseSummary: PaymentsTransferDisputeSummary | null;
  nextStep: string;
  blockedReason: string | null;
}

export interface CreatePaymentsDisputeCaseInput extends PaymentsIssueReportInput {
  reasonCode: PaymentsDisputeReasonCode;
  userStatement: string;
  reportedAt?: string;
  createId?: (prefix: string) => string;
}

export interface PaymentsDisputeCase {
  caseId: string;
  ownerUserId: string;
  walletId: string;
  transferId: string | null;
  cardTransactionId: string | null;
  providerName: string | null;
  counterparty: PaymentCounterparty | null;
  market: PaymentsMarketDisputeContext | null;
  caseType: PaymentsDisputeCaseType;
  caseSubtype: PaymentsDisputeCaseSubtype;
  status: PaymentsDisputeCaseStatus;
  amountCents: number;
  currency: CurrencyCode;
  reasonCode: PaymentsDisputeReasonCode;
  userStatement: string;
  providerOutcome: PaymentsDisputeProviderOutcome;
  openedAt: string;
  updatedAt: string;
  evidenceSlots: PaymentsDisputeEvidenceSlot[];
  deadlines: PaymentsDisputeDeadline[];
  timeline: PaymentsDisputeTimelineItem[];
  notes: PaymentsDisputeNote[];
  operatorActions: PaymentsDisputeOperatorAction[];
  nextStep: string;
  ledgerState: PaymentsDisputeLedgerState;
  metadata: Record<string, unknown>;
}

export interface SubmitPaymentsDisputeEvidenceInput {
  disputeCase: PaymentsDisputeCase;
  submittedAt: string;
  submittedByUserId?: string | null;
  slotSubmissions: Array<{
    slotId: string;
    attachmentId: string;
    note?: string | null;
  }>;
  note?: string | null;
}

export interface ApplyPaymentsDisputeOperatorActionInput {
  disputeCase: PaymentsDisputeCase;
  actionType: PaymentsDisputeOperatorActionType;
  actedAt: string;
  actorUserId?: string | null;
  note?: string | null;
  requestedSlotIds?: string[];
  providerOutcome?: PaymentsDisputeProviderOutcome;
}

export interface PaymentsDisputeLedgerDecision {
  decisionType: PaymentsDisputeLedgerDecisionType;
  amountCents?: number | null;
  reason?: string | null;
  decidedAt: string;
  actorUserId?: string | null;
}

export interface PaymentsDisputeLedgerParty {
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
}

export interface ResolvePaymentsDisputeLedgerDecisionInput {
  disputeCase: PaymentsDisputeCase;
  decision: PaymentsDisputeLedgerDecision;
  originalTransfer?: PaymentsPostedTransfer | null;
  refundSource?: PaymentsDisputeLedgerParty | null;
  refundDestination?: PaymentsDisputeLedgerParty | null;
  provisionalCreditSource?: PaymentsDisputeLedgerParty | null;
  provisionalCreditDestination?: PaymentsDisputeLedgerParty | null;
  createId?: (prefix: string) => string;
}

export interface PaymentsDisputeLedgerDecisionResult {
  decisionType: PaymentsDisputeLedgerDecisionType;
  amountCents: number | null;
  plan: PaymentsLedgerPlan | null;
  nextTransferStatus: PaymentsTransferStatus | null;
  caseStatus: Extract<PaymentsDisputeCaseStatus, 'resolved' | 'closed'>;
  nextStep: string;
  ledgerState: PaymentsDisputeLedgerState;
  metadata: Record<string, unknown>;
}
