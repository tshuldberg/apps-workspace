import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { describe, expect, it } from 'vitest';
import {
  ARTICLE_META_SIGNING_DOMAIN,
  KEY_POSSESSION_SIGNING_DOMAIN,
  REVISION_SIGNING_DOMAIN,
  SUGGESTION_REJECT_SIGNING_DOMAIN,
  SUGGESTION_SIGNING_DOMAIN,
  canonicalArticleMetaBytes,
  canonicalKeyPossessionBytes,
  canonicalRejectBytes,
  canonicalRevisionBytes,
  canonicalSuggestionBytes,
  type SignableArticleMeta,
  type SignableKeyPossession,
  type SignableReject,
  type SignableRevision,
  type SignableSuggestion,
} from './canonical';
import {
  signArticleMeta,
  signKeyPossession,
  signReject,
  signRevision,
  signSuggestion,
  verifyArticleMetaSignature,
  verifyKeyPossessionSignature,
  verifyRejectSignature,
  verifyRevisionSignature,
  verifySuggestionSignature,
} from './sign';

const FIXTURE_PATH = join(__dirname, '__fixtures__', 'signing-vectors.json');

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

interface SigningVectors {
  publicKeyHex: string;
  privateKeyHex: string;
  revision: SignableRevision;
  revisionCanonicalHex: string;
  revisionSignatureHex: string;
  suggestion: SignableSuggestion;
  suggestionCanonicalHex: string;
  suggestionSignatureHex: string;
  reject: SignableReject;
  rejectCanonicalHex: string;
  rejectSignatureHex: string;
  keyPossession: SignableKeyPossession;
  keyPossessionCanonicalHex: string;
  keyPossessionSignatureHex: string;
  articleMeta: SignableArticleMeta;
  articleMetaCanonicalHex: string;
  articleMetaSignatureHex: string;
}

const KEY_POSSESSION_USER_ID = 'auth-user-1';

function buildKeyPossession(pubkey: string): SignableKeyPossession {
  return { userId: KEY_POSSESSION_USER_ID, pubkey };
}

function buildRevision(signerPubkey: string): SignableRevision {
  return {
    articleId: 'a-fixture-1',
    rev: 2,
    headline: 'Owens Valley water dispute deepens',
    dek: 'Filings show a 34% allocation drop.',
    bodyMd: 'The valley faces a hard season.\n\nCounty filings show a 34% drop.',
    changelog: [{ suggestionId: 's-fixture-1', editorKey: 'editor-key-1', type: 'correction' }],
    createdAt: '2026-07-03T12:00:00.000Z',
    signerPubkey,
  };
}

function buildSuggestion(editorPubkey: string): SignableSuggestion {
  return {
    articleId: 'a-fixture-1',
    baseRev: 1,
    type: 'correction',
    diffJson: '{"baseHash":"deadbeef","ops":[]}',
    citations: ['https://inyowater.org/filings/2026-03'],
    rationale: 'Filing year is 2026 and the drop is 34%.',
    editorPubkey,
  };
}

function buildReject(signerPubkey: string): SignableReject {
  return {
    suggestionId: 's-fixture-1',
    articleId: 'a-fixture-1',
    baseRev: 1,
    note: 'Thanks, but the filing already says 34%.',
    signerPubkey,
  };
}

function buildArticleMeta(signerPubkey: string): SignableArticleMeta {
  return {
    articleId: 'a-fixture-1',
    doi: '10.1234/owens.2026.034',
    orcidAuthors: ['0000-0002-1825-0097'],
    license: 'CC-BY-4.0',
    rightsRoute: 'cc_by',
    embargoUntil: '2026-08-01T00:00:00.000Z',
    datasetHashes: ['sha256:9f2c1a', 'sha256:44de77'],
    canonicalUrl: 'https://inyowater.org/records/2026-034',
    signerPubkey,
  };
}

