import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { sha512Hex } from '../../node/hkdf';
import { InMemoryStorageDestinationAdapter } from '../fakes';
import {
  ensureStorageTables,
  getStorageBackup,
  getStorageObject,
  insertStorageDestination,
  insertStorageBackup,
  insertStorageObject,
  type StorageDestinationRow,
  type StorageObjectRow,
} from '../schema';
import { planRepairJob, runRepairJob } from '../repair';
import { remoteBackupManifestObjectId, remoteBackupObjectId } from '../remote-backups';

const NOW = '2026-07-14T12:00:00.000Z';
let harness: InMemoryTestDatabase | null = null;

function destination(id: string, kind: StorageDestinationRow['kind']): StorageDestinationRow {
  return {
    id,
    kind,
    label: id,
    account_hint: null,
    credential_ref: null,
    root_ref: null,
    state: 'ready',
    capability_json: '{}',
    created_at: NOW,
    updated_at: NOW,
  };
}

function objectRow(
  objectId: string,
  destinationId: string,
  bytes: Uint8Array,
  state: StorageObjectRow['state'],
): StorageObjectRow {
  return {
    object_id: objectId,
    destination_id: destinationId,
    data_class: 'sqlite_snapshot',
    ciphertext_hash: sha512Hex(bytes),
    plaintext_hash_encrypted: null,
    encrypted_bytes: bytes.length,
    remote_ref: state === 'verified' ? `memory://${objectId}` : null,
    remote_version: state === 'verified' ? 'v1' : null,
    state,
    last_verified_at: state === 'verified' ? NOW : null,
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

it.each([
  ['local', 'local_device' as const],
  ['mirror', 'google_drive' as const],
])('repairs a missing object from a verified %s copy', async (_label, sourceKind) => {
  const db = harness!.adapter;
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const source = new InMemoryStorageDestinationAdapter();
  const target = new InMemoryStorageDestinationAdapter();
  await source.authorize({ kind: 'interactive' });
  await target.authorize({ kind: 'interactive' });
  await source.putObject({
    objectId: 'chunk', dataClass: 'sqlite_snapshot', ciphertext: bytes,
    ciphertextHash: sha512Hex(bytes), encryptedBytes: bytes.length,
  });
  insertStorageDestination(db, destination('source', sourceKind));
  insertStorageDestination(db, destination('target', 's3'));
  insertStorageObject(db, objectRow('chunk', 'source', bytes, 'verified'));
  insertStorageObject(db, objectRow('chunk', 'target', bytes, 'missing'));
  const plan = planRepairJob({
    objects: [objectRow('chunk', 'source', bytes, 'verified'), objectRow('chunk', 'target', bytes, 'missing')],
    destinations: [destination('source', sourceKind), destination('target', 's3')],
  });

  const report = await runRepairJob({
    db,
    plan,
    resolveAdapter: (id) => id === 'source' ? source : id === 'target' ? target : null,
    now: () => NOW,
    random: () => 'repair-id',
  });

  expect(report).toEqual(expect.objectContaining({
    planned: 1,
    repaired: 1,
    failed: 0,
    impossible: 0,
    complete: true,
  }));
  expect(getStorageObject(db, 'chunk', 'target')?.state).toBe('verified');
  expect(await target.getObject({ objectId: 'chunk' })).toEqual(bytes);
});

describe('partial repair reporting', () => {
  it('reports an impossible object exactly while completing the repairable object', async () => {
    const db = harness!.adapter;
    const bytes = new Uint8Array([8, 9]);
    const source = new InMemoryStorageDestinationAdapter();
    const target = new InMemoryStorageDestinationAdapter();
    await source.authorize({ kind: 'interactive' });
    await target.authorize({ kind: 'interactive' });
    await source.putObject({
      objectId: 'repairable', dataClass: 'sqlite_snapshot', ciphertext: bytes,
      ciphertextHash: sha512Hex(bytes), encryptedBytes: bytes.length,
    });
    const destinations = [destination('source', 'local_device'), destination('target', 's3')];
    for (const row of destinations) insertStorageDestination(db, row);
    const rows = [
      objectRow('repairable', 'source', bytes, 'verified'),
      objectRow('repairable', 'target', bytes, 'error'),
      objectRow('orphan', 'target', new Uint8Array([7]), 'missing'),
    ];
    for (const row of rows) insertStorageObject(db, row);
    const plan = planRepairJob({ objects: rows, destinations });

    const report = await runRepairJob({
      db,
      plan,
      resolveAdapter: (id) => id === 'source' ? source : id === 'target' ? target : null,
      now: () => NOW,
      random: () => 'repair-partial',
    });

    expect(report.complete).toBe(false);
    expect(report.repaired).toBe(1);
    expect(report.impossible).toBe(1);
    expect(report.outcomes).toContainEqual({
      objectId: 'orphan',
      destinationId: 'target',
      sourceDestinationId: null,
      status: 'impossible',
      code: 'no_verified_copy',
    });
  });
});

it('returns a corrupt backup row to complete only after every tracked object verifies', async () => {
  const db = harness!.adapter;
  const chunk = new Uint8Array([3, 1, 4]);
  const manifest = new Uint8Array([9, 2, 6]);
  const backupId = 'repair-backup';
  const chunkId = remoteBackupObjectId(backupId, 'database/000000.mkchunk');
  const manifestId = remoteBackupManifestObjectId(backupId);
  const source = new InMemoryStorageDestinationAdapter();
  const target = new InMemoryStorageDestinationAdapter();
  await source.authorize({ kind: 'interactive' });
  await target.authorize({ kind: 'interactive' });
  await source.putObject({
    objectId: chunkId, dataClass: 'sqlite_snapshot', ciphertext: chunk,
    ciphertextHash: sha512Hex(chunk), encryptedBytes: chunk.length,
  });
  await target.putObject({
    objectId: manifestId, dataClass: 'backup_manifest', ciphertext: manifest,
    ciphertextHash: sha512Hex(manifest), encryptedBytes: manifest.length,
  });
  const destinations = [destination('source', 'local_device'), destination('target', 's3')];
  for (const row of destinations) insertStorageDestination(db, row);
  const rows = [
    objectRow(chunkId, 'source', chunk, 'verified'),
    objectRow(chunkId, 'target', chunk, 'missing'),
    { ...objectRow(manifestId, 'target', manifest, 'verified'), data_class: 'backup_manifest' },
  ];
  for (const row of rows) insertStorageObject(db, row);
  insertStorageBackup(db, {
    backup_id: backupId,
    destination_id: 'target',
    manifest_ref: manifestId,
    manifest_ciphertext_hash: sha512Hex(manifest),
    schema_version: 1,
    object_count: 1,
    encrypted_bytes: chunk.length + manifest.length,
    state: 'corrupt',
    completed_at: NOW,
  });

  const report = await runRepairJob({
    db,
    plan: planRepairJob({ objects: rows, destinations }),
    resolveAdapter: (id) => id === 'source' ? source : id === 'target' ? target : null,
    now: () => NOW,
    random: () => 'repair-backup-job',
  });

  expect(report.backupsReverified).toBe(1);
  expect(getStorageBackup(db, backupId, 'target')?.state).toBe('complete');
});
