/**
 * Apple Watch Sync Engine
 *
 * Pure TypeScript logic for Watch-Phone message formatting and command handling.
 * No native WatchConnectivity calls here -- those live in the native Swift bridge.
 */

import type {
  ActiveFast,
  WaterIntake,
  WatchState,
  WatchCommand,
  WatchCommandResult,
} from '../types';
import type { DatabaseAdapter } from '@mylife/db';
import { getCurrentFastingZone } from '../zones';
import { startFast, endFast, getActiveFast } from '../db/fasts';
import { getWaterIntake, incrementWaterIntake } from '../db/water';

// ── Zone Color Mapping ──

const ZONE_COLORS: Record<string, string> = {
  'fed-state': '#6B7280',       // gray
  'early-fasting': '#14B8A6',   // teal (module accent)
  'fat-burning': '#F59E0B',     // amber
  'ketosis-beginning': '#F97316', // orange
  'deep-ketosis': '#EF4444',    // red
  'autophagy-possible': '#8B5CF6', // purple
};

const DEFAULT_ZONE_COLOR = '#14B8A6';

/** Map a fasting zone ID to its display color for the Watch. */
export function mapZoneToWatchColor(zoneId: string): string {
  return ZONE_COLORS[zoneId] ?? DEFAULT_ZONE_COLOR;
}

// ── State Formatting ──

/**
 * Build the WatchState payload to send to the Watch via applicationContext.
 * This is the single source of truth for what the Watch displays.
 */
export function formatWatchState(
  activeFast: ActiveFast | null,
  water: WaterIntake,
  now: Date = new Date(),
): WatchState {
  let activeFastState: WatchState['activeFast'] = null;

  if (activeFast) {
    const elapsedSeconds = Math.floor(
      (now.getTime() - new Date(activeFast.startedAt).getTime()) / 1000,
    );
    const zone = getCurrentFastingZone(elapsedSeconds);

    activeFastState = {
      protocol: activeFast.protocol,
      startedAt: activeFast.startedAt,
      targetHours: activeFast.targetHours,
      zoneName: zone.name,
      zoneColor: mapZoneToWatchColor(zone.id),
    };
  }

  return {
    activeFast: activeFastState,
    waterCount: water.count,
    waterTarget: water.target,
    timestamp: now.toISOString(),
  };
}

// ── Command Handling ──

/**
 * Handle a command from the Apple Watch.
 * Executes the appropriate DB operation and returns updated state.
 */
export function handleWatchCommand(
  db: DatabaseAdapter,
  command: WatchCommand,
  now: Date = new Date(),
): WatchCommandResult {
  const buildState = (): WatchState => {
    const active = getActiveFast(db);
    const water = getWaterIntake(db);
    return formatWatchState(active, water, now);
  };

  switch (command.action) {
    case 'logWater': {
      incrementWaterIntake(db);
      return { success: true, state: buildState() };
    }

    case 'startFast': {
      const existing = getActiveFast(db);
      if (existing) {
        return {
          success: false,
          state: buildState(),
          error: 'A fast is already active',
        };
      }
      const id = `fast-${now.getTime()}`;
      startFast(db, id, command.protocol, command.targetHours, now);
      return { success: true, state: buildState() };
    }

    case 'endFast': {
      const active = getActiveFast(db);
      if (!active) {
        // No error, just return current state (already ended)
        return { success: true, state: buildState() };
      }
      endFast(db, now);
      return { success: true, state: buildState() };
    }

    case 'requestState': {
      return { success: true, state: buildState() };
    }
  }
}
