import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import {
  Calendar,
  Compass,
  List,
  MapPin,
  Settings,
} from 'lucide-react-native';
import { useAppThemeColors } from '../providers/AppThemeProvider';

function TabIcon({
  Icon,
  color,
  size,
  active,
  accent,
}: {
  Icon: typeof Compass;
  color: string;
  size: number;
  active?: boolean;
  accent: string;
}) {
  if (active) {
    return (
      <View style={[styles.activeIconWrap, { backgroundColor: `${accent}1F` }]}>
        <Icon size={size} color={color} strokeWidth={2} />
      </View>
    );
  }
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export default function TabLayout() {
  const tc = useAppThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tc.accent,
        tabBarInactiveTintColor: tc.textTertiary,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: tc.background,
            height: 56 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Compass} color={color} size={size} active={focused} accent={tc.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Calendar} color={color} size={size} active={focused} accent={tc.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="pins"
        options={{
          title: 'Pins',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={MapPin} color={color} size={size} active={focused} accent={tc.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={List} color={color} size={size} active={focused} accent={tc.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Settings} color={color} size={size} active={focused} accent={tc.accent} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  activeIconWrap: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
