import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
  Text as RNText,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, colors } from '@mylife/ui';
import {
  QuoteCard,
  GlassCard,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useQuotes } from '../../hooks/books/use-quotes';
import { icons } from 'lucide-react-native';

const SearchIcon = icons.Search;
const SparklesIcon = icons.Sparkles;
const BookmarkIcon = icons.Bookmark;

const BOOKS_ACCENT = colors.modules.books;

function parseFirstAuthor(authors: string): string {
  try {
    const parsed = JSON.parse(authors) as string[];
    return parsed[0] ?? authors;
  } catch {
    return authors;
  }
}

export default function QuotesScreen() {
  const router = useRouter();
  const { quotes, loading, refresh, search, toggleFavorite, remove } =
    useQuotes();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.trim()) {
      search(text.trim());
    } else {
      refresh();
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Quote', 'Remove this quote from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  // Monthly curation stats
  const monthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const thisMonth = quotes.filter((q) => q.quote.created_at >= monthStart);
    const uniqueAuthors = new Set(
      thisMonth.map((q) => parseFirstAuthor(q.bookAuthors)),
    );
    return { passages: thisMonth.length, authors: uniqueAuthors.size };
  }, [quotes]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BOOKS_ACCENT}
          />
        }
      >
        {/* Display Title */}
        <RNText style={styles.displayTitle}>Quotes Collection</RNText>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <SearchIcon size={18} color="#9F8E81" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleSearch}
            placeholder="Search your curated thoughts..."
            placeholderTextColor="#9F8E81"
          />
        </View>

        {quotes.length === 0 && !loading ? (
          <EmptyState
            icon={'\u201C'}
            title="No quotes saved"
            message="Save your favorite passages. Quotes you save will appear here."
            actionLabel="Add Quote"
            onAction={() => router.push('/(books)/quotes/new')}
            accentColor={BOOKS_ACCENT}
          />
        ) : (
          <View style={styles.quotesList}>
            {/* First quote */}
            {quotes[0] && (
              <Pressable
                onLongPress={() => handleDelete(quotes[0].quote.id)}
              >
                <QuoteCard
                  text={quotes[0].quote.content}
                  source={parseFirstAuthor(quotes[0].bookAuthors)}
                  author={quotes[0].bookTitle.toUpperCase()}
                  coverUrl={quotes[0].bookCoverUrl ?? undefined}
                  favorited={quotes[0].quote.is_favorite === 1}
                  onToggleFavorite={() =>
                    toggleFavorite(
                      quotes[0].quote.id,
                      quotes[0].quote.is_favorite,
                    )
                  }
                />
              </Pressable>
            )}

            {/* Curation Stats Card */}
            <GlassCard level={2} style={styles.statsCard}>
              <SparklesIcon size={24} color={BOOKS_ACCENT} />
              <RNText style={styles.statsTitle}>Curation Stats</RNText>
              <RNText style={styles.statsBody}>
                You've highlighted {monthStats.passages} passages across{' '}
                {monthStats.authors} different authors this month.
              </RNText>
              <BookmarkIcon
                size={20}
                color="#9F8E81"
                style={styles.statsBookmark}
              />
              <RNText style={styles.statsCaption}>
                Save your favorite passages
              </RNText>
            </GlassCard>

            {/* Remaining quotes */}
            {quotes.slice(1).map((item) => (
              <Pressable
                key={item.quote.id}
                onLongPress={() => handleDelete(item.quote.id)}
              >
                <QuoteCard
                  text={item.quote.content}
                  source={parseFirstAuthor(item.bookAuthors)}
                  author={item.bookTitle.toUpperCase()}
                  coverUrl={item.bookCoverUrl ?? undefined}
                  favorited={item.quote.is_favorite === 1}
                  onToggleFavorite={() =>
                    toggleFavorite(item.quote.id, item.quote.is_favorite)
                  }
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(books)/quotes/new')}
      >
        <RNText style={styles.fabIcon}>+</RNText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginTop: 8,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#E4E1E9',
    padding: 0,
  },
  quotesList: {
    gap: 16,
  },

  // Curation Stats
  statsCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  statsTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    marginTop: 12,
    marginBottom: 8,
  },
  statsBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsBookmark: {
    marginTop: 16,
  },
  statsCaption: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#9F8E81',
    marginTop: 6,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BOOKS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 28,
    color: '#1a1008',
    fontWeight: '600',
    lineHeight: 30,
  },
});
