// presence-core.ts: the device-local opt-in + honest read model for community
// presence (Plan 29 P6, "Appear online"). The cryptography (signed beacons,
// verification, freshness, member counting) lives entirely in @mylife/sync
// (presence-beacon.ts); this file owns only the device-local opt-in preference
// and the honest UI strings. Pure: takes a DatabaseAdapter, no native modules.
//
// Honesty boundary (Critical):
//   - "Appear online" is OPT-IN and OFF by default; nothing auto-flips it (NC-4).
//   - The member count comes ONLY from presenceCounts (real signed, fresh,
//     in-roster beacons this device has actually received). A forged, expired,
//     or non-member beacon never counts. Zero renders as an honest "no one",
//     never a fabricated number.
//   - Beacon SHARING over the network (parking my beacon to peers + applying
//     received beacons in the drain) is a separate engine round seam. Until it
//     lands, this toggle records the preference only; the copy says so plainly
//     and never claims a peer can currently see this device.

import type { DatabaseAdapter } from '@mylife/db';
import {
  presenceCounts,
  signPresenceBeacon,
  sealPresenceBeacon,
  type PresenceMember,
  type PresenceBeacon,
  type DeviceIdentity,
  type MailboxEnvelope,
} from '@mylife/sync';
import { getSetting, setSetting } from './db';

/**
 * Device-local opt-in flag for sharing presence, keyed PER COMMUNITY (Plan 29
 * per-user per-community, spec lines 28/279/322). Default OFF for every
 * community; there is no global master. `mk_settings` key: `appear_online:<id>`.
 */
export const PRESENCE_APPEAR_ONLINE_KEY_PREFIX = 'appear_online:';

/** The per-community mk_settings key for the appear-online opt-in. */
export function presenceAppearOnlineKey(communityId: string): string {
  return `${PRESENCE_APPEAR_ONLINE_KEY_PREFIX}${communityId}`;
}

/** Whether the user opted into appearing online IN THIS COMMUNITY. Default OFF. */
export function isAppearOnlineEnabled(db: DatabaseAdapter, communityId: string): boolean {
  return getSetting(db, presenceAppearOnlineKey(communityId)) === '1';
}

/**
 * Set the appear-online opt-in for ONE community. This is the ONLY writer of the
 * flag (NC-4). Each community is independent; opting into one never opts into
 * another.
 */
export function setAppearOnlineEnabled(db: DatabaseAdapter, communityId: string, enabled: boolean): void {
  setSetting(db, presenceAppearOnlineKey(communityId), enabled ? '1' : '0');
}

export interface CommunityPresenceView {
  /** Members OTHER than this device appearing online right now (real beacons only). */
  otherCount: number;
  /** The honest one-line summary for the community surface. */
  label: string;
  members: PresenceMember[];
}

/**
 * Build the honest presence view for a community: the real count of OTHER
 * members appearing online (self excluded), plus an honest label. Reads only
 * verified fresh beacons via presenceCounts; zero renders as "No one is
 * appearing online right now."
 */
export function communityPresenceView(
  db: DatabaseAdapter,
  communityId: string,
  selfDeviceId: string,
  nowMs: number = Date.now(),
): CommunityPresenceView {
  const result = presenceCounts(db, communityId, nowMs);
  const others = result.members.filter((m) => m.deviceId !== selfDeviceId);
  return {
    otherCount: others.length,
    members: others,
    label: describeCommunityPresence(others.length),
  };
}

/** Requested presence beacon TTL (30 min): comfortably under PRESENCE_MAX_TTL. */
export const PRESENCE_BEACON_TTL_SECONDS = 30 * 60;

export interface PresenceEmitCommunity {
  communityId: string;
  /** deviceIds in the community's SIGNED roster. */
  memberDeviceIds: string[];
  /** Whether this community's transport policy permits relay (Plan 27). */
  relayAllowed: boolean;
  /** Whether the user opted into appearing online IN THIS community (default OFF). */
  appearOnline: boolean;
}

export interface PresenceEmitPeer {
  deviceId: string;
  dhPublicKey: string | null;
  pairSharedSecretHex: string | null;
  isActive: boolean;
  revoked: boolean;
}

export interface PresenceEmitTarget {
  communityId: string;
  recipientDeviceId: string;
  recipientDhPublicKey: string;
  pairSharedSecretHex: string;
}

