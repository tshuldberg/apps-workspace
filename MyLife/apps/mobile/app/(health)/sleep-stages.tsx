import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getLastNightSleep,
  getSleepSessions,
  calculateStageBreakdown,
  evaluateStageTargets,
  calculateSleepEfficiency,
  computeQualityScore,
} from '@mylife/health';
import { Card, Text, EmptyState, LoadingState, ErrorState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.health;
const STAGE_COLORS: Record<string, string> = {
  deep: '#6366F1',
  rem: '#F472B6',
  light: '#38BDF8',
  awake: colors.warning,
};

export default function SleepStagesScreen() {
  const db = useDatabase();
  const lastNight = useMemo(() => getLastNightSleep(db), [db]);
  const recentSessions = useMemo(() => getSleepSessions(db, 7), [db]);

  const breakdown = lastNight ? calculateStageBreakdown({
    duration_minutes: lastNight.duration_minutes,
    deep_minutes: lastNight.deep_minutes,
    rem_minutes: lastNight.rem_minutes,
    light_minutes: lastNight.light_minutes,
    awake_minutes: lastNight.awake_minutes,
  }) : null;

  const targets = breakdown ? evaluateStageTargets(breakdown) : [];
  const efficiency = lastNight
    ? calculateSleepEfficiency(lastNight.duration_minutes, lastNight.awake_minutes ?? 0)
    : 0;
  const qualityScore = lastNight
    ? computeQualityScore(lastNight.duration_minutes, lastNight.deep_minutes, lastNight.rem_minutes, lastNight.awake_minutes)
    : 0;

  if (!lastNight) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="😴"
          title="No Sleep Data"
          message="Sync sleep data from Apple Health to see stage breakdowns."
          accentColor={ACCENT}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Sleep Score */}
      <Card style={styles.heroCard}>
        <Text style={styles.heroValue}>{qualityScore}</Text>
        <Text style={styles.heroLabel}>Sleep Score</Text>
        <Text style={styles.heroSub}>
          {Math.floor(lastNight.duration_minutes / 60)}h {lastNight.duration_minutes % 60}m total
        </Text>
      </Card>

      {/* Stage Breakdown */}
      {breakdown && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Stage Breakdown</Text>
          <View style={styles.barStack}>
            {([
              { key: 'deep', pct: breakdown.deepPercent },
              { key: 'rem', pct: breakdown.remPercent },
              { key: 'light', pct: breakdown.lightPercent },
              { key: 'awake', pct: breakdown.awakePercent },
            ] as const).map((s) => {
              if (s.pct <= 0) return null;
              return (
                <View key={s.key} style={[styles.barSegment, { flex: s.pct, backgroundColor: STAGE_COLORS[s.key] }]} />
              );
            })}
          </View>
          <View style={styles.legendGrid}>
            {([
              { key: 'deep', min: breakdown.deepMinutes, pct: breakdown.deepPercent },
              { key: 'rem', min: breakdown.remMinutes, pct: breakdown.remPercent },
              { key: 'light', min: breakdown.lightMinutes, pct: breakdown.lightPercent },
              { key: 'awake', min: breakdown.awakeMinutes, pct: breakdown.awakePercent },
            ] as const).map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STAGE_COLORS[s.key] }]} />
                <Text style={styles.legendLabel}>{s.key}</Text>
                <Text style={styles.legendValue}>{s.min}m ({s.pct}%)</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Stage Targets */}
      {targets.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>vs Ideal Ranges</Text>
          {targets.map((t) => (
            <View key={t.stage} style={styles.targetRow}>
              <View style={[styles.legendDot, { backgroundColor: STAGE_COLORS[t.stage] }]} />
              <Text style={styles.targetStage}>{t.stage}</Text>
              <Text style={styles.targetPct}>{t.actualPercent}%</Text>
              <Text style={styles.targetRange}>(ideal: {t.targetMinPercent}-{t.targetMaxPercent}%)</Text>
              <Text style={[styles.targetStatus, {
                color: t.status === 'normal' ? colors.success : t.status === 'low' ? colors.danger : colors.warning,
              }]}>
                {t.status}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Efficiency */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Sleep Efficiency</Text>
        <View style={styles.effRow}>
          <Text style={styles.effValue}>{efficiency}%</Text>
          <Text style={styles.effLabel}>Time in bed vs actual sleep</Text>
        </View>
      </Card>

      {/* 7-Day History */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>7-Day History</Text>
        {recentSessions.map((s) => (
          <View key={s.id} style={styles.histRow}>
            <Text style={styles.histDate}>{s.start_time.slice(0, 10)}</Text>
            <Text style={styles.histDuration}>
              {Math.floor(s.duration_minutes / 60)}h {s.duration_minutes % 60}m
            </Text>
            <Text style={styles.histScore}>
              {computeQualityScore(s.duration_minutes, s.deep_minutes, s.rem_minutes, s.awake_minutes)}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  heroCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  heroValue: { fontSize: 48, fontWeight: '800', color: ACCENT },
  heroLabel: { fontSize: 14, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  heroSub: { fontSize: 14, color: colors.textTertiary },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  barStack: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden' },
  barSegment: { height: 16 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: '45%' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize', width: 40 },
  legendValue: { fontSize: 12, fontWeight: '600', color: colors.text },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  targetStage: { fontSize: 13, color: colors.text, textTransform: 'capitalize', width: 50 },
  targetPct: { fontSize: 13, fontWeight: '600', color: colors.text, width: 40 },
  targetRange: { fontSize: 11, color: colors.textTertiary, flex: 1 },
  targetStatus: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  effRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  effValue: { fontSize: 28, fontWeight: '700', color: ACCENT },
  effLabel: { fontSize: 14, color: colors.textSecondary },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontSize: 13, color: colors.textSecondary, width: 90 },
  histDuration: { fontSize: 13, color: colors.text, flex: 1 },
  histScore: { fontSize: 13, fontWeight: '600', color: ACCENT },
});
