import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listComparisons, type Comparison } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

export default function ResearchListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const comparisons = useMemo<Comparison[]>(() => {
    try {
      return listComparisons(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const grouped = useMemo(() => {
    const map = new Map<string, Comparison[]>();
    for (const c of comparisons) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [comparisons]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Research</Text>
        <Text style={styles.title}>
          {comparisons.length === 0 ? 'Compare before you buy' : 'Your comparisons'}
        </Text>
        <Text style={styles.subtitle}>
          Side-by-side pros and cons for the things you are weighing. Pick a
          winner, then link the comparison to the purchase you made.
        </Text>
      </View>

      <Pressable
        style={styles.primary}
        onPress={() => router.push('/(shop)/research/add')}
      >
        <Text style={styles.primaryText}>+ New comparison</Text>
      </Pressable>

      {comparisons.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No comparisons yet</Text>
          <Text style={styles.emptyBody}>
            Start a comparison the next time you are evaluating a few options
            for a purchase. The recap stays for next year you shop the same
            category.
          </Text>
        </View>
      ) : (
        grouped.map(([category, list]) => (
          <View key={category} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{category}</Text>
              <Text style={styles.sectionCount}>{list.length}</Text>
            </View>
            {list.map((c) => (
              <Pressable
                key={c.id}
                style={styles.row}
                onPress={() => router.push(`/(shop)/research/${c.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.title}</Text>
                  <Text style={styles.rowMeta}>
                    {c.items.length} option{c.items.length === 1 ? '' : 's'}
                    {c.winner ? ` · winner: ${c.winner}` : ''}
                  </Text>
                </View>
                {c.winner ? (
                  <View style={styles.winnerBadge}>
                    <Text style={styles.winnerText}>Decided</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
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
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: SHOP_ACCENT,
  },
  primaryText: { color: '#0E0E13', fontWeight: '800', fontSize: 14 },
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
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCount: {
    marginLeft: 'auto',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
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
  winnerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  winnerText: { color: SHOP_ACCENT, fontSize: 11, fontWeight: '800' },
});
