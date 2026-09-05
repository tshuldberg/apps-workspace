/**
 * Supabase cloud client for MyForums.
 * All functions accept a SupabaseClient as the first parameter for dependency injection.
 * Returns Result<T> for consistent error handling.
 */

import {
  emitForumCommunityCreated,
  emitForumReplyPosted,
  emitForumThreadCreated,
} from '@mylife/social';
import type {
  Community,
  CreateCommunityInput,
  CommunityMember,
  Thread,
  CreateThreadInput,
  Reply,
  CreateReplyInput,
  Vote,
  VoteDirection,
  VoteTargetType,
  Bookmark,
  UserStats,
  ModAction,
  ForumReport,
  CommunityRule,
  Tag,
} from '../types';
import type { UserProfile, CreateProfileInput, UpdateProfileInput, ProfileBadge } from '../models/profile';
import type { MediaAttachment, UploadMediaInput, LinkPreview } from '../models/media';
import type { Conversation, CreateConversationInput, DirectMessage, SendMessageInput, ConversationParticipant } from '../models/messaging';
import type { VoiceChannel, CreateVoiceChannelInput, VoiceParticipant } from '../models/voice';
import type { FederatedInstance, FederatedActor } from '../models/federation';

/** Minimal Supabase client interface for dependency injection. */
interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder;
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  auth: { getUser(): PromiseLike<{ data: { user: { id: string } | null } }> };
}

interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseQueryBuilder;
  insert(data: Record<string, unknown>): SupabaseQueryBuilder;
  update(data: Record<string, unknown>): SupabaseQueryBuilder;
  delete(): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  neq(column: string, value: unknown): SupabaseQueryBuilder;
  in(column: string, values: unknown[]): SupabaseQueryBuilder;
  is(column: string, value: null): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  limit(count: number): SupabaseQueryBuilder;
  range(from: number, to: number): SupabaseQueryBuilder;
  textSearch(column: string, query: string): SupabaseQueryBuilder;
  single(): PromiseLike<{ data: unknown; error: unknown }>;
  then(resolve: (value: { data: unknown; error: unknown }) => void): void;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface ForumCommunityRow {
  id: string;
  creator_id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  community_type: Community['communityType'];
  humans_only: boolean;
  linked_module_id: string | null;
  member_count: number;
  thread_count: number;
  created_at: string;
  updated_at: string;
}

interface ForumCommunityMemberRow {
  id: string;
  community_id: string;
  profile_id: string;
  role: CommunityMember['role'];
  status: CommunityMember['status'];
  joined_at: string;
}

