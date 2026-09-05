import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FAST_MODULE } from '../definition';
import {
  formatWatchState,
  handleWatchCommand,
  mapZoneToWatchColor,
} from '../engines/watch-sync';
import { getWaterIntake, incrementWaterIntake } from '../db/water';
import type { ActiveFast, WaterIntake } from '../types';

describe('Watch Sync Engine', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('fast', FAST_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ── mapZoneToWatchColor ──

  describe('mapZoneToWatchColor', () => {
    it('maps fed-state to gray', () => {
      expect(mapZoneToWatchColor('fed-state')).toBe('#6B7280');
    });

    it('maps early-fasting to teal', () => {
      expect(mapZoneToWatchColor('early-fasting')).toBe('#14B8A6');
    });

    it('maps fat-burning to amber', () => {
      expect(mapZoneToWatchColor('fat-burning')).toBe('#F59E0B');
    });

    it('maps ketosis-beginning to orange', () => {
      expect(mapZoneToWatchColor('ketosis-beginning')).toBe('#F97316');
    });

    it('maps deep-ketosis to red', () => {
      expect(mapZoneToWatchColor('deep-ketosis')).toBe('#EF4444');
    });

    it('maps autophagy-possible to purple', () => {
      expect(mapZoneToWatchColor('autophagy-possible')).toBe('#8B5CF6');
    });

    it('returns default color for unknown zone ID', () => {
      expect(mapZoneToWatchColor('unknown-zone')).toBe('#14B8A6');
    });
  });

  // ── formatWatchState ──

  describe('formatWatchState', () => {
    it('with active fast, produces correct WatchState with zone info', () => {
      const now = new Date('2026-03-22T14:00:00Z');
      const activeFast: ActiveFast = {
        id: 'current',
        fastId: 'f1',
        protocol: '16:8',
        targetHours: 16,
        startedAt: '2026-03-22T08:00:00Z', // 6 hours ago -> early-fasting zone
      };
      const water: WaterIntake = {
        date: '2026-03-22',
        count: 5,
        target: 8,
        completed: false,
        updatedAt: '2026-03-22T12:00:00Z',
      };

      const state = formatWatchState(activeFast, water, now);

      expect(state.activeFast).not.toBeNull();
      expect(state.activeFast!.protocol).toBe('16:8');
      expect(state.activeFast!.startedAt).toBe('2026-03-22T08:00:00Z');
      expect(state.activeFast!.targetHours).toBe(16);
      expect(state.activeFast!.zoneName).toBe('Early Fasting');
      expect(state.activeFast!.zoneColor).toBe('#14B8A6');
      expect(state.waterCount).toBe(5);
      expect(state.waterTarget).toBe(8);
      expect(state.timestamp).toBe(now.toISOString());
    });

    it('with no active fast, produces WatchState with activeFast null', () => {
      const now = new Date('2026-03-22T14:00:00Z');
      const water: WaterIntake = {
        date: '2026-03-22',
        count: 3,
        target: 10,
        completed: false,
        updatedAt: '2026-03-22T10:00:00Z',
      };

      const state = formatWatchState(null, water, now);

      expect(state.activeFast).toBeNull();
      expect(state.waterCount).toBe(3);
      expect(state.waterTarget).toBe(10);
    });

    it('includes correct water count and target', () => {
      const water: WaterIntake = {
        date: '2026-03-22',
        count: 8,
        target: 8,
        completed: true,
        updatedAt: '2026-03-22T18:00:00Z',
      };

      const state = formatWatchState(null, water);

      expect(state.waterCount).toBe(8);
      expect(state.waterTarget).toBe(8);
    });
  });

  // ── handleWatchCommand (integration with DB) ──

  describe('handleWatchCommand', () => {
    const now = new Date('2026-03-22T14:00:00Z');

    it('logWater increments water count and returns updated state', () => {
      const result = handleWatchCommand(adapter, { action: 'logWater' }, now);

      expect(result.success).toBe(true);
      expect(result.state.waterCount).toBe(1);
    });

    it('logWater increments multiple times', () => {
      handleWatchCommand(adapter, { action: 'logWater' }, now);
      handleWatchCommand(adapter, { action: 'logWater' }, now);
      const result = handleWatchCommand(adapter, { action: 'logWater' }, now);

      expect(result.success).toBe(true);
      expect(result.state.waterCount).toBe(3);
    });

    it('startFast creates a fast and returns state with active fast', () => {
      const result = handleWatchCommand(adapter, {
        action: 'startFast',
        protocol: '16:8',
        targetHours: 16,
      }, now);

      expect(result.success).toBe(true);
      expect(result.state.activeFast).not.toBeNull();
      expect(result.state.activeFast!.protocol).toBe('16:8');
      expect(result.state.activeFast!.targetHours).toBe(16);
    });

    it('startFast returns error when fast already active', () => {
      // Start first fast
      handleWatchCommand(adapter, {
        action: 'startFast',
        protocol: '16:8',
        targetHours: 16,
      }, now);

      // Try to start second fast
      const result = handleWatchCommand(adapter, {
        action: 'startFast',
        protocol: '18:6',
        targetHours: 18,
      }, now);

      expect(result.success).toBe(false);
      expect(result.error).toBe('A fast is already active');
      // Original fast is still active
      expect(result.state.activeFast!.protocol).toBe('16:8');
    });

    it('endFast ends the fast and returns state with no active fast', () => {
      // Start a fast first
      handleWatchCommand(adapter, {
        action: 'startFast',
        protocol: '16:8',
        targetHours: 16,
      }, now);

      const laterNow = new Date('2026-03-23T06:00:00Z');
      const result = handleWatchCommand(adapter, { action: 'endFast' }, laterNow);

      expect(result.success).toBe(true);
      expect(result.state.activeFast).toBeNull();
    });

    it('endFast returns success with no active fast (idempotent)', () => {
      const result = handleWatchCommand(adapter, { action: 'endFast' }, now);

      expect(result.success).toBe(true);
      expect(result.state.activeFast).toBeNull();
    });

    it('requestState returns current state without mutations', () => {
      // Log some water
      incrementWaterIntake(adapter);
      incrementWaterIntake(adapter);

      const result = handleWatchCommand(adapter, { action: 'requestState' }, now);

      expect(result.success).toBe(true);
      expect(result.state.waterCount).toBe(2);
      expect(result.state.activeFast).toBeNull();

      // Verify nothing was mutated
      const water = getWaterIntake(adapter);
      expect(water.count).toBe(2);
    });

    it('full flow: start fast, log water, end fast', () => {
      // Start fast
      const start = handleWatchCommand(adapter, {
        action: 'startFast',
        protocol: '16:8',
        targetHours: 16,
      }, now);
      expect(start.state.activeFast).not.toBeNull();

      // Log water
      const water = handleWatchCommand(adapter, { action: 'logWater' }, now);
      expect(water.state.waterCount).toBe(1);
      expect(water.state.activeFast).not.toBeNull();

      // End fast
      const end = handleWatchCommand(adapter, { action: 'endFast' }, now);
      expect(end.state.activeFast).toBeNull();
      expect(end.state.waterCount).toBe(1); // water preserved
    });
  });
});
