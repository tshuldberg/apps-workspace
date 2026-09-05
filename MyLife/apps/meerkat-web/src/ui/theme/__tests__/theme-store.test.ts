import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { OPEN_BURROW, SOCIAL, type MkThemeProfile } from '@mylife/meerkat-theme';
import {
  deleteTheme,
  ensureThemeTables,
  getActiveThemeId,
  getStoredTheme,
  getThemeMode,
  listThemes,
  resolveActiveProfile,
  saveTheme,
  setActiveThemeId,
  setThemeMode,
  type StoredTheme,
} from '../theme-store';

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

// The web store is a verbatim mirror of mobile; this confirms the shared SQL/CRUD
// surface behaves identically against an in-memory adapter.
describe('theme-store (web twin)', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    ensureThemeTables(db.adapter);
  });

  afterEach(() => db.close());

  it('round-trips a custom theme and lists it', () => {
    saveTheme(db.adapter, customTheme('c1', 'Mine'));
    expect(getStoredTheme(db.adapter, 'c1')?.name).toBe('Mine');
    expect(listThemes(db.adapter).map((t) => t.id)).toEqual(['c1']);
  });

  it('defaults active to open-burrow and mode to system, persists changes', () => {
    expect(getActiveThemeId(db.adapter)).toBe('open-burrow');
    expect(getThemeMode(db.adapter)).toBe('system');
    setActiveThemeId(db.adapter, 'social');
    setThemeMode(db.adapter, 'dark');
    expect(getActiveThemeId(db.adapter)).toBe('social');
    expect(getThemeMode(db.adapter)).toBe('dark');
  });

  it('resolveActiveProfile: preset, custom, and Open Burrow fallback', () => {
    expect(resolveActiveProfile(db.adapter).id).toBe('open-burrow');
    setActiveThemeId(db.adapter, 'social');
    expect(resolveActiveProfile(db.adapter)).toEqual(SOCIAL);
    saveTheme(db.adapter, customTheme('c1', 'Mine'));
    setActiveThemeId(db.adapter, 'c1');
    expect(resolveActiveProfile(db.adapter).id).toBe('c1');
    deleteTheme(db.adapter, 'c1');
    expect(resolveActiveProfile(db.adapter).id).toBe('open-burrow');
  });
});
