/**
 * Pure commute / travel-buffer engine for MyClasses.
 *
 * No DB, no React, no platform imports. Operates on lightweight
 * `ClassLite` rows so callers can pass either ClassRow (after parsing
 * day_times) or any equivalent shape.
 *
 * Surfaces three statuses for each consecutive (A → B) pair on a given day:
 *   - `comfortable` — gap >= travel + tightThreshold
 *   - `tight`       — travel <= gap < travel + tightThreshold
 *   - `impossible`  — gap < travel
 *
 * Same-building hops use a reduced travel estimate (still walking between
 * rooms). Pairs separated by more than 60 minutes are treated as a free
 * gap and are not emitted.
 */

import type { Day } from '../models/schemas';

export type { Day };

export interface ClassLite {
  id: string;
  name: string;
  building?: string | null;
  room?: string | null;
  day_times: Array<{ day: Day; start_time: string; end_time: string }>;
}

export interface CommuteOptions {
  /** Default travel minutes between two distinct buildings. */
  defaultTravelMinutes: number;
  /** Optional matrix: buildingFrom → buildingTo → travel minutes. */
  buildingTravelOverrides?: Record<string, Record<string, number>>;
  /** gap < (travel + tight) → 'tight'. Defaults to 5. */
  tightThresholdMinutes?: number;
  /** Reserved: gap < travel → 'impossible' (currently always uses travel). */
  impossibleThresholdMinutes?: number;
  /** If gap > this, treat as a free period (not a commute). Defaults to 60. */
  longGapMinutes?: number;
}

export interface CommuteHopEndpoint {
  class_id: string;
  class_name: string;
  building?: string | null;
  room?: string | null;
}

export interface CommuteHop {
  from: CommuteHopEndpoint & { end_time: string };
  to: CommuteHopEndpoint & { start_time: string };
  day: Day;
  gap_minutes: number;
  travel_minutes: number;
  status: 'comfortable' | 'tight' | 'impossible';
  message: string;
}

export interface CommuteSummary {
  total: number;
  tight: number;
  impossible: number;
  by_day: Record<Day, number>;
}

const ALL_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const EMPTY_BY_DAY = (): Record<Day, number> => ({
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
});

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((p) => Number.parseInt(p, 10));
  return h * 60 + m;
}

function resolveTravelMinutes(
  from: ClassLite,
  to: ClassLite,
  opts: CommuteOptions,
): number {
  const def = opts.defaultTravelMinutes;
  const fromB = from.building ?? null;
  const toB = to.building ?? null;

  // Same building: still walk between rooms, but use a reduced estimate.
  if (fromB && toB && fromB === toB) {
    return Math.max(2, Math.floor(def / 4));
  }

  if (fromB && toB && opts.buildingTravelOverrides) {
    const row = opts.buildingTravelOverrides[fromB];
    const override = row?.[toB];
    if (typeof override === 'number') return override;
  }

  return def;
}

function buildMessage(hop: Omit<CommuteHop, 'message'>): string {
  const fromLabel = hop.from.class_name +
    (hop.from.building ? ` (${hop.from.building})` : '');
  const toLabel = hop.to.class_name +
    (hop.to.building ? ` (${hop.to.building})` : '');
  return `${hop.gap_minutes} min between ${fromLabel} and ${toLabel}; travel ~${hop.travel_minutes} min`;
}

interface DaySlot {
  cls: ClassLite;
  start_time: string;
  end_time: string;
}

/**
 * computeCommutes: for each day, walk back-to-back class pairs and emit
 * one CommuteHop per pair where a commute warning is meaningful.
 */
export function computeCommutes(
  classes: ClassLite[],
  opts: CommuteOptions,
): CommuteHop[] {
  if (classes.length === 0) return [];

  const tight = opts.tightThresholdMinutes ?? 5;
  const longGap = opts.longGapMinutes ?? 60;

  const byDay = new Map<Day, DaySlot[]>();
  for (const cls of classes) {
    for (const block of cls.day_times) {
      const list = byDay.get(block.day) ?? [];
      list.push({
        cls,
        start_time: block.start_time,
        end_time: block.end_time,
      });
      byDay.set(block.day, list);
    }
  }

  const hops: CommuteHop[] = [];

  for (const day of ALL_DAYS) {
    const slots = byDay.get(day);
    if (!slots || slots.length < 2) continue;
    slots.sort(
      (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
    );

    for (let i = 0; i < slots.length - 1; i += 1) {
      const from = slots[i];
      const to = slots[i + 1];
      const gap = timeToMinutes(to.start_time) - timeToMinutes(from.end_time);
      if (gap < 0) continue; // overlap; conflict-detector handles it
      if (gap > longGap) continue; // free period, not a commute

      const travel = resolveTravelMinutes(from.cls, to.cls, opts);

      let status: CommuteHop['status'];
      if (gap < travel) status = 'impossible';
      else if (gap < travel + tight) status = 'tight';
      else status = 'comfortable';

      const partial: Omit<CommuteHop, 'message'> = {
        from: {
          class_id: from.cls.id,
          class_name: from.cls.name,
          building: from.cls.building ?? null,
          room: from.cls.room ?? null,
          end_time: from.end_time,
        },
        to: {
          class_id: to.cls.id,
          class_name: to.cls.name,
          building: to.cls.building ?? null,
          room: to.cls.room ?? null,
          start_time: to.start_time,
        },
        day,
        gap_minutes: gap,
        travel_minutes: travel,
        status,
      };

      hops.push({ ...partial, message: buildMessage(partial) });
    }
  }

  return hops;
}

/**
 * summarizeCommutes: aggregate counts (total, tight, impossible) and
 * per-day totals. `by_day` always contains every Day key.
 */
export function summarizeCommutes(hops: CommuteHop[]): CommuteSummary {
  const summary: CommuteSummary = {
    total: hops.length,
    tight: 0,
    impossible: 0,
    by_day: EMPTY_BY_DAY(),
  };
  for (const hop of hops) {
    if (hop.status === 'tight') summary.tight += 1;
    if (hop.status === 'impossible') summary.impossible += 1;
    summary.by_day[hop.day] += 1;
  }
  return summary;
}

/**
 * worstCommuteOfWeek: the most painful hop. Impossible ranks above tight,
 * which ranks above comfortable. Ties broken by smallest gap_minutes.
 */
export function worstCommuteOfWeek(hops: CommuteHop[]): CommuteHop | null {
  if (hops.length === 0) return null;
  const rank: Record<CommuteHop['status'], number> = {
    impossible: 2,
    tight: 1,
    comfortable: 0,
  };
  let worst = hops[0];
  for (let i = 1; i < hops.length; i += 1) {
    const candidate = hops[i];
    if (rank[candidate.status] > rank[worst.status]) {
      worst = candidate;
    } else if (
      rank[candidate.status] === rank[worst.status] &&
      candidate.gap_minutes < worst.gap_minutes
    ) {
      worst = candidate;
    }
  }
  return worst;
}
