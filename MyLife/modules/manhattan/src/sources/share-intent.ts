import { parseEventFromShared, type ShareEventCandidate } from '../parser/url-parser';
import type { EventSourceAdapter, NormalizedEvent } from './types';

/**
 * Parse an OS share-sheet payload (text and/or url, optionally with files) into a
 * draft event candidate. Delegates entirely to the pure on-device share parser:
 * the url is used as a fallback text source when no explicit text is provided.
 * Returns null when there is nothing usable to parse.
 */
export function parseShareIntent(payload: {
  text?: string;
  url?: string;
  files?: { mimeType?: string; fileName?: string }[];
}): ShareEventCandidate | null {
  return parseEventFromShared({ url: payload.url, text: payload.text ?? payload.url });
}

// Share intent is push-based: events arrive when the user shares a link or text
// into the app, not via query-driven pull. fetchEvents returns [] so the registry
// can still list it as an available Tier-1 source; ingestion happens through
// parseShareIntent + the Phase 3 share flow, mirroring ics-import.
export const shareIntentAdapter: EventSourceAdapter = {
  id: 'share_intent',
  displayName: 'Shared link',
  tier: 'tier1',
  coverage: {
    categories: ['music', 'nightlife', 'arts', 'comedy', 'theater'],
    ingestKinds: ['share'],
    realtime: false,
  },
  isAvailable: () => true,
  async fetchEvents(): Promise<NormalizedEvent[]> {
    return [];
  },
};