/**
 * Plan which presence beacons to emit this round. For each community the user is
 * a signed member of AND whose transport policy allows relay, emit one beacon to
 * every OTHER member who is a paired, active, non-revoked peer with a resolvable
 * pair secret + DH key. Empty when appear-online is off. Pure: no crypto, no IO;
 * the caller signs + seals + parks each target. Never emits to a non-member,
 * self, a revoked/inactive peer, or over a relay a local_only community forbids.
 */
export function planPresenceEmission(input: {
  selfDeviceId: string;
  communities: PresenceEmitCommunity[];
  pairedPeers: PresenceEmitPeer[];
}): PresenceEmitTarget[] {
  const peerById = new Map(input.pairedPeers.map((p) => [p.deviceId, p]));
  const targets: PresenceEmitTarget[] = [];
  for (const community of input.communities) {
    // PER-COMMUNITY opt-in: emit only for communities the user turned on.
    if (!community.appearOnline) continue;
    if (!community.relayAllowed) continue;
    // Only emit if this device is itself a member of the community.
    if (!community.memberDeviceIds.includes(input.selfDeviceId)) continue;
    for (const memberId of community.memberDeviceIds) {
      if (memberId === input.selfDeviceId) continue;
      const peer = peerById.get(memberId);
      if (!peer || peer.revoked || !peer.isActive) continue;
      if (!peer.dhPublicKey || !peer.pairSharedSecretHex) continue;
      targets.push({
        communityId: community.communityId,
        recipientDeviceId: peer.deviceId,
        recipientDhPublicKey: peer.dhPublicKey,
        pairSharedSecretHex: peer.pairSharedSecretHex,
      });
    }
  }
  return targets;
}

/**
 * Sign + seal + park a presence beacon for each planned target (one signed
 * beacon per community, sealed per recipient). The park is injected (the relay
 * transport is surface-specific). Returns the number of beacons actually parked.
 * Honest: parks nothing when there are no targets (appear-online off or no
 * reachable co-member peer); a park that fails is not counted.
 */
export async function emitPresenceBeacons(input: {
  identity: DeviceIdentity;
  targets: PresenceEmitTarget[];
  ttlSeconds?: number;
  now?: number;
  park: (token: string, envelope: MailboxEnvelope) => Promise<boolean>;
}): Promise<number> {
  const now = input.now ?? Date.now();
  const ttl = input.ttlSeconds ?? PRESENCE_BEACON_TTL_SECONDS;
  const beaconByCommunity = new Map<string, PresenceBeacon>();
  let parked = 0;
  for (const target of input.targets) {
    let beacon = beaconByCommunity.get(target.communityId);
    if (!beacon) {
      beacon = signPresenceBeacon(input.identity, {
        communityId: target.communityId,
        issuedAt: now,
        ttlSeconds: ttl,
      });
      beaconByCommunity.set(target.communityId, beacon);
    }
    const sealed = sealPresenceBeacon({
      sender: input.identity,
      recipient: { deviceId: target.recipientDeviceId, dhPublicKey: target.recipientDhPublicKey },
      pairSharedSecretHex: target.pairSharedSecretHex,
      beacon,
    });
    if (await input.park(sealed.token, sealed.envelope)) parked += 1;
  }
  return parked;
}

/** Honest presence summary string. Never invents activity. */
export function describeCommunityPresence(otherCount: number): string {
  if (otherCount <= 0) return 'No one is appearing online right now.';
  if (otherCount === 1) return '1 member appearing online.';
  return `${otherCount} members appearing online.`;
}

/**
 * Honest copy for the Settings toggle. Because beacon sharing over the network
 * is not yet wired into the sync round, the toggle records the preference only;
 * this must be stated so the control never implies live visibility.
 */
export const APPEAR_ONLINE_COPY = {
  title: 'Appear online',
  hint:
    'Let members of THIS community you sync with see you are active. This is off by default '
    + 'per community and only ever shares a short-lived signed beacon, never your location or '
    + 'activity. Turning it on here does not affect any other community.',
  seamNotice:
    'Presence rides your normal sync rounds: while you are opted in, each sync parks a '
    + 'short-lived signed beacon to members you are connected to, and you see theirs after a '
    + 'sync. Nothing is shared with anyone you have not synced with, and every beacon expires '
    + 'on its own. The count below shows only real signed beacons this device has received.',
} as const;
