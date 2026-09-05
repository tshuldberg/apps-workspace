import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getDocumentsForProperty, getProperties, searchDocuments,
  getDocumentStats, getExpiringDocuments, type DocCategory,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: (DocCategory | 'all')[] = ['all', 'deed', 'warranty', 'insurance', 'permit', 'receipt', 'manual', 'contract', 'other'];

export default function DocumentVault() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = propertyId ?? properties[0]?.id;
  const docs = useMemo(() => propId ? getDocumentsForProperty(db, propId) : [], [db, propId]);
  const stats = getDocumentStats(docs);
  const expiring = getExpiringDocuments(docs, 30);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DocCategory | 'all'>('all');

  const filtered = useMemo(() => {
    let result = search.trim() ? searchDocuments(docs, search) : docs;
    if (filter !== 'all') result = result.filter((d) => d.category === filter);
    return result;
  }, [docs, search, filter]);

  return (
    <View style={styles.screen}>
      <Card style={styles.statsCard}>
        <Text variant="caption" color={colors.textSecondary}>{stats.total} documents{expiring.length > 0 ? ` · ${expiring.length} expiring` : ''}</Text>
      </Card>

      <TextInput style={styles.searchBar} value={search} onChangeText={setSearch}
        placeholder="Search documents..." placeholderTextColor={colors.textTertiary} />

      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, filter === c && styles.chipActive]} onPress={() => setFilter(c)}>
            <Text variant="label" color={filter === c ? colors.background : colors.textSecondary} style={{ fontSize: 10 }}>
              {c === 'all' ? 'All' : c}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(homes)/document/${item.id}`)}>
            <Card style={styles.card}>
              <Text variant="subheading">{item.title}</Text>
              <View style={styles.detailRow}>
                <View style={styles.catBadge}>
                  <Text variant="label" style={{ fontSize: 10 }}>{item.category}</Text>
                </View>
                <Text variant="caption" color={colors.textSecondary}>{item.fileType.toUpperCase()}</Text>
              </View>
              {item.expiryDate && (
                <Text variant="caption" color={expiring.some((e) => e.id === item.id) ? colors.danger : colors.textSecondary}>
                  Expires: {item.expiryDate.slice(0, 10)}
                </Text>
              )}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>📁</Text>
            <Text variant="body" color={colors.textSecondary}>Your vault is empty</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push(`/(homes)/document/add?propertyId=${propId}`)}>
              <Text variant="label" color={colors.background}>Add a Document</Text>
            </Pressable>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push(`/(homes)/document/add?propertyId=${propId}`)}
        accessibilityLabel="Add document">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  statsCard: { margin: spacing.md },
  searchBar: {
    marginHorizontal: spacing.md, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.sm },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  detailRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  catBadge: { backgroundColor: colors.glassStrong, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: colors.background, fontSize: 28, fontWeight: '600', marginTop: -2 },
});
