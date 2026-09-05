/**
 * Pure decision-composition logic for the moderator console.
 *
 * The backend contract (modules/bestchef/src/cloud/schema.sql):
 * - bc_apply_moderation_decision(kind, target_id, decision, reason, metadata)
 *   accepts kinds submission|comment|profile|media_asset|product_contribution|
 *   product_evidence|vote_proof ('photo' is aliased to media_asset server-side)
 *   and decisions approved|rejected|hidden|removed|restored|dismissed.
 * - bc_resolve_appeal records the outcome + statement of reasons only;
 *   reversing the underlying content is a SEPARATE decision-RPC call that the
 *   console composes (handoff 2026-07-03).
 */

export const DECISION_KINDS = [
  'submission',
  'comment',
  'profile',
  'media_asset',
  'product_contribution',
  'product_evidence',
  'vote_proof',
] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

/** Decisions that require a DSA statement of reasons before submission. */
const NEGATIVE_DECISIONS = new Set(['rejected', 'hidden', 'removed']);

export function requiresStatementOfReasons(decision: string): boolean {
  return NEGATIVE_DECISIONS.has(decision);
}

/**
 * Map a bc_flags.target_type to the decision-RPC kind, or null when the
 * flagged object has no content decision path (the flag itself can still be
 * noted/dismissed). 'photo' is aliased to media_asset, matching the server's
 * own aliasing inside bc_apply_moderation_decision (no current writer files
 * photo-kind flags; photo reports live in bc_photo_reports).
 */
export function flagKindToDecisionKind(targetType: string): DecisionKind | null {
  switch (targetType) {
    case 'submission':
      return 'submission';
    case 'photo':
      return 'media_asset';
    case 'comment':
      return 'comment';
    case 'profile':
      return 'profile';
    case 'media_asset':
      return 'media_asset';
    case 'product_contribution':
      return 'product_contribution';
    case 'product_evidence':
      return 'product_evidence';
    case 'vote_proof':
      return 'vote_proof';
    default:
      // dish_proposal and unknown future kinds: flag-only handling.
      return null;
  }
}

export interface ReversalPlan {
  kind: DecisionKind;
  targetId: string;
  decision: 'approved' | 'restored';
}

/**
 * When an appeal is overturned, compute the decision-RPC call that reverses
 * the original enforcement. Returns null when there is nothing to reverse
 * (e.g. the original decision was already positive or merely dismissed).
 */
export function planAppealReversal(
  decisionKind: string,
  targetId: string,
  originalDecision: string,
): ReversalPlan | null {
  if (!(DECISION_KINDS as readonly string[]).includes(decisionKind)) return null;
  const kind = decisionKind as DecisionKind;
  if (kind === 'vote_proof') {
    // Vote proofs only accept approved|rejected.
    return originalDecision === 'rejected'
      ? { kind, targetId, decision: 'approved' }
      : null;
  }
  if (originalDecision === 'rejected' || originalDecision === 'hidden' || originalDecision === 'removed') {
    return { kind, targetId, decision: 'restored' };
  }
  return null;
}
