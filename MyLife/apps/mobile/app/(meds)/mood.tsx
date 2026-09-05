import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import {
  getMoodCorrelations,
  getMoodScore,
  getMoodTrends,
  type MoodActivityCorrelation,
  type MoodMedicationImpact,
  type MoodTrendDay,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_MOOD,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  MoodChip,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PERIODS = [
  { key: '7D', days: 7 },
  { key: '30D', days: 30 },
  { key: '90D', days: 90 },
] as const;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function scoreToColor(score: number | null): string {
  if (score == null || score <= 0) {
    return withAlpha(MD_TEXT_TERTIARY, 0.18);
  }
  if (score >= 9) {
    return MD_MOOD.great;
  }
  if (score >= 7) {
    return MD_MOOD.good;
  }
  if (score >= 5) {
    return MD_MOOD.neutral;
  }
  if (score >= 3) {
    return MD_MOOD.bad;
  }
  return MD_MOOD.terrible;
}

function buildDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}

function buildHeatmapSeries(daily: MoodTrendDay[], days: number) {
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const series: Array<{ date: string; score: number | null }> = [];
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const date = current.toISOString().slice(0, 10);
    const value = byDate.get(date);
    series.push({
      date,
      score: value?.averageScore ?? null,
    });
    current.setDate(current.getDate() + 1);
  }

  return series;
}

