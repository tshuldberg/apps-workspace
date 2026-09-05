import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';

type TabsScreenOptions = NonNullable<React.ComponentProps<typeof Tabs>['screenOptions']>;
import { colors, navigation, surfaceTiers } from '@mylife/ui';
import { MODULE_METADATA } from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import { ModuleHeader } from './ModuleHeader';
import {
  ModuleTabBarBackground,
  TabBarFAB,
  getTabBarStyle,
  getTabBarLabelStyle,
} from './ModuleTabBar';
import type { FabConfig } from './ModuleTabBar';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';
import { ModuleLockGuard } from './ModuleLockGuard';

export interface ModuleLayoutWrapperProps {
  /** Module identifier */
  moduleId: ModuleId;
  /** Tab screen declarations as children */
  children: React.ReactNode;
  /** Optional FAB config rendered above the tab bar */
  fab?: FabConfig;
  /** Optional header title override */
  headerTitle?: string;
  /** Optional right header accessory */
  headerRightAccessory?: React.ReactNode;
  /** Optional additional Tabs screenOptions overrides */
  screenOptions?: Partial<TabsScreenOptions>;
  /** Whether to wrap with ModuleErrorBoundary (default: true) */
  errorBoundary?: boolean;
  /** Whether to wrap with ModuleLockGuard (default: true) */
  lockGuard?: boolean;
}

/**
 * Unified layout wrapper for all module screens.
 *
 * Composes ModuleHeader (top), Expo Router Tabs (middle), and
 * ModuleTabBarBackground (bottom) into a consistent layout.
 *
 * Usage:
 * ```tsx
 * export default function NotesLayout() {
 *   return (
 *     <ModuleLayoutWrapper moduleId="notes">
 *       <Tabs.Screen name="index" options={{ title: 'Home' }} />
 *       <Tabs.Screen name="search" options={{ title: 'Search' }} />
 *     </ModuleLayoutWrapper>
 *   );
 * }
 * ```
 */
export function ModuleLayoutWrapper({
  moduleId,
  children,
  fab,
  headerTitle,
  headerRightAccessory,
  screenOptions,
  errorBoundary = true,
  lockGuard = true,
}: ModuleLayoutWrapperProps) {
  const meta = MODULE_METADATA[moduleId];
  const accentColor = colors.modules[moduleId] ?? colors.accent;
  const moduleName = meta?.name ?? 'Module';
  const moduleIcon = meta?.icon ?? '📱';

  if (!meta) {
    console.warn(
      `[ModuleLayoutWrapper] Unknown moduleId "${moduleId}", using fallback values`,
    );
  }

  const content = (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          header: ({ options }) => {
            const perScreenRight =
              typeof options.headerRight === 'function'
                ? options.headerRight({ canGoBack: false })
                : undefined;
            return (
              <ModuleHeader
                moduleId={moduleId}
                title={headerTitle}
                rightAccessory={perScreenRight ?? headerRightAccessory}
              />
            );
          },
          tabBarBackground: () => <ModuleTabBarBackground />,
          tabBarStyle: getTabBarStyle(),
          tabBarActiveTintColor: accentColor,
          tabBarInactiveTintColor: navigation.inactiveTint,
          tabBarLabelStyle: getTabBarLabelStyle(),
          tabBarHideOnKeyboard: true,
          sceneStyle: { backgroundColor: surfaceTiers.lowest },
          ...screenOptions,
        }}
      >
        {children}
      </Tabs>
      {fab && <TabBarFAB fab={fab} />}
    </View>
  );

  let wrapped = content;

  if (lockGuard) {
    wrapped = (
      <ModuleLockGuard
        moduleId={moduleId}
        moduleName={moduleName}
        moduleIcon={moduleIcon}
        accentColor={accentColor}
      >
        {wrapped}
      </ModuleLockGuard>
    );
  }

  if (errorBoundary) {
    wrapped = (
      <ModuleErrorBoundary moduleName={moduleName}>
        {wrapped}
      </ModuleErrorBoundary>
    );
  }

  return wrapped;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
});
