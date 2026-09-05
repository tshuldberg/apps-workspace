import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import {
  FR_ACCENT,
  FR_ACCENT_GLOW,
  FR_ACCENT_LIGHT,
  FR_GLASS,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_MUTED,
  FR_TEXT_SECONDARY,
  FR_TEXT_TERTIARY,
  FR_TYPOGRAPHY,
  GlassCard,
  HumanVerifiedBadge,
  MaterialSymbol,
  getActivityFeed,
  getCachedActivityById,
  markActivityRead,
  markAllActivityRead,
  subscribeToActivity,
  type DatabaseAdapter as ForumsDatabaseAdapter,
  type ForumActivity,
  type ForumActivityFeedPage,
  type ForumActivityFilter,
  type ForumActivityType,
  upsertCachedActivity,
} from '@mylife/forums';
import { useDatabase } from '../../components/DatabaseProvider';

const LOCAL_PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const CREATIVE_COMMUNITY_ID = '33333333-3333-4333-8333-333333333333';
const DEV_COMMUNITY_ID = '44444444-4444-4444-8444-444444444444';
const THREAD_ONE_ID = '66666666-6666-4666-8666-666666666661';
const THREAD_TWO_ID = '66666666-6666-4666-8666-666666666662';
const THREAD_FOUR_ID = '66666666-6666-4666-8666-666666666664';

const EMPTY_FEED: ForumActivityFeedPage = {
  items: [],
  groups: [],
  unreadCounts: {
    all: 0,
    mentions: 0,
    replies: 0,
    votes: 0,
    invites: 0,
    mod_actions: 0,
  },
  page: 0,
  total: 0,
  hasMore: false,
};

const FILTERS: Array<{
  key: ForumActivityFilter;
  label: string;
  icon: 'notifications' | 'chat_bubble' | 'arrow_upward' | 'groups' | 'gavel';
}> = [
  { key: 'all', label: 'All', icon: 'notifications' },
  { key: 'mentions', label: 'Mentions', icon: 'notifications' },
  { key: 'replies', label: 'Replies', icon: 'chat_bubble' },
  { key: 'votes', label: 'Votes', icon: 'arrow_upward' },
  { key: 'invites', label: 'Invites', icon: 'groups' },
  { key: 'mod_actions', label: 'Mod Actions', icon: 'gavel' },
];

function toForumsDb(db: DatabaseAdapter): ForumsDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

function makeRelativeIso(params: { minutesAgo?: number; hoursAgo?: number; daysAgo?: number }) {
  const now = Date.now();
  const diffMs = (params.minutesAgo ?? 0) * 60_000
    + (params.hoursAgo ?? 0) * 3_600_000
    + (params.daysAgo ?? 0) * 86_400_000;

  return new Date(now - diffMs).toISOString();
}

