import { describe, expect, it } from 'vitest';
import { dmcaHmacHex, handleDmcaRequest } from '../index.ts';
import { createInMemoryMyNewsStore } from '../../_shared/mynews-store.ts';

const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const SUGGESTION_ID = '22222222-2222-2222-2222-222222222222';
const SUBMITTER_USER_ID = 'auth-submitter-1';
const SUBMITTER_PROFILE_ID = '33333333-3333-3333-3333-333333333333';
const RATE_SALT = 'test-rate-salt-that-is-at-least-thirty-two-characters-long';
const NOW = Date.parse('2026-07-12T00:00:00.000Z');

const VERSION = '2026-07-12';
const TAKEDOWN_GOOD_FAITH =
  'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.';
const TAKEDOWN_ACCURACY =
  'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.';
const COUNTER_MISTAKE =
  'I state under penalty of perjury that I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.';
const COUNTER_JURISDICTION =
  'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, for any judicial district in which MyNews may be found.';
const COUNTER_SERVICE =
  "I will accept service of process from the person who submitted the original notice of claimed infringement, or that person's agent.";

const TAKEDOWN = {
  kind: 'takedown',
  complainantName: 'Ada Rights',
  complainantEmail: 'ada@example.com',
  complainantAddress: '1 Main St',
  copyrightedWork: 'My photo essay',
  infringingUrl: 'https://mynews.app/article/owens-valley',
  goodFaith: true,
  goodFaithAttestationText: TAKEDOWN_GOOD_FAITH,
  goodFaithAttestationVersion: VERSION,
  accuracyUnderPenalty: true,
  accuracyAttestationText: TAKEDOWN_ACCURACY,
  accuracyAttestationVersion: VERSION,
  signature: 'Ada Rights',
};

const COUNTER = {
  kind: 'counter',
  originalNoticeReference: '',
  counterNotifierName: 'Jordan Author',
  counterNotifierAddress: '2 Oak St',
  counterNotifierPhone: '+1 555 0100',
  counterNotifierEmail: 'jordan@example.com',
  removedMaterial: 'My article and photo',
  materialLocationBeforeRemoval: 'https://mynews.app/article/owens-valley',
  goodFaithMistakeOrMisidentification: true,
  statementUnderPenaltyOfPerjury: true,
  mistakeAttestationText: COUNTER_MISTAKE,
  mistakeAttestationVersion: VERSION,
  consentToFederalJurisdiction: true,
  jurisdictionAttestationText: COUNTER_JURISDICTION,
  jurisdictionAttestationVersion: VERSION,
  acceptanceOfServiceOfProcess: true,
  serviceAttestationText: COUNTER_SERVICE,
  serviceAttestationVersion: VERSION,
  signature: 'Jordan Author',
};

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

// Anonymous submissions must carry the BFF's HMAC-signed platform IP headers;
// the default post() signs them the way the mynews-web proxy does. Pass
// signedIp: false to simulate a caller hitting the function directly.
async function post(
  body: unknown,
  options: {
    sub?: string;
    ip?: string;
    signedIp?: boolean;
    nowMs?: number;
    extraHeaders?: Record<string, string>;
  } = {},
): Promise<Request> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.extraHeaders,
  };
  if (options.signedIp !== false && !options.extraHeaders) {
    const ip = options.ip ?? '203.0.113.10';
    const at = options.nowMs ?? NOW;
    headers['x-mynews-client-ip'] = ip;
    headers['x-mynews-proxy-timestamp'] = String(at);
    headers['x-mynews-proxy-signature'] = await dmcaHmacHex(RATE_SALT, `${at}.${ip}`);
  }
  if (options.sub) headers.Authorization = `Bearer ${jwtFor(options.sub)}`;
  return new Request('http://local/mynews-dmca', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function seeded() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      {
        id: SUBMITTER_PROFILE_ID,
        userId: SUBMITTER_USER_ID,
        pubkey: '',
        handle: 'jordan_author',
      },
    ],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: SUBMITTER_PROFILE_ID,
    authorPubkey: '',
    currentRev: 1,
    newsroomId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: SUBMITTER_PROFILE_ID,
    type: 'clarity',
    diffJson: '{}',
    citations: [],
    rationale: 'clarify',
    signature: 'sig',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'open',
  });
  return built;
}

