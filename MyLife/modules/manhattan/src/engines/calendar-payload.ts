import type { PlanRow, EventRow } from '../types';
import type { NormalizedEvent } from '../sources/types';

/**
 * Calendar payload + ICS generation engine for Manhattan plans/events.
 *
 * Pure: no expo, no filesystem, no DB, no network. Emits timezone-correct
 * ICS following the RSVP TZID pattern (DTSTART;TZID=...:YYYYMMDDTHHMMSS).
 *
 * Manhattan always lives in America/New_York. Two-way sync carries a
 * Manhattan-owned id inside the notes managed block so it survives EventKit
 * eventIdentifier churn. We never trust the device identifier for dedup.
 */

export const MANHATTAN_TIMEZONE = 'America/New_York' as const;

export interface ManhattanCalendarPayload {
  manhattanId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  timezone: 'America/New_York';
  url: string | null;
}

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  notes?: string | null;
  allDay?: boolean;
}

const MANAGED_BLOCK_START = '[MyLife:Manhattan]';
const MANAGED_BLOCK_END = '[/MyLife:Manhattan]';
const MANAGED_ID_LINE = /\[MyLife:Manhattan\]\s*id=([^\s\]]+)\s*\[\/MyLife:Manhattan\]/;

function locationFromEvent(event?: EventRow | null): string | null {
  if (!event) return null;
  const parts = [event.venue_name, event.address].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Build a calendar payload from a plan, optionally enriched by its event.
 * Title falls back plan.title -> event.title. Location comes from the event
 * venue_name/address. manhattanId is the plan id.
 */
export function planToCalendarPayload(plan: PlanRow, event?: EventRow | null): ManhattanCalendarPayload {
  const title = plan.title && plan.title.trim() ? plan.title : (event?.title ?? '');
  return {
    manhattanId: plan.id,
    title,
    description: event?.description ?? null,
    location: locationFromEvent(event),
    startAt: plan.start_at,
    endAt: plan.end_at ?? null,
    allDay: event ? event.all_day === 1 : false,
    timezone: MANHATTAN_TIMEZONE,
    url: event?.purchase_url ?? null,
  };
}

/**
 * Build a calendar payload directly from an event. manhattanId is the event id.
 */
export function eventToCalendarPayload(event: EventRow): ManhattanCalendarPayload {
  return {
    manhattanId: event.id,
    title: event.title,
    description: event.description ?? null,
    location: locationFromEvent(event),
    startAt: event.start_at ?? '',
    endAt: event.end_at ?? null,
    allDay: event.all_day === 1,
    timezone: MANHATTAN_TIMEZONE,
    url: event.purchase_url ?? null,
  };
}

/**
 * Escape special characters per RFC 5545 Section 3.3.11.
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}

/**
 * Fold lines at 75 octets per RFC 5545 Section 3.1.
 * Continuation lines begin with a single space.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const lines: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    const end = start === 0 ? 75 : start + 74;
    const chunk = bytes.slice(start, Math.min(end, bytes.length));
    const decoded = new TextDecoder().decode(chunk);
    lines.push(start === 0 ? decoded : ' ' + decoded);
    start = Math.min(end, bytes.length);
  }
  return lines.join('\r\n');
}

/**
 * Turn a floating local datetime 'YYYY-MM-DDTHH:mm[:ss]' into 'YYYYMMDDTHHMMSS'.
 * Pure string manipulation: no Date parsing, so the result is identical on any
 * host timezone. Seconds default to 00 when omitted.
 */
export function formatFloatingLocal(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) {
    // Date-only inputs are formatted by formatDateOnly. Anything else we strip
    // to digits as a last resort to avoid emitting an invalid property value.
    return value.replace(/[^0-9T]/g, '');
  }
  const [, yyyy, mm, dd, hh, mi, ss] = m;
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss ?? '00'}`;
}

/**
 * Turn a date 'YYYY-MM-DD' (or the date portion of a datetime) into 'YYYYMMDD'
 * for VALUE=DATE all-day properties.
 */
export function formatDateOnly(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value.replace(/[^0-9]/g, '').slice(0, 8);
  const [, yyyy, mm, dd] = m;
  return `${yyyy}${mm}${dd}`;
}

function formatDtStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

/**
 * Generate an RFC 5545 VCALENDAR for Manhattan payloads. Each VEVENT carries a
 * UID:<manhattanId>@mylife.manhattan and X-MANHATTAN-ID:<manhattanId> so the
 * Manhattan id round-trips regardless of EventKit identifier churn. Timed events
 * emit DTSTART;TZID=America/New_York:YYYYMMDDTHHMMSS; all-day events emit
 * DTSTART;VALUE=DATE:YYYYMMDD.
 *
 * No VTIMEZONE block is emitted: every major calendar client resolves the IANA
 * zone America/New_York natively, so the named TZID reference is sufficient.
 */
export function generateManhattanICS(payloads: ManhattanCalendarPayload[]): string {
  const dtstamp = formatDtStamp();
  const lines: string[] = [];

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//MyLife//Manhattan//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  for (const p of payloads) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${p.manhattanId}@mylife.manhattan`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (p.allDay) {
      const startDate = formatDateOnly(p.startAt);
      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      // RFC 5545 DATE DTEND is EXCLUSIVE (the day after the last day). Only emit
      // it when strictly after DTSTART; a lone DTSTART is a valid one-day event,
      // and this avoids zero or negative length VEVENTs. YYYYMMDD compares
      // chronologically as a string.
      if (p.endAt) {
        const endDate = formatDateOnly(p.endAt);
        if (endDate > startDate) {
          lines.push(`DTEND;VALUE=DATE:${endDate}`);
        }
      }
    } else {
      lines.push(`DTSTART;TZID=${p.timezone}:${formatFloatingLocal(p.startAt)}`);
      if (p.endAt) {
        lines.push(`DTEND;TZID=${p.timezone}:${formatFloatingLocal(p.endAt)}`);
      }
    }

    lines.push(`SUMMARY:${escapeICalText(p.title)}`);
    if (p.description) lines.push(`DESCRIPTION:${escapeICalText(p.description)}`);
    if (p.location) lines.push(`LOCATION:${escapeICalText(p.location)}`);
    if (p.url) lines.push(`URL:${escapeICalText(p.url)}`);
    lines.push(`X-MANHATTAN-ID:${escapeICalText(p.manhattanId)}`);

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Embed a delimited managed block carrying the Manhattan id into event notes so
 * the id survives EventKit identifier churn. Existing managed blocks are
 * replaced, not duplicated.
 */
