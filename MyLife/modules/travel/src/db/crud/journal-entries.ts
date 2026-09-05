/**
 * Journal entry CRUD for MyTravel (v7 journal).
 *
 * Entries may reference a trip and/or a destination (both optional). Each
 * entry is pinned to an entry_date (YYYY-MM-DD). IDs use the `je_` prefix.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  JournalEntryInputSchema,
  JournalEntryUpdateSchema,
  type JournalEntryInput,
  type JournalEntryRow,
  type JournalEntryUpdate,
} from '../../models/schemas';

// ── ID generation ───────────────────────────────────────────────────

let jeIdCounter = 0;

function generateEntryId(): string {
  jeIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `je_${now}${rand}${jeIdCounter.toString(36)}`;
}

// ── Update column whitelist ─────────────────────────────────────────

const ENTRY_UPDATE_COLUMNS = new Set([
  'trip_id',
  'destination_id',
  'day_number',
  'entry_date',
  'title',
  'body_md',
  'mood',
  'weather',
  'location_label',
  'lat',
  'lng',
]);

// ── Filters ─────────────────────────────────────────────────────────

export interface ListJournalEntriesOptions {
  tripId?: string;
  destinationId?: string;
  year?: number;
  month?: number;
}

// ── CRUD ────────────────────────────────────────────────────────────

export function createJournalEntry(
  db: DatabaseAdapter,
  input: JournalEntryInput,
): JournalEntryRow {
  const parsed = JournalEntryInputSchema.parse(input);
  const id = generateEntryId();
  const now = new Date().toISOString();

  const row: JournalEntryRow = {
    id,
    trip_id: parsed.trip_id ?? null,
    destination_id: parsed.destination_id ?? null,
    day_number: parsed.day_number ?? null,
    entry_date: parsed.entry_date,
    title: parsed.title ?? null,
    body_md: parsed.body_md ?? '',
    mood: parsed.mood ?? null,
    weather: parsed.weather ?? null,
    location_label: parsed.location_label ?? null,
    lat: parsed.lat ?? null,
    lng: parsed.lng ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_journal_entries (
       id, trip_id, destination_id, day_number, entry_date, title, body_md,
       mood, weather, location_label, lat, lng, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.trip_id,
      row.destination_id,
      row.day_number,
      row.entry_date,
      row.title,
      row.body_md,
      row.mood,
      row.weather,
      row.location_label,
      row.lat,
      row.lng,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export function getJournalEntry(
  db: DatabaseAdapter,
  id: string,
): JournalEntryRow | null {
  const rows = db.query<JournalEntryRow>(
    `SELECT * FROM tv_journal_entries WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function listJournalEntries(
  db: DatabaseAdapter,
  opts: ListJournalEntriesOptions = {},
): JournalEntryRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.tripId !== undefined) {
    where.push('trip_id = ?');
    params.push(opts.tripId);
  }
  if (opts.destinationId !== undefined) {
    where.push('destination_id = ?');
    params.push(opts.destinationId);
  }
  if (opts.year !== undefined) {
    if (opts.month !== undefined) {
      const mm = opts.month.toString().padStart(2, '0');
      where.push('entry_date LIKE ?');
      params.push(`${opts.year}-${mm}-%`);
    } else {
      where.push('entry_date LIKE ?');
      params.push(`${opts.year}-%`);
    }
  } else if (opts.month !== undefined) {
    const mm = opts.month.toString().padStart(2, '0');
    where.push('substr(entry_date, 6, 2) = ?');
    params.push(mm);
  }

  const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
  return db.query<JournalEntryRow>(
    `SELECT * FROM tv_journal_entries${whereSql} ORDER BY entry_date DESC, created_at DESC`,
    params,
  );
}

export function updateJournalEntry(
  db: DatabaseAdapter,
  id: string,
  patch: JournalEntryUpdate,
): void {
  const parsed = JournalEntryUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!ENTRY_UPDATE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_journal_entries SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteJournalEntry(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_journal_entries WHERE id = ?`, [id]);
}

/**
 * Groups entries from a given year by YYYY-MM key, sorted by date DESC within
 * each bucket.
 */
export function listJournalEntriesByMonth(
  db: DatabaseAdapter,
  year: number,
): Record<string, JournalEntryRow[]> {
  const rows = listJournalEntries(db, { year });
  const grouped: Record<string, JournalEntryRow[]> = {};
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const key = row.entry_date.slice(0, 7);
    const bucket = grouped[key];
    if (bucket) {
      bucket.push(row);
    } else {
      grouped[key] = [row];
    }
  }
  return grouped;
}

/**
 * Returns the consecutive-day journaling streaks.
 * `current` is the streak ending today (0 if today or yesterday isn't written).
 * `longest` is the longest consecutive-day run observed over all entries.
 */
export function getJournalStreak(
  db: DatabaseAdapter,
): { current: number; longest: number } {
  const rows = db.query<{ entry_date: string }>(
    `SELECT DISTINCT entry_date FROM tv_journal_entries WHERE entry_date IS NOT NULL ORDER BY entry_date ASC`,
  );
  if (rows.length === 0) return { current: 0, longest: 0 };

  const dates: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const iso = rows[i]!.entry_date;
    const ts = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isNaN(ts)) dates.push(ts);
  }
  if (dates.length === 0) return { current: 0, longest: 0 };

  const DAY = 24 * 60 * 60 * 1000;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const diff = dates[i]! - dates[i - 1]!;
    if (diff === DAY) {
      run += 1;
      if (run > longest) longest = run;
    } else if (diff === 0) {
      // same day duplicate, ignore
    } else {
      run = 1;
    }
  }

  // Current streak anchored to today (UTC day).
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const lastDate = dates[dates.length - 1]!;
  let current = 0;
  if (lastDate === todayUtc || lastDate === todayUtc - DAY) {
    current = 1;
    for (let i = dates.length - 2; i >= 0; i -= 1) {
      const diff = dates[i + 1]! - dates[i]!;
      if (diff === DAY) {
        current += 1;
      } else if (diff === 0) {
        continue;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}
