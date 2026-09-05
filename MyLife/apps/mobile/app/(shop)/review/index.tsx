import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listPurchases } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

function parseYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})/.exec(dateStr);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

export default function ReviewIndexScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const years = useMemo<number[]>(() => {
    try {
      const purchases = listPurchases(db);
      const set = new Set<number>();
      for (const p of purchases) {
        const y = parseYear(p.purchaseDate);
        if (y != null) set.add(y);
      }
      const current = new Date().getFullYear();
      set.add(current);
      return Array.from(set).sort((a, b) => b - a);
    } catch {
      return [new Date().getFullYear()];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Year in Review</Text>
        <Text style={styles.title}>Look back at a year of buying</Text>
        <Text style={styles.subtitle}>
          Total spend, top categories, best and worst purchases, gift summary,
          warranty wins, and the impulse audit. Pick a year.
        </Text>
      </View>

      {years.map((year) => (
        <Pressable
          key={year}
          style={styles.row}
          onPress={() => router.push(`/(shop)/review/${year}`)}
        >
          <Text style={styles.rowYear}>{year}</Text>
          <Text style={styles.rowChevron}>{'>'}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 12 },
  header: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowYear: { color: colors.text, fontSize: 18, fontWeight: '800' },
  rowChevron: { color: colors.textSecondary, fontSize: 22, fontWeight: '700' },
});
