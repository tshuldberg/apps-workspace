import { useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BlueprintCanvas,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  checkCompatibility,
  createLayoutItem,
  deleteLayoutItem,
  getLayoutItems,
  getLayouts,
  getPlants,
  type Layout,
  type LayoutItem,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  GardenCategory,
  classifyGardenCategory,
  createLocalId,
  getExtendedZones,
  initials,
  itemCenter,
} from '../phase3-utils';

type PalettePlant = {
  id: string | null;
  name: string;
  subtitle: string;
  category: GardenCategory;
  color: string;
  spacingInches: number;
};

type HistoryAction =
  | { type: 'add'; item: LayoutItem }
  | { type: 'delete'; item: LayoutItem };

const CATEGORY_ORDER: GardenCategory[] = ['vegetable', 'herb', 'flower'];
const CATEGORY_LABELS: Record<GardenCategory, string> = {
  vegetable: 'Vegetables',
  herb: 'Herbs',
  flower: 'Flowers',
  tree: 'Trees',
  shrub: 'Shrubs',
  houseplant: 'Houseplants',
};
const CATEGORY_COLORS: Record<GardenCategory, string> = {
  vegetable: '#84CC16',
  herb: '#8BCFF0',
  flower: '#FFB877',
  tree: '#65A30D',
  shrub: '#C9894D',
  houseplant: '#A3E635',
};

const FALLBACK_PALETTE: PalettePlant[] = [
  {
    id: null,
    name: 'Tomato',
    subtitle: 'Solanum lycopersicum',
    category: 'vegetable',
    color: CATEGORY_COLORS.vegetable,
    spacingInches: 18,
  },
  {
    id: null,
    name: 'Basil',
    subtitle: 'Ocimum basilicum',
    category: 'herb',
    color: CATEGORY_COLORS.herb,
    spacingInches: 10,
  },
  {
    id: null,
    name: 'Marigold',
    subtitle: 'Tagetes',
    category: 'flower',
    color: CATEGORY_COLORS.flower,
    spacingInches: 12,
  },
];

