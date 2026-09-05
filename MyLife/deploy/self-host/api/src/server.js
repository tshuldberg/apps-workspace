import crypto from 'node:crypto';
import { promisify } from 'node:util';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import { logger, requestLogger } from './logger.js';

const scryptAsync = promisify(crypto.scrypt);

/**
 * Require a non-empty environment variable or throw at startup.
 */
function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required but not set. Set it in your environment or .env file.`);
  }
  return value;
}

/**
 * Read an optional env var, warning if missing. Returns empty string if unset.
 */
function optionalEnv(name, { warnIfMissing = false } = {}) {
  const value = process.env[name]?.trim();
  if (!value) {
    if (warnIfMissing) {
      logger.warn({ env: name }, `${name} is not set. Related functionality will be disabled.`);
    }
    return '';
  }
  return value;
}

const { Pool } = pg;

const PORT = Number(process.env.PORT ?? '8787');
const DATABASE_URL = requireEnv('DATABASE_URL');
const STORAGE_HEALTHCHECK_URL = process.env.STORAGE_HEALTHCHECK_URL ?? 'http://minio:9000/minio/health/live';
const ENTITLEMENT_SYNC_KEY = optionalEnv('MYLIFE_ENTITLEMENT_SYNC_KEY', { warnIfMissing: true });
const ENTITLEMENT_ISSUER_KEY = optionalEnv('MYLIFE_ENTITLEMENT_ISSUER_KEY', { warnIfMissing: true });
const SELF_HOST_ADMIN_EMAIL = requireEnv('SELF_HOST_ADMIN_EMAIL');
const SELF_HOST_ADMIN_PASSWORD = requireEnv('SELF_HOST_ADMIN_PASSWORD');
const FEDERATION_SERVER = normalizeServerName(optionalEnv('MYLIFE_FEDERATION_SERVER'));
const FEDERATION_SHARED_KEY = optionalEnv('MYLIFE_FEDERATION_SHARED_KEY', { warnIfMissing: true });
const FEDERATION_SHARED_KEYS = parseFederationSharedKeys(optionalEnv('MYLIFE_FEDERATION_SHARED_KEYS'));
const FEDERATION_DISPATCH_KEY = optionalEnv('MYLIFE_FEDERATION_DISPATCH_KEY', { warnIfMissing: true });
const FEDERATION_ALLOW_INSECURE_HTTP = (process.env.MYLIFE_FEDERATION_ALLOW_INSECURE_HTTP ?? 'false').toLowerCase() === 'true';
const FEDERATION_MAX_ATTEMPTS = Math.max(1, Number(process.env.MYLIFE_FEDERATION_MAX_ATTEMPTS ?? '6') || 6);
const FEDERATION_MAX_CLOCK_SKEW_MS = Math.max(30_000, Number(process.env.MYLIFE_FEDERATION_MAX_CLOCK_SKEW_MS ?? '30000') || 30_000);
const FEDERATION_DISPATCH_DEFAULT_LIMIT = Math.max(
  1,
  Number(process.env.MYLIFE_FEDERATION_DISPATCH_LIMIT ?? '25') || 25,
);
const ACTOR_IDENTITY_SECRET = (
  optionalEnv('MYLIFE_ACTOR_IDENTITY_SECRET')
  || optionalEnv('MYLIFE_ENTITLEMENT_ISSUER_KEY')
  || optionalEnv('MYLIFE_ENTITLEMENT_SYNC_KEY')
);

const CORS_ORIGIN = requireEnv('CORS_ORIGIN');
const allowedOrigins = CORS_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must contain at least one valid origin.');
}

// ── Session token store ─────────────────────────────────────────────────────
// Maps token string -> { expiresAt: number (ms epoch) }
const SESSION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const sessionTokens = new Map();

function issueSessionToken() {
  const token = crypto.randomBytes(32).toString('hex');
  sessionTokens.set(token, { expiresAt: Date.now() + SESSION_TOKEN_TTL_MS });
  return token;
}

function validateSessionToken(token) {
  const entry = sessionTokens.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    sessionTokens.delete(token);
    return false;
  }
  return true;
}

function revokeSessionToken(token) {
  return sessionTokens.delete(token);
}

// Clean up expired tokens every 15 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sessionTokens) {
    if (now > entry.expiresAt) {
      sessionTokens.delete(token);
    }
  }
}, 15 * 60 * 1000).unref();

// ── Password hashing ────────────────────────────────────────────────────────
// Hash the admin password at startup for timing-safe comparison on login.
let adminPasswordHash;
async function hashAdminPassword() {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(SELF_HOST_ADMIN_PASSWORD, salt, 64);
  adminPasswordHash = { salt, hash: derived };
}

async function verifyPassword(candidate) {
  const derived = await scryptAsync(candidate, adminPasswordHash.salt, 64);
  return crypto.timingSafeEqual(adminPasswordHash.hash, derived);
}

const app = express();
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Security headers — must be first middleware
app.use(helmet({
  // CSP is handled by the reverse proxy / client; disable helmet's default CSP
  // so it doesn't conflict with custom per-route policies.
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({
  limit: '1mb',
  verify(req, _res, buf) {
    req.rawBody = buf.toString('utf8');
  },
}));

// Request logging -- logs method, path, statusCode, responseTime for every request.
app.use(requestLogger);

// Routes that bypass session token validation (they use their own auth).
const PUBLIC_ROUTES = new Set([
  '/health',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/entitlements/sync',
  '/api/federation/inbox/messages',
  '/api/federation/dispatch',
]);

app.use((req, res, next) => {
  if (PUBLIC_ROUTES.has(req.path)) return next();

  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.slice(7);
  if (!validateSessionToken(token)) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  next();
});

// ── Rate limiting ───────────────────────────────────────────────────────────
const rateLimitMessage = { error: 'Too many requests. Please try again later.' };

// Global: 100 requests per 15 minutes per IP.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
}));

// Auth: 5 attempts per 15 minutes per IP (brute-force protection).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});
app.use('/api/auth/session', authLimiter);

// Sensitive endpoints: 20 requests per 15 minutes per IP.
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});
app.use('/api/entitlements', sensitiveLimiter);
app.use('/api/federation/inbox', sensitiveLimiter);

function nowIso() {
  return new Date().toISOString();
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function unauthorized(res, message) {
  return res.status(401).json({ error: message });
}

function forbidden(res, message) {
  return res.status(403).json({ error: message });
}

function conflict(res, message) {
  return res.status(409).json({ error: message });
}

function parseString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseMaybeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBoolean(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function canonicalizeActorIdentity(payload) {
  return JSON.stringify({
    userId: payload.userId,
    issuedAt: payload.issuedAt,
  });
}

function signActorIdentityPayload(payloadBase64) {
  if (!ACTOR_IDENTITY_SECRET) return null;
  return crypto
    .createHmac('sha256', ACTOR_IDENTITY_SECRET)
    .update(payloadBase64)
    .digest('base64url');
}

function issueActorIdentityToken(userId, issuedAt = nowIso()) {
  if (!ACTOR_IDENTITY_SECRET) return null;

  const payloadBase64 = toBase64Url(canonicalizeActorIdentity({
    userId,
    issuedAt,
  }));
  const signature = signActorIdentityPayload(payloadBase64);
  if (!signature) return null;

  return `v1.${payloadBase64}.${signature}`;
}

function verifyActorIdentityToken(token) {
  if (!ACTOR_IDENTITY_SECRET) {
    return { ok: false, reason: 'missing_secret' };
  }

  const parsedToken = parseString(token);
  if (!parsedToken) {
    return { ok: false, reason: 'invalid_format' };
  }

  const parts = parsedToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return { ok: false, reason: 'invalid_format' };
  }

  const payloadBase64 = parts[1];
  const providedSignature = parts[2];
  const expectedSignature = signActorIdentityPayload(payloadBase64);
  if (!expectedSignature) {
    return { ok: false, reason: 'missing_secret' };
  }

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(fromBase64Url(payloadBase64));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  const userId = parseString(parsedPayload?.userId);
  const issuedAt = parseString(parsedPayload?.issuedAt);
  if (!userId || !issuedAt) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const issuedAtDate = new Date(issuedAt);
  if (Number.isNaN(issuedAtDate.getTime())) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    userId,
    issuedAt: issuedAtDate.toISOString(),
  };
}

function isLegacyUserIdFallbackAllowed(now = Date.now()) {
  const explicit = parseBoolean(process.env.MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK);
  if (explicit !== undefined) {
    return explicit;
  }

  const strictMode = parseBoolean(process.env.MYLIFE_ACTOR_IDENTITY_STRICT_MODE);
  if (strictMode === true) {
    return false;
  }

  const fallbackUntil = parseString(process.env.MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL);
  if (!fallbackUntil) {
    return true;
  }

  const parsed = new Date(fallbackUntil);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return now <= parsed.getTime();
}

function resolveActorIdentity({ token, userId, required = false }) {
  const parsedToken = parseString(token);
  const parsedUserId = parseString(userId);

  if (parsedToken) {
    const verified = verifyActorIdentityToken(parsedToken);
    if (!verified.ok || !verified.userId) {
      return {
        ok: false,
        status: 401,
        error: `Invalid actor identity token (${verified.reason ?? 'unknown'}).`,
      };
    }

    if (parsedUserId && parsedUserId !== verified.userId) {
      return {
        ok: false,
        status: 403,
        error: 'actor token user does not match requested userId.',
      };
    }

    return {
      ok: true,
      userId: verified.userId,
      source: 'actor_token',
    };
  }

  if (parsedUserId) {
    if (!isLegacyUserIdFallbackAllowed()) {
      return {
        ok: false,
        status: 401,
        error: 'actorToken is required for this endpoint.',
      };
    }

    return {
      ok: true,
      userId: parsedUserId,
      source: 'legacy_user_id',
    };
  }

  if (required) {
    return {
      ok: false,
      status: 400,
      error: 'A userId or actorToken is required.',
    };
  }

  return {
    ok: false,
    status: 400,
    error: 'A userId or actorToken is required.',
  };
}

function parseInviteStatus(value) {
  return value === 'pending'
    || value === 'accepted'
    || value === 'revoked'
    || value === 'declined'
    ? value
    : null;
}

function parseInviteStatuses(value) {
  if (!value || typeof value !== 'string') {
    return ['pending'];
  }

  const statuses = value
    .split(',')
    .map((item) => parseInviteStatus(item.trim()))
    .filter(Boolean);

  return statuses.length > 0 ? statuses : ['pending'];
}

function parseVisibility(value) {
  return value === 'private' || value === 'friends' || value === 'public' ? value : null;
}

function parseObjectType(value) {
  return value === 'book_rating'
    || value === 'book_review'
    || value === 'list_item'
    || value === 'generic'
    ? value
    : null;
}

function parseMessageContentType(value) {
  if (value === undefined || value === null) {
    return 'text/plain';
  }

  return value === 'text/plain' || value === 'application/e2ee+ciphertext'
    ? value
    : null;
}

function parseMessageContent(value) {
  if (typeof value !== 'string') return null;
  if (value.length < 1 || value.length > 8000) return null;
  return value;
}

function parseBodyInteger(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function normalizeServerName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return new URL(trimmed).host.toLowerCase();
    }
  } catch {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function parseFederationSharedKeys(value) {
  const map = new Map();
  if (!value || typeof value !== 'string') {
    return map;
  }

  for (const entry of value.split(',')) {
    const [rawServer, ...secretParts] = entry.split('=');
    const server = normalizeServerName(rawServer);
    const secret = secretParts.join('=').trim();
    if (!server || !secret) {
      continue;
    }
    map.set(server, secret);
  }

  return map;
}

function parseUserAddress(userId) {
  const parsedUserId = parseString(userId);
  if (!parsedUserId) {
    return { userId: null, server: null };
  }

  const atIndex = parsedUserId.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === parsedUserId.length - 1) {
    return { userId: parsedUserId, server: null };
  }

  const server = normalizeServerName(parsedUserId.slice(atIndex + 1));
  return {
    userId: parsedUserId,
    server,
  };
}

function resolveFederationSecret(serverName) {
  const normalized = normalizeServerName(serverName);
  if (!normalized) return null;
  return FEDERATION_SHARED_KEYS.get(normalized) ?? (FEDERATION_SHARED_KEY || null);
}

function buildFederationInboxUrl(serverName) {
  const normalized = normalizeServerName(serverName);
  if (!normalized) return null;
  const protocol = FEDERATION_ALLOW_INSECURE_HTTP ? 'http' : 'https';
  return `${protocol}://${normalized}/api/federation/inbox/messages`;
}

