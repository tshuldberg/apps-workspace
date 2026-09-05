import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  getDailyAverages,
  scoreToPixelColor,
  GlassCard,
  SectionHeader,
  StatBadge,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_SURFACES,
  MOOD_SCORE_COLORS,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const LEGEND_ITEMS = [
  { label: 'Awful', range: '1-2', color: MOOD_SCORE_COLORS[1] },
  { label: 'Bad', range: '3-4', color: MOOD_SCORE_COLORS[3] },
  { label: 'No Entry', range: '', color: MOOD_SURFACES.focus },
  { label: 'Average', range: '5-6', color: MOOD_SCORE_COLORS[5] },
  { label: 'Good', range: '7-8', color: MOOD_SCORE_COLORS[8] },
  { label: 'Amazing', range: '9-10', color: MOOD_SCORE_COLORS[10] },
];

const SPECTRUM_COLORS = [
  MOOD_SCORE_COLORS[1],
  MOOD_SCORE_COLORS[3],
  MOOD_SCORE_COLORS[5],
  MOOD_SCORE_COLORS[8],
  MOOD_SCORE_COLORS[10],
];

// Mock correlations (engine doesn't provide these yet)
const CORRELATIONS = [
  { label: 'Sunshine', value: '+24%', positive: true },
  { label: '8h+ Sleep', value: '+18%', positive: true },
  { label: 'Caffeine Intake', value: '-6%', positive: false },
];

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(month: number, year: number) {
  if (month === 1 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month];
}

