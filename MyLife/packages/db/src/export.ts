/**
 * Hub-wide data export.
 *
 * Iterates enabled modules, discovers their SQLite tables by prefix,
 * queries all rows, and assembles a single JSON export object.
 * Per-module errors are caught and noted without blocking other modules.
 */

import type { DatabaseAdapter } from './adapter';

/** A single table's exported data. */
export interface ExportedTable {
  tableName: string;
  rowCount: number;
  rows: Record<string, unknown>[];
}

/** Export result for one module. */
export interface ModuleExport {
  moduleId: string;
  tablePrefix: string;
  tables: ExportedTable[];
  /** Present only when the module export failed. */
  error?: string;
}

/** Top-level export envelope. */
export interface HubExportData {
  version: 1;
  exportedAt: string;
  modules: ModuleExport[];
  /** Hub-level tables (hub_ prefix). */
  hub: ExportedTable[];
}

/** Minimal module info needed by the export function. */
export interface ExportableModule {
  id: string;
  tablePrefix?: string;
}

/**
 * Discover all SQLite tables matching a given prefix.
 */
function getTablesWithPrefix(
  db: DatabaseAdapter,
  prefix: string,
): string[] {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
    [`${prefix}%`],
  );
  return rows.map((r) => r.name);
}

/**
 * Export all rows from a list of tables.
 */
function exportTables(
  db: DatabaseAdapter,
  tableNames: string[],
): ExportedTable[] {
  return tableNames.map((tableName) => {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM "${tableName}"`,
    );
    return { tableName, rowCount: rows.length, rows };
  });
}

/**
 * Export all data from all enabled modules and hub tables.
 *
 * For each module with a `tablePrefix`, discovers its tables via
 * `sqlite_master` and dumps every row. Modules without a prefix or
 * whose export throws are skipped with an error note (R5.7).
 *
 * Works entirely offline against local SQLite (R5.5).
 */
export function exportAllModules(
  db: DatabaseAdapter,
  enabledModules: ExportableModule[],
): HubExportData {
  const modules: ModuleExport[] = [];

  for (const mod of enabledModules) {
    if (!mod.tablePrefix) {
      modules.push({
        moduleId: mod.id,
        tablePrefix: '',
        tables: [],
        error: 'Module has no table prefix; no local data to export.',
      });
      continue;
    }

    try {
      const tableNames = getTablesWithPrefix(db, mod.tablePrefix);
      const tables = exportTables(db, tableNames);
      modules.push({
        moduleId: mod.id,
        tablePrefix: mod.tablePrefix,
        tables,
      });
    } catch (err) {
      modules.push({
        moduleId: mod.id,
        tablePrefix: mod.tablePrefix,
        tables: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Export hub-level tables
  let hub: ExportedTable[] = [];
  try {
    const hubTableNames = getTablesWithPrefix(db, 'hub_');
    hub = exportTables(db, hubTableNames);
  } catch {
    // Hub export failure is non-fatal; proceed with module data
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    modules,
    hub,
  };
}
