import * as FileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';

export type MediaOwnerKind = 'dish' | 'submission' | 'video' | 'recipe';
export type MediaKind = 'image' | 'video' | 'recipe_bundle';
export type MediaCacheStatus = 'available_remote' | 'downloaded' | 'failed';

export interface MediaCacheRequest {
  ownerKind: MediaOwnerKind;
  ownerId: string;
  mediaKind: MediaKind;
  remoteUri: string;
}

export interface MediaCacheRecord extends MediaCacheRequest {
  id: string;
  localUri: string | null;
  bytes: number | null;
  status: MediaCacheStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MediaCacheRow {
  id: string;
  owner_kind: MediaOwnerKind;
  owner_id: string;
  media_kind: MediaKind;
  remote_uri: string;
  local_uri: string | null;
  bytes: number | null;
  status: MediaCacheStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const MEDIA_CACHE_TABLE = 'rc_bestchef_media_cache';
const MEDIA_CACHE_DIR = `${FileSystem.documentDirectory ?? ''}bestchef-media-cache/`;

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapRow(row: MediaCacheRow): MediaCacheRecord {
  return {
    id: row.id,
    ownerKind: row.owner_kind,
    ownerId: row.owner_id,
    mediaKind: row.media_kind,
    remoteUri: row.remote_uri,
    localUri: row.local_uri,
    bytes: row.bytes,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateRemoteUri(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Media URL is malformed.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only remote HTTP media can be cached.');
  }
}

function extensionFor(request: MediaCacheRequest): string {
  try {
    const pathname = new URL(request.remoteUri).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {}

  if (request.mediaKind === 'image') return 'jpg';
  if (request.mediaKind === 'video') return 'mp4';
  return 'json';
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function safeFileStem(request: MediaCacheRequest): string {
  return `${request.ownerKind}-${request.ownerId}-${request.mediaKind}-${hashString(request.remoteUri)}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

export function ensureMediaCacheTable(db: DatabaseAdapter): void {
  db.execute(
    `CREATE TABLE IF NOT EXISTS ${MEDIA_CACHE_TABLE} (
      id TEXT PRIMARY KEY,
      owner_kind TEXT NOT NULL CHECK (owner_kind IN ('dish', 'submission', 'video', 'recipe')),
      owner_id TEXT NOT NULL,
      media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video', 'recipe_bundle')),
      remote_uri TEXT NOT NULL,
      local_uri TEXT,
      bytes INTEGER,
      status TEXT NOT NULL DEFAULT 'available_remote' CHECK (status IN ('available_remote', 'downloaded', 'failed')),
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (owner_kind, owner_id, media_kind, remote_uri)
    )`,
  );
  db.execute(
    `CREATE INDEX IF NOT EXISTS rc_bestchef_media_cache_owner_idx
     ON ${MEDIA_CACHE_TABLE}(owner_kind, owner_id, updated_at DESC)`,
  );
  db.execute(
    `CREATE INDEX IF NOT EXISTS rc_bestchef_media_cache_status_idx
     ON ${MEDIA_CACHE_TABLE}(status, updated_at DESC)`,
  );
}

export function getMediaCacheRecord(
  db: DatabaseAdapter,
  request: MediaCacheRequest,
): MediaCacheRecord | null {
  ensureMediaCacheTable(db);
  const rows = db.query<MediaCacheRow>(
    `SELECT * FROM ${MEDIA_CACHE_TABLE}
     WHERE owner_kind = ? AND owner_id = ? AND media_kind = ? AND remote_uri = ?
     LIMIT 1`,
    [request.ownerKind, request.ownerId, request.mediaKind, request.remoteUri],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

function upsertRecord(
  db: DatabaseAdapter,
  request: MediaCacheRequest,
  patch: {
    localUri: string | null;
    bytes: number | null;
    status: MediaCacheStatus;
    error: string | null;
  },
): MediaCacheRecord {
  ensureMediaCacheTable(db);
  const existing = getMediaCacheRecord(db, request);
  const now = new Date().toISOString();
  const id = existing?.id ?? createId('media');
  const createdAt = existing?.createdAt ?? now;

  db.execute(
    `INSERT INTO ${MEDIA_CACHE_TABLE} (
      id, owner_kind, owner_id, media_kind, remote_uri, local_uri,
      bytes, status, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_kind, owner_id, media_kind, remote_uri) DO UPDATE SET
      local_uri = excluded.local_uri,
      bytes = excluded.bytes,
      status = excluded.status,
      error = excluded.error,
      updated_at = excluded.updated_at`,
    [
      id,
      request.ownerKind,
      request.ownerId,
      request.mediaKind,
      request.remoteUri,
      patch.localUri,
      patch.bytes,
      patch.status,
      patch.error,
      createdAt,
      now,
    ],
  );

  return getMediaCacheRecord(db, request)!;
}

export async function resolveMediaUri(
  db: DatabaseAdapter,
  request: MediaCacheRequest,
): Promise<string> {
  const record = getMediaCacheRecord(db, request);
  if (record?.status !== 'downloaded' || !record.localUri) return request.remoteUri;

  const info = await FileSystem.getInfoAsync(record.localUri);
  if (info.exists) return record.localUri;

  upsertRecord(db, request, {
    localUri: null,
    bytes: null,
    status: 'available_remote',
    error: null,
  });
  return request.remoteUri;
}

export async function cacheMediaForOffline(
  db: DatabaseAdapter,
  request: MediaCacheRequest,
): Promise<MediaCacheRecord> {
  validateRemoteUri(request.remoteUri);
  ensureMediaCacheTable(db);

  const dirInfo = await FileSystem.getInfoAsync(MEDIA_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_CACHE_DIR, { intermediates: true });
  }

  const destination = `${MEDIA_CACHE_DIR}${safeFileStem(request)}.${extensionFor(request)}`;
  try {
    const result = await FileSystem.downloadAsync(request.remoteUri, destination);
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    return upsertRecord(db, request, {
      localUri: result.uri,
      bytes: fileInfo.exists && 'size' in fileInfo ? fileInfo.size ?? null : null,
      status: 'downloaded',
      error: null,
    });
  } catch (err) {
    return upsertRecord(db, request, {
      localUri: null,
      bytes: null,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function removeCachedMedia(
  db: DatabaseAdapter,
  request: MediaCacheRequest,
): Promise<void> {
  const record = getMediaCacheRecord(db, request);
  if (record?.localUri) {
    await FileSystem.deleteAsync(record.localUri, { idempotent: true });
  }

  upsertRecord(db, request, {
    localUri: null,
    bytes: null,
    status: 'available_remote',
    error: null,
  });
}
