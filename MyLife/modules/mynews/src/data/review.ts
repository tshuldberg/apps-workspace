// C9 client review orchestrators. The author decides on-device: the exact
// approved text is composed here, signed with the author's key, and enveloped
// to mynews-review. The server never composes article text. Local state is
// never mutated; screens refetch after an ok result.

import { applyDiff, combineDiffs, hashText, rebaseDiff, splitBlocks } from '../engines/diff';
import type { ChangelogEntry } from '../models';
import type { SignableReject, SignableRevision } from '../signing/canonical';
import { signReject, signRevision } from '../signing/sign';
import type { ArticleView, FunctionEnvelope, MyNewsCloudPort, SuggestionView } from './cloud';
import type { AuthorIdentity } from './publish';

export type ReviewErrorCode =
  | 'validation'
  | 'bad-signature'
  | 'not-author'
  | 'not-open'
  | 'rev-conflict'
  | 'changelog-mismatch'
  | 'batch-mixed-articles'
  | 'suspended'
  | 'terms-not-accepted'
  | 'base-mismatch'
  | 'stale'
  | 'network'
  | 'unknown';

export type AcceptResult =
  | { ok: true; rev: number }
  | { ok: false; code: ReviewErrorCode; detail?: string };

export type BatchResult =
  | { ok: true; rev: number }
  | {
      ok: false;
      code: ReviewErrorCode;
      detail?: string;
      conflicts?: Array<{ baseIndex: number; diffIndexes: number[] }>;
    };

export interface AcceptInput {
  suggestion: SuggestionView;
  /** Head text = article.bodyMd at article.rev. */
  article: ArticleView;
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
  nowIso: string;
  /** Present -> decision 'partial' (counter-edit, body suggestion types). */
  editedBodyMd?: string;
  /** LEAD-pinned C9 addition: counter-edit fields for headline-type suggestions only. */
  editedHeadline?: string;
  editedDek?: string | null;
}

// Server codes that pass through unchanged; 'bad-payload' maps to 'validation',
// anything unrecognized maps to 'unknown' with the raw error as detail.
const PASSTHROUGH_ERROR_CODES: ReadonlySet<string> = new Set([
  'bad-signature',
  'not-author',
  'not-open',
  'rev-conflict',
  'changelog-mismatch',
  'batch-mixed-articles',
  'suspended',
  'terms-not-accepted',
]);

function mapEnvelopeError(envelope: { error: string; detail?: string }): {
  code: ReviewErrorCode;
  detail?: string;
} {
  const code: ReviewErrorCode =
    envelope.error === 'bad-payload'
      ? 'validation'
      : PASSTHROUGH_ERROR_CODES.has(envelope.error)
        ? (envelope.error as ReviewErrorCode)
        : 'unknown';
  // Attach detail only when the envelope carries one; an unrecognized error
  // keeps the raw string as detail so it is never lost behind 'unknown'.
  const detail = envelope.detail ?? (code === 'unknown' ? envelope.error : undefined);
  return detail === undefined ? { code } : { code, detail };
}

/**
 * Headline pseudo-document convention (LEAD-pinned; reused by the suggest
 * composer and web surfaces): a 'headline' suggestion's diff is computed
 * against this two-block document, never the article body.
 */
export function headlineDoc(headline: string, dek: string | null | undefined): string {
  return dek ? `${headline}\n\n${dek}` : headline;
}

export function splitHeadlineDoc(doc: string): { headline: string; dek: string | null } {
  const blocks = splitBlocks(doc);
  // The dek may legally contain blank lines (multiple blocks); keep all of them.
  return { headline: blocks[0] ?? '', dek: blocks.length > 1 ? blocks.slice(1).join('\n\n') : null };
}

/**
 * Accept (or counter-edit as 'partial') one suggestion: apply its diff to the
 * head, build the next revision, sign, and envelope to mynews-review. On
 * base-mismatch the diff is rebased onto the head; irrecoverable relocation
 * reports 'stale' so the UI can ask for a refresh.
 */
export async function acceptSuggestion(input: AcceptInput): Promise<AcceptResult> {
  const { suggestion, article } = input;
  if (suggestion.articleId !== article.articleId) {
    return { ok: false, code: 'validation', detail: 'suggestion belongs to a different article' };
  }
  const isHeadline = suggestion.type === 'headline';
  // Counter-edit fields must match the suggestion type; anything else fails
  // closed here rather than being silently dropped as a 'partial' decision.
  const mismatchedCounterEdit = isHeadline
    ? input.editedBodyMd !== undefined
    : input.editedHeadline !== undefined || input.editedDek !== undefined;
  if (mismatchedCounterEdit) {
    return { ok: false, code: 'validation', detail: 'counter-edit fields do not match suggestion type' };
  }
  const counterEdit =
    input.editedBodyMd !== undefined ||
    input.editedHeadline !== undefined ||
    input.editedDek !== undefined;
  const decision = counterEdit ? 'partial' : 'accept';

  const baseDoc = isHeadline ? headlineDoc(article.headline, article.dek) : article.bodyMd;
  // A counter-edit that fully specifies the outcome never needs the applied text.
  const needsApply = isHeadline
    ? input.editedHeadline === undefined || input.editedDek === undefined
    : input.editedBodyMd === undefined;

  let appliedDoc: string | null = null;
  if (needsApply) {
    let diff = suggestion.diff;
    if (diff.baseHash !== hashText(baseDoc)) {
      const rebased = rebaseDiff(diff, '', baseDoc);
      if (rebased.status === 'stale') return { ok: false, code: 'stale' };
      if (rebased.status === 'rebased') diff = rebased.diff;
    }
    const applied = applyDiff(baseDoc, diff);
    if (!applied.ok) {
      return applied.reason === 'base-mismatch'
        ? { ok: false, code: 'stale', detail: applied.reason }
        : { ok: false, code: 'validation', detail: applied.reason };
    }
    appliedDoc = applied.text;
  }

  let headline = article.headline;
  let dek = article.dek;
  let bodyMd = article.bodyMd;
  if (isHeadline) {
    const applied = appliedDoc === null ? null : splitHeadlineDoc(appliedDoc);
    headline = input.editedHeadline ?? applied!.headline;
    const nextDek = input.editedDek === undefined ? applied!.dek : input.editedDek;
    dek = nextDek ?? undefined;
  } else {
    bodyMd = input.editedBodyMd ?? appliedDoc!;
  }

  const revision: SignableRevision = {
    articleId: article.articleId,
    rev: article.rev + 1,
    headline,
    dek,
    bodyMd,
    changelog: [changelogEntry(suggestion)],
    createdAt: input.nowIso,
    signerPubkey: input.identity.pubkeyHex,
  };
  const signatureHex = signRevision(revision, input.identity.privateKeyHex);

  let envelope: FunctionEnvelope<{ rev: number }>;
  try {
    envelope = await input.port.callFunction('mynews-review', {
      suggestionId: suggestion.id,
      decision,
      revision,
      signatureHex,
    });
  } catch (error) {
    return { ok: false, code: 'network', detail: (error as Error).message };
  }
  if (envelope.ok) return { ok: true, rev: revision.rev };
  return { ok: false, ...mapEnvelopeError(envelope) };
}