interface ForumThreadRow {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  body: string;
  status: Thread['status'];
  is_pinned: boolean;
  vote_score: number;
  reply_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface ForumReplyRow {
  id: string;
  thread_id: string;
  parent_reply_id: string | null;
  author_id: string;
  body: string;
  vote_score: number;
  depth: number;
  status: Reply['status'];
  created_at: string;
  updated_at: string;
}

interface ForumVoteRow {
  id: string;
  profile_id: string;
  target_type: Vote['targetType'];
  target_id: string;
  direction: Vote['direction'];
  created_at: string;
}

interface ForumBookmarkRow {
  id: string;
  profile_id: string;
  thread_id: string;
  created_at: string;
}

interface ForumUserStatsRow {
  profile_id: string;
  thread_count: number;
  reply_count: number;
  karma: number;
  communities_joined: number;
}

interface ForumModActionRow {
  id: string;
  community_id: string;
  moderator_id: string;
  action_type: ModAction['actionType'];
  target_id: string | null;
  reason: string | null;
  created_at: string;
}

interface ForumReportRow {
  id: string;
  reporter_id: string;
  community_id: string;
  target_type: ForumReport['targetType'];
  target_id: string;
  reason: ForumReport['reason'];
  details: string | null;
  created_at: string;
}

interface ForumRuleRow {
  id: string;
  community_id: string;
  title: string;
  description: string;
  position: number;
}

interface ForumTagRow {
  id: string;
  community_id: string;
  name: string;
  color: string | null;
}

function mapCommunityRow(row: ForumCommunityRow): Community {
  return {
    id: row.id,
    creatorId: row.creator_id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    iconUrl: row.icon_url,
    bannerUrl: row.banner_url,
    communityType: row.community_type,
    humansOnly: row.humans_only,
    linkedModuleId: row.linked_module_id,
    memberCount: row.member_count,
    threadCount: row.thread_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommunityMemberRow(row: ForumCommunityMemberRow): CommunityMember {
  return {
    id: row.id,
    communityId: row.community_id,
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

function mapThreadRow(row: ForumThreadRow): Thread {
  return {
    id: row.id,
    communityId: row.community_id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    status: row.status,
    isPinned: row.is_pinned,
    voteScore: row.vote_score,
    replyCount: row.reply_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReplyRow(row: ForumReplyRow): Reply {
  return {
    id: row.id,
    threadId: row.thread_id,
    parentReplyId: row.parent_reply_id,
    authorId: row.author_id,
    body: row.body,
    voteScore: row.vote_score,
    depth: row.depth,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVoteRow(row: ForumVoteRow): Vote {
  return {
    id: row.id,
    profileId: row.profile_id,
    targetType: row.target_type,
    targetId: row.target_id,
    direction: row.direction,
    createdAt: row.created_at,
  };
}

function mapBookmarkRow(row: ForumBookmarkRow): Bookmark {
  return {
    id: row.id,
    profileId: row.profile_id,
    threadId: row.thread_id,
    createdAt: row.created_at,
  };
}

function mapUserStatsRow(row: ForumUserStatsRow): UserStats {
  return {
    profileId: row.profile_id,
    threadCount: row.thread_count,
    replyCount: row.reply_count,
    karma: row.karma,
    communitiesJoined: row.communities_joined,
  };
}

function mapModActionRow(row: ForumModActionRow): ModAction {
  return {
    id: row.id,
    communityId: row.community_id,
    moderatorId: row.moderator_id,
    actionType: row.action_type,
    targetId: row.target_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function mapForumReportRow(row: ForumReportRow): ForumReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    communityId: row.community_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    createdAt: row.created_at,
  };
}

function mapRuleRow(row: ForumRuleRow): CommunityRule {
  return {
    id: row.id,
    communityId: row.community_id,
    title: row.title,
    description: row.description,
    position: row.position,
  };
}

function mapTagRow(row: ForumTagRow): Tag {
  return {
    id: row.id,
    communityId: row.community_id,
    name: row.name,
    color: row.color,
  };
}

function toCommunityInsert(input: CreateCommunityInput, creatorId: string): Record<string, unknown> {
  return {
    creator_id: creatorId,
    name: input.name,
    display_name: input.displayName,
    description: input.description ?? null,
    community_type: input.communityType ?? 'public',
    linked_module_id: input.linkedModuleId ?? null,
  };
}

function toThreadInsert(input: CreateThreadInput, authorId: string): Record<string, unknown> {
  return {
    community_id: input.communityId,
    author_id: authorId,
    title: input.title,
    body: input.body,
  };
}

function toReportInsert(
  report: Omit<ForumReport, 'id' | 'reporterId' | 'createdAt'>,
  reporterId: string,
): Record<string, unknown> {
  return {
    reporter_id: reporterId,
    community_id: report.communityId,
    target_type: report.targetType,
    target_id: report.targetId,
    reason: report.reason,
    details: report.details ?? null,
  };
}

// ── Communities ──────────────────────────────────────────────────────

export async function cloudGetCommunities(
  supabase: SupabaseClient,
  options?: { limit?: number; offset?: number },
): Promise<Result<Community[]>> {
  let query = supabase
    .from('fr_communities')
    .select('*')
    .order('member_count', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumCommunityRow[] | null ?? []).map(mapCommunityRow) };
}

export async function cloudGetCommunityById(
  supabase: SupabaseClient,
  id: string,
): Promise<Result<Community>> {
  const { data, error } = await supabase
    .from('fr_communities')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapCommunityRow(data as ForumCommunityRow) };
}

export async function cloudGetCommunityByName(
  supabase: SupabaseClient,
  name: string,
): Promise<Result<Community>> {
  const { data, error } = await supabase
    .from('fr_communities')
    .select('*')
    .eq('name', name)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapCommunityRow(data as ForumCommunityRow) };
}

export async function cloudCreateCommunity(
  supabase: SupabaseClient,
  input: CreateCommunityInput,
): Promise<Result<Community>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('fr_communities')
    .insert(toCommunityInsert(input, user.id))
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };

  const community = mapCommunityRow(data as ForumCommunityRow);
  void emitForumCommunityCreated(`Created ${community.displayName}`, {
    communityName: community.displayName,
    description: community.description ?? undefined,
  });

  return { ok: true, data: community };
}

export async function cloudSearchCommunities(
  supabase: SupabaseClient,
  query: string,
): Promise<Result<Community[]>> {
  const { data, error } = await supabase
    .from('fr_communities')
    .select('*')
    .textSearch('search_vector', query)
    .order('member_count', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumCommunityRow[] | null ?? []).map(mapCommunityRow) };
}

export async function cloudGetCommunityByModule(
  supabase: SupabaseClient,
  moduleId: string,
): Promise<Result<Community | null>> {
  const { data, error } = await supabase
    .from('fr_communities')
    .select('*')
    .eq('linked_module_id', moduleId)
    .limit(1);
  if (error) return { ok: false, error: String(error) };
  const rows = data as ForumCommunityRow[] | null ?? [];
  return { ok: true, data: rows.length > 0 ? mapCommunityRow(rows[0]) : null };
}

// ── Community Members ───────────────────────────────────────────────

export async function cloudJoinCommunity(
  supabase: SupabaseClient,
  communityId: string,
): Promise<Result<CommunityMember>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('fr_community_members')
    .insert({ community_id: communityId, profile_id: user.id })
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapCommunityMemberRow(data as ForumCommunityMemberRow) };
}

export async function cloudLeaveCommunity(
  supabase: SupabaseClient,
  communityId: string,
): Promise<Result<{ left: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('fr_community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('profile_id', user.id);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { left: true } };
}

// ── Threads ─────────────────────────────────────────────────────────

export async function cloudGetThreads(
  supabase: SupabaseClient,
  communityId: string,
  options?: { sort?: 'new' | 'hot' | 'top'; limit?: number },
): Promise<Result<Thread[]>> {
  const orderCol = options?.sort === 'top' ? 'vote_score' : 'created_at';
  let query = supabase
    .from('fr_threads')
    .select('*')
    .eq('community_id', communityId)
    .neq('status', 'removed')
    .order('is_pinned', { ascending: false })
    .order(orderCol, { ascending: false });

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumThreadRow[] | null ?? []).map(mapThreadRow) };
}

