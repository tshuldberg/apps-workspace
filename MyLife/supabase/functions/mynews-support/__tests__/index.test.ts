import { describe, expect, it, vi } from 'vitest';
import {
  handleMyNewsSupportRequest,
  type JournalistSupportProvider,
  type SupportFunctionUrls,
} from '../index.ts';
import {
  createInMemoryMyNewsPaymentsStore,
  type PrivatePayoutAccount,
} from '../../_shared/mynews-payments-store.ts';

const USER_ID = 'auth-user-1';
const SUPPORTER_ID = '11111111-1111-4111-8111-111111111111';
const JOURNALIST_ID = '22222222-2222-4222-8222-222222222222';
const SECRET_ID = '33333333-3333-4333-8333-333333333333';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, signedIn = true): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signedIn) headers.Authorization = `Bearer ${jwtFor(USER_ID)}`;
  return new Request('http://local/mynews-support', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const URLS: SupportFunctionUrls = {
  checkoutSuccess: 'https://news.controlled.example/support/success',
  checkoutCancel: 'https://news.controlled.example/support/cancel',
  onboardingRefresh: 'https://news.controlled.example/payout/refresh',
  onboardingReturn: 'https://news.controlled.example/payout/return',
};

function fakeProvider(): JournalistSupportProvider & {
  createCheckout: ReturnType<typeof vi.fn>;
  createConnectedAccount: ReturnType<typeof vi.fn>;
  createOnboardingLink: ReturnType<typeof vi.fn>;
} {
  return {
    createCheckout: vi.fn(async () => ({ url: 'https://checkout.stripe.test/session' })),
    createConnectedAccount: vi.fn(async () => ({ accountRef: 'acct_new' })),
    createOnboardingLink: vi.fn(async () => ({ url: 'https://connect.stripe.test/onboard' })),
  };
}

const verifiedPayout = (): PrivatePayoutAccount => ({
  journalistProfileId: JOURNALIST_ID,
  onboardingState: 'verified',
  provider: 'stripe',
  providerAccountRef: 'acct_verified',
  statusReason: null,
});

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('handleMyNewsSupportRequest', () => {
  it('fails closed when payments are unconfigured', async () => {
    const response = await handleMyNewsSupportRequest(post({ action: 'create_onboarding' }), {
      store: null,
      provider: null,
      urls: null,
    });
    expect(response.status).toBe(503);
    expect((await body(response)).error).toBe('payments-unconfigured');
  });

  it('requires an attributable session', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore();
    const response = await handleMyNewsSupportRequest(
      post({ action: 'create_onboarding' }, false),
      { store, provider: fakeProvider(), urls: URLS },
    );
    expect(response.status).toBe(401);
  });

  it('creates a real checkout only for a verified payout account', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 1_000,
        idempotencyKey: 'support_1234567890abcdef',
      }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(200);
    expect((await body(response)).data).toEqual({
      checkoutUrl: 'https://checkout.stripe.test/session',
    });
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1_000,
        platformFeeCents: 20,
        destinationAccountRef: 'acct_verified',
        supporterProfileId: SUPPORTER_ID,
        journalistProfileId: JOURNALIST_ID,
      }),
    );
  });

  it('blocks checkout when payout onboarding is not verified', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [{ ...verifiedPayout(), onboardingState: 'pending' }],
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 500,
        idempotencyKey: 'support_1234567890abcdef',
      }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(409);
    expect((await body(response)).error).toBe('journalist-payout-unavailable');
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects self-support and invalid amounts before the provider', async () => {
    const selfPayout = { ...verifiedPayout(), journalistProfileId: SUPPORTER_ID };
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [selfPayout],
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: SUPPORTER_ID,
        amountCents: 500,
        idempotencyKey: 'support_1234567890abcdef',
      }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toBe('self-support-not-allowed');

    const invalid = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 99,
        idempotencyKey: 'support_1234567890abcdef',
      }),
      { store, provider, urls: URLS },
    );
    expect(invalid.status).toBe(400);
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('creates and persists a Connect account before returning onboarding', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      journalists: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      payoutAccounts: [
        {
          journalistProfileId: JOURNALIST_ID,
          onboardingState: 'none',
          provider: null,
          providerAccountRef: null,
          statusReason: null,
        },
      ],
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({ action: 'create_onboarding' }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(200);
    expect((await body(response)).data).toEqual({
      onboardingUrl: 'https://connect.stripe.test/onboard',
      status: 'pending',
    });
    expect(provider.createConnectedAccount).toHaveBeenCalledWith(JOURNALIST_ID);
    expect(state.payoutAccounts.get(JOURNALIST_ID)).toMatchObject({
      onboardingState: 'pending',
      providerAccountRef: 'acct_new',
    });
    expect(provider.createOnboardingLink).toHaveBeenCalledWith(
      expect.objectContaining({ accountRef: 'acct_new' }),
    );
  });

  it('never creates another account when a pending provider account exists', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      journalists: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      payoutAccounts: [
        {
          journalistProfileId: JOURNALIST_ID,
          onboardingState: 'pending',
          provider: 'stripe',
          providerAccountRef: 'acct_existing',
          statusReason: null,
        },
      ],
    });
    const provider = fakeProvider();
    await handleMyNewsSupportRequest(post({ action: 'create_onboarding' }), {
      store,
      provider,
      urls: URLS,
    });
    expect(provider.createConnectedAccount).not.toHaveBeenCalled();
    expect(provider.createOnboardingLink).toHaveBeenCalledWith(
      expect.objectContaining({ accountRef: 'acct_existing' }),
    );
  });

  it('returns verified without opening another onboarding link', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      journalists: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({ action: 'create_onboarding' }),
      { store, provider, urls: URLS },
    );
    expect((await body(response)).data).toEqual({ status: 'verified' });
    expect(provider.createOnboardingLink).not.toHaveBeenCalled();
  });

  it('replays the original checkout for a repeated idempotency key', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    const press = () =>
      handleMyNewsSupportRequest(
        post({
          action: 'create_checkout',
          journalistProfileId: JOURNALIST_ID,
          amountCents: 1_000,
          idempotencyKey: 'support_stable_key_0001',
        }),
        { store, provider, urls: URLS },
      );

    const first = await press();
    expect(first.status).toBe(200);
    const second = await press();
    expect(second.status).toBe(200);
    expect((await body(second)).data).toEqual({
      checkoutUrl: 'https://checkout.stripe.test/session',
      replayed: true,
    });
    // The second press must not open a second provider session, and must not
    // spend a second token from either velocity bucket.
    expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    expect(state.rateBuckets.get(`supporter:${SUPPORTER_ID}`)).toBe(9);
    expect(state.rateBuckets.get(`recipient:${JOURNALIST_ID}`)).toBe(59);
  });

  it('rejects an idempotency key reused for a different amount', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    const checkout = (amountCents: number) =>
      handleMyNewsSupportRequest(
        post({
          action: 'create_checkout',
          journalistProfileId: JOURNALIST_ID,
          amountCents,
          idempotencyKey: 'support_stable_key_0002',
        }),
        { store, provider, urls: URLS },
      );

    expect((await checkout(1_000)).status).toBe(200);
    const conflict = await checkout(2_500);
    expect(conflict.status).toBe(409);
    expect((await body(conflict)).error).toBe('idempotency-key-conflict');
    expect(provider.createCheckout).toHaveBeenCalledTimes(1);
  });

  it('spends one supporter and one recipient token per new attempt', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    for (let index = 0; index < 3; index += 1) {
      const response = await handleMyNewsSupportRequest(
        post({
          action: 'create_checkout',
          journalistProfileId: JOURNALIST_ID,
          amountCents: 1_000,
          idempotencyKey: `support_fresh_key_000${index}`,
        }),
        { store, provider, urls: URLS },
      );
      expect(response.status).toBe(200);
    }
    expect(state.rateBuckets.get(`supporter:${SUPPORTER_ID}`)).toBe(7);
    expect(state.rateBuckets.get(`recipient:${JOURNALIST_ID}`)).toBe(57);
  });

  it('429s a drained supporter bucket before reaching the provider', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
      rateBuckets: { [`supporter:${SUPPORTER_ID}`]: 0 },
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 1_000,
        idempotencyKey: 'support_stable_key_0003',
      }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(429);
    expect((await body(response)).error).toBe('support-rate-limited');
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('429s a drained journalist-recipient bucket before reaching the provider', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
      rateBuckets: { [`recipient:${JOURNALIST_ID}`]: 0 },
    });
    const provider = fakeProvider();
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 1_000,
        idempotencyKey: 'support_stable_key_0004',
      }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(429);
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the velocity and idempotency counter errors', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    const failing = {
      ...store,
      claimSupportCheckout: vi.fn(async () => {
        throw new Error('counter unavailable');
      }),
    };
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 1_000,
        idempotencyKey: 'support_stable_key_0005',
      }),
      { store: failing, provider, urls: URLS },
    );
    expect(response.status).toBe(503);
    expect((await body(response)).error).toBe('payments-unavailable');
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('400s a claim the server rejects as malformed without calling the provider', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    const rejecting = {
      ...store,
      claimSupportCheckout: vi.fn(async () => ({
        status: 'bad-request' as const,
        checkoutUrl: null,
        rateScope: null,
      })),
    };
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 1_000,
        idempotencyKey: 'support_stable_key_0007',
      }),
      { store: rejecting, provider, urls: URLS },
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toBe('bad-payload');
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('opens onboarding only with a real provider account reference', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      journalists: [{ userId: USER_ID, profileId: JOURNALIST_ID }],
      payoutAccounts: [
        {
          journalistProfileId: JOURNALIST_ID,
          onboardingState: 'none',
          provider: null,
          providerAccountRef: null,
          statusReason: null,
        },
      ],
    });
    const provider = fakeProvider();
    // A provider that reports success without returning an account reference
    // must not produce an onboarding link for an empty account.
    provider.createConnectedAccount.mockResolvedValueOnce({ accountRef: '' });
    const response = await handleMyNewsSupportRequest(post({ action: 'create_onboarding' }), {
      store,
      provider,
      urls: URLS,
    });
    expect(response.status).toBe(503);
    expect((await body(response)).error).toBe('payments-unavailable');
    expect(provider.createOnboardingLink).not.toHaveBeenCalled();
  });

  it('retries the provider with the same key when a claimed attempt has no recorded URL', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    provider.createCheckout.mockRejectedValueOnce(new Error('provider down'));
    const press = () =>
      handleMyNewsSupportRequest(
        post({
          action: 'create_checkout',
          journalistProfileId: JOURNALIST_ID,
          amountCents: 1_000,
          idempotencyKey: 'support_stable_key_0006',
        }),
        { store, provider, urls: URLS },
      );

    expect((await press()).status).toBe(503);
    const retry = await press();
    expect(retry.status).toBe(200);
    expect(provider.createCheckout).toHaveBeenCalledTimes(2);
    for (const call of provider.createCheckout.mock.calls) {
      expect(call[0]).toMatchObject({ idempotencyKey: 'support_stable_key_0006' });
    }
    // Still one attempt, so the retry never charged a second token.
    expect(state.rateBuckets.get(`supporter:${SUPPORTER_ID}`)).toBe(9);
  });

  it('fails closed on provider errors', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      profiles: [{ userId: USER_ID, profileId: SUPPORTER_ID }],
      payoutAccounts: [verifiedPayout()],
    });
    const provider = fakeProvider();
    provider.createCheckout.mockRejectedValueOnce(new Error('provider down'));
    const response = await handleMyNewsSupportRequest(
      post({
        action: 'create_checkout',
        journalistProfileId: JOURNALIST_ID,
        amountCents: 500,
        idempotencyKey: 'support_1234567890abcdef',
      }),
      { store, provider, urls: URLS },
    );
    expect(response.status).toBe(503);
    expect((await body(response)).error).toBe('payments-unavailable');
  });
});

