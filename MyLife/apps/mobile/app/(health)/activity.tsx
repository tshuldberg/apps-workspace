import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getActivitySummaryByDate,
  getActivityHistory,
  calculateAllRingProgress,
  calculateStreak,
} from '@mylife/health';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.health;

export default function ActivityScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const todaySummary = useMemo(() => getActivitySummaryByDate(db, today), [db, today]);
  const history = useMemo(() => getActivityHistory(db, 30), [db]);
  const streak = useMemo(() => calculateStreak(history), [history]);

  const rings = todaySummary ? calculateAllRingProgress(todaySummary) : null;

  // Weekly totals
  const weekHistory = history.slice(0, 7);
  const weekSteps = weekHistory.reduce((s, d) => s + d.steps, 0);
  const weekCals = weekHistory.reduce((s, d) => s + d.active_energy_cal, 0);
  const weekMins = weekHistory.reduce((s, d) => s + d.move_minutes, 0);

  // Personal records
  const bestSteps = history.length > 0 ? Math.max(...history.map((d) => d.steps)) : 0;
  const bestCals = history.length > 0 ? Math.max(...history.map((d) => d.active_energy_cal)) : 0;

  if (!todaySummary && history.length === 0) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>🏃</Text>
          <Text style={styles.emptyTitle}>No Activity Data</Text>
          <Text style={styles.emptyText}>Sync with Apple Health to see your activity dashboard.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Rings */}
      {todaySummary && rings && (
        <Card style={styles.ringsCard}>
          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.ringsRow}>
            <RingDisplay label="Steps" current={todaySummary.steps} goal={todaySummary.steps_goal} progress={rings.steps} color="#FF453A" />
            <RingDisplay label="Calories" current={Math.round(todaySummary.active_energy_cal)} goal={Math.round(todaySummary.active_energy_goal)} progress={rings.activeEnergy} color="#30D158" />
            <RingDisplay label="Minutes" current={todaySummary.move_minutes} goal={todaySummary.move_minutes_goal} progress={rings.moveMinutes} color="#0A84FF" />
          </View>
        </Card>
      )}

      {/* Weekly Summary */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <StatRow label="Total Steps" value={weekSteps.toLocaleString()} />
        <StatRow label="Active Calories" value={`${Math.round(weekCals).toLocaleString()} cal`} />
        <StatRow label="Exercise Minutes" value={`${weekMins} min`} />
        <StatRow label="Active Streak" value={`${streak} day${streak !== 1 ? 's' : ''}`} />
      </Card>

      {/* Day-by-Day */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Breakdown</Text>
        {weekHistory.map((d) => {
          const stepPct = d.steps_goal > 0 ? Math.min(100, Math.round((d.steps / d.steps_goal) * 100)) : 0;
          return (
            <View key={d.id} style={styles.dayRow}>
              <Text style={styles.dayDate}>{d.date.slice(5)}</Text>
              <View style={styles.dayBarBg}>
                <View style={[styles.dayBarFill, { width: `${stepPct}%` }]} />
              </View>
              <Text style={styles.daySteps}>{d.steps.toLocaleString()}</Text>
            </View>
          );
        })}
      </Card>

      {/* Personal Records */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Records</Text>
        <StatRow label="Most Steps" value={bestSteps.toLocaleString()} />
        <StatRow label="Highest Calorie Burn" value={`${Math.round(bestCals).toLocaleString()} cal`} />
      </Card>

      {/* 30-Day Adherence */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>30-Day Goal Adherence</Text>
        {(() => {
          const met = history.filter((d) => d.steps >= d.steps_goal).length;
          const pct = history.length > 0 ? Math.round((met / history.length) * 100) : 0;
          return (
            <>
              <View style={styles.adherenceRow}>
                <Text style={styles.adherenceValue}>{pct}%</Text>
                <Text style={styles.adherenceLabel}>{met}/{history.length} days goal met</Text>
              </View>
              <View style={styles.adherenceBarBg}>
                <View style={[styles.adherenceBarFill, { width: `${pct}%` }]} />
              </View>
            </>
          );
        })()}
      </Card>
    </ScrollView>
  );
}

function RingDisplay({ label, current, goal, progress, color }: {
  label: string; current: number; goal: number; progress: number; color: string;
}) {
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.ringItem}>
      <View style={[styles.ringCircle, { borderColor: color }]}>
        <Text style={[styles.ringPct, { color }]}>{pct}%</Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
      <Text style={styles.ringValue}>{current.toLocaleString()}/{goal.toLocaleString()}</Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  ringsCard: { padding: spacing.md, gap: spacing.md },
  ringsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ringItem: { alignItems: 'center', gap: 4 },
  ringCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 16, fontWeight: '700' },
  ringLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  ringValue: { fontSize: 10, color: colors.textTertiary },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  statLabel: { fontSize: 14, color: colors.textSecondary },
  statValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  dayDate: { fontSize: 12, color: colors.textSecondary, width: 40 },
  dayBarBg: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3 },
  dayBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  daySteps: { fontSize: 12, fontWeight: '600', color: colors.text, width: 50, textAlign: 'right' },
  adherenceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  adherenceValue: { fontSize: 28, fontWeight: '700', color: ACCENT },
  adherenceLabel: { fontSize: 13, color: colors.textSecondary },
  adherenceBarBg: { width: '100%', height: 8, backgroundColor: colors.surface, borderRadius: 4 },
  adherenceBarFill: { height: 8, backgroundColor: ACCENT, borderRadius: 4 },
});
