import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createDestination, markVisited } from '../db/crud/destinations';
import { createTrip } from '../db/crud/trips';
import {
  bookingSpendByTripCurrency,
  continentsVisited,
  countriesVisited,
  regionCoverage,
  statesVisited,
  topDestinations,
  totalDistanceKm,
  totalTripDays,
  tripsByYear,
  upcomingTripsCount,
} from '../engine/stats';

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

// Helper: create + immediately mark visited on a given date.
function seedVisited(
  params: {
    name: string;
    country?: string;
    country_code?: string;
    region?: string;
    lat?: number;
    lng?: number;
    visitedDate?: string;
  },
) {
  const d = createDestination(adapter, {
    name: params.name,
    country: params.country,
    country_code: params.country_code,
    region: params.region,
    lat: params.lat,
    lng: params.lng,
    bucket_list: false,
  });
  if (params.visitedDate) {
    markVisited(adapter, d.id, params.visitedDate);
  }
  return d;
}

// ── Empty DB ────────────────────────────────────────────────────────

describe('stats engine (empty DB)', () => {
  it('countriesVisited returns 0', () => {
    expect(countriesVisited(adapter)).toBe(0);
  });

  it('statesVisited returns 0', () => {
    expect(statesVisited(adapter)).toBe(0);
  });

  it('continentsVisited returns empty array', () => {
    expect(continentsVisited(adapter)).toEqual([]);
  });

  it('regionCoverage returns 0/0/0 for each region', () => {
    const r = regionCoverage(adapter, 'schengen');
    expect(r.visited).toBe(0);
    expect(r.total).toBeGreaterThan(0);
    expect(r.pct).toBe(0);
  });

  it('totalTripDays returns 0', () => {
    expect(totalTripDays(adapter)).toBe(0);
  });

  it('totalDistanceKm returns 0', () => {
    expect(totalDistanceKm(adapter)).toBe(0);
  });

  it('tripsByYear returns {}', () => {
    expect(tripsByYear(adapter)).toEqual({});
  });

  it('topDestinations returns []', () => {
    expect(topDestinations(adapter)).toEqual([]);
  });

  it('upcomingTripsCount returns 0', () => {
    expect(upcomingTripsCount(adapter)).toBe(0);
  });

  it('bookingSpendByTripCurrency returns {} for unknown trip', () => {
    expect(bookingSpendByTripCurrency(adapter, 'nope')).toEqual({});
  });
});

// ── Seeded fixture ──────────────────────────────────────────────────

function seedFixture() {
  // Destinations across 4 countries (US, FR, DE, JP).
  // US: CA + NY (2 states, 2 cities); FR: Paris; DE: Berlin; JP: Tokyo.
  seedVisited({
    name: 'San Francisco',
    country: 'United States',
    country_code: 'US',
    region: 'CA',
    lat: 37.7749,
    lng: -122.4194,
    visitedDate: '2024-06-15',
  });
  seedVisited({
    name: 'New York',
    country: 'United States',
    country_code: 'US',
    region: 'NY',
    lat: 40.7128,
    lng: -74.006,
    visitedDate: '2024-07-20',
  });
  seedVisited({
    name: 'Paris',
    country: 'France',
    country_code: 'FR',
    lat: 48.8566,
    lng: 2.3522,
    visitedDate: '2023-05-10',
  });
  seedVisited({
    name: 'Berlin',
    country: 'Germany',
    country_code: 'DE',
    visitedDate: '2023-05-15', // no coords
  });
  seedVisited({
    name: 'Tokyo',
    country: 'Japan',
    country_code: 'JP',
    lat: 35.6762,
    lng: 139.6503,
    visitedDate: '2022-09-01',
  });
  // Un-visited bucket-list entry: should not count.
  createDestination(adapter, {
    name: 'Reykjavik',
    country_code: 'IS',
    bucket_list: true,
  });

  // Trips: 2 upcoming, 3 past (completed), 1 draft (planning)
  createTrip(adapter, {
    name: 'Future Japan',
    start_date: '2027-03-01',
    end_date: '2027-03-10',
    status: 'upcoming',
  });
  createTrip(adapter, {
    name: 'Future Iceland',
    start_date: '2027-06-01',
    end_date: '2027-06-07',
    status: 'upcoming',
  });
  createTrip(adapter, {
    name: 'Paris 2023',
    start_date: '2023-05-10',
    end_date: '2023-05-14', // 5 days inclusive
    status: 'completed',
  });
  createTrip(adapter, {
    name: 'Tokyo 2022',
    start_date: '2022-09-01',
    end_date: '2022-09-07', // 7 days
    status: 'completed',
  });
  createTrip(adapter, {
    name: 'US Road 2024',
    start_date: '2024-06-15',
    end_date: '2024-07-20', // 36 days
    status: 'completed',
  });
  const draft = createTrip(adapter, {
    name: 'Someday',
    status: 'planning',
    // no dates
  });
  return { draftTripId: draft.id };
}

