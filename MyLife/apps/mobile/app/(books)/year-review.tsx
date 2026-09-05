import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Share,
  Text as RNText,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import { BookCover, colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useGoal } from '../../hooks/books/use-goals';
import { useSessions } from '../../hooks/books/use-sessions';
import { useReviews } from '../../hooks/books/use-reviews';
import { useBooks } from '../../hooks/books/use-books';
import { useDatabase } from '../../components/DatabaseProvider';
import { buildLibraryExportPayload } from '../../lib/books/portability';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;

const ChevronLeftIcon = icons.ChevronLeft;
const ChevronRightIcon = icons.ChevronRight;
const ChevronDownIcon = icons.ChevronDown;
const BookOpenIcon = icons.BookOpen;

function parseAuthors(authors: string): string[] {
  try { return JSON.parse(authors); } catch { return [authors]; }
}

const SLIDES = [
  'intro',
  'top-rated',
  'numbers',
  'monthly',
  'favorites',
  'export',
] as const;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function YearReviewScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const slide = SLIDES[slideIndex];
  const captureRegionRef = useRef<View>(null);

  const { goal, progress } = useGoal(selectedYear);
  const { sessions } = useSessions();
  const { reviews } = useReviews();
  const { books } = useBooks();

  const booksRead = progress?.booksRead ?? 0;
  const year = goal?.year ?? selectedYear;

  const finishedBookIds = sessions
    .filter((s) => {
      if (s.status !== 'finished' || !s.finished_at) return false;
      const d = new Date(s.finished_at);
      return d.getFullYear() === year;
    })
    .map((s) => s.book_id);
  const totalPages = finishedBookIds.reduce((sum, bookId) => {
    const book = books.find((b) => b.id === bookId);
    return sum + (book?.page_count ?? 0);
  }, 0);

  const topRated = reviews
    .filter((r) => r.rating != null && r.rating >= 4.5)
    .map((r) => ({ review: r, book: books.find((b) => b.id === r.book_id)! }))
    .filter((item) => item.book != null);

  const favoriteReviews = reviews.filter((r) => r.is_favorite);

  const goNext = () => setSlideIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  const goPrev = () => setSlideIndex((i) => Math.max(i - 1, 0));

  const handleSaveAsImage = useCallback(async () => {
    try {
      const uri = await captureRef(captureRegionRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Share.share({
        title: `MyBooks ${year} Year in Review`,
        url: uri,
        message: `MyBooks ${year} Year in Review`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Unable to save image', message);
    }
  }, [year]);

  const handleExportCsv = useCallback(async () => {
    try {
      const payload = buildLibraryExportPayload(db);
      const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!targetDir) {
        throw new Error('No writable filesystem directory available.');
      }
      const filename = `mybooks-year-review-${year}.csv`;
      const uri = `${targetDir}${filename}`;
      await FileSystem.writeAsStringAsync(uri, payload.csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Share.share({
        title: filename,
        url: uri,
        message: payload.csv,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Unable to export CSV', message);
    }
  }, [db, year]);

  const handleYearSelect = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
    Alert.alert(
      'Select Year',
      undefined,
      [
        ...years.map((y) => ({
          text: String(y),
          onPress: () => setSelectedYear(y),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ChevronLeftIcon size={24} color={colors.text} />
          </Pressable>
          <RNText style={styles.headerTitle}>MyBooks</RNText>
          <Pressable onPress={handleYearSelect} style={styles.yearPicker}>
            <RNText style={styles.yearText}>{selectedYear}</RNText>
            <ChevronDownIcon size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Progress indicators */}
        <View style={styles.progressRow}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => setSlideIndex(i)} style={styles.progressSegmentTouch}>
              <View
                style={[
                  styles.progressSegment,
                  i === slideIndex && styles.progressSegmentActive,
                  i < slideIndex && styles.progressSegmentDone,
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Main content */}
        <View ref={captureRegionRef} collapsable={false} style={styles.captureRegion}>
          {slide === 'intro' && (
            <View style={styles.slide}>
              {/* Circular book icon */}
              <View style={styles.circleOuter}>
                <View style={styles.circleInner}>
                  <BookOpenIcon size={56} color={BOOKS_ACCENT} />
                </View>
              </View>

              <RNText style={styles.libraryLabel}>THE OBSIDIAN LIBRARY</RNText>

              <View style={styles.titleRow}>
                <RNText style={styles.displayTitle}>Your Year in </RNText>
                <RNText style={[styles.displayTitle, { color: BOOKS_ACCENT }]}>Ink</RNText>
              </View>

              <RNText style={styles.descriptionText}>
                Let's revisit the worlds you traveled through and the stories that stayed with you in {year}.
              </RNText>
            </View>
          )}

          {slide === 'top-rated' && (
            <View style={styles.slide}>
              <RNText style={styles.libraryLabel}>TOP RATED</RNText>
              <RNText style={styles.slideHeading}>Your Best Reads</RNText>
              {topRated.length === 0 ? (
                <RNText style={styles.emptyText}>No top-rated books yet.</RNText>
              ) : (
                <>
                  <View style={styles.coverRow}>
                    {topRated.slice(0, 3).map(({ book }) => (
                      <BookCover key={book.id} coverUrl={book.cover_url} size="medium" title={book.title} />
                    ))}
                  </View>
                  <View style={styles.ratingsList}>
                    {topRated.slice(0, 5).map(({ book, review }) => (
                      <GlassCard key={book.id} level={1} style={styles.ratingItem}>
                        <RNText style={styles.ratingTitle} numberOfLines={1}>{book.title}</RNText>
                        <RNText style={styles.ratingStars}>{'★'.repeat(Math.round(review.rating ?? 0))} {review.rating}</RNText>
                      </GlassCard>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {slide === 'numbers' && (
            <View style={styles.slide}>
              <RNText style={styles.libraryLabel}>THE NUMBERS</RNText>
              <RNText style={styles.slideHeading}>{year} at a Glance</RNText>
              <View style={styles.numberGrid}>
                <GlassCard level={2} style={styles.numberCard}>
                  <RNText style={styles.numberValue}>{booksRead}</RNText>
                  <RNText style={styles.numberLabel}>BOOKS READ</RNText>
                </GlassCard>
                <GlassCard level={2} style={styles.numberCard}>
                  <RNText style={styles.numberValue}>{totalPages.toLocaleString()}</RNText>
                  <RNText style={styles.numberLabel}>TOTAL PAGES</RNText>
                </GlassCard>
                <GlassCard level={2} style={styles.numberCard}>
                  <RNText style={styles.numberValue}>
                    {new Set(books.flatMap((b) => parseAuthors(b.authors))).size}
                  </RNText>
                  <RNText style={styles.numberLabel}>AUTHORS</RNText>
                </GlassCard>
              </View>
            </View>
          )}

          {slide === 'monthly' && (
            <View style={styles.slide}>
              <RNText style={styles.libraryLabel}>MONTH BY MONTH</RNText>
              <RNText style={styles.slideHeading}>Your Reading Rhythm</RNText>
              <View style={styles.monthBars}>
                {MONTH_LABELS.map((m, i) => {
                  const monthSessions = sessions.filter((s) => {
                    if (s.status !== 'finished' || !s.finished_at) return false;
                    const d = new Date(s.finished_at);
                    return d.getMonth() === i && d.getFullYear() === year;
                  });
                  const maxBooks = Math.max(
                    ...MONTH_LABELS.map((_, mi) =>
                      sessions.filter((s) => {
                        if (s.status !== 'finished' || !s.finished_at) return false;
                        const d = new Date(s.finished_at);
                        return d.getMonth() === mi && d.getFullYear() === year;
                      }).length,
                    ),
                    1,
                  );
                  const barHeight = Math.max((monthSessions.length / maxBooks) * 100, 4);
                  return (
                    <View key={m + i} style={styles.monthCol}>
                      <View
                        style={[
                          styles.monthBar,
                          {
                            height: barHeight,
                            backgroundColor: monthSessions.length > 0 ? BOOKS_ACCENT : BOOKS_SURFACES.focus,
                          },
                        ]}
                      />
                      <RNText style={styles.monthLabel}>{m.slice(0, 1)}</RNText>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {slide === 'favorites' && (
            <View style={styles.slide}>
              <RNText style={styles.libraryLabel}>YOUR FAVORITES</RNText>
              <RNText style={styles.slideHeading}>Books That Stayed</RNText>
              {favoriteReviews.length === 0 ? (
                <RNText style={styles.emptyText}>No favorites yet.</RNText>
              ) : (
                <View style={styles.favoritesList}>
                  {favoriteReviews.slice(0, 4).map((r) => {
                    const book = books.find((b) => b.id === r.book_id);
                    return book ? (
                      <GlassCard key={r.id} level={1} style={styles.favoriteRow}>
                        <BookCover coverUrl={book.cover_url} size="small" title={book.title} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <RNText style={styles.favoriteTitle} numberOfLines={1}>{book.title}</RNText>
                          <RNText style={styles.favoriteAuthor} numberOfLines={1}>{parseAuthors(book.authors).join(', ')}</RNText>
                        </View>
                      </GlassCard>
                    ) : null;
                  })}
                </View>
              )}
            </View>
          )}

          {slide === 'export' && (
            <View style={styles.slide}>
              <RNText style={styles.libraryLabel}>SHARE YOUR YEAR</RNText>
              <RNText style={styles.slideHeading}>Spread the Word</RNText>
              <RNText style={styles.descriptionText}>
                Save a summary image or export your full reading data.
              </RNText>
            </View>
          )}
        </View>

        {/* Navigation arrows */}
        {slideIndex > 0 && (
          <Pressable style={[styles.navArrow, styles.navArrowLeft]} onPress={goPrev} hitSlop={16}>
            <ChevronLeftIcon size={28} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}
        {slideIndex < SLIDES.length - 1 && (
          <Pressable style={[styles.navArrow, styles.navArrowRight]} onPress={goNext} hitSlop={16}>
            <ChevronRightIcon size={28} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <GradientButton
            label={slide === 'export' ? '  Save as Image' : '  Share as Image'}
            onPress={() => void handleSaveAsImage()}
          />
          {slide === 'export' && (
            <Pressable onPress={() => void handleExportCsv()} style={styles.downloadLink}>
              <RNText style={styles.downloadText}>DOWNLOAD PDF SUMMARY</RNText>
            </Pressable>
          )}
          {slide !== 'export' && (
            <Pressable onPress={() => void handleExportCsv()} style={styles.downloadLink}>
              <RNText style={styles.downloadText}>DOWNLOAD PDF SUMMARY</RNText>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

const CIRCLE_SIZE = 200;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: colors.text,
    flex: 1,
  },
  yearPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  yearText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 8,
  },
  progressSegmentTouch: {
    flex: 1,
    paddingVertical: 4,
  },
  progressSegment: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BOOKS_SURFACES.focus,
  },
  progressSegmentActive: {
    backgroundColor: BOOKS_ACCENT,
  },
  progressSegmentDone: {
    backgroundColor: 'rgba(201, 137, 77, 0.5)',
  },
  captureRegion: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  circleOuter: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(201, 137, 77, 0.3)',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  circleInner: {
    width: CIRCLE_SIZE * 0.7,
    height: CIRCLE_SIZE * 0.7,
    borderRadius: (CIRCLE_SIZE * 0.7) / 2,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    letterSpacing: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  displayTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 36,
    color: colors.text,
  },
  slideHeading: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  descriptionText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  coverRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  ratingsList: {
    width: '100%',
    gap: 8,
  },
  ratingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ratingTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  ratingStars: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: BOOKS_ACCENT,
  },
  numberGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  numberCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  numberValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: BOOKS_ACCENT,
  },
  numberLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    fontSize: 9,
  },
  monthBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 120,
    marginTop: 16,
    width: '100%',
  },
  monthCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  monthBar: {
    width: '80%',
    borderRadius: 3,
  },
  monthLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  favoritesList: {
    width: '100%',
    gap: 8,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  favoriteTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  favoriteAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowLeft: {
    left: 8,
  },
  navArrowRight: {
    right: 8,
  },
  bottomActions: {
    paddingHorizontal: 32,
    paddingBottom: 100,
    gap: 16,
    alignItems: 'center',
  },
  downloadLink: {
    paddingVertical: 4,
  },
  downloadText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    letterSpacing: 2,
    fontSize: 12,
  },
});
