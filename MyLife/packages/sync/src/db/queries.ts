/**
 * CRUD operations for all sync and torrent tables.
 *
 * All functions take a DatabaseAdapter and perform typed reads/writes
 * against the sync_ and torrent_ prefixed tables.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  BlobPolicyEntry,
  BlobRef,
  BlobSyncPolicy,
  ChangeRecord,
  ContentManifest,
  DeviceIdentity,
  DeviceRevocation,
  PairedDevice,
  PeerModuleState,
  SeedingPolicy,
  ShareRequest,
  ShareStatus,
  SyncSession,
  SyncTransport,
  SyncWorkspace,
  SyncWorkspaceMember,
  SyncWorkspaceKeyWrap,
  SyncEntityAcl,
  SyncTombstone,
  SyncReceipt,
  SyncInboundAudit,
  InboundAuditOutcome,
  SyncPinnedIdentity,
  SyncSasVerification,
  SyncConflictEntry,
  SyncTransportPreference,
  SyncSecurityConfirmation,
  SyncSecurityPreference,
  SyncSecuritySubjectType,
  SyncExpiringEntity,
  SyncSessionModuleStats,
  SyncRelayToken,
  WorkspaceType,
  WorkspaceMemberRole,
  SyncScope,
} from '../types';

// ---------------------------------------------------------------------------
// Device Identity
// ---------------------------------------------------------------------------

export function getDeviceIdentity(db: DatabaseAdapter): DeviceIdentity | null {
  const rows = db.query<{
    public_key: string;
    private_key_ref: string;
    dh_public_key: string;
    display_name: string;
    created_at: string;
  }>('SELECT public_key, private_key_ref, dh_public_key, display_name, created_at FROM sync_device_identity WHERE id = ?', ['self']);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    publicKey: r.public_key,
    privateKeyRef: r.private_key_ref,
    dhPublicKey: r.dh_public_key,
    displayName: r.display_name,
    createdAt: r.created_at,
  };
}

export function upsertDeviceIdentity(db: DatabaseAdapter, identity: DeviceIdentity): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_device_identity (id, public_key, private_key_ref, dh_public_key, display_name, created_at)
     VALUES ('self', ?, ?, ?, ?, ?)`,
    [identity.publicKey, identity.privateKeyRef, identity.dhPublicKey, identity.displayName, identity.createdAt],
  );
}

// ---------------------------------------------------------------------------
// Paired Devices
// ---------------------------------------------------------------------------

export function getPairedDevices(db: DatabaseAdapter): PairedDevice[] {
  const rows = db.query<{
    device_id: string;
    display_name: string;
    dh_public_key: string;
    shared_secret_ref: string;
    last_seen_at: string | null;
    last_sync_at: string | null;
    last_sync_module: string | null;
    bytes_sent: number;
    bytes_received: number;
    is_active: number;
    paired_at: string;
  }>('SELECT * FROM sync_paired_devices ORDER BY paired_at DESC');
  return rows.map((r) => ({
    deviceId: r.device_id,
    displayName: r.display_name,
    dhPublicKey: r.dh_public_key,
    sharedSecretRef: r.shared_secret_ref,
    lastSeenAt: r.last_seen_at,
    lastSyncAt: r.last_sync_at,
    lastSyncModule: r.last_sync_module,
    bytesSent: r.bytes_sent,
    bytesReceived: r.bytes_received,
    isActive: r.is_active === 1,
    pairedAt: r.paired_at,
  }));
}

export function getPairedDevice(db: DatabaseAdapter, deviceId: string): PairedDevice | null {
  const rows = db.query<{
    device_id: string;
    display_name: string;
    dh_public_key: string;
    shared_secret_ref: string;
    last_seen_at: string | null;
    last_sync_at: string | null;
    last_sync_module: string | null;
    bytes_sent: number;
    bytes_received: number;
    is_active: number;
    paired_at: string;
  }>('SELECT * FROM sync_paired_devices WHERE device_id = ?', [deviceId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    deviceId: r.device_id,
    displayName: r.display_name,
    dhPublicKey: r.dh_public_key,
    sharedSecretRef: r.shared_secret_ref,
    lastSeenAt: r.last_seen_at,
    lastSyncAt: r.last_sync_at,
    lastSyncModule: r.last_sync_module,
    bytesSent: r.bytes_sent,
    bytesReceived: r.bytes_received,
    isActive: r.is_active === 1,
    pairedAt: r.paired_at,
  };
}

export function insertPairedDevice(db: DatabaseAdapter, device: PairedDevice): void {
  db.execute(
    `INSERT INTO sync_paired_devices (device_id, display_name, dh_public_key, shared_secret_ref, last_seen_at, last_sync_at, last_sync_module, bytes_sent, bytes_received, is_active, paired_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      device.deviceId, device.displayName, device.dhPublicKey, device.sharedSecretRef,
      device.lastSeenAt, device.lastSyncAt, device.lastSyncModule,
      device.bytesSent, device.bytesReceived, device.isActive ? 1 : 0, device.pairedAt,
    ],
  );
}

export function updatePairedDeviceSharedSecret(
  db: DatabaseAdapter,
  deviceId: string,
  sharedSecretRef: string,
): void {
  db.execute(
    'UPDATE sync_paired_devices SET shared_secret_ref = ? WHERE device_id = ?',
    [sharedSecretRef, deviceId],
  );
}

export function updatePairedDeviceLastSeen(db: DatabaseAdapter, deviceId: string, at: string): void {
  db.execute('UPDATE sync_paired_devices SET last_seen_at = ? WHERE device_id = ?', [at, deviceId]);
}

export function updatePairedDeviceSyncStats(
  db: DatabaseAdapter,
  deviceId: string,
  opts: { lastSyncAt: string; lastSyncModule: string; bytesSent: number; bytesReceived: number },
): void {
  db.execute(
    `UPDATE sync_paired_devices
     SET last_sync_at = ?, last_sync_module = ?,
         bytes_sent = bytes_sent + ?, bytes_received = bytes_received + ?
     WHERE device_id = ?`,
    [opts.lastSyncAt, opts.lastSyncModule, opts.bytesSent, opts.bytesReceived, deviceId],
  );
}

export function deactivatePairedDevice(db: DatabaseAdapter, deviceId: string): void {
  db.execute('UPDATE sync_paired_devices SET is_active = 0 WHERE device_id = ?', [deviceId]);
}

// ---------------------------------------------------------------------------
// Auto-Connect (Plan 29 Phase 0)
// ---------------------------------------------------------------------------

/** Per-peer auto-connect backoff ledger row. Timestamps are epoch ms. */
export interface AutoConnectState {
  peerDeviceId: string;
  failureCount: number;
  nextAttemptAt: number | null;
  lastAttemptAt: number | null;
  lastResult: string | null;
}

/**
 * The paired peers eligible for automatic dialing: active AND opted in
 * (auto_connect = 1, the per-peer AC-4 toggle). A peer toggled off is EXCLUDED
 * here, so it is never auto-dialed by the engine (not merely hidden in the UI).
 */
export function getAutoConnectPeers(db: DatabaseAdapter): PairedDevice[] {
  const rows = db.query<{
    device_id: string;
    display_name: string;
    dh_public_key: string;
    shared_secret_ref: string;
    last_seen_at: string | null;
    last_sync_at: string | null;
    last_sync_module: string | null;
    bytes_sent: number;
    bytes_received: number;
    is_active: number;
    paired_at: string;
  }>('SELECT * FROM sync_paired_devices WHERE auto_connect = 1 AND is_active = 1 ORDER BY paired_at DESC');
  return rows.map((r) => ({
    deviceId: r.device_id,
    displayName: r.display_name,
    dhPublicKey: r.dh_public_key,
    sharedSecretRef: r.shared_secret_ref,
    lastSeenAt: r.last_seen_at,
    lastSyncAt: r.last_sync_at,
    lastSyncModule: r.last_sync_module,
    bytesSent: r.bytes_sent,
    bytesReceived: r.bytes_received,
    isActive: r.is_active === 1,
    pairedAt: r.paired_at,
  }));
}

