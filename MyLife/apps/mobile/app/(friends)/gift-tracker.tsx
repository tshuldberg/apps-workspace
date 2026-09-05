import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Text } from '@mylife/ui';
import {
  listGiftsForPerson,
  listIdeasForPerson,
  getGiftSpendingForPerson,
  markPurchased,
  deleteGift,
  deleteIdea,
  type GiftRecord,
  type GiftIdeaRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#EC4899';
const BLUE = '#8BCFF0';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

const OCCASION_COLORS: Record<string, string> = {
  birthday: '#F59E0B',
  holiday: '#EF4444',
  just_because: '#8B5CF6',
  thank_you: '#10B981',
  anniversary: '#EC4899',
  graduation: '#06B6D4',
  other: '#9F8E81',
};

const OCCASION_LABELS: Record<string, string> = {
  birthday: 'Birthday',
  holiday: 'Holiday',
  just_because: 'Just because',
  thank_you: 'Thank you',
  anniversary: 'Anniversary',
  graduation: 'Graduation',
  other: 'Other',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type Tab = 'ideas' | 'history';

export default function GiftTrackerScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{
    personId: string;
    personName: string;
  }>();
  const db = useDatabase();

  const [tab, setTab] = useState<Tab>('ideas');
  const [ideas, setIdeas] = useState<GiftIdeaRecord[]>([]);
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const load = useCallback(() => {
    if (!personId) return;
    setIdeas(listIdeasForPerson(db, personId));
    setGifts(listGiftsForPerson(db, personId));
    setTotalSpent(getGiftSpendingForPerson(db, personId));
  }, [db, personId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleMarkPurchased = useCallback(
    (id: string) => {
      markPurchased(db, id);
      load();
    },
    [db, load],
  );

  const handleDeleteIdea = useCallback(
    (id: string) => {
      deleteIdea(db, id);
      load();
    },
    [db, load],
  );

  const handleDeleteGift = useCallback(
    (id: string) => {
      deleteGift(db, id);
      load();
    },
    [db, load],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Gifts</Text>
            {personName && (
              <Text style={styles.headerSubtitle}>for {personName}</Text>
            )}
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === 'ideas' && styles.tabActive]}
            onPress={() => setTab('ideas')}
          >
            <Text
              style={[styles.tabText, tab === 'ideas' && styles.tabTextActive]}
            >
              Ideas
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'history' && styles.tabActive]}
            onPress={() => setTab('history')}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'history' && styles.tabTextActive,
              ]}
            >
              History
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {tab === 'ideas' ? (
            <>
              {ideas.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No gift ideas yet</Text>
                  <Text style={styles.emptySubtext}>
                    Tap + to save an idea
                  </Text>
                </View>
              ) : (
                ideas.map((idea) => (
                  <View key={idea.id} style={styles.card}>
                    <View style={styles.cardMain}>
                      <Text
                        style={[
                          styles.cardTitle,
                          idea.is_purchased && styles.cardTitlePurchased,
                        ]}
                      >
                        {idea.description}
                      </Text>
                      <View style={styles.cardMeta}>
                        {idea.estimated_price_cents != null && (
                          <Text style={styles.priceText}>
                            {formatCents(idea.estimated_price_cents)}
                          </Text>
                        )}
                        {idea.priority > 0 && (
                          <Text style={styles.priorityText}>
                            Priority {idea.priority}
                          </Text>
                        )}
                      </View>
                      {idea.source_note && (
                        <Text style={styles.sourceNote}>
                          {idea.source_note}
                        </Text>
                      )}
                    </View>
                    <View style={styles.cardActions}>
                      {!idea.is_purchased && (
                        <Pressable
                          style={styles.checkButton}
                          onPress={() => handleMarkPurchased(idea.id)}
                          hitSlop={8}
                        >
                          <Text style={styles.checkText}>{'\u2713'}</Text>
                        </Pressable>
                      )}
                      {idea.is_purchased && (
                        <View style={styles.purchasedBadge}>
                          <Text style={styles.purchasedText}>Bought</Text>
                        </View>
                      )}
                      <Pressable
                        onPress={() => handleDeleteIdea(idea.id)}
                        hitSlop={8}
                      >
                        <Text style={styles.deleteText}>{'\u00D7'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              {/* Spending summary */}
              {totalSpent > 0 && (
                <View style={styles.spendingCard}>
                  <Text style={styles.spendingLabel}>Total spent</Text>
                  <Text style={styles.spendingAmount}>
                    {formatCents(totalSpent)}
                  </Text>
                </View>
              )}

              {gifts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No gift history</Text>
                  <Text style={styles.emptySubtext}>
                    Tap + to log a gift
                  </Text>
                </View>
              ) : (
                gifts.map((gift) => (
                  <View key={gift.id} style={styles.card}>
                    <View style={styles.cardMain}>
                      <View style={styles.directionRow}>
                        <View
                          style={[
                            styles.directionBadge,
                            {
                              backgroundColor:
                                gift.direction === 'given'
                                  ? `${ACCENT}20`
                                  : `${BLUE}20`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.directionText,
                              {
                                color:
                                  gift.direction === 'given' ? ACCENT : BLUE,
                              },
                            ]}
                          >
                            {gift.direction === 'given' ? 'Given' : 'Received'}
                          </Text>
                        </View>
                        {gift.occasion && (
                          <View
                            style={[
                              styles.occasionChip,
                              {
                                backgroundColor: `${OCCASION_COLORS[gift.occasion] ?? '#9F8E81'}15`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.occasionText,
                                {
                                  color:
                                    OCCASION_COLORS[gift.occasion] ?? '#9F8E81',
                                },
                              ]}
                            >
                              {OCCASION_LABELS[gift.occasion] ?? gift.occasion}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardTitle}>{gift.description}</Text>
                      <View style={styles.cardMeta}>
                        {gift.amount_cents != null && (
                          <Text style={styles.priceText}>
                            {formatCents(gift.amount_cents)}
                          </Text>
                        )}
                        {gift.date && (
                          <Text style={styles.dateText}>
                            {formatDate(gift.date)}
                          </Text>
                        )}
                      </View>
                      {gift.reaction_notes && (
                        <Text style={styles.reactionText}>
                          {gift.reaction_notes}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => handleDeleteGift(gift.id)}
                      hitSlop={8}
                    >
                      <Text style={styles.deleteText}>{'\u00D7'}</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* FAB */}
        <Pressable
          style={styles.fab}
          onPress={() => {
            if (tab === 'ideas') {
              router.push({
                pathname: '/(friends)/add-gift-idea',
                params: { personId, personName },
              });
            } else {
              router.push({
                pathname: '/(friends)/add-gift',
                params: { personId, personName },
              });
            }
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: GLASS,
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: SURFACE,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  tabTextActive: {
    color: TEXT_PRIMARY,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 8,
  },

  // Card
  card: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardMain: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  cardTitlePurchased: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
  },
  priorityText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  sourceNote: {
    fontSize: 12,
    color: '#9F8E81',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dateText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  reactionText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Direction + occasion
  directionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  directionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  directionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  occasionChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  occasionText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Card actions
  cardActions: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  checkButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${ACCENT}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT,
  },
  purchasedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  purchasedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  deleteText: {
    fontSize: 20,
    color: '#9F8E81',
    lineHeight: 22,
  },

  // Spending
  spendingCard: {
    backgroundColor: `${ACCENT}10`,
    borderWidth: 1,
    borderColor: `${ACCENT}20`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  spendingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spendingAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: ACCENT,
    marginTop: 4,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9F8E81',
    marginTop: 6,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
