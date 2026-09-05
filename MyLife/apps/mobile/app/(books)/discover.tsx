import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  FlatList,
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
  SectionHeader,
  GlassCard,
  GradientButton,
  GenreChip,
} from '@mylife/books/ui';
import { useDiscovery, useExternalDiscovery } from '../../hooks/books/use-discovery';
import { useRecommendations } from '../../hooks/books/use-recommendations';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const SCREEN_WIDTH = Dimensions.get('window').width;

const SparklesIcon = icons.Sparkles;

const MOOD_FILTERS = ['Atmospheric', 'Melancholy', 'Thought-provoking', 'Whimsical'];
const PACE_FILTERS = ['Slow Burn', 'Medium', 'Fast-Paced'];

const GENRE_CARDS = [
  { name: 'Fantasy', subtitle: '2.4k titles available', span: 'full', color: '#4A3D6B' },
  { name: 'Sci-Fi', subtitle: '', span: 'half', color: '#2D3B5E' },
  { name: 'Classics', subtitle: '', span: 'half', color: '#4A3A2A' },
  { name: 'Philosophy', subtitle: '', span: 'full', color: '#2A2D3B' },
  { name: 'Mystery', subtitle: '', span: 'full', color: '#3B2A2A' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const {
    results, filters, setFilters, loading,
  } = useDiscovery();
  const { suggestions: externalSuggestions, loading: externalLoading } = useExternalDiscovery();
  const { recommendations } = useRecommendations();

  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  const toggleFilter = (key: 'moods' | 'paces' | 'genres', value: string) => {
    const current = filters[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  const topRecommendations = recommendations && !recommendations.insufficientData
    ? [
        ...recommendations.authorAffinity.slice(0, 2),
        ...recommendations.genreAffinity.slice(0, 1),
        ...recommendations.similarBooks.slice(0, 1),
      ].slice(0, 4)
    : [];

  const recentBook = topRecommendations.length > 0
    ? topRecommendations[0]
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Display Title */}
      <View style={styles.titleSection}>
        <Text
          style={[styles.displayTitle, BOOKS_TYPOGRAPHY.displayLg]}
        >
          Discover
        </Text>
        <Text style={styles.subtitle}>
          CURATING YOUR NEXT INTELLECTUAL JOURNEY
        </Text>
      </View>

      {/* Mood Filter Section */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>MOOD</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {MOOD_FILTERS.map((mood) => (
              <GenreChip
                key={mood}
                label={mood}
                selected={(filters.moods ?? []).includes(mood)}
                onPress={() => toggleFilter('moods', mood)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>PACE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {PACE_FILTERS.map((pace) => (
              <GenreChip
                key={pace}
                label={pace}
                selected={(filters.paces ?? []).includes(pace)}
                onPress={() => toggleFilter('paces', pace)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Browse by Genre */}
      <SectionHeader
        title="Browse by Genre"
        action={{ text: 'EXPLORE ALL', onPress: () => router.push('/(books)/search') }}
        style={styles.sectionHeaderOverride}
      />

      <View style={styles.genreGrid}>
        {GENRE_CARDS.map((genre) => (
          <Pressable
            key={genre.name}
            style={[
              styles.genreCard,
              genre.span === 'full' ? styles.genreCardFull : styles.genreCardHalf,
              { backgroundColor: genre.color },
            ]}
            onPress={() => {
              setFilters({ ...filters, genres: [genre.name] });
            }}
          >
            <View style={styles.genreCardOverlay} />
            <View style={styles.genreCardContent}>
              <Text style={styles.genreCardTitle}>{genre.name}</Text>
              {genre.subtitle ? (
                <Text style={styles.genreCardSubtitle}>{genre.subtitle}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Recommended For You */}
      {topRecommendations.length > 0 && (
        <View style={styles.recommendedSection}>
          <SectionHeader
            title="Recommended for You"
            style={styles.sectionHeaderOverride}
          />
          {recentBook && (
            <Text style={styles.recommendedSubtitle}>
              Based on your recent reading history
            </Text>
          )}

          {topRecommendations.map((rec) => (
            <GlassCard
              key={rec.bookId}
              level={2}
              onPress={() => router.push(`/(books)/book/${rec.bookId}`)}
              style={styles.recCard}
            >
              <View style={styles.recCardInner}>
                <View style={styles.recCoverContainer}>
                  <BookCover
                    coverUrl={rec.coverUrl}
                    size="large"
                    title={rec.title}
                  />
                  {/* Match badge */}
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchBadgeText}>
                      {Math.round(rec.score * 100)}% MATCH
                    </Text>
                  </View>
                </View>

                <View style={styles.recInfo}>
                  <Text style={styles.recTitle} numberOfLines={2}>
                    {rec.title}
                  </Text>
                  <Text style={styles.recAuthor} numberOfLines={1}>
                    By {rec.authors.join(', ')}
                  </Text>

                  {/* Why This? expandable */}
                  <Pressable
                    style={styles.whyThisButton}
                    onPress={() =>
                      setExpandedReason(
                        expandedReason === rec.bookId ? null : rec.bookId
                      )
                    }
                  >
                    <SparklesIcon size={14} color={BOOKS_ACCENT} />
                    <Text style={styles.whyThisText}>WHY THIS?</Text>
                  </Pressable>

                  {expandedReason === rec.bookId && (
                    <View style={styles.reasonCard}>
                      <Text style={styles.reasonText}>
                        "{rec.reason}"
                      </Text>
                    </View>
                  )}

                  <GradientButton
                    label="PREVIEW"
                    onPress={() => router.push(`/(books)/book/${rec.bookId}`)}
                    style={styles.previewButton}
                  />
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      )}

      {/* External Suggestions Fallback */}
      {topRecommendations.length === 0 && (
        <View style={styles.recommendedSection}>
          <SectionHeader
            title="Recommended for You"
            style={styles.sectionHeaderOverride}
          />
          {externalLoading ? (
            <LoadingState rows={2} />
          ) : externalSuggestions.length === 0 ? (
            <EmptyState
              icon="🏷️"
              title="No suggestions yet"
              message="Add genre tags and rate your books to get personalized suggestions."
              accentColor={BOOKS_ACCENT}
            />
          ) : (
            <FlatList
              horizontal
              data={externalSuggestions}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.externalScroll}
              renderItem={({ item }) => (
                <GlassCard
                  level={2}
                  onPress={() => router.push('/(books)/search')}
                  style={styles.externalCard}
                >
                  <BookCover
                    coverUrl={item.coverUrl}
                    size="medium"
                    title={item.title}
                  />
                  <Text style={styles.externalTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.externalAuthor} numberOfLines={1}>
                    {item.authors.join(', ')}
                  </Text>
                  <View style={styles.externalGenreBadge}>
                    <Text style={styles.externalGenreText}>
                      {item.subject}
                    </Text>
                  </View>
                </GlassCard>
              )}
            />
          )}
        </View>
      )}

      {/* Filtered Results */}
      {(filters.moods?.length || filters.paces?.length || filters.genres?.length) ? (
        <View style={styles.filteredSection}>
          <SectionHeader
            title="Filtered Results"
            style={styles.sectionHeaderOverride}
          />
          {loading ? (
            <LoadingState rows={3} />
          ) : results.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No results"
              message="Adjust your filters to discover books."
              accentColor={BOOKS_ACCENT}
            />
          ) : (
            <FlatList
              horizontal
              data={results.slice(0, 10)}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.externalScroll}
              renderItem={({ item }) => {
                const authors = (() => {
                  try { return JSON.parse(item.authors); }
                  catch { return [item.authors]; }
                })();
                return (
                  <GlassCard
                    level={2}
                    onPress={() => router.push(`/(books)/book/${item.id}`)}
                    style={styles.externalCard}
                  >
                    <BookCover
                      coverUrl={item.cover_url ?? undefined}
                      size="medium"
                      title={item.title}
                    />
                    <Text style={styles.externalTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.externalAuthor} numberOfLines={1}>
                      {authors.join(', ')}
                    </Text>
                  </GlassCard>
                );
              }}
            />
          )}
        </View>
      ) : null}
    </ScrollView>
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
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  displayTitle: {
    color: '#E4E1E9',
  },
  subtitle: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginTop: 4,
    fontSize: 11,
    letterSpacing: 1.2,
  },

  // Filters
  filterGroup: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // Section header override to remove padding
  sectionHeaderOverride: {
    marginBottom: 12,
    paddingHorizontal: 20,
  },

  // Genre Grid
  genreGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  genreCard: {
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  genreCardFull: {
    width: '100%',
    height: 120,
  },
  genreCardHalf: {
    width: (SCREEN_WIDTH - 40 - 10) / 2,
    height: 100,
  },
  genreCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  genreCardContent: {
    padding: 16,
    zIndex: 1,
  },
  genreCardTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: '#E4E1E9',
  },
  genreCardSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Recommended Section
  recommendedSection: {
    marginBottom: 24,
  },
  recommendedSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  // Recommendation Cards
  recCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  recCardInner: {
    padding: 16,
    gap: 16,
  },
  recCoverContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  matchBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  recInfo: {
    gap: 4,
  },
  recTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
  },
  recAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },
  whyThisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  whyThisText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 11,
  },
  reasonCard: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  reasonText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#E4E1E9',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  previewButton: {
    marginTop: 12,
    alignSelf: 'stretch',
  },

  // External suggestions
  externalScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  externalCard: {
    width: 140,
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  externalTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#E4E1E9',
    textAlign: 'center',
    width: 120,
  },
  externalAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
    textAlign: 'center',
    width: 120,
  },
  externalGenreBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  externalGenreText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: BOOKS_ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Filtered results
  filteredSection: {
    marginBottom: 24,
  },
});
