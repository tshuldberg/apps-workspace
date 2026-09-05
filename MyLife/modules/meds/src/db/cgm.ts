import type { DatabaseAdapter } from '@mylife/db';
import type {
  CGMReading,
  CGMSource,
  CGMSyncState,
  CreateCGMReadingInput,
} from '../models/cgm';
import { classifyGlucose } from '../glucose/engine';

function rowToCGMReading(row: Record<string, unknown>): CGMReading {
  return {
    id: row.id as string,
    value: row.value as number,
    unit: row.unit as CGMReading['unit'],
    rangeStatus: row.range_status as CGMReading['rangeStatus'],
    source: row.source as CGMSource,
    deviceName: (row.device_name as string) ?? null,
    measuredAt: row.measured_at as string,
    createdAt: row.created_at as string,
  };
}

function rowToCGMSyncState(row: Record<string, unknown>): CGMSyncState {
  return {
    id: row.id as string,
    lastSyncAt: row.last_sync_at as string,
    lastAnchor: (row.last_anchor as string) ?? null,
    readingsSynced: row.readings_synced as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createCGMReading(
  db: DatabaseAdapter,
  id: string,
  input: CreateCGMReadingInput,
): CGMReading {
  const now = new Date().toISOString();
  const unit = input.unit ?? 'mg/dL';
  const source = input.source ?? 'healthkit';
  const rangeStatus = classifyGlucose(input.value, unit);

  db.execute(
    `INSERT INTO md_cgm_readings (id, value, unit, range_status, source, device_name, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.value,
      unit,
      rangeStatus,
      source,
      input.deviceName ?? null,
      input.measuredAt,
      now,
    ],
  );

  return {
    id,
    value: input.value,
    unit,
    rangeStatus,
    source,
    deviceName: input.deviceName ?? null,
    measuredAt: input.measuredAt,
    createdAt: now,
  };
}

export function getCGMReadings(
  db: DatabaseAdapter,
  opts?: { from?: string; to?: string; source?: CGMSource; limit?: number },
): CGMReading[] {
  let sql = 'SELECT * FROM md_cgm_readings WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.from) {
    sql += ' AND measured_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND measured_at <= ?';
    params.push(opts.to);
  }
  if (opts?.source) {
    sql += ' AND source = ?';
    params.push(opts.source);
  }

  sql += ' ORDER BY measured_at DESC LIMIT ?';
  params.push(opts?.limit ?? 2000);

  return db.query<Record<string, unknown>>(sql, params).map(rowToCGMReading);
}

export function getCGMSyncState(db: DatabaseAdapter): CGMSyncState | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_cgm_sync_state ORDER BY updated_at DESC LIMIT 1',
  );
  return rows.length > 0 ? rowToCGMSyncState(rows[0]) : null;
}

export function upsertCGMSyncState(
  db: DatabaseAdapter,
  input: { lastSyncAt?: string; lastAnchor?: string | null; readingsSynced?: number },
): CGMSyncState {
  const now = new Date().toISOString();
  const existing = getCGMSyncState(db);

  const nextState: CGMSyncState = {
    id: existing?.id ?? 'default',
    lastSyncAt: input.lastSyncAt ?? now,
    lastAnchor: input.lastAnchor ?? existing?.lastAnchor ?? null,
    readingsSynced: input.readingsSynced ?? existing?.readingsSynced ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  db.execute(
    `INSERT INTO md_cgm_sync_state (id, last_sync_at, last_anchor, readings_synced, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_sync_at = excluded.last_sync_at,
       last_anchor = excluded.last_anchor,
       readings_synced = excluded.readings_synced,
       updated_at = excluded.updated_at`,
    [
      nextState.id,
      nextState.lastSyncAt,
      nextState.lastAnchor,
      nextState.readingsSynced,
      nextState.createdAt,
      nextState.updatedAt,
    ],
  );

  return nextState;
}
