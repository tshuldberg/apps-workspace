/**
 * Remote node store: the network twin of `store.ts` (plan 14, MK readiness #1).
 *
 * `fetchFromStore` opens a sealed share that is pinned in the LOCAL store. But a
 * share link pasted from a friend or another device points at content this
 * device has never seen -- so `fetchFromStore` returns `content-not-pinned`.
 * This module closes that gap: it fetches the manifest + ciphertext blocks from
 * a REMOTE host, reassembles the SealedShare, and opens it with the link key.
 *
 * The design mirrors the local path exactly. `RemoteNodeSource` is the read
 * side of `NodeStore` (getManifest / getBlock) reached over an injected
 * transport, and `fetchFromHosts` is the twin of `fetchFromStore` with
 * multi-host failover. Trust lives entirely in `openSealedShare`: a host that
 * is missing the content, or serves tampered bytes, is SKIPPED (fail-closed),
 * never trusted -- so an untrusted web seed is safe to fetch from. The local
 * store is just a host you already hold.
 *
 * RN-safe: the client uses an injected `fetch` and tweetnacl only (no
 * node:crypto, no node:net), so it runs unchanged from `index.native`. The
 * matching server adapter (`handleNodeStoreHttp`) is pure too, so the same code
 * serves on a desktop seeder, a device, or in tests.
 */

import type { SealedShare, OpenResult } from './sealed-share';
import { openSealedShare } from './sealed-share';
import type { NodeStore, PinnedManifest } from './store';
import { pinShare } from './store';

/**
 * A read-only, content-addressed view of a REMOTE node's store. The two reads
 * mirror `NodeStore`; the transport (HTTP web seed, relay block channel, LAN
 * peer) is the implementation's concern. Either method returns null when this
 * host simply does not hold the requested item, so the caller can fail over.
 */
export interface RemoteNodeSource {
  /** The signed manifest index for a content id, or null if this host lacks it. */
  getManifest(contentId: string): Promise<PinnedManifest | null>;
  /** One ciphertext block by sealed id, or null if this host lacks it. */
  getBlock(sealedId: string): Promise<string | null>;
}

export type RemoteFetchResult =
  | { ok: true; content: Uint8Array; name: string }
  | { ok: false; reason: string };

export type RemotePinnedFetchResult =
  | { ok: true; content: Uint8Array; name: string; pinned: boolean; pinError?: string }
  | { ok: false; reason: string };

/**
 * Reassemble a SealedShare from a remote source's manifest + blocks. Returns
 * null when the host is missing the manifest or any block (an incomplete seed),
 * which tells `fetchFromHosts` to try the next host. NO trust is placed in the
 * bytes here -- `openSealedShare` verifies the signature, content id, and every
 * chunk afterwards.
 */
async function loadFromRemote(
  source: RemoteNodeSource,
  contentId: string,
): Promise<SealedShare | null> {
  const record = await source.getManifest(contentId);
  if (!record) return null;
  let manifest: SealedShare['manifest'];
  try {
    manifest = JSON.parse(record.manifestJson) as SealedShare['manifest'];
  } catch {
    return null;
  }
  const sealedChunks: SealedShare['sealedChunks'] = [];
  for (let i = 0; i < record.sealedChunkIds.length; i++) {
    const sealedId = record.sealedChunkIds[i]!;
    const payload = await source.getBlock(sealedId);
    if (payload === null) return null;
    sealedChunks.push({ index: i, sealedId, payload });
  }
  return { manifest, manifestSignature: record.manifestSignature, sealedChunks };
}

/**
 * Fetch a sealed share from one or more REMOTE hosts and open it with the link
 * key -- the network twin of `fetchFromStore`. Hosts are tried in order; the
 * first that returns a COMPLETE, VERIFIABLE share wins. A host that is missing
 * the content, unreachable, or serving tampered bytes is skipped, and the last
 * failure reason is returned if no host succeeds.
 */
export async function fetchFromHosts(
  hosts: RemoteNodeSource[],
  contentId: string,
  linkKey: Uint8Array,
  options?: { expectedAuthor?: string },
): Promise<RemoteFetchResult> {
  if (hosts.length === 0) return { ok: false, reason: 'no-hosts' };
  let lastReason = 'content-unavailable';
  for (const host of hosts) {
    let share: SealedShare | null;
    try {
      share = await loadFromRemote(host, contentId);
    } catch {
      lastReason = 'host-unreachable';
      continue;
    }
    if (!share) {
      lastReason = 'content-unavailable';
      continue;
    }
    const opened: OpenResult = openSealedShare(share, linkKey, options);
    if (opened.ok) return { ok: true, content: opened.content, name: share.manifest.name };
    // Tampered, wrong key, or wrong host -- record why and try the next host.
    lastReason = opened.reason;
  }
  return { ok: false, reason: lastReason };
}

