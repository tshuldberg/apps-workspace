import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  createEmptyWeek,
  createWorkoutPlan,
  getWorkouts,
  type WorkoutDefinition,
  type WorkoutPlanWeek,
} from '@mylife/workouts';
import { useDatabase } from '../../../components/DatabaseProvider';
import { saveWorkoutProgramCover } from '../../../lib/workouts/settings';
import { getExerciseGradient, withAlpha } from '../../../lib/workouts/phase3';
import { ExerciseArtwork, StickyActionBar, WorkoutRouteHeader } from '../phase3-kit';
import { uuid } from '../../../lib/uuid';

const MIN_WEEKS = 1;
const MAX_WEEKS = 16;
const MIN_DAYS = 1;
const MAX_DAYS = 7;

function normalizeWeek(week: WorkoutPlanWeek, daysPerWeek: number): WorkoutPlanWeek {
  return {
    ...week,
    days: week.days.map((day, index) => ({
      ...day,
      rest_day: index >= daysPerWeek ? true : day.workout_id == null ? false : day.rest_day,
    })),
  };
}

function buildWeeks(count: number, existing: WorkoutPlanWeek[], daysPerWeek: number): WorkoutPlanWeek[] {
  const next = Array.from({ length: count }, (_, index) => {
    return existing[index] ?? createEmptyWeek(index + 1);
  });

  return next.map((week, index) => normalizeWeek({ ...week, week_number: index + 1 }, daysPerWeek));
}

function totalAssignedWorkouts(weeks: WorkoutPlanWeek[]): number {
  return weeks.reduce((total, week) => {
    return total + week.days.filter((day) => !day.rest_day && day.workout_id).length;
  }, 0);
}

