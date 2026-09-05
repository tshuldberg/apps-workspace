// ThemeProvider: owns the active Meerkat theme (a built-in preset OR a saved
// custom theme), the System/Light/Dark mode, and the custom-theme library on the
// web. It applies the resolved palette as inline --mk-* custom properties on
// <html> (one path for presets and custom themes); tokens.css stays the no-JS
// Open Burrow fallback. It lives ABOVE MeerkatProvider, so the fast/durable store
// is localStorage (read synchronously so the first frame is correct). The sql.js
// mk_themes table is the durable mirror: a small bridge below MeerkatProvider
// calls bindDatabase(adapter) once the engine is ready, which reconciles both
// ways and enables write-through. Themes are device-local and never replicate.

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
} from '@mylife/meerkat-theme';
import { applyThemeVars } from './css-vars';
import {
  deleteTheme,
  ensureThemeTables,
  listThemes,
  renameTheme,
  saveTheme,
  setActiveThemeId,
  setThemeMode as dbSetThemeMode,
  type StoredTheme,
  type ThemeMode,
  type ThemeSource,
} from './theme-store';

export type { ThemeMode } from './theme-store';

const LEGACY_MODE_KEY = 'mk-theme';
const ACTIVE_KEY = 'mk-theme-active';
const MODE_KEY = 'mk-theme-mode';
const CUSTOM_KEY = 'mk-theme-custom';

export interface ImportThemeResult {
  success: boolean;
  id?: string;
  error?: string;
}

interface ThemeValue {
  /** The user's choice: follow the OS, or force a palette. */
  mode: ThemeMode;
  /** The palette actually applied right now. */
  resolved: MkPaletteMode;
  colors: MkColors;
  setMode: (mode: ThemeMode) => void;
}

interface ThemeLibrary extends ThemeValue {
  presets: readonly MkThemeProfile[];
  customThemes: StoredTheme[];
  activeId: string;
  activeProfile: MkThemeProfile;
  applyTheme: (id: string) => void;
  saveCustomTheme: (
    profile: MkThemeProfile,
    options?: { source?: ThemeSource; basePresetId?: string | null; name?: string },
  ) => string | null;
  renameCustomTheme: (id: string, name: string) => void;
  deleteCustomTheme: (id: string) => void;
  importThemeBlob: (input: string) => ImportThemeResult;
  exportThemeBlob: (id?: string) => string | null;
  /** Bind the durable sql.js store once MeerkatProvider is ready (reconcile + write-through). */
  bindDatabase: (db: DatabaseAdapter | null) => void;
}

function noop(): void {
  /* default outside the provider */
}

const ThemeContext = createContext<ThemeLibrary>({
  mode: 'system',
  resolved: 'light',
  colors: resolveProfile(OPEN_BURROW, 'light'),
  setMode: noop,
  presets: PRESETS,
  customThemes: [],
  activeId: OPEN_BURROW.id,
  activeProfile: OPEN_BURROW,
  applyTheme: noop,
  saveCustomTheme: () => null,
  renameCustomTheme: noop,
  deleteCustomTheme: noop,
  importThemeBlob: () => ({ success: false, error: 'Theme system unavailable.' }),
  exportThemeBlob: () => null,
  bindDatabase: noop,
});

// --- localStorage helpers (best effort; private mode can throw) ---

