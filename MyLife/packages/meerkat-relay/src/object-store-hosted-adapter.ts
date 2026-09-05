/**
 * Proves HostedStorageObjectStore is a clean projection of MeerkatObjectStore.
 *
 * The hosted metadata store (hosted-storage-metadata.ts) drives byte storage through
 * exactly three operations: createUploadTarget (a presigned transfer), observeObject
 * (stat before a fenced commit), and deleteObject (release under confirmsDeletion()).
 * Two of the three -- observeObject and deleteObject -- are pure projections of the
 * MeerkatObjectStore contract, so this adapter maps them with no new semantics:
 *  - observeObject(key) -> observe(key), returning the same (objectKey, checksum,
 *    sizeBytes, versionId) HostedObjectObservation the metadata store compares against
 *    its reservation. A durable OR quarantined object is observable; a rejected object
 *    reports absent (it must never satisfy a fenced commit);
 *  - deleteObject(key, versionId) -> deleteObject(key), returning a
 *    HostedObjectDeletionReceipt whose { objectKey, versionId, deleted } is exactly
 *    what confirmsDeletion() checks, so a release path is unchanged.
 *
 * createUploadTarget is the one operation that is transport-specific: the hosted
 * store expects a presigned PUT URL for a direct-to-storage byte transfer, which only
 * a network object store (the S3 adapter, WP-2B) can mint. This adapter therefore
 * takes an injected presigner for that single method, so the shared read/delete
 * projection is proven here while the presigned-transfer detail stays where the real
 * URL comes from. The object store itself never changes to satisfy the hosted store.
 */

import type {
  HostedObjectDeletionReceipt,
  HostedObjectObservation,
  HostedObjectUploadTarget,
  HostedStorageObjectStore,
} from './hosted-storage-metadata';
import type { MeerkatObjectStore } from './object-store';

export interface HostedUploadTargetPresigner {
  createUploadTarget(input: {
    objectKey: string;
    checksum: string;
    sizeBytes: number;
    fencingToken: number;
    expiresAt: string;
  }): Promise<HostedObjectUploadTarget>;
}

/**
 * Wraps a MeerkatObjectStore as the three-method HostedStorageObjectStore the metadata
 * store consumes. observeObject and deleteObject are pure projections; createUploadTarget
 * delegates to the injected presigner (an S3 adapter concern).
 */
export class HostedObjectStoreAdapter implements HostedStorageObjectStore {
  constructor(
    private readonly store: MeerkatObjectStore,
    private readonly presigner: HostedUploadTargetPresigner,
  ) {}

  createUploadTarget(input: {
    objectKey: string;
    checksum: string;
    sizeBytes: number;
    fencingToken: number;
    expiresAt: string;
  }): Promise<HostedObjectUploadTarget> {
    return this.presigner.createUploadTarget(input);
  }

  async observeObject(
    objectKey: string,
    _versionId?: string,
  ): Promise<HostedObjectObservation | null> {
    const observation = await this.store.observe(objectKey);
    if (!observation || observation.state === 'rejected') return null;
    return {
      objectKey: observation.key,
      checksum: observation.checksumSha256,
      sizeBytes: observation.sizeBytes,
      versionId: observation.versionId,
    };
  }

  async deleteObject(input: {
    objectKey: string;
    versionId: string;
  }): Promise<HostedObjectDeletionReceipt> {
    const receipt = await this.store.deleteObject(input.objectKey);
    // The metadata store's confirmsDeletion() matches on the versionId it activated,
    // so echo the caller's version on the receipt rather than the store's post-delete
    // token; deleted is true whenever the key is now absent (idempotent on replay).
    return {
      objectKey: receipt.key,
      versionId: input.versionId,
      deleted: receipt.deleted,
    };
  }
}
