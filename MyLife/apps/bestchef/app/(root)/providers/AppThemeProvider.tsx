import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Appearance, type ColorSchemeName } from 'react-native';
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  validateTheme,
  type ThemeProfile,
  type BaseColors,
} from '@mylife/ui';
import { listCustomThemes } from '@mylife/bestchef';
import { useDatabase } from './DatabaseProvider';

const BESTCHEF_DEFAULT_THEME_ID = 'bestchef-warm-charcoal';
const LIGHT_PRESET_ID = 'bestchef-warm-cream';
const DARK_PRESET_ID = 'bestchef-warm-charcoal';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface CustomThemeEntry {
  id: string;
  name: string;
  theme: ThemeProfile;
}

interface AppThemeContextValue {
  theme: ThemeProfile;
  themeId: string;
  setTheme: (id: string, custom?: ThemeProfile) => void;
  resetTheme: () => void;
  themeOpacity: Animated.Value;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  customThemes: CustomThemeEntry[];
  refreshCustomThemes: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  theme: DEFAULT_THEME,
  themeId: BESTCHEF_DEFAULT_THEME_ID,
  setTheme: () => {},
  resetTheme: () => {},
  themeOpacity: new Animated.Value(1),
  themeMode: 'dark',
  setThemeMode: () => {},
  customThemes: [],
  refreshCustomThemes: () => {},
});

export function useAppTheme(): AppThemeContextValue {
  return useContext(AppThemeContext);
}

export function useAppThemeColors(): BaseColors {
  return useContext(AppThemeContext).theme.colors;
}

export function useAppThemeProfile(): ThemeProfile {
  return useContext(AppThemeContext).theme;
}

function loadSetting(db: ReturnType<typeof useDatabase>, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [key]);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function saveSetting(db: ReturnType<typeof useDatabase>, key: string, value: string): void {
  try {
    db.execute(`INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`, [key, value]);
  } catch {}
}

function isValidThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function loadCustomThemeEntries(db: ReturnType<typeof useDatabase>): CustomThemeEntry[] {
  try {
    const rows = listCustomThemes(db);
    const entries: CustomThemeEntry[] = [];
    for (const row of rows) {
      const result = validateTheme(row.tokenOverrides);
      if (result.success && result.theme) {
        entries.push({ id: row.id, name: row.name, theme: result.theme });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

function resolveTheme(
  id: string,
  customJson: string | null,
  customThemes: CustomThemeEntry[],
  fallbackId: string,
): ThemeProfile {
  try {
    if (id.startsWith('custom:')) {
      const customId = id.slice('custom:'.length);
      const entry = customThemes.find((c) => c.id === customId);
      if (entry) return entry.theme;
    }
    if (id === 'custom' && customJson) {
      const parsed = JSON.parse(customJson) as unknown;
      const result = validateTheme(parsed);
      if (result.success && result.theme) return result.theme;
    }
    if (id in THEME_PRESETS) return THEME_PRESETS[id];
  } catch {}
  return THEME_PRESETS[fallbackId] ?? THEME_PRESETS[BESTCHEF_DEFAULT_THEME_ID] ?? DEFAULT_THEME;
}

function resolveModeBasedThemeId(
  mode: ThemeMode,
  systemScheme: ColorSchemeName,
  storedId: string,
): string {
  // Auto follows the OS color scheme. Light/Dark force the picked preset.
  if (mode === 'light') return LIGHT_PRESET_ID;
  if (mode === 'dark') return DARK_PRESET_ID;
  if (mode === 'auto') {
    return systemScheme === 'light' ? LIGHT_PRESET_ID : DARK_PRESET_ID;
  }
  return storedId;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const [themeId, setThemeId] = useState(BESTCHEF_DEFAULT_THEME_ID);
  const [customJson, setCustomJson] = useState<string | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [customThemes, setCustomThemes] = useState<CustomThemeEntry[]>([]);
  const themeOpacity = useRef(new Animated.Value(1)).current;

  const refreshCustomThemes = useCallback(() => {
    setCustomThemes(loadCustomThemeEntries(db));
  }, [db]);

  useEffect(() => {
    const savedId = loadSetting(db, 'theme_profile_id') ?? loadSetting(db, 'theme_id');
    const savedCustom = loadSetting(db, 'custom_theme');
    const savedMode = loadSetting(db, 'theme_mode');
    if (savedId) setThemeId(savedId);
    if (savedCustom) setCustomJson(savedCustom);
    if (isValidThemeMode(savedMode)) setThemeModeState(savedMode);
    setCustomThemes(loadCustomThemeEntries(db));
  }, [db]);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const effectiveThemeId = useMemo(() => {
    if (themeMode === 'auto') {
      return resolveModeBasedThemeId('auto', systemScheme, themeId);
    }
    if (themeMode === 'light' || themeMode === 'dark') {
      // If the stored theme is a custom or preset that doesn't match the
      // forced mode, fall back to the canonical light/dark preset.
      // We still respect explicit custom themes the user picks while in auto.
      // For light/dark, force the corresponding preset.
      return resolveModeBasedThemeId(themeMode, systemScheme, themeId);
    }
    return themeId;
  }, [themeMode, systemScheme, themeId]);

  const theme = useMemo(
    () => resolveTheme(effectiveThemeId, customJson, customThemes, BESTCHEF_DEFAULT_THEME_ID),
    [effectiveThemeId, customJson, customThemes],
  );

  const setTheme = useCallback((id: string, custom?: ThemeProfile) => {
    Animated.sequence([
      Animated.timing(themeOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setThemeId(id);
      saveSetting(db, 'theme_profile_id', id);
      saveSetting(db, 'theme_id', id);
      if (custom) {
        const json = JSON.stringify(custom);
        setCustomJson(json);
        saveSetting(db, 'custom_theme', json);
      }
      Animated.timing(themeOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    });
  }, [db, themeOpacity]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    Animated.sequence([
      Animated.timing(themeOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setThemeModeState(mode);
      saveSetting(db, 'theme_mode', mode);
      Animated.timing(themeOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    });
  }, [db, themeOpacity]);

  const resetTheme = useCallback(() => {
    Animated.sequence([
      Animated.timing(themeOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setThemeId(BESTCHEF_DEFAULT_THEME_ID);
      setCustomJson(null);
      saveSetting(db, 'theme_profile_id', BESTCHEF_DEFAULT_THEME_ID);
      saveSetting(db, 'theme_id', BESTCHEF_DEFAULT_THEME_ID);
      try { db.execute(`DELETE FROM rc_settings WHERE key = ?`, ['custom_theme']); } catch {}
      Animated.timing(themeOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    });
  }, [db, themeOpacity]);

  const value = useMemo(
    () => ({
      theme,
      themeId: effectiveThemeId,
      setTheme,
      resetTheme,
      themeOpacity,
      themeMode,
      setThemeMode,
      customThemes,
      refreshCustomThemes,
    }),
    [theme, effectiveThemeId, setTheme, resetTheme, themeOpacity, themeMode, setThemeMode, customThemes, refreshCustomThemes],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <Animated.View style={{ flex: 1, opacity: themeOpacity }}>
        {children}
      </Animated.View>
    </AppThemeContext.Provider>
  );
}
