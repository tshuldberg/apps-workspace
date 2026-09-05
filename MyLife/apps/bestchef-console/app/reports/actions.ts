'use server';

import { actionRedirects, applyModerationDecision, type ActionRedirects } from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { flagKindToDecisionKind, requiresStatementOfReasons } from '@/lib/decisions';
import { fetchFlagTarget, type FlagTargetRow } from '@/lib/queries';
import { isReportOpenStatus, REPORT_OPEN_STATUSES } from '@/lib/statuses';
import { createAdminClient } from '@/lib/supabase-admin';

const CONTENT_DECISIONS = new Set([
  'approved',
  'rejected',
  'hidden',
  'removed',
  'restored',
  'dismissed',
]);

const respond: ActionRedirects = actionRedirects('/reports');

/**
 * Handles a bc_flags row: either resolves the flag itself (dismiss/note) or
 * applies a content decision to the flagged target. The decision target is
 * ALWAYS derived server-side from the bc_flags row by flagId; form fields
 * cannot choose the target (review finding: hidden-field tampering).
 * After a content decision, every open flag against the same target is
 * resolved so the queue never shows phantom outstanding flags.
 */
export async function actOnFlag(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const flagId = String(formData.get('flagId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!flagId || !action) respond.fail('invalid_input');
  const admin = createAdminClient();

  if (action === 'dismiss_flag' || action === 'note_flag') {
    const { data, error } = await admin
      .from('bc_flags')
      .update({
        status: action === 'dismiss_flag' ? 'dismissed' : 'noted',
        resolution: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', flagId)
      .select('id');
    if (error || !data || data.length !== 1) respond.fail('flag_update_failed');
    respond.done(action === 'dismiss_flag' ? 'flag_dismissed' : 'flag_noted');
  }

  if (!CONTENT_DECISIONS.has(action)) respond.fail('invalid_input');

  let target: FlagTargetRow | null;
  try {
    target = await fetchFlagTarget(admin, flagId);
  } catch {
    respond.fail('flag_lookup_failed');
  }
  if (!target) respond.fail('flag_not_found');
  if (!isReportOpenStatus(target.status)) respond.fail('flag_already_handled');

  const kind = flagKindToDecisionKind(target.targetType);
  if (!kind) respond.fail('no_decision_path');
  if (requiresStatementOfReasons(action) && !reason) respond.fail('reason_required');

  const result = await applyModerationDecision(admin, {
    kind,
    targetId: target.targetId,
    decision: action,
    reason: reason || null,
    moderatorEmail,
    extraMetadata: { flag_id: flagId },
  });
  if (result.errorCode) respond.fail(result.errorCode);

  // Resolve ALL open flags on this target (including this one) so siblings
  // do not linger as phantom queue entries after the content is decided.
  const { error: flagError } = await admin
    .from('bc_flags')
    .update({
      status: 'actioned',
      resolution: `${action}${reason ? `: ${reason}` : ''} (flag ${flagId})`,
      updated_at: new Date().toISOString(),
    })
    .eq('target_type', target.targetType)
    .eq('target_id', target.targetId)
    .in('status', [...REPORT_OPEN_STATUSES]);
  if (flagError) {
    console.error(`bestchef-console: flag bookkeeping update failed: ${flagError.message}`);
    respond.fail('decided_but_flag_update_failed');
  }

  respond.done('flag_actioned');
}

/** Resolve or dismiss a bc_photo_reports row without touching content. */
export async function resolvePhotoReport(formData: FormData): Promise<void> {
  await requireModerator();
  const reportId = String(formData.get('reportId') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '').trim();
  if (!reportId || (outcome !== 'resolved' && outcome !== 'dismissed')) respond.fail('invalid_input');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bc_photo_reports')
    .update({ status: outcome })
    .eq('id', reportId)
    .select('id');
  if (error || !data || data.length !== 1) respond.fail('report_update_failed');
  respond.done(`report_${outcome}`);
}

/**
 * One-click compose: hide the reported submission (statement of reasons
 * required), resolve every open photo report against it, and action any
 * open flags targeting the same submission.
 */
export async function hideReportedSubmission(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!submissionId) respond.fail('invalid_input');
  if (!reason) respond.fail('reason_required');

  const admin = createAdminClient();
  const result = await applyModerationDecision(admin, {
    kind: 'submission',
    targetId: submissionId,
    decision: 'hidden',
    reason,
    moderatorEmail,
    extraMetadata: { source: 'photo_reports' },
  });
  if (result.errorCode) respond.fail(result.errorCode);

  const [reports, flags] = await Promise.all([
    admin
      .from('bc_photo_reports')
      .update({ status: 'resolved' })
      .eq('submission_id', submissionId)
      .in('status', [...REPORT_OPEN_STATUSES]),
    admin
      .from('bc_flags')
      .update({
        status: 'actioned',
        resolution: `hidden: ${reason} (via photo reports)`,
        updated_at: new Date().toISOString(),
      })
      .eq('target_type', 'submission')
      .eq('target_id', submissionId)
      .in('status', [...REPORT_OPEN_STATUSES]),
  ]);
  if (reports.error || flags.error) {
    console.error(
      `bestchef-console: report bookkeeping update failed: ${
        reports.error?.message ?? flags.error?.message
      }`,
    );
    respond.fail('decided_but_reports_update_failed');
  }

  respond.done('submission_hidden');
}
