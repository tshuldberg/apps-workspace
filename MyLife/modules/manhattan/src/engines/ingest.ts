import type { DatabaseAdapter } from '@mylife/db';
import type { EventSourceAdapter, FetchImpl, SourceQuery } from '../sources/types';
import { dedupe } from './dedup';
import { classify } from './taxonomy';
import { upsertExternalEvent } from '../db/crud/events';
import { addFacet, removeFacetsForEvent } from '../db/crud/facets';
import { ensureSource, isSourceEnabled, setSourceLastSynced } from '../db/crud/sources';
import { FacetAxis } from '../types';

export interface IngestResult {
  inserted: number;
  sources: string[];
}

/**
 * Fetch from every available Tier-1 adapter, dedupe, classify facets, and
 * persist into mh_events + mh_event_facets. One adapter failing does not abort
 * the others. Returns the count of upserted events and the source ids that
 * contributed (or were attempted).
 */
export async function ingestFromSources(
  db: DatabaseAdapter,
  registry: EventSourceAdapter[],
  query: SourceQuery,
  fetchImpl: FetchImpl,
  now?: string,
): Promise<IngestResult> {
  const collected = [];
  const syncedAt = now ?? new Date().toISOString();
  const sources: string[] = [];

  for (const adapter of registry) {
    ensureSource(db, adapter.id);
    if (adapter.tier !== 'tier1' || !adapter.isAvailable() || !isSourceEnabled(db, adapter.id)) {
      continue;
    }
    sources.push(adapter.id);
    try {
      const events = await adapter.fetchEvents(query, fetchImpl);
      for (const e of events) collected.push(e);
      setSourceLastSynced(db, adapter.id, syncedAt);
    } catch {
      // Skip a failing source; continue ingesting the rest.
    }
  }

  const deduped = dedupe(collected);
  let inserted = 0;
  for (const e of deduped) {
    const id = upsertExternalEvent(db, e);
    removeFacetsForEvent(db, id);
    for (const f of classify(e, now)) {
      const parsedAxis = FacetAxis.safeParse(f.axis);
      if (!parsedAxis.success) continue;
      addFacet(db, { eventId: id, axis: parsedAxis.data, value: f.value });
    }
    inserted += 1;
  }

  return { inserted, sources };
}
