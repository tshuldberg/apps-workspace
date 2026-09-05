import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BAR_PRESETS,
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  calculatePlates,
  calculateWarmupSets,
  type WarmupSet,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import { WorkoutHero } from './(tabs)/_screen-kit';

type WarmupProtocol = 'standard' | 'powerlifting' | 'pyramid';

const PROTOCOLS: Array<{ key: WarmupProtocol; label: string }> = [
  { key: 'standard', label: 'Standard 3-Set' },
  { key: 'powerlifting', label: 'Powerlifting 5-Set' },
  { key: 'pyramid', label: 'Pyramid' },
];

function roundForUnit(value: number, unit: 'lbs' | 'kg'): number {
  const step = unit === 'kg' ? 2.5 : 5;
  return Math.round(value / step) * step;
}

function buildProtocolSets(
  workingWeight: number,
  barWeight: number,
  protocol: WarmupProtocol,
  unit: 'lbs' | 'kg',
): WarmupSet[] {
  if (workingWeight <= 0) return [];

  if (protocol === 'standard') {
    return calculateWarmupSets(workingWeight, barWeight);
  }

  const recipes: Record<Exclude<WarmupProtocol, 'standard'>, Array<{ pct: number; reps: number }>> = {
    powerlifting: [
      { pct: 0, reps: 10 },
      { pct: 0.4, reps: 8 },
      { pct: 0.55, reps: 5 },
      { pct: 0.7, reps: 3 },
      { pct: 0.8, reps: 2 },
    ],
    pyramid: [
      { pct: 0, reps: 10 },
      { pct: 0.45, reps: 8 },
      { pct: 0.6, reps: 6 },
      { pct: 0.75, reps: 4 },
      { pct: 0.85, reps: 2 },
    ],
  };

  return recipes[protocol].map((entry) => ({
    weight: entry.pct === 0 ? barWeight : roundForUnit(workingWeight * entry.pct, unit),
    reps: entry.reps,
    percentage: Math.round(entry.pct * 100),
  }));
}

export default function WarmupScreen() {
  const db = useDatabase();
  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const unit = settings.weightUnit;
  const [workingWeight, setWorkingWeight] = useState('');
  const [protocol, setProtocol] = useState<WarmupProtocol>('standard');
  const [barWeight, setBarWeight] = useState(
    unit === 'kg' ? Math.round(settings.defaultBarbellWeight / 2.20462) : settings.defaultBarbellWeight,
  );

  const parsedWeight = Number(workingWeight) || 0;
  const warmupSets = buildProtocolSets(parsedWeight, barWeight, protocol, unit);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        title="Warmup Builder"
        subtitle="Shift protocols, tune bar weight, and preview every jump before your working sets."
        trailing={
          <View style={styles.heroBadge}>
            <MaterialSymbol name="bolt" size={18} color={WK_ACCENT_LIGHT} />
          </View>
        }
      />

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Target Weight</Text>
        <View style={styles.bigInputCard}>
          <TextInput
            value={workingWeight}
            onChangeText={setWorkingWeight}
            keyboardType="decimal-pad"
            placeholder={unit === 'kg' ? '120' : '265'}
            placeholderTextColor="rgba(214, 195, 181, 0.36)"
            style={styles.bigInput}
          />
          <Text style={styles.bigInputUnit}>{unit.toUpperCase()}</Text>
        </View>

        <Text style={styles.sectionLabel}>Protocol</Text>
        <View style={styles.chipRow}>
          {PROTOCOLS.map((entry) => (
            <Chip
              key={entry.key}
              label={entry.label}
              selected={protocol === entry.key}
              onPress={() => setProtocol(entry.key)}
            />
          ))}
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
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Warmup Flow</Text>
        {warmupSets.map((set, index) => {
          const plateSuggestion = calculatePlates(set.weight, barWeight, unit);

          return (
            <View key={`${set.weight}-${set.reps}-${index}`} style={styles.setRow}>
              <View style={styles.setBadge}>
                <Text style={styles.setBadgeText}>{index + 1}</Text>
              </View>
              <View style={styles.setCopy}>
                <Text style={styles.setValue}>
                  {set.weight} {unit} x {set.reps}
                </Text>
                <Text style={styles.setHint}>
                  {set.percentage === 0 ? 'Bar only prep' : `${set.percentage}% of working weight`}
                </Text>
                <Text style={styles.setHint}>
                  Plates: {plateSuggestion.perSide.length
                    ? plateSuggestion.perSide.map((entry) => `${entry.weight} x${entry.count}`).join(', ')
                    : 'Bar only'}
                </Text>
              </View>
              <Text style={styles.setPercent}>
                {set.percentage === 0 ? '--' : `${set.percentage}%`}
              </Text>
            </View>
          );
        })}

        {!warmupSets.length ? (
          <Text style={styles.emptyCopy}>
            Enter a target lift to generate the sequence.
          </Text>
        ) : (
          <View style={styles.workingPill}>
            <MaterialSymbol name="fitness_center" size={16} color={WK_ACCENT_LIGHT} />
            <Text style={styles.workingPillText}>
              Finish at {workingWeight || '--'} {unit} for your first working set.
            </Text>
          </View>
        )}
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
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  bigInputCard: {
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.highest,
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  setBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  setBadgeText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: WK_ACCENT_LIGHT,
  },
  setCopy: {
    flex: 1,
    gap: 2,
  },
  setValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: '#F4EEE8',
  },
  setHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  setPercent: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: WK_ACCENT_LIGHT,
  },
  workingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  workingPillText: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#F4EEE8',
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
  },
});
