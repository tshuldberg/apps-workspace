import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getAllContractors, getContractorsForProperty, toggleFavorite,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;

export default function ContractorDirectory() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  const contractors = useMemo(
    () => propertyId ? getContractorsForProperty(db, propertyId) : getAllContractors(db),
    [db, propertyId, tick],
  );

  const filtered = contractors.filter((c) => {
    if (filter === 'favorites' && !c.isFavorite) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.specialty.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <View style={styles.screen}>
      <TextInput style={styles.searchBar} value={search} onChangeText={setSearch}
        placeholder="Search contractors..." placeholderTextColor={colors.textTertiary} />

      <View style={styles.chipRow}>
        {(['all', 'favorites'] as const).map((f) => (
          <Pressable key={f} style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}>
            <Text variant="label" color={filter === f ? colors.background : colors.textSecondary}>
              {f === 'all' ? 'All' : 'Favorites'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(homes)/contractor/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subheading">{item.name}</Text>
                  {item.company && <Text variant="body" color={colors.textSecondary}>{item.company}</Text>}
                </View>
                <Pressable onPress={() => { toggleFavorite(db, item.id); setTick((v) => v + 1); }}
                  accessibilityLabel="Toggle favorite" style={styles.heartButton}>
                  <Text style={{ fontSize: 18 }}>{item.isFavorite ? '❤️' : '🤍'}</Text>
                </Pressable>
              </View>
              <View style={styles.specialtyBadge}>
                <Text variant="label" style={{ fontSize: 11 }}>{item.specialty}</Text>
              </View>
              {item.rating && (
                <Text variant="caption" color={ACCENT}>
                  {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                </Text>
              )}
              <View style={styles.contactRow}>
                {item.phone && (
                  <Pressable style={styles.contactButton}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    accessibilityLabel="Call">
                    <Text style={{ fontSize: 16 }}>📞</Text>
                  </Pressable>
                )}
                {item.email && (
                  <Pressable style={styles.contactButton}
                    onPress={() => Linking.openURL(`mailto:${item.email}`)}
                    accessibilityLabel="Email">
                    <Text style={{ fontSize: 16 }}>✉️</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>🔧</Text>
            <Text variant="body" color={colors.textSecondary}>No contractors yet</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(homes)/contractor/add')}>
              <Text variant="label" color={colors.background}>Add Your First Pro</Text>
            </Pressable>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push('/(homes)/contractor/add')}
        accessibilityLabel="Add contractor">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    margin: spacing.md, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  heartButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  specialtyBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  contactRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  contactButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderRadius: 22 },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
