/**
 * HTTP surface for the Meerkat push gateway (Plan 42 P4).
 *
 * Implements the plan's /v1/push/* API over the PushGatewayService. The authentication
 * model follows the address model exactly:
 *
 *   - registration mutations (create/rotate token, revoke, mint/revoke capability) are
 *     authorized by the REGISTRATION SECRET, carried in the Authorization: Bearer header
 *     and proven against the stored secret hash inside the store's constant-time check;
 *   - a wake is authorized by the raw WAKE CAPABILITY (the capability hash IS the bearer)
 *     in the Authorization: Bearer header, rate-limited per capability;
 *   - status is authorized by the same wake capability that could have sent the wake.
 *
 * Responses are bounded machine-readable JSON. A wake status is provider_accepted /
 * provider_rejected / unknown ONLY, never "delivered" (NC-42.4). No response body or
 * error carries a device identity, community id, message id, or plaintext (NC-42.3).
 */

import type http from 'node:http';
import { applyHttpCors } from './http-cors';
import {
  PushGatewayInputError,
  type EnqueueWakeResult,
  type PushGatewayMutationResult,
  type PushGatewayService,
} from './push-gateway';
import type { PushWakeUrgency } from './push-providers';
import type { PushCapabilityScope, PushProvider } from './push-store';

const MAX_JSON_BODY_BYTES = 16 * 1024;
const ROUTE_PREFIX = '/v1/push';

export interface PushGatewayHttpOptions {
  service: PushGatewayService;
  corsAllowedOrigins?: readonly string[];
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

export type PushGatewayHttpHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

/** Build the /v1/push/* request handler. Returns false-through is not needed; the caller routes by prefix. */
export function createPushGatewayHttpHandler(options: PushGatewayHttpOptions): PushGatewayHttpHandler {
  const { service } = options;
  const log = options.log ?? (() => {});
  const cors = options.corsAllowedOrigins ?? [];

  return (req, res) => {
    void handle(req, res, service, cors, log).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
      else res.end();
    });
  };
}

/** True when the path belongs to this handler, so a composite server can route to it. */
export function isPushGatewayPath(pathname: string): boolean {
  return pathname === ROUTE_PREFIX || pathname.startsWith(`${ROUTE_PREFIX}/`);
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
  cors: readonly string[],
  log: (event: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  const method = req.method ?? 'GET';
  const pathname = routePath(req);

  if (!applyHttpCors(req, res, {
    allowedOrigins: cors,
    methods: ['POST', 'DELETE', 'GET', 'OPTIONS'],
    headers: ['authorization', 'content-type', 'idempotency-key'],
  })) {
    sendJson(res, 403, { error: 'origin_not_allowed' });
    return;
  }
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }

  try {
    if (pathname === `${ROUTE_PREFIX}/registrations` && method === 'POST') {
      await handleRegister(req, res, service);
      return;
    }
    const revokeRegistrationMatch = matchPath(pathname, `${ROUTE_PREFIX}/registrations/`);
    if (revokeRegistrationMatch !== null && method === 'DELETE') {
      await handleRevokeRegistration(req, res, service, revokeRegistrationMatch);
      return;
    }
    if (pathname === `${ROUTE_PREFIX}/capabilities` && method === 'POST') {
      await handleMintCapability(req, res, service);
      return;
    }
    const revokeCapabilityMatch = matchPath(pathname, `${ROUTE_PREFIX}/capabilities/`);
    if (revokeCapabilityMatch !== null && method === 'DELETE') {
      await handleRevokeCapability(req, res, service, revokeCapabilityMatch);
      return;
    }
    if (pathname === `${ROUTE_PREFIX}/wakes` && method === 'POST') {
      await handleWake(req, res, service);
      return;
    }
    const statusMatch = matchPath(pathname, `${ROUTE_PREFIX}/status/`);
    if (statusMatch !== null && method === 'GET') {
      await handleStatus(req, res, service, statusMatch);
      return;
    }
    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    if (error instanceof PushGatewayInputError) {
      sendJson(res, 400, { error: 'invalid_request', reason: error.message });
      return;
    }
    log('push_gateway_error', { event: 'unhandled' });
    sendJson(res, 500, { error: 'internal_error' });
  }
}

