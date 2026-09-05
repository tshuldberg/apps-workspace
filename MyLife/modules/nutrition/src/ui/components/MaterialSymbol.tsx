import * as LucideIcons from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactElement } from 'react';
import { NU_TEXT } from '../tokens';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type NutritionSymbolSpec = {
  defaultMaterial?: MaterialIconName;
  filledMaterial?: MaterialIconName;
  fallback?: string;
};

/**
 * Design-name to runtime-icon mapping for the MyNutrition redesign.
 * water_drop -> water-drop
 * restaurant -> restaurant
 * local_dining -> restaurant
 * qr_code_scanner -> qr-code-scanner
 * photo_camera -> photo-camera
 * search -> search
 * notifications -> notifications
 * account_circle -> account-circle
 * add -> add
 * more_vert -> more-vert
 * trending_up -> trending-up
 * favorite -> favorite-border / favorite
 * edit -> edit
 * delete -> delete
 * share -> share
 * download -> download
 * settings -> settings
 * monitor_weight -> monitor-weight
 * fitness_center -> fitness-center
 * eco -> eco
 * science -> science
 * lunch_dining -> lunch-dining
 * breakfast_dining -> free-breakfast
 * dinner_dining -> dinner-dining
 * cookie -> cookie
 * egg -> egg-alt
 * lock -> lock
 * cloud_off -> cloud-off
 * info -> info
 * public -> public
 */
