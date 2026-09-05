import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  ProgressRing,
  SectionLabel,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  createGenerationEntry,
  createWorkout,
  generateLocalWorkout,
  getWorkoutExercises,
  markGenerationAccepted,
  type EquipmentType,
  type GeneratedWorkout,
  type GenerationGoal,
  type WorkoutDifficulty,
} from '@mylife/workouts';
import { useDatabase } from '../../components/DatabaseProvider';
import { PHASE3_EQUIPMENT_OPTIONS } from '../../lib/workouts/phase3';
import { ExerciseArtwork, StickyActionBar, WorkoutRouteHeader } from './phase3-kit';
import { uuid } from '../../lib/uuid';

type WizardGoal = 'strength' | 'hypertrophy' | 'cardio' | 'mobility';
type WizardStep = 1 | 2 | 3 | 4;

const GOALS: Array<{
  key: WizardGoal;
  title: string;
  body: string;
  accent: string;
  icon: string;
  requestGoal: GenerationGoal;
  difficulty: WorkoutDifficulty;
}> = [
  {
    key: 'strength',
    title: 'Strength',
    body: 'Heavy compounds with long rest and lower reps.',
    accent: WK_CATEGORY_COLORS.strength,
    icon: 'fitness_center',
    requestGoal: 'strength',
    difficulty: 'intermediate',
  },
  {
    key: 'hypertrophy',
    title: 'Hypertrophy',
    body: 'Volume-first training for muscle growth and pump.',
    accent: WK_CATEGORY_COLORS.hypertrophy,
    icon: 'local_fire_department',
    requestGoal: 'hypertrophy',
    difficulty: 'intermediate',
  },
  {
    key: 'cardio',
    title: 'Cardio',
    body: 'Conditioning blocks with density and elevated pace.',
    accent: WK_CATEGORY_COLORS.cardio,
    icon: 'monitor_heart',
    requestGoal: 'endurance',
    difficulty: 'beginner',
  },
  {
    key: 'mobility',
    title: 'Mobility',
    body: 'Low-friction movement prep and recovery flow.',
    accent: WK_CATEGORY_COLORS.recovery,
    icon: 'self_improvement',
    requestGoal: 'general',
    difficulty: 'beginner',
  },
];

const DURATIONS = [15, 30, 45, 60, 75, 90] as const;

function estimateVolume(workout: GeneratedWorkout | null): number {
  if (!workout) return 0;
  return workout.exercises.reduce((total, exercise) => {
    return total + exercise.sets * (exercise.reps ?? Math.max(Math.round((exercise.duration ?? 30) / 5), 1)) * 10;
  }, 0);
}

