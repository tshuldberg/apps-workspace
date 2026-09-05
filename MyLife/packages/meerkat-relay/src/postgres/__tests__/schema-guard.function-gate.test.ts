import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { assertPostgresSchemaCompatibility } from '../schema-guard';

describe('assertPostgresSchemaCompatibility function quality gate', () => {
  it('accepts an explicit rolling-deploy range and rejects either side', () => {
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: 2,
      minimumVersion: 1,
      maximumVersion: 3,
    })).not.toThrow();
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: 0,
      minimumVersion: 1,
      maximumVersion: 3,
    })).toThrow(/too old/);
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: 4,
      minimumVersion: 1,
      maximumVersion: 3,
    })).toThrow(/too new/);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'assertPostgresSchemaCompatibility fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const minimumVersion = randomInt(rng, 0, 100);
        const maximumVersion = randomInt(rng, minimumVersion, 200);
        const currentVersion = randomInt(rng, 0, 220);
        return { currentVersion, minimumVersion, maximumVersion };
      },
      assertCase: (input) => {
        const within = input.currentVersion >= input.minimumVersion
          && input.currentVersion <= input.maximumVersion;
        if (within) {
          expect(() => assertPostgresSchemaCompatibility(input)).not.toThrow();
        } else {
          expect(() => assertPostgresSchemaCompatibility(input)).toThrow();
        }
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'assertPostgresSchemaCompatibility',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: () => ({ currentVersion: 2, minimumVersion: 1, maximumVersion: 3 }),
      run: (input) => assertPostgresSchemaCompatibility(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'assertPostgresSchemaCompatibility',
      repeats: 500,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => ({ currentVersion: 2, minimumVersion: 1, maximumVersion: 3 }),
      run: (input) => assertPostgresSchemaCompatibility(input),
    });
  });
});
