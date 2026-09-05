/**
 * iCal (.ics) generation engine for RSVP events.
 * Implements RFC 5545 compliant VCALENDAR/VEVENT output.
 */

import type { Event } from '../types';

export interface ICalEvent {
  uid: string;
  summary: string;
  description: string | null;
  dtStart: string;
  dtEnd: string;
  timezone: string;
  location: string | null;
  organizer: string | null;
  dtstamp: string;
}

/**
 * Escape special characters per RFC 5545 Section 3.3.11.
 * Commas, semicolons, and backslashes must be escaped with a backslash.
 * Newlines become literal \n.
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
    const end = start === 0 ? 75 : start + 74; // continuation lines have leading space
    const chunk = bytes.slice(start, Math.min(end, bytes.length));
    const decoded = new TextDecoder().decode(chunk);

    if (start === 0) {
      lines.push(decoded);
    } else {
      lines.push(' ' + decoded);
    }
    start = Math.min(end, bytes.length);
  }

  return lines.join('\r\n');
}

function formatDateTimeUTC(isoDate: string): string {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function formatDateTimeLocal(isoDate: string): string {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function addHoursToISO(isoDate: string, hours: number): string {
  const d = new Date(isoDate);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

/**
 * Convert an RSVP Event to an iCal event object.
 * Defaults to 2-hour duration when end_at is null.
 */
export function eventToICalEvent(event: Event): ICalEvent {
  const endAt = event.endAt ?? addHoursToISO(event.startAt, 2);
  const location = [event.locationName, event.locationAddress]
    .filter(Boolean)
    .join(', ') || null;

  return {
    uid: event.id,
    summary: event.title,
    description: event.description,
    dtStart: event.startAt,
    dtEnd: endAt,
    timezone: event.timezone,
    location,
    organizer: event.createdBy,
    dtstamp: new Date().toISOString(),
  };
}

/**
 * Generate an RFC 5545 compliant .ics string for an event.
 */
export function generateICalString(event: Event): string {
  const ical = eventToICalEvent(event);
  const lines: string[] = [];

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//MyLife//MyRSVP//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${ical.uid}`);
  lines.push(`DTSTAMP:${formatDateTimeUTC(ical.dtstamp)}`);

  if (ical.timezone && ical.timezone !== 'UTC') {
    lines.push(`DTSTART;TZID=${ical.timezone}:${formatDateTimeLocal(ical.dtStart)}`);
    lines.push(`DTEND;TZID=${ical.timezone}:${formatDateTimeLocal(ical.dtEnd)}`);
  } else {
    lines.push(`DTSTART:${formatDateTimeUTC(ical.dtStart)}`);
    lines.push(`DTEND:${formatDateTimeUTC(ical.dtEnd)}`);
  }

  lines.push(`SUMMARY:${escapeICalText(ical.summary)}`);

  if (ical.description) {
    lines.push(`DESCRIPTION:${escapeICalText(ical.description)}`);
  }

  if (ical.location) {
    lines.push(`LOCATION:${escapeICalText(ical.location)}`);
  }

  if (ical.organizer) {
    lines.push(`ORGANIZER:${escapeICalText(ical.organizer)}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Generate a Google Calendar URL for an event.
 * Uses UTC date format: YYYYMMDDTHHMMSSZ
 */
export function generateGoogleCalendarUrl(event: Event): string {
  const endAt = event.endAt ?? addHoursToISO(event.startAt, 2);
  const startUtc = formatDateTimeUTC(event.startAt);
  const endUtc = formatDateTimeUTC(endAt);
  const location = [event.locationName, event.locationAddress]
    .filter(Boolean)
    .join(', ');

  const params = new URLSearchParams();
  params.set('text', event.title);
  params.set('dates', `${startUtc}/${endUtc}`);

  if (location) {
    params.set('location', location);
  }

  if (event.description) {
    const desc = event.description.length > 2000
      ? event.description.slice(0, 2000) + '...'
      : event.description;
    params.set('details', desc);
  }

  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}
