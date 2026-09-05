/**
 * Plan 38 Phase 0 -- sealed-object transfer leg (engine slice).
 *
 * Library sealed blocks ride the existing BLOB_REQUEST/BLOB_DATA pipeline:
 * collectBlobRefs learns sealedChunkIds from a library row's manifest_json,
 * and a block's wire bytes (nonce || ciphertext) hash to its sealedId, so the
 * pipeline's existing hash verification covers sealed blocks unchanged.
 */

import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSealedShare } from '../node/sealed-share';
import { sha512Hex } from '../node/hkdf';
import {
  blobContentHash,
  collectBlobRefs,
  sealedBlockBytesToPayload,
  sealedBlockPayloadToBytes,
} from '../protocol/blob-transfer';

const HASH_A = 'a'.repeat(128);
const HASH_B = 'b'.repeat(128);

function libraryRow(manifestJson: unknown, tombstone = 0): { data: Record<string, unknown> } {
  return { data: { item_id: 'i1', manifest_json: manifestJson, tombstone } };
}

describe('collectBlobRefs library extension', () => {
  it('still collects plain blob_hash refs', () => {
    expect(collectBlobRefs([{ data: { blob_hash: HASH_A } }])).toEqual([HASH_A]);
  });

  it('collects sealedChunkIds from a library row manifest_json', () => {
    const json = JSON.stringify({ manifest: {}, manifestSignature: 'sig', sealedChunkIds: [HASH_A, HASH_B] });
    expect(collectBlobRefs([libraryRow(json)]).sort()).toEqual([HASH_A, HASH_B]);
  });

  it('dedupes across conventions and rows', () => {
    const json = JSON.stringify({ sealedChunkIds: [HASH_A] });
    const refs = collectBlobRefs([
      { data: { blob_hash: HASH_A } },
      libraryRow(json),
      libraryRow(json),
    ]);
    expect(refs).toEqual([HASH_A]);
  });

  it('ignores tombstoned rows, malformed json, and non-hash entries', () => {
    expect(collectBlobRefs([libraryRow(JSON.stringify({ sealedChunkIds: [HASH_A] }), 1)])).toEqual([]);
    expect(collectBlobRefs([libraryRow('{not json')])).toEqual([]);
    expect(collectBlobRefs([libraryRow(JSON.stringify({ sealedChunkIds: 'nope' }))])).toEqual([]);
    expect(collectBlobRefs([
      libraryRow(JSON.stringify({ sealedChunkIds: ['short', 42, `${HASH_B}`] })),
    ])).toEqual([HASH_B]);
    expect(collectBlobRefs([{ data: null }])).toEqual([]);
  });
});

describe('sealed-block wire conversion', () => {
  it('round-trips a real sealed chunk and preserves the sealedId as the transfer hash', () => {
    const author = generateDeviceIdentity('Author');
    const { share } = createSealedShare(new TextEncoder().encode('sealed transfer bytes'), {
      name: 'clip.bin', identity: author,
    });
    for (const chunk of share.sealedChunks) {
      const bytes = sealedBlockPayloadToBytes(chunk.payload);
      expect(bytes).not.toBeNull();
      // The wire bytes hash to the sealedId: the existing pipeline verification
      // therefore authenticates sealed blocks with zero protocol changes.
      expect(blobContentHash(bytes!)).toBe(chunk.sealedId);
      expect(sha512Hex(bytes!)).toBe(chunk.sealedId);
      expect(sealedBlockBytesToPayload(bytes!)).toBe(chunk.payload);
    }
  });

  it('fails closed on malformed payloads and short byte arrays', () => {
    expect(sealedBlockPayloadToBytes('no-dot')).toBeNull();
    expect(sealedBlockPayloadToBytes('.leading')).toBeNull();
    expect(sealedBlockPayloadToBytes('trailing.')).toBeNull();
    expect(sealedBlockPayloadToBytes('!!!.###')).toBeNull();
    const shortNonce = `${Buffer.from(new Uint8Array(8)).toString('base64')}.${Buffer.from(new Uint8Array(4)).toString('base64')}`;
    expect(sealedBlockPayloadToBytes(shortNonce)).toBeNull();
    expect(sealedBlockBytesToPayload(new Uint8Array(nacl.secretbox.nonceLength))).toBeNull();
  });
});
