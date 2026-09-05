/**
 * HTTP binding for the OPERATOR MODERATION CONSOLE (Plan 39 P12), mirroring
 * persona-service-http.ts: a thin node:http shell over the DI'd
 * OperatorConsoleService. Serves the self-contained static console page at
 * GET / and a JSON admin API under /api/*.
 *
 * SECURITY (binding):
 *  - EVERY /api route requires `Authorization: Bearer <operator secret>`,
 *    compared constant-time. Missing/wrong -> 401. NOTHING is ever served
 *    unauthenticated except the static page shell (which holds no data) and
 *    /healthz ({ok:true} only).
 *  - FAIL-CLOSED WHEN UNCONFIGURED: with no secret or no console service, every
 *    /api route answers 503 console_not_configured. No degraded open mode.
 *  - Default bind host is 127.0.0.1: exposing the admin surface beyond loopback
 *    is an explicit operator decision (put it behind your TLS edge/VPN).
 *  - No CORS headers: this is a same-origin admin surface, never a cross-origin
 *    API. NC-P1: no private mesh route is touched here.
 */

import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { OPERATOR_CONSOLE_PAGE_HTML } from './operator-console-page';
import { deriveClientAddress } from './client-address';
import type { OperatorConsoleService, ReportTriageStatus } from './operator-console';
import type { DmcaClaimStatus } from './dmca-intake';
import type { PersonaServiceServer } from './persona-service-http';
import type { OperatorAlert } from './operator-alerts';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REASON_CHARS = 500;

const ReasonSchema = z.string().min(1).max(MAX_REASON_CHARS);
const ReviewBodySchema = z.object({
  reportKey: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.enum(['reviewed', 'dismissed']),
  note: z.string().max(MAX_REASON_CHARS).optional(),
});
const TombstoneBodySchema = z.object({
  publicationId: z.string().min(1).max(256),
  postId: z.string().min(1).max(256),
  reason: ReasonSchema,
});
const FreezeBodySchema = z.object({
  publicationId: z.string().min(1).max(256),
  frozen: z.boolean(),
  reason: ReasonSchema,
});
const KillBodySchema = z.object({
  publicationId: z.string().min(1).max(256),
  reason: ReasonSchema,
});
const PersonaTargetSchema = z.object({
  personaPubkey: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  alias: z.string().min(1).max(64).optional(),
}).refine((v) => Boolean(v.personaPubkey) || Boolean(v.alias), { message: 'target_required' });
const PersonaActionSchema = PersonaTargetSchema.and(z.object({ reason: ReasonSchema }));
const DmcaClaimIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
const DmcaTakedownBodySchema = z.object({ claimId: DmcaClaimIdSchema, reason: ReasonSchema });
const DmcaCounterNoticeBodySchema = z.object({
  claimId: DmcaClaimIdSchema,
  statement: z.string().min(1).max(4096),
  signature: z.string().min(1).max(512),
});
const DmcaRejectBodySchema = z.object({ claimId: DmcaClaimIdSchema, reason: ReasonSchema });
/**
 * Plan 51 P4 revoke-credential body. The serial is the 64-hex revocation key; the
 * epoch is a bounded integer. NO account identifier is accepted or accepted-shaped
 * here: the enforcement lane operates on credential-serial evidence only.
 */
const RevokeCredentialBodySchema = z.object({
  serial: z.string().regex(/^[0-9a-f]{64}$/),
  epoch: z.number().int().min(0).max(100000),
  reason: ReasonSchema,
});

const DMCA_STATUSES: readonly DmcaClaimStatus[] = ['received', 'actioned', 'counter_noticed', 'rejected'];
const TRIAGE_STATUSES: readonly ReportTriageStatus[] = ['open', 'reviewed', 'dismissed', 'actioned'];
const REPORT_REASONS = ['spam', 'harassment', 'illegal', 'csam', 'violence', 'other'] as const;

export type OperatorConsoleServer = PersonaServiceServer;

