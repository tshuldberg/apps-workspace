'use server';

import {
  submitPhotoReport,
  getVerificationStatus,
  createFlag,
  getPublicNotes,
  createNote,
  rateNote,
  type PhotoReport,
  type Flag,
  type CloudNote,
  type NoteRating,
  type VerificationStatus,
  type FlagTargetTypeValue,
  type PhotoReportReasonValue,
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

// ── Photo Reports ───────────────────────────────────────────────────

export async function submitPhotoReportAction(
  submissionId: string,
  reporterId: string,
  reason: string,
): Promise<ActionResult<PhotoReport>> {
  try {
    const result = await submitPhotoReport(
      submissionId,
      reporterId,
      reason as PhotoReportReasonValue,
    );
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[moderation-actions] submitPhotoReportAction failed:', e);
    return failure('Failed to submit report');
  }
}

// ── Flags ───────────────────────────────────────────────────────────

export async function createFlagAction(
  targetType: string,
  targetId: string,
  flaggerId: string,
  reason: string,
): Promise<ActionResult<Flag>> {
  try {
    const result = await createFlag(
      targetType as FlagTargetTypeValue,
      targetId,
      flaggerId,
      reason,
    );
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[moderation-actions] createFlagAction failed:', e);
    return failure('Failed to create flag');
  }
}

// ── Community Notes ─────────────────────────────────────────────────

export async function getPublicNotesAction(
  targetType: string,
  targetId: string,
): Promise<ActionResult<CloudNote[]>> {
  try {
    const result = await getPublicNotes(
      targetType as FlagTargetTypeValue,
      targetId,
    );
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[moderation-actions] getPublicNotesAction failed:', e);
    return failure('Failed to load notes');
  }
}

export async function createNoteAction(
  flagId: string,
  authorId: string,
  body: string,
): Promise<ActionResult<CloudNote>> {
  try {
    const result = await createNote(flagId, authorId, body);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[moderation-actions] createNoteAction failed:', e);
    return failure('Failed to create note');
  }
}

export async function rateNoteAction(
  noteId: string,
  raterId: string,
  rating: string,
): Promise<ActionResult<NoteRating>> {
  try {
    const result = await rateNote(
      noteId,
      raterId,
      rating as 'helpful' | 'unhelpful',
    );
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[moderation-actions] rateNoteAction failed:', e);
    return failure('Failed to rate note');
  }
}

// ── Verification Status ─────────────────────────────────────────────

export async function getVerificationStatusAction(
  submissionId: string,
): Promise<ActionResult<VerificationStatus>> {
  try {
    const result = await getVerificationStatus(submissionId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[moderation-actions] getVerificationStatusAction failed:', e);
    return failure('Failed to load verification status');
  }
}