export async function cloudGetThreadById(
  supabase: SupabaseClient,
  id: string,
): Promise<Result<Thread>> {
  const { data, error } = await supabase
    .from('fr_threads')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapThreadRow(data as ForumThreadRow) };
}

export async function cloudCreateThread(
  supabase: SupabaseClient,
  input: CreateThreadInput,
): Promise<Result<Thread>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('fr_threads')
    .insert(toThreadInsert(input, user.id))
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };

  const thread = mapThreadRow(data as ForumThreadRow);
  const communityResult = await cloudGetCommunityById(supabase, input.communityId);
  const communityName = communityResult.ok ? communityResult.data.displayName : input.communityId;
  void emitForumThreadCreated(`Started a discussion in ${communityName}`, {
    communityName,
    threadTitle: thread.title,
  });

  return { ok: true, data: thread };
}

export async function cloudSearchThreads(
  supabase: SupabaseClient,
  query: string,
): Promise<Result<Thread[]>> {
  const { data, error } = await supabase
    .from('fr_threads')
    .select('*')
    .textSearch('search_vector', query)
    .neq('status', 'removed')
    .order('vote_score', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumThreadRow[] | null ?? []).map(mapThreadRow) };
}

// ── Replies ─────────────────────────────────────────────────────────

export async function cloudGetReplies(
  supabase: SupabaseClient,
  threadId: string,
  options?: { parentReplyId?: string | null; limit?: number },
): Promise<Result<Reply[]>> {
  let query = supabase
    .from('fr_replies')
    .select('*')
    .eq('thread_id', threadId)
    .neq('status', 'removed')
    .order('vote_score', { ascending: false });

  if (options?.parentReplyId) {
    query = query.eq('parent_reply_id', options.parentReplyId);
  } else if (options?.parentReplyId === null) {
    query = query.is('parent_reply_id', null);
  }

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumReplyRow[] | null ?? []).map(mapReplyRow) };
}