/** Whether a peer is opted into automatic dialing (default true when unknown). */
export function isPeerAutoConnectEnabled(db: DatabaseAdapter, deviceId: string): boolean {
  const rows = db.query<{ auto_connect: number }>(
    'SELECT auto_connect FROM sync_paired_devices WHERE device_id = ?',
    [deviceId],
  );
  // A missing row (unpaired) is not eligible; a paired row defaults to enabled.
  return rows.length > 0 && rows[0]!.auto_connect === 1;
}

/** Toggle the per-peer auto-connect flag (AC-4). Engine-enforced, not UI-only. */
export function setPeerAutoConnect(db: DatabaseAdapter, deviceId: string, enabled: boolean): void {
  db.execute('UPDATE sync_paired_devices SET auto_connect = ? WHERE device_id = ?', [enabled ? 1 : 0, deviceId]);
}

/** Read a peer's auto-connect backoff row, or null if it has never been attempted. */
export function readAutoConnectState(db: DatabaseAdapter, peerDeviceId: string): AutoConnectState | null {
  const rows = db.query<{
    peer_device_id: string;
    failure_count: number;
    next_attempt_at: number | null;
    last_attempt_at: number | null;
    last_result: string | null;
  }>('SELECT * FROM sync_auto_connect_state WHERE peer_device_id = ?', [peerDeviceId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    peerDeviceId: r.peer_device_id,
    failureCount: r.failure_count,
    nextAttemptAt: r.next_attempt_at,
    lastAttemptAt: r.last_attempt_at,
    lastResult: r.last_result,
  };
}

/** All auto-connect backoff rows (read model for the honest per-peer card). */
export function readAllAutoConnectState(db: DatabaseAdapter): AutoConnectState[] {
  const rows = db.query<{
    peer_device_id: string;
    failure_count: number;
    next_attempt_at: number | null;
    last_attempt_at: number | null;
    last_result: string | null;
  }>('SELECT * FROM sync_auto_connect_state');
  return rows.map((r) => ({
    peerDeviceId: r.peer_device_id,
    failureCount: r.failure_count,
    nextAttemptAt: r.next_attempt_at,
    lastAttemptAt: r.last_attempt_at,
    lastResult: r.last_result,
  }));
}

/** Upsert a peer's auto-connect backoff row after a real attempt. */
export function writeAutoConnectState(db: DatabaseAdapter, state: AutoConnectState): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_auto_connect_state
       (peer_device_id, failure_count, next_attempt_at, last_attempt_at, last_result)
     VALUES (?, ?, ?, ?, ?)`,
    [state.peerDeviceId, state.failureCount, state.nextAttemptAt, state.lastAttemptAt, state.lastResult],
  );
}

/**
 * Epoch ms of a peer's most recent COMPLETED session, or null if none. Read
 * from the real sync_sessions rows (never fabricated), used by the auto-connect
 * planner's min-interval skip. `completed_at` is stored ISO; a value that does
 * not parse resolves to null (treated as "no recent session").
 */
export function getLastCompletedSessionAt(db: DatabaseAdapter, peerDeviceId: string): number | null {
  const rows = db.query<{ completed_at: string }>(
    `SELECT completed_at FROM sync_sessions
      WHERE peer_device_id = ? AND status = 'completed'
      ORDER BY completed_at DESC LIMIT 1`,
    [peerDeviceId],
  );
  if (rows.length === 0) return null;
  const ms = Date.parse(rows[0]!.completed_at);
  return Number.isNaN(ms) ? null : ms;
}

// ---------------------------------------------------------------------------
// Change Log
// ---------------------------------------------------------------------------

export function insertChangeRecord(db: DatabaseAdapter, record: ChangeRecord): void {
  db.execute(
    `INSERT INTO sync_change_log (id, module_id, table_name, operation, row_id, data_json, device_id, timestamp, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.moduleId, record.tableName, record.operation,
      record.rowId, record.dataJson, record.deviceId, record.timestamp,
      record.synced ? 1 : 0, record.createdAt,
    ],
  );
}

export function getUnsyncedChanges(db: DatabaseAdapter, limit = 100): ChangeRecord[] {
  const rows = db.query<{
    id: string;
    module_id: string;
    table_name: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    row_id: string;
    data_json: string | null;
    device_id: string;
    timestamp: number;
    synced: number;
    created_at: string;
  }>('SELECT * FROM sync_change_log WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?', [limit]);
  return rows.map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    tableName: r.table_name,
    operation: r.operation,
    rowId: r.row_id,
    dataJson: r.data_json,
    deviceId: r.device_id,
    timestamp: r.timestamp,
    synced: r.synced === 1,
    createdAt: r.created_at,
  }));
}

export function getUnsyncedChangesByModule(db: DatabaseAdapter, moduleId: string, limit = 100): ChangeRecord[] {
  const rows = db.query<{
    id: string;
    module_id: string;
    table_name: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    row_id: string;
    data_json: string | null;
    device_id: string;
    timestamp: number;
    synced: number;
    created_at: string;
  }>('SELECT * FROM sync_change_log WHERE synced = 0 AND module_id = ? ORDER BY timestamp ASC LIMIT ?', [moduleId, limit]);
  return rows.map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    tableName: r.table_name,
    operation: r.operation,
    rowId: r.row_id,
    dataJson: r.data_json,
    deviceId: r.device_id,
    timestamp: r.timestamp,
    synced: r.synced === 1,
    createdAt: r.created_at,
  }));
}

export function markChangesSynced(db: DatabaseAdapter, ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  db.execute(`UPDATE sync_change_log SET synced = 1 WHERE id IN (${placeholders})`, ids);
}

export function pruneOldSyncedChanges(db: DatabaseAdapter, olderThanTimestamp: number): number {
  const before = db.query<{ c: number }>('SELECT COUNT(*) as c FROM sync_change_log WHERE synced = 1 AND timestamp < ?', [olderThanTimestamp]);
  const count = before[0]?.c ?? 0;
  db.execute('DELETE FROM sync_change_log WHERE synced = 1 AND timestamp < ?', [olderThanTimestamp]);
  return count;
}

// ---------------------------------------------------------------------------
// Peer Module State
// ---------------------------------------------------------------------------

