import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPreference,
  setPreference,
  type DatabaseAdapter as HubDatabaseAdapter,
} from '@mylife/db';
import {
  buildFeedChannel,
  deleteCachedBookmark,
  getCachedBookmarks,
  getCachedCommunities,
  getCachedCommunityById,
  getCachedCommunityMembers,
  getCachedProfileById,
  getCachedProfileByUserId,
  getCachedReplies,
  getCachedTags,
  getCachedThreadById,
  getCachedThreads,
  upsertCachedBookmark,
  upsertCachedCommunity,
  upsertCachedCommunityMember,
  upsertCachedConversation,
  upsertCachedMessage,
  upsertCachedProfile,
  upsertCachedReply,
  upsertCachedTag,
  upsertCachedThread,
  CommunityCard as ForumsCommunityCard,
  CommunityPill,
  GlassCard,
  HumanVerifiedBadge,
  MaterialSymbol,
  ProfileCard as ForumsProfileCard,
  ReplyBubble,
  SearchBar,
  SectionHeader,
  ThreadCard as ForumsThreadCard,
  FR_ACCENT,
  FR_ACCENT_LIGHT,
  FR_GLASS_NAV,
  FR_ON_ACCENT,
  FR_PURPLE_GLOW_STYLE,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_SECONDARY,
  FR_TEXT_TERTIARY,
  FR_TYPOGRAPHY,
  type Bookmark,
  type Community,
  type CommunityMember,
  type Conversation,
  type DatabaseAdapter as ForumsDatabaseAdapter,
  type DirectMessage,
  type Reply,
  type Thread,
  type UserProfile,
  type UserStats,
} from '@mylife/forums';
import { useDatabase } from '../../components/DatabaseProvider';

const LOCAL_USER_ID = '11111111-1111-4111-8111-111111111111';
const LOCAL_PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const CREATIVE_COMMUNITY_ID = '33333333-3333-4333-8333-333333333333';
const DEV_COMMUNITY_ID = '44444444-4444-4444-8444-444444444444';
const LOCAL_COMMUNITY_ID = '55555555-5555-4555-8555-555555555555';
const PRIVATE_COMMUNITY_ID = '55555555-5555-4555-8555-555555555556';
const FEDERATED_COMMUNITY_ID = '55555555-5555-4555-8555-555555555557';
const THREAD_ONE_ID = '66666666-6666-4666-8666-666666666661';
const THREAD_TWO_ID = '66666666-6666-4666-8666-666666666662';
const THREAD_THREE_ID = '66666666-6666-4666-8666-666666666663';
const THREAD_FOUR_ID = '66666666-6666-4666-8666-666666666664';
const THREAD_FIVE_ID = '66666666-6666-4666-8666-666666666665';
const THREAD_SIX_ID = '66666666-6666-4666-8666-666666666666';
const REALTIME_THREAD_ID = '66666666-6666-4666-8666-666666666667';
const MAYA_PROFILE_ID = '77777777-7777-4777-8777-777777777771';
const LEO_PROFILE_ID = '77777777-7777-4777-8777-777777777772';
const NINA_PROFILE_ID = '77777777-7777-4777-8777-777777777773';

const PREF_HUMANS_ONLY = 'forums.phase1.humans_only';
const PREF_RECENT_SEARCHES = 'forums.phase1.recent_searches';
const PREF_SAVED_REPLY_IDS = 'forums.phase1.saved_reply_ids';
const PREF_SAVED_COMMUNITY_IDS = 'forums.phase1.saved_community_ids';
const PREF_FOLLOWING_PROFILE_IDS = 'forums.phase1.following_profile_ids';

type FeedSort = 'hot' | 'new' | 'top' | 'following';
type TopRange = 'today' | 'week' | 'month' | 'all';
type CommunityFilter = 'all' | 'humans' | 'public' | 'private' | 'federated';
type SearchScope = 'threads' | 'replies' | 'communities' | 'users';
type SavedFilter = 'all' | 'threads' | 'replies' | 'communities';
type SavedGroupMode = 'community' | 'date' | 'type';
type ProfileTabKey = 'posts' | 'replies' | 'communities' | 'about';
type PostFilter = 'all' | 'pinned' | 'popular';
type ForumsVoteState = 'up' | 'down' | null;
type TrustTier = 'unverified' | 'new' | 'trusted' | 'highly_trusted' | 'mod';

type SavedThreadItem = {
  id: string;
  type: 'thread';
  savedAt: string;
  thread: Thread;
  community: Community;
  author: UserProfile;
};

type SavedReplyItem = {
  id: string;
  type: 'reply';
  savedAt: string;
  reply: Reply;
  thread: Thread;
  community: Community;
  author: UserProfile;
};

type SavedCommunityItem = {
  id: string;
  type: 'community';
  savedAt: string;
  community: Community;
};

type SavedItem = SavedThreadItem | SavedReplyItem | SavedCommunityItem;

const SAMPLE_COMMUNITIES: Community[] = [
  {
    id: CREATIVE_COMMUNITY_ID,
    creatorId: LOCAL_USER_ID,
    name: 'design-club',
    displayName: 'Design Club',
    description:
      'Critiques, inspiration drops, and practical UI teardown threads.',
    iconUrl: null,
    bannerUrl: null,
    communityType: 'public',
    humansOnly: true,
    linkedModuleId: null,
    memberCount: 1840,
    threadCount: 312,
    createdAt: '2026-03-12T08:00:00.000Z',
    updatedAt: '2026-04-04T07:00:00.000Z',
  },
  {
    id: DEV_COMMUNITY_ID,
    creatorId: LOCAL_USER_ID,
    name: 'shipping-notes',
    displayName: 'Shipping Notes',
    description:
      'Build logs, release notes, and honest postmortems from product teams.',
    iconUrl: null,
    bannerUrl: null,
    communityType: 'public',
    humansOnly: true,
    linkedModuleId: 'federation://notes.exchange',
    memberCount: 920,
    threadCount: 147,
    createdAt: '2026-03-18T08:00:00.000Z',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    id: LOCAL_COMMUNITY_ID,
    creatorId: LOCAL_USER_ID,
    name: 'local-loop',
    displayName: 'Local Loop',
    description:
      'Neighborhood recommendations, quick asks, and meetup threads.',
    iconUrl: null,
    bannerUrl: null,
    communityType: 'public',
    humansOnly: false,
    linkedModuleId: null,
    memberCount: 241,
    threadCount: 84,
    createdAt: '2026-03-24T08:00:00.000Z',
    updatedAt: '2026-04-04T10:00:00.000Z',
  },
  {
    id: PRIVATE_COMMUNITY_ID,
    creatorId: LOCAL_USER_ID,
    name: 'ops-cabinet',
    displayName: 'Ops Cabinet',
    description: 'Private moderation and launch planning for trusted members.',
    iconUrl: null,
    bannerUrl: null,
    communityType: 'private',
    humansOnly: true,
    linkedModuleId: null,
    memberCount: 24,
    threadCount: 19,
    createdAt: '2026-02-28T08:00:00.000Z',
    updatedAt: '2026-04-04T11:00:00.000Z',
  },
  {
    id: FEDERATED_COMMUNITY_ID,
    creatorId: LOCAL_USER_ID,
    name: 'indie-gardeners',
    displayName: 'Indie Gardeners',
    description:
      'Cross-instance product conversations sourced from a trusted federation ring.',
    iconUrl: null,
    bannerUrl: null,
    communityType: 'public',
    humansOnly: false,
    linkedModuleId: 'federation://garden.club',
    memberCount: 612,
    threadCount: 94,
    createdAt: '2026-03-20T08:00:00.000Z',
    updatedAt: '2026-04-04T12:00:00.000Z',
  },
];

