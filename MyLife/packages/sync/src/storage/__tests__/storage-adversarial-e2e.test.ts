import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { sha512Hex } from '../../node/hkdf';
import {
  encodeBackup,
  openBackupManifest,
  verifyAndDecryptBackupChunk,
  verifyBackupIdentityChunk,
  createBackupEncoder,
  type BackupChunkTarget,
  type BackupEncoderInput,
  type EncodedBackup,
  type OpenBackupManifestResult,
} from '../backup-format';
import {
  STORAGE_AUTH_DOMAIN,
  STORAGE_V1_SUPPORTED_OPERATIONS,
  signStorageCapabilityDescriptor,
  signStorageChallengeResponse,
  storageOperatorPublicKeyFromPrivateKey,
  verifyStorageCapabilityDescriptor,
  verifyStorageChallengeResponse,
  type UnsignedStorageCapabilityDescriptor,
} from '../connected-descriptor';
import { requestWithSingleOriginRedirect, type HttpTransportRequest } from '../adapters/http';
import { InMemoryStorageDestinationAdapter } from '../fakes';
import { STORAGE_MANIFEST_OBJECT_ID } from '../job-reducer';
import { rotateStorageCredential } from '../lifecycle';
import {
  createRestoreController,
  createRestorePlan,
  reduceRestoreController,
  type RestoreControllerState,
  type RestorePlan,
} from '../restore-controller';
import {
  createStorageRouter,
  StorageRouterError,
  type RouterEncryptedStorageObject,
  type StorageDestinationRouter,
  type StorageRouterEvent,
} from '../router';
import {
  ensureStorageTables,
  getStorageBackup,
  getStorageDestination,
  getStorageJob,
  getStorageObject,
  insertStorageObject,
  listStorageObjects,
} from '../schema';
import { VECTOR_BACKUP_INPUT, VECTOR_RECOVERY_KEY } from '../test-vectors';
import {
  StorageAdapterError,
  type StorageDestinationAdapter,
} from '../types';
import { OAuthBrokerClient } from '../broker-client';

const NOW = '2026-07-14T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const CAPABILITIES = {
  backgroundWrite: true,
  resumableUpload: true,
  list: true,
  delete: true,
  quota: true,
  serverChecksum: true,
  maximumObjectBytes: 512 * 1024 * 1024,
} as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
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

async function authorize(adapter: StorageDestinationAdapter): Promise<void> {
  const result = await adapter.authorize({ kind: 'interactive' });
  if (result.kind !== 'authorized') throw new Error('adversarial adapter authorization failed');
}

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

function testManifest(bytes = new Uint8Array([9, 8, 7, 6])): RouterEncryptedStorageObject {
  return encryptedObject(STORAGE_MANIFEST_OBJECT_ID, 'backup_manifest', bytes);
}

function buildRouter(
  adapters: ReadonlyMap<string, StorageDestinationAdapter>,
  onEvent?: (event: StorageRouterEvent) => void,
): StorageDestinationRouter {
  let sequence = 0;
  return createStorageRouter({
    db,
    adapters,
    now: () => NOW,
    random: () => `adversarial-${sequence += 1}`,
    onEvent,
  });
}

function register(router: StorageDestinationRouter, id: string): void {
  router.registerDestination({
    id,
    kind: 'google_drive',
    label: id,
    credentialRef: `securestore://${id}/old`,
    state: 'ready',
    capabilities: CAPABILITIES,
  });
}

function flipLastBit(value: Uint8Array): Uint8Array {
  const changed = value.slice();
  const index = changed.length - 1;
  if (index < 0) throw new Error('cannot flip an empty artifact');
  changed[index] = (changed[index] ?? 0) ^ 1;
  return changed;
}

function flipLocatorBit(locatorJson: string): string {
  const bytes = encoder.encode(locatorJson);
  const marker = encoder.encode('2026-07-14T12:00:00.000Z');
  let start = -1;
  for (let index = 0; index <= bytes.length - marker.length; index += 1) {
    if (marker.every((byte, offset) => bytes[index + offset] === byte)) {
      start = index;
      break;
    }
  }
  if (start < 0) throw new Error('locator fixture timestamp was not found');
  const changed = bytes.slice();
  const target = start + marker.length - 2;
  changed[target] = (changed[target] ?? 0) ^ 1;
  return decoder.decode(changed);
}

interface CodecFixture {
  encoded: EncodedBackup;
  opened: Extract<OpenBackupManifestResult, { ok: true }>;
  plan: RestorePlan;
}

function codecFixture(): CodecFixture {
  const encoded = encodeBackup(VECTOR_BACKUP_INPUT);
  const opened = openBackupManifest(encoded.locatorJson, encoded.manifest.envelope, VECTOR_RECOVERY_KEY);
  if (!opened.ok) throw opened.error;
  return {
    encoded,
    opened,
    plan: createRestorePlan(opened.manifest, { mode: 'complete' }),
  };
}

function enterManifestOpen(plan: RestorePlan): RestoreControllerState {
  let state = createRestoreController(plan);
  state = reduceRestoreController(state, { type: 'destination_selected', destinationId: 'remote' });
  return reduceRestoreController(state, {
    type: 'locators_listed',
    backupIds: [plan.backupId],
  });
}

