/**
 * HTTP surface for the humanity verification service (Plan 24, P1). Kept in a SEPARATE
 * module from humanity-service.ts so the pure, DI'd core stays framework-agnostic and
 * testable without a socket, mirroring how public-directory-node.ts pairs a pure node
 * with a thin ws/http server.
 *
 * Routes (all JSON):
 *   POST /humanity/challenge  { kind }                     -> { challengeId, kind, nonce }
 *   POST /humanity/issue      { challengeId, attestation } -> { tokens }        (batch)
 *   POST /humanity/redeem     { token, attemptId?, requestDigest? } -> { ok } | { reason }
 *   GET  /healthz                                          -> { ok, ...bounded counts }
 *
 * The client IP for the issue rate-window is derived EXACTLY like the relay
 * (derivePublicClientKey). Bodies are size-capped and JSON-validated with zod; a bad body
 * is a 400, never a throw. Nothing here logs a token, an attestation, or an IP.
 */

import http from 'node:http';
import { z } from 'zod';
import { derivePublicClientKey } from './public-read-limiter';
import {
  HUMANITY_CHALLENGE_KINDS,
  type HumanityService,
} from './humanity-service';
import { PostgresStoreUnavailableError } from './postgres/store-context';
import type { HealthEndpoints } from './service-health';

const MAX_BODY_BYTES = 128 * 1024;

const ChallengeBodySchema = z.object({ kind: z.enum(['app-attest', 'play-integrity', 'turnstile']) });
const IssueBodySchema = z.object({
  challengeId: z.string().min(1).max(256),
  // The attestation shape is verifier-specific and opaque here; the verifier validates it.
  attestation: z.unknown(),
});
const RedeemBodySchema = z.object({
  token: z.string().min(1).max(64 * 1024),
  attemptId: z.string().regex(/^[0-9a-f]{64}$/u).optional(),
  requestDigest: z.string().regex(/^[0-9a-f]{64}$/u).optional(),
}).superRefine((value, context) => {
  if (Boolean(value.attemptId) !== Boolean(value.requestDigest)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'attempt_and_digest_required_together' });
  }
});

export interface HumanityServiceServer {
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

export interface StartHumanityServiceOptions {
  service: HumanityService;
  port?: number;
  host?: string;
  /** Counts/paths only; never token/attestation/IP contents. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
  /** Sweep cadence (expired challenges/spent hashes/IP windows). Default 60s. */
  sweepMs?: number;
  /**
   * Exact number of reverse-proxy hops controlled by this deployment. Default 0:
   * forwarding headers are ignored and the direct socket address keys IP limits.
   */
  trustedProxyHops?: number;
  /**
   * Plan 44 WP-4A liveness/readiness. When present, GET /livez and GET /readyz are
   * answered on this listener with honest dependency probes for the service's mode.
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

/**
 * Permissive CORS so a browser (meerkat-web) can call issue/redeem cross-origin.
 * Safe to allow `*`: the service uses no cookies/credentials -- the humanity token
 * rides in the JSON body, and every route still validates fail-closed. Access is
 * gated by the token itself, never by the Origin header.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    ...CORS_HEADERS,
  });
  res.end(json);
}

/** Start the verification service HTTP server. Resolves once listening. */
export function startHumanityService(options: StartHumanityServiceOptions): Promise<HumanityServiceServer> {
  const { service } = options;
  const host = options.host ?? '0.0.0.0';
  const log = options.log ?? (() => {});
  const sweepMs = options.sweepMs ?? 60_000;
  const trustedProxyHops = Number.isFinite(options.trustedProxyHops)
    ? Math.max(0, Math.floor(options.trustedProxyHops ?? 0))
    : 0;

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

    // Infra liveness/readiness answer before anything else (no credentials, no Origin).
    if (options.healthEndpoints && options.healthEndpoints.handle(req, res)) return;

    // CORS preflight for the browser cross-origin issue/redeem calls.
    if (method === 'OPTIONS') {
      res.writeHead(204, { ...CORS_HEADERS, 'Content-Length': '0' });
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/healthz') {
      const stats = await service.stats();
      sendJson(res, 200, { ok: true, ...stats });
      return;
    }

    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
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

    if (pathname === '/humanity/challenge') {
      const body = ChallengeBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.challenge(body.data.kind);
      if (!result.ok) { log('challenge_reject', { reason: result.reason }); sendJson(res, 400, { ok: false, reason: result.reason }); return; }
      log('challenge', { kind: result.kind });
      sendJson(res, 200, { ok: true, challengeId: result.challengeId, kind: result.kind, nonce: result.nonce });
      return;
    }

    if (pathname === '/humanity/issue') {
      const body = IssueBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.issue({
        challengeId: body.data.challengeId,
        attestation: body.data.attestation,
        clientIp: derivePublicClientKey(req, trustedProxyHops),
      });
      if (!result.ok) {
        log('issue_reject', { reason: result.reason });
        const status = result.reason === 'ip_rate_limited' || result.reason === 'key_cap_exceeded' ? 429 : 400;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log('issue', { count: result.tokens.length });
      sendJson(res, 200, { ok: true, tokens: result.tokens });
      return;
    }

    if (pathname === '/humanity/redeem') {
      const body = RedeemBodySchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = body.data.attemptId && body.data.requestDigest
        ? await service.redeemRegistration({
          token: body.data.token,
          attemptId: body.data.attemptId,
          requestDigest: body.data.requestDigest,
        })
        : await service.redeem(body.data.token);
      if (!result.ok) {
        log('redeem_reject', { reason: result.reason });
        const status = result.reason === 'attempt_conflict'
          || result.reason === 'request_digest_mismatch'
          ? 409
          : 200;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log('redeem', {});
      sendJson(res, 200, 'replayed' in result
        ? { ok: true, replayed: result.replayed }
        : { ok: true });
      return;
    }

    sendJson(res, 404, { ok: false, reason: 'not_found' });
  }

  const sweepTimer = setInterval(() => { void service.sweep(); }, sweepMs);
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

/** The supported challenge kinds, re-exported for the bin/env wiring. */
export { HUMANITY_CHALLENGE_KINDS };
