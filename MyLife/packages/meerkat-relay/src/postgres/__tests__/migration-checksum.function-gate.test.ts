import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { calculateMigrationChecksum } from '../migrations';

describe('calculateMigrationChecksum function quality gate', () => {
  it('is deterministic and binds version, name, and SQL', () => {
    const checksum = calculateMigrationChecksum(1, 'create_state', 'SELECT 1;');
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(calculateMigrationChecksum(1, 'create_state', 'SELECT 1;')).toBe(checksum);
    expect(calculateMigrationChecksum(2, 'create_state', 'SELECT 1;')).not.toBe(checksum);
    expect(calculateMigrationChecksum(1, 'create_state', 'SELECT 2;')).not.toBe(checksum);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'calculateMigrationChecksum fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => ({
        version: index + 1,
        name: `migration_${randomInt(rng, 1, 1_000_000)}`,
        sql: 'x'.repeat(randomInt(rng, 0, 2_000)),
      }),
      assertCase: ({ version, name, sql }) => {
        const checksum = calculateMigrationChecksum(version, name, sql);
        expect(checksum).toHaveLength(64);
        expect(calculateMigrationChecksum(version, name, sql)).toBe(checksum);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'calculateMigrationChecksum',
      sizes: [10_000, 20_000, 40_000],
      expected: 'linear',
      setup: (size) => 'x'.repeat(size),
      run: (sql) => calculateMigrationChecksum(1, 'migration', sql),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'calculateMigrationChecksum',
      repeats: 100,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 'x'.repeat(20_000),
      run: (sql) => calculateMigrationChecksum(1, 'migration', sql),
    });
  });
});
