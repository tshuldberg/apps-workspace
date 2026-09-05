/**
 * Comment engine -- hybrid comment system for BestChef submissions.
 *
 * Native bc_comments for recipe-specific features (comment types, pinning,
 * threaded replies via parent_id, author edits, soft-deletes, helpful marks)
 * with optional bridge to @mylife/social for feed integration.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import { normalizeUgcLanguage } from './submission';
import type { Comment, CommentHelpful } from './types';

/** Maximum comment body length in characters. */
export const MAX_COMMENT_LENGTH = 2000;

/** Author edit window in hours. Mirrored server-side by bc_edit_comment. */
export const COMMENT_EDIT_WINDOW_HOURS = 24;

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mappers ───────────────────────────────────────────────────────

function mapComment(row: Record<string, unknown>): Comment {
  return {
    id: row.id as string,
    submissionId: row.submission_id as string,
    profileId: row.profile_id as string,
    socialActivityId: (row.social_activity_id as string) ?? null,
    parentId: (row.parent_id as string) ?? null,
    body: row.body as string,
    commentType:
      (row.comment_type as Comment['commentType']) ?? 'comment',
    photoUrl: (row.photo_url as string) ?? null,
    isPinned: (row.is_pinned as boolean) ?? false,
    helpfulCount: (row.helpful_count as number) ?? 0,
    moderationStatus:
      (row.moderation_status as Comment['moderationStatus']) ?? 'approved',
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    editedAt: row.edited_at ? new Date(row.edited_at as string) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
  };
}

function mapCommentHelpful(row: Record<string, unknown>): CommentHelpful {
  return {
    commentId: row.comment_id as string,
    voterProfileId: row.voter_profile_id as string,
    createdAt: new Date(row.created_at as string),
  };
}

// ── Options ──────────────────────────────────────────────────────────

export interface AddCommentOptions {
  commentType?: 'comment' | 'tried_this' | 'chefs_tip';
  photoUrl?: string;
  socialActivityId?: string;
  /** Parent comment id for threaded replies (F-031). */
  parentId?: string;
  /** Author's app language tag, lowercase (plan 33 Phase 2.5). */
  language?: string | null;
}

export interface GetCommentsOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'newest' | 'most_helpful';
}

// ── Write operations ─────────────────────────────────────────────────

export async function addComment(
  submissionId: string,
  profileId: string,
  body: string,
  options?: AddCommentOptions,
): Promise<BestChefResult<Comment>> {
  if (body.length > MAX_COMMENT_LENGTH) {
    return err(`Comment body exceeds ${MAX_COMMENT_LENGTH} character limit`);
  }
  if (body.trim().length === 0) {
    return err('Comment body cannot be empty');
  }

  const { data, error: dbErr } = await from('bc_comments')
    .insert({
      submission_id: submissionId,
      profile_id: profileId,
      body: body.trim(),
      comment_type: options?.commentType ?? 'comment',
      photo_url: options?.photoUrl ?? null,
      social_activity_id: options?.socialActivityId ?? null,
      parent_id: options?.parentId ?? null,
      language: normalizeUgcLanguage(options?.language),
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);

  const inserted = mapComment(data);
  // Fanout notification -- fire-and-forget. The RPC handles surfacing the
  // notification to the parent author when parent_id is set.
  void (async () => {
    try {
      await getBestChefClient().rpc('bc_notify_comment', {
        submission_id: submissionId,
        comment_id: inserted.id,
        actor_id: profileId,
      });
    } catch { /* never block the primary path */ }
  })();

  return ok(inserted);
}

export async function updateComment(
  commentId: string,
  body: string,
): Promise<BestChefResult<Comment>> {
  if (body.length > MAX_COMMENT_LENGTH) {
    return err(`Comment body exceeds ${MAX_COMMENT_LENGTH} character limit`);
  }
  if (body.trim().length === 0) {
    return err('Comment body cannot be empty');
  }

  const { data, error: dbErr } = await from('bc_comments')
    .update({ body: body.trim() })
    .eq('id', commentId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapComment(data));
}

/**
 * F-032: edit own comment within the configured window.
 *
 * Calls the bc_edit_comment RPC, which enforces ownership + the 24h window
 * server-side. Maps the well-known error messages back to stable codes the
 * UI can render in i18n strings.
 */
export async function editComment(
  commentId: string,
  body: string,
): Promise<BestChefResult<Comment>> {
  if (body.length > MAX_COMMENT_LENGTH) {
    return err(`Comment body exceeds ${MAX_COMMENT_LENGTH} character limit`);
  }
  if (body.trim().length === 0) {
    return err('Comment body cannot be empty');
  }

  const { error: rpcErr } = await getBestChefClient().rpc('bc_edit_comment', {
    p_comment_id: commentId,
    p_body: body.trim(),
  });
  if (rpcErr) {
    const message = rpcErr.message ?? '';
    if (message.includes('edit_window_expired')) return err('edit_window_expired');
    if (message.includes('unauthorized')) return err('unauthorized');
    return err(message || 'edit_failed');
  }

  const { data, error: readErr } = await from('bc_comments')
    .select('*')
    .eq('id', commentId)
    .single();
  if (readErr) return err(readErr.message);
  return ok(mapComment(data));
}

/**
 * F-032: soft delete own comment.
 *
 * Replies (per F-031) survive with a "[deleted]" placeholder rendered by the
 * UI when deletedAt is non-null. Body is replaced server-side so deleted
 * content never leaks via cached row reads.
 */
export async function deleteComment(
  commentId: string,
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_comments')
    .update({ deleted_at: new Date().toISOString(), body: '[deleted]' })
    .eq('id', commentId);

  if (dbErr) return err(dbErr.message);
  return ok(undefined);
}

// ── Pin operations ───────────────────────────────────────────────────

export async function pinComment(
  commentId: string,
): Promise<BestChefResult<Comment>> {
  const { data, error: dbErr } = await from('bc_comments')
    .update({ is_pinned: true })
    .eq('id', commentId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapComment(data));
}

export async function unpinComment(
  commentId: string,
): Promise<BestChefResult<Comment>> {
  const { data, error: dbErr } = await from('bc_comments')
    .update({ is_pinned: false })
    .eq('id', commentId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapComment(data));
}

// ── Helpful marks (F-033 / B-008) ────────────────────────────────────

export async function markHelpful(
  commentId: string,
  voterProfileId: string,
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_comment_helpful')
    .insert({
      comment_id: commentId,
      voter_profile_id: voterProfileId,
    });

  if (dbErr) return err(dbErr.message);

  return ok(undefined);
}

export async function unmarkHelpful(
  commentId: string,
  voterProfileId: string,
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_comment_helpful')
    .delete()
    .eq('comment_id', commentId)
    .eq('voter_profile_id', voterProfileId);

  if (dbErr) return err(dbErr.message);

  return ok(undefined);
}

/**
 * F-033: idempotent toggle. Returns the new helpful state for the viewer.
 *
 * The unique (comment_id, voter_profile_id) PK in bc_comment_helpful makes a
 * duplicate insert a no-op error; we probe first so a single call always
 * flips state and returns what it set.
 */
export async function toggleHelpful(
  commentId: string,
  voterProfileId: string,
): Promise<BestChefResult<{ isHelpful: boolean }>> {
  const { data: existing, error: probeErr } = await from('bc_comment_helpful')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('voter_profile_id', voterProfileId)
    .maybeSingle();
  if (probeErr) return err(probeErr.message);

  if (existing) {
    const unmark = await unmarkHelpful(commentId, voterProfileId);
    if (!unmark.ok) return err(unmark.error);
    return ok({ isHelpful: false });
  }

  const mark = await markHelpful(commentId, voterProfileId);
  if (!mark.ok) return err(mark.error);
  return ok({ isHelpful: true });
}

export async function getHelpfulVoters(
  commentId: string,
): Promise<BestChefResult<CommentHelpful[]>> {
  const { data, error: dbErr } = await from('bc_comment_helpful')
    .select('*')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapCommentHelpful));
}

