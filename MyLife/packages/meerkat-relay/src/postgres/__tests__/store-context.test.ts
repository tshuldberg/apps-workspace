import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
  POSTGRES_ADVISORY_LOCK_KEY_MAX_BYTES,
  POSTGRES_ADVISORY_LOCK_NAMESPACE_MAX_BYTES,
  PostgresStoreContext,
  PostgresStoreUnavailableError,
  toPostgresStoreUnavailableError,
} from '../store-context';

interface RecordedQuery {
  text: string;
  values: unknown[];
}

function queryResult<Row extends QueryResultRow>(rows: Row[] = []): QueryResult<Row> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
}

class FakeClient {
  readonly queries: RecordedQuery[] = [];
  released = 0;
  failOn = '';
  rollbackFailure: Error | undefined;

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text, values });
    if (text === 'ROLLBACK' && this.rollbackFailure) throw this.rollbackFailure;
    if (this.failOn && text.includes(this.failOn)) throw new Error(`failed: ${text}`);
    return queryResult<Row>();
  }

  release(): void {
    this.released += 1;
  }
}

class FakePool {
  readonly queries: RecordedQuery[] = [];
  connectCalls = 0;

  constructor(readonly client: FakeClient) {}

  async connect(): Promise<PoolClient> {
    this.connectCalls += 1;
    return this.client as unknown as PoolClient;
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text, values });
    return queryResult<Row>();
  }
}

function contextWithFakes(): {
  client: FakeClient;
  context: PostgresStoreContext;
  pool: FakePool;
} {
  const client = new FakeClient();
  const pool = new FakePool(client);
  return {
    client,
    context: new PostgresStoreContext(pool as unknown as Pool),
    pool,
  };
}

