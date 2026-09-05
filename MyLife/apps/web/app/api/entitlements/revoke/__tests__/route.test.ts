import { POST } from '../route';
import { revokeHubEntitlement } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { clearStoredEntitlement, getStoredEntitlement } from '@/lib/entitlements';

vi.mock('@mylife/db', () => ({
  revokeHubEntitlement: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getAdapter: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  clearStoredEntitlement: vi.fn(),
  getStoredEntitlement: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/entitlements/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.MYLIFE_ENTITLEMENT_REVOKE_KEY = 'revoke-key';
    vi.mocked(getAdapter).mockReturnValue({ id: 'db-adapter' } as any);
    vi.mocked(getStoredEntitlement).mockReturnValue({ signature: 'sig-123' } as any);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function requestWithBody(
    body: unknown,
    opts?: { throwJson?: boolean; key?: string },
  ) {
    return {
      json: opts?.throwJson
        ? vi.fn().mockRejectedValue(new Error('bad json'))
        : vi.fn().mockResolvedValue(body),
      headers: new Headers(
        opts?.key ? { 'x-entitlement-revoke-key': opts.key } : undefined,
      ),
      nextUrl: new URL('http://localhost/api/entitlements/revoke'),
    } as any;
  }

  it('returns 401 for invalid revoke key', async () => {
    const response = await POST(requestWithBody({ signature: 'sig-123' }, { key: 'wrong' }));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/Invalid entitlement revoke key/);
  });

  it('returns 400 for invalid JSON body', async () => {
    const response = await POST(requestWithBody(null, { throwJson: true, key: 'revoke-key' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body.' });
  });

  it('returns 400 when signature is missing', async () => {
    const response = await POST(requestWithBody({ signature: '   ' }, { key: 'revoke-key' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Validation failed.',
      issues: expect.arrayContaining([expect.stringContaining('signature is required')]),
    });
  });

  it('revokes matching signature and clears cached entitlement', async () => {
    const response = await POST(
      requestWithBody(
        { signature: 'sig-123', reason: 'chargeback', sourceEventId: 'evt-1' },
        { key: 'revoke-key' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, signature: 'sig-123' });

    expect(revokeHubEntitlement).toHaveBeenCalledWith(
      { id: 'db-adapter' },
      'sig-123',
      'chargeback',
      'evt-1',
    );
    expect(clearStoredEntitlement).toHaveBeenCalledTimes(1);
  });

  it('does not clear cache when signature differs', async () => {
    vi.mocked(getStoredEntitlement).mockReturnValue({ signature: 'different' } as any);

    const response = await POST(
      requestWithBody({ signature: 'sig-123' }, { key: 'revoke-key' }),
    );

    expect(response.status).toBe(200);
    expect(clearStoredEntitlement).not.toHaveBeenCalled();
  });
});
