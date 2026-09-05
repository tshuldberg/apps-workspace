/**
 * Public post protocol (Plan 39 P5, absorbing Plan 26 P2 -- node-mediated signed
 * public posts for open/approval publications).
 *
 * A PublicPostEvent is a PERSONA-signed, channel-message-shaped public event. The
 * author key is a PUBLIC PERSONA Ed25519 key (Plan 39 Track A), NEVER the device
 * identity key: the device key must not appear anywhere in a public-tier payload
 * (NC-P2). The serving community node countersigns each ACCEPTED post with its own
 * pinned node keypair, producing a PublicPostReceipt; readers verify BOTH
 * signatures per post, fail-closed (verifyPublicPost).
 *
 * TRUST MODEL, STATED HONESTLY (Plan 26 NC-1, locked): authorship and integrity of
 * a public post are cryptographically verified end-to-end (the persona signature
 * travels with the post and any reader re-verifies it). WHO MAY POST is enforced
 * by the hosting node (session + humanity + app-unlock + policy gates), like
 * Reddit/X, NOT by end-to-end key possession (unlike private communities, where
 * membership is owner-signed into the descriptor and content is epoch-encrypted).
 * Never present an open-mode public post as E2E-membership-verified; the reader UI
 * carries PUBLIC_POST_TRUST_COPY verbatim.
 *
 * Distinct signing domains (never collide with channel-message / DM / humanity /
 * publication domains):
 *   'meerkat-public-post-v1'            author (persona) signature
 *   'meerkat-public-post-receipt-v1'    node acceptance countersignature
 *   'meerkat-public-post-tombstone-v1'  owner/node/author removal record
 *   'meerkat-public-posting-freeze-v1'  owner/operator kill-switch record
 *
 * Replay/dedup: postId is CONTENT-DERIVED (hash of the canonical form with the id
 * blanked), so a byte-identical replay maps to the same id and the node's dedup is
 * deterministic; any field tamper changes the id or breaks the signature.
 *
 * NC-P4/NC-3 (Plan 26): a post is "accepted" ONLY when a REAL receipt verifies.
 * Composers must never fabricate acceptance from a network 200 without the receipt.
 *
 * No new crypto: Ed25519 via the existing wrappers; the node keypair derives from a
 * 32-byte seed exactly like the humanity service key.
 */

