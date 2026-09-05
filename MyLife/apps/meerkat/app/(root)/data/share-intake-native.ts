// share-intake-native.ts: the device glue that turns an incoming OS share
// (expo-share-intent) into DEVICE-LOCAL staged rows (Plan 20, Phase 9).
//
// What the OS hands us (via expo-share-intent's ShareIntent):
//   - inline text and/or a web URL, and/or
//   - one or more files, each a { fileName, mimeType, path, size } tuple whose
//     bytes already sit in the iOS App-Group container / Android cache.
//
// What this does, honestly:
//   1. RE-SNIFFS every file's real bytes with the engine's magic-byte sniffer
//      (normalizeSharedItem). The sender-declared mimeType is NEVER trusted for
//      classification -- a file lying that a PNG is text/plain is filed as an
//      image. Oversized items are rejected with a plain reason, not dropped.
//   2. Copies the bytes into the EXISTING content-addressed blob store, so a
//      staged file references a real on-device blob hash (never a fabricated one).
//   3. Stages one mk_share_intake row + its mk_share_payload rows through the
//      SHIPPED engine (stageShareIntake). These are device-local by construction
//      (mk_ prefix, outside MEERKAT_SYNC_PREFIXES) and never replicate. A staged
//      item is NOT "sent" -- routing it (share-route.ts) writes the real row.
//
// The native module is lazy-loaded exactly like data/lan-backend.ts: absent in
// Expo Go / a build without expo-share-intent, in which case reading is a no-op
// and the app still boots. The read + copy IO is injected so the re-sniff and
// staging core is testable with no React Native (see share-route.test.ts).

import type { DatabaseAdapter } from '@mylife/db';
import {
  bytesToHex,
  generateSyncRandomBytes,
  normalizeSharedItem,
  stageShareIntake,
  sweepExpiredShareIntakes,
  DEFAULT_SHARE_MAX_BYTES,
  type RawSharedItem,
  type ShareSource,
  type StagePayloadInput,
} from '@mylife/sync';
import { COMMUNITY_MODULE_ID } from './community-core';
import type { ExpoBlobStore } from './expo-blob-store';

// ExpoBlobStore pulls expo-file-system (and thus react-native), which the Node
// test env cannot parse. It is lazy-required only inside the real device-IO
// paths below so the ingest + sweep CORE stays importable under Node/Vitest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadBlobStore = (db: DatabaseAdapter): ExpoBlobStore =>
  new (require('./expo-blob-store') as { ExpoBlobStore: new (db: DatabaseAdapter) => ExpoBlobStore }).ExpoBlobStore(db);

