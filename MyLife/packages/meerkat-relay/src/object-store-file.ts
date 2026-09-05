/**
 * Crash-safe, cross-process MeerkatObjectStore for self-host file mode.
 *
 * Bytes live as INDIVIDUAL CONTENT FILES on disk; the JSON ledger holds METADATA
 * ONLY. This is the package's own byte convention (FileSeederPieceStore stores
 * {baseDir}/{infoHash}/{index}), and it is the only shape that survives real archive
 * pieces and hosted media: a metadata-only ledger keeps every mutation O(one row)
 * rather than O(entire store), never loads the whole store into a JSON string, and
 * turns a multi-GB upload into a streamed write of one object file, not hundreds of
 * full-ledger rewrites.
 *
 * On-disk layout under baseDir:
 *  - object-store.json         the metadata ledger (rows: key, checksum, sizeBytes,
 *                              versionCounter, state, byte-file name); replaced
 *                              atomically under an exclusive lock. A corrupt ledger
 *                              fails closed and is never read as an empty store.
 *  - objects/<hash-of-key>     the durable/quarantined byte file for a key.
 *  - pending/<uploadId>/<n>    one file per multipart part.
 *  - *.tmp                     temp files for the temp+rename atomic writes.
 *
 * Crash-safety ordering (the invariant WP-2C reconciliation depends on):
 *  - WRITE: the byte file lands FULLY (temp + fsync + rename) BEFORE the ledger row
 *    references it. A crash may leave an orphan byte file with no ledger row (a
 *    sweepable orphan) but NEVER a ledger row pointing at missing or partial bytes.
 *  - DELETE: the ledger row is removed FIRST, then the byte file is unlinked. A crash
 *    between the two leaves another sweepable orphan, never a dangling reference.
 *  - PROMOTE: the durable byte file is written (linked/renamed) and re-verified by a
 *    streaming hash BEFORE the ledger flips the key to durable; the old quarantine row
 *    is dropped in the same ledger write.
 *
 * Whole-object checksums are computed by STREAMING hash (createHash fed a read stream),
 * never by buffering the whole object, so a multi-GB object is verified with bounded
 * memory. read() still returns full bytes to honor the contract shape, but observe and
 * listInventory touch the metadata ledger only.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import {
  assertInventoryLimit,
  assertMultipartPartList,
  assertObjectChecksum,
  assertObjectKey,
  assertObjectKeyPrefix,
  assertObjectSizeBytes,
  assertPartNumber,
  assertUploadId,
  OBJECT_STORE_MIN_PART_BYTES,
  type MeerkatObjectStore,
  type ObjectAppendPartInput,
  type ObjectAppendPartResult,
  type ObjectBeginMultipartInput,
  type ObjectCompleteMultipartInput,
  type ObjectCompleteMultipartResult,
  type ObjectDeletionReceipt,
  type ObjectFinalizeResult,
  type ObjectInventoryCursor,
  type ObjectInventoryPage,
  type ObjectMultipartUpload,
  type ObjectObservation,
  type ObjectPromoteInput,
  type ObjectPromoteResult,
  type ObjectPutInput,
  type ObjectReadResult,
  type ObjectState,
} from './object-store';

/** A metadata row: everything about an object except its bytes. */
interface ObjectMetadataRow {
  key: string;
  checksumSha256: string;
  sizeBytes: number;
  versionCounter: number;
  state: ObjectState;
  /** Byte-file name relative to objects/, or null for a rejected row that stores no bytes. */
  byteFile: string | null;
}

/** The metadata-only ledger. Bytes never appear here. */
export interface ObjectMetadataLedger {
  version: 1;
  objects: Record<string, ObjectMetadataRow>;
  /** Monotonic per-key version counter that survives delete+rewrite of the same key. */
  versionCounters: Record<string, number>;
}

