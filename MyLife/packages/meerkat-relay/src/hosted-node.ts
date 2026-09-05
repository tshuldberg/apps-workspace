/**
 * Hosted Nodes service MVP -- codeable core (plan 14, MK-041; design D13).
 *
 * "Rent a node on Meerkat metal" without Meerkat being able to read a byte. The
 * service runs the SAME seeder (MeerkatSeederNode) once per tenant, each with
 * its own isolated piece store and storage cap, so:
 *  - TENANT ISOLATION: one tenant's node can never serve another tenant's
 *    pieces (separate stores; nothing is addressable across tenants).
 *  - ZERO-KNOWLEDGE BY CONSTRUCTION: a seeder is content-agnostic -- it stores
 *    and serves opaque, hash-addressed pieces and holds NO community group keys,
 *    so the operator provably cannot decrypt hosted shards. The accompanying
 *    test captures everything the service persisted and shows it is ciphertext
 *    that only a key-holding member can open.
 *  - COMMUNITY EXIT: a community fires its hosted node by re-signing its
 *    descriptor without that host (MK-030 reviseCommunity). The node keeps only
 *    ciphertext it cannot read; firing simply stops new traffic.
 *
 * Billing (Stripe), real provisioning, and the public pricing page are ops/infra
 * (MK-041 deploy + MK-042); this is the multi-tenant runtime they wrap.
 */

import {
  MeerkatSeederNode,
  InMemorySeederPieceStore,
  type SeederPieceStore,
  type SeederNodeStats,
  type PinResult,
} from './seeder-node';
import type { CommunityCatalog } from '@mylife/sync';

export interface HostedNodeServiceOptions {
  /** Per-tenant piece store factory. Default: in-memory (prod uses File). */
  makePieceStore?: (tenantId: string) => SeederPieceStore;
  now?: () => number;
}

export interface ProvisionTenantOptions {
  tenantId: string;
  /** Hard storage cap for this tenant. */
  storageCapMB: number;
  /** Auto-delete window for non-pinned content. Default 30 days. */
  autoDeleteDays?: number;
}

export interface HostedTenantStats extends SeederNodeStats {
  tenantId: string;
}

/**
 * Hosted storage tiers (Plan 22). 'free' is the always-on free tier the durable
 * public archive (Plan 19 P9) pins into; the paid tiers raise the cap. The Stripe
 * billing rails that SELL the paid tiers are Plan 22 Part 2 (not this slice); this
 * map is the cap source the free-tier backend + the usage meter read.
 */
export type MeerkatHostedTier = 'free' | 'starter' | 'community' | 'fleet';

/** Tier -> hard storage cap in MB. Real, enforced server-side by the seeder pin cap. */
export const MEERKAT_STORAGE_TIER_CAPS_MB: Record<MeerkatHostedTier, number> = {
  free: 1024, // 1 GB free tier
  starter: 10 * 1024, // 10 GB
  community: 100 * 1024, // 100 GB
  fleet: 1024 * 1024, // 1 TB
};

export function storageCapMbForTier(tier: MeerkatHostedTier): number {
  return MEERKAT_STORAGE_TIER_CAPS_MB[tier];
}

/**
 * Retention dimension (Plan 22 S0.7). Maps onto the seeder's real sweep:
 *  - 'rolling30' -> autoDeleteDays 30, NOT pinned: the sweep really deletes content
 *    whose autoDeleteAt has passed;
 *  - 'forever'   -> pinned: the sweep really KEEPS it (isPinned bypasses deletion).
 * The UI never claims permanence the retention policy does not enforce.
 */
export type MeerkatRetentionTier = 'rolling30' | 'forever';

export interface RetentionPolicy {
  autoDeleteDays: number;
  pinForever: boolean;
}

export const MEERKAT_RETENTION_POLICIES: Record<MeerkatRetentionTier, RetentionPolicy> = {
  rolling30: { autoDeleteDays: 30, pinForever: false },
  // 'forever' is enforced by isPinned (the sweep keeps pinned content); the large
  // autoDeleteDays is a belt-and-suspenders window that never fires for pinned rows.
  forever: { autoDeleteDays: 36_500, pinForever: true },
};

export function retentionPolicy(tier: MeerkatRetentionTier): RetentionPolicy {
  return MEERKAT_RETENTION_POLICIES[tier];
}

/** A subject's REAL usage: their own tenant stats + the tier + retention they were provisioned at. */
export interface MeerkatSubjectUsage extends HostedTenantStats {
  tier: MeerkatHostedTier;
  retentionTier: MeerkatRetentionTier;
}

export interface ProvisionTierOptions {
  subjectId: string;
  tier: MeerkatHostedTier;
  /** Retention dimension. Default 'rolling30' (free tier auto-deletes after 30 days). */
  retentionTier?: MeerkatRetentionTier;
  /** Auto-delete window override. Default derives from the retention tier. */
  autoDeleteDays?: number;
}

