import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  decodeCursor,
  encodeCursor,
  isUuidSearch,
  keysetAfterFilter,
  keysetBeforeFilter,
  sanitizeSearchTerm,
} from './pagination';

/**
 * Service-role queue reads + enforcement RPC calls. Every function here runs
 * under the service role (createAdminClient) and is invoked only from server
 * actions/pages that first call requireModerator(). The enforcement RPCs are
 * granted to service_role only (migration 20260705000007), so a browser bundle
 * can never reach them even if this file were mis-imported (it is server-only).
 */

export type ReportTargetKind = 'article' | 'revision' | 'suggestion' | 'profile' | 'media';

export interface QueueItem {
  id: string;
  reporterProfileId: string | null;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: string;
  detail: string;
  createdAt: string;
  /**
   * Optimistic concurrency token (plan 48 WP9). The page renders this and the
   * enforcement RPC refuses a version that moved, so two moderators acting on the
   * same report produce one enforcement and one typed stale-action conflict.
   */
  consoleVersion: number;
  targetContext:
    | { kind: 'article'; slug: string; status: string; authorProfileId: string; headline: string }
    | { kind: 'suggestion'; articleId: string; status: string; editorProfileId: string; rationale: string }
    | { kind: 'profile'; handle: string; suspendedUntil: string | null }
    | { kind: 'media'; ref: string }
    | null;
}

interface ReportRow {
  id: string;
  reporter_id: string | null;
  target_kind: ReportTargetKind;
  target_id: string;
  reason: string;
  detail: string;
  created_at: string;
  console_version: number;
}

const REPORT_SELECT =
  'id,reporter_id,target_kind,target_id,reason,detail,created_at,console_version';

export interface ReportQueueQuery {
  /** Page size. One extra row is fetched to detect a next page. */
  limit?: number;
  /** Opaque keyset cursor from the previous page. */
  cursor?: string | null;
  /** Operator search: report id, target id, reporter id, or a reason substring. */
  search?: string | null;
  /** Restrict to a status; the queue defaults to open work only. */
  status?: 'open' | 'all';
}

export interface ReportQueuePage {
  items: QueueItem[];
  nextCursor: string | null;
  /** True when the search term was applied (so an empty page reads correctly). */
  searched: boolean;
}

/**
 * One page of the report queue with per-target context.
 *
 * Keyset paginated on (created_at, id) descending: OFFSET would both slow down as
 * the queue grows and silently skip or repeat rows when a report is resolved
 * between page loads. Search is exact-match on ids and a substring match on the
 * reason; the term is sanitised in lib/pagination.ts before it reaches a
 * PostgREST filter, because supabase-js does not quote filter values.
 *
 * Each distinct target is hydrated in a batched read per kind; a report naming a
 * now-gone target keeps targetContext null so the moderator still sees the raw
 * report.
 */
export async function fetchReportQueuePage(
  admin: SupabaseClient,
  query: ReportQueueQuery = {},
): Promise<ReportQueuePage> {
  const pageSize = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const cursor = decodeCursor(query.cursor);
  const search = sanitizeSearchTerm(query.search);

  let request = admin.from('nw_reports').select(REPORT_SELECT);
  if ((query.status ?? 'open') === 'open') request = request.eq('status', 'open');
  if (cursor) request = request.or(keysetBeforeFilter(cursor));
  if (search) {
    // A UUID search means the operator pasted an id, so match the report or its
    // target or its reporter exactly instead of substring-matching a uuid.
    request = isUuidSearch(search)
      ? request.or(`id.eq.${search},target_id.eq.${search},reporter_id.eq.${search}`)
      : request.or(`reason.ilike.*${search}*,target_id.ilike.*${search}*`);
  }

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);
  if (error) throw new Error(`mynews-console: report queue read failed: ${error.message}`);
  const fetched = (data ?? []) as ReportRow[];
  const hasMore = fetched.length > pageSize;
  const reports = hasMore ? fetched.slice(0, pageSize) : fetched;
  const last = reports[reports.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null;

  return {
    items: await hydrateReports(admin, reports),
    nextCursor,
    searched: search !== null,
  };
}

