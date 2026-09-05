import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const SYMBOL_MAP = {
  newspaper: { outlined: 'newspaper', filled: 'newspaper' },
  groups: { outlined: 'groups', filled: 'groups' },
  search: { outlined: 'search', filled: 'search' },
  bookmark: { outlined: 'bookmark-border', filled: 'bookmark' },
  account_circle: { outlined: 'account-circle', filled: 'account-circle' },
  close: { outlined: 'close', filled: 'close' },
  arrow_upward: { outlined: 'arrow-upward', filled: 'arrow-upward' },
  arrow_downward: { outlined: 'arrow-downward', filled: 'arrow-downward' },
  chat_bubble: { outlined: 'chat-bubble-outline', filled: 'chat-bubble' },
  push_pin: { outlined: 'push-pin', filled: 'push-pin' },
  verified_user: { outlined: 'verified-user', filled: 'verified-user' },
  shield: { outlined: 'shield', filled: 'shield' },
  tag: { outlined: 'local-offer', filled: 'sell' },
  add: { outlined: 'add', filled: 'add' },
  edit: { outlined: 'edit', filled: 'edit' },
  delete: { outlined: 'delete-outline', filled: 'delete' },
  more_vert: { outlined: 'more-vert', filled: 'more-vert' },
  flag: { outlined: 'flag', filled: 'flag' },
  block: { outlined: 'block', filled: 'block' },
  mic: { outlined: 'mic-none', filled: 'mic' },
  send: { outlined: 'send', filled: 'send' },
  photo_camera: { outlined: 'photo-camera', filled: 'photo-camera' },
  image: { outlined: 'image', filled: 'image' },
  link: { outlined: 'link', filled: 'link' },
  notifications: { outlined: 'notifications-none', filled: 'notifications' },
  trending_up: { outlined: 'trending-up', filled: 'trending-up' },
  gavel: { outlined: 'gavel', filled: 'gavel' },
  lock: { outlined: 'lock-outline', filled: 'lock' },
  archive: { outlined: 'archive', filled: 'archive' },
  done_all: { outlined: 'done-all', filled: 'done-all' },
  play_arrow: { outlined: 'play-arrow', filled: 'play-arrow' },
  pause: { outlined: 'pause', filled: 'pause' },
  arrow_back: { outlined: 'arrow-back', filled: 'arrow-back' },
  person_add: { outlined: 'person-add', filled: 'person-add' },
  check: { outlined: 'check', filled: 'check' },
  refresh: { outlined: 'refresh', filled: 'refresh' },
} as const satisfies Record<string, { outlined: MaterialIconName; filled: MaterialIconName }>;

export type ForumsMaterialSymbolName = keyof typeof SYMBOL_MAP;

export interface MaterialSymbolProps {
  name: ForumsMaterialSymbolName;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function MaterialSymbol({
  name,
  size = 20,
  color,
  filled = false,
  style,
}: MaterialSymbolProps) {
  const icon = SYMBOL_MAP[name];

  return (
    <MaterialIcons
      name={filled ? icon.filled : icon.outlined}
      size={size}
      color={color}
      style={style}
    />
  );
}
