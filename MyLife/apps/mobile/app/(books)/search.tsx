import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, LoadingState, EmptyState, ErrorState, colors } from '@mylife/ui';
import { useOpenLibrarySearch } from '../../hooks/books/use-search';
import { useBooks } from '../../hooks/books/use-books';
import {
  olSearchDocToBook,
  addBookToShelf,
  getSystemShelves,
  type OLSearchDoc,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  BOOKS_GHOST_BORDER,
  JAKARTA_FONTS,
} from '@mylife/books';
import { GradientButton, GenreChip, GlassCard } from '@mylife/books/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { icons } from 'lucide-react-native';

const SearchIcon = icons.Search;
const ScanIcon = icons.ScanBarcode;
const XIcon = icons.X;
const ChevronDownIcon = icons.ChevronDown;
const StarIcon = icons.Star;
const PlusIcon = icons.Plus;
const FilterIcon = icons.SlidersHorizontal;

const BOOKS_ACCENT = colors.modules.books;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - CARD_GAP) / 2;

const GENRES = [
  'Philosophy',
  'Fiction',
  'History',
  'Science',
  'Art',
  'Biography',
  'Poetry',
  'Psychology',
  'Religion',
  'Technology',
];

const FORMATS = ['All Formats', 'Hardcover', 'Paperback', 'eBook', 'Audiobook'];

