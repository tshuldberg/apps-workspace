import type { ChangelogEntry, SuggestionType } from '../models';
import type { StructuredDiff } from '../engines/diff';
import { BOUNDS_ERROR, checkCommentBody } from './bounds';
import type {
  AccountDeletionView,
  ArticleMetaView,
  ArticleView,
  BlockMode,
  BlockView,
  EditorProfileView,
  FeedItem,
  FunctionEnvelope,
  LedgerRowView,
  ModerationNoticeView,
  MyNewsCloudPort,
  MyNewsFunctionName,
  NewsroomDraftView,
  NewsroomMemberView,
  NewsroomView,
  ProfileView,
  ReportReason,
  ReportTargetKind,
  ReportView,
  RevisionSummary,
  SearchResult,
  ScreeningHoldView,
  SuggestionEventView,
  SuggestionView,
  VerificationRecordView,
  VerificationStateView,
} from './cloud';

// Re-export the view-model types so server-side consumers (Next.js RSC) can
// use the '@mylife/mynews/cloud-fetch' subpath exclusively. The package barrel
// transitively imports @mylife/sync, whose entry re-exports React client
// hooks; this file has zero runtime imports and is the web-safe entry.
export type {
  ArticleMetaView,
  ArticleView,
  BlockMode,
  BlockView,
  EditorProfileView,
  FeedItem,
  FunctionEnvelope,
  JournalistView,
  LedgerRowView,
  ModerationNoticeView,
  MyNewsCloudPort,
  MyNewsFunctionName,
  NewsroomDraftView,
  NewsroomMemberView,
  NewsroomView,
  ProfileView,
  ReportReason,
  ReportTargetKind,
  ReportView,
  RevisionSummary,
  SearchResult,
  ScreeningHoldView,
  SuggestionEventView,
  SuggestionView,
  VerificationRecordView,
  VerificationStateView,
} from './cloud';

// Web-safe runtime re-exports for the report surface. mynews-web imports these
// through the cloud-fetch subpath (never the package barrel, which pulls the
// react-native signing/sync graph). REPORT_REASONS/REPORT_REASON_LABELS come
// from zod-only models and the pure report orchestrator, so the RSC/client
// import graph stays clean.
export { REPORT_REASONS, REPORT_TARGET_KINDS } from '../models';
export { reportErrorMessage } from './report';
// Taxonomy constants come from the pure taxonomy module (plan 48 WP8), which has
// no data/ or signing/ imports at all.
export {
  REPORT_REASON_HINTS,
  REPORT_REASON_LABELS,
  REPORT_SEVERITY_RANK,
  REPORT_SLA_HOURS,
  REPORT_URGENT_REASONS,
} from '../taxonomy';

// Web-safe DMCA re-exports for the /legal/dmca form. validateDmcaNotice +
// dmcaErrorMessage are zod-only + pure, and the DMCA_* facts are plain
// constants, so the RSC/client import graph stays clean (no signing/sync graph).
export {
  validateDmcaNotice,
  validateDmcaTakedown,
  validateDmcaCounterNotice,
  dmcaErrorMessage,
  DMCA_DESIGNATED_AGENT_EMAIL,
  DMCA_RESPONSE_SLA_HOURS,
  DMCA_REPEAT_INFRINGER_THRESHOLD,
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
  DMCA_URL_RESOLUTION_FIXTURES,
  classifyDmcaPublicUrl,
} from './dmca';
export type { DmcaErrorCode, DmcaUrlTargetKind } from './dmca';
export { DMCA_NOTICE_KINDS } from '../models';
export type {
  DmcaCounterNotice,
  DmcaNotice,
  DmcaNoticeKind,
  DmcaTakedown,
} from '../models';

// Web-safe legal/terms re-exports for the SSR /legal hub. terms.ts is pure
// constants + one pure predicate (no signing/sync graph), so it is RSC-safe.
export {
  CURRENT_TERMS_VERSION,
  LEGAL_CONTACT,
  LEGAL_DOCUMENT_IDS,
  TERMS_NOT_ACCEPTED_ERROR,
  hasAcceptedCurrentTerms,
} from './terms';
export type { LegalDocumentId } from './terms';
export {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  COMMUNITY_GUIDELINES,
  LEGAL_DOCUMENTS,
  TERMS_PROMPT_SUMMARY,
} from './legal-content';
export type { LegalDocument, LegalSection } from './legal-content';

// Web-safe account-rights re-exports for the in-app deletion/export screens and
// the public /account/delete page. account.ts has zero imports, so the RSC graph
// stays clean (no signing/sync graph).
export {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
  DELETION_CONFIRMATION_PHRASE,
  accountDeletionStepLabel,
  accountErrorMessage,
} from './account';
export type { AccountDeletionSideEffectState, AccountDeletionView } from './account';

// Capability-keyed legal assembly for the public web. mynews-web must build the
// bundle PER REQUEST from its own server env rather than ship the frozen
// unconfigured export set, otherwise the site publishes claims (payments, live
// contact channels) that the deployment has not configured. capabilities.ts and
// legal-content.ts are pure (zod-free, no signing/sync graph), so both stay
// RSC-safe on this subpath.
export { createLegalContent, LEGAL_CLAIM_CAPABILITIES } from './legal-content';
export type { LegalContentBundle, LegalContentContacts } from './legal-content';
export { detectMyNewsCapabilities, DEFAULT_MYNEWS_CAPABILITIES } from './capabilities';
export type { MyNewsCapabilities, MyNewsCapabilityInputs } from './capabilities';

export interface MyNewsCloudConfig {
  /** Supabase project base, e.g. https://abc.supabase.co (no trailing slash). */
  baseUrl: string;
  anonKey: string;
  /** Defaults to `${baseUrl}/functions/v1`. */
  functionsUrl?: string;
  fetchImpl?: typeof fetch;
  /** Session bearer for function calls; anon key is used when absent. */
  getAccessToken?: () => Promise<string | null>;
}

const PUBLIC_PROFILE_SELECT = 'id,handle,display_name,pubkey_ed25519,kind,created_at';
// verification_state and verification_expires_at are the columns migration
// 20260730000009 appends to nw_public_journalists (plan 48 WP8). Evidence,
// reviewer identity, and denial reasons stay out of the view entirely, so there
// is nothing here to scrub.
const PUBLIC_JOURNALIST_SELECT =
  'profile_id,tier,bio,beats,region,created_at,verification_state,verification_expires_at';

// Public views are always read as standalone resources and stitched in code.
// PostgREST relationship inference for views is not a launch-safe contract.
const ARTICLE_SELECT =
  'id,author_id,slug,kind,status,current_rev,published_at,created_at,' +
  // verified_key_id (plan 48 WP6): the chain row the server recorded as having
  // verified each revision, so a reader can bind the signature to the byline's
  // key chain rather than trusting the server's attribution.
  'nw_article_revisions(rev,headline,dek,body_md,signature,signer_pubkey,verified_key_id,changelog_json,created_at)';

const FEED_SELECT =
  'id,author_id,slug,kind,current_rev,published_at,' +
  'nw_article_revisions(rev,headline,dek)';

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function quotedIn(values: readonly string[]): string {
  return `in.(${uniqueValues(values).map((value) => `"${value}"`).join(',')})`;
}

export function buildFeedUrl(
  baseUrl: string,
  input: { followedPubkeys: string[]; beforePublishedAt?: string; limit?: number },
): string {
  const params = new URLSearchParams();
  const pubkeys = uniqueValues(input.followedPubkeys);
  params.set('select', PUBLIC_PROFILE_SELECT);
  params.set('pubkey_ed25519', quotedIn(pubkeys));
  params.set('limit', String(pubkeys.length));
  return `${baseUrl}/rest/v1/nw_public_profiles?${params.toString()}`;
}

