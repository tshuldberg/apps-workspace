import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  calculate1RM,
  calculateBrzycki1RM,
  calculateEpley1RM,
  getLatest1RM,
  getWorkoutExercises,
  record1RM,
  seedWorkoutExerciseLibrary,
  type OneRMFormula,
  type WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import { WorkoutHero, WorkoutPrimaryButton, WorkoutSecondaryButton } from './(tabs)/_screen-kit';

const FORMULAS: Array<{ key: OneRMFormula; label: string }> = [
  { key: 'epley', label: 'Epley' },
  { key: 'brzycki', label: 'Brzycki' },
];

const WORKING_PERCENTAGES = [
  { percent: 90, reps: '2-3' },
  { percent: 85, reps: '4-5' },
  { percent: 80, reps: '6-8' },
  { percent: 75, reps: '8-10' },
  { percent: 70, reps: '10-12' },
];

function roundForUnit(value: number, unit: 'lbs' | 'kg'): number {
  const step = unit === 'kg' ? 2.5 : 5;
  return Math.round(value / step) * step;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function ExercisePickerRow({
  exercise,
  selected,
  onPress,
}: {
  exercise: WorkoutExerciseLibraryItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.exerciseRow}>
      <View style={styles.exerciseCopy}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseMeta}>
          {exercise.category} • {exercise.difficulty}
        </Text>
      </View>
      <View
        style={[
          styles.exerciseCheck,
          selected && styles.exerciseCheckActive,
        ]}
      >
        <MaterialSymbol
          name={selected ? 'check_circle' : 'radio_button_unchecked'}
          size={18}
          color={selected ? WK_ACCENT_LIGHT : 'rgba(214, 195, 181, 0.62)'}
        />
      </View>
    </Pressable>
  );
}

