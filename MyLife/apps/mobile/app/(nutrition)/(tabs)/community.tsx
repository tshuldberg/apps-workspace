import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  acceptConnection,
  AVATAR_EMOJIS,
  cheerFeedItem,
  createProfile,
  declineConnection,
  getAcceptedConnections,
  getActiveChallenges,
  getChallengeLeaderboard,
  getChallengeMember,
  getFeed,
  getPendingRequests,
  getProfile,
  getStreakInfo,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_GLASS_NAV,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  SectionHeader,
  sendConnectionRequest,
  uncheerFeedItem,
  type CommunityChallenge,
  type CommunityProfile,
  type FeedItemWithProfile,
  type LeaderboardEntry,
} from '@mylife/nutrition';
import type { DatabaseAdapter } from '@mylife/db';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function NutritionCommunityScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const profile = useMemo(() => getProfile(db), [db, tick]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 120);
  }, []);

  if (!profile) {
    return <CommunitySetup db={db} onComplete={handleRefresh} refreshing={refreshing} />;
  }

  return (
    <CommunityHub
      db={db}
      profile={profile}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tick={tick}
    />
  );
}

function CommunitySetup({
  db,
  onComplete,
  refreshing,
}: {
  db: DatabaseAdapter;
  onComplete: () => void;
  refreshing: boolean;
}) {
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState<(typeof AVATAR_EMOJIS)[number]>(
    AVATAR_EMOJIS[0],
  );

  const handleCreate = useCallback(() => {
    if (!displayName.trim()) {
      Alert.alert('Display name required', 'Choose a name before joining the community.');
      return;
    }

    try {
      createProfile(db, {
        displayName: displayName.trim(),
        avatarEmoji,
      });
      onComplete();
    } catch (error) {
      Alert.alert(
        'Unable to create profile',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [avatarEmoji, db, displayName, onComplete]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onComplete} tintColor={NU_ACCENT} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Community</Text>
        <Text style={styles.heroTitle}>Together</Text>
        <Text style={styles.heroBody}>
          Privacy-first accountability with friends, shared streaks, and challenge progress.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.setupTitle}>Create your profile</Text>
        <Text style={styles.setupBody}>
          Share only what you choose. Nothing leaves the device until you explicitly connect.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.avatarRow}>
            {AVATAR_EMOJIS.map((emoji) => {
              const active = emoji === avatarEmoji;
              return (
                <Pressable
                  key={emoji}
                  style={[styles.avatarChoice, active ? styles.avatarChoiceActive : null]}
                  onPress={() => setAvatarEmoji(emoji)}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={NU_TEXT_TERTIARY}
          style={styles.input}
          maxLength={30}
        />

        <Pressable style={styles.primaryButton} onPress={handleCreate}>
          <Text style={styles.primaryButtonText}>Join community</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function CommunityHub({
  db,
  profile,
  refreshing,
  onRefresh,
  tick,
}: {
  db: DatabaseAdapter;
  profile: CommunityProfile;
  refreshing: boolean;
  onRefresh: () => void;
  tick: number;
}) {
  const [friendCode, setFriendCode] = useState('');
  const [feedLimit, setFeedLimit] = useState(20);
  const [selectedChallenge, setSelectedChallenge] = useState<CommunityChallenge | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<{ displayName: string; avatarEmoji: string; id: string } | null>(null);

  const state = useMemo(() => {
    try {
      const connections = getAcceptedConnections(db, profile.id, 50);
      const pending = getPendingRequests(db, profile.id, 20);
      const challenges = getActiveChallenges(db, profile.id, 12);
      const challengeCards = challenges.map((challenge) => {
        const leaderboard = getChallengeLeaderboard(db, challenge.id, 20);
        const me = getChallengeMember(db, challenge.id, profile.id);
        const daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(`${challenge.endDate}T00:00:00`).getTime() - Date.now()) / 86400000,
          ),
        );
        return {
          challenge,
          leaderboard,
          me,
          daysRemaining,
        };
      });
      const feed = getFeed(db, profile.id, feedLimit);
      const streak = getStreakInfo(db);
      const leaderboard = buildWeeklyLeaderboard(db, profile.id);

      return {
        error: null as string | null,
        connections,
        pending,
        challengeCards,
        feed,
        streak,
        leaderboard,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load community.',
        connections: [] as ReturnType<typeof getAcceptedConnections>,
        pending: [] as ReturnType<typeof getPendingRequests>,
        challengeCards: [] as Array<{
          challenge: CommunityChallenge;
          leaderboard: LeaderboardEntry[];
          me: ReturnType<typeof getChallengeMember>;
          daysRemaining: number;
        }>,
        feed: [] as FeedItemWithProfile[],
        streak: { currentStreak: 0, longestStreak: 0 },
        leaderboard: [] as Array<{ id: string; displayName: string; avatarEmoji: string; points: number }>,
      };
    }
  }, [db, feedLimit, profile.id, tick]);

  const handleSendRequest = useCallback(() => {
    const nextCode = friendCode.trim().toUpperCase();
    if (!nextCode) {
      Alert.alert('Share code required', 'Enter a friend share code first.');
      return;
    }

    try {
      sendConnectionRequest(db, profile.id, nextCode);
      setFriendCode('');
      onRefresh();
      Alert.alert('Request sent', `Connection request sent to ${nextCode}.`);
    } catch (error) {
      Alert.alert(
        'Unable to connect',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, friendCode, onRefresh, profile.id]);

  const handlePending = useCallback(
    (connectionId: string, decision: 'accept' | 'decline') => {
      try {
        if (decision === 'accept') {
          acceptConnection(db, connectionId);
        } else {
          declineConnection(db, connectionId);
        }
        onRefresh();
      } catch (error) {
        Alert.alert(
          'Unable to update request',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db, onRefresh],
  );

  const toggleCheer = useCallback(
    (item: FeedItemWithProfile) => {
      try {
        if (item.cheered) {
          uncheerFeedItem(db, item.id);
        } else {
          cheerFeedItem(db, item.id);
        }
        onRefresh();
      } catch (error) {
        Alert.alert(
          'Unable to react',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db, onRefresh],
  );

  if (state.error) {
    return (
      <View style={styles.errorWrap}>
        <ErrorState message={state.error} onRetry={onRefresh} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NU_ACCENT} />
        }
      >
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.moduleName}>MyNutrition</Text>
              <Text style={styles.headerMeta}>Community hub</Text>
            </View>
            <Pressable style={styles.headerAction}>
              <MaterialSymbol name="group_add" size={20} color={NU_ACCENT_LIGHT} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Community</Text>
          <Text style={styles.heroTitle}>Together</Text>
          <Text style={styles.heroBody}>Privacy-first sharing with friends, streaks, and challenge progress.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{profile.avatarEmoji}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{profile.displayName}</Text>
              <Text style={styles.profileTagline}>
                {profile.bio ?? 'Curating sustainable progress, one meal at a time.'}
              </Text>
            </View>
          </View>

          <View style={styles.profileStats}>
            <ProfileStat label="Streak" value={state.streak.currentStreak} />
            <ProfileStat label="Challenges" value={state.challengeCards.length} />
            <ProfileStat label="Friends" value={state.connections.length} />
          </View>

          <Text style={styles.shareCode}>Share code: {profile.id}</Text>
        </View>

        <View style={styles.connectCard}>
          <SectionHeader title="Add friend" />
          <View style={styles.connectRow}>
            <TextInput
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="NUTR-ABCD"
              placeholderTextColor={NU_TEXT_TERTIARY}
              style={[styles.input, styles.connectInput]}
              autoCapitalize="characters"
            />
            <Pressable style={styles.primaryButton} onPress={handleSendRequest}>
              <Text style={styles.primaryButtonText}>Connect</Text>
            </Pressable>
          </View>

          {state.pending.length > 0 ? (
            <View style={styles.pendingStack}>
              {state.pending.map((item) => (
                <View key={item.id} style={styles.pendingRow}>
                  <Text style={styles.pendingEmoji}>{item.profile.avatarEmoji}</Text>
                  <View style={styles.pendingCopy}>
                    <Text style={styles.pendingName}>{item.profile.displayName}</Text>
                    <Text style={styles.pendingMeta}>wants to connect</Text>
                  </View>
                  <Pressable style={styles.pendingSecondary} onPress={() => handlePending(item.id, 'decline')}>
                    <Text style={styles.pendingSecondaryText}>Decline</Text>
                  </Pressable>
                  <Pressable style={styles.pendingPrimary} onPress={() => handlePending(item.id, 'accept')}>
                    <Text style={styles.pendingPrimaryText}>Accept</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Active challenges" action={<Text style={styles.linkText}>View all</Text>} />
          {state.challengeCards.length === 0 ? (
            <Text style={styles.emptyText}>Join a challenge to see collective progress and leaderboard movement.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.challengeRail}>
                {state.challengeCards.map(({ challenge, leaderboard, me, daysRemaining }) => {
                  const goal = challenge.targetValue ?? 1;
                  const progress = me ? Math.min((me.currentValue / goal) * 100, 100) : 0;
                  return (
                    <Pressable
                      key={challenge.id}
                      style={styles.challengeCard}
                      onPress={() => setSelectedChallenge(challenge)}
                    >
                      <View style={styles.challengeCover}>
                        <MaterialSymbol name="emoji_events" size={22} color={NU_ACCENT_LIGHT} />
                      </View>
                      <Text style={styles.challengeTitle}>{challenge.title}</Text>
                      <Text style={styles.challengeMeta}>
                        {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left • {leaderboard.length} members
                      </Text>
                      <View style={styles.challengeProgressTrack}>
                        <View style={[styles.challengeProgressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.challengeProgressText}>
                        {Math.round(progress)}% of your target
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Friends" />
          {state.connections.length === 0 ? (
            <Text style={styles.emptyText}>Add a friend to unlock the private social rail.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.friendRail}>
                {state.connections.map((connection) => (
                  <Pressable
                    key={connection.id}
                    style={styles.friendCard}
                    onPress={() => setSelectedConnection(connection.profile)}
                  >
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendEmoji}>{connection.profile.avatarEmoji}</Text>
                    </View>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {connection.profile.displayName}
                    </Text>
                  </Pressable>
                ))}
                <Pressable style={styles.friendAddTile}>
                  <MaterialSymbol name="group_add" size={20} color={NU_ACCENT_LIGHT} />
                  <Text style={styles.friendAddText}>Add friend</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.panel}>
          <SectionHeader title="This week" />
          <Text style={styles.privacyNote}>Shows shared goal-hit activity, not raw calorie totals.</Text>
          {state.leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>Leaderboard scores appear once friends start sharing goal-hit moments.</Text>
          ) : (
            <View style={styles.leaderboardStack}>
              {state.leaderboard.map((entry, index) => (
                <View key={entry.id} style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>#{index + 1}</Text>
                  <Text style={styles.leaderboardEmoji}>{entry.avatarEmoji}</Text>
                  <Text style={styles.leaderboardName}>{entry.displayName}</Text>
                  <Text style={styles.leaderboardScore}>{entry.points} hits</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Activity" />
          {state.feed.length === 0 ? (
            <Text style={styles.emptyText}>Connect with friends to populate the shared feed.</Text>
          ) : (
            <View style={styles.feedStack}>
              {state.feed.map((item) => (
                <View key={item.id} style={styles.feedCard}>
                  <View style={styles.feedHeader}>
                    <View style={styles.feedIdentity}>
                      <Text style={styles.feedEmoji}>{item.avatarEmoji}</Text>
                      <View style={styles.feedIdentityCopy}>
                        <Text style={styles.feedName}>{item.displayName}</Text>
                        <Text style={styles.feedMeta}>{relativeTime(item.createdAt)}</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => toggleCheer(item)} style={styles.cheerButton}>
                      <MaterialSymbol
                        name="local_fire_department"
                        size={18}
                        color={item.cheered ? NU_ACCENT_LIGHT : NU_TEXT_TERTIARY}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.feedTitle}>{item.title}</Text>
                  {item.body ? <Text style={styles.feedBody}>{item.body}</Text> : null}
                </View>
              ))}
              {state.feed.length >= feedLimit ? (
                <Pressable style={styles.loadMoreButton} onPress={() => setFeedLimit((value) => value + 20)}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedChallenge)} transparent animationType="fade" onRequestClose={() => setSelectedChallenge(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedChallenge?.title}</Text>
            <Text style={styles.modalBody}>{selectedChallenge?.description ?? 'Challenge detail routes land in the next iteration. This summary keeps the Phase 1 hub navigable today.'}</Text>
            <Pressable style={styles.primaryButton} onPress={() => setSelectedChallenge(null)}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedConnection)} transparent animationType="fade" onRequestClose={() => setSelectedConnection(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedConnection?.displayName}</Text>
            <Text style={styles.modalBody}>
              {selectedConnection?.avatarEmoji} • Private community profile detail routes are not wired yet, so this preview keeps friend taps functional without dead links.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => setSelectedConnection(null)}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

function buildWeeklyLeaderboard(db: DatabaseAdapter, profileId: string) {
  const connectedIds = getAcceptedConnections(db, profileId, 50).map((item) => item.profile.id);
  const ids = [profileId, ...connectedIds];
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = db.query<{
    id: string;
    display_name: string;
    avatar_emoji: string;
    points: number;
  }>(
    `SELECT
       p.id,
       p.display_name,
       p.avatar_emoji,
       COALESCE(SUM(CASE WHEN f.activity_type = 'goal_hit' THEN 1 ELSE 0 END), 0) as points
     FROM nu_community_profiles p
     LEFT JOIN nu_community_feed f
       ON f.profile_id = p.id
      AND f.created_at >= datetime('now', '-7 days')
     WHERE p.id IN (${placeholders})
     GROUP BY p.id
     ORDER BY points DESC, p.display_name ASC
     LIMIT 5`,
    ids,
  );

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    points: row.points,
  }));
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.base,
  },
  scroll: {
    flex: 1,
    backgroundColor: NU_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
  },
  headerShell: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    backgroundColor: NU_GLASS_NAV.backgroundColor,
  },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NU_GLASS_NAV.backgroundColor,
  },
  headerCopy: {
    gap: 2,
  },
  moduleName: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  headerMeta: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  heroTitle: {
    ...NU_TYPOGRAPHY.displayLg,
    color: NU_TEXT,
    fontSize: 44,
    lineHeight: 46,
  },
  heroBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  panel: {
    borderRadius: 28,
    padding: 20,
    gap: 14,
    backgroundColor: NU_SURFACES.low,
  },
  profileCard: {
    borderRadius: 28,
    padding: 20,
    gap: 18,
    backgroundColor: NU_SURFACES.low,
  },
  profileTop: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.14)',
  },
  profileAvatarText: {
    fontSize: 34,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  profileTagline: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  profileStats: {
    flexDirection: 'row',
    gap: 12,
  },
  profileStat: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
    backgroundColor: NU_SURFACES.mid,
  },
  profileStatValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_ACCENT_LIGHT,
  },
  profileStatLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  shareCode: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  connectCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    backgroundColor: NU_SURFACES.low,
  },
  connectRow: {
    flexDirection: 'row',
    gap: 12,
  },
  connectInput: {
    flex: 1,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: NU_SURFACES.mid,
    color: NU_TEXT,
    fontFamily: NU_TYPOGRAPHY.bodyMd.fontFamily,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_ACCENT,
  },
  primaryButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_DARK,
  },
  pendingStack: {
    gap: 12,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
  },
  pendingEmoji: {
    fontSize: 24,
  },
  pendingCopy: {
    flex: 1,
    gap: 2,
  },
  pendingName: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  pendingMeta: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  pendingSecondary: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: NU_SURFACES.high,
  },
  pendingSecondaryText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  pendingPrimary: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,184,119,0.16)',
  },
  pendingPrimaryText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
  },
  sectionBlock: {
    gap: 14,
  },
  linkText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
  },
  challengeRail: {
    flexDirection: 'row',
    gap: 12,
  },
  challengeCard: {
    width: 220,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: NU_SURFACES.low,
  },
  challengeCover: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.14)',
  },
  challengeTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  challengeMeta: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  challengeProgressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: NU_SURFACES.high,
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: NU_ACCENT,
  },
  challengeProgressText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  friendRail: {
    flexDirection: 'row',
    gap: 12,
  },
  friendCard: {
    width: 96,
    gap: 10,
    alignItems: 'center',
  },
  friendAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  friendEmoji: {
    fontSize: 28,
  },
  friendName: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT,
    textAlign: 'center',
  },
  friendAddTile: {
    width: 96,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    backgroundColor: NU_SURFACES.low,
  },
  friendAddText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
    textAlign: 'center',
  },
  privacyNote: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  leaderboardStack: {
    gap: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
  },
  leaderboardRank: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_LIGHT,
    width: 32,
  },
  leaderboardEmoji: {
    fontSize: 22,
  },
  leaderboardName: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
    flex: 1,
  },
  leaderboardScore: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  feedStack: {
    gap: 12,
  },
  feedCard: {
    borderRadius: 22,
    padding: 16,
    gap: 10,
    backgroundColor: NU_SURFACES.low,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  feedEmoji: {
    fontSize: 24,
  },
  feedIdentityCopy: {
    flex: 1,
    gap: 2,
  },
  feedName: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  feedMeta: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  cheerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.mid,
  },
  feedTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  feedBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  loadMoreButton: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  loadMoreText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_LIGHT,
  },
  setupTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  setupBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarChoice: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.mid,
  },
  avatarChoiceActive: {
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  emptyText: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_TERTIARY,
  },
  modalScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.56)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    backgroundColor: NU_SURFACES.low,
  },
  modalTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  modalBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: NU_SURFACES.base,
  },
});