async function hydrateReports(
  admin: SupabaseClient,
  reports: ReportRow[],
): Promise<QueueItem[]> {
  if (reports.length === 0) return [];

  const distinct = (kinds: ReportTargetKind[]) => [
    ...new Set(reports.filter((r) => kinds.includes(r.target_kind)).map((r) => r.target_id)),
  ];
  const articleIds = distinct(['article', 'revision']);
  const suggestionIds = distinct(['suggestion']);
  const profileIds = distinct(['profile']);

  const [articles, suggestions, profiles] = await Promise.all([
    articleIds.length
      ? admin
          .from('nw_articles')
          .select('id,slug,status,author_id,nw_article_revisions(headline,rev)')
          .in('id', articleIds)
      : Promise.resolve({ data: [], error: null }),
    suggestionIds.length
      ? admin
          .from('nw_edit_suggestions')
          .select('id,article_id,status,editor_id,rationale')
          .in('id', suggestionIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? admin.from('nw_profiles').select('id,handle,suspended_until').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (articles.error) throw new Error(`mynews-console: article hydrate failed: ${articles.error.message}`);
  if (suggestions.error) throw new Error(`mynews-console: suggestion hydrate failed: ${suggestions.error.message}`);
  if (profiles.error) throw new Error(`mynews-console: profile hydrate failed: ${profiles.error.message}`);

  const articleById = new Map(
    ((articles.data ?? []) as Array<{
      id: string;
      slug: string;
      status: string;
      author_id: string;
      nw_article_revisions: Array<{ headline: string; rev: number }> | null;
    }>).map((a) => [a.id, a]),
  );
  const suggestionById = new Map(
    ((suggestions.data ?? []) as Array<{
      id: string;
      article_id: string;
      status: string;
      editor_id: string;
      rationale: string;
    }>).map((s) => [s.id, s]),
  );
  const profileById = new Map(
    ((profiles.data ?? []) as Array<{ id: string; handle: string; suspended_until: string | null }>).map(
      (p) => [p.id, p],
    ),
  );

  return reports.map((r) => {
    let targetContext: QueueItem['targetContext'] = null;
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
      if (p) targetContext = { kind: 'profile', handle: p.handle, suspendedUntil: p.suspended_until };
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
      consoleVersion: r.console_version,
      targetContext,
    };
  });
}

/** Look up a single open report by id (server-action target derivation). */
export async function fetchReport(
  admin: SupabaseClient,
  reportId: string,
): Promise<{ targetKind: ReportTargetKind; targetId: string; status: string } | null> {
  const { data, error } = await admin
    .from('nw_reports')
    .select('target_kind,target_id,status')
    .eq('id', reportId)
    .limit(1);
  if (error) throw new Error(`mynews-console: report lookup failed: ${error.message}`);
  const row = (data ?? [])[0] as { target_kind: ReportTargetKind; target_id: string; status: string } | undefined;
  return row ? { targetKind: row.target_kind, targetId: row.target_id, status: row.status } : null;
}

/** Resolve the author profile id for an article (copyright-strike target derivation). */
export async function fetchArticleAuthor(
  admin: SupabaseClient,
  articleId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('nw_articles')
    .select('author_id')
    .eq('id', articleId)
    .limit(1);
  if (error) throw new Error(`mynews-console: article author lookup failed: ${error.message}`);
  const row = (data ?? [])[0] as { author_id: string } | undefined;
  return row?.author_id ?? null;
}

/* --------------------------- enforcement RPC calls --------------------------- */

async function callRpc(admin: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    console.error(`mynews-console: ${name} failed: ${error.message}`);
    return 'rpc-failed';
  }
  return data;
}

export function moderateHideArticle(
  admin: SupabaseClient,
  input: { articleId: string; moderatorRef: string; note: string; reportId?: string | null },
): Promise<unknown> {
  return callRpc(admin, 'nw_moderate_hide_article', {
    p_article_id: input.articleId,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
    p_report_id: input.reportId ?? null,
  });
}

export function moderateHideSuggestion(
  admin: SupabaseClient,
  input: { suggestionId: string; moderatorRef: string; note: string; reportId?: string | null },
): Promise<unknown> {
  return callRpc(admin, 'nw_moderate_hide_suggestion', {
    p_suggestion_id: input.suggestionId,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
    p_report_id: input.reportId ?? null,
  });
}

export function moderateSuspendProfile(
  admin: SupabaseClient,
  input: { profileId: string; until: string | null; moderatorRef: string; note: string; reportId?: string | null },
): Promise<unknown> {
  return callRpc(admin, 'nw_moderate_suspend_profile', {
    p_profile_id: input.profileId,
    p_until: input.until,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
    p_report_id: input.reportId ?? null,
  });
}

export function moderateResolveReport(
  admin: SupabaseClient,
  input: { reportId: string; status: 'actioned' | 'no_action'; moderatorRef: string; note: string },
): Promise<unknown> {
  return callRpc(admin, 'nw_moderate_resolve_report', {
    p_report_id: input.reportId,
    p_status: input.status,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
  });
}

/**
 * Repeat-infringer teeth (migration 20260705000008). Increments an author's
 * copyright strike count, audits it, and suspends the profile once strikes reach
 * the threshold (default 3). Returns 'suspended' | 'struck' | 'not-found' |
 * 'bad-moderator' as the scalar text; the caller maps it through mapRpcResult.
 */
export function moderateStrikeAndMaybeSuspend(
  admin: SupabaseClient,
  input: { profileId: string; moderatorRef: string; note: string; reportId?: string | null; threshold?: number },
): Promise<unknown> {
  return callRpc(admin, 'nw_moderate_strike_and_maybe_suspend', {
    p_profile_id: input.profileId,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
    p_report_id: input.reportId ?? null,
    p_threshold: input.threshold ?? 3,
    p_suspend_until: null,
  });
}

/* ------------------- support ledger reconciliation (read-only) ------------- */

export interface SupportReconciliationRunRow {
  id: string;
  workerRef: string;
  startedAt: string;
  finishedAt: string;
  ledgerRows: number;
  pairCount: number;
  ok: boolean;
  mismatchCount: number;
  findings: string[];
}

/**
 * Recent output of the mynews-support-worker reconciliation pass, newest first.
 * Read-only: the console reports what the worker found and never edits the
 * append-only support ledger. Service-role read of nw_support_reconciliation_runs
 * (RLS on, zero client policies).
 */
export async function fetchSupportReconciliationRuns(
  admin: SupabaseClient,
  limit = 25,
): Promise<SupportReconciliationRunRow[]> {
  const { data, error } = await admin
    .from('nw_support_reconciliation_runs')
    .select(
      'id,worker_ref,started_at,finished_at,ledger_rows,pair_count,ok,mismatch_count,findings',
    )
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`mynews-console: support reconciliation read failed: ${error.message}`);
  }
  return ((data ?? []) as Array<{
    id: string;
    worker_ref: string;
    started_at: string;
    finished_at: string;
    ledger_rows: number;
    pair_count: number;
    ok: boolean;
    mismatch_count: number;
    findings: unknown;
  }>).map((r) => ({
    id: r.id,
    workerRef: r.worker_ref,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    ledgerRows: r.ledger_rows,
    pairCount: r.pair_count,
    ok: r.ok,
    mismatchCount: r.mismatch_count,
    findings: Array.isArray(r.findings)
      ? r.findings.filter((finding): finding is string => typeof finding === 'string')
      : [],
  }));
}

