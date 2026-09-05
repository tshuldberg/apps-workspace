import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text as RNText } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  Activity,
  BarChart3,
  ChevronRight,
  Flame,
  LineChart,
  Thermometer,
} from 'lucide-react-native';
import {
  GlassCard,
  LogTodayFAB,
  calculateAverageCycleLength,
  calculateAveragePeriodLength,
  detectCycleTrend,
  generateCycleInsights,
  getCycleStats,
  getCycles,
  predictNextPeriod,
  CYCLE_ACCENT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Cycle,
  type CycleInsight,
  type CycleStats,
  type CycleTrend,
} from '@mylife/cycle';
import { useDatabase } from '../../../components/DatabaseProvider';

interface InsightsData {
  stats: CycleStats;
  trend: CycleTrend;
  insights: CycleInsight[];
  recentLengths: number[];
  hasData: boolean;
}

function loadInsightsData(
  db: ReturnType<typeof useDatabase>,
  today: string,
): InsightsData {
  const stats = getCycleStats(db);
  const cycles = getCycles(db, 24);

  const completed: Cycle[] = cycles.filter((c) => c.endDate !== null);
  const cycleLengths = completed
    .map((c) => c.lengthDays)
    .filter((l): l is number => l !== null);

  const periodLengths = completed
    .map((c) => c.periodLength)
    .filter((l): l is number => l !== null);

  const chronologicalLengths = [...cycleLengths].reverse();
  const trend = detectCycleTrend(chronologicalLengths);

  const current = cycles[0] ?? null;
  const prediction = current
    ? predictNextPeriod(
        current.startDate,
        cycleLengths,
        periodLengths,
        today,
      )
    : null;

  const insights = generateCycleInsights(
    stats,
    prediction,
    trend,
    [],
    today,
  );

  // Ensure we have helpers even if we drop these later — silence lint
  void calculateAverageCycleLength;
  void calculateAveragePeriodLength;

  const recentLengths = chronologicalLengths.slice(-6);

  return {
    stats,
    trend,
    insights,
    recentLengths,
    hasData: stats.totalCycles >= 1,
  };
}

function regularityLabel(score: number): string {
  if (score >= 0.9) return 'Very Regular';
  if (score >= 0.75) return 'Mostly Regular';
  if (score >= 0.55) return 'Somewhat Irregular';
  if (score > 0) return 'Irregular';
  return 'Insufficient Data';
}

function trendLabel(direction: CycleTrend['direction']): {
  label: string;
  color: string;
} {
  if (direction === 'lengthening') {
    return { label: 'Lengthening', color: CYCLE_PHASE_COLORS.follicular };
  }
  if (direction === 'shortening') {
    return { label: 'Shortening', color: CYCLE_PHASE_COLORS.ovulation };
  }
  if (direction === 'stable') {
    return { label: 'Stable', color: CYCLE_ACCENT };
  }
  return { label: 'Not enough data', color: 'rgba(214, 195, 181, 0.6)' };
}

