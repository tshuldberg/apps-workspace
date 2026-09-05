import type { DatabaseAdapter } from '@mylife/db';
import type { StorageDestinationKind, StorageHealth } from './types';

export const STORAGE_TABLE_NAMES = [
  'mk_storage_destinations',
  'mk_storage_policies',
  'mk_storage_objects',
  'mk_storage_jobs',
  'mk_storage_health',
  'mk_storage_backups',
] as const;

export const CREATE_MK_STORAGE_DESTINATIONS = `
CREATE TABLE IF NOT EXISTS mk_storage_destinations (
  id text PRIMARY KEY,
  kind text NOT NULL,
  label text NOT NULL,
  account_hint text,
  credential_ref text,
  root_ref text,
  state text NOT NULL CHECK (state IN ('authorizing','ready','degraded','revoked','error')),
  capability_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
)`;

export const CREATE_MK_STORAGE_POLICIES = `
CREATE TABLE IF NOT EXISTS mk_storage_policies (
  data_class text PRIMARY KEY,
  primary_destination_id text NOT NULL,
  mirror_destination_id text,
  local_cache_bytes integer NOT NULL,
  retention_json text NOT NULL,
  updated_at text NOT NULL
)`;

export const CREATE_MK_STORAGE_OBJECTS = `
CREATE TABLE IF NOT EXISTS mk_storage_objects (
  object_id text NOT NULL,
  destination_id text NOT NULL,
  data_class text NOT NULL,
  ciphertext_hash text NOT NULL,
  plaintext_hash_encrypted text,
  encrypted_bytes integer NOT NULL,
  remote_ref text,
  remote_version text,
  state text NOT NULL CHECK (state IN ('queued','writing','verifying','verified','missing','deleting','deleted','error')),
  last_verified_at text,
  PRIMARY KEY (object_id, destination_id)
)`;

export const CREATE_MK_STORAGE_JOBS = `
CREATE TABLE IF NOT EXISTS mk_storage_jobs (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('backup','restore','move','mirror','verify','delete','repair')),
  destination_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('queued','running','paused','cancelled','succeeded','partial','failed')),
  cursor_json text,
  total_objects integer NOT NULL,
  completed_objects integer NOT NULL,
  total_bytes integer NOT NULL,
  completed_bytes integer NOT NULL,
  attempts integer NOT NULL,
  last_error_code text,
  created_at text NOT NULL,
  updated_at text NOT NULL
)`;

export const CREATE_MK_STORAGE_HEALTH = `
CREATE TABLE IF NOT EXISTS mk_storage_health (
  destination_id text PRIMARY KEY,
  state text NOT NULL,
  used_bytes integer,
  cap_bytes integer,
  verified_read_write integer NOT NULL,
  checked_at text NOT NULL,
  error_code text
)`;

export const CREATE_MK_STORAGE_BACKUPS = `
CREATE TABLE IF NOT EXISTS mk_storage_backups (
  backup_id text NOT NULL,
  destination_id text NOT NULL,
  manifest_ref text NOT NULL,
  manifest_ciphertext_hash text NOT NULL,
  schema_version integer NOT NULL,
  object_count integer NOT NULL,
  encrypted_bytes integer NOT NULL,
  state text NOT NULL CHECK (state IN ('writing','verifying','complete','corrupt','deleted')),
  completed_at text,
  PRIMARY KEY (backup_id, destination_id)
)`;

export function ensureStorageTables(db: DatabaseAdapter): void {
  db.execute(CREATE_MK_STORAGE_DESTINATIONS);
  db.execute(CREATE_MK_STORAGE_POLICIES);
  db.execute(CREATE_MK_STORAGE_OBJECTS);
  db.execute(CREATE_MK_STORAGE_JOBS);
  db.execute(CREATE_MK_STORAGE_HEALTH);
  db.execute(CREATE_MK_STORAGE_BACKUPS);
}

export type StorageDestinationState = 'authorizing' | 'ready' | 'degraded' | 'revoked' | 'error';
export type StorageObjectState =
  | 'queued'
  | 'writing'
  | 'verifying'
  | 'verified'
  | 'missing'
  | 'deleting'
  | 'deleted'
  | 'error';
