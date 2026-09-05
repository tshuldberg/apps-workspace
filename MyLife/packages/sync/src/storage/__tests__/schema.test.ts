import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  STORAGE_TABLE_NAMES,
  ensureStorageTables,
  getStorageBackup,
  getStorageDestination,
  getStorageHealth,
  getStorageJob,
  getStorageObject,
  getStoragePolicy,
  insertStorageBackup,
  insertStorageDestination,
  insertStorageHealth,
  insertStorageJob,
  insertStorageObject,
  insertStoragePolicy,
  listStorageBackups,
  listStorageDestinations,
  listStorageHealth,
  listStorageJobs,
  listStorageObjects,
  listStoragePolicies,
  StorageSecretLikeValueError,
  updateStorageBackupState,
  updateStorageDestinationState,
  updateStorageHealthState,
  updateStorageJobState,
  updateStorageObjectState,
  updateStoragePolicy,
  type StorageDestinationRow,
} from '../schema';

let harness: InMemoryTestDatabase | null = null;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  harness = createInMemoryTestDatabase();
  db = harness.adapter;
  ensureStorageTables(db);
});

afterEach(() => {
  harness?.close();
  harness = null;
});

const destination = (overrides: Partial<StorageDestinationRow> = {}): StorageDestinationRow => ({
  id: 'dest-1',
  kind: 'google_drive',
  label: 'Drive',
  account_hint: 'person@example.com',
  credential_ref: 'securestore://storage/google/person',
  root_ref: 'app-data-folder',
  state: 'ready',
  capability_json: '{"resumableUpload":true}',
  created_at: '2026-07-14T12:00:00.000Z',
  updated_at: '2026-07-14T12:00:00.000Z',
  ...overrides,
});

describe('ensureStorageTables', () => {
  it('creates the exact six device-local tables idempotently', () => {
    ensureStorageTables(db);
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mk_storage_%' ORDER BY name`,
    );
    expect(rows.map((row) => row.name)).toEqual([...STORAGE_TABLE_NAMES].sort());
  });

  it('exports only mk_storage_ device-local table names', () => {
    expect(STORAGE_TABLE_NAMES).toHaveLength(6);
    expect(STORAGE_TABLE_NAMES.every((table) => table.startsWith('mk_storage_'))).toBe(true);
  });
});

describe('storage destination CRUD', () => {
  it('inserts, gets, lists, and updates state with parameterized values', () => {
    const row = destination({ label: "Drive'); DROP TABLE mk_storage_destinations; --" });
    insertStorageDestination(db, row);
    expect(getStorageDestination(db, row.id)?.label).toBe(row.label);
    updateStorageDestinationState(db, row.id, 'degraded', '2026-07-14T12:01:00.000Z');
    expect(getStorageDestination(db, row.id)?.state).toBe('degraded');
    expect(listStorageDestinations(db)).toHaveLength(1);
  });

  it.each([
    'Bearer access-token-value',
    'ya29.google-access-token',
    'sl.dropbox-secret',
    'a'.repeat(130),
  ])('rejects an obvious credential value at the SQLite seam: %s', (credentialRef) => {
    expect(() => insertStorageDestination(db, destination({ credential_ref: credentialRef })))
      .toThrow(StorageSecretLikeValueError);
    expect(listStorageDestinations(db)).toEqual([]);
  });
});

it('round-trips and updates storage policies', () => {
  insertStoragePolicy(db, {
    data_class: 'database',
    primary_destination_id: 'dest-1',
    mirror_destination_id: null,
    local_cache_bytes: 4096,
    retention_json: '{"keep":3}',
    updated_at: '2026-07-14T12:00:00.000Z',
  });
  const policy = getStoragePolicy(db, 'database');
  expect(policy?.local_cache_bytes).toBe(4096);
  if (policy === null) throw new Error('policy fixture was not inserted');
  updateStoragePolicy(db, {
    ...policy,
    mirror_destination_id: 'dest-2',
    updated_at: '2026-07-14T12:01:00.000Z',
  });
  expect(listStoragePolicies(db)[0]?.mirror_destination_id).toBe('dest-2');
});

it('round-trips and updates storage objects', () => {
  insertStorageObject(db, {
    object_id: 'cipher-1',
    destination_id: 'dest-1',
    data_class: 'attachment',
    ciphertext_hash: 'ab'.repeat(64),
    plaintext_hash_encrypted: null,
    encrypted_bytes: 512,
    remote_ref: null,
    remote_version: null,
    state: 'queued',
    last_verified_at: null,
  });
  updateStorageObjectState(db, 'cipher-1', 'dest-1', 'verified', '2026-07-14T12:02:00.000Z');
  expect(getStorageObject(db, 'cipher-1', 'dest-1')?.state).toBe('verified');
  expect(listStorageObjects(db, 'dest-1')).toHaveLength(1);
});

it('round-trips and updates storage jobs', () => {
  insertStorageJob(db, {
    id: 'job-1',
    kind: 'backup',
    destination_id: 'dest-1',
    state: 'queued',
    cursor_json: null,
    total_objects: 1,
    completed_objects: 0,
    total_bytes: 512,
    completed_bytes: 0,
    attempts: 0,
    last_error_code: null,
    created_at: '2026-07-14T12:00:00.000Z',
    updated_at: '2026-07-14T12:00:00.000Z',
  });
  updateStorageJobState(db, 'job-1', 'failed', '2026-07-14T12:03:00.000Z', 'unreachable');
  expect(getStorageJob(db, 'job-1')).toMatchObject({ state: 'failed', last_error_code: 'unreachable' });
  expect(listStorageJobs(db, 'dest-1')).toHaveLength(1);
});

it('round-trips and updates storage health', () => {
  insertStorageHealth(db, {
    destination_id: 'dest-1',
    state: 'ok',
    used_bytes: 100,
    cap_bytes: 1000,
    verified_read_write: 1,
    checked_at: '2026-07-14T12:00:00.000Z',
    error_code: null,
  });
  updateStorageHealthState(
    db,
    'dest-1',
    'unreachable',
    0,
    '2026-07-14T12:04:00.000Z',
    'offline',
  );
  expect(getStorageHealth(db, 'dest-1')).toMatchObject({
    state: 'unreachable',
    verified_read_write: 0,
    error_code: 'offline',
  });
  expect(listStorageHealth(db)).toHaveLength(1);
});

it('round-trips and updates storage backups', () => {
  insertStorageBackup(db, {
    backup_id: 'backup-1',
    destination_id: 'dest-1',
    manifest_ref: 'manifest.mkmanifest',
    manifest_ciphertext_hash: 'cd'.repeat(64),
    schema_version: 41,
    object_count: 1,
    encrypted_bytes: 1024,
    state: 'writing',
    completed_at: null,
  });
  updateStorageBackupState(db, 'backup-1', 'dest-1', 'complete', '2026-07-14T12:05:00.000Z');
  expect(getStorageBackup(db, 'backup-1', 'dest-1')?.state).toBe('complete');
  expect(listStorageBackups(db, 'dest-1')).toHaveLength(1);
});
