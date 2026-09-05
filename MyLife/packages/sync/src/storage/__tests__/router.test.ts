import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createInMemoryTestDatabase,
  type DatabaseAdapter,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { sha256Bytes } from '../../encryption/sha256';
import { sha512Hex } from '../../node/hkdf';
import { bytesToBase64 } from '../adapters/http';
import { InMemoryStorageDestinationAdapter } from '../fakes';
import {
  STORAGE_MANIFEST_OBJECT_ID,
} from '../job-reducer';
import {
  ensureStorageTables,
  getStorageBackup,
  getStorageJob,
  getStorageObject,
  insertStorageObject,
  listStorageObjects,
  updateStorageBackupState,
  updateStorageJobState,
  updateStorageObjectState,
} from '../schema';
import {
  createStorageRouter,
  StorageRouterError,
  type RouterEncryptedStorageObject,
  type RouterStagedStorageObject,
  type StorageDestinationRouter,
  type StorageJobPayloadStore,
  type StorageRouterEvent,
} from '../router';
import type { EncryptedStorageObject, StorageResumeToken, StorageWriteResult } from '../types';
import { StorageAdapterError } from '../types';

const NOW = '2026-07-14T12:00:00.000Z';
const LATER = '2026-07-14T12:05:00.000Z';
const CAPABILITIES = {
  backgroundWrite: true,
  resumableUpload: true,
  list: true,
  delete: true,
  quota: true,
  serverChecksum: true,
  maximumObjectBytes: 1024 * 1024,
} as const;

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

function encryptedObject(
  objectId: string,
  dataClass = 'attachment',
  bytes = new Uint8Array([1, 2, 3, 4]),
): RouterEncryptedStorageObject {
  return {
    objectId,
    dataClass,
    ciphertext: bytes,
    ciphertextHash: sha512Hex(bytes),
    encryptedBytes: bytes.length,
  };
}

function manifest(bytes = new Uint8Array([9, 8, 7, 6])): RouterEncryptedStorageObject {
  return encryptedObject(STORAGE_MANIFEST_OBJECT_ID, 'backup_manifest', bytes);
}

class Sha256EvidenceAdapter extends InMemoryStorageDestinationAdapter {
  override async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    const result = await super.putObject(input, resume);
    if (!result.complete) return result;
    return {
      ...result,
      verified: true,
      verification: {
        kind: 'provider_checksum',
        algorithm: 'sha256',
        value: bytesToBase64(sha256Bytes(input.ciphertext)),
      },
    };
  }
}

async function authorize(adapter: InMemoryStorageDestinationAdapter): Promise<void> {
  const result = await adapter.authorize({ kind: 'interactive' });
  if (result.kind !== 'authorized') throw new Error('fake authorization failed');
}

function buildRouter(
  adapters: ReadonlyMap<string, InMemoryStorageDestinationAdapter>,
  options: {
    database?: DatabaseAdapter;
    now?: () => string;
    onEvent?: (event: StorageRouterEvent) => void;
    payloadStore?: StorageJobPayloadStore;
  } = {},
): StorageDestinationRouter {
  let sequence = 0;
  return createStorageRouter({
    db: options.database ?? db,
    adapters,
    now: options.now ?? (() => NOW),
    random: () => `id-${sequence += 1}`,
    onEvent: options.onEvent,
    payloadStore: options.payloadStore,
  });
}

type CheckpointFault = 'verification' | 'terminal';

function checkpointFaultDatabase(base: DatabaseAdapter): {
  adapter: DatabaseAdapter;
  arm: (fault: CheckpointFault) => void;
} {
  let armed: CheckpointFault | null = null;
  let failNextStatement = false;
  const adapter: DatabaseAdapter = {
    execute(sql, params) {
      if (failNextStatement) {
        failNextStatement = false;
        armed = null;
        throw new Error('injected atomic checkpoint fault');
      }
      base.execute(sql, params);
      if (!sql.includes('UPDATE mk_storage_jobs SET')) return;
      const isTerminal = params?.[0] === 'succeeded';
      const cursor = typeof params?.[1] === 'string' ? params[1] : '';
      const isVerification = cursor.includes('"verifiedObjects":[{')
        || !cursor.includes('"manifestVerification":null');
      if ((armed === 'terminal' && isTerminal)
        || (armed === 'verification' && !isTerminal && isVerification)) {
        failNextStatement = true;
      }
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      return base.query<T>(sql, params);
    },
    transaction(fn) {
      base.transaction(fn);
    },
  };
  return {
    adapter,
    arm(fault) {
      armed = fault;
      failNextStatement = false;
    },
  };
}

