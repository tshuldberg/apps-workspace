/**
 * Deployable PUBLIC DIRECTORY NODE (Plan 19 P3b, design §5.4 "public-directory-node").
 *
 * A THIRD deployable image alongside the slim relay (server.ts) and the always-on
 * community node (community-node.ts). It is the discovery service for the public
 * social layer: it stores the signed publication records that the P2 client
 * (`packages/sync/src/node/public-directory.ts`) announces under category + search
 * rids, verifies them on store, and serves browse / search / trending.
 *
 * Protocol compatibility (DELIBERATE): the node speaks the EXACT same relay verbs
 * the P2 directory client already talks -- `{t:'ann',rid,rec,ttlMs?}` -> `{t:'annok'}`
 * and `{t:'lk',rid}` -> `{t:'hosts',rid,recs}` -- so a P2 client pointed at the
 * directory node's url runs UNCHANGED for announcePublication / browsePublications /
 * searchPublications. It adds ONE new verb, `{t:'trend',category?,limit?}` ->
 * `{t:'trending',recs}`, for the ranked discovery feed. Host announcements (the
 * sealed `announceHeldContent` records under `deriveContentRegistryId(contentId)`)
 * ride the same `ann` verb and are stored opaquely so the node can COUNT distinct
 * serving hosts per publication.
 *
 * Honest trending (FIRM): trending ranks by the REAL distinct announcing-host count
 * (distinct announcers under the publication's content rid) FIRST, then recency (the
 * owner-signed `descriptor.updatedAt`) -- NOTHING else. There is NO owner-claimed
 * eventCount, NO view/like/engagement scoring: those are inflatable and would be a
 * fabricated metric. The two ranking signals are real: a distinct host had to
 * announce it serves the content, and the timestamp is owner-signed.
 *
 * Fail-closed posture mirrors the relay + community node:
 *  - verify-on-store: only a genesis, owner-signed, ACTIVE descriptor
 *    (verifyPublication === 'ok' && status === 'active') is stored as a publication;
 *    anything else (invalid / not_owner / killed / a standalone revision) is dropped.
 *    The publicationId is content-recomputed inside verifyPublication.
 *  - signed takedowns: a verified SignedDescriptorKill (against a configured trusted
 *    T&S authority) drops every publication pointing at that community from browse /
 *    search / trending and refuses to re-serve it. The kill ledger is DURABLE
 *    (FileKillStore) so a takedown survives a restart instead of silently reverting.
 *  - durable records: the stored publications persist (FilePublicationDirectoryStore)
 *    so the directory survives a restart; the durable load is fail-closed (each record
 *    is re-verified on boot).
 *
 * Bounded memory (CRITICAL -- this was the P3a finding): every Map is capped AND
 * swept. The publication registry has a global + per-owner cap and a per-publication
 * rid cap; the host registry mirrors the relay's per-rid / global caps; the per-IP
 * limiter (reused from public-read-limiter.ts) sweeps + hard-caps its tracked keys.
 * Nothing grows without bound, even under an attacker spraying distinct rids / IPs.
 */

import http from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  deriveContentRegistryId,
  verifyDescriptorKill,
  verifyPublication,
  verifyOwnerTakedown,
  type PublicCategory,
  type SignedDescriptorKill,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  atomicWriteFile,
  InMemoryKillStore,
  type KillStore,
} from './community-node';
import {
  PublicReadLimiter,
  derivePublicClientKey,
  type PublicReadLimits,
} from './public-read-limiter';
import type { HealthEndpoints } from './service-health';

// ---------------------------------------------------------------------------
// Durable publication store (signed record + the rids it is filed under).
// ---------------------------------------------------------------------------

/** One persisted directory publication: the verbatim signed record, its bucket rids, and TTL. */
export interface DirectoryStoredPublication {
  /** The verbatim JSON of the SignedPublicationDescriptor announced (served on lookup). */
  rec: string;
  /** Category + search rids this record is filed under. */
  rids: string[];
  /** Absolute ms expiry; refreshed by re-announce, swept past it. */
  expiresAt: number;
}

/**
 * Durable registry of stored publications (publicationId -> record). Modeled on the
 * community node's PublicationStore: the deploy artifact passes the File impl so the
 * directory survives a restart; the InMemory default keeps tests + ephemeral nodes
 * socket-free. It holds only owner-signed PUBLIC records -- no secrets.
 */
export interface PublicationDirectoryStore {
  load(): Array<[string, DirectoryStoredPublication]> | Promise<Array<[string, DirectoryStoredPublication]>>;
  put(publicationId: string, record: DirectoryStoredPublication): void | Promise<void>;
  delete(publicationId: string): void | Promise<void>;
}

/** In-memory publication store (default; tests, ephemeral nodes). */
export class InMemoryPublicationDirectoryStore implements PublicationDirectoryStore {
  private readonly records = new Map<string, DirectoryStoredPublication>();
  load(): Array<[string, DirectoryStoredPublication]> {
    return [...this.records.entries()];
  }
  put(publicationId: string, record: DirectoryStoredPublication): void {
    this.records.set(publicationId, record);
  }
  delete(publicationId: string): void {
    this.records.delete(publicationId);
  }
}

/**
 * Filesystem publication store: one JSON file per publication under {baseDir}. The
 * deploy image points this at its DATA_DIR volume so the public discovery registry
 * survives a restart. Writes are atomic (temp + rename, reused from community-node)
 * so a crash mid-write never leaves a corrupt record that would make a publication
 * vanish or re-open an unpublish/kill rollback window.
 */
