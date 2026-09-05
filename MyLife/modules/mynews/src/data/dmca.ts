import {
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
  DmcaCounterNoticeSchema,
  DmcaNoticeSchema,
  DmcaTakedownSchema,
  type DmcaCounterNotice,
  type DmcaNotice,
  type DmcaTakedown,
} from '../models';

export type DmcaValidationResult =
  | { ok: true; notice: DmcaNotice }
  | { ok: false; issue: string };

export type DmcaErrorCode =
  | 'validation'
  | 'rate-limited'
  | 'network'
  | 'not-configured'
  | 'temporarily-unavailable'
  | 'unknown';

/**
 * Pure client-side validation of a DMCA notice payload. Shared by the web DMCA
 * form and the in-app path so the required 512(c)(3) elements are enforced
 * identically before anything hits the mynews-dmca function. Never fabricates a
 * legal capability: it only checks the notice is complete and well-formed.
 */
export function validateDmcaNotice(raw: unknown): DmcaValidationResult {
  const parsed = DmcaNoticeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issue: parsed.error.issues[0]?.message ?? 'invalid notice' };
  }
  return { ok: true, notice: parsed.data };
}

export function validateDmcaTakedown(
  raw: unknown,
): { ok: true; notice: DmcaTakedown } | { ok: false; issue: string } {
  const parsed = DmcaTakedownSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issue: parsed.error.issues[0]?.message ?? 'invalid takedown notice' };
  }
  return { ok: true, notice: parsed.data };
}

export function validateDmcaCounterNotice(
  raw: unknown,
): { ok: true; notice: DmcaCounterNotice } | { ok: false; issue: string } {
  const parsed = DmcaCounterNoticeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issue: parsed.error.issues[0]?.message ?? 'invalid counter-notice' };
  }
  return { ok: true, notice: parsed.data };
}

export interface DmcaErrorMessage {
  message: string;
}

/** Honest, human copy per typed DMCA error code. No em dashes. */
export function dmcaErrorMessage(code: DmcaErrorCode): DmcaErrorMessage {
  switch (code) {
    case 'validation':
      return {
        message:
          'That submission is missing a required element or attestation. Review every identity, contact, material, location, statement, and signature field, then try again.',
      };
    case 'rate-limited':
      return {
        message: 'Too many notices from this source recently. Please wait a few minutes and try again.',
      };
    case 'network':
      return { message: 'Could not reach the server. Check your connection and try again.' };
    case 'not-configured':
      return { message: 'DMCA intake is not configured on this deployment.' };
    case 'temporarily-unavailable':
      return {
        message:
          'DMCA intake is temporarily unavailable because a required safety control could not be verified. Please try again shortly.',
      };
    case 'unknown':
    default:
      return { message: 'Something went wrong submitting your notice. Please try again.' };
  }
}

// Canonical public-URL vocabulary for DMCA target resolution. This is the
// single place that defines which pasted URLs the server can resolve to a
// target; the SQL resolver (nw_resolve_public_url, migration
// 20260730000002_mynews_dmca_hardening.sql) and the in-memory store twin
// implement exactly these shapes, and drift tests on each side pin them.
// The /a/<slug>/suggestions list page resolves to its ARTICLE target.
export type DmcaUrlTargetKind = 'article' | 'profile' | 'suggestion';

const DMCA_ARTICLE_PATH = /^\/(?:article|a)\/([a-z0-9-]{3,120})(?:\/suggestions)?\/?$/i;
const DMCA_PROFILE_PATH = /^\/(?:journalist|profile|j|e)\/([a-z0-9_]{3,30})\/?$/i;
const DMCA_SUGGESTION_PATH = /^\/suggestion\/([a-f0-9-]{36})\/?$/i;

/**
 * Pure classifier for a public https URL: which target kind would the server
 * resolver look up for this URL shape? Existence is checked server-side; this
 * answers only whether the shape is in the resolvable vocabulary.
 */
export function classifyDmcaPublicUrl(rawUrl: string): DmcaUrlTargetKind | null {
  let path: string;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    path = parsed.pathname || '/';
  } catch {
    return null;
  }
  if (DMCA_ARTICLE_PATH.test(path)) return 'article';
  if (DMCA_PROFILE_PATH.test(path)) return 'profile';
  if (DMCA_SUGGESTION_PATH.test(path)) return 'suggestion';
  return null;
}

/**
 * Shared resolution fixtures: every live mynews-web content route shape plus
 * the legacy and deep-link forms, and the shapes that must NOT resolve. Used
 * by the module tests, the store-twin tests, and the mynews-web route-drift
 * test so the three implementations cannot silently diverge from the router.
 */
export const DMCA_URL_RESOLUTION_FIXTURES: ReadonlyArray<{
  path: string;
  kind: DmcaUrlTargetKind | null;
}> = Object.freeze([
  { path: '/a/my-article-slug', kind: 'article' },
  { path: '/a/my-article-slug/suggestions', kind: 'article' },
  { path: '/article/my-article-slug', kind: 'article' },
  { path: '/j/some_handle', kind: 'profile' },
  { path: '/e/some_handle', kind: 'profile' },
  { path: '/journalist/some_handle', kind: 'profile' },
  { path: '/profile/some_handle', kind: 'profile' },
  { path: '/suggestion/123e4567-e89b-42d3-a456-426614174000', kind: 'suggestion' },
  { path: '/legal/dmca', kind: null },
  { path: '/legal', kind: null },
  { path: '/about/editing', kind: null },
  { path: '/a/my-article-slug/anything-else', kind: null },
  { path: '/x/whatever', kind: null },
  { path: '/', kind: null },
]);

// Published takedown policy facts, surfaced in-app and on the web so both
// legal surfaces read identically. These are process facts, not a claim that a
// designated agent is registered (that is a founder-ops step); the copy states
// the notice-and-takedown process, the repeat-infringer policy, and the SLA.
export const DMCA_DESIGNATED_AGENT_EMAIL = 'dmca@mynews.app';
export const DMCA_RESPONSE_SLA_HOURS = 72;
export const DMCA_REPEAT_INFRINGER_THRESHOLD = 3;

export {
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
};