export function getPeerModuleState(db: DatabaseAdapter, deviceId: string, moduleId: string): PeerModuleState | null {
  const rows = db.query<{
    device_id: string;
    module_id: string;
    last_synced_version: number;
    last_synced_at: string | null;
    automerge_heads: string | null;
  }>('SELECT * FROM sync_peer_module_state WHERE device_id = ? AND module_id = ?', [deviceId, moduleId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    deviceId: r.device_id,
    moduleId: r.module_id,
    lastSyncedVersion: r.last_synced_version,
    lastSyncedAt: r.last_synced_at,
    automergeHeads: r.automerge_heads,
  };
}

export function upsertPeerModuleState(db: DatabaseAdapter, state: PeerModuleState): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_peer_module_state (device_id, module_id, last_synced_version, last_synced_at, automerge_heads)
     VALUES (?, ?, ?, ?, ?)`,
    [state.deviceId, state.moduleId, state.lastSyncedVersion, state.lastSyncedAt, state.automergeHeads],
  );
}

// ---------------------------------------------------------------------------
// Device Revocations
// ---------------------------------------------------------------------------

export function insertRevocation(db: DatabaseAdapter, revocation: DeviceRevocation): void {
  db.execute(
    `INSERT INTO sync_device_revocations (device_id, revoked_by_device_id, reason, revoked_at)
     VALUES (?, ?, ?, ?)`,
    [revocation.deviceId, revocation.revokedByDeviceId, revocation.reason, revocation.revokedAt],
  );
}

export function isDeviceRevoked(db: DatabaseAdapter, deviceId: string): boolean {
  const rows = db.query<{ device_id: string }>('SELECT device_id FROM sync_device_revocations WHERE device_id = ?', [deviceId]);
  return rows.length > 0;
}

export function getRevocations(db: DatabaseAdapter): DeviceRevocation[] {
  const rows = db.query<{
    device_id: string;
    revoked_by_device_id: string;
    reason: string | null;
    revoked_at: string;
  }>('SELECT * FROM sync_device_revocations ORDER BY revoked_at DESC');
  return rows.map((r) => ({
    deviceId: r.device_id,
    revokedByDeviceId: r.revoked_by_device_id,
    reason: r.reason,
    revokedAt: r.revoked_at,
  }));
}

/**
 * Persist the FULL signed revocation (MK-019 gossip). The sync_device_revocations
 * row drops the signature; this keeps it so the record can be forwarded. Stored
 * as the JSON of a SignedRevocation, keyed by the revoked device id.
 */
export function storeRevocationRecord(db: DatabaseAdapter, signedJson: string, revokedDeviceId: string, now?: string): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_revocation_records (device_id, signed_json, received_at)
     VALUES (?, ?, ?)`,
    [revokedDeviceId, signedJson, now ?? new Date().toISOString()],
  );
}

/** Every signed revocation record this device holds (for gossip). */
export function getRevocationRecordJsons(db: DatabaseAdapter): string[] {
  return db
    .query<{ signed_json: string }>('SELECT signed_json FROM sync_revocation_records ORDER BY received_at ASC')
    .map((r) => r.signed_json);
}

/** Persist a full signed introduction so it can be forwarded (MK-018 gossip). */
export function storeIntroductionRecord(
  db: DatabaseAdapter,
  workspaceId: string,
  subjectDeviceId: string,
  signedJson: string,
  now?: string,
): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_introduction_records (workspace_id, subject_device_id, signed_json, received_at)
     VALUES (?, ?, ?, ?)`,
    [workspaceId, subjectDeviceId, signedJson, now ?? new Date().toISOString()],
  );
}

/** Every signed introduction record this device holds (for gossip). */
export function getIntroductionRecordJsons(db: DatabaseAdapter): string[] {
  return db
    .query<{ signed_json: string }>('SELECT signed_json FROM sync_introduction_records ORDER BY received_at ASC')
    .map((r) => r.signed_json);
}

// ---------------------------------------------------------------------------
// Blobs
// ---------------------------------------------------------------------------

export function insertBlob(db: DatabaseAdapter, blob: BlobRef): void {
  db.execute(
    `INSERT OR IGNORE INTO sync_blobs (hash, size, mime_type, module_id, ref_count, stored_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [blob.hash, blob.size, blob.mimeType, blob.moduleId, blob.refCount, blob.storedAt],
  );
}

export function getBlob(db: DatabaseAdapter, hash: string): BlobRef | null {
  const rows = db.query<{
    hash: string;
    size: number;
    mime_type: string;
    module_id: string;
    ref_count: number;
    stored_at: string;
  }>('SELECT * FROM sync_blobs WHERE hash = ?', [hash]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { hash: r.hash, size: r.size, mimeType: r.mime_type, moduleId: r.module_id, refCount: r.ref_count, storedAt: r.stored_at };
}

export function getBlobsByModule(db: DatabaseAdapter, moduleId: string): BlobRef[] {
  const rows = db.query<{
    hash: string;
    size: number;
    mime_type: string;
    module_id: string;
    ref_count: number;
    stored_at: string;
  }>('SELECT * FROM sync_blobs WHERE module_id = ?', [moduleId]);
  return rows.map((r) => ({
    hash: r.hash, size: r.size, mimeType: r.mime_type, moduleId: r.module_id, refCount: r.ref_count, storedAt: r.stored_at,
  }));
}

export function listBlobs(db: DatabaseAdapter): BlobRef[] {
  const rows = db.query<{
    hash: string;
    size: number;
    mime_type: string;
    module_id: string;
    ref_count: number;
    stored_at: string;
  }>('SELECT * FROM sync_blobs ORDER BY hash');
  return rows.map((row) => ({
    hash: row.hash,
    size: row.size,
    mimeType: row.mime_type,
    moduleId: row.module_id,
    refCount: row.ref_count,
    storedAt: row.stored_at,
  }));
}

export function incrementBlobRefCount(db: DatabaseAdapter, hash: string): void {
  db.execute('UPDATE sync_blobs SET ref_count = ref_count + 1 WHERE hash = ?', [hash]);
}

export function decrementBlobRefCount(db: DatabaseAdapter, hash: string): number {
  db.execute('UPDATE sync_blobs SET ref_count = ref_count - 1 WHERE hash = ?', [hash]);
  const rows = db.query<{ ref_count: number }>('SELECT ref_count FROM sync_blobs WHERE hash = ?', [hash]);
  return rows[0]?.ref_count ?? 0;
}

export function deleteBlob(db: DatabaseAdapter, hash: string): void {
  db.execute('DELETE FROM sync_blobs WHERE hash = ?', [hash]);
}

// ---------------------------------------------------------------------------
// Blob Policy
// ---------------------------------------------------------------------------

export function getBlobPolicy(db: DatabaseAdapter, moduleId: string): BlobPolicyEntry | null {
  const rows = db.query<{
    module_id: string;
    policy: BlobSyncPolicy;
    max_blob_size_bytes: number;
    updated_at: string;
  }>('SELECT * FROM sync_blob_policy WHERE module_id = ?', [moduleId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { moduleId: r.module_id, policy: r.policy, maxBlobSizeBytes: r.max_blob_size_bytes, updatedAt: r.updated_at };
}

export function upsertBlobPolicy(db: DatabaseAdapter, entry: BlobPolicyEntry): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_blob_policy (module_id, policy, max_blob_size_bytes, updated_at)
     VALUES (?, ?, ?, ?)`,
    [entry.moduleId, entry.policy, entry.maxBlobSizeBytes, entry.updatedAt],
  );
}

// ---------------------------------------------------------------------------
// Sync Sessions
// ---------------------------------------------------------------------------

export function insertSyncSession(db: DatabaseAdapter, session: SyncSession): void {
  db.execute(
    `INSERT INTO sync_sessions (id, workspace_id, peer_device_id, transport, direction, modules_synced, changes_sent, changes_received, bytes_sent, bytes_received, blobs_sent, blobs_received, duration_ms, status, error, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id, session.workspaceId ?? null, session.peerDeviceId, session.transport, session.direction,
      JSON.stringify(session.modulesSynced), session.changesSent, session.changesReceived,
      session.bytesSent, session.bytesReceived, session.blobsSent, session.blobsReceived,
      session.durationMs, session.status, session.error, session.startedAt, session.completedAt,
    ],
  );
}

/** Local-only per-rung attempt/success counts, aggregated from real sessions (MK-029). */
export interface SyncRungStats {
  transport: SyncTransport;
  attempts: number;
  successes: number;
  lastAttemptAt: string | null;
}

export function getTransportRungStats(db: DatabaseAdapter): SyncRungStats[] {
  const rows = db.query<{
    transport: SyncTransport;
    attempts: number;
    successes: number;
    last_attempt_at: string | null;
  }>(
    `SELECT transport,
            COUNT(*) AS attempts,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successes,
            MAX(completed_at) AS last_attempt_at
       FROM sync_sessions
      GROUP BY transport
      ORDER BY attempts DESC`,
  );
  return rows.map((r) => ({
    transport: r.transport,
    attempts: r.attempts,
    successes: r.successes ?? 0,
    lastAttemptAt: r.last_attempt_at,
  }));
}

export function getRecentSyncSessions(db: DatabaseAdapter, limit = 50): SyncSession[] {
  const rows = db.query<{
    id: string;
    peer_device_id: string;
    workspace_id: string | null;
    transport: SyncTransport;
    direction: 'push' | 'pull' | 'bidirectional';
    modules_synced: string;
    changes_sent: number;
    changes_received: number;
    bytes_sent: number;
    bytes_received: number;
    blobs_sent: number;
    blobs_received: number;
    duration_ms: number;
    status: 'completed' | 'partial' | 'failed';
    error: string | null;
    started_at: string;
    completed_at: string;
  }>('SELECT * FROM sync_sessions ORDER BY completed_at DESC LIMIT ?', [limit]);
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    peerDeviceId: r.peer_device_id,
    transport: r.transport,
    direction: r.direction,
    modulesSynced: JSON.parse(r.modules_synced) as string[],
    changesSent: r.changes_sent,
    changesReceived: r.changes_received,
    bytesSent: r.bytes_sent,
    bytesReceived: r.bytes_received,
    blobsSent: r.blobs_sent,
    blobsReceived: r.blobs_received,
    durationMs: r.duration_ms,
    status: r.status,
    error: r.error,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));
}