const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export default function CreateProgramScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weekCount, setWeekCount] = useState(8);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [weeks, setWeeks] = useState<WorkoutPlanWeek[]>(() => buildWeeks(8, [], 4));
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const workouts = useMemo(() => {
    try {
      return getWorkouts(db);
    } catch {
      return [] as WorkoutDefinition[];
    }
  }, [db, refreshKey]);

  const currentWeek = weeks[selectedWeekIndex] ?? weeks[0];

  const updateWeekCount = (delta: number) => {
    const nextCount = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weekCount + delta));
    setWeekCount(nextCount);
    setWeeks((current) => buildWeeks(nextCount, current, daysPerWeek));
    setSelectedWeekIndex((current) => Math.min(current, nextCount - 1));
  };

  const updateDaysPerWeek = (delta: number) => {
    const nextDays = Math.max(MIN_DAYS, Math.min(MAX_DAYS, daysPerWeek + delta));
    setDaysPerWeek(nextDays);
    setWeeks((current) => current.map((week) => normalizeWeek(week, nextDays)));
  };

  const applyWeekOneToAll = () => {
    const source = weeks[0];
    if (!source) return;

    setWeeks((current) => current.map((week, index) => {
      if (index === 0) return week;
      return {
        week_number: index + 1,
        days: source.days.map((day) => ({ ...day })),
      };
    }));
  };

  const assignWorkout = (workoutId: string | null) => {
    if (pickerDayIndex == null) return;
    setWeeks((current) => current.map((week, weekIndex) => {
      if (weekIndex !== selectedWeekIndex) return week;
      return {
        ...week,
        days: week.days.map((day, dayIndex) => {
          if (dayIndex !== pickerDayIndex) return day;
          return {
            ...day,
            workout_id: workoutId,
            rest_day: workoutId == null,
          };
        }),
      };
    }));
    setPickerDayIndex(null);
  };

  const toggleRestDay = (dayIndex: number) => {
    setWeeks((current) => current.map((week, weekIndex) => {
      if (weekIndex !== selectedWeekIndex) return week;
      return {
        ...week,
        days: week.days.map((day, currentIndex) => {
          if (currentIndex !== dayIndex) return day;
          return {
            ...day,
            workout_id: day.rest_day ? day.workout_id : null,
            rest_day: !day.rest_day,
          };
        }),
      };
    }));
  };

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCoverUri(result.assets[0]?.uri ?? null);
    }
  };

  const saveProgram = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Add a program name before saving.');
      return;
    }

    if (totalAssignedWorkouts(weeks) === 0) {
      Alert.alert('Assign a workout', 'Add at least one workout to your week builder first.');
      return;
    }

    try {
      const planId = uuid();
      createWorkoutPlan(db, planId, {
        title: name.trim(),
        description: description.trim(),
        creatorId: null,
        weeksJson: JSON.stringify(weeks),
        isPremium: false,
      });
      saveWorkoutProgramCover(db, planId, coverUri);
      router.replace(`/(workouts)/program/${planId}` as never);
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Try again in a moment.');
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutRouteHeader
          title="Create Program"
          overline="New Architecture"
          onBack={() => router.back()}
          right={(
            <Pressable onPress={saveProgram} style={styles.saveButton}>
              <MaterialSymbol name="check_circle" size={18} color={WK_ACCENT_LIGHT} />
            </Pressable>
          )}
        />

        <View style={styles.body}>
          <View style={styles.heroBlock}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Build Your Program</SectionLabel>
            <RNText style={styles.heroTitle}>Design the long block</RNText>
            <RNText style={styles.heroBody}>
              Define the mission, map the weeks, and preload the workouts you want to cycle.
            </RNText>
          </View>

          <GlassPanel style={styles.identityCard}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Program Identity</SectionLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Hypertrophy Alpha III"
              placeholderTextColor="rgba(214, 195, 181, 0.36)"
              style={styles.nameInput}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Define the goals and methodology of this block..."
              placeholderTextColor="rgba(214, 195, 181, 0.36)"
              style={styles.descriptionInput}
            />
          </GlassPanel>

          <View style={styles.stepperRow}>
            <GlassPanel style={styles.stepperCard}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Weeks</SectionLabel>
              <View style={styles.stepperControls}>
                <Pressable onPress={() => updateWeekCount(-1)} style={styles.stepperButton}>
                  <MaterialSymbol name="remove" size={18} color="rgba(228, 225, 233, 0.72)" />
                </Pressable>
                <RNText style={styles.stepperValue}>{weekCount}</RNText>
                <Pressable onPress={() => updateWeekCount(1)} style={styles.stepperButton}>
                  <MaterialSymbol name="add" size={18} color="rgba(228, 225, 233, 0.72)" />
                </Pressable>
              </View>
            </GlassPanel>

            <GlassPanel style={styles.stepperCard}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Days / Week</SectionLabel>
              <View style={styles.stepperControls}>
                <Pressable onPress={() => updateDaysPerWeek(-1)} style={styles.stepperButton}>
                  <MaterialSymbol name="remove" size={18} color="rgba(228, 225, 233, 0.72)" />
                </Pressable>
                <RNText style={styles.stepperValue}>{daysPerWeek}</RNText>
                <Pressable onPress={() => updateDaysPerWeek(1)} style={styles.stepperButton}>
                  <MaterialSymbol name="add" size={18} color="rgba(228, 225, 233, 0.72)" />
                </Pressable>
              </View>
            </GlassPanel>
          </View>

          <GlassPanel style={styles.coverCard}>
            <View style={styles.coverHeader}>
              <View>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Cover Art</SectionLabel>
                <RNText style={styles.coverTitle}>Choose the visual theme</RNText>
              </View>
              <Pressable onPress={() => setCoverUri(null)} style={styles.coverReset}>
                <RNText style={styles.coverResetText}>Use Gradient</RNText>
              </Pressable>
            </View>
            <Pressable onPress={() => void pickCover()}>
              <ExerciseArtwork
                title={name.trim() || 'Program'}
                accent={getExerciseGradient({ category: 'strength' })[0]}
                uri={coverUri}
                height={180}
              />
            </Pressable>
            <RNText style={styles.coverBody}>
              Tap the hero to pick a photo, or keep the Obsidian gradient as the program cover.
            </RNText>
          </GlassPanel>

          <View style={styles.builderHeader}>
            <View>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Weekly Template</SectionLabel>
              <RNText style={styles.builderTitle}>Module builder</RNText>
            </View>
            <Pressable onPress={applyWeekOneToAll} style={styles.applyPill}>
              <MaterialSymbol name="check_circle" size={14} color={WK_ACCENT_LIGHT} />
              <RNText style={styles.applyPillText}>Apply week 1 to all</RNText>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRail}>
            {weeks.map((week, index) => (
              <Chip
                key={week.week_number}
                label={`Week ${week.week_number}`}
                selected={index === selectedWeekIndex}
                onPress={() => setSelectedWeekIndex(index)}
              />
            ))}
          </ScrollView>

          <View style={styles.dayGrid}>
            {currentWeek?.days.map((day, index) => {
              const workout = day.workout_id
                ? workouts.find((item) => item.id === day.workout_id)
                : null;
              const isRest = day.rest_day || !day.workout_id;

              return (
                <Pressable
                  key={`${currentWeek.week_number}-${day.day_number}`}
                  onPress={() => setPickerDayIndex(index)}
                  onLongPress={() => toggleRestDay(index)}
                  style={[
                    styles.dayCard,
                    !isRest && styles.dayCardAssigned,
                    index >= daysPerWeek && styles.dayCardMuted,
                  ]}
                >
                  <RNText style={styles.dayLabel}>{DAY_SHORT_LABELS[index]}</RNText>
                  <View
                    style={[
                      styles.dayIcon,
                      !isRest && styles.dayIconAssigned,
                    ]}
                  >
                    <MaterialSymbol
                      name={isRest ? 'hotel' : 'fitness_center'}
                      size={18}
                      color={isRest ? 'rgba(214, 195, 181, 0.42)' : WK_ACCENT_LIGHT}
                    />
                  </View>
                  <RNText style={styles.dayTitle} numberOfLines={2}>
                    {workout?.title ?? (isRest ? 'Rest' : 'Assign')}
                  </RNText>
                  <View style={styles.dayMeta}>
                    <MaterialSymbol name="drag_handle" size={14} color="rgba(214, 195, 181, 0.28)" />
                    <RNText style={styles.dayMetaText}>{isRest ? 'Long-press to toggle' : 'Tap to swap'}</RNText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <StickyActionBar
        primaryLabel="Save Program"
        primaryIcon="check_circle"
        onPrimary={saveProgram}
      />

      <Modal
        visible={pickerDayIndex != null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerDayIndex(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPickerDayIndex(null)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <SectionLabel accent={WK_ACCENT_LIGHT}>Assign Workout</SectionLabel>
            <RNText style={styles.sheetTitle}>
              {pickerDayIndex != null ? DAY_SHORT_LABELS[pickerDayIndex] : 'Day'}
            </RNText>

            <Pressable onPress={() => assignWorkout(null)} style={styles.sheetRow}>
              <View style={styles.sheetIcon}>
                <MaterialSymbol name="hotel" size={18} color="rgba(214, 195, 181, 0.62)" />
              </View>
              <View style={{ flex: 1 }}>
                <RNText style={styles.sheetRowTitle}>Rest day</RNText>
                <RNText style={styles.sheetRowBody}>Block the day for recovery or mobility.</RNText>
              </View>
            </Pressable>

            {workouts.length === 0 ? (
              <GlassPanel style={styles.emptyWorkoutsCard}>
                <RNText style={styles.emptyWorkoutsTitle}>No workouts yet</RNText>
                <RNText style={styles.emptyWorkoutsBody}>Build a workout first, then return to wire it into this program.</RNText>
              </GlassPanel>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.sheetList}>
                {workouts.map((workout) => (
                  <Pressable
                    key={workout.id}
                    onPress={() => assignWorkout(workout.id)}
                    style={styles.sheetRow}
                  >
                    <View style={styles.sheetIcon}>
                      <MaterialSymbol name="fitness_center" size={18} color={WK_ACCENT_LIGHT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <RNText style={styles.sheetRowTitle}>{workout.title}</RNText>
                      <RNText style={styles.sheetRowBody}>{workout.exercises.length} exercises</RNText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.base,
  },
  content: {
    paddingBottom: 108,
  },
  body: {
    paddingHorizontal: 24,
    gap: 22,
  },
  heroBlock: {
    gap: 8,
  },
  heroTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1,
    color: '#E4E1E9',
  },
  heroBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  saveButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  identityCard: {
    gap: 14,
    padding: 18,
  },
  nameInput: {
    minHeight: 60,
    borderRadius: 22,
    paddingHorizontal: 18,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
    backgroundColor: WK_SURFACES.highest,
  },
  descriptionInput: {
    minHeight: 110,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    textAlignVertical: 'top',
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#E4E1E9',
    backgroundColor: WK_SURFACES.highest,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperCard: {
    flex: 1,
    gap: 10,
    padding: 18,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  stepperValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: '#E4E1E9',
  },
  coverCard: {
    gap: 12,
    padding: 18,
  },
  coverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coverTitle: {
    marginTop: 4,
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#E4E1E9',
  },
  coverReset: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  coverResetText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(228, 225, 233, 0.72)',
    textTransform: 'uppercase',
  },
  coverBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  builderTitle: {
    marginTop: 4,
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
    color: '#E4E1E9',
  },
  applyPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(WK_ACCENT_LIGHT, '14'),
  },
  applyPillText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(228, 225, 233, 0.82)',
    textTransform: 'uppercase',
  },
  weekRail: {
    gap: 8,
    paddingRight: 24,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayCard: {
    width: '30.5%',
    minHeight: 132,
    padding: 14,
    borderRadius: 22,
    gap: 10,
    backgroundColor: WK_SURFACES.low,
  },
  dayCardAssigned: {
    backgroundColor: WK_SURFACES.high,
  },
  dayCardMuted: {
    opacity: 0.7,
  },
  dayLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: WK_ACCENT_LIGHT,
  },
  dayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  dayIconAssigned: {
    backgroundColor: withAlpha(WK_ACCENT_LIGHT, '16'),
  },
  dayTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 17,
    color: '#E4E1E9',
  },
  dayMeta: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayMetaText: {
    flex: 1,
    fontFamily: WK_FONTS.regular,
    fontSize: 10,
    lineHeight: 12,
    color: 'rgba(214, 195, 181, 0.42)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 16,
    backgroundColor: WK_SURFACES.low,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(214, 195, 181, 0.22)',
  },
  sheetTitle: {
    marginTop: -4,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
  },
  sheetList: {
    gap: 10,
  },
  sheetRow: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WK_SURFACES.high,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.highest,
  },
  sheetRowTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  sheetRowBody: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  emptyWorkoutsCard: {
    padding: 18,
    gap: 6,
  },
  emptyWorkoutsTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  emptyWorkoutsBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.66)',
  },
});
