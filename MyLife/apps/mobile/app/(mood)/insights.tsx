import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getMoodEntries,
  getDailyAverages,
  getActivityCorrelations,
  getTopEmotions,
  getMoodDashboard,
  getEmotionTagsForEntry,
  getActivitiesForEntry,
  getActivityById,
  generateInsights,
  type MoodInsight,
  type InsightType,
  type LastNightSleepSummary,
  GlassCard,
  SectionHeader,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
  getLastNightSleep,
} from '@mylife/mood';
import {
  getSleepMoodCorrelation,
  type SleepMoodCorrelation,
} from '@mylife/sleep';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// ── Insight card metadata per type ───────────────────────────────────

const INSIGHT_META: Record<InsightType, { icon: string; category: string }> = {
  day_of_week_pattern: { icon: '📊', category: 'WEEKLY PEAK' },
  time_of_day_pattern: { icon: '🌅', category: 'CIRCADIAN RHYTHM' },
  activity_impact: { icon: '🏃', category: 'BODY-MIND CONNECTION' },
  emotion_cluster: { icon: '🎯', category: 'EMOTION MAPPING' },
  streak_impact: { icon: '🔥', category: 'CONSISTENCY' },
  trend_direction: { icon: '📈', category: 'GROWTH' },
  volatility_alert: { icon: '⚖️', category: 'EQUILIBRIUM' },
  best_worst_day: { icon: '⭐', category: 'MILESTONE' },
};

// ── Navigation chips ─────────────────────────────────────────────────

const NAV_CHIPS = [
  { label: 'Experiments', icon: '🧪', route: '/(mood)/experiments' },
  { label: 'Year in Pixels', icon: '🎨', route: '/(mood)/year-pixels' },
  { label: 'History', icon: '📅', route: '/(mood)/history' },
  { label: 'Top Emotions', icon: '💎', route: '/(mood)/top-emotions' },
] as const;

// ── Inspirational quotes ─────────────────────────────────────────────

