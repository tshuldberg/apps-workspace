import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getProjectsForProperty, getActiveProjects, getProperties,
  getProjectSummary, getBudgetVsActual, getPhasesForProject,
  type ProjectStatus,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const STATUS_FILTERS: (ProjectStatus | 'all')[] = ['all', 'planning', 'in_progress', 'on_hold', 'completed'];
const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: colors.textSecondary, in_progress: ACCENT,
  on_hold: colors.warning, completed: colors.success, cancelled: colors.textTertiary,
};
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function ProjectTracker() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = propertyId ?? properties[0]?.id;
  const projects = useMemo(
    () => propId ? getProjectsForProperty(db, propId) : getActiveProjects(db),
    [db, propId],
  );
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  // Prefetch all phases to avoid N+1 queries in renderItem
  const phasesByProject = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getPhasesForProject>>();
    for (const p of projects) {
      map.set(p.id, getPhasesForProject(db, p.id));
    }
    return map;
  }, [db, projects]);

  return (
    <View style={styles.screen}>
      <View style={styles.chipRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text variant="label" color={filter === f ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const phases = phasesByProject.get(item.id) ?? [];
          const summary = phases.length > 0 ? getProjectSummary(item, phases) : null;
          const budget = getBudgetVsActual(item);
          const overBudget = budget.actualCostCents > budget.budgetCents && budget.budgetCents > 0;
          return (
            <Pressable onPress={() => router.push(`/(homes)/project/${item.id}`)}>
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text variant="subheading" style={{ flex: 1 }}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}20` }]}>
                    <Text variant="label" color={STATUS_COLORS[item.status]} style={{ fontSize: 10 }}>
                      {item.status.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View style={styles.catBadge}>
                    <Text variant="label" style={{ fontSize: 10 }}>{item.category}</Text>
                  </View>
                  <View style={styles.catBadge}>
                    <Text variant="label" style={{ fontSize: 10 }}>{item.priority}</Text>
                  </View>
                </View>
                {/* Progress bar */}
                {summary && (
                  <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${Math.round(summary.progressPercent)}%` }]} />
                  </View>
                )}
                {/* Budget */}
                {budget.budgetCents > 0 && (
                  <Text variant="caption" color={overBudget ? colors.danger : colors.textSecondary}>
                    {fmt(budget.budgetCents)} budget / {fmt(budget.actualCostCents)} spent
                  </Text>
                )}
                {item.startDate && item.targetEndDate && (
                  <Text variant="caption" color={colors.textSecondary}>
                    {item.startDate.slice(0, 10)} - {item.targetEndDate.slice(0, 10)}
                  </Text>
                )}
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>🔨</Text>
            <Text variant="body" color={colors.textSecondary}>No projects yet</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push(`/(homes)/project/add?propertyId=${propId}`)}>
              <Text variant="label" color={colors.background}>Plan Your First Renovation</Text>
            </Pressable>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push(`/(homes)/project/add?propertyId=${propId}`)}
        accessibilityLabel="Add project">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  catBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  progressContainer: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: 4, backgroundColor: ACCENT, borderRadius: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
