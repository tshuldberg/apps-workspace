// Backup run orchestration (Plan 41 WP-41B3). Drives a REAL backup:
//
//   consistent SQLite snapshot  (WAL-safe, integrity-checked)
//     -> streaming Backup Format v1 encoder (bounded 4 MiB chunks)
//     -> router backup job (per-object remote write + read-back / checksum verify)
//     -> mk_storage_backups reaches `complete` ONLY after every object and the
//        manifest verify (NC-41.2, AC-41.3).
//
// The encoder chunks the database at 4 MiB, so no full backup is ever held in a
// single buffer. Each chunk becomes one router object; the manifest is the
// router manifest object. Success is entirely evidence-gated by the router.
//
// Crypto material (the device secret key and recovery key) is passed in by the
// caller, used only to build the encoder, and never persisted here.

import type { DatabaseAdapter } from '@mylife/db';
import { listBlobs } from '@mylife/sync';
import {
  createBackupEncoder,
  type BackupEncoderInput,
  type EncryptedBackupChunk,
  type EncryptedBackupManifest,
} from '@mylife/sync/src/storage/backup-format';
import type {
  RouterEncryptedStorageObject,
  RouterStagedStorageObject,
  StorageDestinationRouter,
  StorageJobPayloadStore,
} from '@mylife/sync/src/storage/router';
import type { StorageJob } from '@mylife/sync/src/storage/job-reducer';
import {
  createRemoteBackupDiscoveryObjects,
  remoteBackupManifestObjectId,
  remoteBackupObjectId,
} from '@mylife/sync/src/storage/remote-backups';
import type { ExpoBlobStore } from '../expo-blob-store';
import {
  createExpoSnapshotFileSystem,
  ExpoMobileSnapshotDatabaseSource,
  LocalSnapshotError,
  type MobileSnapshotDatabaseSource,
  type MobileSnapshotFileSystem,
} from '../local-snapshot';

export const BACKUP_DATABASE_DATA_CLASS = 'sqlite_snapshot';
const BACKUP_MANIFEST_DATA_CLASS = 'backup_manifest';
const DEFAULT_CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * Device-local settings key holding the non-secret backup locator so a restore
 * on this device can open the manifest. The locator carries no key material.
 */
export function backupLocatorSettingKey(destinationId: string, backupId: string): string {
  return `storage_backup_locator:${destinationId}:${backupId}`;
}

export interface BackupRunProgress {
  phase: 'snapshotting' | 'encoding' | 'writing' | 'verifying' | 'complete' | 'failed';
  completedObjects: number;
  totalObjects: number;
  completedBytes: number;
  totalBytes: number;
}

export interface RunLocalBackupInput {
  db: DatabaseAdapter;
  router: StorageDestinationRouter;
  destinationId: string;
  backupId: string;
  encoderInput: BackupEncoderInput;
  schemaVersion: number;
  chunkBytes?: number;
  fileSystem?: MobileSnapshotFileSystem;
  databaseSource?: MobileSnapshotDatabaseSource;
  payloadStore: StorageJobPayloadStore;
  blobStore: Pick<ExpoBlobStore, 'size' | 'readRange'>;
  onProgress?: (progress: BackupRunProgress) => void;
}

export interface RunLocalBackupResult {
  job: StorageJob;
  backupId: string;
  /** True only when the router marked every object and the manifest verified. */
  complete: boolean;
  /**
   * The non-secret backup locator (version, id, encrypted-manifest hash). A
   * restore needs it to open the manifest; the caller persists it against the
   * backup id so a later restore on this device can reconstruct the plan.
   */
  locatorJson: string;
  mirror: {
    destinationId: string;
    job: StorageJob | null;
    error: string | null;
  } | null;
}

function chunkObject(
  backupId: string,
  chunk: EncryptedBackupChunk,
  dataClass = BACKUP_DATABASE_DATA_CLASS,
): RouterEncryptedStorageObject {
  return {
    objectId: remoteBackupObjectId(backupId, chunk.path),
    dataClass,
    ciphertext: chunk.envelope,
    ciphertextHash: chunk.ciphertextHash,
    encryptedBytes: chunk.encryptedBytes,
  };
}

