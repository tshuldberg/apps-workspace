/**
 * Per-module blob sync policy enforcement.
 *
 * Controls which blobs get synced based on module settings
 * and current network conditions (WiFi vs cellular).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BlobPolicyEntry } from '../types';
import { getBlobPolicy, upsertBlobPolicy } from '../db/queries';

/** Default max blob size: 50 MB */
const DEFAULT_MAX_BLOB_SIZE = 50 * 1024 * 1024;

/** Network conditions at the time of a sync decision. */
export interface NetworkConditions {
  isWifi: boolean;
  isCellular: boolean;
  isMetered: boolean;
}

/** Default blob policy for a module. */
export function getDefaultPolicy(moduleId: string): BlobPolicyEntry {
  return {
    moduleId,
    policy: 'wifi_only',
    maxBlobSizeBytes: DEFAULT_MAX_BLOB_SIZE,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if a blob should be synced based on the module's policy
 * and current network conditions.
 */
export function shouldSyncBlob(
  policy: BlobPolicyEntry,
  blobSize: number,
  networkConditions: NetworkConditions,
): boolean {
  // Never sync if policy says never
  if (policy.policy === 'never') {
    return false;
  }

  // Manual requires explicit user action (not automatic)
  if (policy.policy === 'manual') {
    return false;
  }

  // Respect max blob size
  if (blobSize > policy.maxBlobSizeBytes) {
    return false;
  }

  // WiFi-only: block on cellular or metered connections
  if (policy.policy === 'wifi_only') {
    if (!networkConditions.isWifi) {
      return false;
    }
    if (networkConditions.isMetered) {
      return false;
    }
    return true;
  }

  // 'always' syncs on any connection
  return true;
}

/** Load or create the blob policy for a module. */
export function ensureBlobPolicy(db: DatabaseAdapter, moduleId: string): BlobPolicyEntry {
  const existing = getBlobPolicy(db, moduleId);
  if (existing) {
    return existing;
  }

  const defaultPolicy = getDefaultPolicy(moduleId);
  upsertBlobPolicy(db, defaultPolicy);
  return defaultPolicy;
}
