import type { MkThemeProfile } from '../types';

// High contrast: maximum legibility for low-vision users. Pure black/white body
// text (AAA), with accents dark enough (light mode) / bright enough (dark mode)
// that the derived onAccent stays AA. The dedicated accessibility register that
// Signal and WhatsApp underserve.
export const HIGH_CONTRAST: MkThemeProfile = {
  version: 1,
  id: 'high-contrast',
  name: 'High contrast',
  register: 'High contrast',
  shape: { radius: 'sm' },
  density: 'comfortable',
  headingWeight: '800',
  light: {
    primary: {
      accent: '#0B5D49',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#000000',
      danger: '#9E0014',
      warning: '#5A4300',
      info: '#0B3FA8',
      success: '#0A5C3E',
    },
    overrides: {
      surfaceHigh: '#EAEFED',
      border: 'rgba(0, 0, 0, 0.42)',
      borderStrong: 'rgba(0, 0, 0, 0.70)',
      textSecondary: '#1F1F1F',
      textTertiary: '#333333',
    },
  },
  dark: {
    primary: {
      accent: '#6FE6C6',
      background: '#000000',
      surface: '#000000',
      text: '#FFFFFF',
      danger: '#FF9A9A',
      warning: '#FFD24D',
      info: '#8FD0FF',
      success: '#79E6B6',
    },
    overrides: {
      surfaceHigh: '#1A1A1A',
      border: 'rgba(255, 255, 255, 0.42)',
      borderStrong: 'rgba(255, 255, 255, 0.70)',
      textSecondary: '#E6E6E6',
      textTertiary: '#CCCCCC',
    },
  },
};
