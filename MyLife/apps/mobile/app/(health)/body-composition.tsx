import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import {
  getWeightHistory,
  getLatestMeasurement,
  calculateBmi,
  getBmiCategory,
  calculateLeanMass,
  getActiveGoals,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  HEALTH_CTA_GRADIENT,
  JAKARTA_FONTS,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import type { BmiCategory, HealthGoal } from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

type RangePill = '1W' | '1M' | '3M';

const BMI_CATEGORY_LABELS: Record<BmiCategory, string> = {
  underweight: 'UNDERWEIGHT',
  normal: 'NORMAL',
  overweight: 'OVERWEIGHT',
  obese: 'OBESE',
};

const BMI_CATEGORY_COLORS: Record<BmiCategory, string> = {
  underweight: '#60A5FA',
  normal: '#34D399',
  overweight: '#FBBF24',
  obese: HEALTH_ACCENT,
};

// Segment ranges for the BMI circular gauge
const BMI_SEGMENTS = [
  { max: 18.5, color: '#60A5FA', label: 'Underweight' },
  { max: 25.0, color: '#34D399', label: 'Normal' },
  { max: 30.0, color: '#FBBF24', label: 'Overweight' },
  { max: 40.0, color: HEALTH_ACCENT, label: 'Obese' },
] as const;

export default function BodyCompositionScreen() {
  const db = useDatabase();
  const [range, setRange] = useState<RangePill>('1M');

  const latest = useMemo(() => getLatestMeasurement(db), [db]);
  const history = useMemo(() => getWeightHistory(db, 90), [db]);
  const goals = useMemo(() => {
    try { return getActiveGoals(db); } catch { return [] as HealthGoal[]; }
  }, [db]);

  const bmi = latest ? calculateBmi(latest.weight_kg, latest.height_cm) : null;
  const bmiCat = bmi != null ? getBmiCategory(bmi) : null;
  const leanMass = latest?.weight_kg != null && latest?.body_fat_percent != null
    ? calculateLeanMass(latest.weight_kg, latest.body_fat_percent)
    : null;

  // Filter history by range
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const days = range === '1W' ? 7 : range === '1M' ? 30 : 90;
    const cutoff = new Date(now - days * 86400000).toISOString().slice(0, 10);
    return history.filter((m) => m.date >= cutoff);
  }, [history, range]);

  // Change from last month
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const prevMeasurement = history.find((m) => m.date <= monthAgo);

  const leanMassChange = useMemo(() => {
    if (!latest?.weight_kg || !latest?.body_fat_percent || !prevMeasurement?.weight_kg || !prevMeasurement?.body_fat_percent) return null;
    const currentLean = calculateLeanMass(latest.weight_kg, latest.body_fat_percent);
    const prevLean = calculateLeanMass(prevMeasurement.weight_kg, prevMeasurement.body_fat_percent);
    if (prevLean === 0) return null;
    return Math.round(((currentLean - prevLean) / prevLean) * 1000) / 10;
  }, [latest, prevMeasurement]);

  const bodyFatChange = useMemo(() => {
    if (!latest?.body_fat_percent || !prevMeasurement?.body_fat_percent) return null;
    return Math.round((latest.body_fat_percent - prevMeasurement.body_fat_percent) * 10) / 10;
  }, [latest, prevMeasurement]);

  // Weight goal (first body-weight goal, or fallback)
  const weightGoal = goals.find((g) => g.domain === 'weight');

  // Chart data
  const chartWeights = filteredHistory
    .slice()
    .reverse()
    .map((m) => m.weight_kg)
    .filter((w): w is number => w != null);
  const chartMin = chartWeights.length > 0 ? Math.min(...chartWeights) : 0;
  const chartMax = chartWeights.length > 0 ? Math.max(...chartWeights) : 1;
  const chartRange = chartMax - chartMin || 1;

  // Empty state
  if (!latest && history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'\u2696\uFE0F'}</Text>
        <Text style={styles.emptyTitle}>No Body Data</Text>
        <Text style={styles.emptyText}>
          Log a measurement to start tracking your body composition.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      <View style={styles.titleSection}>
        <Text style={styles.screenTitle}>Body Composition</Text>
        <Text style={styles.screenSubtitle}>Tracking your physical evolution</Text>
      </View>

      {/* Current Weight */}
      {latest?.weight_kg != null && (
        <GlassCard level={2} style={styles.card}>
          <Text style={styles.cardLabel}>CURRENT WEIGHT</Text>
          <Text style={styles.weightHero}>
            {latest.weight_kg.toFixed(1)}
            <Text style={styles.weightUnit}> kg</Text>
          </Text>

          {/* Range pills */}
          <View style={styles.rangePills}>
            {(['1W', '1M', '3M'] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.rangePill, range === r && styles.rangePillActive]}
                onPress={() => setRange(r)}
              >
                <Text style={[styles.rangePillText, range === r && styles.rangePillTextActive]}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Bar chart */}
          {chartWeights.length > 1 && (
            <View style={styles.weightChart}>
              {chartWeights.slice(-10).map((w, i) => {
                const pct = (w - chartMin) / chartRange;
                const height = Math.max(8, pct * 60);
                const isLatest = i === Math.min(chartWeights.length, 10) - 1;
                return (
                  <View key={i} style={styles.weightChartCol}>
                    <View
                      style={[
                        styles.weightChartBar,
                        {
                          height,
                          backgroundColor: isLatest ? HEALTH_ACCENT : HEALTH_SURFACES.focus,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </GlassCard>
      )}

      {/* BMI Index */}
      {bmi != null && bmiCat != null && (
        <GlassCard level={2} style={styles.card}>
          <Text style={styles.cardLabel}>BMI INDEX</Text>

          {/* Circular gauge */}
          <View style={styles.bmiGaugeContainer}>
            <View style={styles.bmiCircle}>
              <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
              <Text style={[styles.bmiCatLabel, { color: BMI_CATEGORY_COLORS[bmiCat] }]}>
                {BMI_CATEGORY_LABELS[bmiCat]}
              </Text>
            </View>
          </View>

          {/* Segmented range indicator */}
          <View style={styles.bmiSegments}>
            {BMI_SEGMENTS.map((seg, i) => (
              <View
                key={i}
                style={[
                  styles.bmiSegment,
                  {
                    flex: i === 0 ? seg.max : seg.max - BMI_SEGMENTS[i - 1].max,
                    backgroundColor: bmiCat === seg.label.toLowerCase() ? seg.color : `${seg.color}40`,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.bmiSegmentLabels}>
            <Text style={styles.bmiSegmentLabel}>18.5</Text>
            <Text style={styles.bmiSegmentLabel}>25</Text>
            <Text style={styles.bmiSegmentLabel}>30</Text>
          </View>

          {/* Height / Weight inputs (display only) */}
          <View style={styles.bmiInputRow}>
            <View style={styles.bmiInput}>
              <Text style={styles.bmiInputLabel}>Height</Text>
              <Text style={styles.bmiInputValue}>
                {latest?.height_cm != null ? `${latest.height_cm} cm` : '--'}
              </Text>
            </View>
            <View style={styles.bmiInput}>
              <Text style={styles.bmiInputLabel}>Weight</Text>
              <Text style={styles.bmiInputValue}>
                {latest?.weight_kg != null ? `${latest.weight_kg.toFixed(1)} kg` : '--'}
              </Text>
            </View>
          </View>

          <GradientButton
            title="Recalculate"
            onPress={() => router.push('/(health)/measurement-log' as never)}
          />
        </GlassCard>
      )}

      {/* Lean Mass */}
      {leanMass != null && (
        <GlassCard level={2} style={styles.card}>
          <View style={styles.compHeader}>
            <Text style={styles.compIcon}>{'\u{1F4AA}'}</Text>
            <View style={styles.compInfo}>
              <Text style={styles.cardLabel}>LEAN MASS</Text>
              <Text style={styles.compValue}>
                {leanMass.toFixed(1)}
                <Text style={styles.compUnit}> kg</Text>
              </Text>
            </View>
          </View>
          {/* Segmented bar (blue tones) */}
          <View style={styles.compBar}>
            <View style={[styles.compBarFill, {
              width: latest?.weight_kg ? `${Math.round((leanMass / latest.weight_kg) * 100)}%` : '0%',
              backgroundColor: '#60A5FA',
            }]} />
          </View>
          {leanMassChange != null && (
            <Text style={[styles.compChange, leanMassChange >= 0 ? styles.changeUp : styles.changeDown]}>
              {leanMassChange >= 0 ? '+' : ''}{leanMassChange}% FROM LAST MONTH
            </Text>
          )}
        </GlassCard>
      )}

      {/* Body Fat */}
      {latest?.body_fat_percent != null && (
        <GlassCard level={2} style={styles.card}>
          <View style={styles.compHeader}>
            <Text style={styles.compIcon}>{'\u{1F525}'}</Text>
            <View style={styles.compInfo}>
              <Text style={styles.cardLabel}>BODY FAT</Text>
              <Text style={styles.compValue}>
                {latest.body_fat_percent.toFixed(1)}
                <Text style={styles.compUnit}> %</Text>
              </Text>
            </View>
          </View>
          {/* Segmented bar (warm tones) */}
          <View style={styles.compBar}>
            <View style={[styles.compBarFill, {
              width: `${Math.min(100, Math.round(latest.body_fat_percent * 2))}%`,
              backgroundColor: HEALTH_ACCENT_LIGHT,
            }]} />
          </View>
          {bodyFatChange != null && (
            <Text style={[styles.compChange, bodyFatChange <= 0 ? styles.changeUp : styles.changeDown]}>
              {bodyFatChange >= 0 ? '+' : ''}{bodyFatChange}% FROM LAST MONTH
            </Text>
          )}
        </GlassCard>
      )}

      {/* Current Goal */}
      {weightGoal != null && (
        <GlassCard level={3} style={styles.card}>
          <Text style={styles.cardLabel}>CURRENT GOAL</Text>
          <Text style={styles.goalTarget}>
            Reach {weightGoal.target_value?.toFixed(1) ?? '--'} {weightGoal.unit ?? 'kg'}
          </Text>
          {latest?.weight_kg != null && weightGoal.target_value != null && (
            <>
              <GoalBar
                current={latest.weight_kg}
                target={weightGoal.target_value}
              />
              <Text style={styles.goalQuote}>
                Every step forward is progress. Stay consistent.
              </Text>
            </>
          )}
          <View style={styles.goalActions}>
            <GradientButton
              title="EDIT GOAL"
              onPress={() => router.push('/(health)/add-goal' as never)}
              variant="secondary"
            />
          </View>
        </GlassCard>
      )}

      {/* FAB */}
      <View style={styles.fabAnchor}>
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/(health)/measurement-log' as never)}
        >
          <LinearGradient
            colors={[HEALTH_CTA_GRADIENT.from, HEALTH_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Text style={styles.fabIcon}>+</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// --------------------------------------------------------------------------
// GoalBar sub-component
// --------------------------------------------------------------------------

function GoalBar({ current, target }: { current: number; target: number }) {
  // For weight loss, progress = how close to target
  const diff = Math.abs(target - current);
  const start = Math.max(current, target);
  const pct = start > 0 ? Math.min(100, Math.round(((start - diff) / start) * 100)) : 0;

  return (
    <View style={goalStyles.container}>
      <View style={goalStyles.track}>
        <LinearGradient
          colors={[HEALTH_CTA_GRADIENT.from, HEALTH_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[goalStyles.fill, { width: `${pct}%` }]}
        />
      </View>
      <Text style={goalStyles.pct}>{pct}%</Text>
    </View>
  );
}

const goalStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: spacing.sm,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_SURFACES.focus,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  pct: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: HEALTH_CTA_GRADIENT.from,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
});

// --------------------------------------------------------------------------
// Main styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  content: { paddingBottom: 100 },

  // Empty
  emptyContainer: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyText: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Title
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: 4,
  },
  screenTitle: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  screenSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Cards
  card: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  cardLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginBottom: 4,
  },

  // Weight
  weightHero: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 48,
    letterSpacing: -0.02 * 48,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  weightUnit: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 20,
    color: colors.textSecondary,
  },
  rangePills: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.sm,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  rangePillActive: {
    backgroundColor: `${HEALTH_ACCENT}20`,
  },
  rangePillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  rangePillTextActive: {
    color: HEALTH_ACCENT_LIGHT,
  },
  weightChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 70,
    marginTop: spacing.sm,
  },
  weightChartCol: { flex: 1, alignItems: 'center' },
  weightChartBar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 8,
  },

  // BMI
  bmiGaugeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  bmiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: HEALTH_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bmiValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  bmiCatLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
  },
  bmiSegments: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  bmiSegment: {
    height: 6,
  },
  bmiSegmentLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: '10%',
    marginBottom: spacing.md,
  },
  bmiSegmentLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  bmiInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bmiInput: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bmiInputLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  bmiInputValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  // Lean Mass / Body Fat
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.sm,
  },
  compIcon: { fontSize: 28 },
  compInfo: { flex: 1, gap: 2 },
  compValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  compUnit: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: colors.textSecondary,
  },
  compBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_SURFACES.focus,
    overflow: 'hidden',
  },
  compBarFill: {
    height: 8,
    borderRadius: 4,
  },
  compChange: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    marginTop: spacing.sm,
  },
  changeUp: { color: '#34D399' },
  changeDown: { color: HEALTH_ACCENT },

  // Goal
  goalTarget: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 4,
  },
  goalQuote: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  goalActions: {
    alignItems: 'center',
  },

  // FAB
  fabAnchor: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1a1008',
    lineHeight: 30,
  },
});