export class FilePublicationDirectoryStore implements PublicationDirectoryStore {
  constructor(private readonly baseDir: string) {}
  private file(publicationId: string): string {
    // Hex-encode the id so it is always a safe single path segment.
    const safe = Buffer.from(publicationId, 'utf8').toString('hex');
    return path.join(this.baseDir, `${safe}.dirpub.json`);
  }
  async load(): Promise<Array<[string, DirectoryStoredPublication]>> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.baseDir);
    } catch {
      return [];
    }
    const out: Array<[string, DirectoryStoredPublication]> = [];
    for (const name of entries) {
      if (!name.endsWith('.dirpub.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.baseDir, name), 'utf8');
        const parsed = JSON.parse(raw) as Partial<DirectoryStoredPublication> & { publicationId?: string };
        if (typeof parsed.rec !== 'string' || !Array.isArray(parsed.rids) || typeof parsed.expiresAt !== 'number') continue;
        const id = typeof parsed.publicationId === 'string'
          ? parsed.publicationId
          : Buffer.from(name.replace(/\.dirpub\.json$/, ''), 'hex').toString('utf8');
        out.push([id, { rec: parsed.rec, rids: parsed.rids.filter((r): r is string => typeof r === 'string'), expiresAt: parsed.expiresAt }]);
      } catch {
        // skip an unreadable record; the others still load (fail-closed per entry).
      }
    }
    return out;
  }
  async put(publicationId: string, record: DirectoryStoredPublication): Promise<void> {
    await atomicWriteFile(this.file(publicationId), JSON.stringify({ publicationId, ...record }));
  }
  async delete(publicationId: string): Promise<void> {
    try {
      await fs.rm(this.file(publicationId));
    } catch {
      // already gone: nothing to do.
    }
  }
}

// ---------------------------------------------------------------------------
// Node core
// ---------------------------------------------------------------------------

export type DirectoryErrorCode =
  | 'rate_limited'
  | 'owner_full'
  | 'directory_full'
  | 'registry_full'
  | 'rid_full'
  | 'too_large'
  | 'bad_rid'
  | 'service_unavailable';

export type AnnounceResult = { ok: true } | { ok: false; code: DirectoryErrorCode };
export type LookupResult = { ok: true; recs: string[] } | { ok: false; code: DirectoryErrorCode };
export type TrendingResult = { ok: true; recs: string[] } | { ok: false; code: DirectoryErrorCode };

export interface PublicDirectoryLimits {
  /** Global cap on distinct stored publications (memory backstop). */
  maxPublications: number;
  /** Max ACTIVE distinct publications per ownerDeviceId. */
  maxPublicationsPerOwner: number;
  /** Max distinct rids a single publication may occupy (bounds the byRid index). */
  maxRidsPerPublication: number;
  /** Global cap on distinct host-registry rids (mirrors RELAY_LIMITS.maxRegistryRids). */
  maxHostRids: number;
  /** Max distinct announcers (serving hosts) under one content rid. */
  maxAnnouncersPerHostRid: number;
  /** Max record (rec) chars accepted on announce. */
  maxRecordChars: number;
  /** Default + ceiling TTL for a stored publication (refreshed by re-announce). */
  publicationTtlMs: number;
  /** Default + ceiling TTL for a host announcement (mirrors RELAY_LIMITS.registryTtlMs). */
  hostTtlMs: number;
}

export const DEFAULT_PUBLIC_DIRECTORY_LIMITS: PublicDirectoryLimits = {
  maxPublications: 200_000,
  maxPublicationsPerOwner: 100,
  maxRidsPerPublication: 64,
  maxHostRids: 100_000,
  maxAnnouncersPerHostRid: 256,
  maxRecordChars: 32 * 1024,
  publicationTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days; the app re-announces to refresh.
  hostTtlMs: 30 * 60 * 1000,
};

export interface PublicDirectoryNodeOptions {
  /** Durable stored-publication registry. Default in-memory; deploy passes the File impl. */
  publicationStore?: PublicationDirectoryStore;
  /** Durable Trust & Safety kill ledger. Default in-memory; deploy passes FileKillStore. */
  killStore?: KillStore;
  /**
   * Shared authoritative repository for first-party multi-instance deployments.
   * When present, publications and directory kills are read live through this
   * repository instead of being hydrated into process-local Maps.
   */
  repository?: PublicDirectoryRepository;
  /** Host-freshness authority. Default in-memory; first-party production passes PostgreSQL. */
  hostAnnouncementStore?: DirectoryHostAnnouncementStore;
  /** The single T&S authority device id this node trusts for signed takedowns. */
  trustedKillAuthorityDeviceId?: string;
  /** Cap overrides (memory + abuse bounds). */
  limits?: Partial<PublicDirectoryLimits>;
  /** Per-IP limiter overrides for the open endpoints (reused PublicReadLimiter). */
  publicReadLimits?: Partial<PublicReadLimits>;
  /**
   * How long a ranked trending list is cached before recompute (per category).
   * Bounds the cost of the most expensive unauthenticated endpoint so a `trend`
   * flood cannot force a full scan+sort per request. Default 3000ms. Eagerly
   * invalidated on a publication store/kill; host-count freshness rides this TTL.
   */
  trendingCacheTtlMs?: number;
  /** Injectable clock (ms). */
  now?: () => number;
}

const RID_RE = /^[0-9a-f]{16,64}$/;

interface DirectoryPublicationRecord {
  signed: SignedPublicationDescriptor;
  rec: string;
  ownerDeviceId: string;
  communityId: string;
  contentId: string;
  category: PublicCategory;
  updatedAt: string;
  expiresAt: number;
  rids: Set<string>;
}

interface HostSlot {
  rec: string;
  expiresAt: number;
}

export interface DirectoryPublicationAnnouncement {
  signed: SignedPublicationDescriptor;
  rec: string;
  rid: string;
  ttlMs: number;
  limits: PublicDirectoryLimits;
}

export interface DirectoryTrendingCandidate {
  publicationId: string;
  contentId: string;
  rec: string;
  updatedAt: string;
}

export type DirectoryTakedownOutcome = 'recorded' | 'ignored';

/**
 * Authoritative public-directory state used by horizontally scaled deployments.
 * Implementations own publication caps, terminal revisions, live kill visibility,
 * database-time expiry, and bounded indexed projections.
 */
export interface PublicDirectoryRepository {
  storePublication(input: DirectoryPublicationAnnouncement): Promise<AnnounceResult>;
  recordUnpublish(
    signed: SignedPublicationDescriptor,
    tombstoneTtlMs: number,
  ): Promise<DirectoryTakedownOutcome>;
  recordKill(signed: SignedDescriptorKill): Promise<void>;
  lookupPublications(rid: string, maximumRecords: number): Promise<string[]>;
  listTrendingCandidates(
    category: PublicCategory | undefined,
    maximumRecords: number,
  ): Promise<DirectoryTrendingCandidate[]>;
  pruneExpired(): Promise<void>;
}

