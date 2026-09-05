import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  runPostgresMigrations,
  type PostgresMigrationClient,
  type PostgresMigrationPool,
} from '../migrate';
import {
  calculateMigrationChecksum,
  type MeerkatPostgresMigration,
} from '../migrations';

class QualityMigrationClient implements PostgresMigrationClient {
  readonly ledger: Array<Record<string, unknown>> = [];
  released = false;

  async query(sql: string, values: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    if (sql.includes('AS valid') && sql.includes('schema_migrations')) return { rows: [{ valid: true }] };
    if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] };
    if (sql.includes('SELECT version, name, checksum')) return { rows: [...this.ledger] };
    if (sql.includes('INSERT INTO ops.schema_migrations')) {
      this.ledger.push({ version: values[0], name: values[1], checksum: values[2] });
    }
    return { rows: [] };
  }

  release(): void {
    this.released = true;
  }
}

function migrations(size: number): MeerkatPostgresMigration[] {
  return Array.from({ length: size }, (_, index) => {
    const version = index + 1;
    const name = `quality_${version}`;
    const sql = `SELECT ${version};`;
    return { version, name, sql, checksum: calculateMigrationChecksum(version, name, sql) };
  });
}

function fixture(size: number): {
  pool: PostgresMigrationPool;
  client: QualityMigrationClient;
  migrations: MeerkatPostgresMigration[];
} {
  const client = new QualityMigrationClient();
  return {
    pool: { connect: async () => client },
    client,
    migrations: migrations(size),
  };
}

describe('runPostgresMigrations function quality gate', () => {
  it('applies the requested migration set and releases the client', async () => {
    const input = fixture(3);
    await expect(runPostgresMigrations(input.pool, { migrations: input.migrations })).resolves.toEqual({
      previousVersion: 0,
      currentVersion: 3,
      appliedVersions: [1, 2, 3],
    });
    expect(input.client.released).toBe(true);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'runPostgresMigrations fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => fixture(randomInt(rng, 0, 50)),
      assertCase: async (input) => {
        const result = await runPostgresMigrations(input.pool, { migrations: input.migrations });
        expect(result.appliedVersions).toHaveLength(input.migrations.length);
        expect(input.client.released).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'runPostgresMigrations',
      sizes: [50, 100, 200],
      expected: 'linear',
      setup: fixture,
      run: (input) => runPostgresMigrations(input.pool, { migrations: input.migrations }),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'runPostgresMigrations',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => fixture(100),
      run: (input) => runPostgresMigrations(input.pool, { migrations: input.migrations }),
    });
  });
});