function register(
  router: StorageDestinationRouter,
  id: string,
  kind: 'local_device' | 'google_drive' | 'file_provider' = 'google_drive',
): void {
  router.registerDestination({
    id,
    kind,
    label: id,
    state: 'ready',
    capabilities: CAPABILITIES,
  });
}

describe('StorageDestinationRouter policy', () => {
  it.each([
    ['device_private_keys', 'device_private_keys_never_routable'],
    ['destination_credentials', 'destination_credentials_never_routable'],
    ['published_blob', 'published_content_uses_publication_policy'],
  ] as const)('rejects ineligible policy class %s', async (dataClass, rejectionReason) => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');

    // Act
    const action = () => router.setPolicy({
      dataClass,
      primaryDestinationId: 'remote',
      localCacheBytes: 1024,
      retention: { keep: 3 },
    });

    // Assert
    expect(action).toThrowError(expect.objectContaining({
      code: 'ineligible_data_class',
      rejectionReason,
    }));
  });

  it('canonicalizes eligible aliases to one policy row', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');

    // Act
    const policy = router.setPolicy({
      dataClass: 'database',
      primaryDestinationId: 'remote',
      localCacheBytes: 1024,
      retention: { keep: 3 },
    });

    // Assert
    expect(policy.data_class).toBe('sqlite_snapshot');
    expect(router.getPolicy('sqlite_snapshot')).toEqual(policy);
    expect(router.getPolicy('database')).toEqual(policy);
  });

  it('allows plaintext downloads only at an explicit file provider', async () => {
    // Arrange
    const localAdapter = new InMemoryStorageDestinationAdapter();
    const fileAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(localAdapter);
    await authorize(fileAdapter);
    const router = buildRouter(new Map([
      ['local', localAdapter],
      ['file', fileAdapter],
    ]));
    register(router, 'local', 'local_device');
    register(router, 'file', 'file_provider');

    // Act
    const localAction = () => router.setPolicy({
      dataClass: 'plaintext_downloads',
      primaryDestinationId: 'local',
      localCacheBytes: 0,
      retention: {},
    });
    const filePolicy = router.setPolicy({
      dataClass: 'plaintext_downloads',
      primaryDestinationId: 'file',
      localCacheBytes: 0,
      retention: {},
    });

    // Assert
    expect(localAction).toThrowError(expect.objectContaining({ code: 'invalid_policy' }));
    expect(filePolicy).toEqual(expect.objectContaining({
      data_class: 'plaintext_download',
      primary_destination_id: 'file',
    }));
  });

  it('enforces plaintext destination eligibility when a job bypasses policy lookup', async () => {
    // Arrange
    const remoteAdapter = new InMemoryStorageDestinationAdapter();
    const fileAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(remoteAdapter);
    await authorize(fileAdapter);
    const router = buildRouter(new Map([
      ['remote', remoteAdapter],
      ['file', fileAdapter],
    ]));
    register(router, 'remote');
    register(router, 'file', 'file_provider');
    const object = encryptedObject('export', 'plaintext_download');

    // Act
    const remoteAction = () => router.planBackupJob({
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [object],
      manifest: manifest(),
    });
    const fileJob = router.planBackupJob({
      destinationId: 'file',
      schemaVersion: 41,
      objects: [object],
      manifest: manifest(),
    });

    // Assert
    expect(remoteAction).toThrowError(expect.objectContaining({ code: 'invalid_policy' }));
    expect(fileJob.destination_id).toBe('file');
  });

  it('changes defaults without moving an existing verified copy', async () => {
    // Arrange
    const firstAdapter = new InMemoryStorageDestinationAdapter();
    const secondAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(firstAdapter);
    await authorize(secondAdapter);
    const router = buildRouter(new Map([
      ['first', firstAdapter],
      ['second', secondAdapter],
    ]));
    register(router, 'first');
    register(router, 'second');
    const object = encryptedObject('existing', 'database');
    const backupManifest = manifest();
    insertStorageObject(db, {
      object_id: object.objectId,
      destination_id: 'first',
      data_class: object.dataClass,
      ciphertext_hash: object.ciphertextHash,
      plaintext_hash_encrypted: null,
      encrypted_bytes: object.encryptedBytes,
      remote_ref: 'memory://existing',
      remote_version: 'v1',
      state: 'verified',
      last_verified_at: NOW,
    });
    insertStorageObject(db, {
      object_id: backupManifest.objectId,
      destination_id: 'first',
      data_class: 'backup_manifest',
      ciphertext_hash: backupManifest.ciphertextHash,
      plaintext_hash_encrypted: null,
      encrypted_bytes: backupManifest.encryptedBytes,
      remote_ref: 'memory://manifest',
      remote_version: 'v1',
      state: 'verified',
      last_verified_at: NOW,
    });
    router.setPolicy({
      dataClass: 'database',
      primaryDestinationId: 'first',
      localCacheBytes: 1024,
      retention: { keep: 2 },
    });

    // Act
    router.setPolicy({
      dataClass: 'database',
      primaryDestinationId: 'second',
      localCacheBytes: 1024,
      retention: { keep: 2 },
    });

    // Assert
    expect(getStorageObject(db, object.objectId, 'first')?.state).toBe('verified');
    expect(getStorageObject(db, object.objectId, 'second')).toBeNull();
    router.planMoveJob({
      jobId: 'explicit-move',
      sourceDestinationId: 'first',
      destinationId: 'second',
      objects: [object],
      manifest: backupManifest,
    });
    expect(getStorageObject(db, object.objectId, 'second')?.state).toBe('queued');
    expect(getStorageObject(db, object.objectId, 'first')?.state).toBe('verified');
  });
});

