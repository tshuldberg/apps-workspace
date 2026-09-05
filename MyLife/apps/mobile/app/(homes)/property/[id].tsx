import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getProperty, deleteProperty,
  getSchedulesForProperty, calculateScheduleStatus,
  getCostEntriesForProperty, getCostSummary, getLifetimeCosts,
  getContractorsForProperty, getFavoriteContractors,
  getPoliciesForProperty, getActivePolicies, getPolicyCostSummary, checkCoverageGaps,
  getDocumentsForProperty, getDocumentStats, getExpiringDocuments,
  getItemsForProperty, getPropertyInventoryValue,
  getAppliancesForProperty, getAppliancesNeedingAttention,
  getProjectsForProperty, getActiveProjectCount,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const tick = 0;

  const property = useMemo(() => id ? getProperty(db, id) : null, [db, id, tick]);

  // Maintenance
  const schedules = useMemo(() => id ? getSchedulesForProperty(db, id) : [], [db, id, tick]);
  const overdueCount = schedules.filter((s) => calculateScheduleStatus(s.nextDueDate) === 'overdue').length;
  const dueSoonCount = schedules.filter((s) => calculateScheduleStatus(s.nextDueDate) === 'due_soon').length;

  // Costs
  const costs = useMemo(() => id ? getCostEntriesForProperty(db, id) : [], [db, id, tick]);
  const costSummary = getCostSummary(costs);
  const lifetime = getLifetimeCosts(costs);

  // Contractors
  const contractors = useMemo(() => id ? getContractorsForProperty(db, id) : [], [db, id, tick]);
  const favContractors = getFavoriteContractors(contractors);

  // Insurance
  const policies = useMemo(() => id ? getPoliciesForProperty(db, id) : [], [db, id, tick]);
  const activePolicies = getActivePolicies(policies);
  const policyCost = getPolicyCostSummary(policies);
  const gaps = property ? checkCoverageGaps(policies, property.ownershipType) : [];

  // Documents
  const docs = useMemo(() => id ? getDocumentsForProperty(db, id) : [], [db, id, tick]);
  const docStats = getDocumentStats(docs);
  const expiringDocs = getExpiringDocuments(docs, 30);

  // Inventory
  const items = useMemo(() => id ? getItemsForProperty(db, id) : [], [db, id, tick]);
  const inventoryValue = getPropertyInventoryValue(items);

  // Appliances
  const appliances = useMemo(() => id ? getAppliancesForProperty(db, id) : [], [db, id, tick]);
  const attentionAppliances = getAppliancesNeedingAttention(appliances);

  // Projects
  const projects = useMemo(() => id ? getProjectsForProperty(db, id) : [], [db, id, tick]);
  const activeProjectCount = getActiveProjectCount(projects);

  const handleDelete = () => {
    Alert.alert('Delete Property', 'This will permanently delete this property and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { if (id) { deleteProperty(db, id); router.back(); } },
      },
    ]);
  };

  if (!property) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="body" color={colors.textSecondary}>Property not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text variant="heading" style={styles.propertyName}>{property.name}</Text>
          <Pressable onPress={() => router.push(`/(homes)/property/add?id=${id}`)}>
            <Text variant="label" color={ACCENT}>Edit</Text>
          </Pressable>
        </View>
        {property.address && (
          <Text variant="body" color={colors.textSecondary}>
            {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? `, ${property.state}` : ''}
          </Text>
        )}
        <View style={styles.badgeRow}>
          <Badge label={property.propertyType} />
          <Badge label={property.ownershipType === 'own' ? 'Owner' : 'Renter'} />
          {property.yearBuilt && <Badge label={`Built ${property.yearBuilt}`} />}
          {property.sqft && <Badge label={`${property.sqft.toLocaleString()} sqft`} />}
        </View>
      </View>

      {/* TOP TIER: Maintenance */}
      <Pressable onPress={() => router.push('/(homes)/maintenance')}>
        <Card style={styles.tierCard}>
          <View style={styles.tierRow}>
            <View style={styles.tierBadges}>
              {overdueCount > 0 && (
                <View style={styles.dangerBadge}>
                  <Text variant="label" color={colors.danger}>{overdueCount} overdue</Text>
                </View>
              )}
              {dueSoonCount > 0 && (
                <View style={styles.amberBadge}>
                  <Text variant="label" color={ACCENT}>{dueSoonCount} due soon</Text>
                </View>
              )}
              {overdueCount === 0 && dueSoonCount === 0 && (
                <Text variant="body" color={colors.success}>✓ All maintenance up to date</Text>
              )}
            </View>
            <Text variant="caption" color={colors.textTertiary}>›</Text>
          </View>
        </Card>
      </Pressable>

      {/* TOP TIER: Cost Summary */}
      <Pressable onPress={() => router.push(`/(homes)/cost/?propertyId=${id}`)}>
        <Card style={styles.tierCard}>
          <View style={styles.costRow}>
            <View>
              <Text style={styles.costStat}>{fmt(costSummary.totalCents)}</Text>
              <Text variant="caption" color={colors.textSecondary}>recent</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="body" color={colors.textSecondary}>{fmt(lifetime)}</Text>
              <Text variant="caption" color={colors.textSecondary}>lifetime</Text>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* MIDDLE TIER: 2-column grid */}
      <View style={styles.gridRow}>
        <GridCard
          title="Contractors"
          stat={`${contractors.length} contacts`}
          detail={favContractors[0] ? `Top: ${favContractors[0].name}` : undefined}
          onPress={() => router.push(`/(homes)/contractor/?propertyId=${id}`)}
        />
        <GridCard
          title="Insurance"
          stat={`${activePolicies.length} active`}
          detail={gaps.length > 0 ? `${gaps.length} coverage gap${gaps.length > 1 ? 's' : ''}` : fmt(policyCost.totalAnnualPremium) + '/yr'}
          warn={gaps.length > 0}
          onPress={() => router.push(`/(homes)/insurance/?propertyId=${id}`)}
        />
      </View>
      <View style={styles.gridRow}>
        <GridCard
          title="Documents"
          stat={`${docStats.total} docs`}
          detail={expiringDocs.length > 0 ? `${expiringDocs.length} expiring` : undefined}
          onPress={() => router.push(`/(homes)/document/?propertyId=${id}`)}
        />
        <GridCard
          title="Projects"
          stat={`${activeProjectCount} active`}
          detail={projects[0]?.name}
          onPress={() => router.push(`/(homes)/project/?propertyId=${id}`)}
        />
      </View>

      {/* BOTTOM TIER: compact rows */}
      <DetailRow
        icon="📦"
        label="Inventory"
        value={`${items.length} items - ${fmt(inventoryValue.totalEstimatedCents)}`}
        onPress={() => router.push(`/(homes)/inventory/?propertyId=${id}`)}
      />
      <DetailRow
        icon="🔌"
        label="Appliances"
        value={`${appliances.length} tracked${attentionAppliances.length > 0 ? ` - ${attentionAppliances.length} needs attention` : ''}`}
        onPress={() => router.push(`/(homes)/appliance/?propertyId=${id}`)}
      />

      {/* Danger zone */}
      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text variant="label" color={colors.danger}>Delete Property</Text>
      </Pressable>
    </ScrollView>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text variant="label" style={{ fontSize: 12 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

function GridCard({ title, stat, detail, warn, onPress }: {
  title: string; stat: string; detail?: string; warn?: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={styles.gridCard} onPress={onPress}>
      <Text variant="subheading" style={{ fontSize: 16 }}>{title}</Text>
      <Text variant="caption" color={colors.textSecondary}>{stat}</Text>
      {detail && (
        <Text variant="caption" color={warn ? colors.danger : colors.textTertiary} numberOfLines={1}>
          {detail}
        </Text>
      )}
    </Pressable>
  );
}

function DetailRow({ icon, label, value, onPress }: {
  icon: string; label: string; value: string; onPress: () => void;
}) {
  return (
    <Pressable style={styles.detailRow} onPress={onPress}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      <Text variant="body" color={colors.textSecondary} numberOfLines={1} style={{ maxWidth: '50%' }}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textTertiary}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  errorContainer: {
    flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  header: { paddingVertical: spacing.md, gap: spacing.xs },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  propertyName: { flex: 1, fontSize: 24 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  badge: {
    backgroundColor: colors.glassStrong, borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  tierCard: { marginTop: spacing.sm },
  tierRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tierBadges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  dangerBadge: {
    backgroundColor: `${colors.danger}26`, borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  amberBadge: {
    backgroundColor: `${colors.modules.homes}26`, borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  costRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  costStat: { fontSize: 24, fontWeight: '700', color: ACCENT },
  gridRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  gridCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, marginTop: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    minHeight: 48,
  },
  deleteButton: {
    marginTop: spacing.xl, alignItems: 'center',
    paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.danger,
    borderRadius: 8,
  },
});