const SAMPLE_PROFILES: UserProfile[] = [
  {
    id: LOCAL_PROFILE_ID,
    userId: LOCAL_USER_ID,
    displayName: 'Trey Stone',
    username: 'treystone',
    bio:
      'Designing product systems, documenting edge cases, and keeping community spaces usable.',
    avatarUrl: null,
    bannerUrl: null,
    statusText: 'Shipping redesign work',
    statusEmoji: '🛠️',
    location: 'Los Angeles',
    websiteUrl: 'https://mylife.app',
    karma: 1280,
    threadCount: 28,
    replyCount: 114,
    communitiesJoined: 12,
    isVerified: true,
    createdAt: '2026-01-08T08:00:00.000Z',
    updatedAt: '2026-04-04T10:00:00.000Z',
  },
  {
    id: MAYA_PROFILE_ID,
    userId: '88888888-8888-4888-8888-888888888881',
    displayName: 'Maya Chen',
    username: 'maya-chen',
    bio:
      'Product designer collecting community rituals and interface patterns.',
    avatarUrl: null,
    bannerUrl: null,
    statusText: 'Reviewing thread drafts',
    statusEmoji: '✨',
    location: 'San Francisco',
    websiteUrl: null,
    karma: 942,
    threadCount: 18,
    replyCount: 76,
    communitiesJoined: 7,
    isVerified: true,
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-04-04T08:00:00.000Z',
  },
  {
    id: LEO_PROFILE_ID,
    userId: '88888888-8888-4888-8888-888888888882',
    displayName: 'Leo Park',
    username: 'leo-park',
    bio: 'Frontend lead focused on resilient offline-first flows.',
    avatarUrl: null,
    bannerUrl: null,
    statusText: 'Coffee and code review',
    statusEmoji: '☕',
    location: 'Seattle',
    websiteUrl: null,
    karma: 611,
    threadCount: 12,
    replyCount: 42,
    communitiesJoined: 5,
    isVerified: true,
    createdAt: '2026-02-14T08:00:00.000Z',
    updatedAt: '2026-04-04T06:00:00.000Z',
  },
  {
    id: NINA_PROFILE_ID,
    userId: '88888888-8888-4888-8888-888888888883',
    displayName: 'Nina Alvarez',
    username: 'nina-alvarez',
    bio: 'Community builder, moderator, and trust-systems nerd.',
    avatarUrl: null,
    bannerUrl: null,
    statusText: 'Cleaning up tag taxonomy',
    statusEmoji: '🧹',
    location: 'Remote',
    websiteUrl: null,
    karma: 1504,
    threadCount: 36,
    replyCount: 182,
    communitiesJoined: 16,
    isVerified: true,
    createdAt: '2026-01-18T08:00:00.000Z',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
];

const SAMPLE_THREADS: Thread[] = [
  {
    id: THREAD_ONE_ID,
    communityId: CREATIVE_COMMUNITY_ID,
    authorId: MAYA_PROFILE_ID,
    title: 'What actually makes a community feed feel alive instead of noisy?',
    body:
      'I have been comparing high-trust forums lately. The strongest ones reward context, not just recency. Curious what patterns other people use when they want a feed to feel active without becoming chaos.',
    status: 'open',
    isPinned: true,
    voteScore: 126,
    replyCount: 18,
    viewCount: 504,
    createdAt: '2026-04-04T09:00:00.000Z',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    id: THREAD_TWO_ID,
    communityId: DEV_COMMUNITY_ID,
    authorId: LEO_PROFILE_ID,
    title:
      'Offline caching pitfalls when messages and thread state both mutate locally',
    body:
      'We solved our stale thread counts, but direct messages still race when the same conversation is opened on two devices. Posting the flow we used to reconcile local snapshots with cloud timestamps.',
    status: 'open',
    isPinned: false,
    voteScore: 94,
    replyCount: 11,
    viewCount: 302,
    createdAt: '2026-04-04T07:10:00.000Z',
    updatedAt: '2026-04-04T07:10:00.000Z',
  },
  {
    id: THREAD_THREE_ID,
    communityId: LOCAL_COMMUNITY_ID,
    authorId: LOCAL_PROFILE_ID,
    title:
      'Best low-key Saturday coffee spots with room to work for two hours',
    body:
      'Looking for places with stable Wi-Fi, decent light, and enough space to sit without feeling like I am camping a table. Bonus points if they stay calm after 10am.',
    status: 'open',
    isPinned: false,
    voteScore: 43,
    replyCount: 9,
    viewCount: 188,
    createdAt: '2026-04-03T18:30:00.000Z',
    updatedAt: '2026-04-03T18:30:00.000Z',
  },
  {
    id: THREAD_FOUR_ID,
    communityId: CREATIVE_COMMUNITY_ID,
    authorId: NINA_PROFILE_ID,
    title: 'Moderator checklist for launching a humans-only niche forum',
    body:
      'I drafted a starter checklist covering verification prompts, welcome posts, moderation expectations, and transparent public logs. Sharing for feedback before I turn it into a reusable template.',
    status: 'open',
    isPinned: false,
    voteScore: 71,
    replyCount: 7,
    viewCount: 260,
    createdAt: '2026-04-03T16:20:00.000Z',
    updatedAt: '2026-04-03T16:20:00.000Z',
  },
  {
    id: THREAD_FIVE_ID,
    communityId: PRIVATE_COMMUNITY_ID,
    authorId: NINA_PROFILE_ID,
    title: 'Launch-day moderation staffing grid for small teams',
    body:
      'Sharing the staffing matrix we use when a new community goes public. It balances fast response windows with explicit escalation rules so nobody is guessing during launch hour.',
    status: 'open',
    isPinned: true,
    voteScore: 58,
    replyCount: 5,
    viewCount: 112,
    createdAt: '2026-04-02T21:15:00.000Z',
    updatedAt: '2026-04-02T21:15:00.000Z',
  },
  {
    id: THREAD_SIX_ID,
    communityId: FEDERATED_COMMUNITY_ID,
    authorId: MAYA_PROFILE_ID,
    title: 'How do you surface federation context without making threads feel alien?',
    body:
      'We have early cross-instance posting working, but the UI still feels too technical. Looking for patterns that explain source, trust, and provenance without overwhelming people.',
    status: 'open',
    isPinned: false,
    voteScore: 66,
    replyCount: 13,
    viewCount: 209,
    createdAt: '2026-04-02T14:05:00.000Z',
    updatedAt: '2026-04-02T14:05:00.000Z',
  },
];

const REALTIME_THREAD: Thread = {
  id: REALTIME_THREAD_ID,
  communityId: DEV_COMMUNITY_ID,
  authorId: NINA_PROFILE_ID,
  title: 'Realtime update: a clean way to badge new feed items without jumping the scroll position',
  body:
    'I finally landed a pattern that queues new threads above the fold, announces the count, and lets users opt into the update when they are ready. Posting the implementation notes here.',
  status: 'open',
  isPinned: false,
  voteScore: 17,
  replyCount: 2,
  viewCount: 18,
  createdAt: '2026-04-04T10:26:00.000Z',
  updatedAt: '2026-04-04T10:26:00.000Z',
};

const SAMPLE_REPLIES: Reply[] = [
  {
    id: '99999999-9999-4999-8999-999999999991',
    threadId: THREAD_ONE_ID,
    parentReplyId: null,
    authorId: LOCAL_PROFILE_ID,
    body:
      'Strong community feeds usually have visible norms. When users can tell what kind of reply belongs, the thread quality stays high.',
    voteScore: 28,
    depth: 0,
    status: 'open',
    createdAt: '2026-04-04T09:30:00.000Z',
    updatedAt: '2026-04-04T09:30:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999992',
    threadId: THREAD_ONE_ID,
    parentReplyId: '99999999-9999-4999-8999-999999999991',
    authorId: MAYA_PROFILE_ID,
    body:
      'Yes. The best threads read like people are collaborating, not competing for visibility.',
    voteScore: 14,
    depth: 1,
    status: 'open',
    createdAt: '2026-04-04T09:45:00.000Z',
    updatedAt: '2026-04-04T09:45:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999993',
    threadId: THREAD_TWO_ID,
    parentReplyId: null,
    authorId: NINA_PROFILE_ID,
    body:
      'We ended up treating optimistic counts as temporary UI state and reconciling them against the latest persisted reply index.',
    voteScore: 18,
    depth: 0,
    status: 'open',
    createdAt: '2026-04-04T07:40:00.000Z',
    updatedAt: '2026-04-04T07:40:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999994',
    threadId: THREAD_THREE_ID,
    parentReplyId: null,
    authorId: LEO_PROFILE_ID,
    body:
      'Found Coffee Project in Echo Park reliable on Saturdays. Back patio is quiet and they do not hover.',
    voteScore: 9,
    depth: 0,
    status: 'open',
    createdAt: '2026-04-03T19:10:00.000Z',
    updatedAt: '2026-04-03T19:10:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999995',
    threadId: THREAD_FOUR_ID,
    parentReplyId: null,
    authorId: LOCAL_PROFILE_ID,
    body:
      'Public moderation logs change the tone immediately. People stop guessing and start trusting the system.',
    voteScore: 23,
    depth: 0,
    status: 'open',
    createdAt: '2026-04-03T17:00:00.000Z',
    updatedAt: '2026-04-03T17:00:00.000Z',
  },
  {
    id: '99999999-9999-4999-8999-999999999996',
    threadId: THREAD_SIX_ID,
    parentReplyId: null,
    authorId: NINA_PROFILE_ID,
    body:
      'We show federation origin in the pill itself, then keep the deeper provenance tucked into metadata beneath the post.',
    voteScore: 16,
    depth: 0,
    status: 'open',
    createdAt: '2026-04-02T14:30:00.000Z',
    updatedAt: '2026-04-02T14:30:00.000Z',
  },
];

const SAMPLE_BOOKMARKS: Bookmark[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    profileId: LOCAL_PROFILE_ID,
    threadId: THREAD_ONE_ID,
    createdAt: '2026-04-04T09:50:00.000Z',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    profileId: LOCAL_PROFILE_ID,
    threadId: THREAD_FOUR_ID,
    createdAt: '2026-04-03T18:00:00.000Z',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    profileId: LOCAL_PROFILE_ID,
    threadId: THREAD_SIX_ID,
    createdAt: '2026-04-02T14:40:00.000Z',
  },
];

const SAMPLE_MEMBERS: CommunityMember[] = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    communityId: CREATIVE_COMMUNITY_ID,
    profileId: LOCAL_PROFILE_ID,
    role: 'member',
    status: 'active',
    joinedAt: '2026-03-13T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    communityId: CREATIVE_COMMUNITY_ID,
    profileId: MAYA_PROFILE_ID,
    role: 'moderator',
    status: 'active',
    joinedAt: '2026-03-12T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    communityId: DEV_COMMUNITY_ID,
    profileId: LOCAL_PROFILE_ID,
    role: 'member',
    status: 'active',
    joinedAt: '2026-03-21T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    communityId: DEV_COMMUNITY_ID,
    profileId: LEO_PROFILE_ID,
    role: 'moderator',
    status: 'active',
    joinedAt: '2026-03-18T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    communityId: LOCAL_COMMUNITY_ID,
    profileId: LOCAL_PROFILE_ID,
    role: 'member',
    status: 'active',
    joinedAt: '2026-03-24T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
    communityId: PRIVATE_COMMUNITY_ID,
    profileId: LOCAL_PROFILE_ID,
    role: 'admin',
    status: 'active',
    joinedAt: '2026-03-01T08:00:00.000Z',
  },
];

const SAMPLE_TAGS = [
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', communityId: CREATIVE_COMMUNITY_ID, name: 'ux', color: '#7C4DFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', communityId: CREATIVE_COMMUNITY_ID, name: 'critique', color: '#9F7CFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', communityId: DEV_COMMUNITY_ID, name: 'offline', color: '#7C4DFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', communityId: LOCAL_COMMUNITY_ID, name: 'recommendations', color: '#7C4DFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5', communityId: PRIVATE_COMMUNITY_ID, name: 'moderation', color: '#A78BFA' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc6', communityId: FEDERATED_COMMUNITY_ID, name: 'federation', color: '#8BCFF0' },
];

const BADGES_BY_PROFILE: Record<string, Array<{ id: string; icon: string; label: string }>> = {
  [LOCAL_PROFILE_ID]: [
    { id: 'badge-1', icon: '⚡', label: 'Fast Reply' },
    { id: 'badge-2', icon: '🧭', label: 'Guide' },
    { id: 'badge-3', icon: '🛡️', label: 'Verified' },
  ],
  [MAYA_PROFILE_ID]: [
    { id: 'badge-4', icon: '🎨', label: 'Critique Pro' },
    { id: 'badge-5', icon: '🌐', label: 'Federated' },
  ],
  [LEO_PROFILE_ID]: [
    { id: 'badge-6', icon: '🧠', label: 'Systems Thinker' },
    { id: 'badge-7', icon: '☁️', label: 'Cache Wrangler' },
  ],
  [NINA_PROFILE_ID]: [
    { id: 'badge-8', icon: '🌿', label: 'Community Gardener' },
    { id: 'badge-9', icon: '🛡️', label: 'Moderator' },
  ],
};

const DEFAULT_RECENT_SEARCHES = [
  'offline caching',
  'moderation templates',
  'coffee shops',
];

const DEFAULT_SAVED_REPLY_IDS = [
  '99999999-9999-4999-8999-999999999991',
  '99999999-9999-4999-8999-999999999996',
];

const DEFAULT_SAVED_COMMUNITY_IDS = [LOCAL_COMMUNITY_ID, FEDERATED_COMMUNITY_ID];
const DEFAULT_FOLLOWING_PROFILE_IDS = [MAYA_PROFILE_ID, NINA_PROFILE_ID];

