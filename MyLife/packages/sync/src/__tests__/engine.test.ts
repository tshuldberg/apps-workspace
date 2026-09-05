import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncStatusStore } from '../engine/sync-status';
import { SyncScheduler } from '../engine/sync-scheduler';
import { SyncEngine } from '../engine/sync-engine';

// ---------------------------------------------------------------------------
// SyncStatusStore
// ---------------------------------------------------------------------------

describe('SyncStatusStore', () => {
  let store: SyncStatusStore;

  beforeEach(() => {
    store = new SyncStatusStore();
  });

  it('initial state is idle', () => {
    const status = store.getStatus();
    expect(status.state).toBe('idle');
    expect(status.pairedDeviceCount).toBe(0);
    expect(status.onlineDeviceCount).toBe(0);
    expect(status.pendingChanges).toBe(0);
    expect(status.lastSyncAt).toBeNull();
    expect(status.currentSessionId).toBeNull();
  });

  it('setState updates state', () => {
    store.setState('syncing');
    expect(store.getStatus().state).toBe('syncing');

    store.setState('error');
    expect(store.getStatus().state).toBe('error');
  });

  it('setPendingChanges updates pendingChanges', () => {
    store.setPendingChanges(5);
    expect(store.getStatus().pendingChanges).toBe(5);

    store.setPendingChanges(0);
    expect(store.getStatus().pendingChanges).toBe(0);
  });

  it('setPairedDeviceCount updates pairedDeviceCount', () => {
    store.setPairedDeviceCount(3);
    expect(store.getStatus().pairedDeviceCount).toBe(3);
  });

  it('setOnlineDeviceCount updates onlineDeviceCount', () => {
    store.setOnlineDeviceCount(2);
    expect(store.getStatus().onlineDeviceCount).toBe(2);
  });

  it('recordSync sets lastSyncAt and resets state to idle', () => {
    store.setState('syncing');
    store.setCurrentSession('sess_1');
    store.recordSync('sess_1');

    const status = store.getStatus();
    expect(status.state).toBe('idle');
    expect(status.lastSyncAt).not.toBeNull();
    expect(status.currentSessionId).toBeNull();
  });

  it('setCurrentSession updates currentSessionId', () => {
    store.setCurrentSession('sess_abc');
    expect(store.getStatus().currentSessionId).toBe('sess_abc');

    store.setCurrentSession(null);
    expect(store.getStatus().currentSessionId).toBeNull();
  });

  it('subscribe notifies listener on state changes', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState('syncing');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'syncing' }),
    );
  });

  it('subscribe returns an unsubscribe function', () => {
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.setState('syncing');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.setState('idle');
    // Should still be 1, listener was removed
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getSubscribe returns a function compatible with useSyncExternalStore', () => {
    const subscribeFn = store.getSubscribe();
    expect(typeof subscribeFn).toBe('function');

    const listener = vi.fn();
    const unsub = subscribeFn(listener);
    expect(typeof unsub).toBe('function');

    store.setState('connecting');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.setState('idle');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getSnapshot returns a function that returns the current status', () => {
    const snapshotFn = store.getSnapshot();
    expect(typeof snapshotFn).toBe('function');

    const snapshot = snapshotFn();
    expect(snapshot.state).toBe('idle');

    store.setState('discovering');
    const snapshot2 = snapshotFn();
    expect(snapshot2.state).toBe('discovering');
  });

  it('getStatus returns a copy (mutations do not affect store)', () => {
    const status = store.getStatus();
    status.state = 'error';
    expect(store.getStatus().state).toBe('idle');
  });

  it('multiple listeners are all notified', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    store.subscribe(listener1);
    store.subscribe(listener2);

    store.setState('syncing');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SyncScheduler
// ---------------------------------------------------------------------------

describe('SyncScheduler', () => {
  let scheduler: SyncScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new SyncScheduler({
      minIntervalMs: 100,
      maxIntervalMs: 1000,
      activeIntervalMs: 50,
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('starts in stopped state', () => {
    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.isPaused()).toBe(false);
  });

  it('start() begins scheduling', () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    expect(scheduler.isRunning()).toBe(true);
  });

  it('stop() stops the scheduler', () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('pause() pauses the scheduler', () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    scheduler.pause();
    expect(scheduler.isPaused()).toBe(true);
  });

  it('resume() resumes a paused scheduler', () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    scheduler.pause();
    expect(scheduler.isPaused()).toBe(true);

    scheduler.resume();
    expect(scheduler.isPaused()).toBe(false);
  });

  it('callback fires after the interval', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);

    // Advance past the minInterval
    await vi.advanceTimersByTimeAsync(150);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('callback does not fire while paused', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    scheduler.pause();

    await vi.advanceTimersByTimeAsync(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it('notifyChanges triggers rescheduling with active interval', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);

    scheduler.notifyChanges(3);
    expect(scheduler.getCurrentInterval()).toBe(50);

    await vi.advanceTimersByTimeAsync(60);
    expect(callback).toHaveBeenCalled();
  });

  it('notifyChanges with 0 does not reschedule', () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    const intervalBefore = scheduler.getCurrentInterval();

    scheduler.notifyChanges(0);
    expect(scheduler.getCurrentInterval()).toBe(intervalBefore);
  });

  it('syncNow triggers immediate sync', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);

    await scheduler.syncNow();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('syncNow does nothing without a callback', async () => {
    // Never started, so no callback
    await expect(scheduler.syncNow()).resolves.toBeUndefined();
  });

  it('shouldSync checks network conditions', () => {
    expect(scheduler.shouldSync({ isWifi: true, isCellular: false, batteryLevel: 0.8 })).toBe(true);
  });

  it('shouldSync respects low battery', () => {
    // pauseOnLowBattery defaults to true
    const sched = new SyncScheduler({ pauseOnLowBattery: true });
    expect(sched.shouldSync({ isWifi: true, isCellular: false, batteryLevel: 0.1 })).toBe(false);
  });

  it('shouldSync respects cellular policy', () => {
    const sched = new SyncScheduler({ syncOnCellular: false });
    expect(sched.shouldSync({ isWifi: false, isCellular: true, batteryLevel: 0.8 })).toBe(false);
  });

  it('start() is idempotent', () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.start(callback);
    scheduler.start(callback);
    expect(scheduler.isRunning()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SyncEngine
// ---------------------------------------------------------------------------

describe('SyncEngine', () => {
  const mockDb = {
    execute: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    transaction: vi.fn((fn: Function) => fn()),
  } as any;

  const mockIdentity = {
    publicKey: 'abc123',
    privateKeyRef: 'ref:abc123',
    dhPublicKey: 'dh123',
    displayName: 'Test Device',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createSecurityContextDb() {
    return {
      execute: vi.fn(),
      query: vi.fn((sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM sync_workspaces')) {
          return [{
            id: 'ws-family',
            display_name: 'Family',
            workspace_type: 'group',
            created_by_device_id: mockIdentity.publicKey,
            created_at: '2026-01-01T00:00:00.000Z',
            rotated_at: null,
            current_key_version: 1,
            archived_at: null,
          }];
        }
        if (sql.includes('FROM sync_workspace_members')) {
          return [
            {
              workspace_id: 'ws-family',
              device_id: mockIdentity.publicKey,
              role: 'owner',
              invited_by_device_id: mockIdentity.publicKey,
              invited_at: '2026-01-01T00:00:00.000Z',
              removed_at: null,
            },
            {
              workspace_id: 'ws-family',
              device_id: 'peer-1',
              role: 'member',
              invited_by_device_id: mockIdentity.publicKey,
              invited_at: '2026-01-01T00:00:00.000Z',
              removed_at: null,
            },
          ];
        }
        if (sql.includes('FROM sync_security_preferences')) {
          const [subjectType, subjectId] = params as [string, string];
          if (subjectType === 'workspace' && subjectId === 'ws-family') {
            return [{
              subject_type: 'workspace',
              subject_id: 'ws-family',
              encryption_mode: 'required',
              disappearing_messages_enabled: 1,
              disappear_after_seconds: 86_400,
              updated_at: '2026-01-01T00:00:00.000Z',
            }];
          }
          if (subjectType === 'default' && subjectId === 'default') {
            return [{
              subject_type: 'default',
              subject_id: 'default',
              encryption_mode: 'opportunistic',
              disappearing_messages_enabled: 0,
              disappear_after_seconds: null,
              updated_at: '2026-01-01T00:00:00.000Z',
            }];
          }
        }
        return [];
      }),
      transaction: vi.fn((fn: Function) => fn()),
    } as any;
  }

  it('constructor does not throw', () => {
    expect(() => {
      new SyncEngine({
        db: mockDb,
        identity: mockIdentity,
        modulePrefixes: new Map([['books', 'bk_']]),
        enabledModules: ['books'],
      });
    }).not.toThrow();
  });

  it('getStatus returns idle before initialization', () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    const status = engine.getStatus();
    expect(status.state).toBe('idle');
  });

  it('getStatusStore returns a SyncStatusStore', () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    expect(engine.getStatusStore()).toBeInstanceOf(SyncStatusStore);
  });

  it('uses stricter shared workspace security for peer sessions', () => {
    const engine = new SyncEngine({
      db: createSecurityContextDb(),
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    const context = (engine as any)._getSessionSecurityContext('peer-1');

    expect(context.workspaceId).toBe('ws-family');
    expect(context.securityPreference).toMatchObject({
      subjectType: 'workspace',
      subjectId: 'ws-family',
      encryptionMode: 'required',
      disappearingMessagesEnabled: true,
      disappearAfterSeconds: 86_400,
    });
  });

  it('syncNow throws before initialization', async () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    await expect(engine.syncNow()).rejects.toThrow('SyncEngine not initialized');
  });

  it('recordChange throws before initialization', () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    expect(() => engine.recordChange('bk_books', 'INSERT', 'row1', { title: 'Test' })).toThrow(
      'SyncEngine not initialized',
    );
  });

  it('destroy() can be called without initialization', async () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    await expect(engine.destroy()).resolves.toBeUndefined();
  });

  it('throws after destroy()', async () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    await engine.destroy();

    // syncNow calls _assertInitialized, which checks _initialized first,
    // then _assertNotDestroyed. Since the engine was never initialized,
    // the "not initialized" check fires. But _assertNotDestroyed is also
    // called from initialize(), so try that path instead.
    await expect(engine.initialize()).rejects.toThrow('SyncEngine has been destroyed');
  });

  it('destroy() is idempotent', async () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    await engine.destroy();
    await expect(engine.destroy()).resolves.toBeUndefined();
  });

  it('pause() and resume() do not throw without initialization', () => {
    const engine = new SyncEngine({
      db: mockDb,
      identity: mockIdentity,
      modulePrefixes: new Map(),
      enabledModules: [],
    });

    // pause/resume delegate to the scheduler, which does not require initialization
    expect(() => engine.pause()).not.toThrow();
    expect(() => engine.resume()).not.toThrow();
  });
});
