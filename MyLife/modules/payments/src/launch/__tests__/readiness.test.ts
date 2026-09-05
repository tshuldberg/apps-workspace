import { describe, expect, it } from 'vitest';

import {
  buildPaymentsWalletHomeViewModel,
} from '../../wallet/home';
import {
  buildPaymentsDisputeOpsChecklist,
  buildPaymentsLaunchGateViewModel,
  buildPaymentsLaunchOperatorRunbook,
  buildPaymentsLaunchReleaseEvidenceReview,
  buildPaymentsLaunchReleaseApprovalPacket,
  createPaymentsLaunchSandboxWalletHomeSnapshot,
  runPaymentsLaunchReconciliationStatusMatrix,
  runPaymentsProviderSandboxDrills,
} from '../readiness';

const now = () => new Date('2026-04-24T16:30:00.000Z');

function createIdFactory() {
  let counter = 0;
  return (prefix: string) => `${prefix}_test_${++counter}`;
}

function buildReleaseApprovals(
  automatedEvidenceGeneratedAt: string,
  providerProfile: 'synctera' | 'unit' = 'synctera',
  paymentsFeatureHidden = false,
) {
  return {
    legalReview: {
      approvedBy: 'counsel@mylife.app',
      approvedAt: '2026-04-24T16:29:00.000Z',
      automatedEvidenceGeneratedAt,
      providerProfile,
      copySetVersion: 'payments-copy-2026-04-24',
      counselMatterId: 'legal-mypay-launch',
      storedBalanceCopyApproved: true,
      partnerBankCopyApproved: true,
      custodialCopyApproved: true,
      remittanceCancellationCopyApproved: true,
      errorResolutionCopyApproved: true,
    },
    pilotApproval: {
      approvedBy: 'pilot-owner@mylife.app',
      approvedAt: '2026-04-24T16:29:00.000Z',
      automatedEvidenceGeneratedAt,
      providerProfile,
      cohortId: 'pilot-internal-25',
      limitProfileId: 'pilot-low-limits-v1',
      monitoringPlanId: 'payments-monitoring-v1',
      rollbackPlanId: 'payments-rollback-v1',
      corridorConfigurationReviewed: true,
    },
    releaseOwnerSignoff: {
      approvedBy: 'release-owner@mylife.app',
      approvedAt: '2026-04-24T16:29:00.000Z',
      automatedEvidenceGeneratedAt,
      providerProfile,
      releaseTicketId: 'PAY-RELEASE-2026-04-24',
      targetReleaseState: 'public_beta' as const,
      paymentsFeatureHidden,
    },
  };
}

async function buildAutomatedLaunchEvidence() {
  const report = await runPaymentsProviderSandboxDrills({
    providerProfile: 'synctera',
    now,
    createId: createIdFactory(),
  });
  const matrixReport = await runPaymentsLaunchReconciliationStatusMatrix({
    providerProfile: 'synctera',
    now,
    createId: createIdFactory(),
  });
  const disputeOpsChecklist = buildPaymentsDisputeOpsChecklist({
    ledgerActionApproverRole: 'payments_ops_lead',
    ledgerActionDualControl: true,
    provisionalCreditWindowDays: 10,
    closureNoticeTemplateApproved: true,
    auditEvidenceSinkConfigured: true,
    generatedAt: report.generatedAt,
  });

  return {
    report,
    matrixReport,
    disputeOpsChecklist,
  };
}

