import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, BookCover, LoadingState, EmptyState, colors } from '@mylife/ui';
import {
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books';
import {
  GlassCard,
  GradientButton,
} from '@mylife/books/ui';
import { useRecommendations } from '../../hooks/books/use-recommendations';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const SCREEN_WIDTH = Dimensions.get('window').width;

const SparklesIcon = icons.Sparkles;
const XIcon = icons.X;
const BookmarkIcon = icons.Bookmark;
const UsersIcon = icons.Users;
const GridIcon = icons.LayoutGrid;
const CompassIcon = icons.Compass;

interface AuthorAffinityRow {
  author: string;
  booksRead: number;
  affinity: string;
}

function getAuthorAffinity(recs: typeof import('@mylife/books').computeRecommendations extends (...args: any[]) => infer R ? NonNullable<R> : never): AuthorAffinityRow[] {
  const authorMap = new Map<string, { count: number; totalScore: number }>();
  for (const rec of recs.authorAffinity) {
    for (const author of rec.authors) {
      const existing = authorMap.get(author) ?? { count: 0, totalScore: 0 };
      existing.count += 1;
      existing.totalScore += rec.score;
      authorMap.set(author, existing);
    }
  }
  const rows: AuthorAffinityRow[] = [];
  for (const [author, data] of authorMap) {
    const avg = data.totalScore / data.count;
    rows.push({
      author,
      booksRead: data.count,
      affinity: avg >= 0.8 ? 'High Affinity' : avg >= 0.5 ? 'Medium' : 'New Interest',
    });
  }
  return rows.slice(0, 5);
}

function getGenreClusters(recs: { genreAffinity: Array<{ reason: string; score: number }> }) {
  const genreMap = new Map<string, number>();
  for (const rec of recs.genreAffinity) {
    const genre = rec.reason.split(' ').slice(0, 3).join(' ');
    genreMap.set(genre, (genreMap.get(genre) ?? 0) + 1);
  }
  const clusters: Array<{ name: string; count: number }> = [];
  for (const [name, count] of genreMap) {
    clusters.push({ name, count });
  }
  return clusters.slice(0, 4);
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const { recommendations, loading, refresh } = useRecommendations();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedRec, setSelectedRec] = useState<string | null>(null);

  if (!recommendations) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={4} />
      </View>
    );
  }

  if (recommendations.insufficientData) {
    return (
      <View style={styles.loadingContainer}>
        <EmptyState
          icon="📚"
          title={`Rate at least ${recommendations.minimumRatingsRequired} books`}
          message="Your ratings power the recommendation engine. Tap the stars on any book to get started."
          actionLabel="Rate Your Books"
          onAction={() => router.push('/(books)/rate-books')}
          accentColor={BOOKS_ACCENT}
        />
      </View>
    );
  }

  const allRecs = [
    ...recommendations.authorAffinity,
    ...recommendations.genreAffinity,
    ...recommendations.similarBooks,
  ].filter((r) => !dismissedIds.has(r.bookId));

  const featuredPick = allRecs[0];
  const popupRec = selectedRec
    ? allRecs.find((r) => r.bookId === selectedRec)
    : allRecs[1] ?? null;

  const authorRows = getAuthorAffinity(recommendations);
  const genreClusters = getGenreClusters(recommendations);
  const discoveryQueue = allRecs.slice(2, 12);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={BOOKS_ACCENT} />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.displayTitle}>Curated For You</Text>
        </View>
        <View style={styles.dailyBadge}>
          <Text style={styles.dailyBadgeText}>DAILY REFRESH</Text>
        </View>
      </View>

      {/* Featured Pick */}
      {featuredPick && (
        <GlassCard level={1} style={styles.featuredCard}>
          <Pressable
            style={styles.dismissButton}
            hitSlop={8}
            onPress={() => {
              setDismissedIds((prev) => new Set(prev).add(featuredPick.bookId));
            }}
          >
            <XIcon size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>

          <View style={styles.featuredCoverContainer}>
            <BookCover
              coverUrl={featuredPick.coverUrl}
              size="large"
              title={featuredPick.title}
            />
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>
                {Math.round(featuredPick.score * 100)}% MATCH
              </Text>
            </View>
          </View>

          <Text style={styles.featuredTitle}>{featuredPick.title}</Text>
          <Text style={styles.featuredAuthor}>
            {featuredPick.authors.join(', ')}
          </Text>
        </GlassCard>
      )}

      {/* Popup Card */}
      {popupRec && (
        <GlassCard level={2} style={styles.popupCard}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{popupRec.title}</Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setDismissedIds((prev) => new Set(prev).add(popupRec.bookId));
                setSelectedRec(null);
              }}
            >
              <XIcon size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
          <Text style={styles.popupAuthor}>
            {popupRec.authors.join(', ')}
          </Text>

          <View style={styles.affinitySection}>
            <View style={styles.affinityLabelRow}>
              <SparklesIcon size={14} color={BOOKS_ACCENT} />
              <Text style={styles.affinityLabel}>AFFINITY RATIONALE</Text>
            </View>
            <Text style={styles.affinityText}>{popupRec.reason}</Text>
          </View>

          <View style={styles.popupActions}>
            <GradientButton
              label="Start Reading"
              onPress={() => router.push(`/(books)/book/${popupRec.bookId}`)}
              style={styles.startReadingButton}
            />
            <Pressable
              style={styles.bookmarkButton}
              onPress={() => router.push(`/(books)/book/${popupRec.bookId}`)}
            >
              <BookmarkIcon size={20} color={BOOKS_ACCENT} />
            </Pressable>
          </View>
        </GlassCard>
      )}

      {/* Author Affinity */}
      {authorRows.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <UsersIcon size={18} color={BOOKS_ACCENT} />
            <Text style={styles.sectionTitle}>Author Affinity</Text>
          </View>

          {authorRows.map((row) => (
            <GlassCard key={row.author} level={2} style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>
                  {row.author.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{row.author}</Text>
                <Text style={styles.authorMeta}>
                  {row.booksRead} Books Read · {row.affinity}
                </Text>
              </View>
              <Pressable
                style={styles.exploreButton}
                onPress={() => router.push('/(books)/search')}
              >
                <Text style={styles.exploreButtonText}>Explore</Text>
              </Pressable>
            </GlassCard>
          ))}
        </View>
      )}

      {/* Genre Clusters */}
      {genreClusters.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <GridIcon size={18} color={BOOKS_ACCENT} />
            <Text style={styles.sectionTitle}>Genre Clusters</Text>
          </View>

          <View style={styles.clusterGrid}>
            {genreClusters.map((cluster) => (
              <GlassCard key={cluster.name} level={3} style={styles.clusterCard}>
                <Text style={styles.clusterCount}>
                  {String(cluster.count).padStart(2, '0')}
                </Text>
                <Text style={styles.clusterName} numberOfLines={1}>
                  {cluster.name}
                </Text>
              </GlassCard>
            ))}
          </View>
        </View>
      )}

      {/* Discovery Queue */}
      {discoveryQueue.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <CompassIcon size={18} color={BOOKS_ACCENT} />
            <Text style={styles.sectionTitle}>Discovery Queue</Text>
          </View>

          <FlatList
            horizontal
            data={discoveryQueue}
            keyExtractor={(item) => item.bookId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.queueScroll}
            renderItem={({ item }) => (
              <Pressable
                style={styles.queueCard}
                onPress={() => {
                  setSelectedRec(item.bookId);
                  router.push(`/(books)/book/${item.bookId}`);
                }}
              >
                <BookCover
                  coverUrl={item.coverUrl}
                  size="medium"
                  title={item.title}
                />
                <Text style={styles.queueTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.queueAuthor} numberOfLines={1}>
                  {item.authors.join(', ')}
                </Text>
              </Pressable>
            )}
          />

          {allRecs.length > 12 && (
            <Pressable
              style={styles.loadMoreButton}
              onPress={refresh}
            >
              <Text style={styles.loadMoreText}>LOAD MORE</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const CARD_GAP = 10;
const CLUSTER_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    fontSize: 28,
  },
  dailyBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dailyBadgeText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#8BCFF0',
    fontSize: 10,
    letterSpacing: 1,
  },

  // Featured Pick
  featuredCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredCoverContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  matchBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: BOOKS_ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: '#1a1008',
    letterSpacing: 0.5,
  },
  featuredTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  featuredAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    textAlign: 'center',
    marginTop: 4,
  },

  // Popup Card
  popupCard: {
    marginHorizontal: 20,
    padding: 20,
    gap: 12,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  popupTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    flex: 1,
    marginRight: 8,
  },
  popupAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    fontStyle: 'italic',
  },
  affinitySection: {
    gap: 8,
  },
  affinityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  affinityLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 11,
  },
  affinityText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#E4E1E9',
    lineHeight: 22,
  },
  popupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  startReadingButton: {
    flex: 1,
  },
  bookmarkButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },

  // Author Affinity
  authorRow: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BOOKS_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: '#E4E1E9',
  },
  authorInfo: {
    flex: 1,
    gap: 2,
  },
  authorName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  authorMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
  exploreButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BOOKS_ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  exploreButtonText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: BOOKS_ACCENT,
  },

  // Genre Clusters
  clusterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    paddingHorizontal: 20,
  },
  clusterCard: {
    width: CLUSTER_WIDTH,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clusterCount: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#8BCFF0',
  },
  clusterName: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
    flex: 1,
  },

  // Discovery Queue
  queueScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  queueCard: {
    width: 130,
    gap: 6,
  },
  queueTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#E4E1E9',
  },
  queueAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 12,
    letterSpacing: 1,
  },
});
