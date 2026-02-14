import React, { useCallback } from 'react'
import { Platform, StatusBar, View, StyleSheet } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable, Text } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize } from '../constants/theme'
import { rippleConfig, androidOverrides, androidStatusBar } from '../constants/android-styles'
import { getTabBarHeight, getTabBarBottomPadding } from '../utils/platform'

/**
 * Tab icon mapping -- matches the icons used in the iOS tab layout.
 */
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  chart: 'analytics-outline',
  watchlist: 'list-outline',
  portfolio: 'logo-usd',
  alerts: 'notifications-outline',
  more: 'menu-outline',
}

const TAB_LABELS: Record<string, string> = {
  chart: 'Chart',
  watchlist: 'Watchlist',
  portfolio: 'Trade',
  alerts: 'Alerts',
  more: 'More',
}

/**
 * Material Design-style bottom navigation bar for Android.
 * Uses Pressable with android_ripple for Material ripple feedback
 * and expo-haptics for tactile feedback on tab press.
 *
 * Usage in the tabs layout:
 * ```tsx
 * import { Platform } from 'react-native'
 * import { AndroidBottomTabBar } from '../../components/android-nav'
 *
 * <Tabs
 *   tabBar={Platform.OS === 'android' ? (props) => <AndroidBottomTabBar {...props} /> : undefined}
 * >
 * ```
 */
export function AndroidBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const handlePress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      })

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName)
      }
    },
    [navigation],
  )

  const handleLongPress = useCallback(
    (routeKey: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      navigation.emit({
        type: 'tabLongPress',
        target: routeKey,
      })
    },
    [navigation],
  )

  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        // Skip hidden routes (like 'index')
        const { options } = descriptors[route.key]!
        if (options.href === null) return null

        const isFocused = state.index === index
        const routeName = route.name
        const iconName = TAB_ICONS[routeName]
        const label = TAB_LABELS[routeName] ?? options.title ?? routeName

        if (!iconName) return null

        const tintColor = isFocused ? colors.accent : colors.textMuted

        return (
          <Pressable
            key={route.key}
            style={styles.tab}
            android_ripple={rippleConfig.circular}
            onPress={() => handlePress(routeName, route.key, isFocused)}
            onLongPress={() => handleLongPress(route.key)}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
          >
            <Ionicons name={iconName} size={24} color={tintColor} />
            <Text
              style={[
                styles.label,
                { color: tintColor },
                isFocused && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {isFocused && <View style={styles.activeIndicator} />}
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Configures Android system bars (status bar + navigation bar).
 * Call this from _layout.tsx on Android.
 */
export function configureAndroidSystemBars(): void {
  if (Platform.OS !== 'android') return

  StatusBar.setBarStyle(androidStatusBar.barStyle)
  StatusBar.setBackgroundColor(androidStatusBar.backgroundColor)
  StatusBar.setTranslucent(androidStatusBar.translucent)
}

/**
 * Returns the tab bar screen options with Android-specific adjustments.
 */
export function getAndroidTabBarOptions() {
  return {
    tabBarStyle: {
      ...androidOverrides.tabBar,
      backgroundColor: colors.navyDark,
    },
    headerStyle: {
      backgroundColor: colors.navyBlack,
      elevation: 4,
    },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: {
      fontFamily: 'Roboto',
      fontWeight: '700' as const,
      fontSize: 17,
    },
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.navyDark,
    height: getTabBarHeight(),
    paddingBottom: getTabBarBottomPadding(),
    elevation: 8,
    borderTopWidth: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    position: 'relative',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  labelActive: {
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.accent,
  },
})
