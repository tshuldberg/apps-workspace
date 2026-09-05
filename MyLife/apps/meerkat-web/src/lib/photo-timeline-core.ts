// Plan 38 amendment C.6 (WEB): the pure photo-timeline + map-points view logic.
// This is a BYTE-IDENTICAL twin of apps/meerkat/app/(root)/data/
// photo-timeline-core.ts (only this header block differs). The web timeline
// segment consumes buildPhotoTimeline; the web app ships NO map, so photoMapPoints
// is exported for parity/tests but the web UI never renders a map.
//
// buildPhotoTimeline groups already-verified photo items into year -> month ->
// day sections from each item's EXIF capture date (metadata capturedAt). An item
// with no readable capture date is NOT given a fake date: it drops into a single
// honest "No capture date" bucket, ordered by its updatedAt only so the bucket is
// stable, never sorted as if updatedAt were a capture date. photoMapPoints returns
// ONLY the items that carry consented GPS coordinates (D.7).
//
// Pure + node-only (no React, no db): the grouping and the GPS consent filter are
// unit-tested without a render harness.
import type { ResolvedLibraryItem } from './library-data-core';

/** Canonical UI strings shared with the web twin. Keep byte-identical. */
export const PHOTO_TIMELINE_STRINGS = {
  /** The one honest section for photos with no readable EXIF capture date. */
  noCaptureDate: 'No capture date',
} as const;

/** Stable section key for the no-capture-date bucket (never a real date key). */
export const NO_CAPTURE_DATE_KEY = '__no_capture_date__';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export interface ParsedCaptureDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

/**
 * Parse a capture date to a calendar day. Accepts the 'YYYY-MM-DD...' shape the
 * EXIF reader emits (and any ISO-like prefix). Range-checked and fail-safe: an
 * out-of-range or unparseable value returns null so the item falls into the
 * honest no-capture-date bucket instead of a fabricated section.
 */
export function parseCaptureDate(value: unknown): ParsedCaptureDate | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isInteger(year) || year < 1870 || year > 3000) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return { year, month, day };
}

function dayKey(date: ParsedCaptureDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

/** 'March 5, 2024'. Locale-free so the node tests are deterministic. */
export function formatDayLabel(date: ParsedCaptureDate): string {
  return `${MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`;
}

/** 'March 2024', the coarser header a UI can render when the month changes. */
export function formatMonthLabel(date: ParsedCaptureDate): string {
  return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

interface PhotoMeta {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Read the photo fields from an item's signed metadata_json, fail-safe. */
function readPhotoMeta(item: ResolvedLibraryItem): PhotoMeta {
  const empty: PhotoMeta = { capturedAt: null, latitude: null, longitude: null };
  try {
    const parsed: unknown = JSON.parse(item.event.metadataJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
    const o = parsed as Record<string, unknown>;
    return {
      capturedAt: typeof o.capturedAt === 'string' ? o.capturedAt : null,
      latitude: typeof o.latitude === 'number' && Number.isFinite(o.latitude) ? o.latitude : null,
      longitude: typeof o.longitude === 'number' && Number.isFinite(o.longitude) ? o.longitude : null,
    };
  } catch {
    return empty;
  }
}

export interface TimelineDaySection {
  /** 'YYYY-MM-DD' for a dated section, or NO_CAPTURE_DATE_KEY for the bucket. */
  key: string;
  /** False only for the no-capture-date bucket. */
  hasDate: boolean;
  year: number | null;
  month: number | null;
  day: number | null;
  /** 'March 5, 2024' or the no-capture-date label. */
  dayLabel: string;
  /** 'March 2024' for a dated section, null for the bucket. */
  monthLabel: string | null;
  items: ResolvedLibraryItem[];
}

/**
 * Group photo items into day sections, newest day first. Within a dated day the
 * items order by capturedAt desc (id tiebreak); the no-capture-date bucket sorts
 * ONLY by updatedAt desc (id tiebreak) and always sits last. Deterministic and
 * pure: identical input yields identical sections in identical order.
 */
export function buildPhotoTimeline(items: readonly ResolvedLibraryItem[]): TimelineDaySection[] {
  const dated = new Map<string, { date: ParsedCaptureDate; entries: { item: ResolvedLibraryItem; capturedAt: string }[] }>();
  const undated: { item: ResolvedLibraryItem; updatedAt: string }[] = [];

  for (const item of items) {
    const meta = readPhotoMeta(item);
    const parsed = parseCaptureDate(meta.capturedAt);
    if (parsed && meta.capturedAt) {
      const key = dayKey(parsed);
      let bucket = dated.get(key);
      if (!bucket) {
        bucket = { date: parsed, entries: [] };
        dated.set(key, bucket);
      }
      bucket.entries.push({ item, capturedAt: meta.capturedAt });
    } else {
      undated.push({ item, updatedAt: item.event.updatedAt });
    }
  }

  const sections: TimelineDaySection[] = [];
  const datedKeys = [...dated.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  for (const key of datedKeys) {
    const bucket = dated.get(key)!;
    const ordered = [...bucket.entries]
      .sort((a, b) => {
        if (a.capturedAt !== b.capturedAt) return a.capturedAt < b.capturedAt ? 1 : -1;
        return a.item.event.id < b.item.event.id ? 1 : -1;
      })
      .map((e) => e.item);
    sections.push({
      key,
      hasDate: true,
      year: bucket.date.year,
      month: bucket.date.month,
      day: bucket.date.day,
      dayLabel: formatDayLabel(bucket.date),
      monthLabel: formatMonthLabel(bucket.date),
      items: ordered,
    });
  }

  if (undated.length > 0) {
    const ordered = [...undated]
      .sort((a, b) => {
        if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
        return a.item.event.id < b.item.event.id ? 1 : -1;
      })
      .map((e) => e.item);
    sections.push({
      key: NO_CAPTURE_DATE_KEY,
      hasDate: false,
      year: null,
      month: null,
      day: null,
      dayLabel: PHOTO_TIMELINE_STRINGS.noCaptureDate,
      monthLabel: null,
      items: ordered,
    });
  }

  return sections;
}

export interface PhotoMapPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  capturedAt: string | null;
}

/**
 * The map points for a photo set: ONLY items whose signed metadata carries valid
 * latitude AND longitude. This is the D.7 consent filter by construction -- a
 * photo has coordinates only when its contributor kept locations on at ingest;
 * every other photo had its GPS rewritten out of the bytes before sealing, so it
 * has no coordinates to leak here. Out-of-range coordinates are dropped.
 */
export function photoMapPoints(items: readonly ResolvedLibraryItem[]): PhotoMapPoint[] {
  const points: PhotoMapPoint[] = [];
  for (const item of items) {
    const meta = readPhotoMeta(item);
    if (meta.latitude === null || meta.longitude === null) continue;
    if (meta.latitude < -90 || meta.latitude > 90) continue;
    if (meta.longitude < -180 || meta.longitude > 180) continue;
    points.push({
      id: item.event.id,
      title: item.event.title,
      latitude: meta.latitude,
      longitude: meta.longitude,
      capturedAt: meta.capturedAt,
    });
  }
  return points;
}
