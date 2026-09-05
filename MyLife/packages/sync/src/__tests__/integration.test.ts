import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncStatusStore } from '../engine/sync-status';
import { SyncScheduler } from '../engine/sync-scheduler';
import { createSyncManager } from '../db-integration';
import type { DeviceIdentity, SyncEngineStatus } from '../types';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockDb() {
  return {
    execute: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    transaction: vi.fn((fn: Function) => fn()),
  } as any;
}

function createDeviceIdentity(label: string): DeviceIdentity {
  return {
    publicKey: `${label}_pub_key`,
    privateKeyRef: `ref:${label}`,
    dhPublicKey: `${label}_dh`,
    displayName: label,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// SyncStatusStore
// ---------------------------------------------------------------------------

describe('SyncStatusStore', () => {
  let store: SyncStatusStore;

  beforeEach(() => {
    store = new SyncStatusStore();
  });

  it('initializes with idle defaults', () => {
    const status = store.getStatus();
    expect(status.state).toBe('idle');
    expect(status.pairedDeviceCount).toBe(0);
    expect(status.onlineDeviceCount).toBe(0);
    expect(status.pendingChanges).toBe(0);
    expect(status.lastSyncAt).toBeNull();
    expect(status.currentSessionId).toBeNull();
  });

  it('updates state and notifies listeners', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState('syncing');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'syncing' }),
    );

    const status = store.getStatus();
    expect(status.state).toBe('syncing');
  });

  it('updates paired device count', () => {
    store.setPairedDeviceCount(3);
    expect(store.getStatus().pairedDeviceCount).toBe(3);
  });

  it('updates online device count', () => {
    store.setOnlineDeviceCount(2);
    expect(store.getStatus().onlineDeviceCount).toBe(2);
  });

  it('updates pending changes', () => {
    store.setPendingChanges(42);
    expect(store.getStatus().pendingChanges).toBe(42);
  });

  it('records a completed sync', () => {
    store.setState('syncing');
    store.setCurrentSession('sess_001');

    store.recordSync('sess_001');
    const status = store.getStatus();
    expect(status.state).toBe('idle');
    expect(status.currentSessionId).toBeNull();
    expect(status.lastSyncAt).not.toBeNull();
  });

  it('returns an immutable snapshot from getStatus()', () => {
    const a = store.getStatus();
    store.setPendingChanges(10);
    const b = store.getStatus();

    expect(a.pendingChanges).toBe(0);
    expect(b.pendingChanges).toBe(10);
  });

  it('unsubscribes correctly', () => {
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.setState('syncing');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.setState('idle');
    // Should not receive the second notification
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple listeners', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    store.subscribe(listenerA);
    store.subscribe(listenerB);

    store.setState('discovering');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  it('propagates updates between two stores tracking different devices', () => {
    const storeA = new SyncStatusStore();
    const storeB = new SyncStatusStore();

    const eventsA: SyncEngineStatus[] = [];
    const eventsB: SyncEngineStatus[] = [];

    storeA.subscribe((s) => eventsA.push(s));
    storeB.subscribe((s) => eventsB.push(s));

    // Simulate device A discovering device B
    storeA.setOnlineDeviceCount(1);
    storeA.setState('connecting');

    // Simulate device B seeing device A
    storeB.setOnlineDeviceCount(1);
    storeB.setState('connecting');

    // Both syncing
    storeA.setState('syncing');
    storeB.setState('syncing');

    // Both complete
    storeA.recordSync('sess_ab_1');
    storeB.recordSync('sess_ba_1');

    expect(eventsA).toHaveLength(4);
    expect(eventsB).toHaveLength(4);

    expect(eventsA[eventsA.length - 1].state).toBe('idle');
    expect(eventsB[eventsB.length - 1].state).toBe('idle');

    expect(storeA.getStatus().lastSyncAt).not.toBeNull();
    expect(storeB.getStatus().lastSyncAt).not.toBeNull();
  });

  describe('useSyncExternalStore helpers', () => {
    it('getSubscribe returns a working subscribe function', () => {
      const subscribeFn = store.getSubscribe();
      const listener = vi.fn();
      const unsub = subscribeFn(listener);

      store.setState('error');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      store.setState('idle');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('getSnapshot returns a function that returns the current status', () => {
      const snapshotFn = store.getSnapshot();
      expect(snapshotFn().state).toBe('idle');

      store.setState('syncing');
      expect(snapshotFn().state).toBe('syncing');
    });
  });
});

// ---------------------------------------------------------------------------
// SyncScheduler
// ---------------------------------------------------------------------------

describe('SyncScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('constructs with default options', () => {
    const scheduler = new SyncScheduler();
    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.isPaused()).toBe(false);
    expect(scheduler.getCurrentInterval()).toBe(30_000);
  });

  it('constructs with custom options', () => {
    const scheduler = new SyncScheduler({
      minIntervalMs: 5_000,
      maxIntervalMs: 60_000,
      activeIntervalMs: 2_000,
    });
    expect(scheduler.getCurrentInterval()).toBe(5_000);
  });

  it('starts and fires the callback after the interval', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({ minIntervalMs: 1_000 });

    scheduler.start(callback);
    expect(scheduler.isRunning()).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops the scheduler and clears the timer', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({ minIntervalMs: 1_000 });

    scheduler.start(callback);
    scheduler.stop();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(callback).not.toHaveBeenCalled();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('pause prevents further callbacks', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({ minIntervalMs: 1_000 });

    scheduler.start(callback);
    scheduler.pause();
    expect(scheduler.isPaused()).toBe(true);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('resume re-enables callbacks after pause', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({ minIntervalMs: 1_000 });

    scheduler.start(callback);
    scheduler.pause();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(callback).not.toHaveBeenCalled();

    scheduler.resume();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('notifyChanges shortens the interval to activeIntervalMs', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({
      minIntervalMs: 10_000,
      activeIntervalMs: 1_000,
    });

    scheduler.start(callback);
    scheduler.notifyChanges(5);

    expect(scheduler.getCurrentInterval()).toBe(1_000);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('syncNow triggers an immediate sync', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({ minIntervalMs: 60_000 });

    scheduler.start(callback);
    await scheduler.syncNow();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('shouldSync respects cellular policy', () => {
    const scheduler = new SyncScheduler({ syncOnCellular: false });
    expect(
      scheduler.shouldSync({ isWifi: false, isCellular: true, batteryLevel: 1.0 }),
    ).toBe(false);
    expect(
      scheduler.shouldSync({ isWifi: true, isCellular: false, batteryLevel: 1.0 }),
    ).toBe(true);
  });

  it('shouldSync respects low battery policy', () => {
    const scheduler = new SyncScheduler({ pauseOnLowBattery: true });
    expect(
      scheduler.shouldSync({ isWifi: true, isCellular: false, batteryLevel: 0.1 }),
    ).toBe(false);
    expect(
      scheduler.shouldSync({ isWifi: true, isCellular: false, batteryLevel: 0.5 }),
    ).toBe(true);
  });

  it('backs off after successful sync', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new SyncScheduler({ minIntervalMs: 1_000, maxIntervalMs: 10_000 });

    scheduler.start(callback);
    const initialInterval = scheduler.getCurrentInterval();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(callback).toHaveBeenCalledTimes(1);

    // After a successful sync, interval should increase (1.5x)
    expect(scheduler.getCurrentInterval()).toBeGreaterThan(initialInterval);
  });
});

// ---------------------------------------------------------------------------
// SyncManager wiring with SyncEngine options
// ---------------------------------------------------------------------------

describe('SyncManager integration', () => {
  it('createSyncManager returns a SyncManager with local_only tier', () => {
    const manager = createSyncManager();
    expect(manager.tier).toBe('local_only');
    expect(manager.provider).toBeNull();
    expect(manager.syncEngine).toBeNull();
  });

  it('initializes with local_only provider successfully', async () => {
    const manager = createSyncManager();
    const provider = await manager.initialize();
    expect(provider.tier).toBe('local_only');
    expect(manager.provider).toBe(provider);
  });

  it('accepts db and identity options for SyncEngine construction', () => {
    const mockDb = createMockDb();
    const identity = createDeviceIdentity('Device A');

    const manager = createSyncManager({
      db: mockDb,
      identity,
      modulePrefixes: new Map([['books', 'bk_'], ['budget', 'bg_']]),
      enabledModules: ['books', 'budget'],
    });

    // Manager created successfully with engine options ready
    expect(manager.tier).toBe('local_only');
    expect(manager.syncEngine).toBeNull();
  });

  it('destroy tears down cleanly even when no provider initialized', async () => {
    const manager = createSyncManager();
    await expect(manager.destroy()).resolves.toBeUndefined();
    expect(manager.provider).toBeNull();
  });

  it('destroy tears down an initialized local_only provider', async () => {
    const manager = createSyncManager();
    await manager.initialize();
    expect(manager.provider).not.toBeNull();

    await manager.destroy();
    expect(manager.provider).toBeNull();
    expect(manager.tier).toBe('local_only');
  });

  it('switchTier rejects p2p without a factory', async () => {
    const mockDb = createMockDb();
    const identity = createDeviceIdentity('Device A');

    const manager = createSyncManager({
      db: mockDb,
      identity,
      enabledModules: ['books'],
    });
    await manager.initialize();

    await expect(manager.switchTier('p2p')).rejects.toThrow('P2P sync is not available');
  });
});

// ---------------------------------------------------------------------------
// Cross-subsystem wiring: StatusStore + Scheduler together
// ---------------------------------------------------------------------------

describe('StatusStore + Scheduler cross-wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scheduler callback can update status store', async () => {
    const statusStore = new SyncStatusStore();
    const scheduler = new SyncScheduler({ minIntervalMs: 500 });

    const statusUpdates: SyncEngineStatus[] = [];
    statusStore.subscribe((s) => statusUpdates.push(s));

    scheduler.start(async () => {
      statusStore.setState('syncing');
      // Simulate sync work
      statusStore.setPendingChanges(0);
      statusStore.recordSync(`sess_${Date.now()}`);
    });

    await vi.advanceTimersByTimeAsync(500);

    // Should have recorded: syncing -> pendingChanges(0) -> recordSync(idle)
    expect(statusUpdates.length).toBeGreaterThanOrEqual(3);
    expect(statusUpdates[0].state).toBe('syncing');
    expect(statusUpdates[statusUpdates.length - 1].state).toBe('idle');
    expect(statusUpdates[statusUpdates.length - 1].lastSyncAt).not.toBeNull();

    scheduler.stop();
  });

  it('notifyChanges on scheduler + setPendingChanges on store stay consistent', async () => {
    const statusStore = new SyncStatusStore();
    const scheduler = new SyncScheduler({
      minIntervalMs: 10_000,
      activeIntervalMs: 500,
    });

    let syncCycleRan = false;

    scheduler.start(async () => {
      syncCycleRan = true;
      statusStore.setState('syncing');
      statusStore.setPendingChanges(0);
      statusStore.recordSync(`sess_${Date.now()}`);
    });

    // Simulate a module recording 5 changes
    statusStore.setPendingChanges(5);
    scheduler.notifyChanges(5);

    expect(statusStore.getStatus().pendingChanges).toBe(5);
    expect(scheduler.getCurrentInterval()).toBe(500);

    // Advance to trigger the active-interval sync
    await vi.advanceTimersByTimeAsync(500);

    expect(syncCycleRan).toBe(true);
    expect(statusStore.getStatus().pendingChanges).toBe(0);
    expect(statusStore.getStatus().state).toBe('idle');

    scheduler.stop();
  });
});

