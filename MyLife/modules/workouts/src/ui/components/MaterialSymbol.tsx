import * as LucideIcons from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactElement } from 'react';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type WorkoutSymbolSpec = {
  material?: MaterialIconName;
  fallback?: string;
};

/**
 * Design-name to runtime-icon mapping for the MyWorkouts redesign.
 * dashboard -> dashboard
 * fitness_center -> fitness-center
 * menu_book -> menu-book
 * insights -> insights
 * account_circle -> account-circle
 * play_arrow -> play-arrow
 * check_circle -> check-circle
 * more_horiz -> more-horiz
 * schedule -> schedule
 * local_fire_department -> local-fire-department
 * chevron_right -> chevron-right
 * filter_alt -> filter-alt
 * favorite -> favorite-border
 * hotel -> hotel
 * auto_awesome -> auto-awesome
 * expand_more -> expand-more
 */
const SYMBOL_MAP = {
  home: { material: 'dashboard', fallback: 'LayoutDashboard' },
  dashboard: { material: 'dashboard', fallback: 'LayoutDashboard' },
  search: { material: 'search', fallback: 'Search' },
  workouts: { material: 'fitness-center', fallback: 'Dumbbell' },
  fitness_center: { material: 'fitness-center', fallback: 'Dumbbell' },
  menu_book: { material: 'menu-book', fallback: 'BookOpen' },
  insights: { material: 'insights', fallback: 'BarChart3' },
  settings: { material: 'settings', fallback: 'Settings2' },
  timer: { material: 'timer', fallback: 'Timer' },
  mic: { material: 'mic', fallback: 'Mic' },
  layers: { material: 'layers', fallback: 'Layers3' },
  trending_up: { material: 'trending-up', fallback: 'TrendingUp' },
  account_circle: { material: 'account-circle', fallback: 'CircleUserRound' },
  user: { material: 'account-circle', fallback: 'CircleUserRound' },
  notifications: { material: 'notifications', fallback: 'Bell' },
  arrow_back: { material: 'arrow-back', fallback: 'ArrowLeft' },
  chevron_left: { material: 'chevron-left', fallback: 'ChevronLeft' },
  arrow_forward: { material: 'arrow-forward', fallback: 'ArrowRight' },
  play_arrow: { material: 'play-arrow', fallback: 'Play' },
  close: { material: 'close', fallback: 'X' },
  pause: { material: 'pause', fallback: 'Pause' },
  stop: { material: 'stop', fallback: 'Square' },
  check_circle: { material: 'check-circle', fallback: 'CheckCircle2' },
  check: { material: 'check', fallback: 'Check' },
  more_horiz: { material: 'more-horiz', fallback: 'MoreHorizontal' },
  filter_alt: { material: 'filter-alt', fallback: 'SlidersHorizontal' },
  filter_list: { material: 'filter-list', fallback: 'SlidersHorizontal' },
  chevron_right: { material: 'chevron-right', fallback: 'ChevronRight' },
  flag: { material: 'flag', fallback: 'Flag' },
  edit: { material: 'edit', fallback: 'Pencil' },
  add_circle: { material: 'add-circle', fallback: 'PlusCircle' },
  drag_handle: { material: 'drag-handle', fallback: 'GripHorizontal' },
  cable: { material: 'cable', fallback: 'Cable' },
  monitor_heart: { fallback: 'HeartPulse' },
  lock: { material: 'lock', fallback: 'Lock' },
  local_fire_department: { material: 'local-fire-department', fallback: 'Flame' },
  schedule: { material: 'schedule', fallback: 'Clock3' },
  history: { material: 'history', fallback: 'History' },
  star: { material: 'star', fallback: 'Star' },
  stars: { material: 'stars', fallback: 'Sparkles' },
  favorite: { material: 'favorite-border', fallback: 'Heart' },
  favorite_filled: { material: 'favorite', fallback: 'Heart' },
  hotel: { material: 'hotel', fallback: 'BedSingle' },
  bedtime: { material: 'bedtime', fallback: 'MoonStar' },
  auto_awesome: { material: 'auto-awesome', fallback: 'Sparkles' },
  shuffle: { material: 'shuffle', fallback: 'Shuffle' },
  tune: { material: 'tune', fallback: 'SlidersHorizontal' },
  expand_more: { material: 'expand-more', fallback: 'ChevronDown' },
  groups: { material: 'groups', fallback: 'UsersRound' },
  public: { material: 'public', fallback: 'Globe' },
  mode_comment: { material: 'mode-comment', fallback: 'MessageSquare' },
  ios_share: { material: 'ios-share', fallback: 'Share2' },
  front_hand: { fallback: 'Hand' },
  movie: { material: 'movie', fallback: 'Clapperboard' },
  photo_library: { material: 'photo-library', fallback: 'Images' },
  scale: { fallback: 'Scale' },
  photo_camera: { material: 'photo-camera', fallback: 'Camera' },
  restart_alt: { material: 'restart-alt', fallback: 'RotateCcw' },
  watch: { material: 'watch', fallback: 'Watch' },
  download: { material: 'download', fallback: 'Download' },
  privacy_tip: { fallback: 'ShieldCheck' },
  support: { material: 'help-outline', fallback: 'LifeBuoy' },
  delete: { material: 'delete', fallback: 'Trash2' },
  notifications_active: { material: 'notifications-active', fallback: 'BellRing' },
  inventory: { fallback: 'Package2' },
  straighten: { material: 'straighten', fallback: 'Ruler' },
  route: { material: 'route', fallback: 'Route' },
  calendar_today: { material: 'calendar-today', fallback: 'CalendarDays' },
  bolt: { material: 'bolt', fallback: 'Zap' },
  emoji_events: { material: 'emoji-events', fallback: 'Trophy' },
  timeline: { material: 'timeline', fallback: 'ChartLine' },
  bar_chart: { material: 'bar-chart', fallback: 'BarChart3' },
  north_east: { material: 'north-east', fallback: 'ArrowUpRight' },
  share: { material: 'share', fallback: 'Share2' },
  image: { material: 'image', fallback: 'Image' },
  save_alt: { material: 'save-alt', fallback: 'Download' },
  link: { material: 'link', fallback: 'Link2' },
  person: { material: 'person', fallback: 'UserRound' },
  add: { material: 'add', fallback: 'Plus' },
  remove: { material: 'remove', fallback: 'Minus' },
} satisfies Record<string, WorkoutSymbolSpec>;

export interface MaterialSymbolProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function resolveWorkoutSymbol(name: string): WorkoutSymbolSpec {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  const spec = SYMBOL_MAP[normalized as keyof typeof SYMBOL_MAP];
  return spec ?? { material: 'radio-button-unchecked', fallback: 'Circle' };
}

export function MaterialSymbol({
  name,
  size = 20,
  color = '#E4E1E9',
  strokeWidth = 2,
}: MaterialSymbolProps) {
  const spec = resolveWorkoutSymbol(name);

  if (spec.material) {
    return <MaterialIcons name={spec.material} size={size} color={color} />;
  }

  const Fallback =
    (LucideIcons as Record<string, unknown>)[spec.fallback ?? 'Circle'];

  if (typeof Fallback === 'function') {
    const Icon = Fallback as (props: {
      size?: number;
      color?: string;
      strokeWidth?: number;
    }) => ReactElement;

    return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
  }

  return (
    <MaterialIcons
      name="radio-button-unchecked"
      size={size}
      color={color}
    />
  );
}
