import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import {
  browseFlashcards,
  buryFlashcard,
  listDecks,
  listFlashTags,
  starFlashcard,
  suspendFlashcard,
  unsuspendFlashcard,
  unstarFlashcard,
} from '@mylife/flash';
import type { FlashBrowserSort } from '@mylife/flash';
import { FLASH_MODULE } from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const FLASH_ACCENT = FLASH_MODULE.accentColor;
const SORTS: FlashBrowserSort[] = ['updated', 'due', 'alphabetical', 'lapses'];
const QUICK_FILTERS = [
  { label: 'Due', value: 'is:due' },
  { label: 'New', value: 'is:new' },
  { label: 'Suspended', value: 'is:suspended' },
  { label: 'Buried', value: 'is:buried' },
  { label: 'Leeches', value: 'prop:lapses>7' },
];

function BrowserAction({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.browserAction, tone === 'accent' ? styles.browserActionAccent : null]}
    >
      <Text variant="caption" color={tone === 'accent' ? colors.background : colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FlashBrowserScreen() {
  const db = useDatabase();
  const [query, setQuery] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [sort, setSort] = useState<FlashBrowserSort>('updated');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  const refresh = () => setTick((value) => value + 1);
  const decks = useMemo(() => listDecks(db), [db, tick]);
  const tags = useMemo(() => listFlashTags(db), [db, tick]);
  const cards = useMemo(
    () => browseFlashcards(db, { query, deckId: selectedDeckId, sort, limit: 120 }),
    [db, query, selectedDeckId, sort, tick],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Card Browser</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Search fronts and backs, then narrow with operators like deck:Spanish, tag:exam,
          is:due, or prop:lapses&gt;5.
        </Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search cards or use deck:, tag:, is:, prop:"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.chipRow}>
            {QUICK_FILTERS.map((filter) => {
              const selected = query === filter.value;
              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setQuery((current) => (current === filter.value ? '' : filter.value))}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Deck Scope</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setSelectedDeckId(null)}
            style={[styles.chip, !selectedDeckId ? styles.chipActive : null]}
          >
            <Text variant="caption" color={!selectedDeckId ? colors.background : colors.textSecondary}>
              All decks
            </Text>
          </Pressable>
          {decks.map((deck) => {
            const selected = deck.id === selectedDeckId;
            return (
              <Pressable
                key={deck.id}
                onPress={() => setSelectedDeckId(deck.id)}
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

      <Card>
        <Text variant="subheading">Sort</Text>
        <View style={styles.chipRow}>
          {SORTS.map((option) => {
            const selected = option === sort;
            return (
              <Pressable
                key={option}
                onPress={() => setSort(option)}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Browse Results</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Tags available now: {tags.length > 0 ? tags.join(', ') : 'No tags yet'}
        </Text>
        <View style={styles.list}>
          {cards.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No cards match the current search.
            </Text>
          ) : (
            cards.map((card) => (
              <Card key={card.id} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text variant="body" style={{ flex: 1 }}>{card.front}</Text>
                  <Pressable
                    style={styles.browserSpeaker}
                    hitSlop={12}
                    onPress={() => Speech.speak(card.front)}
                  >
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{'\u{1F50A}'}</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={12}
                    onPress={() => {
                      try {
                        if (card.starred) unstarFlashcard(db, card.id);
                        else starFlashcard(db, card.id);
                      } catch { return; }
                      refresh();
                    }}
                  >
                    <Text style={{ fontSize: 18, color: card.starred ? FLASH_ACCENT : colors.textSecondary }}>
                      {card.starred ? '\u2605' : '\u2606'}
                    </Text>
                  </Pressable>
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {card.deckName} · {card.queue}
                  {card.isDue ? ' · due now' : ''}
                  {card.tags.length > 0 ? ` · ${card.tags.join(', ')}` : ''}
                  {card.lapseCount > 0 ? ` · ${card.lapseCount} lapses` : ''}
                </Text>
                <View style={styles.actionRow}>
                  {card.queue === 'suspended' ? (
                    <BrowserAction
                      label="Unsuspend"
                      tone="accent"
                      onPress={() => {
                        try { unsuspendFlashcard(db, card.id); } catch { Alert.alert('Error', 'Failed to unsuspend card.'); return; }
                        refresh();
                      }}
                    />
                  ) : (
                    <BrowserAction
                      label="Suspend"
                      onPress={() => {
                        try { suspendFlashcard(db, card.id); } catch { Alert.alert('Error', 'Failed to suspend card.'); return; }
                        refresh();
                      }}
                    />
                  )}
                  {card.queue === 'suspended' ? null : (
                    <BrowserAction
                      label={card.queue === 'buried' ? 'Buried' : 'Bury'}
                      onPress={() => {
                        try { buryFlashcard(db, card.id, new Date().toISOString()); } catch { Alert.alert('Error', 'Failed to bury card.'); return; }
                        refresh();
                      }}
                    />
                  )}
                </View>
              </Card>
            ))
          )}
        </View>
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
  list: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  resultCard: {
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  browserAction: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  browserActionAccent: {
    backgroundColor: FLASH_ACCENT,
    borderColor: FLASH_ACCENT,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  browserSpeaker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
