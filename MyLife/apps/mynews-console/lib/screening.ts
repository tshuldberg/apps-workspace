import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  decodeCursor,
  encodeCursor,
  isUuidSearch,
  keysetAfterFilter,
  sanitizeSearchTerm,
} from './pagination';

/**
 * Service-role reads and RPC calls for the screening review queue (plan 48
 * WP8). Every function here runs under the service role and is invoked only from
 * pages and server actions that first call requireModerator(). The RPCs are
 * granted to service_role only (migration 20260730000009), so a browser bundle
 * could not reach them even if this file were mis-imported; it is server-only.
 */

export type ScreeningContentKind =
  | 'article'
  | 'revision'
  | 'suggestion'
  | 'comment'
  | 'revision-proposal';

export interface ScreeningDecisionRow {
  id: string;
  contentKind: ScreeningContentKind;
  contentId: string;
  contentRev: number | null;
  authorProfileId: string;
  authorHandle: string | null;
  engineVersion: string;
  provider: string;
  providerState: string;
  riskScore: number;
  topClass: string | null;
  classScores: Record<string, number>;
  thresholdHit: string | null;
  requiresHumanReview: boolean;
  explanations: string[];
  autoAction: 'allowed' | 'quarantined' | 'held';
  decision: 'pending' | 'approved' | 'rejected' | 'auto-allowed';
  appealState: 'none' | 'requested' | 'granted' | 'denied';
  appealReason: string;
  reviewReason: string;
  reviewerRef: string | null;
  createdAt: string;
  /** Optimistic concurrency token (plan 48 WP9). */
  consoleVersion: number;
  /** Content preview, hydrated per kind. Null when the target is gone. */
  preview: ScreeningPreview | null;
}

export type ScreeningPreview =
  | { kind: 'article'; slug: string; status: string; headline: string; body: string }
  | { kind: 'suggestion'; articleId: string; status: string; rationale: string }
  | { kind: 'comment'; suggestionId: string; body: string }
  | { kind: 'revision-proposal'; headline: string; body: string };

const DECISION_SELECT =
  'id,content_kind,content_id,content_rev,author_profile_id,engine_version,provider,' +
  'provider_state,risk_score,top_class,class_scores,threshold_hit,requires_human_review,' +
  'explanations,auto_action,decision,appeal_state,appeal_reason,review_reason,reviewer_ref,' +
  'held_payload,created_at,console_version';

interface DecisionRowRaw {
  id: string;
  content_kind: ScreeningContentKind;
  content_id: string;
  content_rev: number | null;
  author_profile_id: string;
  engine_version: string;
  provider: string;
  provider_state: string;
  risk_score: number | string;
  top_class: string | null;
  class_scores: unknown;
  threshold_hit: string | null;
  requires_human_review: boolean;
  explanations: unknown;
  auto_action: 'allowed' | 'quarantined' | 'held';
  decision: 'pending' | 'approved' | 'rejected' | 'auto-allowed';
  appeal_state: 'none' | 'requested' | 'granted' | 'denied';
  appeal_reason: string;
  review_reason: string;
  reviewer_ref: string | null;
  held_payload: unknown;
  created_at: string;
  console_version: number;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num)) out[key] = num;
  }
  return out;
}

function heldPreview(payload: unknown): ScreeningPreview | null {
  if (!payload || typeof payload !== 'object') return null;
  const revision = (payload as { revision?: Record<string, unknown> }).revision;
  if (!revision) return null;
  return {
    kind: 'revision-proposal',
    headline: typeof revision.headline === 'string' ? revision.headline : '',
    body: typeof revision.bodyMd === 'string' ? revision.bodyMd : '',
  };
}

/**
 * Pending screening decisions, oldest first (a hold is a queue, so the oldest
 * hold is the most overdue). Content previews are hydrated per kind in batched
 * reads; a decision whose target is gone keeps a null preview so the moderator
 * still sees the decision rather than nothing.
 */
export interface ScreeningQueuePage {
  items: ScreeningDecisionRow[];
  nextCursor: string | null;
  searched: boolean;
}

/**
 * One page of the screening queue (plan 48 WP9 pagination).
 *
 * Keyset on (created_at, id) ASCENDING, because a hold queue is worked
 * oldest-first: the longest-waiting submission is the most overdue. OFFSET would
 * skip rows as decisions are made underneath the reader. Search is exact on ids
 * and a substring on the flagged class, sanitised in lib/pagination.ts before it
 * reaches a PostgREST filter.
 */