export interface DmcaNoticeRow {
  id: string;
  kind: 'takedown' | 'counter';
  reportId: string | null;
  complainantName: string;
  complainantEmail: string;
  complainantAddress: string;
  copyrightedWork: string;
  infringingUrl: string;
  targetKind: string | null;
  targetId: string | null;
  signature: string;
  createdAt: string;
}

/* ------------------------------- NCII cases -------------------------------- */

export interface NciiCaseRow {
  id: string;
  reportId: string;
  targetKind: ReportTargetKind;
  targetId: string;
  deadlineAt: string;
  status: 'queued' | 'removed' | 'escalated' | 'cleared';
  hashMatchStatus: 'pending' | 'match' | 'no_match' | 'error';
  ncmecRef: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Urgent lane (plan 48 WP8). nw_ncii_cases is shared by NCII and child-safety
   * reports, at 48h and 24h respectively, so the queue has to say which.
   */
  caseClass: 'ncii' | 'child-safety';
  /** Optimistic concurrency token (plan 48 WP9). */
  consoleVersion: number;
}

/**
 * Open (non-cleared) NCII / TAKE IT DOWN cases, soonest-deadline-first. Service-
 * role read of nw_ncii_cases (RLS on, zero client policies; only this admin
 * client reaches it).
 */
const NCII_SELECT =
  'id,report_id,target_kind,target_id,deadline_at,status,hash_match_status,ncmec_ref,note,' +
  'created_at,updated_at,case_class,console_version';

export interface NciiQueuePage {
  items: NciiCaseRow[];
  nextCursor: string | null;
  searched: boolean;
}

/**
 * One page of the urgent queue (plan 48 WP9 pagination).
 *
 * Keyset on (deadline_at, id) ascending: this queue is worked soonest-deadline
 * first, so the cursor walks forward through deadlines rather than creation time.
 * The queue should be short, but "should be short" is not a bound: a backlog is
 * exactly when an operator needs to reach page two.
 */
