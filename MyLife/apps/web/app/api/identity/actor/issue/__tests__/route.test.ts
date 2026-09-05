import { POST } from '../route';
import { issueActorIdentityToken } from '@/lib/actor-identity';

vi.mock('@/lib/actor-identity', () => ({
  issueActorIdentityToken: vi.fn(),
}));

const VALID_ISSUER_KEY = 'test-issuer-key';
const ORIGINAL_ENV = { ...process.env };

describe('POST /api/identity/actor/issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.MYLIFE_ACTOR_ISSUER_KEY = VALID_ISSUER_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function requestWithBody(body: unknown, opts?: { throwJson?: boolean; issuerKey?: string | null }) {
    const headers = new Headers();
    const key = opts?.issuerKey === undefined ? VALID_ISSUER_KEY : opts.issuerKey;
    if (key) headers.set('x-actor-issuer-key', key);
    return {
      json: opts?.throwJson
        ? vi.fn().mockRejectedValue(new Error('bad json'))
        : vi.fn().mockResolvedValue(body),
      headers,
      nextUrl: new URL('http://localhost/api/identity/actor/issue'),
    } as any;
  }

  it('returns 503 when the server issuer key env is unset (fail closed)', async () => {
    delete process.env.MYLIFE_ACTOR_ISSUER_KEY;

    const response = await POST(requestWithBody({ userId: 'demo-user' }, { issuerKey: null }));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('actor issuer key');
  });

  it('returns 401 when issuer key header is missing', async () => {
    const response = await POST(requestWithBody({ userId: 'demo-user' }, { issuerKey: null }));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/Invalid actor issuer key/);
  });

  it('returns 401 when issuer key is wrong', async () => {
    const response = await POST(requestWithBody({ userId: 'demo-user' }, { issuerKey: 'wrong-key' }));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/Invalid actor issuer key/);
  });

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(requestWithBody(null, { throwJson: true }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body.' });
  });

  it('returns 400 when userId is missing', async () => {
    const response = await POST(requestWithBody({ userId: '   ' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Validation failed.',
      issues: expect.arrayContaining([expect.stringContaining('userId is required')]),
    });
  });

  it('returns 500 when actor token cannot be issued', async () => {
    vi.mocked(issueActorIdentityToken).mockReturnValue(null);

    const response = await POST(requestWithBody({ userId: 'demo-user' }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Actor identity secret is not configured.',
    });
  });

  it('returns token payload on success', async () => {
    vi.mocked(issueActorIdentityToken).mockReturnValue('actor-token-123');

    const response = await POST(requestWithBody({ userId: 'demo-user' }));

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      userId: 'demo-user',
      actorToken: 'actor-token-123',
    });
    expect(typeof payload.issuedAt).toBe('string');
  });
});
