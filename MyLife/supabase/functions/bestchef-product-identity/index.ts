/**
 * BestChef product-identity broker Edge Function.
 *
 * Resolves a barcode to a product name + brand + category via either
 * GS1 US Data Hub (paid) or Open Food Facts (keyless). Both are
 * server-side; no provider credentials enter the Expo bundle.
 *
 * GS1 is optional. If `GS1_CLIENT_ID`, `GS1_CLIENT_SECRET`, or
 * `GS1_ENDPOINT` are absent, GS1 calls return a typed `not_configured`
 * status without crashing.
 */

import {
  classifyUpstreamStatus,
  createInMemoryRateLimiter,
  createServiceQuotaCheck,
  envelopeError,
  envelopeOk,
  getUserIdFromAuth,
  isAnonymousAuth,
  isProviderKillSwitchEnabled,
  type BrokerDeps,
} from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const PRODUCT_RATE_LIMIT = { max: 60, windowMs: 60_000 };
/** Anonymous sessions are free to mint; give them a third of the window. */
const PRODUCT_ANON_MAX = 20;

interface ProductIdentityRequestBody {
  source?: string;
  barcode?: string;
}

interface ProductIdentityResponse {
  product: {
    barcode: string;
    product_name: string | null;
    brand: string | null;
    category: string | null;
    image_url: string | null;
  } | null;
  status: {
    code: 'ok' | 'skipped' | 'not_configured' | 'not_found' | 'error';
    message: string;
  };
}

async function lookupOff(
  barcode: string,
  deps: BrokerDeps,
): Promise<ProductIdentityResponse> {
  const userAgent = deps.env('OPEN_FOOD_FACTS_USER_AGENT') ?? 'BestChef/1.0 (broker)';
  let upstream: Response;
  try {
    upstream = await deps.fetch(`${OFF_ENDPOINT}/${encodeURIComponent(barcode)}.json`, {
      headers: { 'User-Agent': userAgent },
    });
  } catch (err) {
    return {
      product: null,
      status: {
        code: 'error',
        message: err instanceof Error ? err.message : 'OFF upstream unreachable.',
      },
    };
  }
  if (!upstream.ok) {
    return {
      product: null,
      status: { code: 'error', message: `OFF returned HTTP ${upstream.status}.` },
    };
  }
  const json = (await upstream.json().catch(() => null)) as {
    status?: number;
    product?: { product_name?: string; brands?: string; categories_tags?: string[]; image_url?: string };
  } | null;
  if (!json || json.status !== 1 || !json.product) {
    return {
      product: null,
      status: { code: 'not_found', message: 'No Open Food Facts product found.' },
    };
  }
  const tag = json.product.categories_tags?.[0] ?? null;
  return {
    product: {
      barcode,
      product_name: json.product.product_name ?? null,
      brand: json.product.brands ?? null,
      category: tag,
      image_url: json.product.image_url ?? null,
    },
    status: { code: 'ok', message: 'Open Food Facts product returned.' },
  };
}

