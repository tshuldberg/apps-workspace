import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, Trophy } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { Card } from '@mylife/bestchef/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { getChefBestRank, getRankHistory } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { RankSparkline, type SparklineEntry } from './RankSparkline';

const SUCCESS_GREEN = '#30D158';
const SUCCESS_BG = 'rgba(48, 209, 88, 0.14)';
const SUCCESS_TEXT = '#1A7A35';

const MILESTONES = [1, 3, 10, 25, 50, 100, 250, 500, 1000];

function nextMilestone(rank: number): { goal: number; prev: number } {
  for (const m of MILESTONES) {
    if (rank > m) continue;
    const idx = MILESTONES.indexOf(m);
    const prev = idx === 0 ? rank + 100 : MILESTONES[idx - 1] ?? rank + 100;
    return { goal: m, prev };
  }
  // Already in top 1
  const goal = 1;
  const prev = rank + 50;
  return { goal, prev };
}

function computeProgress(rank: number, goal: number, prev: number): number {
  if (rank <= goal) return 100;
  const total = prev - goal;
  if (total <= 0) return 0;
  const progress = ((prev - rank) / total) * 100;
  return Math.min(100, Math.max(0, progress));
}

function formatPercent(rank: number, total: number): string {
  if (total === 0) return '0%';
  const pct = (rank / total) * 100;
  return pct < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
}

function toSparkEntries(entries: { week: Date | string; rank: number }[]): SparklineEntry[] {
  return entries.map((e) => ({
    week: e.week instanceof Date ? e.week.toISOString() : String(e.week),
    rank: e.rank,
  }));
}

interface RankProgressCardProps {
  chefId: string | null;
}

export function RankProgressCard({ chefId }: RankProgressCardProps) {
  const tc = useThemeColors();
  const { supabase } = useBestChefCloud();
  const { t } = useI18n();

  const [rank, setRank] = useState<number | null>(null);
  const [sparkEntries, setSparkEntries] = useState<SparklineEntry[]>([]);
  const [totalChefs] = useState(1000); // fallback; totalChefs is approximated
  const [loading, setLoading] = useState(true);

  const barAnim = useRef(new Animated.Value(0)).current;
  const barWidthRef = useRef(0);

  useEffect(() => {
    if (!chefId || !supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void Promise.all([
      getChefBestRank(chefId),
      getRankHistory({ chefId, weeks: 7 }),
    ]).then(([rankResult, histResult]) => {
      if (cancelled) return;
      if (rankResult.ok && rankResult.data !== null) {
        setRank(rankResult.data);
      }
      if (histResult.ok) {
        setSparkEntries(toSparkEntries(histResult.data));
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [chefId, supabase]);

  useEffect(() => {
    if (rank === null) return;
    const { goal, prev } = nextMilestone(rank);
    const progress = computeProgress(rank, goal, prev) / 100;

    Animated.timing(barAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [rank, barAnim]);

  // Hide card silently if no data and not loading
  if (!loading && rank === null) return null;

  if (loading) {
    return (
      <Card>
        <Text style={[styles.loadingText, { color: tc.textSecondary }]}>
          {t('Loading rank history')}
        </Text>
      </Card>
    );
  }

  if (rank === null) return null;

  const { goal, prev } = nextMilestone(rank);
  const progress = computeProgress(rank, goal, prev);
  const percentStr = formatPercent(rank, totalChefs);

  // Delta: compare last two sparkline entries
  let delta = 0;
  if (sparkEntries.length >= 2) {
    const last = sparkEntries[sparkEntries.length - 1]!;
    const prev2 = sparkEntries[sparkEntries.length - 2]!;
    delta = prev2.rank - last.rank; // positive = climbed
  }

  return (
    <Card>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Trophy size={13} color={HERO_GRADIENT.from} fill={HERO_GRADIENT.from} strokeWidth={0} />
          <Text style={[styles.titleText, { color: tc.text }]}>{t('Your Rank')}</Text>
        </View>
        <View style={styles.percentPill}>
          <Text style={styles.percentPillText}>
            {t('Top {percent}%', { percent: percentStr })}
          </Text>
        </View>
      </View>

      {/* Big rank */}
      <View style={styles.rankRow}>
        <Text style={[styles.rankNumber, { color: HERO_GRADIENT.from }]}>#{rank}</Text>
        <Text style={[styles.rankSub, { color: tc.textSecondary }]}>{t('of all chefs')}</Text>
        {delta > 0 && (
          <View style={styles.deltaGroup}>
            <ArrowUpRight size={11} color={SUCCESS_GREEN} strokeWidth={2.5} />
            <Text style={styles.deltaText}>
              {t('+{delta} this week', { delta: String(delta) })}
            </Text>
          </View>
        )}
      </View>

      {/* Milestone progress */}
      <View style={styles.milestoneSection}>
        <View style={styles.milestoneRow}>
          <Text style={[styles.milestoneLabel, { color: tc.textSecondary }]}>
            {t('Next milestone: Top {goalRank}', { goalRank: String(goal) })}
          </Text>
          <Text style={[styles.milestonePercent, { color: HERO_GRADIENT.from }]}>
            {Math.round(progress)}%
          </Text>
        </View>

        {/* Animated progress bar */}
        <View
          style={[styles.barTrack, { backgroundColor: tc.surfaceElevated }]}
          onLayout={(e) => {
            barWidthRef.current = e.nativeEvent.layout.width;
          }}
        >
          <Animated.View
            style={[
              styles.barFill,
              {
                width: barAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>

      {/* Sparkline */}
      {sparkEntries.length >= 2 && (
        <View style={styles.sparklineWrap}>
          <RankSparkline entries={sparkEntries} height={50} horizontalPadding={56} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  percentPill: {
    backgroundColor: SUCCESS_BG,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentPillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: SUCCESS_GREEN,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 14,
  },
  rankNumber: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 44,
  },
  rankSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    marginBottom: 6,
  },
  deltaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
    marginLeft: 4,
  },
  deltaText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: SUCCESS_GREEN,
  },
  milestoneSection: {
    gap: 6,
    marginBottom: 12,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
  },
  milestonePercent: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sparklineWrap: {
    marginTop: 4,
  },
});
