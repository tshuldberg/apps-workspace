/**
 * LocalOnlyProvider -- Default sync provider when no sync is configured.
 *
 * All sync methods are no-ops. getStorageUsed() returns the SQLite file
 * size on disk (when a path is provided) or 0.
 */

import type { SyncProvider, SyncStatus, SyncEventListener } from '../types';

export interface LocalOnlyProviderOptions {
  /**
   * Optional function that returns the SQLite database file size in bytes.
   * When not provided, getStorageUsed() returns 0.
   */
  getDbFileSize?: () => Promise<number>;
}

export class LocalOnlyProvider implements SyncProvider {
  readonly tier = 'local_only' as const;

  private readonly _getDbFileSize: () => Promise<number>;
  private _initialized = false;

  constructor(options: LocalOnlyProviderOptions = {}) {
    this._getDbFileSize = options.getDbFileSize ?? (() => Promise.resolve(0));
  }

  async initialize(): Promise<void> {
    this._initialized = true;
  }

  async sync(): Promise<void> {
    // No-op: local-only has nothing to sync
  }

  async pause(): Promise<void> {
    // No-op
  }

  async resume(): Promise<void> {
    // No-op
  }

  getStatus(): SyncStatus {
    return {
      tier: 'local_only',
      connected: false,
      lastSyncedAt: null,
      storageUsedBytes: 0,
      storageLimitBytes: Infinity,
      pendingChanges: 0,
    };
  }

  async getStorageUsed(): Promise<number> {
    return this._getDbFileSize();
  }

  onEvent(_listener: SyncEventListener): () => void {
    // Local-only never emits events
    return () => {};
  }

  async destroy(): Promise<void> {
    this._initialized = false;
  }

  /** Whether initialize() has been called and destroy() has not. */
  get initialized(): boolean {
    return this._initialized;
  }
}
