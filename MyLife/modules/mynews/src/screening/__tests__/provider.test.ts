import { describe, expect, it, vi } from 'vitest';

import { ADVERSARIAL_CASES, CLEAN_CASES } from '../__fixtures__/corpus';
import { screenContent } from '../engine';
import {
  mergeVendorScores,
  screenWithProvider,
  type ScreeningProvider,
} from '../provider';
import { DEFAULT_SCREENING_CONFIG, type ScreeningInput } from '../types';

const cleanInput: ScreeningInput = { kind: 'article', text: CLEAN_CASES[0]!.text };
const hateInput: ScreeningInput = { kind: 'comment', text: ADVERSARIAL_CASES[0]!.text };

function provider(
  impl: ScreeningProvider['screen'],
  name = 'testvendor',
): ScreeningProvider {
  return { name, screen: impl };
}

describe('screenWithProvider: unconfigured', () => {
  it('reports an explicit unconfigured state and returns the local verdict', async () => {
    const result = await screenWithProvider(cleanInput);
    expect(result.providerState).toBe('unconfigured');
    expect(result.providerName).toBeNull();
    expect(result.verdict.provider).toBe('local');
    expect(result.verdict).toEqual(screenContent(cleanInput));
    expect(result.providerNote).toContain('No external screening vendor is configured');
  });

  it('still holds adversarial content with no vendor at all', async () => {
    const result = await screenWithProvider(hateInput);
    expect(result.providerState).toBe('unconfigured');
    expect(result.verdict.decision).toBe('quarantine');
  });
});

describe('screenWithProvider: failure modes fail closed to local', () => {
  it('treats a thrown vendor call as failed and keeps the local verdict', async () => {
    const result = await screenWithProvider(hateInput, {
      provider: provider(() => {
        throw new Error('boom');
      }),
    });
    expect(result.providerState).toBe('failed');
    expect(result.verdict.decision).toBe('quarantine');
    expect(result.providerNote).toContain('failed');
  });

  it('treats a rejected promise as failed', async () => {
    const result = await screenWithProvider(cleanInput, {
      provider: provider(() => Promise.reject(new Error('nope'))),
    });
    expect(result.providerState).toBe('failed');
    expect(result.verdict).toEqual(screenContent(cleanInput));
  });

  it('treats a null result as declined, never as a clear', async () => {
    const result = await screenWithProvider(hateInput, {
      provider: provider(async () => null),
    });
    expect(result.providerState).toBe('declined');
    expect(result.verdict.decision).toBe('quarantine');
  });

  it('times out without hanging and keeps the local verdict', async () => {
    vi.useFakeTimers();
    try {
      const pending = screenWithProvider(hateInput, {
        provider: provider(() => new Promise(() => {})),
        timeoutMs: 50,
      });
      await vi.advanceTimersByTimeAsync(60);
      const result = await pending;
      expect(result.providerState).toBe('timed-out');
      expect(result.verdict.decision).toBe('quarantine');
      expect(result.providerNote).toContain('did not answer in time');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never fabricates a vendor name when no vendor ran', async () => {
    const result = await screenWithProvider(cleanInput);
    expect(result.verdict.provider).not.toContain('+');
  });
});

describe('screenWithProvider: a vendor may escalate but never clear', () => {
  it('raises a class over its threshold on vendor evidence', async () => {
    const local = screenContent(cleanInput);
    expect(local.decision).toBe('allow');
    const result = await screenWithProvider(cleanInput, {
      provider: provider(async () => ({ classScores: { hate: 0.9 } })),
    });
    expect(result.providerState).toBe('scored');
    expect(result.verdict.decision).toBe('quarantine');
    expect(result.verdict.topClass).toBe('hate');
    expect(result.verdict.provider).toBe('local+testvendor');
  });

  it('cannot lower a local class score', async () => {
    const local = screenContent(hateInput);
    const result = await screenWithProvider(hateInput, {
      provider: provider(async () => ({ classScores: { hate: 0 } })),
    });
    expect(result.verdict.classScores.hate).toBe(local.classScores.hate);
    expect(result.verdict.decision).toBe('quarantine');
  });

  it('cannot clear a human-only class', async () => {
    const input: ScreeningInput = { kind: 'comment', text: ADVERSARIAL_CASES[9]!.text };
    const local = screenContent(input);
    expect(local.requiresHumanReview).toBe(true);
    const result = await screenWithProvider(input, {
      provider: provider(async () => ({ classScores: { 'self-harm': 0, spam: 0 } })),
    });
    expect(result.verdict.requiresHumanReview).toBe(true);
    expect(result.verdict.decision).toBe('human-review');
  });

  it('never lowers requiresHumanReview, whatever the merged scores say', () => {
    // Direct contract test on the merge. The max-merge above already keeps a
    // human-only class score high, so this pins the separate rule that a local
    // human-review verdict survives the merge unconditionally: a future change
    // to how scores combine must not be able to quietly clear one.
    const local = screenContent({ kind: 'comment', text: ADVERSARIAL_CASES[9]!.text });
    expect(local.requiresHumanReview).toBe(true);
    const stripped = {
      ...local,
      classScores: { ...local.classScores, 'self-harm': 0, spam: 0 },
    };
    const merged = mergeVendorScores(
      stripped,
      { classScores: {} },
      'quietvendor',
      DEFAULT_SCREENING_CONFIG,
    );
    expect(merged.classScores['self-harm']).toBe(0);
    expect(merged.requiresHumanReview).toBe(true);
    expect(merged.decision).not.toBe('allow');
  });

  it('clamps junk vendor numbers instead of trusting them', async () => {
    const local = screenContent(cleanInput);
    const merged = mergeVendorScores(
      local,
      {
        classScores: {
          hate: 42 as unknown as number,
          spam: Number.NaN as unknown as number,
          threats: -5 as unknown as number,
        },
      },
      'junkvendor',
      DEFAULT_SCREENING_CONFIG,
    );
    expect(merged.classScores.hate).toBe(1);
    expect(merged.classScores.spam).toBe(local.classScores.spam);
    expect(merged.classScores.threats).toBe(local.classScores.threats);
  });

  it('surfaces vendor explanations verbatim alongside the local ones', async () => {
    const result = await screenWithProvider(cleanInput, {
      provider: provider(async () => ({
        classScores: { hate: 0.9 },
        explanations: ['vendor model v3 flagged segment 2'],
      })),
    });
    expect(result.verdict.explanations).toContain('vendor model v3 flagged segment 2');
    expect(result.providerNote).toContain('can only raise a class, never clear one');
  });

  it('records a vendor signal only for classes the vendor actually raised', async () => {
    const result = await screenWithProvider(cleanInput, {
      provider: provider(async () => ({ classScores: { hate: 0.9, spam: 0 } })),
    });
    const codes = result.verdict.signals.map((signal) => signal.code);
    expect(codes).toContain('vendor.testvendor.hate');
    expect(codes).not.toContain('vendor.testvendor.spam');
  });
});