import nacl from 'tweetnacl';
import {
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import type { ChannelMessageAttachment, Hlc } from './channel-message';

const encoder = new TextEncoder();

export const PUBLIC_POST_DOMAIN = 'meerkat-public-post-v1';
export const PUBLIC_POST_RECEIPT_DOMAIN = 'meerkat-public-post-receipt-v1';
export const PUBLIC_POST_TOMBSTONE_DOMAIN = 'meerkat-public-post-tombstone-v1';
export const PUBLIC_POSTING_FREEZE_DOMAIN = 'meerkat-public-posting-freeze-v1';

/** Hard protocol caps (also enforced server-side; a post over these is invalid). */
export const MAX_PUBLIC_POST_BODY_CHARS = 8_000;
export const MAX_PUBLIC_POST_ATTACHMENTS = 8;
/** Versioned legal acceptance bound into every persona signature. */
export const CURRENT_PUBLIC_TERMS_VERSION = '2026-07';

/**
 * The honest trust label for node-mediated public posting (Plan 26 NC-1, verbatim
 * copy source for both app surfaces). Do not soften or remove.
 */
export const PUBLIC_POST_TRUST_COPY =
  'Posts here are cryptographically signed by their author, so authorship and '
  + 'integrity are verified end to end. Who may post is enforced by the hosting '
  + 'node (like Reddit or X), not by end-to-end membership keys as in private '
  + 'communities.';

const HEX_64 = /^[0-9a-f]{64}$/i;

/** A persona-signed public post (or reply, when parentPostId is set). */
export interface PublicPostEvent {
  version: 1;
  /** Content-derived id: hash of the canonical form with this field blanked. */
  postId: string;
  publicationId: string;
  channelId: string;
  /** The author's PUBLIC PERSONA Ed25519 key (64-hex). NEVER a device key (NC-P2). */
  personaPubkey: string;
  /** Root/parent post this replies to; null for a top-level post. Replies are
   *  gated writes exactly like posts (founder default, Plan 39). */
  parentPostId: string | null;
  body: string;
  /** Signing this exact version is the server-verifiable Terms acceptance receipt. */
  termsVersion: typeof CURRENT_PUBLIC_TERMS_VERSION;
  attachments?: ChannelMessageAttachment[];
  createdAt: string;
  /** Ed25519 signature (hex) over the canonical form, by personaPubkey. */
  signature: string;
}

/** A node acceptance countersignature over one accepted post (Plan 26 P2). */
export interface PublicPostReceipt {
  version: 1;
  /** The node's receipt PUBLIC key (64-hex); readers pin this via
   *  descriptor.postNodeKeyHex, so a substituted node cannot mint receipts. */
  nodeKeyHex: string;
  publicationId: string;
  channelId: string;
  postId: string;
  /** Hash binding the receipt to the EXACT signed post bytes. */
  eventHash: string;
  /** Node-assigned page ordering (signature-covered: no silent reorder). */
  hlc: Hlc;
  acceptedAt: string;
  /** Ed25519 signature (hex) over the canonical receipt, by nodeKeyHex. */
  signature: string;
}

/** A post the node accepted: the dual-signed unit readers verify + render. */
export interface AcceptedPublicPost {
  post: PublicPostEvent;
  receipt: PublicPostReceipt;
}

export type PublicPostVerdict =
  | 'ok'
  | 'invalid_post'
  | 'invalid_receipt'
  | 'node_key_mismatch'
  | 'scope_mismatch';

type UnsignedPublicPost = Omit<PublicPostEvent, 'signature'>;
type UnsignedReceipt = Omit<PublicPostReceipt, 'signature'>;

function canonicalAttachments(
  attachments: readonly ChannelMessageAttachment[] | undefined,
): Array<[string, string, string, string, number]> {
  return (attachments ?? []).map((a) => [a.id, a.blobHash, a.name, a.mimeType, a.size]);
}

function canonicalPublicPost(post: UnsignedPublicPost, postIdOverride?: string): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      PUBLIC_POST_DOMAIN,
      post.version,
      postIdOverride ?? post.postId,
      post.publicationId,
      post.channelId,
      post.personaPubkey,
      post.parentPostId,
      post.body,
      post.termsVersion,
      canonicalAttachments(post.attachments),
      post.createdAt,
    ]),
  );
}

/** The content-derived post id (canonical form with the id blanked). */
function derivePublicPostId(post: UnsignedPublicPost): string {
  return sha512Hex(canonicalPublicPost(post, '')).slice(0, 32);
}

/** Hash binding a receipt to the EXACT signed post (canonical + signature). */
export function publicPostEventHash(post: PublicPostEvent): string {
  const { signature, ...unsigned } = post;
  const canonical = canonicalPublicPost(unsigned);
  const sig = encoder.encode(signature);
  const joined = new Uint8Array(canonical.length + sig.length);
  joined.set(canonical, 0);
  joined.set(sig, canonical.length);
  return sha512Hex(joined);
}

export interface CreatePublicPostInput {
  publicationId: string;
  channelId: string;
  /** Parent post id for a reply; omit/null for a top-level post. */
  parentPostId?: string | null;
  body: string;
  attachments?: ChannelMessageAttachment[];
  now?: string;
}

/**
 * Create and persona-sign a public post. `persona` is the PUBLIC PERSONA keypair
 * (hex) from the persona store (Plan 39 Track A) -- callers MUST NOT pass the
 * device identity key here (NC-P2: the device key never signs public-tier events).
 * Throws on inputs over the protocol caps so an oversized post is never signed.
 */
export function createPublicPost(
  persona: { publicKeyHex: string; privateKeyHex: string },
  input: CreatePublicPostInput,
): PublicPostEvent {
  if (input.body.length === 0 || input.body.length > MAX_PUBLIC_POST_BODY_CHARS) {
    throw new Error(`Public post body must be 1..${MAX_PUBLIC_POST_BODY_CHARS} characters.`);
  }
  if ((input.attachments?.length ?? 0) > MAX_PUBLIC_POST_ATTACHMENTS) {
    throw new Error(`Public posts carry at most ${MAX_PUBLIC_POST_ATTACHMENTS} attachments.`);
  }
  const unsigned: UnsignedPublicPost = {
    version: 1,
    postId: '',
    publicationId: input.publicationId,
    channelId: input.channelId,
    personaPubkey: persona.publicKeyHex,
    parentPostId: input.parentPostId ?? null,
    body: input.body,
    termsVersion: CURRENT_PUBLIC_TERMS_VERSION,
    ...(input.attachments ? { attachments: input.attachments } : {}),
    createdAt: input.now ?? new Date().toISOString(),
  };
  unsigned.postId = derivePublicPostId(unsigned);
  const signature = bytesToHex(signMessage(persona.privateKeyHex, canonicalPublicPost(unsigned)));
  return { ...unsigned, signature };
}

