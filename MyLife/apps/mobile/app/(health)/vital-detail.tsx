import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors } from '@mylife/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getVitalsByType,
  getVitalAggregates,
  getLatestVital,
  type Vital,
  type VitalType,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

// ─── Vital type metadata ────────────────────────────────────────────────────

interface VitalMeta {
  label: string;
  unit: string;
  icon: string;
  normalRange: { low: number; high: number };
  rangeLabel: string;
  rangeDescription: string;
  formatValue: (v: Vital) => string;
}

const VITAL_META: Record<string, VitalMeta> = {
  heart_rate: {
    label: 'Heart Rate',
    unit: 'BPM',
    icon: '\u{2764}\uFE0F',
    normalRange: { low: 60, high: 100 },
    rangeLabel: '60-100 BPM',
    rangeDescription:
      'For your age and fitness level, a resting heart rate between 60-100 BPM is typical. Lower values often indicate better cardiovascular fitness.',
    formatValue: (v) => `${Math.round(v.value)}`,
  },
  resting_heart_rate: {
    label: 'Resting Heart Rate',
    unit: 'BPM',
    icon: '\u{1F49C}',
    normalRange: { low: 60, high: 100 },
    rangeLabel: '60-100 BPM',
    rangeDescription:
      'A resting heart rate between 60-100 BPM is considered normal for adults. Athletes may have resting rates below 60.',
    formatValue: (v) => `${Math.round(v.value)}`,
  },
  hrv: {
    label: 'Heart Rate Variability',
    unit: 'ms',
    icon: '\u{1F4C8}',
    normalRange: { low: 20, high: 100 },
    rangeLabel: '20-100 ms',
    rangeDescription:
      'Higher HRV generally indicates better cardiovascular fitness and stress resilience. Values vary significantly by age.',
    formatValue: (v) => `${Math.round(v.value)}`,
  },
  blood_oxygen: {
    label: 'Blood Oxygen',
    unit: '%',
    icon: '\u{1FA78}',
    normalRange: { low: 95, high: 100 },
    rangeLabel: '95-100%',
    rangeDescription:
      'Normal blood oxygen saturation is between 95-100%. Values below 90% may require medical attention.',
    formatValue: (v) => `${Math.round(v.value)}`,
  },
  blood_pressure: {
    label: 'Blood Pressure',
    unit: 'mmHg',
    icon: '\u{1FA7A}',
    normalRange: { low: 90, high: 120 },
    rangeLabel: '< 120/80 mmHg',
    rangeDescription:
      'Optimal blood pressure is below 120/80 mmHg. Elevated readings above 130/80 may indicate hypertension.',
    formatValue: (v) =>
      `${Math.round(v.value)}/${Math.round(v.value_secondary ?? 0)}`,
  },
  body_temperature: {
    label: 'Temperature',
    unit: '\u00B0F',
    icon: '\u{1F321}\uFE0F',
    normalRange: { low: 97, high: 99 },
    rangeLabel: '97-99\u00B0F',
    rangeDescription:
      'Normal body temperature ranges from 97 to 99\u00B0F (36.1 to 37.2\u00B0C). Slight variations are normal throughout the day.',
    formatValue: (v) => `${v.value.toFixed(1)}`,
  },
  respiratory_rate: {
    label: 'Respiratory Rate',
    unit: 'breaths/min',
    icon: '\u{1F32C}\uFE0F',
    normalRange: { low: 12, high: 20 },
    rangeLabel: '12-20 breaths/min',
    rangeDescription:
      'A normal respiratory rate for adults at rest is 12 to 20 breaths per minute.',
    formatValue: (v) => `${Math.round(v.value)}`,
  },
  steps: {
    label: 'Steps',
    unit: 'steps',
    icon: '\u{1F6B6}',
    normalRange: { low: 7000, high: 10000 },
    rangeLabel: '7,000-10,000',
    rangeDescription:
      'The CDC recommends at least 7,000-10,000 steps per day for general health benefits.',
    formatValue: (v) => Math.round(v.value).toLocaleString(),
  },
  active_energy: {
    label: 'Active Energy',
    unit: 'kcal',
    icon: '\u{1F525}',
    normalRange: { low: 200, high: 600 },
    rangeLabel: '200-600 kcal',
    rangeDescription:
      'Active energy expenditure varies widely. Aim for at least 150-300 active calories daily for baseline fitness.',
    formatValue: (v) => `${Math.round(v.value)}`,
  },
  vo2_max: {
    label: 'VO2 Max',
    unit: 'mL/kg/min',
    icon: '\u{1F3C3}',
    normalRange: { low: 30, high: 60 },
    rangeLabel: '30-60 mL/kg/min',
    rangeDescription:
      'VO2 Max measures aerobic capacity. Higher values indicate better cardiovascular fitness. Values vary by age and sex.',
    formatValue: (v) => `${v.value.toFixed(1)}`,
  },
};

