import { verifyActorIdentityToken } from '@/lib/actor-identity';

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface ResolvedActorIdentity {
  ok: boolean;
  userId?: string;
  status?: 400 | 401 | 403;
  error?: string;
  source?: 'actor_token' | 'legacy_user_id';
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

function isLegacyUserIdFallbackAllowed(now = Date.now()): boolean {
  const explicit = parseBooleanEnv(process.env.MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK);
  if (explicit !== undefined) {
    return explicit;
  }

  const strictMode = parseBooleanEnv(process.env.MYLIFE_ACTOR_IDENTITY_STRICT_MODE);
  // In production, strict mode is ON by default (opt-out via STRICT_MODE=false).
  // In dev/test, strict mode is OFF by default (opt-in via STRICT_MODE=true).
  const effectiveStrictMode = strictMode ?? (process.env.NODE_ENV === 'production');
  if (effectiveStrictMode) {
    return false;
  }

  const fallbackUntil = parseOptionalString(process.env.MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL);
  if (!fallbackUntil) {
    return true;
  }

  const parsed = new Date(fallbackUntil);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return now <= parsed.getTime();
}

/**
 * Resolve actor identity from token first, with optional userId fallback.
 * Legacy userId fallback can be disabled via strict mode or migration-window env vars.
 */
export function resolveActorIdentity(input: {
  token?: unknown;
  userId?: unknown;
  required?: boolean;
}): ResolvedActorIdentity {
  const token = parseOptionalString(input.token);
  const requestedUserId = parseOptionalString(input.userId);

  if (token) {
    const verified = verifyActorIdentityToken(token);
    if (!verified.ok || !verified.userId) {
      return {
        ok: false,
        status: 401,
        error: `Invalid actor identity token (${verified.reason ?? 'unknown'}).`,
      };
    }

    if (requestedUserId && requestedUserId !== verified.userId) {
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

  if (requestedUserId) {
    if (!isLegacyUserIdFallbackAllowed()) {
      return {
        ok: false,
        status: 401,
        error: 'actorToken is required for this endpoint.',
      };
    }

    return {
      ok: true,
      userId: requestedUserId,
      source: 'legacy_user_id',
    };
  }

  if (input.required) {
    return {
      ok: false,
      status: 400,
      error: 'A userId or actorToken is required.',
    };
  }

  return { ok: false, status: 400, error: 'A userId or actorToken is required.' };
}