function isAttachmentShape(value: unknown): value is ChannelMessageAttachment {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string'
    && typeof a.blobHash === 'string'
    && typeof a.name === 'string'
    && typeof a.mimeType === 'string'
    && typeof a.size === 'number'
  );
}

function isPublicPostShape(post: PublicPostEvent): boolean {
  if (!post || typeof post !== 'object') return false;
  if (
    post.version !== 1
    || typeof post.postId !== 'string'
    || typeof post.publicationId !== 'string'
    || post.publicationId.length === 0
    || typeof post.channelId !== 'string'
    || post.channelId.length === 0
    || typeof post.personaPubkey !== 'string'
    || !HEX_64.test(post.personaPubkey)
    || (post.parentPostId !== null && typeof post.parentPostId !== 'string')
    || typeof post.body !== 'string'
    || post.body.length === 0
    || post.body.length > MAX_PUBLIC_POST_BODY_CHARS
    || post.termsVersion !== CURRENT_PUBLIC_TERMS_VERSION
    || typeof post.createdAt !== 'string'
    || typeof post.signature !== 'string'
  ) {
    return false;
  }
  if (post.attachments !== undefined) {
    if (!Array.isArray(post.attachments)) return false;
    if (post.attachments.length > MAX_PUBLIC_POST_ATTACHMENTS) return false;
    if (!post.attachments.every(isAttachmentShape)) return false;
  }
  return true;
}

/**
 * Verify the AUTHOR half of a public post fail-closed: shape + caps, the
 * content-derived id, and the persona Ed25519 signature. The node runs this
 * before countersigning; readers run it via verifyPublicPost.
 */
export function verifyPublicPostAuthor(post: PublicPostEvent): boolean {
  if (!isPublicPostShape(post)) return false;
  const { signature, ...unsigned } = post;
  if (derivePublicPostId(unsigned) !== post.postId) return false;
  try {
    return verifySignature(post.personaPubkey, canonicalPublicPost(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

/**
 * Derive the node's receipt keypair from a 32-byte seed (hex), mirroring the
 * humanity service key: the deploy holds ONE seed env and the owner pins the
 * public half in descriptor.postNodeKeyHex. Throws on a non-32-byte seed.
 */
export function publicPostNodeKeypairFromSeed(seedHex: string): {
  publicKeyHex: string;
  privateKeyHex: string;
} {
  const seed = hexToBytes(seedHex);
  if (seed.length !== 32) {
    throw new Error('Public-post node receipt seed must be exactly 32 bytes (64 hex chars).');
  }
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKeyHex: bytesToHex(keypair.publicKey),
    privateKeyHex: bytesToHex(keypair.secretKey),
  };
}

function canonicalReceipt(receipt: UnsignedReceipt): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      PUBLIC_POST_RECEIPT_DOMAIN,
      receipt.version,
      receipt.nodeKeyHex,
      receipt.publicationId,
      receipt.channelId,
      receipt.postId,
      receipt.eventHash,
      receipt.hlc.wall,
      receipt.hlc.counter,
      receipt.acceptedAt,
    ]),
  );
}

export interface SignPublicPostAcceptanceInput {
  post: PublicPostEvent;
  hlc: Hlc;
  acceptedAt: string;
}

/**
 * Countersign an accepted post with the node receipt keypair. The receipt binds
 * the node key, the publication/channel scope, the post id, the exact signed
 * bytes (eventHash), and the node-assigned HLC. Only the node holding the pinned
 * key can mint one; readers verify against descriptor.postNodeKeyHex.
 */
export function signPublicPostAcceptance(
  node: { publicKeyHex: string; privateKeyHex: string },
  input: SignPublicPostAcceptanceInput,
): PublicPostReceipt {
  const unsigned: UnsignedReceipt = {
    version: 1,
    nodeKeyHex: node.publicKeyHex,
    publicationId: input.post.publicationId,
    channelId: input.post.channelId,
    postId: input.post.postId,
    eventHash: publicPostEventHash(input.post),
    hlc: { wall: input.hlc.wall, counter: input.hlc.counter },
    acceptedAt: input.acceptedAt,
  };
  const signature = bytesToHex(signMessage(node.privateKeyHex, canonicalReceipt(unsigned)));
  return { ...unsigned, signature };
}

