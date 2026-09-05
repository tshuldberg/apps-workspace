import type { PaymentsBalanceBucket } from '../cloud/rpc';
import type {
  PaymentsLedgerDirection,
  PaymentsLedgerKind,
  PaymentsTransferEventType,
  PaymentsTransferStatus,
} from '../engine/types';
import type { PaymentsTransferKind } from '../cloud/rpc';
import type {
  NormalizedProviderEvent,
  PaymentsProviderBundleKind,
  PaymentsProviderProfile,
  PaymentsWebhookSource,
} from '../providers/types';
import type { CurrencyCode } from '../types';

export type MaybePromise<T> = T | Promise<T>;

export const PAYMENTS_AUDIT_LEVELS = ['info', 'warning', 'error'] as const;
export type PaymentsAuditLevel = (typeof PAYMENTS_AUDIT_LEVELS)[number];

export const PAYMENTS_AUDIT_ACTIONS = [
  'command.received',
  'command.applied',
  'command.replayed',
  'provider_event.received',
  'provider_event.applied',
  'provider_event.duplicate_callback',
  'provider_event.replay_started',
  'provider_event.replay_skipped',
  'provider_event.replay_succeeded',
  'provider_event.replay_failed',
  'transfer.status_transition',
  'transfer.reversed',
  'compliance.case_opened',
  'compliance.hold_applied',
  'reconciliation.started',
  'reconciliation.break_detected',
  'reconciliation.completed',
  'break.opened',
  'break.acknowledged',
  'break.resolved',
  'launch_evidence.captured',
  'launch_evidence.replayed',
  'launch_evidence.rejected',
] as const;

export type PaymentsAuditAction = (typeof PAYMENTS_AUDIT_ACTIONS)[number];

export type PaymentsAuditSubject =
  | 'command'
  | 'transfer'
  | 'provider_event'
  | 'reconciliation'
  | 'wallet'
  | 'compliance'
  | 'remittance'
  | 'break'
  | 'launch_evidence';

export type PaymentsAuditMetadata = Record<string, unknown>;

export interface PaymentsAuditEntry {
  id: string;
  occurredAt: string;
  level: PaymentsAuditLevel;
  action: PaymentsAuditAction;
  subjectType: PaymentsAuditSubject;
  message: string;
  commandIdempotencyKey: string | null;
  transferId: string | null;
  providerName: string | null;
  providerEventId: string | null;
  remittanceId: string | null;
  walletId: string | null;
  complianceCaseId: string | null;
  breakId: string | null;
  metadata: PaymentsAuditMetadata;
}

export interface PaymentsAuditLogInput {
  level: PaymentsAuditLevel;
  action: PaymentsAuditAction;
  subjectType: PaymentsAuditSubject;
  message: string;
  commandIdempotencyKey?: string | null;
  transferId?: string | null;
  providerName?: string | null;
  providerEventId?: string | null;
  remittanceId?: string | null;
  walletId?: string | null;
  complianceCaseId?: string | null;
  breakId?: string | null;
  metadata?: PaymentsAuditMetadata;
}

export interface PaymentsAuditSink {
  append(entry: PaymentsAuditEntry): MaybePromise<void>;
}

export interface PaymentsAuditLogger {
  log(input: PaymentsAuditLogInput): Promise<PaymentsAuditEntry>;
}

