// Narrow persistence port for the MyNews edge functions. Handlers depend on
// this interface only; production wires createPostgrestMyNewsStore (service
// role), tests wire createInMemoryMyNewsStore. The in-memory impl mirrors the
// SECURITY DEFINER RPC semantics (migrations 20260703000002/000003 and
// 20260712000001) exactly: validation before any write, SQL return-code
// priorities, atomic report escalation, and aggregates v2 computed with the SQL
// definitions.

import { EDGE_MYNEWS_BOUNDS } from './mynews-bounds.ts';

export interface ArticleHead {
  id: string;
  slug: string;
  kind: string;
  status: string;
  authorProfileId: string;
  authorPubkey: string;
  /** Author's journalist tier; 'open' when no nw_journalists row exists (C7). */
  authorTier: 'open' | 'verified';
  /** Newsroom scope for the draft-access gate; null on standalone articles. */
  newsroomId: string | null;
  currentRev: number;
}

export interface PublishRecord {
  article: {
    id: string;
    slug: string;
    kind: string;
    authorProfileId: string;
    /** C4: draft=true inserts status 'draft' with null published_at (newsroomId required). */
    draft?: boolean;
    newsroomId?: string | null;
  };
  revision: {
    articleId: string;
    rev: number;
    headline: string;
    dek?: string;
    bodyMd: string;
    changelogJson: string;
    createdAt: string;
    signature: string;
    signerPubkey: string;
  };
  publishedAtIso: string;
}

export interface SuggestionRecord {
  id: string;
  articleId: string;
  baseRev: number;
  editorProfileId: string;
  type: string;
  diffJson: string;
  citations: string[];
  rationale: string;
  signature: string;
  /**
   * The key that signed this suggestion (WP6). Recorded so the suggestion stays
   * offline re-verifiable after the editor rotates: without it a reader would
   * have to assume the editor's CURRENT profile key, which is wrong for every
   * suggestion filed before a rotation.
   *
   * Optional rather than required, deliberately. The column defaults to '' and
   * both the stamp trigger and the reader verifier degrade honestly on an empty
   * value ('chain-unrecorded', never a fabricated pass), so rows written before
   * migration 20260730000008 stay representable. The live write path always
   * populates it, and a test asserts the suggest handler does, rather than
   * leaning on the type to catch it.
   */
  signerPubkey?: string;
  createdAt: string;
}

export interface StoredSuggestion extends SuggestionRecord {
  /** 'quarantined' added by plan 48 WP8: held by pre-publication screening. */
  status: 'open' | 'accepted' | 'partial' | 'rejected' | 'stale' | 'quarantined';
}

/**
 * v2 raw stats, mirroring nw_editor_aggregates (migration 000003). Level and
 * cap math lives in the TS credibility twins: the functions compute the cap
 * via LEVEL_CAPS[levelFor(stats)] (C7); the P1 levelCap key is retired.
 */
export interface EditorAggregates {
  openCount: number;
  decidedSampleSize: number;
  acceptanceRate: number;
  acceptedTotal: number;
  acceptedCopyedits: number;
  distinctAuthors: number;
  endorsementsReceived: number;
  maxPairShare: number;
  sanctionsInLast90d: number;
  authorStanding: number;
}

export interface OpenSuggestionLite {
  id: string;
  editorProfileId: string;
  type: string;
  diffJson: string;
  baseRev: number;
}

export interface CredibilityLedgerRow {
  editorProfileId: string;
  suggestionId: string;
  basePoints: number;
  diversityMult: number;
  standingMult: number;
  awardedAt: string;
}

export interface SuggestionEventRecord {
  suggestionId: string;
  actorProfileId: string;
  action: string;
  payload: Record<string, unknown>;
  /**
   * Set on comment events (plan 48 WP4) so the durable per-profile comment
   * throttle can count a time window. Decision events written by the review
   * function leave it undefined; the throttle only ever counts comments.
   */
  createdAt?: string;
  /**
   * Screening hold state (plan 48 WP8). Absent means 'cleared'. A quarantined
   * or rejected comment event is excluded from every public read.
   */
  screeningStatus?: 'cleared' | 'quarantined' | 'rejected';
}

/** Outcome of the service-role comment insert (nw_insert_suggestion_comment). */
export type SuggestionCommentOutcome =
  | 'ok'
  | 'unknown-suggestion'
  | 'unknown-actor'
  | 'bad-payload';

export interface AwardInput {
  editorProfileId: string;
  basePoints: number;
  diversityMult: number;
  standingMult: number;
}

export interface AcceptRecord {
  suggestionId: string;
  decision: 'accept' | 'partial';
  actorProfileId: string;
  revision: PublishRecord['revision'];
  award: AwardInput;
}

export interface BatchAcceptRecord {
  suggestionIds: string[];
  actorProfileId: string;
  revision: PublishRecord['revision'];
  /** Keyed by suggestion id, mirroring the RPC's p_awards jsonb object. */
  awards: Record<string, AwardInput>;
}

export interface ArticleMetaRecord {
  articleId: string;
  doi: string | null;
  orcidAuthors: string[];
  license: string;
  rightsRoute: string;
  embargoUntil: string | null;
  datasetHashes: string[];
  canonicalUrl: string | null;
  signature: string;
  signerPubkey: string;
}

export type NewsroomRole = 'owner' | 'coauthor' | 'reviewer';

export type ReportTargetKind = 'article' | 'revision' | 'suggestion' | 'profile' | 'media';
export type ReportReason =
  | 'child-safety'
  | 'ncii'
  | 'threats'
  | 'violence'
  | 'self-harm'
  | 'hate'
  | 'harassment'
  | 'impersonation'
  | 'doxxing-privacy'
  | 'fraud-scam'
  | 'copyright'
  | 'spam'
  | 'other';

// Deno-compatible twin of REPORT_SEVERITY_RANK in
// modules/mynews/src/data/report.ts and nw_report_severity_rank, replaced in
// migration 20260730000009 (plan 48 WP8 taxonomy expansion). Keep the pinned
// module test and the SQL cases in sync.
const REPORT_SEVERITY_RANK: Readonly<Record<ReportReason, number>> = {
  'child-safety': 100,
  ncii: 100,
  threats: 80,
  violence: 80,
  'self-harm': 70,
  hate: 60,
  harassment: 60,
  impersonation: 60,
  'doxxing-privacy': 60,
  copyright: 40,
  'fraud-scam': 40,
  spam: 20,
  other: 20,
};

// Twin of REPORT_SLA_HOURS in modules/mynews/src/data/report.ts and the
// nw_report_sla seed in 20260730000009. Drift-pinned on both sides.
export const EDGE_REPORT_SLA_HOURS: Readonly<Record<ReportReason, number>> = {
  'child-safety': 24,
  ncii: 48,
  threats: 24,
  violence: 24,
  'self-harm': 24,
  'doxxing-privacy': 48,
  hate: 72,
  harassment: 72,
  impersonation: 72,
  'fraud-scam': 72,
  copyright: 240,
  spam: 168,
  other: 168,
};

/** Reasons that open an urgent case. Twin of the nw_report_sla urgent lane. */
export const EDGE_REPORT_URGENT_REASONS: readonly ReportReason[] = ['child-safety', 'ncii'];

const DMCA_ATTESTATION_VERSION = '2026-07-12';
const DMCA_TAKEDOWN_GOOD_FAITH_TEXT =
  'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.';
const DMCA_TAKEDOWN_ACCURACY_TEXT =
  'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.';
const DMCA_COUNTER_MISTAKE_TEXT =
  'I state under penalty of perjury that I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.';
const DMCA_COUNTER_JURISDICTION_TEXT =
  'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, for any judicial district in which MyNews may be found.';
const DMCA_COUNTER_SERVICE_TEXT =
  "I will accept service of process from the person who submitted the original notice of claimed infringement, or that person's agent.";

export type ReportSubmitOutcome =
  | 'submitted'
  | 'already-reported'
  | 'escalated'
  | 'bad-target';

export interface ReportRecord {
  reporterProfileId: string;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail: string;
}

export interface StoredReport extends ReportRecord {
  id: string;
  status: 'open' | 'actioned' | 'no_action';
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  ownerProfileId: string;
  storagePath: string;
  sha256: string;
  status: 'pending' | 'quarantined' | 'approved' | 'removed';
  createdAt: string;
}

export interface ReportEscalation {
  id: string;
  reportId: string;
  fromReason: ReportReason;
  toReason: ReportReason;
  priorDetail: string;
  escalatedDetail: string;
  createdAt: string;
}

/**
 * One open report enriched with a snapshot of what it targets, so the console
 * queue can show context without a second round-trip. The target snapshot is
 * best-effort: a report can name a target that was later hidden/deleted, in
 * which case targetContext is null and the moderator still sees the raw report.
 */
export interface ReportQueueItem {
  id: string;
  reporterProfileId: string;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail: string;
  createdAt: string;
  /** Snapshot of the reported entity; null when the target no longer resolves. */
  targetContext:
    | { kind: 'article'; slug: string; status: string; authorProfileId: string; headline: string }
    | { kind: 'suggestion'; articleId: string; status: string; editorProfileId: string; rationale: string }
    | { kind: 'profile'; handle: string; suspendedUntil: string | null }
    | { kind: 'media'; ref: string }
    | null;
}

export type ModerationOutcome = 'ok' | 'not-found' | 'bad-moderator';
export type ResolveOutcome = 'ok' | 'not-open' | 'bad-status' | 'bad-moderator';

/* ------------------------- key custody (plan 48 WP6) ---------------------- */

/**
 * Verdict from the active-key resolver (nw_key_resolve_active). Three states,
 * deliberately distinct: 'revoked' must never collapse into 'unknown', because
 * the caller owes a signer whose key was rotated or revoked a typed
 * 'key-revoked' answer rather than "we have never heard of you".
 */
export type KeyResolutionVerdict = 'active' | 'revoked' | 'unknown';

export interface KeyResolution {
  verdict: KeyResolutionVerdict;
  /** Present for 'active' and 'revoked'. */
  profileId?: string;
  /** The nw_profile_keys row id, stamped onto stored writes as verified_key_id. */
  keyId?: string;
  kind?: 'primary' | 'device';
}

/** Every custody RPC return code, mirroring migration 20260730000008 exactly. */
export type KeyCustodyOutcome =
  | 'ok'
  | 'bad-payload'
  | 'bad-nonce'
  | 'no-profile'
  | 'no-active-key'
  | 'rate-limited'
  | 'head-conflict'
  | 'pubkey-conflict'
  | 'same-key'
  | 'not-primary'
  | 'unknown-key'
  | 'not-your-key'
  | 'already-revoked'
  | 'use-rotation-for-primary'
  | 'revoke-precedence'
  | 'notification-channel-required'
  | 'recovery-frozen'
  | 'already-pending'
  | 'unknown-request'
  | 'not-pending'
  | 'still-locked'
  | 'pubkey-not-precommitted'
  | 'bad-cancel-token'
  | 'no-kit';

export type KeyNoncePurpose =
  | 'rotation'
  | 'device_approval'
  | 'revocation'
  | 'recovery_complete'
  | 'escrow_put';

export interface IssuedKeyNonce {
  outcome: KeyCustodyOutcome;
  nonce?: string;
  profileId?: string;
  /** The chain head the nonce is bound to; the client signs over this. */
  oldPubkey?: string;
  purpose?: KeyNoncePurpose;
  expiresAt?: string;
}

export interface KeyMutationResult {
  outcome: KeyCustodyOutcome;
  keyId?: string;
  previousKeyId?: string;
  profileId?: string;
  /** True when the bind followed an escrow read inside 24h (public event). */
  backupRestore?: boolean;
}

export interface EscrowPutResult {
  outcome: KeyCustodyOutcome;
  version?: number;
}

export interface EscrowGetResult {
  outcome: KeyCustodyOutcome;
  version?: number;
  envelope?: Record<string, unknown>;
  pubkey?: string;
}

export interface RecoveryRequestResult {
  outcome: KeyCustodyOutcome;
  requestId?: string;
  unlocksAt?: string;
  standing?: 'open' | 'verified';
}

export interface RecoveryCancelResult {
  outcome: KeyCustodyOutcome;
  /** 'cancelled' normally; 'frozen' on the 2nd cancel inside the window. */
  status?: 'cancelled' | 'frozen';
}

export interface ProfileKeyRow {
  id: string;
  seq: number;
  pubkey: string;
  status: 'active' | 'revoked';
  kind: 'primary' | 'device';
  addedVia: 'initial' | 'rotation' | 'device_approval' | 'recovery' | 'backup_restore';
  validFrom: string;
  revokedAt: string | null;
}

export interface EscrowSummaryRow {
  version: number;
  pubkey: string;
  createdAt: string;
}

export interface EscrowAccessRow {
  action: 'put' | 'get' | 'get-denied';
  version: number | null;
  detail: string;
  createdAt: string;
}

export interface RecoveryRequestRow {
  id: string;
  status: 'pending' | 'cancelled' | 'completed' | 'frozen';
  newPubkey: string;
  requestedAt: string;
  unlocksAt: string;
  standing: 'open' | 'verified';
}

/** Everything the Me screen's Keys and Recovery section renders. */
export interface KeyCustodyStatus {
  outcome: KeyCustodyOutcome;
  profileId?: string;
  headPubkey?: string;
  keys?: ProfileKeyRow[];
  escrow?: EscrowSummaryRow[];
  escrowAccess?: EscrowAccessRow[];
  /**
   * Whether no-kit recovery is available at all on this deployment. False today
   * on every deployment: MyNews ships no notification provider, so the gate has
   * nothing to confirm against. Surfaced rather than hidden so the UI can say
   * so instead of offering a path that will always refuse.
   */
  notificationChannelConfirmed?: boolean;
  recovery?: RecoveryRequestRow | null;
  recoveryFrozen?: boolean;
}

export interface MyNewsStore {
  getProfileIdByPubkey(pubkeyHex: string): Promise<string | null>;
  getProfileIdByUserId(userId: string): Promise<string | null>;
  /**
   * Bind a verified Ed25519 key to the caller's own profile (service role,
   * bypasses the client-write guard trigger). 'no-profile' = the auth uid has
   * no profile row yet; 'pubkey-conflict' = the key is already held by another
   * profile (partial unique index); 'already-set' = this profile already holds
   * a non-empty key (keys are set once, never rotated in this path).
   */
  setProfilePubkey(
    userId: string,
    pubkey: string,
  ): Promise<'ok' | 'no-profile' | 'pubkey-conflict' | 'already-set'>;
  /**
   * WP6 active-key resolver. THE read every signature-verifying handler routes
   * through, replacing the head-only getProfileIdByPubkey lookup: it recognizes
   * co-active device keys, and it tells a revoked signer apart from an unknown
   * one so the handler can answer 'key-revoked'.
   */
  resolveActiveKey(pubkey: string): Promise<KeyResolution>;
  /**
   * Issue a single-use custody proof nonce bound to (uid, profile, current head,
   * purpose). The CALLER generates the nonce bytes from the platform CSPRNG and
   * passes them in; the store records the binding and the 5-minute expiry.
   */
  issueKeyNonce(input: {
    userId: string;
    nonce: string;
    purpose: KeyNoncePurpose;
  }): Promise<IssuedKeyNonce>;
  /**
   * Replace the head key. Consumes the nonce and re-asserts the head inside one
   * transaction, so a concurrent rotation loses with 'head-conflict' instead of
   * forking the chain.
   */
  rotateProfileKey(input: {
    userId: string;
    nonce: string;
    newPubkey: string;
    addedVia: 'rotation' | 'recovery' | 'backup_restore';
    proof: Record<string, unknown>;
  }): Promise<KeyMutationResult>;
  /** Add a co-active device key. The head and the primary row are untouched. */
  approveDeviceKey(input: {
    userId: string;
    nonce: string;
    devicePubkey: string;
    proof: Record<string, unknown>;
  }): Promise<KeyMutationResult>;
  /** Revoke one chain row, subject to the primary-over-device precedence rules. */
  revokeProfileKey(input: {
    userId: string;
    nonce: string;
    targetKeyId: string;
  }): Promise<KeyMutationResult>;
  /** Append a new escrow version (never an overwrite); keeps the newest 3. */
  escrowPutKit(input: {
    userId: string;
    nonce: string;
    envelope: Record<string, unknown>;
    pubkey: string;
  }): Promise<EscrowPutResult>;
  /** Read the newest escrow version. Rate limited, and always logged. */
  escrowGetKit(userId: string): Promise<EscrowGetResult>;
  /** Open a no-kit recovery request. Refuses without a confirmed notify channel. */
  requestKeyRecovery(input: {
    userId: string;
    newPubkey: string;
    cancelTokenHash: string;
  }): Promise<RecoveryRequestResult>;
  /** Cancel a pending request with the keyless token OR an active-key proof. */
  cancelKeyRecovery(input: {
    requestId: string;
    cancelTokenHash?: string;
    userId?: string;
    nonce?: string;
  }): Promise<RecoveryCancelResult>;
  /** Finish a recovery after the lock elapses, for the pre-committed key only. */
  completeKeyRecovery(input: {
    userId: string;
    nonce: string;
    requestId: string;
    newPubkey: string;
    proof: Record<string, unknown>;
  }): Promise<KeyMutationResult>;
  /** Chain, escrow, access log, notify-channel gate state, live recovery. */
  getKeyCustodyStatus(userId: string): Promise<KeyCustodyStatus>;
  /** Registered pubkeys by profile id (changelog credit validation, C4). */
  getProfilePubkeys(profileIds: string[]): Promise<Record<string, string>>;
  getArticleHead(articleId: string): Promise<ArticleHead | null>;
  slugTaken(slug: string): Promise<boolean>;
  /**
   * Atomic: article insert (rev 1, draft or published) or head bump, plus
   * revision insert; publishing an existing draft flips status and stamps
   * published_at with the bump. 'bad-payload' = draft without a newsroom.
   */
  publishArticle(
    record: PublishRecord,
  ): Promise<'ok' | 'rev-conflict' | 'slug-conflict' | 'bad-payload'>;
  insertSuggestion(record: SuggestionRecord): Promise<'ok' | 'unknown-article'>;
  getSuggestion(id: string): Promise<StoredSuggestion | null>;
  /**
   * Cheap count of the editor's suggestions created at or after sinceIso, for
   * the pipeline throttle. A HEAD count in the postgrest impl, no row bodies.
   */
  countRecentSuggestions(editorProfileId: string, sinceIso: string): Promise<number>;
  /** Open suggestions on one article+baseRev, for the near-dupe scan. */
  getOpenSuggestionsForArticle(articleId: string, baseRev: number): Promise<OpenSuggestionLite[]>;
  /** Idempotent on the unique (original, endorser) pair. */
  insertDupeEndorsement(input: {
    originalId: string;
    endorserId: string;
    similarity: number;
  }): Promise<'ok'>;
  getEditorAggregates(editorProfileId: string): Promise<EditorAggregates>;
  getCredibilityLedger(editorProfileId: string): Promise<CredibilityLedgerRow[]>;
  /**
   * Direct membership-table read under the service role. Never the
   * nw_is_newsroom_member RPC helper: it answers only for auth.uid() and
   * returns false under service-role JWTs by design.
   */
  getNewsroomRole(newsroomId: string, profileId: string): Promise<NewsroomRole | null>;
  /** Atomic: revision insert + head bump + status + event + credibility row. */
  acceptSuggestion(record: AcceptRecord): Promise<'ok' | 'rev-conflict' | 'not-open'>;
  /** Atomic all-or-nothing: one revision, N status flips, N events, N ledger rows. */
  acceptSuggestionsBatch(
    record: BatchAcceptRecord,
  ): Promise<'ok' | 'rev-conflict' | 'not-open' | 'mixed-articles' | 'bad-award'>;
  /** The optional note lands on the reject event payload. */
  rejectSuggestion(
    suggestionId: string,
    actorProfileId: string,
    note?: string,
  ): Promise<'ok' | 'not-open'>;
  /**
   * Signed provenance-metadata upsert (service role, bypasses the client-write
   * guard trigger). The mynews-set-meta function verifies the author signature
   * over the meta canonical bytes BEFORE calling this; the row carries the
   * signature + signer pubkey so it stays offline re-verifiable.
   */
  upsertArticleMeta(record: ArticleMetaRecord): Promise<'ok' | 'bad-payload'>;
  /**
   * True when target_id refers to a real row of target_kind. article/profile
   * are UUID rows; revision/suggestion are UUID rows keyed by their own id
   * (revision reports address an article id, since a revision is a rev under
   * an article); media resolves through the service-role-only nw_media_assets
   * table. Backs legacy callers; atomic intake validates again inside SQL.
   */
  reportTargetExists(kind: ReportTargetKind, targetId: string): Promise<boolean>;
  /** Count of the reporter's reports created at or after sinceIso (rate limit). */
  countRecentReports(reporterProfileId: string, sinceIso: string): Promise<number>;
  /**
   * Count of this profile's suggestion COMMENTS created at or after sinceIso,
   * backing the durable comment throttle in mynews-comment (plan 48 WP4). A
   * HEAD count in the postgrest impl. A throwing count fails the request
   * closed; it is never treated as zero.
   */
  countRecentSuggestionComments(actorProfileId: string, sinceIso: string): Promise<number>;
  /**
   * Insert one comment event on a suggestion thread (service role). Direct
   * client inserts of action='comment' rows are blocked by the guard trigger
   * in 20260730000003, so this is the only write path. The RPC re-validates
   * the body bounds and the suggestion/actor rows.
   */
  insertSuggestionComment(input: {
    suggestionId: string;
    actorProfileId: string;
    body: string;
  }): Promise<SuggestionCommentOutcome>;
  /** True when this reporter already has an OPEN report on the same target (dedupe). */
  hasOpenReport(
    reporterProfileId: string,
    kind: ReportTargetKind,
    targetId: string,
  ): Promise<boolean>;
  /** Insert a report with reporter_id set (never null on this path). */
  insertReport(record: ReportRecord): Promise<'ok'>;
  /**
   * Atomic report intake (migration 20260712000001): target validation,
   * severity-aware dedupe or escalation, report mutation, immediate NCII
   * takedown, case creation, and audit commit together.
   */
  submitReport(input: {
    reporterProfileId: string;
    targetKind: ReportTargetKind;
    targetId: string;
    reason: ReportReason;
    detail: string;
  }): Promise<ReportSubmitOutcome>;
  /**
   * The id of this reporter's OPEN report on the target, or null. Backs the
   * NCII intake path: after inserting an ncii report it resolves the report id
   * to open the take-down-first case against it.
   */
  getOpenReportId(
    reporterProfileId: string,
    kind: ReportTargetKind,
    targetId: string,
  ): Promise<string | null>;
  /** The reporter's own reports, newest first (nw_reports_reporter_select). */
  getMyReports(reporterProfileId: string): Promise<StoredReport[]>;
  /**
   * True when the profile is currently suspended (suspended_until in the
   * future). Backs the publish/suggest/report suspension gate. A service-role
   * read; a suspension that has lapsed reads as active.
   */
  isProfileSuspended(profileId: string, nowIso: string): Promise<boolean>;
  /**
   * True when the user (auth user id, not profile id) has accepted exactly
   * `version` in nw_terms_acceptance. Service-role read; the terms gate on
   * publish and suggest depends only on this. A version bump therefore
   * re-gates everyone until they re-accept.
   */
  hasAcceptedTerms(userId: string, version: string): Promise<boolean>;
  /**
   * DSA Art 17 statements of reasons for moderation actions that targeted
   * content owned by `userId`. Scoped (in postgrest, by a SECURITY DEFINER RPC)
   * to the caller's own content only; nw_moderation_actions is never exposed to
   * clients directly. Newest-first.
   */
  getMyModerationNotices(userId: string): Promise<ModerationNotice[]>;
  /**
   * File an appeal against ONE moderation action taken on the caller's own
   * content (plan 48 WP9). Ownership is checked server-side, and a missing action
   * and someone else's action answer identically ('not-found') so this cannot be
   * used to probe which action ids exist. One appeal per action per person.
   */
  appealModerationAction(input: {
    appellantProfileId: string;
    actionId: string;
    reason: string;
  }): Promise<ModerationAppealOutcome>;
  /** The open report queue with per-target context (moderation console). */
  getOpenReportQueue(limit: number): Promise<ReportQueueItem[]>;
  /** Retract any article + audit (service-role moderation RPC). */
  moderateHideArticle(input: {
    articleId: string;
    moderatorRef: string;
    note: string;
    reportId?: string | null;
  }): Promise<ModerationOutcome>;
  /** Reject any suggestion + audit (service-role moderation RPC). */
  moderateHideSuggestion(input: {
    suggestionId: string;
    moderatorRef: string;
    note: string;
    reportId?: string | null;
  }): Promise<ModerationOutcome>;
  /** Suspend (until set) or lift (until null) a profile + audit. */
  moderateSuspendProfile(input: {
    profileId: string;
    until: string | null;
    moderatorRef: string;
    note: string;
    reportId?: string | null;
  }): Promise<ModerationOutcome>;
  /** Resolve an open report (actioned|no_action) + audit. */
  moderateResolveReport(input: {
    reportId: string;
    status: 'actioned' | 'no_action';
    moderatorRef: string;
    note: string;
  }): Promise<ResolveOutcome>;
  /** Durable fixed-window limit. Any read/write failure throws and fails intake closed. */
  consumeDmcaRateLimit(input: DmcaRateLimitInput): Promise<DmcaRateLimitOutcome>;
  /** Atomic takedown record + URL resolution + linked report + visible queue event. */
  submitDmcaTakedown(record: DmcaTakedownRecord): Promise<DmcaSubmissionResult>;
  /** Atomic distinct counter-notice record + URL resolution + visible queue event. */
  submitDmcaCounterNotice(record: DmcaCounterNoticeRecord): Promise<DmcaSubmissionResult>;
  /** JWT-account-email-scoped status for one submitted takedown or counter-notice. */
  getMyDmcaSubmissionStatus(input: {
    userId: string;
    kind: 'takedown' | 'counter';
    noticeId: string;
    email: string;
  }): Promise<DmcaSubmissionStatus | null>;
  /**
   * Increment an author's copyright strikes, audit it, and suspend at threshold.
   * 'suspended' when the threshold was reached and the profile was suspended;
   * 'struck' below threshold; 'not-found'/'bad-moderator' for the guards.
   */
  moderateStrikeAndMaybeSuspend(input: {
    profileId: string;
    moderatorRef: string;
    note: string;
    reportId?: string | null;
    threshold?: number;
    suspendUntil?: string | null;
  }): Promise<StrikeOutcome>;
  /** Current copyright-strike count for a profile (0 when unknown). */
  getCopyrightStrikes(profileId: string): Promise<number>;
  /**
   * Take-down-first NCII intake (migration 20260705000009). Opens an
   * nw_ncii_cases row for an ncii report AND immediately retracts/hides the
   * content target via the same enforcement path a moderator uses. Idempotent
   * on report_id ('exists'); 'not-ncii' when the report is not an ncii report.
   */
  openNciiCase(reportId: string, deadlineHours?: number): Promise<NciiOpenOutcome>;
  /**
   * Idempotently repair an existing open NCII report without a non-cleared
   * case. The deadline remains anchored to the report's original created_at.
   */
  reconcileNciiCase(reportId: string): Promise<NciiOpenOutcome>;
  /** Open NCII report ids that have no matching non-cleared case. */
  findOrphanedNciiReports(): Promise<string[]>;
  /**
   * Fail-closed SLA enforcement for one NCII case. 'ensure_removed' drives a
   * queued/escalated case to provable removal (idempotent); 'escalate' flags an
   * over-SLA case; 'clear' is a HUMAN-ONLY resolve (the worker's 'ncii-auto' ref
   * is rejected). Optional hash/NCMEC seam outputs are recorded but never
   * auto-clear a case.
   */
  enforceNciiCase(input: {
    caseId: string;
    action: NciiEnforceAction;
    moderatorRef: string;
    note?: string;
    hashStatus?: NciiHashStatus | null;
    ncmecRef?: string | null;
  }): Promise<NciiEnforceOutcome>;
  /**
   * Unresolved (queued|escalated) NCII cases whose deadline is at or before
   * nowIso, newest-deadline-first. The worker's SLA scan. A 'removed' case is
   * already safe; a 'cleared' case is done.
   */
  getDueNciiCases(nowIso: string, limit: number): Promise<NciiCase[]>;
  /** Every open (non-cleared) NCII case, soonest-deadline-first (console). */
  getOpenNciiCases(limit: number): Promise<NciiCase[]>;