function toForumsDb(db: HubDatabaseAdapter): ForumsDatabaseAdapter {
  return {
    run: (sql, params) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function getParamValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeRead<T>(fallback: T, read: () => T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function readJsonPreference<T>(
  db: HubDatabaseAdapter,
  key: string,
  fallback: T,
): T {
  const raw = getPreference(db, key);
  if (raw == null || raw.length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonPreference(
  db: HubDatabaseAdapter,
  key: string,
  value: unknown,
): void {
  setPreference(db, key, JSON.stringify(value));
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function initials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFederatedCommunity(community: Community): boolean {
  return community.linkedModuleId?.startsWith('federation://') ?? false;
}

function getTrustTier(profile: UserProfile): TrustTier {
  if (profile.id === NINA_PROFILE_ID) return 'mod';
  if (profile.isVerified && profile.karma >= 1000) return 'highly_trusted';
  if (profile.isVerified) return 'trusted';
  if (profile.karma > 0) return 'new';
  return 'unverified';
}

function buildUserStats(profile: UserProfile, communityCount: number): UserStats {
  return {
    profileId: profile.id,
    threadCount: profile.threadCount,
    replyCount: profile.replyCount,
    karma: profile.karma,
    communitiesJoined: communityCount,
  };
}

function sortThreads(threads: Thread[], sort: FeedSort, range: TopRange): Thread[] {
  const now = Date.now();
  const cutoff =
    range === 'today'
      ? now - 24 * 60 * 60 * 1000
      : range === 'week'
        ? now - 7 * 24 * 60 * 60 * 1000
        : range === 'month'
          ? now - 30 * 24 * 60 * 60 * 1000
          : null;

  const scoped =
    sort === 'top' && cutoff != null
      ? threads.filter((thread) => new Date(thread.createdAt).getTime() >= cutoff)
      : threads;

  return scoped.slice().sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    if (sort === 'top') {
      return right.voteScore - left.voteScore;
    }

    if (sort === 'hot') {
      const leftScore = left.voteScore * 3 + left.replyCount * 2;
      const rightScore = right.voteScore * 3 + right.replyCount * 2;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

function ensurePhaseOneCache(db: ForumsDatabaseAdapter): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS fr_votes_local (
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      PRIMARY KEY (target_type, target_id, profile_id)
    )`,
  );

  if (getCachedCommunities(db, { limit: 1 }).length === 0) {
    SAMPLE_COMMUNITIES.forEach((community) => upsertCachedCommunity(db, community));
  }

  if (!getCachedProfileById(db, LOCAL_PROFILE_ID)) {
    SAMPLE_PROFILES.forEach((profile) => upsertCachedProfile(db, profile));
  }

  const cachedThreadCount = SAMPLE_COMMUNITIES.reduce((count, community) => {
    return count + getCachedThreads(db, community.id, { limit: 1 }).length;
  }, 0);

  if (cachedThreadCount === 0) {
    SAMPLE_THREADS.forEach((thread) => upsertCachedThread(db, thread));
  }

  if (getCachedReplies(db, THREAD_ONE_ID, { limit: 1 }).length === 0) {
    SAMPLE_REPLIES.forEach((reply) => upsertCachedReply(db, reply));
  }

  if (getCachedBookmarks(db, LOCAL_PROFILE_ID, { limit: 1 }).length === 0) {
    SAMPLE_BOOKMARKS.forEach((bookmark) => upsertCachedBookmark(db, bookmark));
  }

  if (getCachedCommunityMembers(db, CREATIVE_COMMUNITY_ID, { limit: 1 }).length === 0) {
    SAMPLE_MEMBERS.forEach((member) => upsertCachedCommunityMember(db, member));
  }

  if (getCachedTags(db, CREATIVE_COMMUNITY_ID, { limit: 1 }).length === 0) {
    SAMPLE_TAGS.forEach((tag) => upsertCachedTag(db, tag));
  }
}

function ensurePhaseOnePreferences(db: HubDatabaseAdapter): void {
  if (getPreference(db, PREF_HUMANS_ONLY) == null) {
    setPreference(db, PREF_HUMANS_ONLY, '0');
  }

  if (getPreference(db, PREF_RECENT_SEARCHES) == null) {
    writeJsonPreference(db, PREF_RECENT_SEARCHES, DEFAULT_RECENT_SEARCHES);
  }

  if (getPreference(db, PREF_SAVED_REPLY_IDS) == null) {
    writeJsonPreference(db, PREF_SAVED_REPLY_IDS, DEFAULT_SAVED_REPLY_IDS);
  }

  if (getPreference(db, PREF_SAVED_COMMUNITY_IDS) == null) {
    writeJsonPreference(db, PREF_SAVED_COMMUNITY_IDS, DEFAULT_SAVED_COMMUNITY_IDS);
  }

  if (getPreference(db, PREF_FOLLOWING_PROFILE_IDS) == null) {
    writeJsonPreference(db, PREF_FOLLOWING_PROFILE_IDS, DEFAULT_FOLLOWING_PROFILE_IDS);
  }
}

function readAllReplies(db: HubDatabaseAdapter): Reply[] {
  return db.query<Reply>(
    `SELECT
      id,
      thread_id as threadId,
      parent_reply_id as parentReplyId,
      author_id as authorId,
      body,
      vote_score as voteScore,
      depth,
      status,
      created_at as createdAt,
      updated_at as updatedAt
    FROM fr_replies_cache
    ORDER BY created_at DESC
    LIMIT 200`,
  );
}

function readThreadVotes(
  db: HubDatabaseAdapter,
  profileId: string,
): Record<string, ForumsVoteState> {
  const rows = db.query<{ targetId: string; direction: ForumsVoteState }>(
    `SELECT target_id as targetId, direction
     FROM fr_votes_local
     WHERE target_type = 'thread' AND profile_id = ?`,
    [profileId],
  );

  const result: Record<string, ForumsVoteState> = {};
  for (const row of rows) {
    result[row.targetId] = row.direction;
  }
  return result;
}

function HighlightedText({
  text,
  query,
  style,
}: {
  text: string;
  query: string;
  style?: object;
}) {
  if (!query.trim()) {
    return <Text style={style}>{text}</Text>;
  }

  const regex = new RegExp(`(${escapeRegExp(query.trim())})`, 'ig');
  const parts = text.split(regex);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const match = part.toLowerCase() === query.trim().toLowerCase();
        return (
          <Text
            key={`${part}-${index}`}
            style={match ? styles.highlightText : undefined}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function HeaderAvatar({ profile }: { profile: UserProfile }) {
  return (
    <View style={styles.headerAvatar}>
      <Text style={styles.headerAvatarText}>{initials(profile.displayName)}</Text>
    </View>
  );
}

function HeaderAction({
  icon,
  onPress,
}: {
  icon: Parameters<typeof MaterialSymbol>[0]['name'];
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.headerAction}>
      <MaterialSymbol name={icon} size={18} color={FR_TEXT_SECONDARY} />
    </Pressable>
  );
}

function StickyHeader({
  insetsTop,
  children,
}: {
  insetsTop: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.stickyHeaderHost}>
      <BlurView
        tint="dark"
        intensity={FR_GLASS_NAV.blur}
        style={[
          styles.stickyHeader,
          {
            backgroundColor: FR_GLASS_NAV.backgroundColor,
            paddingTop: Math.max(insetsTop, 12) + 6,
          },
        ]}
      >
        {children}
      </BlurView>
    </View>
  );
}

function FeedHeader({
  humansOnly,
  onToggleHumansOnly,
  sort,
  setSort,
  topRange,
  setTopRange,
  profile,
}: {
  profile: UserProfile;
  humansOnly: boolean;
  onToggleHumansOnly: (value: boolean) => void;
  sort: FeedSort;
  setSort: (value: FeedSort) => void;
  topRange: TopRange;
  setTopRange: (value: TopRange) => void;
  onOpenActivity: () => void;
}) {
  return (
    <View style={styles.headerStack}>
      <GlassCard glow={humansOnly} style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroEyebrowRow}>
            <MaterialSymbol
              name="shield"
              size={16}
              color={humansOnly ? FR_ACCENT_LIGHT : FR_TEXT_TERTIARY}
              filled={humansOnly}
            />
            <Text style={styles.heroEyebrow}>FEED</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{buildFeedChannel(profile.userId)}</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Forum Feed</Text>
        <Text style={styles.heroSubtitle}>
          Verified voices, pinned context, and a calmer thread stack.
        </Text>

        <View style={[styles.toggleCard, humansOnly ? styles.toggleCardActive : null]}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Humans Only</Text>
            <Text style={styles.toggleSubtitle}>
              Filter out bot-detected content and prioritize trusted authors.
            </Text>
          </View>
          <Switch
            value={humansOnly}
            onValueChange={onToggleHumansOnly}
            thumbColor={humansOnly ? FR_ON_ACCENT : '#F4F3F4'}
            trackColor={{
              false: 'rgba(255,255,255,0.12)',
              true: 'rgba(124, 77, 255, 0.75)',
            }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          {(['hot', 'new', 'top', 'following'] as FeedSort[]).map((value) => (
            <FilterChip
              key={value}
              label={value === 'hot' ? 'Hot' : value === 'new' ? 'New' : value === 'top' ? 'Top' : 'Following'}
              active={sort === value}
              onPress={() => setSort(value)}
            />
          ))}
        </ScrollView>

        {sort === 'top' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.microChipRail}>
            {(['today', 'week', 'month', 'all'] as TopRange[]).map((value) => (
              <FilterChip
                key={value}
                label={
                  value === 'today'
                    ? 'Today'
                    : value === 'week'
                      ? 'Week'
                      : value === 'month'
                        ? 'Month'
                        : 'All Time'
                }
                active={topRange === value}
                compact
                onPress={() => setTopRange(value)}
              />
            ))}
          </ScrollView>
        ) : null}
      </GlassCard>
    </View>
  );
}

function SectionEmpty({
  icon,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  icon: Parameters<typeof MaterialSymbol>[0]['name'];
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <GlassCard style={styles.emptyPanel}>
      <View style={styles.emptyIconWrap}>
        <MaterialSymbol name={icon} size={20} color={FR_ACCENT_LIGHT} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.inlineAccentButton}>
          <Text style={styles.inlineAccentButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  compact = false,
  glow = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
  glow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.filterChip,
        compact ? styles.filterChipCompact : null,
        active ? styles.filterChipActive : null,
        glow ? FR_PURPLE_GLOW_STYLE : null,
      ]}
    >
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function CommunityMetaStrip({ community }: { community: Community }) {
  return (
    <View style={styles.metaStrip}>
      {community.humansOnly ? (
        <View style={[styles.metaBadge, styles.metaBadgePurple]}>
          <MaterialSymbol name="shield" size={12} color={FR_ACCENT_LIGHT} filled />
          <Text style={styles.metaBadgeText}>Humans Only</Text>
        </View>
      ) : null}
      {isFederatedCommunity(community) ? (
        <View style={[styles.metaBadge, styles.metaBadgeBlue]}>
          <MaterialSymbol name="groups" size={12} color="#8BCFF0" />
          <Text style={styles.metaBadgeText}>Federated</Text>
        </View>
      ) : null}
      {community.communityType === 'private' ? (
        <View style={styles.metaBadge}>
          <MaterialSymbol name="lock" size={12} color={FR_TEXT_SECONDARY} />
          <Text style={styles.metaBadgeText}>Private</Text>
        </View>
      ) : null}
    </View>
  );
}

function SavedRow({
  item,
  onOpenThread,
  onOpenReplyContext,
  onOpenCommunity,
  onRemove,
}: {
  item: SavedItem;
  onOpenThread: (threadId: string) => void;
  onOpenReplyContext: (replyId: string) => void;
  onOpenCommunity: (communityId: string) => void;
  onRemove: () => void;
}) {
  if (item.type === 'thread') {
    return (
      <GlassCard style={styles.savedRowCard}>
        <Pressable onPress={() => onOpenThread(item.thread.id)} style={styles.savedRowPressable}>
          <View style={styles.savedRowIcon}>
            <MaterialSymbol name="bookmark" size={18} color={FR_ACCENT_LIGHT} filled />
          </View>
          <View style={styles.savedRowCopy}>
            <Text style={styles.savedRowTitle}>{item.thread.title}</Text>
            <View style={styles.savedRowMeta}>
              <CommunityPill community={item.community} />
              <Text style={styles.savedRowSubtitle}>
                {item.author.displayName} · {formatShortDate(item.savedAt)}
              </Text>
            </View>
            <Text style={styles.savedRowMetrics}>
              {item.thread.voteScore} votes · {item.thread.replyCount} replies
            </Text>
          </View>
          <Pressable onPress={onRemove} style={styles.savedRowRemove}>
            <MaterialSymbol name="delete" size={18} color={FR_TEXT_TERTIARY} />
          </Pressable>
        </Pressable>
      </GlassCard>
    );
  }

  if (item.type === 'reply') {
    return (
      <GlassCard style={styles.savedRowCard}>
        <Pressable
          onPress={() => onOpenReplyContext(item.reply.id)}
          style={styles.savedRowPressable}
        >
          <View style={styles.savedRowIcon}>
            <MaterialSymbol name="chat_bubble" size={18} color={FR_ACCENT_LIGHT} />
          </View>
          <View style={styles.savedRowCopy}>
            <Text style={styles.savedRowTitle}>Reply in {item.thread.title}</Text>
            <Text numberOfLines={2} style={styles.savedRowBody}>
              {item.reply.body}
            </Text>
            <Text style={styles.savedRowSubtitle}>
              {item.author.displayName} · {item.community.displayName}
            </Text>
          </View>
          <Pressable onPress={onRemove} style={styles.savedRowRemove}>
            <MaterialSymbol name="delete" size={18} color={FR_TEXT_TERTIARY} />
          </Pressable>
        </Pressable>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.savedRowCard}>
      <Pressable
        onPress={() => onOpenCommunity(item.community.id)}
        style={styles.savedRowPressable}
      >
        <View style={styles.savedRowIcon}>
          <MaterialSymbol name="groups" size={18} color={FR_ACCENT_LIGHT} />
        </View>
        <View style={styles.savedRowCopy}>
          <Text style={styles.savedRowTitle}>{item.community.displayName}</Text>
          <Text numberOfLines={2} style={styles.savedRowBody}>
            {item.community.description ?? 'Community saved for later.'}
          </Text>
          <Text style={styles.savedRowSubtitle}>
            {item.community.memberCount} members · {formatShortDate(item.savedAt)}
          </Text>
        </View>
        <Pressable onPress={onRemove} style={styles.savedRowRemove}>
          <MaterialSymbol name="delete" size={18} color={FR_TEXT_TERTIARY} />
        </Pressable>
      </Pressable>
    </GlassCard>
  );
}

function ProfileSurface({
  profile,
  stats,
  badges,
  communityCount,
  isOwnProfile,
  following,
  onEdit,
  onMessage,
  onToggleFollow,
  activeTab,
  setActiveTab,
  postFilter,
  setPostFilter,
  posts,
  replies,
  communities,
}: {
  profile: UserProfile;
  stats: UserStats;
  badges: Array<{ id: string; icon: string; label: string }>;
  communityCount: number;
  isOwnProfile: boolean;
  following: boolean;
  onEdit?: () => void;
  onMessage?: () => void;
  onToggleFollow?: () => void;
  activeTab: ProfileTabKey;
  setActiveTab: (value: ProfileTabKey) => void;
  postFilter: PostFilter;
  setPostFilter: (value: PostFilter) => void;
  posts: Array<{ thread: Thread; community: Community; author: UserProfile }>;
  replies: Array<{ reply: Reply; thread: Thread; community: Community; author: UserProfile }>;
  communities: Community[];
}) {
  const insets = useSafeAreaInsets();
  const [trustExpanded, setTrustExpanded] = useState(isOwnProfile);

  return (
    <View style={styles.profileScreen}>
      <ScrollView
        contentContainerStyle={styles.profileContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileTopChrome, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.profileChromeLabel}>
            {isOwnProfile ? 'YOUR PROFILE' : 'USER PROFILE'}
          </Text>
          <View style={styles.headerActions}>
            {isOwnProfile ? (
              <HeaderAction icon="edit" onPress={() => onEdit?.()} />
            ) : (
              <>
                <HeaderAction icon="chat_bubble" onPress={() => onMessage?.()} />
                <HeaderAction icon="more_vert" onPress={() => onToggleFollow?.()} />
              </>
            )}
          </View>
        </View>

        <LinearGradient
          colors={['rgba(167,139,250,0.95)', 'rgba(124,77,255,0.65)', 'rgba(19,19,24,0.6)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverHero}
        >
          <Text style={styles.coverEyebrow}>HUMAN-VERIFIED</Text>
          <Text style={styles.coverStatus}>{profile.statusEmoji} {profile.statusText}</Text>
        </LinearGradient>

        <View style={styles.profileCardStack}>
          <ForumsProfileCard profile={profile} stats={{ ...stats, communitiesJoined: communityCount }} />

          <GlassCard style={styles.profileActionsCard}>
            <View style={styles.profileActionsRow}>
              {isOwnProfile ? (
                <Pressable style={styles.primaryActionButton} onPress={onEdit}>
                  <Text style={styles.primaryActionText}>Edit Profile</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable style={styles.primaryActionButton} onPress={onToggleFollow}>
                    <Text style={styles.primaryActionText}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.secondaryActionButton} onPress={onMessage}>
                    <Text style={styles.secondaryActionText}>Message</Text>
                  </Pressable>
                </>
              )}
            </View>

            <View style={styles.profileMetaStack}>
              <View style={styles.profileMetaRow}>
                <HumanVerifiedBadge tier={getTrustTier(profile)} />
                <Text style={styles.profileMetaText}>@{profile.username}</Text>
                <Text style={styles.profileMetaText}>
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.profileBio}>{profile.bio}</Text>
              <View style={styles.metricRow}>
                <MetricPill label="Threads" value={String(stats.threadCount)} />
                <MetricPill label="Replies" value={String(stats.replyCount)} />
                <MetricPill label="Karma" value={String(stats.karma)} />
                <MetricPill label="Communities" value={String(communityCount)} />
              </View>
            </View>
          </GlassCard>

          {isOwnProfile ? (
            <GlassCard style={styles.trustCard}>
              <Pressable
                onPress={() => setTrustExpanded((value) => !value)}
                style={styles.sectionTitleRow}
              >
                <View>
                  <Text style={styles.sectionEyebrow}>TRUST SCORE</Text>
                  <Text style={styles.sectionTitle}>Trusted human signal</Text>
                </View>
                <Text style={styles.sectionLink}>
                  {trustExpanded ? 'Collapse' : 'Expand'}
                </Text>
              </Pressable>
              {trustExpanded ? (
                <View style={styles.trustDetailStack}>
                  <Text style={styles.trustBody}>
                    Current tier: {getTrustTier(profile).replace('_', ' ')}. Keep reply quality high, maintain profile completeness, and keep moderation actions clean.
                  </Text>
                  <View style={styles.chipRail}>
                    <FilterChip label="Complete bio" active compact />
                    <FilterChip label="Reply context" active compact />
                    <FilterChip label="Verification flow" compact />
                  </View>
                </View>
              ) : null}
            </GlassCard>
          ) : null}

          <GlassCard style={styles.tabsCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
              {(['posts', 'replies', 'communities', 'about'] as ProfileTabKey[]).map((value) => (
                <FilterChip
                  key={value}
                  label={value === 'about' ? 'About' : value === 'communities' ? 'Communities' : value === 'replies' ? 'Replies' : 'Posts'}
                  active={activeTab === value}
                  onPress={() => setActiveTab(value)}
                />
              ))}
            </ScrollView>

            {activeTab === 'posts' ? (
              <View style={styles.profileSectionStack}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.microChipRail}>
                  {(['all', 'pinned', 'popular'] as PostFilter[]).map((value) => (
                    <FilterChip
                      key={value}
                      label={value === 'all' ? 'All' : value === 'pinned' ? 'Pinned' : 'Popular'}
                      active={postFilter === value}
                      compact
                      onPress={() => setPostFilter(value)}
                    />
                  ))}
                </ScrollView>
                {posts.length === 0 ? (
                  <SectionEmpty
                    icon="newspaper"
                    title="No posts yet"
                    detail="Threads started by this profile will land here."
                  />
                ) : (
                  posts.map((item) => (
                    <ForumsThreadCard
                      key={item.thread.id}
                      thread={item.thread}
                      author={item.author}
                      community={item.community}
                      userVote={null}
                      variant="compact"
                    />
                  ))
                )}
              </View>
            ) : null}

            {activeTab === 'replies' ? (
              <View style={styles.profileSectionStack}>
                {replies.length === 0 ? (
                  <SectionEmpty
                    icon="chat_bubble"
                    title="No replies yet"
                    detail="Replies and discussion breadcrumbs will show up here."
                  />
                ) : (
                  replies.map((item) => (
                    <View key={item.reply.id} style={styles.replyContextWrap}>
                      <Text style={styles.replyBreadcrumb}>
                        In {item.community.displayName} / {item.thread.title}
                      </Text>
                      <ReplyBubble
                        reply={item.reply}
                        author={item.author}
                        depth={item.reply.depth}
                      />
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {activeTab === 'communities' ? (
              <View style={styles.profileSectionStack}>
                {communities.length === 0 ? (
                  <SectionEmpty
                    icon="groups"
                    title="No communities"
                    detail="Joined communities will appear here."
                  />
                ) : (
                  communities.map((community) => (
                    <View key={community.id} style={styles.profileCommunityRow}>
                      <CommunityMetaStrip community={community} />
                      <ForumsCommunityCard
                        community={community}
                        joined
                        variant="row"
                      />
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {activeTab === 'about' ? (
              <View style={styles.profileSectionStack}>
                <GlassCard style={styles.aboutCard}>
                  <Text style={styles.sectionEyebrow}>ABOUT</Text>
                  <Text style={styles.aboutBody}>{profile.bio}</Text>
                  <Text style={styles.aboutMeta}>Member since {new Date(profile.createdAt).toLocaleDateString()}</Text>
                  {profile.location ? (
                    <Text style={styles.aboutMeta}>Location: {profile.location}</Text>
                  ) : null}
                  {profile.websiteUrl ? (
                    <Text style={styles.aboutMeta}>Website: {profile.websiteUrl}</Text>
                  ) : null}
                  <Text style={styles.aboutMeta}>
                    Linked account: {isFederatedCommunity(SAMPLE_COMMUNITIES[1]) ? 'notes.exchange / @' : '@'}
                    {profile.username}
                  </Text>
                </GlassCard>
                <GlassCard style={styles.aboutCard}>
                  <Text style={styles.sectionEyebrow}>BADGES</Text>
                  <View style={styles.badgeFlow}>
                    {badges.map((badge) => (
                      <View key={badge.id} style={styles.badgeToken}>
                        <Text style={styles.badgeTokenIcon}>{badge.icon}</Text>
                        <Text style={styles.badgeTokenText}>{badge.label}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              </View>
            ) : null}
          </GlassCard>
        </View>
      </ScrollView>
    </View>
  );
}

function useForumsPhaseOneData() {
  const hubDb = useDatabase();
  const db = useMemo(() => toForumsDb(hubDb), [hubDb]);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    ensurePhaseOneCache(db);
    ensurePhaseOnePreferences(hubDb);
    refresh();
  }, [db, hubDb, refresh]);

  const communities = useMemo(() => {
    return safeRead(SAMPLE_COMMUNITIES, () => {
      const cached = getCachedCommunities(db, { limit: 80 });
      return cached.length > 0 ? cached : SAMPLE_COMMUNITIES;
    });
  }, [db, revision]);

  const profiles = useMemo(() => {
    const merged = new Map<string, UserProfile>();
    SAMPLE_PROFILES.forEach((profile) => {
      merged.set(profile.id, getCachedProfileById(db, profile.id) ?? profile);
    });
    const localProfile = getCachedProfileByUserId(db, LOCAL_USER_ID);
    if (localProfile) {
      merged.set(localProfile.id, localProfile);
    }
    return Array.from(merged.values());
  }, [db, revision]);

  const currentProfile = useMemo(() => {
    return (
      profiles.find((profile) => profile.userId === LOCAL_USER_ID) ??
      SAMPLE_PROFILES[0]
    );
  }, [profiles]);

  const threads = useMemo(() => {
    return safeRead(SAMPLE_THREADS, () => {
      const merged = new Map<string, Thread>();
      communities.forEach((community) => {
        getCachedThreads(db, community.id, { limit: 80 }).forEach((thread) => {
          merged.set(thread.id, thread);
        });
      });
      if (merged.size === 0) {
        SAMPLE_THREADS.forEach((thread) => merged.set(thread.id, thread));
      }
      return Array.from(merged.values());
    });
  }, [communities, db, revision]);

  const replies = useMemo(() => {
    const cached = safeRead<Reply[]>([], () => readAllReplies(hubDb));
    return cached.length > 0 ? cached : SAMPLE_REPLIES;
  }, [hubDb, revision]);

  const bookmarks = useMemo(() => {
    const cached = safeRead<Bookmark[]>([], () =>
      getCachedBookmarks(db, currentProfile.id, { limit: 120 }),
    );
    return cached.length > 0 ? cached : SAMPLE_BOOKMARKS;
  }, [currentProfile.id, db, revision]);

  const followingProfileIds = useMemo(() => {
    return new Set(
      readJsonPreference<string[]>(
        hubDb,
        PREF_FOLLOWING_PROFILE_IDS,
        DEFAULT_FOLLOWING_PROFILE_IDS,
      ),
    );
  }, [hubDb, revision]);

  const recentSearches = useMemo(() => {
    return readJsonPreference<string[]>(
      hubDb,
      PREF_RECENT_SEARCHES,
      DEFAULT_RECENT_SEARCHES,
    );
  }, [hubDb, revision]);

  const savedReplyIds = useMemo(() => {
    return new Set(
      readJsonPreference<string[]>(
        hubDb,
        PREF_SAVED_REPLY_IDS,
        DEFAULT_SAVED_REPLY_IDS,
      ),
    );
  }, [hubDb, revision]);

  const savedCommunityIds = useMemo(() => {
    return new Set(
      readJsonPreference<string[]>(
        hubDb,
        PREF_SAVED_COMMUNITY_IDS,
        DEFAULT_SAVED_COMMUNITY_IDS,
      ),
    );
  }, [hubDb, revision]);

  const humansOnlyEnabled = useMemo(() => {
    return getPreference(hubDb, PREF_HUMANS_ONLY) === '1';
  }, [hubDb, revision]);

  const threadVotes = useMemo(() => {
    return safeRead<Record<string, ForumsVoteState>>({}, () =>
      readThreadVotes(hubDb, currentProfile.id),
    );
  }, [currentProfile.id, hubDb, revision]);

  const joinedCommunityIds = useMemo(() => {
    return new Set(
      communities
        .filter((community) =>
          getCachedCommunityMembers(db, community.id, { limit: 200 }).some(
            (member) =>
              member.profileId === currentProfile.id && member.status === 'active',
          ) ||
          SAMPLE_MEMBERS.some(
            (member) =>
              member.communityId === community.id &&
              member.profileId === currentProfile.id &&
              member.status === 'active',
          ),
        )
        .map((community) => community.id),
    );
  }, [communities, currentProfile.id, db, revision]);

  const findCommunity = useCallback(
    (communityId?: string | null) => {
      return (
        getCachedCommunityById(db, communityId ?? '') ??
        communities.find((community) => community.id === communityId) ??
        SAMPLE_COMMUNITIES[0]
      );
    },
    [communities, db],
  );

  const findProfile = useCallback(
    (profileId?: string | null) => {
      return (
        getCachedProfileById(db, profileId ?? '') ??
        profiles.find((profile) => profile.id === profileId) ??
        currentProfile
      );
    },
    [currentProfile, db, profiles],
  );

  const findThread = useCallback(
    (threadId?: string | null) => {
      return (
        getCachedThreadById(db, threadId ?? '') ??
        threads.find((thread) => thread.id === threadId) ??
        SAMPLE_THREADS[0]
      );
    },
    [db, threads],
  );

  const repliesForThread = useCallback(
    (threadId: string) => {
      const threaded = replies
        .filter((reply) => reply.threadId === threadId)
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
      return threaded;
    },
    [replies],
  );

  const membersForCommunity = useCallback(
    (communityId: string) => {
      const cached = safeRead<CommunityMember[]>([], () =>
        getCachedCommunityMembers(db, communityId, { limit: 200 }),
      );
      return cached.length > 0
        ? cached
        : SAMPLE_MEMBERS.filter((member) => member.communityId === communityId);
    },
    [db, revision],
  );

  const tagsForCommunity = useCallback(
    (communityId: string) => {
      const cached = safeRead(SAMPLE_TAGS, () =>
        getCachedTags(db, communityId, { limit: 24 }),
      );
      return cached.length > 0
        ? cached
        : SAMPLE_TAGS.filter((tag) => tag.communityId === communityId);
    },
    [db, revision],
  );

  const getSavedItems = useCallback((): SavedItem[] => {
    const threadItems: SavedThreadItem[] = bookmarks.map((bookmark) => {
      const thread = findThread(bookmark.threadId);
      return {
        id: `thread-${bookmark.id}`,
        type: 'thread',
        savedAt: bookmark.createdAt,
        thread,
        community: findCommunity(thread.communityId),
        author: findProfile(thread.authorId),
      };
    });

    const replyItems: SavedReplyItem[] = replies
      .filter((reply) => savedReplyIds.has(reply.id))
      .map((reply) => {
        const thread = findThread(reply.threadId);
        return {
          id: `reply-${reply.id}`,
          type: 'reply',
          savedAt: reply.createdAt,
          reply,
          thread,
          community: findCommunity(thread.communityId),
          author: findProfile(reply.authorId),
        };
      });

    const communityItems: SavedCommunityItem[] = communities
      .filter((community) => savedCommunityIds.has(community.id))
      .map((community) => ({
        id: `community-${community.id}`,
        type: 'community',
        savedAt: community.updatedAt,
        community,
      }));

    return [...threadItems, ...replyItems, ...communityItems].sort(
      (left, right) =>
        new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
    );
  }, [
    bookmarks,
    communities,
    findCommunity,
    findProfile,
    findThread,
    replies,
    savedCommunityIds,
    savedReplyIds,
  ]);

  const setHumansOnlyPreference = useCallback(
    (value: boolean) => {
      try {
        setPreference(hubDb, PREF_HUMANS_ONLY, value ? '1' : '0');
        refresh();
      } catch {
        Alert.alert('Could not update filter', 'Try again in a moment.');
      }
    },
    [hubDb, refresh],
  );

  const updateProfileCommunityCount = useCallback(
    (delta: number) => {
      upsertCachedProfile(db, {
        ...currentProfile,
        communitiesJoined: Math.max(0, currentProfile.communitiesJoined + delta),
        updatedAt: new Date().toISOString(),
      });
    },
    [currentProfile, db],
  );

  const toggleCommunityMembership = useCallback(
    (communityId: string) => {
      try {
        const community = findCommunity(communityId);
        const existing = membersForCommunity(communityId).find(
          (member) =>
            member.profileId === currentProfile.id && member.status === 'active',
        );

        if (existing) {
          db.run(
            'DELETE FROM fr_community_members_cache WHERE community_id = ? AND profile_id = ?',
            [communityId, currentProfile.id],
          );
          upsertCachedCommunity(db, {
            ...community,
            memberCount: Math.max(0, community.memberCount - 1),
            updatedAt: new Date().toISOString(),
          });
          updateProfileCommunityCount(-1);
        } else {
          upsertCachedCommunityMember(db, {
            id: makeId('member'),
            communityId,
            profileId: currentProfile.id,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
          });
          upsertCachedCommunity(db, {
            ...community,
            memberCount: community.memberCount + 1,
            updatedAt: new Date().toISOString(),
          });
          updateProfileCommunityCount(1);
        }

        refresh();
      } catch {
        Alert.alert(
          'Could not update membership',
          'The join or leave action failed. Try again.',
        );
      }
    },
    [
      currentProfile.id,
      db,
      findCommunity,
      membersForCommunity,
      refresh,
      updateProfileCommunityCount,
    ],
  );

  const toggleBookmark = useCallback(
    (threadId: string) => {
      try {
        const existing = bookmarks.find((bookmark) => bookmark.threadId === threadId);
        if (existing) {
          deleteCachedBookmark(db, existing.id);
        } else {
          upsertCachedBookmark(db, {
            id: makeId('bookmark'),
            profileId: currentProfile.id,
            threadId,
            createdAt: new Date().toISOString(),
          });
        }
        refresh();
      } catch {
        Alert.alert('Could not update saved state', 'Try again in a moment.');
      }
    },
    [bookmarks, currentProfile.id, db, refresh],
  );

  const voteThread = useCallback(
    (threadId: string, direction: 'up' | 'down') => {
      try {
        const thread = findThread(threadId);
        const currentVote = threadVotes[threadId] ?? null;
        let nextVote: ForumsVoteState = direction;
        let scoreDelta = direction === 'up' ? 1 : -1;

        if (currentVote === direction) {
          nextVote = null;
          scoreDelta = direction === 'up' ? -1 : 1;
          db.run(
            'DELETE FROM fr_votes_local WHERE target_type = ? AND target_id = ? AND profile_id = ?',
            ['thread', threadId, currentProfile.id],
          );
        } else {
          if (currentVote != null) {
            scoreDelta = direction === 'up' ? 2 : -2;
          }
          db.run(
            `INSERT OR REPLACE INTO fr_votes_local (target_type, target_id, profile_id, direction)
             VALUES (?, ?, ?, ?)`,
            ['thread', threadId, currentProfile.id, direction],
          );
        }

        upsertCachedThread(db, {
          ...thread,
          voteScore: thread.voteScore + scoreDelta,
          updatedAt: new Date().toISOString(),
        });
        refresh();
        return nextVote;
      } catch {
        Alert.alert('Could not cast vote', 'The vote did not save.');
        return threadVotes[threadId] ?? null;
      }
    },
    [currentProfile.id, db, findThread, refresh, threadVotes],
  );

  const saveRecentSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) return;

      try {
        const next = [
          trimmed,
          ...recentSearches.filter(
            (item) => item.toLowerCase() !== trimmed.toLowerCase(),
          ),
        ].slice(0, 5);
        writeJsonPreference(hubDb, PREF_RECENT_SEARCHES, next);
        refresh();
      } catch {
        // Ignore local recent-search persistence failures.
      }
    },
    [hubDb, recentSearches, refresh],
  );

  const clearRecentSearches = useCallback(() => {
    try {
      writeJsonPreference(hubDb, PREF_RECENT_SEARCHES, []);
      refresh();
    } catch {
      Alert.alert('Could not clear recent searches', 'Try again.');
    }
  }, [hubDb, refresh]);

  const removeSavedReply = useCallback(
    (replyId: string) => {
      try {
        const next = Array.from(savedReplyIds).filter((id) => id !== replyId);
        writeJsonPreference(hubDb, PREF_SAVED_REPLY_IDS, next);
        refresh();
      } catch {
        Alert.alert('Could not remove saved reply', 'Try again.');
      }
    },
    [hubDb, refresh, savedReplyIds],
  );

  const removeSavedCommunity = useCallback(
    (communityId: string) => {
      try {
        const next = Array.from(savedCommunityIds).filter((id) => id !== communityId);
        writeJsonPreference(hubDb, PREF_SAVED_COMMUNITY_IDS, next);
        refresh();
      } catch {
        Alert.alert('Could not remove saved community', 'Try again.');
      }
    },
    [hubDb, refresh, savedCommunityIds],
  );

  const toggleFollow = useCallback(
    (profileId: string) => {
      try {
        const current = new Set(followingProfileIds);
        if (current.has(profileId)) {
          current.delete(profileId);
        } else {
          current.add(profileId);
        }
        writeJsonPreference(hubDb, PREF_FOLLOWING_PROFILE_IDS, Array.from(current));
        refresh();
      } catch {
        Alert.alert('Could not update follow state', 'Try again.');
      }
    },
    [followingProfileIds, hubDb, refresh],
  );

  const startConversationWith = useCallback(
    (profile: UserProfile) => {
      try {
        const now = new Date().toISOString();
        const conversationId = makeId('conversation');
        const conversation: Conversation = {
          id: conversationId,
          title: profile.displayName,
          isGroup: false,
          createdBy: LOCAL_USER_ID,
          lastMessageAt: now,
          lastMessagePreview: `Hey ${profile.displayName.split(' ')[0]}, reaching out from your profile.`,
          createdAt: now,
          updatedAt: now,
        };
        const message: DirectMessage = {
          id: makeId('message'),
          conversationId,
          senderId: LOCAL_USER_ID,
          body: conversation.lastMessagePreview ?? '',
          mediaUrl: null,
          mediaType: null,
          isEdited: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };

        upsertCachedConversation(db, conversation);
        upsertCachedMessage(db, message);
        refresh();
        return conversationId;
      } catch {
        Alert.alert('Could not start conversation', 'Try again.');
        return null;
      }
    },
    [db, refresh],
  );

  const insertThread = useCallback(
    (thread: Thread) => {
      try {
        upsertCachedThread(db, thread);
        const community = findCommunity(thread.communityId);
        upsertCachedCommunity(db, {
          ...community,
          threadCount: Math.max(community.threadCount, community.threadCount + 1),
          updatedAt: new Date().toISOString(),
        });
        refresh();
      } catch {
        Alert.alert('Could not update feed', 'Realtime update could not be applied.');
      }
    },
    [db, findCommunity, refresh],
  );

  return {
    currentProfile,
    communities,
    profiles,
    threads,
    replies,
    bookmarks,
    threadVotes,
    humansOnlyEnabled,
    recentSearches,
    followingProfileIds,
    joinedCommunityIds,
    findCommunity,
    findProfile,
    findThread,
    repliesForThread,
    membersForCommunity,
    tagsForCommunity,
    getSavedItems,
    refresh,
    setHumansOnlyPreference,
    toggleCommunityMembership,
    toggleBookmark,
    voteThread,
    saveRecentSearch,
    clearRecentSearches,
    removeSavedReply,
    removeSavedCommunity,
    toggleFollow,
    startConversationWith,
    insertThread,
  };
}

export function ForumsFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentProfile,
    threads,
    threadVotes,
    followingProfileIds,
    humansOnlyEnabled,
    findCommunity,
    findProfile,
    refresh,
    setHumansOnlyPreference,
    toggleBookmark,
    voteThread,
    insertThread,
  } = useForumsPhaseOneData();

  const [sort, setSort] = useState<FeedSort>('hot');
  const [topRange, setTopRange] = useState<TopRange>('week');
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [queuedRealtimeThreads, setQueuedRealtimeThreads] = useState<Thread[]>([]);
  const realtimeArmed = useRef(false);

  useEffect(() => {
    if (realtimeArmed.current || threads.some((thread) => thread.id === REALTIME_THREAD_ID)) {
      return;
    }
    realtimeArmed.current = true;
    const timer = setTimeout(() => {
      setQueuedRealtimeThreads([REALTIME_THREAD]);
    }, 3200);
    return () => clearTimeout(timer);
  }, [threads]);

  const filteredThreads = useMemo(() => {
    let next = threads.slice();

    if (humansOnlyEnabled) {
      next = next.filter((thread) => {
        const author = findProfile(thread.authorId);
        const community = findCommunity(thread.communityId);
        const tier = getTrustTier(author);
        return community.humansOnly || tier === 'trusted' || tier === 'highly_trusted' || tier === 'mod';
      });
    }

    if (sort === 'following') {
      next = next.filter(
        (thread) =>
          followingProfileIds.has(thread.authorId) ||
          thread.authorId === currentProfile.id,
      );
    }

    return sortThreads(next, sort, topRange);
  }, [
    currentProfile.id,
    findCommunity,
    findProfile,
    followingProfileIds,
    humansOnlyEnabled,
    sort,
    threads,
    topRange,
  ]);

  const pinnedThreads = filteredThreads.filter((thread) => thread.isPinned);
  const feedThreads = filteredThreads.filter((thread) => !thread.isPinned);
  const visibleThreads = feedThreads.slice(0, page * 20);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, [refresh]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const nearBottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 320;
      if (nearBottom && visibleThreads.length < feedThreads.length) {
        setPage((value) => value + 1);
      }
    },
    [feedThreads.length, visibleThreads.length],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            tintColor={FR_ACCENT_LIGHT}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <StickyHeader insetsTop={insets.top}>
          <FeedHeader
            profile={currentProfile}
            humansOnly={humansOnlyEnabled}
            onToggleHumansOnly={setHumansOnlyPreference}
            sort={sort}
            setSort={setSort}
            topRange={topRange}
            setTopRange={setTopRange}
            onOpenActivity={() => router.push('/(forums)/activity-feed' as never)}
          />
        </StickyHeader>

        <View style={styles.bodyStack}>
          {queuedRealtimeThreads.length > 0 ? (
            <Pressable
              onPress={() => {
                queuedRealtimeThreads.forEach((thread) => insertThread(thread));
                setQueuedRealtimeThreads([]);
              }}
              style={styles.bannerButton}
            >
              <MaterialSymbol name="notifications" size={16} color={FR_ON_ACCENT} />
              <Text style={styles.bannerButtonText}>
                {queuedRealtimeThreads.length} new thread
                {queuedRealtimeThreads.length === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ) : null}

          {pinnedThreads.length > 0 ? (
            <View style={styles.sectionStack}>
              <Pressable
                onPress={() => setPinnedCollapsed((value) => !value)}
                style={styles.sectionTitleRow}
              >
                <SectionHeader
                  title="Pinned"
                  accent={FR_ACCENT_LIGHT}
                  action={<Text style={styles.sectionLink}>{pinnedCollapsed ? 'Expand' : 'Collapse'}</Text>}
                />
              </Pressable>
              {!pinnedCollapsed ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalCards}
                >
                  {pinnedThreads.map((thread) => (
                    <View key={thread.id} style={styles.horizontalCardItem}>
                      <ForumsThreadCard
                        thread={thread}
                        author={findProfile(thread.authorId)}
                        community={findCommunity(thread.communityId)}
                        variant="pinned"
                        userVote={threadVotes[thread.id] ?? null}
                        onVote={(direction) => {
                          voteThread(thread.id, direction);
                        }}
                        onPress={() =>
                          router.push(
                            `/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never,
                          )
                        }
                        onSave={() => toggleBookmark(thread.id)}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          {visibleThreads.length === 0 ? (
            <SectionEmpty
              icon="newspaper"
              title="No threads yet"
              detail="Join a community to see posts here."
              actionLabel="Browse Communities"
              onAction={() => router.push('/(forums)/(tabs)/communities' as never)}
            />
          ) : (
            <View style={styles.sectionStack}>
              {visibleThreads.map((thread) => (
                <ForumsThreadCard
                  key={thread.id}
                  thread={thread}
                  author={findProfile(thread.authorId)}
                  community={findCommunity(thread.communityId)}
                  userVote={threadVotes[thread.id] ?? null}
                  onVote={(direction) => {
                    voteThread(thread.id, direction);
                  }}
                  onPress={() =>
                    router.push(
                      `/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never,
                    )
                  }
                  onSave={() => toggleBookmark(thread.id)}
                  onShare={() => {
                    Alert.alert('Share thread', 'Sharing is staged for a later phase.');
                  }}
                  onReport={() => {
                    Alert.alert('Report thread', 'Reporting is available from the thread detail flow.');
                  }}
                />
              ))}

              {visibleThreads.length < feedThreads.length ? (
                <GlassCard style={styles.paginationCard}>
                  <Text style={styles.paginationText}>
                    Loading more threads as you scroll
                  </Text>
                </GlassCard>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function ForumsCommunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentProfile,
    communities,
    joinedCommunityIds,
    tagsForCommunity,
    refresh,
    toggleCommunityMembership,
  } = useForumsPhaseOneData();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CommunityFilter>('all');

  const filteredCommunities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return communities.filter((community) => {
      const matchesQuery =
        needle.length === 0 ||
        `${community.displayName} ${community.description ?? ''}`
          .toLowerCase()
          .includes(needle);

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'humans'
            ? community.humansOnly
            : filter === 'public'
              ? community.communityType === 'public'
              : filter === 'private'
                ? community.communityType === 'private'
                : isFederatedCommunity(community);

      return matchesQuery && matchesFilter;
    });
  }, [communities, filter, query]);

  const yourCommunities = filteredCommunities.filter((community) =>
    joinedCommunityIds.has(community.id),
  );
  const discoverCommunities = filteredCommunities.filter(
    (community) => !joinedCommunityIds.has(community.id),
  );
  const trendingCommunities = filteredCommunities
    .slice()
    .sort(
      (left, right) =>
        right.threadCount * right.memberCount - left.threadCount * left.memberCount,
    )
    .slice(0, 4);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 500);
  }, [refresh]);

  const handleMembershipPress = useCallback(
    (community: Community) => {
      if (joinedCommunityIds.has(community.id)) {
        Alert.alert(
          `Leave ${community.displayName}?`,
          'You can join again later.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => toggleCommunityMembership(community.id),
            },
          ],
        );
        return;
      }
      toggleCommunityMembership(community.id);
    },
    [joinedCommunityIds, toggleCommunityMembership],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            tintColor={FR_ACCENT_LIGHT}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <StickyHeader insetsTop={insets.top}>
          <View style={styles.headerStack}>
            <GlassCard style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>COMMUNITY</Text>
              <Text style={styles.heroTitle}>Communities</Text>
              <Text style={styles.heroSubtitle}>
                {yourCommunities.length} you&apos;ve joined, {discoverCommunities.length} to discover.
              </Text>
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search communities..."
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
                <FilterChip
                  label="Humans Only"
                  active={filter === 'humans'}
                  glow={filter === 'humans'}
                  onPress={() => setFilter('humans')}
                />
                <FilterChip label="Public" active={filter === 'public'} onPress={() => setFilter('public')} />
                <FilterChip label="Private" active={filter === 'private'} onPress={() => setFilter('private')} />
                <FilterChip label="Federated" active={filter === 'federated'} onPress={() => setFilter('federated')} />
              </ScrollView>
            </GlassCard>
          </View>
        </StickyHeader>

        <View style={styles.bodyStack}>
          <View style={styles.sectionStack}>
            <SectionHeader
              title={`Your Communities · ${yourCommunities.length}`}
              action={<Text style={styles.sectionLink}>Joined</Text>}
            />
            {yourCommunities.length === 0 ? (
              <SectionEmpty
                icon="groups"
                title="No joined communities"
                detail="Join a few spaces to personalize your feed."
              />
            ) : (
              yourCommunities.map((community) => (
                <View key={community.id} style={styles.communitySectionCard}>
                  <CommunityMetaStrip community={community} />
                  <ForumsCommunityCard
                    community={community}
                    joined
                    onJoin={() => handleMembershipPress(community)}
                    onLeave={() => handleMembershipPress(community)}
                    onPress={() =>
                      router.push(
                        `/(forums)/community-detail?communityId=${encodeURIComponent(community.id)}` as never,
                      )
                    }
                  />
                  <View style={styles.communityTagRow}>
                    {tagsForCommunity(community.id).slice(0, 3).map((tag) => (
                      <FilterChip key={tag.id} label={tag.name} compact />
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.sectionStack}>
            <SectionHeader
              title="Discover"
              action={<Text style={styles.sectionLink}>Show All</Text>}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
              {discoverCommunities.map((community) => (
                <View key={community.id} style={styles.discoverCardWrap}>
                  <CommunityMetaStrip community={community} />
                  <ForumsCommunityCard
                    community={community}
                    joined={false}
                    variant="grid"
                    onJoin={() => handleMembershipPress(community)}
                    onPress={() =>
                      router.push(
                        `/(forums)/community-detail?communityId=${encodeURIComponent(community.id)}` as never,
                      )
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionStack}>
            <SectionHeader
              title="Trending"
              action={<Text style={styles.sectionLink}>Activity score</Text>}
            />
            {trendingCommunities.map((community) => (
              <GlassCard key={community.id} style={styles.trendingRowCard}>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(forums)/community-detail?communityId=${encodeURIComponent(community.id)}` as never,
                    )
                  }
                  style={styles.trendingRow}
                >
                  <View style={styles.trendingMetricWrap}>
                    <Text style={styles.trendingMetricValue}>
                      {Math.round((community.threadCount * community.memberCount) / 100)}
                    </Text>
                    <Text style={styles.trendingMetricLabel}>Score</Text>
                  </View>
                  <View style={styles.trendingCopy}>
                    <Text style={styles.trendingTitle}>{community.displayName}</Text>
                    <Text style={styles.trendingSubtitle}>
                      {community.memberCount} members · {community.threadCount} threads
                    </Text>
                    <CommunityMetaStrip community={community} />
                  </View>
                  <Pressable
                    onPress={() => handleMembershipPress(community)}
                    style={joinedCommunityIds.has(community.id) ? styles.secondaryActionButton : styles.primaryActionButton}
                  >
                    <Text style={joinedCommunityIds.has(community.id) ? styles.secondaryActionText : styles.primaryActionText}>
                      {joinedCommunityIds.has(community.id) ? 'Joined' : 'Join'}
                    </Text>
                  </Pressable>
                </Pressable>
              </GlassCard>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function ForumsSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentProfile,
    communities,
    profiles,
    threads,
    replies,
    findCommunity,
    findProfile,
    findThread,
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
    refresh,
  } = useForumsPhaseOneData();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('threads');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    const timeout = setTimeout(() => {
      saveRecentSearch(query);
    }, 700);
    return () => clearTimeout(timeout);
  }, [query, saveRecentSearch]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    communities.forEach((community) => {
      const list = SAMPLE_TAGS.filter((tag) => tag.communityId === community.id);
      list.forEach((tag) => {
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [communities]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    if (scope === 'threads') {
      return threads
        .filter((thread) =>
          `${thread.title} ${thread.body}`.toLowerCase().includes(needle),
        )
        .map((thread) => ({ type: 'thread' as const, thread }));
    }

    if (scope === 'replies') {
      return replies
        .filter((reply) => reply.body.toLowerCase().includes(needle))
        .map((reply) => ({ type: 'reply' as const, reply }));
    }

    if (scope === 'communities') {
      return communities
        .filter((community) =>
          `${community.displayName} ${community.description ?? ''}`
            .toLowerCase()
            .includes(needle),
        )
        .map((community) => ({ type: 'community' as const, community }));
    }

    return profiles
      .filter((profile) =>
        `${profile.displayName} ${profile.username} ${profile.bio}`
          .toLowerCase()
          .includes(needle),
      )
      .map((profile) => ({ type: 'user' as const, profile }));
  }, [communities, profiles, query, replies, scope, threads]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 500);
  }, [refresh]);

  return (
    <View style={styles.screen}>
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            tintColor={FR_ACCENT_LIGHT}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <StickyHeader insetsTop={insets.top}>
          <View style={styles.headerStack}>
            <GlassCard style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>DISCOVERY</Text>
              <Text style={styles.heroTitle}>Search</Text>
              <Text style={styles.heroSubtitle}>
                Threads, replies, communities, and people from one sharper entry point.
              </Text>
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search threads, replies, communities, users..."
                autoFocus
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                <FilterChip label="Threads" active={scope === 'threads'} onPress={() => setScope('threads')} />
                <FilterChip label="Replies" active={scope === 'replies'} onPress={() => setScope('replies')} />
                <FilterChip label="Communities" active={scope === 'communities'} onPress={() => setScope('communities')} />
                <FilterChip label="Users" active={scope === 'users'} onPress={() => setScope('users')} />
              </ScrollView>
            </GlassCard>
          </View>
        </StickyHeader>

        <View style={styles.bodyStack}>
          {query.trim().length === 0 ? (
            <>
              <View style={styles.sectionStack}>
                <SectionHeader
                  title="Recent"
                  action={
                    <Pressable onPress={clearRecentSearches}>
                      <Text style={styles.sectionLink}>Clear All</Text>
                    </Pressable>
                  }
                />
                {recentSearches.length === 0 ? (
                  <SectionEmpty
                    icon="search"
                    title="No recent searches"
                    detail="Searches you run will be cached here."
                  />
                ) : (
                  <View style={styles.wrapRow}>
                    {recentSearches.map((item) => (
                      <FilterChip
                        key={item}
                        label={item}
                        onPress={() => setQuery(item)}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.sectionStack}>
                <SectionHeader title="Trending Tags" action={<Text style={styles.sectionLink}>Tap to search</Text>} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                  {trendingTags.map((tag) => (
                    <FilterChip
                      key={tag}
                      label={`#${tag}`}
                      onPress={() => {
                        setQuery(tag);
                        setScope('threads');
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            </>
          ) : results.length === 0 ? (
            <SectionEmpty
              icon="search"
              title={`No results for "${query}"`}
              detail={`Try a different ${scope === 'users' ? 'person' : scope} scope or a wider query.`}
            />
          ) : (
            <View style={styles.sectionStack}>
              {results.map((result) => {
                if (result.type === 'thread') {
                  const community = findCommunity(result.thread.communityId);
                  const author = findProfile(result.thread.authorId);
                  return (
                    <View key={result.thread.id} style={styles.searchResultStack}>
                      <ForumsThreadCard
                        thread={result.thread}
                        author={author}
                        community={community}
                        userVote={null}
                        variant="compact"
                        onPress={() =>
                          router.push(
                            `/(forums)/thread-detail?threadId=${encodeURIComponent(result.thread.id)}` as never,
                          )
                        }
                      />
                      <GlassCard style={styles.searchSnippetCard}>
                        <HighlightedText
                          text={result.thread.body}
                          query={query}
                          style={styles.searchSnippetText}
                        />
                      </GlassCard>
                    </View>
                  );
                }

                if (result.type === 'reply') {
                  const thread = threads.find((item) => item.id === result.reply.threadId) ?? findThread(result.reply.threadId);
                  const community = findCommunity(thread.communityId);
                  const author = findProfile(result.reply.authorId);
                  return (
                    <GlassCard key={result.reply.id} style={styles.replySearchCard}>
                      <Text style={styles.replyBreadcrumb}>
                        {community.displayName} / {thread.title}
                      </Text>
                      <HighlightedText
                        text={result.reply.body}
                        query={query}
                        style={styles.replySearchBody}
                      />
                      <View style={styles.replySearchFooter}>
                        <Text style={styles.replySearchMeta}>
                          {author.displayName} · {formatRelativeTime(result.reply.createdAt)}
                        </Text>
                        <Pressable
                          onPress={() =>
                            router.push(
                              `/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never,
                            )
                          }
                        >
                          <Text style={styles.sectionLink}>Open Thread</Text>
                        </Pressable>
                      </View>
                    </GlassCard>
                  );
                }

                if (result.type === 'community') {
                  return (
                    <View key={result.community.id} style={styles.communitySectionCard}>
                      <CommunityMetaStrip community={result.community} />
                      <ForumsCommunityCard
                        community={result.community}
                        joined={false}
                        variant="row"
                        onPress={() =>
                          router.push(
                            `/(forums)/community-detail?communityId=${encodeURIComponent(result.community.id)}` as never,
                          )
                        }
                      />
                    </View>
                  );
                }

                const communityCount = communities.filter((community) =>
                  SAMPLE_MEMBERS.some(
                    (member) =>
                      member.communityId === community.id &&
                      member.profileId === result.profile.id &&
                      member.status === 'active',
                  ),
                ).length;
                return (
                  <View key={result.profile.id} style={styles.searchUserCard}>
                    <ForumsProfileCard
                      profile={result.profile}
                      stats={buildUserStats(result.profile, communityCount)}
                      variant="compact"
                    />
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/(forums)/user-profile?profileId=${encodeURIComponent(result.profile.id)}` as never,
                        )
                      }
                      style={styles.inlineAccentButton}
                    >
                      <Text style={styles.inlineAccentButtonText}>Open Profile</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function ForumsSavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentProfile,
    findProfile,
    repliesForThread,
    getSavedItems,
    refresh,
    toggleBookmark,
    removeSavedReply,
    removeSavedCommunity,
  } = useForumsPhaseOneData();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SavedFilter>('all');
  const [groupMode, setGroupMode] = useState<SavedGroupMode>('community');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);

  const savedItems = getSavedItems();

  const filteredItems = useMemo(() => {
    return savedItems.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'threads') return item.type === 'thread';
      if (filter === 'replies') return item.type === 'reply';
      return item.type === 'community';
    });
  }, [filter, savedItems]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, SavedItem[]>();
    filteredItems.forEach((item) => {
      const key =
        groupMode === 'community'
          ? item.type === 'community'
            ? item.community.displayName
            : item.community.displayName
          : groupMode === 'date'
            ? new Date(item.savedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : item.type === 'thread'
              ? 'Threads'
              : item.type === 'reply'
                ? 'Replies'
                : 'Communities';

      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [filteredItems, groupMode]);

  const selectedReplyItem = useMemo(() => {
    return savedItems.find(
      (item): item is SavedReplyItem =>
        item.type === 'reply' && item.reply.id === selectedReplyId,
    );
  }, [savedItems, selectedReplyId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 500);
  }, [refresh]);

  return (
    <View style={styles.screen}>
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            tintColor={FR_ACCENT_LIGHT}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <StickyHeader insetsTop={insets.top}>
          <View style={styles.headerStack}>
            <GlassCard style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>CURATION</Text>
              <Text style={styles.heroTitle}>Saved</Text>
              <Text style={styles.heroSubtitle}>
                Bookmark threads, keep reply context, and pin communities for later.
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
                <FilterChip label="Threads" active={filter === 'threads'} onPress={() => setFilter('threads')} />
                <FilterChip label="Replies" active={filter === 'replies'} onPress={() => setFilter('replies')} />
                <FilterChip label="Communities" active={filter === 'communities'} onPress={() => setFilter('communities')} />
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.microChipRail}>
                <FilterChip label="By Community" compact active={groupMode === 'community'} onPress={() => setGroupMode('community')} />
                <FilterChip label="By Date" compact active={groupMode === 'date'} onPress={() => setGroupMode('date')} />
                <FilterChip label="By Type" compact active={groupMode === 'type'} onPress={() => setGroupMode('type')} />
              </ScrollView>
            </GlassCard>
          </View>
        </StickyHeader>

        <View style={styles.bodyStack}>
          {selectedReplyItem ? (
            <GlassCard style={styles.replyContextCard}>
              <View style={styles.sectionTitleRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>SAVED CONTEXT</Text>
                  <Text style={styles.sectionTitle}>Reply in full thread context</Text>
                </View>
                <Pressable onPress={() => setSelectedReplyId(null)}>
                  <Text style={styles.sectionLink}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.replyBreadcrumb}>
                {selectedReplyItem.community.displayName} / {selectedReplyItem.thread.title}
              </Text>
              <ForumsThreadCard
                thread={selectedReplyItem.thread}
                author={selectedReplyItem.author}
                community={selectedReplyItem.community}
                userVote={null}
                variant="compact"
              />
              {repliesForThread(selectedReplyItem.thread.id)
                .slice(0, 3)
                .map((reply) => (
                  <ReplyBubble
                    key={reply.id}
                    reply={reply}
                    author={findProfile(reply.authorId)}
                    depth={reply.depth}
                  />
                ))}
              <Pressable
                onPress={() =>
                  router.push(
                    `/(forums)/thread-detail?threadId=${encodeURIComponent(selectedReplyItem.thread.id)}` as never,
                  )
                }
                style={styles.primaryActionButton}
              >
                <Text style={styles.primaryActionText}>Jump to Thread</Text>
              </Pressable>
            </GlassCard>
          ) : null}

          {groupedItems.length === 0 ? (
            <SectionEmpty
              icon="bookmark"
              title="No saved items yet"
              detail="Bookmark threads and replies to find them later."
              actionLabel="Browse Feed"
              onAction={() => router.push('/(forums)/(tabs)/feed' as never)}
            />
          ) : (
            groupedItems.map(([groupName, items]) => {
              const expanded = openGroups[groupName] ?? true;
              return (
                <View key={groupName} style={styles.sectionStack}>
                  <Pressable
                    onPress={() =>
                      setOpenGroups((current) => ({
                        ...current,
                        [groupName]: !expanded,
                      }))
                    }
                    style={styles.sectionTitleRow}
                  >
                    <Text style={styles.groupTitle}>
                      {groupName} · {items.length}
                    </Text>
                    <Text style={styles.sectionLink}>{expanded ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                  {expanded
                    ? items.map((item) => (
                        <SavedRow
                          key={item.id}
                          item={item}
                          onOpenThread={(threadId) =>
                            router.push(
                              `/(forums)/thread-detail?threadId=${encodeURIComponent(threadId)}` as never,
                            )
                          }
                          onOpenReplyContext={(replyId) => setSelectedReplyId(replyId)}
                          onOpenCommunity={(communityId) =>
                            router.push(
                              `/(forums)/community-detail?communityId=${encodeURIComponent(communityId)}` as never,
                            )
                          }
                          onRemove={() => {
                            if (item.type === 'thread') {
                              toggleBookmark(item.thread.id);
                              return;
                            }
                            if (item.type === 'reply') {
                              removeSavedReply(item.reply.id);
                              if (selectedReplyId === item.reply.id) {
                                setSelectedReplyId(null);
                              }
                              return;
                            }
                            removeSavedCommunity(item.community.id);
                          }}
                        />
                      ))
                    : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function ForumsProfileScreen() {
  const router = useRouter();
  const {
    currentProfile,
    communities,
    threads,
    findCommunity,
    replies,
  } = useForumsPhaseOneData();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('posts');
  const [postFilter, setPostFilter] = useState<PostFilter>('all');

  const ownCommunityList = communities.filter((community) =>
    SAMPLE_MEMBERS.some(
      (member) =>
        member.communityId === community.id &&
        member.profileId === currentProfile.id &&
        member.status === 'active',
    ),
  );

  const ownPosts = useMemo(() => {
    const mine = threads
      .filter((thread) => thread.authorId === currentProfile.id)
      .map((thread) => ({
        thread,
        community: findCommunity(thread.communityId),
        author: currentProfile,
      }));
    return mine.filter((item) => {
      if (postFilter === 'pinned') return item.thread.isPinned;
      if (postFilter === 'popular') return item.thread.voteScore >= 25;
      return true;
    });
  }, [currentProfile, findCommunity, postFilter, threads]);

  const ownReplies = useMemo(() => {
    return replies
      .filter((reply) => reply.authorId === currentProfile.id)
      .map((reply) => {
        const thread = threads.find((item) => item.id === reply.threadId) ?? SAMPLE_THREADS[0];
        return {
          reply,
          thread,
          community: findCommunity(thread.communityId),
          author: currentProfile,
        };
      });
  }, [currentProfile, findCommunity, replies, threads]);

  return (
    <ProfileSurface
      profile={currentProfile}
      stats={buildUserStats(currentProfile, ownCommunityList.length)}
      badges={BADGES_BY_PROFILE[currentProfile.id] ?? []}
      communityCount={ownCommunityList.length}
      isOwnProfile
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      postFilter={postFilter}
      setPostFilter={setPostFilter}
      posts={ownPosts}
      replies={ownReplies}
      communities={ownCommunityList}
      following={false}
      onEdit={() => router.push('/(forums)/edit-profile' as never)}
    />
  );
}

export function ForumsUserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const {
    communities,
    threads,
    replies,
    followingProfileIds,
    findCommunity,
    findProfile,
    toggleFollow,
    startConversationWith,
  } = useForumsPhaseOneData();
  const profile = findProfile(getParamValue(params.profileId));
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('posts');
  const [postFilter, setPostFilter] = useState<PostFilter>('all');

  const userCommunityList = communities.filter((community) =>
    SAMPLE_MEMBERS.some(
      (member) =>
        member.communityId === community.id &&
        member.profileId === profile.id &&
        member.status === 'active',
    ),
  );

  const posts = useMemo(() => {
    const userPosts = threads
      .filter((thread) => thread.authorId === profile.id)
      .map((thread) => ({
        thread,
        community: findCommunity(thread.communityId),
        author: profile,
      }));

    return userPosts.filter((item) => {
      if (postFilter === 'pinned') return item.thread.isPinned;
      if (postFilter === 'popular') return item.thread.voteScore >= 25;
      return true;
    });
  }, [findCommunity, postFilter, profile, threads]);

  const userReplies = useMemo(() => {
    return replies
      .filter((reply) => reply.authorId === profile.id)
      .map((reply) => {
        const thread = threads.find((item) => item.id === reply.threadId) ?? SAMPLE_THREADS[0];
        return {
          reply,
          thread,
          community: findCommunity(thread.communityId),
          author: profile,
        };
      });
  }, [findCommunity, profile, replies, threads]);

  return (
    <ProfileSurface
      profile={profile}
      stats={buildUserStats(profile, userCommunityList.length)}
      badges={BADGES_BY_PROFILE[profile.id] ?? []}
      communityCount={userCommunityList.length}
      isOwnProfile={profile.id === LOCAL_PROFILE_ID}
      following={followingProfileIds.has(profile.id)}
      onEdit={() => router.push('/(forums)/edit-profile' as never)}
      onToggleFollow={() => toggleFollow(profile.id)}
      onMessage={() => {
        const conversationId = startConversationWith(profile);
        if (conversationId) {
          router.push(
            `/(forums)/conversation?conversationId=${encodeURIComponent(conversationId)}` as never,
          );
        }
      }}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      postFilter={postFilter}
      setPostFilter={setPostFilter}
      posts={posts}
      replies={userReplies}
      communities={userCommunityList}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FR_SURFACES.lowest,
  },
  screenContent: {
    paddingBottom: 176,
  },
  stickyHeaderHost: {
    backgroundColor: FR_SURFACES.lowest,
  },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 14,
  },
  headerStack: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerCopy: {
    gap: 2,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FR_ACCENT,
  },
  headerAvatarText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  brandEyebrow: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  brandTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_ACCENT_LIGHT,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroPanel: {
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...FR_TYPOGRAPHY.displayLg,
    color: FR_TEXT,
    fontSize: 34,
    lineHeight: 36,
  },
  heroSubtitle: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleCardActive: {
    backgroundColor: 'rgba(124,77,255,0.18)',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  toggleSubtitle: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  chipRail: {
    gap: 10,
  },
  microChipRail: {
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: FR_SURFACES.high,
  },
  filterChipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: FR_ACCENT,
  },
  filterChipText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: FR_ON_ACCENT,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#30D158',
  },
  liveBadgeText: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  bodyStack: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 24,
  },
  sectionStack: {
    gap: 14,
  },
  horizontalCards: {
    gap: 14,
  },
  horizontalCardItem: {
    width: 320,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FR_ACCENT,
  },
  bannerButtonText: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_ON_ACCENT,
  },
  paginationCard: {
    alignItems: 'center',
  },
  paginationText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionLink: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  emptyPanel: {
    alignItems: 'center',
    gap: 12,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,77,255,0.12)',
  },
  emptyTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    textAlign: 'center',
  },
  emptyDetail: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  inlineAccentButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(124,77,255,0.14)',
  },
  inlineAccentButtonText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  communitySectionCard: {
    gap: 10,
  },
  communityTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  metaBadgePurple: {
    backgroundColor: 'rgba(124,77,255,0.16)',
  },
  metaBadgeBlue: {
    backgroundColor: 'rgba(139,207,240,0.12)',
  },
  metaBadgeText: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
  discoverCardWrap: {
    width: 280,
    gap: 10,
  },
  trendingRowCard: {
    padding: 0,
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  trendingMetricWrap: {
    width: 62,
    alignItems: 'center',
    gap: 4,
  },
  trendingMetricValue: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_ACCENT_LIGHT,
  },
  trendingMetricLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  trendingCopy: {
    flex: 1,
    gap: 6,
  },
  trendingTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  trendingSubtitle: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  searchResultStack: {
    gap: 10,
  },
  searchSnippetCard: {
    marginTop: -2,
  },
  searchSnippetText: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  highlightText: {
    color: FR_ACCENT_LIGHT,
  },
  replySearchCard: {
    gap: 10,
  },
  replyBreadcrumb: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_TERTIARY,
  },
  replySearchBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
  },
  replySearchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  replySearchMeta: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
    flex: 1,
  },
  searchUserCard: {
    gap: 10,
  },
  savedRowCard: {
    padding: 0,
  },
  savedRowPressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  savedRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,77,255,0.12)',
  },
  savedRowCopy: {
    flex: 1,
    gap: 6,
  },
  savedRowTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  savedRowMeta: {
    gap: 8,
  },
  savedRowSubtitle: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  savedRowMetrics: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  savedRowBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  savedRowRemove: {
    paddingTop: 6,
  },
  groupTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  replyContextCard: {
    gap: 16,
  },
  profileScreen: {
    flex: 1,
    backgroundColor: FR_SURFACES.lowest,
  },
  profileContent: {
    paddingBottom: 160,
    gap: 0,
  },
  profileTopChrome: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileChromeLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  coverHero: {
    height: 208,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  coverEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  coverStatus: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_ON_ACCENT,
    marginTop: 6,
  },
  profileCardStack: {
    marginTop: -38,
    paddingHorizontal: 16,
    gap: 16,
  },
  profileActionsCard: {
    gap: 16,
  },
  profileActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryActionButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FR_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  secondaryActionButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  profileMetaStack: {
    gap: 10,
  },
  profileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  profileMetaText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  profileBio: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    minWidth: 88,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 2,
  },
  metricValue: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  metricLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  trustCard: {
    gap: 14,
  },
  trustDetailStack: {
    gap: 12,
  },
  trustBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  tabsCard: {
    gap: 16,
  },
  profileSectionStack: {
    gap: 14,
  },
  replyContextWrap: {
    gap: 8,
  },
  profileCommunityRow: {
    gap: 10,
  },
  aboutCard: {
    gap: 10,
  },
  sectionEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  sectionTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    marginTop: 4,
  },
  aboutBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
  },
  aboutMeta: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  badgeFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badgeTokenIcon: {
    fontSize: 16,
  },
  badgeTokenText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT,
  },
});
