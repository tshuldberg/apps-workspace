import type { DatabaseAdapter } from '@mylife/db';
import type { EventSourceAdapter, FetchImpl, NormalizedEvent, SourceQuery } from '../sources/types';
import { replaceSourceCache, getSourceCacheRows } from '../db/crud/source-cache';
import { ensureSource, isSourceEnabled, setSourceLastSynced } from '../db/crud/sources';
import { dedupe } from './dedup';
import { classify } from './taxonomy';

export interface DiscoveryCacheResult {
  fetched: number;
  sources: string[];
  failed: number;
}

export interface CachedDiscoveryEvent extends NormalizedEvent {
  cacheId: string;
  fetchedAt: string;
  expiresAt: string | null;
  facets: { axis: string; value: string }[];
}

const DEFAULT_TTL_SECONDS = 900;

// A compromised or buggy source must not be able to bloat the on-device cache:
// cap both the event count and the serialized payload size per source row
// (2026-06-09 production eval, F9).
export const MAX_CACHE_EVENTS = 200;
export const MAX_CACHE_PAYLOAD_BYTES = 256 * 1024;

export function capCachePayload(events: NormalizedEvent[]): NormalizedEvent[] {
  let capped = events.slice(0, MAX_CACHE_EVENTS);
  while (capped.length > 1 && JSON.stringify(capped).length > MAX_CACHE_PAYLOAD_BYTES) {
    capped = capped.slice(0, Math.ceil(capped.length / 2));
  }
  return capped;
}

function isNormalizedEvent(value: unknown): value is NormalizedEvent {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { sourceId?: unknown }).sourceId === 'string' &&
    typeof (value as { title?: unknown }).title === 'string' &&
    (value as { title: string }).title.trim().length > 0
  );
}

function parseCachedEvents(payloadJson: string): NormalizedEvent[] {
  try {
    const parsed = JSON.parse(payloadJson);
    return Array.isArray(parsed) ? parsed.filter(isNormalizedEvent) : [];
  } catch {
    return [];
  }
}

function expiresAt(fetchedAt: string, ttlSeconds: number): string | null {
  const fetchedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedMs) || ttlSeconds <= 0) return null;
  return new Date(fetchedMs + ttlSeconds * 1000).toISOString();
}

function isExpired(fetchedAt: string, ttlSeconds: number, nowMs: number): boolean {
  const fetchedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedMs) || ttlSeconds <= 0) return false;
  return fetchedMs + ttlSeconds * 1000 < nowMs;
}

function cacheId(event: NormalizedEvent, index: number): string {
  const stable = event.externalId ?? `${event.title}:${event.startAt ?? ''}:${index}`;
  return `${event.sourceId}:${stable}`;
}

function availablePullSources(
  db: DatabaseAdapter,
  registry: EventSourceAdapter[],
): EventSourceAdapter[] {
  const out: EventSourceAdapter[] = [];
  for (const adapter of registry) {
    ensureSource(db, adapter.id);
    if (adapter.tier !== 'tier1') continue;
    if (!adapter.coverage.ingestKinds.includes('api')) continue;
    if (!adapter.isAvailable()) continue;
    if (!isSourceEnabled(db, adapter.id)) continue;
    out.push(adapter);
  }
  return out;
}

export async function refreshDiscoveryCache(
  db: DatabaseAdapter,
  registry: EventSourceAdapter[],
  query: SourceQuery,
  fetchImpl: FetchImpl,
  now?: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<DiscoveryCacheResult> {
  const fetchedAt = now ?? new Date().toISOString();
  const sources: string[] = [];
  let fetched = 0;
  let failed = 0;

  for (const adapter of availablePullSources(db, registry)) {
    sources.push(adapter.id);
    try {
      const events = capCachePayload(await adapter.fetchEvents(query, fetchImpl));
      replaceSourceCache(db, adapter.id, events, { fetchedAt, ttlSeconds });
      setSourceLastSynced(db, adapter.id, fetchedAt);
      fetched += events.length;
    } catch {
      failed += 1;
    }
  }

  return { fetched, sources, failed };
}

export function getCachedDiscoveryEvents(
  db: DatabaseAdapter,
  now: Date = new Date(),
): CachedDiscoveryEvent[] {
  const nowMs = now.getTime();
  const collected: Array<{ event: NormalizedEvent; fetchedAt: string; ttlSeconds: number }> = [];

  for (const row of getSourceCacheRows(db)) {
    if (isExpired(row.fetched_at, row.ttl_seconds, nowMs)) continue;
    for (const event of parseCachedEvents(row.payload_json)) {
      collected.push({
        event,
        fetchedAt: row.fetched_at,
        ttlSeconds: row.ttl_seconds,
      });
    }
  }

  return dedupe(collected.map((item) => item.event)).map((event, index) => {
    const sourceRow = collected.find((item) => item.event === event);
    const fetchedAt = sourceRow?.fetchedAt ?? new Date(nowMs).toISOString();
    const ttlSeconds = sourceRow?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const computedFacets = classify(event, now.toISOString());
    const facets = [...(event.facets ?? []), ...computedFacets];
    return {
      ...event,
      cacheId: cacheId(event, index),
      fetchedAt,
      expiresAt: expiresAt(fetchedAt, ttlSeconds),
      facets,
    };
  });
}
