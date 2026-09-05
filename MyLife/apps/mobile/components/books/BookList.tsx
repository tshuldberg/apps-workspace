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

export function BookList({ books, onPress }: Props) {
  return (
    <View style={styles.list}>
      {books.map((book) => (
        <Pressable
          key={book.id}
          style={styles.row}
          onPress={() => onPress(book.id)}
        >
          <BookCover coverUrl={book.cover_url} size="small" title={book.title} />
          <View style={styles.info}>
            <Text variant="body" numberOfLines={1} style={{ fontSize: 16 }}>
              {book.title}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {parseAuthors(book.authors).join(', ')}
            </Text>
            <View style={styles.meta}>
              {book.page_count && (
                <Text variant="caption" color={colors.textTertiary}>
                  {book.page_count} pages
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
});
