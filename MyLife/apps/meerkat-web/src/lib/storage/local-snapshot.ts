import type {
  BackupEncoderInput,
  BackupEncoder,
  EncryptedBackupChunk,
} from '@mylife/sync/src/storage/backup-format';
import {
  assertSafeSnapshotBackupId,
  encodeSnapshotSource,
  SnapshotSourceError,
  type EncodedSnapshotSource,
} from './snapshot-encoder-core';
import {
  createBrowserDatabaseAdapter,
  type BrowserDatabaseAdapter,
  type DbBytesStore,
} from './browser-database-adapter';

const TRANSFER_MAGIC = new TextEncoder().encode('MKWEBB1\n');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const WEB_EXPLICIT_BACKUP_COPY =
  'Persistent browser storage is unavailable. Download this encrypted backup now, then use Upload backup to restore it later.';

export class WebLocalSnapshotError extends Error {
  readonly code: 'export_failed' | 'integrity_failed' | 'encode_failed' | 'fallback_invalid';
  readonly report?: string;

  constructor(code: WebLocalSnapshotError['code'], message: string, report?: string) {
    super(message);
    this.name = 'WebLocalSnapshotError';
    this.code = code;
    this.report = report;
  }
}

export interface WebSnapshotDatabase {
  flush(): Promise<void>;
  export(): Promise<Uint8Array>;
}

export interface WebSnapshotIntegrityChecker {
  check(bytes: Uint8Array): Promise<{ passed: boolean; report: string }>;
}

class MemorySnapshotBytesStore implements DbBytesStore {
  private bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = new Uint8Array(bytes);
  }

  async read(): Promise<Uint8Array> {
    return new Uint8Array(this.bytes);
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.bytes = new Uint8Array(bytes);
  }

  clear(): void {
    this.bytes.fill(0);
  }
}

export class SqlJsSnapshotIntegrityChecker implements WebSnapshotIntegrityChecker {
  async check(bytes: Uint8Array): Promise<{ passed: boolean; report: string }> {
    let database: BrowserDatabaseAdapter | null = null;
    const store = new MemorySnapshotBytesStore(bytes);
    try {
      database = await createBrowserDatabaseAdapter({
        bytesStore: store,
        persistDebounceMs: 0,
      });
      const rows = database.query<Record<string, unknown>>('PRAGMA integrity_check;');
      const reports = rows.flatMap((row) => Object.values(row))
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
      const report = reports.join('\n') || 'integrity_check returned no result';
      return { passed: reports.length === 1 && reports[0]?.toLowerCase() === 'ok', report };
    } finally {
      database?.close();
      store.clear();
    }
  }
}

export interface CreateWebLocalSnapshotInput {
  database: WebSnapshotDatabase;
  encoderInput: BackupEncoderInput;
  writeEncryptedChunk(chunk: EncryptedBackupChunk): Promise<void>;
  writeAdditionalObjects?: (encoder: BackupEncoder) => Promise<void>;
  chunkBytes?: number;
  integrityChecker?: WebSnapshotIntegrityChecker;
}

export interface WebLocalSnapshotResult extends EncodedSnapshotSource {
  integrityReport: string;
}

export async function createWebLocalSnapshot(
  input: CreateWebLocalSnapshotInput,
): Promise<WebLocalSnapshotResult> {
  try {
    assertSafeSnapshotBackupId(input.encoderInput.backupId);
  } catch (error) {
    throw new WebLocalSnapshotError(
      'encode_failed',
      error instanceof Error ? error.message : 'The snapshot backup id is invalid.',
    );
  }
  let bytes: Uint8Array;
  try {
    await input.database.flush();
    bytes = await input.database.export();
  } catch (error) {
    throw new WebLocalSnapshotError(
      'export_failed',
      error instanceof Error ? error.message : 'The browser database could not be exported.',
    );
  }
  try {
    const integrity = await (input.integrityChecker ?? new SqlJsSnapshotIntegrityChecker()).check(bytes);
    if (!integrity.passed) {
      throw new WebLocalSnapshotError(
        'integrity_failed',
        'The exported browser database failed integrity_check.',
        integrity.report,
      );
    }
    const encoded = await encodeSnapshotSource({
      source: {
        size: async () => bytes.length,
        read: async (offset, length) => bytes.subarray(offset, offset + length),
      },
      encoderInput: input.encoderInput,
      writeEncryptedChunk: input.writeEncryptedChunk,
      writeAdditionalObjects: input.writeAdditionalObjects,
      chunkBytes: input.chunkBytes,
    });
    return { ...encoded, integrityReport: integrity.report };
  } catch (error) {
    if (error instanceof WebLocalSnapshotError) throw error;
    if (error instanceof SnapshotSourceError) {
      throw new WebLocalSnapshotError('encode_failed', error.message);
    }
    throw new WebLocalSnapshotError(
      'encode_failed',
      error instanceof Error ? error.message : 'The browser snapshot could not be encoded.',
    );
  } finally {
    bytes.fill(0);
  }
}

