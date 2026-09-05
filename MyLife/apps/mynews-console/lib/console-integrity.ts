import 'server-only';

import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { type ConsoleResult, failure, mapConsoleResult } from './console-result';

/**
 * Service-role calls into the console integrity RPCs (migration
 * 20260730000010, plan 48 WP9).
 *
 * Each of these wraps ONE transactional RPC that does the whole multi-step
 * action: role check, reason check, replay-token claim, version check,
 * dual-control interception, enforcement, and hash-chained audit. Nothing in this
 * file decides policy; it passes the moderator's identity and the version token
 * the page rendered, and translates the envelope.
 *
 * A PostgREST error is 'rpc_failed', never a success.
 */

async function callEnvelope(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<ConsoleResult> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    console.error(`mynews-console: ${name} failed: ${error.message}`);
    return failure('rpc_failed');
  }
  return mapConsoleResult(data);
}

/**
 * Per-submission idempotency token. Generated when a form is RENDERED, so the
 * same token rides every resubmission of that form (double click, back button,
 * refresh-repost) and the RPC recognises the second one as a replay.
 */
export function newActionToken(): string {
  return randomUUID();
}

export type ReportEnforcementAction =
  | 'hide_article'
  | 'hide_suggestion'
  | 'suspend_profile'
  | 'strike_author'
  | 'dismiss';

export function enforceReport(
  admin: SupabaseClient,
  input: {
    reportId: string;
    expectedVersion: number;
    actorRef: string;
    action: ReportEnforcementAction;
    reason: string;
    actionToken: string;
    params?: Record<string, unknown>;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_enforce_report', {
    p_report_id: input.reportId,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_action: input.action,
    p_reason: input.reason,
    p_action_token: input.actionToken,
    p_params: input.params ?? {},
  });
}

export function enforceNcii(
  admin: SupabaseClient,
  input: {
    caseId: string;
    expectedVersion: number;
    actorRef: string;
    action: 'ensure_removed' | 'escalate' | 'clear';
    reason: string;
    actionToken: string;
    confirm?: boolean;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_enforce_ncii', {
    p_case_id: input.caseId,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_action: input.action,
    p_reason: input.reason,
    p_action_token: input.actionToken,
    p_confirm: input.confirm ?? false,
  });
}

export function enforceDmca(
  admin: SupabaseClient,
  input: {
    noticeId: string;
    noticeKind: 'takedown' | 'counter';
    expectedVersion: number;
    actorRef: string;
    action: string;
    reason: string;
    actionToken: string;
    value?: string | null;
    confirm?: boolean;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_enforce_dmca', {
    p_notice_id: input.noticeId,
    p_notice_kind: input.noticeKind,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_action: input.action,
    p_reason: input.reason,
    p_action_token: input.actionToken,
    p_value: input.value ?? null,
    p_confirm: input.confirm ?? false,
  });
}

export function enforceScreening(
  admin: SupabaseClient,
  input: {
    decisionId: string;
    expectedVersion: number;
    actorRef: string;
    action: 'approve' | 'reject' | 'appeal_grant' | 'appeal_deny';
    reason: string;
    actionToken: string;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_enforce_screening', {
    p_decision_id: input.decisionId,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_action: input.action,
    p_reason: input.reason,
    p_action_token: input.actionToken,
  });
}

export function enforceVerification(
  admin: SupabaseClient,
  input: {
    verificationId: string;
    expectedVersion: number;
    actorRef: string;
    action: 'approve' | 'deny' | 'revoke';
    reason: string;
    actionToken: string;
    expiresAt?: string | null;
    confirm?: boolean;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_enforce_verification', {
    p_verification_id: input.verificationId,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_action: input.action,
    p_reason: input.reason,
    p_action_token: input.actionToken,
    p_expires_at: input.expiresAt ?? null,
    p_confirm: input.confirm ?? false,
  });
}

/* ------------------------------- appeals ---------------------------------- */

export function disposeModerationAppeal(
  admin: SupabaseClient,
  input: {
    appealId: string;
    expectedVersion: number;
    actorRef: string;
    grant: boolean;
    reason: string;
    actionToken: string;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_dispose_moderation_appeal', {
    p_appeal_id: input.appealId,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_grant: input.grant,
    p_reason: input.reason,
    p_action_token: input.actionToken,
  });
}

/* ---------------------------- dual control -------------------------------- */

export function decidePendingAction(
  admin: SupabaseClient,
  input: {
    pendingId: string;
    actorRef: string;
    approve: boolean;
    reason: string;
    actionToken: string;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_decide_pending_action', {
    p_pending_id: input.pendingId,
    p_actor_ref: input.actorRef,
    p_approve: input.approve,
    p_reason: input.reason,
    p_action_token: input.actionToken,
  });
}

export function cancelPendingAction(
  admin: SupabaseClient,
  input: { pendingId: string; actorRef: string; reason: string; actionToken: string },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_cancel_pending_action', {
    p_pending_id: input.pendingId,
    p_actor_ref: input.actorRef,
    p_reason: input.reason,
    p_action_token: input.actionToken,
  });
}

export function proposePayoutAction(
  admin: SupabaseClient,
  input: {
    journalistProfileId: string;
    expectedVersion: number;
    actorRef: string;
    block: boolean;
    reason: string;
    actionToken: string;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_propose_payout_action', {
    p_journalist_profile_id: input.journalistProfileId,
    p_expected_version: input.expectedVersion,
    p_actor_ref: input.actorRef,
    p_block: input.block,
    p_reason: input.reason,
    p_action_token: input.actionToken,
  });
}

export async function expirePendingActions(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc('nw_console_expire_pending_actions');
  if (error) {
    console.error(`mynews-console: nw_console_expire_pending_actions failed: ${error.message}`);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}

/* --------------------------- assignment + escalation ---------------------- */

export type ConsoleQueue =
  | 'report'
  | 'ncii'
  | 'dmca'
  | 'screening'
  | 'verification'
  | 'appeal'
  | 'pending_action';

export function assignQueueItem(
  admin: SupabaseClient,
  input: {
    actorRef: string;
    queue: ConsoleQueue;
    itemId: string;
    assigneeRef: string | null;
    actionToken: string;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_assign', {
    p_actor_ref: input.actorRef,
    p_queue: input.queue,
    p_item_id: input.itemId,
    p_assignee_ref: input.assigneeRef,
    p_action_token: input.actionToken,
  });
}

export function escalateQueueItem(
  admin: SupabaseClient,
  input: {
    actorRef: string;
    queue: ConsoleQueue;
    itemId: string;
    level: 'none' | 'senior' | 'admin';
    reason: string;
    actionToken: string;
  },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_console_escalate', {
    p_actor_ref: input.actorRef,
    p_queue: input.queue,
    p_item_id: input.itemId,
    p_level: input.level,
    p_reason: input.reason,
    p_action_token: input.actionToken,
  });
}

/* --------------------------------- roles ---------------------------------- */

export function grantModeratorRole(
  admin: SupabaseClient,
  input: { actorRef: string; targetRef: string; role: string; note: string },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_moderator_role_grant', {
    p_actor_ref: input.actorRef,
    p_target_ref: input.targetRef,
    p_role: input.role,
    p_note: input.note,
  });
}

export function revokeModeratorRole(
  admin: SupabaseClient,
  input: { actorRef: string; targetRef: string; note: string },
): Promise<ConsoleResult> {
  return callEnvelope(admin, 'nw_moderator_role_revoke', {
    p_actor_ref: input.actorRef,
    p_target_ref: input.targetRef,
    p_note: input.note,
  });
}
