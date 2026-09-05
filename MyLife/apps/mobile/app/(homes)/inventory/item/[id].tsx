import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { getInventoryItem, deleteInventoryItem } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function InventoryItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const item = useMemo(() => id ? getInventoryItem(db, id) : null, [db, id]);

  if (!item) return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;

  const handleDelete = () => {
    Alert.alert('Delete Item', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteInventoryItem(db, item.id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{item.name}</Text>
      <Card>
        <FactRow label="Category" value={item.category} />
        <FactRow label="Condition" value={item.condition} />
        {item.brand && <FactRow label="Brand" value={item.brand} />}
        {item.model && <FactRow label="Model" value={item.model} />}
        {item.serialNumber && <FactRow label="Serial #" value={item.serialNumber} />}
        {item.estimatedValueCents != null && <FactRow label="Est. Value" value={fmt(item.estimatedValueCents)} />}
        {item.purchasePriceCents != null && <FactRow label="Purchase" value={fmt(item.purchasePriceCents)} />}
        {item.purchaseDate && <FactRow label="Purchased" value={item.purchaseDate.slice(0, 10)} />}
        {item.warrantyExpiry && <FactRow label="Warranty" value={item.warrantyExpiry.slice(0, 10)} />}
        {item.notes && <FactRow label="Notes" value={item.notes} />}
      </Card>
      <View style={styles.actions}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/inventory/item/add?id=${id}`)}>
          <Text variant="label" color={ACCENT}>Edit</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text variant="label" color={colors.danger}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text variant="caption" color={colors.textSecondary} style={{ width: 100 }}>{label}</Text>
      <Text variant="body" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  factRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  editButton: { flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  deleteButton: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
});
