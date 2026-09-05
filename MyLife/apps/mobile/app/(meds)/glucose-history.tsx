import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import type { GlucoseReading, GlucoseUnit, MealContext } from '@mylife/meds';
import {
  calculateAverageGlucose,
  calculateTimeInRange,
  convertGlucose,
  estimateA1c,
  getGlucoseReadings,
  getInsulinEntries,
  getSetting,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CARD_RADIUS,
  MD_FONTS,
  MD_GLUCOSE_STATUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

const CONTEXT_BREAKDOWN: Array<{ key: MealContext; label: string }> = [
  { key: 'fasting', label: 'Fasting' },
  { key: 'before_meal', label: 'Pre-meal' },
  { key: 'after_meal', label: 'Post-meal' },
  { key: 'bedtime', label: 'Bedtime' },
] as const;

const STATUS_META = {
  very_low: { label: 'Urgent low', color: '#FF453A' },
  low: { label: 'Low', color: MD_GLUCOSE_STATUS.low },
  in_range: { label: 'In range', color: MD_GLUCOSE_STATUS.normal },
  high: { label: 'High', color: '#FF8A6B' },
  very_high: { label: 'Urgent high', color: '#FF453A' },
} as const;

function formatContextLabel(context: MealContext | null, mealType?: string | null): string {
  if (!context) {
    return 'Unspecified';
  }

  const base = context.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  if (!mealType) {
    return base;
  }

  return `${base} • ${mealType.replace(/\b\w/g, (char) => char.toUpperCase())}`;
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPeriodCutoff(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getDisplayValue(value: number, from: GlucoseUnit, to: GlucoseUnit): string {
  const converted = from === to ? value : convertGlucose(value, from, to);
  return to === 'mg/dL' ? Math.round(converted).toString() : converted.toFixed(1);
}

function groupReadingsByDay(readings: GlucoseReading[]) {
  const groups = new Map<string, GlucoseReading[]>();

  readings.forEach((reading) => {
    const dateKey = reading.measuredAt.slice(0, 10);
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(reading);
    groups.set(dateKey, bucket);
  });

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    items,
  }));
}

function getLinkedInsulinSummary(
  measuredAt: string,
  insulinEntries: Array<{ administeredAt: string; units: number; insulinType: string }>,
) {
  const readingTime = new Date(measuredAt).getTime();
  const linked = insulinEntries.find((entry) => {
    const diff = Math.abs(new Date(entry.administeredAt).getTime() - readingTime);
    return diff <= 90 * 60 * 1000;
  });

  if (!linked) {
    return null;
  }

  return `${linked.units}u ${linked.insulinType.replace(/_/g, ' ')}`;
}

function RangeChart({
  readings,
}: {
  readings: GlucoseReading[];
}) {
  const chartReadings = readings
    .slice()
    .reverse()
    .slice(-18);

  if (chartReadings.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Add a few more readings to unlock the trend chart.</Text>
      </View>
    );
  }

  const values = chartReadings.map((reading) => reading.unit === 'mg/dL'
    ? reading.value
    : convertGlucose(reading.value, reading.unit, 'mg/dL'));
  const width = 320;
  const height = 176;
  const padding = 18;
  const minValue = Math.min(40, ...values) - 10;
  const maxValue = Math.max(260, ...values) + 10;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const xStep = chartWidth / Math.max(1, chartReadings.length - 1);

  const yForValue = (value: number) => {
    const ratio = (value - minValue) / Math.max(1, maxValue - minValue);
    return height - padding - ratio * chartHeight;
  };

  const points = values
    .map((value, index) => `${padding + index * xStep},${yForValue(value)}`)
    .join(' ');

  const rangeTop = yForValue(180);
  const rangeBottom = yForValue(70);

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
      <Rect
        fill={withAlpha(MD_GLUCOSE_STATUS.high, 0.12)}
        height={Math.max(0, rangeTop - padding)}
        rx={18}
        width={chartWidth}
        x={padding}
        y={padding}
      />
      <Rect
        fill={withAlpha(MD_GLUCOSE_STATUS.normal, 0.14)}
        height={Math.max(0, rangeBottom - rangeTop)}
        rx={18}
        width={chartWidth}
        x={padding}
        y={rangeTop}
      />
      <Rect
        fill={withAlpha(MD_GLUCOSE_STATUS.low, 0.14)}
        height={Math.max(0, height - padding - rangeBottom)}
        rx={18}
        width={chartWidth}
        x={padding}
        y={rangeBottom}
      />

      {[70, 120, 180].map((value) => (
        <Line
          key={value}
          stroke={withAlpha(MD_TEXT_SECONDARY, 0.16)}
          strokeDasharray="4 6"
          strokeWidth={1.4}
          x1={padding}
          x2={width - padding}
          y1={yForValue(value)}
          y2={yForValue(value)}
        />
      ))}

      <Polyline
        fill="none"
        points={points}
        stroke={MD_ACCENT_LIGHT}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={3}
      />

      {values.map((value, index) => (
        <Circle
          key={`${chartReadings[index].id}-${index}`}
          cx={padding + index * xStep}
          cy={yForValue(value)}
          fill={STATUS_META[chartReadings[index].rangeStatus].color}
          r={4.5}
        />
      ))}
    </Svg>
  );
}

