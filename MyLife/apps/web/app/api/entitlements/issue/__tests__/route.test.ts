import { POST } from '../route';
import {
  issueSignedEntitlement,
  parseIssueEntitlementInput,
} from '@/lib/billing/entitlement-issuer';

vi.mock('@/lib/billing/entitlement-issuer', () => ({
  parseIssueEntitlementInput: vi.fn(),
  issueSignedEntitlement: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/entitlements/issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.MYLIFE_ENTITLEMENT_ISSUER_KEY = 'issuer-key';
    process.env.MYLIFE_ENTITLEMENT_SECRET = 'signing-secret';
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function requestWithBody(body: unknown, opts?: { throwJson?: boolean; key?: string }) {
    return {
      json: opts?.throwJson
        ? vi.fn().mockRejectedValue(new Error('bad json'))
        : vi.fn().mockResolvedValue(body),
      headers: new Headers(
        opts?.key ? { 'x-entitlement-issuer-key': opts.key } : undefined,
      ),
      nextUrl: new URL('http://localhost/api/entitlements/issue'),
    } as any;
  }

  it('returns 503 when issuer env is missing (fail closed on misconfiguration)', async () => {
    delete process.env.MYLIFE_ENTITLEMENT_ISSUER_KEY;

    const response = await POST(requestWithBody({}, { key: 'issuer-key' }));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('entitlement issuer key');
  });

  it('returns 503 when signing secret env is missing', async () => {
    delete process.env.MYLIFE_ENTITLEMENT_SECRET;

    const response = await POST(requestWithBody({}, { key: 'issuer-key' }));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Entitlement signing secret');
  });

  it('returns 401 for invalid issuer key', async () => {
    const response = await POST(requestWithBody({}, { key: 'wrong-key' }));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/Invalid entitlement issuer key/);
  });

  it('returns 400 for invalid JSON body', async () => {
    const response = await POST(requestWithBody(null, { throwJson: true, key: 'issuer-key' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body.' });
  });

  it('returns 400 when parsed input is invalid', async () => {
    vi.mocked(parseIssueEntitlementInput).mockReturnValue({
      ok: false,
      error: 'appId is required',
    } as any);

    const response = await POST(requestWithBody({ any: 'data' }, { key: 'issuer-key' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'appId is required' });
  });

  it('issues signed entitlement on valid request', async () => {
    vi.mocked(parseIssueEntitlementInput).mockReturnValue({
      ok: true,
      data: { appId: 'demo-app' },
    } as any);

    vi.mocked(issueSignedEntitlement).mockResolvedValue({
      token: 'signed-token',
      entitlements: {
        appId: 'demo-app',
        mode: 'hosted',
      },
    } as any);

    const response = await POST(requestWithBody({ appId: 'demo-app' }, { key: 'issuer-key' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: 'signed-token',
      entitlements: {
        appId: 'demo-app',
        mode: 'hosted',
      },
    });

    expect(issueSignedEntitlement).toHaveBeenCalledWith(
      { appId: 'demo-app' },
      'signing-secret',
    );
  });
});
