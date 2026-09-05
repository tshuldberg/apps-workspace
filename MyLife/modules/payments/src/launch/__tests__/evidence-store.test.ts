import { describe, expect, it } from 'vitest';

import {
  createInMemoryPaymentsAuditSink,
  createPaymentsAuditLogger,
} from '../../ops/audit';
import {
  buildPaymentsLaunchEvidenceCaptureEligibility,
  buildPaymentsLaunchReleaseEvidenceCaptureFromRecords,
  createInMemoryPaymentsLaunchEvidenceStore,
  type CapturePaymentsLaunchEvidenceInput,
  type PaymentsLaunchEvidenceOperatorIdentity,
} from '../evidence-store';

const EVIDENCE_TIME = '2026-04-24T16:30:00.000Z';
const APPROVAL_TIME = '2026-04-24T16:29:00.000Z';

const OPS_OPERATOR: PaymentsLaunchEvidenceOperatorIdentity = {
  actorId: 'operator_ops_lead',
  displayName: 'Ops Lead',
  email: 'ops-lead@mylife.app',
  roles: ['payments_ops_lead'],
};

const LEGAL_OPERATOR: PaymentsLaunchEvidenceOperatorIdentity = {
  actorId: 'operator_legal',
  displayName: 'Legal Reviewer',
  email: 'counsel@mylife.app',
  roles: ['legal_reviewer'],
};

const PILOT_OPERATOR: PaymentsLaunchEvidenceOperatorIdentity = {
  actorId: 'operator_pilot',
  displayName: 'Pilot Owner',
  email: 'pilot-owner@mylife.app',
  roles: ['pilot_owner'],
};

const RELEASE_OWNER_OPERATOR: PaymentsLaunchEvidenceOperatorIdentity = {
  actorId: 'operator_release_owner',
  displayName: 'Release Owner',
  email: 'release-owner@mylife.app',
  roles: ['release_owner'],
};

const COMBINED_RELEASE_OPERATOR: PaymentsLaunchEvidenceOperatorIdentity = {
  actorId: 'operator_combined',
  displayName: 'Combined Owner',
  email: 'combined-owner@mylife.app',
  roles: ['legal_reviewer', 'pilot_owner', 'release_owner'],
};

function makeLegalCapture(
  overrides: Partial<CapturePaymentsLaunchEvidenceInput> = {},
): CapturePaymentsLaunchEvidenceInput {
  return {
    evidenceId: 'evidence_legal_1',
    idempotencyKey: 'idem_legal_1',
    kind: 'legal_review',
    capturedAt: '2026-04-24T16:31:00.000Z',
    operatorIdentity: LEGAL_OPERATOR,
    providerProfile: 'synctera',
    automatedEvidenceGeneratedAt: EVIDENCE_TIME,
    releaseTicketId: 'PAY-RELEASE-2026-04-24',
    targetReleaseState: 'public_beta',
    payload: {
      approvedBy: 'counsel@mylife.app',
      approvedAt: APPROVAL_TIME,
      automatedEvidenceGeneratedAt: EVIDENCE_TIME,
      providerProfile: 'synctera',
      copySetVersion: 'payments-copy-2026-04-24',
      counselMatterId: 'legal-mypay-launch',
      storedBalanceCopyApproved: true,
      partnerBankCopyApproved: true,
      custodialCopyApproved: true,
      remittanceCancellationCopyApproved: true,
      errorResolutionCopyApproved: true,
    },
    ...overrides,
  };
}

