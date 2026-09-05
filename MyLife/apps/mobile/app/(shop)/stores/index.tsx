import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listStoreNotes, type StoreNote } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

export default function StoreNotesListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const notes = useMemo<StoreNote[]>(() => {
    try {
      return listStoreNotes(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.storeName.toLowerCase().includes(q));
  }, [notes, query]);

  const goToStore = (name: string) => {
    router.push(`/(shop)/stores/${encodeURIComponent(name)}`);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Stores</Text>
        <Text style={styles.title}>
          {notes.length === 0 ? 'Remember the fine print' : 'Your store notes'}
        </Text>
        <Text style={styles.subtitle}>
          Stash returns policies, shipping quirks, and rewards perks for the
          stores you actually use. Local only.
        </Text>
      </View>

      <View style={styles.searchCard}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search a store name"
          placeholderTextColor={colors.textSecondary}
        />
        {query.trim().length > 0 ? (
          <Pressable
            style={styles.primary}
            onPress={() => goToStore(query.trim())}
          >
            <Text style={styles.primaryText}>
              + Add or open &quot;{query.trim()}&quot;
            </Text>
          </Pressable>
        ) : null}
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No stores yet</Text>
          <Text style={styles.emptyBody}>
            Type a store name above to start a note. The next time you shop
            there you will know exactly how returns and rewards work.
          </Text>
        </View>
      ) : (
        filtered.map((n) => (
          <Pressable
            key={n.id}
            style={styles.row}
            onPress={() => goToStore(n.storeName)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{n.storeName}</Text>
              <Text style={styles.rowMeta} numberOfLines={2}>
                {summarize(n)}
              </Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function summarize(n: StoreNote): string {
  const bits: string[] = [];
  if (n.returnsPolicy) bits.push('returns');
  if (n.shippingNotes) bits.push('shipping');
  if (n.rewardsNotes) bits.push('rewards');
  if (bits.length === 0) return 'Empty note. Tap to add details.';
  return bits.join(' · ');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 14 },
  header: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  searchCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: SHOP_ACCENT,
  },
  primaryText: { color: '#0E0E13', fontWeight: '800', fontSize: 13 },
  emptyCard: {
    gap: 6,
    padding: 20,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowChevron: { color: colors.textSecondary, fontSize: 20, fontWeight: '700' },
});
