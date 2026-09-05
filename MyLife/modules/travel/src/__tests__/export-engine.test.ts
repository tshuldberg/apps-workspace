import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import { createDay, createActivity } from '../db/crud/itinerary';
import { createDestination, markVisited } from '../db/crud/destinations';
import { createBooking } from '../db/crud/bookings';
import {
  exportAllTripsToJson,
  exportDestinationsToCsv,
  exportTripToCsv,
  exportTripToIcal,
  exportTripToJson,
} from '../engine/export';

let adapter: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedTrip(): {
  tripId: string;
  dayId: string;
  activityId: string;
  destinationId: string;
  bookingId: string;
} {
  const dest = createDestination(adapter, {
    name: 'Lisbon',
    country: 'Portugal',
    country_code: 'PT',
    lat: 38.7,
    lng: -9.14,
    bucket_list: false,
  });
  markVisited(adapter, dest.id, '2026-03-01');

  const trip = createTrip(adapter, {
    name: 'Portugal 2026',
    destination_ids: [dest.id],
    start_date: '2026-06-01',
    end_date: '2026-06-07',
    status: 'upcoming',
  });
  const day = createDay(adapter, {
    trip_id: trip.id,
    day_number: 1,
    date: '2026-06-01',
    location: 'Lisbon',
  });
  const activity = createActivity(adapter, {
    trip_id: trip.id,
    day_id: day.id,
    title: 'Jeronimos Monastery',
    type: 'sight',
    time: '10:30',
    end_time: '12:00',
    location: 'Belem',
    cost_cents: 1500,
    notes_md: 'Arrive early, line grows fast',
  });
  const booking = createBooking(adapter, {
    trip_id: trip.id,
    type: 'flight',
    provider: 'TAP',
    confirmation_code: 'ABC123',
    start_ts: '2026-06-01T08:00:00.000Z',
    end_ts: '2026-06-01T17:30:00.000Z',
    location: 'JFK -> LIS',
    cost_cents: 78000,
    currency: 'USD',
    notes: 'Window seat',
  });
  return {
    tripId: trip.id,
    dayId: day.id,
    activityId: activity.id,
    destinationId: dest.id,
    bookingId: booking.id,
  };
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

describe('exportTripToJson', () => {
  it('returns parseable JSON with expected top-level keys', () => {
    const { tripId } = seedTrip();
    const parsed = JSON.parse(exportTripToJson(adapter, tripId));
    expect(parsed).toHaveProperty('exportedAt');
    expect(parsed).toHaveProperty('schemaVersion');
    expect(parsed).toHaveProperty('trip');
    expect(parsed).toHaveProperty('destinations');
    expect(parsed).toHaveProperty('days');
    expect(parsed).toHaveProperty('bookings');
    expect(parsed.trip.name).toBe('Portugal 2026');
  });

  it('hydrates days with activities sorted by time ascending', () => {
    const { tripId, dayId } = seedTrip();
    createActivity(adapter, {
      trip_id: tripId,
      day_id: dayId,
      title: 'Early breakfast',
      time: '07:30',
    });
    const parsed = JSON.parse(exportTripToJson(adapter, tripId));
    expect(parsed.days[0].activities[0].title).toBe('Early breakfast');
    expect(parsed.days[0].activities[1].title).toBe('Jeronimos Monastery');
  });

  it('returns empty arrays for a trip with no days/bookings/destinations', () => {
    const trip = createTrip(adapter, { name: 'Empty Trip' });
    const parsed = JSON.parse(exportTripToJson(adapter, trip.id));
    expect(parsed.days).toEqual([]);
    expect(parsed.bookings).toEqual([]);
    expect(parsed.destinations).toEqual([]);
  });

  it('returns a shell doc when trip is missing', () => {
    const parsed = JSON.parse(exportTripToJson(adapter, 'missing-id'));
    expect(parsed.trip).toBeNull();
    expect(parsed.days).toEqual([]);
  });

  it('is deterministic: same inputs produce same trip-level content', () => {
    const { tripId } = seedTrip();
    const a = JSON.parse(exportTripToJson(adapter, tripId));
    const b = JSON.parse(exportTripToJson(adapter, tripId));
    delete a.exportedAt;
    delete b.exportedAt;
    expect(a).toEqual(b);
  });

  it('exportAllTripsToJson returns every trip', () => {
    seedTrip();
    createTrip(adapter, { name: 'Trip B', start_date: '2026-07-01' });
    const parsed = JSON.parse(exportAllTripsToJson(adapter));
    expect(parsed.trips).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

describe('exportTripToCsv (itinerary)', () => {
  it('first line is the spec header', () => {
    const { tripId } = seedTrip();
    const csv = exportTripToCsv(adapter, tripId, 'itinerary');
    expect(csv.split('\r\n')[0]).toBe(
      'trip_id,trip_name,day_number,day_date,activity_type,activity_title,activity_location,start_time,end_time,cost_cents,notes',
    );
  });

  it('contains the activity title row', () => {
    const { tripId } = seedTrip();
    const csv = exportTripToCsv(adapter, tripId, 'itinerary');
    expect(csv).toContain('Jeronimos Monastery');
    expect(csv).toContain('10:30');
  });

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const trip = createTrip(adapter, { name: 'Weird, "Trip"' });
    const day = createDay(adapter, {
      trip_id: trip.id,
      day_number: 1,
      date: '2026-06-01',
    });
    createActivity(adapter, {
      trip_id: trip.id,
      day_id: day.id,
      title: 'a,b',
      notes_md: 'line1\nline2',
    });
    const csv = exportTripToCsv(adapter, trip.id, 'itinerary');
    // Trip name with comma and quote must be wrapped and quote-doubled.
    expect(csv).toContain('"Weird, ""Trip"""');
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"line1\nline2"');
  });

  it('emits one row per day even when day has no activities', () => {
    const trip = createTrip(adapter, { name: 'Blank Day Trip' });
    createDay(adapter, {
      trip_id: trip.id,
      day_number: 1,
      date: '2026-06-01',
      location: 'Porto',
      summary_md: 'rest day',
    });
    const csv = exportTripToCsv(adapter, trip.id, 'itinerary');
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2); // header + 1 day row
    expect(rows[1]).toContain('Porto');
    expect(rows[1]).toContain('rest day');
  });
});

describe('exportTripToCsv (bookings)', () => {
  it('first line is the spec header', () => {
    const { tripId } = seedTrip();
    const csv = exportTripToCsv(adapter, tripId, 'bookings');
    expect(csv.split('\r\n')[0]).toBe(
      'trip_id,trip_name,type,provider,confirmation_code,start_ts,end_ts,location,cost_cents,currency,notes',
    );
  });

  it('contains the seeded booking provider and code', () => {
    const { tripId } = seedTrip();
    const csv = exportTripToCsv(adapter, tripId, 'bookings');
    expect(csv).toContain('TAP');
    expect(csv).toContain('ABC123');
    expect(csv).toContain('USD');
  });

  it('returns header-only CSV when trip has no bookings', () => {
    const trip = createTrip(adapter, { name: 'No Bookings' });
    const csv = exportTripToCsv(adapter, trip.id, 'bookings');
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});

describe('exportDestinationsToCsv', () => {
  it('header matches spec and includes seeded destination', () => {
    seedTrip();
    const csv = exportDestinationsToCsv(adapter);
    expect(csv.split('\r\n')[0]).toBe(
      'id,name,country_code,region,city,lat,lng,type,notes,first_visited',
    );
    expect(csv).toContain('Lisbon');
    expect(csv).toContain('PT');
    expect(csv).toContain('visited');
  });
});

// ---------------------------------------------------------------------------
// iCal
// ---------------------------------------------------------------------------

describe('exportTripToIcal', () => {
  it('wraps VCALENDAR with PRODID and VERSION', () => {
    const { tripId } = seedTrip();
    const ical = exportTripToIcal(adapter, tripId);
    expect(ical.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ical.endsWith('END:VCALENDAR')).toBe(true);
    expect(ical).toContain('PRODID:-//MyLife//Travel//EN');
    expect(ical).toContain('VERSION:2.0');
  });

  it('emits one VEVENT per booking and per timed activity', () => {
    const { tripId } = seedTrip();
    const ical = exportTripToIcal(adapter, tripId);
    const count = (ical.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(2); // 1 booking + 1 activity
  });

  it('skips activities without a usable start_time', () => {
    const { tripId, dayId } = seedTrip();
    createActivity(adapter, {
      trip_id: tripId,
      day_id: dayId,
      title: 'No time activity',
    });
    const ical = exportTripToIcal(adapter, tripId);
    expect(ical).not.toContain('No time activity');
  });

  it('formats DTSTART as YYYYMMDDTHHMMSSZ', () => {
    const { tripId } = seedTrip();
    const ical = exportTripToIcal(adapter, tripId);
    expect(ical).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it('escapes commas and semicolons in SUMMARY and LOCATION', () => {
    const trip = createTrip(adapter, { name: 'Escape Trip' });
    createBooking(adapter, {
      trip_id: trip.id,
      type: 'hotel',
      provider: 'A, B; C',
      start_ts: '2026-06-01T10:00:00.000Z',
      location: 'X, Y',
    });
    const ical = exportTripToIcal(adapter, trip.id);
    expect(ical).toContain('Hotel: A\\, B\\; C');
    expect(ical).toContain('LOCATION:X\\, Y');
  });

  it('is deterministic across calls (ignoring DTSTAMP)', () => {
    const { tripId } = seedTrip();
    const a = exportTripToIcal(adapter, tripId).replace(
      /DTSTAMP:[^\r\n]+/g,
      'DTSTAMP:X',
    );
    const b = exportTripToIcal(adapter, tripId).replace(
      /DTSTAMP:[^\r\n]+/g,
      'DTSTAMP:X',
    );
    expect(a).toBe(b);
  });

  it('defaults booking DTEND to +1h when end_ts is missing', () => {
    const trip = createTrip(adapter, { name: 'No-end booking' });
    createBooking(adapter, {
      trip_id: trip.id,
      type: 'tour',
      provider: 'Acme',
      start_ts: '2026-06-01T10:00:00.000Z',
    });
    const ical = exportTripToIcal(adapter, trip.id);
    expect(ical).toContain('DTSTART:20260601T100000Z');
    expect(ical).toContain('DTEND:20260601T110000Z');
  });
});
