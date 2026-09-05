/**
 * Blob transfer protocol (plan 14, MK-027) -- BLOB_REQUEST/BLOB_DATA live.
 *
 * Rows carry only a content hash (a `blob_hash` column); the bytes move in a
 * dedicated phase after module sync. The responder discovers refs it cannot
 * resolve locally, requests each blob (with the block indices it ALREADY has,
 * so an interrupted transfer resumes instead of restarting), and the initiator
 * streams the missing 16 KiB blocks. The receiver stages blocks durably in
 * sync_blob_blocks, reassembles when complete, verifies the content hash, and
 * enforces the module's sync_blob_policy size cap before storing.
 *
 * Hashing is SHA-512 via the audited tweetnacl primitive (the same interim
 * content-addressing standard as the node layer; BLAKE3/CID is the MK-025/026
 * Rust-core upgrade). Blocks are 16 KiB so a hex-encoded, encrypted frame stays
 * comfortably under the relay's 96 KiB frame cap (hex doubles the bytes twice:
 * once for dataHex, once for the encrypted envelope).
 *
 * RN-safe: no Node crypto/fs. Storage of the assembled bytes is delegated to an
 * injectable SessionBlobProvider (the app's filesystem store; an in-memory map
 * in tests).
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { DatabaseAdapter } from '@mylife/db';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const { encodeBase64, decodeBase64 } = naclUtil;

/** 16 KiB: hex + encryption envelope keeps frames under the relay's 96 KiB cap. */
export const BLOB_TRANSFER_BLOCK_SIZE = 16 * 1024;

const BLOB_HASH_RE = /^[0-9a-f]{128}$/;

/** Where blob bytes live on each side. Injected by the app; in-memory in tests. */
export interface SessionBlobProvider {
  /** Bytes for a content hash this device holds, or null. */
  get(hash: string): Uint8Array | null | Promise<Uint8Array | null>;
  /** Store verified bytes received from a peer. */
  put(
    hash: string,
    bytes: Uint8Array,
    meta: { moduleId: string; mimeType: string | null },
  ): void | Promise<void>;
}

export interface BlobRequestPayload {
  hash: string;
  moduleId: string;
  /** Block indices already staged locally (resume support). */
  have: number[];
}

export interface BlobDataPayload {
  hash: string;
  moduleId: string;
  index: number;
  total: number;
  totalBytes: number;
  mimeType: string | null;
  dataHex: string;
}

export interface BlobAckPayload {
  hash: string;
  ok: boolean;
  reason?: 'size_cap' | 'hash_mismatch' | 'not_found';
}

/** The content hash blobs are addressed by (interim SHA-512, hex). */
export function blobContentHash(bytes: Uint8Array): string {
  return sha512Hex(bytes);
}

/** True if a value looks like a blob content hash. */
export function isBlobHash(value: unknown): value is string {
  return typeof value === 'string' && BLOB_HASH_RE.test(value);
}

/**
 * Blob references carried by applied changes. Two conventions (Plan 38):
 *
 * 1. A `blob_hash` column holding a raw-content hash (channel/DM attachments).
 * 2. A `manifest_json` column on library rows: JSON carrying the sealed
 *    object's `sealedChunkIds` (hex sha512 of each ciphertext block, i.e. the
 *    block's OWN transfer hash). Sealed blocks ride the same BLOB_REQUEST /
 *    BLOB_DATA pipeline because a block's bytes hash to its sealedId. A
 *    forged sealedChunkIds list cannot inject content: the receiver still
 *    verifies each block hash on arrival, and decrypt + per-chunk plaintext
 *    hash + Merkle/contentId checks all run against the author-SIGNED
 *    manifest at open time (fail-closed). Tombstoned rows contribute nothing.
 *
 * Returns unique hashes.
 */
export function collectBlobRefs(
  changes: Array<{ data: Record<string, unknown> | null }>,
): string[] {
  const refs = new Set<string>();
  for (const change of changes) {
    const value = change.data?.blob_hash;
    if (isBlobHash(value)) refs.add(value);
    for (const sealedId of sealedChunkRefsFromRow(change.data)) refs.add(sealedId);
  }
  return [...refs];
}

/**
 * Sealed block ids referenced by a row's manifest columns, if any. The
 * convention covers `manifest_json` (library items) and any `*_manifest_json`
 * sibling (e.g. the identity row's banner_manifest_json).
 */