export async function fetchScreeningQueuePage(
  admin: SupabaseClient,
  options: {
    limit?: number;
    appealsOnly?: boolean;
    cursor?: string | null;
    search?: string | null;
  } = {},
): Promise<ScreeningQueuePage> {
  const pageSize = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const cursor = decodeCursor(options.cursor);
  const search = sanitizeSearchTerm(options.search);

  let query = admin.from('nw_screening_decisions').select(DECISION_SELECT);
  query = options.appealsOnly
    ? query.eq('appeal_state', 'requested')
    : query.eq('decision', 'pending');
  if (cursor) query = query.or(keysetAfterFilter(cursor));
  if (search) {
    query = isUuidSearch(search)
      ? query.or(`id.eq.${search},content_id.eq.${search},author_profile_id.eq.${search}`)
      : query.or(`top_class.ilike.*${search}*,content_kind.ilike.*${search}*`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(pageSize + 1);
  if (error) throw new Error(`mynews-console: screening queue read failed: ${error.message}`);
  const fetched = (data ?? []) as unknown as DecisionRowRaw[];
  const hasMore = fetched.length > pageSize;
  const page = hasMore ? fetched.slice(0, pageSize) : fetched;
  const last = page[page.length - 1];
  return {
    items: await hydrateDecisions(admin, page),
    nextCursor:
      hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
    searched: search !== null,
  };
}

async function hydrateDecisions(
  admin: SupabaseClient,
  rows: DecisionRowRaw[],
): Promise<ScreeningDecisionRow[]> {
  if (rows.length === 0) return [];

  const idsFor = (kinds: ScreeningContentKind[]) => [
    ...new Set(rows.filter((row) => kinds.includes(row.content_kind)).map((row) => row.content_id)),
  ];
  const articleIds = idsFor(['article', 'revision']);
  const suggestionIds = idsFor(['suggestion']);
  const eventIds = idsFor(['comment']);
  const profileIds = [...new Set(rows.map((row) => row.author_profile_id))];

  const [articles, revisions, suggestions, events, profiles] = await Promise.all([
    articleIds.length
      ? admin.from('nw_articles').select('id,slug,status').in('id', articleIds)
      : Promise.resolve({ data: [], error: null }),
    articleIds.length
      ? admin
          .from('nw_article_revisions')
          .select('article_id,rev,headline,body_md')
          .in('article_id', articleIds)
      : Promise.resolve({ data: [], error: null }),
    suggestionIds.length
      ? admin
          .from('nw_edit_suggestions')
          .select('id,article_id,status,rationale')
          .in('id', suggestionIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin.from('nw_suggestion_events').select('id,suggestion_id,payload').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? admin.from('nw_profiles').select('id,handle').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [label, result] of [
    ['article', articles],
    ['revision', revisions],
    ['suggestion', suggestions],
    ['comment', events],
    ['profile', profiles],
  ] as const) {
    if (result.error) {
      throw new Error(`mynews-console: screening ${label} hydrate failed: ${result.error.message}`);
    }
  }

  const articleById = new Map(
    ((articles.data ?? []) as Array<{ id: string; slug: string; status: string }>).map((row) => [
      row.id,
      row,
    ]),
  );
  const revisionByKey = new Map(
    (
      (revisions.data ?? []) as Array<{
        article_id: string;
        rev: number;
        headline: string;
        body_md: string;
      }>
    ).map((row) => [`${row.article_id}:${row.rev}`, row]),
  );
  const suggestionById = new Map(
    (
      (suggestions.data ?? []) as Array<{
        id: string;
        article_id: string;
        status: string;
        rationale: string;
      }>
    ).map((row) => [row.id, row]),
  );
  const eventById = new Map(
    (
      (events.data ?? []) as Array<{
        id: string;
        suggestion_id: string;
        payload: { body?: unknown } | null;
      }>
    ).map((row) => [row.id, row]),
  );
  const handleById = new Map(
    ((profiles.data ?? []) as Array<{ id: string; handle: string }>).map((row) => [
      row.id,
      row.handle,
    ]),
  );

  return rows.map((row) => {
    let preview: ScreeningPreview | null = null;
    if (row.content_kind === 'article' || row.content_kind === 'revision') {
      const article = articleById.get(row.content_id);
      const revision = revisionByKey.get(`${row.content_id}:${row.content_rev ?? 0}`);
      if (article) {
        preview = {
          kind: 'article',
          slug: article.slug,
          status: article.status,
          headline: revision?.headline ?? '',
          body: revision?.body_md ?? '',
        };
      }
    } else if (row.content_kind === 'suggestion') {
      const suggestion = suggestionById.get(row.content_id);
      if (suggestion) {
        preview = {
          kind: 'suggestion',
          articleId: suggestion.article_id,
          status: suggestion.status,
          rationale: suggestion.rationale,
        };
      }
    } else if (row.content_kind === 'comment') {
      const event = eventById.get(row.content_id);
      if (event) {
        preview = {
          kind: 'comment',
          suggestionId: event.suggestion_id,
          body: typeof event.payload?.body === 'string' ? event.payload.body : '',
        };
      }
    } else if (row.content_kind === 'revision-proposal') {
      preview = heldPreview(row.held_payload);
    }

    return {
      id: row.id,
      contentKind: row.content_kind,
      contentId: row.content_id,
      contentRev: row.content_rev,
      authorProfileId: row.author_profile_id,
      authorHandle: handleById.get(row.author_profile_id) ?? null,
      engineVersion: row.engine_version,
      provider: row.provider,
      providerState: row.provider_state,
      riskScore: Number(row.risk_score),
      topClass: row.top_class,
      classScores: numberRecord(row.class_scores),
      thresholdHit: row.threshold_hit,
      requiresHumanReview: row.requires_human_review,
      explanations: stringArray(row.explanations),
      autoAction: row.auto_action,
      decision: row.decision,
      appealState: row.appeal_state,
      appealReason: row.appeal_reason,
      reviewReason: row.review_reason,
      reviewerRef: row.reviewer_ref,
      createdAt: row.created_at,
      consoleVersion: row.console_version,
      preview,
    };
  });
}

export interface ScreeningMeasurementRow {
  topClass: string;
  holds: number;
  holdsPending: number;
  falsePositives: number;
  truePositives: number;
  recordedAllows: number;
  falseNegatives: number;
  /** Null until at least one hold has been dispositioned in that class. */
  falsePositiveRate: number | null;
}

/**
 * False-positive and false-negative measurement per class, read straight from
 * the generated columns on the decision rows. Pending holds are reported
 * separately rather than counted as correct.
 */
export async function fetchScreeningMeasurement(
  admin: SupabaseClient,
): Promise<ScreeningMeasurementRow[]> {
  const { data, error } = await admin
    .from('nw_screening_measurement')
    .select(
      'top_class,holds,holds_pending,false_positives,true_positives,recorded_allows,false_negatives,false_positive_rate',
    );
  if (error) throw new Error(`mynews-console: screening measurement read failed: ${error.message}`);
  return (
    (data ?? []) as Array<{
      top_class: string;
      holds: number;
      holds_pending: number;
      false_positives: number;
      true_positives: number;
      recorded_allows: number;
      false_negatives: number;
      false_positive_rate: number | string | null;
    }>
  )
    .map((row) => ({
      topClass: row.top_class,
      holds: row.holds,
      holdsPending: row.holds_pending,
      falsePositives: row.false_positives,
      truePositives: row.true_positives,
      recordedAllows: row.recorded_allows,
      falseNegatives: row.false_negatives,
      falsePositiveRate:
        row.false_positive_rate === null ? null : Number(row.false_positive_rate),
    }))
    .sort((a, b) => b.holds - a.holds || a.topClass.localeCompare(b.topClass));
}

/** Current decision state for one row (server-action staleness guard). */
export async function fetchScreeningDecisionState(
  admin: SupabaseClient,
  decisionId: string,
): Promise<{ decision: string; appealState: string; consoleVersion: number } | null> {
  const { data, error } = await admin
    .from('nw_screening_decisions')
    .select('decision,appeal_state,console_version')
    .eq('id', decisionId)
    .limit(1);
  if (error) throw new Error(`mynews-console: screening decision read failed: ${error.message}`);
  const row = (data ?? [])[0] as
    | { decision: string; appeal_state: string; console_version: number }
    | undefined;
  return row
    ? { decision: row.decision, appealState: row.appeal_state, consoleVersion: row.console_version }
    : null;
}

async function callRpc(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    console.error(`mynews-console: ${name} failed: ${error.message}`);
    return 'rpc-failed';
  }
  return data;
}

/**
 * Approve a held submission: releases the content and issues a content
 * allowance, in one transaction inside the RPC. Returns the RPC's scalar
 * ('ok' | 'stale-rev' | a named failure).
 */
export function approveScreeningDecision(
  admin: SupabaseClient,
  input: { decisionId: string; moderatorRef: string; reason: string },
): Promise<unknown> {
  return callRpc(admin, 'nw_screening_approve', {
    p_decision_id: input.decisionId,
    p_reviewer_ref: input.moderatorRef,
    p_reason: input.reason,
  });
}

/** Reject a held submission. Content stays non-public; nothing is deleted. */
export function rejectScreeningDecision(
  admin: SupabaseClient,
  input: { decisionId: string; moderatorRef: string; reason: string },
): Promise<unknown> {
  return callRpc(admin, 'nw_screening_reject', {
    p_decision_id: input.decisionId,
    p_reviewer_ref: input.moderatorRef,
    p_reason: input.reason,
  });
}

/**
 * Dispose of an appeal. Granting routes through the same release path as an
 * approval, so a granted appeal actually restores the content instead of only
 * changing a label.
 */
export function disposeScreeningAppeal(
  admin: SupabaseClient,
  input: { decisionId: string; moderatorRef: string; grant: boolean; reason: string },
): Promise<unknown> {
  return callRpc(admin, 'nw_screening_appeal_disposition', {
    p_decision_id: input.decisionId,
    p_reviewer_ref: input.moderatorRef,
    p_grant: input.grant,
    p_reason: input.reason,
  });
}
