import { useState, useMemo, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import {
  CBT_EXERCISES,
  getExercisePrompts,
  getExerciseDefinition,
  getCbtEntries,
  createCbtEntry,
  getCbtStats,
  MEDITATION_TYPES,
  createMeditationSession,
  getMeditationSessions,
  getMeditationStats,
  type CbtExerciseType,
  type MeditationType,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  GradientButton,
  StatBadge,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

type ScreenMode = 'library' | 'cbt-exercise' | 'meditation-active';

const DIFFICULTY_MAP: Record<string, string> = {
  thought_record: 'Intermediate',
  behavioral_activation: 'Beginner',
  cognitive_restructuring: 'Intermediate',
  gratitude: 'Beginner',
  worry_time: 'Intermediate',
  values_clarification: 'Beginner',
};

const CBT_ICONS: Record<string, string> = {
  thought_record: '\u{1F4DD}',
  behavioral_activation: '\u{1F3AF}',
  cognitive_restructuring: '\u{1F9E0}',
  gratitude: '\u{1F64F}',
  worry_time: '\u{1F4AD}',
  values_clarification: '\u2728',
};

export default function CbtScreen() {
  const db = useDatabase();
  const [mode, setMode] = useState<ScreenMode>('library');
  const [activeTab, setActiveTab] = useState<'meditation' | 'cbt'>('cbt');

  // CBT exercise state
  const [activeExercise, setActiveExercise] = useState<CbtExerciseType | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [moodBefore, setMoodBefore] = useState<number | null>(null);

  // Meditation state
  const [activeMeditation, setActiveMeditation] = useState<MeditationType | null>(null);
  const [medElapsed, setMedElapsed] = useState(0);
  const [medPromptIdx, setMedPromptIdx] = useState(0);
  const medTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Data
  const cbtEntries = useMemo(() => {
    try { return getCbtEntries(db, 50); } catch { return []; }
  }, [db, mode]);
  const cbtStats = useMemo(() => getCbtStats(cbtEntries), [cbtEntries]);
  const medSessions = useMemo(() => {
    try { return getMeditationSessions(db, 50); } catch { return []; }
  }, [db, mode]);
  const medStats = useMemo(() => getMeditationStats(medSessions), [medSessions]);

  useEffect(() => {
    return () => { if (medTimerRef.current) clearInterval(medTimerRef.current); };
  }, []);

  // -- CBT helpers --
  const startCbtExercise = (type: CbtExerciseType) => {
    setActiveExercise(type);
    setStepIndex(0);
    setResponses([]);
    setCurrentResponse('');
    setMoodBefore(null);
    setMode('cbt-exercise');
  };

  const nextCbtStep = () => {
    if (!activeExercise) return;
    const prompts = getExercisePrompts(activeExercise);
    setResponses((prev) => [...prev, currentResponse]);

    if (stepIndex < prompts.length - 1) {
      setStepIndex((i) => i + 1);
      setCurrentResponse('');
    } else {
      const allResponses = [...responses, currentResponse].join('\n---\n');
      createCbtEntry(db, {
        exercise_type: activeExercise,
        prompt: prompts.join(' | '),
        response: allResponses,
        mood_before: moodBefore,
        mood_after: null,
        tags: null,
      });
      setMode('library');
      setActiveExercise(null);
    }
  };

  // -- Meditation helpers --
  const startMeditation = (type: MeditationType) => {
    setActiveMeditation(type);
    setMedElapsed(0);
    setMedPromptIdx(0);
    setMode('meditation-active');

    const def = MEDITATION_TYPES.find((m) => m.type === type);
    if (!def) return;
    const totalSec = def.defaultDurationSeconds;
    const promptCount = def.prompts.length;
    const interval = promptCount > 0 ? Math.floor(totalSec / promptCount) : totalSec;

    let sec = 0;
    medTimerRef.current = setInterval(() => {
      sec++;
      setMedElapsed(sec);
      if (promptCount > 0 && sec % interval === 0 && sec < totalSec) {
        setMedPromptIdx((i) => Math.min(i + 1, promptCount - 1));
      }
      if (sec >= totalSec) {
        if (medTimerRef.current) clearInterval(medTimerRef.current);
        medTimerRef.current = null;
        createMeditationSession(db, {
          meditation_type: type,
          duration_seconds: sec,
          completed: 1,
          mood_before: null,
          mood_after: null,
          notes: null,
        });
        setMode('library');
        setActiveMeditation(null);
      }
    }, 1000);
  };

  const stopMeditation = () => {
    if (medTimerRef.current) clearInterval(medTimerRef.current);
    medTimerRef.current = null;
    if (activeMeditation && medElapsed > 5) {
      createMeditationSession(db, {
        meditation_type: activeMeditation,
        duration_seconds: medElapsed,
        completed: 0,
        mood_before: null,
        mood_after: null,
        notes: null,
      });
    }
    setMode('library');
    setActiveMeditation(null);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // -- CBT Exercise Flow --
  if (mode === 'cbt-exercise' && activeExercise) {
    const prompts = getExercisePrompts(activeExercise);
    const def = getExerciseDefinition(activeExercise);
    const total = prompts.length;

    return (
      <View style={styles.fullScreen}>
        <SectionHeader label="GUIDED EXERCISE" title={def?.name ?? 'Exercise'} />

        {/* Mood before (first step only) */}
        {stepIndex === 0 && moodBefore === null && (
          <GlassCard level={2} style={styles.moodPickerCard}>
            <Text style={styles.moodPickerLabel}>How intense is this feeling? (1-10)</Text>
            <View style={styles.moodRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Pressable key={n} onPress={() => setMoodBefore(n)}>
                  <View style={[styles.moodNum, moodBefore === n && styles.moodNumActive]}>
                    <Text style={[styles.moodNumText, moodBefore === n && styles.moodNumTextActive]}>{n}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        )}

        {/* Progress */}
        <View style={styles.progressRow}>
          {prompts.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step {stepIndex + 1} of {total}</Text>

        {/* Prompt */}
        <GlassCard level={2} style={styles.promptCard}>
          <Text style={styles.promptText}>{prompts[stepIndex]}</Text>
          <TextInput
            style={styles.promptInput}
            placeholder="Your response..."
            placeholderTextColor={colors.textTertiary}
            value={currentResponse}
            onChangeText={setCurrentResponse}
            multiline
            textAlignVertical="top"
          />
        </GlassCard>

        <View style={styles.exerciseActions}>
          <GradientButton
            title={stepIndex < total - 1 ? 'Next Step' : 'Complete'}
            onPress={nextCbtStep}
            variant={currentResponse.trim().length > 0 ? 'primary' : 'secondary'}
          />
          <Pressable onPress={() => { setMode('library'); setActiveExercise(null); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // -- Meditation Active --
  if (mode === 'meditation-active' && activeMeditation) {
    const def = MEDITATION_TYPES.find((m) => m.type === activeMeditation);
    const prompts = def?.prompts ?? [];
    const currentPrompt = prompts[medPromptIdx] ?? '';
    const totalSec = def?.defaultDurationSeconds ?? 300;
    const progress = Math.min(medElapsed / totalSec, 1);

    return (
      <View style={styles.fullScreen}>
        <SectionHeader label="MEDITATION" title={def?.name ?? 'Session'} />

        <View style={styles.medCenter}>
          <Text style={styles.medTimer}>{formatTime(medElapsed)}</Text>
          <View style={styles.medProgressBar}>
            <View style={[styles.medProgressFill, { width: `${progress * 100}%` }]} />
          </View>
          {currentPrompt.length > 0 && (
            <GlassCard level={2} style={styles.medPromptCard}>
              <Text style={styles.medPromptText}>{currentPrompt}</Text>
            </GlassCard>
          )}
        </View>

        <Pressable style={styles.endBtn} onPress={stopMeditation}>
          <Text style={styles.endBtnText}>End Session</Text>
        </Pressable>
      </View>
    );
  }

  // -- Library view --
  const thisWeekCbt = cbtEntries.filter((e) => {
    const d = new Date(e.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 86400000;
  }).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.libraryContent}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'meditation' && styles.tabInactive]}
          onPress={() => setActiveTab('meditation')}
        >
          <Text style={[styles.tabText, activeTab === 'meditation' && styles.tabTextActive]}>Meditation</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'cbt' && styles.tabActive]}
          onPress={() => setActiveTab('cbt')}
        >
          <Text style={[styles.tabText, activeTab === 'cbt' && styles.tabTextActive]}>CBT</Text>
        </Pressable>
      </View>

      <SectionHeader
        label={activeTab === 'cbt' ? 'COGNITIVE BEHAVIORAL TOOLS' : undefined}
        title={activeTab === 'cbt' ? 'Perspective Shift' : 'Mindfulness'}
      />
      <Text style={styles.headerDesc}>
        {activeTab === 'cbt'
          ? 'Deconstruct automatic thoughts and reframe your narrative.'
          : 'Guided meditation sessions for presence and calm.'}
      </Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBadge
          value={activeTab === 'cbt' ? thisWeekCbt : medStats.totalSessions}
          label={activeTab === 'cbt' ? 'This Week' : 'Total Sessions'}
        />
        <StatBadge
          value={activeTab === 'cbt' ? (cbtStats.totalExercises) : (`${medStats.totalMinutes}m`)}
          label={activeTab === 'cbt' ? 'All Time' : 'Total Time'}
        />
        <StatBadge
          value={activeTab === 'cbt'
            ? (cbtStats.favoriteType ? cbtStats.favoriteType.replace(/_/g, ' ') : '-')
            : (medStats.favoriteType ?? '-')}
          label="Most Practiced"
        />
      </View>

      {/* Exercise/Meditation list */}
      {activeTab === 'cbt' ? (
        CBT_EXERCISES.map((ex) => {
          const icon = CBT_ICONS[ex.type] ?? '\u{1F4CB}';
          const difficulty = DIFFICULTY_MAP[ex.type] ?? 'Beginner';
          return (
            <GlassCard key={ex.type} level={2} style={styles.exerciseCard} onPress={() => startCbtExercise(ex.type)}>
              <View style={styles.exerciseRow}>
                <Text style={{ fontSize: 24 }}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseDesc}>{ex.description}</Text>
                  <View style={styles.exerciseMeta}>
                    <Text style={styles.exerciseTime}>{ex.estimatedMinutes} min</Text>
                    <View style={styles.diffBadge}>
                      <Text style={styles.diffText}>{difficulty}</Text>
                    </View>
                  </View>
                </View>
                <Pressable style={styles.startSmall} onPress={() => startCbtExercise(ex.type)}>
                  <Text style={styles.startSmallText}>Start</Text>
                </Pressable>
              </View>
            </GlassCard>
          );
        })
      ) : (
        MEDITATION_TYPES.filter((m) => m.type !== 'custom_timer').map((med) => {
          const durationMin = Math.round(med.defaultDurationSeconds / 60);
          return (
            <GlassCard key={med.type} level={2} style={styles.exerciseCard} onPress={() => startMeditation(med.type)}>
              <View style={styles.exerciseRow}>
                <Text style={{ fontSize: 24 }}>{'\u{1F9D8}'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{med.name}</Text>
                  <Text style={styles.exerciseDesc}>{med.description}</Text>
                  <Text style={styles.exerciseTime}>{durationMin} min</Text>
                </View>
                <Pressable style={styles.startSmall} onPress={() => startMeditation(med.type)}>
                  <Text style={styles.startSmallText}>Start</Text>
                </Pressable>
              </View>
            </GlassCard>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  libraryContent: { paddingBottom: 100 },
  fullScreen: { flex: 1, backgroundColor: HEALTH_SURFACES.depth, padding: spacing.md },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: { backgroundColor: HEALTH_ACCENT },
  tabInactive: {},
  tabText: { ...HEALTH_TYPOGRAPHY.labelUpper, fontSize: 12, letterSpacing: 0.5, color: colors.textTertiary },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  headerDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: spacing.md,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  // Exercise cards
  exerciseCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 16, color: colors.text },
  exerciseDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  exerciseTime: { fontSize: 11, color: colors.textTertiary },
  diffBadge: {
    backgroundColor: HEALTH_SURFACES.highest,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diffText: { fontSize: 10, color: colors.textSecondary },
  startSmall: {
    backgroundColor: HEALTH_SURFACES.highest,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startSmallText: { fontSize: 13, fontWeight: '600', color: colors.text },

  // CBT exercise flow
  moodPickerCard: { marginBottom: spacing.md },
  moodPickerLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  moodRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  moodNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HEALTH_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodNumActive: { backgroundColor: HEALTH_ACCENT },
  moodNumText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  moodNumTextActive: { color: '#fff' },

  progressRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: spacing.sm },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: HEALTH_SURFACES.focus },
  progressDotActive: { backgroundColor: HEALTH_ACCENT },
  stepLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  promptCard: { marginBottom: spacing.md, gap: spacing.sm },
  promptText: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  promptInput: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
  },

  exerciseActions: { gap: spacing.sm, alignItems: 'center' },
  cancelText: { fontSize: 14, color: colors.textSecondary, paddingVertical: 8 },

  // Meditation
  medCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  medTimer: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 48,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  medProgressBar: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  medProgressFill: { height: 4, borderRadius: 2, backgroundColor: HEALTH_ACCENT },
  medPromptCard: { marginHorizontal: spacing.md, alignItems: 'center' },
  medPromptText: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  endBtn: {
    backgroundColor: HEALTH_ACCENT,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  endBtnText: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 15, color: '#fff' },
});