/**
 * F-033: which of `commentIds` has the given user marked helpful?
 *
 * Returns a Set for O(1) lookup in the UI; an empty Set is returned for an
 * empty input or when there are no marks.
 */
export async function getCommentHelpfulState(
  commentIds: string[],
  voterProfileId: string,
): Promise<BestChefResult<Set<string>>> {
  if (commentIds.length === 0) return ok(new Set<string>());

  const { data, error: dbErr } = await from('bc_comment_helpful')
    .select('comment_id')
    .in('comment_id', commentIds)
    .eq('voter_profile_id', voterProfileId);

  if (dbErr) return err(dbErr.message);
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ comment_id: string }>) {
    set.add(row.comment_id);
  }
  return ok(set);
}

// ── Read operations ──────────────────────────────────────────────────

export async function getComment(
  commentId: string,
): Promise<BestChefResult<Comment>> {
  const { data, error: dbErr } = await from('bc_comments')
    .select('*')
    .eq('id', commentId)
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapComment(data));
}

export async function getCommentsForSubmission(
  submissionId: string,
  options?: GetCommentsOptions,
): Promise<BestChefResult<Comment[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const sortBy = options?.sortBy ?? 'newest';

  const orderColumn = sortBy === 'most_helpful' ? 'helpful_count' : 'created_at';

  const { data, error: dbErr } = await from('bc_comments')
    .select('*')
    .eq('submission_id', submissionId)
    .order(orderColumn, { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapComment));
}

export async function getTriedThisComments(
  submissionId: string,
): Promise<BestChefResult<Comment[]>> {
  const { data, error: dbErr } = await from('bc_comments')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('comment_type', 'tried_this')
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapComment));
}

export async function getPinnedComments(
  submissionId: string,
): Promise<BestChefResult<Comment[]>> {
  const { data, error: dbErr } = await from('bc_comments')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('is_pinned', true)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapComment));
}

export async function getCommentCount(
  submissionId: string,
): Promise<BestChefResult<number>> {
  const { count, error: dbErr } = await from('bc_comments')
    .select('*', { count: 'exact', head: true })
    .eq('submission_id', submissionId);

  if (dbErr) return err(dbErr.message);
  return ok(count ?? 0);
}

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Truncate a comment body for preview display.
 * Appends an ellipsis if the body exceeds `maxLength`.
 */
export function formatCommentPreview(body: string, maxLength = 100): string {
  if (body.length <= maxLength) return body;
  // Find the last space before maxLength to avoid splitting words
  const truncated = body.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cutPoint = lastSpace > maxLength * 0.5 ? lastSpace : maxLength;
  return truncated.slice(0, cutPoint) + '...';
}

/**
 * F-032: is the author still inside the edit window?
 *
 * Pure helper so the UI can hide the Edit affordance after the cutoff without
 * a round-trip; the server enforces the same rule via bc_edit_comment.
 */
export function isWithinEditWindow(
  createdAt: Date,
  now: Date = new Date(),
  windowHours: number = COMMENT_EDIT_WINDOW_HOURS,
): boolean {
  const diffMs = now.getTime() - createdAt.getTime();
  return diffMs >= 0 && diffMs <= windowHours * 60 * 60 * 1000;
}