interface Tenant {
  node: MeerkatSeederNode;
  tier?: MeerkatHostedTier;
  retentionTier?: MeerkatRetentionTier;
}

export class HostedNodeService {
  private readonly tenants = new Map<string, Tenant>();
  private readonly makePieceStore: (tenantId: string) => SeederPieceStore;
  private readonly now: () => number;

  constructor(options: HostedNodeServiceOptions = {}) {
    this.makePieceStore = options.makePieceStore ?? (() => new InMemorySeederPieceStore());
    this.now = options.now ?? (() => Date.now());
  }

  /** Provision (or return) an isolated tenant node with its own cap + store. */
  provision(options: ProvisionTenantOptions): MeerkatSeederNode {
    const existing = this.tenants.get(options.tenantId);
    if (existing) return existing.node;
    const node = new MeerkatSeederNode({
      pieceStore: this.makePieceStore(options.tenantId),
      now: this.now,
      policy: {
        enabled: true,
        maxUploadKbps: 0,
        maxSeedStorageMB: options.storageCapMB,
        autoDeleteDays: options.autoDeleteDays ?? 30,
        seedOnCellular: false,
        seedWhileCharging: true,
        updatedAt: new Date(this.now()).toISOString(),
      },
    });
    this.tenants.set(options.tenantId, { node });
    return node;
  }

  /**
   * Provision (or return) a tenant at a billing tier, keyed by the subject id
   * (subjectId === tenantId). The cap comes from the tier->cap map and is enforced
   * server-side by the seeder pin cap. Free-tier provisioning is idempotent; raising
   * an existing tenant's cap on a paid upgrade is Plan 22 Part 2 (paid path).
   */
  provisionForTier(options: ProvisionTierOptions): MeerkatSeederNode {
    const retentionTier = options.retentionTier ?? 'rolling30';
    const node = this.provision({
      tenantId: options.subjectId,
      storageCapMB: storageCapMbForTier(options.tier),
      autoDeleteDays: options.autoDeleteDays ?? retentionPolicy(retentionTier).autoDeleteDays,
    });
    const tenant = this.tenants.get(options.subjectId);
    if (tenant) {
      tenant.tier = options.tier;
      tenant.retentionTier = retentionTier;
    }
    return node;
  }

  /**
   * A subject's REAL usage, or null when they have no provisioned tenant (so the UI
   * shows "Not connected", never a fabricated "0 of N"). Structural isolation: this
   * only ever reads the subject's OWN tenant, so it can never return another
   * subject's bytes. All numbers come straight from SeederNodeStats.
   */
  async usageForSubject(subjectId: string): Promise<MeerkatSubjectUsage | null> {
    const tenant = this.tenants.get(subjectId);
    if (!tenant) return null;
    return {
      tenantId: subjectId,
      tier: tenant.tier ?? 'free',
      retentionTier: tenant.retentionTier ?? 'rolling30',
      ...(await tenant.node.stats()),
    };
  }

  /** The tenant's node, or null if not provisioned. */
  tenant(tenantId: string): MeerkatSeederNode | null {
    return this.tenants.get(tenantId)?.node ?? null;
  }

  hasTenant(tenantId: string): boolean {
    return this.tenants.has(tenantId);
  }

  listTenants(): string[] {
    return [...this.tenants.keys()];
  }

  /** Pin a catalog for a tenant. Throws if the tenant is not provisioned. */
  async pinFor(tenantId: string, catalog: CommunityCatalog, pinForever = true): Promise<PinResult> {
    const node = this.tenant(tenantId);
    if (!node) throw new Error(`Tenant not provisioned: ${tenantId}`);
    return node.pin(catalog, { pinForever });
  }

  /**
   * Serve a piece on behalf of a tenant. Isolation is structural: this only
   * ever consults that tenant's own node/store, so it cannot return another
   * tenant's bytes even if the infoHash collides.
   */
  async serveFor(tenantId: string, infoHash: string, index: number): Promise<Uint8Array | null> {
    const node = this.tenant(tenantId);
    if (!node) return null;
    return node.servePiece(infoHash, index);
  }

  /** Fire/cancel a tenant: drop the node and its store. */
  async deprovision(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;
    for (const id of tenant.node.pinnedInfoHashes()) {
      await tenant.node.unpin(id);
    }
    this.tenants.delete(tenantId);
  }

  async stats(): Promise<HostedTenantStats[]> {
    const out: HostedTenantStats[] = [];
    for (const [tenantId, tenant] of this.tenants) {
      out.push({ tenantId, ...(await tenant.node.stats()) });
    }
    return out;
  }
}