/** A staged intake is kept for a week, then a foreground sweep removes it + orphaned bytes. */
export const SHARE_INTAKE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The expo-share-intent ShareIntent shape we consume (a structural subset so we
// never depend on the native package's types at compile time; the runtime object
// carries exactly these fields).
export interface IncomingShareFile {
  fileName?: string | null;
  mimeType?: string | null;
  path: string;
  size?: number | null;
}
export interface IncomingShareIntent {
  text?: string | null;
  webUrl?: string | null;
  files?: IncomingShareFile[] | null;
}

/** Reads a shared file's real bytes (default: expo-file-system, lazy). */
export type ReadFileBytesFn = (path: string) => Promise<Uint8Array>;
/** Stores bytes content-addressed and returns the real blob hash (default: ExpoBlobStore). */
export type PutBlobFn = (
  bytes: Uint8Array,
  mimeType: string | null,
) => Promise<{ hash: string }>;

export interface IngestShareIntentDeps {
  db: DatabaseAdapter;
  shareIntent: IncomingShareIntent;
  source: ShareSource;
  readFileBytes: ReadFileBytesFn;
  putBlob: PutBlobFn;
  maxBytes?: number;
  now?: () => Date;
  makeId?: () => string;
}

export interface IngestShareIntentResult {
  itemId: string | null;
  staged: number;
  errors: string[];
}

let idCounter = 0;
function defaultMakeId(): string {
  idCounter += 1;
  return `shr_${Date.now().toString(36)}_${idCounter.toString(36)}_${bytesToHex(generateSyncRandomBytes(6))}`;
}

/**
 * Normalize + stage one incoming share. Pure over its injected IO: text/url are
 * classified inline; each file is read, RE-SNIFFED (bytes beat declaredMime),
 * size-guarded, copied into the blob store, and staged. Returns the number of
 * staged payloads and any per-item reasons (oversized / unreadable), never
 * throwing so one bad file cannot sink the batch.
 */
export async function ingestShareIntent(
  deps: IngestShareIntentDeps,
): Promise<IngestShareIntentResult> {
  const { db, shareIntent, source, readFileBytes, putBlob } = deps;
  const maxBytes = deps.maxBytes ?? DEFAULT_SHARE_MAX_BYTES;
  const now = deps.now ?? (() => new Date());
  const makeId = deps.makeId ?? defaultMakeId;

  const errors: string[] = [];
  const payloads: StagePayloadInput[] = [];

  // Inline text / web url.
  const inlineText = shareIntent.webUrl?.trim() || shareIntent.text?.trim() || '';
  if (inlineText) {
    const result = normalizeSharedItem({ text: inlineText });
    if (result.ok) payloads.push({ id: makeId(), ...result.payload });
    else errors.push(result.reason);
  }

  // Files: read the REAL bytes, re-sniff, copy into the blob store, stage.
  for (const file of shareIntent.files ?? []) {
    let bytes: Uint8Array;
    try {
      bytes = await readFileBytes(file.path);
    } catch (err) {
      errors.push(
        `${file.fileName ?? 'A shared file'} could not be read: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const raw: RawSharedItem = {
      bytes,
      declaredMime: file.mimeType ?? undefined,
      filename: file.fileName ?? undefined,
    };
    const result = normalizeSharedItem(raw, { maxBytes });
    if (!result.ok) {
      errors.push(result.reason);
      continue;
    }

    // The re-sniffed MIME (bytes win over the sender's declaredMime) is what we
    // persist and what tags the stored blob.
    let blobHash: string;
    try {
      const stored = await putBlob(bytes, result.payload.mime ?? null);
      blobHash = stored.hash;
    } catch (err) {
      errors.push(
        `${file.fileName ?? 'A shared file'} could not be stored: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    payloads.push({ id: makeId(), ...result.payload, blobHash });
  }

  if (payloads.length === 0) return { itemId: null, staged: 0, errors };

  const createdAt = now();
  const itemId = makeId();
  stageShareIntake(db, {
    id: itemId,
    source,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + SHARE_INTAKE_TTL_MS).toISOString(),
    payloads,
  });

  return { itemId, staged: payloads.length, errors };
}

/**
 * The real IO for a device build: read shared bytes with expo-file-system and
 * store them through the community blob store (content-addressed, so a re-share
 * of the same bytes is deduped). Lazy-required so Node/test paths and Expo Go
 * never touch the native modules.
 */
export function createDefaultShareIntakeIo(db: DatabaseAdapter): {
  readFileBytes: ReadFileBytesFn;
  putBlob: PutBlobFn;
} {
  const blobStore = loadBlobStore(db);
  return {
    readFileBytes: async (path: string) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy') as {
        readAsStringAsync: (uri: string, opts?: { encoding?: string }) => Promise<string>;
        EncodingType: { Base64: string };
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { decodeBase64 } = require('tweetnacl-util') as {
        decodeBase64: (s: string) => Uint8Array;
      };
      const base64 = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return decodeBase64(base64);
    },
    putBlob: async (bytes: Uint8Array, mimeType: string | null) => {
      const stored = await blobStore.putLocal(bytes, {
        moduleId: COMMUNITY_MODULE_ID,
        mimeType,
      });
      return { hash: stored.hash };
    },
  };
}

/**
 * Read a pending native share and stage it. Returns a no-op result when
 * expo-share-intent's native module is absent (Expo Go / a build without it) so
 * the caller (the foreground watcher) never crashes.
 *
 * Note: on iOS the App-Group inbox read is driven by the app-scheme deep link
 * that the Share Extension opens; the watcher passes the ShareIntent surfaced by
 * expo-share-intent's provider. This helper only owns the normalize + stage step
 * so it stays testable. Device QA (real Share Extension + App Group) is
 * founder-ops; this is real code but not exercisable in Expo Go.
 */
export async function ingestNativeShareIntent(
  db: DatabaseAdapter,
  shareIntent: IncomingShareIntent,
  source: ShareSource,
): Promise<IngestShareIntentResult> {
  return ingestShareIntent({ db, shareIntent, source, ...createDefaultShareIntakeIo(db) });
}

/**
 * Foreground cleanup: sweep expired / discarded staged intakes and unpin the
 * blob bytes no live payload still references. Idempotent and safe to call on
 * every Share Inbox focus. `unpinBlob` is injected (default: ExpoBlobStore) so
 * the sweep is testable; unpin failures are swallowed (a leftover blob is
 * harmless and will be retried next sweep).
 */
export async function runShareIntakeSweep(
  db: DatabaseAdapter,
  unpinBlob?: (hash: string) => Promise<void>,
  nowIso: string = new Date().toISOString(),
): Promise<{ removedIntakeIds: string[]; unpinnedHashes: string[] }> {
  const { removedIntakeIds, orphanedBlobHashes } = sweepExpiredShareIntakes(db, nowIso);
  if (orphanedBlobHashes.length === 0) {
    return { removedIntakeIds, unpinnedHashes: [] };
  }

  const unpin =
    unpinBlob ??
    (async (hash: string) => {
      await loadBlobStore(db).removeLocal(hash);
    });

  const unpinnedHashes: string[] = [];
  for (const hash of orphanedBlobHashes) {
    try {
      await unpin(hash);
      unpinnedHashes.push(hash);
    } catch {
      // A blob we could not unpin is harmless; the next sweep retries it.
    }
  }
  return { removedIntakeIds, unpinnedHashes };
}
