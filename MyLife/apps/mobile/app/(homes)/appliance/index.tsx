import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getAppliancesForProperty, getProperties,
  getAppliancesNeedingAttention, searchAppliances, getWarrantyStatus,
  type ApplianceCategory,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: (ApplianceCategory | 'all')[] = ['all', 'hvac', 'kitchen', 'laundry', 'plumbing', 'electrical', 'outdoor', 'other'];
const WARRANTY_COLORS: Record<string, string> = {
  active: colors.success, expiring_soon: ACCENT, expired: colors.danger, unknown: colors.textTertiary,
};

export default function ApplianceRegistry() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = propertyId ?? properties[0]?.id;
  const appliances = useMemo(() => propId ? getAppliancesForProperty(db, propId) : [], [db, propId]);
  const needsAttention = getAppliancesNeedingAttention(appliances);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ApplianceCategory | 'all'>('all');

  const attentionIds = new Set(needsAttention.map((a) => a.id));
  const filtered = useMemo(() => {
    let result = search.trim() ? searchAppliances(appliances, search) : appliances;
    if (filter !== 'all') result = result.filter((a) => a.category === filter);
    // Exclude attention items from main list when attention section is visible
    if (filter === 'all' && !search.trim()) result = result.filter((a) => !attentionIds.has(a.id));
    return result;
  }, [appliances, search, filter, attentionIds]);

  return (
    <View style={styles.screen}>
      <TextInput style={styles.searchBar} value={search} onChangeText={setSearch}
        placeholder="Search appliances..." placeholderTextColor={colors.textTertiary} />

      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, filter === c && styles.chipActive]} onPress={() => setFilter(c)}>
            <Text variant="label" color={filter === c ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>
              {c === 'all' ? 'All' : c}
            </Text>
          </Pressable>
        ))}
      </View>

      {needsAttention.length > 0 && filter === 'all' && !search.trim() && (
        <View style={styles.attentionSection}>
          <Text variant="label" color={colors.danger} style={styles.attentionHeader}>Needs Attention</Text>
          {needsAttention.map((a) => (
            <Pressable key={a.id} style={styles.attentionRow}
              onPress={() => router.push(`/(homes)/appliance/${a.id}`)}>
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{a.name}</Text>
              <Text variant="caption" color={colors.danger}>{a.condition}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const warranty = getWarrantyStatus(item);
          return (
            <Pressable onPress={() => router.push(`/(homes)/appliance/${item.id}`)}>
              <Card style={styles.card}>
                <Text variant="subheading">{item.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.brand ?? ''} {item.modelNumber ?? ''}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={styles.catBadge}>
                    <Text variant="label" style={{ fontSize: 10 }}>{item.category}</Text>
                  </View>
                  <View style={[styles.condBadge, { backgroundColor: `${WARRANTY_COLORS[warranty]}20` }]}>
                    <Text variant="label" color={WARRANTY_COLORS[warranty]} style={{ fontSize: 10 }}>
                      {warranty.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>🔌</Text>
            <Text variant="body" color={colors.textSecondary}>No appliances tracked</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push(`/(homes)/appliance/add?propertyId=${propId}`)}>
              <Text variant="label" color={colors.background}>Add Your First Appliance</Text>
            </Pressable>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push(`/(homes)/appliance/add?propertyId=${propId}`)}
        accessibilityLabel="Add appliance">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    margin: spacing.md, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.xs, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  attentionSection: { marginHorizontal: spacing.md, marginTop: spacing.sm },
  attentionHeader: { marginBottom: spacing.xs },
  attentionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: `${colors.danger}14`, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs,
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  catBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  condBadge: { borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
