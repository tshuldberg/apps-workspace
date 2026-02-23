import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, SearchBar, colors, spacing } from '@mybooks/ui';
import { ShelfTabs } from '@/components/ShelfTabs';
import { BookGrid } from '@/components/BookGrid';
import { BookList } from '@/components/BookList';
import { mockShelves, mockBooks } from '@/data/mock';

type ViewMode = 'grid' | 'list';
type SortField = 'title' | 'added' | 'author' | 'rating';

export default function LibraryScreen() {
  const router = useRouter();
  const [activeShelf, setActiveShelf] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortField>('added');
  const [filterText, setFilterText] = useState('');

  // For mock: show all books regardless of shelf filter
  const filteredBooks = mockBooks.filter((b) =>
    filterText.length === 0 ||
    b.title.toLowerCase().includes(filterText.toLowerCase()) ||
    b.authors.toLowerCase().includes(filterText.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      {/* Filter input */}
      <View style={styles.filterRow}>
        <SearchBar
          value={filterText}
          onChangeText={setFilterText}
          placeholder="Filter library..."
        />
      </View>

      {/* Shelf tabs */}
      <ShelfTabs
        shelves={mockShelves}
        activeShelfId={activeShelf}
        onSelect={setActiveShelf}
      />

      {/* Controls row */}
      <View style={styles.controlsRow}>
        <Text variant="caption" color={colors.textSecondary}>
          {filteredBooks.length} books
        </Text>
        <View style={styles.controlsRight}>
          <Pressable onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            <Text variant="caption" color={colors.accent}>
              {viewMode === 'grid' ? 'List' : 'Grid'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setSortBy(sortBy === 'title' ? 'added' : 'title')}>
            <Text variant="caption" color={colors.accent}>
              Sort: {sortBy}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Book display */}
      <ScrollView style={styles.bookScroll} contentContainerStyle={styles.bookContent}>
        {viewMode === 'grid' ? (
          <BookGrid
            books={filteredBooks}
            onPress={(id) => router.push(`/book/${id}`)}
          />
        ) : (
          <BookList
            books={filteredBooks}
            onPress={(id) => router.push(`/book/${id}`)}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  controlsRight: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bookScroll: {
    flex: 1,
  },
  bookContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
});
