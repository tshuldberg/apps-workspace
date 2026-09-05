import { describe, expect, it } from 'vitest';

import {
  buildPaymentsLaunchOperatorRunbook,
  buildPaymentsLaunchReleaseEvidenceReview,
} from '../../launch/readiness';
import {
  buildPaymentsLaunchEvidenceCaptureEligibility,
  type PaymentsLaunchCapturedEvidenceRecord,
} from '../../launch/evidence-store';
import { buildPaymentsOpsConsoleViewModel } from '../console';

describe('payments ops console view model', () => {
  it('summarizes review queues without SQL access', () => {
    const state = buildPaymentsOpsConsoleViewModel({
      breaks: [],
      disputes: [],
      providerEvents: [],
      remittanceExceptionIds: ['remit_1'],
      complianceHoldWalletIds: ['wallet_1'],
    });

    expect(state.title).toBe('Payments Ops');
    expect(state.queues.find((queue) => queue.id === 'remittance_exceptions')?.count).toBe(1);
  });

  it('renders launch runbook evidence for operator review', () => {
    const runbook = buildPaymentsLaunchOperatorRunbook({
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const releaseEvidenceReview = buildPaymentsLaunchReleaseEvidenceReview({
      expectedProviderProfile: 'synctera',
      paymentsFeatureHidden: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const state = buildPaymentsOpsConsoleViewModel({
      breaks: [],
      disputes: [],
      providerEvents: [],
      remittanceExceptionIds: [],
      complianceHoldWalletIds: [],
      launchRunbook: runbook,
      launchEvidenceTimestamps: {
        provider_drills: null,
        reconciliation_matrix: null,
        dispute_ops: null,
        approval_packet: '2026-04-24T16:30:00.000Z',
        automated_evidence: null,
      },
      launchReleaseEvidenceReview: releaseEvidenceReview,
    });

    expect(state.launchReview?.decisionLabel).toBe('Do not launch');
    expect(state.launchReview?.providerProfileLabel).toBe('synctera');
    expect(state.launchReview?.hiddenStateLabel).toBe('Hidden');
    expect(state.launchReview?.doNotLaunchReasons.map((reason) => reason.id)).toEqual([
      'provider_drills_missing',
      'reconciliation_matrix_missing',
      'dispute_ops_missing',
      'approval_packet_missing',
      'payments_hidden',
    ]);
    expect(
      state.launchReview?.evidenceTimestamps.find((line) => line.id === 'provider_drills')?.missing,
    ).toBe(true);
    expect(state.launchReleaseEvidenceReview?.statusLabel).toBe('Pending');
    expect(state.launchReleaseEvidenceReview?.releaseTicketLabel).toBe('Pending');
    expect(state.launchReleaseEvidenceReview?.hiddenStateLabel).toBe('Payments remains hidden');
    expect(state.launchReleaseEvidenceHistory.recordCount).toBe(0);
    expect(state.launchReleaseEvidenceHistory.summary).toContain(
      'No immutable release evidence',
    );
  });

  it('renders persisted release evidence history for ops review', () => {
    const record: PaymentsLaunchCapturedEvidenceRecord = {
      evidenceId: 'evidence_legal_1',
      idempotencyKey: 'idem_legal_1',
      kind: 'legal_review',
      capturedAt: '2026-04-24T16:31:00.000Z',
      capturedBy: 'ops-lead@mylife.app',
      operatorIdentity: {
        actorId: 'operator_legal',
        displayName: 'Ops Lead',
        email: 'ops-lead@mylife.app',
        roles: ['legal_reviewer'],
      },
      reviewerIdentity: null,
      immutableReference: {
        providerProfile: 'synctera',
        automatedEvidenceGeneratedAt: '2026-04-24T16:30:00.000Z',
        releaseTicketId: 'PAY-RELEASE-2026-04-24',
        targetReleaseState: 'public_beta',
      },
      payload: {
        approvedBy: 'counsel@mylife.app',
        approvedAt: '2026-04-24T16:29:00.000Z',
        automatedEvidenceGeneratedAt: '2026-04-24T16:30:00.000Z',
        providerProfile: 'synctera',
        copySetVersion: 'payments-copy-2026-04-24',
        counselMatterId: 'legal-mypay-launch',
        storedBalanceCopyApproved: true,
        partnerBankCopyApproved: true,
        custodialCopyApproved: true,
        remittanceCancellationCopyApproved: true,
        errorResolutionCopyApproved: true,
      },
      payloadFingerprint: 'fnv1a_test',
      auditEntryId: 'audit_evidence_1',
    };
    const state = buildPaymentsOpsConsoleViewModel({
      breaks: [],
      disputes: [],
      providerEvents: [],
      remittanceExceptionIds: [],
      complianceHoldWalletIds: [],
      launchReleaseEvidenceRecords: [record],
    });

    expect(state.launchReleaseEvidenceHistory.recordCount).toBe(1);
    expect(state.launchReleaseEvidenceHistory.items[0]).toMatchObject({
      evidenceId: 'evidence_legal_1',
      kindLabel: 'Legal review',
      operatorLabel: 'Ops Lead',
      reviewerLabel: 'Not required',
      providerProfileLabel: 'synctera',
      auditEntryLabel: 'audit_evidence_1',
    });
  });

  it('renders capture eligibility and rejected-capture reasons', () => {
    const eligibility = buildPaymentsLaunchEvidenceCaptureEligibility({
      kind: 'release_owner_signoff',
      evidenceId: null,
      idempotencyKey: null,
      operatorIdentity: null,
      providerProfile: 'synctera',
      automatedEvidenceGeneratedAt: '2026-04-24T16:30:00.000Z',
      releaseTicketId: null,
      targetReleaseState: null,
    });
    const state = buildPaymentsOpsConsoleViewModel({
      breaks: [],
      disputes: [],
      providerEvents: [],
      remittanceExceptionIds: [],
      complianceHoldWalletIds: [],
      launchReleaseEvidenceCaptureEligibility: [eligibility],
    });

    expect(state.launchReleaseEvidenceCaptureEligibility.summary).toBe(
      '0 of 1 capture workflow eligible. Blocked items are not persisted.',
    );
    expect(
      state.launchReleaseEvidenceCaptureEligibility.items[0]?.rejectionReasons.map(
        (reason) => reason.id,
      ),
    ).toEqual([
      'evidence_id_missing',
      'idempotency_key_missing',
      'operator_identity_missing',
      'release_ticket_missing',
      'target_release_state_missing',
    ]);
  });
});
