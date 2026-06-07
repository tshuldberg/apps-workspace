import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import {
  Home,
  UtensilsCrossed,
  Trophy,
  User,
  Settings,
} from 'lucide-react-native';

const ACCENT = '#22C55E';
const INACTIVE = 'rgba(214, 195, 181, 0.4)';
const TAB_BG = '#0E0E13';
const BACKGROUND = '#131318';

function TabIcon({
  Icon,
  color,
  size,
}: {
  Icon: typeof Home;
  color: string;
  size: number;
}) {
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon Icon={Home} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="dishes"
        options={{
          title: 'Dishes',
          tabBarIcon: ({ color, size }) => (
            <TabIcon Icon={UtensilsCrossed} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon Icon={Trophy} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon Icon={User} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon Icon={Settings} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BG,
    borderTopWidth: 0,
    elevation: 0,
    height: 88,
    paddingBottom: 28,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
