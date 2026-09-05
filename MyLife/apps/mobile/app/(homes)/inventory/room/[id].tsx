import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { getRoom, getItemsForRoom } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function RoomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const room = useMemo(() => id ? getRoom(db, id) : null, [db, id]);
  const items = useMemo(() => id ? getItemsForRoom(db, id) : [], [db, id]);

  if (!room) return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="heading">{room.name}</Text>
        <View style={styles.badge}>
          <Text variant="label" style={{ fontSize: 11 }}>{room.roomType}</Text>
        </View>
        <Text variant="caption" color={colors.textSecondary}>{items.length} items</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(homes)/inventory/item/${item.id}`)}>
            <Card style={styles.card}>
              <Text variant="subheading">{item.name}</Text>
              <View style={styles.detailRow}>
                <View style={styles.catBadge}>
                  <Text variant="label" style={{ fontSize: 10 }}>{item.category}</Text>
                </View>
                <View style={styles.condBadge}>
                  <Text variant="label" style={{ fontSize: 10 }}>{item.condition}</Text>
                </View>
              </View>
              {item.estimatedValueCents && (
                <Text variant="caption" color={ACCENT}>{fmt(item.estimatedValueCents)}</Text>
              )}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.md, gap: spacing.xs },
  badge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  detailRow: { flexDirection: 'row', gap: spacing.xs },
  catBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  condBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