function createFederationSignature(secret, timestamp, rawBody) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

function safeCompareHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  try {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function isTimestampWithinSkew(timestamp) {
  if (typeof timestamp !== 'string') return false;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return false;
  return Math.abs(Date.now() - parsed.getTime()) <= FEDERATION_MAX_CLOCK_SKEW_MS;
}

function computeFederationRetryAt(attempts) {
  const boundedAttempts = Math.max(0, Math.min(attempts, 8));
  const delayMs = Math.min(60 * 60 * 1000, 15_000 * (2 ** boundedAttempts));
  return new Date(Date.now() + delayMs).toISOString();
}

function truncateError(value) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.slice(0, 500);
}

function parseBoundedInteger(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function parseOptionalIsoDate(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapInviteRow(row) {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status,
    message: row.message,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    respondedAt: row.responded_at ? toIsoString(row.responded_at) : null,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id,
    clientMessageId: row.client_message_id,
    fromUserId: row.sender_user_id,
    toUserId: row.recipient_user_id,
    contentType: row.content_type,
    content: row.content,
    createdAt: toIsoString(row.created_at),
    readAt: row.read_at ? toIsoString(row.read_at) : null,
  };
}

const MESSAGE_SELECT_COLUMNS = `
  id,
  client_message_id,
  sender_user_id,
  recipient_user_id,
  content_type,
  content,
  created_at,
  read_at
`;

async function getMessageByClientMessageId(clientMessageId) {
  if (!clientMessageId) return null;

  const existing = await pool.query(
    `SELECT ${MESSAGE_SELECT_COLUMNS}
       FROM friend_messages
      WHERE client_message_id = $1
      LIMIT 1`,
    [clientMessageId],
  );

  return existing.rows[0] ?? null;
}

async function insertFriendMessageRow(input) {
  const inserted = await pool.query(
    `INSERT INTO friend_messages (
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
     RETURNING ${MESSAGE_SELECT_COLUMNS}`,
    [
      input.id,
      input.clientMessageId ?? null,
      input.fromUserId,
      input.toUserId,
      input.contentType,
      input.content,
      input.createdAt ?? null,
    ],
  );

  return inserted.rows[0];
}

async function queueFederationOutboxMessage(input) {
  await pool.query(
    `INSERT INTO federation_message_outbox (
       id,
       message_id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       recipient_server,
       content_type,
       content,
       message_created_at,
       status,
       attempts,
       next_attempt_at,
       last_error,
       last_http_status,
       delivered_at,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz,
       'pending', 0, NOW(), NULL, NULL, NULL, NOW(), NOW()
     )
     ON CONFLICT (client_message_id, recipient_server) DO UPDATE SET
       message_id = EXCLUDED.message_id,
       sender_user_id = EXCLUDED.sender_user_id,
       recipient_user_id = EXCLUDED.recipient_user_id,
       content_type = EXCLUDED.content_type,
       content = EXCLUDED.content,
       message_created_at = EXCLUDED.message_created_at,
       status = 'pending',
       attempts = 0,
       next_attempt_at = NOW(),
       last_error = NULL,
       last_http_status = NULL,
       delivered_at = NULL,
       updated_at = NOW()`,
    [
      crypto.randomUUID(),
      input.messageId,
      input.clientMessageId,
      input.fromUserId,
      input.toUserId,
      input.recipientServer,
      input.contentType,
      input.content,
      input.createdAt,
    ],
  );
}

async function areUsersFriends(userA, userB) {
  const result = await pool.query(
    `SELECT 1
       FROM friendships
      WHERE status = 'accepted'
        AND (
          (user_a = $1 AND user_b = $2)
          OR
          (user_a = $2 AND user_b = $1)
        )
      LIMIT 1`,
    [userA, userB],
  );

  return Boolean(result.rows[0]);
}

async function dispatchFederationOutbox(limit = FEDERATION_DISPATCH_DEFAULT_LIMIT) {
  const summary = {
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    reason: null,
  };

  if (!FEDERATION_SERVER) {
    summary.reason = 'federation_server_not_configured';
    return summary;
  }

  const due = await pool.query(
    `SELECT
       id,
       message_id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       recipient_server,
       content_type,
       content,
       message_created_at,
       attempts
     FROM federation_message_outbox
     WHERE status IN ('pending', 'retry')
       AND next_attempt_at <= NOW()
     ORDER BY next_attempt_at ASC, created_at ASC
     LIMIT $1`,
    [limit],
  );

  for (const row of due.rows) {
    summary.processed += 1;

    const recipientServer = normalizeServerName(row.recipient_server);
    const sharedSecret = resolveFederationSecret(recipientServer);
    if (!recipientServer || !sharedSecret) {
      const nextAttempts = Number(row.attempts ?? 0) + 1;
      await pool.query(
        `UPDATE federation_message_outbox
            SET status = 'failed',
                attempts = $2,
                next_attempt_at = NOW(),
                last_error = $3,
                last_http_status = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [
          row.id,
          nextAttempts,
          !recipientServer ? 'invalid_recipient_server' : 'missing_federation_shared_key',
        ],
      );
      summary.failed += 1;
      continue;
    }

    const endpoint = buildFederationInboxUrl(recipientServer);
    if (!endpoint) {
      const nextAttempts = Number(row.attempts ?? 0) + 1;
      await pool.query(
        `UPDATE federation_message_outbox
            SET status = 'failed',
                attempts = $2,
                next_attempt_at = NOW(),
                last_error = $3,
                last_http_status = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, nextAttempts, 'invalid_recipient_server'],
      );
      summary.failed += 1;
      continue;
    }

    const body = JSON.stringify({
      id: row.message_id,
      clientMessageId: row.client_message_id,
      fromUserId: row.sender_user_id,
      toUserId: row.recipient_user_id,
      contentType: row.content_type,
      content: row.content,
      createdAt: toIsoString(row.message_created_at),
      senderServer: FEDERATION_SERVER,
    });
    const timestamp = nowIso();
    const signature = createFederationSignature(sharedSecret, timestamp, body);
    const nextAttempts = Number(row.attempts ?? 0) + 1;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mylife-federation-server': FEDERATION_SERVER,
          'x-mylife-federation-timestamp': timestamp,
          'x-mylife-federation-signature': signature,
        },
        body,
        cache: 'no-store',
      });

      if (response.ok || response.status === 409) {
        await pool.query(
          `UPDATE federation_message_outbox
              SET status = 'sent',
                  attempts = $2,
                  last_error = NULL,
                  last_http_status = $3,
                  delivered_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1`,
          [row.id, nextAttempts, response.status],
        );
        summary.sent += 1;
        continue;
      }

      const detail = truncateError(await response.text().catch(() => `HTTP ${response.status}`))
        || `HTTP ${response.status}`;
      const terminal = response.status >= 400
        && response.status < 500
        && response.status !== 408
        && response.status !== 409
        && response.status !== 429;

      if (terminal || nextAttempts >= FEDERATION_MAX_ATTEMPTS) {
        await pool.query(
          `UPDATE federation_message_outbox
              SET status = 'failed',
                  attempts = $2,
                  next_attempt_at = NOW(),
                  last_error = $3,
                  last_http_status = $4,
                  updated_at = NOW()
            WHERE id = $1`,
          [row.id, nextAttempts, detail, response.status],
        );
        summary.failed += 1;
      } else {
        await pool.query(
          `UPDATE federation_message_outbox
              SET status = 'retry',
                  attempts = $2,
                  next_attempt_at = $3::timestamptz,
                  last_error = $4,
                  last_http_status = $5,
                  updated_at = NOW()
            WHERE id = $1`,
          [row.id, nextAttempts, computeFederationRetryAt(nextAttempts), detail, response.status],
        );
        summary.retried += 1;
      }
    } catch (error) {
      const detail = truncateError(error instanceof Error ? error.message : String(error));
      if (nextAttempts >= FEDERATION_MAX_ATTEMPTS) {
        await pool.query(
          `UPDATE federation_message_outbox
              SET status = 'failed',
                  attempts = $2,
                  next_attempt_at = NOW(),
                  last_error = $3,
                  last_http_status = NULL,
                  updated_at = NOW()
            WHERE id = $1`,
          [row.id, nextAttempts, detail || 'network_error'],
        );
        summary.failed += 1;
      } else {
        await pool.query(
          `UPDATE federation_message_outbox
              SET status = 'retry',
                  attempts = $2,
                  next_attempt_at = $3::timestamptz,
                  last_error = $4,
                  last_http_status = NULL,
                  updated_at = NOW()
            WHERE id = $1`,
          [row.id, nextAttempts, computeFederationRetryAt(nextAttempts), detail || 'network_error'],
        );
        summary.retried += 1;
      }
    }
  }

  return summary;
}

