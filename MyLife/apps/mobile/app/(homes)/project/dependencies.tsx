import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getActiveProjects,
  getPhasesForProject,
  getBudgetVsActual,
  getPhaseProgress,
} from '@mylife/homes';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.homes;
const STATUS_COLORS: Record<string, string> = {
  planned: colors.textTertiary,
  pending: colors.textTertiary,
  in_progress: ACCENT,
  blocked: colors.danger,
  completed: colors.success,
  skipped: colors.textTertiary,
};

export default function ProjectDependenciesScreen() {
  const db = useDatabase();
  const projects = useMemo(() => getActiveProjects(db), [db]);

  if (projects.length === 0) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📊</Text>
          <Text style={styles.emptyTitle}>No Active Projects</Text>
          <Text style={styles.emptyText}>Start a home improvement project to see timelines here.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Project Timeline</Text>

      {projects.map((project) => {
        const phases = getPhasesForProject(db, project.id);
        const budget = getBudgetVsActual(project);
        const progress = getPhaseProgress(phases);
        const totalPhases = progress.pending + progress.inProgress + progress.completed + progress.skipped;
        const completePct = totalPhases > 0 ? Math.round((progress.completed / totalPhases) * 100) : 0;

        return (
          <Card key={project.id} style={styles.projectCard}>
            <Text style={styles.projectName}>{project.name}</Text>
            <Text style={styles.projectMeta}>
              {project.status} {'\u00B7'} {phases.length} phases
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${completePct}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{completePct}% complete</Text>

            {/* Budget */}
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Budget</Text>
              <Text style={styles.budgetValue}>
                ${Math.round(budget.actualCostCents / 100).toLocaleString()} / ${Math.round(budget.budgetCents / 100).toLocaleString()}
              </Text>
            </View>

            {/* Phases Timeline */}
            {phases.map((phase) => (
              <View key={phase.id} style={styles.phaseRow}>
                <View style={[styles.phaseDot, { backgroundColor: STATUS_COLORS[phase.status] ?? colors.border }]} />
                <View style={styles.phaseInfo}>
                  <Text style={styles.phaseName}>{phase.name}</Text>
                  <Text style={styles.phaseDates}>
                    {phase.startDate?.slice(0, 10) ?? 'TBD'} - {phase.endDate?.slice(0, 10) ?? 'TBD'}
                  </Text>
                </View>
                <View style={[styles.phaseStatusBadge, { backgroundColor: STATUS_COLORS[phase.status] ?? colors.glassStrong }]}>
                  <Text style={styles.phaseStatusText}>{phase.status.replace('_', ' ')}</Text>
                </View>
              </View>
            ))}
          </Card>
        );
      })}
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
  projectCard: { padding: spacing.md, gap: spacing.sm },
  projectName: { fontSize: 18, fontWeight: '700', color: colors.text },
  projectMeta: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
  progressBarBg: { width: '100%', height: 6, backgroundColor: colors.surface, borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  progressLabel: { fontSize: 11, color: colors.textTertiary },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetLabel: { fontSize: 13, color: colors.textSecondary },
  budgetValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  phaseInfo: { flex: 1 },
  phaseName: { fontSize: 14, color: colors.text },
  phaseDates: { fontSize: 11, color: colors.textTertiary },
  phaseStatusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  phaseStatusText: { fontSize: 9, color: colors.background, fontWeight: '600', textTransform: 'capitalize' },
});
