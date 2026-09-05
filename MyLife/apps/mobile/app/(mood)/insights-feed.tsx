import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getMoodEntries,
  getMoodEntryCount,
  getDailyAverages,
  getActivityCorrelations,
  getTopEmotions,
  getEmotionTagsForEntry,
  getActivitiesForEntry,
  getActivityById,
  generateInsights,
  type InsightType,
  GlassCard,
  SectionHeader,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// ── Insight metadata ──────────────────────────────────────────────────

const INSIGHT_META: Record<InsightType, { icon: string; category: string; chartLabel: string }> = {
  day_of_week_pattern: { icon: '📊', category: 'WEEKLY PEAK', chartLabel: 'Day-of-Week Score' },
  time_of_day_pattern: { icon: '🌅', category: 'CIRCADIAN RHYTHM', chartLabel: 'Time-of-Day Score' },
  activity_impact: { icon: '🏃', category: 'BODY-MIND CONNECTION', chartLabel: 'Mood Boost Index' },
  emotion_cluster: { icon: '🎯', category: 'EMOTION MAPPING', chartLabel: 'Emotion Frequency' },
  streak_impact: { icon: '🔥', category: 'CONSISTENCY', chartLabel: 'Streak vs Non-Streak' },
  trend_direction: { icon: '📈', category: 'GROWTH', chartLabel: 'Weekly Trend' },
  volatility_alert: { icon: '⚖️', category: 'EQUILIBRIUM', chartLabel: 'Stability Index' },
  best_worst_day: { icon: '⭐', category: 'MILESTONE', chartLabel: 'Day Comparison' },
};

// ── Suggested actions by insight type ─────────────────────────────────

const SUGGESTED_ACTIONS: Record<InsightType, { title: string; body: string }> = {
  activity_impact: {
    title: 'Try scheduling social activities on Wednesdays',
    body: 'Data shows your mid-week energy levels dip by 15%, but social interaction consistently neutralizes this trend.',
  },
  day_of_week_pattern: {
    title: 'Protect your best day with a morning ritual',
    body: 'Your highest-scoring day consistently benefits from early starts. Try preserving that morning routine.',
  },
  time_of_day_pattern: {
    title: 'Log mood at your peak time window',
    body: 'Capturing entries during your natural high point helps build awareness of what drives those peaks.',
  },
  emotion_cluster: {
    title: 'Name your emotions more precisely',
    body: 'Expanding your emotional vocabulary helps you process feelings more effectively. Try distinguishing subtle variations.',
  },
  streak_impact: {
    title: 'Keep your streak going this week',
    body: 'Consistent logging correlates with higher mood scores. Even a quick 1-minute entry counts.',
  },
  trend_direction: {
    title: 'Double down on what is working',
    body: 'Your recent upward trend suggests positive changes are taking effect. Keep the momentum going.',
  },
  volatility_alert: {
    title: 'Add a grounding routine before bed',
    body: 'High mood variability often responds well to consistent evening wind-down rituals.',
  },
  best_worst_day: {
    title: 'Replicate your best day formula',
    body: 'Revisit the activities and conditions from your peak day to recreate similar positive experiences.',
  },
};

// ── Date range options ────────────────────────────────────────────────

const DATE_RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
] as const;

// ── Inspirational quotes ──────────────────────────────────────────────

const QUOTES = [
  { text: "The key to consistent joy isn't the absence of stress, but the presence of meaningful activity.", source: 'JOURNAL ENTRY' },
  { text: 'What you track, you transform. Every data point is a step toward self-mastery.', source: 'REFLECTION' },
  { text: 'Patterns reveal what habits hide. Let the data guide your growth.', source: 'INSIGHT' },
];

