import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text as RNText,
} from 'react-native';
import { Clock, X, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import {
  type BreathingPattern,
  getBreathingCycleSteps,
  getCyclesForDuration,
  createBreathingSession,
  getPet,
  updatePetStats,
  createPetActivity,
  getPetActivitiesToday,
  feedPet,
  type BreathingStep,
  GlassCard,
  SectionHeader,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
  MOOD_SCORE_COLORS,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// -- Exercise metadata for the redesigned card layout --

interface ExerciseMeta {
  pattern: BreathingPattern;
  description: string;
  badge?: string;
  durationSeconds: number;
}

const EXERCISES: ExerciseMeta[] = [
  {
    pattern: 'box',
    description: '4-4-4-4 rhythm for focused calm',
    badge: 'BALANCE',
    durationSeconds: 300,
  },
  {
    pattern: '478',
    description: 'Natural tranquilizer for the system',
    badge: 'RELAXATION',
    durationSeconds: 420,
  },
  {
    pattern: 'relaxing',
    description: 'Soothe the nervous system instantly',
    durationSeconds: 180,
  },
  {
    pattern: 'energizing',
    description: 'Bellows breath to boost morning energy',
    badge: 'WAKE UP',
    durationSeconds: 120,
  },
  {
    pattern: 'sleep',
    description: 'Gentle pacing for deep restoration',
    durationSeconds: 600,
  },
];

const DISPLAY_NAMES: Record<BreathingPattern, string> = {
  box: 'Box Breathing',
  '478': '4-7-8 Breathing',
  relaxing: 'Relaxing Breath',
  energizing: 'Energizing Breath',
  sleep: 'Sleep Prep',
};

const PHASE_LABELS: Record<string, string> = {
  inhale: 'Inhale',
  hold: 'Hold',
  exhale: 'Exhale',
  hold2: 'Hold',
};

type ScreenState = 'browsing' | 'pre-mood' | 'running' | 'post-mood' | 'complete';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// -- Mood Slider --

function MoodSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={sliderStyles.row}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = n === value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[
              sliderStyles.dot,
              active && sliderStyles.dotActive,
            ]}
          >
            <RNText
              style={[
                sliderStyles.dotText,
                active && sliderStyles.dotTextActive,
              ]}
            >
              {n}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: MOOD_ACCENT,
  },
  dotText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  dotTextActive: {
    color: '#1a1008',
  },
});

// -- Breathing Circle Component --

function BreathingCircle({
  scaleAnim,
  ringOpacity,
  phase,
  countdown,
}: {
  scaleAnim: Animated.Value;
  ringOpacity: Animated.Value;
  phase: string;
  countdown: number;
}) {
  return (
    <View style={circleStyles.container}>
      {/* Outermost glow ring */}
      <Animated.View
        style={[
          circleStyles.glowRing,
          { opacity: ringOpacity, transform: [{ scale: scaleAnim }] },
        ]}
      />
      {/* Outer ring */}
      <Animated.View
        style={[
          circleStyles.outerRing,
          { opacity: ringOpacity, transform: [{ scale: scaleAnim }] },
        ]}
      />
      {/* Middle ring */}
      <Animated.View
        style={[
          circleStyles.middleRing,
          { transform: [{ scale: scaleAnim }] },
        ]}
      />
      {/* Inner filled circle */}
      <View style={circleStyles.innerCircle}>
        <RNText style={circleStyles.phaseLabel}>{phase}</RNText>
        <RNText style={circleStyles.countdownLabel}>
          {countdown > 0 ? `${countdown} SECOND${countdown !== 1 ? 'S' : ''}` : ''}
        </RNText>
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 220;

const circleStyles = StyleSheet.create({
  container: {
    width: CIRCLE_SIZE + 40,
    height: CIRCLE_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 40,
    height: CIRCLE_SIZE + 40,
    borderRadius: (CIRCLE_SIZE + 40) / 2,
    borderWidth: 1,
    borderColor: `${MOOD_ACCENT}15`,
  },
  outerRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 16,
    height: CIRCLE_SIZE + 16,
    borderRadius: (CIRCLE_SIZE + 16) / 2,
    borderWidth: 2,
    borderColor: `${MOOD_ACCENT}30`,
  },
  middleRing: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: `${MOOD_ACCENT}10`,
    borderWidth: 1.5,
    borderColor: `${MOOD_ACCENT}35`,
  },
  innerCircle: {
    width: CIRCLE_SIZE - 50,
    height: CIRCLE_SIZE - 50,
    borderRadius: (CIRCLE_SIZE - 50) / 2,
    backgroundColor: `${MOOD_ACCENT}20`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  phaseLabel: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 26,
    lineHeight: 34,
    color: MOOD_ACCENT_LIGHT,
  },
  countdownLabel: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05 * 11,
    textTransform: 'uppercase',
    color: `${MOOD_ACCENT_LIGHT}90`,
  },
});

