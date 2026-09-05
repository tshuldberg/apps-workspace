'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import type {
  Community,
  CreateCommunityInput,
  CommunityMember,
  Thread,
  CreateThreadInput,
  Reply,
  CreateReplyInput,
  Bookmark,
  ModAction,
  CommunityRule,
  Tag,
} from '@mylife/forums';
import {
  getCachedCommunities,
  getCachedCommunityById,
  getCachedCommunityByName,
  upsertCachedCommunity,
  getCachedCommunityMembers,
  upsertCachedCommunityMember,
  getCachedThreads,
  getCachedThreadById,
  upsertCachedThread,
  deleteCachedThread,
  getCachedReplies,
  upsertCachedReply,
  getCachedBookmarks,
  upsertCachedBookmark,
  deleteCachedBookmark,
  getCachedTags,
  upsertCachedTag,
  getCachedProfileById,
  getCachedProfileByUsername,
  upsertCachedProfile,
  getCachedConversations,
  getCachedConversationById,
  upsertCachedConversation,
  getCachedMessages,
  upsertCachedMessage,
  getCachedActivity,
  upsertCachedActivity,
  type DatabaseAdapter as ForumsDatabaseAdapter,
  type UserProfile,
  type Conversation,
  type DirectMessage,
  type ForumActivity,
  type ForumActivityFeedPage,
  type ForumActivityFilter,
  getActivityFeed,
  markActivityRead,
  markAllActivityRead,
} from '@mylife/forums';

/**
 * Bridge between @mylife/db DatabaseAdapter (execute/query) and
 * @mylife/forums DatabaseAdapter (run/get/all).
 */
function forumDb(): ForumsDatabaseAdapter {
  const adapter = getAdapter();
  ensureModuleMigrations('forums');
  return {
    run: (sql: string, params?: unknown[]) => adapter.execute(sql, params),
    get: <T>(sql: string, params?: unknown[]): T | undefined =>
      adapter.query<T>(sql, params)[0],
    all: <T>(sql: string, params?: unknown[]): T[] =>
      adapter.query<T>(sql, params),
  };
}

// ── Community CRUD ──────────────────────────────────────────────────

