/**
 * Sealed community-history host announce loop -- the PRIVATE twin of the public
 * host-registry announce loop (archive-announcement-scheduler.ts), for the
 * community node's community feed (Plan 43 WP-43G, "Seeding and History
 * Discovery"). The public loop lets a browser discover WHO serves a public
 * contentId; this one lets a COMMUNITY MEMBER discover WHERE their community's
 * cold-start history snapshot is served, zero-knowledge to the relay -- the
 * exact problem community-history-host.ts (WP-43D) and
 * runAutomaticHistorySync solve on the read side. This module is the WRITE side:
 * decide when to (re)announce and build the sealed record; it announces nothing
 * itself (that is the bin's job, mirroring the public loop's split).
 *
 * Pure core over injected candidates + time, exactly like planAnnouncements:
 *  - `planHistoryAnnouncements` decides, for a set of hosted communities, WHICH
 *    to (re)announce this tick: never-announced communities are always due;
 *    announced ones are due once `now >= lastAnnouncedAt + ttlMs - refreshLeadMs`.
 *    A community is only a CANDIDATE when it has a CURRENT descriptor and a
 *    serveable snapshot (both caller-supplied booleans -- this module never
 *    reaches into a store). Bounded per tick, with deterministic per-community
 *    jitter (same FNV-1a construction as archive-announcement-scheduler.ts) so a
 *    fleet of community nodes does not synchronize refreshes into a storm.
 *  - `buildSealedHistoryAnnouncement` derives the rid + seals the
 *    HistoryHostRecord for one community's CURRENT descriptor + snapshot state.
 *    It refuses (returns null, never throws into the loop) when the descriptor is
 *    missing, no snapshot is serveable, or the base url is not https -- a
 *    plaintext base url would announce a host nothing should trust, so this is a
 *    fail-closed gate, not just a validation nicety.
 *
 * Zero-knowledge invariant (do not weaken): the caller hands the RELAY CLIENT
 * only `{ rid, sealedRecord }` (via announceHost from @mylife/sync). No
 * community id, descriptor, or member identity crosses that boundary -- the rid
 * is HKDF(communitySecret)-derived and the record is secretbox(HistoryHostRecord)
 * under a key only descriptor-holders can derive (community-history-host.ts).
 */

import {
  deriveCommunityHistoryRegistryId,
  sealCommunityHistoryHost,
  HISTORY_HOST_SNAPSHOT_VERSION,
  type HistoryHostRecord,
} from '@mylife/sync';

/** One hosted community's announce-eligibility snapshot, caller-supplied. */
export interface HistoryAnnounceCandidate {
  communityId: string;
  /** The descriptor's genesisNonce (hex) -- the community secret the seal derives from. */
  communitySecret: string;
  /** The descriptor revision this node currently serves. */
  descriptorRevision: number;
  /** True iff this node holds a CURRENT signed descriptor for the community. */
  descriptorCurrent: boolean;
  /** True iff this node has at least one serveable cold-start snapshot piece set. */
  snapshotServeable: boolean;
  /** ISO instant this community's history host was last announced, or null. */
  lastAnnouncedAt: string | null;
}

export interface HistoryAnnouncePlanInput {
  candidates: readonly HistoryAnnounceCandidate[];
  /** Announcement TTL the relay registry grants (ms). Refresh must beat this. */
  ttlMs: number;
  /** Refresh this many ms BEFORE ttl expiry, so an announcement never lapses. */
  refreshLeadMs: number;
  /** Max announcements planned this tick (bounded; the rest wait for next tick). */
  maxPerTick: number;
  /** Max extra delay spread across due announcements, to de-synchronize refresh storms. */
  jitterWindowMs: number;
  /** Deterministic jitter seed (e.g. this node's host id), so replays are stable. */
  jitterSeed: string;
  nowMs: number;
}

export interface HistoryAnnounceAction {
  communityId: string;
  /** Wall-clock ms this announce should fire (now + deterministic jitter). */
  fireAtMs: number;
}

export interface HistoryAnnouncePlan {
  actions: HistoryAnnounceAction[];
  /** Due-and-eligible communities deferred past maxPerTick this tick. */
  deferred: number;
  /** Candidates skipped because they are not announceable (stale descriptor / no snapshot / not due). */
  skippedNotAnnounceable: number;
}

const MAX_PER_TICK = 10_000;
const MAX_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

function assertPositiveInteger(name: string, value: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new TypeError(`${name} must be an integer between 1 and ${max}`);
  }
}

function assertNonNegativeInteger(name: string, value: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new TypeError(`${name} must be an integer between 0 and ${max}`);
  }
}

