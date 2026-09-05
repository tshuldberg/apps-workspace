/**
 * Plan 22 S0.3 -- resumable upload-manifest helper.
 *
 * The mirror of the download/serve manifest: a block list with per-block UPLOAD
 * hash + byte offset + a completed bitfield, so an interrupted upload resumes from
 * the first missing block (never restart-from-zero). NO new crypto: the hash is
 * injected (node sha256 here, expo-crypto on device, the relay's sha256 server-
 * side) and each block is OPTIONALLY sealed with the existing content key before
 * the manifest records its hash, so the host verifies the exact ciphertext bytes
 * it stores (TC-11 / TC-12 foundation).
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildUploadManifest,
  nextMissingBlock,
  missingBlocks,
  markBlockComplete,
  isUploadComplete,
  verifyUploadBlock,
  DEFAULT_UPLOAD_BLOCK_SIZE,
} from '../upload-manifest';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function bytes(n: number, fill = 7): Uint8Array {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) a[i] = (fill + i) & 0xff;
  return a;
}

describe('buildUploadManifest', () => {
  it('splits data into ceil(len/blockSize) blocks with cumulative offsets + per-block hashes', async () => {
    const blockSize = 1024;
    const data = bytes(blockSize * 3 + 100); // 3 full blocks + a 100-byte tail
    const m = await buildUploadManifest(data, { hash: sha256, blockSize });

    expect(m.blockSize).toBe(blockSize);
    expect(m.totalBytes).toBe(data.length);
    expect(m.uploadBytes).toBe(data.length); // no seal -> upload bytes == source bytes
    expect(m.contentHash).toBe(sha256(data));
    expect(m.blocks).toHaveLength(4);
    expect(m.completed).toEqual([false, false, false, false]);

    let offset = 0;
    for (let i = 0; i < m.blocks.length; i += 1) {
      const b = m.blocks[i]!;
      const expectedLen = i < 3 ? blockSize : 100;
      const slice = data.subarray(offset, offset + expectedLen);
      expect(b.index).toBe(i);
      expect(b.offset).toBe(offset);
      expect(b.length).toBe(expectedLen);
      expect(b.hash).toBe(sha256(slice));
      offset += expectedLen;
    }
  });

  it('defaults to DEFAULT_UPLOAD_BLOCK_SIZE and yields one block for sub-block data', async () => {
    expect(DEFAULT_UPLOAD_BLOCK_SIZE).toBe(256 * 1024);
    const m = await buildUploadManifest(bytes(10), { hash: sha256 });
    expect(m.blocks).toHaveLength(1);
    expect(m.blocks[0]!.length).toBe(10);
  });

  it('records SEALED block bytes when a sealBlock transform is supplied (TC-11)', async () => {
    const blockSize = 64;
    const data = bytes(blockSize * 2);
    // A stand-in seal: prepend a 1-byte tag (no real crypto in the test).
    const sealBlock = (block: Uint8Array): Uint8Array => {
      const out = new Uint8Array(block.length + 1);
      out[0] = 0xaa;
      out.set(block, 1);
      return out;
    };
    const m = await buildUploadManifest(data, { hash: sha256, blockSize, sealBlock });

    expect(m.uploadBytes).toBe(data.length + 2); // +1 tag per block * 2 blocks
    for (let i = 0; i < 2; i += 1) {
      const plain = data.subarray(i * blockSize, (i + 1) * blockSize);
      const sealed = sealBlock(plain);
      expect(m.blocks[i]!.length).toBe(sealed.length);
      expect(m.blocks[i]!.hash).toBe(sha256(sealed)); // hash is over the SEALED upload bytes
      expect(m.blocks[i]!.hash).not.toBe(sha256(plain));
    }
  });
});

describe('resume + completion bitfield', () => {
  it('nextMissingBlock returns the lowest incomplete index (resume-from-first-missing)', async () => {
    const m0 = await buildUploadManifest(bytes(300), { hash: sha256, blockSize: 100 });
    expect(m0.blocks).toHaveLength(3);
    expect(nextMissingBlock(m0)).toBe(0);

    const m1 = markBlockComplete(m0, 0);
    expect(nextMissingBlock(m1)).toBe(1);

    // Out-of-order completion: 0 and 2 done, 1 still missing -> resume at 1.
    const m2 = markBlockComplete(m1, 2);
    expect(nextMissingBlock(m2)).toBe(1);
    expect(missingBlocks(m2)).toEqual([1]);
    expect(isUploadComplete(m2)).toBe(false);

    const m3 = markBlockComplete(m2, 1);
    expect(nextMissingBlock(m3)).toBeNull();
    expect(isUploadComplete(m3)).toBe(true);
    // markBlockComplete is immutable: the original manifest is unchanged.
    expect(m0.completed).toEqual([false, false, false]);
  });

  it('markBlockComplete ignores an out-of-range index', async () => {
    const m = await buildUploadManifest(bytes(100), { hash: sha256, blockSize: 100 });
    expect(markBlockComplete(m, 5)).toBe(m);
    expect(markBlockComplete(m, -1)).toBe(m);
  });
});

describe('verifyUploadBlock (ingest-side per-block hash check)', () => {
  it('accepts bytes whose hash + length match the advertised block, rejects tampered / wrong-length / bad-index', async () => {
    const blockSize = 64;
    const data = bytes(blockSize * 2);
    const m = await buildUploadManifest(data, { hash: sha256, blockSize });

    const block0 = data.subarray(0, blockSize);
    expect(await verifyUploadBlock(m, 0, block0, sha256)).toBe(true);

    const tampered = Uint8Array.from(block0);
    tampered[0] ^= 0xff;
    expect(await verifyUploadBlock(m, 0, tampered, sha256)).toBe(false);

    const wrongLength = data.subarray(0, blockSize - 1);
    expect(await verifyUploadBlock(m, 0, wrongLength, sha256)).toBe(false);

    expect(await verifyUploadBlock(m, 99, block0, sha256)).toBe(false);
  });
});