// -- Main Screen --

export default function BreathingScreen() {
  const db = useDatabase();

  const [screenState, setScreenState] = useState<ScreenState>('browsing');
  const [activeExercise, setActiveExercise] = useState<ExerciseMeta | null>(null);
  const [currentPhase, setCurrentPhase] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [preMood, setPreMood] = useState(5);
  const [postMood, setPostMood] = useState(5);
  const [isPaused, setIsPaused] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0.3)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const currentScaleRef = useRef(0.5);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const pausedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  // Subtle ambient pulse during active session
  useEffect(() => {
    if (screenState !== 'running') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [screenState, pulseAnim]);

  const animatePhase = useCallback(
    (phase: string, duration: number) => {
      const toValue = phase === 'inhale' ? 1.0 : phase === 'exhale' ? 0.5 : currentScaleRef.current;
      const ringTarget = phase === 'inhale' ? 0.6 : phase === 'exhale' ? 0.2 : 0.4;
      currentScaleRef.current = toValue;
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue,
          duration: duration * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: ringTarget,
          duration: duration * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [scaleAnim, ringOpacity],
  );

  const runCycle = useCallback(
    (cycleSteps: BreathingStep[], onComplete: () => void) => {
      let stepIndex = 0;

      const nextStep = () => {
        if (pausedRef.current) {
          timerRef.current = setTimeout(nextStep, 200);
          return;
        }
        if (stepIndex >= cycleSteps.length) {
          onComplete();
          return;
        }
        const step = cycleSteps[stepIndex];
        setCurrentPhase(PHASE_LABELS[step.phase] ?? step.phase);
        setCountdown(step.durationSeconds);
        animatePhase(step.phase, step.durationSeconds);

        // Countdown ticker for this step
        let remaining = step.durationSeconds;
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          if (pausedRef.current) return;
          remaining--;
          setCountdown(Math.max(0, remaining));
        }, 1000);

        stepIndex++;
        timerRef.current = setTimeout(() => {
          if (countdownRef.current) clearInterval(countdownRef.current);
          nextStep();
        }, step.durationSeconds * 1000);
      };

      nextStep();
    },
    [animatePhase],
  );

  const finishSession = useCallback(
    (pattern: BreathingPattern, cycles: number) => {
      clearTimers();
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (duration > 5) {
        createBreathingSession(db, uuid(), { pattern, durationSeconds: duration, cyclesCompleted: cycles });
        try {
          const pet = getPet(db);
          if (pet) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const feedCount = getPetActivitiesToday(db, 'breathing', todayStr);
            const result = feedPet(pet, 'breathing', feedCount);
            if (!result.dailyLimitReached) {
              updatePetStats(db, result.newHappiness, result.newExperience, result.newEvolutionStage, pet.totalFeeds + 1);
              createPetActivity(db, uuid(), 'breathing', result.happinessDelta, result.experienceDelta, 'mood');
            }
          }
        } catch {
          // Never block session on pet errors
        }
      }
      setScreenState('post-mood');
    },
    [db, clearTimers],
  );

  const startSession = useCallback(() => {
    if (!activeExercise) return;
    const { pattern, durationSeconds } = activeExercise;
    setScreenState('running');
    setCyclesCompleted(0);
    setElapsedSeconds(0);
    setIsPaused(false);
    pausedRef.current = false;
    scaleAnim.setValue(0.5);
    ringOpacity.setValue(0.3);
    currentScaleRef.current = 0.5;
    startTimeRef.current = Date.now();

    // Elapsed time ticker
    elapsedRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);

    const steps = getBreathingCycleSteps(pattern);
    const totalCycles = getCyclesForDuration(pattern, durationSeconds);
    let currentCycle = 0;

    const runNextCycle = () => {
      if (currentCycle >= totalCycles) {
        finishSession(pattern, currentCycle);
        return;
      }
      runCycle(steps, () => {
        currentCycle++;
        setCyclesCompleted(currentCycle);
        runNextCycle();
      });
    };

    runNextCycle();
  }, [activeExercise, runCycle, finishSession, scaleAnim, ringOpacity]);

  const stopSession = useCallback(() => {
    if (!activeExercise) return;
    clearTimers();
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (duration > 5) {
      createBreathingSession(db, uuid(), {
        pattern: activeExercise.pattern,
        durationSeconds: duration,
        cyclesCompleted,
      });
    }
    setScreenState('browsing');
    setActiveExercise(null);
  }, [activeExercise, db, cyclesCompleted, clearTimers]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // -- Pre-mood check --
  if (screenState === 'pre-mood' && activeExercise) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <GlassCard level={2} style={styles.moodCard}>
            <RNText style={styles.moodTitle}>How do you feel right now?</RNText>
            <RNText style={styles.moodSubtitle}>Rate your current state before breathing</RNText>
            <View style={styles.moodSliderWrap}>
              <MoodSlider value={preMood} onChange={setPreMood} />
            </View>
            <View style={styles.moodRow}>
              <GradientButton
                title="Begin Session"
                onPress={startSession}
              />
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  // -- Active session (hero animation) --
  if (screenState === 'running' && activeExercise) {
    const totalCycles = getCyclesForDuration(activeExercise.pattern, activeExercise.durationSeconds);

    return (
      <View style={styles.sessionScreen}>
        {/* Close button - top right */}
        <View style={styles.sessionHeader}>
          <View style={styles.sessionHeaderSpacer} />
          <Pressable onPress={stopSession} style={styles.closeBtn}>
            <X size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Breathing circle - centered hero */}
        <View style={styles.circleHero}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <BreathingCircle
              scaleAnim={scaleAnim}
              ringOpacity={ringOpacity}
              phase={currentPhase}
              countdown={countdown}
            />
          </Animated.View>
        </View>

        {/* Session info below circle */}
        <View style={styles.sessionInfo}>
          <RNText style={styles.sessionPatternName}>
            {DISPLAY_NAMES[activeExercise.pattern].toUpperCase()} SESSION
          </RNText>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <RNText style={styles.statLabel}>ELAPSED</RNText>
              <RNText style={styles.statValue}>{formatElapsed(elapsedSeconds)}</RNText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <RNText style={styles.statLabel}>CYCLES</RNText>
              <RNText style={styles.statValue}>{cyclesCompleted}/{totalCycles}</RNText>
            </View>
          </View>
        </View>

        {/* Playback controls */}
        <View style={styles.controlBar}>
          <Pressable style={styles.controlBtnSmall}>
            <SkipBack size={20} color={`${colors.text}80`} strokeWidth={2} />
          </Pressable>
          <Pressable onPress={togglePause} style={styles.controlBtnPrimary}>
            {isPaused ? (
              <Play size={28} color="#1a1008" strokeWidth={2.5} />
            ) : (
              <Pause size={28} color="#1a1008" strokeWidth={2.5} />
            )}
          </Pressable>
          <Pressable style={styles.controlBtnSmall}>
            <SkipForward size={20} color={`${colors.text}80`} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Pause overlay label */}
        {isPaused && (
          <View style={styles.pausedOverlay}>
            <RNText style={styles.pausedText}>PAUSED</RNText>
          </View>
        )}
      </View>
    );
  }

  // -- Post-mood check --
  if (screenState === 'post-mood') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <GlassCard level={2} style={styles.moodCard}>
            <RNText style={styles.moodTitle}>How do you feel now?</RNText>
            <RNText style={styles.moodSubtitle}>Rate your state after the session</RNText>
            <View style={styles.moodSliderWrap}>
              <MoodSlider value={postMood} onChange={setPostMood} />
            </View>
            <View style={styles.moodRow}>
              <GradientButton
                title="See Results"
                onPress={() => setScreenState('complete')}
              />
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  // -- Completion summary --
  if (screenState === 'complete') {
    const diff = postMood - preMood;
    const improved = diff > 0;
    const same = diff === 0;
    const preColor = MOOD_SCORE_COLORS[preMood as keyof typeof MOOD_SCORE_COLORS] ?? colors.text;
    const postColor = MOOD_SCORE_COLORS[postMood as keyof typeof MOOD_SCORE_COLORS] ?? colors.text;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <GlassCard level={1} style={styles.completeCard}>
            {/* Header */}
            <RNText style={styles.completeTitle}>Session Complete</RNText>
            <RNText style={styles.completeWellDone}>
              {improved ? 'Well done! Your mood improved.' : same ? 'Steady state maintained.' : 'Take it easy, you\'ve got this.'}
            </RNText>

            {/* Score comparison */}
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <RNText style={styles.comparisonLabel}>BEFORE</RNText>
                <RNText style={[styles.comparisonScore, { color: preColor }]}>{preMood}</RNText>
              </View>
              <View style={styles.comparisonArrowWrap}>
                <RNText style={styles.comparisonArrow}>{'\u2192'}</RNText>
              </View>
              <View style={styles.comparisonItem}>
                <RNText style={styles.comparisonLabel}>AFTER</RNText>
                <RNText style={[styles.comparisonScore, { color: postColor }]}>{postMood}</RNText>
              </View>
            </View>

            {/* Mood change badge */}
            <View style={[styles.changeBadge, improved && styles.changeBadgePositive]}>
              <RNText style={[styles.changeBadgeText, improved && styles.changeBadgeTextPositive]}>
                {improved ? `+${diff} points` : same ? 'No change' : `${diff} points`}
              </RNText>
            </View>

            {/* Save button */}
            <View style={styles.completeButtonRow}>
              <GradientButton
                title="Save & Close"
                onPress={() => {
                  setScreenState('browsing');
                  setActiveExercise(null);
                  setPreMood(5);
                  setPostMood(5);
                  setElapsedSeconds(0);
                }}
              />
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  // -- Default: exercise browser --
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <RNText style={styles.pageTitle}>Breathing Sanctuary</RNText>
        <RNText style={styles.pageSubtitle}>
          Regulate your nervous system through intentional rhythm. Choose a pattern that fits your current state.
        </RNText>

        <SectionHeader title="Available Exercises" />

        {EXERCISES.map((ex) => (
          <GlassCard key={ex.pattern} level={2} style={styles.exerciseCard}>
            <View style={styles.exerciseTop}>
              <View style={styles.exerciseInfo}>
                <View style={styles.exerciseNameRow}>
                  <RNText style={styles.exerciseName}>
                    {DISPLAY_NAMES[ex.pattern]}
                  </RNText>
                  {ex.badge && (
                    <View style={styles.badge}>
                      <RNText style={styles.badgeText}>{ex.badge}</RNText>
                    </View>
                  )}
                </View>
                <RNText style={styles.exerciseDesc}>{ex.description}</RNText>
                <View style={styles.durationRow}>
                  <Clock size={12} color={MOOD_ACCENT_LIGHT} strokeWidth={2} />
                  <RNText style={styles.durationText}>
                    {formatDuration(ex.durationSeconds)}
                  </RNText>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setActiveExercise(ex);
                  setScreenState('pre-mood');
                }}
                style={styles.startBtn}
              >
                <RNText style={styles.startBtnText}>Start</RNText>
              </Pressable>
            </View>
          </GlassCard>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.base,
  },
  sessionScreen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 12,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 80,
  },

  // Page header
  pageTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
    lineHeight: 40,
  },
  pageSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginBottom: 8,
  },

  // -- Active Session Layout --
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sessionHeaderSpacer: {
    flex: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MOOD_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },

  circleHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sessionInfo: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
  },
  sessionPatternName: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.05 * 12,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.05 * 10,
    textTransform: 'uppercase',
    color: `${colors.textSecondary}80`,
  },
  statValue: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: `${colors.textSecondary}30`,
  },

  // Playback controls
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 48,
    paddingTop: 16,
  },
  controlBtnSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOOD_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pausedOverlay: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
  },
  pausedText: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1 * 14,
    textTransform: 'uppercase',
    color: MOOD_ACCENT_LIGHT,
  },

  // Exercise cards
  exerciseCard: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  exerciseTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    gap: 4,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exerciseName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: `${MOOD_ACCENT}20`,
  },
  badgeText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.05 * 9,
    color: MOOD_ACCENT,
  },
  exerciseDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  durationText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    lineHeight: 18,
    color: MOOD_ACCENT_LIGHT,
  },
  startBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MOOD_ACCENT,
    marginLeft: 12,
  },
  startBtnText: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#1a1008',
  },

  // Mood check
  moodCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 16,
  },
  moodTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  moodSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  moodSliderWrap: {
    width: '100%',
    paddingHorizontal: 4,
    marginVertical: 8,
  },
  moodRow: {
    marginTop: 8,
  },

  // Completion
  completeCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 20,
  },
  completeTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 28,
    lineHeight: 36,
    color: colors.text,
    textAlign: 'center',
  },
  completeWellDone: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 22,
    color: MOOD_ACCENT_LIGHT,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    marginVertical: 4,
  },
  comparisonItem: {
    alignItems: 'center',
    gap: 6,
  },
  comparisonLabel: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.05 * 11,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  comparisonScore: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text,
  },
  comparisonArrowWrap: {
    paddingTop: 16,
  },
  comparisonArrow: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 24,
    lineHeight: 32,
    color: `${colors.textSecondary}60`,
  },
  changeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.focus,
  },
  changeBadgePositive: {
    backgroundColor: `${MOOD_SCORE_COLORS[9]}20`,
  },
  changeBadgeText: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  changeBadgeTextPositive: {
    color: MOOD_SCORE_COLORS[9],
  },
  completeButtonRow: {
    marginTop: 4,
  },

  bottomSpacer: {
    height: 20,
  },
});