export async function fetchCommunities(options?: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<Community[]> {
  return getCachedCommunities(forumDb(), options);
}

export async function fetchCommunityById(
  id: string,
): Promise<Community | undefined> {
  return getCachedCommunityById(forumDb(), id);
}

export async function fetchCommunityByName(
  name: string,
): Promise<Community | undefined> {
  return getCachedCommunityByName(forumDb(), name);
}

export async function createCommunityAction(
  input: CreateCommunityInput,
): Promise<Community> {
  const db = forumDb();
  const now = new Date().toISOString();
  const community: Community = {
    id: crypto.randomUUID(),
    creatorId: 'local-user',
    name: input.name,
    displayName: input.displayName,
    description: input.description ?? null,
    iconUrl: null,
    bannerUrl: null,
    communityType: input.communityType ?? 'public',
    humansOnly: input.humansOnly ?? false,
    linkedModuleId: input.linkedModuleId ?? null,
    memberCount: 1,
    threadCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  upsertCachedCommunity(db, community);
  // Auto-join creator
  upsertCachedCommunityMember(db, {
    id: crypto.randomUUID(),
    communityId: community.id,
    profileId: 'local-user',
    role: 'owner',
    status: 'active',
    joinedAt: now,
  });
  return community;
}

export async function fetchCommunityMembers(
  communityId: string,
): Promise<CommunityMember[]> {
  return getCachedCommunityMembers(forumDb(), communityId);
}

export async function joinCommunityAction(
  communityId: string,
): Promise<void> {
  const db = forumDb();
  upsertCachedCommunityMember(db, {
    id: crypto.randomUUID(),
    communityId,
    profileId: 'local-user',
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
  });
  const community = getCachedCommunityById(db, communityId);
  if (community) {
    upsertCachedCommunity(db, {
      ...community,
      memberCount: community.memberCount + 1,
    });
  }
}

export async function leaveCommunityAction(
  communityId: string,
): Promise<void> {
  const db = forumDb();
  // Delete the member record
  db.run(
    'DELETE FROM fr_community_members_cache WHERE community_id = ? AND profile_id = ?',
    [communityId, 'local-user'],
  );
  // Decrement community member count
  const community = getCachedCommunityById(db, communityId);
  if (community) {
    upsertCachedCommunity(db, {
      ...community,
      memberCount: Math.max(0, community.memberCount - 1),
    });
  }
}

export async function fetchCommunityRules(
  _communityId: string,
): Promise<CommunityRule[]> {
  return [
    {
      id: crypto.randomUUID(),
      communityId: _communityId,
      title: 'Contribute with context',
      description: 'Threads should add perspective, evidence, or a useful question instead of link-only drops.',
      position: 0,
    },
    {
      id: crypto.randomUUID(),
      communityId: _communityId,
      title: 'Protect human discussion',
      description: 'Use clear sourcing, avoid spam patterns, and flag suspicious automation or brigading.',
      position: 1,
    },
    {
      id: crypto.randomUUID(),
      communityId: _communityId,
      title: 'Keep moderation legible',
      description: 'If you remove or escalate content, leave enough context for others to understand the standard.',
      position: 2,
    },
  ];
}

export async function fetchCommunityTags(
  communityId: string,
): Promise<Tag[]> {
  return getCachedTags(forumDb(), communityId);
}

export async function fetchJoinedCommunityIds(): Promise<string[]> {
  const db = forumDb();
  return db
    .all<{ communityId: string }>(
      `SELECT community_id as communityId
       FROM fr_community_members_cache
       WHERE profile_id = ? AND status = 'active'
       ORDER BY joined_at DESC`,
      ['local-user'],
    )
    .map((row) => row.communityId);
}

export async function fetchJoinedCommunities(): Promise<Community[]> {
  const db = forumDb();
  return db.all<Community>(
    `SELECT c.id, c.creator_id as creatorId, c.name, c.display_name as displayName,
            c.description, c.icon_url as iconUrl, c.banner_url as bannerUrl,
            c.community_type as communityType, c.humans_only as humansOnly,
            c.linked_module_id as linkedModuleId, c.member_count as memberCount,
            c.thread_count as threadCount, c.created_at as createdAt, c.updated_at as updatedAt
     FROM fr_communities_cache c
     INNER JOIN fr_community_members_cache m ON m.community_id = c.id
     WHERE m.profile_id = ? AND m.status = 'active'
     ORDER BY c.member_count DESC, c.display_name COLLATE NOCASE ASC`,
    ['local-user'],
  );
}

export async function updateCommunityAction(
  communityId: string,
  input: Partial<Pick<Community, 'displayName' | 'description' | 'communityType' | 'humansOnly' | 'linkedModuleId'>>,
): Promise<Community | undefined> {
  const db = forumDb();
  const existing = getCachedCommunityById(db, communityId);
  if (!existing) return undefined;
  const updated: Community = {
    ...existing,
    ...(input.displayName !== undefined && { displayName: input.displayName }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.communityType !== undefined && { communityType: input.communityType }),
    ...(input.humansOnly !== undefined && { humansOnly: input.humansOnly }),
    ...(input.linkedModuleId !== undefined && { linkedModuleId: input.linkedModuleId }),
    updatedAt: new Date().toISOString(),
  };
  upsertCachedCommunity(db, updated);
  return updated;
}

// ── Thread CRUD ─────────────────────────────────────────────────────

export async function fetchThreads(
  communityId: string,
  options?: { sort?: 'new' | 'hot' | 'top'; limit?: number; offset?: number },
): Promise<Thread[]> {
  return getCachedThreads(forumDb(), communityId, options);
}

export async function fetchAllThreads(
  options?: { sort?: 'new' | 'hot' | 'top'; limit?: number; offset?: number },
): Promise<Thread[]> {
  const db = forumDb();
  const orderBy =
    options?.sort === 'top'
      ? 'vote_score DESC'
      : options?.sort === 'hot'
        ? 'vote_score DESC, created_at DESC'
        : 'created_at DESC';
  const limitVal = options?.limit ?? 50;
  const offsetVal = options?.offset ?? 0;
  return db.all<Thread>(
    `SELECT id, community_id as communityId, author_id as authorId, title, body,
            status, is_pinned as isPinned, vote_score as voteScore,
            reply_count as replyCount, view_count as viewCount,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_threads_cache WHERE status = 'open'
     ORDER BY is_pinned DESC, ${orderBy} LIMIT ? OFFSET ?`,
    [limitVal, offsetVal],
  );
}

export async function fetchThreadById(
  id: string,
): Promise<Thread | undefined> {
  return getCachedThreadById(forumDb(), id);
}

export async function createThreadAction(
  input: CreateThreadInput,
): Promise<Thread> {
  const db = forumDb();
  const now = new Date().toISOString();
  const thread: Thread = {
    id: crypto.randomUUID(),
    communityId: input.communityId,
    authorId: 'local-user',
    title: input.title,
    body: input.body,
    status: 'open',
    isPinned: false,
    voteScore: 1,
    replyCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  upsertCachedThread(db, thread);
  // Increment community thread count
  const community = getCachedCommunityById(db, input.communityId);
  if (community) {
    upsertCachedCommunity(db, {
      ...community,
      threadCount: community.threadCount + 1,
    });
  }
  return thread;
}

export async function deleteThreadAction(id: string): Promise<void> {
  const db = forumDb();
  const thread = getCachedThreadById(db, id);
  if (thread) {
    deleteCachedThread(db, id);
    const community = getCachedCommunityById(db, thread.communityId);
    if (community) {
      upsertCachedCommunity(db, {
        ...community,
        threadCount: Math.max(0, community.threadCount - 1),
      });
    }
  }
}

/** Escape LIKE wildcard characters to prevent pattern injection. */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

export async function searchThreadsAction(
  query: string,
): Promise<Thread[]> {
  const db = forumDb();
  const q = `%${escapeLike(query)}%`;
  return db.all<Thread>(
    `SELECT id, community_id as communityId, author_id as authorId, title, body,
            status, is_pinned as isPinned, vote_score as voteScore,
            reply_count as replyCount, view_count as viewCount,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_threads_cache WHERE (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') AND status = 'open'
     ORDER BY vote_score DESC LIMIT 50`,
    [q, q],
  );
}

export async function searchCommunitiesAction(
  query: string,
): Promise<Community[]> {
  const db = forumDb();
  const q = `%${escapeLike(query)}%`;
  return db.all<Community>(
    `SELECT id, creator_id as creatorId, name, display_name as displayName,
            description, icon_url as iconUrl, banner_url as bannerUrl,
            community_type as communityType, humans_only as humansOnly,
            linked_module_id as linkedModuleId,
            member_count as memberCount, thread_count as threadCount,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_communities_cache WHERE display_name LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
     ORDER BY member_count DESC LIMIT 20`,
    [q, q, q],
  );
}

export async function searchRepliesAction(
  query: string,
): Promise<Array<Reply & { threadTitle: string | null; communityId: string | null }>> {
  const db = forumDb();
  const q = `%${escapeLike(query)}%`;
  return db.all<Array<Reply & { threadTitle: string | null; communityId: string | null }>[number]>(
    `SELECT r.id, r.thread_id as threadId, r.parent_reply_id as parentReplyId,
            r.author_id as authorId, r.body, r.vote_score as voteScore, r.depth,
            r.status, r.created_at as createdAt, r.updated_at as updatedAt,
            t.title as threadTitle, t.community_id as communityId
     FROM fr_replies_cache r
     LEFT JOIN fr_threads_cache t ON t.id = r.thread_id
     WHERE r.body LIKE ? ESCAPE '\\' AND r.status = 'open'
     ORDER BY r.created_at DESC LIMIT 50`,
    [q],
  );
}

export async function searchProfilesAction(
  query: string,
): Promise<UserProfile[]> {
  const db = forumDb();
  const q = `%${escapeLike(query)}%`;
  return db.all<UserProfile>(
    `SELECT id, user_id as userId, display_name as displayName, username, bio,
            avatar_url as avatarUrl, banner_url as bannerUrl, status_text as statusText,
            status_emoji as statusEmoji, location, website_url as websiteUrl,
            karma, thread_count as threadCount, reply_count as replyCount,
            communities_joined as communitiesJoined, is_verified as isVerified,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_profiles_cache
     WHERE display_name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\' OR bio LIKE ? ESCAPE '\\'
     ORDER BY karma DESC, display_name COLLATE NOCASE ASC LIMIT 30`,
    [q, q, q],
  );
}

// ── Replies ─────────────────────────────────────────────────────────

export async function fetchReplies(
  threadId: string,
  options?: { parentReplyId?: string | null; limit?: number },
): Promise<Reply[]> {
  return getCachedReplies(forumDb(), threadId, options);
}

export async function createReplyAction(
  input: CreateReplyInput,
): Promise<Reply> {
  const db = forumDb();
  const now = new Date().toISOString();
  // Determine depth from parent
  let depth = 0;
  if (input.parentReplyId) {
    const parent = db.get<{ depth: number }>(
      'SELECT depth FROM fr_replies_cache WHERE id = ?',
      [input.parentReplyId],
    );
    if (parent) depth = parent.depth + 1;
  }
  const reply: Reply = {
    id: crypto.randomUUID(),
    threadId: input.threadId,
    parentReplyId: input.parentReplyId ?? null,
    authorId: 'local-user',
    body: input.body,
    voteScore: 1,
    depth,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  upsertCachedReply(db, reply);
  // Increment thread reply count
  const thread = getCachedThreadById(db, input.threadId);
  if (thread) {
    upsertCachedThread(db, {
      ...thread,
      replyCount: thread.replyCount + 1,
    });
  }
  return reply;
}

// ── Voting ──────────────────────────────────────────────────────────

export async function castVoteAction(
  targetType: 'thread' | 'reply',
  targetId: string,
  direction: 'up' | 'down',
): Promise<{ newScore: number }> {
  const db = forumDb();
  // Check for existing vote to prevent duplicates
  const existingVote = db.get<{ direction: string }>(
    `SELECT direction FROM fr_votes_local WHERE target_type = ? AND target_id = ? AND profile_id = ?`,
    [targetType, targetId, 'local-user'],
  );
  // If same vote exists, treat as no-op
  if (existingVote?.direction === direction) {
    if (targetType === 'thread') {
      const thread = getCachedThreadById(db, targetId);
      return { newScore: thread?.voteScore ?? 0 };
    }
    const reply = db.get<{ voteScore: number }>(
      `SELECT vote_score as voteScore FROM fr_replies_cache WHERE id = ?`,
      [targetId],
    );
    return { newScore: reply?.voteScore ?? 0 };
  }
  // If opposite vote exists, delta is 2 (undo old + apply new)
  const delta = existingVote ? (direction === 'up' ? 2 : -2) : (direction === 'up' ? 1 : -1);
  // Record the vote
  db.run(
    `INSERT OR REPLACE INTO fr_votes_local (target_type, target_id, profile_id, direction)
     VALUES (?, ?, ?, ?)`,
    [targetType, targetId, 'local-user', direction],
  );
  if (targetType === 'thread') {
    const thread = getCachedThreadById(db, targetId);
    if (thread) {
      const newScore = thread.voteScore + delta;
      upsertCachedThread(db, { ...thread, voteScore: newScore });
      return { newScore };
    }
  } else {
    const reply = db.get<Reply>(
      `SELECT id, thread_id as threadId, parent_reply_id as parentReplyId,
              author_id as authorId, body, vote_score as voteScore, depth,
              status, created_at as createdAt, updated_at as updatedAt
       FROM fr_replies_cache WHERE id = ?`,
      [targetId],
    );
    if (reply) {
      const newScore = reply.voteScore + delta;
      upsertCachedReply(db, { ...reply, voteScore: newScore });
      return { newScore };
    }
  }
  return { newScore: 0 };
}

// ── Bookmarks ───────────────────────────────────────────────────────

export async function fetchBookmarks(): Promise<Bookmark[]> {
  return getCachedBookmarks(forumDb(), 'local-user');
}

export async function toggleBookmarkAction(
  threadId: string,
): Promise<{ bookmarked: boolean }> {
  const db = forumDb();
  const existing = getCachedBookmarks(db, 'local-user').find(
    (b) => b.threadId === threadId,
  );
  if (existing) {
    deleteCachedBookmark(db, existing.id);
    return { bookmarked: false };
  }
  upsertCachedBookmark(db, {
    id: crypto.randomUUID(),
    profileId: 'local-user',
    threadId,
    createdAt: new Date().toISOString(),
  });
  return { bookmarked: true };
}

// ── Profile ─────────────────────────────────────────────────────────

export async function fetchProfile(
  profileId: string,
): Promise<UserProfile | undefined> {
  return getCachedProfileById(forumDb(), profileId);
}

export async function fetchProfileByUsername(
  username: string,
): Promise<UserProfile | undefined> {
  return getCachedProfileByUsername(forumDb(), username);
}

export async function fetchMyProfile(): Promise<UserProfile | undefined> {
  const db = forumDb();
  return db.get<UserProfile>(
    `SELECT id, user_id as userId, display_name as displayName, username, bio,
            avatar_url as avatarUrl, banner_url as bannerUrl,
            status_text as statusText, status_emoji as statusEmoji,
            location, website_url as websiteUrl, karma,
            thread_count as threadCount, reply_count as replyCount,
            communities_joined as communitiesJoined,
            is_verified as isVerified,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_profiles_cache WHERE user_id = ?`,
    ['local-user'],
  );
}

export async function createProfileAction(input: {
  displayName: string;
  username: string;
  bio?: string;
}): Promise<UserProfile> {
  const db = forumDb();
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id: crypto.randomUUID(),
    userId: 'local-user',
    displayName: input.displayName,
    username: input.username,
    bio: input.bio ?? '',
    avatarUrl: null,
    bannerUrl: null,
    statusText: '',
    statusEmoji: '',
    location: '',
    websiteUrl: null,
    karma: 0,
    threadCount: 0,
    replyCount: 0,
    communitiesJoined: 0,
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  };
  upsertCachedProfile(db, profile);
  return profile;
}

export async function updateProfileAction(
  profileId: string,
  input: {
    displayName?: string;
    bio?: string;
    statusText?: string;
    statusEmoji?: string;
    location?: string;
    websiteUrl?: string | null;
  },
): Promise<UserProfile | undefined> {
  const db = forumDb();
  const existing = getCachedProfileById(db, profileId);
  if (!existing) return undefined;
  const updated: UserProfile = {
    ...existing,
    ...(input.displayName !== undefined && { displayName: input.displayName }),
    ...(input.bio !== undefined && { bio: input.bio }),
    ...(input.statusText !== undefined && { statusText: input.statusText }),
    ...(input.statusEmoji !== undefined && { statusEmoji: input.statusEmoji }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.websiteUrl !== undefined && { websiteUrl: input.websiteUrl }),
    updatedAt: new Date().toISOString(),
  };
  upsertCachedProfile(db, updated);
  return updated;
}

export async function fetchProfilesByIds(profileIds: string[]): Promise<UserProfile[]> {
  const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  return forumDb().all<UserProfile>(
    `SELECT id, user_id as userId, display_name as displayName, username, bio,
            avatar_url as avatarUrl, banner_url as bannerUrl, status_text as statusText,
            status_emoji as statusEmoji, location, website_url as websiteUrl,
            karma, thread_count as threadCount, reply_count as replyCount,
            communities_joined as communitiesJoined, is_verified as isVerified,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_profiles_cache
     WHERE id IN (${placeholders})`,
    uniqueIds,
  );
}

export async function fetchThreadsByAuthor(profileId: string): Promise<Thread[]> {
  return forumDb().all<Thread>(
    `SELECT id, community_id as communityId, author_id as authorId, title, body,
            status, is_pinned as isPinned, vote_score as voteScore,
            reply_count as replyCount, view_count as viewCount,
            created_at as createdAt, updated_at as updatedAt
     FROM fr_threads_cache
     WHERE author_id = ? AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 30`,
    [profileId],
  );
}

export async function fetchRepliesByAuthor(
  profileId: string,
): Promise<Array<Reply & { threadTitle: string | null; communityId: string | null }>> {
  return forumDb().all<Array<Reply & { threadTitle: string | null; communityId: string | null }>[number]>(
    `SELECT r.id, r.thread_id as threadId, r.parent_reply_id as parentReplyId,
            r.author_id as authorId, r.body, r.vote_score as voteScore,
            r.depth, r.status, r.created_at as createdAt, r.updated_at as updatedAt,
            t.title as threadTitle, t.community_id as communityId
     FROM fr_replies_cache r
     LEFT JOIN fr_threads_cache t ON t.id = r.thread_id
     WHERE r.author_id = ? AND r.status = 'open'
     ORDER BY r.created_at DESC
     LIMIT 30`,
    [profileId],
  );
}

export async function fetchCommunitiesForProfile(profileId: string): Promise<Community[]> {
  return forumDb().all<Community>(
    `SELECT c.id, c.creator_id as creatorId, c.name, c.display_name as displayName,
            c.description, c.icon_url as iconUrl, c.banner_url as bannerUrl,
            c.community_type as communityType, c.humans_only as humansOnly,
            c.linked_module_id as linkedModuleId, c.member_count as memberCount,
            c.thread_count as threadCount, c.created_at as createdAt, c.updated_at as updatedAt
     FROM fr_communities_cache c
     INNER JOIN fr_community_members_cache m ON m.community_id = c.id
     WHERE m.profile_id = ? AND m.status = 'active'
     ORDER BY c.member_count DESC, c.display_name COLLATE NOCASE ASC
     LIMIT 20`,
    [profileId],
  );
}

// ── Messaging ───────────────────────────────────────────────────────

export async function fetchConversations(): Promise<Conversation[]> {
  return getCachedConversations(forumDb());
}

export async function fetchConversationById(
  id: string,
): Promise<Conversation | undefined> {
  return getCachedConversationById(forumDb(), id);
}

export async function createConversationAction(input: {
  participantIds: string[];
  title?: string;
  isGroup?: boolean;
}): Promise<Conversation> {
  const db = forumDb();
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title: input.title ?? null,
    isGroup: input.isGroup ?? false,
    createdBy: 'local-user',
    lastMessageAt: null,
    lastMessagePreview: null,
    createdAt: now,
    updatedAt: now,
  };
  upsertCachedConversation(db, conv);
  return conv;
}

export async function fetchMessages(
  conversationId: string,
  options?: { limit?: number },
): Promise<DirectMessage[]> {
  return getCachedMessages(forumDb(), conversationId, options);
}

export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
}): Promise<DirectMessage> {
  const db = forumDb();
  const now = new Date().toISOString();
  const msg: DirectMessage = {
    id: crypto.randomUUID(),
    conversationId: input.conversationId,
    senderId: 'local-user',
    body: input.body,
    mediaUrl: null,
    mediaType: null,
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
  upsertCachedMessage(db, msg);
  // Update conversation preview
  const conv = getCachedConversationById(db, input.conversationId);
  if (conv) {
    upsertCachedConversation(db, {
      ...conv,
      lastMessageAt: now,
      lastMessagePreview: input.body.slice(0, 200),
      updatedAt: now,
    });
  }
  return msg;
}

// ── Moderation ──────────────────────────────────────────────────────

export async function fetchModLog(
  communityId: string,
): Promise<ModAction[]> {
  const threads = await fetchThreads(communityId, { sort: 'top', limit: 5 });
  const community = await fetchCommunityById(communityId);
  const now = Date.now();
  if (threads.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        communityId,
        moderatorId: 'local-user',
        actionType: 'edit_community',
        targetId: communityId,
        reason: `Updated posting guidance for ${community?.displayName ?? 'this community'}.`,
        createdAt: new Date(now - 1000 * 60 * 80).toISOString(),
      },
    ];
  }
  return threads.slice(0, 4).map((thread, index) => ({
    id: crypto.randomUUID(),
    communityId,
    moderatorId: 'local-user',
    actionType: index % 2 === 0 ? 'pin_thread' : 'lock_thread',
    targetId: thread.id,
    reason:
      index % 2 === 0
        ? `Pinned "${thread.title}" for context and visibility.`
        : `Temporarily locked "${thread.title}" after escalation in replies.`,
    createdAt: new Date(now - (index + 1) * 1000 * 60 * 95).toISOString(),
  }));
}

