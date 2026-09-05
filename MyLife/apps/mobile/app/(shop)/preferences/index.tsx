import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  listPreferences,
  type Preference,
  type PreferenceCategory,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const CATEGORIES: Array<{
  key: PreferenceCategory;
  label: string;
  color: string;
}> = [
  { key: 'tech', label: 'Tech', color: '#8BCFF0' },
  { key: 'household', label: 'Household', color: '#A78BFA' },
  { key: 'color', label: 'Color', color: '#FFB877' },
  { key: 'brand', label: 'Brand', color: SHOP_ACCENT },
  { key: 'material', label: 'Material', color: '#FBBF24' },
  { key: 'allergy', label: 'Allergy', color: '#EF4444' },
];

export default function PreferencesHubScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const all = useMemo<Preference[]>(() => {
    try {
      return listPreferences(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const grouped = useMemo(() => {
    const map = new Map<PreferenceCategory, Preference[]>();
    for (const c of CATEGORIES) map.set(c.key, []);
    for (const p of all) map.get(p.category)!.push(p);
    return map;
  }, [all]);

  const total = all.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Preferences</Text>
        <Text style={styles.title}>
          {total === 0 ? 'Remember what you like' : 'Your shopping profile'}
        </Text>
        <Text style={styles.subtitle}>
          Store the details you always forget: tech preferences, household
          staples, colors, allergies, and favorite brands.
        </Text>
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const list = grouped.get(cat.key) ?? [];
          return (
            <Pressable
              key={cat.key}
              style={styles.cell}
              onPress={() => router.push(`/(shop)/preferences/${cat.key}`)}
            >
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={styles.cellTitle}>{cat.label}</Text>
              <Text style={styles.cellCount}>
                {list.length} {list.length === 1 ? 'entry' : 'entries'}
              </Text>
              {list.slice(0, 2).map((p) => (
                <Text key={p.id} style={styles.cellPreview} numberOfLines={1}>
                  {p.key}: {p.value}
                </Text>
              ))}
              {list.length === 0 ? (
                <Text style={styles.cellEmpty}>Tap to add</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 140,
    padding: 14,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cellTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cellCount: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cellPreview: { color: colors.textSecondary, fontSize: 12 },
  cellEmpty: {
    color: colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
