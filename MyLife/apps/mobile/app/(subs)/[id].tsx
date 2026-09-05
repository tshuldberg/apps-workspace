import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getSubscription,
  deleteSubscription,
  updateSubscription,
  getPriceHistory,
  listAlternatives,
  normalizeToMonthlyCents,
  normalizeToAnnualCents,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function SubDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((v) => v + 1);

  const sub = useMemo(() => (id ? getSubscription(db, id) : null), [db, id, tick]);
  const priceHistory = useMemo(() => (id ? getPriceHistory(db, id) : []), [db, id, tick]);
  const alternatives = useMemo(() => (id ? listAlternatives(db, id) : []), [db, id, tick]);

  if (!sub) {
    return (
      <View style={styles.center}>
        <Text variant="subheading" color={colors.textSecondary}>Subscription not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text variant="body" color={ACCENT}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const monthlyCents = normalizeToMonthlyCents(sub.costCents, sub.billingCycle);
  const annualCents = normalizeToAnnualCents(sub.costCents, sub.billingCycle);

  const handlePause = () => {
    updateSubscription(db, sub.id, { status: sub.status === 'paused' ? 'active' : 'paused' });
    refresh();
  };

  const handleCancel = () => {
    updateSubscription(db, sub.id, { status: 'cancelled' });
    refresh();
  };

  const handleDelete = () => {
    Alert.alert('Delete', `Remove ${sub.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteSubscription(db, sub.id); router.back(); },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Text variant="subheading">{sub.name}</Text>
        <Text style={[styles.priceText, { color: ACCENT }]}>
          ${(sub.costCents / 100).toFixed(2)}/{sub.billingCycle}
        </Text>
        <View style={[styles.statusBadge, {
          backgroundColor: sub.status === 'active' ? colors.success
            : sub.status === 'paused' ? '#F59E0B'
            : sub.status === 'trial' ? '#3B82F6'
            : colors.textTertiary,
        }]}>
          <Text variant="caption" color={colors.background}>{sub.status.toUpperCase()}</Text>
        </View>
      </Card>

      {/* Details */}
      <Card>
        <Text variant="subheading">Details</Text>
        <View style={styles.detailList}>
          <DetailRow label="Monthly equivalent" value={`$${(monthlyCents / 100).toFixed(2)}`} />
          <DetailRow label="Annual equivalent" value={`$${(annualCents / 100).toFixed(2)}`} />
          <DetailRow label="Start date" value={sub.startDate} />
          <DetailRow label="Next renewal" value={sub.nextRenewalDate ?? 'N/A'} />
          {sub.trialEndDate && <DetailRow label="Trial ends" value={sub.trialEndDate} />}
          {sub.url && <DetailRow label="Website" value={sub.url} />}
          {sub.notes && <DetailRow label="Notes" value={sub.notes} />}
        </View>
      </Card>

      {/* Price history */}
      {priceHistory.length > 0 && (
        <Card>
          <Text variant="subheading">Price History</Text>
          <View style={styles.list}>
            {priceHistory.map((ph) => (
              <View key={ph.id} style={styles.priceRow}>
                <Text variant="body">{ph.changedOn}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  ${(ph.oldCostCents / 100).toFixed(2)} {'>'} ${(ph.newCostCents / 100).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <Card>
          <Text variant="subheading">Alternatives</Text>
          <View style={styles.list}>
            {alternatives.map((alt) => {
              const altMonthly = normalizeToMonthlyCents(alt.alternativeCostCents, alt.alternativeBillingCycle);
              const savings = monthlyCents - altMonthly;
              return (
                <View key={alt.id} style={styles.altRow}>
                  <Text variant="body">{alt.alternativeName}{alt.isFreeTier ? ' (Free)' : ''}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    ${(altMonthly / 100).toFixed(2)}/mo
                    {savings > 0 ? ` (save $${(savings / 100).toFixed(2)}/mo)` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
          <Pressable style={styles.compareLink} onPress={() => router.push(`/(subs)/compare?id=${sub.id}`)}>
            <Text variant="body" color={ACCENT}>Compare Prices</Text>
          </Pressable>
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.pauseButton} onPress={handlePause}>
          <Text variant="label" color={colors.background}>
            {sub.status === 'paused' ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={handleCancel}>
          <Text variant="label" color={colors.background}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text variant="label" color={colors.danger}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  headerCard: { alignItems: 'center', gap: spacing.xs },
  priceText: { fontSize: 28, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  detailList: { marginTop: spacing.sm },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  priceRow: { gap: 2 },
  altRow: {
    gap: 2, padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  compareLink: { marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  pauseButton: {
    flex: 1, backgroundColor: '#F59E0B', borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  cancelButton: {
    flex: 1, backgroundColor: colors.textTertiary, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  deleteButton: {
    flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