/**
 * Accept N suggestions as one revision (batch copyedit). LEAD-pinned: the
 * batch never auto-rebases; every diff must target the current head hash
 * exactly, otherwise 'base-mismatch' tells the UI to refresh the queue.
 * Combine conflicts bubble so the UI can exclude one side.
 */
export async function acceptBatch(input: {
  suggestions: SuggestionView[];
  article: ArticleView;
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
  nowIso: string;
}): Promise<BatchResult> {
  const { suggestions, article } = input;
  if (suggestions.length === 0) {
    return { ok: false, code: 'validation', detail: 'empty batch' };
  }
  if (suggestions.some((s) => s.articleId !== article.articleId)) {
    return { ok: false, code: 'validation', detail: 'suggestion belongs to a different article' };
  }
  // Headline diffs target the pseudo-document, never the body head; letting
  // them fall through would report a misleading 'base-mismatch'.
  if (suggestions.some((s) => s.type === 'headline')) {
    return { ok: false, code: 'validation', detail: 'batch accept supports body suggestions only' };
  }
  const headHash = hashText(article.bodyMd);
  if (suggestions.some((s) => s.diff.baseHash !== headHash)) {
    return { ok: false, code: 'base-mismatch' };
  }
  const combined = combineDiffs(suggestions.map((s) => s.diff));
  if (!combined.ok) {
    return {
      ok: false,
      code: 'validation',
      detail: 'conflicting suggestions',
      conflicts: combined.conflicts,
    };
  }
  const applied = applyDiff(article.bodyMd, combined.diff);
  if (!applied.ok) return { ok: false, code: 'validation', detail: applied.reason };

  const revision: SignableRevision = {
    articleId: article.articleId,
    rev: article.rev + 1,
    headline: article.headline,
    dek: article.dek,
    bodyMd: applied.text,
    changelog: suggestions.map(changelogEntry),
    createdAt: input.nowIso,
    signerPubkey: input.identity.pubkeyHex,
  };
  const signatureHex = signRevision(revision, input.identity.privateKeyHex);

  let envelope: FunctionEnvelope<{ rev: number }>;
  try {
    envelope = await input.port.callFunction('mynews-review', {
      suggestionIds: suggestions.map((s) => s.id),
      decision: 'accept',
      revision,
      signatureHex,
    });
  } catch (error) {
    return { ok: false, code: 'network', detail: (error as Error).message };
  }
  if (envelope.ok) return { ok: true, rev: revision.rev };
  return { ok: false, ...mapEnvelopeError(envelope) };
}

/**
 * Reject one suggestion, optionally with a note (<= 2000 chars, per C4). The
 * author signs a reject envelope (F3): the server verifies it against the head
 * author key, so a reject no longer authorizes off an unverified JWT sub alone.
 * The note is inside the signed bytes and cannot be tampered in transit.
 */
export async function rejectSuggestion(input: {
  suggestion: SuggestionView;
  article: ArticleView;
  identity: AuthorIdentity;
  note?: string;
  port: MyNewsCloudPort;
}): Promise<{ ok: boolean; code?: ReviewErrorCode }> {
  if (input.note !== undefined && input.note.length > 2000) {
    return { ok: false, code: 'validation' };
  }
  if (input.suggestion.articleId !== input.article.articleId) {
    return { ok: false, code: 'validation' };
  }
  const signable: SignableReject = {
    suggestionId: input.suggestion.id,
    articleId: input.suggestion.articleId,
    baseRev: input.suggestion.baseRev,
    ...(input.note !== undefined ? { note: input.note } : {}),
    signerPubkey: input.identity.pubkeyHex,
  };
  const signatureHex = signReject(signable, input.identity.privateKeyHex);

  let envelope: FunctionEnvelope<unknown>;
  try {
    envelope = await input.port.callFunction('mynews-review', {
      suggestionId: input.suggestion.id,
      decision: 'reject',
      signatureHex,
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
  } catch {
    return { ok: false, code: 'network' };
  }
  if (envelope.ok) return { ok: true };
  return { ok: false, code: mapEnvelopeError(envelope).code };
}

function changelogEntry(s: SuggestionView): ChangelogEntry {
  return { suggestionId: s.id, editorKey: s.editorPubkey, type: s.type };
}