describe('countriesVisited', () => {
  it('counts distinct visited country_codes', () => {
    seedFixture();
    expect(countriesVisited(adapter)).toBe(4); // US, FR, DE, JP
  });

  it('excludes un-visited bucket-list entries', () => {
    createDestination(adapter, {
      name: 'Reykjavik',
      country_code: 'IS',
      bucket_list: true,
    });
    expect(countriesVisited(adapter)).toBe(0);
  });
});

describe('statesVisited', () => {
  it('counts distinct visited US state codes only', () => {
    seedFixture();
    expect(statesVisited(adapter)).toBe(2); // CA, NY
  });

  it('does not count non-US regions', () => {
    seedVisited({
      name: 'Bordeaux',
      country_code: 'FR',
      region: 'Nouvelle-Aquitaine',
      visitedDate: '2024-01-01',
    });
    expect(statesVisited(adapter)).toBe(0);
  });
});

describe('continentsVisited', () => {
  it('returns distinct sorted continent names', () => {
    seedFixture();
    const cs = continentsVisited(adapter);
    expect(cs).toEqual(['Asia', 'Europe', 'North America']);
  });
});

describe('regionCoverage', () => {
  it('schengen includes France and Germany', () => {
    seedFixture();
    const r = regionCoverage(adapter, 'schengen');
    expect(r.visited).toBe(2);
    expect(r.total).toBe(27);
    expect(r.pct).toBe(Math.round((2 / 27) * 100));
  });

  it('eu_countries includes France and Germany', () => {
    seedFixture();
    const r = regionCoverage(adapter, 'eu_countries');
    expect(r.visited).toBe(2);
    expect(r.total).toBe(27);
  });

  it('g7 includes US, France, Germany, Japan', () => {
    seedFixture();
    const r = regionCoverage(adapter, 'g7');
    expect(r.visited).toBe(4);
    expect(r.total).toBe(7);
  });

  it('us_states reports CA and NY', () => {
    seedFixture();
    const r = regionCoverage(adapter, 'us_states');
    expect(r.visited).toBe(2);
    expect(r.total).toBe(51); // 50 + DC
  });

  it('caribbean reports 0 with no Caribbean visits', () => {
    seedFixture();
    const r = regionCoverage(adapter, 'caribbean');
    expect(r.visited).toBe(0);
    expect(r.pct).toBe(0);
  });
});

describe('totalTripDays', () => {
  it('sums (end - start + 1) inclusive days', () => {
    seedFixture();
    // 5 + 7 + 36 + 10 + 7 = 65
    expect(totalTripDays(adapter)).toBe(65);
  });

  it('ignores trips missing dates', () => {
    createTrip(adapter, { name: 'Dateless', status: 'planning' });
    expect(totalTripDays(adapter)).toBe(0);
  });
});

