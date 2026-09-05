/**
 * Console RBAC policy (plan 48 WP9). Pure, so it is unit-testable and can be
 * imported from anywhere in the console.
 *
 * This is the TypeScript twin of nw_moderator_role_rank,
 * nw_console_action_min_level, and nw_pending_action_min_level in migration
 * 20260730000010. The SQL is authoritative: a role check that only exists here
 * could be bypassed by any other caller of the RPCs, which is why every RPC
 * re-checks. lib/__tests__/console-policy.test.ts pins the two together by
 * reading the migration, so a level changed in one place fails the build.
 */

export type ModeratorRole = 'admin' | 'senior' | 'reviewer';

export const ROLE_RANK: Record<ModeratorRole, number> = {
  admin: 3,
  senior: 2,
  reviewer: 1,
};

export const ROLE_LABEL: Record<ModeratorRole, string> = {
  admin: 'Admin',
  senior: 'Senior moderator',
  reviewer: 'Reviewer',
};

export function isModeratorRole(value: unknown): value is ModeratorRole {
  return value === 'admin' || value === 'senior' || value === 'reviewer';
}

/** 0 for anything that is not an active role, which refuses every action. */
export function roleRank(role: string | null | undefined): number {
  return isModeratorRole(role) ? ROLE_RANK[role] : 0;
}

export function hasLevel(role: string | null | undefined, minimum: ModeratorRole): boolean {
  return roleRank(role) >= ROLE_RANK[minimum];
}

export type RoleLookup = { status: 'unavailable' } | { status: 'ok'; role: ModeratorRole | null };

/**
 * Interpret a role read. Pure, so the distinction that matters is testable.
 *
 * A FAILED read is 'unavailable', not "no role". Both refuse every action, but
 * they are different facts: telling a moderator during a database outage that
 * their access was revoked is false, and it is the worst moment to be
 * misinformed. Anything that is not one of the three known roles reads as no
 * role, so a corrupted or renamed value cannot grant anything.
 */
export function readRoleLookup(value: unknown, failed: boolean): RoleLookup {
  if (failed) return { status: 'unavailable' };
  return { status: 'ok', role: isModeratorRole(value) ? value : null };
}

/**
 * Minimum role per console action. Keys are the audit action names the RPCs
 * record, so an audit row and a policy entry always name the same thing.
 */
export const ACTION_MIN_ROLE: Record<string, ModeratorRole> = {
  // reviewer: reversible, per-item content decisions
  hide_article: 'reviewer',
  hide_suggestion: 'reviewer',
  dismiss: 'reviewer',
  screening_approve: 'reviewer',
  screening_reject: 'reviewer',
  ncii_ensure_removed: 'reviewer',
  ncii_escalate: 'reviewer',
  verification_approve: 'reviewer',
  verification_deny: 'reviewer',
  dmca_assign: 'reviewer',
  dmca_add_note: 'reviewer',
  dmca_acknowledge: 'reviewer',
  dmca_forward: 'reviewer',
  dmca_resolve_url: 'reviewer',
  dmca_link_original: 'reviewer',
  dmca_unlink_original: 'reviewer',
  dmca_forward_to_claimant: 'reviewer',
  // senior: account-level enforcement, peer review, legal posture
  suspend_profile: 'senior',
  strike_author: 'senior',
  ncii_clear: 'senior',
  verification_revoke: 'senior',
  appeal_grant: 'senior',
  appeal_deny: 'senior',
  dmca_close: 'senior',
  dmca_link_strike: 'senior',
  dmca_litigation_hold: 'senior',
  dmca_start_waiting_period: 'senior',
  dmca_restore_content: 'senior',
  propose_pending: 'senior',
  // admin: who moderates, and money
  role_grant: 'admin',
  role_revoke: 'admin',
  payout_block: 'admin',
  payout_unblock: 'admin',
  audit_export: 'admin',
};

/**
 * An action nobody registered is admin-only. A new action that forgets a policy
 * entry becomes harder to run, never easier.
 */
export function actionMinRole(action: string): ModeratorRole {
  return ACTION_MIN_ROLE[action] ?? 'admin';
}

export function canRunAction(role: string | null | undefined, action: string): boolean {
  return hasLevel(role, actionMinRole(action));
}

/* ------------------------------- dual control ------------------------------ */

export type PendingActionKind =
  | 'suspend_long'
  | 'terminate_account'
  | 'restore_content'
  | 'payout_block'
  | 'payout_unblock';

export const PENDING_KINDS: readonly PendingActionKind[] = [
  'suspend_long',
  'terminate_account',
  'restore_content',
  'payout_block',
  'payout_unblock',
];

/** Role the SECOND moderator needs to approve each kind. */
export const PENDING_APPROVAL_MIN_ROLE: Record<PendingActionKind, ModeratorRole> = {
  suspend_long: 'senior',
  terminate_account: 'admin',
  restore_content: 'senior',
  payout_block: 'admin',
  payout_unblock: 'admin',
};

export const PENDING_KIND_LABEL: Record<PendingActionKind, string> = {
  suspend_long: 'Suspension over 7 days',
  terminate_account: 'Account termination (permanent suspension)',
  restore_content: 'Restore removed content',
  payout_block: 'Block payouts',
  payout_unblock: 'Unblock payouts',
};

export function isPendingActionKind(value: unknown): value is PendingActionKind {
  return typeof value === 'string' && (PENDING_KINDS as readonly string[]).includes(value);
}

export function canApprovePending(
  role: string | null | undefined,
  kind: PendingActionKind,
): boolean {
  return hasLevel(role, PENDING_APPROVAL_MIN_ROLE[kind]);
}

/**
 * Whether a proposer may approve a proposal. Always false: the second-moderator
 * rule is a table CHECK in SQL, and this exists so the UI never renders a button
 * the database will refuse.
 */
export function canApproveOwnProposal(): boolean {
  return false;
}

export const DUAL_CONTROL_SUSPENSION_DAYS = 7;

/**
 * Whether a suspension of this length needs a second moderator. Permanent always
 * does. The comparison is strictly greater than 7 days so the 7-day preset stays
 * a one-moderator action, matching the `v_days > 7` test in the SQL.
 */
export function suspensionNeedsDualControl(input: {
  permanent: boolean;
  untilIso?: string | null;
  nowMs: number;
}): boolean {
  if (input.permanent) return true;
  if (!input.untilIso) return false;
  const until = Date.parse(input.untilIso);
  if (!Number.isFinite(until)) return false;
  const days = (until - input.nowMs) / (24 * 60 * 60 * 1000);
  return days > DUAL_CONTROL_SUSPENSION_DAYS;
}
