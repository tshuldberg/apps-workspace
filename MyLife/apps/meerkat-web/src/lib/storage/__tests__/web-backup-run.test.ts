import { beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryStorageDestinationAdapter,
  blobContentHash,
  createRestorePlan,
  createStorageRouter,
  createSyncTables,
  ensureStorageTables,
  exportRecoverableIdentity,
  generateDeviceIdentity,
  generateRecoveryKey,
  hexToBytes,
  insertBlob,
  openBackupManifest,
  sealRecovery,
  type StorageJobPayloadStore,
} from '@mylife/sync';
import { createBrowserDatabaseAdapter } from '../browser-database-adapter';
import { createWebAdapterRestoreSource, readWebBackupManifestEnvelope } from '../adapter-restore-source';
import {
  runStagedRestore,
  type RestorePlatformDriver,
} from '../restore-orchestrator-core';
import { runWebDatabaseBackup } from '../web-backup-run';
import { nodeLocateFile, resetDurableLayer } from './helpers';

describe('web production backup to staged restore', () => {
  beforeEach(async () => resetDurableLayer());

  it('round-trips database, blob, and recovery identity through the real web backup source', async () => {
    const db = await createBrowserDatabaseAdapter({ locateFile: nodeLocateFile() });
    ensureStorageTables(db);
    createSyncTables(db);
    const blobBytes = new Uint8Array(513).fill(0x5c);
    const blobHash = blobContentHash(blobBytes);
    insertBlob(db, {
      hash: blobHash,
      size: blobBytes.length,
      mimeType: 'application/octet-stream',
      moduleId: 'library',
      refCount: 1,
      storedAt: '2026-07-15T00:00:00.000Z',
    });
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
      adapters: new Map([['web-dest', adapter]]),
      now: () => new Date().toISOString(),
      random: () => globalThis.crypto.randomUUID(),
      payloadStore,
    });
    router.registerDestination({
      id: 'web-dest',
      kind: 'local_device',
      label: 'Browser',
      credentialRef: 'local-device:web-dest',
      capabilities: await adapter.capabilities(),
      state: 'ready',
    });
    const identity = generateDeviceIdentity('Web backup');
    const recoverable = exportRecoverableIdentity(identity);
    const { key, bytes: recoveryBytes } = generateRecoveryKey();
    const backupId = 'web-backup-roundtrip';

    const result = await runWebDatabaseBackup({
      db,
      router,
      destinationId: 'web-dest',
      backupId,
      schemaVersion: 1,
      chunkBytes: 64 * 1024,
      payloadStore,
      blobStore: {
        size: async (hash) => hash === blobHash ? blobBytes.length : null,
        readRange: async (hash, offset, length) => hash === blobHash
          ? blobBytes.subarray(offset, offset + length).slice() : null,
      },
      encoderInput: {
        recoveryKey: key,
        backupId,
        createdAt: '2026-07-15T00:00:00.000Z',
        schemaVersion: 1,
        migrationVersion: 1,
        appVersion: '1.0.0',
        dataClassVersions: {},
        sealedRecoveryBundle: sealRecovery(recoverable, recoveryBytes),
        signingIdentity: {
          deviceId: identity.publicKey,
          publicKey: hexToBytes(recoverable.publicKey),
          secretKey: hexToBytes(recoverable.signingPrivateKeyHex),
        },
      },
    });
    recoveryBytes.fill(0);
    expect(result.complete).toBe(true);
    expect(payloads.size).toBe(0);

    const manifestEnvelope = await readWebBackupManifestEnvelope(adapter, backupId);
    const opened = openBackupManifest(result.locatorJson, manifestEnvelope, key);
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw opened.error;
    const plan = createRestorePlan(opened.manifest, { mode: 'complete' });
    opened.backupRootKey.fill(0);
    const staged = new Set<string>();
    let identityStaged = false;
    const driver: RestorePlatformDriver = {
      async resetStaging() { staged.clear(); identityStaged = false; },
      async writeVerifiedChunk(requirement) { staged.add(requirement.chunkId); },
      async writeVerifiedIdentity() { identityStaged = true; },
      async rebuildStagedDatabase() { return undefined; },
      async checkStagedIntegrity() { return { passed: true, report: 'ok' }; },
      async rehearseStagedMigrations() { return { passed: true, report: 'ok' }; },
      async checkIdentityConsistency() { return { consistent: true, report: 'consistent' }; },
      async activate() {
        return { activated: true, report: 'activated', rollbackRetained: true, hadPriorData: true };
      },
    };
    const restored = await runStagedRestore({
      plan,
      destinationId: 'web-dest',
      locatorJson: result.locatorJson,
      manifestEnvelope,
      recoveryKey: key,
      source: createWebAdapterRestoreSource(adapter, backupId),
      driver,
    });

    expect(restored.state.stage).toBe('activated');
    expect(identityStaged).toBe(true);
    expect(plan.manifest.objects.map((object) => object.objectId)).toEqual([blobHash]);
    expect(staged.size).toBe(plan.requiredChunks.length);
    db.close();
  }, 30_000);
});
