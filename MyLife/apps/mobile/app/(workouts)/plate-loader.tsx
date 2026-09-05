import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import {
  BAR_PRESETS,
  Chip,
  GlassPanel,
  MaterialSymbol,
  PLATE_COLORS,
  STANDARD_PLATES_KG,
  STANDARD_PLATES_LBS,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  calculatePlates,
  getPlateInventories,
  type InventoryPlate,
  type PlateInventory,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import { WorkoutHero } from './(tabs)/_screen-kit';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function PlateBarbell({
  perSide,
}: {
  perSide: Array<{ weight: number; count: number }>;
}) {
  const expanded = perSide.flatMap((entry) => {
    return Array.from({ length: entry.count }).map(() => entry.weight);
  });

  const widths = expanded.map((weight) => Math.max(18, Math.min(30, 12 + weight / 2.5)));
  const totalWidth = widths.reduce((sum, item) => sum + item, 0);
  let offset = 170 - totalWidth;

  return (
    <Svg width="100%" height={190} viewBox="0 0 360 190">
      <Line x1={24} x2={336} y1={95} y2={95} stroke="#9A7655" strokeWidth={10} strokeLinecap="round" />
      <Rect x={162} y={82} width={36} height={26} rx={6} fill="#D6A66E" />
      <Line x1={46} x2={46} y1={62} y2={128} stroke="#5C524A" strokeWidth={6} />
      <Line x1={314} x2={314} y1={62} y2={128} stroke="#5C524A" strokeWidth={6} />

      {expanded.map((weight, index) => {
        const width = widths[index] ?? 18;
        const height = Math.min(118, 54 + weight * 1.1);
        const y = 95 - height / 2;
        const xLeft = offset;
        const xRight = 360 - offset - width;
        offset += width + 4;
        const fill = PLATE_COLORS[weight] ?? '#9CA3AF';
        const textColor = fill === '#FFFFFF' ? '#101217' : '#FAFAFA';

        return (
          <G key={`${weight}-${index}`}>
            <Rect x={xLeft} y={y} width={width} height={height} rx={6} fill={fill} />
            <Rect x={xRight} y={y} width={width} height={height} rx={6} fill={fill} />
            <SvgText
              x={xLeft + width / 2}
              y={99}
              fontSize={10}
              fontWeight="700"
              fill={textColor}
              textAnchor="middle"
            >
              {String(weight)}
            </SvgText>
            <SvgText
              x={xRight + width / 2}
              y={99}
              fontSize={10}
              fontWeight="700"
              fill={textColor}
              textAnchor="middle"
            >
              {String(weight)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export default function PlateLoaderScreen() {
  const db = useDatabase();
  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const unit = settings.weightUnit;
  const availableInventories = useMemo(() => getPlateInventories(db), [db]);
  const [targetWeight, setTargetWeight] = useState('');
  const [barWeight, setBarWeight] = useState(
    unit === 'kg' ? Math.round(settings.defaultBarbellWeight / 2.20462) : settings.defaultBarbellWeight,
  );
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('standard');

  const standardPlates = unit === 'kg' ? STANDARD_PLATES_KG : STANDARD_PLATES_LBS;
  const selectedInventory = availableInventories.find((inventory) => inventory.id === selectedInventoryId) ?? null;
  const inventoryOptions: Array<{ id: string; label: string; inventory: PlateInventory | null }> = [
    { id: 'standard', label: `Standard ${unit.toUpperCase()}`, inventory: null },
    ...availableInventories.map((inventory) => ({
      id: inventory.id,
      label: inventory.name,
      inventory,
    })),
  ];

  const inventoryPlates = selectedInventory
    ? selectedInventory.plates
    : standardPlates.map((weight) => ({ weight, count: 20 }));
  const result = Number(targetWeight) > 0
    ? calculatePlates(
        Number(targetWeight),
        barWeight,
        unit,
        inventoryPlates as InventoryPlate[],
      )
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        eyebrow="Performance Tool"
        title="Plate Loader"
        subtitle="Visualize both sleeves, switch bars, and match the setup to your available inventory."
        accent={WK_ACCENT_LIGHT}
        action={
          <View style={styles.heroBadge}>
            <MaterialSymbol name="inventory" size={18} color={WK_ACCENT_LIGHT} />
          </View>
        }
      />

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Target Weight</Text>
        <View style={styles.bigInputCard}>
          <TextInput
            value={targetWeight}
            onChangeText={setTargetWeight}
            keyboardType="decimal-pad"
            placeholder={unit === 'kg' ? '140' : '315'}
            placeholderTextColor="rgba(214, 195, 181, 0.36)"
            style={styles.bigInput}
          />
          <Text style={styles.bigInputUnit}>{unit.toUpperCase()}</Text>
        </View>

        <Text style={styles.sectionLabel}>Bar Weight</Text>
        <View style={styles.chipRow}>
          {BAR_PRESETS.map((preset) => {
            const presetWeight = unit === 'kg' ? preset.weightKg : preset.weightLbs;
            return (
              <Chip
                key={preset.label}
                label={`${presetWeight} ${unit}`}
                selected={barWeight === presetWeight}
                onPress={() => setBarWeight(presetWeight)}
              />
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Inventory</Text>
        <View style={styles.chipRow}>
          {inventoryOptions.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={selectedInventoryId === option.id}
              onPress={() => {
                setSelectedInventoryId(option.id);
                if (option.inventory) {
                  setBarWeight(option.inventory.barWeight);
                }
              }}
            />
          ))}
        </View>
      </GlassPanel>

      <GlassPanel style={styles.visualPanel} intensity={52}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionLabel}>Visual Loadout</Text>
            <Text style={styles.summaryValue}>
              {result ? `${formatNumber(result.totalWeight)} ${unit}` : '--'}
            </Text>
          </View>
          {result?.remainder ? (
            <View style={styles.remainderPill}>
              <Text style={styles.remainderText}>
                {formatNumber(result.remainder)} {unit} remainder
              </Text>
            </View>
          ) : null}
        </View>

        <PlateBarbell perSide={result?.perSide ?? []} />

        <View style={styles.perSidePill}>
          <MaterialSymbol name="straighten" size={16} color={WK_ACCENT_LIGHT} />
          <Text style={styles.perSideText}>
            Per side: {result?.perSide.length
              ? result.perSide.map((entry) => `${entry.weight} x${entry.count}`).join(', ')
              : 'Bar only'}
          </Text>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Breakdown</Text>
        {(result?.perSide ?? []).map((entry) => (
          <View key={entry.weight} style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <View
                style={[
                  styles.breakdownDot,
                  { backgroundColor: PLATE_COLORS[entry.weight] ?? '#9CA3AF' },
                ]}
              />
              <Text style={styles.breakdownValue}>{entry.weight} {unit}</Text>
            </View>
            <Text style={styles.breakdownCount}>x{entry.count} per side</Text>
          </View>
        ))}

        {!result?.perSide.length ? (
          <Text style={styles.emptyCopy}>Enter a target load to see the sleeve breakdown.</Text>
        ) : null}
      </GlassPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  visualPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.high,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  bigInputCard: {
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.highest,
    alignItems: 'flex-start',
    gap: 4,
  },
  bigInput: {
    width: '100%',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 48,
    color: '#FFF3E7',
    paddingVertical: 0,
  },
  bigInputUnit: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(214, 195, 181, 0.54)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 40,
    lineHeight: 44,
    color: '#FFF3E7',
  },
  remainderPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  remainderText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_ACCENT_LIGHT,
  },
  perSidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  perSideText: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#F4EEE8',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  breakdownValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#F4EEE8',
  },
  breakdownCount: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.64)',
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
  },
});
