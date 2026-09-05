import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from 'pg';

export const POSTGRES_ADVISORY_LOCK_NAMESPACE_MAX_BYTES = 128;
export const POSTGRES_ADVISORY_LOCK_KEY_MAX_BYTES = 1_024;

function assertBoundedLockPart(
  name: 'namespace' | 'key',
  value: string,
  maxBytes: number,
): void {
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength === 0 || byteLength > maxBytes) {
    throw new Error(
      `PostgreSQL advisory lock ${name} must be between 1 and ${maxBytes} UTF-8 bytes`,
    );
  }
}

function advisoryLockComposite(namespace: string, key: string): string {
  assertBoundedLockPart(
    'namespace',
    namespace,
    POSTGRES_ADVISORY_LOCK_NAMESPACE_MAX_BYTES,
  );
  assertBoundedLockPart('key', key, POSTGRES_ADVISORY_LOCK_KEY_MAX_BYTES);

  // A JSON tuple is collision-safe when either part contains a delimiter.
  return JSON.stringify([namespace, key]);
}

export class PostgresStoreUnavailableError extends Error {
  readonly code = 'postgres_store_unavailable';
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    super(`PostgreSQL store is unavailable during ${operation}`, { cause });
    this.name = 'PostgresStoreUnavailableError';
    this.operation = operation;
  }
}

/**
 * Maps a database failure to an explicit unavailable result at a service boundary.
 * Store adapters should still inspect expected SQLSTATE conflicts before calling this
 * helper. It never converts a failure into missing data or an empty success value.
 */
export function toPostgresStoreUnavailableError(
  operation: string,
  error: unknown,
): PostgresStoreUnavailableError {
  if (error instanceof PostgresStoreUnavailableError) return error;
  return new PostgresStoreUnavailableError(operation, error);
}

/**
 * Routes every query in a transaction callback through the same checked-out client.
 * Pool configuration owns query, lock, transaction, connection, and lifetime bounds.
 */
export class PostgresStoreContext {
  private readonly transactionClient = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly pool: Pool) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    const queryable = this.transactionClient.getStore() ?? this.pool;
    return queryable.query<Row>(text, [...values]);
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactionClient.getStore()) return operation();

    const client = await this.pool.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await this.transactionClient.run(client, operation);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'PostgreSQL transaction failed and rollback also failed',
          );
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async withAdvisoryTransactionLock<T>(
    namespace: string,
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const composite = advisoryLockComposite(namespace, key);
    return this.transaction(async () => {
      await this.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [composite],
      );
      return operation();
    });
  }
}
