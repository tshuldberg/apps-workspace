import { describe, expect, it } from 'vitest';
import { generateICalString, generateGoogleCalendarUrl, eventToICalEvent } from '../engines/ical';
import type { Event } from '../types';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    title: 'Birthday Dinner',
    description: 'Come celebrate!',
    startAt: '2026-06-15T19:00:00.000Z',
    endAt: '2026-06-15T22:00:00.000Z',
    timezone: 'UTC',
    locationName: 'The Restaurant',
    locationAddress: '123 Main St, SF, CA',
    coverImageUrl: null,
    visibility: 'private',
    password: null,
    requiresApproval: false,
    allowPlusOnes: true,
    maxGuests: null,
    waitlistEnabled: false,
    allowPhotoAlbum: true,
    allowComments: true,
    allowPolls: true,
    allowCohosts: false,
    allowChipIn: false,
    chipInUrl: null,
    createdBy: 'Host',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('iCal engine', () => {
  describe('generateICalString', () => {
    it('generates valid VCALENDAR wrapper with VERSION:2.0 and PRODID', () => {
      const ics = generateICalString(makeEvent());
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//MyLife//MyRSVP//EN');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('generates VEVENT with correct DTSTART/DTEND for UTC', () => {
      const ics = generateICalString(makeEvent());
      expect(ics).toContain('DTSTART:20260615T190000Z');
      expect(ics).toContain('DTEND:20260615T220000Z');
    });

    it('generates DTSTART/DTEND with TZID for non-UTC timezone', () => {
      const ics = generateICalString(makeEvent({ timezone: 'America/Los_Angeles' }));
      expect(ics).toContain('DTSTART;TZID=America/Los_Angeles:');
      expect(ics).toContain('DTEND;TZID=America/Los_Angeles:');
    });

    it('defaults to 2-hour duration when endAt is null', () => {
      const ics = generateICalString(makeEvent({ endAt: null }));
      // Start at 19:00 UTC, end at 21:00 UTC
      expect(ics).toContain('DTSTART:20260615T190000Z');
      expect(ics).toContain('DTEND:20260615T210000Z');
    });

    it('escapes commas, semicolons, and backslashes in SUMMARY', () => {
      const ics = generateICalString(makeEvent({ title: 'Dinner; Party, with \\friends' }));
      expect(ics).toContain('SUMMARY:Dinner\\; Party\\, with \\\\friends');
    });

    it('escapes newlines as \\n in DESCRIPTION', () => {
      const ics = generateICalString(makeEvent({ description: 'Line 1\nLine 2\r\nLine 3' }));
      expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2\\nLine 3');
    });

    it('includes UID matching event ID', () => {
      const ics = generateICalString(makeEvent({ id: 'test-uid-123' }));
      expect(ics).toContain('UID:test-uid-123');
    });

    it('omits LOCATION when location is null', () => {
      const ics = generateICalString(makeEvent({ locationName: null, locationAddress: null }));
      expect(ics).not.toContain('LOCATION:');
    });

    it('includes LOCATION when present', () => {
      const ics = generateICalString(makeEvent());
      expect(ics).toContain('LOCATION:The Restaurant\\, 123 Main St\\, SF\\, CA');
    });

    it('handles empty description gracefully', () => {
      const ics = generateICalString(makeEvent({ description: null }));
      expect(ics).not.toContain('DESCRIPTION:');
    });

    it('uses CRLF line endings', () => {
      const ics = generateICalString(makeEvent());
      expect(ics).toContain('\r\n');
      // Ensure all line separators are CRLF
      const lines = ics.split('\r\n');
      expect(lines.length).toBeGreaterThan(5);
    });
  });

  describe('eventToICalEvent', () => {
    it('defaults end time to start + 2 hours', () => {
      const ical = eventToICalEvent(makeEvent({ endAt: null }));
      expect(ical.dtEnd).toBe('2026-06-15T21:00:00.000Z');
    });

    it('combines locationName and locationAddress', () => {
      const ical = eventToICalEvent(makeEvent());
      expect(ical.location).toBe('The Restaurant, 123 Main St, SF, CA');
    });

    it('returns null location when both fields are null', () => {
      const ical = eventToICalEvent(makeEvent({ locationName: null, locationAddress: null }));
      expect(ical.location).toBeNull();
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    it('generates correct base URL', () => {
      const url = generateGoogleCalendarUrl(makeEvent());
      expect(url).toContain('https://calendar.google.com/calendar/r/eventedit?');
    });

    it('uses UTC date format', () => {
      const url = generateGoogleCalendarUrl(makeEvent());
      expect(url).toContain('dates=20260615T190000Z%2F20260615T220000Z');
    });

    it('URL-encodes special characters', () => {
      const url = generateGoogleCalendarUrl(makeEvent({ title: 'Party & Fun' }));
      expect(url).toContain('text=Party+%26+Fun');
    });

    it('truncates description to 2000 chars', () => {
      const longDesc = 'A'.repeat(2500);
      const url = generateGoogleCalendarUrl(makeEvent({ description: longDesc }));
      const params = new URLSearchParams(url.split('?')[1]);
      const details = params.get('details')!;
      expect(details.length).toBeLessThanOrEqual(2003); // 2000 + '...'
      expect(details.endsWith('...')).toBe(true);
    });

    it('defaults to 2-hour duration when endAt is null', () => {
      const url = generateGoogleCalendarUrl(makeEvent({ endAt: null }));
      expect(url).toContain('dates=20260615T190000Z%2F20260615T210000Z');
    });

    it('omits location when not set', () => {
      const url = generateGoogleCalendarUrl(makeEvent({ locationName: null, locationAddress: null }));
      expect(url).not.toContain('location=');
    });

    it('omits details when description is null', () => {
      const url = generateGoogleCalendarUrl(makeEvent({ description: null }));
      expect(url).not.toContain('details=');
    });
  });
});