function loadOrRegenVectors(): SigningVectors {
  if (process.env.REGEN_SIGNING_VECTORS === '1' || !existsSync(FIXTURE_PATH)) {
    const identity = generateDeviceIdentity('mynews-signing-fixture');
    const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
    const revision = buildRevision(identity.publicKey);
    const suggestion = buildSuggestion(identity.publicKey);
    const reject = buildReject(identity.publicKey);
    const keyPossession = buildKeyPossession(identity.publicKey);
    const articleMeta = buildArticleMeta(identity.publicKey);
    const vectors: SigningVectors = {
      publicKeyHex: identity.publicKey,
      privateKeyHex,
      revision,
      revisionCanonicalHex: toHex(canonicalRevisionBytes(revision)),
      revisionSignatureHex: signRevision(revision, privateKeyHex),
      suggestion,
      suggestionCanonicalHex: toHex(canonicalSuggestionBytes(suggestion)),
      suggestionSignatureHex: signSuggestion(suggestion, privateKeyHex),
      reject,
      rejectCanonicalHex: toHex(canonicalRejectBytes(reject)),
      rejectSignatureHex: signReject(reject, privateKeyHex),
      keyPossession,
      keyPossessionCanonicalHex: toHex(canonicalKeyPossessionBytes(keyPossession)),
      keyPossessionSignatureHex: signKeyPossession(keyPossession, privateKeyHex),
      articleMeta,
      articleMetaCanonicalHex: toHex(canonicalArticleMetaBytes(articleMeta)),
      articleMetaSignatureHex: signArticleMeta(articleMeta, privateKeyHex),
    };
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(vectors, null, 2)}\n`);
    return vectors;
  }
  const existing = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Partial<SigningVectors> &
    Pick<SigningVectors, 'publicKeyHex' | 'privateKeyHex'>;
  // Additive backfill: never regenerate the committed revision/suggestion/reject
  // vectors (their keypair is not deterministic). If a later domain's fields are
  // absent, derive them from the SAME committed keypair and persist only those,
  // leaving every other vector byte-for-byte identical.
  let working = existing;
  let dirty = false;
  if (working.keyPossessionSignatureHex === undefined) {
    const keyPossession = buildKeyPossession(working.publicKeyHex);
    working = {
      ...working,
      keyPossession,
      keyPossessionCanonicalHex: toHex(canonicalKeyPossessionBytes(keyPossession)),
      keyPossessionSignatureHex: signKeyPossession(keyPossession, working.privateKeyHex),
    };
    dirty = true;
  }
  if (working.articleMetaSignatureHex === undefined) {
    const articleMeta = buildArticleMeta(working.publicKeyHex);
    working = {
      ...working,
      articleMeta,
      articleMetaCanonicalHex: toHex(canonicalArticleMetaBytes(articleMeta)),
      articleMetaSignatureHex: signArticleMeta(articleMeta, working.privateKeyHex),
    };
    dirty = true;
  }
  if (dirty) {
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(working, null, 2)}\n`);
  }
  return working as SigningVectors;
}

const vectors = loadOrRegenVectors();