function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readStoredMode(): ThemeMode {
  const value = lsGet(MODE_KEY) ?? lsGet(LEGACY_MODE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function readStoredCustom(): StoredTheme[] {
  const raw = lsGet(CUSTOM_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredTheme[]) : [];
  } catch {
    return [];
  }
}

function osMode(): MkPaletteMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function newThemeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `theme-${crypto.randomUUID()}`;
  }
  // Browser secure contexts always have crypto.randomUUID; this is a last resort.
  const rand = typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint8Array(8)) : null;
  const hex = rand ? Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('') : '0';
  return `theme-${hex}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemMode, setSystemMode] = useState<MkPaletteMode>(osMode);
  const [activeId, setActiveIdState] = useState<string>(() => lsGet(ACTIVE_KEY) ?? OPEN_BURROW.id);
  const [customThemes, setCustomThemes] = useState<StoredTheme[]>(readStoredCustom);

  const adapterRef = useRef<DatabaseAdapter | null>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const customThemesRef = useRef(customThemes);
  customThemesRef.current = customThemes;

  // Track the OS appearance so 'system' resolves live.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => setSystemMode(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const requestedMode: MkPaletteMode = mode === 'system' ? systemMode : mode;

  const activeProfile = useMemo<MkThemeProfile>(() => {
    const preset = getPreset(activeId);
    if (preset) return preset;
    return customThemes.find((t) => t.id === activeId)?.profile ?? OPEN_BURROW;
  }, [activeId, customThemes]);

  const resolved = effectiveMode(activeProfile, requestedMode);
  const colors = useMemo(
    () => resolveProfile(activeProfile, requestedMode),
    [activeProfile, requestedMode],
  );

  // Apply the resolved theme as inline --mk-* vars + the data-theme override so
  // the explicit choice beats the OS media query. Runs before paint.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = resolved;
    applyThemeVars(colors);
  }, [resolved, colors]);

  const persistCustom = useCallback((themes: StoredTheme[]) => {
    lsSet(CUSTOM_KEY, JSON.stringify(themes));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    lsSet(MODE_KEY, next);
    const db = adapterRef.current;
    if (db) {
      try {
        dbSetThemeMode(db, next);
      } catch {
        /* localStorage remains the durable store */
      }
    }
  }, []);

  const applyTheme = useCallback((id: string) => {
    setActiveIdState(id);
    lsSet(ACTIVE_KEY, id);
    const db = adapterRef.current;
    if (db) {
      try {
        setActiveThemeId(db, id);
      } catch {
        /* applied in-session */
      }
    }
  }, []);

  const saveCustomTheme = useCallback<ThemeLibrary['saveCustomTheme']>(
    (profile, options) => {
      const id = newThemeId();
      const at = new Date().toISOString();
      const name = options?.name ?? profile.name;
      const stored: StoredTheme = {
        id,
        name,
        profile: { ...profile, id, name },
        basePresetId: options?.basePresetId ?? profile.basePresetId ?? null,
        source: options?.source ?? 'custom',
        createdAt: at,
        updatedAt: at,
      };
      setCustomThemes((prev) => {
        const next = [stored, ...prev];
        persistCustom(next);
        return next;
      });
      const db = adapterRef.current;
      if (db) {
        try {
          saveTheme(db, stored);
        } catch {
          /* localStorage holds it */
        }
      }
      applyTheme(id);
      return id;
    },
    [applyTheme, persistCustom],
  );

  const renameCustomTheme = useCallback(
    (id: string, name: string) => {
      const at = new Date().toISOString();
      setCustomThemes((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, name, profile: { ...t.profile, name }, updatedAt: at } : t,
        );
        persistCustom(next);
        return next;
      });
      const db = adapterRef.current;
      if (db) {
        try {
          renameTheme(db, id, name, at);
        } catch {
          /* ignore */
        }
      }
    },
    [persistCustom],
  );

  const deleteCustomTheme = useCallback(
    (id: string) => {
      setCustomThemes((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persistCustom(next);
        return next;
      });
      const db = adapterRef.current;
      if (db) {
        try {
          deleteTheme(db, id);
        } catch {
          /* ignore */
        }
      }
      if (id === activeIdRef.current) applyTheme(OPEN_BURROW.id);
    },
    [applyTheme, persistCustom],
  );

  const importThemeBlob = useCallback<ThemeLibrary['importThemeBlob']>(
    (input) => {
      const decoded = decodeThemeBlob(input);
      if (!decoded.success) return { success: false, error: decoded.error.message };
      const id = saveCustomTheme(decoded.theme, { source: 'imported' });
      if (!id) return { success: false, error: 'Could not save the imported theme.' };
      return { success: true, id };
    },
    [saveCustomTheme],
  );

  const exportThemeBlob = useCallback(
    (id?: string) => {
      const target = id
        ? getPreset(id) ?? customThemes.find((t) => t.id === id)?.profile
        : activeProfile;
      if (!target) return null;
      try {
        return encodeThemeBlob(target);
      } catch {
        return null;
      }
    },
    [activeProfile, customThemes],
  );

  const bindDatabase = useCallback(
    (db: DatabaseAdapter | null) => {
      if (!db) return;
      try {
        ensureThemeTables(db);
        const dbThemes = listThemes(db);
        // Merge from a ref snapshot (no side effects inside a state updater, which
        // StrictMode double-invokes). DB wins on id conflicts (durable store).
        const byId = new Map<string, StoredTheme>();
        for (const t of dbThemes) byId.set(t.id, t);
        const localOnly: StoredTheme[] = [];
        for (const t of customThemesRef.current) {
          if (!byId.has(t.id)) {
            byId.set(t.id, t);
            localOnly.push(t);
          }
        }
        const merged = [...byId.values()].sort((a, b) =>
          a.updatedAt < b.updatedAt ? 1 : -1,
        );
        // Side effects happen once, outside the updater.
        for (const t of localOnly) {
          try {
            saveTheme(db, t); // push a localStorage-only theme into the durable store
          } catch {
            /* ignore */
          }
        }
        persistCustom(merged);
        setCustomThemes(merged);
        // localStorage is the per-browser FOUC truth; mirror the active selection.
        setActiveThemeId(db, activeIdRef.current);
        dbSetThemeMode(db, modeRef.current);
        adapterRef.current = db;
      } catch {
        /* sql.js unavailable; localStorage remains the durable web store */
      }
    },
    [persistCustom],
  );

  const value = useMemo<ThemeLibrary>(
    () => ({
      mode,
      resolved,
      colors,
      setMode,
      presets: PRESETS,
      customThemes,
      activeId,
      activeProfile,
      applyTheme,
      saveCustomTheme,
      renameCustomTheme,
      deleteCustomTheme,
      importThemeBlob,
      exportThemeBlob,
      bindDatabase,
    }),
    [
      mode,
      resolved,
      colors,
      setMode,
      customThemes,
      activeId,
      activeProfile,
      applyTheme,
      saveCustomTheme,
      renameCustomTheme,
      deleteCustomTheme,
      importThemeBlob,
      exportThemeBlob,
      bindDatabase,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useThemeLibrary(): ThemeLibrary {
  return useContext(ThemeContext);
}
