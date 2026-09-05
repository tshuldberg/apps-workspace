import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Text as RNText,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import {
  ReadingGoalRing,
  BookCover,
  StarRating,
  LoadingState,
  EmptyState,
  colors,
} from '@mylife/ui';
import {
  SectionHeader,
  GlassCard,
  GradientButton,
  ReadingProgressBar,
  JAKARTA_FONTS,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
} from '@mylife/books/ui';
import { useGoal } from '../../hooks/books/use-goals';
import { useSessions, useCurrentlyReading } from '../../hooks/books/use-sessions';
import { useReviews } from '../../hooks/books/use-reviews';
import { useBooks } from '../../hooks/books/use-books';
import { useInsights } from '../../hooks/books/use-insights';
import { useQuotes } from '../../hooks/books/use-quotes';
import { useDatabase } from '../../components/DatabaseProvider';
import { getSetting } from '../../lib/books/settings';

const BOOKS_ACCENT = colors.modules.books;

function parseAuthors(authors: string): string[] {
  try { return JSON.parse(authors); } catch { return [authors]; }
}

const QUICK_ACTIONS = [
  { icon: '\uD83C\uDFAF', label: 'CHALLENGES', route: '/(books)/challenges' },
  { icon: '\uD83D\uDCD3', label: 'JOURNAL', route: '/(books)/journal' },
  { icon: '\uD83D\uDCA1', label: 'INSIGHTS', route: '/(books)/insights' },
  { icon: '\u201C', label: 'QUOTES', route: '/(books)/quotes' },
  { icon: '\u2728', label: 'FOR YOU', route: '/(books)/recommendations' },
  { icon: '\uD83D\uDCDA', label: 'SERIES', route: '/(books)/series' },
  { icon: '\uD83D\uDD0D', label: 'DISCOVER', route: '/(books)/discover' },
  { icon: '\uD83C\uDFC5', label: 'BADGES', route: '/(books)/badges' },
  { icon: '\uD83D\uDCCA', label: 'SHARE', route: '/(books)/share' },
  { icon: '\u2B50', label: 'RATE BOOKS', route: '/(books)/rate-books' },
  { icon: '\uD83C\uDF1F', label: "WHAT'S NEW", route: '/(books)/whats-new' },
  { icon: '\u2699\uFE0F', label: 'SETTINGS', route: '/(books)/settings' },
] as const;

const COMING_SOON = [
  { icon: '\uD83D\uDC65', label: 'CLUBS', route: '/(books)/clubs' },
  { icon: '\uD83C\uDF0D', label: 'COMMUNITY', route: '/(books)/community' },
  { icon: '\uD83D\uDC4B', label: 'SOCIAL', route: '/(books)/social' },
  { icon: '\uD83C\uDFC6', label: 'FRIENDS', route: '/(books)/friends-challenge' },
] as const;

