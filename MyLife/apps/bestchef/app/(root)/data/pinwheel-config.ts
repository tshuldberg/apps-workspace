import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  Bell,
  BookOpen,
  Camera,
  Flag,
  Flame,
  Home,
  Package,
  Play,
  Plus,
  Receipt,
  Search,
  Settings as SettingsIcon,
  ShoppingBasket,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  UserCircle,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import type { useDatabase } from '../providers/DatabaseProvider';

type Db = ReturnType<typeof useDatabase>;

export const PINWHEEL_MAX_ACTIONS = 6;

export interface PinwheelActionDef {
  id: string;
  icon: LucideIcon;
  label: string;
  route: string;
  tint: string;
}

export const PINWHEEL_ACTION_CATALOG: readonly PinwheelActionDef[] = [
  { id: 'submit', icon: Plus, label: 'Submit Recipe', route: '/submit', tint: '#FFB877' },
  { id: 'discover', icon: Search, label: 'Discover', route: '/discover', tint: '#8BCFF0' },
  { id: 'home', icon: Home, label: 'Home', route: '/(tabs)', tint: '#22C55E' },
  { id: 'kitchen', icon: BookOpen, label: 'My Kitchen', route: '/(tabs)/kitchen', tint: '#22C55E' },
  { id: 'grocery', icon: ShoppingBasket, label: 'Grocery', route: '/grocery', tint: '#22C55E' },
  { id: 'pantry', icon: Package, label: 'Pantry', route: '/pantry', tint: '#C9894D' },
  { id: 'leaderboard', icon: Trophy, label: 'Leaderboard', route: '/(tabs)/leaderboard', tint: '#FFB877' },
  { id: 'vote', icon: ThumbsUp, label: 'Vote', route: '/(tabs)/vote', tint: '#FFB877' },
  { id: 'profile', icon: UserCircle, label: 'Profile', route: '/(tabs)/profile', tint: '#22C55E' },
  { id: 'notifications', icon: Bell, label: 'Notifications', route: '/notifications', tint: '#8BCFF0' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings', route: '/(tabs)/settings', tint: '#9F8E81' },
  { id: 'feed', icon: Play, label: 'Cooking Videos', route: '/feed', tint: '#FF6B9D' },
  { id: 'challenges', icon: Sparkles, label: 'Challenges', route: '/challenges', tint: '#FFB877' },
  { id: 'creator', icon: Star, label: 'Creator', route: '/creator-program', tint: '#FFB877' },
  { id: 'receipt', icon: Receipt, label: 'Scan Receipt', route: '/kitchen-receipt', tint: '#22C55E' },
  { id: 'photo', icon: Camera, label: 'Grocery Photo', route: '/kitchen-photo', tint: '#22C55E' },
  { id: 'reports', icon: Flag, label: 'My Reports', route: '/my-reports', tint: '#9F8E81' },
  { id: 'flame', icon: Flame, label: 'Trending', route: '/discover', tint: '#FF6B9D' },
  { id: 'dishes', icon: Utensils, label: 'Browse Dishes', route: '/(tabs)/dishes', tint: '#C9894D' },
];

export const DEFAULT_PINWHEEL_ACTIONS: readonly string[] = [
  'submit',
  'discover',
  'kitchen',
  'grocery',
  'leaderboard',
  'notifications',
];

export const PINWHEEL_PAGE_KEYS: readonly string[] = [
  'home',
  'leaderboard',
  'vote',
  'kitchen',
  'profile',
  'dishes',
  'discover',
  'feed',
  'submit',
  'recipe',
  'dish',
  'grocery',
  'pantry',
  'settings',
];

const DEFAULT_KEY = 'pinwheel_default_actions';
const SHOW_LABELS_KEY = 'pinwheel_show_labels';
const ENABLED_KEY = 'pinwheel_enabled';
const PAGE_PREFIX = 'pinwheel_page_';

export interface PinwheelConfig {
  actions: PinwheelActionDef[];
  showLabels: boolean;
  enabled: boolean;
}

export function getActionById(id: string): PinwheelActionDef | undefined {
  return PINWHEEL_ACTION_CATALOG.find((a) => a.id === id);
}

function safeParseIds(raw: string | null): string[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .filter((v): v is string => typeof v === 'string')
      .filter((id) => getActionById(id) != null);
    return ids.slice(0, PINWHEEL_MAX_ACTIONS);
  } catch {
    return null;
  }
}

