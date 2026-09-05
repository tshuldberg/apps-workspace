import { describe, it, expect } from 'vitest';
import { icsToNormalized, icsImportAdapter } from '../ics-import';

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:evt-1@example.com',
  'SUMMARY:Rooftop Listening Party',
  'LOCATION:The Standard',
  'DESCRIPTION:Album playback and drinks',
  'DTSTART:20260701T200000',
  'DTEND:20260701T230000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-2@example.com',
  'SUMMARY:All Day Festival',
  'DTSTART:20260704',
  'DTEND:20260705',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const CANCELLED_ICS = [
  'BEGIN:VCALENDAR',
  'METHOD:CANCEL',
  'BEGIN:VEVENT',
  'UID:evt-3@example.com',
  'SUMMARY:Cancelled Show',
  'DTSTART:20260701T200000',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('icsToNormalized', () => {
  it('maps VEVENTs to NormalizedEvents', () => {
    const events = icsToNormalized(SAMPLE_ICS);
    expect(events).toHaveLength(2);
    const first = events[0]!;
    expect(first.sourceId).toBe('ics_import');
    expect(first.externalId).toBe('evt-1@example.com');
    expect(first.title).toBe('Rooftop Listening Party');
    expect(first.venueName).toBe('The Standard');
    expect(first.description).toBe('Album playback and drinks');
    expect(first.startAt).toBeTruthy();
    expect(first.allDay).toBe(false);
    const second = events[1]!;
    expect(second.allDay).toBe(true);
  });

  it('drops cancelled events', () => {
    expect(icsToNormalized(CANCELLED_ICS)).toHaveLength(0);
  });
});

describe('icsImportAdapter', () => {
  it('is an available tier1 source that does not query', async () => {
    expect(icsImportAdapter.tier).toBe('tier1');
    expect(icsImportAdapter.isAvailable()).toBe(true);
    expect(await icsImportAdapter.fetchEvents({}, async () => {
      throw new Error('should not fetch');
    })).toEqual([]);
  });
});
