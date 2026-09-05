import { describe, it, expect } from 'vitest';
import {
  MANHATTAN_TIMEZONE,
  planToCalendarPayload,
  eventToCalendarPayload,
  generateManhattanICS,
  buildManhattanEventNotes,
  extractManhattanId,
  reconcileInboundDeviceEvents,
  formatFloatingLocal,
  formatDateOnly,
  type ManhattanCalendarPayload,
  type DeviceCalendarEvent,
} from '../calendar-payload';
import type { PlanRow, EventRow } from '../../types';

function plan(over: Partial<PlanRow> = {}): PlanRow {
  return {
    id: 'plan-1',
    title: 'Plan Title',
    start_at: '2026-07-01T20:00:00',
    end_at: '2026-07-01T22:30:00',
    event_id: 'evt-1',
    pin_id: null,
    reminder_minutes: null,
    calendar_event_id: null,
    has_reservation: 0,
    party_size: 1,
    source: 'manual',
    status: 'active',
    created_at: '2026-06-01T00:00:00',
    updated_at: '2026-06-01T00:00:00',
    deleted_at: null,
    ...over,
  };
}

function event(over: Partial<EventRow> = {}): EventRow {
  return {
    id: 'evt-1',
    source_id: 'nyc_open_data',
    external_id: 'ext-1',
    title: 'Event Title',
    description: 'A great event',
    venue_name: 'Blue Note',
    address: '131 W 3rd St',
    lat: null,
    lng: null,
    neighborhood: null,
    start_at: '2026-07-01T20:00:00',
    end_at: '2026-07-01T22:00:00',
    all_day: 0,
    category: 'Music',
    purchase_url: 'https://example.com/tickets',
    ticket_provider: null,
    image_url: null,
    price_min: null,
    price_max: null,
    is_free: 0,
    saved: 0,
    status: 'active',
    created_at: '2026-06-01T00:00:00',
    updated_at: '2026-06-01T00:00:00',
    deleted_at: null,
    ...over,
  };
}

function payload(over: Partial<ManhattanCalendarPayload> = {}): ManhattanCalendarPayload {
  return {
    manhattanId: 'm-1',
    title: 'Title',
    description: null,
    location: null,
    startAt: '2026-07-01T20:00:00',
    endAt: '2026-07-01T22:00:00',
    allDay: false,
    timezone: MANHATTAN_TIMEZONE,
    url: null,
    ...over,
  };
}

describe('floating-local formatting helpers', () => {
  it('turns YYYY-MM-DDTHH:mm:ss into YYYYMMDDTHHMMSS', () => {
    expect(formatFloatingLocal('2026-07-01T20:00:00')).toBe('20260701T200000');
  });

  it('defaults seconds to 00 when omitted', () => {
    expect(formatFloatingLocal('2026-07-01T20:05')).toBe('20260701T200500');
  });

  it('ignores trailing timezone designators (floating, not converted)', () => {
    expect(formatFloatingLocal('2026-12-31T23:59:59Z')).toBe('20261231T235959');
    expect(formatFloatingLocal('2026-12-31T23:59:59-05:00')).toBe('20261231T235959');
  });

  it('formats a date-only value to YYYYMMDD', () => {
    expect(formatDateOnly('2026-07-01')).toBe('20260701');
    expect(formatDateOnly('2026-07-01T20:00:00')).toBe('20260701');
  });
});

