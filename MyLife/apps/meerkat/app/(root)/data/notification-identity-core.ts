// Per-community notification identity (Plan 38 amendment C.10), the PURE core.
//
// Two honesty rules govern this module:
//  1. A notification's VISUAL identity (title + accent) comes ONLY from a
//     VERIFIED community identity. An unknown / unverified / tombstoned identity
//     yields generic defaults; we never claim a community name or accent we did
//     not verify.
//  2. Sounds are a BUNDLED PRESET LIST only. A preset id selects a bundled sound
//     identifier (or 'default' / silent); this module never ships or references
//     audio bytes. Today the app bundles NO custom sound assets, so the only
//     truthful presets are the OS default tone and silent. When a build adds a
//     bundled sound file it also adds a preset id here; do not add an id without
//     a real asset behind it.
//
// This file is pure: it takes already-resolved data in and returns notification
// content out. The db-backed resolution (verified identity, device-local sound
// pref, mute state) lives in notification-prefs.ts, and the OS emission lives in
// background-task-registration.ts. Nothing here fires a notification.

/** A bundled sound choice. `sound` is 'default', a bundled file id, or null (silent). Never audio bytes. */
export interface NotificationSoundPreset {
  id: string;
  label: string;
  sound: string | null;
}

/**
 * The fixed bundled preset set. Honest for the current build: default tone and
 * silent only. Extend this list ONLY alongside a bundled sound asset.
 */
export const NOTIFICATION_SOUND_PRESETS: readonly NotificationSoundPreset[] = [
  { id: 'default', label: 'Default', sound: 'default' },
  { id: 'none', label: 'Silent', sound: null },
];

export const DEFAULT_NOTIFICATION_SOUND_PRESET_ID = 'default';

/** Resolve a stored id to a known preset; unknown / absent falls back to the default preset. */
export function getNotificationSoundPreset(id: string | null | undefined): NotificationSoundPreset {
  return NOTIFICATION_SOUND_PRESETS.find((preset) => preset.id === id) ?? NOTIFICATION_SOUND_PRESETS[0]!;
}

/** The verified identity fields a notification may present. Both come from verified sources only. */
export interface VerifiedCommunityIdentity {
  /** The community's owner-signed descriptor name. */
  name: string;
  /** Lowercase #rrggbb accent from the verified community identity, or null. */
  accentColor: string | null;
}

/** Device-local notification preferences for a community. */
export interface NotificationIdentityPrefs {
  /** Selected sound preset id (device-local choice). */
  soundPresetId?: string | null;
}

export interface ResolvedNotificationIdentity {
  /** Notification title: the verified community name, or a generic label when unverified. */
  title: string;
  /** Android accent color (#rrggbb) from the verified identity, or null. */
  accentColor: string | null;
  /** The resolved sound preset (always a member of NOTIFICATION_SOUND_PRESETS). */
  soundPreset: NotificationSoundPreset;
}

export const GENERIC_NOTIFICATION_TITLE = 'New messages';

/**
 * Resolve the notification identity from a VERIFIED community identity and the
 * device-local prefs. A null identity (unknown / unverified) yields the generic
 * title and no accent. The sound preset is a device-local choice and is honored
 * regardless of verification (it is the user's own preference, not a claim about
 * the community).
 */
export function resolveNotificationIdentity(input: {
  identity: VerifiedCommunityIdentity | null;
  prefs?: NotificationIdentityPrefs;
}): ResolvedNotificationIdentity {
  const soundPreset = getNotificationSoundPreset(input.prefs?.soundPresetId);
  const name = input.identity?.name.trim() ?? '';
  const verified = Boolean(input.identity) && name.length > 0;
  return {
    title: verified ? name : GENERIC_NOTIFICATION_TITLE,
    accentColor: verified ? input.identity!.accentColor : null,
    soundPreset,
  };
}

/** One community's real applied-message tally plus its resolved identity + prefs. */
export interface CommunityNotificationInput {
  communityId: string;
  /** Real channel events applied for this community THIS run (never a fabricated count). */
  applied: number;
  /** Verified identity for this community, or null when unknown / unverified. */
  identity: VerifiedCommunityIdentity | null;
  /** Device-local sound choice for this community. */
  prefs?: NotificationIdentityPrefs;
  /** Device-local mute state (existing community mute). Muted communities never notify. */
  muted?: boolean;
}

/** Ready-to-emit notification content. `sound`: 'default', a bundled file id, or null (silent). */
export interface CommunityNotificationContent {
  communityId: string;
  title: string;
  body: string;
  /** Android accent color (#rrggbb), or null when unverified. */
  color: string | null;
  sound: string | null;
}

function bodyForApplied(applied: number): string {
  return applied === 1 ? '1 new message received.' : `${applied} new messages received.`;
}

/**
 * Build per-community notification content from real applied tallies. Honesty:
 * a community is skipped unless it has a REAL applied count > 0, and a muted
 * community never produces a notification. Nothing here fires; the caller emits.
 */
export function buildCommunityNotifications(
  entries: readonly CommunityNotificationInput[],
): CommunityNotificationContent[] {
  const out: CommunityNotificationContent[] = [];
  for (const entry of entries) {
    if (entry.applied <= 0) continue; // applied > 0 ONLY.
    if (entry.muted) continue; // muted communities never notify.
    const resolved = resolveNotificationIdentity({ identity: entry.identity, prefs: entry.prefs });
    out.push({
      communityId: entry.communityId,
      title: resolved.title,
      body: bodyForApplied(entry.applied),
      color: resolved.accentColor,
      sound: resolved.soundPreset.sound,
    });
  }
  return out;
}