export interface DirectoryHostAnnouncementInput {
  clientKey: string;
  rid: string;
  rec: string;
  ttlMs: number;
  limits: Pick<
    PublicDirectoryLimits,
    'maxHostRids' | 'maxAnnouncersPerHostRid' | 'maxRecordChars'
  >;
}

/** Shared contract for live, expiring content-host announcements. */
export interface DirectoryHostAnnouncementStore {
  announceHost(input: DirectoryHostAnnouncementInput): AnnounceResult | Promise<AnnounceResult>;
  lookupHosts(rid: string, maximumRecords: number): string[] | Promise<string[]>;
  countLiveHosts(
    rids: readonly string[],
  ): ReadonlyMap<string, number> | Promise<ReadonlyMap<string, number>>;
  pruneExpiredHosts(): void | Promise<void>;
  /** Authoritative observability count. Shared stores must read their shared clock and state. */
  stats(): { liveRids: number } | Promise<{ liveRids: number }>;
}

/** In-memory host freshness for tests, ephemeral nodes, and file-mode self-hosting. */
export class InMemoryDirectoryHostAnnouncementStore implements DirectoryHostAnnouncementStore {
  private readonly hostRids = new Map<string, Map<string, HostSlot>>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  announceHost(input: DirectoryHostAnnouncementInput): AnnounceResult {
    const t = this.now();
    let slots = this.hostRids.get(input.rid);
    if (!slots) {
      this.pruneExpiredHosts();
      if (this.hostRids.size >= input.limits.maxHostRids) {
        return { ok: false, code: 'registry_full' };
      }
      slots = new Map<string, HostSlot>();
      this.hostRids.set(input.rid, slots);
    } else {
      this.pruneRid(input.rid, slots, t);
      slots = this.hostRids.get(input.rid) ?? new Map<string, HostSlot>();
      if (!this.hostRids.has(input.rid)) this.hostRids.set(input.rid, slots);
    }
    if (!slots.has(input.clientKey) && slots.size >= input.limits.maxAnnouncersPerHostRid) {
      return { ok: false, code: 'rid_full' };
    }
    slots.set(input.clientKey, { rec: input.rec, expiresAt: t + input.ttlMs });
    return { ok: true };
  }

  lookupHosts(rid: string, maximumRecords: number): string[] {
    const slots = this.hostRids.get(rid);
    if (!slots) return [];
    this.pruneRid(rid, slots, this.now());
    return [...(this.hostRids.get(rid)?.values() ?? [])]
      .slice(0, Math.max(0, Math.floor(maximumRecords)))
      .map((slot) => slot.rec);
  }

  countLiveHosts(rids: readonly string[]): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    const t = this.now();
    for (const rid of new Set(rids)) {
      const slots = this.hostRids.get(rid);
      if (!slots) continue;
      this.pruneRid(rid, slots, t);
      const count = this.hostRids.get(rid)?.size ?? 0;
      if (count > 0) counts.set(rid, count);
    }
    return counts;
  }

  pruneExpiredHosts(): void {
    const t = this.now();
    for (const [rid, slots] of this.hostRids) this.pruneRid(rid, slots, t);
  }

  stats(): { liveRids: number } {
    this.pruneExpiredHosts();
    return { liveRids: this.hostRids.size };
  }

  private pruneRid(rid: string, slots: Map<string, HostSlot>, t: number): void {
    for (const [key, slot] of slots) {
      if (slot.expiresAt <= t) slots.delete(key);
    }
    if (slots.size === 0) this.hostRids.delete(rid);
  }
}

/** Byte size of a rec list being served (egress-budget accounting; ASCII JSON recs). */
function recordBytes(recs: string[]): number {
  let n = 0;
  for (const r of recs) n += Buffer.byteLength(r);
  return n;
}

/** Parse one opaque record into a signed-descriptor shape; null on garbage (fail-closed). */
function tryParseSigned(rec: string): SignedPublicationDescriptor | null {
  try {
    const parsed = JSON.parse(rec) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const c = parsed as { descriptor?: unknown; signature?: unknown };
    if (typeof c.signature !== 'string' || typeof c.descriptor !== 'object' || c.descriptor === null) return null;
    return parsed as SignedPublicationDescriptor;
  } catch {
    return null;
  }
}

export class PublicDirectoryNode {
  private readonly publicationStore: PublicationDirectoryStore;
  private readonly killStore: KillStore;
  private readonly repository?: PublicDirectoryRepository;
  private readonly hostAnnouncementStore: DirectoryHostAnnouncementStore;
  private readonly trustedKillAuthorityDeviceId?: string;
  private readonly limits: PublicDirectoryLimits;
  private readonly limiter: PublicReadLimiter;
  private readonly now: () => number;

  /** publicationId -> canonical stored record. */
  private readonly publications = new Map<string, DirectoryPublicationRecord>();
  /** rid -> set of publicationIds filed under it (bounded by the per-pub rid cap). */
  private readonly byRid = new Map<string, Set<string>>();
  /** ownerDeviceId -> set of its publicationIds (per-owner cap). */
  private readonly byOwner = new Map<string, Set<string>>();
  /** communityIds dropped by a verified SignedDescriptorKill (re-fed on boot). */
  private readonly killedCommunities = new Set<string>();
  /**
   * Memoized promise of the one-time durable load (kills + publications). A PROMISE,
   * not a boolean, so a concurrent first request awaits the SAME completion and none
   * reads a still-empty registry/kill set during the boot window (no TOCTOU). A
   * REJECTED load is reset so the next caller retries instead of memoizing failure.
   */
  private loadPromise?: Promise<void>;
  /**
   * Serial chain of durable writes (put + delete). All durable mutations run in
   * enqueue order through it, so a delete can never race ahead of a put for the same
   * id (which would recreate a removed file). `drain()` lets the server await any
   * in-flight write on close.
   */
  private writeChain: Promise<void> = Promise.resolve();
  /**
   * Short-TTL ranked-list cache keyed by category ('__all__' for no filter). Bounds
   * the cost of the trend endpoint: the full scan+rank runs at most once per TTL per
   * category. At most ~10 entries (the 9 categories + '__all__'); cleared on a
   * publication store/kill, so it never grows unbounded.
   */
  private readonly trendingCache = new Map<string, { computedAt: number; recs: string[] }>();
  private readonly trendingCacheTtlMs: number;
  /**
   * Anti-rollback tombstones (Wave-1 audit fix C2): pubId -> the terminal (unpublished/
   * killed) revision + its expiry. After an owner takedown, a THIRD PARTY could replay
   * the original owner-signed ACTIVE genesis to re-list the publication in browse/
   * trending for a full TTL (the takedown deleted the record with no tombstone). This
   * map + the persisted takedown record reject any incoming descriptor whose revision
   * is <= the recorded takedown revision, mirroring the community-node's monotonicity.
   * Bounded: entries expire with publicationTtlMs and are pruned opportunistically.
   */
  private readonly takedowns = new Map<string, { revision: number; expiresAt: number }>();

