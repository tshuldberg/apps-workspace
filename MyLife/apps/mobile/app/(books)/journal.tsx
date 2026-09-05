import { useState, useMemo, useCallback } from 'react';
import { View, FlatList, StyleSheet, TextInput, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, EmptyState } from '@mylife/ui';
import { GenreChip } from '@mylife/books/ui';
import {
  BOOKS_TYPOGRAPHY,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
  BOOKS_CTA_GRADIENT,
} from '@mylife/books';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from 'lucide-react-native';
import { useJournal } from '../../hooks/books/use-journal';
import { JournalEntryCard } from '../../components/books/JournalEntryCard';

const ACCENT = colors.modules.books;
const SearchIcon = icons.Search;

const FILTER_CATEGORIES = [
  'ALL NOTES',
  'PHILOSOPHY',
  'FICTION',
  'SCIENCE',
  'HISTORY',
  'MEMOIR',
  'POETRY',
  'SELF-HELP',
] as const;

export default function JournalScreen() {
  const router = useRouter();
  const { entries, loading, refresh, search, linkedBooks } = useJournal();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL NOTES');

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.trim()) {
      search(text.trim());
    } else {
      refresh();
    }
  }, [search, refresh]);

  const handleFilter = useCallback((filter: string) => {
    setActiveFilter(filter);
  }, []);

  const entriesWithBooks = useMemo(() => {
    return entries.map((entry) => ({
      entry,
      books: linkedBooks(entry.id),
    }));
  }, [entries, linkedBooks]);

  return (
    <View style={styles.container}>
      <FlatList
        data={entriesWithBooks}
        keyExtractor={(item) => item.entry.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={refresh}
        ListHeaderComponent={
          <>
            {/* Title Section */}
            <Text style={styles.displayTitle}>Reading Journal</Text>
            <Text style={styles.subtitle}>
              Your encrypted sanctuary for intellectual reflections and reading discoveries.
            </Text>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <SearchIcon size={18} color="rgba(228,225,233,0.35)" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={handleSearch}
                placeholder="Search entries..."
                placeholderTextColor="rgba(228,225,233,0.35)"
              />
            </View>

            {/* Category Filter Chips */}
            <FlatList
              horizontal
              data={FILTER_CATEGORIES}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <GenreChip
                  label={item}
                  selected={activeFilter === item}
                  onPress={() => handleFilter(item)}
                />
              )}
            />
          </>
        }
        renderItem={({ item }) => (
          <JournalEntryCard
            entry={item.entry}
            linkedBooks={item.books}
            onPress={() => router.push(`/(books)/journal/${item.entry.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon={'\u{1F4D3}'}
            title="No journal entries yet"
            message="Your reading journal is private and encrypted. Start writing about what you read."
            actionLabel="New Entry"
            onAction={() => router.push('/(books)/journal/new')}
            accentColor={ACCENT}
          />
        }
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(books)/journal/new')}
      >
        <LinearGradient
          colors={[BOOKS_CTA_GRADIENT.from, BOOKS_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#D6C3B5',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#E4E1E9',
    paddingVertical: 12,
  },
  chipRow: {
    gap: 8,
    marginBottom: 20,
  },
  separator: {
    height: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 6,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: 28,
    color: '#1a1008',
    fontWeight: '600',
    lineHeight: 30,
  },
});
