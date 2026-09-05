/**
 * MyTravel export engine.
 *
 * Pure, read-only serializers over v1-v4 tables:
 *   tv_trips, tv_itinerary_days, tv_activities, tv_destinations, tv_bookings
 *
 * No writes, no migrations, no network. v5+ tables (checklists, currencies,
 * emergency contacts, packing) are intentionally NOT read here so this engine
 * functions before those migrations land.
 *
 * Output formats:
 *   - JSON: hydrated trip document (exportTripToJson, exportAllTripsToJson)
 *   - CSV: RFC 4180 for itinerary, bookings, destinations
 *   - iCal: RFC 5545 VCALENDAR with one VEVENT per booking + activity
 *
 * Deterministic output: same DB state produces byte-identical strings
 * (except for the `exportedAt` / `DTSTAMP` fields which reflect "now").
 */

import type { DatabaseAdapter } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import type {
  ActivityRow,
  BookingRow,
  DestinationRow,
  ItineraryDayRow,
  TripRow,
} from '../models/schemas';

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

export interface TripExportDocument {
  exportedAt: string;
  schemaVersion: number;
  trip: TripRow;
  destinations: DestinationRow[];
  days: Array<ItineraryDayRow & { activities: ActivityRow[] }>;
  bookings: BookingRow[];
}

const SCHEMA_VERSION: number = TRAVEL_MODULE.schemaVersion ?? 1;

export function exportTripToJson(
  db: DatabaseAdapter,
  tripId: string,
): string {
  const doc = buildTripDocument(db, tripId);
  if (!doc) {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      trip: null,
      destinations: [],
      days: [],
      bookings: [],
    });
  }
  return JSON.stringify(doc);
}

export function exportAllTripsToJson(db: DatabaseAdapter): string {
  const trips = db.query<TripRow>(
    `SELECT * FROM tv_trips ORDER BY COALESCE(start_date, '') ASC, id ASC`,
  );
  const docs: TripExportDocument[] = [];
  for (const t of trips) {
    const doc = buildTripDocument(db, t.id);
    if (doc) docs.push(doc);
  }
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    trips: docs,
  });
}

function buildTripDocument(
  db: DatabaseAdapter,
  tripId: string,
): TripExportDocument | null {
  const tripRows = db.query<TripRow>(
    `SELECT * FROM tv_trips WHERE id = ?`,
    [tripId],
  );
  const trip = tripRows[0];
  if (!trip) return null;

  const days = db.query<ItineraryDayRow>(
    `SELECT * FROM tv_itinerary_days
      WHERE trip_id = ?
      ORDER BY day_number ASC, COALESCE(date, '') ASC, id ASC`,
    [tripId],
  );

  const hydratedDays = days.map((d) => ({
    ...d,
    activities: db.query<ActivityRow>(
      `SELECT * FROM tv_activities
        WHERE day_id = ?
        ORDER BY COALESCE(time, '99:99') ASC, created_at ASC, id ASC`,
      [d.id],
    ),
  }));

  const bookings = safeQuery<BookingRow>(
    db,
    `SELECT * FROM tv_bookings
      WHERE trip_id = ?
      ORDER BY start_ts ASC, id ASC`,
    [tripId],
  );

  const destinations = collectDestinationsForTrip(db, trip);

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    trip,
    destinations,
    days: hydratedDays,
    bookings,
  };
}

function collectDestinationsForTrip(
  db: DatabaseAdapter,
  trip: TripRow,
): DestinationRow[] {
  const ids = parseIdArray(trip.destination_ids);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.query<DestinationRow>(
    `SELECT * FROM tv_destinations
      WHERE id IN (${placeholders})
      ORDER BY name ASC, id ASC`,
    ids,
  );
}

function parseIdArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// CSV export (RFC 4180)
// ---------------------------------------------------------------------------

export function exportTripToCsv(
  db: DatabaseAdapter,
  tripId: string,
  kind: 'itinerary' | 'bookings',
): string {
  if (kind === 'itinerary') return buildItineraryCsv(db, tripId);
  return buildBookingsCsv(db, tripId);
}

