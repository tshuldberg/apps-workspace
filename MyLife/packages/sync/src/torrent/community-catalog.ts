/**
 * Community catalog + seeding protocol (plan 14, MK-032).
 *
 * A community's published content is one Merkle MANIFEST (manifest.ts) whose
 * infoHash is the descriptor's catalogCid. Hosts -- member desktops or rented
 * nodes -- each hold a SUBSET of the catalog's pieces; this module plans that
 * replica placement RAREST-FIRST (the BitTorrent insight: replicate the piece
 * with the fewest copies first), respecting each host's storage cap, so losing
 * any one host leaves every piece available somewhere. A plain HTTP web seed
 * (web-seed.ts, Range requests) covers the cold start before any host peers.
 *
 * Composition over invention: createManifest/verifyManifest provide integrity,
 * WebSeedClient provides the HTTP fallback, and the per-piece hash check makes
 * any host or web seed untrusted-but-verifiable. Node-side (desktop seeder
 * context, like the rest of torrent/); the descriptor stays the source of
 * truth for WHO may host (MK-030).
 */

import type { ContentManifest } from '../types';
import { sha256Hex } from '../encryption/sha256';
import { createManifest, type ManifestFile } from './manifest';
import { WebSeedClient } from './web-seed';

const sha256 = (data: Uint8Array): string => sha256Hex(data);

export interface BuildCommunityCatalogOptions {
  communityName: string;
  description?: string;
  entries: ManifestFile[];
  /** The community owner signs the catalog. */
  creatorPublicKey: string;
  creatorDisplayName: string;
  creatorPrivateKey: string;
  pieceLength?: number;
  webSeeds?: string[];
}

export interface CommunityCatalog {
  manifest: ContentManifest;
  /** The concatenated publish source (what hosts and web seeds serve from). */
  bytes: Uint8Array;
}

/** Build the community's catalog manifest. manifest.infoHash = catalogCid. */
export function buildCommunityCatalog(options: BuildCommunityCatalogOptions): CommunityCatalog {
  const manifest = createManifest({
    title: options.communityName,
    description: options.description ?? `Catalog for ${options.communityName}`,
    files: options.entries,
    // Catalogs are invite-scoped: reachable by link/descriptor, never directory-public.
    access: 'link',
    category: 'other',
    tags: ['community-catalog'],
    creatorPublicKey: options.creatorPublicKey,
    creatorDisplayName: options.creatorDisplayName,
    creatorPrivateKey: options.creatorPrivateKey,
    pieceLength: options.pieceLength,
    trackers: [],
    webSeeds: options.webSeeds ?? [],
  });
  const total = options.entries.reduce((n, f) => n + f.data.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const file of options.entries) {
    bytes.set(file.data, offset);
    offset += file.data.length;
  }
  return { manifest, bytes };
}

/** The byte slice for one piece of the catalog. */
export function catalogPieceBytes(catalog: CommunityCatalog, index: number): Uint8Array {
  const { pieceLength } = catalog.manifest;
  const start = index * pieceLength;
  return catalog.bytes.slice(start, Math.min(start + pieceLength, catalog.bytes.length));
}

/** Verify a fetched piece against the manifest before trusting any host. */
export function verifyCatalogPiece(manifest: ContentManifest, index: number, data: Uint8Array): boolean {
  const expected = manifest.pieces[index];
  return typeof expected === 'string' && sha256(data) === expected;
}

// ---------------------------------------------------------------------------
// Replica placement (rarest-first across hosts)
// ---------------------------------------------------------------------------

export interface CatalogHostState {
  hostId: string;
  /** Piece indices this host currently holds. */
  pieces: Set<number>;
  /** Storage cap in bytes; 0 = unlimited. */
  capacityBytes: number;
  alive: boolean;
}

export interface PlacementPlan {
  /** NEW piece indices each host should fetch (hostId -> indices). */
  assignments: Map<string, number[]>;
  /** Pieces that could not reach the target replication (capacity/hosts). */
  underReplicated: number[];
}

/**
 * Plan rarest-first replica placement: every piece should exist on
 * `replication` distinct ALIVE hosts. Pieces with the fewest current copies
 * are assigned first; among candidate hosts the least-loaded wins, and a
 * host's storage cap is never exceeded.
 */
