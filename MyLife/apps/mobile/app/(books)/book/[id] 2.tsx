import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text, BookCover, StarRating, ErrorState } from '@mylife/ui';
import {
  GlassCard,
  GenreChip,
  ReadingProgressBar,
  GradientButton,
  BOOKS_TYPOGRAPHY,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useBook } from '../../../hooks/books/use-books';
import { useSessions } from '../../../hooks/books/use-sessions';
import { useReviewForBook } from '../../../hooks/books/use-reviews';
import { useBookTags } from '../../../hooks/books/use-tags';
import { useDatabase } from '../../../components/DatabaseProvider';
import { useShelves } from '../../../hooks/books/use-shelves';
import { useProgress } from '../../../hooks/books/use-progress';
import { useContentWarnings } from '../../../hooks/books/use-content-warnings';
import { ProgressLogSheet } from '../../../components/books/ProgressLogSheet';
import {
  deleteBook,
  moveBookToShelf,
  getSeriesForBook,
  getBooksInSeries,
  type Series,
  type Book as BookType,
} from '@mylife/books';

const ACCENT = '#C9894D';

function parseAuthors(authors: string): string[] {
  try {
    return JSON.parse(authors);
  } catch {
    return [authors];
  }
}

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const { book } = useBook(id);
  const { sessions } = useSessions(id);
  const { review, save: saveReview } = useReviewForBook(id);
  useBookTags(id);
  const { shelves } = useShelves();
  const { speed, latestPage } = useProgress(id!);
  const { warnings, moods } = useContentWarnings(id!);

  const session = sessions.length > 0 ? sessions[0] : undefined;

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  // Series data
  const [bookSeries, setBookSeries] = useState<
    Array<{ series: Series; books: Array<BookType & { sort_order: number }> }>
  >([]);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id]);

  useEffect(() => {
    setRating(review?.rating ?? 0);
    setReviewText(review?.review_text ?? '');
  }, [review]);

  useEffect(() => {
    if (!id) return;
    try {
      const seriesList = getSeriesForBook(db, id);
      const result = seriesList.map((s) => ({
        series: s,
        books: getBooksInSeries(db, s.id),
      }));
      setBookSeries(result);
    } catch {
      // Series data is supplemental
    }
  }, [db, id]);

  const handleRatingChange = useCallback(
    (newRating: number) => {
      setRating(newRating);
      saveReview({ rating: newRating, review_text: reviewText || undefined });
    },
    [saveReview, reviewText],
  );

  const handleReviewSave = useCallback(() => {
    saveReview({ rating: rating || undefined, review_text: reviewText || undefined });
  }, [saveReview, reviewText, rating]);

  const handleStatusPress = useCallback(() => {
    if (!id) return;
    const options = [
      ...shelves.map((shelf) => ({
        text: shelf.name,
        onPress: () => {
          moveBookToShelf(db, id, shelf.id);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Reading Status', 'Choose a reading status.', options);
  }, [db, id, shelves]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Delete Book',
      'Remove this book from your library? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBook(db, id);
            router.back();
          },
        },
      ],
    );
  }, [db, id, router]);

  // Derived data
  const authors = useMemo(() => (book ? parseAuthors(book.authors) : []), [book]);
  const statusLabel = useMemo(() => {
    if (!session) return 'Want to Read';
    switch (session.status) {
      case 'reading':
        return 'Currently Reading';
      case 'finished':
        return 'Finished';
      case 'dnf':
        return 'Did Not Finish';
      default:
        return 'Want to Read';
    }
  }, [session]);

  const currentPage = session?.current_page ?? latestPage ?? 0;
  const totalPages = book?.page_count ?? 0;
  const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const progressFraction = totalPages > 0 ? currentPage / totalPages : 0;

  // Reading stats
  const startedDate = useMemo(() => {
    if (!session?.started_at) return null;
    return new Date(session.started_at);
  }, [session]);

  const estimatedCompletion = useMemo(() => {
    if (!speed || !totalPages || totalPages === 0 || currentPage >= totalPages) return null;
    const pagesRemaining = totalPages - currentPage;
    const hoursRemaining = pagesRemaining / speed.averagePagesPerHour;
    const est = new Date();
    est.setHours(est.getHours() + hoursRemaining);
    return est;
  }, [speed, totalPages, currentPage]);

  const totalReadingTime = useMemo(() => {
    if (!speed) return null;
    if (speed.averagePagesPerHour <= 0 || currentPage === 0) return null;
    const hours = currentPage / speed.averagePagesPerHour;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }, [speed, currentPage]);

  // Mood chips from mood tags
  const moodChips = useMemo(() => {
    return moods
      .filter((m) => m.tag_type === 'mood' || m.tag_type === 'genre')
      .map((m) => m.value);
  }, [moods]);

  const warningChips = useMemo(() => {
    return warnings.map((w) => w.warning);
  }, [warnings]);

  // Series badges (shown below cover)
  const seriesBadges = useMemo(() => {
    return bookSeries.map((s) => {
      const idx = s.books.findIndex((b) => b.id === id);
      const volume = idx >= 0 ? idx + 1 : null;
      return { name: s.series.name, volume };
    });
  }, [bookSeries, id]);

  if (!book) {
    return (
      <View style={styles.emptyContainer}>
        <ErrorState message="Book not found." />
      </View>
    );
  }

  const favoriteQuote = review?.review_text
    ? review.review_text
    : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerTintColor: '#E4E1E9',
          headerRight: () => (
            <View style={styles.headerRight}>
              <Pressable hitSlop={8}>
                <Text style={styles.headerIcon}>{'\u2764\uFE0F'}</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.coverContainer}>
            <View style={styles.coverShadow}>
              <BookCover
                coverUrl={book.cover_url}
                size="detail"
                title={book.title}
                style={styles.cover}
              />
            </View>
          </View>

          {/* Series badges below cover */}
          {seriesBadges.length > 0 && (
            <View style={styles.seriesBadgeRow}>
              {seriesBadges.map((badge) => (
                <React.Fragment key={badge.name}>
                  {badge.volume && (
                    <View style={styles.seriesBadge}>
                      <Text style={styles.seriesBadgeText}>
                        VOLUME {badge.volume}
                      </Text>
                    </View>
                  )}
                  <View style={styles.seriesBadge}>
                    <Text style={styles.seriesBadgeText}>
                      {badge.name.toUpperCase()}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Title & Author */}
        <View style={styles.titleSection}>
          <Text style={styles.displayTitle}>{book.title}</Text>
          <Text style={styles.authorText}>{authors.join(', ')}</Text>
        </View>

        {/* Metadata Row */}
        <View style={styles.metaRow}>
          {book.publisher && (
            <MetaColumn label="PUBLISHER" value={book.publisher} />
          )}
          {book.publish_year && (
            <MetaColumn label="YEAR" value={String(book.publish_year)} />
          )}
          {totalPages > 0 && (
            <MetaColumn label="PAGES" value={String(totalPages)} />
          )}
          <MetaColumn label="FORMAT" value={book.format || 'Paperback'} />
        </View>

        {/* Reading Status Card */}
        <View style={styles.sectionPad}>
          <GlassCard level={2}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusLabel}>Reading{'\n'}Status</Text>
              <Pressable onPress={handleStatusPress} style={styles.statusPill}>
                <Text style={styles.statusPillText}>{statusLabel}</Text>
                <Text style={styles.statusChevron}>{'\u25BE'}</Text>
              </Pressable>
            </View>

            {totalPages > 0 && (
              <>
                <View style={styles.progressRow}>
                  <Text style={styles.progressPages}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Text style={styles.progressPct}>{progressPct}%</Text>
                </View>
                <ReadingProgressBar progress={progressFraction} height={6} />
              </>
            )}

            <GradientButton
              label="Log Reading Session"
              onPress={() => setShowLogSheet(true)}
              style={styles.logButton}
            />
          </GlassCard>
        </View>

        {/* Mood & Atmosphere */}
        {(moodChips.length > 0 || warningChips.length > 0) && (
          <View style={styles.sectionPad}>
            <Text style={styles.sectionLabel}>MOOD & ATMOSPHERE</Text>
            {moodChips.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScroll}
              >
                {moodChips.map((chip) => (
                  <GenreChip key={chip} label={chip} />
                ))}
              </ScrollView>
            )}
            {warningChips.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, styles.warningLabel]}>
                  CONTENT WARNINGS
                </Text>
                <View style={styles.chipRow}>
                  {warningChips.map((w) => (
                    <View key={w} style={styles.warningChip}>
                      <Text style={styles.warningChipText}>
                        {w.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Synopsis */}
        {book.description && (
          <View style={styles.sectionPad}>
            <Pressable
              onPress={() => setSynopsisExpanded(!synopsisExpanded)}
            >
              <Text style={styles.synopsisTitle}>Synopsis</Text>
            </Pressable>
            <Text
              style={styles.synopsisBody}
              numberOfLines={synopsisExpanded ? undefined : 6}
            >
              {book.description}
            </Text>
            {!synopsisExpanded && (
              <Pressable onPress={() => setSynopsisExpanded(true)}>
                <Text style={styles.readMore}>Read more</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* My Personal Review */}
        <View style={styles.sectionPad}>
          <GlassCard level={2}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>My Personal{'\n'}Review</Text>
              <StarRating
                rating={rating}
                onChange={handleRatingChange}
                size={22}
              />
            </View>

            {favoriteQuote && (
              <View style={styles.quoteBlock}>
                <Text style={styles.quoteText}>
                  {`\u201C${favoriteQuote}\u201D`}
                </Text>
              </View>
            )}

            <TextInput
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Write your thoughts here..."
              placeholderTextColor={BOOKS_SURFACES.highest}
              multiline
              style={styles.reviewInput}
            />

            <View style={styles.reviewActions}>
              <Pressable
                style={styles.reviewActionBtn}
                onPress={() => router.push('/(books)/quotes/new' as never)}
              >
                <Text style={styles.reviewActionIcon}>{'\uD83D\uDD16'}</Text>
                <Text style={styles.reviewActionLabel}>FAVORITE{'\n'}QUOTE</Text>
              </Pressable>
              <Pressable
                style={styles.reviewActionBtn}
                onPress={() =>
                  Alert.alert(
                    'Coming soon',
                    'Tag management is not yet available in this build.',
                  )
                }
              >
                <Text style={styles.reviewActionIcon}>#</Text>
                <Text style={styles.reviewActionLabel}>MANAGE{'\n'}TAGS</Text>
              </Pressable>
              <Pressable
                style={styles.reviewActionBtnAccent}
                onPress={handleReviewSave}
              >
                <Text style={styles.reviewActionLabelAccent}>
                  SAVE{'\n'}REVIEW
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>

        {/* Series Information */}
        {bookSeries.length > 0 &&
          bookSeries.map(({ series, books }) => {
            const currentIdx = books.findIndex((b) => b.id === id);
            return (
              <View key={series.id} style={styles.sectionPad}>
                <Text style={styles.sectionLabel}>SERIES INFORMATION</Text>
                <GlassCard level={2}>
                  <Text style={styles.seriesName}>{series.name}</Text>
                  <Text style={styles.seriesCount}>
                    Book {currentIdx >= 0 ? currentIdx + 1 : '?'} of{' '}
                    {books.length}
                  </Text>
                  <View style={styles.seriesBooksList}>
                    {books
                      .filter((b) => b.id !== id)
                      .map((b) => (
                        <Pressable
                          key={b.id}
                          style={styles.seriesBookRow}
                          onPress={() =>
                            router.push(`/(books)/book/${b.id}` as never)
                          }
                        >
                          <BookCover
                            coverUrl={b.cover_url}
                            size="small"
                            title={b.title}
                            style={styles.seriesBookCover}
                          />
                          <View style={styles.seriesBookInfo}>
                            <Text
                              style={styles.seriesBookTitle}
                              numberOfLines={1}
                            >
                              Vol {b.sort_order}: {b.title}
                            </Text>
                            <Text style={styles.seriesBookStatus}>
                              Vol {b.sort_order}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                  </View>
                </GlassCard>
              </View>
            );
          })}

        {/* Reading Stats */}
        {(totalReadingTime || startedDate || estimatedCompletion) && (
          <View style={styles.sectionPad}>
            <Text style={styles.sectionLabel}>READING STATS</Text>
            <View style={styles.statsGrid}>
              {totalReadingTime && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Time Reading</Text>
                  <Text style={styles.statValue}>{totalReadingTime}</Text>
                </View>
              )}
              {startedDate && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Started</Text>
                  <Text style={styles.statValue}>
                    {startedDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              {estimatedCompletion && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Est. Completion</Text>
                  <Text style={styles.statValue}>
                    {estimatedCompletion.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Pressable onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete from Library</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ProgressLogSheet
        bookId={id!}
        sessionId={session?.id ?? id!}
        pageCount={totalPages || null}
        visible={showLogSheet}
        onClose={() => setShowLogSheet(false)}
      />
    </>
  );
}

function MetaColumn({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCol}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 4,
  },
  headerIcon: {
    fontSize: 20,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 20,
  },
  coverContainer: {
    alignItems: 'center',
  },
  coverShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
    transform: [{ perspective: 800 }, { rotateY: '-5deg' }],
  },
  cover: {
    borderRadius: 6,
  },
  seriesBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  seriesBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  seriesBadgeText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#D6C3B5',
  },

  // Title & Author
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 8,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  authorText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 18,
    color: ACCENT,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  metaCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#9F8E81',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#E4E1E9',
  },

  // Section padding
  sectionPad: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  // Reading Status
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: '#D6C3B5',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.highest,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
  },
  statusPillText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
  },
  statusChevron: {
    fontSize: 12,
    color: '#D6C3B5',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  progressPages: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },
  progressPct: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: ACCENT,
  },
  logButton: {
    marginTop: 16,
  },

  // Mood & Atmosphere
  sectionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    marginBottom: 12,
  },
  chipScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  warningLabel: {
    marginTop: 20,
    color: '#FFB4AB',
  },
  warningChip: {
    backgroundColor: 'rgba(147, 0, 10, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  warningChipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#FFB4AB',
  },

  // Synopsis
  synopsisTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    marginBottom: 12,
  },
  synopsisBody: {
    ...BOOKS_TYPOGRAPHY.bodyMd,
    color: '#D6C3B5',
  },
  readMore: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: ACCENT,
    marginTop: 8,
  },

  // Review
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  reviewTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  quoteBlock: {
    backgroundColor: BOOKS_SURFACES.base,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  quoteText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    fontStyle: 'italic',
    color: '#D6C3B5',
    lineHeight: 24,
  },
  reviewInput: {
    backgroundColor: BOOKS_SURFACES.base,
    borderRadius: 12,
    padding: 16,
    color: '#E4E1E9',
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewActionIcon: {
    fontSize: 16,
    color: '#D6C3B5',
  },
  reviewActionLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#D6C3B5',
    textTransform: 'uppercase',
  },
  reviewActionBtnAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewActionLabelAccent: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: ACCENT,
    textTransform: 'uppercase',
  },

  // Series
  seriesName: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    marginBottom: 4,
  },
  seriesCount: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    marginBottom: 16,
  },
  seriesBooksList: {
    gap: 12,
  },
  seriesBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seriesBookCover: {
    borderRadius: 4,
  },
  seriesBookInfo: {
    flex: 1,
    gap: 2,
  },
  seriesBookTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
  },
  seriesBookStatus: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: ACCENT,
  },

  // Reading Stats
  statsGrid: {
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },

  // Danger zone
  dangerZone: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  deleteText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#FFB4AB',
  },
});
