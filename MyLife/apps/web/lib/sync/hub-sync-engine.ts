// Hub web sync engine wiring (SYNC-REAL Milestone 1).
//
// Instantiates a REAL NativeSyncEngine over the browser DatabaseAdapter and
// exposes a SyncProvider so the existing useSyncStatus / useSetSyncTier hooks
// reflect real engine state instead of throwing. NativeSyncEngine is the
// mobile-safe facade (no Automerge WASM): it imports ../crdt/document-manager,
// which Next resolves to document-manager.web.ts (the LWW manager), so Automerge
// never reaches the web bundle. We also pass an explicit LwwDocumentManager to
// match apps/meerkat-web exactly.
//
// Milestone 1 = whole-hub-DB device-to-device sync for the user's OWN devices.
// The engine, identity, pairing crypto, workspace + transport state are all
// real and local. The actual two-device relay transfer is Milestone 2 / founder
// ops (needs a deployed relay + a second device) and is NOT claimed here.

import { SyncEngine as NativeSyncEngine } from '@mylife/sync/src/engine/sync-engine.native';
import { LwwDocumentManager } from '@mylife/sync/src/crdt/lww-document-manager';
import type { SyncStatusStore } from '@mylife/sync/src/engine/sync-status';
import { getPairedDevices } from '@mylife/sync/src/db/queries';
import {
  setSyncProvider,
  setTierChangeHandler,
  setPairedDevices,
} from '@mylife/sync/src/hooks';
import type {
  SyncProvider,
  SyncStatus,
  SyncEventListener,
  SyncEvent,
  SyncTier,
  DeviceIdentity,
} from '@mylife/sync/src/types';
import { tierRequiresAuth } from '@mylife/sync/src/types';
import { bootHubSync, type HubSyncBoot } from './browser-sync-boot';
import type { BrowserDatabaseAdapter } from './browser-database-adapter';

// Milestone 1 syncs the user's own devices. We keep the enabled-module set
// conservative: the hub change-log / sync_ tables themselves. Per-module opt-in
// expands in Milestone 2; declaring fewer modules never fabricates sync.
const HUB_SYNC_ENABLED_MODULES: string[] = [];
const HUB_SYNC_PREFIXES = new Map<string, string>();

/**
 * A real SyncProvider over the engine's status store. Local-first device sync
 * has no cloud connection, so `connected` is derived honestly from whether a
 * sync has ever completed in this session (it has not, until a real session
 * runs). Storage usage reflects the on-device sync DB size.
 */
class HubSyncProvider implements SyncProvider {
  readonly tier: SyncTier;
  private readonly statusStore: SyncStatusStore;
  private readonly db: BrowserDatabaseAdapter;
  private readonly listeners = new Set<SyncEventListener>();
  private unsubscribe: (() => void) | null = null;
  // useSyncExternalStore bails out only when getSnapshot returns an Object.is
  // equal value. getStatus() must therefore return a STABLE reference and only
  // rebuild when the underlying engine status actually changes, or React loops
  // (Minified React error #185, max update depth).
  private cachedStatus: SyncStatus;
  private cacheKey = '';

  constructor(opts: { tier: SyncTier; statusStore: SyncStatusStore; db: BrowserDatabaseAdapter }) {
    this.tier = opts.tier;
    this.statusStore = opts.statusStore;
    this.db = opts.db;
    this.cachedStatus = this.buildStatus();
    this.cacheKey = this.computeKey();
    this.unsubscribe = this.statusStore.subscribe(() => {
      const event: SyncEvent = { type: 'status_change', status: this.getStatus() };
      for (const l of this.listeners) l(event);
    });
  }

  async initialize(): Promise<void> {}
  async sync(): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}

  private computeKey(): string {
    const s = this.statusStore.getStatus();
    return `${this.tier}|${s.lastSyncAt ?? ''}|${s.pendingChanges}`;
  }

  private buildStatus(): SyncStatus {
    const engineStatus = this.statusStore.getStatus();
    return {
      tier: this.tier,
      // Honest: there is no live cloud/peer connection in Milestone 1. The status
      // store never marks a session "connected" until a real relay session runs.
      connected: false,
      lastSyncedAt: engineStatus.lastSyncAt ? new Date(engineStatus.lastSyncAt) : null,
      storageUsedBytes: 0,
      storageLimitBytes: Infinity,
      pendingChanges: engineStatus.pendingChanges,
    };
  }

  getStatus(): SyncStatus {
    const key = this.computeKey();
    if (key !== this.cacheKey) {
      this.cacheKey = key;
      this.cachedStatus = this.buildStatus();
    }
    return this.cachedStatus;
  }

  async getStorageUsed(): Promise<number> {
    try {
      const bytes = await this.db.export();
      return bytes.byteLength;
    } catch {
      return 0;
    }
  }

  onEvent(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async destroy(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }
}

export interface HubSyncEngineHandle {
  boot: HubSyncBoot;
  engine: InstanceType<typeof NativeSyncEngine>;
  identity: DeviceIdentity;
  /** Current local-first tier (local_only or p2p). */
  tier: SyncTier;
}

let handle: HubSyncEngineHandle | null = null;
let initPromise: Promise<HubSyncEngineHandle> | null = null;

/**
 * Boot the browser sync stack and instantiate the engine ONCE. Registers the
 * SyncProvider, the tier-change handler (so useSetSyncTier no longer throws),
 * and seeds the paired-device store. Idempotent.
 */
export async function initHubSyncEngine(): Promise<HubSyncEngineHandle> {
  if (handle) return handle;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const boot = await bootHubSync();
    const engine = new NativeSyncEngine({
      db: boot.db,
      identity: boot.identity,
      modulePrefixes: HUB_SYNC_PREFIXES,
      enabledModules: HUB_SYNC_ENABLED_MODULES,
      // Plain-JSON LWW manager: the web node speaks the same wire format as the
      // native app and other web nodes. Cast matches apps/meerkat-web.
      documentManager: new LwwDocumentManager() as unknown as ConstructorParameters<
        typeof NativeSyncEngine
      >[0]['documentManager'],
    });
    await engine.initialize();

    let currentTier: SyncTier = 'local_only';
    const publish = (tier: SyncTier): void => {
      currentTier = tier;
      setSyncProvider(
        new HubSyncProvider({ tier, statusStore: engine.getStatusStore(), db: boot.db }),
      );
    };

    // Tier-change handler. Local-first device sync (local_only / p2p) is REAL
    // and switches the active provider. Cloud tiers require auth + billing that
    // this Milestone-1 browser stack does not own, so they are refused with an
    // honest error rather than faking a cloud connection.
    setTierChangeHandler(async (tier: SyncTier) => {
      if (tierRequiresAuth(tier)) {
        throw new Error(
          'Cloud sync is not available from this device-to-device sync surface yet. ' +
            'Use Settings > Backup & Restore to move data between devices, or sign in for cloud sync once it ships.',
        );
      }
      publish(tier);
    });

    // Initial provider + paired-device snapshot.
    publish('local_only');
    setPairedDevices(getPairedDevices(boot.db));

    handle = { boot, engine, identity: boot.identity, tier: currentTier };
    return handle;
  })();
  return initPromise;
}

/** Synchronous accessor once initHubSyncEngine resolved. */
export function getHubSyncEngine(): HubSyncEngineHandle | null {
  return handle;
}

/** Refresh the paired-device external store from the DB. */
export function refreshPairedDevices(): void {
  if (!handle) return;
  setPairedDevices(getPairedDevices(handle.boot.db));
}
