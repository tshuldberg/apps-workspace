import { describe, expect, it } from 'vitest';
import {
  handlePushFanoutRequest,
  runPushFanout,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type OutboxRow,
  type PushFanoutDeps,
  type PushFanoutStore,
  type PushTokenRow,
} from '../index';
import { renderPushCopy, PUSH_LOCALES } from '../copy';

const NOW = '2026-07-11T12:00:00.000Z';
const SECRET = 's3cret-push';

function outbox(
  id: string,
  overrides: Partial<OutboxRow> = {},
): OutboxRow {
  return {
    id,
    notification_id: `notif-${id}`,
    user_id: overrides.user_id ?? `user-${id}`,
    kind: overrides.kind ?? 'rank_up',
    params: overrides.params ?? { new_rank: 3, delta: 2 },
    target_type: overrides.target_type ?? 'chef',
    target_id: overrides.target_id ?? `chef-${id}`,
    attempts: overrides.attempts ?? 0,
  };
}

interface FakeOptions {
  tokensByUser?: Record<string, PushTokenRow[]>;
  ticketFor?: (message: ExpoPushMessage) => ExpoPushTicket;
  sendThrows?: boolean;
  getTokensThrows?: boolean;
}

function fake(rows: OutboxRow[], options: FakeOptions = {}) {
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const deletedTokens: string[] = [];
  const sentMessages: ExpoPushMessage[] = [];

  const store: PushFanoutStore = {
    async claimOutbox(limit) {
      return rows.slice(0, limit);
    },
    async getTokensForUsers(userIds) {
      if (options.getTokensThrows) throw new Error('token fetch boom');
      const out: PushTokenRow[] = [];
      for (const uid of userIds) {
        for (const row of options.tokensByUser?.[uid] ?? []) out.push(row);
      }
      return out;
    },
    async markSent(ids) {
      sent.push(...ids);
    },
    async markSkipped(ids) {
      skipped.push(...ids);
    },
    async markFailed(id, error) {
      failed.push({ id, error });
    },
    async deleteTokens(tokens) {
      deletedTokens.push(...tokens);
    },
  };

  const deps: PushFanoutDeps = {
    env: (key) => (key === 'BESTCHEF_PUSH_FANOUT_WORKER_SECRET' ? SECRET : undefined),
    now: () => NOW,
    store,
    async sendPushChunk(messages) {
      if (options.sendThrows) throw new Error('expo down');
      sentMessages.push(...messages);
      return messages.map(
        (m) => options.ticketFor?.(m) ?? ({ status: 'ok', id: 'ticket' } as ExpoPushTicket),
      );
    },
  };

  return { store, deps, sent, skipped, failed, deletedTokens, sentMessages };
}

function tokenRow(user: string, token: string, locale = 'en'): PushTokenRow {
  return { user_id: user, token, locale };
}

