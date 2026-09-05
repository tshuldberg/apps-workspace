import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { DatabaseAdapter } from '@mylife/db';
import {
  OPEN_BURROW,
  PRESETS,
  decodeThemeBlob,
  effectiveMode,
  encodeThemeBlob,
  getPreset,
  resolveProfile,
  type MkColors,
  type MkPaletteMode,
  type MkThemeProfile,
  type MkResolvedThemeStyle, type MkThemeStyleExtras,
} from '@mylife/meerkat-theme';
import {
  deleteTheme,
  ensureThemeTables,
  getActiveThemeId,
  getThemeMode,
  listThemes,
  renameTheme,
  saveTheme,
  setActiveThemeId,
  setThemeMode,
  type StoredTheme,
  type ThemeMode,
  type ThemeSource,
} from '../theme/theme-store';

// Meerkat is a standalone app with its own palette, so it does not use the hub
// ModuleThemeProvider. This provider owns the active theme (a built-in preset OR
// a saved custom theme), the System/Light/Dark mode, and the custom-theme
// library. Screens read colors via useAppThemeColors() and build their
// StyleSheet from it, so a theme change reskins the whole app. The active theme
// is read SYNCHRONOUSLY at mount from meerkat.db so the very first frame renders
// the persisted theme with no flash to a wrong palette.

export interface ImportThemeResult {
  success: boolean;
  /** The new custom theme id on success. */
  id?: string;
  /** Honest error copy on failure (from the codec). */
  error?: string;
}

interface ThemeLibrary {
  presets: readonly MkThemeProfile[];
  customThemes: StoredTheme[];
  activeId: string;
  activeProfile: MkThemeProfile;
  themeMode: ThemeMode;
  resolvedMode: MkPaletteMode;
  setMode: (mode: ThemeMode) => void;
  applyTheme: (id: string) => void;
  saveCustomTheme: (
    profile: MkThemeProfile,
    options?: { source?: ThemeSource; basePresetId?: string | null; name?: string },
  ) => string | null;
  renameCustomTheme: (id: string, name: string) => void;
  deleteCustomTheme: (id: string) => void;
  importThemeBlob: (input: string) => ImportThemeResult;
  exportThemeBlob: (id?: string) => string | null;
}

interface AppThemeContextValue extends ThemeLibrary {
  colors: MkColors;
  mode: MkPaletteMode;
  /**
   * Plan 56 feature 1: the ACTIVE community theme's resolved extended style
   * (bubble radius, font scale, border weight, shadow, background treatment).
   * Set ONLY by CommunityThemeProvider inside a community subtree; undefined
   * everywhere else (base rendering). Rides this context so the chat kit's
   * theme seam reaches it without a second provider import (TC-4).
   */
  communityStyle?: MkResolvedThemeStyle;
  /**
   * Plan 56 features 3/4: the RAW merged style extras behind communityStyle
   * (community theme layered under any per-channel topper override), so hosts
   * can resolve per-role bubble shapes without re-deriving the theme.
   */
  communityStyleExtras?: MkThemeStyleExtras;
}

function noop(): void {
  /* no-op default outside the provider */
}

/**
 * Exported so the Plan 38 per-community theme boundary (CommunityThemeProvider)
 * can re-provide the SAME context with community colors inside a community route
 * subtree, keeping the `useAppThemeColors` / `useMkStyles` seam every screen
 * already consumes. Nothing else should provide this context directly.
 */
export const AppThemeContext = createContext<AppThemeContextValue>({
  colors: resolveProfile(OPEN_BURROW, 'light'),
  mode: 'light',
  presets: PRESETS,
  customThemes: [],
  activeId: OPEN_BURROW.id,
  activeProfile: OPEN_BURROW,
  themeMode: 'system',
  resolvedMode: 'light',
  setMode: noop,
  applyTheme: noop,
  saveCustomTheme: () => null,
  renameCustomTheme: noop,
  deleteCustomTheme: noop,
  importThemeBlob: () => ({ success: false, error: 'Theme system unavailable.' }),
  exportThemeBlob: () => null,
});