describe('canonical bytes', () => {
  it('are deterministic and object-key-order independent', () => {
    const a = buildRevision(vectors.publicKeyHex);
    const reordered: SignableRevision = JSON.parse(JSON.stringify(a));
    expect(toHex(canonicalRevisionBytes(a))).toBe(toHex(canonicalRevisionBytes(reordered)));
  });

  it('treat a missing dek as the empty string', () => {
    const withUndefined = { ...buildRevision(vectors.publicKeyHex), dek: undefined };
    const withEmpty = { ...buildRevision(vectors.publicKeyHex), dek: '' };
    expect(toHex(canonicalRevisionBytes(withUndefined))).toBe(
      toHex(canonicalRevisionBytes(withEmpty)),
    );
  });

  it('match the committed vectors byte for byte', () => {
    expect(toHex(canonicalRevisionBytes(vectors.revision))).toBe(vectors.revisionCanonicalHex);
    expect(toHex(canonicalSuggestionBytes(vectors.suggestion))).toBe(
      vectors.suggestionCanonicalHex,
    );
    expect(toHex(canonicalRejectBytes(vectors.reject))).toBe(vectors.rejectCanonicalHex);
    expect(toHex(canonicalKeyPossessionBytes(vectors.keyPossession))).toBe(
      vectors.keyPossessionCanonicalHex,
    );
    expect(toHex(canonicalArticleMetaBytes(vectors.articleMeta))).toBe(
      vectors.articleMetaCanonicalHex,
    );
  });

  it('treat missing article-meta doi/embargo/canonicalUrl as the empty string', () => {
    const base = buildArticleMeta(vectors.publicKeyHex);
    const withUndefined: SignableArticleMeta = {
      ...base,
      doi: undefined,
      embargoUntil: undefined,
      canonicalUrl: undefined,
    };
    const withEmpty: SignableArticleMeta = {
      ...base,
      doi: '',
      embargoUntil: '',
      canonicalUrl: '',
    };
    expect(toHex(canonicalArticleMetaBytes(withUndefined))).toBe(
      toHex(canonicalArticleMetaBytes(withEmpty)),
    );
    const withNull: SignableArticleMeta = {
      ...base,
      doi: null,
      embargoUntil: null,
      canonicalUrl: null,
    };
    expect(toHex(canonicalArticleMetaBytes(withNull))).toBe(
      toHex(canonicalArticleMetaBytes(withEmpty)),
    );
  });

  it('embed distinct domain strings', () => {
    expect(vectors.revisionCanonicalHex).toContain(toHex(new TextEncoder().encode(REVISION_SIGNING_DOMAIN)));
    expect(vectors.suggestionCanonicalHex).toContain(toHex(new TextEncoder().encode(SUGGESTION_SIGNING_DOMAIN)));
    expect(vectors.rejectCanonicalHex).toContain(
      toHex(new TextEncoder().encode(SUGGESTION_REJECT_SIGNING_DOMAIN)),
    );
    expect(vectors.keyPossessionCanonicalHex).toContain(
      toHex(new TextEncoder().encode(KEY_POSSESSION_SIGNING_DOMAIN)),
    );
    expect(vectors.articleMetaCanonicalHex).toContain(
      toHex(new TextEncoder().encode(ARTICLE_META_SIGNING_DOMAIN)),
    );
    expect(ARTICLE_META_SIGNING_DOMAIN).not.toBe(REVISION_SIGNING_DOMAIN);
    expect(ARTICLE_META_SIGNING_DOMAIN).not.toBe(SUGGESTION_SIGNING_DOMAIN);
    expect(ARTICLE_META_SIGNING_DOMAIN).not.toBe(SUGGESTION_REJECT_SIGNING_DOMAIN);
    expect(ARTICLE_META_SIGNING_DOMAIN).not.toBe(KEY_POSSESSION_SIGNING_DOMAIN);
    expect(REVISION_SIGNING_DOMAIN).not.toBe(SUGGESTION_SIGNING_DOMAIN);
    expect(SUGGESTION_REJECT_SIGNING_DOMAIN).not.toBe(SUGGESTION_SIGNING_DOMAIN);
    expect(SUGGESTION_REJECT_SIGNING_DOMAIN).not.toBe(REVISION_SIGNING_DOMAIN);
    expect(KEY_POSSESSION_SIGNING_DOMAIN).not.toBe(REVISION_SIGNING_DOMAIN);
    expect(KEY_POSSESSION_SIGNING_DOMAIN).not.toBe(SUGGESTION_SIGNING_DOMAIN);
    expect(KEY_POSSESSION_SIGNING_DOMAIN).not.toBe(SUGGESTION_REJECT_SIGNING_DOMAIN);
  });

  it('treat a missing reject note as the empty string', () => {
    const withUndefined = { ...buildReject(vectors.publicKeyHex), note: undefined };
    const withEmpty = { ...buildReject(vectors.publicKeyHex), note: '' };
    expect(toHex(canonicalRejectBytes(withUndefined))).toBe(toHex(canonicalRejectBytes(withEmpty)));
  });
});