export function exportDestinationsToCsv(db: DatabaseAdapter): string {
  const rows = db.query<DestinationRow>(
    `SELECT * FROM tv_destinations ORDER BY name ASC, id ASC`,
  );
  const header = [
    'id',
    'name',
    'country_code',
    'region',
    'city',
    'lat',
    'lng',
    'type',
    'notes',
    'first_visited',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      toCsvRow([
        r.id,
        r.name,
        r.country_code ?? '',
        r.region ?? '',
        // The current schema has no dedicated "city" column; surface `country`
        // as a best-effort population field so the CSV remains useful.
        r.country ?? '',
        r.lat ?? '',
        r.lng ?? '',
        // No "type" column in v1 destinations; emit bucket_list vs visited.
        r.bucket_list ? 'bucket_list' : r.visit_count > 0 ? 'visited' : '',
        r.notes_md ?? '',
        r.first_visited ?? '',
      ]),
    );
  }
  return lines.join('\r\n');
}

function buildItineraryCsv(db: DatabaseAdapter, tripId: string): string {
  const tripRows = db.query<TripRow>(
    `SELECT * FROM tv_trips WHERE id = ?`,
    [tripId],
  );
  const trip = tripRows[0];
  const tripName = trip?.name ?? '';

  const header = [
    'trip_id',
    'trip_name',
    'day_number',
    'day_date',
    'activity_type',
    'activity_title',
    'activity_location',
    'start_time',
    'end_time',
    'cost_cents',
    'notes',
  ];
  const lines = [header.join(',')];
  if (!trip) return lines.join('\r\n');

  const days = db.query<ItineraryDayRow>(
    `SELECT * FROM tv_itinerary_days
      WHERE trip_id = ?
      ORDER BY day_number ASC, COALESCE(date, '') ASC, id ASC`,
    [tripId],
  );

  for (const d of days) {
    const activities = db.query<ActivityRow>(
      `SELECT * FROM tv_activities
        WHERE day_id = ?
        ORDER BY COALESCE(time, '99:99') ASC, created_at ASC, id ASC`,
      [d.id],
    );
    if (activities.length === 0) {
      // Emit a day-level row so empty days still appear in the export.
      lines.push(
        toCsvRow([
          tripId,
          tripName,
          d.day_number,
          d.date ?? '',
          '',
          '',
          d.location ?? '',
          '',
          '',
          '',
          d.summary_md ?? '',
        ]),
      );
      continue;
    }
    for (const a of activities) {
      lines.push(
        toCsvRow([
          tripId,
          tripName,
          d.day_number,
          d.date ?? '',
          a.type ?? '',
          a.title,
          a.location ?? '',
          a.time ?? '',
          a.end_time ?? '',
          a.cost_cents ?? '',
          a.notes_md ?? '',
        ]),
      );
    }
  }
  return lines.join('\r\n');
}