describe('planToCalendarPayload', () => {
  it('uses the plan id as manhattanId and plan start/end', () => {
    const p = planToCalendarPayload(plan(), event());
    expect(p.manhattanId).toBe('plan-1');
    expect(p.startAt).toBe('2026-07-01T20:00:00');
    expect(p.endAt).toBe('2026-07-01T22:30:00');
    expect(p.timezone).toBe('America/New_York');
  });

  it('falls back to the event title when the plan title is blank', () => {
    const p = planToCalendarPayload(plan({ title: '   ' }), event({ title: 'Fallback' }));
    expect(p.title).toBe('Fallback');
  });

  it('prefers the plan title when present', () => {
    const p = planToCalendarPayload(plan({ title: 'Plan Wins' }), event({ title: 'Event Loses' }));
    expect(p.title).toBe('Plan Wins');
  });

  it('builds location from event venue_name and address', () => {
    const p = planToCalendarPayload(plan(), event());
    expect(p.location).toBe('Blue Note, 131 W 3rd St');
  });

  it('handles a plan with no event', () => {
    const p = planToCalendarPayload(plan({ title: 'Solo Plan' }), null);
    expect(p.title).toBe('Solo Plan');
    expect(p.location).toBeNull();
    expect(p.description).toBeNull();
    expect(p.url).toBeNull();
    expect(p.allDay).toBe(false);
  });

  it('carries event all_day and purchase_url onto the payload', () => {
    const p = planToCalendarPayload(plan(), event({ all_day: 1, purchase_url: 'https://x.test' }));
    expect(p.allDay).toBe(true);
    expect(p.url).toBe('https://x.test');
  });
});

describe('eventToCalendarPayload', () => {
  it('uses the event id as manhattanId', () => {
    const p = eventToCalendarPayload(event());
    expect(p.manhattanId).toBe('evt-1');
    expect(p.title).toBe('Event Title');
    expect(p.location).toBe('Blue Note, 131 W 3rd St');
    expect(p.startAt).toBe('2026-07-01T20:00:00');
    expect(p.endAt).toBe('2026-07-01T22:00:00');
  });

  it('coerces a null start_at to an empty string', () => {
    const p = eventToCalendarPayload(event({ start_at: null }));
    expect(p.startAt).toBe('');
  });

  it('maps all_day 1 to allDay true', () => {
    expect(eventToCalendarPayload(event({ all_day: 1 })).allDay).toBe(true);
    expect(eventToCalendarPayload(event({ all_day: 0 })).allDay).toBe(false);
  });
});

