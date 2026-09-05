import React, { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import {
  BookOpen,
  Home,
  Trophy,
  ThumbsUp,
  User,
} from 'lucide-react-native';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { usePendingProofSweep } from '../hooks/usePendingProofSweep';
import { usePendingSaveSweep } from '../hooks/usePendingSaveSweep';
import { useMediaUploadSweep } from '../hooks/useMediaUploadSweep';
import { usePendingSubmissionSweep } from '../hooks/usePendingSubmissionSweep';
import { HERO_GRADIENT, retryPendingReports } from '@mylife/bestchef';
import { HomeFilterProvider } from '../state/HomeFilterProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';

function usePendingReportSweep(): void {
  const db = useDatabase();
  const cloud = useBestChefCloud();

  const ready = cloud.isReady && !!cloud.supabase;

  useEffect(() => {
    if (!ready || !cloud.supabase) return;
    const supabase = cloud.supabase;

    const sweep = () => {
      void retryPendingReports(supabase, db).catch(() => undefined);
    };

    sweep();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sweep();
    });
    return () => subscription.remove();
  }, [db, ready, cloud.supabase]);
}

function TabIcon({
  Icon,
  color,
  size,
  active,
}: {
  Icon: typeof Home;
  color: string;
  size: number;
  active?: boolean;
}) {
  if (active) {
    return (
      <View style={[styles.activeIconWrap, { backgroundColor: `${HERO_GRADIENT.from}1F` }]}>
        <Icon size={size} color={color} strokeWidth={2} />
      </View>
    );
  }
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export default function TabLayout() {
  const tc = useThemeColors();
  const { t } = useI18n();
  usePendingProofSweep();
  usePendingSaveSweep();
  useMediaUploadSweep();
  usePendingSubmissionSweep();
  usePendingReportSweep();

  return (
    <HomeFilterProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: HERO_GRADIENT.from,
        tabBarInactiveTintColor: tc.textTertiary,
        tabBarStyle: [styles.tabBar, { backgroundColor: tc.background }],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Home'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Home} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('Top 100'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Trophy} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="vote"
        options={{
          title: t('Vote'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={ThumbsUp} color={color} size={size} active={focused} />
          ),
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            height: 88,
            paddingBottom: 28,
            paddingTop: 8,
          },
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: t('Kitchen'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={BookOpen} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={User} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="dishes"
        options={{
          href: null,
          title: t('Dishes'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: t('Settings'),
        }}
      />
    </Tabs>
    </HomeFilterProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
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
