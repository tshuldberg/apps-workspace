import { describe, expect, it } from 'vitest';

import {
  buildPaymentsLaunchOperatorRunbook,
  buildPaymentsLaunchReleaseEvidenceReview,
} from '../../launch/readiness';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildPaymentsOpsConsoleViewModel,
  type PaymentsOpsConsoleSnapshot,
} from '../console';

function makeSnapshot(size: number): PaymentsOpsConsoleSnapshot {
  return {
    breaks: Array.from({ length: size }, (_, index) => ({
      breakId: `break_${index}`,
    }) as never),
    disputes: Array.from({ length: size }, (_, index) => ({
      status: index % 2 === 0 ? 'under_review' : 'closed_lost',
    }) as never),
    providerEvents: Array.from({ length: size }, (_, index) => ({
      status: index % 3 === 0 ? 'failed' : 'applied',
    }) as never),
    remittanceExceptionIds: Array.from(
      { length: Math.floor(size / 2) },
      (_, index) => `remit_${index}`,
    ),
    complianceHoldWalletIds: Array.from(
      { length: Math.floor(size / 4) },
      (_, index) => `wallet_${index}`,
    ),
  };
}

describe('buildPaymentsOpsConsoleViewModel function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const launchRunbook = buildPaymentsLaunchOperatorRunbook({
      expectedProviderProfile: 'synctera',
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const launchReleaseEvidenceReview = buildPaymentsLaunchReleaseEvidenceReview({
      expectedProviderProfile: 'synctera',
      paymentsFeatureHidden: true,
      generatedAt: '2026-04-24T16:30:00.000Z',
    });
    const viewModel = buildPaymentsOpsConsoleViewModel({
      ...makeSnapshot(4),
      launchRunbook,
      launchReleaseEvidenceReview,
      launchEvidenceTimestamps: {
        approval_packet: '2026-04-24T16:30:00.000Z',
      },
    });

    expect(viewModel.title).toBe('Payments Ops');
    expect(viewModel.queues.find((queue) => queue.id === 'webhook_failures')?.count).toBe(2);
    expect(viewModel.launchReview?.decisionLabel).toBe('Do not launch');
    expect(viewModel.launchReview?.providerProfileLabel).toBe('synctera');
    expect(viewModel.launchReleaseEvidenceReview?.status).toBe('pending');
    expect(viewModel.launchReleaseEvidenceHistory.recordCount).toBe(0);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsOpsConsoleViewModel fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 80);
        return makeSnapshot(size);
      },
      assertCase: async (input) => {
        const result = buildPaymentsOpsConsoleViewModel(input);

        expect(result.queues).toHaveLength(5);
        expect(result.queues.every((queue) => queue.count >= 0)).toBe(true);
        expect(result.launchReview).toBeNull();
        expect(result.launchReleaseEvidenceHistory.items).toHaveLength(0);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsOpsConsoleViewModel',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => makeSnapshot(size),
      run: async (input) => {
        buildPaymentsOpsConsoleViewModel(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsOpsConsoleViewModel',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeSnapshot(500),
      run: async (input) => {
        buildPaymentsOpsConsoleViewModel(input);
      },
    });
  });
});
