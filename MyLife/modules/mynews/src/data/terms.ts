// MyNews terms-of-service acceptance gate. The CURRENT_TERMS_VERSION is the
// single source of truth for what a user must have accepted before they can
// publish an article or file an edit suggestion. It is mirrored verbatim in
// supabase/functions/_shared/mynews-terms.ts (the edge cannot import this TS
// package), and the two must never drift: the module test and the edge test
// both pin the literal so a bump lands in both places.
//
// A version bump re-gates everyone. The server verifies acceptance of exactly
// this version (not "some version"), so raising it forces every author and
// editor to accept the new terms before their next write. Acceptance is a
// self-attesting row in nw_terms_acceptance (self-scoped RLS); the gate that
// matters is server-side, in mynews-publish / mynews-suggest.

/**
 * Bump this string whenever the Terms of Service, Privacy Policy, or Community
 * Guidelines change in a way that requires re-acceptance. Format: YYYY-MM-DD of
 * the effective date. Keep it byte-identical to EDGE_CURRENT_TERMS_VERSION in
 * supabase/functions/_shared/mynews-terms.ts.
 */
export const CURRENT_TERMS_VERSION = '2026-07-05';

/** Machine-readable document ids surfaced by both app and web legal hubs. */
export const LEGAL_DOCUMENT_IDS = ['terms', 'privacy', 'guidelines', 'dmca'] as const;
export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

/**
 * Published EU Digital Services Act point of contact and the operator identity
 * shown on the legal hub. Single source of truth for both surfaces so the app
 * and web never publish divergent contact details. These are the addresses a
 * user or authority uses for Art 16 notices and Art 11/12 contact.
 */
export const LEGAL_CONTACT = {
  operator: 'MyLife Suite',
  // DSA single point of contact for authorities and for users/notices.
  dsaContactEmail: 'legal@mynews.app',
  // NCII / urgent safety escalation, 48h SLA (see Community Guidelines).
  safetyEmail: 'safety@mynews.app',
  // DMCA designated agent (see /legal/dmca).
  dmcaEmail: 'dmca@mynews.app',
} as const;

/** Typed error a write function returns when the actor has not accepted terms. */
export const TERMS_NOT_ACCEPTED_ERROR = 'terms-not-accepted';

/**
 * True when `accepted` includes the current terms version. The gate checks for
 * an exact match on CURRENT_TERMS_VERSION so a bump invalidates stale
 * acceptances. Empty / undefined lists never satisfy the gate.
 */
export function hasAcceptedCurrentTerms(accepted: readonly string[] | undefined | null): boolean {
  if (!accepted) return false;
  return accepted.includes(CURRENT_TERMS_VERSION);
}
