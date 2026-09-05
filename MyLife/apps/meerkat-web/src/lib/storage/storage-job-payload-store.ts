import type {
  RouterEncryptedStorageObject,
  StorageJobPayloadStore,
} from '@mylife/sync';
import {
  STORE_STORAGE_JOB_PAYLOADS,
  idbDeletePrefix,
  idbGet,
  idbPut,
} from './idb';

function key(jobId: string, objectId: string): string {
  return `${jobId.length}:${jobId}${objectId}`;
}

function prefix(jobId: string): string {
  return `${jobId.length}:${jobId}`;
}

/** IndexedDB-backed ciphertext staging. Blob values avoid materializing all jobs in JS heap. */
export class BrowserStorageJobPayloadStore implements StorageJobPayloadStore {
  async put(jobId: string, object: RouterEncryptedStorageObject): Promise<void> {
    const copy = new Uint8Array(object.ciphertext.length);
    copy.set(object.ciphertext);
    await idbPut(
      STORE_STORAGE_JOB_PAYLOADS,
      key(jobId, object.objectId),
      new Blob([copy.buffer], { type: 'application/octet-stream' }),
    );
  }

  async get(jobId: string, objectId: string): Promise<Uint8Array | null> {
    const value = await idbGet<Blob | Uint8Array>(STORE_STORAGE_JOB_PAYLOADS, key(jobId, objectId));
    if (value === undefined) return null;
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    return value instanceof Uint8Array ? value : new Uint8Array(value);
  }

  async deleteJob(jobId: string): Promise<void> {
    await idbDeletePrefix(STORE_STORAGE_JOB_PAYLOADS, prefix(jobId));
  }
}
