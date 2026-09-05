import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createPackingItem,
  createPackingTemplate,
  deletePackingTemplate,
  getPackingItems,
  getPackingTemplates,
  DEFAULT_TEMPLATES,
  MaterialSymbol,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  withAlpha,
  type PackingTemplate,
  type PackingTemplateType,
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
  TrailsSection,
} from './_ui';
import {
  PACKING_FILTERS,
  computePackingTotals,
  formatPackingCategory,
  formatTemplateType,
  formatWeight,
  groupPackingItems,
  type PackingFilterValue,
} from './phase6-utils';

const ACCENT = colors.modules.trails;

type ComposerState =
  | { mode: 'create'; name: string; type: PackingTemplateType }
  | { mode: 'edit'; templateId: string; name: string; type: PackingTemplateType };

export default function PackingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [activeFilter, setActiveFilter] = useState<PackingFilterValue>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);

  const templates: PackingTemplate[] = useMemo(() => getPackingTemplates(db), [db, tick]);

  const templateSummaries = useMemo(() => {
    return templates.map((template) => {
      try {
        const items = getPackingItems(db, template.id);
        const groups = groupPackingItems(items);
        const totals = computePackingTotals(groups);
        return {
          template,
          groups,
          progress: {
            checked: totals.checkedCount,
            total: totals.totalCount,
          },
          totals,
        };
      } catch {
        return {
          template,
          groups: [],
          progress: { checked: 0, total: 0 },
          totals: {
            baseWeightGrams: 0,
            consumablesGrams: 0,
            totalWeightGrams: 0,
            checkedCount: 0,
            totalCount: 0,
          },
        };
      }
    });
  }, [db, templates]);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'all') {
      return templateSummaries;
    }
    return templateSummaries.filter(({ template }) => template.type === activeFilter);
  }, [activeFilter, templateSummaries]);

  const selectedSummary = useMemo(
    () => templateSummaries.find(({ template }) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templateSummaries],
  );

  const openCreate = useCallback(() => {
    setComposer({ mode: 'create', name: '', type: 'custom' });
  }, []);

  const saveComposer = useCallback(() => {
    if (!composer || !composer.name.trim()) {
      return;
    }

    try {
      if (composer.mode === 'create') {
        const template = createPackingTemplate(db, uuid(), composer.name.trim(), composer.type);
        setSelectedTemplateId(template.id);
      } else {
        db.execute(
          'UPDATE tr_packing_templates SET name = ?, type = ?, updated_at = ? WHERE id = ?',
          [composer.name.trim(), composer.type, new Date().toISOString(), composer.templateId],
        );
        setSelectedTemplateId(composer.templateId);
      }
      setComposer(null);
      refresh();
    } catch {
      Alert.alert('Error', 'Failed to save the packing list.');
    }
  }, [composer, db, refresh]);

  const handleCreateFromDefault = useCallback(
    (templateDef: (typeof DEFAULT_TEMPLATES)[number]) => {
      try {
        const template = createPackingTemplate(
          db,
          uuid(),
          templateDef.name,
          templateDef.type as PackingTemplateType,
        );
        templateDef.items.forEach((item, index) => {
          createPackingItem(db, uuid(), {
            templateId: template.id,
            name: item.name,
            category: item.category,
            sortOrder: index,
          });
        });
        setSelectedTemplateId(template.id);
        refresh();
        router.push(`/(trails)/packing-checklist/${template.id}` as `/${string}`);
      } catch {
        Alert.alert('Error', 'Failed to create the starter list.');
      }
    },
    [db, refresh, router],
  );

  const handleDuplicate = useCallback(
    (summary: (typeof templateSummaries)[number]) => {
      try {
        const duplicate = createPackingTemplate(
          db,
          uuid(),
          `${summary.template.name} Copy`,
          summary.template.type,
        );
        summary.groups.forEach((group, groupIndex) => {
          Array.from({ length: group.quantity }).forEach((_, itemIndex) => {
            createPackingItem(db, uuid(), {
              templateId: duplicate.id,
              name: group.name,
              category: group.category,
              sortOrder: groupIndex * 10 + itemIndex,
            });
          });
        });
        setSelectedTemplateId(duplicate.id);
        refresh();
      } catch {
        Alert.alert('Error', 'Failed to duplicate the list.');
      }
    },
    [db, refresh, templateSummaries],
  );

  const handleDelete = useCallback(
    (template: PackingTemplate) => {
      Alert.alert('Delete List', `Delete "${template.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deletePackingTemplate(db, template.id);
              setSelectedTemplateId((current) => (current === template.id ? null : current));
              refresh();
            } catch {
              Alert.alert('Error', 'Failed to delete the list.');
            }
          },
        },
      ]);
    },
    [db, refresh],
  );

  return (
    <TrailsScreen contentContainerStyle={styles.content}>
      <TrailsHero
        title="Your Lists"
        subtitle={`${templateSummaries.length} expedition loadouts with pack progress, estimated weight, and reusable starters.`}
        action={(
          <Pressable onPress={openCreate} style={styles.heroAction}>
            <MaterialSymbol name="add" size={16} color="#102108" />
            <Text variant="caption" style={styles.heroActionText}>
              New List
            </Text>
          </Pressable>
        )}
      />

      <TrailsSection eyebrow="Filters" title="List Library">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PACKING_FILTERS.map((filter) => (
            <TrailsChip
              key={filter.value}
              label={filter.label}
              active={activeFilter === filter.value}
              onPress={() => setActiveFilter(filter.value)}
            />
          ))}
        </ScrollView>

        {composer ? (
          <TrailsGlassCard style={styles.composerCard}>
            <View style={styles.composerHeader}>
              <View>
                <Text variant="label" color={colors.textTertiary}>
                  {composer.mode === 'create' ? 'NEW LIST' : 'LIST MANAGER'}
                </Text>
                <Text variant="subheading">
                  {composer.mode === 'create' ? 'Create a custom manifest' : 'Edit list basics'}
                </Text>
              </View>
              <Pressable onPress={() => setComposer(null)}>
                <Text variant="label" style={styles.secondaryAction}>
                  Cancel
                </Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              placeholder="Summit weekend, canyon day hike..."
              placeholderTextColor={colors.textTertiary}
              style={styles.nameInput}
              value={composer.name}
              onChangeText={(value) => setComposer((current) => current ? { ...current, name: value } : current)}
              onSubmitEditing={saveComposer}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {PACKING_FILTERS.filter((filter) => filter.value !== 'all').map((filter) => (
                <TrailsChip
                  key={filter.value}
                  label={filter.label}
                  active={composer.type === filter.value}
                  onPress={() => setComposer((current) => current ? { ...current, type: filter.value as PackingTemplateType } : current)}
                />
              ))}
            </ScrollView>
            <TrailsPrimaryButton
              label={composer.mode === 'create' ? 'Create List' : 'Save Changes'}
              onPress={saveComposer}
            />
          </TrailsGlassCard>
        ) : null}

        {selectedSummary ? (
          <TrailsGlassCard style={styles.managerCard}>
            <View style={styles.managerHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="label" color={colors.textTertiary}>
                  LIST MANAGER
                </Text>
                <Text variant="subheading">{selectedSummary.template.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {formatTemplateType(selectedSummary.template.type)} · {selectedSummary.groups.length} grouped items · {formatWeight(selectedSummary.totals.totalWeightGrams)}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/(trails)/packing-checklist/${selectedSummary.template.id}` as `/${string}`)}
                style={styles.openButton}
              >
                <Text variant="label" style={styles.openButtonText}>
                  Open
                </Text>
              </Pressable>
            </View>
            <View style={styles.managerActions}>
              <ActionPill
                label="Edit"
                icon="settings"
                onPress={() => setComposer({
                  mode: 'edit',
                  templateId: selectedSummary.template.id,
                  name: selectedSummary.template.name,
                  type: selectedSummary.template.type,
                })}
              />
              <ActionPill label="Duplicate" icon="backpack" onPress={() => handleDuplicate(selectedSummary)} />
              <ActionPill
                label="Delete"
                icon="warning"
                tone="danger"
                onPress={() => handleDelete(selectedSummary.template)}
              />
            </View>
          </TrailsGlassCard>
        ) : null}

        <View style={styles.grid}>
          <Pressable onPress={openCreate} style={styles.gridPressable}>
            <TrailsGlassCard style={styles.createTile}>
              <View style={styles.createBadge}>
                <MaterialSymbol name="add" size={20} color={TR_ACCENT_LIGHT} />
              </View>
              <Text variant="subheading">Create New</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Start from scratch and build a custom trail manifest.
              </Text>
            </TrailsGlassCard>
          </Pressable>

          {filteredTemplates.map((summary) => {
            const percent = summary.progress.total > 0
              ? summary.progress.checked / summary.progress.total
              : 0;

            return (
              <Pressable
                key={summary.template.id}
                onPress={() => setSelectedTemplateId(summary.template.id)}
                onLongPress={() => router.push(`/(trails)/packing-checklist/${summary.template.id}` as `/${string}`)}
                style={styles.gridPressable}
              >
                <TrailsGlassCard
                  style={[
                    styles.templateCard,
                    selectedTemplateId === summary.template.id && styles.templateCardSelected,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.typePill}>
                      <Text variant="caption" style={styles.typePillText}>
                        {formatTemplateType(summary.template.type)}
                      </Text>
                    </View>
                    <Text variant="caption" style={styles.percentage}>
                      {Math.round(percent * 100)}%
                    </Text>
                  </View>
                  <Text variant="body" style={styles.templateName}>
                    {summary.template.name}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {summary.progress.checked}/{summary.progress.total} packed · {formatWeight(summary.totals.totalWeightGrams)}
                  </Text>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${percent * 100}%` }]} />
                  </View>
                  <View style={styles.metaWrap}>
                    {summary.groups.slice(0, 2).map((group) => (
                      <View key={group.key} style={styles.metaPill}>
                        <Text variant="caption" color={colors.textSecondary}>
                          {formatPackingCategory(group.category)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TrailsGlassCard>
              </Pressable>
            );
          })}
        </View>

        {filteredTemplates.length === 0 ? (
          <TrailsEmptyState
            icon="🎒"
            title="No lists in this filter"
            copy="Switch filters or spin up a new list from a preset starter."
            action={<TrailsPrimaryButton label="Create Custom List" onPress={openCreate} />}
          />
        ) : null}
      </TrailsSection>

      <TrailsSection eyebrow="Starters" title="Preset Templates">
        <View style={styles.presetList}>
          {DEFAULT_TEMPLATES.map((templateDef) => (
            <TrailsGlassCard key={templateDef.name} style={styles.presetCard}>
              <View style={styles.presetHeader}>
                <View style={styles.presetIcon}>
                  <MaterialSymbol name="backpack" size={18} color={TR_ACCENT_LIGHT} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="body" style={styles.templateName}>
                    {templateDef.name}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {templateDef.items.length} starter items · {formatTemplateType(templateDef.type as PackingTemplateType)}
                  </Text>
                </View>
              </View>
              <View style={styles.metaWrap}>
                {Array.from(new Set(templateDef.items.map((item) => formatPackingCategory(item.category))))
                  .slice(0, 3)
                  .map((category) => (
                    <View key={category} style={styles.metaPill}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {category}
                      </Text>
                    </View>
                  ))}
              </View>
              <TrailsPrimaryButton label="Use Starter" onPress={() => handleCreateFromDefault(templateDef)} />
            </TrailsGlassCard>
          ))}
        </View>
      </TrailsSection>
    </TrailsScreen>
  );
}

function ActionPill({
  label,
  icon,
  onPress,
  tone = 'default',
}: {
  label: string;
  icon: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const isDanger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionPill,
        { backgroundColor: isDanger ? 'rgba(255,69,58,0.16)' : colors.surface },
      ]}
    >
      <MaterialSymbol name={icon} size={14} color={isDanger ? colors.danger : TR_ACCENT_LIGHT} />
      <Text
        variant="caption"
        style={{
          color: isDanger ? colors.danger : colors.text,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  heroActionText: {
    color: '#102108',
    fontWeight: '700',
  },
  filterRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  composerCard: {
    gap: spacing.sm,
  },
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  nameInput: {
    color: colors.text,
    fontFamily: TR_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  secondaryAction: {
    color: ACCENT,
  },
  managerCard: {
    gap: spacing.sm,
  },
  managerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  managerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  openButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  openButtonText: {
    color: '#102108',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridPressable: {
    width: '48%',
  },
  templateCard: {
    gap: spacing.sm,
    minHeight: 168,
  },
  templateCardSelected: {
    backgroundColor: withAlpha(ACCENT, 0.16),
  },
  createTile: {
    minHeight: 168,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  createBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.16),
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.14),
  },
  typePillText: {
    color: TR_ACCENT_LIGHT,
    fontWeight: '700',
  },
  templateName: {
    fontWeight: '700',
  },
  percentage: {
    color: ACCENT,
    fontWeight: '700',
  },
  progressBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  presetList: {
    gap: spacing.sm,
  },
  presetCard: {
    gap: spacing.sm,
  },
  presetHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  presetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.14),
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
});
