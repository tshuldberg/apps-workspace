/**
 * Polling cadence helper for the sports scoreboard.
 *
 * Pure TS -- no React Native, DOM, or timer APIs. The UI layer owns the
 * actual `setInterval` + AppState / visibilitychange teardown; this module
 * just tells the UI how often to refresh given the current set of games.
 *
 * Cadence rules (matches P1-B card):
 *   - LIVE_INTERVAL_MS (30s)  -- at least one game is currently live
 *   - SOON_INTERVAL_MS (5m)   -- at least one scheduled game starts in <= 2h
 *   - IDLE_INTERVAL_MS (1h)   -- nothing interesting right now
 */

import type { Game } from '../types';

export const LIVE_INTERVAL_MS = 30_000;
export const SOON_INTERVAL_MS = 300_000;
export const IDLE_INTERVAL_MS = 3_600_000;

/** Window (ms) inside which an upcoming game is considered "soon". */
export const SOON_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface PickIntervalOptions {
  /** Override the current clock in tests. */
  now?: number;
}

/**
 * Pick the next polling interval (ms) based on the supplied games.
 *
 * - Any live game -> LIVE_INTERVAL_MS
 * - Else any scheduled game starting within SOON_WINDOW_MS -> SOON_INTERVAL_MS
 * - Else -> IDLE_INTERVAL_MS
 */
export function pickInterval(
  games: readonly Game[] = [],
  opts: PickIntervalOptions = {},
): number {
  const now = opts.now ?? Date.now();
  let hasLive = false;
  let hasSoon = false;

  for (const g of games) {
    if (g.status === 'live') {
      hasLive = true;
      break;
    }
    if (g.status === 'scheduled') {
      const delta = g.startAt - now;
      if (delta >= 0 && delta <= SOON_WINDOW_MS) {
        hasSoon = true;
      }
    }
  }

  if (hasLive) return LIVE_INTERVAL_MS;
  if (hasSoon) return SOON_INTERVAL_MS;
  return IDLE_INTERVAL_MS;
}
