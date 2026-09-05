import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getActiveExperiment,
  getExperiments,
  getTemplates,
  type Experiment,
  type ExperimentTemplate,
  GlassCard,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z');
  const b = new Date(end + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function daysRemaining(exp: Experiment): number {
  const today = new Date().toISOString().slice(0, 10);
  const totalEnd = exp.interventionEnd;
  const d = daysBetween(today, totalEnd);
  return Math.max(0, d);
}

function experimentProgress(exp: Experiment): number {
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = daysBetween(exp.baselineStart, exp.interventionEnd);
  const elapsed = daysBetween(exp.baselineStart, today > exp.interventionEnd ? exp.interventionEnd : today);
  return Math.min(1, Math.max(0, elapsed / totalDays));
}

function phaseLabel(exp: Experiment): string {
  if (exp.status === 'baseline') return 'BASELINE';
  if (exp.status === 'intervention') return 'INTERVENTION';
  if (exp.status === 'draft') return 'DRAFT';
  return exp.status.toUpperCase();
}

const CATEGORY_ICONS: Record<string, string> = {
  exercise: '\u{1F3CB}',
  sleep: '\u{1F634}',
  mindfulness: '\u{1F9D8}',
  social: '\u{1F465}',
  nutrition: '\u{1F34E}',
  digital: '\u{1F4F1}',
};

export default function ExperimentsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [active, setActive] = useState<Experiment | null>(null);
  const [past, setPast] = useState<Experiment[]>([]);
  const [templates, setTemplates] = useState<ExperimentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    try {
      const activeExp = getActiveExperiment(db);
      setActive(activeExp);
      const allExps = getExperiments(db);
      setPast(allExps.filter((e) => e.status === 'completed' || e.status === 'abandoned'));
      setTemplates(getTemplates(db));
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <Text variant="body" color={colors.textSecondary}>Loading experiments...</Text>
      </View>
    );
  }

  const progress = active ? experimentProgress(active) : 0;
  const remaining = active ? daysRemaining(active) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Obsidian Protocol Banner */}
      <GlassCard level={2} style={styles.protocolBanner}>
        <View style={styles.protocolHeader}>
          <Text style={styles.protocolTitle}>THE OBSIDIAN PROTOCOL</Text>
          <Text style={styles.flaskIcon}>{'\u{1F9EA}'}</Text>
        </View>
        <Text style={styles.protocolDescription}>
          A/B testing for your life. We compare baseline periods with active interventions to isolate what actually impacts your emotional state.
        </Text>
      </GlassCard>

      {/* Active Protocol */}
      {active && (
        <>
          <View style={styles.activeLabelRow}>
            <Text style={styles.sectionLabel}>ACTIVE PROTOCOL</Text>
            <View style={styles.remainingBadge}>
              <Text style={styles.remainingText}>{remaining} DAYS REMAINING</Text>
            </View>
          </View>

          <GlassCard
            level={3}
            style={styles.activeCard}
            onPress={() => router.push(`/(mood)/experiment-results?id=${active.id}` as never)}
          >
            <View style={styles.activeTopRow}>
              <View style={styles.activeInfo}>
                <Text style={styles.activeTitle}>{active.hypothesis}</Text>
                <View style={[
                  styles.phaseBadge,
                  { backgroundColor: active.status === 'intervention' ? 'rgba(34,197,94,0.15)' : 'rgba(139,207,240,0.15)' },
                ]}>
                  <Text style={[
                    styles.phaseBadgeText,
                    { color: active.status === 'intervention' ? colors.success : '#8BCFF0' },
                  ]}>
                    {phaseLabel(active)}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.goalText}>Goal: Identify trigger threshold</Text>

            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>PROTOCOL PROGRESS</Text>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>{'\u{26A1}'}</Text>
                <View>
                  <Text style={styles.statLabel}>ACTION</Text>
                  <Text style={styles.statValue}>{active.interventionDescription}</Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>{'\u{1F4CA}'}</Text>
                <View>
                  <Text style={styles.statLabel}>TRACKING</Text>
                  <Text style={styles.statValue}>Mood Score</Text>
                </View>
              </View>
            </View>
          </GlassCard>
        </>
      )}

      {/* Archived Insights */}
      {past.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>ARCHIVED INSIGHTS</Text>
          {past.map((exp) => {
            const isSuccess = exp.isSignificant === true && exp.scoreDiff != null && exp.scoreDiff > 0;
            const isInconclusive = exp.isSignificant !== true;
            const outcomeLabel = exp.status === 'abandoned'
              ? 'ABANDONED'
              : isSuccess
                ? 'SUCCESS'
                : 'INCONCLUSIVE';
            const outcomeColor = exp.status === 'abandoned'
              ? colors.textSecondary
              : isSuccess
                ? colors.success
                : colors.textSecondary;

            const correlationLabel = isSuccess
              ? 'POSITIVE CORRELATION'
              : isInconclusive
                ? 'NO OBSERVED EFFECT'
                : 'NEGATIVE CORRELATION';

            return (
              <GlassCard
                key={exp.id}
                level={2}
                style={styles.archivedCard}
                onPress={() => router.push(`/(mood)/experiment-results?id=${exp.id}` as never)}
              >
                <View style={styles.archivedTopRow}>
                  <Text style={styles.archivedIcon}>
                    {exp.templateId ? (CATEGORY_ICONS[exp.templateId] ?? '\u{1F9EA}') : '\u{1F9EA}'}
                  </Text>
                  <Text style={[styles.outcomeBadgeText, { color: outcomeColor }]}>
                    {outcomeLabel}
                  </Text>
                </View>
                <Text style={styles.archivedTitle}>{exp.hypothesis}</Text>
                <Text style={styles.archivedDetail}>{exp.interventionDescription}</Text>
                <View style={styles.correlationRow}>
                  <Text style={styles.correlationIcon}>
                    {isSuccess ? '\u{1F4C8}' : '\u{003D}'}
                  </Text>
                  <Text style={styles.correlationText}>{correlationLabel}</Text>
                </View>
              </GlassCard>
            );
          })}
        </>
      )}

      {/* Empty State */}
      {!active && past.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, textAlign: 'center' }}>{'\u{1F9EA}'}</Text>
          <Text style={styles.emptyTitle}>Run your first experiment</Text>
          <Text style={styles.emptyDescription}>
            Test whether a lifestyle change actually improves your mood with structured A/B experiments.
          </Text>
        </View>
      )}

      {/* New Experiment Button */}
      <View style={styles.newButtonContainer}>
        <GradientButton
          title="+ NEW EXPERIMENT"
          onPress={() => router.push('/(mood)/experiment-designer' as never)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { padding: 20, paddingBottom: 120, gap: 16 },

  // Protocol Banner
  protocolBanner: { gap: 8 },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  protocolTitle: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.text,
    fontSize: 13,
    letterSpacing: 0.05 * 13,
  },
  flaskIcon: { fontSize: 20 },
  protocolDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Active Protocol
  activeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  remainingBadge: {
    backgroundColor: 'rgba(251,146,60,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  remainingText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
  },
  activeCard: { gap: 12 },
  activeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeInfo: { flex: 1, gap: 8 },
  activeTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 22,
    color: colors.text,
  },
  phaseBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phaseBadgeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
  },
  goalText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  progressPercent: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: MOOD_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: MOOD_ACCENT,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 12,
    padding: 12,
  },
  statIcon: { fontSize: 18 },
  statLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: colors.textSecondary,
  },
  statValue: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.text,
  },

  // Archived Insights
  archivedCard: { gap: 6, marginTop: 4 },
  archivedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archivedIcon: { fontSize: 22 },
  outcomeBadgeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
  },
  archivedTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  archivedDetail: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  correlationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  correlationIcon: { fontSize: 14 },
  correlationText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    textAlign: 'center',
  },
  emptyDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // New Experiment Button
  newButtonContainer: {
    marginTop: 8,
  },
});
