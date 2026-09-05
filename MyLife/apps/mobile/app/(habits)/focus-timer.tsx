import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_GLOW,
  HB_ACCENT_LIGHT,
  HB_CTA_GRADIENT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  MaterialSymbol,
  advancePhase,
  calculateXPForAction,
  completeFocusSession,
  createFocusSession,
  createPomodoroState,
  createXPTransaction,
  ensurePlayerProfile,
  formatTimerDisplay,
  getAllFocusSessions,
  getHabits,
  getLevelForXP,
  getPlayerProfile,
  getRemainingMs,
  getSetting,
  isPhaseComplete,
  pauseTimer,
  recordCompletion,
  resumeTimer,
  setSetting,
  skipPhase,
  stopSession as stopPomodoroSession,
  updatePlayerXP,
  type Habit,
  type PomodoroConfig,
  type PomodoroState,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  calculateFocusStreakDays,
  formatCompactDuration,
} from '../../lib/habits/phase3';
import { uuid } from '../../lib/uuid';

// `expo-keep-awake` is not installed in this workspace yet.
function useKeepAwake(): void {}

type ScreenState = 'setup' | 'running' | 'complete';
type SessionRating = 'drifted' | 'solid' | 'locked-in' | null;

const TIMER_RADIUS = 132;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;
const PRESET_MINUTES = [15, 25, 45, 60, 90] as const;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function recommendedBreakMinutes(workMinutes: number) {
  if (workMinutes >= 60) return 10;
  if (workMinutes >= 45) return 8;
  if (workMinutes >= 25) return 5;
  return 3;
}

function recommendedLongBreakMinutes(workMinutes: number) {
  if (workMinutes >= 60) return 20;
  if (workMinutes >= 45) return 18;
  return 15;
}

function readIntSetting(raw: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function awardFocusXP(db: ReturnType<typeof useDatabase>, habitId: string | null) {
  ensurePlayerProfile(db);
  const profile = getPlayerProfile(db);
  const startingXP = profile?.totalXP ?? 0;
  const xpAwarded = calculateXPForAction('timed_completion');
  const totalXP = startingXP + xpAwarded;
  const level = getLevelForXP(totalXP);

  updatePlayerXP(db, totalXP, level);
  createXPTransaction(db, uuid(), xpAwarded, 'timed_completion', habitId);
  return xpAwarded;
}

function StepperRow({
  label,
  value,
  suffix,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  suffix: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.stepRow}>
      <View>
        <Text style={styles.stepLabel}>{label}</Text>
        <Text style={styles.stepValue}>
          {value}
          {suffix}
        </Text>
      </View>
      <View style={styles.stepControls}>
        <Pressable onPress={onDecrease} style={styles.iconCircle}>
          <MaterialSymbol name="remove" size={18} color={HB_TEXT} />
        </Pressable>
        <Pressable onPress={onIncrease} style={styles.iconCircle}>
          <MaterialSymbol name="add" size={18} color={HB_TEXT} />
        </Pressable>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <GlassCard level={2} style={styles.statCard}>
      <View style={styles.statIcon}>
        <MaterialSymbol name={icon} size={16} color={HB_ACCENT_LIGHT} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </GlassCard>
  );
}

