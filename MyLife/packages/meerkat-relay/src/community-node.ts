/**
 * Always-on COMMUNITY NODE core (community feed P2, design sections 4.1 + 6).
 *
 * The community-mode half of the seeder: a self-hostable, always-on box a
 * community runs (or rents) that persists each community's rolling SNAPSHOTS +
 * live TAIL as opaque ciphertext and gates pulls with per-member SIGNED AUTH.
 * It is a SECOND deployable image over the SAME codebase as the seeder; the
 * production image + announce cron is deferred ops (see announce() below).
 *
 * Zero-knowledge boundary (do not weaken):
 *  - The node legitimately holds the signed CommunityDescriptor, so it knows the
 *    roster and can verify per-member auth. That is the accepted P2 tradeoff.
 *  - The node NEVER reads message plaintext. On publish it verifies snapshot
 *    pieces by HASH only (verifyCatalogPiece) and the manifest's own internal
 *    consistency, never decrypting. On append it verifies ONLY the OUTER
 *    over-ciphertext author signature (verifySealedTailEntry) -- it "rejects any
 *    attempt to store an event whose author signature does not verify
 *    (fail-closed integrity even without reading content)". The INNER
 *    verifyChannelMessage runs only on the PULLER after it decrypts.
 *  - Stored pieces are opaque sealed bytes. Without the epoch key (which the node
 *    never holds) they cannot be parsed into plaintext.
 *
 * Backed by an injected SeederPieceStore (default InMemory) so it stays content-
 * agnostic and unit-testable without a socket.
 *
 * P6 hardening (done where noted; the rest stays deferred ops):
 *  - PER-COMMUNITY PIECE SCOPING (DONE, P6 item 1): the piece route now carries
 *    the community id (GET /community/{id}/{infoHash}/{index}) and is gated by the
 *    per-community verifyRequest + servePieceForCommunity, which serves a piece
 *    ONLY when its infoHash belongs to one of THAT community's stored snapshots.
 *    A member of community A can no longer fetch community B's opaque pieces.
 *  - DURABLE DESCRIPTOR + REVISION MONOTONICITY (DONE, P6 item 2): descriptors no
 *    longer live in memory only. An injected CommunityDescriptorStore persists the
 *    highest-seen (communityId -> revision, descriptorHash); publish() enforces
 *    monotonicity against that store (not just in-memory state), so an owner-signed
 *    OLDER roster cannot re-grant a removed member after a restart. The deploy
 *    artifact uses FileCommunityDescriptorStore under a DATA_DIR volume; the
 *    InMemory default keeps tests + Expo paths socket-free.
 *  - PER-DEVICE RATE LIMITS (DONE, P6 item 3): a deterministic token bucket caps
 *    authenticated publish/append/pull per deviceId and globally caps challenge
 *    issuance per community; over-limit yields a 429 rate_limited verdict.
 */

import {
  announceHeldContent,
  buildCommunityNotifyPing,
  communityDescriptorHash,
  communityRole,
  computeMerkleRoot,
  createFeedChallenge,
  deriveCommunityNotifyToken,
  effectivePostPolicy,
  hlcAfter,
  importPublicSnapshot,
  isPriorityPublicReport,
  nextHlc,
  publicationDescriptorHash,
  signPublicPostAcceptance,
  verifyCatalogPiece,
  verifyCommunityDescriptor,
  verifyDescriptorKill,
  verifyDescriptorOwnerSignature,
  verifyFeedAuth,
  verifyOwnerTakedown,
  verifyPublication,
  verifyPublicAbuseReport,
  verifyPublicPostAuthor,
  verifyPublicPostTombstone,
  verifyPublicPostingFreeze,
  verifyPublicReportFetchSignature,
  verifySealedTailEntry,
  type AcceptedPublicPost,
  type ChannelMessageEvent,
  type CommunityDescriptor,
  type ContentManifest,
  type FeedChallenge,
  type Hlc,
  type PublicAbuseReport,
  type PublicPostEvent,
  type PublicPostTombstone,
  type PublicPostingFreeze,
  type PublicationStatus,
  type SealedTailEntry,
  type SignedCommunityDescriptor,
  type SignedDescriptorKill,
  type SignedPublicAbuseReport,
  type SignedPublicationDescriptor,
  type WorkspaceMemberRole,
} from '@mylife/sync';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  InMemorySeederPieceStore,
  type SeederPieceStore,
} from './seeder-node';
import type { AbuseHashScanner, AbuseScannerState } from './abuse-scan';
import { withExclusiveFileLock } from './file-lock';
import {
  InMemoryCommunityPrivateStateStore,
  type CommunityPrivateStateStore,
  type PrivateChallengeContext,
  type PrivateCommunityIdentityState,
  type PrivateRateLimitAction,
  type StoredPrivateCommunityState,
  type StoredPrivateSnapshot,
} from './community-private-state';

/** Evidence a submit-boundary abuse-hash match hands to the NCMEC queue seam (Plan 39 P13). */
export interface PublicPostAbuseMatch {
  publicationId: string;
  channelId: string;
  postId: string;
  personaPubkey: string;
  matchedBlobHashes: string[];
}

/**
 * Atomic file write: write to a unique temp file then rename over the target. A
 * crash mid-write therefore never leaves a half-written (corrupt) file that would
 * make a publication vanish or re-open the rollback/replay window. rename(2) is
 * atomic within a directory on POSIX + Windows.
 */
export async function atomicWriteFile(file: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, file);
}

/** A pull/publish auth proof carried in request headers. */
export interface FeedAuthHeader {
  nonce: string;
  ts: string;
  deviceId: string;
  signature: string;
}

export type CommunityNodeVerdict =
  | { ok: true; role: WorkspaceMemberRole }
  | { ok: false; status: 400 | 401 | 409 | 429; reason: string };

export type CommunityManifestVerdict =
  | { ok: true; role: WorkspaceMemberRole; payload: CommunityNodeManifestPayload }
  | Extract<CommunityNodeVerdict, { ok: false }>;

export type CommunityPieceVerdict =
  | { ok: true; role: WorkspaceMemberRole; bytes: Uint8Array | null }
  | Extract<CommunityNodeVerdict, { ok: false }>;

/** The highest descriptor revision ever recorded for a community (durability). */
export interface HighestRevision {
  revision: number;
  descriptorHash: string;
}

export type DescriptorRevisionClaim =
  | 'inserted'
  | 'idempotent'
  | 'stale'
  | 'conflict';

/**
 * Restart-safe descriptor revision store (P6 item 2). The community node persists
 * the highest (revision, descriptorHash) it has ever accepted per community so the
 * publish() stale-revision downgrade guard survives a process restart. Without it
 * an owner-signed OLDER roster could re-grant a removed member after a restart,
 * because the in-memory guard would have reset.
 *
 * It records ONLY a revision number + a content hash of the signed descriptor. It
 * never stores or reads plaintext, so the zero-knowledge boundary is untouched.
 */
export interface CommunityDescriptorStore {
  getHighestRevision(communityId: string): HighestRevision | null | Promise<HighestRevision | null>;
  claimRevision(
    communityId: string,
    revision: number,
    descriptorHash: string,
  ): DescriptorRevisionClaim | Promise<DescriptorRevisionClaim>;
  /** Compatibility entry point for existing callers. New mutations use claimRevision. */
  recordRevision(communityId: string, revision: number, descriptorHash: string): void | Promise<void>;
}

/** In-memory descriptor store (default; tests, ephemeral nodes). */
export class InMemoryCommunityDescriptorStore implements CommunityDescriptorStore {
  private readonly highest = new Map<string, HighestRevision>();
  getHighestRevision(communityId: string): HighestRevision | null {
    return this.highest.get(communityId) ?? null;
  }
  claimRevision(communityId: string, revision: number, descriptorHash: string): DescriptorRevisionClaim {
    const prior = this.highest.get(communityId);
    if (!prior || revision > prior.revision) {
      this.highest.set(communityId, { revision, descriptorHash });
      return 'inserted';
    }
    if (revision < prior.revision) return 'stale';
    return descriptorHash === prior.descriptorHash ? 'idempotent' : 'conflict';
  }
  recordRevision(communityId: string, revision: number, descriptorHash: string): void {
    this.claimRevision(communityId, revision, descriptorHash);
  }
}

/**
 * Filesystem descriptor store: one JSON file per community under {baseDir}. The
 * production community-node image points this at its DATA_DIR volume so revision
 * monotonicity is enforced across restarts. It holds only {revision, descriptorHash}.
 */
export class FileCommunityDescriptorStore implements CommunityDescriptorStore {
  constructor(private readonly baseDir: string) {}
  private file(communityId: string): string {
    // Hex-encode the community id so it is always a safe single path segment.
    const safe = Buffer.from(communityId, 'utf8').toString('hex');
    return path.join(this.baseDir, `${safe}.rev.json`);
  }
  async getHighestRevision(communityId: string): Promise<HighestRevision | null> {
    try {
      const raw = await fs.readFile(this.file(communityId), 'utf8');
      const parsed = JSON.parse(raw) as Partial<HighestRevision>;
      if (typeof parsed.revision !== 'number' || typeof parsed.descriptorHash !== 'string') return null;
      return { revision: parsed.revision, descriptorHash: parsed.descriptorHash };
    } catch {
      return null;
    }
  }
  async claimRevision(
    communityId: string,
    revision: number,
    descriptorHash: string,
  ): Promise<DescriptorRevisionClaim> {
    const file = this.file(communityId);
    return withExclusiveFileLock(`${file}.lock`, async () => {
      const prior = await this.getHighestRevision(communityId);
      if (prior) {
        if (revision < prior.revision) return 'stale';
        if (revision === prior.revision) {
          return descriptorHash === prior.descriptorHash ? 'idempotent' : 'conflict';
        }
      }
      // atomicWriteFile (temp + rename, mkdir included) so a crash mid-write never
      // leaves a torn revision file. The exclusive lock also makes the comparison
      // and replacement atomic across community-node processes on one volume.
      await atomicWriteFile(file, JSON.stringify({ revision, descriptorHash }));
      return 'inserted';
    });
  }
  async recordRevision(communityId: string, revision: number, descriptorHash: string): Promise<void> {
    await this.claimRevision(communityId, revision, descriptorHash);
  }
}

// ---------------------------------------------------------------------------
// Public publication registry (Plan 19 P3a, design 5.4 + 5.6).
// ---------------------------------------------------------------------------

/** One channel snapshot stored alongside a publication (pieces live in the piece store). */
export interface StoredPublicationSnapshot {
  channelId: string;
  /** The public-snapshot sentinel epoch (the seal uses the published key, not the epoch). */
  epoch: number;
  /** JSON.stringify of the signed catalog ContentManifest. */
  manifestJson: string;
}

/** The latest verified, owner-signed publication descriptor + its snapshot metadata. */
export interface StoredPublication {
  signed: SignedPublicationDescriptor;
  snapshots: StoredPublicationSnapshot[];
}

export type PublicationReplaceOutcome = 'inserted' | 'updated' | 'conflict';

/**
 * Durable registry of OPEN publications (publicationId -> latest signed descriptor +
 * snapshot metadata), modeled on CommunityDescriptorStore. The piece bytes live in
 * the node's piece store; this store holds only the owner-signed descriptor and the
 * signed manifests, so revision monotonicity + the serving scope survive a restart.
 */
export interface PublicationStore {
  withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T>;
  get(publicationId: string): StoredPublication | null | Promise<StoredPublication | null>;
  put(publicationId: string, record: StoredPublication): void | Promise<void>;
  replace(
    publicationId: string,
    expectedRevision: number | null,
    record: StoredPublication,
  ): PublicationReplaceOutcome | Promise<PublicationReplaceOutcome>;
  /** Every stored publication. Used to REFCOUNT a deduped contentId before removing
   *  its shared bytes (two publications can reference one content-addressed snapshot). */
  list(): StoredPublication[] | Promise<StoredPublication[]>;
}

/** In-memory publication store (default; tests, ephemeral nodes). */
export class InMemoryPublicationStore implements PublicationStore {
  private readonly records = new Map<string, StoredPublication>();
  private readonly writeLocks = new Map<string, Promise<unknown>>();
  async withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T> {
    const prior = this.writeLocks.get(publicationId) ?? Promise.resolve();
    const run = prior.then(operation, operation);
    const tail = run.then(() => undefined, () => undefined);
    this.writeLocks.set(publicationId, tail);
    void tail.then(() => {
      if (this.writeLocks.get(publicationId) === tail) this.writeLocks.delete(publicationId);
    });
    return run;
  }
  get(publicationId: string): StoredPublication | null {
    return this.records.get(publicationId) ?? null;
  }
  put(publicationId: string, record: StoredPublication): void {
    this.records.set(publicationId, record);
  }
  replace(
    publicationId: string,
    expectedRevision: number | null,
    record: StoredPublication,
  ): PublicationReplaceOutcome {
    const prior = this.records.get(publicationId);
    const priorRevision = prior?.signed.descriptor.revision ?? null;
    if (priorRevision !== expectedRevision) return 'conflict';
    this.records.set(publicationId, record);
    return prior ? 'updated' : 'inserted';
  }
  list(): StoredPublication[] {
    return [...this.records.values()];
  }
}

/**
 * Filesystem publication store: one JSON file per publication under {baseDir}. The
 * production community-node image points this at its DATA_DIR volume so the public
 * serving registry + revision monotonicity survive restarts. It holds only the
 * owner-signed descriptor + signed manifests (no decryption key, all public).
 */
