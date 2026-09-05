import { parseEventFromShared } from '../parser/url-parser';
import type { EventSourceAdapter, FetchImpl, NormalizedEvent } from './types';
import { fetchWithTimeout } from './http';

// TikTok exposes a public, key-free oEmbed endpoint that returns lightweight
// metadata (title, author, thumbnail) for a given video URL. It is not a
// query-driven discovery API: there is no per-event URL during pull auto-ingest,
// so the adapter mirrors ics-import and returns [] from fetchEvents. The real
// ingestion path is the Phase 3 share flow, which calls fetchTikTokEvent with a
// specific shared URL and hands the result to the user for confirmation.
export const TIKTOK_OEMBED_ENDPOINT = 'https://www.tiktok.com/oembed';

export interface TikTokOembed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  author_url?: string;
  html?: string;
}

/**
 * Pure mapper from a TikTok oEmbed payload to a NormalizedEvent. The caption
 * (title) is run through the on-device share parser to lift a start time and
 * venue when the post text contains them.
 */
export function mapTikTokOembed(json: TikTokOembed, sourceUrl: string): NormalizedEvent {
  const title = json.title ?? json.author_name ?? 'Untitled Event';
  const parsed = parseEventFromShared({ text: json.title ?? '' });
  return {
    sourceId: 'tiktok_oembed',
    externalId: sourceUrl,
    title,
    startAt: parsed?.startAt ?? undefined,
    venueName: parsed?.venueName ?? undefined,
    imageUrl: json.thumbnail_url ?? undefined,
    purchaseUrl: sourceUrl,
    ticketProvider: undefined,
  };
}

/**
 * Fetch a single TikTok post via the oEmbed endpoint and map it to a candidate
 * NormalizedEvent. Returns null when the request fails or the body is not JSON.
 */
export async function fetchTikTokEvent(
  url: string,
  fetchImpl: FetchImpl,
): Promise<NormalizedEvent | null> {
  const endpoint = `${TIKTOK_OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(fetchImpl, endpoint, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  try {
    const json = (await res.json()) as TikTokOembed;
    return mapTikTokOembed(json, url);
  } catch {
    return null;
  }
}

export const tiktokOembedAdapter: EventSourceAdapter = {
  id: 'tiktok_oembed',
  displayName: 'TikTok',
  tier: 'tier1',
  coverage: {
    categories: ['music', 'nightlife', 'arts'],
    ingestKinds: ['oembed'],
    realtime: false,
  },
  isAvailable: () => true,
  async fetchEvents(): Promise<NormalizedEvent[]> {
    return [];
  },
};
