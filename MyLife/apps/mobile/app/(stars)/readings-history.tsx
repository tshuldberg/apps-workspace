import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  GlassCard,
  MaterialSymbol,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  TarotCardTile,
  deleteReading,
  getDailyReadings,
  getTarotCardById,
  getTarotCardByName,
  getTarotReadings,
  updateTarotReadingNotes,
  type DailyReading,
  type TarotReading,
  type TarotSpreadType,
} from '@mylife/stars';
import {
  buildReadingNarrative,
  buildDailySummary,
  formatMonthGroup,
  getDateParts,
  getSpreadLabel,
  resolveDailyTarotCard,
} from './tarot-helpers';

type FilterKey =
  | 'all'
  | 'daily_card'
  | 'three_card'
  | 'celtic_cross'
  | 'relationship'
  | 'with_notes';

interface ArchiveCard {
  cardId: string;
  cardName: string;
  reversed: boolean;
  positionLabel: string;
  interpretation: string;
}

interface ArchiveItem {
  id: string;
  kind: 'daily' | 'tarot';
  date: string;
  spreadType: TarotSpreadType;
  title: string;
  question: string | null;
  notes: string | null;
  narrative: string;
  cards: ArchiveCard[];
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'daily_card', label: 'Daily Card' },
  { key: 'three_card', label: '3-Card' },
  { key: 'celtic_cross', label: 'Celtic Cross' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'with_notes', label: 'With Notes' },
];

