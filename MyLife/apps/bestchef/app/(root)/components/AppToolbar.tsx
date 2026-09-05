import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Flame, Plus, Search, Settings, SlidersHorizontal } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { PinwheelMenu } from './PinwheelMenu';

const SMALL_SCREEN_BREAKPOINT = 360;

export interface AppToolbarProps {
  onSearch?: () => void;
  onSubmit?: () => void;
  onNotifications?: () => void;
  onSettings?: () => void;
  onFilter?: () => void;
  transparent?: boolean;
  /** When provided, replaces the brand mark on the left with a titled heading. */
  title?: string;
  /** Optional icon rendered to the left of the title text. */
  titleIcon?: ReactNode;
  /** When set, the pinwheel reads per-page action overrides for this key. */
  pinwheelPageKey?: string;
  /** Hide the pinwheel anchor entirely on this screen. */
  hidePinwheel?: boolean;
}

export function AppToolbar({
  onSearch,
  onSubmit,
  onNotifications,
  onSettings,
  onFilter,
  transparent = false,
  title,
  titleIcon,
  pinwheelPageKey,
  hidePinwheel = false,
}: AppToolbarProps) {
  const tc = useAppThemeColors();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const { count } = useUnreadNotifications();

  const isSmallScreen = width < SMALL_SCREEN_BREAKPOINT;
  const badgeLabel = count > 9 ? '9+' : String(count);

  return (
    <View
      style={[
        styles.toolbar,
        { backgroundColor: transparent ? 'transparent' : tc.background },
      ]}
      accessibilityRole="toolbar"
    >
      {/* Brand mark or custom title */}
      {title != null ? (
        <View style={styles.brandMark}>
          {titleIcon != null && <View style={styles.titleIconWrap}>{titleIcon}</View>}
          <Text style={[styles.titleText, { color: tc.text }]}>{t(title)}</Text>
        </View>
      ) : (
        <View style={styles.brandMark} accessibilityLabel={t('BestChef')}>
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandIcon}
          >
            <Flame size={15} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
          </LinearGradient>
          {!isSmallScreen && (
            <Text style={[styles.brandWordmark, { color: tc.text }]}>BestChef</Text>
          )}
        </View>
      )}

      {/* Right actions — each rendered only when its callback is provided */}
      <View style={styles.actions}>
        {/* Pinwheel quick-actions menu (always rendered unless explicitly hidden) */}
        {!hidePinwheel && (
          <PinwheelMenu pageKey={pinwheelPageKey} size={30} />
        )}

        {/* Search */}
        {onSearch != null && (
          <Pressable
            hitSlop={8}
            onPress={onSearch}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('Search')}
          >
            <Search size={19} color={tc.text} strokeWidth={2} />
          </Pressable>
        )}

        {/* Submit */}
        {onSubmit != null && (
          <Pressable
            hitSlop={8}
            onPress={onSubmit}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('Submit a recipe')}
          >
            <LinearGradient
              colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={3} />
            </LinearGradient>
          </Pressable>
        )}

        {/* Bell with unread badge */}
        {onNotifications != null && (
          <Pressable
            hitSlop={8}
            onPress={onNotifications}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={
              count > 0
                ? t('{count} unread notifications', { count: String(count) })
                : t('Notifications')
            }
          >
            <View style={styles.bellWrap}>
              <Bell
                size={19}
                color={tc.text}
                strokeWidth={2}
                fill={count > 0 ? tc.text : 'none'}
              />
              {count > 0 && (
                <View style={[styles.badge, { backgroundColor: HERO_GRADIENT.from, borderColor: tc.background }]}>
                  <Text style={styles.badgeText}>{badgeLabel}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}

        {/* Optional filter */}
        {onFilter != null && (
          <Pressable
            hitSlop={8}
            onPress={onFilter}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('Filters')}
          >
            <SlidersHorizontal size={19} color={tc.text} strokeWidth={2} />
          </Pressable>
        )}

        {/* Optional settings */}
        {onSettings != null && (
          <Pressable
            hitSlop={8}
            onPress={onSettings}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('Settings')}
          >
            <Settings size={19} color={tc.text} strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 52,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWordmark: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  submitGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: JAKARTA_FONTS.extraBold,
    lineHeight: 11,
  },
});

