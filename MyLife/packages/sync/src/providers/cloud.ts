/**
 * CloudProvider -- Bidirectional cloud sync via PowerSync.
 *
 * Requires Supabase auth. Uses PowerSync for bidirectional
 * Supabase <-> SQLite sync. Enforces storage limits per tier.
 *
 * The actual PowerSync and Supabase SDK integrations are injected
 * so this module can be tested without those dependencies installed.
 */

import type {
  SyncProvider,
  SyncStatus,
  SyncTier,
  SyncEventListener,
  SyncEvent,
} from '../types';
import { STORAGE_LIMITS, isCloudTier } from '../types';

/**
 * Minimal interface for a PowerSync database connection.
 * Matches the PowerSync SDK's AbstractPowerSyncDatabase shape.
 */
export interface PowerSyncLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readonly connected: boolean;
  readonly currentStatus: {
    readonly connected: boolean;
    readonly lastSyncedAt: Date | null;
    readonly uploading: boolean;
    readonly downloading: boolean;
  };
}

/**
 * Minimal interface for a Supabase client to query storage usage.
 */
export interface SupabaseStorageClient {
  /** Returns the cloud storage used in bytes for the current user. */
  getStorageUsedBytes(): Promise<number>;
  /** Returns the current auth session token, or null if not authenticated. */
  getSessionToken(): Promise<string | null>;
}

export interface CloudProviderOptions {
  /** The cloud tier (free_cloud, starter_cloud, or power_cloud). */
  tier: Extract<SyncTier, 'free_cloud' | 'starter_cloud' | 'power_cloud'>;
  /** PowerSync database instance. */
  powerSync: PowerSyncLike;
  /** Supabase storage client for usage queries. */
  supabaseStorage: SupabaseStorageClient;
  /** Optional function to get local SQLite file size. */
  getDbFileSize?: () => Promise<number>;
}

export class CloudProvider implements SyncProvider {
  readonly tier: SyncTier;

  private readonly _powerSync: PowerSyncLike;
  private readonly _supabaseStorage: SupabaseStorageClient;
  private readonly _getDbFileSize: () => Promise<number>;
  private readonly _storageLimit: number;
  private _listeners: Set<SyncEventListener> = new Set();
  private _initialized = false;
  private _paused = false;
  private _lastSyncedAt: Date | null = null;
  private _storageUsedBytes = 0;

  constructor(options: CloudProviderOptions) {
    if (!isCloudTier(options.tier)) {
      throw new Error(`CloudProvider requires a cloud tier, got: ${options.tier}`);
    }
    this.tier = options.tier;
    this._powerSync = options.powerSync;
    this._supabaseStorage = options.supabaseStorage;
    this._getDbFileSize = options.getDbFileSize ?? (() => Promise.resolve(0));
    this._storageLimit = STORAGE_LIMITS[options.tier];
  }

  async initialize(): Promise<void> {
    // Verify auth
    const token = await this._supabaseStorage.getSessionToken();
    if (!token) {
      throw new Error('CloudProvider requires authentication. No session token available.');
    }

    await this._powerSync.connect();
    this._initialized = true;
    this._emit({ type: 'status_change', status: this.getStatus() });
  }

  async sync(): Promise<void> {
    if (!this._initialized || this._paused) return;

    // Check storage limit before syncing
    const used = await this._supabaseStorage.getStorageUsedBytes();
    this._storageUsedBytes = used;

    if (used >= this._storageLimit) {
      this._emit({
        type: 'sync_error',
        error: new Error(
          `Storage limit exceeded: ${formatBytes(used)} used of ${formatBytes(this._storageLimit)} allowed. ` +
          `Upgrade your plan for more storage.`,
        ),
      });
      return;
    }

    // PowerSync handles sync automatically when connected;
    // this method is for manual trigger / status refresh
    this._lastSyncedAt = this._powerSync.currentStatus.lastSyncedAt;
    this._emit({ type: 'sync_complete', timestamp: this._lastSyncedAt ?? new Date() });
  }

  async pause(): Promise<void> {
    if (!this._initialized) return;
    this._paused = true;
    await this._powerSync.disconnect();
    this._emit({ type: 'status_change', status: this.getStatus() });
  }

  async resume(): Promise<void> {
    if (!this._initialized) return;
    this._paused = false;
    await this._powerSync.connect();
    this._emit({ type: 'status_change', status: this.getStatus() });
  }

  getStatus(): SyncStatus {
    return {
      tier: this.tier,
      connected: this._initialized && this._powerSync.connected && !this._paused,
      lastSyncedAt: this._lastSyncedAt,
      storageUsedBytes: this._storageUsedBytes,
      storageLimitBytes: this._storageLimit,
      pendingChanges: 0,
    };
  }

  async getStorageUsed(): Promise<number> {
    try {
      this._storageUsedBytes = await this._supabaseStorage.getStorageUsedBytes();
    } catch {
      // Fall back to local file size if cloud query fails
      this._storageUsedBytes = await this._getDbFileSize();
    }
    return this._storageUsedBytes;
  }

  onEvent(listener: SyncEventListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  async destroy(): Promise<void> {
    if (this._initialized) {
      await this._powerSync.disconnect();
    }
    this._initialized = false;
    this._paused = false;
    this._listeners.clear();
  }

  /** Whether the provider has been initialized. */
  get initialized(): boolean {
    return this._initialized;
  }

  private _emit(event: SyncEvent): void {
    for (const listener of this._listeners) {
      listener(event);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === Infinity) return 'unlimited';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