  constructor(options: PublicDirectoryNodeOptions = {}) {
    this.publicationStore = options.publicationStore ?? new InMemoryPublicationDirectoryStore();
    this.killStore = options.killStore ?? new InMemoryKillStore();
    this.repository = options.repository;
    this.trustedKillAuthorityDeviceId = options.trustedKillAuthorityDeviceId;
    this.limits = { ...DEFAULT_PUBLIC_DIRECTORY_LIMITS, ...(options.limits ?? {}) };
    this.trendingCacheTtlMs = options.trendingCacheTtlMs ?? 3000;
    this.now = options.now ?? (() => Date.now());
    this.hostAnnouncementStore = options.hostAnnouncementStore
      ?? new InMemoryDirectoryHostAnnouncementStore(this.now);
    this.limiter = new PublicReadLimiter(options.publicReadLimits, this.now);
  }

  /** Enqueue a durable mutation onto the serial write chain; resolves when it lands. */
  private enqueueWrite(op: () => void | Promise<void>): Promise<void> {
    const run = this.writeChain.then(op, op);
    // Keep the chain from staying rejected so later writes still run; the CALLER of
    // enqueueWrite still observes its own op's rejection via the returned promise.
    this.writeChain = run.then(() => {}, () => {});
    return run;
  }

  /** Await every in-flight durable write (the server awaits this on close). */
  drain(): Promise<void> {
    return this.writeChain;
  }

  /**
   * Store a record under a rid. PUBLICATION records (a genesis, owner-signed, active
   * descriptor) are verified, deduped by publicationId, and capped per-owner + global.
   * Everything else (a sealed host announcement, or any non-publication payload) is
   * stored as an OPAQUE host slot keyed by the announcer, so trending can count real
   * distinct serving hosts. Returns a code (mapped to an err frame) on cap / rate /
   * size violations; never a fake success.
   */
  async announce(clientKey: string, rid: string, rec: string, ttlMs?: number): Promise<AnnounceResult> {
    if (!this.repository) await this.ensureLoaded();
    if (!this.limiter.admitRequest(clientKey)) return { ok: false, code: 'rate_limited' };
    if (!RID_RE.test(rid)) return { ok: false, code: 'bad_rid' };
    if (rec.length === 0 || rec.length > this.limits.maxRecordChars) return { ok: false, code: 'too_large' };

    const signed = tryParseSigned(rec);
    if (signed) {
      const d = signed.descriptor;
      // A re-announced UNPUBLISH/KILL revision (Plan 19 P8a): route it to removal so the
      // directory drops the publication instead of keeping the stale genesis until TTL
      // (closes the P4 finding-b). verifyPublication on a standalone revision is
      // 'invalid' (no predecessor), so this MUST run before the active-store branch,
      // which only ever accepts a genesis.
      if (typeof d?.revision === 'number' && d.revision > 1 && (d.status === 'unpublished' || d.status === 'killed')) {
        return this.recordUnpublish(signed);
      }
      if (verifyPublication(signed) === 'ok' && d.status === 'active') {
        return this.storePublication(signed, rid, rec, ttlMs);
      }
    }
    return this.storeHost(clientKey, rid, rec, ttlMs);
  }

  /**
   * Remove a publication when its OWNER re-announces an unpublished/killed revision
   * (Plan 19 P8a). The directory only ever stores the GENESIS record, so the stored
   * rec is the chain predecessor: verifyPublication(signed, genesis) confirms the
   * revision chains off it AND is owner-signed. Only then (verdict 'ok' = unpublished,
   * or 'killed' = owner-killed) is the publication removed from EVERY bucket, the
   * trending cache cleared, and the durable record deleted. FAIL-CLOSED: no stored
   * genesis, a broken chain, or a non-owner signature is IGNORED (returns ok, never
   * errors), so a forged unpublish can never take down someone else's publication.
   */
  private async recordUnpublish(signed: SignedPublicationDescriptor): Promise<AnnounceResult> {
    if (this.repository) {
      await this.repository.recordUnpublish(signed, this.limits.publicationTtlMs);
      return { ok: true };
    }
    const pubId = signed.descriptor.publicationId;
    const existing = this.publications.get(pubId);
    if (!existing) return { ok: true }; // nothing stored to remove (or already gone)
    const previous = tryParseSigned(existing.rec);
    if (!previous) return { ok: true };
    // FF1: a takedown is TERMINAL + IDEMPOTENT, so verify owner authentication WITHOUT
    // requiring previousHash adjacency. The old chained verifyPublication required
    // revision === stored.revision+1, so an unpublish/kill at revision >= 3 returned
    // 'invalid' and the stale entry survived in browse/trending while the host 404'd
    // (state divergence). verifyOwnerTakedown accepts any-revision owner takedown
    // against the stored predecessor and rejects a non-owner forgery fail-closed.
    const owned = verifyOwnerTakedown(signed, previous);
    if (!owned) return { ok: true }; // unverifiable / non-owner: ignore, do not error
    this.removePublication(pubId, existing);
    this.trendingCache.clear();
    // Anti-rollback (C2): record an in-memory tombstone at the takedown revision AND
    // PERSIST the takedown descriptor (instead of deleting), so a third-party replay of
    // the original active genesis cannot re-list it. The tombstone outlives the genesis
    // by a fresh publicationTtlMs; load() re-seeds it on boot. Prune expired tombstones.
    const tombExpiresAt = this.now() + this.limits.publicationTtlMs;
    this.pruneExpiredTakedowns();
    this.takedowns.set(pubId, { revision: signed.descriptor.revision, expiresAt: tombExpiresAt });
    // Route the put through the serial chain so it cannot land BEFORE a concurrent
    // re-announce for the same id.
    await this.enqueueWrite(() =>
      this.publicationStore.put(pubId, { rec: JSON.stringify(signed), rids: [...existing.rids], expiresAt: tombExpiresAt }));
    return { ok: true };
  }

