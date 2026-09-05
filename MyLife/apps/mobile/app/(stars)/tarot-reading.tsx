import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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
  ST_FONTS,
  ST_SURFACES,
  type StarsMaterialSymbolName,
  TAROT_SPREADS,
  TarotCardTile,
  drawRandomCards,
  getBirthProfiles,
  getTarotSpreadDefinition,
  saveTarotReading,
  type TarotCard,
  type TarotSpreadDefinition,
  type TarotSpreadType,
} from '@mylife/stars';
import {
  buildPositionInterpretation,
  buildReadingNarrative,
  createTarotTitle,
} from './tarot-helpers';

interface DraftCard {
  card: TarotCard;
  positionLabel: string;
  positionMeaning: string;
  reversed: boolean;
  interpretation: string;
}

interface ActiveReading {
  spread: TarotSpreadDefinition;
  question: string;
  title: string;
  cards: DraftCard[];
  narrative: string;
}

function SpreadTile({
  spread,
  onPress,
}: {
  spread: TarotSpreadDefinition;
  onPress: (spreadType: TarotSpreadType) => void;
}) {
  return (
    <Pressable onPress={() => onPress(spread.type)}>
      <GlassCard variant="low" style={styles.spreadTile} contentStyle={styles.spreadTileContent}>
        <View style={styles.spreadTileIcon}>
          <MaterialSymbol
            name={spread.icon as StarsMaterialSymbolName}
            size={24}
            color={ST_ACCENT_LIGHT}
          />
        </View>
        <View style={styles.spreadTileCopy}>
          <Text style={styles.spreadTileTitle}>{spread.name}</Text>
          <Text style={styles.spreadTileBody}>{spread.description}</Text>
        </View>
        <Text style={styles.spreadTileCount}>{spread.cardCount} cards</Text>
      </GlassCard>
    </Pressable>
  );
}

