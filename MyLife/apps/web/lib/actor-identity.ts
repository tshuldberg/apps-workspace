import crypto from 'node:crypto';

const DEFAULT_TOKEN_TTL_SECONDS = 72 * 60 * 60; // 72 hours

export interface ActorIdentityPayload {
  userId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VerifiedActorIdentity {
  ok: boolean;
  userId?: string;
  issuedAt?: string;
  reason?: 'missing_secret' | 'invalid_format' | 'invalid_signature' | 'invalid_payload' | 'expired';
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getTokenTtlSeconds(): number {
  const envTtl = process.env.MYLIFE_ACTOR_TOKEN_TTL_SECONDS;
  if (envTtl) {
    const parsed = Number(envTtl);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TOKEN_TTL_SECONDS;
}

function canonicalize(payload: ActorIdentityPayload): string {
  return JSON.stringify({
    userId: payload.userId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}

function signPayload(payloadBase64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');
}

export function getActorIdentitySecret(): string | null {
  const secret = process.env.MYLIFE_ACTOR_IDENTITY_SECRET ?? process.env.MYLIFE_ENTITLEMENT_SECRET ?? null;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  console.error(
    '[actor-identity] MYLIFE_ACTOR_IDENTITY_SECRET (or MYLIFE_ENTITLEMENT_SECRET) is not set. Actor identity tokens cannot be issued or verified.'
  );
  return null;
}

export function issueActorIdentityToken(
  userId: string,
  issuedAt = new Date().toISOString(),
): string | null {
  const secret = getActorIdentitySecret();
  if (!secret) return null;

  const ttlSeconds = getTokenTtlSeconds();
  const expiresAtMs = new Date(issuedAt).getTime() + ttlSeconds * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  const payload: ActorIdentityPayload = {
    userId: userId.trim(),
    issuedAt,
    expiresAt,
  };

  const payloadBase64 = toBase64Url(canonicalize(payload));
  const signature = signPayload(payloadBase64, secret);
  return `v1.${payloadBase64}.${signature}`;
}

export function verifyActorIdentityToken(token: string): VerifiedActorIdentity {
  const secret = getActorIdentitySecret();
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return { ok: false, reason: 'invalid_format' };
  }

  const payloadBase64 = parts[1];
  const providedSignature = parts[2];
  const expectedSignature = signPayload(payloadBase64, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(payloadBase64)) as unknown;
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  if (
    typeof parsed !== 'object'
    || parsed === null
    || typeof (parsed as Record<string, unknown>).userId !== 'string'
    || typeof (parsed as Record<string, unknown>).issuedAt !== 'string'
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const userId = ((parsed as Record<string, unknown>).userId as string).trim();
  const issuedAt = (parsed as Record<string, unknown>).issuedAt as string;
  if (!userId) return { ok: false, reason: 'invalid_payload' };

  const issuedAtDate = new Date(issuedAt);
  if (Number.isNaN(issuedAtDate.getTime())) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const expiresAt = (parsed as Record<string, unknown>).expiresAt;
  if (typeof expiresAt === 'string') {
    const expiresAtDate = new Date(expiresAt);
    if (!Number.isNaN(expiresAtDate.getTime()) && Date.now() > expiresAtDate.getTime()) {
      return { ok: false, reason: 'expired' };
    }
  }

  return {
    ok: true,
    userId,
    issuedAt: issuedAtDate.toISOString(),
  };
}
