import type { CredibilityEntry, SuggestionType } from '../models';

export const BASE_POINTS: Record<SuggestionType, number> = {
  correction: 10,
  context: 7,
  translation: 7,
  clarity: 4,
  headline: 3,
  copyedit: 1,
};

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 365;

export function diversityMultiplier(distinctAuthors: number): number {
  if (distinctAuthors <= 1) return 0.3;
  return Math.min(1.5, 0.3 + 0.12 * (distinctAuthors - 1));
}

export function standingMultiplier(standing: number): number {
  const s = Math.min(1, Math.max(0, standing));
  return 0.5 + 0.7 * s;
}

export function decayFactor(ageMs: number): number {
  if (ageMs <= 0) return 1;
  return Math.pow(0.5, ageMs / (HALF_LIFE_DAYS * DAY_MS));
}

export function computeScore(entries: CredibilityEntry[], nowMs: number): number {
  const counted = entries.filter((e) => !e.selfEdit);
  const distinct = new Set(counted.map((e) => e.authorKey)).size;
  const diversity = diversityMultiplier(distinct);
  let score = 0;
  for (const e of counted) {
    score +=
      BASE_POINTS[e.type] *
      standingMultiplier(e.authorStanding) *
      decayFactor(nowMs - e.acceptedAtMs);
  }
  return score * diversity;
}

export type EditorLevel =
  | 'reader'
  | 'contributor'
  | 'copyeditor'
  | 'trusted_editor'
  | 'section_editor';

export interface EditorStats {
  weightedScore: number;
  acceptedTotal: number;
  acceptedCopyedits: number;
  distinctAuthors: number;
  acceptanceRate: number;
  decidedSampleSize: number;
  sanctionsInLast90d: number;
  topicScore: number;
  endorsements: number;
  identityVerified: boolean;
  /**
   * Pair-concentration: the largest single-author share of this editor's merged
   * suggestions (0..1). Anti-Sybil gate input. 0 when nothing has merged yet.
   */
  maxPairShare: number;
  /**
   * Account age in milliseconds at evaluation time (plan 48 WP8 Sybil
   * defences), or null when the caller has no age signal. Null never
   * downgrades: a caller that cannot prove an account is new must not be able
   * to silently re-gate every editor. The server aggregates always supply it.
   */
  accountAgeMs?: number | null;
  /**
   * Journalist verification state, or null when unknown. Drives
   * `identityVerified` at the mapping boundary and the standing weight.
   */
  verification?: VerificationState | null;
  /**
   * Coordinated-endorsement-ring suspicion for this profile (0..1) from
   * engines/rings.ts. Absent means no ring analysis was supplied.
   */
  ringSuspicion?: number;
}

/**
 * Journalist verification lifecycle states (plan 48 WP8 verification center).
 * Structural twin of the nw_journalist_verifications status CHECK and of
 * VERIFICATION_STATES in models.ts; kept as a local union so this engine stays
 * import-light and the Deno twin can mirror it without a models dependency.
 */
export type VerificationState =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired';

const DAY = 86_400_000;

/**
 * Minimum account age before an editor may hold an elevated trust tier. Profile
 * creation is free and anonymous sign-in is on, so age is one of the few
 * costly-to-fake signals available. Two weeks is short enough not to punish a
 * genuine new contributor (who still reaches `copyeditor`) and long enough that
 * a burst of same-day sockpuppets cannot reach `trusted_editor`.
 */
export const TRUST_MIN_ACCOUNT_AGE_MS = 14 * DAY;

/** Section editors carry the widest cap, so they need a longer track record. */
export const SECTION_EDITOR_MIN_ACCOUNT_AGE_MS = 90 * DAY;

/**
 * Ring suspicion at or above which elevated trust is withheld pending human
 * review. Mirrors DEFAULT_RING_CONFIG.flagAt: anything the ring detector would
 * flag for a moderator must not simultaneously earn a wider cap.
 */
export const TRUST_RING_SUSPICION_MAX = 0.6;

/**
 * Age weighting for standing, 0.5 at creation rising to 1 at 90 days. Applied
 * multiplicatively to a standing value, so a brand-new "verified" account
 * cannot immediately hand out full-weight credibility. A null age is treated as
 * mature for the same reason null does not downgrade in `levelFor`: the caller
 * has no signal, and inventing one would be worse than not applying it.
 */
