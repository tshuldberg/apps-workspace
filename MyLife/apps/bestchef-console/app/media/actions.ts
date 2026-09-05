'use server';

import {
  actionRedirects,
  applyModerationDecision,
  type ActionRedirects,
} from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { requiresStatementOfReasons } from '@/lib/decisions';
import { attachPlaybackUrl, loadVideoAsset } from '@/lib/media-promotion';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Submission video promotion (plan 33, closes the Phase 4.4 open item).
 *
 * Uploaded submission videos land private/pending in bc_media_assets and
 * are invisible to the feed until a moderator approves them here.
 *
 * Decisions route through bc_apply_moderation_decision (audit row, appeal
 * anchor, queue/flag settlement, row lock) - never direct status writes
 * (review 2026-07-04: hand-rolled updates made rejections unappealable
 * and unaudited). Approval then patches ONLY the playback URL: a
 * long-lived signed URL, the interim delivery path until the Phase 4.1
 * CDN/streaming pipeline (founder F4). Moderator attribution lives in the
 * decision row, NOT in asset metadata - approved asset rows are
 * world-readable and must never leak staff emails.
 *
 * Known limits recorded in plan 33 Status Delta: signed URLs outlive
 * takedowns until the purge worker removes the object; a re-sign job must
 * exist before the first expiry cohort; appeal reversals need this same
 * promotion step to re-publish.
 */

function respond(): ActionRedirects {
  return actionRedirects('/media');
}

async function submissionIsApproved(
  admin: ReturnType<typeof createAdminClient>,
  submissionId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('bc_submissions')
    .select('id, moderation_status')
    .eq('id', submissionId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { moderation_status: string }).moderation_status === 'approved';
}

export async function approveSubmissionVideo(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const assetId = String(formData.get('assetId') ?? '').trim();
  const r: ActionRedirects = respond();
  if (!assetId) r.fail('invalid_input');

  const admin = createAdminClient();
  const asset = await loadVideoAsset(admin, assetId);
  if (!asset || asset.owner_kind !== 'submission' || asset.media_kind !== 'video') {
    r.fail('asset_not_found');
  }
  if (!asset.storage_bucket || !asset.storage_key) r.fail('asset_missing_storage');

  // Recovery path: decision landed but the URL patch failed on a previous
  // attempt. Re-running only re-signs; no duplicate decision row.
  if (asset.moderation_status === 'approved' && !asset.remote_url) {
    const patched = await attachPlaybackUrl(admin, asset);
    if (patched !== 'ok') r.fail(patched);
    r.done('video_approved');
  }
  if (asset.moderation_status !== 'pending') r.fail('already_decided');

  // Publishing a video whose SUBMISSION is not approved would create a
  // public asset the feed always drops - confusing for everyone.
  if (!(await submissionIsApproved(admin, asset.owner_id))) {
    r.fail('submission_not_approved');
  }

  const decision = await applyModerationDecision(admin, {
    kind: 'media_asset',
    targetId: assetId,
    decision: 'approved',
    reason: null,
    moderatorEmail,
  });
  if (decision.errorCode || !decision.decisionId) {
    r.fail(decision.errorCode ?? 'decision_failed');
  }

  const refreshed = await loadVideoAsset(admin, assetId);
  if (!refreshed) r.fail('asset_not_found');
  const patched = await attachPlaybackUrl(admin, refreshed);
  if (patched !== 'ok') r.fail(patched);

  r.done('video_approved');
}

export async function rejectSubmissionVideo(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const assetId = String(formData.get('assetId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  const r: ActionRedirects = respond();
  if (!assetId) r.fail('invalid_input');
  if (requiresStatementOfReasons('rejected') && !reason) r.fail('reason_required');

  const admin = createAdminClient();
  const asset = await loadVideoAsset(admin, assetId);
  if (!asset || asset.owner_kind !== 'submission' || asset.media_kind !== 'video') {
    r.fail('asset_not_found');
  }
  if (asset.moderation_status !== 'pending') r.fail('already_decided');

  const decision = await applyModerationDecision(admin, {
    kind: 'media_asset',
    targetId: assetId,
    decision: 'rejected',
    reason,
    moderatorEmail,
  });
  if (decision.errorCode || !decision.decisionId) {
    r.fail(decision.errorCode ?? 'decision_failed');
  }

  r.done('video_rejected');
}

/**
 * Image asset review (audit C4). Images across UGC owner kinds (submission,
 * comment, post) land private/pending and are routed to human review by the
 * screening worker (which never auto-approves). These two actions are the human
 * decision.
 *
 * Decisions route through bc_apply_moderation_decision (audit row, appeal
 * anchor, queue/flag settlement) - never a direct status write. Approving an
 * image flips the asset public/ready; the owning content's own moderation
 * status (e.g. a pending submission) is a SEPARATE content decision, surfaced
 * to the moderator but not auto-changed here.
 */
async function loadImageAsset(
  admin: ReturnType<typeof createAdminClient>,
  assetId: string,
): Promise<{ owner_kind: string; media_kind: string; moderation_status: string } | null> {
  const { data, error } = await admin
    .from('bc_media_assets')
    .select('owner_kind, media_kind, moderation_status')
    .eq('id', assetId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { owner_kind: string; media_kind: string; moderation_status: string };
}

const IMAGE_OWNER_KINDS = new Set(['submission', 'comment', 'post']);

export async function approveMediaImage(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const assetId = String(formData.get('assetId') ?? '').trim();
  const r: ActionRedirects = respond();
  if (!assetId) r.fail('invalid_input');

  const admin = createAdminClient();
  const asset = await loadImageAsset(admin, assetId);
  if (!asset || asset.media_kind !== 'image' || !IMAGE_OWNER_KINDS.has(asset.owner_kind)) {
    r.fail('asset_not_found');
  }
  if (asset.moderation_status !== 'pending') r.fail('already_decided');

  const decision = await applyModerationDecision(admin, {
    kind: 'media_asset',
    targetId: assetId,
    decision: 'approved',
    reason: null,
    moderatorEmail,
  });
  if (decision.errorCode || !decision.decisionId) {
    r.fail(decision.errorCode ?? 'decision_failed');
  }

  r.done('image_approved');
}

export async function rejectMediaImage(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const assetId = String(formData.get('assetId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  const r: ActionRedirects = respond();
  if (!assetId) r.fail('invalid_input');
  if (requiresStatementOfReasons('rejected') && !reason) r.fail('reason_required');

  const admin = createAdminClient();
  const asset = await loadImageAsset(admin, assetId);
  if (!asset || asset.media_kind !== 'image' || !IMAGE_OWNER_KINDS.has(asset.owner_kind)) {
    r.fail('asset_not_found');
  }
  if (asset.moderation_status !== 'pending') r.fail('already_decided');

  const decision = await applyModerationDecision(admin, {
    kind: 'media_asset',
    targetId: assetId,
    decision: 'rejected',
    reason,
    moderatorEmail,
  });
  if (decision.errorCode || !decision.decisionId) {
    r.fail(decision.errorCode ?? 'decision_failed');
  }

  r.done('image_rejected');
}
