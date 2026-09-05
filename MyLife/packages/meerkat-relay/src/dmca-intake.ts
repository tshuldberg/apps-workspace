/**
 * DMCA intake (Plan 39 P13). A durable, first-party takedown-notice pipeline for the public feed.
 * The node exposes a PUBLIC, rate-limited, zod-validated intake route (community-node-http) that
 * persists a claim; the operator console surfaces claims as a DMCA lane with a takedown
 * (tombstone) action, a counter-notice record, and audit rows. This module owns the shape,
 * validation, storage, and lifecycle -- no crypto (a DMCA notice is a legal attestation, not a
 * signed protocol object).
 *
 * NC-P1: DMCA applies ONLY to the public feed's published content. The private mesh has no
 * public URLs and no intake here. Honesty (NC-P4): a claim is `received` until an operator acts;
 * the pipeline never auto-tombstones and never claims an action it did not take.
 *
 * The DMCA-designated-agent registration (name, address, the Copyright Office filing) is
 * FOUNDER-OPS (Plan 39 P15). DMCA_REGISTERED_AGENT below is a PLACEHOLDER constant the founder
 * fills; it is intentionally not a real agent. The intake works regardless -- claims persist and
 * surface for manual handling until the agent is registered.
 */

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

/**
 * PLACEHOLDER registered-agent block (Plan 39 P15 founder-ops). Fill every `<...>` field with the
 * real DMCA designated agent once registered with the U.S. Copyright Office; do NOT invent a
 * name or address. Surfaced verbatim in the intake route + console DMCA lane so a claimant sees
 * where formal notices go.
 */
export const DMCA_REGISTERED_AGENT = {
  configured: false as const,
  agentName: '<DMCA designated agent name -- FOUNDER TO REGISTER (P15)>',
  organization: '<Meerkat operating entity -- FOUNDER TO PROVIDE>',
  address: '<physical mailing address -- FOUNDER TO PROVIDE>',
  email: '<dmca@ -- FOUNDER TO PROVIDE>',
  phone: '<phone -- FOUNDER TO PROVIDE>',
  notice:
    'DMCA designated-agent registration is pending. Notices are received + retained but formal '
    + 'agent details are not yet published; see the operating entity for service of process.',
};

const CONTACT_MAX = 512;
const TEXT_MAX = 4096;
const ID_MAX = 256;
const LIST_MAX = 100;

/** The zod-validated DMCA takedown notice a claimant submits (17 U.S.C. 512(c)(3) elements). */
export const DmcaClaimSchema = z
  .object({
    /** Identification of the copyrighted work claimed to be infringed. */
    workDescription: z.string().min(1).max(TEXT_MAX),
    /** The allegedly infringing material: post ids and/or URLs on the public feed. */
    claimedPostIds: z.array(z.string().min(1).max(ID_MAX)).max(LIST_MAX).default([]),
    claimedUrls: z.array(z.string().min(1).max(ID_MAX)).max(LIST_MAX).default([]),
    /** Claimant contact info (name + email required; address for the sworn statement). */
    claimant: z.object({
      name: z.string().min(1).max(CONTACT_MAX),
      email: z.string().min(3).max(CONTACT_MAX),
      address: z.string().min(1).max(CONTACT_MAX),
      phone: z.string().max(CONTACT_MAX).optional(),
    }),
    /** "good faith belief that use is not authorized" attestation -- must be true. */
    goodFaithStatement: z.literal(true),
    /** "under penalty of perjury, accurate, and I am authorized to act" attestation -- must be true. */
    accuracyStatement: z.literal(true),
    /** The claimant's electronic signature (typed legal name). */
    signature: z.string().min(1).max(CONTACT_MAX),
  })
  .refine((c) => c.claimedPostIds.length > 0 || c.claimedUrls.length > 0, {
    message: 'at_least_one_claimed_item',
  });

export type DmcaClaimInput = z.infer<typeof DmcaClaimSchema>;

export type DmcaClaimStatus = 'received' | 'actioned' | 'counter_noticed' | 'rejected';

export interface DmcaCounterNotice {
  /** The counter-notice statement (17 U.S.C. 512(g)) -- good-faith, under penalty of perjury. */
  statement: string;
  signature: string;
  submittedAt: string;
}

export interface DmcaClaimRecord extends DmcaClaimInput {
  /** Stable id: sha256 over the canonical claim, receivedAt, and submission nonce. */
  id: string;
  receivedAt: string;
  status: DmcaClaimStatus;
  /** Monotonic compare-and-set version for lifecycle mutations. */
  lifecycleVersion: number;
  /** Set when an operator takes down the claimed items (which post ids were tombstoned). */
  actionedPostIds?: string[];
  /**
   * Claimed items that could NOT be auto-actioned (URLs, unknown post ids). Durable tracking so
   * a partially-handled claim stays visible + actionable instead of falling out of the queue.
   */
  unresolvedItems?: string[];
  counterNotice?: DmcaCounterNotice;
}

