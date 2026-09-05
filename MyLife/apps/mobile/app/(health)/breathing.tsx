import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import {
  BREATHING_PATTERNS,
  getPatternConfig,
  calculateSessionDuration,
  getBreathingStats,
  getBreathingSessions,
  createBreathingSession,
  type BreathingPattern,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const PATTERNS = Object.keys(BREATHING_PATTERNS) as BreathingPattern[];

const PATTERN_ICONS: Record<BreathingPattern, string> = {
  box: '\u2B1C',
  '478': '\u{1F32C}\uFE0F',
  relaxing: '\u{1F343}',
  energizing: '\u26A1',
  sleep: '\u{1F319}',
};

type Phase = 'idle' | 'pre-mood' | 'active' | 'post-mood' | 'done';

export default function BreathingScreen() {
  const db = useDatabase();
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern>('box');
  const [phase, setPhase] = useState<Phase>('idle');
  const [cycles, setCycles] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [currentPhaseLabel, setCurrentPhaseLabel] = useState('');
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0.25)).current;

  const config = getPatternConfig(selectedPattern);
  const totalCycles = config.defaultCycles;
  const totalDuration = calculateSessionDuration(selectedPattern, totalCycles);

  const sessions = useMemo(() => {
    try { return getBreathingSessions(db, 20); } catch { return []; }
  }, [db, phase]);
  const stats = useMemo(() => getBreathingStats(sessions), [sessions]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const animateBreath = useCallback((toScale: number, duration: number) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: toScale,
        duration: duration * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: toScale > 0.7 ? 0.5 : 0.2,
        duration: duration * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const startSession = () => {
    setPhase('active');
    setCycles(0);
    setElapsed(0);
    let sec = 0;
    let cycle = 0;
    const cfg = getPatternConfig(selectedPattern);
    const cycleDur = cfg.inhale + cfg.hold1 + cfg.exhale + cfg.hold2;
    const total = calculateSessionDuration(selectedPattern, cfg.defaultCycles);

    timerRef.current = setInterval(() => {
      sec++;
      setElapsed(sec);
      const pos = sec % cycleDur;

      if (pos === 0 && sec > 0) { cycle++; setCycles(cycle); }

      if (pos < cfg.inhale) {
        setCurrentPhaseLabel('Inhale');
        setPhaseTimeLeft(cfg.inhale - pos);
        if (pos === 0) animateBreath(1.0, cfg.inhale);
      } else if (pos < cfg.inhale + cfg.hold1) {
        setCurrentPhaseLabel('Hold');
        setPhaseTimeLeft(cfg.inhale + cfg.hold1 - pos);
      } else if (pos < cfg.inhale + cfg.hold1 + cfg.exhale) {
        setCurrentPhaseLabel('Exhale');
        setPhaseTimeLeft(cfg.inhale + cfg.hold1 + cfg.exhale - pos);
        if (pos === cfg.inhale + cfg.hold1) animateBreath(0.5, cfg.exhale);
      } else {
        setCurrentPhaseLabel('Hold');
        setPhaseTimeLeft(cycleDur - pos);
      }

      if (sec >= total) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setCycles(cfg.defaultCycles);
        setPhase('post-mood');
      }
    }, 1000);
  };

  const stopSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (elapsed > 5) { setPhase('post-mood'); } else { resetToIdle(); }
  };

  const finishSession = () => {
    createBreathingSession(db, {
      pattern: selectedPattern,
      duration_seconds: elapsed,
      cycles_completed: cycles,
      completed: elapsed >= totalDuration ? 1 : 0,
      mood_before: moodBefore,
      mood_after: moodAfter,
    });
    setPhase('done');
  };

  const resetToIdle = () => {
    setPhase('idle');
    setElapsed(0);
    setCycles(0);
    setMoodBefore(null);
    setMoodAfter(null);
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(0.25);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // -- Mood rating UI (reused for pre and post) --
  const renderMoodPicker = (value: number | null, onChange: (n: number) => void) => (
    <View style={styles.moodSlider}>
      <Text style={styles.moodEndLabel}>RESTLESS</Text>
      <View style={styles.moodDots}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)}>
            <View style={[styles.moodDot, value === n && styles.moodDotActive]} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.moodEndLabel}>CALM</Text>
    </View>
  );

  // -- Pre-mood --
  if (phase === 'pre-mood') {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.centerTitle}>Current Mood</Text>
        <Text style={styles.centerSub}>How are you feeling right now?</Text>
        {renderMoodPicker(moodBefore, setMoodBefore)}
        <View style={{ width: '100%', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <GradientButton
            title="Begin Session"
            onPress={() => { if (moodBefore) startSession(); }}
            variant={moodBefore ? 'primary' : 'secondary'}
          />
        </View>
      </View>
    );
  }

  // -- Active session --
  if (phase === 'active') {
    const phasePills = ['Inhale', 'Hold', 'Exhale', config.hold2 > 0 ? 'Hold' : null].filter(Boolean) as string[];
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.sessionLabel}>
          CURRENT SESSION: {config.name.toUpperCase()}
        </Text>

        <Animated.View
          style={[
            styles.breathCircle,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        />
        <Text style={styles.phaseTimer}>{phaseTimeLeft}s</Text>
        <Text style={styles.phaseText}>{currentPhaseLabel.toUpperCase()}</Text>

        <View style={styles.phasePillRow}>
          {phasePills.map((label, i) => (
            <View
              key={i}
              style={[styles.phasePill, currentPhaseLabel === label && styles.phasePillActive]}
            >
              <Text style={[styles.phasePillText, currentPhaseLabel === label && styles.phasePillTextActive]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        <Text style={styles.cycleText}>
          Cycle {Math.min(cycles + 1, totalCycles)} / {totalCycles}
        </Text>

        <Pressable style={styles.endBtn} onPress={stopSession}>
          <Text style={styles.endBtnText}>End Session</Text>
        </Pressable>
      </View>
    );
  }

  // -- Post-mood --
  if (phase === 'post-mood') {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.centerTitle}>Session Complete</Text>
        <Text style={styles.centerSub}>{formatTime(elapsed)} | {cycles} cycles</Text>
        <View style={{ height: spacing.lg }} />
        <Text style={styles.centerTitle}>How do you feel now?</Text>
        {renderMoodPicker(moodAfter, setMoodAfter)}
        <View style={{ width: '100%', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <GradientButton
            title="Save & Close"
            onPress={() => { if (moodAfter) finishSession(); }}
            variant={moodAfter ? 'primary' : 'secondary'}
          />
        </View>
      </View>
    );
  }

  // -- Done --
  if (phase === 'done') {
    const delta = moodBefore && moodAfter ? moodAfter - moodBefore : null;
    return (
      <View style={styles.fullCenter}>
        <Text style={{ fontSize: 48 }}>{'\u2728'}</Text>
        <Text style={styles.doneTitle}>Well Done</Text>
        <Text style={styles.centerSub}>
          {formatTime(elapsed)} | {cycles} cycles | {config.name}
        </Text>
        {delta !== null && (
          <Text style={[styles.doneDelta, delta > 0 ? styles.positive : delta < 0 ? styles.negative : undefined]}>
            Mood: {delta > 0 ? '+' : ''}{delta} point{Math.abs(delta) !== 1 ? 's' : ''}
          </Text>
        )}
        <View style={{ width: '100%', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <GradientButton title="Done" onPress={resetToIdle} />
        </View>
      </View>
    );
  }

  // -- Idle: Pattern list --
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.idleContent}>
      <SectionHeader title="Breathe" />
      {stats.totalSessions > 0 && (
        <Text style={styles.sessionCountText}>
          {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''} completed
        </Text>
      )}

      {/* Current Mood card */}
      <GlassCard level={2} style={styles.moodCard}>
        <Text style={styles.cardLabel}>Current Mood</Text>
        {renderMoodPicker(moodBefore, setMoodBefore)}
      </GlassCard>

      {/* Goal card */}
      <GlassCard level={2} style={styles.goalCard}>
        <View style={styles.goalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Post-Session Goal</Text>
            <Text style={styles.goalDesc}>Deep relaxation & lower heart rate</Text>
          </View>
          <Text style={{ fontSize: 24 }}>{'\u{1F49A}'}</Text>
        </View>
      </GlassCard>

      {/* Pattern section */}
      <SectionHeader title="Breathing Patterns" action={{ text: 'SEE ALL', onPress: () => {} }} />

      {PATTERNS.map((p) => {
        const c = getPatternConfig(p);
        const icon = PATTERN_ICONS[p];
        const durationMin = Math.round(calculateSessionDuration(p, c.defaultCycles) / 60);
        const desc = `${c.inhale}s In \u00B7 ${c.hold1 > 0 ? `${c.hold1}s Hold \u00B7 ` : ''}${c.exhale}s Out${c.hold2 > 0 ? ` \u00B7 ${c.hold2}s Hold` : ''}`;

        return (
          <GlassCard key={p} level={2} style={styles.patternCard}>
            <View style={styles.patternHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.patternName}>{c.name}</Text>
                <Text style={styles.patternDesc}>{desc}</Text>
              </View>
              <Text style={{ fontSize: 24 }}>{icon}</Text>
            </View>
            <View style={styles.patternFooter}>
              <Text style={styles.patternDuration}>{'\u23F1'} {durationMin}:00 MIN</Text>
              <Pressable
                style={styles.startBtn}
                onPress={() => {
                  setSelectedPattern(p);
                  if (moodBefore) { startSession(); } else { setPhase('pre-mood'); }
                }}
              >
                <Text style={styles.startBtnText}>Start</Text>
              </Pressable>
            </View>
            <Text style={styles.patternSub}>{c.description}</Text>
          </GlassCard>
        );
      })}

      {/* History */}
      {sessions.length > 0 && (
        <View style={styles.historySection}>
          <SectionHeader title="Recent Sessions" />
          {sessions.slice(0, 5).map((s) => (
            <View key={s.id} style={styles.histRow}>
              <Text style={styles.histPattern}>
                {PATTERN_ICONS[s.pattern as BreathingPattern] ?? ''} {s.pattern}
              </Text>
              <Text style={styles.histDur}>{Math.round(s.duration_seconds / 60)}m</Text>
              <Text style={styles.histDate}>{s.created_at.slice(0, 10)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  idleContent: { paddingBottom: 100 },

  sessionCountText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textTertiary,
    paddingHorizontal: 20,
    marginBottom: spacing.md,
  },

  // Cards
  moodCard: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  goalCard: { marginHorizontal: spacing.md, marginBottom: spacing.lg },
  cardLabel: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalDesc: { fontSize: 12, color: colors.textSecondary },

  // Mood picker
  moodSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  moodEndLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  moodDots: { flexDirection: 'row', gap: 12, flex: 1, justifyContent: 'center' },
  moodDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  moodDotActive: { backgroundColor: HEALTH_ACCENT },

  // Pattern cards
  patternCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  patternHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  patternName: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 18, color: colors.text },
  patternDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  patternFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patternDuration: { fontSize: 12, color: colors.textTertiary },
  patternSub: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  startBtn: {
    backgroundColor: HEALTH_SURFACES.highest,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  startBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },

  // Full-screen states
  fullCenter: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  centerTitle: { ...HEALTH_TYPOGRAPHY.headlineMd, color: colors.text },
  centerSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  sessionLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 1.5,
    color: HEALTH_ACCENT,
    marginBottom: spacing.lg,
  },
  breathCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: HEALTH_ACCENT_LIGHT,
  },
  phaseTimer: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 42,
    color: colors.text,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  phaseText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  phasePillRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  phasePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  phasePillActive: { backgroundColor: `${HEALTH_ACCENT}20` },
  phasePillText: { fontSize: 12, color: colors.textTertiary },
  phasePillTextActive: { color: HEALTH_ACCENT_LIGHT, fontWeight: '600' },
  timerText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.md,
  },
  cycleText: { fontSize: 13, color: colors.textTertiary },
  endBtn: {
    backgroundColor: HEALTH_ACCENT,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  endBtnText: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 15, color: '#fff' },

  // Done
  doneTitle: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 24, color: colors.success },
  doneDelta: { fontSize: 16, fontWeight: '600', color: colors.text },
  positive: { color: colors.success },
  negative: { color: colors.danger },

  // History
  historySection: { marginTop: spacing.lg },
  histRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HEALTH_SURFACES.focus,
  },
  histPattern: { fontSize: 13, color: colors.text, flex: 1, textTransform: 'capitalize' },
  histDur: { fontSize: 13, fontWeight: '600', color: colors.text, width: 30 },
  histDate: { fontSize: 13, color: colors.textTertiary, width: 80 },
});
