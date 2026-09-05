// DoWork offline downloads.
//
// Downloads an ENTITLED trainer video into the app sandbox so it plays offline
// and without a signed-URL round trip. The server re-checks entitlement both at
// download time (getPlaybackSource must succeed) and again at open time (a cheap
// probe). A download the server has DEFINITIVELY revoked (403 not_entitled) is
// deleted honestly and the user is told; a transient or offline failure never
// deletes a legitimately owned file, because the user was entitled when they
// saved it, so we play the local copy and re-verify the next time we are online.
//
// File I/O uses the modern expo-file-system API (File / Directory / Paths) for
// directory + file management, and reaches for the legacy createDownloadResumable
// only for the progress-and-cancel download itself (mirroring cloud-media, which
// imports the legacy upload task the same way). The index of what is on disk
// lives in the shared hub_settings KV, matching the resume-position pattern.

import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlaybackSource } from './cloud-playback';

const DOWNLOADS_DIR = 'trainer-downloads';
const INDEX_KEY = 'dowork.downloads.index.v1';
const PLAYBACK_FUNCTION = 'dowork-playback-url';
const ALLOWED_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);

// Resume-position rows the player writes per opened video (player.tsx keys a
// trainer video by its videoId under this prefix). Deleting a download must
// also delete its saved playhead: otherwise the row is dead weight in
// hub_settings the user can never resume into, and it lingers after the
// entitlement is gone (RT-1). Kept in sync with RESUME_PREFIX in player.tsx.
const RESUME_PREFIX = 'voice.player.resume.';

function clearResumeRow(db: DatabaseAdapter, videoId: string): void {
  db.execute('DELETE FROM hub_settings WHERE key = ?', [`${RESUME_PREFIX}${videoId}`]);
}

export interface DownloadEntry {
  videoId: string;
  title: string | null;
  bytes: number;
  downloadedAt: string; // ISO
  fileUri: string;
}

export interface DownloadProgress {
  writtenBytes: number;
  totalBytes: number;
  // 0 when the server sent no content-length so callers can show an
  // indeterminate state rather than a fabricated percentage.
  fraction: number;
}

export type DownloadResult =
  | { ok: true; entry: DownloadEntry }
  | { ok: false; error: string; cancelled?: boolean };

export interface DownloadHandle {
  promise: Promise<DownloadResult>;
  cancel: () => Promise<void>;
}

// Open-time verdict for a video the user asked to play.
export type OpenDownloadResult =
  | { status: 'play_local'; fileUri: string; entry: DownloadEntry }
  | { status: 'revoked'; message: string }
  | { status: 'not_downloaded' };

// 'needs_reauth' is a stale/expired session (401), distinct from a genuine
// entitlement denial (403) or a transient/offline failure (RT-12): the file
// is kept in both 'offline' and 'needs_reauth' cases, but callers can use the
// distinction to prompt a sign-in instead of a generic "you're offline" message.
export type EntitlementCheck = 'entitled' | 'revoked' | 'offline' | 'needs_reauth';

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

// ── index (hub_settings KV) ────────────────────────────────────────────────

function readRawIndex(db: DatabaseAdapter): Record<string, DownloadEntry> {
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
    [INDEX_KEY],
  );
  const raw = rows[0]?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, DownloadEntry> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Partial<DownloadEntry>;
      if (typeof v.videoId !== 'string' || typeof v.fileUri !== 'string') continue;
      out[key] = {
        videoId: v.videoId,
        title: typeof v.title === 'string' ? v.title : null,
        bytes: typeof v.bytes === 'number' && Number.isFinite(v.bytes) && v.bytes >= 0 ? v.bytes : 0,
        downloadedAt: typeof v.downloadedAt === 'string' ? v.downloadedAt : new Date(0).toISOString(),
        fileUri: v.fileUri,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeRawIndex(db: DatabaseAdapter, map: Record<string, DownloadEntry>): void {
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [INDEX_KEY, JSON.stringify(map)],
  );
}

// Wrapped in a transaction so two near-concurrent finishers (e.g. two
// downloads completing back to back) cannot read the same pre-write map and
// clobber each other's entry on write (DL-1: lost index entry, storage leak).
function upsertIndex(db: DatabaseAdapter, entry: DownloadEntry): void {
  db.transaction(() => {
    const map = readRawIndex(db);
    map[entry.videoId] = entry;
    writeRawIndex(db, map);
  });
}

function removeFromIndex(db: DatabaseAdapter, videoId: string): void {
  db.transaction(() => {
    const map = readRawIndex(db);
    if (map[videoId]) {
      delete map[videoId];
      writeRawIndex(db, map);
    }
  });
}

