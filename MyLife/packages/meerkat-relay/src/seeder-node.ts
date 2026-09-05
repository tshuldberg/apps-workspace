/**
 * Meerkat Node v0 -- headless desktop seeder (plan 14, MK-031).
 *
 * The always-on half of a community: a Mac mini / NAS / rented box that pins a
 * community catalog and serves its pieces so members fetch even when every
 * other member's phone is closed. This is the composition layer over pieces
 * already shipped:
 *  - SeedingEngine (@mylife/sync) -- storage caps, schedules, upload/peer
 *    accounting, auto-delete-unless-pinned (MK-035-adjacent uptime stats).
 *  - community-catalog (@mylife/sync) -- signed Merkle manifest, per-piece
 *    bytes, and per-piece hash verification (hosts untrusted-but-verifiable).
 *
 * The node is content-AGNOSTIC: it stores and serves opaque, hash-addressed
 * pieces and learns nothing about plaintext (the catalog content is encrypted
 * at the community layer). That is the zero-knowledge property MK-041 Hosted
 * Nodes will lean on. Transport is the web-seed convention (GET
 * /{infoHash}/{index}), so the existing fetchCatalogFromWebSeed client consumes
 * it unchanged; the HTTP binding lives in seeder-http.ts, the CLI in
 * bin/meerkat-node.mjs. This file is pure logic + an injectable piece store, so
 * the whole node is unit-testable without binding a socket.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  SeedingEngine,
  announceHeldContent,
  catalogPieceBytes,
  verifyCatalogPiece,
  type CommunityCatalog,
  type ContentManifest,
  type NodeStore,
  type SeedingPolicy,
} from '@mylife/sync';

/** Where a node keeps the pieces it has pinned. Injectable for tests. */
export interface SeederPieceStore {
  put(infoHash: string, index: number, bytes: Uint8Array): Promise<void> | void;
  get(infoHash: string, index: number): Promise<Uint8Array | null> | Uint8Array | null;
  /** Remove every piece for a content id. */
  removeContent(infoHash: string): Promise<void> | void;
  /** Total bytes currently stored across all content. */
  sizeBytes(): Promise<number> | number;
}

/** In-memory piece store (tests, ephemeral nodes). */
export class InMemorySeederPieceStore implements SeederPieceStore {
  private readonly pieces = new Map<string, Uint8Array>();
  private key(infoHash: string, index: number): string {
    return `${infoHash}:${index}`;
  }
  put(infoHash: string, index: number, bytes: Uint8Array): void {
    this.pieces.set(this.key(infoHash, index), bytes);
  }
  get(infoHash: string, index: number): Uint8Array | null {
    return this.pieces.get(this.key(infoHash, index)) ?? null;
  }
  removeContent(infoHash: string): void {
    for (const k of [...this.pieces.keys()]) {
      if (k.startsWith(`${infoHash}:`)) this.pieces.delete(k);
    }
  }
  sizeBytes(): number {
    let total = 0;
    for (const bytes of this.pieces.values()) total += bytes.length;
    return total;
  }
}

/** Filesystem piece store: {baseDir}/{infoHash}/{index}. */
export class FileSeederPieceStore implements SeederPieceStore {
  constructor(private readonly baseDir: string) {}
  private dir(infoHash: string): string {
    return path.join(this.baseDir, infoHash);
  }
  async put(infoHash: string, index: number, bytes: Uint8Array): Promise<void> {
    await fs.mkdir(this.dir(infoHash), { recursive: true });
    await fs.writeFile(path.join(this.dir(infoHash), String(index)), bytes);
  }
  async get(infoHash: string, index: number): Promise<Uint8Array | null> {
    try {
      const buf = await fs.readFile(path.join(this.dir(infoHash), String(index)));
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return null;
    }
  }
  async removeContent(infoHash: string): Promise<void> {
    await fs.rm(this.dir(infoHash), { recursive: true, force: true });
  }
  async sizeBytes(): Promise<number> {
    let total = 0;
    let entries: string[];
    try {
      entries = await fs.readdir(this.baseDir);
    } catch {
      return 0;
    }
    for (const infoHash of entries) {
      let files: string[];
      try {
        files = await fs.readdir(this.dir(infoHash));
      } catch {
        continue;
      }
      for (const file of files) {
        try {
          total += (await fs.stat(path.join(this.dir(infoHash), file))).size;
        } catch {
          // a piece removed mid-scan; skip
        }
      }
    }
    return total;
  }
}

export interface MeerkatSeederNodeOptions {
  policy: SeedingPolicy;
  pieceStore: SeederPieceStore;
  /** Injectable clock (ms). Defaults to Date.now via Date in the binary. */
  now?: () => number;
}

