import { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Line,
  Rect,
  Stop,
} from 'react-native-svg';
import { BarChart3, ChevronLeft, Download } from 'lucide-react-native';
import {
  GlassCard,
  analyzeSymptomsByPhase,
  calculateAverageCycleLength,
  getCycleStats,
  getCycles,
  getCycleDaysByCycle,
  getSymptomFrequencies,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Cycle,
  type FlowLevel,
} from '@mylife/cycle';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildSymptomPhaseEntries,
  formatSymptomLabel,
} from './phase2-utils';

interface SymptomRow {
  symptom: string;
  count: number;
  percentage: number;
  color: string;
}

interface HistogramBar {
  label: string;
  count: number;
}

interface FlowRow {
  key: FlowLevel | 'spotting';
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface AnalyticsData {
  trackedCycles: number;
  averageLength: number | null;
  stdDev: number | null;
  statusLabel: string;
  symptomRows: SymptomRow[];
  histogram: HistogramBar[];
  flowRows: FlowRow[];
}

function buildHistogram(lengths: number[]): HistogramBar[] {
  const buckets = new Map<number, number>();
  for (let day = 21; day <= 40; day += 1) {
    buckets.set(day, 0);
  }
  for (const length of lengths) {
    const clamped = Math.max(21, Math.min(40, Math.round(length)));
    buckets.set(clamped, (buckets.get(clamped) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([label, count]) => ({
    label: String(label),
    count,
  }));
}

function loadAnalyticsData(
  db: ReturnType<typeof useDatabase>,
): AnalyticsData {
  const cycles = getCycles(db, 50);
  const completed: Cycle[] = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const averageLength = calculateAverageCycleLength(cycleLengths);
  const stats = getCycleStats(db);
  const entries = buildSymptomPhaseEntries(
    db,
    cycles,
    Math.round(averageLength ?? 28),
  );
  const patterns = analyzeSymptomsByPhase(entries, 2);
  const patternMap = new Map(patterns.map((pattern) => [pattern.symptom, pattern]));

  const frequencies = getSymptomFrequencies(db, 16);
  const maxCount = frequencies[0]?.count ?? 1;
  const symptomRows = frequencies.slice(0, 8).map((item) => ({
    symptom: item.symptom,
    count: item.count,
    percentage: Math.round((item.count / maxCount) * 100),
    color:
      CYCLE_PHASE_COLORS[
        patternMap.get(item.symptom)?.dominantPhase ?? 'ovulation'
      ],
  }));

  const flowCounts: Record<FlowLevel, number> = {
    spotting: 0,
    light: 0,
    medium: 0,
    heavy: 0,
  };

  for (const cycle of cycles) {
    const days = getCycleDaysByCycle(db, cycle.id, 400);
    for (const day of days) {
      if (!day.flowLevel) continue;
      flowCounts[day.flowLevel] += 1;
    }
  }

  const totalFlowDays = Object.values(flowCounts).reduce((sum, count) => sum + count, 0);
  const flowRows: FlowRow[] = [
    {
      key: 'spotting',
      label: 'Spotting',
      count: flowCounts.spotting,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.spotting / totalFlowDays) * 100),
      color: '#FCA5A5',
    },
    {
      key: 'light',
      label: 'Light',
      count: flowCounts.light,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.light / totalFlowDays) * 100),
      color: CYCLE_PHASE_COLORS.luteal,
    },
    {
      key: 'medium',
      label: 'Medium',
      count: flowCounts.medium,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.medium / totalFlowDays) * 100),
      color: CYCLE_PHASE_COLORS.ovulation,
    },
    {
      key: 'heavy',
      label: 'Heavy',
      count: flowCounts.heavy,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.heavy / totalFlowDays) * 100),
      color: CYCLE_PHASE_COLORS.menstrual,
    },
  ];

  const statusLabel =
    stats.cycleLengthStdDev == null
      ? 'Building your baseline'
      : stats.cycleLengthStdDev <= 2
        ? 'Highly regular'
        : stats.cycleLengthStdDev <= 4
          ? 'Moderately variable'
          : 'Wide variation';

  return {
    trackedCycles: cycles.length,
    averageLength,
    stdDev: stats.cycleLengthStdDev,
    statusLabel,
    symptomRows,
    histogram: buildHistogram(cycleLengths),
    flowRows,
  };
}