describe('StorageDestinationRouter jobs', () => {
  it('rolls back a split verification checkpoint and resumes it after restart', async () => {
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const fault = checkpointFaultDatabase(db);
    const router = buildRouter(new Map([['remote', adapter]]), { database: fault.adapter });
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'verification-checkpoint-job',
      backupId: 'verification-checkpoint-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('verification-checkpoint-object')],
      manifest: manifest(),
    });
    fault.arm('verification');

    await expect(router.runJob(job.id)).rejects.toThrow('injected atomic checkpoint fault');

    const rolledBack = getStorageJob(db, job.id);
    const rolledBackCursor = JSON.parse(rolledBack?.cursor_json ?? '{}') as {
      verifiedObjects?: unknown[];
      manifestVerification?: unknown;
    };
    expect(rolledBack).toMatchObject({ state: 'running' });
    expect(rolledBackCursor.verifiedObjects).toEqual([]);
    expect(rolledBackCursor.manifestVerification).toBeNull();
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verifying')).toBe(true);

    const restarted = buildRouter(new Map([['remote', adapter]]));
    const completed = await restarted.runJob(job.id);
    expect(completed.state).toBe('succeeded');
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verified')).toBe(true);
    expect(getStorageBackup(db, 'verification-checkpoint-backup', 'remote')?.state).toBe('complete');
  });

  it('rolls back terminal job truth when the dependent backup update faults', async () => {
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const fault = checkpointFaultDatabase(db);
    const router = buildRouter(new Map([['remote', adapter]]), { database: fault.adapter });
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'terminal-checkpoint-job',
      backupId: 'terminal-checkpoint-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('terminal-checkpoint-object')],
      manifest: manifest(),
    });
    fault.arm('terminal');

    await expect(router.runJob(job.id)).rejects.toThrow('injected atomic checkpoint fault');

    expect(getStorageJob(db, job.id)?.state).toBe('running');
    expect(getStorageBackup(db, 'terminal-checkpoint-backup', 'remote')?.state).toBe('verifying');
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verified')).toBe(true);

    const restarted = buildRouter(new Map([['remote', adapter]]));
    const completed = await restarted.runJob(job.id);
    expect(completed.state).toBe('succeeded');
    expect(getStorageBackup(db, 'terminal-checkpoint-backup', 'remote')).toMatchObject({
      state: 'complete',
      completed_at: NOW,
    });
  });

  it('atomically reconciles a pre-contract verification split and retries a failed repair', async () => {
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'legacy-split-job',
      backupId: 'legacy-split-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('legacy-split-object')],
      manifest: manifest(),
    });
    await router.runJob(job.id);
    updateStorageObjectState(db, 'legacy-split-object', 'remote', 'verifying');
    updateStorageObjectState(db, STORAGE_MANIFEST_OBJECT_ID, 'remote', 'verifying');
    updateStorageBackupState(db, 'legacy-split-backup', 'remote', 'verifying');
    const legacyCursor = JSON.parse(getStorageJob(db, job.id)?.cursor_json ?? '{}') as {
      phase?: string | null;
    };
    legacyCursor.phase = 'verifying';
    db.execute('UPDATE mk_storage_jobs SET cursor_json = ? WHERE id = ?', [
      JSON.stringify(legacyCursor),
      job.id,
    ]);
    updateStorageJobState(db, job.id, 'running', NOW);

    const fault = checkpointFaultDatabase(db);
    fault.arm('verification');
    expect(() => buildRouter(new Map([['remote', adapter]]), { database: fault.adapter }))
      .toThrow('injected atomic checkpoint fault');
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verifying')).toBe(true);
    expect(getStorageBackup(db, 'legacy-split-backup', 'remote')?.state).toBe('verifying');

    const restarted = buildRouter(new Map([['remote', adapter]]));
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verified')).toBe(true);
    expect(getStorageBackup(db, 'legacy-split-backup', 'remote')?.state).toBe('verifying');
    const completed = await restarted.runJob(job.id);
    expect(completed.state).toBe('succeeded');
    expect(getStorageBackup(db, 'legacy-split-backup', 'remote')).toMatchObject({
      state: 'complete',
      completed_at: NOW,
    });
  });

  it('reconciles a pre-contract terminal job and backup split at startup', async () => {
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'legacy-terminal-job',
      backupId: 'legacy-terminal-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('legacy-terminal-object')],
      manifest: manifest(),
    });
    await router.runJob(job.id);
    updateStorageBackupState(db, 'legacy-terminal-backup', 'remote', 'verifying');

    buildRouter(new Map([['remote', adapter]]));

    expect(getStorageJob(db, job.id)?.state).toBe('succeeded');
    expect(getStorageBackup(db, 'legacy-terminal-backup', 'remote')).toMatchObject({
      state: 'complete',
      completed_at: NOW,
    });
  });

  it('rehydrates a staged backup after the router process restarts', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const staged = new Map<string, Uint8Array>();
    const payloadStore: StorageJobPayloadStore = {
      async put(jobId, object) { staged.set(`${jobId}:${object.objectId}`, object.ciphertext.slice()); },
      async get(jobId, objectId) { return staged.get(`${jobId}:${objectId}`)?.slice() ?? null; },
      async deleteJob(jobId) {
        for (const key of staged.keys()) if (key.startsWith(`${jobId}:`)) staged.delete(key);
      },
    };
    const object = encryptedObject('durable-object');
    const secondObject = encryptedObject('durable-object-two');
    const backupManifest = manifest();
    await payloadStore.put('payload-restart', object);
    await payloadStore.put('payload-restart', secondObject);
    await payloadStore.put('payload-restart', backupManifest);
    const descriptor = (value: RouterEncryptedStorageObject): RouterStagedStorageObject => ({
      objectId: value.objectId,
      dataClass: value.dataClass,
      ciphertextHash: value.ciphertextHash,
      encryptedBytes: value.encryptedBytes,
    });
    let firstRouter: StorageDestinationRouter | null = null;
    let paused = false;
    firstRouter = buildRouter(new Map([['remote', adapter]]), {
      payloadStore,
      onEvent: (event) => {
        if (!paused && event.type === 'job_transition' && event.completedObjects === 1) {
          paused = true;
          firstRouter?.pauseJob(event.jobId);
        }
      },
    });
    register(firstRouter, 'remote');
    const planned = firstRouter.planBackupJob({
      jobId: 'restart-job',
      payloadSourceJobId: 'payload-restart',
      backupId: 'backup-restart',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [descriptor(object), descriptor(secondObject)],
      manifest: descriptor(backupManifest),
    });

    // Act
    const interrupted = await firstRouter.runJob(planned.id);
    const restartedRouter = buildRouter(new Map([['remote', adapter]]), { payloadStore });
    const recovered = restartedRouter.getJob(planned.id);
    restartedRouter.resumeJob(planned.id);
    const completed = await restartedRouter.runJob(planned.id);

    // Assert
    expect(interrupted.state).toBe('paused');
    expect(recovered).toMatchObject({ id: planned.id, state: 'paused', completed_objects: 1 });
    expect(completed.state).toBe('succeeded');
    expect(getStorageBackup(db, 'backup-restart', 'remote')?.state).toBe('complete');
  });

  it('completes a backup only after every object and manifest verifies', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const objects = [
      encryptedObject('object-a'),
      encryptedObject('object-b', 'library_object', new Uint8Array([5, 6, 7])),
    ];
    const job = router.planBackupJob({
      jobId: 'backup-job',
      backupId: 'backup-1',
      destinationId: 'remote',
      schemaVersion: 41,
      objects,
      manifest: manifest(),
    });

    // Act
    const completed = await router.runJob(job.id);

    // Assert
    expect(completed.state).toBe('succeeded');
    expect(listStorageObjects(db, 'remote')).toHaveLength(3);
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verified')).toBe(true);
    expect(getStorageBackup(db, 'backup-1', 'remote')).toMatchObject({
      state: 'complete',
      object_count: 2,
      manifest_ref: 'memory://manifest.mkmanifest',
    });
  });

  it('accepts a provider-validated SHA-256 checksum for the exact ciphertext', async () => {
    const adapter = new Sha256EvidenceAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'sha256-checksum-job',
      backupId: 'sha256-checksum-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('sha256-object')],
      manifest: manifest(),
    });

    const completed = await router.runJob(job.id);

    expect(completed.state).toBe('succeeded');
    expect(completed.manifest_verification).toMatchObject({
      kind: 'provider_checksum',
      algorithm: 'sha256',
    });
    expect(getStorageObject(db, 'sha256-object', 'remote')?.state).toBe('verified');
  });

  it("keeps a backup incomplete when verification evidence is 'none'", async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter({ verification: 'none' });
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'unverified-job',
      backupId: 'backup-unverified',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('unverified-object')],
      manifest: manifest(),
    });

    // Act
    const completed = await router.runJob(job.id);

    // Assert
    expect(completed.state).toBe('partial');
    expect(completed.verified_objects).toEqual([]);
    expect(completed.manifest_verification).toBeNull();
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verifying')).toBe(true);
    expect(getStorageBackup(db, 'backup-unverified', 'remote')?.state).toBe('verifying');
  });

  it('allows an explicit verify job to establish read-back evidence later', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter({ verification: 'none' });
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const backupJob = router.planBackupJob({
      jobId: 'deferred-verify-backup',
      backupId: 'backup-deferred-verify',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('deferred-object')],
      manifest: manifest(),
    });
    await router.runJob(backupJob.id);
    const verifyJob = router.planVerifyJob({
      jobId: 'explicit-verify-job',
      backupId: 'backup-deferred-verify',
      destinationId: 'remote',
    });

    // Act
    const completed = await router.runJob(verifyJob.id);

    // Assert
    expect(completed.state).toBe('succeeded');
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'verified')).toBe(true);
    expect(getStorageBackup(db, 'backup-deferred-verify', 'remote')?.state).toBe('complete');
  });

  it('reuses the persisted provider session after a mid-upload pause', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    adapter.setPartialPutBytes(2);
    await authorize(adapter);
    const originalPut = adapter.putObject.bind(adapter);
    let firstSession: string | null = null;
    let reusedSession = false;
    adapter.putObject = async (object, resume) => {
      if (resume !== undefined && firstSession !== null && resume.providerSession === firstSession) {
        reusedSession = true;
      }
      const result = await originalPut(object, resume);
      if (!result.complete && firstSession === null) firstSession = result.resumeToken.providerSession;
      return result;
    };
    let router: StorageDestinationRouter | null = null;
    let pausedOnce = false;
    const onEvent = (event: StorageRouterEvent): void => {
      if (
        !pausedOnce
        && event.type === 'job_transition'
        && event.eventType === 'checkpoint'
        && event.completedObjects === 0
      ) {
        pausedOnce = true;
        router?.pauseJob(event.jobId);
      }
    };
    router = buildRouter(new Map([['remote', adapter]]), { onEvent });
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'resume-job',
      backupId: 'backup-resume',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('large-object', 'attachment', new Uint8Array([1, 2, 3, 4, 5, 6]))],
      manifest: manifest(new Uint8Array([7, 8, 9, 10])),
    });

    // Act
    const paused = await router.runJob(job.id);
    const pausedCursor = getStorageJob(db, job.id)?.cursor_json;
    router.resumeJob(job.id);
    const completed = await router.runJob(job.id);

    // Assert
    expect(paused.state).toBe('paused');
    expect(firstSession).not.toBeNull();
    expect(pausedCursor).toContain('providerSession');
    expect(reusedSession).toBe(true);
    expect(completed.state).toBe('succeeded');
  });

  it('stops on quota without deleting local or mirror copies', async () => {
    // Arrange
    const targetAdapter = new InMemoryStorageDestinationAdapter({ quotaCapBytes: 2 });
    const localAdapter = new InMemoryStorageDestinationAdapter();
    const mirrorAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(targetAdapter);
    await authorize(localAdapter);
    await authorize(mirrorAdapter);
    let deletes = 0;
    const originalDelete = targetAdapter.deleteObject.bind(targetAdapter);
    targetAdapter.deleteObject = async (ref) => {
      deletes += 1;
      return originalDelete(ref);
    };
    const router = buildRouter(new Map([
      ['target', targetAdapter],
      ['local', localAdapter],
      ['mirror', mirrorAdapter],
    ]));
    register(router, 'target');
    register(router, 'local', 'local_device');
    register(router, 'mirror');
    const object = encryptedObject('quota-object');
    for (const destinationId of ['local', 'mirror']) {
      insertStorageObject(db, {
        object_id: object.objectId,
        destination_id: destinationId,
        data_class: object.dataClass,
        ciphertext_hash: object.ciphertextHash,
        plaintext_hash_encrypted: null,
        encrypted_bytes: object.encryptedBytes,
        remote_ref: `${destinationId}://quota-object`,
        remote_version: 'v1',
        state: 'verified',
        last_verified_at: NOW,
      });
    }
    const job = router.planBackupJob({
      jobId: 'quota-job',
      backupId: 'backup-quota',
      destinationId: 'target',
      schemaVersion: 41,
      objects: [object],
      manifest: manifest(),
    });

    // Act
    const action = router.runJob(job.id);

    // Assert
    await expect(action).rejects.toMatchObject({
      code: 'quota_exceeded',
      requiredBytes: object.encryptedBytes + manifest().encryptedBytes,
    });
    expect(getStorageJob(db, job.id)).toMatchObject({ state: 'paused', last_error_code: 'quota_exceeded' });
    expect(getStorageObject(db, object.objectId, 'local')?.state).toBe('verified');
    expect(getStorageObject(db, object.objectId, 'mirror')?.state).toBe('verified');
    expect(deletes).toBe(0);
  });

  it('honors a persisted cancellation before starting any adapter write', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'cancel-before-run',
      backupId: 'backup-cancel-before-run',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('never-written')],
      manifest: manifest(),
    });
    updateStorageJobState(db, job.id, 'cancelled', NOW);

    // Act
    const completed = await router.runJob(job.id);

    // Assert
    expect(completed.state).toBe('cancelled');
    expect(await adapter.headObject({ objectId: 'never-written' })).toBeNull();
    expect(getStorageObject(db, 'never-written', 'remote')?.state).toBe('queued');
  });

  it('preserves a corrupt backup state after the write loop finishes', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    adapter.failNext(
      'putObject',
      new StorageAdapterError('corrupt_ciphertext', 'injected corruption', false),
    );
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'corrupt-job',
      backupId: 'backup-corrupt-router',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('corrupt-object')],
      manifest: manifest(),
    });

    // Act
    const completed = await router.runJob(job.id);

    // Assert
    expect(completed.state).toBe('partial');
    expect(getStorageBackup(db, 'backup-corrupt-router', 'remote')?.state).toBe('corrupt');
  });

  it('reports an exact mirror partial without invalidating the primary', async () => {
    // Arrange
    const primaryAdapter = new InMemoryStorageDestinationAdapter();
    const mirrorAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(primaryAdapter);
    await authorize(mirrorAdapter);
    const router = buildRouter(new Map([
      ['primary', primaryAdapter],
      ['mirror', mirrorAdapter],
    ]));
    register(router, 'primary');
    register(router, 'mirror');
    const object = encryptedObject('mirror-object');
    const backupManifest = manifest();
    const primaryJob = router.planBackupJob({
      jobId: 'primary-job',
      backupId: 'backup-mirror',
      destinationId: 'primary',
      schemaVersion: 41,
      objects: [object],
      manifest: backupManifest,
    });
    await router.runJob(primaryJob.id);
    mirrorAdapter.failNext(
      'putObject',
      new StorageAdapterError('provider_error', 'injected mirror failure', false),
    );
    const mirrorJob = router.planMirrorJob({
      jobId: 'mirror-job',
      backupId: 'backup-mirror',
      primaryDestinationId: 'primary',
      destinationId: 'mirror',
      schemaVersion: 41,
      objects: [object],
      manifest: backupManifest,
    });

    // Act
    const completed = await router.runJob(mirrorJob.id);

    // Assert
    expect(completed.state).toBe('partial');
    const cursor = JSON.parse(getStorageJob(db, mirrorJob.id)?.cursor_json ?? '{}') as {
      missingObjectIds?: string[];
    };
    expect(cursor.missingObjectIds).toEqual(['mirror-object']);
    expect(listStorageObjects(db, 'primary').every((row) => row.state === 'verified')).toBe(true);
    expect(getStorageBackup(db, 'backup-mirror', 'primary')?.state).toBe('complete');
    expect(getStorageBackup(db, 'backup-mirror', 'mirror')?.state).toBe('verifying');
  });

  it('deletes a move source only after the destination verifies', async () => {
    // Arrange
    const sourceAdapter = new InMemoryStorageDestinationAdapter();
    const destinationAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(sourceAdapter);
    await authorize(destinationAdapter);
    const router = buildRouter(new Map([
      ['source', sourceAdapter],
      ['destination', destinationAdapter],
    ]));
    register(router, 'source');
    register(router, 'destination');
    const object = encryptedObject('move-object');
    const backupManifest = manifest();
    const sourceJob = router.planBackupJob({
      jobId: 'move-source-job',
      backupId: 'backup-move',
      destinationId: 'source',
      schemaVersion: 41,
      objects: [object],
      manifest: backupManifest,
    });
    await router.runJob(sourceJob.id);
    const moveJob = router.planMoveJob({
      jobId: 'move-target-job',
      backupId: 'backup-move',
      schemaVersion: 41,
      sourceDestinationId: 'source',
      destinationId: 'destination',
      objects: [object],
      manifest: backupManifest,
    });

    // Act
    const completed = await router.runJob(moveJob.id);

    // Assert
    expect(completed.state).toBe('succeeded');
    expect(listStorageObjects(db, 'destination').every((row) => row.state === 'verified')).toBe(true);
    expect(listStorageObjects(db, 'source').every((row) => row.state === 'deleted')).toBe(true);
    expect(getStorageBackup(db, 'backup-move', 'destination')?.state).toBe('complete');
    expect(getStorageBackup(db, 'backup-move', 'source')?.state).toBe('deleted');
  });

  it('streams verified restore ciphertext through the injected staging callback', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const backupJob = router.planBackupJob({
      jobId: 'restore-source-job',
      backupId: 'backup-restore-router',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('restore-object')],
      manifest: manifest(),
    });
    await router.runJob(backupJob.id);
    const stagedObjectIds: string[] = [];
    const restoreJob = router.planRestoreJob({
      jobId: 'restore-read-job',
      backupId: 'backup-restore-router',
      destinationId: 'remote',
      onCiphertext: (row) => {
        stagedObjectIds.push(row.object_id);
      },
    });

    // Act
    const completed = await router.runJob(restoreJob.id);

    // Assert
    expect(completed.state).toBe('succeeded');
    expect(stagedObjectIds).toEqual(['restore-object', STORAGE_MANIFEST_OBJECT_ID]);
  });

  it('verifies remote absence before completing an explicit delete job', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const backupJob = router.planBackupJob({
      jobId: 'delete-source-job',
      backupId: 'backup-delete-router',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('delete-object')],
      manifest: manifest(),
    });
    await router.runJob(backupJob.id);
    const deleteJob = router.planDeleteJob({
      jobId: 'delete-job',
      backupId: 'backup-delete-router',
      destinationId: 'remote',
    });

    // Act
    const completed = await router.runJob(deleteJob.id);

    // Assert
    expect(completed.state).toBe('succeeded');
    expect(listStorageObjects(db, 'remote').every((row) => row.state === 'deleted')).toBe(true);
    expect(getStorageBackup(db, 'backup-delete-router', 'remote')?.state).toBe('deleted');
    expect(await adapter.headObject({ objectId: 'delete-object' })).toBeNull();
  });

  it('refuses new writes to a revoked destination', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    router.updateDestinationState('remote', 'revoked');

    // Act
    const action = () => router.planBackupJob({
      jobId: 'revoked-new-job',
      backupId: 'revoked-new-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('blocked')],
      manifest: manifest(),
    });

    // Assert
    expect(action).toThrowError(expect.objectContaining({ code: 'destination_not_ready' }));
  });

  it('pauses a running job with auth_required when its destination is revoked', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    adapter.setPartialPutBytes(2);
    await authorize(adapter);
    let router: StorageDestinationRouter | null = null;
    let revoked = false;
    const onEvent = (event: StorageRouterEvent): void => {
      if (!revoked && event.type === 'job_transition' && event.eventType === 'checkpoint') {
        revoked = true;
        router?.updateDestinationState('remote', 'revoked');
      }
    };
    router = buildRouter(new Map([['remote', adapter]]), { onEvent });
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'revoked-running-job',
      backupId: 'revoked-running-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('in-flight', 'attachment', new Uint8Array([1, 2, 3, 4, 5]))],
      manifest: manifest(),
    });

    // Act
    const stopped = await router.runJob(job.id);

    // Assert
    expect(stopped.state).toBe('paused');
    expect(stopped.last_error_code).toBe('auth_required');
    expect(getStorageJob(db, job.id)).toMatchObject({ state: 'paused', last_error_code: 'auth_required' });
  });
});

