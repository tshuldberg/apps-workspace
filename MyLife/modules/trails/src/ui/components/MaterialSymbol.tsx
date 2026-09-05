import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * MyTrails design-symbol to runtime icon mapping.
 *
 * map                     -> map
 * navigation              -> navigation
 * activity                -> directions-walk
 * settings                -> settings
 * download_for_offline    -> download-for-offline
 * hiking                  -> hiking
 * location_on             -> location-on
 * place                   -> place
 * landscape               -> landscape
 * terrain                 -> terrain
 * straighten              -> straighten
 * elevation               -> terrain
 * schedule                -> schedule
 * directions_walk         -> directions-walk
 * cloud                   -> cloud
 * partly_cloudy_day       -> wb-cloudy
 * sunny                   -> wb-sunny
 * rainy                   -> grain
 * thunderstorm            -> flash-on
 * air                     -> air
 * opacity                 -> opacity
 * visibility              -> visibility
 * device_thermostat       -> device-thermostat
 * photo_camera            -> photo-camera
 * photo_library           -> photo-library
 * collections             -> collections
 * image                   -> image
 * grid_view               -> grid-view
 * timeline                -> timeline
 * calendar_today          -> calendar-today
 * backpack                -> backpack
 * group                   -> group
 * star                    -> star-border/star
 * favorite                -> favorite-border/favorite
  * flag                    -> flag
  * play_arrow              -> play-arrow
  * pause                   -> pause
  * stop                    -> stop
 * fiber_manual_record     -> fiber-manual-record
 * waypoint                -> trip-origin
 * route                   -> route
 * add                     -> add
 * more_vert               -> more-vert
 * share                   -> ios-share
 * filter_list             -> filter-list
 * sort                    -> sort
 * search                  -> search
  * menu                    -> menu
  * trending_up             -> trending-up
  * warning                 -> warning
 * check_circle            -> check-circle
 * refresh                 -> refresh
 * delete                  -> delete-outline/delete
 * close                   -> close
 * my_location             -> my-location
 * zoom_in                 -> zoom-in
 * zoom_out                -> zoom-out
 * storage                 -> storage
 * cloud_off               -> cloud-off
 * tune                    -> tune
 * check_box               -> check-box
 * check_box_outline_blank -> check-box-outline-blank
 * arrow_back              -> arrow-back
 * home                    -> home/home-filled
 */
const SYMBOL_MAP = {
  map: { outlined: 'map', filled: 'map' },
  navigation: { outlined: 'navigation', filled: 'navigation' },
  activity: { outlined: 'directions-walk', filled: 'directions-walk' },
  settings: { outlined: 'settings', filled: 'settings' },
  download_for_offline: {
    outlined: 'download-for-offline',
    filled: 'download-for-offline',
  },
  hiking: { outlined: 'hiking', filled: 'hiking' },
  location_on: { outlined: 'location-on', filled: 'location-on' },
  place: { outlined: 'place', filled: 'place' },
  landscape: { outlined: 'landscape', filled: 'landscape' },
  terrain: { outlined: 'terrain', filled: 'terrain' },
  straighten: { outlined: 'straighten', filled: 'straighten' },
  elevation: { outlined: 'terrain', filled: 'terrain' },
  schedule: { outlined: 'schedule', filled: 'schedule' },
  directions_walk: {
    outlined: 'directions-walk',
    filled: 'directions-walk',
  },
  cloud: { outlined: 'cloud', filled: 'cloud' },
  partly_cloudy_day: { outlined: 'wb-cloudy', filled: 'wb-cloudy' },
  sunny: { outlined: 'wb-sunny', filled: 'wb-sunny' },
  rainy: { outlined: 'grain', filled: 'grain' },
  thunderstorm: { outlined: 'flash-on', filled: 'flash-on' },
  air: { outlined: 'air', filled: 'air' },
  opacity: { outlined: 'opacity', filled: 'opacity' },
  visibility: { outlined: 'visibility', filled: 'visibility' },
  device_thermostat: {
    outlined: 'device-thermostat',
    filled: 'device-thermostat',
  },
  photo_camera: { outlined: 'photo-camera', filled: 'photo-camera' },
  photo_library: { outlined: 'photo-library', filled: 'photo-library' },
  collections: { outlined: 'collections', filled: 'collections' },
  image: { outlined: 'image', filled: 'image' },
  grid_view: { outlined: 'grid-view', filled: 'grid-view' },
  timeline: { outlined: 'timeline', filled: 'timeline' },
  calendar_today: { outlined: 'calendar-today', filled: 'calendar-today' },
  backpack: { outlined: 'backpack', filled: 'backpack' },
  group: { outlined: 'group', filled: 'group' },
  star: { outlined: 'star-border', filled: 'star' },
  favorite: { outlined: 'favorite-border', filled: 'favorite' },
  flag: { outlined: 'flag', filled: 'flag' },
  play_arrow: { outlined: 'play-arrow', filled: 'play-arrow' },
  pause: { outlined: 'pause', filled: 'pause' },
  stop: { outlined: 'stop', filled: 'stop' },
  fiber_manual_record: {
    outlined: 'fiber-manual-record',
    filled: 'fiber-manual-record',
  },
  waypoint: { outlined: 'trip-origin', filled: 'trip-origin' },
  route: { outlined: 'route', filled: 'route' },
  add: { outlined: 'add', filled: 'add' },
  more_vert: { outlined: 'more-vert', filled: 'more-vert' },
  share: { outlined: 'ios-share', filled: 'ios-share' },
  filter_list: { outlined: 'filter-list', filled: 'filter-list' },
  sort: { outlined: 'sort', filled: 'sort' },
  search: { outlined: 'search', filled: 'search' },
  menu: { outlined: 'menu', filled: 'menu' },
  trending_up: { outlined: 'trending-up', filled: 'trending-up' },
  warning: { outlined: 'warning', filled: 'warning' },
  check_circle: { outlined: 'check-circle', filled: 'check-circle' },
  refresh: { outlined: 'refresh', filled: 'refresh' },
  delete: { outlined: 'delete-outline', filled: 'delete' },
  close: { outlined: 'close', filled: 'close' },
  my_location: { outlined: 'my-location', filled: 'my-location' },
  zoom_in: { outlined: 'zoom-in', filled: 'zoom-in' },
  zoom_out: { outlined: 'zoom-out', filled: 'zoom-out' },
  storage: { outlined: 'storage', filled: 'storage' },
  cloud_off: { outlined: 'cloud-off', filled: 'cloud-off' },
  tune: { outlined: 'tune', filled: 'tune' },
  check_box: { outlined: 'check-box', filled: 'check-box' },
  check_box_outline_blank: {
    outlined: 'check-box-outline-blank',
    filled: 'check-box-outline-blank',
  },
  arrow_back: { outlined: 'arrow-back', filled: 'arrow-back' },
  home: { outlined: 'home', filled: 'home-filled' },
} as const satisfies Record<
  string,
  { outlined: MaterialIconName; filled: MaterialIconName }
>;

export type TrailsMaterialSymbolName = keyof typeof SYMBOL_MAP;

export interface MaterialSymbolProps {
  name: TrailsMaterialSymbolName | string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function resolveTrailSymbol(name: string) {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  return SYMBOL_MAP[normalized as TrailsMaterialSymbolName] ?? {
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
  const icon = resolveTrailSymbol(name);

  return (
    <MaterialIcons
      name={filled ? icon.filled : icon.outlined}
      size={size}
      color={color}
      style={style}
    />
  );
}
