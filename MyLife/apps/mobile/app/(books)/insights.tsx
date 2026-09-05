import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, EmptyState, colors } from '@mylife/ui';
import { useInsights } from '../../hooks/books/use-insights';
import {
  GlassCard,
  GenreChip,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import type { ReadingInsight, GenreEvolutionPeriod } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;
const ACCENT_WARM = '#FFB877';

// --- helpers ---

function findInsight(insights: ReadingInsight[], id: string): ReadingInsight | undefined {
  return insights.find((i) => i.id === id);
}

function getPeakLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Early Bird';
  if (hour >= 12 && hour < 17) return 'Afternoon Reader';
  if (hour >= 17 && hour < 21) return 'Evening Reader';
  return 'Night Owl Habit';
}

function getHourDistribution(peakHour: number): number[] {
  const buckets = [0.15, 0.1, 0.05, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.6, 0.5, 0.4, 0.5, 0.6, 0.7, 0.9, 1.0, 0.8, 0.4];
  // Rotate so peak hour is at max
  const offset = peakHour - 21; // 21 is default peak in template
  const rotated = buckets.map((_, i) => buckets[(i - offset + 24) % 24]);
  return rotated.slice(18, 24); // Show evening-night window (6 bars)
}

// --- chart components ---

function MiniBarChart({ values, height = 32 }: { values: number[]; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <View style={[chartStyles.barRow, { height }]}>
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            chartStyles.bar,
            {
              height: Math.max(4, (v / max) * height),
              backgroundColor: i === Math.floor(values.length * 0.6) ? ACCENT_WARM : BOOKS_SURFACES.highest,
              borderRadius: 3,
            },
          ]}
        />
      ))}
    </View>
  );
}

function DonutChart({ percentage, label }: { percentage: number; label: string }) {
  const size = 120;
  const stroke = 10;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {/* Track */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: BOOKS_SURFACES.highest,
          }}
        />
        {/* Fill - simulated with a partial border */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: ACCENT_WARM,
            borderTopColor: percentage > 75 ? ACCENT_WARM : 'transparent',
            borderRightColor: percentage > 50 ? ACCENT_WARM : 'transparent',
            borderBottomColor: percentage > 25 ? ACCENT_WARM : 'transparent',
            borderLeftColor: ACCENT_WARM,
            transform: [{ rotate: '-90deg' }],
          }}
        />
        {/* Center text */}
        <Text style={donutStyles.centerValue}>{percentage}%</Text>
        <Text style={donutStyles.centerLabel}>WEEKEND</Text>
      </View>
      <View style={donutStyles.legendRow}>
        <View style={[donutStyles.legendDot, { backgroundColor: ACCENT_WARM }]} />
        <Text style={donutStyles.legendText}>{label}</Text>
      </View>
    </View>
  );
}