function makeCapture(
  kind: CapturePaymentsLaunchEvidenceInput['kind'],
  overrides: Partial<CapturePaymentsLaunchEvidenceInput> = {},
): CapturePaymentsLaunchEvidenceInput {
  const base = makeLegalCapture({
    evidenceId: `evidence_${kind}_1`,
    idempotencyKey: `idem_${kind}_1`,
    kind,
    ...overrides,
  });

  if (kind === 'pilot_approval') {
    return {
      ...base,
      operatorIdentity: overrides.operatorIdentity ?? PILOT_OPERATOR,
      payload: {
        approvedBy: 'pilot-owner@mylife.app',
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        cohortId: 'pilot-internal-25',
        limitProfileId: 'pilot-low-limits-v1',
        monitoringPlanId: 'payments-monitoring-v1',
        rollbackPlanId: 'payments-rollback-v1',
        corridorConfigurationReviewed: true,
      },
    };
  }

  if (kind === 'release_owner_signoff') {
    return {
      ...base,
      operatorIdentity: overrides.operatorIdentity ?? RELEASE_OWNER_OPERATOR,
      payload: {
        approvedBy: 'release-owner@mylife.app',
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        releaseTicketId: 'PAY-RELEASE-2026-04-24',
        targetReleaseState: 'public_beta',
        paymentsFeatureHidden: true,
      },
    };
  }

  if (kind === 'hidden_state_acknowledgement') {
    return {
      ...base,
      operatorIdentity: overrides.operatorIdentity ?? RELEASE_OWNER_OPERATOR,
      payload: {
        approvedBy: 'release-owner@mylife.app',
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        releaseTicketId: 'PAY-RELEASE-2026-04-24',
        targetReleaseState: 'public_beta',
        paymentsFeatureHiddenAcknowledged: true,
      },
    };
  }

  return base;
}