function emptyMetadataLedger(): ObjectMetadataLedger {
  return { version: 1, objects: {}, versionCounters: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLedger(value: unknown): asserts value is ObjectMetadataLedger {
  if (!isRecord(value) || value.version !== 1
    || !isRecord(value.objects) || !isRecord(value.versionCounters)) {
    throw new Error('FileObjectStore: object ledger is corrupt');
  }
}

function versionToken(counter: number): string {
  return `v${counter}`;
}

function byteFileName(key: string): string {
  // A content-neutral, filesystem-safe name derived from the object key. Two keys can
  // never collide (sha256), and no key character leaks into a path.
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function observationOf(row: ObjectMetadataRow): ObjectObservation {
  return {
    key: row.key,
    checksumSha256: row.checksumSha256,
    sizeBytes: row.sizeBytes,
    versionId: versionToken(row.versionCounter),
    state: row.state,
  };
}

export class FileObjectStore implements MeerkatObjectStore {
  private readonly ledgerFile: string;
  private readonly lockFile: string;
  private readonly objectsDir: string;
  private readonly pendingDir: string;
  private readonly tmpDir: string;

  constructor(baseDir: string) {
    this.ledgerFile = path.join(baseDir, 'object-store.json');
    this.lockFile = path.join(baseDir, '.object-store.lock');
    this.objectsDir = path.join(baseDir, 'objects');
    this.pendingDir = path.join(baseDir, 'pending');
    this.tmpDir = path.join(baseDir, 'tmp');
  }

  // --- ledger + byte-file primitives ---------------------------------------

  private async readLedger(): Promise<ObjectMetadataLedger> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.ledgerFile, 'utf8'));
      validateLedger(parsed);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyMetadataLedger();
      if (error instanceof SyntaxError) {
        throw new Error('FileObjectStore: object ledger is corrupt', { cause: error });
      }
      throw error;
    }
  }

  private async writeLedger(ledger: ObjectMetadataLedger): Promise<void> {
    await fs.mkdir(path.dirname(this.ledgerFile), { recursive: true });
    const tmp = path.join(this.tmpDir, `ledger.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    await fs.mkdir(this.tmpDir, { recursive: true });
    const handle = await fs.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(ledger), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.ledgerFile);
  }

  private objectPath(byteFile: string): string {
    return path.join(this.objectsDir, byteFile);
  }

  /** Streams bytes to a temp file with fsync, returning the sha256 hex it observed. */
  private async writeBytesFile(byteFile: string, bytes: Uint8Array): Promise<string> {
    await fs.mkdir(this.objectsDir, { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    const tmp = path.join(this.tmpDir, `obj.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const handle = await fs.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const checksum = await hashFile(tmp);
    await fs.rename(tmp, this.objectPath(byteFile));
    return checksum;
  }

  private async removeBytesFile(byteFile: string | null): Promise<void> {
    if (!byteFile) return;
    await fs.rm(this.objectPath(byteFile), { force: true });
  }

  private withLock<T>(operation: () => Promise<T>): Promise<T> {
    return withExclusiveFileLock(this.lockFile, operation, { timeoutMs: 30_000 });
  }

  private nextVersion(ledger: ObjectMetadataLedger, key: string): number {
    const next = (ledger.versionCounters[key] ?? 0) + 1;
    ledger.versionCounters[key] = next;
    return next;
  }

  // --- write path ----------------------------------------------------------

  put(input: ObjectPutInput): Promise<ObjectFinalizeResult> {
    assertObjectKey('object key', input.key);
    assertObjectChecksum('object checksum', input.checksumSha256);
    const bytes = Uint8Array.from(input.bytes);
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const byteFile = byteFileName(input.key);
      // Byte file lands fully (fsync + rename) before the ledger references it.
      const actual = await this.writeBytesFile(byteFile, bytes);
      if (actual !== input.checksumSha256) {
        // A mismatch never becomes observable bytes: drop the file and record a
        // bytes-free rejected row so a serve/promote path can never pick it up.
        await this.removeBytesFile(byteFile);
        const row: ObjectMetadataRow = {
          key: input.key,
          checksumSha256: actual,
          sizeBytes: bytes.length,
          versionCounter: this.nextVersion(ledger, input.key),
          state: 'rejected',
          byteFile: null,
        };
        ledger.objects[input.key] = row;
        await this.writeLedger(ledger);
        return { status: 'checksum_mismatch', object: observationOf(row) };
      }
      const row: ObjectMetadataRow = {
        key: input.key,
        checksumSha256: actual,
        sizeBytes: bytes.length,
        versionCounter: this.nextVersion(ledger, input.key),
        state: 'quarantined',
        byteFile,
      };
      ledger.objects[input.key] = row;
      await this.writeLedger(ledger);
      return { status: 'stored', object: observationOf(row) };
    });
  }

  beginMultipart(input: ObjectBeginMultipartInput): Promise<ObjectMultipartUpload> {
    assertObjectKey('object key', input.key);
    assertObjectChecksum('object checksum', input.checksumSha256);
    assertObjectSizeBytes('object bytes', input.sizeBytes);
    return this.withLock(async () => {
      const uploadId = createHash('sha256')
        .update(`${input.key} ${input.checksumSha256} ${process.pid} ${Date.now()} ${Math.random()}`)
        .digest('hex')
        .slice(0, 32);
      await fs.mkdir(this.partsDir(uploadId), { recursive: true });
      // The upload's target metadata rides in a small manifest so appendPart/complete
      // on a DIFFERENT instance (same volume) still know the key + whole-object target.
      await this.writePartManifest(uploadId, {
        key: input.key,
        checksumSha256: input.checksumSha256,
        sizeBytes: input.sizeBytes,
      });
      return {
        key: input.key,
        uploadId,
        checksumSha256: input.checksumSha256,
        sizeBytes: input.sizeBytes,
      };
    });
  }

  appendPart(input: ObjectAppendPartInput): Promise<ObjectAppendPartResult> {
    assertObjectKey('object key', input.key);
    assertUploadId('upload id', input.uploadId);
    assertPartNumber('part number', input.partNumber);
    assertObjectChecksum('part checksum', input.checksumSha256);
    const bytes = Uint8Array.from(input.bytes);
    return this.withLock(async () => {
      const manifest = await this.readPartManifest(input.uploadId);
      if (!manifest || manifest.key !== input.key) return { status: 'unknown_upload' };
      if (objectChecksumBytes(bytes) !== input.checksumSha256) return { status: 'checksum_mismatch' };
      const existing = await this.listParts(input.uploadId);
      // A non-final part below the multipart floor cannot be assembled by S3, so reject
      // it here: a part is "non-final" once a higher-numbered part exists, and any
      // already-present lower part must also meet the floor.
      const higherExists = existing.some((number) => number > input.partNumber);
      if (higherExists && bytes.length < OBJECT_STORE_MIN_PART_BYTES) {
        return { status: 'part_too_small' };
      }
      for (const number of existing) {
        if (number < input.partNumber) {
          const size = (await fs.stat(this.partPath(input.uploadId, number))).size;
          if (size < OBJECT_STORE_MIN_PART_BYTES) return { status: 'part_too_small' };
        }
      }
      await this.writePartFile(input.uploadId, input.partNumber, bytes);
      return {
        status: 'appended',
        part: { partNumber: input.partNumber, checksumSha256: input.checksumSha256, sizeBytes: bytes.length },
      };
    });
  }

  completeMultipart(input: ObjectCompleteMultipartInput): Promise<ObjectCompleteMultipartResult> {
    assertObjectKey('object key', input.key);
    assertUploadId('upload id', input.uploadId);
    assertMultipartPartList(input.parts);
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const manifest = await this.readPartManifest(input.uploadId);
      if (!manifest || manifest.key !== input.key) {
        // Replay after the pending upload is consumed resolves to the object it produced
        // when that object is still present and not rejected, so a client retry after a
        // lost response is idempotent rather than a hard failure.
        const existing = ledger.objects[input.key];
        if (existing && existing.state !== 'rejected') {
          return { status: 'stored', object: observationOf(existing) };
        }
        return { status: 'unknown_upload' };
      }
      // Assemble the declared parts into one object file by streaming each part in
      // order, hashing incrementally so the whole object is never buffered.
      const byteFile = byteFileName(input.key);
      const assembly = await this.assembleParts(input.uploadId, input.parts, byteFile);
      if (assembly.status === 'missing_parts') {
        return { status: 'missing_parts' };
      }
      const finalize = async (state: 'rejected' | 'quarantined'): Promise<ObjectMetadataRow> => {
        if (state === 'rejected') await this.removeBytesFile(byteFile);
        const row: ObjectMetadataRow = {
          key: input.key,
          checksumSha256: assembly.checksum,
          sizeBytes: assembly.sizeBytes,
          versionCounter: this.nextVersion(ledger, input.key),
          state,
          byteFile: state === 'rejected' ? null : byteFile,
        };
        ledger.objects[input.key] = row;
        await this.writeLedger(ledger);
        await this.discardUpload(input.uploadId);
        return row;
      };
      if (assembly.sizeBytes !== manifest.sizeBytes) {
        return { status: 'size_mismatch', object: observationOf(await finalize('rejected')) };
      }
      if (assembly.checksum !== manifest.checksumSha256) {
        return { status: 'checksum_mismatch', object: observationOf(await finalize('rejected')) };
      }
      return { status: 'stored', object: observationOf(await finalize('quarantined')) };
    });
  }

  // --- promote -------------------------------------------------------------

  promote(input: ObjectPromoteInput): Promise<ObjectPromoteResult> {
    assertObjectKey('quarantine key', input.quarantineKey);
    assertObjectKey('durable key', input.durableKey);
    assertObjectChecksum('expected checksum', input.expectedChecksumSha256);
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const source = ledger.objects[input.quarantineKey];
      const durable = ledger.objects[input.durableKey];
      if (!source || source.state === 'rejected') {
        if (durable && durable.state === 'durable'
          && durable.checksumSha256 === input.expectedChecksumSha256) {
          return { status: 'promoted', object: observationOf(durable) };
        }
        return { status: 'source_missing' };
      }
      if (source.state !== 'quarantined') {
        if (durable && durable.state === 'durable'
          && durable.checksumSha256 === input.expectedChecksumSha256) {
          return { status: 'promoted', object: observationOf(durable) };
        }
        return { status: 'source_not_quarantined' };
      }
      const sourceFile = source.byteFile;
      if (!sourceFile) return { status: 'source_missing' };
      // Re-verify the quarantined bytes by streaming hash before anything durable is
      // written; a mismatch leaves the durable key untouched.
      const observed = await hashFile(this.objectPath(sourceFile));
      if (observed !== input.expectedChecksumSha256) return { status: 'checksum_mismatch' };
      // Write the durable byte file (a fresh copy under the durable key's name) and
      // re-verify it before the ledger flips to durable.
      const durableFile = byteFileName(input.durableKey);
      await this.copyBytesFile(sourceFile, durableFile);
      const durableObserved = await hashFile(this.objectPath(durableFile));
      if (durableObserved !== input.expectedChecksumSha256) {
        await this.removeBytesFile(durableFile);
        return { status: 'checksum_mismatch' };
      }
      const row: ObjectMetadataRow = {
        key: input.durableKey,
        checksumSha256: source.checksumSha256,
        sizeBytes: source.sizeBytes,
        versionCounter: this.nextVersion(ledger, input.durableKey),
        state: 'durable',
        byteFile: durableFile,
      };
      ledger.objects[input.durableKey] = row;
      delete ledger.objects[input.quarantineKey];
      // Ledger flips first (durable now references its own file); then the old
      // quarantine byte file is unlinked. A crash between leaves a sweepable orphan.
      await this.writeLedger(ledger);
      await this.removeBytesFile(sourceFile);
      return { status: 'promoted', object: observationOf(row) };
    });
  }

  // --- read path -----------------------------------------------------------

  observe(key: string): Promise<ObjectObservation | null> {
    assertObjectKey('object key', key);
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const row = ledger.objects[key];
      return row ? observationOf(row) : null;
    });
  }

  read(key: string): Promise<ObjectReadResult | null> {
    assertObjectKey('object key', key);
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const row = ledger.objects[key];
      if (!row || !row.byteFile) return null;
      const bytes = new Uint8Array(await fs.readFile(this.objectPath(row.byteFile)));
      return { object: observationOf(row), bytes };
    });
  }

  deleteObject(key: string): Promise<ObjectDeletionReceipt> {
    assertObjectKey('object key', key);
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const row = ledger.objects[key];
      if (!row) {
        return { key, versionId: versionToken(ledger.versionCounters[key] ?? 0), deleted: true };
      }
      const versionId = versionToken(row.versionCounter);
      const byteFile = row.byteFile;
      delete ledger.objects[key];
      // Ledger row removed first, byte file unlinked second: a crash between leaves a
      // sweepable orphan byte file, never a ledger row pointing at absent bytes.
      await this.writeLedger(ledger);
      await this.removeBytesFile(byteFile);
      return { key, versionId, deleted: true };
    });
  }

  listInventory(input: {
    after?: ObjectInventoryCursor;
    prefix?: string;
    limit: number;
  }): Promise<ObjectInventoryPage> {
    assertInventoryLimit(input.limit);
    if (input.after) assertObjectKey('inventory cursor key', input.after.key);
    if (input.prefix !== undefined) assertObjectKeyPrefix('inventory prefix', input.prefix);
    const prefix = input.prefix ?? '';
    return this.withLock(async () => {
      const ledger = await this.readLedger();
      const rows = Object.values(ledger.objects)
        .sort((a, b) => a.key.localeCompare(b.key))
        .filter((row) => (prefix === '' || row.key.startsWith(prefix))
          && (!input.after || row.key > input.after.key));
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        entries: page.map((row) => ({
          key: row.key,
          checksumSha256: row.checksumSha256,
          sizeBytes: row.sizeBytes,
          versionId: versionToken(row.versionCounter),
          state: row.state,
        })),
        nextCursor: rows.length > page.length && last ? { key: last.key } : null,
      };
    });
  }

  // --- multipart part storage ---------------------------------------------

  private partsDir(uploadId: string): string {
    return path.join(this.pendingDir, uploadId);
  }

  private partPath(uploadId: string, partNumber: number): string {
    return path.join(this.partsDir(uploadId), `part-${partNumber}`);
  }

  private partManifestPath(uploadId: string): string {
    return path.join(this.partsDir(uploadId), 'upload.json');
  }

  private async writePartManifest(
    uploadId: string,
    manifest: { key: string; checksumSha256: string; sizeBytes: number },
  ): Promise<void> {
    await fs.mkdir(this.partsDir(uploadId), { recursive: true });
    await fs.writeFile(this.partManifestPath(uploadId), JSON.stringify(manifest), 'utf8');
  }

  private async readPartManifest(
    uploadId: string,
  ): Promise<{ key: string; checksumSha256: string; sizeBytes: number } | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.partManifestPath(uploadId), 'utf8')) as {
        key?: unknown; checksumSha256?: unknown; sizeBytes?: unknown;
      };
      if (typeof parsed.key === 'string' && typeof parsed.checksumSha256 === 'string'
        && typeof parsed.sizeBytes === 'number') {
        return { key: parsed.key, checksumSha256: parsed.checksumSha256, sizeBytes: parsed.sizeBytes };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async listParts(uploadId: string): Promise<number[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.partsDir(uploadId));
    } catch {
      return [];
    }
    return entries
      .filter((name) => name.startsWith('part-'))
      .map((name) => Number(name.slice('part-'.length)))
      .filter((number) => Number.isSafeInteger(number))
      .sort((a, b) => a - b);
  }

  private async writePartFile(uploadId: string, partNumber: number, bytes: Uint8Array): Promise<void> {
    await fs.mkdir(this.partsDir(uploadId), { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    const tmp = path.join(this.tmpDir, `part.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const handle = await fs.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.partPath(uploadId, partNumber));
  }

  /**
   * Streams the declared parts in order into one durable object file, hashing the
   * concatenation incrementally. Returns the whole-object checksum and size, never
   * buffering the assembled object in memory.
   */
  private async assembleParts(
    uploadId: string,
    parts: ObjectCompleteMultipartInput['parts'],
    byteFile: string,
  ): Promise<{ status: 'ok'; checksum: string; sizeBytes: number } | { status: 'missing_parts' }> {
    for (const part of parts) {
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(this.partPath(uploadId, part.partNumber));
      } catch {
        return { status: 'missing_parts' };
      }
      if (stat.size !== part.sizeBytes) return { status: 'missing_parts' };
    }
    const present = new Set(await this.listParts(uploadId));
    if (present.size !== parts.length) return { status: 'missing_parts' };

    await fs.mkdir(this.objectsDir, { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    const tmp = path.join(this.tmpDir, `assemble.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const output = await fs.open(tmp, 'w', 0o600);
    try {
      for (const part of parts) {
        const partBytes = await fs.readFile(this.partPath(uploadId, part.partNumber));
        // Verify each part's own checksum as it is streamed, then fold it into both the
        // output file and the whole-object hash. Parts are already bounded (>=5 MiB
        // non-final) so a single readFile per part stays within a part-sized buffer.
        if (objectChecksumBytes(partBytes) !== part.checksumSha256) {
          return { status: 'missing_parts' };
        }
        await output.writeFile(partBytes);
        hash.update(partBytes);
        sizeBytes += partBytes.length;
      }
      await output.sync();
    } finally {
      await output.close();
    }
    await fs.rename(tmp, this.objectPath(byteFile));
    return { status: 'ok', checksum: hash.digest('hex'), sizeBytes };
  }

  private async discardUpload(uploadId: string): Promise<void> {
    await fs.rm(this.partsDir(uploadId), { recursive: true, force: true });
  }

  /** Copies a byte file to a new name via a temp+rename so no partial durable file appears. */
  private async copyBytesFile(fromByteFile: string, toByteFile: string): Promise<void> {
    await fs.mkdir(this.objectsDir, { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    const tmp = path.join(this.tmpDir, `promote.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    await fs.copyFile(this.objectPath(fromByteFile), tmp);
    const handle = await fs.open(tmp, 'r+');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.objectPath(toByteFile));
  }
}

/** sha256 hex of opaque bytes. */
function objectChecksumBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Streaming sha256 hex of a file, so a multi-GB object is hashed with bounded memory. */
async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
}
