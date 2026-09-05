import type { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Material Symbols name mapping for MyMarket.
 *
 * symbol                   outlined                   filled
 * menu                     menu                       menu
 * search                   search                     search
 * devices                  devices                    devices
 * checkroom                checkroom                  checkroom
 * home_repair_service      home-repair-service        home-repair-service
 * sports_basketball        sports-basketball          sports-basketball
 * menu_book                menu-book                  menu-book
 * directions_car           directions-car             directions-car
 * support_agent            support-agent              support-agent
 * favorite_border          favorite-border            favorite
 * favorite                 favorite-border            favorite
 * star_border              star-border                star
 * star                     star-border                star
 * store                    storefront                 storefront
 * storefront               storefront                 storefront
 * message                  message                    message
  * account_circle           account-circle             account-circle
  * add                      add                        add
 * more_vert                more-vert                  more-vert
 * share                    share                      share
 * flag                     flag                       flag
 * verified                 verified                   verified
 * lock                     lock                       lock
 * payments                 payments                   payments
 * local_shipping           local-shipping             local-shipping
 * gavel                    gavel                      gavel
 * photo_camera             photo-camera               photo-camera
 * school                   school                     school
 * design_services          design-services            design-services
 * cleaning_services        cleaning-services          cleaning-services
 * psychology               psychology                 psychology
 * block                    block                      block
 * check_circle             check-circle-outline       check-circle
 * download                 download                   download
 * location_on              location-on                location-on
 * schedule                 schedule                   schedule
 * arrow_back               arrow-back                 arrow-back
 * home                     home                       home-filled
 * swap_horiz               swap-horiz                 swap-horiz
 * redeem                   redeem                     redeem
 * build                    build                      build
 * crown                    workspace-premium          workspace-premium
 * close                    close                      close
 * chevron_right            chevron-right              chevron-right
 * expand_more              expand-more                expand-more
 * expand_less              expand-less                expand-less
 * arrow_downward           arrow-downward             arrow-downward
 * arrow_upward             arrow-upward               arrow-upward
 * thumb_up                 thumb-up-off-alt           thumb-up-alt
 * delete                   delete-outline            delete
 * edit                     edit                       edit
 * notifications            notifications-none         notifications
 * notifications_off        notifications-off          notifications-off
 * sort                     sort                       sort
 * tune                     tune                       tune
 * check                    check                      check
 * send                     send                       send
 * credit_card              credit-card                credit-card
 * escalator_warning        escalator-warning          escalator-warning
 * sell                     storefront                 storefront
 */
const SYMBOL_MAP = {
  menu: { outlined: 'menu', filled: 'menu' },
  search: { outlined: 'search', filled: 'search' },
  devices: { outlined: 'devices', filled: 'devices' },
  checkroom: { outlined: 'checkroom', filled: 'checkroom' },
  home_repair_service: {
    outlined: 'home-repair-service',
    filled: 'home-repair-service',
  },
  sports_basketball: {
    outlined: 'sports-basketball',
    filled: 'sports-basketball',
  },
  menu_book: { outlined: 'menu-book', filled: 'menu-book' },
  directions_car: {
    outlined: 'directions-car',
    filled: 'directions-car',
  },
  support_agent: {
    outlined: 'support-agent',
    filled: 'support-agent',
  },
  favorite_border: {
    outlined: 'favorite-border',
    filled: 'favorite',
  },
  favorite: {
    outlined: 'favorite-border',
    filled: 'favorite',
  },
  star_border: {
    outlined: 'star-border',
    filled: 'star',
  },
  star: {
    outlined: 'star-border',
    filled: 'star',
  },
  store: { outlined: 'storefront', filled: 'storefront' },
  storefront: { outlined: 'storefront', filled: 'storefront' },
  message: { outlined: 'message', filled: 'message' },
  account_circle: {
    outlined: 'account-circle',
    filled: 'account-circle',
  },
  add: { outlined: 'add', filled: 'add' },
  more_vert: { outlined: 'more-vert', filled: 'more-vert' },
  share: { outlined: 'share', filled: 'share' },
  flag: { outlined: 'flag', filled: 'flag' },
  verified: { outlined: 'verified', filled: 'verified' },
  lock: { outlined: 'lock', filled: 'lock' },
  payments: { outlined: 'payments', filled: 'payments' },
  local_shipping: {
    outlined: 'local-shipping',
    filled: 'local-shipping',
  },
  gavel: { outlined: 'gavel', filled: 'gavel' },
  photo_camera: {
    outlined: 'photo-camera',
    filled: 'photo-camera',
  },
  school: {
    outlined: 'school',
    filled: 'school',
  },
  design_services: {
    outlined: 'design-services',
    filled: 'design-services',
  },
  cleaning_services: {
    outlined: 'cleaning-services',
    filled: 'cleaning-services',
  },
  psychology: {
    outlined: 'psychology',
    filled: 'psychology',
  },
  block: {
    outlined: 'block',
    filled: 'block',
  },
  check_circle: {
    outlined: 'check-circle-outline',
    filled: 'check-circle',
  },
  download: {
    outlined: 'download',
    filled: 'download',
  },
  location_on: { outlined: 'location-on', filled: 'location-on' },
  schedule: { outlined: 'schedule', filled: 'schedule' },
  arrow_back: { outlined: 'arrow-back', filled: 'arrow-back' },
  home: { outlined: 'home', filled: 'home-filled' },
  swap_horiz: { outlined: 'swap-horiz', filled: 'swap-horiz' },
  redeem: { outlined: 'redeem', filled: 'redeem' },
  build: { outlined: 'build', filled: 'build' },
  crown: {
    outlined: 'workspace-premium',
    filled: 'workspace-premium',
  },
  close: { outlined: 'close', filled: 'close' },
  chevron_right: {
    outlined: 'chevron-right',
    filled: 'chevron-right',
  },
  expand_more: {
    outlined: 'expand-more',
    filled: 'expand-more',
  },
  expand_less: {
    outlined: 'expand-less',
    filled: 'expand-less',
  },
  arrow_downward: {
    outlined: 'arrow-downward',
    filled: 'arrow-downward',
  },
  arrow_upward: {
    outlined: 'arrow-upward',
    filled: 'arrow-upward',
  },
  thumb_up: {
    outlined: 'thumb-up-off-alt',
    filled: 'thumb-up-alt',
  },
  delete: {
    outlined: 'delete-outline',
    filled: 'delete',
  },
  edit: {
    outlined: 'edit',
    filled: 'edit',
  },
  notifications: {
    outlined: 'notifications-none',
    filled: 'notifications',
  },
  notifications_off: {
    outlined: 'notifications-off',
    filled: 'notifications-off',
  },
  sort: {
    outlined: 'sort',
    filled: 'sort',
  },
  tune: {
    outlined: 'tune',
    filled: 'tune',
  },
  check: {
    outlined: 'check',
    filled: 'check',
  },
  send: {
    outlined: 'send',
    filled: 'send',
  },
  credit_card: {
    outlined: 'credit-card',
    filled: 'credit-card',
  },
  escalator_warning: {
    outlined: 'escalator-warning',
    filled: 'escalator-warning',
  },
  sell: { outlined: 'storefront', filled: 'storefront' },
} as const satisfies Record<string, { outlined: MaterialIconName; filled: MaterialIconName }>;

export type MarketMaterialSymbolName = keyof typeof SYMBOL_MAP;

export interface MaterialSymbolProps {
  name: MarketMaterialSymbolName | string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function resolveMarketMaterialSymbol(name: string) {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  return SYMBOL_MAP[normalized as MarketMaterialSymbolName] ?? {
    outlined: 'help-outline' as MaterialIconName,
    filled: 'help' as MaterialIconName,
  };
}

export function MaterialSymbol({
  name,
  size = 20,
  color,
  filled = false,
  style,
}: MaterialSymbolProps) {
  const icon = resolveMarketMaterialSymbol(name);

  return (
    <MaterialIcons
      name={filled ? icon.filled : icon.outlined}
      size={size}
      color={color}
      style={style}
    />
  );
}
