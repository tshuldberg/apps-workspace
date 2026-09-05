import type { ChangelogEntry, ReportReason, ReportTargetKind, SuggestionType } from '../models';
import type { ChainKeyRow } from '../signing/reader-verify';
import type { StructuredDiff } from '../engines/diff';
import { BOUNDS_ERROR, checkCommentBody } from './bounds';
import { deriveEditorAggregates } from './cloud-fetch';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  DELETION_CONFIRMATION_PHRASE,
  type AccountDeletionView,
} from './account';

export type { ReportReason, ReportTargetKind } from '../models';

export interface FeedItem {
  articleId: string;
  slug: string;
  headline: string;
  dek?: string;
  kind: 'news' | 'preprint';
  rev: number;
  publishedAt: string;
  authorHandle: string;
  authorDisplayName: string;
  authorPubkey: string;
  authorTier: 'open' | 'verified';
  /**
   * The byline's profile id. Needed to check that the key which signed a
   * revision really belongs to THIS byline's chain (plan 48 WP6). Optional so
   * existing consumers and fixtures stay valid.
   */
  authorProfileId?: string;
}

export interface RevisionSummary {
  rev: number;
  createdAt: string;
  changelog: ChangelogEntry[];
  /**
   * Signature material AND the signed text, for reader-side verification (plan
   * 48 WP6). A revision signature covers the whole revision, so verifying an
   * OLDER revision needs its text, not just the head's. The article query
   * already selects these columns and used to discard them, so populating them
   * costs no extra request.
   *
   * Optional because feed-shaped reads select only the head's display columns.
   * `verifiedKeyId` is the chain row the server recorded as having verified the
   * write, and null on rows written before the custody chain existed.
   */
  headline?: string;
  dek?: string;
  bodyMd?: string;
  signature?: string;
  signerPubkey?: string;
  verifiedKeyId?: string | null;
}

export interface ArticleView extends FeedItem {
  /** Drafts surface only through getDraftArticle; feeds and search stay published-only. */
  status: 'draft' | 'published' | 'retracted';
  bodyMd: string;
  signature: string;
  signerPubkey: string;
  createdAt: string;
  revisionSummaries: RevisionSummary[];
}

export interface JournalistView {
  /** Profile row id (nw_profiles.id); the report target_id for a 'profile' report. */
  id?: string;
  handle: string;
  displayName: string;
  tier: 'open' | 'verified';
  bio: string;
  beats: string[];
  pubkey: string;
  articles: FeedItem[];
  /**
   * Verification state from nw_public_journalists (plan 48 WP8). Absent on
   * shapes built before the verification center, which read as unverified: the
   * badge renders only for a live 'approved' state, never for a missing one.
   */
  verificationState?: VerificationStateView;
  /** Expiry of a live approval, when one exists. */
  verificationExpiresAt?: string | null;
}

/**
 * Public verification state (plan 48 WP8). Twin of nw_verification_state and of
 * the credibility engine's VerificationState. Only 'approved' means verified.
 */
export type VerificationStateView =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired';

/** Verification evidence routes an operator can check. */
export type VerificationMethodView = 'domain_email' | 'orcid' | 'byline' | 'manual';

