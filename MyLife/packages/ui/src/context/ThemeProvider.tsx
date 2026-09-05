'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { COOL_OBSIDIAN } from '../themes/presets/cool-obsidian';
import type {
  BaseColors,
  FontFamily,
  Layout,
  Surfaces,
  ThemeProfile,
  TypeScale,
} from '../themes/schema';

const ThemeContext = createContext<ThemeProfile>(COOL_OBSIDIAN);

export interface ThemeProviderProps {
  theme?: ThemeProfile;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const value = useMemo(() => theme ?? COOL_OBSIDIAN, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeProfile {
  return useContext(ThemeContext);
}

export function useThemeColors(): BaseColors {
  return useContext(ThemeContext).colors;
}

export function useThemeFonts(): FontFamily {
  return useContext(ThemeContext).fonts;
}

export function useThemeLayout(): Layout {
  return useContext(ThemeContext).layout;
}

export function useThemeSurfaces(): Surfaces {
  return useContext(ThemeContext).surfaces;
}

export function useThemeTypeScale(): TypeScale {
  return useContext(ThemeContext).typeScale;
}