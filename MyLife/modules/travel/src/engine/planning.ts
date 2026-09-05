/**
 * MyTravel planning + recommendations engine.
 *
 * Pure functions over existing tables (`tv_trips`, `tv_destinations`,
 * `tv_bookings`, `tv_documents`) plus small in-memory lookup tables.
 * No migrations, no writes, no network. Safe against missing tables: each
 * function is wrapped in try/catch and returns a safe empty value on failure.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DestinationRow, DocumentRow, TripRow } from '../models/schemas';
import { COUNTRIES, getCountryByCode } from './geo-data';
import { checkExpiry } from './expiry-checker';

// ── Public types ────────────────────────────────────────────────────

export interface TripLengthSuggestion {
  minDays: number;
  maxDays: number;
  typical: number;
  source: 'history' | 'default';
}

export interface TimeToVisit {
  months: number[];
  reason: string;
}

export interface BudgetEstimate {
  perDayCents: number;
  totalCents: number;
  currency: string;
  sampleSize: number;
}

export type ReminderSeverity = 'info' | 'warning' | 'critical';
export type ReminderKind =
  | 'passport'
  | 'visa'
  | 'vaccination'
  | 'booking'
  | 'other';

export interface PreTripReminder {
  severity: ReminderSeverity;
  message: string;
  kind: ReminderKind;
}

// ── Default trip length presets ─────────────────────────────────────

const TRIP_LENGTH_DEFAULTS = {
  weekend: { minDays: 2, maxDays: 4, typical: 3 },
  short: { minDays: 4, maxDays: 6, typical: 5 },
  medium: { minDays: 7, maxDays: 14, typical: 10 },
  long: { minDays: 14, maxDays: 21, typical: 14 },
} as const;

const DEFAULT_TRIP_LENGTH: TripLengthSuggestion = {
  ...TRIP_LENGTH_DEFAULTS.medium,
  source: 'default',
};

// ── Best-time-to-visit lookup (country code -> months + reason) ─────

interface TimeWindow {
  months: number[];
  reason: string;
}

const REGION_TIME_WINDOWS: Record<string, TimeWindow> = {
  caribbean: {
    months: [12, 1, 2, 3, 4],
    reason: 'Dry season (Dec-Apr); avoid hurricane months Jun-Nov',
  },
  se_asia: {
    months: [11, 12, 1, 2],
    reason: 'Cool, dry season across Southeast Asia (Nov-Feb)',
  },
  europe: {
    months: [5, 6, 7, 8, 9],
    reason: 'Warm weather and long daylight hours (May-Sep)',
  },
  japan: {
    months: [3, 4, 5, 10, 11],
    reason: 'Cherry blossoms (Mar-May) and fall foliage (Oct-Nov)',
  },
  tropical_monsoon: {
    months: [11, 12, 1, 2, 3, 4],
    reason: 'Dry season; avoid the summer monsoon',
  },
  southern_hemisphere_summer: {
    months: [11, 12, 1, 2, 3],
    reason: 'Southern hemisphere summer (Nov-Mar)',
  },
  shoulder_temperate: {
    months: [4, 5, 9, 10],
    reason: 'Mild shoulder seasons avoid peak crowds and heat',
  },
  year_round: {
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    reason: 'Year-round destination',
  },
};

const CARIBBEAN_CODES = new Set([
  'AG', 'AI', 'AW', 'BB', 'BS', 'BL', 'BQ', 'CU', 'CW', 'DM',
  'DO', 'GD', 'GP', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ',
  'MS', 'PR', 'SX', 'TC', 'TT', 'VC', 'VG', 'VI',
]);

const SE_ASIA_CODES = new Set([
  'BN', 'KH', 'ID', 'LA', 'MY', 'MM', 'PH', 'SG', 'TH', 'VN', 'TL',
]);

const EUROPE_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
  'IS', 'LI', 'MC', 'SM', 'VA', 'AD', 'RS', 'ME', 'MK', 'BA',
  'AL', 'XK',
]);

const TROPICAL_MONSOON_CODES = new Set([
  'IN', 'LK', 'BD', 'NP', 'BT', 'MV',
]);

const SOUTHERN_SUMMER_CODES = new Set([
  'AU', 'NZ', 'AR', 'CL', 'UY', 'ZA', 'NA', 'BW',
]);

const SHOULDER_TEMPERATE_CODES = new Set([
  'MA', 'TN', 'DZ', 'EG', 'JO', 'IL', 'TR', 'GR', 'IT', 'ES', 'PT',
]);

export function bestTimeToVisit(
  countryCode: string | null | undefined,
): TimeToVisit {
  if (!countryCode) {
    return { ...REGION_TIME_WINDOWS.year_round };
  }
  const code = countryCode.toUpperCase();
  if (code === 'JP') return { ...REGION_TIME_WINDOWS.japan };
  if (CARIBBEAN_CODES.has(code)) return { ...REGION_TIME_WINDOWS.caribbean };
  if (SE_ASIA_CODES.has(code)) return { ...REGION_TIME_WINDOWS.se_asia };
  if (TROPICAL_MONSOON_CODES.has(code)) {
    return { ...REGION_TIME_WINDOWS.tropical_monsoon };
  }
  if (SOUTHERN_SUMMER_CODES.has(code)) {
    return { ...REGION_TIME_WINDOWS.southern_hemisphere_summer };
  }
  if (EUROPE_CODES.has(code)) return { ...REGION_TIME_WINDOWS.europe };
  if (SHOULDER_TEMPERATE_CODES.has(code)) {
    return { ...REGION_TIME_WINDOWS.shoulder_temperate };
  }
  return { ...REGION_TIME_WINDOWS.year_round };
}

// ── suggestTripLength ───────────────────────────────────────────────

export function suggestTripLength(
  db: DatabaseAdapter,
  destinationId: string,
): TripLengthSuggestion {
  try {
    const destRows = db.query<DestinationRow>(
      `SELECT * FROM tv_destinations WHERE id = ?`,
      [destinationId],
    );
    const dest = destRows[0];
    if (!dest) return DEFAULT_TRIP_LENGTH;

    const country = dest.country_code;
    const region = dest.region;

    // Collect historic trip durations where the trip destinations include
    // a destination in the same country (or region, when country is absent).
    const matches: number[] = [];
    const trips = db.query<TripRow>(
      `SELECT * FROM tv_trips WHERE start_date IS NOT NULL AND end_date IS NOT NULL`,
    );
    for (const trip of trips) {
      const destIds = parseIdArray(trip.destination_ids);
      if (destIds.length === 0) continue;
      const placeholders = destIds.map(() => '?').join(',');
      const dests = db.query<DestinationRow>(
        `SELECT * FROM tv_destinations WHERE id IN (${placeholders})`,
        destIds,
      );
      const sameCountry = country
        ? dests.some((d) => d.country_code === country)
        : false;
      const sameRegion = region
        ? dests.some((d) => d.region === region)
        : false;
      if (!sameCountry && !sameRegion) continue;
      const days = inclusiveDayCount(trip.start_date!, trip.end_date!);
      if (days > 0) matches.push(days);
    }

    if (matches.length === 0) return DEFAULT_TRIP_LENGTH;

    matches.sort((a, b) => a - b);
    const minDays = matches[0];
    const maxDays = matches[matches.length - 1];
    const mean = matches.reduce((s, n) => s + n, 0) / matches.length;
    const typical = Math.max(1, Math.round(mean));
    return { minDays, maxDays, typical, source: 'history' };
  } catch {
    return DEFAULT_TRIP_LENGTH;
  }
}

// ── similarDestinations ─────────────────────────────────────────────

export function similarDestinations(
  db: DatabaseAdapter,
  destinationId: string,
  limit = 10,
): DestinationRow[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];
  try {
    const rows = db.query<DestinationRow>(
      `SELECT * FROM tv_destinations WHERE id = ?`,
      [destinationId],
    );
    const source = rows[0];
    if (!source) return [];

    const results: DestinationRow[] = [];
    const seen = new Set<string>([source.id]);

    if (source.country_code) {
      const sameCountry = db.query<DestinationRow>(
        `SELECT * FROM tv_destinations
          WHERE country_code = ? AND id != ?
          ORDER BY name ASC
          LIMIT ?`,
        [source.country_code, source.id, safeLimit],
      );
      for (const d of sameCountry) {
        if (seen.has(d.id)) continue;
        results.push(d);
        seen.add(d.id);
      }
    }

    if (results.length < safeLimit) {
      const country = source.country_code
        ? getCountryByCode(source.country_code)
        : undefined;
      const regionLabel = country?.region ?? null;
      if (regionLabel) {
        const codes = getCountryCodesForRegionLabel(regionLabel);
        if (codes.length > 0) {
          const placeholders = codes.map(() => '?').join(',');
          const sameRegion = db.query<DestinationRow>(
            `SELECT * FROM tv_destinations
              WHERE country_code IN (${placeholders})
              ORDER BY name ASC`,
            codes,
          );
          for (const d of sameRegion) {
            if (seen.has(d.id)) continue;
            results.push(d);
            seen.add(d.id);
            if (results.length >= safeLimit) break;
          }
        }
      }
    }

    return results.slice(0, safeLimit);
  } catch {
    return [];
  }
}

// Cache for country-code -> region label (from COUNTRIES lookup).
let REGION_LABEL_TO_CODES: Map<string, string[]> | null = null;
function getCountryCodesForRegionLabel(label: string): string[] {
  if (!REGION_LABEL_TO_CODES) {
    const map = new Map<string, string[]>();
    for (const c of COUNTRIES) {
      const arr = map.get(c.region) ?? [];
      arr.push(c.code);
      map.set(c.region, arr);
    }
    REGION_LABEL_TO_CODES = map;
  }
  return REGION_LABEL_TO_CODES.get(label) ?? [];
}

// ── recommendActivitiesForTrip ──────────────────────────────────────

const GENERIC_ACTIVITIES = [
  'Walking tour of the historic center',
  'Sample local cuisine at a well-reviewed restaurant',
  'Visit a museum or cultural landmark',
  'Day trip to a nearby natural attraction',
  'Sunset viewpoint or scenic overlook',
  'Local market or artisan shopping',
  'Evening stroll along a waterfront or main boulevard',
];

const BEACH_ACTIVITIES = [
  'Beach day with swimming and snorkeling',
  'Catamaran or sailing excursion',
  'Sunset cruise',
  'Island-hopping tour',
];

const MOUNTAIN_ACTIVITIES = [
  'Day hike on a marked trail',
  'Cable car or gondola to a scenic peak',
  'Alpine lake visit',
];

const URBAN_ACTIVITIES = [
  'Architecture walking tour',
  'Rooftop bar or observation deck',
  'Neighborhood food tour',
];

const BUSINESS_ACTIVITIES = [
  'Reserve a quiet cafe or coworking space for focused work',
  'Airport lounge access check for layovers',
];

const BEACH_COUNTRIES = new Set([
  ...CARIBBEAN_CODES,
  'MX', 'CR', 'BZ', 'PA', 'ID', 'TH', 'PH', 'VN', 'MV', 'FJ', 'GR',
  'IT', 'ES', 'PT', 'HR', 'TR', 'MU', 'SC',
]);

const MOUNTAIN_COUNTRIES = new Set([
  'CH', 'AT', 'NP', 'BT', 'PE', 'CL', 'AR', 'NZ', 'CA', 'NO', 'IS',
]);

const MAJOR_URBAN_COUNTRIES = new Set([
  'JP', 'KR', 'SG', 'GB', 'FR', 'DE', 'NL', 'US', 'CN', 'HK', 'AE',
]);

export function recommendActivitiesForTrip(
  db: DatabaseAdapter,
  tripId: string,
): string[] {
  try {
    const tripRows = db.query<TripRow>(
      `SELECT * FROM tv_trips WHERE id = ?`,
      [tripId],
    );
    const trip = tripRows[0];
    if (!trip) return GENERIC_ACTIVITIES.slice(0, 5);

    const destIds = parseIdArray(trip.destination_ids);
    let countryCode: string | null = null;
    if (destIds.length > 0) {
      const placeholders = destIds.map(() => '?').join(',');
      const dests = db.query<DestinationRow>(
        `SELECT * FROM tv_destinations WHERE id IN (${placeholders})`,
        destIds,
      );
      countryCode = dests.find((d) => d.country_code)?.country_code ?? null;
    }

    const out: string[] = [...GENERIC_ACTIVITIES.slice(0, 4)];
    if (countryCode && BEACH_COUNTRIES.has(countryCode)) {
      out.push(...BEACH_ACTIVITIES.slice(0, 2));
    }
    if (countryCode && MOUNTAIN_COUNTRIES.has(countryCode)) {
      out.push(...MOUNTAIN_ACTIVITIES.slice(0, 2));
    }
    if (countryCode && MAJOR_URBAN_COUNTRIES.has(countryCode)) {
      out.push(...URBAN_ACTIVITIES.slice(0, 2));
    }
    if (trip.trip_type === 'business') {
      out.push(...BUSINESS_ACTIVITIES);
    }
    // De-dupe while preserving order; cap at 10.
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const s of out) {
      if (seen.has(s)) continue;
      seen.add(s);
      deduped.push(s);
      if (deduped.length >= 10) break;
    }
    return deduped;
  } catch {
    return GENERIC_ACTIVITIES.slice(0, 5);
  }
}

// ── budgetEstimate ──────────────────────────────────────────────────

interface PastTripSpend {
  days: number;
  cents: number;
  currency: string;
}

export function budgetEstimate(
  db: DatabaseAdapter,
  tripId: string,
): BudgetEstimate {
  const empty: BudgetEstimate = {
    perDayCents: 0,
    totalCents: 0,
    currency: 'USD',
    sampleSize: 0,
  };
  try {
    const tripRows = db.query<TripRow>(
      `SELECT * FROM tv_trips WHERE id = ?`,
      [tripId],
    );
    const trip = tripRows[0];
    if (!trip) return empty;

    const destIds = parseIdArray(trip.destination_ids);
    let targetCountry: string | null = null;
    if (destIds.length > 0) {
      const placeholders = destIds.map(() => '?').join(',');
      const dests = db.query<DestinationRow>(
        `SELECT * FROM tv_destinations WHERE id IN (${placeholders})`,
        destIds,
      );
      targetCountry = dests.find((d) => d.country_code)?.country_code ?? null;
    }
    if (!targetCountry) return empty;

    // Find past trips with same country and both dates + at least one booking cost.
    const pastTrips = db.query<TripRow>(
      `SELECT * FROM tv_trips
        WHERE id != ?
          AND start_date IS NOT NULL
          AND end_date IS NOT NULL`,
      [tripId],
    );

    const samples: PastTripSpend[] = [];
    for (const t of pastTrips) {
      const ids = parseIdArray(t.destination_ids);
      if (ids.length === 0) continue;
      const placeholders = ids.map(() => '?').join(',');
      const tDests = db.query<DestinationRow>(
        `SELECT * FROM tv_destinations WHERE id IN (${placeholders})`,
        ids,
      );
      if (!tDests.some((d) => d.country_code === targetCountry)) continue;

      const days = inclusiveDayCount(t.start_date!, t.end_date!);
      if (days <= 0) continue;

      let bookings: Array<{ cost_cents: number | null; currency: string | null }>;
      try {
        bookings = db.query<{ cost_cents: number | null; currency: string | null }>(
          `SELECT cost_cents, currency FROM tv_bookings
            WHERE trip_id = ? AND cost_cents IS NOT NULL`,
          [t.id],
        );
      } catch {
        bookings = [];
      }
      if (bookings.length === 0) continue;

      // Pick the dominant currency by count.
      const byCurrency = new Map<string, number>();
      for (const b of bookings) {
        const key = b.currency ?? 'USD';
        byCurrency.set(key, (byCurrency.get(key) ?? 0) + (b.cost_cents ?? 0));
      }
      let topCurrency = 'USD';
      let topTotal = -1;
      for (const [cur, tot] of byCurrency.entries()) {
        if (tot > topTotal) {
          topTotal = tot;
          topCurrency = cur;
        }
      }
      samples.push({ days, cents: topTotal, currency: topCurrency });
    }

    if (samples.length === 0) return empty;

    // Group by currency; pick the largest-sample-size currency.
    const groups = new Map<string, PastTripSpend[]>();
    for (const s of samples) {
      const arr = groups.get(s.currency) ?? [];
      arr.push(s);
      groups.set(s.currency, arr);
    }
    let chosen: { currency: string; items: PastTripSpend[] } | null = null;
    for (const [cur, items] of groups.entries()) {
      if (!chosen || items.length > chosen.items.length) {
        chosen = { currency: cur, items };
      }
    }
    if (!chosen) return empty;

    const perDayValues = chosen.items.map((s) => s.cents / s.days);
    perDayValues.sort((a, b) => a - b);
    const mean =
      perDayValues.reduce((s, n) => s + n, 0) / perDayValues.length;
    const perDayCents = Math.round(mean);

    const tripDays =
      trip.start_date && trip.end_date
        ? inclusiveDayCount(trip.start_date, trip.end_date)
        : 0;
    const totalCents = tripDays > 0 ? perDayCents * tripDays : 0;

    return {
      perDayCents,
      totalCents,
      currency: chosen.currency,
      sampleSize: chosen.items.length,
    };
  } catch {
    return empty;
  }
}

// ── preTripReminders ────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export function preTripReminders(
  db: DatabaseAdapter,
  tripId: string,
): PreTripReminder[] {
  const out: PreTripReminder[] = [];
  try {
    const tripRows = db.query<TripRow>(
      `SELECT * FROM tv_trips WHERE id = ?`,
      [tripId],
    );
    const trip = tripRows[0];
    if (!trip) return out;

    const start = trip.start_date ? parseIsoDate(trip.start_date) : null;
    const now = todayUtc();
    const daysUntilTrip = start
      ? Math.round((start.getTime() - now.getTime()) / DAY_MS)
      : null;

    // Resolve destination country (first with country_code).
    const destIds = parseIdArray(trip.destination_ids);
    let countryCode: string | null = null;
    if (destIds.length > 0) {
      const placeholders = destIds.map(() => '?').join(',');
      try {
        const dests = db.query<DestinationRow>(
          `SELECT * FROM tv_destinations WHERE id IN (${placeholders})`,
          destIds,
        );
        countryCode = dests.find((d) => d.country_code)?.country_code ?? null;
      } catch {
        countryCode = null;
      }
    }

    // Passport expiry check: need 6 months validity past trip start.
    try {
      const report = checkExpiry(db);
      let passports: DocumentRow[] = [];
      try {
        passports = db.query<DocumentRow>(
          `SELECT * FROM tv_documents WHERE type = 'passport'`,
        );
      } catch {
        // no documents table — skip
      }
      const hasPassport = passports.length > 0;
      if (!hasPassport && countryCode && countryCode !== 'US') {
        out.push({
          severity: 'warning',
          kind: 'passport',
          message: 'No passport on file. International travel may require one.',
        });
      }
      // Expired or soon-expiring passports from the expiry report.
      const passportItems = [
        ...report.expired,
        ...report.critical,
        ...report.warning,
        ...report.ok,
      ].filter((i) => i.source === 'document' && i.type === 'passport');
      for (const item of passportItems) {
        if (item.urgency === 'expired') {
          out.push({
            severity: 'critical',
            kind: 'passport',
            message: `Passport ${item.name_or_provider} is expired.`,
          });
          continue;
        }
        if (start) {
          // If passport expires within 6 months of trip start, flag.
          const expiry = parseIsoDate(item.expiry_date);
          if (expiry) {
            const sixMonthsAfterStart = new Date(start.getTime());
            sixMonthsAfterStart.setUTCMonth(
              sixMonthsAfterStart.getUTCMonth() + 6,
            );
            if (expiry.getTime() < sixMonthsAfterStart.getTime()) {
              out.push({
                severity: 'critical',
                kind: 'passport',
                message: `Passport ${item.name_or_provider} expires before 6-month buffer after trip start.`,
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Visa check: if destination country is non-home (treat US as home default),
    // and no visa document exists for that country, info reminder.
    if (countryCode && countryCode !== 'US') {
      try {
        const visas = db.query<DocumentRow>(
          `SELECT * FROM tv_documents WHERE type = 'visa'`,
        );
        const hasMatch = visas.some(
          (v) =>
            (v.country ?? '').toUpperCase() === countryCode ||
            (v.name ?? '').toUpperCase().includes(countryCode),
        );
        if (!hasMatch) {
          out.push({
            severity: 'info',
            kind: 'visa',
            message: `Check visa requirements for ${countryCode}.`,
          });
        }
      } catch {
        // no documents table — emit generic info reminder.
        out.push({
          severity: 'info',
          kind: 'visa',
          message: `Check visa requirements for ${countryCode}.`,
        });
      }
    }

    // Booking check: international trip with no flight booking.
    if (trip.trip_type === 'business' || countryCode) {
      try {
        const flights = db.query<{ n: number }>(
          `SELECT COUNT(*) AS n FROM tv_bookings
            WHERE trip_id = ? AND type = 'flight'`,
          [tripId],
        );
        if ((flights[0]?.n ?? 0) === 0 && countryCode && countryCode !== 'US') {
          out.push({
            severity: 'warning',
            kind: 'booking',
            message: 'No flight booking recorded for international trip.',
          });
        }
      } catch {
        // ignore
      }
    }

    // Vaccination reminder 3 weeks before trip start.
    if (daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 21) {
      out.push({
        severity: 'info',
        kind: 'vaccination',
        message:
          'Trip is within 3 weeks — verify required vaccinations for the destination.',
      });
    }

    // Imminent trip: start within 7 days.
    if (daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 7) {
      out.push({
        severity: 'warning',
        kind: 'other',
        message: `Trip starts in ${daysUntilTrip} day${daysUntilTrip === 1 ? '' : 's'}.`,
      });
    }

    return out;
  } catch {
    return out;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseIdArray(serialized: string | null | undefined): string[] {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function inclusiveDayCount(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.round(ms / DAY_MS) + 1;
}

function parseIsoDate(iso: string): Date | null {
  const hasTime = iso.includes('T');
  const base = hasTime ? iso : `${iso}T00:00:00.000Z`;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function todayUtc(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}
