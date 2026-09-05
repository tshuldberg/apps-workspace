import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import {
  createMeerkatPostgresPool,
  type MeerkatPostgresPoolOptions,
} from './pool';
import {
  assertPostgresSchemaCompatibility,
  readPostgresSchemaState,
} from './schema-guard';
import { PostgresStoreContext, toPostgresStoreUnavailableError } from './store-context';
import type { MeerkatStoreRuntimeConfig } from './runtime-config';

export interface MeerkatStoreRuntime {
  config: MeerkatStoreRuntimeConfig;
  pool?: Pool;
  database?: PostgresStoreContext;
  close(): Promise<void>;
}

export interface CreateMeerkatStoreRuntimeOptions {
  minimumSchemaVersion?: number;
  maximumSchemaVersion?: number;
  poolFactory?: (options: MeerkatPostgresPoolOptions) => Pool;
  readTextFile?: (path: string) => Promise<string>;
}

/**
 * Open and verify the selected state authority. A PostgreSQL startup failure closes
 * the partial pool and propagates an explicit unavailable error. It never falls back
 * to file mode after configuration has selected PostgreSQL.
 */
export async function createMeerkatStoreRuntime(
  config: MeerkatStoreRuntimeConfig,
  options: CreateMeerkatStoreRuntimeOptions = {},
): Promise<MeerkatStoreRuntime> {
  if (config.backend === 'file') {
    return {
      config,
      close: async () => undefined,
    };
  }

  const postgres = config.postgres;
  if (!postgres) throw new Error('PostgreSQL runtime configuration is missing');
  const readTextFile = options.readTextFile ?? (async (path) => fs.readFile(path, 'utf8'));
  let sslCa: string | undefined;
  try {
    sslCa = postgres.sslCaFile ? await readTextFile(postgres.sslCaFile) : undefined;
  } catch (error) {
    throw toPostgresStoreUnavailableError('TLS CA loading', error);
  }
  const poolFactory = options.poolFactory ?? createMeerkatPostgresPool;
  const pool = poolFactory({
    connectionString: postgres.connectionString,
    applicationName: postgres.applicationName,
    productionMode: config.productionMode,
    sslMode: postgres.sslMode,
    ...(sslCa ? { sslCa } : {}),
  });

  try {
    const schema = await readPostgresSchemaState(pool);
    assertPostgresSchemaCompatibility({
      currentVersion: schema.currentVersion,
      ...(options.minimumSchemaVersion === undefined
        ? {}
        : { minimumVersion: options.minimumSchemaVersion }),
      ...(options.maximumSchemaVersion === undefined
        ? {}
        : { maximumVersion: options.maximumSchemaVersion }),
    });
    return {
      config,
      pool,
      database: new PostgresStoreContext(pool),
      close: async () => pool.end(),
    };
  } catch (error) {
    try {
      await pool.end();
    } catch (closeError) {
      throw new AggregateError(
        [toPostgresStoreUnavailableError('startup readiness', error), closeError],
        'PostgreSQL startup readiness failed and the pool could not close',
      );
    }
    throw toPostgresStoreUnavailableError('startup readiness', error);
  }
}
