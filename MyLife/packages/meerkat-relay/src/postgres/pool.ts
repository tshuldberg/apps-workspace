import { Pool, type PoolConfig } from 'pg';

export type MeerkatPostgresSslMode = 'disable' | 'require' | 'verify-full';

export interface MeerkatPostgresPoolOptions {
  connectionString: string;
  applicationName: string;
  productionMode?: boolean;
  sslMode?: MeerkatPostgresSslMode;
  sslCa?: string;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleInTransactionTimeoutMs?: number;
  transactionTimeoutMs?: number;
  queryTimeoutMs?: number;
  maxLifetimeSeconds?: number;
}

const SAFE_APPLICATION_NAME = /^[A-Za-z0-9_.:-]{1,64}$/;

function assertSafeConnectionString(connectionString: string): void {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('PostgreSQL connection string must be a valid postgres:// URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('PostgreSQL connection string must use postgres:// or postgresql://');
  }
  if (url.search || url.hash) {
    throw new Error(
      'PostgreSQL connection URL parameters are forbidden because they can override TLS and timeout policy',
    );
  }
}

function positiveInteger(name: string, value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function createMeerkatPostgresPoolConfig(
  options: MeerkatPostgresPoolOptions,
): PoolConfig {
  const connectionString = options.connectionString.trim();
  const applicationName = options.applicationName.trim();
  const sslMode = options.sslMode ?? 'verify-full';

  if (!connectionString) throw new Error('PostgreSQL connection string is required');
  assertSafeConnectionString(connectionString);
  if (!SAFE_APPLICATION_NAME.test(applicationName)) {
    throw new Error('PostgreSQL application name must be 1 to 64 safe characters');
  }
  if (!['disable', 'require', 'verify-full'].includes(sslMode)) {
    throw new Error(`Unsupported PostgreSQL TLS mode: ${String(sslMode)}`);
  }
  if (options.productionMode && sslMode !== 'verify-full') {
    throw new Error('Production PostgreSQL connections require verify-full TLS');
  }
  if (sslMode === 'verify-full' && !options.sslCa?.trim()) {
    throw new Error('verify-full PostgreSQL TLS requires an explicit CA bundle');
  }

  const max = positiveInteger('maxConnections', options.maxConnections ?? 20, 100);
  const connectionTimeoutMillis = positiveInteger(
    'connectionTimeoutMs',
    options.connectionTimeoutMs ?? 5_000,
    120_000,
  );
  const idleTimeoutMillis = positiveInteger(
    'idleTimeoutMs',
    options.idleTimeoutMs ?? 30_000,
    600_000,
  );
  const statement_timeout = positiveInteger(
    'statementTimeoutMs',
    options.statementTimeoutMs ?? 10_000,
    300_000,
  );
  const lock_timeout = positiveInteger(
    'lockTimeoutMs',
    options.lockTimeoutMs ?? 5_000,
    120_000,
  );
  const idle_in_transaction_session_timeout = positiveInteger(
    'idleInTransactionTimeoutMs',
    options.idleInTransactionTimeoutMs ?? 15_000,
    300_000,
  );
  const transaction_timeout = positiveInteger(
    'transactionTimeoutMs',
    options.transactionTimeoutMs ?? Math.max(60_000, statement_timeout + 1_000),
    900_000,
  );
  const query_timeout = positiveInteger(
    'queryTimeoutMs',
    options.queryTimeoutMs ?? statement_timeout + 1_000,
    301_000,
  );
  if (query_timeout < statement_timeout + 1_000) {
    throw new Error('queryTimeoutMs must be at least 1000ms greater than statementTimeoutMs');
  }
  if (transaction_timeout <= statement_timeout) {
    throw new Error('transactionTimeoutMs must be greater than statementTimeoutMs');
  }
  const maxLifetimeSeconds = positiveInteger(
    'maxLifetimeSeconds',
    options.maxLifetimeSeconds ?? 300,
    86_400,
  );

  return {
    connectionString,
    application_name: applicationName,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    statement_timeout,
    lock_timeout,
    idle_in_transaction_session_timeout,
    options: `-c transaction_timeout=${transaction_timeout}`,
    query_timeout,
    maxLifetimeSeconds,
    keepAlive: true,
    allowExitOnIdle: false,
    ssl: sslMode === 'disable'
      ? false
      : {
          rejectUnauthorized: sslMode === 'verify-full',
          ...(options.sslCa?.trim() ? { ca: options.sslCa } : {}),
        },
  };
}

export function createMeerkatPostgresPool(options: MeerkatPostgresPoolOptions): Pool {
  return new Pool(createMeerkatPostgresPoolConfig(options));
}