/** One row of the caller's own verification history. */
export interface VerificationRecordView {
  id: string;
  method: VerificationMethodView;
  status: VerificationStateView;
  /** Operator reason for an approval, denial, or revocation. */
  decisionReason: string;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/**
 * One of the caller's submissions held by pre-publication screening (plan 48
 * WP8). Deliberately carries no class scores, signal codes, or thresholds: the
 * server omits them so an appeal screen cannot be used to tune an evasion.
 */
export interface ScreeningHoldView {
  id: string;
  contentKind: 'article' | 'revision' | 'suggestion' | 'comment' | 'revision-proposal';
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

export interface SearchResult {
  kind: 'article' | 'journalist';
  ref: string;
  title: string;
  snippet: string;
}

export interface SuggestionView {
  id: string;
  articleId: string;
  articleSlug: string;
  articleHeadline: string;
  baseRev: number;
  editorId: string;
  editorHandle: string;
  editorDisplayName: string;
  /** Editor's Ed25519 pubkey; feeds the changelog triple [suggestionId, editorKey, type] (LEAD-pinned C9 addition). */
  editorPubkey: string;
  type: SuggestionType;
  diff: StructuredDiff;
  citations: string[];
  rationale: string;
  status: 'open' | 'accepted' | 'partial' | 'rejected' | 'stale';
  createdAt: string;
  /** Count of nw_suggestion_dupes rows recorded against this suggestion. */
  endorsements: number;
}

export interface SuggestionEventView {
  id: string;
  suggestionId: string;
  actorId: string;
  actorHandle: string;
  action: 'comment' | 'accept' | 'reject' | 'partial' | 'rebase';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProfileView {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  pubkeyEd25519: string;
  kind: 'reader' | 'editor' | 'journalist';
}

export interface LedgerRowView {
  id: string;
  editorId: string;
  suggestionId: string;
  basePoints: number;
  diversityMult: number;
  standingMult: number;
  awardedAt: string;
  /** Joined via suggestion -> article for pair concentration. */
  type: SuggestionType | null;
  authorId: string | null;
}

export interface EditorProfileView {
  profile: Pick<ProfileView, 'id' | 'handle' | 'displayName' | 'kind'>;
  ledger: LedgerRowView[];
  aggregates: {
    openCount: number;
    acceptanceRate: number;
    decidedSampleSize: number;
    distinctAuthors: number;
  };
}

export interface NewsroomView {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export interface NewsroomMemberView {
  newsroomId: string;
  profileId: string;
  handle: string;
  displayName: string;
  role: 'owner' | 'coauthor' | 'reviewer';
}

export interface NewsroomDraftView {
  articleId: string;
  slug: string;
  headline: string;
  rev: number;
  updatedAt: string;
  embargoUntil: string | null;
  authorHandle: string;
}

/**
 * Full provenance metadata for an article (nw_article_meta). Every field is an
 * author assertion bound under the article-meta signature; reads carry the
 * signature + signer so the record stays offline re-verifiable.
 */
export interface ArticleMetaView {
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

export type FunctionEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; detail?: string };

export type MyNewsFunctionName =
  | 'mynews-publish'
  | 'mynews-suggest'
  | 'mynews-review'
  | 'mynews-register-key'
  | 'mynews-set-meta'
  | 'mynews-report'
  | 'mynews-comment'
  | 'mynews-my-notices'
  | 'mynews-account'
  /** Plan 48 WP8: author-facing screening holds and appeals. */
  | 'mynews-screening'
  /** Plan 48 WP8: journalist verification requests and status. */
  | 'mynews-verification';

/**
 * A DSA Art 17 statement of reasons about the caller's OWN content, returned by
 * the mynews-my-notices edge function. The user can only ever read notices
 * about content they own; nw_moderation_actions is never exposed to clients.
 */
export interface ModerationNoticeView {
  targetKind: string;
  targetId: string;
  /** Machine-readable action, e.g. 'hide_article' | 'suspend_profile'. */
  machineReason: string;
  /** Human statement of reasons the moderator recorded. */
  note: string;
  createdAt: string;
  /**
   * Appeal fields (plan 48 WP9). `actionId` is what an appeal names; a notice
   * without one predates the appeal path and honestly cannot be appealed rather
   * than showing a button that would fail.
   */
  actionId: string | null;
  appealState: 'none' | 'requested' | 'granted' | 'denied';
  appealReason: string;
  appealDecisionReason: string;
  /** What a granted appeal reversed, or null when it reversed nothing. */
  appealReversalOutcome: string | null;
  appealDecidedAt: string | null;
}

/** A reporter's own report row (nw_reports_reporter_select). */
export interface ReportView {
  id: string;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail: string;
  status: 'open' | 'actioned' | 'no_action';
  createdAt: string;
}

/** `block` hard-hides the author; `mute` softly hides (still removed from feed). */
export type BlockMode = 'block' | 'mute';

/**
 * One of the blocker's own block/mute rows (nw_blocks_self_all). Carries both the
 * blocked profile id and that profile's pubkey so the pure feed/suggestion filter
 * can drop entries keyed either way (the feed is keyed by author pubkey, the
 * suggestion lists by editor profile id). The blocked user can never read this.
 */
export interface BlockView {
  id: string;
  blockedProfileId: string;
  blockedPubkey: string;
  blockedHandle: string;
  blockedDisplayName: string;
  mode: BlockMode;
  createdAt: string;
}

export interface MyNewsCloudPort {
  getFeed(input: {
    followedPubkeys: string[];
    beforePublishedAt?: string;
    limit?: number;
  }): Promise<FeedItem[]>;
  /** Newest published articles across all authors (no-follow browse; anon read). */
  getLatest(limit?: number): Promise<FeedItem[]>;
  getArticleBySlug(slug: string): Promise<ArticleView | null>;
  getJournalistByHandle(handle: string): Promise<JournalistView | null>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  callFunction<T>(name: MyNewsFunctionName, body: unknown): Promise<FunctionEnvelope<T>>;
  /** Session bearer; null when signed out or no row. */
  getMyProfile(): Promise<ProfileView | null>;
  isHandleAvailable(handle: string): Promise<boolean>;
  registerProfile(input: {
    userId: string;
    handle: string;
    displayName: string;
  }): Promise<{ ok: true; profile: ProfileView } | { ok: false; error: 'handle-taken' | 'not-signed-in' | string }>;
  /**
   * Bind the device Ed25519 key to the caller's own profile via
   * mynews-register-key (proof-of-possession). The key can no longer be set at
   * profile-insert time (RLS guard trigger); this is the only write path. The
   * signature is over canonicalKeyPossessionBytes(userId, pubkeyHex).
   */
  registerKey(input: {
    userId: string;
    pubkeyHex: string;
    signatureHex: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * The PUBLIC key chain for one profile (nw_profile_keys), for reader-side
   * authorship verification (plan 48 WP6). Public because it is the record a
   * reader needs to check that the key which signed a revision really belongs to
   * the byline; it carries public keys and server-ordered transition metadata
   * only. Returns [] for a profile with no chain rows.
   */
  getProfileKeyChain(profileId: string): Promise<ChainKeyRow[]>;
  becomeJournalist(input: {
    profileId: string;
    bio: string;
    beats: string[];
    region: string;
  }): Promise<{ ok: boolean; error?: string }>;
  getSuggestionsForArticle(
    articleId: string,
    opts?: { status?: SuggestionView['status'] },
  ): Promise<SuggestionView[]>;
  getSuggestion(id: string): Promise<SuggestionView | null>;
  getMySuggestions(editorProfileId: string): Promise<SuggestionView[]>;
  /** Open suggestions across my articles. */
  getReviewQueue(authorProfileId: string): Promise<SuggestionView[]>;
  getSuggestionEvents(suggestionId: string): Promise<SuggestionEventView[]>;
  /**
   * Post a comment on a suggestion thread through the mynews-comment edge
   * function (plan 48 WP4). The direct PostgREST insert is gone: the server
   * resolves the actor from the session, refuses suspended accounts, requires
   * current Terms, throttles to ten comments a minute, bounds the body, and
   * hides draft threads from non-members. `actorProfileId` is kept for the
   * in-memory adapter and for callers' own optimistic UI; the server never
   * trusts it and always uses the JWT-resolved profile.
   * Typed errors: not-signed-in, no-profile, suspended, terms-not-accepted,
   * rate-limited, bounds, unknown-suggestion, unknown-article, draft-access,
   * comment-unavailable, comment-network.
   */
  postSuggestionComment(input: {
    suggestionId: string;
    actorProfileId: string;
    body: string;
  }): Promise<{ ok: boolean; error?: string }>;
  getEditorProfile(handle: string): Promise<EditorProfileView | null>;
  listMyNewsrooms(profileId: string): Promise<NewsroomView[]>;
  createNewsroom(input: {
    ownerId: string;
    name: string;
  }): Promise<{ ok: true; newsroom: NewsroomView } | { ok: false; error: string }>;
  getNewsroom(id: string): Promise<{
    newsroom: NewsroomView;
    members: NewsroomMemberView[];
    drafts: NewsroomDraftView[];
  } | null>;
  addNewsroomMember(input: {
    newsroomId: string;
    handle: string;
    role: 'coauthor' | 'reviewer';
    invitedBy: string;
  }): Promise<{ ok: boolean; error?: 'unknown-handle' | string }>;
  removeNewsroomMember(input: {
    newsroomId: string;
    profileId: string;
  }): Promise<{ ok: boolean; error?: string }>;
  /** Session bearer (RLS: author or newsroom member). */
  getDraftArticle(articleId: string): Promise<ArticleView | null>;
  /**
   * Read the current signed provenance metadata for an article, or null when no
   * meta row exists yet. Used to read-modify-sign before setArticleMeta so a
   * single-field edit (e.g. embargo) does not clobber the other signed fields.
   * Session bearer (RLS: public non-draft + owner + newsroom-member select).
   */
  getArticleMeta(articleId: string): Promise<ArticleMetaView | null>;
  /**
   * Author-signed provenance-metadata upsert via mynews-set-meta. The client
   * signs canonicalArticleMetaBytes over ALL fields; the server verifies against
   * the head author key and confirms the caller is the head author before the
   * service role writes nw_article_meta (the client-write guard trigger forbids
   * any direct client write). The port only forwards the pre-signed payload.
   */
  setArticleMeta(input: {
    meta: {
      articleId: string;
      doi: string | null;
      orcidAuthors: string[];
      license: string;
      rightsRoute: string;
      embargoUntil: string | null;
      datasetHashes: string[];
      canonicalUrl: string | null;
      signerPubkey: string;
    };
    signatureHex: string;
  }): Promise<{ ok: boolean; error?: string }>;
  /**
   * File a content report via mynews-report (Apple Guideline 1.2). Requires a
   * session (the function rejects 'not-signed-in' otherwise); the server
   * validates the target exists, dedupes one open report per target, and
   * rate-limits. Returns the typed envelope so the UI maps error codes to honest
   * copy. A direct client insert is blocked by the client-write guard trigger.
   */
  submitReport(input: {
    targetKind: ReportTargetKind;
    targetId: string;
    reason: ReportReason;
    detail?: string;
  }): Promise<
    | { ok: true; status: 'submitted' | 'already-reported' }
    | { ok: false; error: string }
  >;
  /** The reporter's own reports, newest first (nw_reports_reporter_select). */
  getMyReports(reporterProfileId: string): Promise<ReportView[]>;
  /**
   * The signed-in blocker's own block/mute list, newest first
   * (nw_blocks_self_all). Self-scoped: this only ever returns the caller's rows,
   * and the blocked user can never read who blocked them.
   */
  listBlocks(): Promise<BlockView[]>;
  /**
   * Block or mute an author (idempotent upsert on the unique
   * (blocker, blocked) pair, so re-calling with a new mode switches it). The
   * blocker owns the row directly (no edge function): the RLS with-check binds
   * the row to the caller's own profile. Requires a session and a profile.
   */
  setBlock(
    blockedProfileId: string,
    mode: BlockMode,
  ): Promise<{ ok: boolean; error?: string }>;
  /** Remove a block/mute so the author's content returns to the blocker's feeds. */
  removeBlock(blockedProfileId: string): Promise<{ ok: boolean; error?: string }>;
  /**
   * Terms versions the signed-in user has accepted (nw_terms_acceptance,
   * self-scoped RLS). Empty when signed out or none accepted. The publish/
   * suggest gate re-checks server-side; this drives the acceptance UI.
   */
  getAcceptedTermsVersions(): Promise<string[]>;
  /**
   * Record acceptance of `version` for the signed-in user. Self-attesting
   * client insert allowed by nw_terms_acceptance_self_all; the write is
   * idempotent on (user_id, terms_version). Requires a session.
   */
  acceptTerms(version: string): Promise<{ ok: boolean; error?: string }>;
  /**
   * DSA Art 17 statements of reasons about the caller's OWN content
   * (mynews-my-notices edge fn). Scoped server-side to owned content only.
   */
  getMyModerationNotices(): Promise<ModerationNoticeView[]>;
  /**
   * Appeal ONE moderation action taken against the caller's own content
   * (mynews-my-notices edge fn, plan 48 WP9). One appeal per action; the same
   * 'not-found' answer covers a missing action and someone else's, so this cannot
   * be used to probe which action ids exist.
   * Typed errors: not-signed-in, no-profile, not-found, not-appealable,
   * already-appealed, bad-payload, appeals-unavailable.
   */
  appealModerationNotice(input: {
    actionId: string;
    reason: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * The caller's own submissions held by pre-publication screening
   * (mynews-screening edge fn, plan 48 WP8). Curated by the server: an author
   * sees which class held their content and how to appeal, never the detector's
   * scores or matched terms.
   */
  listScreeningHolds(): Promise<
    { ok: true; holds: ScreeningHoldView[] } | { ok: false; error: string }
  >;
  /**
   * Contest one held submission. One appeal per decision; the same 'not-found'
   * answer covers a missing decision and someone else's, so this cannot be used
   * to probe which decision ids exist.
   * Typed errors: not-signed-in, no-profile, not-found, not-appealable,
   * already-appealed, bad-payload, screening-unavailable.
   */
  appealScreeningHold(input: {
    decisionId: string;
    reason: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * File a journalist verification request with evidence references
   * (mynews-verification edge fn, plan 48 WP8). Approval, denial, revocation,
   * and expiry are operator actions in the console; this only queues a request.
   * Typed errors: not-signed-in, no-profile, no-journalist, suspended,
   * terms-not-accepted, rate-limited, already-pending, already-verified,
   * bad-payload, verification-unavailable.
   */
  requestVerification(input: {
    method: VerificationMethodView;
    evidenceRef: string;
    evidence: string[];
  }): Promise<{ ok: true; verificationId: string } | { ok: false; error: string }>;
  /** The caller's verification state and request history. */
  getVerificationStatus(): Promise<
    | { ok: true; state: VerificationStateView; history: VerificationRecordView[] }
    | { ok: false; error: string }
  >;
  /**
   * Open a deletion request (mynews-account edge fn). `confirmation` must be
   * DELETION_CONFIRMATION_PHRASE typed exactly; the server also requires a fresh
   * access token. Nothing is destroyed until the disclosed grace window ends.
   * Typed errors: not-signed-in, bad-payload, confirmation-mismatch,
   * reauth-required, deletion-unavailable, account-unavailable.
   */
  initiateAccountDeletion(
    confirmation: string,
  ): Promise<
    | { ok: true; created: boolean; request: AccountDeletionView }
    | { ok: false; error: string }
  >;
  /**
   * Call off a deletion that is still inside its grace window.
   * Typed errors: no-deletion-request, not-cancellable, deletion-unavailable.
   */
  cancelAccountDeletion(): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Durable deletion status, or null when no request was ever made. */
  getAccountDeletionStatus(): Promise<
    { ok: true; request: AccountDeletionView | null } | { ok: false; error: string }
  >;
  /**
   * Every row the account owns, as one JSON document (mynews-account
   * export_data). Typed errors: export-too-large, export-unavailable.
   */
  exportAccountData(): Promise<
    | { ok: true; byteCount: number; bundle: Record<string, unknown> }
    | { ok: false; error: string }
  >;
}

export type { AccountDeletionView } from './account';

/** Seed shape: the article author id backs getReviewQueue joins in memory. */
export type SeededSuggestion = SuggestionView & { articleAuthorId: string };

/** Seed shape: the newsroom id backs getNewsroom draft filtering in memory. */
export type SeededNewsroomDraft = NewsroomDraftView & { newsroomId: string };

/**
 * Deterministic in-memory adapter: backs unit tests and never ships as a
 * live data source (honesty rule: no demo content presented as live).
 */
export class InMemoryCloudAdapter implements MyNewsCloudPort {
  articles: ArticleView[] = [];
  journalists: JournalistView[] = [];
  profiles: ProfileView[] = [];
  suggestions: SeededSuggestion[] = [];
  suggestionEvents: SuggestionEventView[] = [];
  ledger: LedgerRowView[] = [];
  newsrooms: NewsroomView[] = [];
  newsroomMembers: NewsroomMemberView[] = [];
  newsroomDrafts: SeededNewsroomDraft[] = [];
  /** Mirrors nw_article_meta rows; setArticleMeta upserts here. */
  articleMeta: ArticleMetaView[] = [];
  /** Mirrors nw_reports rows; submitReport inserts here (reporterProfileId keyed). */
  reports: Array<ReportView & { reporterProfileId: string }> = [];
  /** Mirrors nw_blocks rows; setBlock upserts here (blockerProfileId keyed). */
  blocks: Array<{ id: string; blockerProfileId: string; blockedProfileId: string; mode: BlockMode; createdAt: string }> = [];
  /** Mirrors nw_terms_acceptance; acceptTerms inserts here (userId keyed). */
  termsAcceptances: Array<{ userId: string; version: string }> = [];
  /** Statements of reasons visible to the caller (already scoped in real edge). */
  moderationNotices: Array<ModerationNoticeView & { ownerUserId: string }> = [];
  /** Mirrors nw_deletion_requests, newest last (userId keyed). */
  deletionRequests: Array<{ userId: string; request: AccountDeletionView }> = [];
  /** Mirrors nw_export_jobs: the audit of a request, never the exported data. */
  exportJobs: Array<{
    userId: string;
    status: 'completed' | 'failed';
    byteCount: number;
    requestedAt: string;
  }> = [];
  draftArticles: ArticleView[] = [];
  journalistApplications: Array<{ profileId: string; bio: string; beats: string[]; region: string }> = [];
  /** Simulates the session bearer: null behaves like a signed-out fetch adapter. */
  sessionUserId: string | null = null;
  now: () => string = () => new Date().toISOString();
  functionHandler: (name: MyNewsFunctionName, body: unknown) => FunctionEnvelope<unknown> = () => ({
    ok: false,
    error: 'no-function-handler',
  });

  async getFeed(input: {
    followedPubkeys: string[];
    beforePublishedAt?: string;
    limit?: number;
  }): Promise<FeedItem[]> {
    const limit = input.limit ?? 50;
    const keys = new Set(input.followedPubkeys);
    return this.articles
      .filter((a) => a.status === 'published' && keys.has(a.authorPubkey))
      .filter((a) => !input.beforePublishedAt || a.publishedAt < input.beforePublishedAt)
      .sort((x, y) => (x.publishedAt < y.publishedAt ? 1 : -1))
      .slice(0, limit)
      .map(({ status: _s, bodyMd: _b, signature: _sig, signerPubkey: _sp, createdAt: _c, revisionSummaries: _r, ...item }) => item);
  }

  async getLatest(limit = 30): Promise<FeedItem[]> {
    return this.articles
      .filter((a) => a.status === 'published')
      .sort((x, y) => (x.publishedAt < y.publishedAt ? 1 : -1))
      .slice(0, limit)
      .map(({ status: _s, bodyMd: _b, signature: _sig, signerPubkey: _sp, createdAt: _c, revisionSummaries: _r, ...item }) => item);
  }

  async getArticleBySlug(slug: string): Promise<ArticleView | null> {
    return this.articles.find((a) => a.slug === slug) ?? null;
  }

  async getJournalistByHandle(handle: string): Promise<JournalistView | null> {
    const found = this.journalists.find((j) => j.handle === handle);
    if (!found) return null;
    // Resolve the profile id (report target for a 'profile' report) when a
    // matching profile is seeded; keep the seeded id if one was set.
    const id =
      found.id ?? this.profiles.find((p) => p.handle === handle || p.pubkeyEd25519 === found.pubkey)?.id;
    return id ? { ...found, id } : found;
  }

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const q = query.toLowerCase();
    const articleHits: SearchResult[] = this.articles
      .filter((a) => a.status === 'published')
      .filter((a) => a.headline.toLowerCase().includes(q) || a.bodyMd.toLowerCase().includes(q))
      .map((a) => ({ kind: 'article', ref: a.slug, title: a.headline, snippet: a.dek ?? '' }));
    const journalistHits: SearchResult[] = this.journalists
      .filter((j) => j.handle.includes(q) || j.displayName.toLowerCase().includes(q))
      .map((j) => ({ kind: 'journalist', ref: j.handle, title: j.displayName, snippet: j.bio }));
    return [...articleHits, ...journalistHits].slice(0, limit);
  }

  async callFunction<T>(name: MyNewsFunctionName, body: unknown): Promise<FunctionEnvelope<T>> {
    return this.functionHandler(name, body) as FunctionEnvelope<T>;
  }

  async getMyProfile(): Promise<ProfileView | null> {
    if (!this.sessionUserId) return null;
    return this.profiles.find((p) => p.userId === this.sessionUserId) ?? null;
  }

  async isHandleAvailable(handle: string): Promise<boolean> {
    return !this.profiles.some((p) => p.handle === handle);
  }

  async registerProfile(input: {
    userId: string;
    handle: string;
    displayName: string;
  }): Promise<{ ok: true; profile: ProfileView } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (this.profiles.some((p) => p.handle === input.handle)) {
      return { ok: false, error: 'handle-taken' };
    }
    // The pubkey is bound in a second step via registerKey (proof-of-possession);
    // a freshly inserted profile carries the empty-key default, mirroring the
    // server RLS guard that forbids setting a non-empty key at insert time.
    const profile: ProfileView = {
      id: `mem-profile-${this.profiles.length + 1}`,
      userId: input.userId,
      handle: input.handle,
      displayName: input.displayName,
      pubkeyEd25519: '',
      kind: 'reader',
    };
    this.profiles.push(profile);
    return { ok: true, profile };
  }

  async registerKey(input: {
    userId: string;
    pubkeyHex: string;
    signatureHex: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const mine = this.profiles.find((p) => p.userId === input.userId);
    if (!mine) return { ok: false, error: 'no-profile' };
    if (mine.pubkeyEd25519 !== '') return { ok: false, error: 'already-set' };
    if (this.profiles.some((p) => p.id !== mine.id && p.pubkeyEd25519 === input.pubkeyHex)) {
      return { ok: false, error: 'pubkey-conflict' };
    }
    mine.pubkeyEd25519 = input.pubkeyHex;
    return { ok: true };
  }

  async getProfileKeyChain(_profileId: string): Promise<ChainKeyRow[]> {
    // The in-memory adapter models the P1 single-key world, where a profile has
    // one lifetime key and therefore no chain to read. Returning [] makes the
    // reader verifier report 'chain-unrecorded' here, which is the honest answer
    // for a store that holds no chain, not a silent pass.
    return [];
  }

  async becomeJournalist(input: {
    profileId: string;
    bio: string;
    beats: string[];
    region: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (!this.profiles.some((p) => p.id === input.profileId)) {
      return { ok: false, error: 'unknown-profile' };
    }
    this.journalistApplications.push({ ...input });
    return { ok: true };
  }

  async getSuggestionsForArticle(
    articleId: string,
    opts?: { status?: SuggestionView['status'] },
  ): Promise<SuggestionView[]> {
    return this.suggestions
      .filter((s) => s.articleId === articleId)
      .filter((s) => !opts?.status || s.status === opts.status)
      .sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))
      .map(stripSeed);
  }

  async getSuggestion(id: string): Promise<SuggestionView | null> {
    const found = this.suggestions.find((s) => s.id === id);
    return found ? stripSeed(found) : null;
  }

  async getMySuggestions(editorProfileId: string): Promise<SuggestionView[]> {
    return this.suggestions
      .filter((s) => s.editorId === editorProfileId)
      .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
      .map(stripSeed);
  }

  async getReviewQueue(authorProfileId: string): Promise<SuggestionView[]> {
    return this.suggestions
      .filter((s) => s.status === 'open' && s.articleAuthorId === authorProfileId)
      .sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))
      .map(stripSeed);
  }

  async getSuggestionEvents(suggestionId: string): Promise<SuggestionEventView[]> {
    return this.suggestionEvents
      .filter((e) => e.suggestionId === suggestionId)
      .sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1));
  }

