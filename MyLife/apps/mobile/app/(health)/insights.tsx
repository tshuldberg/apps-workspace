import { useMemo, useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  getVitals,
  getVitalAggregates,
  getLatestVital,
  getRecentReadinessScores,
  getSleepSessions,
  correlateAll,
  type Vital,
  type VitalType,
  type VitalAggregate,
  type CorrelationPair,
  type TimeSeriesPoint,
  HEALTH_ACCENT,
  HEALTH_SECONDARY,
  HEALTH_TERTIARY,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DateRange = '1W' | '1M' | '3M' | 'ALL';

const RANGE_DAYS: Record<DateRange, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  ALL: 365,
};

const VITAL_LABELS: Record<VitalType, string> = {
  heart_rate: 'Heart Rate',
  resting_heart_rate: 'Resting HR',
  hrv: 'HRV',
  blood_oxygen: 'Blood Oxygen',
  blood_pressure: 'Blood Pressure',
  body_temperature: 'Temperature',
  steps: 'Steps',
  active_energy: 'Active Energy',
  respiratory_rate: 'Respiratory Rate',
  vo2_max: 'VO2 Max',
};

const VITAL_UNITS: Record<VitalType, string> = {
  heart_rate: 'bpm',
  resting_heart_rate: 'bpm',
  hrv: 'ms',
  blood_oxygen: '%',
  blood_pressure: 'mmHg',
  body_temperature: '\u00B0F',
  steps: 'steps',
  active_energy: 'cal',
  respiratory_rate: 'brpm',
  vo2_max: 'mL/kg/min',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusForVital(type: VitalType, value: number): { text: string; color: string } {
  switch (type) {
    case 'heart_rate':
      if (value < 60) return { text: 'AT REST', color: HEALTH_TERTIARY };
      if (value <= 100) return { text: 'OPTIMAL', color: HEALTH_SECONDARY };
      return { text: 'ELEVATED', color: '#FBBF24' };
    case 'resting_heart_rate':
      if (value < 50) return { text: 'ATHLETIC', color: HEALTH_TERTIARY };
      if (value <= 70) return { text: 'OPTIMAL', color: HEALTH_SECONDARY };
      return { text: 'ELEVATED', color: '#FBBF24' };
    case 'hrv':
      if (value >= 60) return { text: 'EXCELLENT', color: HEALTH_SECONDARY };
      if (value >= 30) return { text: 'GOOD', color: '#FFB877' };
      return { text: 'LOW', color: '#EF4444' };
    case 'blood_oxygen':
      if (value >= 95) return { text: 'NORMAL', color: HEALTH_SECONDARY };
      if (value >= 90) return { text: 'LOW', color: '#FBBF24' };
      return { text: 'CRITICAL', color: '#EF4444' };
    default:
      return { text: 'RECORDED', color: HEALTH_TERTIARY };
  }
}

function correlationColor(coefficient: number): string {
  if (coefficient >= 0.4) return HEALTH_SECONDARY;
  if (coefficient <= -0.4) return '#EF4444';
  if (Math.abs(coefficient) >= 0.2) return '#FFB877';
  return colors.textSecondary;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function formatDateShort(isoStr: string): string {
  const d = new Date(isoStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Mini sparkline chart
// ---------------------------------------------------------------------------

function Sparkline({ data, color: lineColor }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  const chartHeight = 40;

  return (
    <View style={sparkStyles.container}>
      {data.map((val, i) => {
        const normalized = (val - minVal) / range;
        const barHeight = Math.max(2, normalized * chartHeight);
        return (
          <View
            key={i}
            style={[
              sparkStyles.bar,
              {
                height: barHeight,
                backgroundColor: lineColor,
                opacity: 0.4 + normalized * 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 40,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 3,
  },
});

// ---------------------------------------------------------------------------
// Generate insights from correlations and data
// ---------------------------------------------------------------------------

function generateInsightTexts(
  correlations: CorrelationPair[],
  latestHr: Vital | null,
  latestHrv: Vital | null,
): string[] {
  const insights: string[] = [];

  // Correlation-based insights
  for (const c of correlations.slice(0, 3)) {
    const absR = Math.abs(c.result.coefficient);
    const pct = Math.round(absR * 100);
    const direction = c.result.direction === 'positive' ? 'improves' : 'decreases';
    insights.push(`${c.domainA} ${direction} with ${c.domainB} (${pct}% correlation).`);
  }

  // Vital-based insights
  if (latestHrv && latestHrv.value >= 60) {
    insights.push('Your HRV is in the excellent range, indicating strong recovery.');
  }
  if (latestHr && latestHr.value <= 65) {
    insights.push('Resting heart rate is low, suggesting good cardiovascular fitness.');
  }

  if (insights.length === 0) {
    insights.push('Log more health data to unlock cross-domain insights.');
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function InsightsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [range, setRange] = useState<DateRange>('1W');

  const days = RANGE_DAYS[range];

  // Fetch latest vitals for the featured card
  const latestHr = useMemo(() => {
    try { return getLatestVital(db, 'heart_rate'); } catch { return null; }
  }, [db]);
  const latestHrv = useMemo(() => {
    try { return getLatestVital(db, 'hrv'); } catch { return null; }
  }, [db]);

  // Featured vital: prefer heart_rate, fallback to any available
  const featuredType: VitalType = latestHr ? 'heart_rate' : latestHrv ? 'hrv' : 'heart_rate';
  const featuredVital = latestHr ?? latestHrv ?? null;

  // Aggregates for sparkline
  const aggregates = useMemo(() => {
    try { return getVitalAggregates(db, featuredType, days); } catch { return [] as VitalAggregate[]; }
  }, [db, featuredType, days]);

  const sparkData = useMemo(() => aggregates.map((a) => a.avg), [aggregates]);

  // Recent readings
  const recentVitals = useMemo(() => {
    try { return getVitals(db, 20); } catch { return [] as Vital[]; }
  }, [db]);

  // Correlations
  const correlations = useMemo(() => {
    try {
      const start = new Date();
      start.setDate(start.getDate() - days);
      // Build time series from available data sources
      const domains: { name: string; series: TimeSeriesPoint[] }[] = [];

      // Sleep duration series
      const sleepSessions = getSleepSessions(db, days);
      if (sleepSessions.length > 0) {
        domains.push({
          name: 'Sleep',
          series: sleepSessions.map((s) => ({
            date: s.start_time.slice(0, 10),
            value: s.duration_minutes / 60,
          })),
        });
      }

      // HRV series
      const hrvAggs = getVitalAggregates(db, 'hrv', days);
      if (hrvAggs.length > 0) {
        domains.push({
          name: 'HRV',
          series: hrvAggs.map((a) => ({ date: a.date, value: a.avg })),
        });
      }

      // Resting HR series
      const rhrAggs = getVitalAggregates(db, 'resting_heart_rate', days);
      if (rhrAggs.length > 0) {
        domains.push({
          name: 'Resting HR',
          series: rhrAggs.map((a) => ({ date: a.date, value: a.avg })),
        });
      }

      // Readiness score series
      const readinessScores = getRecentReadinessScores(db, days);
      if (readinessScores.length > 0) {
        domains.push({
          name: 'Readiness',
          series: readinessScores.map((r) => ({ date: r.date, value: r.score })),
        });
      }

      // Steps series
      const stepAggs = getVitalAggregates(db, 'steps', days);
      if (stepAggs.length > 0) {
        domains.push({
          name: 'Steps',
          series: stepAggs.map((a) => ({ date: a.date, value: a.avg })),
        });
      }

      return correlateAll(domains);
    } catch {
      return [] as CorrelationPair[];
    }
  }, [db, days]);

  // Generate insights
  const insightTexts = useMemo(
    () => generateInsightTexts(correlations, latestHr, latestHrv),
    [correlations, latestHr, latestHrv],
  );

  const handleExport = useCallback(() => {
    router.push('/(health)/export' as never);
  }, [router]);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  const hasData = featuredVital != null || recentVitals.length > 0;

  if (!hasData) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Vitals Analytics</Text>
          <Text style={styles.subtitle}>Cross-domain health insights</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'\u{1F4CA}'}</Text>
          <Text style={styles.emptyTitle}>No Vitals Data Yet</Text>
          <Text style={styles.emptySubtitle}>
            Sync health data from Apple Health or log vitals manually to see analytics.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Title ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Vitals Analytics</Text>
        <Text style={styles.subtitle}>Cross-domain health insights</Text>
      </View>

      {/* ── Date Range Filter ── */}
      <View style={styles.filterRow}>
        {(['1W', '1M', '3M', 'ALL'] as DateRange[]).map((r) => (
          <Pressable
            key={r}
            style={[styles.filterPill, range === r && styles.filterPillActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.filterText, range === r && styles.filterTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Featured Vital Card ── */}
      {featuredVital && (
        <>
          <SectionHeader label="FEATURED" title={VITAL_LABELS[featuredType]} />
          <GlassCard level={2} style={styles.cardSpacing}>
            <View style={styles.featuredRow}>
              <View>
                <Text style={styles.featuredValue}>
                  {Math.round(featuredVital.value)}
                </Text>
                <Text style={styles.featuredUnit}>{VITAL_UNITS[featuredType]}</Text>
              </View>
              {sparkData.length > 1 && (
                <View style={styles.sparkContainer}>
                  <Sparkline
                    data={sparkData}
                    color={statusForVital(featuredType, featuredVital.value).color}
                  />
                </View>
              )}
            </View>
            <View style={styles.featuredMeta}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusForVital(featuredType, featuredVital.value).color + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: statusForVital(featuredType, featuredVital.value).color },
                  ]}
                >
                  {statusForVital(featuredType, featuredVital.value).text}
                </Text>
              </View>
              <Text style={styles.featuredDate}>
                {formatDateShort(featuredVital.recorded_at)}
              </Text>
            </View>
          </GlassCard>
        </>
      )}

      {/* ── Key Correlations ── */}
      {correlations.length > 0 && (
        <>
          <SectionHeader label="ANALYSIS" title="Key Correlations" />
          <GlassCard level={2} style={styles.cardSpacing}>
            {correlations.slice(0, 5).map((c, i) => {
              const sign = c.result.coefficient >= 0 ? '+' : '';
              return (
                <View
                  key={`${c.domainA}-${c.domainB}`}
                  style={[styles.correlationRow, i > 0 && styles.rowDivider]}
                >
                  <Text style={styles.correlationLabel}>
                    {c.domainA} vs {c.domainB}
                  </Text>
                  <Text
                    style={[
                      styles.correlationValue,
                      { color: correlationColor(c.result.coefficient) },
                    ]}
                  >
                    {sign}{c.result.coefficient.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {/* ── Insights ── */}
      <SectionHeader label="INTELLIGENCE" title="Insights" />
      {insightTexts.map((text, i) => (
        <GlassCard key={i} level={2} style={styles.insightCard}>
          <View style={styles.insightRow}>
            <Text style={styles.sparkle}>{'\u2728'}</Text>
            <Text style={styles.insightText}>{text}</Text>
          </View>
        </GlassCard>
      ))}

      {/* ── Recent Readings ── */}
      {recentVitals.length > 0 && (
        <>
          <SectionHeader label="HISTORY" title="Recent Readings" />
          <GlassCard level={2} style={styles.cardSpacing}>
            {recentVitals.slice(0, 8).map((v, i) => {
              const status = statusForVital(v.vital_type, v.value);
              return (
                <View key={v.id} style={[styles.readingRow, i > 0 && styles.rowDivider]}>
                  <View style={styles.readingLeft}>
                    <Text style={styles.readingDate}>{formatDateShort(v.recorded_at)}</Text>
                    <Text style={styles.readingTime}>{formatTime(v.recorded_at)}</Text>
                  </View>
                  <View style={styles.readingCenter}>
                    <Text style={styles.readingValue}>{Math.round(v.value)}</Text>
                    <Text style={styles.readingUnit}>{VITAL_UNITS[v.vital_type]}</Text>
                  </View>
                  <View style={[styles.readingBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.readingBadgeText, { color: status.color }]}>
                      {status.text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {/* ── Export Button ── */}
      <View style={styles.exportContainer}>
        <GradientButton
          title="Export Data"
          onPress={handleExport}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: HEALTH_SURFACES.lift,
  },
  filterPillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  filterText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: HEALTH_SURFACES.depth,
  },

  // Card spacing
  cardSpacing: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  // Featured vital
  featuredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  featuredValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 48,
    color: colors.text,
  },
  featuredUnit: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -4,
  },
  sparkContainer: {
    flex: 1,
    maxWidth: 140,
    marginLeft: 16,
    paddingBottom: 8,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
  },
  featuredDate: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Correlations
  correlationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  correlationLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  correlationValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    minWidth: 50,
    textAlign: 'right',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },

  // Insights
  insightCard: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  sparkle: {
    fontSize: 16,
    marginTop: 1,
  },
  insightText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Recent readings
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  readingLeft: {
    width: 70,
  },
  readingDate: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.text,
  },
  readingTime: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  readingCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  readingValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  readingUnit: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  readingBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readingBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
  },

  // Export
  exportContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptySubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
