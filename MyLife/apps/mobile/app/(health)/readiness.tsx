import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native';
import { Text, colors } from '@mylife/ui';
import {
  getRecentReadinessScores,
  getRecommendation,
  getLastNightSleep,
  getLatestVital,
  type ReadinessScore,
  type Recommendation,
  HEALTH_ACCENT,
  HEALTH_SECONDARY,
  HEALTH_TERTIARY,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
  StatBadge,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

// ---------------------------------------------------------------------------
// Score color mapping
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 80) return HEALTH_SECONDARY;      // green
  if (score >= 60) return '#FFB877';              // warm gold
  if (score >= 40) return '#FBBF24';              // orange
  return '#EF4444';                               // red
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'POOR';
}

function performanceLevel(rec: Recommendation): string {
  switch (rec) {
    case 'intense': return 'HIGH PERFORMANCE';
    case 'moderate': return 'MODERATE READINESS';
    case 'light': return 'LOW READINESS';
    case 'rest': return 'RECOVERY DAY';
  }
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Contributor helpers
// ---------------------------------------------------------------------------

interface Contributor {
  label: string;
  value: string;
  color: string;
  progress: number;
}

function buildContributors(s: ReadinessScore): Contributor[] {
  return [
    {
      label: 'Sleep Quality',
      value: `${Math.round(s.sleep_factor * 100)}%`,
      color: s.sleep_factor >= 0.8 ? HEALTH_SECONDARY : s.sleep_factor >= 0.5 ? '#FFB877' : '#EF4444',
      progress: s.sleep_factor,
    },
    {
      label: 'HRV Recovery',
      value: s.hrv_factor >= 0.7 ? 'Above Baseline' : s.hrv_factor >= 0.4 ? 'Normal' : 'Below Baseline',
      color: s.hrv_factor >= 0.7 ? HEALTH_TERTIARY : s.hrv_factor >= 0.4 ? '#FFB877' : '#EF4444',
      progress: s.hrv_factor,
    },
    {
      label: 'Resting Heart Rate',
      value: s.rhr_factor >= 0.7 ? 'Optimal' : s.rhr_factor >= 0.4 ? 'Normal' : 'Elevated',
      color: s.rhr_factor >= 0.7 ? HEALTH_SECONDARY : s.rhr_factor >= 0.4 ? '#FFB877' : '#EF4444',
      progress: s.rhr_factor,
    },
    {
      label: 'Active Recovery',
      value: s.activity_factor >= 0.7 ? 'High' : s.activity_factor >= 0.4 ? 'Moderate' : 'Low',
      color: s.activity_factor >= 0.7 ? HEALTH_TERTIARY : s.activity_factor >= 0.4 ? '#FFB877' : '#EF4444',
      progress: s.activity_factor,
    },
    {
      label: 'Strain Balance',
      value: s.strain_factor >= 0.7 ? 'Low Strain' : s.strain_factor >= 0.4 ? 'Moderate' : 'High Strain',
      color: s.strain_factor >= 0.7 ? HEALTH_SECONDARY : s.strain_factor >= 0.4 ? '#FFB877' : '#EF4444',
      progress: s.strain_factor,
    },
  ];
}

// ---------------------------------------------------------------------------
// AI insight text
// ---------------------------------------------------------------------------

function buildInsightText(latest: ReadinessScore, rec: Recommendation): string {
  const sleepPct = Math.round(latest.sleep_factor * 100);
  const hrvPct = Math.round(latest.hrv_factor * 100);

  if (rec === 'intense') {
    return `Your HRV recovery is ${hrvPct}% of baseline and sleep quality is at ${sleepPct}%. This is an ideal day for high-intensity training or focused creative work.`;
  }
  if (rec === 'moderate') {
    return `Recovery metrics look solid at ${sleepPct}% sleep quality. Moderate activity is recommended today -- save the heavy sessions for a higher readiness day.`;
  }
  if (rec === 'light') {
    return `Your body is still recovering with ${sleepPct}% sleep quality and ${hrvPct}% HRV. Stick to light movement like walking or gentle yoga today.`;
  }
  return `Rest day recommended. Sleep quality at ${sleepPct}% and HRV at ${hrvPct}% suggest your body needs active recovery. Focus on hydration and sleep tonight.`;
}

// ---------------------------------------------------------------------------
// Simple line chart (SVG-free, View-based)
// ---------------------------------------------------------------------------

function TrendChart({ scores, range }: { scores: ReadinessScore[]; range: 'week' | 'month' }) {
  const sliced = scores.slice(0, range === 'week' ? 7 : 30).reverse();
  if (sliced.length < 2) return null;

  const maxScore = Math.max(...sliced.map((s) => s.score), 100);
  const chartHeight = 120;

  return (
    <View style={trendStyles.chartContainer}>
      {/* Y-axis labels */}
      <View style={trendStyles.yAxis}>
        <Text style={trendStyles.yLabel}>100</Text>
        <Text style={trendStyles.yLabel}>50</Text>
        <Text style={trendStyles.yLabel}>0</Text>
      </View>

      {/* Data bars */}
      <View style={trendStyles.barsContainer}>
        {sliced.map((s, i) => {
          const height = (s.score / maxScore) * chartHeight;
          return (
            <View key={s.id ?? i} style={trendStyles.barWrapper}>
              <View style={trendStyles.barTrack}>
                <View
                  style={[
                    trendStyles.bar,
                    {
                      height,
                      backgroundColor: scoreColor(s.score),
                    },
                  ]}
                />
              </View>
              <View style={[trendStyles.dot, { backgroundColor: scoreColor(s.score) }]}>
                <Text style={trendStyles.dotText}>{s.score}</Text>
              </View>
              <Text style={trendStyles.barDate}>{s.date.slice(5)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  chartContainer: {
    flexDirection: 'row',
    height: 180,
    paddingTop: 8,
  },
  yAxis: {
    width: 28,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingBottom: 28,
  },
  yLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 9,
    color: colors.textSecondary,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 28,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: 120,
    width: 6,
    borderRadius: 3,
    backgroundColor: HEALTH_SURFACES.lift,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  dot: {
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  dotText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 8,
    color: HEALTH_SURFACES.depth,
  },
  barDate: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 8,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ReadinessScreen() {
  const db = useDatabase();
  const [trendRange, setTrendRange] = useState<'week' | 'month'>('week');

  const scores = useMemo(() => {
    try { return getRecentReadinessScores(db, 30); } catch { return []; }
  }, [db]);

  const latest = scores.length > 0 ? scores[0] : null;
  const recommendation = latest ? getRecommendation(latest.score) : null;

  // Pull supplementary vital snapshot values
  const hrv = useMemo(() => {
    try { return getLatestVital(db, 'hrv'); } catch { return null; }
  }, [db]);
  const rhr = useMemo(() => {
    try { return getLatestVital(db, 'resting_heart_rate'); } catch { return null; }
  }, [db]);
  const sleep = useMemo(() => {
    try { return getLastNightSleep(db); } catch { return null; }
  }, [db]);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!latest) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyDiamond}>
            <Text style={styles.emptyDiamondText}>--</Text>
          </View>
          <Text style={styles.emptyTitle}>No Readiness Data</Text>
          <Text style={styles.emptySubtitle}>
            Your daily readiness score combines sleep, HRV, heart rate, and activity data.
            Sync health data to get started.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const contributors = buildContributors(latest);
  const insightText = buildInsightText(latest, recommendation!);
  const color = scoreColor(latest.score);
  const label = scoreLabel(latest.score);
  const dateHeader = formatDateHeader(latest.date);
  const perfLevel = performanceLevel(recommendation!);

  const sleepHours = sleep ? (sleep.duration_minutes / 60).toFixed(1) : '--';
  const hrvDisplay = hrv ? `${Math.round(hrv.value)}` : '--';
  const rhrDisplay = rhr ? `${Math.round(rhr.value)}` : '--';
  const strainDisplay = latest.strain_factor >= 0.7 ? 'Low' : latest.strain_factor >= 0.4 ? 'Med' : 'High';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Title ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Daily Readiness</Text>
        <Text style={styles.subtitle}>{dateHeader} - {perfLevel}</Text>
      </View>

      {/* ── Diamond Hero ── */}
      <View style={styles.heroContainer}>
        <View style={styles.diamondOuter}>
          <View style={[styles.diamondGlow, { shadowColor: color }]} />
          <View style={styles.diamond}>
            <View style={[styles.diamondGradient, { backgroundColor: color, opacity: 0.12 }]} />
            <Text style={[styles.heroScore, { color }]}>{latest.score}</Text>
            <Text style={[styles.heroLabel, { color }]}>{label}</Text>
          </View>
        </View>
      </View>

      {/* ── Stat Badges ── */}
      <View style={styles.badgeRow}>
        <StatBadge icon={'\u2764\uFE0F\u200D\u{1FA79}'} value={hrvDisplay} label="HRV ms" />
        <StatBadge icon={'\u2764\uFE0F'} value={rhrDisplay} label="RHR bpm" />
        <StatBadge icon={'\u{1F634}'} value={sleepHours} label="SLEEP h" />
        <StatBadge icon={'\u26A1'} value={strainDisplay} label="STRAIN" />
      </View>

      {/* ── Key Contributors ── */}
      <SectionHeader label="RECOVERY" title="Key Contributors" />
      <GlassCard level={2} style={styles.cardSpacing}>
        {contributors.map((c, i) => (
          <View key={c.label} style={[styles.contributorRow, i > 0 && styles.contributorDivider]}>
            <View style={styles.contributorInfo}>
              <Text style={styles.contributorLabel}>{c.label}</Text>
              <Text style={[styles.contributorValue, { color: c.color }]}>{c.value}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(c.progress * 100)}%`, backgroundColor: c.color },
                ]}
              />
            </View>
          </View>
        ))}
      </GlassCard>

      {/* ── AI Insight ── */}
      <GlassCard level={3} style={styles.cardSpacing}>
        <View style={styles.insightHeader}>
          <Text style={styles.sparkle}>{'\u2728'}</Text>
          <Text style={styles.insightLabel}>AI INSIGHT</Text>
        </View>
        <Text style={styles.insightText}>{insightText}</Text>
      </GlassCard>

      {/* ── Readiness Trend ── */}
      <SectionHeader
        label="TREND"
        title="Readiness Trend"
      />
      <Text style={styles.trendSubtitle}>
        Last {trendRange === 'week' ? '7' : '30'} days performance
      </Text>

      {/* Pill toggle */}
      <View style={styles.pillRow}>
        <Pressable
          style={[styles.pill, trendRange === 'week' && styles.pillActive]}
          onPress={() => setTrendRange('week')}
        >
          <Text style={[styles.pillText, trendRange === 'week' && styles.pillTextActive]}>WEEK</Text>
        </Pressable>
        <Pressable
          style={[styles.pill, trendRange === 'month' && styles.pillActive]}
          onPress={() => setTrendRange('month')}
        >
          <Text style={[styles.pillText, trendRange === 'month' && styles.pillTextActive]}>MONTH</Text>
        </Pressable>
      </View>

      <GlassCard level={2} style={styles.cardSpacing}>
        <TrendChart scores={scores} range={trendRange} />
      </GlassCard>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const DIAMOND_SIZE = 160;
const DIAMOND_BORDER_RADIUS = 24;

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
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Diamond Hero
  heroContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  diamondOuter: {
    width: DIAMOND_SIZE * 1.4,
    height: DIAMOND_SIZE * 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondGlow: {
    position: 'absolute',
    width: DIAMOND_SIZE + 40,
    height: DIAMOND_SIZE + 40,
    borderRadius: DIAMOND_SIZE / 2,
    opacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 0,
    backgroundColor: 'transparent',
  },
  diamond: {
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
    borderRadius: DIAMOND_BORDER_RADIUS,
    backgroundColor: HEALTH_SURFACES.lift,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  diamondGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DIAMOND_BORDER_RADIUS,
  },
  heroScore: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 56,
    transform: [{ rotate: '-45deg' }],
  },
  heroLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 0.1 * 13,
    textTransform: 'uppercase',
    transform: [{ rotate: '-45deg' }],
    marginTop: -4,
  },

  // Stat Badges
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  // Card spacing
  cardSpacing: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  // Contributors
  contributorRow: {
    gap: 8,
    paddingVertical: 10,
  },
  contributorDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  contributorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contributorLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
  },
  contributorValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: HEALTH_SURFACES.focus,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },

  // AI Insight
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sparkle: {
    fontSize: 16,
  },
  insightLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: '#FFB877',
  },
  insightText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Trend
  trendSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: HEALTH_SURFACES.lift,
  },
  pillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  pillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: HEALTH_SURFACES.depth,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyDiamond: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: HEALTH_SURFACES.lift,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyDiamondText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    color: colors.textSecondary,
    transform: [{ rotate: '-45deg' }],
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
