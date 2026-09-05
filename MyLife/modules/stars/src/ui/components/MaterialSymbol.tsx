import type { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const SYMBOL_ICON_MAP = {
  star: { outlined: 'star-border', filled: 'star' },
  nightlight: { outlined: 'nights-stay', filled: 'bedtime' },
  auto_awesome: { outlined: 'auto-awesome', filled: 'auto-awesome' },
  dark_mode: { outlined: 'dark-mode', filled: 'dark-mode' },
  brightness_2: { outlined: 'brightness-2', filled: 'brightness-2' },
  book: { outlined: 'book', filled: 'book' },
  grid_view: { outlined: 'grid-view', filled: 'grid-view' },
  menu_book: { outlined: 'menu-book', filled: 'menu-book' },
  schedule: { outlined: 'schedule', filled: 'schedule' },
  favorite: { outlined: 'favorite-border', filled: 'favorite' },
  bookmark: { outlined: 'bookmark-border', filled: 'bookmark' },
  people: { outlined: 'people', filled: 'people' },
  search: { outlined: 'search', filled: 'search' },
  history: { outlined: 'history', filled: 'history' },
  add: { outlined: 'add', filled: 'add' },
  more_vert: { outlined: 'more-vert', filled: 'more-vert' },
  share: { outlined: 'share', filled: 'share' },
  edit: { outlined: 'edit', filled: 'edit' },
  edit_note: { outlined: 'edit-note', filled: 'edit-note' },
  delete: { outlined: 'delete', filled: 'delete' },
  help: { outlined: 'help-outline', filled: 'help' },
  warning: { outlined: 'warning-amber', filled: 'warning' },
  moon_stars: { outlined: 'nights-stay', filled: 'bedtime' },
  psychology: { outlined: 'psychology', filled: 'psychology' },
  local_florist: { outlined: 'local-florist', filled: 'local-florist' },
  tune: { outlined: 'tune', filled: 'tune' },
  settings: { outlined: 'settings', filled: 'settings' },
  notifications: { outlined: 'notifications-none', filled: 'notifications' },
  location_on: { outlined: 'location-on', filled: 'location-on' },
  visibility: { outlined: 'visibility', filled: 'visibility' },
  sunny: { outlined: 'wb-sunny', filled: 'wb-sunny' },
  close: { outlined: 'close', filled: 'close' },
  chevron_right: { outlined: 'chevron-right', filled: 'chevron-right' },
  chevron_left: { outlined: 'chevron-left', filled: 'chevron-left' },
  expand_more: { outlined: 'expand-more', filled: 'expand-more' },
  expand_less: { outlined: 'expand-less', filled: 'expand-less' },
  keyboard_arrow_down: { outlined: 'keyboard-arrow-down', filled: 'keyboard-arrow-down' },
  keyboard_arrow_up: { outlined: 'keyboard-arrow-up', filled: 'keyboard-arrow-up' },
  north: { outlined: 'north', filled: 'north' },
  south: { outlined: 'south', filled: 'south' },
  looks_one: { outlined: 'looks-one', filled: 'looks-one' },
  dashboard: { outlined: 'dashboard', filled: 'dashboard' },
  autorenew: { outlined: 'autorenew', filled: 'autorenew' },
  calendar_today: { outlined: 'calendar-today', filled: 'calendar-today' },
  auto_graph: { outlined: 'auto-graph', filled: 'auto-graph' },
  compare_arrows: { outlined: 'compare-arrows', filled: 'compare-arrows' },
  filter_alt: { outlined: 'filter-alt', filled: 'filter-alt' },
  style: { outlined: 'style', filled: 'style' },
  photo_camera: { outlined: 'photo-camera', filled: 'photo-camera' },
  photo_library: { outlined: 'photo-library', filled: 'photo-library' },
  image: { outlined: 'image', filled: 'image' },
  format_bold: { outlined: 'format-bold', filled: 'format-bold' },
  format_italic: { outlined: 'format-italic', filled: 'format-italic' },
  format_list_bulleted: {
    outlined: 'format-list-bulleted',
    filled: 'format-list-bulleted',
  },
  check_circle: { outlined: 'check-circle', filled: 'check-circle' },
  shield: { outlined: 'shield', filled: 'shield' },
  circle: { outlined: 'circle', filled: 'circle' },
  flare: { outlined: 'flare', filled: 'flare' },
  radio_button_unchecked: {
    outlined: 'radio-button-unchecked',
    filled: 'radio-button-unchecked',
  },
} as const satisfies Record<
  string,
  { outlined: MaterialIconName; filled: MaterialIconName }
>;

export type StarsMaterialSymbolName = keyof typeof SYMBOL_ICON_MAP;

export interface MaterialSymbolProps {
  name: StarsMaterialSymbolName | (string & {});
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function resolveStarsSymbol(
  name: string,
): { outlined: MaterialIconName; filled: MaterialIconName } {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  return (
    SYMBOL_ICON_MAP[normalized as keyof typeof SYMBOL_ICON_MAP] ??
    SYMBOL_ICON_MAP.radio_button_unchecked
  );
}

export function MaterialSymbol({
  name,
  size = 20,
  color = '#E4E1E9',
  filled = false,
  style,
}: MaterialSymbolProps) {
  const icon = resolveStarsSymbol(name);
  return (
    <MaterialIcons
      name={filled ? icon.filled : icon.outlined}
      size={size}
      color={color}
      style={style}
    />
  );
}
