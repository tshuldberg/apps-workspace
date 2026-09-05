/**
 * Automatic community-history discovery + verify-then-commit import loop (Plan 43
 * WP-43D, "Automatic client behavior"). The client-side driver that turns a
 * partial-history channel into a caught-up one WITHOUT the user pasting a manual
 * import link.
 *
 * It is a PURE core: every side effect is injected (resolve sealed records, pull
 * a candidate host, commit the verified batch, read/write the verified-host
 * cache). That keeps it RN-safe (no fetch / no sockets at module load, no
 * node:crypto) and unit-testable over mocks, matching pullCommunityFeed and
 * lookupContentHosts which it composes. The app wires the injected fns to the
 * real relay registry client and the real pullCommunityFeed; this file owns the
 * ORDER of checks and the all-or-nothing commit discipline, not the transport.
 *
 * The flow (each step fails closed to the next fallback, never to a false import):
 *  1. Resolve the community-secret-derived registry id to sealed candidate
 *     records (injected `resolveHosts`; the app wraps lookupContentHosts's relay
 *     round-trip keyed by deriveCommunityHistoryRegistryId).
 *  2. Open each sealed record with the community secret (fail-closed), then apply
 *     the CHEAP pre-pull gates in order: TLS (https) url, freshness (not expired),
 *     and descriptor consistency (verifyHistoryHostDescriptor: same community,
 *     not-newer revision, supported snapshot version). Any failure drops the one
 *     candidate; it never aborts the whole resolve.
 *  3. For each surviving candidate, pull into a TEMPORARY batch via the injected
 *     `pullHost` (the app wraps pullCommunityFeed, whose per-member auth +
 *     snapshot-manifest signature + every-piece-hash + epoch/scope + inner
 *     author-signature verification is the real trust anchor -- the sealed record
 *     is only discovery). A pull that fails ANY of those verifications returns
 *     ok:false and NOTHING is committed for that host.
 *  4. COMMIT the verified batch (messages + cursor) via the injected `commit`
 *     ONLY after the entire pull verified. All-or-nothing: a partial or failed
 *     pull commits nothing, so a spoofed / corrupt host can never leave a half-
 *     imported channel.
 *  5. On a committed host, CACHE it (verified, with its TTL) via `cacheHost` and
 *     return imported. On no surviving candidate or every candidate failing,
 *     return a MANUAL-fallback result with an honest reason -- the caller shows
 *     the manual import affordance.
 *
 * Caching: a verified host is cached until its record TTL (the record's
 * `expiresAt`). A subsequent run within TTL reuses the cached host and SKIPS the
 * resolve+seal round-trip (the injected `readCachedHost` returns it); the loop
 * still re-pulls + re-verifies through `pullHost`, so the cache saves the
 * discovery round-trip, never the verification. A failed pull evicts the cache
 * entry (`cacheHost(null)`) so the next run re-resolves.
 */

import {
  isHistoryHostRecordFresh,
  isHistoryHostUrlTls,
  openCommunityHistoryHost,
  verifyHistoryHostDescriptor,
  type HistoryHostRecord,
} from '../protocol/community-history-host';
import type { SignedCommunityDescriptor } from '../protocol/community';
import type { ChannelMessageEvent, Hlc } from '../protocol/channel-message';

/** One channel's verified events + warm-tail delta from a host pull. */
export interface HistoryPullChannel {
  channelId: string;
  /** Full resolved-order event set the pull verified for this channel. */
  events: ChannelMessageEvent[];
  /** Events strictly after the caller's per-channel cursor (the warm delta). */
  newEvents: ChannelMessageEvent[];
}

/** The verified result of pulling ONE candidate host, or an honest failure. */
export type HistoryPullResult =
  | { ok: true; channels: HistoryPullChannel[] }
  | { ok: false; reason: string };

/**
 * Pull + verify a candidate host's history into a temporary (uncommitted) batch.
 * The app wires this to pullCommunityFeed (or the private-community equivalent):
 * it MUST do the full per-member auth + snapshot + per-piece + author
 * verification and return ok:false on ANY failure. The loop treats ok:true as
 * "the entire snapshot verified" and only then commits.
 */
export type HistoryHostPuller = (input: {
  hostUrl: string;
  record: HistoryHostRecord;
}) => Promise<HistoryPullResult>;

/** Resolve the community-secret-derived registry id to sealed candidate records. */
export type HistoryHostResolver = () => Promise<string[]>;

/** Commit a fully-verified batch (messages + cursor). Called ONLY on ok:true. */
export type HistoryBatchCommitter = (batch: {
  hostUrl: string;
  record: HistoryHostRecord;
  channels: HistoryPullChannel[];
}) => Promise<void> | void;

/**
 * Read the last verified host for this community from the caller's cache, or null.
 * Returning a record lets the loop skip the resolve round-trip (it still re-pulls
 * + re-verifies through pullHost).
 */
export type CachedHostReader = () => HistoryHostRecord | null;

/**
 * Persist (or evict) the verified host in the caller's cache. Called with the
 * record on a committed host (cache until record.expiresAt) and with null to
 * evict after a failed pull.
 */
export type CachedHostWriter = (record: HistoryHostRecord | null) => void;

export interface RunAutomaticHistorySyncInput {
  /** The community secret (descriptor genesisNonce) used to derive + open records. */
  communitySecret: string;
  /** The caller-verified signed descriptor (owner signature already checked upstream). */
  descriptor: SignedCommunityDescriptor;
  /** Resolve sealed candidate records off the relay (keyed by the derived rid). */
  resolveHosts: HistoryHostResolver;
  /** Pull + verify one candidate host into a temporary batch (the real trust anchor). */
  pullHost: HistoryHostPuller;
  /** Commit a fully-verified batch. Called ONLY after a whole-snapshot ok:true. */
  commit: HistoryBatchCommitter;
  /** Optional per-community verified-host cache (skips the resolve round-trip within TTL). */
  readCachedHost?: CachedHostReader;
  cacheHost?: CachedHostWriter;
  /**
   * Reject a non-TLS (plaintext http) host. Default true (production posture). A
   * dev caller may pass false to allow a loopback http host; the default is
   * https-only.
   */
  requireTls?: boolean;
  /** ISO clock for the freshness check + record parsing. Defaults to now. */
  now?: string;
}