export default function TarotReadingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const shuffleAnim = useRef(new Animated.Value(0)).current;
  const dealAnimations = useRef<Animated.Value[]>([]);
  const revealAnimations = useRef<Animated.Value[]>([]);
  const [question, setQuestion] = useState('');
  const [reading, setReading] = useState<ActiveReading | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isDealing, setIsDealing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const profiles = useMemo(() => getBirthProfiles(db), [db]);
  const primaryProfile = profiles[0] ?? null;
  const allRevealed = reading ? revealedCount >= reading.cards.length : false;

  const shuffleRotate = shuffleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const beginReading = useCallback(
    (spreadType: TarotSpreadType) => {
      if (isDealing) {
        return;
      }

      const spread = getTarotSpreadDefinition(spreadType);
      const draws = drawRandomCards(spread.cardCount);
      const cards = spread.positions.map((position, index) => {
        const card = draws[index];
        const reversed = Math.random() > 0.5;
        return {
          card,
          positionLabel: position.label,
          positionMeaning: position.meaning,
          reversed,
          interpretation: buildPositionInterpretation(card, position.meaning, reversed),
        };
      });

      const nextReading: ActiveReading = {
        spread,
        question: question.trim(),
        title: createTarotTitle(spread.type, question),
        cards,
        narrative: buildReadingNarrative(
          cards.map((item) => ({
            cardId: item.card.id,
            cardName: item.card.name,
            positionLabel: item.positionLabel,
            positionMeaning: item.positionMeaning,
            reversed: item.reversed,
            interpretation: item.interpretation,
          })),
        ),
      };

      dealAnimations.current = cards.map(() => new Animated.Value(0));
      revealAnimations.current = cards.map(() => new Animated.Value(0));
      setReading(nextReading);
      setRevealedCount(0);
      setIsDealing(true);

      Animated.sequence([
        Animated.loop(
          Animated.sequence([
            Animated.timing(shuffleAnim, {
              toValue: 1,
              duration: 130,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(shuffleAnim, {
              toValue: -1,
              duration: 130,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 },
        ),
        Animated.timing(shuffleAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.stagger(
          90,
          dealAnimations.current.map((value) =>
            Animated.spring(value, {
              toValue: 1,
              speed: 18,
              bounciness: 6,
              useNativeDriver: true,
            }),
          ),
        ),
      ]).start(() => {
        setIsDealing(false);
      });
    },
    [isDealing, question, shuffleAnim],
  );

  const revealCard = useCallback(
    (index: number) => {
      if (!reading || isDealing || index !== revealedCount) {
        return;
      }

      Animated.timing(revealAnimations.current[index], {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setRevealedCount((value) => value + 1);
      });
    },
    [isDealing, reading, revealedCount],
  );

  const handleSave = useCallback(() => {
    if (!reading || !allRevealed || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const readingId = uuid();
      saveTarotReading(db, readingId, {
        profileId: primaryProfile?.id ?? null,
        readingDate: new Date().toISOString().slice(0, 10),
        spreadType: reading.spread.type,
        title: reading.title,
        question: reading.question || null,
        narrative: reading.narrative,
        notes: null,
        cards: reading.cards.map((card) => ({
          cardId: card.card.id,
          cardName: card.card.name,
          positionLabel: card.positionLabel,
          positionMeaning: card.positionMeaning,
          reversed: card.reversed,
          interpretation: card.interpretation,
        })),
      });
      router.push('/(stars)/readings-history' as never);
    } catch {
      setIsSaving(false);
      Alert.alert('Save Failed', 'The spread could not be saved. Try again.');
    }
  }, [allRevealed, db, isSaving, primaryProfile?.id, reading, router]);

  const resetReading = useCallback(() => {
    if (!reading) {
      return;
    }

    Alert.alert(
      'Start Over?',
      'This clears the current spread so you can draw a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: () => {
            setReading(null);
            setRevealedCount(0);
            setIsSaving(false);
          },
        },
      ],
    );
  }, [reading]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>Tarot Reading</Text>
        <Text style={styles.title}>The Celestial Spread</Text>
        <Text style={styles.subtitle}>
          Draw one card or a full spread, then reveal each position in sequence.
        </Text>
      </View>

      {!reading ? (
        <>
          <GlassCard variant="high" contentStyle={styles.questionCard}>
            <View style={styles.questionHeader}>
              <MaterialSymbol name="help" size={18} color={ST_ACCENT_LIGHT} />
              <Text style={styles.questionTitle}>What would you like insight on?</Text>
            </View>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Optional question for the archive"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={styles.questionInput}
            />
          </GlassCard>

          <View style={styles.selectorStack}>
            {TAROT_SPREADS.map((spread) => (
              <SpreadTile key={spread.type} spread={spread} onPress={beginReading} />
            ))}
          </View>
        </>
      ) : (
        <>
          <GlassCard variant="high" style={styles.readingHero} contentStyle={styles.readingHeroContent}>
            <View style={styles.readingHeroTop}>
              <View>
                <Text style={styles.readingHeroLabel}>{reading.spread.shortLabel}</Text>
                <Text style={styles.readingHeroTitle}>{reading.title}</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: shuffleRotate }] }}>
                <View style={styles.deckBadge}>
                  <MaterialSymbol name="style" size={22} color={ST_ACCENT_LIGHT} />
                </View>
              </Animated.View>
            </View>
            <Text style={styles.readingHeroBody}>
              {reading.question || reading.spread.questionPrompt}
            </Text>
          </GlassCard>

          <View style={styles.spreadGrid}>
            {reading.cards.map((item, index) => {
              const dealProgress = dealAnimations.current[index] ?? new Animated.Value(1);
              const revealProgress = revealAnimations.current[index] ?? new Animated.Value(0);
              const faceDown = index >= revealedCount;
              const enabled = index === revealedCount && !isDealing;

              return (
                <Animated.View
                  key={`${item.positionLabel}-${item.card.id}`}
                  style={[
                    styles.cardSlot,
                    {
                      opacity: dealProgress,
                      transform: [
                        {
                          translateY: dealProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [26, 0],
                          }),
                        },
                        {
                          scale: dealProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.92, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.cardPosition}>{item.positionLabel}</Text>
                  <Pressable
                    disabled={!enabled}
                    onPress={() => revealCard(index)}
                    style={!enabled && faceDown ? styles.cardSlotDisabled : undefined}
                  >
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: revealProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.02],
                            }),
                          },
                        ],
                      }}
                    >
                      <TarotCardTile
                        card={item.card}
                        reversed={item.reversed}
                        faceDown={faceDown}
                        size="compact"
                      />
                    </Animated.View>
                  </Pressable>
                  <Text style={styles.cardPositionBody}>{item.positionMeaning}</Text>
                </Animated.View>
              );
            })}
          </View>

          {allRevealed ? (
            <>
              <View style={styles.interpretationStack}>
                {reading.cards.map((item) => (
                  <GlassCard
                    key={`interpretation-${item.positionLabel}-${item.card.id}`}
                    variant="low"
                    contentStyle={styles.interpretationCard}
                  >
                    <Text style={styles.interpretationEyebrow}>{item.positionLabel}</Text>
                    <Text style={styles.interpretationTitle}>
                      {item.card.name}
                      {item.reversed ? ' • Reversed' : ''}
                    </Text>
                    <Text style={styles.interpretationBody}>{item.interpretation}</Text>
                  </GlassCard>
                ))}
              </View>

              <GlassCard variant="high" contentStyle={styles.narrativeCard}>
                <Text style={styles.interpretationEyebrow}>Synthesis</Text>
                <Text style={styles.narrativeText}>{reading.narrative}</Text>
              </GlassCard>

              <View style={styles.footerActions}>
                <Pressable
                  style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <MaterialSymbol name="bookmark" size={18} color={ST_SURFACES.lowest} filled />
                  <Text style={styles.primaryButtonText}>
                    {isSaving ? 'Saving...' : 'Save Reading'}
                  </Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={resetReading}>
                  <MaterialSymbol name="autorenew" size={18} color={ST_ACCENT_LIGHT} />
                  <Text style={styles.secondaryButtonText}>New Spread</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <GlassCard variant="low" contentStyle={styles.revealHintCard}>
              <Text style={styles.revealHintTitle}>Reveal one card at a time</Text>
              <Text style={styles.revealHintBody}>
                Each position opens in sequence so the reading unfolds like a story instead of a dump of symbols.
              </Text>
            </GlassCard>
          )}
        </>
      )}
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
    lineHeight: 20,
  },
  questionCard: {
    gap: spacing.sm,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  questionInput: {
    minHeight: 108,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: ST_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  selectorStack: {
    gap: spacing.sm,
  },
  spreadTile: {
    borderRadius: 22,
  },
  spreadTileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  spreadTileIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spreadTileCopy: {
    flex: 1,
    gap: 4,
  },
  spreadTileTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 17,
    color: colors.text,
  },
  spreadTileBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  spreadTileCount: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  readingHero: {
    overflow: 'visible',
  },
  readingHeroContent: {
    gap: spacing.sm,
  },
  readingHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  readingHeroLabel: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  readingHeroTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginTop: 6,
  },
  readingHeroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  deckBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spreadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  cardSlot: {
    width: '47%',
    gap: 8,
    marginBottom: spacing.md,
  },
  cardSlotDisabled: {
    opacity: 0.95,
  },
  cardPosition: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  cardPositionBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  revealHintCard: {
    gap: spacing.xs,
  },
  revealHintTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  revealHintBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  interpretationStack: {
    gap: spacing.sm,
  },
  interpretationCard: {
    gap: spacing.xs,
  },
  interpretationEyebrow: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  interpretationTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 17,
    color: colors.text,
  },
  interpretationBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  narrativeCard: {
    gap: spacing.sm,
  },
  narrativeText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
  },
  footerActions: {
    gap: spacing.sm,
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
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: ST_SURFACES.high,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
