import { describe, expect, it } from 'vitest';
import {
  createFixedWindowRateLimiter,
  handleDoWorkNotifyRequest,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type NotificationPrefRow,
  type NotifyStore,
  type RateLimiter,
} from '../index.ts';

const SECRET = 'internal-secret';
const NOW = Date.parse('2026-07-03T12:00:00.000Z');

function makeRequest(
  body: unknown,
  opts: { secret?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const secret = opts.secret === undefined ? SECRET : opts.secret;
  if (secret) headers.set('x-dowork-internal', secret);
  return new Request('http://localhost/functions/dowork-notify', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

class FakeNotifyStore implements NotifyStore {
  trainerName: string | null = 'Coach Max';
  trainerUserId: string | null = 'trainer-user';
  subscribers: string[] = [];
  clients: string[] = [];
  clientLink: { trainer_id: string; client_user_id: string | null } | null = null;
  formCheck: { client_link_id: string; author_user_id: string } | null = null;
  tokensByUser = new Map<string, string[]>();
  deletedTokens: string[] = [];
  prefsByUser = new Map<string, NotificationPrefRow>();
  marketingRecipients: string[] = [];

  async getTrainerName(): Promise<string | null> {
    return this.trainerName;
  }

  async getTrainerUserId(): Promise<string | null> {
    return this.trainerUserId;
  }

  async getActiveSubscriberUserIds(): Promise<string[]> {
    return this.subscribers;
  }

  async getActiveClientUserIds(): Promise<string[]> {
    return this.clients;
  }

  async getClientLink(): Promise<{ trainer_id: string; client_user_id: string | null } | null> {
    return this.clientLink;
  }

  async getFormCheck(): Promise<{ client_link_id: string; author_user_id: string } | null> {
    return this.formCheck;
  }

  async getExpoTokens(userIds: string[]): Promise<Array<{ user_id: string; expo_token: string }>> {
    const rows: Array<{ user_id: string; expo_token: string }> = [];
    for (const userId of userIds) {
      for (const token of this.tokensByUser.get(userId) ?? []) {
        rows.push({ user_id: userId, expo_token: token });
      }
    }
    return rows;
  }

  async deleteExpoTokens(tokens: string[]): Promise<void> {
    this.deletedTokens.push(...tokens);
  }

  async getNotificationPrefs(userIds: string[]): Promise<NotificationPrefRow[]> {
    const rows: NotificationPrefRow[] = [];
    for (const userId of userIds) {
      const row = this.prefsByUser.get(userId);
      if (row) rows.push(row);
    }
    return rows;
  }

  async getMarketingRecipients(): Promise<string[]> {
    return this.marketingRecipients;
  }
}

function prefs(userId: string, over: Partial<Omit<NotificationPrefRow, 'user_id'>> = {}): NotificationPrefRow {
  return {
    user_id: userId,
    new_video: true,
    form_check: true,
    form_feedback: true,
    marketing: false,
    ...over,
  };
}

interface SenderCapture {
  chunks: ExpoPushMessage[][];
  fn: (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;
}

function okSender(): SenderCapture {
  const chunks: ExpoPushMessage[][] = [];
  return {
    chunks,
    fn: async (messages) => {
      chunks.push(messages);
      return messages.map(() => ({ status: 'ok' }) as ExpoPushTicket);
    },
  };
}

function deps(
  store: FakeNotifyStore,
  sender: (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>,
  extra: { rateLimiter?: RateLimiter; now?: () => number } = {},
) {
  return {
    store,
    internalSecret: SECRET,
    sendPushChunk: sender,
    now: extra.now ?? (() => NOW),
    rateLimiter: extra.rateLimiter,
  };
}

describe('dowork-notify auth + input', () => {
  it('rejects a wrong internal secret', async () => {
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: {} }, { secret: 'bad' }),
      deps(new FakeNotifyStore(), okSender().fn),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a missing internal secret header', async () => {
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: {} }, { secret: null }),
      deps(new FakeNotifyStore(), okSender().fn),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a secret that is a prefix of the real one (length mismatch)', async () => {
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: {} }, { secret: SECRET.slice(0, -1) }),
      deps(new FakeNotifyStore(), okSender().fn),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a secret that only differs in the last character', async () => {
    const res = await handleDoWorkNotifyRequest(
      makeRequest(
        { type: 'new_video', record: {} },
        { secret: `${SECRET.slice(0, -1)}x` },
      ),
      deps(new FakeNotifyStore(), okSender().fn),
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-POST', async () => {
    const res = await handleDoWorkNotifyRequest(
      makeRequest({}, { method: 'GET' }),
      deps(new FakeNotifyStore(), okSender().fn),
    );
    expect(res.status).toBe(405);
  });

  it('rejects an unknown type', async () => {
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'nope', record: {} }),
      deps(new FakeNotifyStore(), okSender().fn),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a malformed body', async () => {
    const req = new Request('http://localhost/functions/dowork-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dowork-internal': SECRET },
      body: 'not json',
    });
    const res = await handleDoWorkNotifyRequest(req, deps(new FakeNotifyStore(), okSender().fn));
    expect(res.status).toBe(400);
  });
});