  /** Drop tombstones whose anti-rollback window has elapsed (keeps the map bounded). */
  private pruneExpiredTakedowns(): void {
    const t = this.now();
    for (const [pubId, tomb] of this.takedowns) {
      if (tomb.expiresAt <= t) this.takedowns.delete(pubId);
    }
  }

  private async storePublication(signed: SignedPublicationDescriptor, rid: string, rec: string, ttlMs?: number): Promise<AnnounceResult> {
    const d = signed.descriptor;
    const pubId = d.publicationId;
    const owner = d.ownerDeviceId;
    const t = this.now();
    const clampedTtlMs = this.clampTtl(ttlMs, this.limits.publicationTtlMs);
    if (this.repository) {
      return this.repository.storePublication({
        signed,
        rec,
        rid,
        ttlMs: clampedTtlMs,
        limits: this.limits,
      });
    }
    const expiresAt = t + clampedTtlMs;

    // Anti-rollback (C2): if this pubId was taken down, IGNORE a replay of the original
    // active genesis (or any descriptor at/below the takedown revision) so a third party
    // cannot resurrect a removed publication. An expired tombstone is cleared and the
    // re-publish is allowed (a long-ago takedown does not pin the deterministic id forever).
    const tomb = this.takedowns.get(pubId);
    if (tomb) {
      if (tomb.expiresAt <= t) this.takedowns.delete(pubId);
      else if (d.revision <= tomb.revision) return { ok: true };
    }

    let record = this.publications.get(pubId);
    const isNew = !record;
    if (!record) {
      // New publication: enforce the global + per-owner caps (an existing pub refresh
      // never hits a cap, so a publisher can always keep its own content alive).
      if (this.publications.size >= this.limits.maxPublications) return { ok: false, code: 'directory_full' };
      const ownerSet = this.byOwner.get(owner);
      if ((ownerSet?.size ?? 0) >= this.limits.maxPublicationsPerOwner) return { ok: false, code: 'owner_full' };
      record = {
        signed, rec, ownerDeviceId: owner, communityId: d.communityId, contentId: d.contentId,
        category: d.category, updatedAt: d.updatedAt, expiresAt, rids: new Set<string>(),
      };
      this.publications.set(pubId, record);
      (ownerSet ?? this.byOwner.set(owner, new Set()).get(owner)!).add(pubId);
    } else {
      // Refresh: the id is content-addressed, so the descriptor is identical; just
      // refresh the verbatim rec + TTL.
      record.signed = signed;
      record.rec = rec;
      record.expiresAt = expiresAt;
    }

    // File it under this rid, capping the per-publication rid count so a spammer
    // re-announcing one pub under many rids cannot bloat the byRid index.
    if (!record.rids.has(rid) && record.rids.size < this.limits.maxRidsPerPublication) {
      record.rids.add(rid);
      let set = this.byRid.get(rid);
      if (!set) { set = new Set<string>(); this.byRid.set(rid, set); }
      set.add(pubId);
    }

    // AWAIT the durable write before acking (mirrors community-node.ts registerPublication):
    // a crash between annok and rename would otherwise lose a publication the client
    // was told succeeded. Routed through the serial chain so it cannot race a delete.
    await this.enqueueWrite(() =>
      this.publicationStore.put(pubId, { rec: record!.rec, rids: [...record!.rids], expiresAt: record!.expiresAt }));
    // A NEW publication changes trending membership -> drop the cached ranked lists so
    // it appears on the next request. A refresh of an existing (content-addressed) pub
    // does not change the rank, and host-count-only changes ride the cache TTL, so
    // neither invalidates -- that is what bounds the recompute cost under a write+read
    // flood (the scan+sort runs at most once per TTL per category).
    if (isNew) this.trendingCache.clear();
    return { ok: true };
  }

  private storeHost(clientKey: string, rid: string, rec: string, ttlMs?: number): Promise<AnnounceResult> {
    return Promise.resolve(this.hostAnnouncementStore.announceHost({
      clientKey,
      rid,
      rec,
      ttlMs: this.clampTtl(ttlMs, this.limits.hostTtlMs),
      limits: this.limits,
    }));
  }

  /**
   * Look up all live recs under a rid: the verified, non-killed publication records
   * filed there (browse / search) AND any live opaque host records (so the P2 client's
   * lookupContentHosts counts real serving hosts). Killed publications are filtered
   * out fail-closed and never re-served.
   */
  async lookup(clientKey: string, rid: string): Promise<LookupResult> {
    if (!this.repository) await this.ensureLoaded();
    if (!this.limiter.admitRequest(clientKey)) return { ok: false, code: 'rate_limited' };
    const t = this.now();
    const recs = this.repository
      ? await this.repository.lookupPublications(rid, this.limits.maxPublications)
      : [];
    if (!this.repository) {
      const pubIds = this.byRid.get(rid);
      if (pubIds) {
        for (const pubId of pubIds) {
          const pub = this.publications.get(pubId);
          if (!pub || pub.expiresAt <= t) continue;
          if (this.killedCommunities.has(pub.communityId)) continue;
          recs.push(pub.rec);
        }
      }
    }
    recs.push(...await this.hostAnnouncementStore.lookupHosts(
      rid,
      this.limits.maxAnnouncersPerHostRid,
    ));
    // Egress accounting (P3a defense): charge the response bytes against the per-IP
    // byte budget so a lookup flood cannot amplify egress. The second dimension uses a
    // CONSTANT 'lk' bucket (NOT the rid) so the limiter's per-bucket map cannot grow
    // unbounded under an attacker spraying distinct rids; it then acts as a coarse
    // per-endpoint egress backstop. Over budget -> rate_limited (bytes never sent).
    if (!this.limiter.admitBytes(clientKey, 'lk', recordBytes(recs))) return { ok: false, code: 'rate_limited' };
    return { ok: true, recs };
  }

