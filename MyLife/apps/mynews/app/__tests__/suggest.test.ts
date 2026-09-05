import { describe, expect, it } from 'vitest';
import {
  InMemoryCloudAdapter,
  computeDiff,
  hashText,
  splitBlocks,
  verifySuggestionSignature,
  type FunctionEnvelope,
  type SignableSuggestion,
} from '@mylife/mynews';
import { generateDeviceIdentity, extractSigningPrivateKeyHex } from '@mylife/sync';
import {
  buildBodyProposal,
  buildHeadlineProposal,
  diffPreviewRows,
  requiresCitation,
  submitSuggestionFlow,
  validateSuggestionDraft,
} from '../(root)/lib/suggest';

const BODY = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';

function identity() {
  const device = generateDeviceIdentity('Test Editor');
  return {
    pubkeyHex: device.publicKey,
    privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
  };
}

describe('buildBodyProposal', () => {
  it('replaces the selected paragraph in edit mode', () => {
    const proposal = buildBodyProposal({
      bodyMd: BODY,
      blockIndex: 1,
      mode: 'edit',
      text: 'Second paragraph, fixed.',
    });
    expect(splitBlocks(proposal)).toEqual([
      'First paragraph.',
      'Second paragraph, fixed.',
      'Third paragraph.',
    ]);
  });

  it('inserts after the selected paragraph in insert-after mode', () => {
    const proposal = buildBodyProposal({
      bodyMd: BODY,
      blockIndex: 0,
      mode: 'insert-after',
      text: 'New context paragraph.',
    });
    expect(splitBlocks(proposal)).toEqual([
      'First paragraph.',
      'New context paragraph.',
      'Second paragraph.',
      'Third paragraph.',
    ]);
  });

  it('throws on an out-of-range block index', () => {
    expect(() =>
      buildBodyProposal({ bodyMd: BODY, blockIndex: 3, mode: 'edit', text: 'x' }),
    ).toThrow(RangeError);
  });
});

describe('buildHeadlineProposal', () => {
  it('diffs against the two-block headline pseudo-document', () => {
    const { baseDoc, proposedDoc } = buildHeadlineProposal({
      headline: 'Old headline',
      dek: 'Old dek',
      editedHeadline: 'New headline',
      editedDek: 'Old dek',
    });
    expect(baseDoc).toBe('Old headline\n\nOld dek');
    expect(proposedDoc).toBe('New headline\n\nOld dek');
  });

  it('drops a blanked dek from the proposal', () => {
    const { proposedDoc } = buildHeadlineProposal({
      headline: 'H',
      dek: 'D',
      editedHeadline: 'H',
      editedDek: '   ',
    });
    expect(proposedDoc).toBe('H');
  });
});

describe('diffPreviewRows', () => {
  it('renders ctx, del, and add rows around a replace', () => {
    const diff = computeDiff(BODY, buildBodyProposal({
      bodyMd: BODY,
      blockIndex: 1,
      mode: 'edit',
      text: 'Second paragraph, fixed.',
    }));
    expect(diffPreviewRows(diff)).toEqual([
      { kind: 'ctx', text: 'First paragraph.' },
      { kind: 'del', text: 'Second paragraph.' },
      { kind: 'add', text: 'Second paragraph, fixed.' },
      { kind: 'ctx', text: 'Third paragraph.' },
    ]);
  });

  it('collapses duplicate context between adjacent ops', () => {
    const proposed = 'First paragraph, fixed.\n\nSecond paragraph.\n\nThird paragraph, fixed.';
    const rows = diffPreviewRows(computeDiff(BODY, proposed));
    const ctxRows = rows.filter((row) => row.kind === 'ctx' && row.text === 'Second paragraph.');
    expect(ctxRows).toHaveLength(1);
  });
});

describe('validateSuggestionDraft', () => {
  const diff = computeDiff(BODY, BODY.replace('Second', '2nd'));

  it('requires a change', () => {
    const errors = validateSuggestionDraft({
      type: 'copyedit',
      diff: null,
      citations: [],
      rationale: 'r',
    });
    expect(errors[0]?.field).toBe('diff');
  });

  it('enforces the citation floor for correction and context only', () => {
    expect(requiresCitation('correction')).toBe(true);
    expect(requiresCitation('context')).toBe(true);
    expect(requiresCitation('copyedit')).toBe(false);
    const errors = validateSuggestionDraft({
      type: 'correction',
      diff,
      citations: [],
      rationale: 'r',
    });
    expect(errors).toEqual([
      { field: 'citations', message: 'Corrections and context need at least one https citation.' },
    ]);
    expect(
      validateSuggestionDraft({
        type: 'clarity',
        diff,
        citations: [],
        rationale: 'r',
      }),
    ).toEqual([]);
  });

  it('rejects non-https citations', () => {
    const errors = validateSuggestionDraft({
      type: 'copyedit',
      diff,
      citations: ['http://example.com/a'],
      rationale: 'r',
    });
    expect(errors).toEqual([{ field: 'citations', message: 'Citations must be https links.' }]);
  });

  it('requires a rationale', () => {
    const errors = validateSuggestionDraft({
      type: 'copyedit',
      diff,
      citations: [],
      rationale: '   ',
    });
    expect(errors).toEqual([
      { field: 'rationale', message: 'Add a short rationale for this change.' },
    ]);
  });
});

