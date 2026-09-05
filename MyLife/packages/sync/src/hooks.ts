/**
 * React hooks for consuming sync state.
 *
 * These hooks use React.useSyncExternalStore to subscribe to
 * SyncProvider events without re-creating subscriptions on every render.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { SyncProvider, SyncStatus, SyncTier, PairedDevice, SyncSession, BlobPolicyEntry } from './types';

// Module-level singleton provider reference.
// Set via setSyncProvider() during app initialization.
let _activeProvider: SyncProvider | null = null;
const _providerListeners = new Set<() => void>();

function notifyProviderListeners(): void {
  for (const listener of _providerListeners) {
    listener();
  }
}

/**
 * Set the active sync provider. Called during app initialization
 * or when switching tiers.
 */
export function setSyncProvider(provider: SyncProvider | null): void {
  _activeProvider = provider;
  notifyProviderListeners();
}

/**
 * Get the active sync provider (for non-React code).
 */
export function getSyncProvider(): SyncProvider | null {
  return _activeProvider;
}

/**
 * Hook to access the current SyncProvider instance.
 * Re-renders when the provider is swapped (tier change).
 */
export function useSyncProvider(): SyncProvider | null {
  const subscribe = useCallback((onStoreChange: () => void) => {
    _providerListeners.add(onStoreChange);
    return () => { _providerListeners.delete(onStoreChange); };
  }, []);

  const getSnapshot = useCallback(() => _activeProvider, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const DEFAULT_STATUS: SyncStatus = {
  tier: 'local_only',
  connected: false,
  lastSyncedAt: null,
  storageUsedBytes: 0,
  storageLimitBytes: Infinity,
  pendingChanges: 0,
};

/**
 * Hook to get the current SyncStatus. Subscribes to provider events
 * and re-renders on status changes.
 */
export function useSyncStatus(): SyncStatus {
  const statusRef = useRef<SyncStatus>(DEFAULT_STATUS);

  const subscribe = useCallback((onStoreChange: () => void) => {
    // Listen for provider swaps
    _providerListeners.add(onStoreChange);

    // Listen for status events from the current provider
    let unsubEvent: (() => void) | null = null;
    if (_activeProvider) {
      statusRef.current = _activeProvider.getStatus();
      unsubEvent = _activeProvider.onEvent((event) => {
        if (event.type === 'status_change') {
          statusRef.current = event.status;
          onStoreChange();
        }
      });
    } else {
      statusRef.current = DEFAULT_STATUS;
    }

    return () => {
      _providerListeners.delete(onStoreChange);
      unsubEvent?.();
    };
  }, []);

  const getSnapshot = useCallback(() => {
    if (_activeProvider) {
      statusRef.current = _activeProvider.getStatus();
    }
    return statusRef.current;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Callback type for tier change handler. */
export type SetSyncTierFn = (tier: SyncTier) => Promise<void>;

/**
 * Hook to get a function for changing the sync tier.
 * The actual tier switching logic must be provided via setTierChangeHandler().
 */
let _tierChangeHandler: SetSyncTierFn | null = null;

export function setTierChangeHandler(handler: SetSyncTierFn): void {
  _tierChangeHandler = handler;
}

export function useSetSyncTier(): SetSyncTierFn {
  return useCallback(async (tier: SyncTier) => {
    if (!_tierChangeHandler) {
      throw new Error(
        'No tier change handler configured. Call setTierChangeHandler() during app initialization.',
      );
    }
    await _tierChangeHandler(tier);
  }, []);
}

// ---------------------------------------------------------------------------
// P2P Sync Hooks
// ---------------------------------------------------------------------------

// External store for paired devices
let _pairedDevices: PairedDevice[] = [];
const _pairedDevicesListeners = new Set<() => void>();

/** Update the paired devices list (called by SyncEngine). */
export function setPairedDevices(devices: PairedDevice[]): void {
  _pairedDevices = devices;
  for (const listener of _pairedDevicesListeners) {
    listener();
  }
}

/**
 * Hook to get the list of paired devices.
 * Re-renders when devices are added, removed, or updated.
 */
export function usePairedDevices(): PairedDevice[] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    _pairedDevicesListeners.add(onStoreChange);
    return () => { _pairedDevicesListeners.delete(onStoreChange); };
  }, []);

  const getSnapshot = useCallback(() => _pairedDevices, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// External store for sync history
let _syncHistory: SyncSession[] = [];
const _syncHistoryListeners = new Set<() => void>();

/** Update the sync history (called by SyncEngine). */
export function setSyncHistory(sessions: SyncSession[]): void {
  _syncHistory = sessions;
  for (const listener of _syncHistoryListeners) {
    listener();
  }
}

/**
 * Hook to get the recent sync session history.
 * Re-renders when new sync sessions complete.
 */
export function useSyncHistory(): SyncSession[] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    _syncHistoryListeners.add(onStoreChange);
    return () => { _syncHistoryListeners.delete(onStoreChange); };
  }, []);

  const getSnapshot = useCallback(() => _syncHistory, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// External store for module sync settings
let _moduleSyncSettings: BlobPolicyEntry[] = [];
const _moduleSyncSettingsListeners = new Set<() => void>();

/** Update the module sync settings (called by SyncEngine). */
export function setModuleSyncSettings(settings: BlobPolicyEntry[]): void {
  _moduleSyncSettings = settings;
  for (const listener of _moduleSyncSettingsListeners) {
    listener();
  }
}

/**
 * Hook to get per-module sync/blob policies.
 * Re-renders when module sync settings change.
 */
export function useModuleSyncSettings(): BlobPolicyEntry[] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    _moduleSyncSettingsListeners.add(onStoreChange);
    return () => { _moduleSyncSettingsListeners.delete(onStoreChange); };
  }, []);

  const getSnapshot = useCallback(() => _moduleSyncSettings, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// External store for torrent status
export interface TorrentStatusSnapshot {
  activeDownloads: number;
  activeSeeds: number;
  totalUploaded: number;
  totalDownloaded: number;
}

const DEFAULT_TORRENT_STATUS: TorrentStatusSnapshot = {
  activeDownloads: 0,
  activeSeeds: 0,
  totalUploaded: 0,
  totalDownloaded: 0,
};

let _torrentStatus: TorrentStatusSnapshot = DEFAULT_TORRENT_STATUS;
const _torrentStatusListeners = new Set<() => void>();

/** Update the torrent status (called by torrent subsystem). */
export function setTorrentStatus(status: TorrentStatusSnapshot): void {
  _torrentStatus = status;
  for (const listener of _torrentStatusListeners) {
    listener();
  }
}

/**
 * Hook to get the current torrent subsystem status.
 * Re-renders when downloads/seeds start, complete, or update.
 */
export function useTorrentStatus(): TorrentStatusSnapshot {
  const subscribe = useCallback((onStoreChange: () => void) => {
    _torrentStatusListeners.add(onStoreChange);
    return () => { _torrentStatusListeners.delete(onStoreChange); };
  }, []);

  const getSnapshot = useCallback(() => _torrentStatus, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
