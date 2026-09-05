// MyNews DMCA takedown and counter-notice intake (Plan 48 WP2).
// The edge boundary validates the two statutory shapes independently, then
// rate-limits by submitter identity before the transactional intake RPC:
//  - Authenticated callers (a user JWT with a sub, i.e. the in-app path) are
//    limited per account; no network-address signal is needed or collected.
//  - Anonymous callers (the public web form) are limited by a platform IP
//    that MUST arrive via the HMAC-signed x-mynews-* proxy headers set by the
//    mynews-web BFF. There is no fallback to spoofable transport headers: an
//    anonymous request without a valid signed platform IP fails closed.
// Missing salt, missing/unsigned IP, counter errors, persistence errors, and
// a response that cannot prove queue visibility all fail closed.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  createPostgrestMyNewsStore,
  type DmcaCounterNoticeRecord,
  type DmcaSubmissionResult,
  type DmcaTakedownRecord,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';

export interface DmcaDeps {
  store: Pick<
    MyNewsStore,
    | 'consumeDmcaRateLimit'
    | 'getProfileIdByUserId'
    | 'submitDmcaCounterNotice'
    | 'submitDmcaTakedown'
  >;
  now?: () => number;
  rateSalt?: string;
}

const DMCA_ATTESTATION_VERSION = '2026-07-12';
const TAKEDOWN_GOOD_FAITH_TEXT =
  'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.';
const TAKEDOWN_ACCURACY_TEXT =
  'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.';
const COUNTER_MISTAKE_TEXT =
  'I state under penalty of perjury that I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.';
const COUNTER_JURISDICTION_TEXT =
  'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, for any judicial district in which MyNews may be found.';
const COUNTER_SERVICE_TEXT =
  "I will accept service of process from the person who submitted the original notice of claimed infringement, or that person's agent.";

const MAX_PROXY_AGE_MS = 5 * 60_000;

type ParsedDmcaBody =
  | ({ kind: 'takedown' } & Omit<DmcaTakedownRecord, 'submitterProfileId'>)
  | ({ kind: 'counter' } & Omit<DmcaCounterNoticeRecord, 'submitterProfileId'>);

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function optionalStr(value: unknown, max: number): string | null {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && value.length <= 2000;
  } catch {
    return false;
  }
}

function parseTakedown(body: Record<string, unknown>): ParsedDmcaBody | null {
  const complainantName = str(body.complainantName, 200);
  const complainantEmail = str(body.complainantEmail, 320);
  const complainantAddress = optionalStr(body.complainantAddress, 1000);
  const copyrightedWork = str(body.copyrightedWork, 2000);
  const infringingUrl = str(body.infringingUrl, 2000);
  const signature = str(body.signature, 200);
  if (
    !complainantName ||
    !complainantEmail ||
    complainantAddress === null ||
    !copyrightedWork ||
    !infringingUrl ||
    !signature ||
    !isEmail(complainantEmail) ||
    !isHttpsUrl(infringingUrl) ||
    body.goodFaith !== true ||
    body.accuracyUnderPenalty !== true ||
    body.goodFaithAttestationText !== TAKEDOWN_GOOD_FAITH_TEXT ||
    body.goodFaithAttestationVersion !== DMCA_ATTESTATION_VERSION ||
    body.accuracyAttestationText !== TAKEDOWN_ACCURACY_TEXT ||
    body.accuracyAttestationVersion !== DMCA_ATTESTATION_VERSION
  ) {
    return null;
  }
  return {
    kind: 'takedown',
    complainantName,
    complainantEmail: complainantEmail.toLowerCase(),
    complainantAddress,
    copyrightedWork,
    infringingUrl,
    goodFaith: true,
    goodFaithAttestationText: TAKEDOWN_GOOD_FAITH_TEXT,
    goodFaithAttestationVersion: DMCA_ATTESTATION_VERSION,
    accuracyUnderPenalty: true,
    accuracyAttestationText: TAKEDOWN_ACCURACY_TEXT,
    accuracyAttestationVersion: DMCA_ATTESTATION_VERSION,
    signature,
  };
}