export interface DmcaClaimLifecycleState {
  status: DmcaClaimStatus;
  actionedPostIds?: string[];
  unresolvedItems?: string[];
  counterNotice?: DmcaCounterNotice;
}

export interface DmcaClaimTransitionInput {
  id: string;
  expectedVersion: number;
  lifecycle: DmcaClaimLifecycleState;
}

export type DmcaClaimTransitionResult =
  | { status: 'applied'; record: DmcaClaimRecord }
  | { status: 'conflict'; record: DmcaClaimRecord }
  | { status: 'not_found' };

/** Durable claim store. Append-first; a claim only advances status. */
export interface DmcaIntakeStore {
  create(record: DmcaClaimRecord): DmcaClaimRecord | Promise<DmcaClaimRecord>;
  get(id: string): (DmcaClaimRecord | null) | Promise<DmcaClaimRecord | null>;
  list(filter?: { status?: DmcaClaimStatus; limit?: number }): DmcaClaimRecord[] | Promise<DmcaClaimRecord[]>;
  compareAndSetLifecycle(
    input: DmcaClaimTransitionInput,
  ): DmcaClaimTransitionResult | Promise<DmcaClaimTransitionResult>;
}

/** In-memory intake store (tests, ephemeral runs). */
export class InMemoryDmcaIntakeStore implements DmcaIntakeStore {
  private readonly rows = new Map<string, DmcaClaimRecord>();
  private readonly order: string[] = [];

