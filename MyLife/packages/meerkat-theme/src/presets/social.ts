import type { MkThemeProfile } from '../types';

// Social: saturated violet, energetic. The "looks at home next to Instagram/X"
// register for users who want a vivid accent.
export const SOCIAL: MkThemeProfile = {
  version: 1,
  id: 'social',
  name: 'Social',
  register: 'Vibrant',
  shape: { radius: 'lg' },
  density: 'cozy',
  headingWeight: '800',
  light: {
    primary: {
      accent: '#6C3FC7',
      background: '#FFFFFF',
      surface: '#F7F6FB',
      text: '#1B1A2E',
      danger: '#CE2F44',
      warning: '#9C6206',
      info: '#2660E0',
      success: '#19854F',
    },
  },
  dark: {
    primary: {
      accent: '#B197E8',
      background: '#121016',
      surface: '#1C1922',
      text: '#ECEAF3',
      danger: '#F2727F',
      warning: '#E0A94B',
      info: '#86A9F4',
      success: '#5EC691',
    },
  },
};
