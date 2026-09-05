import type { ThemeProfile } from '../schema';

/**
 * BestChef Warm Charcoal preset.
 *
 * Dark canvas adoption of are-blaze BCTheme. Hero gradient uses the deeper
 * terracotta variant for contrast on the near-black canvas; gold gradient is
 * the champion accent. Canvas color matches the are-blaze dark theme.
 */
export const BESTCHEF_WARM_CHARCOAL: ThemeProfile = {
  id: 'bestchef-warm-charcoal',
  name: 'BestChef Warm Charcoal',
  description:
    'Deep charcoal canvas with terracotta-saffron hero gradient and gold champion accent. are-blaze dark parity.',
  author: 'BestChef',
  version: '1.0.0',
  colorMode: 'dark',
  colors: {
    background: '#110D08',
    surface: '#211F1F',
    surfaceElevated: '#2B2926',
    text: '#F7F5F0',
    textSecondary: '#B8B3A8',
    textTertiary: 'rgba(247,245,240,0.40)',
    border: 'rgba(255,255,255,0.06)',
    danger: '#F26B4D',
    success: '#52C78C',
    warning: '#FFC74D',
    accent: '#FFC74D',
    primary: '#F26B4D',
    primaryContainer: '#C7522E',
  },
  glass: {
    cardFill: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.06)',
    strongFill: 'rgba(255,255,255,0.08)',
    strongBorder: 'rgba(255,255,255,0.10)',
    dockFill: 'rgba(17,13,8,0.72)',
    dockBorder: 'rgba(255,255,255,0.08)',
    blurIntensity: 60,
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
    treatment: 'glass',
    cornerRadius: { card: 20, button: 14, icon: 14, tabBar: 24 },
    shadows: {
      card: '0 2px 6px rgba(0,0,0,0.30)',
      elevated: '0 6px 16px rgba(0,0,0,0.40)',
      pressed: '0 1px 2px rgba(0,0,0,0.35)',
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