export default function BooksHomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const db = useDatabase();
  const { goal, progress, loading: goalLoading, refresh: refreshGoal } = useGoal(new Date().getFullYear());
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions();
  const { sessions: currentSessions, refresh: refreshCurrent } = useCurrentlyReading();
  const { books, loading: booksLoading, refresh: refreshBooks } = useBooks();
  const { onThisDay } = useInsights();
  const { random, refreshRandom } = useQuotes();
  const [refreshing, setRefreshing] = useState(false);
  const onThisDayRef = useRef<ScrollView>(null);
  const [otdOffset, setOtdOffset] = useState(0);

  const isLoading = goalLoading || sessionsLoading || booksLoading;

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'The Curator' });
  }, [navigation]);

  useEffect(() => {
    if (!isLoading && books.length === 0) {
      const onboardingDone = getSetting(db, 'onboarding_complete');
      if (!onboardingDone) {
        router.replace('/(books)/onboarding');
      }
    }
  }, [isLoading, books.length, db, router]);

  const booksRead = progress?.booksRead ?? 0;
  const targetBooks = goal?.target_books ?? 24;
  const year = goal?.year ?? new Date().getFullYear();
  const goalPercent = targetBooks > 0 ? Math.round((booksRead / targetBooks) * 100) : 0;

  const currentlyReading = currentSessions
    .map((session) => ({
      book: books.find((b) => b.id === session.book_id),
      session,
    }))
    .filter((item) => item.book != null);

  const finishedSessions = sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''));

  const recentlyFinished = finishedSessions.map((s) => ({
    book: books.find((b) => b.id === s.book_id),
    session: s,
  })).filter((item) => item.book != null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshGoal(), refreshSessions(), refreshBooks(), refreshCurrent()]);
    setRefreshing(false);
  }, [refreshGoal, refreshSessions, refreshBooks, refreshCurrent]);

  const scrollOtd = (dir: 'left' | 'right') => {
    const next = dir === 'right' ? otdOffset + 200 : Math.max(0, otdOffset - 200);
    setOtdOffset(next);
    onThisDayRef.current?.scrollTo({ x: next, animated: true });
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={4} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BOOKS_ACCENT}
          colors={[BOOKS_ACCENT]}
        />
      }
    >
      {/* ---------- Annual Goal ---------- */}
      <View style={styles.goalSection}>
        <RNText style={styles.goalYearLabel}>{year} GOAL</RNText>
        <ReadingGoalRing
          current={booksRead}
          target={targetBooks}
          size={140}
          label={`OF ${targetBooks} BOOKS`}
        />
        <RNText style={styles.goalSubtext}>
          {goalPercent}% of your journey complete
        </RNText>
      </View>

      {/* ---------- Daily Quote ---------- */}
      {random && (
        <Pressable
          style={styles.quoteSection}
          onPress={() => router.push('/(books)/quotes')}
        >
          <RNText style={styles.quoteMark}>{'\u201C\u201C'}</RNText>
          <RNText style={styles.quoteText}>
            {'\u201C'}{random.quote.content}{'\u201D'}
          </RNText>
          <RNText style={styles.quoteAuthor}>
            -- {(parseAuthors(random.bookAuthors)[0] ?? random.bookTitle).toUpperCase()}
          </RNText>
          <Pressable onPress={refreshRandom} style={styles.shuffleBtn} hitSlop={12}>
            <RNText style={styles.shuffleIcon}>{'\uD83D\uDD00'}</RNText>
          </Pressable>
        </Pressable>
      )}

      {/* ---------- Currently Reading: On Your Desk ---------- */}
      <View style={styles.sectionBlock}>
        <SectionHeader
          label="CURRENTLY READING"
          title="On Your Desk"
          action={{ text: 'View All', onPress: () => router.push('/(books)/library') }}
        />
        {currentlyReading.length === 0 ? (
          <View style={styles.padH}>
            <EmptyState
              icon={'\uD83D\uDCD6'}
              title="Your desk is empty"
              message="Start reading a book to see it here."
              actionLabel="Browse Library"
              onAction={() => router.push('/(books)/library')}
              accentColor={BOOKS_ACCENT}
            />
          </View>
        ) : (
          currentlyReading.map(({ book, session }) => {
            const pageCount = book!.page_count ?? 0;
            const currentPage = session.current_page ?? 0;
            const pct = pageCount > 0 ? currentPage / pageCount : 0;
            const pctLabel = Math.round(pct * 100);

            return (
              <GlassCard
                key={book!.id}
                level={2}
                style={styles.deskCard}
                onPress={() => router.push(`/(books)/book/${book!.id}`)}
              >
                <View style={styles.deskCoverWrap}>
                  <BookCover coverUrl={book!.cover_url} size="large" title={book!.title} />
                </View>
                <RNText style={styles.deskTitle} numberOfLines={2}>
                  {book!.title}
                </RNText>
                <RNText style={styles.deskAuthor} numberOfLines={1}>
                  by {parseAuthors(book!.authors).join(', ')}
                </RNText>
                <View style={styles.progressRow}>
                  <RNText style={styles.progressLabel}>PROGRESS</RNText>
                  <RNText style={styles.progressPct}>{pctLabel}%</RNText>
                </View>
                <ReadingProgressBar progress={pct} height={6} />
                <RNText style={styles.pageCount}>
                  {currentPage} of {pageCount} pages read
                </RNText>
                <GradientButton
                  label="RESUME READING"
                  onPress={() => router.push(`/(books)/book/${book!.id}`)}
                  style={styles.resumeBtn}
                />
              </GlassCard>
            );
          })
        )}
      </View>

      {/* ---------- On This Day ---------- */}
      {onThisDay.length > 0 && (
        <View style={styles.sectionBlock}>
          <View style={styles.otdHeader}>
            <RNText style={styles.sectionTitle}>On This Day</RNText>
            <View style={styles.otdArrows}>
              <Pressable onPress={() => scrollOtd('left')} hitSlop={8} style={styles.arrowBtn}>
                <RNText style={styles.arrowText}>{'\u2039'}</RNText>
              </Pressable>
              <Pressable onPress={() => scrollOtd('right')} hitSlop={8} style={styles.arrowBtn}>
                <RNText style={styles.arrowText}>{'\u203A'}</RNText>
              </Pressable>
            </View>
          </View>
          <ScrollView
            ref={onThisDayRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.otdScroll}
          >
            {onThisDay.map((evt, i) => (
              <Pressable
                key={`${evt.bookId}-${i}`}
                style={styles.otdItem}
                onPress={() => router.push(`/(books)/book/${evt.bookId}`)}
              >
                <BookCover coverUrl={evt.coverUrl} size="small" title={evt.bookTitle} />
                <RNText style={styles.otdTitle} numberOfLines={1}>{evt.bookTitle}</RNText>
                <RNText style={styles.otdAuthor} numberOfLines={1}>{evt.detail ?? `${evt.year}`}</RNText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ---------- Recently Finished ---------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionTitleWrap}>
          <RNText style={styles.sectionTitle}>Recently Finished</RNText>
        </View>
        {recentlyFinished.length === 0 ? (
          <View style={styles.padH}>
            <EmptyState
              icon={'\uD83D\uDCD6'}
              title="Your finished shelf is waiting"
              message="Books you complete will appear here with your ratings and notes."
              actionLabel="Browse Library"
              onAction={() => router.push('/(books)/library')}
              accentColor={BOOKS_ACCENT}
            />
          </View>
        ) : (
          <View style={styles.padH}>
            {recentlyFinished.slice(0, 5).map(({ book, session }) => (
              <RecentBookRow
                key={session.id}
                book={book!}
                bookId={book!.id}
                onPress={() => router.push(`/(books)/book/${book!.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {/* ---------- Quick Actions ---------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionTitleWrap}>
          <RNText style={styles.sectionTitle}>Quick Actions</RNText>
        </View>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((a) => (
            <GlassCard
              key={a.label}
              level={2}
              style={styles.actionCell}
              onPress={() => router.push(a.route as never)}
            >
              <RNText style={styles.actionIcon}>{a.icon}</RNText>
              <RNText style={styles.actionLabel}>{a.label}</RNText>
            </GlassCard>
          ))}
          {COMING_SOON.map((a) => (
            <GlassCard
              key={a.label}
              level={1}
              style={styles.actionCellDim}
              onPress={() => router.push(a.route as never)}
            >
              <RNText style={styles.actionIconDim}>{a.icon}</RNText>
              <RNText style={styles.actionLabelDim}>{a.label}</RNText>
            </GlassCard>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- Recently Finished Row ---------- */

function RecentBookRow({
  book,
  bookId,
  onPress,
}: {
  book: { title: string; authors: string; cover_url: string | null };
  bookId: string;
  onPress: () => void;
}) {
  const { review } = useReviewInline(bookId);
  return (
    <Pressable style={styles.finishedRow} onPress={onPress}>
      <BookCover coverUrl={book.cover_url} size="small" title={book.title} />
      <View style={styles.finishedInfo}>
        <RNText style={styles.finishedTitle} numberOfLines={1}>{book.title}</RNText>
        <RNText style={styles.finishedAuthor} numberOfLines={1}>
          {parseAuthors(book.authors).join(', ')}
        </RNText>
      </View>
      {review?.rating != null && (
        <StarRating rating={review.rating} size={14} readonly />
      )}
    </Pressable>
  );
}

function useReviewInline(bookId: string) {
  const { reviews } = useReviews(bookId);
  return { review: reviews.length > 0 ? reviews[0] : null };
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  // -- Goal Ring --
  goalSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: BOOKS_SURFACES.base,
  },
  goalYearLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginBottom: 16,
  },
  goalSubtext: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    marginTop: 14,
  },

  // -- Quote --
  quoteSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    padding: 24,
  },
  quoteMark: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 40,
    color: '#FFB877',
    lineHeight: 44,
    marginBottom: 8,
  },
  quoteText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 18,
    fontStyle: 'italic',
    color: '#E4E1E9',
    lineHeight: 28,
    marginBottom: 16,
  },
  quoteAuthor: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
    letterSpacing: 0.5,
  },
  shuffleBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  shuffleIcon: {
    fontSize: 20,
  },

  // -- Section blocks --
  sectionBlock: {
    marginTop: 24,
  },
  sectionTitleWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  padH: {
    paddingHorizontal: 20,
  },

  // -- On Your Desk (Currently Reading) --
  deskCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  deskCoverWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deskTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
    textAlign: 'center',
    marginBottom: 4,
  },
  deskAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  progressLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
  },
  progressPct: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
  pageCount: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#9F8E81',
    marginTop: 6,
    marginBottom: 16,
  },
  resumeBtn: {
    alignSelf: 'stretch',
  },

  // -- On This Day --
  otdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  otdArrows: {
    flexDirection: 'row',
    gap: 8,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
    lineHeight: 22,
  },
  otdScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  otdItem: {
    width: 100,
    gap: 6,
  },
  otdTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#E4E1E9',
  },
  otdAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: '#D6C3B5',
  },

  // -- Recently Finished --
  finishedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  finishedInfo: {
    flex: 1,
    gap: 2,
  },
  finishedTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  finishedAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },

  // -- Quick Actions Grid --
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 16,
  },
  actionCell: {
    width: '47%' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    gap: 12,
  },
  actionCellDim: {
    width: '47%' as unknown as number,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
    opacity: 0.5,
  },
  actionIcon: {
    fontSize: 28,
    lineHeight: 32,
  },
  actionIconDim: {
    fontSize: 18,
    lineHeight: 22,
    opacity: 0.5,
  },
  actionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#E4E1E9',
    fontSize: 11,
    textAlign: 'center' as const,
  },
  actionLabelDim: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    fontSize: 10,
    textAlign: 'center' as const,
  },
});
