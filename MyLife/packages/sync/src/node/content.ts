/**
 * Content addressing: deterministic chunking and a binary Merkle tree.
 *
 * Content is split into fixed-size chunks, each chunk is hashed, and the chunk
 * hashes are folded into a Merkle root. The root hex IS the content id, so two
 * peers that hold the same bytes compute the same id, and any corrupted chunk
 * fails verification against the manifest. This is the seeding substrate: a
 * seeder stores chunks keyed by hash and serves them on request.
 */

import { sha512Hex } from './hkdf';

export const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256 KiB, matches the torrent layer

export interface ContentChunk {
  index: number;
  hash: string; // sha512 hex of the chunk bytes
  bytes: Uint8Array;
}

/**
 * Split content into fixed-size chunks and hash each one.
 */
export function chunkContent(
  content: Uint8Array,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ContentChunk[] {
  if (chunkSize <= 0) throw new Error('chunkSize must be positive');
  const chunks: ContentChunk[] = [];
  // A zero-length payload is a single empty chunk so that contentId is defined.
  const total = content.length === 0 ? 1 : Math.ceil(content.length / chunkSize);
  for (let i = 0; i < total; i++) {
    const bytes = content.slice(i * chunkSize, i * chunkSize + chunkSize);
    chunks.push({ index: i, hash: sha512Hex(bytes), bytes });
  }
  return chunks;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Compute the Merkle root over an ordered list of chunk hashes.
 *
 * Leaves are the chunk-hash bytes. Each level pairs adjacent nodes and hashes
 * their concatenation; a lone trailing node is promoted unchanged. The root is
 * returned as a hex string and serves as the content id.
 */
export function merkleRoot(chunkHashes: string[]): string {
  if (chunkHashes.length === 0) {
    return sha512Hex(new Uint8Array(0));
  }
  let level: Uint8Array[] = chunkHashes.map(hexToBytes);
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        const pair = new Uint8Array(level[i]!.length + level[i + 1]!.length);
        pair.set(level[i]!, 0);
        pair.set(level[i + 1]!, level[i]!.length);
        next.push(hexToBytes(sha512Hex(pair)));
      } else {
        next.push(level[i]!);
      }
    }
    level = next;
  }
  // Re-hash the single leaf case so a one-chunk content id is not just the
  // chunk hash (keeps ids in a distinct domain).
  if (chunkHashes.length === 1) {
    return sha512Hex(level[0]!);
  }
  return sha512Hex(level[0]!);
}

/**
 * Compute the content id (Merkle root hex) for a set of chunks.
 */
export function computeContentId(chunks: ContentChunk[]): string {
  return merkleRoot(chunks.map((c) => c.hash));
}

/**
 * Reassemble ordered chunks back into the original byte payload.
 */
export function reassemble(chunks: { index: number; bytes: Uint8Array }[]): Uint8Array {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  let total = 0;
  for (const c of ordered) total += c.bytes.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of ordered) {
    out.set(c.bytes, offset);
    offset += c.bytes.length;
  }
  return out;
}
