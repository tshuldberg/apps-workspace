import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GlassPanel,
  MaterialSymbol,
  ProgressRing,
  SectionLabel,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  calculate1RM,
  completeWorkoutSession,
  createStartedPlayerStatus,
  createWorkoutSession,
  getPreviousPerformance,
  getSetWeightsForSession,
  getWorkoutById,
  getWorkoutExerciseById,
  getWorkoutSessions,
  playerProgress,
  recordSetWeight,
  reducePlayer,
  type CompletedExercise,
  type PlayerStatus,
  type PreviousPerformanceMap,
  type SetType,
  type SetWeightRow,
  type WorkoutDefinition,
  type WorkoutExerciseInput,
  type WorkoutSession,
} from '@mylife/workouts';
import { Mic, MicOff } from 'lucide-react-native';
import { colors } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import { resolveDraftSetFlush } from '../../lib/workouts/draft-flush';
import { useVoiceCoach, type VoiceCoachGrammar } from '../../lib/voice/useVoiceCoach';
import {
  describeSessionCommand,
  parseSessionCommand,
  sessionCommandKey,
  getSupportedSessionCommands,
  type SessionVoiceMatch,
} from '../../lib/voice/session-commands';
import {
  WorkoutBodyCopy,
  WorkoutGradientButton,
  WorkoutGhostButton,
  WorkoutPhaseHeader,
  WorkoutPhaseScreen,
  avatarLabel,
  formatClock,
  formatDateTimeLabel,
  formatMinutesLabel,
  formatVolumeLabel,
} from './phase2-kit';

// Session grammar for the shared voice coach hook (apps/dowork/lib/voice/useVoiceCoach.ts):
// hands-free session control ("next set", "reps 10", "pause") vs. the player's
// transport vocabulary. Module-level constant so it is created once, not per render.
const SESSION_VOICE_GRAMMAR: VoiceCoachGrammar<SessionVoiceMatch> = {
  parse: parseSessionCommand,
  keyOf: sessionCommandKey,
  describe: (match) => describeSessionCommand(match.action),
  contextualStrings: getSupportedSessionCommands(),
};

const SESSION_VOICE_PILL_LABEL: Record<string, string> = {
  listening: 'Listening',
  paused: 'Voice ready',
  off: 'Tap to talk',
  denied: 'Mic blocked',
  unavailable: 'Voice unavailable',
  interrupted: 'Tap to talk',
};

const TICK_MS = 200;

type EditableSetLabel = 'Working' | 'Warmup' | 'Drop' | 'Failure';

type SetDraft = {
  weight: string;
  reps: string;
  setLabel: EditableSetLabel;
};

type CompletedSetRecord = {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  setLabel: EditableSetLabel;
};

type DetailModel = {
  session: WorkoutSession;
  workout: WorkoutDefinition;
  weights: SetWeightRow[];
};

const SET_LABELS: EditableSetLabel[] = ['Working', 'Warmup', 'Drop', 'Failure'];

const SET_LABEL_COLORS: Record<EditableSetLabel, string> = {
  Working: WK_ACCENT_LIGHT,
  Warmup: WK_CATEGORY_COLORS.cardio,
  Drop: WK_CATEGORY_COLORS.hypertrophy,
  Failure: '#FF7A7A',
};

function draftKey(exerciseId: string, setNumber: number): string {
  return `${exerciseId}:${setNumber}`;
}

function sanitizeNumberText(value: string): string {
  return value.replace(/[^0-9.]/g, '');
}

function inferSetLabel(setType?: SetType): EditableSetLabel {
  switch (setType) {
    case 'dropset':
      return 'Drop';
    case 'pyramid':
      return 'Warmup';
    default:
      return 'Working';
  }
}

function buildExerciseInputs(
  workout: WorkoutDefinition,
  fallbackRestSeconds: number,
): WorkoutExerciseInput[] {
  return workout.exercises.map((entry) => ({
    exercise_id: entry.exerciseId,
    sets: entry.sets,
    reps: entry.reps,
    duration: entry.duration,
    rest_after: entry.restAfter || fallbackRestSeconds,
    order: entry.order,
  }));
}

function buildInitialDrafts(
  exercises: WorkoutExerciseInput[],
  previousPerformance: PreviousPerformanceMap,
): Record<string, SetDraft> {
  const drafts: Record<string, SetDraft> = {};

  for (const exercise of exercises) {
    const previousExercise = previousPerformance.get(exercise.exercise_id);
    for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
      const previousSet =
        previousExercise?.get(setNumber) ??
        previousExercise?.get(Math.max(setNumber - 1, 1)) ??
        previousExercise?.get(1);
      drafts[draftKey(exercise.exercise_id, setNumber)] = {
        weight:
          previousSet && previousSet.weight > 0
            ? String(Math.round(previousSet.weight * 10) / 10)
            : '',
        reps:
          previousSet?.reps != null
            ? String(previousSet.reps)
            : exercise.reps != null
              ? String(exercise.reps)
              : '',
        setLabel: inferSetLabel(exercise.setType),
      };
    }
  }

  return drafts;
}

