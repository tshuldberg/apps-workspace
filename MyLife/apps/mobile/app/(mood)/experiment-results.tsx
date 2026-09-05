import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getExperiment,
  abandonExperiment,
  correlationStrength,
  type Experiment,
  GlassCard,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

export default function ExperimentResultsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    try {
      setExp(getExperiment(db, id) ?? null);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  const handleAbandon = () => {
    if (!exp) return;
    Alert.alert(
      'Abandon Experiment',
      'Abandon this experiment? Any data collected so far will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: () => {
            abandonExperiment(db, exp.id);
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.empty}>
        <Text variant="body" color={colors.textSecondary}>Loading...</Text>
      </View>
    );
  }

  if (!exp) {
    return (
      <View style={styles.empty}>
        <Text variant="body" color={colors.danger}>Experiment not found.</Text>
        <GradientButton title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const isActive = exp.status === 'draft' || exp.status === 'baseline' || exp.status === 'intervention';
  const isCompleted = exp.status === 'completed';
  const diff = exp.scoreDiff ?? 0;
  const isPositive = diff > 0;
  const isSignificant = exp.isSignificant === true;

  // Determine outcome summary
  const outcomeTitle = isCompleted
    ? isSignificant && isPositive
      ? 'Significant Improvement'
      : isSignificant && !isPositive
        ? 'Significant Decline'
        : 'No Significant Change'
    : null;

  const outcomeIcon = isCompleted
    ? isSignificant && isPositive
      ? '\u{1F44D}'
      : isSignificant && !isPositive
        ? '\u{1F44E}'
        : '\u{1F91D}'
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>EXPERIMENT ANALYSIS</Text>
        <Text style={styles.headerTitle}>{exp.hypothesis}</Text>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            {
              backgroundColor: isCompleted
                ? colors.success
                : isActive
                  ? MOOD_ACCENT
                  : colors.textSecondary,
            },
          ]} />
          <Text style={styles.statusText}>
            {isCompleted ? 'COMPLETED INTERVENTION' : exp.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Outcome Summary (Completed only) */}
      {isCompleted && outcomeTitle && (
        <GlassCard level={3} style={styles.outcomeCard}>
          <View style={styles.outcomeHeader}>
            <Text style={styles.outcomeIcon}>{outcomeIcon}</Text>
            <View style={styles.outcomeTextWrap}>
              <Text style={styles.outcomeTitle}>{outcomeTitle}</Text>
              <Text style={styles.outcomeDescription}>
                Your mood was <Text style={styles.bold}>{Math.abs(diff).toFixed(1)} points {isPositive ? 'higher' : 'lower'}</Text> during {exp.interventionDescription.toLowerCase()}.{' '}
                {isSignificant ? 'Statistically significant.' : 'Not statistically significant.'}
              </Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Big Mood Difference */}
      {isCompleted && exp.scoreDiff != null && (
        <GlassCard level={2} style={styles.bigDiffCard}>
          <Text style={[
            styles.bigDiffNumber,
            { color: isPositive ? colors.success : diff < 0 ? '#FFB4AB' : colors.textSecondary },
          ]}>
            {isPositive ? '+' : ''}{diff.toFixed(1)}
          </Text>
          <Text style={styles.bigDiffLabel}>MOOD DIFFERENCE</Text>
        </GlassCard>
      )}

      {/* Two-Period Chart Placeholder */}
      {isCompleted && (
        <GlassCard level={2} style={styles.chartCard}>
          <Text style={styles.chartTitle}>TWO-PERIOD MOOD BASELINE</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textSecondary }]} />
              <Text style={styles.legendText}>BASELINE</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: MOOD_ACCENT }]} />
              <Text style={styles.legendText}>INTERVENTION</Text>
            </View>
          </View>
          {/* Simple visual representation */}
          <View style={styles.chartArea}>
            <View style={styles.chartLine}>
              {/* Baseline segment (dashed look) */}
              <View style={styles.baselineSegment} />
              {/* Intervention segment (solid accent) */}
              <View style={[
                styles.interventionSegment,
                isPositive && { borderColor: MOOD_ACCENT },
              ]} />
            </View>
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>DAY 1</Text>
              <Text style={styles.chartLabel}>PHASE SHIFT</Text>
              <Text style={styles.chartLabel}>DAY {exp.periodDays * 2}</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Phase Averages */}
      {isCompleted && (
        <GlassCard level={2} style={styles.averagesCard}>
          <Text style={styles.averagesTitle}>PHASE AVERAGES</Text>
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Baseline</Text>
            <Text style={styles.averageValue}>{exp.baselineAvg?.toFixed(1) ?? '--'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Intervention</Text>
            <Text style={[styles.averageValue, { color: MOOD_ACCENT }]}>
              {exp.interventionAvg?.toFixed(1) ?? '--'}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Correlation & Significance */}
      {isCompleted && exp.pearsonR != null && (
        <GlassCard level={2} style={styles.correlationCard}>
          <Text style={styles.correlationTitle}>CORRELATION & SIGNIFICANCE</Text>
          <View style={styles.correlationRow}>
            <Text style={styles.correlationLabel}>Pearson r</Text>
            <Text style={styles.correlationValue}>{exp.pearsonR.toFixed(2)}</Text>
          </View>
          <View style={styles.correlationRow}>
            <Text style={styles.correlationLabel}>P-Value</Text>
            <Text style={[styles.correlationValue, isSignificant && { color: MOOD_ACCENT }]}>
              {isSignificant ? '< 0.05' : '>= 0.05'}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Curator's Note / Conclusion */}
      {isCompleted && exp.conclusion && (
        <GlassCard level={2} style={styles.conclusionCard}>
          <View style={styles.conclusionIconWrap}>
            <Text style={styles.conclusionIcon}>{'\u{1F9D0}'}</Text>
          </View>
          <Text style={styles.conclusionTitle}>The Curator's Note</Text>
          <Text style={styles.conclusionText}>{exp.conclusion}</Text>
          {isSignificant && isPositive && (
            <GradientButton title="KEEP HABIT" onPress={() => router.back()} />
          )}
        </GlassCard>
      )}

      {/* Active Experiment Info */}
      {isActive && (
        <>
          <GlassCard level={2} style={styles.infoCard}>
            <Text style={styles.infoLabel}>HYPOTHESIS</Text>
            <Text style={styles.infoValue}>{exp.hypothesis}</Text>
          </GlassCard>

          <GlassCard level={2} style={styles.infoCard}>
            <Text style={styles.infoLabel}>INTERVENTION</Text>
            <Text style={styles.infoValue}>{exp.interventionDescription}</Text>
          </GlassCard>

          <GlassCard level={2} style={styles.infoCard}>
            <Text style={styles.infoLabel}>TIMELINE</Text>
            <Text style={styles.infoValue}>
              Baseline: {exp.baselineStart} to {exp.baselineEnd}
            </Text>
            <Text style={styles.infoValue}>
              Intervention: {exp.interventionStart} to {exp.interventionEnd}
            </Text>
          </GlassCard>
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {isActive && (
          <GradientButton title="Abandon Experiment" variant="danger" onPress={handleAbandon} />
        )}
        {isCompleted && !isSignificant && (
          <GradientButton
            title="Run Again"
            onPress={() => router.push('/(mood)/experiment-designer' as never)}
          />
        )}
        <GradientButton title="Back to Experiments" variant="secondary" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { padding: 20, paddingBottom: 120, gap: 16 },
  empty: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  // Header
  header: { gap: 8 },
  headerLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: MOOD_ACCENT,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },

  // Outcome
  outcomeCard: { gap: 8 },
  outcomeHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  outcomeIcon: { fontSize: 28 },
  outcomeTextWrap: { flex: 1, gap: 6 },
  outcomeTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 22,
    color: colors.text,
  },
  outcomeDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },

  // Big Diff
  bigDiffCard: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  bigDiffNumber: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 48,
    fontWeight: '700',
  },
  bigDiffLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },

  // Chart
  chartCard: { gap: 12 },
  chartTitle: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.text,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  chartArea: { gap: 8, paddingVertical: 8 },
  chartLine: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
  },
  baselineSegment: {
    flex: 1,
    height: 2,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderStyle: 'dashed',
  },
  interventionSegment: {
    flex: 1,
    height: 2,
    borderWidth: 2,
    borderColor: MOOD_ACCENT,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: colors.textSecondary,
  },

  // Averages
  averagesCard: { gap: 12 },
  averagesTitle: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  averageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  averageLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },
  averageValue: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: MOOD_SURFACES.focus,
  },

  // Correlation
  correlationCard: { gap: 12 },
  correlationTitle: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  correlationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  correlationLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  correlationValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },

  // Conclusion
  conclusionCard: { gap: 12, alignItems: 'center' },
  conclusionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conclusionIcon: { fontSize: 28 },
  conclusionTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  conclusionText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Active Info
  infoCard: { gap: 6 },
  infoLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  infoValue: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },

  // Actions
  actions: { gap: 8, marginTop: 8 },
});
