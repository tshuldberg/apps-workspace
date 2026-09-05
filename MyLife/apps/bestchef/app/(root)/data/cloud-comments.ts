import {
  addComment,
  editComment,
  deleteComment,
  getCommentsForSubmission,
  getCommentHelpfulState,
  toggleHelpful,
  type CloudComment,
} from '@mylife/bestchef';
import type { SocialProfile } from '@mylife/social';
import type { DemoComment } from './demo';
import { getUgcLanguage } from './app-language';
import { isCloudSubmissionId } from './cloud-submissions';

export { isCloudSubmissionId };

function formatCloudCommentDate(value: Date): string {
  return value.toISOString().split('T')[0] ?? value.toISOString();
}

export interface ToCommentViewModelOptions {
  helpfulIds?: Set<string>;
}

export function toCommentViewModel(
  comment: CloudComment,
  profile: SocialProfile | null,
  options?: ToCommentViewModelOptions,
): DemoComment {
  const isMine = profile?.id === comment.profileId;
  const isDeleted = comment.deletedAt !== null;
  const isEdited = comment.editedAt !== null;
  const isHelpful = options?.helpfulIds?.has(comment.id) ?? false;

  return {
    id: comment.id,
    submissionId: comment.submissionId,
    authorName: isMine && profile ? profile.displayName : 'BestChef Cook',
    authorHandle: isMine && profile ? profile.handle : 'bestchef',
    text: comment.body,
    type: comment.commentType,
    helpfulCount: comment.helpfulCount,
    createdAt: formatCloudCommentDate(comment.createdAt),
    parentId: comment.parentId,
    isMine,
    isEdited,
    isDeleted,
    isHelpful,
    createdAtIso: comment.createdAt.toISOString(),
    isCloud: true,
  };
}

export async function getCloudCommentViewModels(
  submissionId: string,
  profile: SocialProfile | null,
): Promise<DemoComment[]> {
  if (!isCloudSubmissionId(submissionId)) return [];

  const result = await getCommentsForSubmission(submissionId);
  if (!result.ok) return [];

  let helpfulIds = new Set<string>();
  if (profile) {
    const ids = result.data.map((c) => c.id);
    const state = await getCommentHelpfulState(ids, profile.id);
    if (state.ok) helpfulIds = state.data;
  }

  return result.data.map((comment) =>
    toCommentViewModel(comment, profile, { helpfulIds }),
  );
}

export type AddCloudCommentError =
  | 'not_cloud'
  | 'rate_limited'
  | 'submission_not_found'
  | 'unknown';

export interface AddCloudCommentResult {
  comment?: DemoComment;
  error?: AddCloudCommentError;
}

export async function addCloudCommentViewModel(
  submissionId: string,
  profile: SocialProfile,
  body: string,
  parentId?: string,
): Promise<AddCloudCommentResult> {
  if (!isCloudSubmissionId(submissionId)) return { error: 'not_cloud' };

  const result = await addComment(submissionId, profile.id, body, {
    ...(parentId ? { parentId } : {}),
    language: getUgcLanguage(),
  });
  if (result.ok) return { comment: toCommentViewModel(result.data, profile) };

  // The server integrity gate (plan 33 Phase 1.2) raises machine codes; a
  // rejected cloud comment must surface, never silently downgrade to a
  // local-only comment the rest of the world cannot see.
  const message = result.error ?? '';
  if (message.includes('rate_limited')) return { error: 'rate_limited' };
  if (message.includes('submission_not_found')) return { error: 'submission_not_found' };
  return { error: 'unknown' };
}

export interface EditCloudCommentResult {
  comment?: DemoComment;
  error?: 'edit_window_expired' | 'unauthorized' | 'unknown';
}

export async function editCloudComment(
  commentId: string,
  body: string,
  profile: SocialProfile,
): Promise<EditCloudCommentResult> {
  const result = await editComment(commentId, body);
  if (result.ok) {
    return { comment: toCommentViewModel(result.data, profile) };
  }
  if (result.error === 'edit_window_expired') return { error: 'edit_window_expired' };
  if (result.error === 'unauthorized') return { error: 'unauthorized' };
  return { error: 'unknown' };
}

export async function deleteCloudComment(commentId: string): Promise<boolean> {
  const result = await deleteComment(commentId);
  return result.ok;
}

export async function toggleCloudHelpful(
  commentId: string,
  profile: SocialProfile,
): Promise<{ isHelpful: boolean } | null> {
  const result = await toggleHelpful(commentId, profile.id);
  return result.ok ? result.data : null;
}
