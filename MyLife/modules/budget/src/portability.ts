import type { DatabaseAdapter } from '@mylife/db';
import {
  BUDGET_TABLE_NAMES,
  SEED_DEFAULT_ACCOUNTS,
  SEED_DEFAULT_ENVELOPES,
  SEED_SETTINGS,
} from './db/schema';

export interface BudgetExportBundle {
  schemaVersion: 1;
  exportedAt: string;
  tableNames: readonly string[];
  counts: Record<string, number>;
  tables: Record<string, Record<string, unknown>[]>;
}

export interface BudgetResetResult {
  rowsDeleted: number;
  tablesVisited: number;
  defaultsRestored: boolean;
}

function listExistingBudgetTables(db: DatabaseAdapter): string[] {
  const rows = db.query<{ name: string }>(
    `SELECT name
       FROM sqlite_master
      WHERE type = 'table'
        AND name LIKE 'bg_%'`,
  );
  const known = new Set(rows.map((row) => row.name));
  return BUDGET_TABLE_NAMES.filter((name) => known.has(name));
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return 'id\n';
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');
}

export function buildBudgetExportBundle(db: DatabaseAdapter): BudgetExportBundle {
  const tableNames = listExistingBudgetTables(db);
  const counts: Record<string, number> = {};
  const tables: Record<string, Record<string, unknown>[]> = {};

  for (const tableName of tableNames) {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM ${tableName} ORDER BY rowid ASC`,
    );
    counts[tableName] = rows.length;
    tables[tableName] = rows;
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tableNames,
    counts,
    tables,
  };
}

export function serializeBudgetExportJson(db: DatabaseAdapter): string {
  return JSON.stringify(buildBudgetExportBundle(db), null, 2);
}

export function exportBudgetTransactionsCsv(db: DatabaseAdapter): string {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
       FROM bg_transactions
      ORDER BY occurred_on DESC, created_at DESC`,
  );
  return rowsToCsv(rows);
}

export function resetBudgetData(db: DatabaseAdapter): BudgetResetResult {
  const tableNames = listExistingBudgetTables(db);
  let rowsDeleted = 0;

  db.transaction(() => {
    for (const tableName of [...tableNames].reverse()) {
      const row = db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName}`,
      )[0];
      rowsDeleted += row?.count ?? 0;
      db.execute(`DELETE FROM ${tableName}`);
    }

    for (const statement of [...SEED_SETTINGS, ...SEED_DEFAULT_ACCOUNTS, ...SEED_DEFAULT_ENVELOPES]) {
      db.execute(statement);
    }
  });

  return {
    rowsDeleted,
    tablesVisited: tableNames.length,
    defaultsRestored: true,
  };
}