const TIME_RANGES = ['1W', '1M', '3M', 'ALL'] as const;
type TimeRange = (typeof TIME_RANGES)[number];

function getTimeRangeDays(range: TimeRange): number {
  switch (range) {
    case '1W': return 7;
    case '1M': return 30;
    case '3M': return 90;
    case 'ALL': return 365;
  }
}

function getStatus(
  value: number,
  meta: VitalMeta,
): { label: string; color: string } {
  if (value < meta.normalRange.low) return { label: 'LOW', color: '#FBBF24' };
  if (value > meta.normalRange.high) return { label: 'HIGH', color: HEALTH_ACCENT };
  return { label: 'NORMAL', color: '#34D399' };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

// ─── Simple SVG-less line chart ─────────────────────────────────────────────

function MiniLineChart({
  data,
  normalLow,
  normalHigh,
}: {
  data: number[];
  normalLow: number;
  normalHigh: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data, normalLow) * 0.95;
  const max = Math.max(...data, normalHigh) * 1.05;
  const range = max - min || 1;
  const chartHeight = 120;

  const normalLowPct = ((normalLow - min) / range) * chartHeight;
  const normalHighPct = ((normalHigh - min) / range) * chartHeight;

  return (
    <View style={chartStyles.container}>
      {/* Normal range band */}
      <View
        style={[
          chartStyles.normalBand,
          {
            bottom: normalLowPct,
            height: normalHighPct - normalLowPct,
          },
        ]}
      />

      {/* Data points and connecting lines */}
      <View style={chartStyles.pointsRow}>
        {data.map((val, i) => {
          const pct = ((val - min) / range) * chartHeight;
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={chartStyles.pointCol}>
              <View style={{ height: chartHeight - pct }} />
              <View
                style={[
                  chartStyles.dot,
                  isLast && chartStyles.dotActive,
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Range labels */}
      <View style={chartStyles.rangeLabels}>
        <Text style={chartStyles.rangeValue}>{normalHigh}</Text>
        <Text style={chartStyles.rangeValue}>{normalLow}</Text>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    height: 140,
    marginTop: 8,
    position: 'relative',
  },
  normalBand: {
    position: 'absolute',
    left: 0,
    right: 40,
    backgroundColor: `${HEALTH_ACCENT}08`,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: `${HEALTH_ACCENT}30`,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingRight: 40,
  },
  pointCol: {
    flex: 1,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HEALTH_ACCENT_LIGHT,
    opacity: 0.5,
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: HEALTH_ACCENT,
    opacity: 1,
  },
  rangeLabels: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 20,
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  rangeValue: {
    fontSize: 10,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function VitalDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const vitalType = (params.type ?? 'heart_rate') as VitalType;

  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  const meta = VITAL_META[vitalType] ?? VITAL_META.heart_rate;

  const latest = useMemo(() => {
    try {
      return getLatestVital(db, vitalType);
    } catch {
      return null;
    }
  }, [db, vitalType]);

  const days = getTimeRangeDays(timeRange);

  const readings = useMemo(() => {
    try {
      return getVitalsByType(db, vitalType, 50);
    } catch {
      return [];
    }
  }, [db, vitalType]);

  const aggregates = useMemo(() => {
    try {
      return getVitalAggregates(db, vitalType, days);
    } catch {
      return [];
    }
  }, [db, vitalType, days]);

  const chartData = useMemo(() => {
    if (aggregates.length > 0) return aggregates.map((a) => a.avg);
    return readings
      .slice(0, 20)
      .reverse()
      .map((r) => r.value);
  }, [aggregates, readings]);

  const status = latest ? getStatus(latest.value, meta) : null;

  // Date range label
  const dateRangeLabel = useMemo(() => {
    if (aggregates.length === 0) return '';
    const first = aggregates[0]?.date ?? '';
    const last = aggregates[aggregates.length - 1]?.date ?? '';
    return `${first.slice(5)} - ${last.slice(5)}`;
  }, [aggregates]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Value */}
      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>CURRENT READING</Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroValue}>
            {latest ? meta.formatValue(latest) : '--'}
          </Text>
          <Text style={styles.heroUnit}>{meta.unit}</Text>
        </View>

        {status && (
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        )}

        {latest && (
          <Text style={styles.lastUpdated}>
            Last updated: {timeAgo(latest.recorded_at)}
          </Text>
        )}
      </View>

      {/* Time Range Selector */}
      <GlassCard level={3} style={styles.rangeCard}>
        <View style={styles.rangePills}>
          {TIME_RANGES.map((r) => (
            <Pressable
              key={r}
              style={[styles.rangePill, timeRange === r && styles.rangePillActive]}
              onPress={() => setTimeRange(r)}
            >
              <Text
                style={[
                  styles.rangePillText,
                  timeRange === r && styles.rangePillTextActive,
                ]}
              >
                {r}
              </Text>
            </Pressable>
          ))}
        </View>
        {dateRangeLabel !== '' && (
          <Text style={styles.dateRangeText}>{dateRangeLabel}</Text>
        )}
      </GlassCard>

      {/* Chart */}
      {chartData.length >= 2 && (
        <GlassCard level={2} style={styles.chartCard}>
          <MiniLineChart
            data={chartData}
            normalLow={meta.normalRange.low}
            normalHigh={meta.normalRange.high}
          />
        </GlassCard>
      )}

      {/* Healthy Range Info */}
      <GlassCard level={2} style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.infoIcon}>{'\u{2139}\uFE0F'}</Text>
          <Text style={styles.infoTitle}>Healthy Range</Text>
        </View>
        <Text style={styles.infoBody}>{meta.rangeDescription}</Text>
        <View style={styles.rangeBadge}>
          <Text style={styles.rangeBadgeText}>{meta.rangeLabel}</Text>
        </View>
      </GlassCard>

      {/* Recent Readings */}
      <SectionHeader
        label="RECENT READINGS"
        title=""
        action={
          readings.length > 5
            ? { text: 'View All', onPress: () => {} }
            : undefined
        }
      />

      {readings.length > 0 ? (
        readings.slice(0, 8).map((reading) => {
          const readingStatus = getStatus(reading.value, meta);
          return (
            <GlassCard key={reading.id} level={2} style={styles.readingRow}>
              <View style={styles.readingLeft}>
                <Text style={styles.readingIcon}>{meta.icon}</Text>
                <View style={styles.readingInfo}>
                  <View style={styles.readingValueRow}>
                    <Text style={styles.readingValue}>
                      {meta.formatValue(reading)} {meta.unit}
                    </Text>
                    <View
                      style={[
                        styles.readingBadge,
                        { backgroundColor: `${readingStatus.color}18` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.readingBadgeText,
                          { color: readingStatus.color },
                        ]}
                      >
                        {readingStatus.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.readingDate}>
                    {formatDate(reading.recorded_at)}
                    {reading.source !== 'manual' ? ` \u00B7 ${reading.source.replace('_', ' ')}` : ''}
                  </Text>
                </View>
              </View>
            </GlassCard>
          );
        })
      ) : (
        <GlassCard level={2} style={styles.emptyCard}>
          <Text style={styles.emptyText}>No readings recorded yet</Text>
          <Text style={styles.emptySubtext}>
            Log a measurement to start tracking
          </Text>
        </GlassCard>
      )}

      {/* Log New Button */}
      <View style={styles.ctaWrapper}>
        <GradientButton
          title={`Log ${meta.label}`}
          onPress={() =>
            router.push(
              `/(health)/measurement-log?type=${vitalType}` as never,
            )
          }
        />
      </View>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  heroLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: colors.textTertiary,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroValue: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 52,
    letterSpacing: -2,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 18,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Time range
  rangeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  rangePills: {
    flexDirection: 'row',
    gap: 8,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: HEALTH_SURFACES.highest,
  },
  rangePillActive: {
    backgroundColor: `${HEALTH_ACCENT}20`,
  },
  rangePillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.1 * 12,
    color: colors.textTertiary,
  },
  rangePillTextActive: {
    color: HEALTH_ACCENT_LIGHT,
  },
  dateRangeText: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Chart
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },

  // Info card
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  infoBody: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  rangeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${HEALTH_ACCENT}15`,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rangeBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.1 * 12,
    color: HEALTH_ACCENT_LIGHT,
  },

  // Readings
  readingRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
  },
  readingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readingIcon: {
    fontSize: 22,
  },
  readingInfo: {
    flex: 1,
    gap: 4,
  },
  readingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readingValue: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  readingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  readingBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
  },
  readingDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Empty
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  emptyText: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // CTA
  ctaWrapper: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
});
