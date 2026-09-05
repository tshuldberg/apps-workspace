import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getProperties, getSchedulesForProperty, getCostEntriesForProperty,
  getDocumentsForProperty, getLifetimeCosts,
  type Property,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;

export default function PropertiesTab() {
  const db = useDatabase();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const properties = useMemo(() => getProperties(db), [db]);

  const filtered = useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.toLowerCase();
    return properties.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.address?.toLowerCase().includes(q)),
    );
  }, [properties, search]);

  if (properties.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏘️</Text>
        <Text variant="heading" style={styles.emptyTitle}>No properties yet</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>
          Add your first home or promote a saved listing.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(homes)/property/add')}>
          <Text variant="label" color={colors.background}>Add Property</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.searchBar}
        value={search}
        onChangeText={setSearch}
        placeholder="Search properties..."
        placeholderTextColor={colors.textTertiary}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PropertyCard property={item} db={db} onPress={() => router.push(`/(homes)/property/${item.id}`)} />
        )}
        ListEmptyComponent={
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.lg }}>
            No matches
          </Text>
        }
      />
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(homes)/property/add')}
        accessibilityLabel="Add new property"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

function PropertyCard({ property, db, onPress }: { property: Property; db: any; onPress: () => void }) {
  const schedules = useMemo(() => getSchedulesForProperty(db, property.id), [db, property.id]);
  const costs = useMemo(() => getCostEntriesForProperty(db, property.id), [db, property.id]);
  const docs = useMemo(() => getDocumentsForProperty(db, property.id), [db, property.id]);
  const lifetime = getLifetimeCosts(costs);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.cardAccent} />
        <Text variant="subheading">{property.name}</Text>
        {property.address && (
          <Text variant="body" color={colors.textSecondary}>{property.address}</Text>
        )}
        <View style={styles.badgeRow}>
          <Badge label={property.propertyType} />
          <Badge label={property.ownershipType === 'own' ? 'Owner' : 'Renter'} />
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          {schedules.length} tasks | ${Math.round(lifetime / 100).toLocaleString()} spent | {docs.length} docs
        </Text>
      </Card>
    </Pressable>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text variant="label" style={{ fontSize: 12 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    margin: spacing.md, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm, overflow: 'hidden' },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
    backgroundColor: ACCENT, borderTopLeftRadius: 8,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  badge: {
    backgroundColor: colors.glassStrong, borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  emptyContainer: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
  emptyBody: { textAlign: 'center', marginBottom: spacing.lg },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
