import { GET } from '../route';
import { getHubEntitlement } from '@mylife/db';
import { getAdapter } from '@/lib/db';

vi.mock('@mylife/db', () => ({
  getHubEntitlement: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getAdapter: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/entitlements/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.MYLIFE_ENTITLEMENT_SYNC_KEY = 'sync-key';
    vi.mocked(getAdapter).mockReturnValue({ id: 'db-adapter' } as any);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function requestWithHeaders(key?: string) {
    return {
      headers: new Headers(key ? { 'x-entitlement-sync-key': key } : undefined),
      nextUrl: new URL('http://localhost/api/entitlements/sync'),
    } as any;
  }

  it('returns 401 for invalid sync key', async () => {
    const response = await GET(requestWithHeaders('wrong-key'));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/Invalid entitlement sync key/);
  });

  it('returns 404 when no entitlement exists', async () => {
    vi.mocked(getHubEntitlement).mockReturnValue(null);

    const response = await GET(requestWithHeaders('sync-key'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'No entitlement found.' });
  });

  it('returns normalized entitlement payload on success', async () => {
    vi.mocked(getHubEntitlement).mockReturnValue({
      app_id: 'demo-app',
      mode: 'hosted',
      hosted_active: true,
      self_host_license: null,
      update_pack_year: 2026,
      features: ['books', 'surf'],
      issued_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2027-01-01T00:00:00.000Z',
      signature: 'sig-123',
      raw_token: 'raw-token',
    } as any);

    const response = await GET(requestWithHeaders('sync-key'));

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload).toMatchObject({
      token: 'raw-token',
      entitlements: {
        appId: 'demo-app',
        mode: 'hosted',
        hostedActive: true,
        updatePackYear: 2026,
        signature: 'sig-123',
      },
    });
    expect(typeof payload.syncedAt).toBe('string');
  });
});
