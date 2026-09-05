/**
 * Database integration for the sync layer.
 *
 * Provides functions to wire a SyncProvider into the DB initialization
 * flow and handle tier transitions gracefully. Also integrates the
 * SyncEngine for P2P sync when the tier is 'p2p'.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { SyncProvider, SyncTier, DeviceIdentity } from './types';
import { tierRequiresAuth } from './types';
import { LocalOnlyProvider } from './providers/local-only';
import type { LocalOnlyProviderOptions } from './providers/local-only';
import type { P2PProviderOptions } from './providers/p2p';
import { P2PProvider } from './providers/p2p';
import type { CloudProviderOptions } from './providers/cloud';
import { CloudProvider } from './providers/cloud';
import { setSyncProvider } from './hooks';
import { SyncEngine } from './engine/sync-engine';
import type { SyncEngineOptions } from './engine/sync-engine';

export interface SyncManagerOptions {
  /** Options for creating the LocalOnlyProvider. */
  localOnlyOptions?: LocalOnlyProviderOptions;
  /** Factory for creating a P2PProvider (requires platform-specific WebRTC). */
  createP2PProvider?: (baseOptions: Omit<P2PProviderOptions, 'deviceId'> & { deviceId: string }) => P2PProvider;
  /** Factory for creating a CloudProvider (requires PowerSync + Supabase). */
  createCloudProvider?: (tier: CloudProviderOptions['tier']) => CloudProvider;
  /** Called to check if the user is authenticated. */
  isAuthenticated?: () => Promise<boolean>;
  /** Database adapter for P2P sync engine. */
  db?: DatabaseAdapter;
  /** Device identity for P2P sync (required for p2p tier). */
  identity?: DeviceIdentity;
  /** Module ID to table prefix mapping for P2P sync. */
  modulePrefixes?: Map<string, string>;
  /** List of enabled modules for P2P sync. */
  enabledModules?: string[];
  /** Custom SyncEngine options. */
  syncEngineOptions?: Partial<SyncEngineOptions>;
}

/**
 * Manages sync provider lifecycle and tier transitions.
 */
export class SyncManager {
  private _currentProvider: SyncProvider | null = null;
  private _currentTier: SyncTier = 'local_only';
  private _syncEngine: SyncEngine | null = null;
  private readonly _options: SyncManagerOptions;

  constructor(options: SyncManagerOptions = {}) {
    this._options = options;
  }

  /** The currently active sync provider. */
  get provider(): SyncProvider | null {
    return this._currentProvider;
  }

  /** The current sync tier. */
  get tier(): SyncTier {
    return this._currentTier;
  }

  /** The P2P sync engine (available when tier is 'p2p'). */
  get syncEngine(): SyncEngine | null {
    return this._syncEngine;
  }

  /**
   * Initialize with the given tier.
   * Creates the appropriate provider, initializes it, and sets it as active.
   */
  async initialize(tier: SyncTier = 'local_only'): Promise<SyncProvider> {
    const provider = await this._createProvider(tier);
    await provider.initialize();

    this._currentProvider = provider;
    this._currentTier = tier;
    setSyncProvider(provider);

    return provider;
  }

  /**
   * Switch to a new sync tier.
   *
   * Handles transitions:
   * - local -> p2p: create P2P provider, start pairing flow
   * - local -> cloud: push local data to cloud, start sync
   * - cloud -> local: stop sync, keep local data
   * - p2p -> cloud: disconnect peers, start cloud sync
   */
  async switchTier(newTier: SyncTier): Promise<SyncProvider> {
    if (newTier === this._currentTier && this._currentProvider) {
      return this._currentProvider;
    }

    // Verify auth for cloud tiers
    if (tierRequiresAuth(newTier)) {
      const isAuth = await this._options.isAuthenticated?.();
      if (!isAuth) {
        throw new Error(
          `Tier "${newTier}" requires authentication. Please sign in first.`,
        );
      }
    }

    // Tear down old provider and sync engine
    if (this._syncEngine) {
      await this._syncEngine.destroy();
      this._syncEngine = null;
    }
    if (this._currentProvider) {
      await this._currentProvider.destroy();
    }

    // Create and initialize new provider
    const provider = await this._createProvider(newTier);
    await provider.initialize();

    // Start sync engine for P2P tier
    if (newTier === 'p2p') {
      await this._startSyncEngine();
    }

    this._currentProvider = provider;
    this._currentTier = newTier;
    setSyncProvider(provider);

    return provider;
  }

  /**
   * Tear down the current provider and release resources.
   */
  async destroy(): Promise<void> {
    if (this._syncEngine) {
      await this._syncEngine.destroy();
      this._syncEngine = null;
    }
    if (this._currentProvider) {
      await this._currentProvider.destroy();
      this._currentProvider = null;
    }
    this._currentTier = 'local_only';
    setSyncProvider(null);
  }

  private async _startSyncEngine(): Promise<void> {
    const { db, identity, modulePrefixes, enabledModules } = this._options;
    if (!db || !identity) return;

    this._syncEngine = new SyncEngine({
      db,
      identity,
      modulePrefixes: modulePrefixes ?? new Map(),
      enabledModules: enabledModules ?? [],
      ...this._options.syncEngineOptions,
    });
    await this._syncEngine.initialize();
  }

  private async _createProvider(tier: SyncTier): Promise<SyncProvider> {
    switch (tier) {
      case 'local_only':
        return new LocalOnlyProvider(this._options.localOnlyOptions);

      case 'p2p': {
        if (!this._options.createP2PProvider) {
          throw new Error(
            'P2P sync is not available. No createP2PProvider factory was provided.',
          );
        }
        // The caller provides the full P2PProviderOptions via factory
        return this._options.createP2PProvider({
          deviceId: '',
          createPeerConnection: () => { throw new Error('Not configured'); },
          signalingTransport: { send: async () => {}, onMessage: () => () => {} },
          getOutboundChangeset: async () => ({ id: '', sourceDeviceId: '', createdAt: '', changes: [] }),
          onInboundChangeset: async () => {},
        });
      }

      case 'free_cloud':
      case 'starter_cloud':
      case 'power_cloud': {
        if (!this._options.createCloudProvider) {
          throw new Error(
            'Cloud sync is not available. No createCloudProvider factory was provided.',
          );
        }
        return this._options.createCloudProvider(tier);
      }

      default: {
        const _exhaustive: never = tier;
        throw new Error(`Unknown sync tier: ${_exhaustive}`);
      }
    }
  }
}

/**
 * Create a SyncManager with default options suitable for local-only mode.
 * Additional providers can be configured later.
 */
export function createSyncManager(options?: SyncManagerOptions): SyncManager {
  return new SyncManager(options);
}