const QUOTES = [
  { text: 'The mind is its own place, and in itself can make a heaven of hell, a hell of heaven.', author: 'John Milton' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson' },
];

export default function InsightsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

  const dashboard = useMemo(() => getMoodDashboard(db), [db]);
  const dailyAverages = useMemo(() => getDailyAverages(db, thirtyDaysAgo, today), [db, thirtyDaysAgo, today]);
  const correlations = useMemo(() => getActivityCorrelations(db, 30), [db]);
  const topEmotions = useMemo(() => getTopEmotions(db, thirtyDaysAgo, today), [db, thirtyDaysAgo, today]);
  const sleepMoodCorrelation = useMemo(
    () => getSleepMoodCorrelation(db, {
      startDate: thirtyDaysAgo,
      endDate: today,
    }),
    [db, thirtyDaysAgo, today],
  );
  const lastNightSleep = useMemo(
    () => getLastNightSleep(db, { referenceDate: today }),
    [db, today],
  );

  const insights = useMemo(() => {
    const entries = getMoodEntries(db, { startDate: thirtyDaysAgo, endDate: today, limit: 500 });
    if (entries.length < 3) return [];

    const entryData = entries.map((e) => {
      const emotions = getEmotionTagsForEntry(db, e.id);
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
        emotions: emotions.map((em) => em.emotion),
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

    const dailyAvgs = dailyAverages.map((d) => d.average);

    return generateInsights({
      entries: entryData,
      activityCorrelations: correlations.map((c) => ({
        activityName: c.activityName,
        averageScore: c.averageScore,
        entryCount: c.entryCount,
        pearsonR: c.pearsonR,
      })),
      overallAvg: dashboard.monthAverage ?? 0,
      thisWeekAvg,
      fourWeekAvg,
      thisWeekCount: thisWeekEntries.length,
      dailyAverages: dailyAvgs,
      streakDayScores: [],
      nonStreakDayScores: [],
    });
  }, [db, thirtyDaysAgo, today, sevenDaysAgo, twentyEightDaysAgo, dailyAverages, correlations, dashboard.monthAverage]);

  // Find the best day from insights data
  const bestDayInsight = insights.find((i) => i.type === 'best_worst_day');
  const bestDayDate = bestDayInsight?.data?.bestDate as string | undefined;
  const bestDayScore = bestDayInsight?.data?.bestScore as number | undefined;

  // Pick a stable quote based on day of month
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  // Build day-of-week bar chart data from daily averages
  const dayOfWeekData = useMemo(() => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dailyAverages) {
      const dow = new Date(d.date + 'T12:00:00').getDay();
      const idx = dow === 0 ? 6 : dow - 1; // Mon=0 ... Sun=6
      sums[idx] += d.average;
      counts[idx]++;
    }
    const avgs = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
    const max = Math.max(...avgs, 1);
    return days.map((label, i) => ({
      label,
      value: avgs[i],
      height: (avgs[i] / max) * 100,
      isHighest: avgs[i] === Math.max(...avgs) && avgs[i] > 0,
    }));
  }, [dailyAverages]);

  // Get top emotion names for cluster card chips
  const topEmotionNames = useMemo(
    () => topEmotions.slice(0, 4).map((e) => e.emotion.charAt(0).toUpperCase() + e.emotion.slice(1)),
    [topEmotions],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ── Editorial Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PERSONAL ANALYTICS</Text>
        <Text style={styles.headerTitle}>Mood Intelligence</Text>
        <Text style={styles.headerSubtitle}>
          Your emotional patterns, decoded by AI.{'\n'}
          Explore how your environment and habits shape your inner landscape.
        </Text>
      </View>

      {/* ── Quick Navigation ───────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {NAV_CHIPS.map((chip) => (
          <Pressable
            key={chip.label}
            style={styles.navChip}
            onPress={() => router.push(chip.route as `/${string}`)}
          >
            <Text style={styles.navChipIcon}>{chip.icon}</Text>
            <Text style={styles.navChipLabel}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SleepBridgeCards
        correlation={sleepMoodCorrelation}
        lastNightSleep={lastNightSleep}
      />

      {/* ── AI Pattern Cards ───────────────────────────────────── */}
      {insights.length > 0 ? (
        <View style={styles.cardsContainer}>
          {insights.map((insight) => (
            <InsightPatternCard
              key={insight.id}
              insight={insight}
              dayOfWeekData={dayOfWeekData}
              topEmotionNames={topEmotionNames}
              streakDays={dashboard.currentStreak}
              monthAvg={dashboard.monthAverage}
            />
          ))}
        </View>
      ) : (
        <GlassCard level={2} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔮</Text>
          <Text style={styles.emptyTitle}>Building Your Intelligence</Text>
          <Text style={styles.emptyBody}>
            Log at least 3 mood entries to start seeing AI-powered insights about your emotional patterns.
          </Text>
        </GlassCard>
      )}

      {/* ── Monthly Highlight ──────────────────────────────────── */}
      {bestDayDate && (
        <View style={styles.highlightSection}>
          <SectionHeader label="MONTHLY HIGHLIGHT" title="Your Best Day" />
          <GlassCard level={3} style={styles.highlightCard}>
            <Text style={styles.highlightDate}>
              {formatHighlightDate(bestDayDate)}
            </Text>
            <Text style={styles.highlightBody}>
              This was your highest recorded day of the month.
              {bestDayScore != null && ` You scored ${bestDayScore}/10.`}
            </Text>
            {Array.isArray((bestDayInsight?.data as Record<string, unknown>)?.bestActivities) && (
              <Text style={styles.highlightActivities}>
                Activities: {((bestDayInsight!.data as Record<string, unknown>).bestActivities as string[]).join(', ')}
              </Text>
            )}
            <View style={styles.highlightActions}>
              <GradientButton
                title="REPLICATE ROUTINE"
                onPress={() => router.push('/(mood)/log-mood')}
              />
              <Pressable onPress={() => router.push(`/(mood)/day-detail?date=${bestDayDate}` as `/${string}`)}>
                <Text style={styles.detailsLink}>DETAILS</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      )}

      {/* ── Footer Quote ───────────────────────────────────────── */}
      <View style={styles.quoteSection}>
        <Text style={styles.quoteMarks}>{'\u201C\u201C'}</Text>
        <Text style={styles.quoteText}>
          {'\u201C'}{quote.text}{'\u201D'}
        </Text>
        <Text style={styles.quoteAuthor}>{'\u2014'} {quote.author}</Text>
      </View>

      {/* ── Footer Disclaimer ──────────────────────────────────── */}
      <Text style={styles.footerDisclaimer}>
        Insights are generated from your data. More entries = better insights.
      </Text>
    </ScrollView>
  );
}

function SleepBridgeCards({
  correlation,
  lastNightSleep,
}: {
  correlation: SleepMoodCorrelation;
  lastNightSleep: LastNightSleepSummary | null;
}) {
  const reportableCorrelation =
    correlation.status === 'reportable' ? correlation : null;
  if (!reportableCorrelation && !lastNightSleep) {
    return null;
  }

  return (
    <View style={styles.bridgeSection}>
      {reportableCorrelation ? (
        <GlassCard level={2} style={styles.bridgeCard}>
          <Text style={styles.cardCategory}>SLEEP AND MOOD</Text>
          <Text style={styles.cardTitle}>
            Sleep quality is part of your mood pattern
          </Text>
          <Text style={styles.cardBody}>{reportableCorrelation.insight}</Text>
          <Text style={styles.bridgeMeta}>
            r={reportableCorrelation.correlation.toFixed(2)} · {reportableCorrelation.sampleSize} paired days
          </Text>
        </GlassCard>
      ) : null}
      {lastNightSleep ? (
        <GlassCard level={2} style={styles.bridgeCard}>
          <Text style={styles.cardCategory}>LAST NIGHT</Text>
          <Text style={styles.cardTitle}>{lastNightSleep.context}</Text>
          <Text style={styles.cardBody}>
            Use this as context when reading today mood entries.
          </Text>
        </GlassCard>
      ) : null}
    </View>
  );
}

// ── Insight Pattern Card ─────────────────────────────────────────────

