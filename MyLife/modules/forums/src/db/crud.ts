/**
 * Local SQLite CRUD operations for the forums cache.
 * These read/write from the local cache tables for offline support.
 * Write-through to Supabase happens via the cloud client.
 */

import type {
  Community,
  CommunityMember,
  Thread,
  Reply,
  Bookmark,
  Tag,
} from '../types';
import type { ForumActivity, ForumActivityFilter } from '../models/activity';
import type { UserProfile } from '../models/profile';
import type { Conversation, DirectMessage } from '../models/messaging';

/** Database adapter interface matching the hub's SQLite wrapper. */
export interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): void;
  get<T>(sql: string, params?: unknown[]): T | undefined;
  all<T>(sql: string, params?: unknown[]): T[];
}

const COMMUNITY_COLUMNS = [
  'id',
  'creator_id as creatorId',
  'name',
  'display_name as displayName',
  'description',
  'icon_url as iconUrl',
  'banner_url as bannerUrl',
  'community_type as communityType',
  'humans_only as humansOnly',
  'linked_module_id as linkedModuleId',
  'member_count as memberCount',
  'thread_count as threadCount',
  'created_at as createdAt',
  'updated_at as updatedAt',
].join(', ');

const MEMBER_COLUMNS = [
  'id',
  'community_id as communityId',
  'profile_id as profileId',
  'role',
  'status',
  'joined_at as joinedAt',
].join(', ');

const THREAD_COLUMNS = [
  'id',
  'community_id as communityId',
  'author_id as authorId',
  'title',
  'body',
  'status',
  'is_pinned as isPinned',
  'vote_score as voteScore',
  'reply_count as replyCount',
  'view_count as viewCount',
  'created_at as createdAt',
  'updated_at as updatedAt',
].join(', ');

const REPLY_COLUMNS = [
  'id',
  'thread_id as threadId',
  'parent_reply_id as parentReplyId',
  'author_id as authorId',
  'body',
  'vote_score as voteScore',
  'depth',
  'status',
  'created_at as createdAt',
  'updated_at as updatedAt',
].join(', ');

const BOOKMARK_COLUMNS = [
  'id',
  'profile_id as profileId',
  'thread_id as threadId',
  'created_at as createdAt',
].join(', ');

const TAG_COLUMNS = [
  'id',
  'community_id as communityId',
  'name',
  'color',
].join(', ');

const ACTIVITY_COLUMNS = [
  'id',
  'profile_id as profileId',
  'actor_profile_id as actorProfileId',
  'actor_name as actorName',
  'actor_trust_tier as actorTrustTier',
  'type',
  'verb',
  'context',
  'detail',
  'target_type as targetType',
  'target_id as targetId',
  'community_id as communityId',
  'thread_id as threadId',
  'conversation_id as conversationId',
  'target_profile_id as targetProfileId',
  'created_at as createdAt',
  'read_at as readAt',
].join(', ');

const ACTIVITY_FILTER_TO_TYPE = {
  mentions: 'mention',
  replies: 'reply',
  votes: 'vote',
  invites: 'invite',
  mod_actions: 'mod_action',
} as const;

function mapCachedCommunity(row: Community & { humansOnly: boolean | number }): Community {
  return { ...row, humansOnly: Boolean(row.humansOnly) };
}

function mapCachedThread(row: Thread & { isPinned: boolean | number }): Thread {
  return {
    ...row,
    isPinned: Boolean(row.isPinned),
  };
}

// ── Communities ──────────────────────────────────────────────────────

