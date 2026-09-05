/**
 * Reader-side authorship verification (plan 48 WP6, design goal 5).
 *
 * The corpus claim is that MyNews cannot forge authorship. That claim is only as
 * strong as a verifier a reader can actually run, so one ships here rather than
 * being left as an exercise. Given a stored revision (or suggestion), the key
 * chain of the profile on the byline, and the server-recorded verified_key_id,
 * this answers whether the write really was signed by a key belonging to that
 * byline, without trusting the server's own say-so beyond the raw rows.
 *
 * Two properties matter and are easy to get wrong:
 *
 *   Rotation must not retroactively invalidate history. A revision signed in
 *   2026 by a key rotated away in 2027 is still authentic. So the verdict NEVER
 *   depends on the key's CURRENT status; a retired key yields `verified` with
 *   `keyRetired: true`, which is information, not a failure.
 *
 *   Wall-clock must not gate anything. There is no comparison anywhere below
 *   between a revision's createdAt and a key's validFrom or revokedAt. That kind
 *   of window is what finding C-2 rejected: a client controls createdAt, so a
 *   time-window verifier can be talked into accepting a forgery. Validity here
 *   is chain membership plus the recorded key, both server-ordered.
 *
 * Pure and dependency-light: signature checking comes from the module's own
 * canonical builders. Callers supply the rows.
 */

import type { ChangelogEntry } from '../models';
import { verifyRevisionSignature, verifySuggestionSignature } from './sign';
import type { SignableSuggestion } from './canonical';

/** A row of `nw_profile_keys` as a reader sees it (the chain is public). */
export interface ChainKeyRow {
  id: string;
  profileId: string;
  pubkey: string;
  status: 'active' | 'revoked';
  kind: 'primary' | 'device';
  addedVia: 'initial' | 'rotation' | 'device_approval' | 'recovery' | 'backup_restore';
  /** Display only. Deliberately never used to gate a verdict. */
  validFrom: string;
  /** Display only. Deliberately never used to gate a verdict. */
  revokedAt: string | null;
}

/** A row of `nw_key_events` as a reader sees it (the feed is public). */
export interface ChainKeyEvent {
  kind:
    | 'rotation'
    | 'device_approval'
    | 'revocation'
    | 'recovery_requested'
    | 'recovery_cancelled'
    | 'recovery_completed'
    | 'recovery_frozen'
    | 'backup_restore';
  createdAt: string;
}

export type AuthorshipVerdict =
  /** Signature checks out and the signing key belongs to the byline's chain. */
  | 'verified'
  /**
   * Signature checks out, but the server recorded no chain row for it. Either
   * the write predates the custody chain, or its author was anonymized by an
   * account deletion. Honest middle ground: signed, not chain-bound.
   */
  | 'chain-unrecorded'
  /** The recorded chain row does not hold the key that signed. */
  | 'key-mismatch'
  /** The recorded chain row belongs to a DIFFERENT profile than the byline. */
  | 'wrong-profile'
  /** The signature does not verify over the stored bytes. */
  | 'bad-signature';

export interface AuthorshipVerification {
  verdict: AuthorshipVerdict;
  /**
   * The verifying key has since been rotated away or revoked. Historical
   * authenticity is unaffected; this only means the key cannot sign anything NEW.
   */
  keyRetired: boolean;
  keyKind?: ChainKeyRow['kind'];
  addedVia?: ChainKeyRow['addedVia'];
}

/** The stored revision fields a reader needs, exactly as the record holds them. */
export interface StoredRevisionForVerify {
  articleId: string;
  rev: number;
  headline: string;
  dek?: string;
  bodyMd: string;
  changelog: ChangelogEntry[];
  createdAt: string;
  signerPubkey: string;
  signature: string;
  /** nw_article_revisions.verified_key_id; null on pre-chain rows. */
  verifiedKeyId: string | null;
}

function chainCheck(
  signerPubkey: string,
  verifiedKeyId: string | null,
  bylineProfileId: string,
  chain: readonly ChainKeyRow[],
): AuthorshipVerification {
  if (verifiedKeyId === null || verifiedKeyId === '') {
    return { verdict: 'chain-unrecorded', keyRetired: false };
  }
  const row = chain.find((k) => k.id === verifiedKeyId);
  if (!row) {
    // The server named a chain row the reader cannot see in the byline's chain.
    // That is exactly the forgery shape this verifier exists to catch, so it is
    // reported as a wrong-profile failure rather than downgraded to unrecorded.
    return { verdict: 'wrong-profile', keyRetired: false };
  }
  if (row.profileId !== bylineProfileId) {
    return { verdict: 'wrong-profile', keyRetired: false };
  }
  if (row.pubkey !== signerPubkey) {
    return { verdict: 'key-mismatch', keyRetired: false };
  }
  return {
    verdict: 'verified',
    keyRetired: row.status === 'revoked',
    keyKind: row.kind,
    addedVia: row.addedVia,
  };
}

