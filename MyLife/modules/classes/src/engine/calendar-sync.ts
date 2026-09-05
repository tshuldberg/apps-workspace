/**
 * Pure calendar-sync engine for MyClasses.
 *
 * No Expo / web / FS imports. Produces:
 *  - RFC 5545 .ics strings for one or many classes (bounded by semester dates)
 *  - EventKit-shaped payloads for native consumers (we do not call EventKit here)
 *  - Commute-buffer analysis for back-to-back classes on the same day
 *
 * The recurrence model: each class day_time block becomes one VEVENT with a
 * weekly RRULE bounded by semester end_date. Multi-day blocks (e.g. MWF) are
 * combined into a single RRULE with BYDAY=MO,WE,FR when their start/end times
 * match; otherwise each unique time block becomes its own event.
 */

import type { ClassRow, Day, DayTime, SemesterRow } from '../models/schemas';

const DAY_TO_BYDAY: Record<Day, string> = {
  mon: 'MO',
  tue: 'TU',
  wed: 'WE',
  thu: 'TH',
  fri: 'FR',
  sat: 'SA',
  sun: 'SU',
};

const DAY_INDEX: Record<Day, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DAY_ORDER_FOR_GAP: Day[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

function parseDayTimes(raw: string | null | undefined): DayTime[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DayTime[]) : [];
  } catch {
    return [];
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((p) => Number.parseInt(p, 10));
  return h * 60 + m;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format a YYYY-MM-DD (or full ISO) date + HH:MM time as a floating
 * RFC 5545 DATE-TIME (no Z suffix; consumer interprets in local TZ).
 */
function formatLocalDateTime(date: string, hhmm: string): string {
  // Accept YYYY-MM-DD or full ISO; we want YYYYMMDDTHHMMSS.
  const ymd = date.slice(0, 10).replace(/-/g, '');
  const hm = hhmm.replace(':', '');
  return `${ymd}T${hm}00`;
}

/**
 * Format a YYYY-MM-DD as the UNTIL value at end-of-day UTC.
 * RFC 5545 UNTIL must be in UTC (Z suffix) when DTSTART is local-floating
 * with no TZID, OR omit Z. We use Z form which is widely accepted.
 */
function formatUntil(date: string): string {
  const ymd = date.slice(0, 10).replace(/-/g, '');
  return `${ymd}T235959Z`;
}

/**
 * Roll a semester start_date forward to the first occurrence of `day`.
 * Returns YYYY-MM-DD. Pure date math; no timezone library.
 */
function firstOccurrenceOf(startDate: string, day: Day): string {
  const ymd = startDate.slice(0, 10);
  const [y, m, d] = ymd.split('-').map((p) => Number.parseInt(p, 10));
  // Construct as UTC noon to dodge DST edges.
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const target = DAY_INDEX[day];
  const current = base.getUTCDay();
  const delta = (target - current + 7) % 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
}

function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let remaining = line;
  out.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    out.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return out.join('\r\n');
}

/**
 * Group day_times into recurrence buckets keyed by start_time|end_time.
 * Each bucket becomes one VEVENT with combined BYDAY.
 */
interface RecurrenceBucket {
  start_time: string;
  end_time: string;
  days: Day[];
}

function bucketDayTimes(blocks: DayTime[]): RecurrenceBucket[] {
  const map = new Map<string, RecurrenceBucket>();
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

function locationFor(cls: ClassRow): string | null {
  const parts: string[] = [];
  if (cls.room) parts.push(cls.room);
  if (cls.building) parts.push(cls.building);
  return parts.length > 0 ? parts.join(', ') : null;
}

function summaryFor(cls: ClassRow): string {
  if (cls.code) return `${cls.code}: ${cls.name}`;
  return cls.name;
}

/**
 * Generate VEVENT lines for a class within a semester. Returns an array
 * of VEVENT strings (CRLF line endings inside each).
 */
function eventsForClass(cls: ClassRow, semester: SemesterRow): string[] {
  const blocks = parseDayTimes(cls.day_times);
  if (blocks.length === 0) return [];
  if (!semester.start_date) return [];

  const buckets = bucketDayTimes(blocks);
  const events: string[] = [];
  const summary = escapeICSText(summaryFor(cls));
  const location = locationFor(cls);
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  let bucketIndex = 0;
  for (const bucket of buckets) {
    bucketIndex += 1;
    // First occurrence is the earliest day in this bucket.
    const earliestDay = bucket.days
      .slice()
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])[0];
    const firstDate = firstOccurrenceOf(semester.start_date, earliestDay);
    const dtstart = formatLocalDateTime(firstDate, bucket.start_time);
    const dtend = formatLocalDateTime(firstDate, bucket.end_time);
    const byday = bucket.days
      .slice()
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
      .map((d) => DAY_TO_BYDAY[d])
      .join(',');

    const lines: string[] = [];
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${cls.id}-${bucketIndex}@mylife.classes`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    if (location) lines.push(`LOCATION:${escapeICSText(location)}`);
    if (cls.notes_md) {
      lines.push(`DESCRIPTION:${escapeICSText(cls.notes_md)}`);
    }
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byday}`;
    if (semester.end_date) {
      rrule += `;UNTIL=${formatUntil(semester.end_date)}`;
    }
    lines.push(rrule);
    lines.push('END:VEVENT');
    events.push(lines.map(foldICSLine).join('\r\n'));
  }

  return events;
}