export interface PaymentsTransferEventRecord {
  transferId: string;
  eventType: PaymentsTransferEventType;
  occurredAt: string;
  actorType?: 'system' | 'user' | 'provider' | 'admin' | null;
  actorUserId?: string | null;
  providerEventRef?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export const PAYMENTS_PROVIDER_EVENT_STATUSES = [
  'received',
  'processing',
  'applied',
  'ignored',
  'failed',
] as const;

export type PaymentsProviderEventStatus =
  (typeof PAYMENTS_PROVIDER_EVENT_STATUSES)[number];

export interface PaymentsProviderEventRecord {
  id: string;
  providerName: PaymentsWebhookSource;
  providerEventId: string;
  eventType: string;
  status: PaymentsProviderEventStatus;
  receivedAt: string;
  occurredAt: string | null;
  ownerUserId: string | null;
  walletId: string | null;
  transferId: string | null;
  remittanceId: string | null;
  objectType: string | null;
  objectReference: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  replayCount: number;
  dedupedCount: number;
  lastReplayAt: string | null;
  appliedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}

export interface PaymentsProviderEventStore {
  get(
    providerName: PaymentsWebhookSource,
    providerEventId: string,
  ): PaymentsProviderEventRecord | null;
  upsert(record: PaymentsProviderEventRecord): PaymentsProviderEventRecord;
  update(
    providerName: PaymentsWebhookSource,
    providerEventId: string,
    patch: Partial<PaymentsProviderEventRecord>,
  ): PaymentsProviderEventRecord;
  list(): PaymentsProviderEventRecord[];
}

export type PaymentsTimelineCategory =
  | 'audit'
  | 'provider_event'
  | 'transfer_event'
  | 'break';

export interface PaymentsTimelineItem {
  id: string;
  occurredAt: string;
  category: PaymentsTimelineCategory;
  action: string;
  message: string;
  status: string | null;
  metadata: Record<string, unknown>;
}

export const PAYMENTS_BREAK_TYPES = [
  'balance_mismatch',
  'status_mismatch',
  'missing_local_transfer',
  'missing_remote_transfer',
  'duplicate_callback',
  'stuck_pending_transfer',
  'stale_remittance_delivery',
  'balance_proof_failed',
  'replay_failed',
] as const;

export type PaymentsBreakType = (typeof PAYMENTS_BREAK_TYPES)[number];

export const PAYMENTS_BREAK_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type PaymentsBreakSeverity = (typeof PAYMENTS_BREAK_SEVERITIES)[number];

export const PAYMENTS_BREAK_STATUSES = [
  'open',
  'acknowledged',
  'resolved',
] as const;

export type PaymentsBreakStatus = (typeof PAYMENTS_BREAK_STATUSES)[number];

export interface PaymentsBreakRecord {
  id: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  status: PaymentsBreakStatus;
  type: PaymentsBreakType;
  severity: PaymentsBreakSeverity;
  summary: string;
  transferId: string | null;
  providerName: string | null;
  providerEventId: string | null;
  remittanceId: string | null;
  walletId: string | null;
  metadata: Record<string, unknown>;
}

export interface PaymentsBreakInput {
  type: PaymentsBreakType;
  severity: PaymentsBreakSeverity;
  summary: string;
  transferId?: string | null;
  providerName?: string | null;
  providerEventId?: string | null;
  remittanceId?: string | null;
  walletId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentsBreakListFilter {
  status?: PaymentsBreakStatus;
  type?: PaymentsBreakType;
  transferId?: string;
  providerEventId?: string;
}

export interface PaymentsBreakQueue {
  upsert(input: PaymentsBreakInput): PaymentsBreakRecord;
  get(id: string): PaymentsBreakRecord | null;
  list(filter?: PaymentsBreakListFilter): PaymentsBreakRecord[];
  acknowledge(id: string): PaymentsBreakRecord;
  resolve(id: string): PaymentsBreakRecord;
}

export interface PaymentsLocalTransferSnapshot {
  transferId: string;
  providerName: string | null;
  providerTransferId: string | null;
  remittanceId: string | null;
  kind: PaymentsTransferKind;
  status: PaymentsTransferStatus;
  amountCents: number;
  currency: CurrencyCode;
  updatedAt: string;
}

export interface PaymentsRemoteTransferSnapshot {
  providerName: string;
  providerTransferId: string;
  transferId?: string | null;
  remittanceId?: string | null;
  status: string;
  amountCents: number;
  currency: CurrencyCode;
  updatedAt: string;
}

export interface PaymentsLedgerEntrySnapshot {
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
  direction: PaymentsLedgerDirection;
  entryKind: PaymentsLedgerKind;
  amountCents: number;
  currency: CurrencyCode;
  createdAt: string;
  transferId?: string | null;
  postingGroupId?: string | null;
}

export interface PaymentsCachedBalanceSnapshot {
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
  currency: CurrencyCode;
  amountCents: number;
  updatedAt?: string | null;
}

export interface PaymentsProviderBalanceSnapshot {
  providerName: string;
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
  currency: CurrencyCode;
  amountCents: number;
  updatedAt: string;
}

export interface PaymentsBalanceProof {
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
  currency: CurrencyCode;
  providerName: string | null;
  ledgerNetCents: number;
  cachedAmountCents: number | null;
  providerAmountCents: number | null;
  cachedDeltaCents: number | null;
  providerDeltaCents: number | null;
  ok: boolean;
}

export interface PaymentsTransactionTraceInput {
  transfer: PaymentsLocalTransferSnapshot;
  auditEntries?: PaymentsAuditEntry[];
  transferEvents?: PaymentsTransferEventRecord[];
  providerEvents?: PaymentsProviderEventRecord[];
  breaks?: PaymentsBreakRecord[];
}

export interface PaymentsTransactionTrace {
  transferId: string;
  currentStatus: PaymentsTransferStatus;
  summary: string;
  duplicateCallbackCount: number;
  providerEventCount: number;
  openBreakCount: number;
  timeline: PaymentsTimelineItem[];
}

export interface PaymentsReconciliationThresholds {
  pendingAgeMs: number;
  remittanceAgeMs: number;
}

export interface PaymentsReconciliationInput {
  environment: 'sandbox' | 'production';
  providerProfile: PaymentsProviderProfile;
  bundleKind: PaymentsProviderBundleKind;
  localTransfers: PaymentsLocalTransferSnapshot[];
  remoteTransfers: PaymentsRemoteTransferSnapshot[];
  providerEvents?: PaymentsProviderEventRecord[];
  ledgerEntries: PaymentsLedgerEntrySnapshot[];
  cachedBalances: PaymentsCachedBalanceSnapshot[];
  providerBalances?: PaymentsProviderBalanceSnapshot[];
  auditLogger?: PaymentsAuditLogger;
  breakQueue?: PaymentsBreakQueue;
  now?: () => Date;
  createId?: (prefix: string) => string;
  thresholds?: Partial<PaymentsReconciliationThresholds>;
}

export interface PaymentsReconciliationSummary {
  localTransfers: number;
  remoteTransfers: number;
  matchedTransfers: number;
  balanceProofs: number;
  failedBalanceProofs: number;
  openBreaks: number;
  criticalBreaks: number;
}

export interface PaymentsReconciliationChecks {
  statusMismatches: number;
  missingLocalTransfers: number;
  missingRemoteTransfers: number;
  duplicateCallbacks: number;
  stuckPendingTransfers: number;
  staleRemittanceDeliveries: number;
}

export interface PaymentsReconciliationReport {
  runId: string;
  checkedAt: string;
  environment: 'sandbox' | 'production';
  providerProfile: PaymentsProviderProfile;
  bundleKind: PaymentsProviderBundleKind;
  sandboxReady: boolean;
  launchBlocked: boolean;
  summary: PaymentsReconciliationSummary;
  checks: PaymentsReconciliationChecks;
  balanceProofs: PaymentsBalanceProof[];
  breaks: PaymentsBreakRecord[];
  operatorLines: string[];
}

export interface AcceptPaymentsProviderEventInput {
  normalizedEvent: NormalizedProviderEvent;
  receivedAt?: string;
  initialStatus?: PaymentsProviderEventStatus;
}

export interface PaymentsProviderEventAcceptanceResult {
  record: PaymentsProviderEventRecord;
  deduped: boolean;
  breakRecord: PaymentsBreakRecord | null;
}

export interface PaymentsProviderEventApplyResult {
  outcome: 'applied' | 'ignored' | 'duplicate';
  transferId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentsWebhookReplayInput {
  providerName: PaymentsWebhookSource;
  providerEventId: string;
  reason: 'manual_retry' | 'break_resolution' | 'operator_drill';
  operatorUserId?: string | null;
  force?: boolean;
}

export interface PaymentsWebhookReplayResult {
  ok: boolean;
  record: PaymentsProviderEventRecord;
  outcome: 'applied' | 'ignored' | 'duplicate' | 'skipped' | 'failed';
  breakRecord: PaymentsBreakRecord | null;
  message: string | null;
}

export interface PaymentsWebhookReplayService {
  replay(input: PaymentsWebhookReplayInput): Promise<PaymentsWebhookReplayResult>;
}
