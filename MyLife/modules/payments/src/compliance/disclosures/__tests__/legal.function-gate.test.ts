import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import {
  buildPaymentsLegalCopyBlocks,
} from '../index';
import type {
  PaymentsLegalCopyBlockId,
} from '../types';

const ALL_BLOCK_IDS: PaymentsLegalCopyBlockId[] = [
  'stored_balance',
  'partner_bank',
  'custodial_account',
  'debit_card',
  'stablecoin_rail',
  'remittance_cancellation',
  'error_resolution',
];

function makeBlockIdList(size: number): PaymentsLegalCopyBlockId[] {
  return Array.from(
    { length: size },
    (_, index) => ALL_BLOCK_IDS[index % ALL_BLOCK_IDS.length]!,
  );
}

describe('buildPaymentsLegalCopyBlocks function quality gate', () => {
  it('matches contract behavior for stablecoin rail gating', () => {
    const withoutStablecoin = buildPaymentsLegalCopyBlocks({
      blockIds: ['stablecoin_rail', 'partner_bank'],
      stablecoinRailEnabled: false,
    });
    const withStablecoin = buildPaymentsLegalCopyBlocks({
      blockIds: ['stablecoin_rail', 'partner_bank'],
      stablecoinRailEnabled: true,
    });

    expect(withoutStablecoin.map((block) => block.blockId)).toEqual([
      'partner_bank',
    ]);
    expect(withStablecoin.map((block) => block.blockId)).toEqual([
      'stablecoin_rail',
      'partner_bank',
    ]);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsLegalCopyBlocks fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 1, 30);
        const blockIds = Array.from({ length: size }, () => {
          const index = randomInt(rng, 0, ALL_BLOCK_IDS.length - 1);
          return ALL_BLOCK_IDS[index]!;
        });

        return {
          blockIds,
          stablecoinRailEnabled: rng() > 0.5,
        };
      },
      assertCase: async (input) => {
        const blocks = buildPaymentsLegalCopyBlocks({
          blockIds: input.blockIds,
          stablecoinRailEnabled: input.stablecoinRailEnabled,
        });
        const ids = blocks.map((block) => block.blockId);

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.includes('stablecoin_rail')).toBe(
          input.stablecoinRailEnabled &&
            input.blockIds.includes('stablecoin_rail'),
        );
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsLegalCopyBlocks',
      sizes: [100, 200, 400],
      expected: 'linear',
      sampleRuns: 5,
      maxRatios: [4.0, 4.0],
      setup: (size) => ({
        blockIds: makeBlockIdList(size),
      }),
      run: async ({ blockIds }) => {
        for (let index = 0; index < 10; index += 1) {
          buildPaymentsLegalCopyBlocks({
            blockIds,
            stablecoinRailEnabled: true,
          });
        }
      },
    });
  });

  it('stays within memory budget under repeated block assembly', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsLegalCopyBlocks',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => ({
        blockIds: makeBlockIdList(200),
      }),
      run: async ({ blockIds }) => {
        buildPaymentsLegalCopyBlocks({
          blockIds,
          stablecoinRailEnabled: true,
        });
      },
    });
  });
});
