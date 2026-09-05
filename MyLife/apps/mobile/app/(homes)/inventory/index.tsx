import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getProperties, getRoomsForProperty, getItemsForProperty,
  getPropertyInventoryValue, getRoomSummary, getHighValueItems,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;
const HIGH_VALUE_THRESHOLD_CENTS = 50000; // $500

export default function InventoryManager() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = propertyId ?? properties[0]?.id;

  const rooms = useMemo(() => propId ? getRoomsForProperty(db, propId) : [], [db, propId]);
  const items = useMemo(() => propId ? getItemsForProperty(db, propId) : [], [db, propId]);
  const value = getPropertyInventoryValue(items);
  const roomSummary = getRoomSummary(items, rooms);
  const highValue = getHighValueItems(items, HIGH_VALUE_THRESHOLD_CENTS);

  return (
    <View style={styles.screen}>
      <Card style={styles.summaryCard}>
        <Text variant="caption" color={colors.textSecondary}>
          {items.length} items · {rooms.length} rooms
        </Text>
        <Text style={styles.stat}>{fmt(value.totalEstimatedCents)}</Text>
        <Text variant="caption" color={colors.textSecondary}>estimated value</Text>
      </Card>

      <FlatList
        data={roomSummary}
        keyExtractor={(item) => item.room.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          highValue.length > 0 ? (
            <View style={styles.highValueSection}>
              <Text variant="subheading">High Value Items</Text>
              {highValue.map((item) => (
                <Pressable key={item.id} style={styles.itemRow}
                  onPress={() => router.push(`/(homes)/inventory/item/${item.id}`)}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{item.name}</Text>
                  <Text variant="caption" color={ACCENT}>
                    {item.estimatedValueCents ? fmt(item.estimatedValueCents) : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item: rs }) => (
          <Pressable onPress={() => router.push(`/(homes)/inventory/room/${rs.room.id}`)}>
            <Card style={styles.card}>
              <View style={styles.roomHeader}>
                <Text variant="subheading">{rs.room.name}</Text>
                <View style={styles.typeBadge}>
                  <Text variant="label" style={{ fontSize: 10 }}>{rs.room.roomType}</Text>
                </View>
              </View>
              <Text variant="caption" color={colors.textSecondary}>
                {rs.itemCount} items · {fmt(rs.totalValueCents)}
              </Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>🏠</Text>
            <Text variant="body" color={colors.textSecondary}>Start your inventory</Text>
          </View>
        }
      />
      <Pressable style={styles.fab}
        onPress={() => router.push(`/(homes)/inventory/item/add?propertyId=${propId}`)}
        accessibilityLabel="Add item">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  summaryCard: { margin: spacing.md },
  stat: { fontSize: 24, fontWeight: '700', color: ACCENT },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  highValueSection: { marginBottom: spacing.md, gap: spacing.xs },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
