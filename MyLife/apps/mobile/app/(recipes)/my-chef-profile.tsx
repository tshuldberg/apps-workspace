import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  type BadgeDefinition,
  type BestChefResult,
  type ChefBadge,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';
import {
  useMyProfile,
  useFollowers,
  getSocialClient,
} from '@mylife/social';

// ── Types ────────────────────────────────────────────────────────────

interface MyChefStats {
  submissionCount: number;
  totalVotesReceived: number;
  dishesWon: number;
}

// ── Stubs (cloud functions not yet implemented) ──────────────────────

async function getChefStats(
  _profileId: string,
): Promise<BestChefResult<MyChefStats>> {
  return {
    ok: true,
    data: { submissionCount: 0, totalVotesReceived: 0, dishesWon: 0 },
  };
}

async function getChefBadges(
  _profileId: string,
): Promise<BestChefResult<ChefBadge[]>> {
  return { ok: true, data: [] };
}

async function getBadgeDefinitions(): Promise<BestChefResult<BadgeDefinition[]>> {
  return { ok: true, data: [] };
}

async function updateChefBio(
  _profileId: string,
  _bio: string,
): Promise<BestChefResult<void>> {
  return { ok: true, data: undefined };
}

// ── Screen ───────────────────────────────────────────────────────────

