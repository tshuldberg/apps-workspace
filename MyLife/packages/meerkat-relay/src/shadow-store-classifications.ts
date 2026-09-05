/**
 * EXPLICIT per-store method classifications for the shadow comparator (Plan 44 WP-3B).
 *
 * Each store the shadow-mode bins construct in BOTH backends has one classification
 * table here. Every method is read | write | skip -- explicit, never a heuristic. This
 * is the single auditable place that says which methods are compared, which are mirrored,
 * and which are deliberately not shadowed and why.
 *
 * `skip` rules (inherently divergent between two independent backends):
 *  - write-locks: `withPublicationWriteLock`, `withPersonaWriteLock` acquire a
 *    per-key lock on ONE backend and run a caller closure; running the closure twice
 *    (once per backend) would double every wrapped mutation. The lock is a control-flow
 *    primitive, not state, so it forwards to the primary only.
 *  - lease/fencing-token claims and challenge issuance: `issueChallenge`,
 *    `beginPublish`, `commitPublish`, `beginRegistrationAttempt`,
 *    `commitRegistrationAttempt`, `redeemLink`, `applySubscriptionEvent`,
 *    `applyAppPurchaseEvent` mint or consume a single-use / fenced token whose value
 *    (nonce, expiry, apply-vs-duplicate verdict) is backend-clock and backend-state
 *    dependent, so two backends legitimately return different tokens for the same call.
 *  - time-window-dependent stats/sweeps: `prune`, `sweepExpired`, `sweep`,
 *    `trackedCommunityCount`, `listExpiredPublishStages`, `completeExpiredPublishStage`
 *    key off each backend's own wall clock and lease horizon.
 *
 * Read normalizers: list methods whose contract does NOT guarantee order use
 * `unordered`; everything else compares order-sensitively.
 */

import type { ShadowStoreClassification } from './shadow-state-comparator';
import { unordered } from './shadow-state-comparator';
import type { PersonaRegistryStore } from './persona-registry';
import type {
  CommunityDescriptorStore,
  KillStore,
  PublicationStore,
  PublicPostStore,
  ReportStore,
} from './community-node';
import type { CommunityPrivateStateStore } from './community-private-state';
import type { NcmecReportQueueStore } from './ncmec-queue';
import type { DmcaIntakeStore } from './dmca-intake';

const read = { mode: 'read' } as const;
const write = { mode: 'write' } as const;
const unorderedRead = { mode: 'read', normalize: unordered } as const;
const skipLock = { mode: 'skip', reason: 'write-lock control-flow primitive; runs the caller closure on the primary only' } as const;
const skipLease = { mode: 'skip', reason: 'single-use / fenced token; value is backend-clock and backend-state dependent' } as const;
const skipWindow = { mode: 'skip', reason: 'time-window/lease-horizon dependent; keys off each backend wall clock' } as const;

/**
 * community.publications (persona + community bins). Order of `list()` is not contract-
 * guaranteed (it is used only for a refcount scan), so it is compared unordered.
 */
export const publicationStoreClassification: ShadowStoreClassification<PublicationStore> = {
  withPublicationWriteLock: skipLock,
  get: read,
  put: write,
  replace: write,
  list: unorderedRead,
};

/** community.reports (persona + community bins). */
export const reportStoreClassification: ShadowStoreClassification<ReportStore> = {
  get: read,
  put: write,
  appendCapped: write,
};

/**
 * community.public-posts + tombstones + freezes + submit-windows + blocked-personas
 * (persona + community bins). `listSubmits` returns the raw stored submit-timestamp
 * window (deterministic per stored state, not a live clock read), so it is a compared
 * read; the node itself prunes to the policy window before writing.
 */
export const publicPostStoreClassification: ShadowStoreClassification<PublicPostStore> = {
  withPublicationWriteLock: skipLock,
  isPersonaBlocked: read,
  blockPersona: write,
  listPosts: read,
  putPosts: write,
  listTombstones: read,
  putTombstones: write,
  getFreeze: read,
  putFreeze: write,
  listSubmits: read,
  putSubmits: write,
};

/** community.kills (persona + community bins). loadKilledCommunityIds is a set, unordered. */
export const killStoreClassification: ShadowStoreClassification<KillStore> = {
  recordKill: write,
  isKilled: read,
  loadKilledCommunityIds: unorderedRead,
};

/**
 * persona.records (persona bin). Registration-attempt methods mint fenced attempt
 * tokens and are skipped; the resolvable read/lifecycle-write methods are compared.
 */
