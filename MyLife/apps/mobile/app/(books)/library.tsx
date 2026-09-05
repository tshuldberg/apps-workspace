import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Image,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LoadingState, EmptyState, colors, spacing } from '@mylife/ui';
import { BookList } from '../../components/books/BookList';
import { useBooks } from '../../hooks/books/use-books';
import { useReviews } from '../../hooks/books/use-reviews';
import { getSessions, getLatestProgress } from '@mylife/books';
import {
  BookCard,
  GenreChip,
  ReadingProgressBar,
  BOOKS_SURFACES,
  BOOKS_GHOST_BORDER,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { getBooksSettings, setBooksDefaultSort } from '../../lib/books/settings';

const BOOKS_ACCENT = colors.modules.books;

type ViewMode = 'grid' | 'list';
type SortField = 'title' | 'added' | 'author' | 'rating';
type StatusFilter = 'all' | 'want_to_read' | 'reading';

const SORT_LABELS: Record<SortField, string> = {
  added: 'Recently Added',
  title: 'Title',
  author: 'Author',
  rating: 'Rating',
};

function firstAuthor(authors: string): string {
  try {
    const parsed = JSON.parse(authors) as string[];
    return parsed[0] ?? '';
  } catch {
    return authors;
  }
}

function buildRatingMap(
  reviews: Array<{ book_id: string; rating: number | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of reviews) {
    if (r.rating != null && r.rating > 0) {
      map.set(r.book_id, r.rating);
    }
  }
  return map;
}

export default function LibraryScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortField>('added');
  const [filterText, setFilterText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { books: allBooks, loading, refresh } = useBooks();
  const { reviews } = useReviews();
  const ratingMap = useMemo(() => buildRatingMap(reviews), [reviews]);

  // Book-to-status map from reading sessions (most recent session wins)
  const sessions = useMemo(() => getSessions(db), [db, allBooks]);
  const bookStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      if (!map.has(s.book_id)) {
        map.set(s.book_id, s.status);
      }
    }
    return map;
  }, [sessions]);

  // Completion rate: finished / total
  const completionRate = useMemo(() => {
    if (allBooks.length === 0) return 0;
    let finished = 0;
    for (const book of allBooks) {
      if (bookStatusMap.get(book.id) === 'finished') finished++;
    }
    return Math.round((finished / allBooks.length) * 100);
  }, [allBooks, bookStatusMap]);

  useEffect(() => {
    const settings = getBooksSettings(db);
    setSortBy(settings.defaultSort);
  }, [db]);

  // Status filter
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return allBooks;
    return allBooks.filter((b) => bookStatusMap.get(b.id) === statusFilter);
  }, [allBooks, statusFilter, bookStatusMap]);

  // Text filter (kept for search parity)
  const filteredBooks = useMemo(() => {
    if (filterText.length === 0) return statusFiltered;
    const q = filterText.toLowerCase();
    return statusFiltered.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authors.toLowerCase().includes(q),
    );
  }, [statusFiltered, filterText]);

  // Sort
  const sortedBooks = useMemo(() => {
    const next = [...filteredBooks];
    if (sortBy === 'title') {
      next.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      next.sort((a, b) =>
        firstAuthor(a.authors).localeCompare(firstAuthor(b.authors)),
      );
    } else if (sortBy === 'rating') {
      next.sort(
        (a, b) => (ratingMap.get(b.id) ?? 0) - (ratingMap.get(a.id) ?? 0),
      );
    } else {
      next.sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
      );
    }
    return next;
  }, [filteredBooks, sortBy, ratingMap]);

  // Featured book: currently reading, or most recently added
  const featuredBook = useMemo(() => {
    const reading = allBooks.find(
      (b) => bookStatusMap.get(b.id) === 'reading',
    );
    if (reading) return reading;
    const sorted = [...allBooks].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );
    return sorted[0] ?? null;
  }, [allBooks, bookStatusMap]);

  // Featured book progress from session current_page / page_count
  const featuredProgress = useMemo(() => {
    if (!featuredBook) return 0;
    // Try progress updates first
    const latest = getLatestProgress(db, featuredBook.id);
    if (latest?.percent_complete != null && latest.percent_complete > 0) {
      return latest.percent_complete > 1
        ? latest.percent_complete / 100
        : latest.percent_complete;
    }
    // Fall back to session current_page / page_count
    const session = sessions.find(
      (s) => s.book_id === featuredBook.id && s.status === 'reading',
    );
    if (session && featuredBook.page_count && session.current_page > 0) {
      return session.current_page / featuredBook.page_count;
    }
    return 0;
  }, [db, featuredBook, sessions]);

  // Grid books: exclude featured in grid mode
  const gridBooks = useMemo(() => {
    if (!featuredBook || viewMode !== 'grid') return sortedBooks;
    return sortedBooks.filter((b) => b.id !== featuredBook.id);
  }, [sortedBooks, featuredBook, viewMode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(refresh());
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const cycleSort = useCallback(() => {
    const order: SortField[] = ['added', 'title', 'author', 'rating'];
    const index = order.indexOf(sortBy);
    const next = order[(index + 1) % order.length];
    setSortBy(next);
    setBooksDefaultSort(db, next);
  }, [db, sortBy]);

  const getStatusLabel = useCallback(
    (bookId: string): string | undefined => {
      const status = bookStatusMap.get(bookId);
      if (status === 'reading') return 'READING';
      if (status === 'want_to_read') return 'UNREAD';
      return undefined;
    },
    [bookStatusMap],
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <LoadingState rows={5} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BOOKS_ACCENT}
              colors={[BOOKS_ACCENT]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.collectionLabel}>PERSONAL COLLECTION</Text>
            <Text style={styles.heroTitle}>MyBooks</Text>
          </View>

          {/* Stat Badges */}
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>TOTAL ARCHIVE</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{allBooks.length}</Text>
                <Text style={styles.statUnit}>VOLUMES</Text>
              </View>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>COMPLETION</Text>
              <Text style={styles.statValue}>{completionRate}%</Text>
            </View>
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <GenreChip
              label="All"
              selected={statusFilter === 'all'}
              onPress={() => setStatusFilter('all')}
            />
            <GenreChip
              label="Want to Read"
              selected={statusFilter === 'want_to_read'}
              onPress={() => setStatusFilter('want_to_read')}
            />
            <GenreChip
              label="Currently Read"
              selected={statusFilter === 'reading'}
              onPress={() => setStatusFilter('reading')}
            />
          </ScrollView>

          {/* Sort + View Toggle */}
          <View style={styles.controlsRow}>
            <Pressable onPress={cycleSort} style={styles.sortButton}>
              <Text style={styles.sortText}>
                ≡ Sort: {SORT_LABELS[sortBy]}
              </Text>
              <Text style={styles.sortChevron}>▾</Text>
            </Pressable>
            <View style={styles.viewToggles}>
              <Pressable
                onPress={() => setViewMode('grid')}
                style={[
                  styles.viewToggle,
                  viewMode === 'grid' && styles.viewToggleActive,
                ]}
              >
                <Text
                  style={[
                    styles.viewIcon,
                    viewMode === 'grid' && styles.viewIconActive,
                  ]}
                >
                  ⊞
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('list')}
                style={[
                  styles.viewToggle,
                  viewMode === 'list' && styles.viewToggleActive,
                ]}
              >
                <Text
                  style={[
                    styles.viewIcon,
                    viewMode === 'list' && styles.viewIconActive,
                  ]}
                >
                  ☰
                </Text>
              </Pressable>
            </View>
          </View>

          {sortedBooks.length === 0 ? (
            <EmptyState
              icon="📚"
              title={
                statusFilter !== 'all'
                  ? 'No books here'
                  : 'Your library is waiting'
              }
              message={
                statusFilter !== 'all'
                  ? `No books match this filter. ${allBooks.length} books total.`
                  : 'Search, scan, or import to build your personal library.'
              }
              actionLabel={
                statusFilter !== 'all' ? 'Show All Books' : 'Add a Book'
              }
              onAction={
                statusFilter !== 'all'
                  ? () => setStatusFilter('all')
                  : () => router.push('/(books)/search')
              }
              accentColor={BOOKS_ACCENT}
            />
          ) : (
            <>
              {/* Featured Book Hero */}
              {featuredBook && viewMode === 'grid' && (
                <Pressable
                  onPress={() =>
                    router.push(`/(books)/book/${featuredBook.id}`)
                  }
                  style={styles.featuredSection}
                >
                  {featuredBook.cover_url && (
                    <View style={styles.featuredCoverWrap}>
                      <Image
                        source={{ uri: featuredBook.cover_url }}
                        style={styles.featuredCover}
                        resizeMode="cover"
                      />
                      <View style={styles.featuredGhostBorder} />
                    </View>
                  )}
                  <Text style={styles.featuredLabel}>FEATURED CLASSIC</Text>
                  <Text style={styles.featuredTitle}>
                    {featuredBook.title}
                  </Text>
                  <Text style={styles.featuredAuthor}>
                    {firstAuthor(featuredBook.authors)}
                  </Text>
                  {featuredBook.description && (
                    <Text style={styles.featuredSynopsis} numberOfLines={3}>
                      {featuredBook.description}
                    </Text>
                  )}
                  {featuredProgress > 0 && (
                    <View style={styles.progressSection}>
                      <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>PROGRESS</Text>
                        <Text style={styles.progressValue}>
                          {Math.round(featuredProgress * 100)}%
                        </Text>
                      </View>
                      <ReadingProgressBar progress={featuredProgress} />
                    </View>
                  )}
                </Pressable>
              )}

              {/* Book Grid / List */}
              {viewMode === 'grid' ? (
                <View style={styles.grid}>
                  {gridBooks.map((book) => (
                    <View key={book.id} style={styles.gridCell}>
                      <BookCard
                        title={book.title}
                        author={firstAuthor(book.authors)}
                        coverUri={book.cover_url ?? undefined}
                        rating={ratingMap.get(book.id)}
                        statusLabel={getStatusLabel(book.id)}
                        onPress={() =>
                          router.push(`/(books)/book/${book.id}`)
                        }
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <BookList
                  books={sortedBooks}
                  onPress={(id) => router.push(`/(books)/book/${id}`)}
                />
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl + 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  collectionLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: '#C9894D',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 32,
    color: '#E4E1E9',
    letterSpacing: -0.5,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statBadge: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 1,
    color: '#D6C3B5',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
  },
  statUnit: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: '#D6C3B5',
    textTransform: 'uppercase',
  },

  // Filter chips
  chipsRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },

  // Controls
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  sortChevron: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#D6C3B5',
  },
  viewToggles: {
    flexDirection: 'row',
    gap: 4,
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BOOKS_SURFACES.lift,
  },
  viewToggleActive: {
    backgroundColor: BOOKS_SURFACES.focus,
  },
  viewIcon: {
    fontSize: 16,
    color: '#D6C3B5',
  },
  viewIconActive: {
    color: '#E4E1E9',
  },

  // Featured
  featuredSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  featuredCoverWrap: {
    width: '65%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  featuredCover: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  featuredGhostBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BOOKS_GHOST_BORDER,
  },
  featuredLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: '#C9894D',
    textTransform: 'uppercase',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  featuredTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: '#E4E1E9',
    letterSpacing: -0.3,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  featuredAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#D6C3B5',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  featuredSynopsis: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  progressSection: {
    width: '100%',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#D6C3B5',
    textTransform: 'uppercase',
  },
  progressValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#C9894D',
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  gridCell: {
    width: '48%' as unknown as number,
    marginBottom: 16,
  },
});