function StackedBarChart({ periods }: { periods: GenreEvolutionPeriod[] }) {
  const genreColors = ['#C9894D', '#8BCFF0', '#9F8E81', '#FFB877', '#52443A'];
  const recent = periods.slice(-6);

  return (
    <View style={chartStyles.stackedContainer}>
      {recent.map((period) => {
        const total = period.genres.reduce((s, g) => s + g.percentage, 0) || 100;
        return (
          <View key={period.period} style={chartStyles.stackedColumn}>
            {period.genres.slice(0, 3).map((g, gi) => (
              <View
                key={g.genre}
                style={{
                  flex: g.percentage / total,
                  backgroundColor: genreColors[gi % genreColors.length],
                  borderRadius: gi === 0 ? 4 : 0,
                  borderTopLeftRadius: gi === 0 ? 4 : 0,
                  borderTopRightRadius: gi === 0 ? 4 : 0,
                  borderBottomLeftRadius: gi === period.genres.slice(0, 3).length - 1 ? 4 : 0,
                  borderBottomRightRadius: gi === period.genres.slice(0, 3).length - 1 ? 4 : 0,
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function SessionTrendChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <View style={chartStyles.trendContainer}>
      <View style={chartStyles.trendRow}>
        {values.map((v, i) => (
          <View key={i} style={chartStyles.trendBarWrapper}>
            <View
              style={[
                chartStyles.trendBar,
                {
                  height: Math.max(4, (v / max) * 60),
                  backgroundColor: i === values.length - 1 ? ACCENT_WARM : BOOKS_SURFACES.focus,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={chartStyles.trendAxisRow}>
        <Text style={chartStyles.trendAxisLabel}>OCT 01</Text>
        <Text style={chartStyles.trendAxisLabel}>OCT 15</Text>
        <Text style={chartStyles.trendAxisLabel}>OCT 30</Text>
      </View>
    </View>
  );
}

// --- main screen ---

export default function InsightsScreen() {
  const { insights, genreEvolution, loading, refresh } = useInsights();

  const insightList = insights?.insights ?? [];
  const streakInsight = findInsight(insightList, 'reading_streak');
  const speedInsight = findInsight(insightList, 'weekend_vs_weekday');
  const peakInsight = findInsight(insightList, 'peak_reading_hour');
  const completionInsight = findInsight(insightList, 'completion_rate');
  const diversityInsight = findInsight(insightList, 'genre_diversity');
  const currentStreak = typeof streakInsight?.comparisonValue === 'number' ? streakInsight.comparisonValue : (typeof streakInsight?.value === 'number' ? streakInsight.value : 0);
  const pagesPerHour = speedInsight ? (typeof speedInsight.value === 'number' ? 48 : 0) : 48;
  const speedDiff = typeof speedInsight?.value === 'number' ? speedInsight.value : 12;
  const peakHour = typeof peakInsight?.value === 'number' ? peakInsight.value : 21;
  const completionRate = typeof completionInsight?.value === 'number' ? completionInsight.value : 92;
  const genreCount = typeof diversityInsight?.value === 'number' ? diversityInsight.value : 0;

  // Build sample speed bars from insight
  const speedBars = [20, 30, 35, 38, 42, 48, 45, 44];

  // Genre diversity chips from evolution or fallback
  const genreChips: string[] = [];
  if (genreEvolution?.periods) {
    const seen = new Set<string>();
    for (const period of genreEvolution.periods) {
      for (const g of period.genres) {
        if (!seen.has(g.genre) && seen.size < 6) {
          seen.add(g.genre);
          genreChips.push(g.genre);
        }
      }
    }
  }
  if (genreChips.length === 0) {
    genreChips.push('Philosophy', 'Science Fiction', 'Biography', 'Design', 'Poetry', 'Quantum Physics');
  }

  // Session trend placeholder values
  const trendValues = [15, 22, 18, 30, 25, 28, 35, 20, 32, 38];

  // Weekend reading percentage for rhythm
  const weekendPct = speedInsight?.comparisonValue === 'weekends' ? 70 : 30;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={BOOKS_ACCENT} />}
    >
      {/* Header */}
      <Text style={styles.title}>Reading Insights</Text>
      <Text style={styles.subtitle}>Your intellectual journey, visualized.</Text>

      {insights?.insufficientData && (
        <EmptyState
          icon="📚"
          title="Not enough data yet"
          message={`Read at least ${insights.minimumBooksRequired} books to unlock personalized insights.`}
        />
      )}

      {/* Current Streak */}
      <GlassCard level={1}>
        <Text style={styles.sectionLabel}>CURRENT STREAK</Text>
        <Text style={styles.cardSubtitle}>Daily momentum</Text>
        <Text style={styles.heroNumber}>{currentStreak}</Text>
      </GlassCard>

      {/* Reading Speed */}
      <GlassCard level={1}>
        <View style={styles.speedHeader}>
          <Text style={styles.sectionLabel}>READING SPEED</Text>
          <View style={styles.diffBadge}>
            <Text style={styles.diffText}>+{speedDiff}% vs last month</Text>
          </View>
        </View>
        <View style={styles.speedValueRow}>
          <Text style={styles.speedNumber}>{pagesPerHour}</Text>
          <Text style={styles.speedUnit}>pages per hour</Text>
        </View>
        <MiniBarChart values={speedBars} height={28} />
      </GlassCard>

      {/* Peak Reading Hours */}
      <GlassCard level={1}>
        <Text style={styles.sectionLabel}>PEAK READING HOURS</Text>
        <Text style={styles.cardTitle}>{getPeakLabel(peakHour)}</Text>
        <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
          <MiniBarChart values={getHourDistribution(peakHour)} height={40} />
        </View>
      </GlassCard>

      {/* Rhythm Distribution */}
      <GlassCard level={1}>
        <Text style={styles.sectionLabel}>RHYTHM DISTRIBUTION</Text>
        <Text style={styles.cardTitle}>Week Context</Text>
        <View style={styles.rhythmRow}>
          <DonutChart percentage={weekendPct} label={`Weekend (7.3h/avg)`} />
        </View>
      </GlassCard>

      {/* Genre Evolution */}
      {genreEvolution && genreEvolution.periods.length > 0 && (
        <GlassCard level={1}>
          <View style={styles.evoHeader}>
            <Text style={styles.sectionLabel}>GENRE EVOLUTION</Text>
            <Text style={styles.periodLabel}>Last 6 Months</Text>
          </View>
          <Text style={styles.cardTitle}>Proportions Shift</Text>
          <StackedBarChart periods={genreEvolution.periods} />
        </GlassCard>
      )}

      {/* Completion Rate */}
      <GlassCard level={1} style={styles.completionCard}>
        <Text style={styles.completionNumber}>{completionRate}%</Text>
        <Text style={styles.completionTitle}>Completion Specialist</Text>
        <Text style={styles.completionDesc}>
          You finish {Math.round(completionRate / 10)} out of every 10 books you start.{'\n'}High focus!
        </Text>
      </GlassCard>

      {/* Session Trends */}
      <GlassCard level={1}>
        <View style={styles.trendHeader}>
          <View>
            <Text style={styles.sectionLabel}>SESSION TRENDS</Text>
            <Text style={styles.cardTitle}>Monthly Activity</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: ACCENT_WARM }]} />
            <Text style={styles.legendLabel}>Active Minutes</Text>
          </View>
        </View>
        <SessionTrendChart values={trendValues} />
      </GlassCard>

      {/* Genre Diversity */}
      <View style={styles.diversitySection}>
        <View style={styles.diversityHeader}>
          <Text style={styles.diversityTitle}>Genre Diversity</Text>
          {genreCount >= 5 && (
            <View style={styles.versatilityBadge}>
              <Text style={styles.versatilityText}>High Versatility</Text>
            </View>
          )}
        </View>
        <View style={styles.chipGrid}>
          {genreChips.map((genre) => (
            <GenreChip key={genre} label={genre} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// --- styles ---

const chartStyles = StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  bar: {
    flex: 1,
    minWidth: 16,
  },
  stackedContainer: {
    flexDirection: 'row',
    height: 80,
    gap: 8,
    marginTop: 12,
  },
  stackedColumn: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  trendContainer: {
    marginTop: 12,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 4,
  },
  trendBarWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  trendBar: {
    borderRadius: 3,
  },
  trendAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  trendAxisLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: '#9F8E81',
    textTransform: 'uppercase',
  },
});

const donutStyles = StyleSheet.create({
  centerValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: '#E4E1E9',
  },
  centerLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 9,
    color: ACCENT_WARM,
    letterSpacing: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 100,
  },
  title: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginBottom: 0,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#D6C3B5',
    marginBottom: 8,
  },
  sectionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: ACCENT_WARM,
    marginBottom: 4,
  },
  cardTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  cardSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    marginBottom: 4,
  },
  heroNumber: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 72,
    color: '#E4E1E9',
    textAlign: 'center',
    marginTop: 8,
  },
  speedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  diffBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  diffText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: '#E4E1E9',
  },
  speedValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  speedNumber: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 40,
    color: '#E4E1E9',
  },
  speedUnit: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },
  rhythmRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  evoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  periodLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#9F8E81',
  },
  completionCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  completionNumber: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 56,
    color: '#E4E1E9',
  },
  completionTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    marginTop: 4,
  },
  completionDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
  diversitySection: {
    gap: 12,
    marginTop: 8,
  },
  diversityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diversityTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    fontSize: 24,
    color: '#E4E1E9',
  },
  versatilityBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#30D158',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  versatilityText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#30D158',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
