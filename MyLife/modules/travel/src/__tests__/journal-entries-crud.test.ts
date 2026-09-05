import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip, deleteTrip } from '../db/crud/trips';
import { createDestination } from '../db/crud/destinations';
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getJournalStreak,
  listJournalEntries,
  listJournalEntriesByMonth,
  updateJournalEntry,
} from '../db/crud/journal-entries';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let tripId: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  const trip = createTrip(adapter, { name: 'Test Trip' });
  tripId = trip.id;
});

afterEach(() => {
  closeDb();
});

function isoDay(offsetDaysFromToday: number): string {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const d = new Date(todayUtc + offsetDaysFromToday * DAY);
  return d.toISOString().slice(0, 10);
}

// ── createJournalEntry / getJournalEntry ─────────────────────────────

describe('createJournalEntry', () => {
  it('returns a row with a je_ prefixed id and defaults', () => {
    const entry = createJournalEntry(adapter, {
      trip_id: tripId,
      entry_date: '2026-06-01',
    });
    expect(entry.id).toMatch(/^je_/);
    expect(entry.trip_id).toBe(tripId);
    expect(entry.destination_id).toBeNull();
    expect(entry.body_md).toBe('');
    expect(entry.title).toBeNull();
    expect(entry.mood).toBeNull();
    expect(entry.created_at).toBeTruthy();
    expect(entry.updated_at).toBeTruthy();
  });

  it('persists all optional fields', () => {
    const entry = createJournalEntry(adapter, {
      trip_id: tripId,
      entry_date: '2026-06-02',
      day_number: 2,
      title: 'Second day in Lisbon',
      body_md: '# Morning\n\nCoffee + pastel de nata.',
      mood: 5,
      weather: 'sunny',
      location_label: 'Lisbon',
      lat: 38.72,
      lng: -9.14,
    });
    const fetched = getJournalEntry(adapter, entry.id)!;
    expect(fetched.day_number).toBe(2);
    expect(fetched.title).toBe('Second day in Lisbon');
    expect(fetched.mood).toBe(5);
    expect(fetched.weather).toBe('sunny');
    expect(fetched.lat).toBeCloseTo(38.72);
  });

  it('rejects missing entry_date', () => {
    expect(() =>
      createJournalEntry(adapter, { trip_id: tripId } as unknown as {
        entry_date: string;
      }),
    ).toThrow();
  });

  it('rejects mood outside 1-5', () => {
    expect(() =>
      createJournalEntry(adapter, {
        trip_id: tripId,
        entry_date: '2026-06-01',
        mood: 7 as unknown as 5,
      }),
    ).toThrow();
  });

  it('allows orphan entries (no trip, no destination)', () => {
    const entry = createJournalEntry(adapter, { entry_date: '2026-06-01' });
    expect(entry.trip_id).toBeNull();
    expect(entry.destination_id).toBeNull();
  });
});

// ── getJournalEntry ──────────────────────────────────────────────────

describe('getJournalEntry', () => {
  it('returns null for unknown id', () => {
    expect(getJournalEntry(adapter, 'je_missing')).toBeNull();
  });
});

// ── listJournalEntries ──────────────────────────────────────────────