  /**
   * The ranked discovery feed. Returns verified, non-killed, unexpired publication
   * records ranked by the REAL distinct announcing-host count FIRST, then recency (the
   * owner-signed updatedAt), then publicationId for a stable order. NOTHING else feeds
   * the rank: there is no eventCount / view / like signal here, by design. An optional
   * category narrows to the publication's OWN signed category (so a misfiled spam
   * record cannot pollute another category's feed). `limit` clamps to [1, 200].
   */
  async trending(clientKey: string, category?: PublicCategory, limit = 50): Promise<TrendingResult> {
    if (!this.repository) await this.ensureLoaded();
    if (!this.limiter.admitRequest(clientKey)) return { ok: false, code: 'rate_limited' };
    const t = this.now();
    const key = category ?? '__all__';
    let ranked: string[];
    if (this.repository) {
      // Shared authority is always read live. In particular, do not reuse the
      // process cache after another replica records a kill or refreshes a host.
      ranked = await this.rankTrendingCandidates(await this.repository.listTrendingCandidates(
        category,
        this.limits.maxPublications,
      ));
    } else {
      let entry = this.trendingCache.get(key);
      if (!entry || t - entry.computedAt > this.trendingCacheTtlMs) {
        entry = { computedAt: t, recs: await this.computeTrending(category, t) };
        this.trendingCache.set(key, entry);
      }
      ranked = entry.recs;
    }
    const clamped = Math.min(Math.max(1, Math.floor(limit)), 200);
    const recs = ranked.slice(0, clamped);
    // Egress accounting (P3a defense), same as lookup. The per-bucket key is the
    // category (a bounded set of <=10, so the limiter's per-bucket map stays bounded).
    if (!this.limiter.admitBytes(clientKey, `trend:${key}`, recordBytes(recs))) return { ok: false, code: 'rate_limited' };
    return { ok: true, recs };
  }

  /**
   * Full scan + rank of the publication set (pure; the cache fronts it). Ranked by the
   * REAL distinct announcing-host count FIRST, then recency (the owner-signed
   * updatedAt), then publicationId for a stable order. NOTHING else feeds the rank:
   * there is no eventCount / view / like signal here, by design. An optional category
   * narrows to the publication's OWN signed category (so a misfiled spam record cannot
   * pollute another category's feed).
   */
  private async computeTrending(category: PublicCategory | undefined, t: number): Promise<string[]> {
    const candidates: DirectoryTrendingCandidate[] = [];
    for (const [pubId, pub] of this.publications) {
      if (pub.expiresAt <= t) continue;
      if (this.killedCommunities.has(pub.communityId)) continue;
      if (category && pub.category !== category) continue;
      candidates.push({
        publicationId: pubId,
        contentId: pub.contentId,
        rec: pub.rec,
        updatedAt: pub.updatedAt,
      });
    }
    return this.rankTrendingCandidates(candidates);
  }

  private async rankTrendingCandidates(
    candidates: readonly DirectoryTrendingCandidate[],
  ): Promise<string[]> {
    const contentRids = candidates.map((candidate) => deriveContentRegistryId(candidate.contentId));
    const hostCounts = await this.hostAnnouncementStore.countLiveHosts(contentRids);
    const ranked = candidates.map((candidate, index) => ({
      ...candidate,
      hosts: hostCounts.get(contentRids[index]!) ?? 0,
    }));
    ranked.sort((a, b) => {
      if (a.hosts !== b.hosts) return b.hosts - a.hosts;            // real host count first
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1; // recency second
      return a.publicationId < b.publicationId ? -1 : a.publicationId > b.publicationId ? 1 : 0;
    });
    return ranked.map((r) => r.rec);
  }

  /**
   * Record a Trust & Safety takedown. Honored ONLY when a trusted authority is
   * configured AND the kill verifies against it (verifyDescriptorKill). A verified
   * kill is persisted to the durable ledger (so the takedown survives a restart) and
   * added to the in-memory serving gate, dropping every publication pointing at that
   * community from browse / search / trending. Returns false when ignored, so an
   * unsigned or foreign kill can never suppress content.
   */
  async recordKill(signed: SignedDescriptorKill): Promise<boolean> {
    if (!this.trustedKillAuthorityDeviceId) return false;
    if (!verifyDescriptorKill(signed, this.trustedKillAuthorityDeviceId)) return false;
    if (this.repository) {
      await this.repository.recordKill(signed);
    } else {
      await this.enqueueWrite(() => this.killStore.recordKill(signed));
      this.killedCommunities.add(signed.kill.communityId);
    }
    // A takedown changes what trending may serve: drop the cached ranked lists.
    this.trendingCache.clear();
    return true;
  }

  /**
   * Drop fully-stale entries to bound memory: expired publications (also removed from
   * the durable store and the rid/owner indexes), expired host slots, and the per-IP
   * limiter's stale keys. Wire this to the server's sweep interval (mirrors the WS hub).
   */
  async sweep(): Promise<void> {
    const t = this.now();
    let removedPublication = false;
    if (this.repository) {
      await this.repository.pruneExpired();
    } else {
      for (const [pubId, pub] of this.publications) {
        if (pub.expiresAt > t) continue;
        this.removePublication(pubId, pub);
        // Route the delete through the serial chain so it cannot land BEFORE a
        // concurrent re-announce put for the same id (which would orphan the file).
        void this.enqueueWrite(() => this.publicationStore.delete(pubId));
        removedPublication = true;
      }
    }
    await this.hostAnnouncementStore.pruneExpiredHosts();
    if (removedPublication) this.trendingCache.clear();
    this.limiter.sweep(t);
  }

  private removePublication(pubId: string, pub: DirectoryPublicationRecord): void {
    this.publications.delete(pubId);
    for (const rid of pub.rids) {
      const set = this.byRid.get(rid);
      if (!set) continue;
      set.delete(pubId);
      if (set.size === 0) this.byRid.delete(rid);
    }
    const ownerSet = this.byOwner.get(pub.ownerDeviceId);
    if (ownerSet) {
      ownerSet.delete(pubId);
      if (ownerSet.size === 0) this.byOwner.delete(pub.ownerDeviceId);
    }
  }

