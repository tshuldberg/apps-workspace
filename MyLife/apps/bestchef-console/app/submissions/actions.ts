'use server';

import {
  actionRedirects,
  applyModerationDecision,
  type ActionRedirects,
} from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { requiresStatementOfReasons } from '@/lib/decisions';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Pending-submission content review (audit C2). New submissions default
 * moderation_status='pending' and are public-invisible until approved here.
 *
 * Decisions route through bc_apply_moderation_decision (audit row, appeal
 * anchor, queue/flag settlement) - never a direct status write. Approving flips
 * the submission to 'approved' (public); rejecting requires a statement of
 * reasons (DSA Art. 17). The submission's media is a SEPARATE per-asset decision
 * handled on the /media queue.
 */

function respond(): ActionRedirects {
  return actionRedirects('/submissions');
}

async function submissionStatus(
  admin: ReturnType<typeof createAdminClient>,
  submissionId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('bc_submissions')
    .select('moderation_status')
    .eq('id', submissionId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { moderation_status: string }).moderation_status;
}

export async function approveSubmission(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const r: ActionRedirects = respond();
  if (!submissionId) r.fail('invalid_input');

  const admin = createAdminClient();
  const status = await submissionStatus(admin, submissionId);
  if (status === null) r.fail('submission_not_found');
  if (status !== 'pending') r.fail('already_decided');

  const decision = await applyModerationDecision(admin, {
    kind: 'submission',
    targetId: submissionId,
    decision: 'approved',
    reason: null,
    moderatorEmail,
    extraMetadata: { source: 'pending_review' },
  });
  if (decision.errorCode || !decision.decisionId) {
    r.fail(decision.errorCode ?? 'decision_failed');
  }

  r.done('submission_approved');
}

export async function rejectSubmission(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  const r: ActionRedirects = respond();
  if (!submissionId) r.fail('invalid_input');
  if (requiresStatementOfReasons('rejected') && !reason) r.fail('reason_required');

  const admin = createAdminClient();
  const status = await submissionStatus(admin, submissionId);
  if (status === null) r.fail('submission_not_found');
  if (status !== 'pending') r.fail('already_decided');

  const decision = await applyModerationDecision(admin, {
    kind: 'submission',
    targetId: submissionId,
    decision: 'rejected',
    reason,
    moderatorEmail,
    extraMetadata: { source: 'pending_review' },
  });
  if (decision.errorCode || !decision.decisionId) {
    r.fail(decision.errorCode ?? 'decision_failed');
  }

  r.done('submission_rejected');
}
