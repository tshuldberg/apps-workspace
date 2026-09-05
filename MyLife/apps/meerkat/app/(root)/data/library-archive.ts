// Plan 38 Phase 6 (MOBILE): a minimal, hardened, in-memory ZIP reader for the
// sealed epub/cbz readers. Structural twin of
// apps/meerkat-web/src/lib/library-archive.ts -- the central-directory parser and
// the caps are identical; only the inflate backend differs. The web twin rides
// the platform `DecompressionStream('deflate-raw')`; Hermes has no such stream,
// so this surface inflates with `pako` (pure JS, Expo-Go safe).
//
// epub/cbz bytes are ATTACKER-CONTROLLED community data, so every read is bounded
// by explicit caps (entry count, total uncompressed bytes, per-entry bytes) and
// nested archives are rejected. A cap breach throws; nothing is rendered from an
// over-budget archive. Inflation aborts the instant the running output would
// exceed the per-entry cap, so a lying central directory cannot materialize a
// bomb in memory.

// pako is a pure-JS dependency (no native module); a plain require keeps the
// reader Expo-Go safe. A minimal typed shape avoids an @types/pako dependency.
interface PakoInflateInstance {
  onData: (chunk: Uint8Array) => void;
  onEnd: (status: number) => void;
  push(data: Uint8Array, end: boolean): boolean;
  err: number;
  msg: string;
}
interface PakoModule {
  Inflate: new (options: { raw: boolean }) => PakoInflateInstance;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pako = require('pako') as PakoModule;

export interface ZipEntry {
  name: string;
  /** Declared uncompressed size from the central directory. */
  uncompressedSize: number;
  /** Declared compressed size from the central directory. */
  compressedSize: number;
  /** 0 = stored, 8 = deflate. Anything else is rejected on read. */
  method: number;
  /** Byte offset of the entry's local file header. */
  localHeaderOffset: number;
}

export interface UnzipCaps {
  maxEntries: number;
  /** Sum of declared uncompressed sizes across all entries. */
  maxTotalUncompressedBytes: number;
  /** Largest single declared uncompressed entry. */
  maxEntryUncompressedBytes: number;
  /** Reject entries that are themselves archives (nested zip bomb vector). */
  rejectNestedArchives?: boolean;
}

export interface ZipArchive {
  entries: ZipEntry[];
  /** Inflate a single entry, enforcing the byte cap during decompression. */
  read(name: string): Promise<Uint8Array>;
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const ZIP64_SENTINEL = 0xffffffff;

const NESTED_ARCHIVE_RE = /\.(zip|cbz|cbr|epub|rar|7z|tar|gz)$/i;

function u16(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}
function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! * 0x1000000)) >>> 0;
}

function decodeName(b: Uint8Array, o: number, len: number): string {
  const slice = b.subarray(o, o + len);
  return new TextDecoder('utf-8').decode(slice);
}

function findEocd(b: Uint8Array): number {
  // EOCD is at the tail, followed by an optional comment (<= 65535 bytes).
  const minOffset = Math.max(0, b.length - (22 + 0xffff));
  for (let i = b.length - 22; i >= minOffset; i -= 1) {
    if (u32(b, i) === EOCD_SIG) return i;
  }
  return -1;
}

/**
 * Parse a ZIP's central directory into an entry table WITHOUT decompressing
 * anything, enforcing count/size caps up front so a malicious directory is
 * rejected before any inflate work. Reads are lazy and individually bounded.
 */
