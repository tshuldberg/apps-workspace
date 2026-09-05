import { useMemo, useState, useCallback } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getContractor, deleteContractor, toggleFavorite,
  getServicesForContractor, getContractorStats,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;

export default function ContractorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const contractor = useMemo(() => id ? getContractor(db, id) : null, [db, id, tick]);
  const services = useMemo(() => id ? getServicesForContractor(db, id) : [], [db, id, tick]);
  const stats = getContractorStats(services);

  if (!contractor) {
    return <View style={styles.center}><Text variant="body" color={colors.textSecondary}>Not found</Text></View>;
  }

  const handleDelete = () => {
    Alert.alert('Delete Contractor', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteContractor(db, contractor.id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="heading">{contractor.name}</Text>
        {contractor.company && <Text variant="body" color={colors.textSecondary}>{contractor.company}</Text>}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text variant="label" style={{ fontSize: 11 }}>{contractor.specialty}</Text>
          </View>
        </View>
        {contractor.rating && (
          <Text variant="body" color={ACCENT}>
            {'★'.repeat(contractor.rating)}{'☆'.repeat(5 - contractor.rating)}
          </Text>
        )}
      </View>

      {/* Contact */}
      <Card>
        {contractor.phone && (
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`tel:${contractor.phone}`)}>
            <Text style={{ fontSize: 16 }}>📞</Text>
            <Text variant="body" color={ACCENT}>{contractor.phone}</Text>
          </Pressable>
        )}
        {contractor.email && (
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${contractor.email}`)}>
            <Text style={{ fontSize: 16 }}>✉️</Text>
            <Text variant="body" color={ACCENT}>{contractor.email}</Text>
          </Pressable>
        )}
        {contractor.website && (
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL(contractor.website!)}>
            <Text style={{ fontSize: 16 }}>🌐</Text>
            <Text variant="body" color={ACCENT}>{contractor.website}</Text>
          </Pressable>
        )}
        {contractor.address && (
          <View style={styles.contactRow}>
            <Text style={{ fontSize: 16 }}>📍</Text>
            <Text variant="body">{contractor.address}</Text>
          </View>
        )}
        {contractor.notes && <Text variant="body" color={colors.textSecondary}>{contractor.notes}</Text>}
      </Card>

      {/* Service History */}
      <View style={styles.section}>
        <Text variant="subheading">Service History</Text>
        {services.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>No services recorded</Text>
        ) : (
          <>
            <Text variant="body" color={ACCENT}>
              Total: ${Math.round(stats.totalSpentCents / 100).toLocaleString()} · Avg rating: {stats.averageRating?.toFixed(1) ?? 'N/A'}
            </Text>
            {services.map((s) => (
              <View key={s.id} style={styles.serviceRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" numberOfLines={1}>{s.description}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{s.serviceDate.slice(0, 10)}</Text>
                </View>
                {s.costCents != null && (
                  <Text variant="caption" color={colors.textSecondary}>${Math.round(s.costCents / 100)}</Text>
                )}
              </View>
            ))}
          </>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.editButton} onPress={() => router.push(`/(homes)/contractor/add?id=${id}`)}>
          <Text variant="label" color={ACCENT}>Edit</Text>
        </Pressable>
        <Pressable style={styles.favButton} onPress={() => { toggleFavorite(db, contractor.id); refresh(); }}>
          <Text variant="label" color={ACCENT}>{contractor.isFavorite ? 'Unfavorite' : 'Favorite'}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.deleteOutline} onPress={handleDelete}>
        <Text variant="label" color={colors.danger}>Delete</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.xs },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  badge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  section: { gap: spacing.xs },
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  editButton: { flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  favButton: { flex: 1, borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
  deleteOutline: { borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingVertical: spacing.sm, alignItems: 'center' },
});
