import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  generateWeeklyReport,
  getActivitiesForEntry,
  getActivityById,
  getActivityCorrelations,
  getDailyAverages,
  getEmotionTagsForEntry,
  getMoodEntries,
  GlassCard,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
  MOOD_SCORE_COLORS,
  type MoodScore,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getWeekBounds(offset: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    monday,
    sunday,
  };
}

function formatDateRange(monday: Date, sunday: Date): string {
  const m1 = MONTH_NAMES[monday.getMonth()];
  const m2 = MONTH_NAMES[sunday.getMonth()];
  if (m1 === m2) {
    return `${m1} ${monday.getDate()} \u2013 ${sunday.getDate()}`;
  }
  return `${m1} ${monday.getDate()} \u2013 ${m2} ${sunday.getDate()}`;
}

function formatDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()} (${days[d.getDay()]})`;
}

export default function MoodWeeklyReportScreen() {
  const db = useDatabase();
  const [weekOffset, setWeekOffset] = useState(0);

  const { start: weekStart, end: weekEnd, monday, sunday } = useMemo(
    () => getWeekBounds(weekOffset),
    [weekOffset],
  );

  const prevWeekBounds = useMemo(() => getWeekBounds(weekOffset - 1), [weekOffset]);

  const report = useMemo(() => {
    const entries = getMoodEntries(db, { startDate: weekStart, endDate: weekEnd, limit: 200 });
    const payload = entries.map((entry) => ({
      score: entry.score,
      date: entry.date,
      emotions: getEmotionTagsForEntry(db, entry.id).map((item) => item.emotion),
      activityNames: getActivitiesForEntry(db, entry.id)
        .map((link) => getActivityById(db, link.activityId))
        .filter(Boolean)
        .map((activity) => activity!.name),
    }));
    return generateWeeklyReport(weekStart, weekEnd, payload);
  }, [db, weekEnd, weekStart]);

  const prevReport = useMemo(() => {
    const entries = getMoodEntries(db, {
      startDate: prevWeekBounds.start,
      endDate: prevWeekBounds.end,
      limit: 200,
    });
    const payload = entries.map((entry) => ({
      score: entry.score,
      date: entry.date,
      emotions: getEmotionTagsForEntry(db, entry.id).map((item) => item.emotion),
      activityNames: getActivitiesForEntry(db, entry.id)
        .map((link) => getActivityById(db, link.activityId))
        .filter(Boolean)
        .map((activity) => activity!.name),
    }));
    return generateWeeklyReport(prevWeekBounds.start, prevWeekBounds.end, payload);
  }, [db, prevWeekBounds]);

  const correlations = useMemo(() => getActivityCorrelations(db, 7), [db]);

  const trend = report.average && prevReport.average
    ? +(report.average - prevReport.average).toFixed(1)
    : null;

  // Find best and worst day
  const bestWorst = useMemo(() => {
    const entries = getMoodEntries(db, { startDate: weekStart, endDate: weekEnd, limit: 200 });
    if (entries.length === 0) return null;
    const byDate = new Map<string, { total: number; count: number; emotions: string[] }>();
    for (const e of entries) {
      const existing = byDate.get(e.date);
      const emotions = getEmotionTagsForEntry(db, e.id).map((t) => t.emotion);
      if (existing) {
        existing.total += e.score;
        existing.count++;
        existing.emotions.push(...emotions);
      } else {
        byDate.set(e.date, { total: e.score, count: 1, emotions });
      }
    }
    let bestDate = '';
    let bestAvg = -Infinity;
    let worstDate = '';
    let worstAvg = Infinity;
    for (const [date, data] of byDate) {
      const avg = data.total / data.count;
      if (avg > bestAvg) { bestAvg = avg; bestDate = date; }
      if (avg < worstAvg) { worstAvg = avg; worstDate = date; }
    }
    const bestEmotions = byDate.get(bestDate)?.emotions.slice(0, 2) ?? [];
    return { bestDate, bestAvg, worstDate, worstAvg, bestEmotions };
  }, [db, weekStart, weekEnd]);

  // Daily averages for bar chart
  const dailyBars = useMemo(() => {
    const avgs = getDailyAverages(db, weekStart, weekEnd);
    const avgMap = new Map(avgs.map((d) => [d.date, d.average]));
    // Build 7 days starting from Monday
    const bars: { label: string; value: number; date: string }[] = [];
    const d = new Date(monday);
    for (let i = 0; i < 7; i++) {
      const iso = d.toISOString().slice(0, 10);
      bars.push({ label: DAYS[i], value: avgMap.get(iso) ?? 0, date: iso });
      d.setDate(d.getDate() + 1);
    }
    return bars;
  }, [db, weekStart, weekEnd, monday]);

  const maxBar = Math.max(...dailyBars.map((b) => b.value), 1);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Subtitle based on trend
  const subtitle = trend != null
    ? trend > 0
      ? 'Your emotional equilibrium is climbing.'
      : trend < 0
        ? 'A week of introspection and growth.'
        : 'Steady and balanced this week.'
    : report.entryCount > 0
      ? 'Here\u2019s your week at a glance.'
      : 'Start logging to see your weekly patterns.';

  const posCorrelations = correlations.filter((c) => c.pearsonR != null && c.pearsonR > 0).slice(0, 2);
  const negCorrelations = correlations.filter((c) => c.pearsonR != null && c.pearsonR < 0).slice(0, 1);

  const handleShare = async () => {
    const lines = [
      `Weekly Mood Report: ${formatDateRange(monday, sunday)}`,
      `Average: ${report.average ? report.average.toFixed(1) : '--'}/10`,
      `Entries: ${report.entryCount}`,
      report.topEmotions.length > 0
        ? `Top emotions: ${report.topEmotions.map((e) => e.emotion).join(', ')}`
        : '',
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header with week nav */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>WEEKLY REPORT</Text>
        <View style={styles.weekNav}>
          <Pressable onPress={() => setWeekOffset((o) => o - 1)} hitSlop={12}>
            <Text style={styles.navArrow}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{formatDateRange(monday, sunday)}</Text>
          <Pressable
            onPress={() => weekOffset < 0 && setWeekOffset((o) => o + 1)}
            hitSlop={12}
            style={{ opacity: weekOffset < 0 ? 1 : 0.3 }}
          >
            <Text style={styles.navArrow}>{'\u203A'}</Text>
          </Pressable>
        </View>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>

      {/* Average Score Hero */}
      <GlassCard level={2} style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroScoreWrapper}>
            <View style={styles.heroArc}>
              <Text style={styles.heroScore}>
                {report.average ? report.average.toFixed(1) : '--'}
              </Text>
              {trend != null && (
                <Text style={[styles.heroTrend, { color: trend >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {trend >= 0 ? '+' : ''}{trend} from last week
                </Text>
              )}
            </View>
          </View>
        </View>
        <Text style={styles.heroLabel}>AVERAGE MOOD SCORE</Text>
      </GlassCard>

      {/* Peak Performance */}
      {bestWorst && bestWorst.bestAvg > -Infinity && (
        <GlassCard level={2} style={styles.peakCard}>
          <Text style={styles.sectionLabel}>PEAK PERFORMANCE</Text>
          <View style={styles.peakRow}>
            <View style={styles.peakInfo}>
              <Text style={styles.peakDate}>{formatDayName(bestWorst.bestDate)}</Text>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>
                  {bestWorst.bestAvg.toFixed(1)} SCORE
                </Text>
              </View>
            </View>
            <Text style={styles.peakStar}>{'\u2B50'}</Text>
          </View>
          <Text style={styles.peakDescription}>
            A perfect balance of activity and rest led to your highest recorded mood of the week.
          </Text>
        </GlassCard>
      )}

      {/* Top Emotions */}
      {report.topEmotions.length > 0 && (
        <GlassCard level={2} style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>TOP EMOTIONS</Text>
          <View style={styles.emotionsList}>
            {report.topEmotions.slice(0, 3).map((item) => {
              const pct = report.entryCount > 0
                ? Math.round((item.count / report.entryCount) * 100)
                : 0;
              return (
                <View key={item.emotion} style={styles.emotionRow}>
                  <Text style={styles.emotionEmoji}>{getEmotionEmoji(item.emotion)}</Text>
                  <Text style={styles.emotionName}>
                    {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
                  </Text>
                  <Text style={styles.emotionPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>
      )}

      {/* Activity Correlations */}
      {(posCorrelations.length > 0 || negCorrelations.length > 0) && (
        <GlassCard level={2} style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>ACTIVITY CORRELATIONS</Text>
          <View style={styles.correlationList}>
            {posCorrelations.map((c) => (
              <View key={c.activityId} style={styles.correlationRow}>
                <View style={[styles.correlationDot, { backgroundColor: '#4ADE80' }]}>
                  <Text style={styles.correlationDotText}>+</Text>
                </View>
                <Text style={styles.correlationName}>{c.activityName}</Text>
              </View>
            ))}
            {negCorrelations.map((c) => (
              <View key={c.activityId} style={styles.correlationRow}>
                <View style={[styles.correlationDot, { backgroundColor: '#F87171' }]}>
                  <Text style={styles.correlationDotText}>{'\u2013'}</Text>
                </View>
                <Text style={styles.correlationName}>{c.activityName}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* Daily Fluctuations Bar Chart */}
      <GlassCard level={2} style={styles.sectionCard}>
        <View style={styles.fluctHeader}>
          <View>
            <Text style={styles.fluctTitle}>Daily Fluctuations</Text>
            <Text style={styles.fluctSubtitle}>
              Visualizing your energy levels across the week
            </Text>
          </View>
        </View>
        <View style={styles.barChart}>
          {dailyBars.map((bar, i) => {
            const isToday = bar.date === todayIso;
            const barHeight = bar.value > 0 ? (bar.value / maxBar) * 100 : 5;
            const clamped = Math.max(1, Math.min(10, Math.round(bar.value))) as MoodScore;
            const barColor = bar.value > 0 ? MOOD_SCORE_COLORS[clamped] : MOOD_SURFACES.focus;
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${barHeight}%`,
                        backgroundColor: barColor,
                        borderRadius: 8,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>
                  {bar.label}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      {/* Recommendation */}
      <GlassCard level={3} style={styles.recCard}>
        <Text style={styles.recTitle}>Recommended for{'\n'}next week</Text>
        <Text style={styles.recBody}>
          {report.topActivities.length > 0
            ? `Your data suggests that prioritizing ${report.topActivities[0].name.toLowerCase()} significantly boosts your "${report.topEmotions[0]?.emotion ?? 'mood'}" rating.`
            : 'Log more entries with activities to unlock personalized recommendations.'}
        </Text>
        <GradientButton
          title="Update Routine"
          onPress={() => router.push('/(mood)/suggestions' as never)}
        />
      </GlassCard>

      {/* Share */}
      <View style={styles.shareRow}>
        <GradientButton title="Share Report" onPress={handleShare} variant="secondary" />
      </View>
    </ScrollView>
  );
}

