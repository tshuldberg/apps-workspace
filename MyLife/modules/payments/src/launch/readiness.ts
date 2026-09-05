import {
  buildPaymentsAvailabilityViewModel,
} from '../cloud/availability';
import type {
  PaymentsTransferKind,
} from '../cloud/rpc';
import {
  buildPaymentsProfile,
} from '../compliance/profile';
import {
  applyPaymentsDisputeOperatorAction,
  createPaymentsDisputeCase,
} from '../compliance/disputes/workflow';
import {
  createPaymentsDomainEngine,
} from '../engine/engine';
import type {
  PaymentsExecutionContext,
  PaymentsPostedTransfer,
  PaymentsTransferCommandResult,
  PaymentsTransferStatus,
  PaymentsWalletSnapshot,
} from '../engine/types';
import {
  runPaymentsReconciliationJob,
} from '../ops/reconciliation';
import type {
  PaymentsCachedBalanceSnapshot,
  PaymentsLedgerEntrySnapshot,
  PaymentsLocalTransferSnapshot,
  PaymentsProviderBalanceSnapshot,
  PaymentsReconciliationReport,
  PaymentsRemoteTransferSnapshot,
} from '../ops/types';
import {
  createSandboxPaymentsProviderBundle,
} from '../providers/sandbox';
import type {
  PaymentsProviderContext,
  PaymentsProviderProfile,
  PaymentsProviderResult,
} from '../providers/types';
import type {
  PaymentActivityItem,
} from '../types';
import type {
  PaymentsWalletHomeSnapshot,
  PaymentsWalletLinkedAccount,
} from '../wallet/home';

export const PAYMENTS_LAUNCH_SANDBOX_OWNER_USER_ID = 'user_mypay_sandbox';
export const PAYMENTS_LAUNCH_SANDBOX_WALLET_ID = 'wallet_mypay_sandbox';

export type PaymentsLaunchSandboxProviderProfile = Exclude<
  PaymentsProviderProfile,
  'fake'
>;

export type PaymentsLaunchDrillId =
  | 'send'
  | 'funding'
  | 'card'
  | 'remittance'
  | 'reconciliation'
  | 'dispute'
  | 'degraded_fail_closed';

export type PaymentsLaunchDrillStatus = 'passed' | 'failed';

export interface PaymentsLaunchDrillResult {
  id: PaymentsLaunchDrillId;
  label: string;
  status: PaymentsLaunchDrillStatus;
  evidence: string;
  blocking: boolean;
  code: string | null;
}

export interface RunPaymentsProviderSandboxDrillsInput {
  providerProfile?: PaymentsLaunchSandboxProviderProfile;
  now?: () => Date;
  createId?: (prefix: string) => string;
}

export interface PaymentsProviderSandboxDrillReport {
  generatedAt: string;
  providerProfile: PaymentsLaunchSandboxProviderProfile;
  bundleKind: 'sandbox';
  allAutomatedPassed: boolean;
  launchBlocked: boolean;
  drills: PaymentsLaunchDrillResult[];
  reconciliation: PaymentsReconciliationReport | null;
  operatorLines: string[];
}

export type PaymentsLaunchReconciliationFixtureId =
  | 'completed'
  | 'reversed'
  | 'failed'
  | 'returned'
  | 'disputed';

export interface PaymentsLaunchReconciliationFixtureResult {
  id: PaymentsLaunchReconciliationFixtureId;
  label: string;
  localStatus: PaymentsTransferStatus;
  remoteStatus: string;
  transferKind: PaymentsTransferKind;
  passed: boolean;
  evidence: string;
  report: PaymentsReconciliationReport;
}

export interface RunPaymentsLaunchReconciliationStatusMatrixInput {
  providerProfile?: PaymentsLaunchSandboxProviderProfile;
  now?: () => Date;
  createId?: (prefix: string) => string;
}

export interface PaymentsLaunchReconciliationStatusMatrixReport {
  generatedAt: string;
  providerProfile: PaymentsLaunchSandboxProviderProfile;
  allFixturesPassed: boolean;
  launchBlocked: boolean;
  fixtures: PaymentsLaunchReconciliationFixtureResult[];
  operatorLines: string[];
}

export type PaymentsDisputeOpsChecklistItemId =
  | 'ledger_action_authority'
  | 'provisional_credit_timing'
  | 'closure_notices'
  | 'audit_evidence';

export interface PaymentsDisputeOpsChecklistItem {
  id: PaymentsDisputeOpsChecklistItemId;
  label: string;
  status: PaymentsLaunchGateStatus;
  evidence: string;
  blocker: boolean;
}

export interface BuildPaymentsDisputeOpsChecklistInput {
  ledgerActionApproverRole?: 'payments_ops_lead' | 'compliance_officer' | 'finance_admin' | null;
  ledgerActionDualControl?: boolean;
  provisionalCreditWindowDays?: number | null;
  closureNoticeTemplateApproved?: boolean;
  auditEvidenceSinkConfigured?: boolean;
  generatedAt?: string | Date;
}

export interface PaymentsDisputeOpsChecklist {
  generatedAt: string;
  ready: boolean;
  items: PaymentsDisputeOpsChecklistItem[];
  operatorLines: string[];
}

export type PaymentsLaunchTargetReleaseState =
  | 'hidden'
  | 'public_beta'
  | 'ga';

export type PaymentsLaunchReleaseApprovalItemId =
  | 'automated_evidence'
  | 'legal_review'
  | 'pilot_approval'
  | 'release_owner_signoff';

export interface PaymentsLaunchReleaseApprovalItem {
  id: PaymentsLaunchReleaseApprovalItemId;
  label: string;
  status: PaymentsLaunchGateStatus;
  evidence: string;
  blocker: boolean;
}

export interface PaymentsLaunchApprovalEvidenceReference {
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  automatedEvidenceGeneratedAt?: string | Date | null;
  providerProfile?: PaymentsLaunchSandboxProviderProfile | null;
}

export interface PaymentsLaunchLegalReviewApproval
  extends PaymentsLaunchApprovalEvidenceReference {
  copySetVersion?: string | null;
  counselMatterId?: string | null;
  storedBalanceCopyApproved?: boolean;
  partnerBankCopyApproved?: boolean;
  custodialCopyApproved?: boolean;
  remittanceCancellationCopyApproved?: boolean;
  errorResolutionCopyApproved?: boolean;
}

export interface PaymentsLaunchPilotApproval
  extends PaymentsLaunchApprovalEvidenceReference {
  cohortId?: string | null;
  limitProfileId?: string | null;
  monitoringPlanId?: string | null;
  rollbackPlanId?: string | null;
  corridorConfigurationReviewed?: boolean;
}

export interface PaymentsLaunchReleaseOwnerSignoff
  extends PaymentsLaunchApprovalEvidenceReference {
  releaseTicketId?: string | null;
  targetReleaseState?: PaymentsLaunchTargetReleaseState | null;
  paymentsFeatureHidden?: boolean;
}

export interface PaymentsLaunchHiddenStateAcknowledgement
  extends PaymentsLaunchApprovalEvidenceReference {
  releaseTicketId?: string | null;
  targetReleaseState?: PaymentsLaunchTargetReleaseState | null;
  paymentsFeatureHiddenAcknowledged?: boolean;
}

export interface PaymentsLaunchReleaseEvidenceCapture {
  legalReview?: PaymentsLaunchLegalReviewApproval | null;
  pilotApproval?: PaymentsLaunchPilotApproval | null;
  releaseOwnerSignoff?: PaymentsLaunchReleaseOwnerSignoff | null;
  hiddenStateAcknowledgement?: PaymentsLaunchHiddenStateAcknowledgement | null;
}

export interface BuildPaymentsLaunchReleaseApprovalPacketInput {
  providerDrillReport?: PaymentsProviderSandboxDrillReport | null;
  reconciliationStatusMatrixReport?: PaymentsLaunchReconciliationStatusMatrixReport | null;
  disputeOpsChecklist?: PaymentsDisputeOpsChecklist | null;
  legalReview?: PaymentsLaunchLegalReviewApproval | null;
  pilotApproval?: PaymentsLaunchPilotApproval | null;
  releaseOwnerSignoff?: PaymentsLaunchReleaseOwnerSignoff | null;
  expectedProviderProfile?: PaymentsLaunchSandboxProviderProfile | null;
  maxEvidenceAgeMs?: number;
  generatedAt?: string | Date;
}

export interface PaymentsLaunchReleaseApprovalPacket {
  generatedAt: string;
  providerProfile: PaymentsLaunchSandboxProviderProfile | null;
  automatedEvidenceGeneratedAt: string | null;
  automatedEvidenceReady: boolean;
  legalReviewApproved: boolean;
  pilotApproved: boolean;
  releaseOwnerSignedOff: boolean;
  releaseFlipEnabled: boolean;
  paymentsFeatureHidden: boolean;
  ready: boolean;
  items: PaymentsLaunchReleaseApprovalItem[];
  operatorLines: string[];
}

export type PaymentsLaunchReleaseEvidenceReviewStatus =
  | 'pending'
  | 'blocked'
  | 'ready_for_release_owner_review';

export type PaymentsLaunchReleaseEvidenceReviewItemId =
  | 'legal_review'
  | 'pilot_approval'
  | 'release_owner_signoff'
  | 'hidden_state_acknowledgement';

export type PaymentsLaunchReleaseEvidenceReviewItemStatus =
  | 'pending'
  | 'blocked'
  | 'ready';

export interface PaymentsLaunchReleaseEvidenceReviewItem {
  id: PaymentsLaunchReleaseEvidenceReviewItemId;
  label: string;
  status: PaymentsLaunchReleaseEvidenceReviewItemStatus;
  evidence: string;
  blocker: boolean;
}

export interface BuildPaymentsLaunchReleaseEvidenceReviewInput {
  providerDrillReport?: PaymentsProviderSandboxDrillReport | null;
  reconciliationStatusMatrixReport?: PaymentsLaunchReconciliationStatusMatrixReport | null;
  disputeOpsChecklist?: PaymentsDisputeOpsChecklist | null;
  releaseEvidence?: PaymentsLaunchReleaseEvidenceCapture | null;
  expectedProviderProfile?: PaymentsLaunchSandboxProviderProfile | null;
  maxEvidenceAgeMs?: number;
  paymentsFeatureHidden?: boolean;
  generatedAt?: string | Date;
}

