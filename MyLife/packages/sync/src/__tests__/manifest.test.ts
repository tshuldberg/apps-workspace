import { describe, it, expect } from 'vitest';
import {
  createManifest,
  verifyManifest,
  parseManifest,
  computeMerkleRoot,
  verifyMerkleRoot,
} from '../torrent/manifest';
import { PieceManager } from '../torrent/piece-manager';
import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '../identity/device-identity';
import { createHash } from 'crypto';

/** Hash helper matching the source implementation. */
function hashData(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// createManifest
// ---------------------------------------------------------------------------

describe('createManifest', () => {
  const identity = generateDeviceIdentity('TestCreator');
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);

  const sampleFile = {
    path: 'hello.txt',
    data: new TextEncoder().encode('Hello, world!'),
    mimeType: 'text/plain',
  };

  it('creates a valid ContentManifest with correct fields', () => {
    const manifest = createManifest({
      title: 'Test Content',
      description: 'A test manifest',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: ['test'],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    expect(manifest.title).toBe('Test Content');
    expect(manifest.description).toBe('A test manifest');
    expect(manifest.infoHash).toBeDefined();
    expect(typeof manifest.infoHash).toBe('string');
    expect(manifest.infoHash.length).toBeGreaterThan(0);
    expect(manifest.creator.publicKey).toBe(identity.publicKey);
    expect(manifest.creator.displayName).toBe(identity.displayName);
    expect(manifest.creator.signature).toBeDefined();
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0]!.path).toBe('hello.txt');
    expect(manifest.files[0]!.size).toBe(sampleFile.data.length);
    expect(manifest.files[0]!.mimeType).toBe('text/plain');
    expect(manifest.totalSize).toBe(sampleFile.data.length);
    expect(manifest.access).toBe('public');
    expect(manifest.category).toBe('other');
    expect(manifest.tags).toEqual(['test']);
    expect(manifest.version).toBe(1);
    expect(manifest.trackers).toContain('wss://tracker.mylife.app');
    expect(manifest.webSeeds).toEqual([]);
  });

  it('produces proper piece hashes', () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;

    const manifest = createManifest({
      title: 'Piece Test',
      description: '',
      files: [{ path: 'data.bin', data, mimeType: 'application/octet-stream' }],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
      pieceLength: 32,
    });

    // 100 bytes / 32 byte pieces = 4 pieces (32+32+32+4)
    expect(manifest.pieces).toHaveLength(4);
    // Each piece hash should be a valid SHA-256 hex string (64 chars)
    for (const hash of manifest.pieces) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('computes a Merkle root from piece hashes', () => {
    const manifest = createManifest({
      title: 'Merkle Test',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    expect(manifest.merkleRoot).toBeDefined();
    expect(typeof manifest.merkleRoot).toBe('string');
    expect(manifest.merkleRoot.length).toBeGreaterThan(0);

    // Merkle root should be consistent with the pieces
    expect(verifyMerkleRoot(manifest.pieces, manifest.merkleRoot)).toBe(true);
  });

  it('includes file hashes for each file entry', () => {
    const manifest = createManifest({
      title: 'Hash Test',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    const expectedHash = hashData(sampleFile.data);
    expect(manifest.files[0]!.hash).toBe(expectedHash);
  });

  it('uses custom trackers and web seeds when provided', () => {
    const manifest = createManifest({
      title: 'Custom Tracker Test',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
      trackers: ['wss://custom.tracker'],
      webSeeds: ['https://seed.example.com'],
    });

    expect(manifest.trackers).toEqual(['wss://custom.tracker']);
    expect(manifest.webSeeds).toEqual(['https://seed.example.com']);
  });

  it('includes price for paid content', () => {
    const manifest = createManifest({
      title: 'Paid Content',
      description: 'For sale',
      files: [sampleFile],
      access: 'paid',
      category: 'book',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
      price: { amount: 9.99, currency: 'USD', paymentMethods: ['stripe'] },
    });

    expect(manifest.price).toEqual({
      amount: 9.99,
      currency: 'USD',
      paymentMethods: ['stripe'],
    });
  });
});

// ---------------------------------------------------------------------------
// verifyManifest
// ---------------------------------------------------------------------------

describe('verifyManifest', () => {
  const identity = generateDeviceIdentity('VerifyCreator');
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  const sampleFile = {
    path: 'test.txt',
    data: new TextEncoder().encode('verify me'),
    mimeType: 'text/plain',
  };

  it('returns true for a valid, untampered manifest', () => {
    const manifest = createManifest({
      title: 'Valid Manifest',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    expect(verifyManifest(manifest)).toBe(true);
  });

  it('returns false for a tampered manifest (modified infoHash)', () => {
    const manifest = createManifest({
      title: 'Tampered Manifest',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    const tampered = { ...manifest, infoHash: 'deadbeef' + manifest.infoHash.slice(8) };
    expect(verifyManifest(tampered)).toBe(false);
  });

  it('returns false for a manifest with a wrong public key', () => {
    const manifest = createManifest({
      title: 'Wrong Key',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    const otherIdentity = generateDeviceIdentity('Other');
    const tampered = {
      ...manifest,
      creator: { ...manifest.creator, publicKey: otherIdentity.publicKey },
    };
    expect(verifyManifest(tampered)).toBe(false);
  });

  it('returns false for a manifest with invalid signature', () => {
    const manifest = createManifest({
      title: 'Bad Sig',
      description: '',
      files: [sampleFile],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    const tampered = {
      ...manifest,
      creator: { ...manifest.creator, signature: 'ff'.repeat(64) },
    };
    expect(verifyManifest(tampered)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseManifest
// ---------------------------------------------------------------------------

describe('parseManifest', () => {
  const identity = generateDeviceIdentity('ParseCreator');
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);

  it('parses a valid manifest JSON', () => {
    const manifest = createManifest({
      title: 'Parseable',
      description: 'test',
      files: [{
        path: 'file.txt',
        data: new TextEncoder().encode('data'),
        mimeType: 'text/plain',
      }],
      access: 'public',
      category: 'other',
      tags: [],
      creatorPublicKey: identity.publicKey,
      creatorDisplayName: identity.displayName,
      creatorPrivateKey: privateKeyHex,
    });

    const json = JSON.stringify(manifest);
    const parsed = parseManifest(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('Parseable');
    expect(parsed!.infoHash).toBe(manifest.infoHash);
  });

  it('returns null for invalid JSON', () => {
    expect(parseManifest('not valid json {')).toBeNull();
  });

  it('returns null for valid JSON that does not match schema', () => {
    expect(parseManifest(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseManifest('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeMerkleRoot
// ---------------------------------------------------------------------------

describe('computeMerkleRoot', () => {
  it('returns consistent hash for the same input', () => {
    const leaves = ['aaa', 'bbb', 'ccc'];
    const root1 = computeMerkleRoot(leaves);
    const root2 = computeMerkleRoot(leaves);
    expect(root1).toBe(root2);
  });

  it('handles a single piece (returns the leaf itself)', () => {
    const leaves = ['abc123'];
    const root = computeMerkleRoot(leaves);
    expect(root).toBe('abc123');
  });

  it('handles multiple pieces', () => {
    const leaves = ['hash1', 'hash2', 'hash3', 'hash4'];
    const root = computeMerkleRoot(leaves);
    expect(typeof root).toBe('string');
    expect(root.length).toBeGreaterThan(0);
    // Root should differ from any individual leaf
    for (const leaf of leaves) {
      expect(root).not.toBe(leaf);
    }
  });

  it('handles empty input', () => {
    const root = computeMerkleRoot([]);
    expect(typeof root).toBe('string');
    expect(root.length).toBeGreaterThan(0);
  });

  it('handles odd number of leaves', () => {
    const leaves = ['a', 'b', 'c'];
    const root = computeMerkleRoot(leaves);
    expect(typeof root).toBe('string');
  });

  it('different inputs produce different roots', () => {
    const root1 = computeMerkleRoot(['a', 'b']);
    const root2 = computeMerkleRoot(['c', 'd']);
    expect(root1).not.toBe(root2);
  });
});

// ---------------------------------------------------------------------------
// verifyMerkleRoot
// ---------------------------------------------------------------------------

describe('verifyMerkleRoot', () => {
  it('returns true when pieces match the expected root', () => {
    const pieces = ['hash1', 'hash2'];
    const root = computeMerkleRoot(pieces);
    expect(verifyMerkleRoot(pieces, root)).toBe(true);
  });

  it('returns false when pieces do not match the expected root', () => {
    const pieces = ['hash1', 'hash2'];
    expect(verifyMerkleRoot(pieces, 'wrong_root')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PieceManager
// ---------------------------------------------------------------------------

describe('PieceManager', () => {
  const pieceHashes = ['hash_0', 'hash_1', 'hash_2'];

  it('initializes with all pieces as missing', () => {
    const pm = new PieceManager('info_abc', pieceHashes);
    expect(pm.totalPieces).toBe(3);
    expect(pm.missingCount).toBe(3);
    expect(pm.verifiedCount).toBe(0);
    expect(pm.isComplete).toBe(false);
  });

  it('tracks piece states correctly', () => {
    const pm = new PieceManager('info_abc', pieceHashes);

    pm.markDownloading(0);
    const piece0 = pm.getPiece(0);
    expect(piece0?.status).toBe('downloading');

    // downloading does not count as verified
    expect(pm.verifiedCount).toBe(0);
    expect(pm.missingCount).toBe(2);
  });

  it('selectPieces returns missing pieces', () => {
    const pm = new PieceManager('info_abc', pieceHashes);
    const selected = pm.selectPieces(2);
    expect(selected).toHaveLength(2);
    expect(selected).toEqual([0, 1]);
  });

  it('selectPieces with peer availability returns rarest first', () => {
    const pm = new PieceManager('info_abc', pieceHashes);
    const availability = new Map([
      [0, 5],  // common
      [1, 1],  // rare
      [2, 3],  // medium
    ]);
    const selected = pm.selectPieces(3, availability);
    expect(selected[0]).toBe(1); // rarest first
  });

  it('verifyPiece checks hash and marks as verified on match', () => {
    // Create data whose hash matches the piece hash
    const data = new TextEncoder().encode('piece data');
    const hash = createHash('sha256').update(data).digest('hex');
    const pm = new PieceManager('info_abc', [hash]);

    const result = pm.verifyPiece(0, data);
    expect(result).toBe(true);
    expect(pm.getPiece(0)?.status).toBe('verified');
    expect(pm.getPiece(0)?.verifiedAt).not.toBeNull();
  });

  it('verifyPiece returns false and resets to missing on mismatch', () => {
    const pm = new PieceManager('info_abc', ['expected_hash']);
    pm.markDownloading(0);

    const result = pm.verifyPiece(0, new TextEncoder().encode('wrong data'));
    expect(result).toBe(false);
    expect(pm.getPiece(0)?.status).toBe('missing');
  });

  it('verifyPiece returns false for out-of-range index', () => {
    const pm = new PieceManager('info_abc', pieceHashes);
    expect(pm.verifyPiece(99, new Uint8Array(0))).toBe(false);
  });

  it('isComplete returns true when all pieces are verified', () => {
    const dataChunks = [
      new TextEncoder().encode('chunk0'),
      new TextEncoder().encode('chunk1'),
    ];
    const hashes = dataChunks.map((d) => createHash('sha256').update(d).digest('hex'));
    const pm = new PieceManager('info_abc', hashes);

    pm.verifyPiece(0, dataChunks[0]!);
    pm.verifyPiece(1, dataChunks[1]!);

    expect(pm.isComplete).toBe(true);
    expect(pm.progress).toBe(1);
  });

  it('progress property reflects download fraction', () => {
    const dataChunks = [
      new TextEncoder().encode('a'),
      new TextEncoder().encode('b'),
      new TextEncoder().encode('c'),
      new TextEncoder().encode('d'),
    ];
    const hashes = dataChunks.map((d) => createHash('sha256').update(d).digest('hex'));
    const pm = new PieceManager('info_abc', hashes);

    expect(pm.progress).toBe(0);

    pm.verifyPiece(0, dataChunks[0]!);
    expect(pm.progress).toBe(0.25);

    pm.verifyPiece(1, dataChunks[1]!);
    expect(pm.progress).toBe(0.5);
  });

  it('progress returns 1 for empty piece list', () => {
    const pm = new PieceManager('info_abc', []);
    expect(pm.progress).toBe(1);
  });

  it('resetPiece resets a piece to missing', () => {
    const data = new TextEncoder().encode('data');
    const hash = createHash('sha256').update(data).digest('hex');
    const pm = new PieceManager('info_abc', [hash]);

    pm.verifyPiece(0, data);
    expect(pm.getPiece(0)?.status).toBe('verified');

    pm.resetPiece(0);
    expect(pm.getPiece(0)?.status).toBe('missing');
    expect(pm.getPiece(0)?.verifiedAt).toBeNull();
  });

  it('getBitfield returns correct array', () => {
    const data = new TextEncoder().encode('data');
    const hash = createHash('sha256').update(data).digest('hex');
    const pm = new PieceManager('info_abc', [hash, 'other_hash']);

    pm.verifyPiece(0, data);
    const bitfield = pm.getBitfield();
    expect(bitfield).toEqual([true, false]);
  });

  it('getMissingIndices returns only missing piece indices', () => {
    const data = new TextEncoder().encode('data');
    const hash = createHash('sha256').update(data).digest('hex');
    const pm = new PieceManager('info_abc', [hash, 'other']);

    pm.verifyPiece(0, data);
    expect(pm.getMissingIndices()).toEqual([1]);
  });

  it('toJSON and fromJSON roundtrip correctly', () => {
    const data = new TextEncoder().encode('data');
    const hash = createHash('sha256').update(data).digest('hex');
    const pm = new PieceManager('info_abc', [hash, 'other']);
    pm.verifyPiece(0, data);

    const json = pm.toJSON();
    const restored = PieceManager.fromJSON(json);

    expect(restored.infoHash).toBe('info_abc');
    expect(restored.totalPieces).toBe(2);
    expect(restored.getPiece(0)?.status).toBe('verified');
    expect(restored.getPiece(1)?.status).toBe('missing');
  });

  it('infoHash getter returns the correct hash', () => {
    const pm = new PieceManager('my_info_hash', []);
    expect(pm.infoHash).toBe('my_info_hash');
  });
});