export async function cloudCreateReply(
  supabase: SupabaseClient,
  input: CreateReplyInput & { depth?: number },
): Promise<Result<Reply>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('fr_replies')
    .insert({
      thread_id: input.threadId,
      parent_reply_id: input.parentReplyId ?? null,
      author_id: user.id,
      body: input.body,
      depth: input.depth ?? 0,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };

  const reply = mapReplyRow(data as ForumReplyRow);
  const threadResult = await cloudGetThreadById(supabase, input.threadId);
  if (threadResult.ok) {
    const communityResult = await cloudGetCommunityById(supabase, threadResult.data.communityId);
    const communityName = communityResult.ok ? communityResult.data.displayName : threadResult.data.communityId;
    void emitForumReplyPosted(`Replied in ${communityName}`, {
      communityName,
      threadTitle: threadResult.data.title,
      replyPreview: reply.body.slice(0, 120),
    });
  }

  return { ok: true, data: reply };
}

// ── Votes ───────────────────────────────────────────────────────────

export async function cloudCastVote(
  supabase: SupabaseClient,
  targetType: VoteTargetType,
  targetId: string,
  direction: VoteDirection,
): Promise<Result<Vote>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // Upsert: remove existing vote first, then insert
  await supabase
    .from('fr_votes')
    .delete()
    .eq('profile_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  const { data, error } = await supabase
    .from('fr_votes')
    .insert({
      profile_id: user.id,
      target_type: targetType,
      target_id: targetId,
      direction,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapVoteRow(data as ForumVoteRow) };
}

export async function cloudRemoveVote(
  supabase: SupabaseClient,
  targetType: VoteTargetType,
  targetId: string,
): Promise<Result<{ removed: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('fr_votes')
    .delete()
    .eq('profile_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { removed: true } };
}

// ── Bookmarks ───────────────────────────────────────────────────────

export async function cloudGetBookmarks(
  supabase: SupabaseClient,
): Promise<Result<Bookmark[]>> {
  const { data, error } = await supabase
    .from('fr_bookmarks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumBookmarkRow[] | null ?? []).map(mapBookmarkRow) };
}

export async function cloudToggleBookmark(
  supabase: SupabaseClient,
  threadId: string,
): Promise<Result<{ bookmarked: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: existing } = await supabase
    .from('fr_bookmarks')
    .select('id')
    .eq('profile_id', user.id)
    .eq('thread_id', threadId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('fr_bookmarks')
      .delete()
      .eq('id', (existing as { id: string }).id);
    if (error) return { ok: false, error: String(error) };
    return { ok: true, data: { bookmarked: false } };
  } else {
    const { error } = await supabase
      .from('fr_bookmarks')
      .insert({ profile_id: user.id, thread_id: threadId });
    if (error) return { ok: false, error: String(error) };
    return { ok: true, data: { bookmarked: true } };
  }
}

// ── User Stats ──────────────────────────────────────────────────────

export async function cloudGetUserStats(
  supabase: SupabaseClient,
  profileId: string,
): Promise<Result<UserStats>> {
  const { data, error } = await supabase
    .from('fr_user_stats')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapUserStatsRow(data as ForumUserStatsRow) };
}

// ── Moderation ──────────────────────────────────────────────────────

export async function cloudGetModLog(
  supabase: SupabaseClient,
  communityId: string,
  options?: { limit?: number },
): Promise<Result<ModAction[]>> {
  let query = supabase
    .from('fr_mod_actions')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumModActionRow[] | null ?? []).map(mapModActionRow) };
}

// ── Reports ─────────────────────────────────────────────────────────

export async function cloudCreateReport(
  supabase: SupabaseClient,
  report: Omit<ForumReport, 'id' | 'reporterId' | 'createdAt'>,
): Promise<Result<ForumReport>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('fr_reports')
    .insert(toReportInsert(report, user.id))
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapForumReportRow(data as ForumReportRow) };
}

// ── Community Rules ─────────────────────────────────────────────────

export async function cloudGetCommunityRules(
  supabase: SupabaseClient,
  communityId: string,
): Promise<Result<CommunityRule[]>> {
  const { data, error } = await supabase
    .from('fr_community_rules')
    .select('*')
    .eq('community_id', communityId)
    .order('position', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumRuleRow[] | null ?? []).map(mapRuleRow) };
}

// ── Tags ────────────────────────────────────────────────────────────

export async function cloudGetTags(
  supabase: SupabaseClient,
  communityId: string,
): Promise<Result<Tag[]>> {
  const { data, error } = await supabase
    .from('fr_tags')
    .select('*')
    .eq('community_id', communityId)
    .order('name', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumTagRow[] | null ?? []).map(mapTagRow) };
}

