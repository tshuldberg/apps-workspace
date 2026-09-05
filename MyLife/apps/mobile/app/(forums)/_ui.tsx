import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateFAB,
  GlassCard,
  HumanVerifiedBadge,
  MaterialSymbol,
  SearchBar,
  deleteCachedBookmark,
  formatMessagePreview,
  getCachedBookmarks,
  getCachedCommunities,
  getCachedCommunityById,
  getCachedCommunityMembers,
  getCachedConversations,
  getCachedMessages,
  getCachedProfileById,
  getCachedProfileByUserId,
  getCachedReplies,
  getCachedTags,
  getCachedThreadById,
  getCachedThreads,
  type Bookmark,
  type Community,
  type CommunityHealth,
  type CommunityMember,
  type Conversation,
  type DatabaseAdapter as ForumsDatabaseAdapter,
  type DirectMessage,
  type ForumTrustTier,
  getCharacterCountInfo,
  type Reply,
  type Tag,
  type Thread,
  type UserProfile,
  sortConversationsByLastMessage,
  upsertCachedBookmark,
  upsertCachedCommunity,
  upsertCachedCommunityMember,
  upsertCachedConversation,
  upsertCachedMessage,
  upsertCachedProfile,
  upsertCachedReply,
  upsertCachedTag,
  upsertCachedThread,
} from '@mylife/forums';
import {
  Card,
  Text,
  borderRadius,
  colors,
  glass,
  spacing,
} from '@mylife/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#7C4DFF';
const LOCAL_USER_ID = '11111111-1111-4111-8111-111111111111';
const LOCAL_PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const CREATIVE_COMMUNITY_ID = '33333333-3333-4333-8333-333333333333';
const DEV_COMMUNITY_ID = '44444444-4444-4444-8444-444444444444';
const LOCAL_COMMUNITY_ID = '55555555-5555-4555-8555-555555555555';
const THREAD_ONE_ID = '66666666-6666-4666-8666-666666666661';
const THREAD_TWO_ID = '66666666-6666-4666-8666-666666666662';
const THREAD_THREE_ID = '66666666-6666-4666-8666-666666666663';
const THREAD_FOUR_ID = '66666666-6666-4666-8666-666666666664';

type ActivityType = 'reply' | 'mention' | 'milestone' | 'follow';

type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  threadId: string;
  createdAt: string;
  unread: boolean;
};

type BadgeItem = {
  id: string;
  icon: string;
  label: string;
};

type ModLogItem = {
  id: string;
  communityId: string;
  actionType: 'Removed' | 'Warned' | 'Banned' | 'Muted' | 'Pinned' | 'Locked';
  moderatorName: string;
  target: string;
  reason: string;
  createdAt: string;
};

type ConversationRequestState = 'none' | 'incoming' | 'outgoing';
type ConversationFilter = 'all' | 'unread' | 'humans' | 'requests';
type RecipientFilter = 'all' | 'humans' | 'recent';
type AttachmentKind = 'text' | 'image' | 'voice' | 'link';

type ConversationUiState = {
  conversationId: string;
  participantProfileId: string | null;
  channelType: 'direct' | 'group';
  humansOnly: boolean;
  unreadCount: number;
  online: boolean;
  archived: boolean;
  requestState: ConversationRequestState;
  fingerprint: string;
  fingerprintVerified: boolean;
  typingLabel: string | null;
};

type MessageAttachmentState = {
  kind: AttachmentKind;
  durationSeconds?: number;
  waveform?: number[];
  imagePalette?: [string, string];
  imageLabel?: string;
  linkTitle?: string;
  linkHost?: string;
  linkSummary?: string;
};

function toForumsDb(db: DatabaseAdapter): ForumsDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
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

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function initials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const SAMPLE_COMMUNITIES: Community[] = [
  {
    id: CREATIVE_COMMUNITY_ID,
    creatorId: LOCAL_USER_ID,
    name: 'design-club',
    displayName: 'Design Club',
    description: 'Critiques, inspiration drops, and practical UI teardown threads.',
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
    description: 'Build logs, release notes, and honest postmortems from product teams.',
    iconUrl: null,
    bannerUrl: null,
    communityType: 'public',
    humansOnly: true,
    linkedModuleId: null,
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
    description: 'Neighborhood recommendations, quick asks, and meetup threads.',
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
];

const SAMPLE_PROFILES: UserProfile[] = [
  {
    id: LOCAL_PROFILE_ID,
    userId: LOCAL_USER_ID,
    displayName: 'Trey Stone',
    username: 'treystone',
    bio: 'Designing product systems, documenting edge cases, and keeping community spaces usable.',
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
    id: '77777777-7777-4777-8777-777777777771',
    userId: '88888888-8888-4888-8888-888888888881',
    displayName: 'Maya Chen',
    username: 'maya-chen',
    bio: 'Product designer collecting community rituals and interface patterns.',
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
    id: '77777777-7777-4777-8777-777777777772',
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
    id: '77777777-7777-4777-8777-777777777773',
    userId: '88888888-8888-4888-8888-888888888883',
    displayName: 'Nina Alvarez',
    username: 'nina-alvarez',
    bio: 'Community builder and moderation nerd.',
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
    authorId: '77777777-7777-4777-8777-777777777771',
    title: 'What actually makes a community feed feel alive instead of noisy?',
    body: 'I have been comparing high-trust forums lately. The strongest ones reward context, not just recency. Curious what patterns other people use when they want a feed to feel active without becoming chaos.',
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
    authorId: '77777777-7777-4777-8777-777777777772',
    title: 'Offline caching pitfalls when messages and thread state both mutate locally',
    body: 'We solved our stale thread counts, but direct messages still race when the same conversation is opened on two devices. Posting the flow we used to reconcile local snapshots with cloud timestamps.',
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
    title: 'Best low-key Saturday coffee spots with room to work for two hours',
    body: 'Looking for places with stable Wi-Fi, decent light, and enough space to sit without feeling like I am camping a table. Bonus points if they stay calm after 10am.',
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
    authorId: '77777777-7777-4777-8777-777777777773',
    title: 'Moderator checklist for launching a humans-only niche forum',
    body: 'I drafted a starter checklist covering verification prompts, welcome posts, moderation expectations, and transparent public logs. Sharing for feedback before I turn it into a reusable template.',
    status: 'open',
    isPinned: false,
    voteScore: 71,
    replyCount: 7,
    viewCount: 260,
    createdAt: '2026-04-03T16:20:00.000Z',
    updatedAt: '2026-04-03T16:20:00.000Z',
  },
];

const SAMPLE_REPLIES: Reply[] = [
  {
    id: '99999999-9999-4999-8999-999999999991',
    threadId: THREAD_ONE_ID,
    parentReplyId: null,
    authorId: LOCAL_PROFILE_ID,
    body: 'Strong community feeds usually have visible norms. When users can tell what kind of reply belongs, the thread quality stays high.',
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
    authorId: '77777777-7777-4777-8777-777777777771',
    body: 'Yes. The best threads read like people are collaborating, not competing for visibility.',
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
    authorId: '77777777-7777-4777-8777-777777777773',
    body: 'We ended up treating optimistic counts as temporary UI state and reconciling them against the latest persisted reply index.',
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
    authorId: '77777777-7777-4777-8777-777777777772',
    body: 'Found Coffee Project in Echo Park reliable on Saturdays. Back patio is quiet and they do not hover.',
    voteScore: 9,
    depth: 0,
    status: 'open',
    createdAt: '2026-04-03T19:10:00.000Z',
    updatedAt: '2026-04-03T19:10:00.000Z',
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
    profileId: '77777777-7777-4777-8777-777777777771',
    role: 'moderator',
    status: 'active',
    joinedAt: '2026-03-12T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    communityId: DEV_COMMUNITY_ID,
    profileId: '77777777-7777-4777-8777-777777777772',
    role: 'moderator',
    status: 'active',
    joinedAt: '2026-03-18T08:00:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    communityId: LOCAL_COMMUNITY_ID,
    profileId: LOCAL_PROFILE_ID,
    role: 'member',
    status: 'active',
    joinedAt: '2026-03-24T08:00:00.000Z',
  },
];

const SAMPLE_TAGS: Tag[] = [
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', communityId: CREATIVE_COMMUNITY_ID, name: 'ux', color: '#7C4DFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', communityId: CREATIVE_COMMUNITY_ID, name: 'critique', color: '#9F7CFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', communityId: DEV_COMMUNITY_ID, name: 'offline', color: '#7C4DFF' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', communityId: LOCAL_COMMUNITY_ID, name: 'recommendations', color: '#7C4DFF' },
];

const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    title: 'Maya Chen',
    isGroup: false,
    createdBy: LOCAL_USER_ID,
    lastMessageAt: '2026-04-04T10:28:00.000Z',
    lastMessagePreview: 'Voice note · 0:18',
    createdAt: '2026-04-04T09:40:00.000Z',
    updatedAt: '2026-04-04T10:28:00.000Z',
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    title: 'Nina Alvarez',
    isGroup: false,
    createdBy: LOCAL_USER_ID,
    lastMessageAt: '2026-04-03T18:20:00.000Z',
    lastMessagePreview: 'Public mod logs are worth the extra work.',
    createdAt: '2026-04-03T17:00:00.000Z',
    updatedAt: '2026-04-03T18:20:00.000Z',
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    title: 'Leo Park',
    isGroup: false,
    createdBy: '88888888-8888-4888-8888-888888888882',
    lastMessageAt: '2026-04-04T06:18:00.000Z',
    lastMessagePreview: 'Conversation request: compare sync notes?',
    createdAt: '2026-04-04T06:18:00.000Z',
    updatedAt: '2026-04-04T06:18:00.000Z',
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    title: 'Moderator Circle',
    isGroup: true,
    createdBy: '88888888-8888-4888-8888-888888888883',
    lastMessageAt: '2026-04-03T14:05:00.000Z',
    lastMessagePreview: 'Nina: Review the humans-only rollout copy before noon.',
    createdAt: '2026-04-03T12:05:00.000Z',
    updatedAt: '2026-04-03T14:05:00.000Z',
  },
];

const SAMPLE_MESSAGES: DirectMessage[] = [
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    senderId: LOCAL_USER_ID,
    body: 'Did you end up posting the design review notes?',
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-04T09:42:00.000Z',
    updatedAt: '2026-04-04T09:42:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    senderId: '88888888-8888-4888-8888-888888888881',
    body: 'Yep. I linked it from the Design Club thread and added screenshots.',
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-04T10:20:00.000Z',
    updatedAt: '2026-04-04T10:20:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    senderId: '88888888-8888-4888-8888-888888888881',
    body: 'https://mylife.app/forums/design-club/review-system',
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-04T10:22:00.000Z',
    updatedAt: '2026-04-04T10:22:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    senderId: LOCAL_USER_ID,
    body: 'Dropping the mobile capture too so you can sanity-check spacing.',
    mediaUrl: 'local://capture/design-club-mobile.png',
    mediaType: 'image',
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-04T10:25:00.000Z',
    updatedAt: '2026-04-04T10:25:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    senderId: '88888888-8888-4888-8888-888888888881',
    body: 'Voice note',
    mediaUrl: 'local://voice/maya-review.m4a',
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-04T10:28:00.000Z',
    updatedAt: '2026-04-04T10:28:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    senderId: '88888888-8888-4888-8888-888888888883',
    body: 'Public mod logs are worth the extra work.',
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-03T18:20:00.000Z',
    updatedAt: '2026-04-03T18:20:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee7',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    senderId: '88888888-8888-4888-8888-888888888882',
    body: 'Hey Trey, I have a cleaner sync strategy for offline timestamps. Want to compare notes?',
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-04T06:18:00.000Z',
    updatedAt: '2026-04-04T06:18:00.000Z',
  },
  {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee8',
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    senderId: '88888888-8888-4888-8888-888888888883',
    body: 'Review the humans-only rollout copy before noon.',
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-04-03T14:05:00.000Z',
    updatedAt: '2026-04-03T14:05:00.000Z',
  },
];

const SAMPLE_MESSAGE_ATTACHMENTS: Record<string, MessageAttachmentState> = {
  ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3']: {
    kind: 'link',
    linkTitle: 'Design Club Review System',
    linkHost: 'mylife.app',
    linkSummary: 'Thread preview covering mobile spacing, moderation affordances, and a tighter reply composer.',
  },
  ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4']: {
    kind: 'image',
    imageLabel: 'Mobile review capture',
    imagePalette: ['#A78BFA', '#1F1F25'],
  },
  ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5']: {
    kind: 'voice',
    durationSeconds: 18,
    waveform: [4, 9, 12, 18, 13, 20, 11, 8, 15, 10, 6, 4],
  },
};

const SAMPLE_CONVERSATION_STATE: Record<string, ConversationUiState> = {
  ['dddddddd-dddd-4ddd-8ddd-ddddddddddd1']: {
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    participantProfileId: '77777777-7777-4777-8777-777777777771',
    channelType: 'direct',
    humansOnly: true,
    unreadCount: 3,
    online: true,
    archived: false,
    requestState: 'none',
    fingerprint: '72A4 C91E 34FD 77B2',
    fingerprintVerified: false,
    typingLabel: 'Maya is active now',
  },
  ['dddddddd-dddd-4ddd-8ddd-ddddddddddd2']: {
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    participantProfileId: '77777777-7777-4777-8777-777777777773',
    channelType: 'direct',
    humansOnly: true,
    unreadCount: 0,
    online: false,
    archived: false,
    requestState: 'none',
    fingerprint: '99BE 188C 44D1 0AE8',
    fingerprintVerified: true,
    typingLabel: null,
  },
  ['dddddddd-dddd-4ddd-8ddd-ddddddddddd3']: {
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    participantProfileId: '77777777-7777-4777-8777-777777777772',
    channelType: 'direct',
    humansOnly: true,
    unreadCount: 1,
    online: true,
    archived: false,
    requestState: 'incoming',
    fingerprint: '0CE1 821B 7DF4 11AE',
    fingerprintVerified: false,
    typingLabel: null,
  },
  ['dddddddd-dddd-4ddd-8ddd-ddddddddddd4']: {
    conversationId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    participantProfileId: null,
    channelType: 'group',
    humansOnly: true,
    unreadCount: 0,
    online: false,
    archived: false,
    requestState: 'none',
    fingerprint: '55AA 31FD 8E10 112C',
    fingerprintVerified: true,
    typingLabel: null,
  },
};

