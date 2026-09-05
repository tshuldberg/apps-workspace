import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  calculateStars,
  checkMatch,
  generateBoard,
  getMatchBest,
  listDecks,
  listCardsForDeck,
  saveMatchResult,
  updateMatchBest,
  type MatchTile,
} from '@mylife/flash';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.flash;
const BOARD_SIZES = [12, 16] as const;

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function FlashMatchGameScreen() {
  const db = useDatabase();
  const router = useRouter();
  const decks = useMemo(() => listDecks(db), [db]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(decks[0]?.id ?? null);
  const [boardSize, setBoardSize] = useState<(typeof BOARD_SIZES)[number]>(12);
  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summaryStars, setSummaryStars] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null;
  const best = useMemo(
    () => (selectedDeck ? getMatchBest(db, selectedDeck.id, boardSize) : null),
    [db, selectedDeck, boardSize, summaryStars],
  );

  useEffect(() => {
    if (!startAt || summaryStars !== null) {
      return undefined;
    }

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startAt);
    }, 200);

    return () => clearInterval(timer);
  }, [startAt, summaryStars]);

  function startGame(nextDeckId = selectedDeckId, nextBoardSize = boardSize) {
    if (!nextDeckId) {
      return;
    }

    try {
      const cards = listCardsForDeck(db, nextDeckId);
      const board = generateBoard(cards, nextBoardSize);
      setTiles(board.tiles);
      setFlippedIds([]);
      setMatchedCardIds([]);
      setMoves(0);
      setMistakes(0);
      setElapsedMs(0);
      setSummaryStars(null);
      setStartAt(Date.now());
      setErrorMessage(null);
    } catch (error) {
      setTiles([]);
      setStartAt(null);
      setSummaryStars(null);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start the game.');
    }
  }

  function finishGame() {
    if (!selectedDeck || !startAt) {
      return;
    }

    const totalElapsed = Date.now() - startAt;
    const stars = calculateStars(boardSize, totalElapsed, mistakes);
    saveMatchResult(db, uuid(), {
      deckId: selectedDeck.id,
      boardSize,
      timeMs: totalElapsed,
      mistakes,
      stars,
      cardIds: tiles.map((tile) => tile.cardId),
    });

    const currentBest = getMatchBest(db, selectedDeck.id, boardSize);
    if (!currentBest || stars > currentBest.bestStars || (stars === currentBest.bestStars && totalElapsed < currentBest.bestTimeMs)) {
      updateMatchBest(db, selectedDeck.id, boardSize, totalElapsed, stars);
    }

    setElapsedMs(totalElapsed);
    setSummaryStars(stars);
  }

  function handlePress(tile: MatchTile) {
    if (summaryStars !== null) {
      return;
    }
    if (matchedCardIds.includes(tile.cardId) || flippedIds.includes(tile.tileId) || flippedIds.length === 2) {
      return;
    }

    const nextFlipped = [...flippedIds, tile.tileId];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length !== 2) {
      return;
    }

    setMoves((value) => value + 1);
    const first = tiles.find((current) => current.tileId === nextFlipped[0]);
    const second = tiles.find((current) => current.tileId === nextFlipped[1]);
    if (!first || !second) {
      setFlippedIds([]);
      return;
    }

    setTimeout(() => {
      if (checkMatch(first, second)) {
        setMatchedCardIds((current) => {
          const nextMatched = [...current, first.cardId];
          if (nextMatched.length === tiles.length / 2) {
            finishGame();
          }
          return nextMatched;
        });
      } else {
        setMistakes((value) => value + 1);
      }
      setFlippedIds([]);
    }, 650);
  }

  const columns = boardSize === 16 ? 4 : 3;
  const tileWidth = columns === 4 ? '23.5%' : '31.5%';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.hero}>
        <Text variant="label" color={ACCENT}>MATCH GAME</Text>
        <Text variant="heading">Flip, pair, and lock in fast recall.</Text>
        <Text variant="body" color={colors.textSecondary}>
          Match prompts to answers from a live deck. Lower moves and fewer misses earn more stars.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Deck</Text>
        <View style={styles.chipRow}>
          {decks.map((deck) => {
            const selected = deck.id === selectedDeckId;
            return (
              <Pressable
                key={deck.id}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setSelectedDeckId(deck.id)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {deck.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.chipRow, { marginTop: spacing.md }]}>
          {BOARD_SIZES.map((size) => {
            const selected = size === boardSize;
            return (
              <Pressable
                key={size}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setBoardSize(size)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {size} tiles
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.heroActions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => startGame()}
            disabled={!selectedDeckId}
          >
            <Text variant="label" color={colors.background}>Start Round</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/(flash)/study')}>
            <Text variant="label" color={ACCENT}>Back to Study</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        {errorMessage ? (
          <Text variant="caption" color={colors.danger}>
            {errorMessage}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <Stat label="Time" value={formatMs(elapsedMs)} />
          <Stat label="Moves" value={String(moves)} />
          <Stat label="Mistakes" value={String(mistakes)} />
          <Stat label="Best" value={best ? `${formatMs(best.bestTimeMs)} · ${best.bestStars}★` : '--'} />
        </View>
      </Card>

      <Card>
        {tiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="subheading">Pick a deck and start a round.</Text>
            <Text variant="body" color={colors.textSecondary}>
              You need at least three eligible cards in a deck to play Match Game.
            </Text>
          </View>
        ) : (
          <View style={styles.board}>
            {tiles.map((tile) => {
              const isMatched = matchedCardIds.includes(tile.cardId);
              const isFlipped = isMatched || flippedIds.includes(tile.tileId);
              return (
                <Pressable
                  key={tile.tileId}
                  style={[
                    styles.tile,
                    { width: tileWidth },
                    isFlipped && styles.tileFlipped,
                    isMatched && styles.tileMatched,
                  ]}
                  onPress={() => handlePress(tile)}
                >
                  <Text
                    variant="caption"
                    color={isFlipped ? colors.text : colors.textTertiary}
                    style={styles.tileText}
                  >
                    {isFlipped ? tile.text : 'Tap to flip'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {summaryStars !== null && (
        <Card style={styles.summaryCard}>
          <Text variant="subheading">Round complete</Text>
          <Text style={styles.summaryStars}>{'★'.repeat(summaryStars)}{'☆'.repeat(3 - summaryStars)}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {selectedDeck?.name} · {formatMs(elapsedMs)} · {moves} moves · {mistakes} mistakes
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={() => startGame()}>
              <Text variant="label" color={colors.background}>Play Again</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/(flash)/study')}>
              <Text variant="label" color={ACCENT}>Back to Study</Text>
            </Pressable>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.md,
    borderColor: 'rgba(139,92,246,0.2)',
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    backgroundColor: 'rgba(139,92,246,0.08)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: {
    color: ACCENT,
    fontSize: 24,
    fontWeight: '700',
  },
  emptyState: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  tile: {
    width: '31%',
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFlipped: {
    borderColor: 'rgba(139,92,246,0.28)',
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  tileMatched: {
    borderColor: colors.success,
    backgroundColor: 'rgba(48,209,88,0.14)',
  },
  tileText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  summaryCard: {
    gap: spacing.md,
    alignItems: 'center',
  },
  summaryStars: {
    color: ACCENT,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
