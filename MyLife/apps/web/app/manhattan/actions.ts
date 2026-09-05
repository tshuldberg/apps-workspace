'use server';

// MANH-WEB: server-side discovery feed backed by the real NYC Open Data source.
//
// We drive the existing, tested manhattan engines directly from their pure
// source files (NOT the @mylife/manhattan barrel). The barrel re-exports the
// cross-module + integration bridges, which pull other module packages and
// react-native peer deps; importing those into a Next.js server action would
// bloat the graph for no reason. The files below are pure TypeScript with no
// Node/RN/fs dependency beyond global fetch, which exists server-side.
import {
  nycOpenDataAdapter,
  NYC_OPEN_DATA_ENDPOINT,
} from '../../../../modules/manhattan/src/sources/nyc-open-data';
import type {
  NormalizedEvent,
  SourceQuery,
  FetchImpl,
  FetchResponse,
} from '../../../../modules/manhattan/src/sources/types';
import { dedupe } from '../../../../modules/manhattan/src/engines/dedup';
import { classify, timeBucket, priceBucket } from '../../../../modules/manhattan/src/engines/taxonomy';
import {
  createEvent,
  getEvents,
  setEventSaved,
} from '../../../../modules/manhattan/src/db/crud/events';
import type { EventRow } from '../../../../modules/manhattan/src/types';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

/** A NormalizedEvent enriched with the real taxonomy facets + a stable id. */
export interface DiscoveryEvent extends NormalizedEvent {
  feedId: string;
  facets: { axis: string; value: string }[];
  /** 'Tonight' | 'Upcoming' | 'Pick a Date' from the real timeBucket engine. */
  timeBucket: string;
  /** First category facet, if any (e.g. 'Music'). */
  category: string | undefined;
  /** 'Free' | 'Under $20' | '$20-50' | '$50-100' | '$100+' | 'Unknown'. */
  priceBucket: string;
  /** True when this row lives in mh_events (manual add or saved). */
  isLocal: boolean;
  /** Set for local rows so Save/unsave can address them. */
  localId?: string;
  /** True when a local row is marked saved. */
  saved: boolean;
}

export interface DiscoveryFeed {
  events: DiscoveryEvent[];
  /** Distinct category facet values present in the feed, sorted. */
  categories: string[];
  /** Source ids that actually contributed events. */
  sources: string[];
  fetchedAt: string;
  /** True when the live source returned zero rows (network/endpoint issue). */
  sourceEmpty: boolean;
}

/**
 * Adapt the platform global `fetch` to the module's FetchImpl contract.
 * Node 18+ Response is structurally compatible (ok/status/json/text), but we
 * wrap it explicitly so the contract is enforced and a missing global fetch
 * fails loudly instead of silently returning undefined.
 */
const serverFetch: FetchImpl = async (url, init): Promise<FetchResponse> => {
  const g = globalThis as { fetch?: typeof fetch };
  if (typeof g.fetch !== 'function') {
    throw new Error('global fetch is not available in this runtime');
  }
  const res = await g.fetch(url, init as RequestInit);
  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json(),
    text: () => res.text(),
  };
};

function firstCategory(facets: { axis: string; value: string }[]): string | undefined {
  return facets.find((f) => f.axis === 'category')?.value;
}

function feedId(event: NormalizedEvent, index: number): string {
  const stable = event.externalId ?? `${event.title}:${event.startAt ?? ''}:${index}`;
  return `${event.sourceId}:${stable}`;
}

/**
 * Fetch and classify NYC events from real NYC Open Data, server-side.
 *
 * Pipeline: nycOpenDataAdapter.fetchEvents (real HTTP, no API key) ->
 * dedupe (real engine) -> classify + timeBucket (real taxonomy engine).
 * No mock data. If the live endpoint is unreachable or returns nothing, we
 * return an empty feed and let the page render an honest empty/error state.
 */