describe('generateManhattanICS', () => {
  it('emits TZID datetimes (not floating UTC) for timed events', () => {
    const ics = generateManhattanICS([payload({ manhattanId: 'm-1' })]);
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260701T200000');
    expect(ics).toContain('DTEND;TZID=America/New_York:20260701T220000');
    expect(ics).not.toContain('DTSTART:20260701T200000Z');
  });

  it('emits VALUE=DATE for all-day events', () => {
    const ics = generateManhattanICS([
      payload({ allDay: true, startAt: '2026-07-04', endAt: '2026-07-05' }),
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260704');
    expect(ics).toContain('DTEND;VALUE=DATE:20260705');
    expect(ics).not.toContain('TZID');
  });

  it('writes a stable UID and X-MANHATTAN-ID per event', () => {
    const ics = generateManhattanICS([payload({ manhattanId: 'abc-123' })]);
    expect(ics).toContain('UID:abc-123@mylife.manhattan');
    expect(ics).toContain('X-MANHATTAN-ID:abc-123');
  });

  it('includes DTSTAMP, SUMMARY, DESCRIPTION, LOCATION, URL', () => {
    const ics = generateManhattanICS([
      payload({
        title: 'Jazz Night',
        description: 'Live set',
        location: 'Blue Note',
        url: 'https://example.com',
      }),
    ]);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain('SUMMARY:Jazz Night');
    expect(ics).toContain('DESCRIPTION:Live set');
    expect(ics).toContain('LOCATION:Blue Note');
    expect(ics).toContain('URL:https://example.com');
  });

  it('escapes commas and semicolons in text fields', () => {
    const ics = generateManhattanICS([payload({ title: 'A, B; C', location: 'x, y' })]);
    expect(ics).toContain('SUMMARY:A\\, B\\; C');
    expect(ics).toContain('LOCATION:x\\, y');
  });

  it('omits DTEND when endAt is null', () => {
    const ics = generateManhattanICS([payload({ endAt: null })]);
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260701T200000');
    expect(ics).not.toContain('DTEND');
  });

  it('wraps each VEVENT and the VCALENDAR envelope with CRLF', () => {
    const ics = generateManhattanICS([payload(), payload({ manhattanId: 'm-2' })]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const begins = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(begins).toHaveLength(2);
  });
});

describe('manhattan id notes round-trip', () => {
  it('embeds an id that extractManhattanId recovers', () => {
    const notes = buildManhattanEventNotes('m-42');
    expect(extractManhattanId(notes)).toBe('m-42');
  });

  it('preserves base notes alongside the managed block', () => {
    const notes = buildManhattanEventNotes('m-99', 'See you there!');
    expect(notes).toContain('See you there!');
    expect(extractManhattanId(notes)).toBe('m-99');
  });

  it('replaces an existing managed block rather than duplicating it', () => {
    const first = buildManhattanEventNotes('old-id', 'Hi');
    const second = buildManhattanEventNotes('new-id', first);
    expect(extractManhattanId(second)).toBe('new-id');
    expect(second).not.toContain('old-id');
    const blocks = second.match(/\[MyLife:Manhattan\]/g) ?? [];
    expect(blocks).toHaveLength(1);
  });

  it('returns null when no managed block is present', () => {
    expect(extractManhattanId('just some notes')).toBeNull();
    expect(extractManhattanId(null)).toBeNull();
    expect(extractManhattanId(undefined)).toBeNull();
  });
});

describe('reconcileInboundDeviceEvents', () => {
  function dev(over: Partial<DeviceCalendarEvent> = {}): DeviceCalendarEvent {
    return {
      id: 'device-1',
      title: 'Device Event',
      startDate: '2026-07-01T20:00:00',
      endDate: '2026-07-01T22:00:00',
      location: 'Somewhere',
      notes: null,
      allDay: false,
      ...over,
    };
  }

  it('emits a NormalizedEvent sourced from device_calendar', () => {
    const out = reconcileInboundDeviceEvents([dev()], []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      sourceId: 'device_calendar',
      externalId: 'device-1',
      title: 'Device Event',
      startAt: '2026-07-01T20:00:00',
      endAt: '2026-07-01T22:00:00',
      venueName: 'Somewhere',
      allDay: false,
    });
  });

  it('prefers the embedded manhattan id over the device id', () => {
    const notes = buildManhattanEventNotes('m-777');
    const out = reconcileInboundDeviceEvents([dev({ id: 'eventkit-churned', notes })], []);
    expect(out).toHaveLength(1);
    expect(out[0]?.externalId).toBe('m-777');
  });

  it('skips events whose chosen externalId is already known (by device id)', () => {
    const out = reconcileInboundDeviceEvents([dev({ id: 'known-1' })], ['known-1']);
    expect(out).toHaveLength(0);
  });

  it('skips events whose embedded manhattan id is already known', () => {
    const notes = buildManhattanEventNotes('m-known');
    const out = reconcileInboundDeviceEvents([dev({ id: 'device-x', notes })], ['m-known']);
    expect(out).toHaveLength(0);
  });

  it('dedups a mixed batch against knownExternalIds', () => {
    const events = [
      dev({ id: 'a' }),
      dev({ id: 'b', notes: buildManhattanEventNotes('m-b') }),
      dev({ id: 'c' }),
    ];
    const out = reconcileInboundDeviceEvents(events, ['a', 'm-b']);
    expect(out.map((e) => e.externalId)).toEqual(['c']);
  });

  it('coerces a null endDate and missing location to undefined', () => {
    const out = reconcileInboundDeviceEvents([dev({ endDate: null, location: null })], []);
    expect(out[0]?.endAt).toBeUndefined();
    expect(out[0]?.venueName).toBeUndefined();
  });
});
