/**
 * Classes bridge: pure, standalone-first capture of recurring class meetings
 * into Manhattan events. The hub supplies the class rows and semester (Manhattan
 * has no class data locally); this maps them to `EventInput[]`.
 *
 * Recurrence is materialized as the FIRST instance only -- `mh_events` has no
 * recurrence column. Each unique `start_time|end_time` bucket within a class's
 * `day_times` becomes one event, anchored to the first occurrence of its
 * weekday on-or-after `semester.start_date`. Times are floating local
 * (`YYYY-MM-DDTHH:mm:00`, no timezone suffix) so the consumer renders in the
 * user's own timezone.
 *
 * No Expo / FS / DB access. Cross-package types are `import type` only.
 */

import type { ClassRow, DayTime, SemesterRow } from '@mylife/classes';
import type { EventInput } from '../types';

const DAY_INDEX: Record<DayTime['day'], number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Pure date math: roll an ISO date (YYYY-MM-DD or full ISO) forward to the
 * first occurrence of `day` on-or-after it. Returns YYYY-MM-DD. Uses UTC noon
 * internally to dodge DST edges; no timezone library.
 */
export function firstWeekdayOnOrAfter(isoDate: string, day: DayTime['day']): string {
  const ymd = isoDate.slice(0, 10);
  const [y, m, d] = ymd.split('-').map((p) => Number.parseInt(p, 10));
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const target = DAY_INDEX[day];
  const current = base.getUTCDay();
  const delta = (target - current + 7) % 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(
    base.getUTCDate(),
  )}`;
}

function parseDayTimes(raw: string | null | undefined): DayTime[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DayTime[]) : [];
  } catch {
    return [];
  }
}

interface Bucket {
  start_time: string;
  end_time: string;
  days: DayTime['day'][];
}

function bucketDayTimes(blocks: DayTime[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const block of blocks) {
    const key = `${block.start_time}|${block.end_time}`;
    const existing = map.get(key);
    if (existing) {
      if (!existing.days.includes(block.day)) existing.days.push(block.day);
    } else {
      map.set(key, {
        start_time: block.start_time,
        end_time: block.end_time,
        days: [block.day],
      });
    }
  }
  return Array.from(map.values());
}

function venueFor(cls: ClassRow): string | null {
  const parts: string[] = [];
  if (cls.building) parts.push(cls.building);
  if (cls.room) parts.push(cls.room);
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Map a class to Manhattan events: one `EventInput` per unique
 * `start_time|end_time` bucket in the class's `day_times`. Each event's
 * `start_at` / `end_at` is the first occurrence of the bucket's earliest
 * weekday on-or-after `semester.start_date`, at the bucket time, as a floating
 * local string `YYYY-MM-DDTHH:mm:00`.
 *
 * Returns `[]` when the class has no `day_times` or the semester has no
 * `start_date`.
 */
export function mapClassToManhattanEvents(
  cls: ClassRow,
  semester: SemesterRow,
): EventInput[] {
  const blocks = parseDayTimes(cls.day_times);
  if (blocks.length === 0 || !semester.start_date) return [];

  const startDate = semester.start_date;
  const venueName = venueFor(cls);
  const events: EventInput[] = [];

  for (const bucket of bucketDayTimes(blocks)) {
    const earliestDay = bucket.days
      .slice()
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])[0];
    const firstDate = firstWeekdayOnOrAfter(startDate, earliestDay);
    events.push({
      sourceId: 'classes',
      externalId: `class-${cls.id}-${earliestDay}-${bucket.start_time}`,
      title: cls.name,
      venueName,
      startAt: `${firstDate}T${bucket.start_time}:00`,
      endAt: `${firstDate}T${bucket.end_time}:00`,
      category: 'Education/Class',
      saved: true,
    });
  }

  return events;
}
