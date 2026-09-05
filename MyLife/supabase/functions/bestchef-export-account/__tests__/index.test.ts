import { describe, expect, it, vi } from 'vitest';
import {
  buildBestChefAccountExport,
  handleAccountExportRequest,
  parseContentRangeTotal,
  type AccountExportDeps,
  type AccountExportStore,
  type ExportCollection,
} from '../index.ts';

const NOW = '2026-07-11T12:00:00.000Z';

// A JWT with sub=user-1 (unsigned; the gateway verifies signatures in prod,
// getUserIdFromAuth only reads the sub claim). header.payload.signature.
function jwtFor(sub: string, extra: Record<string, unknown> = {}): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, ...extra })}.sig`;
}

function collection(rows: Record<string, unknown>[], total = rows.length): ExportCollection {
  return { count: total, truncated: total > rows.length, rows };
}

function makeStore(overrides: Partial<AccountExportStore> = {}): AccountExportStore {
  return {
    getProfileId: vi.fn(async () => 'profile-1'),
    getProfile: vi.fn(async () => ({ id: 'profile-1', handle: 'chef', user_id: 'user-1' })),
    getCreatorStatus: vi.fn(async () => ({ status: 'approved' })),
    listSubmissions: vi.fn(async () => collection([{ id: 'sub-1' }])),
    listVotes: vi.fn(async () => collection([{ id: 'vote-1' }])),
    listComments: vi.fn(async () => collection([{ id: 'comment-1' }])),
    listFollowing: vi.fn(async () => collection([{ follower_id: 'profile-1', chef_id: 'profile-2' }])),
    listFollowers: vi.fn(async () => collection([{ follower_id: 'profile-3', chef_id: 'profile-1' }])),
    listFlagsFiled: vi.fn(async () => collection([{ id: 'flag-1' }])),
    listMediaAssets: vi.fn(async () =>
      collection([{ id: 'asset-1', storage_bucket: 'bc-media', storage_key: 'k/1.jpg' }]),
    ),
    listAppeals: vi.fn(async () => collection([{ id: 'appeal-1' }])),
    listNotifications: vi.fn(async () => collection([{ id: 'notif-1' }])),
    ...overrides,
  };
}

function makeDeps(store: AccountExportStore): AccountExportDeps {
  return { env: () => undefined, now: () => NOW, store };
}

function makeRequest(opts: { auth?: string | null; method?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.auth !== null) {
    headers.set('Authorization', `Bearer ${opts.auth ?? jwtFor('user-1')}`);
  }
  return new Request('http://localhost/functions/bestchef-export-account', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : '{}',
  });
}

describe('buildBestChefAccountExport', () => {
  it('assembles every scoped collection for a user with a profile', async () => {
    const store = makeStore();
    const data = await buildBestChefAccountExport('user-1', makeDeps(store));

    expect(data._meta).toMatchObject({
      app: 'BestChef',
      scope: 'account',
      format: 'gdpr-art-20',
      userId: 'user-1',
      profileId: 'profile-1',
      exportedAt: NOW,
    });
    expect(data.profile).toMatchObject({ id: 'profile-1' });
    expect(data.creatorStatus).toMatchObject({ status: 'approved' });
    expect(data.submissions.rows).toHaveLength(1);
    expect(data.mediaAssets.rows[0]).toMatchObject({ storage_key: 'k/1.jpg' });
    expect(data.appeals.rows).toHaveLength(1);
    expect(data.notifications.rows).toHaveLength(1);
  });

  it('scopes every collection query to the requesting user/profile', async () => {
    const store = makeStore();
    await buildBestChefAccountExport('user-1', makeDeps(store));

    expect(store.getProfileId).toHaveBeenCalledWith('user-1');
    expect(store.listSubmissions).toHaveBeenCalledWith('profile-1', expect.any(Number));
    expect(store.listVotes).toHaveBeenCalledWith('profile-1', expect.any(Number));
    expect(store.listFlagsFiled).toHaveBeenCalledWith('profile-1', expect.any(Number));
    // Notifications are keyed by user id, not profile id.
    expect(store.listNotifications).toHaveBeenCalledWith('user-1', expect.any(Number));
  });

  it('returns empty collections and null profile when the user has no BestChef profile', async () => {
    const store = makeStore({ getProfileId: vi.fn(async () => null) });
    const data = await buildBestChefAccountExport('user-2', makeDeps(store));

    expect(data.profile).toBeNull();
    expect(data.creatorStatus).toBeNull();
    expect(data.submissions).toEqual({ count: 0, truncated: false, rows: [] });
    expect(data.appeals).toEqual({ count: 0, truncated: false, rows: [] });
    // Notifications are user-scoped, so still queried even without a profile.
    expect(store.listNotifications).toHaveBeenCalledWith('user-2', expect.any(Number));
    // Profile-scoped tables are not queried without a profile id.
    expect(store.listSubmissions).not.toHaveBeenCalled();
  });

  it('marks a collection truncated when the reported total exceeds returned rows', async () => {
    const store = makeStore({
      listSubmissions: vi.fn(async () => collection([{ id: 'sub-1' }], 9000)),
    });
    const data = await buildBestChefAccountExport('user-1', makeDeps(store));

    expect(data.submissions.count).toBe(9000);
    expect(data.submissions.truncated).toBe(true);
    expect(data.submissions.rows).toHaveLength(1);
  });
});

describe('handleAccountExportRequest', () => {
  it('rejects a missing Authorization header with 401', async () => {
    const res = await handleAccountExportRequest(makeRequest({ auth: null }), makeDeps(makeStore()));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.kind).toBe('auth');
  });

  it('rejects non-POST with 405', async () => {
    const res = await handleAccountExportRequest(
      makeRequest({ method: 'GET' }),
      makeDeps(makeStore()),
    );
    expect(res.status).toBe(405);
  });

  it('returns the export for the authenticated user only', async () => {
    const store = makeStore();
    const res = await handleAccountExportRequest(
      makeRequest({ auth: jwtFor('user-1') }),
      makeDeps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.export._meta.userId).toBe('user-1');
    expect(store.getProfileId).toHaveBeenCalledWith('user-1');
  });

  it('surfaces a store failure as a 500 export_failed error', async () => {
    const store = makeStore({
      getProfileId: vi.fn(async () => {
        throw new Error('db down');
      }),
    });
    const res = await handleAccountExportRequest(
      makeRequest({ auth: jwtFor('user-1') }),
      makeDeps(store),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.kind).toBe('export_failed');
    expect(body.error.message).toContain('db down');
  });
});

describe('parseContentRangeTotal', () => {
  it('parses the total from a PostgREST content-range header', () => {
    expect(parseContentRangeTotal('0-24/137', 25)).toBe(137);
  });

  it('falls back when the header is missing or malformed', () => {
    expect(parseContentRangeTotal(null, 5)).toBe(5);
    expect(parseContentRangeTotal('0-24/*', 5)).toBe(5);
    expect(parseContentRangeTotal('garbage', 3)).toBe(3);
  });
});
