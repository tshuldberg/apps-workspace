import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  Dream,
  NapRecord,
  SleepEntryRecord,
  YearReview,
} from '@mylife/sleep';
import {
  generateYearReview,
  getStreakHistory,
  listDreams,
  listEntries,
  listNaps,
  SLEEP_STREAK_TYPES,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT, readSleepTargetHours } from '../_ui';

type ShareData = {
  entries: SleepEntryRecord[];
  dreams: Dream[];
  naps: NapRecord[];
  review: YearReview;
};

const CURRENT_YEAR = new Date().getFullYear();
const LAVENDER = '#C4B5FD';

function parseYearParam(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= CURRENT_YEAR
    ? parsed
    : CURRENT_YEAR;
}

function yearStart(year: number): string {
  return `${String(year).padStart(4, '0')}-01-01`;
}

function yearEnd(year: number): string {
  return `${String(year).padStart(4, '0')}-12-31`;
}

function queryEndDate(year: number): string {
  const endDate = yearEnd(year);
  const today = new Date().toISOString().slice(0, 10);

  return endDate > today ? today : endDate;
}

function formatHours(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '--';
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function formatQuality(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(1)}/5` : '--';
}

function formatStreak(review: YearReview): string {
  return review.longestStreak.count > 0
    ? `${review.longestStreak.count} nights`
    : 'No streak yet';
}

export default function SleepYearReviewShareScreen() {
  const db = useDatabase();
  const params = useLocalSearchParams<{ year?: string }>();
  const year = parseYearParam(params.year);
  const [data, setData] = useState<ShareData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReview = useCallback(() => {
    const entries = listEntries(db, {
      startDate: yearStart(year - 1),
      endDate: queryEndDate(year),
      limit: 500,
    });
    const dreams = listDreams(db, {
      startDate: yearStart(year - 1),
      endDate: queryEndDate(year),
      limit: 500,
    });
    const naps = listNaps(db, {
      startDate: yearStart(year - 1),
      endDate: queryEndDate(year),
    });
    const streakHistory = SLEEP_STREAK_TYPES.flatMap((type) =>
      getStreakHistory(db, type),
    );
    const review = generateYearReview(year, {
      entries,
      dreams,
      naps,
      streakHistory,
      targetHours: readSleepTargetHours(db),
    });

    setData({ entries, dreams, naps, review });
  }, [db, year]);

  useFocusEffect(
    useCallback(() => {
      loadReview();
    }, [loadReview]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadReview();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadReview]);

  const review = data?.review ?? generateYearReview(year);
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: `${year} MySleep Review`,
        message: [
          `${year} MySleep Review`,
          `Total hours: ${formatHours(review.totalHoursSlept)}`,
          `Average quality: ${formatQuality(review.averageQuality)}`,
          `Best streak: ${formatStreak(review)}`,
          `Dream count: ${review.dreamStats.total}`,
        ].join('\n'),
      });
    } catch (err) {
      Alert.alert(
        'Share unavailable',
        err instanceof Error ? err.message : 'Could not open the share sheet.',
      );
    }
  }, [review, year]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Share Card</Text>
        <Text style={styles.heroTitle}>{year} sleep card</Text>
        <Text style={styles.heroCopy}>
          Aggregate stats only. Dream content and notes stay private.
        </Text>
      </View>

      <View style={styles.cardFrame}>
        <View style={styles.shareCard}>
          <Text style={styles.cardEyebrow}>MySleep</Text>
          <Text style={styles.cardTitle}>{year} Year in Review</Text>
          <View style={styles.cardStats}>
            <ShareStat
              label="Total hours"
              value={formatHours(review.totalHoursSlept)}
            />
            <ShareStat
              label="Average quality"
              value={formatQuality(review.averageQuality)}
            />
            <ShareStat label="Best streak" value={formatStreak(review)} />
            <ShareStat
              label="Dream count"
              value={String(review.dreamStats.total)}
            />
          </View>
        </View>
      </View>

      <Pressable onPress={() => void handleShare()} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Share Summary</Text>
      </Pressable>
    </ScrollView>
  );
}

function ShareStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.shareStat}>
      <Text style={styles.shareStatLabel}>{label}</Text>
      <Text style={styles.shareStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: LAVENDER,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
  },
  heroCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  cardFrame: {
    alignItems: 'center',
  },
  shareCard: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 9 / 16,
    justifyContent: 'space-between',
    gap: 18,
    padding: 28,
    borderRadius: 28,
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.44)',
    shadowColor: '#A78BFA',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  cardEyebrow: {
    color: LAVENDER,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
  },
  cardStats: {
    gap: 12,
  },
  shareStat: {
    gap: 6,
    padding: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  shareStatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  shareStatValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: SLEEP_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#0A0A0F',
    fontSize: 14,
    fontWeight: '800',
  },
});
