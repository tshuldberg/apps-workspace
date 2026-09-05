import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getAppliance, deleteAppliance, getWarrantyStatus } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function ApplianceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const appliance = useMemo(() => id ? getAppliance(db, id) : null, [db, id]);

  if (!appliance) return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;

  const warranty = getWarrantyStatus(appliance);

  const handleDelete = () => {
    Alert.alert('Delete Appliance', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteAppliance(db, appliance.id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{appliance.name}</Text>
      <Card>
        {appliance.brand && <FactRow label="Brand" value={appliance.brand} />}
        {appliance.modelNumber && <FactRow label="Model" value={appliance.modelNumber} />}
        {appliance.serialNumber && <FactRow label="Serial #" value={appliance.serialNumber} />}
        <FactRow label="Category" value={appliance.category} />
        <FactRow label="Condition" value={appliance.condition} />
        <FactRow label="Warranty" value={warranty.replace(/_/g, ' ')} />
        {appliance.warrantyExpiry && <FactRow label="Expires" value={appliance.warrantyExpiry.slice(0, 10)} />}
        {appliance.purchasePriceCents != null && <FactRow label="Purchase" value={fmt(appliance.purchasePriceCents)} />}
        {appliance.purchaseDate && <FactRow label="Purchased" value={appliance.purchaseDate.slice(0, 10)} />}
        {appliance.notes && <FactRow label="Notes" value={appliance.notes} />}
      </Card>
      <View style={styles.actions}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/appliance/add?id=${id}`)}>
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