// Plutchik axis -> emoji mapping
const EMOTION_EMOJI: Record<string, string> = {
  ecstasy: '\uD83E\uDD29', joy: '\uD83D\uDE04', serenity: '\uD83D\uDE0C',
  admiration: '\uD83E\uDD70', trust: '\uD83E\uDD1D', acceptance: '\uD83D\uDE42',
  terror: '\uD83D\uDE31', fear: '\uD83D\uDE28', apprehension: '\uD83D\uDE1F',
  amazement: '\uD83E\uDD2F', surprise: '\uD83D\uDE2E', distraction: '\uD83D\uDE11',
  grief: '\uD83D\uDE2D', sadness: '\uD83D\uDE22', pensiveness: '\uD83D\uDE14',
  loathing: '\uD83E\uDD22', disgust: '\uD83D\uDE12', boredom: '\uD83D\uDE34',
  rage: '\uD83E\uDD2C', anger: '\uD83D\uDE21', annoyance: '\uD83D\uDE24',
  vigilance: '\uD83D\uDC40', anticipation: '\uD83D\uDD2E', interest: '\uD83E\uDD14',
};

function getEmotionEmoji(emotion: string): string {
  return EMOTION_EMOJI[emotion.toLowerCase()] ?? '\uD83D\uDE36';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { paddingBottom: 100 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  headerLabel: { ...MOOD_TYPOGRAPHY.labelUpper, color: MOOD_ACCENT, marginBottom: 8 },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  navArrow: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.textSecondary,
    lineHeight: 32,
  },
  headerTitle: { ...MOOD_TYPOGRAPHY.displayLg, color: colors.text, flex: 1 },
  headerSubtitle: { ...MOOD_TYPOGRAPHY.bodyMd, color: colors.textSecondary, lineHeight: 24 },

  // Hero score
  heroCard: { marginHorizontal: 20, marginTop: 16, paddingVertical: 24 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroScoreWrapper: { flex: 1 },
  heroArc: {
    borderLeftWidth: 3,
    borderLeftColor: MOOD_ACCENT,
    borderRadius: 4,
    paddingLeft: 16,
  },
  heroScore: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 56,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 60,
  },
  heroTrend: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    marginTop: 4,
  },
  heroLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginTop: 12,
  },

  // Peak Performance
  peakCard: { marginHorizontal: 20, marginTop: 16, paddingVertical: 20 },
  sectionLabel: { ...MOOD_TYPOGRAPHY.labelUpper, color: colors.textSecondary, marginBottom: 12 },
  peakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  peakInfo: { flex: 1 },
  peakDate: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  scoreBadge: {
    backgroundColor: MOOD_ACCENT,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  scoreBadgeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: '#1a1008',
    fontWeight: '700',
  },
  peakStar: { fontSize: 44, opacity: 0.6 },
  peakDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 12,
  },

  // Section card
  sectionCard: { marginHorizontal: 20, marginTop: 16, paddingVertical: 20 },

  // Emotions
  emotionsList: { gap: 16 },
  emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emotionEmoji: { fontSize: 22 },
  emotionName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  emotionPct: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: MOOD_ACCENT_LIGHT,
  },

  // Correlations
  correlationList: { gap: 12 },
  correlationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  correlationDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correlationDotText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  correlationName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },

  // Bar chart
  fluctHeader: { marginBottom: 16 },
  fluctTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 4,
  },
  fluctSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 8,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: {
    width: '100%',
    height: 90,
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
  },
  barFill: { width: '100%' },
  barLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  barLabelToday: { color: MOOD_ACCENT },

  // Recommendation
  recCard: { marginHorizontal: 20, marginTop: 16, paddingVertical: 24 },
  recTitle: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 32,
    marginBottom: 12,
  },
  recBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },

  // Share
  shareRow: { alignItems: 'center', marginTop: 24, paddingHorizontal: 20 },
});
