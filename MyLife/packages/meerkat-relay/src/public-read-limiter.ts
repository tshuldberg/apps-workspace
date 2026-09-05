/**
 * Real per-IP / per-byte DoS limiter for the OPEN public read routes (Plan 19
 * P3a, design 5.4 "DoS surface").
 *
 * The open `GET /public/...` read routes are the largest NEW attack surface and
 * the existing relay caps do NOT cover them: `protocol.ts` RELAY_LIMITS bound the
 * WebSocket relay verbs (per-connection envelope rate + global + a per-IP
 * CONNECTION-count cap), none of which throttles request or byte rate on these
 * HTTP reads. This is a SEPARATE in-process limiter; it never reuses the WS rate
 * state.
 *
 * It enforces three real budgets, all as WINDOWED COUNTERS (not token buckets):
 *  - a per-IP REQUEST rate (a rolling timestamp list, pruned to the window),
 *  - a per-IP BYTE rate (a TUMBLING window: the counter resets at the window
 *    boundary, so up to ~2x the budget can pass across a boundary -- still bounded),
 *  - a per-PUBLICATION BYTE ceiling (same tumbling window, across all IPs).
 *
 * Over-budget returns false; the http layer maps that to 429 and NEVER fabricates a
 * success.
 *
 * Bounding memory (CRITICAL): every distinct client key mints a Map entry, so an
 * attacker spraying distinct keys must not grow the Maps without bound. Two guards,
 * mirroring the WS hub (`hub.ts` sweep): a periodic `sweep()` drops fully-stale
 * entries (wire it to the server's interval), and a HARD CAP (`maxTrackedClients`)
 * sweeps-then-evicts-oldest so memory is bounded even between sweeps.
 *
 * DEFENSE IN DEPTH, not the authoritative limiter. The client key trusts only the
 * direct socket by default. Deployments behind controlled reverse proxies must
 * explicitly provide their exact trusted hop count. The authoritative per-IP limit
 * should still live at the edge proxy.
 */

import type { IncomingMessage } from 'node:http';
import { deriveClientAddress } from './client-address';

/**
 * Derive the client key for an inbound request EXACTLY like the relay does
 * (`server.ts`): the first `X-Forwarded-For` hop trimmed when the node sits
 * behind a trusted reverse proxy, else the socket's remote address. Falls back to
 * a constant only when neither is present (cannot be keyed, treated as one bucket).
 */
export function derivePublicClientKey(req: IncomingMessage, trustedProxyHops = 0): string {
  return deriveClientAddress(req, trustedProxyHops);
}

export interface PublicReadLimits {
  /** Max open read requests per client IP per window. */
  requestsPerWindow: number;
  /** Max bytes served to a single client IP per window. */
  bytesPerWindow: number;
  /** Max bytes served for a single publication (across all IPs) per window. */
  perPublicationBytesPerWindow: number;
  /** Rolling/tumbling window in ms. */
  windowMs: number;
  /**
   * Hard cap on the number of distinct client keys tracked at once. When a NEW key
   * would exceed it, the limiter sweeps stale entries then evicts the oldest, so an
   * XFF-spraying attacker cannot grow the Maps without bound between sweeps.
   */
  maxTrackedClients: number;
}

export const DEFAULT_PUBLIC_READ_LIMITS: PublicReadLimits = {
  requestsPerWindow: 120,
  bytesPerWindow: 64 * 1024 * 1024, // 64 MiB / IP / minute
  perPublicationBytesPerWindow: 256 * 1024 * 1024, // 256 MiB / publication / minute
  windowMs: 60_000,
  maxTrackedClients: 50_000,
};

interface ByteWindow {
  windowStart: number;
  bytes: number;
}

/**
 * In-process windowed-counter limiter for the open public read routes. Deterministic
 * under an injected clock so tests can advance time precisely.
 */