const deps = <T extends ReturnType<typeof seeded>['store']>(store: T) => ({
  store,
  rateSalt: RATE_SALT,
  now: () => NOW,
});

describe('mynews-dmca separate transactional intake', () => {
  it('resolves an article slug server-side and returns only after its report is queue-visible', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(await post(TAKEDOWN), deps(store));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      data: {
        status: 'queued',
        referenceId: 'mem-dmca-1',
        resolutionStatus: 'resolved',
        targetKind: 'article',
        targetId: ARTICLE_ID,
      },
    });
    expect(state.dmcaNotices[0]?.targetId).toBe(ARTICLE_ID);
    expect(state.dmcaNotices[0]?.reportId).toBe(state.reports[0]?.id);
    expect(state.reports[0]?.reason).toBe('copyright');
  });

  it('resolves article ids, profile handles, and suggestion ids against stored rows', async () => {
    const article = seeded();
    await handleDmcaRequest(
      await post({ ...TAKEDOWN, infringingUrl: `https://mynews.app/article/${ARTICLE_ID}` }),
      deps(article.store),
    );
    expect(article.state.dmcaNotices[0]?.targetId).toBe(ARTICLE_ID);

    const profile = seeded();
    await handleDmcaRequest(
      await post({ ...TAKEDOWN, infringingUrl: 'https://mynews.app/journalist/jordan_author' }),
      deps(profile.store),
    );
    expect(profile.state.dmcaNotices[0]?.targetKind).toBe('profile');
    expect(profile.state.dmcaNotices[0]?.targetId).toBe(SUBMITTER_PROFILE_ID);

    const suggestion = seeded();
    await handleDmcaRequest(
      await post({ ...TAKEDOWN, infringingUrl: `https://mynews.app/suggestion/${SUGGESTION_ID}` }),
      deps(suggestion.store),
    );
    expect(suggestion.state.dmcaNotices[0]?.targetKind).toBe('suggestion');
    expect(suggestion.state.dmcaNotices[0]?.targetId).toBe(SUGGESTION_ID);
  });

  it('queues an unresolved URL honestly without creating a phantom report', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(
      await post({ ...TAKEDOWN, infringingUrl: 'https://mynews.app/article/missing-story' }),
      deps(store),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.resolutionStatus).toBe('needs-resolution');
    expect(state.dmcaNotices[0]?.status).toBe('needs_resolution');
    expect(state.dmcaNotices[0]?.targetId).toBeNull();
    expect(state.reports).toHaveLength(0);
  });

  it('stores a complete counter-notice in its own queue without spawning a report', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(await post(COUNTER), deps(store));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      status: 'queued',
      referenceId: 'mem-dmca-counter-1',
      resolutionStatus: 'resolved',
      originalNoticeMatched: false,
    });
    expect(state.dmcaCounterNotices).toHaveLength(1);
    expect(state.dmcaCounterNotices[0]?.consentToFederalJurisdiction).toBe(true);
    expect(state.dmcaCounterNotices[0]?.acceptanceOfServiceOfProcess).toBe(true);
    expect(state.reports).toHaveLength(0);
  });

  it('keeps an unmatched original reference queue-visible', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(
      await post({ ...COUNTER, originalNoticeReference: '99999999-9999-9999-9999-999999999999' }),
      deps(store),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.originalNoticeMatched).toBe(false);
    expect(state.dmcaCounterNotices[0]?.originalNoticeId).toBeNull();
  });

  it('attributes a submitter profile only after a bearer lookup succeeds', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(
      await post(TAKEDOWN, { sub: SUBMITTER_USER_ID }),
      deps(store),
    );
    expect(response.status).toBe(200);
    expect(state.dmcaNotices[0]?.submitterProfileId).toBe(SUBMITTER_PROFILE_ID);
  });

  it('rejects a takedown-shaped payload relabeled as a counter-notice', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(
      await post({ ...TAKEDOWN, kind: 'counter' }),
      deps(store),
    );
    expect(response.status).toBe(400);
    expect(state.dmcaNotices).toHaveLength(0);
    expect(state.dmcaCounterNotices).toHaveLength(0);
  });
});

