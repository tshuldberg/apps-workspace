// Public post submit client (Plan 39 P10/P11, screens S5/S6). WEB twin of
// apps/meerkat/app/(root)/data/public-post-client.ts. The consumer-side of the
// three-gate public write path: it drives the REAL submit chain a verified,
// purchased user crosses to post to The Commons, and it fabricates NOTHING. A
// "posted" state is returned ONLY off a real dual-signed acceptance receipt
// (NC-3); every rejection carries the honest machine bucket.
//
// The chain (mirrors packages/meerkat-relay plan39-public-write-e2e.test.ts):
//   session bearer (x-mk-session) + persona-bound app-unlock proof (x-mk-app-unlock,
//   minted from the REAL $4.99 meerkat_app_unlock purchase, NC-P5) + fresh single-use
//   humanity token (x-mk-humanity) + a persona-signed post (createPublicPost). The
//   device key never signs a public event (NC-P2). Gate order on the node is
//   session -> humanity(spend) -> app-unlock -> policy/caps, so a humanity token is
//   pushed back ONLY when the request was rejected before the humanity redeem.

import type { DatabaseAdapter } from '@mylife/db';
import {
  bytesToHex,
  createPublicPost,
  extractPersonaPrivateKeyHex,
  signMessage,
  verifyPublicPost,
  type AcceptedPublicPost,
} from '@mylife/sync';
import { appUnlockBindingMessage } from '@mylife/entitlements';
import { getSetting, setSetting } from './meerkat-data';
import {
  ensurePersonaSession,
  getStoredPersona,
  type PersonaServiceConfig,
} from './persona-core';
import { popStoredHumanityToken, unshiftStoredHumanityToken } from './humanity-core';
import { commonsFeedConfig, type CommonsFeedConfig } from './public-feed';
import { getCachedAppUnlock, HOSTED_API_URL } from './hosted-access';
import { hasAcceptedPublicTerms } from './public-safety';

const encoder = new TextEncoder();

/** Device-local cache slot for the current minted app-unlock proof. */
const APP_UNLOCK_PROOF_SETTING_KEY = 'app_unlock_proof';

/** True when a real store/Stripe purchase has unlocked this account locally. */
export function isAppUnlocked(): boolean {
  return getCachedAppUnlock()?.unlocked === true;
}

/** The hosted API base that mints the persona-bound app-unlock proof. Empty => none. */
export function hostedApiBase(): string {
  return HOSTED_API_URL.trim().replace(/\/+$/u, '');
}

// --- app-unlock proof mint + cache ------------------------------------------

interface StoredProof { token: string; expiresAtMs: number; personaPubkey: string }

function getCachedProof(db: DatabaseAdapter): StoredProof | null {
  const raw = getSetting(db, APP_UNLOCK_PROOF_SETTING_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<StoredProof>;
    if (typeof p.token === 'string' && typeof p.expiresAtMs === 'number' && typeof p.personaPubkey === 'string') {
      return { token: p.token, expiresAtMs: p.expiresAtMs, personaPubkey: p.personaPubkey };
    }
  } catch {
    // fall through
  }
  return null;
}

function setCachedProof(db: DatabaseAdapter, proof: StoredProof): void {
  setSetting(db, APP_UNLOCK_PROOF_SETTING_KEY, JSON.stringify(proof));
}

export function clearCachedAppUnlockProof(db: DatabaseAdapter): void {
  setSetting(db, APP_UNLOCK_PROOF_SETTING_KEY, '');
}

export type MintProofResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not_configured' | 'no_active_purchase' | 'binding_conflict' | 'key_unavailable' | 'unreachable' | 'failed' };

