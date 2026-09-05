import { describe, expect, it, vi } from 'vitest';

import {
  ENV_SCREENING_VENDOR_KEY,
  ENV_SCREENING_VENDOR_NAME,
  ENV_SCREENING_VENDOR_URL,
  canonicalScreeningPayload,
  recordScreeningAllowIfNeeded,
  resolveScreeningProvider,
  runScreeningGate,
  screeningHoldDetail,
  sha256Hex,
} from '../mynews-screening-gate.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../mynews-store.ts';

const PROFILE_ID = 'profile-1';
const CLEAN_TEXT =
  'The council voted seven to two on Tuesday to approve the transit budget, ending three months of hearings.';
const HATE_TEXT = 'you are nothing but a kike and everyone knows it';

function seeded() {
  return createInMemoryMyNewsStore({
    profiles: [{ id: PROFILE_ID, userId: 'auth-1', pubkey: 'ab'.repeat(32) }],
  });
}

describe('canonicalScreeningPayload', () => {
  it('includes the kind, so an approval for one kind is not an approval for another', () => {
    const asComment = canonicalScreeningPayload({ kind: 'comment', text: 'hello' });
    const asArticle = canonicalScreeningPayload({ kind: 'article', text: 'hello' });
    expect(asComment).not.toBe(asArticle);
  });

  it('separates fields with control characters that content cannot contain', () => {
    // Without a separator, a title ending in the body's first words would hash
    // the same as a shifted split, which would let an allowance cover text it
    // was never approved for.
    const a = canonicalScreeningPayload({ kind: 'article', title: 'ab', text: 'c' });
    const b = canonicalScreeningPayload({ kind: 'article', title: 'a', text: 'bc' });
    expect(a).not.toBe(b);
  });

  it('is stable for the same input', async () => {
    const payload = canonicalScreeningPayload({ kind: 'article', title: 't', text: 'b' });
    expect(await sha256Hex(payload)).toBe(await sha256Hex(payload));
  });

  it('hashes to the known SHA-256 of a fixed string', async () => {
    // Pins the hash function itself: an accidental swap to a non-crypto hash
    // would silently weaken every allowance key.
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('runScreeningGate: allow path', () => {
  it('allows clean content and records the signature for flood detection', async () => {
    const { store, state } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('allow');
    if (result.decision !== 'allow') return;
    expect(result.allowance).toBe(false);
    expect(result.verdict?.decision).toBe('allow');
    expect(state.contentSignatures).toHaveLength(1);
    expect(state.contentSignatures[0]!.authorProfileId).toBe(PROFILE_ID);
  });

  it('does not record a decision row for an unremarkable allow', async () => {
    const { store, state } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      provider: null,
    });
    if (result.decision !== 'allow') throw new Error('expected allow');
    await recordScreeningAllowIfNeeded({
      store,
      kind: 'article',
      contentId: 'article-1',
      contentRev: 1,
      authorProfileId: PROFILE_ID,
      contentSha256: result.contentSha256,
      verdict: result.verdict,
    });
    expect(state.screeningDecisions).toHaveLength(0);
  });

  it('records a decision row for a flagged-but-allowed submission', async () => {
    const { store, state } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: 'limited time offer, work from home, passive income, visit my website',
      provider: null,
    });
    if (result.decision !== 'allow') throw new Error('expected allow');
    expect(result.verdict?.recorded).toBe(true);
    await recordScreeningAllowIfNeeded({
      store,
      kind: 'comment',
      contentId: 'suggestion-1',
      contentRev: null,
      authorProfileId: PROFILE_ID,
      contentSha256: result.contentSha256,
      verdict: result.verdict,
    });
    expect(state.screeningDecisions).toHaveLength(1);
    expect(state.screeningDecisions[0]!.autoAction).toBe('allowed');
    expect(state.screeningDecisions[0]!.decision).toBe('auto-allowed');
  });
});

describe('runScreeningGate: hold path', () => {
  it('holds adversarial content and reports the verdict', async () => {
    const { store } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('hold');
    if (result.decision !== 'hold') return;
    expect(result.verdict.topClass).toBe('hate');
    expect(result.contentSha256).toHaveLength(64);
  });

  it('writes author-facing copy that names the class without leaking scores', () => {
    const detail = screeningHoldDetail({
      topClass: 'child-safety',
      score: 0.9,
      thresholdHit: 'child-safety>=0.25',
    } as never);
    expect(detail).toContain('not published');
    expect(detail).toContain('child safety');
    expect(detail).toContain('appeal');
    expect(detail).not.toContain('0.9');
    expect(detail).not.toContain('>=');
    expect(detail).not.toContain('—');
  });
});