  /** Observability seam (tests + /healthz): bounded counts only, never content. */
  async stats(): Promise<{
    publications: number;
    hostRids: number;
    limiterTrackedClients: number;
  }> {
    const hostStats = await this.hostAnnouncementStore.stats();
    return {
      publications: this.publications.size,
      hostRids: hostStats.liveRids,
      limiterTrackedClients: this.limiter.trackedClientCount(),
    };
  }

  /** Limiter window, used by the server to size the sweep interval. */
  get limiterWindowMs(): number {
    return this.limiter.limits.windowMs;
  }

  private clampTtl(ttlMs: number | undefined, max: number): number {
    return ttlMs && ttlMs > 0 ? Math.min(ttlMs, max) : max;
  }

  /**
   * One-time durable load: re-feed the kill ledger FIRST (so the killed filter applies
   * during the publication load), then rebuild the in-memory registry from the durable
   * store. Each stored record is RE-VERIFIED fail-closed (a tampered or expired record
   * on disk is skipped), so durability never reintroduces an unverifiable publication.
   */
  private ensureLoaded(): Promise<void> {
    // Reset the memoized promise on REJECTION so a transient durable-read failure is
    // retried by the next caller instead of being cached as a permanent failure.
    this.loadPromise ??= this.load().catch((err) => {
      this.loadPromise = undefined;
      throw err;
    });
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    for (const id of await this.killStore.loadKilledCommunityIds()) this.killedCommunities.add(id);
    const t = this.now();
    for (const [, stored] of await this.publicationStore.load()) {
        if (stored.expiresAt <= t) continue;
        const signed = tryParseSigned(stored.rec);
        if (!signed) continue;
        // Anti-rollback (C2): a persisted TAKEDOWN tombstone (terminal status, owner-
        // verified when recorded) re-seeds the anti-rollback guard, never the serving map.
        // It must be detected BEFORE verifyPublication, which is 'invalid' on a standalone
        // revision > 1.
        if (signed.descriptor.status === 'unpublished' || signed.descriptor.status === 'killed') {
          if (typeof signed.descriptor.revision === 'number') {
            this.takedowns.set(signed.descriptor.publicationId, { revision: signed.descriptor.revision, expiresAt: stored.expiresAt });
          }
          continue;
        }
        if (verifyPublication(signed) !== 'ok' || signed.descriptor.status !== 'active') continue;
        const d = signed.descriptor;
        if (this.killedCommunities.has(d.communityId)) continue;
        const record: DirectoryPublicationRecord = {
          signed, rec: stored.rec, ownerDeviceId: d.ownerDeviceId, communityId: d.communityId,
          contentId: d.contentId, category: d.category, updatedAt: d.updatedAt,
          expiresAt: stored.expiresAt, rids: new Set(),
        };
        this.publications.set(d.publicationId, record);
        let ownerSet = this.byOwner.get(d.ownerDeviceId);
        if (!ownerSet) { ownerSet = new Set(); this.byOwner.set(d.ownerDeviceId, ownerSet); }
        ownerSet.add(d.publicationId);
        for (const rid of stored.rids.slice(0, this.limits.maxRidsPerPublication)) {
          record.rids.add(rid);
          let set = this.byRid.get(rid);
          if (!set) { set = new Set(); this.byRid.set(rid, set); }
          set.add(d.publicationId);
        }
      }
  }
}

// ---------------------------------------------------------------------------
// Server (ws verbs over an http server, with /healthz)
// ---------------------------------------------------------------------------

