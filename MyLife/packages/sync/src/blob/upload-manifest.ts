/**
 * Resumable upload-manifest (Plan 22 S0.3) -- the mirror of the download/serve
 * manifest, for huge-file / durable-archive ingest into a hosted tenant store.
 *
 * It records, for a source blob: a per-block UPLOAD hash + byte offset + length,
 * and a completed-block bitfield, so an interrupted upload resumes from the first
 * missing block (never restart-from-zero, archive-09 line 198). It adds NO crypto:
 *  - the content hash is INJECTED (`hash`) -- node sha256 on the relay, expo-crypto
 *    on device, a test sha256 in tests -- so this stays RN-safe (no node:crypto at
 *    import time, unlike blob-sync.ts);
 *  - each block is OPTIONALLY sealed with the existing community/DM content key
 *    (`sealBlock`) BEFORE its hash is recorded, so the host re-verifies the exact
 *    ciphertext bytes it stores (the public archive is non-confidential, so sealing
 *    is optional there). Sealing is the caller's existing key path; none is added.
 *
 * The default block size matches blob-sync.ts BLOCK_SIZE (256 KB); it is redeclared
 * here rather than imported so this module never pulls blob-sync's node:crypto.
 */

/** 256 KB per block -- matches blob-sync.ts BLOCK_SIZE (kept in lockstep). */
export const DEFAULT_UPLOAD_BLOCK_SIZE = 256 * 1024;

/** Inject a content hash (hex). Node sha256 on the relay, expo-crypto on device. */
export type UploadHashFn = (bytes: Uint8Array) => string | Promise<string>;

export interface UploadBlock {
  index: number;
  /** Byte offset of this block's UPLOAD bytes within the upload stream. */
  offset: number;
  /** UPLOAD (post-seal) byte length. */
  length: number;
  /** Hex hash of the UPLOAD bytes; the host re-verifies received bytes against this. */
  hash: string;
}

export interface UploadManifest {
  /** Hash of the full source (plaintext) -- the content id. */
  contentHash: string;
  /** Source (plaintext) byte length. */
  totalBytes: number;
  /** Total upload (post-seal) byte length -- what the tenant store accounts for. */
  uploadBytes: number;
  /** Source block size used to split. */
  blockSize: number;
  blocks: UploadBlock[];
  /** Resume bitfield: completed[i] === true once the host has acked block i by hash. */
  completed: boolean[];
}

export interface BuildUploadManifestOptions {
  hash: UploadHashFn;
  blockSize?: number;
  /**
   * Optional per-block seal with the existing content key. Omitted => the bytes are
   * uploaded as-is (the public archive is published_blob, zero confidentiality).
   * NO new crypto here: this is the caller's existing seal path.
   */
  sealBlock?: (block: Uint8Array, index: number) => Uint8Array | Promise<Uint8Array>;
}

/** Build a resumable upload manifest over the source data. */
export async function buildUploadManifest(
  data: Uint8Array,
  options: BuildUploadManifestOptions,
): Promise<UploadManifest> {
  const blockSize = options.blockSize ?? DEFAULT_UPLOAD_BLOCK_SIZE;
  if (!Number.isInteger(blockSize) || blockSize <= 0) {
    throw new Error('buildUploadManifest: blockSize must be a positive integer.');
  }
  const count = Math.max(1, Math.ceil(data.length / blockSize));
  const blocks: UploadBlock[] = [];
  let offset = 0;
  for (let i = 0; i < count; i += 1) {
    const plain = data.subarray(i * blockSize, Math.min((i + 1) * blockSize, data.length));
    const upload = options.sealBlock ? await options.sealBlock(plain, i) : plain;
    const hash = await options.hash(upload);
    blocks.push({ index: i, offset, length: upload.length, hash });
    offset += upload.length;
  }
  return {
    contentHash: await options.hash(data),
    totalBytes: data.length,
    uploadBytes: offset,
    blockSize,
    blocks,
    completed: new Array<boolean>(count).fill(false),
  };
}

/** The lowest block index not yet completed (resume-from-first-missing), or null. */
export function nextMissingBlock(manifest: UploadManifest): number | null {
  for (let i = 0; i < manifest.completed.length; i += 1) {
    if (!manifest.completed[i]) return i;
  }
  return null;
}

/** Every block index not yet completed (the resume set). */
export function missingBlocks(manifest: UploadManifest): number[] {
  const out: number[] = [];
  for (let i = 0; i < manifest.completed.length; i += 1) {
    if (!manifest.completed[i]) out.push(i);
  }
  return out;
}

/** Mark a block completed (immutable). Returns the same manifest for an out-of-range index. */
export function markBlockComplete(manifest: UploadManifest, index: number): UploadManifest {
  if (index < 0 || index >= manifest.completed.length) return manifest;
  const completed = manifest.completed.slice();
  completed[index] = true;
  return { ...manifest, completed };
}

/** True once every block has been acked. */
export function isUploadComplete(manifest: UploadManifest): boolean {
  return manifest.completed.length > 0 && manifest.completed.every(Boolean);
}

/**
 * Verify received bytes match a block's advertised UPLOAD hash + length. The ingest
 * endpoint runs this before storing, so a corrupted or forged block is rejected
 * fail-closed and never stored (TC-12).
 */
export async function verifyUploadBlock(
  manifest: UploadManifest,
  index: number,
  receivedBytes: Uint8Array,
  hash: UploadHashFn,
): Promise<boolean> {
  const block = manifest.blocks[index];
  if (!block) return false;
  if (receivedBytes.length !== block.length) return false;
  return (await hash(receivedBytes)) === block.hash;
}