  create(record: DmcaClaimRecord): DmcaClaimRecord {
    const existing = this.rows.get(record.id);
    if (existing) return structuredClone(existing);
    this.order.push(record.id);
    this.rows.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  get(id: string): DmcaClaimRecord | null {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  list(filter: { status?: DmcaClaimStatus; limit?: number } = {}): DmcaClaimRecord[] {
    const bound = Math.max(1, Math.min(500, Math.floor(filter.limit ?? 100)));
    const out: DmcaClaimRecord[] = [];
    for (let i = this.order.length - 1; i >= 0 && out.length < bound; i -= 1) {
      const row = this.rows.get(this.order[i]!);
      if (!row) continue;
      if (filter.status && row.status !== filter.status) continue;
      out.push(structuredClone(row));
    }
    return out;
  }

  compareAndSetLifecycle(input: DmcaClaimTransitionInput): DmcaClaimTransitionResult {
    const current = this.rows.get(input.id);
    if (!current) return { status: 'not_found' };
    if (current.lifecycleVersion !== input.expectedVersion) {
      return { status: 'conflict', record: structuredClone(current) };
    }
    const updated: DmcaClaimRecord = {
      ...current,
      ...structuredClone(input.lifecycle),
      lifecycleVersion: current.lifecycleVersion + 1,
    };
    this.rows.set(input.id, updated);
    return { status: 'applied', record: structuredClone(updated) };
  }
}

function claimId(claim: DmcaClaimInput, receivedAt: string, submissionNonce: string): string {
  const canonical = JSON.stringify([
    'meerkat-dmca-claim-v1',
    claim.workDescription,
    [...claim.claimedPostIds].sort(),
    [...claim.claimedUrls].sort(),
    claim.claimant.email.toLowerCase(),
    claim.signature,
    receivedAt,
    submissionNonce,
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Service: validate + persist claims, list them, and record operator lifecycle transitions. */
export class DmcaIntakeService {
  private readonly store: DmcaIntakeStore;
  private readonly now: () => number;

  constructor(store: DmcaIntakeStore, options: { now?: () => number } = {}) {
    this.store = store;
    this.now = options.now ?? (() => Date.now());
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  /** Validate + persist a claim. Returns the stored record, or a validation error (fail-closed). */
  async submitClaim(raw: unknown): Promise<{ ok: true; record: DmcaClaimRecord } | { ok: false; reason: string }> {
    const parsed = DmcaClaimSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, reason: parsed.error.issues[0]?.message ?? 'invalid_claim' };
    }
    const receivedAt = this.nowIso();
    const record: DmcaClaimRecord = {
      ...parsed.data,
      id: claimId(parsed.data, receivedAt, randomUUID()),
      receivedAt,
      status: 'received',
      lifecycleVersion: 1,
    };
    return { ok: true, record: await this.store.create(record) };
  }

  async listClaims(filter?: { status?: DmcaClaimStatus; limit?: number }): Promise<DmcaClaimRecord[]> {
    return this.store.list(filter);
  }

  async getClaim(id: string): Promise<DmcaClaimRecord | null> {
    return this.store.get(id);
  }

  private async transition(
    id: string,
    update: (record: DmcaClaimRecord) => DmcaClaimLifecycleState,
  ): Promise<DmcaClaimRecord | null> {
    let current = await this.store.get(id);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (!current) return null;
      const lifecycle = update(current);
      const unchanged = JSON.stringify(lifecycle) === JSON.stringify({
        status: current.status,
        ...(current.actionedPostIds ? { actionedPostIds: current.actionedPostIds } : {}),
        ...(current.unresolvedItems ? { unresolvedItems: current.unresolvedItems } : {}),
        ...(current.counterNotice ? { counterNotice: current.counterNotice } : {}),
      });
      if (unchanged) return current;
      const result = await this.store.compareAndSetLifecycle({
        id,
        expectedVersion: current.lifecycleVersion,
        lifecycle,
      });
      if (result.status === 'applied') return result.record;
      if (result.status === 'not_found') return null;
      current = result.record;
    }
    throw new Error('DMCA lifecycle remained contended after 16 compare-and-set attempts');
  }

  /**
   * Operator recorded a takedown. The claim is only CLOSED (`actioned`) when EVERY claimed item
   * was resolved; if any items are unresolved (URLs, unknown post ids) the claim stays `received`
   * so the lane keeps offering actions, and the unresolved list is persisted for durable tracking.
   * A claim that already resolved everything stays actioned even if re-run with no new work.
   */
  async recordTakedown(id: string, actionedPostIds: string[], unresolvedItems: string[] = []): Promise<DmcaClaimRecord | null> {
    if (actionedPostIds.length > LIST_MAX || unresolvedItems.length > LIST_MAX * 2
      || actionedPostIds.some((item) => !item || item.length > ID_MAX)
      || unresolvedItems.some((item) => !item || item.length > ID_MAX)) {
      throw new TypeError('DMCA lifecycle items exceed the intake bounds');
    }
    return this.transition(id, (record) => {
      if (record.status === 'rejected' || record.status === 'counter_noticed') {
        return {
          status: record.status,
          ...(record.actionedPostIds ? { actionedPostIds: record.actionedPostIds } : {}),
          ...(record.unresolvedItems ? { unresolvedItems: record.unresolvedItems } : {}),
          ...(record.counterNotice ? { counterNotice: record.counterNotice } : {}),
        };
      }
      const mergedActioned = [...new Set([
        ...(record.actionedPostIds ?? []),
        ...actionedPostIds,
      ])];
      return {
        status: record.status === 'actioned' || unresolvedItems.length === 0
          ? 'actioned'
          : 'received',
        actionedPostIds: mergedActioned,
        unresolvedItems: [...new Set(unresolvedItems)],
        ...(record.counterNotice ? { counterNotice: record.counterNotice } : {}),
      };
    });
  }

  /** Operator recorded a counter-notice from the affected user (17 U.S.C. 512(g)). */
  async recordCounterNotice(id: string, counter: { statement: string; signature: string }): Promise<DmcaClaimRecord | null> {
    if (!counter.statement || counter.statement.length > TEXT_MAX
      || !counter.signature || counter.signature.length > CONTACT_MAX) {
      throw new TypeError('DMCA counter notice exceeds the intake bounds');
    }
    const submittedAt = this.nowIso();
    return this.transition(id, (record) => ({
      status: record.status === 'rejected' ? 'rejected' : 'counter_noticed',
      ...(record.actionedPostIds ? { actionedPostIds: record.actionedPostIds } : {}),
      ...(record.unresolvedItems ? { unresolvedItems: record.unresolvedItems } : {}),
      ...(record.status === 'rejected' && record.counterNotice
        ? { counterNotice: record.counterNotice }
        : record.status !== 'rejected'
          ? {
              counterNotice: {
                statement: counter.statement,
                signature: counter.signature,
                submittedAt,
              },
            }
          : {}),
    }));
  }

  /** Operator rejected a claim (defective/abusive notice). */
  async recordRejection(id: string): Promise<DmcaClaimRecord | null> {
    return this.transition(id, (record) => ({
      status: record.status === 'received' ? 'rejected' : record.status,
      ...(record.actionedPostIds ? { actionedPostIds: record.actionedPostIds } : {}),
      ...(record.unresolvedItems ? { unresolvedItems: record.unresolvedItems } : {}),
      ...(record.counterNotice ? { counterNotice: record.counterNotice } : {}),
    }));
  }
}