async function isStorageHealthy() {
  try {
    const response = await fetch(STORAGE_HEALTHCHECK_URL, {
      method: 'GET',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

app.get('/health', async (_req, res) => {
  let dbHealthy = false;
  let storageHealthy = false;

  try {
    await pool.query('SELECT 1');
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  storageHealthy = await isStorageHealthy();

  const ok = dbHealthy && storageHealthy;
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    timestamp: nowIso(),
    services: {
      db: dbHealthy ? 'ok' : 'error',
      storage: storageHealthy ? 'ok' : 'error',
    },
  });
});

app.get('/api/entitlements/sync', async (req, res) => {
  if (ENTITLEMENT_SYNC_KEY) {
    const provided = req.header('x-entitlement-sync-key');
    if (!provided || provided !== ENTITLEMENT_SYNC_KEY) {
      return unauthorized(res, 'Invalid sync key.');
    }
  }

  const result = await pool.query(
    `SELECT token, entitlements_json, updated_at
       FROM entitlements
      WHERE id = 'current'
      LIMIT 1`,
  );

  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ error: 'No entitlement found.' });
  }

  return res.json({
    token: row.token,
    entitlements: row.entitlements_json,
    syncedAt: nowIso(),
  });
});

app.post('/api/auth/session', async (req, res) => {
  const email = parseString(req.body?.email);
  const password = parseString(req.body?.password);

  if (!email || !password) {
    return badRequest(res, 'email and password are required.');
  }

  // Timing-safe: always verify the hash even if the email doesn't match,
  // so the response time doesn't leak which field was wrong.
  const passwordValid = await verifyPassword(password);
  if (email !== SELF_HOST_ADMIN_EMAIL || !passwordValid) {
    return unauthorized(res, 'Invalid credentials.');
  }

  const accessToken = issueSessionToken();
  return res.json({
    accessToken,
    expiresAt: new Date(Date.now() + SESSION_TOKEN_TTL_MS).toISOString(),
    user: {
      id: 'self-host-admin',
      email,
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    revokeSessionToken(authHeader.slice(7));
  }
  return res.json({ ok: true });
});

app.post('/api/identity/actor/issue', (req, res) => {
  const userId = parseString(req.body?.userId);
  if (!userId) {
    return badRequest(res, 'userId is required.');
  }

  const actorToken = issueActorIdentityToken(userId);
  if (!actorToken) {
    return res.status(500).json({ error: 'Actor identity secret is not configured.' });
  }

  return res.json({
    ok: true,
    userId,
    actorToken,
    issuedAt: nowIso(),
  });
});

app.post('/api/entitlements/issue', async (req, res) => {
  if (ENTITLEMENT_ISSUER_KEY) {
    const provided = req.header('x-entitlement-issuer-key');
    if (!provided || provided !== ENTITLEMENT_ISSUER_KEY) {
      return unauthorized(res, 'Invalid issuer key.');
    }
  }

  const entitlements = req.body?.entitlements;
  if (!entitlements || typeof entitlements !== 'object') {
    return badRequest(res, 'entitlements object is required.');
  }

  const token = parseString(req.body?.token) ?? JSON.stringify(entitlements);

  await pool.query(
    `INSERT INTO entitlements (id, token, entitlements_json, updated_at)
     VALUES ('current', $1, $2::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE
       SET token = EXCLUDED.token,
           entitlements_json = EXCLUDED.entitlements_json,
           updated_at = NOW()`,
    [token, JSON.stringify(entitlements)],
  );

  return res.status(201).json({
    token,
    entitlements,
    issuedAt: nowIso(),
  });
});

app.get('/api/friends/invites', async (req, res) => {
  const identity = resolveActorIdentity({
    token: req.query.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.query.userId,
    required: true,
  });
  if (!identity.ok || !identity.userId) {
    return res.status(identity.status ?? 400).json({ error: identity.error });
  }
  const userId = identity.userId;

  const direction = parseString(req.query.direction) ?? 'both';
  if (direction !== 'incoming' && direction !== 'outgoing' && direction !== 'both') {
    return badRequest(res, 'direction must be incoming, outgoing, or both.');
  }
  const statuses = parseInviteStatuses(parseString(req.query.status));

  const incomingResult = direction === 'incoming' || direction === 'both'
    ? await pool.query(
      `SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
         FROM friend_invites
        WHERE to_user_id = $1
          AND status = ANY($2::text[])
        ORDER BY created_at DESC`,
      [userId, statuses],
    )
    : { rows: [] };

  const outgoingResult = direction === 'outgoing' || direction === 'both'
    ? await pool.query(
      `SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
         FROM friend_invites
        WHERE from_user_id = $1
          AND status = ANY($2::text[])
        ORDER BY created_at DESC`,
      [userId, statuses],
    )
    : { rows: [] };

  return res.json({
    userId,
    incoming: incomingResult.rows.map(mapInviteRow),
    outgoing: outgoingResult.rows.map(mapInviteRow),
  });
});

app.post('/api/friends/invites', async (req, res) => {
  const fromIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.fromUserId,
    required: true,
  });
  if (!fromIdentity.ok || !fromIdentity.userId) {
    return res.status(fromIdentity.status ?? 400).json({ error: fromIdentity.error });
  }

  const fromUserId = fromIdentity.userId;
  const toUserId = parseString(req.body?.toUserId);
  if (!fromUserId || !toUserId) {
    return badRequest(res, 'fromUserId and toUserId are required.');
  }
  if (fromUserId === toUserId) {
    return badRequest(res, 'fromUserId and toUserId must be different.');
  }

  const inviteId = parseString(req.body?.id) ?? crypto.randomUUID();
  const message = parseMaybeString(req.body?.message);

  const inserted = await pool.query(
    `INSERT INTO friend_invites (
        id,
        from_user_id,
        to_user_id,
        status,
        message,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW())
      RETURNING id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at`,
    [inviteId, fromUserId, toUserId, message],
  );

  return res.status(201).json({
    ok: true,
    invite: mapInviteRow(inserted.rows[0]),
  });
});