export interface PaymentsLaunchReleaseEvidenceReview {
  generatedAt: string;
  providerProfile: PaymentsLaunchSandboxProviderProfile | null;
  automatedEvidenceGeneratedAt: string | null;
  status: PaymentsLaunchReleaseEvidenceReviewStatus;
  statusLabel: string;
  summary: string;
  paymentsFeatureHidden: boolean;
  releaseTicketId: string | null;
  targetReleaseState: PaymentsLaunchTargetReleaseState | null;
  approvalPacket: PaymentsLaunchReleaseApprovalPacket;
  items: PaymentsLaunchReleaseEvidenceReviewItem[];
  operatorLines: string[];
}

export type PaymentsLaunchGateStatus =
  | 'passed'
  | 'blocked'
  | 'manual_review'
  | 'not_ready';

export type PaymentsLaunchGateId =
  | 'provider_sandbox_drills'
  | 'reconciliation'
  | 'disputes_and_holds'
  | 'degraded_fail_closed'
  | 'legal_review'
  | 'pilot'
  | 'release_flip';

export interface PaymentsLaunchGateItem {
  id: PaymentsLaunchGateId;
  label: string;
  status: PaymentsLaunchGateStatus;
  evidence: string;
  blocker: boolean;
}

export type PaymentsLaunchOperatorRunbookDecision =
  | 'ready_for_release_owner_review'
  | 'do_not_launch';

export type PaymentsLaunchOperatorRunbookReasonId =
  | 'provider_drills_missing'
  | 'provider_drills_failed'
  | 'reconciliation_matrix_missing'
  | 'reconciliation_matrix_failed'
  | 'dispute_ops_missing'
  | 'dispute_ops_blocked'
  | 'approval_packet_missing'
  | 'approval_packet_blocked'
  | 'approval_evidence_stale'
  | 'approval_evidence_mismatch'
  | 'provider_profile_mismatch'
  | 'payments_hidden';

export interface PaymentsLaunchOperatorRunbookReason {
  id: PaymentsLaunchOperatorRunbookReasonId;
  label: string;
  evidence: string;
  blocker: true;
}

export type PaymentsLaunchOperatorRunbookSectionId =
  | 'provider_sandbox_drills'
  | 'reconciliation_status_matrix'
  | 'dispute_operations'
  | 'release_approval_packet'
  | 'release_state';

export interface PaymentsLaunchOperatorRunbookSection {
  id: PaymentsLaunchOperatorRunbookSectionId;
  title: string;
  status: PaymentsLaunchGateStatus;
  summary: string;
  evidenceLines: string[];
}

export interface BuildPaymentsLaunchOperatorRunbookInput {
  providerDrillReport?: PaymentsProviderSandboxDrillReport | null;
  reconciliationStatusMatrixReport?: PaymentsLaunchReconciliationStatusMatrixReport | null;
  disputeOpsChecklist?: PaymentsDisputeOpsChecklist | null;
  releaseApprovalPacket?: PaymentsLaunchReleaseApprovalPacket | null;
  expectedProviderProfile?: PaymentsLaunchSandboxProviderProfile | null;
  paymentsFeatureHidden?: boolean;
  generatedAt?: string | Date;
}

export interface PaymentsLaunchOperatorRunbook {
  generatedAt: string;
  providerProfile: PaymentsLaunchSandboxProviderProfile | null;
  paymentsFeatureHidden: boolean;
  decision: PaymentsLaunchOperatorRunbookDecision;
  readyForReleaseOwnerReview: boolean;
  doNotLaunchReasons: PaymentsLaunchOperatorRunbookReason[];
  sections: PaymentsLaunchOperatorRunbookSection[];
  operatorLines: string[];
}

export interface BuildPaymentsLaunchGateViewModelInput {
  providerDrillReport?: PaymentsProviderSandboxDrillReport | null;
  reconciliationStatusMatrixReport?: PaymentsLaunchReconciliationStatusMatrixReport | null;
  disputeOpsChecklist?: PaymentsDisputeOpsChecklist | null;
  releaseApprovalPacket?: PaymentsLaunchReleaseApprovalPacket | null;
  legalReviewApproved?: boolean;
  pilotApproved?: boolean;
  releaseFlipEnabled?: boolean;
  paymentsFeatureHidden?: boolean;
  generatedAt?: string | Date;
}

export interface PaymentsLaunchGateViewModel {
  generatedAt: string;
  releaseReady: boolean;
  hiddenUntilReady: boolean;
  summary: string;
  items: PaymentsLaunchGateItem[];
}

