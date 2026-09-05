import { useMemo, useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getSchedule, getProperty, updateSchedule, deactivateSchedule,
  calculateScheduleStatus, getTaskTypeLabel, markComplete,
  getCostEntriesForSchedule, getLifetimeCosts,
  getContractorForTaskType, getAllContractors,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const STATUS_COLORS: Record<string, string> = {
  overdue: colors.danger, due_soon: ACCENT, ok: colors.success, unknown: colors.textTertiary,
};

export default function ScheduleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const schedule = useMemo(() => id ? getSchedule(db, id) : null, [db, id, tick]);
  const property = useMemo(
    () => schedule ? getProperty(db, schedule.propertyId) : null,
    [db, schedule?.propertyId, tick],
  );
  const status = schedule ? calculateScheduleStatus(schedule.nextDueDate) : 'unknown';

  // Linked data
  const linkedCosts = useMemo(() => id ? getCostEntriesForSchedule(db, id) : [], [db, id, tick]);
  const allContractors = useMemo(() => getAllContractors(db), [db, tick]);
  const recommended = schedule
    ? getContractorForTaskType(allContractors, schedule.taskType)
    : [];

  const handleComplete = () => {
    if (!schedule) return;
    const result = markComplete(schedule);
    updateSchedule(db, schedule.id, {
      lastCompletedDate: result.lastCompletedDate,
      nextDueDate: result.nextDueDate,
      snoozeDays: 0, snoozeCount: 0,
    });
    refresh();
  };

  const handleSnooze = () => {
    if (!schedule) return;
    if (schedule.snoozeDays + 7 > 365) {
      Alert.alert('Snooze Limit', 'Maximum cumulative snooze of 365 days reached.');
      return;
    }
    updateSchedule(db, schedule.id, {
      snoozeDays: schedule.snoozeDays + 7,
      snoozeCount: schedule.snoozeCount + 1,
    });
    refresh();
  };

  const handleDeactivate = () => {
    Alert.alert('Deactivate Task', 'This task will no longer appear in your schedule.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', onPress: () => { if (id) { deactivateSchedule(db, id); router.back(); } } },
    ]);
  };

  if (!schedule) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="body" color={colors.textSecondary}>Task not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text variant="heading">{getTaskTypeLabel(schedule.taskType, schedule.taskTypeCustom)}</Text>
      <Text variant="body" color={colors.textSecondary}>{property?.name ?? ''}</Text>

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[status]}20` }]}>
        <Text variant="label" color={STATUS_COLORS[status]}>
          {status.replace(/_/g, ' ').toUpperCase()}
        </Text>
      </View>

      {/* Key facts */}
      <Card style={styles.factsCard}>
        <FactRow label="Interval" value={`Every ${schedule.intervalMonths} months`} />
        {schedule.seasonPreference && (
          <FactRow label="Season" value={schedule.seasonPreference} />
        )}
        <FactRow label="Last Completed" value={schedule.lastCompletedDate?.slice(0, 10) ?? 'Never'} />
        <FactRow label="Next Due" value={schedule.nextDueDate?.slice(0, 10) ?? 'Not set'} />
        {schedule.snoozeDays > 0 && (
          <FactRow
            label="Snoozed"
            value={`${schedule.snoozeDays} days (${schedule.snoozeCount} times)`}
          />
        )}
        {schedule.notes && <FactRow label="Notes" value={schedule.notes} />}
      </Card>

      {/* Linked Costs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Cost History</Text>
          <Pressable onPress={() => router.push(`/(homes)/cost/add?scheduleId=${id}&propertyId=${schedule.propertyId}`)}>
            <Text variant="label" color={ACCENT}>+ Add</Text>
          </Pressable>
        </View>
        {linkedCosts.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>No costs recorded</Text>
        ) : (
          <>
            <Text variant="body" color={ACCENT}>
              Total: ${Math.round(getLifetimeCosts(linkedCosts) / 100).toLocaleString()}
            </Text>
            {linkedCosts.slice(0, 5).map((c) => (
              <View key={c.id} style={styles.linkedRow}>
                <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{c.description}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  ${Math.round(c.amountCents / 100)} · {c.costDate.slice(0, 10)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Recommended Contractors */}
      {recommended.length > 0 && (
        <View style={styles.section}>
          <Text variant="subheading">Recommended Contractors</Text>
          {recommended.map((c) => (
            <Pressable key={c.id} style={styles.linkedRow}
              onPress={() => router.push(`/(homes)/contractor/${c.id}`)}>
              <Text variant="body" style={{ flex: 1 }}>{c.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>{c.specialty}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.successButton} onPress={handleComplete}>
          <Text variant="label" color={colors.background}>Mark Done</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={handleSnooze}>
          <Text variant="label" color={ACCENT}>Snooze 7d</Text>
        </Pressable>
      </View>
      <Pressable style={styles.ghostButton} onPress={() => router.push(`/(homes)/maintenance/add?id=${id}`)}>
        <Text variant="label" color={ACCENT}>Edit</Text>
      </Pressable>
      <Pressable style={styles.dangerOutline} onPress={handleDeactivate}>
        <Text variant="label" color={colors.danger}>Deactivate</Text>
      </Pressable>
    </ScrollView>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text variant="caption" color={colors.textSecondary} style={{ width: 120 }}>{label}</Text>
      <Text variant="body" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  errorContainer: {
    flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    alignSelf: 'flex-start', borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  factsCard: { marginTop: spacing.sm },
  factRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  section: { marginTop: spacing.md, gap: spacing.xs },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  linkedRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  successButton: {
    flex: 1, backgroundColor: colors.success, borderRadius: 8,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  ghostButton: {
    flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  dangerOutline: {
    borderWidth: 1, borderColor: colors.danger, borderRadius: 8,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