export type PinResult =
  | { ok: true; infoHash: string; pieces: number }
  | { ok: false; reason: 'disabled' | 'storage_cap' | 'invalid_catalog' };

export interface SeederNodeStats {
  startedAt: string;
  uptimeMs: number;
  pinnedContent: number;
  activeContent: number;
  storageBytes: number;
  storageCapBytes: number;
  bytesServed: number;
  peersServed: number;
}

/** Per-request network conditions; a 24/7 node is wired + charging by default. */
const DEFAULT_CONDITIONS = { isWifi: true, isCellular: false, isCharging: true };

/**
 * Honest share-link host-discovery announce side (Task 1). Only a node with a
 * GENUINELY reachable web-seed base url should announce: it tells the relay "I
 * serve this contentId at <publicBaseUrl>" so an app holding the link can
 * discover the host with no pasted url. A phone has no inbound HTTP and must NOT
 * call this; that is why the standalone app stays resolve-only and the announce
 * side is exercised only by a reachable seeder (and the e2e test).
 *
 * Shape contract (the fix to readiness #3): the resolver opens a discovered host
 * with `httpNodeSource`, which fetches the NodeStore web-seed shape -- GET
 * /manifest/{contentId} and GET /block/{sealedId} (handleNodeStoreHttp). So the
 * announce side must do TWO things consistently or it is dishonest:
 *   1. `publicBaseUrl` must serve that exact NodeStore shape (a host backed by
 *      handleNodeStoreHttp over a NodeStore), NOT the catalog web-seed shape
 *      (GET /{infoHash}/{index}) that MeerkatSeederNode + startSeederHttp serve.
 *   2. it must announce NodeStore contentIds that are actually present in that
 *      store, NOT catalog infoHashes.
 * To make (2) unforgeable, the helper takes the NodeStore itself and enumerates
 * its manifests, so it can only ever announce contentIds the host genuinely
 * holds. (MeerkatSeederNode serves catalog pieces, a different transport, and
 * its pinnedInfoHashes are catalog infoHashes -- they must not be announced.)
 *
 * The relay never learns the contentId (the rid is HKDF-derived) and the record
 * is sealed under a key only share-link holders can derive (announceHeldContent),
 * so the relay stores opaque bytes. Re-announcing on the loop's interval
 * refreshes each slot's TTL with a fresh nonce.
 */
export interface SeederAnnounceConfig {
  /** The discovery relay's ws(s) url. */
  relayUrl: string;
  /**
   * This node's PUBLICLY REACHABLE web-seed base url (NAT/TLS resolved). It MUST
   * serve the NodeStore web-seed shape (GET /manifest/{contentId}, /block/{id})
   * via handleNodeStoreHttp over the SAME store passed to announceHeldShareContent.
   */
  publicBaseUrl: string;
  /** Requested TTL per announce; the relay clamps it to its own maximum. */
  ttlMs?: number;
}

export interface AnnounceHeldContentResult {
  contentId: string;
  ok: boolean;
  error?: string;
}

/**
 * Announce every contentId a NodeStore-backed web-seed genuinely serves to a
 * discovery relay. The contentIds are read from `store.listManifests()`, so the
 * helper can only advertise content the host actually holds -- it cannot announce
 * a catalog infoHash or a stale id by accident. `publicBaseUrl` must be the base
 * url of an HTTP server mounting handleNodeStoreHttp over this same `store`.
 *
 * Each announce is independent: one failure never aborts the rest, so a flaky
 * relay degrades to fewer live host records rather than crashing the loop.
 * Returns a per-contentId result for logging. Ship the helper + config; the
 * production cron that calls it on an interval is ops (see bin/meerkat-node.mjs).
 */