describe('tripsByYear', () => {
  it('keys trips by start year', () => {
    seedFixture();
    const byYear = tripsByYear(adapter);
    expect(byYear['2022']).toBe(1);
    expect(byYear['2023']).toBe(1);
    expect(byYear['2024']).toBe(1);
    expect(byYear['2027']).toBe(2);
  });
});

describe('upcomingTripsCount', () => {
  it('counts upcoming + planning trips', () => {
    seedFixture();
    // 2 upcoming + 1 planning draft = 3
    expect(upcomingTripsCount(adapter)).toBe(3);
  });
});

describe('totalDistanceKm', () => {
  it('returns a positive km distance for >=2 destinations with coords', () => {
    seedFixture();
    const km = totalDistanceKm(adapter);
    expect(km).toBeGreaterThan(0);
    // Rough sanity: SF -> Tokyo -> Paris -> NY is thousands of km.
    expect(km).toBeGreaterThan(1000);
  });

  it('returns 0 when fewer than 2 coord-tagged visited destinations', () => {
    seedVisited({
      name: 'Solo',
      country_code: 'US',
      lat: 1,
      lng: 2,
      visitedDate: '2024-01-01',
    });
    expect(totalDistanceKm(adapter)).toBe(0);
  });
});

describe('topDestinations', () => {
  it('orders by visit_count DESC and respects limit', () => {
    seedFixture();
    // Bump Paris visit_count.
    const paris = adapter
      .query<{ id: string }>(
        `SELECT id FROM tv_destinations WHERE name = 'Paris'`,
      )[0];
    markVisited(adapter, paris.id, '2024-03-01');
    markVisited(adapter, paris.id, '2024-08-01');
    const top = topDestinations(adapter, 3);
    expect(top).toHaveLength(3);
    expect(top[0].name).toBe('Paris');
    expect(top[0].visit_count).toBeGreaterThanOrEqual(3);
  });

  it('defaults limit to 10 and excludes un-visited', () => {
    seedFixture();
    const all = topDestinations(adapter);
    expect(all.length).toBeLessThanOrEqual(10);
    for (const d of all) expect(d.visit_count).toBeGreaterThan(0);
  });
});

describe('bookingSpendByTripCurrency', () => {
  it('returns {} when bookings table query has no rows', () => {
    const { draftTripId } = seedFixture();
    expect(bookingSpendByTripCurrency(adapter, draftTripId)).toEqual({});
  });

  it('groups spend by currency when bookings exist', () => {
    const trip = createTrip(adapter, {
      name: 'Billed Trip',
      status: 'upcoming',
    });
    adapter.execute(
      `INSERT INTO tv_bookings
         (id, trip_id, type, provider, start_ts, cost_cents, currency, created_at, updated_at)
       VALUES (?, ?, 'flight', 'UA', '2027-01-01', 50000, 'USD', '2026-01-01', '2026-01-01')`,
      ['bk1', trip.id],
    );
    adapter.execute(
      `INSERT INTO tv_bookings
         (id, trip_id, type, provider, start_ts, cost_cents, currency, created_at, updated_at)
       VALUES (?, ?, 'hotel', 'Hilton', '2027-01-02', 20000, 'USD', '2026-01-01', '2026-01-01')`,
      ['bk2', trip.id],
    );
    adapter.execute(
      `INSERT INTO tv_bookings
         (id, trip_id, type, provider, start_ts, cost_cents, currency, created_at, updated_at)
       VALUES (?, ?, 'tour', 'LocalCo', '2027-01-03', 15000, 'EUR', '2026-01-01', '2026-01-01')`,
      ['bk3', trip.id],
    );

    const result = bookingSpendByTripCurrency(adapter, trip.id);
    expect(result['USD']).toBe(70000);
    expect(result['EUR']).toBe(15000);
  });

  it('handles missing bookings table gracefully', () => {
    // Simulate schema absence by dropping the table.
    adapter.execute(`DROP TABLE IF EXISTS tv_bookings`);
    expect(bookingSpendByTripCurrency(adapter, 'any')).toEqual({});
  });
});
