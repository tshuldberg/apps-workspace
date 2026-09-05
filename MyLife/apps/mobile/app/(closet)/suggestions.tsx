import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  listClothingItems,
  listSuggestionFeedback,
  recordSuggestionFeedback,
  generateOutfitSuggestions,
  type ClothingItem,
  type OutfitSuggestion,
  type SuggestionFeedback,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

export default function SuggestionsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const items: ClothingItem[] = useMemo(() => {
    try { return listClothingItems(db, {}); } catch { return []; }
  }, [db, tick]);

  const feedback: SuggestionFeedback[] = useMemo(() => {
    try { return listSuggestionFeedback(db); } catch { return []; }
  }, [db, tick]);

  const suggestions: OutfitSuggestion[] = useMemo(() => {
    try { return generateOutfitSuggestions(items, feedback, { limit: 3 }); } catch { return []; }
  }, [items, feedback]);

  const handleFeedback = (hash: string, itemIds: string[], vote: 'up' | 'down') => {
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      recordSuggestionFeedback(db, hash, itemIds, vote, 'suggestion_screen');
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't save feedback.");
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>👗</Text>
        <Text variant="subheading" color={colors.textSecondary}>Outfit Suggestions</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add items to your wardrobe to get outfit suggestions.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Outfit Suggestions</Text>

      <Pressable style={styles.regenButton} onPress={refresh}>
        <Text variant="label" color={colors.background}>Regenerate</Text>
      </Pressable>

      {suggestions.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>
              Not enough items to generate suggestions.
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Add more items with different categories.
            </Text>
          </View>
        </Card>
      ) : (
        suggestions.map((suggestion, idx) => {
          const outfitItems = suggestion.itemIds
            .map((id) => items.find((i) => i.id === id))
            .filter(Boolean) as ClothingItem[];

          return (
            <Card key={suggestion.hash}>
              <Text variant="label" color={colors.textTertiary}>
                SUGGESTION {idx + 1}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                Score: {Math.round(suggestion.score * 100)}% - {suggestion.context}
              </Text>

              {outfitItems.map((item) => (
                <View key={item.id} style={styles.outfitItem}>
                  <View style={styles.categoryBadge}>
                    <Text variant="iconCaption" color={ACCENT}>
                      {item.category}
                    </Text>
                  </View>
                  <View style={styles.outfitItemInfo}>
                    <Text variant="body">{item.name}</Text>
                    {item.color && (
                      <Text variant="iconCaption" color={colors.textTertiary}>
                        {item.color}
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.feedbackRow}>
                <Pressable
                  style={styles.feedbackButton}
                  onPress={() => handleFeedback(suggestion.hash, suggestion.itemIds, 'up')}
                >
                  <Text variant="body">👍</Text>
                </Pressable>
                <Pressable
                  style={styles.feedbackButton}
                  onPress={() => handleFeedback(suggestion.hash, suggestion.itemIds, 'down')}
                >
                  <Text variant="body">👎</Text>
                </Pressable>
              </View>
            </Card>
          );
        })
      )}

      {/* Feedback history */}
      {feedback.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>RECENT FEEDBACK</Text>
          {feedback.slice(0, 5).map((fb) => (
            <View key={fb.id} style={styles.feedbackHistoryRow}>
              <Text variant="body">{fb.feedback === 'up' ? '👍' : '👎'}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {fb.itemIds.length} items - {new Date(fb.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  regenButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  outfitItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceElevated, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  outfitItemInfo: { flex: 1, gap: 2 },
  feedbackRow: {
    flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm,
    justifyContent: 'center',
  },
  feedbackButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  feedbackHistoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 4,
  },
});