export interface StartOperatorConsoleHttpOptions {
  /**
   * The console core, or null when the operator identity is not configured. With
   * null, every /api route answers 503 console_not_configured (fail-closed) and
   * the page renders that state honestly.
   */
  console: OperatorConsoleService | null;
  /** The operator bearer secret. Empty/absent => every /api route is 503. */
  consoleSecret?: string;
  port?: number;
  /** Defaults to 127.0.0.1 (loopback-only admin surface). */
  host?: string;
  /** Counts/paths only; never secrets or report bodies. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
  /** Identity-free safety alert snapshot. Failure propagates as an API error, never an empty success. */
  alerts?: () => Promise<readonly OperatorAlert[]>;
  /** Number of trusted reverse proxies used to derive the originating address. */
  trustedProxyHops?: number;
  authFailureLimit?: { max: number; windowMs: number };
  now?: () => number;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function bearerMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(secret, 'utf8').digest();
  return timingSafeEqual(a, b);
}

function readBearer(req: http.IncomingMessage): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const [scheme, ...rest] = value.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

/**
 * Read the request body up to the cap. Over the cap, the remaining bytes are
 * DRAINED (discarded without buffering) so the 413 response reaches the client
 * on a clean connection, and null is returned. The cap bounds memory; the drain
 * is itself bounded by the client's own upload.
 */
