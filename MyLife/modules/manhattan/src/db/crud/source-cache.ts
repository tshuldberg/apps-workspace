import type { DatabaseAdapter } from '@mylife/db';
import type { NormalizedEvent } from '../../sources/types';

export interface SourceCacheRow {
  id: string;
  source_id: string;
  fetched_at: string;
  payload_json: string;
  ttl_seconds: number;
}

export interface ReplaceSourceCacheOptions {
  fetchedAt?: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 900;

export function replaceSourceCache(
  db: DatabaseAdapter,
  sourceId: string,
  events: NormalizedEvent[],
  options: ReplaceSourceCacheOptions = {},
): void {
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  db.execute(
    `INSERT INTO mh_source_cache (id, source_id, fetched_at, payload_json, ttl_seconds)
     VALUES (?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       source_id = excluded.source_id,
       fetched_at = excluded.fetched_at,
       payload_json = excluded.payload_json,
       ttl_seconds = excluded.ttl_seconds`,
    [sourceId, sourceId, fetchedAt, JSON.stringify(events), ttlSeconds],
  );
}

export function getSourceCacheRows(db: DatabaseAdapter): SourceCacheRow[] {
  return db.query<SourceCacheRow>(`SELECT * FROM mh_source_cache ORDER BY fetched_at DESC`);
}

export function clearSourceCache(db: DatabaseAdapter, sourceId: string): void {
  db.execute(`DELETE FROM mh_source_cache WHERE source_id = ?`, [sourceId]);
}
