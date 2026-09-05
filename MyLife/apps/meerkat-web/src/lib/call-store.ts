// Plan 25 WP-25H: the device-local call store (call_ tables). Web twin of
// apps/meerkat/app/(root)/data/call-store.ts (same DDL, same helpers).
//
// CRITICAL (NC-25.7): call_ tables are LOCAL-ONLY and never replicate. `call`
// is deliberately ABSENT from MEERKAT_SYNC_PREFIXES and MEERKAT_SYNC_POLICIES
// (meerkat-data.ts): because call_ resolves to no module under the real prefix
// map, applyReceivedDocumentChanges rejects any inbound call_ row
// (unknown_table). A call history row must never leave this device through a
// sync session, a mailbox, or a workspace. Do not add a call entry to the sync
// prefix/policy maps.
//
// call_log rows are written ONLY through foldCallLog (call-log-core.ts), so
// the honesty rules hold: duration exists only for a call that really
// connected, and the outcome is the real terminal phase.

import type { DatabaseAdapter } from '@mylife/db';
import type { CallLogRow } from './call-log-core';

export const CALL_LOG_TABLE = 'call_log';
export const CALL_ACTIVE_TABLE = 'call_active';
export const CALL_REPORTS_TABLE = 'call_reports';
export const CALL_SIGNAL_NONCES_TABLE = 'call_signal_nonces';

const CREATE_CALL_LOG = `
CREATE TABLE IF NOT EXISTS call_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('voice','video')),
  scope TEXT NOT NULL CHECK (scope IN ('direct','room')),
  peer_device_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  outcome TEXT CHECK (outcome IN ('completed','missed','declined','busy','failed','cancelled')),
  connected INTEGER NOT NULL DEFAULT 0,
  started_at_ms INTEGER,
  ended_at_ms INTEGER,
  duration_ms INTEGER,
  created_at_ms INTEGER NOT NULL
)`;

const CREATE_CALL_ACTIVE = `
CREATE TABLE IF NOT EXISTS call_active (
  call_id TEXT PRIMARY KEY,
  engine TEXT NOT NULL CHECK (engine IN ('direct','livekit')),
  engine_state TEXT NOT NULL,
  ice_state TEXT,
  local_mic_on INTEGER NOT NULL DEFAULT 1,
  local_cam_on INTEGER NOT NULL DEFAULT 0,
  security_mode TEXT NOT NULL CHECK (security_mode IN ('direct_e2e','direct_turn_relayed','room_e2ee','room_server_transit')),
  updated_at_ms INTEGER NOT NULL
)`;

const CREATE_CALL_REPORTS = `
CREATE TABLE IF NOT EXISTS call_reports (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  reported_device_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
)`;

// Replay floor for inbound call signals: seen nonces persist across a page
// reload so a captured signal cannot re-ring after a relaunch inside its
// 120s protocol TTL. Pruned by expiry; bounded by the signal TTL cap.
const CREATE_CALL_SIGNAL_NONCES = `
CREATE TABLE IF NOT EXISTS call_signal_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at_ms INTEGER NOT NULL
)`;

export function ensureCallTables(db: DatabaseAdapter): void {
  db.execute(CREATE_CALL_LOG);
  db.execute(CREATE_CALL_ACTIVE);
  db.execute(CREATE_CALL_REPORTS);
  db.execute(CREATE_CALL_SIGNAL_NONCES);
}

// --- call_log (written only via foldCallLog rows) ---

export function upsertCallLogRow(db: DatabaseAdapter, row: CallLogRow): void {
  db.execute(
    `INSERT INTO call_log (
      id, kind, scope, peer_device_id, direction, outcome, connected,
      started_at_ms, ended_at_ms, duration_ms, created_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      outcome = excluded.outcome,
      connected = excluded.connected,
      started_at_ms = excluded.started_at_ms,
      ended_at_ms = excluded.ended_at_ms,
      duration_ms = excluded.duration_ms`,
    [
      row.id,
      row.kind,
      row.scope,
      row.peerDeviceId,
      row.direction,
      row.outcome,
      row.connected ? 1 : 0,
      row.startedAtMs,
      row.endedAtMs,
      row.durationMs,
      row.createdAtMs,
    ],
  );
}

