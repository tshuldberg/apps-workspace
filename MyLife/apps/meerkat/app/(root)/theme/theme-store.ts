// Device-local theme persistence for Meerkat. Pure CRUD over a DatabaseAdapter
// so it is Node-testable (in-memory adapter) and forms the canonical SQL/CRUD
// surface the web twin (apps/meerkat-web) must mirror for parity. It imports
// only @mylife/db types and the RN-free @mylife/meerkat-theme package, NEVER an
// expo-* module, so it stays out of the native-only import graph.
//
// mk_themes + the theme_* mk_settings keys are device_local and NEVER replicate
// (mk_ tables sit outside the sync prefix map). No sync policy, no maxScope.

import type { DatabaseAdapter } from '@mylife/db';
import {
  DEFAULT_PRESET_ID,
  OPEN_BURROW,
  getPreset,
  validateThemeProfile,
  type MkThemeProfile,
} from '@mylife/meerkat-theme';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeSource = 'custom' | 'imported' | 'generated';

export const THEME_ACTIVE_ID_KEY = 'theme_active_id';
export const THEME_MODE_KEY = 'theme_mode';

export const CREATE_MK_THEMES = `
CREATE TABLE IF NOT EXISTS mk_themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  base_preset_id TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

// mk_settings is created canonically by ensureMeerkatTables; this idempotent copy
// lets ensureThemeTables stand alone in tests without pulling the native db boot.
const CREATE_MK_SETTINGS = `
CREATE TABLE IF NOT EXISTS mk_settings (
  key TEXT PRIMARY KEY,
  value TEXT
)`;

export function ensureThemeTables(db: DatabaseAdapter): void {
  db.execute(CREATE_MK_SETTINGS);
  db.execute(CREATE_MK_THEMES);
}

export interface StoredTheme {
  id: string;
  name: string;
  profile: MkThemeProfile;
  basePresetId: string | null;
  source: ThemeSource;
  createdAt: string;
  updatedAt: string;
}

interface ThemeRow {
  id: string;
  name: string;
  profile_json: string;
  base_preset_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS =
  'id, name, profile_json, base_preset_id, source, created_at, updated_at';

function isThemeSource(value: string): value is ThemeSource {
  return value === 'custom' || value === 'imported' || value === 'generated';
}

// Validate the stored JSON on every read (the row is untrusted persisted state).
// A corrupt or schema-invalid row resolves to null and is skipped, never thrown.
function rowToStored(row: ThemeRow): StoredTheme | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.profile_json);
  } catch {
    return null;
  }
  const result = validateThemeProfile(parsed);
  if (!result.success) return null;
  return {
    id: row.id,
    name: row.name,
    profile: result.profile,
    basePresetId: row.base_preset_id,
    source: isThemeSource(row.source) ? row.source : 'custom',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- mk_settings helpers (self-contained, do not import data/db.ts) ---

function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string | null }>(
    `SELECT value FROM mk_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(`INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)`, [
    key,
    value,
  ]);
}

// --- custom theme CRUD ---

export function listThemes(db: DatabaseAdapter): StoredTheme[] {
  const rows = db.query<ThemeRow>(
    `SELECT ${SELECT_COLUMNS} FROM mk_themes ORDER BY updated_at DESC`,
  );
  return rows
    .map(rowToStored)
    .filter((theme): theme is StoredTheme => theme !== null);
}

export function getStoredTheme(db: DatabaseAdapter, id: string): StoredTheme | null {
  const rows = db.query<ThemeRow>(
    `SELECT ${SELECT_COLUMNS} FROM mk_themes WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToStored(rows[0]) : null;
}

export function saveTheme(db: DatabaseAdapter, theme: StoredTheme): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_themes
       (id, name, profile_json, base_preset_id, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      theme.id,
      theme.name,
      JSON.stringify(theme.profile),
      theme.basePresetId,
      theme.source,
      theme.createdAt,
      theme.updatedAt,
    ],
  );
}

export function renameTheme(
  db: DatabaseAdapter,
  id: string,
  name: string,
  updatedAt: string,
): void {
  db.execute(`UPDATE mk_themes SET name = ?, updated_at = ? WHERE id = ?`, [
    name,
    updatedAt,
    id,
  ]);
}

export function deleteTheme(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM mk_themes WHERE id = ?`, [id]);
}

// --- active selection + mode ---

export function getActiveThemeId(db: DatabaseAdapter): string {
  return getSetting(db, THEME_ACTIVE_ID_KEY) ?? DEFAULT_PRESET_ID;
}

export function setActiveThemeId(db: DatabaseAdapter, id: string): void {
  setSetting(db, THEME_ACTIVE_ID_KEY, id);
}

export function getThemeMode(db: DatabaseAdapter): ThemeMode {
  const value = getSetting(db, THEME_MODE_KEY);
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function setThemeMode(db: DatabaseAdapter, mode: ThemeMode): void {
  setSetting(db, THEME_MODE_KEY, mode);
}

/**
 * The active theme profile: a built-in preset when the active id names one, else
 * the saved custom theme, else Open Burrow (covers a deleted/missing active id
 * and a corrupt row). Always returns a valid profile, never throws.
 */
export function resolveActiveProfile(db: DatabaseAdapter): MkThemeProfile {
  const id = getActiveThemeId(db);
  const preset = getPreset(id);
  if (preset) return preset;
  const stored = getStoredTheme(db, id);
  return stored?.profile ?? OPEN_BURROW;
}