export async function fetchDiscoveryFeed(limit = 60): Promise<DiscoveryFeed> {
  const fetchedAt = new Date().toISOString();
  const query: SourceQuery = { city: 'New York', limit };

  let raw: NormalizedEvent[] = [];
  try {
    raw = await nycOpenDataAdapter.fetchEvents(query, serverFetch);
  } catch {
    // A network/timeout failure surfaces as an empty live feed; the page
    // shows the honest "could not reach NYC Open Data" state. We never
    // fabricate events to fill the gap.
    return {
      events: [],
      categories: [],
      sources: [],
      fetchedAt,
      sourceEmpty: true,
    };
  }

  const deduped = dedupe(raw);
  const events: DiscoveryEvent[] = deduped.map((event, index) => {
    const facets = classify(event, fetchedAt);
    return {
      ...event,
      feedId: feedId(event, index),
      facets,
      timeBucket: timeBucket(event.startAt, fetchedAt),
      category: firstCategory(facets),
      priceBucket: priceBucket(event),
      isLocal: false,
      saved: false,
    };
  });

  // Merge locally stored events (manual adds + saved feed events) so the
  // discovery surface includes the user's own rows, clearly marked.
  const seenKeys = new Set(
    events.map((e) => `${e.sourceId}:${e.externalId ?? ''}`).filter((k) => !k.endsWith(':')),
  );
  for (const local of readLocalEvents()) {
    const key = `${local.sourceId}:${local.externalId ?? ''}`;
    if (local.externalId && seenKeys.has(key)) {
      // The live feed already carries this event; mark that copy saved.
      const twin = events.find(
        (e) => e.sourceId === local.sourceId && e.externalId === local.externalId,
      );
      if (twin) {
        twin.saved = local.saved;
        twin.isLocal = true;
        twin.localId = local.localId;
      }
      continue;
    }
    events.push(local);
  }

  // Sort by start date, most recent first, so the archive reads chronologically.
  events.sort((a, b) => (b.startAt ?? '').localeCompare(a.startAt ?? ''));

  const categories = Array.from(
    new Set(events.map((e) => e.category).filter((c): c is string => Boolean(c))),
  ).sort();

  return {
    events,
    categories,
    sources: events.length > 0 ? [nycOpenDataAdapter.id] : [],
    fetchedAt,
    sourceEmpty: events.length === 0,
  };
}

/** The live dataset record the feed is built from (honest provenance link). */
export async function getSourceInfo(): Promise<{ endpoint: string; portal: string }> {
  return {
    endpoint: NYC_OPEN_DATA_ENDPOINT,
    portal: 'https://data.cityofnewyork.us/Culture-Recreation/NYC-Parks-Events-Listing-Events/fudw-fgrp',
  };
}

// ---------------------------------------------------------------------------
// Local events: manual adds + saved feed events (mh_events)
// ---------------------------------------------------------------------------

function manhattanDb() {
  ensureModuleMigrations('manhattan');
  return getAdapter();
}

function rowToDiscoveryEvent(row: EventRow, now: string): DiscoveryEvent {
  const normalized: NormalizedEvent = {
    sourceId: row.source_id,
    externalId: row.external_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    venueName: row.venue_name ?? undefined,
    address: row.address ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    startAt: row.start_at ?? undefined,
    endAt: row.end_at ?? undefined,
    category: row.category ?? undefined,
    purchaseUrl: row.purchase_url ?? undefined,
    priceMin: row.price_min ?? undefined,
    priceMax: row.price_max ?? undefined,
    isFree: row.is_free === 1,
  };
  const facets = classify(normalized, now);
  return {
    ...normalized,
    feedId: `local:${row.id}`,
    facets,
    timeBucket: timeBucket(normalized.startAt, now),
    category: facets.find((f) => f.axis === 'category')?.value,
    priceBucket: priceBucket(normalized),
    isLocal: true,
    localId: row.id,
    saved: row.saved === 1,
  };
}

/** Read mh_events rows; empty when the module tables do not exist yet. */
function readLocalEvents(): DiscoveryEvent[] {
  try {
    const db = manhattanDb();
    const now = new Date().toISOString();
    return getEvents(db).map((row) => rowToDiscoveryEvent(row, now));
  } catch {
    return [];
  }
}

/** Persist a live feed event into mh_events as saved (idempotent per source+external id). */
export async function saveFeedEventAction(event: {
  sourceId: string;
  externalId?: string;
  title: string;
  description?: string;
  venueName?: string;
  address?: string;
  neighborhood?: string;
  startAt?: string;
  endAt?: string;
  category?: string;
  purchaseUrl?: string;
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const db = manhattanDb();
    if (event.externalId) {
      const existing = db.query<{ id: string }>(
        `SELECT id FROM mh_events WHERE source_id = ? AND external_id = ? AND deleted_at IS NULL LIMIT 1`,
        [event.sourceId, event.externalId],
      )[0];
      if (existing) {
        setEventSaved(db, existing.id, true);
        return { ok: true, id: existing.id };
      }
    }
    const id = createEvent(db, { ...event, saved: true });
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Unsave a locally stored event. */
export async function unsaveEventAction(localId: string): Promise<void> {
  setEventSaved(manhattanDb(), localId, false);
}

/** Add a manual event (things you heard about outside any feed). */
export async function addManualEventAction(input: {
  title: string;
  startAt?: string;
  venueName?: string;
  category?: string;
  purchaseUrl?: string;
  isFree?: boolean;
  priceMin?: number;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const title = input.title.trim();
  if (title.length === 0) {
    return { ok: false, error: 'A title is required.' };
  }
  try {
    const id = createEvent(manhattanDb(), {
      sourceId: 'manual',
      title,
      startAt: input.startAt || undefined,
      venueName: input.venueName?.trim() || undefined,
      category: input.category?.trim() || undefined,
      purchaseUrl: input.purchaseUrl?.trim() || undefined,
      isFree: input.isFree ?? false,
      priceMin: input.priceMin,
      saved: true,
    });
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
