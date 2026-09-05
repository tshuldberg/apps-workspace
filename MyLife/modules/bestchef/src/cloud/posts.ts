/**
 * Creator posts -- blog articles, exclusive recipes, announcements.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { Post } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mapper ──────────────────────────────────────────────────────

function mapPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    title: row.title as string,
    body: row.body as string,
    postType: row.post_type as Post['postType'],
    visibility: (row.visibility as Post['visibility']) ?? 'public',
    requiredTierId: (row.required_tier_id as string) ?? null,
    coverImageUrl: (row.cover_image_url as string) ?? null,
    linkedSubmissionId: (row.linked_submission_id as string) ?? null,
    likeCount: (row.like_count as number) ?? 0,
    commentCount: (row.comment_count as number) ?? 0,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ── Access control ──────────────────────────────────────────────────

/**
 * Determine whether a viewer can access a post based on its visibility,
 * whether the viewer is subscribed, and which tier IDs the viewer holds.
 */
export function checkPostAccess(
  visibility: Post['visibility'],
  requiredTierId: string | null,
  isViewerSubscribed: boolean,
  viewerTierIds: string[],
): boolean {
  switch (visibility) {
    case 'public':
      return true;
    case 'subscribers':
      return isViewerSubscribed;
    case 'tier_specific':
      if (!isViewerSubscribed || !requiredTierId) return false;
      return viewerTierIds.includes(requiredTierId);
    default:
      return false;
  }
}

// ── Options ─────────────────────────────────────────────────────────

export interface GetPostsOptions {
  postType?: Post['postType'];
  visibility?: Post['visibility'];
  limit?: number;
  offset?: number;
}

// ── Write operations ────────────────────────────────────────────────

export interface CreatePostInput {
  title: string;
  body: string;
  postType: Post['postType'];
  visibility?: Post['visibility'];
  requiredTierId?: string;
  coverImageUrl?: string;
  linkedSubmissionId?: string;
}

export async function createPost(
  authorId: string,
  input: CreatePostInput,
): Promise<BestChefResult<Post>> {
  if (input.title.trim().length === 0) {
    return err('Post title cannot be empty');
  }

  const { data, error: dbErr } = await from('bc_posts')
    .insert({
      author_id: authorId,
      title: input.title.trim(),
      body: input.body,
      post_type: input.postType,
      visibility: input.visibility ?? 'public',
      required_tier_id: input.requiredTierId ?? null,
      cover_image_url: input.coverImageUrl ?? null,
      linked_submission_id: input.linkedSubmissionId ?? null,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapPost(data));
}

// ── Read operations ─────────────────────────────────────────────────

export async function getPostsByAuthor(
  authorId: string,
  options?: GetPostsOptions,
): Promise<BestChefResult<Post[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = from('bc_posts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.postType) {
    query = query.eq('post_type', options.postType);
  }
  if (options?.visibility) {
    query = query.eq('visibility', options.visibility);
  }

  const { data, error: dbErr } = await query;

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapPost));
}

export async function getPostById(
  postId: string,
): Promise<BestChefResult<Post>> {
  const { data, error: dbErr } = await from('bc_posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapPost(data));
}

export async function getPublicPostsByAuthor(
  authorId: string,
  options?: { limit?: number; offset?: number },
): Promise<BestChefResult<Post[]>> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_posts')
    .select('*')
    .eq('author_id', authorId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapPost));
}

export async function updatePost(
  postId: string,
  updates: Partial<Pick<Post, 'title' | 'body' | 'postType' | 'visibility' | 'requiredTierId' | 'coverImageUrl' | 'linkedSubmissionId'>>,
): Promise<BestChefResult<Post>> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.body !== undefined) dbUpdates.body = updates.body;
  if (updates.postType !== undefined) dbUpdates.post_type = updates.postType;
  if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;
  if (updates.requiredTierId !== undefined) dbUpdates.required_tier_id = updates.requiredTierId;
  if (updates.coverImageUrl !== undefined) dbUpdates.cover_image_url = updates.coverImageUrl;
  if (updates.linkedSubmissionId !== undefined) dbUpdates.linked_submission_id = updates.linkedSubmissionId;

  const { data, error: dbErr } = await from('bc_posts')
    .update(dbUpdates)
    .eq('id', postId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapPost(data));
}

export async function deletePost(
  postId: string,
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_posts')
    .delete()
    .eq('id', postId);

  if (dbErr) return err(dbErr.message);
  return ok(undefined);
}

export async function likePost(
  postId: string,
): Promise<BestChefResult<Post>> {
  const { data: current, error: readErr } = await from('bc_posts')
    .select('like_count')
    .eq('id', postId)
    .single();

  if (readErr) return err(readErr.message);

  const newCount = ((current.like_count as number) ?? 0) + 1;

  const { data, error: dbErr } = await from('bc_posts')
    .update({ like_count: newCount })
    .eq('id', postId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapPost(data));
}

export async function canViewPost(
  postId: string,
  viewerProfileId: string,
): Promise<BestChefResult<boolean>> {
  const { data: post, error: postErr } = await from('bc_posts')
    .select('author_id, visibility, required_tier_id')
    .eq('id', postId)
    .single();

  if (postErr) return err(postErr.message);

  if ((post.author_id as string) === viewerProfileId) {
    return ok(true);
  }

  const visibility = post.visibility as Post['visibility'];

  if (visibility === 'public') return ok(true);

  if (visibility === 'subscribers') {
    const { count, error: subErr } = await from('bc_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('subscriber_id', viewerProfileId)
      .eq('chef_id', post.author_id as string)
      .eq('status', 'active');

    if (subErr) return err(subErr.message);
    return ok((count ?? 0) > 0);
  }

  if (visibility === 'tier_specific') {
    const requiredTierId = post.required_tier_id as string | null;
    if (!requiredTierId) return ok(false);

    const { count, error: subErr } = await from('bc_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('subscriber_id', viewerProfileId)
      .eq('chef_id', post.author_id as string)
      .eq('tier_name', requiredTierId)
      .eq('status', 'active');

    if (subErr) return err(subErr.message);
    return ok((count ?? 0) > 0);
  }

  return ok(false);
}

export async function getPostFeed(
  viewerProfileId: string,
  options?: GetPostsOptions,
): Promise<BestChefResult<Post[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data: subs, error: subErr } = await from('bc_subscriptions')
    .select('chef_id')
    .eq('subscriber_id', viewerProfileId)
    .eq('status', 'active');

  if (subErr) return err(subErr.message);

  const chefIds = (subs ?? []).map((s: Record<string, unknown>) => s.chef_id as string);

  if (chefIds.length === 0) {
    const { data, error: dbErr } = await from('bc_posts')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbErr) return err(dbErr.message);
    return ok((data ?? []).map(mapPost));
  }

  const { data, error: dbErr } = await from('bc_posts')
    .select('*')
    .in('author_id', chefIds)
    .in('visibility', ['public', 'subscribers'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapPost));
}
