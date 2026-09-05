import type { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Material Symbols name mapping for MyPresence.
 *
 * Symbol name              outlined icon            filled icon
 * home                     home                     home-filled
 * insights                 insights                 insights
 * timer                    timer                    timer
 * settings                 settings                 settings
 * tune                     tune                     tune
 * bolt                     bolt                     bolt
 * local_fire_department    local-fire-department    local-fire-department
 * psychology               psychology               psychology
 * diamond                  diamond                  diamond
 * bedtime                  bedtime                  bedtime
 * arrow_back               arrow-back               arrow-back
 * arrow_downward           arrow-downward           arrow-downward
 * arrow_upward             arrow-upward             arrow-upward
 * camera_alt               photo-camera             photo-camera
 * chat                     chat                     chat
 * groups                   groups                   groups
 * explore                  explore                  explore
 * play_circle              play-circle-outline      play-circle-filled
 * music_note               music-note               music-note
 * lightbulb                lightbulb-outline        lightbulb
 * share                    share                    share
 * more_horiz               more-horiz               more-horiz
 * more_vert                more-vert                more-vert
 * lock                     lock                     lock
 * check_circle             check-circle             check-circle
 * check                    check                    check
 * close                    close                    close
 * add                      add                      add
 * remove                   remove                   remove
 * chevron_left             chevron-left             chevron-left
 * chevron_right            chevron-right            chevron-right
 * repeat                   repeat                   repeat
 * person_add               person-add               person-add
 * alarm                    alarm                    alarm
 * card_giftcard            card-giftcard            card-giftcard
 * emoji_events             emoji-events             emoji-events
 * handshake                handshake                handshake
 * self_improvement         self-improvement         self-improvement
 * air                      air                      air
 * edit                     edit                     edit
 * content_copy             content-copy             content-copy
 * radio_button_unchecked   radio-button-unchecked   radio-button-unchecked
 * radio_button_checked     radio-button-checked     radio-button-checked
 * pause_circle             pause-circle-outline     pause-circle-filled
 * auto_awesome             auto-awesome             auto-awesome
 * download                 download                 download
 * delete_forever           delete-forever           delete-forever
 * open_in_new              open-in-new              open-in-new
 * refresh                  refresh                  refresh
 * schedule                 schedule                 schedule
 * person                   person                   person
 * groups                   groups                   groups
 * task_alt                 task-alt                 task-alt
 * movie                    movie                    movie
 */
const SYMBOL_ICON_MAP = {
  home: { outlined: 'home', filled: 'home-filled' },
  insights: { outlined: 'insights', filled: 'insights' },
  timer: { outlined: 'timer', filled: 'timer' },
  settings: { outlined: 'settings', filled: 'settings' },
  tune: { outlined: 'tune', filled: 'tune' },
  bolt: { outlined: 'bolt', filled: 'bolt' },
  local_fire_department: { outlined: 'local-fire-department', filled: 'local-fire-department' },
  psychology: { outlined: 'psychology', filled: 'psychology' },
  diamond: { outlined: 'diamond', filled: 'diamond' },
  bedtime: { outlined: 'bedtime', filled: 'bedtime' },
  arrow_back: { outlined: 'arrow-back', filled: 'arrow-back' },
  arrow_downward: { outlined: 'arrow-downward', filled: 'arrow-downward' },
  arrow_upward: { outlined: 'arrow-upward', filled: 'arrow-upward' },
  camera_alt: { outlined: 'photo-camera', filled: 'photo-camera' },
  chat: { outlined: 'chat', filled: 'chat' },
  groups: { outlined: 'groups', filled: 'groups' },
  explore: { outlined: 'explore', filled: 'explore' },
  play_circle: { outlined: 'play-circle-outline', filled: 'play-circle-filled' },
  music_note: { outlined: 'music-note', filled: 'music-note' },
  lightbulb: { outlined: 'lightbulb-outline', filled: 'lightbulb' },
  share: { outlined: 'share', filled: 'share' },
  more_horiz: { outlined: 'more-horiz', filled: 'more-horiz' },
  more_vert: { outlined: 'more-vert', filled: 'more-vert' },
  lock: { outlined: 'lock', filled: 'lock' },
  check_circle: { outlined: 'check-circle', filled: 'check-circle' },
  check: { outlined: 'check', filled: 'check' },
  close: { outlined: 'close', filled: 'close' },
  add: { outlined: 'add', filled: 'add' },
  remove: { outlined: 'remove', filled: 'remove' },
  chevron_left: { outlined: 'chevron-left', filled: 'chevron-left' },
  chevron_right: { outlined: 'chevron-right', filled: 'chevron-right' },
  repeat: { outlined: 'repeat', filled: 'repeat' },
  person_add: { outlined: 'person-add', filled: 'person-add' },
  alarm: { outlined: 'alarm', filled: 'alarm' },
  card_giftcard: { outlined: 'card-giftcard', filled: 'card-giftcard' },
  emoji_events: { outlined: 'emoji-events', filled: 'emoji-events' },
  handshake: { outlined: 'handshake', filled: 'handshake' },
  self_improvement: { outlined: 'self-improvement', filled: 'self-improvement' },
  air: { outlined: 'air', filled: 'air' },
  edit: { outlined: 'edit', filled: 'edit' },
  content_copy: { outlined: 'content-copy', filled: 'content-copy' },
  radio_button_unchecked: { outlined: 'radio-button-unchecked', filled: 'radio-button-unchecked' },
  radio_button_checked: { outlined: 'radio-button-checked', filled: 'radio-button-checked' },
  pause_circle: { outlined: 'pause-circle-outline', filled: 'pause-circle-filled' },
  auto_awesome: { outlined: 'auto-awesome', filled: 'auto-awesome' },
  download: { outlined: 'download', filled: 'download' },
  delete_forever: { outlined: 'delete-forever', filled: 'delete-forever' },
  open_in_new: { outlined: 'open-in-new', filled: 'open-in-new' },
  refresh: { outlined: 'refresh', filled: 'refresh' },
  schedule: { outlined: 'schedule', filled: 'schedule' },
  person: { outlined: 'person', filled: 'person' },
  task_alt: { outlined: 'task-alt', filled: 'task-alt' },
  movie: { outlined: 'movie', filled: 'movie' },
} as const satisfies Record<string, { outlined: MaterialIconName; filled: MaterialIconName }>;

export type PresenceMaterialSymbolName = keyof typeof SYMBOL_ICON_MAP;

export interface MaterialSymbolProps {
  name: PresenceMaterialSymbolName;
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
  const icon = SYMBOL_ICON_MAP[name];
  return (
    <MaterialIcons
      name={filled ? icon.filled : icon.outlined}
      size={size}
      color={color}
      style={style}
    />
  );
}
