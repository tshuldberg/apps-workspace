import type { EventSourceAdapter, FetchImpl, NormalizedEvent, SourceQuery } from './types';
import { fetchWithTimeout } from './http';

// NYC Open Data "NYC Parks Events Listing - Events" dataset (resource fudw-fgrp).
// SODA JSON endpoint, no API key required for modest query volumes.
// Confirmed live field names (one-row sample):
//   event_id, title, date, start_time, end_time, location_description,
//   description, snippet, phone, email, cost_free ("0"/"1" string),
//   cost_description, must_see, url, notice
// The dataset has no coordinate fields, so lat/lng are mapped defensively
// (only populated when a future revision exposes them).
export const NYC_OPEN_DATA_ENDPOINT = 'https://data.cityofnewyork.us/resource/fudw-fgrp.json';

interface NycRow {
  event_id?: string;
  id?: string;
  title?: string;
  name?: string;
  date?: string;
  start_date_time?: string;
  end_date_time?: string;
  start_time?: string;
  end_time?: string;
  location_description?: string;
  location?: string;
  description?: string;
  snippet?: string;
  cost_free?: string | boolean;
  cost_description?: string;
  url?: string;
  latitude?: string | number;
  longitude?: string | number;
  lat?: string | number;
  lng?: string | number;
  coordinates?: unknown;
  [key: string]: unknown;
}

function toNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function combineDateTime(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const day = date.slice(0, 10);
  if (!day) return undefined;
  if (time && /^\d{1,2}:\d{2}/.test(time)) {
    const [h, m] = time.split(':');
    return `${day}T${h.padStart(2, '0')}:${m.slice(0, 2)}:00`;
  }
  return `${day}T00:00:00`;
}

function readCoords(row: NycRow): { lat?: number; lng?: number } {
  const coords = row.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    // SODA point geometries are [longitude, latitude].
    return { lng: toNumber(coords[0]), lat: toNumber(coords[1]) };
  }
  if (coords && typeof coords === 'object') {
    const obj = coords as { latitude?: unknown; longitude?: unknown };
    return { lat: toNumber(obj.latitude), lng: toNumber(obj.longitude) };
  }
  return {
    lat: toNumber(row.latitude ?? row.lat),
    lng: toNumber(row.longitude ?? row.lng),
  };
}

/**
 * Pure mapper from a NYC Open Data row to a NormalizedEvent.
 * Defensive about missing fields so it survives schema drift.
 */
export function mapNycRow(row: NycRow): NormalizedEvent {
  const { lat, lng } = readCoords(row);
  const startAt = row.start_date_time ?? combineDateTime(row.date, row.start_time);
  const endAt =
    row.end_date_time ??
    (row.end_time ? combineDateTime(row.date, row.end_time) : undefined);
  const isFree =
    row.cost_free === true || row.cost_free === '1' || row.cost_free === 'true';
  return {
    sourceId: 'nyc_open_data',
    externalId: row.event_id ?? row.id,
    title: row.title ?? row.name ?? 'Untitled Event',
    description: row.description ?? row.snippet ?? undefined,
    venueName: row.location_description ?? row.location ?? undefined,
    startAt,
    endAt,
    lat,
    lng,
    isFree,
  };
}

export const nycOpenDataAdapter: EventSourceAdapter = {
  id: 'nyc_open_data',
  displayName: 'NYC Open Data',
  tier: 'tier1',
  coverage: {
    categories: ['Education/Class', 'Markets & Fairs', 'Visual Arts/Exhibition', 'Music'],
    ingestKinds: ['api'],
    realtime: false,
  },
  isAvailable: () => true,
  async fetchEvents(input: SourceQuery, fetchImpl: FetchImpl): Promise<NormalizedEvent[]> {
    const limit = input.limit ?? 50;
    const url = `${NYC_OPEN_DATA_ENDPOINT}?$limit=${limit}`;
    const res = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json) ? (json as NycRow[]) : [];
    return rows.slice(0, limit).map(mapNycRow);
  },
};
