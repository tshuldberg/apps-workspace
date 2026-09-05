import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  type BadgeDefinition,
  type BestChefResult,
  type ChefBadge,
  type Submission,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';
import {
  type SocialProfile,
  useFollowers,
  getSocialClient,
} from '@mylife/social';

// ── Types ────────────────────────────────────────────────────────────

interface ChefProfileData {
  profile: SocialProfile;
  submissionCount: number;
  totalVotesReceived: number;
  dishesWon: number;
}

interface CuisineCount {
  cuisine: string;
  count: number;
}

// ── Stubs (cloud functions not yet implemented) ──────────────────────

async function getChefProfile(
  profileId: string,
): Promise<BestChefResult<ChefProfileData>> {
  const client = getSocialClient();
  if (!client) return { ok: false, error: 'Social client not initialized' };
  const result = await client.getProfilesByIds([profileId]);
  if (!result.ok) return { ok: false, error: result.error };
  const profile = result.data[0];
  if (!profile) return { ok: false, error: 'Profile not found' };
  return {
    ok: true,
    data: {
      profile,
      submissionCount: 0,
      totalVotesReceived: 0,
      dishesWon: 0,
    },
  };
}

async function getChefSubmissions(
  _profileId: string,
): Promise<BestChefResult<Submission[]>> {
  return { ok: true, data: [] };
}

async function getSignatureDishes(
  _profileId: string,
): Promise<BestChefResult<Submission[]>> {
  return { ok: true, data: [] };
}

async function getChefBadges(
  _profileId: string,
): Promise<BestChefResult<ChefBadge[]>> {
  return { ok: true, data: [] };
}

