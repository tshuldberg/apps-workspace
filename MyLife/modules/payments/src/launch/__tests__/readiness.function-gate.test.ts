import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildPaymentsLaunchReleaseEvidenceReview,
  type BuildPaymentsLaunchReleaseEvidenceReviewInput,
  type PaymentsDisputeOpsChecklist,
  type PaymentsLaunchReconciliationStatusMatrixReport,
  type PaymentsProviderSandboxDrillReport,
} from '../readiness';

const EVIDENCE_TIME = '2026-04-24T16:30:00.000Z';
const APPROVAL_TIME = '2026-04-24T16:29:00.000Z';

function makeProviderReport(): PaymentsProviderSandboxDrillReport {
  return {
    generatedAt: EVIDENCE_TIME,
    providerProfile: 'synctera',
    bundleKind: 'sandbox',
    allAutomatedPassed: true,
    launchBlocked: false,
    drills: [],
    reconciliation: null,
    operatorLines: [],
  };
}

function makeMatrixReport(): PaymentsLaunchReconciliationStatusMatrixReport {
  return {
    generatedAt: EVIDENCE_TIME,
    providerProfile: 'synctera',
    allFixturesPassed: true,
    launchBlocked: false,
    fixtures: [],
    operatorLines: [],
  };
}

function makeDisputeChecklist(): PaymentsDisputeOpsChecklist {
  return {
    generatedAt: EVIDENCE_TIME,
    ready: true,
    items: [],
    operatorLines: [],
  };
}

function makeBaseInput(): BuildPaymentsLaunchReleaseEvidenceReviewInput {
  return {
    providerDrillReport: makeProviderReport(),
    reconciliationStatusMatrixReport: makeMatrixReport(),
    disputeOpsChecklist: makeDisputeChecklist(),
    expectedProviderProfile: 'synctera',
    paymentsFeatureHidden: true,
    generatedAt: EVIDENCE_TIME,
  };
}

function makeReadyInput(size = 0): BuildPaymentsLaunchReleaseEvidenceReviewInput {
  const suffix = size > 0 ? `-${'x'.repeat(size)}` : '';

  return {
    ...makeBaseInput(),
    releaseEvidence: {
      legalReview: {
        approvedBy: `counsel${suffix}@mylife.app`,
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        copySetVersion: `payments-copy${suffix}`,
        counselMatterId: `legal-mypay-launch${suffix}`,
        storedBalanceCopyApproved: true,
        partnerBankCopyApproved: true,
        custodialCopyApproved: true,
        remittanceCancellationCopyApproved: true,
        errorResolutionCopyApproved: true,
      },
      pilotApproval: {
        approvedBy: `pilot-owner${suffix}@mylife.app`,
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        cohortId: `pilot-internal${suffix}`,
        limitProfileId: `pilot-low-limits${suffix}`,
        monitoringPlanId: `payments-monitoring${suffix}`,
        rollbackPlanId: `payments-rollback${suffix}`,
        corridorConfigurationReviewed: true,
      },
      releaseOwnerSignoff: {
        approvedBy: `release-owner${suffix}@mylife.app`,
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        releaseTicketId: `PAY-RELEASE-2026-04-24${suffix}`,
        targetReleaseState: 'public_beta',
        paymentsFeatureHidden: true,
      },
      hiddenStateAcknowledgement: {
        approvedBy: `release-owner${suffix}@mylife.app`,
        approvedAt: APPROVAL_TIME,
        automatedEvidenceGeneratedAt: EVIDENCE_TIME,
        providerProfile: 'synctera',
        releaseTicketId: `PAY-RELEASE-2026-04-24${suffix}`,
        targetReleaseState: 'public_beta',
        paymentsFeatureHiddenAcknowledged: true,
      },
    },
  };
}

describe('buildPaymentsLaunchReleaseEvidenceReview function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const pending = buildPaymentsLaunchReleaseEvidenceReview(makeBaseInput());
    const ready = buildPaymentsLaunchReleaseEvidenceReview(makeReadyInput());
    const blocked = buildPaymentsLaunchReleaseEvidenceReview({
      ...makeReadyInput(),
      releaseEvidence: {
        ...makeReadyInput().releaseEvidence,
        hiddenStateAcknowledgement: {
          ...makeReadyInput().releaseEvidence?.hiddenStateAcknowledgement,
          targetReleaseState: 'hidden',
          paymentsFeatureHiddenAcknowledged: false,
        },
      },
    });

    expect(pending.status).toBe('pending');
    expect(ready.status).toBe('ready_for_release_owner_review');
    expect(ready.approvalPacket.releaseFlipEnabled).toBe(false);
    expect(blocked.status).toBe('blocked');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsLaunchReleaseEvidenceReview fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng) => {
        const mode = randomInt(rng, 0, 3);
        if (mode === 0) {
          return makeBaseInput();
        }

        const input = makeReadyInput(randomInt(rng, 0, 12));
        if (mode === 1 && input.releaseEvidence?.legalReview) {
          input.releaseEvidence.legalReview.providerProfile = 'unit';
        }
        if (mode === 2 && input.releaseEvidence?.hiddenStateAcknowledgement) {
          input.releaseEvidence.hiddenStateAcknowledgement.paymentsFeatureHiddenAcknowledged = false;
        }
        return input;
      },
      assertCase: async (input) => {
        const result = buildPaymentsLaunchReleaseEvidenceReview(input);
        const hasBlockedItem = result.items.some((item) => item.status === 'blocked');
        const hasPendingItem = result.items.some((item) => item.status === 'pending');

        expect(result.items).toHaveLength(4);
        expect(result.paymentsFeatureHidden).toBe(true);
        expect(result.approvalPacket.releaseFlipEnabled).toBe(false);
        expect(result.status).toBe(
          hasBlockedItem
            ? 'blocked'
            : hasPendingItem
              ? 'pending'
              : 'ready_for_release_owner_review',
        );
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsLaunchReleaseEvidenceReview',
      sizes: [100, 200, 400],
      expected: 'linear',
      maxRatios: [5.5, 5.5],
      warmupRuns: 4,
      sampleRuns: 12,
      setup: (size) => makeReadyInput(size),
      run: async (input) => {
        buildPaymentsLaunchReleaseEvidenceReview(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsLaunchReleaseEvidenceReview',
      repeats: 50,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeReadyInput(200),
      run: async (input) => {
        buildPaymentsLaunchReleaseEvidenceReview(input);
      },
    });
  });
});
