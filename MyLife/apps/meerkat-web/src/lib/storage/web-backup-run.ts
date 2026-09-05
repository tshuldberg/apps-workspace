// Web backup run orchestration (Plan 41 WP-41B3). The web twin of the mobile
// backup engine: export a consistent, integrity-checked browser database
// snapshot, stream it through the Backup Format v1 encoder (bounded chunks), map
// each encrypted chunk to a router object, then plan and run a real backup job
// whose completion is gated on read-back / checksum verification (NC-41.2).
//
// Crypto material is passed in by the caller, used only to build the encoder,
// and never persisted here.

import type { DatabaseAdapter } from '@mylife/db';
import { listBlobs } from '@mylife/sync';
import type {
  BackupEncoderInput,
  EncryptedBackupChunk,
  EncryptedBackupManifest,
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
import { createWebLocalSnapshot, type WebSnapshotDatabase } from './local-snapshot';
import type { BrowserBlobStore } from './browser-blob-store';

export const BACKUP_DATABASE_DATA_CLASS = 'sqlite_snapshot';
const BACKUP_MANIFEST_DATA_CLASS = 'backup_manifest';

export function backupLocatorSettingKey(destinationId: string, backupId: string): string {
  return `storage_backup_locator:${destinationId}:${backupId}`;
}

export interface RunWebBackupInput {
  db: DatabaseAdapter & WebSnapshotDatabase;
  router: StorageDestinationRouter;
  destinationId: string;
  backupId: string;
  encoderInput: BackupEncoderInput;
  schemaVersion: number;
  chunkBytes?: number;
  payloadStore: StorageJobPayloadStore;
  blobStore: Pick<BrowserBlobStore, 'size' | 'readRange'>;
}

export interface RunWebBackupResult {
  job: StorageJob;
  backupId: string;
  complete: boolean;
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

export async function runWebDatabaseBackup(
  input: RunWebBackupInput,
): Promise<RunWebBackupResult> {
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
    const encoded = await createWebLocalSnapshot({
    database: input.db,
    encoderInput: input.encoderInput,
    chunkBytes: input.chunkBytes,
    async writeEncryptedChunk(chunk): Promise<void> {
      objects.push(await stage(chunkObject(input.backupId, chunk)));
    },
    async writeAdditionalObjects(encoder): Promise<void> {
      const chunkBytes = input.chunkBytes ?? 4 * 1024 * 1024;
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
        let offset = 0;
        while (offset < actualSize) {
          const requested = Math.min(chunkBytes, actualSize - offset);
          const plaintext = await input.blobStore.readRange(blob.hash, offset, requested);
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
          offset += requested;
        }
      }
    },
    });
    if (encoded.identityChunk !== null) {
      objects.push(await stage({
        objectId: remoteBackupObjectId(input.backupId, encoded.identityChunk.path),
        dataClass: 'encrypted_recovery_bundle',
        ciphertext: encoded.identityChunk.envelope,
        ciphertextHash: encoded.identityChunk.ciphertextHash,
        encryptedBytes: encoded.identityChunk.encryptedBytes,
      }));
    }
    const manifest = await stage(manifestObject(input.backupId, encoded.manifest));
    const discoveryObjects = createRemoteBackupDiscoveryObjects({
      backupId: input.backupId,
      locatorJson: encoded.locatorJson,
      manifestCiphertextHash: encoded.manifest.ciphertextHash,
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
    const job = await input.router.runJob(planned.id);
    let mirror: RunWebBackupResult['mirror'] = null;
    const policy = input.router.getPolicy(BACKUP_DATABASE_DATA_CLASS);
    if (job.state === 'succeeded' && policy?.primary_destination_id === input.destinationId
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
    return {
      job,
      backupId: input.backupId,
      complete: job.state === 'succeeded',
      locatorJson: encoded.locatorJson,
      mirror,
    };
  } finally {
    const primary = input.router.getJob(primaryJobId);
    const mirror = input.router.getJob(mirrorJobId);
    preservePayload ||= primary !== null && !terminal(primary.state);
    preservePayload ||= mirror !== null && !terminal(mirror.state);
    if (!preservePayload) await input.payloadStore.deleteJob(payloadSourceJobId);
  }
}