export type StorageJobKind = 'backup' | 'restore' | 'move' | 'mirror' | 'verify' | 'delete' | 'repair';
export type StorageJobState = 'queued' | 'running' | 'paused' | 'cancelled' | 'succeeded' | 'partial' | 'failed';
export type StorageBackupState = 'writing' | 'verifying' | 'complete' | 'corrupt' | 'deleted';

export interface StorageDestinationRow {
  id: string;
  kind: StorageDestinationKind;
  label: string;
  account_hint: string | null;
  credential_ref: string | null;
  root_ref: string | null;
  state: StorageDestinationState;
  capability_json: string;
  created_at: string;
  updated_at: string;
}

export interface StoragePolicyRow {
  data_class: string;
  primary_destination_id: string;
  mirror_destination_id: string | null;
  local_cache_bytes: number;
  retention_json: string;
  updated_at: string;
}

export interface StorageObjectRow {
  object_id: string;
  destination_id: string;
  data_class: string;
  ciphertext_hash: string;
  plaintext_hash_encrypted: string | null;
  encrypted_bytes: number;
  remote_ref: string | null;
  remote_version: string | null;
  state: StorageObjectState;
  last_verified_at: string | null;
}

export interface StorageJobRow {
  id: string;
  kind: StorageJobKind;
  destination_id: string;
  state: StorageJobState;
  cursor_json: string | null;
  total_objects: number;
  completed_objects: number;
  total_bytes: number;
  completed_bytes: number;
  attempts: number;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageHealthRow {
  destination_id: string;
  state: StorageHealth['state'];
  used_bytes: number | null;
  cap_bytes: number | null;
  verified_read_write: 0 | 1;
  checked_at: string;
  error_code: string | null;
}

export interface StorageBackupRow {
  backup_id: string;
  destination_id: string;
  manifest_ref: string;
  manifest_ciphertext_hash: string;
  schema_version: number;
  object_count: number;
  encrypted_bytes: number;
  state: StorageBackupState;
  completed_at: string | null;
}

export interface StorageBackupCheckpoint {
  backupId: string;
  destinationId: string;
  state: StorageBackupState;
  completedAt: string | null;
}

/** One router reducer checkpoint and every row whose truth depends on that event. */
export interface StorageRouterCheckpoint {
  job: StorageJobRow;
  objects?: readonly StorageObjectRow[];
  backup?: StorageBackupCheckpoint;
}

export class StorageSecretLikeValueError extends Error {
  constructor() {
    super('credential_ref looks like a credential value; store only a SecureStore or broker-vault pointer');
    this.name = 'StorageSecretLikeValueError';
  }
}

/** Heuristic seam guard. The type system and security review remain authoritative. */
export function assertNotSecretLike(value: string): void {
  const trimmed = value.trim();
  const compact = trimmed.replace(/\s+/g, '');
  const obviousToken = /bearer\s+|ya29\.|(?:^|\.)sl\./i.test(trimmed);
  const jwtLike = compact.length > 80 && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(compact);
  const longHex = compact.length > 128 && /^[a-f0-9]+$/i.test(compact);
  const longBase64 = compact.length > 128 && /^[A-Za-z0-9+/_=-]+$/.test(compact);
  if (obviousToken || jwtLike || longHex || longBase64) {
    throw new StorageSecretLikeValueError();
  }
}

function firstRow<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}

