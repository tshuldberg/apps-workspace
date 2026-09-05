import type { CreateCalendarEventInput, RSVPStatus } from '../types';

/**
 * Parsed VEVENT data from an .ics file.
 */
export interface ParsedEvent {
  uid?: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;
  dtend: string;
  organizer?: string;
  attendees: string[];
  isAllDay: boolean;
  isCancelled: boolean;
}

/**
 * Parse a VCALENDAR/VEVENT string into structured event data.
 * Handles basic RFC 5545 VEVENT format.
 */
export function parseIcs(icsContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const isCancelled = /METHOD\s*:\s*CANCEL/i.test(icsContent);

  // Split into VEVENT blocks
  const eventBlocks = icsContent.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of eventBlocks) {
    const endIdx = block.indexOf('END:VEVENT');
    const content = endIdx >= 0 ? block.slice(0, endIdx) : block;

    const getField = (name: string): string | undefined => {
      // Handle folded lines (RFC 5545: continuation lines start with space/tab)
      const unfolded = content.replace(/\r?\n[ \t]/g, '');
      const regex = new RegExp(`^${name}[;:](.*)$`, 'im');
      const match = unfolded.match(regex);
      if (!match) return undefined;
      // Strip parameters (everything before last colon if there are params)
      const val = match[1];
      const colonIdx = val.indexOf(':');
      // If the field name already consumed the colon, val is the value
      // Otherwise check if there are parameters
      if (name.includes(':')) return val.trim();
      return colonIdx >= 0 && val.includes(';') ? val.slice(colonIdx + 1).trim() : val.trim();
    };

    const getFieldValue = (name: string): string | undefined => {
      const unfolded = content.replace(/\r?\n[ \t]/g, '');
      const lines = unfolded.split(/\r?\n/);
      for (const line of lines) {
        if (line.toUpperCase().startsWith(name.toUpperCase())) {
          const colonIdx = line.indexOf(':');
          if (colonIdx >= 0) return line.slice(colonIdx + 1).trim();
        }
      }
      return undefined;
    };

    const summary = getFieldValue('SUMMARY') ?? 'Untitled Event';
    const dtstart = getFieldValue('DTSTART') ?? '';
    const dtend = getFieldValue('DTEND') ?? '';
    const uid = getFieldValue('UID');
    const description = getFieldValue('DESCRIPTION');
    const location = getFieldValue('LOCATION');

    // Parse organizer
    const organizerLine = getField('ORGANIZER');
    const organizer = organizerLine?.replace(/^mailto:/i, '').trim();

    // Parse attendees
    const attendees: string[] = [];
    const unfolded = content.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    for (const line of lines) {
      if (line.toUpperCase().startsWith('ATTENDEE')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx >= 0) {
          const email = line.slice(colonIdx + 1).replace(/^mailto:/i, '').trim();
          if (email) attendees.push(email);
        }
      }
    }

    // Detect all-day events (DATE format without time: YYYYMMDD)
    const isAllDay = /^\d{8}$/.test(dtstart);

    // Normalize dates to ISO
    const startTime = normalizeIcsDate(dtstart);
    const endTime = dtend
      ? normalizeIcsDate(dtend)
      : addHours(startTime, 1);

    events.push({
      uid,
      summary,
      description: description?.replace(/\\n/g, '\n').replace(/\\,/g, ','),
      location: location?.replace(/\\,/g, ','),
      dtstart: startTime,
      dtend: endTime,
      organizer,
      attendees,
      isAllDay,
      isCancelled,
    });
  }

  return events;
}

/**
 * Normalize an ICS date string to ISO 8601 format.
 * Handles: YYYYMMDD, YYYYMMDDTHHmmss, YYYYMMDDTHHmmssZ
 */
export function normalizeIcsDate(icsDate: string): string {
  const clean = icsDate.replace(/[^0-9TZ]/g, '');

  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00Z`;
  }

  if (/^\d{8}T\d{6}Z?$/.test(clean)) {
    const d = clean.replace('Z', '');
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`;
  }

  return icsDate; // Return as-is if unparseable
}

function addHours(isoDate: string, hours: number): string {
  try {
    const d = new Date(isoDate);
    d.setUTCHours(d.getUTCHours() + hours);
    return d.toISOString();
  } catch {
    return isoDate;
  }
}

/**
 * Detect date/time patterns in plain email body text (low confidence).
 * Returns an array of detected date strings.
 */
export function detectDatesInBody(body: string): string[] {
  const patterns: RegExp[] = [
    // "March 15, 2026 at 3pm"
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    // ISO format: 2026-03-15T15:00
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g,
    // "03/15/2026 3:00 PM"
    /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?/gi,
  ];

  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches) results.push(...matches);
  }
  return results;
}

/**
 * Convert a ParsedEvent to a CreateCalendarEventInput.
 */
export function eventToInput(
  event: ParsedEvent,
  messageId: string,
  accountId: string,
): CreateCalendarEventInput {
  return {
    messageId,
    accountId,
    title: event.summary,
    description: event.description,
    location: event.location,
    startTime: event.dtstart,
    endTime: event.dtend,
    organizer: event.organizer,
    attendees: event.attendees,
    icsUid: event.uid,
    isAllDay: event.isAllDay,
  };
}

/**
 * Generate an iCalendar REPLY string for RSVP.
 */
export function generateRsvpReply(
  event: { uid: string; organizer: string },
  attendeeEmail: string,
  status: RSVPStatus,
): string {
  const partstat = status === 'accepted' ? 'ACCEPTED'
    : status === 'declined' ? 'DECLINED'
    : 'TENTATIVE';

  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyLife//MyMail//EN',
    'METHOD:REPLY',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${now}`,
    `ORGANIZER:mailto:${event.organizer}`,
    `ATTENDEE;PARTSTAT=${partstat}:mailto:${attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
