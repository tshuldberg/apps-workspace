/**
 * Typed results for the console integrity RPCs (plan 48 WP9). Pure: the RPCs
 * return a jsonb envelope and this turns it into a discriminated union.
 *
 * Fail closed. An envelope this module does not recognise is a FAILURE, never a
 * silent success, because the alternative is a moderator being told an
 * enforcement landed when nothing happened.
 */

export interface ConsoleSuccess {
  ok: true;
  code: string;
  pendingId: string | null;
  outcome: string | null;
  reversal: string | null;
}

export interface ConsoleFailure {
  ok: false;
  code: string;
  /** Present on 'stale-action': the version the row actually holds now. */
  currentVersion: number | null;
  /** Present on 'replayed': the outcome the first submission produced. */
  original: unknown;
  /** True when the RPC rolled back a partially applied multi-step action. */
  rolledBack: boolean;
}

export type ConsoleResult = ConsoleSuccess | ConsoleFailure;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function failure(code: string, extra: Partial<ConsoleFailure> = {}): ConsoleFailure {
  return {
    ok: false,
    code,
    currentVersion: extra.currentVersion ?? null,
    original: extra.original ?? null,
    rolledBack: extra.rolledBack ?? false,
  };
}

/**
 * Map a raw RPC envelope. `ok: true` with a code is the only shape that reads as
 * success; a missing code, a non-object, or a thrown PostgREST error all become
 * 'rpc_failed'.
 */
export function mapConsoleResult(value: unknown): ConsoleResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failure('rpc_failed');
  const envelope = value as Record<string, unknown>;
  const code = str(envelope.code);
  if (envelope.ok === true && code) {
    return {
      ok: true,
      code,
      pendingId: str(envelope.pendingId),
      outcome: str(envelope.outcome),
      reversal: str(envelope.reversal),
    };
  }
  if (envelope.ok === false) {
    const version = envelope.currentVersion;
    return failure(code ?? 'rpc_failed', {
      currentVersion: typeof version === 'number' && Number.isFinite(version) ? version : null,
      original: envelope.original ?? null,
      rolledBack: envelope.rolledBack === true,
    });
  }
  return failure('rpc_failed');
}

/** Machine code for a redirect query string: hyphens become underscores. */
export function resultCode(result: ConsoleResult): string {
  return result.code.replace(/-/g, '_');
}

/**
 * Operator-facing copy for the codes the integrity RPCs return. Codes that are
 * not enforcement failures (a replay, a pending approval) still read as something
 * happened or deliberately did not, never as an unexplained error.
 */
