/**
 * CRUD operations for hub_theme_profiles plus theme-related hub_settings
 * keys (active theme id, match system, animate transitions).
 *
 * All queries use parameterized SQL (no string interpolation).
 */

import type { DatabaseAdapter } from './adapter';

export type ThemeProfileSource = 'user' | 'imported' | 'ai-generated';

export interface ThemeProfileRow {
  id: string;
  name: string;
  json: string;
  source: ThemeProfileSource;
  created_at: string;
  updated_at: string;
}

export interface SaveThemeProfileInput {
  id: string;
  name: string;
  json: string;
  source?: ThemeProfileSource;
}

// ---------------------------------------------------------------------------
// hub_theme_profiles
// ---------------------------------------------------------------------------

/** Upsert a theme profile. Bumps updated_at on replace. */
export function saveThemeProfile(
  db: DatabaseAdapter,
  profile: SaveThemeProfileInput,
): void {
  const source: ThemeProfileSource = profile.source ?? 'user';
  db.execute(
    `INSERT INTO hub_theme_profiles (id, name, json, source, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       json = excluded.json,
       source = excluded.source,
       updated_at = datetime('now')`,
    [profile.id, profile.name, profile.json, source],
  );
}

/** Get a single theme profile by id. Returns null if not found. */
export function getThemeProfile(
  db: DatabaseAdapter,
  id: string,
): ThemeProfileRow | null {
  const rows = db.query<ThemeProfileRow>(
    `SELECT id, name, json, source, created_at, updated_at
     FROM hub_theme_profiles
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

/** List all theme profiles, newest first. */
export function listThemeProfiles(db: DatabaseAdapter): ThemeProfileRow[] {
  return db.query<ThemeProfileRow>(
    `SELECT id, name, json, source, created_at, updated_at
     FROM hub_theme_profiles
     ORDER BY created_at DESC`,
  );
}

/** Delete a theme profile by id. No-op if missing. */
export function deleteThemeProfile(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM hub_theme_profiles WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Theme-related hub_settings keys
// ---------------------------------------------------------------------------

const ACTIVE_THEME_ID_KEY = 'active_theme_id';

export type ThemeSettingKey = 'theme_match_system' | 'theme_animate_transitions';

/** Get the active theme id, or null if unset. */
export function getActiveThemeId(db: DatabaseAdapter): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM hub_settings WHERE key = ?`,
    [ACTIVE_THEME_ID_KEY],
  );
  return rows[0]?.value ?? null;
}

/** Set the active theme id. */
export function setActiveThemeId(db: DatabaseAdapter, themeId: string): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_settings (key, value) VALUES (?, ?)`,
    [ACTIVE_THEME_ID_KEY, themeId],
  );
}

/** Get a boolean theme setting. Defaults to false when unset. */
export function getThemeSetting(
  db: DatabaseAdapter,
  key: ThemeSettingKey,
): boolean {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM hub_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value === '1';
}

/** Set a boolean theme setting ('0' or '1'). */
export function setThemeSetting(
  db: DatabaseAdapter,
  key: ThemeSettingKey,
  value: boolean,
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_settings (key, value) VALUES (?, ?)`,
    [key, value ? '1' : '0'],
  );
}
