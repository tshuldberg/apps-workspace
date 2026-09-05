// MyNews report: the public UGC safety floor (Apple Guideline 1.2). verify_jwt
// is ON and the reporter is resolved from the JWT sub, so every report remains
// attributable. After the normal or suspended-tier throttle, one atomic RPC
// validates the target, dedupes or escalates by severity, persists the report,
// and completes any NCII takedown plus case creation in one transaction. The
// client-write guard from migration 20260705000005 still blocks direct inserts.
// Any throttle read or intake RPC failure returns a retryable 503, never a
// success-shaped response without matching durable state.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
  type ReportReason,
  type ReportSubmitOutcome,
  type ReportTargetKind,
} from '../_shared/mynews-store.ts';

export interface ReportDeps {
  store: MyNewsStore;
  now?: () => number;
}

// One reporter can force the target-existence read + dedupe read before the
// insert, so a cheap per-reporter count guard bounds abuse regardless.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_IN_WINDOW = 10;
const SUSPENDED_RATE_WINDOW_MS = 60 * 60_000;
const SUSPENDED_RATE_MAX_IN_WINDOW = 3;

const TARGET_KINDS = new Set<ReportTargetKind>([
  'article',
  'revision',
  'suggestion',
  'profile',
  'media',
]);
// Full taxonomy (plan 48 WP8). Twin of REPORT_REASONS in
// modules/mynews/src/models.ts and the nw_reports reason CHECK; the intake RPC
// re-validates against nw_report_sla, so an unrouted reason cannot slip past
// this set into a report with no deadline.
const REASONS = new Set<ReportReason>([
  'child-safety',
  'ncii',
  'threats',
  'violence',
  'self-harm',
  'hate',
  'harassment',
  'impersonation',
  'doxxing-privacy',
  'fraud-scam',
  'copyright',
  'spam',
  'other',
]);

interface ReportBody {
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail: string;
}

function parseBody(raw: unknown): ReportBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.targetKind !== 'string' || !TARGET_KINDS.has(b.targetKind as ReportTargetKind)) {
    return null;
  }
  if (typeof b.targetId !== 'string' || b.targetId.trim() === '') return null;
  if (typeof b.reason !== 'string' || !REASONS.has(b.reason as ReportReason)) return null;
  if (b.detail != null && typeof b.detail !== 'string') return null;
  const detail = typeof b.detail === 'string' ? b.detail : '';
  if (detail.length > 2000) return null;
  return {
    targetKind: b.targetKind as ReportTargetKind,
    targetId: b.targetId,
    reason: b.reason as ReportReason,
    detail,
  };
}

export async function handleReportRequest(req: Request, deps: ReportDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  // Reporting requires a session: attributable reports are the anti-flood bar.
  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401, 'sign in to report content');

  const reporterProfileId = await deps.store.getProfileIdByUserId(userId);
  if (!reporterProfileId) return jsonError('no-profile', 403);

  // Check suspension right after profile resolution. Suspended users retain the
  // safety-reporting path, but a stricter three-per-hour throttle limits abuse.
  const nowMs = (deps.now ?? Date.now)();
  const suspended = await deps.store.isProfileSuspended(
    reporterProfileId,
    new Date(nowMs).toISOString(),
  );
  const rateWindowMs = suspended ? SUSPENDED_RATE_WINDOW_MS : RATE_WINDOW_MS;
  const rateMaxInWindow = suspended
    ? SUSPENDED_RATE_MAX_IN_WINDOW
    : RATE_MAX_IN_WINDOW;

  // Rate limit before body validation and intake. A failed count cannot become
  // a throttle bypass, so the whole intake fails closed and remains retryable.
  try {
    const sinceIso = new Date(nowMs - rateWindowMs).toISOString();
    const recent = await deps.store.countRecentReports(reporterProfileId, sinceIso);
    if (recent >= rateMaxInWindow) return jsonError('rate-limited', 429);
  } catch (error) {
    console.error('mynews report throttle count failed', error);
    return jsonError('intake-unavailable', 503, 'report intake is temporarily unavailable');
  }

  let body: ReportBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  let outcome: ReportSubmitOutcome;
  try {
    outcome = await deps.store.submitReport({
      reporterProfileId,
      targetKind: body.targetKind,
      targetId: body.targetId,
      reason: body.reason,
      detail: body.detail,
    });
  } catch (error) {
    console.error('mynews report atomic intake failed', error);
    return jsonError('intake-unavailable', 503, 'report intake is temporarily unavailable');
  }

  switch (outcome) {
    case 'submitted':
      return jsonOk({ status: 'submitted' });
    case 'already-reported':
      return jsonOk({ status: 'already-reported' });
    case 'escalated':
      return jsonOk({ status: 'escalated' });
    case 'bad-target':
      return jsonError('bad-target', 400);
    default:
      console.error('mynews report atomic intake returned an unknown outcome', outcome);
      return jsonError('intake-unavailable', 503, 'report intake is temporarily unavailable');
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleReportRequest(req, { store }), {
      fn: 'mynews-report',
      action: 'submit_report',
    }),
  );
}