function isReceiptShape(receipt: PublicPostReceipt): boolean {
  if (!receipt || typeof receipt !== 'object') return false;
  return (
    receipt.version === 1
    && typeof receipt.nodeKeyHex === 'string'
    && HEX_64.test(receipt.nodeKeyHex)
    && typeof receipt.publicationId === 'string'
    && typeof receipt.channelId === 'string'
    && typeof receipt.postId === 'string'
    && typeof receipt.eventHash === 'string'
    && typeof receipt.hlc === 'object'
    && receipt.hlc !== null
    && typeof receipt.hlc.wall === 'string'
    && typeof receipt.hlc.counter === 'number'
    && typeof receipt.acceptedAt === 'string'
    && typeof receipt.signature === 'string'
  );
}

/**
 * Dual-signature verification of an accepted public post, FAIL-CLOSED on every
 * axis (Plan 26 P2):
 *  - 'invalid_post'      author shape/id/signature failure (forged or tampered post);
 *  - 'node_key_mismatch' the receipt's node key is not the PINNED key from the
 *                        descriptor (node substitution);
 *  - 'invalid_receipt'   receipt shape/binding/signature failure (forged receipt,
 *                        or a receipt transplanted onto different post bytes);
 *  - 'scope_mismatch'    the post/receipt do not match the publication + channel
 *                        the caller is reading (cross-publication transplant);
 *  - 'ok'                both signatures verify and every binding holds.
 */
export function verifyPublicPost(
  accepted: AcceptedPublicPost,
  pinnedNodeKeyHex: string,
  expected?: { publicationId?: string; channelId?: string },
): PublicPostVerdict {
  const post = accepted?.post;
  const receipt = accepted?.receipt;
  if (!post || !verifyPublicPostAuthor(post)) return 'invalid_post';
  if (!receipt || !isReceiptShape(receipt)) return 'invalid_receipt';
  if (typeof pinnedNodeKeyHex !== 'string' || !HEX_64.test(pinnedNodeKeyHex)) {
    // No (or malformed) pinned key = no way to authenticate the node: fail closed.
    return 'node_key_mismatch';
  }
  if (receipt.nodeKeyHex.toLowerCase() !== pinnedNodeKeyHex.toLowerCase()) {
    return 'node_key_mismatch';
  }
  if (
    receipt.postId !== post.postId
    || receipt.publicationId !== post.publicationId
    || receipt.channelId !== post.channelId
    || receipt.eventHash !== publicPostEventHash(post)
  ) {
    return 'invalid_receipt';
  }
  const { signature, ...unsigned } = receipt;
  try {
    if (!verifySignature(receipt.nodeKeyHex, canonicalReceipt(unsigned), hexToBytes(signature))) {
      return 'invalid_receipt';
    }
  } catch {
    return 'invalid_receipt';
  }
  if (expected?.publicationId !== undefined && post.publicationId !== expected.publicationId) {
    return 'scope_mismatch';
  }
  if (expected?.channelId !== undefined && post.channelId !== expected.channelId) {
    return 'scope_mismatch';
  }
  return 'ok';
}

// ---------------------------------------------------------------------------
// Tombstones (owner / node / author removal) + posting freeze (kill switch).
// ---------------------------------------------------------------------------

/** A signed removal record for one public post. */
export interface PublicPostTombstone {
  version: 1;
  publicationId: string;
  postId: string;
  /** The signer's Ed25519 public key (64-hex): the publication owner, the node
   *  receipt key, or the post author's persona key. Anything else is rejected. */
  signerKeyHex: string;
  tombstonedAt: string;
  signature: string;
}

type UnsignedTombstone = Omit<PublicPostTombstone, 'signature'>;

function canonicalTombstone(t: UnsignedTombstone): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      PUBLIC_POST_TOMBSTONE_DOMAIN,
      t.version,
      t.publicationId,
      t.postId,
      t.signerKeyHex,
      t.tombstonedAt,
    ]),
  );
}

