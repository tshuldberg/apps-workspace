import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { buildPaymentsBalanceProofs } from '../index';

function makeFixtures(size: number) {
  const ledgerEntries = [];
  const cachedBalances = [];
  const providerBalances = [];

  for (let index = 0; index < size; index += 1) {
    const walletId = `wallet_${index}`;
    ledgerEntries.push(
      {
        walletId,
        balanceBucket: 'available' as const,
        direction: 'credit' as const,
        entryKind: 'principal' as const,
        amountCents: 1_000,
        currency: 'USD' as const,
        createdAt: '2026-04-21T00:00:00.000Z',
      },
      {
        walletId,
        balanceBucket: 'available' as const,
        direction: 'debit' as const,
        entryKind: 'fee' as const,
        amountCents: 100,
        currency: 'USD' as const,
        createdAt: '2026-04-21T00:00:01.000Z',
      },
    );
    cachedBalances.push({
      walletId,
      balanceBucket: 'available' as const,
      currency: 'USD' as const,
      amountCents: 900,
    });
    providerBalances.push({
      providerName: 'unit',
      walletId,
      balanceBucket: 'available' as const,
      currency: 'USD' as const,
      amountCents: 900,
      updatedAt: '2026-04-21T00:00:02.000Z',
    });
  }

  return {
    ledgerEntries,
    cachedBalances,
    providerBalances,
  };
}

describe('buildPaymentsBalanceProofs function quality gate', () => {
  it('matches contract behavior for balanced snapshots', () => {
    const proofs = buildPaymentsBalanceProofs(makeFixtures(3));

    expect(proofs).toHaveLength(3);
    expect(proofs.every((proof) => proof.ok)).toBe(true);
    expect(proofs[0]?.ledgerNetCents).toBe(900);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsBalanceProofs fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng, index) => {
        const walletId = `wallet_${index}`;
        const credit = randomInt(rng, 500, 5_000);
        const debit = randomInt(rng, 0, 400);
        const ledgerNet = credit - debit;
        const drift = randomInt(rng, -25, 25);

        return {
          expectedLedgerNet: ledgerNet,
          expectedOk: drift === 0,
          input: {
            ledgerEntries: [
              {
                walletId,
                balanceBucket: 'available' as const,
                direction: 'credit' as const,
                entryKind: 'principal' as const,
                amountCents: credit,
                currency: 'USD' as const,
                createdAt: '2026-04-21T00:00:00.000Z',
              },
              {
                walletId,
                balanceBucket: 'available' as const,
                direction: 'debit' as const,
                entryKind: 'fee' as const,
                amountCents: debit,
                currency: 'USD' as const,
                createdAt: '2026-04-21T00:00:01.000Z',
              },
            ],
            cachedBalances: [
              {
                walletId,
                balanceBucket: 'available' as const,
                currency: 'USD' as const,
                amountCents: ledgerNet + drift,
              },
            ],
            providerBalances: [
              {
                providerName: 'unit',
                walletId,
                balanceBucket: 'available' as const,
                currency: 'USD' as const,
                amountCents: ledgerNet,
                updatedAt: '2026-04-21T00:00:02.000Z',
              },
            ],
          },
        };
      },
      assertCase: async (testCase) => {
        const proofs = buildPaymentsBalanceProofs(testCase.input);
        expect(proofs).toHaveLength(1);
        expect(proofs[0]?.ledgerNetCents).toBe(testCase.expectedLedgerNet);
        expect(proofs[0]?.ok).toBe(testCase.expectedOk);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsBalanceProofs',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 5,
      maxRatios: [8.0, 8.0],
      setup: (size) => makeFixtures(size),
      run: async (fixtures) => {
        for (let index = 0; index < 10; index += 1) {
          buildPaymentsBalanceProofs(fixtures);
        }
      },
    });
  });

  it('stays within memory budget under repeated proof generation', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsBalanceProofs',
      repeats: 10,
      maxHeapDeltaBytes: 12 * 1024 * 1024,
      setup: () => makeFixtures(500),
      run: async (fixtures) => {
        buildPaymentsBalanceProofs(fixtures);
      },
    });
  });
});