/**
 * Verify one revision. Signature first: without a valid signature nothing about
 * the chain matters, and reporting a chain problem on unsigned bytes would be
 * misleading about what actually failed.
 */
export function verifyRevisionAuthorship(input: {
  revision: StoredRevisionForVerify;
  bylineProfileId: string;
  chain: readonly ChainKeyRow[];
}): AuthorshipVerification {
  const { revision } = input;
  const signatureOk = verifyRevisionSignature(
    {
      articleId: revision.articleId,
      rev: revision.rev,
      headline: revision.headline,
      dek: revision.dek,
      bodyMd: revision.bodyMd,
      changelog: revision.changelog,
      createdAt: revision.createdAt,
      signerPubkey: revision.signerPubkey,
    },
    revision.signature,
  );
  if (!signatureOk) return { verdict: 'bad-signature', keyRetired: false };
  return chainCheck(
    revision.signerPubkey,
    revision.verifiedKeyId,
    input.bylineProfileId,
    input.chain,
  );
}

/** The stored suggestion fields a reader needs. */
export interface StoredSuggestionForVerify extends SignableSuggestion {
  signature: string;
  /** nw_edit_suggestions.verified_key_id; null on pre-chain rows. */
  verifiedKeyId: string | null;
}

/**
 * Verify one suggestion against the EDITOR's chain. `editorPubkey` is the
 * recorded signer (nw_edit_suggestions.signer_pubkey), not the editor's current
 * profile key: assuming the current key would fail every suggestion filed before
 * a rotation, which is the bug WP6 also fixed on the write path.
 */
export function verifySuggestionAuthorship(input: {
  suggestion: StoredSuggestionForVerify;
  editorProfileId: string;
  chain: readonly ChainKeyRow[];
}): AuthorshipVerification {
  const { suggestion } = input;
  if (suggestion.editorPubkey === '') {
    // A pre-WP6 row with no recorded signer cannot be checked at all; saying
    // 'bad-signature' would be a lie about a signature nobody can locate a key
    // for.
    return { verdict: 'chain-unrecorded', keyRetired: false };
  }
  const signatureOk = verifySuggestionSignature(
    {
      articleId: suggestion.articleId,
      baseRev: suggestion.baseRev,
      type: suggestion.type,
      diffJson: suggestion.diffJson,
      citations: suggestion.citations,
      rationale: suggestion.rationale,
      editorPubkey: suggestion.editorPubkey,
    },
    suggestion.signature,
  );
  if (!signatureOk) return { verdict: 'bad-signature', keyRetired: false };
  return chainCheck(
    suggestion.editorPubkey,
    suggestion.verifiedKeyId,
    input.editorProfileId,
    input.chain,
  );
}

/** Short badge label. One wording, shared by the mobile and web renderers. */
export function authorshipBadgeLabel(result: AuthorshipVerification): string {
  switch (result.verdict) {
    case 'verified':
      if (result.addedVia === 'recovery') {
        return 'Signature verified (key restored via account recovery)';
      }
      if (result.keyKind === 'device') {
        return result.keyRetired
          ? 'Signature verified (retired device key)'
          : 'Signature verified (device key)';
      }
      return result.keyRetired
        ? 'Signature verified (key since rotated)'
        : 'Signature verified';
    case 'chain-unrecorded':
      return 'Signed, not key-chain recorded';
    case 'key-mismatch':
      return 'Key record does not match the signature';
    case 'wrong-profile':
      return 'Signing key does not belong to this byline';
    case 'bad-signature':
      return 'Signature does not verify';
  }
}

/** Whether a badge should read as a pass, a caveat, or a failure. */
export function authorshipBadgeTone(
  result: AuthorshipVerification,
): 'pass' | 'caveat' | 'fail' {
  if (result.verdict === 'verified') return 'pass';
  if (result.verdict === 'chain-unrecorded') return 'caveat';
  return 'fail';
}

/**
 * Recovery branding for a byline (design L-2: ONLY completed recoveries brand
 * revisions; a request or a cancellation brands nothing, or an attacker could
 * smear a profile by merely filing requests). Returns the sentence to render, or
 * null when there is nothing to disclose.
 */
export function recoveryBranding(
  events: readonly ChainKeyEvent[],
  formatDate: (iso: string) => string,
): string | null {
  const completed = events
    .filter((e) => e.kind === 'recovery_completed')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!completed) return null;
  return `Signing key replaced via account recovery on ${formatDate(completed.createdAt)}`;
}
