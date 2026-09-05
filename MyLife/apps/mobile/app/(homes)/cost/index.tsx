import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getCostEntriesForProperty, getProperties, getCostSummary,
  type CostCategory,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: (CostCategory | 'all')[] = ['all', 'maintenance', 'repair', 'improvement', 'utility', 'other'];

export default function CostListScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [filter, setFilter] = useState<CostCategory | 'all'>('all');

  const properties = useMemo(() => getProperties(db), [db]);
  const propId = propertyId ?? properties[0]?.id;
  const entries = useMemo(() => propId ? getCostEntriesForProperty(db, propId) : [], [db, propId]);
  const summary = getCostSummary(entries);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.category === filter);
  const propName = properties.find((p) => p.id === propId)?.name ?? '';

  return (
    <View style={styles.screen}>
      <Card style={styles.summaryCard}>
        <Text variant="caption" color={colors.textSecondary}>{propName} - This Month</Text>
        <Text style={styles.totalAmount}>${Math.round(summary.totalCents / 100).toLocaleString()}</Text>
      </Card>

      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, filter === c && styles.chipActive]}
            onPress={() => setFilter(c)}>
            <Text variant="label" color={filter === c ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>
              {c === 'all' ? 'All' : c}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(homes)/cost/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" numberOfLines={1}>{item.description}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {item.category} {item.vendor ? `· ${item.vendor}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="body" color={ACCENT}>${Math.round(item.amountCents / 100)}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{item.costDate.slice(0, 10)}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>💰</Text>
            <Text variant="body" color={colors.textSecondary}>No costs recorded yet</Text>
          </View>
        }
      />

      <Pressable style={styles.fab}
        onPress={() => router.push(`/(homes)/cost/add?propertyId=${propId}`)}
        accessibilityLabel="Add cost entry">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  summaryCard: { margin: spacing.md },
  totalAmount: { fontSize: 24, fontWeight: '700', color: ACCENT },
  chipRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.xs, flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: colors.glassStrong, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: ACCENT },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  card: { marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