describe('payments launch evidence store', () => {
  it('captures immutable release evidence and writes an audit entry', async () => {
    const sink = createInMemoryPaymentsAuditSink();
    const store = createInMemoryPaymentsLaunchEvidenceStore({
      auditLogger: createPaymentsAuditLogger({
        sink,
        now: () => new Date('2026-04-24T16:31:05.000Z'),
        createId: () => 'audit_evidence_1',
      }),
    });

    const result = await store.capture(makeLegalCapture());
    const records = store.list();

    expect(result.status).toBe('captured');
    expect(result.record?.auditEntryId).toBe('audit_evidence_1');
    expect(records).toHaveLength(1);
    expect(records[0]?.immutableReference.providerProfile).toBe('synctera');
    expect(records[0]?.immutableReference.releaseTicketId).toBe(
      'PAY-RELEASE-2026-04-24',
    );
    expect(sink.getEntries().map((entry) => entry.action)).toEqual([
      'launch_evidence.captured',
    ]);
    expect(sink.getEntries()[0]?.metadata.evidenceId).toBe('evidence_legal_1');
    expect(sink.getEntries()[0]?.metadata.operatorActorId).toBe(
      'operator_legal',
    );
  });

  it('replays duplicate reconnect submissions without duplicating records', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();
    const original = makeLegalCapture();
    const first = await store.capture(original);
    const replay = await store.capture({
      ...original,
      capturedAt: '2026-04-24T16:34:00.000Z',
    });

    expect(first.status).toBe('captured');
    expect(replay.status).toBe('idempotent_replay');
    expect(replay.record?.capturedAt).toBe('2026-04-24T16:31:00.000Z');
    expect(store.list()).toHaveLength(1);
  });

  it('rejects attempts to mutate evidence ids or reuse idempotency keys', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();
    const original = makeLegalCapture();

    await store.capture(original);
    const idConflict = await store.capture({
      ...original,
      idempotencyKey: 'idem_legal_2',
      targetReleaseState: 'ga',
    });
    const idempotencyConflict = await store.capture({
      ...original,
      evidenceId: 'evidence_legal_2',
      releaseTicketId: 'PAY-RELEASE-OTHER',
    });

    expect(idConflict.status).toBe('rejected');
    expect(idConflict.errorCode).toBe('evidence_id_conflict');
    expect(idempotencyConflict.status).toBe('rejected');
    expect(idempotencyConflict.errorCode).toBe('idempotency_key_conflict');
    expect(store.list()).toHaveLength(1);
  });

  it('rejects hidden release targets and unacknowledged hidden-state evidence', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();
    const hiddenTarget = await store.capture(
      makeLegalCapture({ targetReleaseState: 'hidden' }),
    );
    const hiddenAck = makeCapture('hidden_state_acknowledgement');
    const missingAck = await store.capture({
      ...hiddenAck,
      payload: {
        ...hiddenAck.payload,
        paymentsFeatureHiddenAcknowledged: false,
      },
    });
    const releaseTicketMismatch = await store.capture({
      ...makeCapture('release_owner_signoff'),
      releaseTicketId: 'PAY-RELEASE-DIFFERENT',
    });

    expect(hiddenTarget.errorCode).toBe('target_release_state_hidden');
    expect(missingAck.errorCode).toBe('hidden_state_not_acknowledged');
    expect(releaseTicketMismatch.errorCode).toBe('payload_reference_mismatch');
    expect(store.list()).toHaveLength(0);
  });

  it('rejects captures when the operator does not hold the required role', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();
    const result = await store.capture(
      makeLegalCapture({
        operatorIdentity: {
          actorId: 'operator_unprivileged',
          email: 'helper@mylife.app',
          roles: ['payments_ops'],
        },
      }),
    );
    const eligibility = buildPaymentsLaunchEvidenceCaptureEligibility({
      kind: 'legal_review',
      evidenceId: 'evidence_legal_1',
      idempotencyKey: 'idem_legal_1',
      operatorIdentity: {
        actorId: 'operator_unprivileged',
        email: 'helper@mylife.app',
        roles: ['payments_ops'],
      },
      providerProfile: 'synctera',
      automatedEvidenceGeneratedAt: EVIDENCE_TIME,
      releaseTicketId: 'PAY-RELEASE-2026-04-24',
      targetReleaseState: 'public_beta',
    });

    expect(result.status).toBe('rejected');
    expect(result.errorCode).toBe('operator_not_authorized');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.rejectionReasons.map((reason) => reason.id)).toContain(
      'operator_role_missing',
    );
    expect(store.list()).toHaveLength(0);
  });

  it('requires release-owner separation or a dual-control reviewer', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();
    await store.capture(
      makeCapture('legal_review', {
        operatorIdentity: COMBINED_RELEASE_OPERATOR,
      }),
    );

    const sharedOwner = makeCapture('release_owner_signoff', {
      operatorIdentity: COMBINED_RELEASE_OPERATOR,
    });
    const rejected = await store.capture(sharedOwner);
    const accepted = await store.capture({
      ...sharedOwner,
      evidenceId: 'evidence_release_owner_dual_control',
      idempotencyKey: 'idem_release_owner_dual_control',
      reviewerIdentity: OPS_OPERATOR,
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.errorCode).toBe('reviewer_separation_required');
    expect(accepted.status).toBe('captured');
    expect(accepted.record?.reviewerIdentity?.actorId).toBe(
      'operator_ops_lead',
    );
    expect(store.list()).toHaveLength(2);
  });

  it('hydrates review capture input from persisted records', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();

    await store.capture(makeCapture('legal_review'));
    await store.capture(makeCapture('pilot_approval'));
    await store.capture(makeCapture('release_owner_signoff'));
    await store.capture(makeCapture('hidden_state_acknowledgement'));

    const capture = buildPaymentsLaunchReleaseEvidenceCaptureFromRecords(
      store.list(),
    );

    expect(capture.legalReview?.copySetVersion).toBe(
      'payments-copy-2026-04-24',
    );
    expect(capture.pilotApproval?.cohortId).toBe('pilot-internal-25');
    expect(capture.releaseOwnerSignoff?.targetReleaseState).toBe('public_beta');
    expect(
      capture.hiddenStateAcknowledgement?.paymentsFeatureHiddenAcknowledged,
    ).toBe(true);
  });
});