export async function fetchNciiQueuePage(
  admin: SupabaseClient,
  options: { limit?: number; cursor?: string | null; search?: string | null } = {},
): Promise<NciiQueuePage> {
  const pageSize = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const cursor = decodeCursor(options.cursor);
  const search = sanitizeSearchTerm(options.search);

  let query = admin.from('nw_ncii_cases').select(NCII_SELECT).neq('status', 'cleared');
  if (cursor) query = query.or(keysetAfterFilter(cursor, 'deadline_at'));
  if (search) {
    query = isUuidSearch(search)
      ? query.or(`id.eq.${search},report_id.eq.${search},target_id.eq.${search}`)
      : query.or(`case_class.ilike.*${search}*,target_kind.ilike.*${search}*`);
  }

  const { data, error } = await query
    .order('deadline_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(pageSize + 1);
  if (error) throw new Error(`mynews-console: ncii case read failed: ${error.message}`);
  const fetched = mapNciiRows(data);
  const hasMore = fetched.length > pageSize;
  const items = hasMore ? fetched.slice(0, pageSize) : fetched;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last ? encodeCursor({ createdAt: last.deadlineAt, id: last.id }) : null,
    searched: search !== null,
  };
}

function mapNciiRows(data: unknown): NciiCaseRow[] {
  return ((data ?? []) as Array<{
    id: string;
    report_id: string;
    target_kind: ReportTargetKind;
    target_id: string;
    deadline_at: string;
    status: NciiCaseRow['status'];
    hash_match_status: NciiCaseRow['hashMatchStatus'];
    ncmec_ref: string | null;
    note: string;
    created_at: string;
    updated_at: string;
    case_class?: string | null;
    console_version: number;
  }>).map((r) => ({
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
    // The column defaults to 'ncii' in SQL; a row read before the migration
    // lands reads the same way, so the label never claims a lane it lacks.
    caseClass: r.case_class === 'child-safety' ? 'child-safety' : 'ncii',
    consoleVersion: r.console_version,
  }));
}

/** Look up a single NCII case's current status (server-action guard). */
export async function fetchNciiCaseStatus(
  admin: SupabaseClient,
  caseId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('nw_ncii_cases')
    .select('status')
    .eq('id', caseId)
    .limit(1);
  if (error) throw new Error(`mynews-console: ncii case lookup failed: ${error.message}`);
  const row = (data ?? [])[0] as { status: string } | undefined;
  return row?.status ?? null;
}

/**
 * NCII enforcement (migration 20260705000009). ensure_removed | escalate |
 * clear. clear is human-only (the RPC rejects the 'ncii-auto' worker ref). The
 * new status ('removed' | 'escalated' | 'cleared') or a named failure comes back
 * as the scalar text; the caller maps it through mapRpcResult.
 */
export function enforceNciiCase(
  admin: SupabaseClient,
  input: {
    caseId: string;
    action: 'ensure_removed' | 'escalate' | 'clear';
    moderatorRef: string;
    note: string;
    hashStatus?: string | null;
    ncmecRef?: string | null;
  },
): Promise<unknown> {
  return callRpc(admin, 'nw_ncii_enforce', {
    p_case_id: input.caseId,
    p_action: input.action,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
    p_hash_status: input.hashStatus ?? null,
    p_ncmec_ref: input.ncmecRef ?? null,
  });
}

/** The DMCA notice linked to a report (when the report came from a takedown notice). */
export async function fetchDmcaForReport(
  admin: SupabaseClient,
  reportId: string,
): Promise<DmcaNoticeRow | null> {
  const { data, error } = await admin
    .from('nw_dmca_notices')
    .select(
      'id,kind,report_id,complainant_name,complainant_email,complainant_address,copyrighted_work,infringing_url,target_kind,target_id,signature,created_at',
    )
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`mynews-console: dmca lookup failed: ${error.message}`);
  const row = (data ?? [])[0] as
    | {
        id: string;
        kind: 'takedown' | 'counter';
        report_id: string | null;
        complainant_name: string;
        complainant_email: string;
        complainant_address: string;
        copyrighted_work: string;
        infringing_url: string;
        target_kind: string | null;
        target_id: string | null;
        signature: string;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    reportId: row.report_id,
    complainantName: row.complainant_name,
    complainantEmail: row.complainant_email,
    complainantAddress: row.complainant_address,
    copyrightedWork: row.copyrighted_work,
    infringingUrl: row.infringing_url,
    targetKind: row.target_kind,
    targetId: row.target_id,
    signature: row.signature,
    createdAt: row.created_at,
  };
}