export default function GlucoseHistoryScreen() {
  const db = useDatabase();
  const [periodDays, setPeriodDays] = useState<number>(14);
  const [refreshToken, setRefreshToken] = useState(0);
  const unit = ((getSetting(db, 'glucoseUnit') as GlucoseUnit | null) ?? 'mg/dL');

  useFocusEffect(
    useCallback(() => {
      setRefreshToken((value) => value + 1);
    }, []),
  );

  const allReadings = useMemo(() => getGlucoseReadings(db), [db, refreshToken]);
  const insulinEntries = useMemo(() => getInsulinEntries(db, { limit: 500 }), [db, refreshToken]);
  const filteredReadings = useMemo(() => {
    const cutoff = getPeriodCutoff(periodDays);
    return allReadings.filter((reading) => reading.measuredAt >= cutoff);
  }, [allReadings, periodDays]);

  const averageMgDl = useMemo(() => calculateAverageGlucose(filteredReadings), [filteredReadings]);
  const timeInRange = useMemo(() => calculateTimeInRange(filteredReadings), [filteredReadings]);
  const estimatedA1c = useMemo(
    () => (filteredReadings.length > 0 ? estimateA1c(averageMgDl) : null),
    [averageMgDl, filteredReadings.length],
  );

  const contextStats = useMemo(() => CONTEXT_BREAKDOWN.map((context) => {
    const matches = filteredReadings.filter((reading) => reading.mealContext === context.key);
    if (matches.length === 0) {
      return { ...context, average: null, count: 0 };
    }

    return {
      ...context,
      average: calculateAverageGlucose(matches),
      count: matches.length,
    };
  }), [filteredReadings]);

  const groupedReadings = useMemo(() => groupReadingsByDay(filteredReadings), [filteredReadings]);
  const latestReading = filteredReadings[0] ?? null;

  if (!allReadings.length) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard intensity={22} padding={22} style={styles.emptyCard}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="bloodtype" size={26} />
          <Text style={styles.emptyTitle}>No glucose readings yet</Text>
          <Text style={styles.emptyBody}>Start logging values to unlock time-in-range, history, and A1c estimates.</Text>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <GlassCard intensity={26} padding={22} style={styles.heroCard}>
        <Text style={styles.eyebrow}>Glucose History</Text>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroValue}>{timeInRange}%</Text>
            <Text style={styles.heroLabel}>Time in Range</Text>
            <Text style={styles.heroBody}>
              {filteredReadings.length} readings over the last {periodDays} days.
            </Text>
          </View>
          <View style={styles.latestChip}>
            <Text style={styles.latestChipLabel}>Latest</Text>
            <Text style={styles.latestChipValue}>
              {latestReading ? getDisplayValue(latestReading.value, latestReading.unit, unit) : '--'} {unit}
            </Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Average glucose</Text>
            <Text style={styles.statValue}>
              {getDisplayValue(averageMgDl, 'mg/dL', unit)} <Text style={styles.statUnit}>{unit}</Text>
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Estimated A1c</Text>
            <Text style={styles.statValue}>
              {estimatedA1c ? estimatedA1c.toFixed(1) : '--'}
              <Text style={styles.statUnit}> %</Text>
            </Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Period" />
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((option) => {
            const active = option.days === periodDays;
            return (
              <Pressable
                key={option.label}
                onPress={() => setPeriodDays(option.days)}
                style={[styles.periodPill, active ? styles.periodPillActive : null]}
              >
                <Text style={[styles.periodText, active ? styles.periodTextActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="CGM-style Profile" />
        <GlassCard intensity={18} padding={18}>
          <RangeChart readings={filteredReadings} />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: withAlpha(MD_GLUCOSE_STATUS.low, 0.7) }]} />
              <Text style={styles.legendText}>Low</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: withAlpha(MD_GLUCOSE_STATUS.normal, 0.7) }]} />
              <Text style={styles.legendText}>Target band</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: withAlpha(MD_GLUCOSE_STATUS.high, 0.7) }]} />
              <Text style={styles.legendText}>High</Text>
            </View>
          </View>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="By Context" />
        <GlassCard intensity={16} padding={18} style={styles.contextCard}>
          {contextStats.map((context) => (
            <View key={context.key} style={styles.contextRow}>
              <View>
                <Text style={styles.contextRowLabel}>{context.label}</Text>
                <Text style={styles.contextRowSub}>{context.count} readings</Text>
              </View>
              <Text style={styles.contextRowValue}>
                {context.average === null ? '--' : getDisplayValue(context.average, 'mg/dL', unit)} {unit}
              </Text>
            </View>
          ))}
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Readings Log" />
        <View style={styles.groupedList}>
          {groupedReadings.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <Text style={styles.dayHeading}>{formatDateLabel(group.date)}</Text>
              {group.items.map((reading) => {
                const linkedInsulin = getLinkedInsulinSummary(reading.measuredAt, insulinEntries);
                return (
                  <GlassCard key={reading.id} intensity={12} padding={16} style={styles.readingCard}>
                    <View style={styles.readingHeader}>
                      <View>
                        <Text style={styles.readingValue}>
                          {getDisplayValue(reading.value, reading.unit, unit)} {unit}
                        </Text>
                        <Text style={styles.readingTime}>{formatTimeLabel(reading.measuredAt)}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusChip,
                          { backgroundColor: withAlpha(STATUS_META[reading.rangeStatus].color, 0.14) },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: STATUS_META[reading.rangeStatus].color },
                          ]}
                        >
                          {STATUS_META[reading.rangeStatus].label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaWrap}>
                      <View style={styles.metaPill}>
                        <MaterialSymbol color={MD_ACCENT_LIGHT} name="assignment" size={14} />
                        <Text style={styles.metaPillText}>
                          {formatContextLabel(reading.mealContext, reading.mealType)}
                        </Text>
                      </View>
                      {linkedInsulin ? (
                        <View style={styles.metaPill}>
                          <MaterialSymbol color={MD_ACCENT_LIGHT} name="vaccines" size={14} />
                          <Text style={styles.metaPillText}>{linkedInsulin}</Text>
                        </View>
                      ) : null}
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.lowest, 0.72),
    borderRadius: 24,
    gap: 18,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 54,
    fontVariant: ['tabular-nums'],
    lineHeight: 58,
  },
  heroLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  latestChip: {
    alignSelf: 'flex-start',
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: MD_CARD_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 110,
  },
  latestChipLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginBottom: 6,
  },
  latestChipValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statTile: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 20,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginBottom: 8,
  },
  statValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  statUnit: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  sectionWrap: {
    gap: 14,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodPill: {
    backgroundColor: withAlpha(MD_TEXT_SECONDARY, 0.08),
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  periodPillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
  },
  periodText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  periodTextActive: {
    color: '#041317',
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  chartEmptyText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  legendText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  contextCard: {
    gap: 14,
  },
  contextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contextRowLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  contextRowSub: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  contextRowValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  groupedList: {
    gap: 16,
  },
  dayGroup: {
    gap: 10,
  },
  dayHeading: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginLeft: 2,
  },
  readingCard: {
    gap: 12,
  },
  readingHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  readingValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  readingTime: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusChipText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaPillText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    gap: 10,
    marginTop: 32,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    textAlign: 'center',
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
