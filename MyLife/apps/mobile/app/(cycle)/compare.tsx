import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getCycles,
  getCycleDaysByCycle,
  type Cycle,
  type CycleDay,
} from '@mylife/cycle';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.cycle;

const PHASE_COLORS: Record<string, string> = {
  menstrual: '#E74C3C',
  follicular: '#2ECC71',
  ovulatory: '#3498DB',
  luteal: '#F1C40F',
};

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime();
  return Math.round(ms / 86400000);
}

export default function CompareScreen() {
  const db = useDatabase();

  const cycles: Cycle[] = useMemo(() => {
    try { return getCycles(db).slice(0, 6); } catch { return []; }
  }, [db]);

  const cycleDays = useMemo(() => {
    const map = new Map<string, CycleDay[]>();
    for (const cycle of cycles) {
      try {
        map.set(cycle.id, getCycleDaysByCycle(db, cycle.id));
      } catch {
        map.set(cycle.id, []);
      }
    }
    return map;
  }, [db, cycles]);

  const avgLength = useMemo(() => {
    const lengths = cycles.filter((c) => c.lengthDays != null).map((c) => c.lengthDays!);
    if (lengths.length === 0) return null;
    return Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length);
  }, [cycles]);

  if (cycles.length < 2) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text variant="subheading" color={colors.textSecondary}>Cycle Comparison</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Log at least 2 cycles to compare them side by side.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Compare Cycles</Text>

      {avgLength != null && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>AVERAGE</Text>
          <Text variant="body">Average cycle length: <Text style={{ color: ACCENT, fontWeight: '700' }}>{avgLength} days</Text></Text>
        </Card>
      )}

      {/* Comparison table */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>CYCLE COMPARISON</Text>
        <View style={styles.tableHeader}>
          <Text variant="caption" color={colors.textTertiary} style={styles.colLabel}>Cycle</Text>
          <Text variant="caption" color={colors.textTertiary} style={styles.colValue}>Length</Text>
          <Text variant="caption" color={colors.textTertiary} style={styles.colValue}>Period</Text>
          <Text variant="caption" color={colors.textTertiary} style={styles.colValue}>Start</Text>
        </View>
        {cycles.map((cycle, i) => {
          const lengthDiff = avgLength != null && cycle.lengthDays != null
            ? cycle.lengthDays - avgLength
            : null;
          return (
            <View key={cycle.id} style={styles.tableRow}>
              <Text variant="body" style={styles.colLabel}>#{i + 1}</Text>
              <View style={styles.colValue}>
                <Text variant="body">
                  {cycle.lengthDays ?? '--'}d
                </Text>
                {lengthDiff != null && lengthDiff !== 0 && (
                  <Text variant="iconCaption" color={Math.abs(lengthDiff) > 5 ? colors.danger : '#FF9F0A'}>
                    ({lengthDiff > 0 ? '+' : ''}{lengthDiff})
                  </Text>
                )}
              </View>
              <Text variant="body" style={styles.colValue}>
                {cycle.periodLength ?? '--'}d
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.colValue}>
                {cycle.startDate}
              </Text>
            </View>
          );
        })}
      </Card>

      {/* Timeline overlay */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>TIMELINE OVERLAY</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Aligned by period start date
        </Text>
        {cycles.map((cycle, i) => {
          const maxLen = Math.max(...cycles.map((c) => c.lengthDays ?? 28));
          const len = cycle.lengthDays ?? 28;
          const periodLen = cycle.periodLength ?? 5;
          const periodPct = (periodLen / maxLen) * 100;
          const restPct = ((len - periodLen) / maxLen) * 100;

          return (
            <View key={cycle.id} style={styles.timelineRow}>
              <Text variant="iconCaption" color={colors.textTertiary} style={styles.timelineLabel}>
                #{i + 1}
              </Text>
              <View style={styles.timelineBar}>
                <View style={[styles.timelineSegment, { width: `${periodPct}%`, backgroundColor: PHASE_COLORS.menstrual }]} />
                <View style={[styles.timelineSegment, { width: `${restPct}%`, backgroundColor: PHASE_COLORS.follicular }]} />
              </View>
              <Text variant="iconCaption" color={colors.textTertiary}>
                {len}d
              </Text>
            </View>
          );
        })}

        <View style={styles.legend}>
          {Object.entries(PHASE_COLORS).map(([phase, clr]) => (
            <View key={phase} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: clr }]} />
              <Text variant="iconCaption" color={colors.textTertiary}>{phase}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
    alignItems: 'center',
  },
  colLabel: { width: 50 },
  colValue: { flex: 1 },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  timelineLabel: { width: 24 },
  timelineBar: {
    flex: 1, height: 16, borderRadius: 4, flexDirection: 'row', overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  timelineSegment: { height: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
