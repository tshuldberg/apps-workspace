import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text, BookCover, colors, spacing } from '@mylife/ui';
import type { QuoteWithBook } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;

interface QuoteCardProps {
  item: QuoteWithBook;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  showBookInfo?: boolean;
}

export function QuoteCard({ item, onPress, onToggleFavorite, showBookInfo }: QuoteCardProps) {
  const { quote, bookTitle, bookAuthors, bookCoverUrl } = item;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : undefined]}
      onPress={onPress}
    >
      <Text style={styles.quoteMarks} color={BOOKS_ACCENT}>{'\u201c'}</Text>
      <Text variant="body" style={styles.quoteText}>{quote.content}</Text>

      <View style={styles.attributionRow}>
        {showBookInfo && bookCoverUrl && (
          <BookCover coverUrl={bookCoverUrl} size="small" title={bookTitle} />
        )}
        <View style={styles.attributionText}>
          <Text variant="label" numberOfLines={1}>{bookTitle}</Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{bookAuthors}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {quote.page_number !== null && (
          <Text variant="caption" color={colors.textTertiary}>p. {quote.page_number}</Text>
        )}
        {quote.chapter && (
          <Text variant="caption" color={colors.textTertiary}>{quote.chapter}</Text>
        )}
      </View>

      {quote.note && (
        <Text variant="caption" color={colors.textTertiary} style={styles.note}>{quote.note}</Text>
      )}

      {onToggleFavorite && (
        <Pressable onPress={onToggleFavorite} style={styles.heartButton} hitSlop={8}>
          <Text style={styles.heart}>
            {quote.is_favorite === 1 ? '\u2764\ufe0f' : '\u2661'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
  quoteMarks: {
    fontSize: 32,
    lineHeight: 36,
  },
  quoteText: {
    fontStyle: 'italic',
    lineHeight: 22,
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  attributionText: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  note: {
    fontStyle: 'italic',
  },
  heartButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  heart: {
    fontSize: 20,
  },
});
