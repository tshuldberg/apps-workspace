// MyNews journalist verification requests (plan 48 WP8 verification center).
//
// nw_journalist_verifications existed as a table with no product path: rows
// could only appear by hand, and the journalist tier was set independently of
// them, so a 'verified' badge did not have to correspond to any verification.
// This function is the request side of the real workflow. Operators approve,
// deny, revoke, and re-verify from the console; the tier follows the
// verification state inside the RPCs, never separately.
//
// verify_jwt stays ON (gateway-verified, like publish and suggest): a
// verification request is an identity claim, so it must be attributable.
//
// Fail-closed notes:
//   evidence is bounded and validated before it reaches the database
//   a request for a profile with no journalist row is 'no-journalist', not a
//     silently created journalist
//   only one pending request may exist, enforced by a unique index as well as by
//     the RPC, so a double submit cannot create a second queue entry
//   the response NEVER claims a verification decision; it reports the request

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../_shared/mynews-terms.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
  type VerificationMethod,
} from '../_shared/mynews-store.ts';

export interface VerificationDeps {
  store: MyNewsStore;
  now?: () => number;
}

const METHODS = new Set<VerificationMethod>(['domain_email', 'orcid', 'byline', 'manual']);

/** Bounds on the evidence a request may carry. */
export const EVIDENCE_MAX_ITEMS = 10;
export const EVIDENCE_ITEM_MAX_CHARS = 500;
export const EVIDENCE_REF_MAX_CHARS = 500;

// A verification request is cheap for us and costly to review, so the throttle
// is per profile and generous in window rather than in count.
const RATE_WINDOW_MS = 24 * 60 * 60_000;
const RATE_MAX_IN_WINDOW = 5;

interface RequestBody {
  action: 'request';
  method: VerificationMethod;
  evidenceRef: string;
  evidence: string[];
}

interface StatusBody {
  action: 'status';
}

type VerificationBody = RequestBody | StatusBody;

function parseBody(raw: unknown): VerificationBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.action === 'status') return { action: 'status' };
  if (b.action !== 'request') return null;
  if (typeof b.method !== 'string' || !METHODS.has(b.method as VerificationMethod)) return null;
  const evidenceRef = typeof b.evidenceRef === 'string' ? b.evidenceRef : '';
  if (evidenceRef.length > EVIDENCE_REF_MAX_CHARS) return null;
  let evidence: string[] = [];
  if (b.evidence !== undefined) {
    if (!Array.isArray(b.evidence)) return null;
    if (b.evidence.length > EVIDENCE_MAX_ITEMS) return null;
    if (!b.evidence.every((item) => typeof item === 'string' && item.length <= EVIDENCE_ITEM_MAX_CHARS)) {
      return null;
    }
    evidence = b.evidence as string[];
  }
  // A request with no evidence at all is not reviewable, so it is refused here
  // rather than queued for an operator to reject.
  if (evidenceRef.trim() === '' && evidence.length === 0) return null;
  return { action: 'request', method: b.method as VerificationMethod, evidenceRef, evidence };
}

export async function handleVerificationRequest(
  req: Request,
  deps: VerificationDeps,
): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401, 'sign in to request verification');

  const profileId = await deps.store.getProfileIdByUserId(userId);
  if (!profileId) return jsonError('no-profile', 403);

  let body: VerificationBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  if (body.action === 'status') {
    try {
      const [state, history] = await Promise.all([
        deps.store.getVerificationState(profileId),
        deps.store.getMyVerifications(userId),
      ]);
      return jsonOk({ state, history });
    } catch (error) {
      console.error('mynews verification status read failed', error);
      return jsonError('verification-unavailable', 503, 'verification is temporarily unavailable');
    }
  }

  const nowMs = (deps.now ?? Date.now)();

  // A suspended account cannot request verification: verification is a trust
  // grant, and granting trust to a suspended account makes no sense.
  if (await deps.store.isProfileSuspended(profileId, new Date(nowMs).toISOString())) {
    return jsonError('suspended', 403);
  }

  if (!(await deps.store.hasAcceptedTerms(userId, EDGE_CURRENT_TERMS_VERSION))) {
    return jsonError('terms-not-accepted', 403, EDGE_CURRENT_TERMS_VERSION);
  }

  // Fail closed on the throttle read, exactly as report, comment, and suggest
  // do: a count that cannot be read cannot prove the ceiling holds.
  try {
    const sinceIso = new Date(nowMs - RATE_WINDOW_MS).toISOString();
    const recent = (await deps.store.getMyVerifications(userId)).filter(
      (row) => row.createdAt >= sinceIso,
    ).length;
    if (recent >= RATE_MAX_IN_WINDOW) return jsonError('rate-limited', 429);
  } catch (error) {
    console.error('mynews verification throttle read failed', error);
    return jsonError('verification-unavailable', 503, 'verification is temporarily unavailable');
  }

  let outcome: Awaited<ReturnType<MyNewsStore['requestVerification']>>;
  try {
    outcome = await deps.store.requestVerification({
      profileId,
      method: body.method,
      evidenceRef: body.evidenceRef,
      evidence: body.evidence,
    });
  } catch (error) {
    console.error('mynews verification request failed', error);
    return jsonError('verification-unavailable', 503, 'verification is temporarily unavailable');
  }

  if (!outcome.ok) {
    switch (outcome.code) {
      case 'no-journalist':
        return jsonError('no-journalist', 403, 'set up a journalist profile first');
      case 'bad-method':
        return jsonError('bad-payload', 400, 'unsupported verification method');
      case 'already-pending':
        return jsonError('already-pending', 409, 'a verification request is already in review');
      case 'already-verified':
        return jsonError('already-verified', 409, 'this profile is already verified');
      default:
        return jsonError('verification-unavailable', 503, 'verification is temporarily unavailable');
    }
  }

  // Honest copy: a queued request is a queued request. No timeline is promised,
  // because review is staffed by people and staffing is a founder-ops matter.
  return jsonOk({
    verificationId: outcome.verificationId,
    status: 'pending',
    message: 'Your verification request is in the review queue. You will see the decision here.',
  });
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleVerificationRequest(req, { store }), {
      fn: 'mynews-verification',
      action: 'request_verification',
    }),
  );
}
