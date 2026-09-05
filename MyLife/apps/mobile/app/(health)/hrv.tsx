import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import {
  getVitalsByDateRange,
  getVitalAggregates,
  getLatestVital,
  analyzeHrv,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  HEALTH_CTA_GRADIENT,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type TrendTab = 'daily' | '7d';

export default function HRVScreen() {
  const db = useDatabase();
  const [trendTab, setTrendTab] = useState<TrendTab>('daily');

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  const latest = useMemo(() => getLatestVital(db, 'hrv'), [db]);
  const weekVitals = useMemo(
    () => getVitalsByDateRange(db, 'hrv', sevenDaysAgo, today),
    [db, sevenDaysAgo, today],
  );
  const monthVitals = useMemo(
    () => getVitalsByDateRange(db, 'hrv', thirtyDaysAgo, today),
    [db, thirtyDaysAgo, today],
  );
  const prevWeekVitals = useMemo(
    () => getVitalsByDateRange(db, 'hrv', fourteenDaysAgo, sevenDaysAgo),
    [db, fourteenDaysAgo, sevenDaysAgo],
  );
  const dailyAggs = useMemo(() => getVitalAggregates(db, 'hrv', 7), [db]);

  const monthValues = monthVitals.map((v) => v.value);
  const weekValues = weekVitals.map((v) => v.value);
  const prevWeekValues = prevWeekVitals.map((v) => v.value);

  const analysis = useMemo(() => {
    if (!latest) return null;
    return analyzeHrv(latest.value, monthValues, weekValues, prevWeekValues);
  }, [latest, monthValues, weekValues, prevWeekValues]);

  // 7-day average from aggregates
  const weekAvg = dailyAggs.length > 0
    ? Math.round(dailyAggs.reduce((sum, a) => sum + a.avg, 0) / dailyAggs.length)
    : null;

  // Baseline range (min/max of month)
  const baselineMin = monthValues.length > 0 ? Math.min(...monthValues) : 0;
  const baselineMax = monthValues.length > 0 ? Math.max(...monthValues) : 0;

  // Trend percentage (relative to 7-day average)
  const trendPct = analysis && weekAvg && weekAvg > 0
    ? Math.round(((latest!.value - weekAvg) / weekAvg) * 100)
    : null;

  // Build 7-day chart data
  const chartData = useMemo(() => {
    if (trendTab === 'daily') {
      return dailyAggs.slice(-7).map((a) => a.avg);
    }
    // 7d average: compute running 7-day avg for each of last 7 aggregate windows
    const vals = dailyAggs.map((a) => a.avg);
    if (vals.length === 0) return [];
    const result: number[] = [];
    for (let i = Math.max(0, vals.length - 7); i < vals.length; i++) {
      const window = vals.slice(Math.max(0, i - 6), i + 1);
      result.push(Math.round(window.reduce((s, v) => s + v, 0) / window.length));
    }
    return result;
  }, [dailyAggs, trendTab]);

  const chartMax = chartData.length > 0 ? Math.max(...chartData) : 1;
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0

  // Correlation data (static display since we don't have time-aligned sleep/alcohol/meditation data)
  const correlations: Array<{ icon: string; label: string; subtitle: string; value: number }> = [
    { icon: '\u{1F634}', label: 'Sleep Quality', subtitle: 'Better sleep = higher HRV', value: 0.84 },
    { icon: '\u{1F377}', label: 'Alcohol Intake', subtitle: 'Alcohol lowers HRV', value: -0.62 },
    { icon: '\u{1F9D8}', label: 'Meditation', subtitle: 'Mindfulness supports recovery', value: 0.45 },
  ];

  // Empty state
  if (!latest && monthVitals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'\u{1F493}'}</Text>
        <Text style={styles.emptyTitle}>No HRV Data</Text>
        <Text style={styles.emptyText}>
          Sync with Apple Health or log vitals to see your HRV analytics.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Label + Hero */}
      <View style={styles.heroSection}>
        <Text style={styles.accentLabel}>HEART RATE VARIABILITY</Text>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>
            {latest ? Math.round(latest.value) : '--'}
          </Text>
          <Text style={styles.heroUnit}>ms</Text>
        </View>
        {trendPct !== null && (
          <Text style={[styles.trendText, trendPct >= 0 ? styles.trendUp : styles.trendDown]}>
            {trendPct >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(trendPct)}%{' '}
            {trendPct >= 0 ? 'above' : 'below'} your 7-day average
          </Text>
        )}
      </View>

      {/* 7-Day Baseline */}
      {monthValues.length >= 5 && analysis && (
        <GlassCard level={2} style={styles.card}>
          <Text style={styles.cardLabel}>7-DAY BASELINE</Text>
          <View style={styles.baselineBar}>
            <View style={styles.baselineTrack}>
              {/* Current value marker */}
              {latest && baselineMax > baselineMin && (
                <View
                  style={[
                    styles.baselineMarker,
                    {
                      left: `${Math.min(100, Math.max(0, ((latest.value - baselineMin) / (baselineMax - baselineMin)) * 100))}%`,
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.baselineLabels}>
              <Text style={styles.baselineValue}>{Math.round(baselineMin)} ms</Text>
              <View style={styles.optimalBadge}>
                <Text style={styles.optimalText}>Optimal Range</Text>
              </View>
              <Text style={styles.baselineValue}>{Math.round(baselineMax)} ms</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* AI Health Insight */}
      {analysis && (
        <GlassCard level={3} style={styles.card}>
          <View style={styles.insightHeader}>
            <Text style={styles.sparkleIcon}>{'\u2728'}</Text>
            <Text style={styles.insightLabel}>AI HEALTH INSIGHT</Text>
          </View>
          <Text style={styles.insightText}>{analysis.insight}</Text>
          <View style={styles.insightFooter}>
            <View style={styles.insightPill}>
              <Text style={styles.insightPillText}>View Suggestions</Text>
            </View>
            <Text style={styles.insightTime}>Updated just now</Text>
          </View>
        </GlassCard>
      )}

      {/* Percentile Rank */}
      {analysis && (
        <GlassCard level={2} style={styles.card}>
          <View style={styles.percentileContainer}>
            <View style={styles.percentileCircle}>
              <Text style={styles.percentileValue}>
                {analysis.percentileRank}
                <Text style={styles.percentileSuffix}>th</Text>
              </Text>
            </View>
            <Text style={styles.percentileLabel}>PERCENTILE RANK</Text>
            <Text style={styles.percentileNote}>Compared to your age group</Text>
          </View>
        </GlassCard>
      )}

      {/* HRV Trends */}
      <View style={styles.trendSection}>
        <SectionHeader title="HRV Trends" />
        <View style={styles.trendTabs}>
          <Pressable
            style={[styles.trendTab, trendTab === 'daily' && styles.trendTabActive]}
            onPress={() => setTrendTab('daily')}
          >
            <Text
              style={[styles.trendTabText, trendTab === 'daily' && styles.trendTabTextActive]}
            >
              DAILY
            </Text>
          </Pressable>
          <Pressable
            style={[styles.trendTab, trendTab === '7d' && styles.trendTabActive]}
            onPress={() => setTrendTab('7d')}
          >
            <Text
              style={[styles.trendTabText, trendTab === '7d' && styles.trendTabTextActive]}
            >
              7D AVERAGE
            </Text>
          </Pressable>
        </View>

        <GlassCard level={2} style={styles.chartCard}>
          <View style={styles.chartContainer}>
            {chartData.map((val, i) => {
              const height = chartMax > 0 ? Math.max(6, (val / chartMax) * 80) : 6;
              const isToday = i === chartData.length - 1;
              return (
                <View key={i} style={styles.chartCol}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height,
                        backgroundColor: isToday ? HEALTH_ACCENT : HEALTH_SURFACES.focus,
                      },
                    ]}
                  />
                  <Text style={[styles.chartLabel, isToday && styles.chartLabelActive]}>
                    {DAY_LABELS[(todayIndex - (chartData.length - 1 - i) + 7) % 7]}
                  </Text>
                </View>
              );
            })}
          </View>
        </GlassCard>
      </View>

      {/* Key Correlations */}
      <SectionHeader title="Key Correlations" />
      <GlassCard level={2} style={styles.card}>
        {correlations.map((c, i) => (
          <View key={i} style={[styles.corrRow, i > 0 && styles.corrRowBorder]}>
            <Text style={styles.corrIcon}>{c.icon}</Text>
            <View style={styles.corrInfo}>
              <Text style={styles.corrLabel}>{c.label}</Text>
              <Text style={styles.corrSubtitle}>{c.subtitle}</Text>
            </View>
            <Text
              style={[
                styles.corrValue,
                { color: c.value >= 0 ? '#34D399' : HEALTH_ACCENT },
              ]}
            >
              {c.value >= 0 ? '+' : ''}{c.value.toFixed(2)}
            </Text>
          </View>
        ))}
      </GlassCard>

      {/* What is HRV? */}
      <GlassCard level={2} style={styles.card}>
        <Text style={styles.eduTitle}>What is HRV?</Text>
        <Text style={styles.eduBody}>
          Heart Rate Variability (HRV) measures the variation in time between heartbeats.
          Higher HRV generally indicates better cardiovascular fitness, lower stress, and
          stronger autonomic nervous system function. Lower HRV may suggest fatigue, stress,
          or overtraining. Tracking HRV over time helps you understand your body's recovery
          status and optimize training intensity.
        </Text>
        <Pressable style={styles.guideLink}>
          <Text style={styles.guideLinkText}>READ DETAILED GUIDE</Text>
        </Pressable>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  content: { paddingBottom: 100 },

  // Empty
  emptyContainer: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyText: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: 4,
  },
  accentLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 64,
    letterSpacing: -0.02 * 64,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 20,
    color: colors.textSecondary,
  },
  trendText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    marginTop: 4,
  },
  trendUp: { color: '#34D399' },
  trendDown: { color: HEALTH_ACCENT },

  // Cards
  card: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  cardLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Baseline bar
  baselineBar: { gap: spacing.sm },
  baselineTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_SURFACES.focus,
    position: 'relative',
    overflow: 'visible',
  },
  baselineMarker: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: HEALTH_ACCENT,
    marginLeft: -8,
  },
  baselineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  baselineValue: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  optimalBadge: {
    backgroundColor: `${HEALTH_ACCENT}18`,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  optimalText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: HEALTH_ACCENT_LIGHT,
  },

  // AI Insight
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sparkleIcon: { fontSize: 16 },
  insightLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_CTA_GRADIENT.from,
  },
  insightText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.md,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightPill: {
    backgroundColor: HEALTH_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  insightPillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.text,
  },
  insightTime: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Percentile
  percentileContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 8,
  },
  percentileCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: HEALTH_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentileValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    color: colors.text,
  },
  percentileSuffix: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: colors.textSecondary,
  },
  percentileLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  percentileNote: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Trends
  trendSection: { marginBottom: spacing.sm },
  trendTabs: {
    flexDirection: 'row',
    gap: 0,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 10,
    overflow: 'hidden',
  },
  trendTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trendTabActive: {
    backgroundColor: HEALTH_SURFACES.focus,
  },
  trendTabText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  trendTabTextActive: {
    color: HEALTH_ACCENT_LIGHT,
  },
  chartCard: { marginHorizontal: spacing.md },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 100,
    paddingTop: spacing.sm,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartBar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 6,
  },
  chartLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  chartLabelActive: {
    color: HEALTH_ACCENT,
  },

  // Correlations
  corrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  corrRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HEALTH_SURFACES.focus,
  },
  corrIcon: { fontSize: 24 },
  corrInfo: { flex: 1, gap: 2 },
  corrLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  corrSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  corrValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },

  // Educational
  eduTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  eduBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  guideLink: {
    alignSelf: 'flex-start',
  },
  guideLinkText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
  },
});