const SORT_OPTIONS = ['Relevance', 'Title', 'Year', 'Author'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function parseAuthors(authors: string[] | undefined): string {
  return (authors ?? []).join(', ') || 'Unknown Author';
}

function getCoverUrl(doc: OLSearchDoc): string | null {
  if (doc.cover_edition_key) {
    return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-M.jpg`;
  }
  if (doc.isbn?.[0]) {
    return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
  }
  return null;
}

export default function SearchScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [query, setQuery] = useState('');
  const [addingKeys, setAddingKeys] = useState<Record<string, boolean>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Existentialism',
    'The Great Gatsby',
    'Data Science 2024',
  ]);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('All Formats');
  const [sortBy, setSortBy] = useState<SortOption>('Relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const { results, loading, error } = useOpenLibrarySearch(query);
  const { create } = useBooks();

  const systemShelves = useMemo(() => getSystemShelves(db), [db]);

  const filteredResults = useMemo(() => {
    let filtered = [...results];

    if (selectedGenres.size > 0) {
      filtered = filtered.filter((doc) => {
        const subjects = (doc.subject ?? []).map((s) => s.toLowerCase());
        return Array.from(selectedGenres).some((g) =>
          subjects.some((s) => s.includes(g.toLowerCase())),
        );
      });
    }

    if (yearFrom) {
      const from = parseInt(yearFrom, 10);
      if (!isNaN(from)) {
        filtered = filtered.filter(
          (doc) => doc.first_publish_year && doc.first_publish_year >= from,
        );
      }
    }
    if (yearTo) {
      const to = parseInt(yearTo, 10);
      if (!isNaN(to)) {
        filtered = filtered.filter(
          (doc) => doc.first_publish_year && doc.first_publish_year <= to,
        );
      }
    }

    if (sortBy === 'Title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'Year') {
      filtered.sort(
        (a, b) => (b.first_publish_year ?? 0) - (a.first_publish_year ?? 0),
      );
    } else if (sortBy === 'Author') {
      filtered.sort((a, b) =>
        parseAuthors(a.author_name).localeCompare(parseAuthors(b.author_name)),
      );
    }

    return filtered;
  }, [results, selectedGenres, yearFrom, yearTo, sortBy]);

  const visibleResults = filteredResults.slice(0, visibleCount);
  const hasMore = visibleCount < filteredResults.length;

  const handleSearch = useCallback(() => {
    if (query.trim().length >= 2 && !recentSearches.includes(query.trim())) {
      setRecentSearches((prev) => [query.trim(), ...prev].slice(0, 10));
    }
  }, [query, recentSearches]);

  const handleRemoveRecent = useCallback((term: string) => {
    setRecentSearches((prev) => prev.filter((s) => s !== term));
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }, []);

  const handleAdd = useCallback(
    (doc: OLSearchDoc) => {
      if (addingKeys[doc.key]) return;

      const addToShelf = (shelfId: string, shelfName: string) => {
        setAddingKeys((current) => ({ ...current, [doc.key]: true }));
        try {
          const bookInsert = olSearchDocToBook(doc);
          const book = create(bookInsert);
          addBookToShelf(db, book.id, shelfId);
          Alert.alert('Added', `"${book.title}" added to ${shelfName}.`);
        } finally {
          setAddingKeys((current) => {
            const next = { ...current };
            delete next[doc.key];
            return next;
          });
        }
      };

      const options = [
        ...systemShelves.map((shelf) => ({
          text: shelf.name,
          onPress: () => addToShelf(shelf.id, shelf.name),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ];

      Alert.alert(
        'Add to Shelf',
        `Where would you like to add "${doc.title}"?`,
        options,
      );
    },
    [addingKeys, create, systemShelves, db],
  );

  const cycleSortBy = useCallback(() => {
    setSortBy((current) => {
      const idx = SORT_OPTIONS.indexOf(current);
      return SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
    });
  }, []);

  const renderSearchCard = (doc: OLSearchDoc) => {
    const coverUrl = getCoverUrl(doc);
    return (
      <View key={doc.key} style={styles.card}>
        <View style={styles.coverContainer}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Text
                variant="caption"
                color={colors.textTertiary}
                style={{ textAlign: 'center' }}
              >
                No Cover
              </Text>
            </View>
          )}
          <View style={styles.ghostBorder} />
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {doc.title}
        </Text>
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {parseAuthors(doc.author_name)}
        </Text>

        <View style={styles.cardMeta}>
          {doc.isbn?.[0] && (
            <Text style={styles.metaLabel}>
              ISBN: {doc.isbn[0]}
            </Text>
          )}
          {doc.first_publish_year && (
            <Text style={styles.metaLabel}>
              PUB: {doc.first_publish_year}
            </Text>
          )}
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => handleAdd(doc)}
          disabled={addingKeys[doc.key]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add to shelf"
        >
          <PlusIcon size={18} color={BOOKS_ACCENT} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <SearchIcon size={18} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search your digital sanctuary..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <Pressable
            onPress={() => router.push('/(books)/scan')}
            hitSlop={8}
            style={styles.scanBtn}
          >
            <ScanIcon size={20} color={BOOKS_ACCENT} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Recent Searches */}
        {query.length === 0 && recentSearches.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentLabel}>RECENT SEARCHES</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentChips}
            >
              {recentSearches.map((term) => (
                <View key={term} style={styles.recentChip}>
                  <Pressable onPress={() => setQuery(term)}>
                    <Text style={styles.recentChipText}>{term}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveRecent(term)}
                    hitSlop={6}
                    style={styles.recentChipX}
                  >
                    <XIcon size={12} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {query.length === 0 && (
          <EmptyState
            icon="🔍"
            title="Discover your next read"
            message="Search Open Library's 30M+ titles by title, author, or ISBN."
            actionLabel="Scan Barcode"
            onAction={() => router.push('/(books)/scan')}
            accentColor={BOOKS_ACCENT}
          />
        )}

        {/* Loading */}
        {query.length >= 2 && loading && <LoadingState rows={4} />}

        {/* Error */}
        {query.length >= 2 && error && (
          <ErrorState message="Search failed. Please try again." />
        )}

        {/* No results */}
        {query.length >= 2 && !loading && !error && results.length === 0 && (
          <EmptyState
            icon="📭"
            title="No matches found"
            message="Try a different title, author, or ISBN."
            actionLabel="Add Manually"
            onAction={() => router.push('/(books)/book/add')}
            accentColor={BOOKS_ACCENT}
          />
        )}

        {/* Results */}
        {!loading && !error && filteredResults.length > 0 && (
          <>
            {/* Filter toggle + Results header */}
            <View style={styles.resultsHeader}>
              <View style={styles.resultsHeaderLeft}>
                <Text style={styles.resultsCount}>
                  {filteredResults.length} Results for{' '}
                </Text>
                <Text style={styles.resultsQuery}>"{query}"</Text>
              </View>
              <View style={styles.resultsHeaderRight}>
                <Pressable
                  onPress={() => setShowFilters((v) => !v)}
                  style={styles.filterToggle}
                  hitSlop={8}
                >
                  <FilterIcon size={16} color={BOOKS_ACCENT} />
                </Pressable>
                <Pressable onPress={cycleSortBy} hitSlop={8}>
                  <Text style={styles.sortLabel}>
                    SORTED BY {sortBy.toUpperCase()}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Collapsible Filters */}
            {showFilters && (
              <GlassCard level={1} style={styles.filterCard}>
                <Text style={styles.filterSectionTitle}>REFINE SEARCH</Text>

                {/* Genre */}
                <Text style={styles.filterLabel}>Genre</Text>
                <View style={styles.genreWrap}>
                  {GENRES.map((g) => (
                    <GenreChip
                      key={g}
                      label={g}
                      selected={selectedGenres.has(g)}
                      onPress={() => toggleGenre(g)}
                      style={styles.genreChip}
                    />
                  ))}
                </View>

                {/* Min Rating */}
                <Text style={styles.filterLabel}>Minimum Rating</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() =>
                        setMinRating(minRating === star ? 0 : star)
                      }
                      hitSlop={4}
                    >
                      <StarIcon
                        size={22}
                        color={BOOKS_ACCENT}
                        fill={star <= minRating ? BOOKS_ACCENT : 'transparent'}
                      />
                    </Pressable>
                  ))}
                </View>

                {/* Publication Year */}
                <Text style={styles.filterLabel}>Publication Year</Text>
                <View style={styles.yearRow}>
                  <TextInput
                    value={yearFrom}
                    onChangeText={setYearFrom}
                    placeholder="From"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.yearInput}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <TextInput
                    value={yearTo}
                    onChangeText={setYearTo}
                    placeholder="To"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.yearInput}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>

                {/* Format */}
                <Text style={styles.filterLabel}>Format</Text>
                <Pressable
                  style={styles.formatDropdown}
                  onPress={() => {
                    const idx = FORMATS.indexOf(selectedFormat);
                    setSelectedFormat(
                      FORMATS[(idx + 1) % FORMATS.length],
                    );
                  }}
                >
                  <Text style={styles.formatText}>{selectedFormat}</Text>
                  <ChevronDownIcon size={16} color={colors.textTertiary} />
                </Pressable>
              </GlassCard>
            )}

            {/* 2-column grid */}
            <View style={styles.grid}>
              {visibleResults.map((doc) => renderSearchCard(doc))}
            </View>

            {/* Load More */}
            {hasMore && (
              <View style={styles.loadMore}>
                <GradientButton
                  label="LOAD MORE CURATED WORKS"
                  onPress={() => setVisibleCount((c) => c + 10)}
                />
              </View>
            )}
          </>
        )}

        {/* Manual add link */}
        <Pressable
          onPress={() => router.push('/(books)/book/add')}
          style={styles.manualLink}
        >
          <Text variant="caption" color={BOOKS_ACCENT}>
            Can't find your book? Add it manually.
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },

  // Search bar
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#E4E1E9',
    marginLeft: 10,
    paddingVertical: 0,
  },
  scanBtn: {
    marginLeft: 8,
    padding: 4,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Recent searches
  recentSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  recentLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    marginBottom: 10,
  },
  recentChips: {
    flexDirection: 'row',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 6,
  },
  recentChipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
  },
  recentChipX: {
    padding: 2,
  },

  // Results header
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  resultsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  resultsCount: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  resultsQuery: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: BOOKS_ACCENT,
    fontStyle: 'italic',
  },
  resultsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterToggle: {
    padding: 4,
  },
  sortLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    fontSize: 10,
  },

  // Filters
  filterCard: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    marginBottom: 16,
  },
  filterLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
    marginBottom: 8,
    marginTop: 12,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    marginBottom: 0,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
  },
  yearRow: {
    flexDirection: 'row',
    gap: 12,
  },
  yearInput: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#E4E1E9',
  },
  formatDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formatText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#E4E1E9',
  },

  // 2-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    padding: 12,
    position: 'relative',
  },
  coverContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
  },
  coverPlaceholder: {
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BOOKS_GHOST_BORDER,
  },
  cardTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
    marginTop: 12,
  },
  cardAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
    marginTop: 2,
  },
  cardMeta: {
    marginTop: 8,
    gap: 2,
  },
  metaLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: '#9F8E81',
  },
  addBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Load more
  loadMore: {
    alignItems: 'center',
    marginTop: 24,
  },

  manualLink: {
    alignItems: 'center',
    paddingTop: 20,
  },
});