export function listCallLog(db: DatabaseAdapter, limit = 100): CallLogRow[] {
  const rows = db.query<{
    id: string;
    kind: string;
    scope: string;
    peer_device_id: string | null;
    direction: string;
    outcome: string | null;
    connected: number;
    started_at_ms: number | null;
    ended_at_ms: number | null;
    duration_ms: number | null;
    created_at_ms: number;
  }>(
    `SELECT * FROM call_log ORDER BY created_at_ms DESC LIMIT ?`,
    [Math.max(1, Math.floor(limit))],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === 'video' ? 'video' : 'voice',
    scope: 'direct',
    peerDeviceId: r.peer_device_id ?? '',
    direction: r.direction === 'incoming' ? 'incoming' : 'outgoing',
    outcome: (r.outcome ?? null) as CallLogRow['outcome'],
    connected: r.connected === 1,
    startedAtMs: r.started_at_ms,
    endedAtMs: r.ended_at_ms,
    durationMs: r.duration_ms,
    createdAtMs: r.created_at_ms,
  }));
}

// --- call_active (one live row per in-flight call; cleared on terminal) ---

export interface CallActiveRow {
  callId: string;
  engine: 'direct' | 'livekit';
  engineState: string;
  iceState: string | null;
  localMicOn: boolean;
  localCamOn: boolean;
  securityMode: 'direct_e2e' | 'direct_turn_relayed' | 'room_e2ee' | 'room_server_transit';
  updatedAtMs: number;
}

export function upsertCallActive(db: DatabaseAdapter, row: CallActiveRow): void {
  db.execute(
    `INSERT INTO call_active (
      call_id, engine, engine_state, ice_state, local_mic_on, local_cam_on,
      security_mode, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(call_id) DO UPDATE SET
      engine_state = excluded.engine_state,
      ice_state = excluded.ice_state,
      local_mic_on = excluded.local_mic_on,
      local_cam_on = excluded.local_cam_on,
      security_mode = excluded.security_mode,
      updated_at_ms = excluded.updated_at_ms`,
    [
      row.callId,
      row.engine,
      row.engineState,
      row.iceState,
      row.localMicOn ? 1 : 0,
      row.localCamOn ? 1 : 0,
      row.securityMode,
      row.updatedAtMs,
    ],
  );
}

export function clearCallActive(db: DatabaseAdapter, callId: string): void {
  db.execute(`DELETE FROM call_active WHERE call_id = ?`, [callId]);
}

// --- call_reports (local-only, like dm_reports) ---

export function recordCallReport(
  db: DatabaseAdapter,
  input: { callId: string; reportedDeviceId: string; reason: string; nowMs: number },
): void {
  const id = `cr_${input.callId}_${input.nowMs.toString(36)}`;
  db.execute(
    `INSERT OR IGNORE INTO call_reports (id, call_id, reported_device_id, reason, created_at_ms)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.callId, input.reportedDeviceId, input.reason, input.nowMs],
  );
}

// --- inbound signal replay floor (NC-25.2 support) ---

export function hasSeenCallNonce(db: DatabaseAdapter, nonce: string): boolean {
  const rows = db.query<{ nonce: string }>(
    `SELECT nonce FROM call_signal_nonces WHERE nonce = ?`,
    [nonce],
  );
  return rows.length > 0;
}

export function recordCallNonce(
  db: DatabaseAdapter,
  nonce: string,
  expiresAtMs: number,
): void {
  db.execute(
    `INSERT OR IGNORE INTO call_signal_nonces (nonce, expires_at_ms) VALUES (?, ?)`,
    [nonce, expiresAtMs],
  );
}

export function pruneCallNonces(db: DatabaseAdapter, nowMs: number): void {
  db.execute(`DELETE FROM call_signal_nonces WHERE expires_at_ms <= ?`, [nowMs]);
}
