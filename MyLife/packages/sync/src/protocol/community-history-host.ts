/**
 * Sealed community-history host registry (Plan 43 WP-43D, "Automatic private
 * history"). The private-community twin of node/host-registry.ts: where that
 * layer lets share-link holders discover WHO serves a public contentId, this
 * layer lets community MEMBERS discover WHERE their community's cold-start
 * history snapshot is served -- WITHOUT ever leaking who is a member, which
 * device announced the host, or the community id to the relay.
 *
 * The problem it solves: a member who joins (or reinstalls) sees a channel with
 * PARTIAL history. The full cold-start body lives on an always-on seeder (the
 * community node) reachable at some URL, but that URL is not in the signed
 * descriptor (the descriptor is portable and the serving URL rotates). A node
 * that genuinely serves the history announces a sealed HistoryHostRecord under a
 * community-secret-derived registry id; a member resolves it and feeds the URL
 * into the UNCHANGED pullCommunityFeed verify-then-import path. Trust stays
 * exactly where it was: a resolved host is a CANDIDATE, never trusted -- a
 * spoofed URL yields bytes that fail pullCommunityFeed's auth + snapshot +
 * per-piece verification, so nothing forged is ever imported.
 *
 * Zero-knowledge boundary (do NOT weaken):
 *  - The registry id is HKDF(communitySecret) truncated to 64 hex, so the relay
 *    never sees the community id and cannot enumerate which communities have a
 *    history host from the rid alone. This mirrors deriveContentRegistryId and
 *    deriveCommunityNotifyToken exactly.
 *  - The announce record is secretbox(HistoryHostRecord) under HKDF(communitySecret),
 *    a key only descriptor-holders (who know the genesisNonce) can derive, so a
 *    relay operator who base64-decodes a record learns nothing. Fresh nonce per
 *    seal. The community id is bound INSIDE the authenticated box (like
 *    community-notify's seal), so the reader stays a true 2-arg
 *    (communitySecret, ciphertext) function and a tampered id fails the MAC.
 *  - The record carries NO stable member or device identity -- only serving
 *    metadata (a short-lived URL, the descriptor revision it serves, the snapshot
 *    version, a max object size, and an expiry). A member who opens it learns
 *    only where + how to pull, never who announced it.
 *
 * The community secret is the descriptor's `genesisNonce` (hex), the SAME secret
 * community-notify.ts derives its notify token + seal key from. Every member AND
 * the zero-knowledge node hold the signed descriptor, so all of them can derive
 * the registry id (to announce / resolve) and open the sealed record WITHOUT any
 * epoch key. A random third party who does not hold the descriptor cannot.
 *
 * No new crypto scheme: HKDF + secretbox via the package helpers (the exact
 * primitives host-registry.ts and community-notify.ts already ship). RN-safe:
 * tweetnacl + the package's own HKDF only (no node:crypto, no sockets), so it
 * runs unchanged from index.native.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { hkdf, sha512Hex } from '../node/hkdf';
import { hexToBytes } from '../encryption/keys';
import type { SignedCommunityDescriptor } from './community';

const { decodeUTF8, encodeUTF8 } = naclUtil;
const encoder = new TextEncoder();

const REGISTRY_ID_INFO = 'meerkat-community-history-host-id-v1';
const REGISTRY_KEY_INFO = 'meerkat-community-history-host-seal-v1';
const NONCE_BYTES = nacl.secretbox.nonceLength;

/**
 * The serving metadata a history host announces. It is DELIBERATELY free of any
 * stable member or device identity: it names WHERE + HOW to pull, never WHO.
 * `communityId` binds the record to one community (checked inside the seal MAC),
 * but the community id is not an identity -- every descriptor-holder already
 * knows it.
 */
export interface HistoryHostRecord {
  /** The community this host serves (bound inside the authenticated box). */
  communityId: string;
  /** The reachable serving base url. MUST be a TLS (https) url in production. */
  hostUrl: string;
  /** The descriptor revision the host currently serves (staleness signal). */
  descriptorRevision: number;
  /** The snapshot format version the host serves (the reader checks support). */
  snapshotVersion: number;
  /** Per-object byte cap the host enforces (the reader's transfer expectation). */
  maxObjectBytes: number;
  /** ISO expiry; a record at/after this time is treated as absent (fail-closed). */
  expiresAt: string;
}

/** The supported snapshot format version this build's pull path understands. */
export const HISTORY_HOST_SNAPSHOT_VERSION = 1;

/** The bytes of the community secret (the descriptor's genesisNonce). */
function secretBytes(communitySecret: string): Uint8Array {
  // genesisNonce is hex (bytesToHex of randomBytes(16)); fall back to UTF-8 bytes
  // if a caller passes a non-hex secret, so the derivation never throws. Mirrors
  // community-notify.ts::secretBytes exactly.
  if (/^[0-9a-fA-F]+$/.test(communitySecret) && communitySecret.length % 2 === 0) {
    return hexToBytes(communitySecret);
  }
  return encoder.encode(communitySecret);
}

/**
 * Derive the OPAQUE relay registry id for a community's history host. The relay
 * only ever sees this 64-hex value, never the community id or the secret. Same
 * HKDF + sha512Hex construction as deriveContentRegistryId / deriveMailboxToken,
 * so every descriptor-holder deterministically agrees on the rid while the relay
 * cannot recover the community from it.
 *
 * The community id is NOT folded into the KDF info: the genesisNonce is already
 * unique per community, so it is a sufficient per-community separator (identical
 * reasoning to community-notify's seal-key note).
 */
