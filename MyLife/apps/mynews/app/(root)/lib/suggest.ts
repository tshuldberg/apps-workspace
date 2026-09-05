// C8.1 suggest composer logic. Everything nontrivial lives here as pure
// functions so the screen stays a thin surface and this flow unit-tests
// against the module's InMemoryCloudAdapter. The collapsed success variant
// (near-dupe endorsement) reads the envelope's collapsed flag (C4), with an
// honest fallback: a collapse returns the ORIGINAL suggestion's id, so a
// returned id different from the one we minted also means collapsed.

import {
  HttpsUrlSchema,
  computeDiff,
  headlineDoc,
  splitBlocks,
  submitSuggestion,
  type AuthorIdentity,
  type MyNewsCloudPort,
  type SignableSuggestion,
  type StructuredDiff,
  type SuggestionType,
} from '@mylife/mynews';
import { deskErrorMessage, type DeskErrorAction } from './desk-errors';

export type SuggestMode = 'edit' | 'insert-after';

/** Types whose suggestions require at least one https citation (models.ts CITATION_REQUIRED). */
export const CITATION_REQUIRED_TYPES: readonly SuggestionType[] = ['correction', 'context'];

export function requiresCitation(type: SuggestionType): boolean {
  return CITATION_REQUIRED_TYPES.includes(type);
}

/**
 * Build the proposed body document from a single-block edit. `edit` replaces
 * the selected paragraph with the edited text; `insert-after` keeps the
 * paragraph and adds the new text after it. The text may itself contain
 * blank lines; computeDiff handles the resulting multi-block change.
 */
export function buildBodyProposal(input: {
  bodyMd: string;
  blockIndex: number;
  mode: SuggestMode;
  text: string;
}): string {
  const blocks = splitBlocks(input.bodyMd);
  if (input.blockIndex < 0 || input.blockIndex >= blocks.length) {
    throw new RangeError(`buildBodyProposal: block ${input.blockIndex} is out of range`);
  }
  const next = [...blocks];
  if (input.mode === 'edit') {
    next[input.blockIndex] = input.text;
  } else {
    next.splice(input.blockIndex + 1, 0, input.text);
  }
  return next.join('\n\n');
}

/**
 * Headline suggestions diff the two-block pseudo-document (module convention:
 * headlineDoc / splitHeadlineDoc), never the article body.
 */
export function buildHeadlineProposal(input: {
  headline: string;
  dek: string | null | undefined;
  editedHeadline: string;
  editedDek: string;
}): { baseDoc: string; proposedDoc: string } {
  return {
    baseDoc: headlineDoc(input.headline, input.dek ?? null),
    proposedDoc: headlineDoc(input.editedHeadline, input.editedDek.trim() ? input.editedDek : null),
  };
}

export interface DiffPreviewRow {
  kind: 'ctx' | 'del' | 'add';
  text: string;
}

/**
 * Rows for the live diff preview card: anchor context (dimmed), removed
 * blocks, added blocks. Consecutive duplicate rows collapse so an op's
 * anchorAfter and the next op's anchorBefore render once.
 */
export function diffPreviewRows(diff: StructuredDiff): DiffPreviewRow[] {
  const rows: DiffPreviewRow[] = [];
  const push = (row: DiffPreviewRow) => {
    const last = rows[rows.length - 1];
    if (last && last.kind === row.kind && last.text === row.text) return;
    rows.push(row);
  };
  for (const op of diff.ops) {
    if (op.anchorBefore !== null) push({ kind: 'ctx', text: op.anchorBefore });
    for (const block of op.baseBlocks) push({ kind: 'del', text: block });
    for (const block of op.newBlocks) push({ kind: 'add', text: block });
    if (op.anchorAfter !== null) push({ kind: 'ctx', text: op.anchorAfter });
  }
  return rows;
}

export interface SuggestValidationError {
  field: 'diff' | 'citations' | 'rationale';
  message: string;
}

/** Client-side validation mirroring EditSuggestionSchema plus the citation floor. */
export function validateSuggestionDraft(input: {
  type: SuggestionType;
  diff: StructuredDiff | null;
  citations: string[];
  rationale: string;
}): SuggestValidationError[] {
  const errors: SuggestValidationError[] = [];
  if (!input.diff || input.diff.ops.length === 0) {
    errors.push({
      field: 'diff',
      message: 'No change yet. Edit the text to build a suggestion.',
    });
  }
  for (const citation of input.citations) {
    if (!HttpsUrlSchema.safeParse(citation).success) {
      errors.push({ field: 'citations', message: 'Citations must be https links.' });
      break;
    }
  }
  if (requiresCitation(input.type) && input.citations.length === 0) {
    errors.push({
      field: 'citations',
      message: 'Corrections and context need at least one https citation.',
    });
  }
  if (!input.rationale.trim()) {
    errors.push({ field: 'rationale', message: 'Add a short rationale for this change.' });
  }
  return errors;
}

export type SuggestOutcome =
  | { ok: true; suggestionId: string; collapsed: boolean }
  | {
      ok: false;
      message: string;
      action?: DeskErrorAction;
      field?: SuggestValidationError['field'];
    };

/**
 * Validate, sign, and submit one suggestion. Citations are trimmed and empty
 * rows dropped before validation; the citation floor and https rule fail
 * inline on the citations field. Server errors map through deskErrorMessage
 * (no-profile carries the register action).
 */
export async function submitSuggestionFlow(input: {
  article: { articleId: string; rev: number };
  type: SuggestionType;
  diff: StructuredDiff | null;
  citations: string[];
  rationale: string;
  suggestionId: string;
  identity: AuthorIdentity;
  port: MyNewsCloudPort;
  nowIso: string;
}): Promise<SuggestOutcome> {
  const citations = input.citations.map((c) => c.trim()).filter((c) => c.length > 0);
  const rationale = input.rationale.trim();
  const errors = validateSuggestionDraft({
    type: input.type,
    diff: input.diff,
    citations,
    rationale,
  });
  if (errors.length > 0) {
    const first = errors[0]!;
    return { ok: false, message: first.message, field: first.field };
  }

  const signable: SignableSuggestion = {
    articleId: input.article.articleId,
    baseRev: input.article.rev,
    type: input.type,
    diffJson: JSON.stringify(input.diff),
    citations,
    rationale,
    editorPubkey: input.identity.pubkeyHex,
  };
  const result = await submitSuggestion({
    suggestionId: input.suggestionId,
    signable,
    identity: input.identity,
    port: input.port,
    nowIso: input.nowIso,
  });
  if (result.ok) {
    return {
      ok: true,
      suggestionId: result.suggestionId,
      collapsed: result.collapsed === true || result.suggestionId !== input.suggestionId,
    };
  }
  const copy = deskErrorMessage(result.code, result.detail);
  return {
    ok: false,
    message: copy.message,
    action: copy.action,
    field: result.code === 'citation-floor' ? 'citations' : undefined,
  };
}
