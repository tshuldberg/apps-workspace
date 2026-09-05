/**
 * HTTP surface for the public-tier persona registry + accounts service (Plan 39, P2). Kept in
 * a SEPARATE module from persona-registry.ts so the pure, DI'd core stays framework-agnostic
 * and testable without a socket, mirroring humanity-service-http.ts.
 *
 * Routes (all JSON):
 *   POST /persona/register           { claim }        (+ x-mk-humanity header) -> { alias, personaPubkey }
 *   POST /persona/resolve            { alias }                                 -> { alias, personaPubkey } | { ok:false }
 *   POST /persona/resolve-keys       { personaPubkeys[] }                       -> { aliases: { pubkey: alias } } (registered only)
 *   POST /persona/session/challenge  { personaPubkey }                         -> { challengeId, nonce }
 *   POST /persona/session/issue      { challengeId, personaPubkey, signature } -> { token, expiresAtMs }
 *   POST /persona/session/verify     { token }                                 -> { ok, personaPubkey, expiresAtMs }
 *   POST /persona/delete             { personaPubkey, issuedAt, signature }    -> { releasedAlias, reregisterBlockedUntilMs }
 *   POST /persona/export             { personaPubkey, issuedAt, signature }    -> { record, revoked }
 *   GET  /healthz                                                              -> { ok, ...bounded counts }
 *
 * Fail-closed + honesty: every route validates its body with zod (a bad body is a 400, never
 * a throw), the humanity token rides the `x-mk-humanity` header (never logged), and no route
 * fabricates a registered/available/verified state -- each answer comes from the real service
 * verdict. A per-IP request limiter (PublicReadLimiter, mirroring the open read routes) maps
 * an over-rate caller to 429. Nothing here logs a token, a signature, or an IP.
 */

import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { derivePublicClientKey, PublicReadLimiter, type PublicReadLimits } from './public-read-limiter';
import type { HumanityRouteGuard } from './humanity-route-guard';
import type { PersonaRegistryService } from './persona-registry';
import type { GdprDeletionCoordinator } from './gdpr-deletion';
import { applyHttpCors } from './http-cors';
import { PostgresStoreUnavailableError } from './postgres/store-context';
import type { HealthEndpoints } from './service-health';
import type { CredentialVerifier, CredentialPresentationReason } from './credential-verify';
import type { CredentialEvidenceSink } from './credential-evidence';

const MAX_BODY_BYTES = 128 * 1024;

const PersonaClaimSchema = z.object({
  version: z.literal(1),
  alias: z.string().min(1).max(64),
  personaPubkey: z.string().min(1).max(128),
  humanityBinding: z.string().min(1).max(128),
  issuedAt: z.string().min(1).max(64),
  signature: z.string().min(1).max(256),
});
const RegisterBodySchema = z.object({ claim: PersonaClaimSchema });
const ResolveBodySchema = z.object({ alias: z.string().min(1).max(64) });
const ResolveKeysBodySchema = z.object({ personaPubkeys: z.array(z.string().min(1).max(128)).max(200) });
const ChallengeBodySchema = z.object({ personaPubkey: z.string().min(1).max(128) });
const IssueBodySchema = z.object({
  challengeId: z.string().min(1).max(256),
  personaPubkey: z.string().min(1).max(128),
  signature: z.string().min(1).max(256),
});
const VerifyBodySchema = z.object({ token: z.string().min(1).max(4096) });
const GdprBodySchema = z.object({
  personaPubkey: z.string().min(1).max(128),
  issuedAt: z.number().int(),
  signature: z.string().min(1).max(256),
});
const AdminTargetSchema = z.object({
  personaPubkey: z.string().min(1).max(128).optional(),
  alias: z.string().min(1).max(64).optional(),
}).refine((v) => Boolean(v.personaPubkey) || Boolean(v.alias), { message: 'target_required' });

/**
 * Absolute route the persona service serves for session verification. A client (the community
 * node's submit gate) POSTs { token } here to resolve { ok, personaPubkey }.
 */
export const PERSONA_SESSION_VERIFY_ROUTE = '/persona/session/verify';