export function accountAgeMultiplier(accountAgeMs: number | null | undefined): number {
  if (accountAgeMs === null || accountAgeMs === undefined) return 1;
  if (accountAgeMs <= 0) return 0.5;
  const ramp = Math.min(1, accountAgeMs / SECTION_EDITOR_MIN_ACCOUNT_AGE_MS);
  return 0.5 + 0.5 * ramp;
}

/**
 * Standing weight per verification state. Only an approved, unexpired,
 * unrevoked verification earns the elevated weight; every terminal negative
 * state falls back to the unverified baseline rather than a penalty, because a
 * denied verification request is not evidence of bad faith.
 */
export function verificationWeight(state: VerificationState | null | undefined): number {
  switch (state) {
    case 'approved':
      return 0.75;
    case 'pending':
      return 0.55;
    case 'none':
    case 'rejected':
    case 'revoked':
    case 'expired':
    case null:
    case undefined:
    default:
      return 0.5;
  }
}

/** True only for a live, approved verification. */
export function isVerifiedState(state: VerificationState | null | undefined): boolean {
  return state === 'approved';
}

/**
 * Anti-Sybil gate: an editor whose merged suggestions are this concentrated on a
 * single author cannot reach the elevated-trust tiers (trusted_editor and above),
 * regardless of weighted score or distinctAuthors. anonymous_sign_ins is on and
 * profile creation is free, so a collusion ring of sockpuppet author accounts
 * cross-accepting one target's suggestions can otherwise farm distinctAuthors and
 * weighted score up to trusted_editor. A legitimate editor earns credibility
 * across many independent authors, so their share of any single author stays well
 * under half. 0.5 means "no single author may account for a majority of an
 * editor's merges" before that editor holds an elevated open-suggestion cap.
 * Distinct from the app UI's PAIR_ELEVATED_THRESHOLD (0.7), which is a display-only
 * "healthy/elevated" badge, not a trust gate. Anonymous-account down-weighting is
 * not applied because the current aggregate has no identity/anonymity signal.
 */
export const TRUST_PAIR_CONCENTRATION_MAX = 0.5;

export function levelFor(s: EditorStats): EditorLevel {
  const concentrationOk = s.maxPairShare <= TRUST_PAIR_CONCENTRATION_MAX;
  // Plan 48 WP8 Sybil gates. Both fail inert when the signal is absent so a
  // caller without the input cannot silently re-gate every editor, and both are
  // hard gates when the signal IS present: a fresh account or a profile the ring
  // detector would flag does not hold an elevated cap.
  const ageOk = s.accountAgeMs == null || s.accountAgeMs >= TRUST_MIN_ACCOUNT_AGE_MS;
  const ringOk = (s.ringSuspicion ?? 0) < TRUST_RING_SUSPICION_MAX;
  const trusted =
    concentrationOk &&
    ageOk &&
    ringOk &&
    s.weightedScore >= 150 &&
    s.distinctAuthors >= 10 &&
    s.sanctionsInLast90d === 0;
  const sectionAgeOk =
    s.accountAgeMs == null || s.accountAgeMs >= SECTION_EDITOR_MIN_ACCOUNT_AGE_MS;
  if (
    trusted &&
    sectionAgeOk &&
    s.topicScore >= 500 &&
    s.endorsements >= 3 &&
    s.identityVerified
  ) {
    return 'section_editor';
  }
  if (trusted) return 'trusted_editor';
  if (s.acceptedCopyedits >= 25 && s.acceptanceRate >= 0.6 && s.distinctAuthors >= 5) {
    return 'copyeditor';
  }
  if (s.acceptedTotal >= 1) return 'contributor';
  return 'reader';
}

/**
 * C7 interim author standing: 0.5 baseline, 0.75 when the accepting author's
 * journalist tier is 'verified'. The review function applies this per award;
 * the aggregates RPC keeps the 0.5 baseline because it has no accuracy track
 * record input.
 */
export function authorStandingForTier(tier: 'open' | 'verified'): number {
  return tier === 'verified' ? 0.75 : 0.5;
}

/**
 * Plan 48 WP8 standing: the verification-state weight scaled by account age.
 * Supersedes `authorStandingForTier` where the caller has the richer inputs;
 * `authorStandingForTier` stays exported and unchanged because the journalist
 * tier column is still what several read paths carry.
 *
 * The two agree by construction when the account is mature: an approved
 * verification is 0.75 and everything else is 0.5, exactly the tier mapping.
 */