export default function GenerateScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [goal, setGoal] = useState<WizardGoal>('hypertrophy');
  const [equipment, setEquipment] = useState<EquipmentType[]>(['bodyweight']);
  const [duration, setDuration] = useState(45);
  const [generated, setGenerated] = useState<GeneratedWorkout | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const exercises = useMemo(() => {
    try {
      return getWorkoutExercises(db, { limit: 400 });
    } catch {
      return [];
    }
  }, [db]);

  const exerciseMap = useMemo(() => {
    return Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const selectedGoal = GOALS.find((item) => item.key === goal) ?? GOALS[0];
  const generatedVolume = estimateVolume(generated);

  const toggleEquipment = (value: EquipmentType) => {
    setEquipment((current) => {
      return current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
    });
  };

  const runGeneration = useCallback(() => {
    setGenerating(true);
    setGenerationError(null);

    setTimeout(() => {
      try {
        const result = generateLocalWorkout(
          {
            goal: selectedGoal.requestGoal,
            muscleFocus: [],
            equipment,
            durationMinutes: duration,
            difficulty: selectedGoal.difficulty,
          },
          exercises,
          new Set(),
        );

        if (!result) {
          throw new Error('No workout could be generated from the current library.');
        }

        const id = uuid();
        createGenerationEntry(db, id, {
          goal: selectedGoal.requestGoal,
          focus: selectedGoal.title,
          equipment,
          difficulty: selectedGoal.difficulty,
          durationMinutes: duration,
          generatedWorkoutJson: JSON.stringify(result),
          source: 'local',
        });

        setGenerationId(id);
        setGenerated(result);
        setStep(4);
      } catch (error) {
        setGenerationError(error instanceof Error ? error.message : 'Generation failed.');
      } finally {
        setGenerating(false);
      }
    }, 320);
  }, [db, duration, equipment, exercises, selectedGoal]);

  const saveGeneratedWorkout = () => {
    if (!generated) return;

    const workoutId = uuid();
    createWorkout(db, workoutId, {
      title: generated.title,
      description: generated.description,
      difficulty: selectedGoal.difficulty,
      exercises: generated.exercises,
      estimatedDuration: generated.estimatedDuration,
      isPremium: false,
    });

    if (generationId) {
      markGenerationAccepted(db, generationId);
    }

    router.replace(`/(workouts)/session?workoutId=${workoutId}` as never);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutRouteHeader
          title="AI Generator"
          overline="Curator"
          onBack={() => router.back()}
          right={(
            <View style={styles.dotRow}>
              {[1, 2, 3, 4].map((value) => (
                <View
                  key={value}
                  style={[
                    styles.dot,
                    (generating ? 4 : step) >= value && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        />

        <View style={styles.body}>
          {step === 1 ? (
            <>
              <View style={styles.heroBlock}>
                <SectionLabel accent={selectedGoal.accent}>Step 1</SectionLabel>
                <RNText style={styles.heroTitle}>What&apos;s your goal?</RNText>
                <RNText style={styles.heroBody}>Pick the training outcome and the generator will shape the structure around it.</RNText>
              </View>

              <View style={styles.goalGrid}>
                {GOALS.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setGoal(item.key);
                      setStep(2);
                    }}
                    style={[
                      styles.goalCard,
                      goal === item.key && { backgroundColor: withAlpha(item.accent, '1A') },
                    ]}
                  >
                    <View style={[styles.goalIcon, { backgroundColor: withAlpha(item.accent, '24') }]}>
                      <MaterialSymbol name={item.icon} size={18} color={item.accent} />
                    </View>
                    <RNText style={styles.goalTitle}>{item.title}</RNText>
                    <RNText style={styles.goalBody}>{item.body}</RNText>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={styles.heroBlock}>
                <SectionLabel accent={selectedGoal.accent}>Step 2</SectionLabel>
                <RNText style={styles.heroTitle}>What do you have?</RNText>
                <RNText style={styles.heroBody}>Select at least one equipment pool for the workout to pull from.</RNText>
              </View>

              <GlassPanel style={styles.panel}>
                <View style={styles.chipWrap}>
                  {PHASE3_EQUIPMENT_OPTIONS.map((item) => (
                    <Chip
                      key={item.key}
                      label={item.label}
                      selected={equipment.includes(item.key as EquipmentType)}
                      onPress={() => toggleEquipment(item.key as EquipmentType)}
                    />
                  ))}
                </View>
              </GlassPanel>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <View style={styles.heroBlock}>
                <SectionLabel accent={selectedGoal.accent}>Step 3</SectionLabel>
                <RNText style={styles.heroTitle}>How long?</RNText>
                <RNText style={styles.heroBody}>Set the time budget and the generator will scale exercise count and total load.</RNText>
              </View>

              <GlassPanel style={styles.panel}>
                <View style={styles.durationRail}>
                  {DURATIONS.map((value) => {
                    const active = duration === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setDuration(value)}
                        style={[styles.durationStop, active && styles.durationStopActive]}
                      >
                        <RNText style={[styles.durationLabel, active && styles.durationLabelActive]}>
                          {value}
                        </RNText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.durationMeta}>
                  <RNText style={styles.durationValue}>{duration} min</RNText>
                  <RNText style={styles.durationHint}>
                    About {Math.max(4, Math.round(duration / 8))} exercises in the final preview.
                  </RNText>
                </View>
              </GlassPanel>
            </>
          ) : null}

          {generating ? (
            <GlassPanel style={styles.loadingCard}>
              <ProgressRing
                progress={0.72}
                size={116}
                color={selectedGoal.accent}
                centerValue="AI"
                centerLabel="working"
              />
              <RNText style={styles.loadingTitle}>Curating your workout…</RNText>
              <RNText style={styles.loadingBody}>Balancing focus, equipment, duration, and variety across the exercise library.</RNText>
            </GlassPanel>
          ) : null}

          {!generating && step === 4 && generated ? (
            <>
              <View style={styles.heroBlock}>
                <SectionLabel accent={selectedGoal.accent}>Step 4</SectionLabel>
                <RNText style={styles.heroTitle}>Your workout is ready</RNText>
                <RNText style={styles.heroBody}>Review the build, regenerate if the vibe is off, or save it straight into the session flow.</RNText>
              </View>

              <GlassPanel style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={{ flex: 1 }}>
                    <RNText style={styles.previewTitle}>{generated.title}</RNText>
                    <RNText style={styles.previewBody}>{generated.description}</RNText>
                  </View>
                  <View style={styles.previewStat}>
                    <RNText style={styles.previewStatLabel}>Est. Volume</RNText>
                    <RNText style={styles.previewStatValue}>{generatedVolume.toLocaleString()}</RNText>
                  </View>
                </View>
                <View style={styles.previewMeta}>
                  <Chip label={selectedGoal.title} selected accent={selectedGoal.accent} />
                  <Chip label={`${duration} min`} />
                  <Chip label={`${generated.exercises.length} exercises`} />
                  <Chip label={`${equipment.length} tools`} />
                </View>
              </GlassPanel>

              <View style={styles.previewList}>
                {generated.exercises.map((exercise, index) => {
                  const reference = exerciseMap[exercise.exerciseId];
                  return (
                    <GlassPanel key={`${exercise.exerciseId}-${index}`} padding={0} style={styles.previewItem}>
                      <View style={styles.previewItemMedia}>
                        <ExerciseArtwork
                          title={exercise.name}
                          accent={selectedGoal.accent}
                          uri={reference?.thumbnailUrl}
                          height={86}
                        />
                      </View>
                      <View style={styles.previewItemCopy}>
                        <RNText style={styles.previewItemTitle}>{exercise.name}</RNText>
                        <RNText style={styles.previewItemBody}>
                          {exercise.sets} sets • {exercise.reps ?? '--'} reps • {exercise.restAfter}s rest
                        </RNText>
                      </View>
                    </GlassPanel>
                  );
                })}
              </View>
            </>
          ) : null}

          {generationError ? (
            <GlassPanel style={styles.errorCard}>
              <RNText style={styles.errorTitle}>Generation stalled</RNText>
              <RNText style={styles.errorBody}>{generationError}</RNText>
              <Pressable onPress={runGeneration} style={styles.retryButton}>
                <RNText style={styles.retryButtonText}>Retry</RNText>
              </Pressable>
            </GlassPanel>
          ) : null}
        </View>
      </ScrollView>

      {!generating ? (
        <StickyActionBar
          primaryLabel={
            step < 3
              ? 'Continue'
              : step === 3
                ? 'Generate Workout'
                : 'Save Workout'
          }
          primaryIcon={step === 4 ? 'check_circle' : step === 3 ? 'auto_awesome' : 'arrow_forward'}
          onPrimary={() => {
            if (step === 1) {
              setStep(2);
              return;
            }
            if (step === 2) {
              if (equipment.length === 0) {
                return;
              }
              setStep(3);
              return;
            }
            if (step === 3) {
              runGeneration();
              return;
            }
            saveGeneratedWorkout();
          }}
          secondaryLabel={step === 4 ? 'Regenerate' : step > 1 ? 'Back' : undefined}
          onSecondary={step === 4 ? runGeneration : step > 1 ? () => setStep((value) => Math.max(1, value - 1) as WizardStep) : undefined}
        />
      ) : null}
    </View>
  );
}

function withAlpha(color: string, alphaHex: string): string {
  return color.startsWith('#') && color.length === 7 ? `${color}${alphaHex}` : color;
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
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WK_SURFACES.highest,
  },
  dotActive: {
    backgroundColor: WK_ACCENT_LIGHT,
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
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  goalCard: {
    width: '47%',
    minHeight: 176,
    padding: 18,
    borderRadius: 28,
    gap: 12,
    backgroundColor: WK_SURFACES.low,
  },
  goalIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E4E1E9',
  },
  goalBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  panel: {
    padding: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  durationStop: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  durationStopActive: {
    backgroundColor: WK_ACCENT,
  },
  durationLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: '#E4E1E9',
  },
  durationLabelActive: {
    color: '#4B2700',
  },
  durationMeta: {
    marginTop: 16,
    gap: 4,
  },
  durationValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: '#E4E1E9',
  },
  durationHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  loadingCard: {
    alignItems: 'center',
    gap: 16,
    padding: 28,
  },
  loadingTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E4E1E9',
  },
  loadingBody: {
    textAlign: 'center',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  previewCard: {
    gap: 12,
    padding: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
  },
  previewBody: {
    marginTop: 6,
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  previewStat: {
    minWidth: 92,
    alignItems: 'flex-end',
    gap: 4,
  },
  previewStatLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(214, 195, 181, 0.46)',
  },
  previewStatValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: selectedGoalColorFallback(),
  },
  previewMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewList: {
    gap: 12,
  },
  previewItem: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  previewItemMedia: {
    width: 98,
  },
  previewItemCopy: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  previewItemTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  previewItemBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  errorCard: {
    gap: 10,
    padding: 18,
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: '#E4E1E9',
  },
  errorBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  retryButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(228, 225, 233, 0.82)',
    textTransform: 'uppercase',
  },
});

function selectedGoalColorFallback() {
  return '#E4E1E9';
}
