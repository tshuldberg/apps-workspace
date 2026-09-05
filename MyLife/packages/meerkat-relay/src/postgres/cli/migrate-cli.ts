import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { runPostgresMigrations } from '../migrate';

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};
let pool: Pool | undefined;

try {
  const connectionString = (process.env.DATABASE_URL ?? '').trim();
  const sslMode = (process.env.MEERKAT_POSTGRES_SSL_MODE ?? '').trim() || 'verify-full';
  const sslCaPath = (process.env.MEERKAT_POSTGRES_SSL_CA_FILE ?? '').trim();

  if (!connectionString) throw new Error('DATABASE_URL is required');
  const sslCa = sslCaPath ? await fs.readFile(sslCaPath, 'utf8') : undefined;
  pool = createMeerkatPostgresPool({
    connectionString,
    applicationName: 'meerkat-migrate',
    productionMode: process.env.NODE_ENV === 'production',
    sslMode: sslMode as 'disable' | 'require' | 'verify-full',
    ...(sslCa ? { sslCa } : {}),
    maxConnections: 1,
    statementTimeoutMs: 300_000,
    queryTimeoutMs: 301_000,
  });

  const result = await runPostgresMigrations(pool);
  output({ event: 'migrations_complete', ...result });
} catch (error) {
  output({
    event: 'fatal',
    reason: 'migration_failed',
    detail: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      output({
        event: 'fatal',
        reason: 'pool_shutdown_failed',
        detail: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }
  }
}