function parseCounterNotice(body: Record<string, unknown>): ParsedDmcaBody | null {
  const originalNoticeReference = optionalStr(body.originalNoticeReference, 200);
  const counterNotifierName = str(body.counterNotifierName, 200);
  const counterNotifierAddress = str(body.counterNotifierAddress, 1000);
  const counterNotifierPhone = str(body.counterNotifierPhone, 50);
  const counterNotifierEmail = str(body.counterNotifierEmail, 320);
  const removedMaterial = str(body.removedMaterial, 4000);
  const materialLocationBeforeRemoval = str(body.materialLocationBeforeRemoval, 2000);
  const signature = str(body.signature, 200);
  if (
    originalNoticeReference === null ||
    !counterNotifierName ||
    !counterNotifierAddress ||
    !counterNotifierPhone ||
    !counterNotifierEmail ||
    !removedMaterial ||
    !materialLocationBeforeRemoval ||
    !signature ||
    !isEmail(counterNotifierEmail) ||
    !isHttpsUrl(materialLocationBeforeRemoval) ||
    body.goodFaithMistakeOrMisidentification !== true ||
    body.statementUnderPenaltyOfPerjury !== true ||
    body.mistakeAttestationText !== COUNTER_MISTAKE_TEXT ||
    body.mistakeAttestationVersion !== DMCA_ATTESTATION_VERSION ||
    body.consentToFederalJurisdiction !== true ||
    body.jurisdictionAttestationText !== COUNTER_JURISDICTION_TEXT ||
    body.jurisdictionAttestationVersion !== DMCA_ATTESTATION_VERSION ||
    body.acceptanceOfServiceOfProcess !== true ||
    body.serviceAttestationText !== COUNTER_SERVICE_TEXT ||
    body.serviceAttestationVersion !== DMCA_ATTESTATION_VERSION
  ) {
    return null;
  }
  return {
    kind: 'counter',
    originalNoticeReference,
    counterNotifierName,
    counterNotifierAddress,
    counterNotifierPhone,
    counterNotifierEmail: counterNotifierEmail.toLowerCase(),
    removedMaterial,
    materialLocationBeforeRemoval,
    goodFaithMistakeOrMisidentification: true,
    statementUnderPenaltyOfPerjury: true,
    mistakeAttestationText: COUNTER_MISTAKE_TEXT,
    mistakeAttestationVersion: DMCA_ATTESTATION_VERSION,
    consentToFederalJurisdiction: true,
    jurisdictionAttestationText: COUNTER_JURISDICTION_TEXT,
    jurisdictionAttestationVersion: DMCA_ATTESTATION_VERSION,
    acceptanceOfServiceOfProcess: true,
    serviceAttestationText: COUNTER_SERVICE_TEXT,
    serviceAttestationVersion: DMCA_ATTESTATION_VERSION,
    signature,
  };
}

function parseBody(raw: unknown): ParsedDmcaBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const kind = body.kind == null ? 'takedown' : body.kind;
  if (kind === 'takedown') return parseTakedown(body);
  if (kind === 'counter') return parseCounterNotice(body);
  return null;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function dmcaHmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function equalHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function cleanIp(value: string | null): string | null {
  const ip = value?.split(',')[0]?.trim() ?? '';
  if (ip.length === 0 || ip.length > 128 || /[\s\u0000-\u001f]/.test(ip)) return null;
  return ip;
}

// Anonymous submissions accept ONLY the HMAC-signed platform IP set by the
// trusted BFF proxy. Generic forwarding headers are client controlled when
// the function is called directly, so they are never read: absent or invalid
// signed headers fail closed.
async function clientIp(req: Request, salt: string, nowMs: number): Promise<string | null> {
  const forwardedIp = req.headers.get('x-mynews-client-ip');
  const forwardedAt = req.headers.get('x-mynews-proxy-timestamp');
  const forwardedSignature = req.headers.get('x-mynews-proxy-signature');
  const ip = cleanIp(forwardedIp);
  const timestamp = Number(forwardedAt);
  if (
    !ip ||
    !Number.isFinite(timestamp) ||
    Math.abs(nowMs - timestamp) > MAX_PROXY_AGE_MS ||
    typeof forwardedSignature !== 'string'
  ) {
    return null;
  }
  const expected = await dmcaHmacHex(salt, `${timestamp}.${ip}`);
  return equalHex(expected, forwardedSignature.toLowerCase()) ? ip : null;
}

function submitterEmail(body: ParsedDmcaBody): string {
  return body.kind === 'takedown' ? body.complainantEmail : body.counterNotifierEmail;
}

function committedResult(result: DmcaSubmissionResult): result is DmcaSubmissionResult & {
  outcome: 'ok';
  referenceId: string;
  resolutionStatus: 'resolved' | 'needs-resolution';
  queueVisible: true;
} {
  return (
    result.outcome === 'ok' &&
    typeof result.referenceId === 'string' &&
    result.referenceId.length > 0 &&
    (result.resolutionStatus === 'resolved' || result.resolutionStatus === 'needs-resolution') &&
    result.queueVisible === true
  );
}