/**
 * Normalize an operator-supplied SESSION_VERIFY_URL to the persona service BASE origin, then
 * return the full verify endpoint. The base form (`https://accounts.example`) is canonical, but
 * an older ops doc wrote `<base>/persona`; both must resolve to `<base>/persona/session/verify`,
 * never a fail-closed doubled `<base>/persona/persona/session/verify`. A blank input yields
 * undefined so the caller can honestly report the gate as not-configured (fail closed).
 */
export function personaSessionVerifyEndpoint(rawBaseUrl: string | undefined | null): string | undefined {
  const base = (rawBaseUrl ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/persona$/i, '');
  if (!base) return undefined;
  return `${base}${PERSONA_SESSION_VERIFY_ROUTE}`;
}

export interface PersonaServiceServer {
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

export interface StartPersonaServiceOptions {
  service: PersonaRegistryService;
  /** Full cross-service account-rights coordinator. Delete/export fail closed without it. */
  gdprCoordinator?: Pick<GdprDeletionCoordinator, 'deletePersona' | 'exportPersona'>;
  /** Exact browser origins allowed to call the persona service. */
  corsAllowedOrigins?: readonly string[];
  port?: number;
  host?: string;
  /** Header carrying the wire humanity token for registration. Defaults to x-mk-humanity. */
  humanityHeader?: string;
  /**
   * Humanity gate on SESSION ISSUANCE (Plan 39 P7, binding): minting a session is a
   * shared-network account action and MUST spend one single-use humanity token. Wire the
   * reusable `createHumanityRouteGuard` here; it reads `x-mk-humanity`, verifies + SPENDS the
   * token, and fail-closes (401 missing/invalid, 409 replayed, 503 unreachable). Absent while
   * `sessionHumanityRequired` is true => every issue is 500 `humanity_not_configured`.
   */
  sessionHumanityGuard?: HumanityRouteGuard;
  /** Whether session issuance requires a humanity token. Default true (first-party). */
  sessionHumanityRequired?: boolean;
  /**
   * Plan 51 P2 anonymous-credential verifier for REGISTRATION. OPTIONAL and
   * fail-closed. When present, a valid credential presentation in the
   * `x-mk-credential` header is accepted as the ALTERNATIVE humanity proof:
   * registration proceeds with `humanitySatisfiedByCredential` (no humanity token
   * spend) and the serial is recorded as evidence. A malformed/expired/revoked
   * presentation is refused with the verifier's honest reason. Absent OR no
   * credential presented => byte-identical legacy behavior (humanity token path).
   */
  credentialVerifier?: CredentialVerifier;
  /** Header carrying the credential presentation. Defaults to x-mk-credential. */
  credentialHeader?: string;
  /**
   * Records an accepted registration credential's serial as moderation evidence
   * (Plan 51 P4), co-located with the registering persona pubkey (persona-side),
   * never an account identifier.
   */
  credentialEvidence?: CredentialEvidenceSink;
  /** Per-IP request-rate limiter overrides. */
  requestLimits?: Partial<PublicReadLimits>;
  /**
   * OPERATOR admin secret (Plan 39 P12) gating /persona/admin/* (suspend,
   * unsuspend, status). FAIL-CLOSED: absent/empty => every admin route answers
   * 503 admin_not_configured; a missing/wrong bearer => 401. The compare is
   * constant-time. This is the seam the operator moderation console calls.
   */
  adminSecret?: string;
  /** Counts/paths only; never token/signature/IP contents. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
  /** Sweep cadence (expired challenges/tombstones). Default 60s. */
  sweepMs?: number;
  /**
   * Exact number of reverse-proxy hops controlled by this deployment. Default 0:
   * forwarding headers are ignored and the direct socket address keys the limiter.
   */
  trustedProxyHops?: number;
  now?: () => number;
  /**
   * Plan 44 WP-4A liveness/readiness. When present, GET /livez and GET /readyz are
   * answered on THIS public listener (ahead of CORS and the route table) so an edge
   * healthcheck can probe honest dependency readiness. `/readyz` never fakes a
   * capability; it AND-s the required dependency probes for this service's mode.
   */
  healthEndpoints?: HealthEndpoints;
}

function readBody(req: http.IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function headerValue(req: http.IncomingMessage, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Constant-time bearer compare (hash both sides so length never leaks). */
function bearerMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(secret, 'utf8').digest();
  return timingSafeEqual(a, b);
}

function readBearer(req: http.IncomingMessage): string | null {
  const raw = headerValue(req, 'authorization');
  if (!raw) return null;
  const [scheme, ...rest] = raw.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

/** Map a credential presentation refusal to an honest HTTP status (Plan 51 P2). */
function credentialStatus(reason: CredentialPresentationReason): number {
  return reason === 'not_configured' ? 500 : 401;
}

/** Map a register/issue reason to an honest HTTP status. */
function registerStatus(reason: string): number {
  if (reason === 'humanity_not_configured') return 500;
  if (
    reason === 'alias_taken' || reason === 'alias_reserved' || reason === 'alias_cooldown'
    || reason === 'persona_exists' || reason === 'persona_revoked' || reason === 'humanity_already_spent'
    || reason === 'humanity_attempt_conflict'
  ) return 409;
  if (reason === 'humanity_unreachable') return 503;
  return 400;
}

export function startPersonaService(options: StartPersonaServiceOptions): Promise<PersonaServiceServer> {
  const { service } = options;
  const host = options.host ?? '0.0.0.0';
  const log = options.log ?? (() => {});
  const sweepMs = options.sweepMs ?? 60_000;
  const now = options.now ?? (() => Date.now());
  const humanityHeader = options.humanityHeader ?? 'x-mk-humanity';
  const sessionHumanityRequired = options.sessionHumanityRequired ?? true;
  const sessionHumanityGuard = options.sessionHumanityGuard;
  const limiter = new PublicReadLimiter(options.requestLimits, now);
  const trustedProxyHops = Number.isFinite(options.trustedProxyHops)
    ? Math.max(0, Math.floor(options.trustedProxyHops ?? 0))
    : 0;

  /**
   * Plan 51 P2 registration alternative proof. Returns:
   *  - { outcome:'absent' }   no verifier wired or no credential presented ->
   *                           legacy humanity path.
   *  - { outcome:'accepted' } valid credential; serial recorded as evidence ->
   *                           register with humanitySatisfiedByCredential.
   *  - { outcome:'rejected' } a credential was presented but is bad; caller
   *                           refuses. A bad credential never falls back to
   *                           humanity (no downgrade). A dead evidence sink fails
   *                           closed (an unrevocable presentation is refused).
   */
  async function verifyRegistrationCredential(
    req: http.IncomingMessage,
    personaPubkey: string,
  ): Promise<{ outcome: 'absent' | 'accepted' } | { outcome: 'rejected'; reason: CredentialPresentationReason }> {
    const verifier = options.credentialVerifier;
    if (!verifier) return { outcome: 'absent' };
    const presentation = headerValue(req, options.credentialHeader ?? 'x-mk-credential');
    if (presentation === null) return { outcome: 'absent' };
    const verdict = await verifier.verifyPresentation(presentation);
    if (!verdict.ok) return { outcome: 'rejected', reason: verdict.reason };
    if (options.credentialEvidence) {
      try {
        await options.credentialEvidence.record({
          serial: verdict.serial,
          epoch: verdict.epoch,
          subject: personaPubkey,
          surface: 'persona_registration',
        });
      } catch {
        return { outcome: 'rejected', reason: 'not_configured' };
      }
    }
    return { outcome: 'accepted' };
  }

  const server = http.createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      if (res.headersSent) return;
      if (error instanceof PostgresStoreUnavailableError) {
        sendJson(res, 503, { ok: false, reason: 'state_authority_unavailable' });
        return;
      }
      sendJson(res, 500, { ok: false, reason: 'internal_error' });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const pathname = (req.url ?? '/').split('?')[0];

    // Infra liveness/readiness answer before CORS: they carry no credentials or
    // tenant data and an edge healthcheck has no browser Origin.
    if (options.healthEndpoints && options.healthEndpoints.handle(req, res)) return;

    if (!applyHttpCors(req, res, {
      allowedOrigins: options.corsAllowedOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      headers: ['Authorization', 'Content-Type', 'x-mk-credential', 'x-mk-humanity'],
    })) {
      sendJson(res, 403, { ok: false, reason: 'origin_not_allowed' });
      return;
    }

    if (method === 'OPTIONS') {
      res.writeHead(204, { 'Content-Length': '0' });
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/healthz') {
      sendJson(res, 200, { ok: true, ...(await service.stats()) });
      return;
    }

    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
      return;
    }

    // Per-IP request-rate backstop (mirrors the open read routes). Over-rate -> 429.
    if (!limiter.admitRequest(derivePublicClientKey(req, trustedProxyHops))) {
      sendJson(res, 429, { ok: false, reason: 'rate_limited' });
      return;
    }

    const raw = await readBody(req);
    if (raw === null) {
      sendJson(res, 413, { ok: false, reason: 'body_too_large' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { ok: false, reason: 'bad_json' });
      return;
    }

    if (pathname === '/persona/register') {
      const body = RegisterBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const humanityToken = headerValue(req, humanityHeader) ?? undefined;
      // Plan 51 P2: a valid credential presentation is the ALTERNATIVE humanity
      // proof. Verified BEFORE register so a bad credential is refused without
      // touching the registry; on success the registry skips the humanity spend.
      const credential = await verifyRegistrationCredential(req, body.data.claim.personaPubkey);
      if (credential.outcome === 'rejected') {
        log('register_reject', { reason: `credential_${credential.reason}` });
        sendJson(res, credentialStatus(credential.reason), { ok: false, reason: 'credential_invalid' });
        return;
      }
      const result = await service.register({
        claim: body.data.claim,
        humanityToken,
        ...(credential.outcome === 'accepted' ? { humanitySatisfiedByCredential: true } : {}),
      });
      if (!result.ok) {
        log('register_reject', { reason: result.reason });
        sendJson(res, registerStatus(result.reason), { ok: false, reason: result.reason });
        return;
      }
      log('register', {});
      sendJson(res, 200, { ok: true, alias: result.alias, personaPubkey: result.personaPubkey });
      return;
    }

    if (pathname === '/persona/resolve') {
      const body = ResolveBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const resolved = await service.resolve(body.data.alias);
      if (!resolved) { sendJson(res, 404, { ok: false, reason: 'not_found' }); return; }
      sendJson(res, 200, { ok: true, alias: resolved.alias, personaPubkey: resolved.personaPubkey });
      return;
    }

    if (pathname === '/persona/resolve-keys') {
      const body = ResolveKeysBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const aliases = await service.reverseResolveKeys(body.data.personaPubkeys);
      // Only REGISTERED personas appear; unregistered/deleted keys are absent (never faked).
      sendJson(res, 200, { ok: true, aliases });
      return;
    }

    if (pathname === '/persona/session/challenge') {
      const body = ChallengeBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.sessionChallenge(body.data.personaPubkey);
      if (!result.ok) { sendJson(res, 404, { ok: false, reason: result.reason }); return; }
      sendJson(res, 200, { ok: true, challengeId: result.challengeId, nonce: result.nonce });
      return;
    }

    if (pathname === '/persona/session/issue') {
      const body = IssueBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      // Humanity gate (Plan 39 P7, binding): minting a session spends one single-use humanity
      // token. Run AFTER body validation (a malformed body never spends a token) and BEFORE
      // issuance. Fail-closed: required && no guard => 500. The guard sends its own 401/409/503
      // response on failure, so we just return.
      if (sessionHumanityRequired) {
        if (!sessionHumanityGuard) {
          log('issue_reject', { reason: 'humanity_not_configured' });
          sendJson(res, 500, { ok: false, reason: 'humanity_not_configured' });
          return;
        }
        if (!await sessionHumanityGuard(req, res, 'persona_session_issue')) return;
      }
      const result = await service.issueSession({
        challengeId: body.data.challengeId,
        personaPubkey: body.data.personaPubkey,
        signatureHex: body.data.signature,
      });
      if (!result.ok) {
        log('issue_reject', { reason: result.reason });
        const status = result.reason === 'not_configured' ? 500 : 401;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log('issue', {});
      sendJson(res, 200, { ok: true, token: result.token, expiresAtMs: result.expiresAtMs });
      return;
    }

    if (pathname === '/persona/session/verify') {
      const body = VerifyBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const verdict = await service.verifySession(body.data.token);
      if (!verdict.ok) { sendJson(res, 401, { ok: false, reason: verdict.reason }); return; }
      sendJson(res, 200, { ok: true, personaPubkey: verdict.personaPubkey, expiresAtMs: verdict.expiresAtMs });
      return;
    }

    if (pathname === '/persona/delete') {
      const body = GdprBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      if (!options.gdprCoordinator) {
        sendJson(res, 503, { ok: false, reason: 'gdpr_delete_not_configured' });
        return;
      }
      const result = await options.gdprCoordinator.deletePersona({
        personaPubkey: body.data.personaPubkey,
        issuedAtMs: body.data.issuedAt,
        signatureHex: body.data.signature,
      });
      if (!result.ok) {
        log('delete_reject', { reason: result.reason });
        sendJson(res, result.reason === 'bad_signature' ? 401 : 503, result);
        return;
      }
      log('delete', {});
      sendJson(res, 200, result);
      return;
    }

    // ---- OPERATOR admin routes (Plan 39 P12). Fail-closed on every axis. ----
    if (pathname === '/persona/admin/suspend' || pathname === '/persona/admin/unsuspend' || pathname === '/persona/admin/status') {
      const adminSecret = (options.adminSecret ?? '').trim();
      if (!adminSecret) {
        // Unconfigured => refuse EVERY admin call with a machine-readable code; the
        // console shows this honestly instead of pretending the action happened.
        sendJson(res, 503, { ok: false, reason: 'admin_not_configured' });
        return;
      }
      if (!bearerMatches(readBearer(req), adminSecret)) {
        log('admin_reject', { reason: 'unauthorized' });
        sendJson(res, 401, { ok: false, reason: 'unauthorized' });
        return;
      }
      const body = AdminTargetSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      // Resolve @alias -> pubkey through the REAL registry (fail-closed on unknown).
      let personaPubkey = body.data.personaPubkey ?? null;
      if (!personaPubkey && body.data.alias) {
        const resolved = await service.resolve(body.data.alias);
        if (!resolved) { sendJson(res, 404, { ok: false, reason: 'not_found' }); return; }
        personaPubkey = resolved.personaPubkey;
      }
      if (!personaPubkey) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }

      if (pathname === '/persona/admin/status') {
        const status = await service.personaAdminStatus(personaPubkey);
        if (!status) { sendJson(res, 400, { ok: false, reason: 'bad_pubkey' }); return; }
        sendJson(res, 200, { ok: true, ...status });
        return;
      }
      if (pathname === '/persona/admin/suspend') {
        const result = await service.suspendPersona(personaPubkey);
        if (!result.ok) { sendJson(res, 400, { ok: false, reason: result.reason }); return; }
        log('admin_suspend', { alreadySuspended: result.alreadySuspended });
        sendJson(res, 200, { ok: true, personaPubkey: result.personaPubkey, alias: result.alias, alreadySuspended: result.alreadySuspended });
        return;
      }
      const result = await service.unsuspendPersona(personaPubkey);
      if (!result.ok) {
        const status = result.reason === 'not_registered' ? 409 : 400;
        log('admin_unsuspend_reject', { reason: result.reason });
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log('admin_unsuspend', { wasSuspended: result.wasSuspended });
      sendJson(res, 200, { ok: true, personaPubkey: result.personaPubkey, alias: result.alias, wasSuspended: result.wasSuspended });
      return;
    }

    if (pathname === '/persona/export') {
      const body = GdprBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      if (!options.gdprCoordinator) {
        sendJson(res, 503, { ok: false, reason: 'gdpr_export_not_configured' });
        return;
      }
      const result = await options.gdprCoordinator.exportPersona({
        personaPubkey: body.data.personaPubkey,
        issuedAtMs: body.data.issuedAt,
        signatureHex: body.data.signature,
      });
      if (!result.ok) {
        log('export_reject', { reason: result.reason });
        sendJson(res, result.reason === 'bad_signature' ? 401 : 503, result);
        return;
      }
      log('export', {});
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { ok: false, reason: 'not_found' });
  }

  const sweepTimer = setInterval(() => {
    void service.sweep();
    limiter.sweep();
  }, sweepMs);
  sweepTimer.unref?.();

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      const wsHost = host === '0.0.0.0' ? '127.0.0.1' : host;
      log('listening', { host, port });
      resolve({
        url: `http://${wsHost}:${port}`,
        port,
        close: () => new Promise<void>((r) => {
          clearInterval(sweepTimer);
          server.close(() => r());
        }),
      });
    });
  });
}
