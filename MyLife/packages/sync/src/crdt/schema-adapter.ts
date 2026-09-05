/**
 * Maps SQLite rows to/from CRDT operations.
 *
 * Provides utility functions for converting between the Automerge
 * document representation and SQLite INSERT/UPDATE/DELETE statements.
 */

/** Fields to strip when converting SQLite rows to CRDT data. */
const SQLITE_INTERNAL_FIELDS = new Set([
  'rowid',
  '_rowid_',
  'oid',
]);

/** Convert a SQLite row to CRDT-compatible data (strip SQLite-specific fields). */
export function rowToCrdtData(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!SQLITE_INTERNAL_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Convert CRDT data back to a SQLite INSERT/UPDATE.
 * Returns column names and values arrays for parameterized queries.
 */
export function crdtDataToSqlValues(data: Record<string, unknown>): {
  columns: string[];
  values: unknown[];
} {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    columns.push(key);
    values.push(value);
  }
  return { columns, values };
}

/** Build a parameterized SQLite INSERT statement from CRDT data. */
export function buildInsertSql(
  table: string,
  data: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const { columns, values } = crdtDataToSqlValues(data);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  return { sql, params: values };
}

/** Build a parameterized SQLite UPDATE statement from CRDT data. */
export function buildUpdateSql(
  table: string,
  rowId: string,
  data: Record<string, unknown>,
  primaryKeyColumn = 'id',
): { sql: string; params: unknown[] } {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key !== primaryKeyColumn) {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  // If all columns are the PK, there's nothing to update
  if (setClauses.length === 0) {
    return { sql: `SELECT 1 WHERE 0`, params: [] };
  }

  params.push(rowId);
  const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${primaryKeyColumn} = ?`;
  return { sql, params };
}

/** Build a parameterized SQLite DELETE statement. */
export function buildDeleteSql(
  table: string,
  rowId: string,
  primaryKeyColumn = 'id',
): { sql: string; params: unknown[] } {
  const sql = `DELETE FROM ${table} WHERE ${primaryKeyColumn} = ?`;
  return { sql, params: [rowId] };
}