/** The raw merged community+channel style extras, or undefined outside a themed community. */
export function useCommunityStyleExtras(): MkThemeStyleExtras | undefined {
  return useContext(AppThemeContext).communityStyleExtras;
}

export function useAppThemeColors(): MkColors {
  return useContext(AppThemeContext).colors;
}

export function useAppThemeMode(): MkPaletteMode {
  return useContext(AppThemeContext).mode;
}

/** The full theme library (presets, custom themes, mode, and mutations). */
export function useThemeLibrary(): ThemeLibrary {
  return useContext(AppThemeContext);
}

/**
 * Build a themed StyleSheet from the active palette, rebuilt only when the
 * theme changes. Pass a module-level factory so its identity is stable.
 */
export function useMkStyles<T>(factory: (c: MkColors) => T): T {
  const colors = useAppThemeColors();
  return useMemo(() => factory(colors), [factory, colors]);
}

function makeThemeAdapter(db: SQLiteDatabase): DatabaseAdapter {
  return {
    execute(sql: string, params?: unknown[]): void {
      db.runSync(sql, (params ?? []) as SQLiteBindParams);
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return db.getAllSync(sql, (params ?? []) as SQLiteBindParams) as T[];
    },
    transaction(fn: () => void): void {
      db.withTransactionSync(fn);
    },
  };
}

// Run one theme DB operation against a freshly opened, immediately closed handle.
// Opening per operation (instead of holding a long-lived connection) means we
// always target the LIVE meerkat.db file, so a database reset can never leave a
// stale connection writing to an orphaned file. Theme data needs no crypto, so
// this path deliberately skips the MK-001 crypto boot. Any failure (SQLite
// unavailable, etc.) returns the fallback and never throws into render or a UI
// callback. Theme writes are rare and user-initiated, so the per-op open cost is
// negligible. Concurrent with the DatabaseProvider handle: safe under WAL +
// JS-thread serialization of the synchronous APIs.
function withThemeDb<T>(fn: (adapter: DatabaseAdapter) => T, fallback: T): T {
  let db: SQLiteDatabase | null = null;
  try {
    db = openDatabaseSync('meerkat.db');
    db.runSync('PRAGMA journal_mode=WAL;');
    const adapter = makeThemeAdapter(db);
    ensureThemeTables(adapter);
    return fn(adapter);
  } catch {
    return fallback;
  } finally {
    try {
      db?.closeSync();
    } catch {
      /* best effort */
    }
  }
}