// ---------------------------------------------------------------------------
// Two-device mock scenario
// ---------------------------------------------------------------------------

describe('Two-device mock scenario', () => {
  it('two SyncStatusStores can independently track status for two devices', () => {
    const deviceA = createDeviceIdentity('Device A');
    const deviceB = createDeviceIdentity('Device B');

    const storeA = new SyncStatusStore();
    const storeB = new SyncStatusStore();

    // Device A pairs with Device B
    storeA.setPairedDeviceCount(1);
    storeB.setPairedDeviceCount(1);

    // Both discover each other
    storeA.setOnlineDeviceCount(1);
    storeB.setOnlineDeviceCount(1);

    // Simulate sync
    storeA.setState('syncing');
    storeA.setCurrentSession('sess_a_to_b');
    storeB.setState('syncing');
    storeB.setCurrentSession('sess_b_to_a');

    // Both complete
    storeA.recordSync('sess_a_to_b');
    storeB.recordSync('sess_b_to_a');

    const statusA = storeA.getStatus();
    const statusB = storeB.getStatus();

    expect(statusA.state).toBe('idle');
    expect(statusB.state).toBe('idle');
    expect(statusA.pairedDeviceCount).toBe(1);
    expect(statusB.pairedDeviceCount).toBe(1);
    expect(statusA.onlineDeviceCount).toBe(1);
    expect(statusB.onlineDeviceCount).toBe(1);
    expect(statusA.lastSyncAt).not.toBeNull();
    expect(statusB.lastSyncAt).not.toBeNull();

    // Verify identity objects are distinct
    expect(deviceA.publicKey).not.toBe(deviceB.publicKey);
  });

  it('two SyncManagers with different identities can initialize independently', async () => {
    const dbA = createMockDb();
    const dbB = createMockDb();
    const identityA = createDeviceIdentity('Device A');
    const identityB = createDeviceIdentity('Device B');

    const managerA = createSyncManager({
      db: dbA,
      identity: identityA,
      modulePrefixes: new Map([['books', 'bk_']]),
      enabledModules: ['books'],
    });

    const managerB = createSyncManager({
      db: dbB,
      identity: identityB,
      modulePrefixes: new Map([['books', 'bk_']]),
      enabledModules: ['books'],
    });

    const providerA = await managerA.initialize('local_only');
    const providerB = await managerB.initialize('local_only');

    expect(providerA.tier).toBe('local_only');
    expect(providerB.tier).toBe('local_only');

    // Both can tear down independently
    await managerA.destroy();
    await managerB.destroy();

    expect(managerA.provider).toBeNull();
    expect(managerB.provider).toBeNull();
  });
});
