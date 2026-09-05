/**
 * Community descriptor gossip over a session (Plan 28; shared with Plan 27).
 *
 * Until now a signed descriptor REVISION (a member removal, a host change, a
 * channel edit) reached already-joined members only if they re-joined. This is the
 * epidemic transport for descriptor revisions, cloned from revocation-gossip.ts:
 * when two devices share a connection, each sends the current signed descriptor of
 * every community it holds and applies the peer's. A newer, owner-signed,
 * chain-valid revision spreads to every connected member within a gossip round.
 *
 * Authorization is fail-closed and reuses the shipped guards:
 *   - Gossip only REFRESHES a community this device already holds (never
 *     introduces a new one -- joining is via invite, not gossip).
 *   - A record applies only if its revision is strictly newer than the local one
 *     (monotonic) AND verifyCommunityDescriptor passes against the local
 *     predecessor (owner signature + chain hash + stable id). A forged, older, or
 *     replayed descriptor is dropped.
 *
 * The member-removal MAILBOX (member-removal-mailbox.ts) is the PRIMARY, direct,
 * per-survivor delivery for a removal (it also carries the new epoch key wraps);
 * this gossip is a secondary backfill so a member who missed the mailbox still
 * converges on the roster the next time it shares any session.
 *
 * Self-framed (its own tiny JSON frame) so it can run standalone or fold into a
 * session without entangling the session state machine. No new crypto.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, SyncTransport, TransportConnection } from '../types';
import {
  communityTransportPolicy,
  getCommunity,
  listCommunities,
  reconcileCommunityRosterFromDescriptor,
  transportPolicyAllows,
  upsertCommunity,
  verifyCommunityDescriptor,
  type SignedCommunityDescriptor,
} from './community';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface DescriptorGossipFrame {
  t: 'gossip-desc';
  records: SignedCommunityDescriptor[];
}

function encodeFrame(records: SignedCommunityDescriptor[]): Uint8Array {
  return encoder.encode(JSON.stringify({ t: 'gossip-desc', records } satisfies DescriptorGossipFrame));
}

function decodeFrame(data: Uint8Array): DescriptorGossipFrame | null {
  try {
    const parsed = JSON.parse(decoder.decode(data)) as DescriptorGossipFrame;
    return parsed?.t === 'gossip-desc' && Array.isArray(parsed.records) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The current signed descriptor of every community this device holds, ready to
 * forward. When `transport` is given (Plan 27), a community whose SIGNED policy
 * forbids that transport is excluded: a local_only community's descriptor is
 * itself metadata the policy covers, so its gossip rides local sessions only.
 *
 * When `peerDeviceId` is given, only communities whose CURRENT descriptor lists
 * that device as a member are included (privacy: a descriptor embeds the full
 * member roster, so gossiping every held community to a paired peer would leak
 * the membership of communities the peer is NOT in -- and a non-member drops
 * them on apply anyway, so the filter is convergence-lossless). A device removed
 * in a newer revision is absent from that descriptor's members, so it also stops
 * receiving post-removal descriptors here. Omit `peerDeviceId` for the
 * "everything I hold" collection (local snapshot / tests).
 */
export function collectDescriptorRecords(
  db: DatabaseAdapter,
  transport?: SyncTransport,
  peerDeviceId?: string,
): SignedCommunityDescriptor[] {
  return listCommunities(db)
    .filter((c) => !transport || transportPolicyAllows(communityTransportPolicy(c.descriptor), transport))
    .filter((c) => !peerDeviceId || c.descriptor.members.some((m) => m.deviceId === peerDeviceId))
    .map((c) => ({ descriptor: c.descriptor, signature: c.signature }));
}

/**
 * Apply a batch of gossiped descriptor records; returns how many newly took
 * effect. Fail-closed: only a KNOWN community is refreshed, only by a strictly
 * newer revision that verifies (owner signature + chain) against the local
 * predecessor. Older / replayed / forged / unknown-community records are dropped.
 */
export function applyGossipedDescriptors(
  db: DatabaseAdapter,
  records: readonly SignedCommunityDescriptor[],
  myDeviceId: string,
  now: string = new Date().toISOString(),
  transport?: SyncTransport,
): number {
  let applied = 0;
  for (const record of records) {
    const communityId = record?.descriptor?.communityId;
    if (typeof communityId !== 'string' || communityId.length === 0) continue;
    const existing = getCommunity(db, communityId);
    if (!existing) continue; // gossip refreshes known communities only
    // Plan 27, symmetric fail-closed: a community whose LOCALLY stored policy
    // forbids this transport does not update over it -- not even its own
    // descriptor (its metadata is covered by the promise). A HARDENING
    // revision still applies over a permitted transport as usual.
    if (transport && !transportPolicyAllows(communityTransportPolicy(existing.descriptor), transport)) {
      continue;
    }
    if (record.descriptor.revision <= existing.descriptor.revision) continue; // monotonic
    if (!verifyCommunityDescriptor(record, { descriptor: existing.descriptor, signature: existing.signature })) {
      continue; // owner signature / chain / stable id failed
    }
    upsertCommunity(db, record, myDeviceId, now);
    // Reconcile the workspace roster to the NEW descriptor: a gossiped revision
    // that drops a member must close its removed_at here too (previously the
    // roster stayed open on the gossip path, so the session-auth gate still
    // treated the removed device as a member -- sprint-audit HIGH). Shared
    // helper: identical effect to the member-removal drain (AM7).
    reconcileCommunityRosterFromDescriptor(db, record.descriptor, now);
    applied += 1;
  }
  return applied;
}

export interface DescriptorGossipResult {
  sent: number;
  applied: number;
}

export type GossipRole = 'initiate' | 'respond';

export interface GossipDescriptorsOptions {
  connection: TransportConnection;
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  role: GossipRole;
  timeoutMs?: number;
}

/**
 * Run one descriptor-gossip exchange over a connection. The initiator sends first
 * then applies the peer's reply; the responder applies the peer's batch then sends
 * its own. Each side ends holding the newest revision it can verify, so the next
 * session spreads it further.
 */
export function gossipDescriptors(options: GossipDescriptorsOptions): Promise<DescriptorGossipResult> {
  const { connection, db, identity, role } = options;
  const timeoutMs = options.timeoutMs ?? 10_000;
  // Plan 27: the connection's transport gates BOTH what this side forwards and
  // what it applies (a local_only community's descriptor never rides WAN).
  // Privacy: only forward descriptors for communities the peer is a member of
  // (never leak a non-member the roster of communities it is not in).
  const mine = collectDescriptorRecords(db, connection.transport, connection.remoteDeviceId);

  return new Promise<DescriptorGossipResult>((resolve) => {
    let settled = false;
    const finish = (applied: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ sent: mine.length, applied });
    };
    const timer = setTimeout(() => finish(0), timeoutMs);
    (timer as { unref?: () => void }).unref?.();

    connection.onData((data) => {
      const frame = decodeFrame(data);
      if (!frame) return;
      const applied = applyGossipedDescriptors(
        db, frame.records, identity.publicKey, new Date().toISOString(), connection.transport,
      );
      if (role === 'respond') {
        void connection.send(encodeFrame(mine));
      }
      finish(applied);
    });

    if (role === 'initiate') {
      void connection.send(encodeFrame(mine));
    }
  });
}
