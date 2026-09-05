import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { createDeck, createFlashcards, listCardsForDeck, listDecks } from '@mylife/flash';
import type { FlashCardType } from '@mylife/flash';
import { FLASH_MODULE } from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const FLASH_ACCENT = FLASH_MODULE.accentColor;
const CARD_TYPES: FlashCardType[] = ['basic', 'reversed', 'cloze'];

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function FlashDecksScreen() {
  const db = useDatabase();
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [cardType, setCardType] = useState<FlashCardType>('basic');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((value) => value + 1);
  const decks = useMemo(() => listDecks(db), [db, tick]);
  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null,
    [decks, selectedDeckId],
  );
  const cards = useMemo(
    () => (selectedDeck ? listCardsForDeck(db, selectedDeck.id).slice(0, 8) : []),
    [db, selectedDeck, tick],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Creation Modes</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Basic creates one prompt-answer card. Reversed creates both directions. Cloze builds
          one card per marker, using syntax like {'{{c1::answer}}'}.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Create Deck</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={deckName}
            onChangeText={setDeckName}
            placeholder="Deck name"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={deckDescription}
            onChangeText={setDeckDescription}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!deckName.trim()) {
                return;
              }

              try {
                const id = uuid();
                createDeck(db, id, {
                  name: deckName.trim(),
                  description: deckDescription.trim() || null,
                });
                setDeckName('');
                setDeckDescription('');
                setSelectedDeckId(id);
                refresh();
              } catch {
                Alert.alert('Error', 'Failed to create deck. Name may already exist.');
              }
            }}
          >
            <Text variant="label" color={colors.background}>Save Deck</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Deck Browser</Text>
        <View style={styles.list}>
          {decks.map((deck) => {
            const selected = deck.id === selectedDeck?.id;
            return (
              <Pressable
                key={deck.id}
                onPress={() => setSelectedDeckId(deck.id)}
                style={[styles.innerCard, selected ? styles.innerCardSelected : null]}
              >
                <Text variant="body">{deck.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {deck.cardCount} cards · {deck.newCount} new · {deck.dueCount} due
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Add Cards</Text>
        {!selectedDeck ? (
          <Text variant="caption" color={colors.textSecondary}>
            Create or select a deck first.
          </Text>
        ) : (
          <View style={styles.formGrid}>
            <Text variant="caption" color={colors.textSecondary}>
              Target deck: {selectedDeck.name}
            </Text>
            <View style={styles.chipRow}>
              {CARD_TYPES.map((option) => {
                const selected = option === cardType;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCardType(option)}
                    style={[styles.chip, selected ? styles.chipActive : null]}
                  >
                    <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              value={front}
              onChangeText={setFront}
              placeholder={cardType === 'cloze' ? 'Prompt with {{c1::answer}} markers' : 'Front'}
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.input, styles.bodyInput]}
              value={back}
              onChangeText={setBack}
              placeholder={cardType === 'cloze' ? 'Extra explanation shown on the answer side' : 'Back'}
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
            {cardType === 'cloze' ? (
              <Text variant="caption" color={colors.textSecondary}>
                Example: {'{{c1::Paris}} is the capital of {{c2::France}}'}
              </Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="Tags, comma separated"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                if (!selectedDeck || !front.trim()) {
                  return;
                }

                try {
                  createFlashcards(db, {
                    deckId: selectedDeck.id,
                    front: front.trim(),
                    back: back.trim(),
                    tags: splitTags(tags),
                    cardType,
                  });
                  setFront('');
                  setBack('');
                  setTags('');
                  refresh();
                } catch {
                  Alert.alert('Error', cardType === 'cloze' ? 'Invalid cloze syntax. Use {{c1::answer}} markers.' : 'Failed to create card.');
                }
              }}
            >
              <Text variant="label" color={colors.background}>Save Card</Text>
            </Pressable>
          </View>
        )}
      </Card>

      {selectedDeck ? (
        <Card>
          <Text variant="subheading">{selectedDeck.name} Recent Cards</Text>
          <View style={styles.list}>
            {cards.length === 0 ? (
              <Text variant="caption" color={colors.textSecondary}>
                No cards yet in this deck.
              </Text>
            ) : (
              cards.map((card) => (
                <Card key={card.id} style={styles.innerCard}>
                  <Text variant="body">{card.front}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {card.cardType}
                    {card.queue !== 'new' ? ` · ${card.queue}` : ''}
                    {card.templateOrdinal === 1 ? ' · reverse' : ''}
                    {card.cardType === 'cloze' ? ` · cloze ${card.templateOrdinal + 1}` : ''}
                    {card.tags.length > 0 ? ` · ${card.tags.join(', ')}` : ''}
                  </Text>
                </Card>
              ))
            )}
          </View>
        </Card>
      ) : null}
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
  formGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  bodyInput: {
    minHeight: 120,
  },
  primaryButton: {
    backgroundColor: FLASH_ACCENT,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  innerCard: {
    gap: spacing.xs,
  },
  innerCardSelected: {
    borderWidth: 1,
    borderColor: FLASH_ACCENT,
  },
});
