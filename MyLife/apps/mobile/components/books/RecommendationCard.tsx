import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text, BookCover, colors, spacing } from '@mylife/ui';
import type { Recommendation } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;

const SOURCE_LABELS: Record<string, string> = {
  author_affinity: 'Author match',
  genre_affinity: 'Genre match',
  similar_books: 'Similar taste',
};

interface RecommendationCardProps {
  recommendation: Recommendation;
  onPress: () => void;
}

export function RecommendationCard({ recommendation, onPress }: RecommendationCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <BookCover coverUrl={recommendation.coverUrl} size="medium" title={recommendation.title} />
      <View style={styles.info}>
        <Text variant="label" numberOfLines={1}>{recommendation.title}</Text>
        <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {recommendation.authors.join(', ')}
        </Text>
        <View style={styles.reasonBadge}>
          <Text variant="caption" color={BOOKS_ACCENT}>{recommendation.reason}</Text>
        </View>
        <Text variant="caption" color={colors.textTertiary} style={styles.sourceText}>
          {SOURCE_LABELS[recommendation.source] ?? recommendation.source}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.sm,
    gap: spacing.sm,
    width: 260,
  },
  pressed: {
    opacity: 0.8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  reasonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${BOOKS_ACCENT}26`,
    borderRadius: 999,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  sourceText: {
    fontSize: 11,
  },
});
