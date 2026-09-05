import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
} from '../../test/function-quality';
import { MEERKAT_POSTGRES_MIGRATIONS } from '../migrations';
import type { MeerkatPostgresPoolOptions } from '../pool';
import { createMeerkatStoreRuntime } from '../runtime';
import type { MeerkatStoreRuntimeConfig } from '../runtime-config';
import { PostgresStoreUnavailableError } from '../store-context';

class RuntimePool {
  ended = 0;

  async query(): Promise<{ rows: Array<Record<string, unknown>> }> {
    return {
      rows: MEERKAT_POSTGRES_MIGRATIONS.map((migration) => ({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
      })),
    };
  }

  async end(): Promise<void> {
    this.ended += 1;
  }
}

const fileConfig = (): MeerkatStoreRuntimeConfig => ({
  profile: 'self-host',
  backend: 'file',
  productionMode: false,
  service: 'humanity',
  dataDir: '/tmp/humanity',
});

const postgresConfig = (): MeerkatStoreRuntimeConfig => ({
  profile: 'first-party',
  backend: 'postgres',
  productionMode: true,
  service: 'humanity',
  postgres: {
    connectionString: 'postgres://humanity@example.test/meerkat',
    applicationName: 'meerkat-humanity',
    sslMode: 'verify-full',
    sslCaFile: '/run/secrets/postgres-ca.pem',
  },
});

describe('createMeerkatStoreRuntime function quality gate', () => {
  it('opens no database resources for explicit self-hosted file mode', async () => {
    const poolFactory = vi.fn();
    const runtime = await createMeerkatStoreRuntime(fileConfig(), { poolFactory });
    expect(runtime.config.backend).toBe('file');
    expect(runtime.pool).toBeUndefined();
    expect(runtime.database).toBeUndefined();
    await expect(runtime.close()).resolves.toBeUndefined();
    expect(poolFactory).not.toHaveBeenCalled();
  });

  it('loads the CA, creates one bounded pool, and verifies the migration ledger', async () => {
    const pool = new RuntimePool();
    let received: MeerkatPostgresPoolOptions | undefined;
    const runtime = await createMeerkatStoreRuntime(postgresConfig(), {
      readTextFile: async (path) => {
        expect(path).toBe('/run/secrets/postgres-ca.pem');
        return 'test-ca';
      },
      poolFactory: (options) => {
        received = options;
        return pool as unknown as Pool;
      },
    });

    expect(received).toEqual({
      connectionString: 'postgres://humanity@example.test/meerkat',
      applicationName: 'meerkat-humanity',
      productionMode: true,
      sslMode: 'verify-full',
      sslCa: 'test-ca',
    });
    expect(runtime.pool).toBe(pool);
    expect(runtime.database).toBeDefined();
    await runtime.close();
    expect(pool.ended).toBe(1);
  });

  it('closes the partial pool and maps an incompatible schema to unavailable', async () => {
    const pool = new RuntimePool();
    await expect(createMeerkatStoreRuntime(postgresConfig(), {
      readTextFile: async () => 'test-ca',
      poolFactory: () => pool as unknown as Pool,
      minimumSchemaVersion: MEERKAT_POSTGRES_MIGRATIONS.length + 1,
    })).rejects.toBeInstanceOf(PostgresStoreUnavailableError);
    expect(pool.ended).toBe(1);
  });

  it('does not silently build a PostgreSQL runtime from an incomplete config', async () => {
    await expect(createMeerkatStoreRuntime({
      ...postgresConfig(),
      postgres: undefined,
    })).rejects.toThrow(/configuration is missing/);
  });

  it('maps an unreadable TLS CA to an explicit startup failure before pool creation', async () => {
    const poolFactory = vi.fn();
    await expect(createMeerkatStoreRuntime(postgresConfig(), {
      readTextFile: async () => {
        throw new Error('permission denied');
      },
      poolFactory,
    })).rejects.toMatchObject({
      code: 'postgres_store_unavailable',
      operation: 'TLS CA loading',
    });
    expect(poolFactory).not.toHaveBeenCalled();
  });

  it('stays within constant file-mode complexity and bounded memory', async () => {
    await assertComplexitySlope({
      label: 'createMeerkatStoreRuntime file mode',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup: fileConfig,
      run: createMeerkatStoreRuntime,
    });
    await assertMemoryBudget({
      label: 'createMeerkatStoreRuntime file mode',
      repeats: 200,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: fileConfig,
      run: createMeerkatStoreRuntime,
    });
  });
});
