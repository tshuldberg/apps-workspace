import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getProperties,
  getAppliancesForProperty,
} from '@mylife/homes';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

export default function WarrantiesScreen() {
  const db = useDatabase();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = properties[0]?.id;
  const appliances = useMemo(() => propId ? getAppliancesForProperty(db, propId) : [], [db, propId]);

  const withWarranty = appliances.filter((a) => a.warrantyExpiry);
  const sorted = [...withWarranty].sort((a, b) =>
    (a.warrantyExpiry ?? '').localeCompare(b.warrantyExpiry ?? ''),
  );

  const now = new Date();
  const getStatus = (expiry: string) => {
    const exp = new Date(expiry);
    const diffDays = Math.round((exp.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return { label: 'Expired', color: colors.textTertiary };
    if (diffDays <= 30) return { label: `${diffDays}d left`, color: colors.danger };
    if (diffDays <= 90) return { label: `${diffDays}d left`, color: colors.warning };
    return { label: `${diffDays}d left`, color: colors.success };
  };

  if (!propId) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={styles.emptyTitle}>No Properties</Text>
          <Text style={styles.emptyText}>Add a property to track warranties.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Warranty Tracker</Text>
      <Text style={styles.subtitle}>
        {withWarranty.length} items with warranties tracked
      </Text>

      {sorted.length === 0 && (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No warranties found. Add warranty expiry dates to your appliances.
          </Text>
        </Card>
      )}

      {sorted.map((a) => {
        const status = a.warrantyExpiry ? getStatus(a.warrantyExpiry) : null;
        return (
          <Card key={a.id} style={styles.warrantyCard}>
            <View style={styles.warrantyHeader}>
              <Text style={styles.warrantyName}>{a.name}</Text>
              {status && (
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                  <Text style={styles.statusText}>{status.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.warrantyMeta}>
              {a.brand ? `${a.brand} ` : ''}{a.modelNumber ?? ''}
            </Text>
            {a.serialNumber && (
              <Text style={styles.warrantySerial}>S/N: {a.serialNumber}</Text>
            )}
            <Text style={styles.warrantyExpiry}>
              Expires: {a.warrantyExpiry?.slice(0, 10) ?? 'N/A'}
            </Text>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  warrantyCard: { padding: spacing.md, gap: spacing.xs },
  warrantyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  warrantyName: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 10, color: colors.background, fontWeight: '600' },
  warrantyMeta: { fontSize: 13, color: colors.textSecondary },
  warrantySerial: { fontSize: 12, color: colors.textTertiary },
  warrantyExpiry: { fontSize: 13, color: colors.text },
});
