/**
 * Observable sync state for UI binding.
 *
 * Provides a reactive store that UI components can subscribe to
 * for real-time sync status updates (state, peer count, pending changes).
 */

import type { SyncEngineState, SyncEngineStatus } from '../types';

export type SyncStatusListener = (status: SyncEngineStatus) => void;

/**
 * Observable sync status store.
 *
 * Uses a simple pub/sub pattern compatible with React's useSyncExternalStore.
 */
export class SyncStatusStore {
  private _status: SyncEngineStatus;
  private _listeners: Set<SyncStatusListener> = new Set();

  constructor() {
    this._status = {
      state: 'idle',
      pairedDeviceCount: 0,
      onlineDeviceCount: 0,
      pendingChanges: 0,
      lastSyncAt: null,
      currentSessionId: null,
    };
  }

  /** Get the current status snapshot. */
  getStatus(): SyncEngineStatus {
    return { ...this._status };
  }

  /** Update the sync state. */
  setState(state: SyncEngineState): void {
    this._status = { ...this._status, state };
    this._notify();
  }

  /** Update paired device count. */
  setPairedDeviceCount(count: number): void {
    this._status = { ...this._status, pairedDeviceCount: count };
    this._notify();
  }

  /** Update online device count. */
  setOnlineDeviceCount(count: number): void {
    this._status = { ...this._status, onlineDeviceCount: count };
    this._notify();
  }

  /** Update pending change count. */
  setPendingChanges(count: number): void {
    this._status = { ...this._status, pendingChanges: count };
    this._notify();
  }

  /** Record a completed sync. */
  recordSync(sessionId: string): void {
    this._status = {
      ...this._status,
      lastSyncAt: new Date().toISOString(),
      currentSessionId: null,
      state: 'idle',
    };
    void sessionId;
    this._notify();
  }

  /** Set the current active session. */
  setCurrentSession(sessionId: string | null): void {
    this._status = { ...this._status, currentSessionId: sessionId };
    this._notify();
  }

  /** Subscribe to status changes. Returns an unsubscribe function. */
  subscribe(listener: SyncStatusListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Get the subscribe function (for useSyncExternalStore). */
  getSubscribe(): (listener: SyncStatusListener) => () => void {
    return (listener: SyncStatusListener) => this.subscribe(listener);
  }

  /** Get the snapshot function (for useSyncExternalStore). */
  getSnapshot(): () => SyncEngineStatus {
    return () => this._status;
  }

  private _notify(): void {
    const status = this.getStatus();
    for (const listener of this._listeners) {
      listener(status);
    }
  }
}
