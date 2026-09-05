import { resolveActorIdentity } from '../actor-identity';
import { verifyActorIdentityToken } from '@/lib/actor-identity';

vi.mock('@/lib/actor-identity', () => ({
  verifyActorIdentityToken: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

describe('resolveActorIdentity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MYLIFE_ACTOR_IDENTITY_STRICT_MODE;
    delete process.env.MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK;
    delete process.env.MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('accepts a valid actor token', () => {
    vi.mocked(verifyActorIdentityToken).mockReturnValue({
      ok: true,
      userId: 'demo-alice',
      issuedAt: '2026-02-25T00:00:00.000Z',
    });

    const result = resolveActorIdentity({ token: 'token-value', required: true });

    expect(result).toEqual({
      ok: true,
      userId: 'demo-alice',
      source: 'actor_token',
    });
  });

  it('rejects invalid actor token', () => {
    vi.mocked(verifyActorIdentityToken).mockReturnValue({
      ok: false,
      reason: 'invalid_signature',
    });

    const result = resolveActorIdentity({ token: 'bad-token', required: true });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it('allows legacy userId fallback by default', () => {
    const result = resolveActorIdentity({ userId: 'demo-alice', required: true });

    expect(result).toEqual({
      ok: true,
      userId: 'demo-alice',
      source: 'legacy_user_id',
    });
  });

  it('requires actor token when strict mode is enabled', () => {
    process.env.MYLIFE_ACTOR_IDENTITY_STRICT_MODE = 'true';

    const result = resolveActorIdentity({ userId: 'demo-alice', required: true });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain('actorToken');
  });

  it('requires actor token after legacy fallback window expires', () => {
    process.env.MYLIFE_ACTOR_IDENTITY_LEGACY_USERID_FALLBACK_UNTIL = '2024-01-01T00:00:00.000Z';

    const result = resolveActorIdentity({ userId: 'demo-alice', required: true });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it('lets explicit fallback override strict mode during migration', () => {
    process.env.MYLIFE_ACTOR_IDENTITY_STRICT_MODE = 'true';
    process.env.MYLIFE_ACTOR_IDENTITY_ALLOW_LEGACY_USERID_FALLBACK = 'true';

    const result = resolveActorIdentity({ userId: 'demo-alice', required: true });

    expect(result).toEqual({
      ok: true,
      userId: 'demo-alice',
      source: 'legacy_user_id',
    });
  });
});
