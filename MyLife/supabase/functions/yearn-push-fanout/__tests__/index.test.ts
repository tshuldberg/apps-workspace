import { describe, expect, it, vi } from 'vitest';
import {
  handlePushFanoutRequest,
  renderPushCopy,
  runPushFanout,
  type ExpoPushTicket,
  type OutboxRow,
  type PushFanoutDeps,
  type PushFanoutStore,
  type PushTokenRow,
} from '../index.ts';

const SECRET = 'yearn-push-worker-secret';
const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222';

interface StoreOptions {
  outbox?: OutboxRow[];
  tokens?: PushTokenRow[];
  tokensThrow?: boolean;
}

function makeStore(options: StoreOptions = {}) {
  const store: PushFanoutStore = {
    claimOutbox: vi.fn().mockResolvedValue(options.outbox ?? []),
    getTokensForUsers: options.tokensThrow
      ? vi.fn().mockRejectedValue(new Error('tokens down'))
      : vi.fn().mockResolvedValue(options.tokens ?? []),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markSkipped: vi.fn().mockResolvedValue(undefined),
    deleteTokens: vi.fn().mockResolvedValue(undefined),
  };
  return store;
}

function makeDeps(
  store: PushFanoutStore,
  tickets: ExpoPushTicket[][] | 'throws' = [],
  secret: string | null = SECRET,
): PushFanoutDeps & { sendPushChunk: ReturnType<typeof vi.fn> } {
  let call = 0;
  const sendPushChunk = tickets === 'throws'
    ? vi.fn().mockRejectedValue(new Error('expo down'))
    : vi.fn().mockImplementation(() => Promise.resolve(tickets[call++] ?? []));
  return {
    env: (key: string) =>
      key === 'YEARN_PUSH_FANOUT_WORKER_SECRET' ? secret ?? undefined : undefined,
    now: () => '2026-07-30T12:00:00.000Z',
    store,
    sendPushChunk,
  };
}

function outboxRow(id: string, userId: string, kind: string): OutboxRow {
  return { id, user_id: userId, kind, attempts: 0 };
}

function makeRequest(options: { secret?: string | null; method?: string } = {}): Request {
  const headers = new Headers();
  if (options.secret !== null) {
    headers.set('X-Yearn-Worker-Secret', options.secret ?? SECRET);
  }
  return new Request('http://localhost/functions/v1/yearn-push-fanout', {
    method: options.method ?? 'POST',
    headers,
  });
}

describe('renderPushCopy', () => {
  it('never includes identities or content, only fixed kind copy', () => {
    expect(renderPushCopy('like_received')).toEqual({ title: 'Yearn', body: 'Someone liked you' });
    expect(renderPushCopy('match_created')).toEqual({ title: 'Yearn', body: 'You have a new match' });
    expect(renderPushCopy('message_received')).toEqual({ title: 'Yearn', body: 'New message' });
  });

  it('falls back neutrally for unknown kinds instead of leaking the raw kind', () => {
    const copy = renderPushCopy('internal_debug_kind');
    expect(copy.body).not.toContain('internal_debug_kind');
    expect(copy).toEqual({ title: 'Yearn', body: 'You have new activity' });
  });
});

describe('handlePushFanoutRequest', () => {
  it('fails closed with 503 when the worker secret is unconfigured', async () => {
    const deps = makeDeps(makeStore(), [], null);
    const response = await handlePushFanoutRequest(makeRequest(), deps);
    expect(response.status).toBe(503);
    expect(deps.store.claimOutbox).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret with 401 before touching the store', async () => {
    const deps = makeDeps(makeStore());
    const response = await handlePushFanoutRequest(makeRequest({ secret: 'wrong' }), deps);
    expect(response.status).toBe(401);
    expect(deps.store.claimOutbox).not.toHaveBeenCalled();
  });

  it('rejects non-POST', async () => {
    const deps = makeDeps(makeStore());
    const response = await handlePushFanoutRequest(makeRequest({ method: 'GET' }), deps);
    expect(response.status).toBe(405);
  });

  it('drains and reports the result', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'like_received')],
      tokens: [{ user_id: USER_A, token: 'tok-a' }],
    });
    const deps = makeDeps(store, [[{ status: 'ok' }]]);
    const response = await handlePushFanoutRequest(makeRequest(), deps);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, claimed: 1, sent: 1, skipped: 0, pruned: 0 });
  });
});

describe('runPushFanout', () => {
  it('skips rows whose recipient has no tokens (push off is not a failure)', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'like_received'), outboxRow('o2', USER_B, 'match_created')],
      tokens: [{ user_id: USER_B, token: 'tok-b' }],
    });
    const deps = makeDeps(store, [[{ status: 'ok' }]]);
    const result = await runPushFanout(deps);
    expect(result).toMatchObject({ ok: true, claimed: 2, sent: 1, skipped: 1 });
    expect(store.markSkipped).toHaveBeenCalledWith(['o1']);
    expect(store.markSent).toHaveBeenCalledWith(['o2']);
  });

  it('prunes DeviceNotRegistered tokens and still counts the row as sent', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'message_received')],
      tokens: [{ user_id: USER_A, token: 'dead-token' }],
    });
    const deps = makeDeps(store, [
      [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    ]);
    const result = await runPushFanout(deps);
    expect(result).toMatchObject({ ok: true, sent: 1, pruned: 1 });
    expect(store.deleteTokens).toHaveBeenCalledWith(['dead-token']);
    expect(store.markSent).toHaveBeenCalledWith(['o1']);
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('fails the row when any token hard-fails, even if another token succeeded', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'like_received')],
      tokens: [
        { user_id: USER_A, token: 'tok-1' },
        { user_id: USER_A, token: 'tok-2' },
      ],
    });
    const deps = makeDeps(store, [
      [{ status: 'ok' }, { status: 'error', details: { error: 'MessageRateExceeded' } }],
    ]);
    const result = await runPushFanout(deps);
    expect(result.ok).toBe(false);
    expect(result.sent).toBe(0);
    expect(store.markSent).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledWith('o1', 'MessageRateExceeded');
  });

  it('marks the chunk failed for retry when the Expo send throws', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'like_received')],
      tokens: [{ user_id: USER_A, token: 'tok-a' }],
    });
    const deps = makeDeps(store, 'throws');
    const result = await runPushFanout(deps);
    expect(result.ok).toBe(false);
    expect(store.markFailed).toHaveBeenCalledWith('o1', 'expo down');
  });

  it('fails the whole batch cleanly when the token fetch fails (rows stay queued)', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'like_received')],
      tokensThrow: true,
    });
    const deps = makeDeps(store);
    const result = await runPushFanout(deps);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([{ outboxId: 'o1', error: 'tokens down' }]);
    expect(store.markSent).not.toHaveBeenCalled();
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(store.markSkipped).not.toHaveBeenCalled();
  });

  it('sends kind-only payloads (no ids, no content) to every device of the recipient', async () => {
    const store = makeStore({
      outbox: [outboxRow('o1', USER_A, 'match_created')],
      tokens: [
        { user_id: USER_A, token: 'tok-1' },
        { user_id: USER_A, token: 'tok-2' },
      ],
    });
    const deps = makeDeps(store, [[{ status: 'ok' }, { status: 'ok' }]]);
    const result = await runPushFanout(deps);
    expect(result).toMatchObject({ ok: true, sent: 1 });
    const messages = deps.sendPushChunk.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.data).toEqual({ kind: 'match_created' });
      expect(message.body).toBe('You have a new match');
    }
  });
});