const SERVER_REFRESH_MS = 30_000;
const DEFAULT_NOW_ISO = '2026-04-24T16:30:00.000Z';
const SOURCE_WALLET_ID = 'wallet_launch_source';
const DESTINATION_WALLET_ID = 'wallet_launch_destination';
const SETTLEMENT_WALLET_ID = 'wallet_launch_settlement';
const DISPUTE_PROVISIONAL_CREDIT_LIMIT_DAYS = 10;
const DEFAULT_RELEASE_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const RECONCILIATION_STATUS_FIXTURES: Array<{
  id: PaymentsLaunchReconciliationFixtureId;
  label: string;
  localStatus: PaymentsTransferStatus;
  remoteStatus: string;
  transferKind: PaymentsTransferKind;
  expectedBalanceCents: number;
}> = [
  {
    id: 'completed',
    label: 'Completed provider settlement',
    localStatus: 'completed',
    remoteStatus: 'settled',
    transferKind: 'p2p',
    expectedBalanceCents: 1_000,
  },
  {
    id: 'reversed',
    label: 'Reversed provider refund',
    localStatus: 'reversed',
    remoteStatus: 'refunded',
    transferKind: 'reversal',
    expectedBalanceCents: 0,
  },
  {
    id: 'failed',
    label: 'Failed provider transfer',
    localStatus: 'failed',
    remoteStatus: 'failed',
    transferKind: 'fund_wallet',
    expectedBalanceCents: 0,
  },
  {
    id: 'returned',
    label: 'Returned provider debit',
    localStatus: 'failed',
    remoteStatus: 'returned',
    transferKind: 'withdraw_wallet',
    expectedBalanceCents: 0,
  },
  {
    id: 'disputed',
    label: 'Disputed provider chargeback',
    localStatus: 'disputed',
    remoteStatus: 'chargeback',
    transferKind: 'card_capture',
    expectedBalanceCents: 1_000,
  },
];

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toOptionalIso(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return toIso(value);
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestampMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createSequentialIdFactory(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => `${prefix}_launch_${++counter}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function providerResultCode(result: PaymentsProviderResult<unknown>): string | null {
  return result.ok ? null : result.code;
}

function createDrillResult(input: {
  id: PaymentsLaunchDrillId;
  label: string;
  passed: boolean;
  evidence: string;
  code?: string | null;
}): PaymentsLaunchDrillResult {
  return {
    id: input.id,
    label: input.label,
    status: input.passed ? 'passed' : 'failed',
    evidence: input.evidence,
    blocking: !input.passed,
    code: input.code ?? null,
  };
}

async function runDrill(
  id: PaymentsLaunchDrillId,
  label: string,
  callback: () => Promise<{
    passed: boolean;
    evidence: string;
    code?: string | null;
  }>,
): Promise<PaymentsLaunchDrillResult> {
  try {
    return createDrillResult({
      id,
      label,
      ...(await callback()),
    });
  } catch (error) {
    return createDrillResult({
      id,
      label,
      passed: false,
      evidence: errorMessage(error),
      code: 'exception',
    });
  }
}

function createLaunchWallet(input: {
  walletId: string;
  ownerUserId: string;
  availableCents: number;
  pendingCents?: number;
}): PaymentsWalletSnapshot {
  return {
    walletId: input.walletId,
    ownerUserId: input.ownerUserId,
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: input.availableCents,
      pending: input.pendingCents ?? 0,
      reserved: 0,
      escrow: 0,
    },
    complianceHold: 'none',
    sendLimitRemainingCents: 500_000,
    receiveLimitRemainingCents: 500_000,
  };
}

function isTransferResult(
  result: unknown,
): result is PaymentsTransferCommandResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'kind' in result &&
    result.kind === 'transfer'
  );
}

function buildBalanceProofInputs(input: {
  providerProfile: PaymentsLaunchSandboxProviderProfile;
  transfer: PaymentsPostedTransfer;
  providerTransferId: string;
  nowIso: string;
}): {
  localTransfers: PaymentsLocalTransferSnapshot[];
  remoteTransfers: PaymentsRemoteTransferSnapshot[];
  ledgerEntries: PaymentsLedgerEntrySnapshot[];
  cachedBalances: PaymentsCachedBalanceSnapshot[];
  providerBalances: PaymentsProviderBalanceSnapshot[];
} {
  const ledgerEntries: PaymentsLedgerEntrySnapshot[] = [
    {
      walletId: SOURCE_WALLET_ID,
      balanceBucket: 'available',
      direction: 'credit',
      entryKind: 'adjustment',
      amountCents: 150_000,
      currency: 'USD',
      createdAt: input.nowIso,
      transferId: null,
      postingGroupId: 'opening_balance_launch_drill',
    },
    {
      walletId: SOURCE_WALLET_ID,
      balanceBucket: 'available',
      direction: 'debit',
      entryKind: 'principal',
      amountCents: input.transfer.sourceAmountCents,
      currency: input.transfer.sourceCurrency,
      createdAt: input.nowIso,
      transferId: input.transfer.transferId,
      postingGroupId: input.transfer.ledgerPlan.postingGroupId,
    },
    {
      walletId: DESTINATION_WALLET_ID,
      balanceBucket: 'available',
      direction: 'credit',
      entryKind: 'principal',
      amountCents: input.transfer.destinationAmountCents ?? input.transfer.sourceAmountCents,
      currency: input.transfer.destinationCurrency ?? input.transfer.sourceCurrency,
      createdAt: input.nowIso,
      transferId: input.transfer.transferId,
      postingGroupId: input.transfer.ledgerPlan.postingGroupId,
    },
  ];
  const sourceBalance = 150_000 - input.transfer.sourceAmountCents;
  const destinationBalance =
    input.transfer.destinationAmountCents ?? input.transfer.sourceAmountCents;
  const cachedBalances: PaymentsCachedBalanceSnapshot[] = [
    {
      walletId: SOURCE_WALLET_ID,
      balanceBucket: 'available',
      currency: 'USD',
      amountCents: sourceBalance,
      updatedAt: input.nowIso,
    },
    {
      walletId: DESTINATION_WALLET_ID,
      balanceBucket: 'available',
      currency: 'USD',
      amountCents: destinationBalance,
      updatedAt: input.nowIso,
    },
  ];
  const providerBalances = cachedBalances.map((balance) => ({
    providerName: input.providerProfile,
    walletId: balance.walletId,
    balanceBucket: balance.balanceBucket,
    currency: balance.currency,
    amountCents: balance.amountCents,
    updatedAt: input.nowIso,
  }));

  return {
    localTransfers: [
      {
        transferId: input.transfer.transferId,
        providerName: input.providerProfile,
        providerTransferId: input.providerTransferId,
        remittanceId: null,
        kind: input.transfer.kind,
        status: input.transfer.status,
        amountCents: input.transfer.sourceAmountCents,
        currency: input.transfer.sourceCurrency,
        updatedAt: input.nowIso,
      },
    ],
    remoteTransfers: [
      {
        providerName: input.providerProfile,
        providerTransferId: input.providerTransferId,
        transferId: input.transfer.transferId,
        remittanceId: null,
        status: input.transfer.status,
        amountCents: input.transfer.sourceAmountCents,
        currency: input.transfer.sourceCurrency,
        updatedAt: input.nowIso,
      },
    ],
    ledgerEntries,
    cachedBalances,
    providerBalances,
  };
}

function statusBlocks(status: PaymentsLaunchGateStatus): boolean {
  return status !== 'passed';
}

function gateItem(input: {
  id: PaymentsLaunchGateId;
  label: string;
  status: PaymentsLaunchGateStatus;
  evidence: string;
}): PaymentsLaunchGateItem {
  return {
    ...input,
    blocker: statusBlocks(input.status),
  };
}

function statusFromDrill(
  report: PaymentsProviderSandboxDrillReport | null | undefined,
  id: PaymentsLaunchDrillId,
): PaymentsLaunchGateStatus {
  const drill = report?.drills.find((item) => item.id === id) ?? null;
  if (!drill) {
    return 'not_ready';
  }
  return drill.status === 'passed' ? 'passed' : 'blocked';
}

function evidenceFromDrill(
  report: PaymentsProviderSandboxDrillReport | null | undefined,
  id: PaymentsLaunchDrillId,
  fallback: string,
): string {
  return report?.drills.find((item) => item.id === id)?.evidence ?? fallback;
}

function buildStatusMatrixReconciliationInput(input: {
  fixture: (typeof RECONCILIATION_STATUS_FIXTURES)[number];
  providerProfile: PaymentsLaunchSandboxProviderProfile;
  nowIso: string;
}): Pick<
  Parameters<typeof runPaymentsReconciliationJob>[0],
  | 'localTransfers'
  | 'remoteTransfers'
  | 'ledgerEntries'
  | 'cachedBalances'
  | 'providerBalances'
> {
  const transferId = `transfer_launch_matrix_${input.fixture.id}`;
  const providerTransferId = `provider_launch_matrix_${input.fixture.id}`;
  const walletId = `wallet_launch_matrix_${input.fixture.id}`;
  const ledgerEntries: PaymentsLedgerEntrySnapshot[] =
    input.fixture.expectedBalanceCents > 0
      ? [
          {
            walletId,
            balanceBucket: 'available',
            direction: 'credit',
            entryKind: 'principal',
            amountCents: input.fixture.expectedBalanceCents,
            currency: 'USD',
            createdAt: input.nowIso,
            transferId,
            postingGroupId: `posting_launch_matrix_${input.fixture.id}`,
          },
        ]
      : [];
  const cachedBalances: PaymentsCachedBalanceSnapshot[] = [
    {
      walletId,
      balanceBucket: 'available',
      currency: 'USD',
      amountCents: input.fixture.expectedBalanceCents,
      updatedAt: input.nowIso,
    },
  ];

  return {
    localTransfers: [
      {
        transferId,
        providerName: input.providerProfile,
        providerTransferId,
        remittanceId: null,
        kind: input.fixture.transferKind,
        status: input.fixture.localStatus,
        amountCents: 1_000,
        currency: 'USD',
        updatedAt: input.nowIso,
      },
    ],
    remoteTransfers: [
      {
        providerName: input.providerProfile,
        providerTransferId,
        transferId,
        remittanceId: null,
        status: input.fixture.remoteStatus,
        amountCents: 1_000,
        currency: 'USD',
        updatedAt: input.nowIso,
      },
    ],
    ledgerEntries,
    cachedBalances,
    providerBalances: cachedBalances.map((balance) => ({
      providerName: input.providerProfile,
      walletId: balance.walletId,
      balanceBucket: balance.balanceBucket,
      currency: balance.currency,
      amountCents: balance.amountCents,
      updatedAt: input.nowIso,
    })),
  };
}

function checklistItem(input: {
  id: PaymentsDisputeOpsChecklistItemId;
  label: string;
  passed: boolean;
  evidence: string;
}): PaymentsDisputeOpsChecklistItem {
  const status: PaymentsLaunchGateStatus = input.passed ? 'passed' : 'blocked';
  return {
    id: input.id,
    label: input.label,
    status,
    evidence: input.evidence,
    blocker: statusBlocks(status),
  };
}

function releaseApprovalItem(input: {
  id: PaymentsLaunchReleaseApprovalItemId;
  label: string;
  passed: boolean;
  evidence: string;
  missing?: boolean;
}): PaymentsLaunchReleaseApprovalItem {
  const status: PaymentsLaunchGateStatus = input.passed
    ? 'passed'
    : input.missing
      ? 'not_ready'
      : 'blocked';
  return {
    id: input.id,
    label: input.label,
    status,
    evidence: input.evidence,
    blocker: statusBlocks(status),
  };
}

function summarizeReleaseApprovalPacket(
  packet: PaymentsLaunchReleaseApprovalPacket | null,
): string {
  if (!packet) {
    return 'Release approval packet has not been attached.';
  }

  return packet.operatorLines.join(' ');
}

function releaseApprovalEvidence(
  packet: PaymentsLaunchReleaseApprovalPacket | null,
  id: PaymentsLaunchReleaseApprovalItemId,
  fallback: string,
): string {
  return packet?.items.find((item) => item.id === id)?.evidence ?? fallback;
}

function approvalReferenceIssues(input: {
  approval: PaymentsLaunchApprovalEvidenceReference | null | undefined;
  generatedAt: string;
  automatedEvidenceGeneratedAt: string | null;
  providerProfile: PaymentsLaunchSandboxProviderProfile | null;
}): string[] {
  const issues: string[] = [];
  const approvedAt = toOptionalIso(input.approval?.approvedAt);
  const approvalEvidenceGeneratedAt = toOptionalIso(
    input.approval?.automatedEvidenceGeneratedAt,
  );

  if (!hasText(input.approval?.approvedBy)) {
    issues.push('approver is missing');
  }

  if (!approvedAt || timestampMs(approvedAt) === null) {
    issues.push('approval timestamp is missing or invalid');
  } else if ((timestampMs(approvedAt) ?? 0) > (timestampMs(input.generatedAt) ?? 0)) {
    issues.push('approval timestamp is in the future');
  }

  if (
    !input.automatedEvidenceGeneratedAt ||
    approvalEvidenceGeneratedAt !== input.automatedEvidenceGeneratedAt
  ) {
    issues.push('approval does not reference the current automated evidence timestamp');
  }

  if (
    !input.providerProfile ||
    input.approval?.providerProfile !== input.providerProfile
  ) {
    issues.push('approval does not match the current provider profile');
  }

  return issues;
}

function releaseEvidenceReviewItem(input: {
  id: PaymentsLaunchReleaseEvidenceReviewItemId;
  label: string;
  missing: boolean;
  issues: string[];
  readyEvidence: string;
  pendingEvidence: string;
}): PaymentsLaunchReleaseEvidenceReviewItem {
  const status: PaymentsLaunchReleaseEvidenceReviewItemStatus = input.missing
    ? 'pending'
    : input.issues.length > 0
      ? 'blocked'
      : 'ready';

  return {
    id: input.id,
    label: input.label,
    status,
    evidence:
      status === 'ready'
        ? input.readyEvidence
        : status === 'pending'
          ? input.pendingEvidence
          : input.issues.join('; '),
    blocker: status === 'blocked',
  };
}

function releaseEvidenceReviewStatusLabel(
  status: PaymentsLaunchReleaseEvidenceReviewStatus,
): string {
  if (status === 'ready_for_release_owner_review') {
    return 'Ready for release-owner review';
  }
  return status === 'pending' ? 'Pending' : 'Blocked';
}

function hiddenStateAcknowledgementIssues(input: {
  acknowledgement: PaymentsLaunchHiddenStateAcknowledgement | null;
  releaseOwnerSignoff: PaymentsLaunchReleaseOwnerSignoff | null;
  generatedAt: string;
  automatedEvidenceGeneratedAt: string | null;
  providerProfile: PaymentsLaunchSandboxProviderProfile | null;
  paymentsFeatureHidden: boolean;
}): string[] {
  const issues = approvalReferenceIssues({
    approval: input.acknowledgement,
    generatedAt: input.generatedAt,
    automatedEvidenceGeneratedAt: input.automatedEvidenceGeneratedAt,
    providerProfile: input.providerProfile,
  });

  if (!hasText(input.acknowledgement?.releaseTicketId)) {
    issues.push('hidden-state acknowledgement release ticket is missing');
  }

  if (
    !input.acknowledgement?.targetReleaseState ||
    input.acknowledgement.targetReleaseState === 'hidden'
  ) {
    issues.push('hidden-state acknowledgement does not target a visible release state');
  }

  if (input.acknowledgement?.paymentsFeatureHiddenAcknowledged !== true) {
    issues.push('hidden release state has not been explicitly acknowledged');
  }

  if (!input.paymentsFeatureHidden) {
    issues.push('current release-state evidence says payments is already visible');
  }

  if (
    hasText(input.acknowledgement?.releaseTicketId) &&
    hasText(input.releaseOwnerSignoff?.releaseTicketId) &&
    input.acknowledgement?.releaseTicketId !== input.releaseOwnerSignoff?.releaseTicketId
  ) {
    issues.push('hidden-state acknowledgement release ticket does not match release-owner signoff');
  }

  if (
    input.acknowledgement?.targetReleaseState &&
    input.releaseOwnerSignoff?.targetReleaseState &&
    input.acknowledgement.targetReleaseState !== input.releaseOwnerSignoff.targetReleaseState
  ) {
    issues.push('hidden-state acknowledgement target release state does not match release-owner signoff');
  }

  return issues;
}

function summarizeMatrixReport(
  report: PaymentsLaunchReconciliationStatusMatrixReport | null,
): string {
  if (!report) {
    return 'Status-matrix reconciliation fixtures have not run.';
  }

  return `${report.fixtures.filter((fixture) => fixture.passed).length}/${report.fixtures.length} status-matrix fixtures passed for ${report.providerProfile}.`;
}

function summarizeDisputeOpsChecklist(
  checklist: PaymentsDisputeOpsChecklist | null,
): string {
  if (!checklist) {
    return 'Dispute operations checklist has not been attached.';
  }

  return checklist.operatorLines.join(' ');
}

function operatorRunbookSection(input: {
  id: PaymentsLaunchOperatorRunbookSectionId;
  title: string;
  status: PaymentsLaunchGateStatus;
  summary: string;
  evidenceLines?: string[];
}): PaymentsLaunchOperatorRunbookSection {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    summary: input.summary,
    evidenceLines: (input.evidenceLines ?? []).filter(hasText),
  };
}

function addOperatorRunbookReason(
  reasons: PaymentsLaunchOperatorRunbookReason[],
  input: {
    id: PaymentsLaunchOperatorRunbookReasonId;
    label: string;
    evidence: string;
  },
): void {
  if (reasons.some((reason) => reason.id === input.id)) {
    return;
  }

  reasons.push({
    ...input,
    blocker: true,
  });
}

function approvalPacketEvidenceText(
  packet: PaymentsLaunchReleaseApprovalPacket | null,
): string {
  return packet?.items.map((item) => item.evidence).join(' ') ?? '';
}

function providerProfilesDisagree(input: {
  expectedProviderProfile: PaymentsLaunchSandboxProviderProfile | null;
  report: PaymentsProviderSandboxDrillReport | null;
  matrixReport: PaymentsLaunchReconciliationStatusMatrixReport | null;
  packet: PaymentsLaunchReleaseApprovalPacket | null;
}): boolean {
  const profiles = [
    input.expectedProviderProfile,
    input.report?.providerProfile ?? null,
    input.matrixReport?.providerProfile ?? null,
    input.packet?.providerProfile ?? null,
  ].filter((profile): profile is PaymentsLaunchSandboxProviderProfile => profile !== null);

  return new Set(profiles).size > 1;
}

function operatorRunbookLines(input: {
  decision: PaymentsLaunchOperatorRunbookDecision;
  reasons: PaymentsLaunchOperatorRunbookReason[];
  sections: PaymentsLaunchOperatorRunbookSection[];
}): string[] {
  const summary =
    input.decision === 'ready_for_release_owner_review'
      ? 'MyPay launch packet is ready for release-owner review.'
      : `Do not launch MyPay: ${input.reasons.length} blocker${input.reasons.length === 1 ? '' : 's'} remain.`;

  return [
    summary,
    ...input.sections.map(
      (section) => `${section.title}: ${section.status}. ${section.summary}`,
    ),
    ...input.reasons.map(
      (reason) => `Do not launch: ${reason.label}. ${reason.evidence}`,
    ),
  ];
}

export function createPaymentsLaunchSandboxWalletHomeSnapshot(input: {
  serverRefreshedAt?: string | Date;
} = {}): PaymentsWalletHomeSnapshot {
  const serverRefreshedAt = toIso(input.serverRefreshedAt ?? DEFAULT_NOW_ISO);
  const profile = buildPaymentsProfile({
    ownerUserId: PAYMENTS_LAUNCH_SANDBOX_OWNER_USER_ID,
    primaryWalletId: PAYMENTS_LAUNCH_SANDBOX_WALLET_ID,
    handle: '@trey',
    displayName: 'Trey',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
    fields: {
      legalName: 'Trey Example',
      email: 'trey@example.com',
      phoneE164: '+15555550123',
      dateOfBirth: '1990-01-01',
      addressLine1: '1 Main St',
      city: 'Austin',
      regionCode: 'TX',
      postalCode: '78701',
      governmentIdLast4: '1234',
    },
  });
  const linkedAccounts: PaymentsWalletLinkedAccount[] = [
    {
      id: 'bank_thread_primary',
      label: 'Primary checking',
      institutionName: 'Thread Bank',
      kind: 'bank',
      verificationState: 'verified',
      last4: '6789',
      primary: true,
    },
  ];
  const recentActivity: PaymentActivityItem[] = [
    {
      id: 'activity_sandbox_p2p_dinner',
      title: 'Dinner split',
      subtitle: 'Avery Stone',
      amountCents: 4825,
      currency: 'USD',
      direction: 'incoming',
      status: 'posted',
      rail: 'wallet',
      occurredAt: '2026-04-24T16:20:00.000Z',
    },
    {
      id: 'activity_sandbox_add_money',
      title: 'Add money',
      subtitle: 'Thread Bank',
      amountCents: 2450,
      currency: 'USD',
      direction: 'incoming',
      status: 'pending',
      rail: 'bank',
      occurredAt: '2026-04-24T15:05:00.000Z',
      pendingReason: 'Provider settlement pending',
    },
    {
      id: 'activity_sandbox_refund',
      title: 'Merchant refund',
      subtitle: 'Receipt and reversal hook',
      amountCents: 1899,
      currency: 'USD',
      direction: 'incoming',
      status: 'posted',
      rail: 'wallet',
      occurredAt: '2026-04-23T19:30:00.000Z',
    },
  ];

  return {
    profile,
    wallet: {
      walletId: PAYMENTS_LAUNCH_SANDBOX_WALLET_ID,
      ownerUserId: PAYMENTS_LAUNCH_SANDBOX_OWNER_USER_ID,
      status: 'active',
      defaultCurrency: 'USD',
      balances: {
        available: 12840,
        pending: 2450,
        reserved: 0,
        escrow: 0,
      },
      complianceHold: 'none',
      sendLimitRemainingCents: 50_000,
      receiveLimitRemainingCents: 75_000,
    },
    linkedAccounts,
    recentActivity,
    systemMode: 'operational',
    serverRefreshedAt,
    realtime: {
      connected: true,
      lastEventAt: serverRefreshedAt,
      pollingFallbackMs: SERVER_REFRESH_MS,
    },
    partnerBankName: 'Thread Bank',
    custodialEntityName: 'MyPay Custody Partner',
    supportContact: 'support@mylife.app',
  };
}

export async function runPaymentsProviderSandboxDrills(
  input: RunPaymentsProviderSandboxDrillsInput = {},
): Promise<PaymentsProviderSandboxDrillReport> {
  const providerProfile = input.providerProfile ?? 'synctera';
  const now = input.now ?? (() => new Date(DEFAULT_NOW_ISO));
  const createId = input.createId ?? createSequentialIdFactory();
  const nowIso = now().toISOString();
  const bundle = createSandboxPaymentsProviderBundle(providerProfile);
  const providerContext: PaymentsProviderContext = {
    actorUserId: 'user_launch_operator',
    requestId: 'req_launch_readiness',
    now,
  };
  const executionContext: PaymentsExecutionContext = {
    wallets: {
      [SOURCE_WALLET_ID]: createLaunchWallet({
        walletId: SOURCE_WALLET_ID,
        ownerUserId: 'user_launch_sender',
        availableCents: 150_000,
      }),
      [DESTINATION_WALLET_ID]: createLaunchWallet({
        walletId: DESTINATION_WALLET_ID,
        ownerUserId: 'user_launch_recipient',
        availableCents: 0,
      }),
      [SETTLEMENT_WALLET_ID]: createLaunchWallet({
        walletId: SETTLEMENT_WALLET_ID,
        ownerUserId: 'system_launch_settlement',
        availableCents: 1_000_000,
        pendingCents: 1_000_000,
      }),
    },
  };
  const engine = createPaymentsDomainEngine({
    now,
    createId,
  });
  let sendTransfer: PaymentsPostedTransfer | null = null;
  let providerTransferId: string | null = null;
  let reconciliation: PaymentsReconciliationReport | null = null;
  const drills: PaymentsLaunchDrillResult[] = [];

  drills.push(await runDrill('send', 'Send transfer and idempotency replay', async () => {
    const command = {
      type: 'send' as const,
      sourceWalletId: SOURCE_WALLET_ID,
      destinationWalletId: DESTINATION_WALLET_ID,
      amountCents: 2_500,
      currency: 'USD' as const,
      desiredStatus: 'completed' as const,
      speed: 'standard' as const,
      idempotencyKey: 'launch_send_idempotency',
      memo: 'Launch readiness send drill',
    };
    const firstResult = engine.execute(command, executionContext);
    const replayResult = engine.execute(command, executionContext);

    if (!isTransferResult(firstResult) || !isTransferResult(replayResult)) {
      return {
        passed: false,
        evidence: 'Domain engine did not return a transfer result for send.',
        code: 'invalid_result',
      };
    }

    sendTransfer = firstResult.transfer;
    const providerResult = await bundle.domesticWallets.createTransfer(
      {
        ledgerTransactionId: firstResult.transfer.transferId,
        transferType: 'wallet_to_wallet',
        amountCents: firstResult.transfer.sourceAmountCents,
        currency: firstResult.transfer.sourceCurrency,
        sourceAccountId: firstResult.transfer.sourceWalletId ?? SOURCE_WALLET_ID,
        destinationAccountId:
          firstResult.transfer.destinationWalletId ?? DESTINATION_WALLET_ID,
        idempotencyKey: command.idempotencyKey,
        memo: command.memo,
      },
      providerContext,
    );

    if (providerResult.ok) {
      providerTransferId = providerResult.data.providerReference;
    }

    const replayedSameTransfer =
      replayResult.replayed &&
      replayResult.transfer.transferId === firstResult.transfer.transferId;
    return {
      passed: providerResult.ok && replayedSameTransfer,
      evidence: providerResult.ok
        ? `Sandbox send accepted ${providerResult.data.providerReference}; idempotent replay returned the original transfer.`
        : providerResult.message,
      code: providerResultCode(providerResult),
    };
  }));

  drills.push(await runDrill('funding', 'Funding intent path', async () => {
    const commandResult = engine.execute(
      {
        type: 'fund',
        settlementWalletId: SETTLEMENT_WALLET_ID,
        destinationWalletId: SOURCE_WALLET_ID,
        amountCents: 10_000,
        currency: 'USD',
        desiredStatus: 'pending_provider',
        speed: 'standard',
        sourceRail: 'bank',
        idempotencyKey: 'launch_funding_idempotency',
        memo: 'Launch readiness funding drill',
      },
      executionContext,
    );
    const providerResult = await bundle.bankLinkFunding.createFundingIntent(
      {
        walletId: SOURCE_WALLET_ID,
        linkedAccountId: 'linked_launch_bank',
        amountCents: 10_000,
        currency: 'USD',
        idempotencyKey: 'launch_funding_idempotency',
      },
      providerContext,
    );

    return {
      passed: isTransferResult(commandResult) && providerResult.ok,
      evidence: providerResult.ok
        ? `Sandbox funding intent ${providerResult.data.providerFundingId} is ${providerResult.data.state}.`
        : providerResult.message,
      code: providerResultCode(providerResult),
    };
  }));

  drills.push(await runDrill('card', 'Card issuing path', async () => {
    const providerResult = await bundle.cardIssuing.issueCard(
      {
        walletId: SOURCE_WALLET_ID,
        ownerUserId: 'user_launch_sender',
        cardholderName: 'Launch Drill',
        cardType: 'virtual',
        currency: 'USD',
        spendLimitCents: 50_000,
      },
      providerContext,
    );

    return {
      passed: providerResult.ok,
      evidence: providerResult.ok
        ? `Sandbox card ${providerResult.data.providerCardId} issued ${providerResult.data.network} ${providerResult.data.last4}.`
        : providerResult.message,
      code: providerResultCode(providerResult),
    };
  }));

  drills.push(await runDrill('remittance', 'Remittance quote and settlement path', async () => {
    const quote = await bundle.remittances.quote(
      {
        sourceAmountCents: 20_000,
        sourceCurrency: 'USD',
        destinationCurrency: 'MXN',
        corridor: 'US-MX',
        recipientCountryCode: 'MX',
      },
      providerContext,
    );

    if (!quote.ok) {
      return {
        passed: false,
        evidence: quote.message,
        code: quote.code,
      };
    }

    const settlement = await bundle.remittances.settle(
      {
        remittanceId: 'remittance_launch_drill',
        quoteId: quote.data.quoteId,
        sourceAmountCents: 20_000,
        sourceCurrency: 'USD',
        destinationAmountCents: quote.data.destinationAmountCents,
        destinationCurrency: 'MXN',
        recipientCountryCode: 'MX',
        idempotencyKey: 'launch_remittance_idempotency',
      },
      providerContext,
    );

    return {
      passed: settlement.ok,
      evidence: settlement.ok
        ? `Sandbox remittance quote ${quote.data.quoteId} settled as ${settlement.data.providerRemittanceId}.`
        : settlement.message,
      code: providerResultCode(settlement),
    };
  }));

  drills.push(await runDrill('reconciliation', 'Reconciliation clean-run path', async () => {
    if (!sendTransfer || !providerTransferId) {
      return {
        passed: false,
        evidence: 'Send drill did not produce a provider-backed transfer to reconcile.',
        code: 'missing_transfer',
      };
    }

    const proofInputs = buildBalanceProofInputs({
      providerProfile,
      transfer: sendTransfer,
      providerTransferId,
      nowIso,
    });
    reconciliation = await runPaymentsReconciliationJob({
      environment: 'sandbox',
      providerProfile,
      bundleKind: 'sandbox',
      ...proofInputs,
      now,
      createId,
    });

    return {
      passed: reconciliation.sandboxReady && !reconciliation.launchBlocked,
      evidence: reconciliation.operatorLines.join(' '),
      code: reconciliation.launchBlocked ? 'reconciliation_blocked' : null,
    };
  }));

  drills.push(await runDrill('dispute', 'Dispute and hold workflow path', async () => {
    if (!sendTransfer) {
      return {
        passed: false,
        evidence: 'Send drill did not produce a transfer for dispute workflow.',
        code: 'missing_transfer',
      };
    }

    const domainResult = engine.execute(
      {
        type: 'dispute_open',
        transfer: sendTransfer,
        reason: 'Customer reported an unauthorized launch-drill transfer.',
        idempotencyKey: 'launch_dispute_idempotency',
      },
      executionContext,
    );
    const disputeCase = createPaymentsDisputeCase({
      ownerUserId: 'user_launch_sender',
      walletId: SOURCE_WALLET_ID,
      transfer: sendTransfer,
      transferOccurredAt: nowIso,
      now: now(),
      reasonCode: 'unauthorized_transfer',
      userStatement: 'Customer reports this launch readiness transfer was not authorized.',
      createId,
    });
    const submittedCase = applyPaymentsDisputeOperatorAction({
      disputeCase,
      actionType: 'submit_to_provider',
      actedAt: nowIso,
      actorUserId: 'operator_launch',
      note: 'Launch readiness provider submission drill.',
    });
    const providerResult = await bundle.cardIssuing.openDispute(
      {
        ledgerTransactionId: sendTransfer.transferId,
        reason: 'fraud launch readiness dispute',
        description: 'Provider sandbox dispute drill.',
      },
      providerContext,
    );
    const domainDisputed =
      domainResult.kind === 'transfer_status' &&
      domainResult.transfer.status === 'disputed';

    return {
      passed:
        domainDisputed &&
        submittedCase.status === 'submitted_to_provider' &&
        providerResult.ok,
      evidence: providerResult.ok
        ? `Dispute case ${submittedCase.caseId} submitted and provider reference ${providerResult.data.disputeReference} opened.`
        : providerResult.message,
      code: providerResultCode(providerResult),
    };
  }));

  drills.push(await runDrill('degraded_fail_closed', 'Degraded mode fail-closed path', async () => {
    const availability = buildPaymentsAvailabilityViewModel({
      checks: [
        {
          capability: 'send',
          health: 'disabled',
          reason: 'Provider timeout drill.',
        },
        {
          capability: 'funding',
          health: 'disabled',
          reason: 'Funding rail disabled during launch drill.',
        },
        {
          capability: 'card',
          health: 'disabled',
          reason: 'Card issuing disabled during launch drill.',
        },
        {
          capability: 'remittance',
          health: 'disabled',
          reason: 'Remittance rail disabled during launch drill.',
        },
      ],
    });
    const actionsDisabled = Object.values(availability.actions).every(
      (action) => !action.enabled,
    );

    return {
      passed: availability.readOnly && actionsDisabled,
      evidence: availability.banner?.body ?? 'Availability did not return a degraded-mode banner.',
      code: availability.readOnly && actionsDisabled ? null : 'fail_open',
    };
  }));

  const launchBlocked = drills.some((drill) => drill.blocking);
  const allAutomatedPassed = !launchBlocked;
  const reconciliationReport = reconciliation as unknown as PaymentsReconciliationReport | null;

  return {
    generatedAt: nowIso,
    providerProfile,
    bundleKind: 'sandbox',
    allAutomatedPassed,
    launchBlocked,
    drills,
    reconciliation: reconciliationReport,
    operatorLines: [
      ...drills.map((drill) => `${drill.label}: ${drill.status}. ${drill.evidence}`),
      ...(reconciliationReport?.operatorLines ?? []),
    ],
  };
}

export async function runPaymentsLaunchReconciliationStatusMatrix(
  input: RunPaymentsLaunchReconciliationStatusMatrixInput = {},
): Promise<PaymentsLaunchReconciliationStatusMatrixReport> {
  const providerProfile = input.providerProfile ?? 'synctera';
  const now = input.now ?? (() => new Date(DEFAULT_NOW_ISO));
  const createId = input.createId ?? createSequentialIdFactory();
  const generatedAt = now().toISOString();
  const fixtures: PaymentsLaunchReconciliationFixtureResult[] = [];

  for (const fixture of RECONCILIATION_STATUS_FIXTURES) {
    const report = await runPaymentsReconciliationJob({
      environment: 'sandbox',
      providerProfile,
      bundleKind: 'sandbox',
      ...buildStatusMatrixReconciliationInput({
        fixture,
        providerProfile,
        nowIso: generatedAt,
      }),
      now,
      createId,
    });
    const passed =
      report.sandboxReady &&
      !report.launchBlocked &&
      report.breaks.length === 0 &&
      report.summary.matchedTransfers === 1;

    fixtures.push({
      id: fixture.id,
      label: fixture.label,
      localStatus: fixture.localStatus,
      remoteStatus: fixture.remoteStatus,
      transferKind: fixture.transferKind,
      passed,
      evidence: report.operatorLines.join(' '),
      report,
    });
  }

  const allFixturesPassed = fixtures.every((fixture) => fixture.passed);

  return {
    generatedAt,
    providerProfile,
    allFixturesPassed,
    launchBlocked: !allFixturesPassed,
    fixtures,
    operatorLines: fixtures.map(
      (fixture) =>
        `${fixture.label}: ${fixture.passed ? 'passed' : 'blocked'} local ${fixture.localStatus} against provider ${fixture.remoteStatus}.`,
    ),
  };
}

export function buildPaymentsDisputeOpsChecklist(
  input: BuildPaymentsDisputeOpsChecklistInput = {},
): PaymentsDisputeOpsChecklist {
  const generatedAt = toIso(input.generatedAt ?? DEFAULT_NOW_ISO);
  const ledgerAuthorityPassed =
    Boolean(input.ledgerActionApproverRole) &&
    input.ledgerActionDualControl === true;
  const provisionalCreditWindowDays = input.provisionalCreditWindowDays ?? null;
  const provisionalCreditPassed =
    provisionalCreditWindowDays !== null &&
    provisionalCreditWindowDays > 0 &&
    provisionalCreditWindowDays <= DISPUTE_PROVISIONAL_CREDIT_LIMIT_DAYS;
  const items: PaymentsDisputeOpsChecklistItem[] = [
    checklistItem({
      id: 'ledger_action_authority',
      label: 'Ledger action authority',
      passed: ledgerAuthorityPassed,
      evidence: ledgerAuthorityPassed
        ? `${input.ledgerActionApproverRole} is recorded with dual-control approval for dispute ledger moves.`
        : 'Record the role allowed to approve dispute ledger moves and require dual-control approval.',
    }),
    checklistItem({
      id: 'provisional_credit_timing',
      label: 'Provisional credit timing',
      passed: provisionalCreditPassed,
      evidence: provisionalCreditPassed
        ? `Provisional-credit decision target is ${provisionalCreditWindowDays} day${provisionalCreditWindowDays === 1 ? '' : 's'}, inside the ${DISPUTE_PROVISIONAL_CREDIT_LIMIT_DAYS}-day launch limit.`
        : `Set a provisional-credit decision target between 1 and ${DISPUTE_PROVISIONAL_CREDIT_LIMIT_DAYS} days.`,
    }),
    checklistItem({
      id: 'closure_notices',
      label: 'Closure notices',
      passed: input.closureNoticeTemplateApproved === true,
      evidence: input.closureNoticeTemplateApproved
        ? 'Customer closure notice templates are approved for dispute outcomes.'
        : 'Approve customer closure notices for won, lost, denied, reversed, and refunded outcomes.',
    }),
    checklistItem({
      id: 'audit_evidence',
      label: 'Audit evidence',
      passed: input.auditEvidenceSinkConfigured === true,
      evidence: input.auditEvidenceSinkConfigured
        ? 'Audit evidence sink is configured for case, provider, ledger, notice, and operator-action records.'
        : 'Configure audit evidence retention for case, provider, ledger, notice, and operator-action records.',
    }),
  ];
  const ready = items.every((item) => item.status === 'passed');

  return {
    generatedAt,
    ready,
    items,
    operatorLines: items.map(
      (item) => `${item.label}: ${item.status}. ${item.evidence}`,
    ),
  };
}

export function buildPaymentsLaunchReleaseApprovalPacket(
  input: BuildPaymentsLaunchReleaseApprovalPacketInput = {},
): PaymentsLaunchReleaseApprovalPacket {
  const generatedAt = toIso(input.generatedAt ?? DEFAULT_NOW_ISO);
  const maxEvidenceAgeMs =
    input.maxEvidenceAgeMs ?? DEFAULT_RELEASE_EVIDENCE_MAX_AGE_MS;
  const report = input.providerDrillReport ?? null;
  const matrixReport = input.reconciliationStatusMatrixReport ?? null;
  const disputeOpsChecklist = input.disputeOpsChecklist ?? null;
  const providerProfile = report?.providerProfile ?? matrixReport?.providerProfile ?? null;
  const automatedEvidenceGeneratedAt =
    report?.generatedAt ?? matrixReport?.generatedAt ?? disputeOpsChecklist?.generatedAt ?? null;
  const automatedIssues: string[] = [];

  if (!report) {
    automatedIssues.push('provider sandbox drill report is missing');
  } else if (!report.allAutomatedPassed || report.launchBlocked) {
    automatedIssues.push('provider sandbox drills are not passing');
  }

  if (!matrixReport) {
    automatedIssues.push('reconciliation status matrix is missing');
  } else if (!matrixReport.allFixturesPassed || matrixReport.launchBlocked) {
    automatedIssues.push('reconciliation status matrix is not passing');
  }

  if (!disputeOpsChecklist) {
    automatedIssues.push('dispute operations checklist is missing');
  } else if (!disputeOpsChecklist.ready) {
    automatedIssues.push('dispute operations checklist is not ready');
  }

  if (
    input.expectedProviderProfile &&
    providerProfile !== input.expectedProviderProfile
  ) {
    automatedIssues.push('provider profile does not match the expected launch profile');
  }

  if (report && matrixReport && report.providerProfile !== matrixReport.providerProfile) {
    automatedIssues.push('provider drill and matrix provider profiles do not match');
  }

  const evidenceTimes = [
    report?.generatedAt ?? null,
    matrixReport?.generatedAt ?? null,
    disputeOpsChecklist?.generatedAt ?? null,
  ].filter((value): value is string => value !== null);
  const timestampsAligned =
    evidenceTimes.length === 3 &&
    evidenceTimes.every((value) => value === automatedEvidenceGeneratedAt);

  if (!timestampsAligned) {
    automatedIssues.push('automated evidence timestamps do not match');
  }

  const generatedAtMs = timestampMs(generatedAt);
  for (const evidenceTime of evidenceTimes) {
    const evidenceTimeMs = timestampMs(evidenceTime);
    if (
      generatedAtMs === null ||
      evidenceTimeMs === null ||
      evidenceTimeMs > generatedAtMs ||
      generatedAtMs - evidenceTimeMs > maxEvidenceAgeMs
    ) {
      automatedIssues.push('automated evidence is stale or timestamped in the future');
      break;
    }
  }

  const automatedEvidenceReady = automatedIssues.length === 0;
  const automatedItem = releaseApprovalItem({
    id: 'automated_evidence',
    label: 'Automated launch evidence',
    passed: automatedEvidenceReady,
    evidence: automatedEvidenceReady
      ? `Automated evidence ${automatedEvidenceGeneratedAt} is current for ${providerProfile}.`
      : automatedIssues.join('; '),
    missing: evidenceTimes.length === 0,
  });

  const legalIssues = approvalReferenceIssues({
    approval: input.legalReview,
    generatedAt,
    automatedEvidenceGeneratedAt,
    providerProfile,
  });
  if (!hasText(input.legalReview?.copySetVersion)) {
    legalIssues.push('legal copy set version is missing');
  }
  if (input.legalReview?.storedBalanceCopyApproved !== true) {
    legalIssues.push('stored-balance copy is not approved');
  }
  if (input.legalReview?.partnerBankCopyApproved !== true) {
    legalIssues.push('partner-bank copy is not approved');
  }
  if (input.legalReview?.custodialCopyApproved !== true) {
    legalIssues.push('custodial copy is not approved');
  }
  if (input.legalReview?.remittanceCancellationCopyApproved !== true) {
    legalIssues.push('remittance cancellation copy is not approved');
  }
  if (input.legalReview?.errorResolutionCopyApproved !== true) {
    legalIssues.push('error-resolution copy is not approved');
  }
  if (!automatedEvidenceReady) {
    legalIssues.push('automated launch evidence is not ready');
  }
  const legalReviewApproved =
    automatedEvidenceReady && input.legalReview !== null && legalIssues.length === 0;
  const legalItem = releaseApprovalItem({
    id: 'legal_review',
    label: 'Legal review',
    passed: legalReviewApproved,
    evidence: legalReviewApproved
      ? `Legal copy set ${input.legalReview?.copySetVersion} approved by ${input.legalReview?.approvedBy}.`
      : legalIssues.join('; '),
    missing: !input.legalReview,
  });

  const pilotIssues = approvalReferenceIssues({
    approval: input.pilotApproval,
    generatedAt,
    automatedEvidenceGeneratedAt,
    providerProfile,
  });
  if (!hasText(input.pilotApproval?.cohortId)) {
    pilotIssues.push('pilot cohort is missing');
  }
  if (!hasText(input.pilotApproval?.limitProfileId)) {
    pilotIssues.push('pilot limit profile is missing');
  }
  if (!hasText(input.pilotApproval?.monitoringPlanId)) {
    pilotIssues.push('pilot monitoring plan is missing');
  }
  if (!hasText(input.pilotApproval?.rollbackPlanId)) {
    pilotIssues.push('pilot rollback plan is missing');
  }
  if (input.pilotApproval?.corridorConfigurationReviewed !== true) {
    pilotIssues.push('pilot remittance corridor configuration is not reviewed');
  }
  if (!automatedEvidenceReady) {
    pilotIssues.push('automated launch evidence is not ready');
  }
  const pilotApproved =
    automatedEvidenceReady && input.pilotApproval !== null && pilotIssues.length === 0;
  const pilotItem = releaseApprovalItem({
    id: 'pilot_approval',
    label: 'Pilot approval',
    passed: pilotApproved,
    evidence: pilotApproved
      ? `Pilot ${input.pilotApproval?.cohortId} approved with limits ${input.pilotApproval?.limitProfileId}.`
      : pilotIssues.join('; '),
    missing: !input.pilotApproval,
  });

  const releaseOwnerIssues = approvalReferenceIssues({
    approval: input.releaseOwnerSignoff,
    generatedAt,
    automatedEvidenceGeneratedAt,
    providerProfile,
  });
  if (!hasText(input.releaseOwnerSignoff?.releaseTicketId)) {
    releaseOwnerIssues.push('release ticket is missing');
  }
  if (
    !input.releaseOwnerSignoff?.targetReleaseState ||
    input.releaseOwnerSignoff.targetReleaseState === 'hidden'
  ) {
    releaseOwnerIssues.push('release owner has not targeted a visible release state');
  }
  const paymentsFeatureHidden =
    input.releaseOwnerSignoff?.paymentsFeatureHidden ?? true;
  if (paymentsFeatureHidden) {
    releaseOwnerIssues.push('payments feature remains hidden');
  }
  if (!automatedEvidenceReady) {
    releaseOwnerIssues.push('automated launch evidence is not ready');
  }
  if (!legalReviewApproved) {
    releaseOwnerIssues.push('legal review is not approved');
  }
  if (!pilotApproved) {
    releaseOwnerIssues.push('pilot approval is not recorded');
  }
  const releaseOwnerSignedOff =
    automatedEvidenceReady &&
    legalReviewApproved &&
    pilotApproved &&
    input.releaseOwnerSignoff !== null &&
    releaseOwnerIssues.length === 0;
  const releaseOwnerItem = releaseApprovalItem({
    id: 'release_owner_signoff',
    label: 'Release owner signoff',
    passed: releaseOwnerSignedOff,
    evidence: releaseOwnerSignedOff
      ? `Release owner ${input.releaseOwnerSignoff?.approvedBy} signed ${input.releaseOwnerSignoff?.releaseTicketId}.`
      : releaseOwnerIssues.join('; '),
    missing: !input.releaseOwnerSignoff,
  });

  const items = [automatedItem, legalItem, pilotItem, releaseOwnerItem];
  const ready = items.every((item) => item.status === 'passed');

  return {
    generatedAt,
    providerProfile,
    automatedEvidenceGeneratedAt,
    automatedEvidenceReady,
    legalReviewApproved,
    pilotApproved,
    releaseOwnerSignedOff,
    releaseFlipEnabled: releaseOwnerSignedOff && !paymentsFeatureHidden,
    paymentsFeatureHidden,
    ready,
    items,
    operatorLines: items.map(
      (item) => `${item.label}: ${item.status}. ${item.evidence}`,
    ),
  };
}

export function buildPaymentsLaunchReleaseEvidenceReview(
  input: BuildPaymentsLaunchReleaseEvidenceReviewInput = {},
): PaymentsLaunchReleaseEvidenceReview {
  const generatedAt = toIso(input.generatedAt ?? DEFAULT_NOW_ISO);
  const releaseEvidence = input.releaseEvidence ?? {};
  const legalReview = releaseEvidence.legalReview ?? null;
  const pilotApproval = releaseEvidence.pilotApproval ?? null;
  const releaseOwnerSignoff = releaseEvidence.releaseOwnerSignoff ?? null;
  const hiddenStateAcknowledgement =
    releaseEvidence.hiddenStateAcknowledgement ?? null;
  const paymentsFeatureHidden = input.paymentsFeatureHidden ?? true;
  const approvalPacket = buildPaymentsLaunchReleaseApprovalPacket({
    providerDrillReport: input.providerDrillReport ?? null,
    reconciliationStatusMatrixReport:
      input.reconciliationStatusMatrixReport ?? null,
    disputeOpsChecklist: input.disputeOpsChecklist ?? null,
    legalReview,
    pilotApproval,
    releaseOwnerSignoff: releaseOwnerSignoff
      ? {
          ...releaseOwnerSignoff,
          paymentsFeatureHidden,
        }
      : null,
    expectedProviderProfile: input.expectedProviderProfile ?? null,
    maxEvidenceAgeMs: input.maxEvidenceAgeMs,
    generatedAt,
  });
  const approvalItem = (id: PaymentsLaunchReleaseApprovalItemId) =>
    approvalPacket.items.find((item) => item.id === id);
  const legalItem = approvalItem('legal_review');
  const pilotItem = approvalItem('pilot_approval');
  const automatedEvidenceReady = approvalPacket.automatedEvidenceReady;
  const providerProfile = approvalPacket.providerProfile;
  const automatedEvidenceGeneratedAt =
    approvalPacket.automatedEvidenceGeneratedAt;
  const releaseOwnerIssues = approvalReferenceIssues({
    approval: releaseOwnerSignoff,
    generatedAt,
    automatedEvidenceGeneratedAt,
    providerProfile,
  });

  if (!hasText(releaseOwnerSignoff?.releaseTicketId)) {
    releaseOwnerIssues.push('release ticket is missing');
  }
  if (
    !releaseOwnerSignoff?.targetReleaseState ||
    releaseOwnerSignoff.targetReleaseState === 'hidden'
  ) {
    releaseOwnerIssues.push('release owner has not targeted a visible release state');
  }
  if (
    releaseOwnerSignoff?.paymentsFeatureHidden !== undefined &&
    releaseOwnerSignoff.paymentsFeatureHidden !== paymentsFeatureHidden
  ) {
    releaseOwnerIssues.push('release-owner evidence does not match the current hidden release state');
  }
  if (!automatedEvidenceReady) {
    releaseOwnerIssues.push('automated launch evidence is not ready');
  }
  if (!approvalPacket.legalReviewApproved) {
    releaseOwnerIssues.push('legal review is not approved');
  }
  if (!approvalPacket.pilotApproved) {
    releaseOwnerIssues.push('pilot approval is not recorded');
  }

  const hiddenIssues = hiddenStateAcknowledgementIssues({
    acknowledgement: hiddenStateAcknowledgement,
    releaseOwnerSignoff,
    generatedAt,
    automatedEvidenceGeneratedAt,
    providerProfile,
    paymentsFeatureHidden,
  });
  const releaseTicketId =
    hiddenStateAcknowledgement?.releaseTicketId ??
    releaseOwnerSignoff?.releaseTicketId ??
    null;
  const targetReleaseState =
    hiddenStateAcknowledgement?.targetReleaseState ??
    releaseOwnerSignoff?.targetReleaseState ??
    null;
  const items: PaymentsLaunchReleaseEvidenceReviewItem[] = [
    releaseEvidenceReviewItem({
      id: 'legal_review',
      label: 'Legal review evidence',
      missing: legalReview === null,
      issues: legalItem && legalItem.status !== 'passed' ? [legalItem.evidence] : [],
      readyEvidence: legalItem?.evidence ?? 'Legal review evidence is valid.',
      pendingEvidence: 'Attach legal approval for the current automated evidence before release review.',
    }),
    releaseEvidenceReviewItem({
      id: 'pilot_approval',
      label: 'Pilot approval evidence',
      missing: pilotApproval === null,
      issues: pilotItem && pilotItem.status !== 'passed' ? [pilotItem.evidence] : [],
      readyEvidence: pilotItem?.evidence ?? 'Pilot approval evidence is valid.',
      pendingEvidence: 'Attach pilot approval for the current automated evidence before release review.',
    }),
    releaseEvidenceReviewItem({
      id: 'release_owner_signoff',
      label: 'Release-owner evidence',
      missing: releaseOwnerSignoff === null,
      issues: releaseOwnerIssues,
      readyEvidence: `Release-owner evidence references ${releaseTicketId ?? 'the release ticket'} for ${targetReleaseState ?? 'the target release state'}.`,
      pendingEvidence: 'Attach release-owner evidence with ticket, visible target state, provider profile, and current evidence timestamp.',
    }),
    releaseEvidenceReviewItem({
      id: 'hidden_state_acknowledgement',
      label: 'Hidden-state acknowledgement',
      missing: hiddenStateAcknowledgement === null,
      issues: hiddenIssues,
      readyEvidence: '`payments` remains hidden and the operator evidence explicitly acknowledges the separate release-state change.',
      pendingEvidence: 'Attach explicit acknowledgement that `payments` remains hidden until an approved registry release-state change lands.',
    }),
  ];
  const blockedCount = items.filter((item) => item.status === 'blocked').length;
  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const status: PaymentsLaunchReleaseEvidenceReviewStatus =
    blockedCount > 0
      ? 'blocked'
      : pendingCount > 0
        ? 'pending'
        : 'ready_for_release_owner_review';
  const statusLabel = releaseEvidenceReviewStatusLabel(status);
  const summary =
    status === 'ready_for_release_owner_review'
      ? 'Captured legal, pilot, release-owner, and hidden-state evidence references the current automated launch evidence. The registry release-state change remains a separate approval step.'
      : status === 'pending'
        ? `${pendingCount} release evidence item${pendingCount === 1 ? '' : 's'} still need operator attachment before release-owner review.`
        : `${blockedCount} release evidence item${blockedCount === 1 ? '' : 's'} failed validation against the current launch packet.`;

  return {
    generatedAt,
    providerProfile,
    automatedEvidenceGeneratedAt,
    status,
    statusLabel,
    summary,
    paymentsFeatureHidden,
    releaseTicketId,
    targetReleaseState,
    approvalPacket,
    items,
    operatorLines: [
      `Captured release evidence: ${statusLabel}. ${summary}`,
      ...items.map((item) => `${item.label}: ${item.status}. ${item.evidence}`),
    ],
  };
}

export function buildPaymentsLaunchOperatorRunbook(
  input: BuildPaymentsLaunchOperatorRunbookInput = {},
): PaymentsLaunchOperatorRunbook {
  const report = input.providerDrillReport ?? null;
  const matrixReport = input.reconciliationStatusMatrixReport ?? null;
  const disputeOpsChecklist = input.disputeOpsChecklist ?? null;
  const packet = input.releaseApprovalPacket ?? null;
  const generatedAt = toIso(
    input.generatedAt ??
      packet?.generatedAt ??
      report?.generatedAt ??
      matrixReport?.generatedAt ??
      disputeOpsChecklist?.generatedAt ??
      DEFAULT_NOW_ISO,
  );
  const providerProfile =
    packet?.providerProfile ??
    report?.providerProfile ??
    matrixReport?.providerProfile ??
    input.expectedProviderProfile ??
    null;
  const paymentsFeatureHidden =
    input.paymentsFeatureHidden ?? packet?.paymentsFeatureHidden ?? true;
  const reasons: PaymentsLaunchOperatorRunbookReason[] = [];
  const failedDrills = report?.drills.filter((drill) => drill.blocking) ?? [];
  const failedFixtures =
    matrixReport?.fixtures.filter((fixture) => !fixture.passed) ?? [];
  const blockedDisputeItems =
    disputeOpsChecklist?.items.filter((item) => item.blocker) ?? [];
  const blockedApprovalItems = packet?.items.filter((item) => item.blocker) ?? [];
  const approvalText = approvalPacketEvidenceText(packet).toLowerCase();

  if (!report) {
    addOperatorRunbookReason(reasons, {
      id: 'provider_drills_missing',
      label: 'Provider sandbox drills are missing',
      evidence: 'Attach a current provider-sandbox drill report before release review.',
    });
  } else if (!report.allAutomatedPassed || report.launchBlocked) {
    addOperatorRunbookReason(reasons, {
      id: 'provider_drills_failed',
      label: 'Provider sandbox drills are not passing',
      evidence: `Failed drills: ${failedDrills.map((drill) => drill.label).join(', ') || 'unknown'}.`,
    });
  }

  if (!matrixReport) {
    addOperatorRunbookReason(reasons, {
      id: 'reconciliation_matrix_missing',
      label: 'Reconciliation status matrix is missing',
      evidence: 'Attach a current completed/reversed/failed/returned/disputed reconciliation matrix.',
    });
  } else if (!matrixReport.allFixturesPassed || matrixReport.launchBlocked) {
    addOperatorRunbookReason(reasons, {
      id: 'reconciliation_matrix_failed',
      label: 'Reconciliation status matrix is not clean',
      evidence: `Failed fixtures: ${failedFixtures.map((fixture) => fixture.label).join(', ') || 'unknown'}.`,
    });
  }

  if (!disputeOpsChecklist) {
    addOperatorRunbookReason(reasons, {
      id: 'dispute_ops_missing',
      label: 'Dispute operations checklist is missing',
      evidence: 'Attach dispute ledger authority, timing, notice, and audit evidence.',
    });
  } else if (!disputeOpsChecklist.ready) {
    addOperatorRunbookReason(reasons, {
      id: 'dispute_ops_blocked',
      label: 'Dispute operations are not launch-ready',
      evidence: `Blocked items: ${blockedDisputeItems.map((item) => item.label).join(', ') || 'unknown'}.`,
    });
  }

  if (!packet) {
    addOperatorRunbookReason(reasons, {
      id: 'approval_packet_missing',
      label: 'Release approval packet is missing',
      evidence: 'Attach legal, pilot, and release-owner evidence for the current automated evidence.',
    });
  } else if (!packet.ready) {
    addOperatorRunbookReason(reasons, {
      id: 'approval_packet_blocked',
      label: 'Release approval packet is blocked',
      evidence: `Blocked approvals: ${blockedApprovalItems.map((item) => item.label).join(', ') || 'unknown'}.`,
    });
  }

  if (packet && /stale|future|invalid timestamp/.test(approvalText)) {
    addOperatorRunbookReason(reasons, {
      id: 'approval_evidence_stale',
      label: 'Approval evidence is stale or invalid',
      evidence: 'The release approval packet references stale, invalid, or future-dated launch evidence.',
    });
  }

  if (
    packet &&
    /timestamps do not match|current automated evidence timestamp/.test(approvalText)
  ) {
    addOperatorRunbookReason(reasons, {
      id: 'approval_evidence_mismatch',
      label: 'Approval evidence timestamp does not match',
      evidence: 'Approval references must match the current automated launch evidence timestamp.',
    });
  }

  if (
    providerProfilesDisagree({
      expectedProviderProfile: input.expectedProviderProfile ?? null,
      report,
      matrixReport,
      packet,
    }) ||
    (packet !== null && approvalText.includes('provider profile'))
  ) {
    addOperatorRunbookReason(reasons, {
      id: 'provider_profile_mismatch',
      label: 'Provider profile does not match',
      evidence: 'Provider drills, reconciliation, approvals, and expected launch profile must reference the same provider.',
    });
  }

  if (paymentsFeatureHidden) {
    addOperatorRunbookReason(reasons, {
      id: 'payments_hidden',
      label: 'Payments is still hidden',
      evidence: '`payments` remains in the hidden release bucket and must not launch.',
    });
  }

  const sections: PaymentsLaunchOperatorRunbookSection[] = [
    operatorRunbookSection({
      id: 'provider_sandbox_drills',
      title: 'Provider sandbox drills',
      status: !report
        ? 'not_ready'
        : report.allAutomatedPassed && !report.launchBlocked
          ? 'passed'
          : 'blocked',
      summary: report
        ? `${report.drills.filter((drill) => drill.status === 'passed').length}/${report.drills.length} drills passed for ${report.providerProfile}.`
        : 'No provider-sandbox drill report is attached.',
      evidenceLines: report?.operatorLines,
    }),
    operatorRunbookSection({
      id: 'reconciliation_status_matrix',
      title: 'Reconciliation status matrix',
      status: !matrixReport
        ? 'not_ready'
        : matrixReport.allFixturesPassed && !matrixReport.launchBlocked
          ? 'passed'
          : 'blocked',
      summary: summarizeMatrixReport(matrixReport),
      evidenceLines: matrixReport?.operatorLines,
    }),
    operatorRunbookSection({
      id: 'dispute_operations',
      title: 'Dispute operations',
      status: !disputeOpsChecklist
        ? 'not_ready'
        : disputeOpsChecklist.ready
          ? 'passed'
          : 'blocked',
      summary: summarizeDisputeOpsChecklist(disputeOpsChecklist),
      evidenceLines: disputeOpsChecklist?.operatorLines,
    }),
    operatorRunbookSection({
      id: 'release_approval_packet',
      title: 'Release approval packet',
      status: !packet ? 'not_ready' : packet.ready ? 'passed' : 'blocked',
      summary: summarizeReleaseApprovalPacket(packet),
      evidenceLines: packet?.operatorLines,
    }),
    operatorRunbookSection({
      id: 'release_state',
      title: 'Release state',
      status: paymentsFeatureHidden ? 'blocked' : 'passed',
      summary: paymentsFeatureHidden
        ? '`payments` is still hidden and cannot launch.'
        : '`payments` is marked visible in the supplied release evidence.',
    }),
  ];
  const decision: PaymentsLaunchOperatorRunbookDecision =
    reasons.length === 0 ? 'ready_for_release_owner_review' : 'do_not_launch';

  return {
    generatedAt,
    providerProfile,
    paymentsFeatureHidden,
    decision,
    readyForReleaseOwnerReview: decision === 'ready_for_release_owner_review',
    doNotLaunchReasons: reasons,
    sections,
    operatorLines: operatorRunbookLines({
      decision,
      reasons,
      sections,
    }),
  };
}

export function buildPaymentsLaunchGateViewModel(
  input: BuildPaymentsLaunchGateViewModelInput = {},
): PaymentsLaunchGateViewModel {
  const report = input.providerDrillReport ?? null;
  const matrixReport = input.reconciliationStatusMatrixReport ?? null;
  const disputeOpsChecklist = input.disputeOpsChecklist ?? null;
  const releaseApprovalPacket = input.releaseApprovalPacket ?? null;
  const generatedAt = toIso(
    input.generatedAt ??
      report?.generatedAt ??
      matrixReport?.generatedAt ??
      disputeOpsChecklist?.generatedAt ??
      releaseApprovalPacket?.generatedAt ??
      new Date(DEFAULT_NOW_ISO),
  );
  const reconciliationStatus =
    report?.reconciliation?.sandboxReady &&
    !report.reconciliation.launchBlocked &&
    matrixReport?.allFixturesPassed
      ? 'passed'
      : report?.reconciliation || matrixReport
        ? 'blocked'
        : 'not_ready';
  const disputeStatus =
    statusFromDrill(report, 'dispute') === 'passed' && disputeOpsChecklist?.ready
      ? 'passed'
      : statusFromDrill(report, 'dispute') === 'passed' || disputeOpsChecklist
        ? 'blocked'
        : 'not_ready';
  const automatedStatus = report
    ? report.allAutomatedPassed &&
      matrixReport?.allFixturesPassed === true &&
      disputeOpsChecklist?.ready === true &&
      (releaseApprovalPacket?.automatedEvidenceReady ?? true)
      ? 'passed'
      : 'blocked'
    : 'not_ready';
  const legalReviewApproved = releaseApprovalPacket
    ? releaseApprovalPacket.legalReviewApproved
    : input.legalReviewApproved === true;
  const pilotApproved = releaseApprovalPacket
    ? releaseApprovalPacket.pilotApproved
    : input.pilotApproved === true;
  const releaseFlipEnabled = releaseApprovalPacket
    ? releaseApprovalPacket.releaseFlipEnabled
    : input.releaseFlipEnabled === true;
  const items: PaymentsLaunchGateItem[] = [
    gateItem({
      id: 'provider_sandbox_drills',
      label: 'Provider sandbox drills',
      status: automatedStatus,
      evidence: report
        ? `${report.drills.filter((drill) => drill.status === 'passed').length}/${report.drills.length} provider drills passed for ${report.providerProfile}. ${summarizeMatrixReport(matrixReport)} ${summarizeDisputeOpsChecklist(disputeOpsChecklist)} ${releaseApprovalEvidence(
            releaseApprovalPacket,
            'automated_evidence',
            '',
          )}`
        : 'Run provider-sandbox drills before release.',
    }),
    gateItem({
      id: 'reconciliation',
      label: 'Reconciliation clean run',
      status: reconciliationStatus,
      evidence:
        report?.reconciliation?.operatorLines.join(' ') && matrixReport
          ? `${report.reconciliation.operatorLines.join(' ')} ${summarizeMatrixReport(matrixReport)}`
          : report?.reconciliation?.operatorLines.join(' ') ??
            summarizeMatrixReport(matrixReport),
    }),
    gateItem({
      id: 'disputes_and_holds',
      label: 'Disputes and holds',
      status: disputeStatus,
      evidence: `${evidenceFromDrill(
        report,
        'dispute',
        'Run dispute and hold provider drills before release.',
      )} ${summarizeDisputeOpsChecklist(disputeOpsChecklist)}`,
    }),
    gateItem({
      id: 'degraded_fail_closed',
      label: 'Provider outage fail-closed',
      status: statusFromDrill(report, 'degraded_fail_closed'),
      evidence: evidenceFromDrill(
        report,
        'degraded_fail_closed',
        'Run degraded-mode fail-closed drill before release.',
      ),
    }),
    gateItem({
      id: 'legal_review',
      label: 'Legal review',
      status: legalReviewApproved ? 'passed' : 'manual_review',
      evidence: releaseApprovalEvidence(
        releaseApprovalPacket,
        'legal_review',
        legalReviewApproved
          ? 'Legal review approved for the current regulated copy set.'
          : 'Legal approval remains a documented manual release blocker.',
      ),
    }),
    gateItem({
      id: 'pilot',
      label: 'Pilot approval',
      status: pilotApproved ? 'passed' : 'manual_review',
      evidence: releaseApprovalEvidence(
        releaseApprovalPacket,
        'pilot_approval',
        pilotApproved
          ? 'Pilot approval recorded for release flip consideration.'
          : 'Pilot readiness remains a documented manual release blocker.',
      ),
    }),
  ];
  const priorItemsPassed = items.every((item) => item.status === 'passed');
  const releaseFlipStatus: PaymentsLaunchGateStatus = releaseFlipEnabled
    ? priorItemsPassed
      ? 'passed'
      : 'blocked'
    : priorItemsPassed
      ? 'manual_review'
      : 'blocked';

  items.push(gateItem({
    id: 'release_flip',
    label: 'Release flip',
    status: releaseFlipStatus,
    evidence: releaseApprovalEvidence(
      releaseApprovalPacket,
      'release_owner_signoff',
      releaseFlipEnabled
        ? 'Payments release flag is enabled after all pre-flip gates.'
        : 'Payments remains hidden until automated, legal, and pilot gates pass.',
    ),
  }));

  const releaseReady = items.every((item) => item.status === 'passed');
  const featureHidden =
    input.paymentsFeatureHidden ??
    releaseApprovalPacket?.paymentsFeatureHidden ??
    !releaseFlipEnabled;
  const blockerCount = items.filter((item) => item.blocker).length;

  return {
    generatedAt,
    releaseReady,
    hiddenUntilReady: featureHidden || !releaseReady,
    summary: releaseReady
      ? 'MyPay launch gates are passed and the release flag can stay on.'
      : `${blockerCount} MyPay launch gate${blockerCount === 1 ? '' : 's'} still block release. ${summarizeReleaseApprovalPacket(releaseApprovalPacket)}`,
    items,
  };
}
