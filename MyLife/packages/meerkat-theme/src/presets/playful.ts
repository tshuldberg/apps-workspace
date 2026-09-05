import type { MkThemeProfile } from '../types';

// Playful: warm cream + orange, friendly and rounded. The onAccent on the bright
// orange resolves dark automatically (real contrast), so the label stays legible.
export const PLAYFUL: MkThemeProfile = {
  version: 1,
  id: 'playful',
  name: 'Playful',
  register: 'Warm',
  shape: { radius: 'lg' },
  density: 'cozy',
  headingWeight: '800',
  light: {
    primary: {
      accent: '#E8590C',
      background: '#FFF8F0',
      surface: '#FFFFFF',
      text: '#3A2A20',
      danger: '#C23A38',
      warning: '#9A6A08',
      info: '#2F66B5',
      success: '#1F8A5E',
    },
  },
  dark: {
    primary: {
      accent: '#FF9559',
      background: '#1A130D',
      surface: '#241A12',
      text: '#F5E9DD',
      danger: '#F2868A',
      warning: '#E6B45C',
      info: '#8FB8EC',
      success: '#6FCDA9',
    },
  },
};
