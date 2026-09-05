import { useState, useRef, useEffect } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, TextInput, Linking, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import {
  GROUNDING_STEPS,
  CRISIS_HOTLINES,
  createSosSession,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

type Phase = 'idle' | 'pre-mood' | 'active' | 'post-mood' | 'done';

const SENSE_ICONS: Record<string, string> = {
  see: '\u{1F441}\uFE0F',
  touch: '\u{1F91A}',
  hear: '\u{1F442}',
  smell: '\u{1F443}',
  taste: '\u{1F445}',
};

const SENSE_COLORS: Record<string, string> = {
  see: '#60A5FA',
  touch: '#34D399',
  hear: '#A78BFA',
  smell: '#FBBF24',
  taste: '#F87171',
};

export default function GroundingScreen() {
  const db = useDatabase();
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [inputs, setInputs] = useState<string[][]>([]);
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const [startTime, setStartTime] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const steps = GROUNDING_STEPS;
  const currentStep = steps[stepIndex];
  const senseColor = currentStep ? (SENSE_COLORS[currentStep.sense] ?? HEALTH_ACCENT) : HEALTH_ACCENT;

  useEffect(() => {
    if (phase === 'active') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current = anim;
      anim.start();
      return () => anim.stop();
    }
    return undefined;
  }, [phase, pulseAnim]);

  const startExercise = () => {
    setPhase('active');
    setStepIndex(0);
    setInputs(steps.map((s) => Array(s.count).fill('')));
    setStartTime(Date.now());
  };

  const updateInput = (stepIdx: number, inputIdx: number, value: string) => {
    setInputs((prev) => {
      const next = prev.map((arr) => [...arr]);
      next[stepIdx][inputIdx] = value;
      return next;
    });
  };

  const nextStep = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setPhase('post-mood');
    }
  };

  const finishExercise = () => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    createSosSession(db, {
      trigger_source: 'grounding',
      tools_used: '54321',
      duration_seconds: elapsed,
      mood_before: moodBefore,
      mood_after: moodAfter,
      notes: null,
    });
    setPhase('done');
  };

  const resetToIdle = () => {
    setPhase('idle');
    setStepIndex(0);
    setInputs([]);
    setMoodBefore(null);
    setMoodAfter(null);
  };

  const callNumber = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  // Mood picker
  const renderMoodDots = (value: number | null, onChange: (n: number) => void) => (
    <View style={styles.moodRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)}>
          <View style={[styles.moodDot, value === n && styles.moodDotActive]} />
        </Pressable>
      ))}
    </View>
  );

  // -- Pre-mood --
  if (phase === 'pre-mood') {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.centerTitle}>Before We Begin</Text>
        <Text style={styles.centerSub}>How distressed are you right now?</Text>
        <View style={styles.moodSlider}>
          <Text style={styles.moodEndLabel}>VERY</Text>
          {renderMoodDots(moodBefore, setMoodBefore)}
          <Text style={styles.moodEndLabel}>CALM</Text>
        </View>
        <View style={{ width: '100%', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <GradientButton
            title="Begin Grounding"
            onPress={() => { if (moodBefore) startExercise(); }}
            variant={moodBefore ? 'primary' : 'secondary'}
          />
        </View>
      </View>
    );
  }

  // -- Active exercise --
  if (phase === 'active' && currentStep) {
    const stepInputs = inputs[stepIndex] ?? [];
    const filledCount = stepInputs.filter((s) => s.trim().length > 0).length;
    const senseIcon = SENSE_ICONS[currentStep.sense] ?? '\u{1F50D}';

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.activeContent}>
        {/* SOS badge */}
        <View style={styles.sosBadgeRow}>
          <View style={styles.sosBadge}>
            <Text style={styles.sosBadgeText}>{'\u2731'} SOS GROUNDING</Text>
          </View>
          <Pressable onPress={resetToIdle}>
            <Text style={styles.closeX}>{'\u2715'}</Text>
          </Pressable>
        </View>

        {/* Step dots */}
        <View style={styles.dotRow}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i <= stepIndex && { backgroundColor: senseColor }]} />
          ))}
        </View>

        {/* Calming circle */}
        <Animated.View
          style={[
            styles.calmCircle,
            { backgroundColor: senseColor, transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.calmIcon}>{senseIcon}</Text>
        </Animated.View>

        {/* Prompt */}
        <Text style={styles.promptTitle}>
          Name {currentStep.count} things you can
        </Text>
        <Text style={[styles.promptSense, { color: senseColor }]}>
          {currentStep.sense.toUpperCase()}
        </Text>
        <Text style={styles.promptHint}>
          {currentStep.sense === 'see' && 'Scan your environment slowly. Notice the small details.'}
          {currentStep.sense === 'touch' && 'Reach out and feel different textures around you.'}
          {currentStep.sense === 'hear' && 'Close your eyes briefly. What sounds surround you?'}
          {currentStep.sense === 'smell' && 'Breathe deeply. What scents can you detect?'}
          {currentStep.sense === 'taste' && 'Notice any taste in your mouth right now.'}
        </Text>

        {/* Input fields */}
        <View style={styles.inputList}>
          {stepInputs.map((val, i) => (
            <View key={i} style={styles.inputRow}>
              <TextInput
                style={styles.senseInput}
                placeholder={`${currentStep.sense === 'see' ? ['Something in the distance...', 'Something close by...', 'A specific color...', 'A texture you notice...', 'A play of light or shadow...'][i] ?? '...' : '...'}`}
                placeholderTextColor={colors.textTertiary}
                value={val}
                onChangeText={(text) => updateInput(stepIndex, i, text)}
              />
              <Text style={styles.inputNum}>{i + 1}</Text>
            </View>
          ))}
        </View>

        {/* Continue button */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <GradientButton
            title={stepIndex < steps.length - 1 ? `Continue to Step ${stepIndex + 2}` : 'Complete Exercise'}
            onPress={nextStep}
            variant={filledCount >= 1 ? 'primary' : 'secondary'}
          />
        </View>

        {/* Milestone */}
        <GlassCard level={3} style={styles.milestoneCard}>
          <Text style={styles.milestoneLabel}>NEXT MILESTONE</Text>
          <Text style={styles.milestoneTitle}>Emotional Release Summary</Text>
        </GlassCard>
      </ScrollView>
    );
  }

  // -- Post-mood --
  if (phase === 'post-mood') {
    return (
      <View style={styles.fullCenter}>
        <Text style={{ fontSize: 48 }}>{'\u2705'}</Text>
        <Text style={styles.centerTitle}>Exercise Complete</Text>
        <Text style={styles.centerSub}>Great work grounding yourself. How do you feel now?</Text>
        <View style={styles.moodSlider}>
          <Text style={styles.moodEndLabel}>VERY</Text>
          {renderMoodDots(moodAfter, setMoodAfter)}
          <Text style={styles.moodEndLabel}>CALM</Text>
        </View>
        <View style={{ width: '100%', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <GradientButton
            title="Save & Close"
            onPress={() => { if (moodAfter) finishExercise(); }}
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
        <Text style={{ fontSize: 48 }}>{'\u{1F33F}'}</Text>
        <Text style={styles.doneTitle}>Well Done</Text>
        <Text style={styles.centerSub}>You completed the 5-4-3-2-1 grounding exercise.</Text>
        {delta !== null && (
          <Text style={[styles.doneDelta, delta > 0 ? styles.positive : delta < 0 ? styles.negative : undefined]}>
            Distress: {delta > 0 ? '+' : ''}{delta} (lower is better)
          </Text>
        )}
        <View style={{ width: '100%', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <GradientButton title="Done" onPress={resetToIdle} />
        </View>
      </View>
    );
  }

  // -- Idle --
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.idleContent}>
      <SectionHeader label="SENSORY ANCHORING" title="Grounding" />
      <Text style={styles.idleDesc}>
        Evidence-based techniques for managing anxiety and panic through sensory awareness.
      </Text>

      {/* Quick start */}
      <Pressable style={styles.quickStart} onPress={() => setPhase('pre-mood')}>
        <Text style={styles.quickStartLabel}>I Need Help Now</Text>
        <Text style={styles.quickStartSub}>Start 5-4-3-2-1 Grounding</Text>
      </Pressable>

      {/* Exercise options */}
      {[
        { id: '54321', name: '5-4-3-2-1 Sensory', desc: 'Ground through your senses', dur: '3-5 min', icon: '\u{1F441}\uFE0F' },
        { id: 'body_scan', name: 'Body Scan', desc: 'Progressive awareness of body', dur: '5-10 min', icon: '\u{1F9D8}' },
        { id: 'pmr', name: 'Muscle Relaxation', desc: 'Tense and release muscle groups', dur: '10-15 min', icon: '\u{1F4AA}' },
        { id: 'cold_water', name: 'Cold Water Technique', desc: 'Cold stimulus to reset nervous system', dur: '1-2 min', icon: '\u{1F4A7}' },
      ].map((ex) => (
        <GlassCard key={ex.id} level={2} style={styles.exerciseCard} onPress={() => setPhase('pre-mood')}>
          <View style={styles.exerciseRow}>
            <Text style={{ fontSize: 24 }}>{ex.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <Text style={styles.exerciseDesc}>{ex.desc}</Text>
            </View>
            <Text style={styles.exerciseDur}>{ex.dur}</Text>
          </View>
        </GlassCard>
      ))}

      {/* Crisis resources */}
      <GlassCard level={1} style={styles.crisisCard}>
        <View style={styles.crisisHeader}>
          <Text style={{ fontSize: 20 }}>{'\u{1F4DE}'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.crisisTitle}>Need immediate support?</Text>
            <Text style={styles.crisisSub}>Help is available 24/7 through these confidential resources.</Text>
          </View>
        </View>

        {CRISIS_HOTLINES.map((h) => (
          <Pressable key={h.name} style={styles.hotlineRow} onPress={() => callNumber(h.number)}>
            <View>
              <Text style={styles.hotlineLabel}>
                {h.type === 'call' ? 'CRISIS LIFELINE' : 'NATIONAL SUICIDE PREVENTION'}
              </Text>
              <Text style={styles.hotlineNumber}>
                {h.type === 'call' ? `Dial ${h.number}` : h.number}
              </Text>
            </View>
            <Text style={{ fontSize: 18 }}>{h.type === 'call' ? '\u203A' : '\u{1F4DE}'}</Text>
          </Pressable>
        ))}
      </GlassCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  idleContent: { paddingBottom: 100 },
  activeContent: { paddingBottom: 100 },

  // Idle
  idleDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },
  quickStart: {
    backgroundColor: HEALTH_ACCENT,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  quickStartLabel: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 18, color: '#fff' },
  quickStartSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  exerciseCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 16, color: colors.text },
  exerciseDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  exerciseDur: { ...HEALTH_TYPOGRAPHY.labelUpper, fontSize: 10, letterSpacing: 0.5, color: colors.textTertiary },

  // Crisis
  crisisCard: { marginHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.md },
  crisisHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  crisisTitle: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 16, color: colors.text },
  crisisSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  hotlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    padding: spacing.md,
  },
  hotlineLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.5,
    color: HEALTH_ACCENT_LIGHT,
    marginBottom: 2,
  },
  hotlineNumber: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 18, color: colors.text },

  // Active exercise
  sosBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  sosBadge: {
    backgroundColor: `${HEALTH_ACCENT}20`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sosBadgeText: { ...HEALTH_TYPOGRAPHY.labelUpper, fontSize: 11, letterSpacing: 0.5, color: HEALTH_ACCENT },
  closeX: { fontSize: 18, color: colors.textTertiary, padding: 8 },

  dotRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: spacing.lg },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: HEALTH_SURFACES.focus },

  calmCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  calmIcon: { fontSize: 32 },

  promptTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 30,
  },
  promptSense: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  promptHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },

  inputList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  senseInput: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
  },
  inputNum: { fontSize: 13, color: colors.textTertiary, fontWeight: '600', width: 20, textAlign: 'center' },

  milestoneCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneLabel: { ...HEALTH_TYPOGRAPHY.labelUpper, fontSize: 10, letterSpacing: 0.5, color: colors.textTertiary },
  milestoneTitle: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 14, color: colors.text, marginTop: 2 },

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

  moodSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  moodEndLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  moodRow: { flexDirection: 'row', gap: 12 },
  moodDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  moodDotActive: { backgroundColor: HEALTH_ACCENT },

  doneTitle: { ...HEALTH_TYPOGRAPHY.headlineMd, fontSize: 24, color: colors.success },
  doneDelta: { fontSize: 16, fontWeight: '600', color: colors.text },
  positive: { color: colors.success },
  negative: { color: colors.danger },
});
