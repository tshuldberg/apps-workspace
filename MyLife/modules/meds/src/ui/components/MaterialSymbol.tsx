import type { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const SYMBOL_MAP = {
  medication: { outlined: 'medication', filled: 'medication' },
  pill: { outlined: 'medication', filled: 'medication' },
  vaccines: { outlined: 'vaccines', filled: 'vaccines' },
  monitor_heart: { outlined: 'monitor-heart', filled: 'monitor-heart' },
  bloodtype: { outlined: 'bloodtype', filled: 'bloodtype' },
  diabetes: { outlined: 'water-drop', filled: 'water-drop' },
  water_drop: { outlined: 'water-drop', filled: 'water-drop' },
  mood: { outlined: 'mood', filled: 'mood' },
  psychology: { outlined: 'psychology', filled: 'psychology' },
  sick: { outlined: 'sick', filled: 'sick' },
  favorite: { outlined: 'favorite-border', filled: 'favorite' },
  healing: { outlined: 'healing', filled: 'healing' },
  restaurant_menu: { outlined: 'restaurant-menu', filled: 'restaurant-menu' },
  emoji_food_beverage: {
    outlined: 'emoji-food-beverage',
    filled: 'emoji-food-beverage',
  },
  call: { outlined: 'call', filled: 'call' },
  message: { outlined: 'message', filled: 'message' },
  search: { outlined: 'search', filled: 'search' },
  person_add: { outlined: 'person-add', filled: 'person-add' },
  contact_page: { outlined: 'contact-page', filled: 'contact-page' },
  local_pharmacy: { outlined: 'local-pharmacy', filled: 'local-pharmacy' },
  picture_as_pdf: { outlined: 'picture-as-pdf', filled: 'picture-as-pdf' },
  description: { outlined: 'description', filled: 'description' },
  visibility: { outlined: 'visibility', filled: 'visibility' },
  calendar_month: { outlined: 'calendar-month', filled: 'calendar-month' },
  emergency: { outlined: 'emergency', filled: 'emergency' },
  groups: { outlined: 'groups', filled: 'groups' },
  article: { outlined: 'article', filled: 'article' },
  inventory_2: { outlined: 'inventory-2', filled: 'inventory-2' },
  check: { outlined: 'check', filled: 'check' },
  cloud: { outlined: 'cloud', filled: 'cloud' },
  notifications: { outlined: 'notifications-none', filled: 'notifications' },
  notifications_active: { outlined: 'notifications-active', filled: 'notifications-active' },
  alarm: { outlined: 'alarm', filled: 'alarm' },
  fingerprint: { outlined: 'fingerprint', filled: 'fingerprint' },
  lock: { outlined: 'lock', filled: 'lock' },
  shield_person: { outlined: 'shield', filled: 'shield' },
  verified_user: { outlined: 'verified-user', filled: 'verified-user' },
  pin: { outlined: 'pin', filled: 'pin' },
  backspace: { outlined: 'backspace', filled: 'backspace' },
  lock_reset: { outlined: 'lock-reset', filled: 'lock-reset' },
  security: { outlined: 'security', filled: 'security' },
  history: { outlined: 'history', filled: 'history' },
  tune: { outlined: 'tune', filled: 'tune' },
  expand_more: { outlined: 'expand-more', filled: 'expand-more' },
  expand_less: { outlined: 'expand-less', filled: 'expand-less' },
  close: { outlined: 'close', filled: 'close' },
  settings: { outlined: 'settings', filled: 'settings' },
  dashboard_customize: {
    outlined: 'dashboard-customize',
    filled: 'dashboard-customize',
  },
  contacts: { outlined: 'contacts', filled: 'contacts' },
  timeline: { outlined: 'timeline', filled: 'timeline' },
  schedule: { outlined: 'schedule', filled: 'schedule' },
  calendar_today: { outlined: 'calendar-today', filled: 'calendar-today' },
  add: { outlined: 'add', filled: 'add' },
  more_vert: { outlined: 'more-vert', filled: 'more-vert' },
  more_horiz: { outlined: 'more-horiz', filled: 'more-horiz' },
  edit: { outlined: 'edit', filled: 'edit' },
  delete: { outlined: 'delete-outline', filled: 'delete' },
  chevron_left: { outlined: 'chevron-left', filled: 'chevron-left' },
  chevron_right: { outlined: 'chevron-right', filled: 'chevron-right' },
  arrow_forward: { outlined: 'arrow-forward', filled: 'arrow-forward' },
  share: { outlined: 'share', filled: 'share' },
  download: { outlined: 'download', filled: 'download' },
  refresh: { outlined: 'refresh', filled: 'refresh' },
  trending_up: { outlined: 'trending-up', filled: 'trending-up' },
  trending_down: { outlined: 'trending-down', filled: 'trending-down' },
  warning: { outlined: 'warning-amber', filled: 'warning' },
  dangerous: { outlined: 'dangerous', filled: 'dangerous' },
  info: { outlined: 'info-outline', filled: 'info' },
  priority_high: { outlined: 'priority-high', filled: 'priority-high' },
  check_circle: { outlined: 'check-circle-outline', filled: 'check-circle' },
  local_hospital: { outlined: 'local-hospital', filled: 'local-hospital' },
  stethoscope: { outlined: 'medical-services', filled: 'medical-services' },
  medical_services: { outlined: 'medical-services', filled: 'medical-services' },
  science: { outlined: 'science', filled: 'science' },
  assignment: { outlined: 'assignment', filled: 'assignment' },
  family_restroom: { outlined: 'family-restroom', filled: 'family-restroom' },
  event: { outlined: 'event', filled: 'event' },
  phone: { outlined: 'phone', filled: 'phone' },
  email: { outlined: 'email', filled: 'email' },
  person: { outlined: 'person-outline', filled: 'person' },
  face: { outlined: 'face', filled: 'face' },
  dark_mode: { outlined: 'dark-mode', filled: 'dark-mode' },
  wb_twilight: { outlined: 'wb-twilight', filled: 'wb-twilight' },
  bedtime: { outlined: 'bedtime', filled: 'bedtime' },
  coffee: { outlined: 'coffee', filled: 'coffee' },
  restaurant: { outlined: 'restaurant', filled: 'restaurant' },
  fitness_center: { outlined: 'fitness-center', filled: 'fitness-center' },
  smart_toy: { outlined: 'smart-toy', filled: 'smart-toy' },
  music_note: { outlined: 'music-note', filled: 'music-note' },
  play_arrow: { outlined: 'play-arrow', filled: 'play-arrow' },
  place: { outlined: 'place', filled: 'place' },
  directions: { outlined: 'directions', filled: 'directions' },
  event_seat: { outlined: 'event-seat', filled: 'event-seat' },
  accessibility_new: { outlined: 'accessibility-new', filled: 'accessibility-new' },
  airline_seat_recline_normal: {
    outlined: 'airline-seat-recline-normal',
    filled: 'airline-seat-recline-normal',
  },
  front_hand: { outlined: 'front-hand', filled: 'front-hand' },
  bed: { outlined: 'hotel', filled: 'hotel' },
  star: { outlined: 'star-border', filled: 'star' },
} as const satisfies Record<
  string,
  { outlined: MaterialIconName; filled: MaterialIconName }
>;

export type MedsMaterialSymbolName = keyof typeof SYMBOL_MAP;

export interface MaterialSymbolProps {
  name: MedsMaterialSymbolName | string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function resolveMedsMaterialSymbol(name: string) {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  return SYMBOL_MAP[normalized as MedsMaterialSymbolName] ?? {
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
  const icon = resolveMedsMaterialSymbol(name);

  return (
    <MaterialIcons
      color={color}
      name={filled ? icon.filled : icon.outlined}
      size={size}
      style={style}
    />
  );
}
