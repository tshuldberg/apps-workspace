import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BlueprintCanvas,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  createLayout,
  getLayoutItems,
  getLayouts,
  type Layout,
  type LayoutItem,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { createLocalId, getExtendedZones, initials } from './phase3-utils';

export default function LayoutsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [name, setName] = useState('');
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [widthCells, setWidthCells] = useState(4);
  const [heightCells, setHeightCells] = useState(8);

  const layouts: Layout[] = useMemo(() => {
    try {
      return getLayouts(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const zones = useMemo(() => getExtendedZones(db), [db, tick]);

  const itemsByLayout = useMemo(() => {
    const map = new Map<string, LayoutItem[]>();
    for (const layout of layouts) {
      try {
        map.set(layout.id, getLayoutItems(db, layout.id));
      } catch {
        map.set(layout.id, []);
      }
    }
    return map;
  }, [db, layouts]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createLayout(db, createLocalId(), {
      name: name.trim(),
      zoneId,
      widthCells,
      heightCells,
      cellSizeInches: 12,
      season: 'spring',
      year: new Date().getFullYear(),
    });
    setTick((current) => current + 1);
    setShowComposer(false);
    setName('');
    setZoneId(null);
    setWidthCells(4);
    setHeightCells(8);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <RNText style={styles.headerLabel}>GARDEN BLUEPRINTS</RNText>
          <RNText style={styles.headerTitle}>Layout Planner</RNText>
        </View>
        <Pressable onPress={() => setShowComposer((value) => !value)}>
          <RNText style={styles.headerAction}>
            {showComposer ? 'Close' : '+ New Bed'}
          </RNText>
        </Pressable>
      </View>

      <RNText style={styles.headerBody}>
        Compose raised beds, patio groupings, and greenhouse maps with saved
        placement previews for every zone.
      </RNText>

      {showComposer && (
        <GlassCard level={2} style={styles.composerCard}>
          <RNText style={styles.composerTitle}>Create a new bed</RNText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="South Raised Bed"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={styles.input}
          />

          <View style={styles.dimensionRow}>
            <Stepper
              label="Width"
              value={widthCells}
              onChange={(next) => setWidthCells(Math.max(2, Math.min(12, next)))}
            />
            <Stepper
              label="Height"
              value={heightCells}
              onChange={(next) => setHeightCells(Math.max(2, Math.min(16, next)))}
            />
          </View>

          <RNText style={styles.chipLabel}>Zone</RNText>
          <View style={styles.zoneRow}>
            {zones.length === 0 ? (
              <RNText style={styles.helperText}>Create zones first to link beds.</RNText>
            ) : (
              zones.map((zone) => (
                <Pressable
                  key={zone.id}
                  onPress={() => setZoneId(zone.id)}
                  style={[
                    styles.zoneChip,
                    zoneId === zone.id && styles.zoneChipActive,
                  ]}
                >
                  <RNText
                    style={[
                      styles.zoneChipText,
                      zoneId === zone.id && styles.zoneChipTextActive,
                    ]}
                  >
                    {zone.name}
                  </RNText>
                </Pressable>
              ))
            )}
          </View>

          <GradientButton title="Create Bed" onPress={handleCreate} />
        </GlassCard>
      )}

      {layouts.length === 0 ? (
        <GlassCard level={1} style={styles.emptyCard}>
          <RNText style={styles.emptyTitle}>No saved layouts yet</RNText>
          <RNText style={styles.emptyBody}>
            Start with a single raised bed, then place plants in the editor to
            test spacing and companion fit.
          </RNText>
        </GlassCard>
      ) : (
        <View style={styles.grid}>
          {layouts.map((layout) => {
            const items = itemsByLayout.get(layout.id) ?? [];
            const zoneName = zones.find((zone) => zone.id === layout.zoneId)?.name;
            return (
              <Pressable
                key={layout.id}
                onPress={() => router.push(`/(garden)/layout/${layout.id}`)}
                style={styles.gridItem}
              >
                <GlassCard level={1} style={styles.layoutCard}>
                  <MiniLayoutPreview
                    widthCells={layout.widthCells}
                    heightCells={layout.heightCells}
                    items={items}
                  />
                  <View style={styles.layoutMeta}>
                    <RNText style={styles.layoutName}>{layout.name}</RNText>
                    <RNText style={styles.layoutSubtitle}>
                      {layout.widthCells} × {layout.heightCells} cells
                    </RNText>
                    <RNText style={styles.layoutCaption}>
                      {items.length} placed · {zoneName ?? 'Unassigned zone'}
                    </RNText>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperCard}>
      <RNText style={styles.chipLabel}>{label}</RNText>
      <View style={styles.stepperRow}>
        <Pressable onPress={() => onChange(value - 1)} style={styles.stepperButton}>
          <RNText style={styles.stepperSymbol}>-</RNText>
        </Pressable>
        <RNText style={styles.stepperValue}>{value}</RNText>
        <Pressable onPress={() => onChange(value + 1)} style={styles.stepperButton}>
          <RNText style={styles.stepperSymbol}>+</RNText>
        </Pressable>
      </View>
    </View>
  );
}

function MiniLayoutPreview({
  widthCells,
  heightCells,
  items,
}: {
  widthCells: number;
  heightCells: number;
  items: LayoutItem[];
}) {
  const previewWidth = 150;
  const previewHeight = 110;
  const cellWidth = previewWidth / Math.max(widthCells, 1);
  const cellHeight = previewHeight / Math.max(heightCells, 1);

  return (
    <BlueprintCanvas width={previewWidth} height={previewHeight}>
      {items.slice(0, 12).map((item) => (
        <View
          key={item.id}
          style={[
            styles.previewToken,
            {
              left: item.x * cellWidth + 4,
              top: item.y * cellHeight + 4,
              width: Math.max(18, item.widthCells * cellWidth - 8),
              height: Math.max(18, item.heightCells * cellHeight - 8),
              backgroundColor: item.color ?? `${GARDEN_ACCENT}55`,
            },
          ]}
        >
          <RNText style={styles.previewTokenText}>{initials(item.label)}</RNText>
        </View>
      ))}
    </BlueprintCanvas>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerAction: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  headerBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  composerCard: {
    gap: spacing.md,
  },
  composerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: GARDEN_SURFACES.lift,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepperCard: {
    flex: 1,
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  chipLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.focus,
  },
  stepperSymbol: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  stepperValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  zoneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  zoneChipActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  zoneChipText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  zoneChipTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  helperText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '47%',
  },
  layoutCard: {
    gap: spacing.sm,
    padding: 12,
  },
  layoutMeta: {
    gap: 4,
  },
  layoutName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  layoutSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  layoutCaption: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  previewToken: {
    position: 'absolute',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTokenText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.background,
  },
});
