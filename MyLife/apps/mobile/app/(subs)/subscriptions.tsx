import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  listSubscriptions,
  deleteSubscription,
  normalizeToMonthlyCents,
  getSubscriptionCount,
} from '@mylife/subs';
import type { SubscriptionStatus } from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;
const STATUSES: Array<SubscriptionStatus | 'all'> = ['all', 'active', 'paused', 'cancelled', 'trial'];

export default function SubscriptionsListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const refresh = () => setTick((v) => v + 1);

  const subs = useMemo(
    () => listSubscriptions(db, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      sortBy: 'name',
      sortOrder: 'asc',
    }),
    [db, tick, statusFilter],
  );

  const totalCount = useMemo(() => getSubscriptionCount(db), [db, tick]);
  const totalMonthlyCents = subs.reduce((sum, s) => sum + normalizeToMonthlyCents(s.costCents, s.billingCycle), 0);

  const filtered = search.trim()
    ? subs.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : subs;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search subscriptions..."
        placeholderTextColor={colors.textTertiary}
      />

      {/* Status filter */}
      <View style={styles.chipRow}>
        {STATUSES.map((s) => {
          const selected = s === statusFilter;
          return (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {s === 'all' ? 'All' : s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Count + total */}
      <Text variant="caption" color={colors.textSecondary}>
        {totalCount} total -- ${(totalMonthlyCents / 100).toFixed(2)}/mo equivalent
      </Text>

      {/* Subscription list */}
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              No subscriptions found. Tap + to add one.
            </Text>
          </Card>
        ) : (
          filtered.map((sub) => (
            <Pressable
              key={sub.id}
              style={styles.subRow}
              onPress={() => router.push(`/(subs)/${sub.id}`)}
            >
              <View style={styles.mainCopy}>
                <Text variant="body">{sub.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  ${(sub.costCents / 100).toFixed(2)}/{sub.billingCycle}
                  {sub.nextRenewalDate ? ` -- Next: ${sub.nextRenewalDate}` : ''}
                </Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: sub.status === 'active' ? colors.success
                  : sub.status === 'paused' ? '#F59E0B'
                  : sub.status === 'trial' ? '#3B82F6'
                  : colors.textTertiary,
              }]}>
                <Text variant="caption" color={colors.background}>{sub.status}</Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push('/(subs)/add-sub')}
      >
        <Text variant="label" color={colors.background}>+ Add Subscription</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  searchInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  list: { gap: spacing.sm },
  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  addButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