describe('bestchef-push-fanout worker (audit H13)', () => {
  it('renders localized copy and sends one message per recipient token', async () => {
    const rows = [outbox('a', { user_id: 'u1', kind: 'rank_up', params: { new_rank: 4, delta: 1 } })];
    const f = fake(rows, {
      tokensByUser: {
        u1: [tokenRow('u1', 'ExpoTok[es]', 'es'), tokenRow('u1', 'ExpoTok[en]', 'en')],
      },
    });

    const result = await runPushFanout(f.deps);

    expect(result.claimed).toBe(1);
    expect(result.sent).toBe(1);
    expect(f.sentMessages).toHaveLength(2);
    const es = f.sentMessages.find((m) => m.to === 'ExpoTok[es]');
    const en = f.sentMessages.find((m) => m.to === 'ExpoTok[en]');
    // Spanish and English titles differ -> per-token localization happened.
    expect(es?.title).toBe('Subiste al puesto #4');
    expect(en?.title).toBe('You moved up to #4');
    // delta=1 -> singular body form
    expect(en?.body).toBe('Up 1 rank this week');
    // deep-link data carries the buildTargetRoute path for a chef target
    expect(en?.data?.targetRoute).toBe('/chef/chef-a');
    expect(en?.data?.kind).toBe('rank_up');
    expect(f.sent).toEqual(['a']);
  });

  it('skips (does not fail) a recipient with no live tokens', async () => {
    const rows = [outbox('a', { user_id: 'u1' })];
    const f = fake(rows, { tokensByUser: {} });

    const result = await runPushFanout(f.deps);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(f.skipped).toEqual(['a']);
    expect(f.sentMessages).toHaveLength(0);
  });

  it('prunes tokens reported DeviceNotRegistered but still counts the row sent', async () => {
    const rows = [outbox('a', { user_id: 'u1' })];
    const f = fake(rows, {
      tokensByUser: { u1: [tokenRow('u1', 'DeadTok', 'en')] },
      ticketFor: () => ({ status: 'error', details: { error: 'DeviceNotRegistered' } }),
    });

    const result = await runPushFanout(f.deps);

    expect(result.pruned).toBe(1);
    expect(f.deletedTokens).toEqual(['DeadTok']);
    // Delivery was attempted honestly; the row is sent, not failed.
    expect(result.sent).toBe(1);
    expect(f.sent).toEqual(['a']);
  });

  it('marks a row failed on a non-DeviceNotRegistered Expo error and does not mark it sent', async () => {
    const rows = [outbox('a', { user_id: 'u1' })];
    const f = fake(rows, {
      tokensByUser: { u1: [tokenRow('u1', 'BadTok', 'en')] },
      ticketFor: () => ({ status: 'error', details: { error: 'MessageRateExceeded' } }),
    });

    const result = await runPushFanout(f.deps);

    expect(result.ok).toBe(false);
    expect(result.sent).toBe(0);
    expect(f.sent).toEqual([]);
    expect(f.failed[0]?.id).toBe('a');
    expect(f.failed[0]?.error).toBe('MessageRateExceeded');
  });

  it('batches across the 100-message Expo limit', async () => {
    // 250 recipients, one token each -> 3 send chunks.
    const rows: OutboxRow[] = [];
    const tokensByUser: Record<string, PushTokenRow[]> = {};
    for (let i = 0; i < 250; i++) {
      const uid = `u${i}`;
      rows.push(outbox(`o${i}`, { user_id: uid }));
      tokensByUser[uid] = [tokenRow(uid, `Tok${i}`, 'en')];
    }
    let chunks = 0;
    const f = fake(rows, { tokensByUser });
    const spiedDeps: PushFanoutDeps = {
      ...f.deps,
      async sendPushChunk(messages) {
        chunks += 1;
        expect(messages.length).toBeLessThanOrEqual(100);
        return messages.map(() => ({ status: 'ok' }) as ExpoPushTicket);
      },
    };

    const result = await runPushFanout(spiedDeps, 500);

    expect(result.claimed).toBe(250);
    expect(result.sent).toBe(250);
    expect(chunks).toBe(3);
  });

  it('isolates a chunk send throw to that chunk (rows retried, not lost)', async () => {
    const rows = [outbox('a', { user_id: 'u1' })];
    const f = fake(rows, {
      tokensByUser: { u1: [tokenRow('u1', 'Tok', 'en')] },
      sendThrows: true,
    });

    const result = await runPushFanout(f.deps);

    expect(result.ok).toBe(false);
    expect(result.sent).toBe(0);
    expect(f.failed[0]?.id).toBe('a');
  });

  it('fails the whole batch cleanly when the token fetch throws', async () => {
    const rows = [outbox('a'), outbox('b')];
    const f = fake(rows, { getTokensThrows: true });

    const result = await runPushFanout(f.deps);

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(2);
    // Nothing was marked sent/skipped; rows stay queued for the next run.
    expect(f.sent).toEqual([]);
    expect(f.skipped).toEqual([]);
  });

  it('falls back to a localized generic body for a non-flagship kind', async () => {
    const rows = [outbox('a', { user_id: 'u1', kind: 'upvote', params: {} })];
    const f = fake(rows, { tokensByUser: { u1: [tokenRow('u1', 'Tok', 'de')] } });

    await runPushFanout(f.deps);

    expect(f.sentMessages[0]?.title).toBe('BestChef');
    expect(f.sentMessages[0]?.body).toBe('Du hast eine neue Benachrichtigung');
  });
});

