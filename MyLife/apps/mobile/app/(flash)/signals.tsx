import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getFlashDashboard,
  getStudySignal,
  type FlashDashboard,
  type StudySignal,
} from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#9B7DDB';

function readinessColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 50) return '#FF9F0A';
  return colors.danger;
}

export default function SignalsScreen() {
  const db = useDatabase();

  const dashboard: FlashDashboard | null = useMemo(() => {
    try { return getFlashDashboard(db); } catch { return null; }
  }, [db]);

  const signal: StudySignal | null = useMemo(() => {
    if (!dashboard) return null;
    try { return getStudySignal(dashboard, []); } catch { return null; }
  }, [dashboard]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Study Signals</Text>

      {signal && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>READINESS SCORE</Text>
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreValue, { color: readinessColor(signal.studyReadiness) }]}>
              {signal.studyReadiness}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>/ 100</Text>
          </View>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreFill, {
              width: `${signal.studyReadiness}%`,
              backgroundColor: readinessColor(signal.studyReadiness),
            }]} />
          </View>
        </Card>
      )}

      {signal && (
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Retention</Text>
            <Text style={styles.metricValue}>
              {(signal.retentionRate * 100).toFixed(0)}%
            </Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Streak</Text>
            <Text style={styles.metricValue}>{signal.currentStreak}d</Text>
          </Card>
        </View>
      )}

      {/* Cross-module signals placeholder */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>CROSS-MODULE SUGGESTIONS</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Flashcard suggestions from other modules will appear here when enabled.
        </Text>

        <View style={styles.signalList}>
          <SignalRow
            icon="📚"
            module="Words"
            description="Vocabulary from reading sessions"
          />
          <SignalRow
            icon="💊"
            module="Meds"
            description="Medication names and dosages"
          />
          <SignalRow
            icon="🌱"
            module="Garden"
            description="Plant care facts"
          />
          <SignalRow
            icon="🍳"
            module="Recipes"
            description="Cooking techniques and ingredients"
          />
        </View>
      </Card>

      {!dashboard && (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>📡</Text>
            <Text variant="body" color={colors.textSecondary}>No study data yet.</Text>
            <Text variant="caption" color={colors.textTertiary}>
              Start studying to see your signals dashboard.
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function SignalRow({ icon, module: mod, description }: { icon: string; module: string; description: string }) {
  return (
    <View style={styles.signalRow}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <View style={styles.signalInfo}>
        <Text variant="body">{mod}</Text>
        <Text variant="caption" color={colors.textSecondary}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  scoreContainer: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  scoreValue: { fontSize: 48, fontWeight: '700' },
  scoreBar: {
    height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  scoreFill: { height: 10, borderRadius: 5 },
  metricsGrid: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 24, fontWeight: '700' },
  signalList: { marginTop: spacing.sm, gap: spacing.sm },
  signalRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  signalInfo: { flex: 1, gap: 2 },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
});
