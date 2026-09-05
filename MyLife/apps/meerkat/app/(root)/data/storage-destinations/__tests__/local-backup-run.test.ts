import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  InMemoryStorageDestinationAdapter,
  createStorageRouter,
  createRestorePlan,
  ensureStorageTables,
  exportRecoverableIdentity,
  generateDeviceIdentity,
  generateRecoveryKey,
  hexToBytes,
  listStorageBackups,
  listStorageObjects,
  openBackupManifest,
  insertBlob,
  blobContentHash,
  createSyncTables,
  sealRecovery,
} from '@mylife/sync';
import type { StorageJobPayloadStore } from '@mylife/sync';
import type { BackupSigningIdentity } from '@mylife/sync/src/storage/backup-format';
import { runLocalDatabaseBackup } from '../local-backup-run';
import { createAdapterRestoreSource, readBackupManifestEnvelope } from '../local-restore-source';
import {
  runStagedRestore,
  type RestorePlatformDriver,
} from '../restore-orchestrator-core';
import type {
  ConsistentMobileSnapshot,
  MobileSnapshotDatabaseSource,
  MobileSnapshotFileSystem,
} from '../../local-snapshot';

// A fake consistent snapshot over fixed bytes: the router-facing path (encode ->
// job -> verified read-back) is exercised end to end without expo-sqlite.
function fakeSnapshot(bytes: Uint8Array): {
  fileSystem: MobileSnapshotFileSystem;
  databaseSource: MobileSnapshotDatabaseSource;
} {
  const fileSystem: MobileSnapshotFileSystem = {
    documentDirectory: 'file:///docs/',
    ensureDirectory: async () => undefined,
    delete: async () => undefined,
    size: async () => bytes.length,
    readRange: async (_uri, offset, length) => bytes.subarray(offset, offset + length),
  };
  const databaseSource: MobileSnapshotDatabaseSource = {
    async createConsistentSnapshot(): Promise<ConsistentMobileSnapshot> {
      return {
        uri: 'file:///docs/snapshot.db',
        integrityReport: 'ok',
        cleanup: async () => undefined,
      };
    },
  };
  return { fileSystem, databaseSource };
}

function signingIdentity(): BackupSigningIdentity {
  const recoverable = exportRecoverableIdentity(generateDeviceIdentity('Backup Test'));
  return {
    deviceId: recoverable.publicKey,
    publicKey: hexToBytes(recoverable.publicKey),
    secretKey: hexToBytes(recoverable.signingPrivateKeyHex),
  };
}

