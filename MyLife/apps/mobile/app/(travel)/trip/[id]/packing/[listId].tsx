import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  bulkAddPackingItems,
  createPackingItem,
  deletePackingItem,
  getPackingList,
  listPackingItems,
  PackingItemInputSchema,
  reorderPackingItems,
  togglePackingItem,
  type PackingItemRow,
  type PackingListRow,
} from '@mylife/travel';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../../../_ui';

export default function PackingListDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; listId: string }>();
  const tripId = typeof params.id === 'string' ? params.id : null;
  const listId = typeof params.listId === 'string' ? params.listId : null;

  const [list, setList] = useState<PackingListRow | null>(null);
  const [items, setItems] = useState<PackingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newCategory, setNewCategory] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!listId) {
      setError('Missing list id.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const row = getPackingList(db, listId);
      if (!row) {
        setError('Packing list not found.');
        setList(null);
        setItems([]);
      } else {
        setList(row);
        setItems(listPackingItems(db, { listId }));
      }
    } catch {
      setError('Failed to load packing list.');
    } finally {
      setLoading(false);
    }
  }, [db, listId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const grouped = useMemo(() => {
    const map = new Map<string, PackingItemRow[]>();
    for (const item of items) {
      const key = item.category ?? 'Uncategorized';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const totals = useMemo(() => {
    const total = items.length;
    const packed = items.filter((i) => i.packed === 1).length;
    const pct = total === 0 ? 0 : Math.round((packed / total) * 100);
    return { total, packed, pct };
  }, [items]);

  const handleToggle = useCallback(
    (id: string) => {
      try {
        togglePackingItem(db, id);
        reload();
      } catch {
        Alert.alert('Could not toggle item.');
      }
    },
    [db, reload],
  );

  const handleDelete = useCallback(
    (id: string) => {
      try {
        deletePackingItem(db, id);
        reload();
      } catch {
        Alert.alert('Could not delete item.');
      }
    },
    [db, reload],
  );

  const handleAdd = useCallback(() => {
    if (!listId) return;
    const qty = Number(newQty.trim() || '1');
    const candidate = {
      list_id: listId,
      label: newLabel.trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : undefined,
      category: newCategory.trim() || undefined,
    };
    const parsed = PackingItemInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? 'Invalid item.');
      return;
    }
    try {
      createPackingItem(db, parsed.data);
      setNewLabel('');
      setNewQty('1');
      setNewCategory('');
      setAddError(null);
      setShowAdd(false);
      reload();
    } catch {
      setAddError('Could not save item.');
    }
  }, [db, listId, newCategory, newLabel, newQty, reload]);

  const handleBulkAdd = useCallback(() => {
    if (!listId) return;
    const labels = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (labels.length === 0) {
      setBulkError('Enter at least one item (one per line).');
      return;
    }
    try {
      bulkAddPackingItems(db, listId, labels);
      setBulkText('');
      setBulkError(null);
      setShowBulk(false);
      reload();
    } catch {
      setBulkError('Could not add items.');
    }
  }, [bulkText, db, listId, reload]);

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const nextOrder = items.slice();
      const [moved] = nextOrder.splice(index, 1);
      nextOrder.splice(target, 0, moved);
      try {
        reorderPackingItems(
          db,
          nextOrder.map((i) => i.id),
        );
        reload();
      } catch {
        Alert.alert('Could not reorder.');
      }
    },
    [db, items, reload],
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
      </View>
    );
  }

  if (error || !list) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorTitle}>Could not load list</Text>
        <Text style={styles.errorBody}>{error ?? 'Unknown error.'}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backLink}>← Back to trip</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>PACKING LIST</Text>
        <Text style={styles.title}>{list.name}</Text>
        <Text style={styles.meta}>
          {totals.packed} / {totals.total} packed · {totals.pct}%
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${totals.pct}%` }]} />
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.placeholderTitle}>No items yet</Text>
          <Text style={styles.placeholderBody}>
            Add items one at a time or bulk-paste a list below.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {grouped.map(([category, rows]) => (
            <View key={category} style={styles.group}>
              <Text style={styles.groupTitle}>{category}</Text>
              <View style={{ gap: 8 }}>
                {rows.map((item) => {
                  const globalIndex = items.findIndex((i) => i.id === item.id);
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <Pressable
                        onPress={() => handleToggle(item.id)}
                        style={[
                          styles.checkbox,
                          item.packed === 1 && styles.checkboxChecked,
                        ]}
                        hitSlop={8}
                      >
                        {item.packed === 1 ? (
                          <Text style={styles.checkboxMark}>✓</Text>
                        ) : null}
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.itemLabel,
                            item.packed === 1 && styles.itemLabelPacked,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.quantity > 1 ? (
                          <Text style={styles.itemMeta}>Qty {item.quantity}</Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable
                          onPress={() => handleMove(globalIndex, -1)}
                          hitSlop={6}
                          style={styles.moveBtn}
                          disabled={globalIndex === 0}
                        >
                          <Text
                            style={[
                              styles.moveBtnText,
                              globalIndex === 0 && styles.moveBtnTextDisabled,
                            ]}
                          >
                            ↑
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleMove(globalIndex, 1)}
                          hitSlop={6}
                          style={styles.moveBtn}
                          disabled={globalIndex === items.length - 1}
                        >
                          <Text
                            style={[
                              styles.moveBtnText,
                              globalIndex === items.length - 1 &&
                                styles.moveBtnTextDisabled,
                            ]}
                          >
                            ↓
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(item.id)}
                          hitSlop={6}
                          style={styles.deleteBtn}
                        >
                          <Text style={styles.deleteBtnText}>×</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {showAdd ? (
        <View style={styles.inlineForm}>
          <Text style={styles.formLabel}>Label</Text>
          <TextInput
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="Sunglasses"
            placeholderTextColor={colors.textSecondary}
            style={styles.formInput}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.formLabel}>Qty</Text>
              <TextInput
                value={newQty}
                onChangeText={setNewQty}
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 2, gap: 6 }}>
              <Text style={styles.formLabel}>Category</Text>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="clothing, gear, toiletries…"
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
              />
            </View>
          </View>
          {addError ? <Text style={styles.formError}>{addError}</Text> : null}
          <View style={styles.formActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setShowAdd(false);
                setAddError(null);
                setNewLabel('');
                setNewQty('1');
                setNewCategory('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleAdd}>
              <Text style={styles.primaryButtonText}>Save item</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showBulk ? (
        <View style={styles.inlineForm}>
          <Text style={styles.formLabel}>Bulk add (one per line)</Text>
          <TextInput
            value={bulkText}
            onChangeText={setBulkText}
            placeholder={'Sunglasses\nSunscreen\nBeach towel'}
            placeholderTextColor={colors.textSecondary}
            style={[styles.formInput, { minHeight: 140 }]}
            multiline
            textAlignVertical="top"
          />
          {bulkError ? <Text style={styles.formError}>{bulkError}</Text> : null}
          <View style={styles.formActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setShowBulk(false);
                setBulkError(null);
                setBulkText('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleBulkAdd}>
              <Text style={styles.primaryButtonText}>Add all</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!showAdd && !showBulk ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              setShowAdd(true);
              setShowBulk(false);
            }}
          >
            <Text style={styles.addBtnText}>+ Add item</Text>
          </Pressable>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              setShowBulk(true);
              setShowAdd(false);
            }}
          >
            <Text style={styles.addBtnText}>+ Bulk add</Text>
          </Pressable>
        </View>
      ) : null}

      {tripId ? <View style={{ height: 12 }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  backRow: { alignSelf: 'flex-start' },
  backLink: {
    color: TRAVEL_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: TRAVEL_ACCENT,
  },
  panel: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  placeholderBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  group: {
    gap: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupTitle: {
    color: TRAVEL_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: TRAVEL_ACCENT,
    borderColor: TRAVEL_ACCENT,
  },
  checkboxMark: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '900',
  },
  itemLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  itemLabelPacked: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  moveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  moveBtnTextDisabled: {
    color: colors.textSecondary,
    opacity: 0.4,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: '#FFB4AB',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  addBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addBtnText: {
    color: TRAVEL_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineForm: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  formInput: {
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formError: {
    color: '#FFB4AB',
    fontSize: 13,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: TRAVEL_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