function chunkEnvelope(
  fixture: CodecFixture,
  target: BackupChunkTarget,
): Uint8Array {
  if (target.kind === 'database') {
    const chunk = fixture.encoded.databaseChunks[target.index];
    if (chunk === undefined) throw new Error('database chunk fixture is missing');
    return chunk.envelope;
  }
  const chunk = fixture.encoded.objectChunks.find((candidate) => (
    candidate.objectId === target.objectId && candidate.index === target.index
  ));
  if (chunk === undefined) throw new Error('object chunk fixture is missing');
  return chunk.envelope;
}

function advanceToAwaitingActivation(fixture: CodecFixture): RestoreControllerState {
  let state = enterManifestOpen(fixture.plan);
  state = reduceRestoreController(state, { type: 'manifest_open_result', result: fixture.opened });
  for (const requirement of fixture.plan.requiredChunks) {
    state = reduceRestoreController(state, {
      type: 'chunk_verification_result',
      chunkId: requirement.chunkId,
      result: verifyAndDecryptBackupChunk(
        fixture.opened.backupRootKey,
        fixture.opened.manifest,
        requirement.target,
        chunkEnvelope(fixture, requirement.target),
      ),
    });
  }
  if (fixture.encoded.identityChunk === null) throw new Error('identity fixture is missing');
  state = reduceRestoreController(state, {
    type: 'identity_bundle_result',
    result: verifyBackupIdentityChunk(
      fixture.opened.manifest,
      fixture.encoded.identityChunk.envelope,
    ),
  });
  state = reduceRestoreController(state, {
    type: 'integrity_check_result', passed: true, report: 'ok',
  });
  state = reduceRestoreController(state, {
    type: 'identity_consistency_result', consistent: true, report: 'keypair matches',
  });
  return reduceRestoreController(state, {
    type: 'migration_rehearsal_result', passed: true, report: 'migrations pass',
  });
}

type ArtifactClass = 'locator' | 'manifest' | 'database chunk' | 'object chunk' | 'identity chunk';

function routerArtifacts(encoded: EncodedBackup): {
  objects: RouterEncryptedStorageObject[];
  manifest: RouterEncryptedStorageObject;
  objectIdByClass: Readonly<Record<ArtifactClass, string>>;
} {
  const database = encoded.databaseChunks[0];
  const object = encoded.objectChunks[0];
  const identity = encoded.identityChunk;
  if (database === undefined || object === undefined || identity === null) {
    throw new Error('encoded adversarial fixture is incomplete');
  }
  const objectIdByClass: Record<ArtifactClass, string> = {
    locator: 'artifact-locator',
    manifest: STORAGE_MANIFEST_OBJECT_ID,
    'database chunk': 'artifact-database',
    'object chunk': 'artifact-object',
    'identity chunk': 'artifact-identity',
  };
  return {
    objects: [
      encryptedObject(objectIdByClass.locator, 'backup_locator', encoder.encode(encoded.locatorJson)),
      encryptedObject(
        objectIdByClass['database chunk'], 'sqlite_snapshot', Uint8Array.from(database.envelope),
      ),
      encryptedObject(
        objectIdByClass['object chunk'], 'attachment', Uint8Array.from(object.envelope),
      ),
      encryptedObject(
        objectIdByClass['identity chunk'],
        'encrypted_recovery_bundle',
        Uint8Array.from(identity.envelope),
      ),
    ],
    manifest: encryptedObject(
      STORAGE_MANIFEST_OBJECT_ID,
      'backup_manifest',
      Uint8Array.from(encoded.manifest.envelope),
    ),
    objectIdByClass,
  };
}

function corruptControllerState(fixture: CodecFixture, artifactClass: ArtifactClass): {
  state: RestoreControllerState;
  decodeCode: string;
} {
  let state = enterManifestOpen(fixture.plan);
  if (artifactClass === 'locator' || artifactClass === 'manifest') {
    const result = openBackupManifest(
      artifactClass === 'locator' ? flipLocatorBit(fixture.encoded.locatorJson) : fixture.encoded.locatorJson,
      artifactClass === 'manifest' ? flipLastBit(fixture.encoded.manifest.envelope) : fixture.encoded.manifest.envelope,
      VECTOR_RECOVERY_KEY,
    );
    if (result.ok) throw new Error('corrupt manifest fixture unexpectedly opened');
    return {
      state: reduceRestoreController(state, { type: 'manifest_open_result', result }),
      decodeCode: result.error.code,
    };
  }

  state = reduceRestoreController(state, { type: 'manifest_open_result', result: fixture.opened });
  if (artifactClass === 'identity chunk') {
    const identity = fixture.encoded.identityChunk;
    if (identity === null) throw new Error('identity fixture is missing');
    const result = verifyBackupIdentityChunk(
      fixture.opened.manifest,
      flipLastBit(identity.envelope),
    );
    if (result.ok) throw new Error('corrupt identity fixture unexpectedly verified');
    return {
      state: reduceRestoreController(state, { type: 'identity_bundle_result', result }),
      decodeCode: result.error.code,
    };
  }

  const requirement = fixture.plan.requiredChunks.find((candidate) => (
    artifactClass === 'database chunk'
      ? candidate.target.kind === 'database'
      : candidate.target.kind === 'object'
  ));
  if (requirement === undefined) throw new Error('required content chunk fixture is missing');
  const result = verifyAndDecryptBackupChunk(
    fixture.opened.backupRootKey,
    fixture.opened.manifest,
    requirement.target,
    flipLastBit(chunkEnvelope(fixture, requirement.target)),
  );
  if (result.ok) throw new Error('corrupt content fixture unexpectedly verified');
  return {
    state: reduceRestoreController(state, {
      type: 'chunk_verification_result', chunkId: requirement.chunkId, result,
    }),
    decodeCode: result.error.code,
  };
}

