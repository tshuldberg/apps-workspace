import { describe, it, expect } from 'vitest';
import {
  importIcs,
  eventsToActivitySuggestions,
} from '../engine/calendar-import';

describe('importIcs', () => {
  it('parses an all-day VEVENT with VALUE=DATE', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:a1@test',
      'SUMMARY:All Day Hike',
      'DTSTART;VALUE=DATE:20260501',
      'DTEND;VALUE=DATE:20260502',
      'LOCATION:Yosemite',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = importIcs(ics);
    expect(events.length).toBe(1);
    expect(events[0].uid).toBe('a1@test');
    expect(events[0].title).toBe('All Day Hike');
    expect(events[0].startIso).toBe('2026-05-01');
    expect(events[0].endIso).toBe('2026-05-02');
    expect(events[0].location).toBe('Yosemite');
  });

  it('parses a timed VEVENT in UTC', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:b2@test',
      'SUMMARY:Dinner',
      'DTSTART:20260503T183000Z',
      'DTEND:20260503T203000Z',
      'LOCATION:Paris',
      'END:VEVENT',
    ].join('\n');

    const events = importIcs(ics);
    expect(events.length).toBe(1);
    expect(events[0].startIso).toBe('2026-05-03T18:30:00Z');
    expect(events[0].endIso).toBe('2026-05-03T20:30:00Z');
  });

  it('handles folded (continued) lines via leading space', () => {
    // RFC 5545: a CRLF followed by a single space indicates a folded continuation.
    // Per RFC 5545, the first whitespace char of a continuation line is the
    // fold indicator and is stripped. To preserve a space in the unfolded
    // text, the continuation line needs two leading whitespace chars.
    const ics =
      'BEGIN:VEVENT\r\n' +
      'UID:c3@test\r\n' +
      'SUMMARY:Very long title that has been\r\n  folded across two lines\r\n' +
      'DTSTART:20260504T090000Z\r\n' +
      'END:VEVENT\r\n';

    const events = importIcs(ics);
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Very long title that has been folded across two lines');
  });

  it('parses multiple VEVENTs in one calendar', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:e1',
      'SUMMARY:First',
      'DTSTART:20260510T100000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:e2',
      'SUMMARY:Second',
      'DTSTART:20260511T100000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = importIcs(ics);
    expect(events.length).toBe(2);
    expect(events[0].uid).toBe('e1');
    expect(events[1].uid).toBe('e2');
  });

  it('silently skips malformed VEVENT blocks missing required fields', () => {
    const ics = [
      'BEGIN:VEVENT',
      'SUMMARY:NoUidNoStart',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:ok',
      'SUMMARY:Good',
      'DTSTART:20260512T120000Z',
      'END:VEVENT',
    ].join('\r\n');

    const events = importIcs(ics);
    expect(events.length).toBe(1);
    expect(events[0].uid).toBe('ok');
  });

  it('unescapes TEXT field backslash sequences', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:esc',
      'SUMMARY:Meet\\, greet\\; repeat',
      'DTSTART:20260513T120000Z',
      'DESCRIPTION:line1\\nline2',
      'END:VEVENT',
    ].join('\r\n');

    const events = importIcs(ics);
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Meet, greet; repeat');
    expect(events[0].description).toBe('line1\nline2');
  });

  it('returns empty array for empty or non-string input', () => {
    expect(importIcs('')).toEqual([]);
    expect(importIcs(undefined as unknown as string)).toEqual([]);
  });
});

describe('eventsToActivitySuggestions', () => {
  const events = [
    { uid: '1', title: 'Before', startIso: '2026-05-01T10:00:00Z' },
    { uid: '2', title: 'Inside1', startIso: '2026-05-05T14:30:00Z', endIso: '2026-05-05T16:00:00Z', location: 'Louvre', description: 'Arrive early' },
    { uid: '3', title: 'InsideAllDay', startIso: '2026-05-06' },
    { uid: '4', title: 'After', startIso: '2026-06-01T10:00:00Z' },
  ];

  it('filters events to those within the trip window (inclusive)', () => {
    const s = eventsToActivitySuggestions(events, '2026-05-02', '2026-05-10');
    expect(s.length).toBe(2);
    expect(s[0].title).toBe('Inside1');
    expect(s[0].dateIso).toBe('2026-05-05');
    expect(s[0].startTime).toBe('14:30');
    expect(s[0].endTime).toBe('16:00');
    expect(s[0].location).toBe('Louvre');
    expect(s[0].notes).toBe('Arrive early');
    expect(s[1].title).toBe('InsideAllDay');
    expect(s[1].dateIso).toBe('2026-05-06');
    expect(s[1].startTime).toBeUndefined();
  });

  it('accepts tripStart/tripEnd as full ISO datetimes (uses date portion)', () => {
    const s = eventsToActivitySuggestions(events, '2026-05-02T00:00:00Z', '2026-05-10T23:59:59Z');
    expect(s.length).toBe(2);
  });

  it('returns empty array when no events fall in window', () => {
    const s = eventsToActivitySuggestions(events, '2027-01-01', '2027-01-31');
    expect(s).toEqual([]);
  });
});
