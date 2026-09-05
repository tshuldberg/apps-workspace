import type { DatabaseAdapter } from '@mylife/db';
import {
  communityTransportPolicy,
  getCommunity,
  listCommunities,
  type CommunityTransportPolicy,
} from '@mylife/sync';

/** Short, human policy names shown in settings rows and change notices. */
export const TRANSPORT_POLICY_LABELS: Record<CommunityTransportPolicy, string> = {
  local_only: 'In person only',
  local_preferred: 'Local preferred',
  any: 'Any connection',
};

/** One honest sentence explaining what each policy does, not a live connection state. */
export const TRANSPORT_POLICY_MEANINGS: Record<CommunityTransportPolicy, string> = {
  local_only: 'This community only updates in person or on a shared network.',
  local_preferred: 'This community prefers a nearby connection and labels updates that go over the internet.',
  any: 'This community updates over any connection, including the internet.',
};

export interface PolicyHistoryRow {
  id: string;
  communityId: string;
  policy: CommunityTransportPolicy;
  previousPolicy: CommunityTransportPolicy | null;
  revision: number;
  recordedAt: string;
}

/** Honest one-line notice for a verified owner-signed policy change. */
export function formatPolicyChangeNotice(change: PolicyHistoryRow): string {
  const from = change.previousPolicy ? TRANSPORT_POLICY_LABELS[change.previousPolicy] : TRANSPORT_POLICY_LABELS.any;
  const to = TRANSPORT_POLICY_LABELS[change.policy];
  return `The owner changed the sync policy from ${from} to ${to}.`;
}

// --- observed policy ledger (twin of mobile community-core, item 13) ----------

function readPolicy(raw: string | null | undefined): CommunityTransportPolicy | null {
  if (raw === 'local_only' || raw === 'local_preferred' || raw === 'any') return raw;
  return null;
}

/**
 * Record this device's CURRENT observed transport policy for a community into the
 * local ledger, IF it differs from the most recent recorded point. Idempotent per
 * revision (id = `${communityId}:${revision}`). Called only AFTER a real,
 * owner-signed descriptor was adopted, so a recorded change always reflects a
 * verified signed policy. Twin of the mobile recordCommunityPolicyPoint.
 */
export function recordCommunityPolicyPoint(
  db: DatabaseAdapter,
  communityId: string,
  now: string = new Date().toISOString(),
): boolean {
  const community = getCommunity(db, communityId);
  if (!community) return false;
  const policy = communityTransportPolicy(community.descriptor);
  const revision = community.descriptor.revision;

  const latest = db.query<{ policy: string; revision: number }>(
    'SELECT policy, revision FROM cm_policy_history WHERE community_id = ? ORDER BY revision DESC, recorded_at DESC LIMIT 1',
    [communityId],
  )[0];

  if (!latest) {
    db.execute(
      `INSERT OR IGNORE INTO cm_policy_history (id, community_id, policy, previous_policy, revision, recorded_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [`${communityId}:${revision}`, communityId, policy, revision, now],
    );
    return true;
  }

  const previousPolicy = readPolicy(latest.policy);
  if (previousPolicy === policy) return false;
  db.execute(
    `INSERT OR IGNORE INTO cm_policy_history (id, community_id, policy, previous_policy, revision, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`${communityId}:${revision}`, communityId, policy, previousPolicy, revision, now],
  );
  return true;
}

/** Reconcile the policy ledger for every community this device holds. */
export function reconcileCommunityPolicyHistory(
  db: DatabaseAdapter,
  now: string = new Date().toISOString(),
): number {
  let written = 0;
  for (const community of listCommunities(db)) {
    if (recordCommunityPolicyPoint(db, community.descriptor.communityId, now)) written += 1;
  }
  return written;
}

/** The full observed policy ledger for a community, newest first. */
export function listCommunityPolicyHistory(db: DatabaseAdapter, communityId: string): PolicyHistoryRow[] {
  return db
    .query<{ id: string; community_id: string; policy: string; previous_policy: string | null; revision: number; recorded_at: string }>(
      'SELECT * FROM cm_policy_history WHERE community_id = ? ORDER BY revision DESC, recorded_at DESC',
      [communityId],
    )
    .map((r) => ({
      id: r.id,
      communityId: r.community_id,
      policy: readPolicy(r.policy) ?? 'local_only',
      previousPolicy: readPolicy(r.previous_policy),
      revision: r.revision,
      recordedAt: r.recorded_at,
    }));
}

/** The most recent REAL change (previous_policy not null), or null if none. */
export function getLatestPolicyChange(db: DatabaseAdapter, communityId: string): PolicyHistoryRow | null {
  return listCommunityPolicyHistory(db, communityId).find((r) => r.previousPolicy !== null) ?? null;
}