function descriptor(object: RouterEncryptedStorageObject): RouterStagedStorageObject {
  return {
    objectId: object.objectId,
    dataClass: object.dataClass,
    ciphertextHash: object.ciphertextHash,
    encryptedBytes: object.encryptedBytes,
  };
}

function terminal(state: StorageJob['state']): boolean {
  return state === 'cancelled' || state === 'succeeded' || state === 'partial' || state === 'failed';
}

function manifestObject(backupId: string, manifest: EncryptedBackupManifest): RouterEncryptedStorageObject {
  return {
    objectId: remoteBackupManifestObjectId(backupId),
    dataClass: BACKUP_MANIFEST_DATA_CLASS,
    ciphertext: manifest.envelope,
    ciphertextHash: manifest.ciphertextHash,
    encryptedBytes: manifest.encryptedBytes,
  };
}

/**
 * Snapshot + encode the app database into router objects, then plan and run a
 * real backup job against the destination. The returned job carries the router
 * state; `complete` reflects only evidence-verified success.
 */
export async function runLocalDatabaseBackup(
  input: RunLocalBackupInput,
): Promise<RunLocalBackupResult> {
  const fileSystem = input.fileSystem ?? createExpoSnapshotFileSystem();
  if (!fileSystem?.documentDirectory) {
    throw new LocalSnapshotError('snapshot_unavailable', 'The app document directory is unavailable.');
  }
  const databaseSource = input.databaseSource ?? new ExpoMobileSnapshotDatabaseSource(
    fileSystem,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-sqlite'),
  );
  const chunkBytes = input.chunkBytes ?? DEFAULT_CHUNK_BYTES;

  input.onProgress?.({
    phase: 'snapshotting', completedObjects: 0, totalObjects: 0, completedBytes: 0, totalBytes: 0,
  });
  const snapshot = await databaseSource.createConsistentSnapshot(input.backupId);
  const objects: RouterStagedStorageObject[] = [];
  const payloadSourceJobId = `storage-payload-${input.backupId}`;
  const primaryJobId = `storage-primary-${input.backupId}`;
  const mirrorJobId = `storage-mirror-${input.backupId}`;
  let preservePayload = false;
  const stage = async (object: RouterEncryptedStorageObject): Promise<RouterStagedStorageObject> => {
    try {
      await input.payloadStore.put(payloadSourceJobId, object);
      return descriptor(object);
    } finally {
      object.ciphertext.fill(0);
    }
  };
  try {
    const size = await fileSystem.size(snapshot.uri);
    const encoder = createBackupEncoder(input.encoderInput);
    let offset = 0;
    input.onProgress?.({
      phase: 'encoding', completedObjects: 0, totalObjects: 0, completedBytes: 0, totalBytes: size,
    });
    while (offset < size) {
      const requested = Math.min(chunkBytes, size - offset);
      const plaintext = await fileSystem.readRange(snapshot.uri, offset, requested);
      try {
        objects.push(await stage(chunkObject(input.backupId, encoder.addDatabaseChunk(plaintext))));
      } finally {
        plaintext.fill(0);
      }
      offset += requested;
    }
    for (const blob of listBlobs(input.db)) {
      const actualSize = await input.blobStore.size(blob.hash);
      if (actualSize === null || actualSize !== blob.size) {
        throw new Error(`Backup blob ${blob.hash.slice(0, 12)} is missing or has the wrong size.`);
      }
      const dataClass = blob.moduleId === 'library' || blob.moduleId.startsWith('library:')
        ? 'library_object'
        : 'attachment';
      if (actualSize === 0) {
        objects.push(await stage(chunkObject(
          input.backupId,
          encoder.addObjectChunk(blob.hash, dataClass, new Uint8Array(0)),
          dataClass,
        )));
      }
      let blobOffset = 0;
      while (blobOffset < actualSize) {
        const requested = Math.min(chunkBytes, actualSize - blobOffset);
        const plaintext = await input.blobStore.readRange(blob.hash, blobOffset, requested);
        if (plaintext === null || plaintext.length !== requested) {
          plaintext?.fill(0);
          throw new Error(`Backup blob ${blob.hash.slice(0, 12)} ended during a bounded read.`);
        }
        try {
          objects.push(await stage(chunkObject(
            input.backupId,
            encoder.addObjectChunk(blob.hash, dataClass, plaintext),
            dataClass,
          )));
        } finally {
          plaintext.fill(0);
        }
        blobOffset += requested;
      }
    }
    const finalized = encoder.finalize();
    if (finalized.identityChunk !== null) {
      objects.push(await stage({
        objectId: remoteBackupObjectId(input.backupId, finalized.identityChunk.path),
        dataClass: 'encrypted_recovery_bundle',
        ciphertext: finalized.identityChunk.envelope,
        ciphertextHash: finalized.identityChunk.ciphertextHash,
        encryptedBytes: finalized.identityChunk.encryptedBytes,
      }));
    }
    const manifest = await stage(manifestObject(input.backupId, finalized.manifest));
    const discoveryObjects = createRemoteBackupDiscoveryObjects({
      backupId: input.backupId,
      locatorJson: finalized.locatorJson,
      manifestCiphertextHash: finalized.manifest.ciphertextHash,
    });
    for (const discoveryObject of discoveryObjects) objects.push(await stage(discoveryObject));

    const planned = input.router.planBackupJob({
      jobId: primaryJobId,
      payloadSourceJobId,
      destinationId: input.destinationId,
      backupId: input.backupId,
      schemaVersion: input.schemaVersion,
      objects,
      manifest,
    });
    input.onProgress?.({
      phase: 'writing',
      completedObjects: 0,
      totalObjects: planned.total_objects,
      completedBytes: 0,
      totalBytes: planned.total_bytes,
    });
    const job = await input.router.runJob(planned.id);
    const complete = job.state === 'succeeded';
    input.onProgress?.({
      phase: complete ? 'complete' : 'failed',
      completedObjects: job.completed_objects,
      totalObjects: job.total_objects,
      completedBytes: job.completed_bytes,
      totalBytes: job.total_bytes,
    });
    let mirror: RunLocalBackupResult['mirror'] = null;
    const policy = input.router.getPolicy(BACKUP_DATABASE_DATA_CLASS);
    if (complete && policy?.primary_destination_id === input.destinationId
      && policy.mirror_destination_id !== null) {
      try {
        const plannedMirror = input.router.planMirrorJob({
          jobId: mirrorJobId,
          payloadSourceJobId,
          destinationId: policy.mirror_destination_id,
          primaryDestinationId: input.destinationId,
          backupId: input.backupId,
          schemaVersion: input.schemaVersion,
          objects,
          manifest,
        });
        const mirrorJob = await input.router.runJob(plannedMirror.id);
        mirror = {
          destinationId: policy.mirror_destination_id,
          job: mirrorJob,
          error: mirrorJob.state === 'succeeded' ? null : mirrorJob.last_error_code ?? mirrorJob.state,
        };
        preservePayload = !terminal(mirrorJob.state);
      } catch (error) {
        mirror = {
          destinationId: policy.mirror_destination_id,
          job: null,
          error: error instanceof Error ? error.message : 'mirror_failed',
        };
      }
    }
    preservePayload ||= !terminal(job.state);
    return { job, backupId: input.backupId, complete, locatorJson: finalized.locatorJson, mirror };
  } finally {
    const primary = input.router.getJob(primaryJobId);
    const mirror = input.router.getJob(mirrorJobId);
    preservePayload ||= primary !== null && !terminal(primary.state);
    preservePayload ||= mirror !== null && !terminal(mirror.state);
    if (!preservePayload) await input.payloadStore.deleteJob(payloadSourceJobId);
    await snapshot.cleanup();
  }
}