export interface WebBackupTransferArtifact {
  path: string;
  bytes: Uint8Array;
}

interface TransferHeaderEntry {
  path: string;
  bytes: number;
}

function validTransferPath(path: string): boolean {
  return path.length > 0
    && path.length <= 500
    && !path.startsWith('/')
    && !path.split('/').some((part) => part === '' || part === '.' || part === '..');
}

export function createExplicitBackupDownload(
  artifacts: readonly WebBackupTransferArtifact[],
): Blob {
  const paths = new Set<string>();
  const header: TransferHeaderEntry[] = artifacts.map((artifact) => {
    if (!validTransferPath(artifact.path) || paths.has(artifact.path)) {
      throw new WebLocalSnapshotError('fallback_invalid', 'Backup download paths must be unique and safe.');
    }
    paths.add(artifact.path);
    return { path: artifact.path, bytes: artifact.bytes.length };
  });
  const headerBytes = encoder.encode(JSON.stringify(header));
  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, headerBytes.length, false);
  const blobPart = (bytes: Uint8Array): ArrayBuffer => {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return copy.buffer;
  };
  return new Blob(
    [
      blobPart(TRANSFER_MAGIC),
      blobPart(lengthBytes),
      blobPart(headerBytes),
      ...artifacts.map((artifact) => blobPart(artifact.bytes)),
    ],
    { type: 'application/vnd.mylife.meerkat-backup' },
  );
}

function equalMagic(bytes: Uint8Array): boolean {
  if (bytes.length < TRANSFER_MAGIC.length) return false;
  return TRANSFER_MAGIC.every((value, index) => bytes[index] === value);
}

export async function readExplicitBackupUpload(
  file: { arrayBuffer(): Promise<ArrayBuffer> },
): Promise<WebBackupTransferArtifact[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!equalMagic(bytes) || bytes.length < TRANSFER_MAGIC.length + 4) {
    throw new WebLocalSnapshotError('fallback_invalid', 'The uploaded file is not a Meerkat backup container.');
  }
  const headerOffset = TRANSFER_MAGIC.length + 4;
  const headerBytes = new DataView(bytes.buffer, bytes.byteOffset).getUint32(TRANSFER_MAGIC.length, false);
  if (headerBytes <= 0 || headerOffset + headerBytes > bytes.length) {
    throw new WebLocalSnapshotError('fallback_invalid', 'The backup upload header is truncated.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bytes.subarray(headerOffset, headerOffset + headerBytes))) as unknown;
  } catch {
    throw new WebLocalSnapshotError('fallback_invalid', 'The backup upload header is invalid.');
  }
  if (!Array.isArray(parsed)) {
    throw new WebLocalSnapshotError('fallback_invalid', 'The backup upload index is invalid.');
  }
  let offset = headerOffset + headerBytes;
  const paths = new Set<string>();
  const artifacts: WebBackupTransferArtifact[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new WebLocalSnapshotError('fallback_invalid', 'The backup upload entry is invalid.');
    }
    const value = entry as Record<string, unknown>;
    if (
      typeof value.path !== 'string'
      || !validTransferPath(value.path)
      || paths.has(value.path)
      || typeof value.bytes !== 'number'
      || !Number.isSafeInteger(value.bytes)
      || value.bytes < 0
      || offset + value.bytes > bytes.length
    ) {
      throw new WebLocalSnapshotError('fallback_invalid', 'The backup upload entry is malformed.');
    }
    paths.add(value.path);
    artifacts.push({ path: value.path, bytes: bytes.slice(offset, offset + value.bytes) });
    offset += value.bytes;
  }
  if (offset !== bytes.length) {
    throw new WebLocalSnapshotError('fallback_invalid', 'The backup upload contains trailing bytes.');
  }
  return artifacts;
}

export function webBackupFallbackStatus(persistent: boolean): {
  mode: 'persistent_destination' | 'explicit_download_upload';
  persistent: boolean;
  message: string | null;
} {
  return persistent
    ? { mode: 'persistent_destination', persistent: true, message: null }
    : { mode: 'explicit_download_upload', persistent: false, message: WEB_EXPLICIT_BACKUP_COPY };
}
