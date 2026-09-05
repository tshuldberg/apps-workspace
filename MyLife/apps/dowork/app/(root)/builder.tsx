import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WORKOUT_DIFFICULTIES,
  createWorkout,
  getWorkoutById,
  getWorkoutExercises,
  updateWorkout,
  type WorkoutDifficulty,
  type WorkoutExerciseEntry,
  type WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  WorkoutBodyCopy,
  WorkoutGradientButton,
  WorkoutPhaseHeader,
  WorkoutPhaseScreen,
  formatMinutesLabel,
} from './phase2-kit';
import { DW_ACCENT } from './theme/tokens';

type BuilderFocus = 'strength' | 'hypertrophy' | 'cardio' | 'mobility';

type BuilderEntry = WorkoutExerciseEntry & {
  clientId: string;
  thumbnailUrl: string | null;
  muscleLabel: string;
};

const FOCUS_OPTIONS: Array<{
  value: BuilderFocus;
  label: string;
  accent: string;
}> = [
  { value: 'strength', label: 'Strength', accent: WK_ACCENT_LIGHT },
  { value: 'hypertrophy', label: 'Hypertrophy', accent: WK_CATEGORY_COLORS.hypertrophy },
  { value: 'cardio', label: 'Cardio', accent: WK_CATEGORY_COLORS.cardio },
  { value: 'mobility', label: 'Mobility', accent: WK_CATEGORY_COLORS.recovery },
];

function entryFromLibraryItem(
  exercise: WorkoutExerciseLibraryItem,
  order: number,
): BuilderEntry {
  return {
    clientId: uuid(),
    exerciseId: exercise.id,
    name: exercise.name,
    category: exercise.category,
    sets: exercise.defaultSets,
    reps: exercise.defaultReps ?? 10,
    duration: exercise.defaultDuration,
    restAfter: 60,
    order,
    thumbnailUrl: exercise.thumbnailUrl,
    muscleLabel: exercise.muscleGroups[0]?.replace(/_/g, ' ') ?? 'full body',
  };
}

function estimateDuration(entries: BuilderEntry[]): number {
  let totalSeconds = 0;
  for (const exercise of entries) {
    const reps = exercise.reps ?? 10;
    const duration = exercise.duration ?? reps * 3;
    totalSeconds += duration * exercise.sets;
    totalSeconds += Math.max(0, exercise.sets - 1) * exercise.restAfter;
  }
  return Math.round(totalSeconds / 60);
}

function estimateVolume(entries: BuilderEntry[]): number {
  return entries.reduce((total, entry) => {
    const reps = entry.reps ?? 10;
    return total + entry.sets * reps * 45;
  }, 0);
}

function serializeBuilderState(input: {
  title: string;
  description: string;
  focus: BuilderFocus;
  difficulty: WorkoutDifficulty;
  entries: BuilderEntry[];
}): string {
  return JSON.stringify({
    title: input.title.trim(),
    description: input.description.trim(),
    focus: input.focus,
    difficulty: input.difficulty,
    entries: input.entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: entry.sets,
      reps: entry.reps,
      duration: entry.duration,
      restAfter: entry.restAfter,
    })),
  });
}

function capitalize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (token) => token.toUpperCase());
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isBuilderFocus(value: string | undefined): value is BuilderFocus {
  return value === 'strength' || value === 'hypertrophy' || value === 'cardio' || value === 'mobility';
}

// A metric chip that decrements on tap and increments on long-press. Long-press
// is not reliably reachable with a screen reader, so the same increment and
// decrement are exposed as accessibility actions and the hint spells out the
// tap/long-press gesture. This keeps the compact visual design while giving
// assistive-tech users a first-class way to adjust the value.
const CHIP_ADJUST_ACTIONS = [
  { name: 'increment', label: 'Increase' },
  { name: 'decrement', label: 'Decrease' },
] as const;

