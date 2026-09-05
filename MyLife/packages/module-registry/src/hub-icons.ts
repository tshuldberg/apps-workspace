/**
 * Lucide icon name mappings for each module.
 * Used by the hub launcher to render module icons.
 */
export const MODULE_ICONS: Record<string, string> = {
  books: 'book-open',
  budget: 'wallet',
  car: 'car',
  classes: 'graduation-cap',
  closet: 'shirt',
  cycle: 'moon',
  create: 'palette',
  fast: 'timer',
  flash: 'zap',
  forums: 'messages-square',
  garden: 'sprout',
  habits: 'check-circle-2',
  health: 'heart-pulse',
  homes: 'home',
  journal: 'notebook-pen',
  mail: 'mail',
  market: 'shopping-cart',
  meds: 'pill',
  mood: 'smile',
  notes: 'file-text',
  nutrition: 'utensils',
  pets: 'paw-print',
  presence: 'smartphone',
  recipes: 'chef-hat',
  rsvp: 'party-popper',
  shop: 'shopping-bag',
  stars: 'sparkles',
  subs: 'credit-card',
  surf: 'waves',
  trails: 'mountain',
  voice: 'mic',
  words: 'book-a',
  workouts: 'dumbbell',
};

/** Dock tab definitions for bottom bar (5-tab Obsidian Noir layout) */
export const DOCK_ITEMS = [
  { key: 'hub', label: 'Home', icon: 'layout-grid' },
  { key: 'discover', label: 'Discover', icon: 'compass' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'sync', label: 'Sync', icon: 'refresh-cw' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
] as const;
