/**
 * Social feed engine -- Supabase-backed friend feed and connections.
 */

import type {
  FeedItem,
  FeedFilter,
  FeedResult,
  FriendConnection,
  FriendConnectionStatus,
  SyncShareEventInput,
} from './types';

/** Maximum number of friend connections per user. */
export const MAX_FRIENDS = 100;

/**
 * Supabase client interface -- the actual client is injected from the app layer.
 */
export interface SocialSupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => any;
    insert: (data: any) => any;
    update: (data: any) => any;
    delete: () => any;
  };
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
}

/**
 * Assemble the social feed from Supabase. RLS handles visibility filtering.
 */
export async function assembleFeed(
  client: SocialSupabaseClient,
  filter?: FeedFilter,
): Promise<FeedResult> {
  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;
  const maxAgeDays = filter?.maxAgeDays ?? 90;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  const cutoffISO = cutoffDate.toISOString();

  let query = client
    .from('synced_share_events')
    .select('*')
    .gte('created_at', cutoffISO)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);

  const { data, error } = await query;

  if (error) {
    return { items: [], hasMore: false, isStale: true, lastUpdated: null };
  }

  const rows = (data ?? []) as any[];

  const allItems: FeedItem[] = rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name ?? 'Reader',
    avatarUrl: row.avatar_url ?? null,
    eventType: row.event_type,
    bookTitle: row.book_title,
    bookCoverUrl: row.book_cover_url ?? null,
    bookAuthors: row.book_authors ?? null,
    rating: row.rating ?? null,
    reviewExcerpt: row.review_excerpt ?? null,
    createdAt: row.created_at,
  }));

  // range() is inclusive, so we get limit+1 rows; use the extra to detect more pages
  const hasMore = allItems.length > limit;
  const items = hasMore ? allItems.slice(0, limit) : allItems;

  return {
    items,
    hasMore,
    isStale: false,
    lastUpdated: items.length > 0 ? items[0].createdAt : null,
  };
}

/**
 * Send a friend request. Fails if already at MAX_FRIENDS.
 */
export async function sendFriendRequest(
  client: SocialSupabaseClient,
  responderId: string,
): Promise<FriendConnection> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check connection count
  const { data: existing } = await client
    .from('friend_connections')
    .select('id')
    .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (existing && existing.length >= MAX_FRIENDS) {
    throw new Error(`Cannot exceed ${MAX_FRIENDS} friend connections`);
  }

  const { data, error } = await client
    .from('friend_connections')
    .insert({
      requester_id: user.id,
      responder_id: responderId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to send friend request: ${error.message}`);

  return {
    id: data.id,
    requesterId: data.requester_id,
    responderId: data.responder_id,
    status: data.status,
    createdAt: data.created_at,
    acceptedAt: data.accepted_at ?? null,
  };
}

/**
 * Accept an incoming friend request.
 */
export async function acceptFriendRequest(
  client: SocialSupabaseClient,
  connectionId: string,
): Promise<void> {
  const { error } = await client
    .from('friend_connections')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', connectionId);

  if (error) throw new Error(`Failed to accept friend request: ${error.message}`);
}

/**
 * Reject an incoming friend request.
 */
export async function rejectFriendRequest(
  client: SocialSupabaseClient,
  connectionId: string,
): Promise<void> {
  const { error } = await client
    .from('friend_connections')
    .update({ status: 'rejected' })
    .eq('id', connectionId);

  if (error) throw new Error(`Failed to reject friend request: ${error.message}`);
}

/**
 * Block a user via an existing connection.
 */
export async function blockUser(
  client: SocialSupabaseClient,
  connectionId: string,
): Promise<void> {
  const { error } = await client
    .from('friend_connections')
    .update({ status: 'blocked' })
    .eq('id', connectionId);

  if (error) throw new Error(`Failed to block user: ${error.message}`);
}

/**
 * Remove a friend connection entirely.
 */
export async function removeFriend(
  client: SocialSupabaseClient,
  connectionId: string,
): Promise<void> {
  const { error } = await client
    .from('friend_connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw new Error(`Failed to remove friend: ${error.message}`);
}

/**
 * Sync a share event to Supabase for the social feed.
 */
export async function syncShareEvent(
  client: SocialSupabaseClient,
  input: SyncShareEventInput,
): Promise<void> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await client
    .from('synced_share_events')
    .insert({
      user_id: user.id,
      event_type: input.eventType,
      book_title: input.bookTitle,
      book_cover_url: input.bookCoverUrl ?? null,
      book_authors: input.bookAuthors ?? null,
      rating: input.rating ?? null,
      review_excerpt: input.reviewExcerpt ?? null,
      visibility: input.visibility,
    });

  if (error) throw new Error(`Failed to sync share event: ${error.message}`);
}

/**
 * Get friend connections, optionally filtered by status.
 */
export async function getFriendConnections(
  client: SocialSupabaseClient,
  status?: FriendConnectionStatus,
): Promise<FriendConnection[]> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = client
    .from('friend_connections')
    .select('*')
    .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get connections: ${error.message}`);

  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    requesterId: row.requester_id,
    responderId: row.responder_id,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
  }));
}