describe('payments launch readiness helpers', () => {
  it('builds the wallet home sandbox snapshot from a module-level launch seam', () => {
    const snapshot = createPaymentsLaunchSandboxWalletHomeSnapshot({
      serverRefreshedAt: '2026-04-24T16:30:00.000Z',
    });
    const viewModel = buildPaymentsWalletHomeViewModel(snapshot);

    expect(snapshot.wallet?.walletId).toBe('wallet_mypay_sandbox');
    expect(snapshot.wallet?.ownerUserId).toBe('user_mypay_sandbox');
    expect(snapshot.recentActivity.map((item) => item.id)).toEqual([
      'activity_sandbox_p2p_dinner',
      'activity_sandbox_add_money',
      'activity_sandbox_refund',
    ]);
    expect(viewModel.balanceHero.canSend).toBe(true);
    expect(viewModel.quickActions.find((action) => action.id === 'send')?.enabled).toBe(true);
  });

  it('passes provider-sandbox drills for the full synctera sandbox profile', async () => {
    const report = await runPaymentsProviderSandboxDrills({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });

    expect(report.providerProfile).toBe('synctera');
    expect(report.bundleKind).toBe('sandbox');
    expect(report.allAutomatedPassed).toBe(true);
    expect(report.launchBlocked).toBe(false);
    expect(report.drills.map((drill) => drill.id)).toEqual([
      'send',
      'funding',
      'card',
      'remittance',
      'reconciliation',
      'dispute',
      'degraded_fail_closed',
    ]);
    expect(report.drills.every((drill) => drill.status === 'passed')).toBe(true);
    expect(report.drills.find((drill) => drill.id === 'send')?.evidence).toContain(
      'idempotent replay',
    );
    expect(report.reconciliation?.sandboxReady).toBe(true);
    expect(report.reconciliation?.launchBlocked).toBe(false);
  });

  it('blocks launch readiness when a sandbox provider cannot support a required rail', async () => {
    const report = await runPaymentsProviderSandboxDrills({
      providerProfile: 'unit',
      now,
      createId: createIdFactory(),
    });
    const cardDrill = report.drills.find((drill) => drill.id === 'card');

    expect(report.allAutomatedPassed).toBe(false);
    expect(report.launchBlocked).toBe(true);
    expect(cardDrill?.status).toBe('failed');
    expect(cardDrill?.code).toBe('not_supported');
  });

  it('passes the launch reconciliation matrix for provider terminal states', async () => {
    const matrixReport = await runPaymentsLaunchReconciliationStatusMatrix({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });

    expect(matrixReport.providerProfile).toBe('synctera');
    expect(matrixReport.allFixturesPassed).toBe(true);
    expect(matrixReport.launchBlocked).toBe(false);
    expect(matrixReport.fixtures.map((fixture) => fixture.id)).toEqual([
      'completed',
      'reversed',
      'failed',
      'returned',
      'disputed',
    ]);
    expect(matrixReport.fixtures.every((fixture) => fixture.passed)).toBe(true);
    expect(
      matrixReport.fixtures.every(
        (fixture) =>
          fixture.report.launchBlocked === false &&
          fixture.report.breaks.length === 0 &&
          fixture.report.summary.matchedTransfers === 1,
      ),
    ).toBe(true);
  });

  it('keeps dispute operations blocked until authority, timing, notices, and evidence are recorded', () => {
    const blockedChecklist = buildPaymentsDisputeOpsChecklist({
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const readyChecklist = buildPaymentsDisputeOpsChecklist({
      ledgerActionApproverRole: 'payments_ops_lead',
      ledgerActionDualControl: true,
      provisionalCreditWindowDays: 10,
      closureNoticeTemplateApproved: true,
      auditEvidenceSinkConfigured: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(blockedChecklist.ready).toBe(false);
    expect(blockedChecklist.items.every((item) => item.status === 'blocked')).toBe(
      true,
    );
    expect(readyChecklist.ready).toBe(true);
    expect(readyChecklist.items.map((item) => item.id)).toEqual([
      'ledger_action_authority',
      'provisional_credit_timing',
      'closure_notices',
      'audit_evidence',
    ]);
    expect(readyChecklist.items.every((item) => item.status === 'passed')).toBe(
      true,
    );
  });

  it('builds a release approval packet only from current launch evidence', async () => {
    const report = await runPaymentsProviderSandboxDrills({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const matrixReport = await runPaymentsLaunchReconciliationStatusMatrix({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const disputeOpsChecklist = buildPaymentsDisputeOpsChecklist({
      ledgerActionApproverRole: 'payments_ops_lead',
      ledgerActionDualControl: true,
      provisionalCreditWindowDays: 10,
      closureNoticeTemplateApproved: true,
      auditEvidenceSinkConfigured: true,
      generatedAt: report.generatedAt,
    });
    const packet = buildPaymentsLaunchReleaseApprovalPacket({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
      ...buildReleaseApprovals(report.generatedAt),
    });
    const gate = buildPaymentsLaunchGateViewModel({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      releaseApprovalPacket: packet,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(packet.ready).toBe(true);
    expect(packet.releaseFlipEnabled).toBe(true);
    expect(packet.paymentsFeatureHidden).toBe(false);
    expect(packet.items.every((item) => item.status === 'passed')).toBe(true);
    expect(gate.releaseReady).toBe(true);
    expect(gate.hiddenUntilReady).toBe(false);
  });

  it('keeps captured release evidence pending until operators attach real approvals', async () => {
    const {
      report,
      matrixReport,
      disputeOpsChecklist,
    } = await buildAutomatedLaunchEvidence();
    const review = buildPaymentsLaunchReleaseEvidenceReview({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      expectedProviderProfile: 'synctera',
      paymentsFeatureHidden: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(review.status).toBe('pending');
    expect(review.statusLabel).toBe('Pending');
    expect(review.paymentsFeatureHidden).toBe(true);
    expect(review.approvalPacket.releaseFlipEnabled).toBe(false);
    expect(review.items.map((item) => item.status)).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('validates captured release evidence while keeping the registry hidden', async () => {
    const {
      report,
      matrixReport,
      disputeOpsChecklist,
    } = await buildAutomatedLaunchEvidence();
    const approvals = buildReleaseApprovals(report.generatedAt, 'synctera', true);
    const review = buildPaymentsLaunchReleaseEvidenceReview({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      releaseEvidence: {
        ...approvals,
        hiddenStateAcknowledgement: {
          approvedBy: 'release-owner@mylife.app',
          approvedAt: '2026-04-24T16:29:00.000Z',
          automatedEvidenceGeneratedAt: report.generatedAt,
          providerProfile: 'synctera',
          releaseTicketId: 'PAY-RELEASE-2026-04-24',
          targetReleaseState: 'public_beta',
          paymentsFeatureHiddenAcknowledged: true,
        },
      },
      expectedProviderProfile: 'synctera',
      paymentsFeatureHidden: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(review.status).toBe('ready_for_release_owner_review');
    expect(review.approvalPacket.ready).toBe(false);
    expect(review.approvalPacket.releaseFlipEnabled).toBe(false);
    expect(review.items.every((item) => item.status === 'ready')).toBe(true);
    expect(review.summary).toContain('registry release-state change remains a separate approval step');
  });

  it('blocks captured release evidence when approval identity or hidden acknowledgement drifts', async () => {
    const {
      report,
      matrixReport,
      disputeOpsChecklist,
    } = await buildAutomatedLaunchEvidence();
    const approvals = buildReleaseApprovals(report.generatedAt, 'unit', true);
    const review = buildPaymentsLaunchReleaseEvidenceReview({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      releaseEvidence: {
        ...approvals,
        hiddenStateAcknowledgement: {
          approvedBy: 'release-owner@mylife.app',
          approvedAt: '2026-04-24T16:29:00.000Z',
          automatedEvidenceGeneratedAt: report.generatedAt,
          providerProfile: 'synctera',
          releaseTicketId: 'PAY-RELEASE-2026-04-24',
          targetReleaseState: 'hidden',
          paymentsFeatureHiddenAcknowledged: false,
        },
      },
      expectedProviderProfile: 'synctera',
      paymentsFeatureHidden: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(review.status).toBe('blocked');
    expect(
      review.items.find((item) => item.id === 'legal_review')?.evidence,
    ).toContain('provider profile');
    expect(
      review.items.find((item) => item.id === 'hidden_state_acknowledgement')?.evidence,
    ).toContain('hidden release state has not been explicitly acknowledged');
  });

  it('summarizes current launch evidence for operator release-owner review', async () => {
    const report = await runPaymentsProviderSandboxDrills({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const matrixReport = await runPaymentsLaunchReconciliationStatusMatrix({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const disputeOpsChecklist = buildPaymentsDisputeOpsChecklist({
      ledgerActionApproverRole: 'payments_ops_lead',
      ledgerActionDualControl: true,
      provisionalCreditWindowDays: 10,
      closureNoticeTemplateApproved: true,
      auditEvidenceSinkConfigured: true,
      generatedAt: report.generatedAt,
    });
    const packet = buildPaymentsLaunchReleaseApprovalPacket({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
      ...buildReleaseApprovals(report.generatedAt),
    });
    const runbook = buildPaymentsLaunchOperatorRunbook({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      releaseApprovalPacket: packet,
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(runbook.decision).toBe('ready_for_release_owner_review');
    expect(runbook.readyForReleaseOwnerReview).toBe(true);
    expect(runbook.doNotLaunchReasons).toEqual([]);
    expect(runbook.sections.map((section) => section.id)).toEqual([
      'provider_sandbox_drills',
      'reconciliation_status_matrix',
      'dispute_operations',
      'release_approval_packet',
      'release_state',
    ]);
    expect(runbook.sections.every((section) => section.status === 'passed')).toBe(
      true,
    );
    expect(runbook.operatorLines[0]).toContain('ready');
  });

  it('turns missing evidence and hidden state into explicit do-not-launch reasons', () => {
    const runbook = buildPaymentsLaunchOperatorRunbook({
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(runbook.decision).toBe('do_not_launch');
    expect(runbook.paymentsFeatureHidden).toBe(true);
    expect(runbook.doNotLaunchReasons.map((reason) => reason.id)).toEqual([
      'provider_drills_missing',
      'reconciliation_matrix_missing',
      'dispute_ops_missing',
      'approval_packet_missing',
      'payments_hidden',
    ]);
    expect(runbook.operatorLines[0]).toContain('Do not launch MyPay');
  });

  it('fails release approvals closed when evidence is stale or provider-mismatched', async () => {
    const report = await runPaymentsProviderSandboxDrills({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const matrixReport = await runPaymentsLaunchReconciliationStatusMatrix({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const disputeOpsChecklist = buildPaymentsDisputeOpsChecklist({
      ledgerActionApproverRole: 'payments_ops_lead',
      ledgerActionDualControl: true,
      provisionalCreditWindowDays: 10,
      closureNoticeTemplateApproved: true,
      auditEvidenceSinkConfigured: true,
      generatedAt: report.generatedAt,
    });
    const stalePacket = buildPaymentsLaunchReleaseApprovalPacket({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-26T16:30:00.000Z',
      ...buildReleaseApprovals(report.generatedAt),
    });
    const mismatchedPacket = buildPaymentsLaunchReleaseApprovalPacket({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
      ...buildReleaseApprovals(report.generatedAt, 'unit', true),
    });

    expect(stalePacket.ready).toBe(false);
    expect(stalePacket.releaseFlipEnabled).toBe(false);
    expect(
      buildPaymentsLaunchOperatorRunbook({
        providerDrillReport: report,
        reconciliationStatusMatrixReport: matrixReport,
        disputeOpsChecklist,
        releaseApprovalPacket: stalePacket,
        expectedProviderProfile: 'synctera',
        paymentsFeatureHidden: false,
      }).doNotLaunchReasons.map((reason) => reason.id),
    ).toEqual(['approval_packet_blocked', 'approval_evidence_stale']);
    expect(
      stalePacket.items.find((item) => item.id === 'automated_evidence')?.evidence,
    ).toContain('stale');
    expect(mismatchedPacket.ready).toBe(false);
    expect(mismatchedPacket.releaseFlipEnabled).toBe(false);
    expect(
      buildPaymentsLaunchOperatorRunbook({
        providerDrillReport: report,
        reconciliationStatusMatrixReport: matrixReport,
        disputeOpsChecklist,
        releaseApprovalPacket: mismatchedPacket,
        expectedProviderProfile: 'synctera',
      }).doNotLaunchReasons.map((reason) => reason.id),
    ).toEqual([
      'approval_packet_blocked',
      'provider_profile_mismatch',
      'payments_hidden',
    ]);
    expect(
      mismatchedPacket.items.find((item) => item.id === 'legal_review')?.evidence,
    ).toContain('provider profile');
  });

  it('keeps release hidden until automated, matrix, dispute, legal, pilot, and release-flip gates pass', async () => {
    const report = await runPaymentsProviderSandboxDrills({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const matrixReport = await runPaymentsLaunchReconciliationStatusMatrix({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
    const disputeOpsChecklist = buildPaymentsDisputeOpsChecklist({
      ledgerActionApproverRole: 'payments_ops_lead',
      ledgerActionDualControl: true,
      provisionalCreditWindowDays: 10,
      closureNoticeTemplateApproved: true,
      auditEvidenceSinkConfigured: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const blocked = buildPaymentsLaunchGateViewModel({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      legalReviewApproved: false,
      pilotApproved: false,
      releaseFlipEnabled: false,
      paymentsFeatureHidden: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const ready = buildPaymentsLaunchGateViewModel({
      providerDrillReport: report,
      reconciliationStatusMatrixReport: matrixReport,
      disputeOpsChecklist,
      legalReviewApproved: true,
      pilotApproved: true,
      releaseFlipEnabled: true,
      paymentsFeatureHidden: false,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const missingMatrix = buildPaymentsLaunchGateViewModel({
      providerDrillReport: report,
      disputeOpsChecklist,
      legalReviewApproved: true,
      pilotApproved: true,
      releaseFlipEnabled: true,
      paymentsFeatureHidden: false,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });

    expect(blocked.releaseReady).toBe(false);
    expect(blocked.hiddenUntilReady).toBe(true);
    expect(blocked.items.find((item) => item.id === 'legal_review')?.status).toBe(
      'manual_review',
    );
    expect(missingMatrix.releaseReady).toBe(false);
    expect(missingMatrix.items.find((item) => item.id === 'reconciliation')?.status).toBe(
      'blocked',
    );
    expect(ready.releaseReady).toBe(true);
    expect(ready.hiddenUntilReady).toBe(false);
    expect(ready.items.every((item) => item.status === 'passed')).toBe(true);
  });
});