// ════════════════════════════════════════════════════════════════════
// V2: B+C Feature Cloud Functions
// ════════════════════════════════════════════════════════════════════

// ── Row type mappers for new tables ─────────────────────────────────

interface ForumProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  status_text: string;
  status_emoji: string;
  location: string;
  website_url: string | null;
  karma: number;
  thread_count: number;
  reply_count: number;
  communities_joined: number;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface ForumBadgeRow {
  id: string;
  profile_id: string;
  badge_type: string;
  badge_label: string;
  earned_at: string;
}

interface ForumMediaRow {
  id: string;
  target_type: string;
  target_id: string;
  uploader_id: string;
  media_type: string;
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  file_size: number;
  mime_type: string;
  alt_text: string;
  position: number;
  created_at: string;
}

interface ForumLinkPreviewRow {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  fetched_at: string;
}

interface ForumConversationRow {
  id: string;
  title: string | null;
  is_group: boolean;
  created_by: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

interface ForumParticipantRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  last_read_at: string;
  is_muted: boolean;
  joined_at: string;
}

interface ForumDirectMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface ForumVoiceChannelRow {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  max_participants: number;
  is_locked: boolean;
  created_by: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ForumVoiceParticipantRow {
  id: string;
  channel_id: string;
  user_id: string;
  is_muted: boolean;
  is_deafened: boolean;
  is_speaking: boolean;
  joined_at: string;
}

interface ForumInstanceRow {
  id: string;
  domain: string;
  display_name: string | null;
  software: string | null;
  software_version: string | null;
  description: string | null;
  inbox_url: string;
  outbox_url: string | null;
  shared_inbox_url: string | null;
  public_key: string;
  is_blocked: boolean;
  is_allowlisted: boolean;
  last_seen_at: string;
  first_seen_at: string;
  created_at: string;
}

interface ForumActorRow {
  id: string;
  instance_id: string;
  actor_uri: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  inbox_url: string;
  outbox_url: string | null;
  public_key: string;
  last_fetched_at: string;
  created_at: string;
}

function mapProfileRow(row: ForumProfileRow): UserProfile {
  return {
    id: row.id, userId: row.user_id, displayName: row.display_name,
    username: row.username, bio: row.bio, avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url, statusText: row.status_text,
    statusEmoji: row.status_emoji, location: row.location,
    websiteUrl: row.website_url, karma: row.karma,
    threadCount: row.thread_count, replyCount: row.reply_count,
    communitiesJoined: row.communities_joined, isVerified: row.is_verified,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapBadgeRow(row: ForumBadgeRow): ProfileBadge {
  return {
    id: row.id, profileId: row.profile_id, badgeType: row.badge_type as ProfileBadge['badgeType'],
    badgeLabel: row.badge_label, earnedAt: row.earned_at,
  };
}

function mapMediaRow(row: ForumMediaRow): MediaAttachment {
  return {
    id: row.id, targetType: row.target_type as MediaAttachment['targetType'],
    targetId: row.target_id, uploaderId: row.uploader_id,
    mediaType: row.media_type as MediaAttachment['mediaType'],
    storagePath: row.storage_path, url: row.url,
    thumbnailUrl: row.thumbnail_url, width: row.width, height: row.height,
    fileSize: row.file_size, mimeType: row.mime_type, altText: row.alt_text,
    position: row.position, createdAt: row.created_at,
  };
}

function mapLinkPreviewRow(row: ForumLinkPreviewRow): LinkPreview {
  return {
    id: row.id, url: row.url, title: row.title, description: row.description,
    imageUrl: row.image_url, siteName: row.site_name, fetchedAt: row.fetched_at,
  };
}

function mapConversationRow(row: ForumConversationRow): Conversation {
  return {
    id: row.id, title: row.title, isGroup: row.is_group,
    createdBy: row.created_by, lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapParticipantRow(row: ForumParticipantRow): ConversationParticipant {
  return {
    id: row.id, conversationId: row.conversation_id, userId: row.user_id,
    role: row.role as ConversationParticipant['role'], lastReadAt: row.last_read_at,
    isMuted: row.is_muted, joinedAt: row.joined_at,
  };
}

function mapDirectMessageRow(row: ForumDirectMessageRow): DirectMessage {
  return {
    id: row.id, conversationId: row.conversation_id, senderId: row.sender_id,
    body: row.body, mediaUrl: row.media_url,
    mediaType: row.media_type as DirectMessage['mediaType'],
    isEdited: row.is_edited, isDeleted: row.is_deleted,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapVoiceChannelRow(row: ForumVoiceChannelRow): VoiceChannel {
  return {
    id: row.id, communityId: row.community_id, name: row.name,
    description: row.description, maxParticipants: row.max_participants,
    isLocked: row.is_locked, createdBy: row.created_by,
    position: row.position, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapVoiceParticipantRow(row: ForumVoiceParticipantRow): VoiceParticipant {
  return {
    id: row.id, channelId: row.channel_id, userId: row.user_id,
    isMuted: row.is_muted, isDeafened: row.is_deafened,
    isSpeaking: row.is_speaking, joinedAt: row.joined_at,
  };
}

function mapInstanceRow(row: ForumInstanceRow): FederatedInstance {
  return {
    id: row.id, domain: row.domain, displayName: row.display_name,
    software: row.software, softwareVersion: row.software_version,
    description: row.description, inboxUrl: row.inbox_url,
    outboxUrl: row.outbox_url, sharedInboxUrl: row.shared_inbox_url,
    publicKey: row.public_key, isBlocked: row.is_blocked,
    isAllowlisted: row.is_allowlisted, lastSeenAt: row.last_seen_at,
    firstSeenAt: row.first_seen_at, createdAt: row.created_at,
  };
}

function mapActorRow(row: ForumActorRow): FederatedActor {
  return {
    id: row.id, instanceId: row.instance_id, actorUri: row.actor_uri,
    username: row.username, displayName: row.display_name, bio: row.bio,
    avatarUrl: row.avatar_url, inboxUrl: row.inbox_url,
    outboxUrl: row.outbox_url, publicKey: row.public_key,
    lastFetchedAt: row.last_fetched_at, createdAt: row.created_at,
  };
}

// ── User Profiles ───────────────────────────────────────────────────

export async function cloudGetProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<Result<UserProfile>> {
  const { data, error } = await supabase
    .from('fr_profiles').select('*').eq('id', profileId).single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapProfileRow(data as ForumProfileRow) };
}

export async function cloudGetProfileByUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<Result<UserProfile>> {
  const { data, error } = await supabase
    .from('fr_profiles').select('*').eq('username', username).single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapProfileRow(data as ForumProfileRow) };
}

export async function cloudGetMyProfile(
  supabase: SupabaseClient,
): Promise<Result<UserProfile | null>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_profiles').select('*').eq('user_id', user.id).limit(1);
  if (error) return { ok: false, error: String(error) };
  const rows = data as ForumProfileRow[] | null ?? [];
  return { ok: true, data: rows.length > 0 ? mapProfileRow(rows[0]) : null };
}

export async function cloudCreateProfile(
  supabase: SupabaseClient,
  input: CreateProfileInput,
): Promise<Result<UserProfile>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_profiles')
    .insert({
      user_id: user.id, display_name: input.displayName,
      username: input.username, bio: input.bio ?? '',
      avatar_url: input.avatarUrl ?? null,
    })
    .select('*').single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapProfileRow(data as ForumProfileRow) };
}

export async function cloudUpdateProfile(
  supabase: SupabaseClient,
  updates: UpdateProfileInput,
): Promise<Result<UserProfile>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const mapped: Record<string, unknown> = {};
  if (updates.displayName !== undefined) mapped.display_name = updates.displayName;
  if (updates.bio !== undefined) mapped.bio = updates.bio;
  if (updates.avatarUrl !== undefined) mapped.avatar_url = updates.avatarUrl;
  if (updates.bannerUrl !== undefined) mapped.banner_url = updates.bannerUrl;
  if (updates.statusText !== undefined) mapped.status_text = updates.statusText;
  if (updates.statusEmoji !== undefined) mapped.status_emoji = updates.statusEmoji;
  if (updates.location !== undefined) mapped.location = updates.location;
  if (updates.websiteUrl !== undefined) mapped.website_url = updates.websiteUrl;
  mapped.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('fr_profiles').update(mapped).eq('user_id', user.id).select('*').single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapProfileRow(data as ForumProfileRow) };
}

export async function cloudGetProfileBadges(
  supabase: SupabaseClient,
  profileId: string,
): Promise<Result<ProfileBadge[]>> {
  const { data, error } = await supabase
    .from('fr_profile_badges').select('*').eq('profile_id', profileId).order('earned_at', { ascending: false });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumBadgeRow[] | null ?? []).map(mapBadgeRow) };
}