function ensureActivitySeed(db: ForumsDatabaseAdapter): void {
  const existing = getCachedActivity(db, 'local-user', { limit: 1 });
  if (existing.length > 0) return;
  const now = Date.now();
  const seed: ForumActivity[] = [
    {
      id: 'fr-activity-mention-seed',
      profileId: 'local-user',
      actorProfileId: 'seed-actor-1',
      actorName: 'Maya Chen',
      actorTrustTier: 'trusted',
      type: 'mention',
      verb: 'mentioned you in',
      context: 'Visible norms for humans-only communities',
      detail: 'Asked for your take on moderation transparency and trust signals.',
      targetType: 'thread',
      targetId: 'seed-thread-1',
      communityId: 'seed-community-1',
      threadId: 'seed-thread-1',
      conversationId: null,
      targetProfileId: null,
      createdAt: new Date(now - 1000 * 60 * 42).toISOString(),
      readAt: null,
    },
    {
      id: 'fr-activity-reply-seed',
      profileId: 'local-user',
      actorProfileId: 'seed-actor-2',
      actorName: 'Leo Park',
      actorTrustTier: 'highly_trusted',
      type: 'reply',
      verb: 'replied to',
      context: 'How should trusted communities handle reposts?',
      detail: 'Expanded on keeping context visible when threads are merged.',
      targetType: 'thread',
      targetId: 'seed-thread-2',
      communityId: 'seed-community-2',
      threadId: 'seed-thread-2',
      conversationId: null,
      targetProfileId: null,
      createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
      readAt: null,
    },
    {
      id: 'fr-activity-vote-seed',
      profileId: 'local-user',
      actorProfileId: 'seed-actor-3',
      actorName: 'Nina Alvarez',
      actorTrustTier: 'mod',
      type: 'vote',
      verb: 'upvoted your',
      context: 'Moderator checklist for launch week',
      detail: 'That thread crossed another wave of saves and replies.',
      targetType: 'thread',
      targetId: 'seed-thread-3',
      communityId: 'seed-community-1',
      threadId: 'seed-thread-3',
      conversationId: null,
      targetProfileId: null,
      createdAt: new Date(now - 1000 * 60 * 60 * 19).toISOString(),
      readAt: null,
    },
    {
      id: 'fr-activity-invite-seed',
      profileId: 'local-user',
      actorProfileId: 'seed-actor-4',
      actorName: 'Soraya West',
      actorTrustTier: 'trusted',
      type: 'invite',
      verb: 'invited you to',
      context: 'Design Critique Circle',
      detail: 'Join the moderators room before the next weekly review.',
      targetType: 'community',
      targetId: 'seed-community-3',
      communityId: 'seed-community-3',
      threadId: null,
      conversationId: null,
      targetProfileId: null,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
      readAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
  ];
  for (const item of seed) upsertCachedActivity(db, item);
}

export async function fetchActivityFeedAction(
  filter: ForumActivityFilter = 'all',
): Promise<ForumActivityFeedPage> {
  const db = forumDb();
  ensureActivitySeed(db);
  return getActivityFeed(db, 'local-user', filter, 0, 48);
}

export async function markActivityReadAction(activityId: string): Promise<void> {
  markActivityRead(forumDb(), activityId, new Date().toISOString());
}

export async function markAllActivityReadAction(
  filter: ForumActivityFilter = 'all',
): Promise<void> {
  markAllActivityRead(forumDb(), 'local-user', filter, new Date().toISOString());
}

// ── Tags ────────────────────────────────────────────────────────────

export async function createTagAction(
  communityId: string,
  name: string,
  color?: string,
): Promise<Tag> {
  const db = forumDb();
  const tag: Tag = {
    id: crypto.randomUUID(),
    communityId,
    name,
    color: color ?? null,
  };
  upsertCachedTag(db, tag);
  return tag;
}