async function getBadgeDefinitions(): Promise<BestChefResult<BadgeDefinition[]>> {
  return { ok: true, data: [] };
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractCuisineBreakdown(submissions: Submission[]): CuisineCount[] {
  const counts: Record<string, number> = {};
  for (const sub of submissions) {
    const cuisine = sub.chefOrigin ?? 'Unknown';
    counts[cuisine] = (counts[cuisine] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Screen ───────────────────────────────────────────────────────────

export default function ChefProfileScreen() {
  const { profileId, handle } = useLocalSearchParams<{
    profileId?: string;
    handle?: string;
  }>();
  const router = useRouter();

  const [chef, setChef] = useState<ChefProfileData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [signatureDishes, setSignatureDishes] = useState<Submission[]>([]);
  const [badges, setBadges] = useState<ChefBadge[]>([]);
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolvedId = profileId ?? handle ?? '';

  const { data: followers } = useFollowers(resolvedId);

  const load = useCallback(async () => {
    if (!resolvedId) return;
    setLoading(true);
    setError(null);
    try {
      const [profileResult, subsResult, sigResult, badgesResult, defsResult] =
        await Promise.all([
          getChefProfile(resolvedId),
          getChefSubmissions(resolvedId),
          getSignatureDishes(resolvedId),
          getChefBadges(resolvedId),
          getBadgeDefinitions(),
        ]);

      if (!profileResult.ok) {
        setError(profileResult.error);
        return;
      }
      setChef(profileResult.data);
      if (subsResult.ok) setSubmissions(subsResult.data);
      if (sigResult.ok) setSignatureDishes(sigResult.data);
      if (badgesResult.ok) setBadges(badgesResult.data);
      if (defsResult.ok) setBadgeDefs(defsResult.data);

      // Check if current user follows this chef
      const client = getSocialClient();
      if (client) {
        const myProfile = await client.getMyProfile();
        if (myProfile.ok && myProfile.data) {
          const followingResult = await client.getFollowing(myProfile.data.id);
          if (followingResult.ok) {
            setIsFollowing(
              followingResult.data.some((p) => p.id === resolvedId),
            );
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load chef profile',
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFollowToggle = async () => {
    const client = getSocialClient();
    if (!client) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await client.unfollow(resolvedId);
        setIsFollowing(false);
      } else {
        await client.follow(resolvedId);
        setIsFollowing(true);
      }
    } catch {
      // Revert silently on failure
    } finally {
      setFollowLoading(false);
    }
  };

  const cuisineBreakdown = extractCuisineBreakdown(submissions);
  const maxCuisineCount = cuisineBreakdown[0]?.count ?? 1;

  const badgeDefMap = new Map(badgeDefs.map((d) => [d.id, d]));

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={8} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }

  if (!chef) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="person"
          title="Chef not found"
          message="This chef profile may have been removed"
        />
      </View>
    );
  }

  const { profile } = chef;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <GlassCard level={2} style={styles.headerCard}>
          <View style={styles.headerRow}>
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {profile.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.displayName}>{profile.displayName}</Text>
              <Text style={styles.handle}>@{profile.handle}</Text>
            </View>
          </View>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {/* Follow button */}
          <Pressable
            style={[
              styles.followButton,
              isFollowing && styles.followButtonActive,
            ]}
            onPress={() => void handleFollowToggle()}
            disabled={followLoading}
          >
            <Text
              style={[
                styles.followButtonText,
                isFollowing && styles.followButtonTextActive,
              ]}
            >
              {followLoading
                ? '...'
                : isFollowing
                  ? 'Following'
                  : 'Follow'}
            </Text>
          </Pressable>
        </GlassCard>

        {/* Stats bar */}
        <GlassCard level={3} style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{chef.submissionCount}</Text>
              <Text style={styles.statLabel}>Submissions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{chef.totalVotesReceived}</Text>
              <Text style={styles.statLabel}>Votes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{chef.dishesWon}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {followers?.length ?? profile.followerCount}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        </GlassCard>

        {/* Badge shelf */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeRow}
            >
              {badges.map((badge) => {
                const def = badgeDefMap.get(badge.badgeId);
                return (
                  <View key={badge.id} style={styles.badgeItem}>
                    <View
                      style={[
                        styles.badgeCircle,
                        def?.tier === 'gold' && styles.badgeGold,
                        def?.tier === 'platinum' && styles.badgePlatinum,
                      ]}
                    >
                      <Text style={styles.badgeIcon}>{def?.icon ?? '🏅'}</Text>
                    </View>
                    <Text style={styles.badgeName} numberOfLines={1}>
                      {def?.name ?? badge.badgeId}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Signature dishes */}
        {signatureDishes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signature Dishes</Text>
            <View style={styles.signatureList}>
              {signatureDishes.slice(0, 3).map((sub, idx) => (
                <GlassCard
                  key={sub.id}
                  level={3}
                  style={styles.signatureCard}
                  onPress={() =>
                    router.push(`/(recipes)/dish/${sub.dishId}`)
                  }
                >
                  <View style={styles.signatureRow}>
                    <View style={styles.signatureRank}>
                      <Text style={styles.signatureRankText}>
                        #{idx + 1}
                      </Text>
                    </View>
                    {sub.photoUrl && sub.photoVerified && (
                      <Image
                        source={{ uri: sub.photoUrl }}
                        style={styles.signaturePhoto}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.signatureInfo}>
                      <Text style={styles.signatureTitle} numberOfLines={1}>
                        Recipe #{sub.recipeSnapshotId.slice(0, 8)}
                      </Text>
                      <Text style={styles.signatureScore}>
                        Score: {sub.voteScore.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          </View>
        )}

        {/* Cuisine breakdown */}
        {cuisineBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cuisine Breakdown</Text>
            <GlassCard level={2} style={styles.cuisineCard}>
              {cuisineBreakdown.slice(0, 6).map((item) => (
                <View key={item.cuisine} style={styles.cuisineRow}>
                  <Text style={styles.cuisineLabel} numberOfLines={1}>
                    {item.cuisine}
                  </Text>
                  <View style={styles.cuisineBarTrack}>
                    <View
                      style={[
                        styles.cuisineBarFill,
                        { width: `${(item.count / maxCuisineCount) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.cuisineCount}>{item.count}</Text>
                </View>
              ))}
            </GlassCard>
          </View>
        )}

        {/* All submissions grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Recipes</Text>
          {submissions.length === 0 ? (
            <GlassCard level={2} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No submissions yet</Text>
              <Text style={styles.emptyMessage}>
                This chef hasn't submitted any recipes
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.recipeGrid}>
              {submissions.map((sub) => (
                <GlassCard
                  key={sub.id}
                  level={3}
                  style={styles.gridCard}
                  onPress={() =>
                    router.push(`/(recipes)/dish/${sub.dishId}`)
                  }
                >
                  {sub.photoUrl && sub.photoVerified ? (
                    <Image
                      source={{ uri: sub.photoUrl }}
                      style={styles.gridPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
                      <Text style={styles.gridPhotoEmoji}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.gridOverlay}>
                    <Text style={styles.gridDishName} numberOfLines={1}>
                      #{sub.recipeSnapshotId.slice(0, 8)}
                    </Text>
                    <View style={styles.gridMeta}>
                      {sub.rank != null && (
                        <View style={styles.gridRankBadge}>
                          <Text style={styles.gridRankText}>#{sub.rank}</Text>
                        </View>
                      )}
                      <Text style={styles.gridScore}>
                        {sub.voteScore.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 24,
  },

  // Header
  headerCard: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  avatarInitial: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: RECIPES_ACCENT,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.text,
  },
  handle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  bio: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Follow button
  followButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_ACCENT,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: RECIPES_ACCENT,
  },
  followButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#0E0E13',
  },
  followButtonTextActive: {
    color: RECIPES_ACCENT,
  },

  // Stats
  statsCard: {
    paddingVertical: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(214, 195, 181, 0.5)',
    textTransform: 'uppercase',
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },

  // Badges
  badgeRow: {
    gap: 16,
    paddingVertical: 4,
  },
  badgeItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeGold: {
    borderColor: '#FFD700',
  },
  badgePlatinum: {
    borderColor: '#E5E4E2',
  },
  badgeIcon: {
    fontSize: 22,
  },
  badgeName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Signature dishes
  signatureList: {
    gap: 10,
  },
  signatureCard: {
    paddingVertical: 12,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signatureRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureRankText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: RECIPES_ACCENT,
  },
  signaturePhoto: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  signatureInfo: {
    flex: 1,
    gap: 2,
  },
  signatureTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
  },
  signatureScore: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: RECIPES_SECONDARY,
  },

  // Cuisine breakdown
  cuisineCard: {
    gap: 10,
  },
  cuisineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cuisineLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    width: 80,
  },
  cuisineBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: RECIPES_SURFACES.depth,
    overflow: 'hidden',
  },
  cuisineBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: RECIPES_ACCENT,
    opacity: 0.7,
  },
  cuisineCount: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: colors.text,
    width: 28,
    textAlign: 'right',
  },

  // Recipe grid
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '48%' as unknown as number,
    padding: 0,
    overflow: 'hidden',
  },
  gridPhoto: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  gridPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPhotoEmoji: {
    fontSize: 32,
  },
  gridOverlay: {
    padding: 10,
    gap: 4,
  },
  gridDishName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.text,
  },
  gridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridRankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  gridRankText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: RECIPES_ACCENT,
  },
  gridScore: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: RECIPES_SECONDARY,
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  emptyMessage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
