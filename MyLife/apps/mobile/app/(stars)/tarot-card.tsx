import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  GlassCard,
  MaterialSymbol,
  ST_ACCENT_LIGHT,
  ST_COSMIC_GLOW_STYLE,
  ST_FONTS,
  ST_SURFACES,
  type StarsMaterialSymbolName,
  TarotCardTile,
  drawRandomCard,
  getBirthProfiles,
  getDailyReading,
  getDeterministicTarotOrientation,
  getMoonPhase,
  getMoonSign,
  getTarotCardOfDay,
  getZodiacSign,
  saveDailyReading,
  type TarotCard,
} from '@mylife/stars';
import { buildDailySummary, formatLongDate, resolveDailyTarotCard } from './tarot-helpers';

const ROMAN_NUMERALS = [
  '0',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
  'XXI',
];

type SectionKey = 'upright' | 'reversed' | 'lenses';

interface DailyTarotDraw {
  card: TarotCard;
  reversed: boolean;
  prompt: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function AccordionSection({
  title,
  icon,
  open,
  onPress,
  children,
}: {
  title: string;
  icon: StarsMaterialSymbolName;
  open: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <GlassCard variant="low" style={styles.sectionCard} contentStyle={styles.sectionContent}>
      <Pressable onPress={onPress} style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialSymbol name={icon} size={18} color={ST_ACCENT_LIGHT} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <MaterialSymbol
          name={open ? 'expand_less' : 'expand_more'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </GlassCard>
  );
}

export default function TarotCardScreen() {
  const db = useDatabase();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const flipProgress = useRef(new Animated.Value(0)).current;
  const [activeSections, setActiveSections] = useState<Record<SectionKey, boolean>>({
    upright: true,
    reversed: false,
    lenses: false,
  });
  const [currentDraw, setCurrentDraw] = useState<DailyTarotDraw | null>(null);
  const [pendingDraw, setPendingDraw] = useState<DailyTarotDraw | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const profiles = useMemo(() => getBirthProfiles(db), [db, refreshTick]);
  const primaryProfile = profiles[0] ?? null;

  const storedReading = useMemo(() => {
    if (!primaryProfile) {
      return null;
    }

    return getDailyReading(db, primaryProfile.id, today);
  }, [db, primaryProfile, today, refreshTick]);

  const sunSign = useMemo(() => getZodiacSign(today), [today]);
  const moonSign = useMemo(() => getMoonSign(today), [today]);
  const moonPhase = useMemo(() => getMoonPhase(today), [today]);
  const placeholderCard = useMemo(() => getTarotCardOfDay(today), [today]);

  useEffect(() => {
    if (storedReading) {
      const card = resolveDailyTarotCard(storedReading, today);
      setCurrentDraw({
        card,
        reversed:
          storedReading.tarotIsReversed ?? getDeterministicTarotOrientation(`${today}-reverse`),
        prompt: storedReading.journalPrompt ?? card.prompt,
      });
      flipProgress.setValue(1);
      return;
    }

    setCurrentDraw(null);
    setPendingDraw(null);
    flipProgress.setValue(0);
  }, [
    flipProgress,
    storedReading?.id,
    storedReading?.tarotCardId,
    storedReading?.tarotCard,
    storedReading?.tarotIsReversed,
    storedReading?.journalPrompt,
    today,
  ]);

  const visibleDraw = pendingDraw ?? currentDraw;
  const canDraw = !isAnimating;

  const frontRotation = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotation = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const persistDraw = useCallback(
    (nextDraw: DailyTarotDraw) => {
      if (!primaryProfile) {
        return;
      }

      try {
        saveDailyReading(db, storedReading?.id ?? uuid(), {
          profileId: primaryProfile.id,
          date: today,
          moonPhase,
          moonSign,
          summary: buildDailySummary(nextDraw.card, nextDraw.reversed),
          tarotCard: nextDraw.card.name,
          tarotCardId: nextDraw.card.id,
          tarotIsReversed: nextDraw.reversed,
          journalPrompt: nextDraw.prompt,
        });
        setRefreshTick((value) => value + 1);
      } catch {
        Alert.alert('Save Failed', 'The daily draw could not be stored on this device.');
      }
    },
    [db, moonPhase, moonSign, primaryProfile, storedReading?.id, today],
  );

  const runDrawAnimation = useCallback(
    (nextDraw: DailyTarotDraw) => {
      setPendingDraw(nextDraw);
      setIsAnimating(true);
      flipProgress.setValue(0);

      Animated.timing(flipProgress, {
        toValue: 1,
        duration: 820,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setCurrentDraw(nextDraw);
        setPendingDraw(null);
        setIsAnimating(false);
        persistDraw(nextDraw);
      });
    },
    [flipProgress, persistDraw],
  );

  const handleDraw = useCallback(() => {
    if (!canDraw) {
      return;
    }

    const card = getTarotCardOfDay(today);
    runDrawAnimation({
      card,
      reversed: getDeterministicTarotOrientation(`${today}-daily`),
      prompt: card.prompt,
    });
  }, [canDraw, runDrawAnimation, today]);

  const handleRedraw = useCallback(() => {
    if (!canDraw || !visibleDraw) {
      return;
    }

    Alert.alert(
      'Draw Again?',
      'This replaces today’s saved card and meaning.',
      [
        { text: 'Keep Current', style: 'cancel' },
        {
          text: 'Redraw',
          style: 'destructive',
          onPress: () => {
            const card = drawRandomCard({ excludeIds: [visibleDraw.card.id] });
            runDrawAnimation({
              card,
              reversed: Math.random() > 0.5,
              prompt: card.prompt,
            });
          },
        },
      ],
    );
  }, [canDraw, runDrawAnimation, visibleDraw]);

  const toggleSection = useCallback((section: SectionKey) => {
    setActiveSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const cardMeta = useMemo(() => {
    if (!visibleDraw) {
      return 'Awaiting your draw';
    }

    if (visibleDraw.card.suit) {
      return `${visibleDraw.card.suit} • ${visibleDraw.card.number}`;
    }

    return `Major Arcana • ${ROMAN_NUMERALS[visibleDraw.card.number] ?? visibleDraw.card.number}`;
  }, [visibleDraw]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>Daily Guidance</Text>
        <Text style={styles.title}>Card of the Day</Text>
        <Text style={styles.subtitle}>{formatLongDate(today)}</Text>
      </View>

      <GlassCard variant="high" style={styles.heroShell} contentStyle={styles.heroContent}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroLabel}>TODAY'S SKY</Text>
            <Text style={styles.heroValue}>
              Sun in {capitalize(sunSign)} • Moon in {capitalize(moonSign)}
            </Text>
          </View>
          <View style={styles.phasePill}>
            <MaterialSymbol name="brightness_2" size={16} color={ST_ACCENT_LIGHT} />
            <Text style={styles.phasePillText}>{moonPhase.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.flipStage}>
          <View style={styles.glowOrb} />
          <View style={styles.flipFrame}>
            <Animated.View
              style={[
                styles.flipFace,
                { transform: [{ perspective: 1200 }, { rotateY: frontRotation }] },
              ]}
            >
              <TarotCardTile card={placeholderCard} faceDown size="hero" />
            </Animated.View>

            {visibleDraw ? (
              <Animated.View
                style={[
                  styles.flipFace,
                  styles.flipBackFace,
                  { transform: [{ perspective: 1200 }, { rotateY: backRotation }] },
                ]}
              >
                <TarotCardTile
                  card={visibleDraw.card}
                  reversed={visibleDraw.reversed}
                  size="hero"
                  style={ST_COSMIC_GLOW_STYLE}
                />
              </Animated.View>
            ) : null}
          </View>
        </View>

        <View style={styles.heroBottomCopy}>
          <Text style={styles.cardMeta}>{cardMeta}</Text>
          <Text style={styles.cardTitle}>
            {visibleDraw ? visibleDraw.card.name : 'Draw your card when the archive feels ready'}
          </Text>
          <Text style={styles.cardBody}>
            {visibleDraw
              ? buildDailySummary(visibleDraw.card, visibleDraw.reversed)
              : 'Your daily card stays saved once you draw it. Add a birth profile if you want the draw stored in your private history.'}
          </Text>
        </View>

        {!currentDraw ? (
          <Pressable
            style={[styles.primaryButton, !canDraw && styles.buttonDisabled]}
            onPress={handleDraw}
            disabled={!canDraw}
          >
            <MaterialSymbol name="style" size={18} color={ST_SURFACES.lowest} filled />
            <Text style={styles.primaryButtonText}>Draw Your Card</Text>
          </Pressable>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.secondaryButton, !canDraw && styles.buttonDisabled]}
              onPress={handleRedraw}
              disabled={!canDraw}
            >
              <MaterialSymbol name="autorenew" size={18} color={ST_ACCENT_LIGHT} />
              <Text style={styles.secondaryButtonText}>Draw Again</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(stars)/readings-history' as never)}
            >
              <MaterialSymbol name="history" size={18} color={ST_ACCENT_LIGHT} />
              <Text style={styles.secondaryButtonText}>History</Text>
            </Pressable>
          </View>
        )}
      </GlassCard>

      {!primaryProfile ? (
        <GlassCard variant="low" contentStyle={styles.infoCard}>
          <Text style={styles.infoTitle}>Save draws to your archive</Text>
          <Text style={styles.infoBody}>
            Add a birth profile to keep daily cards, journal prompts, and full spread readings in your private history.
          </Text>
          <Pressable
            style={styles.inlineButton}
            onPress={() => router.push('/(stars)/add-profile' as never)}
          >
            <Text style={styles.inlineButtonText}>Add Profile</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      {visibleDraw ? (
        <>
          <View style={styles.keywordRow}>
            {visibleDraw.card.keywords.map((keyword) => (
              <View key={keyword} style={styles.keywordChip}>
                <Text style={styles.keywordText}>{keyword}</Text>
              </View>
            ))}
          </View>

          <AccordionSection
            title="Upright Meaning"
            icon="north"
            open={activeSections.upright}
            onPress={() => toggleSection('upright')}
          >
            <Text style={styles.sectionText}>{visibleDraw.card.uprightMeaning}</Text>
          </AccordionSection>

          <AccordionSection
            title="Reversed Meaning"
            icon="south"
            open={activeSections.reversed}
            onPress={() => toggleSection('reversed')}
          >
            <Text style={styles.sectionText}>{visibleDraw.card.reversedMeaning}</Text>
          </AccordionSection>

          <AccordionSection
            title="Love, Career, Spiritual"
            icon="auto_awesome"
            open={activeSections.lenses}
            onPress={() => toggleSection('lenses')}
          >
            <View style={styles.lensStack}>
              <View style={styles.lensCard}>
                <Text style={styles.lensLabel}>Love</Text>
                <Text style={styles.sectionText}>{visibleDraw.card.loveMeaning}</Text>
              </View>
              <View style={styles.lensCard}>
                <Text style={styles.lensLabel}>Career</Text>
                <Text style={styles.sectionText}>{visibleDraw.card.careerMeaning}</Text>
              </View>
              <View style={styles.lensCard}>
                <Text style={styles.lensLabel}>Spiritual</Text>
                <Text style={styles.sectionText}>{visibleDraw.card.spiritualMeaning}</Text>
              </View>
            </View>
          </AccordionSection>

          <GlassCard variant="high" style={styles.promptCard} contentStyle={styles.promptContent}>
            <Text style={styles.promptEyebrow}>Journal Prompt</Text>
            <Text style={styles.promptText}>{visibleDraw.prompt}</Text>
            <View style={styles.promptActions}>
              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  router.push(
                    `/(stars)/journal-compose?prompt=${encodeURIComponent(
                      visibleDraw.prompt,
                    )}&tag=tarot&card=${encodeURIComponent(visibleDraw.card.name)}` as never,
                  )
                }
              >
                <MaterialSymbol name="edit" size={18} color={ST_SURFACES.lowest} filled />
                <Text style={styles.primaryButtonText}>Write in Journal</Text>
              </Pressable>
              <Pressable
                style={styles.inlineButton}
                onPress={() => router.push('/(stars)/tarot-reading' as never)}
              >
                <Text style={styles.inlineButtonText}>Open Full Spread</Text>
              </Pressable>
            </View>
          </GlassCard>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.lowest,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerCopy: {
    gap: 4,
    marginTop: spacing.xs,
  },
  eyebrow: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.text,
  },
  subtitle: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  heroShell: {
    overflow: 'visible',
  },
  heroContent: {
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  heroLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  phasePillText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
  flipStage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 390,
  },
  glowOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
    transform: [{ scale: 1.15 }],
  },
  flipFrame: {
    width: 236,
    height: 348,
  },
  flipFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    backfaceVisibility: 'hidden',
  },
  flipBackFace: {
    zIndex: 2,
  },
  heroBottomCopy: {
    gap: 6,
  },
  cardMeta: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
  },
  cardBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    backgroundColor: ST_ACCENT_LIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_SURFACES.lowest,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: ST_SURFACES.high,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoCard: {
    gap: spacing.sm,
  },
  infoTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  infoBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  inlineButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 13,
    color: ST_ACCENT_LIGHT,
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: ST_SURFACES.high,
  },
  keywordText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  sectionCard: {
    borderRadius: 20,
  },
  sectionContent: {
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  sectionText: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  lensStack: {
    gap: spacing.sm,
  },
  lensCard: {
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 6,
  },
  lensLabel: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  promptCard: {
    overflow: 'visible',
  },
  promptContent: {
    gap: spacing.md,
  },
  promptEyebrow: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  promptText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
  },
  promptActions: {
    gap: spacing.sm,
  },
});
