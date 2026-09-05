import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import {
  buryFlashNote,
  buryFlashcard,
  getFlashDashboard,
  getLastStudiedDeck,
  listDecks,
  listDueFlashcards,
  rateFlashcard,
  starFlashcard,
  suspendFlashcard,
  undoLastRating,
  unstarFlashcard,
} from '@mylife/flash';
import type { CardRating, Flashcard } from '@mylife/flash';
import { FLASH_MODULE } from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const FLASH_ACCENT = FLASH_MODULE.accentColor;
const RATINGS: CardRating[] = ['again', 'hard', 'good', 'easy'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 8;
const CARD_WIDTH = SCREEN_WIDTH - spacing.md * 2 - 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
    </View>
  );
}

export default function FlashStudyScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [lastRatedCardId, setLastRatedCardId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const refresh = () => setTick((value) => value + 1);
  const decks = useMemo(() => listDecks(db), [db, tick]);
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null;
  const dueCards = useMemo(
    () => listDueFlashcards(db, selectedDeck?.id, new Date().toISOString(), 20),
    [db, selectedDeck?.id, tick],
  );
  const carouselCards = dueCards.slice(0, 5);
  const dashboard = useMemo(() => getFlashDashboard(db), [db, tick]);
  const lastStudied = useMemo(() => getLastStudiedDeck(db), [db, tick]);
  const activeCard = carouselCards[activeCardIndex] ?? null;

  // Initialize session total when due cards first load or deck changes
  useEffect(() => {
    if (dueCards.length > 0 && sessionTotal === 0) {
      setSessionTotal(dueCards.length);
    }
  }, [dueCards.length, sessionTotal]);

  // Stop speech on unmount
  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  const speakText = (text: string) => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(text, { onDone: () => setIsSpeaking(false), onStopped: () => setIsSpeaking(false) });
  };

  const resetSession = () => {
    setSessionTotal(0);
    setSessionCompleted(0);
    setLastRatedCardId(null);
  };

  const isRevealed = (cardId: string) => revealedCards.has(cardId);
  const toggleReveal = (cardId: string) => {
    setRevealedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveCardIndex(Math.max(0, Math.min(index, carouselCards.length - 1)));
  }, [carouselCards.length]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: SNAP_INTERVAL,
    offset: SNAP_INTERVAL * index,
    index,
  }), []);

  const renderCard = useCallback(({ item }: { item: Flashcard }) => {
    const revealed = isRevealed(item.id);
    return (
      <Pressable
        style={[styles.flashcard, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
        onPress={() => toggleReveal(item.id)}
      >
        <Pressable
          style={styles.speakerButton}
          hitSlop={12}
          onPress={() => {
            const text = revealed ? (item.back || 'No answer provided') : item.front;
            speakText(text);
          }}
        >
          <Text style={{ fontSize: 16, color: isSpeaking ? FLASH_ACCENT : colors.textSecondary }}>
            {isSpeaking ? '\u23F9' : '\u{1F50A}'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.starButton}
          hitSlop={12}
          onPress={() => {
            try {
              if (item.starred) unstarFlashcard(db, item.id);
              else starFlashcard(db, item.id);
            } catch {
              return;
            }
            refresh();
          }}
        >
          <Text style={{ fontSize: 18, color: item.starred ? FLASH_ACCENT : colors.textSecondary }}>
            {item.starred ? '\u2605' : '\u2606'}
          </Text>
        </Pressable>
        <Text variant="caption" color={colors.textSecondary}>
          {revealed ? 'Answer' : 'Prompt'}
        </Text>
        <Text style={styles.cardText}>{revealed ? item.back || 'No answer yet' : item.front}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {item.cardType}
          {item.tags.length > 0 ? ` · ${item.tags.join(', ')}` : ''}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          Tap card to {revealed ? 'see prompt again' : 'reveal answer'}
        </Text>
      </Pressable>
    );
  }, [revealedCards, db, isSpeaking]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text variant="heading">Flash</Text>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <ScrollView bounces={false}>
              {[
                { label: 'Schedule', route: '/(flash)/schedule' },
                { label: 'Signals', route: '/(flash)/signals' },
                { label: 'Forgetting Curve', route: '/(flash)/forgetting-curve' },
                { label: 'Session Analytics', route: '/(flash)/session-analytics' },
                { label: 'Card Stats', route: '/(flash)/card-stats' },
                { label: 'Card Types', route: '/(flash)/card-types' },
                { label: 'Match Game', route: '/(flash)/match-game' },
                { label: 'Stats', route: '/(flash)/stats' },
                { label: 'Import/Export', route: '/(flash)/import-export' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as never); }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Card>
        <Text variant="subheading">Study Queue</Text>
        <View style={styles.statsGrid}>
          <Stat label="Due Reviews" value={String(dashboard.dueCount)} />
          <Stat label="New Cards" value={String(dashboard.newCount)} />
          <Stat label="Streak" value={String(dashboard.currentStreak)} />
        </View>
      </Card>

      {lastStudied && !selectedDeck && (
        <Card style={styles.jumpBackInCard}>
          <View style={styles.jumpBackInHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">{lastStudied.deckName}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {lastStudied.dueCount} cards remaining
              </Text>
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              Last studied {relativeTime(lastStudied.lastStudiedAt)}
            </Text>
          </View>
          <View style={styles.progressBarOuter}>
            <View
              style={[
                styles.progressBarInner,
                {
                  width: `${Math.min(100, Math.max(0, ((lastStudied.totalCount - lastStudied.dueCount) / Math.max(lastStudied.totalCount, 1)) * 100))}%`,
                },
              ]}
            />
          </View>
          <View style={styles.jumpActions}>
            <Pressable
              style={styles.continueButton}
              onPress={() => {
                setSelectedDeckId(lastStudied.deckId);
                setRevealedCards(new Set());
                setActiveCardIndex(0);
                resetSession();
              }}
            >
              <Text variant="label" color={colors.background}>Continue</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryJumpButton}
              onPress={() => router.push('/(flash)/match-game')}
            >
              <Text variant="label" color={FLASH_ACCENT}>Play Match</Text>
            </Pressable>
          </View>
        </Card>
      )}

      <Card>
        <Text variant="subheading">Deck Filter</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => {
              setSelectedDeckId(null);
              setRevealedCards(new Set());
              setActiveCardIndex(0);
              resetSession();
            }}
            style={[styles.chip, !selectedDeck ? styles.chipActive : null]}
          >
            <Text variant="caption" color={!selectedDeck ? colors.background : colors.textSecondary}>
              All decks
            </Text>
          </Pressable>
          {decks.map((deck) => {
            const selected = deck.id === selectedDeck?.id;
            return (
              <Pressable
                key={deck.id}
                onPress={() => {
                  setSelectedDeckId(deck.id);
                  setRevealedCards(new Set());
                  setActiveCardIndex(0);
                  resetSession();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {deck.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {sessionTotal > 0 && (
        <View style={styles.sessionProgress}>
          <Text variant="subheading" color={FLASH_ACCENT}>
            {sessionCompleted}/{sessionTotal}
          </Text>
          <View style={styles.sessionBarOuter}>
            <View
              style={[
                styles.sessionBarInner,
                { width: `${Math.min(100, Math.max(0, (sessionCompleted / sessionTotal) * 100))}%` },
              ]}
            />
          </View>
          {sessionCompleted === sessionTotal && (
            <View style={styles.sessionCompleteRow}>
              <Text variant="subheading" color={colors.success}>Session complete!</Text>
              <Pressable
                style={styles.studyMoreButton}
                onPress={() => {
                  resetSession();
                  refresh();
                }}
              >
                <Text variant="label" color={colors.background}>Study more</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Card>
        <Text variant="subheading">
          {selectedDeck ? `${selectedDeck.name} study` : 'Next card'}
        </Text>
        {carouselCards.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>
            All caught up for now. Add more cards in Decks or come back when reviews are due.
          </Text>
        ) : (
          <View style={styles.studyArea}>
            <Text variant="caption" color={colors.textSecondary}>
              Card {activeCardIndex + 1} of {carouselCards.length}
            </Text>

            <FlatList
              ref={flatListRef}
              data={carouselCards}
              keyExtractor={(item) => item.id}
              renderItem={renderCard}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              snapToInterval={SNAP_INTERVAL}
              decelerationRate="fast"
              getItemLayout={getItemLayout}
              onMomentumScrollEnd={onScrollEnd}
              contentContainerStyle={{ paddingRight: 16 }}
            />

            <View style={styles.dotRow}>
              {carouselCards.map((card, i) => (
                <View
                  key={card.id}
                  style={[styles.dot, i === activeCardIndex ? styles.dotActive : null]}
                />
              ))}
            </View>

            {activeCard && (
              <>
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      try {
                        suspendFlashcard(db, activeCard.id);
                      } catch {
                        Alert.alert('Error', 'Failed to suspend card.');
                        return;
                      }
                      setRevealedCards(new Set());
                      setActiveCardIndex(0);
                      refresh();
                    }}
                  >
                    <Text variant="caption" color={colors.textSecondary}>Suspend</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      try {
                        buryFlashcard(db, activeCard.id, new Date().toISOString());
                      } catch {
                        Alert.alert('Error', 'Failed to bury card.');
                        return;
                      }
                      setRevealedCards(new Set());
                      setActiveCardIndex(0);
                      refresh();
                    }}
                  >
                    <Text variant="caption" color={colors.textSecondary}>Bury Card</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      try {
                        buryFlashNote(db, activeCard.id, new Date().toISOString());
                      } catch {
                        Alert.alert('Error', 'Failed to bury note.');
                        return;
                      }
                      setRevealedCards(new Set());
                      setActiveCardIndex(0);
                      refresh();
                    }}
                  >
                    <Text variant="caption" color={colors.textSecondary}>Bury Note</Text>
                  </Pressable>
                  {lastRatedCardId && (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        try {
                          const result = undoLastRating(db, lastRatedCardId);
                          if (!result.undone) {
                            Alert.alert('Undo', 'Nothing to undo.');
                            return;
                          }
                        } catch {
                          Alert.alert('Error', 'Failed to undo.');
                          return;
                        }
                        setLastRatedCardId(null);
                        setSessionCompleted((v) => Math.max(0, v - 1));
                        setRevealedCards(new Set());
                        setActiveCardIndex(0);
                        refresh();
                      }}
                    >
                      <Text variant="caption" color={colors.textSecondary}>Undo</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.ratingRow}>
                  {RATINGS.map((rating) => {
                    const revealed = isRevealed(activeCard.id);
                    return (
                      <Pressable
                        key={rating}
                        disabled={!revealed}
                        style={[styles.ratingButton, !revealed ? styles.ratingButtonDisabled : null]}
                        onPress={() => {
                          try {
                            rateFlashcard(db, activeCard.id, rating, new Date().toISOString());
                          } catch {
                            Alert.alert('Error', 'Failed to rate card.');
                            return;
                          }
                          setLastRatedCardId(activeCard.id);
                          setSessionCompleted((v) => v + 1);
                          setRevealedCards(new Set());
                          setActiveCardIndex(0);
                          refresh();
                        }}
                      >
                        <Text variant="label" color={revealed ? colors.background : colors.textSecondary}>
                          {rating.charAt(0).toUpperCase() + rating.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    minWidth: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: {
    color: FLASH_ACCENT,
    fontSize: 28,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: FLASH_ACCENT,
    borderColor: FLASH_ACCENT,
  },
  studyArea: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  flashcard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    minHeight: 220,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardText: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: FLASH_ACCENT,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ratingButton: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: 12,
    backgroundColor: FLASH_ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  ratingButtonDisabled: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  jumpBackInCard: {
    borderLeftWidth: 4,
    borderLeftColor: FLASH_ACCENT,
  },
  jumpBackInHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressBarOuter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing.sm,
  },
  progressBarInner: {
    height: 6,
    borderRadius: 3,
    backgroundColor: FLASH_ACCENT,
  },
  continueButton: {
    backgroundColor: FLASH_ACCENT,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    flex: 1,
  },
  jumpActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryJumpButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    backgroundColor: 'rgba(139,92,246,0.08)',
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sessionProgress: {
    gap: spacing.xs,
  },
  sessionBarOuter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated,
    width: '100%',
  },
  sessionBarInner: {
    height: 4,
    borderRadius: 2,
    backgroundColor: FLASH_ACCENT,
  },
  sessionCompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  studyMoreButton: {
    backgroundColor: FLASH_ACCENT,
    borderRadius: 12,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  starButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  speakerButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