function buildSeedActivity(profileId: string): ForumActivity[] {
  return [
    {
      id: 'forums-activity-mention',
      profileId,
      actorProfileId: '77777777-7777-4777-8777-777777777771',
      actorName: 'Maya Chen',
      actorTrustTier: 'trusted',
      type: 'mention',
      verb: 'mentioned you in',
      context: 'What actually makes a community feed feel alive instead of noisy?',
      detail: 'Called out your note about visible norms keeping high-trust threads readable.',
      targetType: 'thread',
      targetId: THREAD_ONE_ID,
      communityId: CREATIVE_COMMUNITY_ID,
      threadId: THREAD_ONE_ID,
      conversationId: null,
      targetProfileId: null,
      createdAt: makeRelativeIso({ minutesAgo: 42 }),
      readAt: null,
    },
    {
      id: 'forums-activity-reply',
      profileId,
      actorProfileId: '77777777-7777-4777-8777-777777777772',
      actorName: 'Leo Park',
      actorTrustTier: 'highly_trusted',
      type: 'reply',
      verb: 'replied to',
      context: 'Offline caching pitfalls when messages and thread state both mutate locally',
      detail: 'Added a follow-up about reconciling local snapshots against the newest persisted reply index.',
      targetType: 'thread',
      targetId: THREAD_TWO_ID,
      communityId: DEV_COMMUNITY_ID,
      threadId: THREAD_TWO_ID,
      conversationId: null,
      targetProfileId: null,
      createdAt: makeRelativeIso({ hoursAgo: 3 }),
      readAt: null,
    },
    {
      id: 'forums-activity-vote',
      profileId,
      actorProfileId: '77777777-7777-4777-8777-777777777773',
      actorName: 'Nina Alvarez',
      actorTrustTier: 'mod',
      type: 'vote',
      verb: 'upvoted your',
      context: 'Moderator checklist for launching a humans-only niche forum',
      detail: 'That thread crossed another wave of saves and replies overnight.',
      targetType: 'thread',
      targetId: THREAD_FOUR_ID,
      communityId: CREATIVE_COMMUNITY_ID,
      threadId: THREAD_FOUR_ID,
      conversationId: null,
      targetProfileId: null,
      createdAt: makeRelativeIso({ hoursAgo: 21 }),
      readAt: null,
    },
    {
      id: 'forums-activity-invite',
      profileId,
      actorProfileId: '77777777-7777-4777-8777-777777777773',
      actorName: 'Nina Alvarez',
      actorTrustTier: 'mod',
      type: 'invite',
      verb: 'invited you to',
      context: 'Design Club moderation room',
      detail: 'Review community health signals and help triage the next report queue.',
      targetType: 'community',
      targetId: CREATIVE_COMMUNITY_ID,
      communityId: CREATIVE_COMMUNITY_ID,
      threadId: null,
      conversationId: null,
      targetProfileId: null,
      createdAt: makeRelativeIso({ daysAgo: 3 }),
      readAt: makeRelativeIso({ daysAgo: 2, hoursAgo: 20 }),
    },
    {
      id: 'forums-activity-mod-action',
      profileId,
      actorProfileId: '77777777-7777-4777-8777-777777777771',
      actorName: 'Maya Chen',
      actorTrustTier: 'trusted',
      type: 'mod_action',
      verb: 'logged a moderation note on',
      context: 'Design Club',
      detail: 'Pinned the weekly critique thread and cleared a low-context promo post.',
      targetType: 'community',
      targetId: CREATIVE_COMMUNITY_ID,
      communityId: CREATIVE_COMMUNITY_ID,
      threadId: null,
      conversationId: null,
      targetProfileId: null,
      createdAt: makeRelativeIso({ daysAgo: 10 }),
      readAt: makeRelativeIso({ daysAgo: 9 }),
    },
  ];
}

