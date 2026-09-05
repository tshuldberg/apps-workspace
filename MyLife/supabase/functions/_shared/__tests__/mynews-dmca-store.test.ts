import { describe, expect, it } from 'vitest';
import {
  createInMemoryMyNewsStore,
  type DmcaCounterNoticeRecord,
  type DmcaTakedownRecord,
} from '../mynews-store.ts';

const AUTHOR = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'auth-author';
const VERSION = '2026-07-12';
const GOOD_FAITH =
  'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.';
const ACCURACY =
  'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.';
const MISTAKE =
  'I state under penalty of perjury that I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.';
const JURISDICTION =
  'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, for any judicial district in which MyNews may be found.';
const SERVICE =
  "I will accept service of process from the person who submitted the original notice of claimed infringement, or that person's agent.";

function seeded() {
  const built = createInMemoryMyNewsStore({
    profiles: [{ id: AUTHOR, userId: USER_ID, pubkey: 'ab'.repeat(32), handle: 'author' }],
    authEmails: [{ userId: USER_ID, email: 'ada@example.com' }],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: AUTHOR,
    authorPubkey: 'ab'.repeat(32),
    currentRev: 1,
    newsroomId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  return built;
}

const TAKEDOWN: DmcaTakedownRecord = {
  submitterProfileId: null,
  complainantName: 'Ada Rights',
  complainantEmail: 'ada@example.com',
  complainantAddress: '1 Main St',
  copyrightedWork: 'My photo essay',
  infringingUrl: 'https://mynews.app/article/owens-valley',
  goodFaith: true,
  goodFaithAttestationText: GOOD_FAITH,
  goodFaithAttestationVersion: VERSION,
  accuracyUnderPenalty: true,
  accuracyAttestationText: ACCURACY,
  accuracyAttestationVersion: VERSION,
  signature: 'Ada Rights',
};

const COUNTER: DmcaCounterNoticeRecord = {
  submitterProfileId: AUTHOR,
  originalNoticeReference: '',
  counterNotifierName: 'Jordan Author',
  counterNotifierAddress: '2 Oak St',
  counterNotifierPhone: '+1 555 0100',
  counterNotifierEmail: 'ada@example.com',
  removedMaterial: 'My article and photo',
  materialLocationBeforeRemoval: 'https://mynews.app/article/owens-valley',
  goodFaithMistakeOrMisidentification: true,
  statementUnderPenaltyOfPerjury: true,
  mistakeAttestationText: MISTAKE,
  mistakeAttestationVersion: VERSION,
  consentToFederalJurisdiction: true,
  jurisdictionAttestationText: JURISDICTION,
  jurisdictionAttestationVersion: VERSION,
  acceptanceOfServiceOfProcess: true,
  serviceAttestationText: SERVICE,
  serviceAttestationVersion: VERSION,
  signature: 'Jordan Author',
};

describe('DMCA transactional store twin', () => {
  it('creates a linked report only when the takedown URL resolves', async () => {
    const { store, state } = seeded();
    const resolved = await store.submitDmcaTakedown(TAKEDOWN);
    expect(resolved).toMatchObject({
      outcome: 'ok',
      resolutionStatus: 'resolved',
      queueVisible: true,
      targetId: ARTICLE_ID,
    });
    expect(state.dmcaNotices[0]?.reportId).toBe(state.reports[0]?.id);

    const unresolved = await store.submitDmcaTakedown({
      ...TAKEDOWN,
      infringingUrl: 'https://mynews.app/article/not-found',
    });
    expect(unresolved.resolutionStatus).toBe('needs-resolution');
    expect(state.dmcaNotices[1]?.status).toBe('needs_resolution');
    expect(state.reports).toHaveLength(1);
  });

  it('stores counter-notices separately and links an original when its reference matches', async () => {
    const { store, state } = seeded();
    const original = await store.submitDmcaTakedown(TAKEDOWN);
    const result = await store.submitDmcaCounterNotice({
      ...COUNTER,
      originalNoticeReference: original.referenceId ?? '',
    });
    expect(result).toMatchObject({ outcome: 'ok', originalNoticeMatched: true, queueVisible: true });
    expect(state.dmcaCounterNotices[0]?.originalNoticeId).toBe(original.referenceId);
    expect(state.reports).toHaveLength(1);
  });

  it('rejects altered attestation text before any mutation', async () => {
    const { store, state } = seeded();
    expect(
      await store.submitDmcaTakedown({ ...TAKEDOWN, accuracyAttestationText: 'changed' }),
    ).toEqual({ outcome: 'bad-payload' });
    expect(
      await store.submitDmcaCounterNotice({ ...COUNTER, serviceAttestationVersion: 'old' }),
    ).toEqual({ outcome: 'bad-payload' });
    expect(state.dmcaNotices).toHaveLength(0);
    expect(state.dmcaCounterNotices).toHaveLength(0);
  });

  it('enforces the token bucket: capacity 5, one token refilled per 120 seconds', async () => {
    const { store, state } = seeded();
    const input = {
      rateKey: 'a'.repeat(64),
      ipHash: 'b'.repeat(64),
      emailHash: 'c'.repeat(64),
      nowMs: 1_000_000,
    };
    for (let index = 0; index < 5; index += 1) {
      expect(await store.consumeDmcaRateLimit(input)).toBe('allowed');
    }
    expect(await store.consumeDmcaRateLimit(input)).toBe('rate-limited');
    expect(state.dmcaRateCounters.get(input.rateKey)?.tokens ?? 1).toBeLessThan(1);
    // 119s is not enough for a full token (this attempt also resets the refill
    // anchor); a further full 120s refills one token.
    expect(
      await store.consumeDmcaRateLimit({ ...input, nowMs: input.nowMs + 119_000 }),
    ).toBe('rate-limited');
    expect(
      await store.consumeDmcaRateLimit({ ...input, nowMs: input.nowMs + 119_000 + 120_000 }),
    ).toBe('allowed');
    // The bucket never exceeds capacity even after a long idle period.
    const idleKey = { ...input, rateKey: 'd'.repeat(64), nowMs: input.nowMs + 100 * 60_000 };
    for (let index = 0; index < 5; index += 1) {
      expect(await store.consumeDmcaRateLimit(idleKey)).toBe('allowed');
    }
    expect(await store.consumeDmcaRateLimit(idleKey)).toBe('rate-limited');
  });

  it('returns status only when JWT account email, notice id, kind, and submission email match', async () => {
    const { store } = seeded();
    const submitted = await store.submitDmcaTakedown(TAKEDOWN);
    const input = {
      userId: USER_ID,
      kind: 'takedown' as const,
      noticeId: submitted.referenceId ?? '',
      email: 'ada@example.com',
    };
    expect(await store.getMyDmcaSubmissionStatus(input)).toMatchObject({
      kind: 'takedown',
      status: 'received',
      resolutionStatus: 'resolved',
    });
    expect(await store.getMyDmcaSubmissionStatus({ ...input, userId: 'other' })).toBeNull();
    expect(await store.getMyDmcaSubmissionStatus({ ...input, email: 'other@example.com' })).toBeNull();
    expect(
      await store.getMyDmcaSubmissionStatus({ ...input, noticeId: 'not-the-notice' }),
    ).toBeNull();
  });
});

describe('repeat-infringer strikes', () => {
  it('increments strikes and suspends at the configured threshold', async () => {
    const { store, state } = seeded();
    expect(
      await store.moderateStrikeAndMaybeSuspend({
        profileId: AUTHOR,
        moderatorRef: 'mod@ops',
        note: 'first',
      }),
    ).toBe('struck');
    expect(
      await store.moderateStrikeAndMaybeSuspend({
        profileId: AUTHOR,
        moderatorRef: 'mod@ops',
        note: 'second',
        threshold: 2,
      }),
    ).toBe('suspended');
    expect(await store.getCopyrightStrikes(AUTHOR)).toBe(2);
    expect(state.moderationActions.filter((action) => action.targetId === AUTHOR)).toHaveLength(3);
  });
});
