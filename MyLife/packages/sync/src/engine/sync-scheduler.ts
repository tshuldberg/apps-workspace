/**
 * Sync scheduler: decides when and how often to sync.
 *
 * Battery-aware and network-aware. Schedules sync cycles based on
 * pending changes, peer availability, and device conditions.
 */

export interface SchedulerOptions {
  /** Minimum interval between sync attempts (ms). Default: 30 seconds. */
  minIntervalMs?: number;
  /** Maximum interval between sync attempts (ms). Default: 5 minutes. */
  maxIntervalMs?: number;
  /** Interval when there are pending changes (ms). Default: 10 seconds. */
  activeIntervalMs?: number;
  /** Whether to sync when on cellular. Default: true (for CRDT data). */
  syncOnCellular?: boolean;
  /** Whether to skip sync when battery is low (<20%). Default: true. */
  pauseOnLowBattery?: boolean;
}

export type SchedulerCallback = () => Promise<void>;

/**
 * Adaptive sync scheduler.
 *
 * Uses exponential backoff when idle, switches to active interval
 * when changes are pending. Respects network and battery conditions.
 */
export class SyncScheduler {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _running: boolean = false;
  private _paused: boolean = false;
  private _lastSyncAt: number = 0;
  private _pendingChanges: number = 0;
  private _currentInterval: number;
  private _callback: SchedulerCallback | null = null;

  private readonly _minInterval: number;
  private readonly _maxInterval: number;
  private readonly _activeInterval: number;
  private readonly _syncOnCellular: boolean;
  private readonly _pauseOnLowBattery: boolean;

  constructor(options: SchedulerOptions = {}) {
    this._minInterval = options.minIntervalMs ?? 30_000;
    this._maxInterval = options.maxIntervalMs ?? 300_000;
    this._activeInterval = options.activeIntervalMs ?? 10_000;
    this._syncOnCellular = options.syncOnCellular ?? true;
    this._pauseOnLowBattery = options.pauseOnLowBattery ?? true;
    this._currentInterval = this._minInterval;
  }

  /** Start the scheduler with a sync callback. */
  start(callback: SchedulerCallback): void {
    if (this._running) return;
    this._callback = callback;
    this._running = true;
    this._scheduleNext();
  }

  /** Stop the scheduler. */
  stop(): void {
    this._running = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** Pause syncing (e.g., when app goes to background). */
  pause(): void {
    this._paused = true;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** Resume syncing. */
  resume(): void {
    this._paused = false;
    if (this._running) {
      this._scheduleNext();
    }
  }

  /** Notify the scheduler that changes are pending. Shortens the interval. */
  notifyChanges(count: number): void {
    this._pendingChanges = count;
    if (this._running && !this._paused && count > 0) {
      // Reschedule with active interval
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this._currentInterval = this._activeInterval;
      this._scheduleNext();
    }
  }

  /** Trigger an immediate sync (bypasses the timer). */
  async syncNow(): Promise<void> {
    if (!this._callback) return;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    await this._runSync();
  }

  /** Get the current scheduling interval. */
  getCurrentInterval(): number {
    return this._currentInterval;
  }

  /** Check if the scheduler is running. */
  isRunning(): boolean {
    return this._running;
  }

  /** Check if the scheduler is paused. */
  isPaused(): boolean {
    return this._paused;
  }

  /** Check if conditions allow syncing. */
  shouldSync(conditions: { isWifi: boolean; isCellular: boolean; batteryLevel: number }): boolean {
    if (!conditions.isWifi && conditions.isCellular && !this._syncOnCellular) {
      return false;
    }
    if (this._pauseOnLowBattery && conditions.batteryLevel < 0.2) {
      return false;
    }
    return true;
  }

  private _scheduleNext(): void {
    if (!this._running || this._paused) return;
    this._timer = setTimeout(() => this._runSync(), this._currentInterval);
  }

  private async _runSync(): Promise<void> {
    if (!this._running || this._paused || !this._callback) return;

    try {
      await this._callback();
      this._lastSyncAt = Date.now();
      this._pendingChanges = 0;

      // Back off when idle
      this._currentInterval = Math.min(
        this._currentInterval * 1.5,
        this._maxInterval,
      );
    } catch {
      // On error, back off more aggressively
      this._currentInterval = Math.min(
        this._currentInterval * 2,
        this._maxInterval,
      );
    }

    this._scheduleNext();
  }
}
