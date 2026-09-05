import { View, Pressable, StyleSheet, Text as RNText } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { icons } from 'lucide-react-native';
import { colors, fontFamilies } from '@mylife/ui';

// Vertical clearance (in px) that hub screens should reserve at the bottom of
// their scroll content so the floating tab bar never covers real UI. Includes
// pill height, gradient fade, and safe-area bottom inset buffer.
export const HUB_TAB_BAR_CLEARANCE = 120;

// ---------------------------------------------------------------------------
// Tab bar config
// ---------------------------------------------------------------------------

const TAB_CONFIG = [
  { route: '/(hub)', label: 'Home', iconName: 'LayoutGrid' as const },
  { route: '/(hub)/discover', label: 'Discover', iconName: 'Compass' as const },
  { route: '/(hub)/search', label: 'Search', iconName: 'Search' as const },
  { route: '/(hub)/data-sync', label: 'Sync', iconName: 'RefreshCw' as const },
  { route: '/(hub)/settings', label: 'Settings', iconName: 'Settings' as const },
] as const;

const MAIN_PATHS = new Set(['/', '/discover', '/search', '/data-sync', '/settings']);

// ---------------------------------------------------------------------------
// Custom glassmorphic tab bar
// ---------------------------------------------------------------------------

function HubTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Only show tab bar on main screens (usePathname strips route groups)
  if (!MAIN_PATHS.has(pathname)) return null;

  return (
    <View
      style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={['rgba(19,19,24,0)', 'rgba(19,19,24,0.85)', colors.background]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <BlurView intensity={80} tint="dark" style={styles.tabBarBlur}>
        <View style={styles.tabBarInner}>
          {TAB_CONFIG.map((tab) => {
            const tabPath = tab.route === '/(hub)' ? '/' : tab.route.replace('/(hub)', '');
            const isActive = pathname === tabPath;
            const Icon = icons[tab.iconName];
            return (
              <Pressable
                key={tab.route}
                style={styles.tabButton}
                onPress={() => {
                  if (tab.route === '/(hub)') {
                    router.navigate('/(hub)');
                  } else {
                    router.navigate(tab.route as any);
                  }
                }}
                accessibilityLabel={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={isActive ? styles.iconContainerActive : undefined}>
                  {Icon && (
                    <Icon
                      size={22}
                      color={isActive ? colors.hubAccent : `${colors.text}66`}
                      strokeWidth={isActive ? 2.2 : 1.5}
                    />
                  )}
                </View>
                <RNText
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colors.hubAccent : `${colors.text}66` },
                  ]}
                >
                  {tab.label}
                </RNText>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Custom header with MyLife wordmark
// ---------------------------------------------------------------------------

function HubHeader() {
  const insets = useSafeAreaInsets();
  return (
    <BlurView intensity={60} tint="dark" style={[styles.headerBlur, { paddingTop: insets.top }]}>
      <View style={styles.headerInner}>
        <RNText style={styles.wordmark}>MyLife</RNText>
        <View style={styles.avatarPlaceholder}>
          <RNText style={styles.avatarText}>T</RNText>
        </View>
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Back-to-Settings button for hub sub-screens
//
// The five sub-screens (backup, privacy, sharing, import-wizard, module-locks)
// are all reached by pushing from settings. The native iOS back button label
// is populated from the previous route's `title`, but settings uses a custom
// `header: HubHeader` without a `title`, so the default back button falls back
// to the raw route name ("settings"). More importantly, when tab transitions
// happen through `router.navigate()` the stack history between the tab
// screens can get fragmented, so `navigation.goBack()` is not guaranteed to
// land on settings. This button calls `router.replace('/(hub)/settings')`
// which is deterministic regardless of stack state.
// ---------------------------------------------------------------------------

function BackToSettingsButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace('/(hub)/settings')}
      hitSlop={8}
      style={styles.backToSettings}
      accessibilityRole="button"
      accessibilityLabel="Back to Settings"
    >
      <icons.ChevronLeft size={22} color={colors.text} />
      <RNText style={styles.backToSettingsLabel}>Settings</RNText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Hub layout
// ---------------------------------------------------------------------------

export default function HubLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 18, fontFamily: fontFamilies.display },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            header: () => <HubHeader />,
          }}
        />
        <Stack.Screen
          name="all"
          options={{
            header: () => <HubHeader />,
          }}
        />
        <Stack.Screen
          name="discover"
          options={{
            header: () => <HubHeader />,
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            header: () => <HubHeader />,
          }}
        />
        <Stack.Screen
          name="data-sync"
          options={{
            header: () => <HubHeader />,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            header: () => <HubHeader />,
          }}
        />
        {/* Sub-screens: pushed on stack with standard header + explicit
            back-to-settings button (see BackToSettingsButton comment above) */}
        <Stack.Screen
          name="privacy"
          options={{
            title: 'Privacy Dashboard',
            headerLeft: () => <BackToSettingsButton />,
          }}
        />
        <Stack.Screen
          name="sharing"
          options={{
            title: 'Sharing Preferences',
            headerLeft: () => <BackToSettingsButton />,
          }}
        />
        <Stack.Screen
          name="import-wizard"
          options={{
            title: 'Import Wizard',
            headerLeft: () => <BackToSettingsButton />,
          }}
        />
        <Stack.Screen
          name="backup"
          options={{
            title: 'Backup & Restore',
            headerLeft: () => <BackToSettingsButton />,
          }}
        />
        <Stack.Screen
          name="module-locks"
          options={{
            title: 'Module Locks',
            headerLeft: () => <BackToSettingsButton />,
          }}
        />
        <Stack.Screen
          name="onboarding-privacy"
          options={{ title: '', headerShown: false }}
        />
        <Stack.Screen
          name="onboarding-mode"
          options={{ title: 'Mode' }}
        />
        <Stack.Screen
          name="self-host"
          options={{ title: 'Self-host' }}
        />
      </Stack>
      <HubTabBar />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  headerBlur: {
    backgroundColor: 'rgba(19,19,24,0.70)',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  wordmark: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.hubAccent,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Tab bar
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 28,
  },
  tabBarBlur: {
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 24,
    overflow: 'hidden',
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(19,19,24,0.70)',
  },
  tabButton: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  iconContainerActive: {
    transform: [{ scale: 1.1 }],
    shadowColor: colors.hubAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Back-to-Settings button (used on hub sub-screens)
  backToSettings: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 12,
    gap: 2,
  },
  backToSettingsLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});
