import * as FileSystem from 'expo-file-system/legacy';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import { sha256Hex } from '@mylife/sync/src/encryption/sha256';
import type {
  RouterEncryptedStorageObject,
  StorageJobPayloadStore,
} from '@mylife/sync';

import { getPrivateStorageRoot } from '../private-storage';
const encoder = new TextEncoder();

function safePart(value: string): string {
  return sha256Hex(encoder.encode(value));
}

function jobDirectory(jobId: string): string {
  return `${getPrivateStorageRoot()}meerkat/storage-jobs/${safePart(jobId)}/`;
}

function objectPath(jobId: string, objectId: string): string {
  return `${jobDirectory(jobId)}${safePart(objectId)}.bin`;
}

/** Filesystem-backed encrypted chunk staging for crash-safe mobile backup jobs. */
export class ExpoStorageJobPayloadStore implements StorageJobPayloadStore {
  async put(jobId: string, object: RouterEncryptedStorageObject): Promise<void> {
    const directory = jobDirectory(jobId);
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.writeAsStringAsync(
      objectPath(jobId, object.objectId),
      encodeBase64(object.ciphertext),
      { encoding: FileSystem.EncodingType.UTF8 },
    );
  }

  async get(jobId: string, objectId: string): Promise<Uint8Array | null> {
    const path = objectPath(jobId, objectId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return decodeBase64(await FileSystem.readAsStringAsync(path));
  }

  async deleteJob(jobId: string): Promise<void> {
    await FileSystem.deleteAsync(jobDirectory(jobId), { idempotent: true });
  }
}
