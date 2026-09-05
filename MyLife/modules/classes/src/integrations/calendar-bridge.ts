/**
 * Calendar bridge (P9-F): pure helper producing ICS-ready event payloads. We
 * intentionally do NOT generate ICS strings here — that's a downstream concern.
 * Returns plain data so any consumer (MyCalendar, native EventKit, web ICS
 * download) can encode as needed.
 */

import type { AssignmentRow, SemesterRow } from '../models/schemas';

export interface ScheduleBlock {
  classId: string;
  className: string;
  classCode: string | null;
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location?: string | null;
}

export interface IcsEvent {
  uid: string;
  dtstart: string; // ISO timestamp
  dtend: string; // ISO timestamp
  summary: string;
  description?: string;
  allDay?: boolean;
}

const DAY_INDEX: Record<ScheduleBlock['day'], number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function firstOccurrenceOnOrAfter(
  startISO: string,
  day: ScheduleBlock['day'],
): Date {
  const start = new Date(`${startISO.slice(0, 10)}T00:00:00Z`);
  const target = DAY_INDEX[day];
  const current = start.getUTCDay();
  const offset = (target - current + 7) % 7;
  start.setUTCDate(start.getUTCDate() + offset);
  return start;
}

function combine(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date(date);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Build ICS event payloads for a semester. Schedule blocks get ONE event per
 * block placed on the first matching weekday at-or-after `semester.start_date`
 * (consumers handle weekly recurrence via RRULE). Assignments with `due_at`
 * become single all-day events on the due date.
 *
 * Returns `[]` if `semester.start_date` is missing.
 */
export function buildIcsEvents(
  scheduleBlocks: ScheduleBlock[],
  assignments: Pick<
    AssignmentRow,
    'id' | 'title' | 'due_at' | 'class_id' | 'description_md'
  >[],
  semester: Pick<SemesterRow, 'id' | 'name' | 'start_date' | 'end_date'>,
): IcsEvent[] {
  if (!semester.start_date) return [];

  const events: IcsEvent[] = [];

  for (const block of scheduleBlocks) {
    const firstDay = firstOccurrenceOnOrAfter(semester.start_date, block.day);
    const dtstart = combine(firstDay, block.start_time);
    const dtend = combine(firstDay, block.end_time);
    const summary = block.classCode?.trim()
      ? `${block.classCode}: ${block.className}`
      : block.className;
    const description = block.location ? `Location: ${block.location}` : undefined;
    events.push({
      uid: `cs-class-${block.classId}-${block.day}-${block.start_time}@mylife`,
      dtstart,
      dtend,
      summary,
      description,
      allDay: false,
    });
  }

  for (const a of assignments) {
    if (!a.due_at) continue;
    const day = a.due_at.slice(0, 10);
    const dtstart = `${day}T00:00:00.000Z`;
    const dtend = `${day}T23:59:59.000Z`;
    events.push({
      uid: `cs-assignment-${a.id}@mylife`,
      dtstart,
      dtend,
      summary: `Due: ${a.title}`,
      description: a.description_md ?? undefined,
      allDay: true,
    });
  }

  return events;
}
