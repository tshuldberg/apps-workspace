import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  checkItem,
  createPackingItem,
  createTrip,
  deletePackingItem,
  getPackingItems,
  getPackingTemplate,
  MaterialSymbol,
  PackingRow,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  uncheckItem,
  updateTrip,
  type PackingTemplate,
} from '@mylife/trails';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { TrailsGlassCard, TrailsHero, TrailsPrimaryButton, TrailsScreen } from '../_ui';
import {
  PACKING_CATEGORY_ORDER,
  computePackingTotals,
  formatPackingCategory,
  formatWeight,
  groupPackingItems,
  type PackingItemGroup,
} from '../phase6-utils';

const ACCENT = colors.modules.trails;

export default function PackingChecklistScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [newItem, setNewItem] = useState('');
  const [draftCategory, setDraftCategory] = useState('essentials');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const templateState = useMemo(() => {
    try {
      return {
        template: id ? getPackingTemplate(db, id) : null,
        error: null,
      };
    } catch {
      return {
        template: null,
        error: 'Failed to load checklist.',
      };
    }
  }, [db, id, tick]);

  const items = useMemo(() => {
    if (!id) {
      return [];
    }
    try {
      return getPackingItems(db, id);
    } catch {
      return [];
    }
  }, [db, id, tick]);

  const template = templateState.template as PackingTemplate | null;
  const error = templateState.error;

  const groups = useMemo(() => groupPackingItems(items), [items]);
  const totals = useMemo(() => computePackingTotals(groups), [groups]);

  const categories = useMemo(() => {
    const present = Array.from(new Set(groups.map((group) => group.category)));
    const ordered = PACKING_CATEGORY_ORDER.filter((category) => present.includes(category));
    const extras = present.filter((category) => !ordered.includes(category as never)).sort();
    return [...ordered, ...extras];
  }, [groups]);

  const groupsByCategory = useMemo(() => {
    const byCategory = new Map<string, PackingItemGroup[]>();
    groups.forEach((group) => {
      const existing = byCategory.get(group.category);
      if (existing) {
        existing.push(group);
      } else {
        byCategory.set(group.category, [group]);
      }
    });
    return byCategory;
  }, [groups]);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  const handleToggle = useCallback(
    (group: PackingItemGroup) => {
      try {
        const shouldUncheck = group.allChecked;
        group.itemIds.forEach((itemId) => {
          if (shouldUncheck) {
            uncheckItem(db, itemId);
          } else {
            checkItem(db, itemId);
          }
        });
        refresh();
      } catch {
        Alert.alert('Error', 'Could not update item state.');
      }
    },
    [db, refresh],
  );

  const handleIncrement = useCallback(
    (group: PackingItemGroup) => {
      if (!id) {
        return;
      }
      try {
        createPackingItem(db, uuid(), {
          templateId: id,
          name: group.name,
          category: group.category,
          sortOrder: group.sortOrder + group.quantity,
        });
        refresh();
      } catch {
        Alert.alert('Error', 'Could not update the quantity.');
      }
    },
    [db, id, refresh],
  );

  const handleDecrement = useCallback(
    (group: PackingItemGroup) => {
      if (group.quantity <= 1) {
        Alert.alert('Remove Item', `Delete "${group.name}" from this list?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              try {
                deletePackingItem(db, group.itemIds[group.itemIds.length - 1]);
                refresh();
              } catch {
                Alert.alert('Error', 'Could not remove the item.');
              }
            },
          },
        ]);
        return;
      }

      try {
        deletePackingItem(db, group.itemIds[group.itemIds.length - 1]);
        refresh();
      } catch {
        Alert.alert('Error', 'Could not update the quantity.');
      }
    },
    [db, refresh],
  );

  const handleDeleteGroup = useCallback(
    (group: PackingItemGroup) => {
      Alert.alert('Delete Item', `Remove "${group.name}" from this list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              group.itemIds.forEach((itemId) => deletePackingItem(db, itemId));
              refresh();
            } catch {
              Alert.alert('Error', 'Could not remove the item.');
            }
          },
        },
      ]);
    },
    [db, refresh],
  );

  const handleAdd = useCallback(() => {
    if (!id || !newItem.trim()) {
      return;
    }

    try {
      createPackingItem(db, uuid(), {
        templateId: id,
        name: newItem.trim(),
        category: draftCategory,
        sortOrder: groups.length,
      });
      setNewItem('');
      setActiveCategory(null);
      refresh();
    } catch {
      Alert.alert('Error', 'Failed to add item.');
    }
  }, [db, draftCategory, groups.length, id, newItem, refresh]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }, []);

  const handleStartTrip = useCallback(() => {
    if (!template) {
      return;
    }

    try {
      const trip = createTrip(db, uuid(), {
        name: template.name,
      });
      updateTrip(db, trip.id, { packingTemplateId: template.id });
      router.push(`/(trails)/trip/${trip.id}` as `/${string}`);
    } catch {
      Alert.alert('Error', 'Failed to create a trip from this list.');
    }
  }, [db, router, template]);

  const progress = {
    checked: totals.checkedCount,
    total: totals.totalCount,
  };

  const percent = progress.total > 0 ? progress.checked / progress.total : 0;

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text variant="subheading" color={colors.danger}>{error}</Text>
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 40 }}>🔍</Text>
        <Text variant="subheading" color={colors.textSecondary}>Checklist not found</Text>
      </View>
    );
  }

  return (
    <TrailsScreen contentContainerStyle={styles.content}>
      <TrailsHero
        title={template.name}
        subtitle={`${progress.checked}/${progress.total} packed · ${formatWeight(totals.totalWeightGrams)} estimated carry weight.`}
        action={(
          <Pressable onPress={() => router.push('/(trails)/packing')} style={styles.manageButton}>
            <MaterialSymbol name="settings" size={16} color="#102108" />
            <Text variant="caption" style={styles.manageButtonText}>
              Lists
            </Text>
          </Pressable>
        )}
      />

      <TrailsGlassCard style={styles.summaryCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text variant="label" color={colors.textTertiary}>
              PROGRESS
            </Text>
            <Text variant="subheading">{Math.round(percent * 100)}% trail-ready</Text>
          </View>
          <View style={styles.weightCallout}>
            <Text variant="caption" color={colors.textTertiary}>
              Total Weight
            </Text>
            <Text variant="body" style={styles.weightCalloutValue}>
              {formatWeight(totals.totalWeightGrams)}
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent * 100}%` }]} />
        </View>
        <View style={styles.summaryMeta}>
          <MetaPill label={`${progress.checked} packed`} />
          <MetaPill label={`${progress.total - progress.checked} remaining`} />
          <MetaPill label={`${categories.length} sections`} />
        </View>
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.quickAddCard}>
        <View style={styles.quickAddHeader}>
          <View>
            <Text variant="label" color={colors.textTertiary}>
              QUICK ADD
            </Text>
            <Text variant="subheading">
              {activeCategory ? `Add to ${formatPackingCategory(activeCategory)}` : 'Add a custom item'}
            </Text>
          </View>
          {activeCategory ? (
            <Pressable onPress={() => setActiveCategory(null)}>
              <Text variant="label" style={styles.secondaryAction}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
        <TextInput
          placeholder="Map, stove kit, puffy layer..."
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={handleAdd}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {['essentials', ...categories.filter((category) => category !== 'essentials')].map((category) => (
            <Pressable
              key={category}
              onPress={() => {
                setDraftCategory(category);
                setActiveCategory(category);
              }}
              style={[
                styles.categoryChip,
                draftCategory === category && styles.categoryChipActive,
              ]}
            >
              <Text
                variant="caption"
                style={[
                  styles.categoryChipText,
                  draftCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {formatPackingCategory(category)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <TrailsPrimaryButton label="Add Item" onPress={handleAdd} />
      </TrailsGlassCard>

      {categories.map((category) => {
        const categoryGroups = groupsByCategory.get(category) ?? [];
        const categoryTotals = computePackingTotals(categoryGroups);
        const isExpanded = expandedCategories[category] ?? true;

        return (
          <TrailsGlassCard key={category} style={styles.categoryCard}>
            <Pressable onPress={() => toggleCategory(category)} style={styles.categoryHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.textTertiary}>
                  {formatPackingCategory(category)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {categoryTotals.checkedCount}/{categoryTotals.totalCount} packed · {formatWeight(categoryTotals.totalWeightGrams)}
                </Text>
              </View>
              <View style={styles.categoryActions}>
                <Pressable
                  onPress={() => {
                    setDraftCategory(category);
                    setActiveCategory(category);
                  }}
                  style={styles.smallAction}
                >
                  <MaterialSymbol name="add" size={14} color={TR_ACCENT_LIGHT} />
                </Pressable>
                <MaterialSymbol
                  name="more_vert"
                  size={16}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                />
              </View>
            </Pressable>

            {isExpanded ? (
              <View style={styles.itemList}>
                {categoryGroups.map((group) => (
                  <View key={group.key} style={styles.groupCard}>
                    <PackingRow
                      item={{ name: group.name, category: formatPackingCategory(group.category) }}
                      checked={group.allChecked}
                      weight={formatWeight(group.estimatedWeightGrams)}
                      onToggle={() => handleToggle(group)}
                    />
                    <View style={styles.groupFooter}>
                      <Text variant="caption" color={group.partiallyChecked ? ACCENT : colors.textTertiary}>
                        Qty {group.quantity} · {group.checkedCount} packed
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable onPress={() => handleDecrement(group)} style={styles.stepperButton}>
                          <Text variant="caption" style={styles.stepperGlyph}>
                            −
                          </Text>
                        </Pressable>
                        <Text variant="caption" style={styles.stepperValue}>
                          {group.quantity}
                        </Text>
                        <Pressable onPress={() => handleIncrement(group)} style={styles.stepperButton}>
                          <MaterialSymbol name="add" size={12} color={TR_ACCENT_LIGHT} />
                        </Pressable>
                        <Pressable onPress={() => handleDeleteGroup(group)} style={[styles.stepperButton, styles.deleteButton]}>
                          <MaterialSymbol name="warning" size={12} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </TrailsGlassCard>
        );
      })}

      <TrailsGlassCard style={styles.weightSummaryCard}>
        <View style={styles.weightSummaryHeader}>
          <View>
            <Text variant="label" color={colors.textTertiary}>
              WEIGHT SUMMARY
            </Text>
            <Text variant="subheading">Estimated carry split</Text>
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            Planner estimate
          </Text>
        </View>
        <View style={styles.weightRows}>
          <WeightRow label="Base weight" value={formatWeight(totals.baseWeightGrams)} />
          <WeightRow label="Consumables" value={formatWeight(totals.consumablesGrams)} />
          <WeightRow label="Total" value={formatWeight(totals.totalWeightGrams)} emphasis />
        </View>
        <TrailsPrimaryButton label="Start Trip" onPress={handleStartTrip} />
      </TrailsGlassCard>
    </TrailsScreen>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

function WeightRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.weightRow}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text
        variant="caption"
        style={{
          color: emphasis ? ACCENT : colors.text,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  manageButtonText: {
    color: '#102108',
    fontWeight: '700',
  },
  summaryCard: {
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weightCallout: {
    alignItems: 'flex-end',
    gap: 4,
  },
  weightCalloutValue: {
    color: ACCENT,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  summaryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddCard: {
    gap: spacing.sm,
  },
  quickAddHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  secondaryAction: {
    color: ACCENT,
  },
  input: {
    color: colors.text,
    fontFamily: TR_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  categoryRow: {
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  categoryChipActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#102108',
  },
  categoryCard: {
    gap: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  smallAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  itemList: {
    gap: spacing.sm,
  },
  groupCard: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  deleteButton: {
    marginLeft: 4,
  },
  stepperValue: {
    minWidth: 20,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '700',
  },
  stepperGlyph: {
    color: colors.text,
    fontWeight: '700',
  },
  weightSummaryCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  weightSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weightRows: {
    gap: spacing.sm,
  },
  metaPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