// ---------------------------------------------------------------------------
// Seeding Policy
// ---------------------------------------------------------------------------

export function getSeedingPolicy(db: DatabaseAdapter): SeedingPolicy | null {
  const rows = db.query<{
    enabled: number;
    max_upload_kbps: number;
    max_seed_storage_mb: number;
    auto_delete_days: number;
    seed_on_cellular: number;
    seed_while_charging: number;
    updated_at: string;
  }>('SELECT * FROM torrent_seeding_policy WHERE id = ?', ['config']);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    enabled: r.enabled === 1,
    maxUploadKbps: r.max_upload_kbps,
    maxSeedStorageMB: r.max_seed_storage_mb,
    autoDeleteDays: r.auto_delete_days,
    seedOnCellular: r.seed_on_cellular === 1,
    seedWhileCharging: r.seed_while_charging === 1,
    updatedAt: r.updated_at,
  };
}

export function upsertSeedingPolicy(db: DatabaseAdapter, policy: SeedingPolicy): void {
  db.execute(
    `INSERT OR REPLACE INTO torrent_seeding_policy (id, enabled, max_upload_kbps, max_seed_storage_mb, auto_delete_days, seed_on_cellular, seed_while_charging, updated_at)
     VALUES ('config', ?, ?, ?, ?, ?, ?, ?)`,
    [
      policy.enabled ? 1 : 0, policy.maxUploadKbps, policy.maxSeedStorageMB,
      policy.autoDeleteDays, policy.seedOnCellular ? 1 : 0, policy.seedWhileCharging ? 1 : 0,
      policy.updatedAt,
    ],
  );
}

// ---------------------------------------------------------------------------
// Torrent Published
// ---------------------------------------------------------------------------

export function insertPublishedContent(db: DatabaseAdapter, manifest: ContentManifest, contentKey?: string): void {
  db.execute(
    `INSERT INTO torrent_published (info_hash, title, description, category, tags_json, access, price_cents, currency, total_size, piece_length, pieces_json, merkle_root, files_json, manifest_json, content_key, trackers_json, web_seeds_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      manifest.infoHash, manifest.title, manifest.description, manifest.category,
      JSON.stringify(manifest.tags), manifest.access,
      manifest.price ? Math.round(manifest.price.amount * 100) : null,
      manifest.price?.currency ?? 'USD',
      manifest.totalSize, manifest.pieceLength, JSON.stringify(manifest.pieces),
      manifest.merkleRoot, JSON.stringify(manifest.files), JSON.stringify(manifest),
      contentKey ?? null, JSON.stringify(manifest.trackers), JSON.stringify(manifest.webSeeds),
    ],
  );
}

// ---------------------------------------------------------------------------
// Torrent Downloads
// ---------------------------------------------------------------------------

export function insertDownload(
  db: DatabaseAdapter,
  manifest: ContentManifest,
  storagePath: string,
  contentKey?: string,
  accessToken?: string,
): void {
  db.execute(
    `INSERT INTO torrent_downloads (info_hash, title, description, category, creator_public_key, creator_display_name, total_size, piece_count, manifest_json, content_key, access_token, storage_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      manifest.infoHash, manifest.title, manifest.description, manifest.category,
      manifest.creator.publicKey, manifest.creator.displayName,
      manifest.totalSize, manifest.pieces.length, JSON.stringify(manifest),
      contentKey ?? null, accessToken ?? null, storagePath,
    ],
  );
}

export function updateDownloadProgress(db: DatabaseAdapter, infoHash: string, downloadedSize: number, piecesCompleted: number): void {
  db.execute(
    `UPDATE torrent_downloads SET downloaded_size = ?, pieces_completed = ? WHERE info_hash = ?`,
    [downloadedSize, piecesCompleted, infoHash],
  );
}

export function completeDownload(db: DatabaseAdapter, infoHash: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE torrent_downloads SET status = 'completed', completed_at = ?, downloaded_at = ? WHERE info_hash = ?`,
    [now, now, infoHash],
  );
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export function createWorkspace(db: DatabaseAdapter, workspace: SyncWorkspace): void {
  db.execute(
    `INSERT INTO sync_workspaces (id, display_name, workspace_type, created_by_device_id, created_at, rotated_at, current_key_version, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [workspace.id, workspace.displayName, workspace.workspaceType, workspace.createdByDeviceId, workspace.createdAt, workspace.rotatedAt, workspace.currentKeyVersion, workspace.archivedAt],
  );
}

export function getWorkspaces(db: DatabaseAdapter): SyncWorkspace[] {
  const rows = db.query<{
    id: string; display_name: string; workspace_type: WorkspaceType;
    created_by_device_id: string; created_at: string; rotated_at: string | null;
    current_key_version: number; archived_at: string | null;
  }>('SELECT * FROM sync_workspaces WHERE archived_at IS NULL ORDER BY created_at ASC');
  return rows.map((r) => ({
    id: r.id, displayName: r.display_name, workspaceType: r.workspace_type,
    createdByDeviceId: r.created_by_device_id, createdAt: r.created_at,
    rotatedAt: r.rotated_at, currentKeyVersion: r.current_key_version, archivedAt: r.archived_at,
  }));
}

export function getWorkspace(db: DatabaseAdapter, id: string): SyncWorkspace | null {
  const rows = db.query<{
    id: string; display_name: string; workspace_type: WorkspaceType;
    created_by_device_id: string; created_at: string; rotated_at: string | null;
    current_key_version: number; archived_at: string | null;
  }>('SELECT * FROM sync_workspaces WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    id: r.id, displayName: r.display_name, workspaceType: r.workspace_type,
    createdByDeviceId: r.created_by_device_id, createdAt: r.created_at,
    rotatedAt: r.rotated_at, currentKeyVersion: r.current_key_version, archivedAt: r.archived_at,
  };
}

export function archiveWorkspace(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE sync_workspaces SET archived_at = datetime(\'now\') WHERE id = ?', [id]);
}

export function getWorkspacesByDevice(db: DatabaseAdapter, deviceId: string): SyncWorkspace[] {
  const rows = db.query<{
    id: string; display_name: string; workspace_type: WorkspaceType;
    created_by_device_id: string; created_at: string; rotated_at: string | null;
    current_key_version: number; archived_at: string | null;
  }>(`SELECT w.* FROM sync_workspaces w
      JOIN sync_workspace_members m ON w.id = m.workspace_id
      WHERE m.device_id = ? AND m.removed_at IS NULL AND w.archived_at IS NULL
      ORDER BY w.created_at ASC`, [deviceId]);
  return rows.map((r) => ({
    id: r.id, displayName: r.display_name, workspaceType: r.workspace_type,
    createdByDeviceId: r.created_by_device_id, createdAt: r.created_at,
    rotatedAt: r.rotated_at, currentKeyVersion: r.current_key_version, archivedAt: r.archived_at,
  }));
}