  /* ------------------------- account lifecycle (WP5) ------------------------ */

  /**
   * Open (or return the existing) deletion request for a user. Idempotent: a
   * row in 'grace', 'processing', or 'failed' is in flight and is returned
   * unchanged; only a 'cancelled'/'completed' history allows a new request.
   */
  initiateAccountDeletion(
    userId: string,
    profileId: string | null,
  ): Promise<DeletionInitiateOutcome>;
  /** Cancel the newest in-flight request. Only 'grace' is cancellable. */
  cancelAccountDeletion(userId: string): Promise<DeletionCancelOutcome>;
  /** Newest deletion request for the user, or null. Durable status read. */
  getAccountDeletionStatus(userId: string): Promise<DeletionRequestRow | null>;
  /**
   * Promote due 'grace' rows (and stalled/failed rows past their retry backoff)
   * to 'processing' and return the claimed rows. Concurrency-safe.
   */
  claimDueAccountDeletions(nowIso: string, limit: number): Promise<DeletionClaim[]>;
  /**
   * Run the whole content disposition for one claimed request in ONE
   * transaction. Idempotent, so a retried pass is safe. Any step that cannot
   * complete raises and rolls the transaction back; nothing is partially
   * disposed.
   */
  disposeAccountDeletion(requestId: string): Promise<DeletionDisposeOutcome>;
  /** Record an auth-deletion or processor-cleanup outcome on the request. */
  recordAccountDeletionState(input: {
    requestId: string;
    field: DeletionStateField;
    state: DeletionSideEffectState;
    detail?: string | null;
  }): Promise<DeletionRecordStateOutcome>;
  /**
   * Terminal success. Fail-closed: refuses while content disposition has not
   * run or either side-effect state is still 'pending'/'failed'.
   * 'skipped-unconfigured' is terminal and stays visible; it never becomes
   * 'done'.
   */
  completeAccountDeletion(requestId: string): Promise<DeletionCompleteOutcome>;
  /** Terminal-for-this-pass failure with a detail; the worker retries it later. */
  failAccountDeletion(requestId: string, detail: string): Promise<'ok' | 'not-found'>;
  /**
   * Every row the user owns, as one consistent snapshot. Sections are always
   * present so a caller can tell "no rows of this kind" from "incomplete".
   */
  exportAccountBundle(userId: string, profileId: string | null): Promise<AccountExportBundle>;
  /** Durable audit row for one export request. Never stores the exported data. */
  recordAccountExport(input: {
    userId: string;
    profileId: string | null;
    status: 'completed' | 'failed';
    byteCount: number;
    detail?: string | null;
  }): Promise<'ok' | 'bad-status'>;
  /**
   * Admin-API auth-user deletion seam. 'skipped-unconfigured' when the admin
   * credentials are absent: the state stays visible in the deletion status and
   * is NEVER reported as 'done'. Called only after disposition detached the
   * retained public record from auth.users.
   */
  deleteAuthUser(userId: string): Promise<AdminAuthDeletionOutcome>;

  /* ------------------- pre-publication screening (plan 48 WP8) ------------- */

  /**
   * True when a human already approved these exact bytes for this author. The
   * edges check this BEFORE screening so an approved resubmission is not held
   * again, which is what makes the review-accept hold path terminable.
   */
  screeningAllowanceExists(authorProfileId: string, contentSha256: string): Promise<boolean>;
  /** The author's recent content signatures, newest first, for flood detection. */
  getRecentContentSignatures(authorProfileId: string, limit?: number): Promise<unknown[]>;
  /** Append this submission's signature to the author's recent history. */
  recordContentSignature(input: {
    authorProfileId: string;
    contentKind: ScreeningContentKind;
    signature: unknown;
  }): Promise<'ok' | 'no-profile' | 'bad-payload'>;
  /** Persist a below-threshold allow for false-negative measurement. */
  recordScreeningAllow(input: ScreeningRecordInput): Promise<string | null>;
  /** Store an article or revision quarantined, with its decision row, atomically. */
  quarantineArticle(input: {
    article: PublishRecord['article'];
    revision: PublishRecord['revision'];
    verdict: unknown;
    contentSha256: string;
  }): Promise<ScreeningWriteOutcome>;
  /** Store a suggestion quarantined, with its decision row, atomically. */
  quarantineSuggestion(input: {
    suggestion: SuggestionRecord;
    verdict: unknown;
    contentSha256: string;
  }): Promise<ScreeningWriteOutcome>;
  /** Store a comment quarantined, with its decision row, atomically. */
  quarantineComment(input: {
    suggestionId: string;
    actorProfileId: string;
    body: string;
    verdict: unknown;
    contentSha256: string;
  }): Promise<ScreeningWriteOutcome>;
  /**
   * Hold a flagged revision PROPOSAL from the review-accept path. Nothing is
   * stored as content: review requires an author-signed revision and the server
   * never composes article text, so the proposal is held as an audit row and an
   * approval issues a content allowance for the author's resubmission.
   */
  holdRevisionProposal(input: {
    articleId: string;
    authorProfileId: string;
    rev: number;
    payload: unknown;
    verdict: unknown;
    contentSha256: string;
  }): Promise<ScreeningWriteOutcome>;

  /**
   * The caller's own held content, curated for the author-facing surfaces.
   * Deliberately omits class scores, signals, and thresholds: an author is owed
   * an honest reason and an appeal route, not the detector's internals.
   */
  getMyScreeningDecisions(userId: string): Promise<ScreeningDecisionSummary[]>;
  /** File an appeal against one of the caller's own held decisions. */
  appealScreeningDecision(input: {
    decisionId: string;
    authorProfileId: string;
    reason: string;
  }): Promise<ScreeningAppealOutcome>;

  /* ------------------- verification center (plan 48 WP8) ------------------- */

  /** Current verification state for a journalist profile. */
  getVerificationState(profileId: string): Promise<VerificationState>;
  /** File a verification request with evidence references. */
  requestVerification(input: {
    profileId: string;
    method: VerificationMethod;
    evidenceRef: string;
    evidence: unknown[];
  }): Promise<VerificationRequestOutcome>;
  /** The caller's own verification history. */
  getMyVerifications(userId: string): Promise<VerificationRow[]>;
}

/* ------------------------ screening (plan 48 WP8) ------------------------- */

export type ScreeningContentKind =
  | 'article'
  | 'revision'
  | 'suggestion'
  | 'comment'
  | 'revision-proposal';

export interface ScreeningRecordInput {
  contentKind: ScreeningContentKind;
  contentId: string;
  contentRev: number | null;
  authorProfileId: string;
  contentSha256: string;
  verdict: unknown;
}

/**
 * Result of a quarantine write. The decision id comes back on success so the
 * edge can hand the author a reference they can quote in an appeal, and so the
 * response and the audit row are provably the same event.
 */
export type ScreeningWriteOutcome =
  | { ok: true; decisionId: string }
  | {
      ok: false;
      code:
        | 'rev-conflict'
        | 'slug-conflict'
        | 'unknown-article'
        | 'unknown-suggestion'
        | 'unknown-actor'
        | 'unavailable';
    };

/** Author-facing view of one held submission. */
export interface ScreeningDecisionSummary {
  id: string;
  contentKind: ScreeningContentKind;
  contentId: string;
  contentRev: number | null;
  autoAction: 'allowed' | 'quarantined' | 'held';
  decision: 'pending' | 'approved' | 'rejected' | 'auto-allowed';
  /** Risk class that held it, for honest copy. Never the score. */
  topClass: string | null;
  requiresHumanReview: boolean;
  reviewReason: string;
  appealState: 'none' | 'requested' | 'granted' | 'denied';
  createdAt: string;
  reviewedAt: string | null;
}

export type ScreeningAppealOutcome =
  | 'ok'
  | 'not-found'
  | 'not-author'
  | 'not-appealable'
  | 'already-appealed'
  | 'bad-reason'
  | 'unavailable';

/* ------------------- verification center (plan 48 WP8) -------------------- */

export type VerificationState =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired';

export type VerificationMethod = 'domain_email' | 'orcid' | 'byline' | 'manual';

export type VerificationRequestOutcome =
  | { ok: true; verificationId: string }
  | {
      ok: false;
      code: 'no-journalist' | 'bad-method' | 'already-pending' | 'already-verified' | 'unavailable';
    };