export function deriveCommunityHistoryRegistryId(communitySecret: string): string {
  return sha512Hex(hkdf(secretBytes(communitySecret), REGISTRY_ID_INFO)).slice(0, 64);
}

/** The symmetric key that seals/opens a history-host record for a community. */
function sealKey(communitySecret: string): Uint8Array {
  return hkdf(secretBytes(communitySecret), REGISTRY_KEY_INFO);
}

/** True when `value` is a well-formed HistoryHostRecord (fail-closed on any junk). */
function isHistoryHostRecord(value: unknown): value is HistoryHostRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<HistoryHostRecord>;
  return (
    typeof r.communityId === 'string' && r.communityId.length > 0
    && typeof r.hostUrl === 'string' && r.hostUrl.length > 0
    && typeof r.descriptorRevision === 'number' && Number.isFinite(r.descriptorRevision)
    && typeof r.snapshotVersion === 'number' && Number.isFinite(r.snapshotVersion)
    && typeof r.maxObjectBytes === 'number' && Number.isFinite(r.maxObjectBytes)
    && typeof r.expiresAt === 'string' && r.expiresAt.length > 0
  );
}

/**
 * Seal a HistoryHostRecord into an opaque announce record (nonce || ciphertext,
 * base64). Only a descriptor-holder (who knows the genesisNonce) can open it; the
 * relay stores opaque bytes and learns nothing. A fresh nonce per seal.
 *
 * Throws on a malformed record so a caller cannot announce junk that would only
 * fail-closed on the reader; the announce side owns record validity.
 */
export function sealCommunityHistoryHost(
  communitySecret: string,
  record: HistoryHostRecord,
): string {
  if (!isHistoryHostRecord(record)) {
    throw new Error('sealCommunityHistoryHost: malformed HistoryHostRecord.');
  }
  const key = sealKey(communitySecret);
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.secretbox(decodeUTF8(JSON.stringify(record)), nonce, key);
  const out = new Uint8Array(NONCE_BYTES + box.length);
  out.set(nonce, 0);
  out.set(box, NONCE_BYTES);
  return naclUtil.encodeBase64(out);
}

/**
 * Open one opaque announce record. Fail-closed: a wrong community secret, tampered
 * bytes, a malformed record, or a non-http(s) url all return null. The
 * authenticated secretbox MAC is the boundary -- a tampered communityId (or any
 * other field) breaks the MAC and reads null, so the returned record is exactly
 * what the announcer sealed. No stable identity is present to leak.
 */
export function openCommunityHistoryHost(
  communitySecret: string,
  ciphertext: string,
): HistoryHostRecord | null {
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) return null;
  let bytes: Uint8Array;
  try {
    bytes = naclUtil.decodeBase64(ciphertext);
  } catch {
    return null;
  }
  if (bytes.length <= NONCE_BYTES) return null;
  const nonce = bytes.slice(0, NONCE_BYTES);
  const box = bytes.slice(NONCE_BYTES);
  const opened = nacl.secretbox.open(box, nonce, sealKey(communitySecret));
  if (!opened) return null;
  try {
    const parsed = JSON.parse(encodeUTF8(opened)) as unknown;
    if (!isHistoryHostRecord(parsed)) return null;
    // A record must carry a real http(s) url; a non-url is not a serving host.
    if (!/^https?:\/\//.test(parsed.hostUrl)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Verify a sealed record is consistent with the community's signed descriptor,
 * fail-closed. This is a CHEAP structural cross-check the reader runs BEFORE any
 * network pull; it is NOT the cryptographic trust anchor (pullCommunityFeed's
 * per-member auth + snapshot + per-piece verification is). It rejects a stale or
 * cross-community record early:
 *  - the record's communityId MUST equal the descriptor's communityId;
 *  - the record MUST NOT claim a descriptor revision NEWER than the one the
 *    caller holds (a host cannot serve a future revision this member has not
 *    verified); an equal-or-older revision is fine (the host may lag).
 *  - the snapshot version MUST be one this build can pull.
 *
 * The descriptor itself is assumed already verified by the caller (owner
 * signature checked via verifyCommunityDescriptor / verifyDescriptorOwnerSignature
 * upstream); this function does not re-verify the signature, it binds the record
 * to the descriptor's authenticated fields.
 */
export function verifyHistoryHostDescriptor(
  record: HistoryHostRecord,
  descriptor: SignedCommunityDescriptor,
): boolean {
  if (!isHistoryHostRecord(record)) return false;
  const d = descriptor?.descriptor;
  if (!d || typeof d.communityId !== 'string' || typeof d.revision !== 'number') return false;
  if (record.communityId !== d.communityId) return false;
  if (record.descriptorRevision > d.revision) return false;
  if (record.snapshotVersion !== HISTORY_HOST_SNAPSHOT_VERSION) return false;
  return true;
}

/**
 * True when a record has not yet expired at `now`. Fail-closed: an unparseable or
 * absent expiry, or an expiry at/before now, is treated as expired (false). The
 * reader uses this to drop stale hosts before any pull.
 */
export function isHistoryHostRecordFresh(record: HistoryHostRecord, now: string): boolean {
  if (!isHistoryHostRecord(record)) return false;
  const expiry = Date.parse(record.expiresAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(expiry) || !Number.isFinite(nowMs)) return false;
  return expiry > nowMs;
}

/**
 * True when a record's url is a TLS (https) url. Production readers REQUIRE this
 * (a plaintext http host is rejected before any pull); a caller may relax it for
 * a loopback dev host behind a flag, but the default posture is https-only.
 */
export function isHistoryHostUrlTls(record: HistoryHostRecord): boolean {
  if (!isHistoryHostRecord(record)) return false;
  return /^https:\/\//.test(record.hostUrl);
}
