import { EditSuggestionSchema } from '../models';
import type { ChangelogEntry } from '../models';
import type { SignableRevision, SignableSuggestion } from '../signing/canonical';
import { signRevision, signSuggestion } from '../signing/sign';
import type { Draft } from './drafts';
import { draftToSignableRevision } from './drafts';
import type { FunctionEnvelope, MyNewsCloudPort } from './cloud';

export interface AuthorIdentity {
  pubkeyHex: string;
  privateKeyHex: string;
}

export type PublishResult =
  | { ok: true; articleId: string; rev: number; slug: string }
  | { ok: false; code: PublishErrorCode; detail?: string };

export type PublishErrorCode =
  | 'validation'
  | 'no-profile'
  | 'bad-signature'
  | 'rev-conflict'
  | 'author-mismatch'
  | 'not-newsroom-member'
  | 'screen-hold'
  | 'suspended'
  | 'terms-not-accepted'
  | 'not-signed-in'
  /**
   * Key custody (plan 48 WP6). The signature was fine; the KEY behind it is no
   * longer allowed to author, because it was rotated or revoked. Distinct from
   * 'bad-signature' on purpose: telling the author their signature failed would
   * send them chasing a problem that does not exist.
   */
  | 'key-revoked'
  /** The server could not verify the key state, so it refused rather than guess. */
  | 'key-unavailable'
  | 'network'
  | 'unknown';

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  'no-profile',
  'bad-signature',
  'rev-conflict',
  'author-mismatch',
  'not-newsroom-member',
  'screen-hold',
  'suspended',
  'terms-not-accepted',
  'not-signed-in',
  'key-revoked',
  'key-unavailable',
]);

export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug.length >= 3 ? slug : `${slug}${'x'.repeat(3 - slug.length)}`;
}

/**
 * Publish a local draft as revision 1 of a new article (or head+1 when
 * republishing a correction). Validates, canonicalizes, signs with the
 * author's device key, and envelopes to the mynews-publish edge function.
 * Local state is never mutated here; the caller deletes the draft only on ok.
 */
export async function publishDraft(input: {
  draft: Draft;
  articleId: string;
  rev: number;
  changelog?: ChangelogEntry[];
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
  nowIso: string;
  slug?: string;
  /** C4: scopes the article to a newsroom; required when publishing as a draft. */
  newsroomId?: string;
  /**
   * C4 `article.draft`: true saves a server-side newsroom draft instead of
   * publishing. Named asDraft because `draft` already carries the local
   * content. Both fields are omitted from the envelope when absent, keeping
   * P1 publish calls byte-identical.
   */
  asDraft?: boolean;
}): Promise<PublishResult> {
  let revision: SignableRevision;
  try {
    revision = draftToSignableRevision({
      draft: input.draft,
      articleId: input.articleId,
      rev: input.rev,
      changelog: input.changelog ?? [],
      createdAt: input.nowIso,
      signerPubkey: input.identity.pubkeyHex,
    });
  } catch (error) {
    return { ok: false, code: 'validation', detail: (error as Error).message };
  }

  const slug = input.slug ?? slugify(revision.headline);
  const signatureHex = signRevision(revision, input.identity.privateKeyHex);

  let envelope: FunctionEnvelope<{ articleId: string; rev: number; slug: string }>;
  try {
    envelope = await input.port.callFunction('mynews-publish', {
      article: {
        id: input.articleId,
        slug,
        kind: input.draft.kind,
        authorPubkey: input.identity.pubkeyHex,
        ...(input.newsroomId !== undefined ? { newsroomId: input.newsroomId } : {}),
        ...(input.asDraft === true ? { draft: true } : {}),
      },
      revision,
      signatureHex,
    });
  } catch (error) {
    return { ok: false, code: 'network', detail: (error as Error).message };
  }

  if (envelope.ok) {
    return { ok: true, ...envelope.data };
  }
  // The server rejects malformed envelopes as 'bad-payload'; to the caller
  // that is a validation failure, same as the client-side Zod path.
  const code =
    envelope.error === 'bad-payload'
      ? 'validation'
      : KNOWN_ERROR_CODES.has(envelope.error)
        ? (envelope.error as PublishErrorCode)
        : 'unknown';
  return { ok: false, code, detail: envelope.detail ?? envelope.error };
}

export type SuggestResult =
  /**
   * `collapsed: true` (C4) means the server recorded a near-dupe endorsement
   * instead of a new row; `suggestionId` is then the ORIGINAL suggestion's id.
   */
  | { ok: true; suggestionId: string; collapsed?: boolean }
  | { ok: false; code: 'validation' | 'network' | string; detail?: string };

/** Sign and submit an edit suggestion. Client-side Zod validation first. */
export async function submitSuggestion(input: {
  suggestionId: string;
  signable: SignableSuggestion;
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
  nowIso: string;
}): Promise<SuggestResult> {
  const parsed = EditSuggestionSchema.safeParse({
    id: input.suggestionId,
    articleId: input.signable.articleId,
    baseRev: input.signable.baseRev,
    editorKey: input.signable.editorPubkey,
    type: input.signable.type,
    diff: JSON.parse(input.signable.diffJson),
    citations: input.signable.citations,
    rationale: input.signable.rationale,
    status: 'open',
    createdAt: input.nowIso,
  });
  if (!parsed.success) {
    return { ok: false, code: 'validation', detail: parsed.error.issues[0]?.message };
  }

  const signatureHex = signSuggestion(input.signable, input.identity.privateKeyHex);
  try {
    const envelope = await input.port.callFunction<{ suggestionId: string; collapsed?: boolean }>(
      'mynews-suggest',
      {
        suggestion: {
          id: input.suggestionId,
          ...input.signable,
          createdAt: input.nowIso,
        },
        signatureHex,
      },
    );
    if (envelope.ok) {
      return {
        ok: true,
        suggestionId: envelope.data.suggestionId,
        ...(envelope.data.collapsed === true ? { collapsed: true } : {}),
      };
    }
    return { ok: false, code: envelope.error, detail: envelope.detail };
  } catch (error) {
    return { ok: false, code: 'network', detail: (error as Error).message };
  }
}
