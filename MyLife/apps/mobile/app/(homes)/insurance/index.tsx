import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getPoliciesForProperty, getProperties, getProperty,
  getActivePolicies, getExpiringPolicies, getPolicyCostSummary, checkCoverageGaps,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function InsuranceList() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();

  const properties = useMemo(() => getProperties(db), [db]);
  const propId = propertyId ?? properties[0]?.id;
  const property = useMemo(() => propId ? getProperty(db, propId) : null, [db, propId]);
  const policies = useMemo(() => propId ? getPoliciesForProperty(db, propId) : [], [db, propId]);
  const active = getActivePolicies(policies);
  const expiring = getExpiringPolicies(policies, 30);
  const costSummary = getPolicyCostSummary(policies);
  const gaps = property ? checkCoverageGaps(policies, property.ownershipType) : [];

  return (
    <View style={styles.screen}>
      {/* Summary */}
      <Card style={styles.summaryCard}>
        <Text variant="caption" color={colors.textSecondary}>{property?.name ?? 'Insurance'}</Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.stat}>{fmt(costSummary.totalAnnualPremium)}</Text>
            <Text variant="caption" color={colors.textSecondary}>annual premium</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="body">{active.length} active</Text>
            <Text variant="caption" color={colors.textSecondary}>{fmt(costSummary.totalCoverage)} coverage</Text>
          </View>
        </View>
      </Card>

      {/* Coverage gaps */}
      {gaps.length > 0 && (
        <Card style={styles.gapCard}>
          <Text variant="label" color={colors.danger}>Coverage Gaps</Text>
          {gaps.map((g, i) => (
            <Text key={i} variant="caption" color={colors.danger}>• {g}</Text>
          ))}
        </Card>
      )}

      <FlatList
        data={policies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isExpiring = expiring.some((e) => e.id === item.id);
          return (
            <Pressable onPress={() => router.push(`/(homes)/insurance/${item.id}`)}>
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="subheading">{item.provider}</Text>
                    <Text variant="caption" color={colors.textSecondary}>#{item.policyNumber}</Text>
                  </View>
                  <View style={styles.typeBadge}>
                    <Text variant="label" style={{ fontSize: 10 }}>{item.policyType}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Coverage: {fmt(item.coverageAmountCents)} · Ded: {fmt(item.deductibleCents)}
                  </Text>
                  <Text variant="caption" color={ACCENT}>{fmt(item.annualPremiumCents)}/yr</Text>
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.startDate.slice(0, 10)} - {item.endDate.slice(0, 10)}
                  {item.autoRenew ? ' · Auto-renew' : ''}
                </Text>
                {isExpiring && (
                  <View style={styles.expiringBadge}>
                    <Text variant="label" color={colors.danger} style={{ fontSize: 10 }}>Expiring soon</Text>
                  </View>
                )}
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>🛡️</Text>
            <Text variant="body" color={colors.textSecondary}>No policies tracked</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(homes)/insurance/add')}>
              <Text variant="label" color={colors.background}>Add Your First Policy</Text>
            </Pressable>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push(`/(homes)/insurance/add?propertyId=${propId}`)}
        accessibilityLabel="Add policy">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  summaryCard: { margin: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { fontSize: 24, fontWeight: '700', color: ACCENT },
  gapCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.xs, borderWidth: 1, borderColor: colors.danger },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  typeBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  expiringBadge: { backgroundColor: 'rgba(255,69,58,0.15)', borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