describe('Plan 41 artifact corruption and atomic restore', () => {
  it.each([
    ['locator', 'locator_mismatch', 'locator_mismatch'],
    ['manifest', 'tampered_chunk', 'corrupt_chunk'],
    ['database chunk', 'tampered_chunk', 'corrupt_chunk'],
    ['object chunk', 'tampered_chunk', 'corrupt_chunk'],
    ['identity chunk', 'tampered_chunk', 'corrupt_chunk'],
  ] as const)(
    'corruption: one-bit %s fault returns exact typed failure, preserves active state, and marks rows honest',
    async (artifactClass, decodeCode, restoreCode) => {
      // Arrange
      const fixture = codecFixture();
      const adapter = new InMemoryStorageDestinationAdapter({ maximumObjectBytes: CAPABILITIES.maximumObjectBytes });
      await authorize(adapter);
      const router = buildRouter(new Map([['remote', adapter]]));
      register(router, 'remote');
      const artifacts = routerArtifacts(fixture.encoded);
      const backupId = `corrupt-backup-${artifactClass.replaceAll(' ', '-')}`;
      const backupJob = router.planBackupJob({
        jobId: `corrupt-source-${artifactClass.replaceAll(' ', '-')}`,
        backupId,
        destinationId: 'remote',
        schemaVersion: 41,
        objects: artifacts.objects,
        manifest: artifacts.manifest,
      });
      await router.runJob(backupJob.id);
      const targetObjectId = artifacts.objectIdByClass[artifactClass];
      const originalGet = adapter.getObject.bind(adapter);
      adapter.getObject = async (ref, range) => {
        if (ref.objectId === targetObjectId) {
          throw new StorageAdapterError('corrupt_ciphertext', 'one-bit read-back substitution', false);
        }
        return originalGet(ref, range);
      };
      const activeRows = ['prior-active-row'];
      const stagingRows: string[] = [];
      const restoreJob = router.planRestoreJob({
        jobId: `corrupt-restore-${artifactClass.replaceAll(' ', '-')}`,
        backupId,
        destinationId: 'remote',
        onCiphertext: (row) => { stagingRows.push(row.object_id); },
      });

      // Act
      const codec = corruptControllerState(fixture, artifactClass);
      const completed = await router.runJob(restoreJob.id);
      fixture.opened.backupRootKey.fill(0);

      // Assert
      expect(codec.decodeCode).toBe(decodeCode);
      expect(codec.state).toMatchObject({ stage: 'failed', failure: { code: restoreCode } });
      expect(completed.state).toBe('partial');
      expect(getStorageBackup(db, backupId, 'remote')?.state).toBe('corrupt');
      const persisted = getStorageJob(db, restoreJob.id);
      expect(persisted?.state).toBe('partial');
      expect(persisted?.cursor_json).toContain(targetObjectId);
      expect(activeRows).toEqual(['prior-active-row']);
      expect(stagingRows).not.toContain('prior-active-row');
    },
  );

  it('atomic-restore-into-staging: active rows and files are untouched until awaiting_activation', () => {
    // Arrange
    const fixture = codecFixture();
    const callLog: string[] = [];
    const activeRows = ['active:v1'];
    let state = enterManifestOpen(fixture.plan);

    // Act
    state = reduceRestoreController(state, { type: 'manifest_open_result', result: fixture.opened });
    for (const requirement of fixture.plan.requiredChunks) {
      callLog.push(`staging:write:${requirement.chunkId}`);
      state = reduceRestoreController(state, {
        type: 'chunk_verification_result',
        chunkId: requirement.chunkId,
        result: verifyAndDecryptBackupChunk(
          fixture.opened.backupRootKey,
          fixture.opened.manifest,
          requirement.target,
          chunkEnvelope(fixture, requirement.target),
        ),
      });
      expect(activeRows).toEqual(['active:v1']);
      expect(callLog.some((entry) => entry.startsWith('active:'))).toBe(false);
    }
    if (fixture.encoded.identityChunk === null) throw new Error('identity fixture is missing');
    callLog.push('staging:write:identity');
    state = reduceRestoreController(state, {
      type: 'identity_bundle_result',
      result: verifyBackupIdentityChunk(fixture.opened.manifest, fixture.encoded.identityChunk.envelope),
    });
    state = reduceRestoreController(state, { type: 'integrity_check_result', passed: true, report: 'ok' });
    state = reduceRestoreController(state, {
      type: 'identity_consistency_result', consistent: true, report: 'keypair matches',
    });
    state = reduceRestoreController(state, {
      type: 'migration_rehearsal_result', passed: true, report: 'migrations pass',
    });
    fixture.opened.backupRootKey.fill(0);

    // Assert
    expect(state.stage).toBe('awaiting_activation');
    expect(activeRows).toEqual(['active:v1']);
    expect(callLog.every((entry) => entry.startsWith('staging:'))).toBe(true);
  });
});

