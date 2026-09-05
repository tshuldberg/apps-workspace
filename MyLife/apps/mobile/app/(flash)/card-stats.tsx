import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  browseFlashcards,
  type FlashBrowserCard,
} from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#9B7DDB';

type SortKey = 'ease' | 'interval' | 'lapses';

function queueColor(queue: string): string {
  switch (queue) {
    case 'new': return '#3498DB';
    case 'learning': return '#FF9F0A';
    case 'review': return colors.success;
    case 'suspended': return colors.textTertiary;
    case 'buried': return colors.textTertiary;
    default: return colors.textSecondary;
  }
}

export default function CardStatsScreen() {
  const db = useDatabase();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('ease');

  const allCards: FlashBrowserCard[] = useMemo(() => {
    try { return browseFlashcards(db, {}); } catch { return []; }
  }, [db]);

  const filtered = useMemo(() => {
    let cards = [...allCards];
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter((c) =>
        c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q),
      );
    }
    switch (sortBy) {
      case 'ease':
        cards.sort((a, b) => a.ease - b.ease);
        break;
      case 'interval':
        cards.sort((a, b) => b.intervalDays - a.intervalDays);
        break;
      case 'lapses':
        cards.sort((a, b) => b.lapseCount - a.lapseCount);
        break;
    }
    return cards;
  }, [allCards, search, sortBy]);

  // Leech detection
  const leeches = useMemo(
    () => allCards.filter((c) => c.lapseCount >= 4),
    [allCards],
  );

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'ease', label: 'Hardest' },
    { key: 'lapses', label: 'Most Lapsed' },
    { key: 'interval', label: 'Longest Interval' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Card Stats</Text>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search cards..."
        placeholderTextColor={colors.textTertiary}
      />

      {/* Sort options */}
      <View style={styles.chipRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.chip, sortBy === opt.key && { backgroundColor: ACCENT }]}
            onPress={() => setSortBy(opt.key)}
          >
            <Text variant="caption" color={sortBy === opt.key ? colors.background : colors.textSecondary}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Problem cards (leeches) */}
      {leeches.length > 0 && (
        <Card>
          <Text variant="label" color={colors.danger}>PROBLEM CARDS ({leeches.length})</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Cards with 4+ lapses that may need attention
          </Text>
          {leeches.slice(0, 5).map((card) => (
            <View key={card.id} style={styles.cardRow}>
              <View style={styles.cardInfo}>
                <Text variant="body" numberOfLines={1}>{card.front}</Text>
                <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                  {card.back}
                </Text>
              </View>
              <Text variant="caption" color={colors.danger}>
                {card.lapseCount} lapses
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Card list */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>
          ALL CARDS ({filtered.length})
        </Text>
        {filtered.slice(0, 30).map((card) => (
          <View key={card.id} style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Text variant="body" numberOfLines={1}>{card.front}</Text>
              <View style={styles.cardMeta}>
                <View style={[styles.queueBadge, { backgroundColor: queueColor(card.queue) }]}>
                  <Text variant="iconCaption" color={colors.background}>{card.queue}</Text>
                </View>
                <Text variant="iconCaption" color={colors.textTertiary}>
                  ease: {card.ease.toFixed(1)}
                </Text>
                <Text variant="iconCaption" color={colors.textTertiary}>
                  int: {card.intervalDays}d
                </Text>
                <Text variant="iconCaption" color={card.lapseCount > 0 ? colors.danger : colors.textTertiary}>
                  {card.lapseCount} lapse{card.lapseCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        ))}
        {filtered.length > 30 && (
          <Text variant="caption" color={colors.textTertiary} style={{ textAlign: 'center', paddingTop: spacing.sm }}>
            Showing 30 of {filtered.length} cards
          </Text>
        )}
      </Card>

      {allCards.length === 0 && (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🃏</Text>
            <Text variant="body" color={colors.textSecondary}>No cards yet.</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  searchInput: {
    backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 44,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  cardInfo: { flex: 1, gap: 4 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  queueBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
});