export class PublicReadLimiter {
  readonly limits: PublicReadLimits;
  private readonly now: () => number;
  /** clientKey -> recent request times (ms), pruned to the window on access. */
  private readonly requestHits = new Map<string, number[]>();
  /** clientKey -> tumbling byte window. */
  private readonly clientBytes = new Map<string, ByteWindow>();
  /** publicationId -> tumbling byte window (across all IPs). */
  private readonly publicationBytes = new Map<string, ByteWindow>();

  constructor(limits: Partial<PublicReadLimits> = {}, now: () => number = () => Date.now()) {
    this.limits = { ...DEFAULT_PUBLIC_READ_LIMITS, ...limits };
    this.now = now;
  }

  /**
   * Admit one open read request from a client. Returns false (the http layer maps
   * to 429) when the client is over its per-IP request rate. Records the hit only
   * when admitted, so it recovers cleanly once the window rolls forward.
   */
  admitRequest(clientKey: string): boolean {
    const t = this.now();
    const cutoff = t - this.limits.windowMs;
    const hits = (this.requestHits.get(clientKey) ?? []).filter((ts) => ts > cutoff);
    if (hits.length >= this.limits.requestsPerWindow) {
      this.requestHits.set(clientKey, hits);
      return false;
    }
    this.enforceCap(this.requestHits, clientKey, t);
    hits.push(t);
    this.requestHits.set(clientKey, hits);
    return true;
  }

  /**
   * Admit the BYTES a request is about to serve, against BOTH the per-IP byte rate
   * AND the per-publication byte ceiling. Returns false (429) when either budget
   * would be exceeded; the bytes are added only when admitted, so a refused request
   * sends nothing and is not counted. Call AFTER the response size is known and
   * BEFORE writing the body.
   */
  admitBytes(clientKey: string, publicationId: string, bytes: number): boolean {
    const t = this.now();
    this.enforceCap(this.clientBytes, clientKey, t);
    const client = this.roll(this.clientBytes, clientKey, t);
    const publication = this.roll(this.publicationBytes, publicationId, t);
    if (client.bytes + bytes > this.limits.bytesPerWindow) return false;
    if (publication.bytes + bytes > this.limits.perPublicationBytesPerWindow) return false;
    client.bytes += bytes;
    publication.bytes += bytes;
    return true;
  }

  /**
   * Drop fully-stale entries to bound memory. Wire this to the server's sweep
   * interval (mirrors the WS hub). Idempotent and cheap (linear in tracked keys).
   */
  sweep(now: number = this.now()): void {
    const cutoff = now - this.limits.windowMs;
    for (const [key, hits] of this.requestHits) {
      const newest = hits.length ? hits[hits.length - 1]! : -Infinity;
      if (newest <= cutoff) this.requestHits.delete(key);
    }
    for (const map of [this.clientBytes, this.publicationBytes]) {
      for (const [key, win] of map) {
        if (now - win.windowStart >= this.limits.windowMs) map.delete(key);
      }
    }
  }

  /** Distinct client keys currently tracked for request rate (test/observability seam). */
  trackedClientCount(): number {
    return this.requestHits.size;
  }

  /** Resolve (or roll over) a tumbling byte window for a key. */
  private roll(map: Map<string, ByteWindow>, key: string, t: number): ByteWindow {
    const win = map.get(key);
    if (!win || t - win.windowStart >= this.limits.windowMs) {
      const fresh: ByteWindow = { windowStart: t, bytes: 0 };
      map.set(key, fresh);
      return fresh;
    }
    return win;
  }

  /**
   * Keep a Map's distinct-key count bounded before inserting a NEW key: sweep stale
   * entries first, and if still at the cap, evict the oldest-inserted entry (Map
   * iteration order). An existing key never triggers eviction.
   */
  private enforceCap<V>(map: Map<string, V>, key: string, t: number): void {
    if (map.has(key) || map.size < this.limits.maxTrackedClients) return;
    this.sweep(t);
    if (map.size < this.limits.maxTrackedClients) return;
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}