describe('runScreeningGate: allowances', () => {
  it('skips screening when a human already approved these exact bytes', async () => {
    const { store, state } = seeded();
    const payload = canonicalScreeningPayload({ kind: 'comment', text: HATE_TEXT });
    state.screeningAllowances.push({
      authorProfileId: PROFILE_ID,
      contentSha256: await sha256Hex(payload),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('allow');
    if (result.decision !== 'allow') return;
    expect(result.allowance).toBe(true);
    expect(result.verdict).toBeNull();
  });

  it('does not honor an expired allowance', async () => {
    const { store, state } = seeded();
    const payload = canonicalScreeningPayload({ kind: 'comment', text: HATE_TEXT });
    state.screeningAllowances.push({
      authorProfileId: PROFILE_ID,
      contentSha256: await sha256Hex(payload),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('hold');
  });

  it('does not honor another author allowance for the same bytes', async () => {
    const { store, state } = seeded();
    const payload = canonicalScreeningPayload({ kind: 'comment', text: HATE_TEXT });
    state.screeningAllowances.push({
      authorProfileId: 'someone-else',
      contentSha256: await sha256Hex(payload),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('hold');
  });

  it('does not honor an allowance for different bytes', async () => {
    const { store, state } = seeded();
    const payload = canonicalScreeningPayload({ kind: 'comment', text: `${HATE_TEXT} extra` });
    state.screeningAllowances.push({
      authorProfileId: PROFILE_ID,
      contentSha256: await sha256Hex(payload),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('hold');
  });
});

describe('runScreeningGate: fail-closed behavior', () => {
  function failingStore(overrides: Partial<MyNewsStore>): MyNewsStore {
    const { store } = seeded();
    return { ...store, ...overrides } as MyNewsStore;
  }

  it('refuses the write when the allowance read fails', async () => {
    const store = failingStore({
      screeningAllowanceExists: () => Promise.reject(new Error('db down')),
    });
    const result = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('unavailable');
  });

  it('still screens when only the signature history read fails', async () => {
    // Flood history is an enrichment. Losing it must not refuse a legitimate
    // publish, and must not let adversarial content through either.
    const store = failingStore({
      getRecentContentSignatures: () => Promise.reject(new Error('db down')),
    });
    const clean = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      provider: null,
    });
    expect(clean.decision).toBe('allow');
    const dirty = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider: null,
    });
    expect(dirty.decision).toBe('hold');
  });

  it('still allows when only the signature write fails', async () => {
    const store = failingStore({
      recordContentSignature: () => Promise.reject(new Error('db down')),
    });
    const result = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      provider: null,
    });
    expect(result.decision).toBe('allow');
  });

  it('swallows a failed measurement write rather than failing the publish', async () => {
    const store = failingStore({
      recordScreeningAllow: () => Promise.reject(new Error('db down')),
    });
    await expect(
      recordScreeningAllowIfNeeded({
        store,
        kind: 'article',
        contentId: 'a',
        contentRev: 1,
        authorProfileId: PROFILE_ID,
        contentSha256: 'x'.repeat(64),
        verdict: { recorded: true } as never,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('resolveScreeningProvider', () => {
  const env = (values: Record<string, string>) => (key: string) => values[key];

  it('is unconfigured without both the URL and the key', async () => {
    expect(resolveScreeningProvider(env({}), fetch)).toBeNull();
    expect(
      resolveScreeningProvider(env({ [ENV_SCREENING_VENDOR_URL]: 'https://v/' }), fetch),
    ).toBeNull();
    expect(
      resolveScreeningProvider(env({ [ENV_SCREENING_VENDOR_KEY]: 'k' }), fetch),
    ).toBeNull();
  });

  it('reports unconfigured through the gate, never a vendor verdict', async () => {
    const { store } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      env: env({}),
    });
    if (result.decision !== 'allow') throw new Error('expected allow');
    expect(result.verdict?.provider).toBe('local');
    expect(result.verdict?.explanations.at(-1)).toContain('No external screening vendor');
  });

  it('reads only class scores from a configured vendor', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ classScores: { hate: 0.95 }, decision: 'allow' }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const provider = resolveScreeningProvider(
      env({
        [ENV_SCREENING_VENDOR_URL]: 'https://vendor.example/screen',
        [ENV_SCREENING_VENDOR_KEY]: 'secret',
        [ENV_SCREENING_VENDOR_NAME]: 'acme',
      }),
      fetchImpl,
    );
    expect(provider).not.toBeNull();
    const { store } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'article',
      authorProfileId: PROFILE_ID,
      text: CLEAN_TEXT,
      provider,
    });
    // The vendor's own 'decision' field is ignored; only its scores count, and
    // they raised hate over the threshold.
    expect(result.decision).toBe('hold');
    if (result.decision !== 'hold') return;
    expect(result.verdict.provider).toBe('local+acme');
  });

  it('falls back to the local verdict on a vendor error', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const provider = resolveScreeningProvider(
      env({
        [ENV_SCREENING_VENDOR_URL]: 'https://vendor.example/screen',
        [ENV_SCREENING_VENDOR_KEY]: 'secret',
      }),
      fetchImpl,
    );
    const { store } = seeded();
    const result = await runScreeningGate({
      store,
      kind: 'comment',
      authorProfileId: PROFILE_ID,
      text: HATE_TEXT,
      provider,
    });
    expect(result.decision).toBe('hold');
    if (result.decision !== 'hold') return;
    expect(result.verdict.provider).toBe('local');
    expect(result.verdict.explanations.at(-1)).toContain('failed');
  });

  it('never sends the vendor key to the wrong place', async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), auth: headers.get('Authorization') });
      return new Response(JSON.stringify({ classScores: {} }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = resolveScreeningProvider(
      env({
        [ENV_SCREENING_VENDOR_URL]: 'https://vendor.example/screen',
        [ENV_SCREENING_VENDOR_KEY]: 'secret',
      }),
      fetchImpl,
    );
    await provider!.screen({ kind: 'comment', text: 'hello' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://vendor.example/screen');
    expect(calls[0]!.auth).toBe('Bearer secret');
  });
});