export default function OneRMScreen() {
  const db = useDatabase();
  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const unit = settings.weightUnit;
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [formula, setFormula] = useState<OneRMFormula>('epley');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  const exercises = useMemo(() => {
    seedWorkoutExerciseLibrary(db);
    return getWorkoutExercises(db, { limit: 18 });
  }, [db]);

  const selectedExercise = useMemo(() => {
    return exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null;
  }, [exercises, selectedExerciseId]);

  const parsedWeight = Number(weight) || 0;
  const parsedReps = Number(reps) || 0;
  const estimated1RM = parsedWeight > 0 && parsedReps > 0
    ? calculate1RM(parsedWeight, parsedReps, formula)
    : 0;
  const epley1RM = parsedWeight > 0 && parsedReps > 0 ? calculateEpley1RM(parsedWeight, parsedReps) : 0;
  const brzycki1RM = parsedWeight > 0 && parsedReps > 0 ? calculateBrzycki1RM(parsedWeight, parsedReps) : 0;
  const latestSaved = selectedExerciseId ? getLatest1RM(db, selectedExerciseId) : null;

  const handleSave = () => {
    if (!estimated1RM) {
      Alert.alert('Enter a lift', 'Add both weight and reps before saving a one rep max.');
      return;
    }

    if (!selectedExerciseId) {
      setShowExercisePicker(true);
      return;
    }

    try {
      record1RM(db, uuid(), {
        exerciseId: selectedExerciseId,
        maxWeight: parsedWeight,
        maxReps: parsedReps,
        estimated1rm: estimated1RM,
        unit,
        achievedAt: new Date().toISOString(),
      });

      Alert.alert('Saved', `${selectedExercise?.name ?? 'Exercise'} now has a fresh 1RM snapshot.`);
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutHero
          eyebrow="Performance Tool"
          title="One Rep Max"
          subtitle="Estimate a clean max, compare formulas, and save it back to your training history."
          accent={WK_ACCENT_LIGHT}
          action={
            <View style={styles.heroBadge}>
              <MaterialSymbol name="emoji_events" size={18} color={WK_ACCENT_LIGHT} />
            </View>
          }
        />

        <GlassPanel style={styles.panel}>
          <Text style={styles.sectionLabel}>Formula</Text>
          <View style={styles.chipRow}>
            {FORMULAS.map((entry) => (
              <Chip
                key={entry.key}
                label={entry.label}
                selected={formula === entry.key}
                accent={WK_ACCENT}
                onPress={() => setFormula(entry.key)}
              />
            ))}
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Working Weight</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder={unit === 'kg' ? '100' : '225'}
                placeholderTextColor="rgba(214, 195, 181, 0.36)"
              />
              <Text style={styles.inputUnit}>{unit.toUpperCase()}</Text>
            </View>
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor="rgba(214, 195, 181, 0.36)"
              />
              <Text style={styles.inputUnit}>RANGE 1-15</Text>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel style={styles.heroCard} intensity={50}>
          <Text style={styles.resultLabel}>Estimated 1RM</Text>
          <Text style={styles.resultValue}>
            {estimated1RM ? formatNumber(estimated1RM) : '--'}
          </Text>
          <Text style={styles.resultUnit}>{unit.toUpperCase()}</Text>

          <View style={styles.dualFormulaRow}>
            <View style={styles.formulaValueCard}>
              <Text style={styles.formulaValueLabel}>Epley</Text>
              <Text style={styles.formulaValue}>{formatNumber(epley1RM || 0)}</Text>
            </View>
            <View style={styles.formulaValueCard}>
              <Text style={styles.formulaValueLabel}>Brzycki</Text>
              <Text style={styles.formulaValue}>{formatNumber(brzycki1RM || 0)}</Text>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel style={styles.panel}>
          <Text style={styles.sectionLabel}>Working Sets</Text>
          <View style={styles.tableStack}>
            {WORKING_PERCENTAGES.map((entry) => {
              const rowValue = estimated1RM
                ? roundForUnit((estimated1RM * entry.percent) / 100, unit)
                : 0;

              return (
                <View key={entry.percent} style={styles.tableRow}>
                  <View>
                    <Text style={styles.tablePercent}>{entry.percent}%</Text>
                    <Text style={styles.tableAssist}>Recommended {entry.reps} reps</Text>
                  </View>
                  <Text style={styles.tableValue}>
                    {estimated1RM ? `${formatNumber(rowValue)} ${unit}` : '--'}
                  </Text>
                </View>
              );
            })}
          </View>
        </GlassPanel>

        <GlassPanel style={styles.panel}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Save To Exercise</Text>
              <Text style={styles.exerciseSelection}>
                {selectedExercise?.name ?? 'Pick an exercise before saving'}
              </Text>
            </View>
            <WorkoutSecondaryButton
              label={selectedExercise ? 'Change' : 'Select'}
              icon="menu_book"
              onPress={() => setShowExercisePicker(true)}
            />
          </View>

          {latestSaved ? (
            <View style={styles.latestRow}>
              <View>
                <Text style={styles.latestLabel}>Latest saved</Text>
                <Text style={styles.latestValue}>
                  {formatNumber(latestSaved.estimated1rm)} {latestSaved.unit}
                </Text>
              </View>
              <Text style={styles.latestDate}>
                {latestSaved.achievedAt.slice(0, 10)}
              </Text>
            </View>
          ) : null}

          <WorkoutPrimaryButton
            label="Save 1RM Snapshot"
            icon="emoji_events"
            onPress={handleSave}
          />
        </GlassPanel>
      </ScrollView>

      <Modal visible={showExercisePicker} animationType="slide" transparent>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.modalTitle}>Choose Exercise</Text>
                <Text style={styles.modalSubtitle}>
                  Save this estimate against a lift in your library.
                </Text>
              </View>
              <Pressable onPress={() => setShowExercisePicker(false)} style={styles.modalClose}>
                <MaterialSymbol name="close" size={18} color="rgba(214, 195, 181, 0.72)" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.exerciseList}>
              {exercises.map((exercise) => (
                <ExercisePickerRow
                  key={exercise.id}
                  exercise={exercise}
                  selected={exercise.id === selectedExerciseId}
                  onPress={() => {
                    setSelectedExerciseId(exercise.id);
                    setShowExercisePicker(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputCard: {
    flex: 1,
    borderRadius: 26,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.highest,
    gap: 8,
  },
  inputLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  input: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    color: '#F4EEE8',
    paddingVertical: 0,
  },
  inputUnit: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.54)',
    letterSpacing: 1,
  },
  heroCard: {
    gap: spacing.xs,
    backgroundColor: WK_SURFACES.high,
  },
  resultLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: WK_ACCENT_LIGHT,
  },
  resultValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 52,
    lineHeight: 56,
    color: '#FFF3E7',
    letterSpacing: -1.8,
  },
  resultUnit: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.7)',
    marginBottom: spacing.sm,
  },
  dualFormulaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formulaValueCard: {
    flex: 1,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 4,
  },
  formulaValueLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.56)',
  },
  formulaValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#F4EEE8',
  },
  tableStack: {
    gap: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: WK_SURFACES.mid,
  },
  tablePercent: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: '#F4EEE8',
  },
  tableAssist: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  tableValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    color: WK_CATEGORY_COLORS.strength,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exerciseSelection: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 24,
    color: '#F4EEE8',
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: WK_SURFACES.mid,
  },
  latestLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.56)',
  },
  latestValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    color: '#F4EEE8',
    marginTop: 4,
  },
  latestDate: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalCard: {
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: WK_SURFACES.base,
  },
  modalTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF3E7',
  },
  modalSubtitle: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  exerciseList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  exerciseCopy: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#F4EEE8',
  },
  exerciseMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.58)',
    textTransform: 'capitalize',
  },
  exerciseCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  exerciseCheckActive: {
    backgroundColor: 'rgba(255, 184, 119, 0.14)',
  },
});
