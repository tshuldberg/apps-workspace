import { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  Image,
  Text as RNText,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookCover, ErrorState } from '@mylife/ui';
import {
  GlassCard,
  StatBadge,
  GenreChip,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useSeries } from '../../../hooks/books/use-series';
import { useBooks as useAllBooks } from '../../../hooks/books/use-books';
import type { Book } from '@mylife/books';
import Svg, { Circle } from 'react-native-svg';

const ACCENT = '#C9894D';

// ── Progress Ring ─────────────────────────────────────────

function ProgressRing({ progress, size = 120 }: { progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference * (1 - clamped);
  const pct = Math.round(clamped * 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BOOKS_SURFACES.highest}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ACCENT}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill as any}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <RNText style={ringStyles.pct}>{pct}%</RNText>
        </View>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  pct: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
  },
});

// ── Helpers ───────────────────────────────────────────────

function parseAuthors(authors: string): string {
  try {
    const parsed = JSON.parse(authors) as string[];
    return parsed[0] ?? authors;
  } catch {
    return authors;
  }
}

function parseSubjects(subjects: string | null): string[] {
  if (!subjects) return [];
  try {
    return JSON.parse(subjects) as string[];
  } catch {
    return [];
  }
}

function formatPages(n: number): string {
  return n.toLocaleString();
}

