/**
 * HTTP binding for the always-on COMMUNITY NODE (community feed P2, design 6).
 *
 * A thin node:http shell over CommunityNode, mirroring seeder-http.ts. All
 * policy + verification lives in the core; this file only routes, reads the
 * per-member auth headers, and (de)serializes JSON. Logs are counts/paths only,
 * never bytes or plaintext (the node has none).
 *
 * Routes:
 *   GET  /healthz                              -> {ok:true}
 *   GET  /community/{id}/challenge             -> FeedChallenge JSON (open) | 429
 *   GET  /community/{id}/manifest             -> AUTH -> getManifest JSON | 401/429
 *   POST /community/{id}/publish             -> AUTH(owner) -> publish | 200/401/400/429
 *   POST /community/{id}/append              -> AUTH -> append | 200/401/400/429
 *   GET  /community/{id}/{infoHash}/{index}  -> AUTH(per-community) ->
 *          servePieceForCommunity (octet-stream) | 401/404
 * Anything else -> 404; wrong method on a known path -> 405.
 *
 * P6 item 1: the piece route now carries the community id and is gated by the
 * per-community verifyRequest + servePieceForCommunity, so a member of one
 * community can no longer fetch another's opaque pieces. The old unscoped
 * GET /{infoHash}/{index} route (and verifyAnyMembership) is gone.
 */

import http from 'node:http';
import { createHash } from 'node:crypto';
import { deriveCommunityJoinToken, type SealedTailEntry } from '@mylife/sync';
import {
  MEERKAT_COMMUNITY_NODE_FEATURE,
  verifyHostedFeatureEntitlement,
  verifyMeerkatAppUnlockToken,
  type VerifyHostedFeatureEntitlementOptions,
} from '@mylife/entitlements/server';
import type {
  CommunityNode,
  CommunityNodePublishBody,
  FeedAuthHeader,
  PublicationPageCursor,
  PublicationRegisterBody,
  PublishSnapshotInput,
} from './community-node';
import {
  verifyPublicPostAuthor,
  type PublicPostEvent,
  type PublicPostTombstone,
  type PublicPostingFreeze,
  type SignedPublicAbuseReport,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  PublicReadLimiter,
  derivePublicClientKey,
  type PublicReadLimits,
} from './public-read-limiter';
import type { SeederHttpServer } from './seeder-http';
import { CommunityJoinQueue, type CommunityJoinQueueStore } from './community-join-queue';
import { DMCA_REGISTERED_AGENT, type DmcaIntakeService } from './dmca-intake';
import { applyHttpCors } from './http-cors';
import { CommunityPrivateStateUnavailableError } from './community-private-state';
import { PostgresStoreUnavailableError } from './postgres/store-context';
import type { HealthEndpoints } from './service-health';
import {
  handleStorageCapabilityHttpRequest,
  isStorageCapabilityPath,
  type StorageDescriptorService,
} from './storage-capability-service';
import { handleArchiveRoute, type ArchiveIntakeOptions } from './archive-intake-http';
import { createRoomTokenHttpHandler, type RoomTokenOptions } from './room-token-http';
import type { CredentialVerifier, CredentialPresentationReason } from './credential-verify';
import type { CredentialEvidenceSink } from './credential-evidence';

export interface CommunityNodeHostedEntitlementOptions extends Omit<VerifyHostedFeatureEntitlementOptions, 'nowMs'> {
  /** Disabled by default so self-host community nodes remain open. */
  required?: boolean;
  /** Required when `required` is true. */
  secret?: string;
  /** Defaults to meerkat:community-node. */
  feature?: string;
  /** Injectable clock for tests. */
  nowMs?: () => number;
}

/**
 * Opt-in anti-bot HUMANITY gate for the public register route (Plan 24 P3). OFF by
 * default so self-host community nodes stay open. When `required`, a NEW public
 * publication (first revision) must carry a valid humanity token in the
 * `x-mk-humanity` header. `verifyToken` is wired by the deploy to a HumanityService
 * (`async (t) => { const r = await svc.redeem(t); return r.ok ? {ok:true} : {ok:false, reason:r.reason}; }`),
 * which verifies the service signature + expiry AND spends the token (double-spend
 * gate, AC-2). Fail-closed: a missing/invalid/spent token is refused.
 */
export interface CommunityNodeHumanityOptions {
  /** Disabled by default so self-host nodes remain open. */
  required?: boolean;
  /** Required when `required` is true. Verifies + spends a wire humanity token. */
  verifyToken?: (token: string) => Promise<{ ok: boolean; reason?: string }>;
  /** Header carrying the wire humanity token. Defaults to x-mk-humanity. */
  header?: string;
  /**
   * When true (default), only a FIRST-revision (genesis) registration is gated -- the
   * anti-bot point is stopping a bot from spinning up NEW publications; an owner's
   * later revisions of an already-vetted publication are not re-gated. Set false to
   * gate EVERY registerPublication.
   */
  firstRevisionOnly?: boolean;
}

/**
 * Verdict of the INJECTED persona-session verifier (Plan 39 Track A owns the
 * implementation in persona-session.ts; the orchestrator wires it here at merge).
 * ok:true MUST carry the session's persona pubkey so the route can bind the
 * session to the post author. Any thrown error is treated as fail-closed.
 */
export type PublicPostSessionVerdict =
  | { ok: true; personaPubkey: string }
  | { ok: false; reason?: string };

export type PublicPostSessionVerifier = (
  sessionToken: string,
) => Promise<PublicPostSessionVerdict> | PublicPostSessionVerdict;

/**
 * Config for the gated public submit route (Plan 39 P6). EVERY field is
 * fail-closed: an unconfigured session verifier, humanity redeem client, or
 * app-unlock secret rejects EVERY submit with a machine-readable code -- the
 * route never waves a write through because a gate is missing (NC-P3).
 *
 * These gates apply ONLY to the public WRITE route. Private mesh routes
 * (challenge/manifest/publish/append/piece) never consult them (NC-P1).
 */
export interface CommunityNodePublicSubmitOptions {
  /**
   * SESSION SEAM: verifies an `x-mk-session` persona session token (Track A's
   * verifySessionToken, injected -- same injection style as `authorize` on the
   * hosted API). Absent => every submit is 500 `session_not_configured`.
   */
  sessionVerifier?: PublicPostSessionVerifier;
  /** Header carrying the persona session token. Defaults to x-mk-session. */
  sessionHeader?: string;
  /**
   * Verifies + SPENDS one single-use humanity token (the atomic redeem on the
   * humanity service). Defaults to `humanity.verifyToken` when that gate is
   * configured. Absent on both => every submit is 500 `humanity_not_configured`.
   */
  humanityVerifyToken?: (token: string) => Promise<{ ok: boolean; reason?: string }>;
  /** Header carrying the humanity token. Defaults to humanity.header ?? x-mk-humanity. */
  humanityHeader?: string;
  /**
   * Shared HMAC secret verifying `x-mk-app-unlock` proofs of the EXISTING
   * meerkat_app_unlock $4.99 one-time purchase (minted by the hosted API from a
   * real purchase row; NC-P5: no new SKU or price). Absent => every submit is
   * 500 `app_unlock_not_configured`.
   */
  appUnlockSecret?: string;
  /** Header carrying the app-unlock proof. Defaults to x-mk-app-unlock. */
  appUnlockHeader?: string;
  /**
   * Plan 51 P2 anonymous-credential verifier. OPTIONAL and fail-closed. When
   * present, a valid credential presentation in the `x-mk-credential` header is
   * accepted as an ALTERNATIVE humanity proof: the single-use humanity redeem is
   * SKIPPED for that submit (either proof passes). Absent => byte-identical legacy
   * behavior (the humanity redeem is unconditionally required). A credential is
   * never silently accepted: with no verifier configured the header is ignored.
   */
  credentialVerifier?: CredentialVerifier;
  /** Header carrying the credential presentation. Defaults to x-mk-credential. */
  credentialHeader?: string;
  /**
   * Records an accepted credential's serial as moderation evidence (Plan 51 P4)
   * so an operator can later revoke it. The serial co-locates with the submitting
   * persona (moderation side of the wall) and NEVER an account identifier.
   */
  credentialEvidence?: CredentialEvidenceSink;
}