function AdjustableChip({
  label,
  accent,
  accessibilityLabel,
  onIncrement,
  onDecrement,
}: {
  label: string;
  accent: string;
  accessibilityLabel: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'increment') onIncrement();
      else if (event.nativeEvent.actionName === 'decrement') onDecrement();
    },
    [onIncrement, onDecrement],
  );

  return (
    <Pressable
      onPress={onDecrement}
      onLongPress={onIncrement}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Tap to decrease, long press to increase."
      accessibilityActions={CHIP_ADJUST_ACTIONS as unknown as { name: string; label: string }[]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <Chip label={label} selected accent={accent} />
    </Pressable>
  );
}

export default function WorkoutBuilderScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{
    edit?: string | string[];
    exerciseId?: string | string[];
    focus?: string | string[];
  }>();
  const editId = firstParam(params.edit);
  const exerciseId = firstParam(params.exerciseId);
  const requestedFocus = firstParam(params.focus);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [focus, setFocus] = useState<BuilderFocus>('strength');
  const [difficulty, setDifficulty] = useState<WorkoutDifficulty>('beginner');
  const [entries, setEntries] = useState<BuilderEntry[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<WorkoutExerciseLibraryItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const initialSnapshotRef = useRef('');
  const appliedExerciseQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const library = getWorkoutExercises(db, { limit: 500 });
    setExerciseLibrary(library);
    const baseFocus = !editId && isBuilderFocus(requestedFocus) ? requestedFocus : 'strength';

    if (!editId) {
      setFocus(baseFocus);
      initialSnapshotRef.current = serializeBuilderState({
        title: '',
        description: '',
        focus: baseFocus,
        difficulty: 'beginner',
        entries: [],
      });
      return;
    }

    const existing = getWorkoutById(db, editId);
    if (!existing) {
      return;
    }

    const libraryMap = new Map(library.map((item) => [item.id, item]));
    const hydratedEntries = existing.exercises.map((entry) => {
      const libraryItem = libraryMap.get(entry.exerciseId);
      return {
        ...entry,
        clientId: uuid(),
        thumbnailUrl: libraryItem?.thumbnailUrl ?? null,
        muscleLabel: libraryItem?.muscleGroups[0]?.replace(/_/g, ' ') ?? 'full body',
      };
    });

    setTitle(existing.title);
    setDescription(existing.description);
    setDifficulty(existing.difficulty);
    setEntries(hydratedEntries);

    initialSnapshotRef.current = serializeBuilderState({
      title: existing.title,
      description: existing.description,
      focus: 'strength',
      difficulty: existing.difficulty,
      entries: hydratedEntries,
    });
  }, [db, editId, requestedFocus]);

  useEffect(() => {
    if (!exerciseId || exerciseLibrary.length === 0) {
      return;
    }

    const signature = `${editId ?? 'new'}:${exerciseId}`;
    if (appliedExerciseQueryRef.current === signature) {
      return;
    }

    const exercise = exerciseLibrary.find((item) => item.id === exerciseId);
    if (!exercise) {
      return;
    }

    appliedExerciseQueryRef.current = signature;
    setEntries((prev) => {
      if (!editId && prev.some((entry) => entry.exerciseId === exercise.id)) {
        return prev;
      }

      return [...prev, entryFromLibraryItem(exercise, prev.length)];
    });
  }, [editId, exerciseId, exerciseLibrary]);

  const isDirty =
    serializeBuilderState({ title, description, focus, difficulty, entries }) !==
    initialSnapshotRef.current;

  const filteredLibrary = useMemo(() => {
    const search = pickerSearch.trim().toLowerCase();
    if (!search) {
      return exerciseLibrary;
    }

    return exerciseLibrary.filter((item) => {
      return (
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        item.muscleGroups.some((group) => group.toLowerCase().includes(search))
      );
    });
  }, [exerciseLibrary, pickerSearch]);

  const summary = useMemo(() => {
    return {
      exercises: entries.length,
      minutes: estimateDuration(entries),
      volume: estimateVolume(entries),
    };
  }, [entries]);

  const handleBack = () => {
    if (!isDirty) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'Your edits are not saved yet.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ],
    );
  };

  const openPicker = (index: number | null = null) => {
    setReplaceIndex(index);
    setPickerVisible(true);
  };

  const addOrReplaceExercise = (exercise: WorkoutExerciseLibraryItem) => {
    setEntries((prev) => {
      if (replaceIndex == null) {
        return [...prev, entryFromLibraryItem(exercise, prev.length)];
      }

      return prev.map((item, index) =>
        index === replaceIndex
          ? entryFromLibraryItem(exercise, index)
          : item,
      );
    });
    setPickerVisible(false);
    setReplaceIndex(null);
    setPickerSearch('');
  };

  const updateEntry = (
    clientId: string,
    patch: Partial<BuilderEntry>,
  ) => {
    setEntries((prev) =>
      prev.map((item, index) =>
        item.clientId === clientId ? { ...item, ...patch, order: index } : item,
      ),
    );
  };

  const removeEntry = (clientId: string) => {
    setEntries((prev) =>
      prev
        .filter((item) => item.clientId !== clientId)
        .map((item, index) => ({ ...item, order: index })),
    );
  };

  const handleMoreMenu = (index: number) => {
    const target = entries[index];
    Alert.alert(
      target.name,
      'Adjust this exercise slot.',
      [
        {
          text: 'Replace',
          onPress: () => openPicker(index),
        },
        {
          text: 'Add 15s Rest',
          onPress: () => updateEntry(target.clientId, { restAfter: target.restAfter + 15 }),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeEntry(target.clientId),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  const saveWorkout = async () => {
    if (!title.trim()) {
      Alert.alert('Workout name required', 'Give this workout a name before saving.');
      return;
    }
    if (entries.length === 0) {
      Alert.alert('Add an exercise', 'At least one exercise is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        description: description.trim() || `${capitalize(focus)} builder workout`,
        difficulty,
        exercises: entries.map((entry, index) => ({
          exerciseId: entry.exerciseId,
          name: entry.name,
          category: entry.category,
          sets: entry.sets,
          reps: entry.reps,
          duration: entry.duration,
          restAfter: entry.restAfter,
          order: index,
        })),
        estimatedDuration: Math.max(60, summary.minutes * 60),
        isPremium: false,
      };

      if (editId) {
        updateWorkout(db, editId, payload);
      } else {
        createWorkout(db, uuid(), payload);
      }

      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to save workout',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderEntry = (item: BuilderEntry, index: number) => {
    return (
      <View key={item.clientId}>
        <GlassPanel
          padding={18}
          style={styles.entryCard}
        >
          <View style={styles.entryHeader}>
            <View style={styles.dragHandle}>
              <MaterialSymbol name="drag_handle" size={18} color={WK_ACCENT_LIGHT} />
            </View>

            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailFallback}>
                <RNText style={styles.thumbnailFallbackText}>
                  {item.name.slice(0, 1).toUpperCase()}
                </RNText>
              </View>
            )}

            <View style={styles.entryCopy}>
              <RNText style={styles.entryName}>{item.name}</RNText>
              <RNText style={styles.entryMeta}>
                {capitalize(item.category)} • {capitalize(item.muscleLabel)}
              </RNText>
            </View>

            <Pressable
              onPress={() => handleMoreMenu(index)}
              style={styles.moreButton}
              accessibilityRole="button"
              accessibilityLabel={`More options for ${item.name}`}
              accessibilityHint="Replace, add rest, or remove this exercise."
            >
              <MaterialSymbol name="more_horiz" size={18} color="rgba(214, 195, 181, 0.72)" />
            </Pressable>
          </View>

          <View style={styles.metricChipRow}>
            <AdjustableChip
              label={`${item.sets} sets`}
              accent={DW_ACCENT}
              accessibilityLabel={`${item.sets} sets`}
              onDecrement={() => updateEntry(item.clientId, { sets: Math.max(1, item.sets - 1) })}
              onIncrement={() => updateEntry(item.clientId, { sets: item.sets + 1 })}
            />
            <AdjustableChip
              label={`${item.reps ?? '--'} reps`}
              accent={WK_ACCENT_LIGHT}
              accessibilityLabel={`${item.reps ?? 10} reps`}
              onDecrement={() =>
                updateEntry(item.clientId, { reps: Math.max(1, (item.reps ?? 10) - 1) })
              }
              onIncrement={() => updateEntry(item.clientId, { reps: (item.reps ?? 10) + 1 })}
            />
            <AdjustableChip
              label={`${item.restAfter}s rest`}
              accent={WK_CATEGORY_COLORS.cardio}
              accessibilityLabel={`${item.restAfter} seconds rest`}
              onDecrement={() =>
                updateEntry(item.clientId, { restAfter: Math.max(15, item.restAfter - 15) })
              }
              onIncrement={() => updateEntry(item.clientId, { restAfter: item.restAfter + 15 })}
            />
          </View>
        </GlassPanel>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <WorkoutPhaseHeader
        title="Workout Builder"
        onBack={handleBack}
        right={(
          <Pressable
            onPress={() => {
              void saveWorkout();
            }}
            disabled={saving}
            style={styles.saveTextWrap}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving workout' : 'Save workout'}
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            <RNText style={styles.saveText}>{saving ? 'Saving' : 'Save'}</RNText>
          </Pressable>
        )}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 180 }]}
      >
        <View style={styles.hero}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Workout Name"
            placeholderTextColor="rgba(214, 195, 181, 0.34)"
            style={styles.titleInput}
            accessibilityLabel="Workout name"
          />
          <WorkoutBodyCopy>
            Build the exact order, pacing, and volume you want before you step onto the floor.
          </WorkoutBodyCopy>
        </View>

        <View style={styles.section}>
          <RNText style={styles.sectionLabel}>Focus</RNText>
          <View style={styles.chipRow}>
            {FOCUS_OPTIONS.map((option) => (
              <View
                key={option.value}
                accessible
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: focus === option.value }}
              >
                <Chip
                  label={option.label}
                  selected={focus === option.value}
                  accent={option.accent}
                  onPress={() => setFocus(option.value)}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <RNText style={styles.sectionLabel}>Difficulty</RNText>
          <View style={styles.chipRow}>
            {WORKOUT_DIFFICULTIES.map((value) => (
              <View
                key={value}
                accessible
                accessibilityRole="button"
                accessibilityLabel={capitalize(value)}
                accessibilityState={{ selected: difficulty === value }}
              >
                <Chip
                  label={capitalize(value)}
                  selected={difficulty === value}
                  accent={DW_ACCENT}
                  onPress={() => setDifficulty(value)}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <RNText style={styles.sectionLabel}>Notes</RNText>
          <GlassPanel padding={18}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Short description, cues, or intent"
              placeholderTextColor="rgba(214, 195, 181, 0.34)"
              style={styles.descriptionInput}
              multiline
              accessibilityLabel="Workout notes"
            />
          </GlassPanel>
        </View>

        <View style={styles.section}>
          <RNText style={styles.sectionLabel}>Exercise List</RNText>

          {entries.length === 0 ? (
            <GlassPanel padding={20}>
              <WorkoutBodyCopy>
                No exercises yet. Add your first movement to start shaping the session.
              </WorkoutBodyCopy>
            </GlassPanel>
          ) : null}

          <View style={styles.list}>
            {entries.map((item, index) => renderEntry(item, index))}
          </View>

          <Pressable
            onPress={() => openPicker()}
            style={styles.addExerciseButton}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
          >
            <MaterialSymbol name="add_circle" size={18} color={WK_ACCENT_LIGHT} />
            <RNText style={styles.addExerciseText}>Add Exercise</RNText>
          </Pressable>
        </View>
      </ScrollView>

      <GlassPanel padding={18} style={styles.footer}>
        <View style={styles.footerMetrics}>
          <View>
            <RNText style={styles.footerValue}>{summary.exercises}</RNText>
            <RNText style={styles.footerLabel}>Exercises</RNText>
          </View>
          <View>
            <RNText style={styles.footerValue}>{formatMinutesLabel(summary.minutes)}</RNText>
            <RNText style={styles.footerLabel}>Duration</RNText>
          </View>
          <View>
            <RNText style={styles.footerValue}>
              {summary.volume >= 1000 ? `${(summary.volume / 1000).toFixed(1)}k` : summary.volume}
            </RNText>
            <RNText style={styles.footerLabel}>Volume</RNText>
          </View>
        </View>

        <WorkoutGradientButton
          label={params.edit ? 'Update Workout' : 'Save Workout'}
          icon="check"
          onPress={() => {
            void saveWorkout();
          }}
          disabled={saving}
        />
      </GlassPanel>

      <Modal
        animationType="slide"
        transparent
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <WorkoutPhaseHeader
              title={replaceIndex == null ? 'Exercise Picker' : 'Replace Exercise'}
              onBack={() => setPickerVisible(false)}
            />

            <View style={styles.modalBody}>
              <GlassPanel padding={16}>
                <View style={styles.searchRow}>
                  <MaterialSymbol name="search" size={16} color="rgba(214, 195, 181, 0.58)" />
                  <TextInput
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder="Search exercise or muscle"
                    placeholderTextColor="rgba(214, 195, 181, 0.34)"
                    style={styles.searchInput}
                    accessibilityLabel="Search exercise or muscle"
                  />
                </View>
              </GlassPanel>

              <WorkoutPhaseScreen contentContainerStyle={styles.modalResults}>
                {filteredLibrary.map((exercise) => (
                  <View
                    key={exercise.id}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`${exercise.name}, ${capitalize(exercise.category)}, ${capitalize(exercise.muscleGroups[0] ?? 'full_body')}`}
                    accessibilityHint={
                      replaceIndex == null ? 'Adds this exercise to the workout.' : 'Replaces the selected exercise.'
                    }
                  >
                    <GlassPanel padding={18} onPress={() => addOrReplaceExercise(exercise)}>
                      <View style={styles.libraryRow}>
                        <View style={styles.thumbnailFallback}>
                          <RNText style={styles.thumbnailFallbackText}>
                            {exercise.name.slice(0, 1).toUpperCase()}
                          </RNText>
                        </View>
                        <View style={styles.entryCopy}>
                          <RNText style={styles.entryName}>{exercise.name}</RNText>
                          <RNText style={styles.entryMeta}>
                            {capitalize(exercise.category)} • {capitalize(exercise.muscleGroups[0] ?? 'full_body')}
                          </RNText>
                        </View>
                        <MaterialSymbol name="chevron_right" size={18} color={WK_ACCENT_LIGHT} />
                      </View>
                    </GlassPanel>
                  </View>
                ))}
              </WorkoutPhaseScreen>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E0E13',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 22,
  },
  hero: {
    gap: 10,
  },
  titleInput: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
    padding: 0,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  descriptionInput: {
    minHeight: 84,
    color: '#E4E1E9',
    fontFamily: WK_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    padding: 0,
  },
  list: {
    gap: 12,
  },
  entryCard: {
    gap: 14,
  },
  entryCardActive: {
    backgroundColor: 'rgba(255, 184, 119, 0.08)',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dragHandle: {
    width: 30,
    alignItems: 'center',
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#1B1B20',
  },
  thumbnailFallback: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  thumbnailFallbackText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  entryCopy: {
    flex: 1,
    gap: 4,
  },
  entryName: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  entryMeta: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addExerciseButton: {
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 184, 119, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  addExerciseText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    borderRadius: 28,
    gap: 16,
  },
  footerMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerValue: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 19,
  },
  footerLabel: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  modalResults: {
    gap: 10,
    paddingBottom: 24,
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
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveTextWrap: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  saveText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
