import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  runStoreConformanceSuite,
  type StoreConformanceSuite,
} from '../conformance/store-conformance';

function makeSuite(size: number): StoreConformanceSuite<{ value: number }> {
  return {
    storeName: 'counter',
    createStore: () => ({ value: 0 }),
    scenarios: Array.from({ length: size }, (_, index) => ({
      name: `scenario-${index}`,
      run: (store: { value: number }) => {
        expect(store.value).toBe(0);
        store.value = index + 1;
        expect(store.value).toBe(index + 1);
      },
    })),
  };
}

describe('runStoreConformanceSuite function quality gate', () => {
  it('returns the passed scenario names in contract order', async () => {
    const result = await runStoreConformanceSuite(makeSuite(3));
    expect(result).toEqual({
      storeName: 'counter',
      passedScenarios: ['scenario-0', 'scenario-1', 'scenario-2'],
    });
  });

  it('validates before side effects and disposes once when a scenario fails', async () => {
    let creates = 0;
    await expect(runStoreConformanceSuite({
      storeName: 'duplicate',
      createStore: () => { creates += 1; return {}; },
      scenarios: [
        { name: 'same', run: () => undefined },
        { name: 'same', run: () => undefined },
      ],
    })).rejects.toThrow(/duplicate scenario/);
    expect(creates).toBe(0);

    let disposals = 0;
    const failure = new Error('scenario failed');
    await expect(runStoreConformanceSuite({
      storeName: 'failure',
      createStore: () => ({}),
      scenarios: [{ name: 'rejects', run: () => { throw failure; } }],
      disposeStore: () => { disposals += 1; },
    })).rejects.toBe(failure);
    expect(disposals).toBe(1);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'runStoreConformanceSuite fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 1, 80),
      assertCase: async (size) => {
        const result = await runStoreConformanceSuite(makeSuite(size));
        expect(result.passedScenarios).toHaveLength(size);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'runStoreConformanceSuite',
      sizes: [50, 100, 200],
      expected: 'linear',
      setup: makeSuite,
      run: (input) => runStoreConformanceSuite(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'runStoreConformanceSuite',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeSuite(100),
      run: (input) => runStoreConformanceSuite(input),
    });
  });
});