export const personaRegistryStoreClassification: ShadowStoreClassification<PersonaRegistryStore> = {
  beginRegistrationAttempt: skipLease,
  markRegistrationHumanityVerified: skipLease,
  commitRegistrationAttempt: skipLease,
  cancelRegistrationAttempt: skipLease,
  tryRegister: write,
  remove: write,
  getByAlias: read,
  getByPubkey: read,
  getByPubkeys: unorderedRead,
  release: write,
  getTombstone: read,
  revoke: write,
  unrevoke: write,
  isRevoked: read,
  withPersonaWriteLock: skipLock,
  prune: skipWindow,
  stats: read,
};

/**
 * community.descriptor-revisions (community bin). `claimRevision` is a fenced monotonic
 * revision claim whose verdict ('inserted' | 'stale' | 'idempotent' | 'conflict') depends
 * on each backend's own highest-seen state, so it is skipped; `recordRevision` mirrors the
 * write and `getHighestRevision` compares the durable pointer.
 */
export const communityDescriptorStoreClassification: ShadowStoreClassification<CommunityDescriptorStore> = {
  getHighestRevision: read,
  claimRevision: skipLease,
  recordRevision: write,
};

/**
 * community.private-states (community bin). Everything that mints a challenge, opens a
 * publish stage, claims a lease, or sweeps on a wall-clock horizon is inherently divergent
 * and skipped; the two authoritative state reads (`getState`, `isContentReferenced`) are
 * compared, and `appendTail` mirrors the durable append.
 */
export const communityPrivateStateStoreClassification: ShadowStoreClassification<CommunityPrivateStateStore> = {
  issueChallenge: skipLease,
  inspectChallenge: skipLease,
  authorizeRequest: skipLease,
  authorizeAndReadState: skipLease,
  authorizeAndCheckContent: skipLease,
  appendTail: write,
  getState: read,
  beginPublish: skipLease,
  commitPublish: skipLease,
  isContentReferenced: read,
  listExpiredPublishStages: skipWindow,
  completeExpiredPublishStage: skipWindow,
  sweepExpired: skipWindow,
  trackedCommunityCount: skipWindow,
};

/**
 * moderation.ncmec-reports (community bin, wrapped inside NcmecReportQueue). `enqueue`
 * mirrors the durable insert; the export-claim lease methods are skipped; reads compare.
 */
export const ncmecReportQueueStoreClassification: ShadowStoreClassification<NcmecReportQueueStore> = {
  enqueue: write,
  get: read,
  list: unorderedRead,
  claimQueuedForExport: skipLease,
  completeExportClaims: skipLease,
  counts: read,
};

/**
 * moderation.dmca-claims (community bin, wrapped inside DmcaIntakeService).
 * `compareAndSetLifecycle` is a fenced compare-and-set (backend-state dependent), skipped.
 */
export const dmcaIntakeStoreClassification: ShadowStoreClassification<DmcaIntakeStore> = {
  create: write,
  get: read,
  list: unorderedRead,
  compareAndSetLifecycle: skipLease,
};

/**
 * hosted billing store (persona bin, `FileMeerkatBillingStore` / `PostgresMeerkatBillingStore`).
 * The provider-event apply verdict and single-use link redemption are fenced/single-use;
 * the plain getters and idempotent upserts are compared/mirrored.
 */
export const billingStoreClassification: ShadowStoreClassification<Record<string, unknown>> = {
  getSubscription: read,
  upsertSubscription: write,
  applySubscriptionEvent: skipLease,
  getAppPurchase: read,
  upsertAppPurchase: write,
  applyAppPurchaseEvent: skipLease,
  createLink: write,
  redeemLink: skipLease,
  getAppUnlockPersona: read,
  bindAppUnlockPersona: write,
  getSubjectByAppUnlockPersona: read,
  releaseAppUnlockPersona: write,
};

/**
 * operator console store (persona + community bins). `appendAudit` /
 * `recordTriageDecision` allocate a monotonic seq per backend, so their RETURN carries
 * a backend-local sequence number; they are still classified `write` (mirrored, no
 * return comparison) because the mirror must advance the shadow audit log, and the write
 * path never compares return values. `listAudit` is newest-first ordered by seq -- but
 * the two backends assign independent seqs, so it is compared unordered.
 */
export const operatorConsoleStoreClassification: ShadowStoreClassification<Record<string, unknown>> = {
  appendAudit: write,
  recordTriageDecision: write,
  listAudit: unorderedRead,
  auditCount: read,
  getTriage: read,
  putTriage: write,
  listTriage: unorderedRead,
  deleteTriage: write,
};