export async function handleDmcaRequest(req: Request, deps: DmcaDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  let body: ParsedDmcaBody | null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('validation', 400);

  // Only the parsed, whitelisted notice kind reaches the log line.
  annotateRequestLog(req, {
    action: body.kind === 'counter' ? 'submit_counter_notice' : 'submit_notice',
  });

  const salt = deps.rateSalt?.trim() ?? '';
  if (salt.length < 32) return jsonError('temporarily-unavailable', 503);
  const nowMs = (deps.now ?? Date.now)();

  // Rate identity: per-account for authenticated (in-app) submitters, signed
  // platform IP for anonymous (web form) submitters. Both fail closed.
  const userId = parseJwtSub(req);
  const normalizedEmail = submitterEmail(body).trim().toLowerCase();
  const emailHash = await dmcaHmacHex(salt, `email:${normalizedEmail}`);
  let ipHash: string;
  let rateKeys: string[];
  if (userId) {
    const userHash = await dmcaHmacHex(salt, `user:${userId}`);
    ipHash = userHash;
    rateKeys = [
      await dmcaHmacHex(salt, `user-bucket:${userHash}`),
      await dmcaHmacHex(salt, `user-pair-bucket:${userHash}:${emailHash}`),
    ];
  } else {
    const ip = await clientIp(req, salt, nowMs);
    if (!ip) return jsonError('temporarily-unavailable', 503);
    ipHash = await dmcaHmacHex(salt, `ip:${ip}`);
    rateKeys = [
      await dmcaHmacHex(salt, `ip-bucket:${ipHash}`),
      await dmcaHmacHex(salt, `pair-bucket:${ipHash}:${emailHash}`),
      // Email-only bucket: defense in depth against IP rotation. Both buckets
      // above key on ipHash, so a caller who can vary the platform IP resets
      // them. This one keys on the complainant email alone, so unbounded
      // statutory notices under a single email are capped even if the upstream
      // trusted-IP control is ever misconfigured.
      await dmcaHmacHex(salt, `email-bucket:${emailHash}`),
    ];
  }
  try {
    for (const rateKey of rateKeys) {
      const rateOutcome = await deps.store.consumeDmcaRateLimit({
        rateKey,
        ipHash,
        emailHash,
        nowMs,
      });
      if (rateOutcome === 'rate-limited') return jsonError('rate-limited', 429);
      if (rateOutcome !== 'allowed') return jsonError('temporarily-unavailable', 503);
    }
  } catch (error) {
    console.error('mynews dmca durable throttle failed', error);
    return jsonError('temporarily-unavailable', 503);
  }

  let submitterProfileId: string | null = null;
  if (userId) {
    try {
      submitterProfileId = await deps.store.getProfileIdByUserId(userId);
    } catch (error) {
      console.error('mynews dmca submitter lookup failed', error);
      return jsonError('temporarily-unavailable', 503);
    }
  }

  let result: DmcaSubmissionResult;
  try {
    if (body.kind === 'takedown') {
      const { kind: _kind, ...record } = body;
      result = await deps.store.submitDmcaTakedown({ ...record, submitterProfileId });
    } else {
      const { kind: _kind, ...record } = body;
      result = await deps.store.submitDmcaCounterNotice({ ...record, submitterProfileId });
    }
  } catch (error) {
    console.error('mynews dmca transactional intake failed', error);
    return jsonError('temporarily-unavailable', 503);
  }

  if (result.outcome === 'bad-payload') return jsonError('validation', 400);
  if (!committedResult(result)) return jsonError('temporarily-unavailable', 503);
  return jsonOk({
    status: 'queued',
    referenceId: result.referenceId,
    resolutionStatus: result.resolutionStatus,
    targetKind: result.targetKind ?? null,
    targetId: result.targetId ?? null,
    ...(body.kind === 'counter'
      ? { originalNoticeMatched: result.originalNoticeMatched ?? false }
      : {}),
  });
}

declare const Deno:
  | { serve: (handler: (req: Request) => Promise<Response>) => void; env: { get(key: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope(
      (req) => handleDmcaRequest(req, { store, rateSalt: env('MYNEWS_DMCA_RATE_SALT') }),
      { fn: 'mynews-dmca', action: 'submit_notice' },
    ),
  );
}