function cardPreviewLabel(cardName: string): string {
  return cardName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function buildArchiveFromDaily(reading: DailyReading): ArchiveItem {
  const card = resolveDailyTarotCard(reading, reading.date);
  const reversed = reading.tarotIsReversed ?? false;

  return {
    id: reading.id,
    kind: 'daily',
    date: reading.date,
    spreadType: 'daily_card',
    title: card.name,
    question: null,
    notes: null,
    narrative: reading.summary ?? buildDailySummary(card, reversed),
    cards: [
      {
        cardId: card.id,
        cardName: card.name,
        reversed,
        positionLabel: 'Daily Guidance',
        interpretation: reading.summary ?? buildDailySummary(card, reversed),
      },
    ],
  };
}

function buildArchiveFromTarot(reading: TarotReading): ArchiveItem {
  return {
    id: reading.id,
    kind: 'tarot',
    date: reading.readingDate,
    spreadType: reading.spreadType,
    title: reading.title,
    question: reading.question,
    notes: reading.notes,
    narrative: reading.narrative ?? buildReadingNarrative(reading.cards),
    cards: reading.cards.map((card) => ({
      cardId: card.cardId,
      cardName: card.cardName,
      reversed: card.reversed,
      positionLabel: card.positionLabel,
      interpretation: card.interpretation,
    })),
  };
}

export default function ReadingsHistoryScreen() {
  const db = useDatabase();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null);
  const [draftNotes, setDraftNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const dailyReadings = useMemo(() => getDailyReadings(db), [db, refreshTick]);
  const tarotReadings = useMemo(() => getTarotReadings(db), [db, refreshTick]);

  const items = useMemo(() => {
    const merged = [
      ...dailyReadings.map(buildArchiveFromDaily),
      ...tarotReadings.map(buildArchiveFromTarot),
    ];

    return merged.sort((left, right) => {
      if (left.date === right.date) {
        return right.id.localeCompare(left.id);
      }

      return right.date.localeCompare(left.date);
    });
  }, [dailyReadings, tarotReadings]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'with_notes'
            ? Boolean(item.notes && item.notes.trim().length > 0)
            : item.spreadType === filter;

      if (!matchesFilter) {
        return false;
      }

      if (term.length === 0) {
        return true;
      }

      const haystack = [
        item.title,
        item.question ?? '',
        item.notes ?? '',
        item.narrative,
        ...item.cards.map((card) => `${card.cardName} ${card.positionLabel}`),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [filter, items, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ArchiveItem[]>();

    filteredItems.forEach((item) => {
      const key = formatMonthGroup(item.date);
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    });

    return Array.from(groups.entries());
  }, [filteredItems]);

  const stats = useMemo(() => {
    const total = items.length;
    const counts = new Map<string, number>();

    items.forEach((item) => {
      item.cards.forEach((card) => {
        counts.set(card.cardName, (counts.get(card.cardName) ?? 0) + 1);
      });
    });

    let mostDrawnCard = 'None yet';
    let mostDrawnCount = 0;

    counts.forEach((count, cardName) => {
      if (count > mostDrawnCount) {
        mostDrawnCard = cardName;
        mostDrawnCount = count;
      }
    });

    const dailyDates = Array.from(
      new Set(
        items
          .filter((item) => item.spreadType === 'daily_card')
          .map((item) => item.date),
      ),
    ).sort((left, right) => right.localeCompare(left));

    let streak = 0;
    for (let index = 0; index < dailyDates.length; index += 1) {
      if (index === 0) {
        streak = 1;
        continue;
      }

      const previous = new Date(`${dailyDates[index - 1]}T00:00:00`);
      const current = new Date(`${dailyDates[index]}T00:00:00`);
      const delta = (previous.getTime() - current.getTime()) / 86400000;

      if (delta === 1) {
        streak += 1;
      } else {
        break;
      }
    }

    return {
      total,
      mostDrawnCard,
      streak,
    };
  }, [items]);

  const selectedDetailCards = useMemo(() => {
    if (!selectedItem) {
      return [];
    }

    return selectedItem.cards.map((card) => {
      const resolvedCard =
        getTarotCardById(card.cardId) ?? getTarotCardByName(card.cardName);

      return {
        ...card,
        resolvedCard,
      };
    });
  }, [selectedItem]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 280);
  }, []);

  const openDetail = useCallback((item: ArchiveItem) => {
    setSelectedItem(item);
    setDraftNotes(item.notes ?? '');
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedItem(null);
    setDraftNotes('');
    setIsSavingNotes(false);
  }, []);

  const handleDelete = useCallback(
    (item: ArchiveItem) => {
      Alert.alert(
        'Delete Reading?',
        'This removes the reading from your private archive.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              try {
                deleteReading(db, item.kind === 'daily' ? 'daily' : 'tarot', item.id);
                if (selectedItem?.id === item.id) {
                  closeDetail();
                }
                setRefreshTick((value) => value + 1);
              } catch {
                Alert.alert('Delete Failed', 'This reading could not be removed.');
              }
            },
          },
        ],
      );
    },
    [closeDetail, db, selectedItem?.id],
  );

  const handleSaveNotes = useCallback(() => {
    if (!selectedItem || selectedItem.kind !== 'tarot' || isSavingNotes) {
      return;
    }

    setIsSavingNotes(true);
    try {
      const updated = updateTarotReadingNotes(db, selectedItem.id, draftNotes.trim() || null);

      if (updated) {
        setSelectedItem(buildArchiveFromTarot(updated));
      }

      setRefreshTick((value) => value + 1);
      setIsSavingNotes(false);
    } catch {
      setIsSavingNotes(false);
      Alert.alert('Save Failed', 'Your notes could not be updated.');
    }
  }, [db, draftNotes, isSavingNotes, selectedItem]);

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ST_ACCENT_LIGHT}
          />
        }
      >
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Past Readings</Text>
          <Text style={styles.title}>Your Readings</Text>
          <Text style={styles.subtitle}>
            Search across daily cards and saved spreads, then reopen the full interpretation when you need it.
          </Text>
        </View>

        <GlassCard variant="high" contentStyle={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Readings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1}>
              {stats.mostDrawnCard}
            </Text>
            <Text style={styles.statLabel}>Most Drawn</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Daily Streak</Text>
          </View>
        </GlassCard>

        <View style={styles.searchWrap}>
          <MaterialSymbol name="search" size={18} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by card or question"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          {FILTERS.map((entry) => {
            const selected = entry.key === filter;
            return (
              <Pressable
                key={entry.key}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                onPress={() => setFilter(entry.key)}
              >
                <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {groupedItems.length === 0 ? (
          <GlassCard variant="low" contentStyle={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'\u2728'}</Text>
            <Text style={styles.emptyTitle}>No readings match this view</Text>
            <Text style={styles.emptyBody}>
              Draw a card or save a spread to start building your archive.
            </Text>
          </GlassCard>
        ) : (
          groupedItems.map(([groupLabel, entries]) => (
            <View key={groupLabel} style={styles.groupSection}>
              <Text style={styles.groupLabel}>{groupLabel}</Text>
              <View style={styles.groupStack}>
                {entries.map((item) => {
                  const dateParts = getDateParts(item.date);

                  return (
                    <Swipeable
                      key={item.id}
                      renderRightActions={() => (
                        <View style={styles.deleteActionWrap}>
                          <Pressable style={styles.deleteAction} onPress={() => handleDelete(item)}>
                            <MaterialSymbol name="delete" size={18} color={colors.text} />
                            <Text style={styles.deleteActionText}>Delete</Text>
                          </Pressable>
                        </View>
                      )}
                    >
                      <Pressable onPress={() => openDetail(item)}>
                        <GlassCard variant="low" contentStyle={styles.historyCard}>
                          <View style={styles.historyDate}>
                            <Text style={styles.historyDateDay}>{dateParts.day}</Text>
                            <Text style={styles.historyDateMonth}>{dateParts.month}</Text>
                          </View>

                          <View style={styles.previewRail}>
                            {item.cards.slice(0, 4).map((card) => (
                              <View key={`${item.id}-${card.cardId}-${card.positionLabel}`} style={styles.previewCard}>
                                <Text style={styles.previewCardLabel}>
                                  {cardPreviewLabel(card.cardName)}
                                </Text>
                              </View>
                            ))}
                          </View>

                          <View style={styles.historyCopy}>
                            <View style={styles.historyMetaRow}>
                              <Text style={styles.historyEyebrow}>
                                {item.spreadType === 'daily_card'
                                  ? 'Daily Card'
                                  : getSpreadLabel(item.spreadType)}
                              </Text>
                              {item.notes ? (
                                <View style={styles.notesPill}>
                                  <MaterialSymbol name="edit_note" size={14} color={ST_ACCENT_LIGHT} />
                                  <Text style={styles.notesPillText}>Notes</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.historyTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.historyBody} numberOfLines={2}>
                              {item.question || item.narrative}
                            </Text>
                          </View>

                          <MaterialSymbol name="chevron_right" size={18} color={colors.textTertiary} />
                        </GlassCard>
                      </Pressable>
                    </Swipeable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={Boolean(selectedItem)}
        onRequestClose={closeDetail}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>
                    {selectedItem
                      ? selectedItem.spreadType === 'daily_card'
                        ? 'Daily Card'
                        : getSpreadLabel(selectedItem.spreadType)
                      : ''}
                  </Text>
                  <Text style={styles.modalTitle}>{selectedItem?.title}</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={closeDetail}>
                  <MaterialSymbol name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              {selectedItem?.question ? (
                <Text style={styles.modalQuestion}>{selectedItem.question}</Text>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.detailCardRail}
              >
                {selectedDetailCards.map((card) =>
                  card.resolvedCard ? (
                    <View key={`${card.cardId}-${card.positionLabel}`} style={styles.detailCardWrap}>
                      <Text style={styles.detailCardLabel}>{card.positionLabel}</Text>
                      <TarotCardTile
                        card={card.resolvedCard}
                        reversed={card.reversed}
                        size="compact"
                      />
                    </View>
                  ) : null,
                )}
              </ScrollView>

              <GlassCard variant="high" contentStyle={styles.detailNarrativeCard}>
                <Text style={styles.detailNarrativeText}>{selectedItem?.narrative}</Text>
              </GlassCard>

              <View style={styles.detailInterpretationStack}>
                {selectedItem?.cards.map((card) => (
                  <GlassCard
                    key={`detail-${card.cardId}-${card.positionLabel}`}
                    variant="low"
                    contentStyle={styles.detailInterpretationCard}
                  >
                    <Text style={styles.detailInterpretationEyebrow}>{card.positionLabel}</Text>
                    <Text style={styles.detailInterpretationTitle}>
                      {card.cardName}
                      {card.reversed ? ' • Reversed' : ''}
                    </Text>
                    <Text style={styles.detailInterpretationBody}>{card.interpretation}</Text>
                  </GlassCard>
                ))}
              </View>

              {selectedItem?.kind === 'tarot' ? (
                <GlassCard variant="low" contentStyle={styles.notesCard}>
                  <Text style={styles.notesTitle}>Notes</Text>
                  <TextInput
                    value={draftNotes}
                    onChangeText={setDraftNotes}
                    multiline
                    placeholder="Capture anything you noticed after the draw"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.notesInput}
                  />
                  <Pressable
                    style={[styles.saveNotesButton, isSavingNotes && styles.buttonDisabled]}
                    onPress={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    <Text style={styles.saveNotesText}>
                      {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </Text>
                  </Pressable>
                </GlassCard>
              ) : (
                <GlassCard variant="low" contentStyle={styles.notesCard}>
                  <Text style={styles.notesTitle}>Notes</Text>
                  <Text style={styles.dailyNotesCopy}>
                    Daily cards use the saved summary itself as the archive note. Full editable notes are available on spread readings.
                  </Text>
                </GlassCard>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
    lineHeight: 20,
    color: colors.textSecondary,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  searchWrap: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: ST_SURFACES.high,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
  },
  filterRail: {
    gap: 8,
    paddingRight: spacing.md,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ST_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  filterText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: ST_ACCENT_LIGHT,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 30,
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  groupSection: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_ACCENT_LIGHT,
  },
  groupStack: {
    gap: spacing.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyDate: {
    width: 44,
    alignItems: 'center',
    gap: 2,
  },
  historyDateDay: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  historyDateMonth: {
    fontFamily: ST_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.textTertiary,
  },
  previewRail: {
    flexDirection: 'row',
    gap: 6,
  },
  previewCard: {
    width: 34,
    height: 50,
    borderRadius: 12,
    backgroundColor: ST_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardLabel: {
    fontFamily: ST_FONTS.bold,
    fontSize: 10,
    color: ST_ACCENT_LIGHT,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  historyEyebrow: {
    fontFamily: ST_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  notesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  notesPillText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 10,
    color: ST_ACCENT_LIGHT,
  },
  historyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  historyBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  deleteActionWrap: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingLeft: spacing.sm,
  },
  deleteAction: {
    minHeight: 88,
    width: 96,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 69, 58, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteActionText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: ST_SURFACES.base,
    overflow: 'hidden',
  },
  modalContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  modalEyebrow: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ST_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalQuestion: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  detailCardRail: {
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  detailCardWrap: {
    gap: 8,
  },
  detailCardLabel: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  detailNarrativeCard: {
    gap: spacing.sm,
  },
  detailNarrativeText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
  },
  detailInterpretationStack: {
    gap: spacing.sm,
  },
  detailInterpretationCard: {
    gap: spacing.xs,
  },
  detailInterpretationEyebrow: {
    fontFamily: ST_FONTS.bold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  detailInterpretationTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  detailInterpretationBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  notesCard: {
    gap: spacing.sm,
  },
  notesTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  notesInput: {
    minHeight: 118,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  saveNotesButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveNotesText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 14,
    color: ST_ACCENT_LIGHT,
  },
  dailyNotesCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
