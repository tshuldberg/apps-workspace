import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/vitest/function-quality';
import { runBenchmarks } from '../benchmark-db';

describe('runBenchmarks function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = runBenchmarks({ seedRows: 25, iterations: 10 });

    expect(result.seedRows).toBe(25);
    expect(result.iterations).toBe(10);
    expect(result.operations).toHaveLength(4);
    expect(result.operations.map((operation) => operation.operation)).toEqual([
      'insert',
      'query',
      'update',
      'delete',
    ]);

    for (const operation of result.operations) {
      expect(operation.iterations).toBe(10);
      expect(operation.minMs).toBeGreaterThanOrEqual(0);
      expect(operation.p50Ms).toBeGreaterThanOrEqual(operation.minMs);
      expect(operation.p95Ms).toBeGreaterThanOrEqual(operation.p50Ms);
      expect(operation.maxMs).toBeGreaterThanOrEqual(operation.p95Ms);
      expect(operation.totalMs).toBeGreaterThanOrEqual(operation.averageMs);
    }

    expect(fs.existsSync(result.databasePath)).toBe(false);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'runBenchmarks fuzz',
      iterations: 20,
      seed: 42,
      makeCase: (rng) => {
        const seedRows = randomInt(rng, 5, 50);
        const iterations = randomInt(rng, 5, 25);
        return { seedRows, iterations };
      },
      assertCase: async (input) => {
        const result = runBenchmarks(input);
        expect(result.seedRows).toBe(input.seedRows);
        expect(result.iterations).toBe(input.iterations);
        expect(result.operations).toHaveLength(4);
        expect(result.operations.every((operation) => operation.iterations === input.iterations)).toBe(
          true,
        );
        expect(result.operations.every((operation) => operation.averageMs >= 0)).toBe(true);
        expect(fs.existsSync(result.databasePath)).toBe(false);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'runBenchmarks',
      sizes: [10, 20, 40],
      expected: 'linear',
      sampleRuns: 3,
      maxRatios: [4.5, 4.5],
      setup: (size) => ({ seedRows: size * 5, iterations: size }),
      run: async (input) => {
        runBenchmarks(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'runBenchmarks',
      repeats: 8,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => ({ seedRows: 20, iterations: 10 }),
      run: async (input) => {
        runBenchmarks(input);
      },
    });
  });
});