// ---------------------------------------------------------------------------
// Workspace Members
// ---------------------------------------------------------------------------

export function addWorkspaceMember(db: DatabaseAdapter, member: SyncWorkspaceMember): void {
  db.execute(
    `INSERT INTO sync_workspace_members (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [member.workspaceId, member.deviceId, member.role, member.invitedByDeviceId, member.invitedAt, member.removedAt],
  );
}

export function removeWorkspaceMember(db: DatabaseAdapter, workspaceId: string, deviceId: string): void {
  db.execute(
    'UPDATE sync_workspace_members SET removed_at = datetime(\'now\') WHERE workspace_id = ? AND device_id = ?',
    [workspaceId, deviceId],
  );
}

export function updateMemberRole(db: DatabaseAdapter, workspaceId: string, deviceId: string, role: WorkspaceMemberRole): void {
  db.execute(
    'UPDATE sync_workspace_members SET role = ? WHERE workspace_id = ? AND device_id = ?',
    [role, workspaceId, deviceId],
  );
}

export function getWorkspaceMembers(db: DatabaseAdapter, workspaceId: string): SyncWorkspaceMember[] {
  const rows = db.query<{
    workspace_id: string; device_id: string; role: WorkspaceMemberRole;
    invited_by_device_id: string; invited_at: string; removed_at: string | null;
  }>('SELECT * FROM sync_workspace_members WHERE workspace_id = ? AND removed_at IS NULL', [workspaceId]);
  return rows.map((r) => ({
    workspaceId: r.workspace_id, deviceId: r.device_id, role: r.role,
    invitedByDeviceId: r.invited_by_device_id, invitedAt: r.invited_at, removedAt: r.removed_at,
  }));
}

// ---------------------------------------------------------------------------
// Workspace Keys
// ---------------------------------------------------------------------------

export function insertKeyWrap(db: DatabaseAdapter, wrap: SyncWorkspaceKeyWrap): void {
  // OR IGNORE: a wrap is immutable per (workspace, key_version, device), so a
  // re-delivery during replication is a no-op rather than a primary-key error.
  // Fresh commits always carry new keys, so first-wrap-wins changes nothing there.
  db.execute(
    `INSERT OR IGNORE INTO sync_workspace_keys (workspace_id, key_version, wrapped_for_device_id, wrapped_key_blob, valid_from, valid_until)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [wrap.workspaceId, wrap.keyVersion, wrap.wrappedForDeviceId, wrap.wrappedKeyBlob, wrap.validFrom, wrap.validUntil],
  );
}

/**
 * Replace a wrap row in place (INSERT OR REPLACE). Used when a verified,
 * openable wrap addressed to this device must supersede a prior unopenable row
 * in the same (workspace, key_version, device) slot (poison defense).
 */
export function replaceKeyWrap(db: DatabaseAdapter, wrap: SyncWorkspaceKeyWrap): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_workspace_keys (workspace_id, key_version, wrapped_for_device_id, wrapped_key_blob, valid_from, valid_until)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [wrap.workspaceId, wrap.keyVersion, wrap.wrappedForDeviceId, wrap.wrappedKeyBlob, wrap.validFrom, wrap.validUntil],
  );
}

export function getKeyWraps(db: DatabaseAdapter, workspaceId: string, keyVersion: number): SyncWorkspaceKeyWrap[] {
  const rows = db.query<{
    workspace_id: string; key_version: number; wrapped_for_device_id: string;
    wrapped_key_blob: Uint8Array; valid_from: string; valid_until: string | null;
  }>('SELECT * FROM sync_workspace_keys WHERE workspace_id = ? AND key_version = ?', [workspaceId, keyVersion]);
  return rows.map((r) => ({
    workspaceId: r.workspace_id, keyVersion: r.key_version, wrappedForDeviceId: r.wrapped_for_device_id,
    wrappedKeyBlob: r.wrapped_key_blob, validFrom: r.valid_from, validUntil: r.valid_until,
  }));
}

export function invalidateKeyVersion(db: DatabaseAdapter, workspaceId: string, keyVersion: number): void {
  db.execute(
    'UPDATE sync_workspace_keys SET valid_until = datetime(\'now\') WHERE workspace_id = ? AND key_version = ?',
    [workspaceId, keyVersion],
  );
}

// ---------------------------------------------------------------------------
// Entity ACL
// ---------------------------------------------------------------------------

export function upsertEntityAcl(db: DatabaseAdapter, acl: SyncEntityAcl): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_entity_acl (module_id, table_name, row_id, workspace_id, scope, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [acl.moduleId, acl.tableName, acl.rowId, acl.workspaceId, acl.scope, acl.updatedAt],
  );
}

export function getEntityAcl(db: DatabaseAdapter, moduleId: string, tableName: string, rowId: string): SyncEntityAcl | null {
  const rows = db.query<{
    module_id: string; table_name: string; row_id: string;
    workspace_id: string; scope: SyncScope; updated_at: string;
  }>('SELECT * FROM sync_entity_acl WHERE module_id = ? AND table_name = ? AND row_id = ?', [moduleId, tableName, rowId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { moduleId: r.module_id, tableName: r.table_name, rowId: r.row_id, workspaceId: r.workspace_id, scope: r.scope, updatedAt: r.updated_at };
}

// ---------------------------------------------------------------------------
// Tombstones
// ---------------------------------------------------------------------------

export function insertTombstone(db: DatabaseAdapter, tombstone: SyncTombstone): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_tombstones (module_id, table_name, row_id, deleted_by_device_id, deleted_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tombstone.moduleId, tombstone.tableName, tombstone.rowId, tombstone.deletedByDeviceId, tombstone.deletedAt],
  );
}

export function isTombstoned(db: DatabaseAdapter, moduleId: string, tableName: string, rowId: string): boolean {
  const rows = db.query<{ module_id: string }>('SELECT module_id FROM sync_tombstones WHERE module_id = ? AND table_name = ? AND row_id = ?', [moduleId, tableName, rowId]);
  return rows.length > 0;
}