export default function FocusTimerScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ habitId?: string }>();

  useKeepAwake();

  const [screenState, setScreenState] = useState<ScreenState>('setup');
  const [taskLabel, setTaskLabel] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [rounds, setRounds] = useState(4);
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(25);
  const [linkedHabitId, setLinkedHabitId] = useState<string | null>(null);
  const [pomState, setPomState] = useState<PomodoroState | null>(null);
  const [dataTick, setDataTick] = useState(0);
  const [completionSavedFor, setCompletionSavedFor] = useState<string | null>(null);
  const [sessionRating, setSessionRating] = useState<SessionRating>(null);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const configRef = useRef<PomodoroConfig>({
    workDuration: 25 * 60 * 1000,
    breakDuration: 5 * 60 * 1000,
    longBreakDuration: 15 * 60 * 1000,
    rounds: 4,
  });
  const settingsLoadedRef = useRef(false);

  const habits = useMemo(
    () => getHabits(db, { isArchived: false }).filter((habit) => !habit.isArchived),
    [db, dataTick],
  );
  const focusSessions = useMemo(() => getAllFocusSessions(db), [db, dataTick]);

  useEffect(() => {
    const preferredHabitId =
      params.habitId ??
      getSetting(db, 'focus_linked_habit_id') ??
      habits[0]?.id ??
      null;

    setWorkMin(readIntSetting(getSetting(db, 'focus_work_duration'), 25));
    setBreakMin(readIntSetting(getSetting(db, 'focus_break_duration'), 5));
    setLongBreakMin(readIntSetting(getSetting(db, 'focus_long_break_duration'), 15));
    setRounds(readIntSetting(getSetting(db, 'focus_rounds'), 4));
    setLinkedHabitId(preferredHabitId);
    settingsLoadedRef.current = true;
  }, [db, habits, params.habitId]);

  useEffect(() => {
    if (!settingsLoadedRef.current) {
      return;
    }

    const matchedPreset = PRESET_MINUTES.find((minutes) => minutes === workMin);
    setSelectedPreset(matchedPreset ?? 'custom');
  }, [workMin]);

  useEffect(() => {
    if (screenState !== 'running' || pomState == null || pomState.phase === 'completed') {
      return;
    }

    const interval = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [pomState, screenState]);

  useEffect(() => {
    if (screenState !== 'running' || pomState == null || pomState.phase === 'completed') {
      return;
    }

    if (isPhaseComplete(pomState, clockNow)) {
      setPomState((current) => {
        if (current == null || current.phase === 'completed') {
          return current;
        }

        if (isPhaseComplete(current, clockNow)) {
          return advancePhase(current, configRef.current, clockNow);
        }

        return current;
      });
    }
  }, [clockNow, pomState, screenState]);

  useEffect(() => {
    if (pomState?.phase !== 'completed') {
      return;
    }

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || completionSavedFor === currentSessionId) {
      setScreenState('complete');
      return;
    }

    try {
      const focusSeconds = Math.round(pomState.totalFocusMs / 1000);
      const breakSeconds = Math.round(pomState.totalBreakMs / 1000);
      const status = pomState.round >= pomState.roundsTarget ? 'completed' : 'abandoned';

      completeFocusSession(
        db,
        currentSessionId,
        pomState.round,
        focusSeconds,
        breakSeconds,
        status,
      );

      if (linkedHabitId != null && status === 'completed') {
        recordCompletion(db, uuid(), linkedHabitId, new Date().toISOString());
        setXpAwarded(awardFocusXP(db, linkedHabitId));
      } else {
        setXpAwarded(0);
      }

      setCompletionSavedFor(currentSessionId);
      setDataTick((value) => value + 1);
    } catch {
      Alert.alert('Focus Session', 'The session finished, but saving it failed.');
    } finally {
      setScreenState('complete');
    }
  }, [completionSavedFor, db, linkedHabitId, pomState]);

  useEffect(() => {
    if (screenState !== 'running') {
      return;
    }

    const handleBack = () => {
      handleClose();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [screenState]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = useMemo(
    () => focusSessions.filter((session) => session.startedAt.slice(0, 10) === todayKey),
    [focusSessions, todayKey],
  );
  const todayFocusedSeconds = useMemo(
    () => todaySessions.reduce((sum, session) => sum + session.totalFocusSeconds, 0),
    [todaySessions],
  );
  const currentStreakDays = useMemo(
    () => calculateFocusStreakDays(focusSessions, new Date(clockNow)),
    [clockNow, focusSessions],
  );

  const remainingMs =
    pomState == null || pomState.phase === 'completed'
      ? workMin * 60 * 1000
      : getRemainingMs(pomState, clockNow);
  const displayTime =
    pomState == null || pomState.phase === 'completed'
      ? formatTimerDisplay(workMin * 60 * 1000)
      : formatTimerDisplay(remainingMs);
  const progress =
    pomState == null || pomState.phase === 'completed'
      ? 0
      : Math.min(
          1,
          Math.max(0, (pomState.phaseDuration - remainingMs) / Math.max(1, pomState.phaseDuration)),
        );
  const dashOffset = TIMER_CIRCUMFERENCE * (1 - progress);

  const activeHabit = linkedHabitId != null ? habits.find((habit) => habit.id === linkedHabitId) ?? null : null;
  const phaseLabel =
    pomState?.phase === 'long_break'
      ? 'Long Break'
      : pomState?.phase === 'break'
        ? 'Break'
        : 'Focus';

  const persistSettings = useCallback(
    (nextHabitId: string | null = linkedHabitId) => {
      setSetting(db, 'focus_work_duration', String(workMin));
      setSetting(db, 'focus_break_duration', String(breakMin));
      setSetting(db, 'focus_long_break_duration', String(longBreakMin));
      setSetting(db, 'focus_rounds', String(rounds));
      if (nextHabitId != null) {
        setSetting(db, 'focus_linked_habit_id', nextHabitId);
      }
    },
    [breakMin, db, linkedHabitId, longBreakMin, rounds, workMin],
  );

  const applyPreset = useCallback((minutes: number) => {
    setSelectedPreset(minutes);
    setWorkMin(minutes);
    setBreakMin(recommendedBreakMinutes(minutes));
    setLongBreakMin(recommendedLongBreakMinutes(minutes));
  }, []);

  const handleChooseHabit = useCallback((habit: Habit) => {
    setLinkedHabitId(habit.id);
    setSetting(db, 'focus_linked_habit_id', habit.id);
  }, [db]);

  const resetState = useCallback(() => {
    setScreenState('setup');
    setPomState(null);
    setCompletionSavedFor(null);
    sessionIdRef.current = null;
    setSessionRating(null);
    setXpAwarded(0);
    setClockNow(Date.now());
  }, []);

  const handleStart = useCallback(() => {
    if (isStarting) {
      return;
    }

    const resolvedHabitId = linkedHabitId ?? habits[0]?.id ?? null;
    if (resolvedHabitId == null) {
      Alert.alert('Add a habit first', 'Create a habit so focus sessions can be saved and rewarded.');
      return;
    }

    setIsStarting(true);
    try {
      persistSettings(resolvedHabitId);

      const config: PomodoroConfig = {
        workDuration: workMin * 60 * 1000,
        breakDuration: breakMin * 60 * 1000,
        longBreakDuration: longBreakMin * 60 * 1000,
        rounds,
      };
      configRef.current = config;

      const now = Date.now();
      setClockNow(now);
      setPomState(createPomodoroState(config, now));
      setScreenState('running');
      setSessionRating(null);
      setXpAwarded(0);
      setCompletionSavedFor(null);

      const sessionId = uuid();
      sessionIdRef.current = sessionId;

      createFocusSession(db, sessionId, {
        habitId: resolvedHabitId,
        workDuration: workMin * 60,
        breakDuration: breakMin * 60,
        roundsTarget: rounds,
      });
    } catch {
      Alert.alert('Focus Timer', 'Unable to start the focus session.');
    } finally {
      setIsStarting(false);
    }
  }, [
    breakMin,
    db,
    habits,
    isStarting,
    linkedHabitId,
    longBreakMin,
    persistSettings,
    rounds,
    workMin,
  ]);

  const handlePauseResume = useCallback(() => {
    setPomState((current) => {
      if (current == null) {
        return current;
      }
      return current.isPaused ? resumeTimer(current, Date.now()) : pauseTimer(current, Date.now());
    });
  }, []);

  const handleSkip = useCallback(() => {
    setPomState((current) => {
      if (current == null) {
        return current;
      }
      return skipPhase(current, configRef.current, Date.now());
    });
  }, []);

  const handleReset = useCallback(() => {
    if (pomState == null) {
      resetState();
      return;
    }

    Alert.alert(
      'End this session?',
      'Your current progress will be saved as a partial focus session.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: () => {
            setPomState((current) => {
              if (current == null) {
                return current;
              }
              return stopPomodoroSession(current, Date.now());
            });
          },
        },
      ],
    );
  }, [pomState, resetState]);

  const handleClose = useCallback(() => {
    if (screenState !== 'running') {
      router.back();
      return;
    }

    Alert.alert(
      'Leave focus mode?',
      'Leaving now will save this session as abandoned.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            setPomState((current) => {
              if (current == null) {
                return current;
              }
              return stopPomodoroSession(current, Date.now());
            });
          },
        },
      ],
    );
  }, [router, screenState]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <MaterialSymbol name="close" size={20} color={HB_TEXT} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Mission Control</Text>
            <Text style={styles.headerTitle}>Focus</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(habits)/focus-analytics')}
            style={styles.headerButton}
          >
            <MaterialSymbol name="insights" size={20} color={HB_ACCENT_LIGHT} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 28, 36) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Big timer, calm chrome, zero drift.</Text>
            <Text style={styles.heroSubtitle}>
              Keep deep work anchored to one habit, one session, and one clean clock.
            </Text>
          </View>

          <GlassCard level={2} style={styles.taskCard}>
            <Text style={styles.cardLabel}>What are you focusing on?</Text>
            <TextInput
              value={taskLabel}
              onChangeText={setTaskLabel}
              placeholder="Deep work, studying, writing, or review"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.taskInput}
              editable={screenState !== 'running'}
            />
            <Text style={styles.helperText}>
              {activeHabit != null
                ? `Linked to ${activeHabit.name} for completions and XP`
                : 'Pick a habit below so finished sessions save cleanly'}
            </Text>
          </GlassCard>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Preset lengths</Text>
            <Text style={styles.sectionMeta}>{screenState === 'running' ? 'Locked while active' : 'Tap to switch'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {PRESET_MINUTES.map((minutes) => {
              const selected = selectedPreset === minutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => applyPreset(minutes)}
                  disabled={screenState === 'running'}
                  style={[styles.presetChip, selected && styles.presetChipSelected]}
                >
                  <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{minutes}m</Text>
                </Pressable>
              );
            })}
            <View style={[styles.presetChip, selectedPreset === 'custom' && styles.presetChipSelected]}>
              <Text style={[styles.presetText, selectedPreset === 'custom' && styles.presetTextSelected]}>
                Custom
              </Text>
            </View>
          </ScrollView>

          <GlassCard level={1} style={styles.settingsCard}>
            <StepperRow
              label="Work"
              value={workMin}
              suffix="m"
              onDecrease={() => setWorkMin((value) => clampNumber(value - 5, 5, 120))}
              onIncrease={() => setWorkMin((value) => clampNumber(value + 5, 5, 120))}
            />
            <StepperRow
              label="Break"
              value={breakMin}
              suffix="m"
              onDecrease={() => setBreakMin((value) => clampNumber(value - 1, 0, 30))}
              onIncrease={() => setBreakMin((value) => clampNumber(value + 1, 0, 30))}
            />
            <StepperRow
              label="Long break"
              value={longBreakMin}
              suffix="m"
              onDecrease={() => setLongBreakMin((value) => clampNumber(value - 5, 5, 45))}
              onIncrease={() => setLongBreakMin((value) => clampNumber(value + 5, 5, 45))}
            />
            <StepperRow
              label="Rounds"
              value={rounds}
              suffix=""
              onDecrease={() => setRounds((value) => clampNumber(value - 1, 1, 8))}
              onIncrease={() => setRounds((value) => clampNumber(value + 1, 1, 8))}
            />
          </GlassCard>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Linked habit</Text>
            <Text style={styles.sectionMeta}>Required for save + XP</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.habitChipRow}>
            {habits.map((habit) => {
              const selected = linkedHabitId === habit.id;
              return (
                <Pressable
                  key={habit.id}
                  onPress={() => handleChooseHabit(habit)}
                  style={[styles.habitChip, selected && styles.habitChipSelected]}
                >
                  <View style={[styles.habitDot, { backgroundColor: habit.color ?? HB_ACCENT_LIGHT }]} />
                  <Text style={[styles.habitChipText, selected && styles.habitChipTextSelected]}>
                    {habit.name}
                  </Text>
                </Pressable>
              );
            })}
            {habits.length === 0 ? (
              <Pressable style={styles.habitChip} onPress={() => router.push('/(habits)/add-habit')}>
                <MaterialSymbol name="add" size={16} color={HB_ACCENT_LIGHT} />
                <Text style={styles.habitChipText}>Create habit</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={styles.timerWrap}>
            <View style={styles.timerGlow} />
            <View style={styles.phaseBadge}>
              <Text style={styles.phaseBadgeText}>{phaseLabel}</Text>
            </View>
            <Svg width={304} height={304} style={styles.timerSvg}>
              <Circle
                cx="152"
                cy="152"
                r={TIMER_RADIUS}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
                fill="transparent"
              />
              <Circle
                cx="152"
                cy="152"
                r={TIMER_RADIUS}
                stroke={HB_ACCENT_LIGHT}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${TIMER_CIRCUMFERENCE} ${TIMER_CIRCUMFERENCE}`}
                strokeDashoffset={dashOffset}
                fill="transparent"
                rotation={-90}
                origin="152,152"
              />
            </Svg>
            <View style={styles.timerCenter}>
              <Text style={styles.timerText}>{displayTime}</Text>
              <Text style={styles.timerLabel}>Remaining</Text>
              <Text style={styles.timerRound}>
                Round {pomState?.round ?? 1} of {pomState?.roundsTarget ?? rounds}
              </Text>
              {taskLabel.trim().length > 0 ? (
                <Text style={styles.timerTask} numberOfLines={2}>
                  {taskLabel.trim()}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.controls}>
            {screenState !== 'running' ? (
              <Pressable onPress={handleStart} disabled={isStarting || habits.length === 0} style={styles.primaryButtonWrap}>
                <LinearGradient
                  colors={[
                    isStarting || habits.length === 0 ? '#4F4763' : HB_CTA_GRADIENT.from,
                    isStarting || habits.length === 0 ? '#4F4763' : HB_CTA_GRADIENT.to,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <MaterialSymbol name="play_arrow" size={20} color="#130F1D" filled />
                  <Text style={styles.primaryButtonText}>
                    {isStarting ? 'Starting…' : 'Start Focus'}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={handleReset} style={styles.secondaryButton}>
                  <MaterialSymbol name="refresh" size={18} color={HB_TEXT} />
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </Pressable>
                <Pressable onPress={handlePauseResume} style={styles.primaryButtonWrap}>
                  <LinearGradient
                    colors={[HB_CTA_GRADIENT.from, HB_CTA_GRADIENT.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryButton}
                  >
                    <MaterialSymbol
                      name={pomState?.isPaused ? 'play_arrow' : 'pause'}
                      size={20}
                      color="#130F1D"
                      filled
                    />
                    <Text style={styles.primaryButtonText}>
                      {pomState?.isPaused ? 'Resume' : 'Pause'}
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={handleSkip} style={styles.secondaryButton}>
                  <MaterialSymbol name="skip_next" size={18} color={HB_ACCENT_LIGHT} />
                  <Text style={[styles.secondaryButtonText, styles.secondaryButtonTextAccent]}>Skip</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Session stats</Text>
            <Text style={styles.sectionMeta}>Live from saved focus sessions</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard label="Focused today" value={formatCompactDuration(todayFocusedSeconds)} icon="timer" />
            <StatCard label="Completed today" value={String(todaySessions.filter((session) => session.status === 'completed').length)} icon="task_alt" />
            <StatCard label="Current streak" value={`${currentStreakDays}d`} icon="local_fire_department" />
          </View>
        </ScrollView>
      </View>

      <Modal visible={screenState === 'complete'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard level={3} style={styles.completeModal}>
            <View style={styles.completeIcon}>
              <MaterialSymbol name="bolt" size={24} color="#130F1D" filled />
            </View>
            <Text style={styles.completeTitle}>Session complete</Text>
            <Text style={styles.completeSubtitle}>
              {pomState != null
                ? `${formatCompactDuration(Math.round(pomState.totalFocusMs / 1000))} logged across ${pomState.round} rounds.`
                : 'Your focus session has been saved.'}
            </Text>

            <View style={styles.completeStats}>
              <View style={styles.completePill}>
                <Text style={styles.completePillLabel}>XP</Text>
                <Text style={styles.completePillValue}>{xpAwarded}</Text>
              </View>
              <View style={styles.completePill}>
                <Text style={styles.completePillLabel}>Break</Text>
                <Text style={styles.completePillValue}>
                  {pomState != null ? formatCompactDuration(Math.round(pomState.totalBreakMs / 1000)) : '0m'}
                </Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              {[
                ['drifted', 'Drifted'],
                ['solid', 'Solid'],
                ['locked-in', 'Locked in'],
              ].map(([value, label]) => {
                const selected = sessionRating === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setSessionRating(value as SessionRating)}
                    style={[styles.ratingChip, selected && styles.ratingChipSelected]}
                  >
                    <Text style={[styles.ratingChipText, selected && styles.ratingChipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.completeActions}>
              <Pressable
                onPress={() => {
                  resetState();
                  router.back();
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Done</Text>
              </Pressable>
              <Pressable onPress={resetState} style={styles.primaryButtonWrap}>
                <LinearGradient
                  colors={[HB_CTA_GRADIENT.from, HB_CTA_GRADIENT.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <MaterialSymbol name="replay" size={18} color="#130F1D" filled />
                  <Text style={styles.primaryButtonText}>Start another</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  container: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  headerTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  heroCopy: {
    gap: 6,
  },
  heroTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    color: HB_TEXT,
  },
  heroSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  taskCard: {
    borderRadius: 24,
  },
  cardLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
    marginBottom: 10,
  },
  taskInput: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: HB_FONTS.medium,
    fontSize: 16,
    color: HB_TEXT,
  },
  helperText: {
    marginTop: 10,
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  sectionMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  presetRow: {
    gap: 10,
    paddingRight: 20,
  },
  presetChip: {
    minWidth: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipSelected: {
    backgroundColor: HB_ACCENT,
    shadowColor: HB_ACCENT_GLOW,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  presetText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  presetTextSelected: {
    color: '#130F1D',
  },
  settingsCard: {
    borderRadius: 24,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  stepValue: {
    marginTop: 2,
    fontFamily: HB_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: HB_TEXT,
  },
  stepControls: {
    flexDirection: 'row',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: HB_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitChipRow: {
    gap: 10,
    paddingRight: 20,
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
  },
  habitChipSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  habitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  habitChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  habitChipTextSelected: {
    color: HB_TEXT,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  timerGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: HB_ACCENT,
    opacity: 0.12,
    shadowColor: HB_ACCENT,
    shadowOpacity: 0.32,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
  },
  phaseBadge: {
    position: 'absolute',
    top: 8,
    zIndex: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  phaseBadgeText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  timerSvg: {
    transform: [{ scale: 1.02 }],
  },
  timerCenter: {
    position: 'absolute',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
  },
  timerText: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 58,
    lineHeight: 62,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    color: HB_TEXT,
  },
  timerLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  timerRound: {
    marginTop: 6,
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  timerTask: {
    marginTop: 6,
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: HB_ACCENT_LIGHT,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonWrap: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: '#130F1D',
  },
  secondaryButton: {
    minHeight: 56,
    minWidth: 92,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    color: HB_TEXT,
  },
  secondaryButtonTextAccent: {
    color: HB_ACCENT_LIGHT,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    minHeight: 118,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  statLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  completeModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    alignItems: 'center',
    gap: 16,
  },
  completeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_ACCENT_LIGHT,
  },
  completeTitle: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: HB_TEXT,
  },
  completeSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: HB_TEXT_SECONDARY,
  },
  completeStats: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  completePill: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
    gap: 2,
  },
  completePillLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  completePillValue: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  ratingChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.low,
    alignItems: 'center',
  },
  ratingChipSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  ratingChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
    color: HB_TEXT_SECONDARY,
  },
  ratingChipTextSelected: {
    color: HB_ACCENT_LIGHT,
  },
  completeActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
});
