// Obsidian Noir theme -- warm dark with glass morphism
export const colors = {
  // Base theme (Obsidian Noir)
  background: '#131318',
  surface: '#131318',
  surfaceElevated: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textTertiary: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  danger: '#FFB4AB',
  success: '#30D158',
  warning: '#FF9F0A',

  // Semantic error
  errorContainer: '#93000A',

  // Contextual accent (set by module theme)
  accent: '#3B82F6',

  // Universal hub accent
  primary: '#FFB877',
  primaryContainer: '#C9894D',

  // Tertiary (info/health states)
  tertiary: '#8BCFF0',

  // Outline
  outline: '#9F8E81',
  outlineVariant: '#52443A',

  // Glass morphism
  glass: 'rgba(255,255,255,0.03)',
  glassStrong: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.10)',

  // Hub accent (aliases for backward compat)
  hubAccent: '#C9894D',
  hubAccentLight: '#FFB877',

  // Per-module accent colors
  modules: {
    books: '#C9894D',
    budget: '#22C55E',
    car: '#3B82F6',
    classes: '#3B82F6',
    closet: '#E879A8',
    cycle: '#F472B6',
    create: '#D946EF',
    dining: '#DC2626',
    fast: '#14B8A6',
    flash: '#8B5CF6',
    garden: '#84CC16',
    habits: '#8B5CF6',
    health: '#EF4444',
    homes: '#F59E0B',
    journal: '#A78BFA',
    mail: '#3B82F6',
    manhattan: '#E4572E',
    meds: '#06B6D4',
    mood: '#FB923C',
    mynews: '#8BCFF0',
    notes: '#64748B',
    nutrition: '#F97316',
    payments: '#00C389',
    pets: '#F97316',
    presence: '#0891B2',
    recipes: '#F97316',
    rsvp: '#FB7185',
    sleep: '#A78BFA',
    stars: '#A78BFA',
    subs: '#10B981',
    surf: '#3B82F6',
    trails: '#65A30D',
    voice: '#EF4444',
    words: '#0EA5E9',
    workouts: '#EF4444',
    market: '#14B8A6',
    forums: '#7C4DFF',
    friends: '#EC4899',
    shop: '#10B981',
    sports: '#16A34A',
    travel: '#0EA5E9',
  },
} as const;

export type ModuleName = keyof typeof colors.modules;

/**
 * 5-tier surface system for the Obsidian Noir redesign.
 * Provides fine-grained layering beyond the base surface/surfaceElevated pair.
 * Ordered from darkest (lowest) to lightest (highest).
 */
export const surfaceTiers = {
  lowest: '#0E0E13',
  low: '#1B1B20',
  container: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export type SurfaceTier = keyof typeof surfaceTiers;