export default function CycleAnalyticsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadAnalyticsData(db) };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : 'Failed to load cycle analytics.',
      };
    }
  }, [db]);

  if (!result.ok) {
    return (
      <View style={styles.errorWrap}>
        <RNText style={styles.errorTitle}>Something went wrong</RNText>
        <RNText style={styles.errorBody}>{result.message}</RNText>
      </View>
    );
  }

  const { trackedCycles, averageLength, stdDev, statusLabel, symptomRows, histogram, flowRows } =
    result.data;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <ChevronLeft size={22} color="#E4E1E9" strokeWidth={2.2} />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <RNText style={styles.eyebrow}>DEEP INSIGHTS</RNText>
            <RNText style={styles.headerTitle}>Cycle Analytics</RNText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {trackedCycles === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <BarChart3 size={36} color={CYCLE_ACCENT} strokeWidth={1.8} />
            <RNText style={styles.emptyTitle}>No cycle history yet</RNText>
            <RNText style={styles.emptyBody}>
              Log a few cycles to unlock frequency charts, length distribution,
              and flow intensity trends.
            </RNText>
          </GlassCard>
        ) : (
          <>
            <GlassCard style={styles.heroCard}>
              <RNText style={styles.heroEyebrow}>BASED ON {trackedCycles} TRACKED CYCLES</RNText>
              <View style={styles.heroMetricRow}>
                <RNText style={styles.heroValue}>
                  {averageLength != null ? averageLength.toFixed(1) : '--'}
                </RNText>
                <RNText style={styles.heroUnit}>days</RNText>
              </View>
              <RNText style={styles.heroSub}>
                {stdDev != null ? `± ${stdDev.toFixed(1)} day variation` : 'Need more complete cycles'}
              </RNText>
              <View style={styles.statusPill}>
                <RNText style={styles.statusPillText}>{statusLabel}</RNText>
              </View>
            </GlassCard>

            <GlassCard style={styles.sectionCard}>
              <RNText style={styles.sectionLabel}>SYMPTOM FREQUENCY</RNText>
              <View style={styles.symptomList}>
                {symptomRows.map((row) => (
                  <View key={row.symptom} style={styles.symptomRow}>
                    <View style={styles.symptomRowHeader}>
                      <RNText style={styles.symptomName}>
                        {formatSymptomLabel(row.symptom)}
                      </RNText>
                      <RNText style={styles.symptomPct}>{row.percentage}%</RNText>
                    </View>
                    <View style={styles.symptomTrack}>
                      <View
                        style={[
                          styles.symptomFill,
                          {
                            width: `${row.percentage}%`,
                            backgroundColor: row.color,
                          },
                        ]}
                      />
                    </View>
                    <RNText style={styles.symptomMeta}>Logged {row.count} times</RNText>
                  </View>
                ))}
              </View>
            </GlassCard>

            <GlassCard style={styles.sectionCard}>
              <RNText style={styles.sectionLabel}>CYCLE LENGTH DISTRIBUTION</RNText>
              <RNText style={styles.sectionSub}>
                Histogram across 21–40 day cycles. Average is highlighted in gold.
              </RNText>
              <CycleHistogram bars={histogram} averageLength={averageLength} />
            </GlassCard>

            <GlassCard style={styles.sectionCard}>
              <RNText style={styles.sectionLabel}>FLOW INTENSITY DISTRIBUTION</RNText>
              <View style={styles.flowStack}>
                {flowRows.map((row) => (
                  <View
                    key={row.key}
                    style={[
                      styles.flowSegment,
                      {
                        width: `${row.percentage || 2}%`,
                        backgroundColor: row.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.flowLegend}>
                {flowRows.map((row) => (
                  <View key={row.key} style={styles.flowLegendItem}>
                    <View
                      style={[styles.flowDot, { backgroundColor: row.color }]}
                    />
                    <RNText style={styles.flowLegendText}>
                      {row.label} · {row.count} days ({row.percentage}%)
                    </RNText>
                  </View>
                ))}
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          onPress={() =>
            Alert.alert('Export coming soon', 'CSV export for cycle analytics is planned for Phase 3.')
          }
          style={({ pressed }) => [
            styles.footerButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Download size={16} color="#4B2700" strokeWidth={2.2} />
          <RNText style={styles.footerButtonText}>Export Analytics</RNText>
        </Pressable>
      </View>
    </View>
  );
}

function CycleHistogram({
  bars,
  averageLength,
}: {
  bars: HistogramBar[];
  averageLength: number | null;
}) {
  const chartWidth = 320;
  const chartHeight = 190;
  const maxCount = Math.max(...bars.map((bar) => bar.count), 1);
  const barGap = 4;
  const barWidth = (chartWidth - barGap * (bars.length - 1)) / bars.length;
  const averageX =
    averageLength == null
      ? null
      : ((Math.max(21, Math.min(40, averageLength)) - 21) / (40 - 21)) *
        chartWidth;

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Defs>
          <SvgLinearGradient id="analyticsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={CYCLE_ACCENT_LIGHT} />
            <Stop offset="100%" stopColor={CYCLE_ACCENT} />
          </SvgLinearGradient>
        </Defs>
        {averageX != null ? (
          <Line
            x1={averageX}
            x2={averageX}
            y1={12}
            y2={chartHeight - 28}
            stroke={CYCLE_ACCENT}
            strokeWidth={2}
            strokeDasharray="6 6"
          />
        ) : null}
        {bars.map((bar, index) => {
          const height = Math.max(10, (bar.count / maxCount) * 126);
          const x = index * (barWidth + barGap);
          const y = chartHeight - 32 - height;
          return (
            <Rect
              key={bar.label}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx={4}
              fill={bar.count > 0 ? 'url(#analyticsGradient)' : CYCLE_SURFACES.high}
              opacity={bar.count > 0 ? 1 : 0.45}
            />
          );
        })}
      </Svg>
      <View style={styles.chartAxis}>
        {bars.filter((_, index) => index % 3 === 0 || index === bars.length - 1).map((bar) => (
          <RNText key={bar.label} style={styles.chartAxisLabel}>
            {bar.label}
          </RNText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYCLE_SURFACES.low,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  eyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: CYCLE_PHASE_COLORS.ovulation,
  },
  headerTitle: {
    ...CYCLE_TYPOGRAPHY.headlineLg,
    color: '#E4E1E9',
  },
  heroCard: {
    gap: 12,
    backgroundColor: CYCLE_SURFACES.low,
    overflow: 'hidden',
  },
  heroEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  heroMetricRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  heroValue: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 58,
    lineHeight: 60,
    color: '#E4E1E9',
    letterSpacing: -1.2,
  },
  heroUnit: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: CYCLE_PHASE_COLORS.ovulation,
    marginBottom: 6,
  },
  heroSub: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: `${CYCLE_PHASE_COLORS.ovulation}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  statusPillText: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 12,
    color: CYCLE_PHASE_COLORS.ovulation,
  },
  sectionCard: {
    gap: 14,
    backgroundColor: CYCLE_SURFACES.low,
  },
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  sectionSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.7)',
  },
  symptomList: {
    gap: 12,
  },
  symptomRow: {
    gap: 8,
  },
  symptomRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  symptomName: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  symptomPct: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    color: CYCLE_ACCENT_LIGHT,
  },
  symptomTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.highest,
    overflow: 'hidden',
  },
  symptomFill: {
    height: '100%',
    borderRadius: 999,
  },
  symptomMeta: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  chartWrap: {
    gap: 8,
    paddingTop: 4,
  },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartAxisLabel: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 10,
    color: 'rgba(214, 195, 181, 0.58)',
  },
  flowStack: {
    flexDirection: 'row',
    width: '100%',
    height: 22,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.highest,
    overflow: 'hidden',
  },
  flowSegment: {
    height: '100%',
  },
  flowLegend: {
    gap: 10,
  },
  flowLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  flowLegendText: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: '#E4E1E9',
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 999,
    backgroundColor: CYCLE_ACCENT,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  footerButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    color: '#4B2700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptyCard: {
    gap: 12,
    paddingVertical: 28,
  },
  emptyTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  emptyBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  errorWrap: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.lowest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  errorBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
    textAlign: 'center',
  },
});