interface InsightPatternCardProps {
  insight: MoodInsight;
  dayOfWeekData: { label: string; value: number; height: number; isHighest: boolean }[];
  topEmotionNames: string[];
  streakDays: number;
  monthAvg: number | null;
}

function InsightPatternCard({
  insight,
  dayOfWeekData,
  topEmotionNames,
  streakDays,
  monthAvg,
}: InsightPatternCardProps) {
  const meta = INSIGHT_META[insight.type];

  return (
    <GlassCard level={2} style={styles.patternCard}>
      {/* Category label */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{meta.icon}</Text>
        <Text style={styles.cardCategory}>{meta.category}</Text>
      </View>

      {/* Finding title */}
      <Text style={styles.cardTitle}>{insight.title}</Text>

      {/* Description */}
      <Text style={styles.cardBody}>{insight.body}</Text>

      {/* Type-specific mini visualization */}
      {insight.type === 'day_of_week_pattern' && (
        <MiniBarChart data={dayOfWeekData} />
      )}
      {insight.type === 'emotion_cluster' && topEmotionNames.length > 0 && (
        <View style={styles.emotionChips}>
          {topEmotionNames.map((name) => (
            <View key={name} style={styles.emotionChip}>
              <Text style={styles.emotionChipText}>{name}</Text>
            </View>
          ))}
        </View>
      )}
      {insight.type === 'streak_impact' && (
        <View style={styles.streakDisplay}>
          <Text style={styles.streakNumber}>{streakDays}</Text>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
        </View>
      )}
      {insight.type === 'trend_direction' && (
        <View style={styles.trendDisplay}>
          <Text style={styles.trendValue}>{insight.metric}</Text>
          <Text style={styles.trendArrow}>{'\u2197'}</Text>
        </View>
      )}
      {insight.type === 'volatility_alert' && monthAvg != null && (
        <View style={styles.stabilityDisplay}>
          <Text style={styles.stabilityValue}>{monthAvg.toFixed(1)}</Text>
          <Text style={styles.stabilityLabel}>Stability Index ({insight.severity === 'info' ? 'High' : 'Low'})</Text>
        </View>
      )}
      {insight.type === 'best_worst_day' && (
        <Pressable style={styles.recallLink}>
          <Text style={styles.recallText}>RECALL MEMORY  {'\u2192'}</Text>
        </Pressable>
      )}
    </GlassCard>
  );
}

// ── Mini Bar Chart ───────────────────────────────────────────────────

function MiniBarChart({ data }: { data: { label: string; height: number; isHighest: boolean }[] }) {
  return (
    <View style={styles.barChartContainer}>
      <View style={styles.barRow}>
        {data.map((bar, i) => (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${Math.max(bar.height, 5)}%`,
                    backgroundColor: bar.isHighest ? MOOD_ACCENT : MOOD_SURFACES.focus,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barLabel, bar.isHighest && styles.barLabelActive]}>
              {bar.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatHighlightDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { paddingBottom: 100 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
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

  // Navigation chips
  chipRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  navChipIcon: { fontSize: 14 },
  navChipLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.text,
  },

  // Cards container
  cardsContainer: { paddingHorizontal: 20, gap: 16 },
  bridgeSection: { paddingHorizontal: 20, gap: 12 },
  bridgeCard: { paddingVertical: 20, paddingHorizontal: 20 },
  bridgeMeta: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginTop: 10,
  },

  // Pattern card
  patternCard: { paddingVertical: 20, paddingHorizontal: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardIcon: { fontSize: 16 },
  cardCategory: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
  },
  cardTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 6,
  },
  cardBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Day-of-week bar chart
  barChartContainer: { marginTop: 16 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: {
    width: '100%',
    height: 60,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  barLabelActive: { color: MOOD_ACCENT },

  // Emotion chips
  emotionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  emotionChip: {
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  emotionChipText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.text,
  },

  // Streak display
  streakDisplay: { marginTop: 14 },
  streakNumber: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
  },
  streakLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Trend display
  trendDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  trendValue: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 36,
    fontWeight: '700',
    color: MOOD_ACCENT,
  },
  trendArrow: { fontSize: 24, color: MOOD_ACCENT },

  // Stability display
  stabilityDisplay: { marginTop: 14 },
  stabilityValue: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 36,
    fontWeight: '700',
    color: MOOD_ACCENT,
  },
  stabilityLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Recall link
  recallLink: { marginTop: 14 },
  recallText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
  },

  // Empty state
  emptyCard: { marginHorizontal: 20, alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 8,
  },
  emptyBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Monthly highlight
  highlightSection: { marginTop: 24 },
  highlightCard: { marginHorizontal: 20, marginTop: 8 },
  highlightDate: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  highlightBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  highlightActivities: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: MOOD_ACCENT_LIGHT,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  highlightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  detailsLink: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },

  // Quote section
  quoteSection: {
    marginTop: 32,
    marginHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  quoteMarks: {
    fontSize: 40,
    color: MOOD_ACCENT,
    lineHeight: 40,
    marginBottom: 12,
  },
  quoteText: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 30,
    paddingHorizontal: 8,
  },
  quoteAuthor: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginTop: 16,
  },

  // Footer
  footerDisclaimer: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