describe('StorageDestinationRouter health and eviction', () => {
  it('does not claim verified read-write health before real adapter evidence', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    let currentTime = NOW;
    const router = buildRouter(new Map([['remote', adapter]]), { now: () => currentTime });
    register(router, 'remote');

    // Act
    const before = await router.checkHealth('remote', { force: true });
    const job = router.planBackupJob({
      jobId: 'health-job',
      backupId: 'health-backup',
      destinationId: 'remote',
      schemaVersion: 41,
      objects: [encryptedObject('health-object')],
      manifest: manifest(),
    });
    await router.runJob(job.id);
    currentTime = LATER;
    const after = await router.checkHealth('remote', { refresh: true });

    // Assert
    expect(before.verified_read_write).toBe(0);
    expect(after.verified_read_write).toBe(1);
  });

  it('uses fresh cached health unless manual refresh is requested', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const first = await router.checkHealth('remote', { force: true });
    adapter.failNext('health', new StorageAdapterError('unreachable', 'offline', true));

    // Act
    const cached = await router.checkHealth('remote');
    const refreshed = await router.checkHealth('remote', true);

    // Assert
    expect(first.state).toBe('ok');
    expect(cached).toEqual(first);
    expect(refreshed).toMatchObject({
      state: 'unreachable',
      verified_read_write: 0,
      error_code: 'unreachable',
    });
  });

  it('never returns cached healthy evidence after explicit revocation', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    await router.checkHealth('remote', { force: true });
    router.updateDestinationState('remote', 'revoked');

    // Act
    const health = await router.checkHealth('remote');

    // Assert
    expect(health).toMatchObject({
      state: 'revoked',
      verified_read_write: 0,
      error_code: 'revoked',
    });
  });

  it('allows local eviction only with a usable verified remote copy or force', async () => {
    // Arrange
    const localAdapter = new InMemoryStorageDestinationAdapter();
    const remoteAdapter = new InMemoryStorageDestinationAdapter();
    await authorize(localAdapter);
    await authorize(remoteAdapter);
    const router = buildRouter(new Map([
      ['local', localAdapter],
      ['remote', remoteAdapter],
    ]));
    register(router, 'local', 'local_device');
    register(router, 'remote');
    const object = encryptedObject('eviction-object');
    insertStorageObject(db, {
      object_id: object.objectId,
      destination_id: 'local',
      data_class: object.dataClass,
      ciphertext_hash: object.ciphertextHash,
      plaintext_hash_encrypted: null,
      encrypted_bytes: object.encryptedBytes,
      remote_ref: 'local://eviction-object',
      remote_version: 'v1',
      state: 'verified',
      last_verified_at: NOW,
    });

    // Act
    const onlyLocal = router.canEvictLocalCopy(object.objectId);
    const forced = router.canEvictLocalCopy(object.objectId, { force: true });
    insertStorageObject(db, {
      object_id: object.objectId,
      destination_id: 'remote',
      data_class: object.dataClass,
      ciphertext_hash: object.ciphertextHash,
      plaintext_hash_encrypted: null,
      encrypted_bytes: object.encryptedBytes,
      remote_ref: 'remote://eviction-object',
      remote_version: 'v1',
      state: 'writing',
      last_verified_at: null,
    });
    const unverifiedRemote = router.canEvictLocalCopy(object.objectId);
    updateStorageObjectState(db, object.objectId, 'remote', 'verified', LATER);
    const verifiedRemote = router.canEvictLocalCopy(object.objectId);

    // Assert
    expect({ onlyLocal, forced, unverifiedRemote, verifiedRemote }).toEqual({
      onlyLocal: false,
      forced: true,
      unverifiedRemote: false,
      verifiedRemote: true,
    });
  });
});

it('surfaces a typed quota error instance', () => {
  // Arrange
  const error = new StorageRouterError('quota_exceeded', 'quota', { requiredBytes: 12 });

  // Act
  const isTyped = error instanceof StorageRouterError;

  // Assert
  expect(isTyped).toBe(true);
  expect(error.requiredBytes).toBe(12);
});
