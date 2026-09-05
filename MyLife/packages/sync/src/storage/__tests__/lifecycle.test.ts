import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { InMemoryStorageDestinationAdapter } from '../fakes';
import {
  STORAGE_TABLE_NAMES,
  ensureStorageTables,
  getStorageDestination,
  getStorageJob,
  insertStorageBackup,
  insertStorageDestination,
  insertStorageHealth,
  insertStorageJob,
  insertStorageObject,
  insertStoragePolicy,
  updateStorageJobState,
  type StorageDestinationRow,
} from '../schema';
import {
  deleteStorageAccountData,
  rotateStorageCredential,
} from '../lifecycle';

const NOW = '2026-07-14T12:00:00.000Z';
let harness: InMemoryTestDatabase | null = null;

function destination(overrides: Partial<StorageDestinationRow> = {}): StorageDestinationRow {
  return {
    id: 'destination',
    kind: 'webdav',
    label: 'Destination',
    account_hint: null,
    credential_ref: 'securestore://old',
    root_ref: null,
    state: 'ready',
    capability_json: '{}',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  harness = createInMemoryTestDatabase();
  ensureStorageTables(harness.adapter);
});

afterEach(() => {
  harness?.close();
  harness = null;
});

describe('credential rotation', () => {
  it('atomically swaps the credential, re-probes health, and resumes paused jobs', async () => {
    const db = harness!.adapter;
    insertStorageDestination(db, destination());
    insertStorageJob(db, {
      id: 'paused-job', kind: 'backup', destination_id: 'destination', state: 'paused',
      cursor_json: null, total_objects: 1, completed_objects: 0,
      total_bytes: 10, completed_bytes: 0, attempts: 1,
      last_error_code: 'auth_required', created_at: NOW, updated_at: NOW,
    });
    const adapter = new InMemoryStorageDestinationAdapter({ credentialRef: 'securestore://new' });
    let invalidations = 0;
    let oldCredentialsDeleted = 0;

    const report = await rotateStorageCredential({
      db,
      destinationId: 'destination',
      newCredentialRef: 'securestore://new',
      authorizationKind: 'stored_credential',
      invalidateAdapter: () => { invalidations += 1; },
      resolveAdapter: () => adapter,
      resumeJob: (jobId) => {
        updateStorageJobState(db, jobId, 'running', NOW, null);
      },
      deleteCredential: async (credentialRef) => {
        expect(credentialRef).toBe('securestore://old');
        oldCredentialsDeleted += 1;
      },
      now: () => NOW,
    });

    expect(report.complete).toBe(true);
    expect(report.resumedJobIds).toEqual(['paused-job']);
    expect(getStorageDestination(db, 'destination')?.credential_ref).toBe('securestore://new');
    expect(getStorageDestination(db, 'destination')?.state).toBe('ready');
    expect(getStorageJob(db, 'paused-job')?.state).toBe('running');
    expect(invalidations).toBeGreaterThanOrEqual(1);
    expect(oldCredentialsDeleted).toBe(1);
  });
});

describe('storage account deletion', () => {
  it('reports exact counts, clears every storage row, and is idempotent', async () => {
    const db = harness!.adapter;
    const brokerAdapter = new InMemoryStorageDestinationAdapter();
    await brokerAdapter.authorize({ kind: 'interactive' });
    insertStorageDestination(db, destination({
      id: 'broker', kind: 'google_drive', credential_ref: 'broker://oauth/vault-1',
    }));
    insertStorageDestination(db, destination({
      id: 'hosted', kind: 'hosted_storage', credential_ref: 'hosted://account',
    }));
    insertStoragePolicy(db, {
      data_class: 'sqlite_snapshot', primary_destination_id: 'broker',
      mirror_destination_id: 'hosted', local_cache_bytes: 0,
      retention_json: JSON.stringify({
        keepLast: 7,
        maxAgeDays: 30,
        schedule: {
          enabled: true,
          intervalHours: 24,
          recoveryKeyRef: 'securestore://schedule-key',
        },
      }), updated_at: NOW,
    });
    insertStorageObject(db, {
      object_id: 'object', destination_id: 'broker', data_class: 'sqlite_snapshot',
      ciphertext_hash: 'a'.repeat(128), plaintext_hash_encrypted: null,
      encrypted_bytes: 1, remote_ref: 'memory://object', remote_version: 'v1',
      state: 'verified', last_verified_at: NOW,
    });
    insertStorageJob(db, {
      id: 'job', kind: 'backup', destination_id: 'broker', state: 'succeeded',
      cursor_json: null, total_objects: 1, completed_objects: 1,
      total_bytes: 1, completed_bytes: 1, attempts: 1,
      last_error_code: null, created_at: NOW, updated_at: NOW,
    });
    insertStorageHealth(db, {
      destination_id: 'broker', state: 'ok', used_bytes: 1, cap_bytes: 10,
      verified_read_write: 1, checked_at: NOW, error_code: null,
    });
    insertStorageBackup(db, {
      backup_id: 'backup', destination_id: 'broker', manifest_ref: 'manifest',
      manifest_ciphertext_hash: 'b'.repeat(128), schema_version: 1,
      object_count: 1, encrypted_bytes: 1, state: 'complete', completed_at: NOW,
    });
    const deletedVaults: string[] = [];
    let hostedDeletes = 0;
    const deletedCredentials: string[] = [];

    const first = await deleteStorageAccountData({
      db,
      deleteRemoteData: true,
      resolveAdapter: (row) => row.id === 'broker' ? brokerAdapter : null,
      deleteBrokerVault: async (vaultId) => { deletedVaults.push(vaultId); },
      deleteHostedAccount: async () => { hostedDeletes += 1; },
      deleteCredential: async (ref) => { deletedCredentials.push(ref); },
      now: () => NOW,
    });
    const second = await deleteStorageAccountData({
      db,
      deleteRemoteData: true,
      resolveAdapter: () => null,
      deleteBrokerVault: async () => { throw new Error('must not run'); },
      deleteHostedAccount: async () => { throw new Error('must not run'); },
      now: () => NOW,
    });

    expect(first.complete).toBe(true);
    expect(first.destinationsRevoked).toBe(2);
    expect(first.brokerVaultsDeleted).toBe(1);
    expect(first.hostedAccountsDeleted).toBe(1);
    expect(first.credentialsDeleted).toBe(1);
    expect(first.clearedRows).toEqual({
      destinations: 2, policies: 1, objects: 1, jobs: 1, health: 1, backups: 1, total: 7,
    });
    expect(deletedVaults).toEqual([]);
    expect(hostedDeletes).toBe(1);
    expect(deletedCredentials).toEqual(['securestore://schedule-key']);
    for (const table of STORAGE_TABLE_NAMES) {
      expect(db.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)[0]?.count).toBe(0);
    }
    expect(second.complete).toBe(true);
    expect(second.destinationsRevoked).toBe(0);
    expect(second.clearedRows.total).toBe(0);
  });
});
