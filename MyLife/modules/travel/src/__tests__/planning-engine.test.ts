import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createDestination } from '../db/crud/destinations';
import { createTrip, updateTrip } from '../db/crud/trips';
import { createBooking } from '../db/crud/bookings';
import { createDocument } from '../db/crud/documents';
import {
  bestTimeToVisit,
  budgetEstimate,
  preTripReminders,
  recommendActivitiesForTrip,
  similarDestinations,
  suggestTripLength,
} from '../engine/planning';

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

// Helpers

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoAddMonthsFromNow(months: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ── suggestTripLength ──────────────────────────────────────────────

describe('suggestTripLength', () => {
  it('returns default (medium) when destination has no history', () => {
    const d = createDestination(adapter, {
      name: 'Lisbon',
      country_code: 'PT',
      bucket_list: false,
    });
    const res = suggestTripLength(adapter, d.id);
    expect(res.source).toBe('default');
    expect(res.typical).toBe(10);
    expect(res.minDays).toBe(7);
    expect(res.maxDays).toBe(14);
  });

  it('returns default for unknown destination id', () => {
    const res = suggestTripLength(adapter, 'does-not-exist');
    expect(res.source).toBe('default');
  });

  it('returns history-derived range when past trips to same country exist', () => {
    const paris = createDestination(adapter, {
      name: 'Paris',
      country_code: 'FR',
      bucket_list: false,
    });
    const nice = createDestination(adapter, {
      name: 'Nice',
      country_code: 'FR',
      bucket_list: false,
    });
    createTrip(adapter, {
      name: 'Paris 2023',
      destination_ids: [paris.id],
      start_date: '2023-05-10',
      end_date: '2023-05-14', // 5 days
      status: 'completed',
    });
    createTrip(adapter, {
      name: 'Nice 2024',
      destination_ids: [nice.id],
      start_date: '2024-06-01',
      end_date: '2024-06-09', // 9 days
      status: 'completed',
    });

    const fresh = createDestination(adapter, {
      name: 'Lyon',
      country_code: 'FR',
      bucket_list: false,
    });
    const res = suggestTripLength(adapter, fresh.id);
    expect(res.source).toBe('history');
    expect(res.minDays).toBe(5);
    expect(res.maxDays).toBe(9);
    expect(res.typical).toBe(7); // mean of 5 and 9
  });
});

// ── bestTimeToVisit ────────────────────────────────────────────────

describe('bestTimeToVisit', () => {
  it('returns Caribbean dry-season months for JM', () => {
    const r = bestTimeToVisit('JM');
    expect(r.months).toContain(12);
    expect(r.months).toContain(1);
    expect(r.months).not.toContain(7);
    expect(r.reason.toLowerCase()).toContain('dry');
  });

  it('returns SE Asia cool/dry months for TH', () => {
    const r = bestTimeToVisit('TH');
    expect(r.months).toEqual([11, 12, 1, 2]);
  });

  it('returns Europe May-Sep for FR', () => {
    const r = bestTimeToVisit('FR');
    expect(r.months).toEqual([5, 6, 7, 8, 9]);
  });

  it('returns Japan-specific months for JP', () => {
    const r = bestTimeToVisit('JP');
    expect(r.months).toContain(4);
    expect(r.months).toContain(11);
    expect(r.reason.toLowerCase()).toMatch(/cherry|fall|foliage/);
  });

  it('returns southern hemisphere summer for AU', () => {
    const r = bestTimeToVisit('AU');
    expect(r.months).toContain(1);
    expect(r.months).toContain(12);
    expect(r.months).not.toContain(7);
  });

  it('returns year-round for unknown/nullish country', () => {
    const r = bestTimeToVisit(null);
    expect(r.months).toHaveLength(12);
    const r2 = bestTimeToVisit('ZZ');
    expect(r2.months).toHaveLength(12);
  });
});

// ── similarDestinations ────────────────────────────────────────────

describe('similarDestinations', () => {
  it('returns same-country destinations first, excluding self', () => {
    const paris = createDestination(adapter, {
      name: 'Paris',
      country_code: 'FR',
      bucket_list: false,
    });
    createDestination(adapter, {
      name: 'Nice',
      country_code: 'FR',
      bucket_list: false,
    });
    createDestination(adapter, {
      name: 'Lyon',
      country_code: 'FR',
      bucket_list: false,
    });
    createDestination(adapter, {
      name: 'Berlin',
      country_code: 'DE',
      bucket_list: false,
    });
    const res = similarDestinations(adapter, paris.id, 10);
    const names = res.map((r) => r.name);
    expect(names).not.toContain('Paris');
    expect(names).toContain('Nice');
    expect(names).toContain('Lyon');
    // Same country results should come first.
    expect(names.slice(0, 2).sort()).toEqual(['Lyon', 'Nice']);
  });

  it('respects the limit', () => {
    const paris = createDestination(adapter, {
      name: 'Paris',
      country_code: 'FR',
      bucket_list: false,
    });
    createDestination(adapter, {
      name: 'Nice',
      country_code: 'FR',
      bucket_list: false,
    });
    createDestination(adapter, {
      name: 'Lyon',
      country_code: 'FR',
      bucket_list: false,
    });
    const res = similarDestinations(adapter, paris.id, 1);
    expect(res).toHaveLength(1);
  });

  it('returns empty when destination id is unknown', () => {
    expect(similarDestinations(adapter, 'nope', 5)).toEqual([]);
  });
});

// ── recommendActivitiesForTrip ─────────────────────────────────────

describe('recommendActivitiesForTrip', () => {
  it('returns generic list when trip has no destinations', () => {
    const t = createTrip(adapter, { name: 'Someday', status: 'planning' });
    const res = recommendActivitiesForTrip(adapter, t.id);
    expect(res.length).toBeGreaterThanOrEqual(4);
    expect(res.length).toBeLessThanOrEqual(10);
  });

  it('adds beach activities for Caribbean destinations', () => {
    const d = createDestination(adapter, {
      name: 'Nassau',
      country_code: 'BS',
      bucket_list: false,
    });
    const t = createTrip(adapter, {
      name: 'Bahamas',
      destination_ids: [d.id],
      status: 'upcoming',
    });
    const res = recommendActivitiesForTrip(adapter, t.id);
    expect(res.some((s) => /beach|snorkel|sail|cruise|island/i.test(s))).toBe(
      true,
    );
  });

  it('adds business-specific activity for business trips', () => {
    const d = createDestination(adapter, {
      name: 'Tokyo',
      country_code: 'JP',
      bucket_list: false,
    });
    const t = createTrip(adapter, {
      name: 'Work Tokyo',
      destination_ids: [d.id],
      trip_type: 'business',
      status: 'upcoming',
    });
    const res = recommendActivitiesForTrip(adapter, t.id);
    expect(res.some((s) => /coworking|lounge/i.test(s))).toBe(true);
  });
});

// ── budgetEstimate ─────────────────────────────────────────────────

describe('budgetEstimate', () => {
  it('returns zero/empty when no past trips exist', () => {
    const d = createDestination(adapter, {
      name: 'Lisbon',
      country_code: 'PT',
      bucket_list: false,
    });
    const t = createTrip(adapter, {
      name: 'Lisbon future',
      destination_ids: [d.id],
      start_date: '2027-05-01',
      end_date: '2027-05-07',
      status: 'upcoming',
    });
    const res = budgetEstimate(adapter, t.id);
    expect(res.sampleSize).toBe(0);
    expect(res.perDayCents).toBe(0);
    expect(res.totalCents).toBe(0);
  });

  it('returns zero when trip has no destination country', () => {
    const t = createTrip(adapter, {
      name: 'Mystery',
      start_date: '2027-05-01',
      end_date: '2027-05-07',
      status: 'upcoming',
    });
    const res = budgetEstimate(adapter, t.id);
    expect(res.sampleSize).toBe(0);
  });

  it('estimates per-day + total from a single past trip', () => {
    const lisbon = createDestination(adapter, {
      name: 'Lisbon',
      country_code: 'PT',
      bucket_list: false,
    });
    const pastTrip = createTrip(adapter, {
      name: 'Lisbon past',
      destination_ids: [lisbon.id],
      start_date: '2024-05-01',
      end_date: '2024-05-05', // 5 days
      status: 'completed',
    });
    createBooking(adapter, {
      trip_id: pastTrip.id,
      type: 'hotel',
      provider: 'Hotel X',
      start_ts: '2024-05-01',
      cost_cents: 50000,
      currency: 'USD',
    });

    const porto = createDestination(adapter, {
      name: 'Porto',
      country_code: 'PT',
      bucket_list: false,
    });
    const future = createTrip(adapter, {
      name: 'Porto future',
      destination_ids: [porto.id],
      start_date: '2027-06-01',
      end_date: '2027-06-07', // 7 days
      status: 'upcoming',
    });
    const res = budgetEstimate(adapter, future.id);
    expect(res.sampleSize).toBe(1);
    expect(res.currency).toBe('USD');
    expect(res.perDayCents).toBe(10000); // 50000 / 5
    expect(res.totalCents).toBe(70000); // 10000 * 7
  });

  it('averages per-day across multiple past trips to same country', () => {
    const a = createDestination(adapter, {
      name: 'Dest A',
      country_code: 'PT',
      bucket_list: false,
    });
    const b = createDestination(adapter, {
      name: 'Dest B',
      country_code: 'PT',
      bucket_list: false,
    });
    const t1 = createTrip(adapter, {
      name: 'Past A',
      destination_ids: [a.id],
      start_date: '2023-05-01',
      end_date: '2023-05-05', // 5 days
      status: 'completed',
    });
    createBooking(adapter, {
      trip_id: t1.id,
      type: 'hotel',
      provider: 'H',
      start_ts: '2023-05-01',
      cost_cents: 40000, // 8000/day
      currency: 'USD',
    });
    const t2 = createTrip(adapter, {
      name: 'Past B',
      destination_ids: [b.id],
      start_date: '2024-05-01',
      end_date: '2024-05-05', // 5 days
      status: 'completed',
    });
    createBooking(adapter, {
      trip_id: t2.id,
      type: 'hotel',
      provider: 'H',
      start_ts: '2024-05-01',
      cost_cents: 60000, // 12000/day
      currency: 'USD',
    });

    const future = createTrip(adapter, {
      name: 'Future',
      destination_ids: [a.id],
      start_date: '2027-06-01',
      end_date: '2027-06-04', // 4 days
      status: 'upcoming',
    });
    const res = budgetEstimate(adapter, future.id);
    expect(res.sampleSize).toBe(2);
    expect(res.perDayCents).toBe(10000); // mean of 8000,12000
    expect(res.totalCents).toBe(40000); // 10000*4
  });
});

// ── preTripReminders ───────────────────────────────────────────────

describe('preTripReminders', () => {
  it('returns empty for unknown trip id', () => {
    expect(preTripReminders(adapter, 'nope')).toEqual([]);
  });

  it('flags expired passport', () => {
    const dest = createDestination(adapter, {
      name: 'Paris',
      country_code: 'FR',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'France',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(120),
      end_date: isoDaysFromNow(130),
      status: 'upcoming',
    });
    createDocument(adapter, {
      type: 'passport',
      name: 'Primary Passport',
      expiry_date: isoDaysFromNow(-30),
    });
    const res = preTripReminders(adapter, trip.id);
    expect(
      res.some(
        (r) =>
          r.kind === 'passport' &&
          r.severity === 'critical' &&
          /expired/i.test(r.message),
      ),
    ).toBe(true);
  });

  it('flags missing visa for international destination', () => {
    const dest = createDestination(adapter, {
      name: 'Bangkok',
      country_code: 'TH',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'Thailand',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(100),
      end_date: isoDaysFromNow(110),
      status: 'upcoming',
    });
    const res = preTripReminders(adapter, trip.id);
    expect(res.some((r) => r.kind === 'visa')).toBe(true);
  });

  it('flags imminent trip (within 7 days)', () => {
    const dest = createDestination(adapter, {
      name: 'Paris',
      country_code: 'FR',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'Soon',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(3),
      end_date: isoDaysFromNow(10),
      status: 'upcoming',
    });
    const res = preTripReminders(adapter, trip.id);
    expect(res.some((r) => r.kind === 'other' && /3 day/.test(r.message))).toBe(
      true,
    );
  });

  it('flags vaccination reminder when trip is within 3 weeks', () => {
    const dest = createDestination(adapter, {
      name: 'Bali',
      country_code: 'ID',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'Bali trip',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(14),
      end_date: isoDaysFromNow(21),
      status: 'upcoming',
    });
    const res = preTripReminders(adapter, trip.id);
    expect(res.some((r) => r.kind === 'vaccination')).toBe(true);
  });

  it('flags missing flight booking for international trip', () => {
    const dest = createDestination(adapter, {
      name: 'Tokyo',
      country_code: 'JP',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'Japan',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(60),
      end_date: isoDaysFromNow(70),
      status: 'upcoming',
    });
    const res = preTripReminders(adapter, trip.id);
    expect(res.some((r) => r.kind === 'booking')).toBe(true);
  });

  it('does not flag missing flight when flight booking exists', () => {
    const dest = createDestination(adapter, {
      name: 'Tokyo',
      country_code: 'JP',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'Japan',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(60),
      end_date: isoDaysFromNow(70),
      status: 'upcoming',
    });
    createBooking(adapter, {
      trip_id: trip.id,
      type: 'flight',
      provider: 'ANA',
      start_ts: isoDaysFromNow(60),
    });
    const res = preTripReminders(adapter, trip.id);
    expect(res.some((r) => r.kind === 'booking')).toBe(false);
  });

  it('flags passport expiring within 6-month buffer after trip start', () => {
    const dest = createDestination(adapter, {
      name: 'Paris',
      country_code: 'FR',
      bucket_list: false,
    });
    const trip = createTrip(adapter, {
      name: 'France',
      destination_ids: [dest.id],
      start_date: isoDaysFromNow(60),
      end_date: isoDaysFromNow(70),
      status: 'upcoming',
    });
    // Passport expires in ~3 months - less than 6-month buffer from trip start.
    createDocument(adapter, {
      type: 'passport',
      name: 'Primary Passport',
      expiry_date: isoAddMonthsFromNow(3),
    });
    // Force updated_at refresh
    updateTrip(adapter, trip.id, {});
    const res = preTripReminders(adapter, trip.id);
    expect(
      res.some((r) => r.kind === 'passport' && r.severity === 'critical'),
    ).toBe(true);
  });
});
