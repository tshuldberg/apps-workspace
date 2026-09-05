/**
 * Authenticator Assurance Level reading (plan 48 WP9). Pure so it is
 * unit-testable; no Supabase client, no I/O.
 *
 * Why decode the claim instead of trusting a client helper: the console must fail
 * CLOSED on MFA. `getAuthenticatorAssuranceLevel()` derives the level from the
 * locally stored session, and the console's session store is a cookie. So the
 * order in lib/auth.ts is:
 *
 *   1. `supabase.auth.getUser()` -- a network call to the auth server that
 *      verifies the access token's signature. An attacker-crafted cookie fails
 *      here and never reaches step 2.
 *   2. Read the `aal` claim out of THAT SAME verified token.
 *
 * Because the signature covers the whole payload, a token that passes step 1
 * cannot carry a forged `aal`. Anything unreadable, missing, or not exactly
 * 'aal2' is treated as aal1, which sends the moderator to enrolment rather than
 * into the console.
 */

export type AssuranceLevel = 'aal1' | 'aal2';

export interface AccessTokenClaims {
  aal: AssuranceLevel;
  /** Auth session id, so an audit trail can name the session, when present. */
  sessionId: string | null;
  /** Seconds since epoch, when present. */
  expiresAt: number | null;
  /** Authentication methods the token records, newest first when present. */
  methods: string[];
}

function decodeBase64Url(part: string): string | null {
  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Read the claims this module cares about out of a JWT payload. Never throws.
 * A token that cannot be parsed reads as aal1: unknown is not trusted.
 */
export function readAccessTokenClaims(token: string | null | undefined): AccessTokenClaims {
  const fallback: AccessTokenClaims = { aal: 'aal1', sessionId: null, expiresAt: null, methods: [] };
  if (!token || typeof token !== 'string') return fallback;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return fallback;
  const json = decodeBase64Url(parts[1]);
  if (!json) return fallback;
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return fallback;
  }
  if (!payload || typeof payload !== 'object') return fallback;
  const claims = payload as Record<string, unknown>;
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  return {
    // Only the exact string 'aal2' counts. 'AAL2', 'aal3', or a truthy object
    // are all treated as unverified.
    aal: claims.aal === 'aal2' ? 'aal2' : 'aal1',
    sessionId: typeof claims.session_id === 'string' ? claims.session_id : null,
    expiresAt: typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp : null,
    methods: amr
      .map((entry) =>
        entry && typeof entry === 'object' && typeof (entry as { method?: unknown }).method === 'string'
          ? (entry as { method: string }).method
          : typeof entry === 'string'
            ? entry
            : null,
      )
      .filter((method): method is string => method !== null),
  };
}

export function isAal2(token: string | null | undefined): boolean {
  return readAccessTokenClaims(token).aal === 'aal2';
}

/**
 * What the moderator has to do next, from the two levels Supabase reports.
 *
 * - 'ok': the session is already aal2.
 * - 'verify': a verified factor exists but this session has not used it.
 * - 'enroll': no verified factor exists yet.
 *
 * A null or unrecognised pair resolves to 'enroll', the most restrictive answer
 * that still gives the moderator a way forward.
 */
export type MfaStep = 'ok' | 'verify' | 'enroll';

export function nextMfaStep(input: {
  currentLevel: string | null | undefined;
  nextLevel: string | null | undefined;
  hasVerifiedFactor: boolean;
}): MfaStep {
  if (input.currentLevel === 'aal2') return 'ok';
  if (input.hasVerifiedFactor || input.nextLevel === 'aal2') return 'verify';
  return 'enroll';
}