/**
 * VERIFY-TO-VIEW on the OPEN public READ routes (Plan 39 P9). By default the read routes
 * (manifest/page/piece) are fully open. A FIRST-PARTY node opts specific publications into a
 * verified-session gate: a reader must present a valid `x-mk-session` persona session token to
 * read a GATED publication.
 *
 * HONESTY BOUNDARY (NC-P4, binding): only publications this node FLAGS as gated are enforced.
 * A publication that is not flagged stays open, and a self-hosted third-party node that does
 * not configure this gate serves openly. The app never claims a gate a node does not enforce;
 * it labels self-hosted content honestly. The private mesh + reads on non-gated pubs are
 * untouched (NC-P1).
 */
export interface CommunityNodePublicReadOptions {
  /**
   * Verifies an `x-mk-session` persona session token (Track A's verifier, injected the same
   * way as the submit route's `sessionVerifier`). Required when any publication is gated;
   * absent while a publication is gated => that read is 500 `read_session_not_configured`.
   */
  sessionVerifier?: PublicPostSessionVerifier;
  /** Header carrying the persona session token. Defaults to x-mk-session. */
  sessionHeader?: string;
  /**
   * Returns true for a publication whose READS require a verified session. A publication that
   * returns false (the default for everything) is served OPEN. This is the ONLY switch that
   * turns verify-to-view on, so a node that leaves it unset serves every read openly.
   */
  isGated?: (publicationId: string) => boolean;
}

export interface StartCommunityNodeHttpOptions {
  node: CommunityNode;
  port?: number;
  host?: string;
  /** Counts/paths only; never bytes. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
  /** Opt-in hosted entitlement gate for first-party community-node deployments. */
  hostedEntitlement?: CommunityNodeHostedEntitlementOptions;
  /**
   * Durable join queue config (Plan 57 W4). The routes are ALWAYS mounted; with
   * no store configured the queue is in-memory (parked handshakes survive an
   * owner's sleep but not a node restart -- the DATA_DIR bin wires the file
   * store for restart safety). A real accepted park emits the community's
   * content-free notify ping through the node's existing seam.
   */
  joinQueue?: { store?: CommunityJoinQueueStore; ttlMs?: number };
  /** Opt-in anti-bot humanity-token gate for the public register route (Plan 24 P3). */
  humanity?: CommunityNodeHumanityOptions;
  /**
   * Gated public post submit route (Plan 39 P6). The route is ALWAYS mounted and
   * ALWAYS fail-closed: with no config at all, every submit is rejected with a
   * machine-readable not-configured code. Reads stay unaffected.
   */
  publicSubmit?: CommunityNodePublicSubmitOptions;
  /**
   * DMCA intake (Plan 39 P13). When present, the node mounts a PUBLIC, rate-limited,
   * zod-validated `POST /public/dmca/notice` that persists takedown notices, and a
   * `GET /public/dmca/agent` that returns the (founder-filled) registered-agent block. Absent =>
   * both routes answer 404 (the feature is honestly off). The operator console drives the lane.
   */
  dmcaIntake?: DmcaIntakeService;
  /**
   * The validated DMCA registered-agent block served by `GET /public/dmca/agent` (Plan 43 WP-43C).
   * When provided, it replaces the legacy placeholder constant with the founder/counsel-supplied
   * (or honestly-unconfigured self-host) block. Absent => the legacy placeholder is served for
   * backward compatibility.
   */
  dmcaAgent?: Record<string, unknown>;
  /**
   * Verify-to-view gate for the OPEN public READ routes (Plan 39 P9). Default: every read is
   * open. A first-party node opts specific publications into requiring a verified session.
   */
  publicRead?: CommunityNodePublicReadOptions;
  /**
   * Per-IP/byte limiter overrides for the OPEN public read routes (Plan 19 P3a,
   * §5.4 DoS surface). Defaults to DEFAULT_PUBLIC_READ_LIMITS. The WS relay caps do
   * NOT cover these HTTP reads; this is a separate in-process token bucket.
   */
  publicReadLimits?: Partial<PublicReadLimits>;
  /**
   * Exact number of reverse-proxy hops controlled by this deployment. Default 0:
   * caller-supplied forwarding headers are ignored and the direct socket address
   * keys the limiter. Deployments behind a controlled proxy MUST set this or all
   * clients share the proxy's bucket.
   */
  trustedProxyHops?: number;
  /** Injectable clock (ms) for the public read limiter (tests). */
  now?: () => number;
  /**
   * Per-route request-body byte caps (audit S2). Every POST route buffers its body
   * BEFORE the auth/verify step, so an uncapped read lets an unauthenticated client
   * stream an unbounded body. Each cap stops the read past the limit and returns 413.
   * Defaults to DEFAULT_COMMUNITY_NODE_BODY_LIMITS.
   */
  bodyLimits?: Partial<CommunityNodeBodyLimits>;
  /** Exact browser origins allowed to call this node cross-origin. */
  corsAllowedOrigins?: readonly string[];
  /** Optional storage:v1 discovery and operator challenge surface. */
  storageDescriptor?: StorageDescriptorService;
  /**
   * Plan 44 WP-4A liveness/readiness. When present, GET /livez and GET /readyz are
   * answered on this listener ahead of CORS + the route table, with honest
   * dependency probes for the node's configured mode.
   */
  healthEndpoints?: HealthEndpoints;
  /**
   * Managed archive job intake (Plan 43 WP-43E). When present, mounts the
   * /api/archive/* routes (create/upload/complete/status/cancel/hosts) on this
   * listener via archive-intake-http.ts. Absent => those routes 404 (the feature is
   * honestly off). Never wired into the slim relay image (server.ts).
   */
  archiveIntake?: ArchiveIntakeOptions;
  /**
   * Community voice/video room admission (Plan 25 WP-25E). When present, mounts
   * /api/rooms/token and the operator-authenticated revoke route. Missing LiveKit
   * credentials fail closed with 503. Absent means the routes fall through to 404.
   */
  roomToken?: RoomTokenOptions;
}

/** Per-route request-body byte caps for the community node's POST routes (audit S2). */
export interface CommunityNodeBodyLimits {
  /** Owner-signed publish snapshot (descriptor + base64 pieces). */
  publish: number;
  /** Owner-signed public register (descriptor + base64 pieces). */
  register: number;
  /** A single sealed tail entry. */
  append: number;
  /** One persona-signed public post (Plan 39 P6; protocol caps bound a real one well under this). */
  submit: number;
  /** One signed post tombstone or posting freeze record. */
  moderation: number;
}

/**
 * Generous-but-finite defaults (audit S2). Register/publish carry base64 snapshot
 * pieces (a real community/publication snapshot can be several MB; base64 inflates
 * ~33%), so 32 MB clears every real payload while converting the old Infinity read
 * into a bounded allocation. A single append is one sealed tail entry (well under
 * 512 KB). Self-host operators can lower these via `bodyLimits`.
 */
export const DEFAULT_COMMUNITY_NODE_BODY_LIMITS: CommunityNodeBodyLimits = {
  publish: 32 * 1024 * 1024,
  register: 32 * 1024 * 1024,
  append: 512 * 1024,
  submit: 64 * 1024,
  moderation: 16 * 1024,
};

const CHALLENGE_PATH = /^\/community\/([^/]+)\/challenge$/;
// Durable join queue (Plan 57 W4). Park is quasi-open (a joiner cannot feed-auth;
// the HKDF token + sealed envelope are the capability, exactly as on the relay
// mailbox) but per-IP rate-limited, size-capped, and entitlement-gated like every
// community route. Box list + ack are token-addressed (see community-join-queue.ts).
const JOIN_PARK_PATH = /^\/community\/([^/]+)\/join\/park$/;
const JOIN_BOX_PATH = /^\/community\/([^/]+)\/join\/box\/([0-9a-f]{64})$/;
const JOIN_ACK_PATH = /^\/community\/([^/]+)\/join\/ack$/;
const MAX_JOIN_BODY_BYTES = 96 * 1024;
const MANIFEST_PATH = /^\/community\/([^/]+)\/manifest$/;
const PUBLISH_PATH = /^\/community\/([^/]+)\/publish$/;
const APPEND_PATH = /^\/community\/([^/]+)\/append$/;
const PIECE_PATH = /^\/community\/([^/]+)\/([0-9a-f]+)\/(\d+)$/;

