import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { PostgresStoreContext } from '../../store-context';
import { PostgresCommunityPrivateStateStore } from '../community-private-state-store';

function context(): PostgresStoreContext {
  return new PostgresStoreContext({} as Pool);
}

describe('PostgresCommunityPrivateStateStore function quality gate', () => {
  it('rejects an unbounded community identifier before querying', async () => {
    const store = new PostgresCommunityPrivateStateStore(context());
    await expect(store.getState('x'.repeat(129))).rejects.toBeInstanceOf(TypeError);
  });

  it('passes deterministic construction fuzz', async () => {
    await runDeterministicFuzz({
      label: 'PostgresCommunityPrivateStateStore fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 1, 100),
      assertCase: (count) => {
        const stores = Array.from(
          { length: count },
          () => new PostgresCommunityPrivateStateStore(context()),
        );
        expect(stores).toHaveLength(count);
      },
    });
  });

  it('constructs adapters within a linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'PostgresCommunityPrivateStateStore construction',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => ({ size, shared: context() }),
      run: ({ size, shared }) => {
        for (let index = 0; index < size; index += 1) {
          new PostgresCommunityPrivateStateStore(shared);
        }
      },
    });
  });

  it('stays within memory budget under repeated construction', async () => {
    const shared = context();
    await assertMemoryBudget({
      label: 'PostgresCommunityPrivateStateStore construction',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 1_000,
      run: (size) => {
        const stores = Array.from(
          { length: size },
          () => new PostgresCommunityPrivateStateStore(shared),
        );
        expect(stores).toHaveLength(size);
      },
    });
  });
});
