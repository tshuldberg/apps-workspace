'use server';

import {
  getCommentsForSubmission,
  addComment,
  markHelpful,
  unmarkHelpful,
  getCommentCount,
  getForksOfRecipe,
  getForkCount,
  forkRecipe,
  getRecipeLineage,
  getSubmissionById,
  type CloudComment,
  type RecipeFork,
  type RecipeSnapshot,
  type Submission,
  type GetCommentsOptions,
  type AddCommentOptions,
  type RecipeModifications,
} from '@mylife/bestchef';

// ── Result wrapper ──────────────────────────────────────────────────

interface ActionResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, data: null, error };
}

// ── Comments ───────────────────────────────────────────────────────

export async function getCommentsAction(
  submissionId: string,
  options?: GetCommentsOptions,
): Promise<ActionResult<CloudComment[]>> {
  try {
    const result = await getCommentsForSubmission(submissionId, options);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] getCommentsAction failed:', e);
    return failure('Failed to load comments');
  }
}

export async function addCommentAction(
  submissionId: string,
  profileId: string,
  body: string,
  options?: AddCommentOptions,
): Promise<ActionResult<CloudComment>> {
  try {
    const result = await addComment(submissionId, profileId, body, options);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] addCommentAction failed:', e);
    return failure('Failed to add comment');
  }
}

export async function markHelpfulAction(
  commentId: string,
  voterProfileId: string,
): Promise<ActionResult<void>> {
  try {
    const result = await markHelpful(commentId, voterProfileId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] markHelpfulAction failed:', e);
    return failure('Failed to mark helpful');
  }
}

export async function unmarkHelpfulAction(
  commentId: string,
  voterProfileId: string,
): Promise<ActionResult<void>> {
  try {
    const result = await unmarkHelpful(commentId, voterProfileId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] unmarkHelpfulAction failed:', e);
    return failure('Failed to unmark helpful');
  }
}

export async function getCommentCountAction(
  submissionId: string,
): Promise<ActionResult<number>> {
  try {
    const result = await getCommentCount(submissionId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] getCommentCountAction failed:', e);
    return failure('Failed to load comment count');
  }
}

// ── Forks ──────────────────────────────────────────────────────────

export async function getForksAction(
  snapshotId: string,
): Promise<ActionResult<RecipeFork[]>> {
  try {
    const result = await getForksOfRecipe(snapshotId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] getForksAction failed:', e);
    return failure('Failed to load forks');
  }
}

export async function getForkCountAction(
  snapshotId: string,
): Promise<ActionResult<number>> {
  try {
    const result = await getForkCount(snapshotId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] getForkCountAction failed:', e);
    return failure('Failed to load fork count');
  }
}

export async function forkRecipeAction(
  sourceSnapshotId: string,
  profileId: string,
  modifications?: RecipeModifications,
): Promise<ActionResult<{ fork: RecipeFork; snapshot: RecipeSnapshot }>> {
  try {
    const result = await forkRecipe(sourceSnapshotId, profileId, modifications);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] forkRecipeAction failed:', e);
    return failure('Failed to fork recipe');
  }
}

// ── Lineage ────────────────────────────────────────────────────────

export async function getRecipeLineageAction(
  snapshotId: string,
): Promise<ActionResult<string[]>> {
  try {
    const result = await getRecipeLineage(snapshotId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] getRecipeLineageAction failed:', e);
    return failure('Failed to load lineage');
  }
}

// ── Submission detail ──────────────────────────────────────────────

export async function getSubmissionByIdAction(
  submissionId: string,
): Promise<ActionResult<{ submission: Submission; snapshot: RecipeSnapshot }>> {
  try {
    const result = await getSubmissionById(submissionId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[comment-actions] getSubmissionByIdAction failed:', e);
    return failure('Failed to load submission');
  }
}