function buildIncomingActivity(profileId: string): ForumActivity {
  return {
    id: 'forums-activity-live',
    profileId,
    actorProfileId: '77777777-7777-4777-8777-777777777772',
    actorName: 'Leo Park',
    actorTrustTier: 'highly_trusted',
    type: 'mention',
    verb: 'mentioned you in',
    context: 'What actually makes a community feed feel alive instead of noisy?',
    detail: 'New activity just landed with a question about how you weigh curation against raw recency.',
    targetType: 'thread',
    targetId: THREAD_ONE_ID,
    communityId: CREATIVE_COMMUNITY_ID,
    threadId: THREAD_ONE_ID,
    conversationId: null,
    targetProfileId: null,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
}

function ensureSeedActivity(
  db: ForumsDatabaseAdapter,
  profileId: string,
) {
  for (const activity of buildSeedActivity(profileId)) {
    if (!getCachedActivityById(db, activity.id)) {
      upsertCachedActivity(db, activity);
    }
  }
}

function scheduleIncomingActivity(
  db: ForumsDatabaseAdapter,
  profileId: string,
) {
  if (getCachedActivityById(db, 'forums-activity-live')) {
    return;
  }

  upsertCachedActivity(db, buildIncomingActivity(profileId));
}

function getRouteForActivity(activity: ForumActivity) {
  if (activity.targetType === 'conversation' && activity.conversationId) {
    return `/(forums)/conversation?conversationId=${encodeURIComponent(activity.conversationId)}`;
  }

  if (activity.targetType === 'community' && activity.communityId) {
    return `/(forums)/community-detail?communityId=${encodeURIComponent(activity.communityId)}`;
  }

  if (activity.targetType === 'profile' && activity.targetProfileId) {
    return `/(forums)/user-profile?profileId=${encodeURIComponent(activity.targetProfileId)}`;
  }

  const threadId = activity.threadId ?? activity.targetId;
  if (threadId) {
    return `/(forums)/thread-detail?threadId=${encodeURIComponent(threadId)}`;
  }

  return '/(forums)/(tabs)/profile';
}

function getActivityIcon(type: ForumActivityType) {
  switch (type) {
    case 'reply':
      return 'chat_bubble' as const;
    case 'vote':
      return 'arrow_upward' as const;
    case 'invite':
      return 'groups' as const;
    case 'mod_action':
      return 'gavel' as const;
    case 'mention':
    default:
      return 'notifications' as const;
  }
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return `${Math.floor(days / 7)}w ago`;
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ForumsActivityFeedScreen() {
  const router = useRouter();
  const hubDb = useDatabase();
  const db = useMemo(() => toForumsDb(hubDb), [hubDb]);
  const [filter, setFilter] = useState<ForumActivityFilter>('all');
  const [feed, setFeed] = useState<ForumActivityFeedPage>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeUnreadCount = filter === 'all'
    ? feed.unreadCounts.all
    : feed.unreadCounts[filter];

  const loadFeed = useCallback(
    (nextFilter: ForumActivityFilter) => {
      const page = getActivityFeed(db, LOCAL_PROFILE_ID, nextFilter, 0, 32);
      startTransition(() => {
        setFeed(page);
        setLoading(false);
      });
    },
    [db],
  );

  useEffect(() => {
    try {
      ensureSeedActivity(db, LOCAL_PROFILE_ID);
      loadFeed(filter);
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Unable to load activity',
        error instanceof Error ? error.message : 'Something went wrong while loading notifications.',
      );
    }
  }, [db, filter, loadFeed]);

  useEffect(() => {
    const unsubscribe = subscribeToActivity({
      db,
      profileId: LOCAL_PROFILE_ID,
      filter,
      pageSize: 32,
      onChange: (page) => {
        startTransition(() => {
          setFeed(page);
          setLoading(false);
        });
      },
    });

    return unsubscribe;
  }, [db, filter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        scheduleIncomingActivity(db, LOCAL_PROFILE_ID);
      } catch {
        // Ignore demo-stream failures so the feed still renders from cache.
      }
    }, 4500);

    return () => clearTimeout(timeout);
  }, [db]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      ensureSeedActivity(db, LOCAL_PROFILE_ID);
      loadFeed(filter);
    } catch (error) {
      Alert.alert(
        'Refresh failed',
        error instanceof Error ? error.message : 'Unable to refresh activity right now.',
      );
    } finally {
      setRefreshing(false);
    }
  }, [db, filter, loadFeed]);

  const handleMarkAllRead = useCallback(() => {
    try {
      markAllActivityRead(db, LOCAL_PROFILE_ID, filter);
      loadFeed(filter);
    } catch (error) {
      Alert.alert(
        'Unable to mark activity as read',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, filter, loadFeed]);

  const handleOpenActivity = useCallback(
    (activity: ForumActivity) => {
      try {
        markActivityRead(db, activity.id);
        loadFeed(filter);
        router.push(getRouteForActivity(activity) as never);
      } catch (error) {
        Alert.alert(
          'Unable to open activity',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db, filter, loadFeed, router],
  );

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[`${FR_ACCENT_GLOW}33`, 'transparent', FR_SURFACES.lowest]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGlow}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={FR_ACCENT_LIGHT}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIcon}>
              <MaterialSymbol name="notifications" size={20} color={FR_ACCENT_LIGHT} filled />
            </View>
            <Text style={styles.headerTitle}>Activity</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={activeUnreadCount === 0}
            onPress={handleMarkAllRead}
            style={[
              styles.markAllButton,
              activeUnreadCount === 0 ? styles.markAllButtonDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.markAllLabel,
                activeUnreadCount === 0 ? styles.markAllLabelDisabled : null,
              ]}
            >
              Mark all read
            </Text>
          </Pressable>
        </View>

        <GlassCard padding={0} style={styles.heroCard} glow>
          <LinearGradient
            colors={['rgba(167, 139, 250, 0.20)', 'rgba(124, 77, 255, 0.08)', 'rgba(14, 14, 19, 0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Text style={styles.heroEyebrow}>Notifications</Text>
            <Text style={styles.heroTitle}>Activity</Text>
            <Text style={styles.heroSubtitle}>
              {feed.unreadCounts.all} new since last visit
            </Text>
          </LinearGradient>
        </GlassCard>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          {FILTERS.map((item) => {
            const count = item.key === 'all' ? feed.unreadCounts.all : feed.unreadCounts[item.key];
            const active = filter === item.key;

            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
              >
                <MaterialSymbol
                  name={item.icon}
                  size={16}
                  color={active ? FR_TEXT : FR_TEXT_SECONDARY}
                  filled={active}
                />
                <Text style={[styles.filterLabel, active ? styles.filterLabelActive : null]}>
                  {item.label}
                </Text>
                {count > 0 ? (
                  <View style={[styles.filterBadge, active ? styles.filterBadgeActive : null]}>
                    <Text style={[styles.filterBadgeLabel, active ? styles.filterBadgeLabelActive : null]}>
                      {count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.loadingLabel}>Loading activity…</Text>
          </GlassCard>
        ) : feed.groups.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialSymbol name="notifications" size={28} color={FR_ACCENT_LIGHT} />
            </View>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyDetail}>
              Engage with communities to see notifications here.
            </Text>
          </GlassCard>
        ) : (
          feed.groups.map((group) => (
            <View key={group.label} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <Text style={styles.groupCount}>{group.items.length}</Text>
              </View>

              {group.items.map((activity) => {
                const unread = activity.readAt == null;

                return (
                  <GlassCard
                    key={activity.id}
                    onPress={() => handleOpenActivity(activity)}
                    padding={0}
                    style={[
                      styles.activityCard,
                      unread ? styles.activityCardUnread : null,
                    ]}
                  >
                    <View style={styles.activityRow}>
                      <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarLabel}>{initials(activity.actorName)}</Text>
                        </View>
                        <View style={styles.activityTypeDot}>
                          <MaterialSymbol
                            name={getActivityIcon(activity.type)}
                            size={14}
                            color={FR_ACCENT_LIGHT}
                            filled
                          />
                        </View>
                      </View>

                      <View style={styles.activityCopy}>
                        <View style={styles.activityMetaRow}>
                          <Text style={styles.actorName}>{activity.actorName}</Text>
                          <HumanVerifiedBadge tier={activity.actorTrustTier} showLabel={false} />
                          <Text style={styles.timeLabel}>{formatRelativeTime(activity.createdAt)}</Text>
                        </View>

                        <Text style={styles.activityLine}>
                          <Text style={styles.activityVerb}>{activity.verb} </Text>
                          <Text style={styles.activityContext}>{activity.context}</Text>
                        </Text>

                        {activity.detail ? (
                          <Text style={styles.activityDetail}>{activity.detail}</Text>
                        ) : null}

                        <View style={styles.activityFooter}>
                          <Text style={styles.openLabel}>Tap to open</Text>
                          {unread ? <View style={styles.unreadDot} /> : null}
                        </View>
                      </View>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FR_SURFACES.lowest,
  },
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.18)',
  },
  headerTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  markAllButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 77, 255, 0.18)',
  },
  markAllButtonDisabled: {
    backgroundColor: FR_GLASS.backgroundColor,
  },
  markAllLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  markAllLabelDisabled: {
    color: FR_TEXT_MUTED,
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 6,
  },
  heroEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: FR_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 42,
    letterSpacing: -1.1,
    lineHeight: 44,
    color: FR_TEXT,
  },
  heroSubtitle: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  filterRail: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterChipActive: {
    backgroundColor: FR_ACCENT,
    shadowColor: FR_ACCENT,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  filterLabel: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT_SECONDARY,
  },
  filterLabelActive: {
    color: FR_TEXT,
  },
  filterBadge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(14, 14, 19, 0.22)',
  },
  filterBadgeLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_ACCENT_LIGHT,
  },
  filterBadgeLabelActive: {
    color: FR_TEXT,
  },
  groupSection: {
    gap: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 2,
  },
  groupLabel: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  groupCount: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_TERTIARY,
  },
  activityCard: {
    backgroundColor: FR_GLASS.backgroundColor,
  },
  activityCardUnread: {
    shadowColor: FR_ACCENT,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatarWrap: {
    width: 54,
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FR_SURFACES.high,
  },
  avatarLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  activityTypeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: -10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FR_SURFACES.base,
  },
  activityCopy: {
    flex: 1,
    gap: 8,
  },
  activityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actorName: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  timeLabel: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
    marginLeft: 'auto',
  },
  activityLine: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  activityVerb: {
    color: FR_TEXT_SECONDARY,
  },
  activityContext: {
    color: FR_TEXT,
    fontFamily: FR_TYPOGRAPHY.titleMd.fontFamily,
  },
  activityDetail: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  activityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  openLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: FR_ACCENT_LIGHT,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.16)',
  },
  emptyTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  emptyDetail: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  loadingLabel: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
});
