/**
 * Create, parse, and verify ContentManifest objects (the "torrent file").
 *
 * A manifest describes a published piece of content: its files, piece hashes,
 * Merkle root, access control, and creator signature.
 */

import { sha256Hex } from '../encryption/sha256';
import type { ContentAccess, ContentCategory, ContentManifest } from '../types';
import { ContentManifestSchema } from '../types';
import { signMessage, verifySignature } from '../identity/device-identity';
import { bytesToHex } from '../encryption/keys';

export interface ManifestFile {
  path: string;
  data: Uint8Array;
  mimeType: string;
}

export interface CreateManifestOptions {
  title: string;
  description: string;
  files: ManifestFile[];
  access: ContentAccess;
  category: ContentCategory;
  tags: string[];
  /** Creator's Ed25519 public key (hex). */
  creatorPublicKey: string;
  /** Creator's display name. */
  creatorDisplayName: string;
  /** Creator's Ed25519 private key (hex) for signing. */
  creatorPrivateKey: string;
  /** Piece length in bytes. Default: 256KB. */
  pieceLength?: number;
  /** Price in dollars (for paid content). */
  price?: { amount: number; currency: string; paymentMethods: string[] };
  /** Tracker URLs. */
  trackers?: string[];
  /** HTTP fallback URLs. */
  webSeeds?: string[];
}

/**
 * Create a content manifest from files.
 *
 * Hashes all files, splits into pieces, builds a Merkle tree,
 * and signs the manifest with the creator's key.
 */
export function createManifest(options: CreateManifestOptions): ContentManifest {
  const pieceLength = options.pieceLength ?? 256 * 1024;

  // Hash each file
  const fileEntries = options.files.map((f) => ({
    path: f.path,
    size: f.data.length,
    hash: hashData(f.data),
    mimeType: f.mimeType,
  }));

  // Concatenate all file data for piece splitting
  const totalSize = options.files.reduce((sum, f) => sum + f.data.length, 0);
  const allData = new Uint8Array(totalSize);
  let offset = 0;
  for (const file of options.files) {
    allData.set(file.data, offset);
    offset += file.data.length;
  }

  // Split into pieces and hash each
  const pieces: string[] = [];
  for (let i = 0; i < allData.length; i += pieceLength) {
    const piece = allData.slice(i, i + pieceLength);
    pieces.push(hashData(piece));
  }

  // Build Merkle root from piece hashes
  const merkleRoot = computeMerkleRoot(pieces);

  // Build the unsigned manifest (for hashing)
  const manifestData = {
    title: options.title,
    description: options.description,
    files: fileEntries,
    pieceLength,
    pieces,
    totalSize,
    merkleRoot,
    access: options.access,
    tags: options.tags,
    category: options.category,
    createdAt: new Date().toISOString(),
    version: 1,
    trackers: options.trackers ?? ['wss://tracker.mylife.app'],
    webSeeds: options.webSeeds ?? [],
  };

  // Compute info hash (SHA-256 of the manifest metadata)
  const infoHash = hashData(new TextEncoder().encode(JSON.stringify(manifestData)));

  // Sign the info hash
  const signatureBytes = signMessage(
    options.creatorPrivateKey,
    new TextEncoder().encode(infoHash),
  );

  const manifest: ContentManifest = {
    ...manifestData,
    infoHash,
    creator: {
      publicKey: options.creatorPublicKey,
      displayName: options.creatorDisplayName,
      signature: bytesToHex(signatureBytes),
    },
    price: options.price,
  };

  return manifest;
}

/** Verify a manifest's creator signature. */
export function verifyManifest(manifest: ContentManifest): boolean {
  const { creator, infoHash } = manifest;
  try {
    const signatureBytes = hexToUint8Array(creator.signature);
    const messageBytes = new TextEncoder().encode(infoHash);
    return verifySignature(creator.publicKey, messageBytes, signatureBytes);
  } catch {
    return false;
  }
}

/** Parse and validate a manifest from JSON. Returns null if invalid. */
export function parseManifest(json: string): ContentManifest | null {
  try {
    const data = JSON.parse(json);
    const result = ContentManifestSchema.safeParse(data);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Verify that piece hashes match the Merkle root. */
export function verifyMerkleRoot(pieces: string[], expectedRoot: string): boolean {
  const computed = computeMerkleRoot(pieces);
  return computed === expectedRoot;
}

/**
 * Compute a Merkle tree root from an array of leaf hashes.
 *
 * Pairs adjacent hashes and hashes them together, repeating
 * until a single root hash remains.
 */
export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return hashData(new Uint8Array(0));
  if (leaves.length === 1) return leaves[0]!;

  let level = [...leaves];
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left; // Duplicate last if odd
      const combined = left + right;
      nextLevel.push(hashData(new TextEncoder().encode(combined)));
    }
    level = nextLevel;
  }
  return level[0]!;
}

/** Compute SHA-256 of data, return hex string. */
function hashData(data: Uint8Array): string {
  return sha256Hex(data);
}

/** Convert hex string to Uint8Array. */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