/**
 * classToICS: Returns a complete VCALENDAR string containing the class's
 * recurring events, bounded by semester start/end.
 */
export function classToICS(cls: ClassRow, semester: SemesterRow): string {
  return classesToICS([cls], semester);
}

/**
 * classesToICS: Returns a complete VCALENDAR string covering every passed
 * class. Classes with no day_times or with no semester start_date contribute
 * zero events.
 */
export function classesToICS(classes: ClassRow[], semester: SemesterRow): string {
  const events: string[] = [];
  for (const cls of classes) {
    events.push(...eventsForClass(cls, semester));
  }
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyLife//Classes//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const ev of events) lines.push(ev);
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// -- EventKit-shaped payload ---------------------------------------------

export interface EventKitRecurrenceRule {
  frequency: 'WEEKLY';
  interval: 1;
  byDay: Day[];
  endDate: string | null; // YYYY-MM-DD
}

export interface EventKitEventPayload {
  classId: string;
  title: string;
  location: string | null;
  notes: string | null;
  startDate: string; // ISO local floating: YYYY-MM-DDTHH:MM:00
  endDate: string;
  recurrenceRule: EventKitRecurrenceRule;
}

/**
 * eventKitPayload: Returns one payload per recurrence bucket. Native layer
 * consumes these and creates EKEvent / CalendarContract entries.
 */
export function eventKitPayload(
  cls: ClassRow,
  semester: SemesterRow,
): EventKitEventPayload[] {
  const blocks = parseDayTimes(cls.day_times);
  if (blocks.length === 0 || !semester.start_date) return [];
  const buckets = bucketDayTimes(blocks);
  const location = locationFor(cls);
  const title = summaryFor(cls);
  const payloads: EventKitEventPayload[] = [];

  for (const bucket of buckets) {
    const earliestDay = bucket.days
      .slice()
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])[0];
    const firstDate = firstOccurrenceOf(semester.start_date, earliestDay);
    payloads.push({
      classId: cls.id,
      title,
      location,
      notes: cls.notes_md ?? null,
      startDate: `${firstDate}T${bucket.start_time}:00`,
      endDate: `${firstDate}T${bucket.end_time}:00`,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byDay: bucket.days
          .slice()
          .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]),
        endDate: semester.end_date ? semester.end_date.slice(0, 10) : null,
      },
    });
  }

  return payloads;
}

// -- Commute buffer analysis --------------------------------------------

export interface CommuteGap {
  from_class_id: string;
  to_class_id: string;
  from_class_name: string;
  to_class_name: string;
  day: Day;
  gap_minutes: number;
  /** True when gap_minutes < travelMinutes (insufficient travel time). */
  tight: boolean;
}

export interface CommuteBufferOptions {
  travelMinutes: number;
}

interface DayBlockEntry {
  cls: ClassRow;
  block: DayTime;
}

/**
 * commuteBuffer: For each day, sort all class blocks by start_time and emit
 * one CommuteGap per consecutive (A → B) pair where building or room differs.
 * Same-room consecutive blocks are skipped (no commute).
 */
export function commuteBuffer(
  classes: ClassRow[],
  options: CommuteBufferOptions,
): CommuteGap[] {
  const byDay = new Map<Day, DayBlockEntry[]>();
  for (const cls of classes) {
    const blocks = parseDayTimes(cls.day_times);
    for (const block of blocks) {
      const list = byDay.get(block.day) ?? [];
      list.push({ cls, block });
      byDay.set(block.day, list);
    }
  }

  const gaps: CommuteGap[] = [];
  for (const day of DAY_ORDER_FOR_GAP) {
    const entries = byDay.get(day);
    if (!entries || entries.length < 2) continue;
    entries.sort(
      (a, b) =>
        timeToMinutes(a.block.start_time) - timeToMinutes(b.block.start_time),
    );
    for (let i = 0; i < entries.length - 1; i += 1) {
      const from = entries[i];
      const to = entries[i + 1];
      // Skip if same physical location.
      if (
        from.cls.building === to.cls.building &&
        from.cls.room === to.cls.room &&
        from.cls.building !== null
      ) {
        continue;
      }
      const gap =
        timeToMinutes(to.block.start_time) - timeToMinutes(from.block.end_time);
      if (gap < 0) continue; // overlapping; conflict-detector handles it.
      gaps.push({
        from_class_id: from.cls.id,
        to_class_id: to.cls.id,
        from_class_name: from.cls.name,
        to_class_name: to.cls.name,
        day,
        gap_minutes: gap,
        tight: gap < options.travelMinutes,
      });
    }
  }

  return gaps;
}
