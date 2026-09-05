import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getAllActiveSchedules, getProperties, calculateScheduleStatus,
  sortByUrgency, getTaskTypeLabel, markComplete, updateSchedule,
  type ScheduleWithStatus, type ScheduleStatus,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const STATUS_COLORS: Record<ScheduleStatus, string> = {
  overdue: colors.danger, due_soon: ACCENT, ok: colors.success, unknown: colors.textTertiary,
};
const STATUS_LABELS: Record<ScheduleStatus, string> = {
  overdue: 'Overdue', due_soon: 'Due Soon', ok: 'OK', unknown: 'Unknown',
};

export default function MaintenanceTab() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const [filter, setFilter] = useState<ScheduleStatus | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);

  const properties = useMemo(() => getProperties(db), [db, tick]);
  const raw = useMemo(() => getAllActiveSchedules(db), [db, tick]);
  const withStatus: ScheduleWithStatus[] = useMemo(
    () => raw.map((s) => ({ ...s, status: calculateScheduleStatus(s.nextDueDate) })),
    [raw],
  );
  const sorted = sortByUrgency(withStatus);

  const filtered = sorted.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (propertyFilter && s.propertyId !== propertyFilter) return false;
    return true;
  });

  const sections = (['overdue', 'due_soon', 'ok', 'unknown'] as ScheduleStatus[])
    .map((status) => ({
      title: STATUS_LABELS[status],
      color: STATUS_COLORS[status],
      data: filtered.filter((s) => s.status === status),
    }))
    .filter((s) => s.data.length > 0);

  const handleComplete = (schedule: ScheduleWithStatus) => {
    const result = markComplete(schedule);
    updateSchedule(db, schedule.id, {
      lastCompletedDate: result.lastCompletedDate,
      nextDueDate: result.nextDueDate,
      snoozeDays: 0, snoozeCount: 0,
    });
    refresh();
  };

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? '';

  if (raw.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text variant="heading" style={styles.emptyTitle}>All caught up</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>
          Your home maintenance is on track.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(homes)/maintenance/add')}>
          <Text variant="label" color={colors.background}>Add a Task</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Filter chips */}
      <View style={styles.chipRow}>
        {(['all', 'overdue', 'due_soon', 'ok'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text variant="label" color={filter === f ? colors.background : colors.textSecondary}>
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Property filter */}
      {properties.length > 1 && (
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, !propertyFilter && styles.chipActive]}
            onPress={() => setPropertyFilter(null)}
          >
            <Text variant="label" color={!propertyFilter ? colors.background : colors.textSecondary}>All Properties</Text>
          </Pressable>
          {properties.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.chip, propertyFilter === p.id && styles.chipActive]}
              onPress={() => setPropertyFilter(p.id)}
            >
              <Text variant="label" color={propertyFilter === p.id ? colors.background : colors.textSecondary}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Text variant="label" color={section.color} style={styles.sectionHeader}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(homes)/maintenance/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
                <View style={styles.cardContent}>
                  <Text variant="subheading">{getTaskTypeLabel(item.taskType, item.taskTypeCustom)}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{propName(item.propertyId)}</Text>
                </View>
                <Text variant="caption" color={STATUS_COLORS[item.status]}>
                  {item.nextDueDate?.slice(0, 10) ?? 'No date'}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable style={styles.ghostButton} onPress={() => handleComplete(item)}>
                  <Text variant="label" color={colors.success}>Mark Done</Text>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(homes)/maintenance/add')}
        accessibilityLabel="Add new task"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chipRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.glassStrong, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: ACCENT },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  sectionHeader: { marginTop: spacing.md, marginBottom: spacing.xs },
  card: { marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardContent: { flex: 1, gap: 2 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
  ghostButton: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: 4, borderWidth: 1, borderColor: colors.success,
  },
  emptyContainer: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
  emptyBody: { textAlign: 'center', marginBottom: spacing.lg },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