app.post('/api/friends/invites/:inviteId/accept', async (req, res) => {
  const inviteId = parseString(req.params.inviteId);
  if (!inviteId) {
    return badRequest(res, 'inviteId is required.');
  }

  const actorIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.actorUserId,
    required: true,
  });
  if (!actorIdentity.ok || !actorIdentity.userId) {
    return res.status(actorIdentity.status ?? 400).json({ error: actorIdentity.error });
  }
  const actorUserId = actorIdentity.userId;

  const updateInvite = await pool.query(
    `UPDATE friend_invites
        SET status = 'accepted',
            updated_at = NOW(),
            responded_at = NOW()
      WHERE id = $1
        AND status = 'pending'
        AND to_user_id = $2
    RETURNING id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at`,
    [inviteId, actorUserId],
  );

  const invite = updateInvite.rows[0];
  if (!invite) {
    return res.status(404).json({ error: 'Invite not found or not pending.' });
  }

  await pool.query(
    `INSERT INTO friendships (user_a, user_b, status, created_at)
     VALUES ($1, $2, 'accepted', NOW()), ($2, $1, 'accepted', NOW())
     ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'accepted'`,
    [invite.from_user_id, invite.to_user_id],
  );

  return res.json({
    ok: true,
    invite: mapInviteRow(invite),
  });
});