/** Create and sign a tombstone for a public post. */
export function createPublicPostTombstone(
  signer: { publicKeyHex: string; privateKeyHex: string },
  input: { publicationId: string; postId: string; now?: string },
): PublicPostTombstone {
  const unsigned: UnsignedTombstone = {
    version: 1,
    publicationId: input.publicationId,
    postId: input.postId,
    signerKeyHex: signer.publicKeyHex,
    tombstonedAt: input.now ?? new Date().toISOString(),
  };
  const signature = bytesToHex(signMessage(signer.privateKeyHex, canonicalTombstone(unsigned)));
  return { ...unsigned, signature };
}

/**
 * Verify a tombstone FAIL-CLOSED: shape, an ALLOWED signer (the caller passes the
 * exact set: publication owner device id, pinned node key, and/or the post's
 * author persona key), and the Ed25519 signature. A tombstone signed by any other
 * key -- even validly -- is rejected, so a stranger can never censor a post.
 */
export function verifyPublicPostTombstone(
  tombstone: PublicPostTombstone,
  allowedSignerKeys: readonly string[],
): boolean {
  if (!tombstone || typeof tombstone !== 'object') return false;
  if (
    tombstone.version !== 1
    || typeof tombstone.publicationId !== 'string'
    || typeof tombstone.postId !== 'string'
    || typeof tombstone.signerKeyHex !== 'string'
    || !HEX_64.test(tombstone.signerKeyHex)
    || typeof tombstone.tombstonedAt !== 'string'
    || typeof tombstone.signature !== 'string'
  ) {
    return false;
  }
  const signer = tombstone.signerKeyHex.toLowerCase();
  if (!allowedSignerKeys.some((k) => typeof k === 'string' && k.toLowerCase() === signer)) {
    return false;
  }
  const { signature, ...unsigned } = tombstone;
  try {
    return verifySignature(tombstone.signerKeyHex, canonicalTombstone(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

/**
 * The one-action kill switch (Plan 39 P6): an owner/operator-signed record that
 * flips a publication's EFFECTIVE posting to view_only (frozen: true) or lifts it
 * (frozen: false) without re-signing the descriptor. The node keeps the freeze
 * with the LATEST frozenAt from an allowed signer and checks it on every submit.
 */
export interface PublicPostingFreeze {
  version: 1;
  publicationId: string;
  frozen: boolean;
  signerKeyHex: string;
  frozenAt: string;
  signature: string;
}

type UnsignedFreeze = Omit<PublicPostingFreeze, 'signature'>;

function canonicalFreeze(f: UnsignedFreeze): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      PUBLIC_POSTING_FREEZE_DOMAIN,
      f.version,
      f.publicationId,
      f.frozen,
      f.signerKeyHex,
      f.frozenAt,
    ]),
  );
}

/** Create and sign a posting freeze/unfreeze record. */
export function createPublicPostingFreeze(
  signer: { publicKeyHex: string; privateKeyHex: string },
  input: { publicationId: string; frozen: boolean; now?: string },
): PublicPostingFreeze {
  const unsigned: UnsignedFreeze = {
    version: 1,
    publicationId: input.publicationId,
    frozen: input.frozen,
    signerKeyHex: signer.publicKeyHex,
    frozenAt: input.now ?? new Date().toISOString(),
  };
  const signature = bytesToHex(signMessage(signer.privateKeyHex, canonicalFreeze(unsigned)));
  return { ...unsigned, signature };
}

/**
 * Verify a freeze record FAIL-CLOSED: shape, an ALLOWED signer (publication owner
 * and/or the node's trusted operator authority), and the Ed25519 signature.
 */
export function verifyPublicPostingFreeze(
  freeze: PublicPostingFreeze,
  allowedSignerKeys: readonly string[],
): boolean {
  if (!freeze || typeof freeze !== 'object') return false;
  if (
    freeze.version !== 1
    || typeof freeze.publicationId !== 'string'
    || typeof freeze.frozen !== 'boolean'
    || typeof freeze.signerKeyHex !== 'string'
    || !HEX_64.test(freeze.signerKeyHex)
    || typeof freeze.frozenAt !== 'string'
    || typeof freeze.signature !== 'string'
  ) {
    return false;
  }
  const signer = freeze.signerKeyHex.toLowerCase();
  if (!allowedSignerKeys.some((k) => typeof k === 'string' && k.toLowerCase() === signer)) {
    return false;
  }
  const { signature, ...unsigned } = freeze;
  try {
    return verifySignature(freeze.signerKeyHex, canonicalFreeze(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}
