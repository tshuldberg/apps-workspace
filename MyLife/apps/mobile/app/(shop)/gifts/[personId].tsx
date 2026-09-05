import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createWishlistItem,
  getGiftBudget,
  getGiftPersonById,
  getOverBudgetWarning,
  listGiftsByPerson,
  listItemsByGiftForPerson,
  listWishlists,
  setGiftBudget,
  summarizePersonSpending,
  type Gift,
  type GiftBudget,
  type GiftPerson,
  type WishlistItem,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

type Tab = 'ideas' | 'past' | 'budget';

function formatCents(c: number): string {
  const sign = c < 0 ? '-' : '';
  return `${sign}$${(Math.abs(c) / 100).toFixed(2)}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export default function PersonDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ personId?: string }>();
  const personId = Array.isArray(params.personId) ? params.personId[0] : params.personId;

  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('ideas');
  const [newIdea, setNewIdea] = useState('');
  const [budgetInput, setBudgetInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const person = useMemo<GiftPerson | null>(() => {
    if (!personId) return null;
    try {
      return getGiftPersonById(db, personId);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, personId, tick]);

  const gifts = useMemo<Gift[]>(() => {
    if (!personId) return [];
    try {
      return listGiftsByPerson(db, personId);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, personId, tick]);

  const ideas = useMemo<WishlistItem[]>(() => {
    if (!personId) return [];
    try {
      return listItemsByGiftForPerson(db, personId);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, personId, tick]);

  const budget = useMemo<GiftBudget | null>(() => {
    if (!personId) return null;
    try {
      return getGiftBudget(db, personId);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, personId, tick]);

  const summary = useMemo(() => summarizePersonSpending(gifts), [gifts]);
  const warning = useMemo(
    () => getOverBudgetWarning(budget, gifts),
    [budget, gifts],
  );

  if (!personId || !person) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Person not found</Text>
      </ScrollView>
    );
  }

  const handleQuickIdea = () => {
    const trimmed = newIdea.trim();
    if (!trimmed) return;
    try {
      // Ensure a default wishlist exists for the user.
      const lists = listWishlists(db);
      let listId = lists[0]?.id;
      if (!listId) {
        // Fall back to a scratch list creation via inputs not available here.
        Alert.alert(
          'No wishlist yet',
          'Create a wishlist first from the Wishlist tab, then save gift ideas.',
        );
        return;
      }
      createWishlistItem(db, {
        listId,
        name: trimmed,
        category: 'gifts',
        priority: 'want',
        giftForPersonId: personId,
      });
      setNewIdea('');
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleSetBudget = () => {
    const dollars = Number(budgetInput.trim());
    if (!Number.isFinite(dollars) || dollars < 0) {
      Alert.alert('Invalid amount', 'Enter a non-negative dollar amount.');
      return;
    }
    try {
      setGiftBudget(db, {
        personId,
        amountCents: Math.round(dollars * 100),
      });
      setBudgetInput('');
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{person.relationship ?? 'Person'}</Text>
        <Text style={styles.title}>{person.name}</Text>
        <Text style={styles.subtitle}>
          {summary.count} gifts tracked, {formatCents(summary.totalMyShare)} spent
          total
        </Text>
      </View>

      <View style={styles.segRow}>
        {(['ideas', 'past', 'budget'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.segButton, tab === t && styles.segButtonActive]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[styles.segText, tab === t && styles.segTextActive]}
            >
              {t === 'ideas' ? 'Ideas' : t === 'past' ? 'Past Gifts' : 'Budget'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'ideas' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Gift ideas</Text>
          {ideas.length === 0 ? (
            <Text style={styles.muted}>No ideas saved yet.</Text>
          ) : (
            ideas.map((item) => (
              <Pressable
                key={item.id}
                style={styles.row}
                onPress={() =>
                  router.push(`/(shop)/wishlist/item/${item.id}`)
                }
              >
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.notesMd ? (
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {item.notesMd}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
          <Text style={styles.label}>Quick save idea</Text>
          <TextInput
            style={styles.input}
            value={newIdea}
            onChangeText={setNewIdea}
            placeholder="Idea..."
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={handleQuickIdea}
            returnKeyType="done"
          />
          <Pressable style={styles.primaryButton} onPress={handleQuickIdea}>
            <Text style={styles.primaryButtonText}>Save idea</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push(`/(shop)/gifts/ideas/${personId}`)}
          >
            <Text style={styles.secondaryButtonText}>See all ideas</Text>
          </Pressable>
        </View>
      ) : null}

      {tab === 'past' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Past gifts</Text>
          {gifts.length === 0 ? (
            <Text style={styles.muted}>No gifts logged yet.</Text>
          ) : (
            gifts.map((g) => (
              <View key={g.id} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {g.itemDescription}
                  </Text>
                  <Text style={styles.rowAmount}>
                    {formatCents(
                      g.isGroupGift && typeof g.myShareCents === 'number'
                        ? g.myShareCents
                        : g.amountCents,
                    )}
                  </Text>
                </View>
                <View style={styles.rowFooter}>
                  <View style={styles.occasionBadge}>
                    <Text style={styles.occasionBadgeText}>
                      {g.occasion.replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta}>{formatDate(g.giftDate)}</Text>
                </View>
                {g.reactionNotes ? (
                  <Text style={styles.rowMeta} numberOfLines={3}>
                    {g.reactionNotes}
                  </Text>
                ) : null}
              </View>
            ))
          )}
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(shop)/gifts/add')}
          >
            <Text style={styles.primaryButtonText}>Log a new gift</Text>
          </Pressable>
        </View>
      ) : null}

      {tab === 'budget' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Gift budget</Text>
          {budget ? (
            <>
              <Text style={styles.bigAmount}>
                {formatCents(budget.amountCents)}
              </Text>
              <Text style={styles.muted}>
                Spent: {formatCents(summary.totalMyShare)} ({warning.percentage}%)
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(warning.percentage, 100)}%`,
                      backgroundColor: warning.overBudget ? '#EF4444' : SHOP_ACCENT,
                    },
                  ]}
                />
              </View>
              {warning.overBudget ? (
                <Text style={styles.warnText}>
                  Over budget by {formatCents(warning.overAmount)}
                </Text>
              ) : (
                <Text style={styles.muted}>
                  {formatCents(budget.amountCents - summary.totalMyShare)} remaining
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.muted}>No budget set.</Text>
          )}
          <Text style={styles.label}>Set/update budget ($)</Text>
          <TextInput
            style={styles.input}
            value={budgetInput}
            onChangeText={setBudgetInput}
            placeholder="100"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Pressable style={styles.primaryButton} onPress={handleSetBudget}>
            <Text style={styles.primaryButtonText}>Save budget</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
    gap: 14,
  },
  header: {
    gap: 6,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  segRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segButtonActive: { backgroundColor: SHOP_ACCENT },
  segText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  segTextActive: { color: '#0E0E13' },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    gap: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  rowAmount: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMeta: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  occasionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.32)',
  },
  occasionBadgeText: {
    color: SHOP_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  bigAmount: { color: colors.text, fontSize: 26, fontWeight: '800' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  warnText: { color: '#FCA5A5', fontSize: 13, fontWeight: '700' },
});
