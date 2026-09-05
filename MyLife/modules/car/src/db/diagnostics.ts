import type { DatabaseAdapter } from '@mylife/db';
import type { DiagnosticSnapshot, DiagnosticCode, LiveDataLog } from '../types';

// ---------------------------------------------------------------------------
// Row mappers (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToSnapshot(row: Record<string, unknown>): DiagnosticSnapshot {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    adapterName: (row.adapter_name as string) ?? null,
    protocol: (row.protocol as string) ?? null,
    snapshotAt: row.snapshot_at as string,
    dtcCount: row.dtc_count as number,
    milStatus: !!(row.mil_status as number),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToCode(row: Record<string, unknown>): DiagnosticCode {
  return {
    id: row.id as string,
    snapshotId: row.snapshot_id as string,
    code: row.code as string,
    system: row.system as DiagnosticCode['system'],
    description: (row.description as string) ?? null,
    severity: row.severity as DiagnosticCode['severity'],
    isPending: !!(row.is_pending as number),
    createdAt: row.created_at as string,
  };
}

function rowToLiveData(row: Record<string, unknown>): LiveDataLog {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    pid: row.pid as string,
    pidName: (row.pid_name as string) ?? null,
    value: row.value as number,
    unit: (row.unit as string) ?? null,
    loggedAt: row.logged_at as string,
  };
}

// ---------------------------------------------------------------------------
// Diagnostic Snapshots
// ---------------------------------------------------------------------------

export function createSnapshot(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    adapterName?: string;
    protocol?: string;
    snapshotAt: string;
    dtcCount: number;
    milStatus: boolean;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_diagnostic_snapshots (id, vehicle_id, adapter_name, protocol, snapshot_at, dtc_count, mil_status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.adapterName ?? null,
      input.protocol ?? null,
      input.snapshotAt,
      input.dtcCount,
      input.milStatus ? 1 : 0,
      input.notes ?? null,
      now,
    ],
  );
}

export function getSnapshotsByVehicle(db: DatabaseAdapter, vehicleId: string, limit = 100): DiagnosticSnapshot[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_diagnostic_snapshots WHERE vehicle_id = ? ORDER BY snapshot_at DESC LIMIT ?',
      [vehicleId, limit],
    )
    .map(rowToSnapshot);
}

export function getSnapshotById(db: DatabaseAdapter, id: string): DiagnosticSnapshot | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_diagnostic_snapshots WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToSnapshot(rows[0]) : null;
}

export function deleteSnapshot(db: DatabaseAdapter, id: string): void {
  // Diagnostic codes will cascade delete via FK constraint
  db.execute('DELETE FROM cr_diagnostic_snapshots WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Diagnostic Codes
// ---------------------------------------------------------------------------

export function createDiagnosticCode(
  db: DatabaseAdapter,
  id: string,
  input: {
    snapshotId: string;
    code: string;
    system?: string;
    description?: string;
    severity?: string;
    isPending?: boolean;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_diagnostic_codes (id, snapshot_id, code, system, description, severity, is_pending, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.snapshotId,
      input.code,
      input.system ?? 'powertrain',
      input.description ?? null,
      input.severity ?? 'info',
      input.isPending ? 1 : 0,
      now,
    ],
  );
}

export function getCodesBySnapshot(db: DatabaseAdapter, snapshotId: string): DiagnosticCode[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM cr_diagnostic_codes WHERE snapshot_id = ? ORDER BY
        CASE severity
          WHEN 'critical' THEN 0
          WHEN 'warning' THEN 1
          WHEN 'info' THEN 2
          ELSE 3
        END ASC,
        code ASC`,
      [snapshotId],
    )
    .map(rowToCode);
}

// ---------------------------------------------------------------------------
// Live Data Logs
// ---------------------------------------------------------------------------

export function createLiveDataLog(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    pid: string;
    pidName?: string;
    value: number;
    unit?: string;
    loggedAt: string;
  },
): void {
  db.execute(
    `INSERT INTO cr_live_data_logs (id, vehicle_id, pid, pid_name, value, unit, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.pid,
      input.pidName ?? null,
      input.value,
      input.unit ?? null,
      input.loggedAt,
    ],
  );
}

export function getRecentLiveData(
  db: DatabaseAdapter,
  vehicleId: string,
  limit = 100,
): LiveDataLog[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_live_data_logs WHERE vehicle_id = ? ORDER BY logged_at DESC LIMIT ?',
      [vehicleId, limit],
    )
    .map(rowToLiveData);
}

export function clearLiveDataLogs(db: DatabaseAdapter, vehicleId: string): void {
  db.execute('DELETE FROM cr_live_data_logs WHERE vehicle_id = ?', [vehicleId]);
}