export function planReplicaPlacement(
  manifest: ContentManifest,
  hosts: CatalogHostState[],
  replication = 2,
): PlacementPlan {
  const alive = hosts.filter((h) => h.alive);
  const target = Math.min(replication, alive.length);
  const assignments = new Map<string, number[]>(alive.map((h) => [h.hostId, []]));
  // Planned views so capacity + load account for in-plan assignments too.
  const planned = new Map<string, Set<number>>(alive.map((h) => [h.hostId, new Set(h.pieces)]));
  const underReplicated: number[] = [];

  const availability = (index: number): number =>
    alive.filter((h) => planned.get(h.hostId)!.has(index)).length;

  const order = manifest.pieces
    .map((_, index) => index)
    .sort((a, b) => availability(a) - availability(b) || a - b);

  for (const index of order) {
    let copies = availability(index);
    while (copies < target) {
      const candidates = alive
        .filter((h) => !planned.get(h.hostId)!.has(index))
        .filter((h) => h.capacityBytes === 0
          || (planned.get(h.hostId)!.size + 1) * manifest.pieceLength <= h.capacityBytes)
        .sort((a, b) =>
          planned.get(a.hostId)!.size - planned.get(b.hostId)!.size
          || a.hostId.localeCompare(b.hostId));
      const winner = candidates[0];
      if (!winner) break;
      planned.get(winner.hostId)!.add(index);
      assignments.get(winner.hostId)!.push(index);
      copies += 1;
    }
    if (copies < target) underReplicated.push(index);
  }

  return { assignments, underReplicated };
}

/** Apply a plan to host state (after the hosts actually fetched the pieces). */
export function applyPlacement(hosts: CatalogHostState[], plan: PlacementPlan): void {
  for (const host of hosts) {
    for (const index of plan.assignments.get(host.hostId) ?? []) {
      host.pieces.add(index);
    }
  }
}

export interface CatalogAvailability {
  available: boolean;
  /** Pieces no ALIVE host holds. */
  missingPieces: number[];
  /** The minimum copy count across all pieces (0 when anything is missing). */
  minReplication: number;
}

/** Is every catalog piece held by at least one alive host? */
export function catalogAvailability(
  manifest: ContentManifest,
  hosts: CatalogHostState[],
): CatalogAvailability {
  const alive = hosts.filter((h) => h.alive);
  const missingPieces: number[] = [];
  let minReplication = Number.POSITIVE_INFINITY;
  manifest.pieces.forEach((_, index) => {
    const copies = alive.filter((h) => h.pieces.has(index)).length;
    if (copies === 0) missingPieces.push(index);
    minReplication = Math.min(minReplication, copies);
  });
  if (manifest.pieces.length === 0) minReplication = 0;
  return {
    available: missingPieces.length === 0 && manifest.pieces.length > 0,
    missingPieces,
    minReplication: Number.isFinite(minReplication) ? minReplication : 0,
  };
}

// ---------------------------------------------------------------------------
// Cold start over a web seed (HTTP Range fallback)
// ---------------------------------------------------------------------------

export interface ColdStartResult {
  ok: boolean;
  bytes: Uint8Array | null;
  /** Pieces that failed to download or verify. */
  failedPieces: number[];
}

/**
 * Fetch the whole catalog from its HTTP web seeds (the cold-start path before
 * any host peer is reachable), verifying every piece against the manifest.
 */
export async function fetchCatalogFromWebSeed(
  manifest: ContentManifest,
  options: { fetchFn?: typeof fetch } = {},
): Promise<ColdStartResult> {
  const client = new WebSeedClient({ manifest, fetchFn: options.fetchFn });
  if (!client.hasWebSeeds) return { ok: false, bytes: null, failedPieces: manifest.pieces.map((_, i) => i) };

  const indices = manifest.pieces.map((_, i) => i);
  const downloaded = await client.downloadPieces(indices);

  const failedPieces: number[] = [];
  const bytes = new Uint8Array(manifest.totalSize);
  let offset = 0;
  for (const index of indices) {
    const data = downloaded.get(index);
    if (!data || !verifyCatalogPiece(manifest, index, data)) {
      failedPieces.push(index);
      offset += data?.length ?? manifest.pieceLength;
      continue;
    }
    bytes.set(data, offset);
    offset += data.length;
  }
  return { ok: failedPieces.length === 0, bytes: failedPieces.length === 0 ? bytes : null, failedPieces };
}
