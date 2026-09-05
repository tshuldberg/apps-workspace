import { BACKUP_IDENTITY_PATH, BACKUP_MANIFEST_PATH } from '@mylife/sync/src/storage/backup-format';
import { remoteBackupManifestObjectId, remoteBackupObjectId } from '@mylife/sync';
import type { RestoreChunkRequirement } from '@mylife/sync/src/storage/restore-controller';
import type { StorageDestinationAdapter } from '@mylife/sync/src/storage/types';
import type { RestoreEncryptedSource } from './restore-orchestrator-core';

export async function readWebBackupManifestEnvelope(
  adapter: StorageDestinationAdapter,
  backupId: string,
  manifestObjectId = remoteBackupManifestObjectId(backupId),
): Promise<Uint8Array> {
  const envelope = await adapter.getObject({ objectId: manifestObjectId })
    ?? await adapter.getObject({ objectId: BACKUP_MANIFEST_PATH });
  if (envelope === null) throw new Error('The backup manifest is missing from this destination.');
  return envelope;
}

export function createWebAdapterRestoreSource(
  adapter: StorageDestinationAdapter,
  backupId: string,
): RestoreEncryptedSource {
  return {
    async readChunk(requirement: RestoreChunkRequirement) {
      return await adapter.getObject({ objectId: remoteBackupObjectId(backupId, requirement.chunkId) })
        ?? adapter.getObject({ objectId: requirement.chunkId });
    },
    async readIdentityChunk() {
      return await adapter.getObject({ objectId: remoteBackupObjectId(backupId, BACKUP_IDENTITY_PATH) })
        ?? adapter.getObject({ objectId: BACKUP_IDENTITY_PATH });
    },
  };
}