// OPEN public routes (Plan 19 P3a). Register is owner-signed; the three reads are open.
const PUBLIC_REGISTER_PATH = /^\/public\/([^/]+)\/register$/;
const PUBLIC_MANIFEST_PATH = /^\/public\/([^/]+)\/manifest$/;
const PUBLIC_PAGE_PATH = /^\/public\/([^/]+)\/([^/]+)\/page$/;
const PUBLIC_PIECE_PATH = /^\/public\/([^/]+)\/([0-9a-f]+)\/(\d+)$/;
// Moderation routes (Plan 19 P8a). Report intake is OPEN (rate-limited); the owner
// report fetch is gated by an owner Ed25519 signature (x-mk-owner-sig over the
// canonical (publicationId, ts)).
const PUBLIC_REPORT_PATH = /^\/public\/([^/]+)\/report$/;
const PUBLIC_REPORTS_PATH = /^\/public\/([^/]+)\/reports$/;
// DMCA intake (Plan 39 P13). Notice submit is OPEN (rate-limited + zod-validated); the agent
// info route returns the founder-filled registered-agent block.
const DMCA_NOTICE_PATH = '/public/dmca/notice';
const DMCA_AGENT_PATH = '/public/dmca/agent';
const MAX_DMCA_BODY_BYTES = 16 * 1024;
// Gated public post submit + signed post moderation (Plan 39 P6, Plan 26 absorbed).
const PUBLIC_SUBMIT_PATH = /^\/public\/([^/]+)\/([^/]+)\/submit$/;
const PUBLIC_POST_TOMBSTONE_PATH = /^\/public\/([^/]+)\/post-tombstone$/;
const PUBLIC_POSTING_FREEZE_PATH = /^\/public\/([^/]+)\/posting-freeze$/;

function readAuthHeaders(req: http.IncomingMessage): FeedAuthHeader | null {
  const device = headerValue(req, 'x-mk-device');
  const nonce = headerValue(req, 'x-mk-nonce');
  const ts = headerValue(req, 'x-mk-ts');
  const sig = headerValue(req, 'x-mk-sig');
  if (!device || !nonce || !ts || !sig) return null;
  return { deviceId: device, nonce, ts, signature: sig };
}

function headerValue(req: http.IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

function readBearerToken(req: http.IncomingMessage): string | null {
  const authorization = headerValue(req, 'authorization');
  if (!authorization) return null;
  const [scheme, ...rest] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

/** decodeURIComponent that returns null on a malformed percent sequence. */
function safeDecode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Community ids are 32-hex digests (deriveCommunityId); the file-backed private
 * state store names each community's file by the hex of its id, so an unbounded
 * id would exceed the filesystem name limit and throw inside the store (taking
 * the state authority down). Bound it here, at the edge, before any store call.
 */
const MAX_COMMUNITY_ID_CHARS = 96;

function safeCommunityId(raw: string): string | null {
  const decoded = safeDecode(raw);
  if (decoded === null || decoded.length === 0 || decoded.length > MAX_COMMUNITY_ID_CHARS) return null;
  return decoded;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/**
 * The persona binding hash carried inside app-unlock proofs: sha256 hex of the
 * LOWERCASED persona pubkey hex. Computed client-side at mint (the billing tier
 * never receives the raw persona key) and re-derived here from the SESSION
 * persona, so a proof only unlocks posting for the persona it was minted for.
 */
export function personaBindingHash(personaPubkeyHex: string): string {
  return createHash('sha256').update(personaPubkeyHex.toLowerCase(), 'utf8').digest('hex');
}

/**
 * Map a credential presentation refusal to an honest HTTP status (Plan 51 P2).
 * `not_configured` is a 500 (a wired verifier that cannot load its epoch key is a
 * server fault, mirroring the humanity/session not-configured shape); everything
 * else is a client-side 401 (missing/invalid/expired/revoked presentation).
 */
function credentialStatus(reason: CredentialPresentationReason): number {
  return reason === 'not_configured' ? 500 : 401;
}

/** Sentinel returned by readBody when the incoming body exceeds the per-route cap. */
const BODY_TOO_LARGE = Symbol('body_too_large');

/**
 * Read + JSON-parse the request body. `maxBytes` caps how much is buffered: once the
 * accumulated size exceeds it, the read STOPS (returning from the for-await closes the
 * stream) and BODY_TOO_LARGE is returned, so an untrusted client cannot stream an
 * unbounded body before verification. Default is unbounded (Infinity) so the large register /
 * publish snapshot bodies are NOT regressed; the open report route passes a small cap.
 */
async function readBody(req: http.IncomingMessage, maxBytes = Number.POSITIVE_INFINITY): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) return BODY_TOO_LARGE; // stop reading; closes the stream
    chunks.push(buf);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined; // malformed JSON (distinct from an empty body)
  }
}

/** Max bytes buffered for the OPEN report POST (a legit signed report is ~a few hundred B). */
const MAX_REPORT_BODY_BYTES = 16 * 1024;

/** Decode a publish body: pieces arrive as base64 strings (opaque ciphertext). */
function decodePublishBody(raw: unknown): CommunityNodePublishBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as { descriptor?: unknown; snapshots?: unknown };
  if (!body.descriptor || !Array.isArray(body.snapshots)) return null;
  const snapshots: PublishSnapshotInput[] = [];
  for (const entry of body.snapshots) {
    if (typeof entry !== 'object' || entry === null) return null;
    const snap = entry as { channelId?: unknown; epoch?: unknown; manifest?: unknown; pieces?: unknown };
    if (
      typeof snap.channelId !== 'string'
      || typeof snap.epoch !== 'number'
      || typeof snap.manifest !== 'object'
      || snap.manifest === null
      || !Array.isArray(snap.pieces)
    ) {
      return null;
    }
    const pieces: Uint8Array[] = [];
    for (const piece of snap.pieces) {
      if (typeof piece !== 'string') return null;
      pieces.push(new Uint8Array(Buffer.from(piece, 'base64')));
    }
    snapshots.push({
      channelId: snap.channelId,
      epoch: snap.epoch,
      manifest: snap.manifest as PublishSnapshotInput['manifest'],
      pieces,
    });
  }
  return { descriptor: body.descriptor as CommunityNodePublishBody['descriptor'], snapshots };
}

/** A minimal SignedPublicationDescriptor shape guard (verifyPublication re-checks fully). */
function isSignedPublicationDescriptorShape(value: unknown): value is SignedPublicationDescriptor {
  if (typeof value !== 'object' || value === null) return false;
  const signed = value as { descriptor?: unknown; signature?: unknown };
  if (typeof signed.signature !== 'string') return false;
  const d = signed.descriptor;
  return typeof d === 'object' && d !== null && typeof (d as { publicationId?: unknown }).publicationId === 'string';
}

/** Decode an owner-signed publication register body (same wire shape as publish). */
function decodeRegisterBody(raw: unknown): PublicationRegisterBody | null {
  const decoded = decodePublishBody(raw);
  if (!decoded) return null;
  if (!isSignedPublicationDescriptorShape(decoded.descriptor)) return null;
  return { descriptor: decoded.descriptor, snapshots: decoded.snapshots };
}

/** A minimal SignedPublicAbuseReport shape guard (verifyPublicAbuseReport re-checks fully). */
function decodePublicReportBody(raw: unknown): SignedPublicAbuseReport | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as { report?: unknown; signature?: unknown };
  if (typeof body.signature !== 'string') return null;
  if (typeof body.report !== 'object' || body.report === null) return null;
  return raw as SignedPublicAbuseReport;
}

/** A minimal `{ post }` shape guard (verifyPublicPostAuthor re-checks fully in the core). */
function decodePublicPostBody(raw: unknown): PublicPostEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const post = (raw as { post?: unknown }).post;
  if (typeof post !== 'object' || post === null) return null;
  const p = post as PublicPostEvent;
  if (typeof p.postId !== 'string' || typeof p.signature !== 'string') return null;
  return p;
}

/** A minimal `{ tombstone }` shape guard (verifyPublicPostTombstone re-checks fully). */
function decodePostTombstoneBody(raw: unknown): PublicPostTombstone | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const t = (raw as { tombstone?: unknown }).tombstone;
  if (typeof t !== 'object' || t === null) return null;
  const tomb = t as PublicPostTombstone;
  if (typeof tomb.postId !== 'string' || typeof tomb.signature !== 'string') return null;
  return tomb;
}

/** A minimal `{ freeze }` shape guard (verifyPublicPostingFreeze re-checks fully). */
function decodePostingFreezeBody(raw: unknown): PublicPostingFreeze | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = (raw as { freeze?: unknown }).freeze;
  if (typeof f !== 'object' || f === null) return null;
  const freeze = f as PublicPostingFreeze;
  if (typeof freeze.frozen !== 'boolean' || typeof freeze.signature !== 'string') return null;
  return freeze;
}

