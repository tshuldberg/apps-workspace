import React, { createContext, useContext } from 'react';
import {
  COOL_OBSIDIAN,
  type ThemeProfile,
  type BaseColors,
} from '@mylife/ui';

// Manhattan accent layered onto the Cool Obsidian base tokens.
//
// The original provider carried a light/dark/auto mode setting that every
// branch resolved to this same dark profile, flagged by the production eval
// as a dead setting. Until a light Manhattan preset exists, the provider is
// deliberately static; reintroduce mode state alongside the first real
// second profile.
const MANHATTAN_ACCENT = '#E4572E';

const MANHATTAN_THEME: ThemeProfile = {
  ...COOL_OBSIDIAN,
  id: 'manhattan-obsidian',
  name: 'Manhattan Obsidian',
  colors: {
    ...COOL_OBSIDIAN.colors,
    accent: MANHATTAN_ACCENT,
    primary: MANHATTAN_ACCENT,
    primaryContainer: MANHATTAN_ACCENT,
  },
};

interface AppThemeContextValue {
  theme: ThemeProfile;
  themeId: string;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  theme: MANHATTAN_THEME,
  themeId: MANHATTAN_THEME.id,
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

const VALUE: AppThemeContextValue = {
  theme: MANHATTAN_THEME,
  themeId: MANHATTAN_THEME.id,
};

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeContext.Provider value={VALUE}>
      {children}
    </AppThemeContext.Provider>
  );
}