export function buildManhattanEventNotes(manhattanId: string, baseNotes?: string | null): string {
  const block = `${MANAGED_BLOCK_START}id=${manhattanId}${MANAGED_BLOCK_END}`;
  const base = (baseNotes ?? '').replace(MANAGED_ID_LINE, '').trimEnd();
  return base ? `${base}\n\n${block}` : block;
}

/**
 * Inverse of buildManhattanEventNotes. Returns the embedded Manhattan id, or
 * null when no managed block is present.
 */
export function extractManhattanId(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = MANAGED_ID_LINE.exec(notes);
  return m ? m[1] : null;
}

/**
 * Pure two-way-sync dedup. For each inbound device event not already known,
 * emit a NormalizedEvent sourced from 'device_calendar'. The externalId prefers
 * the embedded Manhattan id over the device id so Manhattan-originated events
 * reconcile to their own identity. Events whose chosen externalId is already in
 * knownExternalIds are skipped. No DB access.
 */
export function reconcileInboundDeviceEvents(
  deviceEvents: DeviceCalendarEvent[],
  knownExternalIds: string[],
): NormalizedEvent[] {
  const known = new Set(knownExternalIds);
  const result: NormalizedEvent[] = [];

  for (const d of deviceEvents) {
    const externalId = extractManhattanId(d.notes) ?? d.id;
    if (known.has(externalId)) continue;

    result.push({
      sourceId: 'device_calendar',
      externalId,
      title: d.title,
      startAt: d.startDate,
      endAt: d.endDate ?? undefined,
      venueName: d.location ?? undefined,
      allDay: d.allDay ?? false,
    });
  }

  return result;
}
