/**
 * Sealed shares: real end-to-end encrypted, signed, content-addressed sharing.
 *
 * The author chunks the content, encrypts each chunk under a per-chunk key
 * derived (HKDF-SHA512) from a random link key, and signs a manifest that
 * binds the content id (Merkle root) and the per-chunk plaintext hashes with
 * the author's Ed25519 key. The link key travels only in the share link
 * (scope `published_blob`: "anyone with the hash + link key"); the seeder
 * stores opaque ciphertext blocks and never holds the key.
 *
 * A recipient with the link key and the author public key can: verify the
 * signature (catches forgery/tamper of the manifest), decrypt each block
 * (authenticated; catches tampered ciphertext), check each plaintext chunk
 * hash, recompute the Merkle root against the content id, and reassemble. Any
 * mismatch fails closed. This runs today on one device; the transport layer
 * (MK-005..007) is what later moves the ciphertext blocks between devices.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
const { encodeBase64, decodeBase64, decodeUTF8 } = naclUtil;
import type { DeviceIdentity } from '../types';
import {
  signMessage,
  verifySignature,
  extractSigningPrivateKeyHex,
} from '../identity/device-identity';
import { encrypt, decrypt } from '../encryption/encrypt';
import { hkdf, sha512Hex } from './hkdf';
import {
  chunkContent,
  merkleRoot,
  reassemble,
  DEFAULT_CHUNK_SIZE,
} from './content';

export type NodeShareScope = 'personal_replica' | 'shared_workspace' | 'published_blob';

export interface NodeManifest {
  contentId: string; // Merkle root hex over plaintext chunk hashes
  name: string;
  size: number; // plaintext byte length
  chunkSize: number;
  chunkHashes: string[]; // ordered plaintext chunk hashes
  authorPublicKey: string; // Ed25519 hex
  createdAt: string; // ISO 8601
  scope: NodeShareScope;
}

export interface SealedChunk {
  index: number;
  sealedId: string; // sha512 hex of the ciphertext block (the seeding/storage key)
  payload: string; // base64(nonce) + "." + base64(ciphertext)
}

export interface SealedShare {
  manifest: NodeManifest;
  manifestSignature: string; // base64 Ed25519 signature over the canonical manifest
  sealedChunks: SealedChunk[];
}

export interface CreateSealedShareOptions {
  name: string;
  identity: DeviceIdentity;
  scope?: NodeShareScope;
  chunkSize?: number;
  createdAt?: string; // injectable for deterministic tests
}

export type OpenResult =
  | { ok: true; content: Uint8Array }
  | { ok: false; reason: string };

function chunkInfo(contentId: string, index: number): string {
  return `meerkat-node-chunk:v1:${contentId}:${index}`;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function sealBytes(plaintext: Uint8Array, key: Uint8Array): { payload: string; sealedId: string } {
  const { ciphertext, nonce } = encrypt(plaintext, key);
  const sealedId = sha512Hex(concatBytes(nonce, ciphertext));
  return { payload: `${encodeBase64(nonce)}.${encodeBase64(ciphertext)}`, sealedId };
}

function openBytes(payload: string, key: Uint8Array): Uint8Array | null {
  const dot = payload.indexOf('.');
  if (dot === -1) return null;
  try {
    const nonce = decodeBase64(payload.substring(0, dot));
    const ciphertext = decodeBase64(payload.substring(dot + 1));
    return decrypt(ciphertext, nonce, key);
  } catch {
    return null;
  }
}

/**
 * Canonical (stable, alphabetical-key) serialization of the manifest for
 * signing and verification. Keys are listed explicitly so the byte string is
 * identical on both ends regardless of object construction order.
 */
function canonicalManifest(m: NodeManifest): Uint8Array {
  return decodeUTF8(
    JSON.stringify({
      authorPublicKey: m.authorPublicKey,
      chunkHashes: m.chunkHashes,
      chunkSize: m.chunkSize,
      contentId: m.contentId,
      createdAt: m.createdAt,
      name: m.name,
      scope: m.scope,
      size: m.size,
    }),
  );
}

/**
 * Seal content into an encrypted, signed, content-addressed share.
 * Returns the share (manifest + signature + ciphertext blocks) and the link
 * key that must be distributed via the share link.
 */
export function createSealedShare(
  content: Uint8Array,
  options: CreateSealedShareOptions,
): { share: SealedShare; linkKey: Uint8Array } {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunks = chunkContent(content, chunkSize);
  const chunkHashes = chunks.map((c) => c.hash);
  const contentId = merkleRoot(chunkHashes);
  const linkKey = nacl.randomBytes(nacl.secretbox.keyLength);

  const sealedChunks: SealedChunk[] = chunks.map((c) => {
    const key = hkdf(linkKey, chunkInfo(contentId, c.index));
    const { payload, sealedId } = sealBytes(c.bytes, key);
    return { index: c.index, sealedId, payload };
  });

  const manifest: NodeManifest = {
    contentId,
    name: options.name,
    size: content.length,
    chunkSize,
    chunkHashes,
    authorPublicKey: options.identity.publicKey,
    createdAt: options.createdAt ?? new Date().toISOString(),
    scope: options.scope ?? 'published_blob',
  };

  const signature = signMessage(
    extractSigningPrivateKeyHex(options.identity.privateKeyRef),
    canonicalManifest(manifest),
  );

  return {
    share: { manifest, manifestSignature: encodeBase64(signature), sealedChunks },
    linkKey,
  };
}

/**
 * Open a sealed share with the link key, verifying authorship and integrity
 * at every step. Fails closed with a reason on any mismatch.
 */
export function openSealedShare(
  share: SealedShare,
  linkKey: Uint8Array,
  options?: { expectedAuthor?: string },
): OpenResult {
  // 1. Manifest authenticity.
  let signatureValid = false;
  try {
    signatureValid = verifySignature(
      share.manifest.authorPublicKey,
      canonicalManifest(share.manifest),
      decodeBase64(share.manifestSignature),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { ok: false, reason: 'manifest-signature-invalid' };

  if (options?.expectedAuthor && options.expectedAuthor !== share.manifest.authorPublicKey) {
    return { ok: false, reason: 'author-mismatch' };
  }

  // 2. Content id must follow from the signed chunk hashes.
  if (merkleRoot(share.manifest.chunkHashes) !== share.manifest.contentId) {
    return { ok: false, reason: 'content-id-mismatch' };
  }

  // 3. Decrypt and verify every chunk in order.
  const ordered = [...share.sealedChunks].sort((a, b) => a.index - b.index);
  if (ordered.length !== share.manifest.chunkHashes.length) {
    return { ok: false, reason: 'chunk-count-mismatch' };
  }

  const plain: { index: number; bytes: Uint8Array }[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const sc = ordered[i]!;
    if (sc.index !== i) return { ok: false, reason: 'chunk-index-gap' };
    const key = hkdf(linkKey, chunkInfo(share.manifest.contentId, sc.index));
    const opened = openBytes(sc.payload, key);
    if (!opened) return { ok: false, reason: 'chunk-decrypt-failed' };
    if (sha512Hex(opened) !== share.manifest.chunkHashes[i]) {
      return { ok: false, reason: 'chunk-hash-mismatch' };
    }
    plain.push({ index: sc.index, bytes: opened });
  }

  // 4. Reassemble and confirm the declared size.
  const content = reassemble(plain);
  if (content.length !== share.manifest.size) {
    return { ok: false, reason: 'size-mismatch' };
  }

  return { ok: true, content };
}
