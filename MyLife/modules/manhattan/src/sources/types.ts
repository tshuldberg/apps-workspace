export type SourceTier = 'tier1' | 'gap';
export type GapReason = 'tos_excluded' | 'no_public_api' | 'auth_required' | 'planned_first_party';
export type IngestKind = 'api' | 'oembed' | 'share' | 'calendar' | 'scrape';

export interface SourceCoverage {
  categories: string[];
  ingestKinds: IngestKind[];
  realtime: boolean;
}

export interface NormalizedEvent {
  sourceId: string;
  externalId?: string;
  title: string;
  description?: string;
  venueName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  category?: string;
  facets?: { axis: string; value: string }[];
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
  imageUrl?: string;
  purchaseUrl?: string;
  ticketProvider?: string;
}

export interface SourceQuery {
  city?: string;
  near?: { lat: number; lng: number };
  radiusMeters?: number;
  limit?: number;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}
// `signal` is typed loosely so the module never depends on a DOM/RN lib type;
// at runtime it is a real AbortSignal produced by fetchWithTimeout.
export type FetchImpl = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: unknown },
) => Promise<FetchResponse>;

export class SourceGapError extends Error {
  constructor(
    public readonly sourceId: string,
    public readonly reason: GapReason,
    message: string,
  ) {
    super(message);
    this.name = 'SourceGapError';
  }
}

export interface EventSourceAdapter {
  id: string;
  displayName: string;
  tier: SourceTier;
  coverage: SourceCoverage;
  gapFlag?: { reason: GapReason; note: string };
  isAvailable(): boolean;
  fetchEvents(input: SourceQuery, fetchImpl: FetchImpl): Promise<NormalizedEvent[]>;
}
