import crypto from 'node:crypto';
import path from 'node:path';

export interface BundleTokenPayload {
  bundleId: string;
  eventId: string;
  purchaserRef?: string;
  exp: number;
}

export interface SignedBundleUrlResult {
  ok: boolean;
  url?: string;
  token?: string;
  expiresAt?: string;
  reason?: string;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payloadB64: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
}

function sanitizeBundleId(bundleId: string): string | null {
  const value = bundleId.trim();
  if (!value) return null;
  if (!/^[a-zA-Z0-9-]+$/.test(value)) return null;
  return value;
}

function resolveBaseUrl(requestBaseUrl?: string): string | null {
  const configured = process.env.MYLIFE_BUNDLE_BASE_URL ?? requestBaseUrl ?? null;
  if (!configured) return null;

  try {
    const parsed = new URL(configured);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function createSignedBundleToken(
  payload: BundleTokenPayload,
  secret: string,
): string {
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifySignedBundleToken(
  token: string,
  secret: string,
): { ok: boolean; payload?: BundleTokenPayload; reason?: string } {
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) {
    return { ok: false, reason: 'malformed_token' };
  }

  const expected = signPayload(payloadB64, secret);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: 'invalid_signature' };
  }

  if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(decodeBase64Url(payloadB64));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  const candidate = parsedPayload as Partial<BundleTokenPayload>;
  if (
    typeof candidate.bundleId !== 'string'
    || typeof candidate.eventId !== 'string'
    || typeof candidate.exp !== 'number'
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    payload: {
      bundleId: candidate.bundleId,
      eventId: candidate.eventId,
      purchaserRef: typeof candidate.purchaserRef === 'string' ? candidate.purchaserRef : undefined,
      exp: candidate.exp,
    },
  };
}

export function isBundleTokenExpired(payload: BundleTokenPayload, nowMs = Date.now()): boolean {
  return payload.exp * 1000 <= nowMs;
}

export function resolveBundleZipPath(bundleId: string): string | null {
  const safeBundleId = sanitizeBundleId(bundleId);
  if (!safeBundleId) return null;

  return path.join(process.cwd(), 'deploy', 'self-host', 'releases', `${safeBundleId}.zip`);
}

export function issueSignedBundleDownloadUrl(input: {
  bundleId: string;
  eventId: string;
  purchaserRef?: string;
  requestBaseUrl?: string;
  expiresInSeconds?: number;
}): SignedBundleUrlResult {
  const secret = process.env.MYLIFE_BUNDLE_SIGNING_SECRET;
  if (!secret) {
    return { ok: false, reason: 'missing_bundle_secret' };
  }

  const safeBundleId = sanitizeBundleId(input.bundleId);
  if (!safeBundleId) {
    return { ok: false, reason: 'invalid_bundle_id' };
  }

  const baseUrl = resolveBaseUrl(input.requestBaseUrl);
  if (!baseUrl) {
    return { ok: false, reason: 'missing_bundle_base_url' };
  }

  const ttlCandidate = input.expiresInSeconds ?? 60 * 60 * 24 * 7;
  const normalizedTtl = Number.isFinite(ttlCandidate) ? ttlCandidate : 60 * 60 * 24 * 7;
  const expiresInSeconds = Math.max(60, Math.min(60 * 60 * 24 * 30, normalizedTtl));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const tokenPayload: BundleTokenPayload = {
    bundleId: safeBundleId,
    eventId: input.eventId,
    purchaserRef: input.purchaserRef,
    exp,
  };

  const token = createSignedBundleToken(tokenPayload, secret);
  const url = `${baseUrl}/api/access/bundle/download?token=${encodeURIComponent(token)}`;

  return {
    ok: true,
    url,
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
