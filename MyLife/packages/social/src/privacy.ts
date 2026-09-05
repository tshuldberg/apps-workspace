/**
 * @mylife/social -- Privacy settings and opt-in flow utilities.
 *
 * Privacy model:
 * 1. Users start with NO social presence (no profile = invisible)
 * 2. Creating a profile is explicit opt-in
 * 3. Default privacy: not discoverable, no auto-posting, followers-only visibility
 * 4. Each module has independent privacy controls
 * 5. Users can delete their social profile at any time (hard delete, not soft)
 */

import type { ModuleId } from '@mylife/module-registry';
import type { PrivacySettings, ModulePrivacySetting, Visibility } from './types';
import { DEFAULT_PRIVACY_SETTINGS } from './types';
import { getSocialClient } from './client-store';

// ── Privacy Helpers ───────────────────────────────────────────────────

/**
 * Check if a module has auto-posting enabled in the user's privacy settings.
 * Returns false if the user has no profile or the module has no setting.
 */
export function isAutoPostEnabled(
  settings: PrivacySettings,
  moduleId: ModuleId,
): boolean {
  const moduleSetting = settings.moduleSettings.find((s) => s.moduleId === moduleId);
  return moduleSetting?.autoPost ?? false;
}

/**
 * Get the default visibility for a module's activities.
 * Falls back to 'followers' if no module-specific setting exists.
 */
export function getModuleVisibility(
  settings: PrivacySettings,
  moduleId: ModuleId,
): Visibility {
  const moduleSetting = settings.moduleSettings.find((s) => s.moduleId === moduleId);
  return moduleSetting?.defaultVisibility ?? 'followers';
}

/**
 * Create or update a module's privacy setting within the settings blob.
 * Returns a new PrivacySettings object (does not mutate the input).
 */
export function setModulePrivacy(
  settings: PrivacySettings,
  moduleId: ModuleId,
  update: Partial<Omit<ModulePrivacySetting, 'moduleId'>>,
): PrivacySettings {
  const existing = settings.moduleSettings.find((s) => s.moduleId === moduleId);
  const updated: ModulePrivacySetting = {
    moduleId,
    autoPost: update.autoPost ?? existing?.autoPost ?? false,
    defaultVisibility: update.defaultVisibility ?? existing?.defaultVisibility ?? 'followers',
  };

  return {
    ...settings,
    moduleSettings: [
      ...settings.moduleSettings.filter((s) => s.moduleId !== moduleId),
      updated,
    ],
  };
}

/**
 * Enable auto-posting for a module. Shorthand for setModulePrivacy.
 */
export function enableAutoPost(
  settings: PrivacySettings,
  moduleId: ModuleId,
  visibility: Visibility = 'followers',
): PrivacySettings {
  return setModulePrivacy(settings, moduleId, {
    autoPost: true,
    defaultVisibility: visibility,
  });
}

/**
 * Disable auto-posting for a module. Shorthand for setModulePrivacy.
 */
export function disableAutoPost(
  settings: PrivacySettings,
  moduleId: ModuleId,
): PrivacySettings {
  return setModulePrivacy(settings, moduleId, {
    autoPost: false,
  });
}

/**
 * Generate the default privacy settings for a new social profile.
 * Everything starts restrictive (opt-in).
 */
export function createDefaultPrivacySettings(): PrivacySettings {
  return { ...DEFAULT_PRIVACY_SETTINGS, moduleSettings: [] };
}

// ── Opt-in / Opt-out Flow ─────────────────────────────────────────────

/**
 * Check if the current user has opted into social features.
 * This is the primary gate: modules should check this before showing social UI.
 */
export async function isSocialOptedIn(): Promise<boolean> {
  const client = getSocialClient();
  if (!client) return false;

  const result = await client.hasProfile();
  return result.ok ? result.data : false;
}

/**
 * Delete the current user's social profile and all associated data.
 * This is a hard delete: profile, activities, kudos, follows, memberships.
 * The Supabase CASCADE constraints handle the cascading deletes.
 */
export async function optOutOfSocial(): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSocialClient();
  if (!client) return { ok: false, error: 'Social client not initialized' };

  const profileResult = await client.getMyProfile();
  if (!profileResult.ok) return { ok: false, error: profileResult.error };
  if (!profileResult.data) return { ok: true }; // Already opted out

  const deleteResult = await client.deleteMyProfile();
  if (!deleteResult.ok) return { ok: false, error: deleteResult.error };

  return { ok: true };
}

// ── Privacy Validation ────────────────────────────────────────────────

/**
 * Validate that a user's privacy settings are well-formed.
 * Returns a list of issues found (empty = valid).
 */
export function validatePrivacySettings(settings: PrivacySettings): string[] {
  const issues: string[] = [];

  // Check for duplicate module settings
  const moduleIds = settings.moduleSettings.map((s) => s.moduleId);
  const uniqueIds = new Set(moduleIds);
  if (uniqueIds.size !== moduleIds.length) {
    issues.push('Duplicate module privacy settings found');
  }

  return issues;
}
