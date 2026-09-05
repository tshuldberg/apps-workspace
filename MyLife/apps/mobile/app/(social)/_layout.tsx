import React from 'react';
import { Tabs } from 'expo-router';
import { navigation, surfaceTiers } from '@mylife/ui';
import {
  ModuleTabBarBackground,
  getTabBarStyle,
  getTabBarLabelStyle,
} from '../../components/ModuleTabBar';

/**
 * Social shell layout.
 *
 * Social is a meta-route (not a registered module), so it can't use
 * `ModuleLayoutWrapper` directly — that wrapper requires a `ModuleId`.
 * Instead this layout composes the same shared pieces (`ModuleTabBarBackground`,
 * `getTabBarStyle`, `getTabBarLabelStyle`, `navigation` tokens) so the tab
 * bar renders identically to every other module and can't drift.
 *
 * Three tabs: Feed, Discover, Profile.
 */
const SOCIAL_ACCENT = '#7C4DFF';

export default function SocialLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <ModuleTabBarBackground />,
        tabBarStyle: getTabBarStyle(),
        tabBarActiveTintColor: SOCIAL_ACCENT,
        tabBarInactiveTintColor: navigation.inactiveTint,
        tabBarLabelStyle: getTabBarLabelStyle(),
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: surfaceTiers.lowest },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarLabel: 'Feed' }} />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarLabel: 'Discover' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarLabel: 'Profile' }}
      />
    </Tabs>
  );
}