export class FilePublicationStore implements PublicationStore {
  constructor(private readonly baseDir: string) {}
  private file(publicationId: string): string {
    const safe = Buffer.from(publicationId, 'utf8').toString('hex');
    return path.join(this.baseDir, `${safe}.pub.json`);
  }
  withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T> {
    const safe = Buffer.from(publicationId, 'utf8').toString('hex');
    return withExclusiveFileLock(path.join(this.baseDir, '.locks', `${safe}.lock`), operation);
  }
  async get(publicationId: string): Promise<StoredPublication | null> {
    try {
      const raw = await fs.readFile(this.file(publicationId), 'utf8');
      const parsed = JSON.parse(raw) as StoredPublication;
      if (!parsed?.signed?.descriptor || !Array.isArray(parsed.snapshots)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  async put(publicationId: string, record: StoredPublication): Promise<void> {
    // Atomic (temp + rename): a partial write must never make a publication vanish
    // and re-open the unpublish/kill rollback window on the next restart.
    await atomicWriteFile(this.file(publicationId), JSON.stringify(record));
  }
  async replace(
    publicationId: string,
    expectedRevision: number | null,
    record: StoredPublication,
  ): Promise<PublicationReplaceOutcome> {
    const prior = await this.get(publicationId);
    const priorRevision = prior?.signed.descriptor.revision ?? null;
    if (priorRevision !== expectedRevision) return 'conflict';
    await atomicWriteFile(this.file(publicationId), JSON.stringify(record));
    return prior ? 'updated' : 'inserted';
  }
  async list(): Promise<StoredPublication[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.baseDir);
    } catch {
      return [];
    }
    const out: StoredPublication[] = [];
    for (const name of entries) {
      if (!name.endsWith('.pub.json')) continue;
      try {
        const parsed = JSON.parse(await fs.readFile(path.join(this.baseDir, name), 'utf8')) as StoredPublication;
        if (parsed?.signed?.descriptor && Array.isArray(parsed.snapshots)) out.push(parsed);
      } catch {
        // Skip a corrupt / partially-written file; refcount conservatively under-counts
        // (worst case keeps shared bytes a beat longer), never wrongly deleting them.
      }
    }
    return out;
  }
}

/**
 * Durable ledger of honored Trust & Safety takedowns. Every public serving and
 * mutation path reads this authority live, so a kill recorded by another node is
 * immediately visible and survives restart without a process-local cache.
 */
export interface KillStore {
  recordKill(signed: SignedDescriptorKill): void | Promise<void>;
  isKilled(communityId: string): boolean | Promise<boolean>;
  loadKilledCommunityIds(): string[] | Promise<string[]>;
}

/** In-memory kill ledger (default; tests, ephemeral nodes). */
export class InMemoryKillStore implements KillStore {
  private readonly kills = new Map<string, SignedDescriptorKill>();
  recordKill(signed: SignedDescriptorKill): void {
    this.kills.set(signed.kill.communityId, signed);
  }
  isKilled(communityId: string): boolean {
    return this.kills.has(communityId);
  }
  loadKilledCommunityIds(): string[] {
    return [...this.kills.keys()];
  }
}

/**
 * Filesystem kill ledger: one JSON file per killed community under {baseDir}, each
 * holding the verified SignedDescriptorKill. The prod community-node image points
 * this at its DATA_DIR volume so honored takedowns survive a restart.
 */
export class FileKillStore implements KillStore {
  constructor(private readonly baseDir: string) {}
  private file(communityId: string): string {
    const safe = Buffer.from(communityId, 'utf8').toString('hex');
    return path.join(this.baseDir, `${safe}.kill.json`);
  }
  async recordKill(signed: SignedDescriptorKill): Promise<void> {
    await atomicWriteFile(this.file(signed.kill.communityId), JSON.stringify(signed));
  }
  async isKilled(communityId: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file(communityId), 'utf8')) as SignedDescriptorKill;
      if (parsed?.kill?.communityId !== communityId) {
        throw new Error('Kill ledger entry does not match its community identifier');
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
      throw error;
    }
  }
  async loadKilledCommunityIds(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.baseDir);
    } catch {
      return [];
    }
    const ids: string[] = [];
    for (const name of entries) {
      if (!name.endsWith('.kill.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.baseDir, name), 'utf8');
        const parsed = JSON.parse(raw) as SignedDescriptorKill;
        if (parsed?.kill?.communityId) ids.push(parsed.kill.communityId);
      } catch {
        // skip an unreadable ledger entry; the others still load.
      }
    }
    return ids;
  }
}

// ---------------------------------------------------------------------------
// Durable public report store (Plan 19 P8a). Host abuse-intake for OPEN reports.
// ---------------------------------------------------------------------------

/**
 * Durable store of UNSEALED public reports per publication. Modeled on the
 * PublicationStore / KillStore: the deploy artifact passes the File impl so the
 * host abuse-intake survives a restart; the InMemory default keeps tests + ephemeral
 * nodes socket-free. It holds only reporter-signed PUBLIC reports (no secrets, no
 * decryption key). Memory is bounded TWICE: the host accepts a report only for a
 * publication it ALREADY serves (so untrusted clients cannot grow it by spraying unknown
 * ids) and each publication's list is capped (csam/illegal retained preferentially).
 */
export interface ReportStore {
  get(publicationId: string): SignedPublicAbuseReport[] | null | Promise<SignedPublicAbuseReport[] | null>;
  put(publicationId: string, reports: SignedPublicAbuseReport[]): void | Promise<void>;
  appendCapped(
    publicationId: string,
    report: SignedPublicAbuseReport,
    maximumReports: number,
  ): void | Promise<void>;
}

/** In-memory report store (default; tests, ephemeral nodes). */
export class InMemoryReportStore implements ReportStore {
  private readonly records = new Map<string, SignedPublicAbuseReport[]>();
  get(publicationId: string): SignedPublicAbuseReport[] | null {
    return this.records.get(publicationId) ?? null;
  }
  put(publicationId: string, reports: SignedPublicAbuseReport[]): void {
    this.records.set(publicationId, reports);
  }
  appendCapped(
    publicationId: string,
    report: SignedPublicAbuseReport,
    maximumReports: number,
  ): void {
    const reports = [...(this.records.get(publicationId) ?? []), report];
    this.records.set(publicationId, capPublicReports(reports, maximumReports));
  }
}

/**
 * Filesystem report store: one JSON file per publication under {baseDir}, holding the
 * capped list of reporter-signed reports. Writes are atomic (temp + rename) so a crash
 * mid-write never leaves a corrupt list. The prod community-node image points this at
 * its DATA_DIR volume so host abuse-intake survives a restart.
 */