export const CONSOLE_RESULT_COPY: Record<string, string> = {
  // report queue outcomes
  article_hidden: 'Article retracted and its report cleared.',
  suggestion_hidden: 'Suggestion hidden and its report cleared.',
  profile_suspended: 'Profile suspended and its report cleared.',
  report_dismissed: 'Report dismissed with no action, and the reason recorded.',
  author_struck: 'Article retracted and a copyright strike recorded against the author.',
  author_suspended_repeat:
    'Article retracted, copyright strike recorded, and the author suspended as a repeat infringer.',
  // urgent queue outcomes
  removed: 'Target confirmed removed; the case is held for review.',
  escalated: 'Escalated for urgent human attention.',
  cleared: 'Case cleared: the takedown was lifted after human review.',
  // screening outcomes
  ok: 'Done.',
  screening_approved: 'Released. The author can publish these exact bytes now.',
  screening_approved_stale:
    'Approved, and the author holds an allowance. The article head moved while this was queued, so the held revision could not be released in place; the author can resubmit it.',
  screening_rejected: 'Kept non-public. The author sees the reason and can appeal once.',
  // appeals (both sources)
  appeal_granted: 'Appeal granted and the original action reversed.',
  appeal_granted_stale:
    'Appeal granted. The article head moved while this was queued, so the author needs to resubmit.',
  appeal_denied: 'Appeal denied. The original action stands and the appellant sees the reason.',
  // verification
  verification_approved: 'Verified. The badge and the journalist tier moved with the record.',
  verification_denied: 'Denied. The reason is visible to the requester; the tier is unchanged.',
  verification_revoked: 'Revoked. The badge and the tier came down together.',
  // dual control
  pending_approved: 'Approved and applied in one transaction.',
  pending_rejected: 'Proposal rejected. Nothing was applied.',
  cancelled: 'Proposal withdrawn.',
  expired_none: 'Nothing was past its expiry.',
  // assignment
  assigned: 'Assignment updated.',
  // roles
  granted: 'Role granted.',
  revoked: 'Role revoked. That address can still sign in but can run nothing.',
  bootstrapped: 'First admin created. Bootstrap is now closed.',
  // DMCA workflow outcomes
  noted: 'Communication note appended to the immutable log.',
  acknowledged: 'Submission acknowledged and audited.',
  forwarded: 'Forwarding record saved.',
  forwarded_to_claimant: 'Counter-notice forwarding to the claimant was recorded.',
  resolved: 'The URL now resolves and the target linkage was committed.',
  still_needs_resolution: 'The retry was audited, but the URL still needs manual resolution.',
  strike_linked: 'Strike audit linkage saved.',
  closed: 'Submission closed with an audited disposition.',
  original_linked: 'Original takedown notice linked.',
  original_unlinked: 'Original takedown notice unlinked.',
  waiting_period: 'The 10 to 14 business-day waiting period started.',
  restored: 'Content restoration and its audit records committed together.',
  litigation_hold: 'Litigation hold recorded. Restoration is blocked.',
  // refusals
  no_role: 'You do not have a moderator role. An admin has to grant one.',
  insufficient_role: 'Your role is not high enough for that action.',
  bad_reason: 'That action needs a reason (up to 2000 characters).',
  bad_token: 'The form was missing its submission token. Reload and try again.',
  bad_action: 'That action is not one the console can run.',
  bad_input: 'Some of that input was not valid.',
  confirm_required: 'Tick the confirmation box first.',
  expiry_required: 'An approval needs an expiry date.',
  bad_suspension: 'That suspension length was not valid.',
  same_moderator: 'You cannot rule on an appeal against your own decision.',
  self_approval: 'You cannot approve your own proposal. A second moderator has to.',
  not_proposer: 'Only the moderator who proposed this can withdraw it.',
  // conflicts
  stale_action: 'Someone changed this while you had it open. Reload to see the current state.',
  replayed: 'That action was already applied. Nothing was done twice.',
  already_decided: 'This was already decided.',
  already_cleared: 'This case is already cleared.',
  not_open: 'This report is no longer open.',
  not_pending: 'This is no longer pending.',
  no_appeal: 'There is no appeal waiting on this.',
  expired: 'That proposal expired before anyone approved it.',
  // outcomes that need explaining
  pending_approval: 'Proposed. A second moderator has to approve it before it takes effect.',
  // failures
  not_found: 'That record no longer exists.',
  wrong_target_kind: 'That action does not apply to this kind of target.',
  no_payout_account: 'That journalist has no payout account to change.',
  not_blocked: 'That payout account is not blocked.',
  nothing_to_block: 'That journalist has no payout onboarding to block.',
  no_executor: 'That proposal kind has no executor, so nothing was applied.',
  reversal_failed: 'The reversal failed and was rolled back. Nothing changed.',
  // DMCA workflow refusals
  bad_transition: 'That action is not valid from the current workflow state.',
  original_required: 'Link an original takedown notice before forwarding.',
  bad_original: 'The original notice reference did not match a takedown notice.',
  waiting_period_active: 'The 10-business-day minimum has not elapsed.',
  disposition_required: 'A disposition note is required.',
  email_required: 'A forwarding email is required.',
  bad_target: 'The linked content target cannot be restored.',
  bad_strike: 'The strike action ID does not identify a copyright strike audit row.',
  note_required: 'This action requires an audit note.',
  note_required_db: 'This action requires an audit note.',
  bad_notice_kind: 'That notice kind is not one the workflow knows.',
  rpc_failed: 'The database refused that action. Nothing changed.',
  admin_exists: 'An admin already exists, so bootstrap is closed.',
  last_admin: 'That would leave no active admin.',
  not_admin: 'Only an admin can change roles.',
  bad_role: 'That is not a role the console knows.',
  bad_ref: 'That moderator address was not valid.',
  bad_level: 'That escalation level was not valid.',
  assigned_elsewhere: 'Another moderator holds this item. A senior can reassign it.',
  assignee_no_role: 'That person does not have an active moderator role.',
};

/**
 * Copy for a code the RPC reported as a FAILURE. An unnamed code still says
 * plainly that nothing completed, rather than falling back to reassuring text.
 */
export function describeResult(code: string): string {
  return CONSOLE_RESULT_COPY[code] ?? `The action did not complete (${code}).`;
}

/**
 * Copy for a code the RPC reported as SUCCESS. Some successes are parameterised
 * counts (`expired_4`, `rings_2`) so those are described from their shape rather
 * than needing a map entry each.
 */
export function describeSuccess(code: string): string {
  const named = CONSOLE_RESULT_COPY[code];
  if (named) return named;
  const counted = /^(expired|rings)_(\d+)$/.exec(code);
  if (counted) {
    const [, kind, count] = counted;
    return kind === 'expired'
      ? `Expired ${count} lapsed record${count === '1' ? '' : 's'}. Any badges they carried are down.`
      : `Endorsement graph recomputed. ${count} profile${
          count === '1' ? '' : 's'
        } flagged; a flagged profile does not hold elevated trust until a person clears it.`;
  }
  return `Done (${code}).`;
}