app.post('/api/friends/invites/:inviteId/decline', async (req, res) => {
  const inviteId = parseString(req.params.inviteId);
  if (!inviteId) {
    return badRequest(res, 'inviteId is required.');
  }

  const actorIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.actorUserId,
    required: true,
  });
  if (!actorIdentity.ok || !actorIdentity.userId) {
    return res.status(actorIdentity.status ?? 400).json({ error: actorIdentity.error });
  }
  const actorUserId = actorIdentity.userId;

  const updated = await pool.query(
    `UPDATE friend_invites
        SET status = 'declined',
            updated_at = NOW(),
            responded_at = NOW()
      WHERE id = $1
        AND status = 'pending'
        AND to_user_id = $2
    RETURNING id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at`,
    [inviteId, actorUserId],
  );

  const invite = updated.rows[0];
  if (!invite) {
    return res.status(404).json({ error: 'Invite not found or not pending.' });
  }

  return res.json({
    ok: true,
    invite: mapInviteRow(invite),
  });
});

app.post('/api/friends/invites/:inviteId/revoke', async (req, res) => {
  const inviteId = parseString(req.params.inviteId);
  if (!inviteId) {
    return badRequest(res, 'inviteId is required.');
  }

  const actorIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.actorUserId,
    required: true,
  });
  if (!actorIdentity.ok || !actorIdentity.userId) {
    return res.status(actorIdentity.status ?? 400).json({ error: actorIdentity.error });
  }
  const actorUserId = actorIdentity.userId;

  const updated = await pool.query(
    `UPDATE friend_invites
        SET status = 'revoked',
            updated_at = NOW(),
            responded_at = NOW()
      WHERE id = $1
        AND status = 'pending'
        AND from_user_id = $2
    RETURNING id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at`,
    [inviteId, actorUserId],
  );

  const invite = updated.rows[0];
  if (!invite) {
    return res.status(404).json({ error: 'Invite not found or not pending.' });
  }

  return res.json({
    ok: true,
    invite: mapInviteRow(invite),
  });
});

app.get('/api/friends', async (req, res) => {
  const identity = resolveActorIdentity({
    token: req.query.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.query.userId,
    required: true,
  });
  if (!identity.ok || !identity.userId) {
    return res.status(identity.status ?? 400).json({ error: identity.error });
  }
  const userId = identity.userId;

  const result = await pool.query(
    `SELECT
       user_a,
       user_b,
       status,
       created_at
     FROM friendships
     WHERE user_a = $1
       AND status = 'accepted'
     ORDER BY user_b ASC`,
    [userId],
  );

  return res.json({
    userId,
    friends: result.rows.map((row) => ({
      userId: row.user_a,
      friendUserId: row.user_b,
      status: row.status,
      sourceInviteId: null,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.created_at),
      displayName: null,
      handle: null,
      avatarUrl: null,
    })),
  });
});