export default function InsightDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [selectedRange, setSelectedRange] = useState(2); // default 30D

  const rangeDays = DATE_RANGES[selectedRange].days;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

  const entryCount = useMemo(() => getMoodEntryCount(db), [db]);

  const { insight, correlations, topEmotions, dailyAverages } = useMemo(() => {
    const entries = getMoodEntries(db, { startDate, endDate: today, limit: 500 });
    const dailyAvgs = getDailyAverages(db, startDate, today);
    const corrs = getActivityCorrelations(db, rangeDays);
    const emotions = getTopEmotions(db, startDate, today);

    if (entries.length < 3) {
      return { insight: null, correlations: corrs, topEmotions: emotions, dailyAverages: dailyAvgs };
    }

    const entryData = entries.map((e) => {
      const emos = getEmotionTagsForEntry(db, e.id);
      const links = getActivitiesForEntry(db, e.id);
      const activityNames = links
        .map((l) => getActivityById(db, l.activityId))
        .filter(Boolean)
        .map((a) => a!.name);
      return {
        score: e.score,
        date: e.date,
        loggedAt: e.loggedAt,
        activityNames,
        emotions: emos.map((em) => em.emotion),
      };
    });

    const thisWeekEntries = entries.filter((e) => e.date >= sevenDaysAgo);
    const thisWeekAvg = thisWeekEntries.length > 0
      ? thisWeekEntries.reduce((s, e) => s + e.score, 0) / thisWeekEntries.length
      : 0;
    const fourWeekEntries = entries.filter((e) => e.date >= twentyEightDaysAgo);
    const fourWeekAvg = fourWeekEntries.length > 0
      ? fourWeekEntries.reduce((s, e) => s + e.score, 0) / fourWeekEntries.length
      : 0;

    const insights = generateInsights({
      entries: entryData,
      activityCorrelations: corrs.map((c) => ({
        activityName: c.activityName,
        averageScore: c.averageScore,
        entryCount: c.entryCount,
        pearsonR: c.pearsonR ?? 0,
      })),
      overallAvg: 0,
      thisWeekAvg,
      fourWeekAvg,
      thisWeekCount: thisWeekEntries.length,
      dailyAverages: dailyAvgs.map((d) => d.average),
      streakDayScores: [],
      nonStreakDayScores: [],
    });

    const targetType = params.type as InsightType | undefined;
    const found = targetType
      ? insights.find((i) => i.type === targetType) ?? insights[0]
      : insights[0];

    return { insight: found ?? null, correlations: corrs, topEmotions: emotions, dailyAverages: dailyAvgs };
  }, [db, startDate, today, rangeDays, sevenDaysAgo, twentyEightDaysAgo, params.type]);

  // Build chart data based on insight type
  const chartData = useMemo(() => {
    if (!insight) return [];

    switch (insight.type) {
      case 'activity_impact':
        return correlations.slice(0, 5).map((c) => ({
          label: c.activityName.length > 8 ? c.activityName.slice(0, 8) : c.activityName,
          value: Math.round((c.averageScore - 5) * 10),
          displayValue: `${c.averageScore > 5 ? '+' : ''}${Math.round((c.averageScore - 5) * 10)}%`,
          isHighlight: (c.pearsonR ?? 0) > 0.3,
        }));
      case 'day_of_week_pattern': {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const sums = [0, 0, 0, 0, 0, 0, 0];
        const counts = [0, 0, 0, 0, 0, 0, 0];
        for (const d of dailyAverages) {
          const dow = new Date(d.date + 'T12:00:00').getDay();
          const idx = dow === 0 ? 6 : dow - 1;
          sums[idx] += d.average;
          counts[idx]++;
        }
        const avgs = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
        const maxVal = Math.max(...avgs, 1);
        return days.map((label, i) => ({
          label,
          value: avgs[i],
          displayValue: avgs[i] > 0 ? avgs[i].toFixed(1) : '-',
          isHighlight: avgs[i] === Math.max(...avgs) && avgs[i] > 0,
          heightPct: (avgs[i] / maxVal) * 100,
        }));
      }
      case 'emotion_cluster':
        return topEmotions.slice(0, 5).map((e) => ({
          label: e.emotion.charAt(0).toUpperCase() + e.emotion.slice(1),
          value: e.count,
          displayValue: `${e.count}x`,
          isHighlight: e.count === Math.max(...topEmotions.slice(0, 5).map((t) => t.count)),
        }));
      default:
        return dailyAverages.slice(-7).map((d) => ({
          label: new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 3),
          value: d.average,
          displayValue: d.average.toFixed(1),
          isHighlight: false,
        }));
    }
  }, [insight, correlations, dailyAverages, topEmotions]);

  // Related insights (other insight types)
  const relatedTypes = useMemo(() => {
    if (!insight) return [];
    const allTypes: InsightType[] = [
      'day_of_week_pattern', 'time_of_day_pattern', 'activity_impact',
      'emotion_cluster', 'streak_impact', 'trend_direction',
    ];
    return allTypes.filter((t) => t !== insight.type).slice(0, 3);
  }, [insight]);

  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  if (!insight) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'🔮'}</Text>
        <Text style={styles.emptyTitle}>No Insight Available</Text>
        <Text style={styles.emptyBody}>
          Log more mood entries to unlock detailed analysis.
        </Text>
        <GradientButton title="Go Back" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  const meta = INSIGHT_META[insight.type];
  const action = SUGGESTED_ACTIONS[insight.type];
  const maxChartValue = Math.max(...chartData.map((d) => Math.abs(d.value)), 1);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </Pressable>
        <Text style={styles.headerLabel}>ANALYSIS DETAIL</Text>
        <Text style={styles.headerTitle}>{insight.title}</Text>
        <Text style={styles.headerSubtitle}>
          {insight.body} Based on your last {rangeDays} days of check-ins.
        </Text>
      </View>

      {/* ── Date Range Filter ───────────────────────────────────── */}
      <View style={styles.dateFilterRow}>
        {DATE_RANGES.map((range, i) => (
          <Pressable
            key={range.label}
            style={[styles.dateChip, i === selectedRange && styles.dateChipActive]}
            onPress={() => setSelectedRange(i)}
          >
            <Text style={[styles.dateChipText, i === selectedRange && styles.dateChipTextActive]}>
              {range.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Main Chart Card ─────────────────────────────────────── */}
      <GlassCard level={2} style={styles.chartCard}>
        <View style={styles.chartHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>{meta.chartLabel}</Text>
            <Text style={styles.chartSubtitle}>
              {insight.type === 'activity_impact'
                ? 'Average percentage increase per session'
                : 'Score distribution across the period'}
            </Text>
          </View>
          <View style={styles.chartIconBadge}>
            <Text style={styles.chartIconText}>{'📊'}</Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={styles.barChartArea}>
          <View style={styles.barRow}>
            {chartData.map((bar, i) => {
              const heightPct = 'heightPct' in bar
                ? (bar as { heightPct: number }).heightPct
                : (Math.abs(bar.value) / maxChartValue) * 100;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(heightPct, 8)}%`,
                          backgroundColor: bar.isHighlight ? MOOD_ACCENT : MOOD_SURFACES.focus,
                          borderRadius: 4,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{bar.label}</Text>
                  <Text style={[styles.barValue, bar.isHighlight && { color: MOOD_ACCENT }]}>
                    {bar.displayValue}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </GlassCard>

      {/* ── Suggested Action Card ───────────────────────────────── */}
      <GlassCard level={3} style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={styles.actionIconCircle}>
            <Text style={styles.actionIcon}>{'📍'}</Text>
          </View>
          <Text style={styles.actionLabel}>SUGGESTED ACTION</Text>
        </View>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <Text style={styles.actionBody}>{action.body}</Text>
        <View style={styles.actionButtonRow}>
          <GradientButton title="Try It" onPress={() => router.push('/(mood)/log-mood')} />
        </View>
      </GlassCard>

      {/* ── Stat Badges ─────────────────────────────────────────── */}
      <View style={styles.statRow}>
        <GlassCard level={2} style={styles.statCard}>
          <Text style={styles.statIcon}>{'🏋️'}</Text>
          <Text style={styles.statLabel}>PEAK IMPACT</Text>
          <Text style={styles.statValue}>{insight.metric || 'N/A'}</Text>
        </GlassCard>
        <GlassCard level={2} style={styles.statCard}>
          <Text style={styles.statIcon}>{'🌙'}</Text>
          <Text style={styles.statLabel}>DATA POINTS</Text>
          <Text style={styles.statValue}>{entryCount}</Text>
        </GlassCard>
      </View>

      {/* ── Related Insights ────────────────────────────────────── */}
      {relatedTypes.length > 0 && (
        <View style={styles.relatedSection}>
          <SectionHeader label="EXPLORE RELATED" title="More Patterns" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedScroll}
          >
            {relatedTypes.map((type) => {
              const relMeta = INSIGHT_META[type];
              return (
                <Pressable
                  key={type}
                  onPress={() => router.setParams({ type })}
                >
                  <GlassCard level={2} style={styles.relatedCard}>
                    <Text style={styles.relatedIcon}>{relMeta.icon}</Text>
                    <Text style={styles.relatedCategory}>{relMeta.category}</Text>
                    <Text style={styles.relatedChartLabel}>{relMeta.chartLabel}</Text>
                  </GlassCard>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Quote Card ──────────────────────────────────────────── */}
      <View style={styles.quoteCard}>
        <Text style={styles.quoteText}>
          {'\u201C'}{quote.text}{'\u201D'}
        </Text>
        <Text style={styles.quoteSource}>
          {'\u2014'} {quote.source}, {new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* ── Data Source Footer ──────────────────────────────────── */}
      <Text style={styles.footerText}>
        Based on {entryCount} mood entries over {rangeDays} days
      </Text>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { paddingBottom: 120 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 16 },
  backButton: { marginBottom: 16 },
  backArrow: {
    fontSize: 24,
    color: colors.text,
  },
  headerLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
    marginBottom: 8,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // Date filter
  dateFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.lift,
  },
  dateChipActive: {
    backgroundColor: MOOD_ACCENT,
  },
  dateChipText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  dateChipTextActive: {
    color: '#1a1008',
  },

  // Chart card
  chartCard: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  chartTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 4,
  },
  chartSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chartIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartIconText: { fontSize: 16 },

  // Bar chart
  barChartArea: { marginTop: 8 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 8,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: {
    width: '100%',
    height: 90,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { width: '100%' },
  barLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  barValue: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // Suggested action
  actionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: MOOD_SURFACES.lift,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { fontSize: 16 },
  actionLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
  },
  actionTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 8,
  },
  actionBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  actionButtonRow: {
    flexDirection: 'row',
  },

  // Stat badges
  statRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 12,
  },
  statLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },

  // Related insights
  relatedSection: { marginTop: 24 },
  relatedScroll: { paddingHorizontal: 20, gap: 12, paddingTop: 8 },
  relatedCard: {
    width: 160,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  relatedIcon: { fontSize: 24, marginBottom: 10 },
  relatedCategory: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT_LIGHT,
    marginBottom: 4,
  },
  relatedChartLabel: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Quote
  quoteCard: {
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 16,
  },
  quoteText: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    fontStyle: 'italic',
    color: MOOD_ACCENT_LIGHT,
    lineHeight: 26,
    marginBottom: 12,
  },
  quoteSource: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },

  // Footer
  footerText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