export function authorStandingFor(input: {
  verification?: VerificationState | null;
  accountAgeMs?: number | null;
  /** Fallback when no verification record exists but the tier column says verified. */
  tier?: 'open' | 'verified';
}): number {
  const fromVerification =
    input.verification === undefined || input.verification === null
      ? authorStandingForTier(input.tier ?? 'open')
      : verificationWeight(input.verification);
  return Math.min(1, Math.max(0, fromVerification * accountAgeMultiplier(input.accountAgeMs)));
}

const LEVEL_CAPS: Record<EditorLevel, number> = {
  reader: 5,
  contributor: 8,
  copyeditor: 12,
  trusted_editor: 20,
  section_editor: 30,
};

export function openSuggestionCap(s: EditorStats): number {
  if (s.decidedSampleSize >= 30 && s.acceptanceRate < 0.2) return 3;
  return LEVEL_CAPS[levelFor(s)];
}

/** Structural shape of a public credibility ledger row (server twin: CredibilityLedgerRow). */
export interface LedgerRowLike {
  basePoints: number;
  standingMult: number;
  awardedAt: string;
}

/**
 * Weighted score from public ledger rows: the decayed award sum (base points
 * times the standing multiplier stored at award time) times the
 * acceptance-diversity multiplier from aggregates v2. Same math as
 * computeScore over an equivalent entry list. Twin: _shared/mynews-cred.ts.
 */
export function ledgerWeightedScore(
  rows: LedgerRowLike[],
  distinctAuthors: number,
  nowMs: number,
): number {
  return (
    diversityMultiplier(distinctAuthors) *
    rows.reduce(
      (sum, row) =>
        sum + row.basePoints * row.standingMult * decayFactor(nowMs - Date.parse(row.awardedAt)),
      0,
    )
  );
}

/** Structural shape of the aggregates v2 raw stats (server twin: EditorAggregates). */
export interface EditorAggregatesLike {
  acceptedTotal: number;
  acceptedCopyedits: number;
  distinctAuthors: number;
  acceptanceRate: number;
  decidedSampleSize: number;
  sanctionsInLast90d: number;
  /**
   * Largest single-author share of merged suggestions (0..1). Optional so the
   * app-side view builders (which reconstruct stats from the public ledger and
   * gate concentration in the UI layer) keep compiling; absent means 0, the
   * fail-open default that leaves the trust gate inert only when the caller has
   * not supplied the signal.
   */
  maxPairShare?: number;
  /**
   * Account age in milliseconds (plan 48 WP8). Optional for the same reason as
   * maxPairShare: app-side reconstructions from the public ledger have no age
   * signal, and absent means "do not gate on age" rather than "treat as new".
   */
  accountAgeMs?: number | null;
  /** Journalist verification state, when the caller has it. */
  verification?: VerificationState | null;
  /** Ring-detector suspicion for this profile, 0..1. */
  ringSuspicion?: number;
  /** Endorsements received, when the caller has it. */
  endorsementsReceived?: number;
}

/**
 * Mapping from aggregates raw stats to EditorStats. topicScore stays zeroed
 * because no aggregate provides it. `identityVerified` and `endorsements` are
 * now real when the caller supplies them (plan 48 WP8 verification center), so
 * section_editor is reachable only for an approved-verified, long-lived,
 * endorsed editor. Age, verification, and ring suspicion thread the WP8 Sybil
 * gates into levelFor. Twin: _shared/mynews-cred.ts.
 */
export function editorStatsFromAggregates(
  agg: EditorAggregatesLike,
  weightedScore: number,
): EditorStats {
  return {
    weightedScore,
    acceptedTotal: agg.acceptedTotal,
    acceptedCopyedits: agg.acceptedCopyedits,
    distinctAuthors: agg.distinctAuthors,
    acceptanceRate: agg.acceptanceRate,
    decidedSampleSize: agg.decidedSampleSize,
    sanctionsInLast90d: agg.sanctionsInLast90d,
    topicScore: 0,
    endorsements: agg.endorsementsReceived ?? 0,
    identityVerified: isVerifiedState(agg.verification),
    maxPairShare: agg.maxPairShare ?? 0,
    accountAgeMs: agg.accountAgeMs ?? null,
    verification: agg.verification ?? null,
    ringSuspicion: agg.ringSuspicion ?? 0,
  };
}