export default function CycleInsightsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadInsightsData(db, today) };
    } catch (err) {
      return {
        ok: false as const,
        message:
          err instanceof Error ? err.message : 'Failed to load insights.',
      };
    }
  }, [db, today, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const handleLog = useCallback(() => router.push('/(cycle)/log-day'), [router]);

  if (!result.ok) {
    return (
      <View style={styles.errorWrap}>
        <RNText style={styles.errorTitle}>Something went wrong</RNText>
        <RNText style={styles.errorBody}>{result.message}</RNText>
      </View>
    );
  }

  const { stats, trend, insights, recentLengths, hasData } = result.data;

  const score = Math.round(trend.regularity * 100);
  const trendMeta = trendLabel(trend.direction);

  const navTiles = [
    {
      title: 'Predictions',
      subtitle:
        stats.averageCycleLength != null
          ? `Next in ~${Math.round(stats.averageCycleLength)}d`
          : 'Awaiting data',
      icon: <LineChart size={20} color={CYCLE_ACCENT} strokeWidth={2} />,
      onPress: () => router.push('/(cycle)/predictions-detail'),
    },
    {
      title: 'Symptom Analysis',
      subtitle: 'Phase patterns',
      icon: <Activity size={20} color={CYCLE_PHASE_COLORS.ovulation} strokeWidth={2} />,
      onPress: () => router.push('/(cycle)/symptom-analysis'),
    },
    {
      title: 'Cycle Analytics',
      subtitle:
        stats.totalCycles > 0 ? `${stats.totalCycles} cycles` : 'No cycles yet',
      icon: <BarChart3 size={20} color={CYCLE_PHASE_COLORS.follicular} strokeWidth={2} />,
      onPress: () => router.push('/(cycle)/cycle-analytics'),
    },
    {
      title: 'BBT Tracking',
      subtitle: 'Coverline + shifts',
      icon: <Thermometer size={20} color={CYCLE_PHASE_COLORS.menstrual} strokeWidth={2} />,
      onPress: () => router.push('/(cycle)/temperature'),
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E4E1E9"
          />
        }
      >
        {!hasData ? (
          <GlassCard style={styles.emptyCard}>
            <Flame size={40} color={CYCLE_ACCENT} strokeWidth={1.5} />
            <RNText style={styles.emptyTitle}>
              Your insights unlock as you log
            </RNText>
            <RNText style={styles.emptyBody}>
              Log at least two cycles to reveal regularity, trends, and
              personal patterns.
            </RNText>
          </GlassCard>
        ) : (
          <>
            <GlassCard style={styles.heroCard}>
              <RNText style={styles.heroLabel}>REGULARITY SCORE</RNText>
              <RegularityCircle score={score} />
              <RNText style={styles.heroTitle}>
                {regularityLabel(trend.regularity)}
              </RNText>
              <RNText style={styles.heroSub}>
                Based on your last {stats.totalCycles} cycle
                {stats.totalCycles === 1 ? '' : 's'}.
              </RNText>
            </GlassCard>

            <GlassCard>
              <View style={styles.trendHeader}>
                <RNText style={styles.cardLabel}>LENGTH TREND</RNText>
                <View
                  style={[
                    styles.trendBadge,
                    { backgroundColor: `${trendMeta.color}22` },
                  ]}
                >
                  <RNText
                    style={[styles.trendBadgeText, { color: trendMeta.color }]}
                  >
                    {trendMeta.label}
                  </RNText>
                </View>
              </View>
              <TrendChart lengths={recentLengths} />
              {recentLengths.length > 0 ? (
                <RNText style={styles.cardSub}>
                  Last {recentLengths.length} cycles ({recentLengths.join(', ')} days)
                </RNText>
              ) : (
                <RNText style={styles.cardSub}>
                  Complete at least 4 cycles to see a trend line.
                </RNText>
              )}
            </GlassCard>

            <View style={styles.tilesGrid}>
              {navTiles.map((tile) => (
                <NavTile key={tile.title} {...tile} />
              ))}
            </View>

            {insights.length > 0 && (
              <View style={styles.insightsSection}>
                <RNText style={styles.sectionLabel}>RECENT INSIGHTS</RNText>
                {insights.slice(0, 5).map((insight) => (
                  <GlassCard key={insight.key} style={styles.insightCard}>
                    <View
                      style={[
                        styles.priorityDot,
                        {
                          backgroundColor:
                            insight.priority === 'high'
                              ? CYCLE_PHASE_COLORS.menstrual
                              : insight.priority === 'medium'
                                ? CYCLE_ACCENT
                                : CYCLE_PHASE_COLORS.follicular,
                        },
                      ]}
                    />
                    <RNText style={styles.insightText}>{insight.text}</RNText>
                  </GlassCard>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <LogTodayFAB onPress={handleLog} />
    </View>
  );
}

function RegularityCircle({ score }: { score: number }) {
  const size = 192;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={CYCLE_SURFACES.high}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={CYCLE_ACCENT}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.circleCenter}>
          <RNText style={styles.circleValue}>{clamped}</RNText>
          <RNText style={styles.circleOutOf}>/ 100</RNText>
        </View>
      </View>
    </View>
  );
}

function TrendChart({ lengths }: { lengths: number[] }) {
  if (lengths.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <RNText style={styles.chartEmptyText}>
          Not enough cycles to chart yet.
        </RNText>
      </View>
    );
  }

  const width = 280;
  const height = 96;
  const padX = 12;
  const padY = 12;
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const range = Math.max(1, max - min);
  const stepX = (width - padX * 2) / Math.max(1, lengths.length - 1);
  const points = lengths
    .map((len, i) => {
      const x = padX + stepX * i;
      const y = padY + ((max - len) / range) * (height - padY * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={points}
          fill="none"
          stroke={CYCLE_ACCENT}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {lengths.map((len, i) => {
          const x = padX + stepX * i;
          const y = padY + ((max - len) / range) * (height - padY * 2);
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={3.5}
              fill={CYCLE_ACCENT}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function NavTile({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <GlassCard onPress={onPress} style={styles.navTile}>
      <View style={styles.navTileTop}>
        {icon}
        <ChevronRight size={16} color="rgba(214, 195, 181, 0.5)" strokeWidth={2} />
      </View>
      <View style={{ gap: 4 }}>
        <RNText style={styles.navTileTitle}>{title}</RNText>
        <RNText style={styles.navTileSub}>{subtitle}</RNText>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 160,
    gap: 20,
  },
  heroCard: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  heroLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.7)',
    letterSpacing: 2,
  },
  heroTitle: {
    ...CYCLE_TYPOGRAPHY.headlineLg,
    color: '#E4E1E9',
    marginTop: 8,
    textAlign: 'center',
  },
  heroSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.8)',
    textAlign: 'center',
  },
  circleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleValue: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 48,
    color: '#E4E1E9',
    letterSpacing: -1,
  },
  circleOutOf: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    color: CYCLE_ACCENT,
    marginTop: 2,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.7)',
  },
  cardSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.85)',
    marginTop: 10,
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trendBadgeText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chartWrap: {
    height: 100,
    justifyContent: 'center',
  },
  chartEmpty: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  navTile: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 16,
    gap: 14,
    minHeight: 108,
    justifyContent: 'space-between',
  },
  navTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navTileTitle: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  navTileSub: {
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.75)',
  },
  insightsSection: {
    gap: 10,
  },
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.7)',
    marginBottom: 4,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  insightText: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: '#E4E1E9',
    flex: 1,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  emptyBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.85)',
    textAlign: 'center',
  },
  errorWrap: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  errorBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(255, 180, 171, 0.9)',
    textAlign: 'center',
  },
});