function formatChange(current: number, previous: number): string {
  const delta = current - previous;
  if (Math.abs(delta) < 0.1) {
    return 'Flat vs last period';
  }

  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs last period`;
}

function Heatmap({ days }: { days: Array<{ date: string; score: number | null }> }) {
  const cellSize = 16;
  const gap = 4;
  const columns = Math.ceil(days.length / 7);
  const width = columns * (cellSize + gap);
  const height = 7 * (cellSize + gap);

  return (
    <View style={styles.chartBlock}>
      <Svg height={height} width={width}>
        {days.map((day, index) => {
          const column = Math.floor(index / 7);
          const row = index % 7;
          return (
            <Rect
              key={day.date}
              fill={scoreToColor(day.score)}
              height={cellSize}
              rx={4}
              width={cellSize}
              x={column * (cellSize + gap)}
              y={row * (cellSize + gap)}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function DayOfWeekBars({
  values,
}: {
  values: Array<{ label: string; score: number; entryCount: number }>;
}) {
  const width = 312;
  const height = 156;
  const maxScore = Math.max(...values.map((value) => value.score), 10);
  const barWidth = 28;
  const gap = 16;

  return (
    <View style={styles.chartBlock}>
      <Svg height={height} width={width}>
        {values.map((value, index) => {
          const x = 8 + index * (barWidth + gap);
          const barHeight = value.entryCount === 0 ? 10 : Math.max(18, (value.score / maxScore) * 96);
          const y = 110 - barHeight;
          return (
            <G key={value.label}>
              <Rect
                fill={value.entryCount === 0 ? withAlpha(MD_TEXT_TERTIARY, 0.16) : MD_ACCENT}
                height={barHeight}
                rx={10}
                width={barWidth}
                x={x}
                y={y}
              />
              <SvgText
                fill={MD_TEXT_SECONDARY}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                x={x + barWidth / 2}
                y={126}
              >
                {value.label}
              </SvgText>
              <SvgText
                fill={MD_TEXT}
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                x={x + barWidth / 2}
                y={y - 8}
              >
                {value.entryCount === 0 ? '-' : value.score.toFixed(1)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function CorrelationRow({
  item,
}: {
  item: MoodActivityCorrelation;
}) {
  const color =
    item.direction === 'positive' ? MD_MOOD.good :
    item.direction === 'negative' ? MD_MOOD.bad :
    MD_TEXT_TERTIARY;

  return (
    <View style={styles.correlationRow}>
      <View style={[styles.correlationDot, { backgroundColor: color }]} />
      <View style={styles.correlationCopy}>
        <Text style={styles.correlationTitle}>{item.activity}</Text>
        <Text style={styles.correlationMeta}>
          Avg {item.averageScore.toFixed(1)}/10 across {item.sampleSize} entries
        </Text>
      </View>
      <Text style={[styles.correlationBadge, { color }]}>
        {item.direction === 'positive' ? 'Positive' : item.direction === 'negative' ? 'Negative' : 'Neutral'}
      </Text>
    </View>
  );
}

function MedicationImpactRow({
  item,
}: {
  item: MoodMedicationImpact;
}) {
  const changePercent = item.changePercent ?? 0;
  const color =
    item.direction === 'improved' ? MD_MOOD.good :
    item.direction === 'declined' ? MD_MOOD.terrible :
    MD_TEXT_TERTIARY;

  return (
    <View style={styles.medicationImpactRow}>
      <View style={styles.medicationImpactCopy}>
        <Text style={styles.correlationTitle}>{item.medicationName}</Text>
        <Text style={styles.correlationMeta}>
          Before {item.beforeAverage?.toFixed(1) ?? '--'} • After {item.afterAverage?.toFixed(1) ?? '--'}
        </Text>
      </View>
      <Text style={[styles.correlationBadge, { color }]}>
        {changePercent > 0 ? '+' : ''}
        {changePercent.toFixed(0)}%
      </Text>
    </View>
  );
}

export default function MoodScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState(30);
  const [refreshTick, setRefreshTick] = useState(0);

  useFocusEffect(useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []));

  const data = useMemo(() => {
    const range = buildDateRange(periodDays);
    try {
      const current = getMoodTrends(db, range.start, range.end);
      const previous = getMoodTrends(db, range.previousStart, range.previousEnd);
      const correlations = getMoodCorrelations(db, range.start, range.end);
      return {
        current,
        previous,
        correlations,
        error: null as string | null,
      };
    } catch {
      return {
        current: null,
        previous: null,
        correlations: null,
        error: 'Mood trends could not be loaded.',
      };
    }
  }, [db, periodDays, refreshTick]);

  if (!data.current || !data.correlations) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Insights & Analytics</Text>
          <Text style={styles.title}>Mood Trends</Text>
        </View>
        <GlassCard padding={20}>
          <Text style={styles.emptyTitle}>{data.error ?? 'No mood data yet'}</Text>
          <Text style={styles.emptyBody}>
            Create a check-in first so MyMeds can turn daily feelings into patterns, correlations, and medication context.
          </Text>
          <Pressable onPress={() => router.push('/(meds)/mood-check-in' as never)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>Start Check-In</Text>
          </Pressable>
        </GlassCard>
      </ScrollView>
    );
  }

  const heatmapDays = buildHeatmapSeries(data.current.daily, periodDays);
  const averageChange = data.previous && data.previous.totalEntries > 0
    ? formatChange(data.current.averageScore, data.previous.averageScore)
    : 'First tracked period';

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Insights & Analytics</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Mood Trends</Text>
            <Text style={styles.subtitle}>
              Track emotional patterns, contributing activities, and medication impact over time.
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(meds)/mood-check-in' as never)} style={styles.iconButton}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} filled name="add" size={22} />
          </Pressable>
        </View>
      </View>

      <GlassCard padding={22} style={styles.summaryCard}>
        <Text style={styles.cardEyebrow}>Average Mood</Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryValue}>{data.current.averageScore.toFixed(1)}</Text>
            <Text style={styles.summaryDenominator}>/ 10</Text>
          </View>
          <Text style={styles.summaryChange}>{averageChange}</Text>
        </View>
        <Text style={styles.summaryMeta}>
          {data.current.totalEntries} entries in the current period
        </Text>
      </GlassCard>

      <View style={styles.periodRow}>
        {PERIODS.map((period) => {
          const active = period.days === periodDays;
          return (
            <Pressable
              key={period.key}
              onPress={() => setPeriodDays(period.days)}
              style={[
                styles.periodChip,
                active ? styles.periodChipActive : null,
              ]}
            >
              <Text style={[styles.periodLabel, { color: active ? MD_SURFACES.lowest : MD_TEXT_SECONDARY }]}>
                {period.key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>{periodDays} days</Text>}
          title="Mood Calendar Heatmap"
        />
        <Text style={styles.helperText}>
          Each square reflects the average mood score for that day.
        </Text>
        <Heatmap days={heatmapDays} />
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Average</Text>}
          title="Average Mood by Day"
        />
        <DayOfWeekBars
          values={data.current.dayOfWeek.map((item) => ({
            label: WEEKDAY_LABELS[item.dayIndex],
            score: item.averageScore,
            entryCount: item.entryCount,
          }))}
        />
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Top Contributors</Text>}
          title="Activity Correlation"
        />
        <Text style={styles.helperText}>
          These are the activities most often associated with better or worse mood scores.
        </Text>
        <View style={styles.listGap}>
          {data.correlations.activities.length > 0 ? (
            data.correlations.activities.slice(0, 4).map((item) => (
              <CorrelationRow item={item} key={item.activity} />
            ))
          ) : (
            <Text style={styles.emptyBody}>
              Add activities during check-ins to unlock contributor correlations.
            </Text>
          )}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Medication Impact</Text>}
          title="Medication Impact"
        />
        <View style={styles.listGap}>
          {data.correlations.medications.length > 0 ? (
            data.correlations.medications.slice(0, 3).map((item) => (
              <MedicationImpactRow item={item} key={item.medicationId} />
            ))
          ) : (
            <Text style={styles.emptyBody}>
              MyMeds needs a longer overlap between medication timelines and mood entries before it can score impact.
            </Text>
          )}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Recent</Text>}
          title="Entries"
        />
        <View style={styles.listGap}>
          {data.current.recentEntries.length > 0 ? (
            data.current.recentEntries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryHeader}>
                  <MoodChip mood={entry.mood} />
                  <Text style={styles.entryScore}>{getMoodScore(entry).toFixed(0)}/10</Text>
                </View>
                <Text style={styles.entryMeta}>
                  {new Date(entry.recordedAt).toLocaleString()} • {entry.energyLevel} energy
                </Text>
                {entry.notes ? (
                  <Text style={styles.entryNotes}>{entry.notes}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyBody}>
              No mood entries are available in the selected period.
            </Text>
          )}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 8,
    paddingTop: 4,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  title: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 38,
    lineHeight: 42,
  },
  subtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.14),
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  summaryCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
  },
  cardEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  summaryRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  summaryValue: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 46,
    lineHeight: 48,
  },
  summaryDenominator: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT_SECONDARY,
    marginTop: -4,
  },
  summaryChange: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_ACCENT_LIGHT,
    marginBottom: 10,
    textAlign: 'right',
  },
  summaryMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 10,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  periodChipActive: {
    backgroundColor: MD_ACCENT,
  },
  periodLabel: {
    ...MD_TYPOGRAPHY.titleMd,
  },
  sectionMeta: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  helperText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 10,
  },
  chartBlock: {
    alignItems: 'center',
    marginTop: 18,
  },
  listGap: {
    gap: 12,
    marginTop: 18,
  },
  correlationRow: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  medicationImpactRow: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.08),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  correlationDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  correlationCopy: {
    flex: 1,
    gap: 4,
  },
  medicationImpactCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  correlationTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  correlationMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  correlationBadge: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  entryRow: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  entryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entryScore: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_ACCENT_LIGHT,
  },
  entryMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 18,
  },
  entryNotes: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 999,
    marginTop: 18,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_SURFACES.lowest,
  },
});