function buildCompletedExercises(status: PlayerStatus): CompletedExercise[] {
  return status.completed.map((item) => ({
    exerciseId: item.exercise_id,
    setsCompleted: item.sets_completed,
    repsCompleted: item.reps_completed,
    durationActual: item.duration_actual,
    skipped: item.skipped,
  }));
}

function calculateSessionVolume(weights: SetWeightRow[]): number {
  return weights.reduce((total, item) => total + item.weight * item.reps, 0);
}

export default function WorkoutSessionScreen() {
  useKeepAwake();

  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workoutId?: string; id?: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<WorkoutDefinition | null>(null);
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [previousPerformance, setPreviousPerformance] = useState<PreviousPerformanceMap>(new Map());
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  const [completedSets, setCompletedSets] = useState<CompletedSetRecord[]>([]);
  const [detail, setDetail] = useState<DetailModel | null>(null);
  const [restTotalMs, setRestTotalMs] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const lastStateRef = useRef<PlayerStatus['state'] | null>(null);

  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const isLiveSession = !!params.workoutId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (params.workoutId) {
          const nextWorkout = getWorkoutById(db, params.workoutId);
          if (!nextWorkout) {
            throw new Error('Workout not found.');
          }

          const inputs = buildExerciseInputs(nextWorkout, settings.defaultRestSeconds);
          const names: Record<string, string> = {};
          for (const exercise of nextWorkout.exercises) {
            const libraryItem = getWorkoutExerciseById(db, exercise.exerciseId);
            names[exercise.exerciseId] = libraryItem?.name ?? exercise.name;
          }

          const nextSessionId = uuid();
          createWorkoutSession(db, nextSessionId, {
            workoutId: nextWorkout.id,
          });

          if (cancelled) return;

          sessionIdRef.current = nextSessionId;
          setWorkout(nextWorkout);
          setExerciseNames(names);
          setStatus(createStartedPlayerStatus(inputs));

          const previous = getPreviousPerformance(db, nextWorkout.id, nextSessionId);
          setPreviousPerformance(previous);
          setDrafts(buildInitialDrafts(inputs, previous));
          setCompletedSets([]);
          setDetail(null);
          completedRef.current = false;
          lastStateRef.current = null;
        } else if (params.id) {
          const session = getWorkoutSessions(db, { limit: 500 }).find(
            (item) => item.id === params.id,
          );
          if (!session) {
            throw new Error('Workout session not found.');
          }
          const nextWorkout = getWorkoutById(db, session.workoutId);
          if (!nextWorkout) {
            throw new Error('Workout definition not found.');
          }
          const names: Record<string, string> = {};
          for (const exercise of nextWorkout.exercises) {
            const libraryItem = getWorkoutExerciseById(db, exercise.exerciseId);
            names[exercise.exerciseId] = libraryItem?.name ?? exercise.name;
          }

          if (cancelled) return;

          setWorkout(nextWorkout);
          setExerciseNames(names);
          setDetail({
            session,
            workout: nextWorkout,
            weights: getSetWeightsForSession(db, session.id),
          });
          setStatus(null);
        } else {
          throw new Error('Missing workout context.');
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to open workout.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db, params.id, params.workoutId, settings.defaultRestSeconds]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const currentExercise = status.exercises[status.currentExerciseIndex];
    if (!currentExercise) {
      return;
    }

    const key = draftKey(currentExercise.exercise_id, status.currentSet);
    setDrafts((prev) => {
      if (prev[key]) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          weight: '',
          reps: currentExercise.reps != null ? String(currentExercise.reps) : '',
          setLabel: inferSetLabel(currentExercise.setType),
        },
      };
    });
  }, [status]);

  // Keyed on the state DISCRIMINATOR, not the whole mutable status object:
  // status changes every 200ms tick, and depending on it tore down and
  // recreated the interval on every tick (JS churn + drift risk).
  const playerState = status?.state ?? null;
  useEffect(() => {
    const shouldTick =
      isLiveSession && (playerState === 'playing' || playerState === 'rest');
    if (!shouldTick) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = setInterval(() => {
      setStatus((currentStatus) =>
        currentStatus
          ? reducePlayer(currentStatus, { type: 'TICK', deltaMs: TICK_MS })
          : currentStatus,
      );
    }, TICK_MS);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isLiveSession, playerState]);

  useEffect(() => {
    if (!status) {
      return;
    }

    if (lastStateRef.current !== 'rest' && status.state === 'rest') {
      setRestTotalMs(status.restRemaining);
    }

    if (lastStateRef.current === 'rest' && status.state !== 'rest') {
      if (settings.restTimerAlerts) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Voice cue intentionally omitted: expo-speech is not bundled in DoWork.
    }

    lastStateRef.current = status.state;
  }, [settings.restTimerAlerts, settings.voiceCommandsEnabled, status]);

  const currentExercise = status?.exercises[status.currentExerciseIndex] ?? null;
  const currentExerciseName = currentExercise
    ? exerciseNames[currentExercise.exercise_id] ?? currentExercise.exercise_id
    : '';
  const currentDraft = currentExercise
    ? drafts[draftKey(currentExercise.exercise_id, status?.currentSet ?? 1)]
    : undefined;
  const currentPreviousSet =
    currentExercise && status
      ? previousPerformance.get(currentExercise.exercise_id)?.get(status.currentSet) ??
        previousPerformance.get(currentExercise.exercise_id)?.get(1)
      : undefined;

  const progress = status ? playerProgress(status) : 0;
  const restProgress =
    status?.state === 'rest' && restTotalMs > 0
      ? Math.max(0, Math.min(1, status.restRemaining / restTotalMs))
      : 0;

  const updateCurrentDraft = useCallback(
    (patch: Partial<SetDraft>) => {
      if (!currentExercise || !status) {
        return;
      }

      const key = draftKey(currentExercise.exercise_id, status.currentSet);
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? {
            weight: '',
            reps: currentExercise.reps != null ? String(currentExercise.reps) : '',
            setLabel: inferSetLabel(currentExercise.setType),
          }),
          ...patch,
        },
      }));
    },
    [currentExercise, status],
  );

  const finalizeSession = useCallback(
    async (finalStatus: PlayerStatus) => {
      if (!sessionIdRef.current || completedRef.current) {
        return;
      }

      try {
        completedRef.current = true;

        // Flush the in-progress draft set: if the player is mid-set with a
        // typed weight/reps that was never confirmed via Mark Complete (e.g.
        // the user tapped End Workout instead), persist it now so it is not
        // silently lost. The pure resolveDraftSetFlush helper owns the decision
        // (skip when completed, no exercise, already recorded, or empty draft).
        const flush = resolveDraftSetFlush({
          status: finalStatus,
          completedSets,
          getDraft: (exerciseId, setNumber) => drafts[draftKey(exerciseId, setNumber)],
        });
        if (flush) {
          recordSetWeight(db, uuid(), {
            sessionId: sessionIdRef.current,
            exerciseId: flush.exerciseId,
            setNumber: flush.setNumber,
            weight: flush.weight,
            reps: flush.reps,
            unit: settings.weightUnit,
            estimated1rm: calculate1RM(flush.weight, flush.reps),
          });
        }

        completeWorkoutSession(db, sessionIdRef.current, {
          exercisesCompleted: buildCompletedExercises(finalStatus),
        });

        const totalSets = finalStatus.completed.reduce(
          (sum, entry) => sum + entry.sets_completed,
          0,
        );

        router.replace({
          pathname: '/(root)/save-workout',
          params: {
            sessionId: sessionIdRef.current,
            duration: formatClock(finalStatus.elapsedTime),
            durationSeconds: String(Math.round(finalStatus.elapsedTime)),
            exerciseCount: String(
              finalStatus.completed.filter((entry) => !entry.skipped).length,
            ),
            totalSets: String(totalSets),
          },
        } as never);
      } catch (nextError) {
        completedRef.current = false;
        Alert.alert(
          'Unable to finish workout',
          nextError instanceof Error ? nextError.message : 'Please try again.',
        );
      }
    },
    [completedSets, db, drafts, router, settings.weightUnit],
  );

  const handleCompleteSet = useCallback(async () => {
    if (!status || !currentExercise || !sessionIdRef.current) {
      return;
    }

    const key = draftKey(currentExercise.exercise_id, status.currentSet);
    const draft = drafts[key];
    const repsValue = Number(draft?.reps ?? currentExercise.reps ?? 0);
    const weightValue = Number(draft?.weight ?? 0);

    try {
      if (repsValue > 0 && weightValue > 0) {
        recordSetWeight(db, uuid(), {
          sessionId: sessionIdRef.current,
          exerciseId: currentExercise.exercise_id,
          setNumber: status.currentSet,
          weight: weightValue,
          reps: repsValue,
          unit: settings.weightUnit,
          estimated1rm: calculate1RM(weightValue, repsValue),
        });
      }

      setCompletedSets((prev) => [
        ...prev.filter(
          (item) =>
            !(
              item.exerciseId === currentExercise.exercise_id &&
              item.setNumber === status.currentSet
            ),
        ),
        {
          exerciseId: currentExercise.exercise_id,
          setNumber: status.currentSet,
          weight: Math.max(0, weightValue),
          reps: Math.max(0, repsValue),
          setLabel: draft?.setLabel ?? inferSetLabel(currentExercise.setType),
        },
      ]);

      const nextStatus = reducePlayer(status, { type: 'COMPLETE_SET' });
      setStatus(nextStatus);

      if (nextStatus.state === 'completed') {
        await finalizeSession(nextStatus);
      }
    } catch (nextError) {
      Alert.alert(
        'Unable to record set',
        nextError instanceof Error ? nextError.message : 'Please try again.',
      );
    }
  }, [currentExercise, db, drafts, finalizeSession, settings.weightUnit, status]);

  const handleEndWorkout = useCallback(() => {
    if (!status) {
      return;
    }

    Alert.alert(
      'End workout?',
      'We will save your completed sets and send you to the save flow.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Workout',
          style: 'destructive',
          onPress: () => {
            void finalizeSession(status);
          },
        },
      ],
    );
  }, [finalizeSession, status]);

  const handleSetTypePress = useCallback(() => {
    if (!currentExercise || !status) {
      return;
    }

    Alert.alert(
      'Set Type',
      'Choose how this set should be labeled.',
      [
        ...SET_LABELS.map((label) => ({
          text: label,
          onPress: () => updateCurrentDraft({ setLabel: label }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [currentExercise, status, updateCurrentDraft]);

  const handleBackFromDetail = useCallback(() => {
    router.back();
  }, [router]);

  // Maps a recognized session command onto the same handlers the manual UI
  // uses, so voice control can never diverge from a tap: "next set" completes
  // the current set exactly like Mark Complete, "reps 10" / "weight 135" fill
  // the same draft the weight/reps inputs write to.
  const handleSessionVoiceCommand = useCallback(
    (match: SessionVoiceMatch): string | void => {
      if (!status) return;
      const action = match.action;
      switch (action.kind) {
        case 'complete_set':
          if (status.state === 'playing') {
            void handleCompleteSet();
          }
          return;
        case 'set_reps':
          updateCurrentDraft({ reps: String(action.value) });
          return;
        case 'set_weight':
          updateCurrentDraft({ weight: String(action.value) });
          return;
        case 'next_exercise':
          setStatus((prev) => (prev ? reducePlayer(prev, { type: 'SKIP_EXERCISE' }) : prev));
          return;
        case 'previous_exercise':
          setStatus((prev) => (prev ? reducePlayer(prev, { type: 'PREVIOUS_EXERCISE' }) : prev));
          return;
        case 'skip_rest':
          if (status.state === 'rest') {
            setStatus((prev) => (prev ? reducePlayer(prev, { type: 'REST_COMPLETE' }) : prev));
          }
          return;
        case 'pause':
          if (status.state === 'playing') {
            setStatus((prev) => (prev ? reducePlayer(prev, { type: 'PAUSE' }) : prev));
          }
          return;
        case 'resume':
          if (status.state === 'paused') {
            setStatus((prev) => (prev ? reducePlayer(prev, { type: 'RESUME' }) : prev));
          }
          return;
      }
    },
    [handleCompleteSet, status, updateCurrentDraft],
  );

  const voiceEnabled = isLiveSession && settings.voiceCommandsEnabled;
  const voiceActive = isLiveSession && (status?.state === 'playing' || status?.state === 'rest');
  const voiceCoach = useVoiceCoach<SessionVoiceMatch>({
    enabled: voiceEnabled,
    playing: voiceActive,
    onCommand: handleSessionVoiceCommand,
    grammar: SESSION_VOICE_GRAMMAR,
  });

  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  useEffect(() => {
    if (voiceCoach.lastCommandSeq === 0 || !voiceCoach.lastCommandLabel) return;
    setVoiceToast(voiceCoach.lastCommandLabel);
    const timer = setTimeout(() => setVoiceToast(null), 1200);
    return () => clearTimeout(timer);
  }, [voiceCoach.lastCommandSeq, voiceCoach.lastCommandLabel]);

  const handleVoicePillPress = useCallback(() => {
    switch (voiceCoach.status) {
      case 'denied':
        void Linking.openSettings();
        return;
      case 'unavailable':
        return;
      case 'interrupted':
        void voiceCoach.pushToTalk();
        return;
      case 'off':
        if (!voiceEnabled) {
          void voiceCoach.pushToTalk();
        } else {
          void voiceCoach.requestPermission();
        }
        return;
      case 'paused':
      case 'listening':
        return;
    }
  }, [voiceCoach, voiceEnabled]);

  const activeExerciseRows = useMemo(() => {
    if (!currentExercise || !status) {
      return [];
    }

    return Array.from({ length: currentExercise.sets }, (_, index) => {
      const setNumber = index + 1;
      const completed = completedSets.find(
        (item) =>
          item.exerciseId === currentExercise.exercise_id && item.setNumber === setNumber,
      );
      const draft = drafts[draftKey(currentExercise.exercise_id, setNumber)];
      const isCurrent = setNumber === status.currentSet && status.state !== 'completed';

      return {
        setNumber,
        completed,
        draft,
        isCurrent,
      };
    });
  }, [completedSets, currentExercise, drafts, status]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={WK_ACCENT} />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.centered}>
        <GlassPanel padding={24} style={styles.errorCard}>
          <RNText style={styles.errorTitle}>Workout unavailable</RNText>
          <WorkoutBodyCopy>{error ?? 'Please try again.'}</WorkoutBodyCopy>
          <View style={styles.errorActions}>
            <WorkoutGradientButton label="Go Back" onPress={() => router.back()} />
          </View>
        </GlassPanel>
      </View>
    );
  }

  if (!isLiveSession && detail) {
    const totalSets = detail.session.exercisesCompleted.reduce(
      (sum, item) => sum + item.setsCompleted,
      0,
    );
    const durationMinutes = detail.session.completedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(detail.session.completedAt).getTime() -
              new Date(detail.session.startedAt).getTime()) /
              60000,
          ),
        )
      : 0;
    const totalVolume = calculateSessionVolume(detail.weights);

    return (
      <WorkoutPhaseScreen>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutPhaseHeader
          title="Session Detail"
          onBack={handleBackFromDetail}
          right={(
            <Pressable
              onPress={() =>
                router.push(`/(root)/share-workout?sessionId=${detail.session.id}` as never)
              }
              style={styles.iconCircle}
              accessibilityRole="button"
              accessibilityLabel="Share workout"
            >
              <MaterialSymbol name="share" size={16} color={WK_ACCENT_LIGHT} />
            </Pressable>
          )}
        />

        <View style={styles.detailBody}>
          <SectionLabel accent={WK_ACCENT_LIGHT}>Training Journal</SectionLabel>
          <RNText style={styles.detailTitle}>{detail.workout.title}</RNText>
          <WorkoutBodyCopy>{formatDateTimeLabel(detail.session.completedAt ?? detail.session.startedAt)}</WorkoutBodyCopy>

          <View style={styles.detailStatRow}>
            <GlassPanel padding={18} style={styles.detailStatCard}>
              <RNText style={styles.detailStatValue}>{formatMinutesLabel(durationMinutes)}</RNText>
              <RNText style={styles.detailStatLabel}>Duration</RNText>
            </GlassPanel>
            <GlassPanel padding={18} style={styles.detailStatCard}>
              <RNText style={styles.detailStatValue}>{totalSets}</RNText>
              <RNText style={styles.detailStatLabel}>Sets</RNText>
            </GlassPanel>
            <GlassPanel padding={18} style={styles.detailStatCard}>
              <RNText style={styles.detailStatValue}>{formatVolumeLabel(totalVolume)}</RNText>
              <RNText style={styles.detailStatLabel}>Volume</RNText>
            </GlassPanel>
          </View>

          <View style={styles.sectionBlock}>
            <SectionLabel accent={WK_ACCENT}>Completed Exercises</SectionLabel>
            <View style={styles.stack}>
              {detail.session.exercisesCompleted.map((entry, index) => (
                <GlassPanel key={`${entry.exerciseId}-${index}`} padding={18}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyCopy}>
                      <RNText style={styles.historyTitle}>
                        {exerciseNames[entry.exerciseId] ?? entry.exerciseId}
                      </RNText>
                      <RNText style={styles.historyMeta}>
                        {entry.setsCompleted} sets
                        {entry.repsCompleted != null ? ` • ${entry.repsCompleted} reps` : ''}
                        {entry.skipped ? ' • skipped' : ''}
                      </RNText>
                    </View>
                    <MaterialSymbol
                      name={entry.skipped ? 'flag' : 'check_circle'}
                      size={18}
                      color={entry.skipped ? WK_CATEGORY_COLORS.cardio : WK_CATEGORY_COLORS.recovery}
                    />
                  </View>
                </GlassPanel>
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Set Log</SectionLabel>
            <View style={styles.stack}>
              {detail.weights.length === 0 ? (
                <GlassPanel padding={18}>
                  <WorkoutBodyCopy>No set weights were logged for this session.</WorkoutBodyCopy>
                </GlassPanel>
              ) : (
                detail.weights.map((entry) => (
                  <GlassPanel key={entry.id} padding={18}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyCopy}>
                        <RNText style={styles.historyTitle}>
                          {exerciseNames[entry.exerciseId] ?? entry.exerciseId}
                        </RNText>
                        <RNText style={styles.historyMeta}>
                          Set {entry.setNumber} • {entry.weight} {entry.unit} x {entry.reps}
                        </RNText>
                      </View>
                      <RNText style={styles.sessionMetaAccent}>
                        {Math.round(entry.estimated1rm)} 1RM
                      </RNText>
                    </View>
                  </GlassPanel>
                ))
              )}
            </View>
          </View>
        </View>
      </WorkoutPhaseScreen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.liveContent,
          { paddingBottom: insets.bottom + 180 },
        ]}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.liveHeaderShell}>
          <BlurView tint="dark" intensity={20} style={StyleSheet.absoluteFillObject} />
          <View style={styles.liveHeaderRow}>
            <View style={styles.elapsedBadge}>
              <MaterialSymbol name="timer" size={14} color={WK_ACCENT_LIGHT} />
              <RNText style={styles.elapsedText}>{formatClock(status?.elapsedTime ?? 0)}</RNText>
            </View>

            <RNText style={styles.liveHeaderTitle}>{workout.title}</RNText>

            <View style={styles.liveHeaderRight}>
              <Pressable
                onPress={handleVoicePillPress}
                disabled={voiceCoach.status === 'unavailable'}
                style={[
                  styles.iconCircle,
                  voiceCoach.status === 'listening' ? styles.iconCircleListening : null,
                  voiceCoach.status === 'unavailable' ? styles.iconCircleDisabled : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Voice control: ${SESSION_VOICE_PILL_LABEL[voiceCoach.status]}`}
                accessibilityHint={
                  voiceEnabled
                    ? 'Say "next set", "reps 10", "weight 135", or "pause" to control this workout hands-free.'
                    : 'Voice commands are off. Turn on voice commands in Settings to use hands-free logging.'
                }
              >
                {voiceCoach.status === 'listening' || voiceCoach.status === 'paused' ? (
                  <Mic size={16} color={voiceCoach.status === 'listening' ? WK_ACCENT_LIGHT : 'rgba(214, 195, 181, 0.72)'} />
                ) : (
                  <MicOff size={16} color="rgba(214, 195, 181, 0.48)" />
                )}
              </Pressable>
              <View
                style={styles.avatar}
                accessibilityRole="image"
                accessibilityLabel={`${settings.displayName} avatar`}
              >
                <RNText style={styles.avatarText}>{avatarLabel(settings.displayName)}</RNText>
              </View>
            </View>
          </View>
        </View>

        {voiceToast ? (
          <View style={styles.voiceToast} pointerEvents="none">
            <RNText style={styles.voiceToastText}>{voiceToast}</RNText>
          </View>
        ) : null}

        {voiceCoach.status === 'unavailable' && voiceCoach.unavailableReason && voiceEnabled ? (
          <View style={styles.voiceReason} pointerEvents="none">
            <RNText style={styles.voiceReasonText}>{voiceCoach.unavailableReason}</RNText>
          </View>
        ) : null}

        <View style={styles.liveBody}>
          <View style={styles.heroCard}>
            <View style={styles.heroCopy}>
              <SectionLabel accent={WK_ACCENT}>Current Exercise</SectionLabel>
              <RNText style={styles.exerciseHeroTitle}>{currentExerciseName}</RNText>
              <RNText style={styles.previousLine}>
                Last:{' '}
                {currentPreviousSet
                  ? `${currentPreviousSet.weight} ${currentPreviousSet.unit} x ${currentPreviousSet.reps}`
                  : 'No previous set data'}
              </RNText>
            </View>

            <ProgressRing
              progress={status?.state === 'rest' ? restProgress : progress}
              size={80}
              strokeWidth={4}
              color={
                status?.state === 'rest' && (status.restRemaining ?? 0) <= 10000
                  ? WK_CATEGORY_COLORS.hypertrophy
                  : WK_ACCENT_LIGHT
              }
              backgroundColor={WK_SURFACES.high}
              centerValue={
                status?.state === 'rest'
                  ? `${Math.ceil((status.restRemaining ?? 0) / 1000)}`
                  : `${Math.round(progress * 100)}%`
              }
              centerLabel={status?.state === 'rest' ? 'Rest' : 'Done'}
            />
          </View>

          <GlassPanel
            padding={22}
            style={[
              styles.activeSetCard,
              status?.state === 'rest' && (status.restRemaining ?? 0) <= 10000
                ? styles.activeSetCardAccent
                : null,
            ]}
          >
            <SectionLabel accent={SET_LABEL_COLORS[currentDraft?.setLabel ?? 'Working']}>
              Set {status?.currentSet ?? 1} of {currentExercise?.sets ?? 0}
            </SectionLabel>

            <View style={styles.inputRow}>
              <View style={styles.inputBlock}>
                <RNText style={styles.inputLabel}>Weight</RNText>
                <TextInput
                  keyboardType="decimal-pad"
                  value={currentDraft?.weight ?? ''}
                  onChangeText={(value) =>
                    updateCurrentDraft({ weight: sanitizeNumberText(value) })
                  }
                  placeholder="0"
                  placeholderTextColor="rgba(214, 195, 181, 0.34)"
                  style={styles.bigInput}
                  accessibilityLabel={`Weight in ${settings.weightUnit}`}
                  accessibilityHint={`Say "weight ${settings.weightUnit === 'kg' ? '60' : '135'}" to set this hands-free.`}
                />
                <RNText style={styles.inputSuffix}>{settings.weightUnit}</RNText>
              </View>

              <View style={styles.inputBlock}>
                <RNText style={styles.inputLabel}>
                  {currentExercise?.reps != null ? 'Reps' : 'Seconds'}
                </RNText>
                <TextInput
                  keyboardType="number-pad"
                  value={currentDraft?.reps ?? ''}
                  onChangeText={(value) =>
                    updateCurrentDraft({ reps: sanitizeNumberText(value) })
                  }
                  placeholder={currentExercise?.reps != null ? '0' : '30'}
                  placeholderTextColor="rgba(214, 195, 181, 0.34)"
                  style={styles.bigInput}
                  accessibilityLabel={currentExercise?.reps != null ? 'Reps completed' : 'Seconds completed'}
                  accessibilityHint={
                    currentExercise?.reps != null ? 'Say "reps 10" to set this hands-free.' : undefined
                  }
                />
                <RNText style={styles.inputSuffix}>
                  {currentExercise?.reps != null ? 'reps' : 'sec'}
                </RNText>
              </View>
            </View>

            <View style={styles.actionStrip}>
              <Pressable
                onPress={handleSetTypePress}
                style={styles.setTypePill}
                accessibilityRole="button"
                accessibilityLabel={`Set type: ${currentDraft?.setLabel ?? 'Working'}`}
                accessibilityHint="Opens a menu to change the set type."
              >
                <RNText
                  style={[
                    styles.setTypeText,
                    { color: SET_LABEL_COLORS[currentDraft?.setLabel ?? 'Working'] },
                  ]}
                >
                  {currentDraft?.setLabel ?? 'Working'}
                </RNText>
                <MaterialSymbol
                  name="chevron_right"
                  size={14}
                  color={SET_LABEL_COLORS[currentDraft?.setLabel ?? 'Working']}
                />
              </Pressable>

              {status?.state === 'playing' ? (
                <WorkoutGhostButton
                  label="Pause"
                  icon="pause"
                  onPress={() => setStatus((prev) => (prev ? reducePlayer(prev, { type: 'PAUSE' }) : prev))}
                />
              ) : status?.state === 'paused' ? (
                <WorkoutGhostButton
                  label="Resume"
                  icon="play_arrow"
                  onPress={() => setStatus((prev) => (prev ? reducePlayer(prev, { type: 'RESUME' }) : prev))}
                />
              ) : null}
            </View>

            <WorkoutGradientButton
              label="Mark Complete"
              icon="check"
              onPress={() => {
                void handleCompleteSet();
              }}
              disabled={status?.state !== 'playing'}
              accessibilityHint="Logs the current set and advances to the next set or rest."
            />
          </GlassPanel>

          <View style={styles.sectionBlock}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Set History</SectionLabel>
            <View style={styles.stack}>
              {activeExerciseRows.map((row) => {
                const statusLabel = row.completed ? 'completed' : row.isCurrent ? 'in progress' : 'upcoming';
                const detailLabel = row.completed
                  ? `${row.completed.weight} ${settings.weightUnit}, ${row.completed.reps} reps`
                  : row.draft?.weight || row.draft?.reps
                    ? `${row.draft?.weight || 'no weight'} ${settings.weightUnit}, ${row.draft?.reps || 'no reps'} reps entered`
                    : 'waiting for input';
                return (
                  <View
                    key={`${currentExercise?.exercise_id}-${row.setNumber}`}
                    accessible
                    accessibilityLabel={`Set ${row.setNumber}, ${statusLabel}, ${detailLabel}`}
                  >
                    <GlassPanel
                      padding={18}
                      style={row.isCurrent ? styles.currentRow : styles.historyPanel}
                    >
                      <View style={styles.historyRow}>
                        <View style={styles.historyCopy}>
                          <RNText style={styles.historyTitle}>Set {row.setNumber}</RNText>
                          <RNText style={styles.historyMeta}>
                            {row.completed
                              ? `${row.completed.weight} ${settings.weightUnit} x ${row.completed.reps}`
                              : row.draft?.weight || row.draft?.reps
                                ? `${row.draft?.weight || '--'} ${settings.weightUnit} x ${row.draft?.reps || '--'}`
                                : 'Waiting for your input'}
                          </RNText>
                        </View>
                        {row.completed ? (
                          <MaterialSymbol
                            name="check_circle"
                            size={18}
                            color={WK_CATEGORY_COLORS.recovery}
                          />
                        ) : row.isCurrent ? (
                          <RNText style={styles.sessionMetaAccent}>Live</RNText>
                        ) : (
                          <MaterialSymbol
                            name="schedule"
                            size={16}
                            color="rgba(214, 195, 181, 0.48)"
                          />
                        )}
                      </View>
                    </GlassPanel>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <GlassPanel
        padding={18}
        style={[
          styles.navigationBar,
          {
            left: 20,
            right: 20,
            bottom: insets.bottom + 18,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            setStatus((prev) =>
              prev ? reducePlayer(prev, { type: 'PREVIOUS_EXERCISE' }) : prev,
            )
          }
          style={styles.navButton}
          disabled={(status?.currentExerciseIndex ?? 0) === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous exercise"
          accessibilityState={{ disabled: (status?.currentExerciseIndex ?? 0) === 0 }}
        >
          <MaterialSymbol
            name="chevron_left"
            size={18}
            color={
              (status?.currentExerciseIndex ?? 0) === 0
                ? 'rgba(214, 195, 181, 0.28)'
                : WK_ACCENT_LIGHT
            }
          />
        </Pressable>

        <View
          style={styles.progressDots}
          accessible
          accessibilityLabel={
            status
              ? `Exercise ${status.currentExerciseIndex + 1} of ${status.exercises.length}`
              : undefined
          }
        >
          {status?.exercises.map((exercise, index) => {
            const completed = index < (status.currentExerciseIndex ?? 0);
            const active = index === (status.currentExerciseIndex ?? 0);
            return (
              <View
                key={`${exercise.exercise_id}-${index}`}
                style={[
                  styles.progressDot,
                  completed ? styles.progressDotDone : null,
                  active ? styles.progressDotActive : null,
                ]}
              />
            );
          })}
        </View>

        <Pressable
          onPress={() =>
            setStatus((prev) =>
              prev ? reducePlayer(prev, { type: 'SKIP_EXERCISE' }) : prev,
            )
          }
          style={styles.navButton}
          disabled={!status || status.currentExerciseIndex >= status.exercises.length - 1}
          accessibilityRole="button"
          accessibilityLabel="Next exercise"
          accessibilityHint='Say "next exercise" to do this hands-free.'
          accessibilityState={{
            disabled: !status || status.currentExerciseIndex >= status.exercises.length - 1,
          }}
        >
          <MaterialSymbol
            name="chevron_right"
            size={18}
            color={
              !status || status.currentExerciseIndex >= status.exercises.length - 1
                ? 'rgba(214, 195, 181, 0.28)'
                : WK_ACCENT_LIGHT
            }
          />
        </Pressable>
      </GlassPanel>

      <View
        style={[
          styles.endFab,
          {
            bottom: insets.bottom + 96,
          },
        ]}
      >
        <WorkoutGradientButton
          label="End Workout"
          icon="stop"
          onPress={handleEndWorkout}
          colors={['#FF7A7A', WK_CATEGORY_COLORS.hypertrophy]}
          accessibilityHint="Saves your completed sets and ends the workout."
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.lowest,
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
  errorTitle: {
    color: colors.text,
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  errorActions: {
    marginTop: 4,
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 24,
  },
  detailTitle: {
    color: colors.text,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  detailStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailStatCard: {
    flex: 1,
    gap: 6,
  },
  detailStatValue: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  detailStatLabel: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  sectionBlock: {
    gap: 12,
  },
  stack: {
    gap: 10,
  },
  historyPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    color: colors.text,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  historyMeta: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  sessionMetaAccent: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  liveContent: {
    backgroundColor: WK_SURFACES.lowest,
  },
  liveHeaderShell: {
    minHeight: 102,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(19, 19, 24, 0.7)',
  },
  liveHeaderRow: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  elapsedBadge: {
    minWidth: 88,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  elapsedText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  liveHeaderTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    lineHeight: 17,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  liveHeaderRight: {
    minWidth: 88,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconCircleListening: {
    backgroundColor: 'rgba(255, 184, 119, 0.18)',
  },
  iconCircleDisabled: {
    opacity: 0.5,
  },
  voiceToast: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  voiceToastText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.3,
  },
  voiceReason: {
    alignSelf: 'center',
    maxWidth: 300,
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  voiceReasonText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.72)',
    textAlign: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.14)',
  },
  avatarText: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  liveBody: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 18,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  exerciseHeroTitle: {
    ...WK_TYPOGRAPHY.displayLg,
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
  },
  previousLine: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  activeSetCard: {
    gap: 16,
  },
  activeSetCardAccent: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 14,
  },
  inputBlock: {
    flex: 1,
    minHeight: 122,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'space-between',
  },
  inputLabel: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  bigInput: {
    color: colors.text,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 40,
    padding: 0,
  },
  inputSuffix: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  setTypePill: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setTypeText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  currentRow: {
    backgroundColor: 'rgba(255, 184, 119, 0.08)',
  },
  navigationBar: {
    position: 'absolute',
    minHeight: 68,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  progressDots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(214, 195, 181, 0.22)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: WK_ACCENT_LIGHT,
  },
  progressDotDone: {
    backgroundColor: WK_CATEGORY_COLORS.recovery,
  },
  endFab: {
    position: 'absolute',
    right: 20,
    width: 180,
  },
});
