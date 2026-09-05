import { describe, expect, it } from 'vitest';
import {
  generateTrainerHandle,
  handleDoWorkRedeemInviteRequest,
  slugifyHandle,
  type DoWorkInviteRow,
  type DoWorkTrainerRow,
  type InsertTrainerResult,
  type RedeemInviteStore,
} from '../index.ts';

const NOW = Date.parse('2026-07-03T12:00:00.000Z');

const FAKE_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1' }));
  return `${header}.${payload}.sig`;
})();

function makeRequest(body: unknown, opts: { auth?: string | null; method?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${FAKE_JWT}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/dowork-redeem-invite', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function invite(overrides: Partial<DoWorkInviteRow> = {}): DoWorkInviteRow {
  return {
    id: 'invite-1',
    code: 'ABCD2345EFGH',
    claimed_by: null,
    claimed_at: null,
    expires_at: new Date(NOW + 86_400_000).toISOString(),
    ...overrides,
  };
}

function trainerRow(handle: string): DoWorkTrainerRow {
  return {
    id: 'trainer-1',
    user_id: 'user-1',
    display_name: 'Coach Max',
    handle,
    headline: null,
    specialties: [],
    is_verified: true,
    is_active: true,
    price_tier: 1,
    subscriber_count: 0,
    created_at: new Date(NOW).toISOString(),
  };
}

class FakeRedeemStore implements RedeemInviteStore {
  inviteRow: DoWorkInviteRow | null = invite();
  existingTrainer: { id: string } | null = null;
  profileDisplayName: string | null = null;
  takenHandles = new Set<string>();
  insertedHandles: string[] = [];
  claimResult = true;
  claimThrows = false;
  claimedWith: { inviteId: string; userId: string } | null = null;
  deletedTrainers: string[] = [];
  rateLimited = false;
  attemptsConsumed = 0;

  async consumeInviteAttempt(): Promise<boolean> {
    this.attemptsConsumed += 1;
    return !this.rateLimited;
  }

  async getInviteByCode(): Promise<DoWorkInviteRow | null> {
    return this.inviteRow;
  }

  async getTrainerForUser(): Promise<{ id: string } | null> {
    return this.existingTrainer;
  }

  async getProfileDisplayName(): Promise<string | null> {
    return this.profileDisplayName;
  }

  async insertTrainer(input: {
    userId: string;
    displayName: string;
    handle: string;
  }): Promise<InsertTrainerResult> {
    this.insertedHandles.push(input.handle);
    if (this.existingTrainer) return { ok: false, conflict: 'user' };
    if (this.takenHandles.has(input.handle)) return { ok: false, conflict: 'handle' };
    return { ok: true, row: trainerRow(input.handle) };
  }

  async claimInvite(inviteId: string, userId: string): Promise<boolean> {
    if (this.claimThrows) throw new Error('claim failed');
    this.claimedWith = { inviteId, userId };
    return this.claimResult;
  }

  async deleteTrainer(trainerId: string): Promise<void> {
    this.deletedTrainers.push(trainerId);
  }
}

function deps(store: FakeRedeemStore) {
  let n = 0;
  return { store, now: () => NOW, randomSuffix: () => `r${(n += 1)}` };
}

describe('slugifyHandle', () => {
  it('slugs a display name to lowercase alphanumerics and hyphens', () => {
    expect(slugifyHandle('Coach Max!')).toBe('coach-max');
    expect(slugifyHandle('  Jane  Doe  ')).toBe('jane-doe');
    expect(slugifyHandle('Iron_Mike 2.0')).toBe('iron-mike-2-0');
  });

  it('falls back to trainer for an empty slug', () => {
    expect(slugifyHandle('!!!')).toBe('trainer');
  });
});

describe('generateTrainerHandle', () => {
  it('returns the bare slug first, then a numeric suffix', () => {
    const rnd = () => 'zz';
    expect(generateTrainerHandle('Coach Max', 0, rnd)).toBe('coach-max');
    expect(generateTrainerHandle('Coach Max', 1, rnd)).toBe('coach-max-2');
    expect(generateTrainerHandle('Coach Max', 6, rnd)).toBe('coach-max-7');
  });

  it('falls back to a random suffix once sequential attempts run out', () => {
    expect(generateTrainerHandle('Coach Max', 7, () => 'abc123')).toBe('coach-max-abc123');
  });
});

describe('dowork-redeem-invite', () => {
  it('rejects missing auth', async () => {
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }, { auth: null }),
      deps(new FakeRedeemStore()),
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-POST', async () => {
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({}, { method: 'GET' }),
      deps(new FakeRedeemStore()),
    );
    expect(res.status).toBe(405);
  });

  it('creates a trainer and claims the invite on the happy path', async () => {
    const store = new FakeRedeemStore();
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH', displayName: 'Coach Max' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trainer.handle).toBe('coach-max');
    expect(body.trainer.is_verified).toBe(true);
    expect(store.claimedWith).toEqual({ inviteId: 'invite-1', userId: 'user-1' });
  });

  it('falls back to the profile display name, then to Trainer', async () => {
    const store = new FakeRedeemStore();
    store.profileDisplayName = 'Iron Jane';
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }),
      deps(store),
    );
    const body = await res.json();
    expect(body.trainer.handle).toBe('iron-jane');

    const store2 = new FakeRedeemStore();
    const res2 = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }),
      deps(store2),
    );
    const body2 = await res2.json();
    expect(body2.trainer.handle).toBe('trainer');
  });

  it('returns rate_limited (429) when the attempt budget is exhausted', async () => {
    const store = new FakeRedeemStore();
    store.rateLimited = true;
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }),
      deps(store),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('rate_limited');
    expect(store.attemptsConsumed).toBe(1);
  });

  it('returns invalid_code (404) for an unknown code', async () => {
    const store = new FakeRedeemStore();
    store.inviteRow = null;
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'NOPENOPENOPE' }),
      deps(store),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('invalid_code');
  });

  it('returns invalid_code (400) for a missing code', async () => {
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({}),
      deps(new FakeRedeemStore()),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_code');
  });

  it('returns already_claimed for a claimed invite', async () => {
    const store = new FakeRedeemStore();
    store.inviteRow = invite({ claimed_by: 'someone-else' });
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }),
      deps(store),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('already_claimed');
  });

  it('returns expired for a past-expiry invite', async () => {
    const store = new FakeRedeemStore();
    store.inviteRow = invite({ expires_at: new Date(NOW - 1000).toISOString() });
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }),
      deps(store),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('expired');
  });

  it('returns already_trainer when the caller already owns a trainer row', async () => {
    const store = new FakeRedeemStore();
    store.existingTrainer = { id: 'trainer-9' };
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH' }),
      deps(store),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('already_trainer');
  });

  it('retries the handle with a numeric suffix on collision', async () => {
    const store = new FakeRedeemStore();
    store.takenHandles.add('coach-max');
    store.takenHandles.add('coach-max-2');
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH', displayName: 'Coach Max' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trainer.handle).toBe('coach-max-3');
    expect(store.insertedHandles).toEqual(['coach-max', 'coach-max-2', 'coach-max-3']);
  });

  it('compensates by deleting the trainer when the claim loses a race', async () => {
    const store = new FakeRedeemStore();
    store.claimResult = false;
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH', displayName: 'Coach Max' }),
      deps(store),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('already_claimed');
    expect(store.deletedTrainers).toEqual(['trainer-1']);
  });

  it('compensates and returns 500 when the claim update throws', async () => {
    const store = new FakeRedeemStore();
    store.claimThrows = true;
    const res = await handleDoWorkRedeemInviteRequest(
      makeRequest({ code: 'ABCD2345EFGH', displayName: 'Coach Max' }),
      deps(store),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('server_error');
    expect(store.deletedTrainers).toEqual(['trainer-1']);
  });
});
