// file-save.ts: export ALREADY-DECRYPTED bytes to an OS save destination.
//
// Boundary (Critical, mirrors the CLAUDE.md honesty rules):
//   - This module ONLY ever receives plaintext bytes the user explicitly chose
//     to export (a decrypted share, a verified channel attachment blob). It
//     writes those bytes only to OS destinations the user picked (an Android SAF
//     tree) or to cacheDirectory for the iOS share sheet. It NEVER goes through
//     ExpoNodeStore (which holds sealed ciphertext) and NEVER touches a relay or
//     any transport. No new zero-knowledge surface is created here.
//   - "saved" is only returned after the OS write is VERIFIED on disk:
//     getInfoAsync(uri).exists === true (and size > 0 when bytes.length > 0).
//     Any throw or a missing/empty file becomes { kind: 'failed' } with the real
//     error string, so the UI can re-offer a destination instead of silently
//     dropping the file.
//   - iOS apps cannot programmatically write into the Files provider or confirm
//     it. On iOS "saved" means "wrote a verified cacheDirectory temp file and
//     opened the OS save sheet"; the copy must say exactly that and never assert
//     the user completed the Files save.
//
// All native module access lives behind the single injectable FileSaveAdapter
// boundary so the logic below is pure and Vitest-testable with a fake adapter.

import { decodeBase64, encodeBase64 } from 'tweetnacl-util';

/** Persisted setting key for the Android SAF default destination tree. */
export const FILE_SAVE_DIR_ANDROID = 'file_save_dir_android';

/** Result of the Android SAF directory permission request. */
export type SafDirectoryResult =
  | { granted: false }
  | { granted: true; directoryUri: string };

/** Info returned for a written uri so we can verify the write landed. */
export interface FileInfo {
  exists: boolean;
  size?: number;
}

/**
 * The single boundary to native file IO. Wraps only the
 * expo-file-system/legacy + expo-sharing calls this module needs, so tests can
 * inject a fake and never load a native module.
 */
export interface FileSaveAdapter {
  platformOS: 'ios' | 'android' | string;
  /** Absolute cacheDirectory uri, or null when the platform has none. */
  cacheDirectory: string | null;
  /** Absolute documentDirectory uri, or null when the platform has none. */
  documentDirectory: string | null;
  getInfoAsync(uri: string): Promise<FileInfo>;
  writeAsStringAsync(
    uri: string,
    contents: string,
    options: { encoding: 'base64' | 'utf8' },
  ): Promise<void>;
  /** Create a directory (recursive). Idempotent; resolves if it already exists. */
  makeDirectoryAsync(uri: string): Promise<void>;
  /** StorageAccessFramework.requestDirectoryPermissionsAsync (Android). */
  safRequestDirectory(initialUri?: string | null): Promise<SafDirectoryResult>;
  /** StorageAccessFramework.createFileAsync (Android). Returns the new file uri. */
  safCreateFile(parentUri: string, fileName: string, mimeType: string): Promise<string>;
  /** expo-sharing share sheet (iOS save-to-Files path). */
  share(uri: string, options: { mimeType?: string; dialogTitle?: string }): Promise<void>;
}

export interface SaveDestination {
  /** Persisted Android SAF tree uri, or null when none is configured. */
  androidTreeUri: string | null;
}

export interface SaveBytesInput {
  adapter: FileSaveAdapter;
  bytes: Uint8Array;
  name: string;
  mimeType: string;
  destination: SaveDestination;
}

export type FileSaveResult =
  | { kind: 'saved'; uri: string; location: 'files-app' | 'saf-folder' }
  | { kind: 'cancelled' }
  | { kind: 'no-destination' }
  | { kind: 'failed'; reason: string };

const DEFAULT_FILENAME = 'meerkat-file';
const FALLBACK_MIME = 'application/octet-stream';

/**
 * Sanitize a user/attachment-supplied name for use as an OS filename. Strips
 * path separators and unsafe characters (matching expo-blob-store's safeFilename
 * rule) and falls back to a stable default for empty/blank input.
 */
export function safeSaveFilename(name: string, fallback = DEFAULT_FILENAME): string {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 120) || fallback;
}

/** Base64-encode bytes for the legacy writeAsStringAsync Base64 encoding. */
export function bytesToBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