export function buildFeedArticlesUrl(
  baseUrl: string,
  authorIds: string[],
  input: { beforePublishedAt?: string; limit?: number },
): string {
  const params = new URLSearchParams();
  params.set('select', FEED_SELECT);
  params.set('status', 'eq.published');
  params.set('author_id', quotedIn(authorIds));
  if (input.beforePublishedAt) params.set('published_at', `lt.${input.beforePublishedAt}`);
  params.set('order', 'published_at.desc');
  params.set('limit', String(input.limit ?? 50));
  params.set('nw_article_revisions.order', 'rev.desc');
  params.set('nw_article_revisions.limit', '1');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

/**
 * Site-wide latest browse. Authors are loaded in batched standalone public
 * view reads after this article query and stitched before mapping.
 */
const LATEST_SELECT = FEED_SELECT;

export function buildLatestUrl(baseUrl: string, limit = 30): string {
  const params = new URLSearchParams();
  params.set('select', LATEST_SELECT);
  params.set('status', 'eq.published');
  params.set('order', 'published_at.desc');
  params.set('limit', String(limit));
  params.set('nw_article_revisions.order', 'rev.desc');
  params.set('nw_article_revisions.limit', '1');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

export function buildArticleUrl(baseUrl: string, slug: string): string {
  const params = new URLSearchParams();
  params.set('select', ARTICLE_SELECT);
  params.set('slug', `eq.${slug}`);
  params.set('status', 'neq.draft');
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

export function buildJournalistUrl(baseUrl: string, handle: string): string {
  const params = new URLSearchParams();
  params.set('select', PUBLIC_PROFILE_SELECT);
  params.set('handle', `eq.${handle}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_public_profiles?${params.toString()}`;
}

export function buildJournalistArticlesUrl(baseUrl: string, profileId: string): string {
  const params = new URLSearchParams();
  params.set('select', FEED_SELECT);
  params.set('author_id', `eq.${profileId}`);
  params.set('status', 'eq.published');
  params.set('order', 'published_at.desc');
  params.set('nw_article_revisions.order', 'rev.desc');
  params.set('nw_article_revisions.limit', '1');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

export function buildPublicProfilesByIdsUrl(baseUrl: string, profileIds: string[]): string {
  const ids = uniqueValues(profileIds);
  const params = new URLSearchParams();
  params.set('select', PUBLIC_PROFILE_SELECT);
  params.set('id', quotedIn(ids));
  params.set('limit', String(ids.length));
  return `${baseUrl}/rest/v1/nw_public_profiles?${params.toString()}`;
}

export function buildPublicJournalistsByProfileIdsUrl(
  baseUrl: string,
  profileIds: string[],
): string {
  const ids = uniqueValues(profileIds);
  const params = new URLSearchParams();
  params.set('select', PUBLIC_JOURNALIST_SELECT);
  params.set('profile_id', quotedIn(ids));
  params.set('limit', String(ids.length));
  return `${baseUrl}/rest/v1/nw_public_journalists?${params.toString()}`;
}

export function buildSearchUrls(baseUrl: string, query: string, limit: number): {
  revisions: string;
  journalists: string;
} {
  const safe = query.replace(/[%_*(),]/g, ' ').trim();
  const rev = new URLSearchParams();
  rev.set('select', 'headline,dek,rev,nw_articles!inner(slug,status,current_rev)');
  rev.set('headline', `ilike.*${safe}*`);
  rev.set('nw_articles.status', 'eq.published');
  rev.set('limit', String(limit));
  const j = new URLSearchParams();
  j.set('select', 'id,handle,display_name');
  j.set('or', `(handle.ilike.*${safe}*,display_name.ilike.*${safe}*)`);
  j.set('limit', String(limit));
  return {
    revisions: `${baseUrl}/rest/v1/nw_article_revisions?${rev.toString()}`,
    journalists: `${baseUrl}/rest/v1/nw_public_profiles?${j.toString()}`,
  };
}

const SUGGESTION_SELECT =
  'id,article_id,base_rev,editor_id,type,diff_json,citations,rationale,status,created_at,' +
  'article:nw_articles!inner(slug,author_id,nw_article_revisions(rev,headline)),' +
  'endorsements:nw_suggestion_dupes(count)';

const PROFILE_SELECT = 'id,user_id,handle,display_name,pubkey_ed25519,kind';

function suggestionParams(): URLSearchParams {
  const params = new URLSearchParams();
  params.set('select', SUGGESTION_SELECT);
  params.set('article.nw_article_revisions.order', 'rev.desc');
  params.set('article.nw_article_revisions.limit', '1');
  return params;
}

export function buildSuggestionsForArticleUrl(
  baseUrl: string,
  articleId: string,
  opts?: { status?: SuggestionView['status'] },
): string {
  const params = suggestionParams();
  params.set('article_id', `eq.${articleId}`);
  if (opts?.status) params.set('status', `eq.${opts.status}`);
  params.set('order', 'created_at.asc');
  return `${baseUrl}/rest/v1/nw_edit_suggestions?${params.toString()}`;
}

export function buildSuggestionUrl(baseUrl: string, id: string): string {
  const params = suggestionParams();
  params.set('id', `eq.${id}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_edit_suggestions?${params.toString()}`;
}

export function buildMySuggestionsUrl(baseUrl: string, editorProfileId: string): string {
  const params = suggestionParams();
  params.set('editor_id', `eq.${editorProfileId}`);
  params.set('order', 'created_at.desc');
  return `${baseUrl}/rest/v1/nw_edit_suggestions?${params.toString()}`;
}

export function buildReviewQueueUrl(baseUrl: string, authorProfileId: string): string {
  const params = suggestionParams();
  params.set('status', 'eq.open');
  params.set('article.author_id', `eq.${authorProfileId}`);
  params.set('order', 'created_at.asc');
  return `${baseUrl}/rest/v1/nw_edit_suggestions?${params.toString()}`;
}

export function buildSuggestionEventsUrl(baseUrl: string, suggestionId: string): string {
  const params = new URLSearchParams();
  params.set('select', 'id,suggestion_id,actor_id,action,payload,created_at');
  params.set('suggestion_id', `eq.${suggestionId}`);
  params.set('order', 'created_at.asc');
  return `${baseUrl}/rest/v1/nw_suggestion_events?${params.toString()}`;
}

// The caller's OWN profile lookup: stays on the base table (nw_profiles),
// relying on the nw_profiles_self_select RLS policy (auth.uid() = user_id)
// instead of the dropped public policy. PROFILE_SELECT needs user_id, which
// nw_public_profiles deliberately excludes.
export function buildMyProfileUrl(baseUrl: string, userId: string): string {
  const params = new URLSearchParams();
  params.set('select', PROFILE_SELECT);
  params.set('user_id', `eq.${userId}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_profiles?${params.toString()}`;
}

export function buildHandleUrl(baseUrl: string, handle: string): string {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('handle', `eq.${handle}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_public_profiles?${params.toString()}`;
}

export function buildEditorProfileUrl(baseUrl: string, handle: string): string {
  const params = new URLSearchParams();
  params.set('select', 'id,handle,display_name,kind');
  params.set('handle', `eq.${handle}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_public_profiles?${params.toString()}`;
}

export function buildEditorLedgerUrl(baseUrl: string, editorId: string): string {
  const params = new URLSearchParams();
  params.set(
    'select',
    'id,editor_id,suggestion_id,base_points,diversity_mult,standing_mult,awarded_at,' +
      'suggestion:nw_edit_suggestions(type,article:nw_articles(author_id))',
  );
  params.set('editor_id', `eq.${editorId}`);
  params.set('order', 'awarded_at.desc');
  return `${baseUrl}/rest/v1/nw_credibility_ledger?${params.toString()}`;
}

export function buildEditorSuggestionStatsUrl(baseUrl: string, editorId: string): string {
  const params = new URLSearchParams();
  params.set('select', 'status,article:nw_articles!inner(author_id)');
  params.set('editor_id', `eq.${editorId}`);
  return `${baseUrl}/rest/v1/nw_edit_suggestions?${params.toString()}`;
}

export function buildMyNewsroomsUrl(baseUrl: string, profileId: string): string {
  const params = new URLSearchParams();
  params.set('select', 'newsroom:nw_newsrooms!inner(id,owner_id,name,created_at)');
  params.set('profile_id', `eq.${profileId}`);
  params.set('order', 'created_at.asc');
  return `${baseUrl}/rest/v1/nw_newsroom_members?${params.toString()}`;
}

export function buildNewsroomUrl(baseUrl: string, id: string): string {
  const params = new URLSearchParams();
  params.set('select', 'id,owner_id,name,created_at');
  params.set('id', `eq.${id}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_newsrooms?${params.toString()}`;
}

export function buildNewsroomDeleteUrl(baseUrl: string, id: string): string {
  const params = new URLSearchParams();
  params.set('id', `eq.${id}`);
  return `${baseUrl}/rest/v1/nw_newsrooms?${params.toString()}`;
}

export function buildNewsroomMembersUrl(baseUrl: string, newsroomId: string): string {
  const params = new URLSearchParams();
  params.set('select', 'newsroom_id,profile_id,role');
  params.set('newsroom_id', `eq.${newsroomId}`);
  params.set('order', 'created_at.asc');
  return `${baseUrl}/rest/v1/nw_newsroom_members?${params.toString()}`;
}

export function buildRemoveNewsroomMemberUrl(
  baseUrl: string,
  newsroomId: string,
  profileId: string,
): string {
  const params = new URLSearchParams();
  params.set('newsroom_id', `eq.${newsroomId}`);
  params.set('profile_id', `eq.${profileId}`);
  return `${baseUrl}/rest/v1/nw_newsroom_members?${params.toString()}`;
}

export function buildNewsroomDraftsUrl(baseUrl: string, newsroomId: string): string {
  const params = new URLSearchParams();
  params.set(
    'select',
    'id,slug,current_rev,author_id,' +
      'nw_article_revisions(rev,headline,created_at),' +
      'nw_article_meta(embargo_until)',
  );
  params.set('newsroom_id', `eq.${newsroomId}`);
  params.set('status', 'eq.draft');
  params.set('nw_article_revisions.order', 'rev.desc');
  params.set('nw_article_revisions.limit', '1');
  params.set('order', 'created_at.desc');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

export function buildDraftArticleUrl(baseUrl: string, articleId: string): string {
  const params = new URLSearchParams();
  params.set('select', ARTICLE_SELECT);
  params.set('id', `eq.${articleId}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

export function buildArticleMetaUrl(baseUrl: string, articleId: string): string {
  const params = new URLSearchParams();
  params.set(
    'select',
    'article_id,doi,orcid_authors,license,rights_route,embargo_until,dataset_hashes,canonical_url,signature,signer_pubkey',
  );
  params.set('article_id', `eq.${articleId}`);
  params.set('limit', '1');
  return `${baseUrl}/rest/v1/nw_article_meta?${params.toString()}`;
}

export function buildMyReportsUrl(baseUrl: string, reporterProfileId: string): string {
  const params = new URLSearchParams();
  params.set('select', 'id,target_kind,target_id,reason,detail,status,created_at');
  params.set('reporter_id', `eq.${reporterProfileId}`);
  params.set('order', 'created_at.desc');
  params.set('limit', '200');
  return `${baseUrl}/rest/v1/nw_reports?${params.toString()}`;
}

const REPORT_TARGET_KINDS: readonly ReportTargetKind[] = [
  'article',
  'revision',
  'suggestion',
  'profile',
  'media',
];
const REPORT_REASONS: readonly ReportReason[] = [
  'harassment',
  'violence',
  'ncii',
  'copyright',
  'impersonation',
  'spam',
  'other',
];
const REPORT_STATUSES: readonly ReportView['status'][] = ['open', 'actioned', 'no_action'];

export interface ReportRow {
  id: string;
  target_kind: string;
  target_id: string;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
}

export function mapReportRow(row: ReportRow): ReportView | null {
  // Unknown enum values drop the row rather than masquerading as a valid one.
  const targetKind = REPORT_TARGET_KINDS.find((k) => k === row.target_kind);
  const reason = REPORT_REASONS.find((r) => r === row.reason);
  const status = REPORT_STATUSES.find((s) => s === row.status);
  if (!targetKind || !reason || !status) return null;
  return {
    id: row.id,
    targetKind,
    targetId: row.target_id,
    reason,
    detail: row.detail ?? '',
    status,
    createdAt: row.created_at,
  };
}

/**
 * The blocker's own block list. RLS (nw_blocks_self_all) already restricts the
 * rows to the caller, so no blocker filter is needed in the query. Blocked
 * profile display data is loaded once from nw_public_profiles and stitched.
 */
export function buildMyBlocksUrl(baseUrl: string): string {
  const params = new URLSearchParams();
  params.set('select', 'id,blocked_profile_id,mode,created_at');
  params.set('order', 'created_at.desc');
  params.set('limit', '500');
  return `${baseUrl}/rest/v1/nw_blocks?${params.toString()}`;
}

/** DELETE the caller's own block on a given author (RLS scopes it to them). */
export function buildRemoveBlockUrl(baseUrl: string, blockedProfileId: string): string {
  const params = new URLSearchParams();
  params.set('blocked_profile_id', `eq.${blockedProfileId}`);
  return `${baseUrl}/rest/v1/nw_blocks?${params.toString()}`;
}

const BLOCK_MODES: readonly BlockMode[] = ['block', 'mute'];

export interface BlockRow {
  id: string;
  blocked_profile_id: string;
  mode: string;
  created_at: string;
  blocked?: PublicProfileRow | null;
}

function stitchBlockProfiles(rows: BlockRow[], profiles: PublicProfileRow[]): BlockRow[] {
  const profilesById = requiredProfileMap(
    rows.map((row) => row.blocked_profile_id),
    profiles,
    'block',
  );
  return rows.map((row) => ({ ...row, blocked: profilesById.get(row.blocked_profile_id)! }));
}

export function mapBlockRow(row: BlockRow): BlockView | null {
  const mode = BLOCK_MODES.find((m) => m === row.mode);
  if (!mode) return null;
  const blocked = row.blocked ?? undefined;
  return {
    id: row.id,
    blockedProfileId: row.blocked_profile_id,
    blockedPubkey: blocked?.pubkey_ed25519 ?? '',
    blockedHandle: blocked?.handle ?? '',
    blockedDisplayName: blocked?.display_name ?? '',
    mode,
    createdAt: row.created_at,
  };
}

/* ------------------------- row shapes + mapping ------------------------- */

export interface PublicJournalistRow {
  profile_id: string;
  tier?: string;
  bio?: string;
  beats?: string[];
  region?: string;
  created_at?: string;
  /** Plan 48 WP8. Optional so a pre-migration response still parses. */
  verification_state?: string;
  verification_expires_at?: string | null;
}

/**
 * Verification state from a public row. Anything other than a live 'approved'
 * reads as unverified, including a missing column: a badge must never appear
 * because a field was absent.
 */
export function verificationStateOf(
  journalist: PublicJournalistRow | null | undefined,
): VerificationStateView {
  const state = journalist?.verification_state;
  switch (state) {
    case 'pending':
    case 'approved':
    case 'rejected':
    case 'revoked':
    case 'expired':
      return state;
    default:
      return 'none';
  }
}

export interface PublicProfileRow {
  id: string;
  handle: string;
  display_name: string;
  pubkey_ed25519: string;
  kind?: string;
  created_at?: string;
}

export interface RevisionRow {
  rev: number;
  headline: string;
  dek?: string | null;
  body_md?: string;
  signature?: string;
  signer_pubkey?: string;
  /** nw_article_revisions.verified_key_id; null on pre-chain rows (WP6). */
  verified_key_id?: string | null;
  changelog_json?: unknown;
  created_at?: string;
}
export interface ArticleRow {
  id: string;
  author_id: string;
  slug: string;
  kind: string;
  status?: string;
  current_rev: number;
  published_at: string | null;
  created_at?: string;
  author?: PublicProfileRow | null;
  journalist?: PublicJournalistRow | null;
  nw_article_revisions: RevisionRow[] | null;
}

function requiredProfileMap(
  profileIds: readonly string[],
  profiles: readonly PublicProfileRow[],
  context: string,
): Map<string, PublicProfileRow> {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const missing = uniqueValues(profileIds).filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`mynews ${context} profile stitch failed: ${missing.join(',')}`);
  }
  return byId;
}

function journalistMap(
  journalists: readonly PublicJournalistRow[],
): Map<string, PublicJournalistRow> {
  return new Map(journalists.map((journalist) => [journalist.profile_id, journalist]));
}

export function stitchArticleAuthors(
  rows: ArticleRow[],
  profiles: PublicProfileRow[],
  journalists: PublicJournalistRow[],
): ArticleRow[] {
  const profilesById = requiredProfileMap(
    rows.map((row) => row.author_id),
    profiles,
    'article-author',
  );
  const journalistsById = journalistMap(journalists);
  return rows.map((row) => ({
    ...row,
    author: profilesById.get(row.author_id)!,
    journalist: journalistsById.get(row.author_id) ?? null,
  }));
}

function tierOf(journalist: PublicJournalistRow | null | undefined): 'open' | 'verified' {
  return journalist?.tier === 'verified' ? 'verified' : 'open';
}

function toChangelog(raw: unknown): ChangelogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is ChangelogEntry =>
      typeof c === 'object' && c !== null && 'suggestionId' in c && 'editorKey' in c && 'type' in c,
  );
}

export function mapFeedRow(row: ArticleRow): FeedItem | null {
  const head = row.nw_article_revisions?.[0];
  if (!head || !row.author || !row.published_at) return null;
  return {
    articleId: row.id,
    slug: row.slug,
    headline: head.headline,
    dek: head.dek ?? undefined,
    kind: row.kind === 'preprint' ? 'preprint' : 'news',
    rev: row.current_rev,
    publishedAt: row.published_at,
    authorHandle: row.author.handle,
    authorDisplayName: row.author.display_name,
    authorPubkey: row.author.pubkey_ed25519,
    authorTier: tierOf(row.journalist),
    // WP6: lets the reader verifier assert a signing key belongs to THIS byline.
    authorProfileId: row.author_id,
  };
}

export function mapArticleRow(row: ArticleRow): ArticleView | null {
  const revisions = [...(row.nw_article_revisions ?? [])].sort((a, b) => b.rev - a.rev);
  const head = revisions.find((r) => r.rev === row.current_rev) ?? revisions[0];
  // Draft rows carry a null published_at; substitute a placeholder so
  // mapFeedRow's feed-only published guard does not drop them, then report the
  // honest status and publishedAt below. Feeds call mapFeedRow directly (the
  // guard stays intact there), so drafts can never leak into a feed.
  const base = mapFeedRow({
    ...row,
    published_at: row.published_at ?? 'draft',
    nw_article_revisions: head ? [head] : [],
  });
  if (!base || !head) return null;
  const summaries: RevisionSummary[] = revisions.map((r) => ({
    rev: r.rev,
    createdAt: r.created_at ?? '',
    changelog: toChangelog(r.changelog_json),
    // WP6 reader verification material. Carried through verbatim: the verifier
    // must see exactly what the record holds, including a missing signature or a
    // null key id, so it can report 'not chain-recorded' rather than guess. The
    // signed TEXT rides along because a revision signature covers the whole
    // revision, so an older one cannot be checked from the head's text.
    headline: r.headline,
    dek: r.dek ?? undefined,
    bodyMd: r.body_md,
    signature: r.signature,
    signerPubkey: r.signer_pubkey,
    verifiedKeyId: r.verified_key_id ?? null,
  }));
  return {
    ...base,
    status: row.status === 'retracted' ? 'retracted' : row.status === 'draft' ? 'draft' : 'published',
    publishedAt: row.published_at ?? '',
    bodyMd: head.body_md ?? '',
    signature: head.signature ?? '',
    signerPubkey: head.signer_pubkey ?? '',
    createdAt: row.created_at ?? '',
    revisionSummaries: summaries,
  };
}

const SUGGESTION_TYPES: readonly SuggestionType[] = [
  'correction',
  'context',
  'translation',
  'clarity',
  'headline',
  'copyedit',
];

const SUGGESTION_STATUSES: readonly SuggestionView['status'][] = [
  'open',
  'accepted',
  'partial',
  'rejected',
  'stale',
];

function firstOf<T>(v: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

// Read-side diff normalization. A signed suggestion only has to be JSON on
// insert (the edge validates the shape for the near-dupe scan but does not
// gate on it), so a stored diff can carry ops missing baseBlocks/newBlocks.
// diffToBlocks on the public web reader calls op.baseBlocks.forEach directly,
// so an unnormalized op would 500 the page. Drop any op that is not the
// expected string-array shape; a diff with no well-formed ops maps to empty.
function isWellFormedOp(op: unknown): op is StructuredDiff['ops'][number] {
  if (typeof op !== 'object' || op === null) return false;
  const o = op as Record<string, unknown>;
  return (
    Array.isArray(o.baseBlocks) &&
    o.baseBlocks.every((b) => typeof b === 'string') &&
    Array.isArray(o.newBlocks) &&
    o.newBlocks.every((b) => typeof b === 'string')
  );
}

function toDiff(raw: unknown): StructuredDiff {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    Array.isArray((raw as StructuredDiff).ops) &&
    typeof (raw as StructuredDiff).baseHash === 'string'
  ) {
    const d = raw as StructuredDiff;
    return { baseHash: d.baseHash, ops: d.ops.filter(isWellFormedOp) };
  }
  return { baseHash: '', ops: [] };
}

// Citations are https-only by write contract (mynews-suggest verifies the
// scheme; HttpsUrlSchema in models.ts). The read path filters again so a
// citation that reached the row through any other route (e.g. a direct insert
// before the F1 lockdown) can never render as a javascript:/data: href on the
// web reader, which unlike the Expo app has no render-time scheme guard.
function toCitations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is string => typeof c === 'string' && c.startsWith('https://'),
  );
}

function toPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export interface SuggestionRow {
  id: string;
  article_id: string;
  base_rev: number;
  editor_id: string;
  type: string;
  diff_json: unknown;
  citations: unknown;
  rationale: string;
  status: string;
  created_at: string;
  editor?:
    | { handle: string; display_name: string; pubkey_ed25519: string }
    | Array<{ handle: string; display_name: string; pubkey_ed25519: string }>
    | null;
  article?:
    | { slug: string; author_id?: string; nw_article_revisions?: Array<{ rev: number; headline: string }> | null }
    | Array<{ slug: string; author_id?: string; nw_article_revisions?: Array<{ rev: number; headline: string }> | null }>
    | null;
  endorsements?: Array<{ count: number }> | null;
}

function stitchSuggestionEditors(
  rows: SuggestionRow[],
  profiles: PublicProfileRow[],
): SuggestionRow[] {
  const profilesById = requiredProfileMap(
    rows.map((row) => row.editor_id),
    profiles,
    'suggestion-editor',
  );
  return rows.map((row) => ({ ...row, editor: profilesById.get(row.editor_id)! }));
}

export function mapSuggestionRow(row: SuggestionRow): SuggestionView | null {
  const editor = firstOf(row.editor);
  const article = firstOf(row.article);
  const head = article?.nw_article_revisions?.[0];
  const type = SUGGESTION_TYPES.find((t) => t === row.type);
  // Unknown status values drop the row (like unknown types) rather than
  // masquerading as 'open'.
  const status = SUGGESTION_STATUSES.find((s) => s === row.status);
  if (!editor || !article || !head || !type || !status) return null;
  return {
    id: row.id,
    articleId: row.article_id,
    articleSlug: article.slug,
    articleHeadline: head.headline,
    baseRev: row.base_rev,
    editorId: row.editor_id,
    editorHandle: editor.handle,
    editorDisplayName: editor.display_name,
    editorPubkey: editor.pubkey_ed25519,
    type,
    diff: toDiff(row.diff_json),
    citations: toCitations(row.citations),
    rationale: row.rationale,
    status,
    createdAt: row.created_at,
    endorsements: firstOf(row.endorsements)?.count ?? 0,
  };
}

export interface SuggestionEventRow {
  id: string;
  suggestion_id: string;
  actor_id: string;
  action: string;
  payload: unknown;
  created_at: string;
  actor?: { handle: string } | Array<{ handle: string }> | null;
}

function stitchSuggestionEventActors(
  rows: SuggestionEventRow[],
  profiles: PublicProfileRow[],
): SuggestionEventRow[] {
  const profilesById = requiredProfileMap(
    rows.map((row) => row.actor_id),
    profiles,
    'suggestion-event-actor',
  );
  return rows.map((row) => ({ ...row, actor: profilesById.get(row.actor_id)! }));
}

const EVENT_ACTIONS: readonly SuggestionEventView['action'][] = [
  'comment',
  'accept',
  'reject',
  'partial',
  'rebase',
];

export function mapSuggestionEventRow(row: SuggestionEventRow): SuggestionEventView | null {
  // Unknown actions drop the row rather than masquerading as a 'comment'.
  const action = EVENT_ACTIONS.find((a) => a === row.action);
  if (!action) return null;
  return {
    id: row.id,
    suggestionId: row.suggestion_id,
    actorId: row.actor_id,
    actorHandle: firstOf(row.actor)?.handle ?? '',
    action,
    payload: toPayload(row.payload),
    createdAt: row.created_at,
  };
}

export interface ProfileRow {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  pubkey_ed25519: string;
  kind: string;
}

function toKind(raw: string): ProfileView['kind'] {
  return raw === 'editor' || raw === 'journalist' ? raw : 'reader';
}

export function mapProfileRow(row: ProfileRow): ProfileView {
  return {
    id: row.id,
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    pubkeyEd25519: row.pubkey_ed25519,
    kind: toKind(row.kind),
  };
}

export interface MetaRow {
  article_id: string;
  doi: string | null;
  orcid_authors: string[] | null;
  license: string | null;
  rights_route: string | null;
  embargo_until: string | null;
  dataset_hashes: string[] | null;
  canonical_url: string | null;
  signature: string | null;
  signer_pubkey: string | null;
}

export function mapMetaRow(row: MetaRow): ArticleMetaView {
  return {
    articleId: row.article_id,
    doi: row.doi ?? null,
    orcidAuthors: row.orcid_authors ?? [],
    license: row.license ?? '',
    rightsRoute: row.rights_route ?? '',
    embargoUntil: row.embargo_until ?? null,
    datasetHashes: row.dataset_hashes ?? [],
    canonicalUrl: row.canonical_url ?? null,
    signature: row.signature ?? '',
    signerPubkey: row.signer_pubkey ?? '',
  };
}

export interface LedgerRow {
  id: string;
  editor_id: string;
  suggestion_id: string;
  base_points: number;
  diversity_mult: number;
  standing_mult: number;
  awarded_at: string;
  suggestion?:
    | { type?: string; article?: { author_id: string } | Array<{ author_id: string }> | null }
    | Array<{ type?: string; article?: { author_id: string } | Array<{ author_id: string }> | null }>
    | null;
}

export function mapLedgerRow(row: LedgerRow): LedgerRowView {
  const suggestion = firstOf(row.suggestion);
  return {
    id: row.id,
    editorId: row.editor_id,
    suggestionId: row.suggestion_id,
    basePoints: Number(row.base_points),
    diversityMult: Number(row.diversity_mult),
    standingMult: Number(row.standing_mult),
    awardedAt: row.awarded_at,
    type: SUGGESTION_TYPES.find((t) => t === suggestion?.type) ?? null,
    authorId: firstOf(suggestion?.article)?.author_id ?? null,
  };
}

export interface EditorStatRow {
  status: string;
  article?: { author_id: string } | Array<{ author_id: string }> | null;
}

export interface EditorSuggestionStat {
  status: SuggestionView['status'];
  authorId: string | null;
}

export function mapEditorStatRow(row: EditorStatRow): EditorSuggestionStat {
  return {
    status: SUGGESTION_STATUSES.find((s) => s === row.status) ?? 'open',
    authorId: firstOf(row.article)?.author_id ?? null,
  };
}

/**
 * Aggregates for the editor profile, derived client-side from the editor's
 * suggestion rows. Decided excludes open and stale; partial acceptances count
 * as merged work; distinct authors follow the diversity-multiplier semantics
 * (authors who merged this editor's work).
 */
export function deriveEditorAggregates(
  stats: EditorSuggestionStat[],
): EditorProfileView['aggregates'] {
  const decided = stats.filter(
    (s) => s.status === 'accepted' || s.status === 'partial' || s.status === 'rejected',
  );
  const merged = decided.filter((s) => s.status !== 'rejected');
  const authors = new Set(merged.map((s) => s.authorId).filter((a): a is string => a !== null));
  return {
    openCount: stats.filter((s) => s.status === 'open').length,
    decidedSampleSize: decided.length,
    // An empty decided sample reports 1, aligning with the server RPC and
    // _shared/mynews-store.ts enforcement: editors with no decisions yet are
    // not treated as low-acceptance.
    acceptanceRate: decided.length === 0 ? 1 : merged.length / decided.length,
    distinctAuthors: authors.size,
  };
}

export interface NewsroomRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export function mapNewsroomRow(row: NewsroomRow): NewsroomView {
  return { id: row.id, ownerId: row.owner_id, name: row.name, createdAt: row.created_at };
}

export interface NewsroomMemberRow {
  newsroom_id: string;
  profile_id: string;
  role: string;
  profile?: { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null;
}

function stitchNewsroomMemberProfiles(
  rows: NewsroomMemberRow[],
  profilesById: Map<string, PublicProfileRow>,
): NewsroomMemberRow[] {
  return rows.map((row) => ({ ...row, profile: profilesById.get(row.profile_id)! }));
}

export function mapNewsroomMemberRow(row: NewsroomMemberRow): NewsroomMemberView | null {
  const profile = firstOf(row.profile);
  const role =
    row.role === 'owner' || row.role === 'coauthor' || row.role === 'reviewer' ? row.role : null;
  if (!profile || !role) return null;
  return {
    newsroomId: row.newsroom_id,
    profileId: row.profile_id,
    handle: profile.handle,
    displayName: profile.display_name,
    role,
  };
}

export interface NewsroomDraftRow {
  id: string;
  author_id: string;
  slug: string;
  current_rev: number;
  author?: { handle: string } | Array<{ handle: string }> | null;
  nw_article_revisions?: Array<{ rev: number; headline: string; created_at?: string }> | null;
  nw_article_meta?: { embargo_until?: string | null } | Array<{ embargo_until?: string | null }> | null;
}

function stitchNewsroomDraftAuthors(
  rows: NewsroomDraftRow[],
  profilesById: Map<string, PublicProfileRow>,
): NewsroomDraftRow[] {
  return rows.map((row) => ({ ...row, author: profilesById.get(row.author_id)! }));
}

export function mapNewsroomDraftRow(row: NewsroomDraftRow): NewsroomDraftView | null {
  const author = firstOf(row.author);
  const head = row.nw_article_revisions?.[0];
  if (!author || !head) return null;
  return {
    articleId: row.id,
    slug: row.slug,
    headline: head.headline,
    rev: row.current_rev,
    updatedAt: head.created_at ?? '',
    embargoUntil: firstOf(row.nw_article_meta)?.embargo_until ?? null,
    authorHandle: author.handle,
  };
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Extracts the `sub` claim (the Supabase user id) from a session JWT without
 * any crypto dependency. The signature is NOT verified here; the token is only
 * used to address the caller's own rows, and RLS re-checks it server-side.
 */
export function decodeJwtSub(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const ch of b64) {
    const idx = B64_ALPHABET.indexOf(ch);
    if (idx < 0) {
      if (ch === '=') continue;
      return null;
    }
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  try {
    const payload = JSON.parse(out) as { sub?: unknown };
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

/* ------------------------------- adapter -------------------------------- */

export function createMyNewsCloudAdapter(cfg: MyNewsCloudConfig): MyNewsCloudPort {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const functionsUrl = cfg.functionsUrl ?? `${cfg.baseUrl}/functions/v1`;

  async function rest<T>(url: string, bearer?: string): Promise<T> {
    const res = await fetchImpl(url, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${bearer ?? cfg.anonKey}` },
    });
    if (!res.ok) throw new Error(`mynews cloud read failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async function sessionToken(): Promise<string | null> {
    return (await cfg.getAccessToken?.()) ?? null;
  }

  async function publicProfilesByIds(
    profileIds: string[],
    bearer?: string,
  ): Promise<PublicProfileRow[]> {
    const ids = uniqueValues(profileIds);
    if (ids.length === 0) return [];
    return rest<PublicProfileRow[]>(buildPublicProfilesByIdsUrl(cfg.baseUrl, ids), bearer);
  }

  async function publicJournalistsByProfileIds(
    profileIds: string[],
    bearer?: string,
  ): Promise<PublicJournalistRow[]> {
    const ids = uniqueValues(profileIds);
    if (ids.length === 0) return [];
    return rest<PublicJournalistRow[]>(
      buildPublicJournalistsByProfileIdsUrl(cfg.baseUrl, ids),
      bearer,
    );
  }

  async function stitchArticleRows(
    rows: ArticleRow[],
    bearer?: string,
  ): Promise<ArticleRow[]> {
    if (rows.length === 0) return [];
    const authorIds = uniqueValues(rows.map((row) => row.author_id));
    const [profiles, journalists] = await Promise.all([
      publicProfilesByIds(authorIds, bearer),
      publicJournalistsByProfileIds(authorIds, bearer),
    ]);
    return stitchArticleAuthors(rows, profiles, journalists);
  }

  async function send(
    url: string,
    token: string,
    init: { method: string; body?: unknown; prefer?: string },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
    };
    if (init.prefer) headers.Prefer = init.prefer;
    return fetchImpl(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  }

  async function invokeFunction<T>(
    name: MyNewsFunctionName,
    body: unknown,
  ): Promise<FunctionEnvelope<T>> {
    const token = (await cfg.getAccessToken?.()) ?? cfg.anonKey;
    const res = await fetchImpl(`${functionsUrl}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => null)) as FunctionEnvelope<T> | null;
    if (payload && typeof payload === 'object' && 'ok' in payload) return payload;
    return { ok: false, error: `function-${res.status}` };
  }

  // Suggestion and event reads carry the session bearer opportunistically:
  // the authenticated role still satisfies the public read policies, and it
  // lets newsroom members see suggestions and threads on draft articles once
  // the member-scoped RLS policies land. Anon key when signed out.
  async function suggestionRead(url: string): Promise<SuggestionView[]> {
    const bearer = (await sessionToken()) ?? undefined;
    const rows = await rest<SuggestionRow[]>(url, bearer);
    const profiles = await publicProfilesByIds(
      rows.map((row) => row.editor_id),
      bearer,
    );
    return stitchSuggestionEditors(rows, profiles)
      .map(mapSuggestionRow)
      .filter((s): s is SuggestionView => s !== null);
  }

  return {
    async getFeed(input) {
      if (input.followedPubkeys.length === 0) return [];
      const profiles = await rest<PublicProfileRow[]>(buildFeedUrl(cfg.baseUrl, input));
      if (profiles.length === 0) return [];
      const authorIds = uniqueValues(profiles.map((profile) => profile.id));
      const [rows, journalists] = await Promise.all([
        rest<ArticleRow[]>(buildFeedArticlesUrl(cfg.baseUrl, authorIds, input)),
        publicJournalistsByProfileIds(authorIds),
      ]);
      return stitchArticleAuthors(rows, profiles, journalists)
        .map(mapFeedRow)
        .filter((r): r is FeedItem => r !== null);
    },

    async getLatest(limit = 30) {
      const rows = await rest<ArticleRow[]>(buildLatestUrl(cfg.baseUrl, limit));
      return (await stitchArticleRows(rows))
        .map(mapFeedRow)
        .filter((r): r is FeedItem => r !== null);
    },

    async getArticleBySlug(slug) {
      const rows = await rest<ArticleRow[]>(buildArticleUrl(cfg.baseUrl, slug));
      if (!rows[0]) return null;
      const stitched = await stitchArticleRows([rows[0]]);
      return mapArticleRow(stitched[0]!);
    },

    async getJournalistByHandle(handle) {
      const rows = await rest<PublicProfileRow[]>(buildJournalistUrl(cfg.baseUrl, handle));
      const row = rows[0];
      if (!row) return null;
      const [journalists, articleRows] = await Promise.all([
        publicJournalistsByProfileIds([row.id]),
        rest<ArticleRow[]>(buildJournalistArticlesUrl(cfg.baseUrl, row.id)),
      ]);
      const journalist = journalists.find((candidate) => candidate.profile_id === row.id);
      if (!journalist) return null;
      const articles = stitchArticleAuthors(articleRows, [row], journalists)
        .map(mapFeedRow)
        .filter((a): a is FeedItem => a !== null);
      return {
        id: row.id,
        handle: row.handle,
        displayName: row.display_name,
        tier: journalist.tier === 'verified' ? 'verified' : 'open',
        bio: journalist.bio ?? '',
        beats: journalist.beats ?? [],
        pubkey: row.pubkey_ed25519,
        articles,
        // Plan 48 WP8: the badge follows the verification state, not the tier
        // column, so a tier that drifted out of step with the record cannot
        // render a badge on its own.
        verificationState: verificationStateOf(journalist),
        verificationExpiresAt: journalist.verification_expires_at ?? null,
      };
    },

    async search(query, limit = 20) {
      const urls = buildSearchUrls(cfg.baseUrl, query, limit);
      interface RevHit extends RevisionRow {
        nw_articles: { slug: string; current_rev: number } | null;
      }
      interface JHit {
        id: string;
        handle: string;
        display_name: string;
      }
      const [revs, js] = await Promise.all([
        rest<RevHit[]>(urls.revisions),
        rest<JHit[]>(urls.journalists),
      ]);
      const seen = new Set<string>();
      const articleHits: SearchResult[] = [];
      for (const r of revs) {
        const slug = r.nw_articles?.slug;
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        articleHits.push({ kind: 'article', ref: slug, title: r.headline, snippet: r.dek ?? '' });
      }
      const journalists = await publicJournalistsByProfileIds(js.map((profile) => profile.id));
      const journalistsById = journalistMap(journalists);
      const jHits = js.flatMap((profile): SearchResult[] => {
        const journalist = journalistsById.get(profile.id);
        if (!journalist) return [];
        return [
          {
            kind: 'journalist',
            ref: profile.handle,
            title: profile.display_name,
            snippet: journalist.bio ?? '',
          },
        ];
      });
      return [...articleHits, ...jHits].slice(0, limit);
    },

    async callFunction<T>(name: MyNewsFunctionName, body: unknown): Promise<FunctionEnvelope<T>> {
      return invokeFunction<T>(name, body);
    },

    async getMyProfile() {
      const token = await sessionToken();
      if (!token) return null;
      const userId = decodeJwtSub(token);
      if (!userId) return null;
      const rows = await rest<ProfileRow[]>(buildMyProfileUrl(cfg.baseUrl, userId), token);
      return rows[0] ? mapProfileRow(rows[0]) : null;
    },

    async isHandleAvailable(handle) {
      const rows = await rest<Array<{ id: string }>>(buildHandleUrl(cfg.baseUrl, handle));
      return rows.length === 0;
    },

    async registerProfile(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const res = await send(`${cfg.baseUrl}/rest/v1/nw_profiles`, token, {
        method: 'POST',
        prefer: 'return=representation',
        // The key is bound in a second proof-of-possession step (registerKey);
        // the RLS guard trigger forbids setting a non-empty key at insert time,
        // so the profile is created with the empty-key default.
        body: {
          user_id: input.userId,
          handle: input.handle,
          display_name: input.displayName,
          pubkey_ed25519: '',
        },
      });
      if (res.status === 409) {
        // nw_profiles has unique constraints on BOTH handle and user_id; only
        // a duplicate handle is 'handle-taken'. PostgREST names the violated
        // constraint (e.g. "nw_profiles_handle_key") in the error body.
        const text = await res.text().catch(() => '');
        return { ok: false, error: text.includes('handle') ? 'handle-taken' : 'already-registered' };
      }
      if (!res.ok) return { ok: false, error: `profile-${res.status}` };
      const rows = (await res.json().catch(() => [])) as ProfileRow[];
      if (!rows[0]) return { ok: false, error: 'profile-missing' };
      return { ok: true, profile: mapProfileRow(rows[0]) };
    },

    async registerKey(input) {
      const envelope = await invokeFunction<{ pubkey: string }>('mynews-register-key', {
        pubkey: input.pubkeyHex,
        signatureHex: input.signatureHex,
      });
      if (envelope.ok) return { ok: true };
      return { ok: false, error: envelope.error };
    },

    async getProfileKeyChain(profileId) {
      // nw_profile_keys carries a public select policy: it IS the record readers
      // need to verify authorship, and every column on it is already public.
      // Newest first, matching how the chain reads on screen.
      const rows = await rest<
        Array<{
          id: string;
          profile_id: string;
          pubkey: string;
          status: 'active' | 'revoked';
          kind: 'primary' | 'device';
          // Spelled out rather than imported: cloud-fetch is the subpath the web
          // server components use precisely because it has no runtime imports,
          // and reader-verify reaches @mylife/sync.
          added_via: 'initial' | 'rotation' | 'device_approval' | 'recovery' | 'backup_restore';
          valid_from: string;
          revoked_at: string | null;
        }>
      >(
        `${cfg.baseUrl}/rest/v1/nw_profile_keys?select=id,profile_id,pubkey,status,kind,added_via,valid_from,revoked_at` +
          `&profile_id=eq.${encodeURIComponent(profileId)}&order=seq.desc`,
      );
      return rows.map((row) => ({
        id: row.id,
        profileId: row.profile_id,
        pubkey: row.pubkey,
        status: row.status,
        kind: row.kind,
        addedVia: row.added_via,
        validFrom: row.valid_from,
        revokedAt: row.revoked_at,
      }));
    },

    async becomeJournalist(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      // The server defaults tier to 'open'; clients never send one.
      const res = await send(`${cfg.baseUrl}/rest/v1/nw_journalists`, token, {
        method: 'POST',
        body: {
          profile_id: input.profileId,
          bio: input.bio,
          beats: input.beats,
          region: input.region,
        },
      });
      if (!res.ok) return { ok: false, error: `journalist-${res.status}` };
      return { ok: true };
    },

    async getSuggestionsForArticle(articleId, opts) {
      return suggestionRead(buildSuggestionsForArticleUrl(cfg.baseUrl, articleId, opts));
    },

    async getSuggestion(id) {
      const rows = await suggestionRead(buildSuggestionUrl(cfg.baseUrl, id));
      return rows[0] ?? null;
    },

    async getMySuggestions(editorProfileId) {
      return suggestionRead(buildMySuggestionsUrl(cfg.baseUrl, editorProfileId));
    },

    async getReviewQueue(authorProfileId) {
      return suggestionRead(buildReviewQueueUrl(cfg.baseUrl, authorProfileId));
    },

    async getSuggestionEvents(suggestionId) {
      const bearer = (await sessionToken()) ?? undefined;
      const rows = await rest<SuggestionEventRow[]>(
        buildSuggestionEventsUrl(cfg.baseUrl, suggestionId),
        bearer,
      );
      const profiles = await publicProfilesByIds(
        rows.map((row) => row.actor_id),
        bearer,
      );
      return stitchSuggestionEventActors(rows, profiles)
        .map(mapSuggestionEventRow)
        .filter((e): e is SuggestionEventView => e !== null);
    },

    async postSuggestionComment(input) {
      // Plan 48 WP4: the raw PostgREST insert is gone. Migration 20260730000003
      // drops the client INSERT policy and adds a guard trigger, so a comment
      // only lands through mynews-comment, which resolves the actor from the
      // session, refuses suspended accounts, requires current Terms, throttles
      // per profile, bounds the body, and hides draft threads from non-members.
      // The actor id is never sent: the server derives it from the JWT sub.
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      // Bounds are checked client-side too so an over-long body fails
      // immediately with the same typed code the server would return.
      const bounded = checkCommentBody(input.body);
      if (!bounded.ok) return { ok: false, error: BOUNDS_ERROR };
      let envelope: FunctionEnvelope<{ suggestionId: string }>;
      try {
        envelope = await invokeFunction<{ suggestionId: string }>('mynews-comment', {
          suggestionId: input.suggestionId,
          body: input.body,
        });
      } catch {
        return { ok: false, error: 'comment-network' };
      }
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true };
    },

    async getEditorProfile(handle) {
      const rows = await rest<Array<{ id: string; handle: string; display_name: string; kind: string }>>(
        buildEditorProfileUrl(cfg.baseUrl, handle),
      );
      const row = rows[0];
      if (!row) return null;
      const [ledgerRows, statRows] = await Promise.all([
        rest<LedgerRow[]>(buildEditorLedgerUrl(cfg.baseUrl, row.id)),
        rest<EditorStatRow[]>(buildEditorSuggestionStatsUrl(cfg.baseUrl, row.id)),
      ]);
      return {
        profile: {
          id: row.id,
          handle: row.handle,
          displayName: row.display_name,
          kind: toKind(row.kind),
        },
        ledger: ledgerRows.map(mapLedgerRow),
        aggregates: deriveEditorAggregates(statRows.map(mapEditorStatRow)),
      };
    },

    async listMyNewsrooms(profileId) {
      const token = await sessionToken();
      if (!token) return [];
      const rows = await rest<Array<{ newsroom?: NewsroomRow | NewsroomRow[] | null }>>(
        buildMyNewsroomsUrl(cfg.baseUrl, profileId),
        token,
      );
      return rows
        .map((r) => firstOf(r.newsroom))
        .filter((n): n is NewsroomRow => n !== undefined)
        .map(mapNewsroomRow);
    },

    async createNewsroom(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const res = await send(`${cfg.baseUrl}/rest/v1/nw_newsrooms`, token, {
        method: 'POST',
        prefer: 'return=representation',
        body: { owner_id: input.ownerId, name: input.name },
      });
      if (!res.ok) return { ok: false, error: `newsroom-${res.status}` };
      const rows = (await res.json().catch(() => [])) as NewsroomRow[];
      const room = rows[0];
      if (!room) return { ok: false, error: 'newsroom-missing' };
      const memberRes = await send(`${cfg.baseUrl}/rest/v1/nw_newsroom_members`, token, {
        method: 'POST',
        body: {
          newsroom_id: room.id,
          profile_id: input.ownerId,
          role: 'owner',
          invited_by: input.ownerId,
        },
      });
      if (!memberRes.ok) {
        await send(buildNewsroomDeleteUrl(cfg.baseUrl, room.id), token, { method: 'DELETE' }).catch(
          () => undefined,
        );
        return { ok: false, error: 'membership-failed' };
      }
      return { ok: true, newsroom: mapNewsroomRow(room) };
    },

    async getNewsroom(id) {
      const token = await sessionToken();
      if (!token) return null;
      const rooms = await rest<NewsroomRow[]>(buildNewsroomUrl(cfg.baseUrl, id), token);
      const room = rooms[0];
      if (!room) return null;
      const [memberRows, draftRows] = await Promise.all([
        rest<NewsroomMemberRow[]>(buildNewsroomMembersUrl(cfg.baseUrl, id), token),
        rest<NewsroomDraftRow[]>(buildNewsroomDraftsUrl(cfg.baseUrl, id), token),
      ]);
      const profileIds = uniqueValues([
        ...memberRows.map((row) => row.profile_id),
        ...draftRows.map((row) => row.author_id),
      ]);
      const profiles = await publicProfilesByIds(profileIds, token);
      const profilesById = requiredProfileMap(profileIds, profiles, 'newsroom');
      return {
        newsroom: mapNewsroomRow(room),
        members: stitchNewsroomMemberProfiles(memberRows, profilesById)
          .map(mapNewsroomMemberRow)
          .filter((m): m is NewsroomMemberView => m !== null),
        drafts: stitchNewsroomDraftAuthors(draftRows, profilesById)
          .map(mapNewsroomDraftRow)
          .filter((d): d is NewsroomDraftView => d !== null),
      };
    },

    async addNewsroomMember(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const profiles = await rest<Array<{ id: string }>>(buildHandleUrl(cfg.baseUrl, input.handle), token);
      const profile = profiles[0];
      if (!profile) return { ok: false, error: 'unknown-handle' };
      const res = await send(`${cfg.baseUrl}/rest/v1/nw_newsroom_members`, token, {
        method: 'POST',
        body: {
          newsroom_id: input.newsroomId,
          profile_id: profile.id,
          role: input.role,
          invited_by: input.invitedBy,
        },
      });
      if (!res.ok) return { ok: false, error: `member-${res.status}` };
      return { ok: true };
    },

    async removeNewsroomMember(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const res = await send(
        buildRemoveNewsroomMemberUrl(cfg.baseUrl, input.newsroomId, input.profileId),
        token,
        { method: 'DELETE' },
      );
      if (!res.ok) return { ok: false, error: `member-${res.status}` };
      return { ok: true };
    },

    async getDraftArticle(articleId) {
      const token = await sessionToken();
      if (!token) return null;
      const rows = await rest<ArticleRow[]>(buildDraftArticleUrl(cfg.baseUrl, articleId), token);
      if (!rows[0]) return null;
      const stitched = await stitchArticleRows([rows[0]], token);
      return mapArticleRow(stitched[0]!);
    },

    async getArticleMeta(articleId) {
      const token = await sessionToken();
      const rows = await rest<MetaRow[]>(buildArticleMetaUrl(cfg.baseUrl, articleId), token ?? undefined);
      return rows[0] ? mapMetaRow(rows[0]) : null;
    },

    async setArticleMeta(input) {
      // Signed provenance-metadata upsert. The client has already signed the
      // meta canonical bytes; mynews-set-meta verifies against the head author
      // key and confirms the caller is the head author before the service role
      // writes. A direct PostgREST insert is blocked by the client-write guard
      // (migration 20260705000004), so the function is the only write path.
      const envelope = await invokeFunction<{ articleId: string }>('mynews-set-meta', {
        meta: input.meta,
        signatureHex: input.signatureHex,
      });
      if (envelope.ok) return { ok: true };
      return { ok: false, error: envelope.error };
    },

    async submitReport(input) {
      // Session-authenticated write via mynews-report; the function resolves the
      // reporter from the JWT sub, validates the target, dedupes, and rate-limits.
      // A direct client insert is blocked by the client-write guard trigger
      // (migration 20260705000005), so the function is the only write path.
      const envelope = await invokeFunction<{ status: 'submitted' | 'already-reported' }>(
        'mynews-report',
        {
          targetKind: input.targetKind,
          targetId: input.targetId,
          reason: input.reason,
          detail: input.detail ?? '',
        },
      );
      if (envelope.ok) return { ok: true, status: envelope.data.status };
      return { ok: false, error: envelope.error };
    },

    async getMyReports(reporterProfileId) {
      const token = await sessionToken();
      if (!token) return [];
      const rows = await rest<ReportRow[]>(
        buildMyReportsUrl(cfg.baseUrl, reporterProfileId),
        token,
      );
      return rows.map(mapReportRow).filter((r): r is ReportView => r !== null);
    },

    async listBlocks() {
      // Blocks are self-scoped by RLS; a signed-out session has no rows.
      const token = await sessionToken();
      if (!token) return [];
      const rows = await rest<BlockRow[]>(buildMyBlocksUrl(cfg.baseUrl), token);
      const profiles = await publicProfilesByIds(
        rows.map((row) => row.blocked_profile_id),
        token,
      );
      return stitchBlockProfiles(rows, profiles)
        .map(mapBlockRow)
        .filter((b): b is BlockView => b !== null);
    },

    async setBlock(blockedProfileId, mode) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const userId = decodeJwtSub(token);
      if (!userId) return { ok: false, error: 'not-signed-in' };
      // Resolve the caller's own profile id for blocker_id; the RLS with-check
      // also binds the row to the session, so a forged blocker_id is refused.
      const mineRows = await rest<Array<{ id: string }>>(
        buildMyProfileUrl(cfg.baseUrl, userId),
        token,
      );
      const blockerId = mineRows[0]?.id;
      if (!blockerId) return { ok: false, error: 'no-profile' };
      if (blockerId === blockedProfileId) return { ok: false, error: 'cannot-block-self' };
      // Upsert on the unique (blocker_id, blocked_profile_id) pair so re-blocking
      // with a different mode switches it in place. The blocker owns the row
      // directly (no edge function): nw_blocks_self_all with-check binds it.
      const res = await send(`${cfg.baseUrl}/rest/v1/nw_blocks`, token, {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: { blocker_id: blockerId, blocked_profile_id: blockedProfileId, mode },
      });
      if (!res.ok) return { ok: false, error: `block-${res.status}` };
      return { ok: true };
    },

    async removeBlock(blockedProfileId) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const res = await send(
        buildRemoveBlockUrl(cfg.baseUrl, blockedProfileId),
        token,
        { method: 'DELETE' },
      );
      if (!res.ok) return { ok: false, error: `unblock-${res.status}` };
      return { ok: true };
    },

    async getAcceptedTermsVersions() {
      // Self-scoped by nw_terms_acceptance_self_all; a signed-out session has
      // no rows. Filter by user_id so the read is a single indexed lookup.
      const token = await sessionToken();
      if (!token) return [];
      const userId = decodeJwtSub(token);
      if (!userId) return [];
      const rows = await rest<Array<{ terms_version: string }>>(
        `nw_terms_acceptance?select=terms_version&user_id=eq.${encodeURIComponent(userId)}`,
        token,
      );
      return rows.map((r) => r.terms_version);
    },

    async acceptTerms(version) {
      // Self-attesting client insert: nw_terms_acceptance_self_all with-check
      // binds the row to the caller's own auth.uid(); a forged user_id is
      // refused. Idempotent on (user_id, terms_version). The gate that matters
      // is server-side in mynews-publish / mynews-suggest.
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const userId = decodeJwtSub(token);
      if (!userId) return { ok: false, error: 'not-signed-in' };
      const res = await send(`${cfg.baseUrl}/rest/v1/nw_terms_acceptance`, token, {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates',
        body: { user_id: userId, terms_version: version },
      });
      if (!res.ok) return { ok: false, error: `terms-${res.status}` };
      return { ok: true };
    },

    async getMyModerationNotices() {
      // DSA Art 17: statements of reasons about the caller's own content. The
      // mynews-my-notices edge fn scopes the read to owned content server-side;
      // nw_moderation_actions is never queried directly by the client.
      const token = await sessionToken();
      if (!token) return [];
      const envelope = await invokeFunction<{ notices: ModerationNoticeView[] }>(
        'mynews-my-notices',
        {},
      );
      return envelope.ok ? envelope.data.notices : [];
    },

    async appealModerationNotice(input) {
      // Plan 48 WP9. Same edge function as the read: the appeal is a POST with an
      // explicit action, and the server scopes it to actions the caller owns.
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{ appealState: string }>('mynews-my-notices', {
        action: 'appeal',
        actionId: input.actionId,
        reason: input.reason,
      });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true };
    },

    /* ---------------- screening + verification (plan 48 WP8) -------------- */

    async listScreeningHolds() {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{ decisions: ScreeningHoldView[] }>(
        'mynews-screening',
        { action: 'list' },
      );
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true, holds: envelope.data.decisions };
    },

    async appealScreeningHold(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{ appealState: string }>('mynews-screening', {
        action: 'appeal',
        decisionId: input.decisionId,
        reason: input.reason,
      });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true };
    },

    async requestVerification(input) {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{ verificationId: string }>('mynews-verification', {
        action: 'request',
        method: input.method,
        evidenceRef: input.evidenceRef,
        evidence: input.evidence,
      });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true, verificationId: envelope.data.verificationId };
    },

    async getVerificationStatus() {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{
        state: VerificationStateView;
        history: VerificationRecordView[];
      }>('mynews-verification', { action: 'status' });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true, state: envelope.data.state, history: envelope.data.history };
    },

    async initiateAccountDeletion(confirmation) {
      // The mynews-account function requires the typed phrase AND a fresh
      // access token; both are checked server-side, so the client sends the
      // phrase verbatim and surfaces the typed error it gets back.
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{
        created: boolean;
        request: AccountDeletionView;
      }>('mynews-account', { action: 'initiate_deletion', confirmation });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true, created: envelope.data.created, request: envelope.data.request };
    },

    async cancelAccountDeletion() {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{ cancelled: boolean }>('mynews-account', {
        action: 'cancel_deletion',
      });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true };
    },

    async getAccountDeletionStatus() {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{ request: AccountDeletionView | null }>(
        'mynews-account',
        { action: 'deletion_status' },
      );
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true, request: envelope.data.request };
    },

    async exportAccountData() {
      const token = await sessionToken();
      if (!token) return { ok: false, error: 'not-signed-in' };
      const envelope = await invokeFunction<{
        byteCount: number;
        bundle: Record<string, unknown>;
      }>('mynews-account', { action: 'export_data' });
      if (!envelope.ok) return { ok: false, error: envelope.error };
      return { ok: true, byteCount: envelope.data.byteCount, bundle: envelope.data.bundle };
    },
  };
}