export async function cloudGetProfileActivity(
  supabase: SupabaseClient,
  profileId: string,
  options?: { limit?: number },
): Promise<Result<Array<Thread | Reply>>> {
  const limit = options?.limit ?? 20;
  const { data: threads, error: tErr } = await supabase
    .from('fr_threads').select('*').eq('author_id', profileId)
    .order('created_at', { ascending: false }).limit(limit);
  if (tErr) return { ok: false, error: String(tErr) };
  const { data: replies, error: rErr } = await supabase
    .from('fr_replies').select('*').eq('author_id', profileId)
    .order('created_at', { ascending: false }).limit(limit);
  if (rErr) return { ok: false, error: String(rErr) };
  const items = [
    ...(threads as ForumThreadRow[] | null ?? []).map(mapThreadRow),
    ...(replies as ForumReplyRow[] | null ?? []).map(mapReplyRow),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  return { ok: true, data: items };
}

// ── Media Sharing ───────────────────────────────────────────────────

export async function cloudUploadMedia(
  supabase: SupabaseClient,
  input: UploadMediaInput,
): Promise<Result<MediaAttachment>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_media_attachments')
    .insert({
      target_type: input.targetType, target_id: input.targetId,
      uploader_id: user.id, media_type: input.mediaType,
      storage_path: input.storagePath, url: input.url,
      thumbnail_url: input.thumbnailUrl ?? null,
      width: input.width ?? null, height: input.height ?? null,
      file_size: input.fileSize, mime_type: input.mimeType,
      alt_text: input.altText ?? '', position: input.position ?? 0,
    })
    .select('*').single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapMediaRow(data as ForumMediaRow) };
}