export async function openZip(bytes: Uint8Array, caps: UnzipCaps): Promise<ZipArchive> {
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error('Not a ZIP archive (no end-of-central-directory record).');

  const totalEntries = u16(bytes, eocd + 10);
  const cdSize = u32(bytes, eocd + 12);
  const cdOffset = u32(bytes, eocd + 16);
  if (cdOffset === ZIP64_SENTINEL || cdSize === ZIP64_SENTINEL || totalEntries === 0xffff) {
    throw new Error('ZIP64 archives are not supported by the in-app reader.');
  }
  if (totalEntries > caps.maxEntries) {
    throw new Error(`ZIP has too many entries (${totalEntries} > ${caps.maxEntries}).`);
  }

  const entries: ZipEntry[] = [];
  let totalUncompressed = 0;
  let p = cdOffset;
  const cdEnd = Math.min(cdOffset + cdSize, bytes.length);
  for (let i = 0; i < totalEntries; i += 1) {
    if (p + 46 > cdEnd || u32(bytes, p) !== CD_SIG) {
      throw new Error('Corrupt ZIP central directory.');
    }
    const method = u16(bytes, p + 10);
    const compressedSize = u32(bytes, p + 20);
    const uncompressedSize = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localHeaderOffset = u32(bytes, p + 42);
    if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL) {
      throw new Error('ZIP64 archives are not supported by the in-app reader.');
    }
    const name = decodeName(bytes, p + 46, nameLen);

    // Directory markers (trailing slash) carry no data; skip them.
    const isDir = name.endsWith('/');
    if (!isDir) {
      if (caps.rejectNestedArchives && NESTED_ARCHIVE_RE.test(name)) {
        throw new Error(`Nested archive rejected: ${name}`);
      }
      if (uncompressedSize > caps.maxEntryUncompressedBytes) {
        throw new Error(`ZIP entry exceeds size cap: ${name}`);
      }
      totalUncompressed += uncompressedSize;
      if (totalUncompressed > caps.maxTotalUncompressedBytes) {
        throw new Error('ZIP total uncompressed size exceeds cap (possible zip bomb).');
      }
      entries.push({ name, uncompressedSize, compressedSize, method, localHeaderOffset });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }

  const byName = new Map(entries.map((e) => [e.name, e]));

  const read = async (name: string): Promise<Uint8Array> => {
    const entry = byName.get(name);
    if (!entry) throw new Error(`ZIP entry not found: ${name}`);
    const lh = entry.localHeaderOffset;
    if (lh + 30 > bytes.length || u32(bytes, lh) !== LFH_SIG) {
      throw new Error(`Corrupt local header for ${name}.`);
    }
    // The local header duplicates name/extra lengths (its sizes can be zero when a
    // data descriptor is used, so we always trust the central directory sizes).
    const nameLen = u16(bytes, lh + 26);
    const extraLen = u16(bytes, lh + 28);
    const dataStart = lh + 30 + nameLen + extraLen;
    const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.method === 0) {
      if (compressed.length > caps.maxEntryUncompressedBytes) {
        throw new Error(`ZIP entry exceeds size cap: ${name}`);
      }
      return compressed.slice();
    }
    if (entry.method !== 8) {
      throw new Error(`Unsupported ZIP compression method ${entry.method} for ${name}.`);
    }
    return inflateBounded(compressed, entry.uncompressedSize, caps.maxEntryUncompressedBytes);
  };

  return { entries, read };
}

/**
 * Inflate raw-deflate bytes with a hard output cap. pako streams chunks through
 * `onData`; we stop accumulating and throw the instant the running output would
 * exceed the cap, so a compression bomb can never materialize in memory.
 */
async function inflateBounded(
  compressed: Uint8Array,
  declaredSize: number,
  cap: number,
): Promise<Uint8Array> {
  const limit = Math.min(cap, Math.max(declaredSize, 0) || cap);
  const inflator = new pako.Inflate({ raw: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  let over = false;
  inflator.onData = (chunk: Uint8Array) => {
    if (over) return;
    total += chunk.byteLength;
    if (total > limit) { over = true; return; }
    chunks.push(chunk);
  };
  inflator.onEnd = () => {};
  inflator.push(compressed, true);
  if (over) throw new Error('Inflated output exceeds size cap (possible zip bomb).');
  if (inflator.err) throw new Error(`ZIP inflate failed: ${inflator.msg || inflator.err}`);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}