describe('mynews-dmca fail-closed abuse controls', () => {
  it('returns 503 and performs no write when the rate salt is absent', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(await post(TAKEDOWN), { store, now: () => NOW });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('temporarily-unavailable');
    expect(state.dmcaNotices).toHaveLength(0);
  });

  it('returns 503 and performs no write when the durable counter fails', async () => {
    const { store, state } = seeded();
    const failingStore = {
      ...store,
      consumeDmcaRateLimit: async () => {
        throw new Error('counter unavailable');
      },
    };
    const response = await handleDmcaRequest(await post(TAKEDOWN), deps(failingStore));
    expect(response.status).toBe(503);
    expect(state.dmcaNotices).toHaveLength(0);
  });

  it('rate-limits by IP even when the submitter changes the supplied email', async () => {
    const { store } = seeded();
    for (let index = 0; index < 5; index += 1) {
      const response = await handleDmcaRequest(
        await post({ ...TAKEDOWN, complainantEmail: `ada${index}@example.com` }),
        deps(store),
      );
      expect(response.status).toBe(200);
    }
    const blocked = await handleDmcaRequest(
      await post({ ...TAKEDOWN, complainantEmail: 'another@example.com' }),
      deps(store),
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('rate-limited');
  });

  it('rate-limits by complainant email even when the platform IP rotates', async () => {
    // Defense in depth against a caller who can vary the trusted platform IP:
    // the email-only bucket caps unbounded statutory notices under one email
    // regardless of IP. Each request here uses a DIFFERENT signed IP but the
    // same email, so only the email bucket can catch it.
    const { store } = seeded();
    for (let index = 0; index < 5; index += 1) {
      const response = await handleDmcaRequest(
        await post(TAKEDOWN, { ip: `198.51.100.${index}` }),
        deps(store),
      );
      expect(response.status).toBe(200);
    }
    const blocked = await handleDmcaRequest(
      await post(TAKEDOWN, { ip: '198.51.100.200' }),
      deps(store),
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('rate-limited');
  });

  it('returns 503 when no platform IP can be derived', async () => {
    const { store } = seeded();
    const request = new Request('http://local/mynews-dmca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TAKEDOWN),
    });
    expect((await handleDmcaRequest(request, deps(store))).status).toBe(503);
  });

  it('accepts a fresh signed proxy IP and rejects a tampered signature', async () => {
    const ip = '198.51.100.20';
    const signature = await dmcaHmacHex(RATE_SALT, `${NOW}.${ip}`);
    const valid = seeded();
    const validResponse = await handleDmcaRequest(
      await post(TAKEDOWN, {
        extraHeaders: {
          'x-mynews-client-ip': ip,
          'x-mynews-proxy-timestamp': String(NOW),
          'x-mynews-proxy-signature': signature,
        },
      }),
      deps(valid.store),
    );
    expect(validResponse.status).toBe(200);

    const tampered = seeded();
    const tamperedResponse = await handleDmcaRequest(
      await post(TAKEDOWN, {
        extraHeaders: {
          'x-mynews-client-ip': '198.51.100.21',
          'x-mynews-proxy-timestamp': String(NOW),
          'x-mynews-proxy-signature': signature,
        },
      }),
      deps(tampered.store),
    );
    expect(tamperedResponse.status).toBe(503);
    expect(tampered.state.dmcaNotices).toHaveLength(0);
  });

  it('never returns success when the transactional result does not prove queue visibility', async () => {
    const { store } = seeded();
    const lyingStore = {
      ...store,
      submitDmcaTakedown: async () => ({
        outcome: 'ok' as const,
        referenceId: 'not-visible',
        resolutionStatus: 'resolved' as const,
        queueVisible: false,
      }),
    };
    const response = await handleDmcaRequest(await post(TAKEDOWN), deps(lyingStore));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('temporarily-unavailable');
  });

  it('fails closed when an anonymous caller supplies only spoofable transport headers', async () => {
    const { store, state } = seeded();
    const direct = await handleDmcaRequest(
      await post(TAKEDOWN, {
        signedIp: false,
        extraHeaders: {
          'x-forwarded-for': '203.0.113.99',
          'cf-connecting-ip': '203.0.113.99',
          'x-real-ip': '203.0.113.99',
        },
      }),
      deps(store),
    );
    expect(direct.status).toBe(503);
    expect((await direct.json()).error).toBe('temporarily-unavailable');
    expect(state.dmcaNotices).toHaveLength(0);
  });

  it('accepts an authenticated in-app submission with no IP headers at all', async () => {
    const { store, state } = seeded();
    const response = await handleDmcaRequest(
      await post(COUNTER, { sub: SUBMITTER_USER_ID, signedIp: false }),
      deps(store),
    );
    expect(response.status).toBe(200);
    expect(state.dmcaCounterNotices).toHaveLength(1);
    expect(state.dmcaCounterNotices[0]?.submitterProfileId).toBe(SUBMITTER_PROFILE_ID);
  });

  it('rate-limits an authenticated account across rotating emails and refills one token after 120s', async () => {
    const { store } = seeded();
    let nowMs = NOW;
    const authedDeps = { store, rateSalt: RATE_SALT, now: () => nowMs };
    for (let index = 0; index < 5; index += 1) {
      const response = await handleDmcaRequest(
        await post(
          { ...TAKEDOWN, complainantEmail: `rotate${index}@example.com` },
          { sub: SUBMITTER_USER_ID, signedIp: false },
        ),
        authedDeps,
      );
      expect(response.status).toBe(200);
    }
    const blocked = await handleDmcaRequest(
      await post(
        { ...TAKEDOWN, complainantEmail: 'rotate5@example.com' },
        { sub: SUBMITTER_USER_ID, signedIp: false },
      ),
      authedDeps,
    );
    expect(blocked.status).toBe(429);

    // Token bucket, not a fixed window: 120 seconds refills exactly one token.
    nowMs = NOW + 120_000;
    const refilled = await handleDmcaRequest(
      await post(
        { ...TAKEDOWN, complainantEmail: 'rotate6@example.com' },
        { sub: SUBMITTER_USER_ID, signedIp: false },
      ),
      authedDeps,
    );
    expect(refilled.status).toBe(200);
    const drained = await handleDmcaRequest(
      await post(
        { ...TAKEDOWN, complainantEmail: 'rotate7@example.com' },
        { sub: SUBMITTER_USER_ID, signedIp: false },
      ),
      authedDeps,
    );
    expect(drained.status).toBe(429);
  });

  it('resolves every live public route shape: /a, /a/*/suggestions, /j, /e, and legacy forms', async () => {
    const cases: Array<{ url: string; kind: string; id: string }> = [
      { url: 'https://mynews.app/a/owens-valley', kind: 'article', id: ARTICLE_ID },
      { url: 'https://mynews.app/a/owens-valley/suggestions', kind: 'article', id: ARTICLE_ID },
      { url: 'https://mynews.app/j/jordan_author', kind: 'profile', id: SUBMITTER_PROFILE_ID },
      { url: 'https://mynews.app/e/jordan_author', kind: 'profile', id: SUBMITTER_PROFILE_ID },
      { url: 'https://mynews.app/profile/jordan_author', kind: 'profile', id: SUBMITTER_PROFILE_ID },
    ];
    for (const testCase of cases) {
      const { store, state } = seeded();
      const response = await handleDmcaRequest(
        await post({ ...TAKEDOWN, infringingUrl: testCase.url }),
        deps(store),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).data.resolutionStatus).toBe('resolved');
      expect(state.dmcaNotices[0]?.targetKind).toBe(testCase.kind);
      expect(state.dmcaNotices[0]?.targetId).toBe(testCase.id);
    }

    // Non-content shapes stay honestly unresolved.
    const { store, state } = seeded();
    const response = await handleDmcaRequest(
      await post({ ...TAKEDOWN, infringingUrl: 'https://mynews.app/legal/dmca' }),
      deps(store),
    );
    expect((await response.json()).data.resolutionStatus).toBe('needs-resolution');
    expect(state.reports).toHaveLength(0);
  });

  it('rejects non-POST requests', async () => {
    const { store } = seeded();
    const response = await handleDmcaRequest(
      new Request('http://local/mynews-dmca', { method: 'GET' }),
      deps(store),
    );
    expect(response.status).toBe(405);
  });
});
