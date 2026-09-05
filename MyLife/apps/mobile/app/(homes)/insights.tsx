import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getProperties, getAllActiveSchedules, getCostEntriesForProperty,
  getPoliciesForProperty, getAppliancesForProperty, getDocumentsForProperty,
  getAllContractors, calculateScheduleStatus, sortByUrgency,
  getTaskTypeLabel, getMonthlyCostTrend, getCostSummary,
  getExpiringPolicies, getExpiringDocuments, getAppliancesNeedingAttention,
  getFavoriteContractors, markComplete, updateSchedule,
  type ScheduleWithStatus,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;

export default function InsightsTab() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((v) => v + 1);

  const properties = useMemo(() => getProperties(db), [db, tick]);
  const contractors = useMemo(() => getAllContractors(db), [db, tick]);
  const favorites = getFavoriteContractors(contractors);

  // Aggregate costs across all properties
  const allCosts = useMemo(
    () => properties.flatMap((p) => getCostEntriesForProperty(db, p.id)),
    [db, properties, tick],
  );
  const costSummary = getCostSummary(allCosts);
  const trend = getMonthlyCostTrend(allCosts);
  const monthlyAvg = trend.length > 0
    ? Math.round(trend.reduce((s, t) => s + t.totalCents, 0) / trend.length)
    : 0;

  // Expiring items across all properties
  const expiringPolicies = useMemo(
    () => properties.flatMap((p) => getExpiringPolicies(getPoliciesForProperty(db, p.id), 90)),
    [db, properties, tick],
  );
  const expiringDocs = useMemo(
    () => properties.flatMap((p) => getExpiringDocuments(getDocumentsForProperty(db, p.id), 90)),
    [db, properties, tick],
  );
  const attentionAppliances = useMemo(
    () => properties.flatMap((p) => getAppliancesNeedingAttention(getAppliancesForProperty(db, p.id))),
    [db, properties, tick],
  );

  // Overdue schedules
  const allSchedules = useMemo(() => getAllActiveSchedules(db), [db, tick]);
  const withStatus: ScheduleWithStatus[] = allSchedules.map((s) => ({
    ...s, status: calculateScheduleStatus(s.nextDueDate),
  }));
  const overdue = sortByUrgency(withStatus).filter((s) => s.status === 'overdue');

  const sparkMax = Math.max(...trend.map((x) => x.totalCents), 1);

  const handleComplete = (schedule: ScheduleWithStatus) => {
    const result = markComplete(schedule);
    updateSchedule(db, schedule.id, {
      lastCompletedDate: result.lastCompletedDate,
      nextDueDate: result.nextDueDate,
      snoozeDays: 0, snoozeCount: 0,
    });
    refresh();
  };

  if (properties.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text variant="heading" style={{ textAlign: 'center' }}>Add a property to see insights</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(homes)/property/add')}>
          <Text variant="label" color={colors.background}>Add Property</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Spending Trend */}
      <Card style={styles.heroCard}>
        <Text variant="caption" color={colors.textSecondary}>
          {properties.length > 1 ? 'All Properties' : properties[0]?.name}
        </Text>
        <Text style={styles.statAmount}>${Math.round(monthlyAvg / 100).toLocaleString()}</Text>
        <Text variant="caption" color={colors.textSecondary}>monthly average</Text>
        {trend.length > 0 && (
          <View style={styles.sparkline}>
            {trend.slice(-6).map((t, i) => (
              <View key={i} style={styles.sparkCol}>
                <View
                  style={[
                    styles.sparkBar,
                    {
                      height: Math.max(4, (t.totalCents / sparkMax) * 48),
                      backgroundColor: ACCENT,
                    },
                  ]}
                />
                <Text variant="caption" color={colors.textTertiary} style={{ fontSize: 10 }}>
                  {t.month.slice(5, 7)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {Object.keys(costSummary.byCategory).length > 0 && (
          <View style={styles.categoryRow}>
            {Object.entries(costSummary.byCategory).map(([cat, cents], i) => (
              <View key={cat} style={styles.categoryDot}>
                <View style={[styles.dot, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                <Text variant="caption" color={colors.textSecondary} style={{ fontSize: 11 }}>
                  {cat} {Math.round((cents / Math.max(costSummary.totalCents, 1)) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Expiring Soon */}
      {(expiringPolicies.length > 0 || expiringDocs.length > 0 || attentionAppliances.length > 0) && (
        <View style={styles.section}>
          <Text variant="subheading">Expiring Soon</Text>
          {expiringPolicies.map((p) => (
            <ExpiryRow key={p.id} label={`${p.provider} policy`} detail={`Ends ${p.endDate.slice(0, 10)}`} type="Policy" />
          ))}
          {expiringDocs.map((d) => (
            <ExpiryRow key={d.id} label={d.title} detail={`Expires ${d.expiryDate?.slice(0, 10) ?? ''}`} type="Doc" />
          ))}
          {attentionAppliances.map((a) => (
            <ExpiryRow key={a.id} label={a.name} detail={`${a.condition} condition`} type="Appliance" />
          ))}
        </View>
      )}
      {expiringPolicies.length === 0 && expiringDocs.length === 0 && attentionAppliances.length === 0 && (
        <Card style={styles.allClearCard}>
          <Text variant="body" color={colors.success}>✓ Nothing expiring in the next 90 days</Text>
        </Card>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <View style={styles.section}>
          <Text variant="subheading">Overdue Tasks</Text>
          {overdue.map((s) => {
            const propName = properties.find((p) => p.id === s.propertyId)?.name ?? '';
            return (
              <View key={s.id} style={styles.overdueRow}>
                <View style={styles.overdueContent}>
                  <Text variant="body">{getTaskTypeLabel(s.taskType, s.taskTypeCustom)}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{propName}</Text>
                </View>
                <Pressable style={styles.ghostButton} onPress={() => handleComplete(s)}>
                  <Text variant="label" color={colors.success}>Done</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Contractors */}
      {contractors.length > 0 && (
        <View style={styles.section}>
          <Text variant="subheading">Your Contractors</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {contractors.length} total, {favorites.length} favorites
          </Text>
          {contractors.slice(0, 3).map((c) => (
            <View key={c.id} style={styles.contractorRow}>
              <Text variant="body">{c.name}</Text>
              <View style={styles.specialtyBadge}>
                <Text variant="label" style={{ fontSize: 11 }}>{c.specialty}</Text>
              </View>
              {c.rating && <Text variant="caption" color={ACCENT}>{'★'.repeat(c.rating)}</Text>}
            </View>
          ))}
          <Pressable onPress={() => router.push('/(homes)/contractor/')}>
            <Text variant="caption" color={ACCENT}>View All</Text>
          </Pressable>
        </View>
      )}

      {/* Quick links */}
      <View style={styles.section}>
        <Pressable onPress={() => router.push('/(homes)/property/add')}>
          <Text variant="body" color={ACCENT}>+ Add Property</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const CAT_COLORS = [colors.modules.homes, colors.success, colors.accent, colors.warning, colors.danger];

function ExpiryRow({ label, detail, type }: { label: string; detail: string; type: string }) {
  return (
    <View style={styles.expiryRow}>
      <View style={styles.expiryContent}>
        <Text variant="body" numberOfLines={1}>{label}</Text>
        <Text variant="caption" color={colors.danger}>{detail}</Text>
      </View>
      <View style={styles.typeBadge}>
        <Text variant="label" style={{ fontSize: 10 }}>{type}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  emptyContainer: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md,
  },
  emptyIcon: { fontSize: 64 },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  heroCard: { marginTop: spacing.md },
  statAmount: { fontSize: 24, fontWeight: '700', color: ACCENT, marginTop: spacing.xs },
  sparkline: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', height: 64, marginTop: spacing.md, gap: spacing.xs,
  },
  sparkCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  sparkBar: { width: '80%', borderRadius: 2 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  categoryDot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  allClearCard: { marginTop: spacing.lg },
  expiryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.glass, borderRadius: 8, padding: spacing.sm,
  },
  expiryContent: { flex: 1, gap: 2 },
  typeBadge: {
    backgroundColor: colors.glassStrong, borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  overdueRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.glass, borderRadius: 8, padding: spacing.sm,
  },
  overdueContent: { flex: 1, gap: 2 },
  ghostButton: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: 4, borderWidth: 1, borderColor: colors.success,
  },
  contractorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.glass, borderRadius: 8, padding: spacing.sm,
  },
  specialtyBadge: {
    backgroundColor: colors.glassStrong, borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
});
