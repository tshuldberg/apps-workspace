import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_ACCENT,
  WK_ACCENT_DARK,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
} from '@mylife/workouts';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  LOCAL_SOCIAL_PROFILE_ID,
  buildWorkoutSocialSnapshot,
  filterFeedItemsBySegment,
  paginateSocialFeed,
  type WorkoutSocialFeedItem,
  type WorkoutSocialReactionKey,
  type WorkoutSocialSegment,
  type WorkoutSocialSnapshot,
} from '../../lib/workouts/social';
import { WorkoutPhaseHeader } from './phase2-kit';
import { SocialAvatar, SocialPostCard } from './social-kit';

const INITIAL_SNAPSHOT: WorkoutSocialSnapshot = {
  composerSessionId: null,
  feed: [],
  profiles: {},
};

const SEGMENTS: Array<{ key: WorkoutSocialSegment; label: string }> = [
  { key: 'for-you', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'trending', label: 'Trending' },
];

export default function SocialFeedScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WorkoutSocialSnapshot>(INITIAL_SNAPSHOT);
  const [segment, setSegment] = useState<WorkoutSocialSegment>('for-you');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [activeReactions, setActiveReactions] = useState<
    Record<string, WorkoutSocialReactionKey | null>
  >({});

  const loadSnapshot = useCallback(() => {
    try {
      const next = buildWorkoutSocialSnapshot(db);
      setSnapshot(next);
      setError(null);
      setPage(0);
    } catch (loadError) {
      setSnapshot(INITIAL_SNAPSHOT);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the community feed right now.',
      );
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSnapshot();
    }, [loadSnapshot]),
  );

  const refreshFeed = useCallback(() => {
    setRefreshing(true);
    try {
      loadSnapshot();
    } finally {
      setRefreshing(false);
    }
  }, [loadSnapshot]);

  const filteredFeed = useMemo(
    () => filterFeedItemsBySegment(snapshot.feed, segment),
    [segment, snapshot.feed],
  );
  const visibleFeed = useMemo(
    () => paginateSocialFeed(filteredFeed, page),
    [filteredFeed, page],
  );
  const hasMore = visibleFeed.length < filteredFeed.length;
  const localProfile = snapshot.profiles[LOCAL_SOCIAL_PROFILE_ID];

  const handleOpenComposer = useCallback(() => {
    if (snapshot.composerSessionId) {
      router.push(
        `/(workouts)/share-workout?sessionId=${encodeURIComponent(snapshot.composerSessionId)}` as never,
      );
      return;
    }

    router.push('/(workouts)/share-workout' as never);
  }, [router, snapshot.composerSessionId]);

  const handleOpenProfile = useCallback(
    (userId: string) => {
      router.push(`/(workouts)/social?userId=${encodeURIComponent(userId)}` as never);
    },
    [router],
  );

  const handleToggleComments = useCallback((postId: string) => {
    setExpandedComments((current) => ({
      ...current,
      [postId]: !current[postId],
    }));
  }, []);

  const handleReact = useCallback(
    (postId: string, reaction: WorkoutSocialReactionKey) => {
      setActiveReactions((current) => ({
        ...current,
        [postId]: current[postId] === reaction ? null : reaction,
      }));
    },
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasMore) {
      setPage((current) => current + 1);
    }
  }, [hasMore]);

  const renderPost = useCallback(
    ({ item }: { item: WorkoutSocialFeedItem }) => (
      <SocialPostCard
        activeReaction={activeReactions[item.id] ?? null}
        expanded={!!expandedComments[item.id]}
        onOpenProfile={handleOpenProfile}
        onReact={handleReact}
        onToggleComments={handleToggleComments}
        post={item}
      />
    ),
    [activeReactions, expandedComments, handleOpenProfile, handleReact, handleToggleComments],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutPhaseHeader
        title="Community"
        onBack={() => router.back()}
        right={(
          <Pressable
            onPress={() =>
              Alert.alert(
                'Filters Coming Soon',
                'Advanced sorting and coach-only views will land once the live social backend is wired.',
              )
            }
            style={styles.headerAction}
          >
            <MaterialSymbol name="filter_alt" size={18} color={WK_ACCENT_LIGHT} />
          </Pressable>
        )}
      />

      <FlatList
        data={visibleFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={refreshFeed}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.32}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <SectionLabel>Performance Center</SectionLabel>
              <RNText style={styles.heroTitle}>Community</RNText>
              <RNText style={styles.heroBody}>
                Lift notes, trail miles, and recovery rituals from the people shaping your next session.
              </RNText>
            </View>

            <View style={styles.segmentRow}>
              {SEGMENTS.map((item) => {
                const selected = item.key === segment;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setSegment(item.key);
                      setPage(0);
                    }}
                    style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                  >
                    {selected ? (
                      <LinearGradient
                        colors={[WK_ACCENT_LIGHT, WK_ACCENT]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.segmentGradient}
                      >
                        <RNText style={styles.segmentActiveText}>{item.label}</RNText>
                      </LinearGradient>
                    ) : (
                      <RNText style={styles.segmentText}>{item.label}</RNText>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <GlassPanel padding={18} style={styles.composerCard}>
              <View style={styles.composerRow}>
                <View style={styles.composerLeft}>
                  <SocialAvatar
                    accent={WK_ACCENT_LIGHT}
                    displayName={localProfile?.displayName ?? 'You'}
                    size={54}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <RNText style={styles.composerTitle}>Share your workout</RNText>
                    <RNText style={styles.composerSubtitle}>
                      Post the latest session that deserves a spot in your archive.
                    </RNText>
                  </View>
                </View>

                <Pressable onPress={handleOpenComposer} style={styles.postButtonWrap}>
                  <LinearGradient
                    colors={['#FF705A', '#EF4444']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.postButton}
                  >
                    <RNText style={styles.postButtonText}>Post</RNText>
                  </LinearGradient>
                </Pressable>
              </View>
            </GlassPanel>

            {error ? (
              <GlassPanel padding={18} style={styles.errorCard}>
                <RNText style={styles.errorTitle}>Feed unavailable</RNText>
                <RNText style={styles.errorBody}>{error}</RNText>
              </GlassPanel>
            ) : null}
          </View>
        )}
        ListEmptyComponent={(
          <GlassPanel padding={24} style={styles.emptyCard}>
            <RNText style={styles.emptyTitle}>Nothing in the stream yet</RNText>
            <RNText style={styles.emptyBody}>
              Finish a workout or open the share flow to seed the first community card.
            </RNText>
          </GlassPanel>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footer}>
              <RNText style={styles.footerText}>Loading the next block of posts...</RNText>
            </View>
          ) : (
            <View style={styles.footer} />
          )
        }
      />

      <Pressable onPress={handleOpenComposer} style={styles.fabWrap}>
        <LinearGradient
          colors={[WK_ACCENT_LIGHT, WK_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <MaterialSymbol name="add" size={18} color={WK_ACCENT_DARK} />
          <RNText style={styles.fabText}>Post</RNText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 164,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  headerContent: {
    gap: 18,
    paddingBottom: 18,
  },
  hero: {
    gap: 10,
  },
  heroTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  heroBody: {
    maxWidth: 320,
    color: 'rgba(214, 195, 181, 0.82)',
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    minWidth: 92,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'transparent',
  },
  segmentGradient: {
    minHeight: 42,
    minWidth: 92,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  segmentText: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  segmentActiveText: {
    color: '#4A2600',
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  composerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 28,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  composerTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 20,
  },
  composerSubtitle: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  postButtonWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  postButton: {
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 22,
  },
  errorTitle: {
    color: '#FFB4AB',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  errorBody: {
    marginTop: 6,
    color: 'rgba(255, 218, 214, 0.86)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    marginTop: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  emptyTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: 'rgba(214, 195, 181, 0.56)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 26,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fab: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fabText: {
    color: WK_ACCENT_DARK,
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
