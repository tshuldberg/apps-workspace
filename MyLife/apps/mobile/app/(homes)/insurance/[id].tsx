import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getPolicy, deletePolicy, getProperty } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function PolicyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const policy = useMemo(() => id ? getPolicy(db, id) : null, [db, id]);
  const property = useMemo(() => policy ? getProperty(db, policy.propertyId) : null, [db, policy?.propertyId]);

  if (!policy) {
    return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;
  }

  const handleDelete = () => {
    Alert.alert('Delete Policy', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deletePolicy(db, policy.id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{policy.provider}</Text>
      <Text variant="body" color={colors.textSecondary}>#{policy.policyNumber}</Text>

      <Card>
        <FactRow label="Type" value={policy.policyType} />
        <FactRow label="Coverage" value={fmt(policy.coverageAmountCents)} />
        <FactRow label="Deductible" value={fmt(policy.deductibleCents)} />
        <FactRow label="Premium" value={`${fmt(policy.annualPremiumCents)}/yr`} />
        <FactRow label="Period" value={`${policy.startDate.slice(0, 10)} - ${policy.endDate.slice(0, 10)}`} />
        <FactRow label="Auto-renew" value={policy.autoRenew ? 'Yes' : 'No'} />
        <FactRow label="Property" value={property?.name ?? ''} />
        {policy.agentName && <FactRow label="Agent" value={policy.agentName} />}
        {policy.agentPhone && <FactRow label="Agent Phone" value={policy.agentPhone} />}
        {policy.notes && <FactRow label="Notes" value={policy.notes} />}
      </Card>

      <View style={styles.actions}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/insurance/add?id=${id}`)}>
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