export class FileReportStore implements ReportStore {
  constructor(private readonly baseDir: string) {}
  private file(publicationId: string): string {
    const safe = Buffer.from(publicationId, 'utf8').toString('hex');
    return path.join(this.baseDir, `${safe}.reports.json`);
  }
  async get(publicationId: string): Promise<SignedPublicAbuseReport[] | null> {
    try {
      const raw = await fs.readFile(this.file(publicationId), 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((r): r is SignedPublicAbuseReport =>
        typeof r === 'object' && r !== null
        && typeof (r as { signature?: unknown }).signature === 'string'
        && typeof (r as { report?: unknown }).report === 'object'
        && (r as { report?: unknown }).report !== null);
    } catch {
      return null;
    }
  }
  async put(publicationId: string, reports: SignedPublicAbuseReport[]): Promise<void> {
    await atomicWriteFile(this.file(publicationId), JSON.stringify(reports));
  }
  async appendCapped(
    publicationId: string,
    report: SignedPublicAbuseReport,
    maximumReports: number,
  ): Promise<void> {
    const file = this.file(publicationId);
    await withExclusiveFileLock(`${file}.lock`, async () => {
      const existing = (await this.get(publicationId)) ?? [];
      await atomicWriteFile(
        file,
        JSON.stringify(capPublicReports([...existing, report], maximumReports)),
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Durable public-post store (Plan 39 P6, absorbing Plan 26 P3). Node-accepted
// public posts + tombstones + posting freeze + per-persona flood windows.
// ---------------------------------------------------------------------------

/**
 * Durable store backing the public submit route, per publication:
 *  - node-ACCEPTED posts (dual-signed AcceptedPublicPost units) merged into the
 *    public page route;
 *  - honored post tombstones (a removed post must never resurrect across a
 *    restart -- same discipline as the kill ledger);
 *  - the latest posting-freeze record (the one-action kill switch);
 *  - per-persona submit timestamps backing the DURABLE flood caps.
 * Everything stored is PUBLIC signed content; the zero-knowledge boundary is
 * untouched. Default InMemory; the deploy artifact passes FilePublicPostStore.
 */
export interface PublicPostStore {
  withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T>;
  isPersonaBlocked(personaPubkey: string): boolean | Promise<boolean>;
  blockPersona(personaPubkey: string): void | Promise<void>;
  listPosts(publicationId: string): AcceptedPublicPost[] | Promise<AcceptedPublicPost[]>;
  putPosts(publicationId: string, posts: AcceptedPublicPost[]): void | Promise<void>;
  listTombstones(publicationId: string): PublicPostTombstone[] | Promise<PublicPostTombstone[]>;
  putTombstones(publicationId: string, tombstones: PublicPostTombstone[]): void | Promise<void>;
  getFreeze(publicationId: string): PublicPostingFreeze | null | Promise<PublicPostingFreeze | null>;
  putFreeze(publicationId: string, freeze: PublicPostingFreeze): void | Promise<void>;
  /** Recent submit timestamps (ms) for one persona in one publication. */
  listSubmits(publicationId: string, personaKey: string): number[] | Promise<number[]>;
  /** Replace the persona's submit window (the node prunes to the window). */
  putSubmits(publicationId: string, personaKey: string, timestampsMs: number[]): void | Promise<void>;
}

/** In-memory public-post store (default; tests, ephemeral nodes). */
export class InMemoryPublicPostStore implements PublicPostStore {
  private readonly posts = new Map<string, AcceptedPublicPost[]>();
  private readonly tombstones = new Map<string, PublicPostTombstone[]>();
  private readonly freezes = new Map<string, PublicPostingFreeze>();
  private readonly submits = new Map<string, number[]>();
  private readonly blockedPersonas = new Set<string>();

  withPublicationWriteLock<T>(_publicationId: string, operation: () => Promise<T>): Promise<T> {
    return operation();
  }
  isPersonaBlocked(personaPubkey: string): boolean {
    return this.blockedPersonas.has(personaPubkey.toLowerCase());
  }
  blockPersona(personaPubkey: string): void {
    this.blockedPersonas.add(personaPubkey.toLowerCase());
  }

  listPosts(publicationId: string): AcceptedPublicPost[] {
    return this.posts.get(publicationId) ?? [];
  }
  putPosts(publicationId: string, posts: AcceptedPublicPost[]): void {
    this.posts.set(publicationId, posts);
  }
  listTombstones(publicationId: string): PublicPostTombstone[] {
    return this.tombstones.get(publicationId) ?? [];
  }
  putTombstones(publicationId: string, tombstones: PublicPostTombstone[]): void {
    this.tombstones.set(publicationId, tombstones);
  }
  getFreeze(publicationId: string): PublicPostingFreeze | null {
    return this.freezes.get(publicationId) ?? null;
  }
  putFreeze(publicationId: string, freeze: PublicPostingFreeze): void {
    this.freezes.set(publicationId, freeze);
  }
  listSubmits(publicationId: string, personaKey: string): number[] {
    return this.submits.get(`${publicationId}|${personaKey}`) ?? [];
  }
  putSubmits(publicationId: string, personaKey: string, timestampsMs: number[]): void {
    const key = `${publicationId}|${personaKey}`;
    if (timestampsMs.length === 0) {
      this.submits.delete(key);
    } else {
      this.submits.set(key, timestampsMs);
    }
  }
}

/** Per-persona + per-publication ceilings for the public submit route (Plan 39 P6). */
export interface PublicPostLimits {
  /** Accepted submits per persona per publication per window (durable flood cap). */
  postsPerPersonaPerWindow: number;
  /** The rolling flood window in ms. */
  windowMs: number;
  /** Hard ceiling on stored accepted posts per publication (memory/disk backstop). */
  maxPostsPerPublication: number;
}

export const DEFAULT_PUBLIC_POST_LIMITS: PublicPostLimits = {
  postsPerPersonaPerWindow: 12,
  windowMs: 60_000,
  maxPostsPerPublication: 50_000,
};

/** Verdict of a node-mediated public post submit (gates 4-5 + countersign). */
export type PublicPostSubmitVerdict =
  | { ok: true; accepted: AcceptedPublicPost; deduplicated: boolean }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 429 | 451 | 500 | 503; reason: string };

export type PublicPostModerationVerdict =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 404 | 409; reason: string };

/** Per-publication report list cap (memory backstop; csam/illegal retained first). */
export const DEFAULT_MAX_REPORTS_PER_PUBLICATION = 256;

export function capPublicReports(
  reports: readonly SignedPublicAbuseReport[],
  maximumReports: number,
): SignedPublicAbuseReport[] {
  const maximum = Math.max(1, Math.floor(maximumReports));
  if (reports.length <= maximum) return [...reports];
  const out = [...reports];
  while (out.length > maximum) {
    let index = out.findIndex((report) => !isPriorityPublicReport(report.report));
    if (index === -1) index = 0;
    out.splice(index, 1);
  }
  return out;
}
/**
 * Hard byte ceiling on a single accepted report (defense in depth: the §9 field caps
 * in verifyPublicAbuseReport already bound a legit report to ~hundreds of bytes, so a
 * report over 4 KB is malformed/abusive and is rejected before it can be stored).
 */
const MAX_PUBLIC_REPORT_JSON_CHARS = 4 * 1024;
/** Owner report-fetch signature freshness window (replay bound). */
const OWNER_REPORT_AUTH_WINDOW_MS = 5 * 60 * 1000;

/** Host abuse-intake verdict for an OPEN public report. */
export type PublicReportVerdict =
  | { ok: true }
  | { ok: false; status: 400 | 404; reason: string };

/** One report handed to the publication owner, with the host triage priority flag. */
export interface PublicReportRecord {
  report: PublicAbuseReport;
  signature: string;
  /** csam || illegal -> true (host + owner triage first). */
  priority: boolean;
}

/** Owner report-fetch verdict (owner-sig gated). */
export type OwnerReportsVerdict =
  | { ok: true; reports: PublicReportRecord[] }
  | { ok: false; status: 400 | 401 | 404; reason: string };

/** Owner-only register / public-read verdict (no member role; reads are anonymous). */
export type PublicationVerdict =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 429; reason: string };

/** Body of an owner-signed publication register (descriptor + its public snapshot(s)). */
export interface PublicationRegisterBody {
  descriptor: SignedPublicationDescriptor;
  snapshots: PublishSnapshotInput[];
}

/** A `(wall, counter)` HLC cursor for the public paging route (§5.6). */
export interface PublicationPageCursor {
  wall: string;
  counter: number;
}

/** The OPEN manifest payload: the signed descriptor + status + snapshot manifests. */
export interface PublicationManifestPayload {
  publicationId: string;
  status: PublicationStatus;
  kind: string;
  communityId: string;
  channelId: string | null;
  contentId: string;
  descriptor: SignedPublicationDescriptor;
  /** Each manifest is the JSON string the reader's parser reads back. */
  snapshots: { channelId: string; epoch: number; manifest: string }[];
}

/** The OPEN page payload (§5.6 wire format): events ascending HLC, cursor + hasMore. */
export interface PublicationPagePayload {
  events: ChannelMessageEvent[];
  /**
   * Node-accepted public posts (Plan 39 P6), merged into the SAME ascending-HLC
   * window + cursor as `events` (the receipt's node-assigned HLC orders them).
   * Tombstoned posts are dropped server-side; readers still dual-verify each unit
   * against the descriptor's pinned node key, fail-closed. Old clients ignore
   * this field (backward compatible).
   */
  publicPosts: AcceptedPublicPost[];
  /** `{wall}.{counter}` of the last returned item; the requested cursor when empty. */
  nextCursor: string | null;
  hasMore: boolean;
}

/** The authenticated action classes a per-device rate limit applies to (P6 item 3). */
export type RateLimitAction = PrivateRateLimitAction;

/** Per-minute ceilings. Challenge issuance is capped globally per community. */
export interface CommunityNodeRateLimits {
  /** Authenticated publish actions per device per windowMs. */
  publishPerWindow: number;
  /** Authenticated append actions per device per windowMs. */
  appendPerWindow: number;
  /** Authenticated pull (manifest) actions per device per windowMs. */
  pullPerWindow: number;
  /**
   * GLOBAL ceiling on live (unexpired) outstanding challenges per community. The
   * challenge route is pre-auth (no deviceId yet), so a per-device bucket is not
   * possible without an IP; instead we cap how many challenge nonces a community
   * can hold at once so a flood cannot exhaust memory. Issuance over the ceiling
   * is refused.
   */
  challengeCeilingPerCommunity: number;
  /** The rolling window in ms (default 60_000). */
  windowMs: number;
}

export const DEFAULT_RATE_LIMITS: CommunityNodeRateLimits = {
  publishPerWindow: 6,
  appendPerWindow: 60,
  pullPerWindow: 60,
  challengeCeilingPerCommunity: 30,
  windowMs: 60_000,
};

/** One channel's snapshot the node serves (metadata only; bytes live in the store). */
export interface CommunityNodeSnapshot {
  channelId: string;
  manifest: ContentManifest;
  record: { epoch: number; infoHash: string };
}

export interface PublishSnapshotInput {
  channelId: string;
  /** The epoch the snapshot was sealed under (the puller needs it to decrypt). */
  epoch: number;
  manifest: ContentManifest;
  /** The opaque sealed pieces, index-aligned with manifest.pieces. */
  pieces: Uint8Array[];
}

export interface CommunityNodePublishBody {
  descriptor: SignedCommunityDescriptor;
  snapshots: PublishSnapshotInput[];
}

export interface CommunityNodeManifestPayload {
  descriptor: SignedCommunityDescriptor | null;
  snapshots: CommunityNodeSnapshot[];
  tail: SealedTailEntry[];
}

/**
 * Hard ceiling on distinct UNCLAIMED community states (no published descriptor)
 * held at once (audit S3). The challenge/manifest/piece routes lazily create a
 * CommunityState per untrusted id, so without a bound the `communities` map grows
 * without limit. An unclaimed state holds only challenge nonces (each capped by
 * challengeCeilingPerCommunity),
 * so this caps the id dimension. A CLAIMED community (owner published a descriptor)
 * is NEVER counted here and never evicted.
 */
export const DEFAULT_MAX_UNCLAIMED_COMMUNITIES = 10_000;
export const DEFAULT_MAX_PRIVATE_TAIL_ENTRIES_PER_CHANNEL = 10_000;
export const DEFAULT_PRIVATE_PUBLISH_STAGE_TTL_MS = 10 * 60 * 1000;

export interface CommunityNodeOptions {
  /** Where opaque pieces are stored. Default in-memory. */
  pieceStore?: SeederPieceStore;
  /**
   * Restart-safe descriptor revision store (P6 item 2). Default in-memory; the
   * deploy artifact passes a FileCommunityDescriptorStore so revision monotonicity
   * survives a restart. The store is the source of truth across restarts; the
   * in-memory CommunityState is loaded lazily and never overrides it.
   */
  descriptorStore?: CommunityDescriptorStore;
  /**
   * Durable authority for private descriptor payloads, snapshot metadata, sealed
   * tails, challenge nonces, and authenticated rate windows. First-party nodes
   * inject PostgreSQL; complete self-host nodes inject the crash-safe file store.
   */
  privateStateStore?: CommunityPrivateStateStore;
  /**
   * Durable OPEN publication registry (Plan 19 P3a). Default in-memory; the deploy
   * artifact passes a FilePublicationStore so the public serving registry + revision
   * monotonicity survive a restart. Holds only owner-signed descriptors + manifests.
   */
  publicationStore?: PublicationStore;
  /**
   * Durable Trust & Safety kill ledger (Plan 19 P3a). Every serving and public
   * mutation path reads it live, so another process's kill is immediately visible.
   */
  killStore?: KillStore;
  /**
   * Durable host abuse-intake store (Plan 19 P8a). Default in-memory; the deploy
   * artifact passes a FileReportStore so unsealed public reports survive a restart.
   * Holds only reporter-signed public reports (no secrets).
   */
  reportStore?: ReportStore;
  /** Per-publication report list cap. Defaults to DEFAULT_MAX_REPORTS_PER_PUBLICATION. */
  maxReportsPerPublication?: number;
  /**
   * The single Trust & Safety authority device id this node trusts for takedowns.
   * When set, a verified SignedDescriptorKill for a community drops every publication
   * pointing at that community from all public routes (Plan 19 P3a / abuse-rails).
   */
  trustedKillAuthorityDeviceId?: string;
  /**
   * Per-device rate limits (P6 item 3). Defaults to DEFAULT_RATE_LIMITS. Pass a
   * partial to override individual ceilings.
   */
  rateLimits?: Partial<CommunityNodeRateLimits>;
  /** Injectable clock (ms). */
  now?: () => number;
  /** Challenge TTL in ms. */
  challengeTtlMs?: number;
  /**
   * Hard ceiling on distinct UNCLAIMED community states held at once (audit S3).
   * Defaults to DEFAULT_MAX_UNCLAIMED_COMMUNITIES. Bounds the `communities` map so
   * untrusted ids on the pre-descriptor routes cannot grow it without limit.
   * Claimed (published) communities are never counted or evicted.
   */
  maxUnclaimedCommunities?: number;
  /** Hard per-channel sealed-tail ceiling. Full channels reject instead of dropping ciphertext. */
  maxPrivateTailEntriesPerChannel?: number;
  /** Expiry for a staged publish while opaque pieces are written outside the state transaction. */
  privatePublishStageTtlMs?: number;
  /**
   * Liveness notify seam (community feed P4). After a REAL change -- a tail entry
   * was actually stored (append), or a publish actually changed content -- the
   * node parks ONE content-FREE ping on the community's notify token so a polling
   * subscriber wakes and ENQUEUES a pull. The token is derived from the stored
   * descriptor's `genesisNonce` + communityId, which the node legitimately holds,
   * so this needs NO epoch key and the zero-knowledge boundary stands: the ping
   * carries no content and the node still never decrypts anything.
   *
   * Injected so the node stays Expo-safe + test-injectable. When absent, the emit
   * is skipped silently. Production relay wiring of parkNotify (park the ping on
   * the relay's store-and-forward mailbox under `token`) is deferred ops.
   */
  parkNotify?: (token: string, ping: Uint8Array) => void | Promise<void>;
  /**
   * Durable public-post store (Plan 39 P6). Default in-memory; the deploy artifact
   * passes FilePublicPostStore so accepted posts, tombstones, the posting freeze,
   * and flood windows survive a restart.
   */
  publicPostStore?: PublicPostStore;
  /**
   * The node's RECEIPT keypair for countersigning accepted public posts (Plan 26
   * P3: persisted in DATA_DIR by the bin; owners pin the public half in
   * descriptor.postNodeKeyHex). ABSENT => the node cannot mint receipts and every
   * submit is rejected fail-closed.
   */
  postReceipt?: { publicKeyHex: string; privateKeyHex: string };
  /** Per-persona flood caps + storage ceilings for the submit route. */
  publicPostLimits?: Partial<PublicPostLimits>;
  /**
   * CSAM / abuse hash-scan seam for the PUBLIC submit boundary (Plan 39 P13). When present,
   * every public post carrying attachments is scanned (its blob hashes matched against the
   * known-bad set) BEFORE countersign + append. FAIL-CLOSED: a match => the post is refused
   * (451) and `onAbuseHashMatch` fires; a scanner outage (throw) => refused (503
   * scanner_unavailable). ABSENT => a post WITH attachments is refused 503 (media cannot be
   * accepted without a scan); text-only posts pass. The real vendor hash DB is founder-ops.
   */
  abuseScanner?: AbuseHashScanner;
  /**
   * Called (best-effort, awaited) when the abuse scanner matches a public post's blob(s). The
   * bin wires this to the durable NCMEC report queue so a scan hit files evidence references.
   * The post is refused REGARDLESS of this hook's outcome (the content is never accepted).
   */
  onAbuseHashMatch?: (match: PublicPostAbuseMatch) => void | Promise<void>;
}

export class CommunityNode {
  private readonly store: SeederPieceStore;
  private readonly descriptorStore: CommunityDescriptorStore;
  private readonly privateStateStore: CommunityPrivateStateStore;
  private readonly publicationStore: PublicationStore;
  private readonly killStore: KillStore;
  private readonly reportStore: ReportStore;
  private readonly maxReportsPerPublication: number;
  private readonly trustedKillAuthorityDeviceId?: string;
  /**
   * publicationId -> (channelId -> parsed HLC-sorted events, or null when that channel
   * is out of the snapshot's scope). The negative (null) result is cached too, so an
   * untrusted client alternating channelId cannot force a full crypto re-parse every request.
   * Invalidated wholesale per publicationId on re-register / unpublish.
   */
  private readonly publicEventsCache = new Map<string, Map<string, ChannelMessageEvent[] | null>>();
  /** publicationId -> the parsed contentId manifest (avoids re-JSON.parse per piece). */
  private readonly contentManifestCache = new Map<string, { contentId: string; manifest: ContentManifest }>();
  private readonly rateLimits: CommunityNodeRateLimits;
  private readonly now: () => number;
  private readonly challengeTtlMs: number;
  private readonly maxUnclaimedCommunities: number;
  private readonly maxPrivateTailEntriesPerChannel: number;
  private readonly privatePublishStageTtlMs: number;
  private readonly parkNotify?: (token: string, ping: Uint8Array) => void | Promise<void>;
  private readonly publicPostStore: PublicPostStore;
  private readonly postReceipt?: { publicKeyHex: string; privateKeyHex: string };
  private readonly publicPostLimits: PublicPostLimits;
  private readonly abuseScanner?: AbuseHashScanner;
  private readonly onAbuseHashMatch?: (match: PublicPostAbuseMatch) => void | Promise<void>;
  /**
   * Per-publication write serialization for the public-post paths. Submit,
   * tombstone, and freeze all read-modify-write the same store lists with awaits
   * in between; without a lock, two concurrent submits of the SAME post (two
   * valid humanity tokens) could both pass the dedup check and double-append, and
   * a racing tombstone could be overwritten. The chain tail is kept per
   * publication and dropped once settled, so memory stays bounded.
   */
  private readonly publicPostLocks = new Map<string, Promise<unknown>>();
  constructor(options: CommunityNodeOptions = {}) {
    this.store = options.pieceStore ?? new InMemorySeederPieceStore();
    this.descriptorStore = options.descriptorStore ?? new InMemoryCommunityDescriptorStore();
    this.privateStateStore = options.privateStateStore ?? new InMemoryCommunityPrivateStateStore();
    this.publicationStore = options.publicationStore ?? new InMemoryPublicationStore();
    this.killStore = options.killStore ?? new InMemoryKillStore();
    this.reportStore = options.reportStore ?? new InMemoryReportStore();
    this.maxReportsPerPublication = options.maxReportsPerPublication ?? DEFAULT_MAX_REPORTS_PER_PUBLICATION;
    this.trustedKillAuthorityDeviceId = options.trustedKillAuthorityDeviceId;
    this.rateLimits = { ...DEFAULT_RATE_LIMITS, ...(options.rateLimits ?? {}) };
    this.now = options.now ?? (() => Date.now());
    this.challengeTtlMs = options.challengeTtlMs ?? 2 * 60 * 1000;
    this.maxUnclaimedCommunities = options.maxUnclaimedCommunities ?? DEFAULT_MAX_UNCLAIMED_COMMUNITIES;
    this.maxPrivateTailEntriesPerChannel = options.maxPrivateTailEntriesPerChannel
      ?? DEFAULT_MAX_PRIVATE_TAIL_ENTRIES_PER_CHANNEL;
    this.privatePublishStageTtlMs = options.privatePublishStageTtlMs
      ?? DEFAULT_PRIVATE_PUBLISH_STAGE_TTL_MS;
    this.parkNotify = options.parkNotify;
    this.publicPostStore = options.publicPostStore ?? new InMemoryPublicPostStore();
    this.postReceipt = options.postReceipt;
    this.publicPostLimits = { ...DEFAULT_PUBLIC_POST_LIMITS, ...(options.publicPostLimits ?? {}) };
    this.abuseScanner = options.abuseScanner;
    this.onAbuseHashMatch = options.onAbuseHashMatch;
  }

  /**
   * Honest report of the abuse-scanner posture for the public submit boundary (Plan 39 P13).
   * `not_configured` means a media post cannot be accepted (it will be refused 503); never a
   * claim that content is clean when nothing scans it (NC-P4).
   */
  abuseScannerState(): AbuseScannerState {
    return this.abuseScanner ? 'configured' : 'not_configured';
  }

  /** The node's receipt PUBLIC key, or null when the node cannot accept posts. */
  postReceiptPublicKey(): string | null {
    return this.postReceipt?.publicKeyHex ?? null;
  }

  private rateCeiling(action: RateLimitAction): number {
    if (action === 'publish') return this.rateLimits.publishPerWindow;
    if (action === 'append') return this.rateLimits.appendPerWindow;
    return this.rateLimits.pullPerWindow;
  }

  private principalHash(deviceId: string): string {
    return createHash('sha256').update(deviceId, 'utf8').digest('hex');
  }

  /**
   * Park ONE content-free notify ping for a community on a REAL change. Derives
   * the token + seal key from the stored descriptor's genesisNonce (no epoch key,
   * no decryption). No-op when no parkNotify is wired or no descriptor is stored.
   * Best-effort: a parkNotify failure never breaks the append/publish result.
   */
  private async emitNotify(communityId: string, descriptor: CommunityDescriptor): Promise<void> {
    if (!this.parkNotify) return;
    const secret = descriptor.genesisNonce;
    const token = deriveCommunityNotifyToken(secret, communityId);
    const ping = buildCommunityNotifyPing(secret, communityId, new Date(this.now()).toISOString());
    try {
      await this.parkNotify(token, ping);
    } catch {
      // best-effort: a notify failure must not fail a real, committed change.
    }
  }

  /**
   * Public best-effort notify (Plan 57 W4): park one content-free ping after a
   * REAL external change the node core did not itself commit (e.g. a durably
   * parked join request). Same seam + honesty as the internal emitNotify calls:
   * a no-op with no wired parkNotify or no stored descriptor, never throws.
   */
  async notifyCommunityChange(communityId: string): Promise<void> {
    const state = await this.privateStateStore.getState(communityId);
    if (!state?.descriptor) return;
    await this.emitNotify(communityId, state.descriptor.descriptor);
  }

  /**
   * Drop every UNCLAIMED community state whose challenge nonces have all expired
   * (audit S3). Because a nonce lives only challengeTtlMs, any unclaimed id an
   * untrusted client sprayed becomes empty and is reclaimed within that window, so steady-
   * state memory is bounded by the flood rate over one TTL. Claimed communities and
   * unclaimed communities still holding a live nonce are left untouched. Safe to call
   * on a timer; the HTTP layer wires it to a periodic interval.
   */
  async sweepUnclaimed(): Promise<void> {
    await this.privateStateStore.sweepExpired(this.now());
  }

  /**
   * Reconciles expired publish stages after a crash between piece writes and the
   * metadata commit. Piece removal happens before the stage acknowledgement, so
   * a second crash only repeats an idempotent content-addressed delete.
   */
  async reconcilePrivatePublishStages(
    limit = 100,
  ): Promise<{ stagesCompleted: number; contentRemoved: number }> {
    const nowMs = this.now();
    const stages = await this.privateStateStore.listExpiredPublishStages(limit, nowMs);
    let stagesCompleted = 0;
    let contentRemoved = 0;
    for (const stage of stages) {
      for (const infoHash of stage.candidateInfoHashes) {
        if (await this.privateStateStore.isContentReferenced(infoHash)) continue;
        await this.store.removeContent(infoHash);
        contentRemoved += 1;
      }
      if (await this.privateStateStore.completeExpiredPublishStage(
        stage.communityId,
        stage.stageId,
        nowMs,
      )) {
        stagesCompleted += 1;
      }
    }
    return { stagesCompleted, contentRemoved };
  }

  /** Diagnostic: total active or challenge-bearing private community states. */
  async communityStateCount(): Promise<number> {
    return this.privateStateStore.trackedCommunityCount(this.now());
  }

  /**
   * Issue a single-use challenge nonce (open: a nonce leaks nothing). Returns null
   * when the community already holds challengeCeilingPerCommunity unexpired nonces:
   * the challenge route is pre-auth (no deviceId), so instead of a per-device bucket
   * we cap how many live challenges a community can hold so a flood cannot exhaust
   * memory (P6 item 3). Pruning runs first, so a ceiling hit means genuinely many
   * fresh outstanding challenges. The http layer maps null to a 429.
   */
  async issueChallenge(communityId: string): Promise<FeedChallenge | null> {
    const challenge = createFeedChallenge({
      ttlMs: this.challengeTtlMs,
      now: new Date(this.now()).toISOString(),
    });
    return this.privateStateStore.issueChallenge({
      communityId,
      nonce: challenge.nonce,
      ttlMs: this.challengeTtlMs,
      ceilingPerCommunity: this.rateLimits.challengeCeilingPerCommunity,
      maxUnclaimedCommunities: this.maxUnclaimedCommunities,
      nowMs: this.now(),
    });
  }

  private async inspectVerifiedAuth(
    communityId: string,
    auth: FeedAuthHeader,
  ): Promise<
    | {
      ok: true;
      role: WorkspaceMemberRole;
      context: PrivateChallengeContext & { state: PrivateCommunityIdentityState };
    }
    | Extract<CommunityNodeVerdict, { ok: false }>
  > {
    const inspected = await this.privateStateStore.inspectChallenge(
      communityId,
      auth.nonce,
      this.now(),
    );
    if (inspected.outcome !== 'ready') {
      return { ok: false, status: 401, reason: inspected.outcome };
    }
    const context = inspected.context;
    if (!context.state) return { ok: false, status: 401, reason: 'no_descriptor' };
    const verdict = verifyFeedAuth({
      communityId,
      nonce: auth.nonce,
      ts: auth.ts,
      deviceId: auth.deviceId,
      signature: auth.signature,
      descriptor: context.state.descriptor.descriptor,
      now: context.authorityNow,
      expiresAt: context.expiresAt,
    });
    if (!verdict.ok) return { ok: false, status: 401, reason: verdict.reason };
    return {
      ok: true,
      role: verdict.role,
      context: context as PrivateChallengeContext & { state: PrivateCommunityIdentityState },
    };
  }

  private authorizationFailure(
    outcome: Exclude<
      Awaited<ReturnType<CommunityPrivateStateStore['authorizeRequest']>>,
      'accepted'
    >,
  ): Extract<CommunityNodeVerdict, { ok: false }> {
    if (outcome === 'rate_limited') return { ok: false, status: 429, reason: outcome };
    if (outcome === 'state_changed') return { ok: false, status: 409, reason: outcome };
    return { ok: false, status: 401, reason: outcome };
  }

  /**
   * Verify an auth proof: the nonce was issued by THIS node + unexpired, then
   * verifyFeedAuth against the stored descriptor. Rejects if no descriptor has
   * been published yet (nothing to verify membership against).
   *
   * `consume` is true for STATE-CHANGING ops (publish/append) so the nonce is
   * single-use (replay protection). READ ops (manifest, then the piece batch)
   * pass `consume: false` so one challenge covers a whole pull: manifest plus its
   * opaque ciphertext pieces. The nonce still expires; pieces leak nothing.
   *
   * `action` opts the request into the per-device rate limit (P6 item 3) AFTER auth
   * passes, so an unauthenticated flood is not throttled (it is rejected at auth
   * for free) and only a real, signed member counts against its bucket. The manifest
   * pull passes 'pull'; the piece batch passes none (those pieces ride the same
   * already-counted pull). Over-limit yields a 429 rate_limited verdict.
   */
  async verifyRequest(
    communityId: string,
    auth: FeedAuthHeader,
    consume = false,
    action?: RateLimitAction,
  ): Promise<CommunityNodeVerdict> {
    const verified = await this.inspectVerifiedAuth(communityId, auth);
    if (!verified.ok) return verified;
    const authorization = await this.privateStateStore.authorizeRequest({
      communityId,
      nonce: auth.nonce,
      expectedDescriptorHash: verified.context.state.descriptorHash,
      consume,
      action,
      principalHash: action ? this.principalHash(auth.deviceId) : undefined,
      ceiling: action ? this.rateCeiling(action) : undefined,
      windowMs: action ? this.rateLimits.windowMs : undefined,
      nowMs: this.now(),
    });
    if (authorization === 'accepted') return { ok: true, role: verified.role };
    return this.authorizationFailure(authorization);
  }

  /** Atomically authorizes a pull and returns the exact state revision it authorized. */
  async getAuthenticatedManifest(
    communityId: string,
    auth: FeedAuthHeader,
  ): Promise<CommunityManifestVerdict> {
    const verified = await this.inspectVerifiedAuth(communityId, auth);
    if (!verified.ok) return verified;
    const authorized = await this.privateStateStore.authorizeAndReadState({
      communityId,
      nonce: auth.nonce,
      expectedDescriptorHash: verified.context.state.descriptorHash,
      consume: false,
      action: 'pull',
      principalHash: this.principalHash(auth.deviceId),
      ceiling: this.rateCeiling('pull'),
      windowMs: this.rateLimits.windowMs,
      nowMs: this.now(),
    });
    if (authorized.outcome !== 'accepted') return this.authorizationFailure(authorized.outcome);
    return {
      ok: true,
      role: verified.role,
      payload: {
        descriptor: authorized.state.descriptor,
        snapshots: authorized.state.snapshots,
        tail: authorized.state.tail,
      },
    };
  }

  /** Atomically authorizes a piece scope before reading its opaque bytes. */
  async serveAuthenticatedPiece(
    communityId: string,
    infoHash: string,
    index: number,
    auth: FeedAuthHeader,
  ): Promise<CommunityPieceVerdict> {
    const verified = await this.inspectVerifiedAuth(communityId, auth);
    if (!verified.ok) return verified;
    const authorized = await this.privateStateStore.authorizeAndCheckContent({
      communityId,
      nonce: auth.nonce,
      expectedDescriptorHash: verified.context.state.descriptorHash,
      consume: false,
      nowMs: this.now(),
    }, infoHash);
    if (authorized.outcome !== 'accepted') return this.authorizationFailure(authorized.outcome);
    return {
      ok: true,
      role: verified.role,
      bytes: authorized.owned ? await this.store.get(infoHash, index) : null,
    };
  }

  /**
   * Publish a descriptor + per-channel snapshots. AUTH required (must be a
   * member). ONLY the owner may set/replace the descriptor: the authed device
   * must equal descriptor.ownerDeviceId AND verifyCommunityDescriptor must hold.
   * Each snapshot's pieces are verified by HASH (verifyCatalogPiece) + the
   * manifest's own internal consistency -- never decrypted. Compaction drops a
   * channel's previous infoHash pieces when the id changes.
   */
  async publish(
    communityId: string,
    body: CommunityNodePublishBody,
    auth: FeedAuthHeader,
  ): Promise<CommunityNodeVerdict> {
    // For the FIRST publish there is no stored descriptor to auth against, so the
    // body's signed descriptor is the bootstrap roster. Verify it stands on its
    // own AND the authed device is its owner before trusting it.
    const signed = body?.descriptor;
    if (!signed?.descriptor || signed.descriptor.communityId !== communityId) {
      return { ok: false, status: 400, reason: 'bad_descriptor' };
    }
    if (auth.deviceId !== signed.descriptor.ownerDeviceId) {
      return { ok: false, status: 401, reason: 'not_owner' };
    }

    const inspected = await this.privateStateStore.inspectChallenge(
      communityId,
      auth.nonce,
      this.now(),
    );
    if (inspected.outcome !== 'ready') {
      return { ok: false, status: 401, reason: inspected.outcome };
    }
    const challenge = inspected.context;
    const authVerdict = verifyFeedAuth({
      communityId,
      nonce: auth.nonce,
      ts: auth.ts,
      deviceId: auth.deviceId,
      signature: auth.signature,
      descriptor: signed.descriptor,
      now: challenge.authorityNow,
      expiresAt: challenge.expiresAt,
    });
    if (!authVerdict.ok) return { ok: false, status: 401, reason: authVerdict.reason };

    // Durable revision monotonicity (P6 item 2). The DESCRIPTOR STORE -- not the
    // in-memory state -- is the source of truth across restarts. Reject when the
    // incoming revision is <= the highest revision EVER seen for a DIFFERENT
    // descriptor hash, so an owner-signed OLDER roster cannot re-grant a removed
    // member after a node restart wiped the in-memory guard. Re-publishing the
    // EXACT same revision+hash is allowed (idempotent re-announce on restart).
    const incomingHash = communityDescriptorHash(signed);
    const highest = await this.descriptorStore.getHighestRevision(communityId);
    if (highest
      && signed.descriptor.revision <= highest.revision
      && incomingHash !== highest.descriptorHash) {
      return { ok: false, status: 400, reason: 'stale_revision' };
    }

    // Descriptor integrity. When the node already holds the immediate predecessor,
    // chain-verify the new revision off it (full audit: chain hash + monotonic
    // revision + owner signature). Otherwise -- a genesis, or a cold-start where
    // the owner publishes the CURRENT (already-revised) descriptor with no
    // predecessor on this node -- verify the owner's signature standalone. The
    // owner signs every revision and is authoritative; an older stored revision is
    // never allowed to overwrite a newer one (the durable guard above is the
    // restart-safe backstop; this in-memory guard catches the same-lifetime case).
    const previous = challenge.state?.descriptor ?? null;
    if (previous && signed.descriptor.revision < previous.descriptor.revision) {
      return { ok: false, status: 400, reason: 'stale_revision' };
    }
    const chains = !!previous
      && signed.descriptor.revision === previous.descriptor.revision + 1
      && verifyCommunityDescriptor(signed, previous);
    if (!chains && !verifyDescriptorOwnerSignature(signed)) {
      return { ok: false, status: 400, reason: 'bad_descriptor' };
    }

    const activeState = await this.privateStateStore.getState(communityId);
    if ((activeState?.descriptorHash ?? null) !== (challenge.state?.descriptorHash ?? null)) {
      return { ok: false, status: 409, reason: 'state_changed' };
    }

    const authorization = await this.privateStateStore.authorizeRequest({
      communityId,
      nonce: auth.nonce,
      expectedDescriptorHash: challenge.state?.descriptorHash ?? null,
      consume: true,
      action: 'publish',
      principalHash: this.principalHash(auth.deviceId),
      ceiling: this.rateCeiling('publish'),
      windowMs: this.rateLimits.windowMs,
      nowMs: this.now(),
    });
    if (authorization === 'rate_limited') {
      return { ok: false, status: 429, reason: authorization };
    }
    if (authorization === 'state_changed') {
      return { ok: false, status: 409, reason: authorization };
    }
    if (authorization !== 'accepted') {
      return { ok: false, status: 401, reason: authorization };
    }

    // Snapshot integrity WITHOUT decryption.
    if (!Array.isArray(body.snapshots) || body.snapshots.length > 1_024) {
      return { ok: false, status: 400, reason: 'bad_manifest' };
    }
    const seenChannels = new Set<string>();
    for (const snap of body.snapshots ?? []) {
      if (!snap.channelId || seenChannels.has(snap.channelId)) {
        return { ok: false, status: 400, reason: 'bad_manifest' };
      }
      seenChannels.add(snap.channelId);
      const manifest = snap.manifest;
      if (!manifest?.infoHash || manifest.pieces.length === 0) {
        return { ok: false, status: 400, reason: 'bad_manifest' };
      }
      if ((snap.pieces?.length ?? 0) !== manifest.pieces.length) {
        return { ok: false, status: 400, reason: 'piece_count_mismatch' };
      }
      // Manifest internally consistent: its piece hashes roll up to its merkleRoot.
      if (computeMerkleRoot(manifest.pieces) !== manifest.merkleRoot) {
        return { ok: false, status: 400, reason: 'bad_manifest' };
      }
      // Every supplied piece must hash to the manifest's recorded piece hash.
      for (let i = 0; i < manifest.pieces.length; i += 1) {
        if (!verifyCatalogPiece(manifest, i, snap.pieces[i]!)) {
          return { ok: false, status: 400, reason: 'bad_piece' };
        }
      }
    }

    const mergedSnapshots = new Map<string, StoredPrivateSnapshot>();
    for (const prior of activeState?.snapshots ?? []) {
      mergedSnapshots.set(prior.channelId, prior);
    }
    let contentChanged = false;
    for (const snap of body.snapshots) {
      const prior = mergedSnapshots.get(snap.channelId);
      if (!prior || prior.manifest.infoHash !== snap.manifest.infoHash) contentChanged = true;
      mergedSnapshots.set(snap.channelId, {
        channelId: snap.channelId,
        manifest: snap.manifest,
        record: { epoch: snap.epoch, infoHash: snap.manifest.infoHash },
      });
    }
    const snapshots = [...mergedSnapshots.values()].sort((left, right) =>
      left.channelId.localeCompare(right.channelId));
    const publishDigest = createHash('sha256')
      .update(JSON.stringify(['community-private-publish-v1', signed, snapshots]), 'utf8')
      .digest('hex');
    const stageId = createHash('sha256')
      .update(JSON.stringify(['community-private-stage-v1', communityId, publishDigest]), 'utf8')
      .digest('hex');
    const staged = await this.privateStateStore.beginPublish({
      communityId,
      expectedDescriptorHash: activeState?.descriptorHash ?? null,
      descriptor: signed,
      descriptorHash: incomingHash,
      publishDigest,
      stageId,
      snapshots,
      stageTtlMs: this.privatePublishStageTtlMs,
      nowMs: this.now(),
    });
    if (staged.outcome === 'busy') return { ok: false, status: 409, reason: 'publish_in_progress' };
    if (staged.outcome === 'stale' || staged.outcome === 'conflict') {
      return { ok: false, status: 409, reason: 'state_changed' };
    }

    // Piece writes are external and intentionally happen after the durable stage
    // transaction closes. Content-addressed puts are safe to repeat after a crash.
    for (const snap of body.snapshots) {
      for (let i = 0; i < snap.manifest.pieces.length; i += 1) {
        await this.store.put(snap.manifest.infoHash, i, snap.pieces[i]!);
      }
    }
    const committed = await this.privateStateStore.commitPublish({
      communityId,
      stageId,
      publishDigest,
      nowMs: this.now(),
    });
    if (committed.outcome === 'missing' || committed.outcome === 'expired') {
      if (committed.outcome === 'expired') await this.reconcilePrivatePublishStages(1);
      return { ok: false, status: 409, reason: 'publish_stage_expired' };
    }
    if (committed.outcome === 'conflict') {
      return { ok: false, status: 409, reason: 'state_changed' };
    }

    const revisionClaim = await this.descriptorStore.claimRevision(
      communityId,
      signed.descriptor.revision,
      incomingHash,
    );
    if (revisionClaim === 'stale' || revisionClaim === 'conflict') {
      throw new Error('Private community descriptor ledger diverged after a committed publish.');
    }
    const currentInfoHashes = new Set(snapshots.map((snapshot) => snapshot.manifest.infoHash));
    const previousInfoHashes = 'previousInfoHashes' in committed
      ? committed.previousInfoHashes
      : [];
    for (const priorInfoHash of previousInfoHashes) {
      if (currentInfoHashes.has(priorInfoHash)) continue;
      if (!await this.privateStateStore.isContentReferenced(priorInfoHash)) {
        await this.store.removeContent(priorInfoHash);
      }
    }

    // Notify ONLY on a real content change (never a descriptor-only / no-op
    // publish). The ping is content-free and derived from the descriptor only.
    if (contentChanged && committed.outcome === 'committed') {
      await this.emitNotify(communityId, signed.descriptor);
    }

    return { ok: true, role: authVerdict.role };
  }

  /**
   * Append one sealed tail entry. AUTH required (member). The entry's OUTER
   * over-ciphertext author signature is verified (verifySealedTailEntry) and the
   * author must be a descriptor member -- never decrypted.
   */
  async append(communityId: string, entry: SealedTailEntry, auth: FeedAuthHeader): Promise<CommunityNodeVerdict> {
    if (!entry || entry.communityId !== communityId) {
      return { ok: false, status: 400, reason: 'bad_entry' };
    }
    const inspected = await this.privateStateStore.inspectChallenge(
      communityId,
      auth.nonce,
      this.now(),
    );
    if (inspected.outcome !== 'ready') {
      return { ok: false, status: 401, reason: inspected.outcome };
    }
    const context = inspected.context;
    if (!context.state) return { ok: false, status: 401, reason: 'no_descriptor' };
    const authVerdict = verifyFeedAuth({
      communityId,
      nonce: auth.nonce,
      ts: auth.ts,
      deviceId: auth.deviceId,
      signature: auth.signature,
      descriptor: context.state.descriptor.descriptor,
      now: context.authorityNow,
      expiresAt: context.expiresAt,
    });
    if (!authVerdict.ok) return { ok: false, status: 401, reason: authVerdict.reason };
    const tailVerdict = verifySealedTailEntry(entry, context.state.descriptor.descriptor);
    if (!tailVerdict.ok) return { ok: false, status: 400, reason: tailVerdict.reason };

    const replayKey = createHash('sha256').update(JSON.stringify([
      'community-private-tail-v1',
      entry.communityId,
      entry.channelId,
      entry.authorDeviceId,
      entry.hlcWall,
      entry.hlcCounter,
      entry.sealedHex,
      entry.entrySignature,
    ]), 'utf8').digest('hex');
    const appended = await this.privateStateStore.appendTail({
      communityId,
      nonce: auth.nonce,
      expectedDescriptorHash: context.state.descriptorHash,
      consume: true,
      action: 'append',
      principalHash: this.principalHash(auth.deviceId),
      ceiling: this.rateCeiling('append'),
      windowMs: this.rateLimits.windowMs,
      nowMs: this.now(),
      entry,
      replayKey,
      maximumEntriesPerChannel: this.maxPrivateTailEntriesPerChannel,
    });
    if (appended.outcome === 'rate_limited' || appended.outcome === 'tail_full') {
      return { ok: false, status: 429, reason: appended.outcome };
    }
    if (appended.outcome === 'state_changed') {
      return { ok: false, status: 409, reason: appended.outcome };
    }
    if (appended.outcome === 'bad_nonce' || appended.outcome === 'expired') {
      return { ok: false, status: 401, reason: appended.outcome };
    }

    // A real tail entry was stored: park ONE content-free notify ping so polling
    // subscribers wake and ENQUEUE a pull. Never reached on a rejected append.
    if (appended.outcome === 'inserted') {
      await this.emitNotify(communityId, context.state.descriptor.descriptor);
    }

    return { ok: true, role: authVerdict.role };
  }

  /** The AUTH'd pull payload: descriptor + snapshot metadata + tail (no piece bytes). */
  async getManifest(communityId: string): Promise<CommunityNodeManifestPayload> {
    const state = await this.privateStateStore.getState(communityId);
    return {
      descriptor: state?.descriptor ?? null,
      snapshots: state?.snapshots ?? [],
      tail: state?.tail ?? [],
    };
  }

  /**
   * Serve one opaque ciphertext piece from the store WITHOUT a community scope.
   * Low-level: used by tests + by servePieceForCommunity after the scope check.
   * The HTTP layer never reaches this directly; it goes through the scoped path.
   */
  async servePiece(infoHash: string, index: number): Promise<Uint8Array | null> {
    return this.store.get(infoHash, index);
  }

  /**
   * Per-community scoped piece serve (P6 item 1). Serve a piece ONLY when its
   * infoHash belongs to one of THIS community's stored snapshots; otherwise null.
   * Closes the cross-community fetch: a member authed for community A can no longer
   * read community B's opaque pieces, because the http route gates this with
   * community A's verifyRequest and A's snapshots never reference B's infoHash.
   * Pieces stay opaque ciphertext (the node holds no epoch key), so this only
   * tightens WHO may fetch WHICH sealed bytes -- it never decrypts.
   */
  async servePieceForCommunity(communityId: string, infoHash: string, index: number): Promise<Uint8Array | null> {
    const state = await this.privateStateStore.getState(communityId);
    if (!state) return null;
    const owned = state.snapshots.some((snapshot) => snapshot.manifest.infoHash === infoHash);
    if (!owned) return null;
    return this.store.get(infoHash, index);
  }

  /** Does this node currently hold a descriptor for a community? */
  async hasCommunity(communityId: string): Promise<boolean> {
    return !!await this.privateStateStore.getState(communityId);
  }

  /**
   * The community's current signed descriptor + serveable snapshots (Plan 43
   * WP-43G). Read-only: exposes exactly what publish()/servePieceForCommunity
   * already trust, so the private-history announce loop can decide whether this
   * node has a CURRENT descriptor and a serveable cold-start snapshot for a
   * community WITHOUT reaching into the store directly. Null when this node does
   * not host the community.
   */
  async getPrivateCommunityState(communityId: string): Promise<StoredPrivateCommunityState | null> {
    return this.privateStateStore.getState(communityId);
  }

  // -------------------------------------------------------------------------
  // OPEN public publications (Plan 19 P3a). Owner-signed register; anonymous read.
  // -------------------------------------------------------------------------

  /**
   * Register (or revise) an OPEN publication. OWNER-ONLY: the descriptor is
   * self-authenticating -- verifyPublication confirms it was Ed25519-signed by its
   * ownerDeviceId (genesis) or chains off the stored predecessor (revision). A
   * forged/tampered descriptor or a takeover attempt fails closed. Durable revision
   * monotonicity mirrors publish(): an OLDER or conflicting same-revision descriptor
   * can never supersede a newer stored one; an identical re-register is idempotent.
   *
   * The provided public snapshot pieces are verified by HASH (verifyCatalogPiece +
   * merkle root) exactly like publish() -- the node never trusts host bytes. The
   * descriptor's contentId MUST be present among the snapshots (that is the public
   * snapshot served to readers). The node never decrypts: public snapshots are
   * sealed with the published key (carried in the clear), so serving stays opaque.
   *
   * NOTE: `descriptor.communityId` is SELF-ASSERTED at this layer -- it is signed by
   * the publication owner but NOT bound to the real community roster here (the node
   * may not even hold that CommunityDescriptor). The client MUST NOT present it as a
   * verified "this is community X" badge until roster binding lands (a later phase).
   */
  /**
   * Un-pin a contentId's bytes ONLY when no OTHER active publication still references
   * them. Dedup is keyed by the content-addressed contentId, so two distinct
   * publications can share ONE stored copy; removing the shared bytes while another
   * active publication still serves them would 404 that victim (a republish-then-take-
   * down griefing vector). Only ACTIVE publications hold a live serving reference.
   */
  private async removeContentIfUnreferenced(contentId: string, excludePublicationId: string): Promise<void> {
    for (const rec of await this.publicationStore.list()) {
      const d = rec.signed.descriptor;
      if (d.publicationId === excludePublicationId) continue;
      if (d.status !== 'active') continue;
      if (await this.killStore.isKilled(d.communityId)) continue;
      if (d.contentId === contentId) return; // still referenced -> keep the shared bytes
    }
    await this.store.removeContent(contentId);
  }

  async registerPublication(body: PublicationRegisterBody): Promise<PublicationVerdict> {
    const signed = body?.descriptor;
    if (!signed?.descriptor || typeof signed.descriptor.publicationId !== 'string' || !signed.descriptor.publicationId) {
      return { ok: false, status: 400, reason: 'bad_publication' };
    }
    const publicationId = signed.descriptor.publicationId;
    return this.publicationStore.withPublicationWriteLock(
      publicationId,
      () => this.registerPublicationLocked(body),
    );
  }

  private async registerPublicationLocked(body: PublicationRegisterBody): Promise<PublicationVerdict> {
    const signed = body.descriptor;
    const publicationId = signed.descriptor.publicationId;
    const rev = signed.descriptor.revision;
    const prior = await this.publicationStore.get(publicationId);

    // FF1: a TERMINAL owner takedown (unpublish/kill) is idempotent and is NOT subject
    // to previousHash/revision adjacency -- only owner authentication against the stored
    // predecessor. Without this branch, a takedown whose revision skipped ahead of the
    // stored one (the owner revised locally and only re-registers the terminal takedown
    // here) is rejected below as missing_predecessor, so the host keeps serving content
    // the owner already pulled (state divergence). This mirrors the public-directory-node
    // recordUnpublish fix. A non-owner forgery fails verifyOwnerTakedown fail-closed and
    // falls through to the normal chained path (which rejects it as not_owner/invalid).
    const status = signed.descriptor.status;
    if (status === 'active' && await this.killStore.isKilled(signed.descriptor.communityId)) {
      return { ok: false, status: 400, reason: 'community_killed' };
    }
    if (prior && (status === 'unpublished' || status === 'killed') && verifyOwnerTakedown(signed, prior.signed)) {
      // Persist the takedown (serving is gated on status === 'active', so this stops
      // every public route) and un-pin the durable bytes IF no other active publication
      // shares them. No snapshots are required: a takedown removes content, it does not
      // re-supply it.
      await this.removeContentIfUnreferenced(prior.signed.descriptor.contentId, publicationId);
      const replaced = await this.publicationStore.replace(
        publicationId,
        prior.signed.descriptor.revision,
        { signed, snapshots: [] },
      );
      if (replaced === 'conflict') {
        return { ok: false, status: 400, reason: 'stale_revision' };
      }
      this.publicEventsCache.delete(publicationId);
      this.contentManifestCache.delete(publicationId);
      return { ok: true };
    }

    // Durable revision monotonicity (mirrors community-descriptor monotonicity).
    if (prior) {
      const priorRev = prior.signed.descriptor.revision;
      if (rev < priorRev) return { ok: false, status: 400, reason: 'stale_revision' };
      if (rev === priorRev) {
        if (publicationDescriptorHash(prior.signed) === publicationDescriptorHash(signed)) {
          return { ok: true }; // idempotent re-register
        }
        return { ok: false, status: 400, reason: 'stale_revision' };
      }
      // rev > priorRev: only the IMMEDIATE successor can chain-verify (fail closed).
      if (rev !== priorRev + 1) return { ok: false, status: 400, reason: 'missing_predecessor' };
    } else if (rev !== 1) {
      // No stored predecessor and not a genesis: cannot confirm the chain (fail closed).
      return { ok: false, status: 400, reason: 'missing_predecessor' };
    }

    const previous = rev === 1 ? null : (prior ? prior.signed : null);
    const verdict = verifyPublication(signed, previous);
    if (verdict === 'invalid') return { ok: false, status: 400, reason: 'bad_publication' };
    if (verdict === 'not_owner') return { ok: false, status: 401, reason: 'not_owner' };
    // verdict is 'ok' (active/unpublished) or 'killed' -- both are valid owner-signed
    // states we persist; an unpublished/killed one simply will not be served below.

    // Snapshot integrity WITHOUT decryption: every supplied piece must hash to the
    // manifest's recorded piece hash + the manifest must be internally consistent.
    const contentId = signed.descriptor.contentId;
    const stored: StoredPublicationSnapshot[] = [];
    let contentProvided = false;
    for (const snap of body.snapshots ?? []) {
      const manifest = snap.manifest;
      if (!manifest?.infoHash || manifest.pieces.length === 0) return { ok: false, status: 400, reason: 'bad_manifest' };
      if ((snap.pieces?.length ?? 0) !== manifest.pieces.length) return { ok: false, status: 400, reason: 'piece_count_mismatch' };
      if (computeMerkleRoot(manifest.pieces) !== manifest.merkleRoot) return { ok: false, status: 400, reason: 'bad_manifest' };
      for (let i = 0; i < manifest.pieces.length; i += 1) {
        if (!verifyCatalogPiece(manifest, i, snap.pieces[i]!)) return { ok: false, status: 400, reason: 'bad_piece' };
      }
      if (manifest.infoHash === contentId) contentProvided = true;
      stored.push({ channelId: snap.channelId, epoch: snap.epoch, manifestJson: JSON.stringify(manifest) });
    }
    if (!contentProvided) return { ok: false, status: 400, reason: 'content_not_provided' };

    // Commit: compact the prior contentId when it changed (only if no other active
    // publication still references those shared bytes), store pieces, then the
    // descriptor + manifest metadata. Invalidate the parsed-events cache.
    if (prior && prior.signed.descriptor.contentId !== contentId) {
      await this.removeContentIfUnreferenced(prior.signed.descriptor.contentId, publicationId);
    }
    for (const snap of body.snapshots ?? []) {
      for (let i = 0; i < snap.manifest.pieces.length; i += 1) {
        await this.store.put(snap.manifest.infoHash, i, snap.pieces[i]!);
      }
    }
    const replaced = await this.publicationStore.replace(
      publicationId,
      prior?.signed.descriptor.revision ?? null,
      { signed, snapshots: stored },
    );
    if (replaced === 'conflict') {
      return { ok: false, status: 400, reason: 'stale_revision' };
    }
    // Invalidate every cached derivation for this publication (parsed events per
    // channel + the contentId manifest), so a revision/unpublish takes effect at once.
    this.publicEventsCache.delete(publicationId);
    this.contentManifestCache.delete(publicationId);
    return { ok: true };
  }

  /**
   * Record a Trust & Safety takedown for a community. Honored ONLY when the node is
   * configured with a trusted authority AND the kill verifies against it
   * (verifyDescriptorKill). A verified kill is persisted to the durable kill ledger,
   * dropping every publication pointing at that community from all public routes.
   * Returns false when ignored (no authority / unverifiable
   * signature) so an unsigned or foreign kill can never suppress content.
   */
  async recordPublicationKill(signed: SignedDescriptorKill): Promise<boolean> {
    if (!this.trustedKillAuthorityDeviceId) return false;
    if (!verifyDescriptorKill(signed, this.trustedKillAuthorityDeviceId)) return false;
    await this.killStore.recordKill(signed);
    return true;
  }

  /**
   * OPEN host abuse-intake (Plan 19 P8a, §9). Accept one UNSEALED, reporter-signed
   * public report for a publication this host serves. FAIL-CLOSED: a forged/unknown
   * report (verifyPublicAbuseReport false) is rejected; a report whose publicationId
   * does not match the route is rejected; a report for a publication this host does
   * NOT serve is rejected (which also BOUNDS memory -- the store cannot be grown by
   * spraying unknown ids). Stored append-only, capped per publication with csam/illegal
   * retained preferentially. No owner DH key is needed: the host verifies the
   * reporter's Ed25519 signature alone. The HTTP layer rate-limits this open route.
   */
  async submitPublicReport(publicationId: string, signed: SignedPublicAbuseReport): Promise<PublicReportVerdict> {
    if (!verifyPublicAbuseReport(signed)) return { ok: false, status: 400, reason: 'bad_report' };
    // Byte ceiling (defense in depth on top of the §9 field caps): a report over the
    // JSON cap is malformed/abusive and is rejected before it can be stored.
    if (JSON.stringify(signed).length > MAX_PUBLIC_REPORT_JSON_CHARS) return { ok: false, status: 400, reason: 'bad_report' };
    if (signed.report.publicationId !== publicationId) return { ok: false, status: 400, reason: 'id_mismatch' };
    // Intake only for content this host actually serves: the report store is bounded
    // by the (already bounded) publication set, and the owner-fetch path needs the
    // stored descriptor's ownerDeviceId anyway. Any status (active/unpublished) counts.
    const publication = await this.publicationStore.get(publicationId);
    if (!publication) return { ok: false, status: 404, reason: 'unknown_publication' };
    if (await this.killStore.isKilled(publication.signed.descriptor.communityId)) {
      return { ok: false, status: 404, reason: 'unknown_publication' };
    }
    await this.reportStore.appendCapped(
      publicationId,
      signed,
      this.maxReportsPerPublication,
    );
    return { ok: true };
  }

  /**
   * OWNER report fetch (Plan 19 P8a, §9). The publication OWNER pulls the host-stored
   * reports for their OWN publication, proving ownership with an Ed25519 signature over
   * a canonical (publicationId, ts) -- verified against the STORED publication's
   * ownerDeviceId (mirrors how registerPublication proves the owner). FAIL-CLOSED: an
   * unknown publication 404s; a stale/future ts (replay) or a signature that is not the
   * owner's 401s. Returns the reports priority-flagged (csam/illegal first, then most
   * recent). This is how the owner SEES the host-intake reports without an app server.
   */
  async getPublicReportsForOwner(publicationId: string, ts: string, signature: string): Promise<OwnerReportsVerdict> {
    const publication = await this.publicationStore.get(publicationId);
    if (!publication) return { ok: false, status: 404, reason: 'unknown_publication' };
    if (await this.killStore.isKilled(publication.signed.descriptor.communityId)) {
      return { ok: false, status: 404, reason: 'unknown_publication' };
    }
    const ownerDeviceId = publication.signed.descriptor.ownerDeviceId;
    const tsMs = Date.parse(ts);
    if (!Number.isFinite(tsMs) || Math.abs(this.now() - tsMs) > OWNER_REPORT_AUTH_WINDOW_MS) {
      return { ok: false, status: 401, reason: 'expired' };
    }
    if (!verifyPublicReportFetchSignature(ownerDeviceId, publicationId, ts, signature)) {
      return { ok: false, status: 401, reason: 'not_owner' };
    }
    const stored = (await this.reportStore.get(publicationId)) ?? [];
    const reports: PublicReportRecord[] = stored.map((s) => ({
      report: s.report,
      signature: s.signature,
      priority: isPriorityPublicReport(s.report),
    }));
    reports.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      if (a.report.reportedAt !== b.report.reportedAt) return a.report.reportedAt < b.report.reportedAt ? 1 : -1;
      return 0;
    });
    return { ok: true, reports };
  }

  /**
   * The serving view of a publication, or null when it must NOT be served: unknown,
   * status !== 'active' (unpublished or killed), or its community has a verified
   * DescriptorKill. Every public route gates on this and 404s on null.
   */
  private async resolvePublication(publicationId: string): Promise<StoredPublication | null> {
    const record = await this.publicationStore.get(publicationId);
    if (!record) return null;
    if (record.signed.descriptor.status !== 'active') return null;
    if (await this.killStore.isKilled(record.signed.descriptor.communityId)) return null;
    return record;
  }

  /** OPEN: the publication's current public snapshot manifest(s) + status. Null = 404. */
  async getPublicationManifest(publicationId: string): Promise<PublicationManifestPayload | null> {
    const record = await this.resolvePublication(publicationId);
    if (!record) return null;
    const d = record.signed.descriptor;
    return {
      publicationId,
      status: d.status,
      kind: d.kind,
      communityId: d.communityId,
      channelId: d.channelId,
      contentId: d.contentId,
      descriptor: record.signed,
      snapshots: record.snapshots.map((s) => ({ channelId: s.channelId, epoch: s.epoch, manifest: s.manifestJson })),
    };
  }

  /**
   * OPEN: serve a single public snapshot piece. NC-2 (critical): the infoHash MUST
   * equal the publication's OWN contentId, so a public read for publication P can
   * NEVER reach another (private) snapshot's pieces -- even in the same community on
   * the same shared piece store. Integrity-on-serve verifies the piece hash against
   * the stored manifest (mirrors seeder-node), so a corrupted byte string is never
   * handed out. Null = 404.
   */
  async servePublicationPiece(publicationId: string, infoHash: string, index: number): Promise<Uint8Array | null> {
    const record = await this.resolvePublication(publicationId);
    if (!record) return null;
    if (infoHash !== record.signed.descriptor.contentId) return null; // NC-2 scope close
    const manifest = this.contentManifest(record);
    if (!manifest || index < 0 || index >= manifest.pieces.length) return null;
    const bytes = await this.store.get(infoHash, index);
    if (!bytes || !verifyCatalogPiece(manifest, index, bytes)) return null;
    return bytes;
  }

  /**
   * OPEN paged read (§5.6): up to `limit` signed events in ascending HLC order
   * STRICTLY AFTER the `(wall, counter)` cursor, plus `nextCursor` (the HLC of the
   * last returned event, or the requested cursor when empty) and `hasMore`. `after`
   * null = from genesis. `limit` is clamped to [1, 200]. Read-only + stateless per
   * request (the cursor lives on the client). Null = 404 (unknown/unpublished/killed
   * publication, wrong channel scope, or a fail-closed parse).
   */
  async getPublicationPage(
    publicationId: string,
    channelId: string,
    after: PublicationPageCursor | null,
    limit: number,
  ): Promise<PublicationPagePayload | null> {
    const record = await this.resolvePublication(publicationId);
    if (!record) return null;
    const events = await this.parsePublicEvents(publicationId, record, channelId);
    // Node-accepted public posts for THIS channel, minus honored tombstones
    // (removed posts drop from pages; the tombstone ledger also blocks
    // resurrection at submit). Ordered by the receipt's node-assigned HLC.
    const tombstoned = new Set((await this.publicPostStore.listTombstones(publicationId)).map((t) => t.postId));
    const channelPosts = (await this.publicPostStore.listPosts(publicationId))
      .filter((p) => p.post.channelId === channelId && !tombstoned.has(p.post.postId));
    // A channel with neither a parsable snapshot NOR accepted posts keeps the
    // pre-P6 behavior (scope fail -> 404). A channel that only has accepted posts
    // (e.g. an open publication channel with no owner snapshot yet) is readable.
    if (!events && channelPosts.length === 0) return null;
    const snapshotEvents = events ?? [];
    const afterEvents = after ? snapshotEvents.filter((e) => hlcAfter(e.hlc, after)) : snapshotEvents;
    const afterPosts = after ? channelPosts.filter((p) => hlcAfter(p.receipt.hlc, after)) : channelPosts;
    // One combined ascending-HLC window: both streams share the cursor, so a
    // reader paginates once and sees posts interleaved with snapshot events.
    type PageItem =
      | { hlc: Hlc; kind: 'event'; event: ChannelMessageEvent }
      | { hlc: Hlc; kind: 'post'; post: AcceptedPublicPost };
    const combined: PageItem[] = [
      ...afterEvents.map((event): PageItem => ({ hlc: event.hlc, kind: 'event', event })),
      ...afterPosts.map((post): PageItem => ({ hlc: post.receipt.hlc, kind: 'post', post })),
    ].sort((a, b) => {
      if (a.hlc.wall !== b.hlc.wall) return a.hlc.wall < b.hlc.wall ? -1 : 1;
      if (a.hlc.counter !== b.hlc.counter) return a.hlc.counter - b.hlc.counter;
      // Deterministic tiebreak so pagination is stable across requests.
      return a.kind === b.kind ? 0 : (a.kind === 'event' ? -1 : 1);
    });
    const clamped = Math.min(Math.max(1, Math.floor(limit)), 200);
    const page = combined.slice(0, clamped);
    // Never split a TIED-HLC group across the page boundary: the cursor carries
    // only {wall,counter} and the next request filters with strict hlcAfter, so
    // items tied with the last returned HLC would be skipped forever. Extend the
    // page through the tie (overshoot bounded to one extra clamp width; a group
    // tied deeper than that is an owner corrupting their own publication).
    let extended = 0;
    while (
      page.length > 0
      && combined.length > page.length
      && extended < 200
    ) {
      const next = combined[page.length]!;
      const last = page[page.length - 1]!;
      if (next.hlc.wall !== last.hlc.wall || next.hlc.counter !== last.hlc.counter) break;
      page.push(next);
      extended += 1;
    }
    const hasMore = combined.length > page.length;
    const last = page[page.length - 1];
    const nextCursor = last
      ? `${last.hlc.wall}.${last.hlc.counter}`
      : (after ? `${after.wall}.${after.counter}` : null);
    return {
      events: page.filter((i) => i.kind === 'event').map((i) => i.event),
      publicPosts: page.filter((i) => i.kind === 'post').map((i) => i.post),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Node-side half of the public submit route (Plan 39 P6, gates 4-5 + accept):
   * the HTTP layer has ALREADY verified session + humanity + app-unlock (gates
   * 1-3, NC-P3); this method enforces, in order and fail-closed:
   *  1. the publication is served (active, not killed) and the channel is in scope;
   *  2. the post's author signature + content-derived id verify, and the author
   *     persona equals the SESSION persona (no posting as someone else);
   *  3. the node holds the receipt key AND the descriptor pins exactly that key
   *     (a receipt readers would reject is never minted -- no fabricated status);
   *  4. the posting freeze (one-action kill switch) is honored;
   *  5. the descriptor's EFFECTIVE postPolicy admits the author: view_only rejects
   *     everything, approval requires membership in the node-held community
   *     descriptor (no descriptor -> fail closed), open admits verified strangers;
   *  6. a tombstoned postId can never resurrect; a byte-identical replay is
   *     idempotent (returns the stored receipt, never a duplicate row);
   *  7. durable per-persona flood caps + the per-publication storage ceiling.
   * Only then does the node countersign (node-assigned monotonic HLC) and append
   * to the served page stream.
   */
  async submitPublicPost(
    publicationId: string,
    channelId: string,
    post: PublicPostEvent,
    sessionPersonaPubkey: string,
  ): Promise<PublicPostSubmitVerdict> {
    // Serialized per publication: the dedup/flood/append sequence below awaits
    // between its read and its write, so unserialized concurrent submits could
    // double-append one postId or overshoot the flood ceiling.
    return this.withPublicPostLock(publicationId, () =>
      this.submitPublicPostLocked(publicationId, channelId, post, sessionPersonaPubkey));
  }

  private async submitPublicPostLocked(
    publicationId: string,
    channelId: string,
    post: PublicPostEvent,
    sessionPersonaPubkey: string,
  ): Promise<PublicPostSubmitVerdict> {
    const record = await this.resolvePublication(publicationId);
    if (!record) return { ok: false, status: 404, reason: 'unknown_publication' };
    const d = record.signed.descriptor;

    if (post?.publicationId !== publicationId || post?.channelId !== channelId) {
      return { ok: false, status: 400, reason: 'scope_mismatch' };
    }
    if (d.channelId !== null && d.channelId !== channelId) {
      return { ok: false, status: 400, reason: 'channel_out_of_scope' };
    }
    if (!verifyPublicPostAuthor(post)) {
      return { ok: false, status: 400, reason: 'bad_post' };
    }
    // The session persona must BE the post author: an attacker with a valid
    // session cannot submit a post signed by someone else's persona (and vice
    // versa). Fail-closed on a missing binding.
    if (
      typeof sessionPersonaPubkey !== 'string'
      || sessionPersonaPubkey.length === 0
      || sessionPersonaPubkey.toLowerCase() !== post.personaPubkey.toLowerCase()
    ) {
      return { ok: false, status: 401, reason: 'persona_mismatch' };
    }
    if (await this.publicPostStore.isPersonaBlocked(post.personaPubkey)) {
      return { ok: false, status: 403, reason: 'persona_deleted' };
    }

    if (!this.postReceipt) {
      return { ok: false, status: 500, reason: 'receipts_not_configured' };
    }
    // Readers verify receipts ONLY against descriptor.postNodeKeyHex. If the owner
    // pinned no key, or pinned a different node, any receipt this node mints would
    // be dropped fail-closed by every reader -- so refuse instead of fabricating an
    // acceptance the network will not honor (NC-P4 honesty).
    if (
      typeof d.postNodeKeyHex !== 'string'
      || d.postNodeKeyHex.toLowerCase() !== this.postReceipt.publicKeyHex.toLowerCase()
    ) {
      return { ok: false, status: 409, reason: 'node_key_not_pinned' };
    }

    // One-action kill switch: an owner/operator-signed freeze flips the
    // publication to effective view_only immediately, descriptor unchanged.
    const freeze = await this.publicPostStore.getFreeze(publicationId);
    if (freeze && verifyPublicPostingFreeze(freeze, this.freezeSigners(d.ownerDeviceId)) && freeze.frozen) {
      return { ok: false, status: 403, reason: 'posting_frozen' };
    }

    const policy = effectivePostPolicy(d);
    if (policy === 'view_only') {
      return { ok: false, status: 403, reason: 'posting_disabled' };
    }
    if (policy === 'approval') {
      // Membership is judged against the node-held, owner-signed community
      // descriptor roster: for PUBLIC approval-mode posting the owner approves a
      // PERSONA by adding its public key as a roster member (rosters key members
      // by pubkey; a persona key is a valid member key). Device-key members post
      // through the private epoch path as before -- this route never sees them.
      // No descriptor on this node -> membership cannot be proven -> fail closed.
      const community = await this.privateStateStore.getState(d.communityId);
      if (!community) return { ok: false, status: 403, reason: 'membership_unknown' };
      if (!communityRole(community.descriptor.descriptor, post.personaPubkey)) {
        return { ok: false, status: 403, reason: 'not_member' };
      }
    }

    // Tombstone resurrection guard: a removed postId is dead forever.
    const tombstones = await this.publicPostStore.listTombstones(publicationId);
    if (tombstones.some((t) => t.postId === post.postId)) {
      return { ok: false, status: 409, reason: 'tombstoned' };
    }

    const posts = [...await this.publicPostStore.listPosts(publicationId)];
    // Replay dedup: the postId is content-derived, so a byte-identical resubmit
    // maps to the stored unit. Idempotent: return the ORIGINAL receipt (a client
    // that lost the response can recover it) without a second append.
    const existing = posts.find((p) => p.post.postId === post.postId);
    if (existing) {
      return { ok: true, accepted: existing, deduplicated: true };
    }
    if (posts.length >= this.publicPostLimits.maxPostsPerPublication) {
      return { ok: false, status: 429, reason: 'publication_full' };
    }

    // CSAM / abuse hash-scan at the SUBMIT boundary (Plan 39 P13), BEFORE countersign +
    // append and before the flood budget is spent. Text-only posts never touch the scanner.
    // FAIL-CLOSED for media: no scanner configured, or a scanner outage, refuses the post
    // (503 scanner_unavailable); a known-bad hash match refuses (451) and files NCMEC evidence.
    const attachments = post.attachments ?? [];
    if (attachments.length > 0) {
      if (!this.abuseScanner) {
        return { ok: false, status: 503, reason: 'scanner_unavailable' };
      }
      const blobHashes = attachments.map((a) => a.blobHash);
      let matched: readonly string[];
      try {
        ({ matched } = await this.abuseScanner.scan(blobHashes));
      } catch {
        return { ok: false, status: 503, reason: 'scanner_unavailable' };
      }
      if (matched.length > 0) {
        // Refuse regardless of the evidence-enqueue outcome (the content is never accepted).
        // The NCMEC queue write is durable on its own; a hook failure must not accept the post.
        if (this.onAbuseHashMatch) {
          try {
            await this.onAbuseHashMatch({
              publicationId,
              channelId,
              postId: post.postId,
              personaPubkey: post.personaPubkey,
              matchedBlobHashes: [...matched],
            });
          } catch {
            // Evidence enqueue failure is logged by the hook's own store; the post stays refused.
          }
        }
        return { ok: false, status: 451, reason: 'blob_rejected' };
      }
    }

    // Durable per-persona flood cap (per publication): prune to the window, then
    // admit only under the ceiling. Persisted so a restart cannot reset a flood.
    const personaKey = post.personaPubkey.toLowerCase();
    const t = this.now();
    const cutoff = t - this.publicPostLimits.windowMs;
    const submits = (await this.publicPostStore.listSubmits(publicationId, personaKey)).filter((ts) => ts > cutoff);
    if (submits.length >= this.publicPostLimits.postsPerPersonaPerWindow) {
      await this.publicPostStore.putSubmits(publicationId, personaKey, submits);
      return { ok: false, status: 429, reason: 'rate_limited' };
    }
    submits.push(t);
    await this.publicPostStore.putSubmits(publicationId, personaKey, submits);

    // Node-assigned monotonic HLC over EVERYTHING already served on this
    // channel's page: prior accepted posts AND the snapshot events (a snapshot
    // event HLC ahead of the node clock would otherwise leave a new receipt
    // BEHIND a reader's page cursor, hiding the post forever behind the strict
    // hlcAfter filter). nextHlc then guarantees strictly-forward ordering even
    // under clock skew.
    let lastHlc: Hlc | null = null;
    for (const p of posts) {
      if (p.post.channelId !== channelId) continue;
      if (!lastHlc || hlcAfter(p.receipt.hlc, lastHlc)) lastHlc = p.receipt.hlc;
    }
    const snapshotEvents = await this.parsePublicEvents(publicationId, record, channelId);
    const maxSnapshotEvent = snapshotEvents?.[snapshotEvents.length - 1] ?? null; // HLC-sorted ascending
    if (maxSnapshotEvent && (!lastHlc || hlcAfter(maxSnapshotEvent.hlc, lastHlc))) {
      lastHlc = maxSnapshotEvent.hlc;
    }
    const nowIso = new Date(t).toISOString();
    const receipt = signPublicPostAcceptance(this.postReceipt, {
      post,
      hlc: nextHlc(lastHlc, nowIso),
      acceptedAt: nowIso,
    });
    const accepted: AcceptedPublicPost = { post, receipt };
    posts.push(accepted);
    await this.publicPostStore.putPosts(publicationId, posts);
    return { ok: true, accepted, deduplicated: false };
  }

  /** Serialize one publication's public-post writes (see publicPostLocks). */
  private async withPublicPostLock<T>(publicationId: string, fn: () => Promise<T>): Promise<T> {
    const prior = this.publicPostLocks.get(publicationId) ?? Promise.resolve();
    const run = prior.then(
      () => this.publicPostStore.withPublicationWriteLock(publicationId, fn),
      () => this.publicPostStore.withPublicationWriteLock(publicationId, fn),
    );
    const tail = run.then(() => undefined, () => undefined);
    this.publicPostLocks.set(publicationId, tail);
    void tail.then(() => {
      if (this.publicPostLocks.get(publicationId) === tail) this.publicPostLocks.delete(publicationId);
    });
    return run;
  }

  /**
   * Persistently reject new writes from a persona before GDPR enumeration.
   * Session revocation stops new requests at HTTP auth; this marker also closes
   * the race for a request that passed auth immediately before revocation.
   */
  async blockPersonaPublicPosting(personaPubkey: string): Promise<void> {
    await this.publicPostStore.blockPersona(personaPubkey);
  }

  /**
   * GDPR write barrier. The durable persona block is written first by the
   * coordinator. Acquiring every publication lock in deterministic order then
   * waits for submissions that passed the earlier block check to finish. Once
   * this returns, no old writer remains and no new writer can pass the block.
   */
  async drainPersonaPublicWrites(_personaPubkey: string): Promise<void> {
    const publicationIds = (await this.publicationStore.list())
      .map((record) => record.signed.descriptor.publicationId)
      .sort((a, b) => a.localeCompare(b));
    const acquire = async (index: number): Promise<void> => {
      const publicationId = publicationIds[index];
      if (!publicationId) return;
      await this.withPublicPostLock(publicationId, () => acquire(index + 1));
    };
    await acquire(0);
  }

  /** The keys allowed to sign a posting freeze: the publication owner and (when
   *  configured) the node's trusted Trust & Safety authority. */
  private freezeSigners(ownerDeviceId: string): string[] {
    const signers = [ownerDeviceId];
    if (this.trustedKillAuthorityDeviceId) signers.push(this.trustedKillAuthorityDeviceId);
    return signers;
  }

  /**
   * Honor a signed public-post tombstone (Plan 39 P6): the publication OWNER, the
   * NODE receipt key, or the post's AUTHOR persona may remove a post; anyone else
   * is rejected fail-closed (a stranger can never censor). The tombstone persists
   * durably (no resurrection across restarts) and the post drops from pages at
   * once. Works on any stored publication (including unpublished: removal must
   * not require the content to still be served).
   */
  async recordPublicPostTombstone(
    publicationId: string,
    tombstone: PublicPostTombstone,
  ): Promise<PublicPostModerationVerdict> {
    return this.withPublicPostLock(publicationId, () =>
      this.recordPublicPostTombstoneLocked(publicationId, tombstone));
  }

  private async recordPublicPostTombstoneLocked(
    publicationId: string,
    tombstone: PublicPostTombstone,
  ): Promise<PublicPostModerationVerdict> {
    const record = await this.publicationStore.get(publicationId);
    if (!record) return { ok: false, status: 404, reason: 'unknown_publication' };
    // Read the kill authority live even for suppressive cleanup. A tombstone is
    // still allowed after a kill because it can only remove additional content.
    await this.killStore.isKilled(record.signed.descriptor.communityId);
    if (tombstone?.publicationId !== publicationId) {
      return { ok: false, status: 400, reason: 'id_mismatch' };
    }
    const posts = await this.publicPostStore.listPosts(publicationId);
    const target = posts.find((p) => p.post.postId === tombstone.postId);
    const allowed = [record.signed.descriptor.ownerDeviceId];
    if (this.postReceipt) allowed.push(this.postReceipt.publicKeyHex);
    if (this.trustedKillAuthorityDeviceId) allowed.push(this.trustedKillAuthorityDeviceId);
    // The author persona may remove their OWN post -- provable only when the post
    // is stored here (otherwise an author claim is unverifiable: fail closed).
    if (target) allowed.push(target.post.personaPubkey);
    if (!verifyPublicPostTombstone(tombstone, allowed)) {
      return { ok: false, status: 401, reason: 'not_authorized' };
    }
    const tombstones = await this.publicPostStore.listTombstones(publicationId);
    if (!tombstones.some((t) => t.postId === tombstone.postId)) {
      await this.publicPostStore.putTombstones(publicationId, [...tombstones, tombstone]);
    }
    if (target) {
      await this.publicPostStore.putPosts(publicationId, posts.filter((p) => p.post.postId !== tombstone.postId));
    }
    return { ok: true };
  }

  /**
   * GDPR support (Plan 39 P13 / AC-5): enumerate every stored public post authored by a persona
   * across all publications on this node. The deletion coordinator signs an operator tombstone
   * for each and drives them through recordPublicPostTombstone (the node never holds the operator
   * key). Returns `(publicationId, channelId, postId)` refs only.
   */
  async listPublicPostsByPersona(personaPubkey: string): Promise<Array<{ publicationId: string; channelId: string; postId: string }>> {
    const key = personaPubkey.toLowerCase();
    const refs: Array<{ publicationId: string; channelId: string; postId: string }> = [];
    for (const publication of await this.publicationStore.list()) {
      const publicationId = publication.signed.descriptor.publicationId;
      const posts = await this.publicPostStore.listPosts(publicationId);
      for (const p of posts) {
        if (p.post.personaPubkey.toLowerCase() === key) {
          refs.push({ publicationId, channelId: p.post.channelId, postId: p.post.postId });
        }
      }
    }
    return refs;
  }

  /** Full GDPR export of the accepted public-post records held by this node. */
  async exportPublicPostsByPersona(personaPubkey: string): Promise<AcceptedPublicPost[]> {
    const key = personaPubkey.toLowerCase();
    const exported: AcceptedPublicPost[] = [];
    for (const publication of await this.publicationStore.list()) {
      const publicationId = publication.signed.descriptor.publicationId;
      const posts = await this.publicPostStore.listPosts(publicationId);
      exported.push(...posts.filter((accepted) => accepted.post.personaPubkey.toLowerCase() === key));
    }
    return exported;
  }

  /**
   * GDPR support (Plan 39 P13 / AC-5): purge a persona's durable flood-cap counters in every
   * publication. Called after the persona's posts are tombstoned so no per-persona submit-window
   * rows keyed to a deleted account remain. Idempotent.
   */
  async purgePersonaFloodCounters(personaPubkey: string): Promise<{ publicationsCleared: number }> {
    const key = personaPubkey.toLowerCase();
    let cleared = 0;
    for (const publication of await this.publicationStore.list()) {
      const publicationId = publication.signed.descriptor.publicationId;
      await this.withPublicPostLock(publicationId, async () => {
        const submits = await this.publicPostStore.listSubmits(publicationId, key);
        if (submits.length > 0) {
          await this.publicPostStore.putSubmits(publicationId, key, []);
          cleared += 1;
        }
      });
    }
    return { publicationsCleared: cleared };
  }

  /**
   * Honor a signed posting freeze/unfreeze (the one-action kill switch, Plan 39
   * P6): only the publication OWNER or the configured Trust & Safety authority
   * may flip it. Monotonic by frozenAt so a replayed OLDER unfreeze cannot undo a
   * newer freeze. Effective immediately on every subsequent submit.
   */
  async recordPostingFreeze(
    publicationId: string,
    freeze: PublicPostingFreeze,
  ): Promise<PublicPostModerationVerdict> {
    return this.withPublicPostLock(publicationId, () =>
      this.recordPostingFreezeLocked(publicationId, freeze));
  }

  private async recordPostingFreezeLocked(
    publicationId: string,
    freeze: PublicPostingFreeze,
  ): Promise<PublicPostModerationVerdict> {
    const record = await this.publicationStore.get(publicationId);
    if (!record) return { ok: false, status: 404, reason: 'unknown_publication' };
    const communityKilled = await this.killStore.isKilled(record.signed.descriptor.communityId);
    if (communityKilled && freeze?.frozen === false) {
      return { ok: false, status: 409, reason: 'community_killed' };
    }
    if (freeze?.publicationId !== publicationId) {
      return { ok: false, status: 400, reason: 'id_mismatch' };
    }
    const allowed = this.freezeSigners(record.signed.descriptor.ownerDeviceId);
    if (!verifyPublicPostingFreeze(freeze, allowed)) {
      return { ok: false, status: 401, reason: 'not_authorized' };
    }
    const prior = await this.publicPostStore.getFreeze(publicationId);
    if (prior && verifyPublicPostingFreeze(prior, allowed)) {
      const priorAt = Date.parse(prior.frozenAt);
      const nextAt = Date.parse(freeze.frozenAt);
      if (prior.signature === freeze.signature) return { ok: true }; // idempotent
      if (!Number.isFinite(nextAt) || (Number.isFinite(priorAt) && nextAt <= priorAt)) {
        return { ok: false, status: 409, reason: 'stale_freeze' };
      }
    }
    await this.publicPostStore.putFreeze(publicationId, freeze);
    return { ok: true };
  }

  /**
   * Parse the publication's contentId snapshot to HLC-sorted signed events, cached per
   * (publicationId, channelId) INCLUDING the negative (scope-fail) result. Without the
   * negative cache, an untrusted client alternating channelId would force a full
   * importPublicSnapshot (verify every piece hash + author signature) on every request
   * -- CPU amplification. The whole publication entry is dropped on re-register.
   */
  private async parsePublicEvents(
    publicationId: string,
    record: StoredPublication,
    channelId: string,
  ): Promise<ChannelMessageEvent[] | null> {
    const byChannel = this.publicEventsCache.get(publicationId);
    if (byChannel?.has(channelId)) return byChannel.get(channelId) ?? null;

    const d = record.signed.descriptor;
    let result: ChannelMessageEvent[] | null = null;
    const manifest = this.contentManifest(record);
    if (manifest) {
      // The published key is non-secret (carried in the clear in the descriptor); the
      // node derives the seal key from it to parse the PUBLIC snapshot. importPublicSnapshot
      // verifies every piece hash, the snapshot signature, the channel scope, and every
      // event author signature, fail-closed -- binding contentId + ownerDeviceId so a
      // substituted self-signed snapshot is rejected. The wrong channelId fails scope -> null.
      const imported = await importPublicSnapshot({
        publicationId,
        communityId: d.communityId,
        channelId,
        manifest,
        pieceStore: this.store,
        publicKey: Buffer.from(d.publicKeyHex, 'hex'),
        expectedContentId: d.contentId,
        expectedAuthor: d.ownerDeviceId,
      });
      if (imported.ok) {
        result = [...imported.events].sort((a, b) => {
          if (a.hlc.wall !== b.hlc.wall) return a.hlc.wall < b.hlc.wall ? -1 : 1;
          return a.hlc.counter - b.hlc.counter;
        });
      }
    }
    const map = byChannel ?? new Map<string, ChannelMessageEvent[] | null>();
    map.set(channelId, result);
    this.publicEventsCache.set(publicationId, map);
    return result;
  }

  /** The ContentManifest for the publication's contentId snapshot (parsed + cached once). */
  private contentManifest(record: StoredPublication): ContentManifest | null {
    const d = record.signed.descriptor;
    const cached = this.contentManifestCache.get(d.publicationId);
    if (cached && cached.contentId === d.contentId) return cached.manifest;
    for (const snap of record.snapshots) {
      const manifest = JSON.parse(snap.manifestJson) as ContentManifest;
      if (manifest.infoHash === d.contentId) {
        this.contentManifestCache.set(d.publicationId, { contentId: d.contentId, manifest });
        return manifest;
      }
    }
    return null;
  }

  /**
   * Announce this community to the host registry so browsers discover the node's
   * URL without it being hardcoded. Keyed off the community id (the rid is
   * HKDF-derived; the relay stores opaque bytes). Ship the helper; the cron that
   * calls it on an interval is deferred ops.
   */
  async announce(input: { relayUrl: string; communityId: string; publicBaseUrl: string; ttlMs?: number }): Promise<void> {
    await announceHeldContent({
      url: input.relayUrl,
      contentId: input.communityId,
      hostUrl: input.publicBaseUrl,
      ttlMs: input.ttlMs,
    });
  }
}
