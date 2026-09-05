import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  checkItem,
  createPackingItem,
  createPackingTemplate,
  deletePackingItem,
  GearRow,
  getPackingItems,
  getPackingTemplate,
  getSetting,
  MaterialSymbol,
  setSetting,
  uncheckItem,
  updatePackingItem,
} from '@mylife/trails';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  TrailsChip,
  TrailsEmptyState,
  TrailsGlassCard,
  TrailsHero,
  TrailsPrimaryButton,
  TrailsScreen,
} from './_ui';
import {
  PACKING_CATEGORY_ORDER,
  estimateItemWeightGrams,
  formatPackingCategory,
  formatWeight,
  groupPackingItems,
  isConsumableCategory,
  type PackingItemGroup,
} from './phase6-utils';

const GEAR_TEMPLATE_ID = 'gear-closet';
const GEAR_META_KEY = 'trails.gear.meta.v1';
const FILTERS = ['all', 'owned', 'wishlist', 'broken'] as const;
const CATEGORY_OPTIONS = [
  'shelter',
  'sleep',
  'kitchen',
  'clothing',
  'safety',
  'navigation',
  'food_water',
  'misc',
] as const;

type GearFilter = (typeof FILTERS)[number];
type GearStatus = Exclude<GearFilter, 'all'>;
type GearCategory = (typeof CATEGORY_OPTIONS)[number];

interface GearMeta {
  status?: GearStatus;
  weightGrams?: number;
}

interface GearDraft {
  itemIds: string[];
  name: string;
  category: GearCategory;
  status: GearStatus;
  weightText: string;
}

interface GearInventoryGroup extends PackingItemGroup {
  status: GearStatus;
  unitWeightGrams: number;
  totalWeightGrams: number;
}

const CATEGORY_ICON: Record<string, string> = {
  shelter: 'home',
  sleep: 'favorite',
  kitchen: 'backpack',
  clothing: 'hiking',
  safety: 'warning',
  navigation: 'map',
  food_water: 'opacity',
  misc: 'backpack',
};

function readGearMeta(raw: string | null): Record<string, GearMeta> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, GearMeta>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatStatusLabel(status: GearStatus): string {
  switch (status) {
    case 'owned':
      return 'Owned';
    case 'wishlist':
      return 'Wishlist';
    case 'broken':
      return 'Broken';
  }
}

function weightToPounds(grams: number): string {
  return `${(grams / 453.592).toFixed(1)} lb`;
}