app.delete('/api/friends', async (req, res) => {
  const identity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.userId,
    required: true,
  });
  if (!identity.ok || !identity.userId) {
    return res.status(identity.status ?? 400).json({ error: identity.error });
  }

  const userId = identity.userId;
  const friendUserId = parseString(req.body?.friendUserId);
  if (!userId || !friendUserId) {
    return badRequest(res, 'userId and friendUserId are required.');
  }

  await pool.query(
    `DELETE FROM friendships
      WHERE (user_a = $1 AND user_b = $2)
         OR (user_a = $2 AND user_b = $1)`,
    [userId, friendUserId],
  );

  return res.json({
    ok: true,
    userId,
    friendUserId,
  });
});

app.post('/api/messages', async (req, res) => {
  const fromIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.fromUserId,
    required: true,
  });
  if (!fromIdentity.ok || !fromIdentity.userId) {
    return res.status(fromIdentity.status ?? 400).json({ error: fromIdentity.error });
  }

  const fromUserId = fromIdentity.userId;
  const toUserId = parseString(req.body?.toUserId);
  const contentType = parseMessageContentType(req.body?.contentType);
  const content = parseMessageContent(req.body?.content);
  const clientMessageId = parseMaybeString(req.body?.clientMessageId);
  const effectiveClientMessageId = clientMessageId ?? crypto.randomUUID();

  if (!fromUserId || !toUserId || !contentType || !content) {
    return badRequest(
      res,
      'fromUserId, toUserId, contentType, and content are required.',
    );
  }
  if (fromUserId === toUserId) {
    return badRequest(res, 'fromUserId and toUserId must be different.');
  }

  const parsedFrom = parseUserAddress(fromUserId);
  const parsedTo = parseUserAddress(toUserId);
  const senderUserId = parsedFrom.userId;
  const recipientUserId = parsedTo.userId;
  if (!senderUserId || !recipientUserId) {
    return badRequest(res, 'fromUserId and toUserId are invalid.');
  }

  if (
    parsedFrom.server
    && FEDERATION_SERVER
    && parsedFrom.server !== FEDERATION_SERVER
  ) {
    return badRequest(
      res,
      `fromUserId must belong to this server (${FEDERATION_SERVER}).`,
    );
  }

  if (parsedTo.server && !FEDERATION_SERVER) {
    return badRequest(
      res,
      'MYLIFE_FEDERATION_SERVER must be configured to address remote recipients.',
    );
  }

  const isRemoteRecipient = Boolean(
    parsedTo.server
    && FEDERATION_SERVER
    && parsedTo.server !== FEDERATION_SERVER,
  );
  const recipientServer = isRemoteRecipient ? parsedTo.server : null;

  const friends = await areUsersFriends(senderUserId, recipientUserId);
  if (!friends) {
    return forbidden(res, 'Users must be accepted friends before sending messages.');
  }

  if (clientMessageId) {
    const existingRow = await getMessageByClientMessageId(clientMessageId);
    if (existingRow) {
      if (
        existingRow.sender_user_id !== senderUserId
        || existingRow.recipient_user_id !== recipientUserId
      ) {
        return conflict(
          res,
          'clientMessageId already exists for a different sender/recipient pair.',
        );
      }

      if (recipientServer) {
        await queueFederationOutboxMessage({
          messageId: existingRow.id,
          clientMessageId: existingRow.client_message_id,
          fromUserId: existingRow.sender_user_id,
          toUserId: existingRow.recipient_user_id,
          recipientServer,
          contentType: existingRow.content_type,
          content: existingRow.content,
          createdAt: toIsoString(existingRow.created_at),
        });
      }

      return res.status(200).json(mapMessageRow(existingRow));
    }
  }

  const insertedRow = await insertFriendMessageRow({
    id: crypto.randomUUID(),
    clientMessageId: effectiveClientMessageId,
    fromUserId: senderUserId,
    toUserId: recipientUserId,
    contentType,
    content,
    createdAt: null,
  });

  if (recipientServer) {
    await queueFederationOutboxMessage({
      messageId: insertedRow.id,
      clientMessageId: insertedRow.client_message_id,
      fromUserId: insertedRow.sender_user_id,
      toUserId: insertedRow.recipient_user_id,
      recipientServer,
      contentType: insertedRow.content_type,
      content: insertedRow.content,
      createdAt: toIsoString(insertedRow.created_at),
    });

    try {
      await dispatchFederationOutbox(1);
    } catch (error) {
      logger.error({ err: error }, 'Federation dispatch attempt failed');
    }
  }

  return res.status(201).json(mapMessageRow(insertedRow));
});

app.get('/api/messages', async (req, res) => {
  const viewerIdentity = resolveActorIdentity({
    token: req.query.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.query.viewerUserId,
    required: true,
  });
  if (!viewerIdentity.ok || !viewerIdentity.userId) {
    return res.status(viewerIdentity.status ?? 400).json({ error: viewerIdentity.error });
  }

  const viewerUserId = viewerIdentity.userId;
  const friendUserId = parseString(req.query.friendUserId);
  const limit = parseBoundedInteger(req.query.limit, 50, 1, 200);
  const since = parseOptionalIsoDate(req.query.since);

  if (!viewerUserId || !friendUserId) {
    return badRequest(res, 'viewerUserId and friendUserId query parameters are required.');
  }
  if (viewerUserId === friendUserId) {
    return badRequest(res, 'viewerUserId and friendUserId must be different.');
  }
  if (!limit) {
    return badRequest(res, 'limit must be an integer between 1 and 200.');
  }
  if (since === null) {
    return badRequest(res, 'since must be a valid ISO-8601 date-time when provided.');
  }

  const friends = await areUsersFriends(viewerUserId, friendUserId);
  if (!friends) {
    return forbidden(res, 'Users must be accepted friends before listing messages.');
  }

  const values = [viewerUserId, friendUserId];
  let sinceClause = '';
  if (since) {
    values.push(since);
    sinceClause = `AND fm.created_at > $${values.length}`;
  }
  values.push(limit);
  const limitParam = `$${values.length}`;

  const result = await pool.query(
    `WITH conversation AS (
       SELECT
         fm.id,
         fm.client_message_id,
         fm.sender_user_id,
         fm.recipient_user_id,
         fm.content_type,
         fm.content,
         fm.created_at,
         fm.read_at
       FROM friend_messages fm
       WHERE (
         (fm.sender_user_id = $1 AND fm.recipient_user_id = $2)
         OR
         (fm.sender_user_id = $2 AND fm.recipient_user_id = $1)
       )
       ${sinceClause}
       ORDER BY fm.created_at DESC
       LIMIT ${limitParam}
     )
     SELECT
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       created_at,
       read_at
     FROM conversation
     ORDER BY created_at ASC`,
    values,
  );

  return res.json({
    items: result.rows.map((row) => mapMessageRow(row)),
  });
});

