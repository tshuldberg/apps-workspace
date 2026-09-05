// Device-local notification prefs + verified-identity resolver (Plan 38 C.10).
//
// The sound choice is a per-community, per-DEVICE mk_settings value under
// `notification_sound:<communityId>`. mk_ settings are outside the sync prefix
// map, so this choice NEVER replicates. The resolver pulls the notification's
// visual identity from VERIFIED sources only: the owner-signed descriptor name
// and the verified community identity accent (getCommunityIdentity).

import type { DatabaseAdapter } from '@mylife/db';
import { getCommunity } from '@mylife/sync';
import { getSetting, setSetting } from './db';
import { getCommunityIdentity } from './community-core';
import {
  getNotificationSoundPreset,
  type VerifiedCommunityIdentity,
} from './notification-identity-core';

const NOTIFICATION_SOUND_KEY_PREFIX = 'notification_sound:';

function soundKey(communityId: string): string {
  return `${NOTIFICATION_SOUND_KEY_PREFIX}${communityId}`;
}

/** The device-local sound preset id for a community, normalized to a known preset id. */
export function getCommunityNotificationSoundId(db: DatabaseAdapter, communityId: string): string {
  return getNotificationSoundPreset(getSetting(db, soundKey(communityId))).id;
}

/** Persist the device-local sound preset id for a community (normalized to a known preset). */
export function setCommunityNotificationSoundId(
  db: DatabaseAdapter,
  communityId: string,
  presetId: string,
): void {
  setSetting(db, soundKey(communityId), getNotificationSoundPreset(presetId).id);
}

/**
 * Resolve the VERIFIED identity a notification may present for a community, or
 * null when the community is not on this device. The name is the owner-signed
 * descriptor name; the accent comes from the verified identity (null when none
 * or tombstoned).
 */
export function resolveVerifiedCommunityIdentity(
  db: DatabaseAdapter,
  communityId: string,
): VerifiedCommunityIdentity | null {
  const community = getCommunity(db, communityId);
  if (!community) return null;
  const identity = getCommunityIdentity(db, communityId);
  return {
    name: community.descriptor.name,
    accentColor: identity && !identity.tombstone ? identity.accentColor : null,
  };
}
