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
  WK_FONTS,
  WK_SURFACES,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
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
import { DW_ACCENT, DW_ACCENT_DARK, DW_ACCENT_LIGHT } from './theme/tokens';
import { listPublicShares, type CloudShareRow } from './data/cloud-shares';
import { likeShare, unlikeShare } from './data/cloud-likes';
import { friendlyError } from './data/friendly-errors';
import { shouldShowDemoContent } from './data/public-render-policy';
import { REPORT_REASONS, submitReport } from './data/cloud-reports';
import { blockUser, listBlockedUserIds } from './data/cloud-blocks';
import { getPublicProfiles, type CloudUserProfile } from './data/cloud-profiles';

const INITIAL_SNAPSHOT: WorkoutSocialSnapshot = {
  composerSessionId: null,
  feed: [],
  profiles: {},
};

// No "Following" segment: DoWork has no follows schema, so a Following tab would
// show public/followers shares from everyone under a false label. Omit it rather
// than fake the semantics.
const SEGMENTS: Array<{ key: WorkoutSocialSegment; label: string }> = [
  { key: 'for-you', label: 'For You' },
  { key: 'trending', label: 'Trending' },
];

export default function SocialFeedScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { supabase, userId } = useDoWorkCloud();
  const showDemo = shouldShowDemoContent();

  const [snapshot, setSnapshot] = useState<WorkoutSocialSnapshot>(INITIAL_SNAPSHOT);
  const [segment, setSegment] = useState<WorkoutSocialSegment>('for-you');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [activeReactions, setActiveReactions] = useState<
    Record<string, WorkoutSocialReactionKey | null>
  >({});
  const [cloudShares, setCloudShares] = useState<CloudShareRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [authorProfiles, setAuthorProfiles] = useState<Map<string, CloudUserProfile>>(new Map());

  const loadSnapshot = useCallback(() => {
    try {
      if (showDemo) {
        const next = buildWorkoutSocialSnapshot(db);
        setSnapshot(next);
      } else {
        setSnapshot(INITIAL_SNAPSHOT);
      }
      setError(null);
      setPage(0);
    } catch (loadError) {
      setSnapshot(INITIAL_SNAPSHOT);
      setError(
        friendlyError(
          loadError instanceof Error ? loadError.message : null,
          'Unable to load the community feed right now.',
        ),
      );
    }
  }, [db, showDemo]);

  const loadCloudShares = useCallback(
    async () => {
      if (!supabase) {
        setCloudShares([]);
        return;
      }
      const result = await listPublicShares(supabase, { limit: 20 });
      if (!result.ok) {
        setError(friendlyError(result.error));
        return;
      }

      // Blocked authors disappear from the feed (Guideline 1.2).
      let blocked = new Set<string>();
      if (userId) {
        const blocksResult = await listBlockedUserIds(supabase, userId);
        if (blocksResult.ok) blocked = blocksResult.blockedUserIds;
      }
      const visible = result.shares.filter((share) => !blocked.has(share.userId));

      setCloudShares(visible);
      setLikedIds(new Set(visible.filter((s) => s.myLikedFlag).map((s) => s.id)));

      // Resolve author identities through the public profiles view.
      const profilesResult = await getPublicProfiles(
        supabase,
        visible.map((share) => share.userId),
      );
      if (profilesResult.ok) setAuthorProfiles(profilesResult.profiles);
    },
    [supabase, userId],
  );

  useFocusEffect(
    useCallback(() => {
      loadSnapshot();
      void loadCloudShares();
    }, [loadSnapshot, loadCloudShares]),
  );

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      loadSnapshot();
      await loadCloudShares();
    } finally {
      setRefreshing(false);
    }
  }, [loadSnapshot, loadCloudShares]);

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
        `/(root)/share-workout?sessionId=${encodeURIComponent(snapshot.composerSessionId)}` as never,
      );
      return;
    }

    router.push('/(root)/share-workout' as never);
  }, [router, snapshot.composerSessionId]);

  const handleOpenProfile = useCallback(
    (otherUserId: string) => {
      router.push(`/(root)/social?userId=${encodeURIComponent(otherUserId)}` as never);
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

  const handleToggleCloudLike = useCallback(
    async (shareId: string) => {
      if (!supabase || !userId) return;
      const wasLiked = likedIds.has(shareId);
      const next = new Set(likedIds);
      if (wasLiked) next.delete(shareId);
      else next.add(shareId);
      setLikedIds(next);

      const result = wasLiked
        ? await unlikeShare(supabase, shareId, userId)
        : await likeShare(supabase, shareId, userId);
      if (!result.ok) {
        setLikedIds(new Set(likedIds));
      }
    },
    [supabase, userId, likedIds],
  );

  const handleOpenPost = useCallback(
    (shareId: string) => {
      router.push(`/(root)/post/${encodeURIComponent(shareId)}` as never);
    },
    [router],
  );

  const handleReportShare = useCallback(
    (share: CloudShareRow, reason: string) => {
      if (!supabase || !userId) return;
      void (async () => {
        const result = await submitReport(supabase, {
          reporterUserId: userId,
          targetKind: 'share',
          targetId: share.id,
          reason,
        });
        Alert.alert(
          result.ok ? 'Report received' : 'Report failed',
          result.ok
            ? 'Thanks. Reports are reviewed within 24 hours.'
            : friendlyError(result.error),
        );
      })();
    },
    [supabase, userId],
  );

  const handleBlockAuthor = useCallback(
    (share: CloudShareRow, handle: string) => {
      if (!supabase || !userId) return;
      void (async () => {
        const result = await blockUser(supabase, userId, share.userId);
        if (!result.ok) {
          Alert.alert('Block failed', friendlyError(result.error));
          return;
        }
        setCloudShares((current) => current.filter((s) => s.userId !== share.userId));
        Alert.alert('Blocked', `${handle} will no longer appear in your feed. Manage blocks in Settings.`);
      })();
    },
    [supabase, userId],
  );

  const handleShareMenu = useCallback(
    (share: CloudShareRow) => {
      const handle = authorProfiles.get(share.userId)?.handle
        ? `@${authorProfiles.get(share.userId)!.handle}`
        : 'this user';
      const isOwn = share.userId === userId;
      if (isOwn) return;
      Alert.alert(share.title, undefined, [
        {
          text: 'Report post',
          onPress: () => {
            Alert.alert('Why are you reporting this?', undefined, [
              ...REPORT_REASONS.map((reason) => ({
                text: reason,
                onPress: () => handleReportShare(share, reason),
              })),
              { text: 'Cancel', style: 'cancel' as const },
            ]);
          },
        },
        {
          text: `Block ${handle}`,
          style: 'destructive',
          onPress: () => handleBlockAuthor(share, handle),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [authorProfiles, userId, handleReportShare, handleBlockAuthor],
  );

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
      <WorkoutPhaseHeader title="Community" onBack={() => router.back()} />

      <FlatList
        data={visibleFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void refreshFeed()}
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
                        colors={[DW_ACCENT_LIGHT, DW_ACCENT]}
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
                    accent={DW_ACCENT_LIGHT}
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
                    colors={[DW_ACCENT_LIGHT, DW_ACCENT]}
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

            {cloudShares.length > 0 ? (
              <View style={styles.cloudSection}>
                <RNText style={styles.cloudSectionTitle}>Live community shares</RNText>
                {cloudShares.map((share) => (
                  <CloudShareCard
                    key={share.id}
                    share={share}
                    author={authorProfiles.get(share.userId) ?? null}
                    isOwn={share.userId === userId}
                    liked={likedIds.has(share.id)}
                    onToggleLike={() => void handleToggleCloudLike(share.id)}
                    onOpenComments={() => handleOpenPost(share.id)}
                    onMenu={() => handleShareMenu(share)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          cloudShares.length > 0 ? null : (
            <GlassPanel padding={24} style={styles.emptyCard}>
              <RNText style={styles.emptyTitle}>Nothing in the stream yet</RNText>
              <RNText style={styles.emptyBody}>
                Finish a workout or open the share flow to seed the first community card.
              </RNText>
            </GlassPanel>
          )
        }
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
          colors={[DW_ACCENT_LIGHT, DW_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <MaterialSymbol name="add" size={18} color={DW_ACCENT_DARK} />
          <RNText style={styles.fabText}>Post</RNText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function CloudShareCard({
  share,
  author,
  isOwn,
  liked,
  onToggleLike,
  onOpenComments,
  onMenu,
}: {
  share: CloudShareRow;
  author: CloudUserProfile | null;
  isOwn: boolean;
  liked: boolean;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onMenu: () => void;
}) {
  const authorName = isOwn
    ? 'You'
    : author?.displayName ?? (author ? `@${author.handle}` : 'Lifter');
  const authorHandle = author ? `@${author.handle}` : null;

  return (
    <View style={styles.shareCard}>
      <View style={styles.shareAuthorRow}>
        <SocialAvatar accent={DW_ACCENT_LIGHT} displayName={authorName} size={34} />
        <View style={{ flex: 1, gap: 1 }}>
          <RNText style={styles.shareAuthorName}>{authorName}</RNText>
          {authorHandle && !isOwn ? (
            <RNText style={styles.shareAuthorHandle}>{authorHandle}</RNText>
          ) : null}
        </View>
        {!isOwn ? (
          <Pressable
            onPress={onMenu}
            hitSlop={10}
            accessibilityLabel="Post actions"
            style={styles.shareMenuButton}
          >
            <MaterialSymbol name="more_horiz" size={18} color="rgba(214, 195, 181, 0.62)" />
          </Pressable>
        ) : null}
      </View>
      <RNText style={styles.shareTitle}>{share.title}</RNText>
      {share.summary ? (
        <RNText style={styles.shareSummary}>{share.summary}</RNText>
      ) : null}
      <View style={styles.shareStatRow}>
        <RNText style={styles.shareStat}>{Math.round(share.durationSeconds / 60)} min</RNText>
        <RNText style={styles.shareStat}>{share.exerciseCount} exercises</RNText>
        <RNText style={styles.shareStat}>{Math.round(share.totalVolumeKg)} kg</RNText>
      </View>
      <View style={styles.shareActionsRow}>
        <Pressable onPress={onToggleLike} style={styles.likeButton}>
          <MaterialSymbol
            name={liked ? 'favorite' : 'favorite_border'}
            size={16}
            color={liked ? DW_ACCENT_LIGHT : 'rgba(214, 195, 181, 0.62)'}
          />
          <RNText style={[styles.likeText, liked && { color: DW_ACCENT_LIGHT }]}>
            {share.likeCount + (liked && !share.myLikedFlag ? 1 : 0)}
          </RNText>
        </Pressable>
        <Pressable onPress={onOpenComments} style={styles.likeButton}>
          <MaterialSymbol name="chat_bubble" size={15} color="rgba(214, 195, 181, 0.62)" />
          <RNText style={styles.likeText}>
            {share.commentCount} comments
          </RNText>
        </Pressable>
      </View>
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
    color: DW_ACCENT_DARK,
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
    color: DW_ACCENT_DARK,
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
  cloudSection: {
    gap: 10,
  },
  cloudSectionTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  shareCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 8,
  },
  shareAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareAuthorName: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  shareAuthorHandle: {
    color: 'rgba(214, 195, 181, 0.56)',
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    lineHeight: 13,
  },
  shareMenuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  shareActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shareTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  shareSummary: {
    color: 'rgba(214, 195, 181, 0.76)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  shareStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shareStat: {
    color: 'rgba(214, 195, 181, 0.62)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  likeText: {
    color: 'rgba(214, 195, 181, 0.62)',
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
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
    color: DW_ACCENT_DARK,
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