let conversationStateStore = new Map<string, ConversationUiState>(
  Object.values(SAMPLE_CONVERSATION_STATE).map((state) => [state.conversationId, { ...state }]),
);
let messageAttachmentStore = new Map<string, MessageAttachmentState>(
  Object.entries(SAMPLE_MESSAGE_ATTACHMENTS),
);
let deletedConversationIds = new Set<string>();
let deletedMessageIds = new Set<string>();

const SAMPLE_ACTIVITY: ActivityItem[] = [
  {
    id: 'activity-1',
    type: 'reply',
    title: 'Reply to your post',
    detail: 'Leo replied to your offline caching thread.',
    threadId: THREAD_TWO_ID,
    createdAt: '2026-04-04T08:00:00.000Z',
    unread: true,
  },
  {
    id: 'activity-2',
    type: 'mention',
    title: 'Mention',
    detail: 'Maya mentioned you in a design critique thread.',
    threadId: THREAD_ONE_ID,
    createdAt: '2026-04-04T06:40:00.000Z',
    unread: true,
  },
  {
    id: 'activity-3',
    type: 'milestone',
    title: 'Upvote milestone',
    detail: 'Your threads passed 1,000 combined karma.',
    threadId: THREAD_THREE_ID,
    createdAt: '2026-04-03T20:00:00.000Z',
    unread: false,
  },
  {
    id: 'activity-4',
    type: 'follow',
    title: 'New follower',
    detail: 'Nina started following your posts.',
    threadId: THREAD_FOUR_ID,
    createdAt: '2026-04-03T16:10:00.000Z',
    unread: false,
  },
];

const SAMPLE_HEALTH: CommunityHealth[] = [
  {
    communityId: CREATIVE_COMMUNITY_ID,
    verifiedHumanPercent: 92,
    avgResponseTimeMinutes: 18,
    modActionsLast30Days: 12,
    signalToNoiseScore: 8.9,
    memberCount: 1840,
    activePostersLast7Days: 216,
    computedAt: '2026-04-04T08:00:00.000Z',
  },
  {
    communityId: DEV_COMMUNITY_ID,
    verifiedHumanPercent: 96,
    avgResponseTimeMinutes: 26,
    modActionsLast30Days: 8,
    signalToNoiseScore: 9.2,
    memberCount: 920,
    activePostersLast7Days: 118,
    computedAt: '2026-04-04T08:00:00.000Z',
  },
  {
    communityId: LOCAL_COMMUNITY_ID,
    verifiedHumanPercent: 71,
    avgResponseTimeMinutes: 42,
    modActionsLast30Days: 3,
    signalToNoiseScore: 7.1,
    memberCount: 241,
    activePostersLast7Days: 52,
    computedAt: '2026-04-04T08:00:00.000Z',
  },
];

const SAMPLE_MOD_ACTIONS: ModLogItem[] = [
  {
    id: 'mod-1',
    communityId: CREATIVE_COMMUNITY_ID,
    actionType: 'Pinned',
    moderatorName: 'Maya Chen',
    target: 'What actually makes a community feed feel alive instead of noisy?',
    reason: 'Pinned as the weekly design discussion anchor.',
    createdAt: '2026-04-04T09:05:00.000Z',
  },
  {
    id: 'mod-2',
    communityId: CREATIVE_COMMUNITY_ID,
    actionType: 'Removed',
    moderatorName: 'Nina Alvarez',
    target: 'Spam portfolio link drop',
    reason: 'Repeated self-promo without context.',
    createdAt: '2026-04-03T17:10:00.000Z',
  },
  {
    id: 'mod-3',
    communityId: DEV_COMMUNITY_ID,
    actionType: 'Warned',
    moderatorName: 'Leo Park',
    target: 'Off-topic release thread',
    reason: 'Asked the author to move it into weekly shipping notes.',
    createdAt: '2026-04-03T15:50:00.000Z',
  },
];

const SAMPLE_BADGES: Record<string, BadgeItem[]> = {
  [LOCAL_PROFILE_ID]: [
    { id: 'badge-1', icon: '⚡', label: 'Fast Reply' },
    { id: 'badge-2', icon: '🧭', label: 'Guide' },
    { id: 'badge-3', icon: '🛡️', label: 'Verified' },
  ],
  ['77777777-7777-4777-8777-777777777771']: [
    { id: 'badge-4', icon: '🎨', label: 'Critique Pro' },
    { id: 'badge-5', icon: '🛡️', label: 'Moderator' },
  ],
  ['77777777-7777-4777-8777-777777777772']: [
    { id: 'badge-6', icon: '🧠', label: 'Systems Thinker' },
    { id: 'badge-7', icon: '🛡️', label: 'Verified' },
  ],
  ['77777777-7777-4777-8777-777777777773']: [
    { id: 'badge-8', icon: '🌿', label: 'Community Gardener' },
    { id: 'badge-9', icon: '🛡️', label: 'Moderator' },
  ],
};

const SAMPLE_RULES = [
  {
    id: 'rule-1',
    communityId: CREATIVE_COMMUNITY_ID,
    title: 'Post the work and the question',
    description: 'Critiques should include context and what kind of feedback you want.',
    position: 0,
  },
  {
    id: 'rule-2',
    communityId: CREATIVE_COMMUNITY_ID,
    title: 'Be specific',
    description: 'Explain what works, what breaks, and why.',
    position: 1,
  },
  {
    id: 'rule-3',
    communityId: DEV_COMMUNITY_ID,
    title: 'Share the constraint',
    description: 'If a tradeoff is driving the issue, include it in the post.',
    position: 0,
  },
  {
    id: 'rule-4',
    communityId: LOCAL_COMMUNITY_ID,
    title: 'Keep it local',
    description: 'Recommendations and requests should stay relevant to the neighborhood.',
    position: 0,
  },
];

const RECENT_SEARCHES = ['offline caching', 'moderation templates', 'coffee shops'];

