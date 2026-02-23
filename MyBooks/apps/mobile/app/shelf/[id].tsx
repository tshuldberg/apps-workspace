import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text, colors, spacing } from '@mybooks/ui';
import { BookGrid } from '@/components/BookGrid';
import { BookList } from '@/components/BookList';
import { mockShelves, mockBooks } from '@/data/mock';

type ViewMode = 'grid' | 'list';

export default function ShelfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const shelf = mockShelves.find((s) => s.id === id);

  if (!shelf) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color={colors.textTertiary}>Shelf not found.</Text>
      </View>
    );
  }

  // Mock: show all books for any shelf
  const books = mockBooks;

  return (
    <>
      <Stack.Screen options={{ title: shelf.name }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="caption" color={colors.textSecondary}>
            {books.length} books
          </Text>
          <Pressable onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            <Text variant="caption" color={colors.accent}>
              {viewMode === 'grid' ? 'List' : 'Grid'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {viewMode === 'grid' ? (
            <BookGrid books={books} onPress={(bookId) => router.push(`/book/${bookId}`)} />
          ) : (
            <BookList books={books} onPress={(bookId) => router.push(`/book/${bookId}`)} />
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