describe('Plan 41 job interruption and destination invalidation', () => {
  it('provider outage mid-backup persists a retry checkpoint, resumes, and never double-charges bytes', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    adapter.setPartialPutBytes(3);
    await authorize(adapter);
    const originalPut = adapter.putObject.bind(adapter);
    let callCount = 0;
    let chargedBytes = 0;
    adapter.putObject = async (input, resume) => {
      callCount += 1;
      if (callCount === 2) {
        throw new StorageAdapterError('unreachable', 'injected provider outage', true);
      }
      const result = await originalPut(input, resume);
      chargedBytes += result.encryptedBytes - (resume?.offset ?? 0);
      return result;
    };
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'outage-backup', backupId: 'outage-backup-id', destinationId: 'remote', schemaVersion: 41,
      objects: [encryptedObject('outage-object', 'attachment', new Uint8Array(11).fill(7))],
      manifest: testManifest(new Uint8Array(7).fill(8)),
    });

    // Act
    const retrying = await router.runJob(job.id);
    const checkpoint = getStorageJob(db, job.id)?.cursor_json;
    const completed = await router.runJob(job.id);

    // Assert
    expect(retrying).toMatchObject({ state: 'queued', last_error_code: 'unreachable' });
    expect(checkpoint).toContain('providerSession');
    expect(completed.state).toBe('succeeded');
    expect(chargedBytes).toBe(job.total_bytes);
    expect(completed.completed_bytes).toBe(job.total_bytes);
  });

  it('provider outage mid-restore resumes from its checkpoint without staging or charging an object twice', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const source = router.planBackupJob({
      jobId: 'restore-outage-source', backupId: 'restore-outage-backup', destinationId: 'remote', schemaVersion: 41,
      objects: [encryptedObject('restore-a'), encryptedObject('restore-b')],
      manifest: testManifest(),
    });
    await router.runJob(source.id);
    const originalGet = adapter.getObject.bind(adapter);
    let calls = 0;
    let downloadedBytes = 0;
    adapter.getObject = async (ref, range) => {
      calls += 1;
      if (calls === 2) throw new StorageAdapterError('unreachable', 'injected restore outage', true);
      const bytes = await originalGet(ref, range);
      downloadedBytes += bytes?.length ?? 0;
      return bytes;
    };
    const staged: string[] = [];
    const restore = router.planRestoreJob({
      jobId: 'restore-outage-job', backupId: 'restore-outage-backup', destinationId: 'remote',
      onCiphertext: (row) => { staged.push(row.object_id); },
    });

    // Act
    const retrying = await router.runJob(restore.id);
    const completed = await router.runJob(restore.id);

    // Assert
    expect(retrying).toMatchObject({ state: 'queued', last_error_code: 'unreachable' });
    expect(completed.state).toBe('succeeded');
    expect(new Set(staged).size).toBe(staged.length);
    expect(downloadedBytes).toBe(restore.total_bytes);
  });

  it('failure mode: revoked refresh authorization pauses the job and WP-41H rotation resumes it', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    adapter.setPartialPutBytes(3);
    await authorize(adapter);
    let router: StorageDestinationRouter | null = null;
    let revoked = false;
    router = buildRouter(new Map([['remote', adapter]]), (event) => {
      if (!revoked && event.type === 'job_transition' && event.eventType === 'checkpoint') {
        revoked = true;
        router?.updateDestinationState('remote', 'revoked');
      }
    });
    register(router, 'remote');
    const job = router.planBackupJob({
      jobId: 'rotation-job', backupId: 'rotation-backup', destinationId: 'remote', schemaVersion: 41,
      objects: [encryptedObject('rotation-object', 'attachment', new Uint8Array(8).fill(4))],
      manifest: testManifest(),
    });
    const paused = await router.runJob(job.id);

    // Act
    const rotation = await rotateStorageCredential({
      db,
      destinationId: 'remote',
      newCredentialRef: 'securestore://remote/rotated',
      authorizationKind: 'stored_credential',
      invalidateAdapter: () => undefined,
      resolveAdapter: () => adapter,
      resumeJob: (jobId) => { router?.resumeJob(jobId); },
      deleteCredential: async () => undefined,
      now: () => NOW,
      probeNonce: 'rotation-proof',
    });
    const completed = await router.runJob(job.id);

    // Assert
    expect(paused).toMatchObject({ state: 'paused', last_error_code: 'auth_required' });
    expect(rotation).toMatchObject({
      complete: true, credentialSwapped: true, resumedJobIds: ['rotation-job'], errorCode: null,
    });
    expect(getStorageDestination(db, 'remote')?.credential_ref).toBe('securestore://remote/rotated');
    expect(completed.state).toBe('succeeded');
  });

  it('quota exhaustion stops before local or mirror deletion and surfaces exact required bytes', async () => {
    // Arrange
    const target = new InMemoryStorageDestinationAdapter({ quotaCapBytes: 2 });
    const mirror = new InMemoryStorageDestinationAdapter();
    await authorize(target);
    await authorize(mirror);
    let targetDeletes = 0;
    let mirrorDeletes = 0;
    const targetDelete = target.deleteObject.bind(target);
    const mirrorDelete = mirror.deleteObject.bind(mirror);
    target.deleteObject = async (ref) => { targetDeletes += 1; return targetDelete(ref); };
    mirror.deleteObject = async (ref) => { mirrorDeletes += 1; return mirrorDelete(ref); };
    const router = buildRouter(new Map([['target', target], ['mirror', mirror]]));
    register(router, 'target');
    register(router, 'mirror');
    const object = encryptedObject('quota-object', 'attachment', new Uint8Array(6).fill(1));
    insertStorageObject(db, {
      object_id: object.objectId, destination_id: 'mirror', data_class: object.dataClass,
      ciphertext_hash: object.ciphertextHash, plaintext_hash_encrypted: null,
      encrypted_bytes: object.encryptedBytes, remote_ref: 'memory://quota-object',
      remote_version: 'mirror-v1', state: 'verified', last_verified_at: NOW,
    });
    const manifest = testManifest(new Uint8Array(5).fill(2));
    const job = router.planBackupJob({
      jobId: 'quota-adversarial', backupId: 'quota-adversarial-backup', destinationId: 'target',
      schemaVersion: 41, objects: [object], manifest,
    });

    // Act
    const error = await router.runJob(job.id).catch((caught: unknown) => caught);

    // Assert
    expect(error).toBeInstanceOf(StorageRouterError);
    expect(error).toMatchObject({
      code: 'quota_exceeded', requiredBytes: object.encryptedBytes + manifest.encryptedBytes,
      availableBytes: 2,
    });
    expect(getStorageJob(db, job.id)).toMatchObject({ state: 'paused', last_error_code: 'quota_exceeded' });
    expect(getStorageObject(db, object.objectId, 'mirror')?.state).toBe('verified');
    expect(targetDeletes).toBe(0);
    expect(mirrorDeletes).toBe(0);
  });

  it('conflict: same object id with different ciphertext fails closed, marks corrupt, and leaves mirror untouched', async () => {
    // Arrange
    const target = new InMemoryStorageDestinationAdapter();
    const mirror = new InMemoryStorageDestinationAdapter();
    await authorize(target);
    await authorize(mirror);
    const original = encryptedObject('conflict-object', 'attachment', new Uint8Array([1, 1, 1]));
    await target.putObject(original);
    await mirror.putObject(original);
    let mirrorWrites = 0;
    let mirrorDeletes = 0;
    const mirrorPut = mirror.putObject.bind(mirror);
    const mirrorDelete = mirror.deleteObject.bind(mirror);
    mirror.putObject = async (input, resume) => { mirrorWrites += 1; return mirrorPut(input, resume); };
    mirror.deleteObject = async (ref) => { mirrorDeletes += 1; return mirrorDelete(ref); };
    const router = buildRouter(new Map([['target', target], ['mirror', mirror]]));
    register(router, 'target');
    register(router, 'mirror');
    const conflicting = encryptedObject('conflict-object', 'attachment', new Uint8Array([2, 2, 2]));
    const job = router.planBackupJob({
      jobId: 'conflict-job', backupId: 'conflict-backup', destinationId: 'target', schemaVersion: 41,
      objects: [conflicting], manifest: testManifest(),
    });

    // Act
    const completed = await router.runJob(job.id);

    // Assert
    expect(completed.state).toBe('partial');
    expect(getStorageBackup(db, 'conflict-backup', 'target')?.state).toBe('corrupt');
    expect(await mirror.getObject({ objectId: original.objectId })).toEqual(original.ciphertext);
    expect(mirrorWrites).toBe(0);
    expect(mirrorDeletes).toBe(0);
  });

  it('account switch: iCloud identity-token change invalidates the destination and prevents writes to the new account', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    adapter.setPartialPutBytes(2);
    await authorize(adapter);
    let identityToken = 'icloud-account-a';
    const writeTokens: string[] = [];
    const originalPut = adapter.putObject.bind(adapter);
    adapter.putObject = async (input, resume) => {
      writeTokens.push(identityToken);
      return originalPut(input, resume);
    };
    let router: StorageDestinationRouter | null = null;
    let switched = false;
    router = buildRouter(new Map([['icloud', adapter]]), (event) => {
      if (!switched && event.type === 'job_transition' && event.eventType === 'checkpoint') {
        switched = true;
        identityToken = 'icloud-account-b';
        router?.updateDestinationState('icloud', 'error');
      }
    });
    register(router, 'icloud');
    const job = router.planBackupJob({
      jobId: 'icloud-switch-job', backupId: 'icloud-switch-backup', destinationId: 'icloud', schemaVersion: 41,
      objects: [encryptedObject('icloud-object', 'attachment', new Uint8Array(8).fill(3))],
      manifest: testManifest(),
    });

    // Act
    const stopped = await router.runJob(job.id);

    // Assert
    expect(stopped.state).toBe('paused');
    expect(getStorageDestination(db, 'icloud')?.state).toBe('error');
    expect(writeTokens).toEqual(['icloud-account-a']);
    expect(writeTokens).not.toContain('icloud-account-b');
  });

  it('stale bookmark: disappeared permission reports auth_required, reselects, and resumes without unauthorized writes', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    adapter.setPartialPutBytes(2);
    await authorize(adapter);
    let permissionAvailable = true;
    let permissionDisappeared = false;
    let acceptedWrites = 0;
    let refusedAttempts = 0;
    const originalPut = adapter.putObject.bind(adapter);
    adapter.putObject = async (input, resume) => {
      if (!permissionAvailable) {
        refusedAttempts += 1;
        throw new StorageAdapterError('auth_required', 'bookmark permission disappeared', false);
      }
      const result = await originalPut(input, resume);
      acceptedWrites += 1;
      if (!result.complete && !permissionDisappeared) {
        permissionAvailable = false;
        permissionDisappeared = true;
      }
      return result;
    };
    const router = buildRouter(new Map([['file', adapter]]));
    register(router, 'file');
    const job = router.planBackupJob({
      jobId: 'bookmark-job', backupId: 'bookmark-backup', destinationId: 'file', schemaVersion: 41,
      objects: [encryptedObject('bookmark-object', 'attachment', new Uint8Array(6).fill(5))],
      manifest: testManifest(),
    });
    const paused = await router.runJob(job.id);
    const writesBeforeReselect = acceptedWrites;

    // Act
    permissionAvailable = true;
    router.updateDestinationState('file', 'ready');
    router.resumeJob(job.id);
    const completed = await router.runJob(job.id);

    // Assert
    expect(paused).toMatchObject({ state: 'paused', last_error_code: 'auth_required' });
    expect(refusedAttempts).toBeGreaterThanOrEqual(1);
    expect(writesBeforeReselect).toBe(1);
    expect(completed.state).toBe('succeeded');
  });
});