async function lookupGs1(
  barcode: string,
  deps: BrokerDeps,
): Promise<ProductIdentityResponse> {
  const clientId = deps.env('GS1_CLIENT_ID');
  const clientSecret = deps.env('GS1_CLIENT_SECRET');
  const endpoint = deps.env('GS1_ENDPOINT');
  if (!clientId || !clientSecret || !endpoint) {
    return {
      product: null,
      status: {
        code: 'not_configured',
        message: 'GS1 credentials are not configured for this environment.',
      },
    };
  }

  let upstream: Response;
  try {
    const url = `${endpoint.replace(/\/$/, '')}/products/${encodeURIComponent(barcode)}`;
    const auth = btoa(`${clientId}:${clientSecret}`);
    upstream = await deps.fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return {
      product: null,
      status: {
        code: 'error',
        message: err instanceof Error ? err.message : 'GS1 upstream unreachable.',
      },
    };
  }

  if (!upstream.ok) {
    if (upstream.status === 404) {
      return {
        product: null,
        status: { code: 'not_found', message: 'GS1 has no record for this barcode.' },
      };
    }
    return {
      product: null,
      status: { code: 'error', message: `GS1 returned HTTP ${upstream.status}.` },
    };
  }

  const json = (await upstream.json().catch(() => null)) as
    | { productName?: string; brand?: string; category?: string; imageUrl?: string }
    | null;
  if (!json) {
    return {
      product: null,
      status: { code: 'error', message: 'GS1 response could not be parsed.' },
    };
  }

  return {
    product: {
      barcode,
      product_name: json.productName ?? null,
      brand: json.brand ?? null,
      category: json.category ?? null,
      image_url: json.imageUrl ?? null,
    },
    status: { code: 'ok', message: 'GS1 product returned.' },
  };
}

export async function handleProductIdentityRequest(
  req: Request,
  deps: BrokerDeps,
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  if (!userId) {
    return envelopeError('auth', 'Missing or invalid Authorization header.', 401);
  }
  if (isProviderKillSwitchEnabled(deps.env)) {
    return envelopeError('provider_outage', 'Product-identity broker is temporarily disabled.', 503, 'openfoodfacts');
  }
  const quotaMax = isAnonymousAuth(authHeader) ? PRODUCT_ANON_MAX : PRODUCT_RATE_LIMIT.max;
  if (
    !deps.rateLimit.consume(
      userId,
      'product-identity',
      quotaMax,
      PRODUCT_RATE_LIMIT.windowMs,
    )
  ) {
    return envelopeError('rate_limit', 'Product-identity broker rate limit exceeded.', 429);
  }
  const quota = await deps.quota(userId, 'product-identity', quotaMax, PRODUCT_RATE_LIMIT.windowMs);
  if (!quota.allowed) {
    if (quota.reason === 'user_rate_limit' || quota.reason === 'global_daily_cap') {
      return envelopeError('rate_limit', 'Product-identity broker quota exceeded.', 429);
    }
    return envelopeError('provider_outage', 'Product-identity broker is temporarily unavailable.', 503, 'openfoodfacts');
  }

  let body: ProductIdentityRequestBody;
  try {
    body = (await req.json()) as ProductIdentityRequestBody;
  } catch {
    return envelopeError('invalid_input', 'Request body must be valid JSON.', 400);
  }
  if (body.source !== 'gs1' && body.source !== 'open_food_facts') {
    return envelopeError('invalid_input', 'Unsupported product identity source.', 400);
  }
  if (!body.barcode || !/^\d{8,14}$/.test(body.barcode)) {
    return envelopeError('invalid_input', 'A numeric 8-14 digit barcode is required.', 400);
  }

  let response: ProductIdentityResponse;
  try {
    response = body.source === 'gs1'
      ? await lookupGs1(body.barcode, deps)
      : await lookupOff(body.barcode, deps);
  } catch (err) {
    const failure = err instanceof Response ? classifyUpstreamStatus(err.status) : null;
    if (failure) {
      return envelopeError(failure.errorKind, failure.message, failure.status, body.source);
    }
    return envelopeError(
      'provider_outage',
      err instanceof Error ? err.message : 'Product-identity broker failed.',
      503,
      body.source,
    );
  }

  return envelopeOk({
    provider: body.source,
    source: body.source,
    confidence: response.product ? 0.85 : null,
    data: response,
  });
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const rateLimit = createInMemoryRateLimiter();
  const denoEnv = Deno.env;
  const env = (key: string) => denoEnv.get(key);
  const quota = createServiceQuotaCheck(env, fetch);
  Deno.serve((req) =>
    handleProductIdentityRequest(req, {
      env,
      fetch,
      now: () => Date.now(),
      rateLimit,
      quota,
    }),
  );
}
