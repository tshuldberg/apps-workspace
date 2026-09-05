import {
  MEERKAT_POSTGRES_MIGRATIONS,
  type MeerkatPostgresMigration,
  validateMigrationSet,
} from './migrations';

export interface PostgresMigrationClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
  release(): void;
}

export interface PostgresMigrationPool {
  connect(): Promise<PostgresMigrationClient>;
}

export interface RunPostgresMigrationsOptions {
  migrations?: readonly MeerkatPostgresMigration[];
  targetVersion?: number;
  advisoryLockId?: number;
}

export interface PostgresMigrationResult {
  previousVersion: number;
  currentVersion: number;
  appliedVersions: number[];
}

interface AppliedMigrationRow extends Record<string, unknown> {
  version: number | string;
  name: string;
  checksum: string;
}

const DEFAULT_MIGRATION_LOCK_ID = 1_296_389_452;

export const BOOTSTRAP_MIGRATION_LEDGER_SQL = `
CREATE SCHEMA IF NOT EXISTS ops;
CREATE TABLE IF NOT EXISTS ops.schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  checksum text NOT NULL,
  execution_ms integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT schema_migration_version_positive CHECK (version > 0),
  CONSTRAINT schema_migration_execution_nonnegative CHECK (execution_ms >= 0)
);
`;

export const MIGRATION_LEDGER_VALIDATION_SQL = `
WITH relation AS (
  SELECT
    c.oid,
    c.relkind,
    c.relpersistence,
    pg_get_userbyid(c.relowner) AS owner_name,
    pg_get_userbyid(n.nspowner) AS schema_owner_name,
    NOT EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'CREATE'
    ) AS public_create_revoked,
    NOT EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
      WHERE acl.grantee <> c.relowner
        AND acl.privilege_type IN (
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER',
          'MAINTAIN'
        )
    ) AS non_owner_write_revoked,
    NOT EXISTS (
      SELECT 1
      FROM pg_attribute column_acl
      CROSS JOIN LATERAL aclexplode(COALESCE(column_acl.attacl, acldefault('c', c.relowner))) acl
      WHERE column_acl.attrelid = c.oid
        AND column_acl.attnum > 0
        AND NOT column_acl.attisdropped
        AND acl.grantee <> c.relowner
        AND acl.privilege_type IN ('INSERT', 'UPDATE', 'REFERENCES')
    ) AS non_owner_column_write_revoked
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'ops' AND c.relname = 'schema_migrations'
), columns AS (
  SELECT
    array_agg(a.attname ORDER BY a.attnum) AS names,
    array_agg(format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum) AS types,
    bool_and(a.attnotnull) AS all_not_null,
    max(pg_get_expr(d.adbin, d.adrelid)) FILTER (WHERE a.attname = 'applied_at') AS applied_default
  FROM relation r
  JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
), constraints AS (
  SELECT
    bool_or(con.contype = 'p' AND pg_get_constraintdef(con.oid) = 'PRIMARY KEY (version)') AS has_primary,
    bool_or(con.contype = 'u' AND pg_get_constraintdef(con.oid) = 'UNIQUE (name)') AS has_name_unique,
    bool_or(
      con.conname = 'schema_migration_version_positive'
      AND pg_get_constraintdef(con.oid) = 'CHECK ((version > 0))'
    ) AS has_version_check,
    bool_or(
      con.conname = 'schema_migration_execution_nonnegative'
      AND pg_get_constraintdef(con.oid) = 'CHECK ((execution_ms >= 0))'
    ) AS has_execution_check
  FROM relation r
  JOIN pg_constraint con ON con.conrelid = r.oid
)
SELECT COALESCE(
  (SELECT
    relkind = 'r'
    AND relpersistence = 'p'
    AND owner_name = current_user
    AND schema_owner_name = current_user
    AND public_create_revoked
    AND non_owner_write_revoked
    AND non_owner_column_write_revoked
   FROM relation)
  AND columns.names = ARRAY['version', 'name', 'checksum', 'execution_ms', 'applied_at']::name[]
  AND columns.types = ARRAY['integer', 'text', 'text', 'integer', 'timestamp with time zone']::text[]
  AND columns.all_not_null
  AND columns.applied_default = 'clock_timestamp()'
  AND constraints.has_primary
  AND constraints.has_name_unique
  AND constraints.has_version_check
  AND constraints.has_execution_check,
  false
) AS valid
FROM columns CROSS JOIN constraints;
`;

function safeVersion(value: unknown, label: string): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
  return version;
}