/** Mint (or reuse a fresh) persona-bound app-unlock proof from the hosted API. */
export async function mintAppUnlockProof(
  db: DatabaseAdapter,
  personaPubkey: string,
  privateKeyRef: string,
  options: { hostedApiUrl?: string; linkCode?: string; nowMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<MintProofResult> {
  const base = (options.hostedApiUrl ?? hostedApiBase()).trim().replace(/\/+$/u, '');
  if (!base) return { ok: false, reason: 'not_configured' };
  const nowMs = options.nowMs ?? Date.now();
  const cached = getCachedProof(db);
  if (cached && cached.personaPubkey === personaPubkey && cached.expiresAtMs > nowMs + 60_000) {
    return { ok: true, token: cached.token };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const ts = new Date(nowMs).toISOString();
  let personaSig: string;
  try {
    const privateKeyHex = extractPersonaPrivateKeyHex(privateKeyRef, personaPubkey);
    personaSig = bytesToHex(signMessage(privateKeyHex, encoder.encode(appUnlockBindingMessage(personaPubkey, ts))));
  } catch {
    return { ok: false, reason: 'key_unavailable' };
  }
  const body: Record<string, unknown> = { personaPubkey, ts, personaSig };
  if (options.linkCode && options.linkCode.trim().length > 0) body.link = options.linkCode.trim();
  let res: Response;
  try {
    res = await fetchImpl(`${base}/api/entitlements/meerkat-app-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (res.status === 402) return { ok: false, reason: 'no_active_purchase' };
  if (res.status === 409) return { ok: false, reason: 'binding_conflict' };
  if (res.status === 501 || res.status === 404) return { ok: false, reason: 'not_configured' };
  let json: { token?: unknown; expiresAt?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!res.ok || typeof json.token !== 'string' || json.token.length === 0) {
    return { ok: false, reason: 'failed' };
  }
  const expiresAtMs = typeof json.expiresAt === 'string' ? Date.parse(json.expiresAt) : NaN;
  setCachedProof(db, { token: json.token, expiresAtMs: Number.isNaN(expiresAtMs) ? nowMs + 60_000 : expiresAtMs, personaPubkey });
  return { ok: true, token: json.token };
}

// --- the submit chain -------------------------------------------------------

/** The honest bucket a composer surfaces for a rejected submit (never fabricated). */
export type SubmitFailReason =
  | 'not_configured'
  | 'not_wired'
  | 'needs_verification'
  | 'needs_unlock'
  | 'needs_terms'
  | 'unlock_unavailable'
  | 'session'
  | 'humanity'
  | 'unlock'
  | 'policy'
  | 'caps'
  | 'rejected'
  | 'unreachable';

export type SubmitPublicPostOutcome =
  | { ok: true; accepted: AcceptedPublicPost; deduplicated: boolean }
  | { ok: false; reason: SubmitFailReason; detail?: string };

/** Map a node submit-route `reason` string to the honest client bucket. */
export function classifySubmitReason(reason: string | undefined): SubmitFailReason {
  const r = reason ?? '';
  if (r.startsWith('session')) return 'session';
  if (r.startsWith('humanity')) return 'humanity';
  if (r.startsWith('app_unlock')) return 'unlock';
  if (r === 'posting_disabled' || r === 'posting_frozen' || r === 'not_member' || r === 'membership_unknown' || r === 'node_key_not_pinned') return 'policy';
  if (r === 'rate_limited' || r === 'publication_full') return 'caps';
  return 'rejected';
}

export interface SubmitPublicPostInput {
  db: DatabaseAdapter;
  personaConfig: PersonaServiceConfig;
  feedConfig?: CommonsFeedConfig;
  channelId: string;
  body: string;
  parentPostId?: string | null;
  linkCode?: string;
  /** Hosted API base that mints the app-unlock proof (defaults to build env). */
  hostedApiUrl?: string;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}

/** Run the full public-write chain and return the REAL outcome (`ok:true` only on a real receipt). */
export async function submitPublicPost(input: SubmitPublicPostInput): Promise<SubmitPublicPostOutcome> {
  const { db, personaConfig, channelId, body, parentPostId } = input;
  const feedConfig = input.feedConfig ?? commonsFeedConfig();
  const fetchImpl = input.fetchImpl ?? fetch;

  if (!feedConfig.nodeUrl.startsWith('http') || feedConfig.topics.length === 0) {
    return { ok: false, reason: 'not_configured' };
  }
  const source = feedConfig.topics.find((t) => t.channelId === channelId);
  if (!source) return { ok: false, reason: 'not_wired' };

  const persona = getStoredPersona(db);
  if (!persona) return { ok: false, reason: 'needs_verification' };
  if (!isAppUnlocked()) return { ok: false, reason: 'needs_unlock' };
  if (!hasAcceptedPublicTerms(db)) return { ok: false, reason: 'needs_terms' };

  let post;
  try {
    post = createPublicPost(
      { publicKeyHex: persona.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey) },
      { publicationId: source.publicationId, channelId, body, parentPostId: parentPostId ?? null, now: input.nowMs ? new Date(input.nowMs).toISOString() : undefined },
    );
  } catch {
    return { ok: false, reason: 'rejected', detail: 'post_too_large' };
  }

  const session = await ensurePersonaSession(db, personaConfig, fetchImpl);
  if (!session.ok) {
    if (session.reason === 'not_configured') return { ok: false, reason: 'not_configured' };
    if (session.reason === 'no_persona' || session.reason === 'needs_verification') return { ok: false, reason: 'needs_verification' };
    if (session.reason === 'unreachable') return { ok: false, reason: 'unreachable' };
    return { ok: false, reason: 'session', detail: session.reason };
  }

  const proof = await mintAppUnlockProof(db, persona.personaPubkey, persona.privateKeyRef, {
    hostedApiUrl: input.hostedApiUrl,
    linkCode: input.linkCode,
    nowMs: input.nowMs,
    fetchImpl,
  });
  if (!proof.ok) {
    if (proof.reason === 'key_unavailable') return { ok: false, reason: 'rejected', detail: 'key_unavailable' };
    return { ok: false, reason: 'unlock_unavailable', detail: proof.reason };
  }

  const humanityToken = popStoredHumanityToken(db, undefined, input.nowMs);
  if (!humanityToken) return { ok: false, reason: 'needs_verification', detail: 'no_humanity_token' };

  const url = `${feedConfig.nodeUrl.replace(/\/+$/u, '')}/public/${encodeURIComponent(source.publicationId)}/${encodeURIComponent(channelId)}/submit`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mk-session': session.token,
        'x-mk-humanity': humanityToken,
        'x-mk-app-unlock': proof.token,
      },
      body: JSON.stringify({ post }),
    });
  } catch {
    unshiftStoredHumanityToken(db, humanityToken); // never reached the node; token unspent
    return { ok: false, reason: 'unreachable' };
  }

  let json: {
    ok?: boolean;
    accepted?: AcceptedPublicPost;
    deduplicated?: boolean;
    reason?: string;
    humanityTokenConsumed?: unknown;
  };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    json = {};
  }

  if (res.status === 200 && json.ok && json.accepted) {
    // NC-3: "posted" is claimed ONLY off a real, dual-signed receipt. Re-verify the
    // returned acceptance against the descriptor-pinned node key + scope, so a
    // malicious node cannot fabricate an acceptance the client would show as posted.
    const verdict = verifyPublicPost(json.accepted, source.nodeKeyHex, { publicationId: source.publicationId, channelId });
    if (verdict !== 'ok') {
      return { ok: false, reason: 'rejected', detail: `unverified_receipt:${verdict}` };
    }
    return { ok: true, accepted: json.accepted, deduplicated: Boolean(json.deduplicated) };
  }

  const bucket = classifySubmitReason(json.reason);
  // Rejected at/before the session gate => the humanity token was never redeemed;
  // push it back. The shared per-IP limiter also runs before humanity redemption
  // and marks that explicitly. Field-absent rate limits stay conservative because
  // the durable per-persona cap runs after token redemption.
  const preHumanityRateLimit = res.status === 429
    && json.reason === 'rate_limited'
    && json.humanityTokenConsumed === false;
  if (bucket === 'session' || preHumanityRateLimit) unshiftStoredHumanityToken(db, humanityToken);
  if (bucket === 'unlock') clearCachedAppUnlockProof(db);
  return { ok: false, reason: bucket, detail: json.reason };
}
