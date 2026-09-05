import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import { createVenue, listVenues, type Venue } from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

type Filter = 'all' | 'visited' | 'bucket';

export default function SportsVenuesScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [all, setAll] = useState<Venue[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');

  const reload = useCallback(() => {
    setAll(listVenues(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const visited = useMemo(() => all.filter((v) => v.visited === 1), [all]);
  const bucket = useMemo(() => all.filter((v) => v.bucket_list === 1), [all]);

  const displayed = useMemo(() => {
    if (filter === 'visited') return visited;
    if (filter === 'bucket') return bucket;
    return all;
  }, [filter, all, visited, bucket]);

  const progressPct = bucket.length
    ? Math.round(
        (bucket.filter((v) => v.visited === 1).length / bucket.length) * 100,
      )
    : 0;
  const bucketVisitedCount = bucket.filter((v) => v.visited === 1).length;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a venue name.');
      return;
    }
    const created = createVenue(db, {
      name,
      city: newCity.trim() === '' ? null : newCity.trim(),
    });
    setNewName('');
    setNewCity('');
    setAdding(false);
    reload();
    router.push(`/(sports)/events/venues/${created.id}` as never);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Venues</Text>
      <Text style={styles.title}>Stadiums + bucket list</Text>
      <Text style={styles.subtitle}>
        Track stadiums you've been to and the ones you want to visit.
      </Text>

      {bucket.length > 0 ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Bucket-list progress</Text>
          <Text style={styles.progressValue}>
            {bucketVisitedCount} / {bucket.length} visited ({progressPct}%)
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {(
          [
            { key: 'all', label: `All (${all.length})` },
            { key: 'visited', label: `Visited (${visited.length})` },
            { key: 'bucket', label: `Bucket (${bucket.length})` },
          ] as const
        ).map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {adding ? (
        <View style={styles.addCard}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Venue name"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={newCity}
            onChangeText={setNewCity}
            placeholder="City (optional)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <View style={styles.addRow}>
            <Pressable
              onPress={() => {
                setAdding(false);
                setNewName('');
                setNewCity('');
              }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAdd} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Save venue</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.fab} onPress={() => setAdding(true)}>
          <Text style={styles.fabText}>+ Add venue</Text>
        </Pressable>
      )}

      <View style={styles.block}>
        {displayed.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {filter === 'bucket'
                ? 'No bucket-list venues yet. Add venues and flag them from the detail screen.'
                : filter === 'visited'
                  ? 'No visited venues yet.'
                  : 'No venues yet. Tap Add venue to get started.'}
            </Text>
          </View>
        ) : (
          displayed.map((v) => (
            <Pressable
              key={v.id}
              style={styles.row}
              onPress={() =>
                router.push(`/(sports)/events/venues/${v.id}` as never)
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{v.name}</Text>
                {v.city || v.sport || v.team ? (
                  <Text style={styles.rowMeta}>
                    {[v.city, v.sport, v.team].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.badges}>
                {v.visited === 1 ? (
                  <Text style={styles.visitedBadge}>✓</Text>
                ) : null}
                {v.bucket_list === 1 ? (
                  <Text style={styles.bucketBadge}>★</Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 12,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  progressCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  progressBar: {
    height: 6,
    borderRadius: 4,
    backgroundColor: surfaceTiers.lowest,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: SPORTS_ACCENT,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#0E0E13',
  },
  addCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  input: {
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fab: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
  },
  fabText: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '800',
  },
  block: {
    gap: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  visitedBadge: {
    color: SPORTS_ACCENT,
    fontSize: 16,
    fontWeight: '800',
  },
  bucketBadge: {
    color: '#FFB877',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
