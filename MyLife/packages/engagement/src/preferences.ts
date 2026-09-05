/**
 * Engagement preference helpers.
 *
 * All engagement features are opt-in via hub_preferences.
 * Default: all disabled until the user explicitly enables them.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getPreference, setPreference } from '@mylife/db';
import { ENGAGEMENT_PREF_KEYS } from './types';

/** Check if the streak feature is enabled. Default: false. */
export function isStreakEnabled(db: DatabaseAdapter): boolean {
  return getPreference(db, ENGAGEMENT_PREF_KEYS.streakEnabled) === 'true';
}

/** Check if the weekly digest is enabled. Default: false. */
export function isDigestEnabled(db: DatabaseAdapter): boolean {
  return getPreference(db, ENGAGEMENT_PREF_KEYS.digestEnabled) === 'true';
}

/** Check if "This Day Last Year" is enabled. Default: false. */
export function isMemoryEnabled(db: DatabaseAdapter): boolean {
  return getPreference(db, ENGAGEMENT_PREF_KEYS.memoryEnabled) === 'true';
}

/** Enable or disable the streak feature. */
export function setStreakEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setPreference(db, ENGAGEMENT_PREF_KEYS.streakEnabled, String(enabled));
}

/** Enable or disable the weekly digest. */
export function setDigestEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setPreference(db, ENGAGEMENT_PREF_KEYS.digestEnabled, String(enabled));
}

/** Enable or disable "This Day Last Year". */
export function setMemoryEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setPreference(db, ENGAGEMENT_PREF_KEYS.memoryEnabled, String(enabled));
}

/** Get the preferred digest day (0=Sunday, 1=Monday, ...). Default: 1 (Monday). */
export function getDigestDay(db: DatabaseAdapter): number {
  const val = getPreference(db, ENGAGEMENT_PREF_KEYS.digestDay);
  if (val == null) return 1;
  const num = parseInt(val, 10);
  return num >= 0 && num <= 6 ? num : 1;
}

/** Set the preferred digest day. */
export function setDigestDay(db: DatabaseAdapter, day: number): void {
  const clamped = Math.max(0, Math.min(6, Math.round(day)));
  setPreference(db, ENGAGEMENT_PREF_KEYS.digestDay, String(clamped));
}