export interface PublicDirectoryNodeServer {
  /** The ws url clients connect to (announce / browse / search / trend). */
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

export interface StartPublicDirectoryNodeOptions {
  node: PublicDirectoryNode;
  port?: number;
  host?: string;
  /** Heartbeat interval; connections that miss a pong are dropped. */
  heartbeatMs?: number;
  /** Counts/paths only; never record contents. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
  /** Max simultaneous sockets (memory backstop). */
  maxConnections?: number;
  /** Max raw ws frame bytes. */
  maxFrameBytes?: number;
  /**
   * Exact number of reverse-proxy hops controlled by this deployment. Default 0:
   * forwarding headers are ignored and the direct socket address keys the limiter.
   */
  trustedProxyHops?: number;
  /**
   * Plan 44 WP-4A liveness/readiness. When present, GET /livez and GET /readyz are
   * answered on this http listener (before the /healthz + ws-upgrade fallthrough).
   */
  healthEndpoints?: HealthEndpoints;
}

/** Mirrors @mylife/sync PublicCategory (publication.ts); validated on the wire so a
 *  bad category is rejected at parse, not silently cast. Update if the enum grows. */
const PublicCategorySchema = z.enum([
  'technology', 'gaming', 'news', 'sports', 'local', 'hobbies', 'creative', 'discussion', 'other',
]);

/** Frame-level record-size bound (the node re-checks against its own maxRecordChars). */
const MAX_FRAME_REC_CHARS = 96 * 1024;

const AnnounceFrameSchema = z.object({
  t: z.literal('ann'),
  rid: z.string().regex(RID_RE),
  rec: z.string().min(1).max(MAX_FRAME_REC_CHARS),
  ttlMs: z.number().int().positive().optional(),
});
const LookupFrameSchema = z.object({ t: z.literal('lk'), rid: z.string().regex(RID_RE) });
const TrendFrameSchema = z.object({
  t: z.literal('trend'),
  category: PublicCategorySchema.optional(),
  limit: z.number().int().positive().optional(),
});
const ByeFrameSchema = z.object({ t: z.literal('bye') });
const DirectoryFrameSchema = z.discriminatedUnion('t', [
  AnnounceFrameSchema,
  LookupFrameSchema,
  TrendFrameSchema,
  ByeFrameSchema,
]);

interface LiveSocket extends WebSocket {
  _alive?: boolean;
  _clientKey?: string;
  _queue?: Promise<void>;
}

function isDirectoryStoreUnavailable(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'postgres_store_unavailable';
}

/** Start the public directory node's ws+http server. Resolves once listening. */
export function startPublicDirectoryNode(options: StartPublicDirectoryNodeOptions): Promise<PublicDirectoryNodeServer> {
  const { node } = options;
  const host = options.host ?? '0.0.0.0';
  const log = options.log ?? (() => {});
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  const maxConnections = options.maxConnections ?? 10_000;
  const trustedProxyHops = Number.isFinite(options.trustedProxyHops)
    ? Math.max(0, Math.floor(options.trustedProxyHops ?? 0))
    : 0;
  const maxFrameBytes = options.maxFrameBytes ?? 96 * 1024;

  const httpServer = http.createServer((req, res) => {
    // Plan 44 WP-4A: infra liveness/readiness ahead of the /healthz + ws fallthrough.
    if (options.healthEndpoints && options.healthEndpoints.handle(req, res)) return;
    if (req.method === 'GET' && req.url === '/healthz') {
      void node.stats().then((s) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, publications: s.publications, hostRids: s.hostRids }));
      }).catch((error: unknown) => {
        const unavailable = isDirectoryStoreUnavailable(error);
        res.writeHead(unavailable ? 503 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, code: unavailable ? 'store_unavailable' : 'internal_error' }));
      });
      return;
    }
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('meerkat-public-directory-node: WebSocket only');
  });

  const wss = new WebSocketServer({ server: httpServer, maxPayload: maxFrameBytes });
  let liveSockets = 0;

  function send(socket: WebSocket, frame: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
  }
  function sendErr(socket: WebSocket, code: DirectoryErrorCode): void {
    send(socket, { t: 'err', code, msg: code });
  }

  wss.on('connection', (socket: LiveSocket, req) => {
    if (liveSockets >= maxConnections) {
      try { send(socket, { t: 'err', code: 'server_full', msg: 'directory at capacity' }); } catch { /* ignore */ }
      socket.close(1013, 'server full');
      return;
    }
    liveSockets += 1;
    socket._alive = true;
    // Per-client key for the limiter + host-announcer slotting, derived EXACTLY like
    // the relay (direct socket address unless trustedProxyHops declares the hops).
    socket._clientKey = derivePublicClientKey(req, trustedProxyHops);
    socket.on('pong', () => { socket._alive = true; });

    async function handle(raw: RawData): Promise<void> {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      let json: unknown;
      try { json = JSON.parse(text); } catch { send(socket, { t: 'err', code: 'bad_frame', msg: 'malformed frame' }); return; }
      const parsed = DirectoryFrameSchema.safeParse(json);
      if (!parsed.success) { send(socket, { t: 'err', code: 'bad_frame', msg: 'malformed frame' }); return; }
      const frame = parsed.data;
      const clientKey = socket._clientKey!;

      if (frame.t === 'ann') {
        const result = await node.announce(clientKey, frame.rid, frame.rec, frame.ttlMs);
        if (result.ok) { send(socket, { t: 'annok', rid: frame.rid }); }
        else { log('announce_reject', { code: result.code }); sendErr(socket, result.code); }
        return;
      }
      if (frame.t === 'lk') {
        const result = await node.lookup(clientKey, frame.rid);
        if (result.ok) { send(socket, { t: 'hosts', rid: frame.rid, recs: result.recs }); }
        else { log('lookup_reject', { code: result.code }); sendErr(socket, result.code); }
        return;
      }
      if (frame.t === 'trend') {
        const result = await node.trending(clientKey, frame.category, frame.limit ?? 50);
        if (result.ok) { send(socket, { t: 'trending', recs: result.recs }); }
        else { log('trend_reject', { code: result.code }); sendErr(socket, result.code); }
        return;
      }
      // bye
      socket.close(1000, 'bye');
    }

    socket._queue = Promise.resolve();
    socket.on('message', (raw: RawData) => {
      socket._queue = socket._queue
        ?.then(() => handle(raw))
        .catch((error: unknown) => {
          try {
            if (isDirectoryStoreUnavailable(error)) {
              log('directory_store_unavailable');
              sendErr(socket, 'service_unavailable');
            } else {
              send(socket, { t: 'err', code: 'bad_frame', msg: 'failed to handle frame' });
            }
          } catch { /* ignore */ }
        });
    });
    socket.on('close', () => { liveSockets -= 1; });
    socket.on('error', () => { /* close handler decrements */ });
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const s = client as LiveSocket;
      if (s._alive === false) { s.terminate(); continue; }
      s._alive = false;
      s.ping();
    }
  }, heartbeatMs);
  heartbeat.unref?.();

  const sweepTimer = setInterval(() => {
    void node.sweep().catch(() => log('directory_sweep_failed'));
  }, node.limiterWindowMs);
  sweepTimer.unref?.();

  return new Promise((resolve, reject) => {
    let startupSettled = false;
    const clearStartupListeners = (): void => {
      httpServer.off('error', failStartup);
      wss.off('error', failStartup);
    };
    const failStartup = (error: Error): void => {
      if (startupSettled) return;
      startupSettled = true;
      clearStartupListeners();
      clearInterval(heartbeat);
      clearInterval(sweepTimer);
      for (const client of wss.clients) client.terminate();
      try { wss.close(() => undefined); } catch { /* server never reached listening */ }
      reject(error);
    };
    httpServer.once('error', failStartup);
    wss.once('error', failStartup);
    httpServer.listen(options.port ?? 0, host, () => {
      if (startupSettled) return;
      startupSettled = true;
      clearStartupListeners();
      // Runtime transport errors are observable but handled. Without this listener,
      // ws re-emitting a later HTTP server error would terminate the process.
      wss.on('error', () => log('directory_websocket_error'));
      httpServer.on('error', () => log('directory_http_error'));
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      const wsHost = host === '0.0.0.0' ? '127.0.0.1' : host;
      log('listening', { host, port });
      resolve({
        url: `ws://${wsHost}:${port}`,
        port,
        close: () => new Promise<void>((res) => {
          clearInterval(heartbeat);
          clearInterval(sweepTimer);
          for (const client of wss.clients) client.terminate();
          // Await any in-flight durable write so close does not race a pending
          // temp+rename (a publication/kill the node already acked must land on disk).
          wss.close(() => httpServer.close(() => { void node.drain().then(() => res(), () => res()); }));
        }),
      });
    });
  });
}
