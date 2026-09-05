/**
 * Block-level blob transfer protocol.
 *
 * Splits large blobs into fixed-size blocks for incremental transfer,
 * reassembles them on the receiving end, and verifies integrity
 * via SHA-256 hash comparison.
 */

import { createHash } from 'crypto';

/** 256KB per block. */
export const BLOCK_SIZE = 256 * 1024;

/** A single block of a blob being transferred. */
export interface BlobBlock {
  /** SHA-256 hash of the full blob. */
  hash: string;
  /** Block index (0-based). */
  index: number;
  /** Block data. */
  data: Uint8Array;
  /** Total number of blocks for this blob. */
  total: number;
}

/** Split a blob into blocks for transfer. */
export function splitIntoBlocks(data: Uint8Array, blobHash: string): BlobBlock[] {
  const total = Math.ceil(data.length / BLOCK_SIZE) || 1;
  const blocks: BlobBlock[] = [];

  for (let i = 0; i < total; i++) {
    const start = i * BLOCK_SIZE;
    const end = Math.min(start + BLOCK_SIZE, data.length);
    blocks.push({
      hash: blobHash,
      index: i,
      data: data.slice(start, end),
      total,
    });
  }

  return blocks;
}

/** Reassemble blocks back into a complete blob. */
export function reassembleBlocks(blocks: BlobBlock[]): Uint8Array {
  // Sort by index to handle out-of-order arrival
  const sorted = [...blocks].sort((a, b) => a.index - b.index);

  // Calculate total size
  let totalSize = 0;
  for (const block of sorted) {
    totalSize += block.data.length;
  }

  // Concatenate into a single buffer
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const block of sorted) {
    result.set(block.data, offset);
    offset += block.data.length;
  }

  return result;
}

/** Verify a reassembled blob against its expected hash. */
export async function verifyBlob(data: Uint8Array, expectedHash: string): Promise<boolean> {
  const h = createHash('sha256');
  h.update(data);
  const actualHash = h.digest('hex');
  return actualHash === expectedHash;
}

/** Determine which blocks a peer needs (bitfield comparison). */
export function getMissingBlockIndices(totalBlocks: number, peerHas: boolean[]): number[] {
  const missing: number[] = [];
  for (let i = 0; i < totalBlocks; i++) {
    if (!peerHas[i]) {
      missing.push(i);
    }
  }
  return missing;
}
