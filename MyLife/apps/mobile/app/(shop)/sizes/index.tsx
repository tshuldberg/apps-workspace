import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listSizes, type Size, type SizeType } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const TYPE_ORDER: Array<{ key: SizeType; label: string; emoji: string }> = [
  { key: 'clothing', label: 'Clothing', emoji: 'T' },
  { key: 'shoe', label: 'Shoes', emoji: 'S' },
  { key: 'ring', label: 'Rings', emoji: 'R' },
  { key: 'other', label: 'Other', emoji: 'O' },
];

export default function SizesHubScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<SizeType | null>(null);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const sizes = useMemo<Size[]>(() => {
    try {
      return listSizes(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const grouped = useMemo(() => {
    const map = new Map<SizeType, Size[]>();
    for (const t of TYPE_ORDER) map.set(t.key, []);
    for (const s of sizes) map.get(s.type)!.push(s);
    return map;
  }, [sizes]);

  const total = sizes.length;
  const visibleTypes = filter
    ? TYPE_ORDER.filter((t) => t.key === filter)
    : TYPE_ORDER;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Sizes</Text>
        <Text style={styles.title}>
          {total === 0 ? 'Remember what fits' : 'Your fit memory'}
        </Text>
        <Text style={styles.subtitle}>
          Never guess a size again. Keep clothing, shoe, ring, and custom sizes
          per brand, with fit notes.
        </Text>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterPill, filter === null && styles.filterPillActive]}
          onPress={() => setFilter(null)}
        >
          <Text style={[styles.filterText, filter === null && styles.filterTextActive]}>
            All
          </Text>
        </Pressable>
        {TYPE_ORDER.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.filterPill, filter === t.key && styles.filterPillActive]}
            onPress={() => setFilter(filter === t.key ? null : t.key)}
          >
            <Text
              style={[styles.filterText, filter === t.key && styles.filterTextActive]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {total === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No sizes tracked yet</Text>
          <Text style={styles.emptyBody}>
            Add your go-to sizes per brand. MyShop will surface them when you
            save wishlist items.
          </Text>
        </View>
      ) : (
        visibleTypes.map((t) => {
          const list = grouped.get(t.key) ?? [];
          if (list.length === 0) {
            return (
              <View key={t.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>{t.label}</Text>
                  <Text style={styles.sectionCount}>0</Text>
                </View>
                <Text style={styles.sectionEmpty}>None saved</Text>
              </View>
            );
          }
          return (
            <View key={t.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t.label}</Text>
                <Text style={styles.sectionCount}>{list.length}</Text>
              </View>
              <View style={styles.pillGrid}>
                {list.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.sizePill}
                    onPress={() => router.push(`/(shop)/sizes/${s.id}`)}
                  >
                    <Text style={styles.sizePillBrand} numberOfLines={1}>
                      {s.brand}
                    </Text>
                    <Text style={styles.sizePillValue}>{s.sizeValue}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(shop)/sizes/add')}
      >
        <Text style={styles.primaryButtonText}>Add a size</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: { color: '#0E0E13' },
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
  sectionEmpty: { color: colors.textSecondary, fontSize: 12 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizePill: {
    minWidth: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  sizePillBrand: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sizePillValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
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
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
});
