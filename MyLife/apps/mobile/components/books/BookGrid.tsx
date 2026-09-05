import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import type { Book } from '@mylife/books';
import { BookCover, Text, colors, spacing } from '@mylife/ui';

function parseAuthors(authors: string): string[] {
  try { return JSON.parse(authors); } catch { return [authors]; }
}

interface Props {
  books: Book[];
  onPress: (id: string) => void;
}

export function BookGrid({ books, onPress }: Props) {
  return (
    <View style={styles.grid}>
      {books.map((book) => (
        <Pressable
          key={book.id}
          style={styles.cell}
          onPress={() => onPress(book.id)}
        >
          <BookCover coverUrl={book.cover_url} size="medium" title={book.title} />
          <Text variant="caption" numberOfLines={1} style={styles.title}>
            {book.title}
          </Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {parseAuthors(book.authors)[0]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    width: '31%' as unknown as number,
    gap: spacing.xs,
  },
  title: {
    marginTop: spacing.xs,
  },
});