function readBody(req: http.IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    let overflowed = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      if (overflowed) return; // drain
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        overflowed = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(overflowed ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

/**
 * Discard an unread request body and wait for its end, so the error response is
 * written on a clean kept-alive socket (responding mid-upload makes node tear
 * the connection down and the client sees a hang-up instead of the status).
 */
function drain(req: http.IncomingMessage): Promise<void> {
  return new Promise((resolve) => {
    if (req.readableEnded || req.destroyed) { resolve(); return; }
    req.resume();
    req.once('end', resolve);
    req.once('error', () => resolve());
    req.once('close', () => resolve());
  });
}

export function startOperatorConsoleHttp(options: StartOperatorConsoleHttpOptions): Promise<OperatorConsoleServer> {
  const host = options.host ?? '127.0.0.1';
  const log = options.log ?? (() => {});
  const secret = (options.consoleSecret ?? '').trim();
  const configured = secret.length > 0 && options.console !== null;
  const now = options.now ?? (() => Date.now());
  const authLimit = options.authFailureLimit ?? { max: 10, windowMs: 60_000 };
  const authFailures = new Map<string, { count: number; resetAt: number }>();

  const requestClient = (req: http.IncomingMessage): string =>
    deriveClientAddress(req, options.trustedProxyHops ?? 0);

  const recordAuthFailure = (req: http.IncomingMessage): { limited: boolean; retryAfterSeconds: number } => {
    const key = requestClient(req);
    const nowMs = now();
    const prior = authFailures.get(key);
    const window = !prior || prior.resetAt <= nowMs
      ? { count: 0, resetAt: nowMs + authLimit.windowMs }
      : prior;
    window.count += 1;
    authFailures.set(key, window);
    return {
      limited: window.count > authLimit.max,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - nowMs) / 1000)),
    };
  };

  const server = http.createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { ok: false, reason: 'internal_error' });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://internal');
    const pathname = url.pathname;

    if (pathname === '/healthz') {
      if (method !== 'GET') { sendJson(res, 405, { ok: false, reason: 'method_not_allowed' }); return; }
      sendJson(res, 200, { ok: true });
      return;
    }

    // The static console shell (no data inside; everything loads via /api).
    if (pathname === '/' || pathname === '/console') {
      if (method !== 'GET') { sendJson(res, 405, { ok: false, reason: 'method_not_allowed' }); return; }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
      });
      res.end(OPERATOR_CONSOLE_PAGE_HTML);
      return;
    }

    if (!pathname.startsWith('/api/')) {
      await drain(req);
      sendJson(res, 404, { ok: false, reason: 'not_found' });
      return;
    }

    // FAIL-CLOSED: unconfigured console refuses every API call with honest copy.
    if (!configured) {
      await drain(req);
      log('console_reject', { reason: 'not_configured' });
      sendJson(res, 503, { ok: false, reason: 'console_not_configured' });
      return;
    }
    const console_ = options.console as OperatorConsoleService;

    if (!bearerMatches(readBearer(req), secret)) {
      await drain(req);
      const failure = recordAuthFailure(req);
      log('console_reject', {
        reason: failure.limited ? 'auth_rate_limited' : 'unauthorized',
        path: pathname,
      });
      if (failure.limited) {
        res.setHeader('Retry-After', String(failure.retryAfterSeconds));
        sendJson(res, 429, { ok: false, reason: 'auth_rate_limited' });
        return;
      }
      sendJson(res, 401, { ok: false, reason: 'unauthorized' });
      return;
    }

    // ---- Authenticated JSON API. ----

    if (method === 'GET' && pathname === '/api/status') {
      const [queue, audit, alerts] = await Promise.all([
        console_.queueStats(),
        console_.listAudit(1),
        options.alerts?.() ?? Promise.resolve([]),
      ]);
      sendJson(res, 200, {
        ok: true,
        operator: console_.operatorPublicKey(),
        personaAdmin: console_.hasPersonaAdmin() ? 'configured' : 'not_configured',
        queue,
        auditRows: audit.total,
        alerts,
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/alerts') {
      sendJson(res, 200, { ok: true, alerts: await (options.alerts?.() ?? Promise.resolve([])) });
      return;
    }

    if (method === 'GET' && pathname === '/api/reports') {
      const statusRaw = url.searchParams.get('status');
      const reasonRaw = url.searchParams.get('reason');
      const status = statusRaw && (TRIAGE_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw as ReportTriageStatus
        : undefined;
      const reason = reasonRaw && (REPORT_REASONS as readonly string[]).includes(reasonRaw)
        ? reasonRaw as typeof REPORT_REASONS[number]
        : undefined;
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const result = await console_.listReports({
        ...(status ? { status } : {}),
        ...(reason ? { reason } : {}),
        limit: Number.isFinite(limit) ? limit : 50,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (method === 'GET' && pathname === '/api/publications') {
      sendJson(res, 200, { ok: true, publications: await console_.listPublications() });
      return;
    }

    if (method === 'GET' && pathname === '/api/audit') {
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const beforeRaw = url.searchParams.get('before');
      const before = beforeRaw === null ? undefined : Number(beforeRaw);
      const result = await console_.listAudit(
        Number.isFinite(limit) ? limit : 50,
        before !== undefined && Number.isFinite(before) ? before : undefined,
      );
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (method === 'GET' && pathname === '/api/posts') {
      const publicationId = url.searchParams.get('publicationId') ?? undefined;
      const personaPubkey = url.searchParams.get('personaPubkey') ?? undefined;
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const result = await console_.listPosts({
        ...(publicationId ? { publicationId } : {}),
        ...(personaPubkey ? { personaPubkey } : {}),
        limit: Number.isFinite(limit) ? limit : 50,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    // CSAM lane: honest NCMEC queue state (real counts, or not_wired). Plan 39 P13.
    if (method === 'GET' && pathname === '/api/ncmec') {
      const counts = await console_.ncmecQueueCounts();
      sendJson(res, 200, { ok: true, wired: console_.hasNcmecQueue(), counts });
      return;
    }

    // DMCA lane: list received claims (real stored rows). Plan 39 P13.
    if (method === 'GET' && pathname === '/api/dmca') {
      const statusRaw = url.searchParams.get('status');
      const status = statusRaw && (DMCA_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw as DmcaClaimStatus
        : undefined;
      const limit = Number(url.searchParams.get('limit') ?? '100');
      const claims = await console_.listDmcaClaims({
        ...(status ? { status } : {}),
        limit: Number.isFinite(limit) ? limit : 100,
      });
      sendJson(res, 200, { ok: true, wired: console_.hasDmcaIntake(), claims });
      return;
    }

    if (method !== 'POST') {
      await drain(req);
      sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
      return;
    }

    const raw = await readBody(req);
    if (raw === null) { sendJson(res, 413, { ok: false, reason: 'body_too_large' }); return; }
    let parsed: unknown;
    try {
      parsed = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { ok: false, reason: 'bad_json' });
      return;
    }

    /** Map an action result to an honest response (the audit row rides along). */
    function sendAction(result: Awaited<ReturnType<OperatorConsoleService['tombstonePost']>>, event: string): void {
      if (result.ok) {
        log(event, { outcome: 'ok' });
        sendJson(res, 200, { ok: true, audit: result.audit });
        return;
      }
      log(event, { outcome: result.reason });
      const status = result.reason === 'unknown_publication' || result.reason === 'unknown_report' || result.reason === 'not_found'
        ? 404
        : result.reason === 'persona_admin_not_configured' || result.reason === 'unreachable'
          || result.reason === 'credential_revocation_not_configured'
          || result.reason === 'credential_revocation_unavailable'
          ? 503
          : result.reason === 'not_authorized' || result.reason === 'kill_not_honored'
            ? 409
            : 400;
      sendJson(res, status, { ok: false, reason: result.reason, audit: result.audit });
    }

    if (pathname === '/api/reports/review') {
      const body = ReviewBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      sendAction(await console_.reviewReport(body.data), 'report_review');
      return;
    }

    if (pathname === '/api/actions/tombstone') {
      const body = TombstoneBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      sendAction(await console_.tombstonePost(body.data), 'tombstone');
      return;
    }

    if (pathname === '/api/actions/freeze') {
      const body = FreezeBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      sendAction(await console_.setPostingFreeze(body.data), 'freeze');
      return;
    }

    if (pathname === '/api/actions/kill') {
      const body = KillBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      sendAction(await console_.killPublication(body.data), 'kill');
      return;
    }

    if (pathname === '/api/actions/suspend' || pathname === '/api/actions/unsuspend') {
      const body = PersonaActionSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = pathname === '/api/actions/suspend'
        ? await console_.suspendPersona(body.data)
        : await console_.unsuspendPersona(body.data);
      sendAction(result, pathname === '/api/actions/suspend' ? 'suspend' : 'unsuspend');
      return;
    }

    // Plan 51 P4 (AC-3): revoke an actioned credential serial. Admin-gated like
    // every other action; 503 when the revocation sink is not wired. Shows
    // credential-serial evidence ONLY -- never any account field.
    if (pathname === '/api/actions/revoke-credential') {
      const body = RevokeCredentialBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await console_.revokeCredentialSerial({
        serial: body.data.serial,
        epoch: body.data.epoch,
        reasonCode: body.data.reason,
      });
      sendAction(result, 'revoke_credential');
      return;
    }

    if (pathname === '/api/personas/status') {
      const body = PersonaTargetSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await console_.personaStatus(body.data);
      if (!result.ok) {
        const status = result.reason === 'not_found' ? 404
          : result.reason === 'persona_admin_not_configured' || result.reason === 'unreachable' ? 503
            : 400;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      sendJson(res, 200, { ok: true, status: result.status, posts: result.posts });
      return;
    }

    // CSAM lane: export the queued NCMEC records as NDJSON for manual filing (Plan 39 P13/P15).
    if (pathname === '/api/ncmec/export') {
      const result = await console_.exportNcmecQueue();
      if (!result) { sendJson(res, 503, { ok: false, reason: 'ncmec_not_configured' }); return; }
      log('ncmec_export', { count: result.count });
      sendJson(res, 200, { ok: true, count: result.count, ndjson: result.ndjson });
      return;
    }

    if (pathname === '/api/dmca/takedown') {
      const body = DmcaTakedownBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await console_.dmcaTakedown(body.data);
      if (result.ok) {
        log('dmca_takedown', { tombstoned: result.tombstonedPostIds.length, unresolved: result.unresolved.length });
        sendJson(res, 200, { ok: true, audit: result.audit, tombstonedPostIds: result.tombstonedPostIds, unresolved: result.unresolved });
        return;
      }
      log('dmca_takedown', { outcome: result.reason });
      const status = result.reason === 'unknown_claim' ? 404 : result.reason === 'dmca_not_configured' ? 503 : 400;
      sendJson(res, status, { ok: false, reason: result.reason, audit: result.audit });
      return;
    }

    if (pathname === '/api/dmca/counter-notice') {
      const body = DmcaCounterNoticeBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      sendAction(await console_.dmcaCounterNotice(body.data), 'dmca_counter_notice');
      return;
    }

    if (pathname === '/api/dmca/reject') {
      const body = DmcaRejectBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      sendAction(await console_.dmcaRejectClaim(body.data), 'dmca_reject');
      return;
    }

    sendJson(res, 404, { ok: false, reason: 'not_found' });
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      log('listening', { host, port, configured });
      resolve({
        url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
        port,
        close: () => new Promise<void>((r) => {
          server.close(() => r());
        }),
      });
    });
  });
}
