import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  getAverageRating,
  getRatingDistribution,
  getReviewCount,
  getReviewsByTrail,
  getTrail,
  getTrails,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  type TrailCondition,
  type TrailReview,
  withAlpha,
} from '@mylife/trails';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type ReviewFilter = 'all' | 'five' | 'photos' | 'recent';

const FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'five', label: '5 Star' },
  { id: 'photos', label: 'With Photos' },
  { id: 'recent', label: 'Recent' },
];

const CONDITION_LABELS: Record<TrailCondition, string> = {
  clear: 'Clear',
  muddy: 'Muddy',
  snowy: 'Snowy',
  icy: 'Icy',
  buggy: 'Buggy',
  crowded: 'Crowded',
  overgrown: 'Overgrown',
  well_maintained: 'Well Maintained',
};

export default function ReviewsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { trailId } = useLocalSearchParams<{ trailId?: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTrailId, setSelectedTrailId] = useState(trailId ?? '');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [visibleCount, setVisibleCount] = useState(6);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  useEffect(() => {
    if (trailId) {
      setSelectedTrailId(trailId);
    }
  }, [trailId]);

  const trails = useMemo(() => getTrails(db, { limit: 100 }), [db, refreshKey]);

  useEffect(() => {
    if (!selectedTrailId && trails.length > 0) {
      setSelectedTrailId(trails[0].id);
    }
  }, [selectedTrailId, trails]);

  const trail = useMemo(() => {
    if (!selectedTrailId) {
      return null;
    }
    return getTrail(db, selectedTrailId);
  }, [db, selectedTrailId, refreshKey]);

  const reviews = useMemo(() => {
    if (!selectedTrailId) {
      return [] as TrailReview[];
    }
    return getReviewsByTrail(db, selectedTrailId);
  }, [db, selectedTrailId, refreshKey]);

  const averageRating = useMemo(() => {
    if (!selectedTrailId) {
      return null;
    }
    return getAverageRating(db, selectedTrailId);
  }, [db, selectedTrailId, refreshKey]);

  const reviewCount = useMemo(() => {
    if (!selectedTrailId) {
      return 0;
    }
    return getReviewCount(db, selectedTrailId);
  }, [db, selectedTrailId, refreshKey]);

  const distribution = useMemo(() => {
    if (!selectedTrailId) {
      return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }
    return getRatingDistribution(db, selectedTrailId);
  }, [db, selectedTrailId, refreshKey]);

  const filteredReviews = useMemo(() => {
    const now = Date.now();
    const recentCutoff = now - 1000 * 60 * 60 * 24 * 90;

    return reviews.filter((review) => {
      const photoUris = parsePhotoUris(review.photoUris);

      if (filter === 'five') {
        return review.rating === 5;
      }
      if (filter === 'photos') {
        return photoUris.length > 0;
      }
      if (filter === 'recent') {
        return new Date(review.createdAt).getTime() >= recentCutoff;
      }
      return true;
    });
  }, [filter, reviews]);

  const visibleReviews = filteredReviews.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(6);
  }, [filter, selectedTrailId]);

  const handleHelpful = useCallback((reviewId: string) => {
    setHelpfulVotes((current) => ({
      ...current,
      [reviewId]: (current[reviewId] ?? 0) + 1,
    }));
  }, []);

  const handleReport = useCallback(() => {
    Alert.alert('Review flagged', 'Thanks. This review has been marked for follow-up.');
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen
        options={{
          title: trail ? `${trail.name} Reviews` : 'Reviews',
        }}
      />

      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.eyebrow}>Reviews</Text>
            <Text style={styles.heroTitle}>Trail Notes</Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/(trails)/write-review', params: selectedTrailId ? { trailId: selectedTrailId } : undefined })}
            style={styles.writeButton}
          >
            <MaterialSymbol name="add" size={18} color="#102108" />
            <Text style={styles.writeButtonLabel}>Write Review</Text>
          </Pressable>
        </View>

        {trail ? (
          <View style={styles.heroTrailRow}>
            <View style={styles.heroTrailCopy}>
              <Text style={styles.heroTrailName}>{trail.name}</Text>
              <Text style={styles.heroTrailRegion}>{trail.region ?? 'Offline local trail'}</Text>
            </View>
            <View style={styles.heroRatingBlock}>
              <Text style={styles.heroRatingValue}>
                {averageRating !== null ? averageRating.toFixed(1) : '--'}
              </Text>
              <Text style={styles.heroRatingCopy}>
                {reviewCount} review{reviewCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyInlineCopy}>
            Select a trail to browse community reviews and trail-condition notes.
          </Text>
        )}
      </GlassCard>

      {trails.length > 1 ? (
        <View style={styles.selectorSection}>
          <SectionHeader title="Trail" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRail}>
            {trails.map((entry) => {
              const active = entry.id === selectedTrailId;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setSelectedTrailId(entry.id)}
                  style={[
                    styles.selectorChip,
                    active ? styles.selectorChipActive : null,
                  ]}
                >
                  <Text style={[styles.selectorLabel, active ? styles.selectorLabelActive : null]}>
                    {entry.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {trail ? (
        <>
          <GlassCard style={styles.histogramCard}>
            <SectionHeader title="Rating Breakdown" />
            <View style={styles.histogramList}>
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = distribution[rating] ?? 0;
                const percent = reviewCount > 0 ? count / reviewCount : 0;

                return (
                  <View key={`hist-${rating}`} style={styles.histogramRow}>
                    <View style={styles.histogramLabel}>
                      <Text style={styles.histogramRating}>{rating}</Text>
                      <MaterialSymbol name="star" size={14} color={TR_ACCENT_LIGHT} filled />
                    </View>
                    <View style={styles.histogramTrack}>
                      <View style={[styles.histogramFill, { flex: Math.max(percent, 0.04) }]} />
                      <View style={{ flex: Math.max(1 - percent, 0.04) }} />
                    </View>
                    <Text style={styles.histogramCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>

          <View style={styles.filterSection}>
            <SectionHeader title="Filters" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
              {FILTERS.map((entry) => {
                const active = entry.id === filter;
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => setFilter(entry.id)}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterLabel, active ? styles.filterLabelActive : null]}>
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {visibleReviews.length > 0 ? (
            <View style={styles.reviewList}>
              {visibleReviews.map((review, index) => {
                const photos = parsePhotoUris(review.photoUris);
                const helpfulCount = seededHelpfulCount(review.id) + (helpfulVotes[review.id] ?? 0);
                const conditions = parseConditions(review.conditions);

                return (
                  <GlassCard key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarLabel}>
                          {reviewerInitial(review, index)}
                        </Text>
                      </View>
                      <View style={styles.reviewIdentity}>
                        <View style={styles.reviewNameRow}>
                          <Text style={styles.reviewName}>
                            {reviewerName(review, index)}
                          </Text>
                          {review.recordingId || review.visitedAt ? (
                            <View style={styles.verifiedPill}>
                              <MaterialSymbol name="check_box" size={12} color={TR_ACCENT_LIGHT} filled />
                              <Text style={styles.verifiedCopy}>Trail Verified</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.reviewMetaRow}>
                          <StarRow rating={review.rating} />
                          <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                        </View>
                      </View>
                    </View>

                    {review.title ? (
                      <Text style={styles.reviewTitle}>{review.title}</Text>
                    ) : null}

                    {review.body ? (
                      <Text style={styles.reviewBody} numberOfLines={4}>
                        {review.body}
                      </Text>
                    ) : null}

                    {photos.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRail}>
                        {photos.map((uri, photoIndex) => (
                          <Image
                            key={`${review.id}-${photoIndex}`}
                            source={{ uri }}
                            contentFit="cover"
                            style={styles.reviewPhoto}
                          />
                        ))}
                      </ScrollView>
                    ) : null}

                    <View style={styles.conditionsRow}>
                      {conditions.map((condition) => (
                        <View key={`${review.id}-${condition}`} style={styles.conditionPill}>
                          <Text style={styles.conditionCopy}>{condition}</Text>
                        </View>
                      ))}
                      {review.visitedAt ? (
                        <View style={styles.conditionPill}>
                          <Text style={styles.conditionCopy}>
                            Visited {formatDate(review.visitedAt)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.reviewFooter}>
                      <Pressable onPress={() => handleHelpful(review.id)} style={styles.footerAction}>
                        <MaterialSymbol name="star" size={15} color={TR_ACCENT_LIGHT} filled />
                        <Text style={styles.footerActionLabel}>
                          Helpful {helpfulCount}
                        </Text>
                      </Pressable>
                      <Pressable onPress={handleReport} style={styles.footerAction}>
                        <MaterialSymbol name="flag" size={15} color={TR_TEXT_TERTIARY} />
                        <Text style={styles.footerActionLabel}>Report</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>⭐</Text>
              <Text style={styles.emptyTitle}>No matching reviews</Text>
              <Text style={styles.emptyCopy}>
                Adjust filters or leave the first review for this trail.
              </Text>
              <Pressable
                onPress={() => router.push({ pathname: '/(trails)/write-review', params: { trailId: trail.id } })}
                style={styles.inlineWriteButton}
              >
                <Text style={styles.inlineWriteLabel}>Write Review</Text>
              </Pressable>
            </GlassCard>
          )}

          {filteredReviews.length > visibleCount ? (
            <Pressable onPress={() => setVisibleCount((value) => value + 6)} style={styles.paginationButton}>
              <Text style={styles.paginationLabel}>Load More Reviews</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🥾</Text>
          <Text style={styles.emptyTitle}>No trails available</Text>
          <Text style={styles.emptyCopy}>
            Save a trail first, then return to reviews to see community feedback.
          </Text>
        </GlassCard>
      )}
    </ScrollView>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }, (_, index) => (
        <MaterialSymbol
          key={`review-star-${rating}-${index + 1}`}
          name="star"
          size={14}
          color={TR_ACCENT_LIGHT}
          filled={index < rating}
        />
      ))}
    </View>
  );
}

function parsePhotoUris(photoUris: string | null) {
  if (!photoUris) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(photoUris);
    return Array.isArray(parsed) ? parsed.filter((uri) => typeof uri === 'string') : [];
  } catch {
    return [] as string[];
  }
}

function parseConditions(conditions: string | null) {
  if (!conditions) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(conditions);
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .filter((condition): condition is TrailCondition => typeof condition === 'string')
      .map((condition) => CONDITION_LABELS[condition] ?? condition);
  } catch {
    return [] as string[];
  }
}

function reviewerName(review: TrailReview, index: number) {
  if (review.recordingId) {
    return `Recorded Hiker ${index + 1}`;
  }
  return `Local Hiker ${index + 1}`;
}

function reviewerInitial(review: TrailReview, index: number) {
  return reviewerName(review, index).charAt(0);
}

function seededHelpfulCount(reviewId: string) {
  return Array.from(reviewId).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 17;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  eyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...TR_TYPOGRAPHY.displayLg,
    fontSize: 28,
    lineHeight: 30,
    color: TR_TEXT,
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  writeButtonLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: '#102108',
    fontFamily: TR_FONTS.bold,
  },
  heroTrailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  heroTrailCopy: {
    flex: 1,
    gap: 4,
  },
  heroTrailName: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  heroTrailRegion: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  heroRatingBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  heroRatingValue: {
    ...TR_TYPOGRAPHY.displayLg,
    fontSize: 34,
    lineHeight: 34,
    color: TR_ACCENT_LIGHT,
  },
  heroRatingCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  emptyInlineCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  selectorSection: {
    gap: 10,
  },
  selectorRail: {
    gap: 10,
    paddingRight: 4,
  },
  selectorChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectorChipActive: {
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.92),
  },
  selectorLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    fontFamily: TR_FONTS.semiBold,
  },
  selectorLabelActive: {
    color: '#102108',
  },
  histogramCard: {
    gap: 12,
  },
  histogramList: {
    gap: 10,
  },
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  histogramLabel: {
    width: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  histogramRating: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  histogramTrack: {
    flex: 1,
    minHeight: 10,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  histogramFill: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  histogramCount: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
    width: 24,
    textAlign: 'right',
  },
  filterSection: {
    gap: 10,
  },
  filterRail: {
    gap: 10,
    paddingRight: 4,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipActive: {
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.92),
  },
  filterLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    fontFamily: TR_FONTS.semiBold,
  },
  filterLabelActive: {
    color: '#102108',
  },
  reviewList: {
    gap: 14,
  },
  reviewCard: {
    gap: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT, 0.28),
  },
  avatarLabel: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
  },
  reviewIdentity: {
    flex: 1,
    gap: 6,
  },
  reviewNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  reviewName: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT, 0.12),
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_ACCENT_LIGHT,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  reviewTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  reviewBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  photoRail: {
    gap: 10,
  },
  reviewPhoto: {
    width: 108,
    height: 88,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  conditionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  conditionCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerActionLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
    fontFamily: TR_FONTS.semiBold,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  emptyEmoji: {
    fontSize: 38,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
    textAlign: 'center',
  },
  emptyCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 280,
  },
  inlineWriteButton: {
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.92),
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  inlineWriteLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: '#102108',
    fontFamily: TR_FONTS.bold,
  },
  paginationButton: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  paginationLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.semiBold,
  },
});
