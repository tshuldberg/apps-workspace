/**
 * Optional room-token HTTP mount for the community-node listener (Plan 25 WP-25E).
 *
 * This module is never imported by the slim relay server. A configured mount exposes:
 *   POST /api/rooms/token
 *   POST /api/rooms/:communityId/:roomId/revoke
 *
 * The token route accepts at most 16 KiB. The revoke route uses the exact operator
 * bearer-secret digest comparison used by operator-console-http.ts. Logs contain only
 * actions and typed reason codes, never membership ids, room ids, bearer values, or JWTs.
 */

import type http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { LiveKitAccessTokenMinter } from './livekit-token-minter';
import type { AdmissionGenerationStore } from './room-admission-store';
import {
  InMemoryRoomAdmissionNonceStore,
  RoomTokenService,
  type LiveKitTokenMinter,
  type RoomAdmissionNonceStore,
  type RoomMembershipVerifier,
  type RoomTokenRejectReason,
} from './room-token-service';

const MAX_TOKEN_BODY_BYTES = 16 * 1024;
const MAX_ROOM_SCOPE_CHARS = 256;
const TOKEN_PATH = /^\/api\/rooms\/token$/u;
const REVOKE_PATH = /^\/api\/rooms\/([^/]+)\/([^/]+)\/revoke$/u;
const BODY_TOO_LARGE = Symbol('room_token_body_too_large');

export interface RoomTokenLiveKitConfig {
  apiKey?: string;
  apiSecret?: string;
  serverSecretHex?: string;
}

export interface RoomTokenOptions {
  admissionStore: AdmissionGenerationStore;
  membershipVerifier: RoomMembershipVerifier;
  /** All three fields are required. Any missing or invalid field keeps the mount fail-closed. */
  livekit?: RoomTokenLiveKitConfig;
  /** Test/embedding seam. Configuration is still required when a fake minter is supplied. */
  livekitTokenMinter?: LiveKitTokenMinter;
  nonceStore?: RoomAdmissionNonceStore;
  /** Required only by the operator revoke route. Missing means 503, never open access. */
  operatorSecret?: string;
  nowMs?: () => number;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

export type RoomTokenRouteResult = 'handled' | 'unmatched';
export type RoomTokenHttpHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => Promise<RoomTokenRouteResult>;

interface RoomTokenRouteRuntime {
  service: RoomTokenService | null;
  operatorSecret: string | null;
  log: (event: string, detail?: Record<string, unknown>) => void;
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

async function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number,
): Promise<unknown | typeof BODY_TOO_LARGE> {
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    total += buffer.length;
    if (total > maxBytes) {
      tooLarge = true;
    } else if (!tooLarge) {
      chunks.push(buffer);
    }
  }
  if (tooLarge) return BODY_TOO_LARGE;
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

// This is intentionally identical to operator-console-http.ts's operator secret scheme.
function bearerMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(secret, 'utf8').digest();
  return timingSafeEqual(a, b);
}

// This is intentionally identical to operator-console-http.ts's bearer parser.
function readBearer(req: http.IncomingMessage): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const [scheme, ...rest] = value.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

function configuredValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildRuntime(options: RoomTokenOptions): RoomTokenRouteRuntime {
  const nowMs = options.nowMs ?? (() => Date.now());
  const nonceStore = options.nonceStore ?? new InMemoryRoomAdmissionNonceStore(nowMs);
  const livekit = options.livekit;
  let service: RoomTokenService | null = null;
  if (
    livekit
    && configuredValue(livekit.apiKey)
    && configuredValue(livekit.apiSecret)
    && configuredValue(livekit.serverSecretHex)
  ) {
    try {
      service = new RoomTokenService({
        admissionStore: options.admissionStore,
        membershipVerifier: options.membershipVerifier,
        hasSeenNonce: nonceStore.hasSeenNonce.bind(nonceStore),
        recordNonce: nonceStore.recordNonce.bind(nonceStore),
        livekitTokenMinter: options.livekitTokenMinter
          ?? new LiveKitAccessTokenMinter(livekit.apiKey, livekit.apiSecret),
        serverSecretHex: livekit.serverSecretHex,
        nowMs,
      });
    } catch {
      service = null;
    }
  }
  return {
    service,
    operatorSecret: configuredValue(options.operatorSecret) ? options.operatorSecret : null,
    log: options.log ?? (() => {}),
  };
}

const runtimeCache = new WeakMap<RoomTokenOptions, RoomTokenRouteRuntime>();

