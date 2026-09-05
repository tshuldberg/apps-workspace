import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text, EmptyState, ErrorState, colors, spacing } from '@mylife/ui';
import { BookGrid } from '../../../components/books/BookGrid';
import { BookList } from '../../../components/books/BookList';
import { useShelfBooks } from '../../../hooks/books/use-shelves';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getShelf } from '@mylife/books';

const BOOKS_ACCENT = colors.modules.books;

type ViewMode = 'grid' | 'list';

export default function ShelfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const shelf = id ? getShelf(db, id) : null;
  const { books } = useShelfBooks(id);

  if (!shelf) {
    return (
      <View style={styles.emptyContainer}>
        <ErrorState message="Shelf not found." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: shelf.name }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="caption" color={colors.textSecondary}>
            {books.length} books
          </Text>
          <Pressable onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            <Text variant="caption" color={BOOKS_ACCENT}>
              {viewMode === 'grid' ? 'List' : 'Grid'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {books.length === 0 ? (
            <EmptyState
              icon="📚"
              title="Empty shelf"
              message="No books on this shelf yet."
            />
          ) : viewMode === 'grid' ? (
            <BookGrid books={books} onPress={(bookId) => router.push(`/(books)/book/${bookId}`)} />
          ) : (
            <BookList books={books} onPress={(bookId) => router.push(`/(books)/book/${bookId}`)} />
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
});
