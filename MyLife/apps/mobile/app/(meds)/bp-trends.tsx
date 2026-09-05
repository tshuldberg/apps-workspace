import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EmptyState, ErrorState } from '@mylife/ui';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import {
  getActiveMedications,
  getBPReadings,
  getBPPeriodStats,
  type BPReading,
} from '@mylife/meds';
import {
  BP_METRIC_META,
  BP_PERIOD_OPTIONS,
  buildBPInsights,
  buildBPTrendSeries,
  filterBPReadingsForPeriod,
  getMedicationImpact,
  getTimeOfDayBuckets,
  type BPMetricKey,
  type BPPeriodKey,
  type BPTrendPoint,
} from '../../lib/meds/phase3';
import { useDatabase } from '../../components/DatabaseProvider';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 176;
const PADDING_X = 16;
const PADDING_Y = 14;

function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choicePill, selected && styles.choicePillActive]}>
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ArrowBadge({
  direction,
}: {
  direction: 'improving' | 'stable' | 'worsening';
}) {
  const meta = direction === 'improving'
    ? { icon: 'trending_down', color: '#30D158', label: 'Improving' }
    : direction === 'worsening'
      ? { icon: 'trending_up', color: '#FF453A', label: 'Worsening' }
      : { icon: 'timeline', color: MD_TEXT_SECONDARY, label: 'Stable' };

  return (
    <View style={[styles.arrowBadge, { backgroundColor: withAlpha(meta.color, 0.14) }]}>
      <MaterialSymbol color={meta.color} name={meta.icon} size={16} />
      <Text style={[styles.arrowBadgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function buildChartGeometry(values: number[], metric: BPMetricKey) {
  const meta = BP_METRIC_META[metric];
  const domainMin = Math.min(meta.min, ...values) - 4;
  const domainMax = Math.max(meta.max, ...values) + 4;
  const chartWidth = CHART_WIDTH - PADDING_X * 2;
  const chartHeight = CHART_HEIGHT - PADDING_Y * 2;

  const yForValue = (value: number) =>
    PADDING_Y + ((domainMax - value) / Math.max(1, domainMax - domainMin)) * chartHeight;

  const points = values.map((value, index) => {
    const x = values.length === 1
      ? PADDING_X + chartWidth / 2
      : PADDING_X + (index / (values.length - 1)) * chartWidth;

    return { x, y: yForValue(value), value };
  });

  const path = points.reduce((accumulator, point, index) => (
    `${accumulator}${index === 0 ? 'M' : ' L'} ${point.x} ${point.y}`
  ), '');

  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    path,
    points,
    yForValue,
    average,
    averageY: yForValue(average),
  };
}

function TrendChartCard({
  points,
  metric,
}: {
  points: BPTrendPoint[];
  metric: BPMetricKey;
}) {
  const meta = BP_METRIC_META[metric];
  const values = points
    .map((point) => point[metric])
    .filter((value): value is number => value != null);

  if (values.length === 0) {
    return (
      <GlassCard style={styles.chartCard}>
        <Text style={styles.chartEyebrow}>{meta.title}</Text>
        <Text style={styles.chartTitle}>No {meta.title.toLowerCase()} data yet</Text>
      </GlassCard>
    );
  }

  const geometry = buildChartGeometry(values, metric);
  const averageValue = geometry.average;
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <GlassCard style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartEyebrow}>{meta.title}</Text>
          <Text style={styles.chartValue}>
            {averageValue}
            <Text style={styles.chartUnit}> {meta.unit}</Text>
          </Text>
        </View>
        <View style={styles.chartLegendPill}>
          <View style={[styles.legendDot, { backgroundColor: meta.stroke }]} />
          <Text style={styles.chartLegendText}>Avg</Text>
        </View>
      </View>

      <Svg height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%">
        {meta.bands.map((band) => {
          const y = geometry.yForValue(band.to);
          const height = geometry.yForValue(band.from) - y;

          return (
            <Rect
              key={`${band.from}-${band.to}`}
              fill={band.color}
              height={Math.max(0, height)}
              rx={12}
              width={CHART_WIDTH - PADDING_X * 2}
              x={PADDING_X}
              y={y}
            />
          );
        })}

        <Line
          stroke={meta.averageStroke}
          strokeDasharray="6 6"
          strokeWidth={2}
          x1={PADDING_X}
          x2={CHART_WIDTH - PADDING_X}
          y1={geometry.averageY}
          y2={geometry.averageY}
        />
        <Path
          d={geometry.path}
          fill="none"
          stroke={meta.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4}
        />
        {geometry.points.map((point, index) => (
          <Circle
            key={`${metric}-${index}`}
            cx={point.x}
            cy={point.y}
            fill={meta.stroke}
            r={index === geometry.points.length - 1 ? 5 : 3}
          />
        ))}
      </Svg>

      <View style={styles.axisRow}>
        {points.map((point, index) => (
          <View key={`${point.key}-${index}`} style={styles.axisLabelWrap}>
            {index % labelStep === 0 || index === points.length - 1 ? (
              <Text style={styles.axisLabel}>{point.label}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function TimePatternCard({ readings }: { readings: BPReading[] }) {
  const buckets = getTimeOfDayBuckets(readings);
  const maxValue = Math.max(...buckets.map((bucket) => bucket.avgSystolic), 1);

  return (
    <GlassCard style={styles.patternCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardEyebrow}>Daily rhythm</Text>
          <Text style={styles.cardTitle}>Time of day pattern</Text>
        </View>
        <MaterialSymbol color={MD_ACCENT_LIGHT} name="schedule" size={18} />
      </View>

      <View style={styles.barRow}>
        {buckets.map((bucket) => {
          const height = bucket.count
            ? Math.max(14, Math.round((bucket.avgSystolic / maxValue) * 120))
            : 12;

          return (
            <View key={bucket.key} style={styles.barColumn}>
              <Text style={styles.barValue}>
                {bucket.count ? `${bucket.avgSystolic}` : '--'}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height, opacity: bucket.count ? 1 : 0.35 },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{bucket.label}</Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

function MedicationImpactCard({
  readings,
}: {
  readings: BPReading[];
}) {
  const db = useDatabase();
  const medications = useMemo(() => {
    try {
      return getActiveMedications(db);
    } catch {
      return [];
    }
  }, [db]);

  const impacts = useMemo(
    () => getMedicationImpact(readings, medications).slice(0, 3),
    [medications, readings],
  );

  return (
    <GlassCard style={styles.patternCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardEyebrow}>Therapy response</Text>
          <Text style={styles.cardTitle}>Medication impact</Text>
        </View>
        <MaterialSymbol color={MD_ACCENT_LIGHT} name="medication" size={18} />
      </View>

      {impacts.length === 0 ? (
        <Text style={styles.emptyCardCopy}>
          Add more readings around medication start dates to estimate before-and-after impact.
        </Text>
      ) : (
        <View style={styles.impactList}>
          {impacts.map((impact) => {
            const tone = impact.effectiveness === 'strong'
              ? '#30D158'
              : impact.effectiveness === 'positive'
                ? MD_ACCENT_LIGHT
                : impact.effectiveness === 'watch'
                  ? '#FF453A'
                  : MD_TEXT_SECONDARY;

            return (
              <View key={impact.medicationId} style={styles.impactRow}>
                <View style={styles.impactCopy}>
                  <Text style={styles.impactName}>{impact.medicationName}</Text>
                  <Text style={styles.impactMeta}>
                    {impact.beforeAverage?.systolic}/{impact.beforeAverage?.diastolic}
                    {' -> '}
                    {impact.afterAverage?.systolic}/{impact.afterAverage?.diastolic}
                  </Text>
                </View>
                <View style={[styles.impactBadge, { backgroundColor: withAlpha(tone, 0.14) }]}>
                  <Text style={[styles.impactBadgeText, { color: tone }]}>
                    {impact.systolicDelta != null
                      ? impact.systolicDelta > 0
                        ? `+${impact.systolicDelta}`
                        : `${impact.systolicDelta}`
                      : '--'}
                    {' mmHg'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </GlassCard>
  );
}

export default function BPTrendsScreen() {
  const db = useDatabase();
  const [period, setPeriod] = useState<BPPeriodKey>('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const dataset = useMemo(() => {
    try {
      return {
        error: null as string | null,
        readings: getBPReadings(db),
      };
    } catch {
      return {
        error: 'Failed to load BP trends.',
        readings: [] as BPReading[],
      };
    }
  }, [db, refreshKey]);

  const periodReadings = useMemo(
    () => filterBPReadingsForPeriod(dataset.readings, period),
    [dataset.readings, period],
  );

  const trendSeries = useMemo(
    () => buildBPTrendSeries(periodReadings, period),
    [period, periodReadings],
  );

  const periodStats = useMemo(
    () => getBPPeriodStats(periodReadings),
    [periodReadings],
  );

  const timeBuckets = useMemo(
    () => getTimeOfDayBuckets(periodReadings),
    [periodReadings],
  );

  const impacts = useMemo(() => {
    try {
      return getMedicationImpact(periodReadings, getActiveMedications(db));
    } catch {
      return [];
    }
  }, [db, periodReadings]);

  const insights = useMemo(
    () => buildBPInsights(periodReadings, trendSeries, timeBuckets, impacts),
    [impacts, periodReadings, timeBuckets, trendSeries],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  if (dataset.error) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState message={dataset.error} onRetry={onRefresh} />
      </View>
    );
  }

  if (dataset.readings.length < 2) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          accentColor={MD_ACCENT}
          icon="📈"
          message="Log at least two blood-pressure readings to unlock comparison charts and pattern analysis."
          title="Not enough BP data yet"
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={MD_ACCENT} />}
      style={styles.screen}
    >
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Blood Pressure Overview</Text>
          <Text style={styles.title}>Trend Analytics</Text>
          <Text style={styles.subtitle}>
            Compare systolic, diastolic, and pulse movement across the selected window.
          </Text>
        </View>
        <ArrowBadge direction={periodStats.trendDirection} />
      </View>

      <View style={styles.optionRow}>
        {BP_PERIOD_OPTIONS.map((option) => (
          <ChoicePill
            key={option.key}
            label={option.label}
            onPress={() => setPeriod(option.key)}
            selected={period === option.key}
          />
        ))}
      </View>

      <View style={styles.metricsRow}>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Avg Systolic</Text>
          <Text style={styles.metricValue}>{periodStats.avgSystolic}</Text>
          <Text style={styles.metricSub}>&lt;120 target</Text>
        </GlassCard>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Avg Diastolic</Text>
          <Text style={styles.metricValue}>{periodStats.avgDiastolic}</Text>
          <Text style={styles.metricSub}>&lt;80 target</Text>
        </GlassCard>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Readings</Text>
          <Text style={styles.metricValue}>{periodStats.readingCount}</Text>
          <Text style={styles.metricSub}>{period.toUpperCase()}</Text>
        </GlassCard>
      </View>

      <TrendChartCard metric="systolic" points={trendSeries} />
      <TrendChartCard metric="diastolic" points={trendSeries} />
      <TrendChartCard metric="pulse" points={trendSeries.filter((point) => point.pulse != null)} />

      <TimePatternCard readings={periodReadings} />
      <MedicationImpactCard readings={periodReadings} />

      <GlassCard style={styles.patternCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardEyebrow}>Insights</Text>
            <Text style={styles.cardTitle}>Detected patterns</Text>
          </View>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="psychology" size={18} />
        </View>

        <View style={styles.insightList}>
          {insights.map((insight) => (
            <View key={insight} style={styles.insightRow}>
              <View style={styles.insightDot} />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 18,
  },
  stateWrap: {
    flex: 1,
    backgroundColor: MD_SURFACES.lowest,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  title: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: MD_TEXT,
  },
  subtitle: {
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MD_TEXT_SECONDARY,
  },
  arrowBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBadgeText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MD_SURFACES.mid,
  },
  choicePillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  choicePillText: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
  },
  choicePillTextActive: {
    color: MD_ACCENT_LIGHT,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: MD_SURFACES.low,
    gap: 10,
    minHeight: 108,
  },
  metricLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metricValue: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 36,
    color: MD_TEXT,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  metricSub: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
  },
  chartCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  chartTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: MD_TEXT,
    marginTop: 4,
  },
  chartValue: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  chartUnit: {
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
  },
  chartLegendPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(MD_TEXT, 0.06),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  axisRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: -2,
  },
  axisLabelWrap: {
    flex: 1,
    minHeight: 16,
    alignItems: 'center',
  },
  axisLabel: {
    fontFamily: MD_FONTS.medium,
    fontSize: 10,
    lineHeight: 14,
    color: MD_TEXT_TERTIARY,
  },
  patternCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  cardTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: MD_TEXT,
    marginTop: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barValue: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    width: '100%',
    height: 124,
    borderRadius: 16,
    backgroundColor: withAlpha(MD_TEXT, 0.06),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: MD_ACCENT,
  },
  barLabel: {
    fontFamily: MD_FONTS.medium,
    fontSize: 10,
    lineHeight: 14,
    color: MD_TEXT_TERTIARY,
    textTransform: 'uppercase',
  },
  impactList: {
    gap: 12,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  impactCopy: {
    flex: 1,
    gap: 3,
  },
  impactName: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: MD_TEXT,
  },
  impactMeta: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  impactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  impactBadgeText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
  },
  insightList: {
    gap: 12,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MD_ACCENT,
    marginTop: 7,
  },
  insightText: {
    flex: 1,
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MD_TEXT_SECONDARY,
  },
  emptyCardCopy: {
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: MD_TEXT_SECONDARY,
  },
});
