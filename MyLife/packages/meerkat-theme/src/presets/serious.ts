import type { MkThemeProfile } from '../types';

// Serious: restrained near-monochrome with a deep teal accent. Professional,
// low-key, tight radius.
export const SERIOUS: MkThemeProfile = {
  version: 1,
  id: 'serious',
  name: 'Serious',
  register: 'Focused',
  shape: { radius: 'sm' },
  density: 'compact',
  headingWeight: '700',
  light: {
    primary: {
      accent: '#1F4E5F',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#1C1C1E',
      danger: '#A8322F',
      warning: '#795808',
      info: '#2A5599',
      success: '#1E6E4F',
    },
  },
  dark: {
    primary: {
      accent: '#6BA6BC',
      background: '#0F1112',
      surface: '#17191B',
      text: '#E8EAEC',
      danger: '#E08A86',
      warning: '#D0A85C',
      info: '#8FB4DC',
      success: '#6FC3A0',
    },
  },
};