/** Deterministic 0..1 hash of a key + seed (FNV-1a), mirrors archive-announcement-scheduler.ts. */
function deterministicUnit(key: string, seed: string): number {
  let hash = 0x811c9dc5;
  const input = `${seed} ${key}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * True iff a hosted community with a current descriptor and a serveable
 * snapshot is due for (re)announcement: never-announced communities are always
 * due; announced ones are due once now crosses ttl minus the lead. A community
 * missing either the descriptor or the snapshot is NEVER due (fail-closed --
 * this mirrors buildSealedHistoryAnnouncement's own refusal so the plan and the
 * seal never disagree).
 */
export function historyAnnounceIsDue(
  candidate: HistoryAnnounceCandidate,
  input: Pick<HistoryAnnouncePlanInput, 'ttlMs' | 'refreshLeadMs' | 'nowMs'>,
): boolean {
  if (!candidate.descriptorCurrent) return false;
  if (!candidate.snapshotServeable) return false;
  if (candidate.lastAnnouncedAt === null) return true;
  const last = Date.parse(candidate.lastAnnouncedAt);
  if (!Number.isFinite(last)) return true;
  return input.nowMs >= last + input.ttlMs - input.refreshLeadMs;
}

/**
 * Plan this tick's private-history announcements over a set of hosted
 * communities. Pure and deterministic: filters to announceable-and-due
 * communities, sorts the most-urgent first (oldest lastAnnouncedAt / never
 * first), bounds to maxPerTick, and assigns each a deterministic jittered fire
 * time so a fleet of community nodes de-synchronizes.
 */
export function planHistoryAnnouncements(input: HistoryAnnouncePlanInput): HistoryAnnouncePlan {
  assertPositiveInteger('ttlMs', input.ttlMs, MAX_WINDOW_MS);
  assertNonNegativeInteger('refreshLeadMs', input.refreshLeadMs, input.ttlMs);
  assertPositiveInteger('maxPerTick', input.maxPerTick, MAX_PER_TICK);
  assertNonNegativeInteger('jitterWindowMs', input.jitterWindowMs, MAX_WINDOW_MS);
  assertNonNegativeInteger('nowMs', input.nowMs, Number.MAX_SAFE_INTEGER);

  let skippedNotAnnounceable = 0;
  const due: HistoryAnnounceCandidate[] = [];
  for (const candidate of input.candidates) {
    if (historyAnnounceIsDue(candidate, input)) due.push(candidate);
    else skippedNotAnnounceable += 1;
  }
  due.sort((a, b) => {
    const aTime = a.lastAnnouncedAt === null ? -1 : Date.parse(a.lastAnnouncedAt);
    const bTime = b.lastAnnouncedAt === null ? -1 : Date.parse(b.lastAnnouncedAt);
    return aTime - bTime || a.communityId.localeCompare(b.communityId);
  });
  const selected = due.slice(0, input.maxPerTick);
  const actions: HistoryAnnounceAction[] = selected.map((candidate) => {
    const jitter = input.jitterWindowMs === 0
      ? 0
      : Math.floor(deterministicUnit(candidate.communityId, input.jitterSeed) * input.jitterWindowMs);
    return { communityId: candidate.communityId, fireAtMs: input.nowMs + jitter };
  });
  return {
    actions,
    deferred: due.length - selected.length,
    skippedNotAnnounceable,
  };
}

/** Inputs to build one community's sealed history-host announcement. */
export interface BuildSealedHistoryAnnouncementInput {
  communityId: string;
  communitySecret: string;
  descriptorCurrent: boolean;
  descriptorRevision: number;
  snapshotServeable: boolean;
  /** This node's publicly reachable base url. MUST be https (refused otherwise). */
  publicBaseUrl: string;
  /** This node's per-piece byte cap (the reader's transfer expectation). */
  maxObjectBytes: number;
  ttlMs: number;
  nowMs: number;
}

/** The rid + opaque sealed record ready to hand to the relay's announce verb. */
export interface SealedHistoryAnnouncement {
  rid: string;
  sealedRecord: string;
}

/**
 * Build one community's sealed HistoryHostRecord announcement, or null when the
 * community is not announceable. NEVER announces when: the descriptor is
 * missing/stale (`descriptorCurrent` false), no snapshot is serveable, or
 * `publicBaseUrl` is not an https url (a plaintext base url is refused with no
 * partial/insecure announcement -- fail closed, not a best-effort degrade). The
 * returned shape carries ONLY the opaque `{ rid, sealedRecord }` a caller hands
 * to announceHost; no community id, descriptor, or member identity is present in
 * either field.
 */
export function buildSealedHistoryAnnouncement(
  input: BuildSealedHistoryAnnouncementInput,
): SealedHistoryAnnouncement | null {
  if (!input.descriptorCurrent) return null;
  if (!input.snapshotServeable) return null;
  if (!/^https:\/\//.test(input.publicBaseUrl)) return null;
  if (!Number.isFinite(input.maxObjectBytes) || input.maxObjectBytes <= 0) return null;
  if (!Number.isFinite(input.descriptorRevision) || input.descriptorRevision < 0) return null;

  const record: HistoryHostRecord = {
    communityId: input.communityId,
    hostUrl: input.publicBaseUrl.replace(/\/+$/, ''),
    descriptorRevision: input.descriptorRevision,
    snapshotVersion: HISTORY_HOST_SNAPSHOT_VERSION,
    maxObjectBytes: input.maxObjectBytes,
    expiresAt: new Date(input.nowMs + input.ttlMs).toISOString(),
  };
  const rid = deriveCommunityHistoryRegistryId(input.communitySecret);
  const sealedRecord = sealCommunityHistoryHost(input.communitySecret, record);
  return { rid, sealedRecord };
}