app.post('/api/messages/:messageId/read', async (req, res) => {
  const messageId = parseString(req.params.messageId);
  if (!messageId) {
    return badRequest(res, 'messageId param is required.');
  }

  const viewerIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.viewerUserId,
    required: true,
  });
  if (!viewerIdentity.ok || !viewerIdentity.userId) {
    return res.status(viewerIdentity.status ?? 400).json({ error: viewerIdentity.error });
  }
  const viewerUserId = viewerIdentity.userId;

  const updated = await pool.query(
    `UPDATE friend_messages
        SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND recipient_user_id = $2
      RETURNING
        id,
        client_message_id,
        sender_user_id,
        recipient_user_id,
        content_type,
        content,
        created_at,
        read_at`,
    [messageId, viewerUserId],
  );

  const row = updated.rows[0];
  if (!row) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  return res.json({
    ok: true,
    message: mapMessageRow(row),
  });
});

app.get('/api/messages/inbox', async (req, res) => {
  const viewerIdentity = resolveActorIdentity({
    token: req.query.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.query.viewerUserId,
    required: true,
  });
  if (!viewerIdentity.ok || !viewerIdentity.userId) {
    return res.status(viewerIdentity.status ?? 400).json({ error: viewerIdentity.error });
  }

  const viewerUserId = viewerIdentity.userId;
  const limit = parseBoundedInteger(req.query.limit, 50, 1, 200);

  if (!viewerUserId) {
    return badRequest(res, 'viewerUserId query parameter is required.');
  }
  if (!limit) {
    return badRequest(res, 'limit must be an integer between 1 and 200.');
  }

  const result = await pool.query(
    `SELECT
       CASE
         WHEN fm.sender_user_id = $1 THEN fm.recipient_user_id
         ELSE fm.sender_user_id
       END AS friend_user_id,
       MAX(fm.created_at) AS last_message_at,
       (
         ARRAY_AGG(fm.content ORDER BY fm.created_at DESC)
       )[1] AS last_message_content,
       (
         ARRAY_AGG(fm.content_type ORDER BY fm.created_at DESC)
       )[1] AS last_message_content_type,
       SUM(
         CASE
           WHEN fm.recipient_user_id = $1 AND fm.read_at IS NULL THEN 1
           ELSE 0
         END
       )::INT AS unread_count
     FROM friend_messages fm
     WHERE fm.sender_user_id = $1
        OR fm.recipient_user_id = $1
     GROUP BY friend_user_id
     ORDER BY last_message_at DESC
     LIMIT $2`,
    [viewerUserId, limit],
  );

  return res.json({
    items: result.rows.map((row) => ({
      friendUserId: row.friend_user_id,
      lastMessageAt: toIsoString(row.last_message_at),
      lastMessageContent: row.last_message_content,
      lastMessageContentType: row.last_message_content_type,
      unreadCount: row.unread_count,
    })),
  });
});

app.post('/api/federation/inbox/messages', async (req, res) => {
  const senderServer = normalizeServerName(req.header('x-mylife-federation-server'));
  const timestamp = parseString(req.header('x-mylife-federation-timestamp'));
  const signature = parseString(req.header('x-mylife-federation-signature'));

  if (!senderServer || !timestamp || !signature) {
    return unauthorized(res, 'Missing federation auth headers.');
  }
  if (!isTimestampWithinSkew(timestamp)) {
    return unauthorized(res, 'Federation timestamp is outside the accepted skew window.');
  }

  const sharedSecret = resolveFederationSecret(senderServer);
  if (!sharedSecret) {
    return unauthorized(res, 'No federation shared secret configured for sender server.');
  }

  const rawBody = typeof req.rawBody === 'string'
    ? req.rawBody
    : JSON.stringify(req.body ?? {});
  const expectedSignature = createFederationSignature(sharedSecret, timestamp, rawBody);
  if (!safeCompareHex(signature, expectedSignature)) {
    return unauthorized(res, 'Invalid federation signature.');
  }

  const incomingId = parseMaybeString(req.body?.id) ?? crypto.randomUUID();
  const clientMessageId = parseString(req.body?.clientMessageId);
  const fromUserId = parseString(req.body?.fromUserId);
  const toUserId = parseString(req.body?.toUserId);
  const contentType = parseMessageContentType(req.body?.contentType);
  const content = parseMessageContent(req.body?.content);
  const createdAt = parseOptionalIsoDate(req.body?.createdAt);
  const senderServerInBody = normalizeServerName(parseMaybeString(req.body?.senderServer));

  if (!clientMessageId || !fromUserId || !toUserId || !contentType || !content) {
    return badRequest(
      res,
      'clientMessageId, fromUserId, toUserId, contentType, and content are required.',
    );
  }
  if (fromUserId === toUserId) {
    return badRequest(res, 'fromUserId and toUserId must be different.');
  }
  if (createdAt === null) {
    return badRequest(res, 'createdAt must be a valid ISO-8601 date-time when provided.');
  }
  if (senderServerInBody && senderServerInBody !== senderServer) {
    return forbidden(res, 'senderServer in body does not match sender header.');
  }

  const parsedFrom = parseUserAddress(fromUserId);
  const parsedTo = parseUserAddress(toUserId);
  if (parsedFrom.server && parsedFrom.server !== senderServer) {
    return forbidden(res, 'fromUserId server does not match sender header.');
  }
  if (parsedTo.server && !FEDERATION_SERVER) {
    return forbidden(res, 'MYLIFE_FEDERATION_SERVER must be configured for qualified recipients.');
  }
  if (
    parsedTo.server
    && FEDERATION_SERVER
    && parsedTo.server !== FEDERATION_SERVER
  ) {
    return forbidden(res, 'toUserId is not addressed to this server.');
  }

  const friends = await areUsersFriends(fromUserId, toUserId);
  if (!friends) {
    return forbidden(res, 'Users must be accepted friends before federation delivery.');
  }

  const receiptInsert = await pool.query(
    `INSERT INTO federation_inbox_receipts (
       sender_server,
       client_message_id,
       message_id,
       received_at
     )
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (sender_server, client_message_id) DO NOTHING
     RETURNING sender_server`,
    [senderServer, clientMessageId, incomingId],
  );

  if (!receiptInsert.rows[0]) {
    const existing = await getMessageByClientMessageId(clientMessageId);
    return res.status(200).json({
      ok: true,
      duplicate: true,
      message: existing ? mapMessageRow(existing) : null,
    });
  }

  try {
    const inserted = await insertFriendMessageRow({
      id: incomingId,
      clientMessageId,
      fromUserId,
      toUserId,
      contentType,
      content,
      createdAt: createdAt ?? null,
    });

    return res.status(201).json({
      ok: true,
      message: mapMessageRow(inserted),
    });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === '23505') {
      const existing = await getMessageByClientMessageId(clientMessageId);
      return res.status(200).json({
        ok: true,
        duplicate: true,
        message: existing ? mapMessageRow(existing) : null,
      });
    }
    throw error;
  }
});