export interface VerificationRow {
  id: string;
  method: VerificationMethod;
  status: VerificationState;
  decisionReason: string;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/* --------------------------- account lifecycle ---------------------------- */

export type DeletionStatus = 'grace' | 'processing' | 'completed' | 'cancelled' | 'failed';
export type DeletionSideEffectState = 'pending' | 'done' | 'skipped-unconfigured' | 'failed';
export type DeletionStateField = 'auth_user_deletion_state' | 'processor_cleanup_state';

/** Mirrors one nw_deletion_requests row. */
export interface DeletionRequestRow {
  id: string;
  userId: string;
  profileId: string | null;
  status: DeletionStatus;
  requestedAt: string;
  graceEndsAt: string;
  cancelledAt: string | null;
  processingStartedAt: string | null;
  contentDisposedAt: string | null;
  completedAt: string | null;
  failureDetail: string | null;
  authUserDeletionState: DeletionSideEffectState;
  processorCleanupState: DeletionSideEffectState;
}

export interface DeletionClaim {
  id: string;
  userId: string;
  profileId: string | null;
}

export type DeletionInitiateOutcome =
  | { outcome: 'created' | 'existing'; request: DeletionRequestRow }
  | { outcome: 'bad-payload' | 'conflict' };

export type DeletionCancelOutcome = 'ok' | 'not-found' | 'not-cancellable';
export type DeletionDisposeOutcome = 'ok' | 'not-found' | 'bad-status';
export type DeletionRecordStateOutcome = 'ok' | 'not-found' | 'bad-field' | 'bad-state';
export type DeletionCompleteOutcome =
  | 'ok'
  | 'not-found'
  | 'bad-status'
  | 'not-disposed'
  | 'states-pending';
/** Opaque JSON document: the shape is owned by nw_account_export_bundle. */
export type AccountExportBundle = Record<string, unknown>;
export type AdminAuthDeletionOutcome = 'done' | 'skipped-unconfigured' | 'failed';

export type StrikeOutcome = 'suspended' | 'struck' | 'not-found' | 'bad-moderator';

export interface DmcaTakedownRecord {
  submitterProfileId: string | null;
  complainantName: string;
  complainantEmail: string;
  complainantAddress: string;
  copyrightedWork: string;
  infringingUrl: string;
  goodFaith: true;
  goodFaithAttestationText: string;
  goodFaithAttestationVersion: string;
  accuracyUnderPenalty: true;
  accuracyAttestationText: string;
  accuracyAttestationVersion: string;
  signature: string;
}

export interface DmcaCounterNoticeRecord {
  submitterProfileId: string | null;
  originalNoticeReference: string;
  counterNotifierName: string;
  counterNotifierAddress: string;
  counterNotifierPhone: string;
  counterNotifierEmail: string;
  removedMaterial: string;
  materialLocationBeforeRemoval: string;
  goodFaithMistakeOrMisidentification: true;
  statementUnderPenaltyOfPerjury: true;
  mistakeAttestationText: string;
  mistakeAttestationVersion: string;
  consentToFederalJurisdiction: true;
  jurisdictionAttestationText: string;
  jurisdictionAttestationVersion: string;
  acceptanceOfServiceOfProcess: true;
  serviceAttestationText: string;
  serviceAttestationVersion: string;
  signature: string;
}

export interface DmcaSubmissionResult {
  outcome: 'ok' | 'bad-payload';
  referenceId?: string;
  resolutionStatus?: 'resolved' | 'needs-resolution';
  originalNoticeMatched?: boolean;
  targetKind?: ReportTargetKind | null;
  targetId?: string | null;
  queueVisible?: boolean;
}

export interface DmcaRateLimitInput {
  rateKey: string;
  ipHash: string;
  emailHash: string;
  /** In-memory test clock only. PostgreSQL always uses database time. */
  nowMs: number;
}

export type DmcaRateLimitOutcome = 'allowed' | 'rate-limited' | 'bad-key';

export interface StoredDmcaTakedown extends DmcaTakedownRecord {
  id: string;
  reportId: string | null;
  targetKind: ReportTargetKind | null;
  targetId: string | null;
  status: 'needs_resolution' | 'received' | 'acknowledged' | 'forwarded' | 'actioned' | 'restored' | 'closed';
  createdAt: string;
}

export interface StoredDmcaCounterNotice extends DmcaCounterNoticeRecord {
  id: string;
  originalNoticeId: string | null;
  targetKind: ReportTargetKind | null;
  targetId: string | null;
  status:
    | 'needs_resolution'
    | 'received'
    | 'forwarded_to_claimant'
    | 'waiting_period'
    | 'restored'
    | 'litigation_hold'
    | 'closed';
  createdAt: string;
}

export interface DmcaSubmissionStatus {
  kind: 'takedown' | 'counter';
  referenceId: string;
  status: string;
  resolutionStatus: 'resolved' | 'needs-resolution';
  acknowledgmentDueAt: string;
  acknowledgedAt: string | null;
  restorationEligibleAt?: string | null;
  restorationDeadlineAt?: string | null;
  createdAt: string;
}

export interface ModerationActionRow {
  reportId: string | null;
  moderatorRef: string;
  /**
   * 'screening_hold' added by plan 48 WP8 (migration 20260730000009): an
   * automated pre-publication hold is an adverse action, so it carries a
   * statement of reasons like any other. 'restore' covers a screening release,
   * which nw_get_my_moderation_notices already treats as non-adverse.
   */
  action:
    | 'hide_article'
    | 'hide_suggestion'
    | 'suspend_profile'
    | 'dismiss'
    | 'restore'
    | 'screening_hold';
  targetKind: string;
  targetId: string;
  note: string;
  /** Stamped by the in-memory store when the action is recorded. */
  createdAt?: string;
  /**
   * Stable id (plan 48 WP9). An appeal names the ACTION it contests, so the
   * statement-of-reasons read has to carry an identifier the client can send back.
   * The in-memory store assigns one when the action is recorded.
   */
  id?: string;
}

/**
 * A DSA Art 17 statement of reasons: one moderation action taken against a
 * piece of content the caller owns. `machineReason` is the action enum; `note`
 * is the human explanation the moderator recorded in the console. Scoped by the
 * store to the caller's own content only; nw_moderation_actions is never
 * exposed to clients directly.
 */
export interface ModerationNotice {
  targetKind: string;
  targetId: string;
  /** Machine-readable reason enum, e.g. 'hide_article' | 'suspend_profile'. */
  machineReason: string;
  /** Free-text statement of reasons the moderator recorded. */
  note: string;
  createdAt: string;
  /**
   * Appeal fields (plan 48 WP9). `actionId` is what an appeal names, so a notice
   * without one cannot be appealed; that is honest rather than hidden, because a
   * pre-WP9 audit row has no id the appeal RPC can resolve.
   */
  actionId: string | null;
  appealState: 'none' | 'requested' | 'granted' | 'denied';
  appealReason: string;
  appealDecisionReason: string;
  /** What a granted appeal actually reversed, or null when it granted nothing. */
  appealReversalOutcome: string | null;
  appealDecidedAt: string | null;
}

/** Typed outcomes of filing an appeal against a moderation action. */
export type ModerationAppealOutcome =
  | 'ok'
  | 'not-found'
  | 'not-appealable'
  | 'already-appealed'
  | 'bad-reason';

export type NciiCaseStatus = 'queued' | 'removed' | 'escalated' | 'cleared';
export type NciiHashStatus = 'pending' | 'match' | 'no_match' | 'error';
export type NciiEnforceAction = 'ensure_removed' | 'escalate' | 'clear';

export interface NciiCase {
  id: string;
  reportId: string;
  targetKind: ReportTargetKind;
  targetId: string;
  deadlineAt: string;
  status: NciiCaseStatus;
  hashMatchStatus: NciiHashStatus;
  ncmecRef: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** nw_open_ncii_case outcomes (take-down-first intake). */
export type NciiOpenOutcome = 'ok' | 'exists' | 'not-ncii';
/**
 * nw_ncii_enforce outcomes: the new case status on success ('removed' |
 * 'escalated' | 'cleared'), or a named guard failure. 'clear-not-allowed' is
 * returned when the automated worker ('ncii-auto') tries to clear a case.
 */
export type NciiEnforceOutcome =
  | 'removed'
  | 'escalated'
  | 'cleared'
  | 'not-found'
  | 'bad-moderator'
  | 'bad-action'
  | 'clear-not-allowed';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/* ------------------------------ in-memory ------------------------------- */

interface StoredArticle {
  id: string;
  slug: string;
  kind: string;
  status: string;
  authorProfileId: string;
  authorPubkey: string;
  currentRev: number;
  newsroomId?: string | null;
  publishedAt?: string | null;
  /** Screening hold state (plan 48 WP8). Absent means 'cleared'. */
  screeningStatus?: 'cleared' | 'quarantined' | 'rejected';
}

interface StoredProfile {
  id: string;
  userId?: string;
  pubkey: string;
  handle?: string;
  suspendedUntil?: string | null;
  copyrightStrikes?: number;
  /** Account-lifecycle twin fields (nw_profiles columns of the same name). */
  displayName?: string;
  deletedAt?: string | null;
  pubkeyRevokedAt?: string | null;
}

/** Journalist row detail beyond the tier the older seeds carry. */
interface StoredJournalistDetail {
  profileId: string;
  bio: string;
  beats: string[];
  region: string;
  stripeAccountId: string | null;
}

interface StoredFollow {
  followerId: string;
  journalistId: string;
  createdAt: string;
}

interface StoredBlock {
  blockerId: string;
  blockedProfileId: string;
  mode: 'block' | 'mute';
  createdAt: string;
}

interface StoredNewsroom {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

/** In-memory screening decision row (twin of nw_screening_decisions). */
interface InMemoryScreeningDecision {
  id: string;
  contentKind: ScreeningContentKind;
  contentId: string;
  contentRev: number | null;
  authorProfileId: string;
  contentSha256: string;
  autoAction: 'allowed' | 'quarantined' | 'held';
  decision: 'pending' | 'approved' | 'rejected' | 'auto-allowed';
  topClass: string | null;
  thresholdHit: string | null;
  requiresHumanReview: boolean;
  riskScore: number;
  heldPayload: unknown;
  createdAt: string;
  reviewReason?: string;
  reviewedAt?: string | null;
  appealState?: 'none' | 'requested' | 'granted' | 'denied';
  appealReason?: string;
}

interface StoredVerification {
  id: string;
  journalistId: string;
  method: string;
  evidenceRef: string;
  status: string;
  createdAt: string;
  /* Plan 48 WP8 workflow fields. Optional so existing seeds keep working. */
  evidence?: unknown[];
  decisionReason?: string;
  decidedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  reviewedBy?: string | null;
}

interface StoredSupport {
  id: string;
  supporterId: string;
  journalistId: string;
  amountCents: number;
  cadence: 'monthly' | 'oneoff';
  status: 'active' | 'paused' | 'canceled';
  startedAt: string;
}

interface StoredPayoutAccount {
  journalistProfileId: string;
  onboardingState: 'none' | 'pending' | 'verified' | 'blocked';
  provider: string | null;
  providerAccountRef: string | null;
  statusReason: string | null;
}

/**
 * One money-rail row in the in-memory twin. The real tables use different
 * column names per table (nw_support_charges.supporter_id,
 * nw_transfer_ledger.journalist_id, nw_support_ledger.supporter_profile_id...);
 * the twin normalizes them to these two participant keys so one shape covers
 * every rail. Extra per-table fields ride along untouched into the export.
 */
interface StoredMoneyRow {
  id: string;
  supporterProfileId?: string | null;
  journalistProfileId?: string | null;
  [key: string]: unknown;
}

interface StoredExportJob {
  id: string;
  userId: string;
  profileId: string | null;
  status: 'completed' | 'failed';
  requestedAt: string;
  completedAt: string;
  byteCount: number;
  failureDetail: string | null;
}

/** Mirrors the 7-day interval in 20260730000006_mynews_account_lifecycle.sql. */
const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** Retry/stall backoff for claim, mirroring the SQL's interval '1 hour'. */
const DELETION_RETRY_BACKOFF_MS = 60 * 60 * 1000;

/**
 * In-flight statuses. 'failed' counts as in flight: the worker retries it, so a
 * new request must not be opened alongside it (the SQL enforces the same set in
 * the partial unique index).
 */
const IN_FLIGHT_DELETION_STATUSES = new Set<DeletionStatus>(['grace', 'processing', 'failed']);

const DELETION_SIDE_EFFECT_STATES = new Set<DeletionSideEffectState>([
  'pending',
  'done',
  'skipped-unconfigured',
  'failed',
]);

/** Terminal outcomes that allow completion. 'skipped-unconfigured' stays visible. */
const TERMINAL_SIDE_EFFECT_STATES = new Set<DeletionSideEffectState>([
  'done',
  'skipped-unconfigured',
]);

export function createInMemoryMyNewsStore(seed?: {
  profiles?: Array<{
    id: string;
    userId?: string;
    pubkey: string;
    handle?: string;
    suspendedUntil?: string | null;
    copyrightStrikes?: number;
    displayName?: string;
    deletedAt?: string | null;
    pubkeyRevokedAt?: string | null;
  }>;
  journalists?: Array<{ profileId: string; tier: 'open' | 'verified' }>;
  newsroomMembers?: Array<{ newsroomId: string; profileId: string; role: NewsroomRole }>;
  /** Accepted (userId, version) pairs, mirroring nw_terms_acceptance. */
  termsAcceptances?: Array<{ userId: string; version: string }>;
  /** Auth-account emails used by the JWT-gated DMCA submission-status twin. */
  authEmails?: Array<{ userId: string; email: string }>;
  /** Account-lifecycle seeds (WP5): the personal rows disposition removes. */
  journalistDetails?: StoredJournalistDetail[];
  follows?: StoredFollow[];
  blocks?: StoredBlock[];
  newsrooms?: StoredNewsroom[];
  verifications?: StoredVerification[];
  supports?: StoredSupport[];
  payoutAccounts?: StoredPayoutAccount[];
  supportCharges?: StoredMoneyRow[];
  supportLedger?: StoredMoneyRow[];
  supportReceipts?: StoredMoneyRow[];
  transferLedger?: StoredMoneyRow[];
  /**
   * Key custody seeds (WP6). `keys` is normally left empty: the constructor
   * backfills an 'initial' active primary row for every seeded profile that
   * holds a non-empty pubkey, exactly as migration 20260730000008 does, so
   * existing tests keep resolving. Seed rows explicitly only to set up a chain
   * state the backfill cannot produce (a revoked key, a co-active device key).
   */
  profileKeys?: Array<{
    id: string;
    profileId: string;
    pubkey: string;
    status?: 'active' | 'revoked';
    kind?: 'primary' | 'device';
    addedVia?: ProfileKeyRow['addedVia'];
  }>;
  /**
   * Confirmed notification channels. UNREACHABLE in production: no code path
   * anywhere sets confirmed_at, so this seed exists only to exercise the
   * far side of the no-kit recovery gate in tests. See the honesty boundary in
   * migration 20260730000008.
   */
  notifyChannels?: Array<{ profileId: string; confirmedAt: string | null }>;
  /** Prior recovery requests, for the 2-cancels-in-90-days freeze tests. */
  recoveryRequests?: Array<{
    id: string;
    profileId: string;
    userId: string;
    newPubkey: string;
    cancelTokenHash: string;
    status: RecoveryRequestRow['status'];
    requestedAt: string;
    unlocksAt: string;
    standing: 'open' | 'verified';
  }>;
  /** Injectable clock for nonce TTLs, recovery locks, and rate windows. */
  now?: () => number;
}) {
  const profiles = new Map<string, StoredProfile>();
  for (const p of seed?.profiles ?? []) profiles.set(p.id, p);
  const journalists = new Map<string, 'open' | 'verified'>();
  for (const j of seed?.journalists ?? []) journalists.set(j.profileId, j.tier);
  const newsroomMembers: Array<{ newsroomId: string; profileId: string; role: NewsroomRole }> = [
    ...(seed?.newsroomMembers ?? []),
  ];
  const articles = new Map<string, StoredArticle>();
  const revisions: PublishRecord['revision'][] = [];
  const suggestions = new Map<string, StoredSuggestion>();
  const events: SuggestionEventRecord[] = [];
  const dupes: Array<{ originalId: string; endorserId: string; similarity: number }> = [];
  const ledger: CredibilityLedgerRow[] = [];
  const articleMeta = new Map<string, ArticleMetaRecord>();
  const mediaAssets = new Map<string, MediaAsset>();
  const reports: StoredReport[] = [];
  const reportEscalations: ReportEscalation[] = [];
  const moderationActions: ModerationActionRow[] = [];
  // Monotonic stamp so actions recorded in the same millisecond still order
  // deterministically for the statement-of-reasons read.
  let moderationSeq = 0;
  /** Appeals against moderation actions, keyed by `${actionId}::${profileId}`. */
  const moderationAppeals = new Map<
    string,
    {
      actionId: string;
      profileId: string;
      reason: string;
      state: 'requested' | 'granted' | 'denied';
      decisionReason: string;
      reversalOutcome: string | null;
      decidedAt: string | null;
    }
  >();
  const pushModerationAction = (row: ModerationActionRow) => {
    const seq = moderationSeq++;
    moderationActions.push({
      ...row,
      // Every action gets an id, because an appeal names the action it contests.
      id: row.id ?? `mod-action-${seq + 1}`,
      createdAt: row.createdAt ?? new Date(Date.now() + seq).toISOString(),
    });
  };
  // Accepted terms as "userId::version" keys; '::' is a stable delimiter
  // (uuids and YYYY-MM-DD versions never contain it).
  const termsAcceptances = new Set<string>(
    (seed?.termsAcceptances ?? []).map((t) => `${t.userId}::${t.version}`),
  );
  const authEmails = new Map<string, string>(
    (seed?.authEmails ?? []).map((entry) => [entry.userId, entry.email.trim().toLowerCase()]),
  );
  const dmcaNotices: StoredDmcaTakedown[] = [];
  const dmcaCounterNotices: StoredDmcaCounterNotice[] = [];
  const dmcaRateCounters = new Map<
    string,
    { ipHash: string; emailHash: string; tokens: number; lastRefillMs: number }
  >();
  const nciiCases: NciiCase[] = [];
  /* Screening state (plan 48 WP8). */
  const screeningDecisions: InMemoryScreeningDecision[] = [];
  const screeningAllowances: Array<{
    authorProfileId: string;
    contentSha256: string;
    expiresAt: string;
  }> = [];
  const contentSignatures: Array<{
    authorProfileId: string;
    contentKind: string;
    signature: unknown;
  }> = [];
  /* Revisions held by screening, tracked separately because the in-memory
     revision list mirrors PublishRecord['revision'] and carries no status. */
  const quarantinedRevisions: Array<{ articleId: string; rev: number }> = [];
  let screeningSeq = 0;
  const journalistDetails = new Map<string, StoredJournalistDetail>(
    (seed?.journalistDetails ?? []).map((row) => [row.profileId, { ...row }]),
  );
  const follows: StoredFollow[] = [...(seed?.follows ?? [])];
  const blocks: StoredBlock[] = [...(seed?.blocks ?? [])];
  const newsrooms: StoredNewsroom[] = [...(seed?.newsrooms ?? [])];
  const verifications: StoredVerification[] = [...(seed?.verifications ?? [])];
  const supports: StoredSupport[] = [...(seed?.supports ?? [])];
  const payoutAccounts = new Map<string, StoredPayoutAccount>(
    (seed?.payoutAccounts ?? []).map((row) => [row.journalistProfileId, { ...row }]),
  );
  const supportCharges: StoredMoneyRow[] = [...(seed?.supportCharges ?? [])];
  const supportLedger: StoredMoneyRow[] = [...(seed?.supportLedger ?? [])];
  const supportReceipts: StoredMoneyRow[] = [...(seed?.supportReceipts ?? [])];
  const transferLedger: StoredMoneyRow[] = [...(seed?.transferLedger ?? [])];
  const deletionRequests: DeletionRequestRow[] = [];
  const exportJobs: StoredExportJob[] = [];
  /**
   * Test seam for the admin-API auth-deletion result. Default 'done' mirrors a
   * configured project; a test flips it to 'skipped-unconfigured' or 'failed' to
   * exercise the visible-skip and retry paths.
   */
  const authDeletion: { behavior: AdminAuthDeletionOutcome; deletedUserIds: string[] } = {
    behavior: 'done',
    deletedUserIds: [],
  };
  let deletionSeq = 0;
  let exportSeq = 0;
  let handleSeq = 0;
  let reportSeq = 0;
  let reportEscalationSeq = 0;
  let dmcaSeq = 0;
  let dmcaCounterSeq = 0;
  let nciiSeq = 0;
  /** Test seam: an explicit override wins; otherwise aggregates are computed from state. */
  const aggregates = new Map<string, EditorAggregates>();

  const isAccepted = (s: StoredSuggestion) => s.status === 'accepted' || s.status === 'partial';

  function computedAggregates(editorProfileId: string): EditorAggregates {
    const mine = [...suggestions.values()].filter((s) => s.editorProfileId === editorProfileId);
    const accepted = mine.filter(isAccepted);
    const decided = mine.filter((s) => isAccepted(s) || s.status === 'rejected');
    const perAuthor = new Map<string, number>();
    for (const s of accepted) {
      const author = articles.get(s.articleId)?.authorProfileId ?? '';
      perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
    }
    const mineIds = new Set(mine.map((s) => s.id));
    return {
      openCount: mine.filter((s) => s.status === 'open').length,
      decidedSampleSize: decided.length,
      acceptanceRate: decided.length === 0 ? 1 : accepted.length / decided.length,
      acceptedTotal: accepted.length,
      acceptedCopyedits: accepted.filter((s) => s.type === 'copyedit').length,
      distinctAuthors: perAuthor.size,
      endorsementsReceived: dupes.filter((d) => mineIds.has(d.originalId)).length,
      maxPairShare:
        accepted.length === 0 ? 0 : Math.max(...perAuthor.values()) / accepted.length,
      // Sanctions land with Phase 5 moderation; baseline standing per C7.
      sanctionsInLast90d: 0,
      authorStanding: 0.5,
    };
  }

  function pushAward(suggestionId: string, award: AwardInput, awardedAt: string) {
    ledger.push({
      editorProfileId: award.editorProfileId,
      suggestionId,
      basePoints: award.basePoints,
      diversityMult: award.diversityMult,
      standingMult: award.standingMult,
      awardedAt,
    });
  }

  function reportTargetExistsInState(kind: ReportTargetKind, targetId: string): boolean {
    if (!isUuid(targetId)) return false;
    switch (kind) {
      case 'article':
      case 'revision':
        return articles.has(targetId);
      case 'suggestion':
        return suggestions.has(targetId);
      case 'profile':
        return profiles.has(targetId);
      case 'media':
        return mediaAssets.has(targetId);
      default:
        return false;
    }
  }

  function resolveDmcaPublicUrl(
    rawUrl: string,
  ): { kind: 'article' | 'suggestion' | 'profile'; id: string } | null {
    let path: string;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') return null;
      path = parsed.pathname.replace(/\/+$/, '') || '/';
    } catch {
      return null;
    }

    // Vocabulary mirrors nw_resolve_public_url in
    // 20260730000002_mynews_dmca_hardening.sql: the routes mynews-web serves
    // (/a/[slug], /a/[slug]/suggestions, /j/[handle], /e/[handle]) plus the
    // legacy /article, /journalist, /profile forms and the /suggestion app
    // deep link. The suggestions list page resolves to its ARTICLE target.
    const articleMatch = path.match(/^\/(?:article|a)\/([a-z0-9-]{3,120})(?:\/suggestions)?$/i);
    if (articleMatch) {
      const token = articleMatch[1]!.toLowerCase();
      for (const article of articles.values()) {
        if (
          article.status !== 'draft' &&
          (article.id.toLowerCase() === token || article.slug.toLowerCase() === token)
        ) {
          return { kind: 'article', id: article.id };
        }
      }
      return null;
    }

    const profileMatch = path.match(/^\/(?:journalist|profile|j|e)\/([a-z0-9_]{3,30})$/i);
    if (profileMatch) {
      const handle = profileMatch[1]!.toLowerCase();
      for (const profile of profiles.values()) {
        if (profile.handle?.toLowerCase() === handle) return { kind: 'profile', id: profile.id };
      }
      return null;
    }

    const suggestionMatch = path.match(/^\/suggestion\/([a-f0-9-]{36})$/i);
    if (suggestionMatch) {
      const suggestion = suggestions.get(suggestionMatch[1]!);
      const article = suggestion ? articles.get(suggestion.articleId) : null;
      if (suggestion && article?.status !== 'draft') {
        return { kind: 'suggestion', id: suggestion.id };
      }
    }
    return null;
  }

  function openNciiCaseForReport(
    reportId: string,
    deadlineHours: number,
    anchorToReport: boolean,
    requireOpen: boolean,
  ): NciiOpenOutcome {
    const report = reports.find((r) => r.id === reportId);
    // Plan 48 WP8: the urgent lane covers every reason in
    // EDGE_REPORT_URGENT_REASONS, not NCII alone. Twin of
    // nw_reconcile_urgent_case in migration 20260730000009, which reads the
    // lane from nw_report_sla. The outcome vocabulary is unchanged, so
    // 'not-ncii' still means "this report does not belong in the urgent lane".
    if (
      !report ||
      !EDGE_REPORT_URGENT_REASONS.includes(report.reason) ||
      (requireOpen && report.status !== 'open')
    ) {
      return 'not-ncii';
    }
    if (nciiCases.some((c) => c.reportId === reportId && c.status !== 'cleared')) {
      return 'exists';
    }

    // A caller-supplied override wins; otherwise the reason's routed SLA is the
    // deadline, so child-safety gets 24 hours and NCII keeps 48.
    const hours = deadlineHours > 0 ? deadlineHours : EDGE_REPORT_SLA_HOURS[report.reason];
    const now = Date.now();
    const reportCreated = Date.parse(report.createdAt);
    const deadlineBase = anchorToReport && Number.isFinite(reportCreated) ? reportCreated : now;
    let status: NciiCaseStatus = 'queued';

    if (report.targetKind === 'article' || report.targetKind === 'revision') {
      const article = articles.get(report.targetId);
      if (article) {
        article.status = 'retracted';
        status = 'removed';
        pushModerationAction({
          reportId,
          moderatorRef: 'ncii-auto',
          action: 'hide_article',
          targetKind: 'article',
          targetId: report.targetId,
          note: 'TAKE IT DOWN: automatic NCII takedown pending human review',
        });
      }
    } else if (report.targetKind === 'suggestion') {
      const suggestion = suggestions.get(report.targetId);
      if (suggestion) {
        suggestion.status = 'rejected';
        status = 'removed';
        pushModerationAction({
          reportId,
          moderatorRef: 'ncii-auto',
          action: 'hide_suggestion',
          targetKind: 'suggestion',
          targetId: report.targetId,
          note: 'TAKE IT DOWN: automatic NCII takedown pending human review',
        });
      }
    }

    nciiSeq += 1;
    const iso = (ms: number) => new Date(ms).toISOString();
    nciiCases.push({
      id: `mem-ncii-${nciiSeq}`,
      reportId,
      targetKind: report.targetKind,
      targetId: report.targetId,
      deadlineAt: iso(deadlineBase + hours * 60 * 60 * 1000),
      status,
      hashMatchStatus: 'pending',
      ncmecRef: null,
      note: '',
      createdAt: iso(now),
      updatedAt: iso(now),
    });
    return 'ok';
  }

  /* ---------------------- key custody twin (plan 48 WP6) ------------------ */
  // Mirrors migration 20260730000008 semantics: return-code priorities, nonce
  // consumption before any mutation, head re-assertion, global active-pubkey
  // uniqueness, revocation precedence, and the escrow/recovery gates. Where the
  // SQL relies on a unique index raising and rolling the transaction back, the
  // twin checks up front instead; the observable outcome is identical
  // ('pubkey-conflict' with nothing mutated).

  const custodyNow = seed?.now ?? (() => Date.now());
  const nowIso = () => new Date(custodyNow()).toISOString();

  interface StoredKeyRow {
    id: string;
    seq: number;
    profileId: string;
    pubkey: string;
    status: 'active' | 'revoked';
    kind: 'primary' | 'device';
    addedVia: ProfileKeyRow['addedVia'];
    proofJson: Record<string, unknown>;
    prevKeyId: string | null;
    validFrom: string;
    revokedAt: string | null;
  }

  let keySeq = 0;
  let keyIdSeq = 0;
  // The SQL ids are uuids, and the handlers validate the shape before spending a
  // store call, so the twin has to mint uuids too or every id-taking action
  // would be untestable through the handler.
  const memUuid = (kind: '4001' | '4002', n: number) =>
    `00000000-0000-${kind}-8000-${String(n).padStart(12, '0')}`;
  const profileKeys: StoredKeyRow[] = [];
  const keyNonces = new Map<
    string,
    {
      nonce: string;
      userId: string;
      profileId: string;
      oldPubkey: string;
      purpose: KeyNoncePurpose;
      createdAtMs: number;
      expiresAtMs: number;
    }
  >();
  const keyEscrow: Array<{
    profileId: string;
    version: number;
    envelope: Record<string, unknown>;
    pubkey: string;
    createdAt: string;
  }> = [];
  // `seq` mirrors the bigserial the SQL table carries: two access events inside
  // one millisecond would tie on createdAt, and an owner-visible security log
  // whose newest row can render below an older one is misleading.
  let escrowAccessSeq = 0;
  const keyEscrowAccess: Array<{
    seq: number;
    profileId: string;
    userId: string;
    action: 'put' | 'get' | 'get-denied';
    version: number | null;
    detail: string;
    createdAtMs: number;
  }> = [];

  function pushEscrowAccess(input: {
    profileId: string;
    userId: string;
    action: 'put' | 'get' | 'get-denied';
    version?: number | null;
    detail: string;
  }): void {
    escrowAccessSeq += 1;
    keyEscrowAccess.push({
      seq: escrowAccessSeq,
      profileId: input.profileId,
      userId: input.userId,
      action: input.action,
      version: input.version ?? null,
      detail: input.detail,
      createdAtMs: custodyNow(),
    });
  }
  const notifyChannels: Array<{ profileId: string; confirmedAt: string | null }> = [
    ...(seed?.notifyChannels ?? []),
  ];
  const recoveryRequests: Array<{
    id: string;
    profileId: string;
    userId: string;
    newPubkey: string;
    cancelTokenHash: string;
    status: RecoveryRequestRow['status'];
    requestedAtMs: number;
    unlocksAtMs: number;
    standing: 'open' | 'verified';
    cancelledAt: string | null;
    completedAt: string | null;
    frozenAt: string | null;
  }> = (seed?.recoveryRequests ?? []).map((r) => ({
    id: r.id,
    profileId: r.profileId,
    userId: r.userId,
    newPubkey: r.newPubkey,
    cancelTokenHash: r.cancelTokenHash,
    status: r.status,
    requestedAtMs: Date.parse(r.requestedAt),
    unlocksAtMs: Date.parse(r.unlocksAt),
    standing: r.standing,
    cancelledAt: null,
    completedAt: null,
    frozenAt: null,
  }));
  const keyEvents: Array<{
    profileId: string;
    kind: string;
    keyId: string | null;
    detail: Record<string, unknown>;
    createdAt: string;
  }> = [];

  const HEX64 = /^[0-9a-f]{64}$/;
  const NONCE_TTL_MS = 300_000;
  const NONCE_WINDOW_MS = 300_000;
  const NONCE_MAX_IN_WINDOW = 10;
  const ESCROW_GETS_PER_DAY = 3;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const RECOVERY_BASELINE_MS = 72 * 60 * 60 * 1000;
  const RECOVERY_VERIFIED_MS = 168 * 60 * 60 * 1000;
  const FREEZE_WINDOW_MS = 90 * DAY_MS;
  const FREEZE_CANCEL_COUNT = 2;

  function insertKeyRow(input: {
    profileId: string;
    pubkey: string;
    kind: 'primary' | 'device';
    addedVia: ProfileKeyRow['addedVia'];
    proofJson?: Record<string, unknown>;
    prevKeyId?: string | null;
    validFrom?: string;
  }): StoredKeyRow {
    keySeq += 1;
    keyIdSeq += 1;
    const row: StoredKeyRow = {
      id: memUuid('4001', keyIdSeq),
      seq: keySeq,
      profileId: input.profileId,
      pubkey: input.pubkey,
      status: 'active',
      kind: input.kind,
      addedVia: input.addedVia,
      proofJson: input.proofJson ?? {},
      prevKeyId: input.prevKeyId ?? null,
      validFrom: input.validFrom ?? nowIso(),
      revokedAt: null,
    };
    profileKeys.push(row);
    return row;
  }

  function activeKeyRow(pubkey: string): StoredKeyRow | undefined {
    return profileKeys.find((k) => k.pubkey === pubkey && k.status === 'active');
  }

  function revokeKeyRow(row: StoredKeyRow): void {
    row.status = 'revoked';
    row.revokedAt = nowIso();
  }

  function pushKeyEvent(
    profileId: string,
    kind: string,
    keyId: string | null,
    detail: Record<string, unknown>,
  ): void {
    keyEvents.push({ profileId, kind, keyId, detail, createdAt: nowIso() });
  }

  function profileByUser(userId: string): StoredProfile | undefined {
    for (const p of profiles.values()) {
      if (p.userId === userId && !p.deletedAt) return p;
    }
    return undefined;
  }

  /** Consume a nonce. Returns null when it is missing, expired, or misbound. */
  function consumeNonce(
    nonce: string,
    userId: string,
    purpose: KeyNoncePurpose,
  ): { profileId: string; oldPubkey: string } | null {
    const row = keyNonces.get(nonce);
    if (!row) return null;
    if (row.userId !== userId || row.purpose !== purpose) return null;
    if (row.expiresAtMs < custodyNow()) return null;
    keyNonces.delete(nonce);
    return { profileId: row.profileId, oldPubkey: row.oldPubkey };
  }

  function assertHead(profileId: string, oldPubkey: string): StoredProfile | null {
    const profile = profiles.get(profileId);
    if (!profile) return null;
    if (profile.deletedAt || profile.pubkeyRevokedAt) return null;
    if (profile.pubkey !== oldPubkey) return null;
    return profile;
  }

  function escrowReadWithin24h(profileId: string): boolean {
    const since = custodyNow() - DAY_MS;
    return keyEscrowAccess.some(
      (a) => a.profileId === profileId && a.action === 'get' && a.createdAtMs >= since,
    );
  }

  function toProfileKeyRow(k: StoredKeyRow): ProfileKeyRow {
    return {
      id: k.id,
      seq: k.seq,
      pubkey: k.pubkey,
      status: k.status,
      kind: k.kind,
      addedVia: k.addedVia,
      validFrom: k.validFrom,
      revokedAt: k.revokedAt,
    };
  }

  // Backfill twin. A profile whose key was cleared or which was anonymized gets
  // NO chain row, so its head can never resolve as an active key.
  for (const p of profiles.values()) {
    if (p.pubkey && p.pubkey !== '' && !p.pubkeyRevokedAt && !p.deletedAt) {
      insertKeyRow({
        profileId: p.id,
        pubkey: p.pubkey,
        kind: 'primary',
        addedVia: 'initial',
        proofJson: { source: 'backfill-in-memory' },
      });
    }
  }
  // Explicit seeds run after the backfill so a seeded revoked/device row can sit
  // alongside the profile's initial row.
  for (const k of seed?.profileKeys ?? []) {
    keySeq += 1;
    profileKeys.push({
      id: k.id,
      seq: keySeq,
      profileId: k.profileId,
      pubkey: k.pubkey,
      status: k.status ?? 'active',
      kind: k.kind ?? 'primary',
      addedVia: k.addedVia ?? 'initial',
      proofJson: {},
      prevKeyId: null,
      validFrom: nowIso(),
      revokedAt: (k.status ?? 'active') === 'revoked' ? nowIso() : null,
    });
  }