export function insertStorageDestination(db: DatabaseAdapter, row: StorageDestinationRow): void {
  if (row.credential_ref !== null) assertNotSecretLike(row.credential_ref);
  db.execute(
    `INSERT INTO mk_storage_destinations
       (id, kind, label, account_hint, credential_ref, root_ref, state, capability_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.kind,
      row.label,
      row.account_hint,
      row.credential_ref,
      row.root_ref,
      row.state,
      row.capability_json,
      row.created_at,
      row.updated_at,
    ],
  );
}

export function getStorageDestination(db: DatabaseAdapter, id: string): StorageDestinationRow | null {
  return firstRow(db.query<StorageDestinationRow>(
    `SELECT id, kind, label, account_hint, credential_ref, root_ref, state,
            capability_json, created_at, updated_at
       FROM mk_storage_destinations WHERE id = ?`,
    [id],
  ));
}

export function updateStorageDestinationState(
  db: DatabaseAdapter,
  id: string,
  state: StorageDestinationState,
  updatedAt: string,
): void {
  db.execute(
    `UPDATE mk_storage_destinations SET state = ?, updated_at = ? WHERE id = ?`,
    [state, updatedAt, id],
  );
}

export function updateStorageDestinationCredential(
  db: DatabaseAdapter,
  id: string,
  credentialRef: string | null,
  accountHint: string | null,
  state: StorageDestinationState,
  updatedAt: string,
): void {
  if (credentialRef !== null) assertNotSecretLike(credentialRef);
  db.execute(
    `UPDATE mk_storage_destinations
        SET credential_ref = ?, account_hint = ?, state = ?, updated_at = ?
      WHERE id = ?`,
    [credentialRef, accountHint, state, updatedAt, id],
  );
}

export function listStorageDestinations(db: DatabaseAdapter): StorageDestinationRow[] {
  return db.query<StorageDestinationRow>(
    `SELECT id, kind, label, account_hint, credential_ref, root_ref, state,
            capability_json, created_at, updated_at
       FROM mk_storage_destinations ORDER BY created_at, id`,
  );
}

export function insertStoragePolicy(db: DatabaseAdapter, row: StoragePolicyRow): void {
  db.execute(
    `INSERT INTO mk_storage_policies
       (data_class, primary_destination_id, mirror_destination_id, local_cache_bytes, retention_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.data_class,
      row.primary_destination_id,
      row.mirror_destination_id,
      row.local_cache_bytes,
      row.retention_json,
      row.updated_at,
    ],
  );
}

export function getStoragePolicy(db: DatabaseAdapter, dataClass: string): StoragePolicyRow | null {
  return firstRow(db.query<StoragePolicyRow>(
    `SELECT data_class, primary_destination_id, mirror_destination_id, local_cache_bytes,
            retention_json, updated_at
       FROM mk_storage_policies WHERE data_class = ?`,
    [dataClass],
  ));
}

export function updateStoragePolicy(db: DatabaseAdapter, row: StoragePolicyRow): void {
  db.execute(
    `UPDATE mk_storage_policies
        SET primary_destination_id = ?, mirror_destination_id = ?, local_cache_bytes = ?,
            retention_json = ?, updated_at = ?
      WHERE data_class = ?`,
    [
      row.primary_destination_id,
      row.mirror_destination_id,
      row.local_cache_bytes,
      row.retention_json,
      row.updated_at,
      row.data_class,
    ],
  );
}

export function listStoragePolicies(db: DatabaseAdapter): StoragePolicyRow[] {
  return db.query<StoragePolicyRow>(
    `SELECT data_class, primary_destination_id, mirror_destination_id, local_cache_bytes,
            retention_json, updated_at
       FROM mk_storage_policies ORDER BY data_class`,
  );
}

