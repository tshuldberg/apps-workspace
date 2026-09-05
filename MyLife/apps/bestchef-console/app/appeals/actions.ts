'use server';

import { actionRedirects, applyModerationDecision, type ActionRedirects } from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { planAppealReversal } from '@/lib/decisions';
import { attachPlaybackUrl, loadVideoAsset } from '@/lib/media-promotion';
import { fetchAppealDecision, type AppealDecisionInfo } from '@/lib/queries';
import { unwrapRpcRow, type RpcErrorRow } from '@/lib/rpc';
import { createAdminClient } from '@/lib/supabase-admin';

interface ResolveAppealRow extends RpcErrorRow {
  appeal_id: string;
  status: string | null;
}

const respond: ActionRedirects = actionRedirects('/appeals');

/**
 * Resolves a DSA Art. 20 appeal. The original decision (and therefore the
 * reversal plan) is ALWAYS derived server-side from the appeal row, never
 * from form fields (review finding: hidden-field tampering).
 *
 * Ordering is load-bearing (review finding): the content reversal runs
 * BEFORE bc_resolve_appeal. bc_resolve_appeal only acts on open appeals, so
 * a reversal failure leaves the appeal open and retryable instead of
 * terminally "overturned" with the enforcement still in place. If the
 * reversal succeeds but the resolve then fails, the appeal is still open;
 * retry with "reverse content" unchecked (a second reversal would only log
 * a duplicate decision row, it cannot re-hide content).
 */
export async function resolveAppeal(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const appealId = String(formData.get('appealId') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const reverse = formData.get('reverse') === 'on';

  if (!appealId || (outcome !== 'upheld' && outcome !== 'overturned')) {
    respond.fail('invalid_input');
  }
  // DSA statement of reasons: required for BOTH outcomes, even though the
  // column is nullable.
  if (!reason) respond.fail('reason_required');

  const admin = createAdminClient();

  let appealInfo: AppealDecisionInfo | null;
  try {
    appealInfo = await fetchAppealDecision(admin, appealId);
  } catch {
    respond.fail('appeal_lookup_failed');
  }
  if (!appealInfo) respond.fail('appeal_not_found');
  if (appealInfo.appealStatus !== 'open') respond.fail('appeal_already_resolved');

  if (outcome === 'overturned' && reverse) {
    const plan = appealInfo.decision
      ? planAppealReversal(
          appealInfo.decision.kind,
          appealInfo.decision.targetId,
          appealInfo.decision.decision,
        )
      : null;
    if (plan) {
      const result = await applyModerationDecision(admin, {
        kind: plan.kind,
        targetId: plan.targetId,
        decision: plan.decision,
        reason: `Appeal overturned: ${reason}`,
        moderatorEmail,
        extraMetadata: { appeal_id: appealId },
      });
      if (result.errorCode) {
        // Appeal is still open; the whole resolution is retryable.
        respond.fail(`reversal_failed_appeal_still_open:${result.errorCode}`);
      }
    }
  }

  const { data, error } = await admin.rpc('bc_resolve_appeal', {
    p_appeal_id: appealId,
    p_outcome: outcome,
    p_reason: reason,
  });
  if (error) {
    console.error(`bestchef-console: bc_resolve_appeal failed (${appealId}): ${error.message}`);
  }
  const unwrapped = unwrapRpcRow<ResolveAppealRow>(data, error);
  if (unwrapped.errorCode) {
    respond.fail(
      outcome === 'overturned' && reverse
        ? `content_reversed_but_appeal_still_open:${unwrapped.errorCode}`
        : unwrapped.errorCode,
    );
  }

  // A restored VIDEO needs its playback URL re-attached (the decision RPC
  // sets approved/public/ready but remote_url stays null, so the feed
  // would never show it). Failures do not undo the resolution: the asset
  // sits in the /media recovery queue (approved + URL missing), and a
  // purged object (rejection overturned after the 183-day evidence
  // window) is surfaced honestly.
  if (outcome === 'overturned' && reverse && appealInfo.decision?.kind === 'media_asset') {
    const asset = await loadVideoAsset(admin, appealInfo.decision.targetId);
    if (asset && asset.owner_kind === 'submission' && asset.media_kind === 'video') {
      const promotion = await attachPlaybackUrl(admin, asset);
      if (promotion === 'asset_purged') {
        respond.done('appeal_resolved_video_object_purged');
      }
      if (promotion !== 'ok') {
        respond.done('appeal_resolved_video_needs_media_queue');
      }
    }
  }

  respond.done(outcome);
}
