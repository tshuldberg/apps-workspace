import React, { createContext, useContext, useMemo } from 'react';
import {
  DW_ACCENT,
  DW_ACCENT_DARK,
  DW_ACCENT_LIGHT,
  DW_BORDER,
  DW_FEEDBACK,
  DW_GLASS,
  DW_GLASS_NAV,
  DW_ON_ACCENT,
  DW_SURFACES,
  DW_TEXT,
} from '../theme/tokens';

export interface DoWorkAppThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighest: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  onAccent: string;
  glass: string;
  glassNav: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

const defaultColors: DoWorkAppThemeColors = {
  background: DW_SURFACES.base,
  surface: DW_SURFACES.low,
  surfaceElevated: DW_SURFACES.mid,
  surfaceHighest: DW_SURFACES.highest,
  text: DW_TEXT.primary,
  textSecondary: DW_TEXT.secondary,
  textTertiary: DW_TEXT.tertiary,
  textDisabled: DW_TEXT.disabled,
  border: DW_BORDER.subtle,
  borderStrong: DW_BORDER.strong,
  accent: DW_ACCENT,
  accentLight: DW_ACCENT_LIGHT,
  accentDark: DW_ACCENT_DARK,
  onAccent: DW_ON_ACCENT,
  glass: DW_GLASS.backgroundColor,
  glassNav: DW_GLASS_NAV.backgroundColor,
  success: DW_FEEDBACK.success,
  warning: DW_FEEDBACK.warning,
  danger: DW_FEEDBACK.danger,
  info: DW_FEEDBACK.info,
};

const ThemeContext = createContext<DoWorkAppThemeColors>(defaultColors);

export function useAppThemeColors(): DoWorkAppThemeColors {
  return useContext(ThemeContext);
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => defaultColors, []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