async function handleRegister(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
): Promise<void> {
  const bearer = bearerToken(req);
  if (!bearer) return unauthorized(res);
  const body = await readJsonObject(req);
  if (!body) return badRequest(res);
  const rotate = body.rotate === true;
  const idempotencyKey = idempotency(req, body);
  if (!idempotencyKey) return badRequest(res);

  if (rotate) {
    const result = await service.rotateToken({
      registrationId: requireString(body, 'registrationId') ?? '',
      registrationSecret: bearer,
      providerToken: requireString(body, 'providerToken') ?? '',
      tokenTtlMs: requireNumber(body, 'tokenTtlMs') ?? 0,
      idempotencyKey,
    });
    return respondMutation(res, result, (value) => ({
      registrationIdHash: value.registrationIdHash,
      tokenGenerations: value.tokenGenerations.map((token) => token.tokenGeneration),
    }));
  }

  const result = await service.registerInstallation({
    registrationId: requireString(body, 'registrationId') ?? '',
    registrationSecret: bearer,
    provider: requireProvider(body) ?? 'apns',
    providerToken: requireString(body, 'providerToken') ?? '',
    tokenTtlMs: requireNumber(body, 'tokenTtlMs') ?? 0,
    registrationTtlMs: requireNumber(body, 'registrationTtlMs') ?? 0,
    idempotencyKey,
  });
  respondMutation(res, result, (value) => ({
    registrationIdHash: value.registrationIdHash,
    provider: value.provider,
    expiresAt: value.expiresAt,
  }));
}

async function handleRevokeRegistration(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
  registrationId: string,
): Promise<void> {
  const bearer = bearerToken(req);
  if (!bearer) return unauthorized(res);
  const body = await readJsonObject(req).catch(() => ({}));
  const idempotencyKey = idempotency(req, body ?? {});
  if (!idempotencyKey) return badRequest(res);
  const result = await service.revokeRegistration({
    registrationId,
    registrationSecret: bearer,
    idempotencyKey,
  });
  respondMutation(res, result, () => ({ revoked: true }));
}

async function handleMintCapability(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
): Promise<void> {
  const bearer = bearerToken(req);
  if (!bearer) return unauthorized(res);
  const body = await readJsonObject(req);
  if (!body) return badRequest(res);
  const idempotencyKey = idempotency(req, body);
  if (!idempotencyKey) return badRequest(res);
  const result = await service.mintCapability({
    registrationId: requireString(body, 'registrationId') ?? '',
    registrationSecret: bearer,
    capability: requireString(body, 'capability') ?? '',
    scope: requireScope(body) ?? 'sync_wake',
    ttlMs: requireNumber(body, 'ttlMs') ?? 0,
    idempotencyKey,
  });
  respondMutation(res, result, (value) => value);
}

async function handleRevokeCapability(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
  capability: string,
): Promise<void> {
  const bearer = bearerToken(req);
  if (!bearer) return unauthorized(res);
  const body = await readJsonObject(req);
  if (!body) return badRequest(res);
  const idempotencyKey = idempotency(req, body);
  if (!idempotencyKey) return badRequest(res);
  const result = await service.revokeCapability({
    registrationId: requireString(body, 'registrationId') ?? '',
    registrationSecret: bearer,
    capability,
    idempotencyKey,
  });
  respondMutation(res, result, (value) => value);
}