  /**
   * Mirrors the gates the mynews-comment function applies that this adapter
   * can model: session, profile, body bounds, and thread existence. Suspension,
   * current-Terms, the ten-per-minute throttle, and the draft-visibility rule
   * are server-side and are covered by the edge tests
   * (supabase/functions/mynews-comment/__tests__/index.test.ts).
   */
  async postSuggestionComment(input: {
    suggestionId: string;
    actorProfileId: string;
    body: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const bounded = checkCommentBody(input.body);
    if (!bounded.ok) return { ok: false, error: BOUNDS_ERROR };
    if (!this.suggestions.some((s) => s.id === input.suggestionId)) {
      return { ok: false, error: 'unknown-suggestion' };
    }
    this.suggestionEvents.push({
      id: `mem-event-${this.suggestionEvents.length + 1}`,
      suggestionId: input.suggestionId,
      actorId: input.actorProfileId,
      actorHandle: this.profiles.find((p) => p.id === input.actorProfileId)?.handle ?? '',
      action: 'comment',
      payload: { body: input.body },
      createdAt: this.now(),
    });
    return { ok: true };
  }

  async getEditorProfile(handle: string): Promise<EditorProfileView | null> {
    const profile = this.profiles.find((p) => p.handle === handle);
    if (!profile) return null;
    const ledger = this.ledger
      .filter((l) => l.editorId === profile.id)
      .sort((x, y) => (x.awardedAt < y.awardedAt ? 1 : -1));
    const stats = this.suggestions
      .filter((s) => s.editorId === profile.id)
      .map((s) => ({ status: s.status, authorId: s.articleAuthorId }));
    return {
      profile: {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        kind: profile.kind,
      },
      ledger,
      aggregates: deriveEditorAggregates(stats),
    };
  }

  async listMyNewsrooms(profileId: string): Promise<NewsroomView[]> {
    if (!this.sessionUserId) return [];
    const roomIds = new Set(
      this.newsroomMembers.filter((m) => m.profileId === profileId).map((m) => m.newsroomId),
    );
    return this.newsrooms.filter((n) => roomIds.has(n.id));
  }

  async createNewsroom(input: {
    ownerId: string;
    name: string;
  }): Promise<{ ok: true; newsroom: NewsroomView } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const owner = this.profiles.find((p) => p.id === input.ownerId);
    const newsroom: NewsroomView = {
      id: `mem-newsroom-${this.newsrooms.length + 1}`,
      ownerId: input.ownerId,
      name: input.name,
      createdAt: this.now(),
    };
    this.newsrooms.push(newsroom);
    this.newsroomMembers.push({
      newsroomId: newsroom.id,
      profileId: input.ownerId,
      handle: owner?.handle ?? '',
      displayName: owner?.displayName ?? '',
      role: 'owner',
    });
    return { ok: true, newsroom };
  }

