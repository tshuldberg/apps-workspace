import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text as RNText,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Volume2, Pause, Play, MoreVertical } from 'lucide-react-native';
import {
  getMeditationTemplateById,
  createMeditationSession,
  completeMeditationSession,
  createTimerState,
  tickTimer,
  getStepProgress,
  getTotalProgress,
  getCurrentStep,
  getRemainingTime,
  getCompletedStepCount,
  getPet,
  updatePetStats,
  createPetActivity,
  getPetActivitiesToday,
  feedPet,
  type MeditationTemplate,
  type MeditationStep,
  type TimerState,
  GlassCard,
  GradientButton,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
  MOOD_SCORE_COLORS,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type Phase = 'pre' | 'active' | 'post';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs) % 60;
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
            style={[sliderStyles.dot, active && sliderStyles.dotActive]}
          >
            <RNText
              style={[sliderStyles.dotText, active && sliderStyles.dotTextActive]}
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
    letterSpacing: 0,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dotTextActive: {
    color: '#1a1008',
  },
});

// -- Main Screen --

export default function MeditationSessionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId: string }>();

  const [template, setTemplate] = useState<MeditationTemplate | null>(null);
  const [phase, setPhase] = useState<Phase>('pre');
  const [preMood, setPreMood] = useState(5);
  const [postMood, setPostMood] = useState(5);
  const [timerState, setTimerState] = useState<TimerState>(createTimerState());
  const [sessionId] = useState(() => uuid());
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const stepsRef = useRef<MeditationStep[]>([]);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (templateId) {
      const t = getMeditationTemplateById(db, templateId);
      if (t) {
        setTemplate(t);
        stepsRef.current = t.steps;
      }
    }
  }, [db, templateId]);

  // Pulse animation for the orb
  useEffect(() => {
    if (phase !== 'active' || isPaused) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [phase, isPaused, pulseAnim]);

  const startSession = useCallback(() => {
    if (!template) return;
    createMeditationSession(db, sessionId, {
      templateId: template.id,
      templateName: template.name,
      durationSeconds: template.durationSeconds,
      totalSteps: template.steps.length,
      preMoodScore: preMood,
    });
    setTimerState(createTimerState());
    setPhase('active');
    setIsPaused(false);
    pausedRef.current = false;

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setTimerState((prev) => {
        const next = tickTimer(prev, stepsRef.current, 1);
        if (next.isComplete) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase('post');
        }
        return next;
      });
    }, 1000);
  }, [db, sessionId, template, preMood]);

  const stopEarly = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase('post');
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  const finishSession = useCallback(() => {
    completeMeditationSession(db, sessionId, {
      stepsCompleted: getCompletedStepCount(timerState, stepsRef.current),
      postMoodScore: postMood,
    });

    // Pet feeding
    try {
      const pet = getPet(db);
      if (pet) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const feedCount = getPetActivitiesToday(db, 'meditation', todayStr);
        const result = feedPet(pet, 'meditation', feedCount);
        if (!result.dailyLimitReached) {
          updatePetStats(db, result.newHappiness, result.newExperience, result.newEvolutionStage, pet.totalFeeds + 1);
          createPetActivity(db, uuid(), 'meditation', result.happinessDelta, result.experienceDelta, 'mood');
        }
      }
    } catch {
      // Never block session on pet errors
    }

    router.back();
  }, [db, sessionId, timerState, postMood, router]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    const progress = getTotalProgress(timerState, stepsRef.current);
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [timerState, progressAnim]);

  if (!template) {
    return (
      <View style={styles.centered}>
        <RNText style={styles.loadingText}>Loading template...</RNText>
      </View>
    );
  }

  // -- Pre-session --
  if (phase === 'pre') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.preContent}>
          {/* Template info */}
          <GlassCard level={2} style={styles.preInfoCard}>
            <RNText style={styles.preLabel}>GUIDED MEDITATION</RNText>
            <RNText style={styles.preTitle}>{template.name}</RNText>
            <RNText style={styles.preDesc}>{template.description}</RNText>

            {/* Duration + Steps row */}
            <View style={styles.preMetaRow}>
              <View style={styles.preMetaItem}>
                <RNText style={styles.preMetaValue}>
                  {Math.floor(template.durationSeconds / 60)}
                </RNText>
                <RNText style={styles.preMetaLabel}>MINUTES</RNText>
              </View>
              <View style={styles.preMetaDivider} />
              <View style={styles.preMetaItem}>
                <RNText style={styles.preMetaValue}>{template.steps.length}</RNText>
                <RNText style={styles.preMetaLabel}>STEPS</RNText>
              </View>
            </View>
          </GlassCard>

          {/* Step preview */}
          <GlassCard level={1} style={styles.preStepsCard}>
            <RNText style={styles.preStepsTitle}>Session Steps</RNText>
            {template.steps.map((step, i) => (
              <View key={i} style={styles.preStepRow}>
                <View style={styles.preStepDot} />
                <RNText style={styles.preStepText}>{step.instruction}</RNText>
              </View>
            ))}
          </GlassCard>

          {/* Pre-mood */}
          <GlassCard level={2} style={styles.preMoodCard}>
            <RNText style={styles.preMoodTitle}>How do you feel right now?</RNText>
            <RNText style={styles.preMoodSubtitle}>Rate your current state</RNText>
            <View style={styles.moodSliderWrap}>
              <MoodSlider value={preMood} onChange={setPreMood} />
            </View>
          </GlassCard>

          <GradientButton title="Begin Session" onPress={startSession} />
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    );
  }

  // -- Active session (immersive) --
  if (phase === 'active') {
    const currentStep = getCurrentStep(timerState, template.steps);
    const elapsed = Math.round(timerState.totalElapsed);
    const completedSteps = getCompletedStepCount(timerState, template.steps);
    const totalProgress = getTotalProgress(timerState, template.steps);

    return (
      <View style={styles.sessionScreen}>
        {/* Top bar */}
        <View style={styles.sessionTopBar}>
          <Pressable onPress={stopEarly} hitSlop={12}>
            <X size={22} color={colors.text} strokeWidth={2} />
          </Pressable>
          <RNText style={styles.sessionTimer}>
            {formatTime(elapsed)} / {formatTime(template.durationSeconds)}
          </RNText>
          <Pressable hitSlop={12}>
            <MoreVertical size={20} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Session type label */}
        <RNText style={styles.sessionTypeLabel}>
          {template.name.toUpperCase()} SESSION
        </RNText>

        {/* Step dots */}
        <View style={styles.stepDotsRow}>
          {template.steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i < completedSteps && styles.stepDotCompleted,
                i === completedSteps && styles.stepDotCurrent,
              ]}
            />
          ))}
        </View>

        {/* Centered orb + instruction */}
        <View style={styles.sessionCenter}>
          <View style={styles.orbContainer}>
            <Animated.View
              style={[
                styles.orbOuter,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.orbInner} />
          </View>

          <RNText style={styles.sessionInstruction}>
            {currentStep?.instruction ?? 'Completing...'}
          </RNText>

          {currentStep && (
            <RNText style={styles.sessionSubInstruction}>
              Exhale slowly through the mouth
            </RNText>
          )}
        </View>

        {/* Progress + vitals row */}
        <View style={styles.sessionStatsRow}>
          <View style={styles.sessionStatItem}>
            <RNText style={styles.sessionStatLabel}>PROGRESS</RNText>
            <RNText style={styles.sessionStatValue}>
              {completedSteps > 0
                ? `Before ${preMood}`
                : `Step ${completedSteps + 1}`}
            </RNText>
          </View>
          <View style={styles.sessionStatItem}>
            <RNText style={styles.sessionStatLabel}>PROGRESS</RNText>
            <RNText style={[styles.sessionStatValue, { color: MOOD_ACCENT }]}>
              {Math.round(totalProgress * 100)}%
            </RNText>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.sessionProgressBar}>
          <Animated.View
            style={[
              styles.sessionProgressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Bottom controls */}
        <View style={styles.sessionControls}>
          <Pressable
            onPress={() => setSoundEnabled(!soundEnabled)}
            style={styles.sessionSideBtn}
          >
            <Volume2
              size={20}
              color={soundEnabled ? MOOD_ACCENT_LIGHT : colors.textSecondary}
              strokeWidth={2}
            />
            <RNText style={styles.sessionSideBtnLabel}>
              {soundEnabled ? 'RAIN' : 'MUTED'}
            </RNText>
          </Pressable>

          <Pressable onPress={togglePause} style={styles.sessionPauseBtn}>
            {isPaused ? (
              <Play size={28} color="#1a1008" fill="#1a1008" strokeWidth={0} />
            ) : (
              <Pause size={28} color="#1a1008" strokeWidth={2.5} />
            )}
          </Pressable>

          <Pressable style={styles.sessionSideBtn}>
            <RNText style={styles.sessionSideBtnIcon}>4-7-8</RNText>
          </Pressable>
        </View>
      </View>
    );
  }

  // -- Post-session --
  const completedSteps = getCompletedStepCount(timerState, template.steps);
  const totalDuration = Math.round(timerState.totalElapsed);
  const isFullComplete = completedSteps === template.steps.length;
  const moodImproved = postMood > preMood;
  const moodSame = postMood === preMood;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.centeredContent}>
        <GlassCard level={2} style={styles.postCard}>
          {/* Completion header */}
          <RNText style={styles.postEmoji}>
            {isFullComplete ? '\u{2728}' : '\u{1F64F}'}
          </RNText>
          <RNText style={styles.postTitle}>
            {isFullComplete ? 'Session Complete' : 'Session Ended'}
          </RNText>
          <RNText style={styles.postSubtitle}>
            {isFullComplete
              ? 'Well done. You practiced mindfulness today.'
              : `You completed ${completedSteps} of ${template.steps.length} steps.`}
          </RNText>

          {/* Summary stats */}
          <View style={styles.postStatsRow}>
            <View style={styles.postStatItem}>
              <RNText style={styles.postStatValue}>{formatTime(totalDuration)}</RNText>
              <RNText style={styles.postStatLabel}>DURATION</RNText>
            </View>
            <View style={styles.postStatDivider} />
            <View style={styles.postStatItem}>
              <RNText style={styles.postStatValue}>
                {completedSteps}/{template.steps.length}
              </RNText>
              <RNText style={styles.postStatLabel}>STEPS</RNText>
            </View>
          </View>

          {/* Post mood */}
          <View style={styles.postMoodSection}>
            <RNText style={styles.postMoodTitle}>How do you feel now?</RNText>
            <View style={styles.moodSliderWrap}>
              <MoodSlider value={postMood} onChange={setPostMood} />
            </View>
          </View>

          {/* Mood comparison */}
          <View style={styles.moodCompareRow}>
            <View style={styles.moodCompareItem}>
              <RNText style={styles.moodCompareLabel}>Before</RNText>
              <RNText style={styles.moodCompareValue}>{preMood}</RNText>
            </View>
            <RNText style={styles.moodCompareArrow}>{'\u2192'}</RNText>
            <View style={styles.moodCompareItem}>
              <RNText style={styles.moodCompareLabel}>After</RNText>
              <RNText
                style={[
                  styles.moodCompareValue,
                  moodImproved && { color: MOOD_SCORE_COLORS[10] },
                ]}
              >
                {postMood}
              </RNText>
            </View>
          </View>

          <RNText style={styles.moodCompareNote}>
            {moodImproved
              ? `+${postMood - preMood} improvement`
              : moodSame
                ? 'Steady state maintained'
                : 'Take it easy, you got this'}
          </RNText>
        </GlassCard>

        <GradientButton title="Done" onPress={finishSession} />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },

  // Pre-session
  preContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
  },
  preInfoCard: {
    gap: 8,
  },
  preLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
    lineHeight: 14,
  },
  preTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 26,
    color: colors.text,
    lineHeight: 32,
  },
  preDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  preMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 8,
  },
  preMetaItem: {
    alignItems: 'center',
    gap: 2,
  },
  preMetaValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
    lineHeight: 30,
  },
  preMetaLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  preMetaDivider: {
    width: 1,
    height: 32,
    backgroundColor: MOOD_SURFACES.highest,
  },

  preStepsCard: {
    gap: 10,
  },
  preStepsTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  preStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  preStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MOOD_ACCENT,
    marginTop: 7,
  },
  preStepText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },

  preMoodCard: {
    gap: 8,
  },
  preMoodTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  preMoodSubtitle: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  moodSliderWrap: {
    marginTop: 8,
  },

  // Active session (immersive)
  sessionScreen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  sessionTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTimer: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 14,
    letterSpacing: 0.05 * 14,
    color: colors.text,
    lineHeight: 19,
  },
  sessionTypeLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: MOOD_ACCENT,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 15,
  },
  stepDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MOOD_SURFACES.focus,
  },
  stepDotCompleted: {
    backgroundColor: MOOD_ACCENT,
  },
  stepDotCurrent: {
    backgroundColor: MOOD_ACCENT_LIGHT,
    width: 20,
    borderRadius: 4,
  },
  sessionCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  orbContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${MOOD_ACCENT}15`,
    borderWidth: 1.5,
    borderColor: `${MOOD_ACCENT}30`,
  },
  orbInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: MOOD_ACCENT,
    opacity: 0.9,
  },
  sessionInstruction: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 34,
  },
  sessionSubInstruction: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Stats row
  sessionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  sessionStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  sessionStatLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  sessionStatValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },

  // Progress bar
  sessionProgressBar: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: MOOD_SURFACES.focus,
    overflow: 'hidden',
    marginBottom: 20,
  },
  sessionProgressFill: {
    height: '100%',
    backgroundColor: MOOD_ACCENT,
    borderRadius: 1.5,
  },

  // Controls
  sessionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionSideBtn: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  sessionSideBtnLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  sessionSideBtnIcon: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sessionPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Post-session
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 80,
    gap: 16,
  },
  postCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
  },
  postEmoji: {
    fontSize: 40,
  },
  postTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 24,
    color: colors.text,
    lineHeight: 30,
  },
  postSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  postStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginVertical: 8,
  },
  postStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  postStatValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: MOOD_ACCENT,
    lineHeight: 30,
  },
  postStatLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  postStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: MOOD_SURFACES.highest,
  },

  postMoodSection: {
    width: '100%',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  postMoodTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },

  moodCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  moodCompareItem: {
    alignItems: 'center',
    gap: 2,
  },
  moodCompareLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  moodCompareValue: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 28,
    color: colors.text,
    lineHeight: 34,
  },
  moodCompareArrow: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 20,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  moodCompareNote: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  bottomSpacer: {
    height: 40,
  },
});
