// Client orchestrator for signed article metadata (Track 0.5). Provenance
// fields (DOI, ORCID authors, license, rights route, embargo, dataset hashes,
// canonical URL) are author assertions bound under the article-meta signature,
// so the author signs the FULL meta on-device and the write goes through
// mynews-set-meta (the client-write guard forbids direct writes). A single-field
// edit (e.g. an embargo change) reads the current meta first and merges, so it
// never clobbers the other signed fields. Honest typed errors, no fake success.

import type { SignableArticleMeta } from '../signing/canonical';
import { signArticleMeta } from '../signing/sign';
import type { ArticleMetaView, MyNewsCloudPort } from './cloud';
import type { AuthorIdentity } from './publish';

export type MetaErrorCode =
  | 'not-signed-in'
  | 'bad-signature'
  | 'not-author'
  | 'bad-payload'
  | 'network'
  | 'unknown';

export type MetaResult = { ok: true } | { ok: false; code: MetaErrorCode };

/** The mutable provenance fields; every field must be supplied for a full write. */
export interface ArticleMetaFields {
  doi: string | null;
  orcidAuthors: string[];
  license: string;
  rightsRoute: string;
  embargoUntil: string | null;
  datasetHashes: string[];
  canonicalUrl: string | null;
}

/** Empty provenance baseline for an article that has no meta row yet. */
export function emptyMetaFields(): ArticleMetaFields {
  return {
    doi: null,
    orcidAuthors: [],
    license: '',
    rightsRoute: '',
    embargoUntil: null,
    datasetHashes: [],
    canonicalUrl: null,
  };
}

function fieldsFromView(view: ArticleMetaView): ArticleMetaFields {
  return {
    doi: view.doi,
    orcidAuthors: view.orcidAuthors,
    license: view.license,
    rightsRoute: view.rightsRoute,
    embargoUntil: view.embargoUntil,
    datasetHashes: view.datasetHashes,
    canonicalUrl: view.canonicalUrl,
  };
}

function mapMetaError(error: string | undefined): MetaErrorCode {
  switch (error) {
    case 'not-signed-in':
      return 'not-signed-in';
    case 'bad-signature':
      return 'bad-signature';
    case 'not-author':
      return 'not-author';
    case 'bad-payload':
    case 'function-400':
    case 'function-404':
      return 'bad-payload';
    default:
      return 'unknown';
  }
}

/**
 * Sign the full provenance metadata for an article and upsert it through
 * mynews-set-meta. `fields` is the complete post-edit provenance state; the
 * caller (e.g. an embargo editor) is responsible for merging its single edit
 * onto the current meta before calling.
 */
export async function saveArticleMeta(input: {
  articleId: string;
  fields: ArticleMetaFields;
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
}): Promise<MetaResult> {
  const meta = {
    articleId: input.articleId,
    doi: input.fields.doi,
    orcidAuthors: input.fields.orcidAuthors,
    license: input.fields.license,
    rightsRoute: input.fields.rightsRoute,
    embargoUntil: input.fields.embargoUntil,
    datasetHashes: input.fields.datasetHashes,
    canonicalUrl: input.fields.canonicalUrl,
    signerPubkey: input.identity.pubkeyHex,
  };
  const signable: SignableArticleMeta = meta;
  const signatureHex = signArticleMeta(signable, input.identity.privateKeyHex);

  let res: Awaited<ReturnType<MyNewsCloudPort['setArticleMeta']>>;
  try {
    res = await input.port.setArticleMeta({ meta, signatureHex });
  } catch {
    return { ok: false, code: 'network' };
  }
  if (res.ok) return { ok: true };
  return { ok: false, code: mapMetaError(res.error) };
}

/**
 * Read-modify-sign for the embargo field only: fetch the current signed meta,
 * override just the embargo, and re-sign the whole record so the other
 * provenance fields keep their author signature. A missing meta row starts from
 * the empty baseline.
 */
export async function saveArticleEmbargo(input: {
  articleId: string;
  embargoUntil: string | null;
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
}): Promise<MetaResult> {
  let current: ArticleMetaView | null;
  try {
    current = await input.port.getArticleMeta(input.articleId);
  } catch {
    return { ok: false, code: 'network' };
  }
  const fields = current ? fieldsFromView(current) : emptyMetaFields();
  return saveArticleMeta({
    articleId: input.articleId,
    fields: { ...fields, embargoUntil: input.embargoUntil },
    identity: input.identity,
    port: input.port,
  });
}