export async function cloudGetMediaForTarget(
  supabase: SupabaseClient,
  targetType: string,
  targetId: string,
): Promise<Result<MediaAttachment[]>> {
  const { data, error } = await supabase
    .from('fr_media_attachments').select('*')
    .eq('target_type', targetType).eq('target_id', targetId)
    .order('position', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumMediaRow[] | null ?? []).map(mapMediaRow) };
}

export async function cloudDeleteMedia(
  supabase: SupabaseClient,
  mediaId: string,
): Promise<Result<{ deleted: boolean }>> {
  const { error } = await supabase
    .from('fr_media_attachments').delete().eq('id', mediaId);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { deleted: true } };
}

export async function cloudGetLinkPreview(
  supabase: SupabaseClient,
  url: string,
): Promise<Result<LinkPreview | null>> {
  const { data, error } = await supabase
    .from('fr_link_previews').select('*').eq('url', url).limit(1);
  if (error) return { ok: false, error: String(error) };
  const rows = data as ForumLinkPreviewRow[] | null ?? [];
  return { ok: true, data: rows.length > 0 ? mapLinkPreviewRow(rows[0]) : null };
}

// ── Direct Messaging ────────────────────────────────────────────────

export async function cloudGetConversations(
  supabase: SupabaseClient,
): Promise<Result<Conversation[]>> {
  const { data, error } = await supabase
    .from('fr_conversations').select('*').order('last_message_at', { ascending: false });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumConversationRow[] | null ?? []).map(mapConversationRow) };
}

export async function cloudCreateConversation(
  supabase: SupabaseClient,
  input: CreateConversationInput,
): Promise<Result<Conversation>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_conversations')
    .insert({
      title: input.title ?? null,
      is_group: input.participantIds.length > 1,
      created_by: user.id,
    })
    .select('*').single();
  if (error) return { ok: false, error: String(error) };
  const conv = mapConversationRow(data as ForumConversationRow);
  const allParticipants = [user.id, ...input.participantIds.filter((id) => id !== user.id)];
  for (const pid of allParticipants) {
    await supabase.from('fr_conversation_participants').insert({
      conversation_id: conv.id, user_id: pid,
      role: pid === user.id ? 'owner' : 'member',
    });
  }
  return { ok: true, data: conv };
}

