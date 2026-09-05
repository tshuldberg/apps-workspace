import type { MkThemeProfile } from '../types';

// Calm: cool slate + muted blue, low saturation. Reads quiet and trustworthy.
export const CALM: MkThemeProfile = {
  version: 1,
  id: 'calm',
  name: 'Calm',
  register: 'Calm',
  shape: { radius: 'lg' },
  density: 'comfortable',
  headingWeight: '600',
  light: {
    primary: {
      accent: '#3F6FA5',
      background: '#F3F6F9',
      surface: '#FFFFFF',
      text: '#27313D',
      danger: '#B0413E',
      warning: '#8A6310',
      info: '#34629E',
      success: '#2C7A57',
    },
  },
  dark: {
    primary: {
      accent: '#7EA8DC',
      background: '#13171C',
      surface: '#1B212A',
      text: '#E1E7EF',
      danger: '#E89A96',
      warning: '#DFB36A',
      info: '#9BBEEA',
      success: '#79C6A1',
    },
  },
};
