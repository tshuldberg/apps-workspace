import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  getCollectionValue,
  listMemorabilia,
  type CollectionValue,
  type Memorabilia,
  type MemorabiliaType,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

type ViewMode = 'grid' | 'list';
type TypeFilter = 'all' | MemorabiliaType;

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'card', label: 'Cards' },
  { id: 'jersey', label: 'Jerseys' },
  { id: 'signed', label: 'Signed' },
  { id: 'ticket', label: 'Tickets' },
  { id: 'ball', label: 'Balls' },
  { id: 'hat', label: 'Hats' },
  { id: 'other', label: 'Other' },
];

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

function signedCents(cents: number): string {
  const s = formatCents(Math.abs(cents));
  if (cents > 0) return `+${s}`;
  if (cents < 0) return `−${s}`;
  return s;
}

function subtitleFor(item: Memorabilia): string {
  const parts = [item.sport, item.team, item.player].filter(
    (p): p is string => !!p && p.trim() !== '',
  );
  return parts.join(' · ');
}

export default function SportsMemorabiliaScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [rows, setRows] = useState<Memorabilia[]>([]);
  const [value, setValue] = useState<CollectionValue | null>(null);
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [mode, setMode] = useState<ViewMode>('grid');

  const reload = useCallback(() => {
    const filters = filter === 'all' ? {} : { itemType: filter };
    setRows(listMemorabilia(db, filters));
    setValue(getCollectionValue(db));
  }, [db, filter]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const appreciationColor = useMemo(() => {
    if (!value) return colors.text;
    if (value.appreciationCents > 0) return SPORTS_ACCENT;
    if (value.appreciationCents < 0) return '#F87171';
    return colors.text;
  }, [value]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Collection</Text>
      <Text style={styles.title}>Memorabilia</Text>
      <Text style={styles.subtitle}>
        Cards, jerseys, signed items, tickets. Private to this device.
      </Text>

      <View style={styles.valueStrip}>
        <View style={styles.valueCell}>
          <Text style={styles.valueLabel}>Items</Text>
          <Text style={styles.valueNumber}>{value?.itemCount ?? 0}</Text>
        </View>
        <View style={styles.valueCell}>
          <Text style={styles.valueLabel}>Paid</Text>
          <Text style={styles.valueNumber}>
            {formatCents(value?.purchaseTotalCents ?? 0)}
          </Text>
        </View>
        <View style={styles.valueCell}>
          <Text style={styles.valueLabel}>Est. value</Text>
          <Text style={styles.valueNumber}>
            {formatCents(value?.estimatedTotalCents ?? 0)}
          </Text>
        </View>
        <View style={styles.valueCell}>
          <Text style={styles.valueLabel}>Change</Text>
          <Text style={[styles.valueNumber, { color: appreciationColor }]}>
            {signedCents(value?.appreciationCents ?? 0)}
          </Text>
        </View>
      </View>

      <View style={styles.ctaRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push('/(sports)/events/memorabilia/add' as never)
          }
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Add item</Text>
        </Pressable>
        <View style={styles.toggleGroup}>
          <Pressable
            onPress={() => setMode('grid')}
            style={[styles.toggleBtn, mode === 'grid' && styles.toggleBtnActive]}
          >
            <Text
              style={[
                styles.toggleText,
                mode === 'grid' && styles.toggleTextActive,
              ]}
            >
              Grid
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('list')}
            style={[styles.toggleBtn, mode === 'list' && styles.toggleBtnActive]}
          >
            <Text
              style={[
                styles.toggleText,
                mode === 'list' && styles.toggleTextActive,
              ]}
            >
              List
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {TYPE_FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No memorabilia yet. Tap Add item to start tracking your collection.
          </Text>
        </View>
      ) : mode === 'grid' ? (
        <View style={styles.grid}>
          {rows.map((item) => {
            const sub = subtitleFor(item);
            return (
              <Pressable
                key={item.id}
                style={styles.gridTile}
                onPress={() =>
                  router.push(
                    `/(sports)/events/memorabilia/${item.id}` as never,
                  )
                }
                accessibilityRole="button"
              >
                <View style={styles.tileTypeBadge}>
                  <Text style={styles.tileTypeText}>
                    {item.item_type.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.description}
                </Text>
                {sub ? (
                  <Text style={styles.tileSub} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
                <Text style={styles.tileValue}>
                  {formatCents(item.estimated_value_cents)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((item) => {
            const sub = subtitleFor(item);
            return (
              <Pressable
                key={item.id}
                style={styles.listRow}
                onPress={() =>
                  router.push(
                    `/(sports)/events/memorabilia/${item.id}` as never,
                  )
                }
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.description}</Text>
                  <Text style={styles.rowMeta}>
                    {item.item_type}
                    {sub ? ` · ${sub}` : ''}
                  </Text>
                </View>
                <Text style={styles.rowValue}>
                  {formatCents(item.estimated_value_cents)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 140, gap: 12 },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  valueStrip: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valueCell: { flex: 1, gap: 4 },
  valueLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  valueNumber: { color: colors.text, fontSize: 16, fontWeight: '800' },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: SPORTS_ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  toggleGroup: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  toggleBtnActive: { backgroundColor: SPORTS_ACCENT },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextActive: { color: '#0E0E13' },
  filterRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: { color: '#0E0E13' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridTile: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    minHeight: 120,
  },
  tileTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  tileTypeText: {
    color: SPORTS_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tileTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  tileSub: { color: colors.textSecondary, fontSize: 12 },
  tileValue: {
    color: SPORTS_ACCENT,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 'auto',
  },
  list: { gap: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  rowValue: { color: SPORTS_ACCENT, fontSize: 14, fontWeight: '800' },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