/**
 * Fetch, verify, open, and then pin a remote sealed share into the local store.
 * Pinning happens only after `openSealedShare` verifies the manifest signature,
 * content id, chunk hashes, and authenticated decryption. A local write failure
 * still returns the opened content with `pinned: false` so the app can show the
 * bytes while honestly reporting that the node did not seed them.
 */
export async function fetchAndPinFromHosts(
  hosts: RemoteNodeSource[],
  store: NodeStore,
  contentId: string,
  linkKey: Uint8Array,
  options?: { expectedAuthor?: string },
): Promise<RemotePinnedFetchResult> {
  if (hosts.length === 0) return { ok: false, reason: 'no-hosts' };
  let lastReason = 'content-unavailable';
  for (const host of hosts) {
    let share: SealedShare | null;
    try {
      share = await loadFromRemote(host, contentId);
    } catch {
      lastReason = 'host-unreachable';
      continue;
    }
    if (!share) {
      lastReason = 'content-unavailable';
      continue;
    }
    const opened: OpenResult = openSealedShare(share, linkKey, options);
    if (!opened.ok) {
      lastReason = opened.reason;
      continue;
    }
    try {
      await pinShare(store, share);
      return { ok: true, content: opened.content, name: share.manifest.name, pinned: true };
    } catch (error) {
      return {
        ok: true,
        content: opened.content,
        name: share.manifest.name,
        pinned: false,
        pinError: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { ok: false, reason: lastReason };
}

/**
 * An HTTP web-seed `RemoteNodeSource`. The host serves
 *   GET {baseUrl}/manifest/{contentId} -> PinnedManifest JSON
 *   GET {baseUrl}/block/{sealedId}     -> block payload text
 * matching the read side of `NodeStore` (and `handleNodeStoreHttp` below).
 * `fetchFn` is injected so this stays RN-safe and unit-testable.
 */
export function httpNodeSource(baseUrl: string, fetchFn: typeof fetch = fetch): RemoteNodeSource {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    async getManifest(contentId) {
      const res = await fetchFn(`${base}/manifest/${encodeURIComponent(contentId)}`);
      if (!res.ok) return null;
      try {
        return (await res.json()) as PinnedManifest;
      } catch {
        return null;
      }
    },
    async getBlock(sealedId) {
      const res = await fetchFn(`${base}/block/${encodeURIComponent(sealedId)}`);
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      return text.length > 0 ? text : null;
    },
  };
}

export interface NodeStoreHttpResponse {
  status: number;
  contentType: string;
  body: string;
}

const MANIFEST_PATH = /^\/manifest\/([^/]+)$/;
const BLOCK_PATH = /^\/block\/([^/]+)$/;

/**
 * Server adapter: map a GET path against a local `NodeStore` to the web-seed
 * response `httpNodeSource` expects. Returns null when the path is not a
 * node-store route, so a host can fall through to its other handlers. PURE (no
 * node:http), so a desktop seeder, a device, or a test can all mount it:
 *
 *   const r = await handleNodeStoreHttp(store, req.url);
 *   if (r) res.writeHead(r.status, { 'Content-Type': r.contentType }).end(r.body);
 *
 *   GET /manifest/{contentId} -> 200 PinnedManifest JSON | 404
 *   GET /block/{sealedId}     -> 200 block payload text  | 404
 */
export async function handleNodeStoreHttp(
  store: NodeStore,
  urlPath: string,
): Promise<NodeStoreHttpResponse | null> {
  const path = urlPath.split('?')[0]!.split('#')[0]!;

  const manifestMatch = MANIFEST_PATH.exec(path);
  if (manifestMatch) {
    const record = await store.getManifest(decodeURIComponent(manifestMatch[1]!));
    if (!record) return { status: 404, contentType: 'application/json', body: '{"error":"not-found"}' };
    return { status: 200, contentType: 'application/json', body: JSON.stringify(record) };
  }

  const blockMatch = BLOCK_PATH.exec(path);
  if (blockMatch) {
    const payload = await store.getBlock(decodeURIComponent(blockMatch[1]!));
    if (payload === null) return { status: 404, contentType: 'text/plain', body: '' };
    return { status: 200, contentType: 'text/plain', body: payload };
  }

  return null;
}