// Newest first, so the Settings list reads like a download history.
export function listDownloads(db: DatabaseAdapter): DownloadEntry[] {
  return Object.values(readRawIndex(db)).sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

export function getDownload(db: DatabaseAdapter, videoId: string): DownloadEntry | null {
  return readRawIndex(db)[videoId] ?? null;
}

export function isVideoDownloaded(db: DatabaseAdapter, videoId: string): boolean {
  return Boolean(readRawIndex(db)[videoId]);
}

export function getDownloadsTotalBytes(db: DatabaseAdapter): number {
  return Object.values(readRawIndex(db)).reduce((sum, entry) => sum + (entry.bytes || 0), 0);
}

// ── file helpers (modern API) ──────────────────────────────────────────────

function downloadsDirectory(): Directory {
  return new Directory(Paths.document, DOWNLOADS_DIR);
}

function ensureDownloadsDir(): Directory {
  const dir = downloadsDirectory();
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function extensionFromUrl(url: string): string {
  try {
    const withoutQuery = url.split('?')[0] ?? url;
    const lastSegment = withoutQuery.split('/').pop() ?? '';
    const ext = lastSegment.includes('.') ? lastSegment.split('.').pop()?.toLowerCase() ?? '' : '';
    return ALLOWED_EXTENSIONS.has(ext) ? ext : 'mp4';
  } catch {
    return 'mp4';
  }
}

function safeSize(file: File): number {
  try {
    return file.size ?? 0;
  } catch {
    return 0;
  }
}

function cleanupPartial(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Partial file may already be gone; nothing to clean.
  }
}

// ── entitlement probe ──────────────────────────────────────────────────────
//
// Only an explicit 403 { error: 'not_entitled' } FROM THE PLAYBACK FUNCTION is
// a definitive entitlement denial. A 403 whose body carries no readable
// not_entitled marker can come from gateway/JWT middleware/CORS layers in
// front of the function, so it is treated as unknown and the file is kept.
// We never delete content the user legitimately owns on an ambiguous signal.

async function statusFromInvokeError(error: unknown): Promise<{ status: number | null; marker: string | null }> {
  if (!error || typeof error !== 'object' || !('context' in error)) {
    return { status: null, marker: null };
  }
  const ctx = (error as { context?: unknown }).context;
  if (!ctx || typeof ctx !== 'object' || !('status' in ctx)) {
    return { status: null, marker: null };
  }
  const status = typeof (ctx as { status?: unknown }).status === 'number'
    ? (ctx as { status: number }).status
    : null;
  let marker: string | null = null;
  const cloneable = ctx as { clone?: () => { json: () => Promise<unknown> } };
  if (typeof cloneable.clone === 'function') {
    try {
      const body = await cloneable.clone().json();
      if (body && typeof body === 'object' && 'error' in body) {
        const value = (body as { error?: unknown }).error;
        if (typeof value === 'string') marker = value;
      }
    } catch {
      // Body may be unreadable; the status code alone is enough for a 403.
    }
  }
  return { status, marker };
}

export async function checkDownloadEntitlement(
  supabase: SupabaseClient,
  videoId: string,
): Promise<EntitlementCheck> {
  try {
    const { data, error } = await supabase.functions.invoke(PLAYBACK_FUNCTION, {
      body: { videoId },
    });
    if (!error) {
      const record = (data ?? {}) as Record<string, unknown>;
      if (record.ok === false) {
        return record.error === 'not_entitled' ? 'revoked' : 'offline';
      }
      return typeof record.url === 'string' ? 'entitled' : 'offline';
    }
    const { status, marker } = await statusFromInvokeError(error);
    // A revoked verdict requires the playback function's explicit marker:
    // gateways and JWT middleware can 403 without it, and an ambiguous 403
    // must never delete a legitimately owned download.
    if (status === 403 && marker === 'not_entitled') return 'revoked';
    if (status === 401) return 'needs_reauth';
    return 'offline';
  } catch {
    return 'offline';
  }
}

// ── download ───────────────────────────────────────────────────────────────

export function startVideoDownload(
  params: { supabase: SupabaseClient | null; db: DatabaseAdapter; videoId: string; title?: string | null },
  opts: { onProgress?: (progress: DownloadProgress) => void } = {},
): DownloadHandle {
  let resumable: ReturnType<typeof LegacyFileSystem.createDownloadResumable> | null = null;
  let cancelled = false;

  const run = async (): Promise<DownloadResult> => {
    const { supabase, db, videoId } = params;
    if (!supabase) return { ok: false, error: 'Downloads need a cloud connection.' };

    const existing = getDownload(db, videoId);
    if (existing) return { ok: true, entry: existing };

    // Server re-checks entitlement and hands back a signed source URL. A failure
    // here is an honest "cannot download" (not entitled, or offline), never a
    // fabricated success.
    const source = await getPlaybackSource(supabase, { videoId });
    if (!source.ok) return { ok: false, error: source.error };
    if (cancelled) return { ok: false, cancelled: true, error: 'Download cancelled.' };

    let dir: Directory;
    let file: File;
    try {
      dir = ensureDownloadsDir();
      const ext = extensionFromUrl(source.url);
      file = new File(dir, `${videoId}.${ext}`);
      cleanupPartial(file); // clear any stale partial from a prior aborted attempt
    } catch (error) {
      // A full disk or sandbox permission failure surfaces as an honest error
      // instead of an unhandled rejection (RT-15).
      return { ok: false, error: errMessage(error) };
    }

    resumable = LegacyFileSystem.createDownloadResumable(
      source.url,
      file.uri,
      {},
      opts.onProgress
        ? (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            const total = p.totalBytesExpectedToWrite || 0;
            opts.onProgress?.({
              writtenBytes: p.totalBytesWritten,
              totalBytes: total,
              fraction: total > 0 ? Math.min(1, p.totalBytesWritten / total) : 0,
            });
          }
        : undefined,
    );

    let result: { status?: number; uri?: string } | undefined;
    try {
      result = await resumable.downloadAsync();
    } catch (error) {
      cleanupPartial(file);
      if (cancelled) return { ok: false, cancelled: true, error: 'Download cancelled.' };
      return { ok: false, error: errMessage(error) };
    }

    if (cancelled) {
      cleanupPartial(file);
      return { ok: false, cancelled: true, error: 'Download cancelled.' };
    }
    if (!result || typeof result.status !== 'number' || result.status < 200 || result.status >= 300) {
      cleanupPartial(file);
      return { ok: false, error: `Download failed (HTTP ${result?.status ?? 'unknown'}).` };
    }

    const entry: DownloadEntry = {
      videoId,
      title: (params.title ?? source.title) ?? null,
      bytes: safeSize(file),
      downloadedAt: new Date().toISOString(),
      fileUri: file.uri,
    };
    upsertIndex(db, entry);
    return { ok: true, entry };
  };

  const promise = run();
  return {
    promise,
    cancel: async () => {
      cancelled = true;
      try {
        await resumable?.pauseAsync();
      } catch {
        // Pausing a finished/failed download is a no-op we can ignore.
      }
    },
  };
}

// Convenience wrapper for callers that do not need a cancel handle.
export function downloadTrainerVideo(
  params: { supabase: SupabaseClient | null; db: DatabaseAdapter; videoId: string; title?: string | null },
  opts: { onProgress?: (progress: DownloadProgress) => void } = {},
): Promise<DownloadResult> {
  return startVideoDownload(params, opts).promise;
}

export async function deleteDownload(db: DatabaseAdapter, videoId: string): Promise<void> {
  const entry = getDownload(db, videoId);
  if (entry) {
    try {
      const file = new File(entry.fileUri);
      if (file.exists) file.delete();
    } catch {
      // File may already be gone; the index removal below still runs.
    }
  }
  removeFromIndex(db, videoId);
  // Drop the saved playhead alongside the file so it does not outlive the
  // download it belonged to (RT-1).
  clearResumeRow(db, videoId);
}

export async function wipeAllDownloads(db: DatabaseAdapter): Promise<void> {
  // Capture the downloaded ids before the index is reset so their resume rows
  // can be pruned too (RT-1). Only videos that were actually downloaded are
  // touched; a streamed video's playhead is not managed here.
  const downloadedIds = Object.keys(readRawIndex(db));
  try {
    const dir = downloadsDirectory();
    if (dir.exists) dir.delete();
  } catch {
    // Directory may already be gone; the index reset below still runs.
  }
  writeRawIndex(db, {});
  for (const videoId of downloadedIds) {
    clearResumeRow(db, videoId);
  }
}

// ── open-time resolution ───────────────────────────────────────────────────

export async function resolveDownloadedVideo(params: {
  supabase: SupabaseClient | null;
  db: DatabaseAdapter;
  videoId: string;
}): Promise<OpenDownloadResult> {
  const { supabase, db, videoId } = params;
  const entry = getDownload(db, videoId);
  if (!entry) return { status: 'not_downloaded' };

  // Index says downloaded but the file is gone (external wipe, OS eviction):
  // clean the stale index row and fall back to streaming.
  let onDisk = false;
  try {
    onDisk = new File(entry.fileUri).exists;
  } catch {
    onDisk = false;
  }
  if (!onDisk) {
    removeFromIndex(db, videoId);
    return { status: 'not_downloaded' };
  }

  if (supabase) {
    const verdict = await checkDownloadEntitlement(supabase, videoId);
    if (verdict === 'revoked') {
      await deleteDownload(db, videoId);
      return {
        status: 'revoked',
        message: 'Your access to this video ended, so the offline download was removed.',
      };
    }
    // 'entitled' or 'offline' both play the local copy: the user was entitled
    // when they saved it and we could not prove otherwise.
  }

  return { status: 'play_local', fileUri: entry.fileUri, entry };
}

// Human-readable byte size for storage meters (honest empty state shows "0 B").
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