describe('submitSuggestionFlow', () => {
  const article = { articleId: 'a-1', rev: 3 };
  const diff = computeDiff(BODY, BODY.replace('Second', '2nd'));

  function portWith(
    handler: (body: unknown) => FunctionEnvelope<unknown>,
  ): { port: InMemoryCloudAdapter; calls: unknown[] } {
    const port = new InMemoryCloudAdapter();
    const calls: unknown[] = [];
    port.functionHandler = (name, body) => {
      expect(name).toBe('mynews-suggest');
      calls.push(body);
      return handler(body);
    };
    return { port, calls };
  }

  it('submits a signed suggestion built against the article head rev', async () => {
    const id = identity();
    const { port, calls } = portWith((body) => ({
      ok: true,
      data: { suggestionId: (body as { suggestion: { id: string } }).suggestion.id },
    }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: ['  https://example.com/source  ', ''],
      rationale: ' Tighter wording. ',
      suggestionId: 's-1',
      identity: id,
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome).toEqual({ ok: true, suggestionId: 's-1', collapsed: false });
    const sent = calls[0] as { suggestion: SignableSuggestion & { id: string }; signatureHex: string };
    expect(sent.suggestion.baseRev).toBe(3);
    expect(sent.suggestion.articleId).toBe('a-1');
    expect(sent.suggestion.citations).toEqual(['https://example.com/source']);
    expect(sent.suggestion.rationale).toBe('Tighter wording.');
    expect(sent.suggestion.editorPubkey).toBe(id.pubkeyHex);
    expect(JSON.parse(sent.suggestion.diffJson).baseHash).toBe(hashText(BODY));
    expect(
      verifySuggestionSignature(
        {
          articleId: sent.suggestion.articleId,
          baseRev: sent.suggestion.baseRev,
          type: sent.suggestion.type,
          diffJson: sent.suggestion.diffJson,
          citations: sent.suggestion.citations,
          rationale: sent.suggestion.rationale,
          editorPubkey: sent.suggestion.editorPubkey,
        },
        sent.signatureHex,
      ),
    ).toBe(true);
  });

  it('detects the collapsed success variant from the C4 envelope flag', async () => {
    const { port } = portWith(() => ({
      ok: true,
      data: { suggestionId: 's-original', collapsed: true },
    }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: [],
      rationale: 'dupe fix',
      suggestionId: 's-mine',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome).toEqual({ ok: true, suggestionId: 's-original', collapsed: true });
  });

  it('falls back to the id-difference check when the flag is absent', async () => {
    const { port } = portWith(() => ({
      ok: true,
      data: { suggestionId: 's-original' },
    }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: [],
      rationale: 'dupe fix',
      suggestionId: 's-mine',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome).toEqual({ ok: true, suggestionId: 's-original', collapsed: true });
  });

  it('fails the citation floor client-side without any network call', async () => {
    const { port, calls } = portWith(() => ({ ok: false, error: 'should-not-be-called' }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'context',
      diff,
      citations: [],
      rationale: 'needs context',
      suggestionId: 's-1',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.field).toBe('citations');
      expect(outcome.message).toContain('at least one https citation');
    }
    expect(calls).toHaveLength(0);
  });

  it('maps citation-floor from the server onto the citations field too', async () => {
    const { port } = portWith(() => ({ ok: false, error: 'citation-floor' }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: [],
      rationale: 'r',
      suggestionId: 's-1',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.field).toBe('citations');
  });

  it('routes no-profile to the register action', async () => {
    const { port } = portWith(() => ({ ok: false, error: 'no-profile' }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: [],
      rationale: 'r',
      suggestionId: 's-1',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.action).toBe('register');
  });

  it('surfaces the real cap message from cap-exceeded detail', async () => {
    const { port } = portWith(() => ({
      ok: false,
      error: 'cap-exceeded',
      detail: 'Your open cap is 5.',
    }));
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: [],
      rationale: 'r',
      suggestionId: 's-1',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('Your open cap is 5.');
  });

  it('maps a thrown port failure to honest network copy', async () => {
    const port = new InMemoryCloudAdapter();
    port.callFunction = async () => {
      throw new Error('offline');
    };
    const outcome = await submitSuggestionFlow({
      article,
      type: 'copyedit',
      diff,
      citations: [],
      rationale: 'r',
      suggestionId: 's-1',
      identity: identity(),
      port,
      nowIso: '2026-07-03T00:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain('Could not reach the MyNews server');
  });
});