export default function GearScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<GearFilter>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<GearDraft | null>(null);

  useEffect(() => {
    try {
      if (!getPackingTemplate(db, GEAR_TEMPLATE_ID)) {
        createPackingTemplate(db, GEAR_TEMPLATE_ID, 'Gear Closet', 'custom', false);
        setTick((current) => current + 1);
      }
    } catch {
      Alert.alert('Gear unavailable', 'MyTrails could not prepare your gear closet.');
    }
  }, [db]);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  const metaById = useMemo(
    () => readGearMeta(getSetting(db, GEAR_META_KEY)),
    [db, tick],
  );

  const items = useMemo(() => {
    try {
      return getPackingItems(db, GEAR_TEMPLATE_ID);
    } catch {
      return [];
    }
  }, [db, tick]);

  const groups = useMemo<GearInventoryGroup[]>(() => groupPackingItems(items).map((group) => {
    const firstMeta = metaById[group.itemIds[0] ?? ''];
    const status: GearStatus = firstMeta?.status
      ?? (group.allChecked ? 'owned' : 'wishlist');
    const unitWeightGrams = firstMeta?.weightGrams
      ?? estimateItemWeightGrams(group.name, group.category);

    return {
      ...group,
      status,
      unitWeightGrams,
      totalWeightGrams: unitWeightGrams * group.quantity,
    };
  }), [items, metaById]);

  const categories = useMemo(() => {
    const present = Array.from(new Set(groups.map((group) => group.category)));
    const ordered = PACKING_CATEGORY_ORDER.filter((category) => present.includes(category));
    const extras = present.filter((category) => !ordered.includes(category as never)).sort();
    return [...ordered, ...extras];
  }, [groups]);

  const filteredGroups = useMemo(
    () => groups.filter((group) => filter === 'all' || group.status === filter),
    [filter, groups],
  );

  const groupsByCategory = useMemo(() => {
    const next = new Map<string, GearInventoryGroup[]>();
    filteredGroups.forEach((group) => {
      const existing = next.get(group.category);
      if (existing) {
        existing.push(group);
      } else {
        next.set(group.category, [group]);
      }
    });
    return next;
  }, [filteredGroups]);

  const summary = useMemo(() => filteredGroups.reduce(
    (acc, group) => {
      acc.totalItems += group.quantity;
      acc.totalWeightGrams += group.totalWeightGrams;
      acc.categories.add(group.category);
      acc.statusCounts[group.status] += group.quantity;
      if (isConsumableCategory(group.category)) {
        acc.consumablesGrams += group.totalWeightGrams;
      } else {
        acc.baseWeightGrams += group.totalWeightGrams;
      }
      return acc;
    },
    {
      totalItems: 0,
      totalWeightGrams: 0,
      consumablesGrams: 0,
      baseWeightGrams: 0,
      categories: new Set<string>(),
      statusCounts: {
        owned: 0,
        wishlist: 0,
        broken: 0,
      } as Record<GearStatus, number>,
    },
  ), [filteredGroups]);

  const persistMeta = useCallback((updater: (current: Record<string, GearMeta>) => Record<string, GearMeta>) => {
    const next = updater(readGearMeta(getSetting(db, GEAR_META_KEY)));
    setSetting(db, GEAR_META_KEY, JSON.stringify(next));
  }, [db]);

  const openAddModal = useCallback((category?: string) => {
    setDraft({
      itemIds: [],
      name: '',
      category: (category as GearCategory | undefined) ?? 'shelter',
      status: 'owned',
      weightText: '',
    });
  }, []);

  const openEditModal = useCallback((group: GearInventoryGroup) => {
    setDraft({
      itemIds: group.itemIds,
      name: group.name,
      category: (CATEGORY_OPTIONS.includes(group.category as GearCategory) ? group.category : 'misc') as GearCategory,
      status: group.status,
      weightText: `${group.unitWeightGrams}`,
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((current) => ({
      ...current,
      [category]: current[category] === undefined ? false : !current[category],
    }));
  }, []);

  const updateGroupStatus = useCallback((group: GearInventoryGroup, status: GearStatus) => {
    try {
      group.itemIds.forEach((itemId) => {
        if (status === 'owned') {
          checkItem(db, itemId);
        } else {
          uncheckItem(db, itemId);
        }
      });

      persistMeta((current) => {
        const next = { ...current };
        group.itemIds.forEach((itemId) => {
          next[itemId] = {
            ...next[itemId],
            status,
            weightGrams: next[itemId]?.weightGrams ?? group.unitWeightGrams,
          };
        });
        return next;
      });

      refresh();
    } catch {
      Alert.alert('Unable to update gear', 'MyTrails could not change that gear status.');
    }
  }, [db, persistMeta, refresh]);

  const saveDraft = useCallback(() => {
    if (!draft) {
      return;
    }

    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this gear item a name before saving.');
      return;
    }

    const parsedWeight = Number.parseInt(draft.weightText, 10);
    const weightGrams = Number.isFinite(parsedWeight) && parsedWeight > 0
      ? parsedWeight
      : estimateItemWeightGrams(name, draft.category);

    try {
      if (draft.itemIds.length > 0) {
        draft.itemIds.forEach((itemId, index) => {
          updatePackingItem(db, itemId, {
            name,
            category: draft.category,
            isChecked: draft.status === 'owned',
            sortOrder: index,
          });
        });
      } else {
        const itemId = uuid();
        createPackingItem(db, itemId, {
          templateId: GEAR_TEMPLATE_ID,
          name,
          category: draft.category,
          sortOrder: items.length,
        });

        if (draft.status === 'owned') {
          checkItem(db, itemId);
        }

        draft.itemIds = [itemId];
      }

      persistMeta((current) => {
        const next = { ...current };
        draft.itemIds.forEach((itemId) => {
          next[itemId] = {
            status: draft.status,
            weightGrams,
          };
        });
        return next;
      });

      setDraft(null);
      refresh();
    } catch {
      Alert.alert('Save failed', 'MyTrails could not save this gear item.');
    }
  }, [db, draft, items.length, persistMeta, refresh]);

  const deleteDraft = useCallback(() => {
    if (!draft || draft.itemIds.length === 0) {
      setDraft(null);
      return;
    }

    Alert.alert('Delete gear item?', 'This removes the item from your gear closet.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            draft.itemIds.forEach((itemId) => deletePackingItem(db, itemId));
            persistMeta((current) => {
              const next = { ...current };
              draft.itemIds.forEach((itemId) => delete next[itemId]);
              return next;
            });
            setDraft(null);
            refresh();
          } catch {
            Alert.alert('Delete failed', 'MyTrails could not remove this gear item.');
          }
        },
      },
    ]);
  }, [db, draft, persistMeta, refresh]);

  const weightThresholdCopy = useMemo(() => {
    const pounds = summary.baseWeightGrams / 453.592;
    if (pounds <= 10) {
      return 'Ultralight target hit';
    }
    if (pounds <= 20) {
      return 'Comfortable overnight load';
    }
    return 'Above typical backpacking base weight';
  }, [summary.baseWeightGrams]);

  return (
    <>
      <TrailsScreen>
        <TrailsHero
          title="Gear Closet"
          subtitle="Track owned gear, wishlist pieces, and broken kit with a base-weight view built for real trail planning."
          action={(
            <Pressable onPress={() => openAddModal()}>
              <MaterialSymbol name="add" size={22} color={colors.modules.trails} />
            </Pressable>
          )}
        />

        <View style={styles.summaryRow}>
          <MetricCard label="Total Items" value={`${summary.totalItems}`} hint={`${summary.statusCounts.owned} owned`} />
          <MetricCard label="Trail Weight" value={formatWeight(summary.totalWeightGrams)} hint={weightToPounds(summary.totalWeightGrams)} />
          <MetricCard label="Categories" value={`${summary.categories.size}`} hint="Active kit zones" />
        </View>

        <TrailsGlassCard style={styles.filterCard}>
          <Text variant="caption" color={colors.textSecondary}>
            Filter by kit status
          </Text>
          <View style={styles.filterRow}>
            {FILTERS.map((value) => (
              <TrailsChip
                key={value}
                label={value === 'all' ? 'All' : formatStatusLabel(value)}
                active={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </View>
        </TrailsGlassCard>

        <TrailsGlassCard style={styles.weightCard}>
          <View style={styles.weightCardHeader}>
            <View>
              <Text variant="subheading">Base Weight Calculator</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Consumables stay separate so trip planning stays honest.
              </Text>
            </View>
            <View style={styles.weightBadge}>
              <Text variant="caption" style={styles.weightBadgeText}>
                {weightThresholdCopy}
              </Text>
            </View>
          </View>
          <View style={styles.weightBreakdown}>
            <WeightPill label="Base" value={formatWeight(summary.baseWeightGrams)} />
            <WeightPill label="Consumables" value={formatWeight(summary.consumablesGrams)} />
            <WeightPill label="Goal" value={weightToPounds(summary.baseWeightGrams)} />
          </View>
        </TrailsGlassCard>

        {categories.length === 0 ? (
          <TrailsEmptyState
            icon="🎒"
            title="No gear inventory yet"
            copy="Start your gear closet with shelters, sleep systems, and safety essentials."
            action={<TrailsPrimaryButton label="Add first item" onPress={() => openAddModal('shelter')} />}
          />
        ) : null}

        {categories.map((category) => {
          const categoryGroups = groupsByCategory.get(category) ?? [];
          if (categoryGroups.length === 0) {
            return null;
          }

          const isExpanded = expandedCategories[category] ?? true;
          const totalWeight = categoryGroups.reduce((total, group) => total + group.totalWeightGrams, 0);

          return (
            <TrailsGlassCard key={category} style={styles.categoryCard}>
              <Pressable onPress={() => toggleCategory(category)} style={styles.categoryHeader}>
                <View style={styles.categoryTitleWrap}>
                  <View style={styles.categoryIconWrap}>
                    <MaterialSymbol
                      name={CATEGORY_ICON[category] ?? 'backpack'}
                      size={18}
                      color={colors.modules.trails}
                    />
                  </View>
                  <View>
                    <Text variant="subheading">{formatPackingCategory(category)}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {categoryGroups.length} items · {formatWeight(totalWeight)}
                    </Text>
                  </View>
                </View>
                <MaterialSymbol
                  name={isExpanded ? 'close' : 'add'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {isExpanded ? (
                <View style={styles.categoryBody}>
                  {categoryGroups.map((group) => (
                    <View key={group.key} style={styles.gearItemCard}>
                      <GearRow
                        gear={{
                          name: group.name,
                          category: formatPackingCategory(group.category),
                          icon: CATEGORY_ICON[group.category] ?? 'backpack',
                        }}
                        weight={`${formatWeight(group.unitWeightGrams)} each`}
                        owned={group.status === 'owned'}
                        onPress={() => openEditModal(group)}
                      />
                      <View style={styles.rowMeta}>
                        <Text variant="caption" color={colors.textSecondary}>
                          Qty {group.quantity} · Total {formatWeight(group.totalWeightGrams)}
                        </Text>
                        <View style={styles.inlineSwitch}>
                          <Text variant="caption" color={colors.textSecondary}>
                            Owned
                          </Text>
                          <Switch
                            value={group.status === 'owned'}
                            onValueChange={(value) => updateGroupStatus(group, value ? 'owned' : 'wishlist')}
                            trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(101,163,13,0.28)' }}
                            thumbColor={group.status === 'owned' ? colors.modules.trails : colors.textTertiary}
                          />
                        </View>
                      </View>
                      <View style={styles.statusRow}>
                        {(['owned', 'wishlist', 'broken'] as GearStatus[]).map((status) => (
                          <TrailsChip
                            key={status}
                            label={formatStatusLabel(status)}
                            active={group.status === status}
                            onPress={() => updateGroupStatus(group, status)}
                          />
                        ))}
                        <Pressable onPress={() => openEditModal(group)} style={styles.editButton}>
                          <Text variant="caption" style={styles.editButtonText}>
                            Edit
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  <Pressable onPress={() => openAddModal(category)} style={styles.addCategoryButton}>
                    <MaterialSymbol name="add" size={18} color={colors.modules.trails} />
                    <Text variant="label" style={styles.addCategoryText}>
                      Add Item
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </TrailsGlassCard>
          );
        })}
      </TrailsScreen>

      <Modal
        visible={draft !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setDraft(null)}
      >
        <View style={styles.modalBackdrop}>
          <TrailsGlassCard style={styles.modalCard}>
            <Text variant="subheading">
              {draft?.itemIds.length ? 'Edit gear item' : 'Add gear item'}
            </Text>

            <View style={styles.field}>
              <Text variant="caption" color={colors.textSecondary}>
                Item name
              </Text>
              <TextInput
                value={draft?.name ?? ''}
                onChangeText={(value) => setDraft((current) => current ? { ...current, name: value } : current)}
                placeholder="Bear canister"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text variant="caption" color={colors.textSecondary}>
                Category
              </Text>
              <View style={styles.filterRow}>
                {CATEGORY_OPTIONS.map((category) => (
                  <TrailsChip
                    key={category}
                    label={formatPackingCategory(category)}
                    active={draft?.category === category}
                    onPress={() => setDraft((current) => current ? { ...current, category } : current)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text variant="caption" color={colors.textSecondary}>
                Weight in grams
              </Text>
              <TextInput
                value={draft?.weightText ?? ''}
                onChangeText={(value) => setDraft((current) => current ? { ...current, weightText: value } : current)}
                keyboardType="number-pad"
                placeholder={`${estimateItemWeightGrams(draft?.name || 'Gear', draft?.category || 'misc')}`}
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text variant="caption" color={colors.textSecondary}>
                Status
              </Text>
              <View style={styles.filterRow}>
                {(['owned', 'wishlist', 'broken'] as GearStatus[]).map((status) => (
                  <TrailsChip
                    key={status}
                    label={formatStatusLabel(status)}
                    active={draft?.status === status}
                    onPress={() => setDraft((current) => current ? { ...current, status } : current)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setDraft(null)} style={styles.secondaryButton}>
                <Text variant="label" color={colors.textSecondary}>
                  Cancel
                </Text>
              </Pressable>
              {draft?.itemIds.length ? (
                <Pressable onPress={deleteDraft} style={styles.deleteButton}>
                  <Text variant="label" style={styles.deleteButtonText}>
                    Delete
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <TrailsPrimaryButton
              label={draft?.itemIds.length ? 'Save gear item' : 'Add gear item'}
              onPress={saveDraft}
            />
          </TrailsGlassCard>
        </View>
      </Modal>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <TrailsGlassCard style={styles.metricCard}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="heading" style={styles.metricValue}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textTertiary}>
        {hint}
      </Text>
    </TrailsGlassCard>
  );
}

function WeightPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.weightPill}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="label" style={styles.weightPillValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: 104,
    gap: spacing.xs,
  },
  metricValue: {
    color: colors.modules.trails,
    lineHeight: 34,
  },
  filterCard: {
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weightCard: {
    gap: spacing.md,
  },
  weightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weightBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(101,163,13,0.16)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  weightBadgeText: {
    color: colors.modules.trails,
    fontWeight: '700',
  },
  weightBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weightPill: {
    minWidth: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  weightPillValue: {
    color: colors.text,
  },
  categoryCard: {
    gap: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(101,163,13,0.14)',
  },
  categoryBody: {
    gap: spacing.md,
  },
  gearItemCard: {
    gap: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.sm,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingLeft: 52,
  },
  inlineSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 52,
  },
  editButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: 'rgba(101,163,13,0.12)',
    paddingVertical: spacing.sm,
  },
  addCategoryText: {
    color: colors.modules.trails,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.72)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  input: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: spacing.sm,
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 69, 58, 0.16)',
    paddingVertical: spacing.sm,
  },
  deleteButtonText: {
    color: colors.danger,
  },
});