// ── Screen ────────────────────────────────────────────────

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { allSeries, getBooks: getSeriesBooks, addBook } = useSeries();
  const { books: allBooks } = useAllBooks();
  const [booksInSeries, setBooksInSeries] = useState<(Book & { sort_order: number })[]>([]);
  const [showBookPicker, setShowBookPicker] = useState(false);

  const series = allSeries.find((s) => s.id === id);

  useEffect(() => {
    if (id) {
      setBooksInSeries(getSeriesBooks(id) as (Book & { sort_order: number })[]);
    }
  }, [id, getSeriesBooks]);

  // Computed stats
  const stats = useMemo(() => {
    const totalBooks = booksInSeries.length;
    const totalPages = booksInSeries.reduce((sum, b) => sum + (b.page_count ?? 0), 0);
    // Approximate completed as books with reading sessions marked finished
    // For display, we estimate from the data we have
    const completed = 0; // Will be computed when we have session data
    const pagesRead = 0;
    return { totalBooks, totalPages, completed, pagesRead };
  }, [booksInSeries]);

  // Collect unique genres from all books in series
  const genres = useMemo(() => {
    const all = new Set<string>();
    booksInSeries.forEach((b) => {
      parseSubjects(b.subjects).forEach((s) => all.add(s));
    });
    return Array.from(all).slice(0, 6);
  }, [booksInSeries]);

  // Primary author (from first book)
  const primaryAuthor = useMemo(() => {
    if (booksInSeries.length === 0) return null;
    return parseAuthors(booksInSeries[0].authors);
  }, [booksInSeries]);

  // Hero cover (first book with cover)
  const heroCover = useMemo(() => {
    return booksInSeries.find((b) => b.cover_url)?.cover_url ?? null;
  }, [booksInSeries]);

  // Books not already in this series for the picker
  const availableBooks = useMemo(() => {
    const inSeries = new Set(booksInSeries.map((b) => b.id));
    return allBooks.filter((b) => !inSeries.has(b.id));
  }, [allBooks, booksInSeries]);

  const handleAddBook = (bookId: string) => {
    if (!id) return;
    addBook(id, bookId, booksInSeries.length + 1);
    setBooksInSeries(getSeriesBooks(id) as (Book & { sort_order: number })[]);
    setShowBookPicker(false);
  };

  if (!series) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState message="Series not found." />
      </View>
    );
  }

  const progressFraction = stats.totalPages > 0 ? stats.pagesRead / stats.totalPages : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Cover */}
      {heroCover && (
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: heroCover }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroBadge}>
            <RNText style={styles.heroBadgeText}>SERIES</RNText>
          </View>
        </View>
      )}

      {/* Title + Author */}
      <View style={styles.titleSection}>
        <RNText style={styles.seriesTitle}>{series.name}</RNText>
        {primaryAuthor && (
          <RNText style={styles.authorLabel}>
            AUTHOR: {primaryAuthor.toUpperCase()}
          </RNText>
        )}
        {series.description && (
          <RNText style={styles.description}>{series.description}</RNText>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatBadge
          value={String(stats.totalBooks).padStart(2, '0')}
          label="TOTAL BOOKS"
          style={styles.statBadge}
        />
        <StatBadge
          value={String(stats.completed).padStart(2, '0')}
          label="COMPLETED"
          style={styles.statBadge}
        />
        <StatBadge
          value={formatPages(stats.totalPages)}
          label="TOTAL PAGES"
          style={styles.statBadge}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.outlineButton}
          onPress={() => setShowBookPicker(true)}
        >
          <RNText style={styles.outlineButtonIcon}>+</RNText>
          <RNText style={styles.outlineButtonLabel}>Add Book{'\n'}to Series</RNText>
        </Pressable>
        <Pressable style={styles.outlineButton}>
          <RNText style={styles.outlineButtonIcon}>{'\u2699'}</RNText>
          <RNText style={styles.outlineButtonLabel}>Manage{'\n'}Metadata</RNText>
        </Pressable>
      </View>

      {/* Series Order */}
      {booksInSeries.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <RNText style={styles.sectionTitle}>Series Order</RNText>
            <View style={styles.viewIcons}>
              <RNText style={styles.viewIcon}>{'\u2261'}</RNText>
              <RNText style={styles.viewIcon}>{'\u2630'}</RNText>
            </View>
          </View>

          {booksInSeries.map((book, i) => (
            <Pressable
              key={book.id}
              onPress={() => router.push(`/(books)/book/${book.id}`)}
            >
              <GlassCard level={2} style={styles.bookRow}>
                <View style={styles.bookRowInner}>
                  {/* Drag Handle */}
                  <RNText style={styles.dragHandle}>{'\u2237'}</RNText>

                  {/* Number */}
                  <View style={styles.numberCircle}>
                    <RNText style={styles.numberText}>{i + 1}</RNText>
                  </View>

                  {/* Cover */}
                  <BookCover
                    coverUrl={book.cover_url}
                    size="small"
                    title={book.title}
                  />

                  {/* Info */}
                  <View style={styles.bookInfo}>
                    <RNText style={styles.bookTitle} numberOfLines={2}>
                      {book.title}
                    </RNText>
                    <RNText style={styles.bookMeta}>
                      Published {book.publish_year ?? 'N/A'} {'\u2022'}{' '}
                      {book.page_count ?? '?'} Pages
                    </RNText>
                  </View>

                  {/* Read checkbox placeholder */}
                  <View style={styles.checkbox} />
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}

      {/* Series Progression */}
      <GlassCard level={1} style={styles.progressionCard}>
        <RNText style={styles.progressionLabel}>SERIES PROGRESSION</RNText>
        <View style={styles.progressionContent}>
          <ProgressRing progress={progressFraction} size={110} />
          <View style={styles.progressionStats}>
            <View style={styles.progressionRow}>
              <RNText style={styles.progressionStatLabel}>Pages Read</RNText>
              <RNText style={styles.progressionStatValue}>
                {formatPages(stats.pagesRead)} / {formatPages(stats.totalPages)}
              </RNText>
            </View>
            <View style={styles.progressionRow}>
              <RNText style={styles.progressionStatLabel}>Est. Time Remaining</RNText>
              <RNText style={styles.progressionStatValue}>--</RNText>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* Library Categories */}
      {genres.length > 0 && (
        <GlassCard level={1} style={styles.categoriesCard}>
          <RNText style={styles.categoriesLabel}>LIBRARY CATEGORIES</RNText>
          <View style={styles.chipRow}>
            {genres.map((g) => (
              <GenreChip key={g} label={g} />
            ))}
          </View>
        </GlassCard>
      )}

      {/* Activity Log */}
      <GlassCard level={1} style={styles.activityCard}>
        <RNText style={styles.activityLabel}>ACTIVITY LOG</RNText>
        {booksInSeries.length > 0 ? (
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <RNText style={styles.bullet}>{'\u2022'}</RNText>
              <View>
                <RNText style={styles.activityText}>
                  Added{' '}
                  <RNText style={styles.activityBold}>
                    {booksInSeries[booksInSeries.length - 1].title}
                  </RNText>
                  {' '}to series
                </RNText>
                <RNText style={styles.activityTime}>Recently</RNText>
              </View>
            </View>
            <View style={styles.activityItem}>
              <RNText style={styles.bullet}>{'\u2022'}</RNText>
              <View>
                <RNText style={styles.activityText}>Updated series order</RNText>
                <RNText style={styles.activityTime}>Recently</RNText>
              </View>
            </View>
          </View>
        ) : (
          <RNText style={styles.activityEmpty}>No activity yet.</RNText>
        )}
      </GlassCard>

      {/* Book Picker Modal */}
      <Modal
        visible={showBookPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBookPicker(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowBookPicker(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Add Book to Series</RNText>
              <Pressable onPress={() => setShowBookPicker(false)} hitSlop={12}>
                <RNText style={styles.modalClose}>{'\u2715'}</RNText>
              </Pressable>
            </View>
            <FlatList
              data={availableBooks}
              keyExtractor={(b) => b.id}
              style={styles.bookList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.bookPickerRow}
                  onPress={() => handleAddBook(item.id)}
                >
                  <BookCover
                    coverUrl={item.cover_url}
                    size="small"
                    title={item.title}
                  />
                  <View style={styles.bookPickerInfo}>
                    <RNText style={styles.bookPickerTitle} numberOfLines={1}>
                      {item.title}
                    </RNText>
                    <RNText style={styles.bookPickerAuthor} numberOfLines={1}>
                      {parseAuthors(item.authors)}
                    </RNText>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <RNText style={styles.emptyPicker}>
                  No books available to add.
                </RNText>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroWrap: {
    height: 280,
    width: '100%',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19,19,24,0.4)',
  },
  heroBadge: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    backgroundColor: ACCENT,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: '#1a1008',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Title
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  seriesTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  authorLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    fontSize: 12,
    marginBottom: 12,
  },
  description: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 24,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statBadge: {
    flex: 1,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 28,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  outlineButtonIcon: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 18,
    color: '#E4E1E9',
  },
  outlineButtonLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#E4E1E9',
    textAlign: 'center',
  },

  // Series Order Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  viewIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  viewIcon: {
    fontSize: 20,
    color: '#9F8E81',
  },

  // Book Row
  bookRow: {
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  bookRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dragHandle: {
    fontSize: 16,
    color: '#9F8E81',
  },
  numberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#1a1008',
  },
  bookInfo: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  bookMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#9F8E81',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  // Progression Card
  progressionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
  },
  progressionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
    marginBottom: 20,
  },
  progressionContent: {
    alignItems: 'center',
    gap: 20,
  },
  progressionStats: {
    width: '100%',
    gap: 12,
  },
  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressionStatLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },
  progressionStatValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },

  // Categories Card
  categoriesCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
  },
  categoriesLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Activity Log Card
  activityCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
  },
  activityLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
    marginBottom: 14,
  },
  activityList: {
    gap: 14,
  },
  activityItem: {
    flexDirection: 'row',
    gap: 10,
  },
  bullet: {
    fontSize: 16,
    color: '#E4E1E9',
    marginTop: -2,
  },
  activityText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    lineHeight: 20,
  },
  activityBold: {
    fontFamily: JAKARTA_FONTS.semiBold,
    color: '#E4E1E9',
  },
  activityTime: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(228,225,233,0.35)',
    marginTop: 2,
  },
  activityEmpty: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#9F8E81',
  },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modal: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: '#E4E1E9',
  },
  modalClose: {
    fontSize: 20,
    color: '#9F8E81',
  },
  bookList: {
    maxHeight: 400,
  },
  bookPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  bookPickerInfo: {
    flex: 1,
    gap: 2,
  },
  bookPickerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  bookPickerAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },
  emptyPicker: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#9F8E81',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
