/**
 * Content-host registry: the contentId-aware layer over the relay's opaque
 * registry verbs (share-link host discovery). The twin of friend-rendezvous.ts.
 *
 * The problem: a share link reveals a contentId + decrypt key, but not WHERE the
 * sealed blocks live. A seeder that genuinely holds and serves the content (a
 * reachable web-seed host) announces "I serve this content at <url>"; an app
 * holding the link resolves that to a candidate host list, then feeds it to the
 * UNCHANGED fetchAndPinFromHosts -> openSealedShare verify-then-pin path. Trust
 * stays exactly where it was: a discovered host is a CANDIDATE, never trusted --
 * tampered or wrong-content bytes are skipped fail-closed by openSealedShare.
 *
 * Zero-knowledge against the relay:
 *  - the rid is HKDF(contentId) truncated to 64 hex, so the relay never sees the
 *    contentId and cannot enumerate who-holds-what from the rid alone;
 *  - the announce record is secretbox(hostUrl) under HKDF(contentId), a key only
 *    share-link holders (who know the contentId) can derive, so a relay operator
 *    who base64-decodes a record learns nothing. A fresh nonce per announce.
 * This matches the rendezvous/mailbox metadata posture: the relay sees only
 * sizes and timing within a coarse rid bucket that link-holders already share.
 *
 * RN-safe: tweetnacl + the package's own HKDF only (no node:crypto), so it runs
 * unchanged from index.native.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { hkdf, sha512Hex } from './hkdf';
import {
  announceHost,
  lookupHosts,
  type RegistryClientOptions,
} from '../transport/registry-client';

const { decodeUTF8, encodeUTF8 } = naclUtil;
const encoder = new TextEncoder();

const REGISTRY_ID_INFO = 'meerkat-host-registry-id-v1';
const REGISTRY_KEY_INFO = 'meerkat-host-registry-key-v1';
const NONCE_BYTES = nacl.secretbox.nonceLength;

/**
 * Derive the OPAQUE relay registry id for a contentId. The relay only ever sees
 * this 64-hex value, never the contentId. Same HKDF + sha512Hex construction as
 * deriveMailboxToken, so two share-link holders deterministically agree on the
 * rid while the relay cannot recover the contentId from it.
 */
export function deriveContentRegistryId(contentId: string): string {
  const ikm = encoder.encode(contentId);
  return sha512Hex(hkdf(ikm, REGISTRY_ID_INFO)).slice(0, 64);
}

/**
 * Derive the symmetric key that seals/opens announce records for a contentId.
 * Anyone holding the SHARE LINK knows the contentId and can derive this key (and
 * so read the announced host list); the relay, knowing only the rid, cannot.
 */
export function deriveContentRegistryKey(contentId: string): Uint8Array {
  return hkdf(encoder.encode(contentId), REGISTRY_KEY_INFO);
}

/** Normalize a host base url the same way the app's remote-share box does. */
function normalizeHostUrl(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) return null;
  if (!value.startsWith('https://') && !value.startsWith('http://')) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Seal a host url into an opaque announce record (nonce || ciphertext, base64). */
function sealHostRecord(hostUrl: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.secretbox(decodeUTF8(JSON.stringify({ hostUrl })), nonce, key);
  const out = new Uint8Array(NONCE_BYTES + box.length);
  out.set(nonce, 0);
  out.set(box, NONCE_BYTES);
  return naclUtil.encodeBase64(out);
}

/** Open one opaque announce record; null on any garbage/tamper/bad url (fail-closed). */
function openHostRecord(record: string, key: Uint8Array): string | null {
  try {
    const bytes = naclUtil.decodeBase64(record);
    if (bytes.length <= NONCE_BYTES) return null;
    const nonce = bytes.slice(0, NONCE_BYTES);
    const box = bytes.slice(NONCE_BYTES);
    const opened = nacl.secretbox.open(box, nonce, key);
    if (!opened) return null;
    const parsed = JSON.parse(encodeUTF8(opened)) as { hostUrl?: unknown };
    if (typeof parsed?.hostUrl !== 'string') return null;
    return normalizeHostUrl(parsed.hostUrl);
  } catch {
    return null;
  }
}

export interface AnnounceHeldContentInput extends RegistryClientOptions {
  url: string;
  /** The contentId this node serves (revealed by the share link). */
  contentId: string;
  /** This node's reachable web-seed base url (e.g. https://seed.example). */
  hostUrl: string;
  /** Requested TTL; the relay clamps to its own maximum. */
  ttlMs?: number;
}

/**
 * Announce that this node serves a contentId at a reachable web-seed url. Only a
 * node with a GENUINELY reachable url should call this (a phone has no inbound
 * HTTP and must not announce -- announcing an unreachable url would be
 * dishonest). The record is sealed under the contentId-derived key, so the relay
 * stores opaque bytes and learns nothing.
 */
export async function announceHeldContent(input: AnnounceHeldContentInput): Promise<void> {
  const normalized = normalizeHostUrl(input.hostUrl);
  if (!normalized) throw new Error('announceHeldContent: hostUrl must be an http(s) url.');
  const rid = deriveContentRegistryId(input.contentId);
  const key = deriveContentRegistryKey(input.contentId);
  await announceHost({
    url: input.url,
    rid,
    record: sealHostRecord(normalized, key),
    ttlMs: input.ttlMs,
    webSocketImpl: input.webSocketImpl,
    timeoutMs: input.timeoutMs,
    entitlementToken: input.entitlementToken,
  });
}

export interface LookupContentHostsInput extends RegistryClientOptions {
  url: string;
  /** The contentId from the share link the user is opening. */
  contentId: string;
}

/**
 * Resolve a contentId to the candidate web-seed urls that seeders have announced
 * for it. Each opaque record is secretbox-opened with the contentId-derived key;
 * any record that fails to decrypt, is malformed, or carries a non-http(s) url is
 * SKIPPED fail-closed. Returns a deduped list; an empty list means "no host
 * announced" (the normal not-discovered outcome). Every returned url is still a
 * CANDIDATE -- trust is established only later by fetchAndPinFromHosts.
 */
export async function lookupContentHosts(input: LookupContentHostsInput): Promise<string[]> {
  const rid = deriveContentRegistryId(input.contentId);
  const key = deriveContentRegistryKey(input.contentId);
  const records = await lookupHosts({
    url: input.url,
    rid,
    webSocketImpl: input.webSocketImpl,
    timeoutMs: input.timeoutMs,
    entitlementToken: input.entitlementToken,
  });
  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const record of records) {
    const hostUrl = openHostRecord(record, key);
    if (!hostUrl || seen.has(hostUrl)) continue;
    seen.add(hostUrl);
    hosts.push(hostUrl);
  }
  return hosts;
}