export async function cloudGetMessages(
  supabase: SupabaseClient,
  conversationId: string,
  options?: { limit?: number },
): Promise<Result<DirectMessage[]>> {
  const query = supabase
    .from('fr_direct_messages').select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50);
  const { data, error } = await query;
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumDirectMessageRow[] | null ?? []).map(mapDirectMessageRow) };
}

export async function cloudSendMessage(
  supabase: SupabaseClient,
  input: SendMessageInput,
): Promise<Result<DirectMessage>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_direct_messages')
    .insert({
      conversation_id: input.conversationId, sender_id: user.id,
      body: input.body, media_url: input.mediaUrl ?? null,
      media_type: input.mediaType ?? null,
    })
    .select('*').single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapDirectMessageRow(data as ForumDirectMessageRow) };
}

export async function cloudUpdateLastRead(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Result<{ updated: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { error } = await supabase
    .from('fr_conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { updated: true } };
}

export async function cloudGetParticipants(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Result<ConversationParticipant[]>> {
  const { data, error } = await supabase
    .from('fr_conversation_participants').select('*')
    .eq('conversation_id', conversationId);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumParticipantRow[] | null ?? []).map(mapParticipantRow) };
}

// ── Voice Channels ──────────────────────────────────────────────────

export async function cloudGetVoiceChannels(
  supabase: SupabaseClient,
  communityId: string,
): Promise<Result<VoiceChannel[]>> {
  const { data, error } = await supabase
    .from('fr_voice_channels').select('*')
    .eq('community_id', communityId).order('position', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumVoiceChannelRow[] | null ?? []).map(mapVoiceChannelRow) };
}

export async function cloudCreateVoiceChannel(
  supabase: SupabaseClient,
  input: CreateVoiceChannelInput,
): Promise<Result<VoiceChannel>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_voice_channels')
    .insert({
      community_id: input.communityId, name: input.name,
      description: input.description ?? null,
      max_participants: input.maxParticipants ?? 25,
      created_by: user.id,
    })
    .select('*').single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapVoiceChannelRow(data as ForumVoiceChannelRow) };
}

export async function cloudJoinVoiceChannel(
  supabase: SupabaseClient,
  channelId: string,
): Promise<Result<VoiceParticipant>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('fr_voice_participants')
    .insert({ channel_id: channelId, user_id: user.id })
    .select('*').single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapVoiceParticipantRow(data as ForumVoiceParticipantRow) };
}

export async function cloudLeaveVoiceChannel(
  supabase: SupabaseClient,
  channelId: string,
): Promise<Result<{ left: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { error } = await supabase
    .from('fr_voice_participants').delete()
    .eq('channel_id', channelId).eq('user_id', user.id);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { left: true } };
}

export async function cloudGetVoiceParticipants(
  supabase: SupabaseClient,
  channelId: string,
): Promise<Result<VoiceParticipant[]>> {
  const { data, error } = await supabase
    .from('fr_voice_participants').select('*').eq('channel_id', channelId);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumVoiceParticipantRow[] | null ?? []).map(mapVoiceParticipantRow) };
}

// ── Federation ──────────────────────────────────────────────────────

export async function cloudGetFederatedInstances(
  supabase: SupabaseClient,
): Promise<Result<FederatedInstance[]>> {
  const { data, error } = await supabase
    .from('fr_federated_instances').select('*').order('last_seen_at', { ascending: false });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as ForumInstanceRow[] | null ?? []).map(mapInstanceRow) };
}

export async function cloudBlockInstance(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<Result<{ blocked: boolean }>> {
  const { error } = await supabase
    .from('fr_federated_instances').update({ is_blocked: true }).eq('id', instanceId);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { blocked: true } };
}

export async function cloudUnblockInstance(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<Result<{ unblocked: boolean }>> {
  const { error } = await supabase
    .from('fr_federated_instances').update({ is_blocked: false }).eq('id', instanceId);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { unblocked: true } };
}

export async function cloudGetFederatedActor(
  supabase: SupabaseClient,
  actorUri: string,
): Promise<Result<FederatedActor | null>> {
  const { data, error } = await supabase
    .from('fr_federated_actors').select('*').eq('actor_uri', actorUri).limit(1);
  if (error) return { ok: false, error: String(error) };
  const rows = data as ForumActorRow[] | null ?? [];
  return { ok: true, data: rows.length > 0 ? mapActorRow(rows[0]) : null };
}
