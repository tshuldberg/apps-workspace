import {
  MEERKAT_POSTGRES_MIGRATIONS,
  MEERKAT_POSTGRES_SCHEMA_VERSION,
} from './migrations';

export interface PostgresSchemaCompatibility {
  currentVersion: number;
  minimumVersion?: number;
  maximumVersion?: number;
}

export interface PostgresSchemaState {
  currentVersion: number;
  appliedCount: number;
}

export interface PostgresSchemaQuery {
  query(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export function assertPostgresSchemaCompatibility(
  compatibility: PostgresSchemaCompatibility,
): void {
  const minimum = compatibility.minimumVersion ?? MEERKAT_POSTGRES_SCHEMA_VERSION;
  const maximum = compatibility.maximumVersion;

  if (!Number.isSafeInteger(compatibility.currentVersion) || compatibility.currentVersion < 0) {
    throw new Error('PostgreSQL schema version must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(minimum) || minimum < 0) {
    throw new Error('PostgreSQL schema compatibility range is invalid');
  }
  if (maximum !== undefined
    && (!Number.isSafeInteger(maximum) || maximum < minimum)) {
    throw new Error('PostgreSQL schema compatibility range is invalid');
  }
  if (compatibility.currentVersion < minimum) {
    throw new Error(
      `PostgreSQL schema is too old: ${compatibility.currentVersion}; minimum supported is ${minimum}`,
    );
  }
  if (maximum !== undefined && compatibility.currentVersion > maximum) {
    throw new Error(
      `PostgreSQL schema is too new: ${compatibility.currentVersion}; maximum supported is ${maximum}`,
    );
  }
}

export async function readPostgresSchemaState(
  queryable: PostgresSchemaQuery,
): Promise<PostgresSchemaState> {
  const result = await queryable.query(`
    SELECT version, name, checksum
    FROM ops.schema_migrations
    ORDER BY version
  `);

  for (const [index, row] of result.rows.entries()) {
    const version = Number(row.version);
    const expectedVersion = index + 1;
    if (!Number.isSafeInteger(version) || version !== expectedVersion) {
      throw new Error(
        `PostgreSQL schema ledger is not contiguous: expected=${expectedVersion}, version=${String(row.version)}`,
      );
    }
    const expected = MEERKAT_POSTGRES_MIGRATIONS[index];
    if (expected && (row.name !== expected.name || row.checksum !== expected.checksum)) {
      throw new Error(`PostgreSQL schema ledger migration ${version} does not match this release`);
    }
    if (!expected && (
      typeof row.name !== 'string'
      || !/^[a-z][a-z0-9_]{0,62}$/.test(row.name)
      || typeof row.checksum !== 'string'
      || !/^[a-f0-9]{64}$/.test(row.checksum)
    )) {
      throw new Error(`PostgreSQL schema ledger future migration ${version} is malformed`);
    }
  }

  return { currentVersion: result.rows.length, appliedCount: result.rows.length };
}