describe('handlePushFanoutRequest gating', () => {
  function bareDeps(): PushFanoutDeps {
    return fake([]).deps;
  }

  it('rejects non-POST', async () => {
    const res = await handlePushFanoutRequest(
      new Request('https://x/f', { method: 'GET' }),
      bareDeps(),
    );
    expect(res.status).toBe(405);
  });

  it('503s when the worker secret is unconfigured', async () => {
    const deps: PushFanoutDeps = { ...bareDeps(), env: () => undefined };
    const res = await handlePushFanoutRequest(
      new Request('https://x/f', { method: 'POST' }),
      deps,
    );
    expect(res.status).toBe(503);
  });

  it('401s without the worker secret', async () => {
    const res = await handlePushFanoutRequest(
      new Request('https://x/f', { method: 'POST' }),
      bareDeps(),
    );
    expect(res.status).toBe(401);
  });

  it('401s with a wrong worker secret', async () => {
    const res = await handlePushFanoutRequest(
      new Request('https://x/f', {
        method: 'POST',
        headers: { 'X-BestChef-Worker-Secret': 'nope' },
      }),
      bareDeps(),
    );
    expect(res.status).toBe(401);
  });

  it('accepts the correct worker secret and drains', async () => {
    const res = await handlePushFanoutRequest(
      new Request('https://x/f', {
        method: 'POST',
        headers: { 'X-BestChef-Worker-Secret': SECRET },
      }),
      bareDeps(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; claimed: number };
    expect(body.ok).toBe(true);
    expect(body.claimed).toBe(0);
  });
});

describe('renderPushCopy', () => {
  it('renders rank_milestone with the milestone title and plural body', () => {
    const copy = renderPushCopy('rank_milestone', { new_rank: 1, delta: 5 }, 'en');
    expect(copy.title).toBe('You climbed to #1!');
    expect(copy.body).toBe('Up 5 ranks this week');
  });

  it('renders a moderation_decision removal with appeal guidance when available', () => {
    const copy = renderPushCopy(
      'moderation_decision',
      { decision: 'removed', appeal_available: true },
      'en',
    );
    expect(copy.title).toBe('Your content was removed');
    expect(copy.body).toBe('You can appeal this decision.');
  });

  it('omits appeal guidance when no appeal is available', () => {
    const copy = renderPushCopy(
      'moderation_decision',
      { decision: 'hidden', appeal_available: false },
      'en',
    );
    expect(copy.title).toBe('Your content was hidden');
    expect(copy.body).toBe('');
  });

  it('renders appeal_resolved overturned vs upheld', () => {
    const overturned = renderPushCopy('appeal_resolved', { outcome: 'overturned' }, 'en');
    expect(overturned.title).toBe('Your appeal was approved');
    const upheld = renderPushCopy('appeal_resolved', { outcome: 'upheld' }, 'en');
    expect(upheld.title).toBe('Your appeal was reviewed');
  });

  it('falls back to en for an unknown locale', () => {
    const copy = renderPushCopy('rank_up', { new_rank: 2, delta: 1 }, 'xx' as never);
    expect(copy.title).toBe('You moved up to #2');
  });

  it('renders the Indic locales (bn, ta, te) with localized, interpolated copy', () => {
    for (const locale of ['bn', 'ta', 'te'] as const) {
      const copy = renderPushCopy('rank_up', { new_rank: 7, delta: 3 }, locale);
      // Interpolation lands and the copy is not the English source.
      expect(copy.title).toContain('7');
      expect(copy.body).toContain('3');
      expect(copy.title).not.toBe('You moved up to #7');
      // Contains characters outside the ASCII range (native script rendered).
      expect(/[^\x00-\x7F]/.test(copy.title)).toBe(true);
      expect(/[^\x00-\x7F]/.test(copy.body)).toBe(true);
    }
  });
});

describe('PUSH_LOCALES coverage', () => {
  it('includes all 24 BestChef locales with a complete copy block each', () => {
    expect(PUSH_LOCALES).toHaveLength(24);
    for (const locale of ['bn', 'ta', 'te'] as const) {
      expect(PUSH_LOCALES).toContain(locale);
      const generic = renderPushCopy('some_unknown_kind', {}, locale);
      expect(generic.body.length).toBeGreaterThan(0);
      expect(/[^\x00-\x7F]/.test(generic.body)).toBe(true);
    }
  });
});
