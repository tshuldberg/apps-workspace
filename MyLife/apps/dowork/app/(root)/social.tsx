import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MaterialSymbol,
  WK_FONTS,
  WK_SURFACES,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import {
  LOCAL_SOCIAL_PROFILE_ID,
  buildWorkoutSocialSnapshot,
  getPrivacyPresentation,
  getProfileFeedItems,
  getSocialProfile,
  paginateSocialFeed,
  type WorkoutSocialReactionKey,
  type WorkoutSocialSnapshot,
} from '../../lib/workouts/social';
import { WorkoutPhaseHeader } from './phase2-kit';
import { SocialAvatar, SocialPostCard } from './social-kit';
import { DW_ACCENT, DW_ACCENT_DARK, DW_ACCENT_LIGHT } from './theme/tokens';
import { listMyShares, type CloudShareRow } from './data/cloud-shares';
import { likeShare, unlikeShare } from './data/cloud-likes';
import { shouldShowDemoContent } from './data/public-render-policy';

const INITIAL_SNAPSHOT: WorkoutSocialSnapshot = {
  composerSessionId: null,
  feed: [],
  profiles: {},
};

export default function SocialProfileScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const { supabase, userId } = useDoWorkCloud();
  const showDemo = shouldShowDemoContent();

  const [snapshot, setSnapshot] = useState<WorkoutSocialSnapshot>(INITIAL_SNAPSHOT);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [activeReactions, setActiveReactions] = useState<
    Record<string, WorkoutSocialReactionKey | null>
  >({});
  const [followingOverrides, setFollowingOverrides] = useState<Record<string, boolean>>({});
  const [cloudShares, setCloudShares] = useState<CloudShareRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

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
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load this profile right now.',
      );
    }
  }, [db, showDemo]);

  const loadCloudShares = useCallback(async () => {
    if (!supabase || !userId) {
      setCloudShares([]);
      return;
    }
    const result = await listMyShares(supabase, userId, { limit: 20 });
    if (result.ok) {
      setCloudShares(result.shares);
      setLikedIds(new Set(result.shares.filter((s) => s.myLikedFlag).map((s) => s.id)));
    }
  }, [supabase, userId]);

  useFocusEffect(
    useCallback(() => {
      loadSnapshot();
      void loadCloudShares();
    }, [loadSnapshot, loadCloudShares]),
  );

  const refreshProfile = useCallback(async () => {
    setRefreshing(true);
    try {
      loadSnapshot();
      await loadCloudShares();
    } finally {
      setRefreshing(false);
    }
  }, [loadSnapshot, loadCloudShares]);

  const selectedUserId = typeof params.userId === 'string' ? params.userId : undefined;
  const profile = useMemo(
    () => getSocialProfile(snapshot, selectedUserId),
    [selectedUserId, snapshot],
  );
  const isFollowing = followingOverrides[profile.userId] ?? profile.isFollowedByMe;
  const privacy = getPrivacyPresentation(profile.privacySettings);
  const shouldHideFeed =
    privacy.privacyLevel === 'private' &&
    !isFollowing &&
    profile.userId !== LOCAL_SOCIAL_PROFILE_ID;
  const profileFeed = useMemo(
    () => getProfileFeedItems(snapshot, profile.userId),
    [profile.userId, snapshot],
  );
  const visibleFeed = useMemo(
    () => paginateSocialFeed(profileFeed, page),
    [page, profileFeed],
  );
  const hasMore = visibleFeed.length < profileFeed.length;

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

  const handleFollowToggle = useCallback(() => {
    if (profile.userId === LOCAL_SOCIAL_PROFILE_ID) {
      router.push('/(root)/(tabs)/settings' as never);
      return;
    }

    setFollowingOverrides((current) => ({
      ...current,
      [profile.userId]: !isFollowing,
    }));
  }, [isFollowing, profile.userId, router]);

  const handleToggleLike = useCallback(
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
        // revert
        const reverted = new Set(likedIds);
        setLikedIds(reverted);
      }
    },
    [supabase, userId, likedIds],
  );

  const renderPost = useCallback(
    ({ item }: { item: (typeof visibleFeed)[number] }) => (
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
        title={profile.displayName}
        onBack={() => router.back()}
        right={(
          <Pressable style={styles.headerAction}>
            <MaterialSymbol name="more_horiz" size={18} color={DW_ACCENT_LIGHT} />
          </Pressable>
        )}
      />

      <FlatList
        data={shouldHideFeed ? [] : visibleFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        refreshing={refreshing}
        onRefresh={() => void refreshProfile()}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.32}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.heroCard}>
              <View style={styles.profileTop}>
                <SocialAvatar
                  accent={privacy.privacyAccent}
                  displayName={profile.displayName}
                  size={96}
                />

                <View style={styles.profileCopy}>
                  <RNText style={styles.profileName}>{profile.displayName}</RNText>
                  <RNText style={styles.profileBio}>{profile.bio}</RNText>

                  <View style={styles.heroActionRow}>
                    <View
                      style={[
                        styles.privacyChip,
                        { backgroundColor: `${privacy.privacyAccent}20` },
                      ]}
                    >
                      <MaterialSymbol
                        name={privacy.privacyIcon}
                        size={12}
                        color={privacy.privacyAccent}
                      />
                      <RNText style={[styles.privacyChipText, { color: privacy.privacyAccent }]}>
                        {privacy.privacyLabel}
                      </RNText>
                    </View>

                    <Pressable onPress={handleFollowToggle} style={styles.followWrap}>
                      {isFollowing || profile.userId === LOCAL_SOCIAL_PROFILE_ID ? (
                        <View style={styles.followSecondary}>
                          <RNText style={styles.followSecondaryText}>
                            {profile.userId === LOCAL_SOCIAL_PROFILE_ID ? 'Settings' : 'Following'}
                          </RNText>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={[DW_ACCENT_LIGHT, DW_ACCENT]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.followPrimary}
                        >
                          <MaterialSymbol name="add" size={16} color={DW_ACCENT_DARK} />
                          <RNText style={styles.followPrimaryText}>Follow</RNText>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.statRow}>
                <ProfileStat label="Workouts" value={profile.totalWorkouts} />
                <ProfileStat label="Followers" value={profile.followerCount} />
                <ProfileStat label="Following" value={profile.followingCount} />
              </View>
            </View>

            {error ? (
              <View style={styles.noticeCard}>
                <RNText style={styles.noticeTitle}>Profile unavailable</RNText>
                <RNText style={styles.noticeBody}>{error}</RNText>
              </View>
            ) : null}

            {!showDemo && cloudShares.length > 0 && profile.userId === LOCAL_SOCIAL_PROFILE_ID ? (
              <View style={styles.cloudSection}>
                <RNText style={styles.cloudSectionTitle}>Your Shares</RNText>
                {cloudShares.map((share) => (
                  <CloudShareRowCard
                    key={share.id}
                    share={share}
                    liked={likedIds.has(share.id)}
                    onToggleLike={() => void handleToggleLike(share.id)}
                  />
                ))}
              </View>
            ) : null}

            {shouldHideFeed ? (
              <View style={styles.noticeCard}>
                <RNText style={styles.noticeTitle}>Private profile</RNText>
                <RNText style={styles.noticeBody}>
                  Follow this athlete to unlock their recent training stream.
                </RNText>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          shouldHideFeed ? null : (
            <View style={styles.noticeCard}>
              <RNText style={styles.noticeTitle}>No recent posts</RNText>
              <RNText style={styles.noticeBody}>
                {showDemo
                  ? 'This profile is quiet right now, but the next block usually lands after the next session.'
                  : 'Share a finished workout to start building this profile.'}
              </RNText>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </View>
  );
}

function CloudShareRowCard({
  share,
  liked,
  onToggleLike,
}: {
  share: CloudShareRow;
  liked: boolean;
  onToggleLike: () => void;
}) {
  return (
    <View style={styles.shareCard}>
      <RNText style={styles.shareTitle}>{share.title}</RNText>
      {share.summary ? (
        <RNText style={styles.shareSummary}>{share.summary}</RNText>
      ) : null}
      <View style={styles.shareStatRow}>
        <RNText style={styles.shareStat}>{Math.round(share.durationSeconds / 60)} min</RNText>
        <RNText style={styles.shareStat}>{share.exerciseCount} exercises</RNText>
        <RNText style={styles.shareStat}>{Math.round(share.totalVolumeKg)} kg</RNText>
      </View>
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
    </View>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <RNText style={styles.statValue}>{formatCompact(value)}</RNText>
      <RNText style={styles.statLabel}>{label}</RNText>
    </View>
  );
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 132,
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
  heroCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  profileCopy: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.8,
  },
  profileBio: {
    color: 'rgba(214, 195, 181, 0.82)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  privacyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  privacyChipText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  followWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  followPrimary: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  followPrimaryText: {
    color: DW_ACCENT_DARK,
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  followSecondary: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  followSecondaryText: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 84,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  statValue: {
    color: DW_ACCENT_LIGHT,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 18,
    lineHeight: 20,
  },
  statLabel: {
    marginTop: 6,
    color: 'rgba(214, 195, 181, 0.62)',
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noticeCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  noticeTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  noticeBody: {
    marginTop: 6,
    color: 'rgba(214, 195, 181, 0.76)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
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
  },
});