const SYMBOL_MAP = {
  home: { defaultMaterial: 'home', fallback: 'House' },
  arrow_back: { defaultMaterial: 'arrow-back', fallback: 'ArrowLeft' },
  chevron_left: { defaultMaterial: 'chevron-left', fallback: 'ChevronLeft' },
  chevron_right: { defaultMaterial: 'chevron-right', fallback: 'ChevronRight' },
  arrow_outward: { defaultMaterial: 'arrow-outward', fallback: 'ArrowUpRight' },
  close: { defaultMaterial: 'close', fallback: 'X' },
  check: { defaultMaterial: 'check', fallback: 'Check' },
  check_circle: { defaultMaterial: 'check-circle', fallback: 'CircleCheckBig' },
  link: { defaultMaterial: 'link', fallback: 'Link2' },
  open_in_new: { defaultMaterial: 'open-in-new', fallback: 'ExternalLink' },
  calendar_today: { defaultMaterial: 'calendar-today', fallback: 'CalendarDays' },
  schedule: { defaultMaterial: 'schedule', fallback: 'Clock3' },
  history: { defaultMaterial: 'history', fallback: 'History' },
  content_copy: { defaultMaterial: 'content-copy', fallback: 'Copy' },
  expand_more: { defaultMaterial: 'expand-more', fallback: 'ChevronDown' },
  expand_less: { defaultMaterial: 'expand-less', fallback: 'ChevronUp' },
  restaurant_menu: { defaultMaterial: 'restaurant-menu', fallback: 'NotebookTabs' },
  edit_note: { defaultMaterial: 'edit-note', fallback: 'NotebookPen' },
  book_open: { defaultMaterial: 'menu-book', fallback: 'BookOpen' },
  search: { defaultMaterial: 'search', fallback: 'Search' },
  trending_up: { defaultMaterial: 'trending-up', fallback: 'TrendingUp' },
  insights: { defaultMaterial: 'insights', fallback: 'ChartColumnIncreasing' },
  community: { defaultMaterial: 'groups', fallback: 'UsersRound' },
  users: { defaultMaterial: 'groups', fallback: 'UsersRound' },
  groups: { defaultMaterial: 'groups', fallback: 'UsersRound' },
  group_add: { defaultMaterial: 'group-add', fallback: 'UserRoundPlus' },
  settings: { defaultMaterial: 'settings', fallback: 'Settings2' },
  water_drop: { defaultMaterial: 'water-drop', filledMaterial: 'water-drop', fallback: 'Droplets' },
  restaurant: { defaultMaterial: 'restaurant', fallback: 'UtensilsCrossed' },
  local_dining: { defaultMaterial: 'restaurant', fallback: 'UtensilsCrossed' },
  qr_code_scanner: { defaultMaterial: 'qr-code-scanner', fallback: 'ScanLine' },
  photo_camera: { defaultMaterial: 'photo-camera', fallback: 'Camera' },
  flash_on: { defaultMaterial: 'flash-on', fallback: 'Zap' },
  flash_off: { defaultMaterial: 'flash-off', fallback: 'ZapOff' },
  notifications: { defaultMaterial: 'notifications', fallback: 'Bell' },
  account_circle: { defaultMaterial: 'account-circle', fallback: 'CircleUserRound' },
  add: { defaultMaterial: 'add', fallback: 'Plus' },
  add_circle: { defaultMaterial: 'add-circle', fallback: 'PlusCircle' },
  more_vert: { defaultMaterial: 'more-vert', fallback: 'EllipsisVertical' },
  trending: { defaultMaterial: 'trending-up', fallback: 'TrendingUp' },
  favorite: { defaultMaterial: 'favorite-border', filledMaterial: 'favorite', fallback: 'Heart' },
  edit: { defaultMaterial: 'edit', fallback: 'Pencil' },
  delete: { defaultMaterial: 'delete', fallback: 'Trash2' },
  delete_forever: { defaultMaterial: 'delete-forever', fallback: 'Trash2' },
  share: { defaultMaterial: 'share', fallback: 'Share2' },
  download: { defaultMaterial: 'download', fallback: 'Download' },
  lightbulb: { defaultMaterial: 'lightbulb', fallback: 'Lightbulb' },
  local_fire_department: { defaultMaterial: 'local-fire-department', fallback: 'Flame' },
  emoji_events: { defaultMaterial: 'emoji-events', fallback: 'Trophy' },
  shield: { defaultMaterial: 'shield', fallback: 'Shield' },
  lock: { defaultMaterial: 'lock', fallback: 'Lock' },
  cloud_off: { defaultMaterial: 'cloud-off', fallback: 'CloudOff' },
  info: { defaultMaterial: 'info', fallback: 'Info' },
  public: { defaultMaterial: 'public', fallback: 'Globe' },
  bar_chart: { defaultMaterial: 'bar-chart', fallback: 'ChartColumn' },
  monitor_weight: { defaultMaterial: 'monitor-weight', fallback: 'Scale' },
  fitness_center: { defaultMaterial: 'fitness-center', fallback: 'Dumbbell' },
  eco: { defaultMaterial: 'eco', fallback: 'Leaf' },
  science: { defaultMaterial: 'science', fallback: 'FlaskConical' },
  lunch_dining: { defaultMaterial: 'lunch-dining', fallback: 'UtensilsCrossed' },
  breakfast_dining: { defaultMaterial: 'free-breakfast', fallback: 'Coffee' },
  dinner_dining: { defaultMaterial: 'dinner-dining', fallback: 'ChefHat' },
  cookie: { defaultMaterial: 'cookie', fallback: 'Cookie' },
  egg: { defaultMaterial: 'egg-alt', fallback: 'EggFried' },
} satisfies Record<string, NutritionSymbolSpec>;

export interface MaterialSymbolProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

export function resolveNutritionSymbol(
  name: string,
  filled = false,
): NutritionSymbolSpec {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  const spec = SYMBOL_MAP[normalized as keyof typeof SYMBOL_MAP] as NutritionSymbolSpec | undefined;

  if (!spec) {
    return { defaultMaterial: 'radio-button-unchecked', fallback: 'Circle' };
  }

  if (filled && spec.filledMaterial) {
    return {
      ...spec,
      defaultMaterial: spec.filledMaterial,
    };
  }

  return spec;
}

export function MaterialSymbol({
  name,
  size = 20,
  color = NU_TEXT,
  strokeWidth = 2,
  filled = false,
}: MaterialSymbolProps) {
  const spec = resolveNutritionSymbol(name, filled);

  if (spec.defaultMaterial) {
    return (
      <MaterialIcons
        name={spec.defaultMaterial}
        size={size}
        color={color}
      />
    );
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