export function insertStorageObject(db: DatabaseAdapter, row: StorageObjectRow): void {
  db.execute(
    `INSERT INTO mk_storage_objects
       (object_id, destination_id, data_class, ciphertext_hash, plaintext_hash_encrypted,
        encrypted_bytes, remote_ref, remote_version, state, last_verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.object_id,
      row.destination_id,
      row.data_class,
      row.ciphertext_hash,
      row.plaintext_hash_encrypted,
      row.encrypted_bytes,
      row.remote_ref,
      row.remote_version,
      row.state,
      row.last_verified_at,
    ],
  );
}

export function getStorageObject(
  db: DatabaseAdapter,
  objectId: string,
  destinationId: string,
): StorageObjectRow | null {
  return firstRow(db.query<StorageObjectRow>(
    `SELECT object_id, destination_id, data_class, ciphertext_hash, plaintext_hash_encrypted,
            encrypted_bytes, remote_ref, remote_version, state, last_verified_at
       FROM mk_storage_objects WHERE object_id = ? AND destination_id = ?`,
    [objectId, destinationId],
  ));
}

export function updateStorageObjectState(
  db: DatabaseAdapter,
  objectId: string,
  destinationId: string,
  state: StorageObjectState,
  lastVerifiedAt: string | null = null,
): void {
  db.execute(
    `UPDATE mk_storage_objects SET state = ?, last_verified_at = ?
      WHERE object_id = ? AND destination_id = ?`,
    [state, lastVerifiedAt, objectId, destinationId],
  );
}

/** Persist the complete remote-write checkpoint for one destination copy. */
export function upsertStorageObject(db: DatabaseAdapter, row: StorageObjectRow): void {
  db.execute(
    `INSERT INTO mk_storage_objects
       (object_id, destination_id, data_class, ciphertext_hash, plaintext_hash_encrypted,
        encrypted_bytes, remote_ref, remote_version, state, last_verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(object_id, destination_id) DO UPDATE SET
       data_class = excluded.data_class,
       ciphertext_hash = excluded.ciphertext_hash,
       plaintext_hash_encrypted = excluded.plaintext_hash_encrypted,
       encrypted_bytes = excluded.encrypted_bytes,
       remote_ref = excluded.remote_ref,
       remote_version = excluded.remote_version,
       state = excluded.state,
       last_verified_at = excluded.last_verified_at`,
    [
      row.object_id,
      row.destination_id,
      row.data_class,
      row.ciphertext_hash,
      row.plaintext_hash_encrypted,
      row.encrypted_bytes,
      row.remote_ref,
      row.remote_version,
      row.state,
      row.last_verified_at,
    ],
  );
}

export function listStorageObjects(
  db: DatabaseAdapter,
  destinationId?: string,
): StorageObjectRow[] {
  const select = `SELECT object_id, destination_id, data_class, ciphertext_hash,
                         plaintext_hash_encrypted, encrypted_bytes, remote_ref,
                         remote_version, state, last_verified_at
                    FROM mk_storage_objects`;
  if (destinationId !== undefined) {
    return db.query<StorageObjectRow>(
      `${select} WHERE destination_id = ? ORDER BY object_id`,
      [destinationId],
    );
  }
  return db.query<StorageObjectRow>(`${select} ORDER BY destination_id, object_id`);
}

export function insertStorageJob(db: DatabaseAdapter, row: StorageJobRow): void {
  db.execute(
    `INSERT INTO mk_storage_jobs
       (id, kind, destination_id, state, cursor_json, total_objects, completed_objects,
        total_bytes, completed_bytes, attempts, last_error_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.kind,
      row.destination_id,
      row.state,
      row.cursor_json,
      row.total_objects,
      row.completed_objects,
      row.total_bytes,
      row.completed_bytes,
      row.attempts,
      row.last_error_code,
      row.created_at,
      row.updated_at,
    ],
  );
}

export function getStorageJob(db: DatabaseAdapter, id: string): StorageJobRow | null {
  return firstRow(db.query<StorageJobRow>(
    `SELECT id, kind, destination_id, state, cursor_json, total_objects,
            completed_objects, total_bytes, completed_bytes, attempts,
            last_error_code, created_at, updated_at
       FROM mk_storage_jobs WHERE id = ?`,
    [id],
  ));
}

export function updateStorageJobState(
  db: DatabaseAdapter,
  id: string,
  state: StorageJobState,
  updatedAt: string,
  lastErrorCode: string | null = null,
): void {
  db.execute(
    `UPDATE mk_storage_jobs SET state = ?, updated_at = ?, last_error_code = ? WHERE id = ?`,
    [state, updatedAt, lastErrorCode, id],
  );
}

/** Checkpoint every persisted job field after a reducer event. */
export function updateStorageJob(db: DatabaseAdapter, row: StorageJobRow): void {
  db.execute(
    `UPDATE mk_storage_jobs SET
       state = ?, cursor_json = ?, total_objects = ?, completed_objects = ?,
       total_bytes = ?, completed_bytes = ?, attempts = ?, last_error_code = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      row.state,
      row.cursor_json,
      row.total_objects,
      row.completed_objects,
      row.total_bytes,
      row.completed_bytes,
      row.attempts,
      row.last_error_code,
      row.updated_at,
      row.id,
    ],
  );
}

export function listStorageJobs(db: DatabaseAdapter, destinationId?: string): StorageJobRow[] {
  const select = `SELECT id, kind, destination_id, state, cursor_json, total_objects,
                         completed_objects, total_bytes, completed_bytes, attempts,
                         last_error_code, created_at, updated_at
                    FROM mk_storage_jobs`;
  if (destinationId !== undefined) {
    return db.query<StorageJobRow>(
      `${select} WHERE destination_id = ? ORDER BY created_at, id`,
      [destinationId],
    );
  }
  return db.query<StorageJobRow>(`${select} ORDER BY created_at, id`);
}

export function insertStorageHealth(db: DatabaseAdapter, row: StorageHealthRow): void {
  db.execute(
    `INSERT INTO mk_storage_health
       (destination_id, state, used_bytes, cap_bytes, verified_read_write, checked_at, error_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.destination_id,
      row.state,
      row.used_bytes,
      row.cap_bytes,
      row.verified_read_write,
      row.checked_at,
      row.error_code,
    ],
  );
}

export function getStorageHealth(db: DatabaseAdapter, destinationId: string): StorageHealthRow | null {
  return firstRow(db.query<StorageHealthRow>(
    `SELECT destination_id, state, used_bytes, cap_bytes, verified_read_write, checked_at, error_code
       FROM mk_storage_health WHERE destination_id = ?`,
    [destinationId],
  ));
}

export function updateStorageHealthState(
  db: DatabaseAdapter,
  destinationId: string,
  state: StorageHealth['state'],
  verifiedReadWrite: 0 | 1,
  checkedAt: string,
  errorCode: string | null = null,
): void {
  db.execute(
    `UPDATE mk_storage_health
        SET state = ?, verified_read_write = ?, checked_at = ?, error_code = ?
      WHERE destination_id = ?`,
    [state, verifiedReadWrite, checkedAt, errorCode, destinationId],
  );
}

/** Insert or replace a complete health and quota observation. */
export function upsertStorageHealth(db: DatabaseAdapter, row: StorageHealthRow): void {
  db.execute(
    `INSERT INTO mk_storage_health
       (destination_id, state, used_bytes, cap_bytes, verified_read_write, checked_at, error_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(destination_id) DO UPDATE SET
       state = excluded.state,
       used_bytes = excluded.used_bytes,
       cap_bytes = excluded.cap_bytes,
       verified_read_write = excluded.verified_read_write,
       checked_at = excluded.checked_at,
       error_code = excluded.error_code`,
    [
      row.destination_id,
      row.state,
      row.used_bytes,
      row.cap_bytes,
      row.verified_read_write,
      row.checked_at,
      row.error_code,
    ],
  );
}

export function listStorageHealth(db: DatabaseAdapter): StorageHealthRow[] {
  return db.query<StorageHealthRow>(
    `SELECT destination_id, state, used_bytes, cap_bytes, verified_read_write, checked_at, error_code
       FROM mk_storage_health ORDER BY destination_id`,
  );
}

export function insertStorageBackup(db: DatabaseAdapter, row: StorageBackupRow): void {
  db.execute(
    `INSERT INTO mk_storage_backups
       (backup_id, destination_id, manifest_ref, manifest_ciphertext_hash, schema_version,
        object_count, encrypted_bytes, state, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.backup_id,
      row.destination_id,
      row.manifest_ref,
      row.manifest_ciphertext_hash,
      row.schema_version,
      row.object_count,
      row.encrypted_bytes,
      row.state,
      row.completed_at,
    ],
  );
}

export function getStorageBackup(
  db: DatabaseAdapter,
  backupId: string,
  destinationId: string,
): StorageBackupRow | null {
  return firstRow(db.query<StorageBackupRow>(
    `SELECT backup_id, destination_id, manifest_ref, manifest_ciphertext_hash,
            schema_version, object_count, encrypted_bytes, state, completed_at
       FROM mk_storage_backups WHERE backup_id = ? AND destination_id = ?`,
    [backupId, destinationId],
  ));
}

export function updateStorageBackupState(
  db: DatabaseAdapter,
  backupId: string,
  destinationId: string,
  state: StorageBackupState,
  completedAt: string | null = null,
): void {
  db.execute(
    `UPDATE mk_storage_backups SET state = ?, completed_at = ?
      WHERE backup_id = ? AND destination_id = ?`,
    [state, completedAt, backupId, destinationId],
  );
}

export function updateStorageBackupManifestRef(
  db: DatabaseAdapter,
  backupId: string,
  destinationId: string,
  manifestRef: string,
): void {
  db.execute(
    `UPDATE mk_storage_backups SET manifest_ref = ?
      WHERE backup_id = ? AND destination_id = ?`,
    [manifestRef, backupId, destinationId],
  );
}

/** Persist a job event and its dependent object/backup truth in one SQLite transaction. */
export function checkpointStorageRouterState(
  db: DatabaseAdapter,
  checkpoint: StorageRouterCheckpoint,
): void {
  db.transaction(() => {
    updateStorageJob(db, checkpoint.job);
    if (getStorageJob(db, checkpoint.job.id) === null) {
      throw new Error('storage router checkpoint job is missing');
    }
    for (const object of checkpoint.objects ?? []) upsertStorageObject(db, object);
    if (checkpoint.backup !== undefined) {
      updateStorageBackupState(
        db,
        checkpoint.backup.backupId,
        checkpoint.backup.destinationId,
        checkpoint.backup.state,
        checkpoint.backup.completedAt,
      );
      const persisted = getStorageBackup(
        db,
        checkpoint.backup.backupId,
        checkpoint.backup.destinationId,
      );
      if (persisted?.state !== checkpoint.backup.state
        || persisted.completed_at !== checkpoint.backup.completedAt) {
        throw new Error('storage router checkpoint backup is missing or inconsistent');
      }
    }
  });
}

export function listStorageBackups(db: DatabaseAdapter, destinationId?: string): StorageBackupRow[] {
  const select = `SELECT backup_id, destination_id, manifest_ref, manifest_ciphertext_hash,
                         schema_version, object_count, encrypted_bytes, state, completed_at
                    FROM mk_storage_backups`;
  if (destinationId !== undefined) {
    return db.query<StorageBackupRow>(
      `${select} WHERE destination_id = ? ORDER BY backup_id`,
      [destinationId],
    );
  }
  return db.query<StorageBackupRow>(`${select} ORDER BY destination_id, backup_id`);
}

export interface StorageRowCounts {
  destinations: number;
  policies: number;
  objects: number;
  jobs: number;
  health: number;
  backups: number;
  total: number;
}

/** Clears only the Plan 41 storage substrate and returns exact pre-delete counts. */
export function clearStorageRows(db: DatabaseAdapter): StorageRowCounts {
  const counts = {
    destinations: countRows(db, 'mk_storage_destinations'),
    policies: countRows(db, 'mk_storage_policies'),
    objects: countRows(db, 'mk_storage_objects'),
    jobs: countRows(db, 'mk_storage_jobs'),
    health: countRows(db, 'mk_storage_health'),
    backups: countRows(db, 'mk_storage_backups'),
  };
  db.transaction(() => {
    db.execute('DELETE FROM mk_storage_jobs');
    db.execute('DELETE FROM mk_storage_objects');
    db.execute('DELETE FROM mk_storage_backups');
    db.execute('DELETE FROM mk_storage_health');
    db.execute('DELETE FROM mk_storage_policies');
    db.execute('DELETE FROM mk_storage_destinations');
  });
  return { ...counts, total: Object.values(counts).reduce((total, count) => total + count, 0) };
}

function countRows(db: DatabaseAdapter, table: typeof STORAGE_TABLE_NAMES[number]): number {
  return db.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)[0]?.count ?? 0;
}