export function getTombstone(db: DatabaseAdapter, moduleId: string, tableName: string, rowId: string): SyncTombstone | null {
  const rows = db.query<{
    module_id: string; table_name: string; row_id: string;
    deleted_by_device_id: string; deleted_at: string;
  }>('SELECT * FROM sync_tombstones WHERE module_id = ? AND table_name = ? AND row_id = ?', [moduleId, tableName, rowId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { moduleId: r.module_id, tableName: r.table_name, rowId: r.row_id, deletedByDeviceId: r.deleted_by_device_id, deletedAt: r.deleted_at };
}

export function deleteTombstone(db: DatabaseAdapter, moduleId: string, tableName: string, rowId: string): void {
  db.execute('DELETE FROM sync_tombstones WHERE module_id = ? AND table_name = ? AND row_id = ?', [moduleId, tableName, rowId]);
}

// ---------------------------------------------------------------------------
// Sync Receipts
// ---------------------------------------------------------------------------

export function insertReceipt(db: DatabaseAdapter, receipt: SyncReceipt): void {
  db.execute(
    `INSERT OR IGNORE INTO sync_receipts (session_id, peer_device_id, module_id, change_id, acknowledged_at)
     VALUES (?, ?, ?, ?, ?)`,
    [receipt.sessionId, receipt.peerDeviceId, receipt.moduleId, receipt.changeId, receipt.acknowledgedAt],
  );
}

/** Distinct peers that have acknowledged a change, across all sessions (MK-009). */
export function getReceiptPeersForChange(db: DatabaseAdapter, changeId: string): string[] {
  const rows = db.query<{ peer_device_id: string }>(
    'SELECT DISTINCT peer_device_id FROM sync_receipts WHERE change_id = ?',
    [changeId],
  );
  return rows.map((r) => r.peer_device_id);
}

// ---------------------------------------------------------------------------
// Inbound Audit (MK-002)
// ---------------------------------------------------------------------------

export function insertInboundAudit(db: DatabaseAdapter, audit: SyncInboundAudit): void {
  db.execute(
    `INSERT INTO sync_inbound_audit (id, session_id, peer_device_id, module_id, table_name, row_id, operation, outcome, reason, scope, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [audit.id, audit.sessionId, audit.peerDeviceId, audit.moduleId, audit.tableName, audit.rowId, audit.operation, audit.outcome, audit.reason, audit.scope, audit.createdAt],
  );
}

export function getInboundAudit(
  db: DatabaseAdapter,
  filter?: { peerDeviceId?: string; outcome?: InboundAuditOutcome },
): SyncInboundAudit[] {
  let sql = 'SELECT * FROM sync_inbound_audit';
  const params: unknown[] = [];
  const where: string[] = [];
  if (filter?.peerDeviceId) { where.push('peer_device_id = ?'); params.push(filter.peerDeviceId); }
  if (filter?.outcome) { where.push('outcome = ?'); params.push(filter.outcome); }
  if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
  const rows = db.query<{
    id: string; session_id: string | null; peer_device_id: string;
    module_id: string | null; table_name: string | null; row_id: string | null;
    operation: string | null; outcome: InboundAuditOutcome; reason: string | null;
    scope: SyncScope | null; created_at: string;
  }>(sql, params);
  return rows.map((r) => ({
    id: r.id, sessionId: r.session_id, peerDeviceId: r.peer_device_id,
    moduleId: r.module_id, tableName: r.table_name, rowId: r.row_id,
    operation: r.operation, outcome: r.outcome, reason: r.reason,
    scope: r.scope, createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Pinned Identities (TOFU, MK-015)
// ---------------------------------------------------------------------------

function mapPinnedIdentity(r: {
  device_id: string; dh_public_key: string; display_name: string;
  bundle_json: string; bundle_signature: string; first_seen_at: string;
  last_seen_at: string; key_change_count: number;
}): SyncPinnedIdentity {
  return {
    deviceId: r.device_id, dhPublicKey: r.dh_public_key, displayName: r.display_name,
    bundleJson: r.bundle_json, bundleSignature: r.bundle_signature,
    firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at, keyChangeCount: r.key_change_count,
  };
}

export function getPinnedIdentity(db: DatabaseAdapter, deviceId: string): SyncPinnedIdentity | null {
  const rows = db.query<Parameters<typeof mapPinnedIdentity>[0]>(
    'SELECT * FROM sync_pinned_identities WHERE device_id = ?',
    [deviceId],
  );
  return rows[0] ? mapPinnedIdentity(rows[0]) : null;
}

/** First-use pin: insert a new device identity. No-op if already pinned. */
export function pinIdentity(
  db: DatabaseAdapter,
  fields: { deviceId: string; dhPublicKey: string; displayName: string; bundleJson: string; bundleSignature: string; now?: string },
): void {
  const now = fields.now ?? new Date().toISOString();
  db.execute(
    `INSERT OR IGNORE INTO sync_pinned_identities
       (device_id, dh_public_key, display_name, bundle_json, bundle_signature, first_seen_at, last_seen_at, key_change_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [fields.deviceId, fields.dhPublicKey, fields.displayName, fields.bundleJson, fields.bundleSignature, now, now],
  );
}

/** Touch last_seen for a matching pin. */
export function touchPinnedIdentity(db: DatabaseAdapter, deviceId: string, now: string = new Date().toISOString()): void {
  db.execute('UPDATE sync_pinned_identities SET last_seen_at = ? WHERE device_id = ?', [now, deviceId]);
}

/**
 * Accept a key change: overwrite the pinned DH key + bundle and bump the change
 * counter. Only call after the user has explicitly approved the new key.
 */
export function acceptKeyChange(
  db: DatabaseAdapter,
  fields: { deviceId: string; dhPublicKey: string; displayName: string; bundleJson: string; bundleSignature: string; now?: string },
): void {
  const now = fields.now ?? new Date().toISOString();
  db.execute(
    `UPDATE sync_pinned_identities
       SET dh_public_key = ?, display_name = ?, bundle_json = ?, bundle_signature = ?,
           last_seen_at = ?, key_change_count = key_change_count + 1
     WHERE device_id = ?`,
    [fields.dhPublicKey, fields.displayName, fields.bundleJson, fields.bundleSignature, now, fields.deviceId],
  );
}

// ---------------------------------------------------------------------------
// SAS Verifications (MK-017)
// ---------------------------------------------------------------------------

/** Look up a recorded SAS verification for a peer at a trust boundary. */
export function getSasVerification(
  db: DatabaseAdapter,
  peerDeviceId: string,
  workspaceId = '',
): SyncSasVerification | null {
  const rows = db.query<{ peer_device_id: string; workspace_id: string; sas_indices: string; verified_at: string }>(
    'SELECT * FROM sync_sas_verifications WHERE peer_device_id = ? AND workspace_id = ?',
    [peerDeviceId, workspaceId],
  );
  const r = rows[0];
  return r
    ? { peerDeviceId: r.peer_device_id, workspaceId: r.workspace_id, sasIndices: r.sas_indices, verifiedAt: r.verified_at }
    : null;
}

/** True if the peer has been SAS-verified at this trust boundary. */
export function isSasVerified(db: DatabaseAdapter, peerDeviceId: string, workspaceId = ''): boolean {
  return getSasVerification(db, peerDeviceId, workspaceId) !== null;
}

/** Record (or refresh) a SAS verification after the user confirms the emoji match. */
export function recordSasVerification(
  db: DatabaseAdapter,
  fields: { peerDeviceId: string; workspaceId?: string; sasIndices: string; now?: string },
): void {
  db.execute(
    `INSERT INTO sync_sas_verifications (peer_device_id, workspace_id, sas_indices, verified_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(peer_device_id, workspace_id)
     DO UPDATE SET sas_indices = excluded.sas_indices, verified_at = excluded.verified_at`,
    [fields.peerDeviceId, fields.workspaceId ?? '', fields.sasIndices, fields.now ?? new Date().toISOString()],
  );
}

/** Drop a SAS verification (e.g. after a key change invalidates the prior match). */
export function clearSasVerification(db: DatabaseAdapter, peerDeviceId: string, workspaceId = ''): void {
  db.execute(
    'DELETE FROM sync_sas_verifications WHERE peer_device_id = ? AND workspace_id = ?',
    [peerDeviceId, workspaceId],
  );
}

// ---------------------------------------------------------------------------
// Conflict Queue
// ---------------------------------------------------------------------------

export function insertConflict(db: DatabaseAdapter, conflict: SyncConflictEntry): void {
  db.execute(
    `INSERT INTO sync_conflict_queue (id, workspace_id, module_id, table_name, row_id, local_version_json, remote_version_json, remote_device_id, created_at, resolved_at, resolution)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [conflict.id, conflict.workspaceId, conflict.moduleId, conflict.tableName, conflict.rowId, conflict.localVersionJson, conflict.remoteVersionJson, conflict.remoteDeviceId, conflict.createdAt, conflict.resolvedAt, conflict.resolution],
  );
}

export function getUnresolvedConflicts(db: DatabaseAdapter, workspaceId?: string): SyncConflictEntry[] {
  const sql = workspaceId
    ? 'SELECT * FROM sync_conflict_queue WHERE resolved_at IS NULL AND workspace_id = ? ORDER BY created_at ASC'
    : 'SELECT * FROM sync_conflict_queue WHERE resolved_at IS NULL ORDER BY created_at ASC';
  const params = workspaceId ? [workspaceId] : [];
  const rows = db.query<{
    id: string; workspace_id: string; module_id: string; table_name: string; row_id: string;
    local_version_json: string; remote_version_json: string; remote_device_id: string;
    created_at: string; resolved_at: string | null; resolution: 'local' | 'remote' | 'merged' | null;
  }>(sql, params);
  return rows.map((r) => ({
    id: r.id, workspaceId: r.workspace_id, moduleId: r.module_id, tableName: r.table_name,
    rowId: r.row_id, localVersionJson: r.local_version_json, remoteVersionJson: r.remote_version_json,
    remoteDeviceId: r.remote_device_id, createdAt: r.created_at, resolvedAt: r.resolved_at, resolution: r.resolution,
  }));
}

export function resolveConflict(db: DatabaseAdapter, conflictId: string, resolution: 'local' | 'remote' | 'merged'): void {
  db.execute(
    'UPDATE sync_conflict_queue SET resolved_at = datetime(\'now\'), resolution = ? WHERE id = ?',
    [resolution, conflictId],
  );
}

// ---------------------------------------------------------------------------
// Transport Preferences
// ---------------------------------------------------------------------------

export function getTransportPreferences(db: DatabaseAdapter, deviceId: string): SyncTransportPreference[] {
  const rows = db.query<{
    device_id: string; layer_id: number; rank: number; enabled: number; updated_at: string;
  }>('SELECT * FROM sync_transport_preferences WHERE device_id = ? ORDER BY rank ASC', [deviceId]);
  return rows.map((r) => ({
    deviceId: r.device_id, layerId: r.layer_id, rank: r.rank, enabled: r.enabled === 1, updatedAt: r.updated_at,
  }));
}

export function upsertTransportPreference(db: DatabaseAdapter, pref: SyncTransportPreference): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_transport_preferences (device_id, layer_id, rank, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [pref.deviceId, pref.layerId, pref.rank, pref.enabled ? 1 : 0, pref.updatedAt],
  );
}

export function setTransportPreferences(db: DatabaseAdapter, deviceId: string, prefs: SyncTransportPreference[]): void {
  db.execute('DELETE FROM sync_transport_preferences WHERE device_id = ?', [deviceId]);
  for (const pref of prefs) {
    upsertTransportPreference(db, pref);
  }
}

// ---------------------------------------------------------------------------
// Security Preferences
// ---------------------------------------------------------------------------

function mapSecurityPreferenceRow(r: {
  subject_type: SyncSecuritySubjectType;
  subject_id: string;
  encryption_mode: SyncSecurityPreference['encryptionMode'];
  disappearing_messages_enabled: number;
  disappear_after_seconds: number | null;
  updated_at: string;
}): SyncSecurityPreference {
  return {
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    encryptionMode: r.encryption_mode,
    disappearingMessagesEnabled: r.disappearing_messages_enabled === 1,
    disappearAfterSeconds: r.disappear_after_seconds,
    updatedAt: r.updated_at,
  };
}

export function getSecurityPreference(
  db: DatabaseAdapter,
  subjectType: SyncSecuritySubjectType,
  subjectId: string,
): SyncSecurityPreference | null {
  const rows = db.query<{
    subject_type: SyncSecuritySubjectType;
    subject_id: string;
    encryption_mode: SyncSecurityPreference['encryptionMode'];
    disappearing_messages_enabled: number;
    disappear_after_seconds: number | null;
    updated_at: string;
  }>(
    `SELECT * FROM sync_security_preferences
     WHERE subject_type = ? AND subject_id = ?`,
    [subjectType, subjectId],
  );
  return rows.length > 0 ? mapSecurityPreferenceRow(rows[0]!) : null;
}

export function getSecurityPreferenceWithDefault(
  db: DatabaseAdapter,
  subjectType: SyncSecuritySubjectType,
  subjectId: string,
): SyncSecurityPreference | null {
  return getSecurityPreference(db, subjectType, subjectId)
    ?? getSecurityPreference(db, 'default', 'default');
}

export function getSecurityPreferences(
  db: DatabaseAdapter,
  subjectType?: SyncSecuritySubjectType,
): SyncSecurityPreference[] {
  const rows = subjectType
    ? db.query<{
      subject_type: SyncSecuritySubjectType;
      subject_id: string;
      encryption_mode: SyncSecurityPreference['encryptionMode'];
      disappearing_messages_enabled: number;
      disappear_after_seconds: number | null;
      updated_at: string;
    }>(
      `SELECT * FROM sync_security_preferences
       WHERE subject_type = ? ORDER BY updated_at DESC`,
      [subjectType],
    )
    : db.query<{
      subject_type: SyncSecuritySubjectType;
      subject_id: string;
      encryption_mode: SyncSecurityPreference['encryptionMode'];
      disappearing_messages_enabled: number;
      disappear_after_seconds: number | null;
      updated_at: string;
    }>('SELECT * FROM sync_security_preferences ORDER BY updated_at DESC');

  return rows.map(mapSecurityPreferenceRow);
}

export function upsertSecurityPreference(db: DatabaseAdapter, pref: SyncSecurityPreference): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_security_preferences
       (subject_type, subject_id, encryption_mode, disappearing_messages_enabled, disappear_after_seconds, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      pref.subjectType,
      pref.subjectId,
      pref.encryptionMode,
      pref.disappearingMessagesEnabled ? 1 : 0,
      pref.disappearAfterSeconds,
      pref.updatedAt,
    ],
  );
}

export function recordSecurityConfirmation(db: DatabaseAdapter, confirmation: SyncSecurityConfirmation): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_security_confirmations
       (subject_type, subject_id, peer_device_id, local_encryption_mode, remote_encryption_mode,
        encryption_confirmed, disappearing_messages_confirmed, disappear_after_seconds, confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      confirmation.subjectType,
      confirmation.subjectId,
      confirmation.peerDeviceId,
      confirmation.localEncryptionMode,
      confirmation.remoteEncryptionMode,
      confirmation.encryptionConfirmed ? 1 : 0,
      confirmation.disappearingMessagesConfirmed ? 1 : 0,
      confirmation.disappearAfterSeconds,
      confirmation.confirmedAt,
    ],
  );
}

export function getSecurityConfirmation(
  db: DatabaseAdapter,
  subjectType: SyncSecuritySubjectType,
  subjectId: string,
  peerDeviceId: string,
): SyncSecurityConfirmation | null {
  const rows = db.query<{
    subject_type: SyncSecuritySubjectType;
    subject_id: string;
    peer_device_id: string;
    local_encryption_mode: SyncSecurityPreference['encryptionMode'];
    remote_encryption_mode: SyncSecurityPreference['encryptionMode'];
    encryption_confirmed: number;
    disappearing_messages_confirmed: number;
    disappear_after_seconds: number | null;
    confirmed_at: string;
  }>(
    `SELECT * FROM sync_security_confirmations
     WHERE subject_type = ? AND subject_id = ? AND peer_device_id = ?`,
    [subjectType, subjectId, peerDeviceId],
  );
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    peerDeviceId: r.peer_device_id,
    localEncryptionMode: r.local_encryption_mode,
    remoteEncryptionMode: r.remote_encryption_mode,
    encryptionConfirmed: r.encryption_confirmed === 1,
    disappearingMessagesConfirmed: r.disappearing_messages_confirmed === 1,
    disappearAfterSeconds: r.disappear_after_seconds,
    confirmedAt: r.confirmed_at,
  };
}

// ---------------------------------------------------------------------------
// Expiring Entities
// ---------------------------------------------------------------------------

export function upsertExpiringEntity(db: DatabaseAdapter, entity: SyncExpiringEntity): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_expiring_entities
       (module_id, table_name, row_id, expires_at, delete_after_sync, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entity.moduleId,
      entity.tableName,
      entity.rowId,
      entity.expiresAt,
      entity.deleteAfterSync ? 1 : 0,
      entity.createdAt,
    ],
  );
}

export function getExpiredEntities(db: DatabaseAdapter, nowIso: string): SyncExpiringEntity[] {
  const rows = db.query<{
    module_id: string;
    table_name: string;
    row_id: string;
    expires_at: string;
    delete_after_sync: number;
    created_at: string;
  }>(
    `SELECT * FROM sync_expiring_entities
     WHERE expires_at <= ?
     ORDER BY expires_at ASC`,
    [nowIso],
  );
  return rows.map((r) => ({
    moduleId: r.module_id,
    tableName: r.table_name,
    rowId: r.row_id,
    expiresAt: r.expires_at,
    deleteAfterSync: r.delete_after_sync === 1,
    createdAt: r.created_at,
  }));
}

export function deleteExpiringEntity(
  db: DatabaseAdapter,
  moduleId: string,
  tableName: string,
  rowId: string,
): void {
  db.execute(
    `DELETE FROM sync_expiring_entities
     WHERE module_id = ? AND table_name = ? AND row_id = ?`,
    [moduleId, tableName, rowId],
  );
}

// ---------------------------------------------------------------------------
// Session Module Stats
// ---------------------------------------------------------------------------

export function insertModuleStats(db: DatabaseAdapter, stats: SyncSessionModuleStats): void {
  db.execute(
    `INSERT INTO sync_session_module_stats (session_id, module_id, changes_sent, changes_received, bytes_sent, bytes_received)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [stats.sessionId, stats.moduleId, stats.changesSent, stats.changesReceived, stats.bytesSent, stats.bytesReceived],
  );
}

export function getModuleStatsBySession(db: DatabaseAdapter, sessionId: string): SyncSessionModuleStats[] {
  const rows = db.query<{
    session_id: string; module_id: string; changes_sent: number; changes_received: number;
    bytes_sent: number; bytes_received: number;
  }>('SELECT * FROM sync_session_module_stats WHERE session_id = ?', [sessionId]);
  return rows.map((r) => ({
    sessionId: r.session_id, moduleId: r.module_id, changesSent: r.changes_sent,
    changesReceived: r.changes_received, bytesSent: r.bytes_sent, bytesReceived: r.bytes_received,
  }));
}

export function getAggregateModuleStats(db: DatabaseAdapter, moduleId: string): { totalBytesSent: number; totalBytesReceived: number } {
  const rows = db.query<{ total_sent: number; total_received: number }>(
    'SELECT COALESCE(SUM(bytes_sent), 0) as total_sent, COALESCE(SUM(bytes_received), 0) as total_received FROM sync_session_module_stats WHERE module_id = ?',
    [moduleId],
  );
  const r = rows[0]!;
  return { totalBytesSent: r.total_sent, totalBytesReceived: r.total_received };
}

// ---------------------------------------------------------------------------
// Relay Tokens
// ---------------------------------------------------------------------------

export function mintRelayToken(db: DatabaseAdapter, token: SyncRelayToken): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_relay_tokens (workspace_id, peer_device_id, ephemeral_token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [token.workspaceId, token.peerDeviceId, token.ephemeralToken, token.createdAt, token.expiresAt],
  );
}

export function getRelayToken(db: DatabaseAdapter, workspaceId: string, peerDeviceId: string): SyncRelayToken | null {
  const rows = db.query<{
    workspace_id: string; peer_device_id: string; ephemeral_token: string;
    created_at: string; expires_at: string;
  }>('SELECT * FROM sync_relay_tokens WHERE workspace_id = ? AND peer_device_id = ? AND expires_at > datetime(\'now\')', [workspaceId, peerDeviceId]);
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { workspaceId: r.workspace_id, peerDeviceId: r.peer_device_id, ephemeralToken: r.ephemeral_token, createdAt: r.created_at, expiresAt: r.expires_at };
}

export function expireRelayTokens(db: DatabaseAdapter): number {
  const before = db.query<{ c: number }>('SELECT COUNT(*) as c FROM sync_relay_tokens WHERE expires_at <= datetime(\'now\')');
  const count = before[0]?.c ?? 0;
  db.execute('DELETE FROM sync_relay_tokens WHERE expires_at <= datetime(\'now\')');
  return count;
}

// ---------------------------------------------------------------------------
// Share Log
// ---------------------------------------------------------------------------

export function insertShareRequest(db: DatabaseAdapter, share: ShareRequest): void {
  db.execute(
    `INSERT INTO sync_share_log (id, from_device_id, to_device_id, module_id, table_name, row_id, data_json, workspace_id, status, transport, created_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      share.id, share.fromDeviceId, share.toDeviceId, share.moduleId,
      share.tableName, share.rowId, share.dataJson, share.workspaceId,
      share.status, share.transport, share.createdAt, share.deliveredAt,
    ],
  );
}

export function updateShareStatus(db: DatabaseAdapter, shareId: string, status: ShareStatus, transport?: SyncTransport): void {
  if (transport) {
    db.execute(
      'UPDATE sync_share_log SET status = ?, transport = ? WHERE id = ?',
      [status, transport, shareId],
    );
  } else {
    db.execute(
      'UPDATE sync_share_log SET status = ? WHERE id = ?',
      [status, shareId],
    );
  }
}

export function markShareDelivered(db: DatabaseAdapter, shareId: string): void {
  db.execute(
    'UPDATE sync_share_log SET status = \'delivered\', delivered_at = datetime(\'now\') WHERE id = ?',
    [shareId],
  );
}

export function getShareHistory(db: DatabaseAdapter, limit = 50): ShareRequest[] {
  const rows = db.query<{
    id: string;
    from_device_id: string;
    to_device_id: string;
    module_id: string;
    table_name: string;
    row_id: string;
    data_json: string;
    workspace_id: string | null;
    status: ShareStatus;
    transport: SyncTransport | null;
    created_at: string;
    delivered_at: string | null;
  }>('SELECT * FROM sync_share_log ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map((r) => ({
    id: r.id,
    fromDeviceId: r.from_device_id,
    toDeviceId: r.to_device_id,
    moduleId: r.module_id,
    tableName: r.table_name,
    rowId: r.row_id,
    dataJson: r.data_json,
    workspaceId: r.workspace_id,
    status: r.status,
    transport: r.transport,
    createdAt: r.created_at,
    deliveredAt: r.delivered_at,
  }));
}

export function getPendingShares(db: DatabaseAdapter, toDeviceId: string): ShareRequest[] {
  const rows = db.query<{
    id: string;
    from_device_id: string;
    to_device_id: string;
    module_id: string;
    table_name: string;
    row_id: string;
    data_json: string;
    workspace_id: string | null;
    status: ShareStatus;
    transport: SyncTransport | null;
    created_at: string;
    delivered_at: string | null;
  }>('SELECT * FROM sync_share_log WHERE to_device_id = ? AND status IN (\'pending\', \'sent\') ORDER BY created_at ASC', [toDeviceId]);
  return rows.map((r) => ({
    id: r.id,
    fromDeviceId: r.from_device_id,
    toDeviceId: r.to_device_id,
    moduleId: r.module_id,
    tableName: r.table_name,
    rowId: r.row_id,
    dataJson: r.data_json,
    workspaceId: r.workspace_id,
    status: r.status,
    transport: r.transport,
    createdAt: r.created_at,
    deliveredAt: r.delivered_at,
  }));
}