export default function MyChefProfileScreen() {
  const { data: myProfile, isLoading: profileLoading } = useMyProfile();

  const profileId = myProfile?.id ?? '';
  const { data: followers } = useFollowers(profileId);

  const [stats, setStats] = useState<MyChefStats | null>(null);
  const [badges, setBadges] = useState<ChefBadge[]>([]);
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([]);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [chefOrigin, setChefOrigin] = useState('');
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsResult, badgesResult, defsResult] = await Promise.all([
        getChefStats(profileId),
        getChefBadges(profileId),
        getBadgeDefinitions(),
      ]);

      if (statsResult.ok) setStats(statsResult.data);
      if (badgesResult.ok) setBadges(badgesResult.data);
      if (defsResult.ok) setBadgeDefs(defsResult.data);

      if (myProfile?.bio) setBioText(myProfile.bio);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load profile data',
      );
    } finally {
      setLoading(false);
    }
  }, [profileId, myProfile?.bio]);

  useEffect(() => {
    if (profileId) void load();
  }, [load, profileId]);

  const handleSaveBio = async () => {
    if (!profileId) return;
    try {
      await updateChefBio(profileId, bioText);
      // Also update via social client
      const client = getSocialClient();
      if (client) {
        await client.updateProfile({ bio: bioText });
      }
    } catch {
      // Silent fail
    }
    setEditingBio(false);
  };

  const earnedIds = new Set(badges.map((b) => b.badgeId));

  if (profileLoading || (profileId && loading)) {
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

  if (!myProfile) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="person"
          title="No chef profile"
          message="Create a social profile first to start your chef journey"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <GlassCard level={2} style={styles.headerCard}>
          <View style={styles.headerRow}>
            {myProfile.avatarUrl ? (
              <Image
                source={{ uri: myProfile.avatarUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {myProfile.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.displayName}>
                {myProfile.displayName}
              </Text>
              <Text style={styles.handle}>@{myProfile.handle}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Stats bar */}
        <GlassCard level={3} style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats?.submissionCount ?? 0}
              </Text>
              <Text style={styles.statLabel}>Submissions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats?.totalVotesReceived ?? 0}
              </Text>
              <Text style={styles.statLabel}>Votes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats?.dishesWon ?? 0}
              </Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {followers?.length ?? myProfile.followerCount}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        </GlassCard>

        {/* Bio editor */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <Pressable onPress={() => {
              if (editingBio) {
                void handleSaveBio();
              } else {
                setEditingBio(true);
              }
            }}>
              <Text style={styles.editButton}>
                {editingBio ? 'Save' : 'Edit'}
              </Text>
            </Pressable>
          </View>
          {editingBio ? (
            <GlassCard level={2}>
              <TextInput
                style={styles.bioInput}
                value={bioText}
                onChangeText={setBioText}
                placeholder="Tell people about your cooking style..."
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={280}
                autoFocus
              />
              <Text style={styles.charCount}>{bioText.length}/280</Text>
            </GlassCard>
          ) : (
            <GlassCard level={2}>
              <Text style={styles.bioText}>
                {myProfile.bio || 'No bio set. Tap Edit to add one.'}
              </Text>
            </GlassCard>
          )}
        </View>

        {/* Chef location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Default Location</Text>
            <Pressable onPress={() => setEditingLocation(!editingLocation)}>
              <Text style={styles.editButton}>
                {editingLocation ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>
          <GlassCard level={2}>
            {editingLocation ? (
              <TextInput
                style={styles.fieldInput}
                value={defaultLocation}
                onChangeText={setDefaultLocation}
                placeholder="e.g. Los Angeles, CA"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text style={styles.fieldValue}>
                {defaultLocation || 'Not set'}
              </Text>
            )}
          </GlassCard>
        </View>

        {/* Chef origin */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Chef Origin</Text>
            <Pressable onPress={() => setEditingOrigin(!editingOrigin)}>
              <Text style={styles.editButton}>
                {editingOrigin ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>
          <GlassCard level={2}>
            {editingOrigin ? (
              <TextInput
                style={styles.fieldInput}
                value={chefOrigin}
                onChangeText={setChefOrigin}
                placeholder="e.g. Italian-American, Oaxacan"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text style={styles.fieldValue}>
                {chefOrigin || 'Not set'}
              </Text>
            )}
          </GlassCard>
        </View>

        {/* Badge collection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badge Collection</Text>
          {badgeDefs.length === 0 && badges.length === 0 ? (
            <GlassCard level={2} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No badges available</Text>
              <Text style={styles.emptyMessage}>
                Badges will appear here as they become available
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.badgeGrid}>
              {badgeDefs.map((def) => {
                const earned = earnedIds.has(def.id);
                return (
                  <GlassCard
                    key={def.id}
                    level={earned ? 3 : 1}
                    style={styles.badgeCard}
                  >
                    <View
                      style={[
                        styles.badgeCircle,
                        !earned && styles.badgeLocked,
                        def.tier === 'gold' && earned && styles.badgeGold,
                        def.tier === 'platinum' && earned && styles.badgePlatinum,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeIcon,
                          !earned && styles.badgeIconLocked,
                        ]}
                      >
                        {def.icon}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.badgeName,
                        !earned && styles.badgeNameLocked,
                      ]}
                      numberOfLines={2}
                    >
                      {def.name}
                    </Text>
                    <Text
                      style={styles.badgeDescription}
                      numberOfLines={2}
                    >
                      {def.description}
                    </Text>
                    {earned && (
                      <View style={styles.earnedTag}>
                        <Text style={styles.earnedTagText}>Earned</Text>
                      </View>
                    )}
                  </GlassCard>
                );
              })}
            </View>
          )}
        </View>

        {/* Creator program link */}
        <GlassCard level={2} style={styles.creatorCard}>
          <Text style={styles.creatorTitle}>Creator Program</Text>
          <Text style={styles.creatorDescription}>
            Apply to become a verified creator. Share recipes, build your
            profile, and access free creator tools.
          </Text>
          <Pressable style={styles.creatorButton} disabled>
            <Text style={styles.creatorButtonText}>
              Applications Coming Soon
            </Text>
          </Pressable>
        </GlassCard>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  editButton: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: RECIPES_ACCENT,
  },

  // Bio
  bioInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    padding: 0,
  },
  bioText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  charCount: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.4)',
    textAlign: 'right',
    marginTop: 8,
  },

  // Fields
  fieldInput: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  fieldValue: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%' as unknown as number,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeLocked: {
    opacity: 0.35,
  },
  badgeGold: {
    borderColor: '#FFD700',
  },
  badgePlatinum: {
    borderColor: '#E5E4E2',
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeIconLocked: {
    opacity: 0.5,
  },
  badgeName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textSecondary,
  },
  badgeDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(214, 195, 181, 0.5)',
    textAlign: 'center',
  },
  earnedTag: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  earnedTagText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: RECIPES_ACCENT,
    textTransform: 'uppercase',
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

  // Creator program
  creatorCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  creatorTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  creatorDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  creatorButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
    opacity: 0.6,
  },
  creatorButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
