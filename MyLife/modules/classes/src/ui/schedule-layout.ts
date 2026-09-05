import { DAY_ORDER, type Day, type DayTime } from '../models/schemas';
import type { ClassRow, ScheduleConflict } from '../models/schemas';
import type { ScheduledBlock } from '../db/crud/classes';

export const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const ALL_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export interface HourWindow {
  startHour: number;
  endHour: number;
}

export const DEFAULT_HOUR_WINDOW: HourWindow = { startHour: 7, endHour: 22 };

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Compute the smallest hour window that fits every block in the schedule,
 * clamped to the supplied default. Always rounds down to the nearest hour
 * for the start and up for the end. Returns the default when blocks list is
 * empty so the grid still has a sensible shape on a fresh semester.
 */
export function computeHourWindow(
  blocks: ScheduledBlock[],
  fallback: HourWindow = DEFAULT_HOUR_WINDOW,
): HourWindow {
  if (blocks.length === 0) return fallback;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const { block } of blocks) {
    earliest = Math.min(earliest, timeToMinutes(block.start_time));
    latest = Math.max(latest, timeToMinutes(block.end_time));
  }
  const startHour = Math.min(fallback.startHour, Math.floor(earliest / 60));
  const endHour = Math.max(fallback.endHour, Math.ceil(latest / 60));
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

/**
 * Group scheduled blocks by day-of-week. Days with no entries return [].
 */
export function groupBlocksByDay(
  blocks: ScheduledBlock[],
): Record<Day, ScheduledBlock[]> {
  const acc: Record<Day, ScheduledBlock[]> = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
  for (const item of blocks) {
    acc[item.block.day].push(item);
  }
  for (const key of Object.keys(acc) as Day[]) {
    acc[key].sort((l, r) =>
      l.block.start_time === r.block.start_time
        ? 0
        : l.block.start_time < r.block.start_time
          ? -1
          : 1,
    );
  }
  return acc;
}

/**
 * Given a hour window, return an array of every full hour in it (inclusive of
 * start, exclusive of end) for hour-row labelling.
 */
export function getHourRows(window: HourWindow): number[] {
  const rows: number[] = [];
  for (let hour = window.startHour; hour < window.endHour; hour += 1) {
    rows.push(hour);
  }
  return rows;
}

export interface BlockPosition {
  topPct: number; // 0-100, measured from top of the day column
  heightPct: number; // 0-100, total height % of column
}

/**
 * Convert a class block into a percentage-based position within the
 * supplied hour window. Useful for absolute-positioned grids on both
 * mobile (height-driven) and web (CSS grid + offset).
 */
export function getBlockPosition(
  block: DayTime,
  window: HourWindow,
): BlockPosition {
  const windowStart = window.startHour * 60;
  const windowEnd = window.endHour * 60;
  const span = Math.max(1, windowEnd - windowStart);
  const start = Math.max(windowStart, timeToMinutes(block.start_time));
  const end = Math.min(windowEnd, timeToMinutes(block.end_time));
  const top = ((start - windowStart) / span) * 100;
  const height = (Math.max(0, end - start) / span) * 100;
  return { topPct: top, heightPct: height };
}

/**
 * Returns the numeric percentage of the supplied window where the given
 * minute offset falls; <0 or >100 when outside. Useful for the live "now"
 * indicator line.
 */
export function getNowLinePosition(
  nowMinutes: number,
  window: HourWindow,
): number {
  const windowStart = window.startHour * 60;
  const windowEnd = window.endHour * 60;
  const span = Math.max(1, windowEnd - windowStart);
  return ((nowMinutes - windowStart) / span) * 100;
}

/**
 * Given a JS Date, return its day key. Sunday=sun, Monday=mon, etc.
 * Mirrors the DAY_ORDER mapping (Mon-first) used for sorting.
 */
const JS_DAY_TO_KEY: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function getDayKey(date: Date): Day {
  return JS_DAY_TO_KEY[date.getDay()];
}

/**
 * Build a quick lookup of conflict pairs by class-id so blocks can paint a
 * warning ring. Each conflicting class id maps to the list of overlapping
 * class ids (other side of the conflict) plus the day(s) involved.
 */
export interface ConflictIndexEntry {
  otherId: string;
  otherName: string;
  day: Day;
  overlap_minutes: number;
}

export function buildConflictIndex(
  conflicts: ScheduleConflict[],
): Map<string, ConflictIndexEntry[]> {
  const map = new Map<string, ConflictIndexEntry[]>();
  for (const conflict of conflicts) {
    const aEntries = map.get(conflict.a.id) ?? [];
    aEntries.push({
      otherId: conflict.b.id,
      otherName: conflict.b.name,
      day: conflict.day,
      overlap_minutes: conflict.overlap_minutes,
    });
    map.set(conflict.a.id, aEntries);

    const bEntries = map.get(conflict.b.id) ?? [];
    bEntries.push({
      otherId: conflict.a.id,
      otherName: conflict.a.name,
      day: conflict.day,
      overlap_minutes: conflict.overlap_minutes,
    });
    map.set(conflict.b.id, bEntries);
  }
  return map;
}

/**
 * Decide which days of the week have at least one block. Used to collapse
 * empty days on narrow viewports.
 */
export function getActiveDays(blocks: ScheduledBlock[]): Day[] {
  const seen = new Set<Day>();
  for (const item of blocks) seen.add(item.block.day);
  return ALL_DAYS.filter((d) => seen.has(d)).sort(
    (a, b) => DAY_ORDER[a] - DAY_ORDER[b],
  );
}

export type { Day, DayTime, ScheduledBlock, ScheduleConflict, ClassRow };