  const store: MyNewsStore = {
    async getProfileIdByPubkey(pubkeyHex) {
      for (const p of profiles.values()) if (p.pubkey === pubkeyHex) return p.id;
      return null;
    },
    async getProfileIdByUserId(userId) {
      for (const p of profiles.values()) if (p.userId === userId) return p.id;
      return null;
    },
    async setProfilePubkey(userId, pubkey) {
      let mine: StoredProfile | undefined;
      for (const p of profiles.values()) {
        if (p.userId === userId) mine = p;
      }
      if (!mine) return 'no-profile';
      if (mine.pubkey !== '') return 'already-set';
      for (const p of profiles.values()) {
        if (p.id !== mine.id && p.pubkey === pubkey) return 'pubkey-conflict';
      }
      mine.pubkey = pubkey;
      // Twin of the nw_profiles_key_chain_sync trigger: an initial bind writes
      // the chain row the resolver requires. Without it a freshly registered
      // profile would hold a head that resolves to 'unknown' and could never
      // publish.
      if (!profileKeys.some((k) => k.profileId === mine!.id)) {
        insertKeyRow({
          profileId: mine.id,
          pubkey,
          kind: 'primary',
          addedVia: 'initial',
          proofJson: { source: 'nw_set_profile_pubkey' },
        });
      }
      return 'ok';
    },
    async resolveActiveKey(pubkey) {
      if (!pubkey) return { verdict: 'unknown' };
      const candidates = profileKeys
        .filter((k) => k.pubkey === pubkey)
        .sort((a, b) => {
          const activeDelta = Number(b.status === 'active') - Number(a.status === 'active');
          return activeDelta !== 0 ? activeDelta : b.seq - a.seq;
        });
      const row = candidates[0];
      if (!row) return { verdict: 'unknown' };
      const profile = profiles.get(row.profileId);
      const live = profile && !profile.deletedAt && !profile.pubkeyRevokedAt;
      if (row.status === 'active' && live) {
        return {
          verdict: 'active',
          profileId: row.profileId,
          keyId: row.id,
          kind: row.kind,
        };
      }
      return {
        verdict: 'revoked',
        profileId: row.profileId,
        keyId: row.id,
        kind: row.kind,
      };
    },
    async issueKeyNonce(input) {
      if (!HEX64.test(input.nonce)) return { outcome: 'bad-payload' };
      const profile = profileByUser(input.userId);
      if (!profile) return { outcome: 'no-profile' };
      if (!profile.pubkey || profile.pubkey === '') return { outcome: 'no-active-key' };

      const since = custodyNow() - NONCE_WINDOW_MS;
      let recent = 0;
      for (const row of keyNonces.values()) {
        if (row.userId === input.userId && row.createdAtMs >= since) recent += 1;
      }
      if (recent >= NONCE_MAX_IN_WINDOW) return { outcome: 'rate-limited' };

      for (const [nonce, row] of [...keyNonces.entries()]) {
        if (row.expiresAtMs < custodyNow()) keyNonces.delete(nonce);
      }
      if (keyNonces.has(input.nonce)) return { outcome: 'bad-nonce' };

      const expiresAtMs = custodyNow() + NONCE_TTL_MS;
      keyNonces.set(input.nonce, {
        nonce: input.nonce,
        userId: input.userId,
        profileId: profile.id,
        oldPubkey: profile.pubkey,
        purpose: input.purpose,
        createdAtMs: custodyNow(),
        expiresAtMs,
      });
      return {
        outcome: 'ok',
        nonce: input.nonce,
        profileId: profile.id,
        oldPubkey: profile.pubkey,
        purpose: input.purpose,
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    },
    async rotateProfileKey(input) {
      if (!HEX64.test(input.newPubkey)) return { outcome: 'bad-payload' };
      const spent = consumeNonce(input.nonce, input.userId, 'rotation');
      if (!spent) return { outcome: 'bad-nonce' };
      if (spent.oldPubkey === input.newPubkey) return { outcome: 'same-key' };
      // Global active-pubkey uniqueness, checked before any mutation.
      if (activeKeyRow(input.newPubkey)) return { outcome: 'pubkey-conflict' };

      const profile = assertHead(spent.profileId, spent.oldPubkey);
      if (!profile) return { outcome: 'head-conflict' };

      const oldRow = profileKeys.find(
        (k) => k.profileId === profile.id && k.pubkey === spent.oldPubkey && k.status === 'active',
      );
      for (const k of profileKeys) {
        if (k.profileId === profile.id && k.kind === 'primary' && k.status === 'active') {
          revokeKeyRow(k);
        }
      }
      profile.pubkey = input.newPubkey;
      const newRow = insertKeyRow({
        profileId: profile.id,
        pubkey: input.newPubkey,
        kind: 'primary',
        addedVia: input.addedVia,
        proofJson: input.proof,
        prevKeyId: oldRow?.id ?? null,
      });
      const backupRestore = escrowReadWithin24h(profile.id);
      pushKeyEvent(profile.id, backupRestore ? 'backup_restore' : 'rotation', newRow.id, {
        addedVia: input.addedVia,
        previousPubkey: spent.oldPubkey,
        newPubkey: input.newPubkey,
        followedEscrowRead: backupRestore,
      });
      return {
        outcome: 'ok',
        profileId: profile.id,
        keyId: newRow.id,
        previousKeyId: oldRow?.id,
        backupRestore,
      };
    },
    async approveDeviceKey(input) {
      if (!HEX64.test(input.devicePubkey)) return { outcome: 'bad-payload' };
      const spent = consumeNonce(input.nonce, input.userId, 'device_approval');
      if (!spent) return { outcome: 'bad-nonce' };
      if (activeKeyRow(input.devicePubkey)) return { outcome: 'pubkey-conflict' };

      const profile = assertHead(spent.profileId, spent.oldPubkey);
      if (!profile) return { outcome: 'head-conflict' };

      const parent = profileKeys.find(
        (k) =>
          k.profileId === profile.id &&
          k.pubkey === spent.oldPubkey &&
          k.status === 'active' &&
          k.kind === 'primary',
      );
      if (!parent) return { outcome: 'not-primary' };

      const row = insertKeyRow({
        profileId: profile.id,
        pubkey: input.devicePubkey,
        kind: 'device',
        addedVia: 'device_approval',
        proofJson: input.proof,
        prevKeyId: parent.id,
      });
      pushKeyEvent(profile.id, 'device_approval', row.id, {
        devicePubkey: input.devicePubkey,
        approvedBy: spent.oldPubkey,
      });
      return { outcome: 'ok', profileId: profile.id, keyId: row.id };
    },
    async revokeProfileKey(input) {
      const spent = consumeNonce(input.nonce, input.userId, 'revocation');
      if (!spent) return { outcome: 'bad-nonce' };

      const actor = profileKeys.find(
        (k) =>
          k.profileId === spent.profileId && k.pubkey === spent.oldPubkey && k.status === 'active',
      );
      if (!actor) return { outcome: 'no-active-key' };

      const target = profileKeys.find((k) => k.id === input.targetKeyId);
      if (!target) return { outcome: 'unknown-key' };
      if (target.profileId !== spent.profileId) return { outcome: 'not-your-key' };
      if (target.status !== 'active') return { outcome: 'already-revoked' };
      if (target.kind === 'primary') return { outcome: 'use-rotation-for-primary' };
      // Device vs device: only the OLDER active key wins. Revoking yourself is
      // always allowed (the lost-device case), which is why the seq comparison
      // is skipped when actor and target are the same row.
      if (actor.kind === 'device' && actor.id !== target.id && actor.seq > target.seq) {
        return { outcome: 'revoke-precedence' };
      }

      revokeKeyRow(target);
      pushKeyEvent(spent.profileId, 'revocation', target.id, {
        revokedPubkey: target.pubkey,
        revokedKind: target.kind,
        revokedBy: spent.oldPubkey,
      });
      return { outcome: 'ok', keyId: target.id };
    },
    async escrowPutKit(input) {
      if (!HEX64.test(input.pubkey)) return { outcome: 'bad-payload' };
      if (typeof input.envelope !== 'object' || input.envelope === null) {
        return { outcome: 'bad-payload' };
      }
      const spent = consumeNonce(input.nonce, input.userId, 'escrow_put');
      if (!spent) return { outcome: 'bad-nonce' };

      const version =
        keyEscrow
          .filter((e) => e.profileId === spent.profileId)
          .reduce((max, e) => Math.max(max, e.version), 0) + 1;
      keyEscrow.push({
        profileId: spent.profileId,
        version,
        envelope: input.envelope,
        pubkey: input.pubkey,
        createdAt: nowIso(),
      });
      // Keep the newest 3 versions; never a blind overwrite.
      for (let i = keyEscrow.length - 1; i >= 0; i -= 1) {
        const row = keyEscrow[i]!;
        if (row.profileId === spent.profileId && row.version <= version - 3) {
          keyEscrow.splice(i, 1);
        }
      }
      pushEscrowAccess({
        profileId: spent.profileId,
        userId: input.userId,
        action: 'put',
        version,
        detail: 'recovery kit escrowed',
      });
      return { outcome: 'ok', version };
    },
    async escrowGetKit(userId) {
      const profile = profileByUser(userId);
      if (!profile) return { outcome: 'no-profile' };

      const since = custodyNow() - DAY_MS;
      const recent = keyEscrowAccess.filter(
        (a) => a.profileId === profile.id && a.action === 'get' && a.createdAtMs >= since,
      ).length;
      if (recent >= ESCROW_GETS_PER_DAY) {
        pushEscrowAccess({
          profileId: profile.id,
          userId,
          action: 'get-denied',
          detail: 'daily escrow read limit reached',
        });
        return { outcome: 'rate-limited' };
      }

      const latest = keyEscrow
        .filter((e) => e.profileId === profile.id)
        .sort((a, b) => b.version - a.version)[0];
      if (!latest) {
        pushEscrowAccess({
          profileId: profile.id,
          userId,
          action: 'get-denied',
          detail: 'no escrowed kit',
        });
        return { outcome: 'no-kit' };
      }

      pushEscrowAccess({
        profileId: profile.id,
        userId,
        action: 'get',
        version: latest.version,
        detail: 'recovery kit read',
      });
      return {
        outcome: 'ok',
        version: latest.version,
        envelope: latest.envelope,
        pubkey: latest.pubkey,
      };
    },
    async requestKeyRecovery(input) {
      if (!HEX64.test(input.newPubkey) || !HEX64.test(input.cancelTokenHash)) {
        return { outcome: 'bad-payload' };
      }
      const profile = profileByUser(input.userId);
      if (!profile) return { outcome: 'no-profile' };
      if (!profile.pubkey || profile.pubkey === '') return { outcome: 'no-active-key' };
      if (activeKeyRow(input.newPubkey)) return { outcome: 'pubkey-conflict' };

      // Gate 1: the notification channel. Always fails on a real deployment.
      if (!notifyChannels.some((c) => c.profileId === profile.id && c.confirmedAt)) {
        return { outcome: 'notification-channel-required' };
      }
      // Gate 2: contested-custody freeze.
      const freezeSince = custodyNow() - FREEZE_WINDOW_MS;
      const cancels = recoveryRequests.filter(
        (r) =>
          r.profileId === profile.id &&
          (r.status === 'cancelled' || r.status === 'frozen') &&
          r.requestedAtMs >= freezeSince,
      ).length;
      if (cancels >= FREEZE_CANCEL_COUNT) return { outcome: 'recovery-frozen' };

      if (recoveryRequests.some((r) => r.profileId === profile.id && r.status === 'pending')) {
        return { outcome: 'already-pending' };
      }

      const standing = journalists.get(profile.id) ?? 'open';
      const unlocksAtMs =
        custodyNow() + (standing === 'verified' ? RECOVERY_VERIFIED_MS : RECOVERY_BASELINE_MS);
      const id = memUuid('4002', recoveryRequests.length + 1);
      recoveryRequests.push({
        id,
        profileId: profile.id,
        userId: input.userId,
        newPubkey: input.newPubkey,
        cancelTokenHash: input.cancelTokenHash,
        status: 'pending',
        requestedAtMs: custodyNow(),
        unlocksAtMs,
        standing,
        cancelledAt: null,
        completedAt: null,
        frozenAt: null,
      });
      const unlocksAt = new Date(unlocksAtMs).toISOString();
      pushKeyEvent(profile.id, 'recovery_requested', null, {
        newPubkey: input.newPubkey,
        standing,
        unlocksAt,
      });
      return { outcome: 'ok', requestId: id, unlocksAt, standing };
    },
    async cancelKeyRecovery(input) {
      const request = recoveryRequests.find((r) => r.id === input.requestId);
      if (!request) return { outcome: 'unknown-request' };
      if (request.status !== 'pending') return { outcome: 'not-pending' };

      let actor: string;
      if (input.cancelTokenHash !== undefined) {
        if (input.cancelTokenHash !== request.cancelTokenHash) {
          return { outcome: 'bad-cancel-token' };
        }
        actor = 'cancel-token';
      } else if (input.userId !== undefined && input.nonce !== undefined) {
        const spent = consumeNonce(input.nonce, input.userId, 'revocation');
        if (!spent || spent.profileId !== request.profileId) return { outcome: 'bad-nonce' };
        const holder = profileKeys.find(
          (k) =>
            k.profileId === request.profileId &&
            k.pubkey === spent.oldPubkey &&
            k.status === 'active',
        );
        if (!holder) return { outcome: 'no-active-key' };
        actor = 'active-key';
      } else {
        return { outcome: 'bad-payload' };
      }

      const freezeSince = custodyNow() - FREEZE_WINDOW_MS;
      const prior = recoveryRequests.filter(
        (r) =>
          r.profileId === request.profileId &&
          (r.status === 'cancelled' || r.status === 'frozen') &&
          r.requestedAtMs >= freezeSince,
      ).length;
      const status: 'cancelled' | 'frozen' =
        prior + 1 >= FREEZE_CANCEL_COUNT ? 'frozen' : 'cancelled';
      request.status = status;
      request.cancelledAt = nowIso();
      request.frozenAt = status === 'frozen' ? nowIso() : null;

      pushKeyEvent(request.profileId, 'recovery_cancelled', null, {
        requestId: request.id,
        cancelledBy: actor,
      });
      if (status === 'frozen') {
        pushKeyEvent(request.profileId, 'recovery_frozen', null, {
          requestId: request.id,
          windowDays: 90,
          reason:
            'contested custody: recovery without a kit is frozen; the kit path still works',
        });
      }
      return { outcome: 'ok', status };
    },
    async completeKeyRecovery(input) {
      const spent = consumeNonce(input.nonce, input.userId, 'recovery_complete');
      if (!spent) return { outcome: 'bad-nonce' };

      const request = recoveryRequests.find(
        (r) => r.id === input.requestId && r.profileId === spent.profileId,
      );
      if (!request) return { outcome: 'unknown-request' };
      if (request.status !== 'pending') return { outcome: 'not-pending' };
      if (request.unlocksAtMs > custodyNow()) {
        return { outcome: 'still-locked' };
      }
      if (request.newPubkey !== input.newPubkey) {
        return { outcome: 'pubkey-not-precommitted' };
      }
      if (activeKeyRow(input.newPubkey)) return { outcome: 'pubkey-conflict' };

      const profile = assertHead(spent.profileId, spent.oldPubkey);
      if (!profile) return { outcome: 'head-conflict' };

      const oldRow = profileKeys.find(
        (k) => k.profileId === profile.id && k.pubkey === spent.oldPubkey && k.status === 'active',
      );
      // ALL prior keys, primary and device: recovery is the lost-everything path.
      for (const k of profileKeys) {
        if (k.profileId === profile.id && k.status === 'active') revokeKeyRow(k);
      }
      profile.pubkey = input.newPubkey;
      const newRow = insertKeyRow({
        profileId: profile.id,
        pubkey: input.newPubkey,
        kind: 'primary',
        addedVia: 'recovery',
        proofJson: input.proof,
        prevKeyId: oldRow?.id ?? null,
      });
      request.status = 'completed';
      request.completedAt = nowIso();
      pushKeyEvent(profile.id, 'recovery_completed', newRow.id, {
        requestId: request.id,
        newPubkey: input.newPubkey,
        previousPubkey: spent.oldPubkey,
        standing: request.standing,
      });
      return { outcome: 'ok', profileId: profile.id, keyId: newRow.id };
    },
    async getKeyCustodyStatus(userId) {
      const profile = profileByUser(userId);
      if (!profile) return { outcome: 'no-profile' };
      const latest = [...recoveryRequests]
        .filter((r) => r.profileId === profile.id)
        .sort((a, b) => b.requestedAtMs - a.requestedAtMs)[0];
      const freezeSince = custodyNow() - FREEZE_WINDOW_MS;
      return {
        outcome: 'ok',
        profileId: profile.id,
        headPubkey: profile.pubkey ?? '',
        keys: profileKeys
          .filter((k) => k.profileId === profile.id)
          .sort((a, b) => b.seq - a.seq)
          .map(toProfileKeyRow),
        escrow: keyEscrow
          .filter((e) => e.profileId === profile.id)
          .sort((a, b) => b.version - a.version)
          .map((e) => ({ version: e.version, pubkey: e.pubkey, createdAt: e.createdAt })),
        escrowAccess: keyEscrowAccess
          .filter((a) => a.profileId === profile.id)
          .sort((a, b) => b.seq - a.seq)
          .slice(0, 20)
          .map((a) => ({
            action: a.action,
            version: a.version,
            detail: a.detail,
            createdAt: new Date(a.createdAtMs).toISOString(),
          })),
        notificationChannelConfirmed: notifyChannels.some(
          (c) => c.profileId === profile.id && c.confirmedAt,
        ),
        recovery: latest
          ? {
              id: latest.id,
              status: latest.status,
              newPubkey: latest.newPubkey,
              requestedAt: new Date(latest.requestedAtMs).toISOString(),
              unlocksAt: new Date(latest.unlocksAtMs).toISOString(),
              standing: latest.standing,
            }
          : null,
        recoveryFrozen: recoveryRequests.some(
          (r) =>
            r.profileId === profile.id && r.status === 'frozen' && r.requestedAtMs >= freezeSince,
        ),
      };
    },
    async getProfilePubkeys(profileIds) {
      const out: Record<string, string> = {};
      for (const id of profileIds) {
        const p = profiles.get(id);
        if (p) out[id] = p.pubkey;
      }
      return out;
    },
    async getArticleHead(articleId) {
      const a = articles.get(articleId);
      if (!a) return null;
      return {
        id: a.id,
        slug: a.slug,
        kind: a.kind,
        status: a.status,
        authorProfileId: a.authorProfileId,
        authorPubkey: a.authorPubkey,
        authorTier: journalists.get(a.authorProfileId) ?? 'open',
        newsroomId: a.newsroomId ?? null,
        currentRev: a.currentRev,
      };
    },
    async slugTaken(slug) {
      for (const a of articles.values()) if (a.slug === slug) return true;
      return false;
    },
    async publishArticle(record) {
      const draft = record.article.draft ?? false;
      const existing = articles.get(record.article.id);
      if (!existing) {
        // RPC check order: rev, then draft payload, then slug.
        if (record.revision.rev !== 1) return 'rev-conflict';
        if (draft && !record.article.newsroomId) return 'bad-payload';
        if (await store.slugTaken(record.article.slug)) return 'slug-conflict';
        articles.set(record.article.id, {
          id: record.article.id,
          slug: record.article.slug,
          kind: record.article.kind,
          status: draft ? 'draft' : 'published',
          authorProfileId: record.article.authorProfileId,
          authorPubkey: record.revision.signerPubkey,
          currentRev: 1,
          newsroomId: record.article.newsroomId ?? null,
          publishedAt: draft ? null : record.publishedAtIso,
        });
      } else {
        if (record.revision.rev !== existing.currentRev + 1) return 'rev-conflict';
        // A4: a held revision may occupy this exact slot. Replace it instead of
        // colliding, and clear the article now that a clean revision advances
        // the head (matches nw_publish_article in 20260730000014).
        if (
          quarantinedRevisions.some(
            (q) => q.articleId === record.article.id && q.rev === record.revision.rev,
          )
        ) {
          removeWhere(
            revisions,
            (r) => r.articleId === record.article.id && r.rev === record.revision.rev,
          );
          removeWhere(
            quarantinedRevisions,
            (q) => q.articleId === record.article.id && q.rev === record.revision.rev,
          );
          existing.screeningStatus = 'cleared';
        }
        if (!draft && existing.status === 'draft') {
          // Publish-the-draft: status flip + published_at stamp ride the
          // same write as the head bump.
          existing.status = 'published';
          existing.publishedAt = record.publishedAtIso;
        }
        // draft=true never demotes an already published article.
        existing.currentRev = record.revision.rev;
      }
      revisions.push(record.revision);
      return 'ok';
    },
    async insertSuggestion(record) {
      if (!articles.has(record.articleId)) return 'unknown-article';
      suggestions.set(record.id, { ...record, status: 'open' });
      return 'ok';
    },
    async getSuggestion(id) {
      return suggestions.get(id) ?? null;
    },
    async countRecentSuggestions(editorProfileId, sinceIso) {
      return [...suggestions.values()].filter(
        (s) => s.editorProfileId === editorProfileId && s.createdAt >= sinceIso,
      ).length;
    },
    async getOpenSuggestionsForArticle(articleId, baseRev) {
      // created_at ascending, mirroring the postgrest impl: the oldest
      // near-dupe match is the collapse original.
      return [...suggestions.values()]
        .filter((s) => s.articleId === articleId && s.baseRev === baseRev && s.status === 'open')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
        .map((s) => ({
          id: s.id,
          editorProfileId: s.editorProfileId,
          type: s.type,
          diffJson: s.diffJson,
          baseRev: s.baseRev,
        }));
    },
    async insertDupeEndorsement(input) {
      const exists = dupes.some(
        (d) => d.originalId === input.originalId && d.endorserId === input.endorserId,
      );
      if (!exists) {
        dupes.push({
          originalId: input.originalId,
          endorserId: input.endorserId,
          similarity: input.similarity,
        });
      }
      return 'ok';
    },
    async getEditorAggregates(editorProfileId) {
      return aggregates.get(editorProfileId) ?? computedAggregates(editorProfileId);
    },
    async getCredibilityLedger(editorProfileId) {
      // Newest-first, mirroring the postgrest impl's awarded_at.desc order.
      return ledger
        .filter((r) => r.editorProfileId === editorProfileId)
        .sort((a, b) => (a.awardedAt < b.awardedAt ? 1 : a.awardedAt > b.awardedAt ? -1 : 0));
    },
    async getNewsroomRole(newsroomId, profileId) {
      const row = newsroomMembers.find(
        (m) => m.newsroomId === newsroomId && m.profileId === profileId,
      );
      return row?.role ?? null;
    },
    async acceptSuggestion(record) {
      const s = suggestions.get(record.suggestionId);
      if (!s || s.status !== 'open') return 'not-open';
      const head = articles.get(s.articleId);
      if (!head || record.revision.rev !== head.currentRev + 1) return 'rev-conflict';
      head.currentRev = record.revision.rev;
      revisions.push(record.revision);
      s.status = record.decision === 'accept' ? 'accepted' : 'partial';
      events.push({
        suggestionId: s.id,
        actorProfileId: record.actorProfileId,
        action: record.decision,
        payload: { rev: record.revision.rev },
      });
      pushAward(s.id, record.award, new Date().toISOString());
      return 'ok';
    },
    async acceptSuggestionsBatch(record) {
      // Mirror the RPC exactly: every check runs before the first write, in
      // the SQL's order (not-open > mixed-articles > rev-conflict > bad-award).
      const inputIds = record.suggestionIds;
      if (!inputIds || inputIds.length === 0) return 'not-open';
      // The FOR UPDATE scan returns each existing row once, ordered by id, so
      // duplicated input ids also fail the cardinality check as 'not-open'.
      const found = [...new Set(inputIds)]
        .map((id) => suggestions.get(id))
        .filter((s): s is StoredSuggestion => s !== undefined)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      if (found.length !== inputIds.length || found.some((s) => s.status !== 'open')) {
        return 'not-open';
      }
      if (new Set(found.map((s) => s.articleId)).size > 1) return 'mixed-articles';
      const head = articles.get(found[0]!.articleId);
      if (!head) {
        // FK-impossible in SQL (suggestions reference articles); the RPC
        // would raise, so a bad seed should fail loudly here too.
        throw new Error('acceptSuggestionsBatch: suggestion references a missing article');
      }
      if (record.revision.rev !== head.currentRev + 1) return 'rev-conflict';
      for (const s of found) {
        const award = record.awards[s.id];
        if (
          award == null ||
          award.editorProfileId == null ||
          award.basePoints == null ||
          award.diversityMult == null ||
          award.standingMult == null
        ) {
          return 'bad-award';
        }
      }
      // Validation complete; first write below. A failing batch above leaves
      // state untouched, matching the RPC's check-before-mutate ordering.
      head.currentRev = record.revision.rev;
      revisions.push(record.revision);
      const awardedAt = new Date().toISOString();
      for (const s of found) {
        s.status = 'accepted';
        events.push({
          suggestionId: s.id,
          actorProfileId: record.actorProfileId,
          action: 'accept',
          payload: { rev: record.revision.rev },
        });
        pushAward(s.id, record.awards[s.id]!, awardedAt);
      }
      return 'ok';
    },
    async rejectSuggestion(suggestionId, actorProfileId, note) {
      const s = suggestions.get(suggestionId);
      if (!s || s.status !== 'open') return 'not-open';
      s.status = 'rejected';
      events.push({
        suggestionId,
        actorProfileId,
        action: 'reject',
        payload: note != null ? { note } : {},
      });
      return 'ok';
    },
    async upsertArticleMeta(record) {
      if (record.signature === '' || record.signerPubkey === '') return 'bad-payload';
      articleMeta.set(record.articleId, { ...record });
      return 'ok';
    },
    async reportTargetExists(kind, targetId) {
      return reportTargetExistsInState(kind, targetId);
    },
    async countRecentReports(reporterProfileId, sinceIso) {
      return reports.filter(
        (r) => r.reporterProfileId === reporterProfileId && r.createdAt >= sinceIso,
      ).length;
    },
    async countRecentSuggestionComments(actorProfileId, sinceIso) {
      return events.filter(
        (e) =>
          e.action === 'comment' &&
          e.actorProfileId === actorProfileId &&
          (e.createdAt ?? '') >= sinceIso,
      ).length;
    },
    async insertSuggestionComment(input) {
      // Mirrors nw_insert_suggestion_comment (migration 20260730000003) in
      // check order: payload bounds, then suggestion, then actor.
      if (
        typeof input.body !== 'string' ||
        input.body.length < EDGE_MYNEWS_BOUNDS.COMMENT_MIN_CHARS ||
        input.body.length > EDGE_MYNEWS_BOUNDS.COMMENT_MAX_CHARS
      ) {
        return 'bad-payload';
      }
      if (!suggestions.has(input.suggestionId)) return 'unknown-suggestion';
      if (!profiles.has(input.actorProfileId)) return 'unknown-actor';
      events.push({
        suggestionId: input.suggestionId,
        actorProfileId: input.actorProfileId,
        action: 'comment',
        payload: { body: input.body },
        createdAt: new Date().toISOString(),
      });
      return 'ok';
    },
    async hasOpenReport(reporterProfileId, kind, targetId) {
      return reports.some(
        (r) =>
          r.reporterProfileId === reporterProfileId &&
          r.targetKind === kind &&
          r.targetId === targetId &&
          r.status === 'open',
      );
    },
    async insertReport(record) {
      reportSeq += 1;
      reports.push({
        ...record,
        id: `mem-report-${reportSeq}`,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      return 'ok';
    },
    async submitReport(input) {
      if (!reportTargetExistsInState(input.targetKind, input.targetId)) return 'bad-target';
      if (!profiles.has(input.reporterProfileId)) {
        throw new Error('nw_submit_report: reporter profile not found');
      }

      const existing = reports.find(
        (report) =>
          report.reporterProfileId === input.reporterProfileId &&
          report.targetKind === input.targetKind &&
          report.targetId === input.targetId &&
          report.status === 'open',
      );
      if (
        existing &&
        REPORT_SEVERITY_RANK[existing.reason] >= REPORT_SEVERITY_RANK[input.reason]
      ) {
        return 'already-reported';
      }

      const reportsBefore = reports.map((report) => ({ ...report }));
      const reportEscalationsLength = reportEscalations.length;
      const moderationActionsLength = moderationActions.length;
      const nciiCasesLength = nciiCases.length;
      const reportSeqBefore = reportSeq;
      const reportEscalationSeqBefore = reportEscalationSeq;
      const moderationSeqBefore = moderationSeq;
      const nciiSeqBefore = nciiSeq;
      const article = articles.get(input.targetId);
      const articleStatusBefore = article?.status;
      const suggestion = suggestions.get(input.targetId);
      const suggestionStatusBefore = suggestion?.status;

      try {
        let report: StoredReport;
        let outcome: ReportSubmitOutcome = 'submitted';

        if (existing) {
          const priorReason = existing.reason;
          const priorDetail = existing.detail;
          existing.reason = input.reason;
          existing.detail = `${priorDetail}\n---escalated---\n${input.detail}`;
          reportEscalationSeq += 1;
          reportEscalations.push({
            id: `mem-report-escalation-${reportEscalationSeq}`,
            reportId: existing.id,
            fromReason: priorReason,
            toReason: input.reason,
            priorDetail,
            escalatedDetail: input.detail,
            createdAt: new Date().toISOString(),
          });
          report = existing;
          outcome = 'escalated';
        } else {
          reportSeq += 1;
          report = {
            ...input,
            id: `mem-report-${reportSeq}`,
            status: 'open',
            createdAt: new Date().toISOString(),
          };
          reports.push(report);
        }

        if (EDGE_REPORT_URGENT_REASONS.includes(input.reason)) {
          // 0 means "use the routed SLA for this reason" (24h child-safety,
          // 48h ncii), matching nw_reconcile_urgent_case reading nw_report_sla.
          const urgentOutcome = openNciiCaseForReport(report.id, 0, true, true);
          if (urgentOutcome !== 'ok' && urgentOutcome !== 'exists') {
            throw new Error(`nw_submit_report: urgent case creation failed (${urgentOutcome})`);
          }
        }

        return outcome;
      } catch (error) {
        reports.splice(0, reports.length, ...reportsBefore);
        reportEscalations.length = reportEscalationsLength;
        moderationActions.length = moderationActionsLength;
        nciiCases.length = nciiCasesLength;
        reportSeq = reportSeqBefore;
        reportEscalationSeq = reportEscalationSeqBefore;
        moderationSeq = moderationSeqBefore;
        nciiSeq = nciiSeqBefore;
        if (article && articleStatusBefore != null) article.status = articleStatusBefore;
        if (suggestion && suggestionStatusBefore != null) suggestion.status = suggestionStatusBefore;
        throw error;
      }
    },
    async getOpenReportId(reporterProfileId, kind, targetId) {
      const row = reports.find(
        (r) =>
          r.reporterProfileId === reporterProfileId &&
          r.targetKind === kind &&
          r.targetId === targetId &&
          r.status === 'open',
      );
      return row?.id ?? null;
    },
    async getMyReports(reporterProfileId) {
      return reports
        .filter((r) => r.reporterProfileId === reporterProfileId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
    async isProfileSuspended(profileId, nowIso) {
      const until = profiles.get(profileId)?.suspendedUntil;
      return until != null && until > nowIso;
    },
    async hasAcceptedTerms(userId, version) {
      return termsAcceptances.has(`${userId}::${version}`);
    },
    async getMyModerationNotices(userId) {
      // Resolve the auth user id to its profile, then return only the audit
      // rows whose target the caller owns. 'dismiss'/'restore' are not adverse
      // actions against the user, so they are not statements of reasons.
      const ownProfileIds = new Set(
        [...profiles.values()].filter((p) => p.userId === userId).map((p) => p.id),
      );
      if (ownProfileIds.size === 0) return [];
      const ownsTarget = (a: ModerationActionRow): boolean => {
        if (a.targetKind === 'article' || a.targetKind === 'revision') {
          const art = articles.get(a.targetId);
          return !!art && ownProfileIds.has(art.authorProfileId);
        }
        if (a.targetKind === 'suggestion') {
          const s = suggestions.get(a.targetId);
          return !!s && ownProfileIds.has(s.editorProfileId);
        }
        if (a.targetKind === 'profile') {
          return ownProfileIds.has(a.targetId);
        }
        return false;
      };
      return moderationActions
        .filter((a) => a.action !== 'dismiss' && a.action !== 'restore')
        .filter(ownsTarget)
        .sort((x, y) =>
          (x.createdAt ?? '') < (y.createdAt ?? '')
            ? 1
            : (x.createdAt ?? '') > (y.createdAt ?? '')
              ? -1
              : 0,
        )
        .map((a) => {
          const profileId = [...ownProfileIds][0] ?? '';
          const appeal = a.id ? moderationAppeals.get(`${a.id}::${profileId}`) : undefined;
          return {
            targetKind: a.targetKind,
            targetId: a.targetId,
            machineReason: a.action,
            note: a.note,
            createdAt: a.createdAt ?? '',
            actionId: a.id ?? null,
            appealState: appeal?.state ?? ('none' as const),
            appealReason: appeal?.reason ?? '',
            appealDecisionReason: appeal?.decisionReason ?? '',
            appealReversalOutcome: appeal?.reversalOutcome ?? null,
            appealDecidedAt: appeal?.decidedAt ?? null,
          };
        });
    },
    async appealModerationAction(input) {
      const reason = input.reason.trim();
      if (reason === '' || reason.length > 2000) return 'bad-reason';
      const profile = [...profiles.values()].find((p) => p.id === input.appellantProfileId);
      if (!profile) return 'not-found';
      const action = moderationActions.find((row) => row.id === input.actionId);
      if (!action) return 'not-found';
      if (action.action === 'dismiss' || action.action === 'restore') return 'not-appealable';
      // Ownership, mirroring the three branches nw_moderation_action_is_owned uses.
      const owns =
        action.targetKind === 'article' || action.targetKind === 'revision'
          ? articles.get(action.targetId)?.authorProfileId === profile.id
          : action.targetKind === 'suggestion'
            ? suggestions.get(action.targetId)?.editorProfileId === profile.id
            : action.targetKind === 'profile'
              ? action.targetId === profile.id
              : false;
      // Someone else's action answers exactly like a missing one.
      if (!owns) return 'not-found';
      const key = `${input.actionId}::${profile.id}`;
      if (moderationAppeals.has(key)) return 'already-appealed';
      moderationAppeals.set(key, {
        actionId: input.actionId,
        profileId: profile.id,
        reason,
        state: 'requested',
        decisionReason: '',
        reversalOutcome: null,
        decidedAt: null,
      });
      return 'ok';
    },
    async getOpenReportQueue(limit) {
      const latestHeadline = (articleId: string): string => {
        let best: PublishRecord['revision'] | undefined;
        for (const rev of revisions) {
          if (rev.articleId === articleId && (!best || rev.rev > best.rev)) best = rev;
        }
        return best?.headline ?? '';
      };
      return reports
        .filter((r) => r.status === 'open')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .slice(0, limit)
        .map((r) => {
          let targetContext: ReportQueueItem['targetContext'] = null;
          if (r.targetKind === 'article' || r.targetKind === 'revision') {
            const a = articles.get(r.targetId);
            if (a) {
              targetContext = {
                kind: 'article',
                slug: a.slug,
                status: a.status,
                authorProfileId: a.authorProfileId,
                headline: latestHeadline(a.id),
              };
            }
          } else if (r.targetKind === 'suggestion') {
            const s = suggestions.get(r.targetId);
            if (s) {
              targetContext = {
                kind: 'suggestion',
                articleId: s.articleId,
                status: s.status,
                editorProfileId: s.editorProfileId,
                rationale: s.rationale,
              };
            }
          } else if (r.targetKind === 'profile') {
            const p = profiles.get(r.targetId);
            if (p) {
              targetContext = {
                kind: 'profile',
                handle: p.handle ?? '',
                suspendedUntil: p.suspendedUntil ?? null,
              };
            }
          } else if (r.targetKind === 'media') {
            targetContext = { kind: 'media', ref: r.targetId };
          }
          return {
            id: r.id,
            reporterProfileId: r.reporterProfileId,
            targetKind: r.targetKind,
            targetId: r.targetId,
            reason: r.reason,
            detail: r.detail,
            createdAt: r.createdAt,
            targetContext,
          };
        });
    },
    async moderateHideArticle(input) {
      if (input.moderatorRef.trim() === '') return 'bad-moderator';
      const a = articles.get(input.articleId);
      if (!a) return 'not-found';
      a.status = 'retracted';
      pushModerationAction({
        reportId: input.reportId ?? null,
        moderatorRef: input.moderatorRef,
        action: 'hide_article',
        targetKind: 'article',
        targetId: input.articleId,
        note: input.note,
      });
      return 'ok';
    },
    async moderateHideSuggestion(input) {
      if (input.moderatorRef.trim() === '') return 'bad-moderator';
      const s = suggestions.get(input.suggestionId);
      if (!s) return 'not-found';
      s.status = 'rejected';
      pushModerationAction({
        reportId: input.reportId ?? null,
        moderatorRef: input.moderatorRef,
        action: 'hide_suggestion',
        targetKind: 'suggestion',
        targetId: input.suggestionId,
        note: input.note,
      });
      return 'ok';
    },
    async moderateSuspendProfile(input) {
      if (input.moderatorRef.trim() === '') return 'bad-moderator';
      const p = profiles.get(input.profileId);
      if (!p) return 'not-found';
      p.suspendedUntil = input.until;
      pushModerationAction({
        reportId: input.reportId ?? null,
        moderatorRef: input.moderatorRef,
        action: input.until === null ? 'restore' : 'suspend_profile',
        targetKind: 'profile',
        targetId: input.profileId,
        note: input.note,
      });
      return 'ok';
    },
    async moderateResolveReport(input) {
      if (input.moderatorRef.trim() === '') return 'bad-moderator';
      if (input.status !== 'actioned' && input.status !== 'no_action') return 'bad-status';
      const r = reports.find((row) => row.id === input.reportId && row.status === 'open');
      if (!r) return 'not-open';
      r.status = input.status;
      pushModerationAction({
        reportId: input.reportId,
        moderatorRef: input.moderatorRef,
        action: input.status === 'no_action' ? 'dismiss' : 'restore',
        targetKind: r.targetKind,
        targetId: r.targetId,
        note: input.note,
      });
      return 'ok';
    },
    async consumeDmcaRateLimit(input) {
      if (
        !/^[a-f0-9]{64}$/.test(input.rateKey) ||
        !/^[a-f0-9]{64}$/.test(input.ipHash) ||
        !/^[a-f0-9]{64}$/.test(input.emailHash)
      ) {
        return 'bad-key';
      }
      // Token bucket twin of nw_consume_dmca_rate_limit: capacity 5, one
      // token refills every 120 seconds.
      const capacity = 5;
      const refillMs = 120_000;
      const existing = dmcaRateCounters.get(input.rateKey);
      if (!existing) {
        dmcaRateCounters.set(input.rateKey, {
          ipHash: input.ipHash,
          emailHash: input.emailHash,
          tokens: capacity - 1,
          lastRefillMs: input.nowMs,
        });
        return 'allowed';
      }
      const elapsed = Math.max(0, input.nowMs - existing.lastRefillMs);
      existing.tokens = Math.min(capacity, existing.tokens + elapsed / refillMs);
      existing.lastRefillMs = input.nowMs;
      if (existing.tokens < 1) return 'rate-limited';
      existing.tokens -= 1;
      return 'allowed';
    },
    async submitDmcaTakedown(record) {
      if (
        record.complainantName.trim() === '' ||
        record.complainantEmail.trim() === '' ||
        record.copyrightedWork.trim() === '' ||
        record.infringingUrl.trim() === '' ||
        record.signature.trim() === '' ||
        record.goodFaithAttestationVersion !== DMCA_ATTESTATION_VERSION ||
        record.accuracyAttestationVersion !== DMCA_ATTESTATION_VERSION ||
        record.goodFaithAttestationText !== DMCA_TAKEDOWN_GOOD_FAITH_TEXT ||
        record.accuracyAttestationText !== DMCA_TAKEDOWN_ACCURACY_TEXT
      ) {
        return { outcome: 'bad-payload' };
      }
      const resolved = resolveDmcaPublicUrl(record.infringingUrl);
      const nowIso = new Date().toISOString();
      dmcaSeq += 1;
      const noticeId = `mem-dmca-${dmcaSeq}`;
      let reportId: string | null = null;
      if (resolved) {
        reportSeq += 1;
        reportId = `mem-report-${reportSeq}`;
        reports.push({
          reporterProfileId: record.submitterProfileId ?? '',
          targetKind: resolved.kind,
          targetId: resolved.id,
          reason: 'copyright',
          detail: `DMCA takedown: ${record.copyrightedWork.slice(0, 500)}`,
          id: reportId,
          status: 'open',
          createdAt: nowIso,
        });
      }
      dmcaNotices.push({
        ...record,
        id: noticeId,
        reportId,
        targetKind: resolved?.kind ?? null,
        targetId: resolved?.id ?? null,
        status: resolved ? 'received' : 'needs_resolution',
        createdAt: nowIso,
      });
      return {
        outcome: 'ok',
        referenceId: noticeId,
        resolutionStatus: resolved ? 'resolved' : 'needs-resolution',
        targetKind: resolved?.kind ?? null,
        targetId: resolved?.id ?? null,
        queueVisible: dmcaNotices.some((notice) => notice.id === noticeId),
      };
    },
    async submitDmcaCounterNotice(record) {
      if (
        record.counterNotifierName.trim() === '' ||
        record.counterNotifierAddress.trim() === '' ||
        record.counterNotifierPhone.trim() === '' ||
        record.counterNotifierEmail.trim() === '' ||
        record.removedMaterial.trim() === '' ||
        record.materialLocationBeforeRemoval.trim() === '' ||
        record.signature.trim() === '' ||
        record.mistakeAttestationVersion !== DMCA_ATTESTATION_VERSION ||
        record.jurisdictionAttestationVersion !== DMCA_ATTESTATION_VERSION ||
        record.serviceAttestationVersion !== DMCA_ATTESTATION_VERSION ||
        record.mistakeAttestationText !== DMCA_COUNTER_MISTAKE_TEXT ||
        record.jurisdictionAttestationText !== DMCA_COUNTER_JURISDICTION_TEXT ||
        record.serviceAttestationText !== DMCA_COUNTER_SERVICE_TEXT
      ) {
        return { outcome: 'bad-payload' };
      }
      const resolved = resolveDmcaPublicUrl(record.materialLocationBeforeRemoval);
      const originalNotice = dmcaNotices.find(
        (notice) => notice.id === record.originalNoticeReference.trim(),
      );
      const nowIso = new Date().toISOString();
      dmcaCounterSeq += 1;
      const noticeId = `mem-dmca-counter-${dmcaCounterSeq}`;
      dmcaCounterNotices.push({
        ...record,
        id: noticeId,
        originalNoticeId: originalNotice?.id ?? null,
        targetKind: resolved?.kind ?? null,
        targetId: resolved?.id ?? null,
        status: resolved ? 'received' : 'needs_resolution',
        createdAt: nowIso,
      });
      return {
        outcome: 'ok',
        referenceId: noticeId,
        resolutionStatus: resolved ? 'resolved' : 'needs-resolution',
        originalNoticeMatched: originalNotice != null,
        targetKind: resolved?.kind ?? null,
        targetId: resolved?.id ?? null,
        queueVisible: dmcaCounterNotices.some((notice) => notice.id === noticeId),
      };
    },
    async getMyDmcaSubmissionStatus(input) {
      if (authEmails.get(input.userId) !== input.email.trim().toLowerCase()) return null;
      const acknowledgmentDueAt = (createdAt: string) =>
        new Date(Date.parse(createdAt) + 72 * 60 * 60 * 1000).toISOString();
      if (input.kind === 'takedown') {
        const notice = dmcaNotices.find(
          (row) =>
            row.id === input.noticeId &&
            row.complainantEmail.trim().toLowerCase() === input.email.trim().toLowerCase(),
        );
        return notice
          ? {
              kind: 'takedown',
              referenceId: notice.id,
              status: notice.status,
              resolutionStatus: notice.targetKind ? 'resolved' : 'needs-resolution',
              acknowledgmentDueAt: acknowledgmentDueAt(notice.createdAt),
              acknowledgedAt: null,
              createdAt: notice.createdAt,
            }
          : null;
      }
      const notice = dmcaCounterNotices.find(
        (row) =>
          row.id === input.noticeId &&
          row.counterNotifierEmail.trim().toLowerCase() === input.email.trim().toLowerCase(),
      );
      return notice
        ? {
            kind: 'counter',
            referenceId: notice.id,
            status: notice.status,
            resolutionStatus: notice.targetKind ? 'resolved' : 'needs-resolution',
            acknowledgmentDueAt: acknowledgmentDueAt(notice.createdAt),
            acknowledgedAt: null,
            restorationEligibleAt: null,
            restorationDeadlineAt: null,
            createdAt: notice.createdAt,
          }
        : null;
    },
    async moderateStrikeAndMaybeSuspend(input) {
      if (input.moderatorRef.trim() === '') return 'bad-moderator';
      const p = profiles.get(input.profileId);
      if (!p) return 'not-found';
      const threshold = input.threshold && input.threshold > 0 ? input.threshold : 3;
      p.copyrightStrikes = (p.copyrightStrikes ?? 0) + 1;
      pushModerationAction({
        reportId: input.reportId ?? null,
        moderatorRef: input.moderatorRef,
        action: 'suspend_profile',
        targetKind: 'profile',
        targetId: input.profileId,
        note: `copyright strike ${p.copyrightStrikes}/${threshold}${input.note ? `: ${input.note}` : ''}`,
      });
      if (p.copyrightStrikes >= threshold) {
        p.suspendedUntil = input.suspendUntil ?? '2999-12-31T23:59:59.000Z';
        pushModerationAction({
          reportId: input.reportId ?? null,
          moderatorRef: input.moderatorRef,
          action: 'suspend_profile',
          targetKind: 'profile',
          targetId: input.profileId,
          note: `repeat-infringer suspension at ${p.copyrightStrikes} strikes`,
        });
        return 'suspended';
      }
      return 'struck';
    },
    async getCopyrightStrikes(profileId) {
      return profiles.get(profileId)?.copyrightStrikes ?? 0;
    },
    async openNciiCase(reportId, deadlineHours = 48) {
      return openNciiCaseForReport(reportId, deadlineHours, false, false);
    },
    async reconcileNciiCase(reportId) {
      // 0 defers to the reason's routed SLA, exactly as the SQL does.
      return openNciiCaseForReport(reportId, 0, true, true);
    },
    async findOrphanedNciiReports() {
      return reports
        .filter(
          (report) =>
            report.status === 'open' &&
            EDGE_REPORT_URGENT_REASONS.includes(report.reason) &&
            !nciiCases.some(
              (caseRow) => caseRow.reportId === report.id && caseRow.status !== 'cleared',
            ),
        )
        .sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
        )
        .map((report) => report.id);
    },
    async enforceNciiCase(input) {
      if (input.moderatorRef.trim() === '') return 'bad-moderator';
      if (
        input.action !== 'ensure_removed' &&
        input.action !== 'escalate' &&
        input.action !== 'clear'
      ) {
        return 'bad-action';
      }
      const c = nciiCases.find((row) => row.id === input.caseId);
      if (!c) return 'not-found';
      const stamp = () => {
        c.updatedAt = new Date().toISOString();
        if (input.hashStatus != null) c.hashMatchStatus = input.hashStatus;
        if (input.ncmecRef != null) c.ncmecRef = input.ncmecRef;
        if (input.note != null && input.note.trim() !== '') c.note = input.note.trim();
      };

      if (input.action === 'clear') {
        // Human-only: the worker's 'ncii-auto' ref can never clear.
        if (input.moderatorRef === 'ncii-auto') return 'clear-not-allowed';
        c.status = 'cleared';
        stamp();
        pushModerationAction({
          reportId: c.reportId,
          moderatorRef: input.moderatorRef,
          action: 'restore',
          targetKind: c.targetKind,
          targetId: c.targetId,
          note: `NCII case cleared (human-reviewed): ${input.note ?? ''}`,
        });
        return 'cleared';
      }

      // Drive toward removal, never away from it.
      let next: NciiCaseStatus = 'escalated';
      if (c.targetKind === 'article' || c.targetKind === 'revision') {
        const a = articles.get(c.targetId);
        if (a) {
          a.status = 'retracted';
          next = input.action === 'ensure_removed' ? 'removed' : 'escalated';
        }
      } else if (c.targetKind === 'suggestion') {
        const s = suggestions.get(c.targetId);
        if (s) {
          s.status = 'rejected';
          next = input.action === 'ensure_removed' ? 'removed' : 'escalated';
        }
      }
      // profile/media with no content row stays 'escalated' (human finishes).
      if (input.action === 'escalate') next = 'escalated';

      c.status = next;
      stamp();
      pushModerationAction({
        reportId: c.reportId,
        moderatorRef: input.moderatorRef,
        action:
          c.targetKind === 'article' || c.targetKind === 'revision'
            ? 'hide_article'
            : c.targetKind === 'suggestion'
              ? 'hide_suggestion'
              : 'suspend_profile',
        targetKind: c.targetKind,
        targetId: c.targetId,
        note: `NCII SLA enforce (${input.action} -> ${next}): ${input.note ?? ''}`,
      });
      return next;
    },
    async getDueNciiCases(nowIso, limit) {
      return nciiCases
        .filter(
          (c) => (c.status === 'queued' || c.status === 'escalated') && c.deadlineAt <= nowIso,
        )
        .sort((a, b) => (a.deadlineAt < b.deadlineAt ? -1 : a.deadlineAt > b.deadlineAt ? 1 : 0))
        .slice(0, limit)
        .map((c) => ({ ...c }));
    },
    async getOpenNciiCases(limit) {
      return nciiCases
        .filter((c) => c.status !== 'cleared')
        .sort((a, b) => (a.deadlineAt < b.deadlineAt ? -1 : a.deadlineAt > b.deadlineAt ? 1 : 0))
        .slice(0, limit)
        .map((c) => ({ ...c }));
    },

    /* ----------------------- account lifecycle (WP5) ---------------------- */

    async initiateAccountDeletion(userId, profileId) {
      if (!userId) return { outcome: 'bad-payload' };
      const inflight = newestDeletionRequest(userId, IN_FLIGHT_DELETION_STATUSES);
      if (inflight) return { outcome: 'existing', request: { ...inflight } };
      const requestedAt = new Date().toISOString();
      const row: DeletionRequestRow = {
        id: `mem-deletion-${++deletionSeq}`,
        userId,
        profileId,
        status: 'grace',
        requestedAt,
        graceEndsAt: new Date(Date.parse(requestedAt) + DELETION_GRACE_MS).toISOString(),
        cancelledAt: null,
        processingStartedAt: null,
        contentDisposedAt: null,
        completedAt: null,
        failureDetail: null,
        authUserDeletionState: 'pending',
        processorCleanupState: 'pending',
      };
      deletionRequests.push(row);
      return { outcome: 'created', request: { ...row } };
    },

    async cancelAccountDeletion(userId) {
      const row = newestDeletionRequest(userId, IN_FLIGHT_DELETION_STATUSES);
      if (!row) return 'not-found';
      if (row.status !== 'grace') return 'not-cancellable';
      row.status = 'cancelled';
      row.cancelledAt = new Date().toISOString();
      return 'ok';
    },

    async getAccountDeletionStatus(userId) {
      const row = newestDeletionRequest(userId);
      return row ? { ...row } : null;
    },

    async claimDueAccountDeletions(nowIso, limit) {
      const nowMs = Date.parse(nowIso);
      const backoffCutoff = new Date(nowMs - DELETION_RETRY_BACKOFF_MS).toISOString();
      const claimable = deletionRequests
        .filter((row) => {
          if (row.status === 'grace') return row.graceEndsAt <= nowIso;
          if (row.status === 'processing' || row.status === 'failed') {
            return (row.processingStartedAt ?? row.requestedAt) <= backoffCutoff;
          }
          return false;
        })
        .sort((a, b) => (a.graceEndsAt < b.graceEndsAt ? -1 : a.graceEndsAt > b.graceEndsAt ? 1 : 0))
        .slice(0, Math.max(1, Math.min(limit, 200)));
      return claimable.map((row) => {
        row.status = 'processing';
        row.processingStartedAt = nowIso;
        row.failureDetail = null;
        return { id: row.id, userId: row.userId, profileId: row.profileId };
      });
    },

    async disposeAccountDeletion(requestId) {
      const row = deletionRequests.find((r) => r.id === requestId);
      if (!row) return 'not-found';
      if (row.status !== 'processing') return 'bad-status';

      const profileId = row.profileId;
      if (profileId) {
        // HARD DELETE, in the same order and with the same predicates as
        // nw_account_deletion_dispose.
        removeWhere(follows, (f) => f.followerId === profileId);
        removeWhere(blocks, (b) => b.blockerId === profileId);
        removeWhere(newsroomMembers, (m) => m.profileId === profileId);
        removeWhere(verifications, (v) => v.journalistId === profileId);
        removeWhere(events, (e) => e.actorProfileId === profileId && e.action === 'comment');
        // WP6 custody personal data (finding #4): the encrypted private key, its
        // access log, recovery history, nonces, and notify channels.
        removeWhere(keyEscrow, (e) => e.profileId === profileId);
        removeWhere(keyEscrowAccess, (e) => e.profileId === profileId);
        removeWhere(recoveryRequests, (r) => r.profileId === profileId);
        for (const [nonce, row] of [...keyNonces]) {
          if (row.profileId === profileId) keyNonces.delete(nonce);
        }
        removeWhere(notifyChannels, (c) => c.profileId === profileId);
        for (const [id, suggestion] of [...suggestions]) {
          if (
            suggestion.editorProfileId === profileId &&
            (suggestion.status === 'open' ||
              suggestion.status === 'rejected' ||
              suggestion.status === 'stale') &&
            // Finding #3: an open-reported suggestion is retained as moderation
            // evidence, not deleted to evade the report.
            !reports.some(
              (r) => r.targetKind === 'suggestion' && r.targetId === id && r.status === 'open',
            )
          ) {
            deleteSuggestionCascade(id);
          }
        }

        const draftIds = [...articles.values()]
          .filter((a) => a.authorProfileId === profileId && a.status === 'draft')
          .map((a) => a.id);
        for (const articleId of draftIds) {
          const otherEditorCredit = ledger.some((l) => {
            if (l.editorProfileId === profileId) return false;
            return suggestions.get(l.suggestionId)?.articleId === articleId;
          });
          if (otherEditorCredit) {
            // Collaborative draft: keep the row so the other editors' ledger
            // survives, scrub the deleted author's words and the signatures.
            for (const revision of revisions) {
              if (revision.articleId !== articleId) continue;
              revision.headline = '[removed at author request]';
              revision.dek = undefined;
              revision.bodyMd = '';
              revision.signature = '';
              revision.signerPubkey = '';
            }
            articleMeta.delete(articleId);
          } else {
            deleteArticleCascade(articleId);
          }
        }

        // MONEY: stop future billing, retain the financial record.
        for (const support of supports) {
          if (support.supporterId === profileId && support.status !== 'canceled') {
            support.status = 'canceled';
          }
        }
        const payout = payoutAccounts.get(profileId);
        if (payout) {
          payout.onboardingState = 'none';
          payout.provider = null;
          payout.providerAccountRef = null;
          payout.statusReason = 'account deleted';
        }

        // RETAIN + ANONYMIZE, once. Keyed on the anonymization marker this
        // function writes (finding #1b), not on deletedAt alone, so a stray
        // deletedAt cannot skip the scrub.
        const profile = profiles.get(profileId);
        if (profile && (profile.displayName !== 'Deleted account' || !profile.deletedAt)) {
          const now = new Date().toISOString();
          let handle = '';
          do {
            handle = `deleted_${(++handleSeq).toString(16).padStart(10, '0')}`;
          } while ([...profiles.values()].some((p) => p.handle === handle));
          profile.handle = handle;
          profile.displayName = 'Deleted account';
          profile.pubkey = '';
          profile.pubkeyRevokedAt = now;
          profile.deletedAt = now;
          // Detach from the auth user so the admin-API deletion cannot cascade
          // the retained public record away.
          profile.userId = undefined;

          const detail = journalistDetails.get(profileId);
          if (detail) {
            detail.bio = '';
            detail.beats = [];
            detail.region = '';
            detail.stripeAccountId = null;
          }
        }
      }

      for (const key of [...termsAcceptances]) {
        if (key.startsWith(`${row.userId}::`)) termsAcceptances.delete(key);
      }

      row.contentDisposedAt = new Date().toISOString();
      if (row.authUserDeletionState !== 'done') row.authUserDeletionState = 'pending';
      if (row.processorCleanupState !== 'done') row.processorCleanupState = 'pending';
      return 'ok';
    },

    async recordAccountDeletionState(input) {
      if (
        input.field !== 'auth_user_deletion_state' &&
        input.field !== 'processor_cleanup_state'
      ) {
        return 'bad-field';
      }
      if (!DELETION_SIDE_EFFECT_STATES.has(input.state)) return 'bad-state';
      const row = deletionRequests.find((r) => r.id === input.requestId);
      if (!row) return 'not-found';
      if (input.field === 'auth_user_deletion_state') {
        row.authUserDeletionState = input.state;
      } else {
        row.processorCleanupState = input.state;
      }
      if (input.state === 'failed') row.failureDetail = input.detail ?? row.failureDetail;
      return 'ok';
    },

    async completeAccountDeletion(requestId) {
      const row = deletionRequests.find((r) => r.id === requestId);
      if (!row) return 'not-found';
      if (row.status !== 'processing') return 'bad-status';
      if (!row.contentDisposedAt) return 'not-disposed';
      if (
        !TERMINAL_SIDE_EFFECT_STATES.has(row.authUserDeletionState) ||
        !TERMINAL_SIDE_EFFECT_STATES.has(row.processorCleanupState)
      ) {
        return 'states-pending';
      }
      row.status = 'completed';
      row.completedAt = new Date().toISOString();
      row.failureDetail = null;
      return 'ok';
    },

    async failAccountDeletion(requestId, detail) {
      const row = deletionRequests.find((r) => r.id === requestId);
      if (!row || row.status !== 'processing') return 'not-found';
      row.status = 'failed';
      row.failureDetail = (detail || 'unknown failure').slice(0, 2000);
      return 'ok';
    },

    async exportAccountBundle(userId, profileId) {
      const ownArticleIds = new Set(
        [...articles.values()]
          .filter((a) => profileId !== null && a.authorProfileId === profileId)
          .map((a) => a.id),
      );
      const moneyRowsFor = (rows: StoredMoneyRow[]) =>
        rows.filter(
          (row) =>
            profileId !== null &&
            (row.supporterProfileId === profileId || row.journalistProfileId === profileId),
        );
      const profile = profileId === null ? undefined : profiles.get(profileId);
      const journalistTier = profileId === null ? undefined : journalists.get(profileId);
      const journalistDetail = profileId === null ? undefined : journalistDetails.get(profileId);
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        userId,
        profileId,
        profile: profile ? { ...profile } : null,
        journalist:
          journalistTier || journalistDetail
            ? { profileId, tier: journalistTier ?? 'open', ...(journalistDetail ?? {}) }
            : null,
        journalistVerifications: verifications.filter((v) => v.journalistId === profileId),
        articles: [...articles.values()].filter((a) => ownArticleIds.has(a.id)),
        articleRevisions: revisions.filter((r) => ownArticleIds.has(r.articleId)),
        articleMeta: [...articleMeta.values()].filter((m) => ownArticleIds.has(m.articleId)),
        suggestionsAuthored: [...suggestions.values()].filter(
          (s) => s.editorProfileId === profileId,
        ),
        suggestionEventsAuthored: events.filter((e) => e.actorProfileId === profileId),
        dupeEndorsements: dupes.filter((d) => d.endorserId === profileId),
        credibilityLedger: ledger.filter((l) => l.editorProfileId === profileId),
        follows: follows.filter((f) => f.followerId === profileId),
        blocks: blocks.filter((b) => b.blockerId === profileId),
        newsroomsOwned: newsrooms.filter((n) => n.ownerId === profileId),
        newsroomMemberships: newsroomMembers.filter((m) => m.profileId === profileId),
        mediaAssets: [...mediaAssets.values()].filter((m) => m.ownerProfileId === profileId),
        termsAcceptances: [...termsAcceptances]
          .filter((key) => key.startsWith(`${userId}::`))
          .map((key) => ({ userId, termsVersion: key.slice(userId.length + 2) })),
        reportsFiled: reports.filter((r) => r.reporterProfileId === profileId),
        moderationNotices: await store.getMyModerationNotices(userId),
        dmcaNoticesSubmitted: dmcaNotices.filter((n) => n.submitterProfileId === profileId),
        dmcaCounterNoticesSubmitted: dmcaCounterNotices.filter(
          (n) => n.submitterProfileId === profileId,
        ),
        supports: supports.filter((s) => s.supporterId === profileId),
        supportCharges: moneyRowsFor(supportCharges),
        supportLedger: moneyRowsFor(supportLedger),
        supportReceipts: moneyRowsFor(supportReceipts),
        transferLedger: moneyRowsFor(transferLedger),
        payoutAccount:
          profileId === null ? null : (payoutAccounts.get(profileId) ?? null),
        deletionRequests: deletionRequests.filter((r) => r.userId === userId),
        exportJobs: exportJobs.filter((j) => j.userId === userId),
      };
    },

    async recordAccountExport(input) {
      if (input.status !== 'completed' && input.status !== 'failed') return 'bad-status';
      const at = new Date().toISOString();
      exportJobs.push({
        id: `mem-export-${++exportSeq}`,
        userId: input.userId,
        profileId: input.profileId,
        status: input.status,
        requestedAt: at,
        completedAt: at,
        byteCount: Math.max(0, Math.floor(input.byteCount)),
        failureDetail: input.status === 'failed' ? (input.detail ?? '') : null,
      });
      return 'ok';
    },

    async deleteAuthUser(userId) {
      if (authDeletion.behavior === 'done') authDeletion.deletedUserIds.push(userId);
      return authDeletion.behavior;
    },

    /* --------------------- screening (plan 48 WP8) ------------------------ */
    // Twin of migration 20260730000009: same outcome codes, same
    // decision-with-content atomicity (a thrown error leaves neither behind),
    // and the same non-public representation (held article stays a draft, held
    // revision does not advance current_rev).

    async screeningAllowanceExists(authorProfileId, contentSha256) {
      if (!contentSha256) return false;
      return screeningAllowances.some(
        (row) =>
          row.authorProfileId === authorProfileId &&
          row.contentSha256 === contentSha256 &&
          Date.parse(row.expiresAt) > (seed?.now?.() ?? Date.now()),
      );
    },
    async getRecentContentSignatures(authorProfileId, limit = 25) {
      return contentSignatures
        .filter((row) => row.authorProfileId === authorProfileId)
        .slice(-Math.max(1, limit))
        .reverse()
        .map((row) => row.signature);
    },
    async recordContentSignature(input) {
      if (!input.signature) return 'bad-payload';
      if (!profiles.has(input.authorProfileId)) return 'no-profile';
      contentSignatures.push({
        authorProfileId: input.authorProfileId,
        contentKind: input.contentKind,
        signature: input.signature,
      });
      // Same bounded history the SQL keeps (nw_content_signature_history).
      const mine = contentSignatures.filter((row) => row.authorProfileId === input.authorProfileId);
      if (mine.length > 50) {
        const drop = mine.length - 50;
        for (let i = 0, removed = 0; i < contentSignatures.length && removed < drop; ) {
          if (contentSignatures[i]!.authorProfileId === input.authorProfileId) {
            contentSignatures.splice(i, 1);
            removed++;
          } else {
            i++;
          }
        }
      }
      return 'ok';
    },
    async recordScreeningAllow(input) {
      return insertScreeningDecision({
        contentKind: input.contentKind,
        contentId: input.contentId,
        contentRev: input.contentRev,
        authorProfileId: input.authorProfileId,
        contentSha256: input.contentSha256,
        autoAction: 'allowed',
        verdict: input.verdict,
        heldPayload: null,
      });
    },
    async quarantineArticle(input) {
      const existing = articles.get(input.article.id);
      if (!existing) {
        if (input.revision.rev !== 1) return { ok: false, code: 'rev-conflict' };
        if ([...articles.values()].some((a) => a.slug === input.article.slug)) {
          return { ok: false, code: 'slug-conflict' };
        }
        articles.set(input.article.id, {
          id: input.article.id,
          slug: input.article.slug,
          kind: input.article.kind,
          // A held article is a draft: every public read path already excludes
          // drafts, so a hold needs no new status value.
          status: 'draft',
          authorProfileId: input.article.authorProfileId,
          authorPubkey: input.revision.signerPubkey,
          currentRev: 1,
          newsroomId: input.article.newsroomId ?? null,
          publishedAt: null,
          screeningStatus: 'quarantined',
        });
      } else {
        if (input.revision.rev !== existing.currentRev + 1) {
          return { ok: false, code: 'rev-conflict' };
        }
        // A4: replace a still-held revision at this slot instead of colliding.
        removeWhere(
          revisions,
          (r) => r.articleId === input.article.id && r.rev === input.revision.rev,
        );
        removeWhere(
          quarantinedRevisions,
          (q) => q.articleId === input.article.id && q.rev === input.revision.rev,
        );
        // current_rev deliberately unchanged: readers keep the last cleared rev.
        if (existing.status === 'draft') existing.screeningStatus = 'quarantined';
      }
      revisions.push({ ...input.revision });
      quarantinedRevisions.push({ articleId: input.article.id, rev: input.revision.rev });
      const decisionId = insertScreeningDecision({
        contentKind: existing ? 'revision' : 'article',
        contentId: input.article.id,
        contentRev: input.revision.rev,
        authorProfileId: input.article.authorProfileId,
        contentSha256: input.contentSha256,
        autoAction: 'quarantined',
        verdict: input.verdict,
        heldPayload: null,
      });
      return { ok: true, decisionId };
    },
    async quarantineSuggestion(input) {
      if (!articles.has(input.suggestion.articleId)) {
        return { ok: false, code: 'unknown-article' };
      }
      suggestions.set(input.suggestion.id, { ...input.suggestion, status: 'quarantined' });
      const decisionId = insertScreeningDecision({
        contentKind: 'suggestion',
        contentId: input.suggestion.id,
        contentRev: null,
        authorProfileId: input.suggestion.editorProfileId,
        contentSha256: input.contentSha256,
        autoAction: 'quarantined',
        verdict: input.verdict,
        heldPayload: null,
      });
      return { ok: true, decisionId };
    },
    async quarantineComment(input) {
      if (!suggestions.has(input.suggestionId)) return { ok: false, code: 'unknown-suggestion' };
      if (!profiles.has(input.actorProfileId)) return { ok: false, code: 'unknown-actor' };
      events.push({
        suggestionId: input.suggestionId,
        actorProfileId: input.actorProfileId,
        action: 'comment',
        payload: { body: input.body },
        createdAt: new Date(seed?.now?.() ?? Date.now()).toISOString(),
        screeningStatus: 'quarantined',
      });
      const decisionId = insertScreeningDecision({
        contentKind: 'comment',
        contentId: `mem-event-${events.length}`,
        contentRev: null,
        authorProfileId: input.actorProfileId,
        contentSha256: input.contentSha256,
        autoAction: 'quarantined',
        verdict: input.verdict,
        heldPayload: null,
      });
      return { ok: true, decisionId };
    },
    async holdRevisionProposal(input) {
      const decisionId = insertScreeningDecision({
        contentKind: 'revision-proposal',
        contentId: input.articleId,
        contentRev: input.rev,
        authorProfileId: input.authorProfileId,
        contentSha256: input.contentSha256,
        autoAction: 'held',
        verdict: input.verdict,
        heldPayload: input.payload,
      });
      return { ok: true, decisionId };
    },

    async getMyScreeningDecisions(userId) {
      const profileId = [...profiles.values()].find((p) => p.userId === userId)?.id;
      if (!profileId) return [];
      return screeningDecisions
        .filter((row) => row.authorProfileId === profileId && row.autoAction !== 'allowed')
        .map((row) => ({
          id: row.id,
          contentKind: row.contentKind,
          contentId: row.contentId,
          contentRev: row.contentRev,
          autoAction: row.autoAction,
          decision: row.decision,
          topClass: row.topClass,
          requiresHumanReview: row.requiresHumanReview,
          reviewReason: row.reviewReason ?? '',
          appealState: row.appealState ?? 'none',
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt ?? null,
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
    async appealScreeningDecision(input) {
      if (input.reason.trim() === '' || input.reason.length > 2000) return 'bad-reason';
      const row = screeningDecisions.find((decision) => decision.id === input.decisionId);
      if (!row) return 'not-found';
      if (row.authorProfileId !== input.authorProfileId) return 'not-author';
      if (row.autoAction === 'allowed') return 'not-appealable';
      if ((row.appealState ?? 'none') !== 'none') return 'already-appealed';
      row.appealState = 'requested';
      row.appealReason = input.reason;
      return 'ok';
    },

    /* ------------------ verification center (plan 48 WP8) ----------------- */

    async getVerificationState(profileId) {
      return verificationStateFor(profileId);
    },
    async requestVerification(input) {
      if (!['domain_email', 'orcid', 'byline', 'manual'].includes(input.method)) {
        return { ok: false, code: 'bad-method' };
      }
      if (!journalists.has(input.profileId)) return { ok: false, code: 'no-journalist' };
      if (verifications.some((v) => v.journalistId === input.profileId && v.status === 'pending')) {
        return { ok: false, code: 'already-pending' };
      }
      if (verificationStateFor(input.profileId) === 'approved') {
        return { ok: false, code: 'already-verified' };
      }
      const id = `mem-verification-${verifications.length + 1}`;
      verifications.push({
        id,
        journalistId: input.profileId,
        method: input.method,
        evidenceRef: input.evidenceRef,
        status: 'pending',
        createdAt: new Date(seed?.now?.() ?? Date.now()).toISOString(),
        evidence: input.evidence,
        decisionReason: '',
        decidedAt: null,
        expiresAt: null,
        revokedAt: null,
      });
      return { ok: true, verificationId: id };
    },
    async getMyVerifications(userId) {
      const profileId = [...profiles.values()].find((p) => p.userId === userId)?.id;
      if (!profileId) return [];
      return verifications
        .filter((row) => row.journalistId === profileId)
        .map((row) => ({
          id: row.id,
          method: row.method as VerificationMethod,
          status: row.status as VerificationState,
          decisionReason: row.decisionReason ?? '',
          createdAt: row.createdAt,
          decidedAt: row.decidedAt ?? null,
          expiresAt: row.expiresAt ?? null,
          revokedAt: row.revokedAt ?? null,
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
  };

  /* ------------------ screening helpers (in-memory twin) ------------------- */

  function insertScreeningDecision(input: {
    contentKind: ScreeningContentKind;
    contentId: string;
    contentRev: number | null;
    authorProfileId: string;
    contentSha256: string;
    autoAction: 'allowed' | 'quarantined' | 'held';
    verdict: unknown;
    heldPayload: unknown;
  }): string {
    screeningSeq += 1;
    const id = `mem-screening-${screeningSeq}`;
    const verdict = (input.verdict ?? {}) as Record<string, unknown>;
    screeningDecisions.push({
      id,
      contentKind: input.contentKind,
      contentId: input.contentId,
      contentRev: input.contentRev,
      authorProfileId: input.authorProfileId,
      contentSha256: input.contentSha256,
      autoAction: input.autoAction,
      decision: input.autoAction === 'allowed' ? 'auto-allowed' : 'pending',
      topClass: typeof verdict.topClass === 'string' ? verdict.topClass : null,
      thresholdHit: typeof verdict.thresholdHit === 'string' ? verdict.thresholdHit : null,
      requiresHumanReview: verdict.requiresHumanReview === true,
      riskScore: typeof verdict.score === 'number' ? verdict.score : 0,
      heldPayload: input.heldPayload,
      createdAt: new Date(seed?.now?.() ?? Date.now()).toISOString(),
    });
    // A hold is an adverse action, so it carries its statement of reasons from
    // the moment it happens, exactly as nw_screening_insert_decision does.
    if (input.autoAction !== 'allowed') {
      pushModerationAction({
        reportId: null,
        moderatorRef: 'screening-auto',
        action: 'screening_hold',
        targetKind: input.contentKind === 'comment' ? 'suggestion' : 'article',
        targetId: input.contentId,
        note: `held for human review by pre-publication screening (${
          typeof verdict.thresholdHit === 'string' ? verdict.thresholdHit : 'unspecified threshold'
        })`,
      });
    }
    return id;
  }

  function verificationStateFor(profileId: string): VerificationState {
    const nowMs = seed?.now?.() ?? Date.now();
    const live = verifications.find(
      (row) =>
        row.journalistId === profileId &&
        row.status === 'approved' &&
        (!row.expiresAt || Date.parse(row.expiresAt) > nowMs),
    );
    if (live) return 'approved';
    const latest = [...verifications]
      .filter((row) => row.journalistId === profileId)
      .sort((a, b) => {
        const aAt = a.decidedAt ?? a.createdAt;
        const bAt = b.decidedAt ?? b.createdAt;
        return aAt < bAt ? 1 : aAt > bAt ? -1 : 0;
      })
      .at(0);
    if (!latest) return 'none';
    return isVerificationState(latest.status) ? latest.status : 'none';
  }

  /* --------------- account-lifecycle helpers (in-memory twin) -------------- */

  function newestDeletionRequest(
    userId: string,
    statuses?: Set<DeletionStatus>,
  ): DeletionRequestRow | undefined {
    return [...deletionRequests]
      .filter((row) => row.userId === userId && (!statuses || statuses.has(row.status)))
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0))
      .at(0);
  }

  function removeWhere<T>(rows: T[], predicate: (row: T) => boolean): void {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (predicate(rows[i]!)) rows.splice(i, 1);
    }
  }

  /** Mirrors the FK cascades hanging off nw_edit_suggestions. */
  function deleteSuggestionCascade(suggestionId: string): void {
    suggestions.delete(suggestionId);
    removeWhere(events, (e) => e.suggestionId === suggestionId);
    removeWhere(dupes, (d) => d.originalId === suggestionId);
    removeWhere(ledger, (l) => l.suggestionId === suggestionId);
  }

  /** Mirrors the FK cascades hanging off nw_articles. */
  function deleteArticleCascade(articleId: string): void {
    articles.delete(articleId);
    articleMeta.delete(articleId);
    removeWhere(revisions, (r) => r.articleId === articleId);
    for (const [id, suggestion] of [...suggestions]) {
      if (suggestion.articleId === articleId) deleteSuggestionCascade(id);
    }
  }

  const state = {
    profiles,
    articles,
    revisions,
    suggestions,
    events,
    dupes,
    journalists,
    newsroomMembers,
    ledger,
    articleMeta,
    mediaAssets,
    reports,
    reportEscalations,
    moderationActions,
    termsAcceptances,
    authEmails,
    dmcaNotices,
    dmcaCounterNotices,
    dmcaRateCounters,
    nciiCases,
    aggregates,
    journalistDetails,
    follows,
    blocks,
    newsrooms,
    verifications,
    supports,
    payoutAccounts,
    supportCharges,
    supportLedger,
    supportReceipts,
    transferLedger,
    deletionRequests,
    exportJobs,
    /** Key custody state (WP6): chain, nonces, escrow, recovery, public events. */
    profileKeys,
    keyNonces,
    keyEscrow,
    keyEscrowAccess,
    notifyChannels,
    recoveryRequests,
    keyEvents,
    /** Test seam + record for the admin-API auth-deletion seam. */
    authDeletion,
    /** Screening state (WP8): decisions, allowances, signature history, holds. */
    screeningDecisions,
    screeningAllowances,
    contentSignatures,
    quarantinedRevisions,
    /** Award view of the ledger, kept for existing test assertions. */
    get credibilityRows(): AwardInput[] {
      return ledger.map(({ editorProfileId, basePoints, diversityMult, standingMult }) => ({
        editorProfileId,
        basePoints,
        diversityMult,
        standingMult,
      }));
    },
  };

  return { store, state };
}

/* ------------------------------ postgrest ------------------------------- */

/**
 * Production adapter: service-role PostgREST. Multi-row writes go through the
 * SECURITY DEFINER RPCs in supabase/migrations/20260703000002_mynews_rpcs.sql
 * and 20260703000003_mynews_editing_desk.sql so publish and accept stay
 * atomic. Static-verified (no live project in CI); the founder-ops e2e
 * exercises it for real.
 */
export function createPostgrestMyNewsStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): MyNewsStore {
  const base = (env('SUPABASE_URL') ?? '').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  async function rest<T>(path: string): Promise<T> {
    const res = await fetchImpl(`${base}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`store read ${res.status}`);
    return (await res.json()) as T;
  }

  async function insert(path: string, body: unknown, prefer: string): Promise<void> {
    const res = await fetchImpl(`${base}/rest/v1/${path}`, {
      method: 'POST',
      headers: { ...headers, Prefer: prefer },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`store insert ${res.status}`);
  }

  // HEAD + count=exact: PostgREST returns the total in Content-Range without
  // shipping any rows. Shared by the report count/dedupe/existence reads.
  async function headCount(query: string): Promise<number> {
    const res = await fetchImpl(`${base}/rest/v1/${query}`, {
      method: 'HEAD',
      headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
    });
    if (!res.ok && res.status !== 206) throw new Error(`store count ${res.status}`);
    const range = res.headers.get('content-range') ?? '';
    const total = Number.parseInt(range.split('/')[1] ?? '', 10);
    return Number.isNaN(total) ? 0 : total;
  }

  async function rpc<T>(name: string, body: unknown): Promise<T> {
    const res = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`store rpc ${name} ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    async getProfileIdByPubkey(pubkeyHex) {
      const rows = await rest<Array<{ id: string }>>(
        `nw_profiles?select=id&pubkey_ed25519=eq.${encodeURIComponent(pubkeyHex)}&limit=1`,
      );
      return rows[0]?.id ?? null;
    },
    async getProfileIdByUserId(userId) {
      const rows = await rest<Array<{ id: string }>>(
        `nw_profiles?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      return rows[0]?.id ?? null;
    },
    async setProfilePubkey(userId, pubkey) {
      // SECURITY DEFINER RPC (migration 20260705000003): atomic check-then-set
      // with the same priority as the in-memory twin. The service role bypasses
      // the client-write guard trigger; the RPC re-validates ownership by uid.
      return rpc<'ok' | 'no-profile' | 'pubkey-conflict' | 'already-set'>('nw_set_profile_pubkey', {
        p_user_id: userId,
        p_pubkey: pubkey,
      });
    },
    // ------------------------------------------- key custody (plan 48 WP6)
    // Every one of these is a SECURITY DEFINER RPC from migration
    // 20260730000008, granted to service_role only. The RPC owns the
    // transaction: nonce consumption, head re-assertion, chain writes and the
    // public event all land together or not at all, so there is no partial
    // custody state for a handler to have to unwind.
    async resolveActiveKey(pubkey) {
      const raw = await rpc<{
        verdict: KeyResolutionVerdict;
        profileId?: string;
        keyId?: string;
        kind?: 'primary' | 'device';
      }>('nw_key_resolve_active', { p_pubkey: pubkey });
      // Fail closed on a shape we do not recognize rather than treating an
      // unexpected payload as an active key.
      if (raw?.verdict !== 'active' && raw?.verdict !== 'revoked') {
        return { verdict: 'unknown' };
      }
      return raw;
    },
    async issueKeyNonce(input) {
      const raw = await rpc<{
        outcome: KeyCustodyOutcome;
        nonce?: string;
        profileId?: string;
        oldPubkey?: string;
        purpose?: KeyNoncePurpose;
        expiresAt?: string;
      }>('nw_key_issue_nonce', {
        p_user_id: input.userId,
        p_nonce: input.nonce,
        p_purpose: input.purpose,
      });
      return raw;
    },
    async rotateProfileKey(input) {
      return rpc<KeyMutationResult>('nw_key_rotate', {
        p_user_id: input.userId,
        p_nonce: input.nonce,
        p_new_pubkey: input.newPubkey,
        p_added_via: input.addedVia,
        p_proof: input.proof,
      });
    },
    async approveDeviceKey(input) {
      return rpc<KeyMutationResult>('nw_key_approve_device', {
        p_user_id: input.userId,
        p_nonce: input.nonce,
        p_device_pubkey: input.devicePubkey,
        p_proof: input.proof,
      });
    },
    async revokeProfileKey(input) {
      return rpc<KeyMutationResult>('nw_key_revoke', {
        p_user_id: input.userId,
        p_nonce: input.nonce,
        p_target_key_id: input.targetKeyId,
      });
    },
    async escrowPutKit(input) {
      return rpc<EscrowPutResult>('nw_key_escrow_put', {
        p_user_id: input.userId,
        p_nonce: input.nonce,
        p_envelope: input.envelope,
        p_pubkey: input.pubkey,
      });
    },
    async escrowGetKit(userId) {
      return rpc<EscrowGetResult>('nw_key_escrow_get', { p_user_id: userId });
    },
    async requestKeyRecovery(input) {
      return rpc<RecoveryRequestResult>('nw_key_recovery_request', {
        p_user_id: input.userId,
        p_new_pubkey: input.newPubkey,
        p_cancel_token_hash: input.cancelTokenHash,
      });
    },
    async cancelKeyRecovery(input) {
      return rpc<RecoveryCancelResult>('nw_key_recovery_cancel', {
        p_request_id: input.requestId,
        p_cancel_token_hash: input.cancelTokenHash ?? null,
        p_user_id: input.userId ?? null,
        p_nonce: input.nonce ?? null,
      });
    },
    async completeKeyRecovery(input) {
      return rpc<KeyMutationResult>('nw_key_recovery_complete', {
        p_user_id: input.userId,
        p_nonce: input.nonce,
        p_request_id: input.requestId,
        p_new_pubkey: input.newPubkey,
        p_proof: input.proof,
      });
    },
    async getKeyCustodyStatus(userId) {
      return rpc<KeyCustodyStatus>('nw_key_custody_status', { p_user_id: userId });
    },
    async getProfilePubkeys(profileIds) {
      if (profileIds.length === 0) return {};
      // One in-list query for the whole batch; ids are UUIDs so no PostgREST
      // reserved characters need quoting beyond URI encoding.
      const rows = await rest<Array<{ id: string; pubkey_ed25519: string }>>(
        `nw_profiles?select=id,pubkey_ed25519&id=in.(${profileIds
          .map((id) => encodeURIComponent(id))
          .join(',')})`,
      );
      return Object.fromEntries(rows.map((row) => [row.id, row.pubkey_ed25519]));
    },
    async getArticleHead(articleId) {
      const rows = await rest<
        Array<{
          id: string;
          slug: string;
          kind: string;
          status: string;
          author_id: string;
          newsroom_id: string | null;
          current_rev: number;
          nw_profiles: {
            pubkey_ed25519: string;
            nw_journalists: { tier: 'open' | 'verified' } | null;
          } | null;
        }>
      >(
        `nw_articles?select=id,slug,kind,status,author_id,newsroom_id,current_rev,nw_profiles!nw_articles_author_id_fkey(pubkey_ed25519,nw_journalists(tier))&id=eq.${encodeURIComponent(articleId)}&limit=1`,
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        kind: row.kind,
        status: row.status,
        authorProfileId: row.author_id,
        authorPubkey: row.nw_profiles?.pubkey_ed25519 ?? '',
        authorTier: row.nw_profiles?.nw_journalists?.tier ?? 'open',
        newsroomId: row.newsroom_id ?? null,
        currentRev: row.current_rev,
      };
    },
    async slugTaken(slug) {
      const rows = await rest<Array<{ id: string }>>(
        `nw_articles?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      );
      return rows.length > 0;
    },
    async publishArticle(record) {
      return rpc<'ok' | 'rev-conflict' | 'slug-conflict' | 'bad-payload'>('nw_publish_article', {
        p_article: record.article,
        p_revision: record.revision,
        p_published_at: record.publishedAtIso,
      });
    },
    async insertSuggestion(record) {
      return rpc<'ok' | 'unknown-article'>('nw_insert_suggestion', { p_suggestion: record });
    },
    async getSuggestion(id) {
      const rows = await rest<
        Array<{
          id: string;
          article_id: string;
          base_rev: number;
          editor_id: string;
          type: string;
          diff_json: unknown;
          citations: string[];
          rationale: string;
          signature: string;
          signer_pubkey: string | null;
          status: StoredSuggestion['status'];
          created_at: string;
        }>
      >(`nw_edit_suggestions?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        articleId: row.article_id,
        baseRev: row.base_rev,
        editorProfileId: row.editor_id,
        type: row.type,
        diffJson: JSON.stringify(row.diff_json),
        citations: row.citations,
        rationale: row.rationale,
        signature: row.signature,
        // Empty on rows written before migration 20260730000008.
        signerPubkey: row.signer_pubkey ?? '',
        createdAt: row.created_at,
        status: row.status,
      };
    },
    async countRecentSuggestions(editorProfileId, sinceIso) {
      // HEAD + count=exact: PostgREST returns the total in Content-Range
      // (".../<total>") without shipping any rows.
      const res = await fetchImpl(
        `${base}/rest/v1/nw_edit_suggestions?select=id&editor_id=eq.${encodeURIComponent(
          editorProfileId,
        )}&created_at=gte.${encodeURIComponent(sinceIso)}`,
        { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } },
      );
      if (!res.ok && res.status !== 206) throw new Error(`store count ${res.status}`);
      const range = res.headers.get('content-range') ?? '';
      const total = Number.parseInt(range.split('/')[1] ?? '', 10);
      return Number.isNaN(total) ? 0 : total;
    },
    async getOpenSuggestionsForArticle(articleId, baseRev) {
      const rows = await rest<
        Array<{
          id: string;
          editor_id: string;
          type: string;
          diff_json: unknown;
          base_rev: number;
        }>
      >(
        // Oldest-first so the first near-dupe match is the collapse original;
        // limit 200 caps the scan cost on hot articles.
        `nw_edit_suggestions?select=id,editor_id,type,diff_json,base_rev&article_id=eq.${encodeURIComponent(articleId)}&base_rev=eq.${baseRev}&status=eq.open&order=created_at.asc&limit=200`,
      );
      return rows.map((row) => ({
        id: row.id,
        editorProfileId: row.editor_id,
        type: row.type,
        diffJson: JSON.stringify(row.diff_json),
        baseRev: row.base_rev,
      }));
    },
    async insertDupeEndorsement(input) {
      // The unique (original_id, endorser_id) pair makes the insert
      // idempotent; ignore-duplicates swallows the conflict.
      await insert(
        'nw_suggestion_dupes?on_conflict=original_id,endorser_id',
        {
          original_id: input.originalId,
          endorser_id: input.endorserId,
          similarity: input.similarity,
        },
        'resolution=ignore-duplicates',
      );
      return 'ok';
    },
    async getEditorAggregates(editorProfileId) {
      return rpc<EditorAggregates>('nw_editor_aggregates', { p_editor: editorProfileId });
    },
    async getCredibilityLedger(editorProfileId) {
      const rows = await rest<
        Array<{
          editor_id: string;
          suggestion_id: string;
          base_points: number;
          diversity_mult: number;
          standing_mult: number;
          awarded_at: string;
        }>
      >(
        // Newest-first with an explicit cap so any truncation drops the
        // most-decayed tail of the ledger; the in-memory impl mirrors the
        // ordering.
        `nw_credibility_ledger?select=editor_id,suggestion_id,base_points,diversity_mult,standing_mult,awarded_at&editor_id=eq.${encodeURIComponent(editorProfileId)}&order=awarded_at.desc&limit=500`,
      );
      return rows.map((row) => ({
        editorProfileId: row.editor_id,
        suggestionId: row.suggestion_id,
        basePoints: row.base_points,
        diversityMult: row.diversity_mult,
        standingMult: row.standing_mult,
        awardedAt: row.awarded_at,
      }));
    },
    async getNewsroomRole(newsroomId, profileId) {
      const rows = await rest<Array<{ role: NewsroomRole }>>(
        `nw_newsroom_members?select=role&newsroom_id=eq.${encodeURIComponent(newsroomId)}&profile_id=eq.${encodeURIComponent(profileId)}&limit=1`,
      );
      return rows[0]?.role ?? null;
    },
    async acceptSuggestion(record) {
      return rpc<'ok' | 'rev-conflict' | 'not-open'>('nw_accept_suggestion', {
        p_suggestion_id: record.suggestionId,
        p_decision: record.decision,
        p_actor: record.actorProfileId,
        p_revision: record.revision,
        p_award: record.award,
      });
    },
    async acceptSuggestionsBatch(record) {
      return rpc<'ok' | 'rev-conflict' | 'not-open' | 'mixed-articles' | 'bad-award'>(
        'nw_accept_suggestions_batch',
        {
          p_suggestion_ids: record.suggestionIds,
          p_actor: record.actorProfileId,
          p_revision: record.revision,
          p_awards: record.awards,
        },
      );
    },
    async rejectSuggestion(suggestionId, actorProfileId, note) {
      return rpc<'ok' | 'not-open'>('nw_reject_suggestion', {
        p_suggestion_id: suggestionId,
        p_actor: actorProfileId,
        p_note: note ?? null,
      });
    },
    async upsertArticleMeta(record) {
      // SECURITY DEFINER RPC (migration 20260705000004): the service role
      // bypasses the client-write guard trigger and persists the whole signed
      // meta row. The edge function verified the signature before calling.
      return rpc<'ok' | 'bad-payload'>('nw_upsert_article_meta', {
        p_article_id: record.articleId,
        p_doi: record.doi ?? '',
        p_orcid_authors: record.orcidAuthors,
        p_license: record.license,
        p_rights_route: record.rightsRoute,
        p_embargo_until: record.embargoUntil,
        p_dataset_hashes: record.datasetHashes,
        p_canonical_url: record.canonicalUrl ?? '',
        p_signature: record.signature,
        p_signer_pubkey: record.signerPubkey,
      });
    },
    async reportTargetExists(kind, targetId) {
      if (!isUuid(targetId)) return false;
      // article/revision both resolve to an existing article row (a revision is
      // a rev under an article; the report addresses the article id).
      const table =
        kind === 'media'
          ? 'nw_media_assets'
          : kind === 'suggestion'
            ? 'nw_edit_suggestions'
            : kind === 'profile'
              ? 'nw_profiles'
              : 'nw_articles';
      const count = await headCount(
        `${table}?select=id&id=eq.${encodeURIComponent(targetId)}`,
      );
      return count > 0;
    },
    async countRecentReports(reporterProfileId, sinceIso) {
      return headCount(
        `nw_reports?select=id&reporter_id=eq.${encodeURIComponent(
          reporterProfileId,
        )}&created_at=gte.${encodeURIComponent(sinceIso)}`,
      );
    },
    async countRecentSuggestionComments(actorProfileId, sinceIso) {
      // Served by idx_nw_suggestion_events_actor_comments (20260730000003).
      // headCount throws on a non-2xx; mynews-comment turns that into a 503
      // rather than letting a failed read read as an empty window.
      return headCount(
        `nw_suggestion_events?select=id&action=eq.comment&actor_id=eq.${encodeURIComponent(
          actorProfileId,
        )}&created_at=gte.${encodeURIComponent(sinceIso)}`,
      );
    },
    async insertSuggestionComment(input) {
      // SECURITY DEFINER RPC (migration 20260730000003): the service role
      // bypasses the client-write guard trigger, and the RPC re-validates the
      // body bounds and the suggestion/actor rows inside SQL.
      return rpc<SuggestionCommentOutcome>('nw_insert_suggestion_comment', {
        p_suggestion_id: input.suggestionId,
        p_actor_id: input.actorProfileId,
        p_body: input.body,
      });
    },
    async hasOpenReport(reporterProfileId, kind, targetId) {
      const count = await headCount(
        `nw_reports?select=id&reporter_id=eq.${encodeURIComponent(
          reporterProfileId,
        )}&target_kind=eq.${encodeURIComponent(kind)}&target_id=eq.${encodeURIComponent(
          targetId,
        )}&status=eq.open`,
      );
      return count > 0;
    },
    async insertReport(record) {
      // SECURITY DEFINER RPC (migration 20260705000005): the service role
      // bypasses the client-write guard trigger and inserts with reporter_id set.
      return rpc<'ok'>('nw_insert_report', {
        p_reporter_id: record.reporterProfileId,
        p_target_kind: record.targetKind,
        p_target_id: record.targetId,
        p_reason: record.reason,
        p_detail: record.detail,
      });
    },
    async submitReport(input) {
      // SECURITY DEFINER RPC (migration 20260712000001): all report, escalation,
      // takedown, case, and audit writes commit or roll back as one call.
      return rpc<ReportSubmitOutcome>('nw_submit_report', {
        p_reporter_profile_id: input.reporterProfileId,
        p_target_kind: input.targetKind,
        p_target_id: input.targetId,
        p_reason: input.reason,
        p_detail: input.detail,
      });
    },
    async getOpenReportId(reporterProfileId, kind, targetId) {
      const rows = await rest<Array<{ id: string }>>(
        `nw_reports?select=id&reporter_id=eq.${encodeURIComponent(
          reporterProfileId,
        )}&target_kind=eq.${encodeURIComponent(kind)}&target_id=eq.${encodeURIComponent(
          targetId,
        )}&status=eq.open&limit=1`,
      );
      return rows[0]?.id ?? null;
    },
    async getMyReports(reporterProfileId) {
      const rows = await rest<
        Array<{
          id: string;
          target_kind: ReportTargetKind;
          target_id: string;
          reason: ReportReason;
          detail: string;
          status: StoredReport['status'];
          created_at: string;
        }>
      >(
        `nw_reports?select=id,target_kind,target_id,reason,detail,status,created_at&reporter_id=eq.${encodeURIComponent(
          reporterProfileId,
        )}&order=created_at.desc&limit=200`,
      );
      return rows.map((row) => ({
        id: row.id,
        reporterProfileId,
        targetKind: row.target_kind,
        targetId: row.target_id,
        reason: row.reason,
        detail: row.detail,
        status: row.status,
        createdAt: row.created_at,
      }));
    },
    async isProfileSuspended(profileId, nowIso) {
      const rows = await rest<Array<{ suspended_until: string | null }>>(
        `nw_profiles?select=suspended_until&id=eq.${encodeURIComponent(profileId)}&limit=1`,
      );
      const until = rows[0]?.suspended_until ?? null;
      return until != null && until > nowIso;
    },
    async hasAcceptedTerms(userId, version) {
      const rows = await rest<Array<{ user_id: string }>>(
        `nw_terms_acceptance?select=user_id&user_id=eq.${encodeURIComponent(userId)}&terms_version=eq.${encodeURIComponent(version)}&limit=1`,
      );
      return rows.length > 0;
    },
    async getMyModerationNotices(userId) {
      // SECURITY DEFINER RPC scopes the read to content this user owns; the
      // nw_moderation_actions table itself is never exposed to clients. The v2
      // RPC (plan 48 WP9) is the same statement-of-reasons set plus the action id
      // and appeal state, so a notice can carry its own appeal affordance.
      const rows = await rpc<
        Array<{
          action_id: string | null;
          target_kind: string;
          target_id: string;
          machine_reason: string;
          note: string;
          created_at: string;
          appeal_state: 'none' | 'requested' | 'granted' | 'denied';
          appeal_reason: string;
          appeal_decision_reason: string;
          appeal_reversal_outcome: string | null;
          appeal_decided_at: string | null;
        }>
      >('nw_get_my_moderation_notices_v2', { p_user: userId });
      return rows.map((r) => ({
        targetKind: r.target_kind,
        targetId: r.target_id,
        machineReason: r.machine_reason,
        note: r.note,
        createdAt: r.created_at,
        actionId: r.action_id,
        appealState: r.appeal_state ?? 'none',
        appealReason: r.appeal_reason ?? '',
        appealDecisionReason: r.appeal_decision_reason ?? '',
        appealReversalOutcome: r.appeal_reversal_outcome ?? null,
        appealDecidedAt: r.appeal_decided_at ?? null,
      }));
    },
    async appealModerationAction(input) {
      const reason = input.reason.trim();
      if (reason === '' || reason.length > 2000) return 'bad-reason';
      // The RPC checks ownership and answers 'not-found' for someone else's
      // action, so no ownership logic is duplicated here.
      const outcome = await rpc<string>('nw_moderation_appeal_request', {
        p_action_id: input.actionId,
        p_profile_id: input.appellantProfileId,
        p_reason: reason,
      });
      switch (outcome) {
        case 'ok':
        case 'not-found':
        case 'not-appealable':
        case 'already-appealed':
        case 'bad-reason':
          return outcome;
        default:
          // An unrecognised answer is a failure, never a recorded appeal.
          throw new Error(`mynews: nw_moderation_appeal_request returned ${String(outcome)}`);
      }
    },
    async getOpenReportQueue(limit) {
      // Pull the open reports first, then hydrate each distinct target in a
      // batched read per kind. A report can name a now-gone target; those keep
      // targetContext null.
      const reports = await rest<
        Array<{
          id: string;
          reporter_id: string;
          target_kind: ReportTargetKind;
          target_id: string;
          reason: ReportReason;
          detail: string;
          created_at: string;
        }>
      >(
        `nw_reports?select=id,reporter_id,target_kind,target_id,reason,detail,created_at&status=eq.open&order=created_at.desc&limit=${limit}`,
      );
      if (reports.length === 0) return [];

      const idsFor = (kinds: ReportTargetKind[]) => [
        ...new Set(
          reports.filter((r) => kinds.includes(r.target_kind)).map((r) => r.target_id),
        ),
      ];
      const inList = (ids: string[]) => ids.map((id) => encodeURIComponent(id)).join(',');

      const articleIds = idsFor(['article', 'revision']);
      const suggestionIds = idsFor(['suggestion']);
      const profileIds = idsFor(['profile']);

      const articleRows = articleIds.length
        ? await rest<
            Array<{
              id: string;
              slug: string;
              status: string;
              author_id: string;
              nw_article_revisions: Array<{ headline: string; rev: number }> | null;
            }>
          >(
            `nw_articles?select=id,slug,status,author_id,nw_article_revisions(headline,rev)&id=in.(${inList(articleIds)})`,
          )
        : [];
      const suggestionRows = suggestionIds.length
        ? await rest<
            Array<{ id: string; article_id: string; status: string; editor_id: string; rationale: string }>
          >(
            `nw_edit_suggestions?select=id,article_id,status,editor_id,rationale&id=in.(${inList(suggestionIds)})`,
          )
        : [];
      const profileRows = profileIds.length
        ? await rest<Array<{ id: string; handle: string; suspended_until: string | null }>>(
            `nw_profiles?select=id,handle,suspended_until&id=in.(${inList(profileIds)})`,
          )
        : [];

      const articleById = new Map(articleRows.map((a) => [a.id, a]));
      const suggestionById = new Map(suggestionRows.map((s) => [s.id, s]));
      const profileById = new Map(profileRows.map((p) => [p.id, p]));

      return reports.map((r) => {
        let targetContext: ReportQueueItem['targetContext'] = null;
        if (r.target_kind === 'article' || r.target_kind === 'revision') {
          const a = articleById.get(r.target_id);
          if (a) {
            const latest = (a.nw_article_revisions ?? []).reduce<{ headline: string; rev: number } | null>(
              (best, rev) => (!best || rev.rev > best.rev ? rev : best),
              null,
            );
            targetContext = {
              kind: 'article',
              slug: a.slug,
              status: a.status,
              authorProfileId: a.author_id,
              headline: latest?.headline ?? '',
            };
          }
        } else if (r.target_kind === 'suggestion') {
          const s = suggestionById.get(r.target_id);
          if (s) {
            targetContext = {
              kind: 'suggestion',
              articleId: s.article_id,
              status: s.status,
              editorProfileId: s.editor_id,
              rationale: s.rationale,
            };
          }
        } else if (r.target_kind === 'profile') {
          const p = profileById.get(r.target_id);
          if (p) {
            targetContext = { kind: 'profile', handle: p.handle, suspendedUntil: p.suspended_until };
          }
        } else if (r.target_kind === 'media') {
          targetContext = { kind: 'media', ref: r.target_id };
        }
        return {
          id: r.id,
          reporterProfileId: r.reporter_id,
          targetKind: r.target_kind,
          targetId: r.target_id,
          reason: r.reason,
          detail: r.detail,
          createdAt: r.created_at,
          targetContext,
        };
      });
    },
    async moderateHideArticle(input) {
      return rpc<ModerationOutcome>('nw_moderate_hide_article', {
        p_article_id: input.articleId,
        p_moderator_ref: input.moderatorRef,
        p_note: input.note,
        p_report_id: input.reportId ?? null,
      });
    },
    async moderateHideSuggestion(input) {
      return rpc<ModerationOutcome>('nw_moderate_hide_suggestion', {
        p_suggestion_id: input.suggestionId,
        p_moderator_ref: input.moderatorRef,
        p_note: input.note,
        p_report_id: input.reportId ?? null,
      });
    },
    async moderateSuspendProfile(input) {
      return rpc<ModerationOutcome>('nw_moderate_suspend_profile', {
        p_profile_id: input.profileId,
        p_until: input.until,
        p_moderator_ref: input.moderatorRef,
        p_note: input.note,
        p_report_id: input.reportId ?? null,
      });
    },
    async moderateResolveReport(input) {
      return rpc<ResolveOutcome>('nw_moderate_resolve_report', {
        p_report_id: input.reportId,
        p_status: input.status,
        p_moderator_ref: input.moderatorRef,
        p_note: input.note,
      });
    },
    async consumeDmcaRateLimit(input) {
      return rpc<DmcaRateLimitOutcome>('nw_consume_dmca_rate_limit', {
        p_rate_key: input.rateKey,
        p_ip_hash: input.ipHash,
        p_email_hash: input.emailHash,
      });
    },
    async submitDmcaTakedown(record) {
      return rpc<DmcaSubmissionResult>('nw_submit_dmca_takedown', {
        p_submitter_profile_id: record.submitterProfileId,
        p_complainant_name: record.complainantName,
        p_complainant_email: record.complainantEmail,
        p_complainant_address: record.complainantAddress,
        p_copyrighted_work: record.copyrightedWork,
        p_infringing_url: record.infringingUrl,
        p_good_faith: record.goodFaith,
        p_good_faith_attestation_text: record.goodFaithAttestationText,
        p_good_faith_attestation_version: record.goodFaithAttestationVersion,
        p_accuracy_under_penalty: record.accuracyUnderPenalty,
        p_accuracy_attestation_text: record.accuracyAttestationText,
        p_accuracy_attestation_version: record.accuracyAttestationVersion,
        p_signature: record.signature,
      });
    },
    async submitDmcaCounterNotice(record) {
      return rpc<DmcaSubmissionResult>('nw_submit_dmca_counter_notice', {
        p_submitter_profile_id: record.submitterProfileId,
        p_original_notice_reference: record.originalNoticeReference,
        p_counter_notifier_name: record.counterNotifierName,
        p_counter_notifier_address: record.counterNotifierAddress,
        p_counter_notifier_phone: record.counterNotifierPhone,
        p_counter_notifier_email: record.counterNotifierEmail,
        p_removed_material: record.removedMaterial,
        p_material_location_before_removal: record.materialLocationBeforeRemoval,
        p_good_faith_mistake_or_misidentification:
          record.goodFaithMistakeOrMisidentification,
        p_statement_under_penalty_of_perjury: record.statementUnderPenaltyOfPerjury,
        p_mistake_attestation_text: record.mistakeAttestationText,
        p_mistake_attestation_version: record.mistakeAttestationVersion,
        p_consent_to_federal_jurisdiction: record.consentToFederalJurisdiction,
        p_jurisdiction_attestation_text: record.jurisdictionAttestationText,
        p_jurisdiction_attestation_version: record.jurisdictionAttestationVersion,
        p_acceptance_of_service_of_process: record.acceptanceOfServiceOfProcess,
        p_service_attestation_text: record.serviceAttestationText,
        p_service_attestation_version: record.serviceAttestationVersion,
        p_signature: record.signature,
      });
    },
    async getMyDmcaSubmissionStatus(input) {
      return rpc<DmcaSubmissionStatus | null>('nw_get_my_dmca_submission_status', {
        p_user_id: input.userId,
        p_notice_kind: input.kind,
        p_notice_id: input.noticeId,
        p_email: input.email,
      });
    },
    async moderateStrikeAndMaybeSuspend(input) {
      return rpc<StrikeOutcome>('nw_moderate_strike_and_maybe_suspend', {
        p_profile_id: input.profileId,
        p_moderator_ref: input.moderatorRef,
        p_note: input.note,
        p_report_id: input.reportId ?? null,
        p_threshold: input.threshold ?? 3,
        p_suspend_until: input.suspendUntil ?? null,
      });
    },
    async getCopyrightStrikes(profileId) {
      const rows = await rest<Array<{ copyright_strikes: number }>>(
        `nw_profiles?select=copyright_strikes&id=eq.${encodeURIComponent(profileId)}&limit=1`,
      );
      return rows[0]?.copyright_strikes ?? 0;
    },
    async openNciiCase(reportId, deadlineHours = 48) {
      // SECURITY DEFINER RPC (migration 20260705000009): take-down-first intake.
      return rpc<NciiOpenOutcome>('nw_open_ncii_case', {
        p_report_id: reportId,
        p_deadline_hours: deadlineHours,
      });
    },
    async reconcileNciiCase(reportId) {
      return rpc<NciiOpenOutcome>('nw_reconcile_ncii_case', {
        p_report_id: reportId,
      });
    },
    async findOrphanedNciiReports() {
      const rows = await rpc<Array<{ report_id: string }>>(
        'nw_find_orphaned_ncii_reports',
        {},
      );
      return rows.map((row) => row.report_id);
    },
    async enforceNciiCase(input) {
      return rpc<NciiEnforceOutcome>('nw_ncii_enforce', {
        p_case_id: input.caseId,
        p_action: input.action,
        p_moderator_ref: input.moderatorRef,
        p_note: input.note ?? '',
        p_hash_status: input.hashStatus ?? null,
        p_ncmec_ref: input.ncmecRef ?? null,
      });
    },
    async getDueNciiCases(nowIso, limit) {
      const rows = await rest<NciiCaseRow[]>(
        `nw_ncii_cases?select=${NCII_SELECT}&status=in.(queued,escalated)&deadline_at=lte.${encodeURIComponent(
          nowIso,
        )}&order=deadline_at.asc&limit=${limit}`,
      );
      return rows.map(mapNciiRow);
    },
    async getOpenNciiCases(limit) {
      const rows = await rest<NciiCaseRow[]>(
        `nw_ncii_cases?select=${NCII_SELECT}&status=neq.cleared&order=deadline_at.asc&limit=${limit}`,
      );
      return rows.map(mapNciiRow);
    },

    /* ----------------------- account lifecycle (WP5) ---------------------- */

    async initiateAccountDeletion(userId, profileId) {
      const payload = await rpc<{
        outcome: 'created' | 'existing' | 'bad-payload' | 'conflict';
        request?: DeletionRequestRowJson;
      }>('nw_account_deletion_initiate', { p_user_id: userId, p_profile_id: profileId });
      if (payload.outcome === 'created' || payload.outcome === 'existing') {
        if (!payload.request) throw new Error('nw_account_deletion_initiate returned no request row');
        return { outcome: payload.outcome, request: mapDeletionRow(payload.request) };
      }
      return { outcome: payload.outcome };
    },
    async cancelAccountDeletion(userId) {
      return rpc<DeletionCancelOutcome>('nw_account_deletion_cancel', { p_user_id: userId });
    },
    async getAccountDeletionStatus(userId) {
      const row = await rpc<DeletionRequestRowJson | null>('nw_account_deletion_status', {
        p_user_id: userId,
      });
      return row ? mapDeletionRow(row) : null;
    },
    async claimDueAccountDeletions(nowIso, limit) {
      // The RPC's OUT columns are request_id/owner_user_id/owner_profile_id on
      // purpose: id/user_id/profile_id would collide with plpgsql variables.
      const rows = await rpc<
        Array<{ request_id: string; owner_user_id: string; owner_profile_id: string | null }>
      >('nw_account_deletion_claim_due', { p_now: nowIso, p_limit: limit });
      return rows.map((row) => ({
        id: row.request_id,
        userId: row.owner_user_id,
        profileId: row.owner_profile_id,
      }));
    },
    async disposeAccountDeletion(requestId) {
      return rpc<DeletionDisposeOutcome>('nw_account_deletion_dispose', {
        p_request_id: requestId,
      });
    },
    async recordAccountDeletionState(input) {
      return rpc<DeletionRecordStateOutcome>('nw_account_deletion_record_state', {
        p_request_id: input.requestId,
        p_field: input.field,
        p_state: input.state,
        p_detail: input.detail ?? null,
      });
    },
    async completeAccountDeletion(requestId) {
      return rpc<DeletionCompleteOutcome>('nw_account_deletion_complete', {
        p_request_id: requestId,
      });
    },
    async failAccountDeletion(requestId, detail) {
      return rpc<'ok' | 'not-found'>('nw_account_deletion_fail', {
        p_request_id: requestId,
        p_detail: detail,
      });
    },
    async exportAccountBundle(userId, profileId) {
      return rpc<AccountExportBundle>('nw_account_export_bundle', {
        p_user_id: userId,
        p_profile_id: profileId,
      });
    },
    async recordAccountExport(input) {
      return rpc<'ok' | 'bad-status'>('nw_account_export_record', {
        p_user_id: input.userId,
        p_profile_id: input.profileId,
        p_status: input.status,
        p_byte_count: Math.max(0, Math.floor(input.byteCount)),
        p_detail: input.detail ?? null,
      });
    },
    async deleteAuthUser(userId) {
      // Admin API, not PostgREST: it needs both the project URL and the service
      // role key. Either one missing is 'skipped-unconfigured' (visible in the
      // deletion status), never a silent 'done'.
      if (!base || !key) return 'skipped-unconfigured';
      try {
        const res = await fetchImpl(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers,
        });
        // A real deletion of an existing user is 200/204: unambiguous.
        if (res.status === 200 || res.status === 204) return 'done';
        // A 404 is the "user already gone" end state ONLY when it comes from
        // GoTrue itself. A mis-routed base URL (wrong host or path) also returns
        // 404, and treating that as done would report every deletion successful
        // while no auth user is ever removed (finding #6). Require a GoTrue-shaped
        // JSON error body; a gateway/path 404 (HTML, or a proxy JSON without
        // GoTrue's fields) fails instead of falsely reporting done.
        if (res.status === 404) {
          const contentType = res.headers.get('content-type') ?? '';
          if (!contentType.includes('application/json')) {
            console.error('mynews auth-user deletion: non-JSON 404, likely mis-routed');
            return 'failed';
          }
          let body: unknown = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }
          const shaped =
            typeof body === 'object' &&
            body !== null &&
            ('code' in body || 'msg' in body || 'error_code' in body || 'error' in body);
          if (shaped) return 'done';
          console.error('mynews auth-user deletion: 404 without a GoTrue error shape');
          return 'failed';
        }
        console.error('mynews auth-user deletion failed', res.status);
        return 'failed';
      } catch (error) {
        console.error('mynews auth-user deletion threw', error);
        return 'failed';
      }
    },

    /* --------------------- screening (plan 48 WP8) ------------------------ */

    async screeningAllowanceExists(authorProfileId, contentSha256) {
      if (!contentSha256) return false;
      return rpc<boolean>('nw_screening_allowance_exists', {
        p_author_profile_id: authorProfileId,
        p_content_sha256: contentSha256,
      });
    },
    async getRecentContentSignatures(authorProfileId, limit = 25) {
      const rows = await rpc<unknown>('nw_screening_recent_signatures', {
        p_author_profile_id: authorProfileId,
        p_limit: limit,
      });
      return Array.isArray(rows) ? rows : [];
    },
    async recordContentSignature(input) {
      return rpc<'ok' | 'no-profile' | 'bad-payload'>('nw_screening_record_signature', {
        p_author_profile_id: input.authorProfileId,
        p_content_kind: input.contentKind,
        p_signature: input.signature,
      });
    },
    async recordScreeningAllow(input) {
      const id = await rpc<string | null>('nw_screening_record_allow', {
        p_content_kind: input.contentKind,
        p_content_id: input.contentId,
        p_content_rev: input.contentRev,
        p_author_profile_id: input.authorProfileId,
        p_content_sha256: input.contentSha256,
        p_verdict: input.verdict,
      });
      return id ?? null;
    },
    async quarantineArticle(input) {
      return parseScreeningWrite(
        await rpc<string>('nw_screening_quarantine_article', {
          p_article: input.article,
          p_revision: input.revision,
          p_verdict: input.verdict,
          p_content_sha256: input.contentSha256,
        }),
      );
    },
    async quarantineSuggestion(input) {
      return parseScreeningWrite(
        await rpc<string>('nw_screening_quarantine_suggestion', {
          p_suggestion: input.suggestion,
          p_verdict: input.verdict,
          p_content_sha256: input.contentSha256,
        }),
      );
    },
    async quarantineComment(input) {
      return parseScreeningWrite(
        await rpc<string>('nw_screening_quarantine_comment', {
          p_suggestion_id: input.suggestionId,
          p_actor_id: input.actorProfileId,
          p_body: input.body,
          p_verdict: input.verdict,
          p_content_sha256: input.contentSha256,
        }),
      );
    },
    async holdRevisionProposal(input) {
      return parseScreeningWrite(
        await rpc<string>('nw_screening_hold_revision_proposal', {
          p_article_id: input.articleId,
          p_author_profile_id: input.authorProfileId,
          p_rev: input.rev,
          p_payload: input.payload,
          p_verdict: input.verdict,
          p_content_sha256: input.contentSha256,
        }),
      );
    },

    async getMyScreeningDecisions(userId) {
      const rows = await rpc<
        Array<{
          id: string;
          content_kind: ScreeningContentKind;
          content_id: string;
          content_rev: number | null;
          auto_action: 'allowed' | 'quarantined' | 'held';
          decision: 'pending' | 'approved' | 'rejected' | 'auto-allowed';
          top_class: string | null;
          requires_human_review: boolean;
          review_reason: string;
          appeal_state: 'none' | 'requested' | 'granted' | 'denied';
          created_at: string;
          reviewed_at: string | null;
        }>
      >('nw_get_my_screening_decisions', { p_user: userId });
      return (rows ?? []).map((row) => ({
        id: row.id,
        contentKind: row.content_kind,
        contentId: row.content_id,
        contentRev: row.content_rev,
        autoAction: row.auto_action,
        decision: row.decision,
        topClass: row.top_class,
        requiresHumanReview: row.requires_human_review,
        reviewReason: row.review_reason,
        appealState: row.appeal_state,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
      }));
    },
    async appealScreeningDecision(input) {
      const raw = await rpc<string>('nw_screening_appeal_request', {
        p_decision_id: input.decisionId,
        p_author_profile_id: input.authorProfileId,
        p_reason: input.reason,
      });
      return isScreeningAppealOutcome(raw) ? raw : 'unavailable';
    },

    /* ------------------ verification center (plan 48 WP8) ----------------- */

    async getVerificationState(profileId) {
      const state = await rpc<string>('nw_verification_state', { p_profile_id: profileId });
      return isVerificationState(state) ? state : 'none';
    },
    async requestVerification(input) {
      const raw = await rpc<string>('nw_verification_request', {
        p_profile_id: input.profileId,
        p_method: input.method,
        p_evidence_ref: input.evidenceRef,
        p_evidence: input.evidence,
      });
      if (typeof raw === 'string' && raw.startsWith('ok:')) {
        return { ok: true, verificationId: raw.slice(3) };
      }
      if (
        raw === 'no-journalist' ||
        raw === 'bad-method' ||
        raw === 'already-pending' ||
        raw === 'already-verified'
      ) {
        return { ok: false, code: raw };
      }
      return { ok: false, code: 'unavailable' };
    },
    async getMyVerifications(userId) {
      const rows = await rpc<
        Array<{
          id: string;
          method: VerificationMethod;
          status: VerificationState;
          decision_reason: string;
          created_at: string;
          decided_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
        }>
      >('nw_get_my_verification', { p_user: userId });
      return (rows ?? []).map((row) => ({
        id: row.id,
        method: row.method,
        status: row.status,
        decisionReason: row.decision_reason,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
      }));
    },
  };
}

/**
 * Every quarantine RPC returns either 'ok:<uuid>' or one of its named failure
 * codes. An unrecognized value is 'unavailable' rather than a guess: a caller
 * must never read an unknown server string as a successful hold.
 */
function parseScreeningWrite(raw: unknown): ScreeningWriteOutcome {
  if (typeof raw === 'string' && raw.startsWith('ok:') && raw.length > 3) {
    return { ok: true, decisionId: raw.slice(3) };
  }
  if (
    raw === 'rev-conflict' ||
    raw === 'slug-conflict' ||
    raw === 'unknown-article' ||
    raw === 'unknown-suggestion' ||
    raw === 'unknown-actor'
  ) {
    return { ok: false, code: raw };
  }
  return { ok: false, code: 'unavailable' };
}

const SCREENING_APPEAL_OUTCOMES: readonly ScreeningAppealOutcome[] = [
  'ok',
  'not-found',
  'not-author',
  'not-appealable',
  'already-appealed',
  'bad-reason',
];

function isScreeningAppealOutcome(value: unknown): value is ScreeningAppealOutcome {
  return (
    typeof value === 'string' && (SCREENING_APPEAL_OUTCOMES as readonly string[]).includes(value)
  );
}

const VERIFICATION_STATES: readonly VerificationState[] = [
  'none',
  'pending',
  'approved',
  'rejected',
  'revoked',
  'expired',
];

function isVerificationState(value: unknown): value is VerificationState {
  return typeof value === 'string' && (VERIFICATION_STATES as readonly string[]).includes(value);
}

/** Raw nw_deletion_requests row as returned by the account-lifecycle RPCs. */
interface DeletionRequestRowJson {
  id: string;
  user_id: string;
  profile_id: string | null;
  status: DeletionStatus;
  requested_at: string;
  grace_ends_at: string;
  cancelled_at: string | null;
  processing_started_at: string | null;
  content_disposed_at: string | null;
  completed_at: string | null;
  failure_detail: string | null;
  auth_user_deletion_state: DeletionSideEffectState;
  processor_cleanup_state: DeletionSideEffectState;
}

function mapDeletionRow(row: DeletionRequestRowJson): DeletionRequestRow {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    status: row.status,
    requestedAt: row.requested_at,
    graceEndsAt: row.grace_ends_at,
    cancelledAt: row.cancelled_at,
    processingStartedAt: row.processing_started_at,
    contentDisposedAt: row.content_disposed_at,
    completedAt: row.completed_at,
    failureDetail: row.failure_detail,
    authUserDeletionState: row.auth_user_deletion_state,
    processorCleanupState: row.processor_cleanup_state,
  };
}

interface NciiCaseRow {
  id: string;
  report_id: string;
  target_kind: ReportTargetKind;
  target_id: string;
  deadline_at: string;
  status: NciiCaseStatus;
  hash_match_status: NciiHashStatus;
  ncmec_ref: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

const NCII_SELECT =
  'id,report_id,target_kind,target_id,deadline_at,status,hash_match_status,ncmec_ref,note,created_at,updated_at';

function mapNciiRow(r: NciiCaseRow): NciiCase {
  return {
    id: r.id,
    reportId: r.report_id,
    targetKind: r.target_kind,
    targetId: r.target_id,
    deadlineAt: r.deadline_at,
    status: r.status,
    hashMatchStatus: r.hash_match_status,
    ncmecRef: r.ncmec_ref,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