function buildBookingsCsv(db: DatabaseAdapter, tripId: string): string {
  const tripRows = db.query<TripRow>(
    `SELECT * FROM tv_trips WHERE id = ?`,
    [tripId],
  );
  const trip = tripRows[0];
  const tripName = trip?.name ?? '';

  const header = [
    'trip_id',
    'trip_name',
    'type',
    'provider',
    'confirmation_code',
    'start_ts',
    'end_ts',
    'location',
    'cost_cents',
    'currency',
    'notes',
  ];
  const lines = [header.join(',')];

  const bookings = safeQuery<BookingRow>(
    db,
    `SELECT * FROM tv_bookings
      WHERE trip_id = ?
      ORDER BY start_ts ASC, id ASC`,
    [tripId],
  );

  for (const b of bookings) {
    lines.push(
      toCsvRow([
        tripId,
        tripName,
        b.type,
        b.provider,
        b.confirmation_code ?? '',
        b.start_ts,
        b.end_ts ?? '',
        b.location ?? '',
        b.cost_cents ?? '',
        b.currency ?? '',
        b.notes ?? '',
      ]),
    );
  }
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// iCal export (RFC 5545)
// ---------------------------------------------------------------------------

export function exportTripToIcal(
  db: DatabaseAdapter,
  tripId: string,
): string {
  const now = formatIcalDateTimeUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyLife//Travel//EN',
    'CALSCALE:GREGORIAN',
  ];

  const bookings = safeQuery<BookingRow>(
    db,
    `SELECT * FROM tv_bookings
      WHERE trip_id = ?
      ORDER BY start_ts ASC, id ASC`,
    [tripId],
  );
  for (const b of bookings) {
    const start = parseToUtcDate(b.start_ts);
    if (!start) continue;
    const end = b.end_ts
      ? parseToUtcDate(b.end_ts) ?? addHours(start, 1)
      : addHours(start, 1);
    lines.push(
      ...buildVevent({
        uid: `booking-${b.id}@mylife.travel`,
        dtstamp: now,
        dtstart: formatIcalDateTimeUtc(start),
        dtend: formatIcalDateTimeUtc(end),
        summary: `${capitalize(b.type)}: ${b.provider}`,
        location: b.location ?? '',
        description: [b.confirmation_code, b.notes]
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .join(' -- '),
      }),
    );
  }

  const days = db.query<ItineraryDayRow>(
    `SELECT * FROM tv_itinerary_days
      WHERE trip_id = ?
      ORDER BY day_number ASC, COALESCE(date, '') ASC, id ASC`,
    [tripId],
  );
  for (const d of days) {
    if (!d.date) continue;
    const activities = db.query<ActivityRow>(
      `SELECT * FROM tv_activities
        WHERE day_id = ?
        ORDER BY COALESCE(time, '99:99') ASC, created_at ASC, id ASC`,
      [d.id],
    );
    for (const a of activities) {
      if (!a.time) continue;
      const start = combineDateAndTime(d.date, a.time);
      if (!start) continue;
      const end = a.end_time
        ? combineDateAndTime(d.date, a.end_time) ?? addHours(start, 1)
        : addHours(start, 1);
      lines.push(
        ...buildVevent({
          uid: `activity-${a.id}@mylife.travel`,
          dtstamp: now,
          dtstart: formatIcalDateTimeUtc(start),
          dtend: formatIcalDateTimeUtc(end),
          summary: a.title,
          location: a.location ?? '',
          description: a.notes_md ?? '',
        }),
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcalLine).join('\r\n');
}

interface VeventParts {
  uid: string;
  dtstamp: string;
  dtstart: string;
  dtend: string;
  summary: string;
  location: string;
  description: string;
}

function buildVevent(parts: VeventParts): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${parts.uid}`,
    `DTSTAMP:${parts.dtstamp}`,
    `DTSTART:${parts.dtstart}`,
    `DTEND:${parts.dtend}`,
    `SUMMARY:${escapeIcalText(parts.summary)}`,
    `LOCATION:${escapeIcalText(parts.location)}`,
    `DESCRIPTION:${escapeIcalText(parts.description)}`,
    'END:VEVENT',
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * RFC 4180: wrap fields containing comma, quote, CR or LF in double quotes and
 * double any internal quotes. Numbers are stringified as-is.
 */
function toCsvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvCell).join(',');
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? value.toString() : value;
  if (/[",\r\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

/**
 * RFC 5545 TEXT escape: backslash, comma, semicolon, newlines.
 * Order matters: escape backslash first.
 */
function escapeIcalText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n');
}

/** Fold a logical iCal line to <=75 octets per RFC 5545 section 3.1. */
function foldIcalLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const pieces: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const end = Math.min(offset + (first ? 75 : 74), bytes.length);
    // Decode safely without splitting a multi-byte char.
    let sliceEnd = end;
    while (sliceEnd > offset) {
      try {
        const chunk = new TextDecoder('utf-8', { fatal: true }).decode(
          bytes.slice(offset, sliceEnd),
        );
        pieces.push(first ? chunk : ` ${chunk}`);
        offset = sliceEnd;
        first = false;
        break;
      } catch {
        sliceEnd -= 1;
      }
    }
    if (sliceEnd === offset) {
      // Safety: advance one byte to avoid infinite loop.
      offset += 1;
    }
  }
  return pieces.join('\r\n');
}

function formatIcalDateTimeUtc(date: Date): string {
  const iso = date.toISOString(); // 2026-06-01T10:00:00.000Z
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(
    11,
    13,
  )}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

function parseToUtcDate(ts: string): Date | null {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function combineDateAndTime(
  dateIso: string,
  time: string,
): Date | null {
  // Accept 'HH:MM' or 'HH:MM:SS'. dateIso may be 'YYYY-MM-DD' or full ISO.
  const datePart = dateIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const tMatch = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!tMatch) return null;
  const hh = tMatch[1];
  const mm = tMatch[2];
  const ss = tMatch[3] ?? '00';
  const d = new Date(`${datePart}T${hh}:${mm}:${ss}.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Query wrapper that returns [] when a table is missing. Bookings exist at v4;
 * callers may run this engine on a v1-v3 DB during incremental scaffolding.
 */
function safeQuery<T>(
  db: DatabaseAdapter,
  sql: string,
  params?: unknown[],
): T[] {
  try {
    return db.query<T>(sql, params);
  } catch {
    return [];
  }
}