function mergeById<T extends { id: string }>(sample: T[], cached: T[]): T[] {
  const merged = new Map<string, T>();
  sample.forEach((item) => merged.set(item.id, item));
  cached.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function getTrustTierForProfile(profile: UserProfile): ForumTrustTier {
  if (profile.isVerified && profile.karma >= 1200) return 'highly_trusted';
  if (profile.isVerified && profile.karma >= 700) return 'trusted';
  if (profile.isVerified) return 'new';
  return 'unverified';
}

function createConversationUiState(
  conversationId: string,
  overrides: Partial<ConversationUiState> = {},
): ConversationUiState {
  return {
    conversationId,
    participantProfileId: null,
    channelType: 'direct',
    humansOnly: false,
    unreadCount: 0,
    online: false,
    archived: false,
    requestState: 'none',
    fingerprint: '0000 0000 0000 0000',
    fingerprintVerified: false,
    typingLabel: null,
    ...overrides,
  };
}

function getConversationUiState(conversationId: string): ConversationUiState {
  return conversationStateStore.get(conversationId)
    ?? createConversationUiState(conversationId);
}

function setConversationUiState(
  conversationId: string,
  updater: Partial<ConversationUiState> | ((current: ConversationUiState) => ConversationUiState),
) {
  const current = getConversationUiState(conversationId);
  const next = typeof updater === 'function'
    ? updater(current)
    : { ...current, ...updater };
  conversationStateStore.set(conversationId, next);
  return next;
}

function deleteConversationUiState(conversationId: string) {
  conversationStateStore.delete(conversationId);
}

function getMessageAttachmentState(messageId: string): MessageAttachmentState | undefined {
  return messageAttachmentStore.get(messageId);
}

function setMessageAttachmentState(messageId: string, state: MessageAttachmentState) {
  messageAttachmentStore.set(messageId, state);
}

function deleteAttachmentStatesForMessages(messageIds: string[]) {
  messageIds.forEach((messageId) => messageAttachmentStore.delete(messageId));
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatAbsoluteTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function makeWaveform(seed: number): number[] {
  return Array.from({ length: 12 }, (_, index) => {
    const next = Math.abs(Math.sin(seed + index * 1.7));
    return Math.round(4 + next * 18);
  });
}

function seedForumsCache(db: ForumsDatabaseAdapter) {
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
  const cachedConversationIds = new Set(
    getCachedConversations(db, { limit: 200 }).map((conversation) => conversation.id),
  );
  SAMPLE_CONVERSATIONS
    .filter((conversation) =>
      !deletedConversationIds.has(conversation.id)
      && !cachedConversationIds.has(conversation.id),
    )
    .forEach((conversation) => upsertCachedConversation(db, conversation));
  const cachedMessageIds = new Set(
    SAMPLE_CONVERSATIONS.flatMap((conversation) =>
      getCachedMessages(db, conversation.id, { limit: 200 }).map((message) => message.id),
    ),
  );
  SAMPLE_MESSAGES
    .filter((message) =>
      !deletedConversationIds.has(message.conversationId)
      && !deletedMessageIds.has(message.id)
      && !cachedMessageIds.has(message.id),
    )
    .forEach((message) => upsertCachedMessage(db, message));
  if (getCachedCommunityMembers(db, CREATIVE_COMMUNITY_ID).length === 0) {
    SAMPLE_MEMBERS.forEach((member) => upsertCachedCommunityMember(db, member));
  }
  if (getCachedTags(db, CREATIVE_COMMUNITY_ID, { limit: 1 }).length === 0) {
    SAMPLE_TAGS.forEach((tag) => upsertCachedTag(db, tag));
  }
}

export function useForumsData() {
  const hubDb = useDatabase();
  const db = useMemo(() => toForumsDb(hubDb), [hubDb]);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const communities = useMemo(() => {
    const cached = getCachedCommunities(db, { limit: 50 });
    return cached.length > 0 ? cached : SAMPLE_COMMUNITIES;
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
    return profiles.find((profile) => profile.userId === LOCAL_USER_ID) ?? SAMPLE_PROFILES[0];
  }, [profiles]);

  const threads = useMemo(() => {
    const cached = communities.flatMap((community) => getCachedThreads(db, community.id, { limit: 60 }));
    if (cached.length > 0) {
      return cached
        .slice()
        .sort((left, right) => {
          if (left.isPinned !== right.isPinned) {
            return Number(right.isPinned) - Number(left.isPinned);
          }
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        });
    }
    return SAMPLE_THREADS.slice().sort((left, right) => {
      if (left.isPinned !== right.isPinned) return Number(right.isPinned) - Number(left.isPinned);
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [communities, db, revision]);

  const bookmarks = useMemo(() => {
    const cached = getCachedBookmarks(db, currentProfile.id, { limit: 50 });
    return cached.length > 0 ? cached : SAMPLE_BOOKMARKS;
  }, [currentProfile.id, db, revision]);

  const conversations = useMemo(() => {
    const cached = getCachedConversations(db, { limit: 50 });
    const merged = mergeById(SAMPLE_CONVERSATIONS, cached).filter(
      (conversation) =>
        !deletedConversationIds.has(conversation.id)
        && !getConversationUiState(conversation.id).archived,
    );
    return sortConversationsByLastMessage(merged) as Conversation[];
  }, [db, revision]);

  const findCommunity = useCallback((communityId?: string | null) => {
    return getCachedCommunityById(db, communityId ?? '') ?? communities.find((community) => community.id === communityId) ?? communities[0] ?? SAMPLE_COMMUNITIES[0];
  }, [communities, db]);

  const findThread = useCallback((threadId?: string | null) => {
    return getCachedThreadById(db, threadId ?? '') ?? threads.find((thread) => thread.id === threadId) ?? threads[0] ?? SAMPLE_THREADS[0];
  }, [db, threads]);

  const findProfile = useCallback((profileId?: string | null) => {
    return getCachedProfileById(db, profileId ?? '') ?? profiles.find((profile) => profile.id === profileId) ?? currentProfile;
  }, [currentProfile, db, profiles]);

  const repliesForThread = useCallback((threadId: string) => {
    const cached = getCachedReplies(db, threadId, { limit: 80 });
    const rows = cached.length > 0 ? cached : SAMPLE_REPLIES.filter((reply) => reply.threadId === threadId);
    return rows.slice().sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [db, revision]);

  const membersForCommunity = useCallback((communityId: string) => {
    const cached = getCachedCommunityMembers(db, communityId);
    return cached.length > 0 ? cached : SAMPLE_MEMBERS.filter((member) => member.communityId === communityId);
  }, [db, revision]);

  const tagsForCommunity = useCallback((communityId: string) => {
    const cached = getCachedTags(db, communityId, { limit: 30 });
    return cached.length > 0 ? cached : SAMPLE_TAGS.filter((tag) => tag.communityId === communityId);
  }, [db, revision]);

  const rulesForCommunity = useCallback((communityId: string) => {
    return SAMPLE_RULES.filter((rule) => rule.communityId === communityId).sort((left, right) => left.position - right.position);
  }, []);

  const messagesForConversation = useCallback((conversationId: string) => {
    const cached = getCachedMessages(db, conversationId, { limit: 80 });
    const rows = mergeById(
      SAMPLE_MESSAGES.filter((message) => message.conversationId === conversationId),
      cached,
    ).filter((message) => !deletedMessageIds.has(message.id));
    return rows.slice().sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [db, revision]);

  const getConversationStateById = useCallback((conversationId: string) => {
    const existing = conversationStateStore.get(conversationId);
    if (existing) {
      return existing;
    }

    const conversation = conversations.find((item) => item.id === conversationId);
    const matchedProfile = profiles.find((profile) => profile.displayName === conversation?.title) ?? null;
    const derived = createConversationUiState(conversationId, {
      participantProfileId: matchedProfile?.id ?? null,
      channelType: conversation?.isGroup ? 'group' : 'direct',
      humansOnly: Boolean(matchedProfile?.isVerified),
      fingerprint: `${conversationId.slice(0, 4).toUpperCase()} ${conversationId.slice(4, 8).toUpperCase()} ${conversationId.slice(8, 12).toUpperCase()} ${conversationId.slice(12, 16).toUpperCase()}`,
    });
    conversationStateStore.set(conversationId, derived);
    return derived;
  }, [conversations, profiles]);

  const findConversationByParticipant = useCallback((profileId: string) => {
    return conversations.find((conversation) => {
      const state = getConversationStateById(conversation.id);
      return state.participantProfileId === profileId;
    });
  }, [conversations, getConversationStateById]);

  const threadsForCommunity = useCallback((communityId: string) => {
    return threads.filter((thread) => thread.communityId === communityId);
  }, [threads]);

  const joinedCommunityIds = useMemo(() => {
    return new Set(
      communities
        .filter((community) =>
          membersForCommunity(community.id).some(
            (member) => member.profileId === currentProfile.id && member.status === 'active',
          ),
        )
        .map((community) => community.id),
    );
  }, [communities, currentProfile.id, membersForCommunity]);

  const toggleBookmark = useCallback((threadId: string) => {
    seedForumsCache(db);
    const existing = getCachedBookmarks(db, currentProfile.id, { limit: 100 }).find(
      (bookmark) => bookmark.threadId === threadId,
    );
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
  }, [currentProfile.id, db, refresh]);

  const toggleCommunityMembership = useCallback((communityId: string) => {
    seedForumsCache(db);
    const members = getCachedCommunityMembers(db, communityId);
    const existing = members.find(
      (member) => member.profileId === currentProfile.id && member.status === 'active',
    );
    const community = getCachedCommunityById(db, communityId) ?? findCommunity(communityId);
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
    }
    refresh();
  }, [currentProfile.id, db, findCommunity, refresh]);

  const createThread = useCallback((input: {
    communityId: string;
    title: string;
    body: string;
  }) => {
    seedForumsCache(db);
    const now = new Date().toISOString();
    const threadId = makeId('thread');
    upsertCachedThread(db, {
      id: threadId,
      communityId: input.communityId,
      authorId: currentProfile.id,
      title: input.title,
      body: input.body,
      status: 'open',
      isPinned: false,
      voteScore: 1,
      replyCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const community = getCachedCommunityById(db, input.communityId) ?? findCommunity(input.communityId);
    upsertCachedCommunity(db, {
      ...community,
      threadCount: community.threadCount + 1,
      updatedAt: now,
    });
    refresh();
    return threadId;
  }, [currentProfile.id, db, findCommunity, refresh]);

  const createCommunity = useCallback((input: {
    displayName: string;
    description: string;
    humansOnly: boolean;
  }) => {
    seedForumsCache(db);
    const now = new Date().toISOString();
    const communityId = makeId('community');
    const name = input.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || `community-${Date.now()}`;
    upsertCachedCommunity(db, {
      id: communityId,
      creatorId: currentProfile.userId,
      name,
      displayName: input.displayName,
      description: input.description || null,
      iconUrl: null,
      bannerUrl: null,
      communityType: 'public',
      humansOnly: input.humansOnly,
      linkedModuleId: null,
      memberCount: 1,
      threadCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    upsertCachedCommunityMember(db, {
      id: makeId('member'),
      communityId,
      profileId: currentProfile.id,
      role: 'owner',
      status: 'active',
      joinedAt: now,
    });
    refresh();
    return communityId;
  }, [currentProfile.id, currentProfile.userId, db, refresh]);

  const createReply = useCallback((threadId: string, body: string, parentReplyId?: string | null) => {
    seedForumsCache(db);
    const now = new Date().toISOString();
    const parent = parentReplyId ? repliesForThread(threadId).find((reply) => reply.id === parentReplyId) : undefined;
    upsertCachedReply(db, {
      id: makeId('reply'),
      threadId,
      parentReplyId: parentReplyId ?? null,
      authorId: currentProfile.id,
      body,
      voteScore: 1,
      depth: parent ? Math.min(parent.depth + 1, 3) : 0,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
    const thread = getCachedThreadById(db, threadId) ?? findThread(threadId);
    upsertCachedThread(db, {
      ...thread,
      replyCount: thread.replyCount + 1,
      updatedAt: now,
    });
    refresh();
  }, [currentProfile.id, db, findThread, refresh, repliesForThread]);

  const saveProfile = useCallback((input: {
    displayName: string;
    bio: string;
    location: string;
    websiteUrl: string;
  }) => {
    seedForumsCache(db);
    upsertCachedProfile(db, {
      ...currentProfile,
      displayName: input.displayName,
      bio: input.bio,
      location: input.location,
      websiteUrl: input.websiteUrl.trim() ? input.websiteUrl.trim() : null,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }, [currentProfile, db, refresh]);

  const markConversationRead = useCallback((conversationId: string) => {
    setConversationUiState(conversationId, { unreadCount: 0 });
    refresh();
  }, [refresh]);

  const toggleConversationUnread = useCallback((conversationId: string) => {
    const current = getConversationStateById(conversationId);
    setConversationUiState(conversationId, { unreadCount: current.unreadCount > 0 ? 0 : 1 });
    refresh();
  }, [getConversationStateById, refresh]);

  const archiveConversation = useCallback((conversationId: string) => {
    setConversationUiState(conversationId, { archived: true, unreadCount: 0 });
    refresh();
  }, [refresh]);

  const deleteConversation = useCallback((conversationId: string) => {
    const messageIds = messagesForConversation(conversationId).map((message) => message.id);
    deletedConversationIds.add(conversationId);
    messageIds.forEach((messageId) => deletedMessageIds.add(messageId));
    db.run('DELETE FROM fr_messages_cache WHERE conversation_id = ?', [conversationId]);
    db.run('DELETE FROM fr_conversations_cache WHERE id = ?', [conversationId]);
    deleteAttachmentStatesForMessages(messageIds);
    deleteConversationUiState(conversationId);
    refresh();
  }, [db, messagesForConversation, refresh]);

  const acceptConversationRequest = useCallback((conversationId: string) => {
    setConversationUiState(conversationId, (current) => ({
      ...current,
      requestState: 'none',
      unreadCount: 0,
    }));
    refresh();
  }, [refresh]);

  const declineConversationRequest = useCallback((conversationId: string) => {
    deleteConversation(conversationId);
  }, [deleteConversation]);

  const verifyConversationFingerprint = useCallback((conversationId: string) => {
    setConversationUiState(conversationId, { fingerprintVerified: true });
    refresh();
  }, [refresh]);

  const clearConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find((item) => item.id === conversationId);
    const messageIds = messagesForConversation(conversationId).map((message) => message.id);
    messageIds.forEach((messageId) => deletedMessageIds.add(messageId));
    db.run('DELETE FROM fr_messages_cache WHERE conversation_id = ?', [conversationId]);
    deleteAttachmentStatesForMessages(messageIds);
    if (conversation) {
      upsertCachedConversation(db, {
        ...conversation,
        lastMessageAt: null,
        lastMessagePreview: null,
        updatedAt: new Date().toISOString(),
      });
    }
    setConversationUiState(conversationId, { unreadCount: 0 });
    refresh();
  }, [conversations, db, messagesForConversation, refresh]);

  const sendMessage = useCallback((input: {
    conversationId?: string;
    recipientName?: string;
    recipientProfileId?: string;
    body: string;
    attachment?: MessageAttachmentState;
    requestState?: ConversationRequestState;
  }) => {
    seedForumsCache(db);
    const now = new Date().toISOString();
    const trimmedBody = input.body.trim();
    const characterInfo = getCharacterCountInfo(trimmedBody);
    if (!input.attachment && characterInfo.count === 0) {
      throw new Error('Message cannot be empty');
    }

    const existing = input.conversationId
      ? getCachedConversations(db, { limit: 100 }).find((conversation) => conversation.id === input.conversationId)
      : input.recipientProfileId
        ? findConversationByParticipant(input.recipientProfileId)
        : undefined;
    const conversationId = existing?.id ?? input.conversationId ?? makeId('conversation');
    const preview = input.attachment?.kind === 'voice'
      ? `Voice note · ${formatDuration(input.attachment.durationSeconds ?? 0)}`
      : input.attachment?.kind === 'image'
        ? input.attachment.imageLabel ?? 'Image attachment'
        : input.attachment?.kind === 'link'
          ? input.attachment.linkTitle ?? formatMessagePreview(trimmedBody)
          : formatMessagePreview(trimmedBody);
    const messageBody = trimmedBody || preview;
    const messageId = makeId('message');
    deletedConversationIds.delete(conversationId);
    deletedMessageIds.delete(messageId);

    upsertCachedConversation(db, {
      id: conversationId,
      title: existing?.title ?? input.recipientName ?? 'New Message',
      isGroup: false,
      createdBy: LOCAL_USER_ID,
      lastMessageAt: now,
      lastMessagePreview: preview,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    upsertCachedMessage(db, {
      id: messageId,
      conversationId,
      senderId: LOCAL_USER_ID,
      body: messageBody,
      mediaUrl: input.attachment?.kind === 'image' || input.attachment?.kind === 'voice'
        ? `local://${input.attachment.kind}/${messageId}`
        : null,
      mediaType: input.attachment?.kind === 'image' ? 'image' : null,
      isEdited: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
    if (input.attachment) {
      setMessageAttachmentState(messageId, input.attachment);
    }
    const recipientProfile = input.recipientProfileId
      ? findProfile(input.recipientProfileId)
      : null;
    setConversationUiState(conversationId, (current) => ({
      ...current,
      conversationId,
      participantProfileId: input.recipientProfileId ?? current.participantProfileId,
      channelType: 'direct',
      humansOnly: recipientProfile?.isVerified ?? current.humansOnly,
      online: current.online,
      archived: false,
      requestState: input.requestState ?? (current.requestState === 'incoming' ? 'none' : current.requestState),
      unreadCount: 0,
      typingLabel: null,
      fingerprint: current.fingerprint === '0000 0000 0000 0000'
        ? `${conversationId.slice(0, 4).toUpperCase()} ${conversationId.slice(4, 8).toUpperCase()} ${conversationId.slice(8, 12).toUpperCase()} ${conversationId.slice(12, 16).toUpperCase()}`
        : current.fingerprint,
    }));
    refresh();
    return conversationId;
  }, [db, findConversationByParticipant, findProfile, refresh]);

  const sendVoiceMessage = useCallback((conversationId: string, durationSeconds: number) => {
    return sendMessage({
      conversationId,
      body: '',
      attachment: {
        kind: 'voice',
        durationSeconds,
        waveform: makeWaveform(durationSeconds),
      },
    });
  }, [sendMessage]);

  return {
    db,
    refresh,
    communities,
    currentProfile,
    profiles,
    threads,
    bookmarks,
    conversations,
    joinedCommunityIds,
    findCommunity,
    findProfile,
    findThread,
    repliesForThread,
    membersForCommunity,
    tagsForCommunity,
    rulesForCommunity,
    messagesForConversation,
    getConversationStateById,
    getMessageAttachmentState,
    findConversationByParticipant,
    threadsForCommunity,
    badgesForProfile: (profileId: string) => SAMPLE_BADGES[profileId] ?? [],
    activity: SAMPLE_ACTIVITY,
    communityHealth: SAMPLE_HEALTH,
    modActions: SAMPLE_MOD_ACTIONS,
    toggleBookmark,
    toggleCommunityMembership,
    createThread,
    createCommunity,
    createReply,
    saveProfile,
    markConversationRead,
    toggleConversationUnread,
    archiveConversation,
    deleteConversation,
    acceptConversationRequest,
    declineConversationRequest,
    verifyConversationFingerprint,
    clearConversation,
    sendMessage,
    sendVoiceMessage,
  };
}

function ScreenScaffold({
  title,
  subtitle,
  children,
  fabLabel,
  onFabPress,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  fabLabel?: string;
  onFabPress?: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text variant="caption" color={ACCENT}>HUMANS ONLY BY DESIGN</Text>
          </View>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="body" color={colors.textSecondary} style={styles.heroText}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {fabLabel && onFabPress ? (
        <Pressable style={styles.fab} onPress={onFabPress}>
          <Text variant="body" color="#FFFFFF" style={styles.fabText}>
            {fabLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text variant="caption" color={active ? '#FFFFFF' : colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="subheading" color={ACCENT}>{value}</Text>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text variant="subheading">{title}</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.centerText}>
        {detail}
      </Text>
    </Card>
  );
}

function ProfileAvatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text variant="caption" color="#FFFFFF">{initials(name)}</Text>
    </View>
  );
}

function ThreadCard({
  thread,
  communityName,
  authorName,
  saved,
  onPress,
  onToggleSaved,
}: {
  thread: Thread;
  communityName: string;
  authorName: string;
  saved?: boolean;
  onPress?: () => void;
  onToggleSaved?: () => void;
}) {
  return (
    <Pressable style={styles.threadCard} onPress={onPress}>
      <View style={styles.voteRail}>
        <Text variant="caption" color={colors.textTertiary}>▲</Text>
        <Text variant="caption" color={ACCENT}>{String(thread.voteScore)}</Text>
        <Text variant="caption" color={colors.textTertiary}>▼</Text>
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={styles.rowWrap}>
          {thread.isPinned ? (
            <View style={styles.pinnedBadge}>
              <Text variant="caption" color={ACCENT}>Pinned</Text>
            </View>
          ) : null}
          <View style={styles.communityPill}>
            <Text variant="caption" color={ACCENT}>{communityName}</Text>
          </View>
        </View>
        <Text variant="subheading">{thread.title}</Text>
        <Text variant="body" color={colors.textSecondary} numberOfLines={2}>
          {thread.body}
        </Text>
        <View style={styles.spaceBetween}>
          <Text variant="caption" color={colors.textSecondary}>
            {authorName} ✓ · {formatRelativeTime(thread.createdAt)}
          </Text>
          <Text variant="caption" color={colors.textTertiary}>
            💬 {thread.replyCount}
          </Text>
        </View>
        {onToggleSaved ? (
          <Pressable style={styles.inlineButton} onPress={onToggleSaved}>
            <Text variant="caption" color={ACCENT}>{saved ? 'Remove Bookmark' : 'Save Thread'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function ReplyBranch({
  replies,
  parentReplyId,
  findProfile,
}: {
  replies: Reply[];
  parentReplyId: string | null;
  findProfile: (profileId?: string | null) => UserProfile;
}) {
  return (
    <>
      {replies
        .filter((reply) => (reply.parentReplyId ?? null) === parentReplyId)
        .map((reply) => {
          const author = findProfile(reply.authorId);
          return (
            <View key={reply.id} style={[styles.replyCard, { marginLeft: Math.min(reply.depth, 3) * 14 }]}>
              <View style={styles.replyHeader}>
                <ProfileAvatar name={author.displayName} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="caption" color={colors.text}>
                    {author.displayName} ✓
                  </Text>
                  <Text variant="caption" color={colors.textTertiary}>
                    {formatRelativeTime(reply.createdAt)}
                  </Text>
                </View>
                <Text variant="caption" color={ACCENT}>▲ {reply.voteScore}</Text>
              </View>
              <Text variant="body">{reply.body}</Text>
              <ReplyBranch replies={replies} parentReplyId={reply.id} findProfile={findProfile} />
            </View>
          );
        })}
    </>
  );
}

export function ForumsFeedScreen() {
  const router = useRouter();
  const { threads, findCommunity, findProfile, bookmarks, toggleBookmark } = useForumsData();

  return (
    <ScreenScaffold
      title="Forum Feed"
      subtitle="Real-time thread cards, human verification badges, and quick thread creation while the cached data layer stays intact."
      fabLabel="+ Thread"
      onFabPress={() => router.push('/(forums)/create-thread' as never)}
    >
      <View style={styles.rowWrap}>
        <Chip label="Following" active />
        <Chip label="Latest" />
        <Chip label="Pinned" />
        <Chip label="Activity" onPress={() => router.push('/(forums)/activity-feed' as never)} />
      </View>
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          communityName={findCommunity(thread.communityId).displayName}
          authorName={findProfile(thread.authorId).displayName}
          saved={bookmarks.some((bookmark) => bookmark.threadId === thread.id)}
          onToggleSaved={() => toggleBookmark(thread.id)}
          onPress={() => router.push(`/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never)}
        />
      ))}
    </ScreenScaffold>
  );
}

export function ForumsCommunitiesScreen() {
  const router = useRouter();
  const { communities, joinedCommunityIds, toggleCommunityMembership, tagsForCommunity } = useForumsData();
  const [query, setQuery] = useState('');

  const visibleCommunities = useMemo(() => {
    return communities.filter((community) =>
      `${community.displayName} ${community.description ?? ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  }, [communities, query]);

  const joined = visibleCommunities.filter((community) => joinedCommunityIds.has(community.id));
  const discover = visibleCommunities.filter((community) => !joinedCommunityIds.has(community.id));

  return (
    <ScreenScaffold
      title="Communities"
      subtitle="Directory, join states, and humans-only signals organized around your active spaces and new places to discover."
      fabLabel="+ Community"
      onFabPress={() => router.push('/(forums)/create-community' as never)}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search communities"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
      />

      <Text variant="label" color={colors.textSecondary}>Your Communities</Text>
      {joined.length === 0 ? (
        <EmptyState icon="👥" title="No communities joined yet" detail="Join a community to personalize your feed." />
      ) : (
        joined.map((community) => (
          <Card key={community.id} style={styles.inlineCard}>
            <View style={styles.spaceBetween}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <View style={styles.rowWrap}>
                  <Text variant="subheading">{community.displayName}</Text>
                  {community.humansOnly ? (
                    <View style={styles.communityPill}>
                      <Text variant="caption" color={ACCENT}>Humans Only</Text>
                    </View>
                  ) : null}
                </View>
                <Text variant="body" color={colors.textSecondary}>{community.description ?? 'No description yet.'}</Text>
                <Text variant="caption" color={colors.textTertiary}>
                  {community.memberCount} members · {community.threadCount} threads
                </Text>
                <View style={styles.chipRow}>
                  {tagsForCommunity(community.id).map((tag) => (
                    <Chip key={tag.id} label={tag.name} />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.rowWrap}>
              <Pressable style={styles.primaryButtonSmall} onPress={() => router.push(`/(forums)/community-detail?communityId=${encodeURIComponent(community.id)}` as never)}>
                <Text variant="caption" color="#FFFFFF">Open</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => toggleCommunityMembership(community.id)}>
                <Text variant="caption" color={ACCENT}>Leave</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <Text variant="label" color={colors.textSecondary}>Discover</Text>
      {discover.map((community) => (
        <Card key={community.id} style={styles.inlineCard}>
          <View style={styles.spaceBetween}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="subheading">{community.displayName}</Text>
              <Text variant="body" color={colors.textSecondary}>{community.description ?? 'No description yet.'}</Text>
              <Text variant="caption" color={colors.textTertiary}>
                {community.memberCount} members · {community.threadCount} threads
              </Text>
            </View>
            {community.humansOnly ? (
              <View style={styles.communityPill}>
                <Text variant="caption" color={ACCENT}>🛡️</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.rowWrap}>
            <Pressable style={styles.primaryButtonSmall} onPress={() => toggleCommunityMembership(community.id)}>
              <Text variant="caption" color="#FFFFFF">Join</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(forums)/community-detail?communityId=${encodeURIComponent(community.id)}` as never)}>
              <Text variant="caption" color={ACCENT}>Preview</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

export function ForumsSearchScreen() {
  const router = useRouter();
  const { communities, threads, profiles, findCommunity } = useForumsData();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'threads' | 'replies' | 'communities' | 'users'>('threads');

  const visibleResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    if (scope === 'communities') {
      return communities
        .filter((community) => `${community.displayName} ${community.description ?? ''}`.toLowerCase().includes(needle))
        .map((community) => ({
          id: community.id,
          title: community.displayName,
          detail: community.description ?? 'Community',
          route: `/(forums)/community-detail?communityId=${encodeURIComponent(community.id)}`,
        }));
    }
    if (scope === 'users') {
      return profiles
        .filter((profile) => `${profile.displayName} ${profile.username}`.toLowerCase().includes(needle))
        .map((profile) => ({
          id: profile.id,
          title: profile.displayName,
          detail: `@${profile.username} · ${profile.karma} karma`,
          route: `/(forums)/user-profile?profileId=${encodeURIComponent(profile.id)}`,
        }));
    }
    return threads
      .filter((thread) => `${thread.title} ${thread.body}`.toLowerCase().includes(needle))
      .map((thread) => ({
        id: thread.id,
        title: thread.title,
        detail: `${findCommunity(thread.communityId).displayName} · ${formatRelativeTime(thread.createdAt)}`,
        route: `/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}`,
      }));
  }, [communities, findCommunity, profiles, query, scope, threads]);

  return (
    <ScreenScaffold
      title="Search"
      subtitle="Threads, communities, and people can all be searched from one sharper entry point with scope pills and recent terms."
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search threads, replies, and communities"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
      />
      <View style={styles.chipRow}>
        <Chip label="Threads" active={scope === 'threads'} onPress={() => setScope('threads')} />
        <Chip label="Replies" active={scope === 'replies'} onPress={() => setScope('replies')} />
        <Chip label="Communities" active={scope === 'communities'} onPress={() => setScope('communities')} />
        <Chip label="Users" active={scope === 'users'} onPress={() => setScope('users')} />
      </View>

      {query.trim().length === 0 ? (
        <>
          <EmptyState icon="🔎" title="Search threads, replies, and communities" detail="Recent searches stick around here until you type again." />
          <Text variant="label" color={colors.textSecondary}>Recent Searches</Text>
          {RECENT_SEARCHES.map((item) => (
            <Pressable key={item} style={styles.settingRow} onPress={() => setQuery(item)}>
              <Text variant="body">{item}</Text>
              <Text variant="caption" color={ACCENT}>Run</Text>
            </Pressable>
          ))}
        </>
      ) : visibleResults.length === 0 ? (
        <EmptyState icon="🧭" title="No matches yet" detail="Try a broader keyword or switch the search scope." />
      ) : (
        visibleResults.map((result) => (
          <Pressable key={result.id} style={styles.settingRow} onPress={() => router.push(result.route as never)}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="subheading">{result.title}</Text>
              <Text variant="caption" color={colors.textSecondary}>{result.detail}</Text>
            </View>
            <View style={styles.relevanceBar}>
              <View style={styles.relevanceFill} />
            </View>
          </Pressable>
        ))
      )}
    </ScreenScaffold>
  );
}

export function ForumsSavedScreen() {
  const router = useRouter();
  const { bookmarks, findThread, findCommunity, findProfile, toggleBookmark } = useForumsData();

  const grouped = useMemo(() => {
    const map = new Map<string, Bookmark[]>();
    bookmarks.forEach((bookmark) => {
      const thread = findThread(bookmark.threadId);
      const current = map.get(thread.communityId) ?? [];
      current.push(bookmark);
      map.set(thread.communityId, current);
    });
    return Array.from(map.entries());
  }, [bookmarks, findThread]);

  if (grouped.length === 0) {
    return (
      <ScreenScaffold title="Saved Threads" subtitle="Bookmarks stay grouped by community and remain available while offline.">
        <EmptyState icon="🔖" title="No saved threads yet" detail="Bookmark a thread from the feed to find it here later." />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title="Saved Threads" subtitle="Bookmarks grouped by community with quick remove actions and thread previews.">
      {grouped.map(([communityId, items]) => (
        <View key={communityId} style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.textSecondary}>
            {findCommunity(communityId).displayName} · {items.length}
          </Text>
          {items.map((bookmark) => {
            const thread = findThread(bookmark.threadId);
            return (
              <ThreadCard
                key={bookmark.id}
                thread={thread}
                communityName={findCommunity(thread.communityId).displayName}
                authorName={findProfile(thread.authorId).displayName}
                saved
                onToggleSaved={() => toggleBookmark(thread.id)}
                onPress={() => router.push(`/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never)}
              />
            );
          })}
        </View>
      ))}
    </ScreenScaffold>
  );
}

export function ForumsProfileScreen() {
  const router = useRouter();
  const { currentProfile, badgesForProfile, threads, repliesForThread, findCommunity } = useForumsData();
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');

  const ownThreads = threads.filter((thread) => thread.authorId === currentProfile.id);
  const ownReplies = threads.flatMap((thread) => repliesForThread(thread.id).filter((reply) => reply.authorId === currentProfile.id));

  return (
    <ScreenScaffold
      title="Your Profile"
      subtitle="Verification, badges, post history, and settings shortcuts centered on your forum identity."
    >
      <Card style={styles.inlineCard}>
        <View style={styles.profileHeader}>
          <ProfileAvatar name={currentProfile.displayName} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="heading">{currentProfile.displayName}</Text>
            <Text variant="body" color={colors.textSecondary}>
              Verified · joined {new Date(currentProfile.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/(forums)/edit-profile' as never)}>
            <Text variant="caption" color={ACCENT}>Settings</Text>
          </Pressable>
        </View>
        <View style={styles.statGrid}>
          <StatCard label="Posts" value={String(currentProfile.threadCount)} />
          <StatCard label="Replies" value={String(currentProfile.replyCount)} />
          <StatCard label="Karma" value={String(currentProfile.karma)} />
        </View>
      </Card>

      <Text variant="label" color={colors.textSecondary}>Badges</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.horizontalRow}>
          {badgesForProfile(currentProfile.id).map((badge) => (
            <View key={badge.id} style={styles.badgeChip}>
              <Text variant="caption" color={ACCENT}>{badge.icon}</Text>
              <Text variant="caption" color={colors.text}>{badge.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.chipRow}>
        <Chip label="Posts" active={tab === 'posts'} onPress={() => setTab('posts')} />
        <Chip label="Replies" active={tab === 'replies'} onPress={() => setTab('replies')} />
        <Chip label="Activity" onPress={() => router.push('/(forums)/activity-feed' as never)} />
      </View>

      {tab === 'posts'
        ? ownThreads.map((thread) => (
            <Card key={thread.id} style={styles.inlineCard}>
              <Text variant="subheading">{thread.title}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {findCommunity(thread.communityId).displayName} · {formatRelativeTime(thread.createdAt)}
              </Text>
            </Card>
          ))
        : ownReplies.map((reply) => (
            <Card key={reply.id} style={styles.inlineCard}>
              <Text variant="body">{reply.body}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {formatRelativeTime(reply.createdAt)}
              </Text>
            </Card>
          ))}
    </ScreenScaffold>
  );
}

export function ForumsActivityFeedScreen() {
  const router = useRouter();
  const { activity, findThread } = useForumsData();

  return (
    <ScreenScaffold title="Activity Feed" subtitle="Replies, mentions, milestones, and new follows stacked into a readable timeline.">
      <Pressable style={styles.inlineButton}>
        <Text variant="caption" color={ACCENT}>Mark all read</Text>
      </Pressable>
      {activity.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.timelineCard, item.unread && styles.timelineUnread]}
          onPress={() => router.push(`/(forums)/thread-detail?threadId=${encodeURIComponent(item.threadId)}` as never)}
        >
          <View style={styles.timelineIcon}>
            <Text variant="caption" color={ACCENT}>
              {item.type === 'reply' ? '💬' : item.type === 'mention' ? '@' : item.type === 'milestone' ? '↑' : '+'}
            </Text>
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="subheading">{item.title}</Text>
            <Text variant="body" color={colors.textSecondary}>{item.detail}</Text>
            <Text variant="caption" color={colors.textTertiary}>
              {findThread(item.threadId).title} · {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScreenScaffold>
  );
}

export function ForumsThreadDetailScreen() {
  const params = useLocalSearchParams<{ threadId?: string }>();
  const { currentProfile, findCommunity, findProfile, findThread, repliesForThread, toggleBookmark, bookmarks, createReply } = useForumsData();
  const thread = findThread(getParamValue(params.threadId));
  const community = findCommunity(thread.communityId);
  const author = findProfile(thread.authorId);
  const replies = repliesForThread(thread.id);
  const [draft, setDraft] = useState('');

  return (
    <ScreenScaffold title={thread.title} subtitle={community.displayName}>
      <Card style={styles.inlineCard}>
        <Text variant="body" color={colors.textSecondary}>
          {author.displayName} ✓ · {formatRelativeTime(thread.createdAt)}
        </Text>
        <Text variant="body">{thread.body}</Text>
        <View style={styles.rowWrap}>
          <Chip label={`▲ ${thread.voteScore}`} active />
          <Chip label="▼" />
          <Chip label={bookmarks.some((bookmark) => bookmark.threadId === thread.id) ? 'Saved' : 'Save'} onPress={() => toggleBookmark(thread.id)} />
          <Chip label="Share" />
          <Chip label={`Reply as ${currentProfile.displayName.split(' ')[0]}`} />
        </View>
      </Card>

      <Text variant="label" color={colors.textSecondary}>Replies</Text>
      {replies.length === 0 ? (
        <EmptyState icon="💬" title="No replies yet" detail="Be the first to reply to this thread." />
      ) : (
        <ReplyBranch replies={replies} parentReplyId={null} findProfile={findProfile} />
      )}

      <Card style={styles.inlineCard}>
        <Text variant="label" color={colors.textSecondary}>Reply</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a reply"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[styles.input, styles.largeInput]}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (!draft.trim()) {
              Alert.alert('Reply missing', 'Write something before sending.');
              return;
            }
            createReply(thread.id, draft.trim());
            setDraft('');
          }}
        >
          <Text variant="caption" color="#FFFFFF">Send Reply</Text>
        </Pressable>
      </Card>
    </ScreenScaffold>
  );
}

export function ForumsCreateThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string }>();
  const { communities, createThread } = useForumsData();
  const [communityId, setCommunityId] = useState(getParamValue(params.communityId) ?? communities[0]?.id ?? SAMPLE_COMMUNITIES[0].id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  return (
    <ScreenScaffold title="Create Thread" subtitle="Community selection, markdown-style body drafting, and fast posting without leaving the mobile shell.">
      <Card style={styles.inlineCard}>
        <Text variant="label" color={colors.textSecondary}>Community</Text>
        <View style={styles.chipRow}>
          {communities.map((community) => (
            <Chip
              key={community.id}
              label={community.displayName}
              active={communityId === community.id}
              onPress={() => setCommunityId(community.id)}
            />
          ))}
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Thread title"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write the body in markdown"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[styles.input, styles.largeInput]}
        />
        <View style={styles.chipRow}>
          <Chip label="Bold" />
          <Chip label="Italic" />
          <Chip label="Link" />
          <Chip label="List" />
          <Chip label="Code" />
          <Chip label="+ Tag" active />
        </View>
        <Text variant="caption" color={colors.textTertiary}>
          {title.length} characters · {body.trim().split(/\s+/).filter(Boolean).length} words
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (!title.trim() || !body.trim()) {
              Alert.alert('Incomplete thread', 'Add a title and body before posting.');
              return;
            }
            const threadId = createThread({
              communityId,
              title: title.trim(),
              body: body.trim(),
            });
            router.replace(`/(forums)/thread-detail?threadId=${encodeURIComponent(threadId)}` as never);
          }}
        >
          <Text variant="caption" color="#FFFFFF">Post Thread</Text>
        </Pressable>
      </Card>
    </ScreenScaffold>
  );
}

export function ForumsCreateCommunityScreen() {
  const router = useRouter();
  const { createCommunity } = useForumsData();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [humansOnly, setHumansOnly] = useState(true);
  const [rules, setRules] = useState(['Be specific', 'Be kind']);

  return (
    <ScreenScaffold title="Create Community" subtitle="Name, rules, verification requirements, and category setup inside a single mobile flow.">
      <Card style={styles.inlineCard}>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Community name"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
        <Text variant="caption" color={colors.textTertiary}>{displayName.length}/100</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe this community"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[styles.input, styles.largeInput]}
        />

        <Text variant="label" color={colors.textSecondary}>Rules</Text>
        {rules.map((rule, index) => (
          <View key={`${rule}-${index}`} style={styles.settingRow}>
            <Text variant="body">{index + 1}. {rule}</Text>
            <Pressable onPress={() => setRules((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
              <Text variant="caption" color={colors.danger}>Delete</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          style={styles.inlineButton}
          onPress={() => setRules((current) => [...current, `New rule ${current.length + 1}`])}
        >
          <Text variant="caption" color={ACCENT}>+ Add Rule</Text>
        </Pressable>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="subheading">Humans Only</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Require verification before posting or replying.
            </Text>
          </View>
          <Chip label={humansOnly ? 'On' : 'Off'} active={humansOnly} onPress={() => setHumansOnly((value) => !value)} />
        </View>

        <View style={styles.chipRow}>
          <Chip label="Culture" active />
          <Chip label="Technology" />
          <Chip label="Local" />
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (!displayName.trim()) {
              Alert.alert('Name missing', 'Add a community name first.');
              return;
            }
            const communityId = createCommunity({
              displayName: displayName.trim(),
              description: description.trim(),
              humansOnly,
            });
            router.replace(`/(forums)/community-detail?communityId=${encodeURIComponent(communityId)}` as never);
          }}
        >
          <Text variant="caption" color="#FFFFFF">Create Community</Text>
        </Pressable>
      </Card>
    </ScreenScaffold>
  );
}

export function ForumsCommunityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string }>();
  const {
    findCommunity,
    joinedCommunityIds,
    toggleCommunityMembership,
    threadsForCommunity,
    rulesForCommunity,
    membersForCommunity,
    findProfile,
  } = useForumsData();
  const community = findCommunity(getParamValue(params.communityId));
  const [tab, setTab] = useState<'threads' | 'rules' | 'members'>('threads');

  return (
    <ScreenScaffold title={community.displayName} subtitle={community.description ?? 'Community detail'}>
      <Card style={styles.inlineCard}>
        <View style={styles.rowWrap}>
          {community.humansOnly ? (
            <View style={styles.communityPill}>
              <Text variant="caption" color={ACCENT}>Humans Only</Text>
            </View>
          ) : null}
          <Text variant="caption" color={colors.textSecondary}>
            {community.memberCount} members · {community.threadCount} threads
          </Text>
        </View>
        <View style={styles.rowWrap}>
          <Pressable style={styles.primaryButtonSmall} onPress={() => toggleCommunityMembership(community.id)}>
            <Text variant="caption" color="#FFFFFF">
              {joinedCommunityIds.has(community.id) ? 'Leave' : 'Join'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(forums)/create-thread?communityId=${encodeURIComponent(community.id)}` as never)}>
            <Text variant="caption" color={ACCENT}>New Thread</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(forums)/community-health?communityId=${encodeURIComponent(community.id)}` as never)}>
            <Text variant="caption" color={ACCENT}>Health</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.chipRow}>
        <Chip label="Threads" active={tab === 'threads'} onPress={() => setTab('threads')} />
        <Chip label="Rules" active={tab === 'rules'} onPress={() => setTab('rules')} />
        <Chip label="Members" active={tab === 'members'} onPress={() => setTab('members')} />
      </View>

      {tab === 'threads'
        ? threadsForCommunity(community.id).map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              communityName={community.displayName}
              authorName={findProfile(thread.authorId).displayName}
              onPress={() => router.push(`/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never)}
            />
          ))
        : tab === 'rules'
          ? rulesForCommunity(community.id).map((rule) => (
              <Card key={rule.id} style={styles.inlineCard}>
                <Text variant="subheading">{rule.position + 1}. {rule.title}</Text>
                <Text variant="body" color={colors.textSecondary}>{rule.description}</Text>
              </Card>
            ))
          : membersForCommunity(community.id).map((member) => {
              const profile = findProfile(member.profileId);
              return (
                <Card key={member.id} style={styles.inlineCard}>
                  <View style={styles.profileHeader}>
                    <ProfileAvatar name={profile.displayName} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text variant="subheading">{profile.displayName}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {member.role} · @{profile.username}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}

      <View style={styles.rowWrap}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(forums)/community-settings?communityId=${encodeURIComponent(community.id)}` as never)}>
          <Text variant="caption" color={ACCENT}>Settings</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(forums)/mod-log?communityId=${encodeURIComponent(community.id)}` as never)}>
          <Text variant="caption" color={ACCENT}>Mod Log</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}

export function ForumsCommunitySettingsScreen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const { findCommunity } = useForumsData();
  const community = findCommunity(getParamValue(params.communityId));

  return (
    <ScreenScaffold title="Community Settings" subtitle={community.displayName}>
      {[
        'Edit Info',
        'Rules Management',
        'Tags Management',
        'Post Templates',
        'Moderation Filters',
      ].map((label) => (
        <Pressable key={label} style={styles.settingRow}>
          <Text variant="subheading">{label}</Text>
          <Text variant="caption" color={colors.textTertiary}>›</Text>
        </Pressable>
      ))}
      <Card style={[styles.inlineCard, styles.dangerCard]}>
        <Text variant="subheading" color={colors.danger}>Delete Community</Text>
        <Text variant="body" color={colors.textSecondary}>
          This removes the public shell for the community. Keep the data model and cache tables intact until archival is explicit.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

export function ForumsCommunityHealthScreen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const { findCommunity, communityHealth } = useForumsData();
  const community = findCommunity(getParamValue(params.communityId));
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const health = communityHealth.find((item) => item.communityId === community.id) ?? communityHealth[0];

  return (
    <ScreenScaffold title="Community Health" subtitle={`${community.displayName} · ${range}`}>
      <View style={styles.chipRow}>
        <Chip label="7d" active={range === '7d'} onPress={() => setRange('7d')} />
        <Chip label="30d" active={range === '30d'} onPress={() => setRange('30d')} />
        <Chip label="90d" active={range === '90d'} onPress={() => setRange('90d')} />
      </View>
      <View style={styles.statGrid}>
        <StatCard label="Verified Members" value={`${health.verifiedHumanPercent}%`} />
        <StatCard label="Avg Response" value={`${health.avgResponseTimeMinutes}m`} />
        <StatCard label="Flagged Actions" value={String(health.modActionsLast30Days)} />
      </View>
      <Card style={styles.inlineCard}>
        <Text variant="subheading">Engagement Snapshot</Text>
        <Text variant="body" color={colors.textSecondary}>
          Signal-to-noise {health.signalToNoiseScore.toFixed(1)} · {health.activePostersLast7Days} active posters last week · {health.memberCount} total members
        </Text>
        <View style={styles.healthBar}>
          <View style={[styles.healthBarFill, { width: `${health.verifiedHumanPercent}%` }]} />
        </View>
        <Text variant="caption" color={colors.textTertiary}>
          Verified member share visualized as a circular-ring surrogate on mobile.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

export function ForumsModLogScreen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const { findCommunity, modActions } = useForumsData();
  const community = findCommunity(getParamValue(params.communityId));
  const [filter, setFilter] = useState<'All' | 'Removals' | 'Bans' | 'Warnings'>('All');

  const visibleActions = modActions.filter((item) => {
    if (item.communityId !== community.id) return false;
    if (filter === 'All') return true;
    if (filter === 'Removals') return item.actionType === 'Removed';
    if (filter === 'Bans') return item.actionType === 'Banned';
    return item.actionType === 'Warned';
  });

  return (
    <ScreenScaffold title="Moderation Log" subtitle={community.displayName}>
      <View style={styles.chipRow}>
        <Chip label="All" active={filter === 'All'} onPress={() => setFilter('All')} />
        <Chip label="Removals" active={filter === 'Removals'} onPress={() => setFilter('Removals')} />
        <Chip label="Bans" active={filter === 'Bans'} onPress={() => setFilter('Bans')} />
        <Chip label="Warnings" active={filter === 'Warnings'} onPress={() => setFilter('Warnings')} />
      </View>
      {visibleActions.map((action) => (
        <Card key={action.id} style={styles.inlineCard}>
          <View style={styles.spaceBetween}>
            <View style={styles.actionBadge}>
              <Text variant="caption" color={ACCENT}>{action.actionType}</Text>
            </View>
            <Text variant="caption" color={colors.textTertiary}>{formatRelativeTime(action.createdAt)}</Text>
          </View>
          <Text variant="subheading">{action.target}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {action.moderatorName} · {action.reason}
          </Text>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

function MessagingAvatar({
  label,
  online = false,
  group = false,
  size = 48,
}: {
  label: string;
  online?: boolean;
  group?: boolean;
  size?: number;
}) {
  return (
    <View style={[styles.messagingAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {group ? (
        <MaterialSymbol name="groups" size={Math.round(size * 0.48)} color="#FFFFFF" filled />
      ) : (
        <Text variant="caption" color="#FFFFFF">
          {initials(label)}
        </Text>
      )}
      {online ? <View style={styles.messagingAvatarDot} /> : null}
    </View>
  );
}

function SwipeConversationRow({
  conversation,
  state,
  profile,
  onPress,
  onToggleRead,
  onArchive,
  onDelete,
}: {
  conversation: Conversation;
  state: ConversationUiState;
  profile: UserProfile | null;
  onPress: () => void;
  onToggleRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const closeRow = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [translateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => {
      if (gesture.dx < 0) {
        translateX.setValue(Math.max(gesture.dx, -128));
      } else {
        translateX.setValue(Math.min(gesture.dx, 88));
      }
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -54) {
        Animated.spring(translateX, {
          toValue: -128,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
        return;
      }

      if (gesture.dx > 54) {
        onToggleRead();
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 56,
            duration: 110,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }),
        ]).start();
        return;
      }

      closeRow();
    },
  }), [closeRow, onToggleRead, translateX]);

  return (
    <View style={styles.swipeRowShell}>
      <View style={styles.swipeRowLeftAction}>
        <MaterialSymbol
          name={state.unreadCount > 0 ? 'done_all' : 'notifications'}
          size={18}
          color="#FFFFFF"
          filled={state.unreadCount > 0}
        />
        <Text variant="caption" color="#FFFFFF">
          {state.unreadCount > 0 ? 'Read' : 'Unread'}
        </Text>
      </View>

      <View style={styles.swipeRowRightActions}>
        <Pressable style={styles.swipeActionArchive} onPress={() => { closeRow(); onArchive(); }}>
          <MaterialSymbol name="archive" size={18} color="#FFFFFF" filled />
        </Pressable>
        <Pressable style={styles.swipeActionDelete} onPress={() => { closeRow(); onDelete(); }}>
          <MaterialSymbol name="delete" size={18} color="#FFFFFF" filled />
        </Pressable>
      </View>

      <Animated.View
        style={[styles.swipeRowCardHost, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.inboxRowCard} onPress={onPress}>
          <MessagingAvatar
            label={conversation.title ?? 'Message'}
            online={state.online}
            group={state.channelType === 'group'}
          />
          <View style={styles.inboxRowBody}>
            <View style={styles.inboxRowTop}>
              <View style={styles.inboxRowIdentity}>
                <Text variant="subheading">{conversation.title ?? 'Direct Message'}</Text>
                {profile ? (
                  <HumanVerifiedBadge tier={getTrustTierForProfile(profile)} showLabel={false} />
                ) : null}
                {state.requestState !== 'none' ? (
                  <View style={styles.requestPill}>
                    <Text variant="caption" color="#FFFFFF">
                      {state.requestState === 'incoming' ? 'Request' : 'Sent'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" color={state.unreadCount > 0 ? ACCENT : colors.textTertiary}>
                {conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : 'new'}
              </Text>
            </View>
            <View style={styles.inboxRowBottom}>
              <View style={styles.inboxPreviewWrap}>
                <MaterialSymbol name="lock" size={13} color={ACCENT} />
                <Text
                  variant="body"
                  color={colors.textSecondary}
                  numberOfLines={1}
                  style={styles.inboxPreviewText}
                >
                  {conversation.lastMessagePreview ?? 'Encrypted conversation ready'}
                </Text>
              </View>
              <View style={styles.inboxMetaRail}>
                {state.humansOnly ? (
                  <View style={styles.humansOnlyPill}>
                    <Text variant="caption" color={ACCENT}>Human</Text>
                  </View>
                ) : null}
                {state.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text variant="caption" color="#FFFFFF">{String(state.unreadCount)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ChatMessageRow({
  message,
  attachment,
  mine,
  showHandshake,
  playing,
  onTogglePlay,
}: {
  message: DirectMessage;
  attachment?: MessageAttachmentState;
  mine: boolean;
  showHandshake: boolean;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  return (
    <View style={[styles.chatMessageRow, mine ? styles.chatMessageRowMine : styles.chatMessageRowOther]}>
      <View style={[styles.chatBubbleCard, mine ? styles.chatBubbleCardMine : styles.chatBubbleCardOther]}>
        {showHandshake ? (
          <View style={styles.handshakeRow}>
            <MaterialSymbol name="lock" size={12} color={mine ? '#FFFFFF' : ACCENT} filled />
            <Text variant="caption" color={mine ? 'rgba(255,255,255,0.82)' : ACCENT}>
              E2EE handshake complete
            </Text>
          </View>
        ) : null}

        {attachment?.kind === 'link' ? (
          <View style={styles.linkPreviewCard}>
            <Text variant="caption" color={mine ? 'rgba(255,255,255,0.72)' : colors.textTertiary}>
              {attachment.linkHost}
            </Text>
            <Text variant="subheading" color={mine ? '#FFFFFF' : colors.text}>
              {attachment.linkTitle}
            </Text>
            <Text variant="body" color={mine ? 'rgba(255,255,255,0.88)' : colors.textSecondary}>
              {attachment.linkSummary}
            </Text>
          </View>
        ) : null}

        {attachment?.kind === 'image' ? (
          <LinearGradient
            colors={attachment.imagePalette ?? [ACCENT, '#1B1B20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.imageAttachment}
          >
            <MaterialSymbol name="image" size={22} color="#FFFFFF" filled />
            <Text variant="caption" color="#FFFFFF">
              {attachment.imageLabel ?? 'Image attachment'}
            </Text>
          </LinearGradient>
        ) : null}

        {attachment?.kind === 'voice' ? (
          <Pressable style={styles.voiceAttachment} onPress={onTogglePlay}>
            <View style={styles.voicePlayButton}>
              <MaterialSymbol
                name={playing ? 'pause' : 'play_arrow'}
                size={18}
                color="#FFFFFF"
                filled
              />
            </View>
            <View style={styles.voiceWaveform}>
              {(attachment.waveform ?? []).map((bar, index) => (
                <View
                  key={`${message.id}-${index}`}
                  style={[
                    styles.voiceWaveBar,
                    {
                      height: bar,
                      opacity: playing ? 1 : 0.52 + index / 20,
                    },
                  ]}
                />
              ))}
            </View>
            <Text variant="caption" color={mine ? 'rgba(255,255,255,0.82)' : colors.textSecondary}>
              {formatDuration(attachment.durationSeconds ?? 0)}
            </Text>
          </Pressable>
        ) : null}

        {attachment?.kind !== 'voice' ? (
          <Text variant="body" color={mine ? '#FFFFFF' : colors.text}>
            {message.body}
          </Text>
        ) : null}

        <View style={styles.chatMetaRow}>
          <Text variant="caption" color={mine ? 'rgba(255,255,255,0.72)' : colors.textTertiary}>
            {formatAbsoluteTime(message.createdAt)}
          </Text>
          {mine ? (
            <Text variant="caption" color="rgba(255,255,255,0.72)">
              Read
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ForumsMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    conversations,
    findProfile,
    getConversationStateById,
    refresh,
    markConversationRead,
    toggleConversationUnread,
    archiveConversation,
    deleteConversation,
    acceptConversationRequest,
    declineConversationRequest,
  } = useForumsData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [showRequests, setShowRequests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const incomingRequests = useMemo(() => {
    return conversations.filter((conversation) => getConversationStateById(conversation.id).requestState === 'incoming');
  }, [conversations, getConversationStateById]);

  const visibleConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const state = getConversationStateById(conversation.id);
      const profile = state.participantProfileId ? findProfile(state.participantProfileId) : null;
      const matchesQuery = needle.length === 0
        || `${conversation.title ?? ''} ${conversation.lastMessagePreview ?? ''} ${profile?.username ?? ''}`
          .toLowerCase()
          .includes(needle);

      if (!matchesQuery) {
        return false;
      }

      if (filter === 'unread') {
        return state.unreadCount > 0;
      }
      if (filter === 'humans') {
        return state.humansOnly;
      }
      if (filter === 'requests') {
        return state.requestState !== 'none';
      }

      return true;
    });
  }, [conversations, filter, findProfile, getConversationStateById, query]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 450);
  }, [refresh]);

  return (
    <View style={styles.messagingScreen}>
      <LinearGradient
        colors={['rgba(124,77,255,0.18)', 'rgba(124,77,255,0)', 'rgba(19,19,24,0)']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.8, y: 0.65 }}
        style={styles.messagingBackdrop}
      />
      <View style={[styles.messagingTopBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.messagingTopIdentity}>
          <MessagingAvatar label="Trey Stone" size={34} />
          <Text variant="heading">Messages</Text>
        </View>
        <View style={styles.messagingTopActions}>
          <Pressable style={styles.iconButton} onPress={() => setFilter((current) => current === 'requests' ? 'all' : 'requests')}>
            <MaterialSymbol name="edit" size={18} color={ACCENT} filled />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(forums)/new-message' as never)}>
            <MaterialSymbol name="add" size={18} color={ACCENT} filled />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={visibleConversations}
        keyExtractor={(item) => item.id}
        style={styles.messagingList}
        contentContainerStyle={{ paddingBottom: insets.bottom + 132 }}
        refreshControl={
          <RefreshControl
            tintColor={ACCENT}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListHeaderComponent={(
          <View style={styles.messagingHeaderBlock}>
            <Text variant="caption" color={ACCENT}>INBOX</Text>
            <Text variant="heading" style={styles.messagingHeroTitle}>
              Messages
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              Encrypted with humans you trust.
            </Text>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search conversations..."
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.messagingFilters}>
              <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label="Unread" active={filter === 'unread'} onPress={() => setFilter('unread')} />
              <Chip label="Humans Only" active={filter === 'humans'} onPress={() => setFilter('humans')} />
              <Chip label="Requests" active={filter === 'requests'} onPress={() => setFilter('requests')} />
            </ScrollView>

            {incomingRequests.length > 0 ? (
              <GlassCard glow style={styles.requestBannerCard}>
                <View style={styles.requestBannerRow}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="subheading">{incomingRequests.length} pending request{incomingRequests.length === 1 ? '' : 's'}</Text>
                    <Text variant="body" color={colors.textSecondary}>
                      Review new encrypted conversation requests before they hit the main inbox.
                    </Text>
                  </View>
                  <Pressable style={styles.reviewButton} onPress={() => setShowRequests(true)}>
                    <Text variant="caption" color="#FFFFFF">Review</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ) : null}
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.messagingEmptyState}>
            <MaterialSymbol name="lock" size={24} color={ACCENT} filled />
            <Text variant="subheading">No messages yet</Text>
            <Text variant="body" color={colors.textSecondary} style={styles.centerText}>
              Start a conversation from a user profile.
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const state = getConversationStateById(item.id);
          const profile = state.participantProfileId ? findProfile(state.participantProfileId) : null;

          return (
            <SwipeConversationRow
              conversation={item}
              state={state}
              profile={profile}
              onPress={() => {
                markConversationRead(item.id);
                router.push(`/(forums)/conversation?conversationId=${encodeURIComponent(item.id)}` as never);
              }}
              onToggleRead={() => toggleConversationUnread(item.id)}
              onArchive={() => archiveConversation(item.id)}
              onDelete={() => deleteConversation(item.id)}
            />
          );
        }}
      />

      <CreateFAB
        icon="add"
        label="New Message"
        onPress={() => router.push('/(forums)/new-message' as never)}
      />

      <Modal transparent visible={showRequests} animationType="fade" onRequestClose={() => setShowRequests(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowRequests(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <Text variant="subheading">Conversation Requests</Text>
            <Text variant="body" color={colors.textSecondary}>
              Accept to move the thread into your encrypted inbox or decline to dismiss it.
            </Text>
            <View style={styles.modalList}>
              {incomingRequests.map((conversation) => {
                const state = getConversationStateById(conversation.id);
                const profile = state.participantProfileId ? findProfile(state.participantProfileId) : null;

                return (
                  <GlassCard key={conversation.id} style={styles.requestSheetCard}>
                    <View style={styles.requestSheetRow}>
                      <MessagingAvatar label={conversation.title ?? 'Request'} online={state.online} size={40} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.rowWrap}>
                          <Text variant="subheading">{conversation.title}</Text>
                          {profile ? <HumanVerifiedBadge tier={getTrustTierForProfile(profile)} showLabel={false} /> : null}
                        </View>
                        <Text variant="body" color={colors.textSecondary}>
                          {conversation.lastMessagePreview}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestActionsRow}>
                      <Pressable style={styles.secondaryActionButton} onPress={() => declineConversationRequest(conversation.id)}>
                        <Text variant="caption" color={colors.text}>Decline</Text>
                      </Pressable>
                      <Pressable
                        style={styles.primaryActionButton}
                        onPress={() => {
                          acceptConversationRequest(conversation.id);
                          setShowRequests(false);
                        }}
                      >
                        <Text variant="caption" color="#FFFFFF">Accept</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ForumsConversationScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    conversations,
    findProfile,
    messagesForConversation,
    getConversationStateById,
    getMessageAttachmentState,
    markConversationRead,
    acceptConversationRequest,
    declineConversationRequest,
    verifyConversationFingerprint,
    clearConversation,
    sendMessage,
    sendVoiceMessage,
  } = useForumsData();
  const conversation = conversations.find((item) => item.id === getParamValue(params.conversationId)) ?? conversations[0] ?? SAMPLE_CONVERSATIONS[0];
  const messages = messagesForConversation(conversation.id);
  const conversationState = getConversationStateById(conversation.id);
  const profile = conversationState.participantProfileId ? findProfile(conversationState.participantProfileId) : null;
  const [draft, setDraft] = useState('');
  const [showOverflow, setShowOverflow] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAttachmentTray, setShowAttachmentTray] = useState(false);
  const [recordingStartAt, setRecordingStartAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  useEffect(() => {
    markConversationRead(conversation.id);
  }, [conversation.id, markConversationRead]);

  useEffect(() => {
    if (recordingStartAt == null) {
      setRecordingSeconds(0);
      return undefined;
    }

    const interval = setInterval(() => {
      setRecordingSeconds(Math.max(1, Math.round((Date.now() - recordingStartAt) / 1000)));
    }, 120);

    return () => clearInterval(interval);
  }, [recordingStartAt]);

  useEffect(() => {
    if (playingMessageId == null) {
      return undefined;
    }

    const attachment = getMessageAttachmentState(playingMessageId);
    const timeout = setTimeout(
      () => setPlayingMessageId(null),
      Math.max(attachment?.durationSeconds ?? 3, 1) * 1000,
    );
    return () => clearTimeout(timeout);
  }, [getMessageAttachmentState, playingMessageId]);

  const descendingMessages = useMemo(() => messages.slice().reverse(), [messages]);

  return (
    <View style={styles.chatScreen}>
      <LinearGradient
        colors={['rgba(124,77,255,0.16)', 'rgba(124,77,255,0)', 'rgba(10,10,15,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.9 }}
        style={styles.messagingBackdrop}
      />
      <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <MaterialSymbol name="arrow_back" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.chatHeaderCenter}>
          <MessagingAvatar
            label={conversation.title ?? 'Conversation'}
            online={conversationState.online}
            group={conversationState.channelType === 'group'}
            size={40}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.rowWrap}>
              <Text variant="subheading">{conversation.title ?? 'Conversation'}</Text>
              {profile ? <HumanVerifiedBadge tier={getTrustTierForProfile(profile)} showLabel={false} /> : null}
            </View>
            <View style={styles.rowWrap}>
              <MaterialSymbol name="lock" size={12} color={ACCENT} filled />
              <Text variant="caption" color={colors.textSecondary}>
                Encrypted
              </Text>
              {conversationState.typingLabel ? (
                <Text variant="caption" color={ACCENT}>
                  {conversationState.typingLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <Pressable style={styles.iconButton} onPress={() => setShowOverflow(true)}>
          <MaterialSymbol name="more_vert" size={18} color={colors.text} />
        </Pressable>
      </View>

      {conversationState.requestState !== 'none' ? (
        <GlassCard style={styles.requestBannerInline}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="subheading">
              {conversationState.requestState === 'incoming' ? 'Conversation request' : 'Waiting for approval'}
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              {conversationState.requestState === 'incoming'
                ? 'Accept to unlock replies, attachments, and live read receipts.'
                : 'Your first message is pending until this person accepts the request.'}
            </Text>
          </View>
          {conversationState.requestState === 'incoming' ? (
            <View style={styles.requestActionsRow}>
              <Pressable style={styles.secondaryActionButton} onPress={() => declineConversationRequest(conversation.id)}>
                <Text variant="caption" color={colors.text}>Decline</Text>
              </Pressable>
              <Pressable style={styles.primaryActionButton} onPress={() => acceptConversationRequest(conversation.id)}>
                <Text variant="caption" color="#FFFFFF">Accept</Text>
              </Pressable>
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      <FlatList
        data={descendingMessages}
        inverted
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 126, paddingTop: spacing.md }}
        renderItem={({ item, index }) => {
          const attachment = getMessageAttachmentState(item.id);
          return (
            <ChatMessageRow
              message={item}
              attachment={attachment}
              mine={item.senderId === LOCAL_USER_ID}
              showHandshake={index === descendingMessages.length - 1}
              playing={playingMessageId === item.id}
              onTogglePlay={() => setPlayingMessageId((current) => current === item.id ? null : item.id)}
            />
          );
        }}
        ListEmptyComponent={(
          <View style={styles.chatEmptyState}>
            <Text variant="subheading">No messages yet</Text>
            <Text variant="body" color={colors.textSecondary} style={styles.centerText}>
              Say hello to start the thread.
            </Text>
          </View>
        )}
      />

      {recordingStartAt != null ? (
        <View style={[styles.recordingPill, { bottom: insets.bottom + 104 }]}>
          <MaterialSymbol name="mic" size={14} color="#FFFFFF" filled />
          <Text variant="caption" color="#FFFFFF">
            Recording… release to send · {formatDuration(recordingSeconds)}
          </Text>
        </View>
      ) : null}

      <View style={[styles.chatComposerShell, { paddingBottom: insets.bottom + 12 }]}>
        {showAttachmentTray ? (
          <View style={styles.attachmentTray}>
            <Pressable
              style={styles.attachmentAction}
              onPress={() => {
                try {
                  sendMessage({
                    conversationId: conversation.id,
                    body: 'Shared a mobile reference shot.',
                    attachment: {
                      kind: 'image',
                      imageLabel: 'Reference image',
                      imagePalette: ['#7C4DFF', '#2A292F'],
                    },
                  });
                  setShowAttachmentTray(false);
                } catch (error) {
                  Alert.alert('Attachment failed', error instanceof Error ? error.message : 'Unable to attach image.');
                }
              }}
            >
              <MaterialSymbol name="photo_camera" size={18} color={ACCENT} filled />
              <Text variant="caption" color={colors.text}>Camera</Text>
            </Pressable>
            <Pressable
              style={styles.attachmentAction}
              onPress={() => {
                try {
                  sendMessage({
                    conversationId: conversation.id,
                    body: 'Shared a library image.',
                    attachment: {
                      kind: 'image',
                      imageLabel: 'Library image',
                      imagePalette: ['#A78BFA', '#1F1F25'],
                    },
                  });
                  setShowAttachmentTray(false);
                } catch (error) {
                  Alert.alert('Attachment failed', error instanceof Error ? error.message : 'Unable to attach image.');
                }
              }}
            >
              <MaterialSymbol name="image" size={18} color={ACCENT} filled />
              <Text variant="caption" color={colors.text}>Library</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.chatComposer}>
          <Pressable style={styles.chatIconButton} onPress={() => setShowAttachmentTray((current) => !current)}>
            <MaterialSymbol name="add" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.chatIconButton} onPress={() => setShowAttachmentTray(true)}>
            <MaterialSymbol name="photo_camera" size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.chatInputWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={styles.chatInput}
            />
          </View>
          {draft.trim().length > 0 ? (
            <Pressable
              style={styles.sendButton}
              onPress={() => {
                try {
                  sendMessage({
                    conversationId: conversation.id,
                    body: draft,
                  });
                  setDraft('');
                } catch (error) {
                  Alert.alert('Message failed', error instanceof Error ? error.message : 'Unable to send message.');
                }
              }}
            >
              <MaterialSymbol name="send" size={18} color="#FFFFFF" filled />
            </Pressable>
          ) : (
            <Pressable
              style={styles.voiceRecordButton}
              onPressIn={() => setRecordingStartAt(Date.now())}
              onPressOut={() => {
                if (recordingStartAt == null) return;
                const duration = Math.max(1, Math.round((Date.now() - recordingStartAt) / 1000));
                setRecordingStartAt(null);
                try {
                  sendVoiceMessage(conversation.id, duration);
                } catch (error) {
                  Alert.alert('Voice message failed', error instanceof Error ? error.message : 'Unable to send voice note.');
                }
              }}
            >
              <MaterialSymbol name="mic" size={18} color="#FFFFFF" filled />
            </Pressable>
          )}
        </View>
      </View>

      <Modal transparent visible={showOverflow} animationType="fade" onRequestClose={() => setShowOverflow(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowOverflow(false)}>
          <Pressable style={styles.chatMenuSheet} onPress={() => undefined}>
            <Pressable style={styles.chatMenuRow} onPress={() => { setShowOverflow(false); setShowVerifyModal(true); }}>
              <Text variant="subheading">Verify Encryption</Text>
              <MaterialSymbol name="lock" size={16} color={ACCENT} filled />
            </Pressable>
            <Pressable style={styles.chatMenuRow} onPress={() => { setShowOverflow(false); Alert.alert('Block user', 'Blocking is queued as a moderation action.'); }}>
              <Text variant="subheading">Block</Text>
              <MaterialSymbol name="block" size={16} color={colors.danger} filled />
            </Pressable>
            <Pressable style={styles.chatMenuRow} onPress={() => { setShowOverflow(false); Alert.alert('Report user', 'A report draft has been queued.'); }}>
              <Text variant="subheading">Report</Text>
              <MaterialSymbol name="flag" size={16} color={colors.textSecondary} filled />
            </Pressable>
            <Pressable style={styles.chatMenuRow} onPress={() => { setShowOverflow(false); clearConversation(conversation.id); }}>
              <Text variant="subheading">Clear Chat</Text>
              <MaterialSymbol name="delete" size={16} color={colors.danger} filled />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={showVerifyModal} animationType="fade" onRequestClose={() => setShowVerifyModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowVerifyModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <Text variant="subheading">Verify Encryption</Text>
            <Text variant="body" color={colors.textSecondary}>
              Compare this safety number with {conversation.title ?? 'your contact'} to confirm the device pairing.
            </Text>
            <View style={styles.fingerprintGrid}>
              {conversationState.fingerprint.split(' ').map((cell) => (
                <View key={cell} style={styles.fingerprintCell}>
                  <Text variant="caption" color={ACCENT}>{cell}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.primaryActionButton}
              onPress={() => {
                verifyConversationFingerprint(conversation.id);
                setShowVerifyModal(false);
              }}
            >
              <Text variant="caption" color="#FFFFFF">
                {conversationState.fingerprintVerified ? 'Verified' : 'Mark as Verified'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ForumsNewMessageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profiles, currentProfile, conversations, getConversationStateById, findConversationByParticipant, sendMessage } = useForumsData();
  const [recipientQuery, setRecipientQuery] = useState('');
  const [body, setBody] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RecipientFilter>('all');

  const recentProfiles = useMemo(() => {
    return conversations
      .map((conversation) => getConversationStateById(conversation.id).participantProfileId)
      .filter((profileId): profileId is string => Boolean(profileId))
      .map((profileId) => profiles.find((profile) => profile.id === profileId))
      .filter((profile): profile is UserProfile => Boolean(profile))
      .filter((profile, index, array) => array.findIndex((candidate) => candidate.id === profile.id) === index)
      .slice(0, 4);
  }, [conversations, getConversationStateById, profiles]);

  const recipientResults = useMemo(() => {
    const needle = recipientQuery.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (profile.id === currentProfile.id) return false;
      if (filter === 'humans' && !profile.isVerified) return false;
      if (filter === 'recent' && !recentProfiles.some((item) => item.id === profile.id)) return false;
      if (needle.length === 0) return true;
      return `${profile.displayName} ${profile.username}`.toLowerCase().includes(needle);
    });
  }, [currentProfile.id, filter, profiles, recentProfiles, recipientQuery]);

  const selectedRecipient = profiles.find((profile) => profile.id === selectedRecipientId) ?? null;
  const existingConversation = selectedRecipient ? findConversationByParticipant(selectedRecipient.id) : undefined;
  const currentConversationState = existingConversation ? getConversationStateById(existingConversation.id) : null;
  const needsConversationRequest = selectedRecipient != null && (currentConversationState == null || currentConversationState.requestState !== 'none');
  const characterInfo = getCharacterCountInfo(body);

  return (
    <View style={styles.messagingScreen}>
      <View style={[styles.newMessageHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}>
          <Text variant="body" color={colors.textSecondary}>Cancel</Text>
        </Pressable>
        <Text variant="subheading">New Message</Text>
        <Pressable
          style={[
            styles.newMessageSendButton,
            (!selectedRecipient || characterInfo.count === 0) && styles.newMessageSendButtonDisabled,
          ]}
          onPress={() => {
            if (!selectedRecipient || !body.trim()) {
              Alert.alert('Message missing', 'Choose a recipient and write a message first.');
              return;
            }

            try {
              const conversationId = sendMessage({
                conversationId: existingConversation?.id,
                recipientName: selectedRecipient.displayName,
                recipientProfileId: selectedRecipient.id,
                body,
                requestState: currentConversationState?.requestState ?? (needsConversationRequest ? 'outgoing' : 'none'),
              });
              router.replace(`/(forums)/conversation?conversationId=${encodeURIComponent(conversationId)}` as never);
            } catch (error) {
              Alert.alert('Send failed', error instanceof Error ? error.message : 'Unable to send message.');
            }
          }}
        >
          <Text variant="caption" color="#FFFFFF">Send</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.messagingList}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 32, gap: spacing.md }}
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color={colors.textSecondary}>RECIPIENT</Text>
          <SearchBar
            value={recipientQuery}
            onChange={setRecipientQuery}
            placeholder="Search members..."
          />
          <View style={styles.chipRow}>
            <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Humans Only" active={filter === 'humans'} onPress={() => setFilter('humans')} />
            <Chip label="Recent" active={filter === 'recent'} onPress={() => setFilter('recent')} />
          </View>
        </View>

        {selectedRecipient ? (
          <GlassCard style={styles.selectedRecipientCard}>
            <View style={styles.selectedRecipientRow}>
              <MessagingAvatar label={selectedRecipient.displayName} online={selectedRecipient.isVerified} size={42} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.rowWrap}>
                  <Text variant="subheading">{selectedRecipient.displayName}</Text>
                  <HumanVerifiedBadge tier={getTrustTierForProfile(selectedRecipient)} showLabel={false} />
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  @{selectedRecipient.username}
                </Text>
              </View>
              <Pressable style={styles.iconButton} onPress={() => setSelectedRecipientId(null)}>
                <MaterialSymbol name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        {selectedRecipient == null && recipientQuery.trim().length === 0 && recentProfiles.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.textSecondary}>Recent Conversations</Text>
            {recentProfiles.map((profile) => (
              <GlassCard key={profile.id} style={styles.recipientResultCard} onPress={() => setSelectedRecipientId(profile.id)}>
                <View style={styles.recipientResultRow}>
                  <MessagingAvatar label={profile.displayName} online={profile.isVerified} size={42} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.rowWrap}>
                      <Text variant="subheading">{profile.displayName}</Text>
                      <HumanVerifiedBadge tier={getTrustTierForProfile(profile)} showLabel={false} />
                    </View>
                    <Text variant="caption" color={colors.textSecondary}>
                      @{profile.username} · {profile.karma} karma
                    </Text>
                  </View>
                  <Pressable style={styles.recipientSelectButton} onPress={() => setSelectedRecipientId(profile.id)}>
                    <Text variant="caption" color="#FFFFFF">Select</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        {selectedRecipient == null ? (
          <View style={{ gap: spacing.sm }}>
            {recipientResults.map((profile) => (
              <GlassCard key={profile.id} style={styles.recipientResultCard} onPress={() => setSelectedRecipientId(profile.id)}>
                <View style={styles.recipientResultRow}>
                  <MessagingAvatar label={profile.displayName} online={profile.isVerified} size={42} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.rowWrap}>
                      <Text variant="subheading">{profile.displayName}</Text>
                      <HumanVerifiedBadge tier={getTrustTierForProfile(profile)} showLabel={false} />
                    </View>
                    <Text variant="caption" color={colors.textSecondary}>
                      @{profile.username} · {profile.karma} karma
                    </Text>
                  </View>
                  <Pressable style={styles.recipientSelectButton} onPress={() => setSelectedRecipientId(profile.id)}>
                    <Text variant="caption" color="#FFFFFF">Send Message</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        {needsConversationRequest ? (
          <GlassCard style={styles.noticeCard}>
            <View style={styles.noticeRow}>
              <MaterialSymbol name="lock" size={16} color={ACCENT} filled />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="subheading">Conversation request</Text>
                <Text variant="body" color={colors.textSecondary}>
                  This will send a conversation request. {selectedRecipient?.displayName ?? 'They'} must accept before you can chat freely.
                </Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.newMessageComposerCard}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write a message..."
            placeholderTextColor={colors.textTertiary}
            multiline
            style={styles.newMessageComposerInput}
          />
          <View style={styles.newMessageComposerFooter}>
            <View style={styles.rowWrap}>
              <Pressable style={styles.chatIconButton}>
                <MaterialSymbol name="image" size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable style={styles.chatIconButton}>
                <MaterialSymbol name="link" size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable style={styles.chatIconButton}>
                <MaterialSymbol name="mic" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text variant="caption" color={characterInfo.showWarning ? colors.danger : colors.textTertiary}>
              {characterInfo.count} / 5000
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.noticeCard}>
          <View style={styles.noticeRow}>
            <MaterialSymbol name="lock" size={16} color={ACCENT} filled />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="subheading">End-to-End Encrypted</Text>
              <Text variant="body" color={colors.textSecondary}>
                Your first message and follow-ups stay encrypted once the device pairing is confirmed.
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.noticeCard}>
          <View style={styles.noticeRow}>
            <MaterialSymbol name="verified_user" size={16} color={ACCENT} filled />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="subheading">Community Standards</Text>
              <Text variant="body" color={colors.textSecondary}>
                Messages are still subject to humans-only trust rules and moderation protections.
              </Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

export function ForumsEditProfileScreen() {
  const { currentProfile, saveProfile } = useForumsData();
  const [displayName, setDisplayName] = useState(currentProfile.displayName);
  const [bio, setBio] = useState(currentProfile.bio);
  const [location, setLocation] = useState(currentProfile.location);
  const [websiteUrl, setWebsiteUrl] = useState(currentProfile.websiteUrl ?? '');

  return (
    <ScreenScaffold title="Edit Profile" subtitle="Change your public details, bio, and links without changing the underlying profile contracts.">
      <Card style={styles.inlineCard}>
        <View style={styles.editAvatarWrap}>
          <ProfileAvatar name={displayName || currentProfile.displayName} />
          <Pressable style={styles.inlineButton}>
            <Text variant="caption" color={ACCENT}>Change Photo</Text>
          </Pressable>
        </View>
        <Text variant="label" color={colors.textSecondary}>Display Name</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display Name" placeholderTextColor={colors.textTertiary} style={styles.input} />
        <Text variant="label" color={colors.textSecondary}>Bio</Text>
        <TextInput value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.largeInput]} />
        <Text variant="label" color={colors.textSecondary}>Location</Text>
        <TextInput value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor={colors.textTertiary} style={styles.input} />
        <Text variant="label" color={colors.textSecondary}>Website</Text>
        <TextInput value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://..." placeholderTextColor={colors.textTertiary} style={styles.input} />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            saveProfile({
              displayName: displayName.trim() || currentProfile.displayName,
              bio: bio.trim(),
              location: location.trim(),
              websiteUrl,
            });
            Alert.alert('Profile saved', 'Your forum profile has been updated locally and is ready for sync.');
          }}
        >
          <Text variant="caption" color="#FFFFFF">Save</Text>
        </Pressable>
      </Card>
      <Card style={[styles.inlineCard, styles.dangerCard]}>
        <Text variant="subheading" color={colors.danger}>Delete Account</Text>
        <Text variant="body" color={colors.textSecondary}>Account deletion stays a protected flow. This card is the redesigned entry point.</Text>
      </Card>
    </ScreenScaffold>
  );
}

export function ForumsUserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const {
    findProfile,
    badgesForProfile,
    threads,
    repliesForThread,
    findCommunity,
    findConversationByParticipant,
    getConversationStateById,
    sendMessage,
  } = useForumsData();
  const profile = findProfile(getParamValue(params.profileId));
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');
  const [blocked, setBlocked] = useState(false);

  const posts = threads.filter((thread) => thread.authorId === profile.id);
  const replies = threads.flatMap((thread) => repliesForThread(thread.id).filter((reply) => reply.authorId === profile.id));
  const existingConversation = findConversationByParticipant(profile.id);
  const existingConversationState = existingConversation
    ? getConversationStateById(existingConversation.id)
    : null;

  return (
    <ScreenScaffold title={profile.displayName} subtitle={`@${profile.username} · joined ${new Date(profile.createdAt).toLocaleDateString()}`}>
      <Card style={styles.inlineCard}>
        <View style={styles.profileHeader}>
          <ProfileAvatar name={profile.displayName} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="heading">{profile.displayName}</Text>
            <Text variant="body" color={colors.textSecondary}>
              Verified · {profile.karma} karma
            </Text>
          </View>
        </View>
        <View style={styles.statGrid}>
          <StatCard label="Posts" value={String(profile.threadCount)} />
          <StatCard label="Replies" value={String(profile.replyCount)} />
          <StatCard label="Karma" value={String(profile.karma)} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {badgesForProfile(profile.id).map((badge) => (
              <View key={badge.id} style={styles.badgeChip}>
                <Text variant="caption" color={ACCENT}>{badge.icon}</Text>
                <Text variant="caption" color={colors.text}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        {blocked ? (
          <Card style={[styles.inlineCard, styles.warningCard]}>
            <Text variant="subheading">You have blocked this user</Text>
            <Pressable style={styles.inlineButton} onPress={() => setBlocked(false)}>
              <Text variant="caption" color={ACCENT}>Unblock</Text>
            </Pressable>
          </Card>
        ) : (
          <View style={styles.rowWrap}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                try {
                  const conversationId = sendMessage({
                    conversationId: existingConversation?.id,
                    recipientName: profile.displayName,
                    recipientProfileId: profile.id,
                    body: `Hey ${profile.displayName.split(' ')[0]}, reaching out from your profile.`,
                    requestState: existingConversationState?.requestState ?? 'outgoing',
                  });
                  router.push(`/(forums)/conversation?conversationId=${encodeURIComponent(conversationId)}` as never);
                } catch (error) {
                  Alert.alert('Message failed', error instanceof Error ? error.message : 'Unable to open conversation.');
                }
              }}
            >
              <Text variant="caption" color={ACCENT}>Message</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonSmall}>
              <Text variant="caption" color="#FFFFFF">Follow</Text>
            </Pressable>
            <Pressable style={styles.inlineButton} onPress={() => setBlocked(true)}>
              <Text variant="caption" color={colors.danger}>Block</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <View style={styles.chipRow}>
        <Chip label="Posts" active={tab === 'posts'} onPress={() => setTab('posts')} />
        <Chip label="Replies" active={tab === 'replies'} onPress={() => setTab('replies')} />
      </View>

      {tab === 'posts'
        ? posts.map((thread) => (
            <Card key={thread.id} style={styles.inlineCard}>
              <Text variant="subheading">{thread.title}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {findCommunity(thread.communityId).displayName} · {formatRelativeTime(thread.createdAt)}
              </Text>
            </Card>
          ))
        : replies.map((reply) => (
            <Card key={reply.id} style={styles.inlineCard}>
              <Text variant="body">{reply.body}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {formatRelativeTime(reply.createdAt)}
              </Text>
            </Card>
          ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 80,
    gap: spacing.md,
  },
  heroCard: {
    ...glass.strong,
    padding: spacing.lg,
    gap: spacing.sm,
    borderColor: 'rgba(124,77,255,0.22)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(124,77,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,77,255,0.22)',
  },
  heroText: {
    marginTop: spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    minWidth: 104,
    flexGrow: 1,
    gap: spacing.xs,
  },
  threadCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  voteRail: {
    width: 28,
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.xs,
  },
  pinnedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(124,77,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,77,255,0.22)',
  },
  communityPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineCard: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 36,
  },
  centerText: {
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  mediumInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  largeInput: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  inlineButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(124,77,255,0.12)',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    backgroundColor: ACCENT,
  },
  primaryButtonSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: 'rgba(124,77,255,0.08)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  horizontalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badgeChip: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineUnread: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  timelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(124,77,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  relevanceBar: {
    width: 42,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  relevanceFill: {
    width: '74%',
    height: '100%',
    backgroundColor: ACCENT,
  },
  actionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(124,77,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,77,255,0.22)',
  },
  healthBar: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  healthBarFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  messagingScreen: {
    flex: 1,
    backgroundColor: '#0E0E13',
  },
  messagingBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  messagingTopBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14,14,19,0.86)',
  },
  messagingTopIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messagingTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  messagingList: {
    flex: 1,
  },
  messagingHeaderBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  messagingHeroTitle: {
    fontSize: 34,
    lineHeight: 38,
  },
  messagingFilters: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  requestBannerCard: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(124,77,255,0.1)',
  },
  requestBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reviewButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
  },
  messagingEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  messagingAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  messagingAvatarDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: '#30D158',
    borderWidth: 2,
    borderColor: '#0E0E13',
  },
  swipeRowShell: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    justifyContent: 'center',
  },
  swipeRowLeftAction: {
    position: 'absolute',
    left: spacing.md,
    top: 0,
    bottom: spacing.sm,
    width: 84,
    borderRadius: borderRadius.xl,
    backgroundColor: '#30D158',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  swipeRowRightActions: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: spacing.sm,
    width: 128,
    flexDirection: 'row',
    gap: 8,
  },
  swipeActionArchive: {
    flex: 1,
    borderRadius: borderRadius.xl,
    backgroundColor: '#35343A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionDelete: {
    flex: 1,
    borderRadius: borderRadius.xl,
    backgroundColor: '#93000A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeRowCardHost: {
    borderRadius: borderRadius.xl,
  },
  inboxRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.045)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  inboxRowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  inboxRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inboxRowIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  requestPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(124,77,255,0.2)',
  },
  inboxRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inboxPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  inboxPreviewText: {
    fontStyle: 'italic',
    flex: 1,
  },
  inboxMetaRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  humansOnlyPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(124,77,255,0.12)',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.56)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalSheet: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#16161E',
  },
  modalList: {
    gap: spacing.sm,
  },
  requestSheetCard: {
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  requestSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  primaryActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatScreen: {
    flex: 1,
    backgroundColor: '#0E0E13',
  },
  chatHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(14,14,19,0.88)',
  },
  chatHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestBannerInline: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chatList: {
    flex: 1,
  },
  chatEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  recordingPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,69,58,0.86)',
  },
  chatComposerShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: 'rgba(14,14,19,0.92)',
  },
  attachmentTray: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  attachmentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chatIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInputWrap: {
    flex: 1,
    paddingVertical: 6,
  },
  chatInput: {
    minHeight: 24,
    maxHeight: 110,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  voiceRecordButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C412A',
  },
  chatMenuSheet: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#16161E',
  },
  chatMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  fingerprintGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fingerprintCell: {
    minWidth: 78,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  chatMessageRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
  },
  chatMessageRowMine: {
    justifyContent: 'flex-end',
  },
  chatMessageRowOther: {
    justifyContent: 'flex-start',
  },
  chatBubbleCard: {
    maxWidth: '82%',
    padding: spacing.md,
    borderRadius: 22,
    gap: spacing.sm,
  },
  chatBubbleCardMine: {
    backgroundColor: ACCENT,
    borderTopRightRadius: 8,
  },
  chatBubbleCardOther: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 8,
  },
  handshakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkPreviewCard: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  imageAttachment: {
    height: 132,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  voiceAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  voicePlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  voiceWaveBar: {
    width: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  chatMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  newMessageHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14,14,19,0.88)',
  },
  newMessageSendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
  },
  newMessageSendButtonDisabled: {
    opacity: 0.45,
  },
  selectedRecipientCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selectedRecipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recipientResultCard: {
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  recipientResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recipientSelectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
  },
  noticeCard: {
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  newMessageComposerCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  newMessageComposerInput: {
    minHeight: 188,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.text,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
  },
  newMessageComposerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  chatRow: {
    flexDirection: 'row',
  },
  chatRowMine: {
    justifyContent: 'flex-end',
  },
  chatRowOther: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '82%',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    gap: spacing.xs,
  },
  chatBubbleMine: {
    backgroundColor: ACCENT,
  },
  chatBubbleOther: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editAvatarWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningCard: {
    borderColor: 'rgba(255,214,10,0.28)',
  },
  dangerCard: {
    borderColor: 'rgba(255,69,58,0.22)',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    minWidth: 118,
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 10,
  },
  fabText: {
    fontWeight: '700',
  },
});
