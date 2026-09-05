import { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, ReadingGoalRing, LoadingState, colors, spacing } from '@mylife/ui';
import { GlassCard, ReadingProgressBar, BOOKS_SURFACES } from '@mylife/books/ui';
import { calculateReadingStats } from '@mylife/books';
import { useDatabase } from '../../components/DatabaseProvider';
import { useGoal } from '../../hooks/books/use-goals';
import { useSessions } from '../../hooks/books/use-sessions';
import { useReviews } from '../../hooks/books/use-reviews';
import { useBooks } from '../../hooks/books/use-books';

const BOOKS_ACCENT = colors.modules.books;
const GENRE_COLORS = ['#FFB877', '#8BCFF0', '#9F8E81', '#D6C3B5', '#52443A'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function StatsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const currentYear = new Date().getFullYear();
  const { goal, progress, loading: goalLoading } = useGoal(currentYear);
  const { sessions, loading: sessionsLoading } = useSessions();
  const { reviews, loading: reviewsLoading } = useReviews();
  const { books, loading: booksLoading } = useBooks();

  const isLoading = goalLoading || sessionsLoading || reviewsLoading || booksLoading;

  const stats = useMemo(
    () => calculateReadingStats(sessions, reviews, books),
    [sessions, reviews, books],
  );

  const timedData = useMemo(() => {
    const timeRows = db.query<{ total: number }>(
      'SELECT COALESCE(SUM(duration_ms), 0) as total FROM bk_timed_sessions WHERE duration_ms IS NOT NULL',
    );
    const totalHours = Math.round((timeRows[0]?.total ?? 0) / 3_600_000);

    const today = new Date();
    const last7: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const rows = db.query<{ total: number }>(
        'SELECT COALESCE(SUM(duration_ms), 0) as total FROM bk_timed_sessions WHERE DATE(started_at) = ?',
        [dateStr],
      );
      last7.push(Math.round((rows[0]?.total ?? 0) / 60_000));
    }

    const streakRows = db.query<{ d: string }>(
      'SELECT DISTINCT DATE(started_at) as d FROM bk_timed_sessions WHERE started_at IS NOT NULL ORDER BY d DESC',
    );
    let streak = 0;
    if (streakRows.length > 0) {
      const todayStr = today.toISOString().substring(0, 10);
      const ydayStr = new Date(today.getTime() - 86_400_000).toISOString().substring(0, 10);
      if (streakRows[0].d === todayStr || streakRows[0].d === ydayStr) {
        streak = 1;
        for (let i = 1; i < streakRows.length; i++) {
          const prev = new Date(streakRows[i - 1].d);
          const curr = new Date(streakRows[i].d);
          if (Math.round((prev.getTime() - curr.getTime()) / 86_400_000) === 1) streak++;
          else break;
        }
      }
    }

    return { totalHours, last7, streak };
  }, [db]);

  const genres = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const book of books) {
      if (!book.subjects) continue;
      try {
        const parsed = JSON.parse(book.subjects);
        if (Array.isArray(parsed)) {
          for (const s of parsed.slice(0, 2)) {
            if (typeof s === 'string' && s.length > 0) counts[s] = (counts[s] ?? 0) + 1;
          }
        }
      } catch { /* skip */ }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 4);
    const topSum = sorted.reduce((s, [, c]) => s + c, 0);
    const other = total - topSum;
    const result = sorted.map(([genre, count]) => ({
      genre,
      pct: Math.round((count / total) * 100),
    }));
    if (other > 0) result.push({ genre: 'Other', pct: Math.round((other / total) * 100) });
    return result;
  }, [books]);

  const libraryStatus = useMemo(() => {
    let finished = 0;
    let reading = 0;
    let wantToRead = 0;
    for (const s of sessions) {
      if (s.status === 'finished') finished++;
      else if (s.status === 'reading') reading++;
      else if (s.status === 'want_to_read') wantToRead++;
    }
    return { finished, reading, wantToRead };
  }, [sessions]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={5} />
      </View>
    );
  }

  const booksRead = progress?.booksRead ?? 0;
  const targetBooks = goal?.target_books ?? 24;
  const remaining = Math.max(0, targetBooks - booksRead);

  const dayOfYear = Math.floor(
    (Date.now() - new Date(currentYear, 0, 1).getTime()) / 86_400_000,
  );
  const expectedBooks = Math.round(targetBooks * (dayOfYear / 365));
  const booksAhead = booksRead - expectedBooks;

  const currentMonth = new Date().getMonth();
  const monthlyPages: number[] = [];
  for (let m = 0; m < 12; m++) {
    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
    monthlyPages.push(stats.pagesPerMonth[key] ?? 0);
  }
  const maxMonthPages = Math.max(...monthlyPages, 1);

  const readingTimeLabel =
    timedData.totalHours > 0
      ? `${timedData.totalHours}h`
      : `${Math.round((stats.totalPages * 2) / 60)}h`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>INSIGHTS & ANALYTICS</Text>
        <Text style={styles.headerTitle}>Your Reading{'\n'}Journey</Text>
      </View>

      {/* Annual Goal */}
      <GlassCard level={1} style={styles.card}>
        <View style={styles.ringCenter}>
          <ReadingGoalRing current={booksRead} target={targetBooks} size={160} />
        </View>
        <Text variant="body" style={styles.centered}>
          You've finished {booksRead} out of {targetBooks} books this year.
        </Text>
        {booksAhead !== 0 && (
          <Text variant="caption" color={colors.textSecondary} style={styles.centered}>
            You are {Math.abs(booksAhead)} book{Math.abs(booksAhead) !== 1 ? 's' : ''}{' '}
            {booksAhead > 0 ? 'ahead of' : 'behind'} schedule.
          </Text>
        )}
        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipFilled]}>
            <Text style={styles.chipText}>{booksRead} FINISHED</Text>
          </View>
          <View style={[styles.chip, styles.chipOutline]}>
            <Text style={styles.chipText}>{remaining} REMAINING</Text>
          </View>
        </View>
      </GlassCard>

      {/* Daily Streak */}
      <GlassCard level={1} style={styles.card}>
        <Text style={styles.upperLabel}>DAILY STREAK</Text>
        <View style={styles.streakRow}>
          <View>
            <Text style={styles.bigNumber}>{timedData.streak}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Days in a row
            </Text>
          </View>
          <View style={styles.miniChart}>
            {timedData.last7.map((mins, i) => {
              const max = Math.max(...timedData.last7, 1);
              const h = mins > 0 ? Math.max(8, (mins / max) * 48) : 4;
              return (
                <View key={i} style={styles.miniBarCol}>
                  <View
                    style={[
                      styles.miniBar,
                      {
                        height: h,
                        backgroundColor:
                          mins > 0 ? BOOKS_ACCENT : BOOKS_SURFACES.focus,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
        <Text style={[styles.upperLabel, { textAlign: 'right' }]}>
          LAST 7 DAYS
        </Text>
      </GlassCard>

      {/* Stat Cards */}
      {[
        { icon: '\uD83D\uDCD6', value: stats.totalPages.toLocaleString(), label: 'TOTAL PAGES' },
        { icon: '\u2B50', value: stats.averageRating?.toFixed(1) ?? '\u2014', label: 'AVG RATING' },
        { icon: '\uD83D\uDD50', value: readingTimeLabel, label: 'READING TIME' },
      ].map((s) => (
        <GlassCard key={s.label} level={1} style={styles.statCard}>
          <Text style={styles.statIcon}>{s.icon}</Text>
          <View>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.upperLabel}>{s.label}</Text>
          </View>
        </GlassCard>
      ))}

      {/* Monthly Activity */}
      <GlassCard level={1} style={styles.card}>
        <View style={styles.monthlyHeader}>
          <Text variant="subheading">Monthly Activity</Text>
          <Text style={styles.upperLabel}>PAGES PER MONTH</Text>
        </View>
        <View style={styles.barChart}>
          {monthlyPages.map((pages, i) => {
            const h = pages > 0 ? Math.max(6, (pages / maxMonthPages) * 100) : 4;
            const isCurrent = i === currentMonth;
            return (
              <View key={i} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor:
                        pages > 0 ? BOOKS_ACCENT : BOOKS_SURFACES.focus,
                      opacity: isCurrent ? 1 : 0.65,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.monthText,
                    isCurrent && { color: colors.text, fontWeight: '600' },
                  ]}
                >
                  {MONTH_LABELS[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      {/* Top Authors */}
      {stats.topAuthors.length > 0 && (
        <GlassCard level={1} style={styles.card}>
          <Text variant="subheading">Top Authors</Text>
          {stats.topAuthors.slice(0, 5).map((a, i) => (
            <View key={a.author} style={styles.authorRow}>
              <View style={styles.authorRank}>
                <Text style={styles.rankNum}>{i + 1}</Text>
              </View>
              <View style={styles.authorInfo}>
                <Text variant="body" numberOfLines={1}>
                  {a.author}
                </Text>
                <ReadingProgressBar
                  progress={a.count / stats.topAuthors[0].count}
                  height={6}
                />
              </View>
              <Text variant="caption" color={colors.textSecondary}>
                {a.count} Books
              </Text>
            </View>
          ))}
        </GlassCard>
      )}

      {/* Genre Distribution */}
      {genres.length > 0 && (
        <GlassCard level={1} style={styles.card}>
          <Text variant="subheading">Genre Distribution</Text>
          <View style={styles.genreTopRow}>
            <Text variant="body">{genres[0].genre}</Text>
            <Text variant="body" color={BOOKS_ACCENT}>
              {genres[0].pct}%
            </Text>
          </View>
          <ReadingProgressBar progress={genres[0].pct / 100} height={6} />
          <View style={styles.genreLegend}>
            {genres.map((g, i) => (
              <View key={g.genre} style={styles.legendItem}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length] },
                  ]}
                />
                <Text variant="caption" color={colors.textSecondary}>
                  {g.genre.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* Library Status */}
      <GlassCard level={1} style={styles.card}>
        <Text variant="subheading">Library Status</Text>
        {[
          { icon: '\uD83D\uDFE0', label: 'Completed', count: libraryStatus.finished },
          { icon: '\uD83D\uDCD6', label: 'Currently Reading', count: libraryStatus.reading },
          { icon: '\uD83D\uDCDA', label: 'Want to Read', count: libraryStatus.wantToRead },
        ].map((r) => (
          <View key={r.label} style={styles.statusRow}>
            <Text style={styles.statusIcon}>{r.icon}</Text>
            <Text variant="body" style={styles.statusLabel}>
              {r.label}
            </Text>
            <Text variant="body">{r.count}</Text>
          </View>
        ))}
      </GlassCard>

      {/* Feature Links */}
      <View style={styles.linkGrid}>
        {[
          { icon: '\uD83C\uDFC5', label: 'Achievements', route: '/(books)/badges' },
          { icon: '\uD83D\uDCA1', label: 'Insights', route: '/(books)/insights' },
          { icon: '\uD83D\uDCCA', label: 'Share Stats', route: '/(books)/share' },
          { icon: '\uD83C\uDFAF', label: 'Challenges', route: '/(books)/challenges' },
        ].map((link) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.route as never)}
          >
            <GlassCard level={2} style={styles.linkCard}>
              <Text style={styles.linkIcon}>{link.icon}</Text>
              <Text variant="caption">{link.label}</Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  headerLabel: { fontSize: 12, letterSpacing: 1.2, color: BOOKS_ACCENT },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 38,
    marginTop: spacing.xs,
  },
  card: { marginTop: spacing.md, gap: spacing.sm },
  centered: { textAlign: 'center', lineHeight: 22 },
  upperLabel: { fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  chipFilled: { backgroundColor: `${BOOKS_ACCENT}20` },
  chipOutline: { borderWidth: 1, borderColor: colors.outline },
  chipText: { fontSize: 11, letterSpacing: 0.8, color: colors.text, fontWeight: '600' },
  ringCenter: { alignItems: 'center', paddingVertical: spacing.xs },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bigNumber: { fontSize: 48, fontWeight: '700', color: colors.text, lineHeight: 52 },
  miniChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingBottom: 10 },
  miniBarCol: { alignItems: 'center' },
  miniBar: { width: 20, borderRadius: 4 },
  statCard: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  monthlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: spacing.sm,
  },
  barCol: { alignItems: 'center', flex: 1, gap: 4 },
  bar: { width: 16, borderRadius: 4 },
  monthText: { fontSize: 10, color: colors.textSecondary },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: { fontSize: 12, fontWeight: '600', color: colors.text },
  authorInfo: { flex: 1, gap: 4 },
  genreTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genreLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  statusIcon: { fontSize: 14 },
  statusLabel: { flex: 1 },
  linkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  linkCard: {
    width: 160,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  linkIcon: { fontSize: 22 },
});
