import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { FileCommunityPrivateStateStore } from '../community-private-state-store-file';

describe('FileCommunityPrivateStateStore function quality gate', () => {
  it('constructs a file authority without touching the directory', () => {
    expect(new FileCommunityPrivateStateStore('/tmp/meerkat-private-known'))
      .toBeInstanceOf(FileCommunityPrivateStateStore);
  });

  it('passes deterministic safe-path construction fuzz', async () => {
    await runDeterministicFuzz({
      label: 'FileCommunityPrivateStateStore fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => `/tmp/meerkat-private-${index}-${randomInt(rng, 0, 1_000_000)}`,
      assertCase: (directory) => {
        expect(new FileCommunityPrivateStateStore(directory))
          .toBeInstanceOf(FileCommunityPrivateStateStore);
      },
    });
  });

  it('constructs stores within a linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'FileCommunityPrivateStateStore construction',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => size,
      run: (size) => {
        for (let index = 0; index < size; index += 1) {
          new FileCommunityPrivateStateStore(`/tmp/meerkat-private-${index}`);
        }
      },
    });
  });

  it('stays within memory budget under repeated construction', async () => {
    await assertMemoryBudget({
      label: 'FileCommunityPrivateStateStore construction',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 1_000,
      run: (size) => {
        const stores = Array.from(
          { length: size },
          (_, index) => new FileCommunityPrivateStateStore(`/tmp/meerkat-private-${index}`),
        );
        expect(stores).toHaveLength(size);
      },
    });
  });
});
