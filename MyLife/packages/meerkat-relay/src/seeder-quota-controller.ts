/**
 * Seeder storage quota + retention controller (Plan 43 WP-43B).
 *
 * A hosted seeder holds bounded storage. It must (1) refuse a NEW pin that would exceed a per-tenant
 * or per-node cap -- honestly, surfacing the over-quota state rather than silently dropping bytes --
 * and (2) reclaim space under a retention policy WITHOUT ever evicting an object that is pinned and
 * still referenced. This is the pure, deterministic controller for both decisions. It touches no
 * bytes and no store: it takes an inventory snapshot + a policy and returns a decision, so every
 * rule is unit-testable without a seeder, a disk, or a clock beyond the injected `nowMs`.
 *
 * The invariants it guarantees (AC-43.8-adjacent, the plan's retention rule):
 *  - A pinned+referenced object is NEVER selected for eviction. Pinning is the operator's explicit
 *    "keep forever"; a still-referenced object backs a live publication. Only UNPINNED,
 *    UNREFERENCED objects past their retention age are evictable.
 *  - Admission is honest: `admitPin` returns `over_tenant_quota` / `over_node_quota` (never a
 *    silent partial) when a new object of a given size would breach either cap, so the caller
 *    refuses the pin and reports the exact state.
 *  - Eviction is bounded and ordered: oldest-eligible first, stopping as soon as enough space is
 *    freed (or the eligible set is exhausted -- an honest `still_over_quota` when it cannot free
 *    enough without touching a pinned/referenced object).
 */

/** One object the seeder holds, with the facts the controller needs to decide retention/quota. */
export interface SeederInventoryObject {
  /** The durable object key (stable identity for eviction). */
  objectKey: string;
  /** The tenant this object's bytes are billed to (per-tenant cap scope). */
  tenantId: string;
  sizeBytes: number;
  /** True iff an operator pinned this object "keep forever" -- never evictable. */
  pinned: boolean;
  /** True iff the WP-2C reference ledger still shows a live reference -- never evictable. */
  referenced: boolean;
  /** ISO instant the object last became eligible for eviction accounting (e.g. its store mtime). */
  lastActiveAt: string;
}

export interface SeederQuotaPolicy {
  /** Hard cap on total bytes the node may hold across all tenants. */
  nodeCapBytes: number;
  /** Hard cap on bytes a single tenant may hold. */
  tenantCapBytes: number;
  /** Unpinned, unreferenced objects older than this are eviction-eligible. */
  retentionMs: number;
  /** Reclaim down to at most this fraction of the node cap when evicting (headroom). 0..1. */
  targetUtilization: number;
}

export interface AdmitPinInput {
  inventory: readonly SeederInventoryObject[];
  policy: SeederQuotaPolicy;
  tenantId: string;
  /** Bytes the new pin would add. */
  addBytes: number;
}

export type AdmitPinResult =
  | { status: 'admitted'; nodeBytesAfter: number; tenantBytesAfter: number }
  | { status: 'over_node_quota'; nodeBytes: number; nodeCapBytes: number }
  | { status: 'over_tenant_quota'; tenantBytes: number; tenantCapBytes: number };

export interface EvictionPlanInput {
  inventory: readonly SeederInventoryObject[];
  policy: SeederQuotaPolicy;
  nowMs: number;
  /** Max objects evicted this pass (bounded). */
  maxEvictions: number;
}

export interface EvictionCandidate {
  objectKey: string;
  tenantId: string;
  sizeBytes: number;
  ageMs: number;
}

export interface EvictionPlan {
  /** Objects to evict, oldest-eligible first, bounded by maxEvictions and the reclaim target. */
  evict: EvictionCandidate[];
  bytesReclaimed: number;
  nodeBytesBefore: number;
  nodeBytesAfter: number;
  /** True iff the node is still above its cap after this plan (nothing more is safely evictable). */
  stillOverQuota: boolean;
}

const MAX_EVICTIONS = 100_000;
const MAX_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

function assertPositiveInteger(name: string, value: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new TypeError(`${name} must be an integer between 1 and ${max}`);
  }
}

