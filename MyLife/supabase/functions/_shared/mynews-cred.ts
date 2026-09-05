// Twin of the credibility engine in modules/mynews/src/engines/credibility.ts.
// Parity-asserted by mynews-review/__tests__/cred-parity.test.ts (runs in the
// monorepo where both sides are importable; the deployed function never
// imports the module). Deno-compatible: no Node imports. Server-side award
// rows store the multipliers used.

export const BASE_POINTS: Record<string, number> = {
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

/** Structural twin of the module's CredibilityEntry (Zod-inferred there). */
export interface CredibilityEntry {
  type: string;
  acceptedAtMs: number;
  authorKey: string;
  authorStanding: number;
  selfEdit?: boolean;
}

export function computeScore(entries: CredibilityEntry[], nowMs: number): number {
  const counted = entries.filter((e) => !e.selfEdit);
  const distinct = new Set(counted.map((e) => e.authorKey)).size;
  const diversity = diversityMultiplier(distinct);
  let score = 0;
  for (const e of counted) {
    score +=
      (BASE_POINTS[e.type] ?? 0) *
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
   * downgrades. The server aggregates always supply it.
   */
  accountAgeMs?: number | null;
  /** Journalist verification state, or null when unknown. */
  verification?: VerificationState | null;
  /** Coordinated-endorsement-ring suspicion for this profile (0..1). */
  ringSuspicion?: number;
}

/** Twin of the module engine's VerificationState union. */
export type VerificationState =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired';

const DAY = 86_400_000;

/** Minimum account age before an editor may hold an elevated trust tier. */
export const TRUST_MIN_ACCOUNT_AGE_MS = 14 * DAY;

/** Section editors carry the widest cap, so they need a longer track record. */
export const SECTION_EDITOR_MIN_ACCOUNT_AGE_MS = 90 * DAY;

/** Ring suspicion at or above which elevated trust is withheld. */
export const TRUST_RING_SUSPICION_MAX = 0.6;

/** Age weighting for standing, 0.5 at creation rising to 1 at 90 days. */
export function accountAgeMultiplier(accountAgeMs: number | null | undefined): number {
  if (accountAgeMs === null || accountAgeMs === undefined) return 1;
  if (accountAgeMs <= 0) return 0.5;
  const ramp = Math.min(1, accountAgeMs / SECTION_EDITOR_MIN_ACCOUNT_AGE_MS);
  return 0.5 + 0.5 * ramp;
}

/** Standing weight per verification state. */
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
 * "healthy/elevated" badge, not a trust gate. Account age, verification state, and
 * ring suspicion are separate WP8 gates layered on top of this one.
 */
export const TRUST_PAIR_CONCENTRATION_MAX = 0.5;

export function levelFor(s: EditorStats): EditorLevel {
  const concentrationOk = s.maxPairShare <= TRUST_PAIR_CONCENTRATION_MAX;
  // Plan 48 WP8 Sybil gates. Both fail inert when the signal is absent and are
  // hard gates when it is present.
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

export const LEVEL_CAPS: Record<EditorLevel, number> = {
  reader: 5,
  contributor: 8,
  copyeditor: 12,
  trusted_editor: 20,
  section_editor: 30,
};

/**
 * C7 interim author standing: 0.5 baseline, 0.75 when the accepting author's
 * journalist tier is 'verified'. The review function applies this per award;
 * the aggregates RPC's authorStanding stays the 0.5 baseline. Full
 * accuracy-based standing arrives with the Phase 3 track-record
 * materialization.
 */
export function authorStandingForTier(tier: 'open' | 'verified'): number {
  return tier === 'verified' ? 0.75 : 0.5;
}

/**
 * Plan 48 WP8 standing: verification-state weight scaled by account age.
 * Supersedes authorStandingForTier where the caller has the richer inputs.
 */
export function authorStandingFor(input: {
  verification?: VerificationState | null;
  accountAgeMs?: number | null;
  tier?: 'open' | 'verified';
}): number {
  const fromVerification =
    input.verification === undefined || input.verification === null
      ? authorStandingForTier(input.tier ?? 'open')
      : verificationWeight(input.verification);
  return Math.min(1, Math.max(0, fromVerification * accountAgeMultiplier(input.accountAgeMs)));
}

export interface CapInputs {
  openCount: number;
  acceptanceRate: number;
  decidedSampleSize: number;
  /** Computed as LEVEL_CAPS[levelFor(stats)]; the P1 5/8 floor is retired. */
  levelCap: number;
}

/** Low-acceptance throttle twin: 3 when rate < 0.2 over a 30+ sample. */
export function effectiveCap(inputs: CapInputs): number {
  if (inputs.decidedSampleSize >= 30 && inputs.acceptanceRate < 0.2) return 3;
  return inputs.levelCap;
}

/**
 * Throttle floor: the smallest cap effectiveCap can return is 3 (the reader
 * level floor is 5). Editors with fewer open suggestions than this can never
 * trip the cap check, so callers skip the ledger fetch and level math
 * entirely below it.
 */
export const MIN_POSSIBLE_CAP = 3;

/**
 * Weighted score from public ledger rows: the decayed award sum (base points
 * times the standing multiplier stored at award time) times the
 * acceptance-diversity multiplier from aggregates v2. Same math as
 * computeScore over an equivalent entry list; twinned by the module engine's
 * ledgerWeightedScore.
 */
export function ledgerWeightedScore(
  rows: Array<{ basePoints: number; standingMult: number; awardedAt: string }>,
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

/** Structural twin of the store's EditorAggregates (kept import-free on purpose). */
export interface AggregatesV2Stats {
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
   * not supplied the signal. The server store always supplies it.
   */
  maxPairShare?: number;
  /** Account age in milliseconds (plan 48 WP8). Absent means do not gate on age. */
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
 * because no aggregate provides it. identityVerified and endorsements are real
 * when supplied (plan 48 WP8 verification center). Twinned by the module
 * engine's editorStatsFromAggregates.
 */
export function editorStatsFromAggregates(
  agg: AggregatesV2Stats,
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