function readSetting(db: Db, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function writeSetting(db: Db, key: string, value: string): void {
  db.execute(
    `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

function deleteSetting(db: Db, key: string): void {
  try {
    db.execute(`DELETE FROM rc_settings WHERE key = ?`, [key]);
  } catch {
    // no-op
  }
}

export function loadDefaultActionIds(db: Db): string[] {
  const parsed = safeParseIds(readSetting(db, DEFAULT_KEY));
  if (parsed && parsed.length > 0) return parsed;
  return [...DEFAULT_PINWHEEL_ACTIONS];
}

export function loadPageActionIds(db: Db, pageKey: string): string[] | null {
  return safeParseIds(readSetting(db, `${PAGE_PREFIX}${pageKey}`));
}

export function saveDefaultActionIds(db: Db, ids: string[]): void {
  const cleaned = ids
    .filter((id) => getActionById(id) != null)
    .slice(0, PINWHEEL_MAX_ACTIONS);
  writeSetting(db, DEFAULT_KEY, JSON.stringify(cleaned));
  notify();
}

export function savePageActionIds(db: Db, pageKey: string, ids: string[]): void {
  const cleaned = ids
    .filter((id) => getActionById(id) != null)
    .slice(0, PINWHEEL_MAX_ACTIONS);
  writeSetting(db, `${PAGE_PREFIX}${pageKey}`, JSON.stringify(cleaned));
  notify();
}

export function clearPageActionIds(db: Db, pageKey: string): void {
  deleteSetting(db, `${PAGE_PREFIX}${pageKey}`);
  notify();
}

export function loadShowLabels(db: Db): boolean {
  const raw = readSetting(db, SHOW_LABELS_KEY);
  if (raw == null) return true;
  return raw !== 'false';
}

export function saveShowLabels(db: Db, value: boolean): void {
  writeSetting(db, SHOW_LABELS_KEY, value ? 'true' : 'false');
  notify();
}

export function loadEnabled(db: Db): boolean {
  const raw = readSetting(db, ENABLED_KEY);
  if (raw == null) return true;
  return raw !== 'false';
}

export function saveEnabled(db: Db, value: boolean): void {
  writeSetting(db, ENABLED_KEY, value ? 'true' : 'false');
  notify();
}

export function resolveActions(db: Db, pageKey: string | undefined): PinwheelActionDef[] {
  const ids = pageKey != null ? loadPageActionIds(db, pageKey) : null;
  const finalIds = ids != null && ids.length > 0 ? ids : loadDefaultActionIds(db);
  const resolved = finalIds
    .map(getActionById)
    .filter((a): a is PinwheelActionDef => a != null);
  return resolved.slice(0, PINWHEEL_MAX_ACTIONS);
}

export function loadFullConfig(db: Db, pageKey: string | undefined): PinwheelConfig {
  return {
    actions: resolveActions(db, pageKey),
    showLabels: loadShowLabels(db),
    enabled: loadEnabled(db),
  };
}

const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = (): number => version;
const getServerVersion = (): number => 0;

export function usePinwheelConfig(
  db: Db,
  pageKey: string | undefined,
): PinwheelConfig {
  const v = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  return useMemo(() => loadFullConfig(db, pageKey), [db, pageKey, v]);
}

export function usePinwheelHasOverride(db: Db, pageKey: string): boolean {
  const v = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  return useMemo(() => loadPageActionIds(db, pageKey) != null, [db, pageKey, v]);
}

export function notifyPinwheelChanged(): void {
  notify();
}

// Convenience to use the catalog as a list (for the editor UI).
export function listCatalog(): PinwheelActionDef[] {
  return [...PINWHEEL_ACTION_CATALOG];
}

// Effects must use this hook to avoid memory leaks during teardown.
export function usePinwheelChangeListener(listener: () => void): void {
  useEffect(() => subscribe(listener), [listener]);
}
