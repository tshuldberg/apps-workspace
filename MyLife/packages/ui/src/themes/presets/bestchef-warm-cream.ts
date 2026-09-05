import type { ThemeProfile } from '../schema';

/**
 * BestChef Warm Cream preset.
 *
 * Light canvas adoption of are-blaze BCTheme. Hero gradient (terracotta to
 * saffron) is the primary brand surface; gold gradient is the champion accent.
 * Mirrors are-blaze BCTheme.swift light values where applicable.
 */
export const BESTCHEF_WARM_CREAM: ThemeProfile = {
  id: 'bestchef-warm-cream',
  name: 'BestChef Warm Cream',
  description:
    'Light cream canvas with terracotta-saffron hero gradient and gold champion accent. are-blaze parity.',
  author: 'BestChef',
  version: '1.0.0',
  colorMode: 'light',
  colors: {
    background: '#FCF7F0',
    surface: '#FFFFFF',
    surfaceElevated: '#F7F0E6',
    text: '#1A1410',
    textSecondary: '#665C52',
    textTertiary: 'rgba(26,20,16,0.45)',
    border: 'rgba(26,20,16,0.10)',
    danger: '#D94D33',
    success: '#33A672',
    warning: '#F5B22E',
    accent: '#F5B22E',
    primary: '#D94D33',
    primaryContainer: '#F5B22E',
  },
  glass: {
    cardFill: 'rgba(255,255,255,0.85)',
    cardBorder: 'rgba(26,20,16,0.08)',
    strongFill: 'rgba(255,255,255,0.95)',
    strongBorder: 'rgba(26,20,16,0.14)',
    dockFill: 'rgba(252,247,240,0.85)',
    dockBorder: 'rgba(26,20,16,0.10)',
    blurIntensity: 30,
  },
  fonts: {
    display: 'Plus Jakarta Sans',
    body: 'Plus Jakarta Sans',
  },
  typeScale: {
    heroTitle: { size: 34, weight: '800', lineHeight: 41 },
    heading: { size: 26, weight: '800', lineHeight: 32 },
    subheading: { size: 20, weight: '700', lineHeight: 26 },
    body: { size: 16, weight: '400', lineHeight: 26 },
    caption: { size: 13, weight: '500', lineHeight: 18 },
    label: { size: 11, weight: '700', lineHeight: 14, letterSpacing: 0.3 },
  },
  surfaces: {
    treatment: 'solid',
    cornerRadius: { card: 20, button: 14, icon: 14, tabBar: 24 },
    shadows: {
      card: '0 2px 6px rgba(26,20,16,0.06)',
      elevated: '0 6px 12px rgba(26,20,16,0.10)',
      pressed: '0 1px 2px rgba(26,20,16,0.08)',
    },
  },
  layout: {
    dashboardStyle: 'bento-grid',
    moduleGridColumns: 4,
    tabBarStyle: 'floating-pill',
    headerStyle: 'wordmark',
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
};