async function handleWake(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
): Promise<void> {
  const capability = bearerToken(req);
  if (!capability) return unauthorized(res);
  const body = await readJsonObject(req);
  if (!body) return badRequest(res);
  const idempotencyKey = idempotency(req, body);
  if (!idempotencyKey) return badRequest(res);
  const payloadBase64 = requireString(body, 'payload');
  if (!payloadBase64) return badRequest(res);
  let payload: Uint8Array;
  try {
    payload = new Uint8Array(Buffer.from(payloadBase64, 'base64url'));
  } catch {
    return badRequest(res);
  }
  const result: EnqueueWakeResult = await service.enqueueWake({
    capability,
    scope: requireScope(body) ?? 'sync_wake',
    payload,
    urgency: requireUrgency(body) ?? 'high',
    idempotencyKey,
  });
  switch (result.status) {
    case 'accepted':
      sendJson(res, 202, { status: 'queued', attemptId: result.attemptId });
      return;
    case 'rate_limited':
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      sendJson(res, 429, { error: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds });
      return;
    case 'not_found':
      sendJson(res, 404, { error: 'unknown_capability' });
      return;
    case 'unavailable':
      sendJson(res, 503, { error: 'wake_unavailable' });
      return;
  }
}

async function handleStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: PushGatewayService,
  attemptId: string,
): Promise<void> {
  const capability = bearerToken(req);
  if (!capability) return unauthorized(res);
  const status = await service.getAttemptStatus({ attemptId, capability });
  if (!status) {
    sendJson(res, 404, { error: 'unknown_attempt' });
    return;
  }
  // provider_accepted | provider_rejected | unknown ONLY. Never "delivered" (NC-42.4).
  sendJson(res, 200, {
    attemptId: status.attemptId,
    providerStatus: status.providerStatus,
    terminal: status.terminal,
  });
}

// ---- shared helpers ----------------------------------------------------

function routePath(req: http.IncomingMessage): string {
  const host = req.headers.host ?? 'localhost';
  return new URL(req.url ?? '/', `http://${host}`).pathname;
}

function matchPath(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const tail = pathname.slice(prefix.length);
  if (tail.length === 0 || tail.includes('/')) return null;
  return decodeURIComponent(tail);
}

function bearerToken(req: http.IncomingMessage): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([A-Za-z0-9_-]{16,512})$/u.exec(value.trim());
  return match ? match[1]! : null;
}

function idempotency(req: http.IncomingMessage, body: Record<string, unknown>): string | null {
  const header = req.headers['idempotency-key'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const candidate = typeof headerValue === 'string' && headerValue.trim().length > 0
    ? headerValue.trim()
    : requireString(body, 'idempotencyKey');
  if (!candidate || candidate.length < 8 || candidate.length > 256) return null;
  return candidate;
}

async function readJsonObject(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES) return null;
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = raw.length === 0 ? {} : JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function requireString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function requireNumber(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function requireProvider(body: Record<string, unknown>): PushProvider | null {
  const value = body.provider;
  return value === 'apns' || value === 'fcm' || value === 'webpush' ? value : null;
}

function requireScope(body: Record<string, unknown>): PushCapabilityScope | null {
  const value = body.scope;
  return value === 'sync_wake' || value === 'call_wake' ? value : null;
}

function requireUrgency(body: Record<string, unknown>): PushWakeUrgency | null {
  const value = body.urgency;
  return value === 'high' || value === 'normal' ? value : null;
}

function respondMutation<Value, Projected>(
  res: http.ServerResponse,
  result: PushGatewayMutationResult<Value>,
  project: (value: Value) => Projected,
): void {
  switch (result.status) {
    case 'ok':
      sendJson(res, 200, { status: 'ok', ...project(result.value) });
      return;
    case 'conflict':
      sendJson(res, 409, { error: 'conflict' });
      return;
    case 'unauthorized':
      sendJson(res, 403, { error: 'unauthorized' });
      return;
    case 'not_found':
      sendJson(res, 404, { error: 'not_found' });
      return;
  }
}

function unauthorized(res: http.ServerResponse): void {
  sendJson(res, 401, { error: 'auth_required' });
}

function badRequest(res: http.ServerResponse): void {
  sendJson(res, 400, { error: 'invalid_request' });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}