describe('dowork-notify new_video', () => {
  it('notifies the union of active subscribers and active clients', async () => {
    const store = new FakeNotifyStore();
    store.subscribers = ['sub-1', 'sub-2'];
    store.clients = ['sub-2', 'client-1']; // sub-2 overlaps -> deduped
    store.tokensByUser.set('sub-1', ['ExpoTok[1]']);
    store.tokensByUser.set('sub-2', ['ExpoTok[2]']);
    store.tokensByUser.set('client-1', ['ExpoTok[3]']);
    const sender = okSender();

    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'video-1', trainer_id: 'trainer-1', title: 'Heavy Squats' } }),
      deps(store, sender.fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(3);
    expect(sender.chunks[0]?.[0]?.title).toBe('New workout from Coach Max');
    expect(sender.chunks[0]?.[0]?.body).toBe('Heavy Squats');
  });

  it('returns zero when the trainer has no recipients', async () => {
    const store = new FakeNotifyStore();
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } }),
      deps(store, okSender().fn),
    );
    const body = await res.json();
    expect(body).toEqual({ ok: true, sent: 0, pruned: 0 });
  });
});

describe('dowork-notify form_check', () => {
  it('notifies the link trainer, excluding the author', async () => {
    const store = new FakeNotifyStore();
    store.clientLink = { trainer_id: 'trainer-1', client_user_id: 'client-1' };
    store.trainerUserId = 'trainer-user';
    store.tokensByUser.set('trainer-user', ['ExpoTok[t]']);
    const sender = okSender();

    const res = await handleDoWorkNotifyRequest(
      makeRequest({
        type: 'form_check',
        record: { id: 'fc-1', client_link_id: 'link-1', author_user_id: 'client-1' },
      }),
      deps(store, sender.fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(sender.chunks[0]?.[0]?.body).toBe('New form check from your client');
  });

  it('does not notify the trainer when the trainer authored the form check', async () => {
    const store = new FakeNotifyStore();
    store.clientLink = { trainer_id: 'trainer-1', client_user_id: 'client-1' };
    store.trainerUserId = 'trainer-user';
    store.tokensByUser.set('trainer-user', ['ExpoTok[t]']);

    const res = await handleDoWorkNotifyRequest(
      makeRequest({
        type: 'form_check',
        record: { id: 'fc-1', client_link_id: 'link-1', author_user_id: 'trainer-user' },
      }),
      deps(store, okSender().fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(0);
  });
});

describe('dowork-notify form_feedback', () => {
  it('notifies the other participant (the client) when the trainer authored feedback', async () => {
    const store = new FakeNotifyStore();
    store.formCheck = { client_link_id: 'link-1', author_user_id: 'client-1' };
    store.clientLink = { trainer_id: 'trainer-1', client_user_id: 'client-1' };
    store.trainerUserId = 'trainer-user';
    store.tokensByUser.set('client-1', ['ExpoTok[c]']);
    const sender = okSender();

    const res = await handleDoWorkNotifyRequest(
      makeRequest({
        type: 'form_feedback',
        record: { id: 'fb-1', form_check_id: 'fc-1', author_user_id: 'trainer-user' },
      }),
      deps(store, sender.fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(sender.chunks[0]?.[0]?.body).toBe('Your trainer left feedback');
    expect(sender.chunks[0]?.[0]?.to).toBe('ExpoTok[c]');
  });
});

describe('dowork-notify delivery', () => {
  it('chunks more than 100 tokens into batches of 100', async () => {
    const store = new FakeNotifyStore();
    store.subscribers = ['sub-1'];
    store.tokensByUser.set('sub-1', Array.from({ length: 250 }, (_, i) => `ExpoTok[${i}]`));
    const sender = okSender();

    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } }),
      deps(store, sender.fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(250);
    expect(sender.chunks.map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it('prunes tokens that report DeviceNotRegistered', async () => {
    const store = new FakeNotifyStore();
    store.subscribers = ['sub-1'];
    store.tokensByUser.set('sub-1', ['ExpoTok[good]', 'ExpoTok[dead]']);
    const sender: (m: ExpoPushMessage[]) => Promise<ExpoPushTicket[]> = async (messages) =>
      messages.map((m) =>
        m.to === 'ExpoTok[dead]'
          ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok' },
      );

    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } }),
      deps(store, sender),
    );
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.pruned).toBe(1);
    expect(store.deletedTokens).toEqual(['ExpoTok[dead]']);
  });

  it('continues past a chunk whose send throws', async () => {
    const store = new FakeNotifyStore();
    store.subscribers = ['sub-1'];
    store.tokensByUser.set('sub-1', Array.from({ length: 150 }, (_, i) => `ExpoTok[${i}]`));
    let call = 0;
    const sender: (m: ExpoPushMessage[]) => Promise<ExpoPushTicket[]> = async (messages) => {
      call += 1;
      if (call === 1) throw new Error('network');
      return messages.map(() => ({ status: 'ok' }) as ExpoPushTicket);
    };

    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } }),
      deps(store, sender),
    );
    const body = await res.json();
    // First chunk (100) failed; second chunk (50) succeeded.
    expect(body.sent).toBe(50);
  });
});