export type RunAutomaticHistorySyncResult =
  | {
    /** A verified host was found, its snapshot fully verified, and the batch committed. */
    outcome: 'imported';
    hostUrl: string;
    record: HistoryHostRecord;
    channels: HistoryPullChannel[];
    /** True when the host came from the verified cache (resolve round-trip skipped). */
    fromCache: boolean;
  }
  | {
    /** No usable host: fall back to manual import. `reason` is honest + specific. */
    outcome: 'manual_fallback';
    reason:
      | 'no_host_announced'
      | 'no_valid_host'
      | 'all_hosts_failed'
      | 'resolve_failed';
    /** How many sealed records resolved (0 when none announced or resolve threw). */
    resolved: number;
    /** How many survived the cheap pre-pull gates (TLS, fresh, descriptor). */
    eligible: number;
  };

/** Apply the cheap pre-pull gates to an opened record; null-in stays out. */
function isEligible(
  record: HistoryHostRecord,
  descriptor: SignedCommunityDescriptor,
  requireTls: boolean,
  now: string,
): boolean {
  if (requireTls && !isHistoryHostUrlTls(record)) return false;
  if (!isHistoryHostRecordFresh(record, now)) return false;
  if (!verifyHistoryHostDescriptor(record, descriptor)) return false;
  return true;
}

/**
 * Run one automatic-history pass for a community with partial history. Returns
 * either an `imported` result (a verified host's whole snapshot committed) or a
 * `manual_fallback` result (show the manual import affordance) with an honest
 * reason. NEVER commits a partially-verified or failed pull.
 */
export async function runAutomaticHistorySync(
  input: RunAutomaticHistorySyncInput,
): Promise<RunAutomaticHistorySyncResult> {
  const now = input.now ?? new Date().toISOString();
  const requireTls = input.requireTls ?? true;

  // Fast path: a cached verified host still within its TTL + descriptor-consistent.
  // We still re-pull + re-verify; the cache only saves the resolve round-trip.
  // A THROWING pull/commit (network error in the real wiring, not an ok:false) is
  // treated exactly like a failed pull: evict + fall through to a fresh resolve.
  // The commit contract is all-or-nothing, so a throwing commit imported nothing.
  const cached = input.readCachedHost?.() ?? null;
  if (cached && isEligible(cached, input.descriptor, requireTls, now)) {
    try {
      const pulled = await input.pullHost({ hostUrl: cached.hostUrl, record: cached });
      if (pulled.ok) {
        await input.commit({ hostUrl: cached.hostUrl, record: cached, channels: pulled.channels });
        input.cacheHost?.(cached);
        return {
          outcome: 'imported',
          hostUrl: cached.hostUrl,
          record: cached,
          channels: pulled.channels,
          fromCache: true,
        };
      }
    } catch {
      // fall through to eviction + resolve, same as a returned failure
    }
    // A cached host that no longer verifies is evicted; fall through to a resolve.
    input.cacheHost?.(null);
  }

  // Resolve sealed candidate records off the relay. A throwing resolver (relay
  // unreachable) degrades to the manual fallback with an honest reason instead of
  // rejecting the whole pass.
  let sealed: string[];
  try {
    sealed = await input.resolveHosts();
  } catch {
    return { outcome: 'manual_fallback', reason: 'resolve_failed', resolved: 0, eligible: 0 };
  }
  if (sealed.length === 0) {
    return { outcome: 'manual_fallback', reason: 'no_host_announced', resolved: 0, eligible: 0 };
  }

  // Open + gate each candidate (fail-closed per record; a bad record never aborts).
  const eligible: HistoryHostRecord[] = [];
  const seenUrls = new Set<string>();
  for (const ciphertext of sealed) {
    const record = openCommunityHistoryHost(input.communitySecret, ciphertext);
    if (!record) continue;
    if (!isEligible(record, input.descriptor, requireTls, now)) continue;
    if (seenUrls.has(record.hostUrl)) continue;
    seenUrls.add(record.hostUrl);
    eligible.push(record);
  }
  if (eligible.length === 0) {
    return { outcome: 'manual_fallback', reason: 'no_valid_host', resolved: sealed.length, eligible: 0 };
  }

  // Try each eligible candidate; commit the FIRST that fully verifies. A failed
  // OR throwing pull commits nothing and moves to the next candidate; a throwing
  // commit (all-or-nothing per its contract) also moves on without caching, so a
  // single bad host or transient network error never rejects the whole pass.
  for (const record of eligible) {
    try {
      const pulled = await input.pullHost({ hostUrl: record.hostUrl, record });
      if (!pulled.ok) continue;
      await input.commit({ hostUrl: record.hostUrl, record, channels: pulled.channels });
      input.cacheHost?.(record);
      return {
        outcome: 'imported',
        hostUrl: record.hostUrl,
        record,
        channels: pulled.channels,
        fromCache: false,
      };
    } catch {
      continue;
    }
  }

  // Every eligible host failed verification: manual fallback, honest reason.
  return {
    outcome: 'manual_fallback',
    reason: 'all_hosts_failed',
    resolved: sealed.length,
    eligible: eligible.length,
  };
}

/** Re-export the warm-tail cursor type callers pass through to their pull wiring. */
export type { Hlc };
