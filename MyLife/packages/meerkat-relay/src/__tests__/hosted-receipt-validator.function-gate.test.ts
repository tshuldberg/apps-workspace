import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { createRevenueCatStoreReceiptValidator } from '../hosted-receipt-validator';

describe('createRevenueCatStoreReceiptValidator function quality gate', () => {
  it('fails closed when the server API key is empty', async () => {
    const validator = createRevenueCatStoreReceiptValidator({ apiKey: '   ' });
    await expect(validator.validate({
      rail: 'storekit', receipt: 'device', subjectId: 'device', productId: 'meerkat_app_unlock',
    })).resolves.toEqual({ valid: false, reason: 'not_configured' });
  });

  it('passes deterministic option fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createRevenueCatStoreReceiptValidator fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => 'k'.repeat(randomInt(rng, 0, 500)),
      assertCase: (apiKey) => {
        const validator = createRevenueCatStoreReceiptValidator({ apiKey });
        expect(validator.validate).toEqual(expect.any(Function));
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'createRevenueCatStoreReceiptValidator',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => 'k'.repeat(size),
      run: (apiKey) => createRevenueCatStoreReceiptValidator({ apiKey }),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'createRevenueCatStoreReceiptValidator',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 'k'.repeat(1000),
      run: (apiKey) => createRevenueCatStoreReceiptValidator({ apiKey }),
    });
  });
});
