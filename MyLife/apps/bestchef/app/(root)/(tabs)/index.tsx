import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppToolbar } from '../components/AppToolbar';
import { RankMomentBanner } from '../components/home/RankMomentBanner';
import { HomeGreeting } from '../components/home/HomeGreeting';
import { HomeStatStrip } from '../components/home/HomeStatStrip';
import { HeroChampionCard } from '../components/home/HeroChampionCard';
import { HomeFilterChips } from '../components/home/HomeFilterChips';
import { TopThisWeekCarousel } from '../components/home/TopThisWeekCarousel';
import { LeaderboardShortcuts } from '../components/home/LeaderboardShortcuts';
import { TrendingDishesChips } from '../components/home/TrendingDishesChips';
import { RestaurantSpotlight } from '../components/home/RestaurantSpotlight';
import { SubmitCTA } from '../components/home/SubmitCTA';
import { Package, Play, ShoppingBasket } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useCallback, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { getLocalChefStats } from '../data/local-submissions';
import { shouldShowDemoContent } from '../data/public-render-policy';
import { ForwardArrow } from '../components/DirectionalIcons';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const { t } = useI18n();
  const db = useDatabase();
  const [refreshing, setRefreshing] = useState(false);
  const showDemo = shouldShowDemoContent();

  const refreshStats = useCallback(() => {
    try {
      getLocalChefStats(db);
    } catch {
      // ignore
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    refreshStats();
  }, [refreshStats]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshStats();
    setTimeout(() => setRefreshing(false), 300);
  }, [refreshStats]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppToolbar
          pinwheelPageKey="home"
          onSearch={() => router.push('/discover')}
          onSubmit={() => router.push('/submit')}
          onNotifications={() => router.push('/notifications')}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.accent} />}
      >
        <RankMomentBanner />
        {/* 1. HomeGreeting */}
        <HomeGreeting />

        {/* 2. HomeStatStrip */}
        <HomeStatStrip />

        {/* 3. LeaderboardShortcuts (above the fold for fast access) */}
        <LeaderboardShortcuts />

        {/* 4. HeroChampionCard */}
        <HeroChampionCard />

        {/* 5. HomeFilterChips */}
        <HomeFilterChips />

        {/* 6. TopThisWeekCarousel */}
        <TopThisWeekCarousel />

        {/* 7. My Kitchen card */}
        <Pressable
          style={({ pressed }) => [
            styles.kitchenCard,
            { backgroundColor: tc.surface, borderColor: tc.border },
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => router.push('/(tabs)/kitchen')}
        >
          <View style={[styles.kitchenIconCircle, { backgroundColor: `${tc.accent}1A` }]}>
            <ShoppingBasket size={21} color={tc.accent} strokeWidth={2} />
          </View>
          <View style={styles.kitchenBody}>
            <Text style={[styles.kitchenTitle, { color: tc.text }]}>{t('My Kitchen')}</Text>
            <Text style={[styles.kitchenDesc, { color: tc.textSecondary }]}>
              {t('Save recipes, build grocery lists, and manage pantry inventory')}
            </Text>
          </View>
          <Package size={18} color={tc.textSecondary} strokeWidth={2} />
        </Pressable>

        {/* 8. TrendingDishesChips (P3-B) */}
        <TrendingDishesChips />

        {/* 9. Watch Cooking Videos card */}
        {showDemo ? (
          <Pressable
            style={({ pressed }) => [
              styles.videoFeedCard,
              { backgroundColor: tc.surface, borderColor: tc.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push('/feed')}
          >
            <View style={[styles.videoFeedIconCircle, { backgroundColor: `${tc.accent}1A` }]}>
              <Play size={22} color={tc.accent} strokeWidth={2} fill={tc.accent} />
            </View>
            <View style={styles.videoFeedText}>
              <Text style={[styles.videoFeedTitle, { color: tc.text }]}>{t('Watch Cooking Videos')}</Text>
              <Text style={[styles.videoFeedDesc, { color: tc.textSecondary }]}>
                {t('Full-length recipe walkthroughs from top chefs')}
              </Text>
            </View>
            <ForwardArrow size={18} color={tc.textSecondary} strokeWidth={2} />
          </Pressable>
        ) : null}

        {/* 10. RestaurantSpotlight (P3-C) */}
        <RestaurantSpotlight />

        {/* 11. SubmitCTA (P3-C) */}
        <SubmitCTA />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { paddingHorizontal: 18, paddingBottom: 160, gap: 24 },
  kitchenCard: {
    borderRadius: 20, padding: 18, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  kitchenIconCircle: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kitchenBody: { flex: 1, gap: 3 },
  kitchenTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 17 },
  kitchenDesc: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
  videoFeedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 18, borderWidth: 1,
  },
  videoFeedIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  videoFeedText: { flex: 1, gap: 2 },
  videoFeedTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  videoFeedDesc: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
});
