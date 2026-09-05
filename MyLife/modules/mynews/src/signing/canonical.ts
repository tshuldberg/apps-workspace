import type { ChangelogEntry, SuggestionType } from '../models';

export const REVISION_SIGNING_DOMAIN = 'mylife-mynews-article-rev-v1';
export const SUGGESTION_SIGNING_DOMAIN = 'mylife-mynews-suggestion-v1';
export const SUGGESTION_REJECT_SIGNING_DOMAIN = 'mylife-mynews-suggestion-reject-v1';
export const KEY_POSSESSION_SIGNING_DOMAIN = 'mylife-mynews-key-possession-v1';
export const ARTICLE_META_SIGNING_DOMAIN = 'mylife-mynews-article-meta-v1';
export const KEY_CUSTODY_SIGNING_DOMAIN = 'mylife-mynews-key-custody-v1';

export interface SignableRevision {
  articleId: string;
  rev: number;
  headline: string;
  dek?: string;
  bodyMd: string;
  changelog: ChangelogEntry[];
  createdAt: string;
  signerPubkey: string;
}

export interface SignableSuggestion {
  articleId: string;
  baseRev: number;
  type: SuggestionType;
  diffJson: string;
  citations: string[];
  rationale: string;
  editorPubkey: string;
}

export interface SignableReject {
  suggestionId: string;
  articleId: string;
  baseRev: number;
  /** Optional author note; '' when absent, mirroring the dek convention. */
  note?: string;
  /** The head author's key (the only party allowed to reject). */
  signerPubkey: string;
}

/**
 * Proof-of-possession envelope for binding a device Ed25519 key to a profile.
 * The registrant signs their own Supabase auth uid together with the pubkey
 * being claimed, so the signature is non-transferable: a squatter cannot reuse
 * a victim's signature (it is bound to the victim's uid) without also holding
 * the victim's private key AND a session for the victim's uid.
 */
export interface SignableKeyPossession {
  /** The Supabase auth user id (JWT `sub`) of the registrant. */
  userId: string;
  /** The Ed25519 public key hex being claimed for this profile. */
  pubkey: string;
}

/**
 * What a custody proof authorizes (plan 48 WP6). Each purpose is a distinct
 * value inside the signed bytes, so a signature collected for one transition can
 * never be replayed as another: a device-approval signature cannot become a
 * rotation, and a possession proof cannot become a revocation.
 */
export type KeyCustodyPurpose =
  /** The OLD head key authorizes replacing itself with `subject`. */
  | 'rotation'
  /** The NEW key proves it holds the private half of `subject`. */
  | 'possession'
  /** The PRIMARY key authorizes `subject` as a co-active device key. */
  | 'device-approval'
  /** The DEVICE key proves it holds the private half of `subject`. */
  | 'device-possession'
  /** An active key authorizes revoking the chain row id in `subject`. */
  | 'revocation'
  /** An active key authorizes escrowing a recovery kit for `subject`. */
  | 'escrow-put';

/**
 * Custody transition envelope. Every proof binds the auth uid, the profile, the
 * CURRENT chain head, the second party, and a server-issued single-use nonce, so
 * a captured proof is worthless: it is non-transferable across users and
 * profiles, it is void the moment the head moves, and the nonce is consumed
 * inside the mutation transaction that spends it.
 */
export interface SignableKeyCustody {
  purpose: KeyCustodyPurpose;
  /** The Supabase auth user id (JWT `sub`) performing the transition. */
  userId: string;
  profileId: string;
  /** The chain head pubkey this proof is bound to. */
  oldPubkey: string;
  /**
   * The second party. A pubkey for rotation / possession / device / escrow
   * purposes; the target chain row id for a revocation.
   */
  subject: string;
  /** Server-issued single-use nonce (5 minute TTL). */
  nonce: string;
}