function newThemeId(): string {
  const bytes = Crypto.getRandomBytes(16);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return `theme-${hex}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface BootState {
  activeId: string;
  themeMode: ThemeMode;
  customThemes: StoredTheme[];
}

const DEFAULT_BOOT: BootState = {
  activeId: OPEN_BURROW.id,
  themeMode: 'system',
  customThemes: [],
};

function readBoot(adapter: DatabaseAdapter): BootState {
  return {
    activeId: getActiveThemeId(adapter),
    themeMode: getThemeMode(adapter),
    customThemes: listThemes(adapter),
  };
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  // Synchronous at mount via the lazy useState initializer, so the first frame
  // renders the persisted theme. Falls back to the honest Open Burrow default if
  // the read is unavailable.
  const [boot] = useState<BootState>(() => withThemeDb(readBoot, DEFAULT_BOOT));

  const [activeId, setActiveId] = useState<string>(boot.activeId);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(boot.themeMode);
  const [customThemes, setCustomThemes] = useState<StoredTheme[]>(boot.customThemes);

  const scheme = useColorScheme();
  const systemMode: MkPaletteMode = scheme === 'dark' ? 'dark' : 'light';
  const requestedMode: MkPaletteMode = themeMode === 'system' ? systemMode : themeMode;

  const activeProfile = useMemo<MkThemeProfile>(() => {
    const preset = getPreset(activeId);
    if (preset) return preset;
    return customThemes.find((theme) => theme.id === activeId)?.profile ?? OPEN_BURROW;
  }, [activeId, customThemes]);

  const colors = useMemo(
    () => resolveProfile(activeProfile, requestedMode),
    [activeProfile, requestedMode],
  );
  const resolvedMode = effectiveMode(activeProfile, requestedMode);

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    withThemeDb((adapter) => setThemeMode(adapter, mode), undefined);
  }, []);

  const applyTheme = useCallback((id: string) => {
    setActiveId(id);
    withThemeDb((adapter) => setActiveThemeId(adapter, id), undefined);
  }, []);

  const saveCustomTheme = useCallback<ThemeLibrary['saveCustomTheme']>(
    (profile, options) => {
      const at = nowIso();
      const stored = withThemeDb<StoredTheme | null>((adapter) => {
        const id = newThemeId();
        const name = options?.name ?? profile.name;
        const row: StoredTheme = {
          id,
          name,
          profile: { ...profile, id, name },
          basePresetId: options?.basePresetId ?? profile.basePresetId ?? null,
          source: options?.source ?? 'custom',
          createdAt: at,
          updatedAt: at,
        };
        saveTheme(adapter, row);
        return row;
      }, null);
      if (!stored) return null;
      setCustomThemes((prev) => [stored, ...prev]);
      applyTheme(stored.id);
      return stored.id;
    },
    [applyTheme],
  );

  const renameCustomTheme = useCallback((id: string, name: string) => {
    const at = nowIso();
    withThemeDb((adapter) => renameTheme(adapter, id, name, at), undefined);
    setCustomThemes((prev) =>
      prev.map((theme) =>
        theme.id === id
          ? { ...theme, name, profile: { ...theme.profile, name }, updatedAt: at }
          : theme,
      ),
    );
  }, []);

  const deleteCustomTheme = useCallback(
    (id: string) => {
      withThemeDb((adapter) => deleteTheme(adapter, id), undefined);
      setCustomThemes((prev) => prev.filter((theme) => theme.id !== id));
      // Deleting the active theme falls back to Open Burrow.
      if (id === activeId) applyTheme(OPEN_BURROW.id);
    },
    [activeId, applyTheme],
  );

  const importThemeBlob = useCallback<ThemeLibrary['importThemeBlob']>(
    (input) => {
      const decoded = decodeThemeBlob(input);
      if (!decoded.success) {
        return { success: false, error: decoded.error.message };
      }
      const id = saveCustomTheme(decoded.theme, { source: 'imported' });
      if (!id) return { success: false, error: 'Could not save the imported theme.' };
      return { success: true, id };
    },
    [saveCustomTheme],
  );

  const exportThemeBlob = useCallback(
    (id?: string) => {
      const target = id
        ? getPreset(id) ?? customThemes.find((theme) => theme.id === id)?.profile
        : activeProfile;
      return target ? encodeThemeBlob(target) : null;
    },
    [activeProfile, customThemes],
  );

  const value = useMemo<AppThemeContextValue>(
    () => ({
      colors,
      mode: resolvedMode,
      presets: PRESETS,
      customThemes,
      activeId,
      activeProfile,
      themeMode,
      resolvedMode,
      setMode,
      applyTheme,
      saveCustomTheme,
      renameCustomTheme,
      deleteCustomTheme,
      importThemeBlob,
      exportThemeBlob,
    }),
    [
      colors,
      resolvedMode,
      customThemes,
      activeId,
      activeProfile,
      themeMode,
      setMode,
      applyTheme,
      saveCustomTheme,
      renameCustomTheme,
      deleteCustomTheme,
      importThemeBlob,
      exportThemeBlob,
    ],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      {children}
    </AppThemeContext.Provider>
  );
}