export default function LayoutEditorScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<GardenCategory>('vegetable');
  const [selectedPalette, setSelectedPalette] = useState<PalettePlant | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showCompanions, setShowCompanions] = useState(true);
  const [showSpacing, setShowSpacing] = useState(true);
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  const layout: Layout | null = useMemo(() => {
    if (!id) return null;
    try {
      return getLayouts(db).find((entry) => entry.id === id) ?? null;
    } catch {
      return null;
    }
  }, [db, id, tick]);

  const items: LayoutItem[] = useMemo(() => {
    if (!layout) return [];
    try {
      return getLayoutItems(db, layout.id);
    } catch {
      return [];
    }
  }, [db, layout, tick]);

  const plants: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db]);

  const zones = useMemo(() => getExtendedZones(db), [db]);

  const plantById = useMemo(() => {
    const map = new Map<string, Plant>();
    for (const plant of plants) {
      map.set(plant.id, plant);
    }
    return map;
  }, [plants]);

  const palette = useMemo(() => {
    const inventoryPalette: PalettePlant[] = plants.map((plant) => {
      const category = classifyGardenCategory(plant.name, plant.species);
      return {
        id: plant.id,
        name: plant.name,
        subtitle: plant.species ?? 'Garden specimen',
        category,
        color: CATEGORY_COLORS[category],
        spacingInches: category === 'herb' ? 10 : category === 'flower' ? 12 : 18,
      };
    });
    const candidates = inventoryPalette.length > 0 ? inventoryPalette : FALLBACK_PALETTE;
    return candidates.filter((entry) => entry.category === selectedCategory);
  }, [plants, selectedCategory]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  const overlays = useMemo(() => {
    const plantItems = items.filter((item) => item.itemType === 'plant');
    const results: Array<{
      key: string;
      itemA: LayoutItem;
      itemB: LayoutItem;
      relationship: 'companion' | 'antagonist';
    }> = [];

    for (let index = 0; index < plantItems.length; index += 1) {
      for (let inner = index + 1; inner < plantItems.length; inner += 1) {
        const first = plantItems[index];
        const second = plantItems[inner];
        const centerA = itemCenter(first);
        const centerB = itemCenter(second);
        const dx = Math.abs(centerA.x - centerB.x);
        const dy = Math.abs(centerA.y - centerB.y);
        if (dx > 2 || dy > 2) continue;

        const result = checkCompatibility(first.label, second.label);
        if (result.relationship === 'neutral') continue;

        results.push({
          key: `${first.id}-${second.id}`,
          itemA: first,
          itemB: second,
          relationship: result.relationship,
        });
      }
    }

    return results;
  }, [items]);

  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const overlay of overlays) {
      if (overlay.relationship !== 'antagonist') continue;
      set.add(overlay.itemA.id);
      set.add(overlay.itemB.id);
    }
    return set;
  }, [overlays]);

  const harmonyIds = useMemo(() => {
    const set = new Set<string>();
    for (const overlay of overlays) {
      if (overlay.relationship !== 'companion') continue;
      set.add(overlay.itemA.id);
      set.add(overlay.itemB.id);
    }
    return set;
  }, [overlays]);

  if (!layout) {
    return (
      <View style={styles.emptyState}>
        <RNText style={styles.emptyTitle}>Layout not found</RNText>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const baseCell = Math.max(
    30,
    Math.min(50, Math.floor((screenWidth - spacing.md * 2 - 24) / layout.widthCells)),
  );
  const cellSize = Math.max(24, Math.round(baseCell * zoom));
  const canvasWidth = layout.widthCells * cellSize;
  const canvasHeight = layout.heightCells * cellSize;
  const zoneName = zones.find((zone) => zone.id === layout.zoneId)?.name ?? 'Unassigned zone';

  const refresh = () => setTick((current) => current + 1);

  const recreateItem = (item: LayoutItem) => {
    createLayoutItem(db, item.id, {
      layoutId: item.layoutId,
      plantId: item.plantId,
      itemType: item.itemType,
      label: item.label,
      x: item.x,
      y: item.y,
      widthCells: item.widthCells,
      heightCells: item.heightCells,
      color: item.color,
      icon: item.icon,
      spacingInches: item.spacingInches,
    });
  };

  const applyUndo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    if (last.type === 'add') {
      deleteLayoutItem(db, last.item.id);
    } else {
      recreateItem(last.item);
    }

    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, last]);
    setSelectedItemId(null);
    refresh();
  };

  const applyRedo = () => {
    const last = redoStack[redoStack.length - 1];
    if (!last) return;

    if (last.type === 'add') {
      recreateItem(last.item);
    } else {
      deleteLayoutItem(db, last.item.id);
    }

    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, last]);
    refresh();
  };

  const itemAtCell = (x: number, y: number) =>
    items.find(
      (item) =>
        x >= item.x &&
        x < item.x + item.widthCells &&
        y >= item.y &&
        y < item.y + item.heightCells,
    );

  const handleCellPress = (x: number, y: number) => {
    const existing = itemAtCell(x, y);
    if (existing) {
      setSelectedItemId(existing.id);
      return;
    }

    if (!selectedPalette) return;

    const created = createLayoutItem(db, createLocalId(), {
      layoutId: layout.id,
      plantId: selectedPalette.id,
      itemType: 'plant',
      label: selectedPalette.name,
      x,
      y,
      widthCells: 1,
      heightCells: 1,
      color: selectedPalette.color,
      spacingInches: selectedPalette.spacingInches,
    });

    setUndoStack((current) => [...current, { type: 'add', item: created }]);
    setRedoStack([]);
    setSelectedItemId(created.id);
    refresh();
  };

  const handleRemoveSelected = () => {
    if (!selectedItem) return;
    deleteLayoutItem(db, selectedItem.id);
    setUndoStack((current) => [...current, { type: 'delete', item: selectedItem }]);
    setRedoStack([]);
    setSelectedItemId(null);
    refresh();
  };

  const selectedPlant = selectedItem?.plantId
    ? plantById.get(selectedItem.plantId) ?? null
    : null;
  const selectedAlerts = overlays.filter(
    (overlay) =>
      selectedItem != null &&
      (overlay.itemA.id === selectedItem.id || overlay.itemB.id === selectedItem.id),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <RNText style={styles.headerTitle}>{layout.name}</RNText>
          <RNText style={styles.headerSubtitle}>
            {zoneName} · {layout.widthCells} × {layout.heightCells} cells
          </RNText>
        </View>
        <View style={styles.headerActions}>
          <HeaderButton label="Undo" active={undoStack.length > 0} onPress={applyUndo} />
          <HeaderButton label="Redo" active={redoStack.length > 0} onPress={applyRedo} />
          <HeaderButton
            label="Save"
            active
            onPress={() => {
              // Layout edits persist immediately. This action confirms current state.
            }}
          />
        </View>
      </View>

      <GlassCard level={1} style={styles.paletteCard}>
        <View style={styles.tabRow}>
          {CATEGORY_ORDER.map((category) => (
            <Pressable
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
              ]}
            >
              <RNText
                style={[
                  styles.categoryTabText,
                  selectedCategory === category && styles.categoryTabTextActive,
                ]}
              >
                {CATEGORY_LABELS[category]}
              </RNText>
            </Pressable>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.paletteRow}
        >
          {palette.map((entry) => (
            <Pressable
              key={`${entry.id ?? 'fallback'}-${entry.name}`}
              onPress={() => setSelectedPalette(entry)}
              style={[
                styles.paletteEntry,
                selectedPalette?.name === entry.name && styles.paletteEntryActive,
              ]}
            >
              <View
                style={[
                  styles.paletteSwatch,
                  { backgroundColor: `${entry.color}22`, borderColor: `${entry.color}55` },
                ]}
              >
                <RNText style={[styles.paletteInitials, { color: entry.color }]}>
                  {initials(entry.name)}
                </RNText>
              </View>
              <View style={styles.paletteCopy}>
                <RNText style={styles.paletteName}>{entry.name}</RNText>
                <RNText style={styles.paletteSubtitle}>{entry.subtitle}</RNText>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <RNText style={styles.helperText}>
          Tap a plant in the palette, then tap a grid cell to place it.
        </RNText>
      </GlassCard>

      <GlassCard level={1} style={styles.toolsCard}>
        <View style={styles.toolsRow}>
          <Pressable onPress={() => setZoom((current) => Math.max(0.8, current - 0.1))}>
            <RNText style={styles.toolText}>Zoom -</RNText>
          </Pressable>
          <Pressable onPress={() => setZoom((current) => Math.min(1.5, current + 0.1))}>
            <RNText style={styles.toolText}>Zoom +</RNText>
          </Pressable>
          <Pressable onPress={() => setZoom(1)}>
            <RNText style={styles.toolText}>Reset</RNText>
          </Pressable>
          <Pressable onPress={() => setShowSpacing((value) => !value)}>
            <RNText style={styles.toolText}>
              {showSpacing ? 'Hide Spacing' : 'Show Spacing'}
            </RNText>
          </Pressable>
          <Pressable onPress={() => setShowCompanions((value) => !value)}>
            <RNText style={styles.toolText}>
              {showCompanions ? 'Hide Companions' : 'Show Companions'}
            </RNText>
          </Pressable>
        </View>
      </GlassCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BlueprintCanvas width={canvasWidth} height={canvasHeight}>
          {showCompanions &&
            overlays.map((overlay) => (
              <ConnectionLine
                key={overlay.key}
                from={itemCenter(overlay.itemA)}
                to={itemCenter(overlay.itemB)}
                cellSize={cellSize}
                color={
                  overlay.relationship === 'antagonist'
                    ? GARDEN_DANGER
                    : GARDEN_ACCENT_LIGHT
                }
              />
            ))}

          {items.map((item) => {
            const left = item.x * cellSize + 4;
            const top = item.y * cellSize + 4;
            const width = Math.max(20, item.widthCells * cellSize - 8);
            const height = Math.max(20, item.heightCells * cellSize - 8);
            const accent =
              conflictIds.has(item.id)
                ? GARDEN_DANGER
                : harmonyIds.has(item.id)
                  ? GARDEN_ACCENT
                  : item.color ?? GARDEN_GOLD;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedItemId(item.id)}
                style={[
                  styles.canvasItem,
                  {
                    left,
                    top,
                    width,
                    height,
                    borderColor: accent,
                    backgroundColor: `${accent}22`,
                  },
                  selectedItemId === item.id && styles.canvasItemSelected,
                ]}
              >
                <RNText style={[styles.canvasItemText, { color: accent }]}>
                  {initials(item.label)}
                </RNText>
                {showSpacing && item.spacingInches != null && (
                  <RNText style={styles.spacingLabel}>
                    {item.spacingInches} in
                  </RNText>
                )}
              </Pressable>
            );
          })}

          {Array.from({ length: layout.heightCells }, (_, y) =>
            Array.from({ length: layout.widthCells }, (_, x) => (
              <Pressable
                key={`${x}-${y}`}
                onPress={() => handleCellPress(x, y)}
                style={{
                  position: 'absolute',
                  left: x * cellSize,
                  top: y * cellSize,
                  width: cellSize,
                  height: cellSize,
                }}
              />
            )),
          )}
        </BlueprintCanvas>
      </ScrollView>

      {showCompanions && overlays.length > 0 && (
        <GlassCard level={1} style={styles.summaryCard}>
          <RNText style={styles.summaryTitle}>Synergy alerts</RNText>
          {overlays.slice(0, 4).map((overlay) => (
            <RNText
              key={overlay.key}
              style={[
                styles.summaryLine,
                {
                  color:
                    overlay.relationship === 'antagonist'
                      ? GARDEN_DANGER
                      : GARDEN_ACCENT_LIGHT,
                },
              ]}
            >
              {overlay.itemA.label} {overlay.relationship === 'antagonist' ? 'conflicts with' : 'supports'}{' '}
              {overlay.itemB.label}
            </RNText>
          ))}
        </GlassCard>
      )}

      {selectedItem != null && (
        <GlassCard level={2} style={styles.detailCard}>
          <RNText style={styles.detailTitle}>{selectedItem.label}</RNText>
          <RNText style={styles.detailSubtitle}>
            {selectedPlant?.species ?? 'Placement token'} · {selectedItem.x + 1},
            {selectedItem.y + 1}
          </RNText>

          <View style={styles.detailStats}>
            <View style={styles.detailStatCard}>
              <RNText style={styles.detailStatLabel}>Spacing</RNText>
              <RNText style={styles.detailStatValue}>
                {selectedItem.spacingInches ?? 12} in
              </RNText>
            </View>
            <View style={styles.detailStatCard}>
              <RNText style={styles.detailStatLabel}>Sunlight</RNText>
              <RNText style={styles.detailStatValue}>
                {selectedPlant?.location === 'outdoor' ? 'Full / Partial' : 'Bright indoor'}
              </RNText>
            </View>
            <View style={styles.detailStatCard}>
              <RNText style={styles.detailStatLabel}>Watering</RNText>
              <RNText style={styles.detailStatValue}>
                {selectedPlant?.waterFrequencyDays != null
                  ? `Every ${selectedPlant.waterFrequencyDays}d`
                  : 'Observe'}
              </RNText>
            </View>
          </View>

          {selectedAlerts.length > 0 && (
            <View style={styles.alertBlock}>
              <RNText style={styles.summaryTitle}>Synergy alerts</RNText>
              {selectedAlerts.map((alert) => (
                <RNText
                  key={alert.key}
                  style={[
                    styles.summaryLine,
                    {
                      color:
                        alert.relationship === 'antagonist'
                          ? GARDEN_DANGER
                          : GARDEN_ACCENT_LIGHT,
                    },
                  ]}
                >
                  {alert.relationship === 'antagonist' ? 'Warning:' : 'Compatible:'}{' '}
                  {alert.itemA.id === selectedItem.id ? alert.itemB.label : alert.itemA.label}
                </RNText>
              ))}
            </View>
          )}

          <View style={styles.detailActions}>
            {selectedPlant != null ? (
              <GradientButton
                title="View Full Profile"
                onPress={() => router.push(`/(garden)/plant/${selectedPlant.id}`)}
              />
            ) : (
              <GradientButton title="Placement Saved" onPress={() => {}} variant="secondary" />
            )}
            <GradientButton
              title="Remove from Bed"
              onPress={handleRemoveSelected}
              variant="danger"
            />
          </View>
        </GlassCard>
      )}
    </ScrollView>
  );
}

function HeaderButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!active}
      style={[styles.headerButton, !active && styles.headerButtonDisabled]}
    >
      <RNText style={[styles.headerButtonText, !active && styles.headerButtonTextDisabled]}>
        {label}
      </RNText>
    </Pressable>
  );
}

function ConnectionLine({
  from,
  to,
  cellSize,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  cellSize: number;
  color: string;
}) {
  const startX = from.x * cellSize;
  const startY = from.y * cellSize;
  const endX = to.x * cellSize;
  const endY = to.y * cellSize;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      style={{
        position: 'absolute',
        left: startX + dx / 2 - length / 2,
        top: startY + dy / 2,
        width: length,
        height: 2,
        backgroundColor: color,
        opacity: 0.55,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  headerRow: {
    gap: spacing.sm,
  },
  headerCopy: {
    gap: 4,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  headerButtonDisabled: {
    backgroundColor: GARDEN_SURFACES.lift,
  },
  headerButtonText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: GARDEN_ACCENT_LIGHT,
  },
  headerButtonTextDisabled: {
    color: colors.textTertiary,
  },
  paletteCard: {
    gap: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  categoryTabActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  categoryTabText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  categoryTabTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  paletteRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  paletteEntry: {
    width: 182,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  paletteEntryActive: {
    backgroundColor: GARDEN_SURFACES.focus,
  },
  paletteSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  paletteInitials: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
  },
  paletteCopy: {
    flex: 1,
    gap: 4,
  },
  paletteName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  paletteSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  helperText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  toolsCard: {
    paddingVertical: 12,
  },
  toolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: GARDEN_ACCENT_LIGHT,
  },
  canvasItem: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  canvasItemSelected: {
    shadowColor: GARDEN_ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  canvasItemText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
  },
  spacingLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textTertiary,
  },
  summaryCard: {
    gap: 6,
  },
  summaryTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  summaryLine: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
  },
  detailCard: {
    gap: spacing.md,
  },
  detailTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  detailSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailStatCard: {
    minWidth: '30%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: GARDEN_SURFACES.lift,
    gap: 4,
  },
  detailStatLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  detailStatValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  alertBlock: {
    gap: 6,
  },
  detailActions: {
    gap: spacing.sm,
  },
});