describe('dowork-notify preference filtering', () => {
  it('drops a recipient who opted out of new_video', async () => {
    const store = new FakeNotifyStore();
    store.subscribers = ['sub-on', 'sub-off'];
    store.tokensByUser.set('sub-on', ['ExpoTok[on]']);
    store.tokensByUser.set('sub-off', ['ExpoTok[off]']);
    store.prefsByUser.set('sub-off', prefs('sub-off', { new_video: false }));
    const sender = okSender();

    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } }),
      deps(store, sender.fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(sender.chunks[0]?.map((m) => m.to)).toEqual(['ExpoTok[on]']);
  });

  it('keeps a recipient with a prefs row that only turns off a different type', async () => {
    const store = new FakeNotifyStore();
    store.subscribers = ['sub-1'];
    store.tokensByUser.set('sub-1', ['ExpoTok[1]']);
    // marketing off (the default) must not affect a transactional new_video send.
    store.prefsByUser.set('sub-1', prefs('sub-1', { marketing: false }));

    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } }),
      deps(store, okSender().fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(1);
  });

  it('defaults to sending when the recipient has no prefs row', async () => {
    const store = new FakeNotifyStore();
    store.clientLink = { trainer_id: 'trainer-1', client_user_id: 'client-1' };
    store.trainerUserId = 'trainer-user';
    store.tokensByUser.set('trainer-user', ['ExpoTok[t]']);
    // No prefs row for trainer-user -> the form_check default (on) applies.

    const res = await handleDoWorkNotifyRequest(
      makeRequest({
        type: 'form_check',
        record: { id: 'fc-1', client_link_id: 'link-1', author_user_id: 'client-1' },
      }),
      deps(store, okSender().fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(1);
  });

  it('drops a form_feedback recipient who opted out of feedback', async () => {
    const store = new FakeNotifyStore();
    store.formCheck = { client_link_id: 'link-1', author_user_id: 'trainer-user' };
    store.clientLink = { trainer_id: 'trainer-1', client_user_id: 'client-1' };
    store.trainerUserId = 'trainer-user';
    store.tokensByUser.set('client-1', ['ExpoTok[c]']);
    store.prefsByUser.set('client-1', prefs('client-1', { form_feedback: false }));

    const res = await handleDoWorkNotifyRequest(
      makeRequest({
        type: 'form_feedback',
        record: { id: 'fb-1', form_check_id: 'fc-1', author_user_id: 'trainer-user' },
      }),
      deps(store, okSender().fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(0);
  });
});

describe('dowork-notify marketing', () => {
  it('sends only to the marketing opt-in audience', async () => {
    const store = new FakeNotifyStore();
    store.marketingRecipients = ['opt-1', 'opt-2'];
    store.tokensByUser.set('opt-1', ['ExpoTok[1]']);
    store.tokensByUser.set('opt-2', ['ExpoTok[2]']);
    // A user who never opted in is not in marketingRecipients, so never targeted.
    store.tokensByUser.set('never', ['ExpoTok[never]']);
    const sender = okSender();

    const res = await handleDoWorkNotifyRequest(
      makeRequest({
        type: 'marketing',
        record: { title: 'New year, new PRs', body: 'Kick off January with a fresh program.' },
      }),
      deps(store, sender.fn),
    );
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(sender.chunks[0]?.[0]?.title).toBe('New year, new PRs');
    expect(sender.chunks[0]?.map((m) => m.to).sort()).toEqual(['ExpoTok[1]', 'ExpoTok[2]']);
  });

  it('rejects a marketing send with no body', async () => {
    const store = new FakeNotifyStore();
    store.marketingRecipients = ['opt-1'];
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'marketing', record: { title: 'Empty' } }),
      deps(store, okSender().fn),
    );
    expect(res.status).toBe(400);
  });

  it('returns zero when nobody has opted into marketing', async () => {
    const store = new FakeNotifyStore();
    store.marketingRecipients = [];
    const res = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'marketing', record: { title: 'Promo', body: 'Hello' } }),
      deps(store, okSender().fn),
    );
    const body = await res.json();
    expect(body).toEqual({ ok: true, sent: 0, pruned: 0 });
  });
});

