import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  createPostgrestMyNewsPaymentsStore,
  type MyNewsPaymentsStore,
  type PrivatePayoutAccount,
  type SupportCheckoutClaim,
} from '../_shared/mynews-payments-store.ts';

export interface SupportCheckoutInput {
  amountCents: number;
  platformFeeCents: number;
  destinationAccountRef: string;
  supporterProfileId: string;
  journalistProfileId: string;
  idempotencyKey: string;
  successUrl: string;
  cancelUrl: string;
}

export interface JournalistSupportProvider {
  createCheckout(input: SupportCheckoutInput): Promise<{ url: string }>;
  createConnectedAccount(journalistProfileId: string): Promise<{ accountRef: string }>;
  createOnboardingLink(input: {
    accountRef: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
}

export interface SupportFunctionUrls {
  checkoutSuccess: string;
  checkoutCancel: string;
  onboardingRefresh: string;
  onboardingReturn: string;
}

export interface MyNewsSupportDeps {
  store: MyNewsPaymentsStore | null;
  provider: JournalistSupportProvider | null;
  urls: SupportFunctionUrls | null;
}

interface CheckoutBody {
  action: 'create_checkout';
  journalistProfileId: string;
  amountCents: number;
  idempotencyKey: string;
}

interface OnboardingBody {
  action: 'create_onboarding';
}

type SupportBody = CheckoutBody | OnboardingBody;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{16,128}$/;

function parseBody(value: unknown): SupportBody | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.action === 'create_onboarding') return { action: 'create_onboarding' };
  if (
    body.action === 'create_checkout' &&
    typeof body.journalistProfileId === 'string' &&
    UUID.test(body.journalistProfileId) &&
    typeof body.amountCents === 'number' &&
    Number.isSafeInteger(body.amountCents) &&
    body.amountCents >= 100 &&
    body.amountCents <= 100_000 &&
    typeof body.idempotencyKey === 'string' &&
    IDEMPOTENCY_KEY.test(body.idempotencyKey)
  ) {
    return {
      action: 'create_checkout',
      journalistProfileId: body.journalistProfileId,
      amountCents: body.amountCents,
      idempotencyKey: body.idempotencyKey,
    };
  }
  return null;
}

export async function handleMyNewsSupportRequest(
  req: Request,
  deps: MyNewsSupportDeps,
): Promise<Response> {
  if (req.method !== 'POST') return jsonError('method-not-allowed', 405, 'POST only');
  if (!deps.store || !deps.provider || !deps.urls) {
    return jsonError('payments-unconfigured', 503, 'journalist support is not configured');
  }

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401);

  let body: SupportBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  // Only a parsed, whitelisted action reaches the log line.
  annotateRequestLog(req, { action: body.action });

  try {
    if (body.action === 'create_checkout') {
      const supporterProfileId = await deps.store.getProfileIdByUserId(userId);
      if (!supporterProfileId) return jsonError('no-profile', 403);
      if (supporterProfileId === body.journalistProfileId) {
        return jsonError('self-support-not-allowed', 400);
      }
      const payout = await deps.store.getJournalistPayoutAccount(body.journalistProfileId);
      if (
        !payout ||
        payout.onboardingState !== 'verified' ||
        payout.provider !== 'stripe' ||
        !payout.providerAccountRef
      ) {
        return jsonError('journalist-payout-unavailable', 409);
      }

      // One durable claim covers both jobs: real idempotency (a repeated key
      // replays the ORIGINAL checkout instead of opening a second session) and
      // the two velocity buckets (per supporter, per journalist recipient),
      // which are charged only for a genuinely new confirmed attempt. A store
      // error here fails CLOSED: no provider call, no checkout.
      let claim: SupportCheckoutClaim;
      try {
        claim = await deps.store.claimSupportCheckout({
          idempotencyKey: body.idempotencyKey,
          supporterProfileId,
          journalistProfileId: body.journalistProfileId,
          amountCents: body.amountCents,
        });
      } catch (error) {
        console.error('mynews support checkout claim failed', error);
        return jsonError(
          'payments-unavailable',
          503,
          'journalist support is temporarily unavailable',
        );
      }

      if (claim.status === 'rate-limited') {
        return jsonError(
          'support-rate-limited',
          429,
          claim.rateScope === 'recipient'
            ? 'This journalist is receiving too much support traffic right now. Try again later.'
            : 'Too many support attempts. Try again later.',
        );
      }
      if (claim.status === 'conflict') {
        return jsonError(
          'idempotency-key-conflict',
          409,
          'That confirmation was already used for a different journalist or amount.',
        );
      }
      if (claim.status === 'bad-request') return jsonError('bad-payload', 400);
      if (claim.status === 'replayed' && claim.checkoutUrl) {
        return jsonOk({ checkoutUrl: claim.checkoutUrl, replayed: true });
      }

      // 'new', or 'replayed' with no recorded URL (a prior attempt never got a
      // checkout back). Either way the provider receives the same idempotency
      // key, so it returns the same session rather than charging twice.
      const platformFeeCents = Math.round((body.amountCents * 200) / 10_000);
      const checkout = await deps.provider.createCheckout({
        amountCents: body.amountCents,
        platformFeeCents,
        destinationAccountRef: payout.providerAccountRef,
        supporterProfileId,
        journalistProfileId: body.journalistProfileId,
        idempotencyKey: body.idempotencyKey,
        successUrl: deps.urls.checkoutSuccess,
        cancelUrl: deps.urls.checkoutCancel,
      });
      // Recording the URL is what makes the next retry a replay. A failure here
      // must not lose the checkout the reader already has.
      try {
        await deps.store.recordSupportCheckoutUrl(body.idempotencyKey, checkout.url);
      } catch (error) {
        console.error('mynews support checkout url record failed', error);
      }
      return jsonOk({ checkoutUrl: checkout.url });
    }

    let payout = await deps.store.getOwnedJournalistPayoutAccount(userId);
    if (!payout) return jsonError('journalist-profile-required', 403);
    if (payout.onboardingState === 'verified') {
      return jsonOk({ status: 'verified' });
    }
    if (!payout.providerAccountRef) {
      const created = await deps.provider.createConnectedAccount(payout.journalistProfileId);
      payout = {
        ...payout,
        onboardingState: 'pending',
        provider: 'stripe',
        providerAccountRef: created.accountRef,
        statusReason: null,
      };
      await deps.store.upsertPayoutAccount(payout);
    }
    // The block above always sets a ref, but the declared type still allows
    // null. Fail closed rather than ask the provider to open onboarding for an
    // empty account.
    const accountRef = payout.providerAccountRef;
    if (!accountRef) {
      return jsonError('payments-unavailable', 503, 'the payout account could not be prepared');
    }
    const link = await deps.provider.createOnboardingLink({
      accountRef,
      refreshUrl: deps.urls.onboardingRefresh,
      returnUrl: deps.urls.onboardingReturn,
    });
    return jsonOk({ onboardingUrl: link.url, status: payout.onboardingState });
  } catch (error) {
    console.error('mynews support provider request failed', error);
    return jsonError('payments-unavailable', 503, 'journalist support is temporarily unavailable');
  }
}