function runtimeFor(options: RoomTokenOptions): RoomTokenRouteRuntime {
  const existing = runtimeCache.get(options);
  if (existing) return existing;
  const runtime = buildRuntime(options);
  runtimeCache.set(options, runtime);
  return runtime;
}

function statusForReject(reason: RoomTokenRejectReason): number {
  switch (reason) {
    case 'not_member':
    case 'removed':
    case 'permissions_exceed_role':
      return 403;
    case 'expired':
    case 'invalid_signature':
      return 401;
    case 'replayed_nonce':
    case 'stale_epoch':
    case 'stale_descriptor_revision':
      return 409;
    case 'unavailable':
    case 'nonce_check_failed':
    case 'admission_store_unavailable':
    case 'token_mint_unavailable':
      return 503;
    default:
      return 400;
  }
}

function safeDecode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0
      && decoded.length <= MAX_ROOM_SCOPE_CHARS
      && decoded.trim().length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

async function handleTokenRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  runtime: RoomTokenRouteRuntime,
): Promise<void> {
  if (!runtime.service) {
    runtime.log('room_token_reject', { action: 'token', reason: 'not_configured' });
    sendJson(res, 503, { error: 'not_configured' });
    return;
  }
  const raw = await readJsonBody(req, MAX_TOKEN_BODY_BYTES);
  if (raw === BODY_TOO_LARGE) {
    runtime.log('room_token_reject', { action: 'token', reason: 'too_large' });
    sendJson(res, 413, { error: 'too_large' });
    return;
  }
  if (raw === undefined) {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }
  const result = await runtime.service.requestRoomToken(raw);
  if (!result.ok) {
    runtime.log('room_token_reject', { action: 'token', reason: result.reason });
    sendJson(res, statusForReject(result.reason), {
      error: 'admission_rejected',
      reason: result.reason,
    });
    return;
  }
  runtime.log('room_token_minted', { permissionCount: result.permissions.length });
  sendJson(res, 200, {
    token: result.token,
    roomName: result.roomName,
    expiresAt: result.expiresAt,
    permissions: result.permissions,
  });
}

async function handleRevokeRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  runtime: RoomTokenRouteRuntime,
  communityId: string,
  roomId: string,
): Promise<void> {
  if (!runtime.service || !runtime.operatorSecret) {
    runtime.log('room_token_reject', { action: 'revoke', reason: 'not_configured' });
    sendJson(res, 503, { error: 'not_configured' });
    return;
  }
  if (!bearerMatches(readBearer(req), runtime.operatorSecret)) {
    runtime.log('room_token_reject', { action: 'revoke', reason: 'unauthorized' });
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  try {
    const result = await runtime.service.revokeRoomAdmissions(communityId, roomId);
    runtime.log('room_admissions_revoked', { generation: result.generation });
    sendJson(res, 200, result);
  } catch {
    runtime.log('room_token_reject', { action: 'revoke', reason: 'admission_store_unavailable' });
    sendJson(res, 503, {
      error: 'admission_store_unavailable',
      reason: 'admission_store_unavailable',
    });
  }
}

async function routeRoomTokenRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  runtime: RoomTokenRouteRuntime,
): Promise<RoomTokenRouteResult> {
  const pathname = (req.url ?? '/').split('?')[0] ?? '/';
  const method = req.method ?? 'GET';

  if (!pathname.startsWith('/api/rooms/')) return 'unmatched';

  if (TOKEN_PATH.test(pathname)) {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return 'handled';
    }
    await handleTokenRequest(req, res, runtime);
    return 'handled';
  }

  const revoke = REVOKE_PATH.exec(pathname);
  if (revoke) {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return 'handled';
    }
    const communityId = safeDecode(revoke[1]!);
    const roomId = safeDecode(revoke[2]!);
    if (!communityId || !roomId) {
      sendJson(res, 400, { error: 'bad_request' });
      return 'handled';
    }
    await handleRevokeRequest(req, res, runtime, communityId, roomId);
    return 'handled';
  }

  return 'unmatched';
}

/** Direct archive-intake-style route entry point. Runtime state is cached per options object. */
export function handleRoomTokenRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: RoomTokenOptions,
): Promise<RoomTokenRouteResult> {
  return routeRoomTokenRequest(req, res, runtimeFor(options));
}

/** Preferred mount form: constructs the service and nonce cache once per listener. */
export function createRoomTokenHttpHandler(options: RoomTokenOptions): RoomTokenHttpHandler {
  const runtime = buildRuntime(options);
  return (req, res) => routeRoomTokenRequest(req, res, runtime);
}