describe('runLocalDatabaseBackup (real snapshot -> encoder -> router job)', () => {
  it('reaches complete only after every object and the manifest verify', async () => {
    const db = createInMemoryTestDatabase().adapter;
    ensureStorageTables(db);
    createSyncTables(db);
    const adapter = new InMemoryStorageDestinationAdapter({ verification: 'read_back' });
    await adapter.authorize({ kind: 'interactive' });

    const payloads = new Map<string, Uint8Array>();
    const payloadStore: StorageJobPayloadStore = {
      async put(jobId, object) { payloads.set(`${jobId}:${object.objectId}`, object.ciphertext.slice()); },
      async get(jobId, objectId) { return payloads.get(`${jobId}:${objectId}`)?.slice() ?? null; },
      async deleteJob(jobId) {
        for (const key of payloads.keys()) if (key.startsWith(`${jobId}:`)) payloads.delete(key);
      },
    };
    const router = createStorageRouter({
      db,
      adapters: new Map([['dest-1', adapter]]),
      now: () => new Date().toISOString(),
      random: () => Math.random().toString(36).slice(2),
      payloadStore,
    });
    const capabilities = await adapter.capabilities();
    router.registerDestination({
      id: 'dest-1', kind: 'local_device', label: 'This device',
      credentialRef: 'local-device:dest-1', capabilities, state: 'ready',
    });

    const { key, bytes: recoveryBytes } = generateRecoveryKey();
    const bytes = new Uint8Array(1024).map((_v, i) => i % 251);
    const { fileSystem, databaseSource } = fakeSnapshot(bytes);
    const backupId = 'backup-under-test';
    const blobBytes = new Uint8Array(600).fill(0x2a);
    const blobHash = blobContentHash(blobBytes);
    const emptyBlobHash = blobContentHash(new Uint8Array(0));
    insertBlob(db, {
      hash: blobHash,
      size: blobBytes.length,
      mimeType: 'application/octet-stream',
      moduleId: 'library',
      refCount: 1,
      storedAt: new Date().toISOString(),
    });
    insertBlob(db, {
      hash: emptyBlobHash,
      size: 0,
      mimeType: 'application/octet-stream',
      moduleId: 'library',
      refCount: 1,
      storedAt: new Date().toISOString(),
    });
    const recoverable = exportRecoverableIdentity(generateDeviceIdentity('Recovery Test'));

    const result = await runLocalDatabaseBackup({
      db,
      router,
      destinationId: 'dest-1',
      backupId,
      schemaVersion: 1,
      chunkBytes: 256, // force several chunks -> several objects
      fileSystem,
      databaseSource,
      payloadStore,
      blobStore: {
        size: async (hash) => hash === blobHash
          ? blobBytes.length : hash === emptyBlobHash ? 0 : null,
        readRange: async (hash, offset, length) => (
          hash === blobHash
            ? blobBytes.subarray(offset, offset + length).slice()
            : hash === emptyBlobHash ? new Uint8Array(0) : null
        ),
      },
      encoderInput: {
        recoveryKey: key,
        backupId,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
        migrationVersion: 1,
        appVersion: '1.0.0',
        dataClassVersions: {},
        sealedRecoveryBundle: sealRecovery(recoverable, recoveryBytes),
        signingIdentity: signingIdentity(),
      },
    });

    expect(result.complete).toBe(true);
    expect(result.job.state).toBe('succeeded');
    expect(result.locatorJson).toContain('"backupId":"backup-under-test"');

    // The persisted backup row reached `complete` (NC-41.2): the router only
    // marks it complete after verified read-back of every object + manifest.
    const backups = listStorageBackups(db, 'dest-1');
    expect(backups).toHaveLength(1);
    expect(backups[0]!.state).toBe('complete');
    expect(backups[0]!.object_count).toBeGreaterThan(1);
    const persistedObjects = listStorageObjects(db, 'dest-1');
    const dataClasses = new Set(persistedObjects.map((row) => row.data_class));
    expect(dataClasses).toContain('encrypted_recovery_bundle');
    expect(dataClasses).toContain('library_object');
    expect(persistedObjects.filter((row) => row.data_class === 'library_object')).toHaveLength(4);
    expect(payloads.size).toBe(0);

    const manifestEnvelope = await readBackupManifestEnvelope(adapter, backupId);
    const opened = openBackupManifest(result.locatorJson, manifestEnvelope, key);
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw opened.error;
    const plan = createRestorePlan(opened.manifest, { mode: 'complete' });
    opened.backupRootKey.fill(0);
    expect(plan.manifest.identity).not.toBeNull();
    expect(plan.manifest.objects.map((object) => object.objectId)).toEqual([emptyBlobHash, blobHash].sort());

    const stagedChunks = new Map<string, Uint8Array>();
    let stagedIdentity: string | null = null;
    const driver: RestorePlatformDriver = {
      async resetStaging() { stagedChunks.clear(); stagedIdentity = null; },
      async writeVerifiedChunk(requirement, plaintext) {
        stagedChunks.set(requirement.chunkId, plaintext.slice());
      },
      async writeVerifiedIdentity(sealedRecoveryBundle) { stagedIdentity = sealedRecoveryBundle; },
      async rebuildStagedDatabase() { return undefined; },
      async checkStagedIntegrity() { return { passed: true, report: 'ok' }; },
      async rehearseStagedMigrations() { return { passed: true, report: 'ok' }; },
      async checkIdentityConsistency() { return { consistent: true, report: 'consistent' }; },
      async activate() {
        return { activated: true, report: 'activated', rollbackRetained: true, hadPriorData: true };
      },
    };
    const restoreSource = createAdapterRestoreSource(adapter, backupId);
    const restored = await runStagedRestore({
      plan,
      destinationId: 'dest-1',
      locatorJson: result.locatorJson,
      manifestEnvelope,
      recoveryKey: key,
      source: restoreSource,
      driver,
    });
    expect(restored.state.stage).toBe('activated');
    expect(stagedIdentity).toBeTruthy();
    for (const requirement of plan.requiredChunks) {
      expect(stagedChunks.get(requirement.chunkId)?.length).toBe(requirement.plaintextBytes);
    }

    const missingBlobChunk = plan.requiredChunks.find((requirement) => (
      requirement.target.kind === 'object' && requirement.target.objectId === blobHash
    ));
    expect(missingBlobChunk).toBeDefined();
    const missing = await runStagedRestore({
      plan,
      destinationId: 'dest-1',
      locatorJson: result.locatorJson,
      manifestEnvelope,
      recoveryKey: key,
      source: {
        readChunk: (requirement) => requirement.chunkId === missingBlobChunk?.chunkId
          ? Promise.resolve(null)
          : restoreSource.readChunk(requirement),
        readIdentityChunk: () => restoreSource.readIdentityChunk(),
      },
      driver,
    });
    expect(missing.state.stage).toBe('failed');
    expect(missing.state.failure?.code).toBe('missing_chunk');

    const missingIdentity = await runStagedRestore({
      plan,
      destinationId: 'dest-1',
      locatorJson: result.locatorJson,
      manifestEnvelope,
      recoveryKey: key,
      source: {
        readChunk: (requirement) => restoreSource.readChunk(requirement),
        readIdentityChunk: () => Promise.resolve(null),
      },
      driver,
    });
    expect(missingIdentity.state.stage).toBe('failed');
    expect(missingIdentity.state.failure?.code).toBe('missing_chunk');
  });
});
