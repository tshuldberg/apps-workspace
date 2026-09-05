import { GET } from '../route';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isBundleTokenExpired,
  resolveBundleZipPath,
  verifySignedBundleToken,
} from '@/lib/access/bundle';

vi.mock('@/lib/access/bundle', () => ({
  isBundleTokenExpired: vi.fn(),
  resolveBundleZipPath: vi.fn(),
  verifySignedBundleToken: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/access/bundle/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.MYLIFE_BUNDLE_SIGNING_SECRET = 'bundle-secret';

    vi.mocked(verifySignedBundleToken).mockReturnValue({
      ok: true,
      payload: { bundleId: 'bundle-1' },
    } as any);
    vi.mocked(isBundleTokenExpired).mockReturnValue(false);
    vi.mocked(resolveBundleZipPath).mockReturnValue('/tmp/bundle-1.zip');
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function requestWithToken(token?: string) {
    const url = new URL('http://localhost/api/access/bundle/download');
    if (token) {
      url.searchParams.set('token', token);
    }
    return {
      nextUrl: url,
      headers: new Headers(),
    } as any;
  }

  it('returns 400 when token query parameter is missing', async () => {
    const response = await GET(requestWithToken());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing token query parameter.',
    });
  });

  it('returns 500 when signing secret is not configured', async () => {
    delete process.env.MYLIFE_BUNDLE_SIGNING_SECRET;

    const response = await GET(requestWithToken('token-123'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Bundle signing secret is not configured.',
    });
  });

  it('returns 401 for invalid bundle token', async () => {
    vi.mocked(verifySignedBundleToken).mockReturnValue({
      ok: false,
      reason: 'invalid_signature',
    } as any);

    const response = await GET(requestWithToken('token-123'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid bundle token.',
      reason: 'invalid_signature',
    });
  });

  it('returns 410 for expired token', async () => {
    vi.mocked(isBundleTokenExpired).mockReturnValue(true);

    const response = await GET(requestWithToken('token-123'));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: 'Bundle token is expired.',
    });
  });

  it('returns 400 for invalid bundle id', async () => {
    vi.mocked(resolveBundleZipPath).mockReturnValue(null);

    const response = await GET(requestWithToken('token-123'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid bundle id.' });
  });

  it('returns 404 when bundle file is missing', async () => {
    vi.mocked(resolveBundleZipPath).mockReturnValue('/tmp/non-existent-bundle.zip');

    const response = await GET(requestWithToken('token-123'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Bundle file not found.',
      bundleId: 'bundle-1',
    });
  });

  it('returns bundle zip content on success', async () => {
    const testDir = await fs.mkdtemp(join(tmpdir(), 'bundle-test-'));
    const bundlePath = join(testDir, 'bundle-1.zip');
    await fs.writeFile(bundlePath, Buffer.from('zip-bytes'));
    vi.mocked(resolveBundleZipPath).mockReturnValue(bundlePath);

    const response = await GET(requestWithToken('token-123'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="bundle-1.zip"',
    );

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.toString()).toBe('zip-bytes');
  });
});
