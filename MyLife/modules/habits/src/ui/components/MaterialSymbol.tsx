import type { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const SYMBOL_MAP = {
  check_circle: {
    outlined: 'check-circle-outline',
    filled: 'check-circle',
  },
  list_alt: {
    outlined: 'list-alt',
    filled: 'list-alt',
  },
  bar_chart: {
    outlined: 'bar-chart',
    filled: 'bar-chart',
  },
  settings: {
    outlined: 'settings',
    filled: 'settings',
  },
  local_fire_department: {
    outlined: 'local-fire-department',
    filled: 'local-fire-department',
  },
  bolt: {
    outlined: 'bolt',
    filled: 'bolt',
  },
  psychology: {
    outlined: 'psychology',
    filled: 'psychology',
  },
  favorite: {
    outlined: 'favorite-border',
    filled: 'favorite',
  },
  fitness_center: {
    outlined: 'fitness-center',
    filled: 'fitness-center',
  },
  attach_money: {
    outlined: 'attach-money',
    filled: 'attach-money',
  },
  people: {
    outlined: 'people',
    filled: 'people',
  },
  eco: {
    outlined: 'eco',
    filled: 'eco',
  },
  schedule: {
    outlined: 'schedule',
    filled: 'schedule',
  },
  alarm: {
    outlined: 'alarm',
    filled: 'alarm',
  },
  location_on: {
    outlined: 'location-on',
    filled: 'location-on',
  },
  mic: {
    outlined: 'mic',
    filled: 'mic',
  },
  smart_toy: {
    outlined: 'smart-toy',
    filled: 'smart-toy',
  },
  military_tech: {
    outlined: 'military-tech',
    filled: 'military-tech',
  },
  pets: {
    outlined: 'pets',
    filled: 'pets',
  },
  sports_esports: {
    outlined: 'sports-esports',
    filled: 'sports-esports',
  },
  groups: {
    outlined: 'groups',
    filled: 'groups',
  },
  school: {
    outlined: 'school',
    filled: 'school',
  },
  more_horiz: {
    outlined: 'more-horiz',
    filled: 'more-horiz',
  },
  add: {
    outlined: 'add',
    filled: 'add',
  },
  search: {
    outlined: 'search',
    filled: 'search',
  },
  more_vert: {
    outlined: 'more-vert',
    filled: 'more-vert',
  },
  notifications: {
    outlined: 'notifications-none',
    filled: 'notifications',
  },
  edit: {
    outlined: 'edit',
    filled: 'edit',
  },
  tune: {
    outlined: 'tune',
    filled: 'tune',
  },
  delete: {
    outlined: 'delete-outline',
    filled: 'delete',
  },
  archive: {
    outlined: 'archive',
    filled: 'archive',
  },
  restore: {
    outlined: 'restore',
    filled: 'restore',
  },
  share: {
    outlined: 'share',
    filled: 'share',
  },
  check: {
    outlined: 'check',
    filled: 'check',
  },
  close: {
    outlined: 'close',
    filled: 'close',
  },
  play_arrow: {
    outlined: 'play-arrow',
    filled: 'play-arrow',
  },
  pause: {
    outlined: 'pause',
    filled: 'pause',
  },
  stop: {
    outlined: 'stop',
    filled: 'stop',
  },
  timer: {
    outlined: 'timer',
    filled: 'timer',
  },
  health_and_safety: {
    outlined: 'health-and-safety',
    filled: 'health-and-safety',
  },
  grid_view: {
    outlined: 'grid-view',
    filled: 'grid-view',
  },
  category: {
    outlined: 'category',
    filled: 'category',
  },
  link: {
    outlined: 'link',
    filled: 'link',
  },
  arrow_upward: {
    outlined: 'arrow-upward',
    filled: 'arrow-upward',
  },
  arrow_downward: {
    outlined: 'arrow-downward',
    filled: 'arrow-downward',
  },
  expand_less: {
    outlined: 'expand-less',
    filled: 'expand-less',
  },
  expand_more: {
    outlined: 'expand-more',
    filled: 'expand-more',
  },
  chevron_right: {
    outlined: 'chevron-right',
    filled: 'chevron-right',
  },
} as const satisfies Record<
  string,
  { outlined: MaterialIconName; filled: MaterialIconName }
>;

export type HabitsMaterialSymbolName = keyof typeof SYMBOL_MAP;

export interface MaterialSymbolProps {
  name: HabitsMaterialSymbolName | (string & {});
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function resolveHabitsSymbol(name: string) {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  return SYMBOL_MAP[normalized as HabitsMaterialSymbolName] ?? {
    outlined: 'help-outline' as MaterialIconName,
    filled: 'help' as MaterialIconName,
  };
}

export function MaterialSymbol({
  name,
  size = 20,
  color = '#E4E1E9',
  filled = false,
  style,
}: MaterialSymbolProps) {
  const icon = resolveHabitsSymbol(name);

  return (
    <MaterialIcons
      name={filled ? icon.filled : icon.outlined}
      size={size}
      color={color}
      style={style}
    />
  );
}