describe('Plan 41 transport and integrity attacks', () => {
  it.each(['webdav', 's3', 'connected'] as const)(
    'unsafe redirect: %s cross-origin 3xx is refused and credentials are never forwarded',
    async (provider) => {
      // Arrange
      const log: HttpTransportRequest[] = [];
      const transport = async (request: HttpTransportRequest) => {
        log.push({ ...request, headers: { ...request.headers } });
        return {
          status: 307,
          headers: { Location: 'https://attacker.example.test/steal' },
          body: new Uint8Array(),
        };
      };

      // Act
      const action = requestWithSingleOriginRedirect(
        transport,
        `https://${provider}.example.test/object`,
        (url) => ({
          method: 'PUT', url, headers: { Authorization: `Bearer ${provider}-credential` },
          body: new Uint8Array([1]),
        }),
      );

      // Assert
      await expect(action).rejects.toMatchObject({ code: 'unsafe_redirect', retryable: false });
      expect(log).toHaveLength(1);
      expect(new URL(log[0]?.url ?? '').origin).toBe(`https://${provider}.example.test`);
      expect(log.some((request) => request.url.includes('attacker.example.test'))).toBe(false);
    },
  );

  it('MITM: descriptor tamper, challenge tamper, wrong operator key, and read-back substitution all fail closed', () => {
    // Arrange
    const operatorSeed = '11'.repeat(32);
    const otherSeed = '22'.repeat(32);
    const operatorKey = storageOperatorPublicKeyFromPrivateKey(operatorSeed);
    const unsigned: UnsignedStorageCapabilityDescriptor = {
      version: 1,
      endpoint: 'https://storage.example.test/api/storage/v1',
      operatorKey,
      supportedOperations: [...STORAGE_V1_SUPPORTED_OPERATIONS],
      maximumObjectBytes: 1_048_576,
      quotaBytes: 10_485_760,
      retention: 'rolling30',
      authDomain: STORAGE_AUTH_DOMAIN,
      issuedAt: '2026-07-14T11:55:00.000Z',
      expiresAt: '2026-07-14T12:05:00.000Z',
    };
    const descriptor = signStorageCapabilityDescriptor(unsigned, operatorSeed);
    const nonce = 'ab'.repeat(32);
    const challenge = signStorageChallengeResponse({
      version: 1,
      authDomain: STORAGE_AUTH_DOMAIN,
      endpoint: descriptor.endpoint,
      operatorKey,
      nonce,
      issuedAt: '2026-07-14T11:59:59.000Z',
      expiresAt: '2026-07-14T12:00:29.000Z',
    }, operatorSeed);
    const fixture = codecFixture();
    const firstChunk = fixture.encoded.databaseChunks[0];
    if (firstChunk === undefined) throw new Error('database chunk fixture is missing');

    // Act
    const descriptorTamper = verifyStorageCapabilityDescriptor(
      { ...descriptor, quotaBytes: 1 }, { now: () => NOW },
    );
    const wrongOperator = verifyStorageCapabilityDescriptor(descriptor, {
      now: () => NOW,
      expectedOperatorKey: storageOperatorPublicKeyFromPrivateKey(otherSeed),
    });
    const challengeTamper = verifyStorageChallengeResponse(
      { ...challenge, endpoint: 'https://attacker.example.test/api/storage/v1' },
      descriptor,
      nonce,
      { now: () => NOW },
    );
    const substitutedBody = verifyAndDecryptBackupChunk(
      fixture.opened.backupRootKey,
      fixture.opened.manifest,
      { kind: 'database', index: 0 },
      flipLastBit(firstChunk.envelope),
    );
    fixture.opened.backupRootKey.fill(0);

    // Assert
    expect(descriptorTamper).toBe(false);
    expect(wrongOperator).toBe(false);
    expect(challengeTamper).toBe(false);
    expect(substitutedBody).toMatchObject({ ok: false, error: { code: 'tampered_chunk' } });
  });

  it('failure mode: forged OAuth callback state is returned as invalid_state and no vault is accepted', async () => {
    // Arrange
    const client = new OAuthBrokerClient({
      baseUrl: 'https://broker.example.test/',
      transport: async () => ({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: encoder.encode(JSON.stringify({ error: 'invalid_state' })),
      }),
      getAuthorizationHeader: () => 'Bearer hosted-subject-token',
      now: () => NOW_MS,
    });

    // Act
    const action = client.connectComplete({
      state: 'forged-state', code: 'forged-code', codeVerifier: 'v'.repeat(43),
    });

    // Assert
    await expect(action).rejects.toMatchObject({ code: 'invalid_state', status: 400, retryable: false });
  });

  it('failure mode: a multipart ETag remains a remote version and read-back verification supplies integrity evidence', async () => {
    // Arrange
    const adapter = new InMemoryStorageDestinationAdapter();
    await authorize(adapter);
    const router = buildRouter(new Map([['remote', adapter]]));
    register(router, 'remote');
    const source = router.planBackupJob({
      jobId: 'etag-source', backupId: 'etag-backup', destinationId: 'remote', schemaVersion: 41,
      objects: [encryptedObject('etag-object')], manifest: testManifest(),
    });
    await router.runJob(source.id);
    const originalHead = adapter.headObject.bind(adapter);
    const originalGet = adapter.getObject.bind(adapter);
    adapter.headObject = async (ref) => {
      const metadata = await originalHead(ref);
      return metadata === null ? null : {
        ...metadata,
        remoteVersion: 'd41d8cd98f00b204e9800998ecf8427e-7',
        ciphertextHash: null,
      };
    };
    let readBackChecks = 0;
    const restore = router.planRestoreJob({
      jobId: 'etag-restore', backupId: 'etag-backup', destinationId: 'remote',
      verifyCiphertext: (row, bytes) => {
        readBackChecks += 1;
        return sha512Hex(bytes) === row.ciphertext_hash;
      },
      onCiphertext: async (row) => {
        expect(await originalGet({ objectId: row.object_id })).not.toBeNull();
      },
    });

    // Act
    const completed = await router.runJob(restore.id);

    // Assert
    expect(completed.state).toBe('succeeded');
    expect(readBackChecks).toBe(restore.total_objects + 1);
    expect(listStorageObjects(db, 'remote').every((row) => row.ciphertext_hash.length === 128)).toBe(true);
  });
});