describe('listJournalEntries', () => {
  it('orders by entry_date DESC', () => {
    createJournalEntry(adapter, { entry_date: '2026-06-01', title: 'A' });
    createJournalEntry(adapter, { entry_date: '2026-07-01', title: 'B' });
    createJournalEntry(adapter, { entry_date: '2026-05-01', title: 'C' });
    const rows = listJournalEntries(adapter);
    expect(rows.map((r) => r.title)).toEqual(['B', 'A', 'C']);
  });

  it('filters by tripId', () => {
    const other = createTrip(adapter, { name: 'Other' });
    createJournalEntry(adapter, {
      trip_id: tripId,
      entry_date: '2026-06-01',
      title: 'mine',
    });
    createJournalEntry(adapter, {
      trip_id: other.id,
      entry_date: '2026-06-01',
      title: 'theirs',
    });
    const mine = listJournalEntries(adapter, { tripId });
    expect(mine).toHaveLength(1);
    expect(mine[0]!.title).toBe('mine');
  });

  it('filters by destinationId', () => {
    const dest = createDestination(adapter, { name: 'Paris', bucket_list: false });
    createJournalEntry(adapter, {
      destination_id: dest.id,
      entry_date: '2026-06-01',
      title: 'paris',
    });
    createJournalEntry(adapter, {
      entry_date: '2026-06-01',
      title: 'orphan',
    });
    const rows = listJournalEntries(adapter, { destinationId: dest.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('paris');
  });

  it('filters by year', () => {
    createJournalEntry(adapter, { entry_date: '2025-12-31', title: 'old' });
    createJournalEntry(adapter, { entry_date: '2026-01-01', title: 'new' });
    const rows = listJournalEntries(adapter, { year: 2026 });
    expect(rows.map((r) => r.title)).toEqual(['new']);
  });

  it('filters by year + month', () => {
    createJournalEntry(adapter, { entry_date: '2026-05-15', title: 'may' });
    createJournalEntry(adapter, { entry_date: '2026-06-15', title: 'june' });
    createJournalEntry(adapter, { entry_date: '2026-07-15', title: 'july' });
    const rows = listJournalEntries(adapter, { year: 2026, month: 6 });
    expect(rows.map((r) => r.title)).toEqual(['june']);
  });
});

// ── updateJournalEntry ──────────────────────────────────────────────

describe('updateJournalEntry', () => {
  it('updates allowed fields and bumps updated_at', async () => {
    const entry = createJournalEntry(adapter, {
      entry_date: '2026-06-01',
      title: 'old',
    });
    await new Promise((r) => setTimeout(r, 5));
    updateJournalEntry(adapter, entry.id, {
      title: 'new',
      mood: 4,
      body_md: '**bold**',
    });
    const fetched = getJournalEntry(adapter, entry.id)!;
    expect(fetched.title).toBe('new');
    expect(fetched.mood).toBe(4);
    expect(fetched.body_md).toBe('**bold**');
    expect(fetched.updated_at).not.toBe(entry.updated_at);
  });

  it('is a no-op when patch has no fields', () => {
    const entry = createJournalEntry(adapter, { entry_date: '2026-06-01' });
    updateJournalEntry(adapter, entry.id, {});
    const fetched = getJournalEntry(adapter, entry.id)!;
    expect(fetched.updated_at).toBe(entry.updated_at);
  });

  it('rejects mood outside 1-5 via schema', () => {
    const entry = createJournalEntry(adapter, { entry_date: '2026-06-01' });
    expect(() =>
      updateJournalEntry(adapter, entry.id, {
        mood: 12 as unknown as 5,
      }),
    ).toThrow();
  });
});

// ── deleteJournalEntry ──────────────────────────────────────────────

describe('deleteJournalEntry', () => {
  it('removes the row', () => {
    const entry = createJournalEntry(adapter, { entry_date: '2026-06-01' });
    deleteJournalEntry(adapter, entry.id);
    expect(getJournalEntry(adapter, entry.id)).toBeNull();
  });
});

// ── FK cascade-set-null ─────────────────────────────────────────────

describe('FK behavior', () => {
  it('sets trip_id to NULL when the trip is deleted (ON DELETE SET NULL)', () => {
    const entry = createJournalEntry(adapter, {
      trip_id: tripId,
      entry_date: '2026-06-01',
    });
    deleteTrip(adapter, tripId);
    const fetched = getJournalEntry(adapter, entry.id)!;
    expect(fetched).not.toBeNull();
    expect(fetched.trip_id).toBeNull();
  });
});

// ── listJournalEntriesByMonth ───────────────────────────────────────

describe('listJournalEntriesByMonth', () => {
  it('groups entries by YYYY-MM', () => {
    createJournalEntry(adapter, { entry_date: '2026-05-15', title: 'may1' });
    createJournalEntry(adapter, { entry_date: '2026-05-20', title: 'may2' });
    createJournalEntry(adapter, { entry_date: '2026-06-01', title: 'june' });
    createJournalEntry(adapter, { entry_date: '2025-06-01', title: 'prior' });

    const grouped = listJournalEntriesByMonth(adapter, 2026);
    expect(Object.keys(grouped).sort()).toEqual(['2026-05', '2026-06']);
    expect(grouped['2026-05']!.map((r) => r.title)).toEqual(['may2', 'may1']);
    expect(grouped['2026-06']!.map((r) => r.title)).toEqual(['june']);
  });

  it('returns an empty object for a year with no entries', () => {
    const grouped = listJournalEntriesByMonth(adapter, 2019);
    expect(grouped).toEqual({});
  });
});

// ── getJournalStreak ────────────────────────────────────────────────

describe('getJournalStreak', () => {
  it('returns zero for an empty journal', () => {
    expect(getJournalStreak(adapter)).toEqual({ current: 0, longest: 0 });
  });

  it('counts 5 consecutive days ending today (current=5, longest=5)', () => {
    for (let i = 4; i >= 0; i -= 1) {
      createJournalEntry(adapter, { entry_date: isoDay(-i) });
    }
    expect(getJournalStreak(adapter)).toEqual({ current: 5, longest: 5 });
  });

  it('resets current to 0 when the latest entry is before yesterday; longest reflects best past run', () => {
    // 3-day streak ending 5 days ago, then nothing.
    createJournalEntry(adapter, { entry_date: isoDay(-7) });
    createJournalEntry(adapter, { entry_date: isoDay(-6) });
    createJournalEntry(adapter, { entry_date: isoDay(-5) });
    expect(getJournalStreak(adapter)).toEqual({ current: 0, longest: 3 });
  });

  it('splits two separate runs and picks the longer as longest', () => {
    createJournalEntry(adapter, { entry_date: isoDay(-10) });
    createJournalEntry(adapter, { entry_date: isoDay(-9) });
    createJournalEntry(adapter, { entry_date: isoDay(-8) });
    createJournalEntry(adapter, { entry_date: isoDay(-7) });
    createJournalEntry(adapter, { entry_date: isoDay(-3) });
    createJournalEntry(adapter, { entry_date: isoDay(-2) });
    const { longest } = getJournalStreak(adapter);
    expect(longest).toBe(4);
  });

  it('dedupes multiple entries on the same day', () => {
    createJournalEntry(adapter, { entry_date: isoDay(-1) });
    createJournalEntry(adapter, { entry_date: isoDay(-1) });
    createJournalEntry(adapter, { entry_date: isoDay(0) });
    expect(getJournalStreak(adapter)).toEqual({ current: 2, longest: 2 });
  });
});