  async getNewsroom(id: string): Promise<{
    newsroom: NewsroomView;
    members: NewsroomMemberView[];
    drafts: NewsroomDraftView[];
  } | null> {
    if (!this.sessionUserId) return null;
    const newsroom = this.newsrooms.find((n) => n.id === id);
    if (!newsroom) return null;
    return {
      newsroom,
      members: this.newsroomMembers.filter((m) => m.newsroomId === id),
      drafts: this.newsroomDrafts
        .filter((d) => d.newsroomId === id)
        .map(({ newsroomId: _n, ...draft }) => draft),
    };
  }

  async addNewsroomMember(input: {
    newsroomId: string;
    handle: string;
    role: 'coauthor' | 'reviewer';
    invitedBy: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const profile = this.profiles.find((p) => p.handle === input.handle);
    if (!profile) return { ok: false, error: 'unknown-handle' };
    this.newsroomMembers.push({
      newsroomId: input.newsroomId,
      profileId: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      role: input.role,
    });
    return { ok: true };
  }

  async removeNewsroomMember(input: {
    newsroomId: string;
    profileId: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    this.newsroomMembers = this.newsroomMembers.filter(
      (m) => !(m.newsroomId === input.newsroomId && m.profileId === input.profileId),
    );
    return { ok: true };
  }

  async getDraftArticle(articleId: string): Promise<ArticleView | null> {
    if (!this.sessionUserId) return null;
    const draft = this.draftArticles.find((a) => a.articleId === articleId);
    // Mirror the fetch adapter: draft rows map with status 'draft' and no publish time.
    if (draft) return { ...draft, status: 'draft', publishedAt: '' };
    return this.articles.find((a) => a.articleId === articleId) ?? null;
  }

  async getArticleMeta(articleId: string): Promise<ArticleMetaView | null> {
    return this.articleMeta.find((m) => m.articleId === articleId) ?? null;
  }

  async setArticleMeta(input: {
    meta: {
      articleId: string;
      doi: string | null;
      orcidAuthors: string[];
      license: string;
      rightsRoute: string;
      embargoUntil: string | null;
      datasetHashes: string[];
      canonicalUrl: string | null;
      signerPubkey: string;
    };
    signatureHex: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (input.signatureHex === '') return { ok: false, error: 'bad-signature' };
    // Mirror the head-author gate: only the article's author key may write meta.
    const article =
      this.articles.find((a) => a.articleId === input.meta.articleId) ??
      this.draftArticles.find((a) => a.articleId === input.meta.articleId);
    if (article && input.meta.signerPubkey !== article.signerPubkey) {
      return { ok: false, error: 'not-author' };
    }
    const row: ArticleMetaView = {
      ...input.meta,
      signature: input.signatureHex,
    };
    const existing = this.articleMeta.find((m) => m.articleId === input.meta.articleId);
    if (existing) {
      Object.assign(existing, row);
    } else {
      this.articleMeta.push(row);
    }
    for (const draft of this.newsroomDrafts) {
      if (draft.articleId === input.meta.articleId) draft.embargoUntil = input.meta.embargoUntil;
    }
    return { ok: true };
  }

  private reportTargetExists(kind: ReportTargetKind, targetId: string): boolean {
    switch (kind) {
      case 'article':
      case 'revision':
        return (
          this.articles.some((a) => a.articleId === targetId) ||
          this.draftArticles.some((a) => a.articleId === targetId)
        );
      case 'suggestion':
        return this.suggestions.some((s) => s.id === targetId);
      case 'profile':
        return this.profiles.some((p) => p.id === targetId);
      case 'media':
        return targetId.trim().length > 0;
      default:
        return false;
    }
  }

  async submitReport(input: {
    targetKind: ReportTargetKind;
    targetId: string;
    reason: ReportReason;
    detail?: string;
  }): Promise<
    | { ok: true; status: 'submitted' | 'already-reported' }
    | { ok: false; error: string }
  > {
    // Mirror the edge guard order: session, profile, target, dedupe.
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const profile = this.profiles.find((p) => p.userId === this.sessionUserId);
    if (!profile) return { ok: false, error: 'no-profile' };
    if (!this.reportTargetExists(input.targetKind, input.targetId)) {
      return { ok: false, error: 'bad-target' };
    }
    const open = this.reports.find(
      (r) =>
        r.reporterProfileId === profile.id &&
        r.targetKind === input.targetKind &&
        r.targetId === input.targetId &&
        r.status === 'open',
    );
    if (open) return { ok: true, status: 'already-reported' };
    this.reports.push({
      id: `mem-report-${this.reports.length + 1}`,
      reporterProfileId: profile.id,
      targetKind: input.targetKind,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail ?? '',
      status: 'open',
      createdAt: this.now(),
    });
    return { ok: true, status: 'submitted' };
  }

  async getMyReports(reporterProfileId: string): Promise<ReportView[]> {
    return this.reports
      .filter((r) => r.reporterProfileId === reporterProfileId)
      .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
      .map(({ reporterProfileId: _r, ...view }) => view);
  }

  /** Resolve the signed-in blocker's own profile id, mirroring the RLS scope. */
  private myProfileId(): string | null {
    if (!this.sessionUserId) return null;
    return this.profiles.find((p) => p.userId === this.sessionUserId)?.id ?? null;
  }

  async listBlocks(): Promise<BlockView[]> {
    const mine = this.myProfileId();
    if (!mine) return [];
    return this.blocks
      .filter((b) => b.blockerProfileId === mine)
      .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
      .map((b) => {
        const p = this.profiles.find((pr) => pr.id === b.blockedProfileId);
        return {
          id: b.id,
          blockedProfileId: b.blockedProfileId,
          blockedPubkey: p?.pubkeyEd25519 ?? '',
          blockedHandle: p?.handle ?? '',
          blockedDisplayName: p?.displayName ?? '',
          mode: b.mode,
          createdAt: b.createdAt,
        };
      });
  }

  async setBlock(
    blockedProfileId: string,
    mode: BlockMode,
  ): Promise<{ ok: boolean; error?: string }> {
    const mine = this.myProfileId();
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (!mine) return { ok: false, error: 'no-profile' };
    if (blockedProfileId === mine) return { ok: false, error: 'cannot-block-self' };
    const existing = this.blocks.find(
      (b) => b.blockerProfileId === mine && b.blockedProfileId === blockedProfileId,
    );
    if (existing) {
      existing.mode = mode;
    } else {
      this.blocks.push({
        id: `mem-block-${this.blocks.length + 1}`,
        blockerProfileId: mine,
        blockedProfileId,
        mode,
        createdAt: this.now(),
      });
    }
    return { ok: true };
  }

  async removeBlock(blockedProfileId: string): Promise<{ ok: boolean; error?: string }> {
    const mine = this.myProfileId();
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (!mine) return { ok: false, error: 'no-profile' };
    this.blocks = this.blocks.filter(
      (b) => !(b.blockerProfileId === mine && b.blockedProfileId === blockedProfileId),
    );
    return { ok: true };
  }

  async getAcceptedTermsVersions(): Promise<string[]> {
    if (!this.sessionUserId) return [];
    return this.termsAcceptances
      .filter((t) => t.userId === this.sessionUserId)
      .map((t) => t.version);
  }

  async acceptTerms(version: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const already = this.termsAcceptances.some(
      (t) => t.userId === this.sessionUserId && t.version === version,
    );
    if (!already) this.termsAcceptances.push({ userId: this.sessionUserId, version });
    return { ok: true };
  }

  async getMyModerationNotices(): Promise<ModerationNoticeView[]> {
    if (!this.sessionUserId) return [];
    return this.moderationNotices
      .filter((n) => n.ownerUserId === this.sessionUserId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map(({ ownerUserId: _o, ...view }) => view);
  }

  /**
   * In-memory twin of the mynews-my-notices appeal path. Guard order mirrors the
   * handler, so a screen built against this adapter meets the same refusals the
   * server produces.
   */
  async appealModerationNotice(input: {
    actionId: string;
    reason: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (input.reason.trim() === '') return { ok: false, error: 'bad-payload' };
    const notice = this.moderationNotices.find((row) => row.actionId === input.actionId);
    // Someone else's action answers exactly like a missing one.
    if (!notice || notice.ownerUserId !== this.sessionUserId) {
      return { ok: false, error: 'not-found' };
    }
    if (notice.appealState !== 'none') return { ok: false, error: 'already-appealed' };
    notice.appealState = 'requested';
    notice.appealReason = input.reason.trim();
    return { ok: true };
  }

  /* ---------------- screening + verification (plan 48 WP8) ---------------- */
  // Seedable in-memory twins of the mynews-screening and mynews-verification
  // edges. Guard order mirrors the handlers so a screen built against this
  // adapter exercises the same refusals the server produces.

  screeningHolds: Array<ScreeningHoldView & { ownerUserId: string }> = [];
  verificationRecords: Array<VerificationRecordView & { ownerUserId: string }> = [];

  async listScreeningHolds(): Promise<
    { ok: true; holds: ScreeningHoldView[] } | { ok: false; error: string }
  > {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const holds = this.screeningHolds
      .filter((row) => row.ownerUserId === this.sessionUserId && row.autoAction !== 'allowed')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map(({ ownerUserId: _o, ...view }) => view);
    return { ok: true, holds };
  }

  async appealScreeningHold(input: {
    decisionId: string;
    reason: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (input.reason.trim() === '') return { ok: false, error: 'bad-payload' };
    const row = this.screeningHolds.find((hold) => hold.id === input.decisionId);
    // A decision that is not the caller's answers exactly like a missing one.
    if (!row || row.ownerUserId !== this.sessionUserId) {
      return { ok: false, error: 'not-found' };
    }
    if (row.autoAction === 'allowed') return { ok: false, error: 'not-appealable' };
    if (row.appealState !== 'none') return { ok: false, error: 'already-appealed' };
    row.appealState = 'requested';
    return { ok: true };
  }

  async requestVerification(input: {
    method: VerificationMethodView;
    evidenceRef: string;
    evidence: string[];
  }): Promise<{ ok: true; verificationId: string } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (input.evidenceRef.trim() === '' && input.evidence.length === 0) {
      return { ok: false, error: 'bad-payload' };
    }
    const mine = this.verificationRecords.filter(
      (row) => row.ownerUserId === this.sessionUserId,
    );
    if (mine.some((row) => row.status === 'pending')) {
      return { ok: false, error: 'already-pending' };
    }
    if (mine.some((row) => row.status === 'approved')) {
      return { ok: false, error: 'already-verified' };
    }
    const id = `mem-verification-${this.verificationRecords.length + 1}`;
    this.verificationRecords.push({
      ownerUserId: this.sessionUserId,
      id,
      method: input.method,
      status: 'pending',
      decisionReason: '',
      createdAt: new Date().toISOString(),
      decidedAt: null,
      expiresAt: null,
      revokedAt: null,
    });
    return { ok: true, verificationId: id };
  }

  async getVerificationStatus(): Promise<
    | { ok: true; state: VerificationStateView; history: VerificationRecordView[] }
    | { ok: false; error: string }
  > {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const history = this.verificationRecords
      .filter((row) => row.ownerUserId === this.sessionUserId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map(({ ownerUserId: _o, ...view }) => view);
    const nowIso = new Date().toISOString();
    const live = history.find(
      (row) => row.status === 'approved' && (!row.expiresAt || row.expiresAt > nowIso),
    );
    const state: VerificationStateView = live ? 'approved' : (history[0]?.status ?? 'none');
    return { ok: true, state, history };
  }

  async initiateAccountDeletion(
    confirmation: string,
  ): Promise<
    | { ok: true; created: boolean; request: AccountDeletionView }
    | { ok: false; error: string }
  > {
    // Mirrors the edge guard order: session, then the typed phrase. The
    // fresh-access-token guard has no twin here: it reads a JWT claim, which
    // this adapter does not model. Its coverage lives in the
    // supabase/functions/mynews-account tests.
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    if (confirmation !== DELETION_CONFIRMATION_PHRASE) {
      return { ok: false, error: 'confirmation-mismatch' };
    }
    const existing = this.inFlightDeletion();
    if (existing) return { ok: true, created: false, request: { ...existing.request } };

    const requestedAt = this.now();
    const request: AccountDeletionView = {
      requestId: `mem-deletion-${this.deletionRequests.length + 1}`,
      status: 'grace',
      requestedAt,
      graceEndsAt: new Date(
        Date.parse(requestedAt) + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
      cancellable: true,
      cancelledAt: null,
      completedAt: null,
      failureDetail: null,
      authUserDeletionState: 'pending',
      processorCleanupState: 'pending',
    };
    this.deletionRequests.push({ userId: this.sessionUserId, request });
    return { ok: true, created: true, request: { ...request } };
  }

  async cancelAccountDeletion(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const entry = this.inFlightDeletion();
    if (!entry) return { ok: false, error: 'no-deletion-request' };
    if (entry.request.status !== 'grace') return { ok: false, error: 'not-cancellable' };
    entry.request.status = 'cancelled';
    entry.request.cancellable = false;
    entry.request.cancelledAt = this.now();
    return { ok: true };
  }

  async getAccountDeletionStatus(): Promise<
    { ok: true; request: AccountDeletionView | null } | { ok: false; error: string }
  > {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const mine = this.deletionRequests.filter((r) => r.userId === this.sessionUserId);
    const newest = mine.at(-1);
    return { ok: true, request: newest ? { ...newest.request } : null };
  }

  async exportAccountData(): Promise<
    | { ok: true; byteCount: number; bundle: Record<string, unknown> }
    | { ok: false; error: string }
  > {
    if (!this.sessionUserId) return { ok: false, error: 'not-signed-in' };
    const userId = this.sessionUserId;
    const profile = this.profiles.find((p) => p.id === this.myProfileId()) ?? null;
    // Only the sections this adapter models. nw_account_export_bundle owns the
    // authoritative section list; its completeness is pinned by the
    // supabase/functions/mynews-account drift test.
    const bundle: Record<string, unknown> = {
      schemaVersion: 1,
      generatedAt: this.now(),
      userId,
      profileId: profile?.id ?? null,
      profile,
      articles: this.articles.filter((a) => a.authorHandle === profile?.handle),
      draftArticles: this.draftArticles.filter((a) => a.authorHandle === profile?.handle),
      suggestionsAuthored: this.suggestions
        .filter((s) => s.editorId === profile?.id)
        .map(stripSeed),
      credibilityLedger: this.ledger,
      blocks: this.blocks.filter((b) => b.blockerProfileId === profile?.id),
      reportsFiled: this.reports
        .filter((r) => r.reporterProfileId === profile?.id)
        .map(({ reporterProfileId: _r, ...view }) => view),
      termsAcceptances: this.termsAcceptances.filter((t) => t.userId === userId),
      moderationNotices: await this.getMyModerationNotices(),
      deletionRequests: this.deletionRequests
        .filter((r) => r.userId === userId)
        .map((r) => r.request),
    };
    const byteCount = JSON.stringify(bundle).length;
    this.exportJobs.push({ userId, status: 'completed', byteCount, requestedAt: this.now() });
    return { ok: true, byteCount, bundle };
  }

  private inFlightDeletion():
    | { userId: string; request: AccountDeletionView }
    | undefined {
    return this.deletionRequests
      .filter(
        (r) =>
          r.userId === this.sessionUserId &&
          (r.request.status === 'grace' ||
            r.request.status === 'processing' ||
            r.request.status === 'failed'),
      )
      .at(-1);
  }
}

function stripSeed(s: SeededSuggestion): SuggestionView {
  const { articleAuthorId: _a, ...view } = s;
  return view;
}
