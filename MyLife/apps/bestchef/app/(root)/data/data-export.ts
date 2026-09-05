// On-device GDPR Art. 15 / CCPA data export (N-17).
//
// Aggregates the BestChef data stored locally on the device into a portable JSON
// bundle the user can save or send from the OS share sheet. This is the device
// copy: secrets and capability tokens are excluded, and a link to request the
// full server-side account export is embedded in the bundle metadata.
//
// Pure and free of native-module imports so it is trivially unit-testable.

import type { DatabaseAdapter } from '@mylife/db';

// Excluded from the export. rc_share_tokens are capability tokens, not content;
// rc_settings is exported separately through `settings` with secret redaction.
const EXPORT_TABLE_DENYLIST = new Set<string>(['rc_share_tokens', 'rc_settings']);

// rc_settings keys whose values are secrets or device identifiers, redacted on export.
const SENSITIVE_SETTING_PATTERN = /secret|token|password|credential|private|viewer_id/i;
const REDACTED = '[redacted]';

export interface BestChefDataExport {
  _meta: {
    app: 'BestChef';
    exportedAt: string;
    scope: 'device';
    note: string;
    fullAccountExportUrl: string;
  };
  settings: Record<string, string>;
  tables: Record<string, Record<string, unknown>[]>;
}

export interface BuildBestChefDataExportOptions {
  exportedAt: string;
  fullAccountExportUrl: string;
}

function listUserTables(db: DatabaseAdapter): string[] {
  try {
    return db
      .query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'rc_%' ORDER BY name`,
      )
      .map((row) => row.name);
  } catch {
    return [];
  }
}

function queryAll(db: DatabaseAdapter, table: string): Record<string, unknown>[] {
  try {
    return db.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
  } catch {
    return [];
  }
}

export function buildBestChefDataExport(
  db: DatabaseAdapter,
  options: BuildBestChefDataExportOptions,
): BestChefDataExport {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of listUserTables(db)) {
    if (EXPORT_TABLE_DENYLIST.has(table)) continue;
    const rows = queryAll(db, table);
    if (rows.length > 0) tables[table] = rows;
  }

  const settings: Record<string, string> = {};
  try {
    for (const row of db.query<{ key: string; value: string }>(
      `SELECT key, value FROM rc_settings`,
    )) {
      settings[row.key] = SENSITIVE_SETTING_PATTERN.test(row.key) ? REDACTED : row.value;
    }
  } catch {
    // rc_settings absent on a fresh database; emit an empty settings object.
  }

  return {
    _meta: {
      app: 'BestChef',
      exportedAt: options.exportedAt,
      scope: 'device',
      note: 'A copy of the BestChef data stored on this device. Secrets and capability tokens are excluded. To request a full copy of your account including server-side records, use the link below.',
      fullAccountExportUrl: options.fullAccountExportUrl,
    },
    settings,
    tables,
  };
}

export function serializeBestChefDataExport(data: BestChefDataExport): string {
  return JSON.stringify(data, null, 2);
}