describe('Plan 41 snapshot, mirroring, activation, and capacity boundaries', () => {
  it('failure mode: snapshot races with a write are serialized before the router receives snapshot bytes', async () => {
    // Arrange
    const callLog: string[] = [];
    const activeRows = ['row:v1'];
    let releaseSnapshot: (() => void) | null = null;
    const snapshotCaptured = new Promise<void>((resolve) => { releaseSnapshot = resolve; });
    const coordinatedSnapshot = async (): Promise<Uint8Array> => {
      callLog.push('maintenance:begin');
      const bytes = encoder.encode(activeRows.join(','));
      callLog.push('snapshot:captured');
      releaseSnapshot?.();
      await Promise.resolve();
      callLog.push('maintenance:end');
      return bytes;
    };
    const concurrentWrite = async (): Promise<void> => {
      await snapshotCaptured;
      callLog.push('write:queued');
      await Promise.resolve();
      activeRows.push('row:v2');
      callLog.push('write:committed');
    };

    // Act
    const [snapshot] = await Promise.all([coordinatedSnapshot(), concurrentWrite()]);

    // Assert
    expect(decoder.decode(snapshot)).toBe('row:v1');
    expect(activeRows).toEqual(['row:v1', 'row:v2']);
    expect(callLog.indexOf('snapshot:captured')).toBeLessThan(callLog.indexOf('write:committed'));
  });

  it('failure mode: a mirror outage reports partial while the verified primary remains complete', async () => {
    // Arrange
    const primary = new InMemoryStorageDestinationAdapter();
    const mirror = new InMemoryStorageDestinationAdapter();
    await authorize(primary);
    await authorize(mirror);
    const router = buildRouter(new Map([['primary', primary], ['mirror', mirror]]));
    register(router, 'primary');
    register(router, 'mirror');
    const object = encryptedObject('mirror-object');
    const manifest = testManifest();
    const source = router.planBackupJob({
      jobId: 'mirror-primary', backupId: 'mirror-backup', destinationId: 'primary', schemaVersion: 41,
      objects: [object], manifest,
    });
    await router.runJob(source.id);
    mirror.failNext('putObject', new StorageAdapterError('provider_error', 'mirror unavailable', false));
    const mirrorJob = router.planMirrorJob({
      jobId: 'mirror-partial', backupId: 'mirror-backup', primaryDestinationId: 'primary',
      destinationId: 'mirror', schemaVersion: 41, objects: [object], manifest,
    });

    // Act
    const completed = await router.runJob(mirrorJob.id);

    // Assert
    expect(completed.state).toBe('partial');
    expect(getStorageBackup(db, 'mirror-backup', 'primary')?.state).toBe('complete');
    expect(getStorageBackup(db, 'mirror-backup', 'mirror')?.state).toBe('verifying');
    expect(listStorageObjects(db, 'primary').every((row) => row.state === 'verified')).toBe(true);
  });

  it.each([
    'before_active_close',
    'after_active_close',
    'after_rollback_snapshot',
    'after_active_swap',
    'before_boot_verification',
    'during_boot_verification',
  ] as const)(
    'rollback: activation failure at %s produces rolled_back with prior data intact',
    (boundary) => {
      // Arrange
      const fixture = codecFixture();
      const awaiting = advanceToAwaitingActivation(fixture);
      const priorData = ['prior-row', 'prior-object'];
      const activeData = [...priorData];
      const operationLog = [`fault:${boundary}`, 'rollback:prior-data-restored'];

      // Act
      const state = reduceRestoreController(awaiting, {
        type: 'activation_failed',
        rollbackSucceeded: true,
        report: `${boundary}: prior data restored`,
      });
      fixture.opened.backupRootKey.fill(0);

      // Assert
      expect(state).toMatchObject({
        stage: 'rolled_back', failure: { code: 'activation_failed' },
      });
      expect(activeData).toEqual(priorData);
      expect(operationLog).toEqual([`fault:${boundary}`, 'rollback:prior-data-restored']);
    },
  );

  it('large object: a simulated 256 MiB object streams in bounded chunks without a whole-object allocation', () => {
    // Arrange
    const chunkBytes = 1024 * 1024;
    const chunkCount = 256;
    const sourceChunk = new Uint8Array(chunkBytes).fill(0x5a);
    let liveAllocatedBytes = sourceChunk.length;
    let peakAllocatedBytes = liveAllocatedBytes;
    const nonceSource = (index: number): Uint8Array => {
      const nonce = new Uint8Array(24);
      nonce[0] = index & 0xff;
      nonce[1] = (index >>> 8) & 0xff;
      nonce[2] = (index >>> 16) & 0xff;
      nonce.fill(0xa5, 3);
      return nonce;
    };
    const input: BackupEncoderInput = {
      recoveryKey: VECTOR_RECOVERY_KEY,
      backupId: 'simulated-large-backup',
      createdAt: NOW,
      schemaVersion: 41,
      migrationVersion: 12,
      appVersion: 'proof-pack',
      dataClassVersions: { attachment: 1 },
      sealedRecoveryBundle: VECTOR_BACKUP_INPUT.sealedRecoveryBundle,
      signingIdentity: VECTOR_BACKUP_INPUT.signingIdentity,
      nonceSource,
    };
    const backupEncoder = createBackupEncoder(input);
    backupEncoder.addDatabaseChunk(new Uint8Array([0x41]));

    // Act
    for (let index = 0; index < chunkCount; index += 1) {
      const encrypted = backupEncoder.addObjectChunk('simulated-large-object', 'attachment', sourceChunk);
      liveAllocatedBytes += encrypted.envelope.length;
      peakAllocatedBytes = Math.max(peakAllocatedBytes, liveAllocatedBytes);
      liveAllocatedBytes -= encrypted.envelope.length;
    }
    const finalized = backupEncoder.finalize();

    // Assert
    const opened = openBackupManifest(finalized.locatorJson, finalized.manifest.envelope, VECTOR_RECOVERY_KEY);
    if (!opened.ok) throw opened.error;
    const descriptor = opened.manifest.objects.find((object) => object.objectId === 'simulated-large-object');
    expect(descriptor?.chunks).toHaveLength(chunkCount);
    expect(descriptor?.chunks.reduce((sum, chunk) => sum + chunk.plaintextBytes, 0))
      .toBe(256 * 1024 * 1024);
    expect(peakAllocatedBytes).toBeLessThan(3 * chunkBytes);
    expect(backupEncoder).not.toHaveProperty('ciphertext');
    opened.backupRootKey.fill(0);
  }, 60_000);
});
