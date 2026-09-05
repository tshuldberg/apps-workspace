import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getCostEntry, deleteCostEntry, getProperty } from '@mylife/homes';

const ACCENT = colors.modules.homes;

export default function CostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const entry = useMemo(() => id ? getCostEntry(db, id) : null, [db, id]);
  const property = useMemo(() => entry ? getProperty(db, entry.propertyId) : null, [db, entry?.propertyId]);

  if (!entry) {
    return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;
  }

  const handleDelete = () => {
    Alert.alert('Delete Cost Entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCostEntry(db, entry.id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{entry.description}</Text>
      <Text style={styles.amount}>${Math.round(entry.amountCents / 100).toLocaleString()}</Text>

      <Card>
        <FactRow label="Category" value={entry.category} />
        <FactRow label="Date" value={entry.costDate.slice(0, 10)} />
        <FactRow label="Property" value={property?.name ?? ''} />
        {entry.vendor && <FactRow label="Vendor" value={entry.vendor} />}
      </Card>

      <View style={styles.actions}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/cost/add?id=${id}`)}>
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
  amount: { fontSize: 32, fontWeight: '700', color: ACCENT },
  factRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  editButton: {
    flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  deleteButton: {
    flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 8,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
