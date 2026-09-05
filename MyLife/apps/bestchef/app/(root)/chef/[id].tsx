import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@mylife/ui';
import { getChefProfile, JAKARTA_FONTS } from '@mylife/bestchef';
import type { ChefProfileData } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import {
  DEMO_CHEFS,
  DEMO_SUBMISSIONS,
  type DemoChef,
} from '../data/demo';
import { shouldShowDemoContent } from '../data/public-render-policy';
import { useI18n } from '../i18n/I18nProvider';

import { ChefBanner } from '../components/chef/ChefBanner';
import { ChefFloatingBar } from '../components/chef/ChefFloatingBar';
import { ChefIdentityBlock } from '../components/chef/ChefIdentityBlock';
import { ChefActionButtons } from '../components/chef/ChefActionButtons';
import { ChefModerationRow } from '../components/chef/ChefModerationRow';
import { ChefStatsCard } from '../components/chef/ChefStatsCard';
import { ChefSubTabs, type ChefTab } from '../components/chef/ChefSubTabs';
import { ChefRecipesPane } from '../components/chef/ChefRecipesPane';
import { ChefStatsPane } from '../components/chef/ChefStatsPane';
import { ChefAboutPane } from '../components/chef/ChefAboutPane';
import { SignatureDishesSection } from '../components/profile/SignatureDishesSection';

// ── Demo fallback helpers ──────────────────────────────────────────────

function demoChefToProfile(demo: DemoChef): ChefProfileData {
  const subs = shouldShowDemoContent()
    ? DEMO_SUBMISSIONS.filter((s) => s.chefId === demo.id)
    : [];
  return {
    profileId: demo.id,
    handle: demo.handle,
    displayName: demo.displayName,
    bio: `Home cook obsessed with ${demo.topCuisine.toLowerCase()} flavors.`,
    avatarUrl: demo.avatarUrl ?? null,
    followerCount: demo.followers,
    followingCount: 0,
    totalSubmissions: demo.submissionCount,
    totalVotesReceived: demo.totalVotes,
    dishesWon: demo.wins,
    avgScore: subs.length > 0 ? subs.reduce((acc, s) => acc + s.voteScore, 0) / subs.length : 0,
    topCuisine: demo.topCuisine,
    signatureDishes: [],
    badges: [],
    activeSince: new Date().toISOString(),
  };
}

function initialsFor(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ── Screen ─────────────────────────────────────────────────────────────

export default function ChefProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tc = useThemeColors();
  const { supabase } = useBestChefCloud();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();

  const [profile, setProfile] = useState<ChefProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ChefTab>('recipes');

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;

    // Try cloud first, fall back to demo
    const tryCloud = async () => {
      if (supabase) {
        const result = await getChefProfile(id);
        if (!cancelled && result.ok) {
          setProfile(result.data);
          setLoading(false);
          return;
        }
      }
      // Demo fallback
      if (!cancelled && shouldShowDemoContent()) {
        const demo = DEMO_CHEFS.find((c) => c.id === id);
        setProfile(demo ? demoChefToProfile(demo) : null);
      }
      if (!cancelled) setLoading(false);
    };

    void tryCloud().catch(() => {
      if (!cancelled) {
        const demo = shouldShowDemoContent()
          ? DEMO_CHEFS.find((c) => c.id === id)
          : null;
        setProfile(demo ? demoChefToProfile(demo) : null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [id, supabase]);

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={[styles.skeletonBanner]} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <ChefFloatingBar chef={{ id: id ?? '', displayName: '' }} />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: tc.text }]}>{t('Chef not found')}</Text>
        </View>
      </View>
    );
  }

  const initials = initialsFor(profile.displayName);

  const bannerChef = {
    id: profile.profileId,
    displayName: profile.displayName,
    primaryCuisine: profile.topCuisine,
    initials,
  };

  const identityChef = {
    displayName: profile.displayName,
    primaryCuisine: profile.topCuisine,
    region: null as string | null,
    bio: profile.bio,
    isRestaurant: false,
  };

  const aboutChef = {
    displayName: profile.displayName,
    bio: profile.bio,
    activeSince: profile.activeSince,
    region: null as string | null,
    isRestaurant: false,
    restaurantUrl: null as string | null,
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      {/* Floating back/share bar always on top */}
      <ChefFloatingBar chef={{ id: profile.profileId, displayName: profile.displayName }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner (extends under status bar) */}
        <ChefBanner chef={bannerChef} />

        {/* Content below banner */}
        <View style={styles.body}>
          <ChefIdentityBlock chef={identityChef} />
          <ChefActionButtons chefId={profile.profileId} />
          <ChefModerationRow
            profileId={profile.profileId}
            handle={profile.handle}
            displayName={profile.displayName}
          />
          <ChefStatsCard chefId={profile.profileId} />

          <SignatureDishesSection
            dishes={profile.signatureDishes}
            canEdit={false}
            onPressDish={(dish) => {
              router.push({
                pathname: '/recipe/[id]',
                params: { id: dish.submissionId },
              });
            }}
          />

          <ChefSubTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === 'recipes' && <ChefRecipesPane chefId={profile.profileId} />}
          {activeTab === 'stats' && <ChefStatsPane chefId={profile.profileId} />}
          {activeTab === 'about' && <ChefAboutPane chef={aboutChef} chefId={profile.profileId} />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  skeletonBanner: {
    height: 220,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  notFoundText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  content: {
    gap: 0,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 18,
  },
});
