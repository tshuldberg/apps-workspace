import { describe, expect, it, vi } from 'vitest';
import {
  createSupportCheckout,
  fetchPayoutAccount,
  fetchSupportReceipts,
  newSupportIdempotencyKey,
  nextSupportConfirmation,
  startPayoutOnboarding,
} from '../(root)/data/support-client';

const CONFIG = {
  baseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
  anonKey: 'anon-key',
  functionsUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1',
};

describe('support client', () => {
  it('opens only an https checkout URL from the real edge response', async () => {
    const send = vi.fn(async () =>
      new Response(JSON.stringify({ data: { checkoutUrl: 'https://checkout.stripe.test/cs_1' } }), {
        status: 200,
      }),
    );
    await expect(
      createSupportCheckout(
        CONFIG,
        'token',
        { journalistProfileId: 'journalist', amountCents: 500, idempotencyKey: 'idem' },
        send as never,
      ),
    ).resolves.toBe('https://checkout.stripe.test/cs_1');
    expect(send).toHaveBeenCalledWith(
      `${CONFIG.functionsUrl}/mynews-support`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects a non-https provider redirect', async () => {
    const send = vi.fn(async () =>
      new Response(JSON.stringify({ data: { checkoutUrl: 'javascript:alert(1)' } }), { status: 200 }),
    );
    await expect(
      createSupportCheckout(
        CONFIG,
        'token',
        { journalistProfileId: 'journalist', amountCents: 500, idempotencyKey: 'idem' },
        send as never,
      ),
    ).rejects.toThrow(/no checkout URL/);
  });

  it('maps receipt rows into the public support shape', async () => {
    const send = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: 'receipt-1',
            supporter_profile_id: 'reader-1',
            journalist_profile_id: 'journalist-1',
            gross_cents: 500,
            platform_fee_cents: 10,
            journalist_net_cents: 490,
            refunded_cents: 0,
            currency: 'USD',
            provider_ref: 'pi_1',
            state: 'paid',
            created_at: '2026-07-12T00:00:00.000Z',
          },
        ]),
        { status: 200 },
      ),
    );
    await expect(fetchSupportReceipts(CONFIG, 'token', 'reader-1', send as never)).resolves.toEqual([
      expect.objectContaining({
        id: 'receipt-1',
        grossCents: 500,
        platformFeeCents: 10,
        journalistNetCents: 490,
        refundedCents: 0,
      }),
    ]);
  });

  it('returns the honest none state when no payout row exists', async () => {
    const send = vi.fn(async () => new Response('[]', { status: 200 }));
    await expect(fetchPayoutAccount(CONFIG, 'token', 'journalist-1', send as never)).resolves.toMatchObject({
      journalistProfileId: 'journalist-1',
      state: 'none',
      provider: null,
    });
  });

  it('keeps one idempotency key for every retry of the same confirmation', () => {
    let minted = 0;
    const mint = () => `support_stable_key_${(minted += 1)}`;
    const first = nextSupportConfirmation(
      null,
      { journalistProfileId: 'journalist-1', amountCents: 1_000 },
      mint,
    );
    const retry = nextSupportConfirmation(
      first,
      { journalistProfileId: 'journalist-1', amountCents: 1_000 },
      mint,
    );
    expect(retry).toBe(first);
    expect(minted).toBe(1);
  });

  it('mints a new key when the amount or the journalist changes', () => {
    let minted = 0;
    const mint = () => `support_stable_key_${(minted += 1)}`;
    const first = nextSupportConfirmation(
      null,
      { journalistProfileId: 'journalist-1', amountCents: 1_000 },
      mint,
    );
    const newAmount = nextSupportConfirmation(
      first,
      { journalistProfileId: 'journalist-1', amountCents: 2_500 },
      mint,
    );
    const newTarget = nextSupportConfirmation(
      newAmount,
      { journalistProfileId: 'journalist-2', amountCents: 2_500 },
      mint,
    );
    expect(newAmount.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(newTarget.idempotencyKey).not.toBe(newAmount.idempotencyKey);
    expect(newAmount.amountCents).toBe(2_500);
    expect(newTarget.journalistProfileId).toBe('journalist-2');
    expect(minted).toBe(3);
  });

  it('mints keys the edge idempotency contract accepts', () => {
    const pattern = /^[A-Za-z0-9:_-]{16,128}$/;
    for (let index = 0; index < 200; index += 1) {
      expect(newSupportIdempotencyKey(1_700_000_000_000 + index)).toMatch(pattern);
    }
    expect(
      nextSupportConfirmation(null, { journalistProfileId: 'j', amountCents: 100 })
        .idempotencyKey,
    ).toMatch(pattern);
  });

  it('surfaces edge errors and does not fabricate onboarding', async () => {
    const send = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'payments-unconfigured', detail: 'not configured' }), {
        status: 503,
      }),
    );
    await expect(startPayoutOnboarding(CONFIG, 'token', send as never)).rejects.toThrow(
      'not configured',
    );
  });
});
