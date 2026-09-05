import { useMemo, useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getProject, deleteProject, getPhasesForProject, getPhotosForProject,
  getBudgetVsActual, getPhaseProgress,
  updatePhase,
  type PhaseStatus,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;
const PHASE_COLORS: Record<PhaseStatus, string> = {
  pending: colors.textTertiary, in_progress: ACCENT,
  completed: colors.success, skipped: colors.textTertiary,
};

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const project = useMemo(() => id ? getProject(db, id) : null, [db, id, tick]);
  const phases = useMemo(() => id ? getPhasesForProject(db, id) : [], [db, id, tick]);
  const photos = useMemo(() => id ? getPhotosForProject(db, id) : [], [db, id, tick]);

  if (!project) return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;

  const budget = getBudgetVsActual(project);
  const phaseProgress = getPhaseProgress(phases);
  const overBudget = budget.actualCostCents > budget.budgetCents && budget.budgetCents > 0;

  const handleDelete = () => {
    Alert.alert('Delete Project', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteProject(db, project.id); router.back(); } },
    ]);
  };

  const cyclePhaseStatus = (phaseId: string, currentStatus: PhaseStatus) => {
    const next: Record<PhaseStatus, PhaseStatus> = {
      pending: 'in_progress', in_progress: 'completed', completed: 'pending', skipped: 'pending',
    };
    updatePhase(db, phaseId, { status: next[currentStatus] });
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{project.name}</Text>
      {project.description && <Text variant="body" color={colors.textSecondary}>{project.description}</Text>}

      <View style={styles.badgeRow}>
        <View style={styles.badge}><Text variant="label" style={{ fontSize: 10 }}>{project.status.replace(/_/g, ' ')}</Text></View>
        <View style={styles.badge}><Text variant="label" style={{ fontSize: 10 }}>{project.priority}</Text></View>
        <View style={styles.badge}><Text variant="label" style={{ fontSize: 10 }}>{project.category}</Text></View>
      </View>

      {/* Budget */}
      {budget.budgetCents > 0 ? (
        <Card>
          <Text variant="subheading">Budget</Text>
          <View style={styles.budgetRow}>
            <Text variant="body">Budget: {fmt(budget.budgetCents)}</Text>
            <Text variant="body" color={overBudget ? colors.danger : colors.text}>Spent: {fmt(budget.actualCostCents)}</Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, {
              width: `${Math.min(100, Math.round((budget.actualCostCents / budget.budgetCents) * 100))}%`,
              backgroundColor: overBudget ? colors.danger : ACCENT,
            }]} />
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            {fmt(budget.remainingCents)} remaining ({budget.percentUsed}% used)
          </Text>
        </Card>
      ) : (
        <Card><Text variant="caption" color={colors.textSecondary}>No budget set</Text></Card>
      )}

      {/* Phases */}
      <View style={styles.section}>
        <Text variant="subheading">Phases ({phaseProgress.completed}/{phaseProgress.pending + phaseProgress.inProgress + phaseProgress.completed + phaseProgress.skipped})</Text>
        {phases.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>No phases added</Text>
        ) : (
          phases.sort((a, b) => a.sortOrder - b.sortOrder).map((phase) => (
            <Pressable key={phase.id} style={styles.phaseRow}
              onPress={() => cyclePhaseStatus(phase.id, phase.status)}>
              <View style={[styles.phaseDot, { backgroundColor: PHASE_COLORS[phase.status] }]} />
              <View style={{ flex: 1 }}>
                <Text variant="body">{phase.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {phase.status.replace(/_/g, ' ')}
                  {phase.budgetCents ? ` · ${fmt(phase.budgetCents)}` : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {/* Photos */}
      {photos.length > 0 && (
        <View style={styles.section}>
          <Text variant="subheading">Photos ({photos.length})</Text>
          <View style={styles.photoGrid}>
            {photos.slice(0, 6).map((p) => (
              <View key={p.id} style={styles.photoPlaceholder}>
                <Text variant="caption" color={colors.textSecondary}>{p.photoType}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/project/add?id=${id}`)}>
          <Text variant="label" color={ACCENT}>Edit</Text>
        </Pressable>
        <Pressable style={styles.deleteOutline} onPress={handleDelete}>
          <Text variant="label" color={colors.danger}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  badge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressContainer: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: spacing.xs },
  progressBar: { height: 6, borderRadius: 3 },
  section: { gap: spacing.xs },
  phaseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photoPlaceholder: {
    width: 80, height: 80, backgroundColor: colors.glass, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  editButton: { flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  deleteOutline: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
});
