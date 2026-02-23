export const colors = {
  background: '#0E0C09',
  surface: '#1A1610',
  surfaceElevated: '#23201A',
  text: '#F4EDE2',
  textSecondary: '#A99E8E',
  textTertiary: '#6B6155',
  accent: '#C9894D',
  accentLight: '#E0B07A',
  accentDim: '#7A5530',
  star: '#E8B84B',
  starEmpty: '#3A352D',
  shelf: '#2C6B50',
  shelfLight: '#3D8A68',
  reading: '#4A90D9',
  finished: '#5BA55B',
  tbr: '#C9894D',
  dnf: '#9E6060',
  tagDefault: '#6B8DA6',
  coverShadow: 'rgba(0,0,0,0.4)',
  border: '#2A2520',
  danger: '#CC5555',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  cover: 3,
} as const;

export const typography = {
  heading: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700' as const,
  },
  subheading: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  bookTitle: {
    fontFamily: 'Literata',
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  bookAuthor: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#A99E8E',
  },
  review: {
    fontFamily: 'Literata',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  stat: {
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: '700' as const,
  },
  caption: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
} as const;

export const coverAspectRatio = 2 / 3;

export const coverSizes = {
  small: { width: 60, height: 90 },
  medium: { width: 100, height: 150 },
  large: { width: 160, height: 240 },
  detail: { width: 200, height: 300 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cover: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export type CoverSize = keyof typeof coverSizes;
export type TypographyVariant = keyof typeof typography;