/**
 * Provenance-critical article metadata. Every field is an author assertion
 * (DOI, dataset hashes, license, rights route, canonical URL, embargo), so the
 * offline-re-verifiable corpus must bind them under a signature just like the
 * article text. Without this, a hijacked session with no signing key could
 * mutate provenance claims without breaking any signature. Nullable text fields
 * normalize to '' (the dek convention); arrays are used as-is with their pinned
 * element order preserved by the caller.
 */
export interface SignableArticleMeta {
  articleId: string;
  doi?: string | null;
  orcidAuthors: string[];
  license: string;
  rightsRoute: string;
  embargoUntil?: string | null;
  datasetHashes: string[];
  canonicalUrl?: string | null;
  /** The head author's key (the only party allowed to set meta). */
  signerPubkey: string;
}

const encoder = new TextEncoder();

/**
 * Canonical payloads are JSON ARRAYS with a pinned element order, never
 * objects (object key order is not part of the JSON data model). Changing
 * element order or adding fields requires a new version-suffixed domain.
 */
export function canonicalRevisionBytes(rev: SignableRevision): Uint8Array {
  const triples = rev.changelog.map((c) => [c.suggestionId, c.editorKey, c.type]);
  return encoder.encode(
    JSON.stringify([
      REVISION_SIGNING_DOMAIN,
      rev.articleId,
      rev.rev,
      rev.headline,
      rev.dek ?? '',
      rev.bodyMd,
      triples,
      rev.createdAt,
      rev.signerPubkey,
    ]),
  );
}

export function canonicalSuggestionBytes(s: SignableSuggestion): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      SUGGESTION_SIGNING_DOMAIN,
      s.articleId,
      s.baseRev,
      s.type,
      s.diffJson,
      s.citations,
      s.rationale,
      s.editorPubkey,
    ]),
  );
}

/**
 * Reject envelope (additive, never a mutation of the revision/suggestion
 * bytes). The literal 'reject' decision, the suggestion + article + baseRev it
 * targets, the note, and the head author key are all bound so a config-only
 * verify_jwt slip can never authorize a reject on its own.
 */
export function canonicalRejectBytes(r: SignableReject): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      SUGGESTION_REJECT_SIGNING_DOMAIN,
      r.suggestionId,
      r.articleId,
      r.baseRev,
      'reject',
      r.note ?? '',
      r.signerPubkey,
    ]),
  );
}

/**
 * Key-possession bytes bind the domain, the registrant's auth uid, and the
 * claimed pubkey. Additive: a new versioned domain, never a mutation of the
 * revision/suggestion/reject bytes.
 */
export function canonicalKeyPossessionBytes(k: SignableKeyPossession): Uint8Array {
  return encoder.encode(
    JSON.stringify([KEY_POSSESSION_SIGNING_DOMAIN, k.userId, k.pubkey]),
  );
}

/**
 * Article-meta bytes (additive, never a mutation of the revision/suggestion/
 * reject/key-possession bytes). Every provenance field is bound in a pinned
 * order so a tampered DOI, dataset hash, license, rights route, embargo, or
 * canonical URL breaks the signature. Nullable text fields collapse to '' so a
 * cleared field and an absent field sign identically; the arrays keep the
 * caller's order.
 */
export function canonicalArticleMetaBytes(m: SignableArticleMeta): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      ARTICLE_META_SIGNING_DOMAIN,
      m.articleId,
      m.doi ?? '',
      m.orcidAuthors,
      m.license,
      m.rightsRoute,
      m.embargoUntil ?? '',
      m.datasetHashes,
      m.canonicalUrl ?? '',
      m.signerPubkey,
    ]),
  );
}

/**
 * Custody transition bytes (additive; never a mutation of the revision /
 * suggestion / reject / key-possession / article-meta bytes). The purpose is the
 * FIRST element after the domain precisely so that changing what a signature
 * authorizes changes the signed bytes.
 */
export function canonicalKeyCustodyBytes(k: SignableKeyCustody): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      KEY_CUSTODY_SIGNING_DOMAIN,
      k.purpose,
      k.userId,
      k.profileId,
      k.oldPubkey,
      k.subject,
      k.nonce,
    ]),
  );
}