/** Inverse of bytesToBase64, exposed so tests can assert a round-trip. */
export function base64ToBytes(base64: string): Uint8Array {
  return decodeBase64(base64);
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/**
 * Write already-decrypted bytes to a real OS destination and CONFIRM the write
 * landed before reporting success.
 *
 * Android: if a persisted SAF tree is configured, create a file under it, write
 * the Base64 bytes, then getInfoAsync the produced uri and require exists===true
 * (size>0 for non-empty bytes). No tree -> 'no-destination' so the caller can
 * prompt the picker. A stale/revoked tree (createFile/write throws, or the file
 * never lands) -> 'failed' with the real error string.
 *
 * iOS: write a verified temp file under cacheDirectory, then open the OS share
 * sheet so the user can tap "Save to Files". iOS cannot confirm the Files write,
 * so 'saved' here only ever means "verified temp file + opened the save sheet".
 */
export async function saveBytesToDestination(input: SaveBytesInput): Promise<FileSaveResult> {
  const { adapter, bytes, destination } = input;
  const fileName = safeSaveFilename(input.name);
  const mimeType = input.mimeType?.trim() || FALLBACK_MIME;

  if (adapter.platformOS === 'android') {
    const treeUri = destination.androidTreeUri?.trim() || null;
    if (!treeUri) return { kind: 'no-destination' };
    let fileUri: string;
    try {
      // createFileAsync wants the name WITHOUT the extension; the mime type
      // drives the extension the OS appends, so pass the bare sanitized name.
      const baseName = fileName.replace(/\.[^.]+$/, '') || DEFAULT_FILENAME;
      fileUri = await adapter.safCreateFile(treeUri, baseName, mimeType);
      await adapter.writeAsStringAsync(fileUri, bytesToBase64(bytes), { encoding: 'base64' });
    } catch (err) {
      return { kind: 'failed', reason: errorMessage(err, 'Could not write to the saved folder.') };
    }
    return verifyWrite(adapter, fileUri, bytes, 'saf-folder');
  }

  // iOS and any non-Android platform: temp file + share sheet.
  const cacheDir = adapter.cacheDirectory;
  if (!cacheDir) {
    return { kind: 'failed', reason: 'No cache directory is available to stage the file.' };
  }
  const tempUri = `${cacheDir}${cacheDir.endsWith('/') ? '' : '/'}${fileName}`;
  try {
    await adapter.writeAsStringAsync(tempUri, bytesToBase64(bytes), { encoding: 'base64' });
  } catch (err) {
    return { kind: 'failed', reason: errorMessage(err, 'Could not stage the file for saving.') };
  }
  const verified = await verifyWrite(adapter, tempUri, bytes, 'files-app');
  if (verified.kind !== 'saved') return verified;
  try {
    await adapter.share(tempUri, { mimeType, dialogTitle: fileName });
  } catch (err) {
    return { kind: 'failed', reason: errorMessage(err, 'Could not open the save sheet.') };
  }
  return verified;
}

async function verifyWrite(
  adapter: FileSaveAdapter,
  uri: string,
  bytes: Uint8Array,
  location: 'files-app' | 'saf-folder',
): Promise<FileSaveResult> {
  let info: FileInfo;
  try {
    info = await adapter.getInfoAsync(uri);
  } catch (err) {
    return { kind: 'failed', reason: errorMessage(err, 'Could not verify the saved file.') };
  }
  if (!info.exists) {
    // The write call returned without throwing but no file is on disk: a silent
    // failure we must never report as 'saved'.
    return { kind: 'failed', reason: 'The file did not land on disk after writing.' };
  }
  if (bytes.length > 0 && (info.size ?? 0) <= 0) {
    return { kind: 'failed', reason: 'The saved file is empty.' };
  }
  return { kind: 'saved', uri, location };
}

/**
 * The folder name (under documentDirectory) where iOS bulk exports land. With
 * UIFileSharingEnabled + LSSupportsOpeningDocumentsInPlace set in app.json, the
 * app's documents folder is browsable in the Files app under "On My iPhone >
 * Meerkat", so this is a real, user-reachable destination -- no per-file share
 * sheet, no false "saved to Files" claim.
 */
export const IOS_BULK_EXPORT_FOLDER = 'Meerkat Exports';

export interface SaveBytesToDocumentsInput {
  adapter: FileSaveAdapter;
  bytes: Uint8Array;
  name: string;
  /** Subfolder under the export folder, e.g. a sanitized community name. */
  subfolder?: string;
}

/**
 * Write already-decrypted bytes into the app's Files-visible documents folder
 * (documentDirectory/Meerkat Exports[/subfolder]) and CONFIRM the write landed before
 * reporting success. Used by the iOS bulk export so N files land in one pass
 * without opening N share sheets and without claiming a Files save we cannot
 * confirm: the file is genuinely written and verified on disk, and the folder is
 * reachable in the Files app.
 *
 * Returns 'saved' with location 'files-app' (the documents folder is the iOS
 * Files surface), 'failed' with a real reason on any error, or 'failed' when no
 * documentDirectory exists. Never opens a share sheet.
 */
export async function saveBytesToDocuments(
  input: SaveBytesToDocumentsInput,
): Promise<FileSaveResult> {
  const { adapter, bytes } = input;
  const fileName = safeSaveFilename(input.name);
  const docDir = adapter.documentDirectory;
  if (!docDir) {
    return { kind: 'failed', reason: 'No documents folder is available to save into.' };
  }
  const base = docDir.endsWith('/') ? docDir : `${docDir}/`;
  const sub = input.subfolder ? `${safeSaveFilename(input.subfolder)}/` : '';
  const folder = `${base}${IOS_BULK_EXPORT_FOLDER}/${sub}`;
  const fileUri = `${folder}${fileName}`;
  try {
    await adapter.makeDirectoryAsync(folder);
    await adapter.writeAsStringAsync(fileUri, bytesToBase64(bytes), { encoding: 'base64' });
  } catch (err) {
    return { kind: 'failed', reason: errorMessage(err, 'Could not save into the Files folder.') };
  }
  return verifyWrite(adapter, fileUri, bytes, 'files-app');
}

export interface RequestSafDestinationInput {
  adapter: FileSaveAdapter;
  /** Reads the currently persisted tree uri (for the SAF picker initial dir). */
  getCurrent: () => string | null;
  /** Persists the granted tree uri under FILE_SAVE_DIR_ANDROID. */
  persist: (directoryUri: string) => void;
}

/**
 * Open the Android SAF folder picker and, on grant, persist the chosen tree uri.
 * Returns the granted uri, or null when the user cancelled (granted: false). A
 * cancelled picker NEVER writes the setting.
 */
export async function requestAndPersistSafDestination(
  input: RequestSafDestinationInput,
): Promise<string | null> {
  const result = await input.adapter.safRequestDirectory(input.getCurrent());
  if (!result.granted) return null;
  input.persist(result.directoryUri);
  return result.directoryUri;
}
