import { POST } from '../route';
import { issueSignedBundleDownloadUrl } from '@/lib/access/bundle';

vi.mock('@/lib/access/bundle', () => ({
  issueSignedBundleDownloadUrl: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/access/bundle/issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.MYLIFE_BUNDLE_ISSUER_KEY = 'bundle-key';
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function requestWithBody(
    body: unknown,
    opts?: { throwJson?: boolean; key?: string; origin?: string },
  ) {
    return {
      json: opts?.throwJson
        ? vi.fn().mockRejectedValue(new Error('bad json'))
        : vi.fn().mockResolvedValue(body),
      headers: new Headers(opts?.key ? { 'x-bundle-issuer-key': opts.key } : undefined),
      nextUrl: new URL(`${opts?.origin ?? 'https://app.mylife.test'}/api/access/bundle/issue`),
    } as any;
  }

  it('returns 401 for invalid issuer key', async () => {
    const response = await POST(requestWithBody({}, { key: 'wrong-key' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid bundle issuer key.' });
  });

  it('returns 400 for invalid JSON body', async () => {
    const response = await POST(
      requestWithBody(null, { throwJson: true, key: 'bundle-key' }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body.' });
  });

  it('returns 400 when required fields are missing', async () => {
    const response = await POST(requestWithBody({ bundleId: 'bundle-1' }, { key: 'bundle-key' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Validation failed.',
      issues: expect.arrayContaining([expect.stringContaining('eventId')]),
    });
  });

  it('returns failure reason when issuance fails', async () => {
    vi.mocked(issueSignedBundleDownloadUrl).mockReturnValue({
      ok: false,
      reason: 'secret_missing',
    } as any);

    const response = await POST(
      requestWithBody(
        { bundleId: 'bundle-1', eventId: 'evt-1' },
        { key: 'bundle-key' },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to issue bundle URL.',
      reason: 'secret_missing',
    });
  });

  it('returns signed bundle URL payload on success', async () => {
    vi.mocked(issueSignedBundleDownloadUrl).mockReturnValue({
      ok: true,
      url: 'https://app.mylife.test/api/access/bundle/download?token=abc',
      expiresAt: '2026-02-26T00:00:00.000Z',
      token: 'abc',
    } as any);

    const response = await POST(
      requestWithBody(
        {
          bundleId: 'bundle-1',
          eventId: 'evt-1',
          purchaserRef: 'user-123',
          expiresInSeconds: 600,
        },
        { key: 'bundle-key' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      downloadUrl: 'https://app.mylife.test/api/access/bundle/download?token=abc',
      expiresAt: '2026-02-26T00:00:00.000Z',
      token: 'abc',
    });

    expect(issueSignedBundleDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        bundleId: 'bundle-1',
        eventId: 'evt-1',
        purchaserRef: 'user-123',
        requestBaseUrl: 'https://app.mylife.test',
        expiresInSeconds: 600,
      }),
    );
  });
});
