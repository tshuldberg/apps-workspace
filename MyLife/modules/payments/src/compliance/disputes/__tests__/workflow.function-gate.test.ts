import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import {
  buildPaymentsTransferDisputeSummary,
  createPaymentsDisputeCase,
} from '../index';
import type {
  PaymentsDisputeCase,
} from '../types';
import type {
  PaymentsTransferRecord,
} from '../../../engine/types';

function makeTransfer(): PaymentsTransferRecord {
  return {
    transferId: 'pay_transfer_fn_gate',
    idempotencyKey: 'transfer-fn-gate',
    kind: 'p2p',
    status: 'completed',
    sourceWalletId: 'wallet_sender',
    destinationWalletId: 'wallet_receiver',
    sourceBalanceBucket: 'available',
    destinationBalanceBucket: 'available',
    sourceAmountCents: 5_000,
    sourceCurrency: 'USD',
    destinationAmountCents: 5_000,
    destinationCurrency: 'USD',
    feeAmountCents: 0,
    feeWalletId: null,
    sourceRail: 'wallet',
    destinationRail: 'wallet',
    memo: 'Lunch',
    externalReference: null,
    metadata: {},
  };
}

function makeCase(index: number): PaymentsDisputeCase {
  return createPaymentsDisputeCase({
    ownerUserId: `user_${index}`,
    walletId: `wallet_${index}`,
    transfer: {
      ...makeTransfer(),
      transferId: `pay_transfer_${index}`,
      idempotencyKey: `transfer_${index}`,
    },
    transferOccurredAt: '2026-04-12T10:00:00.000Z',
    now: new Date('2026-04-22T12:00:00.000Z'),
    reasonCode: index % 2 === 0 ? 'unauthorized_transfer' : 'other',
    userStatement: `Dispute statement ${index} about a suspicious payment flow.`,
  });
}

describe('buildPaymentsTransferDisputeSummary function quality gate', () => {
  it('matches contract behavior for an active case', () => {
    const transfer = makeTransfer();
    const disputeCase = createPaymentsDisputeCase({
      ownerUserId: 'user_owner',
      walletId: 'wallet_sender',
      transfer,
      transferOccurredAt: '2026-04-12T10:00:00.000Z',
      now: new Date('2026-04-22T12:00:00.000Z'),
      reasonCode: 'unauthorized_transfer',
      userStatement: 'This transfer was not authorized by the account owner.',
    });

    const summary = buildPaymentsTransferDisputeSummary({
      transfer,
      disputes: [disputeCase],
    });

    expect(summary.hasActiveCase).toBe(true);
    expect(summary.caseId).toBe(disputeCase.caseId);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsTransferDisputeSummary fuzz',
      iterations: 60,
      seed: 42,
      makeCase: (rng, index) => {
        const caseCount = randomInt(rng, 1, 25);
        const targetTransferId = `pay_transfer_${index}_target`;
        const disputes = Array.from({ length: caseCount }, (_, innerIndex) =>
          makeCase(index * 100 + innerIndex),
        );
        const activeCase = createPaymentsDisputeCase({
          ownerUserId: `user_target_${index}`,
          walletId: `wallet_target_${index}`,
          transfer: {
            ...makeTransfer(),
            transferId: targetTransferId,
            idempotencyKey: `idemp_${index}`,
          },
          transferOccurredAt: '2026-04-12T10:00:00.000Z',
          now: new Date('2026-04-22T12:00:00.000Z'),
          reasonCode: 'unauthorized_transfer',
          userStatement: `Target dispute ${index} for the active transfer.`,
        });

        return {
          transfer: {
            ...makeTransfer(),
            transferId: targetTransferId,
            idempotencyKey: `idemp_${index}`,
          },
          disputes: [...disputes, activeCase],
          activeCase,
        };
      },
      assertCase: async (testCase) => {
        const summary = buildPaymentsTransferDisputeSummary({
          transfer: testCase.transfer,
          disputes: testCase.disputes,
        });
        expect(summary.caseId).toBe(testCase.activeCase.caseId);
        expect(summary.hasActiveCase).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsTransferDisputeSummary',
      sizes: [200, 400, 800],
      expected: 'linear',
      sampleRuns: 4,
      maxRatios: [4.0, 4.0],
      setup: (size) => ({
        transfer: {
          ...makeTransfer(),
          transferId: `target_${size}`,
          idempotencyKey: `target_${size}`,
        },
        disputes: Array.from({ length: size }, (_, index) =>
          index === size - 1
            ? createPaymentsDisputeCase({
                ownerUserId: `user_target_${index}`,
                walletId: `wallet_target_${index}`,
                transfer: {
                  ...makeTransfer(),
                  transferId: `target_${size}`,
                  idempotencyKey: `target_${size}`,
                },
                transferOccurredAt: '2026-04-12T10:00:00.000Z',
                now: new Date('2026-04-22T12:00:00.000Z'),
                reasonCode: 'unauthorized_transfer',
                userStatement: `Target dispute ${index} for performance testing.`,
              })
            : makeCase(index),
        ),
      }),
      run: async ({ transfer, disputes }) => {
        for (let index = 0; index < 10; index += 1) {
          buildPaymentsTransferDisputeSummary({ transfer, disputes });
        }
      },
    });
  });

  it('stays within memory budget under repeated summary generation', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsTransferDisputeSummary',
      repeats: 15,
      maxHeapDeltaBytes: 10 * 1024 * 1024,
      setup: () => ({
        transfer: {
          ...makeTransfer(),
          transferId: 'target_memory',
          idempotencyKey: 'target_memory',
        },
        disputes: Array.from({ length: 500 }, (_, index) =>
          index === 499
            ? createPaymentsDisputeCase({
                ownerUserId: 'user_target_memory',
                walletId: 'wallet_target_memory',
                transfer: {
                  ...makeTransfer(),
                  transferId: 'target_memory',
                  idempotencyKey: 'target_memory',
                },
                transferOccurredAt: '2026-04-12T10:00:00.000Z',
                now: new Date('2026-04-22T12:00:00.000Z'),
                reasonCode: 'unauthorized_transfer',
                userStatement: 'Target dispute for the memory budget test case.',
              })
            : makeCase(index),
        ),
      }),
      run: async ({ transfer, disputes }) => {
        buildPaymentsTransferDisputeSummary({ transfer, disputes });
      },
    });
  });
});
