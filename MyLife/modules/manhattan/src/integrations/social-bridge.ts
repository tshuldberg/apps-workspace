// ── Social Bridge ───────────────────────────────────────────────────
// Pure, decoupled mapping from a Manhattan plan to the input shape that
// @mylife/social's generateManhattanPlanCard expects.
//
// This stays standalone-safe: it imports NOTHING from @mylife/social. The
// input shape (ManhattanPlanShareInput) is defined locally so the hub caller
// can hand the result straight to generateManhattanPlanCard. The bridge never
// touches social data or any DB.

import type { PlanRow } from '../types';

/** Shape the app passes to @mylife/social's generateManhattanPlanCard. */
export interface ManhattanPlanShareInput {
  title: string;
  location: string;
  eventCount: number;
  duration?: string;
}

const DEFAULT_LOCATION = 'New York';
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * Compute a human duration string from two ISO timestamps.
 *
 * - under a day -> rounded whole minutes ('NN min')
 * - a day or more -> rounded whole days ('N day' / 'N days')
 * - non-positive or unparseable span -> undefined
 */
function computeDuration(startAt: string, endAt: string): string | undefined {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  const span = end - start;
  if (span <= 0) return undefined;
  if (span < MS_PER_DAY) {
    const minutes = Math.round(span / MS_PER_MINUTE);
    return `${minutes} min`;
  }
  const days = Math.round(span / MS_PER_DAY);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Build a ManhattanPlanShareInput from a plan plus optional overrides.
 *
 * - title: plan.title (passthrough)
 * - location: opts.location, defaulting to 'New York'
 * - eventCount: opts.eventCount, defaulting to 0
 * - duration: computed from start_at/end_at when both are present and the
 *   span is positive; otherwise omitted (undefined)
 */
export function buildPlanShareInput(
  plan: Pick<PlanRow, 'title' | 'start_at' | 'end_at'>,
  opts?: { location?: string; eventCount?: number },
): ManhattanPlanShareInput {
  const input: ManhattanPlanShareInput = {
    title: plan.title,
    location: opts?.location ?? DEFAULT_LOCATION,
    eventCount: opts?.eventCount ?? 0,
  };

  if (plan.start_at && plan.end_at) {
    const duration = computeDuration(plan.start_at, plan.end_at);
    if (duration !== undefined) input.duration = duration;
  }

  return input;
}