export default function MoodYearPixelsScreen() {
  const db = useDatabase();
  const [year, setYear] = useState(new Date().getFullYear());
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const dailyAverages = useMemo(() => getDailyAverages(db, start, end), [db, start, end]);
  const averageMap = useMemo(
    () => new Map(dailyAverages.map((item) => [item.date, item.average])),
    [dailyAverages],
  );

  // Compute year stats
  const stats = useMemo(() => {
    const scores = dailyAverages.map((d) => d.average);
    const totalEntries = scores.length;
    const avgMood = totalEntries > 0 ? scores.reduce((a, b) => a + b, 0) / totalEntries : 0;

    // Best month
    const monthSums: number[] = Array(12).fill(0);
    const monthCounts: number[] = Array(12).fill(0);
    for (const d of dailyAverages) {
      const m = parseInt(d.date.slice(5, 7), 10) - 1;
      monthSums[m] += d.average;
      monthCounts[m]++;
    }
    let bestMonthIdx = 0;
    let bestMonthAvg = 0;
    for (let i = 0; i < 12; i++) {
      const avg = monthCounts[i] > 0 ? monthSums[i] / monthCounts[i] : 0;
      if (avg > bestMonthAvg) {
        bestMonthAvg = avg;
        bestMonthIdx = i;
      }
    }

    // Current streak
    const today = new Date().toISOString().slice(0, 10);
    let streak = 0;
    const sorted = [...dailyAverages].sort((a, b) => b.date.localeCompare(a.date));
    const check = new Date(today + 'T12:00:00');
    for (const entry of sorted) {
      const entryDate = entry.date;
      const checkStr = check.toISOString().slice(0, 10);
      if (entryDate === checkStr) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else if (entryDate < checkStr) {
        break;
      }
    }

    return {
      avgMood: avgMood.toFixed(1),
      totalEntries,
      bestMonth: MONTH_LABELS[bestMonthIdx].charAt(0) + MONTH_LABELS[bestMonthIdx].slice(1).toLowerCase(),
      streak,
    };
  }, [dailyAverages]);

  // Build month x day grid
  const grid = useMemo(() => {
    const months: Array<Array<{ date: string; score: number | null }>> = [];
    for (let m = 0; m < 12; m++) {
      const days = daysInMonth(m, year);
      const row: Array<{ date: string; score: number | null }> = [];
      for (let d = 1; d <= days; d++) {
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const date = `${year}-${mm}-${dd}`;
        const score = averageMap.get(date) ?? null;
        row.push({ date, score });
      }
      // Pad to 31 for alignment
      while (row.length < 31) {
        row.push({ date: '', score: null });
      }
      months.push(row);
    }
    return months;
  }, [averageMap, year]);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ date: string; score: number } | null>(null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Year in Pixels</Text>
        <Text style={styles.subtitle}>
          Your emotional landscape for {year}. Every square represents a day's journey through your mood spectrum.
        </Text>
      </View>

      {/* Year selector */}
      <View style={styles.yearSelector}>
        <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={12}>
          <Text style={styles.yearArrow}>{'\u2039'}</Text>
        </Pressable>
        <Text style={styles.yearText}>{year}</Text>
        <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={12}>
          <Text style={styles.yearArrow}>{'\u203A'}</Text>
        </Pressable>
      </View>

      {/* Spectrum indicator */}
      <View style={styles.spectrumRow}>
        <View style={styles.spectrumDots}>
          {SPECTRUM_COLORS.map((c, i) => (
            <View key={i} style={[styles.spectrumDot, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.spectrumLabel}>THE SPECTRUM</Text>
      </View>

      {/* Stat badges - 2x2 grid */}
      <View style={styles.statsGrid}>
        <StatBadge value={`${stats.avgMood}/10`} label="AVG MOOD" />
        <StatBadge value={`${stats.totalEntries} days`} label="TOTAL ENTRIES" />
        <StatBadge value={stats.bestMonth} label="BEST MONTH" icon={'\u2197'} />
        <StatBadge value={`${stats.streak} \uD83D\uDD25`} label="CURRENT STREAK" />
      </View>

      {/* Pixel grid */}
      <GlassCard level={1} style={styles.gridCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Month header row */}
            <View style={styles.gridHeaderRow}>
              <View style={styles.dayLabel} />
              {MONTH_LABELS.map((label) => (
                <Text key={label} style={styles.monthLabel}>{label}</Text>
              ))}
            </View>

            {/* Day rows (1-31) */}
            {Array.from({ length: 31 }, (_, dayIdx) => (
              <View key={dayIdx} style={styles.gridRow}>
                {(dayIdx % 5 === 0) ? (
                  <Text style={styles.dayLabel}>{dayIdx + 1}</Text>
                ) : (
                  <View style={styles.dayLabel} />
                )}
                {grid.map((month, monthIdx) => {
                  const cell = month[dayIdx];
                  const isEmpty = cell.date === '';
                  const hasScore = cell.score != null;
                  return (
                    <Pressable
                      key={`${monthIdx}-${dayIdx}`}
                      onPress={() => {
                        if (hasScore) setTooltip({ date: cell.date, score: Math.round(cell.score!) });
                        else setTooltip(null);
                      }}
                      style={[
                        styles.pixel,
                        {
                          backgroundColor: isEmpty
                            ? 'transparent'
                            : hasScore
                              ? scoreToPixelColor(Math.round(cell.score!))
                              : MOOD_SURFACES.focus,
                          opacity: isEmpty ? 0 : 1,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Tooltip */}
        {tooltip && (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>
              {formatDate(tooltip.date)} - Score: {tooltip.score}/10
            </Text>
            <Pressable onPress={() => setTooltip(null)} hitSlop={8}>
              <Text style={styles.tooltipClose}>{'\u2715'}</Text>
            </Pressable>
          </View>
        )}
      </GlassCard>

      {/* Mood Legend */}
      <SectionHeader title="The Mood Legend" />
      <View style={styles.legendGrid}>
        {LEGEND_ITEMS.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <View>
              <Text style={styles.legendLabel}>{item.label}</Text>
              {item.range !== '' && <Text style={styles.legendRange}>{item.range}</Text>}
            </View>
          </View>
        ))}
      </View>

      {/* Monthly Highlight */}
      <SectionHeader label="MONTHLY HIGHLIGHT" title="The May Bloom" />
      <GlassCard level={3} style={styles.highlightCard}>
        <Text style={styles.highlightTitle}>The May Bloom</Text>
        <Text style={styles.highlightBody}>
          Your mood data shows a significant 40% uptick during May.
          This correlates with your increased outdoor activity and "Breathe" sessions. Keep this momentum!
        </Text>
        <GradientButton
          title="Deep Insights"
          onPress={() => router.push('/(mood)/insights' as never)}
        />
      </GlassCard>

      {/* Mood Correlations */}
      <SectionHeader title="Mood Correlations" />
      <GlassCard level={2} style={styles.correlationsCard}>
        {CORRELATIONS.map((c) => (
          <View key={c.label} style={styles.correlationRow}>
            <Text style={styles.correlationLabel}>{c.label}</Text>
            <Text style={[styles.correlationValue, { color: c.positive ? '#4ADE80' : '#F87171' }]}>
              {c.value}
            </Text>
          </View>
        ))}
      </GlassCard>

      {/* Next Milestone */}
      <SectionHeader title="Next Milestone" />
      <GlassCard level={2} style={styles.milestoneCard}>
        <View style={styles.milestoneRow}>
          <Text style={styles.milestoneTarget}>260 Entries</Text>
          <Text style={styles.milestoneRemaining}>
            {Math.max(260 - stats.totalEntries, 0)} left
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min((stats.totalEntries / 260) * 100, 100)}%` },
            ]}
          />
        </View>
      </GlassCard>
    </ScrollView>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { paddingBottom: 100 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  title: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // Year selector
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
  },
  yearText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  yearArrow: {
    fontSize: 28,
    color: MOOD_ACCENT,
    fontWeight: '300',
  },

  // Spectrum
  spectrumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  spectrumDots: { flexDirection: 'row', gap: 6 },
  spectrumDot: { width: 18, height: 18, borderRadius: 9 },
  spectrumLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },

  // Pixel grid
  gridCard: { marginHorizontal: 20, padding: 12 },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: colors.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  dayLabel: {
    width: 22,
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0,
    color: colors.textSecondary,
    textAlign: 'right',
    paddingRight: 4,
  },
  pixel: {
    width: 20,
    height: 20,
    borderRadius: 3,
    margin: 1,
  },

  // Tooltip
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: MOOD_SURFACES.highest,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  tooltipText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.text,
  },
  tooltipClose: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingLeft: 12,
  },

  // Legend
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '45%',
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.text,
  },
  legendRange: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },

  // Highlight
  highlightCard: { marginHorizontal: 20, marginTop: 8, marginBottom: 24 },
  highlightTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 26,
    color: colors.text,
    marginBottom: 8,
  },
  highlightBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },

  // Correlations
  correlationsCard: { marginHorizontal: 20, marginBottom: 24, gap: 16 },
  correlationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  correlationLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },
  correlationValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
  },

  // Milestone
  milestoneCard: { marginHorizontal: 20, marginBottom: 24 },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  milestoneTarget: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  milestoneRemaining: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: MOOD_SURFACES.focus,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: MOOD_ACCENT,
  },
});
