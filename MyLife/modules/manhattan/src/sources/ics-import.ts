import { parseIcs } from '@mylife/mail';
import type { EventSourceAdapter, NormalizedEvent } from './types';

/**
 * Pure mapper from raw ICS text to NormalizedEvent[]. Drops cancelled events.
 */
export function icsToNormalized(ics: string): NormalizedEvent[] {
  const parsed = parseIcs(ics);
  return parsed
    .filter((p) => !p.isCancelled)
    .map((p) => ({
      sourceId: 'ics_import',
      externalId: p.uid,
      title: p.summary,
      description: p.description,
      venueName: p.location,
      startAt: p.dtstart,
      endAt: p.dtend,
      allDay: p.isAllDay,
    }));
}

// ICS is content-driven, not query-driven: events arrive via a dedicated import
// path (file/share). fetchEvents returns [] so the registry can still list it as
// an available Tier-1 source; ingestion happens via icsToNormalized + the
// Phase 3 share flow.
export const icsImportAdapter: EventSourceAdapter = {
  id: 'ics_import',
  displayName: 'Calendar Import (.ics)',
  tier: 'tier1',
  coverage: {
    categories: [],
    ingestKinds: ['calendar', 'share'],
    realtime: false,
  },
  isAvailable: () => true,
  async fetchEvents(): Promise<NormalizedEvent[]> {
    return [];
  },
};