export function getCachedCommunities(
  db: DatabaseAdapter,
  options?: { type?: string; limit?: number; offset?: number },
): Community[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.type) {
    conditions.push('community_type = ?');
    params.push(options.type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(options?.limit ?? 50);
  const offset = options?.offset ? 'OFFSET ?' : '';
  if (options?.offset) params.push(options.offset);

  return db
    .all<Community & { humansOnly: boolean | number }>(
      `SELECT ${COMMUNITY_COLUMNS} FROM fr_communities_cache ${where} ORDER BY member_count DESC LIMIT ? ${offset}`,
      params,
    )
    .map(mapCachedCommunity);
}

export function getCachedCommunityById(db: DatabaseAdapter, id: string): Community | undefined {
  const row = db.get<Community & { humansOnly: boolean | number }>(`SELECT ${COMMUNITY_COLUMNS} FROM fr_communities_cache WHERE id = ?`, [id]);
  return row ? mapCachedCommunity(row) : undefined;
}

export function getCachedCommunityByName(db: DatabaseAdapter, name: string): Community | undefined {
  const row = db.get<Community & { humansOnly: boolean | number }>(`SELECT ${COMMUNITY_COLUMNS} FROM fr_communities_cache WHERE name = ?`, [name]);
  return row ? mapCachedCommunity(row) : undefined;
}

export function getCachedCommunityByModule(db: DatabaseAdapter, moduleId: string): Community | undefined {
  const row = db.get<Community & { humansOnly: boolean | number }>(
    `SELECT ${COMMUNITY_COLUMNS} FROM fr_communities_cache WHERE linked_module_id = ?`,
    [moduleId],
  );
  return row ? mapCachedCommunity(row) : undefined;
}

export function upsertCachedCommunity(db: DatabaseAdapter, community: Community): void {
  db.run(
    `INSERT OR REPLACE INTO fr_communities_cache
     (id, creator_id, name, display_name, description, icon_url, banner_url,
      community_type, humans_only, linked_module_id, member_count, thread_count, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      community.id, community.creatorId, community.name, community.displayName,
      community.description, community.iconUrl, community.bannerUrl, community.communityType,
      community.humansOnly ? 1 : 0, community.linkedModuleId, community.memberCount,
      community.threadCount, community.createdAt, community.updatedAt,
    ],
  );
}

// ── Community Members ───────────────────────────────────────────────

export function getCachedCommunityMembers(
  db: DatabaseAdapter,
  communityId: string,
  options?: { limit?: number },
): CommunityMember[] {
  const limit = options?.limit ?? 200;
  return db.all<CommunityMember>(
    `SELECT ${MEMBER_COLUMNS} FROM fr_community_members_cache WHERE community_id = ? ORDER BY joined_at ASC LIMIT ?`,
    [communityId, limit],
  );
}

export function upsertCachedCommunityMember(db: DatabaseAdapter, member: CommunityMember): void {
  db.run(
    `INSERT OR REPLACE INTO fr_community_members_cache
     (id, community_id, profile_id, role, status, joined_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [member.id, member.communityId, member.profileId, member.role, member.status, member.joinedAt],
  );
}

// ── Threads ─────────────────────────────────────────────────────────

export function getCachedThreads(
  db: DatabaseAdapter,
  communityId: string,
  options?: { sort?: 'new' | 'hot' | 'top'; limit?: number; offset?: number },
): Thread[] {
  const orderBy = options?.sort === 'top'
    ? 'vote_score DESC'
    : options?.sort === 'hot'
      ? 'vote_score DESC, created_at DESC'
      : 'created_at DESC';
  const params: unknown[] = [communityId, options?.limit ?? 50];
  const offset = options?.offset ? 'OFFSET ?' : '';
  if (options?.offset) params.push(options.offset);

  return db
    .all<Thread & { isPinned: boolean | number }>(
      `SELECT ${THREAD_COLUMNS} FROM fr_threads_cache WHERE community_id = ? AND status = 'open'
     ORDER BY is_pinned DESC, ${orderBy} LIMIT ? ${offset}`,
      params,
    )
    .map(mapCachedThread);
}

export function getCachedThreadById(db: DatabaseAdapter, id: string): Thread | undefined {
  const row = db.get<Thread & { isPinned: boolean | number }>(
    `SELECT ${THREAD_COLUMNS} FROM fr_threads_cache WHERE id = ?`,
    [id],
  );
  return row ? mapCachedThread(row) : undefined;
}

export function upsertCachedThread(db: DatabaseAdapter, thread: Thread): void {
  db.run(
    `INSERT OR REPLACE INTO fr_threads_cache
     (id, community_id, author_id, title, body, status, is_pinned,
      vote_score, reply_count, view_count, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      thread.id, thread.communityId, thread.authorId, thread.title, thread.body,
      thread.status, thread.isPinned ? 1 : 0, thread.voteScore, thread.replyCount,
      thread.viewCount, thread.createdAt, thread.updatedAt,
    ],
  );
}

export function deleteCachedThread(db: DatabaseAdapter, id: string): void {
  db.run('DELETE FROM fr_threads_cache WHERE id = ?', [id]);
}

// ── Replies ─────────────────────────────────────────────────────────

export function getCachedReplies(
  db: DatabaseAdapter,
  threadId: string,
  options?: { parentReplyId?: string | null; limit?: number },
): Reply[] {
  if (options?.parentReplyId) {
    return db.all<Reply>(
      `SELECT ${REPLY_COLUMNS} FROM fr_replies_cache WHERE thread_id = ? AND parent_reply_id = ? AND status = 'open'
       ORDER BY vote_score DESC, created_at ASC LIMIT ?`,
      [threadId, options.parentReplyId, options?.limit ?? 50],
    );
  }
  return db.all<Reply>(
    `SELECT ${REPLY_COLUMNS} FROM fr_replies_cache WHERE thread_id = ? AND parent_reply_id IS NULL AND status = 'open'
     ORDER BY vote_score DESC, created_at ASC LIMIT ?`,
    [threadId, options?.limit ?? 50],
  );
}

export function upsertCachedReply(db: DatabaseAdapter, reply: Reply): void {
  db.run(
    `INSERT OR REPLACE INTO fr_replies_cache
     (id, thread_id, parent_reply_id, author_id, body, vote_score, depth, status, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      reply.id, reply.threadId, reply.parentReplyId, reply.authorId, reply.body,
      reply.voteScore, reply.depth, reply.status, reply.createdAt, reply.updatedAt,
    ],
  );
}

// ── Bookmarks ───────────────────────────────────────────────────────

export function getCachedBookmarks(db: DatabaseAdapter, profileId: string, options?: { limit?: number }): Bookmark[] {
  const limit = options?.limit ?? 100;
  return db.all<Bookmark>(
    `SELECT ${BOOKMARK_COLUMNS} FROM fr_bookmarks_cache WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?`,
    [profileId, limit],
  );
}

export function upsertCachedBookmark(db: DatabaseAdapter, bookmark: Bookmark): void {
  db.run(
    `INSERT OR REPLACE INTO fr_bookmarks_cache (id, profile_id, thread_id, created_at, cached_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [bookmark.id, bookmark.profileId, bookmark.threadId, bookmark.createdAt],
  );
}

export function deleteCachedBookmark(db: DatabaseAdapter, id: string): void {
  db.run('DELETE FROM fr_bookmarks_cache WHERE id = ?', [id]);
}

// ── Tags ────────────────────────────────────────────────────────────

export function getCachedTags(db: DatabaseAdapter, communityId: string, options?: { limit?: number }): Tag[] {
  const limit = options?.limit ?? 100;
  return db.all<Tag>(
    `SELECT ${TAG_COLUMNS} FROM fr_tags_cache WHERE community_id = ? ORDER BY name ASC LIMIT ?`,
    [communityId, limit],
  );
}

export function upsertCachedTag(db: DatabaseAdapter, tag: Tag): void {
  db.run(
    `INSERT OR REPLACE INTO fr_tags_cache (id, community_id, name, color, cached_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [tag.id, tag.communityId, tag.name, tag.color],
  );
}

// ── Activity Feed (V4) ─────────────────────────────────────────────

export function getCachedActivity(
  db: DatabaseAdapter,
  profileId: string,
  options?: {
    filter?: ForumActivityFilter;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  },
): ForumActivity[] {
  const conditions = ['profile_id = ?'];
  const params: unknown[] = [profileId];

  if (options?.filter && options.filter !== 'all') {
    conditions.push('type = ?');
    params.push(ACTIVITY_FILTER_TO_TYPE[options.filter]);
  }

  if (options?.unreadOnly) {
    conditions.push('read_at IS NULL');
  }

  const offset = options?.offset ? 'OFFSET ?' : '';
  params.push(options?.limit ?? 50);
  if (options?.offset) {
    params.push(options.offset);
  }

  return db.all<ForumActivity>(
    `SELECT ${ACTIVITY_COLUMNS} FROM fr_activity_cache
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT ? ${offset}`,
    params,
  );
}

export function getCachedActivityById(
  db: DatabaseAdapter,
  id: string,
): ForumActivity | undefined {
  return db.get<ForumActivity>(
    `SELECT ${ACTIVITY_COLUMNS} FROM fr_activity_cache WHERE id = ?`,
    [id],
  );
}

export function upsertCachedActivity(
  db: DatabaseAdapter,
  activity: ForumActivity,
): void {
  db.run(
    `INSERT OR REPLACE INTO fr_activity_cache
     (id, profile_id, actor_profile_id, actor_name, actor_trust_tier, type, verb,
      context, detail, target_type, target_id, community_id, thread_id, conversation_id,
      target_profile_id, created_at, read_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      activity.id,
      activity.profileId,
      activity.actorProfileId,
      activity.actorName,
      activity.actorTrustTier,
      activity.type,
      activity.verb,
      activity.context,
      activity.detail,
      activity.targetType,
      activity.targetId,
      activity.communityId,
      activity.threadId,
      activity.conversationId,
      activity.targetProfileId,
      activity.createdAt,
      activity.readAt,
    ],
  );
}

export function markCachedActivityRead(
  db: DatabaseAdapter,
  activityId: string,
  readAt: string = new Date().toISOString(),
): void {
  db.run(
    `UPDATE fr_activity_cache
     SET read_at = COALESCE(read_at, ?)
     WHERE id = ?`,
    [readAt, activityId],
  );
}

export function markAllCachedActivityRead(
  db: DatabaseAdapter,
  profileId: string,
  filter: ForumActivityFilter = 'all',
  readAt: string = new Date().toISOString(),
): void {
  const conditions = ['profile_id = ?', 'read_at IS NULL'];
  const params: unknown[] = [readAt, profileId];

  if (filter !== 'all') {
    conditions.push('type = ?');
    params.push(ACTIVITY_FILTER_TO_TYPE[filter]);
  }

  db.run(
    `UPDATE fr_activity_cache
     SET read_at = ?
     WHERE ${conditions.join(' AND ')}`,
    params,
  );
}

// ── Profiles (V2) ───────────────────────────────────────────────────

const PROFILE_COLUMNS = [
  'id',
  'user_id as userId',
  'display_name as displayName',
  'username',
  'bio',
  'avatar_url as avatarUrl',
  'banner_url as bannerUrl',
  'status_text as statusText',
  'status_emoji as statusEmoji',
  'location',
  'website_url as websiteUrl',
  'karma',
  'thread_count as threadCount',
  'reply_count as replyCount',
  'communities_joined as communitiesJoined',
  'is_verified as isVerified',
  'created_at as createdAt',
  'updated_at as updatedAt',
].join(', ');

export function getCachedProfileById(db: DatabaseAdapter, id: string): UserProfile | undefined {
  return db.get<UserProfile>(`SELECT ${PROFILE_COLUMNS} FROM fr_profiles_cache WHERE id = ?`, [id]);
}

export function getCachedProfileByUsername(db: DatabaseAdapter, username: string): UserProfile | undefined {
  return db.get<UserProfile>(`SELECT ${PROFILE_COLUMNS} FROM fr_profiles_cache WHERE username = ?`, [username]);
}

export function getCachedProfileByUserId(db: DatabaseAdapter, userId: string): UserProfile | undefined {
  return db.get<UserProfile>(`SELECT ${PROFILE_COLUMNS} FROM fr_profiles_cache WHERE user_id = ?`, [userId]);
}

export function upsertCachedProfile(db: DatabaseAdapter, profile: UserProfile): void {
  db.run(
    `INSERT OR REPLACE INTO fr_profiles_cache
     (id, user_id, display_name, username, bio, avatar_url, banner_url,
      status_text, status_emoji, location, website_url, karma,
      thread_count, reply_count, communities_joined, is_verified,
      created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      profile.id, profile.userId, profile.displayName, profile.username,
      profile.bio, profile.avatarUrl, profile.bannerUrl,
      profile.statusText, profile.statusEmoji, profile.location, profile.websiteUrl,
      profile.karma, profile.threadCount, profile.replyCount, profile.communitiesJoined,
      profile.isVerified ? 1 : 0, profile.createdAt, profile.updatedAt,
    ],
  );
}

// ── Conversations (V2) ──────────────────────────────────────────────

const CONVERSATION_COLUMNS = [
  'id',
  'title',
  'is_group as isGroup',
  'created_by as createdBy',
  'last_message_at as lastMessageAt',
  'last_message_preview as lastMessagePreview',
  'created_at as createdAt',
  'updated_at as updatedAt',
].join(', ');

function mapConversation(row: Conversation & { isGroup: boolean | number }): Conversation {
  return { ...row, isGroup: Boolean(row.isGroup) };
}

export function getCachedConversations(db: DatabaseAdapter, options?: { limit?: number }): Conversation[] {
  const limit = options?.limit ?? 50;
  return db
    .all<Conversation & { isGroup: boolean | number }>(
      `SELECT ${CONVERSATION_COLUMNS} FROM fr_conversations_cache ORDER BY last_message_at DESC LIMIT ?`,
      [limit],
    )
    .map(mapConversation);
}

export function getCachedConversationById(db: DatabaseAdapter, id: string): Conversation | undefined {
  const row = db.get<Conversation & { isGroup: boolean | number }>(
    `SELECT ${CONVERSATION_COLUMNS} FROM fr_conversations_cache WHERE id = ?`,
    [id],
  );
  return row ? mapConversation(row) : undefined;
}

export function upsertCachedConversation(db: DatabaseAdapter, conv: Conversation): void {
  db.run(
    `INSERT OR REPLACE INTO fr_conversations_cache
     (id, title, is_group, created_by, last_message_at, last_message_preview, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      conv.id, conv.title, conv.isGroup ? 1 : 0, conv.createdBy,
      conv.lastMessageAt, conv.lastMessagePreview, conv.createdAt, conv.updatedAt,
    ],
  );
}

// ── Messages (V2) ───────────────────────────────────────────────────

const MESSAGE_COLUMNS = [
  'id',
  'conversation_id as conversationId',
  'sender_id as senderId',
  'body',
  'media_url as mediaUrl',
  'media_type as mediaType',
  'is_edited as isEdited',
  'is_deleted as isDeleted',
  'created_at as createdAt',
  'updated_at as updatedAt',
].join(', ');

function mapMessage(row: DirectMessage & { isEdited: boolean | number; isDeleted: boolean | number }): DirectMessage {
  return { ...row, isEdited: Boolean(row.isEdited), isDeleted: Boolean(row.isDeleted) };
}

export function getCachedMessages(
  db: DatabaseAdapter,
  conversationId: string,
  options?: { limit?: number },
): DirectMessage[] {
  const limit = options?.limit ?? 50;
  return db
    .all<DirectMessage & { isEdited: boolean | number; isDeleted: boolean | number }>(
      `SELECT ${MESSAGE_COLUMNS} FROM fr_messages_cache WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [conversationId, limit],
    )
    .map(mapMessage);
}

export function upsertCachedMessage(db: DatabaseAdapter, msg: DirectMessage): void {
  db.run(
    `INSERT OR REPLACE INTO fr_messages_cache
     (id, conversation_id, sender_id, body, media_url, media_type,
      is_edited, is_deleted, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      msg.id, msg.conversationId, msg.senderId, msg.body,
      msg.mediaUrl, msg.mediaType, msg.isEdited ? 1 : 0,
      msg.isDeleted ? 1 : 0, msg.createdAt, msg.updatedAt,
    ],
  );
}