async function runInTransaction<T>(
  client: PostgresMigrationClient,
  operation: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await operation();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function recordMigration(
  client: PostgresMigrationClient,
  migration: MeerkatPostgresMigration,
  executionMs: number,
): Promise<void> {
  await client.query(
    `INSERT INTO ops.schema_migrations (version, name, checksum, execution_ms)
     VALUES ($1, $2, $3, $4)`,
    [migration.version, migration.name, migration.checksum, executionMs],
  );
}

async function applyTransactionalBatch(
  client: PostgresMigrationClient,
  migrations: readonly MeerkatPostgresMigration[],
): Promise<void> {
  if (migrations.length === 0) return;
  await runInTransaction(client, async () => {
    for (const migration of migrations) {
      const startedAt = Date.now();
      await client.query(migration.sql);
      await recordMigration(client, migration, Math.max(0, Date.now() - startedAt));
    }
  });
}

async function onlineMigrationApplied(
  client: PostgresMigrationClient,
  migration: MeerkatPostgresMigration,
): Promise<boolean> {
  const verification = await client.query(migration.verificationSql!);
  const applied = verification.rows[0]?.applied;
  if (typeof applied !== 'boolean') {
    throw new Error(`Online PostgreSQL migration verification must return boolean applied: ${migration.version}`);
  }
  return applied;
}

async function applyOnlineMigration(
  client: PostgresMigrationClient,
  migration: MeerkatPostgresMigration,
): Promise<void> {
  const startedAt = Date.now();
  if (!await onlineMigrationApplied(client, migration)) {
    await client.query(migration.recoverySql!);
    await client.query(migration.sql);
    if (!await onlineMigrationApplied(client, migration)) {
      throw new Error(`Online PostgreSQL migration did not satisfy verification: ${migration.version}`);
    }
  }
  await runInTransaction(
    client,
    () => recordMigration(client, migration, Math.max(0, Date.now() - startedAt)),
  );
}

export async function runPostgresMigrations(
  pool: PostgresMigrationPool,
  options: RunPostgresMigrationsOptions = {},
): Promise<PostgresMigrationResult> {
  const migrations = options.migrations ?? MEERKAT_POSTGRES_MIGRATIONS;
  validateMigrationSet(migrations);

  const maximumVersion = migrations.at(-1)?.version ?? 0;
  const targetVersion = safeVersion(options.targetVersion ?? maximumVersion, 'targetVersion');
  if (targetVersion > maximumVersion) {
    throw new Error(
      `PostgreSQL migration target ${targetVersion} exceeds available version ${maximumVersion}`,
    );
  }
  const advisoryLockId = safeVersion(
    options.advisoryLockId ?? DEFAULT_MIGRATION_LOCK_ID,
    'advisoryLockId',
  );

  const client = await pool.connect();
  let lockHeld = false;
  let result: PostgresMigrationResult | undefined;
  let operationError: unknown;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [advisoryLockId]);
    lockHeld = true;
    const appliedRows = await runInTransaction(client, async () => {
      await client.query(BOOTSTRAP_MIGRATION_LEDGER_SQL);
      const shape = await client.query(MIGRATION_LEDGER_VALIDATION_SQL);
      if (shape.rows[0]?.valid !== true) {
        throw new Error('PostgreSQL migration ledger shape or ownership is invalid');
      }
      const ledger = await client.query(
        'SELECT version, name, checksum FROM ops.schema_migrations ORDER BY version',
      );
      return ledger.rows as AppliedMigrationRow[];
    });
    let expectedAppliedVersion = 1;

    for (const row of appliedRows) {
      const version = safeVersion(row.version, 'applied migration version');
      if (version !== expectedAppliedVersion) {
        throw new Error(
          `PostgreSQL migration ledger has a gap: expected ${expectedAppliedVersion}, received ${version}`,
        );
      }
      const expected = migrations[version - 1];
      if (!expected) {
        throw new Error(`PostgreSQL schema version ${version} is newer than this release`);
      }
      if (row.name !== expected.name || row.checksum !== expected.checksum) {
        throw new Error(`PostgreSQL migration ${version} does not match the checked-in migration`);
      }
      expectedAppliedVersion += 1;
    }

    const previousVersion = appliedRows.length;
    if (previousVersion > targetVersion) {
      throw new Error(
        `PostgreSQL schema version ${previousVersion} is newer than requested target ${targetVersion}`,
      );
    }

    const pending = migrations.filter(
      (migration) => migration.version > previousVersion && migration.version <= targetVersion,
    );
    const appliedVersions: number[] = [];
    let transactionalBatch: MeerkatPostgresMigration[] = [];
    const flushBatch = async (): Promise<void> => {
      await applyTransactionalBatch(client, transactionalBatch);
      appliedVersions.push(...transactionalBatch.map((migration) => migration.version));
      transactionalBatch = [];
    };

    for (const migration of pending) {
      if ((migration.execution ?? 'transactional') === 'transactional') {
        transactionalBatch.push(migration);
        continue;
      }
      await flushBatch();
      await applyOnlineMigration(client, migration);
      appliedVersions.push(migration.version);
    }
    await flushBatch();

    result = { previousVersion, currentVersion: targetVersion, appliedVersions };
  } catch (error) {
    operationError = error;
  } finally {
    if (lockHeld) {
      try {
        const unlocked = await client.query('SELECT pg_advisory_unlock($1) AS unlocked', [advisoryLockId]);
        if (unlocked.rows[0]?.unlocked !== true) {
          operationError ??= new Error('PostgreSQL migration advisory lock was not released');
        }
      } catch (error) {
        operationError ??= error;
      }
    }
    client.release();
  }

  if (operationError) throw operationError;
  return result!;
}
