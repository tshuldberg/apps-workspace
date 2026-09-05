import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { OPEN_BURROW, SOCIAL, type MkThemeProfile } from '@mylife/meerkat-theme';
import {
  CREATE_MK_THEMES,
  deleteTheme,
  ensureThemeTables,
  getActiveThemeId,
  getStoredTheme,
  getThemeMode,
  listThemes,
  renameTheme,
  resolveActiveProfile,
  saveTheme,
  setActiveThemeId,
  setThemeMode,
  type StoredTheme,
} from '../(root)/theme/theme-store';

function customTheme(id: string, name: string): StoredTheme {
  const profile: MkThemeProfile = { ...OPEN_BURROW, id, name };
  return {
    id,
    name,
    profile,
    basePresetId: 'open-burrow',
    source: 'custom',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('theme-store', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    ensureThemeTables(db.adapter);
  });

  afterEach(() => {
    db.close();
  });

  it('round-trips a custom theme through save/get', () => {
    const t = customTheme('c1', 'Mine');
    saveTheme(db.adapter, t);
    const got = getStoredTheme(db.adapter, 'c1');
    expect(got).not.toBeNull();
    expect(got?.name).toBe('Mine');
    expect(got?.source).toBe('custom');
    expect(got?.basePresetId).toBe('open-burrow');
    expect(got?.profile.id).toBe('c1');
  });

  it('lists themes most-recently-updated first and skips corrupt rows', () => {
    saveTheme(db.adapter, { ...customTheme('a', 'A'), updatedAt: '2026-01-01T00:00:00.000Z' });
    saveTheme(db.adapter, { ...customTheme('b', 'B'), updatedAt: '2026-02-01T00:00:00.000Z' });
    // A row with an invalid profile must be silently skipped (validate-on-read).
    db.adapter.execute(
      `INSERT INTO mk_themes (id, name, profile_json, base_preset_id, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['bad', 'Bad', '{"version":1,"id":"bad","name":"Bad","light":{"primary":{"accent":"red"}}}', null, 'custom', 'x', 'x'],
    );
    const ids = listThemes(db.adapter).map((t) => t.id);
    expect(ids).toEqual(['b', 'a']);
  });

  it('renames and deletes a theme', () => {
    saveTheme(db.adapter, customTheme('c1', 'Mine'));
    renameTheme(db.adapter, 'c1', 'Renamed', '2026-03-01T00:00:00.000Z');
    expect(getStoredTheme(db.adapter, 'c1')?.name).toBe('Renamed');
    deleteTheme(db.adapter, 'c1');
    expect(getStoredTheme(db.adapter, 'c1')).toBeNull();
  });

  it('defaults active id to open-burrow and mode to system, then persists changes', () => {
    expect(getActiveThemeId(db.adapter)).toBe('open-burrow');
    expect(getThemeMode(db.adapter)).toBe('system');
    setActiveThemeId(db.adapter, 'social');
    setThemeMode(db.adapter, 'dark');
    expect(getActiveThemeId(db.adapter)).toBe('social');
    expect(getThemeMode(db.adapter)).toBe('dark');
  });

  it('rejects an out-of-range mode value and falls back to system', () => {
    db.adapter.execute(`INSERT OR REPLACE INTO mk_settings (key, value) VALUES ('theme_mode', 'bogus')`);
    expect(getThemeMode(db.adapter)).toBe('system');
  });

  describe('resolveActiveProfile', () => {
    it('returns the Open Burrow preset by default', () => {
      expect(resolveActiveProfile(db.adapter).id).toBe('open-burrow');
    });

    it('returns a built-in preset when the active id names one', () => {
      setActiveThemeId(db.adapter, 'social');
      expect(resolveActiveProfile(db.adapter)).toEqual(SOCIAL);
    });

    it('returns a saved custom theme when active', () => {
      saveTheme(db.adapter, customTheme('c1', 'Mine'));
      setActiveThemeId(db.adapter, 'c1');
      expect(resolveActiveProfile(db.adapter).id).toBe('c1');
    });

    it('falls back to Open Burrow when the active custom theme is missing/deleted', () => {
      setActiveThemeId(db.adapter, 'ghost');
      expect(resolveActiveProfile(db.adapter).id).toBe('open-burrow');
    });
  });

  it('exposes a stable mk_themes DDL string', () => {
    expect(CREATE_MK_THEMES).toContain('CREATE TABLE IF NOT EXISTS mk_themes');
  });
});
