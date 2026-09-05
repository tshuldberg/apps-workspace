import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  calculateMigrationChecksum,
  validateMigrationSet,
  type MeerkatPostgresMigration,
} from '../migrations';

function makeMigrations(size: number): MeerkatPostgresMigration[] {
  return Array.from({ length: size }, (_, index) => {
    const version = index + 1;
    const name = `migration_${version}`;
    const sql = `SELECT ${version};`;
    return { version, name, sql, checksum: calculateMigrationChecksum(version, name, sql) };
  });
}

describe('validateMigrationSet function quality gate', () => {
  it('accepts contiguous checksummed migrations and rejects gaps', () => {
    expect(() => validateMigrationSet(makeMigrations(3))).not.toThrow();
    const invalid = makeMigrations(2);
    invalid[1] = { ...invalid[1]!, version: 3 };
    expect(() => validateMigrationSet(invalid)).toThrow(/contiguous/);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'validateMigrationSet fuzz',
      iterations: 150,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 80),
      assertCase: (size) => {
        expect(() => validateMigrationSet(makeMigrations(size))).not.toThrow();
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'validateMigrationSet',
      sizes: [100, 200, 400],
      expected: 'linear',
      setup: makeMigrations,
      run: (input) => validateMigrationSet(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'validateMigrationSet',
      repeats: 30,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeMigrations(300),
      run: (input) => validateMigrationSet(input),
    });
  });
});
