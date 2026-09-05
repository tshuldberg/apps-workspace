import type { WaitlistEntry, QuoteRange } from './types';

const BUFFER_FACTOR = 1.2; // 20% under-promise buffer

/**
 * Estimate wait time based on position and average turn rate.
 * Adds a 20% buffer (under-promise, over-deliver).
 */
export function estimateWait(position: number, avgTurnMinutes: number): QuoteRange {
  const baseWait = position * avgTurnMinutes;
  const buffered = Math.ceil(baseWait * BUFFER_FACTOR);

  return {
    min: Math.max(0, baseWait),
    max: Math.max(0, buffered),
  };
}

/**
 * Recalculate positions for all active (waiting) entries.
 * Entries are ordered by joinedAt. Only 'waiting' entries get positions.
 */
export function recalculatePositions(entries: WaitlistEntry[]): WaitlistEntry[] {
  let position = 1;
  return entries.map((entry) => {
    if (entry.status === 'waiting') {
      return { ...entry, position: position++ };
    }
    return { ...entry, position: null };
  });
}
