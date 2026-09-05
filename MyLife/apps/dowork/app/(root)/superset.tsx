import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  createWorkout,
  getWorkoutExercises,
  type WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { estimateSupersetDurationSeconds } from '../../lib/workouts/superset-duration';
import {
  WorkoutBodyCopy,
  WorkoutGradientButton,
  WorkoutPhaseHeader,
  WorkoutPhaseScreen,
} from './phase2-kit';
import { DW_ACCENT } from './theme/tokens';

type SlotState = {
  exercise: WorkoutExerciseLibraryItem | null;
  sets: number;
  reps: number;
  restAfter: number;
};

const INITIAL_SLOT: SlotState = {
  exercise: null,
  sets: 4,
  reps: 10,
  restAfter: 60,
};

export default function WorkoutSupersetBuilderScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [library, setLibrary] = useState<WorkoutExerciseLibraryItem[]>([]);
  const [title, setTitle] = useState('Upper Body Superset');
  const [slots, setSlots] = useState<SlotState[]>([
    { ...INITIAL_SLOT },
    { ...INITIAL_SLOT },
    { ...INITIAL_SLOT },
  ]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  useEffect(() => {
    setLibrary(getWorkoutExercises(db, { limit: 500 }));
  }, [db]);

  const selectedCount = slots.filter((slot) => slot.exercise).length;

  const filteredLibrary = useMemo(() => {
    const search = pickerSearch.trim().toLowerCase();
    if (!search) {
      return library;
    }
    return library.filter((item) => {
      return (
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        item.muscleGroups.some((group) => group.toLowerCase().includes(search))
      );
    });
  }, [library, pickerSearch]);

  const updateSlot = (index: number, patch: Partial<SlotState>) => {
    setSlots((prev) => prev.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  };

  const openPicker = (index: number) => {
    setActiveSlotIndex(index);
    setPickerVisible(true);
  };

  const assignExercise = (exercise: WorkoutExerciseLibraryItem) => {
    if (activeSlotIndex == null) {
      return;
    }
    updateSlot(activeSlotIndex, { exercise });
    setPickerVisible(false);
    setActiveSlotIndex(null);
    setPickerSearch('');
  };

  const saveSupersetWorkout = () => {
    const selectedSlots = slots.filter((slot) => slot.exercise);
    if (selectedSlots.length < 2) {
      Alert.alert('Pick at least two exercises', 'Supersets need two movements or more.');
      return;
    }

    try {
      createWorkout(db, uuid(), {
        title: title.trim() || 'Superset Builder Workout',
        description: `Superset builder workout with ${selectedSlots
          .map((slot) => slot.exercise?.name)
          .filter(Boolean)
          .join(' + ')}`,
        difficulty: 'intermediate',
        exercises: selectedSlots.map((slot, index) => ({
          exerciseId: slot.exercise!.id,
          name: slot.exercise!.name,
          category: slot.exercise!.category,
          sets: slot.sets,
          reps: slot.reps,
          duration: slot.exercise!.defaultDuration,
          restAfter: slot.restAfter,
          order: index,
        })),
        estimatedDuration: estimateSupersetDurationSeconds(selectedSlots),
        isPremium: false,
      });

      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to save superset',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <WorkoutPhaseScreen contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutPhaseHeader title="Superset Builder" onBack={() => router.back()} />

      <View style={styles.body}>
        <View style={styles.hero}>
          <RNText style={styles.heroTitle}>Build Superset</RNText>
          <WorkoutBodyCopy>
            Pair antagonists, stack burners, or add a third finisher to make a tri-set.
          </WorkoutBodyCopy>
        </View>

        <GlassPanel padding={18}>
          <RNText style={styles.inputLabel}>Workout Name</RNText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Upper Body Superset"
            placeholderTextColor="rgba(214, 195, 181, 0.34)"
            style={styles.titleInput}
          />
        </GlassPanel>

        {slots.map((slot, index) => {
          const slotLabel = String.fromCharCode(65 + index);
          const isOptional = index === 2;

          return (
            <View key={slotLabel} style={styles.slotWrap}>
              {index > 0 ? (
                <View style={styles.plusWrap}>
                  <MaterialSymbol name="add" size={28} color={WK_ACCENT_LIGHT} />
                </View>
              ) : null}

              <GlassPanel padding={18} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <RNText style={styles.slotLabel}>
                    Exercise {slotLabel}
                    {isOptional ? ' • Optional' : ''}
                  </RNText>
                  {slot.exercise ? (
                    <Pressable onPress={() => updateSlot(index, { exercise: null })}>
                      <RNText style={styles.removeText}>Clear</RNText>
                    </Pressable>
                  ) : null}
                </View>

                {slot.exercise ? (
                  <>
                    <View style={styles.exerciseRow}>
                      <View style={styles.exerciseBadge}>
                        <RNText style={styles.exerciseBadgeText}>
                          {slot.exercise.name.slice(0, 1).toUpperCase()}
                        </RNText>
                      </View>
                      <View style={styles.exerciseCopy}>
                        <RNText style={styles.exerciseName}>{slot.exercise.name}</RNText>
                        <RNText style={styles.exerciseMeta}>
                          {slot.exercise.category} • {slot.exercise.muscleGroups[0] ?? 'full body'}
                        </RNText>
                      </View>
                      <Pressable onPress={() => openPicker(index)} style={styles.changeButton}>
                        <MaterialSymbol name="edit" size={16} color={WK_ACCENT_LIGHT} />
                      </Pressable>
                    </View>

                    <View style={styles.chipRow}>
                      <Pressable
                        onPress={() => updateSlot(index, { sets: Math.max(1, slot.sets - 1) })}
                        onLongPress={() => updateSlot(index, { sets: slot.sets + 1 })}
                      >
                        <Chip label={`${slot.sets} sets`} selected accent={DW_ACCENT} />
                      </Pressable>
                      <Pressable
                        onPress={() => updateSlot(index, { reps: Math.max(1, slot.reps - 1) })}
                        onLongPress={() => updateSlot(index, { reps: slot.reps + 1 })}
                      >
                        <Chip label={`${slot.reps} reps`} selected accent={WK_ACCENT_LIGHT} />
                      </Pressable>
                      <Pressable
                        onPress={() => updateSlot(index, { restAfter: Math.max(15, slot.restAfter - 15) })}
                        onLongPress={() => updateSlot(index, { restAfter: slot.restAfter + 15 })}
                      >
                        <Chip label={`${slot.restAfter}s rest`} selected accent={WK_CATEGORY_COLORS.cardio} />
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable onPress={() => openPicker(index)} style={styles.pickButton}>
                    <MaterialSymbol name="add_circle" size={18} color={WK_ACCENT_LIGHT} />
                    <RNText style={styles.pickButtonText}>Pick Exercise</RNText>
                  </Pressable>
                )}
              </GlassPanel>
            </View>
          );
        })}

        <GlassPanel padding={18} style={styles.summaryCard}>
          <RNText style={styles.summaryTitle}>Summary</RNText>
          <RNText style={styles.summaryText}>
            {selectedCount} movement{selectedCount === 1 ? '' : 's'} selected
          </RNText>
          <WorkoutGradientButton
            label="Save Superset"
            icon="check"
            onPress={saveSupersetWorkout}
          />
        </GlassPanel>
      </View>

      <Modal
        transparent
        animationType="slide"
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <WorkoutPhaseHeader title="Exercise Picker" onBack={() => setPickerVisible(false)} />
            <View style={styles.modalBody}>
              <GlassPanel padding={16}>
                <View style={styles.searchRow}>
                  <MaterialSymbol name="search" size={16} color="rgba(214, 195, 181, 0.58)" />
                  <TextInput
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder="Search the library"
                    placeholderTextColor="rgba(214, 195, 181, 0.34)"
                    style={styles.searchInput}
                  />
                </View>
              </GlassPanel>

              <WorkoutPhaseScreen contentContainerStyle={styles.modalResults}>
                {filteredLibrary.map((exercise) => (
                  <GlassPanel
                    key={exercise.id}
                    padding={18}
                    onPress={() => assignExercise(exercise)}
                  >
                    <View style={styles.libraryRow}>
                      <View style={styles.exerciseBadge}>
                        <RNText style={styles.exerciseBadgeText}>
                          {exercise.name.slice(0, 1).toUpperCase()}
                        </RNText>
                      </View>
                      <View style={styles.exerciseCopy}>
                        <RNText style={styles.exerciseName}>{exercise.name}</RNText>
                        <RNText style={styles.exerciseMeta}>
                          {exercise.category} • {exercise.muscleGroups[0] ?? 'full body'}
                        </RNText>
                      </View>
                      <MaterialSymbol name="chevron_right" size={18} color={WK_ACCENT_LIGHT} />
                    </View>
                  </GlassPanel>
                ))}
              </WorkoutPhaseScreen>
            </View>
          </View>
        </View>
      </Modal>
    </WorkoutPhaseScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  hero: {
    gap: 10,
  },
  heroTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  inputLabel: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  titleInput: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 22,
    padding: 0,
  },
  slotWrap: {
    gap: 12,
  },
  plusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCard: {
    gap: 14,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotLabel: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  removeText: {
    color: WK_CATEGORY_COLORS.hypertrophy,
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  exerciseBadgeText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  exerciseCopy: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  exerciseMeta: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  changeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  pickButtonText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  summaryCard: {
    gap: 12,
  },
  summaryTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  summaryText: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: '#0E0E13',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#E4E1E9',
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 18,
    padding: 0,
  },
  modalResults: {
    gap: 10,
    paddingBottom: 24,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