describe('PostgresStoreContext', () => {
  it('routes standalone queries through the pool', async () => {
    const { client, context, pool } = contextWithFakes();

    await context.query('SELECT $1::text AS value', ['outside']);

    expect(pool.queries).toEqual([{
      text: 'SELECT $1::text AS value',
      values: ['outside'],
    }]);
    expect(client.queries).toEqual([]);
    expect(pool.connectCalls).toBe(0);
  });

  it('uses one checked-out client for every query in a transaction', async () => {
    const { client, context, pool } = contextWithFakes();

    await expect(context.transaction(async () => {
      await context.query('SELECT 1');
      await context.query('SELECT 2', ['second']);
      return 'committed';
    })).resolves.toBe('committed');

    expect(pool.connectCalls).toBe(1);
    expect(pool.queries).toEqual([]);
    expect(client.queries).toEqual([
      { text: 'BEGIN', values: [] },
      { text: 'SELECT 1', values: [] },
      { text: 'SELECT 2', values: ['second'] },
      { text: 'COMMIT', values: [] },
    ]);
    expect(client.released).toBe(1);
  });

  it('reuses the outer transaction for safely nested callbacks', async () => {
    const { client, context, pool } = contextWithFakes();

    await context.transaction(async () => {
      await context.query('SELECT outer_before');
      await context.transaction(async () => {
        await context.query('SELECT nested');
      });
      await context.query('SELECT outer_after');
    });

    expect(pool.connectCalls).toBe(1);
    expect(client.queries.map(({ text }) => text)).toEqual([
      'BEGIN',
      'SELECT outer_before',
      'SELECT nested',
      'SELECT outer_after',
      'COMMIT',
    ]);
    expect(client.released).toBe(1);
  });

  it('rolls back operation failures and always releases the client', async () => {
    const { client, context } = contextWithFakes();
    const operationFailure = new Error('operation failed');

    await expect(context.transaction(async () => {
      await context.query('SELECT before_failure');
      throw operationFailure;
    })).rejects.toBe(operationFailure);

    expect(client.queries.map(({ text }) => text)).toEqual([
      'BEGIN',
      'SELECT before_failure',
      'ROLLBACK',
    ]);
    expect(client.released).toBe(1);
  });

  it('propagates query failures instead of translating them into missing data', async () => {
    const { client, context } = contextWithFakes();
    client.failOn = 'SELECT unavailable';

    await expect(context.transaction(async () => {
      await context.query('SELECT unavailable');
      return [];
    })).rejects.toThrow('failed: SELECT unavailable');

    expect(client.queries.map(({ text }) => text)).toEqual([
      'BEGIN',
      'SELECT unavailable',
      'ROLLBACK',
    ]);
    expect(client.released).toBe(1);
  });

  it('releases the client when BEGIN fails without issuing a rollback', async () => {
    const { client, context } = contextWithFakes();
    client.failOn = 'BEGIN';

    await expect(context.transaction(async () => 'never')).rejects.toThrow('failed: BEGIN');

    expect(client.queries.map(({ text }) => text)).toEqual(['BEGIN']);
    expect(client.released).toBe(1);
  });

  it('preserves transaction and rollback failures together', async () => {
    const { client, context } = contextWithFakes();
    const operationFailure = new Error('operation failed');
    client.rollbackFailure = new Error('rollback failed');

    const caught = await context.transaction(async () => {
      throw operationFailure;
    }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors).toEqual([
      operationFailure,
      client.rollbackFailure,
    ]);
    expect(client.released).toBe(1);
  });

  it('acquires a collision-safe transaction advisory lock before the operation', async () => {
    const { client, context, pool } = contextWithFakes();

    await context.withAdvisoryTransactionLock('publication:write', 'owner:post:1', async () => {
      await context.query('SELECT protected_write');
    });

    expect(pool.connectCalls).toBe(1);
    expect(client.queries).toEqual([
      { text: 'BEGIN', values: [] },
      {
        text: 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        values: ['["publication:write","owner:post:1"]'],
      },
      { text: 'SELECT protected_write', values: [] },
      { text: 'COMMIT', values: [] },
    ]);
  });

  it('reuses an active transaction when acquiring an advisory lock', async () => {
    const { client, context, pool } = contextWithFakes();

    await context.transaction(async () => {
      await context.withAdvisoryTransactionLock('publication', 'one', async () => {
        await context.query('SELECT protected_write');
      });
    });

    expect(pool.connectCalls).toBe(1);
    expect(client.queries.map(({ text }) => text)).toEqual([
      'BEGIN',
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'SELECT protected_write',
      'COMMIT',
    ]);
  });

  it('rejects empty or oversized advisory lock parts before checking out a client', async () => {
    const { context, pool } = contextWithFakes();

    await expect(context.withAdvisoryTransactionLock('', 'key', async () => undefined))
      .rejects.toThrow(/namespace must be between 1 and 128/);
    await expect(context.withAdvisoryTransactionLock(
      'n'.repeat(POSTGRES_ADVISORY_LOCK_NAMESPACE_MAX_BYTES + 1),
      'key',
      async () => undefined,
    )).rejects.toThrow(/namespace must be between 1 and 128/);
    await expect(context.withAdvisoryTransactionLock(
      'é'.repeat((POSTGRES_ADVISORY_LOCK_NAMESPACE_MAX_BYTES / 2) + 1),
      'key',
      async () => undefined,
    )).rejects.toThrow(/namespace must be between 1 and 128/);
    await expect(context.withAdvisoryTransactionLock(
      'namespace',
      'k'.repeat(POSTGRES_ADVISORY_LOCK_KEY_MAX_BYTES + 1),
      async () => undefined,
    )).rejects.toThrow(/key must be between 1 and 1024/);
    await expect(context.withAdvisoryTransactionLock(
      'namespace',
      '',
      async () => undefined,
    )).rejects.toThrow(/key must be between 1 and 1024/);

    expect(pool.connectCalls).toBe(0);
  });

  it('maps database failures to explicit unavailable errors without losing the cause', () => {
    const databaseFailure = new Error('connect ECONNREFUSED 127.0.0.1');
    const mapped = toPostgresStoreUnavailableError('load publication', databaseFailure);

    expect(mapped).toBeInstanceOf(PostgresStoreUnavailableError);
    expect(mapped.code).toBe('postgres_store_unavailable');
    expect(mapped.operation).toBe('load publication');
    expect(mapped.cause).toBe(databaseFailure);
    expect(mapped.message).not.toContain('ECONNREFUSED');
    expect(toPostgresStoreUnavailableError('ignored', mapped)).toBe(mapped);
  });
});

const liveConnectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const describeLivePostgres = liveConnectionString ? describe.sequential : describe.skip;

describeLivePostgres('PostgresStoreContext PostgreSQL integration', () => {
  const pool = new Pool({
    connectionString: liveConnectionString,
    application_name: 'meerkat-store-context-integration',
    max: 2,
    statement_timeout: 10_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 10_000,
  });
  pool.on('error', () => undefined);
  const context = new PostgresStoreContext(pool);

  afterAll(async () => {
    await pool.end();
  });

  it('keeps nested work and advisory locks on one PostgreSQL session', async () => {
    const backendPids = await context.transaction(async () => {
      const before = await context.query<{ backend_pid: number }>(
        'SELECT pg_backend_pid() AS backend_pid',
      );
      return context.withAdvisoryTransactionLock('store-context-live', 'same-client', async () => {
        const nested = await context.query<{ backend_pid: number }>(
          'SELECT pg_backend_pid() AS backend_pid',
        );
        return [before.rows[0]?.backend_pid, nested.rows[0]?.backend_pid];
      });
    });

    expect(backendPids[0]).toBeTypeOf('number');
    expect(backendPids[1]).toBe(backendPids[0]);
  });
});
