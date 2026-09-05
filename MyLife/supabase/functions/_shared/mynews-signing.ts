// Deno-compatible twin of modules/mynews/src/signing/canonical.ts.
// The vector-parity test in supabase/functions/mynews-publish/__tests__
// asserts these builders produce byte-identical output to the module's
// committed fixture. Changing either side requires a new version domain.

export const REVISION_SIGNING_DOMAIN = 'mylife-mynews-article-rev-v1';
export const SUGGESTION_SIGNING_DOMAIN = 'mylife-mynews-suggestion-v1';
export const SUGGESTION_REJECT_SIGNING_DOMAIN = 'mylife-mynews-suggestion-reject-v1';
export const KEY_POSSESSION_SIGNING_DOMAIN = 'mylife-mynews-key-possession-v1';
export const ARTICLE_META_SIGNING_DOMAIN = 'mylife-mynews-article-meta-v1';
export const KEY_CUSTODY_SIGNING_DOMAIN = 'mylife-mynews-key-custody-v1';

export interface WireChangelogEntry {
  suggestionId: string;
  editorKey: string;
  type: string;
}

export interface WireRevision {
  articleId: string;
  rev: number;
  headline: string;
  dek?: string;
  bodyMd: string;
  changelog: WireChangelogEntry[];
  createdAt: string;
  signerPubkey: string;
}

export interface WireSuggestion {
  articleId: string;
  baseRev: number;
  type: string;
  diffJson: string;
  citations: string[];
  rationale: string;
  editorPubkey: string;
}

export interface WireReject {
  suggestionId: string;
  articleId: string;
  baseRev: number;
  note?: string;
  signerPubkey: string;
}

export interface WireKeyPossession {
  userId: string;
  pubkey: string;
}

/** Twin of KeyCustodyPurpose in modules/mynews/src/signing/canonical.ts. */
export type WireKeyCustodyPurpose =
  | 'rotation'
  | 'possession'
  | 'device-approval'
  | 'device-possession'
  | 'revocation'
  | 'escrow-put';

export interface WireKeyCustody {
  purpose: WireKeyCustodyPurpose;
  userId: string;
  profileId: string;
  oldPubkey: string;
  subject: string;
  nonce: string;
}

export interface WireArticleMeta {
  articleId: string;
  doi?: string | null;
  orcidAuthors: string[];
  license: string;
  rightsRoute: string;
  embargoUntil?: string | null;
  datasetHashes: string[];
  canonicalUrl?: string | null;
  signerPubkey: string;
}

const encoder = new TextEncoder();

export function canonicalRevisionBytes(rev: WireRevision): Uint8Array {
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

export function canonicalSuggestionBytes(s: WireSuggestion): Uint8Array {
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

export function canonicalRejectBytes(r: WireReject): Uint8Array {
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

export function canonicalKeyPossessionBytes(k: WireKeyPossession): Uint8Array {
  return encoder.encode(
    JSON.stringify([KEY_POSSESSION_SIGNING_DOMAIN, k.userId, k.pubkey]),
  );
}

export function canonicalKeyCustodyBytes(k: WireKeyCustody): Uint8Array {
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

export function canonicalArticleMetaBytes(m: WireArticleMeta): Uint8Array {
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

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Ed25519 verification over WebCrypto (Deno and Node 19+). tweetnacl
 * signatures on the client are standard Ed25519 and verify here directly.
 */
export async function verifyEd25519(
  publicKeyHex: string,
  message: Uint8Array,
  signatureHex: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKeyHex) as unknown as ArrayBuffer,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      hexToBytes(signatureHex) as unknown as ArrayBuffer,
      message as unknown as ArrayBuffer,
    );
  } catch {
    return false;
  }
}