export async function announceHeldShareContent(
  config: SeederAnnounceConfig,
  store: NodeStore,
): Promise<AnnounceHeldContentResult[]> {
  const results: AnnounceHeldContentResult[] = [];
  const manifests = await store.listManifests();
  for (const manifest of manifests) {
    const contentId = manifest.contentId;
    try {
      await announceHeldContent({
        url: config.relayUrl,
        contentId,
        hostUrl: config.publicBaseUrl,
        ttlMs: config.ttlMs,
      });
      results.push({ contentId, ok: true });
    } catch (error) {
      results.push({ contentId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export class MeerkatSeederNode {
  private readonly engine: SeedingEngine;
  private readonly store: SeederPieceStore;
  private readonly now: () => number;
  private readonly startedAtMs: number;
  /** infoHash -> the manifest we verify served pieces against. */
  private readonly manifests = new Map<string, ContentManifest>();
  private peersServed = 0;

  constructor(options: MeerkatSeederNodeOptions) {
    this.engine = new SeedingEngine(options.policy);
    this.store = options.pieceStore;
    this.now = options.now ?? (() => Date.now());
    this.startedAtMs = this.now();
  }

  /**
   * Pin a community catalog: store every piece and register it for seeding.
   * Refused (without storing) when seeding is disabled or the storage cap
   * would be exceeded -- the cap is respected before any bytes are written.
   */
  async pin(
    catalog: CommunityCatalog,
    options: { pinForever?: boolean; title?: string } = {},
  ): Promise<PinResult> {
    const { manifest } = catalog;
    if (!manifest?.infoHash || manifest.pieces.length === 0) {
      return { ok: false, reason: 'invalid_catalog' };
    }
    const policy = this.engine.getPolicy();
    if (!policy.enabled) return { ok: false, reason: 'disabled' };

    const sizeMB = manifest.totalSize / (1024 * 1024);
    const currentMB = (await this.store.sizeBytes()) / (1024 * 1024);
    if (currentMB + sizeMB > policy.maxSeedStorageMB) {
      return { ok: false, reason: 'storage_cap' };
    }

    for (let i = 0; i < manifest.pieces.length; i++) {
      await this.store.put(manifest.infoHash, i, catalogPieceBytes(catalog, i));
    }
    this.manifests.set(manifest.infoHash, manifest);
    this.engine.startSeeding({
      infoHash: manifest.infoHash,
      title: options.title ?? manifest.title,
      totalSize: manifest.totalSize,
      isPinned: options.pinForever ?? true,
      autoDeleteAt: options.pinForever
        ? null
        : new Date(this.now() + policy.autoDeleteDays * 86_400_000).toISOString(),
      createdAt: new Date(this.now()).toISOString(),
    });
    // SeedingEngine refuses to register past the cap; if it did, undo the write.
    if (!this.engine.getEntry(manifest.infoHash)) {
      await this.store.removeContent(manifest.infoHash);
      this.manifests.delete(manifest.infoHash);
      return { ok: false, reason: 'storage_cap' };
    }
    return { ok: true, infoHash: manifest.infoHash, pieces: manifest.pieces.length };
  }

  async unpin(infoHash: string): Promise<void> {
    this.engine.removeSeed(infoHash);
    this.manifests.delete(infoHash);
    await this.store.removeContent(infoHash);
  }

  /** Content ids this node currently holds (pinned or seeding). */
  pinnedInfoHashes(): string[] {
    return [...this.manifests.keys()];
  }

  /**
   * Serve one verified piece to a requesting member, recording the upload.
   * Returns null when the node should not (policy) or cannot (not held /
   * hash mismatch) serve it -- a corrupted local piece is never handed out.
   */
  async servePiece(
    infoHash: string,
    index: number,
    conditions: { isWifi: boolean; isCellular: boolean; isCharging: boolean } = DEFAULT_CONDITIONS,
  ): Promise<Uint8Array | null> {
    if (!this.engine.shouldServe(conditions)) return null;
    const entry = this.engine.getEntry(infoHash);
    const manifest = this.manifests.get(infoHash);
    if (!entry || !entry.isActive || !manifest) return null;
    if (index < 0 || index >= manifest.pieces.length) return null;

    const bytes = await this.store.get(infoHash, index);
    if (!bytes || !verifyCatalogPiece(manifest, index, bytes)) return null;

    this.engine.recordUpload(infoHash, bytes.length);
    this.peersServed += 1;
    return bytes;
  }

  /**
   * Drop catalogs past their auto-delete window (pinned content is kept).
   * Driven by the node's own clock so schedules are deterministic in tests --
   * SeedingEngine.pruneExpired uses the wall clock, which we deliberately avoid.
   */
  async sweep(): Promise<string[]> {
    const t = this.now();
    const pruned = this.engine.getEntries()
      .filter((e) => !e.isPinned && e.autoDeleteAt !== null && new Date(e.autoDeleteAt).getTime() <= t)
      .map((e) => e.infoHash);
    for (const infoHash of pruned) {
      this.engine.removeSeed(infoHash);
      this.manifests.delete(infoHash);
      await this.store.removeContent(infoHash);
    }
    return pruned;
  }

  async stats(): Promise<SeederNodeStats> {
    const entries = this.engine.getEntries();
    return {
      startedAt: new Date(this.startedAtMs).toISOString(),
      uptimeMs: this.now() - this.startedAtMs,
      pinnedContent: entries.filter((e) => e.isPinned).length,
      activeContent: this.engine.getActiveEntries().length,
      storageBytes: await this.store.sizeBytes(),
      storageCapBytes: this.engine.getPolicy().maxSeedStorageMB * 1024 * 1024,
      bytesServed: this.engine.getTotalUploaded(),
      peersServed: this.peersServed,
    };
  }
}
