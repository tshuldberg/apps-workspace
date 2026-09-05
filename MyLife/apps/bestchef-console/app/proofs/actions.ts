'use server';

import { actionRedirects, applyModerationDecision, type ActionRedirects } from '@/lib/actions-shared';
import { requireModerator } from '@/lib/auth';
import { requiresStatementOfReasons } from '@/lib/decisions';
import { createAdminClient } from '@/lib/supabase-admin';

const respond: ActionRedirects = actionRedirects('/proofs');

export async function decideVoteProof(formData: FormData): Promise<void> {
  const moderatorEmail = await requireModerator();
  const proofId = String(formData.get('proofId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!proofId || (decision !== 'approved' && decision !== 'rejected')) {
    respond.fail('invalid_input');
  }
  if (requiresStatementOfReasons(decision) && !reason) {
    respond.fail('reason_required');
  }

  const admin = createAdminClient();
  const result = await applyModerationDecision(admin, {
    kind: 'vote_proof',
    targetId: proofId,
    decision,
    reason: reason || null,
    moderatorEmail,
  });
  if (result.errorCode) respond.fail(result.errorCode);

  respond.done('decided');
}
