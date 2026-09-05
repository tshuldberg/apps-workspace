import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, Heart, Shield, X } from 'lucide-react-native';
import {
  getSosFlow,
  getRandomAffirmation,
  GROUNDING_SENSES,
  createSosSession,
  completeSosSession,
  getEmergencyContacts,
  type GroundingSense,
  type EmergencyContact,
  GlassCard,
  GradientButton,
  SectionHeader,
  MOOD_TYPOGRAPHY,
  MOOD_SURFACES,
  MOOD_ACCENT,
} from '@mylife/mood';
import { useDatabase } from '../../components/DatabaseProvider';

// SOS-specific red accent tokens
const SOS_RED = '#F87171';
const SOS_RED_EMPHASIS = '#EF4444';
const SOS_GLOW = 'rgba(248, 113, 113, 0.1)';
const SOS_GLOW_STRONG = 'rgba(248, 113, 113, 0.15)';

const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#9F8E81';
const TEXT_MUTED = 'rgba(255,255,255,0.4)';

export default function SosScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [sessionId] = useState(() => uuid());
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [exitScore, setExitScore] = useState<number | null>(null);

  // Breathing state
  const [breathPhase, setBreathPhase] = useState('INHALE');
  const scaleAnim = useRef(new Animated.Value(0.6)).current;

  // Grounding state
  const [groundingIndex, setGroundingIndex] = useState(0);
  const [tappedItems, setTappedItems] = useState<number[]>([]);
  const [groundingCompleted, setGroundingCompleted] = useState(false);

  // Affirmation state
  const [affirmation, setAffirmation] = useState(getRandomAffirmation());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Emergency contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flow = useRef(getSosFlow('box')).current;

  // Load contacts + start session
  useEffect(() => {
    createSosSession(db, sessionId, { triggerMoodScore: null });
    setContacts(getEmergencyContacts(db));
    elapsedRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    };
  }, [db, sessionId]);

  // Breathing animation
  useEffect(() => {
    if (currentStep !== 0) return;
    let cancelled = false;

    const runBreathing = () => {
      if (cancelled) return;
      setBreathPhase('INHALE');
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 4000, useNativeDriver: true }).start();
      breathTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setBreathPhase('HOLD');
        breathTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          setBreathPhase('EXHALE');
          Animated.timing(scaleAnim, { toValue: 0.6, duration: 4000, useNativeDriver: true }).start();
          breathTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            setBreathPhase('HOLD');
            breathTimerRef.current = setTimeout(() => {
              if (cancelled) return;
              runBreathing();
            }, 4000);
          }, 4000);
        }, 4000);
      }, 4000);
    };

    runBreathing();
    return () => { cancelled = true; };
  }, [currentStep, scaleAnim]);

  // Affirmation fade-in
  useEffect(() => {
    if (currentStep !== 2) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 1500, useNativeDriver: true }).start();
  }, [currentStep, affirmation, fadeAnim]);

  const nextStep = useCallback(() => {
    if (currentStep < 3) setCurrentStep((prev) => prev + 1);
  }, [currentStep]);

  const handleNewAffirmation = useCallback(() => {
    setAffirmation(getRandomAffirmation());
  }, []);

  const handleGroundingTap = useCallback((index: number) => {
    setTappedItems((prev) => {
      if (prev.includes(index)) return prev;
      const next = [...prev, index];
      const sense = GROUNDING_SENSES[groundingIndex];
      if (next.length >= sense.count) {
        if (groundingIndex < GROUNDING_SENSES.length - 1) {
          setGroundingIndex((gi) => gi + 1);
          return [];
        } else {
          setGroundingCompleted(true);
        }
      }
      return next;
    });
  }, [groundingIndex]);

  const handleComplete = useCallback(() => {
    completeSosSession(db, sessionId, {
      stepsCompleted: currentStep + 1,
      totalDurationSeconds: elapsed,
      exitMoodScore: exitScore,
      groundingCompleted,
    });
    router.back();
  }, [db, sessionId, currentStep, elapsed, exitScore, groundingCompleted, router]);

  const handleStopFlow = useCallback(() => {
    completeSosSession(db, sessionId, {
      stepsCompleted: currentStep + 1,
      totalDurationSeconds: elapsed,
      exitMoodScore: null,
      groundingCompleted,
    });
    router.back();
  }, [db, sessionId, currentStep, elapsed, groundingCompleted, router]);

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  const currentSense: GroundingSense | undefined = GROUNDING_SENSES[groundingIndex];

  // -- Step indicator --
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['STEP 1', 'ACTIVE', 'STEP 3', 'STEP 4'].map((label, i) => (
        <View key={i} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              i <= currentStep && styles.stepDotActive,
              i === currentStep && styles.stepDotCurrent,
            ]}
          />
          <RNText
            style={[
              styles.stepLabel,
              i === currentStep && styles.stepLabelActive,
            ]}
          >
            {i === currentStep ? 'ACTIVE' : `STEP ${i + 1}`}
          </RNText>
          {i < 3 && (
            <View
              style={[
                styles.stepLine,
                i < currentStep && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  // -- Crisis hotlines (always visible at bottom) --
  const renderCrisisHotlines = () => (
    <View style={styles.crisisSection}>
      <RNText style={styles.crisisHeader}>GET HELP IMMEDIATELY</RNText>

      <Pressable
        style={styles.crisisRow}
        onPress={() => Linking.openURL('tel:988')}
      >
        <View style={styles.crisisInfo}>
          <RNText style={styles.crisisName}>988 Lifeline</RNText>
          <RNText style={styles.crisisSub}>Suicide & Crisis Network</RNText>
        </View>
        <View style={styles.crisisCallBtn}>
          <RNText style={styles.crisisCallText}>Call 988</RNText>
          <Phone size={14} color={TEXT_PRIMARY} />
        </View>
      </Pressable>

      <Pressable
        style={styles.crisisRow}
        onPress={() => Linking.openURL('sms:741741?body=HELLO')}
      >
        <View style={styles.crisisInfo}>
          <RNText style={styles.crisisName}>Crisis Text Line</RNText>
          <RNText style={styles.crisisSub}>Text HOME to 741741</RNText>
        </View>
        <View style={styles.crisisTextBtn}>
          <RNText style={styles.crisisTextBtnLabel}>Text</RNText>
        </View>
      </Pressable>

      {contacts.length > 0 && (
        <Pressable
          style={styles.emergencyContactsBtn}
          onPress={() => {
            const firstWithPhone = contacts.find((c) => c.phone);
            if (firstWithPhone?.phone) {
              Linking.openURL(`tel:${firstWithPhone.phone}`);
            } else {
              router.push('/(mood)/emergency-contacts');
            }
          }}
        >
          <Phone size={16} color="#FFFFFF" />
          <RNText style={styles.emergencyContactsBtnText}>
            Call Emergency Contacts
          </RNText>
        </Pressable>
      )}
    </View>
  );

  // =============== STEP 1: BREATHING ===============
  if (currentStep === 0) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <RNText style={styles.headerTitle}>MyMood SOS</RNText>
          <Pressable onPress={handleStopFlow} hitSlop={12}>
            <X size={22} color={TEXT_SECONDARY} />
          </Pressable>
        </View>

        {renderStepIndicator()}

        {/* Breathing circle */}
        <View style={styles.breathSection}>
          <RNText style={styles.breathTitle}>Focus on your breath</RNText>
          <RNText style={styles.breathInstruction}>
            Follow the circle to regulate your heart rate. Inhale as it grows,
            exhale as it shrinks.
          </RNText>

          <Animated.View
            style={[
              styles.breathCircle,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.breathCircleInner}>
              <RNText style={styles.breathPhaseText}>{breathPhase}</RNText>
            </View>
          </Animated.View>
        </View>

        {/* Emergency support panel */}
        <GlassCard level={2} style={styles.supportPanel}>
          <View style={styles.supportHeader}>
            <Shield size={18} color={SOS_RED} />
            <RNText style={styles.supportTitle}>Emergency Support</RNText>
          </View>

          <Pressable
            style={styles.hotlineRow}
            onPress={() => Linking.openURL('tel:988')}
          >
            <View>
              <RNText style={styles.hotlineNumber}>988</RNText>
              <RNText style={styles.hotlineName}>
                Suicide & Crisis Lifeline
              </RNText>
            </View>
            <Phone size={18} color={SOS_RED} />
          </Pressable>

          {contacts.length > 0 && (
            <View style={styles.trustedContacts}>
              <RNText style={styles.trustedLabel}>TRUSTED CONTACTS</RNText>
              {contacts.slice(0, 3).map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.trustedRow}
                  onPress={() => c.phone && handleCall(c.phone)}
                >
                  <View style={styles.trustedAvatar}>
                    <RNText style={styles.trustedAvatarText}>
                      {c.name.charAt(0).toUpperCase()}
                    </RNText>
                  </View>
                  <RNText style={styles.trustedName}>
                    {c.name}
                    {c.relationship ? ` (${c.relationship})` : ''}
                  </RNText>
                  {c.phone && <Phone size={14} color={SOS_RED} />}
                </Pressable>
              ))}
            </View>
          )}
        </GlassCard>

        {/* Daily affirmation */}
        <GlassCard level={1} style={styles.affirmationCard}>
          <RNText style={styles.affirmationLabel}>DAILY AFFIRMATION</RNText>
          <RNText style={styles.affirmationQuote}>
            &ldquo;{affirmation}&rdquo;
          </RNText>
        </GlassCard>

        {/* Next step */}
        <View style={styles.navButtons}>
          <GradientButton title="Next Step" variant="danger" onPress={nextStep} />
          <GradientButton title="Stop Flow" variant="secondary" onPress={handleStopFlow} />
        </View>

        <RNText style={styles.disclaimer}>
          This is a wellness tool, not medical advice. In an emergency, call 911.
        </RNText>
      </ScrollView>
    );
  }

  // =============== STEP 2: GROUNDING ===============
  if (currentStep === 1) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <RNText style={styles.headerTitle}>MyMood SOS</RNText>
          <Pressable onPress={handleStopFlow} hitSlop={12}>
            <X size={22} color={TEXT_SECONDARY} />
          </Pressable>
        </View>

        {renderStepIndicator()}

        <View style={styles.groundingHeader}>
          <RNText style={styles.groundingTitle}>5-4-3-2-1{'\n'}Grounding</RNText>
          <RNText style={styles.groundingSubtitle}>
            Focus on your surroundings to quiet your mind and steady your pulse.
            You are safe.
          </RNText>
        </View>

        {!groundingCompleted && currentSense && (
          <GlassCard level={2} style={styles.groundingSenseCard}>
            <View style={styles.senseCountBadge}>
              <RNText style={styles.senseCountText}>{currentSense.count}</RNText>
            </View>
            <RNText style={styles.senseTitle}>
              Things you {currentSense.sense}
            </RNText>
            <RNText style={styles.senseDescription}>
              {currentSense.prompt.replace(
                /Name \d+ things? you can (\w+)/i,
                `Look around you. Name ${currentSense.count} thing${currentSense.count > 1 ? 's' : ''} in your current field of ${currentSense.sense === 'see' ? 'vision' : currentSense.sense} that you haven't noticed before.`
              )}
            </RNText>
            <View style={styles.senseItems}>
              {Array.from({ length: currentSense.count }, (_, i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.senseItemChip,
                    tappedItems.includes(i) && styles.senseItemChipActive,
                  ]}
                  onPress={() => handleGroundingTap(i)}
                >
                  <RNText
                    style={[
                      styles.senseItemText,
                      tappedItems.includes(i) && styles.senseItemTextActive,
                    ]}
                  >
                    Item {i + 1}
                  </RNText>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        )}

        {/* Remaining senses overview */}
        <View style={styles.sensesOverview}>
          {GROUNDING_SENSES.map((sense, i) => {
            if (i === groundingIndex && !groundingCompleted) return null;
            const isCompleted = i < groundingIndex || groundingCompleted;
            return (
              <View key={sense.sense} style={styles.senseOverviewItem}>
                <RNText style={styles.senseOverviewCount}>{sense.count}</RNText>
                <RNText style={styles.senseOverviewIcon}>
                  {sense.sense === 'see' ? '\u{1F441}' : sense.sense === 'touch' ? '\u{270B}' : sense.sense === 'hear' ? '\u{1F442}' : sense.sense === 'smell' ? '\u{1F443}' : '\u{1F445}'}
                </RNText>
                <RNText style={[styles.senseOverviewLabel, isCompleted && styles.senseOverviewDone]}>
                  THINGS YOU {sense.sense.toUpperCase()}
                </RNText>
              </View>
            );
          })}
        </View>

        {groundingCompleted && (
          <GlassCard level={2} style={styles.groundingDoneCard}>
            <RNText style={styles.groundingDoneText}>
              Great job grounding yourself. You are present and safe.
            </RNText>
          </GlassCard>
        )}

        <View style={styles.navButtons}>
          <GradientButton title="Next Step" variant="danger" onPress={nextStep} />
          <GradientButton title="I'm feeling better" variant="secondary" onPress={handleStopFlow} />
        </View>

        {renderCrisisHotlines()}
      </ScrollView>
    );
  }

  // =============== STEP 3: AFFIRMATION ===============
  if (currentStep === 2) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <RNText style={styles.headerTitle}>MyMood SOS</RNText>
          <Pressable onPress={handleStopFlow} hitSlop={12}>
            <X size={22} color={TEXT_SECONDARY} />
          </Pressable>
        </View>

        {renderStepIndicator()}

        <SectionHeader label="STEP 3" title="Affirmation" />

        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard level={2} style={styles.affirmationPanel}>
            <Heart size={24} color={SOS_RED} style={{ marginBottom: 12 }} />
            <RNText style={styles.affirmationMainText}>
              &ldquo;{affirmation}&rdquo;
            </RNText>
            <Pressable style={styles.anotherBtn} onPress={handleNewAffirmation}>
              <RNText style={styles.anotherBtnText}>Another</RNText>
            </Pressable>
          </GlassCard>
        </Animated.View>

        {/* Quick recovery resources */}
        <View style={styles.resourcesRow}>
          <GlassCard level={2} style={styles.resourceCard}>
            <RNText style={styles.resourceTitle}>Panic Relief Soundscape</RNText>
            <RNText style={styles.resourceDesc}>
              Put on noise and bilateral stimulation to calm the nervous system
            </RNText>
            <Pressable
              onPress={() => router.push('/(mood)/focus')}
            >
              <RNText style={styles.resourceLink}>PLAY NOW &gt;</RNText>
            </Pressable>
          </GlassCard>
          <GlassCard level={2} style={styles.resourceCard}>
            <RNText style={styles.resourceTitle}>Quick Experiments</RNText>
            <RNText style={styles.resourceDesc}>
              Try the "Container Pause" or "StrengthsBalance" techniques.
            </RNText>
            <Pressable
              onPress={() => router.push('/(mood)/experiments')}
            >
              <RNText style={styles.resourceLink}>VIEW GUIDE &gt;</RNText>
            </Pressable>
          </GlassCard>
        </View>

        <View style={styles.navButtons}>
          <GradientButton title="Next Step" variant="danger" onPress={nextStep} />
          <GradientButton title="Stop Flow" variant="secondary" onPress={handleStopFlow} />
        </View>

        {renderCrisisHotlines()}
      </ScrollView>
    );
  }

  // =============== STEP 4: EXIT CHECK-IN ===============
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <RNText style={styles.headerTitle}>MyMood SOS</RNText>
        <Pressable onPress={handleStopFlow} hitSlop={12}>
          <X size={22} color={TEXT_SECONDARY} />
        </Pressable>
      </View>

      {renderStepIndicator()}

      <SectionHeader label="STEP 4" title="Check In" />

      <GlassCard level={2} style={styles.exitCard}>
        <RNText style={styles.exitPrompt}>
          How are you feeling now?
        </RNText>
        <RNText style={styles.exitSubtext}>
          Rate your current state from 1 (struggling) to 10 (at ease)
        </RNText>

        <View style={styles.scoreRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
            <Pressable
              key={val}
              style={[
                styles.scoreDot,
                val === exitScore && styles.scoreDotActive,
              ]}
              onPress={() => setExitScore(val)}
            >
              <RNText
                style={[
                  styles.scoreDotText,
                  val === exitScore && styles.scoreDotTextActive,
                ]}
              >
                {val}
              </RNText>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <View style={styles.navButtons}>
        <GradientButton title="Done" variant="danger" onPress={handleComplete} />
      </View>

      <RNText style={styles.disclaimer}>
        This tool is for general wellness only and is not a substitute for
        professional medical or mental health advice. If you are in crisis or
        experiencing a life-threatening emergency, please call 911 or your local
        emergency number.
      </RNText>

      {renderCrisisHotlines()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: SOS_RED,
    fontSize: 18,
    lineHeight: 24,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: MOOD_SURFACES.focus,
  },
  stepDotActive: {
    backgroundColor: SOS_RED,
  },
  stepDotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: SOS_RED_EMPHASIS,
    backgroundColor: SOS_RED,
  },
  stepLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: TEXT_MUTED,
    lineHeight: 14,
  },
  stepLabelActive: {
    color: SOS_RED,
  },
  stepLine: {
    width: 20,
    height: 1,
    backgroundColor: MOOD_SURFACES.focus,
    marginHorizontal: 2,
  },
  stepLineActive: {
    backgroundColor: SOS_RED,
  },

  // Breathing
  breathSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  breathTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 32,
  },
  breathInstruction: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  breathCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: SOS_RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: SOS_RED,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 8,
  },
  breathCircleInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathPhaseText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.1 * 18,
    lineHeight: 24,
  },

  // Support panel
  supportPanel: {
    marginHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  hotlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SOS_GLOW,
    borderRadius: 12,
    padding: 14,
  },
  hotlineNumber: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 28,
    color: TEXT_PRIMARY,
    lineHeight: 34,
  },
  hotlineName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  trustedContacts: {
    gap: 8,
    marginTop: 4,
  },
  trustedLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: TEXT_SECONDARY,
    lineHeight: 14,
  },
  trustedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  trustedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustedAvatarText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 18,
  },
  trustedName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: TEXT_PRIMARY,
    flex: 1,
    lineHeight: 20,
  },

  // Affirmation card (step 1 sidebar)
  affirmationCard: {
    marginHorizontal: 20,
    marginTop: 16,
    gap: 6,
  },
  affirmationLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: TEXT_SECONDARY,
    lineHeight: 14,
  },
  affirmationQuote: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Grounding
  groundingHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  groundingTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 32,
    color: TEXT_PRIMARY,
    lineHeight: 40,
  },
  groundingSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    marginTop: 8,
  },
  groundingSenseCard: {
    marginHorizontal: 20,
    marginTop: 8,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  senseCountBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SOS_GLOW_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senseCountText: {
    ...MOOD_TYPOGRAPHY.displayLg,
    fontSize: 24,
    color: SOS_RED,
    lineHeight: 30,
  },
  senseTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: TEXT_PRIMARY,
    lineHeight: 28,
  },
  senseDescription: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  senseItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  senseItemChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MOOD_SURFACES.focus,
  },
  senseItemChipActive: {
    backgroundColor: SOS_RED,
  },
  senseItemText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  senseItemTextActive: {
    color: '#FFFFFF',
  },
  sensesOverview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  senseOverviewItem: {
    alignItems: 'center',
    gap: 2,
  },
  senseOverviewCount: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: TEXT_SECONDARY,
    lineHeight: 24,
  },
  senseOverviewIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  senseOverviewLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.05 * 8,
    color: TEXT_MUTED,
    lineHeight: 12,
  },
  senseOverviewDone: {
    color: SOS_RED,
  },
  groundingDoneCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 20,
  },
  groundingDoneText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 16,
    lineHeight: 24,
    color: '#4ADE80',
    textAlign: 'center',
  },

  // Affirmation panel (step 3)
  affirmationPanel: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  affirmationMainText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 20,
    lineHeight: 30,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  anotherBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SOS_GLOW,
  },
  anotherBtnText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: SOS_RED,
    lineHeight: 16,
  },

  // Resources
  resourcesRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  resourceCard: {
    flex: 1,
    gap: 8,
  },
  resourceTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  resourceDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  resourceLink: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
    lineHeight: 14,
  },

  // Exit check-in
  exitCard: {
    marginHorizontal: 20,
    gap: 16,
    paddingVertical: 24,
  },
  exitPrompt: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 20,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 28,
  },
  exitSubtext: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  scoreDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MOOD_SURFACES.focus,
  },
  scoreDotActive: {
    backgroundColor: SOS_RED,
  },
  scoreDotText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  scoreDotTextActive: {
    color: '#FFFFFF',
  },

  // Nav buttons
  navButtons: {
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },

  // Crisis section (always visible)
  crisisSection: {
    marginTop: 32,
    marginHorizontal: 20,
    gap: 10,
  },
  crisisHeader: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  crisisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 12,
    padding: 14,
  },
  crisisInfo: {
    flex: 1,
  },
  crisisName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  crisisSub: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  crisisCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SOS_GLOW_STRONG,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  crisisCallText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: TEXT_PRIMARY,
    lineHeight: 16,
  },
  crisisTextBtn: {
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  crisisTextBtnLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: TEXT_PRIMARY,
    lineHeight: 16,
  },
  emergencyContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SOS_RED_EMPHASIS,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 4,
  },
  emergencyContactsBtnText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },

  // Disclaimer
  disclaimer: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 10,
    lineHeight: 16,
    color: TEXT_MUTED,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 20,
  },
});