function validatePolicy(policy: SeederQuotaPolicy): void {
  assertNonNegativeInteger('nodeCapBytes', policy.nodeCapBytes);
  assertNonNegativeInteger('tenantCapBytes', policy.tenantCapBytes);
  assertNonNegativeInteger('retentionMs', policy.retentionMs);
  if (policy.retentionMs > MAX_WINDOW_MS) throw new TypeError('retentionMs exceeds the maximum');
  if (!Number.isFinite(policy.targetUtilization)
    || policy.targetUtilization <= 0 || policy.targetUtilization > 1) {
    throw new TypeError('targetUtilization must be in (0, 1]');
  }
}

function sumBytes(objects: readonly SeederInventoryObject[]): number {
  return objects.reduce((total, object) => total + object.sizeBytes, 0);
}

/**
 * Decide whether a new pin of `addBytes` for `tenantId` is admissible without breaching the node or
 * tenant cap. Honest: returns the exact over-quota state (never a silent drop) so the caller refuses
 * the pin and surfaces it. Never mutates; the caller commits only on `admitted`.
 */
export function admitPin(input: AdmitPinInput): AdmitPinResult {
  validatePolicy(input.policy);
  assertNonNegativeInteger('addBytes', input.addBytes);
  const nodeBytes = sumBytes(input.inventory);
  const tenantBytes = sumBytes(input.inventory.filter((object) => object.tenantId === input.tenantId));
  const nodeBytesAfter = nodeBytes + input.addBytes;
  const tenantBytesAfter = tenantBytes + input.addBytes;
  if (nodeBytesAfter > input.policy.nodeCapBytes) {
    return { status: 'over_node_quota', nodeBytes, nodeCapBytes: input.policy.nodeCapBytes };
  }
  if (tenantBytesAfter > input.policy.tenantCapBytes) {
    return { status: 'over_tenant_quota', tenantBytes, tenantCapBytes: input.policy.tenantCapBytes };
  }
  return { status: 'admitted', nodeBytesAfter, tenantBytesAfter };
}

/**
 * Plan a bounded retention eviction pass. Selects only UNPINNED, UNREFERENCED objects past the
 * retention age, oldest first, until the node is at or below its reclaim target (targetUtilization *
 * nodeCap) or the eligible set is exhausted. A pinned or referenced object is NEVER selected, so a
 * live or operator-kept publication is never evicted; if the node cannot reach its cap without
 * touching one, the plan is honestly `stillOverQuota`.
 */
export function planEviction(input: EvictionPlanInput): EvictionPlan {
  validatePolicy(input.policy);
  assertNonNegativeInteger('nowMs', input.nowMs);
  assertPositiveInteger('maxEvictions', input.maxEvictions, MAX_EVICTIONS);

  const nodeBytesBefore = sumBytes(input.inventory);
  const reclaimTarget = Math.floor(input.policy.nodeCapBytes * input.policy.targetUtilization);
  const eligible = input.inventory
    .filter((object) => !object.pinned && !object.referenced
      && input.nowMs - Date.parse(object.lastActiveAt) >= input.policy.retentionMs)
    .map((object) => ({ object, ageMs: input.nowMs - Date.parse(object.lastActiveAt) }))
    .sort((a, b) => b.ageMs - a.ageMs || a.object.objectKey.localeCompare(b.object.objectKey));

  const evict: EvictionCandidate[] = [];
  let bytesReclaimed = 0;
  let nodeBytesAfter = nodeBytesBefore;
  for (const { object, ageMs } of eligible) {
    if (evict.length >= input.maxEvictions) break;
    // Stop once at/below the reclaim target: do not evict more than needed for headroom.
    if (nodeBytesAfter <= reclaimTarget) break;
    evict.push({ objectKey: object.objectKey, tenantId: object.tenantId, sizeBytes: object.sizeBytes, ageMs });
    bytesReclaimed += object.sizeBytes;
    nodeBytesAfter -= object.sizeBytes;
  }
  return {
    evict,
    bytesReclaimed,
    nodeBytesBefore,
    nodeBytesAfter,
    stillOverQuota: nodeBytesAfter > input.policy.nodeCapBytes,
  };
}
