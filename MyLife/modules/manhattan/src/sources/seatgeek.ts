import type { EventSourceAdapter, FetchImpl, NormalizedEvent, SourceQuery } from './types';
import { fetchWithTimeout } from './http';

// SECURITY NOTE: production builds must use a hosted proxy so no SeatGeek
// credential ships in the app bundle. Direct SeatGeek calls are an explicit
// development-only path gated by EXPO_PUBLIC_MANHATTAN_ALLOW_DIRECT_SEATGEEK.
export const SEATGEEK_ENDPOINT = 'https://api.seatgeek.com/2/events';
export const SEATGEEK_PROXY_PATH = '/sources/seatgeek/events';

function cleanUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    return raw.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

type SourceEnv = Record<string, string | undefined>;

export function getSeatGeekProxyUrl(env: SourceEnv = process.env): string | null {
  return cleanUrl(env.EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL);
}

export function isDirectSeatGeekEnabled(env: SourceEnv = process.env): boolean {
  return env.EXPO_PUBLIC_MANHATTAN_ALLOW_DIRECT_SEATGEEK === 'true';
}

export function getSeatGeekClientId(env: SourceEnv = process.env): string | null {
  if (!isDirectSeatGeekEnabled(env)) return null;
  return env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID?.trim() || null;
}

function buildSeatGeekUrl(input: SourceQuery): string | null {
  const limit = input.limit ?? 50;
  const city = input.city ?? 'New York';
  const proxyUrl = getSeatGeekProxyUrl();
  if (proxyUrl) {
    return (
      `${proxyUrl}${SEATGEEK_PROXY_PATH}?city=${encodeURIComponent(city)}` +
      `&limit=${encodeURIComponent(String(limit))}`
    );
  }

  const clientId = getSeatGeekClientId();
  if (!clientId) return null;
  return (
    `${SEATGEEK_ENDPOINT}?client_id=${encodeURIComponent(clientId)}` +
    `&venue.city=${encodeURIComponent(city)}&per_page=${limit}`
  );
}

// Map SeatGeek event `type` values to Manhattan categories.
const TYPE_TO_CATEGORY: Record<string, string> = {
  concert: 'Music',
  music_festival: 'Music',
  comedy: 'Comedy',
  theater: 'Theater',
  broadway_tickets_national: 'Theater',
  dance_performance_tour: 'Theater',
  classical: 'Music',
  classical_orchestral_instrumental: 'Music',
  classical_vocal: 'Music',
  cirque_du_soleil: 'Theater',
};

interface SeatGeekVenue {
  name?: string;
  address?: string;
  location?: { lat?: number; lon?: number };
}

interface SeatGeekEvent {
  id?: number | string;
  title?: string;
  type?: string;
  datetime_local?: string;
  url?: string;
  venue?: SeatGeekVenue;
  stats?: { lowest_price?: number | null };
}

interface SeatGeekResponse {
  events?: SeatGeekEvent[];
}

/**
 * Pure mapper from a SeatGeek event payload to a NormalizedEvent.
 */
export function mapSeatGeekEvent(ev: SeatGeekEvent): NormalizedEvent {
  const lowest = ev.stats?.lowest_price;
  const category = ev.type ? TYPE_TO_CATEGORY[ev.type] : undefined;
  return {
    sourceId: 'seatgeek',
    externalId: ev.id != null ? String(ev.id) : undefined,
    title: ev.title ?? 'Untitled Event',
    startAt: ev.datetime_local ?? undefined,
    venueName: ev.venue?.name ?? undefined,
    address: ev.venue?.address ?? undefined,
    lat: ev.venue?.location?.lat ?? undefined,
    lng: ev.venue?.location?.lon ?? undefined,
    category,
    priceMin: lowest ?? undefined,
    purchaseUrl: ev.url ?? undefined,
    ticketProvider: 'SeatGeek',
  };
}

export const seatGeekAdapter: EventSourceAdapter = {
  id: 'seatgeek',
  displayName: 'SeatGeek',
  tier: 'tier1',
  coverage: {
    categories: ['Music', 'Comedy', 'Theater'],
    ingestKinds: ['api'],
    realtime: false,
  },
  isAvailable: () => getSeatGeekProxyUrl() != null || getSeatGeekClientId() != null,
  async fetchEvents(input: SourceQuery, fetchImpl: FetchImpl): Promise<NormalizedEvent[]> {
    const url = buildSeatGeekUrl(input);
    if (!url) return [];
    const res = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const json = (await res.json()) as SeatGeekResponse;
    const events = Array.isArray(json.events) ? json.events : [];
    return events.slice(0, input.limit ?? 50).map(mapSeatGeekEvent);
  },
};