app.post('/api/federation/dispatch', async (req, res) => {
  if (FEDERATION_DISPATCH_KEY) {
    const provided = req.header('x-federation-dispatch-key');
    if (!provided || provided !== FEDERATION_DISPATCH_KEY) {
      return unauthorized(res, 'Invalid federation dispatch key.');
    }
  }

  const limit = parseBodyInteger(
    req.body?.limit,
    FEDERATION_DISPATCH_DEFAULT_LIMIT,
    1,
    200,
  );
  if (limit === null) {
    return badRequest(res, 'limit must be an integer between 1 and 200.');
  }

  const summary = await dispatchFederationOutbox(limit);
  return res.json({
    ok: summary.failed === 0,
    server: FEDERATION_SERVER,
    ...summary,
  });
});

app.post('/api/share/events', async (req, res) => {
  const actorIdentity = resolveActorIdentity({
    token: req.body?.actorToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.body?.actorUserId,
    required: true,
  });
  if (!actorIdentity.ok || !actorIdentity.userId) {
    return res.status(actorIdentity.status ?? 400).json({ error: actorIdentity.error });
  }

  const actorUserId = actorIdentity.userId;
  const objectType = parseObjectType(req.body?.objectType);
  const objectId = parseString(req.body?.objectId);
  const visibility = parseVisibility(req.body?.visibility);

  if (!actorUserId || !objectType || !objectId || !visibility) {
    return badRequest(res, 'actorUserId, objectType, objectId, and visibility are required.');
  }

  const payload = req.body?.payload && typeof req.body.payload === 'object'
    ? req.body.payload
    : {};

  const id = parseString(req.body?.id) ?? crypto.randomUUID();

  const inserted = await pool.query(
    `INSERT INTO share_events (
        id,
        actor_user_id,
        object_type,
        object_id,
        visibility,
        payload,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      RETURNING id, actor_user_id, object_type, object_id, visibility, payload, created_at`,
    [id, actorUserId, objectType, objectId, visibility, JSON.stringify(payload)],
  );

  const row = inserted.rows[0];
  return res.status(201).json({
    ok: true,
    item: {
      id: row.id,
      actorUserId: row.actor_user_id,
      objectType: row.object_type,
      objectId: row.object_id,
      visibility: row.visibility,
      payload: row.payload,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.created_at),
    },
  });
});

app.get('/api/share/events', async (req, res) => {
  const viewerIdentity = resolveActorIdentity({
    token: req.query.viewerToken ?? req.header('x-actor-identity-token') ?? null,
    userId: req.query.viewerUserId,
    required: true,
  });
  if (!viewerIdentity.ok || !viewerIdentity.userId) {
    return res.status(viewerIdentity.status ?? 400).json({ error: viewerIdentity.error });
  }
  const viewerUserId = viewerIdentity.userId;

  const actorUserId = parseMaybeString(req.query.actorUserId);
  const objectType = req.query.objectType !== undefined
    ? parseObjectType(parseString(req.query.objectType))
    : undefined;
  const objectId = parseMaybeString(req.query.objectId);
  const limit = parseBoundedInteger(req.query.limit, 200, 1, 500);
  const offset = parseBoundedInteger(req.query.offset, 0, 0, 5000);

  if (req.query.objectType !== undefined && !objectType) {
    return badRequest(res, 'objectType is invalid.');
  }
  if (!limit || offset === null) {
    return badRequest(res, 'limit/offset are invalid.');
  }

  const values = [viewerUserId];
  const clauses = [
    `(
      se.visibility = 'public'
      OR se.actor_user_id = $1
      OR (
        se.visibility = 'friends'
        AND EXISTS (
          SELECT 1
          FROM friendships f
          WHERE f.user_a = $1
            AND f.user_b = se.actor_user_id
            AND f.status = 'accepted'
        )
      )
    )`,
  ];

  if (actorUserId) {
    values.push(actorUserId);
    clauses.push(`se.actor_user_id = $${values.length}`);
  }

  if (objectType) {
    values.push(objectType);
    clauses.push(`se.object_type = $${values.length}`);
  }

  if (objectId) {
    values.push(objectId);
    clauses.push(`se.object_id = $${values.length}`);
  }

  values.push(limit);
  const limitParam = `$${values.length}`;
  values.push(offset);
  const offsetParam = `$${values.length}`;

  const result = await pool.query(
    `SELECT
       se.id,
       se.actor_user_id,
       se.object_type,
       se.object_id,
       se.visibility,
       se.payload,
       se.created_at
     FROM share_events se
     WHERE ${clauses.join(' AND ')}
     ORDER BY se.created_at DESC
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values,
  );

  const items = result.rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    objectType: row.object_type,
    objectId: row.object_id,
    visibility: row.visibility,
    payload: row.payload,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.created_at),
  }));

  return res.json({ items });
});

app.use((error, _req, res, _next) => {
  logger.error({ err: error }, 'Unhandled API error');
  res.status(500).json({ error: 'Internal server error.' });
});

// Hash the admin password before accepting connections.
hashAdminPassword().then(() => {
  if (FEDERATION_ALLOW_INSECURE_HTTP) {
    logger.warn('MYLIFE_FEDERATION_ALLOW_INSECURE_HTTP is enabled. Federation requests will use plain HTTP. Never enable this in production.');
  }
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'MyLife self-host API listening');
  });
}).catch((err) => {
  logger.fatal({ err }, 'Failed to initialize');
  process.exit(1);
});