function sealedChunkRefsFromRow(data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  if (data.tombstone === 1 || data.tombstone === true) return [];
  const refs: string[] = [];
  for (const [column, value] of Object.entries(data)) {
    if (column !== 'manifest_json' && !column.endsWith('_manifest_json')) continue;
    if (typeof value !== 'string') continue;
    try {
      const parsed = JSON.parse(value) as { sealedChunkIds?: unknown };
      if (!Array.isArray(parsed?.sealedChunkIds)) continue;
      refs.push(...parsed.sealedChunkIds.filter(isBlobHash));
    } catch {
      // Malformed manifest JSON contributes nothing (fail-safe).
    }
  }
  return refs;
}

/**
 * Sealed-block wire conversion (Plan 38). A node-store block is stored as the
 * payload string `base64(nonce).base64(ciphertext)`, but its transfer identity
 * is sealedId = sha512(nonce || ciphertext) -- so on the wire a sealed block
 * moves as the raw `nonce || ciphertext` bytes, whose content hash IS the
 * sealedId the existing pipeline already verifies. These two helpers are the
 * only sanctioned conversion; both fail closed (null) on malformed input.
 */
export function sealedBlockPayloadToBytes(payload: string): Uint8Array | null {
  const dot = payload.indexOf('.');
  if (dot <= 0 || dot === payload.length - 1) return null;
  try {
    const nonce = decodeBase64(payload.slice(0, dot));
    const ciphertext = decodeBase64(payload.slice(dot + 1));
    if (nonce.length !== nacl.secretbox.nonceLength || ciphertext.length === 0) return null;
    const bytes = new Uint8Array(nonce.length + ciphertext.length);
    bytes.set(nonce, 0);
    bytes.set(ciphertext, nonce.length);
    return bytes;
  } catch {
    return null;
  }
}

export function sealedBlockBytesToPayload(bytes: Uint8Array): string | null {
  if (bytes.length <= nacl.secretbox.nonceLength) return null;
  const nonce = bytes.slice(0, nacl.secretbox.nonceLength);
  const ciphertext = bytes.slice(nacl.secretbox.nonceLength);
  return `${encodeBase64(nonce)}.${encodeBase64(ciphertext)}`;
}

/** Split bytes into wire blocks. A zero-length blob is one empty block. */
export function splitBlobForTransfer(
  bytes: Uint8Array,
  hash: string,
  moduleId: string,
  mimeType: string | null,
): BlobDataPayload[] {
  const total = Math.ceil(bytes.length / BLOB_TRANSFER_BLOCK_SIZE) || 1;
  const blocks: BlobDataPayload[] = [];
  for (let i = 0; i < total; i++) {
    const start = i * BLOB_TRANSFER_BLOCK_SIZE;
    const end = Math.min(start + BLOB_TRANSFER_BLOCK_SIZE, bytes.length);
    blocks.push({
      hash,
      moduleId,
      index: i,
      total,
      totalBytes: bytes.length,
      mimeType,
      dataHex: bytesToHex(bytes.slice(start, end)),
    });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Durable staging (resume support)
// ---------------------------------------------------------------------------

/** Persist one received block. Idempotent per (hash, index). */
export function stageBlobBlock(db: DatabaseAdapter, block: BlobDataPayload): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_blob_blocks (blob_hash, block_index, total, data_hex, staged_at)
     VALUES (?, ?, ?, ?, ?)`,
    [block.hash, block.index, block.total, block.dataHex, new Date().toISOString()],
  );
}

/** Block indices already staged for a blob (what `have` advertises). */
export function getStagedBlockIndices(db: DatabaseAdapter, hash: string): number[] {
  return db
    .query<{ block_index: number }>(
      'SELECT block_index FROM sync_blob_blocks WHERE blob_hash = ? ORDER BY block_index ASC',
      [hash],
    )
    .map((r) => r.block_index);
}

/**
 * Reassemble a fully staged blob, or null while blocks are missing. The caller
 * verifies the content hash and clears staging after storing.
 */
export function assembleStagedBlob(db: DatabaseAdapter, hash: string): Uint8Array | null {
  const rows = db.query<{ block_index: number; total: number; data_hex: string }>(
    'SELECT block_index, total, data_hex FROM sync_blob_blocks WHERE blob_hash = ? ORDER BY block_index ASC',
    [hash],
  );
  if (rows.length === 0 || rows.length < rows[0]!.total) return null;
  const parts = rows.map((r) => hexToBytes(r.data_hex));
  const size = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Drop staging rows for a blob (after storing, or on a failed transfer). */
export function clearStagedBlob(db: DatabaseAdapter, hash: string): void {
  db.execute('DELETE FROM sync_blob_blocks WHERE blob_hash = ?', [hash]);
}