interface StripeProviderConfig {
  secretKey: string;
}

class StripeConnectSupportProvider implements JournalistSupportProvider {
  constructor(
    private readonly config: StripeProviderConfig,
    private readonly send: typeof fetch,
  ) {}

  async createCheckout(input: SupportCheckoutInput): Promise<{ url: string }> {
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(input.amountCents),
      'line_items[0][price_data][product_data][name]': 'Journalist support',
      'payment_intent_data[application_fee_amount]': String(input.platformFeeCents),
      'payment_intent_data[transfer_data][destination]': input.destinationAccountRef,
      'payment_intent_data[metadata][supporter_profile_id]': input.supporterProfileId,
      'payment_intent_data[metadata][journalist_profile_id]': input.journalistProfileId,
      'metadata[supporter_profile_id]': input.supporterProfileId,
      'metadata[journalist_profile_id]': input.journalistProfileId,
    });
    const response = await this.stripe<{ url?: string }>('/v1/checkout/sessions', params, {
      'Idempotency-Key': input.idempotencyKey,
    });
    if (!response.url) throw new Error('Stripe did not return a checkout URL');
    return { url: response.url };
  }

  async createConnectedAccount(journalistProfileId: string): Promise<{ accountRef: string }> {
    const response = await this.stripe<{ id?: string }>(
      '/v1/accounts',
      new URLSearchParams({
        type: 'express',
        'metadata[journalist_profile_id]': journalistProfileId,
      }),
    );
    if (!response.id) throw new Error('Stripe did not return an account reference');
    return { accountRef: response.id };
  }

  async createOnboardingLink(input: {
    accountRef: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const response = await this.stripe<{ url?: string }>(
      '/v1/account_links',
      new URLSearchParams({
        account: input.accountRef,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: 'account_onboarding',
      }),
    );
    if (!response.url) throw new Error('Stripe did not return an onboarding URL');
    return { url: response.url };
  }

  private async stripe<T>(
    path: string,
    body: URLSearchParams,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const response = await this.send(`https://api.stripe.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body: body.toString(),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Stripe request failed with HTTP ${response.status}${text ? `: ${text}` : ''}`);
    }
    return JSON.parse(text) as T;
  }
}

export function createStripeConnectSupportProvider(
  secretKey: string,
  send: typeof fetch,
): JournalistSupportProvider {
  if (!secretKey.trim().startsWith('sk_')) throw new Error('Stripe secret key is invalid');
  return new StripeConnectSupportProvider({ secretKey: secretKey.trim() }, send);
}

function configuredUrls(env: (key: string) => string | undefined): SupportFunctionUrls | null {
  const values = {
    checkoutSuccess: env('MYNEWS_PAYMENTS_SUCCESS_URL')?.trim(),
    checkoutCancel: env('MYNEWS_PAYMENTS_CANCEL_URL')?.trim(),
    onboardingRefresh: env('MYNEWS_PAYOUT_REFRESH_URL')?.trim(),
    onboardingReturn: env('MYNEWS_PAYOUT_RETURN_URL')?.trim(),
  };
  if (Object.values(values).some((value) => !value || !/^https:\/\//.test(value))) return null;
  return values as SupportFunctionUrls;
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response>) => void;
      env: { get(key: string): string | undefined };
    }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  let store: MyNewsPaymentsStore | null = null;
  let provider: JournalistSupportProvider | null = null;
  const urls = configuredUrls(env);
  if (env('MYNEWS_PAYMENTS_PROVIDER')?.trim().toLowerCase() === 'stripe') {
    try {
      store = createPostgrestMyNewsPaymentsStore(env, fetch);
      const secretKey = env('MYNEWS_STRIPE_SECRET_KEY')?.trim();
      provider = secretKey ? createStripeConnectSupportProvider(secretKey, fetch) : null;
    } catch (error) {
      console.error('mynews support configuration failed', error);
    }
  }
  Deno.serve(
    serveEnvelope((req) => handleMyNewsSupportRequest(req, { store, provider, urls }), {
      fn: 'mynews-support',
      action: 'support',
    }),
  );
}