/** Parse a `?after={wall}.{counter}` cursor. null = genesis; 'invalid' = malformed. */
function parsePageCursor(raw: string | null): PublicationPageCursor | null | 'invalid' {
  if (raw === null || raw === '') return null;
  const idx = raw.lastIndexOf('.');
  if (idx <= 0 || idx === raw.length - 1) return 'invalid';
  const counter = Number(raw.slice(idx + 1));
  if (!Number.isInteger(counter) || counter < 0) return 'invalid';
  return { wall: raw.slice(0, idx), counter };
}

/** Parse `?limit=n`; absent/non-finite -> default 50. Clamping to [1,200] is the node's. */
function parsePageLimit(raw: string | null): number {
  if (raw === null || raw === '') return 50;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 50;
}

/** Start the community node's HTTP server. Resolves once listening. */
export function startCommunityNodeHttp(options: StartCommunityNodeHttpOptions): Promise<SeederHttpServer> {
  const host = options.host ?? '0.0.0.0';
  const log = options.log ?? (() => {});
  const { node } = options;
  const roomTokenHandler = options.roomToken
    ? createRoomTokenHttpHandler(options.roomToken)
    : null;
  const bodyLimits: CommunityNodeBodyLimits = { ...DEFAULT_COMMUNITY_NODE_BODY_LIMITS, ...(options.bodyLimits ?? {}) };
  // Periodic sweep of UNCLAIMED community states (audit S3): reclaims states whose
  // challenge nonces have expired so untrusted ids cannot grow the node's
  // `communities` map without bound between requests.
  const communitySweep = setInterval(() => {
    void Promise.resolve(node.sweepUnclaimed()).catch(() => {
      log('private_state_sweep_failed', { reason: 'state_authority_unavailable' });
    });
  }, 60_000);
  communitySweep.unref?.();
  // Real per-IP/byte limiter for the OPEN public reads (Plan 19 P3a, §5.4). Keyed
  // EXACTLY like the relay (direct socket address unless trustedProxyHops is set)
  // so a spoofed forwarding header cannot rotate the key. Separate from the WS caps.
  const publicLimiter = new PublicReadLimiter(options.publicReadLimits, options.now);
  const trustedProxyHops = Number.isFinite(options.trustedProxyHops)
    ? Math.max(0, Math.floor(options.trustedProxyHops ?? 0))
    : 0;
  // Periodic sweep of stale limiter entries (mirrors the WS hub sweep at
  // server.ts:310): bounds memory without letting a reconnect reset an active limit.
  const limiterSweep = setInterval(() => publicLimiter.sweep(), publicLimiter.limits.windowMs);
  limiterSweep.unref?.();

  // Durable join queue (Plan 57 W4): always mounted. An accepted park emits the
  // community's content-free notify ping through the node's existing seam.
  const joinQueue = new CommunityJoinQueue({
    store: options.joinQueue?.store,
    ttlMs: options.joinQueue?.ttlMs,
    onParked: (communityId) => node.notifyCommunityChange(communityId),
  });

  /** Admit one open request from the client IP, or send 429 with optional route metadata. */
  function admitPublicRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    publicationId: string,
    rejectionMetadata: Readonly<Record<string, unknown>> = {},
  ): boolean {
    if (publicLimiter.admitRequest(derivePublicClientKey(req, trustedProxyHops))) return true;
    log('public_rate_limited', { publicationId, stage: 'request' });
    sendJson(res, 429, { ...rejectionMetadata, reason: 'rate_limited' });
    return false;
  }

  /**
   * Verify-to-view gate (Plan 39 P9): a GATED publication's reads require a valid persona
   * session. Fail-closed: a gated publication with no verifier configured is 500; a missing
   * session is 401; a verifier rejection is 401; a verifier throw is 503. A non-gated
   * publication (the default) always passes, so self-hosted/open publications are unaffected
   * (NC-P4). Never logs the token.
   */
  async function requireReadSession(req: http.IncomingMessage, res: http.ServerResponse, publicationId: string): Promise<boolean> {
    const read = options.publicRead;
    if (!read?.isGated?.(publicationId)) return true; // not gated -> open read (NC-P4)
    if (!read.sessionVerifier) {
      log('public_read_reject', { publicationId, reason: 'read_session_not_configured' });
      sendJson(res, 500, { reason: 'read_session_not_configured' });
      return false;
    }
    const token = headerValue(req, read.sessionHeader ?? 'x-mk-session');
    if (!token) {
      log('public_read_reject', { publicationId, reason: 'read_session_required' });
      sendJson(res, 401, { reason: 'read_session_required' });
      return false;
    }
    let verdict: PublicPostSessionVerdict;
    try {
      verdict = await read.sessionVerifier(token);
    } catch {
      log('public_read_reject', { publicationId, reason: 'read_session_unreachable' });
      sendJson(res, 503, { reason: 'read_session_unreachable' });
      return false;
    }
    if (!verdict.ok || typeof verdict.personaPubkey !== 'string' || verdict.personaPubkey.length === 0) {
      log('public_read_reject', { publicationId, reason: 'read_session_invalid' });
      sendJson(res, 401, { reason: 'read_session_invalid' });
      return false;
    }
    return true;
  }

  /** Admit the response bytes against the per-IP + per-publication ceilings, or 429. */
  function admitPublicBytes(req: http.IncomingMessage, res: http.ServerResponse, publicationId: string, bytes: number): boolean {
    if (publicLimiter.admitBytes(derivePublicClientKey(req, trustedProxyHops), publicationId, bytes)) return true;
    log('public_rate_limited', { publicationId, stage: 'bytes' });
    sendJson(res, 429, { reason: 'rate_limited' });
    return false;
  }

  const server = http.createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      if (!res.headersSent && (
        error instanceof CommunityPrivateStateUnavailableError
        || error instanceof PostgresStoreUnavailableError
      )) {
        log('private_state_unavailable', { operation: error.operation });
        sendJson(res, 503, { reason: 'state_authority_unavailable' });
        return;
      }
      if (!res.headersSent) res.writeHead(500).end();
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Plan 44 WP-4A: infra liveness/readiness answer before CORS + routing.
    if (options.healthEndpoints && options.healthEndpoints.handle(req, res)) return;

    const storagePathname = (() => {
      try {
        return new URL(url, `http://${req.headers.host ?? 'localhost'}`).pathname;
      } catch {
        return url;
      }
    })();
    if (options.storageDescriptor && isStorageCapabilityPath(storagePathname)) {
      await handleStorageCapabilityHttpRequest(req, res, {
        service: options.storageDescriptor,
        corsAllowedOrigins: options.corsAllowedOrigins,
        log: (event, detail) => log(event, detail),
      });
      return;
    }

    if (!applyHttpCors(req, res, {
      allowedOrigins: options.corsAllowedOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      headers: [
        'Authorization',
        'Content-Type',
        'x-mk-app-unlock',
        'x-mk-credential',
        'x-mk-device',
        'x-mk-humanity',
        'x-mk-nonce',
        'x-mk-owner-sig',
        'x-mk-session',
        'x-mk-sig',
        'x-mk-ts',
      ],
    })) {
      sendJson(res, 403, { reason: 'origin_not_allowed' });
      return;
    }
    if (method === 'OPTIONS') {
      res.writeHead(204, { 'Content-Length': '0' });
      res.end();
      return;
    }

    if (url === '/healthz') {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      sendJson(res, 200, { ok: true });
      return;
    }

    // Community room admission (Plan 25 WP-25E). This optional graph belongs only to the
    // community-node listener and never reaches the slim relay server or its /healthz.
    if (roomTokenHandler) {
      const roomTokenResult = await roomTokenHandler(req, res);
      if (roomTokenResult === 'handled') return;
    }

    // Managed archive job intake (Plan 43 WP-43E). Only mounted when the deploy configures it;
    // handleArchiveRoute returns 'unmatched' for anything outside /api/archive/*, so it never
    // shadows the community/public route table below.
    if (options.archiveIntake) {
      const archiveResult = await handleArchiveRoute(req, res, options.archiveIntake);
      if (archiveResult === 'handled') return;
    }

    const challenge = CHALLENGE_PATH.exec(url);
    if (challenge) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(challenge[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'challenge')) return;
      // The challenge route is pre-auth and accepts ANY community id (a first
      // publish needs a nonce before the community exists), so it rides the same
      // per-IP limiter as every other open route: without it one client can mint
      // unbounded unclaimed community state (audit 2026-09-01, R1).
      if (!admitPublicRequest(req, res, communityId)) return;
      const issued = await node.issueChallenge(communityId);
      if (!issued) { log('challenge_reject', { communityId, reason: 'rate_limited' }); sendJson(res, 429, { reason: 'rate_limited' }); return; }
      log('challenge', { communityId });
      sendJson(res, 200, issued);
      return;
    }

    const manifest = MANIFEST_PATH.exec(url);
    if (manifest) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(manifest[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'manifest')) return;
      const auth = readAuthHeaders(req);
      if (!auth) { sendJson(res, 401, { reason: 'missing_auth' }); return; }
      // The manifest pull is the rate-limited 'pull' action; its opaque piece batch
      // rides this one counted pull (the piece route passes no action).
      const verdict = await node.getAuthenticatedManifest(communityId, auth);
      if (!verdict.ok) { log('manifest_reject', { communityId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('manifest', { communityId });
      sendJson(res, 200, encodeManifestPayload(verdict.payload));
      return;
    }

    const publish = PUBLISH_PATH.exec(url);
    if (publish) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(publish[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'publish')) return;
      const auth = readAuthHeaders(req);
      if (!auth) { sendJson(res, 401, { reason: 'missing_auth' }); return; }
      const rawPublish = await readBody(req, bodyLimits.publish);
      if (rawPublish === BODY_TOO_LARGE) { log('publish_reject', { communityId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      const body = decodePublishBody(rawPublish);
      if (!body) { sendJson(res, 400, { reason: 'bad_body' }); return; }
      const verdict = await node.publish(communityId, body, auth);
      if (!verdict.ok) { log('publish_reject', { communityId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('publish', { communityId, channels: body.snapshots.length });
      sendJson(res, 200, { ok: true });
      return;
    }

    const append = APPEND_PATH.exec(url);
    if (append) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(append[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'append')) return;
      const auth = readAuthHeaders(req);
      if (!auth) { sendJson(res, 401, { reason: 'missing_auth' }); return; }
      const raw = await readBody(req, bodyLimits.append);
      if (raw === BODY_TOO_LARGE) { log('append_reject', { communityId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      if (typeof raw !== 'object' || raw === null) { sendJson(res, 400, { reason: 'bad_body' }); return; }
      const verdict = await node.append(communityId, raw as SealedTailEntry, auth);
      if (!verdict.ok) { log('append_reject', { communityId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('append', { communityId });
      sendJson(res, 200, { ok: true });
      return;
    }

    const piece = PIECE_PATH.exec(url);
    if (piece) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(piece[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'piece')) return;
      const auth = readAuthHeaders(req);
      if (!auth) { sendJson(res, 401, { reason: 'missing_auth' }); return; }
      // Per-community gate (P6 item 1): the SAME auth as the manifest pull (the
      // device must be a member of THIS community), without consuming the nonce or
      // re-counting the rate limit -- the pieces ride the already-counted pull. The
      // piece is served only if its infoHash belongs to this community's snapshots.
      const infoHash = piece[2]!;
      const index = Number(piece[3]);
      const verdict = await node.serveAuthenticatedPiece(communityId, infoHash, index, auth);
      if (!verdict.ok) { log('piece_reject', { communityId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      const bytes = verdict.bytes;
      if (!bytes) { log('piece_miss', { communityId, infoHash, index }); res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length });
      res.end(Buffer.from(bytes));
      log('piece', { communityId, infoHash, index, bytes: bytes.length });
      return;
    }

    // ---- Durable join queue (Plan 57 W4) ----

    // POST /community/{id}/join/park -- park one OPAQUE sealed envelope. Two lanes
    // (the token-exhaustion defense): an UNAUTHENTICATED park (a joiner cannot
    // feed-auth) is accepted ONLY for a token the node can itself derive from the
    // CURRENT roster (bounded by roster size); an AUTHENTICATED park (a verified
    // roster member: the owner delivering a grant to a not-yet-listed joiner) may
    // target any token. Per-IP rate-limited + size-capped either way.
    const joinPark = JOIN_PARK_PATH.exec(url);
    if (joinPark) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(joinPark[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'join_park')) return;
      if (!admitPublicRequest(req, res, communityId)) return;
      const raw = await readBody(req, MAX_JOIN_BODY_BYTES);
      if (raw === BODY_TOO_LARGE) { log('join_park_reject', { communityId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      const body = (typeof raw === 'object' && raw !== null ? raw : {}) as { token?: unknown; envelope?: unknown };
      const token = typeof body.token === 'string' ? body.token : '';

      let tokenAuthorized = false;
      const parkAuth = readAuthHeaders(req);
      if (parkAuth) {
        // Authenticated lane: single-use nonce, member-verified, rate-counted.
        const verified = await node.verifyRequest(communityId, parkAuth, true, 'append');
        if (!verified.ok) { log('join_park_reject', { communityId, reason: verified.reason }); sendJson(res, verified.status, { reason: verified.reason }); return; }
        tokenAuthorized = true;
      } else {
        // Unauthenticated lane: the token must derive from the current roster.
        const state = await node.getPrivateCommunityState(communityId);
        const descriptor = state?.descriptor.descriptor;
        if (descriptor) {
          const recipients = new Set<string>(descriptor.members.map((m) => m.deviceId));
          recipients.add(descriptor.ownerDeviceId);
          for (const deviceId of [...recipients]) {
            if (deriveCommunityJoinToken(descriptor.genesisNonce, communityId, deviceId) === token) {
              tokenAuthorized = true;
              break;
            }
          }
        }
      }

      const verdict = await joinQueue.park(
        communityId,
        token,
        typeof body.envelope === 'string' ? body.envelope : '',
        await node.hasCommunity(communityId),
        tokenAuthorized,
      );
      if (!verdict.ok) { log('join_park_reject', { communityId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('join_park', { communityId });
      sendJson(res, 200, { ok: true, id: verdict.id });
      return;
    }

    // GET /community/{id}/join/box/{token} -- list a token's parked envelopes
    // WITHOUT consuming (the recipient acks what it processed).
    const joinBox = JOIN_BOX_PATH.exec(url);
    if (joinBox) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(joinBox[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'join_box')) return;
      if (!admitPublicRequest(req, res, communityId)) return;
      const listed = await joinQueue.list(communityId, joinBox[2]!);
      if (!Array.isArray(listed)) { sendJson(res, 400, { reason: listed.reason }); return; }
      log('join_box', { communityId, entries: listed.length });
      sendJson(res, 200, { entries: listed });
      return;
    }

    // POST /community/{id}/join/ack -- delete processed entries {token, ids}.
    const joinAck = JOIN_ACK_PATH.exec(url);
    if (joinAck) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const communityId = safeCommunityId(joinAck[1]!);
      if (communityId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, communityId, 'join_ack')) return;
      if (!admitPublicRequest(req, res, communityId)) return;
      const raw = await readBody(req, 16 * 1024);
      if (raw === BODY_TOO_LARGE) { sendJson(res, 413, { reason: 'too_large' }); return; }
      const body = (typeof raw === 'object' && raw !== null ? raw : {}) as { token?: unknown; ids?: unknown };
      const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
      const acked = await joinQueue.ack(communityId, typeof body.token === 'string' ? body.token : '', ids);
      if (typeof acked !== 'number') { sendJson(res, 400, { reason: acked.reason }); return; }
      log('join_ack', { communityId, acked });
      sendJson(res, 200, { ok: true, acked });
      return;
    }

    // ---- OPEN public routes (Plan 19 P3a). Reads drop auth; register stays signed. ----
    const pathname = url.split('?')[0] ?? url;

    // POST /public/{publicationId}/register -- owner-signed (verifyPublication). The
    // descriptor's own Ed25519 owner signature IS the auth; no per-member challenge.
    const register = PUBLIC_REGISTER_PATH.exec(pathname);
    if (register) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(register[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      if (!await requireHostedEntitlement(req, res, publicationId, 'register')) return;
      // Open-mode register is authenticated only by the descriptor's own owner
      // signature (inside node.registerPublication). Before buffering its body, gate
      // it on the same per-IP limiter as the other open routes AND cap the read, so a
      // no-credential flood cannot exhaust CPU or memory (audit S2).
      if (!admitPublicRequest(req, res, publicationId)) return;
      const rawRegister = await readBody(req, bodyLimits.register);
      if (rawRegister === BODY_TOO_LARGE) { log('publication_register_reject', { publicationId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      const body = decodeRegisterBody(rawRegister);
      if (!body) { sendJson(res, 400, { reason: 'bad_body' }); return; }
      if (body.descriptor?.descriptor?.publicationId !== publicationId) {
        sendJson(res, 400, { reason: 'id_mismatch' });
        return;
      }
      // AM9: the humanity gate runs AFTER the body shape + revision are verified (a
      // malformed/mismatched body is rejected above without ever consuming a token) and
      // BEFORE the descriptor is committed. A genesis (revision 1) registration is the
      // first-revision anti-bot point; later revisions of an already-vetted publication
      // are not re-gated unless firstRevisionOnly is disabled.
      const isFirstRevision = body.descriptor?.descriptor?.revision === 1;
      const gateFirstOnly = options.humanity?.firstRevisionOnly ?? true;
      if ((!gateFirstOnly || isFirstRevision)
        && !(await requireHumanityToken(req, res, publicationId, 'register'))) {
        return;
      }
      const verdict = await node.registerPublication(body);
      if (!verdict.ok) { log('publication_register_reject', { publicationId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('publication_register', { publicationId, channels: body.snapshots.length });
      sendJson(res, 200, { ok: true });
      return;
    }

    // POST /public/{publicationId}/report -- OPEN host abuse-intake (Plan 19 P8a). No
    // per-member auth; rate-limited by the per-IP PublicReadLimiter + per-publication
    // report cap. The body is an UNSEALED SignedPublicAbuseReport; the node verifies
    // the reporter's Ed25519 signature fail-closed (no owner DH key needed).
    const report = PUBLIC_REPORT_PATH.exec(pathname);
    if (report) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(report[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      if (!admitPublicRequest(req, res, publicationId)) return;
      // Cap the buffered body so an untrusted client cannot stream an unbounded report before
      // verification (the report route needs only ~a few hundred bytes).
      const raw = await readBody(req, MAX_REPORT_BODY_BYTES);
      if (raw === BODY_TOO_LARGE) { log('public_report_reject', { publicationId, reason: 'too_large' }); sendJson(res, 413, { ok: false, code: 'too_large' }); return; }
      const body = decodePublicReportBody(raw);
      if (!body) { sendJson(res, 400, { ok: false, code: 'bad_report' }); return; }
      const verdict = await node.submitPublicReport(publicationId, body);
      if (!verdict.ok) { log('public_report_reject', { publicationId, reason: verdict.reason }); sendJson(res, verdict.status, { ok: false, code: verdict.reason }); return; }
      log('public_report', { publicationId, reason: body.report.reason });
      sendJson(res, 200, { ok: true });
      return;
    }

    // GET /public/dmca/agent -- OPEN. Returns the founder-filled registered-agent block so a
    // claimant knows where formal notices go. 404 when DMCA intake is not wired.
    if (pathname === DMCA_AGENT_PATH) {
      if (!options.dmcaIntake) { res.writeHead(404).end(); return; }
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      if (!admitPublicRequest(req, res, 'dmca')) return;
      sendJson(res, 200, { agent: options.dmcaAgent ?? DMCA_REGISTERED_AGENT });
      return;
    }

    // POST /public/dmca/notice -- OPEN, rate-limited, zod-validated DMCA takedown intake
    // (Plan 39 P13). Persists the notice; the operator console drives takedown/counter-notice.
    if (pathname === DMCA_NOTICE_PATH) {
      if (!options.dmcaIntake) { res.writeHead(404).end(); return; }
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      if (!admitPublicRequest(req, res, 'dmca')) return;
      const raw = await readBody(req, MAX_DMCA_BODY_BYTES);
      if (raw === BODY_TOO_LARGE) { log('dmca_notice_reject', { reason: 'too_large' }); sendJson(res, 413, { ok: false, code: 'too_large' }); return; }
      const result = await options.dmcaIntake.submitClaim(raw);
      if (!result.ok) { log('dmca_notice_reject', { reason: result.reason }); sendJson(res, 400, { ok: false, code: result.reason }); return; }
      log('dmca_notice', { claimId: result.record.id });
      sendJson(res, 200, { ok: true, claimId: result.record.id, receivedAt: result.record.receivedAt });
      return;
    }

    // GET /public/{publicationId}/reports -- OWNER-signed. The publication owner fetches
    // the host-stored reports for their OWN publication, proving ownership with an
    // x-mk-owner-sig over the canonical (publicationId, x-mk-ts). Non-owner -> 401.
    const reports = PUBLIC_REPORTS_PATH.exec(pathname);
    if (reports) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(reports[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      if (!admitPublicRequest(req, res, publicationId)) return;
      const ts = headerValue(req, 'x-mk-ts');
      const sig = headerValue(req, 'x-mk-owner-sig');
      if (!ts || !sig) { sendJson(res, 401, { reason: 'missing_auth' }); return; }
      const verdict = await node.getPublicReportsForOwner(publicationId, ts, sig);
      if (!verdict.ok) { log('public_reports_reject', { publicationId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      const json = JSON.stringify({ reports: verdict.reports });
      if (!admitPublicBytes(req, res, publicationId, Buffer.byteLength(json))) return;
      log('public_reports', { publicationId, count: verdict.reports.length });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
      res.end(json);
      return;
    }

    // POST /public/{publicationId}/{channelId}/submit -- the GATED public write
    // (Plan 39 P6, NC-P3). Server-side gates IN ORDER, each fail-closed:
    //   (1) persona SESSION (injected verifier -- Track A seam),
    //   (2) x-mk-humanity SINGLE-USE token (atomic redeem on the humanity service),
    //   (3) x-mk-app-unlock ENTITLEMENT proof ($4.99 one-time meerkat_app_unlock),
    //   (4) roster/postPolicy, (5) flood + size caps -- both inside the node core,
    // then the node countersigns and appends so readers see it on the page route.
    // Body shape is validated BEFORE gate (2) so a malformed body never consumes a
    // single-use humanity token (AM9 discipline from the register route). NC-P1:
    // none of these gates touches a private mesh route.
    const submit = PUBLIC_SUBMIT_PATH.exec(pathname);
    if (submit) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(submit[1]!);
      const channelId = safeDecode(submit[2]!);
      if (publicationId === null || channelId === null) { res.writeHead(404).end(); return; }
      // Global per-IP cap first (DoS rail shared with every open public route).
      // This rejection happens before the single-use humanity token is redeemed,
      // so tell clients they can safely restore the token reserved for this attempt.
      if (!admitPublicRequest(req, res, publicationId, { humanityTokenConsumed: false })) return;
      const raw = await readBody(req, bodyLimits.submit);
      if (raw === BODY_TOO_LARGE) { log('public_submit_reject', { publicationId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      const post = decodePublicPostBody(raw);
      if (!post) { sendJson(res, 400, { reason: 'bad_body' }); return; }
      // AM9 (full form): verify the COMPLETE post shape + author signature BEFORE
      // any gate, so a malformed or forged post can never spend the caller's
      // single-use humanity token (the core re-checks; this is the token shield).
      if (!verifyPublicPostAuthor(post)) {
        log('public_submit_reject', { publicationId, reason: 'bad_post' });
        sendJson(res, 400, { reason: 'bad_post' });
        return;
      }
      // Gate 1: persona session (fail-closed seam; Track A wires the verifier).
      const session = await requireSubmitSession(req, res, publicationId);
      if (!session) return;
      // Gate 2: humanity single-use redeem (atomic, spends the token) OR, when a
      // Plan 51 credential verifier is wired, a valid credential presentation as
      // the ALTERNATIVE proof. A presented credential is verified first: if it
      // passes, its serial is recorded as moderation evidence and the humanity
      // redeem is skipped; if it is malformed/expired/revoked it is refused with
      // the verifier's honest reason (no fallback to humanity for a BAD credential,
      // so a forged credential cannot silently downgrade to the humanity path).
      // With no verifier configured OR no credential presented, the humanity
      // redeem is required exactly as before (byte-identical legacy behavior).
      const credentialOutcome = await trySubmitCredential(req, res, publicationId, session.personaPubkey);
      if (credentialOutcome === 'rejected') return;
      if (credentialOutcome === 'absent'
        && !await requireSubmitHumanity(req, res, publicationId)) return;
      // Gate 3: app-unlock entitlement proof (existing $4.99 one-time SKU, NC-P5),
      // PERSONA-BOUND: the proof must be minted for THIS session's persona, so a
      // purchased proof is not transferable to an unpurchased account.
      if (!await requireSubmitAppUnlock(req, res, publicationId, session.personaPubkey)) return;
      // Gates 4-5 + countersign + append live in the node core.
      const verdict = await node.submitPublicPost(publicationId, channelId, post, session.personaPubkey);
      if (!verdict.ok) { log('public_submit_reject', { publicationId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('public_submit', { publicationId, channelId, deduplicated: verdict.deduplicated });
      // The REAL dual-signed acceptance: composers show "posted" only off this
      // receipt (Plan 26 NC-3; never fabricate acceptance).
      sendJson(res, 200, { ok: true, accepted: verdict.accepted, deduplicated: verdict.deduplicated });
      return;
    }

    // POST /public/{publicationId}/post-tombstone -- signed post removal (owner /
    // node / author persona). Authorization IS the Ed25519 signature (verified in
    // the core against the stored descriptor + pinned keys), like the report route.
    const postTombstone = PUBLIC_POST_TOMBSTONE_PATH.exec(pathname);
    if (postTombstone) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(postTombstone[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      if (!admitPublicRequest(req, res, publicationId)) return;
      const raw = await readBody(req, bodyLimits.moderation);
      if (raw === BODY_TOO_LARGE) { log('post_tombstone_reject', { publicationId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      const tombstone = decodePostTombstoneBody(raw);
      if (!tombstone) { sendJson(res, 400, { reason: 'bad_body' }); return; }
      const verdict = await node.recordPublicPostTombstone(publicationId, tombstone);
      if (!verdict.ok) { log('post_tombstone_reject', { publicationId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('post_tombstone', { publicationId });
      sendJson(res, 200, { ok: true });
      return;
    }

    // POST /public/{publicationId}/posting-freeze -- the ONE-ACTION kill switch
    // (owner/operator signed): flips the publication's effective posting to
    // view_only immediately on every subsequent submit.
    const postingFreeze = PUBLIC_POSTING_FREEZE_PATH.exec(pathname);
    if (postingFreeze) {
      if (method !== 'POST') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(postingFreeze[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      if (!admitPublicRequest(req, res, publicationId)) return;
      const raw = await readBody(req, bodyLimits.moderation);
      if (raw === BODY_TOO_LARGE) { log('posting_freeze_reject', { publicationId, reason: 'too_large' }); sendJson(res, 413, { reason: 'too_large' }); return; }
      const freeze = decodePostingFreezeBody(raw);
      if (!freeze) { sendJson(res, 400, { reason: 'bad_body' }); return; }
      const verdict = await node.recordPostingFreeze(publicationId, freeze);
      if (!verdict.ok) { log('posting_freeze_reject', { publicationId, reason: verdict.reason }); sendJson(res, verdict.status, { reason: verdict.reason }); return; }
      log('posting_freeze', { publicationId, frozen: freeze.frozen });
      sendJson(res, 200, { ok: true });
      return;
    }

    // GET /public/{publicationId}/manifest -- OPEN. 404 unknown/unpublished/killed.
    const publicManifest = PUBLIC_MANIFEST_PATH.exec(pathname);
    if (publicManifest) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(publicManifest[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      if (!admitPublicRequest(req, res, publicationId)) return;
      if (!await requireReadSession(req, res, publicationId)) return;
      const payload = await node.getPublicationManifest(publicationId);
      if (!payload) { res.writeHead(404).end(); return; }
      const json = JSON.stringify(payload);
      if (!admitPublicBytes(req, res, publicationId, Buffer.byteLength(json))) return;
      log('public_manifest', { publicationId });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
      res.end(json);
      return;
    }

    // GET /public/{publicationId}/{channelId}/page?after={wall}.{counter}&limit={n} -- OPEN.
    const publicPage = PUBLIC_PAGE_PATH.exec(pathname);
    if (publicPage) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(publicPage[1]!);
      const channelId = safeDecode(publicPage[2]!);
      if (publicationId === null || channelId === null) { res.writeHead(404).end(); return; }
      if (!admitPublicRequest(req, res, publicationId)) return;
      if (!await requireReadSession(req, res, publicationId)) return;
      const query = new URL(url, 'http://internal').searchParams;
      const after = parsePageCursor(query.get('after'));
      if (after === 'invalid') { sendJson(res, 400, { reason: 'bad_cursor' }); return; }
      const payload = await node.getPublicationPage(publicationId, channelId, after, parsePageLimit(query.get('limit')));
      if (!payload) { res.writeHead(404).end(); return; }
      const json = JSON.stringify(payload);
      if (!admitPublicBytes(req, res, publicationId, Buffer.byteLength(json))) return;
      log('public_page', { publicationId, channelId, events: payload.events.length });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
      res.end(json);
      return;
    }

    // GET /public/{publicationId}/{infoHash}/{index} -- OPEN. NC-2: only the
    // publication's OWN contentId is serveable; a foreign/private infoHash -> 404.
    const publicPiece = PUBLIC_PIECE_PATH.exec(pathname);
    if (publicPiece) {
      if (method !== 'GET') { res.writeHead(405).end(); return; }
      const publicationId = safeDecode(publicPiece[1]!);
      if (publicationId === null) { res.writeHead(404).end(); return; }
      const infoHash = publicPiece[2]!;
      const index = Number(publicPiece[3]);
      if (!admitPublicRequest(req, res, publicationId)) return;
      if (!await requireReadSession(req, res, publicationId)) return;
      const bytes = await node.servePublicationPiece(publicationId, infoHash, index);
      if (!bytes) { res.writeHead(404).end(); return; }
      if (!admitPublicBytes(req, res, publicationId, bytes.length)) return;
      log('public_piece', { publicationId, infoHash, index, bytes: bytes.length });
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length });
      res.end(Buffer.from(bytes));
      return;
    }

    res.writeHead(404).end();
  }

  async function requireHostedEntitlement(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    communityId: string,
    action: string,
  ): Promise<boolean> {
    const hosted = options.hostedEntitlement;
    if (!hosted?.required) return true;
    if (!hosted.secret) {
      log('hosted_entitlement_reject', { communityId, action, reason: 'not_configured' });
      sendJson(res, 500, { reason: 'entitlement_not_configured' });
      return false;
    }
    const verdict = await verifyHostedFeatureEntitlement(
      readBearerToken(req),
      hosted.secret,
      hosted.feature ?? MEERKAT_COMMUNITY_NODE_FEATURE,
      {
        appId: hosted.appId,
        nowMs: hosted.nowMs?.(),
        revokedSignatures: hosted.revokedSignatures,
        isRevoked: hosted.isRevoked,
      },
    );
    if (verdict.ok) return true;
    const reason = verdict.reason === 'missing' ? 'entitlement_required' : 'entitlement_invalid';
    log('hosted_entitlement_reject', { communityId, action, reason });
    sendJson(res, 401, { reason });
    return false;
  }

  /**
   * Anti-bot humanity gate (Plan 24 P3), cloning requireHostedEntitlement. Returns true
   * (proceed) when the gate is disabled; otherwise it REQUIRES a valid humanity token in
   * the configured header and spends it via the injected verifier. Fail-closed: an
   * unconfigured verifier is a 500, a missing token a 401, an invalid one a 401, and an
   * already-spent token a 409 (replay). Never logs the token.
   */
  async function requireHumanityToken(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    publicationId: string,
    feature: string,
  ): Promise<boolean> {
    const humanity = options.humanity;
    if (!humanity?.required) return true;
    if (!humanity.verifyToken) {
      log('humanity_reject', { publicationId, feature, reason: 'not_configured' });
      sendJson(res, 500, { reason: 'humanity_not_configured' });
      return false;
    }
    const token = headerValue(req, humanity.header ?? 'x-mk-humanity');
    if (!token) {
      log('humanity_reject', { publicationId, feature, reason: 'missing' });
      sendJson(res, 401, { reason: 'humanity_required' });
      return false;
    }
    let verdict: { ok: boolean; reason?: string };
    try {
      verdict = await humanity.verifyToken(token);
    } catch {
      verdict = { ok: false, reason: 'error' };
    }
    if (verdict.ok) return true;
    const status = verdict.reason === 'already_spent' ? 409 : 401;
    log('humanity_reject', { publicationId, feature, reason: verdict.reason ?? 'invalid' });
    sendJson(res, status, { reason: 'humanity_invalid' });
    return false;
  }

  /**
   * Submit gate 1 (Plan 39 P6): the persona SESSION. The verifier is an INJECTED
   * dependency (Track A's verifySessionToken; the orchestrator wires it at merge).
   * FAIL-CLOSED on every path: no verifier configured -> 500 session_not_configured
   * (every submit refused until the deploy wires it); missing header -> 401;
   * verifier rejection -> 401; verifier throw -> 503. Returns the session's persona
   * pubkey so the route binds the session to the post author.
   */
  async function requireSubmitSession(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    publicationId: string,
  ): Promise<{ personaPubkey: string } | null> {
    const submitOptions = options.publicSubmit;
    if (!submitOptions?.sessionVerifier) {
      log('public_submit_reject', { publicationId, reason: 'session_not_configured' });
      sendJson(res, 500, { reason: 'session_not_configured' });
      return null;
    }
    const token = headerValue(req, submitOptions.sessionHeader ?? 'x-mk-session');
    if (!token) {
      log('public_submit_reject', { publicationId, reason: 'session_required' });
      sendJson(res, 401, { reason: 'session_required' });
      return null;
    }
    let verdict: PublicPostSessionVerdict;
    try {
      verdict = await submitOptions.sessionVerifier(token);
    } catch {
      log('public_submit_reject', { publicationId, reason: 'session_unreachable' });
      sendJson(res, 503, { reason: 'session_unreachable' });
      return null;
    }
    if (!verdict.ok || typeof verdict.personaPubkey !== 'string' || verdict.personaPubkey.length === 0) {
      log('public_submit_reject', { publicationId, reason: 'session_invalid' });
      sendJson(res, 401, { reason: 'session_invalid' });
      return null;
    }
    return { personaPubkey: verdict.personaPubkey };
  }

  /**
   * Submit gate 2 (Plan 39 P6): the SINGLE-USE humanity redeem. Unlike the
   * register gate, this is UNCONDITIONALLY required on the public write path
   * (NC-P3): a node with no redeem client configured refuses every submit rather
   * than skipping the gate. Uses the same verify-and-spend client as the register
   * gate (atomic redeem on the humanity service); never logs the token.
   */
  async function requireSubmitHumanity(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    publicationId: string,
  ): Promise<boolean> {
    const verifyToken = options.publicSubmit?.humanityVerifyToken ?? options.humanity?.verifyToken;
    if (!verifyToken) {
      log('public_submit_reject', { publicationId, reason: 'humanity_not_configured' });
      sendJson(res, 500, { reason: 'humanity_not_configured' });
      return false;
    }
    const header = options.publicSubmit?.humanityHeader ?? options.humanity?.header ?? 'x-mk-humanity';
    const token = headerValue(req, header);
    if (!token) {
      log('public_submit_reject', { publicationId, reason: 'humanity_required' });
      sendJson(res, 401, { reason: 'humanity_required' });
      return false;
    }
    let verdict: { ok: boolean; reason?: string };
    try {
      verdict = await verifyToken(token);
    } catch {
      verdict = { ok: false, reason: 'error' };
    }
    if (verdict.ok) return true;
    const status = verdict.reason === 'already_spent' ? 409 : 401;
    log('public_submit_reject', { publicationId, reason: verdict.reason ?? 'humanity_invalid' });
    sendJson(res, status, { reason: 'humanity_invalid' });
    return false;
  }

  /**
   * Plan 51 P2 alternative proof on the submit path. Return values:
   *  - 'absent'   : no verifier wired, or no credential presented -> caller runs
   *                 the humanity redeem exactly as before.
   *  - 'accepted' : a valid credential passed; the serial was recorded as evidence
   *                 and the humanity redeem MUST be skipped.
   *  - 'rejected' : a credential WAS presented (verifier wired) but is
   *                 missing-shaped/invalid/expired/revoked/not_configured; a
   *                 response was already sent with the verifier's honest reason.
   * A bad credential never falls back to the humanity path (no downgrade).
   */
  async function trySubmitCredential(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    publicationId: string,
    personaPubkey: string,
  ): Promise<'absent' | 'accepted' | 'rejected'> {
    const verifier = options.publicSubmit?.credentialVerifier;
    if (!verifier) return 'absent';
    const header = options.publicSubmit?.credentialHeader ?? 'x-mk-credential';
    const presentation = headerValue(req, header);
    // No credential presented -> fall through to the legacy humanity path.
    if (presentation === null) return 'absent';
    const verdict = await verifier.verifyPresentation(presentation);
    if (!verdict.ok) {
      log('public_submit_reject', { publicationId, reason: `credential_${verdict.reason}` });
      sendJson(res, credentialStatus(verdict.reason), { reason: 'credential_invalid' });
      return 'rejected';
    }
    // Serial captured as moderation evidence (co-located with the persona, never
    // an account). Evidence-write failure must not accept-then-lose the serial:
    // treat a dead sink as fail-closed so an unrevocable presentation is refused.
    if (options.publicSubmit?.credentialEvidence) {
      try {
        await options.publicSubmit.credentialEvidence.record({
          serial: verdict.serial,
          epoch: verdict.epoch,
          subject: personaPubkey,
          surface: 'community_submit',
          publicationId,
        });
      } catch {
        log('public_submit_reject', { publicationId, reason: 'credential_evidence_unavailable' });
        sendJson(res, 503, { reason: 'credential_evidence_unavailable' });
        return 'rejected';
      }
    }
    return 'accepted';
  }

  /**
   * Submit gate 3 (Plan 39 P6): the app-unlock ENTITLEMENT proof. Verifies the
   * `x-mk-app-unlock` HMAC token (minted by the hosted API from a REAL
   * meerkat_app_unlock purchase row) against the shared secret AND requires the
   * proof's persona BINDING to hash-match the session persona (a proof minted for
   * one persona never unlocks posting for another). FAIL-CLOSED: unconfigured
   * secret -> 500; missing header -> 401; any verification/binding failure ->
   * 401. NC-P5: this is the EXISTING $4.99 one-time SKU, no new price.
   */
  async function requireSubmitAppUnlock(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    publicationId: string,
    sessionPersonaPubkey: string,
  ): Promise<boolean> {
    const secret = options.publicSubmit?.appUnlockSecret;
    if (!secret) {
      log('public_submit_reject', { publicationId, reason: 'app_unlock_not_configured' });
      sendJson(res, 500, { reason: 'app_unlock_not_configured' });
      return false;
    }
    const token = headerValue(req, options.publicSubmit?.appUnlockHeader ?? 'x-mk-app-unlock');
    if (!token) {
      log('public_submit_reject', { publicationId, reason: 'app_unlock_required' });
      sendJson(res, 401, { reason: 'app_unlock_required' });
      return false;
    }
    let check: Awaited<ReturnType<typeof verifyMeerkatAppUnlockToken>>;
    try {
      check = await verifyMeerkatAppUnlockToken(token, secret, {
        nowMs: options.now?.(),
        requireBinding: true,
        expectedBindingHash: personaBindingHash(sessionPersonaPubkey),
      });
    } catch {
      check = { ok: false, reason: 'malformed' };
    }
    if (check.ok) return true;
    log('public_submit_reject', { publicationId, reason: `app_unlock_${check.reason}` });
    sendJson(res, 401, { reason: 'app_unlock_invalid' });
    return false;
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      log('listening', { host, port });
      resolve({
        port,
        url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
        close: () => new Promise<void>((r) => {
          clearInterval(limiterSweep);
          clearInterval(communitySweep);
          server.close(() => r());
        }),
      });
    });
  });
}

/** Serialize the manifest payload for the wire. Tail bytes are already hex; the
 * per-channel manifest is stringified so the puller's parseSnapshotManifest reads
 * it back leniently. No piece bytes cross here (those come from the piece route). */
function encodeManifestPayload(payload: Awaited<ReturnType<CommunityNode['getManifest']>>): unknown {
  // The payload is already JSON-safe (descriptor + manifest objects + hex tail).
  // Stringify the manifest so the puller's parseSnapshotManifest reads it back.
  return {
    descriptor: payload.descriptor,
    snapshots: payload.snapshots.map((s) => ({
      channelId: s.channelId,
      manifest: JSON.stringify(s.manifest),
      record: s.record,
    })),
    tail: payload.tail,
  };
}
