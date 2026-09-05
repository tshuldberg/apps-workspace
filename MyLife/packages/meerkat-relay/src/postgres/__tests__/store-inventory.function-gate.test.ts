import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  validateMutableStoreInventory,
  type MutableStoreInventoryEntry,
} from '../store-inventory';

function makeEntries(size: number): MutableStoreInventoryEntry[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `community.test-${index}`,
    schema: 'community',
    source: 'test',
    contract: 'TestStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['put'],
    invariants: ['one writer wins'],
  }));
}

describe('validateMutableStoreInventory function quality gate', () => {
  it('accepts unique entries and rejects a duplicate id', () => {
    expect(() => validateMutableStoreInventory(makeEntries(10))).not.toThrow();
    const duplicate = makeEntries(2);
    duplicate[1] = { ...duplicate[1]!, id: duplicate[0]!.id };
    expect(() => validateMutableStoreInventory(duplicate)).toThrow(/duplicate id/);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'validateMutableStoreInventory fuzz',
      iterations: 150,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 250),
      assertCase: (size) => {
        expect(() => validateMutableStoreInventory(makeEntries(size))).not.toThrow();
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'validateMutableStoreInventory',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: makeEntries,
      run: (input) => validateMutableStoreInventory(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'validateMutableStoreInventory',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeEntries(1000),
      run: (input) => validateMutableStoreInventory(input),
    });
  });
});
