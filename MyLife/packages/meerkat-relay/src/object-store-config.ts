/**
 * Construct the FIRST-PARTY hosted object store from the resolved runtime config (Plan 44 WP-2D).
 *
 * The typed object-store block lives in resolveMeerkatStoreRuntimeConfig (runtime-config.ts):
 * MEERKAT_OBJECT_STORE_BACKEND (s3|file), ENDPOINT/REGION/BUCKET, and credentials as mounted-secret
 * FILE paths only (MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE / _SECRET_KEY_FILE), mirroring the
 * PostgreSQL CA-file convention. This module reads those secret files at construction and builds a
 * live S3ObjectStore, so no credential ever rides in plain env. Self-host file mode never reaches
 * here (its object-store backend is `file` and the hosted service keeps the file byte path).
 *
 * The S3 store is also its own presigner, so createHostedObjectStore wraps it as the three-method
 * HostedStorageObjectStore the hosted metadata flow consumes. NOTE (WP-2D honesty): the metadata
 * reservation/activation flow has no live runtime consumer yet, so createHostedObjectStore is the
 * composition point for when one lands; the hosted service constructs the S3 store so the boundary
 * is not dead, but the reserve/activate/createUploadTarget path itself is not invoked at runtime.
 */

import { promises as fs } from 'node:fs';
import { S3ObjectStore, type S3ObjectStoreOptions } from './object-store-s3';
import { HostedObjectStoreAdapter } from './object-store-hosted-adapter';
import type { HostedStorageObjectStore } from './hosted-storage-metadata';
import type { MeerkatObjectStoreRuntimeConfig } from './postgres/runtime-config';

export interface CreateS3ObjectStoreFromRuntimeConfigOptions {
  productionMode: boolean;
  /** Test seam: read a mounted-secret file (defaults to fs.readFile utf8, trimmed). */
  readTextFile?: (path: string) => Promise<string>;
}

/**
 * Build a live S3ObjectStore from the resolved s3 object-store config, reading the access key id
 * and secret access key from their mounted-secret files. A missing/unreadable/empty secret file
 * fails closed, never with an empty credential. Only call this when the config backend is `s3`.
 */
export async function createS3ObjectStoreFromRuntimeConfig(
  config: MeerkatObjectStoreRuntimeConfig,
  options: CreateS3ObjectStoreFromRuntimeConfigOptions,
): Promise<S3ObjectStore> {
  if (config.backend !== 's3' || !config.s3) {
    throw new Error('createS3ObjectStoreFromRuntimeConfig requires an s3 object-store config');
  }
  const readTextFile = options.readTextFile ?? (async (filePath) => fs.readFile(filePath, 'utf8'));
  const readSecret = async (filePath: string, label: string): Promise<string> => {
    const value = (await readTextFile(filePath)).trim();
    if (!value) throw new Error(`${label} secret file is empty`);
    return value;
  };
  const accessKeyId = await readSecret(config.s3.accessKeyIdFile, 'object-store access key id');
  const secretAccessKey = await readSecret(config.s3.secretAccessKeyFile, 'object-store secret access key');

  const storeOptions: S3ObjectStoreOptions = {
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    bucket: config.s3.bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: config.s3.forcePathStyle,
    productionMode: options.productionMode,
    allowInsecureHttp: config.s3.allowInsecureHttp,
  };
  return new S3ObjectStore(storeOptions);
}

/** Wrap a MeerkatObjectStore-shaped S3 store as the three-method HostedStorageObjectStore. */
export function createHostedObjectStore(store: S3ObjectStore): HostedStorageObjectStore {
  // The S3 store is both the byte store and its own presigner (only a network store can mint one).
  return new HostedObjectStoreAdapter(store, store);
}
