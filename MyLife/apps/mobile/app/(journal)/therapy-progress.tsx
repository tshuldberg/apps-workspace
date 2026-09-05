import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  listCompletedThoughtRecords,
  getDistortionFrequency,
  computeThoughtRecordCompletionRate,
  computeAvgBeliefReduction,
} from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.journal;

export default function TherapyProgressScreen() {
  const db = useDatabase();
  const records = useMemo(() => listCompletedThoughtRecords(db), [db]);
  const distFreq = useMemo(() => getDistortionFrequency(db), [db]);

  const completionRate = useMemo(() => computeThoughtRecordCompletionRate(records), [records]);
  const avgReduction = useMemo(() => computeAvgBeliefReduction(records), [records]);

  if (records.length === 0) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📈</Text>
          <Text style={styles.emptyTitle}>No Thought Records</Text>
          <Text style={styles.emptyText}>
            Complete CBT thought records to track your therapeutic progress.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Therapeutic Progress</Text>

      {/* Summary Stats */}
      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>Records</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(completionRate * 100)}%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{avgReduction.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Belief Reduction</Text>
          </View>
        </View>
      </Card>

      {/* Distortion Frequency */}
      {distFreq.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Top Distortions</Text>
          {distFreq.slice(0, 8).map((d) => {
            const maxCount = distFreq[0]?.count ?? 1;
            return (
              <View key={d.distortionType} style={styles.distRow}>
                <Text style={styles.distName}>{d.distortionType.replace(/_/g, ' ')}</Text>
                <View style={styles.distBarBg}>
                  <View style={[styles.distBarFill, { width: `${(d.count / maxCount) * 100}%` }]} />
                </View>
                <Text style={styles.distCount}>{d.count}</Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Record History */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Records</Text>
        {records.slice(0, 10).map((r) => (
          <View key={r.id} style={styles.recordRow}>
            <Text style={styles.recordSituation} numberOfLines={1}>{r.situation ?? 'Untitled'}</Text>
            <Text style={styles.recordDate}>{r.createdAt.slice(0, 10)}</Text>
          </View>
        ))}
      </Card>

      {/* Milestones */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Milestones</Text>
        {[10, 25, 50, 100].map((milestone) => {
          const reached = records.length >= milestone;
          return (
            <View key={milestone} style={styles.milestoneRow}>
              <Text style={{ fontSize: 16, color: reached ? colors.success : colors.textTertiary }}>
                {reached ? '\u2713' : '\u25CB'}
              </Text>
              <Text style={[styles.milestoneText, reached ? { color: colors.text } : null]}>
                {milestone} thought records completed
              </Text>
            </View>
          );
        })}
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
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  statsCard: { padding: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: ACCENT },
  statLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  distName: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize', width: 100 },
  distBarBg: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3 },
  distBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  distCount: { fontSize: 12, fontWeight: '600', color: colors.text, width: 24, textAlign: 'right' },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  recordSituation: { fontSize: 13, color: colors.text, flex: 1 },
  recordDate: { fontSize: 12, color: colors.textTertiary },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  milestoneText: { fontSize: 14, color: colors.textSecondary },
});