describe('dowork-notify rate limiting (BK-2)', () => {
  function newVideoRequest() {
    return makeRequest({ type: 'new_video', record: { id: 'v', trainer_id: 'trainer-1' } });
  }

  it('rejects authenticated requests once the per-window cap is exceeded', async () => {
    const store = new FakeNotifyStore();
    const limiter = createFixedWindowRateLimiter(3, 60_000);
    const clock = () => NOW;

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await handleDoWorkNotifyRequest(
        newVideoRequest(),
        deps(store, okSender().fn, { rateLimiter: limiter, now: clock }),
      );
      statuses.push(res.status);
    }

    // The first three requests pass the cap (200, no recipients -> ok); the
    // fourth and fifth are throttled.
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });

  it('returns the rate_limited error body on a throttled request', async () => {
    const store = new FakeNotifyStore();
    const limiter = createFixedWindowRateLimiter(1, 60_000);

    await handleDoWorkNotifyRequest(
      newVideoRequest(),
      deps(store, okSender().fn, { rateLimiter: limiter }),
    );
    const res = await handleDoWorkNotifyRequest(
      newVideoRequest(),
      deps(store, okSender().fn, { rateLimiter: limiter }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });

  it('allows requests again after the window resets', async () => {
    const store = new FakeNotifyStore();
    const limiter = createFixedWindowRateLimiter(2, 60_000);
    let now = NOW;
    const clock = () => now;

    // Exhaust the window.
    for (let i = 0; i < 2; i += 1) {
      await handleDoWorkNotifyRequest(
        newVideoRequest(),
        deps(store, okSender().fn, { rateLimiter: limiter, now: clock }),
      );
    }
    const blocked = await handleDoWorkNotifyRequest(
      newVideoRequest(),
      deps(store, okSender().fn, { rateLimiter: limiter, now: clock }),
    );
    expect(blocked.status).toBe(429);

    // Advance past the window; the counter resets and requests are accepted.
    now += 60_000;
    const allowed = await handleDoWorkNotifyRequest(
      newVideoRequest(),
      deps(store, okSender().fn, { rateLimiter: limiter, now: clock }),
    );
    expect(allowed.status).toBe(200);
  });

  it('does not throttle when no limiter is supplied (existing callers unaffected)', async () => {
    const store = new FakeNotifyStore();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await handleDoWorkNotifyRequest(newVideoRequest(), deps(store, okSender().fn));
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
  });

  it('counts the request against the cap only after the secret check passes', async () => {
    const store = new FakeNotifyStore();
    const limiter = createFixedWindowRateLimiter(1, 60_000);

    // An unauthorized request must not consume the single allowed slot.
    const unauth = await handleDoWorkNotifyRequest(
      makeRequest({ type: 'new_video', record: {} }, { secret: 'bad' }),
      deps(store, okSender().fn, { rateLimiter: limiter }),
    );
    expect(unauth.status).toBe(401);

    // The one authenticated request still succeeds.
    const authed = await handleDoWorkNotifyRequest(
      newVideoRequest(),
      deps(store, okSender().fn, { rateLimiter: limiter }),
    );
    expect(authed.status).toBe(200);
  });
});