describe('sign + verify', () => {
  it('round-trips the committed revision vector', () => {
    expect(verifyRevisionSignature(vectors.revision, vectors.revisionSignatureHex)).toBe(true);
  });

  it('round-trips the committed suggestion vector', () => {
    expect(verifySuggestionSignature(vectors.suggestion, vectors.suggestionSignatureHex)).toBe(
      true,
    );
  });

  it('rejects tampered content', () => {
    const tampered = { ...vectors.revision, bodyMd: `${vectors.revision.bodyMd} (edited)` };
    expect(verifyRevisionSignature(tampered, vectors.revisionSignatureHex)).toBe(false);
  });

  it('rejects a signature transplanted across domains', () => {
    const asSuggestion: SignableSuggestion = {
      ...vectors.suggestion,
      editorPubkey: vectors.publicKeyHex,
    };
    expect(verifySuggestionSignature(asSuggestion, vectors.revisionSignatureHex)).toBe(false);
  });

  it('rejects a wrong signer pubkey', () => {
    const other = generateDeviceIdentity('other');
    const forged = { ...vectors.revision, signerPubkey: other.publicKey };
    expect(verifyRevisionSignature(forged, vectors.revisionSignatureHex)).toBe(false);
  });

  it('fails closed on malformed signature hex', () => {
    expect(verifyRevisionSignature(vectors.revision, 'zz-not-hex')).toBe(false);
  });

  it('round-trips the committed reject vector', () => {
    expect(verifyRejectSignature(vectors.reject, vectors.rejectSignatureHex)).toBe(true);
  });

  it('rejects a reject signed with the wrong key', () => {
    const other = generateDeviceIdentity('other-reject');
    const forged = { ...vectors.reject, signerPubkey: other.publicKey };
    expect(verifyRejectSignature(forged, vectors.rejectSignatureHex)).toBe(false);
  });

  it('rejects a reject whose note was tampered', () => {
    const tampered = { ...vectors.reject, note: `${vectors.reject.note ?? ''} (edited)` };
    expect(verifyRejectSignature(tampered, vectors.rejectSignatureHex)).toBe(false);
  });

  it('rejects a reject retargeted at a different suggestion', () => {
    const retargeted = { ...vectors.reject, suggestionId: 's-other' };
    expect(verifyRejectSignature(retargeted, vectors.rejectSignatureHex)).toBe(false);
  });

  it('rejects a revision signature transplanted onto a reject', () => {
    expect(verifyRejectSignature(vectors.reject, vectors.revisionSignatureHex)).toBe(false);
  });

  it('round-trips the committed key-possession vector', () => {
    expect(verifyKeyPossessionSignature(vectors.keyPossession, vectors.keyPossessionSignatureHex)).toBe(
      true,
    );
  });

  it('rejects a key-possession signature bound to a different uid', () => {
    const retargeted = { ...vectors.keyPossession, userId: 'someone-else' };
    expect(verifyKeyPossessionSignature(retargeted, vectors.keyPossessionSignatureHex)).toBe(false);
  });

  it('rejects a key-possession signature claiming a different pubkey', () => {
    const other = generateDeviceIdentity('other-possession');
    const swapped = { ...vectors.keyPossession, pubkey: other.publicKey };
    expect(verifyKeyPossessionSignature(swapped, vectors.keyPossessionSignatureHex)).toBe(false);
  });

  it('rejects a suggestion signature transplanted onto a key possession', () => {
    expect(verifyKeyPossessionSignature(vectors.keyPossession, vectors.suggestionSignatureHex)).toBe(
      false,
    );
  });

  it('round-trips the committed article-meta vector', () => {
    expect(verifyArticleMetaSignature(vectors.articleMeta, vectors.articleMetaSignatureHex)).toBe(
      true,
    );
  });

  it('rejects article meta whose doi was tampered', () => {
    const tampered = { ...vectors.articleMeta, doi: '10.9999/forged' };
    expect(verifyArticleMetaSignature(tampered, vectors.articleMetaSignatureHex)).toBe(false);
  });

  it('rejects article meta whose dataset hashes were tampered', () => {
    const tampered = { ...vectors.articleMeta, datasetHashes: ['sha256:evil'] };
    expect(verifyArticleMetaSignature(tampered, vectors.articleMetaSignatureHex)).toBe(false);
  });

  it('rejects article meta whose canonical url was tampered', () => {
    const tampered = { ...vectors.articleMeta, canonicalUrl: 'https://evil.example/steal' };
    expect(verifyArticleMetaSignature(tampered, vectors.articleMetaSignatureHex)).toBe(false);
  });

  it('rejects article meta signed with the wrong key', () => {
    const other = generateDeviceIdentity('other-meta');
    const forged = { ...vectors.articleMeta, signerPubkey: other.publicKey };
    expect(verifyArticleMetaSignature(forged, vectors.articleMetaSignatureHex)).toBe(false);
  });

  it('rejects a revision signature transplanted onto article meta', () => {
    expect(verifyArticleMetaSignature(vectors.articleMeta, vectors.revisionSignatureHex)).toBe(
      false,
    );
  });
});
